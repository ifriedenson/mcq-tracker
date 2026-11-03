"use strict";
/*
 * Graph-paper settings for the Reference graph: grid and axis visibility plus an
 * optional fixed grid step. The module only validates settings and computes line
 * positions; no DOM, Obsidian, storage or network import lives here, and every
 * unusable value is a `{ok:false, reason, message}` refusal.
 */

const PAPER_DEFAULTS = { grid: true, axes: true, step: null };
const PAPER_LIMITS = { minStep: 0.001, maxStep: 1000, maxLines: 240 };

function refusal(reason, message) {
  return { ok: false, reason, message };
}

function formatStep(value) {
  return String(Number(Number(value).toPrecision(6)));
}

/** An empty value means automatic spacing; anything else must be a sane step. */
function parseGridStep(value) {
  if (value === undefined || value === null || String(value).trim() === "") return { ok: true, step: null };
  const number = Number(value);
  if (!Number.isFinite(number)) return refusal("step", "Enter a grid step number, or leave it empty for automatic spacing.");
  if (!(number > 0)) return refusal("step", "The grid step must be greater than 0.");
  if (number < PAPER_LIMITS.minStep) return refusal("step", `The grid step must be at least ${PAPER_LIMITS.minStep}.`);
  if (number > PAPER_LIMITS.maxStep) return refusal("step", `The grid step must be at most ${PAPER_LIMITS.maxStep}.`);
  return { ok: true, step: number };
}

/** A canonical setting; an invalid stored step falls back to automatic spacing. */
function normalizePaper(value) {
  const source = value && typeof value === "object" ? value : {};
  const parsed = parseGridStep(source.step);
  return {
    grid: source.grid !== false,
    axes: source.axes !== false,
    step: parsed.ok ? parsed.step : null,
  };
}

function positions(min, max, step, limit) {
  const values = [];
  const first = Math.ceil(min / step - 1e-9);
  for (let i = first; i * step <= max + 1e-9; i++) {
    if (values.length >= limit) return { ok: false, values };
    values.push(Number((i * step).toPrecision(12)));
  }
  return { ok: true, values };
}

/**
 * Grid-line positions for a fixed step, or empty lists for automatic spacing.
 * A step that would draw more than PAPER_LIMITS lines in this window is refused
 * instead of locking the canvas; the view then keeps the automatic grid.
 */
function paperTicks(paper, view) {
  const value = normalizePaper(paper);
  if (value.step === null) return { ok: true, step: null, vertical: [], horizontal: [], minorVertical: [], minorHorizontal: [] };
  const xMin = Number(view && view.xMin);
  const xMax = Number(view && view.xMax);
  const yMin = Number(view && view.yMin);
  const yMax = Number(view && view.yMax);
  if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || !(xMax > xMin) || !(yMax > yMin)) {
    return refusal("view", "The graph window cannot place a grid with that step.");
  }
  const vertical = positions(xMin, xMax, value.step, PAPER_LIMITS.maxLines + 1);
  const horizontal = positions(yMin, yMax, value.step, PAPER_LIMITS.maxLines + 1);
  if (!vertical.ok || !horizontal.ok) return refusal("step", "That grid step draws too many lines in this window; use a larger step.");
  const minorStep = value.step / 5;
  const minorVertical = positions(xMin, xMax, minorStep, PAPER_LIMITS.maxLines * 5 + 1);
  const minorHorizontal = positions(yMin, yMax, minorStep, PAPER_LIMITS.maxLines * 5 + 1);
  return {
    ok: true,
    step: value.step,
    vertical: vertical.values,
    horizontal: horizontal.values,
    minorVertical: minorVertical.ok ? minorVertical.values : [],
    minorHorizontal: minorHorizontal.ok ? minorHorizontal.values : [],
  };
}

/** One sentence for the live region and the settings descriptions. */
function paperSummary(paper) {
  const value = normalizePaper(paper);
  const grid = value.grid ? "grid shown" : "grid hidden";
  const axes = value.axes ? "axes shown" : "axes hidden";
  const step = value.step === null ? "an automatic grid step" : `a grid step of ${formatStep(value.step)}`;
  return `Graph paper with the ${grid}, ${axes} and ${step}.`;
}

module.exports = {
  PAPER_DEFAULTS,
  PAPER_LIMITS,
  parseGridStep,
  normalizePaper,
  paperTicks,
  paperSummary,
};
