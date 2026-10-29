"use strict";
/*
 * Parameterized question variants.
 *
 * A note can define numeric variables with ranges or lists and an answer
 * formula. Loading the note draws one seeded variant, substitutes {{name}}
 * placeholders in the question text, and computes the answer with a small
 * recursive-descent evaluator. Nothing here uses eval() or Function().
 *
 * Syntax:
 *   variables:
 *     a: 2..9
 *     b: 1..5 by 0.5
 *     c: [1, 2, 3]
 *   answer_formula: (a + b) * c
 *
 * Placeholders use doubled braces: {{a}}, {{b}}.
 */

const { str } = require("./util");

const FUNCTIONS = {
  abs: { min: 1, max: 1, fn: (x) => Math.abs(x) },
  sqrt: { min: 1, max: 1, fn: (x) => Math.sqrt(x) },
  sin: { min: 1, max: 1, fn: (x) => Math.sin(x) },
  cos: { min: 1, max: 1, fn: (x) => Math.cos(x) },
  tan: { min: 1, max: 1, fn: (x) => Math.tan(x) },
  asin: { min: 1, max: 1, fn: (x) => Math.asin(x) },
  acos: { min: 1, max: 1, fn: (x) => Math.acos(x) },
  atan: { min: 1, max: 1, fn: (x) => Math.atan(x) },
  ln: { min: 1, max: 1, fn: (x) => Math.log(x) },
  log: { min: 1, max: 1, fn: (x) => Math.log10(x) },
  exp: { min: 1, max: 1, fn: (x) => Math.exp(x) },
  floor: { min: 1, max: 1, fn: (x) => Math.floor(x) },
  ceil: { min: 1, max: 1, fn: (x) => Math.ceil(x) },
  trunc: { min: 1, max: 1, fn: (x) => Math.trunc(x) },
  sign: { min: 1, max: 1, fn: (x) => Math.sign(x) },
  round: { min: 1, max: 2, fn: (x, digits) => roundTo(x, digits === undefined ? 0 : digits) },
  min: { min: 1, max: Infinity, fn: (...xs) => Math.min(...xs) },
  max: { min: 1, max: Infinity, fn: (...xs) => Math.max(...xs) },
  pow: { min: 2, max: 2, fn: (x, y) => Math.pow(x, y) },
  mod: { min: 2, max: 2, fn: (x, y) => x % y },
};
const CONSTANTS = { pi: Math.PI, e: Math.E };
const RESERVED = new Set([...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS)]);
const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const NUMBER_RE = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;

function roundTo(value, digits) {
  const places = Math.max(0, Math.min(12, Math.round(Number(digits) || 0)));
  const factor = Math.pow(10, places);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeExpressionText(text) {
  return str(text)
    .replace(/[−–—]/g, "-")
    .replace(/[×✕✖·⋅]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/\bpi\b/g, "pi");
}

function tokenize(text) {
  const src = normalizeExpressionText(text);
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const match = NUMBER_RE.exec(src.slice(i));
      if (!match) throw new Error(`Bad number near "${src.slice(i, i + 12)}".`);
      out.push({ type: "number", value: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < src.length && IDENT_PART.test(src[j])) j++;
      out.push({ type: "ident", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^%(),".includes(ch)) {
      out.push({ type: ch });
      i++;
      continue;
    }
    throw new Error(`Unsupported character "${ch}" in the formula.`);
  }
  return insertImplicitMultiplication(out);
}

function insertImplicitMultiplication(tokens) {
  const out = [];
  const endsValue = (t) => !!t && (t.type === "number" || t.type === "ident" || t.type === ")");
  const startsValue = (t) => !!t && (t.type === "number" || t.type === "ident" || t.type === "(");
  for (const token of tokens) {
    const prev = out[out.length - 1];
    if (endsValue(prev) && startsValue(token)) {
      // sin(x) is a call; a(x) is a variable times (x).
      if (!(prev.type === "ident" && token.type === "(" && FUNCTIONS[prev.value])) out.push({ type: "*" });
    }
    out.push(token);
  }
  return out;
}

/** Evaluates one formula with a plain object of numeric variables. */
function evaluateExpression(text, variables) {
  const tokens = tokenize(text);
  const vars = variables || {};
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
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function term() {
    let left = unary();
    while (peek() && (peek().type === "*" || peek().type === "/" || peek().type === "%")) {
      const op = tokens[at++].type;
      const right = unary();
      left = op === "*" ? left * right : op === "/" ? left / right : left % right;
    }
    return left;
  }

  function unary() {
    if (peek() && (peek().type === "+" || peek().type === "-")) {
      const op = tokens[at++].type;
      const inner = unary();
      return op === "-" ? -inner : inner;
    }
    return power();
  }

  function power() {
    const left = primary();
    if (peek() && peek().type === "^") {
      at++;
      const right = unary(); // right-associative, and 2^-3 is allowed
      return Math.pow(left, right);
    }
    return left;
  }

  function primary() {
    const token = peek();
    if (!token) throw new Error("The answer formula is incomplete.");
    if (token.type === "number") {
      at++;
      return token.value;
    }
    if (token.type === "ident") {
      at++;
      const name = token.value;
      if (FUNCTIONS[name] && peek() && peek().type === "(") {
        take("(");
        const args = [];
        if (peek() && peek().type !== ")") {
          args.push(expression());
          while (peek() && peek().type === ",") {
            at++;
            args.push(expression());
          }
        }
        take(")");
        const spec = FUNCTIONS[name];
        if (args.length < spec.min || args.length > spec.max) {
          throw new Error(`The function ${name} takes ${spec.min === spec.max ? spec.min : `${spec.min} to ${spec.max}`} value(s).`);
        }
        return spec.fn(...args);
      }
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) return CONSTANTS[name];
      if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
      throw new Error(`Unknown variable "${name}". Add it under variables.`);
    }
    if (token.type === "(") {
      at++;
      const inner = expression();
      take(")");
      return inner;
    }
    throw new Error(`Unexpected "${token.type}" in the formula.`);
  }

  const value = expression();
  if (at !== tokens.length) throw new Error("Unexpected extra text after the formula.");
  if (!Number.isFinite(value)) throw new Error("The formula did not produce a real number.");
  return value;
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = str(value).trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function decimalPlaces(value) {
  const text = String(value);
  const match = /\.(\d+)/.exec(text);
  return match ? Math.min(12, match[1].length) : 0;
}

/**
 * Reads one variable spec:
 *   3          fixed
 *   2..9       integer range
 *   1..5 by .5 stepped range
 *   [1, 2, 3]  list
 */
function parseVariableSpec(raw) {
  if (Array.isArray(raw)) {
    const values = raw.map(parseNumber);
    if (!values.length || values.some((v) => v === null)) return null;
    return { kind: "list", values };
  }
  const fixed = parseNumber(raw);
  if (fixed !== null) return { kind: "fixed", value: fixed };
  let text = str(raw).trim();
  if (!text) return null;
  if (/^\[.*\]$/.test(text)) text = text.slice(1, -1).trim();

  let body = text;
  let step = null;
  const stepMatch = text.match(/^(.*?)\s+(?:by|step)\s+(.+)$/i);
  if (stepMatch) {
    body = stepMatch[1].trim();
    step = parseNumber(stepMatch[2]);
    if (step === null || step <= 0) return null;
  }

  const range = body.split(/\s*(?:\.\.|\bto\b)\s*/i);
  if (range.length === 2) {
    const low = parseNumber(range[0]);
    const high = parseNumber(range[1]);
    if (low === null || high === null) return null;
    const start = Math.min(low, high);
    const end = Math.max(low, high);
    // Integer ranges step by one. Decimal ranges use ten even steps unless
    // the note asks for a specific "by" value.
    const stride = step === null ? (Number.isInteger(start) && Number.isInteger(end) ? 1 : Math.max(1e-6, (end - start) / 10)) : step;
    const count = Math.floor((end - start) / stride + 1e-9) + 1;
    if (count < 1 || count > 1000) return null;
    const places = decimalPlaces(stride);
    const values = [];
    for (let i = 0; i < count; i++) values.push(roundTo(start + i * stride, places));
    return { kind: "range", values, step: stride, decimals: places };
  }

  const list = body.split(/[,|]/).map((part) => part.trim()).filter(Boolean);
  if (list.length > 1) {
    const values = list.map(parseNumber);
    if (values.some((v) => v === null)) return null;
    return { kind: "list", values };
  }
  return null;
}

/**
 * Reads variables from a YAML-style object, a list of "name=spec" strings, or
 * a compact string such as "a=2..9; b=1..5". Names are sorted so the same seed
 * produces the same variant regardless of property order.
 */
function parseVariables(raw) {
  const out = {};
  const errors = [];
  const add = (name, spec) => {
    const key = str(name).trim();
    if (!IDENT_START.test(key) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      errors.push(`"${key}" is not a valid variable name.`);
      return;
    }
    if (RESERVED.has(key)) {
      errors.push(`"${key}" is reserved for a function or constant.`);
      return;
    }
    const parsed = parseVariableSpec(spec);
    if (!parsed) {
      errors.push(`Could not read the range for "${key}".`);
      return;
    }
    out[key] = parsed;
  };

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([name, spec]) => add(name, spec));
  } else if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      const text = str(entry).trim();
      const match = /^([^=]+)=(.+)$/.exec(text);
      if (match) add(match[1].trim(), match[2].trim());
      else errors.push(`Could not read variable "${text}". Use name=range.`);
    });
  } else if (typeof raw === "string") {
    raw
      .split(/[;\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const match = /^([^=]+)=(.+)$/.exec(entry);
        if (match) add(match[1].trim(), match[2].trim());
        else errors.push(`Could not read variable "${entry}". Use name=range.`);
      });
  } else if (raw !== undefined && raw !== null && str(raw).trim()) {
    errors.push("Variables must be an object, a list, or name=range pairs.");
  }

  return { variables: out, errors };
}

function seedFromText(text) {
  let h = 2166136261;
  const s = str(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeSeed(seed, label) {
  const number = Number(seed);
  if (seed !== undefined && seed !== null && seed !== "" && Number.isFinite(number)) return Math.floor(Math.abs(number)) >>> 0;
  return seedFromText(`${label || "variant"}|${Date.now()}|${Math.random()}`);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawValue(spec, random) {
  if (spec.kind === "fixed") return spec.value;
  if (spec.kind === "list") return spec.values[Math.min(spec.values.length - 1, Math.floor(random() * spec.values.length))];
  const index = Math.min(spec.values.length - 1, Math.floor(random() * spec.values.length));
  return spec.values[index];
}

function formatVariantNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Object.is(value, -0)) return "0";
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(10)));
}

/**
 * Draws one variant. Returns { active:false } for ordinary notes, and an error
 * object (never throws) when a parameterized note is malformed.
 */
function buildVariant(fm, seed, label) {
  const formula = str(fm && fm.answer_formula).trim();
  if (!formula) return { active: false, ok: false, error: "", seed: 0, values: {}, formula: "" };
  const parsed = parseVariables(fm && fm.variables);
  if (parsed.errors.length) {
    return { active: true, ok: false, error: parsed.errors.join(" "), seed: normalizeSeed(seed, label), values: {}, formula };
  }
  const names = Object.keys(parsed.variables).sort();
  const actualSeed = normalizeSeed(seed, label);
  const random = mulberry32(actualSeed);
  const values = {};
  for (const name of names) values[name] = drawValue(parsed.variables[name], random);
  try {
    const answer = evaluateExpression(formula, values);
    return {
      active: true,
      ok: true,
      error: "",
      seed: actualSeed,
      values,
      formula,
      answer,
      answerText: formatVariantNumber(answer),
    };
  } catch (e) {
    return { active: true, ok: false, error: str(e && e.message) || "The answer formula could not be evaluated.", seed: actualSeed, values, formula };
  }
}

function substituteVariables(text, values) {
  const vars = values || {};
  return str(text).replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? formatVariantNumber(vars[name]) : match
  );
}

/** A new sections object with placeholders replaced in every learner-facing string. */
function applyVariantToSections(sections, values) {
  const source = sections || {};
  const out = { ...source };
  for (const key of ["stimulus", "question", "answer", "notes", "body"]) {
    if (typeof source[key] === "string") out[key] = substituteVariables(source[key], values);
  }
  out.choices = (Array.isArray(source.choices) ? source.choices : []).map((choice) => ({
    ...choice,
    text: substituteVariables(choice && choice.text, values),
  }));
  return out;
}

function variantSummary(values) {
  return Object.keys(values || {})
    .sort()
    .map((name) => `${name} = ${formatVariantNumber(values[name])}`)
    .join(", ");
}

function variantValuesText(values) {
  return Object.keys(values || {})
    .sort()
    .map((name) => `${name}=${formatVariantNumber(values[name])}`)
    .join(";")
    .replace(/[|\n\r]/g, "/")
    .slice(0, 500);
}

module.exports = {
  FUNCTIONS,
  CONSTANTS,
  tokenize,
  evaluateExpression,
  parseVariableSpec,
  parseVariables,
  normalizeSeed,
  mulberry32,
  buildVariant,
  substituteVariables,
  applyVariantToSections,
  formatVariantNumber,
  variantSummary,
  variantValuesText,
};
