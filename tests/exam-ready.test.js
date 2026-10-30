"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const NOTE = `---
question_id: exam-ready-1
answer: B
---

## Question

Which organelle carries out photosynthesis?

## Answer Choices

- A. Mitochondrion
- B. Chloroplast
- C. Nucleus
- D. Ribosome

## Answer

> **Correct Answer: B**
`;

async function setup(saved, fm = {}) {
  const app = makeApp([{ path: "Questions/exam-ready.md", fm: { question_id: "exam-ready-1", answer: "B", ...fm }, text: NOTE }]);
  const plugin = new QT(app);
  plugin.saved = saved;
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const file = app.files[0];
  await view.loadQuestion({ file, fm: file.fm }, true);
  view.render();
  return { app, plugin, dom, view, file };
}

const hasBadge = (dom) => dom.texts().some((text) => /Exam ready/.test(text));

test("exam-ready is off by default and does not change the practice screen", async () => {
  const { plugin, dom, view, file } = await setup({}, { streak: 1 });
  assert.equal(plugin.settings.examReady, false);
  assert.equal(plugin.settings.examReadyPasses, 2);
  assert.equal(hasBadge(dom), false);
  view.sel = "B";
  view.conf = 2;
  await view.submit();
  assert.equal(hasBadge(dom), false, "the badge stays hidden while the opt-in is off");
  assert.equal(file.fm.streak, 2);
});

test("the badge appears after the configured consecutive correct answers", async () => {
  const { plugin, dom, view, file } = await setup({ examReady: true }, { streak: 1 });
  assert.equal(plugin.settings.examReadyPasses, 2);
  assert.equal(hasBadge(dom), false, "the badge is a result, not a pre-answer hint");
  view.sel = "B";
  view.conf = 2;
  await view.submit();
  assert.equal(view.state, "result");
  assert.equal(file.fm.streak, 2);
  assert.ok(dom.texts().includes("Exam ready · 2 correct in a row"));
});

test("a wrong answer and a streak below the threshold never show the badge", async () => {
  const below = await setup({ examReady: true }, { streak: 0 });
  below.view.sel = "B";
  below.view.conf = 2;
  await below.view.submit();
  assert.equal(below.file.fm.streak, 1);
  assert.equal(hasBadge(below.dom), false);

  const miss = await setup({ examReady: true }, { streak: 2 });
  miss.view.sel = "A";
  miss.view.conf = 2;
  await miss.view.submit();
  assert.equal(miss.file.fm.streak, 0);
  assert.equal(hasBadge(miss.dom), false);
});

test("exam-ready settings normalize corrupt values and survive a restart", async () => {
  const app = makeApp([{ path: "Questions/q.md", fm: { answer: "B" } }]);
  const plugin = new QT(app);
  plugin.saved = { examReady: "yes", examReadyPasses: 99 };
  await plugin.onload();
  assert.equal(plugin.settings.examReady, false, "a string is not a boolean opt-in");
  assert.equal(plugin.settings.examReadyPasses, 10, "the threshold is clamped");

  plugin.settings.examReady = true;
  plugin.settings.examReadyPasses = 4;
  await plugin.save();
  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.examReady, true);
  assert.equal(restarted.settings.examReadyPasses, 4);

  restarted.saved.examReady = 1;
  restarted.saved.examReadyPasses = "nope";
  await restarted.onload();
  assert.equal(restarted.settings.examReady, false);
  assert.equal(restarted.settings.examReadyPasses, 2);
});

test("the badge changes no attempt, history, streak or next review", async () => {
  const results = [];
  for (const examReady of [false, true]) {
    const { view, file } = await setup({ examReady }, { streak: 1 });
    view.sel = "B";
    view.conf = 2;
    await view.submit();
    results.push({
      result: file.fm.result,
      attempts: file.fm.attempts,
      correct: file.fm.correct_count,
      streak: file.fm.streak,
      next: file.fm.next_review,
      history: file.fm.history.length,
    });
  }
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[1].result, "correct");
  assert.equal(results[1].attempts, 1);
  assert.equal(results[1].correct, 1);
  assert.equal(results[1].streak, 2);
  assert.equal(results[1].history, 1);
  assert.equal(T.isExamReady(2, 2), true);
  assert.equal(T.isExamReady(1, 2), false);
});
