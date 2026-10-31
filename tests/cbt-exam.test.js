"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const C = T.cbtExam;

const EXAM = `Exam: Biology midterm
Time: 30
---
Q: Which organelle produces most ATP?
Topic: Cells
A. Mitochondrion
B. Nucleus
Answer: A
Why: Oxidative phosphorylation happens in the inner membrane.
---
Q: What does a catalyst do?
Topic: Reactions
A. Raises activation energy
B. Lowers activation energy
Answer: B`;

test("cbt exam: parses the exam header, questions, topics and keys", () => {
  const parsed = C.parseCbtExamBlock(EXAM);
  assert.equal(parsed.title, "Biology midterm");
  assert.equal(parsed.minutes, 30);
  assert.equal(parsed.questions.length, 2);
  assert.deepEqual(parsed.questions.map((question) => question.answer), ["A", "B"]);
  assert.deepEqual(parsed.questions.map((question) => question.topic), ["Cells", "Reactions"]);
  assert.equal(parsed.issues.length, 0);
  assert.equal(new Set(parsed.questions.map((question) => question.id)).size, 2);
});

test("cbt exam: grades answers and summarizes topics and missed questions", () => {
  const parsed = C.parseCbtExamBlock(EXAM);
  const [first, second] = parsed.questions;
  assert.equal(C.gradeCbtQuestion(first, "A").correct, true);
  assert.equal(C.gradeCbtQuestion(first, "B").correct, false);
  const summary = C.summarizeCbtAttempt(parsed, { [first.id]: "A" }, { now: 1700000000000, durationMs: 90000 });
  assert.equal(summary.score, 1);
  assert.equal(summary.total, 2);
  assert.equal(summary.percentage, 50);
  assert.deepEqual(summary.missed, [second.id]);
  assert.deepEqual(summary.topics.Cells, { correct: 1, total: 1 });
  assert.deepEqual(summary.topics.Reactions, { correct: 0, total: 1 });
  const adaptive = C.adaptiveCbtOrder(parsed, summary.missed);
  assert.equal(adaptive[0], second.id);
  assert.equal(adaptive.length, 2);
});

test("cbt exam: malformed questions report issues and history normalizes", () => {
  const parsed = C.parseCbtExamBlock("Q: Only a question\nA. One choice\nAnswer: C");
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].valid, false);
  assert.match(parsed.issues.join(" "), /at least two/);
  assert.match(parsed.issues.join(" "), /Answer: letter/);

  const settings = C.normalizeCbtExamSettings({
    enabled: false,
    history: {
      "note::exam": [
        { at: 10, score: 1, total: 2, percentage: 50, missed: ["q1"], topics: { Cells: { correct: 1, total: 2 } } },
        { at: 11, score: 9, total: 2, percentage: 900, missed: [], topics: {} },
        { bad: true },
      ],
    },
  });
  assert.equal(settings.enabled, false);
  assert.equal(settings.history["note::exam"].length, 2);
  assert.equal(settings.history["note::exam"][1].score, 2);
  assert.equal(settings.history["note::exam"][1].percentage, 100);
});

test("cbt exam: the navigator, submit, score and switch work", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  assert.equal(plugin.cbtExamEnabled(), true);
  plugin.settings.cbtExam.enabled = false;
  assert.equal(plugin.cbtExamEnabled(), false);
  plugin.settings.cbtExam.enabled = true;

  const dom = makeDom();
  C.renderCbtExamBlock(plugin, EXAM, dom.root, { sourcePath: "Biology/Midterm.md" });
  assert.ok(dom.texts().includes("CBT Exam · Biology midterm"));
  assert.ok(dom.texts().some((text) => /0 answered/.test(text)));
  await dom.click("A. Mitochondrion");
  assert.ok(dom.texts().some((text) => /1 answered/.test(text)));
  await dom.click("Submit exam");
  assert.ok(dom.texts().some((text) => /1 \/ 2 · 50%/.test(text)));
  assert.ok(dom.texts().some((text) => /Cells 1\/1/.test(text)));
  assert.deepEqual(plugin.settings.cbtExam.history["Biology/Midterm.md::Biology midterm"].map((attempt) => attempt.score), [1]);
  await dom.click("Adaptive review (missed first)");
  assert.ok(dom.texts().some((text) => /adaptive review/.test(text)));
});
