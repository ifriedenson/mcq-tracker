"use strict";
/*
 * Numeric calculus for the Reference graph: a central-difference derivative, adaptive Simpson
 * quadrature, and integer summation/product.
 *
 * The functions take a plain evaluator `(x) => number`, so this module has no dependency on the
 * graph compiler, the DOM or Obsidian. Every failure is `{ok: false, reason, message}` and never
 * an exception. The quadrature is the standard adaptive Simpson scheme named in the plan row;
 * no third-party code is copied.
 */

function bad(reason, message) {
  return { ok: false, reason, message };
}

/** One finite scalar from user text. */
function parseScalar(text) {
  const raw = text === null || text === undefined ? "" : String(text).trim();
  if (!raw) return bad("empty", "Enter a number.");
  const value = Number(raw);
  if (!Number.isFinite(value)) return bad("invalid", `“${raw}” is not a finite number.`);
  return { ok: true, value };
}

function sampleFinite(fn, x) {
  try {
    const value = Number(fn(x));
    return Number.isFinite(value) ? value : null;
  } catch (e) {
    return null;
  }
}

/** Central difference with a small step scaled by the point; a flat function gives exactly 0. */
function numericDerivative(fn, x, options) {
  if (typeof fn !== "function") return bad("function", "Enter an expression to differentiate.");
  const point = Number(x);
  if (!Number.isFinite(point)) return bad("point", "The point must be a finite number.");
  const settings = options || {};
  const step = settings.step === undefined ? 1e-6 * Math.max(1, Math.abs(point)) : Number(settings.step);
  if (!Number.isFinite(step) || step <= 0) return bad("step", "The step must be a positive finite number.");
  const ahead = sampleFinite(fn, point + step);
  const behind = sampleFinite(fn, point - step);
  if (ahead === null || behind === null) {
    return bad("undefined", `The expression is not finite around ${point}.`);
  }
  const value = (ahead - behind) / (2 * step);
  if (!Number.isFinite(value)) return bad("undefined", `The slope at ${point} is not finite.`);
  return { ok: true, value };
}

/**
 * Definite integral by adaptive Simpson. Reversed bounds keep their sign (b < a gives the negative
 * of the forward integral); a non-finite sample anywhere the scheme touches stops with "undefined".
 */
function definiteIntegral(fn, a, b, options) {
  if (typeof fn !== "function") return bad("function", "Enter an expression to integrate.");
  const first = Number(a);
  const second = Number(b);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return bad("bounds", "Both bounds must be finite numbers.");
  }
  const settings = options || {};
  const tolerance = settings.tolerance === undefined ? 1e-8 : Number(settings.tolerance);
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return bad("tolerance", "The tolerance must be a positive finite number.");
  }
  const sampleBudget = Number.isFinite(Number(settings.samples)) ? Math.max(32, Math.floor(Number(settings.samples))) : 20000;
  const reversed = second < first;
  const low = reversed ? second : first;
  const high = reversed ? first : second;
  if (low === high) return { ok: true, value: 0, samples: 0 };

  let evaluations = 0;
  let failure = "";
  const evaluate = (x) => {
    evaluations += 1;
    if (evaluations > sampleBudget) {
      failure = failure || "budget";
      return NaN;
    }
    const value = sampleFinite(fn, x);
    if (value === null) {
      failure = "undefined";
      return NaN;
    }
    return value;
  };
  const simpson = (left, right, fl, fm, fr) => ((right - left) / 6) * (fl + 4 * fm + fr);
  const recurse = (left, right, fl, fm, fr, whole, tol, depth) => {
    const middle = (left + right) / 2;
    const leftMiddle = evaluate((left + middle) / 2);
    const rightMiddle = evaluate((middle + right) / 2);
    if (failure) return NaN;
    const leftPart = simpson(left, middle, fl, leftMiddle, fm);
    const rightPart = simpson(middle, right, fm, rightMiddle, fr);
    const delta = leftPart + rightPart - whole;
    if (depth <= 0 || Math.abs(delta) <= 15 * tol) return leftPart + rightPart + delta / 15;
    return (
      recurse(left, middle, fl, leftMiddle, fm, leftPart, tol / 2, depth - 1) +
      recurse(middle, right, fm, rightMiddle, fr, rightPart, tol / 2, depth - 1)
    );
  };

  const middle = (low + high) / 2;
  const fa = evaluate(low);
  const fm = evaluate(middle);
  const fb = evaluate(high);
  if (failure || !Number.isFinite(fa) || !Number.isFinite(fm) || !Number.isFinite(fb)) {
    if (failure === "budget") return bad("budget", "The integral needed more samples than allowed.");
    return bad("undefined", `The expression is not finite between ${low} and ${high}.`);
  }
  const total = recurse(low, high, fa, fm, fb, simpson(low, high, fa, fm, fb), tolerance, 18);
  if (failure === "budget") return bad("budget", "The integral needed more samples than allowed.");
  if (failure || !Number.isFinite(total)) {
    return bad("undefined", `The expression is not finite between ${low} and ${high}.`);
  }
  return { ok: true, value: reversed ? -total : total, samples: evaluations };
}

function integerBounds(from, to, limit, label) {
  const low = Number(from);
  const high = Number(to);
  if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isInteger(low) || !Number.isInteger(high)) {
    return bad("range", `${label} bounds must be whole numbers.`);
  }
  const terms = high < low ? 0 : high - low + 1;
  if (terms > limit) return bad("range", `That range has ${terms} terms; the limit is ${limit}.`);
  return { ok: true, low, high, terms };
}

function rangeOptions(options) {
  const settings = options || {};
  return Number.isFinite(Number(settings.limit)) ? Math.max(1, Math.floor(Number(settings.limit))) : 100000;
}

/** Sum over the whole-number range; an empty range sums to 0. */
function summation(fn, from, to, options) {
  if (typeof fn !== "function") return bad("function", "Enter an expression to sum.");
  const bounds = integerBounds(from, to, rangeOptions(options), "Sum");
  if (!bounds.ok) return bounds;
  if (!bounds.terms) return { ok: true, value: 0, terms: 0 };
  let total = 0;
  for (let x = bounds.low; x <= bounds.high; x += 1) {
    const value = sampleFinite(fn, x);
    if (value === null) return bad("undefined", `The expression is not finite at ${x}.`);
    total += value;
    if (!Number.isFinite(total)) return bad("undefined", "The sum is not finite.");
  }
  return { ok: true, value: total, terms: bounds.terms };
}

/** Product over the whole-number range; an empty range multiplies to 1. */
function productOver(fn, from, to, options) {
  if (typeof fn !== "function") return bad("function", "Enter an expression to multiply.");
  const bounds = integerBounds(from, to, rangeOptions(options), "Product");
  if (!bounds.ok) return bounds;
  if (!bounds.terms) return { ok: true, value: 1, terms: 0 };
  let total = 1;
  for (let x = bounds.low; x <= bounds.high; x += 1) {
    const value = sampleFinite(fn, x);
    if (value === null) return bad("undefined", `The expression is not finite at ${x}.`);
    total *= value;
    if (!Number.isFinite(total)) return bad("undefined", "The product is not finite.");
  }
  return { ok: true, value: total, terms: bounds.terms };
}

module.exports = {
  parseScalar,
  numericDerivative,
  definiteIntegral,
  summation,
  productOver,
};
