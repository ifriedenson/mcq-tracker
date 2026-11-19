"use strict";
/*
 * Every AI question-write path must record its blind-check verdict on the
 * note (verification / verified / verified_by / verified_on / verified_answer /
 * verification_method, needs_review and a warning banner for anything but a
 * match). Hand-written Quick add notes stay clean. Cards are the documented
 * exception: a card has no letter key to check against, so card writes carry
 * no blind-check verdict.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const STATUSES = ["match", "mismatch", "error", "review"];

function verdict(status) {
  return {
    status,
    match: status === "match",
    answer: status === "match" ? "D" : "A",
    key: "D",
    model: "MatrixModel",
    date: "2026-01-01",
    method: "blind",
  };
}

const SOURCE_NOTE = [
  "---",
  "question_id: PDF-Q01",
  "question_type: mcq",
  "choices: 4",
  "answer: D",
  "answer_source: pdf",
  "explanation_source: pdf",
  "---",
  "",
  "## Question",
  "Despite being cheap, ______ they are made.",
  "",
  "## Answer Choices",
  "- A. one",
  "- B. two",
  "- C. three",
  "- D. four",
  "",
  "## Answer",
  "> [!answer]- Reveal answer",
  "> **Correct Answer: D**",
  ">",
  "> Choice D is the best answer.",
  "",
  "## My Notes",
  "",
].join("\n");

function checkStamped(fm, text, status) {
  assert.equal(fm.verification, status, `verification property (${status})`);
  assert.equal(fm.verified, status === "match", `verified flag (${status})`);
  assert.equal(fm.verified_by, "MatrixModel", `verified_by (${status})`);
  assert.equal(fm.verified_on, "2026-01-01", `verified_on (${status})`);
  assert.equal(fm.verification_method, "blind", `verification_method (${status})`);
  if (status === "match") {
    assert.equal(fm.needs_review, undefined, "a match is not marked for review");
    assert.doesNotMatch(text, /Answer check (failed|did not finish)|Answer checks disagree/);
  } else {
    assert.equal(fm.needs_review, true, `needs_review (${status})`);
    assert.match(text, /Answer check (failed|did not finish)|Answer checks disagree/, `warning banner (${status})`);
  }
}

for (const status of STATUSES) {
  test(`import finalizeNote records a ${status} blind check`, () => {
    const out = T.finalizeNote(SOURCE_NOTE, {}, "M-V01", {
      model: "M",
      date: "2026-01-01",
      verification: verdict(status),
    });
    checkStamped(T.parseNote(out).fm, out, status);
  });

  test(`quickAddNote records a ${status} blind check`, () => {
    const out = T.quickAdd.quickAddNote(
      {
        question: "Which gas do plants take in?",
        choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
        answer: "B",
        explanation: "Photosynthesis.",
        verification: verdict(status),
      },
      "M-V02"
    );
    checkStamped(T.parseNote(out).fm, out, status);
  });

  test(`transcript questionNote records a ${status} blind check`, () => {
    const out = T.transcript.questionNote(
      {
        question: "Which gas do plants take in?",
        choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
        answer: "B",
        explanation: "Photosynthesis.",
        verification: verdict(status),
      },
      { course: "Biology", title: "Lecture" },
      "M-V03",
      { model: "M", date: "2026-01-01", verification: verdict(status) }
    );
    checkStamped(T.parseNote(out).fm, out, status);
  });
}

test("quickAddNote without a verdict stays a clean hand-written note", () => {
  const out = T.quickAdd.quickAddNote(
    { question: "Which gas do plants take in?", choices: ["Oxygen", "Carbon dioxide"], answer: "B" },
    "M-V04"
  );
  const { fm } = T.parseNote(out);
  assert.equal(fm.verification, undefined);
  assert.equal(fm.verified, undefined);
  assert.equal(fm.needs_review, undefined);
  assert.doesNotMatch(out, /Answer check (failed|did not finish)|Answer checks disagree/);
});

test("verificationFields marks only a match as verified", () => {
  for (const status of STATUSES) {
    const fields = T.answerVerification.verificationFields(verdict(status));
    assert.equal(fields.verified, status === "match", `verified (${status})`);
    assert.equal(fields.verification, status, `verification (${status})`);
  }
});

test("createQuickAddQuestions writes a generated draft with its check verdict", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const result = await plugin.createQuickAddQuestions(
    [
      {
        question: "Which gas do plants take in?",
        choices: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"],
        answer: "B",
        explanation: "Photosynthesis.",
        aiGenerated: "MatrixModel",
        verification: verdict("mismatch"),
      },
    ],
    { folder: "Questions" }
  );
  assert.equal(result.created, 1);
  const written = app.created[0].text;
  checkStamped(T.parseNote(written).fm, written, "mismatch");
});

test("card writes carry no blind-check verdict (no key to check)", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const result = await plugin.importParsedCards(
    [{ front: "Front", back: "Back", deck: "D", importKey: "matrix-1" }],
    { deck: "D" }
  );
  assert.equal(result.created, 1);
  const { fm } = T.parseNote(app.created[0].text);
  assert.equal(fm.verification, undefined);
  assert.equal(fm.verified, undefined);
});
