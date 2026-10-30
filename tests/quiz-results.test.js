"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const Q = T.quizBlock;

const BLOCK = `id: planets
Q: Which planet is largest?
A. Mars
B. Jupiter
Answer: B
ID: Q1`;

async function setup(saved, block = BLOCK) {
  const app = makeApp([
    { path: "Quiz.md", noFm: true, text: `# Quiz\n\n\`\`\`mcq-quiz\n${block}\n\`\`\`\n` },
    { path: "Questions/Q1.md", fm: { question_id: "Q1", answer: "B" }, text: "---\nquestion_id: Q1\nanswer: B\n---\n\n## Question\nWhich planet?\n" },
  ]);
  const plugin = new QT(app);
  plugin.saved = saved;
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderQuizBlock(block, dom.root, { sourcePath: "Quiz.md" });
  return { app, plugin, dom, source: app.files[0], question: app.files[1] };
}

test("quiz results: block ids parse and the property shape matches Quizzable", () => {
  const parsed = Q.parseQuizBlock(BLOCK);
  assert.equal(parsed.id, "planets");
  assert.deepEqual(Q.quizResultProperties("planets", { correct: 1, total: 1, percent: 100, band: "pass" }), {
    key: "planets",
    value: { score: 1, totalPoints: 1, percentage: 100, passed: true },
  });
  assert.equal(Q.quizResultProperties("", { correct: 1, total: 1, percent: 100, band: "pass" }), null);
});

test("quiz results: export is off by default and leaves the source note untouched", async () => {
  const { plugin, dom, source } = await setup({});
  assert.equal(plugin.settings.inlineQuizResults, false);
  await dom.click("B. Jupiter");
  assert.equal(source.fm.quizResults, undefined);
});

test("quiz results: enabling the setting writes the documented result object", async () => {
  const { plugin, dom, source, question } = await setup({ inlineQuizResults: true });
  assert.equal(plugin.settings.inlineQuizResults, true);
  await dom.click("B. Jupiter");
  assert.deepEqual(source.fm.quizResults, {
    planets: { score: 1, totalPoints: 1, percentage: 100, passed: true },
  });
  assert.equal(question.fm.attempts, 1, "the linked question still records its ordinary attempt");
  assert.equal(question.fm.result, "correct");
});

test("quiz results: a partially answered quiz is not exported", async () => {
  const block = `id: two\nQ: First?\nA. No\nB. Yes\nAnswer: B\n\nQ: Second?\nA. No\nB. Yes\nAnswer: B`;
  const { dom, source } = await setup({ inlineQuizResults: true }, block);
  await dom.click("B. Yes");
  assert.equal(source.fm.quizResults, undefined);
  const buttons = dom.find("B. Yes");
  assert.equal(buttons.length, 2);
  await buttons[1].handlers.find((h) => h.ev === "click").fn({});
  assert.equal(source.fm.quizResults.two.totalPoints, 2);
  assert.equal(source.fm.quizResults.two.percentage, 100);
});

test("quiz results: corrupt settings normalize and a valid opt-in survives restart", async () => {
  const app = makeApp([{ path: "Quiz.md", noFm: true }]);
  const plugin = new QT(app);
  plugin.saved = { inlineQuizResults: "yes" };
  await plugin.onload();
  assert.equal(plugin.settings.inlineQuizResults, false);

  plugin.settings.inlineQuizResults = true;
  await plugin.save();
  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.inlineQuizResults, true);

  restarted.saved.inlineQuizResults = 1;
  await restarted.onload();
  assert.equal(restarted.settings.inlineQuizResults, false);
});
