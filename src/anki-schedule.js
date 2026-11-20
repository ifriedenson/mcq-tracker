"use strict";
/**
 * Anki export timing. Pure: turns the scheduler state already stored on a note
 * into the (due, interval, reps, lapses) columns an Anki collection expects, so
 * an export keeps the review schedule instead of resetting every card to new.
 */
const { str } = require("./util");

function dayNumber(value) {
  const text = str(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.floor(at / 86400000);
}

/**
 * ankiTiming(fm, today)
 * - due: days from today (0 = due now, negative counted as 0 so nothing is lost)
 * - ivl: interval in whole days, at least 1 for a reviewed card
 * - reps, lapses: carried counters
 * - queue: 0 when never reviewed, 2 when scheduled
 */
function ankiTiming(fm, today) {
  const row = fm || {};
  const reps = Math.max(0, Number(row.attempts) || 0);
  const lapses = Math.max(0, Number(row.lapses) || 0);
  const dueDay = dayNumber(row.next_review);
  const todayDay = dayNumber(today);
  if (!reps) return { due: 0, ivl: 0, reps: 0, lapses, queue: 0 };
  let due = 0;
  if (dueDay !== null && todayDay !== null) due = Math.max(0, dueDay - todayDay);
  const stored = Number(row.interval_days || row.interval || 0);
  const ivl = Math.max(1, Math.round(Number.isFinite(stored) && stored > 0 ? stored : due || 1));
  return { due, ivl, reps, lapses, queue: 2 };
}

module.exports = { ankiTiming };
