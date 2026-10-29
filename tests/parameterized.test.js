"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();

const P = T.parameterized;

test("the restricted formula evaluator handles arithmetic, precedence, powers and variables", () => {
  assert.equal(P.evaluateExpression("2 + 3 * 4"), 14);
  assert.equal(P.evaluateExpression("(2 + 3) * 4"), 20);
  assert.equal(P.evaluateExpression("2^3^2"), 512);
  assert.equal(P.evaluateExpression("-2^2"), -4);
  assert.equal(P.evaluateExpression("2^-3"), 0.125);
  assert.equal(P.evaluateExpression("2a + 1", { a: 5 }), 11);
  assert.equal(P.evaluateExpression("round(3.14159, 2)"), 3.14);
  assert.equal(P.evaluateExpression("min(4, 2, 9) + max(1, 3)"), 5);
  assert.equal(P.evaluateExpression("sqrt(16) + abs(-2)"), 6);
  assert.equal(P.evaluateExpression("pi * 2"), Math.PI * 2);
});

test("unsafe or invalid formulas fail instead of reaching eval or returning a non-number", () => {
  for (const formula of ["1 / 0", "foo + 1", "2^^3", "alert(1)", "2 +"]) {
    assert.throws(() => P.evaluateExpression(formula), /./, formula);
  }
});

test("variable specs read ranges, steps, lists, fixed values and compact strings", () => {
  assert.deepEqual(P.parseVariableSpec("2..5").values, [2, 3, 4, 5]);
  assert.deepEqual(P.parseVariableSpec("1..2 by 0.5").values, [1, 1.5, 2]);
  assert.deepEqual(P.parseVariableSpec("[1, 2, 3]").values, [1, 2, 3]);
  assert.deepEqual(P.parseVariableSpec("1,2,3").values, [1, 2, 3]);
  assert.equal(P.parseVariableSpec("7").value, 7);
  assert.equal(P.parseVariableSpec("-5..5").values[0], -5);
  const object = P.parseVariables({ a: "2..9", b: "1..5 by 0.5", c: [1, 2, 3] });
  assert.deepEqual(object.errors, []);
  assert.deepEqual(Object.keys(object.variables).sort(), ["a", "b", "c"]);
  const compact = P.parseVariables("a=2..9; b=1..5");
  assert.deepEqual(compact.errors, []);
  assert.deepEqual(P.parseVariables(["a=1..3", "b=2"]).errors, []);
  assert.match(P.parseVariables({ pi: "1..2" }).errors[0], /reserved/);
  assert.match(P.parseVariables({ a: "nope" }).errors[0], /Could not read/);
});

test("a seed produces the same variant, and different seeds can produce different values", () => {
  const fm = { variables: { a: "2..99", b: "1..99" }, answer_formula: "(a + b) * 2" };
  const first = P.buildVariant(fm, 12345);
  const again = P.buildVariant(fm, 12345);
  assert.equal(first.ok, true);
  assert.deepEqual(first.values, again.values);
  assert.equal(first.answer, again.answer);
  assert.equal(first.seed, 12345);
  const other = P.buildVariant(fm, 54321);
  assert.notDeepEqual(first.values, other.values);
  assert.equal(first.answer, (first.values.a + first.values.b) * 2);
});

test("broken parameterized notes report an error instead of falling back to a stale answer", () => {
  const badVariables = P.buildVariant({ variables: { a: "nope" }, answer_formula: "a * 2" }, 1);
  assert.equal(badVariables.active, true);
  assert.equal(badVariables.ok, false);
  assert.match(badVariables.error, /Could not read/);
  const badFormula = P.buildVariant({ variables: { a: "1..3" }, answer_formula: "a / 0" }, 1);
  assert.equal(badFormula.ok, false);
  assert.match(badFormula.error, /real number/);
  assert.equal(P.buildVariant({ answer_formula: "" }, 1).active, false);
});

test("placeholders are substituted in the question, stimulus, answer and choices", () => {
  const sections = P.applyVariantToSections(
    {
      stimulus: "Use {{a}}.",
      question: "What is {{ a }} + {{b}}?",
      answer: "{{a}} + {{b}} = {{c}}",
      choices: [{ letter: "A", text: "{{c}}" }],
      notes: "",
    },
    { a: 2, b: 3, c: 5 }
  );
  assert.equal(sections.stimulus, "Use 2.");
  assert.equal(sections.question, "What is 2 + 3?");
  assert.equal(sections.answer, "2 + 3 = 5");
  assert.equal(sections.choices[0].text, "5");
});

test("loading a parameterized note substitutes text, computes the key and keeps the seed", async () => {
  const note = "## Question\nWhat is {{a}} times {{b}}?\n";
  const plugin = {
    app: { vault: { cachedRead: async () => note } },
    getQuestions: () => [],
  };
  const q = {
    file: { path: "Questions/Q.md", basename: "Q" },
    fm: { question_id: "Q", variables: { a: "2..9", b: "1..9" }, answer_formula: "a * b", units: "m" },
  };
  const data = await T.loadQuestionData(plugin, q, { seed: 123 });
  assert.equal(data.mode, "spr");
  assert.equal(data.variant.ok, true);
  assert.equal(data.variant.seed, 123);
  assert.match(data.sections.question, /What is \d+ times \d+\?/);
  assert.equal(data.key, data.variant.answerText);
  assert.equal(data.key, String(data.variant.values.a * data.variant.values.b));
});

test("an attempt stores the variant values and seed in the note and history row", () => {
  const fm = { history: [], attempts: 0, correct_count: 0, streak: 0, time_spent_total: 0 };
  T.applyAttempt(
    fm,
    { correct: true, chosen: "6", conf: 3, seconds: 5, now: new Date(2026, 9, 29, 10, 0), variant: "a=2;b=3", variantSeed: 42, attemptId: "a-test" },
    [1, 3, 7],
    { attemptId: "a-test" }
  );
  assert.equal(fm.last_variant, "a=2;b=3");
  assert.equal(fm.variant_seed, 42);
  assert.equal(fm.history[0].split("|")[6], "a-test");
  assert.match(fm.history[0], /\|a=2;b=3$/);
});

test("a saved timed test keeps each item's variant seed", () => {
  const packed = T.packTestSession(
    [{ file: { path: "Questions/Q.md" }, variant: { ok: true, seed: 123 }, sel: "", seconds: 1, flagged: false }],
    {
      idx: 0,
      startedAt: 1000,
      deadline: 2000,
      allowedSeconds: 1,
      sections: [{ name: "Section 1", count: 1, minutes: 1, endAt: 2000 }],
      sectionIdx: 0,
    }
  );
  assert.equal(packed.items[0].seed, 123);
  const unpacked = T.unpackTestSession(packed, 1500);
  assert.equal(unpacked.items[0].seed, 123);
});
