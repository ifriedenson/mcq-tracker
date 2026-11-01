"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const S = T.schedulerFit;

function card(attempts, correct, interval) {
  return { fm: { attempts, correct_count: correct, interval }, file: { path: `Cards/c${attempts}-${correct}-${interval}.md` }, deck: "Biology" };
}

test("scheduler fit: settings default, clamp and switch off", () => {
  assert.deepEqual(S.normalizeSchedulerFitSettings(undefined), { enabled: true, minSamples: 20 });
  assert.equal(S.normalizeSchedulerFitSettings({ minSamples: 2 }).minSamples, 10);
  assert.equal(S.normalizeSchedulerFitSettings({ minSamples: 9000 }).minSamples, 500);
  assert.equal(S.normalizeSchedulerFitSettings({ enabled: false }).enabled, false);
  assert.equal(S.normalizeSchedulerFitSettings(false).enabled, false);
});

test("scheduler fit: cards without reviews are skipped and counters are clamped", () => {
  const records = S.collectReviewRecords([
    card(0, 0, 3),
    { fm: { attempts: 4, correct_count: 9, interval: 5 }, file: { path: "Cards/x.md" } },
    { fm: {}, file: { path: "Cards/y.md" } },
    null,
  ]);
  assert.equal(records.length, 1);
  assert.equal(records[0].attempts, 4);
  assert.equal(records[0].correct, 4, "correct is clamped to attempts");
  assert.equal(records[0].deck, "Unsorted");
});

test("scheduler fit: a small history is not enough to fit", () => {
  const fit = S.fitRetention([card(3, 3, 2)], { minSamples: 20 });
  assert.equal(fit.ready, false);
  assert.equal(fit.recommended, null);
  assert.equal(fit.confidence, "low");
  assert.match(fit.advice.join(" "), /at least 20 reviews/i);
  assert.match(S.describeFit(fit), /review/i);
});

test("scheduler fit: observed recall recommends a stepped target and buckets the history", () => {
  const fit = S.fitRetention([card(20, 19, 2), card(20, 17, 14), card(20, 16, 45)], { minSamples: 20, current: 0.9 });
  assert.equal(fit.reviews, 60);
  assert.equal(fit.observedPercent, 87);
  assert.equal(fit.ready, true);
  assert.equal(fit.recommended, 0.85);
  assert.equal(fit.confidence, "medium");
  assert.equal(fit.buckets.find((bucket) => bucket.key === "short").reviews, 20);
  assert.equal(fit.buckets.find((bucket) => bucket.key === "fortnight").reviews, 20);
  assert.match(S.describeFit(fit), /87%/);
  assert.match(S.describeFit(fit), /0\.85/);
});

test("scheduler fit: applyAttempt writes the real scheduler interval for fitting", () => {
  const fm = {};
  T.applyAttempt(fm, { correct: true, chosen: "A", conf: 2, seconds: 5, now: new Date(2026, 0, 1) }, [1, 3, 7], {});
  assert.equal(fm.interval, 1);
  const records = S.collectReviewRecords([{ fm, file: { path: "Cards/new.md" }, deck: "Biology" }]);
  assert.equal(records.length, 1);
  assert.equal(records[0].interval, 1);
});

test("scheduler fit: target stays inside the safe band and low recall adds advice", () => {
  const low = S.fitRetention([card(30, 9, 30)], { minSamples: 20 });
  assert.equal(low.recommended, 0.8);
  assert.match(low.advice.join(" "), /below the safe band/i);

  const high = S.fitRetention([card(30, 30, 3)], { minSamples: 20 });
  assert.equal(high.recommended, 0.95);
  assert.match(high.advice.join(" "), /high/i);
});
