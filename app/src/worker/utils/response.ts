export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      ...init?.headers
    }
  });
}

export function ok(data: unknown = {}) {
  return json({ ok: true, data });
}

export function fail(message: string, status = 400) {
  return json({ ok: false, message }, { status });
}

export function unauthorized(message = "请先登录") {
  return fail(message, 401);
}

export function forbidden(message = "当前账号无权限") {
  return fail(message, 403);
}

export function notFound(message = "接口不存在") {
  return json({ ok: false, message }, { status: 404 });
}
