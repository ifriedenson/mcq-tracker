"use strict";
/*
 * Summary statistics for the Reference graph's list entry.
 *
 * Pure arithmetic only: no DOM, no Obsidian and no third-party code. The definitions follow the
 * usual sample conventions (sample standard deviation with n - 1, quartiles by linear
 * interpolation between order statistics, Pearson's r) so the numbers match the formulas named in
 * the plan row without copying an implementation.
 */

/** Splits on commas, semicolons and whitespace; rejects tokens that are not finite numbers. */
function parseNumberList(text) {
  const raw = text === null || text === undefined ? "" : String(text);
  const tokens = raw.split(/[\s,;]+/).filter((token) => token.length > 0);
  if (!tokens.length) return { ok: false, reason: "empty", message: "Enter at least one number." };
  const values = [];
  for (const token of tokens) {
    const value = Number(token);
    if (!Number.isFinite(value)) {
      return { ok: false, reason: "invalid", message: `“${token}” is not a finite number.`, token };
    }
    values.push(value);
  }
  return { ok: true, values };
}

function mean(values) {
  if (!Array.isArray(values) || !values.length) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Sorts a copy so callers keep their order; non-finite entries are not expected here. */
function sortedCopy(values) {
  return values.slice().sort((a, b) => a - b);
}

function median(values) {
  if (!Array.isArray(values) || !values.length) return null;
  const sorted = sortedCopy(values);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Quantile by linear interpolation between order statistics, p in [0, 1]. */
function quantile(values, p) {
  if (!Array.isArray(values) || !values.length) return null;
  const sorted = sortedCopy(values);
  const clamped = Math.min(1, Math.max(0, Number(p) || 0));
  const position = (sorted.length - 1) * clamped;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Sample standard deviation (n - 1); null for fewer than two values. */
function standardDeviation(values) {
  if (!Array.isArray(values) || values.length < 2) return null;
  const average = mean(values);
  let squares = 0;
  for (const value of values) squares += (value - average) ** 2;
  return Math.sqrt(squares / (values.length - 1));
}

/** Pearson's r, or null when either list has no variation or the lengths differ. */
function correlation(xs, ys) {
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length < 2) return null;
  const meanX = mean(xs);
  const meanY = mean(ys);
  let cross = 0;
  let squaresX = 0;
  let squaresY = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index] - meanX;
    const dy = ys[index] - meanY;
    cross += dx * dy;
    squaresX += dx * dx;
    squaresY += dy * dy;
  }
  if (!(squaresX > 0) || !(squaresY > 0)) return null;
  return Math.min(1, Math.max(-1, cross / Math.sqrt(squaresX * squaresY)));
}

/** The whole summary for a non-empty list. */
function describe(values) {
  const sorted = sortedCopy(values);
  return {
    count: sorted.length,
    sum: sorted.reduce((total, value) => total + value, 0),
    mean: mean(sorted),
    median: median(sorted),
    stdev: standardDeviation(sorted),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * The panel's report: the summary list is required; x and y are optional and only used for a
 * correlation. Every failure is `{ok: false, reason, message}` rather than an exception.
 */
function statisticsReport(valuesText, xText, yText) {
  const list = parseNumberList(valuesText);
  if (!list.ok) return list;
  const stats = describe(list.values);
  const hasX = String(xText === null || xText === undefined ? "" : xText).trim().length > 0;
  const hasY = String(yText === null || yText === undefined ? "" : yText).trim().length > 0;
  let coefficient = null;
  let correlationError = "";
  if (hasX || hasY) {
    const xList = parseNumberList(xText);
    const yList = parseNumberList(yText);
    if (!xList.ok) correlationError = xList.message;
    else if (!yList.ok) correlationError = yList.message;
    else if (xList.values.length !== yList.values.length) {
      correlationError = "The x and y lists must have the same number of values.";
    } else {
      coefficient = correlation(xList.values, yList.values);
      if (coefficient === null) correlationError = "Correlation needs at least two values and variation in each list.";
    }
  }
  return { ok: true, stats, correlation: coefficient, correlationError };
}

module.exports = {
  parseNumberList,
  mean,
  median,
  quantile,
  standardDeviation,
  correlation,
  describe,
  statisticsReport,
};
