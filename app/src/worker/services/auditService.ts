import type { Env, SessionAccount } from "../types";
import { randomId } from "../utils/crypto";

export async function writeAuditLog(
  env: Env,
  actor: SessionAccount,
  action: string,
  targetType: string,
  targetId: string | null,
  summary: string,
  beforeData?: unknown,
  afterData?: unknown
) {
  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_account_id, actor_name, action, target_type, target_id,
      summary, before_json, after_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    randomId("log"),
    actor.id,
    actor.displayName,
    action,
    targetType,
    targetId,
    summary,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    new Date().toISOString()
  ).run();
}
