"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const classify = T.documentClassify;

const MCQ = [
  "Section I: Multiple Choice",
  "1. Which process makes gametes?",
  "A. mitosis",
  "B. meiosis",
  "C. binary fission",
  "D. budding",
  "2. Which phase comes after metaphase?",
  "A. prophase",
  "B. anaphase",
  "C. telophase",
  "D. interphase",
  "Answer Key",
  "1. B",
  "2. B",
].join("\n");

const FRQ = [
  "Free Response Question",
  "1. Explain how crossing over changes genetic variation. (6 points possible)",
  "Show your work and use evidence from the model.",
  "Scoring Guidelines",
  "Rubric: one point for identifying the exchange, one point for explaining variation.",
].join("\n");

const CARDS = [
  "Cell membrane: controls what enters and leaves the cell",
  "Mitochondria: makes ATP",
  "Ribosome: builds proteins",
  "Nucleus: stores DNA",
  "Chloroplast: carries out photosynthesis",
  "Vacuole: stores water and solutes",
].join("\n");

const NOTES = [
  "# Cell division",
  "",
  "Mitosis produces two identical cells and supports growth and repair.",
  "Meiosis produces gametes with half the usual chromosome number.",
  "The cell cycle has checkpoints that stop damaged cells from dividing.",
].join("\n");

test("document classification: MCQ pages need choices and numbered questions", () => {
  const result = classify.classifyText(MCQ);
  assert.equal(result.kind, "mcq");
  assert.ok(result.counts.choices >= 8);
  assert.ok(result.counts.questions >= 2);
  assert.ok(result.reasons.some((reason) => /answer-choice/.test(reason)));
});

test("document classification: rubric and free-response language become FRQ", () => {
  const result = classify.classifyText(FRQ);
  assert.equal(result.kind, "frq");
  assert.ok(result.counts.frqSignals >= 2);
});

test("document classification: short term/definition lists become cards", () => {
  const result = classify.classifyText(CARDS);
  assert.equal(result.kind, "cards");
  assert.ok(result.counts.cardLines >= 5);
});

test("document classification: prose without question markers is course notes", () => {
  const result = classify.classifyText(NOTES);
  assert.equal(result.kind, "notes");
  assert.equal(result.confidence, "medium");
});

test("document classification: a packet with both sections is mixed, page by page", () => {
  const result = classify.classifyDocument([
    { n: 1, text: MCQ },
    { n: 2, text: FRQ },
    { n: 3, text: NOTES },
  ]);
  assert.equal(result.kind, "mixed");
  assert.deepEqual(result.pageResults.map((page) => page.kind), ["mcq", "frq", "notes"]);
  assert.equal(result.counts.pages, 3);
});

test("document classification: empty text is not guessed as a question type", () => {
  const result = classify.classifyDocument([{ n: 1, text: "   " }]);
  assert.equal(result.counts.pages, 0);
  assert.equal(result.kind, "notes");
  assert.equal(result.confidence, "low");
});
