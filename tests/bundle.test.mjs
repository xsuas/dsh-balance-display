import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const patch = readFileSync(
  new URL("../cordis.patch.yml", import.meta.url),
  "utf8",
);

test("declares dsh bundle", () => {
  assert.equal(pkg.dsh?.bundle?.patch, "./cordis.patch.yml");
});

test("declares web client", () => {
  assert.equal(pkg.dsh?.client?.platform, "web");
  assert.deepEqual(pkg.dsh?.client?.inject, [
    "@deepseek-ai/dsh-client-ui-slots",
  ]);
});

test("bundle inserts plugin", () => {
  assert.ok(
    patch.includes("name: '@xsuas/dsh-balance-display'"),
  );
});
