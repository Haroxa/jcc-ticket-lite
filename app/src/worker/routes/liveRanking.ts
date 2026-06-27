import type { Env, SessionAccount } from "../types";
import { writeAuditLog } from "../services/auditService";
import { getCurrentAccount } from "../services/authService";
import { randomId } from "../utils/crypto";
import { readJson } from "../utils/http";
import { fail, forbidden, ok, unauthorized } from "../utils/response";

type LiveRankStatus = "live" | "countdown" | "frozen" | "pending_settlement" | "settled" | "cancelled";
type EntryRankStatus = "normal" | "pending" | "away";

type SessionRow = {
  id: string;
  title: string;
  status: LiveRankStatus;
  countdown_seconds: number;
  countdown_started_at: string | null;
  countdown_ends_at: string | null;
  started_at: string;
  ended_at: string | null;
  frozen_at: string | null;
  settled_at: string | null;
  note: string | null;
  created_by: string;
  settled_by: string | null;
  created_at: string;
  updated_at: string;
};

type EntryRow = {
  id: string;
  session_id: string;
  person_id: string;
  person_name: string;
  person_status: "normal" | "disabled" | "blocked";
  current_balance: number;
  display_priority: number;
  gift_diamonds: number;
  ticket_used: number;
  ticket_deposit: number;
  rank_status: EntryRankStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type CreateSessionPayload = {
  title?: string;
  note?: string;
};

type UpsertEntryPayload = {
  sessionId?: string;
  personId?: string;
  giftDiamonds?: number;
  ticketUsed?: number;
  ticketDeposit?: number;
  rankStatus?: EntryRankStatus;
  note?: string;
};

type ActionPayload = {
  action?: "startCountdown" | "pauseCountdown" | "resumeCountdown" | "resetCountdown" | "clearEntries" | "freeze" | "end" | "settle" | "cancel";
  countdownSeconds?: number;
};

function canWrite(account: SessionAccount) {
  return account.role === "admin" || account.role === "operator";
}

async function requireWriter(request: Request, env: Env) {
  const account = await getCurrentAccount(request, env);
  if (!account) return null;
  if (!canWrite(account)) return false;
  return account;
}

function mapSession(row: SessionRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    countdownSeconds: row.countdown_seconds,
    countdownStartedAt: row.countdown_started_at || "",
    countdownEndsAt: row.countdown_ends_at || "",
    startedAt: row.started_at,
    endedAt: row.ended_at || "",
    frozenAt: row.frozen_at || "",
    settledAt: row.settled_at || "",
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEntry(row: EntryRow) {
  const score = row.gift_diamonds + row.ticket_used - row.ticket_deposit;
  return {
    id: row.id,
    sessionId: row.session_id,
    personId: row.person_id,
    personName: row.person_name,
    personStatus: row.person_status,
    currentBalance: row.current_balance,
    displayPriority: row.display_priority,
    giftDiamonds: row.gift_diamonds,
    ticketUsed: row.ticket_used,
    ticketDeposit: row.ticket_deposit,
    rankStatus: row.rank_status,
    score,
    projectedBalance: row.current_balance - row.ticket_used + row.ticket_deposit,
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function recalcPersonBalance(env: Env, personId: string) {
  const row = await env.DB.prepare(`
    SELECT COALESCE(SUM(balance_delta), 0) AS balance
    FROM ticket_records
    WHERE person_id = ? AND status = 'normal'
  `).bind(personId).first<{ balance: number }>();
  const balance = row?.balance || 0;
  await env.DB.prepare("UPDATE ticket_people SET cached_balance = ?, updated_at = ? WHERE id = ?")
    .bind(balance, new Date().toISOString(), personId)
    .run();
  return balance;
}

async function getSession(env: Env, sessionId: string) {
  return env.DB.prepare("SELECT * FROM live_rank_sessions WHERE id = ? LIMIT 1")
    .bind(sessionId)
    .first<SessionRow>();
}

async function listSessionEntries(env: Env, sessionId: string) {
  const result = await env.DB.prepare(`
    SELECT
      live_rank_entries.*,
      ticket_people.name AS person_name,
      ticket_people.status AS person_status,
      ticket_people.cached_balance AS current_balance,
      ticket_people.display_priority AS display_priority
    FROM live_rank_entries
    JOIN ticket_people ON ticket_people.id = live_rank_entries.person_id
    WHERE live_rank_entries.session_id = ?
    ORDER BY
      CASE live_rank_entries.rank_status WHEN 'normal' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
      (live_rank_entries.gift_diamonds + live_rank_entries.ticket_used - live_rank_entries.ticket_deposit) DESC,
      ticket_people.display_priority DESC,
      ticket_people.name ASC
  `).bind(sessionId).all<EntryRow>();
  return result.results.map(mapEntry);
}

async function getLatestFreeze(env: Env, sessionId: string) {
  const row = await env.DB.prepare(`
    SELECT snapshot_json, frozen_at
    FROM live_rank_freezes
    WHERE session_id = ?
    ORDER BY frozen_at DESC
    LIMIT 1
  `).bind(sessionId).first<{ snapshot_json: string; frozen_at: string }>();
  if (!row) return null;
  try {
    return { frozenAt: row.frozen_at, entries: JSON.parse(row.snapshot_json) as unknown };
  } catch {
    return { frozenAt: row.frozen_at, entries: [] };
  }
}

export async function handleLiveRankSessions(request: Request, env: Env) {
  const account = await getCurrentAccount(request, env);
  if (!account) return unauthorized();

  if (request.method === "GET") return listSessions(env);
  if (request.method === "POST") {
    if (!canWrite(account)) return forbidden("当前角色不能创建场次排行");
    return createSession(request, env, account);
  }
  return fail("请求方式不支持", 405);
}

async function listSessions(env: Env) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM live_rank_sessions
    ORDER BY
      CASE status
        WHEN 'live' THEN 1
        WHEN 'countdown' THEN 2
        WHEN 'frozen' THEN 3
        WHEN 'pending_settlement' THEN 4
        WHEN 'settled' THEN 5
        ELSE 6
      END,
      created_at DESC
    LIMIT 30
  `).all<SessionRow>();
  return ok({ items: result.results.map(mapSession) });
}

async function createSession(request: Request, env: Env, account: SessionAccount) {
  const payload = await readJson<CreateSessionPayload>(request);
  const title = payload?.title?.trim();
  if (!title) return fail("请输入场次名称");

  const now = new Date().toISOString();
  const id = randomId("rank");
  await env.DB.prepare(`
    INSERT INTO live_rank_sessions (
      id, title, status, started_at, note, created_by, created_at, updated_at
    )
    VALUES (?, ?, 'live', ?, ?, ?, ?, ?)
  `).bind(id, title, now, payload?.note?.trim() || null, account.id, now, now).run();

  await writeAuditLog(env, account, "创建场次排行", "live_rank_session", id, `创建场次排行：${title}`);
  return ok({ session: mapSession({
    id,
    title,
    status: "live",
    countdown_seconds: 180,
    countdown_started_at: null,
    countdown_ends_at: null,
    started_at: now,
    ended_at: null,
    frozen_at: null,
    settled_at: null,
    note: payload?.note?.trim() || null,
    created_by: account.id,
    settled_by: null,
    created_at: now,
    updated_at: now
  }) });
}

export async function handleLiveRankSessionDetail(request: Request, env: Env, sessionId: string) {
  const account = await getCurrentAccount(request, env);
  if (!account) return unauthorized();
  if (request.method !== "GET") return fail("请求方式不支持", 405);

  const session = await getSession(env, sessionId);
  if (!session) return fail("场次不存在", 404);
  const entries = await listSessionEntries(env, sessionId);
  const latestFreeze = await getLatestFreeze(env, sessionId);
  return ok({ session: mapSession(session), entries, latestFreeze });
}

export async function handleLiveRankEntry(request: Request, env: Env) {
  const account = await requireWriter(request, env);
  if (account === null) return unauthorized();
  if (account === false) return forbidden("当前角色不能维护场次排行");
  if (request.method !== "POST") return fail("请求方式不支持", 405);

  const payload = await readJson<UpsertEntryPayload>(request);
  if (!payload?.sessionId || !payload.personId) return fail("请选择场次和存票人");
  const session = await getSession(env, payload.sessionId);
  if (!session) return fail("场次不存在", 404);
  if (session.status === "settled" || session.status === "cancelled") return fail("已结算或已取消的场次不能修改", 409);

  const person = await env.DB.prepare(`
    SELECT id, name, status, cached_balance
    FROM ticket_people
    WHERE id = ?
    LIMIT 1
  `).bind(payload.personId).first<{ id: string; name: string; status: string; cached_balance: number }>();
  if (!person) return fail("存票人不存在", 404);
  if (person.status !== "normal") return fail("当前存票人不是正常状态，不能进入场次排行");

  const giftDiamonds = Number(payload.giftDiamonds ?? 0);
  const ticketUsed = Number(payload.ticketUsed ?? 0);
  const ticketDeposit = Number(payload.ticketDeposit ?? 0);
  const rankStatus = payload.rankStatus === "pending" || payload.rankStatus === "away" ? payload.rankStatus : "normal";
  if (![giftDiamonds, ticketUsed, ticketDeposit].every(Number.isInteger)) return fail("礼物钻、取票和存票必须是整数");
  if (giftDiamonds < 0 || ticketUsed < 0 || ticketDeposit < 0) return fail("礼物钻、取票和存票不能小于 0");
  if (person.cached_balance - ticketUsed + ticketDeposit < 0) return fail(`结算后余额会小于 0，当前余额 ${person.cached_balance}`);

  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT id FROM live_rank_entries WHERE session_id = ? AND person_id = ?")
    .bind(session.id, person.id)
    .first<{ id: string }>();
  if (existing) {
    await env.DB.prepare(`
      UPDATE live_rank_entries
      SET gift_diamonds = ?, ticket_used = ?, ticket_deposit = ?, rank_status = ?, note = ?, updated_at = ?
      WHERE id = ?
    `).bind(giftDiamonds, ticketUsed, ticketDeposit, rankStatus, payload.note?.trim() || null, now, existing.id).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO live_rank_entries (
        id, session_id, person_id, gift_diamonds, ticket_used, ticket_deposit, rank_status, note, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(randomId("rankent"), session.id, person.id, giftDiamonds, ticketUsed, ticketDeposit, rankStatus, payload.note?.trim() || null, now, now).run();
  }

  const score = giftDiamonds + ticketUsed - ticketDeposit;
  await writeAuditLog(
    env,
    account,
    "维护场次排行",
    "live_rank_session",
    session.id,
    `${session.title}：${person.name} 本场总票 ${score}`,
    undefined,
    { personId: person.id, personName: person.name, giftDiamonds, ticketUsed, ticketDeposit, rankStatus, score, projectedBalance: person.cached_balance - ticketUsed + ticketDeposit }
  );
  return ok({ updated: true });
}

export async function handleLiveRankAction(request: Request, env: Env, sessionId: string) {
  const account = await requireWriter(request, env);
  if (account === null) return unauthorized();
  if (account === false) return forbidden("当前角色不能操作场次排行");
  if (request.method !== "POST") return fail("请求方式不支持", 405);

  const session = await getSession(env, sessionId);
  if (!session) return fail("场次不存在", 404);
  const payload = await readJson<ActionPayload>(request);
  const now = new Date().toISOString();

  if (payload?.action === "startCountdown") {
    if (session.status === "settled" || session.status === "cancelled") return fail("已结算或已取消的场次不能开始倒计时", 409);
    const seconds = Math.min(3600, Math.max(10, Number(payload.countdownSeconds || 180)));
    const endsAt = new Date(Date.now() + seconds * 1000).toISOString();
    await env.DB.prepare(`
      UPDATE live_rank_sessions
      SET status = 'countdown', countdown_seconds = ?, countdown_started_at = ?, countdown_ends_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(seconds, now, endsAt, now, session.id).run();
    await writeAuditLog(env, account, "开始场次倒计时", "live_rank_session", session.id, `${session.title} 开始 ${seconds} 秒倒计时`);
    return ok({ updated: true });
  }

  if (payload?.action === "pauseCountdown") {
    if (session.status !== "countdown" || !session.countdown_ends_at) return fail("当前没有正在运行的倒计时", 409);
    const remainingSeconds = Math.max(1, Math.floor((new Date(session.countdown_ends_at).getTime() - Date.now()) / 1000));
    await env.DB.prepare(`
      UPDATE live_rank_sessions
      SET status = 'live', countdown_seconds = ?, countdown_started_at = NULL, countdown_ends_at = NULL, updated_at = ?
      WHERE id = ?
    `).bind(remainingSeconds, now, session.id).run();
    await writeAuditLog(env, account, "暂停场次倒计时", "live_rank_session", session.id, `${session.title} 暂停倒计时，剩余 ${remainingSeconds} 秒`);
    return ok({ updated: true });
  }

  if (payload?.action === "resumeCountdown") {
    if (session.status === "settled" || session.status === "cancelled") return fail("已结算或已取消的场次不能继续倒计时", 409);
    const seconds = Math.min(3600, Math.max(10, Number(session.countdown_seconds || payload.countdownSeconds || 180)));
    const endsAt = new Date(Date.now() + seconds * 1000).toISOString();
    await env.DB.prepare(`
      UPDATE live_rank_sessions
      SET status = 'countdown', countdown_seconds = ?, countdown_started_at = ?, countdown_ends_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(seconds, now, endsAt, now, session.id).run();
    await writeAuditLog(env, account, "继续场次倒计时", "live_rank_session", session.id, `${session.title} 继续 ${seconds} 秒倒计时`);
    return ok({ updated: true });
  }

  if (payload?.action === "resetCountdown") {
    if (session.status === "settled" || session.status === "cancelled") return fail("已结算或已取消的场次不能重置倒计时", 409);
    const seconds = Math.min(3600, Math.max(10, Number(payload.countdownSeconds || session.countdown_seconds || 180)));
    await env.DB.prepare(`
      UPDATE live_rank_sessions
      SET status = 'live', countdown_seconds = ?, countdown_started_at = NULL, countdown_ends_at = NULL, updated_at = ?
      WHERE id = ?
    `).bind(seconds, now, session.id).run();
    await writeAuditLog(env, account, "重置场次倒计时", "live_rank_session", session.id, `${session.title} 重置倒计时为 ${seconds} 秒`);
    return ok({ updated: true });
  }

  if (payload?.action === "clearEntries") {
    if (session.status === "settled" || session.status === "cancelled") return fail("已结算或已取消的窗口不能清空", 409);
    const entries = await listSessionEntries(env, session.id);
    await env.DB.prepare("DELETE FROM live_rank_entries WHERE session_id = ?").bind(session.id).run();
    await env.DB.prepare(`
      UPDATE live_rank_sessions
      SET status = 'live', countdown_started_at = NULL, countdown_ends_at = NULL, frozen_at = NULL, updated_at = ?
      WHERE id = ?
    `).bind(now, session.id).run();
    await writeAuditLog(env, account, "清空结算窗口", "live_rank_session", session.id, `${session.title} 清空 ${entries.length} 条窗口记录`);
    return ok({ updated: true, clearedCount: entries.length });
  }

  if (payload?.action === "freeze") {
    if (session.status === "settled" || session.status === "cancelled") return fail("已结算或已取消的场次不能冻结", 409);
    const entries = await listSessionEntries(env, session.id);
    await env.DB.prepare(`
      INSERT INTO live_rank_freezes (id, session_id, frozen_at, snapshot_json, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(randomId("freeze"), session.id, now, JSON.stringify(entries), account.id, now).run();
    await env.DB.prepare(`
      UPDATE live_rank_sessions
      SET status = 'frozen', frozen_at = ?, countdown_started_at = NULL, countdown_ends_at = NULL, updated_at = ?
      WHERE id = ?
    `).bind(now, now, session.id).run();
    await writeAuditLog(env, account, "冻结场次排行", "live_rank_session", session.id, `${session.title} 冻结排行，共 ${entries.length} 人`);
    return ok({ updated: true });
  }

  if (payload?.action === "end") {
    if (session.status === "settled" || session.status === "cancelled") return fail("已结算或已取消的场次不能结束", 409);
    await env.DB.prepare(`
      UPDATE live_rank_sessions
      SET status = 'pending_settlement', ended_at = COALESCE(ended_at, ?), updated_at = ?
      WHERE id = ?
    `).bind(now, now, session.id).run();
    await writeAuditLog(env, account, "结束场次排行", "live_rank_session", session.id, `${session.title} 进入待结算`);
    return ok({ updated: true });
  }

  if (payload?.action === "cancel") {
    if (session.status === "settled") return fail("已结算场次不能取消", 409);
    await env.DB.prepare("UPDATE live_rank_sessions SET status = 'cancelled', ended_at = COALESCE(ended_at, ?), updated_at = ? WHERE id = ?")
      .bind(now, now, session.id)
      .run();
    await writeAuditLog(env, account, "取消场次排行", "live_rank_session", session.id, `取消场次排行：${session.title}`);
    return ok({ updated: true });
  }

  if (payload?.action === "settle") {
    if (session.status === "settled") return fail("该场次已结算", 409);
    if (session.status === "cancelled") return fail("已取消场次不能结算", 409);
    return settleSession(env, account, session, now);
  }

  return fail("场次操作不正确");
}

async function settleSession(env: Env, account: SessionAccount, session: SessionRow, now: string) {
  const entries = await listSessionEntries(env, session.id);
  for (const entry of entries) {
    if (entry.projectedBalance < 0) return fail(`${entry.personName} 结算后余额小于 0，请先修正取票`);
  }

  const statements = [];
  for (const entry of entries) {
    if (entry.ticketUsed > 0) {
      statements.push(env.DB.prepare(`
        INSERT INTO ticket_records (
          id, person_id, recorded_at, type, amount, balance_delta, status, note, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, 'withdraw', ?, ?, 'normal', ?, ?, ?, ?)
      `).bind(randomId("rec"), entry.personId, now.slice(0, 16), entry.ticketUsed, -entry.ticketUsed, `场次排行结算取票：${session.title}`, account.id, now, now));
    }
    if (entry.ticketDeposit > 0) {
      statements.push(env.DB.prepare(`
        INSERT INTO ticket_records (
          id, person_id, recorded_at, type, amount, balance_delta, status, note, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, 'deposit', ?, ?, 'normal', ?, ?, ?, ?)
      `).bind(randomId("rec"), entry.personId, now.slice(0, 16), entry.ticketDeposit, entry.ticketDeposit, `场次排行结算存票：${session.title}`, account.id, now, now));
    }
  }

  if (statements.length) await env.DB.batch(statements);
  for (const entry of entries) {
    if (entry.ticketUsed > 0 || entry.ticketDeposit > 0) await recalcPersonBalance(env, entry.personId);
  }

  await env.DB.prepare(`
    UPDATE live_rank_sessions
    SET status = 'settled', ended_at = COALESCE(ended_at, ?), settled_at = ?, settled_by = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, now, account.id, now, session.id).run();
  await writeAuditLog(
    env,
    account,
    "结算场次排行",
    "live_rank_session",
    session.id,
    `${session.title} 确认结算，生成 ${statements.length} 条正式流水`,
    undefined,
    { entries, recordCount: statements.length }
  );
  return ok({ recordCount: statements.length });
}
