/**
 * @xsuas/dsh-client-balance-display — 浏览器面 bundle
 *
 * 手写产物（无构建步骤），格式与官方 dsh-client-ui-goal 的发布 bundle 一致：
 * window.__ModuleLoader__.load({ id, factory }) 注册懒加载工厂，工厂内仅使用
 * 壳注册的 seed 词（react / react/jsx-runtime），不引入任何包级运行时依赖。
 *
 * 功能：输入框工具行左侧（conversation.input.left，与权限/计划按钮一组）的
 * "余额"芯片，点击弹出与官方模型菜单同款风格的菜单（向上弹出、向左锚定），
 * 内含两行：
 *   1. 余额：DeepSeek API 账户余额（点击该行手动刷新，10 分钟自动重拉）；
 *   2. 会话 token 用量：读官方 tokenUsage 会话投影（↑输入 ↓输出）。
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
    const { useState, useEffect, useCallback, useRef } = react;

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
      gap: "4px",
    };

    // 与官方模型菜单同款视觉；位于工具行左侧时向左锚定、向右展开，避免溢出卡片
    const menuStyle = {
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: "0",
      zIndex: 20,
      width: "min(240px, 100vw - 32px)",
      border: "1px solid var(--dsw-alias-border-inverted, #30363d)",
      background: "var(--dsw-specific-menu, #161b22)",
      boxShadow: "var(--dsw-shadow-lv3, 0 8px 24px #010409)",
      color: "var(--dsw-alias-label-primary, #e6edf3)",
      borderRadius: "12px",
      flexDirection: "column",
      padding: "4px",
      display: "flex",
      overflow: "hidden",
    };

    const rowStyle = {
      width: "100%",
      minHeight: "40px",
      color: "inherit",
      textAlign: "left",
      cursor: "default",
      background: "0 0",
      border: "none",
      borderRadius: "10px",
      alignItems: "center",
      gap: "8px",
      padding: "0 10px",
      fontSize: "14px",
      lineHeight: "22px",
      display: "flex",
      outline: "none",
    };

    function BalanceMenu(props) {
      const [open, setOpen] = useState(false);
      const [state, setState] = useState({
        phase: "loading", // loading | ready | stale | error
        balanceInfos: null,
        error: null,
        fetchedAt: null,
      });
      const rootRef = useRef(null);

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

      // 打开菜单时若数据已过期则顺手刷新；点外部/Escape 关闭
      useEffect(() => {
        if (!open) return;
        if (state.fetchedAt === null || Date.now() - state.fetchedAt >= REFRESH_MS) {
          void refresh(false);
        }
        const onDocDown = (event) => {
          if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
        };
        const onKey = (event) => {
          if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocDown);
        document.addEventListener("keydown", onKey);
        return () => {
          document.removeEventListener("mousedown", onDocDown);
          document.removeEventListener("keydown", onKey);
        };
      }, [open, state.fetchedAt, refresh]);

      const usage = props.useProjection("tokenUsage");
      const inputTokens = usage == null ? null
        : Number(usage.uncachedInputTokens ?? 0) + Number(usage.cacheReadTokens ?? 0) + Number(usage.cacheWriteTokens ?? 0);
      const outputTokens = usage == null ? null : Number(usage.outputTokens ?? 0);
      const usageText = usage == null ? "\u2014"
        : `\u2191${compact(inputTokens)} \u2193${compact(outputTokens)}`;
      const usageTitle = usage == null ? "本会话暂无 token 用量"
        : `输入 ${compact(inputTokens)}（未缓存 ${compact(Number(usage.uncachedInputTokens ?? 0))} + 缓存读 ${compact(Number(usage.cacheReadTokens ?? 0))} + 缓存写 ${compact(Number(usage.cacheWriteTokens ?? 0))}）\n输出 ${compact(outputTokens)}`;

      let chipTitle = "余额与用量";
      if (state.fetchedAt !== null) chipTitle += `\u00b7 更新于 ${clock(state.fetchedAt)}`;
      if (state.error !== null) chipTitle += `\n${state.error}`;

      let chipBody;
      if (state.phase === "loading") chipBody = "余额…";
      else if (state.phase === "error") chipBody = "余额不可用";
      else chipBody = balanceLabel(state.balanceInfos);

      let balanceRowTitle = "点击刷新";
      if (state.fetchedAt !== null) {
        balanceRowTitle = `更新于 ${clock(state.fetchedAt)}\n${balanceDetail(state.balanceInfos)}`;
      }
      if (state.error !== null) balanceRowTitle += `\n${state.error}`;

      const balanceRowText = state.phase === "error" ? "不可用"
        : state.phase === "loading" ? "\u2026" : balanceLabel(state.balanceInfos);

      return jsx(
        "span",
        {
          ref: rootRef,
          // 工具行默认组间距 16px，负外边距拉近到 8px，与权限/计划按钮更紧凑
          style: { position: "relative", display: "inline-flex", flex: "none", marginLeft: "-8px" },
          children: [
            jsxs(
              "span",
              {
                role: "button",
                tabIndex: 0,
                "aria-haspopup": "menu",
                "aria-expanded": open,
                title: chipTitle,
                style: {
                  ...chipStyle,
                  color: state.phase === "error" ? "#8b93a1" : "#c9d1d9",
                  opacity: state.phase === "stale" ? 0.55 : 1,
                },
                onClick: () => setOpen((v) => !v),
                onKeyDown: (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpen((v) => !v);
                  }
                },
                onMouseEnter: (event) => {
                  event.currentTarget.style.borderColor = "#3d444d";
                },
                onMouseLeave: (event) => {
                  event.currentTarget.style.borderColor = "transparent";
                },
                children: [
                  chipBody,
                  jsx(
                    "span",
                    {
                      style: {
                        display: "inline-block",
                        transition: "transform .12s",
                        transform: open ? "rotate(180deg)" : "none",
                        color: "var(--dsw-alias-label-caption, #8b93a1)",
                      },
                      children: "\u25be",
                    },
                    undefined,
                  ),
                ],
              },
              undefined,
            ),
            open && jsx(
              "div",
              {
                role: "menu",
                style: menuStyle,
                children: [
                  jsxs(
                    "button",
                    {
                      type: "button",
                      role: "menuitem",
                      title: balanceRowTitle,
                      style: { ...rowStyle, cursor: "pointer" },
                      onClick: () => void refresh(true),
                      onMouseEnter: (event) => {
                        event.currentTarget.style.background = "var(--dsw-alias-interactive-bg-hover, #1f242b)";
                      },
                      onMouseLeave: (event) => {
                        event.currentTarget.style.background = "0 0";
                      },
                      children: [
                        jsx("span", { style: { flex: "auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: "余额" }, undefined),
                        jsx("span", {
                          style: {
                            flex: "0 auto",
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: state.phase === "error" ? "var(--dsw-alias-label-tertiary, #8b93a1)" : "inherit",
                          },
                          children: balanceRowText,
                        }, undefined),
                      ],
                    },
                    undefined,
                  ),
                  jsxs(
                    "div",
                    {
                      role: "menuitem",
                      title: usageTitle,
                      style: rowStyle,
                      children: [
                        jsx("span", { style: { flex: "auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: "token 用量" }, undefined),
                        jsx("span", {
                          style: { flex: "0 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dsw-alias-label-tertiary, #8b93a1)" },
                          children: usageText,
                        }, undefined),
                      ],
                    },
                    undefined,
                  ),
                ],
              },
              undefined,
            ),
          ],
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
          BalanceMenu,
        ),
      );
    }

    exports.BalanceMenu = BalanceMenu;
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
