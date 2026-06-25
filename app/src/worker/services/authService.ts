import type { Account, Env, SessionAccount } from "../types";
import { getCookie } from "../utils/http";
import { sha256 } from "../utils/crypto";

const sessionDays = 7;
export const sessionMaxAgeSeconds = sessionDays * 24 * 60 * 60;

export function toSessionAccount(account: Account): SessionAccount {
  return {
    id: account.id,
    username: account.username,
    displayName: account.display_name,
    role: account.role
  };
}

export async function getCurrentAccount(request: Request, env: Env) {
  const token = getCookie(request, "jcc_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const row = await env.DB.prepare(`
    SELECT
      accounts.id,
      accounts.username,
      accounts.display_name,
      accounts.role,
      accounts.status
    FROM sessions
    JOIN accounts ON accounts.id = sessions.account_id
    WHERE sessions.token_hash = ?
      AND sessions.revoked_at IS NULL
      AND sessions.expires_at > ?
      AND accounts.status = 'active'
    LIMIT 1
  `).bind(tokenHash, now).first<Account>();
  return row ? toSessionAccount(row) : null;
}
