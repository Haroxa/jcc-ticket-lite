import type { Env } from "../types";
import { getCurrentAccount } from "../services/authService";
import { fail, forbidden, ok, unauthorized } from "../utils/response";

type AuditLogRow = {
  id: string;
  actor_account_id: string | null;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  summary: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
};

function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function mapLog(row: AuditLogRow) {
  return {
    id: row.id,
    actorAccountId: row.actor_account_id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    summary: row.summary,
    beforeData: parseJson(row.before_json),
    afterData: parseJson(row.after_json),
    createdAt: row.created_at
  };
}

export async function handleAuditLogs(request: Request, env: Env) {
  const account = await getCurrentAccount(request, env);
  if (!account) return unauthorized();
  if (account.role === "viewer") return forbidden("只读成员不能查看操作日志");
  if (request.method !== "GET") return fail("请求方式不支持", 405);

  const url = new URL(request.url);
  const actor = (url.searchParams.get("actor") || "").trim();
  const action = (url.searchParams.get("action") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get("pageSize") || 10)));
  const where: string[] = [];
  const bindings: string[] = [];

  if (account.role !== "admin") {
    where.push("actor_account_id = ?");
    bindings.push(account.id);
  }
  if (actor) {
    where.push("actor_name LIKE ?");
    bindings.push(`%${actor}%`);
  }
  if (action) {
    where.push("action = ?");
    bindings.push(action);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const total = totalRow?.total || 0;
  const offset = (page - 1) * pageSize;
  const result = await env.DB.prepare(`
    SELECT id, actor_account_id, actor_name, action, target_type, target_id, summary, before_json, after_json, created_at
    FROM audit_logs
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...bindings, pageSize, offset).all<AuditLogRow>();

  return ok({
    items: result.results.map(mapLog),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  });
}
