"use strict";
/*
 * FSRS adapter for MCQ Tracker.
 *
 * The scheduler itself is ts-fsrs 5.4.1 (MIT), vendored in src/fsrs-lib.js so
 * the plugin stays a single main.js with no build-time dependencies. This file
 * only adapts note properties to FSRS cards: compact serialization, ratings from
 * correctness/confidence/time, and a one-time replay of existing history.
 */
const { addDays, fmtDate, str } = require("./util");
const { createEmptyCard, fsrs } = require("./fsrs-lib");
const { parseHistory } = require("./stats");

const SRS_VERSION = "fsrs6";
const MIN_RETENTION = 0.85;
const MAX_RETENTION = 0.95;
const MAX_REPLAY = 500;

// Same numbering as ts-fsrs / Anki.
const RATING = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

function clampRetention(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.9;
  return Math.min(MAX_RETENTION, Math.max(MIN_RETENTION, n));
}

/** Daily scheduling: short-term steps would produce a due time, while notes store only a date. */
function makeScheduler(retention) {
  return fsrs({
    request_retention: clampRetention(retention),
    enable_fuzz: false,
    enable_short_term: false,
  });
}

/**
 * Turn an attempt into an FSRS grade. FSRS wants four grades; an MCQ has
 * correctness, confidence and time. Guessing and slow correct answers are Hard;
 * a confident, fast correct answer against target_seconds is Easy.
 */
function gradeForAttempt(correct, conf, seconds, target) {
  if (!correct) return RATING.Again;
  const c = Number(conf) || 0;
  const t = Number(target) || 0;
  const s = Number(seconds) || 0;
  if (c === 1) return RATING.Hard;
  if (t > 0 && s > t * 1.5) return RATING.Hard;
  if (c === 3 && t > 0 && s <= t * 0.75) return RATING.Easy;
  return RATING.Good;
}

const round = (n) => Number(Number(n).toFixed(6));
const iso = (d) => (d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : "-");
const num = (n) => (Number.isFinite(Number(n)) ? round(n) : 0);

/**
 * Compact, readable state in one note property:
 * fsrs6|state|due|last_review|stability|difficulty|elapsed|scheduled|steps|reps|lapses
 */
function encodeSrs(card) {
  return [
    SRS_VERSION,
    Number(card.state) || 0,
    iso(card.due),
    iso(card.last_review),
    num(card.stability),
    num(card.difficulty),
    num(card.elapsed_days),
    num(card.scheduled_days),
    num(card.learning_steps),
    Math.max(0, Math.round(Number(card.reps) || 0)),
    Math.max(0, Math.round(Number(card.lapses) || 0)),
  ].join("|");
}

function decodeSrs(value) {
  const text = str(value).trim();
  if (!text.startsWith(SRS_VERSION + "|")) return null;
  const p = text.split("|");
  if (p.length !== 11) return null;
  const state = Number(p[1]);
  const due = new Date(p[2]);
  const last = p[3] === "-" ? null : new Date(p[3]);
  const [stability, difficulty, elapsed, scheduled, steps, reps, lapses] = p.slice(4).map(Number);
  const values = [state, stability, difficulty, elapsed, scheduled, steps, reps, lapses];
  if (!values.every(Number.isFinite)) return null;
  if (state < 0 || state > 3) return null;
  if (isNaN(due.getTime())) return null;
  if (last && isNaN(last.getTime())) return null;
  if (state !== 0 && !last) return null;
  const card = {
    due,
    stability: Math.max(0, stability),
    difficulty: Math.min(10, Math.max(1, difficulty)),
    elapsed_days: Math.max(0, elapsed),
    scheduled_days: Math.max(0, scheduled),
    learning_steps: Math.max(0, Math.round(steps)),
    reps: Math.max(0, Math.round(reps)),
    lapses: Math.max(0, Math.round(lapses)),
    state,
  };
  if (last) card.last_review = last;
  return card;
}

function emptySrs(now) {
  return encodeSrs(createEmptyCard(now instanceof Date ? now : new Date()));
}

/** Replay append-only history once. Future or malformed rows are ignored, not guessed. */
function replayHistory(fm, now, retention) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const entries = parseHistory(fm && fm.history)
    .map((e) => ({ ...e, at: new Date(e.when) }))
    .filter((e) => !isNaN(e.at.getTime()) && e.at.getTime() <= at.getTime())
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_REPLAY);
  if (!entries.length) return { card: createEmptyCard(at), replayed: 0 };

  const scheduler = makeScheduler(retention);
  let card = createEmptyCard(entries[0].at);
  let replayed = 0;
  for (const e of entries) {
    if (e.result !== "correct" && e.result !== "incorrect") continue;
    try {
      const rating = gradeForAttempt(e.result === "correct", e.conf, e.seconds, fm && fm.target_seconds);
      card = scheduler.next(card, e.at, rating).card;
      replayed++;
    } catch (_) {
      // A clock anomaly in one old row should not block the whole note.
    }
  }
  return { card, replayed };
}

function cardForNote(fm, now, retention) {
  const stored = decodeSrs(fm && fm.srs);
  if (stored) return { card: stored, replayed: 0 };
  return replayHistory(fm, now, retention);
}

/** Compute the next review for one attempt without mutating the note. */
function reviewNote(fm, a, retention) {
  const now = a && a.now instanceof Date && !isNaN(a.now.getTime()) ? a.now : new Date();
  const ret = clampRetention(retention);
  const seeded = cardForNote(fm, now, ret);
  const rating = gradeForAttempt(!!a.correct, a.conf, a.seconds, fm && fm.target_seconds);
  const next = makeScheduler(ret).next(seeded.card, now, rating).card;

  // Notes store a date, not a time, so never schedule inside the same day.
  let due = next.due instanceof Date ? next.due : null;
  if (!due || isNaN(due.getTime()) || fmtDate(due) <= fmtDate(now)) {
    due = addDays(now, 1);
    next.due = due;
  }
  return {
    srs: encodeSrs(next),
    due,
    nextReview: fmtDate(due),
    rating,
    days: Math.max(1, Math.round((due - now) / 86400000)),
    replayed: seeded.replayed,
  };
}

module.exports = {
  SRS_VERSION,
  MIN_RETENTION,
  MAX_RETENTION,
  RATING,
  clampRetention,
  makeScheduler,
  gradeForAttempt,
  encodeSrs,
  decodeSrs,
  emptySrs,
  replayHistory,
  cardForNote,
  reviewNote,
};
