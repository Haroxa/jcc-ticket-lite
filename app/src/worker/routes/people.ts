import type { Env, SessionAccount } from "../types";
import { writeAuditLog } from "../services/auditService";
import { getCurrentAccount } from "../services/authService";
import { randomId } from "../utils/crypto";
import { readJson } from "../utils/http";
import { fail, forbidden, ok, unauthorized } from "../utils/response";

type PersonStatus = "normal" | "disabled" | "blocked";

type PersonRow = {
  id: string;
  name: string;
  alias: string | null;
  status: PersonStatus;
  cached_balance: number;
  display_priority: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type CreatePersonPayload = {
  name?: string;
  alias?: string;
  displayPriority?: number;
  note?: string;
};

type StatusPayload = {
  status?: PersonStatus;
  reason?: string;
};

type UpdatePersonPayload = {
  name?: string;
  alias?: string;
  displayPriority?: number;
  note?: string;
};

const allowedStatuses = new Set<PersonStatus>(["normal", "disabled", "blocked"]);

function mapPerson(row: PersonRow) {
  return {
    id: row.id,
    name: row.name,
    alias: row.alias || "",
    status: row.status,
    balance: row.cached_balance,
    displayPriority: row.display_priority,
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeDisplayPriority(value: unknown) {
  const priority = Number(value ?? 1);
  if (!Number.isInteger(priority) || priority < 1 || priority > 20) return 1;
  return priority;
}

async function requireAccount(request: Request, env: Env) {
  const account = await getCurrentAccount(request, env);
  return account;
}

function requireAdmin(account: SessionAccount) {
  return account.role === "admin";
}

export async function handlePeople(request: Request, env: Env) {
  const account = await requireAccount(request, env);
  if (!account) return unauthorized();

  if (request.method === "GET") return listPeople(request, env);
  if (request.method === "POST") {
    if (!requireAdmin(account)) return forbidden("只有管理员可以新增存票人");
    return createPerson(request, env, account);
  }
  return fail("请求方式不支持", 405);
}

async function listPeople(request: Request, env: Env) {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") || 10)));
  const where: string[] = [];
  const bindings: string[] = [];

  if (keyword) {
    where.push("(name LIKE ? OR alias LIKE ? OR note LIKE ?)");
    bindings.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) {
    if (!allowedStatuses.has(status as PersonStatus)) return fail("存票人状态不正确");
    where.push("status = ?");
    bindings.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ticket_people ${whereSql}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const total = totalRow?.total || 0;
  const offset = (page - 1) * pageSize;
  const result = await env.DB.prepare(`
    SELECT id, name, alias, status, cached_balance, display_priority, note, created_at, updated_at
    FROM ticket_people
    ${whereSql}
    ORDER BY
      CASE status WHEN 'normal' THEN 1 WHEN 'disabled' THEN 2 ELSE 3 END,
      display_priority DESC,
      name ASC
    LIMIT ? OFFSET ?
  `).bind(...bindings, pageSize, offset).all<PersonRow>();

  return ok({
    items: result.results.map(mapPerson),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  });
}

async function createPerson(request: Request, env: Env, account: SessionAccount) {
  const payload = await readJson<CreatePersonPayload>(request);
  const name = payload?.name?.trim();
  if (!name) return fail("存票人名称不能为空");
  const displayPriority = normalizeDisplayPriority(payload?.displayPriority);
  const now = new Date().toISOString();
  const id = randomId("person");

  try {
    await env.DB.prepare(`
      INSERT INTO ticket_people (id, name, alias, status, cached_balance, display_priority, note, created_at, updated_at)
      VALUES (?, ?, ?, 'normal', 0, ?, ?, ?, ?)
    `).bind(id, name, payload?.alias?.trim() || null, displayPriority, payload?.note?.trim() || null, now, now).run();
  } catch {
    return fail("存票人名称可能已存在，请检查后再保存", 409);
  }

  const afterData = { id, name, alias: payload?.alias || "", status: "normal", balance: 0, displayPriority, note: payload?.note || "" };
  await writeAuditLog(env, account, "新增存票人", "person", id, `新增存票人 ${name}`, undefined, afterData);
  return ok({ person: afterData });
}

export async function handlePersonStatus(request: Request, env: Env, personId: string) {
  const account = await requireAccount(request, env);
  if (!account) return unauthorized();
  if (!requireAdmin(account)) return forbidden("只有管理员可以修改存票人状态");
  if (request.method !== "PATCH") return fail("请求方式不支持", 405);

  const payload = await readJson<StatusPayload>(request);
  if (!payload?.status || !allowedStatuses.has(payload.status)) return fail("新状态不正确");
  const reason = payload.reason?.trim();
  if (!reason) return fail("修改状态必须填写原因");

  const current = await env.DB.prepare(`
    SELECT id, name, alias, status, cached_balance, display_priority, note, created_at, updated_at
    FROM ticket_people
    WHERE id = ?
    LIMIT 1
  `).bind(personId).first<PersonRow>();
  if (!current) return fail("存票人不存在", 404);
  if (current.status === payload.status) return ok({ person: mapPerson(current), changed: false });

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE ticket_people
    SET status = ?, note = ?, updated_at = ?
    WHERE id = ?
  `).bind(payload.status, reason, now, personId).run();

  const next = { ...current, status: payload.status, note: reason, updated_at: now };
  await writeAuditLog(
    env,
    account,
    "修改存票人状态",
    "person",
    personId,
    `${current.name}：${current.status} -> ${payload.status}，原因：${reason}`,
    mapPerson(current),
    mapPerson(next)
  );
  return ok({ person: mapPerson(next), changed: true });
}

export async function handlePersonDetail(request: Request, env: Env, personId: string) {
  const account = await requireAccount(request, env);
  if (!account) return unauthorized();
  if (!requireAdmin(account)) return forbidden("只有管理员可以编辑存票人");
  if (request.method !== "PATCH") return fail("请求方式不支持", 405);

  const payload = await readJson<UpdatePersonPayload>(request);
  const name = payload?.name?.trim();
  if (!name) return fail("存票人名称不能为空");
  const displayPriority = normalizeDisplayPriority(payload?.displayPriority);

  const current = await env.DB.prepare(`
    SELECT id, name, alias, status, cached_balance, display_priority, note, created_at, updated_at
    FROM ticket_people
    WHERE id = ?
    LIMIT 1
  `).bind(personId).first<PersonRow>();
  if (!current) return fail("存票人不存在", 404);

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`
      UPDATE ticket_people
      SET name = ?, alias = ?, display_priority = ?, note = ?, updated_at = ?
      WHERE id = ?
    `).bind(name, payload?.alias?.trim() || null, displayPriority, payload?.note?.trim() || null, now, personId).run();
  } catch {
    return fail("存票人名称可能已存在，请检查后再保存", 409);
  }

  const next = {
    ...current,
    name,
    alias: payload?.alias?.trim() || null,
    display_priority: displayPriority,
    note: payload?.note?.trim() || null,
    updated_at: now
  };
  await writeAuditLog(env, account, "编辑存票人", "person", personId, `编辑存票人 ${current.name}`, mapPerson(current), mapPerson(next));
  return ok({ person: mapPerson(next) });
}

export async function handlePublicBoard(env: Env) {
  const result = await env.DB.prepare(`
    SELECT id, name, cached_balance, display_priority
    FROM ticket_people
    WHERE status = 'normal'
      AND cached_balance > 0
    ORDER BY cached_balance DESC, display_priority DESC, name ASC
    LIMIT 100
  `).all<{ id: string; name: string; cached_balance: number; display_priority: number }>();

  return ok({
    items: result.results.map((person, index) => ({
      rank: index + 1,
      id: person.id,
      name: person.name,
      balance: person.cached_balance
    }))
  });
}
