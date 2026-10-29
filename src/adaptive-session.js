"use strict";
/*
 * Adaptive session sizing.
 *
 * A short warm-up is better after a rough stretch; a confident learner can
 * stretch a little. This module only recommends a length from recent,
 * local history. The learner always sees and can override the choice, and the
 * configured caps are hard limits.
 */
const { parseHistory } = require("./stats");
const { addDays, fmtDate, str } = require("./util");

const DEFAULT_QUICK_ADAPTIVE = {
  enabled: false,
  useRecommended: true,
  minMinutes: 2,
  maxMinutes: 15,
  minCount: 3,
  maxCount: 20,
  lookbackDays: 21,
};

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeQuickAdaptive(value) {
  const src = value && typeof value === "object" ? value : {};
  const minMinutes = clampInt(src.minMinutes, 1, 60, DEFAULT_QUICK_ADAPTIVE.minMinutes);
  const maxMinutes = clampInt(src.maxMinutes, minMinutes, 90, DEFAULT_QUICK_ADAPTIVE.maxMinutes);
  const minCount = clampInt(src.minCount, 1, 50, DEFAULT_QUICK_ADAPTIVE.minCount);
  const maxCount = clampInt(src.maxCount, minCount, 50, DEFAULT_QUICK_ADAPTIVE.maxCount);
  return {
    enabled: src.enabled === true,
    useRecommended: src.useRecommended !== false,
    minMinutes,
    maxMinutes,
    minCount,
    maxCount,
    lookbackDays: clampInt(src.lookbackDays, 7, 90, DEFAULT_QUICK_ADAPTIVE.lookbackDays),
  };
}

function dayValue(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : fmtDate(value);
  const text = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fmtDate(new Date());
}

function dateFromDay(day) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

/** Recent correctness, logged skips and pace, or nulls when there is not enough history. */
function recentFluency(questions, opts) {
  const o = opts || {};
  const today = dayValue(o.today);
  const days = clampInt(o.lookbackDays, 7, 90, DEFAULT_QUICK_ADAPTIVE.lookbackDays);
  const first = fmtDate(addDays(dateFromDay(today), -days));
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let seconds = 0;
  let targetSeconds = 0;
  for (const q of Array.isArray(questions) ? questions : []) {
    const fm = (q && q.fm) || {};
    const target = Number(fm.target_seconds) || 0;
    for (const entry of parseHistory(fm.history)) {
      const day = str(entry.when).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < first || day > today) continue;
      if (entry.result === "correct") {
        correct++;
        seconds += Math.max(0, Number(entry.seconds) || 0);
        targetSeconds += target;
      } else if (entry.result === "incorrect") {
        incorrect++;
        seconds += Math.max(0, Number(entry.seconds) || 0);
        targetSeconds += target;
      } else if (entry.result === "skipped") {
        skipped++;
      }
    }
  }
  const attempted = correct + incorrect;
  const total = attempted + skipped;
  return {
    attempts: attempted,
    correct,
    incorrect,
    skipped,
    total,
    accuracy: attempted ? correct / attempted : null,
    skipRate: total ? skipped / total : 0,
    avgSeconds: attempted ? seconds / attempted : null,
    averageTarget: attempted ? targetSeconds / attempted : null,
    pace: attempted && targetSeconds ? seconds / targetSeconds : null,
    days,
  };
}

/** Warm up or stretch one base length, respecting the configured hard caps. */
function adaptiveSessionValue(questions, opts) {
  const o = opts || {};
  const settings = normalizeQuickAdaptive(o.settings);
  const kind = o.kind === "count" ? "count" : "time";
  const base =
    kind === "count"
      ? clampInt(o.base, 1, 50, 5)
      : clampInt(o.base, 1, 90, 5);
  const metrics = recentFluency(questions, { today: o.today, lookbackDays: settings.lookbackDays });
  const unchanged = { enabled: settings.enabled, value: base, base, kind, band: "steady", reason: "", metrics };
  if (!settings.enabled) return unchanged;
  if (metrics.attempts < 8) {
    return { ...unchanged, reason: "Not enough recent attempts to adapt yet; using your chosen length." };
  }

  const accuracy = metrics.accuracy === null ? 0 : metrics.accuracy;
  const pace = metrics.pace === null ? 1 : metrics.pace;
  let band = "steady";
  let factor = 1;
  if (accuracy >= 0.8 && metrics.skipRate <= 0.15 && pace <= 1.2) {
    band = "stretch";
    factor = 1.35;
  } else if (accuracy < 0.55 || metrics.skipRate >= 0.3 || pace > 1.5) {
    band = "warmup";
    factor = 0.65;
  }

  const raw = base * factor;
  const value =
    kind === "count"
      ? clampInt(raw, settings.minCount, settings.maxCount, base)
      : clampInt(raw, settings.minMinutes, settings.maxMinutes, base);
  const skipText = metrics.skipped ? ` and ${metrics.skipped} logged skip${metrics.skipped === 1 ? "" : "s"}` : "";
  const paceText = metrics.pace === null ? "" : `, ${Math.round(metrics.pace * 100)}% of target time`;
  const reason = `${Math.round(accuracy * 100)}% recent accuracy${skipText}${paceText}.`;
  return { enabled: true, value, base, kind, band, reason, metrics };
}

/** Daily quiz uses the same signal but never exceeds its configured maximum. */
function adaptiveDailyCount(questions, state, opts) {
  const o = opts || {};
  const base = clampInt(state && state.count, 1, 50, 5);
  const settings = normalizeQuickAdaptive(o.settings);
  const plan = adaptiveSessionValue(questions, { kind: "count", base, today: o.today, settings });
  const max = settings.enabled ? settings.maxCount : base;
  return { ...plan, value: Math.max(1, Math.min(max, plan.value)) };
}

module.exports = {
  DEFAULT_QUICK_ADAPTIVE,
  adaptiveDailyCount,
  adaptiveSessionValue,
  normalizeQuickAdaptive,
  recentFluency,
};
