import type { Env, SessionAccount } from "../types";
import { writeAuditLog } from "../services/auditService";
import { getCurrentAccount } from "../services/authService";
import { randomId } from "../utils/crypto";
import { readJson } from "../utils/http";
import { fail, forbidden, ok, unauthorized } from "../utils/response";
import { chinaDateString } from "../utils/time";

type RecordType = "deposit" | "withdraw";
type RecordStatus = "normal" | "voided";

type PersonRow = {
  id: string;
  name: string;
  status: "normal" | "disabled" | "blocked";
  cached_balance: number;
};

type RecordRow = {
  id: string;
  person_id: string;
  person_name: string;
  recorded_at: string;
  type: RecordType;
  amount: number;
  balance_delta: number;
  status: RecordStatus;
  note: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
};

type CreateRecordPayload = {
  personId?: string;
  recordedAt?: string;
  type?: RecordType;
  amount?: number;
  note?: string;
};

type ReasonPayload = {
  reason?: string;
};

function mapRecord(row: RecordRow) {
  return {
    id: row.id,
    personId: row.person_id,
    personName: row.person_name,
    recordedAt: row.recorded_at,
    type: row.type,
    amount: row.amount,
    balanceDelta: row.balance_delta,
    status: row.status,
    note: row.note || "",
    voidReason: row.void_reason || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function canWrite(account: SessionAccount) {
  return account.role === "admin" || account.role === "operator";
}

async function requireAccount(request: Request, env: Env) {
  return getCurrentAccount(request, env);
}

async function recalcPersonBalance(env: Env, personId: string) {
  const row = await env.DB.prepare(`
    SELECT COALESCE(SUM(balance_delta), 0) AS balance
    FROM ticket_records
    WHERE person_id = ?
      AND status = 'normal'
  `).bind(personId).first<{ balance: number }>();
  const balance = row?.balance || 0;
  await env.DB.prepare("UPDATE ticket_people SET cached_balance = ?, updated_at = ? WHERE id = ?")
    .bind(balance, new Date().toISOString(), personId)
    .run();
  return balance;
}

async function getPerson(env: Env, personId: string) {
  return env.DB.prepare(`
    SELECT id, name, status, cached_balance
    FROM ticket_people
    WHERE id = ?
    LIMIT 1
  `).bind(personId).first<PersonRow>();
}

export async function handleRecords(request: Request, env: Env) {
  const account = await requireAccount(request, env);
  if (!account) return unauthorized();
  if (request.method === "GET") return listRecords(request, env);
  if (request.method === "POST") {
    if (!canWrite(account)) return forbidden("当前角色不能新增流水");
    return createRecord(request, env, account);
  }
  return fail("请求方式不支持", 405);
}

async function listRecords(request: Request, env: Env) {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get("keyword") || "").trim();
  const personId = (url.searchParams.get("personId") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const dateFrom = (url.searchParams.get("dateFrom") || "").trim();
  const dateTo = (url.searchParams.get("dateTo") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") || 10)));
  const where: string[] = [];
  const bindings: string[] = [];

  if (keyword) {
    where.push("(ticket_people.name LIKE ? OR ticket_records.note LIKE ?)");
    bindings.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (personId) {
    where.push("ticket_records.person_id = ?");
    bindings.push(personId);
  }
  if (type) {
    if (type !== "deposit" && type !== "withdraw") return fail("流水类型不正确");
    where.push("ticket_records.type = ?");
    bindings.push(type);
  }
  if (status) {
    if (status !== "normal" && status !== "voided") return fail("流水状态不正确");
    where.push("ticket_records.status = ?");
    bindings.push(status);
  }
  if (dateFrom) {
    where.push("substr(ticket_records.recorded_at, 1, 10) >= ?");
    bindings.push(dateFrom);
  }
  if (dateTo) {
    where.push("substr(ticket_records.recorded_at, 1, 10) <= ?");
    bindings.push(dateTo);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM ticket_records
    JOIN ticket_people ON ticket_people.id = ticket_records.person_id
    ${whereSql}
  `).bind(...bindings).first<{ total: number }>();
  const total = totalRow?.total || 0;
  const summaryRow = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN ticket_records.status = 'normal' AND ticket_records.type = 'deposit' THEN ticket_records.amount ELSE 0 END), 0) AS deposit_total,
      COALESCE(SUM(CASE WHEN ticket_records.status = 'normal' AND ticket_records.type = 'withdraw' THEN ticket_records.amount ELSE 0 END), 0) AS withdraw_total,
      COALESCE(SUM(CASE WHEN ticket_records.status = 'normal' THEN ticket_records.balance_delta ELSE 0 END), 0) AS net_total,
      COALESCE(SUM(CASE WHEN ticket_records.status = 'normal' THEN 1 ELSE 0 END), 0) AS normal_count,
      COALESCE(SUM(CASE WHEN ticket_records.status = 'voided' THEN 1 ELSE 0 END), 0) AS voided_count,
      MAX(ticket_records.recorded_at) AS last_recorded_at
    FROM ticket_records
    JOIN ticket_people ON ticket_people.id = ticket_records.person_id
    ${whereSql}
  `).bind(...bindings).first<{
    deposit_total: number;
    withdraw_total: number;
    net_total: number;
    normal_count: number;
    voided_count: number;
    last_recorded_at: string | null;
  }>();
  const offset = (page - 1) * pageSize;
  const result = await env.DB.prepare(`
    SELECT
      ticket_records.id,
      ticket_records.person_id,
      ticket_people.name AS person_name,
      ticket_records.recorded_at,
      ticket_records.type,
      ticket_records.amount,
      ticket_records.balance_delta,
      ticket_records.status,
      ticket_records.note,
      ticket_records.void_reason,
      ticket_records.created_at,
      ticket_records.updated_at
    FROM ticket_records
    JOIN ticket_people ON ticket_people.id = ticket_records.person_id
    ${whereSql}
    ORDER BY ticket_records.recorded_at DESC, ticket_records.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, pageSize, offset).all<RecordRow>();

  return ok({
    items: result.results.map(mapRecord),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary: {
      depositTotal: summaryRow?.deposit_total || 0,
      withdrawTotal: summaryRow?.withdraw_total || 0,
      netTotal: summaryRow?.net_total || 0,
      normalCount: summaryRow?.normal_count || 0,
      voidedCount: summaryRow?.voided_count || 0,
      lastRecordedAt: summaryRow?.last_recorded_at || ""
    }
  });
}

async function createRecord(request: Request, env: Env, account: SessionAccount) {
  const payload = await readJson<CreateRecordPayload>(request);
  if (!payload?.personId) return fail("请选择存票人");
  if (payload.type !== "deposit" && payload.type !== "withdraw") return fail("流水类型不正确");
  const amount = Number(payload.amount);
  if (!Number.isInteger(amount) || amount <= 0) return fail("票数必须是大于 0 的整数");
  const person = await getPerson(env, payload.personId);
  if (!person) return fail("存票人不存在", 404);
  if (person.status !== "normal") return fail("当前存票人不是正常状态，不能录入");
  if (payload.type === "withdraw" && amount > person.cached_balance) {
    return fail(`当前余额 ${person.cached_balance}，不能取用 ${amount}`);
  }

  const now = new Date().toISOString();
  const recordedAt = (payload.recordedAt || now).slice(0, 16);
  const id = randomId("rec");
  const delta = payload.type === "deposit" ? amount : -amount;
  await env.DB.prepare(`
    INSERT INTO ticket_records (
      id, person_id, recorded_at, type, amount, balance_delta, status,
      note, created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'normal', ?, ?, ?, ?)
  `).bind(id, person.id, recordedAt, payload.type, amount, delta, payload.note?.trim() || null, account.id, now, now).run();
  const nextBalance = await recalcPersonBalance(env, person.id);
  const afterData = {
    id,
    personId: person.id,
    personName: person.name,
    recordedAt,
    type: payload.type,
    amount,
    balanceDelta: delta,
    status: "normal",
    note: payload.note?.trim() || "",
    balanceAfter: nextBalance
  };
  await writeAuditLog(
    env,
    account,
    "新增记录",
    "record",
    id,
    `${person.name} ${payload.type === "deposit" ? "存入" : "取用"} ${amount}，余额 ${nextBalance}`,
    undefined,
    afterData
  );
  return ok({ recordId: id, balance: nextBalance });
}

export async function handleVoidRecord(request: Request, env: Env, recordId: string) {
  const account = await requireAccount(request, env);
  if (!account) return unauthorized();
  if (!canWrite(account)) return forbidden("当前角色不能作废流水");
  if (request.method !== "PATCH") return fail("请求方式不支持", 405);
  const payload = await readJson<ReasonPayload>(request);
  const reason = payload?.reason?.trim();
  if (!reason) return fail("作废必须填写原因");

  const record = await env.DB.prepare(`
    SELECT ticket_records.*, ticket_people.name AS person_name
    FROM ticket_records
    JOIN ticket_people ON ticket_people.id = ticket_records.person_id
    WHERE ticket_records.id = ?
    LIMIT 1
  `).bind(recordId).first<RecordRow>();
  if (!record) return fail("流水不存在", 404);
  if (record.status === "voided") return fail("该流水已作废");

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE ticket_records
    SET status = 'voided', void_reason = ?, voided_by = ?, voided_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(reason, account.id, now, now, recordId).run();
  const nextBalance = await recalcPersonBalance(env, record.person_id);
  const nextRecord = mapRecord({
    ...record,
    status: "voided",
    void_reason: reason,
    updated_at: now
  });
  await writeAuditLog(
    env,
    account,
    "作废记录",
    "record",
    recordId,
    `${record.person_name} 作废流水 ${record.amount}，原因：${reason}`,
    mapRecord(record),
    { ...nextRecord, balanceAfter: nextBalance }
  );
  return ok({ balance: nextBalance });
}

export async function handleRestoreRecord(request: Request, env: Env, recordId: string) {
  const account = await requireAccount(request, env);
  if (!account) return unauthorized();
  if (!canWrite(account)) return forbidden("当前角色不能恢复流水");
  if (request.method !== "PATCH") return fail("请求方式不支持", 405);

  const record = await env.DB.prepare(`
    SELECT ticket_records.*, ticket_people.name AS person_name, ticket_people.cached_balance AS current_balance
    FROM ticket_records
    JOIN ticket_people ON ticket_people.id = ticket_records.person_id
    WHERE ticket_records.id = ?
    LIMIT 1
  `).bind(recordId).first<RecordRow & { current_balance: number }>();
  if (!record) return fail("流水不存在", 404);
  if (record.status === "normal") return fail("该流水已经是正常状态");
  if (record.current_balance + record.balance_delta < 0) return fail("恢复后余额会低于 0，不能恢复");

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE ticket_records
    SET status = 'normal', void_reason = NULL, voided_by = NULL, voided_at = NULL, updated_at = ?
    WHERE id = ?
  `).bind(now, recordId).run();
  const nextBalance = await recalcPersonBalance(env, record.person_id);
  const nextRecord = mapRecord({
    ...record,
    status: "normal",
    void_reason: null,
    updated_at: now
  });
  await writeAuditLog(
    env,
    account,
    "恢复记录",
    "record",
    recordId,
    `${record.person_name} 恢复流水 ${record.amount}`,
    mapRecord(record),
    { ...nextRecord, balanceAfter: nextBalance }
  );
  return ok({ balance: nextBalance });
}

export async function handleDashboard(request: Request, env: Env) {
  const account = await requireAccount(request, env);
  if (!account) return unauthorized();
  const today = chinaDateString();
  const totalBalance = await env.DB.prepare("SELECT COALESCE(SUM(cached_balance), 0) AS value FROM ticket_people").first<{ value: number }>();
  const peopleCount = await env.DB.prepare("SELECT COUNT(*) AS value FROM ticket_people").first<{ value: number }>();
  const todayDeposit = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS value FROM ticket_records
    WHERE status = 'normal' AND type = 'deposit' AND substr(recorded_at, 1, 10) = ?
  `).bind(today).first<{ value: number }>();
  const todayWithdraw = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS value FROM ticket_records
    WHERE status = 'normal' AND type = 'withdraw' AND substr(recorded_at, 1, 10) = ?
  `).bind(today).first<{ value: number }>();
  const rank = await env.DB.prepare(`
    SELECT id, name, cached_balance AS balance
    FROM ticket_people
    WHERE status = 'normal' AND cached_balance > 0
    ORDER BY cached_balance DESC, display_priority DESC, name ASC
    LIMIT 10
  `).all<{ id: string; name: string; balance: number }>();
  const recent = await env.DB.prepare(`
    SELECT
      ticket_records.id,
      ticket_records.person_id,
      ticket_people.name AS person_name,
      ticket_records.recorded_at,
      ticket_records.type,
      ticket_records.amount,
      ticket_records.balance_delta,
      ticket_records.status,
      ticket_records.note,
      ticket_records.void_reason,
      ticket_records.created_at,
      ticket_records.updated_at
    FROM ticket_records
    JOIN ticket_people ON ticket_people.id = ticket_records.person_id
    ORDER BY ticket_records.recorded_at DESC, ticket_records.created_at DESC
    LIMIT 5
  `).all<RecordRow>();

  return ok({
    totalBalance: totalBalance?.value || 0,
    peopleCount: peopleCount?.value || 0,
    todayDeposit: todayDeposit?.value || 0,
    todayWithdraw: todayWithdraw?.value || 0,
    rank: rank.results,
    recent: recent.results.map(mapRecord)
  });
}
