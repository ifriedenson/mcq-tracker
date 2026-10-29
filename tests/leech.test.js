"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();

const DAY = new Date(2026, 9, 29, 9, 0);

function miss(fm, opts, conf = 2) {
  return T.applyAttempt(fm, { correct: false, chosen: "B", conf, seconds: 20, now: DAY }, [1, 3, 7], opts);
}

test("consecutive misses flag a leech once, and a correct answer clears it", () => {
  const fm = {};
  const opts = { leechThreshold: 3, leechAction: "flag" };

  miss(fm, opts);
  miss(fm, opts);
  assert.equal(fm.leech, undefined);
  assert.equal(fm.leech_lapses, 2);

  const summary = miss(fm, opts);
  assert.equal(fm.leech, true);
  assert.equal(fm.leech_since, "2026-10-29");
  assert.deepEqual(summary.leech, { lapses: 3, threshold: 3, suspended: false });
  assert.equal(fm.study_status, undefined);

  // Further misses do not re-flag or suspend.
  miss(fm, opts);
  assert.equal(fm.leech_lapses, 4);
  assert.equal(fm.study_status, undefined);

  T.applyAttempt(fm, { correct: true, chosen: "A", conf: 3, seconds: 10, now: DAY }, [1, 3, 7], opts);
  assert.equal(fm.leech, undefined);
  assert.equal(fm.leech_since, undefined);
  assert.equal(fm.leech_lapses, 0);
});

test("the suspend action hides a leech, and threshold 0 disables the feature", () => {
  const fm = {};
  const opts = { leechThreshold: 2, leechAction: "suspend" };
  miss(fm, opts);
  const summary = miss(fm, opts);
  assert.equal(fm.leech, true);
  assert.equal(fm.study_status, "suspended");
  assert.equal(fm.suspended_on, "2026-10-29");
  assert.equal(summary.leech.suspended, true);

  const off = {};
  for (let i = 0; i < 10; i++) miss(off, { leechThreshold: 0 });
  assert.equal(off.leech, undefined);
  assert.equal(off.leech_lapses, undefined);
  assert.equal(off.study_status, undefined);
});

test("an existing suspended status is never overwritten", () => {
  const fm = { study_status: "buried", buried_until: "2026-10-30" };
  miss(fm, { leechThreshold: 1, leechAction: "suspend" });
  assert.equal(fm.leech, true);
  assert.equal(fm.study_status, "buried");
  assert.equal(fm.buried_until, "2026-10-30");
});
