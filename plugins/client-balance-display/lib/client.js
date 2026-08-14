/**
 * @xsuas/dsh-client-balance-display — 浏览器面 bundle
 *
 * 手写产物（无构建步骤），格式与官方 dsh-client-ui-goal 的发布 bundle 一致：
 * window.__ModuleLoader__.load({ id, factory }) 注册懒加载工厂，工厂内仅使用
 * 壳注册的 seed 词（react / react/jsx-runtime），不引入任何包级运行时依赖。
 *
 * 功能：
 * 1. 余额芯片 → 官方插槽 conversation.input.right（输入框工具行内、发送按钮前）：
 *    显示 DeepSeek API 账户余额，点击手动刷新，10 分钟自动重拉。
 * 2. 用量行 → 官方插槽 conversation.composer.dock（卡片下方统计行）：
 *    读官方 tokenUsage 会话投影，显示本会话累计输入/输出 token。
 *
 * 隐私：仅请求同源 /api/balance 并缓存余额数值；不读取、不接触任何凭据。
 */
window.__ModuleLoader__.load({
  id: "@xsuas/dsh-client-balance-display",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react_jsx_runtime = require("react/jsx-runtime");
    let react = require("react");

    const { jsx, jsxs } = react_jsx_runtime;
    const { useState, useEffect, useCallback } = react;

    const REFRESH_MS = 10 * 60 * 1000;
    const CURRENCY_SYMBOL = { CNY: "\u00a5", USD: "$", EUR: "\u20ac", GBP: "\u00a3" };

    function compact(n) {
      if (n < 1000) return String(n);
      if (n < 1e6) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
      return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    }

    function clock(ts) {
      const d = new Date(ts);
      const pad = (v) => String(v).padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function balanceLabel(infos) {
      return (infos ?? [])
        .map((b) => `${CURRENCY_SYMBOL[b.currency] ?? b.currency + " "}${b.total_balance}`)
        .join("  ");
    }

    const chipBase = {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      height: "20px",
      padding: "0 6px",
      borderRadius: "6px",
      fontSize: "11px",
      lineHeight: "20px",
      whiteSpace: "nowrap",
      cursor: "pointer",
      userSelect: "none",
      border: "1px solid transparent",
    };

    function BalanceChip() {
      const [state, setState] = useState({
        phase: "loading", // loading | ready | stale | error
        balanceInfos: null,
        error: null,
        fetchedAt: null,
      });

      const refresh = useCallback(async (force) => {
        try {
          const response = await fetch(`/api/balance${force ? "?force=1" : ""}`, {
            credentials: "omit",
          });
          const body = await response.json();
          if (!response.ok || body?.ok !== true) {
            throw new Error(body?.error?.message ?? `HTTP ${response.status}`);
          }
          setState({
            phase: "ready",
            balanceInfos: body.balanceInfos,
            error: null,
            fetchedAt: body.fetchedAt,
          });
        } catch (error) {
          setState((prev) => ({
            phase: prev.balanceInfos !== null ? "stale" : "error",
            balanceInfos: prev.balanceInfos,
            error: String(error?.message ?? error),
            fetchedAt: prev.fetchedAt,
          }));
        }
      }, []);

      useEffect(() => {
        void refresh(false);
        const timer = setInterval(() => void refresh(false), REFRESH_MS);
        return () => clearInterval(timer);
      }, [refresh]);

      let title = "点击刷新余额";
      if (state.fetchedAt !== null) title += `\u00b7 更新于 ${clock(state.fetchedAt)}`;
      if (state.error !== null) title += `\n${state.error}`;

      let body;
      if (state.phase === "loading") body = "余额…";
      else if (state.phase === "error") body = "余额不可用";
      else body = balanceLabel(state.balanceInfos);

      return jsx(
        "span",
        {
          title,
          style: {
            ...chipBase,
            color: state.phase === "error" ? "#8b93a1" : "#c9d1d9",
            opacity: state.phase === "stale" ? 0.55 : 1,
          },
          onClick: () => void refresh(true),
          onMouseEnter: (event) => {
            event.currentTarget.style.borderColor = "#3d444d";
          },
          onMouseLeave: (event) => {
            event.currentTarget.style.borderColor = "transparent";
          },
          children: body,
        },
        undefined,
      );
    }

    function UsageRow(props) {
      const usage = props.useProjection("tokenUsage");
      if (usage == null) return null;
      const input = Number(usage.uncachedInputTokens ?? 0) + Number(usage.cacheReadTokens ?? 0) + Number(usage.cacheWriteTokens ?? 0);
      const output = Number(usage.outputTokens ?? 0);
      if (input === 0 && output === 0) return null;

      const title = [
        `输入 ${compact(input)}（未缓存 ${compact(Number(usage.uncachedInputTokens ?? 0))} + 缓存读 ${compact(Number(usage.cacheReadTokens ?? 0))} + 缓存写 ${compact(Number(usage.cacheWriteTokens ?? 0))}）`,
        `输出 ${compact(output)}`,
      ].join("\n");

      return jsxs(
        "span",
        {
          title,
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
            color: "#8b93a1",
            whiteSpace: "nowrap",
          },
          children: [
            jsx("span", { children: `会话 token \u2191${compact(input)} \u2193${compact(output)}` }, undefined),
          ],
        },
        undefined,
      );
    }

    const inject = ["slots"];

    function apply(ctx) {
      ctx.slots.inject("conversation.input.right", () =>
        ctx.slots.register(
          {
            name: "conversation.input.right",
            id: "balance-display",
            order: 20,
          },
          BalanceChip,
        ),
      );
      ctx.slots.inject("conversation.composer.dock", () =>
        ctx.slots.register(
          {
            name: "conversation.composer.dock",
            id: "balance-display-usage",
            order: 20,
          },
          UsageRow,
        ),
      );
    }

    exports.BalanceChip = BalanceChip;
    exports.UsageRow = UsageRow;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
