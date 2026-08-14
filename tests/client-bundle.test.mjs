import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const npxRequire = createRequire("C:/Users/Administrator/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules/");
const react = npxRequire("react");
const jsxRuntime = npxRequire("react/jsx-runtime");

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

test("bundle 注册了正确 id 的工厂", () => {
  assert.ok(handoff !== undefined, "window.__ModuleLoader__.load 被调用");
  assert.equal(handoff.id, "@xsuas/dsh-client-balance-display");
});

const exports = handoff.factory((spec) => {
  if (spec === "react") return react;
  if (spec === "react/jsx-runtime") return jsxRuntime;
  throw new Error(`unexpected require: ${spec}`);
});

test("工厂导出 apply/inject 与两个组件", () => {
  assert.equal(typeof exports.apply, "function");
  assert.deepEqual(exports.inject, ["slots"]);
  assert.equal(typeof exports.BalanceChip, "function");
  assert.equal(typeof exports.UsageRow, "function");
});

test("apply 注册两个官方插槽（正确的键与 id）", () => {
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

test("UsageRow 无投影数据时渲染空、有数据时渲染文本", () => {
  const jsx = jsxRuntime.jsx;
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

test("UsageRow 全零时不渲染", () => {
  const node = exports.UsageRow({
    useProjection: () => ({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }),
  });
  assert.equal(node, null);
});
