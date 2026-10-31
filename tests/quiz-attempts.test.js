"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const W = T.studyWorkspace;

const NOTE = [
  "```mcq-quiz",
  "Id: biology-1",
  "Q: Which gas do plants take in?",
  "A. Oxygen",
  "B. Carbon dioxide",
  "Answer: B",
  "```",
  "",
  "```mcq-quiz",
  "Id: biology-2",
  "Q: What is ATP?",
  "A. Energy currency",
  "B. A protein",
  "Answer: A",
  "```",
].join("\n");

test("quiz attempts: build a per-question log and normalize it", () => {
  const first = W.buildQuizAttempt(
    "Biology/Quiz.md",
    "biology-1",
    [
      { question: "Which gas do plants take in?", valid: true },
      { question: "What is ATP?", valid: true },
      { question: "Broken question", valid: false },
    ],
    { 0: { correct: true }, 1: { correct: false } },
    1000
  );
  assert.equal(first.total, 2);
  assert.equal(first.correct, 1);
  assert.equal(first.percentage, 50);
  assert.equal(first.topic, "Biology");
  assert.deepEqual(first.missed, ["What is ATP?"]);
  assert.equal(W.normalizeQuizIndex({ recordAttempts: true, attempts: [first] }).attempts.length, 1);
  assert.equal(W.normalizeQuizIndex({ attempts: [first] }).recordAttempts, false);
});

test("quiz attempts: the index aggregates first-attempt, topic and wrong-answer stats", () => {
  const first = W.buildQuizAttempt(
    "Biology/Quiz.md",
    "biology-1",
    [
      { question: "Which gas do plants take in?", valid: true },
      { question: "What is ATP?", valid: true },
    ],
    { 0: { correct: true }, 1: { correct: false } },
    1000
  );
  const second = W.buildQuizAttempt(
    "Biology/Quiz.md",
    "biology-1",
    [
      { question: "Which gas do plants take in?", valid: true },
      { question: "What is ATP?", valid: true },
    ],
    { 0: { correct: true }, 1: { correct: true } },
    2000
  );
  const index = W.collectQuizIndex([{ path: "Biology/Quiz.md", text: NOTE, fm: {} }], { attempts: [first, second] });
  assert.equal(index.stats.attempts, 2);
  assert.equal(index.stats.firstAttempt, 50);
  assert.deepEqual(index.stats.topics, [{ topic: "Biology", correct: 3, total: 4, percentage: 75 }]);
  assert.deepEqual(index.stats.wrongAnswers, [{ question: "What is ATP?", count: 1 }]);
  const row = index.rows.find((entry) => entry.id === "biology-1");
  assert.equal(row.attempts, 2);
  assert.equal(row.firstAttempt, 50);
  assert.equal(row.lastAttempt, 100);
  assert.equal(index.rows.find((entry) => entry.id === "biology-2").attempts, 0);
});

test("quiz attempts: the plugin records only when the opt-in is on", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const questions = [{ question: "What is ATP?", valid: true }];
  const selections = { 0: { correct: true } };

  assert.equal(await plugin.recordInlineQuizAttempt("Biology/Quiz.md", "biology-1", questions, selections), null);
  assert.equal((plugin.settings.quizIndex.attempts || []).length, 0);

  plugin.settings.quizIndex.recordAttempts = true;
  const attempt = await plugin.recordInlineQuizAttempt("Biology/Quiz.md", "biology-1", questions, selections);
  assert.equal(attempt.correct, 1);
  assert.equal(plugin.settings.quizIndex.attempts.length, 1);
  assert.equal(plugin.settings.quizIndex.attempts[0].path, "Biology/Quiz.md");

  plugin.settings.quizIndex.recordAttempts = false;
  assert.equal(await plugin.recordInlineQuizAttempt("Biology/Quiz.md", "biology-1", questions, selections), null);
  assert.equal(plugin.settings.quizIndex.attempts.length, 1);
});
