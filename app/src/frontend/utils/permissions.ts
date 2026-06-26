import type { Account } from "../api";

export function canWrite(account: Account) {
  return account.role === "admin" || account.role === "operator";
}

export function canAdmin(account: Account) {
  return account.role === "admin";
}

export function canAudit(account: Account) {
  return account.role === "admin" || account.role === "operator";
}
