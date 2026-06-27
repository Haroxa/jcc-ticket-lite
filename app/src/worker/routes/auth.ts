import type { Account, Env } from "../types";
import { randomId, createToken, hashPassword, sha256, verifyPassword } from "../utils/crypto";
import { clearSessionCookie, getCookie, readJson, sessionCookie } from "../utils/http";
import { fail, json, ok, unauthorized } from "../utils/response";
import { getCurrentAccount, sessionMaxAgeSeconds, toSessionAccount } from "../services/authService";
import { writeAuditLog } from "../services/auditService";

type LoginPayload = {
  username?: string;
  password?: string;
};

type ChangePasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
};

type SetupPayload = {
  token?: string;
  username?: string;
  password?: string;
  displayName?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function expiresIso() {
  return new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();
}

async function createSession(env: Env, account: Account) {
  const token = createToken();
  const tokenHash = await sha256(token);
  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO sessions (id, account_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(randomId("sess"), account.id, tokenHash, now, expiresIso()).run();
  return token;
}

export async function handleSetupAdmin(request: Request, env: Env) {
  if (request.method !== "POST") return fail("请求方式不支持", 405);
  if (!env.ADMIN_INIT_TOKEN) return fail("未配置 ADMIN_INIT_TOKEN，不能初始化管理员", 500);

  const payload = await readJson<SetupPayload>(request);
  if (!payload) return fail("请求内容格式不正确");
  if (!payload.token || payload.token.trim() !== env.ADMIN_INIT_TOKEN.trim()) return fail("初始化令牌不正确", 403);
  if (!payload.username || !payload.password || !payload.displayName) {
    return fail("用户名、密码和显示名称不能为空");
  }
  if (payload.password.length < 8) return fail("管理员密码至少需要 8 位");

  const existing = await env.DB.prepare("SELECT id FROM accounts WHERE role = 'admin' LIMIT 1").first();
  if (existing) return fail("管理员已存在，不能重复初始化", 409);

  const accountId = randomId("acc");
  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO accounts (id, username, password_hash, display_name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)
  `).bind(
    accountId,
    payload.username.trim(),
    await hashPassword(payload.password),
    payload.displayName.trim(),
    now,
    now
  ).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (id, actor_account_id, actor_name, action, target_type, target_id, summary, created_at)
    VALUES (?, ?, ?, '初始化管理员', 'account', ?, ?, ?)
  `).bind(randomId("log"), accountId, payload.displayName.trim(), accountId, `创建管理员账号 ${payload.username.trim()}`, now).run();

  return ok({ created: true });
}

export async function handleLogin(request: Request, env: Env) {
  if (request.method !== "POST") return fail("请求方式不支持", 405);
  const payload = await readJson<LoginPayload>(request);
  if (!payload?.username || !payload.password) return fail("请输入用户名和密码");

  const account = await env.DB.prepare(`
    SELECT id, username, password_hash, display_name, role, status
    FROM accounts
    WHERE username = ?
    LIMIT 1
  `).bind(payload.username.trim()).first<Account & { password_hash: string }>();

  if (!account || account.status !== "active") return unauthorized("用户名或密码不正确");
  const verified = await verifyPassword(payload.password, account.password_hash);
  if (!verified) return unauthorized("用户名或密码不正确");

  const token = await createSession(env, account);
  await env.DB.prepare(`
    INSERT INTO audit_logs (id, actor_account_id, actor_name, action, target_type, target_id, summary, created_at)
    VALUES (?, ?, ?, '登录', 'account', ?, '账号登录成功', ?)
  `).bind(randomId("log"), account.id, account.display_name, account.id, nowIso()).run();

  return json(
    { ok: true, data: { account: toSessionAccount(account) } },
    { headers: { "set-cookie": sessionCookie(token, sessionMaxAgeSeconds, new URL(request.url).protocol === "https:") } }
  );
}

export async function handleLogout(request: Request, env: Env) {
  if (request.method !== "POST") return fail("请求方式不支持", 405);
  const cookie = request.headers.get("cookie") || "";
  const session = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("jcc_session="));
  if (session) {
    const token = decodeURIComponent(session.slice("jcc_session=".length));
    await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ?")
      .bind(nowIso(), await sha256(token))
      .run();
  }
  return json(
    { ok: true, data: {} },
    { headers: { "set-cookie": clearSessionCookie(new URL(request.url).protocol === "https:") } }
  );
}

export async function handleMe(request: Request, env: Env) {
  const account = await getCurrentAccount(request, env);
  if (!account) return unauthorized();
  return ok({ account });
}

export async function handleChangeMyPassword(request: Request, env: Env) {
  if (request.method !== "PATCH") return fail("请求方式不支持", 405);
  const account = await getCurrentAccount(request, env);
  if (!account) return unauthorized();

  const payload = await readJson<ChangePasswordPayload>(request);
  if (!payload?.currentPassword || !payload.newPassword) return fail("当前密码和新密码不能为空");
  if (payload.newPassword.length < 8) return fail("新密码至少需要 8 位");
  if (payload.currentPassword === payload.newPassword) return fail("新密码不能和当前密码相同");

  const current = await env.DB.prepare(`
    SELECT id, username, password_hash, display_name, role, status
    FROM accounts
    WHERE id = ?
    LIMIT 1
  `).bind(account.id).first<Account & { password_hash: string }>();
  if (!current || current.status !== "active") return unauthorized();

  const verified = await verifyPassword(payload.currentPassword, current.password_hash);
  if (!verified) return fail("当前密码不正确", 403);

  const now = nowIso();
  await env.DB.prepare(`
    UPDATE accounts
    SET password_hash = ?, updated_at = ?
    WHERE id = ?
  `).bind(await hashPassword(payload.newPassword), now, account.id).run();

  const token = getCookie(request, "jcc_session");
  if (token) {
    await env.DB.prepare(`
      UPDATE sessions
      SET revoked_at = ?
      WHERE account_id = ? AND token_hash != ? AND revoked_at IS NULL
    `).bind(now, account.id, await sha256(token)).run();
  }

  await writeAuditLog(env, account, "修改自己密码", "account", account.id, "当前账号修改登录密码");
  return ok({ updated: true });
}
