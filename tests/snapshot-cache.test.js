"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();

test("snapshot cache reuses a value until the data version changes", () => {
  const cache = T.snapshotCache.createSnapshotCache({ limit: 2 });
  let builds = 0;
  const build = () => ({ n: ++builds });

  const first = cache.get("dashboard", 1, build);
  assert.equal(first.n, 1);
  assert.equal(cache.get("dashboard", 1, build), first, "same version returns the same object");
  assert.equal(cache.get("dashboard", 2, build).n, 2, "a save increments the version and rebuilds");
  assert.equal(builds, 2);
  assert.equal(cache.stats().hits, 1);
  assert.equal(cache.stats().misses, 2);
});

test("snapshot cache is bounded and evicts the least recently used key", () => {
  const cache = T.snapshotCache.createSnapshotCache({ limit: 2 });
  cache.get("a", 1, () => "a");
  cache.get("b", 1, () => "b");
  cache.get("a", 1, () => "stale"); // refresh a, so b is now oldest
  cache.get("c", 1, () => "c");
  assert.equal(cache.size, 2);
  assert.equal(cache.stats().limit, 2);
  assert.equal(cache.get("a", 1, () => "rebuilt-a"), "a");
  assert.equal(cache.get("b", 1, () => "rebuilt-b"), "rebuilt-b");
});

test("plugin snapshots reuse derived data and invalidate on a vault or settings change", async () => {
  const app = makeApp([
    { path: "Questions/a.md", fm: { answer: "B", attempts: 1, correct_count: 1 } },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const now = new Date(2026, 10, 1, 12);

  const stats = plugin.studyStatsSnapshot(now);
  assert.equal(plugin.studyStatsSnapshot(now), stats, "statistics are reused within one data version");

  const dashboard = plugin.dashboardSnapshot({ today: now });
  assert.equal(plugin.dashboardSnapshot({ today: now }), dashboard, "dashboard aggregation is reused");

  const progress = plugin.progressSnapshot({ today: now });
  assert.equal(plugin.progressSnapshot({ today: now }), progress, "progress aggregation is reused");

  plugin.invalidateSnapshots();
  assert.notEqual(plugin.studyStatsSnapshot(now), stats);
  assert.notEqual(plugin.dashboardSnapshot({ today: now }), dashboard);
  assert.notEqual(plugin.progressSnapshot({ today: now }), progress);
});
