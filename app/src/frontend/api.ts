export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export type Account = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "operator" | "viewer";
};

export type PersonStatus = "normal" | "disabled" | "blocked";

export type Person = {
  id: string;
  name: string;
  alias: string;
  status: PersonStatus;
  balance: number;
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

export type AuditLog = {
  id: string;
  actorAccountId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  createdAt: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init?.headers
    },
    ...init
  });
  const data = await response.json<ApiResult<T>>();
  return data;
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

export function listPeople(params: { keyword?: string; status?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  return requestJson<PageData<Person>>(`/api/people?${search.toString()}`);
}

export function createPerson(payload: { name: string; alias?: string; note?: string }) {
  return requestJson<{ person: Person }>("/api/people", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updatePerson(personId: string, payload: { name: string; alias?: string; note?: string }) {
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

export function listRecords(params: { keyword?: string; personId?: string; type?: string; status?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.keyword) search.set("keyword", params.keyword);
  if (params.personId) search.set("personId", params.personId);
  if (params.type) search.set("type", params.type);
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  return requestJson<PageData<TicketRecord>>(`/api/records?${search.toString()}`);
}

export function listAuditLogs(params: { actor?: string; action?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.actor) search.set("actor", params.actor);
  if (params.action) search.set("action", params.action);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  return requestJson<PageData<AuditLog>>(`/api/audit-logs?${search.toString()}`);
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
