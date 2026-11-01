"use strict";
/*
 * Per-deck desired-retention fitting for FSRS.
 *
 * The review permits the smaller step: optimize request_retention per deck and
 * document that the 21 FSRS weights stay at the shipped defaults. This module
 * only reads the review counters cards already keep. It never writes a card or
 * changes a schedule; the plugin applies a recommendation to one deck only
 * after the user presses Apply, and one click resets that deck to the global
 * target. Full multi-weight training is deliberately not implemented.
 */
const { collectReviewRecords, fitRetention, normalizeSchedulerFitSettings } = require("./scheduler-fit");
const { str } = require("./util");

const MIN_RETENTION = 0.85;
const MAX_RETENTION = 0.95;
const DEFAULT_RETENTION = 0.9;

function normalizeRetention(value) {
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(MAX_RETENTION, Math.max(MIN_RETENTION, n)) * 100) / 100;
}

function deckKey(name) {
  return str(name).trim().toLowerCase();
}

/**
 * Fit every deck independently. A deck with a saved override stays visible even
 * when it has no usable review data, so Reset is always reachable.
 */
function fitRetentionDecks(cards, options) {
  const opts = options && typeof options === "object" ? options : {};
  const current = opts.currentRetention && typeof opts.currentRetention === "object" ? opts.currentRetention : {};
  const fallback = normalizeRetention(opts.globalRetention) || DEFAULT_RETENTION;
  const settings = normalizeSchedulerFitSettings({ minSamples: opts.minSamples });
  const currentByKey = new Map();
  for (const [name, value] of Object.entries(current)) {
    if (!str(name).trim()) continue;
    currentByKey.set(deckKey(name), normalizeRetention(value) || fallback);
  }
  const groups = new Map();
  for (const [key, value] of currentByKey.entries()) {
    groups.set(key, { deck: str(Object.keys(current).find((name) => deckKey(name) === key) || key).trim(), records: [], cards: new Set(), current: value });
  }
  for (const record of collectReviewRecords(cards)) {
    const key = deckKey(record.deck) || "unsorted";
    if (!groups.has(key)) groups.set(key, { deck: record.deck || "Unsorted", records: [], cards: new Set(), current: fallback });
    const group = groups.get(key);
    group.records.push(record);
    if (record.path) group.cards.add(record.path);
  }
  return [...groups.values()]
    .map((group) => {
      const currentValue = currentByKey.get(deckKey(group.deck)) || group.current || fallback;
      const fit = fitRetention(group.records, { minSamples: settings.minSamples, current: currentValue });
      const recommended = normalizeRetention(fit.recommended);
      const accepted = fit.ready && recommended !== null && Math.abs(currentValue - recommended) >= 0.001;
      const reason = !fit.ready
        ? fit.advice[0] || `Needs at least ${fit.minSamples} reviews; ${fit.reviews} recorded so far.`
        : accepted
          ? ""
          : "The current target already matches the observed recall.";
      return {
        ...fit,
        deck: group.deck,
        cards: group.cards.size,
        current: currentValue,
        recommended,
        accepted,
        reason,
        custom: Math.abs(currentValue - fallback) >= 0.001,
        weightsFixed: true,
      };
    })
    .sort((a, b) => a.deck.localeCompare(b.deck));
}

function describeFsrsRetentionFit(fit) {
  if (!fit || !Number.isFinite(fit.reviews)) return "No card review history yet.";
  if (!fit.ready) return `Needs at least ${fit.minSamples} reviews; ${fit.reviews} recorded so far.`;
  if (!fit.accepted) return fit.reason || "The current target already matches the observed recall.";
  return `Observed recall ${fit.observedPercent}% across ${fit.reviews} reviews. Target ${fit.current.toFixed(2)} → ${fit.recommended.toFixed(2)}. Weights stay fixed.`;
}

module.exports = {
  DEFAULT_RETENTION,
  MAX_RETENTION,
  MIN_RETENTION,
  describeFsrsRetentionFit,
  fitRetentionDecks,
  normalizeRetention,
};
