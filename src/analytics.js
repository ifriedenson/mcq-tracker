"use strict";
const { isDue } = require("./filters");
const { isStudyable } = require("./study-status");
const { computeStats, overallStats, parseHistory, weakestRow } = require("./stats");
const { studySummary } = require("./focus");

function dayKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function courseKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function courseMatches(value, course) {
  const a = courseKey(value);
  const b = courseKey(course);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
}

function normalizeDay(value) {
  if (value instanceof Date) return dayKey(value);
  const text = String(value || "").slice(0, 10);
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

function activityByDay(sessions, questions) {
  const map = new Map();
  const ensure = (key) => {
    if (!map.has(key)) map.set(key, { minutes: 0, attempts: 0 });
    return map.get(key);
  };
  for (const session of sessions || []) {
    const key = String(session.date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) ensure(key).minutes += Math.max(0, Number(session.minutes) || 0);
  }
  for (const q of questions || []) {
    for (const entry of parseHistory(q.fm && q.fm.history)) {
      const key = String(entry.when || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) ensure(key).attempts++;
    }
  }
  return map;
}

function activityLevel(day) {
  const minutes = day.minutes || 0;
  const attempts = day.attempts || 0;
  if (!minutes && !attempts) return 0;
  if (minutes > 60 || attempts >= 20) return 4;
  if (minutes > 30 || attempts >= 10) return 3;
  if (minutes > 15 || attempts >= 5) return 2;
  return 1;
}

/** Twelve Monday-first weeks ending with the current week. */
function buildHeatmap(sessions, questions, today, weeks) {
  const count = Math.max(1, Math.min(26, Math.round(Number(weeks) || 12)));
  const todayKey = normalizeDay(today);
  const now = new Date(`${todayKey}T00:00:00`);
  const first = mondayOf(now);
  first.setDate(first.getDate() - 7 * (count - 1));
  const activity = activityByDay(sessions, questions);
  const out = [];
  for (let w = 0; w < count; w++) {
    const start = addDays(first, w * 7);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, d);
      const key = dayKey(date);
      const day = Object.assign({ date: key, minutes: 0, attempts: 0 }, activity.get(key) || {});
      days.push(Object.assign(day, { level: activityLevel(day), future: key > todayKey }));
    }
    out.push({ start: dayKey(start), days });
  }
  return out;
}

function buildDashboard(options) {
  const opts = options || {};
  const today = normalizeDay(opts.today);
  const course = String(opts.course || "").trim();
  const questions = Array.isArray(opts.questions) ? opts.questions : [];
  const cards = Array.isArray(opts.cards) ? opts.cards : [];
  const studyLog = opts.studyLog || { sessions: [], dailyGoalMinutes: 60 };
  const scopedQuestions = course
    ? questions.filter((q) => [q.fm && q.fm.course, q.fm && q.fm.test].some((v) => courseMatches(v, course)))
    : questions;
  const scopedCards = course ? cards.filter((c) => [c.course, c.fm && c.fm.course].some((v) => courseMatches(v, course))) : cards;
  const scopedLog = course
    ? { ...studyLog, sessions: (studyLog.sessions || []).filter((session) => courseMatches(session.course, course)) }
    : studyLog;
  const stats = computeStats(scopedQuestions, "skill");
  const overall = overallStats(scopedQuestions);
  const study = studySummary(scopedLog, today);
  const cardStats = {
    total: scopedCards.length,
    due: scopedCards.filter((c) => isStudyable(c.fm, today) && isDue(c.fm, today)).length,
    fresh: scopedCards.filter((c) => isStudyable(c.fm, today) && !Number(c.fm.attempts)).length,
  };
  return {
    today,
    course,
    overall,
    study,
    cardStats,
    weak: weakestRow(stats),
    skills: stats.slice(0, 8),
    heatmap: buildHeatmap(scopedLog.sessions, scopedQuestions, today, opts.weeks || 12),
    byCourse: Object.entries(study.byCourse).sort((a, b) => b[1] - a[1]).slice(0, 6),
    exams: Array.isArray(opts.exams) ? opts.exams : [],
  };
}

module.exports = {
  activityByDay,
  activityLevel,
  buildDashboard,
  buildHeatmap,
  courseKey,
  courseMatches,
  dayKey,
  mondayOf,
  normalizeDay,
};
