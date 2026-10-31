"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const W = T.studyWorkspace;

test("vocab stats: media and counters normalize with safe caps", () => {
  const word = W.createVocabWord(
    { term: "osmosis", definition: "Water movement", media: "![[osmosis.png]]", reviews: 4, correct: 9, streak: 2, lapses: 1, lastGrade: "good" },
    1000
  );
  assert.equal(word.media, "![[osmosis.png]]");
  assert.equal(word.correct, 4);
  assert.equal(word.streak, 2);
  assert.equal(word.lapses, 1);
  assert.equal(word.lastGrade, "good");
  assert.equal(W.createVocabWord({ term: "x", definition: "y", lastGrade: "bogus" }, 1).lastGrade, "");
});

test("vocab stats: ratings update accuracy, streak and lapses", () => {
  let word = W.createVocabWord({ term: "ATP", definition: "Energy currency" }, 1);
  word = W.reviewVocabWord(word, "good", "2026-10-01");
  assert.equal(word.reviews, 1);
  assert.equal(word.correct, 1);
  assert.equal(word.streak, 1);
  assert.equal(word.due, "2026-10-02");
  word = W.reviewVocabWord(word, "again", "2026-10-02");
  assert.equal(word.reviews, 2);
  assert.equal(word.correct, 1);
  assert.equal(word.streak, 0);
  assert.equal(word.lapses, 1);
  word = W.reviewVocabWord(word, "easy", "2026-10-03");
  assert.equal(word.reviews, 3);
  assert.equal(word.correct, 2);
  assert.equal(word.streak, 1);
  assert.equal(word.due, "2026-10-10");
});

test("vocab stats: bulk import accepts an optional media column", () => {
  const parsed = W.parseVocabLines("ATP | energy currency | powers cells | ![[atp.png]]\nosmosis | water movement | in roots");
  assert.equal(parsed.words.length, 2);
  assert.equal(parsed.words[0].media, "![[atp.png]]");
  assert.equal(parsed.words[0].example, "powers cells");
  assert.equal(parsed.words[1].media, undefined);
  assert.equal(parsed.words[1].example, "in roots");
  const summary = W.vocabSummary([
    W.createVocabWord({ term: "a", definition: "b", reviews: 4, correct: 3 }, 1),
    W.createVocabWord({ term: "c", definition: "d" }, 2),
  ], "2026-10-01");
  assert.equal(summary.total, 2);
  assert.equal(summary.learned, 1);
  assert.equal(summary.correct, 3);
  assert.equal(summary.accuracy, 75);
});

test("vocab stats: the plugin stores media and exposes it in settings", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const word = await plugin.addVocabWord({ term: "osmosis", definition: "Water movement", media: "![[osmosis.png]]" });
  assert.equal(word.media, "![[osmosis.png]]");
  assert.equal(plugin.settings.vocabulary.words[0].media, "![[osmosis.png]]");
  const imported = await plugin.importVocabWords("ATP | energy currency | | ![[atp.png]]");
  assert.equal(imported.count, 1);
  assert.equal(plugin.settings.vocabulary.words.some((entry) => entry.media === "![[atp.png]]"), true);
});
