"use strict";
/*
 * Scheduler self-fitting. LearnKit and Qard both fit the desired retention
 * from the user's own review history instead of leaving one global target.
 * This module does the same locally and conservatively: it reads the counters
 * every card note already keeps, groups them by scheduled interval, and
 * recommends a desired-retention value inside a safe band. It never writes a
 * schedule by itself; the Retention tab offers the recommendation as a button
 * that changes the existing `fsrsRetention` setting.
 */
const { str } = require("./util");

const DEFAULT_MIN_SAMPLES = 20;
const MIN_SAMPLES = 10;
const MAX_SAMPLES = 500;
const RETENTION_FLOOR = 0.8;
const RETENTION_CEILING = 0.95;
const RETENTION_STEP = 0.05;

const BUCKETS = [
  { key: "short", label: "1-3 days", low: 0, high: 3 },
  { key: "week", label: "4-10 days", low: 4, high: 10 },
  { key: "fortnight", label: "11-30 days", low: 11, high: 30 },
  { key: "month", label: "31-90 days", low: 31, high: 90 },
  { key: "long", label: "90+ days", low: 91, high: Infinity },
];

function normalizeSchedulerFitSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const raw = Number(source.minSamples);
  return {
    enabled: !(value === false || source.enabled === false),
    minSamples: Number.isFinite(raw) ? Math.max(MIN_SAMPLES, Math.min(MAX_SAMPLES, Math.round(raw))) : DEFAULT_MIN_SAMPLES,
  };
}

/** Review counters from card notes. Fresh cards (no reviews) are skipped. */
function collectReviewRecords(cards) {
  const records = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = card && card.fm && typeof card.fm === "object" ? card.fm : null;
    if (!fm) continue;
    const attempts = Math.max(0, Math.round(Number(fm.attempts) || 0));
    if (!attempts) continue;
    const correct = Math.max(0, Math.min(attempts, Math.round(Number(fm.correct_count) || 0)));
    const interval = Math.max(0, Math.round(Number(fm.interval) || 0));
    records.push({
      path: str(card.file && card.file.path),
      deck: str(card.deck).trim() || "Unsorted",
      attempts,
      correct,
      interval,
    });
  }
  return records;
}

function bucketFor(interval) {
  return BUCKETS.find((bucket) => interval >= bucket.low && interval <= bucket.high) || BUCKETS[0];
}

function roundRetention(value) {
  const stepped = Math.round(value / RETENTION_STEP) * RETENTION_STEP;
  return Math.round(Math.max(RETENTION_FLOOR, Math.min(RETENTION_CEILING, stepped)) * 100) / 100;
}

/**
 * Fit a desired retention from observed recall. `fitRetention` is pure: the
 * caller decides whether to apply the suggestion.
 */
function fitRetention(records, options) {
  const opts = options && typeof options === "object" ? options : {};
  const settings = normalizeSchedulerFitSettings({ minSamples: opts.minSamples });
  const list = Array.isArray(records) ? records : [];
  const buckets = BUCKETS.map((bucket) => ({ key: bucket.key, label: bucket.label, reviews: 0, correct: 0, accuracy: 0 }));
  let reviews = 0;
  let correct = 0;
  for (const record of list) {
    const fm = record && record.fm && typeof record.fm === "object" ? record.fm : record;
    if (!fm || typeof fm !== "object") continue;
    const attempts = Math.max(0, Math.round(Number(fm.attempts) || 0));
    if (!attempts) continue;
    const hits = Math.max(0, Math.min(attempts, Math.round(Number(fm.correct_count !== undefined ? fm.correct_count : fm.correct) || 0)));
    reviews += attempts;
    correct += hits;
    const bucket = buckets.find((entry) => entry.key === bucketFor(Math.max(0, Number(fm.interval) || 0)).key);
    if (bucket) {
      bucket.reviews += attempts;
      bucket.correct += hits;
    }
  }
  for (const bucket of buckets) bucket.accuracy = bucket.reviews ? bucket.correct / bucket.reviews : 0;
  const observed = reviews ? correct / reviews : 0;
  const ready = reviews >= settings.minSamples;
  const recommended = ready ? roundRetention(observed) : null;
  const used = buckets.filter((bucket) => bucket.reviews >= 3);
  const trend = used.length >= 2 ? used[used.length - 1].accuracy - used[0].accuracy : 0;
  const confidence = reviews >= 100 ? "high" : reviews >= settings.minSamples ? "medium" : "low";
  const advice = [];
  if (!ready) {
    advice.push(`Rate at least ${settings.minSamples} reviews before fitting; ${reviews} recorded so far.`);
  } else {
    if (observed < RETENTION_FLOOR) advice.push("Observed recall is below the safe band; keep the default target and shorten intervals instead.");
    if (observed > RETENTION_CEILING) advice.push("Observed recall is high; a slightly lower target trades a little recall for fewer reviews.");
    if (trend < -0.15) advice.push("Recall drops sharply on long intervals; review those cards sooner.");
  }
  return {
    cards: list.length,
    reviews,
    correct,
    observed,
    observedPercent: reviews ? Math.round(observed * 100) : 0,
    ready,
    recommended,
    confidence,
    minSamples: settings.minSamples,
    current: Number.isFinite(Number(opts.current)) ? Math.round(Number(opts.current) * 100) / 100 : null,
    buckets,
    trend,
    advice,
  };
}

function describeFit(fit) {
  if (!fit || !Number.isFinite(fit.reviews)) return "No review history yet.";
  if (!fit.ready) return `${fit.reviews} review${fit.reviews === 1 ? "" : "s"} recorded. Fit needs at least ${fit.minSamples || DEFAULT_MIN_SAMPLES}.`;
  const target = typeof fit.recommended === "number" ? fit.recommended.toFixed(2) : "—";
  const change = fit.current !== null && typeof fit.recommended === "number" && Math.abs(fit.current - fit.recommended) >= 0.001
    ? ` (currently ${fit.current.toFixed(2)})`
    : "";
  return `Observed recall ${fit.observedPercent}% across ${fit.reviews} reviews. Suggested target ${target}${change}.`;
}

module.exports = {
  BUCKETS,
  DEFAULT_MIN_SAMPLES,
  RETENTION_CEILING,
  RETENTION_FLOOR,
  collectReviewRecords,
  describeFit,
  fitRetention,
  normalizeSchedulerFitSettings,
};
