import { handleHealth } from "./routes/health";
import { handleChangeMyPassword, handleLogin, handleLogout, handleMe, handleSetupAdmin } from "./routes/auth";
import { handlePeople, handlePersonDetail, handlePersonStatus, handlePublicBoard } from "./routes/people";
import { handleDashboard, handleRecords, handleRestoreRecord, handleVoidRecord } from "./routes/records";
import { handleAuditLogs } from "./routes/auditLogs";
import { handleAccountDetail, handleAccountPassword, handleAccounts, handleAccountStatus } from "./routes/accounts";
import type { Env } from "./types";
import { notFound } from "./utils/response";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return handleHealth();
    }

    if (url.pathname === "/api/setup/admin") {
      return handleSetupAdmin(request, env);
    }

    if (url.pathname === "/api/auth/login") {
      return handleLogin(request, env);
    }

    if (url.pathname === "/api/auth/logout") {
      return handleLogout(request, env);
    }

    if (url.pathname === "/api/auth/me") {
      return handleMe(request, env);
    }

    if (url.pathname === "/api/auth/password") {
      return handleChangeMyPassword(request, env);
    }

    if (url.pathname === "/api/people") {
      return handlePeople(request, env);
    }

    if (url.pathname === "/api/dashboard") {
      return handleDashboard(request, env);
    }

    if (url.pathname === "/api/records") {
      return handleRecords(request, env);
    }

    if (url.pathname === "/api/audit-logs") {
      return handleAuditLogs(request, env);
    }

    if (url.pathname === "/api/accounts") {
      return handleAccounts(request, env);
    }

    const voidRecordMatch = url.pathname.match(/^\/api\/records\/([^/]+)\/void$/);
    if (voidRecordMatch) {
      return handleVoidRecord(request, env, voidRecordMatch[1]);
    }

    const restoreRecordMatch = url.pathname.match(/^\/api\/records\/([^/]+)\/restore$/);
    if (restoreRecordMatch) {
      return handleRestoreRecord(request, env, restoreRecordMatch[1]);
    }

    const personStatusMatch = url.pathname.match(/^\/api\/people\/([^/]+)\/status$/);
    if (personStatusMatch) {
      return handlePersonStatus(request, env, personStatusMatch[1]);
    }

    const personDetailMatch = url.pathname.match(/^\/api\/people\/([^/]+)$/);
    if (personDetailMatch) {
      return handlePersonDetail(request, env, personDetailMatch[1]);
    }

    const accountStatusMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)\/status$/);
    if (accountStatusMatch) {
      return handleAccountStatus(request, env, accountStatusMatch[1]);
    }

    const accountPasswordMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)\/password$/);
    if (accountPasswordMatch) {
      return handleAccountPassword(request, env, accountPasswordMatch[1]);
    }

    const accountDetailMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)$/);
    if (accountDetailMatch) {
      return handleAccountDetail(request, env, accountDetailMatch[1]);
    }

    if (url.pathname === "/api/public/board") {
      return handlePublicBoard(env);
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound();
    }

    if (url.pathname === "/public-board") {
      const indexUrl = new URL("/", request.url);
      return env.ASSETS.fetch(new Request(indexUrl, request));
    }

    return env.ASSETS.fetch(request);
  }
};
