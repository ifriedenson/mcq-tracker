"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const G = T.cardGraderAccuracy;
const card = (fm) => ({ fm });

test("grader accuracy: latest AI, local and self grades split by week", () => {
  const data = G.buildGraderAccuracy(
    [
      card({ graded_by: "ai", grade_status: "graded", graded_on: "2026-11-02", verdict_override: false }),
      card({ graded_by: "ai", grade_status: "graded", graded_on: "2026-11-03", verdict_override: true }),
      card({ graded_by: "deterministic", grade_status: "graded", graded_on: "2026-10-27", verdict_override: false }),
      card({ graded_by: "self", grade_status: "self", graded_on: "2026-10-28" }),
      card({ graded_by: "something-else", graded_on: "2026-11-04" }),
    ],
    { today: "2026-11-06", weeks: 2 }
  );

  assert.equal(data.weeks.length, 2);
  assert.equal(data.start, "2026-10-26");
  assert.deepEqual(
    data.weeks.map((week) => ({
      ai: week.ai,
      local: week.local,
      self: week.self,
      graded: week.graded,
      overrides: week.overrides,
      agreement: week.agreement,
    })),
    [
      { ai: 0, local: 1, self: 1, graded: 1, overrides: 0, agreement: 1 },
      { ai: 2, local: 0, self: 0, graded: 2, overrides: 1, agreement: 0.5 },
    ]
  );
  assert.equal(data.totals.events, 4, "unknown grader labels are ignored");
  assert.equal(data.totals.ai, 2);
  assert.equal(data.totals.local, 1);
  assert.equal(data.totals.self, 1);
  assert.equal(data.totals.graded, 3);
  assert.equal(data.totals.overrides, 1);
  assert.equal(data.totals.agreement, 2 / 3);
  assert.equal(data.totals.aiAgreement, 0.5);
  assert.equal(data.totals.localAgreement, 1);
  assert.equal(data.totals.undated, 0);
  assert.equal(data.totals.outside, 0);
});

test("grader accuracy: undated and older grades stay in totals but not the trend", () => {
  const data = G.buildGraderAccuracy(
    [
      card({ graded_by: "ai", grade_status: "graded", graded_on: "" }),
      card({ graded_by: "ai", grade_status: "graded", graded_on: "2026-02-30" }),
      card({ graded_by: "deterministic", grade_status: "graded", graded_on: "2026-01-01" }),
      card({ graded_by: "self", grade_status: "self", graded_on: "2026-11-01" }),
    ],
    { today: "2026-11-06", weeks: 8 }
  );

  assert.equal(data.totals.events, 4);
  assert.equal(data.totals.graded, 3);
  assert.equal(data.totals.self, 1);
  assert.equal(data.totals.undated, 2);
  assert.equal(data.totals.outside, 1);
  assert.equal(data.weeks.reduce((n, week) => n + week.graded, 0), 0);
  assert.equal(data.weeks.reduce((n, week) => n + week.self, 0), 1);
});

test("grader accuracy: the trend starts on Monday and excludes future grades", () => {
  const data = G.buildGraderAccuracy(
    [
      card({ graded_by: "ai", graded_on: "2026-11-02" }),
      card({ graded_by: "ai", graded_on: "2026-11-01" }),
      card({ graded_by: "ai", graded_on: "2026-11-07" }),
    ],
    { today: "2026-11-06", weeks: 1 }
  );

  assert.equal(data.weeks.length, 1);
  assert.equal(data.weeks[0].start, "2026-11-02");
  assert.equal(data.weeks[0].graded, 1);
  assert.equal(data.totals.outside, 2);
});

test("grader accuracy: empty and self-only data report no agreement rate", () => {
  const empty = G.buildGraderAccuracy([], { today: "2026-11-06" });
  assert.equal(empty.weeks.length, 8);
  assert.equal(empty.totals.events, 0);
  assert.equal(empty.totals.agreement, null);
  assert.equal(empty.totals.aiAgreement, null);

  const self = G.buildGraderAccuracy(
    [card({ graded_by: "self", grade_status: "self", graded_on: "2026-11-06" })],
    { today: "2026-11-06", weeks: 1 }
  );
  assert.equal(self.totals.self, 1);
  assert.equal(self.totals.graded, 0);
  assert.equal(self.totals.agreement, null);
  assert.equal(self.weeks[0].self, 1);
});
