"use strict";
// The Learn, Test and Match variants of the optional Quizlet-style study skin.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.studySkin;

const NOTES = [
  {
    path: "Questions/one.md",
    fm: { question_id: "one", answer: "B" },
    text: `---
question_id: one
answer: B
---

## Question
Question one?

## Answer Choices
- A. alpha
- B. beta
- C. gamma
- D. delta

## Answer
> [!answer]- Reveal answer
> **Correct Answer: B**
>
> Beta is correct.
`,
  },
  {
    path: "Questions/two.md",
    fm: { question_id: "two", answer: "C" },
    text: `---
question_id: two
answer: C
---

## Question
Question two?

## Answer Choices
- A. alpha
- B. beta
- C. gamma
- D. delta

## Answer
> [!answer]- Reveal answer
> **Correct Answer: C**
>
> Gamma is correct.
`,
  },
];

async function setup() {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  return { app, plugin, dom, view };
}

test("study modes: labels, normalization and the learn repeat rule", () => {
  assert.equal(S.normalizeStudyMode(undefined), "cards");
  assert.equal(S.normalizeStudyMode("LEARN"), "learn");
  assert.equal(S.normalizeStudyMode("bogus"), "cards");
  assert.equal(S.STUDY_MODE_LABELS.test, "Test");
  assert.equal(S.STUDY_MODE_LABELS.match, "Match");
  assert.equal(S.studyModeLabel("test"), "Test");
  assert.equal(S.shouldRepeatStudyCard("learn", false, false), true);
  assert.equal(S.shouldRepeatStudyCard("learn", true, false), false);
  assert.equal(S.shouldRepeatStudyCard("learn", false, true), false);
  assert.equal(S.shouldRepeatStudyCard("cards", false, false), false);
  assert.equal(S.shouldRepeatStudyCard("test", false, false), false);
});

test("study modes: match pairs need a prompt and an answer, are clipped, deduped and capped", () => {
  const make = (path, key, question, choices) => ({ file: { path }, key, sections: { question, choices } });
  const cards = [
    make("Q/one.md", "B", "Question one?", [{ letter: "A", text: "alpha" }, { letter: "B", text: "beta" }]),
    make("Q/two.md", "", "Question two?", []),
    make("Q/three.md", "C", "   ", [{ letter: "C", text: "gamma" }]),
    make("Q/one.md", "B", "Question one again?", [{ letter: "B", text: "beta" }]),
  ];
  const pairs = S.buildMatchPairs(cards, 6);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].id, "Q/one.md");
  assert.equal(pairs[0].front, "Question one?");
  assert.equal(pairs[0].back, "B. beta");
  assert.equal(S.clipStudyText("x".repeat(200), 20).length, 20);
  assert.equal(S.clipStudyText("  a   b  ", 20), "a b");
});

test("study modes: shuffling copies the list and stays deterministic with a seeded random", () => {
  const pairs = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const out = S.shufflePairs(pairs, () => 0);
  assert.deepEqual(out.map((p) => p.id), ["b", "c", "a"]);
  assert.deepEqual(pairs.map((p) => p.id), ["a", "b", "c"]);
});

test("study modes: Learn requeues a missed card once in the same session", async () => {
  const { plugin, dom, view } = await setup();
  plugin.settings.studySkin = "flip";
  plugin.settings.studyMode = "learn";
  plugin.recorded = [];
  plugin.recordAttempt = async (file, attempt) => {
    plugin.recorded.push([file.path, attempt]);
    return { nextReview: "2026-11-05", streak: 0, attempts: 1, correctCount: 0 };
  };

  await view.startStudySkin();
  const first = view.study.card.file.path;
  assert.equal(view.study.queue.length, 2);

  view.render();
  assert.ok(dom.texts().includes("Learn"));
  await dom.click("Show answer");
  await dom.click("Still learning");
  assert.equal(view.study.queue.length, 3);
  assert.deepEqual(view.study.repeats, [first]);
  assert.equal(view.study.results.length, 1);
  assert.equal(view.study.results[0].correct, false);

  await view.nextStudyCard();
  assert.notEqual(view.study.card.file.path, first);
  await view.nextStudyCard();
  assert.equal(view.study.card.file.path, first);
  await view.nextStudyCard();
  assert.equal(view.state, "study-summary");
});

test("study modes: Test hides feedback until the end and reports a scored list", async () => {
  const { plugin, dom, view } = await setup();
  plugin.settings.studySkin = "choice";
  plugin.settings.studyMode = "test";
  plugin.recorded = [];
  plugin.recordAttempt = async (file, attempt) => {
    plugin.recorded.push([file.path, attempt]);
    return { nextReview: "2026-11-05", streak: 0, attempts: 1, correctCount: 0 };
  };

  await view.startStudySkin();
  view.render();
  await dom.click("A");
  await dom.click("Submit answer");
  assert.equal(view.study.revealed, false, "no feedback during the test");
  assert.equal(view.study.index, 1);
  assert.equal(plugin.recorded.length, 1);

  view.render();
  await dom.click("A");
  await dom.click("Submit answer");
  assert.equal(view.state, "study-summary");
  assert.equal(view.study.results.length, 2);
  assert.deepEqual(view.study.results.map((row) => row.correct), [false, false]);

  view.render();
  const texts = dom.texts();
  assert.ok(texts.includes("Test complete"));
  assert.ok(texts.some((text) => text.includes("0 of 2 recalled")));
  assert.ok(texts.includes("Question one?"));
  assert.ok(texts.some((text) => text.includes("Correct: B")));
});

test("study modes: Match records one review per pair and ignores wrong taps", async () => {
  const { app, plugin } = await setup();
  const cards = [
    await T.loadQuestionData(plugin, plugin.getQuestions()[0]),
    await T.loadQuestionData(plugin, plugin.getQuestions()[1]),
  ];
  const pairs = S.buildMatchPairs(cards, 6);
  assert.equal(pairs.length, 2);
  plugin.recorded = [];
  plugin.recordAttempt = async (file, attempt) => {
    plugin.recorded.push([file.path, attempt]);
    return { nextReview: "2026-11-05" };
  };

  const modal = new T.StudyMatchModal(app, plugin, pairs, {});
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.draw();

  await dom.click("Question one?");
  assert.equal(modal.selected, pairs[0].id);
  await dom.click(pairs[1].back);
  assert.equal(modal.tries, 1);
  assert.equal(modal.matched.length, 0);
  assert.equal(plugin.recorded.length, 0, "a wrong tap never records an attempt");

  await dom.click(pairs[0].back);
  assert.equal(modal.matched.length, 1);
  assert.equal(plugin.recorded.length, 1);
  assert.equal(plugin.recorded[0][1].correct, true);
  assert.equal(plugin.recorded[0][1].chosen, "match");
  assert.equal(plugin.recorded[0][1].conf, 2);
});
