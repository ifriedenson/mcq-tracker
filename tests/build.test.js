"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { build } = require("../scripts/build");

test("main.js is the up-to-date build of src/ (run `npm run build` if this fails)", () => {
  const built = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  assert.equal(built, build());
});

test("build output orders non-entry modules deterministically", () => {
  const modules = [...build().matchAll(/__defs\["([^"]+)"\] = function/g)].map((m) => m[1]);
  const nonEntry = modules.slice(0, -1);
  assert.equal(modules.at(-1), "main");
  assert.deepEqual(nonEntry, [...nonEntry].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
});

test("every module in src/ is reachable from the entry, and none requires a missing module", () => {
  const dir = path.join(__dirname, "..", "src");
  const ids = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, ""));
  const deps = {};
  for (const id of ids) {
    const text = fs.readFileSync(path.join(dir, id + ".js"), "utf8");
    deps[id] = [...text.matchAll(/require\("\.\/([\w-]+)"\)/g)].map((m) => m[1]);
    for (const d of deps[id]) assert.ok(ids.includes(d), `${id} requires missing module ${d}`);
  }
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    deps[id].forEach(walk);
  };
  walk("main");
  assert.deepEqual([...ids].filter((i) => !seen.has(i)), []);
});

test("modules don't require each other in a circle (a circle would leave imports empty at load time)", () => {
  const dir = path.join(__dirname, "..", "src");
  const ids = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, ""));
  const deps = Object.fromEntries(ids.map((id) => [id, [...fs.readFileSync(path.join(dir, id + ".js"), "utf8").matchAll(/require\("\.\/([\w-]+)"\)/g)].map((m) => m[1])]));
  const state = {};
  const visit = (id, trail) => {
    assert.notEqual(state[id], 1, `circular require: ${[...trail, id].join(" -> ")}`);
    if (state[id] === 2) return;
    state[id] = 1;
    deps[id].forEach((d) => visit(d, [...trail, id]));
    state[id] = 2;
  };
  ids.forEach((id) => visit(id, []));
});
