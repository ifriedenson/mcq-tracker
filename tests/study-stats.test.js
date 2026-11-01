"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const S = T.studyStats;

test("maturity buckets follow Anki-style interval boundaries", () => {
  assert.equal(S.maturityOf(0), "learning");
  assert.equal(S.maturityOf(0.5), "learning");
  assert.equal(S.maturityOf(1), "young");
  assert.equal(S.maturityOf(20), "young");
  assert.equal(S.maturityOf(21), "mature");
  assert.equal(S.maturityOf(365), "mature");
});

test("retention by maturity aggregates attempts and correct reviews", () => {
  const result = S.retentionByMaturity([
    { maturity: "learning", correct: true },
    { maturity: "learning", correct: false },
    { maturity: "young", correct: true },
    { maturity: "young", correct: true },
    { maturity: "mature", correct: false },
  ]);
  assert.equal(result.byMaturity.learning.attempts, 2);
  assert.equal(result.byMaturity.learning.retention, 0.5);
  assert.equal(result.byMaturity.young.attempts, 2);
  assert.equal(result.byMaturity.young.retention, 1);
  assert.equal(result.byMaturity.mature.attempts, 1);
  assert.equal(result.byMaturity.mature.retention, 0);
  assert.equal(result.all.attempts, 5);
  assert.equal(result.all.correct, 3);
  assert.equal(result.all.retention, 0.6);
  assert.equal(result.byMaturity.learning.label, "Learning (<1d)");
});

test("distribution buckets values at the edges and includes a tail bucket", () => {
  const dist = S.distribution([1, 5, 30, 100], [1, 7, 21, 60, 180], ["<1d", "1–7d", "7–21d", "21–60d", "60–180d", "180d+"]);
  assert.deepEqual(dist.buckets.map((bucket) => bucket.count), [0, 2, 0, 1, 1, 0]);
  assert.equal(dist.total, 4);
  assert.equal(dist.buckets[1].label, "1–7d");
  assert.equal(dist.buckets[5].label, "180d+");
});

test("weekday rhythm groups reviews from Monday to Sunday", () => {
  const rows = [
    { date: "2026-11-01", correct: true },
    { date: "2026-11-01", correct: false },
    { date: "2026-10-26", correct: true },
  ];
  const rhythm = S.weekdayRhythm(rows);
  assert.equal(rhythm[6].attempts, 2);
  assert.equal(rhythm[6].correct, 1);
  assert.equal(rhythm[0].attempts, 1);
  assert.equal(rhythm[0].accuracy, 1);
});

test("leech list includes questions, cards and notes at the threshold", () => {
  const rows = S.leechList(
    [{ file: { path: "Q.md", basename: "Q" }, fm: { leech_lapses: 5 } }],
    [{ file: { path: "C.md", basename: "C" }, fm: { leech_lapses: 6 } }],
    [{ file: { path: "N.md", basename: "N" }, fm: { note_lapse_streak: 4 } }],
    5
  );
  assert.deepEqual(rows.map((row) => row.path), ["C.md", "Q.md"]);
  assert.equal(rows[0].lapses, 6);
});

test("buildStudyStats derives card history and day detail without inventing data", () => {
  const card = {
    file: { path: "Cards/One.md", basename: "One" },
    fm: {
      title: "One",
      history: ["2026-11-01|correct|30|B|2||card-one|", "2026-10-30|correct|20|B|2||card-one|"],
    },
    deck: "Deck",
  };
  const data = S.buildStudyStats({
    cards: [card],
    questions: [],
    notes: [],
    now: new Date(2026, 10, 1),
    settings: { leechThreshold: 5 },
    fsrsRetention: 0.9,
  });
  assert.equal(data.totals.cardReviews, 2);
  assert.equal(data.totals.reviews, 2);
  assert.equal(data.days.length, 2);
  assert.equal(data.days[0].date, "2026-11-01");
  assert.ok(data.retention.all.attempts >= 1);
  assert.equal(data.metrics.memoryNow, null);
});
