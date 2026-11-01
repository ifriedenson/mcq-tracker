"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const F = T.fsrsFit;

function pointsFor(trueDecay, count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const stability = 2 + (i % 9) * 7;
    const elapsed = 1 + (i % 17) * 2;
    const p = F.predictedRecall(stability, elapsed, trueDecay);
    points.push({
      when: i,
      stability,
      elapsed,
      correct: ((i * 37) % 100) / 100 < p,
      deck: "Biology",
      path: `Cards/${i % 8}.md`,
    });
  }
  return points;
}

function fsrsCard(path, deck, history) {
  const first = T.fsrs.reviewNote({ history: [] }, { correct: true, conf: 2, seconds: 20, now: new Date("2026-01-01T10:00:00") }, 0.9);
  return { file: { path }, deck, fm: { srs: first.srs, history } };
}

test("fsrs fit: only a default vector with a bounded decay change is accepted", () => {
  const weights = F.weightsForDecay(0.3);
  assert.equal(weights.length, 21);
  assert.equal(weights[F.DECAY_INDEX], 0.3);
  assert.equal(F.normalizeFsrsWeights(weights)[F.DECAY_INDEX], 0.3);
  assert.equal(F.normalizeFsrsWeights([1, 2, 3]), null);
  assert.equal(F.normalizeFsrsWeights(null), null);
  const changed = weights.slice();
  changed[0] = 0.4;
  assert.equal(F.normalizeFsrsWeights(changed), null, "state-transition weights stay fixed");
  assert.equal(F.normalizeDecay(0.01), F.MIN_DECAY);
  assert.equal(F.normalizeDecay(2), F.MAX_DECAY);
});

test("fsrs fit: a large history with a held-out improvement produces bounded weights", () => {
  const fit = F.fitDecay(pointsFor(0.45, 120), { cards: 8 });
  assert.equal(fit.accepted, true);
  assert.ok(fit.fittedDecay >= F.MIN_DECAY && fit.fittedDecay <= F.MAX_DECAY);
  assert.equal(fit.weights[F.DECAY_INDEX], fit.fittedDecay);
  assert.ok(fit.improvement >= F.MIN_IMPROVEMENT);
  assert.equal(fit.defaultDecay, F.DEFAULT_WEIGHTS[F.DECAY_INDEX]);
  assert.match(F.describeFsrsFit(fit), /held-out/);
});

test("fsrs fit: short histories and unvalidated improvements are rejected", () => {
  const short = F.fitDecay(pointsFor(0.45, 20), { cards: 8 });
  assert.equal(short.accepted, false);
  assert.match(short.reason, /at least/);
  assert.equal(short.weights, null);
  const strict = F.fitDecay(pointsFor(0.45, 120), { cards: 8, minImprovement: 1 });
  assert.equal(strict.accepted, false);
  assert.match(strict.reason, /needs at least/);
  assert.equal(strict.weights, null);
});

test("fsrs fit: replay reads only FSRS cards and keeps old history rows readable", () => {
  const history = [
    "2026-01-01|correct|20|A|2|",
    "2026-01-05|incorrect|20|B|2|",
    "2026-01-12|correct|20|A|2|",
  ];
  const points = F.collectDecayPoints([fsrsCard("Cards/Biology/a.md", "Biology", history)], { now: new Date("2026-02-01T10:00:00") });
  assert.equal(points.length, 2);
  assert.equal(points[0].deck, "Biology");
  assert.ok(points[0].stability > 0);
  assert.ok(points[0].elapsed > 0);
  assert.equal(points[1].correct, true);
  const ladderOnly = { file: { path: "Cards/Biology/b.md" }, deck: "Biology", fm: { history } };
  assert.deepEqual(F.collectDecayPoints([ladderOnly], { now: new Date("2026-02-01T10:00:00") }), []);
});

test("fsrs fit: the plugin report exposes custom decks even after their points age out", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const card = fsrsCard("Cards/Biology/a.md", "Biology", [
    "2026-01-01|correct|20|A|2|",
    "2026-01-05|correct|20|A|2|",
    "2026-01-12|correct|20|A|2|",
  ]);
  plugin.getCards = () => [card];
  const before = plugin.fsrsFitReports();
  assert.equal(before.length, 1);
  assert.equal(before[0].deck, "Biology");
  assert.equal(before[0].accepted, false);
  await plugin.applyFsrsFitWeights("Biology", F.weightsForDecay(0.45));
  plugin.getCards = () => [];
  const after = plugin.fsrsFitReports();
  assert.equal(after.length, 1);
  assert.equal(after[0].custom, true);
  assert.equal(after[0].currentDecay, 0.45);
  assert.equal(after[0].accepted, false);
  assert.equal(await plugin.resetFsrsFitWeights("Biology"), true);
});

test("fsrs fit: applying weights is per deck and reset restores the defaults", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const weights = F.weightsForDecay(0.45);
  assert.equal(await plugin.applyFsrsFitWeights("Biology", weights), 0.45);
  const biology = T.cards.schedulerForDeck(plugin.settings, "Biology");
  assert.equal(biology.fsrsWeights[F.DECAY_INDEX], 0.45);
  assert.equal(biology.fsrsRetention, 0.9);
  const chemistry = T.cards.schedulerForDeck(plugin.settings, "Chemistry");
  assert.equal(chemistry.fsrsWeights, null, "other decks still inherit the defaults");
  assert.equal(await plugin.resetFsrsFitWeights("Biology"), true);
  assert.equal(T.cards.effectiveFsrsWeights(plugin.settings, "Biology"), null);
  assert.equal(await plugin.resetFsrsFitWeights("Biology"), null);
});

test("fsrs fit: an attempt uses the deck's custom weights and leaves default decks alone", () => {
  const history = ["2026-01-01|correct|20|A|2|", "2026-01-05|correct|20|A|2|"];
  const now = new Date("2026-01-12T10:00:00");
  const base = { history, target_seconds: 90 };
  const plain = JSON.parse(JSON.stringify(base));
  const custom = JSON.parse(JSON.stringify(base));
  T.applyAttempt(plain, { correct: true, conf: 2, seconds: 20, now }, [1, 3, 7], { scheduler: "fsrs", fsrsRetention: 0.9, fsrsWeights: null });
  T.applyAttempt(custom, { correct: true, conf: 2, seconds: 20, now }, [1, 3, 7], { scheduler: "fsrs", fsrsRetention: 0.9, fsrsWeights: F.weightsForDecay(0.45) });
  assert.notEqual(custom.next_review, plain.next_review);
  assert.ok(custom.srs.startsWith("fsrs6|"));
  assert.ok(T.fsrs.decodeSrs(custom.srs));
});

test("fsrs fit: custom weights change the next schedule without changing the note history", () => {
  const fm = { history: ["2026-01-01|correct|20|A|2|", "2026-01-05|correct|20|A|2|"], target_seconds: 90 };
  const now = new Date("2026-01-12T10:00:00");
  const before = JSON.parse(JSON.stringify(fm));
  const normal = T.fsrs.reviewNote(fm, { correct: true, conf: 2, seconds: 20, now }, 0.9, null);
  const custom = T.fsrs.reviewNote(fm, { correct: true, conf: 2, seconds: 20, now }, 0.9, F.weightsForDecay(0.45));
  assert.notEqual(custom.days, normal.days);
  assert.deepEqual(fm, before, "the pure scheduler never rewrites the source history");
});
