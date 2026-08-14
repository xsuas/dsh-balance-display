import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

// 在常见位置寻找已安装的 react（npx 缓存 / 全局 npm / 项目依赖），找不到则整组跳过。
function findReactRoot() {
  const candidates = [];
  const localAppData = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? "", "AppData", "Local");
  const npxRoot = join(localAppData, "npm-cache", "_npx");
  if (existsSync(npxRoot)) {
    for (const entry of readdirSync(npxRoot)) {
      candidates.push(join(npxRoot, entry, "node_modules"));
    }
  }
  if (process.env.APPDATA) candidates.push(join(process.env.APPDATA, "npm", "node_modules"));
  candidates.push(join(new URL("..", import.meta.url).pathname, "node_modules"));
  for (const root of candidates) {
    try {
      const require = createRequire(join(root, "noop.js"));
      require.resolve("react");
      require.resolve("react/jsx-runtime");
      require.resolve("react-dom/server");
      return root;
    } catch {
      // 尝试下一个候选
    }
  }
  return undefined;
}

const reactRoot = findReactRoot();
const it = reactRoot === undefined ? test.skip : test;
const requireAtRoot = reactRoot === undefined ? undefined : createRequire(join(reactRoot, "noop.js"));
const react = requireAtRoot?.("react");
const jsxRuntime = requireAtRoot?.("react/jsx-runtime");

let handoff;
globalThis.window = {
  __ModuleLoader__: {
    load(h) {
      handoff = h;
    },
  },
};

const code = readFileSync(new URL("../plugins/client-balance-display/lib/client.js", import.meta.url), "utf8");
new Function(code)();

it("bundle 注册了正确 id 的工厂", () => {
  assert.ok(handoff !== undefined, "window.__ModuleLoader__.load 被调用");
  assert.equal(handoff.id, "@xsuas/dsh-client-balance-display");
});

const exports = handoff.factory((spec) => {
  if (spec === "react") return react;
  if (spec === "react/jsx-runtime") return jsxRuntime;
  throw new Error(`unexpected require: ${spec}`);
});

it("工厂导出 apply/inject 与余额菜单组件", () => {
  assert.equal(typeof exports.apply, "function");
  assert.deepEqual(exports.inject, ["slots"]);
  assert.equal(typeof exports.BalanceMenu, "function");
  assert.equal(exports.UsageRow, undefined, "旧独立用量行已移除");
  assert.equal(exports.BalanceChip, undefined, "旧芯片组件已被 BalanceMenu 取代");
});

it("apply 只注册 input.left 一个插槽（余额 + 用量同住一个菜单，位于工具行左侧）", () => {
  const registered = [];
  const ctx = {
    slots: {
      inject(key, fn) {
        const entry = fn();
        registered.push({ key, ...entry });
      },
      register(options, component) {
        return { options, component };
      },
    },
  };
  exports.apply(ctx);
  assert.equal(registered.length, 1);
  assert.equal(registered[0].key, "conversation.input.left");
  assert.equal(registered[0].options.id, "balance-display");
  assert.equal(typeof registered[0].component, "function");
});

it("渲染级：BalanceMenu 初始态（菜单关闭）可被 React 实际渲染", () => {
  const { renderToString } = requireAtRoot("react-dom/server");
  const html = renderToString(react.createElement(exports.BalanceMenu, {
    useProjection: () => undefined,
  }));
  assert.ok(html.includes("余额"), `渲染出芯片初始文本: ${html}`);
  assert.ok(!html.includes("token 用量"), "菜单关闭时不渲染菜单内容");
});
