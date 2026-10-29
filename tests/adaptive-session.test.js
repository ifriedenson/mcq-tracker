"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();

function question(history, target) {
  return { file: { path: `Questions/${Math.random()}.md` }, fm: { history, target_seconds: target || 60 } };
}

function history(result, count, day) {
  return Array.from({ length: count }, (_v, index) => `${day || "2026-10-28"} 10:00:0${index % 10}|${result}|20|||id${index}`);
}

test("adaptive session: stretch after strong, fast recall", () => {
  const items = [question(history("correct", 10))];
  const plan = T.adaptiveSession.adaptiveSessionValue(items, {
    kind: "time",
    base: 5,
    today: "2026-10-29",
    settings: { enabled: true },
  });
  assert.equal(plan.band, "stretch");
  assert.equal(plan.value, 7);
  assert.equal(plan.metrics.attempts, 10);
  assert.match(plan.reason, /100% recent accuracy/);
});

test("adaptive session: warm up after misses and logged skips", () => {
  const items = [question(history("incorrect", 8).concat(history("skipped", 4)))];
  const plan = T.adaptiveSession.adaptiveSessionValue(items, {
    kind: "count",
    base: 10,
    today: "2026-10-29",
    settings: { enabled: true },
  });
  assert.equal(plan.band, "warmup");
  assert.equal(plan.value, 7);
  assert.equal(plan.metrics.skipped, 4);
});

test("adaptive session: caps are hard limits and can be disabled", () => {
  const items = [question(history("correct", 12))];
  const capped = T.adaptiveSession.adaptiveSessionValue(items, {
    kind: "count",
    base: 20,
    today: "2026-10-29",
    settings: { enabled: true, maxCount: 8 },
  });
  assert.equal(capped.value, 8);
  const off = T.adaptiveSession.adaptiveSessionValue(items, {
    kind: "count",
    base: 10,
    today: "2026-10-29",
    settings: { enabled: false },
  });
  assert.equal(off.value, 10);
  assert.equal(off.enabled, false);
});

test("adaptive session: stale history and too little history leave the base alone", () => {
  const stale = [question(history("correct", 20, "2026-09-01"))];
  const plan = T.adaptiveSession.adaptiveSessionValue(stale, {
    kind: "time",
    base: 5,
    today: "2026-10-29",
    settings: { enabled: true },
  });
  assert.equal(plan.value, 5);
  assert.equal(plan.metrics.attempts, 0);
});

test("adaptive daily count: respects the configured maximum", () => {
  const items = [question(history("correct", 12))];
  const plan = T.adaptiveSession.adaptiveDailyCount(items, { count: 5 }, {
    today: "2026-10-29",
    settings: { enabled: true, maxCount: 6, minCount: 3 },
  });
  assert.equal(plan.value, 6);
});
