"use strict";
/*
 * Conservative polynomial equivalence for numeric/free-response answers.
 *
 * This is not a computer-algebra system. It accepts one variable (`x`),
 * numbers, parentheses, + - * / and non-negative integer powers, expands the
 * expression into coefficients and compares those coefficients. Division is
 * allowed only by a constant, so `x/x` and other domain-changing expressions
 * are rejected instead of being simplified. No eval(), Function() or sampling
 * is used.
 */

const MAX_DEGREE = 12;
const MAX_TERMS = 200;
const EPSILON = 1e-9;

const SUPERSCRIPT = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
const NUMBER_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;

function normalize(text) {
  return String(text === undefined || text === null ? "" : text)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (run) => `^${[...run].map((ch) => SUPERSCRIPT[ch] || ch).join("")}`)
    .replace(/[−–—]/g, "-")
    .replace(/[×✕✖·⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\*\*/g, "^")
    .replace(/\$|\\left|\\right/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  const src = normalize(text);
  if (!src) throw new Error("The expression is empty.");
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === " ") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const match = NUMBER_RE.exec(src.slice(i));
      if (!match) throw new Error(`Bad number near "${src.slice(i, i + 12)}".`);
      const value = Number(match[0]);
      if (!Number.isFinite(value)) throw new Error("The expression contains a number that is too large.");
      out.push({ type: "number", value });
      i += match[0].length;
      continue;
    }
    if (ch === "x" || ch === "X") {
      out.push({ type: "variable" });
      i++;
      continue;
    }
    if ("+-*/^()".includes(ch)) {
      out.push({ type: ch });
      i++;
      continue;
    }
    throw new Error(`Unsupported character "${ch}" in the expression.`);
  }
  return insertImplicitMultiplication(out);
}

function insertImplicitMultiplication(tokens) {
  const out = [];
  const endsValue = (t) => !!t && (t.type === "number" || t.type === "variable" || t.type === ")");
  const startsValue = (t) => !!t && (t.type === "number" || t.type === "variable" || t.type === "(");
  for (const token of tokens) {
    if (endsValue(out[out.length - 1]) && startsValue(token)) out.push({ type: "*" });
    out.push(token);
  }
  return out;
}

/** Coefficients keyed by exponent: 3x² - 2 becomes Map { 2 => 3, 0 => -2 }. */
function polynomial(terms) {
  const map = new Map();
  for (const [exponent, coefficient] of terms || []) {
    const e = Number(exponent);
    const c = Number(coefficient);
    if (!Number.isInteger(e) || e < 0 || e > MAX_DEGREE) throw new Error("The expression uses a power outside the supported 0-12 range.");
    if (!Number.isFinite(c)) throw new Error("The expression contains a coefficient that is not finite.");
    const next = (map.get(e) || 0) + c;
    if (Math.abs(next) > EPSILON) map.set(e, next);
    else map.delete(e);
  }
  if (map.size > MAX_TERMS) throw new Error("The expression has too many terms.");
  return map;
}

function constant(value) {
  return polynomial([[0, value]]);
}

function variable() {
  return polynomial([[1, 1]]);
}

function add(a, b, sign) {
  const out = new Map(a);
  for (const [exponent, coefficient] of b) {
    const next = (out.get(exponent) || 0) + sign * coefficient;
    if (Math.abs(next) > EPSILON) out.set(exponent, next);
    else out.delete(exponent);
  }
  return polynomial(out);
}

function multiply(a, b) {
  const out = new Map();
  for (const [ea, ca] of a) {
    for (const [eb, cb] of b) {
      const exponent = ea + eb;
      if (exponent > MAX_DEGREE) throw new Error(`The expanded expression is above degree ${MAX_DEGREE}.`);
      const next = (out.get(exponent) || 0) + ca * cb;
      if (Math.abs(next) > EPSILON) out.set(exponent, next);
      else out.delete(exponent);
    }
    if (out.size > MAX_TERMS) throw new Error("The expanded expression has too many terms.");
  }
  return polynomial(out);
}

function divideByConstant(a, b) {
  if (b.size !== 1 || !b.has(0)) throw new Error("Division by an expression containing x is not supported.");
  const divisor = b.get(0);
  if (!divisor) throw new Error("Division by zero is not supported.");
  return polynomial([...a].map(([exponent, coefficient]) => [exponent, coefficient / divisor]));
}

function power(base, exponent) {
  if (exponent.size !== 1 || !exponent.has(0)) throw new Error("The exponent must be a constant whole number.");
  const n = exponent.get(0);
  if (!Number.isInteger(n) || n < 0) throw new Error("The exponent must be a non-negative whole number.");
  if (n > MAX_DEGREE) throw new Error(`The exponent must be between 0 and ${MAX_DEGREE}.`);
  let result = constant(1);
  for (let i = 0; i < n; i++) result = multiply(result, base);
  return result;
}

function parse(text) {
  const tokens = tokenize(text);
  let at = 0;
  const peek = () => tokens[at];

  function expression() {
    let left = term();
    while (peek() && (peek().type === "+" || peek().type === "-")) {
      const op = tokens[at++].type;
      left = add(left, term(), op === "+" ? 1 : -1);
    }
    return left;
  }

  function term() {
    let left = unary();
    while (peek() && (peek().type === "*" || peek().type === "/")) {
      const op = tokens[at++].type;
      const right = unary();
      left = op === "*" ? multiply(left, right) : divideByConstant(left, right);
    }
    return left;
  }

  function unary() {
    if (peek() && (peek().type === "+" || peek().type === "-")) {
      const op = tokens[at++].type;
      const inner = unary();
      return op === "-" ? add(polynomial(), inner, -1) : inner;
    }
    return powerExpr();
  }

  function powerExpr() {
    const left = primary();
    if (peek() && peek().type === "^") {
      at++;
      return power(left, unary());
    }
    return left;
  }

  function primary() {
    const token = peek();
    if (!token) throw new Error("The expression is incomplete.");
    if (token.type === "number") {
      at++;
      return constant(token.value);
    }
    if (token.type === "variable") {
      at++;
      return variable();
    }
    if (token.type === "(") {
      at++;
      const inner = expression();
      if (!peek() || peek().type !== ")") throw new Error("A closing parenthesis is missing.");
      at++;
      return inner;
    }
    throw new Error(`Unexpected "${token.type}" in the expression.`);
  }

  const result = expression();
  if (at !== tokens.length) throw new Error("Unexpected extra text after the expression.");
  return result;
}

/** Compare two one-variable expressions after exact polynomial expansion. */
function equivalent(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right || !/[xX]/.test(left) || !/[xX]/.test(right)) return false;
  let first;
  let second;
  try {
    first = parse(left);
    second = parse(right);
  } catch (e) {
    return false;
  }
  let degree = 0;
  for (const exponent of [...first.keys(), ...second.keys()]) degree = Math.max(degree, exponent);
  if (degree < 1) return false;
  for (let exponent = 0; exponent <= degree; exponent++) {
    const x = first.get(exponent) || 0;
    const y = second.get(exponent) || 0;
    const scale = Math.max(1, Math.abs(x), Math.abs(y));
    if (Math.abs(x - y) > EPSILON * scale) return false;
  }
  return true;
}

module.exports = {
  MAX_DEGREE,
  EPSILON,
  normalize,
  tokenize,
  parse,
  equivalent,
};
