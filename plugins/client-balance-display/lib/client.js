/**
 * @xsuas/dsh-client-balance-display — 浏览器面 bundle
 *
 * 手写产物（无构建步骤），格式与官方 dsh-client-ui-goal 的发布 bundle 一致：
 * window.__ModuleLoader__.load({ id, factory }) 注册懒加载工厂，工厂内仅使用
 * 壳注册的 seed 词（react / react/jsx-runtime），不引入任何包级运行时依赖。
 *
 * 功能：输入框工具行左侧（conversation.input.left，与权限/计划按钮一组）的
 * "余额"芯片，直接显示 DeepSeek API 账户余额；点击手动刷新，10 分钟自动重拉。
 *
 * 会话 token 用量不在此展示：官方统计行（输入卡片下方）原生渲染 tokenUsage
 * 投影（tokens ↑输入 ↓输出），避免重复。
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

    const { jsx } = react_jsx_runtime;
    const { useState, useEffect, useCallback } = react;

    const REFRESH_MS = 10 * 60 * 1000;
    const CURRENCY_SYMBOL = { CNY: "\u00a5", USD: "$", EUR: "\u20ac", GBP: "\u00a3" };

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

    function balanceDetail(infos) {
      return (infos ?? [])
        .map((b) => `${b.currency}: 总余额 ${b.total_balance}（充值 ${b.topped_up_balance} + 赠金 ${b.granted_balance}）`)
        .join("\n");
    }

    // 与官方模型选择控件（28px 高 / 13px 字）保持同一行高与字号
    const chipStyle = {
      display: "inline-flex",
      alignItems: "center",
      height: "28px",
      padding: "0 8px",
      borderRadius: "8px",
      fontSize: "13px",
      lineHeight: "20px",
      whiteSpace: "nowrap",
      cursor: "pointer",
      userSelect: "none",
      border: "1px solid transparent",
      flex: "none",
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
      if (state.fetchedAt !== null) {
        title = `更新于 ${clock(state.fetchedAt)}\n${balanceDetail(state.balanceInfos)}`;
      }
      if (state.error !== null) title += `\n${state.error}`;

      let body;
      if (state.phase === "loading") body = "余额…";
      else if (state.phase === "error") body = "余额不可用";
      else body = balanceLabel(state.balanceInfos);

      return jsx(
        "span",
        {
          role: "button",
          tabIndex: 0,
          title,
          style: {
            ...chipStyle,
            color: state.phase === "error" ? "#8b93a1" : "#c9d1d9",
            opacity: state.phase === "stale" ? 0.55 : 1,
            // 工具行默认组间距 16px，负外边距拉近到 8px，与权限/计划按钮更紧凑
            marginLeft: "-8px",
          },
          onClick: () => void refresh(true),
          onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void refresh(true);
            }
          },
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

    const inject = ["slots"];

    function apply(ctx) {
      ctx.slots.inject("conversation.input.left", () =>
        ctx.slots.register(
          {
            name: "conversation.input.left",
            id: "balance-display",
            order: 20,
          },
          BalanceChip,
        ),
      );
    }

    exports.BalanceChip = BalanceChip;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
