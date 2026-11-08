"use strict";
/*
 * Multi-weight FSRS training.
 *
 * A memory model with the 19 FSRS-5 weights (`stability`, `difficulty`, recall
 * probability), a binary cross-entropy loss over a card's real review sequence,
 * and a deterministic optimiser (central-difference gradient, bounded step with
 * halving). Nothing is downloaded or sampled: the weights are fitted to the
 * reviews the vault already stores, and every weight is clamped to a sane range
 * so a bad history cannot produce a negative interval.
 */
const { clamp, str } = require("./util");

const DEFAULT_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395,
  0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const MIN_REVIEWS = 30;
const MAX_WEIGHT = 36500;
const MIN_WEIGHT = 0.001;

function weight(value) {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, MIN_WEIGHT, MAX_WEIGHT) : MIN_WEIGHT;
}

/** Copy 19 finite, in-range weights, or null when the list is not one. */
function normalizeWeights(list) {
  if (!Array.isArray(list) || list.length !== DEFAULT_WEIGHTS.length) return null;
  const out = list.map((value) => Number(value));
  if (out.some((value) => !Number.isFinite(value))) return null;
  return out.map((value) => weight(value));
}

/** Probability the card is still recalled after `elapsed` days at `stability`. */
function retrievability(stability, elapsed) {
  const s = Math.max(MIN_WEIGHT, Number(stability) || 0);
  const t = Math.max(0, Number(elapsed) || 0);
  return clamp(Math.pow(1 + (FACTOR * t) / s, DECAY), 0, 1);
}

function initialStability(grade, weights) {
  return weight(weights[clamp(Math.round(grade), 1, 4) - 1]);
}

function initialDifficulty(grade, weights) {
  return clamp(weights[4] - Math.exp(weights[5] * (clamp(Math.round(grade), 1, 4) - 1)) + 1, 1, 10);
}

function nextDifficulty(difficulty, grade, weights) {
  const target = initialDifficulty(4, weights);
  const raw = weights[7] * target + (1 - weights[7]) * (difficulty - weights[6] * (grade - 3));
  return clamp(raw, 1, 10);
}

function nextStability(stability, difficulty, recall, grade, weights) {
  if (grade === 1) {
    const lapsed =
      weights[11] *
      Math.pow(difficulty, -weights[12]) *
      (Math.pow(Math.max(0, stability) + 1, weights[13]) - 1) *
      Math.exp(weights[14] * (1 - recall));
    return weight(lapsed);
  }
  const hard = grade === 2 ? weights[15] : 1;
  const easy = grade === 4 ? weights[16] : 1;
  const growth =
    1 +
    Math.exp(weights[8]) *
      (11 - difficulty) *
      Math.pow(Math.max(0, stability), -weights[9]) *
      (Math.exp(weights[10] * (1 - recall)) - 1) *
      hard *
      easy;
  return weight(stability * Math.max(1, growth));
}

/** Reviews as [{ path, grade, day }] with grade 1–4 and a whole-day timeline. */
function normalizeReviews(reviews) {
  const merged = new Map();
  for (const row of Array.isArray(reviews) ? reviews : []) {
    if (!row || typeof row !== "object") continue;
    const grade = Math.round(Number(row.grade));
    const day = Number(row.day);
    if (!Number.isFinite(grade) || grade < 1 || grade > 4) continue;
    if (!Number.isFinite(day) || day < 0) continue;
    const path = str(row.path).trim() || "card";
    if (!merged.has(path)) merged.set(path, []);
    merged.get(path).push({ grade, day });
  }
  const out = [];
  for (const [path, rows] of merged.entries()) {
    const ordered = rows.slice().sort((a, b) => a.day - b.day);
    let previous = ordered[0].day;
    for (const row of ordered) {
      out.push({ path, grade: row.grade, elapsed: Math.max(0, row.day - previous) });
      previous = row.day;
    }
  }
  return out;
}

/** Mean binary cross-entropy over every predicted recall, plus light regularisation. */
function loss(weights, reviews, rows) {
  const w = weights;
  const list = rows || normalizeReviews(reviews);
  let total = 0;
  let count = 0;
  let state = null;
  let current = "";
  for (const row of list) {
    if (row.path !== current) {
      current = row.path;
      state = null;
    }
    if (!state) {
      state = { s: initialStability(row.grade, w), d: initialDifficulty(row.grade, w) };
      continue;
    }
    const recall = retrievability(state.s, row.elapsed);
    const p = clamp(recall, 1e-4, 1 - 1e-4);
    const correct = row.grade >= 3 ? 1 : 0;
    total += -(correct * Math.log(p) + (1 - correct) * Math.log(1 - p));
    count += 1;
    state = {
      s: nextStability(state.s, state.d, recall, row.grade, w),
      d: nextDifficulty(state.d, row.grade, w),
    };
  }
  const mean = count ? total / count : 0;
  let regularisation = 0;
  for (let i = 0; i < DEFAULT_WEIGHTS.length; i++) {
    const scale = Math.max(1, DEFAULT_WEIGHTS[i]);
    const diff = (w[i] - DEFAULT_WEIGHTS[i]) / scale;
    regularisation += 0.01 * diff * diff;
  }
  return mean + regularisation;
}

/**
 * Fit the weights to the vault's own review history. Returns
 * `{ ok: false, reason }` when there is too little history to learn from, and
 * `{ ok: true, weights, loss, initialLoss, reviews, iterations }` otherwise.
 */
function trainWeights(reviews, options) {
  const rows = normalizeReviews(reviews);
  const opts = options && typeof options === "object" ? options : {};
  if (rows.length < MIN_REVIEWS) {
    return { ok: false, reason: "reviews", reviews: rows.length, minReviews: MIN_REVIEWS };
  }
  const iterations = Math.round(clamp(Number(opts.iterations) || 40, 1, 200));
  const start = normalizeWeights(opts.start) || DEFAULT_WEIGHTS.map((value, index) => weight(value * (1 + 0.1 * Math.sin(index + 1))));
  let weights = start.slice();
  const initialLoss = loss(weights, null, rows);
  let best = initialLoss;
  let step = 0.05;
  let used = 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    used = iteration + 1;
    const gradient = weights.map((value, index) => {
      const epsilon = 1e-4;
      const up = weights.slice();
      const down = weights.slice();
      up[index] = value + epsilon;
      down[index] = value - epsilon;
      return (loss(up, null, rows) - loss(down, null, rows)) / (2 * epsilon);
    });
    const next = weights.map((value, index) => clamp(value - step * gradient[index], MIN_WEIGHT, MAX_WEIGHT));
    const nextLoss = loss(next, null, rows);
    if (nextLoss < best) {
      weights = next;
      best = nextLoss;
    } else {
      step /= 2;
      if (step < 1e-4) break;
    }
  }
  return {
    ok: true,
    weights,
    loss: best,
    initialLoss,
    reviews: rows.length,
    cards: new Set(rows.map((row) => row.path)).size,
    iterations: used,
  };
}

module.exports = {
  DEFAULT_WEIGHTS,
  MIN_REVIEWS,
  initialDifficulty,
  initialStability,
  loss,
  nextDifficulty,
  nextStability,
  normalizeReviews,
  normalizeWeights,
  retrievability,
  trainWeights,
};
