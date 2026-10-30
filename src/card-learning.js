"use strict";
/*
 * Small, shared rules for the optional card-learning features.
 *
 * These helpers do not own a scheduler or a queue. The existing attempt path
 * still writes `history`, `next_review` and scheduler state; this module only
 * describes when an opt-in same-day repeat is wanted and how much a known-card
 * streak may lengthen a simple-ladder interval.
 */

const SAME_DAY_GRADES = ["again", "hard"];
const ADAPTIVE_MAX_STREAK = 4;
const ADAPTIVE_STEP = 0.15;

/** Again/Hard can stay due today when the user opted into same-day reviews. */
function isSameDayReview(grade, enabled) {
  return enabled === true && SAME_DAY_GRADES.includes(String(grade || "").trim().toLowerCase());
}

/**
 * Lengthen a ladder interval for a card the learner keeps getting right.
 * A first correct answer has no bonus; each further consecutive correct answer
 * adds 15%, up to four steps, so a well-known card is seen less often.
 */
function adaptiveIntervalDays(days, streak, enabled) {
  const base = Math.max(1, Math.round(Number(days) || 1));
  if (enabled !== true) return base;
  const known = Math.max(0, Math.min(ADAPTIVE_MAX_STREAK, Math.round(Number(streak) || 0) - 1));
  return Math.min(3650, Math.max(base, Math.round(base * (1 + known * ADAPTIVE_STEP))));
}

module.exports = {
  SAME_DAY_GRADES,
  ADAPTIVE_MAX_STREAK,
  ADAPTIVE_STEP,
  isSameDayReview,
  adaptiveIntervalDays,
};
