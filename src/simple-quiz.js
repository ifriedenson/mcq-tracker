"use strict";
/*
 * Simple Quiz parity: `quiz` blocks, JSON card sources, legacy quizjs notices
 * and small local day statistics. This module is deliberately independent of the
 * question scheduler so a note can carry a quick recall set without creating
 * question notes; any linked question IDs still use the normal attempt path.
 */
const { addDays, fmtDate, hashString, str } = require("./util");

const DEFAULT_SIMPLE_QUIZ = {
  stats: { days: {}, streak: 0, best: 0, lastCompleted: "" },
};

const MAX_CARDS = 500;
const MAX_STATS_DAYS = 400;

function dayKey(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : fmtDate(value);
  const text = str(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function parseDay(value) {
  const key = dayKey(value);
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return isNaN(date.getTime()) ? null : date;
}

function previousDay(value) {
  const date = parseDay(value);
  return date ? fmtDate(addDays(date, -1)) : "";
}

function nonNegative(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function cleanLines(value) {
  const list = Array.isArray(value) ? value : str(value).split(/\r?\n/);
  return list.map((line) => str(line).trim()).filter(Boolean);
}

/** One card shape accepted by JSON and JavaScript blocks. */
function normalizeSimpleCard(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "A card must be an object with question.left and question.right." };
  }
  const question = raw.question && typeof raw.question === "object" ? raw.question : {};
  const left = cleanLines(question.left !== undefined ? question.left : raw.left);
  const right = cleanLines(question.right !== undefined ? question.right : raw.right);
  if (!left.length || !right.length) {
    return { error: "A card needs non-empty question.left and question.right text." };
  }
  const defaultSide = str(raw.defaultSide).toLowerCase() === "right" ? "right" : "left";
  const tags = Array.isArray(raw.tags) ? raw.tags.map((tag) => str(tag).trim()).filter(Boolean) : [];
  const id = str(raw.id).trim() || `h${hashString(JSON.stringify({ left, right }))}`;
  return {
    card: {
      id,
      question: { left, right },
      pool: str(raw.pool).trim() || "cards",
      tags,
      defaultSide,
      notReversible: raw.notReversible === true,
      question_id: str(raw.question_id).trim(),
    },
  };
}

/** Parse an array (or JSON text) of cards. Never throws. */
function parseSimpleQuizCards(value) {
  let data = value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return { cards: [], issues: [] };
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { cards: [], issues: [`Quiz card JSON is invalid: ${str(e && e.message ? e.message : e)}`] };
    }
  }
  if (!Array.isArray(data)) return { cards: [], issues: ["Quiz cards must be a JSON array."] };
  const cards = [];
  const issues = [];
  const seen = new Set();
  data.slice(0, MAX_CARDS).forEach((raw, index) => {
    const normalized = normalizeSimpleCard(raw);
    if (!normalized.card) {
      issues.push(`Card ${index + 1}: ${normalized.error}`);
      return;
    }
    if (seen.has(normalized.card.id)) {
      issues.push(`Card ${index + 1}: duplicate id "${normalized.card.id}" was skipped.`);
      return;
    }
    seen.add(normalized.card.id);
    cards.push(normalized.card);
  });
  if (data.length > MAX_CARDS) issues.push(`Only the first ${MAX_CARDS} cards were loaded.`);
  return { cards, issues };
}

/** Parse the JSON options block used by `quiz`, `quiztoday` and `quizcharts`. */
function parseSimpleQuizOptions(source) {
  const text = str(source).trim();
  if (!text) return { cards: [], options: {}, issues: [] };
  if (text.startsWith("[")) {
    const parsed = parseSimpleQuizCards(text);
    return { cards: parsed.cards, options: {}, issues: parsed.issues };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { cards: [], options: {}, issues: [`Quiz block options are not valid JSON: ${str(e && e.message ? e.message : e)}`] };
  }
  if (Array.isArray(value)) {
    const parsed = parseSimpleQuizCards(value);
    return { cards: parsed.cards, options: {}, issues: parsed.issues };
  }
  if (!value || typeof value !== "object") {
    return { cards: [], options: {}, issues: ["Quiz block options must be a JSON object."] };
  }
  const rawSources = Array.isArray(value.sources) ? value.sources : value.sources ? [value.sources] : [];
  const sources = rawSources.map((item) => str(item).trim()).filter(Boolean);
  const parsedCards = value.cards !== undefined ? parseSimpleQuizCards(value.cards) : { cards: [], issues: [] };
  const limit = Number(value.limit);
  return {
    cards: parsedCards.cards,
    options: {
      sources,
      hideTitle: value.hideTitle === true,
      minify: value.minify === true,
      hideCounters: value.hideCounters === true,
      shuffle: value.shuffle === true,
      limit: Number.isFinite(limit) ? Math.max(0, Math.min(MAX_CARDS, Math.round(limit))) : 0,
    },
    issues: parsedCards.issues,
  };
}

function fencedBlocks(text, tag) {
  const source = str(text);
  const out = [];
  const re = new RegExp("```" + tag + "\\b[^\\n]*\\n([\\s\\S]*?)```", "gi");
  let match;
  while ((match = re.exec(source))) out.push(match[1]);
  return out;
}

/** Collect `quizjson` and `quizjs` blocks from one note. */
function extractSimpleQuizBlocks(text) {
  return { json: fencedBlocks(text, "quizjson"), js: fencedBlocks(text, "quizjs") };
}

/** Message for a legacy `quizjs` block: it is never executed; migrate to `quizjson`. */
function legacyQuizJsNotice() {
  return "JavaScript quiz blocks are disabled. Convert them to quizjson.";
}

function normalizeQuizStats(value) {
  const src = value && typeof value === "object" ? value : {};
  const rawDays = src.days && typeof src.days === "object" && !Array.isArray(src.days) ? src.days : {};
  const days = {};
  for (const [key, row] of Object.entries(rawDays)) {
    const date = dayKey(key);
    if (!date || !row || typeof row !== "object") continue;
    days[date] = {
      cards: nonNegative(row.cards),
      correct: Math.min(nonNegative(row.cards), nonNegative(row.correct)),
      quizzes: nonNegative(row.quizzes),
    };
  }
  const kept = Object.keys(days).sort().slice(-MAX_STATS_DAYS);
  const pruned = {};
  for (const date of kept) pruned[date] = days[date];
  return {
    days: pruned,
    streak: nonNegative(src.streak),
    best: nonNegative(src.best),
    lastCompleted: dayKey(src.lastCompleted),
  };
}

function normalizeSimpleQuiz(value) {
  const src = value && typeof value === "object" ? value : {};
  return {
    stats: normalizeQuizStats(src.stats),
  };
}

function hasQuiz(days, key) {
  const row = days && days[key];
  return !!row && (row.quizzes > 0 || row.cards > 0);
}

function streakFromDays(days, today) {
  let cursor = dayKey(today);
  if (!cursor) return 0;
  if (!hasQuiz(days, cursor)) cursor = previousDay(cursor);
  let streak = 0;
  while (hasQuiz(days, cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}

function weekStart(value) {
  const date = parseDay(value);
  if (!date) return "";
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return fmtDate(date);
}

/** Consecutive Monday-start weeks with at least one completed quiz. */
function weekStreakFromDays(days, today) {
  let start = weekStart(today);
  if (!start) return 0;
  const weekHasQuiz = (monday) => {
    const date = parseDay(monday);
    if (!date) return false;
    for (let i = 0; i < 7; i++) {
      const key = fmtDate(addDays(date, i));
      if (hasQuiz(days, key)) return true;
    }
    return false;
  };
  if (!weekHasQuiz(start)) {
    const date = parseDay(start);
    start = date ? fmtDate(addDays(date, -7)) : "";
  }
  let streak = 0;
  while (start && weekHasQuiz(start)) {
    streak++;
    const date = parseDay(start);
    start = date ? fmtDate(addDays(date, -7)) : "";
  }
  return streak;
}

function simpleQuizDaySummary(value, today) {
  const cfg = normalizeSimpleQuiz(value);
  const day = dayKey(today) || dayKey(new Date());
  const row = cfg.stats.days[day] || { cards: 0, correct: 0, quizzes: 0 };
  const weekStartKey = weekStart(day);
  const weekDate = parseDay(weekStartKey);
  let weekCards = 0;
  let weekQuizzes = 0;
  if (weekDate) {
    for (let i = 0; i < 7; i++) {
      const key = fmtDate(addDays(weekDate, i));
      const entry = cfg.stats.days[key];
      if (!entry) continue;
      weekCards += entry.cards;
      weekQuizzes += entry.quizzes;
    }
  }
  return {
    today: day,
    cards: row.cards,
    correct: row.correct,
    quizzes: row.quizzes,
    streak: streakFromDays(cfg.stats.days, day),
    best: cfg.stats.best,
    weekCards,
    weekQuizzes,
    weekStreak: weekStreakFromDays(cfg.stats.days, day),
  };
}

function pruneDays(days) {
  const keys = Object.keys(days).sort().slice(-MAX_STATS_DAYS);
  const out = {};
  for (const key of keys) out[key] = days[key];
  return out;
}

/** Complete one quiz session and update the local streak/count store. */
function recordSimpleQuizSession(value, input) {
  const cfg = normalizeSimpleQuiz(value);
  const data = input || {};
  const day = dayKey(data.today) || dayKey(new Date());
  const cards = Math.min(MAX_CARDS, nonNegative(data.cards));
  if (!cards) return cfg;
  const correct = Math.min(cards, nonNegative(data.correct));
  const previous = cfg.stats.days[day] || { cards: 0, correct: 0, quizzes: 0 };
  const days = pruneDays({
    ...cfg.stats.days,
    [day]: { cards: previous.cards + cards, correct: previous.correct + correct, quizzes: previous.quizzes + 1 },
  });
  const streak = streakFromDays(days, day);
  return {
    ...cfg,
    stats: {
      days,
      streak,
      best: Math.max(cfg.stats.best, streak),
      lastCompleted: day,
    },
  };
}

/** Oldest-to-newest day series for the `quizcharts` block. */
function simpleQuizChartSeries(value, options) {
  const cfg = normalizeSimpleQuiz(value);
  const opts = options || {};
  const count = Math.max(1, Math.min(365, Math.round(Number(opts.days) || 30)));
  const today = dayKey(opts.today) || dayKey(new Date());
  const end = parseDay(today);
  const rows = [];
  if (!end) return { days: [], maxCards: 0, maxQuizzes: 0, totalCards: 0, totalQuizzes: 0 };
  for (let i = count - 1; i >= 0; i--) {
    const key = fmtDate(addDays(end, -i));
    const row = cfg.stats.days[key] || { cards: 0, correct: 0, quizzes: 0 };
    rows.push({ date: key, label: key.slice(5), cards: row.cards, correct: row.correct, quizzes: row.quizzes });
  }
  return {
    days: rows,
    maxCards: rows.reduce((max, row) => Math.max(max, row.cards), 0),
    maxQuizzes: rows.reduce((max, row) => Math.max(max, row.quizzes), 0),
    totalCards: rows.reduce((sum, row) => sum + row.cards, 0),
    totalQuizzes: rows.reduce((sum, row) => sum + row.quizzes, 0),
  };
}

module.exports = {
  DEFAULT_SIMPLE_QUIZ,
  MAX_CARDS,
  MAX_STATS_DAYS,
  dayKey,
  extractSimpleQuizBlocks,
  normalizeSimpleCard,
  normalizeSimpleQuiz,
  normalizeQuizStats,
  parseSimpleQuizCards,
  parseSimpleQuizOptions,
  recordSimpleQuizSession,
  legacyQuizJsNotice,
  simpleQuizChartSeries,
  simpleQuizDaySummary,
  weekStreakFromDays,
};
