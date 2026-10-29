"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const C = T.computedVerification;

test("a calculation that agrees with a numeric answer verifies the note", () => {
  const result = C.computedVerification({ answer: "42", calculation: "6 * 7" });
  assert.equal(result.status, "match");
  assert.equal(result.match, true);
  assert.equal(result.answer, "42");
  assert.equal(result.model, "calculation");
  assert.equal(result.method, "computed");
  assert.match(result.reason, /6 \* 7/);
});

test("a calculation that disagrees with a numeric answer is a mismatch", () => {
  const result = C.computedVerification({ answer: "41", calculation: "6 * 7" });
  assert.equal(result.status, "mismatch");
  assert.equal(result.match, false);
  assert.equal(result.answer, "42");
  assert.equal(result.key, "41");
  assert.equal(result.drop, false);
});

test("a calculation without a stored answer supplies the answer", () => {
  const result = C.computedVerification({ calculation: "1 / 2" });
  assert.equal(result.status, "match");
  assert.equal(result.answer, "0.5");
  assert.equal(result.key, "");
});

test("non-numeric answers are left to the existing verifier", () => {
  assert.equal(C.computedVerification({ answer: "B", calculation: "6 * 7" }), null);
  assert.equal(C.computedVerification({ answer: "mitochondria", calculation: "6 * 7" }), null);
  assert.equal(C.computedVerification({ answer: "42" }), null);
});

test("a malformed calculation is an error, not a silent pass", () => {
  const result = C.computedVerification({ answer: "42", calculation: "6 *" });
  assert.equal(result.status, "error");
  assert.match(result.error, /incomplete|Expected|formula/i);
});

test("a parameterized formula uses the recorded variant values", () => {
  const fm = {
    variables: { a: "2..9", b: "1..9" },
    answer_formula: "(a + b) * 2",
    last_variant: "a=3;b=4",
    answer: "14",
  };
  const result = C.computedVerification(fm);
  assert.equal(result.status, "match");
  assert.equal(result.answer, "14");
  const wrong = C.computedVerification({ ...fm, answer: "15" });
  assert.equal(wrong.status, "mismatch");
});

test("AI and calculated checks are merged conservatively", () => {
  const match = { status: "match", answer: "42", key: "42", model: "model", method: "ai" };
  const computed = { status: "match", answer: "42", key: "42", model: "calculation", method: "computed" };
  const merged = C.mergeVerification({ ...match, status: "mismatch", answer: "41" }, computed);
  assert.equal(merged.status, "review");
  assert.equal(merged.match, false);
  assert.equal(merged.ai_answer, "41");
  assert.match(merged.error, /AI check disagreed/);
  assert.match(T.answerVerification.verificationBanner(merged), /Answer checks disagree/);
  assert.equal(C.mergeVerification(match, null), match);
  assert.equal(C.mergeVerification(null, computed).model, "calculation");
});

test("finalizing an imported note applies the computed check and writes the warning", () => {
  const text = [
    "---",
    "question_id: q",
    "answer: 41",
    "answer_source: ai",
    "calculation: 6 * 7",
    "---",
    "",
    "## Question",
    "What is 6 times 7?",
    "",
  ].join("\n");
  const out = T.finalizeNote(text, {}, "q", { date: "2026-10-29", model: "test-model" });
  assert.match(out, /verification: mismatch/);
  assert.match(out, /verification_method: computed/);
  assert.match(out, /needs_review: true/);
  assert.match(out, /Calculation check failed/);
  assert.match(out, /A calculation gives 42/);
  const good = T.finalizeNote(text.replace("answer: 41", "answer: 42"), {}, "q", { date: "2026-10-29", model: "test-model" });
  assert.match(good, /verification: match/);
  assert.match(good, /verified: true/);
  assert.doesNotMatch(good, /Calculation check failed/);
});

test("plugin: verifying a note by calculation writes properties and a warning", async () => {
  const text = [
    "---",
    "question_id: calc",
    "answer: 41",
    "calculation: 6 * 7",
    "---",
    "",
    "## Question",
    "What is 6 times 7?",
    "",
  ].join("\n");
  const app = makeApp([
    {
      path: "Questions/calc.md",
      fm: { question_id: "calc", answer: "41", calculation: "6 * 7" },
      text,
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const result = await plugin.verifyAnswerByCalculation("Questions/calc.md");
  assert.equal(result.status, "mismatch");
  assert.equal(app.files[0].fm.verification, "mismatch");
  assert.equal(app.files[0].fm.verification_method, "computed");
  assert.equal(app.files[0].fm.needs_review, true);
  assert.match(app.files[0].text, /Calculation check failed/);
  assert.match(app.files[0].text, /A calculation gives 42/);
});

test("computed verification fields preserve a numeric answer and mark the method", () => {
  const fields = T.answerVerification.verificationFields({
    status: "mismatch",
    answer: "42",
    key: "41",
    model: "calculation",
    method: "computed",
    date: "2026-10-29",
  });
  assert.equal(fields.verified, false);
  assert.equal(fields.verified_by, "calculation");
  assert.equal(fields.verification_method, "computed");
  assert.equal(fields.verified_answer, "42");
  assert.match(T.answerVerification.verificationBanner({ ...fields, method: "computed", status: "mismatch", key: "41", answer: "42" }), /calculation gives 42/);
});

test("plugin: a bulk calculation preview writes nothing and applies only checked notes", async () => {
  const note = (id, answer) => ({
    path: `Questions/${id}.md`,
    fm: { question_id: id, answer, calculation: "6 * 7" },
    text: `---\nquestion_id: ${id}\nanswer: ${answer}\ncalculation: 6 * 7\n---\n\n## Question\nWhat is 6 times 7?\n`,
  });
  const app = makeApp([note("good", "42"), note("bad", "41")]);
  const plugin = new QT(app);
  await plugin.onload();

  const preview = await plugin.previewCalculationVerification();
  assert.equal(preview.checked, 2);
  assert.equal(preview.items.length, 2);
  assert.equal(app.files[0].fm.verification, undefined, "preview leaves the note untouched");
  assert.equal(app.files[1].fm.verification, undefined);

  const result = await plugin.applyCalculationPreview(preview.items, ["Questions/good.md"]);
  assert.deepEqual(result.applied, ["Questions/good.md"]);
  assert.deepEqual(result.conflicts, []);
  assert.equal(app.files[0].fm.verification, "match");
  assert.equal(app.files[1].fm.verification, undefined, "unchecked notes are not written");
});

test("plugin: a bulk calculation check skips a note edited during review", async () => {
  const app = makeApp([
    {
      path: "Questions/calc.md",
      fm: { question_id: "calc", answer: "41", calculation: "6 * 7" },
      text: "---\nquestion_id: calc\nanswer: 41\ncalculation: 6 * 7\n---\n\n## Question\nWhat is 6 times 7?\n",
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const preview = await plugin.previewCalculationVerification();
  app.files[0].text += "\nuser edit during review\n";

  const result = await plugin.applyCalculationPreview(preview.items, ["Questions/calc.md"]);
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.conflicts, ["Questions/calc.md"]);
  assert.equal(app.files[0].fm.verification, undefined);
});
