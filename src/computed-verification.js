"use strict";
/*
 * Computation-based answer verification.
 *
 * A note can carry a literal arithmetic `calculation` (for example 6 * 7) or
 * an `answer_formula` with parameterized variables. The evaluator is the same
 * restricted parser used by parameterized questions; this module never calls
 * eval. A numeric stored answer is compared with the computed value using the
 * normal tolerance/unit rules. Non-numeric questions are left alone.
 */
const { str } = require("./util");
const { evaluateExpression, buildVariant, formatVariantNumber } = require("./parameterized");
const { parseQuantity, gradeNumeric } = require("./numeric-grading");

function expressionFrom(fm) {
  for (const key of ["calculation", "answer_calculation", "answer_formula"]) {
    const value = str(fm && fm[key]).trim();
    if (value) return value.replace(/^=\s*/, "");
  }
  return "";
}

/** Parse the compact `a=3;b=2.5` form written to last_variant. */
function parseVariantValues(text) {
  const values = {};
  for (const part of str(text).split(";")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/.exec(part);
    if (!match) continue;
    const value = Number(match[2]);
    if (Number.isFinite(value)) values[match[1]] = value;
  }
  return values;
}

/**
 * Evaluate the note's calculation. Returns { value, text, expression, variables }.
 * Throws a readable error when the expression is malformed.
 */
function computeAnswer(fm) {
  const expression = expressionFrom(fm);
  if (!expression) return null;
  let variables = {};
  if (fm && fm.variables) {
    variables = parseVariantValues(fm.last_variant);
    if (!Object.keys(variables).length) {
      // A formula with variables but no recorded variant is still checkable:
      // use the saved seed when one exists, otherwise the first reproducible
      // draw. The note's formula is the authority.
      const seed = fm.variant_seed === undefined || fm.variant_seed === null ? 1 : fm.variant_seed;
      const variant = buildVariant(fm, seed);
      if (!variant.ok) throw new Error(variant.error || "The parameterized variant could not be built.");
      variables = variant.values;
    }
  }
  const value = evaluateExpression(expression, variables);
  return {
    value,
    text: formatVariantNumber(value),
    expression,
    variables,
  };
}

/**
 * Compare a stored numeric answer with the calculation. Returns a verification
 * object, or null when the note has no calculation or its answer is non-numeric.
 */
function computedVerification(fm, options) {
  const opts = options || {};
  if (!expressionFrom(fm)) return null;
  const key = str(opts.key !== undefined ? opts.key : fm && fm.answer).trim();
  const base = {
    model: "calculation",
    method: "computed",
    date: str(opts.date).trim(),
    key,
    drop: false,
  };
  let computed;
  try {
    computed = computeAnswer(fm);
  } catch (e) {
    return {
      ...base,
      status: "error",
      match: null,
      answer: "",
      error: str(e && e.message ? e.message : e) || "The calculation could not be evaluated.",
    };
  }
  if (!computed) return null;
  if (!key) {
    return {
      ...base,
      status: "match",
      match: true,
      answer: computed.text,
      reason: `Computed ${computed.text} from ${computed.expression}.`,
      expression: computed.expression,
    };
  }
  if (!parseQuantity(key)) return null; // letter, word or otherwise non-numeric
  const graded = gradeNumeric({ ...fm, answer: key, question_type: "spr" }, computed.text);
  if (!graded) return null;
  return {
    ...base,
    status: graded.correct ? "match" : "mismatch",
    match: graded.correct,
    answer: computed.text,
    reason: `Computed ${computed.text} from ${computed.expression}. ${graded.reason}`,
    expression: computed.expression,
    interpreted: graded.interpreted,
  };
}

/**
 * When both a model check and a local calculation exist, the calculation is the
 * stronger signal. A model disagreement is still surfaced for review.
 */
function mergeVerification(ai, computed) {
  if (!computed) return ai || null;
  if (!ai) return computed;
  const out = {
    ...computed,
    ai_status: str(ai.status),
    ai_answer: str(ai.answer),
    ai_model: str(ai.model),
  };
  if (computed.status === "mismatch" || computed.status === "error") return out;
  if (ai.status === "mismatch") {
    return {
      ...out,
      status: "review",
      match: false,
      error: "The AI check disagreed with the calculated answer.",
      drop: false,
    };
  }
  return out;
}

module.exports = {
  expressionFrom,
  parseVariantValues,
  computeAnswer,
  computedVerification,
  mergeVerification,
};
