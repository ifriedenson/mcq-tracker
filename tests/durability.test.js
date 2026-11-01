"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const D = T.durability;

test("recall becomes durable only after correct reviews on two distinct days", () => {
  const fm = {};
  const first = D.recordRecallDay(fm, { correct: true, date: "2026-11-01" });
  assert.equal(first.durable, false);
  assert.equal(fm.durable_recall, false);
  const same = D.recordRecallDay(fm, { correct: true, date: "2026-11-01" });
  assert.equal(same.durable, false);
  assert.deepEqual(fm.recall_days, ["2026-11-01"]);
  const second = D.recordRecallDay(fm, { correct: true, date: "2026-11-02" });
  assert.equal(second.durable, true);
  assert.equal(second.newlyDurable, true);
  assert.equal(fm.durable_recall, true);
  assert.equal(fm.durable_on, "2026-11-02");
  assert.equal(D.durabilityOf(fm).durable, true);
});

test("a miss clears the durable run without erasing the review history", () => {
  const fm = { recall_days: ["2026-11-01", "2026-11-02", "2026-11-03"], durable_recall: true, durable_on: "2026-11-02" };
  const result = D.recordRecallDay(fm, { correct: false, date: "2026-11-04" });
  assert.equal(result.durable, false);
  assert.deepEqual(fm.recall_days, []);
  assert.equal(fm.durable_recall, false);
  assert.equal(fm.durable_on, undefined);
  assert.equal(fm.recall_checked, "2026-11-04");
});

test("durability summary reports durable and learning items", () => {
  const summary = D.durabilitySummary(
    [
      { file: { path: "A.md", basename: "A" }, fm: { recall_days: ["2026-11-01", "2026-11-02"] } },
      { file: { path: "B.md", basename: "B" }, fm: { recall_days: ["2026-11-01"] } },
    ],
    2
  );
  assert.equal(summary.total, 2);
  assert.equal(summary.durable, 1);
  assert.equal(summary.learning, 1);
  assert.equal(summary.retention, 0.5);
});

test("required durability days clamp to at least two", () => {
  assert.equal(D.normalizeDurabilitySettings({ requiredDays: 1 }).requiredDays, 2);
  assert.equal(D.normalizeDurabilitySettings({ requiredDays: 99 }).requiredDays, 10);
});

test("durability settings no longer expose the unused enabled flag", () => {
  assert.deepEqual(D.normalizeDurabilitySettings({}), { requiredDays: 2 });
  assert.deepEqual(D.normalizeDurabilitySettings({ enabled: false }), { requiredDays: 2 });
});
