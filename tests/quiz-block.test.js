"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

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
  assert.equal(parsed.mode, "interactive");
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

test("quiz block: slider and text questions parse with weights and tolerance", () => {
  const parsed = Q.parseQuizBlock(`pass: 80
imprecise: 60

Q: In what year was JavaScript created?
Type: slider
Min: 1980
Max: 2010
Step: 1
Tolerance: 2
Answer: 1995
Weight: 2

Q: What is the capital of France?
Type: text
Answer: Paris
Context: The city, not the country.
Weight: 1`);
  assert.equal(parsed.pass, 80);
  assert.equal(parsed.imprecise, 60);
  assert.equal(parsed.questions[0].type, "slider");
  assert.equal(parsed.questions[0].tolerance, 2);
  assert.equal(parsed.questions[0].weight, 2);
  assert.equal(parsed.questions[1].type, "text");
  assert.equal(parsed.questions[1].context, "The city, not the country.");
  assert.deepEqual(parsed.questions.map((q) => q.valid), [true, true]);
  assert.equal(Q.gradeQuizQuestion(parsed.questions[0], "1997").correct, true);
  assert.equal(Q.gradeQuizQuestion(parsed.questions[0], "1998").correct, false);
  assert.equal(Q.gradeQuizQuestion(parsed.questions[1], "paris").correct, true);
  assert.equal(Q.gradeQuizQuestion(parsed.questions[1], "Paris, France", 72).band, "imprecise");
  assert.equal(Q.gradeQuizQuestion(parsed.questions[1], "Paris, France", 72).score, 72);
});

test("quiz block: weighted score uses pass, imprecise and fail bands", () => {
  const parsed = Q.parseQuizBlock(`pass: 80
imprecise: 60
Q: Year?
Type: slider
Min: 1980
Max: 2010
Answer: 1995
Weight: 2

Q: Capital?
Type: text
Answer: Paris`);
  const score = Q.quizBlockScore(parsed.questions, { 0: "1995", 1: "London" }, parsed);
  assert.equal(score.percent, 67);
  assert.equal(score.band, "imprecise");
  assert.equal(score.answered, 2);
  assert.equal(Q.bandForScore(80, 80, 60), "pass");
  assert.equal(Q.bandForScore(60, 80, 60), "imprecise");
  assert.equal(Q.bandForScore(59, 80, 60), "fail");
});

test("quiz block: AI free-text replies parse as a score and explanation", () => {
  assert.deepEqual(Q.parseQuizAiEvaluation('{"score": 85, "explanation": "Almost there"}'), { score: 85, explanation: "Almost there" });
  assert.equal(Q.parseQuizAiEvaluation("Score: 55").score, 55);
  assert.throws(() => Q.parseQuizAiEvaluation("not a score"), /did not return a score/);
});

test("quiz block: free-text evaluation uses the configured AI path", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.aiComplete = async () => '{"score": 88, "explanation": "Close enough"}';
  const result = await plugin.evaluateQuizTextQuestion({ question: "Capital of France?", answer: "Paris", context: "City" }, "Paris, France");
  assert.equal(result.score, 88);
  assert.equal(result.explanation, "Close enough");
});

test("quiz block: slider UI renders a range and records a weighted result", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderQuizBlock("Q: Year?\nType: slider\nMin: 1980\nMax: 2010\nAnswer: 1995\nWeight: 2", dom.root);
  assert.ok(dom.texts().includes("Range 1980–2010"));
  await dom.click("Check");
  assert.ok(dom.texts().some((text) => /100% · pass/.test(text)));
});

test("quiz block: static mode renders an answer key without input controls", async () => {
  const source = `Mode: static
Q: Which gas do plants take in?
A. Oxygen
Why A: Oxygen is released, not taken in.
B. Carbon dioxide
Why B: Photosynthesis consumes carbon dioxide.
Answer: B
Why: The light reactions use CO2.`;
  const parsed = Q.parseQuizBlock(source);
  assert.equal(parsed.mode, "static");
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderQuizBlock(source, dom.root);
  assert.ok(dom.texts().includes("Answer: B"));
  assert.ok(dom.texts().includes("Oxygen is released, not taken in."));
  assert.equal(dom.find(/Check answer/).length, 0);
  assert.equal(dom.find(/Evaluate with AI/).length, 0);
});

test("quiz block: parses and renders L1-L4 cognitive levels with a per-question override", async () => {
  const source = `Mode: static
Level: L2
Q: What does photosynthesis produce?
A. Oxygen
B. Nitrogen
Answer: A

Q: Which organelle carries out photosynthesis?
Cognitive level: 4
A. Nucleus
B. Chloroplast
Answer: B

Q: What is the purpose of chlorophyll?
Level: L9
A. Absorb light
B. Store water
Answer: A`;
  const parsed = Q.parseQuizBlock(source);
  assert.deepEqual(parsed.questions.map((question) => question.level), ["L2", "L4", ""]);
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderQuizBlock(source, dom.root);
  assert.ok(dom.texts().includes("Level L2"));
  assert.ok(dom.texts().includes("Level L4"));
  assert.ok(!dom.texts().includes("Level L9"));
});
