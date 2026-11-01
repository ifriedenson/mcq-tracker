"use strict";
/*
 * Bounded FSRS weight fitting.
 *
 * Full FSRS training needs a large review log and a validated training policy.
 * This module deliberately fits one weight: w[20], the decay term in the
 * forgetting curve. It replays each card's existing history with the current
 * defaults, scores candidate decay values by binary log-loss, and accepts a
 * candidate only when a chronological held-out tail improves on the default by
 * a fixed margin. A deck with no accepted fit keeps the fixed defaults.
 */
const { parseHistory } = require("./stats");
const { str } = require("./util");
const fsrsLib = require("./fsrs-lib");
const fsrs = require("./fsrs");

const DEFAULT_WEIGHTS = fsrsLib.default_w;
const DECAY_INDEX = 20;
const MIN_DECAY = 0.05;
const MAX_DECAY = 0.5;
const DECAY_STEP = 0.005;
const MIN_REVIEWS = 50;
const MIN_TRAIN = 30;
const MIN_VALIDATION = 10;
const MIN_CARDS = 5;
const MIN_IMPROVEMENT = 0.01;
const MAX_HISTORY_ROWS = 500;
const MAX_POINTS = 5000;

const round = (n) => Number(Number(n).toFixed(4));
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

function normalizeDecay(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(clamp(n, MIN_DECAY, MAX_DECAY) / DECAY_STEP) * DECAY_STEP;
}

/** Build a complete FSRS-6 weight vector that differs only in the decay term. */
function weightsForDecay(value) {
  const decay = normalizeDecay(value);
  if (decay === null) return null;
  const out = DEFAULT_WEIGHTS.slice();
  out[DECAY_INDEX] = Number(decay.toFixed(6));
  return out;
}

/**
 * Accept only the one safe custom shape this module creates: defaults for
 * every state-transition weight, and a bounded decay weight. Anything else is
 * treated as absent so old or hand-edited settings cannot change schedules.
 */
function normalizeFsrsWeights(value) {
  if (!Array.isArray(value) || value.length !== DEFAULT_WEIGHTS.length) return null;
  for (let i = 0; i < DECAY_INDEX; i++) {
    if (!Number.isFinite(Number(value[i])) || Math.abs(Number(value[i]) - DEFAULT_WEIGHTS[i]) > 1e-9) return null;
  }
  return weightsForDecay(value[DECAY_INDEX]);
}

/** Predicted recall for one review under a candidate decay. */
function predictedRecall(stability, elapsedDays, decay) {
  const s = Number(stability);
  const days = Number(elapsedDays);
  const d = normalizeDecay(decay);
  if (!(s > 0) || !(days > 0) || d === null) return null;
  return fsrsLib.forgetting_curve(d, days, s);
}

function logLoss(points, decay) {
  let total = 0;
  let used = 0;
  for (const point of points) {
    const p = predictedRecall(point.stability, point.elapsed, decay);
    if (p === null || !Number.isFinite(p)) continue;
    const y = point.correct ? 1 : 0;
    const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
    total += -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
    used++;
  }
  return used ? total / used : null;
}

/**
 * Collect one training point per review after the first. The state is replayed
 * with the fixed defaults, so changing a candidate decay never rewrites a note
 * or changes the source history; old binary and counter-only rows still work.
 */
function collectDecayPoints(cards, options) {
  const opts = options && typeof options === "object" ? options : {};
  const now = opts.now instanceof Date && !isNaN(opts.now.getTime()) ? opts.now : new Date();
  const points = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = card && card.fm && typeof card.fm === "object" ? card.fm : null;
    if (!fm) continue;
    // Only cards that have actually been scheduled by FSRS contribute; a
    // ladder-only card has no FSRS state to validate against.
    if (!str(fm.srs).startsWith("fsrs")) continue;
    const deck = str(card.deck || fm.deck || fm.deck_name).trim() || "Unsorted";
    const path = str(card.file && card.file.path);
    const entries = parseHistory(fm.history)
      .map((entry) => ({ ...entry, at: new Date(entry.when) }))
      .filter((entry) => !isNaN(entry.at.getTime()) && entry.at.getTime() <= now.getTime())
      .filter((entry) => entry.result === "correct" || entry.result === "incorrect")
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_HISTORY_ROWS);
    if (entries.length < 2) continue;
    const scheduler = fsrs.makeScheduler(opts.retention, null);
    let state = fsrsLib.createEmptyCard(entries[0].at);
    let previous = null;
    for (const entry of entries) {
      if (previous && state.stability > 0 && entry.at > previous) {
        const elapsed = (entry.at.getTime() - previous.getTime()) / 86400000;
        if (elapsed > 0) {
          points.push({
            when: entry.at.getTime(),
            deck,
            path,
            stability: Number(state.stability),
            elapsed,
            correct: entry.result === "correct",
          });
        }
      }
      const rating = fsrs.gradeForAttempt(entry.result === "correct", entry.conf, entry.seconds, fm.target_seconds);
      try {
        state = scheduler.next(state, entry.at, rating).card;
        previous = entry.at;
      } catch (_) {
        break;
      }
    }
  }
  return points.sort((a, b) => a.when - b.when).slice(-MAX_POINTS);
}

function reject(reason, extra) {
  return {
    accepted: false,
    reason,
    defaultDecay: DEFAULT_WEIGHTS[DECAY_INDEX],
    weights: null,
    fittedDecay: null,
    ...extra,
  };
}

/**
 * Fit one deck's decay from its points. The last 20% of reviews (by time) is
 * never used to choose the candidate; it only decides whether the fit is good
 * enough to apply. This keeps the test honest on small histories.
 */
function fitDecay(points, options) {
  const opts = options && typeof options === "object" ? options : {};
  const list = (Array.isArray(points) ? points : [])
    .filter((point) => point && Number(point.stability) > 0 && Number(point.elapsed) > 0)
    .sort((a, b) => Number(a.when) - Number(b.when));
  const cardCount = Math.max(0, Math.round(Number(opts.cards) || 0));
  const minReviews = Math.max(MIN_REVIEWS, Math.round(Number(opts.minReviews) || MIN_REVIEWS));
  const minCards = Math.max(1, Math.round(Number(opts.minCards) || MIN_CARDS));
  const minImprovement = Number.isFinite(Number(opts.minImprovement)) ? Number(opts.minImprovement) : MIN_IMPROVEMENT;
  const base = { samples: list.length, cards: cardCount, minReviews, minCards, minImprovement };
  if (list.length < minReviews) return reject(`Needs at least ${minReviews} reviews; ${list.length} available.`, base);
  if (cardCount < minCards) return reject(`Needs at least ${minCards} cards; ${cardCount} available.`, base);
  const validationCount = Math.max(MIN_VALIDATION, Math.round(list.length * 0.2));
  const train = list.slice(0, list.length - validationCount);
  const validation = list.slice(list.length - validationCount);
  if (train.length < MIN_TRAIN || validation.length < MIN_VALIDATION) {
    return reject(`Needs at least ${MIN_TRAIN} training and ${MIN_VALIDATION} held-out reviews.`, { ...base, train: train.length, validation: validation.length });
  }
  const defaultDecay = DEFAULT_WEIGHTS[DECAY_INDEX];
  const baselineTrainLoss = logLoss(train, defaultDecay);
  const baselineValidationLoss = logLoss(validation, defaultDecay);
  let bestDecay = null;
  let bestTrainLoss = Infinity;
  for (let d = MIN_DECAY; d <= MAX_DECAY + 1e-9; d += DECAY_STEP) {
    const loss = logLoss(train, d);
    if (loss !== null && loss < bestTrainLoss) {
      bestTrainLoss = loss;
      bestDecay = d;
    }
  }
  if (bestDecay === null) return reject("No candidate could be scored.", base);
  const fittedValidationLoss = logLoss(validation, bestDecay);
  const improvement = baselineValidationLoss === null || fittedValidationLoss === null ? 0 : baselineValidationLoss - fittedValidationLoss;
  const weights = weightsForDecay(bestDecay);
  const metrics = {
    ...base,
    train: train.length,
    validation: validation.length,
    defaultDecay,
    fittedDecay: Number(bestDecay.toFixed(6)),
    weights,
    baselineTrainLoss: baselineTrainLoss === null ? null : round(baselineTrainLoss),
    trainLoss: round(bestTrainLoss),
    baselineValidationLoss: baselineValidationLoss === null ? null : round(baselineValidationLoss),
    validationLoss: fittedValidationLoss === null ? null : round(fittedValidationLoss),
    improvement: round(improvement),
  };
  if (Math.abs(bestDecay - defaultDecay) < DECAY_STEP / 2) {
    return reject("The fit is already at the default decay; nothing to apply.", { ...metrics, weights: null, fittedDecay: null });
  }
  if (improvement < minImprovement) {
    return reject(`Held-out loss improved by ${round(improvement)}; needs at least ${minImprovement}.`, { ...metrics, weights: null });
  }
  return { accepted: true, reason: "", ...metrics };
}

/** Fit every deck independently. Decks without custom weights inherit defaults. */
function fitFsrsDecks(cards, options) {
  const opts = options && typeof options === "object" ? options : {};
  const currentWeights = opts.currentWeights && typeof opts.currentWeights === "object" ? opts.currentWeights : {};
  const points = collectDecayPoints(cards, opts);
  const groups = new Map();
  // A deck with saved custom weights must remain visible so its one-click
  // reset is available even when no usable review points remain.
  for (const deck of Object.keys(currentWeights)) groups.set(deck, { points: [], cards: new Set() });
  for (const point of points) {
    if (!groups.has(point.deck)) groups.set(point.deck, { points: [], cards: new Set() });
    const group = groups.get(point.deck);
    group.points.push(point);
    if (point.path) group.cards.add(point.path);
  }
  return [...groups.entries()]
    .map(([deck, group]) => {
      const custom = normalizeFsrsWeights(currentWeights[deck]);
      const fit = fitDecay(group.points, {
        ...opts,
        cards: group.cards.size,
      });
      return {
        deck,
        cards: group.cards.size,
        custom: Boolean(custom),
        currentDecay: custom ? custom[DECAY_INDEX] : DEFAULT_WEIGHTS[DECAY_INDEX],
        ...fit,
      };
    })
    .sort((a, b) => a.deck.localeCompare(b.deck));
}

function describeFsrsFit(fit) {
  if (!fit) return "No card review history yet.";
  if (!fit.accepted) return fit.reason || "No validated fit is available.";
  return `Decay ${fit.defaultDecay.toFixed(3)} → ${fit.fittedDecay.toFixed(3)}; held-out loss improved by ${fit.improvement.toFixed(3)} across ${fit.samples} reviews.`;
}

module.exports = {
  DECAY_INDEX,
  DEFAULT_WEIGHTS,
  MIN_DECAY,
  MAX_DECAY,
  DECAY_STEP,
  MIN_REVIEWS,
  MIN_CARDS,
  MIN_IMPROVEMENT,
  collectDecayPoints,
  describeFsrsFit,
  fitDecay,
  fitFsrsDecks,
  normalizeDecay,
  normalizeFsrsWeights,
  predictedRecall,
  weightsForDecay,
};
