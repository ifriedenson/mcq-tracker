"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const F = T.fsrsFit;

function reviewCard(path, deck, attempts, correct, interval) {
  return {
    file: { path },
    deck,
    fm: {
      attempts,
      correct_count: correct,
      interval: interval === undefined ? 5 : interval,
    },
  };
}

function reportsFor(cards, currentRetention) {
  return F.fitRetentionDecks(cards, {
    currentRetention,
    globalRetention: 0.9,
    minSamples: 20,
  });
}

test("fsrs retention fit: bounds normalize into the safe band", () => {
  assert.equal(F.normalizeRetention(0.8), 0.85);
  assert.equal(F.normalizeRetention(0.99), 0.95);
  assert.equal(F.normalizeRetention(0.9), 0.9);
  assert.equal(F.normalizeRetention("not a number"), null);
  assert.equal(F.normalizeRetention(null), null);
  assert.equal(typeof F.fitDecay, "undefined", "no decay-weight trainer is shipped");
  assert.equal(typeof F.weightsForDecay, "undefined", "no custom weights are shipped");
});

test("fsrs retention fit: each deck is fitted from its own review counters", () => {
  const cards = [
    reviewCard("Cards/Biology/a.md", "Biology", 10, 10),
    reviewCard("Cards/Biology/b.md", "Biology", 10, 10),
    reviewCard("Cards/Biology/c.md", "Biology", 10, 10),
    reviewCard("Cards/Chemistry/a.md", "Chemistry", 10, 8),
    reviewCard("Cards/Chemistry/b.md", "Chemistry", 10, 8),
    reviewCard("Cards/Physics/a.md", "Physics", 4, 3),
  ];
  const reports = reportsFor(cards, { Biology: 0.9, Chemistry: 0.9, Physics: 0.9 });
  const byDeck = Object.fromEntries(reports.map((report) => [report.deck, report]));
  assert.equal(byDeck.Biology.reviews, 30);
  assert.equal(byDeck.Biology.cards, 3);
  assert.equal(byDeck.Biology.recommended, 0.95);
  assert.equal(byDeck.Biology.accepted, true);
  assert.equal(byDeck.Chemistry.reviews, 20);
  assert.equal(byDeck.Chemistry.recommended, 0.85);
  assert.equal(byDeck.Chemistry.accepted, true);
  assert.equal(byDeck.Physics.reviews, 4);
  assert.equal(byDeck.Physics.ready, false);
  assert.equal(byDeck.Physics.recommended, null);
  assert.equal(byDeck.Physics.accepted, false);
  assert.match(byDeck.Physics.reason, /at least 20/i);
  for (const report of reports) {
    assert.equal(report.weightsFixed, true);
    assert.equal(Object.prototype.hasOwnProperty.call(report, "weights"), false);
  }
  assert.match(F.describeFsrsRetentionFit(byDeck.Biology), /Weights stay fixed/);
});

test("fsrs retention fit: an unchanged target is reported without an Apply path", () => {
  const reports = reportsFor([reviewCard("Cards/Biology/a.md", "Biology", 20, 18)], { Biology: 0.9 });
  assert.equal(reports.length, 1);
  assert.equal(reports[0].recommended, 0.9);
  assert.equal(reports[0].accepted, false);
  assert.match(reports[0].reason, /already matches/i);
  assert.match(F.describeFsrsRetentionFit(reports[0]), /already matches/i);
});

test("fsrs retention fit: an explicit deck target stays visible without review data", () => {
  const reports = F.fitRetentionDecks([], { currentRetention: { Biology: 0.93 }, globalRetention: 0.9 });
  assert.equal(reports.length, 1);
  assert.equal(reports[0].deck, "Biology");
  assert.equal(reports[0].reviews, 0);
  assert.equal(reports[0].current, 0.93);
  assert.equal(reports[0].custom, true);
  assert.equal(reports[0].accepted, false);
  assert.match(reports[0].reason, /at least 20/i);
});

test("fsrs retention fit: apply and reset are per deck and weights stay fixed", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const cards = [
    reviewCard("Cards/Biology/a.md", "Biology", 15, 15),
    reviewCard("Cards/Chemistry/a.md", "Chemistry", 15, 12),
  ];
  plugin.getCards = () => cards;
  const before = plugin.fsrsRetentionReports();
  const biology = before.find((report) => report.deck === "Biology");
  assert.ok(biology);
  assert.equal(biology.weightsFixed, true);
  assert.equal(await plugin.applyFsrsRetention("Biology", 0.93), 0.93);
  assert.equal(T.cards.effectiveFsrsRetention(plugin.settings, "Biology"), 0.93);
  assert.equal(T.cards.effectiveFsrsRetention(plugin.settings, "Chemistry"), plugin.settings.fsrsRetention);
  const scheduler = T.cards.schedulerForDeck(plugin.settings, "Biology");
  assert.equal(scheduler.fsrsRetention, 0.93);
  assert.equal(Object.prototype.hasOwnProperty.call(scheduler, "fsrsWeights"), false);
  const applied = plugin.fsrsRetentionReports().find((report) => report.deck === "Biology");
  assert.ok(applied);
  assert.equal(applied.current, 0.93);
  assert.equal(applied.custom, true);
  assert.equal(await plugin.resetFsrsRetention("Biology"), true);
  assert.equal(T.cards.effectiveFsrsRetention(plugin.settings, "Biology"), plugin.settings.fsrsRetention);
  assert.equal(await plugin.resetFsrsRetention("Biology"), null);
});

test("fsrs retention fit: a custom deck is reset even after its cards age out", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.getCards = () => [reviewCard("Cards/Biology/a.md", "Biology", 25, 22)];
  assert.equal(await plugin.applyFsrsRetention("Biology", 0.93), 0.93);
  plugin.getCards = () => [];
  const report = plugin.fsrsRetentionReports().find((row) => row.deck === "Biology");
  assert.ok(report);
  assert.equal(report.reviews, 0);
  assert.equal(report.current, 0.93);
  assert.equal(report.custom, true);
  assert.equal(report.accepted, false);
  assert.equal(await plugin.resetFsrsRetention("Biology"), true);
});

test("fsrs retention fit: a review uses the deck target and no custom weights", () => {
  const fm = {
    history: ["2026-01-01|correct|20|A|2|", "2026-01-05|correct|20|A|2|"],
    target_seconds: 90,
  };
  T.applyAttempt(
    fm,
    { correct: true, conf: 2, seconds: 20, now: new Date("2026-01-12T10:00:00") },
    [1, 3, 7],
    { scheduler: "fsrs", fsrsRetention: 0.85 }
  );
  assert.ok(fm.srs.startsWith("fsrs6|"));
  assert.ok(T.fsrs.decodeSrs(fm.srs));
});
