import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("MIT license file is present", () => {
  const text = readFileSync(join(root, "LICENSE"), "utf8");
  assert.match(text, /MIT License/);
});

test("third-party notice file and license folder exist", () => {
  assert.ok(existsSync(join(root, "THIRD_PARTY_NOTICES.md")));
  assert.ok(existsSync(join(root, "third_party", "licenses")));
});

test("package declares Node 20+ and MIT", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.engines.node, ">=20");
});

test("entry module loads", async () => {
  const mod = await import("../src/index.mjs");
  assert.equal(mod.name, "stashpad");
});

test("ARCHITECTURE.md names every module in src/, the eight MCP tools and the store files the code writes", () => {
  const doc = readFileSync(join(root, "docs", "ARCHITECTURE.md"), "utf8");
  const modules = readdirSync(join(root, "src")).filter((name) => name.endsWith(".mjs"));
  assert.ok(modules.length > 0, "no modules found in src/");
  for (const name of modules) {
    assert.ok(doc.includes(`\`${name}\``), `${name} is not named in docs/ARCHITECTURE.md`);
  }
  assert.match(doc, /mcp\.mjs \(8 tools/);
  for (const entry of ["handoffs/", "feedback.jsonl", "misses.jsonl", "pins.json"]) {
    assert.ok(doc.includes(entry), `${entry} is not listed in the store folder in docs/ARCHITECTURE.md`);
  }
});
