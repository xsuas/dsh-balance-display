import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const react = require("react");
const jsxRuntime = require("react/jsx-runtime");
const { renderToString } = require("react-dom/server");

let handoff;

globalThis.window = {
  __ModuleLoader__: {
    load(value) {
      handoff = value;
    },
  },
};

const code = readFileSync(
  new URL("../lib/client.js", import.meta.url),
  "utf8",
);

new Function(code)();

test("registers bundle factory", () => {
  assert.ok(handoff);
  assert.equal(
    handoff.id,
    "@xsuas/dsh-balance-display",
  );
});

const exports = handoff.factory((spec) => {
  if (spec === "react") return react;
  if (spec === "react/jsx-runtime") {
    return jsxRuntime;
  }

  throw new Error(
    `unexpected require: ${spec}`,
  );
});

test("exports balance chip", () => {
  assert.equal(
    typeof exports.apply,
    "function",
  );

  assert.deepEqual(
    exports.inject,
    ["slots"],
  );

  assert.equal(
    typeof exports.BalanceChip,
    "function",
  );
});

test("registers balance chip", () => {
  const registered = [];

  const ctx = {
    slots: {
      inject(key, fn) {
        const entry = fn();
        registered.push({
          key,
          ...entry,
        });
      },

      register(options, component) {
        return {
          options,
          component,
        };
      },
    },
  };

  exports.apply(ctx);

  assert.equal(
    registered.length,
    1,
  );

  assert.equal(
    registered[0].key,
    "conversation.input.left",
  );

  assert.equal(
    registered[0].options.id,
    "balance-display",
  );

  assert.equal(
    typeof registered[0].component,
    "function",
  );
});

test("renders balance chip", () => {
  const html = renderToString(
    react.createElement(
      exports.BalanceChip,
    ),
  );

  assert.ok(
    html.includes('role="button"'),
  );
});
