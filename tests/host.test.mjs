import test from "node:test";
import assert from "node:assert/strict";
import { apply, name, inject } from "../lib/index.js";

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
      return fn(); // run registration immediately, return its disposer
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

test("declares plugin contract", () => {
  assert.equal(name, "balance-display");
  assert.deepEqual(inject, ["credentials", "webServer"]);
});

test("returns balance without secrets", async () => {
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
  assert.ok(!text.includes("sk-test"), "response must not contain the key");
  assert.ok(!text.includes("Authorization"), "response must not contain auth headers");
});

test("missing credential returns 502", async () => {
  const { route } = makeCtx({ resolve: async () => undefined });
  const r = await call(route().handler);
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, "no-credential");
});

test("upstream error returns 502", async () => {
  const { route } = makeCtx({ fetchImpl: async () => jsonRes({}, { ok: false, status: 500 }) });
  const r = await call(route().handler);
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, "upstream-http");
});

test("network failure returns 502", async () => {
  const { route } = makeCtx({
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  const r = await call(route().handler);
  assert.equal(r.status, 502);
  assert.equal(r.body.error.code, "upstream-network");
});

test("timeout returns 502", async () => {
  const originalTimeout = AbortSignal.timeout;
  AbortSignal.timeout = () =>
    AbortSignal.abort(new DOMException("Timed out", "TimeoutError"));
  try {
    const { route } = makeCtx({
      fetchImpl: async (_url, options) => {
        throw options.signal.reason;
      },
    });
    const r = await call(route().handler);
    assert.equal(r.status, 502);
    assert.equal(r.body.error.code, "upstream-timeout");
  } finally {
    AbortSignal.timeout = originalTimeout;
  }
});

test("unavailable balance is valid", async () => {
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

test("missing balance_infos returns 502", async () => {
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

test("invalid is_available type returns 502", async () => {
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

test("caches within TTL", async () => {
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

test("force bypasses cache", async () => {
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

test("rejects foreign origin", async () => {
  const { route } = makeCtx();
  const r = await call(route().handler, { origin: "https://evil.example" });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, "forbidden-origin");
});

test("rejects foreign host", async () => {
  const { route } = makeCtx();
  const r = await call(route().handler, { host: "attacker.example:3080" });
  assert.equal(r.status, 403);
});

test("allows loopback origin and host", async () => {
  const { route } = makeCtx({
    fetchImpl: async () => jsonRes({ is_available: true, balance_infos: [] }),
  });
  const r = await call(route().handler, { origin: "http://localhost:3080", host: "localhost:3080" });
  assert.equal(r.status, 200);
});
