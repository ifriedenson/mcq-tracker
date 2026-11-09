"use strict";
const { isDue } = require("./filters");
const { str } = require("./util");
const { isStudyable } = require("./study-status");
const { computeStats, overallStats, parseHistory, weakestRow } = require("./stats");
const { creditOf } = require("./history");
const { studySummary } = require("./focus");
const { cardMetrics } = require("./study-stats");

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

const DEFAULT_CONFIDENCE_LABELS = ["Guessing", "Probably Right", "Confident"];
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

/** Accuracy at each stated confidence level. Explicit 0 is unrated; blank confidence (timed tests) is ignored. */
function buildCalibration(questions, labels) {
  const buckets = confidenceLabelsOf(labels).map((label, index) => ({ confidence: index + 1, label, attempts: 0, correct: 0, credit: 0, accuracy: null }));
  let total = 0;
  const unrated = { attempts: 0, correct: 0, credit: 0, accuracy: null };
  for (const q of questions || []) {
    for (const entry of parseHistory(q.fm && q.fm.history)) {
      const raw = entry.conf === null || entry.conf === undefined ? "" : String(entry.conf).trim();
      const confidence = Math.round(Number(raw));
      if (raw !== "" && confidence === 0) {
        unrated.attempts++;
        if (entry.result === "correct") unrated.correct++;
        unrated.credit += creditOf(entry);
        continue;
      }
      if (!Number.isFinite(confidence) || confidence < 1 || confidence > 3) continue;
      const bucket = buckets[confidence - 1];
      bucket.attempts++;
      total++;
      if (entry.result === "correct") bucket.correct++;
      bucket.credit += creditOf(entry);
    }
  }
  for (const bucket of buckets) bucket.accuracy = bucket.attempts ? bucket.credit / bucket.attempts : null;
  unrated.accuracy = unrated.attempts ? unrated.credit / unrated.attempts : null;
  return { buckets, total, unrated };
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
    return { start: dayKey(start), attempts: 0, correct: 0, credit: 0, accuracy: null };
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
      row.credit += creditOf(entries[index]);
    }
  }
  let attempts = 0;
  let correct = 0;
  let credit = 0;
  for (const row of rows) {
    row.accuracy = row.attempts ? row.credit / row.attempts : null;
    attempts += row.attempts;
    correct += row.correct;
    credit += row.credit;
  }
  return { weeks: rows, attempts, correct, credit, accuracy: attempts ? credit / attempts : null };
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

function activityByDay(sessions, questions, cards) {
  const map = new Map();
  const ensure = (key) => {
    if (!map.has(key)) map.set(key, { minutes: 0, attempts: 0 });
    return map.get(key);
  };
  for (const session of sessions || []) {
    const key = String(session.date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) ensure(key).minutes += Math.max(0, Number(session.minutes) || 0);
  }
  for (const q of [...(questions || []), ...(cards || [])]) {
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
function buildHeatmap(sessions, questions, today, weeks, cards) {
  const count = Math.max(1, Math.min(26, Math.round(Number(weeks) || 12)));
  const todayKey = normalizeDay(today);
  const now = new Date(`${todayKey}T00:00:00`);
  const first = mondayOf(now);
  first.setDate(first.getDate() - 7 * (count - 1));
  const activity = activityByDay(sessions, questions, cards);
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

/** One accuracy figure for all evidence: question credit plus FRQ percentage credit. */
function knowledgeSummary(overall, frq) {
  const questionAttempts = Math.max(0, Number(overall && overall.attempts) || 0);
  const questionCredit = Math.max(0, Number(overall && (overall.credit !== undefined ? overall.credit : overall.correct)) || 0);
  const frqAttempts = Math.max(0, Number(frq && frq.attempts) || 0);
  const frqCredit = Math.max(0, Number(frq && frq.credit) || 0);
  const attempts = questionAttempts + frqAttempts;
  const credit = questionCredit + frqCredit;
  return {
    attempts,
    credit,
    accuracy: attempts ? credit / attempts : null,
    questions: { attempts: questionAttempts, credit: questionCredit, accuracy: questionAttempts ? questionCredit / questionAttempts : null },
    frq: { attempts: frqAttempts, credit: frqCredit, accuracy: frqAttempts ? frqCredit / frqAttempts : null },
  };
}

function dayAfter(day, n) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Due load for the next week, so a wall of reviews is visible before it lands. */
function buildForwardLoad(questions, cards, today, days) {
  const start = normalizeDay(today);
  const count = Math.max(1, Math.min(30, Math.round(Number(days) || 7)));
  const items = [...(Array.isArray(questions) ? questions : []), ...(Array.isArray(cards) ? cards : [])];
  const byDate = new Map();
  for (const item of items) {
    if (!isStudyable(item && item.fm, start)) continue;
    const day = str(item && item.fm && item.fm.next_review).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < start) continue;
    byDate.set(day, (byDate.get(day) || 0) + 1);
  }
  const out = [];
  for (let i = 0; i < count; i++) {
    const date = dayAfter(start, i);
    out.push({ date, count: byDate.get(date) || 0 });
  }
  return { days: out, total: out.reduce((n, day) => n + day.count, 0) };
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
  const frq = opts.frq || null;
  const knowledge = knowledgeSummary(overall, frq);
  const memory = cardMetrics(scopedCards, new Date(`${today}T12:00:00`));
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
    knowledge,
    frq,
    memory: { now: memory.memoryNow, cards: memory.memoryCards },
    gradebook: opts.gradebook || null,
    assignments: opts.assignments || null,
    forward: buildForwardLoad(scopedQuestions, scopedCards, today, opts.forwardDays || 7),
    study,
    cardStats,
    field,
    fieldLabel: FIELD_LABELS[field],
    weak: weakestRow(stats),
    skills: stats.slice(0, 8),
    breakdown: stats.slice(0, 8),
    skippedRows: stats.filter((row) => row.skipped > 0).sort((a, b) => b.skipped - a.skipped || a.value.localeCompare(b.value)).slice(0, 8),
    grades: buildGradeSnapshot(scopedQuestions),
    calibration,
    retention,
    heatmap: buildHeatmap(scopedLog.sessions, scopedQuestions, today, opts.weeks || 12, scopedCards),
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
  buildForwardLoad,
  knowledgeSummary,
  confidenceLabelsOf,
  gradeLetter,
  courseKey,
  courseMatches,
  dayKey,
  mondayOf,
  normalizeDay,
};
