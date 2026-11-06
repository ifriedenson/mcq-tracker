"use strict";
/*
 * Cram sessions use compressed review times instead of the normal ladder,
 * SM-2 or FSRS intervals. The values are minutes, so the attempt writer can
 * store an exact due timestamp while cards without a cram timestamp keep the
 * existing date-only scheduling behaviour.
 */
const CRAM_INTERVALS = Object.freeze({
  again: 3,
  hard: 5,
  good: 10,
  easy: 1440,
});
const CRAM_GRADES = Object.freeze(["again", "hard", "good", "easy"]);

function normalizeCramGrade(value) {
  const grade = String(value === undefined || value === null ? "" : value).trim().toLowerCase();
  return CRAM_GRADES.includes(grade) ? grade : "";
}

function cramIntervalMinutes(grade) {
  return CRAM_INTERVALS[normalizeCramGrade(grade)] || 0;
}

/** Exact due time for a cram rating, or null for an unknown grade. */
function cramDueAt(now, grade) {
  const minutes = cramIntervalMinutes(grade);
  if (!minutes) return null;
  const at = now instanceof Date && !isNaN(now.getTime()) ? new Date(now.getTime()) : new Date();
  return new Date(at.getTime() + minutes * 60000);
}

/** Compact label used on the rating buttons. */
function cramIntervalLabel(grade) {
  const minutes = cramIntervalMinutes(grade);
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  if (minutes === 1440) return "1d";
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  return `${Math.round(minutes / 60)}h`;
}

/** The same shape as intervalPreviews, but in minutes for a cram session. */
function cramPreviews() {
  return {
    again: CRAM_INTERVALS.again,
    hard: CRAM_INTERVALS.hard,
    good: CRAM_INTERVALS.good,
    easy: CRAM_INTERVALS.easy,
  };
}

/**
 * Snapshot a mother-cram loop. Mother cram is practice only: it keeps no
 * scheduler state, so the whole card list is the loop from the first turn.
 */
function motherCramStart(cards) {
  return Array.isArray(cards) ? cards.slice() : [];
}

/**
 * One binary mother-cram turn. A known card leaves the loop; an unknown card
 * goes to the back. The returned card is the one that was just answered, and
 * `queue` is the next loop state.
 */
function motherCramTurn(queue, known) {
  const next = Array.isArray(queue) ? queue.slice() : [];
  const card = next.length ? next.shift() : null;
  if (card && known !== true) next.push(card);
  return { card, queue: next, known: known === true };
}

module.exports = {
  CRAM_GRADES,
  CRAM_INTERVALS,
  cramDueAt,
  cramIntervalLabel,
  cramIntervalMinutes,
  cramPreviews,
  motherCramStart,
  motherCramTurn,
  normalizeCramGrade,
};
