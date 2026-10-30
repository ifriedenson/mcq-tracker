"use strict";
/* Exam-scoped study plans. The planner only reads existing question/card state. */

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function dateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(key, n) {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

function daysBetween(fromKey, toKey) {
  const a = new Date(`${fromKey}T00:00:00`).getTime();
  const b = new Date(`${toKey}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

function isDueQuestion(q, today) {
  return Number(q.fm.attempts) > 0 && !!q.fm.next_review && str(q.fm.next_review).slice(0, 10) <= today;
}

function accuracyOf(questions) {
  let attempts = 0;
  let correct = 0;
  for (const q of questions) {
    attempts += Number(q.fm.attempts) || 0;
    correct += Math.min(Number(q.fm.correct_count) || 0, Number(q.fm.attempts) || 0);
  }
  return attempts ? correct / attempts : null;
}

/** Lowest-accuracy attempted skill with at least two attempts; falls back to any attempted skill. */
function weakSkillOf(questions) {
  const rows = new Map();
  for (const q of questions) {
    const skill = str(q.fm.skill).trim() || "Unspecified";
    const attempts = Number(q.fm.attempts) || 0;
    if (!attempts) continue;
    const row = rows.get(skill) || { skill, attempts: 0, correct: 0 };
    row.attempts += attempts;
    row.correct += Math.min(Number(q.fm.correct_count) || 0, attempts);
    rows.set(skill, row);
  }
  const list = [...rows.values()]
    .map((r) => ({ ...r, accuracy: r.correct / r.attempts }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
  return list.find((r) => r.attempts >= 2) || list[0] || null;
}

/** Mastered skills as a share of a course's declared topic count. No declaration means no figure. */
function topicCoverage(questions, totalTopics) {
  const declared = Math.max(0, Math.min(500, Math.round(Number(totalTopics) || 0)));
  if (!declared) return null;
  const rows = new Map();
  for (const q of Array.isArray(questions) ? questions : []) {
    const skill = str(q.fm && q.fm.skill).trim();
    if (!skill) continue;
    const row = rows.get(skill) || { total: 0, mastered: 0 };
    row.total++;
    const attempts = Number(q.fm.attempts) || 0;
    if (attempts > 0 && Number(q.fm.correct_count) >= attempts) row.mastered++;
    rows.set(skill, row);
  }
  const mastered = [...rows.values()].filter((row) => row.total > 0 && row.mastered === row.total).length;
  return {
    declared,
    discovered: rows.size,
    mastered,
    pct: Math.min(100, Math.round((mastered / declared) * 100)),
  };
}

function readinessScore(questions, due, daysLeft) {
  const total = questions.length;
  if (!total) return 0;
  const seen = questions.filter((q) => Number(q.fm.attempts) > 0).length;
  const attempts = questions.reduce((n, q) => n + (Number(q.fm.attempts) || 0), 0);
  const correct = questions.reduce((n, q) => n + Math.min(Number(q.fm.correct_count) || 0, Number(q.fm.attempts) || 0), 0);
  const accuracy = attempts ? correct / attempts : 0;
  const coverage = seen / total;
  const backlog = due / Math.max(1, total);
  const urgency = daysLeft <= 2 ? 0.04 : 0;
  return Math.max(0, Math.min(100, Math.round(100 * (0.5 * accuracy + 0.32 * coverage + 0.18 * (1 - backlog)) - urgency * 100)));
}

/** Most-missed and due first; long-interval reviews are skipped unless the item was missed. */
function buildCramPool(questions, today, limit) {
  const horizon = addDays(today, 30);
  const scored = [];
  for (const q of questions) {
    const fm = q.fm || {};
    const attempts = Number(fm.attempts) || 0;
    const correct = Math.min(Number(fm.correct_count) || 0, attempts);
    const accuracy = attempts ? correct / attempts : null;
    const due = isDueQuestion(q, today);
    const missed = fm.result === "incorrect";
    const unseen = attempts === 0;
    const future = str(fm.next_review).slice(0, 10);
    if (future && future > horizon && !missed && !fm.flagged) continue;
    let score = 0;
    if (missed) score += 50;
    if (due) score += 30;
    if (unseen) score += 15;
    if (fm.flagged === true) score += 10;
    if (accuracy !== null) score += Math.round((1 - accuracy) * 20);
    scored.push({ q, score });
  }
  scored.sort((a, b) => b.score - a.score || str(a.q.file.path).localeCompare(str(b.q.file.path)));
  const n = Math.max(1, Math.min(200, Math.round(Number(limit) || 40)));
  return scored.slice(0, n).map((row) => row.q);
}

function buildStudyPlan(exam, questions, cards, options) {
  const opts = options || {};
  const today = opts.today || dateKey(new Date());
  const examDay = str(opts.examDate || (exam && exam.dateKey) || (exam && exam.dtstart && dateKey(exam.dtstart)) || today).slice(0, 10);
  const daysLeft = daysBetween(today, examDay);
  const list = Array.isArray(questions) ? questions : [];
  const cardList = Array.isArray(cards) ? cards : [];
  const due = list.filter((q) => isDueQuestion(q, today)).length;
  const fresh = list.filter((q) => !Number(q.fm.attempts)).length;
  const attempted = list.filter((q) => Number(q.fm.attempts) > 0);
  const weak = weakSkillOf(list);
  const cardsDue = cardList.filter((c) => !Number(c.fm.attempts) || (!!c.fm.next_review && str(c.fm.next_review).slice(0, 10) <= today)).length;
  const frq = Array.isArray(opts.frq) ? opts.frq.filter(Boolean) : [];
  const frqDue = frq.filter((row) => row.due).length;
  const course = str(opts.course || (exam && exam.course) || "").trim() || (exam && str(exam.summary).replace(/\s*[-–—:]\s*(final|exam|midterm|test).*$/i, "").trim()) || "Your exam";
  return {
    exam,
    course,
    examDay,
    daysLeft,
    total: list.length,
    due,
    fresh,
    attempted: attempted.length,
    accuracy: accuracyOf(list),
    weakSkill: weak ? weak.skill : "",
    weakAccuracy: weak ? weak.accuracy : null,
    cardsDue,
    frq: frq.slice(),
    frqDue,
    frqTotal: frq.length,
    frqNext: frq.find((row) => row.due) || frq.find((row) => row.state === "scheduled") || frq[0] || null,
    readiness: readinessScore(list, due, daysLeft),
    topics: topicCoverage(list, opts.totalTopics),
    pool: list.slice(),
    cramPool: buildCramPool(list, today, opts.cramLimit || 40),
  };
}

module.exports = {
  accuracyOf,
  addDays,
  buildCramPool,
  buildStudyPlan,
  daysBetween,
  isDueQuestion,
  readinessScore,
  topicCoverage,
  weakSkillOf,
};
