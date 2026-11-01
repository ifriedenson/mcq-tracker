"use strict";
/*
 * Permanent per-day study counters. Detailed history rows are capped; these
 * aggregate counters are intentionally small and survive restarts and history
 * trimming. They are the source for the heatmap and button mix.
 */
const { str } = require("./util");

const MAX_DAYS = 2000;
const RATINGS = ["again", "hard", "good", "easy"];
const KINDS = ["note", "card", "question"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDay(date) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function validDay(value) {
  const text = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function emptyDay() {
  return { reviews: 0, correct: 0, seconds: 0, notes: 0, cards: 0, questions: 0, again: 0, hard: 0, good: 0, easy: 0 };
}

function normalizeCounterDay(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const out = emptyDay();
  for (const key of Object.keys(out)) out[key] = Math.max(0, Math.round(Number(src[key]) || 0));
  return out;
}

function normalizeStudyCounters(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const days = {};
  const source = src.days && typeof src.days === "object" && !Array.isArray(src.days) ? src.days : {};
  const keys = Object.keys(source).filter(validDay).sort().slice(-MAX_DAYS);
  for (const key of keys) days[key] = normalizeCounterDay(source[key]);
  return { version: 1, days, updated: str(src.updated).slice(0, 30) };
}

function recordStudyCounter(value, entry) {
  const counters = normalizeStudyCounters(value);
  const src = entry && typeof entry === "object" ? entry : {};
  const day = validDay(src.date) || localDay(src.now);
  const kind = KINDS.includes(str(src.kind)) ? str(src.kind) : "question";
  const bucket = counters.days[day] || emptyDay();
  bucket.reviews++;
  if (src.correct === true) bucket.correct++;
  bucket.seconds += Math.max(0, Math.round(Number(src.seconds) || 0));
  bucket[kind === "note" ? "notes" : kind === "card" ? "cards" : "questions"]++;
  const rating = str(src.rating).toLowerCase();
  if (RATINGS.includes(rating)) bucket[rating]++;
  counters.days[day] = bucket;
  counters.updated = new Date().toISOString();
  const keys = Object.keys(counters.days).sort();
  while (keys.length > MAX_DAYS) delete counters.days[keys.shift()];
  return { counters, day: bucket, date: day };
}

function counterTotals(value) {
  const counters = normalizeStudyCounters(value);
  const total = emptyDay();
  for (const bucket of Object.values(counters.days)) {
    for (const key of Object.keys(total)) total[key] += bucket[key];
  }
  total.days = Object.keys(counters.days).length;
  total.minutes = Math.round((total.seconds / 60) * 10) / 10;
  total.accuracy = total.reviews ? total.correct / total.reviews : null;
  return total;
}

function buttonMix(value) {
  const total = counterTotals(value);
  const sum = RATINGS.reduce((n, key) => n + total[key], 0);
  return {
    again: total.again,
    hard: total.hard,
    good: total.good,
    easy: total.easy,
    total: sum,
    againRate: sum ? total.again / sum : null,
    buckets: RATINGS.map((rating) => ({ rating, count: total[rating], share: sum ? total[rating] / sum : 0 })),
  };
}

function counterDay(value, date) {
  const counters = normalizeStudyCounters(value);
  const key = validDay(date);
  const bucket = counters.days[key];
  return bucket ? { ...bucket, date: key, minutes: Math.round((bucket.seconds / 60) * 10) / 10, accuracy: bucket.reviews ? bucket.correct / bucket.reviews : null } : null;
}

/** A Monday-aligned heatmap ending today, including the whole current week. */
function counterHeatmap(value, weeks, now) {
  const counters = normalizeStudyCounters(value);
  const count = Math.max(1, Math.min(52, Math.round(Number(weeks) || 12)));
  const today = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
  const offset = (end.getDay() + 6) % 7;
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - offset - (count - 1) * 7, 12, 0, 0);
  const all = [];
  let max = 0;
  for (let index = 0; index < count * 7; index++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12, 0, 0);
    const key = localDay(date);
    const bucket = counters.days[key];
    const reviews = bucket ? bucket.reviews : 0;
    max = Math.max(max, reviews);
    all.push({
      date: key,
      reviews,
      minutes: bucket ? Math.round((bucket.seconds / 60) * 10) / 10 : 0,
      accuracy: bucket && bucket.reviews ? bucket.correct / bucket.reviews : null,
      future: date > end,
    });
  }
  const level = (reviews) => (reviews <= 0 ? 0 : Math.min(4, 1 + Math.floor((reviews / Math.max(1, max)) * 3)));
  const cells = all.map((cell) => ({ ...cell, level: level(cell.reviews) }));
  const weeksOut = [];
  for (let index = 0; index < count; index++) weeksOut.push({ days: cells.slice(index * 7, index * 7 + 7) });
  return { weeks: weeksOut, days: cells, max, activeDays: cells.filter((cell) => cell.reviews > 0).length };
}

module.exports = {
  KINDS,
  MAX_DAYS,
  RATINGS,
  buttonMix,
  counterDay,
  counterHeatmap,
  counterTotals,
  emptyDay,
  localDay,
  normalizeCounterDay,
  normalizeStudyCounters,
  recordStudyCounter,
  validDay,
};
