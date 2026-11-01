"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const C = T.studyCounters;

test("per-day counters record kinds, ratings and minutes", () => {
  let counters = C.normalizeStudyCounters(undefined);
  const first = C.recordStudyCounter(counters, { date: "2026-11-01", kind: "note", correct: true, seconds: 60, rating: "good" });
  counters = first.counters;
  const second = C.recordStudyCounter(counters, { date: "2026-11-01", kind: "card", correct: false, seconds: 30, rating: "again" });
  counters = second.counters;
  assert.equal(counters.days["2026-11-01"].reviews, 2);
  assert.equal(counters.days["2026-11-01"].notes, 1);
  assert.equal(counters.days["2026-11-01"].cards, 1);
  assert.equal(counters.days["2026-11-01"].good, 1);
  assert.equal(counters.days["2026-11-01"].again, 1);
  assert.equal(counters.days["2026-11-01"].seconds, 90);
});

test("counters survive a JSON restart and expose totals and button mix", () => {
  const one = C.recordStudyCounter(undefined, { date: "2026-11-01", kind: "note", correct: true, seconds: 60, rating: "good" });
  const two = C.recordStudyCounter(one.counters, { date: "2026-11-02", kind: "question", correct: false, seconds: 30, rating: "again" });
  const restored = C.normalizeStudyCounters(JSON.parse(JSON.stringify(two.counters)));
  assert.deepEqual(restored.days, two.counters.days);
  const totals = C.counterTotals(restored);
  assert.equal(totals.reviews, 2);
  assert.equal(totals.minutes, 1.5);
  assert.equal(totals.days, 2);
  assert.equal(C.buttonMix(restored).againRate, 0.5);
});

test("heatmap ends today, is Monday-aligned, and preserves counter days", () => {
  const counters = C.recordStudyCounter(undefined, { date: "2026-11-01", kind: "card", correct: true, seconds: 60 }).counters;
  const map = C.counterHeatmap(counters, 2, new Date(2026, 10, 1, 12));
  assert.equal(map.weeks.length, 2);
  assert.equal(map.weeks[1].days[6].date, "2026-11-01");
  assert.equal(map.weeks[1].days[6].reviews, 1);
  assert.equal(map.activeDays, 1);
  assert.equal(C.counterDay(counters, "2026-11-01").minutes, 1);
});

test("permanent counters survive a plugin save and reload", async () => {
  const first = new QT(makeApp([]));
  await first.onload();
  await first.recordStudyCounter({ date: "2026-11-01", kind: "card", correct: true, seconds: 45, rating: "good" });
  const second = new QT(makeApp([]));
  second.saved = first.saved;
  await second.onload();
  const totals = C.counterTotals(second.settings.studyCounters);
  assert.equal(totals.reviews, 1);
  assert.equal(totals.cards, 1);
  assert.equal(totals.seconds, 45);
  assert.equal(C.counterDay(second.settings.studyCounters, "2026-11-01").good, 1);
});

test("old or malformed counter entries are normalized away", () => {
  const normalized = C.normalizeStudyCounters({ days: { bad: { reviews: 1 }, "2026-11-01": { reviews: -1, seconds: "x" } } });
  assert.deepEqual(Object.keys(normalized.days), ["2026-11-01"]);
  assert.equal(normalized.days["2026-11-01"].reviews, 0);
});
