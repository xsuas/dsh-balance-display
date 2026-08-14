import test from "node:test";
import assert from "node:assert/strict";
import { apply, name, inject } from "../plugins/balance-display/lib/index.js";

function makeCtx({ resolve = async () => ({ value: "sk-test" }), fetchImpl } = {}) {
  let route;
  const ctx = {
    credentials: { resolve },
    webServer: {
      register(r) {
        route = r;
        return () => {};
      },
    },
    effect(fn) {
      return fn(); // 立即执行注册，返回其 disposer
    },
  };
  if (fetchImpl !== undefined) globalThis.fetch = fetchImpl;
  apply(ctx);
  return { route: () => route, fetchImpl };
}

function makeRes() {
  const res = { status: 0, headers: {}, body: "" };
  res.writeHead = (status, headers) => {
    res.status = status;
    res.headers = headers;
    return res;
  };
  res.end = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function jsonRes(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data };
}

function call(handler, { url = "/api/balance", origin, host = "127.0.0.1:3080" } = {}) {
  const req = { url, headers: { host } };
  if (origin !== undefined) req.headers.origin = origin;
  const res = makeRes();
  return handler(req, res).then(() => ({ status: res.status, body: JSON.parse(res.body) }));
}

test("插件声明形状", () => {
  assert.equal(name, "balance-display");
  assert.deepEqual(inject, ["credentials", "webServer"]);
});

test("成功路径返回余额且不含任何敏感字段", async () => {
  const { route } = makeCtx({
    fetchImpl: async () => jsonRes({
      is_available: true,
      balance_infos: [{ currency: "CNY", total_balance: "78.81", granted_balance: "0.00", topped_up_balance: "78.81" }],
    }),
  });
  const r = await call(route().handler);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.balanceInfos[0].total_balance, "78.81");
  const text = JSON.stringify(r.body);
  assert.ok(!text.includes("sk-test"), "响应体不得包含密钥");
  assert.ok(!text.includes("Authorization"), "响应体不得包含请求头信息");
});

test("密钥缺失 → 502 no-credential", async () => {
  const { route } = makeCtx({ resolve: async () => undefined });
  const r = await call(route().handler);
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, "no-credential");
});

test("上游 500 → 502 upstream-http", async () => {
  const { route } = makeCtx({ fetchImpl: async () => jsonRes({}, { ok: false, status: 500 }) });
  const r = await call(route().handler);
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, "upstream-http");
});

test("余额不可用状态仍是合法响应", async () => {
  const { route } = makeCtx({
    fetchImpl: async () =>
      jsonRes({
        is_available: false,
        balance_infos: [{
          currency: "CNY",
          total_balance: "0.00",
          granted_balance: "0.00",
          topped_up_balance: "0.00",
        }],
      }),
  });
  const r = await call(route().handler);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.balanceInfos[0].total_balance, "0.00");
});

test("响应结构异常 → 502 bad-response", async () => {
  const { route } = makeCtx({
    fetchImpl: async () =>
      jsonRes({
        is_available: true,
      }),
  });
  const r = await call(route().handler);
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, "bad-response");
});

test("is_available 类型异常 → 502 bad-response", async () => {
  const { route } = makeCtx({
    fetchImpl: async () =>
      jsonRes({
        is_available: "true",
        balance_infos: [],
      }),
  });
  const r = await call(route().handler);
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, "bad-response");
});

test("TTL 内命中缓存（fetch 只调一次）", async () => {
  let calls = 0;
  const { route } = makeCtx({
    fetchImpl: async () => {
      calls += 1;
      return jsonRes({ is_available: true, balance_infos: [{ currency: "CNY", total_balance: "1.00", granted_balance: "0.00", topped_up_balance: "1.00" }] });
    },
  });
  await call(route().handler);
  await call(route().handler);
  assert.equal(calls, 1);
});

test("?force=1 绕过缓存（fetch 再次调用）", async () => {
  let calls = 0;
  const { route } = makeCtx({
    fetchImpl: async () => {
      calls += 1;
      return jsonRes({ is_available: true, balance_infos: [{ currency: "CNY", total_balance: "2.00", granted_balance: "0.00", topped_up_balance: "2.00" }] });
    },
  });
  await call(route().handler);
  await call(route().handler, { url: "/api/balance?force=1" });
  assert.equal(calls, 2);
});

test("外部 Origin → 403 forbidden-origin", async () => {
  const { route } = makeCtx();
  const r = await call(route().handler, { origin: "https://evil.example" });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "forbidden-origin");
});

test("外部 Host → 403 forbidden-origin（DNS rebinding 防护）", async () => {
  const { route } = makeCtx();
  const r = await call(route().handler, { host: "attacker.example:3080" });
  assert.equal(r.status, 403);
});

test("回环 localhost Origin/Host 放行", async () => {
  const { route } = makeCtx({
    fetchImpl: async () => jsonRes({ is_available: true, balance_infos: [] }),
  });
  const r = await call(route().handler, { origin: "http://localhost:3080", host: "localhost:3080" });
  assert.equal(r.status, 200);
});
