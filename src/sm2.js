"use strict";
/*
 * Clean-room SM-2 scheduler adapter for MCQ Tracker.
 *
 * Better Recall (MIT) uses an Anki-style SM-2 scheduler; this file is an
 * independent implementation of the published SM-2 rules, adapted to notes
 * that store a date rather than a time. The compact state lives in the note's
 * `sm2` property:
 *
 *   sm2|reps|interval|ease|due|last_review|lapses
 *
 * No third-party scheduler code is copied here. History remains the source of
 * truth: a note that has never used SM-2 replays its existing attempts once so
 * switching a deck to SM-2 does not reset its progress.
 */
const { addDays, fmtDate, str } = require("./util");
const { parseHistory } = require("./stats");

const SRS_VERSION = "sm2";
const MAX_REPLAY = 500;

const DEFAULT_SM2 = Object.freeze({
  startingEase: 2.5,
  minEase: 1.3,
  graduatingInterval: 1,
  easyInterval: 4,
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  easeDecrement: 0.2,
  easeIncrement: 0.15,
  maxInterval: 3650,
});

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const clampInt = (value, min, max, fallback) => Math.round(clampNumber(value, min, max, fallback));
const ease = (value) => Number(Number(value).toFixed(6));

/** Merge a saved deck's SM-2 timing with defaults, clamping every field. */
function normalizeSm2(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const minEase = clampNumber(raw.minEase, 1.3, 5, DEFAULT_SM2.minEase);
  const startingEase = Math.max(minEase, clampNumber(raw.startingEase, 1.3, 5, DEFAULT_SM2.startingEase));
  return {
    startingEase: ease(startingEase),
    minEase: ease(minEase),
    graduatingInterval: clampInt(raw.graduatingInterval, 1, 365, DEFAULT_SM2.graduatingInterval),
    easyInterval: clampInt(raw.easyInterval, 1, 3650, DEFAULT_SM2.easyInterval),
    hardMultiplier: ease(clampNumber(raw.hardMultiplier, 1, 10, DEFAULT_SM2.hardMultiplier)),
    easyBonus: ease(clampNumber(raw.easyBonus, 1, 10, DEFAULT_SM2.easyBonus)),
    easeDecrement: ease(clampNumber(raw.easeDecrement, 0, 2, DEFAULT_SM2.easeDecrement)),
    easeIncrement: ease(clampNumber(raw.easeIncrement, 0, 2, DEFAULT_SM2.easeIncrement)),
    maxInterval: clampInt(raw.maxInterval, 1, 36500, DEFAULT_SM2.maxInterval),
  };
}

const iso = (d) => (d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : "-");
const num = (n) => (Number.isFinite(Number(n)) ? Number(Number(n).toFixed(6)) : 0);

function encodeSm2(state) {
  return [
    SRS_VERSION,
    Math.max(0, Math.round(Number(state.reps) || 0)),
    Math.max(0, Math.round(Number(state.interval) || 0)),
    num(state.ease || DEFAULT_SM2.startingEase),
    iso(state.due),
    iso(state.last),
    Math.max(0, Math.round(Number(state.lapses) || 0)),
  ].join("|");
}

function decodeSm2(value) {
  const text = str(value).trim();
  if (!text.startsWith(SRS_VERSION + "|")) return null;
  const p = text.split("|");
  if (p.length !== 7) return null;
  const reps = Number(p[1]);
  const interval = Number(p[2]);
  const easeValue = Number(p[3]);
  const due = new Date(p[4]);
  const last = p[5] === "-" ? null : new Date(p[5]);
  const lapses = Number(p[6]);
  if (![reps, interval, easeValue, lapses].every(Number.isFinite)) return null;
  if (reps < 0 || interval < 0 || lapses < 0) return null;
  if (easeValue < 1 || easeValue > 10) return null;
  if (isNaN(due.getTime()) || (last && isNaN(last.getTime()))) return null;
  return { reps: Math.round(reps), interval: Math.round(interval), ease: easeValue, due, last, lapses: Math.round(lapses) };
}

function emptySm2(now) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  return encodeSm2({
    reps: 0,
    interval: 0,
    ease: DEFAULT_SM2.startingEase,
    due: at,
    last: null,
    lapses: 0,
  });
}

/**
 * Turn an attempt into an SM-2 quality. Notes carry correctness, confidence
 * and time rather than a button, so a slow or unsure correct answer maps to
 * Hard, a confident fast answer to Easy, and everything else to Good.
 */
function gradeForAttempt(correct, conf, seconds, target) {
  if (!correct) return 1;
  const c = Number(conf) || 0;
  const t = Number(target) || 0;
  const s = Number(seconds) || 0;
  if (c === 1) return 2;
  if (t > 0 && s > t * 1.5) return 2;
  if (c === 3 && t > 0 && s <= t * 0.75) return 4;
  return 3;
}

/** One SM-2 review, returning the next compact state without waiting to write it. */
function scheduleState(previous, rating, now, options) {
  const opts = normalizeSm2(options);
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const grade = [1, 2, 3, 4].includes(Number(rating)) ? Number(rating) : 3;
  let reps = Math.max(0, Math.round(Number(previous && previous.reps) || 0));
  let interval = Math.max(0, Math.round(Number(previous && previous.interval) || 0));
  let easeFactor = clampNumber(previous && previous.ease, 1.3, 10, opts.startingEase);
  let lapses = Math.max(0, Math.round(Number(previous && previous.lapses) || 0));

  if (grade === 1) {
    reps = 0;
    interval = 1;
    lapses += 1;
    easeFactor = Math.max(opts.minEase, easeFactor - opts.easeDecrement);
  } else if (reps === 0) {
    interval = grade === 4 ? opts.easyInterval : opts.graduatingInterval;
    reps = 1;
    if (grade === 4) easeFactor += opts.easeIncrement;
  } else if (reps === 1) {
    interval = grade === 2 ? Math.max(1, Math.round(interval * opts.hardMultiplier)) : grade === 4 ? Math.max(6, Math.round(6 * easeFactor * opts.easyBonus)) : 6;
    reps = 2;
    if (grade === 4) easeFactor += opts.easeIncrement;
  } else {
    const multiplier = grade === 2 ? opts.hardMultiplier : grade === 4 ? easeFactor * opts.easyBonus : easeFactor;
    interval = Math.max(1, Math.round(interval * multiplier));
    reps += 1;
    if (grade === 4) easeFactor += opts.easeIncrement;
  }
  interval = Math.min(opts.maxInterval, interval);
  easeFactor = Math.min(5, Math.max(opts.minEase, easeFactor));
  const due = addDays(at, interval);
  return { reps, interval, ease: ease(easeFactor), due, last: at, lapses };
}

/** Replay existing history once so a deck can migrate to SM-2 without losing progress. */
function replayHistory(fm, now, options) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const entries = parseHistory(fm && fm.history)
    .map((e) => ({ ...e, at: new Date(e.when) }))
    .filter((e) => !isNaN(e.at.getTime()) && e.at.getTime() <= at.getTime())
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_REPLAY);
  let state = { reps: 0, interval: 0, ease: normalizeSm2(options).startingEase, due: at, last: null, lapses: 0 };
  let replayed = 0;
  for (const e of entries) {
    if (e.result !== "correct" && e.result !== "incorrect") continue;
    const rating = gradeForAttempt(e.result === "correct", e.conf, e.seconds, fm && fm.target_seconds);
    state = scheduleState(state, rating, e.at, options);
    replayed++;
  }
  return { state, replayed };
}

function cardForNote(fm, now, options) {
  const stored = decodeSm2(fm && fm.sm2);
  if (stored) return { state: stored, replayed: 0 };
  return replayHistory(fm, now, options);
}

/** Compute the next review for one attempt without mutating the note. */
function reviewNote(fm, a, options) {
  const now = a && a.now instanceof Date && !isNaN(a.now.getTime()) ? a.now : new Date();
  const seeded = cardForNote(fm, now, options);
  const explicit = Number(a && a.rating);
  const rating = Number.isInteger(explicit) && explicit >= 1 && explicit <= 4
    ? explicit
    : gradeForAttempt(!!a.correct, a.conf, a.seconds, fm && fm.target_seconds);
  const state = scheduleState(seeded.state, rating, now, options);
  return {
    sm2: encodeSm2(state),
    due: state.due,
    nextReview: fmtDate(state.due),
    rating,
    days: state.interval,
    interval: state.interval,
    ease: state.ease,
    replayed: seeded.replayed,
  };
}

module.exports = {
  SRS_VERSION,
  DEFAULT_SM2,
  MAX_REPLAY,
  normalizeSm2,
  encodeSm2,
  decodeSm2,
  emptySm2,
  gradeForAttempt,
  scheduleState,
  replayHistory,
  cardForNote,
  reviewNote,
};
