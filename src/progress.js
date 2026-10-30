"use strict";
/*
 * Progress dashboard data. Pure helpers over question notes, cards and the study log,
 * so the Insights page and the tests share one calculation. Everything stays local.
 */
const { isDue } = require("./filters");
const { isStudyable } = require("./study-status");
const { computeStats, overallStats, parseHistory, weakestRow } = require("./stats");
const { studySummary } = require("./focus");
const { courseKey } = require("./analytics");

/** Mastery bands for one question, weakest first. Untried notes stay visible at the start. */
const MASTERY_BANDS = [
  { id: "untried", label: "Not tried" },
  { id: "weak", label: "Needs work" },
  { id: "developing", label: "Developing" },
  { id: "strong", label: "Strong" },
  { id: "mastered", label: "Mastered" },
];

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function dayKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeDay(value) {
  if (value instanceof Date) return dayKey(value);
  const text = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : dayKey(new Date());
}

function mondayOf(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function accuracyOf(question) {
  const fm = (question && question.fm) || {};
  const attempts = Number(fm.attempts) || 0;
  if (!attempts) return null;
  return Math.min(Number(fm.correct_count) || 0, attempts) / attempts;
}

/** untried | weak (<60%) | developing (60–79%) | strong (80–99%) | mastered (100%). */
function masteryBandOf(question) {
  const accuracy = accuracyOf(question);
  if (accuracy === null) return "untried";
  if (accuracy >= 1) return "mastered";
  if (accuracy >= 0.8) return "strong";
  if (accuracy >= 0.6) return "developing";
  return "weak";
}

/** Counts and shares for each band. A question with no attempts counts as untried. */
function buildMastery(questions) {
  const list = Array.isArray(questions) ? questions : [];
  const counts = new Map(MASTERY_BANDS.map((band) => [band.id, 0]));
  for (const question of list) {
    const id = masteryBandOf(question);
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const total = list.length;
  const bands = MASTERY_BANDS.map((band) => {
    const count = counts.get(band.id) || 0;
    return { id: band.id, label: band.label, count, pct: total ? count / total : 0 };
  });
  const tried = total - (counts.get("untried") || 0);
  return { total, tried, mastered: counts.get("mastered") || 0, bands };
}

/** Distinct `course` values that can scope the mastery view, sorted. Blank values are skipped. */
function masteryScopes(questions) {
  const seen = new Map();
  for (const question of Array.isArray(questions) ? questions : []) {
    const label = str(question.fm && question.fm.course).trim();
    const key = courseKey(label);
    if (key && !seen.has(key)) seen.set(key, label);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** The questions inside one course scope. An empty scope means every question. */
function scopeQuestions(questions, scope) {
  const list = Array.isArray(questions) ? questions : [];
  const key = courseKey(str(scope).trim());
  if (!key) return list;
  return list.filter((question) => courseKey(question.fm && question.fm.course) === key);
}

/** Questions in one mastery band. An unknown band returns nothing rather than guessing. */
function bandQuestions(questions, band) {
  if (!MASTERY_BANDS.some((entry) => entry.id === band)) return [];
  return (Array.isArray(questions) ? questions : []).filter((question) => masteryBandOf(question) === band);
}

/** Monday-first study weeks, oldest first. Attempts come from history; minutes from the study log. */
function buildWeeks(questions, sessions, today, count) {
  const weeks = Math.max(1, Math.min(26, Math.round(Number(count) || 4)));
  const todayKey = normalizeDay(today);
  const first = mondayOf(new Date(`${todayKey}T00:00:00`));
  first.setDate(first.getDate() - 7 * (weeks - 1));
  const rows = Array.from({ length: weeks }, (_value, index) => {
    const start = addDays(first, index * 7);
    return { start: dayKey(start), attempts: 0, correct: 0, accuracy: null, minutes: 0, activeDays: 0, days: new Set() };
  });
  const indexOf = (day) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayKey) return -1;
    const index = Math.round((mondayOf(new Date(`${day}T00:00:00`)) - first) / (7 * 86400000));
    return index >= 0 && index < rows.length ? index : -1;
  };
  for (const question of Array.isArray(questions) ? questions : []) {
    for (const entry of parseHistory(question.fm && question.fm.history)) {
      const day = str(entry.when).slice(0, 10);
      const index = indexOf(day);
      if (index < 0) continue;
      rows[index].attempts++;
      if (entry.result === "correct") rows[index].correct++;
      rows[index].days.add(day);
    }
  }
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const day = str(session.date).slice(0, 10);
    const index = indexOf(day);
    if (index < 0) continue;
    rows[index].minutes += Math.max(0, Number(session.minutes) || 0);
    rows[index].days.add(day);
  }
  return rows.map((row) => {
    const { days, ...rest } = row;
    return {
      ...rest,
      accuracy: row.attempts ? row.correct / row.attempts : null,
      activeDays: days.size,
    };
  });
}

/** This week against last week. Deltas are null until there is a previous week to compare. */
function buildMomentum(weeks) {
  const list = Array.isArray(weeks) ? weeks : [];
  const current = list.length ? list[list.length - 1] : null;
  const previous = list.length > 1 ? list[list.length - 2] : null;
  if (!current) return null;
  const accuracyDelta = previous && current.accuracy !== null && previous.accuracy !== null ? Math.round((current.accuracy - previous.accuracy) * 100) : null;
  return {
    current,
    previous,
    attemptsDelta: previous ? current.attempts - previous.attempts : null,
    minutesDelta: previous ? current.minutes - previous.minutes : null,
    accuracyDelta,
  };
}

/** Practice accuracy and study minutes per course, largest first. A course with no questions still shows its time. */
function buildCourses(questions, sessions, limit) {
  const rows = new Map();
  const ensure = (label) => {
    const name = str(label).trim() || "No course";
    const key = courseKey(name) || "nocourse";
    if (!rows.has(key)) rows.set(key, { course: name, notes: 0, seen: 0, attempts: 0, correct: 0, minutes: 0 });
    return rows.get(key);
  };
  for (const question of Array.isArray(questions) ? questions : []) {
    const row = ensure(question.fm && question.fm.course);
    row.notes++;
    const attempts = Number(question.fm && question.fm.attempts) || 0;
    if (attempts) row.seen++;
    row.attempts += attempts;
    row.correct += Math.min(Number(question.fm && question.fm.correct_count) || 0, attempts);
  }
  for (const session of Array.isArray(sessions) ? sessions : []) {
    ensure(session.course).minutes += Math.max(0, Number(session.minutes) || 0);
  }
  const out = [...rows.values()].map((row) => ({
    ...row,
    accuracy: row.attempts ? row.correct / row.attempts : null,
  }));
  out.sort((a, b) => b.notes - a.notes || b.minutes - a.minutes || a.course.localeCompare(b.course));
  return out.slice(0, Math.max(1, Math.round(Number(limit) || 6)));
}

/** Counts behind the next-step buttons. Hidden items are reported, never queued. */
function buildNext(questions, cards, today) {
  const visible = (Array.isArray(questions) ? questions : []).filter((question) => isStudyable(question.fm, today));
  const visibleCards = (Array.isArray(cards) ? cards : []).filter((card) => isStudyable(card.fm, today));
  return {
    due: visible.filter((question) => isDue(question.fm, today)).length,
    fresh: visible.filter((question) => !Number(question.fm && question.fm.attempts)).length,
    hidden: (Array.isArray(questions) ? questions : []).length - visible.length,
    dueCards: visibleCards.filter((card) => isDue(card.fm, today)).length,
    freshCards: visibleCards.filter((card) => !Number(card.fm && card.fm.attempts)).length,
    weak: weakestRow(computeStats(visible, "skill")),
  };
}

/** The whole progress page in one snapshot: today's goal, weekly momentum, mastery and next steps. */
function buildProgress(options) {
  const opts = options || {};
  const today = normalizeDay(opts.today);
  const questions = Array.isArray(opts.questions) ? opts.questions : [];
  const cards = Array.isArray(opts.cards) ? opts.cards : [];
  const studyLog = opts.studyLog || { sessions: [], dailyGoalMinutes: 60 };
  const study = studySummary(studyLog, today);
  const weeks = buildWeeks(questions, studyLog.sessions, today, opts.weeks || 4);
  const masteryScope = str(opts.masteryScope).trim();
  const goalMinutes = study.goalMinutes || 0;
  return {
    today,
    overall: overallStats(questions),
    study,
    goal: {
      minutes: study.todayMinutes,
      goalMinutes,
      pct: study.goalPct,
      remaining: Math.max(0, goalMinutes - study.todayMinutes),
      streak: study.streak,
      sessionsToday: study.sessionsToday,
    },
    weeks,
    momentum: buildMomentum(weeks),
    mastery: buildMastery(scopeQuestions(questions, masteryScope)),
    masteryScope,
    masteryScopes: masteryScopes(questions),
    courses: buildCourses(questions, studyLog.sessions, opts.courseLimit || 6),
    next: buildNext(questions, cards, today),
  };
}

module.exports = {
  MASTERY_BANDS,
  accuracyOf,
  bandQuestions,
  buildCourses,
  buildMastery,
  buildMomentum,
  buildNext,
  buildProgress,
  buildWeeks,
  masteryBandOf,
  masteryScopes,
  scopeQuestions,
};
