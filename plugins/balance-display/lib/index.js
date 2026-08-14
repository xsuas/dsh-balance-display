/**
 * DeepSeek API 余额查询宿主插件。
 */
export const name = "balance-display";
export const inject = ["credentials", "webServer"];

const TTL_MS = 10 * 60 * 1000;
const ENDPOINT = "https://api.deepseek.com/user/balance";
const CREDENTIAL_REF = "DEEPSEEK_API_KEY";
const LOOPBACK_ORIGIN = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/;
const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/;

function fail(code, message) {
  return Object.assign(new Error(message), { code });
}

export function apply(ctx) {
  let cache = undefined; // { balanceInfos, fetchedAt }
  let inflight = undefined;

  // 每次请求重新解析凭据
  async function fetchFresh() {
    const resolved = await ctx.credentials.resolve(CREDENTIAL_REF);
    if (resolved === undefined || resolved.value === "") {
      throw fail("no-credential", "未配置 DEEPSEEK_API_KEY");
    }
    const response = await fetch(ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${resolved.value}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw fail("upstream-http", `DeepSeek 余额接口返回 HTTP ${response.status}`);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw fail("bad-response", "余额接口返回非 JSON 内容");
    }
    if (
      typeof body?.is_available !== "boolean" ||
      !Array.isArray(body.balance_infos)
    ) {
      throw fail("bad-response", "余额接口返回格式异常");
    }
    return body.balance_infos;
  }

  // TTL 缓存 + 在途请求合并
  async function getBalance({ force = false } = {}) {
    if (!force && cache !== undefined && Date.now() - cache.fetchedAt < TTL_MS) return cache;
    if (inflight !== undefined) return inflight;
    inflight = (async () => {
      try {
        const balanceInfos = await fetchFresh();
        cache = { balanceInfos, fetchedAt: Date.now() };
        return cache;
      } finally {
        inflight = undefined;
      }
    })();
    return inflight;
  }

  // 插件卸载时自动移除路由
  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: "/api/balance",
    handler: async (req, res) => {
      const origin = req.headers.origin;
      const host = req.headers.host ?? "";
      if ((origin !== undefined && !LOOPBACK_ORIGIN.test(origin)) || !LOOPBACK_HOST.test(host)) {
        res.writeHead(403, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify({
          ok: false,
          error: { code: "forbidden-origin", message: "仅接受回环地址请求" },
        }));
        return;
      }
      const url = new URL(req.url ?? "/", "http://localhost");
      const force = url.searchParams.get("force") === "1";
      try {
        const snapshot = await getBalance({ force });
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify({
          ok: true,
          balanceInfos: snapshot.balanceInfos,
          fetchedAt: snapshot.fetchedAt,
          ttlMs: TTL_MS,
        }));
      } catch (error) {
        res.writeHead(502, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify({
          ok: false,
          error: {
            code: error?.code ?? "unknown",
            message: String(error?.message ?? error),
          },
        }));
      }
    },
  }), "balance-display: /api/balance route");
}
