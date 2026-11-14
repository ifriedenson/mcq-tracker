"use strict";
/*
 * An overnight run remembers every file it was given, what it wrote for
 * each one, and where it stopped — so a reload, a crash or a dead server
 * resumes without importing anything twice, and Undo removes exactly what
 * the run wrote.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const runs = () => T.overnightRun;

async function setup() {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  return plugin;
}

test("overnight runs: a new run lists every file as pending", () => {
  const run = runs().makeOvernightRun([
    { sourcePath: "a.pdf", hash: "h1" },
    { sourcePath: "b.pdf", hash: "h2" },
  ]);
  assert.ok(run.id, "the run has an id");
  assert.ok(run.startedAt, "the run has a start time");
  assert.deepEqual(runs().pendingRunFiles(run).map((f) => f.sourcePath), ["a.pdf", "b.pdf"]);
  assert.deepEqual(runs().runNotePaths(run), []);
});

test("overnight runs: runs survive a reload through app storage", async () => {
  const plugin = await setup();
  const run = runs().makeOvernightRun([{ sourcePath: "a.pdf", hash: "h1" }]);
  runs().storeOvernightRun(plugin.app, run);
  const again = runs().latestOvernightRun(plugin.app);
  assert.equal(again.id, run.id);
  assert.equal(again.files.length, 1);
  // Only a handful of runs are kept; the newest stays first.
  for (let i = 0; i < 15; i++) runs().storeOvernightRun(plugin.app, runs().makeOvernightRun([{ sourcePath: `f${i}.pdf`, hash: `h${i}` }]));
  const kept = runs().loadOvernightRuns(plugin.app);
  assert.equal(kept.length, 10);
  assert.equal(kept[0].id, runs().latestOvernightRun(plugin.app).id);
});

test("overnight runs: a finished file is skipped, a changed file runs again", async () => {
  const plugin = await setup();
  const run = runs().makeOvernightRun([
    { sourcePath: "a.pdf", hash: "h1" },
    { sourcePath: "b.pdf", hash: "h2" },
  ]);
  runs().storeOvernightRun(plugin.app, run);
  runs().markRunFile(run, "a.pdf", { status: "done", notes: ["Questions/A/Q01.md"], copies: ["Questions/A/Source a.pdf"] });
  runs().storeOvernightRun(plugin.app, run);
  const resumed = runs().latestOvernightRun(plugin.app);
  assert.deepEqual(runs().pendingRunFiles(resumed).map((f) => f.sourcePath), ["b.pdf"], "the finished file is skipped");
  assert.ok(runs().runFileDone(resumed, "a.pdf", "h1"), "same path and hash counts as imported");
  assert.ok(!runs().runFileDone(resumed, "a.pdf", "changed"), "the same path with new bytes runs again");
  assert.ok(!runs().runFileDone(resumed, "b.pdf", "h2"), "an unfinished file is not done");
  assert.deepEqual(runs().runNotePaths(resumed), ["Questions/A/Q01.md", "Questions/A/Source a.pdf"], "undo sees notes and copies");
});

test("overnight runs: per-file verdicts roll up to run totals", () => {
  const run = runs().makeOvernightRun([{ sourcePath: "a.pdf", hash: "h1" }]);
  runs().markRunFile(run, "a.pdf", { status: "done", notes: ["Q01.md"], checks: { matched: 3, mismatched: 1, errored: 0 } });
  const totals = runs().runTotals(run);
  assert.deepEqual(totals, { files: 1, done: 1, notes: 1, matched: 3, mismatched: 1, errored: 0 });
});

test("overnight runs: junk in storage normalizes instead of crashing", async () => {
  const plugin = await setup();
  plugin.app.saveLocalStorage("mcq-tracker-overnight-runs", [{ nope: true }, null, "x"]);
  const kept = runs().loadOvernightRuns(plugin.app);
  assert.deepEqual(kept, [], "bad records are dropped");
  assert.equal(runs().latestOvernightRun(plugin.app), null);
  assert.equal(runs().pendingRunFiles(null).length, 0);
});

test("overnight runs: a source hash is stable and degrades gracefully", async () => {
  const plugin = await setup();
  const hash = await runs().sourceHash(plugin.app, "nothing.pdf");
  assert.equal(hash, "", "an unreadable file hashes to nothing, and resume falls back to the path");
});
