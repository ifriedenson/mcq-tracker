"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { build } = require("../scripts/build");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const lite = build({ lite: true });

test("the directory build uses no Node.js APIs and nothing outside the Obsidian module", () => {
  const requires = new Set([...lite.matchAll(/require\("([^".][^"]*)"\)/g)].map((m) => m[1]));
  assert.deepEqual([...requires], ["obsidian"]);
  for (const bad of ["child_process", "nodeReq", "chmodSync", "readFileSync", "anomalyco", "os.homedir", "createServer"]) {
    assert.ok(!lite.includes(bad), `directory build still contains ${bad}`);
  }
});

test("the full build still has the OpenCode agent", () => {
  const full = build();
  assert.ok(full.includes("child_process"));
  assert.ok(full.includes("anomalyco"));
});

test("the directory build loads, never offers OpenCode, and the rest of the plugin works", async () => {
  const file = path.join(os.tmpdir(), `mcq-directory-${process.pid}.js`);
  fs.writeFileSync(file, lite);
  try {
    const { Plugin: QT, T } = load(file);
    const app = makeApp([{ path: "Q/a.md", fm: { skill: "s", difficulty: "easy" } }]);
    const plugin = new QT(app);
    plugin.saved = { ai: { enabled: true, backend: "opencode" } };
    await plugin.onload();
    assert.equal(plugin.backend(), "api", "must stay on the Direct API even if settings say opencode");
    assert.equal(plugin.manager.isRunning(), false);
    await assert.rejects(() => plugin.manager.ensure(() => {}), /isn't part of this version/);
    const ids = plugin.commands.map((c) => c.id);
    for (const id of ["practice-folder", "timed-test", "weak-spots", "error-log", "find-question", "import-pdf"]) assert.ok(ids.includes(id), id);
    assert.equal(T.computeStats(plugin.getQuestions(), "skill")[0].value, "s");
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test("manifest: no desktop-only flag is needed for the directory build, and the description fits the rules", () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
  assert.equal(m.isDesktopOnly, false);
  assert.ok(m.description.length <= 250);
  assert.match(m.description, /\.$/);
  assert.ok(!/obsidian/i.test(m.id) && !/obsidian/i.test(m.name));
  assert.equal(m.fundingUrl, undefined);
});
