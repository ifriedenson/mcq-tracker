"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();

test("skip insights: overall and per-skill totals include logged skips without changing accuracy", () => {
  const questions = [
    { file: { path: "Questions/a.md" }, fm: { skill: "Algebra", attempts: 4, correct_count: 3, skip_count: 2, time_spent_total: 120, history: [] } },
    { file: { path: "Questions/b.md" }, fm: { skill: "Algebra", attempts: 2, correct_count: 1, skip_count: 1, time_spent_total: 60, history: [] } },
  ];
  const overall = T.overallStats(questions);
  assert.equal(overall.attempts, 6);
  assert.equal(overall.correct, 4);
  assert.equal(overall.skipped, 3);
  assert.equal(overall.accuracy, 4 / 6);
  const row = T.computeStats(questions, "skill").find((r) => r.value === "Algebra");
  assert.equal(row.skipped, 3);
  assert.equal(row.skipRate, 3 / 9);
});
