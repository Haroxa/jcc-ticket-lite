export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_NAME: string;
  ADMIN_INIT_TOKEN?: string;
  SESSION_SECRET?: string;
}

export type AccountRole = "admin" | "operator" | "viewer";

export type Account = {
  id: string;
  username: string;
  display_name: string;
  role: AccountRole;
  status: "active" | "disabled";
};

export type SessionAccount = {
  id: string;
  username: string;
  displayName: string;
  role: AccountRole;
};
