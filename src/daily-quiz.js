"use strict";
/*
 * The daily quiz is a small, deterministic set of MCQ notes for one calendar
 * day. It deliberately reuses the normal practice queue and scheduler; this
 * module only chooses the set and tracks the separate daily streak.
 */
const { isDue } = require("./filters");
const { isStudyable } = require("./study-status");
const { addDays, fmtDate, str } = require("./util");

const MAX_DAILY_FREEZES = 3;
const DEFAULT_DAILY_QUIZ = {
  enabled: false,
  count: 5,
  folders: [],
  freezeEnabled: false, // opt-in: a missed day can spend an earned freeze
  freezeEvery: 5, // completed daily quizzes per earned freeze
  freezes: 0,
  completions: 0,
  lastDate: "",
  paths: [],
  streak: 0,
  best: 0,
  lastCompleted: "",
};

function dayKey(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : fmtDate(value);
  const s = str(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
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

/** A textarea or an array both become a clean list of folder paths. */
function folderList(value) {
  const list = Array.isArray(value) ? value : str(value).split(/[\n,]+/);
  const out = [];
  for (const item of list) {
    const path = str(item).trim().replace(/^\/+|\/+$/g, "");
    if (path && !out.includes(path)) out.push(path);
  }
  return out;
}

function foldersText(value) {
  return folderList(value).join("\n");
}

function normalizeDailyQuiz(value) {
  const src = value && typeof value === "object" ? value : {};
  const count = Number(src.count);
  const freezeEvery = Number(src.freezeEvery);
  return {
    enabled: src.enabled === true,
    count: Number.isFinite(count) ? Math.min(50, Math.max(1, Math.round(count))) : DEFAULT_DAILY_QUIZ.count,
    folders: folderList(src.folders),
    freezeEnabled: src.freezeEnabled === true,
    freezeEvery: Number.isFinite(freezeEvery) && freezeEvery >= 2 ? Math.min(50, Math.round(freezeEvery)) : DEFAULT_DAILY_QUIZ.freezeEvery,
    freezes: Math.min(MAX_DAILY_FREEZES, nonNegative(src.freezes)),
    completions: nonNegative(src.completions),
    lastDate: dayKey(src.lastDate),
    paths: Array.isArray(src.paths) ? src.paths.filter((p) => typeof p === "string" && p) : [],
    streak: nonNegative(src.streak),
    best: nonNegative(src.best),
    lastCompleted: dayKey(src.lastCompleted),
  };
}

function pathInFolders(path, folders) {
  const list = folderList(folders);
  if (!list.length) return true;
  const clean = str(path).replace(/^\/+/, "");
  return list.some((folder) => clean === folder || clean.startsWith(folder + "/"));
}

function hashSeed(text) {
  let h = 2166136261;
  const s = str(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, seed) {
  const out = items.slice();
  const rnd = randomFrom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Choose today's questions. Due questions come first, then unseen ones, then
 * the rest; each group is shuffled with a date seed so reopening the quiz on
 * the same day gives the same set.
 */
function buildDailyQuiz(questions, options) {
  const opts = options || {};
  const today = dayKey(opts.today) || fmtDate(new Date());
  const cfg = normalizeDailyQuiz({ count: opts.count, folders: opts.folders });
  const eligible = (questions || []).filter(
    (q) => q && q.file && pathInFolders(q.file.path, cfg.folders) && isStudyable(q.fm, today)
  );
  const groups = [[], [], []];
  for (const q of eligible) {
    const rank = isDue(q.fm, today) ? 0 : !Number(q.fm && q.fm.attempts) ? 1 : 2;
    groups[rank].push(q);
  }
  const seed = hashSeed(`${today}|${cfg.folders.join("|")}|${cfg.count}`);
  const ordered = [];
  groups.forEach((group, i) => ordered.push(...shuffle(group, seed + i * 7919)));
  return ordered.slice(0, Math.min(cfg.count, ordered.length));
}

/**
 * Use the cached set for today when every saved path still resolves to an
 * eligible note. A renamed, deleted, hidden or moved-away note regenerates the
 * set instead of silently shortening it.
 */
function pickDailyQuiz(questions, state, today) {
  const cfg = normalizeDailyQuiz(state);
  const day = dayKey(today) || fmtDate(new Date());
  if (cfg.lastDate === day && cfg.paths.length) {
    const byPath = new Map((questions || []).filter((q) => q && q.file).map((q) => [q.file.path, q]));
    const cached = [];
    let valid = true;
    for (const path of cfg.paths) {
      const q = byPath.get(path);
      if (!q || !isStudyable(q.fm, day) || !pathInFolders(q.file.path, cfg.folders)) {
        valid = false;
        break;
      }
      cached.push(q);
    }
    if (valid && cached.length) return { state: cfg, questions: cached };
  }
  const questionsForDay = buildDailyQuiz(questions, { today: day, count: cfg.count, folders: cfg.folders });
  return {
    state: { ...cfg, lastDate: day, paths: questionsForDay.map((q) => q.file.path) },
    questions: questionsForDay,
  };
}

function dailyDone(state, today) {
  const cfg = normalizeDailyQuiz(state);
  return !!cfg.lastCompleted && cfg.lastCompleted === (dayKey(today) || fmtDate(new Date()));
}

/** Calendar days strictly between the last completion and today. */
function missedDayKeys(state, today) {
  const cfg = normalizeDailyQuiz(state);
  const day = dayKey(today) || fmtDate(new Date());
  const start = parseDay(cfg.lastCompleted);
  const end = parseDay(day);
  const out = [];
  if (!start || !end) return out;
  let cursor = addDays(start, 1);
  while (cursor < end) {
    out.push(fmtDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** What the freeze ledger looks like today, without spending anything. */
function dailyFreezeStatus(state, today) {
  const cfg = normalizeDailyQuiz(state);
  const missed = missedDayKeys(cfg, today);
  return {
    enabled: cfg.freezeEnabled,
    freezes: cfg.freezes,
    completions: cfg.completions,
    every: cfg.freezeEvery,
    missedDays: missed.length,
    canProtect: cfg.freezeEnabled && missed.length > 0 && cfg.freezes >= missed.length,
    nextEarnIn: cfg.freezeEvery - (cfg.completions % cfg.freezeEvery),
  };
}

function dailyStreak(state, today) {
  const cfg = normalizeDailyQuiz(state);
  const day = dayKey(today) || fmtDate(new Date());
  if (!cfg.lastCompleted) return 0;
  if (cfg.lastCompleted === day || cfg.lastCompleted === previousDay(day)) return cfg.streak;
  if (cfg.freezeEnabled) {
    const missed = missedDayKeys(cfg, day);
    if (missed.length && cfg.freezes >= missed.length) return cfg.streak;
  }
  return 0;
}

/** Completing the quiz twice in one day never increments the streak twice. */
function completeDailyQuiz(state, today) {
  const cfg = normalizeDailyQuiz(state);
  const day = dayKey(today) || fmtDate(new Date());
  if (cfg.lastCompleted === day) return cfg;
  const missed = missedDayKeys(cfg, day);
  let freezes = cfg.freezes;
  let streak = 1;
  if (cfg.lastCompleted === previousDay(day)) {
    streak = cfg.streak + 1;
  } else if (cfg.freezeEnabled && cfg.lastCompleted && missed.length && freezes >= missed.length) {
    // Spend exactly the missed days the earned freezes cover.
    freezes -= missed.length;
    streak = cfg.streak + 1;
  }
  const completions = cfg.completions + 1;
  if (cfg.freezeEnabled && completions % cfg.freezeEvery === 0) freezes = Math.min(MAX_DAILY_FREEZES, freezes + 1);
  return { ...cfg, freezes, completions, lastCompleted: day, streak, best: Math.max(cfg.best, streak) };
}

module.exports = {
  DEFAULT_DAILY_QUIZ,
  MAX_DAILY_FREEZES,
  buildDailyQuiz,
  completeDailyQuiz,
  dailyDone,
  dailyFreezeStatus,
  dailyStreak,
  dayKey,
  folderList,
  foldersText,
  missedDayKeys,
  normalizeDailyQuiz,
  pathInFolders,
  pickDailyQuiz,
};
