export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export type Account = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "operator" | "viewer";
};

export type ManagedAccount = Account & {
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

export type PersonStatus = "normal" | "disabled" | "blocked";

export type Person = {
  id: string;
  name: string;
  alias: string;
  status: PersonStatus;
  balance: number;
  displayPriority: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type PageData<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type RecordSummary = {
  depositTotal: number;
  withdrawTotal: number;
  netTotal: number;
  normalCount: number;
  voidedCount: number;
  lastRecordedAt: string;
};

export type TicketRecord = {
  id: string;
  personId: string;
  personName: string;
  recordedAt: string;
  type: "deposit" | "withdraw";
  amount: number;
  balanceDelta: number;
  status: "normal" | "voided";
  note: string;
  voidReason: string;
  createdAt: string;
  updatedAt: string;
};

export type LiveRankStatus = "live" | "countdown" | "frozen" | "pending_settlement" | "settled" | "cancelled";
export type LiveRankEntryStatus = "normal" | "pending" | "away";

export type LiveRankSession = {
  id: string;
  title: string;
  status: LiveRankStatus;
  countdownSeconds: number;
  countdownStartedAt: string;
  countdownEndsAt: string;
  startedAt: string;
  endedAt: string;
  frozenAt: string;
  settledAt: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type LiveRankEntry = {
  id: string;
  sessionId: string;
  personId: string;
  personName: string;
  personStatus: PersonStatus;
  currentBalance: number;
  displayPriority: number;
  giftDiamonds: number;
  ticketUsed: number;
  ticketDeposit: number;
  rankStatus: LiveRankEntryStatus;
  score: number;
  projectedBalance: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type LiveRankFreeze = {
  frozenAt: string;
  entries: unknown;
} | null;

export type AuditLog = {
  id: string;
  actorAccountId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      credentials: "include",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...init?.headers
      },
      ...init
    });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return { ok: false, message: "接口没有返回 JSON，请确认打开的是 Worker 地址，而不是纯 Pages 静态地址。" };
    }
    return await response.json<ApiResult<T>>();
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "请求超时，请确认当前地址支持 /api 接口。"
      : "请求失败，请检查网络或后端接口。";
    return { ok: false, message };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getMe() {
  return requestJson<{ account: Account }>("/api/auth/me");
}

export function login(username: string, password: string) {
  return requestJson<{ account: Account }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function logout() {
  return requestJson<Record<string, never>>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function changeMyPassword(payload: { currentPassword: string; newPassword: string }) {
  return requestJson<{ updated: boolean }>("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function listPeople(params: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  return requestJson<PageData<Person>>(`/api/people?${search.toString()}`);
}

export function createPerson(payload: { name: string; alias?: string; displayPriority?: number; note?: string }) {
  return requestJson<{ person: Person }>("/api/people", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePerson(personId: string, payload: { name: string; alias?: string; displayPriority?: number; note?: string }) {
  return requestJson<{ person: Person }>(`/api/people/${personId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function changePersonStatus(personId: string, status: PersonStatus, reason: string) {
  return requestJson<{ person: Person; changed: boolean }>(`/api/people/${personId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason })
  });
}

export function getPublicBoard() {
  return requestJson<{ items: Array<{ rank: number; id: string; name: string; balance: number }> }>("/api/public/board");
}

export function getDashboard() {
  return requestJson<{
    totalBalance: number;
    peopleCount: number;
    todayDeposit: number;
    todayWithdraw: number;
    rank: Array<{ id: string; name: string; balance: number }>;
    recent: TicketRecord[];
  }>("/api/dashboard");
}

export function listLiveRankSessions() {
  return requestJson<{ items: LiveRankSession[] }>("/api/live-rank-sessions");
}

export function createLiveRankSession(payload: { title: string; note?: string }) {
  return requestJson<{ session: LiveRankSession }>("/api/live-rank-sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getLiveRankSession(sessionId: string) {
  return requestJson<{ session: LiveRankSession; entries: LiveRankEntry[]; latestFreeze: LiveRankFreeze }>(`/api/live-rank-sessions/${sessionId}`);
}

export function upsertLiveRankEntry(payload: {
  sessionId: string;
  personId: string;
  giftDiamonds: number;
  ticketUsed: number;
  ticketDeposit: number;
  rankStatus: LiveRankEntryStatus;
  note?: string;
}) {
  return requestJson<{ updated: boolean }>("/api/live-rank-entries", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function liveRankAction(sessionId: string, payload: { action: "startCountdown" | "pauseCountdown" | "resumeCountdown" | "resetCountdown" | "clearEntries" | "freeze" | "end" | "settle" | "cancel"; countdownSeconds?: number }) {
  return requestJson<{ updated?: boolean; recordCount?: number; clearedCount?: number }>(`/api/live-rank-sessions/${sessionId}/action`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listRecords(params: { keyword?: string; personId?: string; type?: string; status?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.personId) search.set("personId", params.personId);
  if (params.type) search.set("type", params.type);
  if (params.status) search.set("status", params.status);
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  return requestJson<PageData<TicketRecord> & { summary: RecordSummary }>(`/api/records?${search.toString()}`);
}

export function listAuditLogs(params: { actor?: string; action?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.actor) search.set("actor", params.actor);
  if (params.action) search.set("action", params.action);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  return requestJson<PageData<AuditLog>>(`/api/audit-logs?${search.toString()}`);
}

export function listAccounts(params: { keyword?: string; role?: string; status?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.role) search.set("role", params.role);
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  return requestJson<PageData<ManagedAccount>>(`/api/accounts?${search.toString()}`);
}

export function createAccount(payload: {
  username: string;
  password: string;
  displayName: string;
  role: Account["role"];
}) {
  return requestJson<{ account: ManagedAccount }>("/api/accounts", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAccount(accountId: string, payload: { displayName: string; role: Account["role"] }) {
  return requestJson<{ account: ManagedAccount }>(`/api/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function changeAccountStatus(accountId: string, status: ManagedAccount["status"], reason: string) {
  return requestJson<{ account: ManagedAccount; changed: boolean }>(`/api/accounts/${accountId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason })
  });
}

export function resetAccountPassword(accountId: string, password: string, reason: string) {
  return requestJson<{ updated: boolean }>(`/api/accounts/${accountId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password, reason })
  });
}

export function createRecord(payload: {
  personId: string;
  recordedAt: string;
  type: "deposit" | "withdraw";
  amount: number;
  note?: string;
}) {
  return requestJson<{ recordId: string; balance: number }>("/api/records", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function voidRecord(recordId: string, reason: string) {
  return requestJson<{ balance: number }>(`/api/records/${recordId}/void`, {
    method: "PATCH",
    body: JSON.stringify({ reason })
  });
}

export function restoreRecord(recordId: string) {
  return requestJson<{ balance: number }>(`/api/records/${recordId}/restore`, {
    method: "PATCH",
    body: JSON.stringify({})
  });
}
