"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const Q = T.quizMaker;

const PACK = `Pack: Biology warmup
Type: assertion
Assertion: Plants release oxygen.
Reason: Oxygen is a product of photosynthesis.
Answer: explains
Why: The reason is the mechanism behind the assertion.
---
Type: correction
Statement: The mitochondria is the powerhouse of the cell.
Answer: mitochondrion
Why: Mitochondria is plural; one organelle is a mitochondrion.
---
Type: evidence
Question: Which result supports osmosis?
A. Water moved across the membrane.
B. Starch stayed inside.
Answer: A
Why: Osmosis is water movement.
---
Type: branch
Scenario: A cell is placed in pure water.
A. Water enters; the cell swells. => The cell may lyse.
B. Water leaves; the cell shrinks. => That happens in a hypertonic solution.`;

test("quiz maker: parses a named pack with all four formats", () => {
  const parsed = Q.parseQuizMakerBlock(PACK);
  assert.equal(parsed.pack, "Biology warmup");
  assert.equal(parsed.questions.length, 4);
  assert.deepEqual(parsed.questions.map((question) => question.type), ["assertion", "correction", "evidence", "branch"]);
  assert.equal(parsed.questions[0].answer, "explains");
  assert.match(parsed.questions[0].reason, /photosynthesis/);
  assert.equal(parsed.questions[2].answer, "A");
  assert.equal(parsed.questions[3].outcomes.A, "The cell may lyse.");
  assert.equal(parsed.issues.length, 0);
});

test("quiz maker: grades each format locally and leaves branching unscored", () => {
  const parsed = Q.parseQuizMakerBlock(PACK);
  assert.equal(Q.gradeQuizMakerQuestion(parsed.questions[0], "explains").correct, true);
  assert.equal(Q.gradeQuizMakerQuestion(parsed.questions[0], "both-false").correct, false);
  assert.equal(Q.gradeQuizMakerQuestion(parsed.questions[1], "Mitochondrion.").correct, true);
  assert.equal(Q.gradeQuizMakerQuestion(parsed.questions[1], "nucleus").correct, false);
  assert.equal(Q.gradeQuizMakerQuestion(parsed.questions[2], "A").correct, true);
  assert.equal(Q.gradeQuizMakerQuestion(parsed.questions[2], "B").correct, false);
  const branch = Q.gradeQuizMakerQuestion(parsed.questions[3], "A");
  assert.equal(branch.correct, null);
  assert.match(branch.outcome, /lyse/);
});

test("quiz maker: malformed questions explain themselves and the switch gates the block", async () => {
  const parsed = Q.parseQuizMakerBlock("Type: assertion\nAssertion: Only a claim.");
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].valid, false);
  assert.match(parsed.issues.join(" "), /Reason/);
  assert.match(parsed.issues.join(" "), /Answer/);

  const plugin = new QT(makeApp([]));
  await plugin.onload();
  assert.equal(plugin.quizMakerEnabled(), true);
  plugin.settings.quizMaker.enabled = false;
  assert.equal(plugin.quizMakerEnabled(), false);

  const dom = makeDom();
  Q.renderQuizMakerBlock(null, PACK, dom.root, {});
  assert.ok(dom.texts().includes("Quiz Maker · Biology warmup"));
  assert.ok(dom.texts().some((text) => /Assertion and reason/.test(text)));
  await dom.click("Both are true; the reason explains the assertion.");
  assert.ok(dom.texts().includes("Correct"));
});
