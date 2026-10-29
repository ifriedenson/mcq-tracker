"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();

const N = T.numericGrading;

function grade(fm, chosen) {
  return N.gradeNumeric({ question_type: "spr", ...fm }, chosen);
}

test("numeric answers accept fractions, decimals, scientific notation and percentages", () => {
  for (const form of ["3/4", "0.75", "7.5e-1", "7.5 × 10⁻¹", "75%", "0.750"]) {
    assert.equal(grade({ answer: "0.75" }, form).correct, true, form);
  }
  assert.equal(grade({ answer: "1 1/2" }, "1.5").correct, true);
  assert.equal(grade({ answer: "-3/4" }, "-0.75").correct, true);
  assert.equal(grade({ answer: "0.75" }, "3/4").interpreted, "Read as 3/4 = 0.75");
  assert.equal(grade({ answer: "0.75" }, "75%").interpreted, "Read as 75% (0.75)");
});

test("a numeric answer still falls back to exact text for word answers", () => {
  assert.equal(grade({ answer: "mitochondria" }, " Mitochondria ").correct, true);
  const wrong = grade({ answer: "mitochondria" }, "mitochondrion");
  assert.equal(wrong.correct, false);
  assert.match(wrong.reason, /stored answer is text/);
});

test("absolute, relative and percentage tolerances are applied per question", () => {
  assert.equal(grade({ answer: "3.2", tolerance: 0.1 }, "3.15").correct, true);
  assert.equal(grade({ answer: "3.2", tolerance: 0.1 }, "3.4").correct, false);
  assert.equal(grade({ answer: "100", tolerance: 0.05, tolerance_type: "relative" }, "104").correct, true);
  assert.equal(grade({ answer: "100", tolerance: 0.05, tolerance_type: "relative" }, "106").correct, false);
  assert.equal(grade({ answer: "100", tolerance: 5, tolerance_type: "percent" }, "104").correct, true);
  assert.equal(grade({ answer: "100", tolerance: 5, tolerance_type: "percent" }, "106").correct, false);
  assert.match(grade({ answer: "100", tolerance: 5, tolerance_type: "percent" }, "104").reason, /5% tolerance/);
});

test("accepted ranges are inclusive or exclusive and can carry a unit", () => {
  assert.equal(grade({ answer: "1..2" }, "1.5").correct, true);
  assert.equal(grade({ answer: "1..2" }, "2").correct, true);
  assert.equal(grade({ answer: "1..2" }, "2.1").correct, false);
  assert.equal(grade({ answer: "(1, 2)" }, "1").correct, false);
  assert.equal(grade({ answer: "(1, 2)" }, "1.5").correct, true);
  assert.equal(grade({ answer: "(1, 2)" }, "2").correct, false);
  assert.equal(grade({ answer: "[1, 2] m" }, "150 cm").correct, true);
  assert.match(grade({ answer: "[1, 2] m" }, "150 cm").reason, /\[1, 2\] m/);
});

test("multiple accepted answers are read from the key and accepted_answers", () => {
  assert.equal(grade({ answer: "1|2" }, "2").correct, true);
  assert.equal(grade({ answer: "1", accepted_answers: ["2", "3"] }, "3").correct, true);
  assert.equal(grade({ answer: "1", accepted_variants: "2|3" }, "2").correct, true);
});

test("units are converted and incompatible dimensions are rejected", () => {
  assert.equal(grade({ answer: "1000 m" }, "1 km").correct, true);
  assert.match(grade({ answer: "1000 m" }, "1 km").interpreted, /1 km \(1000 m\)/);
  assert.equal(grade({ answer: "1000 m" }, "1000").correct, true);
  assert.equal(grade({ answer: "9.8 m/s^2" }, "9.8 m/s2").correct, true);
  assert.equal(grade({ answer: "9.8 m/s" }, "9.8 m s^-1").correct, true);
  assert.equal(grade({ answer: "0", units: "degC" }, "32 degF").correct, true);
  assert.match(grade({ answer: "0", units: "degC" }, "32 degF").interpreted, /32 °F \(0 °C\)/);
  assert.equal(grade({ answer: "1000", unit: "Unit 3", units: "m" }, "1 km").correct, true);
  const wrong = grade({ answer: "1000 m" }, "1 s");
  assert.equal(wrong.correct, false);
  assert.match(wrong.reason, /not compatible/);
  assert.equal(grade({ answer: "1000 m" }, "1 furlong").correct, false);
});

test("significant figures can be checked at least or exactly", () => {
  assert.equal(grade({ answer: "3.20", sig_figs: 3 }, "3.2").correct, false);
  assert.match(grade({ answer: "3.20", sig_figs: 3 }, "3.2").reason, /at least 3/);
  assert.equal(grade({ answer: "3.20", sig_figs: 3 }, "3.20").correct, true);
  assert.equal(grade({ answer: "3.20", sig_figs: 3 }, "3.200").correct, true);
  assert.equal(grade({ answer: "3.20", sig_figs: 3, sig_figs_mode: "exact" }, "3.200").correct, false);
  assert.equal(grade({ answer: "3/4", sig_figs: 3 }, "3/4").correct, true);
});

test("malformed numbers and expressions are rejected instead of being guessed", () => {
  for (const bad of ["abc", "sqrt(2)", "2^3", "3/0", "12 34"]) {
    const result = grade({ answer: "8" }, bad);
    assert.equal(result.correct, false, bad);
    assert.match(result.reason, /decimal, fraction|outside|not 8/, bad);
  }
  const blank = grade({ answer: "8" }, "");
  assert.equal(blank.correct, false);
  assert.match(blank.reason, /Enter a number/);
});

test("gradeAnswer keeps its boolean contract while gradeAnswerDetailed explains the reading", () => {
  assert.equal(T.gradeAnswer({ answer: "1/2|0.5", question_type: "spr" }, " 0.5 "), true);
  assert.equal(T.gradeAnswer({ answer: "B" }, "b"), true);
  assert.equal(T.gradeAnswer({ answer: "" }, "A"), null);
  const detail = T.gradeAnswerDetailed({ answer: "3.2", tolerance: 0.1, question_type: "spr" }, "3.15");
  assert.equal(detail.correct, true);
  assert.match(detail.interpreted, /3.15/);
});
