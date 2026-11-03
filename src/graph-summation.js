"use strict";
/*
 * Summation and product notation for graph expressions:
 *   sum(expression, variable, start, end)   e.g. sum(n^2, n, 1, 10)
 *   prod(expression, variable, start, end)  e.g. prod(k, k, 1, 5)
 *
 * Parsing and validation live here, with no DOM, Obsidian, storage or network
 * imports. The renderer supplies the compiled term and bounds functions; every
 * rejection is a `{ok:false, reason, message}` with a human-readable message.
 */

const ITERATION_LIMIT = 10000;
const IDENT = /^[A-Za-z][A-Za-z0-9_]*$/;
const RESERVED_VARIABLES = ["x", "y", "t", "theta", "r", "pi", "e", "tau", "sum", "prod"];

function refusal(reason, message) {
  return { ok: false, reason, message };
}

function mentionsName(text, name) {
  const source = String(text || "");
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9_])${escaped}([^A-Za-z0-9_]|$)`).test(source);
}

function kindLabel(kind) {
  return kind === "prod" ? "Product" : "Summation";
}

/** Split on top-level commas only, respecting parentheses, braces and brackets. */
function splitArguments(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      quote = !quote;
      continue;
    }
    if (quote) continue;
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function closeParenthesis(text, openIndex) {
  let depth = 0;
  let quote = false;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      quote = !quote;
      continue;
    }
    if (quote) continue;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Read one notation starting at an index, or return null when there is none. */
function notationAt(text, index) {
  const source = String(text || "");
  const match = /^(sum|prod)\s*\(/.exec(source.slice(index));
  if (!match) return null;
  const kind = match[1];
  const open = index + match[0].length - 1;
  const close = closeParenthesis(source, open);
  if (close < 0) return refusal("syntax", `Close the ${kind}(...) with a closing parenthesis.`);
  const parts = splitArguments(source.slice(open + 1, close)).map((part) => part.trim());
  if (parts.length !== 4) {
    return refusal("arguments", `${kindLabel(kind)} needs four arguments: ${kind}(expression, variable, start, end).`);
  }
  return {
    ok: true,
    kind,
    expression: parts[0],
    variable: parts[1],
    start: parts[2],
    end: parts[3],
    endIndex: close + 1,
  };
}

/** Structural validation that does not need an evaluator. */
function validateParts(parts, options) {
  const opts = options || {};
  const kind = parts && parts.kind === "prod" ? "prod" : "sum";
  const label = kindLabel(kind);
  const expression = String((parts && parts.expression) || "").trim();
  const variable = String((parts && parts.variable) || "").trim();
  const start = String((parts && parts.start) || "").trim();
  const end = String((parts && parts.end) || "").trim();
  if (!variable) return refusal("variable", `${label} needs a loop variable, like ${kind}(n^2, n, 1, 10).`);
  if (!IDENT.test(variable)) return refusal("variable", `Use a single name for the loop variable, like n or k.`);
  const reserved = RESERVED_VARIABLES.concat(Array.isArray(opts.reserved) ? opts.reserved : []);
  if (reserved.indexOf(variable) >= 0) return refusal("variable", `Use a loop variable such as n or k, not ${variable}.`);
  if (!expression) return refusal("expression", `${label} needs an expression, like ${kind}(n^2, n, 1, 10).`);
  if (!start || !end) return refusal("bounds", `${label} needs whole-number start and end bounds.`);
  if (!mentionsName(expression, variable)) return refusal("variable", `The expression does not use the loop variable ${variable}.`);
  if (mentionsName(start, variable) || mentionsName(end, variable)) {
    return refusal("bounds", `The bounds cannot use the loop variable ${variable}.`);
  }
  const literal = /^[+-]?\d+(?:\.\d+)?$/;
  for (const bound of [start, end]) {
    if (literal.test(bound) && !Number.isInteger(Number(bound))) return refusal("bounds", `${label} bounds must be whole numbers.`);
  }
  if (literal.test(start) && literal.test(end)) {
    const first = Number(start);
    const last = Number(end);
    if (first > last) return refusal("bounds", "The start bound must be at most the end bound.");
    if (last - first + 1 > ITERATION_LIMIT) {
      return refusal("limit", `That expression needs ${last - first + 1} steps; the limit is ${ITERATION_LIMIT}.`);
    }
  }
  return { ok: true, kind, expression, variable, start, end };
}

/** Replace every notation with a name produced by `factory`, preserving the rest. */
function rewriteNotations(text, factory) {
  const source = String(text === null || text === undefined ? "" : text);
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (!/[A-Za-z_]/.test(ch)) {
      out += ch;
      i++;
      continue;
    }
    let end = i + 1;
    while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end++;
    const name = source.slice(i, end);
    const before = i === 0 ? "" : source[i - 1];
    const after = source.slice(end).replace(/^\s+/, "");
    if ((name === "sum" || name === "prod") && !/[A-Za-z0-9_]/.test(before) && after.charAt(0) === "(") {
      const parsed = notationAt(source, i);
      if (!parsed || !parsed.ok) throw new Error(parsed ? parsed.message : `Use ${name}(expression, variable, start, end).`);
      const check = validateParts(parsed);
      if (!check.ok) throw new Error(check.message);
      out += factory(parsed);
      i = parsed.endIndex;
      continue;
    }
    out += name;
    i = end;
  }
  return out;
}

/** Whole-number bounds and a bounded iteration count. */
function iterationRange(startValue, endValue, limit) {
  const start = Number(startValue);
  const end = Number(endValue);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return refusal("bounds", "The bounds must be finite numbers.");
  if (!Number.isInteger(start)) return refusal("bounds", "The start bound must be a whole number.");
  if (!Number.isInteger(end)) return refusal("bounds", "The end bound must be a whole number.");
  if (start > end) return refusal("bounds", "The start bound must be at most the end bound.");
  const cap = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.floor(Number(limit)) : ITERATION_LIMIT;
  const count = end - start + 1;
  if (count > cap) return refusal("limit", `That expression needs ${count} steps; the limit is ${cap}.`);
  return { ok: true, start, end, count };
}

/** Run a validated notation. The term is a function of the loop value. */
function applyNotation(kind, start, end, term, limit) {
  const range = iterationRange(start, end, limit);
  if (!range.ok) return range;
  let value = kind === "prod" ? 1 : 0;
  for (let i = range.start; i <= range.end; i++) {
    const termValue = term(i);
    if (!Number.isFinite(termValue)) {
      return refusal("term", `The ${kind === "prod" ? "product" : "sum"} is not a finite number at ${i}.`);
    }
    value = kind === "prod" ? value * termValue : value + termValue;
  }
  return { ok: true, value };
}

function isNotationText(text) {
  return /\b(?:sum|prod)\s*\(/.test(String(text === null || text === undefined ? "" : text));
}

module.exports = {
  ITERATION_LIMIT,
  splitArguments,
  notationAt,
  validateParts,
  rewriteNotations,
  iterationRange,
  applyNotation,
  isNotationText,
};
