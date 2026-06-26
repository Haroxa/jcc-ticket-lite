import type { Account, AccountRole, Env, SessionAccount } from "../types";
import { writeAuditLog } from "../services/auditService";
import { getCurrentAccount } from "../services/authService";
import { randomId, hashPassword } from "../utils/crypto";
import { readJson } from "../utils/http";
import { fail, forbidden, ok, unauthorized } from "../utils/response";

type AccountStatus = "active" | "disabled";

type AccountRow = Account & {
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

type CreateAccountPayload = {
  username?: string;
  password?: string;
  displayName?: string;
  role?: AccountRole;
};

type UpdateAccountPayload = {
  displayName?: string;
  role?: AccountRole;
};

type StatusPayload = {
  status?: AccountStatus;
  reason?: string;
};

type PasswordPayload = {
  password?: string;
  reason?: string;
};

const roles = new Set<AccountRole>(["admin", "operator", "viewer"]);
const statuses = new Set<AccountStatus>(["active", "disabled"]);

function mapAccount(row: AccountRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || ""
  };
}

async function requireAdmin(request: Request, env: Env): Promise<SessionAccount | false | null> {
  const account = await getCurrentAccount(request, env);
  if (!account) return null;
  if (account.role !== "admin") return false;
  return account;
}

async function getAccount(env: Env, accountId: string) {
  return env.DB.prepare(`
    SELECT
      accounts.id,
      accounts.username,
      accounts.display_name,
      accounts.role,
      accounts.status,
      accounts.created_at,
      accounts.updated_at,
      MAX(audit_logs.created_at) AS last_login_at
    FROM accounts
    LEFT JOIN audit_logs
      ON audit_logs.actor_account_id = accounts.id
      AND audit_logs.action = '登录'
    WHERE accounts.id = ?
    GROUP BY accounts.id
    LIMIT 1
  `).bind(accountId).first<AccountRow>();
}

async function activeAdminCount(env: Env) {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS count
    FROM accounts
    WHERE role = 'admin' AND status = 'active'
  `).first<{ count: number }>();
  return row?.count || 0;
}

async function assertCanReduceAdmin(env: Env, current: AccountRow) {
  if (current.role !== "admin" || current.status !== "active") return null;
  if (await activeAdminCount(env) <= 1) return "至少需要保留一个启用的管理员账号";
  return null;
}

export async function handleAccounts(request: Request, env: Env) {
  const account = await requireAdmin(request, env);
  if (account === null) return unauthorized();
  if (account === false) return forbidden("只有管理员可以管理账号");

  if (request.method === "GET") return listAccounts(request, env);
  if (request.method === "POST") return createAccount(request, env, account);
  return fail("请求方式不支持", 405);
}

async function listAccounts(request: Request, env: Env) {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();
  const role = (url.searchParams.get("role") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") || 10)));
  const where: string[] = [];
  const bindings: string[] = [];

  if (keyword) {
    where.push("(accounts.username LIKE ? OR accounts.display_name LIKE ?)");
    bindings.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (role) {
    if (!roles.has(role as AccountRole)) return fail("角色不正确");
    where.push("accounts.role = ?");
    bindings.push(role);
  }
  if (status) {
    if (!statuses.has(status as AccountStatus)) return fail("账号状态不正确");
    where.push("accounts.status = ?");
    bindings.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM accounts ${whereSql}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const total = totalRow?.total || 0;
  const offset = (page - 1) * pageSize;
  const result = await env.DB.prepare(`
    SELECT
      accounts.id,
      accounts.username,
      accounts.display_name,
      accounts.role,
      accounts.status,
      accounts.created_at,
      accounts.updated_at,
      MAX(audit_logs.created_at) AS last_login_at
    FROM accounts
    LEFT JOIN audit_logs
      ON audit_logs.actor_account_id = accounts.id
      AND audit_logs.action = '登录'
    ${whereSql}
    GROUP BY accounts.id
    ORDER BY
      CASE accounts.status WHEN 'active' THEN 1 ELSE 2 END,
      CASE accounts.role WHEN 'admin' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END,
      accounts.created_at ASC
    LIMIT ? OFFSET ?
  `).bind(...bindings, pageSize, offset).all<AccountRow>();

  return ok({
    items: result.results.map(mapAccount),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  });
}

async function createAccount(request: Request, env: Env, actor: SessionAccount) {
  const payload = await readJson<CreateAccountPayload>(request);
  const username = payload?.username?.trim();
  const displayName = payload?.displayName?.trim();
  const role = payload?.role;
  if (!username || !displayName || !payload?.password || !role) return fail("用户名、显示名称、密码和角色不能为空");
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) return fail("用户名仅支持 3-32 位字母、数字、下划线、点和短横线");
  if (payload.password.length < 8) return fail("密码至少需要 8 位");
  if (!roles.has(role)) return fail("角色不正确");

  const now = new Date().toISOString();
  const id = randomId("acc");
  try {
    await env.DB.prepare(`
      INSERT INTO accounts (id, username, password_hash, display_name, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).bind(id, username, await hashPassword(payload.password), displayName, role, now, now).run();
  } catch {
    return fail("用户名可能已存在，请换一个用户名", 409);
  }

  const afterData = { id, username, displayName, role, status: "active" };
  await writeAuditLog(env, actor, "新增账号", "account", id, `新增账号 ${displayName}（${username}）`, undefined, afterData);
  return ok({ account: { ...afterData, createdAt: now, updatedAt: now, lastLoginAt: "" } });
}

export async function handleAccountDetail(request: Request, env: Env, accountId: string) {
  const actor = await requireAdmin(request, env);
  if (actor === null) return unauthorized();
  if (actor === false) return forbidden("只有管理员可以管理账号");
  if (request.method !== "PATCH") return fail("请求方式不支持", 405);

  const payload = await readJson<UpdateAccountPayload>(request);
  const displayName = payload?.displayName?.trim();
  const role = payload?.role;
  if (!displayName || !role) return fail("显示名称和角色不能为空");
  if (!roles.has(role)) return fail("角色不正确");

  const current = await getAccount(env, accountId);
  if (!current) return fail("账号不存在", 404);
  if (current.role === "admin" && role !== "admin") {
    const message = await assertCanReduceAdmin(env, current);
    if (message) return fail(message, 409);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE accounts
    SET display_name = ?, role = ?, updated_at = ?
    WHERE id = ?
  `).bind(displayName, role, now, accountId).run();

  const next = { ...current, display_name: displayName, role, updated_at: now };
  await writeAuditLog(
    env,
    actor,
    "编辑账号",
    "account",
    accountId,
    `编辑账号 ${current.username}：${current.display_name} -> ${displayName}，角色 ${current.role} -> ${role}`,
    mapAccount(current),
    mapAccount(next)
  );
  return ok({ account: mapAccount(next) });
}

export async function handleAccountStatus(request: Request, env: Env, accountId: string) {
  const actor = await requireAdmin(request, env);
  if (actor === null) return unauthorized();
  if (actor === false) return forbidden("只有管理员可以管理账号");
  if (request.method !== "PATCH") return fail("请求方式不支持", 405);

  const payload = await readJson<StatusPayload>(request);
  if (!payload?.status || !statuses.has(payload.status)) return fail("账号状态不正确");
  const reason = payload.reason?.trim();
  if (!reason) return fail("调整账号状态必须填写原因");
  if (accountId === actor.id && payload.status === "disabled") return fail("不能停用当前登录的自己", 409);

  const current = await getAccount(env, accountId);
  if (!current) return fail("账号不存在", 404);
  if (current.status === payload.status) return ok({ account: mapAccount(current), changed: false });
  if (payload.status === "disabled") {
    const message = await assertCanReduceAdmin(env, current);
    if (message) return fail(message, 409);
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE accounts
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).bind(payload.status, now, accountId).run();
  if (payload.status === "disabled") {
    await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL")
      .bind(now, accountId)
      .run();
  }

  const next = { ...current, status: payload.status, updated_at: now };
  await writeAuditLog(
    env,
    actor,
    "修改账号状态",
    "account",
    accountId,
    `${current.display_name}：${current.status} -> ${payload.status}，原因：${reason}`,
    mapAccount(current),
    mapAccount(next)
  );
  return ok({ account: mapAccount(next), changed: true });
}

export async function handleAccountPassword(request: Request, env: Env, accountId: string) {
  const actor = await requireAdmin(request, env);
  if (actor === null) return unauthorized();
  if (actor === false) return forbidden("只有管理员可以管理账号");
  if (request.method !== "PATCH") return fail("请求方式不支持", 405);

  const payload = await readJson<PasswordPayload>(request);
  if (!payload?.password || payload.password.length < 8) return fail("新密码至少需要 8 位");
  const reason = payload.reason?.trim();
  if (!reason) return fail("重置密码必须填写原因");

  const current = await getAccount(env, accountId);
  if (!current) return fail("账号不存在", 404);
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE accounts
    SET password_hash = ?, updated_at = ?
    WHERE id = ?
  `).bind(await hashPassword(payload.password), now, accountId).run();
  await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL")
    .bind(now, accountId)
    .run();
  await writeAuditLog(env, actor, "重置账号密码", "account", accountId, `重置 ${current.display_name} 的登录密码，原因：${reason}`);
  return ok({ updated: true });
}
