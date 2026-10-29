"use strict";
/*
 * A deliberately small expression parser for the Reference plotter.
 *
 * It never calls eval() or Function: a short recursive-descent parser turns a
 * text expression into a numeric function. Only the names below are allowed, so
 * a pasted expression cannot reach the app, the vault or the network.
 */

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS = { pi: Math.PI, e: Math.E };
const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;

function tokenize(text) {
  const src = String(text || "");
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if (raw === "." || (raw.match(/\./g) || []).length > 1) throw new Error(`Bad number "${raw}".`);
      out.push({ type: "number", value: Number(raw) });
      i = j;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < src.length && IDENT_PART.test(src[j])) j++;
      out.push({ type: "ident", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^()".includes(ch)) {
      out.push({ type: ch });
      i++;
      continue;
    }
    throw new Error(`Unsupported character "${ch}".`);
  }
  return insertImplicitMultiplication(out);
}

function insertImplicitMultiplication(tokens) {
  const out = [];
  const endsValue = (t) => t && (t.type === "number" || t.type === "ident" || t.type === ")" || t.type === "x");
  const startsValue = (t) => t && (t.type === "number" || t.type === "ident" || t.type === "(");
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prev = out[out.length - 1];
    if (endsValue(prev) && startsValue(token)) {
      // `sin(x)` is a function call, not sin multiplied by (x).
      if (!(prev.type === "ident" && token.type === "(" && FUNCTIONS[prev.value])) out.push({ type: "*" });
    }
    out.push(token);
  }
  return out;
}

function compileExpression(text) {
  const tokens = tokenize(text);
  let at = 0;
  const peek = () => tokens[at];
  const take = (type) => {
    const token = tokens[at];
    if (!token || token.type !== type) throw new Error(`Expected ${type === ")" ? "a closing parenthesis" : type}.`);
    at++;
    return token;
  };

  function expression() {
    let left = term();
    while (peek() && (peek().type === "+" || peek().type === "-")) {
      const op = tokens[at++].type;
      const right = term();
      const a = left;
      left = op === "+" ? (x) => a(x) + right(x) : (x) => a(x) - right(x);
    }
    return left;
  }

  function term() {
    let left = unary();
    while (peek() && (peek().type === "*" || peek().type === "/")) {
      const op = tokens[at++].type;
      const right = unary();
      const a = left;
      left = op === "*" ? (x) => a(x) * right(x) : (x) => a(x) / right(x);
    }
    return left;
  }

  function unary() {
    if (peek() && (peek().type === "+" || peek().type === "-")) {
      const op = tokens[at++].type;
      const inner = unary();
      return op === "-" ? (x) => -inner(x) : inner;
    }
    return power();
  }

  function power() {
    const left = primary();
    if (peek() && peek().type === "^") {
      at++;
      const right = unary();
      return (x) => Math.pow(left(x), right(x));
    }
    return left;
  }

  function primary() {
    const token = peek();
    if (!token) throw new Error("The expression is incomplete.");
    if (token.type === "number") {
      at++;
      const n = token.value;
      return () => n;
    }
    if (token.type === "ident") {
      at++;
      const name = token.value;
      if (name === "x") return (x) => x;
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
        const n = CONSTANTS[name];
        return () => n;
      }
      if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) {
        take("(");
        const inner = expression();
        take(")");
        const fn = FUNCTIONS[name];
        return (x) => fn(inner(x));
      }
      throw new Error(`Unknown name "${name}". Use x, pi, e and the listed functions.`);
    }
    if (token.type === "(") {
      at++;
      const inner = expression();
      take(")");
      return inner;
    }
    throw new Error(`Unexpected "${token.type}".`);
  }

  const fn = expression();
  if (at !== tokens.length) throw new Error("Unexpected extra text after the expression.");
  return fn;
}

/** Samples an expression into graph points. Returns null when no finite point exists. */
function buildPlot(text, options) {
  const opts = options || {};
  const fn = compileExpression(text);
  const xMin = Number.isFinite(Number(opts.xMin)) ? Number(opts.xMin) : -10;
  const xMax = Number.isFinite(Number(opts.xMax)) ? Number(opts.xMax) : 10;
  if (!(xMax > xMin)) throw new Error("The maximum x must be larger than the minimum x.");
  const samples = Math.max(3, Math.min(1200, Math.round(Number(opts.samples) || 241)));
  const points = [];
  let low = Infinity;
  let high = -Infinity;
  for (let i = 0; i < samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / (samples - 1);
    let y;
    try {
      y = fn(x);
    } catch (e) {
      y = NaN;
    }
    const finite = Number.isFinite(y);
    if (finite) {
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    points.push({ x, y: finite ? y : null });
  }
  if (low === Infinity) throw new Error("That expression has no real values in this range.");
  if (low === high) {
    low -= 1;
    high += 1;
  } else {
    const pad = (high - low) * 0.08;
    low -= pad;
    high += pad;
  }
  return { points, xMin, xMax, yMin: low, yMax: high };
}

module.exports = {
  FUNCTIONS,
  buildPlot,
  compileExpression,
  tokenize,
};
