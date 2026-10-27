"use strict";
const { folderChain, noteVals, pickQuestion } = require("./filters");
const { str } = require("./util");

/* ---- stats: how you are doing by skill, domain, difficulty and folder */

const WEAK_MIN_ATTEMPTS = 5;

/** The values a note counts under for stats. For folders, only the folder it sits in, so nothing is counted twice. */
function statVals(q, field) {
  const path = q.file && q.file.path;
  if (field === "folder") return folderChain(path).slice(-1);
  return noteVals(q.fm, field, path);
}

/** One row per value, weakest first; values you haven't attempted yet come last. */
function computeStats(questions, field) {
  const rows = new Map();
  for (const q of questions) {
    const att = Number(q.fm.attempts) || 0;
    const cor = Math.min(Number(q.fm.correct_count) || 0, att);
    const sec = att ? Number(q.fm.time_spent_total) || 0 : 0;
    for (const v of statVals(q, field)) {
      let r = rows.get(v);
      if (!r) rows.set(v, (r = { value: v, notes: 0, seen: 0, attempts: 0, correct: 0, seconds: 0 }));
      r.notes++;
      if (att > 0) r.seen++;
      r.attempts += att;
      r.correct += cor;
      r.seconds += sec;
    }
  }
  const out = [...rows.values()].map((r) => ({
    ...r,
    accuracy: r.attempts ? r.correct / r.attempts : null,
    avgSeconds: r.attempts ? r.seconds / r.attempts : null,
  }));
  out.sort((a, b) => {
    if ((a.accuracy === null) !== (b.accuracy === null)) return a.accuracy === null ? 1 : -1;
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return b.attempts - a.attempts || a.value.localeCompare(b.value, undefined, { numeric: true });
  });
  return out;
}

/** The lowest-accuracy row with enough attempts to mean something (falls back to any attempted row). */
function weakestRow(rows, minAttempts) {
  const min = minAttempts === undefined ? WEAK_MIN_ATTEMPTS : minAttempts;
  const tried = rows.filter((r) => r.accuracy !== null);
  const enough = tried.filter((r) => r.attempts >= min);
  const pool = enough.length ? enough : tried;
  return pool.length ? pool[0] : null;
}

function overallStats(questions) {
  const o = { notes: questions.length, seen: 0, attempts: 0, correct: 0, seconds: 0 };
  for (const q of questions) {
    const att = Number(q.fm.attempts) || 0;
    if (!att) continue;
    o.seen++;
    o.attempts += att;
    o.correct += Math.min(Number(q.fm.correct_count) || 0, att);
    o.seconds += Number(q.fm.time_spent_total) || 0;
  }
  o.accuracy = o.attempts ? o.correct / o.attempts : null;
  o.avgSeconds = o.attempts ? o.seconds / o.attempts : null;
  return o;
}

const fmtPct = (x) => (x === null || x === undefined ? "-" : `${Math.round(x * 100)}%`);

/* ---- error log */

/** history entries look like: date|result|seconds|answer|confidence|error_type */
function parseHistory(h) {
  return (Array.isArray(h) ? h : []).map((line) => {
    const p = str(line).split("|");
    return { when: p[0] || "", result: p[1] || "", seconds: Number(p[2]) || 0, answer: p[3] || "", conf: p[4] || "", error: (p[5] || "").trim() };
  });
}

/** Missed questions grouped by the reason you gave. `notes` are those whose latest attempt was a miss; `total` counts every tagged miss ever. */
function errorLog(questions) {
  const groups = new Map();
  const get = (t) => {
    if (!groups.has(t)) groups.set(t, { type: t, total: 0, notes: [] });
    return groups.get(t);
  };
  for (const q of questions) {
    for (const e of parseHistory(q.fm.history)) if (e.result === "incorrect" && e.error) get(e.error).total++;
    const t = str(q.fm.last_error_type).trim();
    if (t) get(t).notes.push(q);
    else if (q.fm.result === "incorrect") {
      const g = get("");
      g.notes.push(q);
      g.total++;
    }
  }
  for (const g of groups.values()) {
    g.notes.sort((a, b) => str(b.fm["date attempted"]).localeCompare(str(a.fm["date attempted"])));
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.type !== !b.type) return a.type ? -1 : 1;
    return b.total - a.total || a.type.localeCompare(b.type);
  });
}

/* ---- timed tests */

/** Up to n different questions picked with the chosen mode (the weighted mix favours due and new ones). */
function buildTestSet(pool, mode, n, today, rnd) {
  const rest = pool.slice();
  const out = [];
  while (out.length < n && rest.length) {
    const pick = pickQuestion(rest, mode, today, [], rnd);
    if (!pick) break;
    out.push(pick);
    rest.splice(rest.indexOf(pick), 1);
  }
  return out;
}

const suggestMinutes = (n) => Math.max(1, Math.round(n * 1.2));

module.exports = {
  WEAK_MIN_ATTEMPTS,
  statVals,
  computeStats,
  weakestRow,
  overallStats,
  fmtPct,
  parseHistory,
  errorLog,
  buildTestSet,
  suggestMinutes,
};
