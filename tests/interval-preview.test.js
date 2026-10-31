"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const P = T.intervalPreview;

test("interval previews: ladder timing mirrors the note scheduler", () => {
  const settings = { scheduler: "ladder", intervals: [1, 3, 7, 21, 60] };
  assert.deepEqual(P.intervalPreviews({ streak: 0 }, "", settings), { again: 1, hard: 2, good: 1, easy: 3 });
  assert.deepEqual(P.intervalPreviews({ streak: 2 }, "", settings), { again: 1, hard: 2, good: 3, easy: 7 });
  assert.equal(P.ladderDays({ streak: 99 }, [1, 3, 7], "easy"), 7);
  assert.equal(P.ladderDays({}, [], "good"), 1);
});

test("interval previews: SM-2 and FSRS previews come from their pure schedulers", () => {
  const sm2 = P.intervalPreviews({}, "", { scheduler: "sm2" });
  assert.ok(sm2.again >= 1);
  assert.ok(sm2.easy >= sm2.good);
  const fsrs = P.intervalPreviews({}, "", { scheduler: "fsrs" });
  for (const grade of ["again", "hard", "good", "easy"]) assert.ok(Number.isFinite(fsrs[grade]) && fsrs[grade] >= 1, grade);
  assert.ok(fsrs.easy >= fsrs.good);
});

test("interval previews: labels stay compact", () => {
  assert.equal(P.formatInterval(0), "today");
  assert.equal(P.formatInterval(1), "1d");
  assert.equal(P.formatInterval(10), "10d");
  assert.equal(P.formatInterval(21), "3w");
  assert.equal(P.formatInterval(90), "3mo");
  assert.equal(P.formatInterval(730), "2.0y");
});
