"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const Q = T.quizBlock;

const BLOCK = `gated: true
Q: Which gas do plants take in?
A. Oxygen
Why A: Oxygen is released, not taken in.
B. Carbon dioxide
Why B: Photosynthesis consumes carbon dioxide.
Answer: B
Why: The light reactions use CO2.
ID: Q1

Q: Which organelle makes ATP?
A. Nucleus
B. Mitochondrion
Answer: B
Why: Mitochondria carry out oxidative phosphorylation.`;

test("quiz block: parses gated questions, ids and per-option feedback", () => {
  const parsed = Q.parseQuizBlock(BLOCK);
  assert.equal(parsed.gated, true);
  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.questions[0].id, "Q1");
  assert.equal(parsed.questions[0].answer, "B");
  assert.equal(parsed.questions[0].choices[0].feedback, "Oxygen is released, not taken in.");
  assert.equal(parsed.questions[1].answer, "B");
  assert.deepEqual(parsed.questions.map((q) => q.valid), [true, true]);
});

test("quiz block: grades choices and marks every option with its own feedback", () => {
  const [first] = Q.parseQuizBlock(BLOCK).questions;
  const right = Q.gradeQuizBlockQuestion(first, "B");
  assert.equal(right.correct, true);
  assert.equal(right.key, "B");
  assert.deepEqual(right.options.map((o) => o.correct), [false, true]);
  assert.equal(right.options[0].feedback, "Oxygen is released, not taken in.");
  assert.equal(right.explanation, "The light reactions use CO2.");
  assert.equal(Q.gradeQuizBlockQuestion(first, "A").correct, false);
});

test("quiz block: select-all answers compare as a set", () => {
  const parsed = Q.parseQuizBlock(`Q: Pick the gases.\nA. Oxygen\nB. Nitrogen\nC. Sugar\nAnswer: A, B`);
  const q = parsed.questions[0];
  assert.equal(q.answer, "A, B");
  assert.equal(Q.gradeQuizBlockQuestion(q, "B, A").correct, true);
  assert.equal(Q.gradeQuizBlockQuestion(q, "A").correct, false);
});

test("quiz block: gating reveals one question until the previous one is answered", () => {
  assert.equal(Q.visibleQuizCount(3, 0, true), 1);
  assert.equal(Q.visibleQuizCount(3, 1, true), 2);
  assert.equal(Q.visibleQuizCount(3, 0, false), 3);
  assert.equal(Q.visibleQuizCount(3, 5, true), 3);
});

test("quiz block: malformed questions explain themselves instead of throwing", () => {
  const parsed = Q.parseQuizBlock(`Q: No key here\nA. One\nB. Two`);
  assert.equal(parsed.questions[0].valid, false);
  assert.match(parsed.questions[0].issues.join(" "), /no Answer line/);
  assert.doesNotThrow(() => Q.quizBlockScore(parsed.questions, {}));
});

test("quiz block: a linked ID records through the ordinary attempt scheduler", async () => {
  const app = makeApp([{ path: "Questions/Q1.md", fm: { question_id: "Q1" }, text: "---\nquestion_id: Q1\n---\n\n## Question\nWhich gas?\n" }]);
  const plugin = new QT(app);
  await plugin.onload();
  const [first] = Q.parseQuizBlock(BLOCK).questions;
  const result = Q.gradeQuizBlockQuestion(first, "B");
  const summary = await plugin.recordQuizBlockAnswer(first, result, 4);
  assert.equal(summary.attempts, 1);
  assert.equal(summary.correctCount, 1);
  assert.ok(summary.nextReview);
  assert.equal(app.files[0].fm.attempts, 1);
  assert.equal(app.files[0].fm.result, "correct");
});

test("quiz block: the code block and review command are registered", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  assert.ok(plugin.codeBlocks["mcq-quiz"]);
  assert.ok(plugin.commands.some((command) => command.id === "review-notes"));
});
