/**
 * @xsuas/dsh-balance-display — 宿主插件
 *
 * 提供 DeepSeek API 账户余额查询（10 分钟 TTL 缓存 + 并发合并）与同源只读
 * 路由 `/api/balance`。浏览器只拿到余额数值；API 密钥仅在本进程内解析使用，
 * 不落盘、不写日志、不进入任何响应体。
 *
 * 隐私与安全：
 * - 除 `api.deepseek.com` 外不发起任何网络请求，无遥测；
 * - 路由只接受回环 Origin/Host（防跨站请求与 DNS rebinding）；
 * - 错误信息不包含密钥、请求头回显或宿主路径。
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

  /** 逐次解析密钥（凭据变更即时生效，绝不缓存密钥本身）。 */
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
    if (body?.is_available !== true || !Array.isArray(body.balance_infos)) {
      throw fail("bad-response", "余额接口返回格式异常");
    }
    return body.balance_infos;
  }

  /** TTL 缓存 + 在途请求合并；force 绕过缓存（失败时抛错，由调用方决定展示）。 */
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

  ctx.webServer.register({
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
  });
}
