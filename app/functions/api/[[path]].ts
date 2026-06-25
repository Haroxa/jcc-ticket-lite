import worker from "../../src/worker";
import type { Env } from "../../src/worker/types";

export const onRequest: PagesFunction<Env> = (context) => {
  return worker.fetch(context.request, context.env);
};
