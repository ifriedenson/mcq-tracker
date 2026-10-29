"use strict";
/*
 * Local calculator for the Reference panel.
 *
 * Expressions go through the restricted evaluator used by parameterized
 * questions. There is no eval, no Function, and no network request.
 */
const { str } = require("./util");
const { evaluateExpression } = require("./parameterized");

const CALCULATOR_MODES = ["basic", "scientific"];

const BASIC_KEYS = [
  ["7", "8", "9", "/"],
  ["4", "5", "6", "*"],
  ["1", "2", "3", "-"],
  ["0", ".", "=", "+"],
  ["C", "⌫"],
];

const SCIENTIFIC_KEYS = [
  ["(", ")", "^", "sqrt("],
  ["sin(", "cos(", "tan(", "ln("],
  ["log(", "pi", "e", "%"],
];

function normalizeCalculatorMode(value) {
  return CALCULATOR_MODES.includes(str(value).trim().toLowerCase()) ? str(value).trim().toLowerCase() : "basic";
}

/** Evaluate one expression and return a display-ready result or a readable error. */
function evaluateCalculator(expression) {
  const text = str(expression).trim();
  if (!text) return { ok: false, value: null, text: "", error: "Enter a calculation." };
  try {
    const value = evaluateExpression(text);
    if (!Number.isFinite(value)) return { ok: false, value: null, text: "", error: "That result is not a finite number." };
    return { ok: true, value, text: formatCalculatorValue(value), error: "" };
  } catch (e) {
    return { ok: false, value: null, text: "", error: str(e && e.message ? e.message : e) || "That expression is not valid." };
  }
}

function formatCalculatorValue(value) {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toPrecision(12));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Apply a keypad token to the expression. `=` is handled by the view. */
function appendCalculatorToken(expression, token) {
  const current = str(expression);
  if (token === "C") return "";
  if (token === "⌫") return current.slice(0, -1);
  if (token === "+/-") return current.startsWith("-") ? current.slice(1) : `-${current}`;
  if (!token) return current;
  if (!current && /^[*/^%)]/.test(token)) return current;
  return current + token;
}

module.exports = {
  BASIC_KEYS,
  CALCULATOR_MODES,
  SCIENTIFIC_KEYS,
  appendCalculatorToken,
  evaluateCalculator,
  formatCalculatorValue,
  normalizeCalculatorMode,
};
