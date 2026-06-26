import { ok } from "../utils/response";

export function handleHealth() {
  return ok({
    name: "jcc-ticket-lite",
    status: "ok",
    storage: "D1",
    stage: "production-ready-lite"
  });
}
