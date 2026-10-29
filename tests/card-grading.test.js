"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const grading = T.cardGrading;

test("typed grading: exact matches ignore case, punctuation, accents and leading articles at standard strictness", () => {
  assert.equal(grading.gradeTypedAnswer("Cell division.", "cell division").verdict, "correct");
  assert.equal(grading.gradeTypedAnswer("The basic unit of life.", "basic unit of life").verdict, "correct");
  assert.equal(grading.gradeTypedAnswer("café", "cafe").verdict, "correct");
  assert.equal(grading.gradeTypedAnswer("café", "cafe", { strictness: "strict" }).verdict, "incorrect");
});

test("typed grading: accepted variants and cloze alternatives count as correct", () => {
  const variant = grading.gradeTypedAnswer("to speak", "speak", { variants: ["speak", "talk"] });
  assert.equal(variant.verdict, "correct");
  assert.equal(variant.matchedBy, "variant");
  const cloze = grading.gradeTypedAnswer("Paris · France", "France");
  assert.equal(cloze.verdict, "correct");
});

test("typed grading: small typos are accepted at standard and lenient levels", () => {
  assert.equal(grading.gradeTypedAnswer("cell division", "cell divisoin").verdict, "correct");
  assert.equal(grading.gradeTypedAnswer("mitochondria", "mitocondria").verdict, "correct");
});

test("typed grading: numeric answers compare with a small tolerance", () => {
  assert.equal(grading.gradeTypedAnswer("6.022", "6.0220").verdict, "correct");
  assert.equal(grading.gradeTypedAnswer("6.022", "7.0", { strictness: "lenient" }).verdict, "incorrect");
});

test("typed grading: partial keyword coverage is a partial result with the missing words", () => {
  const result = grading.gradeTypedAnswer("The mitochondria is the powerhouse of the cell", "mitochondria powerhouse");
  assert.equal(result.verdict, "partial");
  assert.ok(result.missing.includes("cell"));
  assert.equal(result.suggestedGrade, "hard");
});

test("typed grading: empty and unrelated answers are incorrect", () => {
  assert.equal(grading.gradeTypedAnswer("cell", "").verdict, "incorrect");
  assert.equal(grading.gradeTypedAnswer("cell", "photosynthesis").verdict, "incorrect");
});
