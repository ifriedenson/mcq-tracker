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

test("deck breakdown groups card reviews and intervals by deck", () => {
  const cards = [
    { file: { path: "Cards/A.md", basename: "A" }, fm: { title: "A", history: ["2026-11-01|correct|30|B|2||a|"] }, deck: "Alpha" },
    { file: { path: "Cards/B.md", basename: "B" }, fm: { title: "B", history: ["2026-11-01|incorrect|30|C|2||b|"] }, deck: "Beta" },
    { file: { path: "Cards/C.md", basename: "C" }, fm: { title: "C", history: ["2026-11-01|correct|30|B|2||c|"] }, deck: "Alpha" },
  ];
  const decks = S.deckBreakdown(cards, { fsrsRetention: 0.9 });
  assert.deepEqual(decks.map((deck) => deck.deck), ["Alpha", "Beta"]);
  assert.equal(decks[0].cards, 2);
  assert.equal(decks[0].reviews, 2);
  assert.equal(decks[0].retention, 1);
  assert.equal(decks[1].retention, 0);
});

test("buildStudyStats adds button mix, heatmap and durable recall from stored counters", () => {
  const C = T.studyCounters;
  const one = C.recordStudyCounter(undefined, { date: "2026-11-01", kind: "card", correct: true, seconds: 60, rating: "good" });
  const two = C.recordStudyCounter(one.counters, { date: "2026-11-01", kind: "note", correct: false, seconds: 30, rating: "again" });
  const card = {
    file: { path: "Cards/One.md", basename: "One" },
    fm: { title: "One", history: ["2026-11-01|correct|30|B|2||card-one|"], recall_days: ["2026-11-01", "2026-11-02"] },
    deck: "Deck",
  };
  const data = S.buildStudyStats({
    cards: [card],
    questions: [],
    notes: [],
    counters: two.counters,
    now: new Date(2026, 10, 1, 12),
    settings: { heatmapWeeks: 4, durableDays: 2 },
    fsrsRetention: 0.9,
  });
  assert.equal(data.buttonMix.total, 2);
  assert.equal(data.buttonMix.good, 1);
  assert.equal(data.buttonMix.againRate, 0.5);
  assert.equal(data.heatmap.weeks.length, 4);
  assert.equal(data.heatmap.days.find((day) => day.date === "2026-11-01").reviews, 2);
  assert.equal(data.decks[0].deck, "Deck");
  assert.equal(data.durability.total, 1);
  assert.equal(data.durability.durable, 1);
  assert.equal(data.settings.durableDays, 2);
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

test("distribution reports a median for odd and even samples", () => {
  assert.equal(S.distribution([1, 5, 30], [7, 21], ["a", "b", "c"]).median, 5);
  assert.equal(S.distribution([1, 5, 30, 100], [7, 21, 60], ["a", "b", "c", "d"]).median, 17.5);
  assert.equal(S.distribution([], [1], ["a", "b"]).median, null);
});

test("again rate is split by card maturity from replayed card rows", () => {
  const cards = [
    { file: { path: "Cards/A.md", basename: "A" }, fm: { title: "A", history: ["2026-11-01|incorrect|30|C|0||a|", "2026-11-01|correct|30|B|2||a|"] } },
    { file: { path: "Cards/B.md", basename: "B" }, fm: { title: "B", history: ["2026-11-01|correct|30|B|2||b|"] } },
  ];
  const rows = [...S.cardReviewRows(cards[0], { fsrsRetention: 0.9 }), ...S.cardReviewRows(cards[1], { fsrsRetention: 0.9 })];
  const mix = S.buttonMixByMaturity(rows);
  assert.equal(mix.all.total, 3);
  assert.equal(mix.all.again, 1);
  assert.equal(mix.byMaturity.young.total, 3, "ladder reviews at a one-day interval are young");
  assert.equal(mix.byMaturity.young.again, 1);
  assert.equal(mix.byMaturity.young.againRate, 1 / 3);
  assert.equal(mix.byMaturity.learning.total, 0);
});

test("timing metrics bucket seconds and flag answers over 1.5x target", () => {
  const timing = S.timingMetrics([
    { path: "Q/a.md", title: "A", date: "2026-11-01", seconds: 5, target: 20 },
    { path: "Q/b.md", title: "B", date: "2026-11-01", seconds: 40, target: 10 },
    { path: "Q/c.md", title: "C", date: "2026-11-01", seconds: 90, target: 0 },
  ]);
  assert.equal(timing.seconds.total, 3);
  assert.deepEqual(timing.seconds.buckets.map((bucket) => bucket.count), [1, 0, 1, 1, 0, 0]);
  assert.equal(timing.averageSeconds, 45);
  assert.equal(timing.medianSeconds, 40);
  assert.equal(timing.targeted, 2);
  assert.equal(timing.slow.count, 1);
  assert.equal(timing.slow.share, 0.5);
  assert.equal(timing.slow.rows[0].title, "B");
  assert.equal(timing.slow.rows[0].ratio, 4);
  assert.equal(timing.fast, 1);
});

test("buildStudyStats exposes answer-time and slow-answer analytics on real rows", () => {
  const card = {
    file: { path: "Cards/One.md", basename: "One" },
    fm: { title: "One", target_seconds: 20, history: ["2026-11-01|correct|5|B|2||card-one|"] },
    deck: "Deck",
  };
  const question = {
    file: { path: "Questions/q.md", basename: "q" },
    fm: { title: "Question", target_seconds: 10, history: ["2026-11-01|correct|40|B|2||q|"] },
  };
  const data = S.buildStudyStats({
    cards: [card],
    questions: [question],
    notes: [],
    now: new Date(2026, 10, 1, 12),
    settings: { heatmapWeeks: 4 },
    fsrsRetention: 0.9,
  });
  assert.equal(data.timing.seconds.total, 2);
  assert.equal(data.timing.slow.count, 1);
  assert.equal(data.timing.slow.total, 2);
  assert.equal(data.timing.slow.share, 0.5);
  assert.equal(data.timing.slow.rows[0].path, "Questions/q.md");
  assert.equal(data.timing.averageSeconds, 22.5);
});
