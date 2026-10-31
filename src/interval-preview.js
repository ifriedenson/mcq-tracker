"use strict";
/*
 * Read-only rating previews for card review. Given the card's current state and
 * its deck scheduler, return the interval each rating would schedule without
 * writing anything. Ladder timing mirrors notes.applyAttempt; SM-2 and FSRS use
 * their own pure reviewNote helpers.
 */
const sm2 = require("./sm2");
const fsrs = require("./fsrs");
const { schedulerForDeck } = require("./cards");

const RATING_GRADES = [
  ["again", 1],
  ["hard", 2],
  ["good", 3],
  ["easy", 4],
];

function asDate(value) {
  return value instanceof Date && !isNaN(value.getTime()) ? value : new Date();
}

function ladderDays(fm, intervals, grade) {
  const iv = Array.isArray(intervals) && intervals.length ? intervals : [1, 3, 7, 21, 60];
  const streak = Math.max(0, Math.round(Number(fm && fm.streak) || 0));
  if (grade === "again") return 1;
  if (grade === "hard") return 2;
  if (grade === "easy") return iv[Math.min(Math.max(streak, 1), iv.length - 1)];
  return iv[Math.min(Math.max(streak, 1) - 1, iv.length - 1)];
}

/** Days per rating for the card's current deck, or null entries on error. */
function intervalPreviews(fm, deckName, settings, now) {
  const at = asDate(now);
  const cfg = schedulerForDeck(settings || {}, deckName, fm);
  const out = {};
  for (const [grade, rating] of RATING_GRADES) {
    try {
      if (cfg.scheduler === "fsrs") {
        out[grade] = fsrs.reviewNote(fm, { rating, now: at }, cfg.fsrsRetention).days;
      } else if (cfg.scheduler === "sm2") {
        out[grade] = sm2.reviewNote(fm, { rating, now: at }, cfg.sm2).days;
      } else {
        out[grade] = ladderDays(fm, cfg.intervals, grade);
      }
    } catch (e) {
      out[grade] = null;
    }
  }
  return out;
}

/** Compact label for a day count: 1d, 2w, 3mo, 1.2y. */
function formatInterval(days) {
  const d = Math.max(0, Math.round(Number(days) || 0));
  if (!d) return "today";
  if (d === 1) return "1d";
  if (d < 14) return `${d}d`;
  if (d < 60) return `${Math.round(d / 7)}w`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

module.exports = {
  RATING_GRADES,
  formatInterval,
  intervalPreviews,
  ladderDays,
};
