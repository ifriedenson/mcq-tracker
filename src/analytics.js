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

const DEFAULT_CONFIDENCE_LABELS = ["Guessing", "Unsure", "Confident"];
const BREAKDOWN_FIELDS = ["skill", "domain", "difficulty"];
const FIELD_LABELS = { skill: "Weak spots", domain: "Domain breakdown", difficulty: "Difficulty breakdown" };

function gradeLetter(accuracy) {
  if (accuracy === null || accuracy === undefined) return "-";
  if (accuracy >= 0.9) return "A";
  if (accuracy >= 0.8) return "B";
  if (accuracy >= 0.7) return "C";
  if (accuracy >= 0.6) return "D";
  return "F";
}

/** A clearly practice-derived snapshot, not an assignment or transcript grade. */
function buildGradeSnapshot(questions) {
  const list = Array.isArray(questions) ? questions : [];
  const overall = overallStats(list);
  const courses = computeStats(list, "course")
    .filter((row) => row.attempts > 0)
    .map((row) => ({ course: row.value, accuracy: row.accuracy, attempts: row.attempts, grade: gradeLetter(row.accuracy) }))
    .slice(0, 6);
  return {
    basis: "practice accuracy",
    overall: { accuracy: overall.accuracy, attempts: overall.attempts, grade: gradeLetter(overall.accuracy) },
    courses,
  };
}

function confidenceLabelsOf(labels) {
  const source = Array.isArray(labels) ? labels : [];
  return DEFAULT_CONFIDENCE_LABELS.map((fallback, index) => String(source[index] || fallback).trim() || fallback);
}

/** Accuracy at each stated confidence level. Empty confidence (timed tests) is ignored. */
function buildCalibration(questions, labels) {
  const buckets = confidenceLabelsOf(labels).map((label, index) => ({ confidence: index + 1, label, attempts: 0, correct: 0, accuracy: null }));
  let total = 0;
  for (const q of questions || []) {
    for (const entry of parseHistory(q.fm && q.fm.history)) {
      const confidence = Math.round(Number(entry.conf));
      if (!Number.isFinite(confidence) || confidence < 1 || confidence > 3) continue;
      const bucket = buckets[confidence - 1];
      bucket.attempts++;
      total++;
      if (entry.result === "correct") bucket.correct++;
    }
  }
  for (const bucket of buckets) bucket.accuracy = bucket.attempts ? bucket.correct / bucket.attempts : null;
  return { buckets, total };
}

/** Accuracy on repeat attempts only: the first attempt on a question is learning, later ones are retention. */
function buildRetention(questions, today, weeks) {
  const count = Math.max(1, Math.min(26, Math.round(Number(weeks) || 8)));
  const todayKey = normalizeDay(today);
  const now = new Date(`${todayKey}T00:00:00`);
  const first = mondayOf(now);
  first.setDate(first.getDate() - 7 * (count - 1));
  const rows = Array.from({ length: count }, (_value, index) => {
    const start = addDays(first, index * 7);
    return { start: dayKey(start), attempts: 0, correct: 0, accuracy: null };
  });
  for (const q of questions || []) {
    const entries = parseHistory(q.fm && q.fm.history)
      .filter((entry) => {
        const day = String(entry.when || "").slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= todayKey;
      })
      .sort((a, b) => String(a.when).localeCompare(String(b.when)));
    for (let index = 1; index < entries.length; index++) {
      const day = String(entries[index].when).slice(0, 10);
      const weekIndex = Math.round((mondayOf(new Date(`${day}T00:00:00`)) - first) / (7 * 86400000));
      if (weekIndex < 0 || weekIndex >= count) continue;
      const row = rows[weekIndex];
      row.attempts++;
      if (entries[index].result === "correct") row.correct++;
    }
  }
  let attempts = 0;
  let correct = 0;
  for (const row of rows) {
    row.accuracy = row.attempts ? row.correct / row.attempts : null;
    attempts += row.attempts;
    correct += row.correct;
  }
  return { weeks: rows, attempts, correct, accuracy: attempts ? correct / attempts : null };
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
  const field = BREAKDOWN_FIELDS.includes(opts.field) ? opts.field : "skill";
  const stats = computeStats(scopedQuestions, field);
  const calibration = buildCalibration(scopedQuestions, opts.confidenceLabels);
  const retention = buildRetention(scopedQuestions, today, opts.retentionWeeks || 8);
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
    field,
    fieldLabel: FIELD_LABELS[field],
    weak: weakestRow(stats),
    skills: stats.slice(0, 8),
    breakdown: stats.slice(0, 8),
    grades: buildGradeSnapshot(scopedQuestions),
    calibration,
    retention,
    heatmap: buildHeatmap(scopedLog.sessions, scopedQuestions, today, opts.weeks || 12),
    byCourse: Object.entries(study.byCourse).sort((a, b) => b[1] - a[1]).slice(0, 6),
    exams: Array.isArray(opts.exams) ? opts.exams : [],
  };
}

module.exports = {
  BREAKDOWN_FIELDS,
  FIELD_LABELS,
  activityByDay,
  activityLevel,
  buildCalibration,
  buildDashboard,
  buildGradeSnapshot,
  buildHeatmap,
  buildRetention,
  confidenceLabelsOf,
  gradeLetter,
  courseKey,
  courseMatches,
  dayKey,
  mondayOf,
  normalizeDay,
};
