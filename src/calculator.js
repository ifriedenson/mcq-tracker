"use strict";
/*
 * Local calculator for the Reference panel.
 *
 * Expressions go through the restricted evaluator used by parameterized
 * questions. There is no eval, no Function, and no network request.
 */
const { str } = require("./util");
const { evaluateExpression } = require("./parameterized");
const complex = require("./complex");

const CALCULATOR_MODES = ["basic", "scientific", "graphing"];

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
  ["log(", "pi", "e", "i", "%"],
];

function normalizeCalculatorMode(value) {
  return CALCULATOR_MODES.includes(str(value).trim().toLowerCase()) ? str(value).trim().toLowerCase() : "basic";
}

/** Evaluate one expression and return a display-ready result or a readable error. */
function evaluateComplexCalculator(expression) {
  return complex.evaluateComplexText(expression);
}

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

/*
 * Plotting is a pure mapping from an expression of x to an SVG path. The
 * expression goes through the same restricted evaluator as everything else, so
 * there is still no eval and no Function: `x` is replaced by its value before
 * the parser sees it.
 */
function substituteX(expression, value) {
  return str(expression).replace(/\bx\b/g, `(${Number(value).toFixed(6)})`);
}

function plotPath(expression, options) {
  const opts = options || {};
  const width = Number.isFinite(opts.width) ? opts.width : 320;
  const height = Number.isFinite(opts.height) ? opts.height : 240;
  const xMin = Number.isFinite(opts.min) ? opts.min : -10;
  const xMax = Number.isFinite(opts.max) && opts.max > xMin ? opts.max : 10;
  const samples = Math.min(401, Math.max(41, Number(opts.samples) || 161));
  const text = str(expression).trim();
  const empty = { path: "", points: 0, xMin, xMax, yMin: -10, yMax: 10, error: "" };
  if (!text) return empty;
  const values = [];
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    let y = null;
    try {
      y = evaluateExpression(substituteX(text, x));
    } catch (e) {
      y = null;
    }
    if (Number.isFinite(y)) values.push({ x, y });
  }
  if (!values.length) return Object.assign({}, empty, { error: "That expression cannot be plotted." });
  let yMin = Math.min(...values.map((point) => point.y));
  let yMax = Math.max(...values.map((point) => point.y));
  if (yMax - yMin < 1) {
    yMin -= 1;
    yMax += 1;
  }
  const sx = (x) => ((x - xMin) / (xMax - xMin)) * width;
  const sy = (y) => height - ((y - yMin) / (yMax - yMin)) * height;
  const path = values
    .map((point, index) => `${index ? "L" : "M"}${sx(point.x).toFixed(1)} ${sy(point.y).toFixed(1)}`)
    .join(" ");
  return { path, points: values.length, xMin, xMax, yMin, yMax, error: "" };
}

module.exports = {
  BASIC_KEYS,
  CALCULATOR_MODES,
  SCIENTIFIC_KEYS,
  appendCalculatorToken,
  evaluateCalculator,
  evaluateComplexCalculator,
  formatCalculatorValue,
  normalizeCalculatorMode,
  plotPath,
  substituteX,
};
