"use strict";
/*
 * Anki-style study statistics. Everything here is derived from properties the
 * plugin already stores: card/question/note history, FSRS or SM-2 state, and
 * leech counters. It is read-only and never schedules a review.
 */
const { str } = require("./util");
const { parseHistory } = require("./stats");
const fsrs = require("./fsrs");
const sm2 = require("./sm2");
const fsrsLib = require("./fsrs-lib");
const { isNoteCandidate } = require("./note-review");
const { buttonMix, counterHeatmap, normalizeStudyCounters } = require("./study-counters");
const { durabilitySummary, normalizeDurabilitySettings } = require("./durability");

const MATURITY_LABELS = {
  learning: "Learning (<1d)",
  young: "Young (<21d)",
  mature: "Mature (21d+)",
};
const MATURITY_ORDER = ["learning", "young", "mature"];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RATINGS = ["again", "hard", "good", "easy"];

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeStudyStatsSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: src.enabled !== false,
    leechThreshold: clampNumber(src.leechThreshold, 1, 50, 5),
    maxRows: clampNumber(src.maxRows, 20, 500, 200),
    durableRecall: src.durableRecall !== false,
    durableDays: normalizeDurabilitySettings({ requiredDays: src.durableDays }).requiredDays,
    heatmapWeeks: clampNumber(src.heatmapWeeks, 4, 52, 12),
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dayKey(date) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function maturityOf(intervalDays) {
  const days = Math.max(0, Number(intervalDays) || 0);
  if (days < 1) return "learning";
  if (days < 21) return "young";
  return "mature";
}

function reviewDate(when) {
  const text = str(when).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function ratingFor(entry, fm) {
  return {
    correct: entry.result === "correct",
    conf: Number(entry.conf) || 0,
    seconds: Number(entry.seconds) || 0,
    target: Number(fm && fm.target_seconds) || 0,
  };
}

/** Replay FSRS history to recover each review's interval before it happened. */
function fsrsRows(card, entries, retention, weights) {
  if (!entries.length) return [];
  const scheduler = fsrs.makeScheduler(retention, weights);
  let state = fsrsLib.createEmptyCard(new Date(entries[0].when));
  const rows = [];
  for (const entry of entries) {
    const at = new Date(entry.when);
    if (isNaN(at.getTime())) continue;
    const rating = fsrs.gradeForAttempt(entry.result === "correct", entry.conf, entry.seconds, card.fm && card.fm.target_seconds);
    const interval = Number(state.scheduled_days) || 0;
    const row = reviewRow(card, entry, maturityOf(interval), interval, rating);
    if (row) rows.push(row);
    try {
      state = scheduler.next(state, at, rating).card;
    } catch (_) {
      break;
    }
  }
  return rows;
}

function sm2Rows(card, entries) {
  let state = {
    reps: 0,
    interval: 0,
    ease: sm2.DEFAULT_SM2.startingEase,
    due: new Date(),
    last: null,
    lapses: 0,
  };
  const rows = [];
  for (const entry of entries) {
    const at = new Date(entry.when);
    if (isNaN(at.getTime())) continue;
    const rating = sm2.gradeForAttempt(entry.result === "correct", entry.conf, entry.seconds, card.fm && card.fm.target_seconds);
    const row = reviewRow(card, entry, maturityOf(state.interval), state.interval, rating);
    if (row) rows.push(row);
    try {
      state = sm2.scheduleState(state, rating, at, card.fm && card.fm.sm2);
    } catch (_) {
      break;
    }
  }
  return rows;
}

function ladderRows(card, entries) {
  let streak = 0;
  return entries
    .map((entry) => {
      const interval = entry.result === "correct" ? Math.max(1, streak + 1) : 1;
      const row = reviewRow(card, entry, maturityOf(interval), interval, entry.result === "correct" ? "good" : "again");
      streak = entry.result === "correct" ? streak + 1 : 0;
      return row;
    })
    .filter(Boolean);
}

function reviewRow(source, entry, maturity, interval, rating) {
  const date = reviewDate(entry.when);
  if (!date) return null;
  return {
    kind: source.kind,
    path: str(source.file && source.file.path),
    title: str(source.fm && source.fm.title).trim() || str(source.file && source.file.basename) || "",
    date,
    when: str(entry.when),
    correct: entry.result === "correct",
    seconds: Number(entry.seconds) || 0,
    maturity,
    rating: RATINGS.includes(str(rating)) ? str(rating) : entry.result === "correct" ? "good" : "again",
    interval: Math.max(0, Number(interval) || 0),
  };
}

function cardReviewRows(card, settings) {
  const fm = card.fm || {};
  const entries = parseHistory(fm.history).filter((entry) => entry.result === "correct" || entry.result === "incorrect");
  const source = { kind: "card", file: card.file, fm };
  const weights = typeof settings.fsrsWeights === "function" ? settings.fsrsWeights(card) : settings.fsrsWeights;
  if (str(fm.srs).startsWith("fsrs")) return fsrsRows(source, entries, settings.fsrsRetention, weights);
  if (str(fm.sm2).startsWith("sm2")) return sm2Rows(source, entries);
  return ladderRows(source, entries);
}

function historyRows(records, kind) {
  const rows = [];
  for (const record of Array.isArray(records) ? records : []) {
    const fm = record.fm || {};
    if (kind === "note" && !isNoteCandidate({ file: record.file, fm })) continue;
    for (const entry of parseHistory(fm.history)) {
      if (entry.result !== "correct" && entry.result !== "incorrect") continue;
      const row = reviewRow({ kind, file: record.file, fm }, entry, "learning", 0);
      if (row) rows.push(row);
    }
  }
  return rows;
}

function retentionByMaturity(rows) {
  const out = {};
  for (const maturity of MATURITY_ORDER) out[maturity] = { maturity, label: MATURITY_LABELS[maturity], attempts: 0, correct: 0, retention: null };
  const all = { maturity: "all", label: "All reviews", attempts: 0, correct: 0, retention: null };
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row) continue;
    const bucket = out[row.maturity] || out.learning;
    bucket.attempts++;
    all.attempts++;
    if (row.correct) {
      bucket.correct++;
      all.correct++;
    }
  }
  for (const bucket of [...Object.values(out), all]) {
    bucket.retention = bucket.attempts ? bucket.correct / bucket.attempts : null;
  }
  return { byMaturity: out, all };
}

/** Per-deck card retention, replaying the same scheduler rows as the main table. */
function deckBreakdown(cards, settings) {
  const groups = new Map();
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = card.fm || {};
    const deck = str(card.deck || fm.deck || fm.deck_name).trim() || "Unassigned";
    if (!groups.has(deck)) groups.set(deck, { deck, cards: 0, rows: [], intervals: [] });
    const group = groups.get(deck);
    group.cards++;
    group.rows.push(...cardReviewRows(card, settings || {}));
    const srs = fsrs.decodeSrs(fm.srs);
    const sm2State = sm2.decodeSm2(fm.sm2);
    const interval = srs ? Number(srs.scheduled_days) || 0 : sm2State ? Number(sm2State.interval) || 0 : 0;
    if (interval > 0) group.intervals.push(interval);
  }
  return [...groups.values()]
    .map((group) => {
      const reviews = group.rows.length;
      const correct = group.rows.filter((row) => row.correct).length;
      const mature = group.rows.filter((row) => row.maturity === "mature").length;
      return {
        deck: group.deck,
        cards: group.cards,
        reviews,
        correct,
        retention: reviews ? correct / reviews : null,
        matureShare: reviews ? mature / reviews : null,
        averageInterval: group.intervals.length ? group.intervals.reduce((sum, value) => sum + value, 0) / group.intervals.length : null,
      };
    })
    .sort((a, b) => b.reviews - a.reviews || a.deck.localeCompare(b.deck));
}

function distribution(values, edges, labels) {
  const list = (Array.isArray(values) ? values : []).filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  const buckets = [];
  let last = -Infinity;
  for (let index = 0; index < edges.length; index++) {
    const edge = edges[index];
    const count = list.filter((value) => value >= last && value < edge).length;
    buckets.push({ label: labels[index] || `${last}–${edge}`, count });
    last = edge;
  }
  const tail = list.filter((value) => value >= last).length;
  buckets.push({ label: labels[labels.length - 1] || `${last}+`, count: tail });
  const total = list.length;
  for (const bucket of buckets) bucket.share = total ? bucket.count / total : 0;
  let median = null;
  if (list.length) {
    const middle = Math.floor(list.length / 2);
    median = list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
    median = Math.round(median * 100) / 100;
  }
  return { buckets, total, min: list.length ? list[0] : null, max: list.length ? list[list.length - 1] : null, median };
}

function emptyRatingMix() {
  return { again: 0, hard: 0, good: 0, easy: 0, total: 0, againRate: null };
}

/** The Again/Hard/Good/Easy mix split by card maturity, from the same replayed rows. */
function buttonMixByMaturity(rows) {
  const byMaturity = {};
  for (const maturity of MATURITY_ORDER) byMaturity[maturity] = emptyRatingMix();
  const all = emptyRatingMix();
  for (const row of Array.isArray(rows) ? rows : []) {
    const rating = str(row && row.rating);
    if (!RATINGS.includes(rating)) continue;
    const bucket = byMaturity[row.maturity] || byMaturity.learning;
    bucket[rating]++;
    bucket.total++;
    all[rating]++;
    all.total++;
  }
  for (const bucket of [...Object.values(byMaturity), all]) {
    bucket.againRate = bucket.total ? bucket.again / bucket.total : null;
  }
  return { byMaturity, all };
}

function cardMetrics(cards, now) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const today = dayKey(at);
  const intervals = [];
  const eases = [];
  const stabilities = [];
  const difficulties = [];
  let memoryTotal = 0;
  let memoryCount = 0;
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = card.fm || {};
    const srs = fsrs.decodeSrs(fm.srs);
    const sm2State = sm2.decodeSm2(fm.sm2);
    let interval = 0;
    if (srs) {
      interval = Number(srs.scheduled_days) || 0;
      stabilities.push(srs.stability);
      difficulties.push(srs.difficulty);
      if (srs.stability > 0) {
        const last = srs.last_review instanceof Date ? srs.last_review : null;
        const elapsed = last ? Math.max(0, (at.getTime() - last.getTime()) / 86400000) : 0;
        memoryTotal += fsrsLib.forgetting_curve(fsrsLib.default_w, elapsed, srs.stability);
        memoryCount++;
      }
    } else if (sm2State) {
      interval = Number(sm2State.interval) || 0;
      eases.push(sm2State.ease);
    } else {
      const due = /^\d{4}-\d{2}-\d{2}$/.test(str(fm.next_review)) ? new Date(`${str(fm.next_review)}T12:00:00`) : null;
      interval = due && !isNaN(due.getTime()) ? Math.max(0, Math.round((due - new Date(`${today}T12:00:00`)) / 86400000)) : 0;
    }
    if (interval > 0) intervals.push(interval);
  }
  return {
    intervals: distribution(intervals, [1, 7, 21, 60, 180], ["<1d", "1–7d", "7–21d", "21–60d", "60–180d", "180d+"]),
    ease: distribution(eases, [1.5, 2, 2.5, 3], ["<1.5", "1.5–2", "2–2.5", "2.5–3", "3+"]),
    stability: distribution(stabilities, [1, 7, 30, 90, 365], ["<1d", "1–7d", "7–30d", "30–90d", "90–365d", "365d+"]),
    difficulty: distribution(difficulties, [3, 5, 7, 9], ["<3", "3–5", "5–7", "7–9", "9–10"]),
    memoryNow: memoryCount ? memoryTotal / memoryCount : null,
    memoryCards: memoryCount,
    intervalCards: intervals.length,
  };
}

function weekdayRhythm(rows) {
  const buckets = WEEK_DAYS.map((label) => ({ label, attempts: 0, correct: 0 }));
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = new Date(`${row.date}T12:00:00`);
    if (isNaN(date.getTime())) continue;
    const index = (date.getDay() + 6) % 7;
    buckets[index].attempts++;
    if (row.correct) buckets[index].correct++;
  }
  return buckets.map((bucket) => ({ ...bucket, accuracy: bucket.attempts ? bucket.correct / bucket.attempts : null }));
}

function dayDetail(rows) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!map.has(row.date)) map.set(row.date, { date: row.date, attempts: 0, correct: 0, seconds: 0, cards: 0, questions: 0, notes: 0, items: [] });
    const bucket = map.get(row.date);
    bucket.attempts++;
    if (row.correct) bucket.correct++;
    bucket.seconds += Number(row.seconds) || 0;
    if (row.kind === "card") bucket.cards++;
    else if (row.kind === "note") bucket.notes++;
    else bucket.questions++;
    bucket.items.push(row);
  }
  return [...map.values()]
    .map((bucket) => ({
      ...bucket,
      accuracy: bucket.attempts ? bucket.correct / bucket.attempts : null,
      minutes: Math.round((bucket.seconds / 60) * 10) / 10,
      items: bucket.items.slice(-50),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function leechList(questions, cards, notes, threshold) {
  const limit = Math.max(1, Number(threshold) || 5);
  const rows = [];
  for (const question of Array.isArray(questions) ? questions : []) {
    const fm = question.fm || {};
    const lapses = Math.max(Number(fm.leech_lapses) || 0, Number(fm.leech) ? limit : 0);
    if (lapses >= limit) rows.push({ kind: "question", path: question.file.path, title: str(fm.title) || question.file.basename, lapses });
  }
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = card.fm || {};
    const state = fsrs.decodeSrs(fm.srs) || sm2.decodeSm2(fm.sm2);
    const lapses = Math.max(Number(state && state.lapses) || 0, Number(fm.leech_lapses) || 0, Number(fm.leech) ? limit : 0);
    if (lapses >= limit) rows.push({ kind: "card", path: card.file.path, title: str(fm.title) || card.file.basename, lapses });
  }
  for (const note of Array.isArray(notes) ? notes : []) {
    const fm = note.fm || {};
    if (!isNoteCandidate(note)) continue;
    const lapses = Number(fm.note_lapse_streak) || 0;
    if (lapses >= limit) rows.push({ kind: "note", path: note.file.path, title: str(fm.title) || note.file.basename, lapses });
  }
  return rows.sort((a, b) => b.lapses - a.lapses || a.path.localeCompare(b.path));
}

function buildStudyStats(input) {
  const opts = input || {};
  const settings = normalizeStudyStatsSettings(opts.settings);
  const cards = Array.isArray(opts.cards) ? opts.cards : [];
  const questions = Array.isArray(opts.questions) ? opts.questions : [];
  const notes = Array.isArray(opts.notes) ? opts.notes : [];
  const now = opts.now instanceof Date && !isNaN(opts.now.getTime()) ? opts.now : new Date();
  const cardRows = [];
  for (const card of cards) cardRows.push(...cardReviewRows(card, { ...settings, fsrsRetention: opts.fsrsRetention, fsrsWeights: opts.fsrsWeights }));
  const rows = [...cardRows, ...historyRows(questions, "question"), ...historyRows(notes, "note")].sort((a, b) => b.when.localeCompare(a.when));
  const retention = retentionByMaturity(cardRows);
  const metrics = cardMetrics(cards, now);
  const days = dayDetail(rows);
  const counters = normalizeStudyCounters(opts.counters);
  return {
    rows: rows.slice(0, settings.maxRows),
    cardRows,
    retention,
    metrics,
    weekday: weekdayRhythm(rows),
    days,
    decks: deckBreakdown(cards, { ...settings, fsrsRetention: opts.fsrsRetention, fsrsWeights: opts.fsrsWeights }),
    buttonMix: buttonMix(counters),
    buttonMixByMaturity: buttonMixByMaturity(cardRows),
    heatmap: counterHeatmap(counters, settings.heatmapWeeks, now),
    counters,
    durability: durabilitySummary([...cards, ...questions, ...notes], settings.durableDays),
    leeches: leechList(questions, cards, notes, settings.leechThreshold),
    totals: {
      cards: cards.length,
      questions: questions.length,
      notes: notes.length,
      reviews: rows.length,
      cardReviews: cardRows.length,
      studyDays: days.length,
    },
    settings,
  };
}

module.exports = {
  MATURITY_LABELS,
  MATURITY_ORDER,
  RATINGS,
  WEEK_DAYS,
  buildStudyStats,
  buttonMixByMaturity,
  cardMetrics,
  cardReviewRows,
  deckBreakdown,
  dayDetail,
  distribution,
  historyRows,
  leechList,
  maturityOf,
  normalizeStudyStatsSettings,
  retentionByMaturity,
  weekdayRhythm,
};
