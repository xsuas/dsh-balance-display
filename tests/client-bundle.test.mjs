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

it("工厂导出 apply/inject 与两个组件", () => {
  assert.equal(typeof exports.apply, "function");
  assert.deepEqual(exports.inject, ["slots"]);
  assert.equal(typeof exports.BalanceChip, "function");
  assert.equal(typeof exports.UsageRow, "function");
});

it("apply 注册两个官方插槽（正确的键与 id）", () => {
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
  assert.equal(registered.length, 2);
  const chip = registered.find((r) => r.key === "conversation.input.right");
  const usage = registered.find((r) => r.key === "conversation.composer.dock");
  assert.ok(chip, "注册了 input.right");
  assert.ok(usage, "注册了 composer.dock");
  assert.equal(chip.options.id, "balance-display");
  assert.equal(usage.options.id, "balance-display-usage");
  assert.equal(typeof chip.component, "function");
  assert.equal(typeof usage.component, "function");
});

it("UsageRow 无投影数据时渲染空、有数据时渲染文本", () => {
  const noData = exports.UsageRow({ useProjection: () => undefined });
  assert.equal(noData, null);

  const node = exports.UsageRow({
    useProjection: () => ({ uncachedInputTokens: 1500, outputTokens: 800, cacheReadTokens: 0, cacheWriteTokens: 0 }),
  });
  assert.equal(node.type, "span");
  const text = node.props.title;
  assert.ok(text.includes("输入 1.5k"), `title 含输入计数: ${text}`);
  assert.ok(text.includes("输出 800"), `title 含输出计数: ${text}`);
});

it("UsageRow 全零时不渲染", () => {
  const node = exports.UsageRow({
    useProjection: () => ({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }),
  });
  assert.equal(node, null);
});
