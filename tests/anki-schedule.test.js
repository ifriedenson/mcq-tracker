"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ankiTiming } = require("../src/anki-schedule");

test("anki timing: a brand-new card exports as new", () => {
  assert.deepEqual(ankiTiming({}, "2026-11-20"), { due: 0, ivl: 0, reps: 0, lapses: 0, queue: 0, factor: 2500 });
});

test("anki timing: a reviewed card keeps its due day and interval", () => {
  const timing = ankiTiming({ attempts: 3, lapses: 1, next_review: "2026-11-25", interval_days: 5 }, "2026-11-20");
  assert.deepEqual(timing, { due: 5, ivl: 5, reps: 3, lapses: 1, queue: 2, factor: 2500 });
  assert.ok(timing.factor >= 1300, "Anki rejects an ease factor under 1300");
});

test("anki timing: an overdue card is due now, never negative", () => {
  const timing = ankiTiming({ attempts: 2, next_review: "2026-11-01", interval_days: 3 }, "2026-11-20");
  assert.equal(timing.due, 0);
  assert.equal(timing.ivl, 3);
});

test("anki timing: a reviewed card without a stored interval gets at least one day", () => {
  const timing = ankiTiming({ attempts: 1, next_review: "2026-11-20" }, "2026-11-20");
  assert.equal(timing.ivl, 1);
  assert.equal(timing.due, 0);
});

test("anki timing: an unreadable next_review still counts the reviews", () => {
  const timing = ankiTiming({ attempts: 4, next_review: "soon" }, "2026-11-20");
  assert.equal(timing.reps, 4);
  assert.equal(timing.due, 0);
  assert.equal(timing.queue, 2);
});
