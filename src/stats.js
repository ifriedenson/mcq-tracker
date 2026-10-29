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
    const skip = Math.max(0, Math.round(Number(q.fm.skip_count) || 0));
    for (const v of statVals(q, field)) {
      let r = rows.get(v);
      if (!r) rows.set(v, (r = { value: v, notes: 0, seen: 0, attempts: 0, correct: 0, seconds: 0, skipped: 0 }));
      r.notes++;
      if (att > 0) r.seen++;
      r.attempts += att;
      r.correct += cor;
      r.seconds += sec;
      r.skipped += skip;
    }
  }
  const out = [...rows.values()].map((r) => ({
    ...r,
    accuracy: r.attempts ? r.correct / r.attempts : null,
    avgSeconds: r.attempts ? r.seconds / r.attempts : null,
    skipRate: r.attempts + r.skipped ? r.skipped / (r.attempts + r.skipped) : 0,
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
  const o = { notes: questions.length, seen: 0, attempts: 0, correct: 0, seconds: 0, skipped: 0 };
  for (const q of questions) {
    o.skipped += Math.max(0, Math.round(Number(q.fm.skip_count) || 0));
    const att = Number(q.fm.attempts) || 0;
    if (!att) continue;
    o.seen++;
    o.attempts += att;
    o.correct += Math.min(Number(q.fm.correct_count) || 0, att);
    o.seconds += Number(q.fm.time_spent_total) || 0;
  }
  o.accuracy = o.attempts ? o.correct / o.attempts : null;
  o.avgSeconds = o.attempts ? o.seconds / o.attempts : null;
  o.skipRate = o.attempts + o.skipped ? o.skipped / (o.attempts + o.skipped) : 0;
  return o;
}

const fmtPct = (x) => (x === null || x === undefined ? "-" : `${Math.round(x * 100)}%`);

/* ---- error log */

/** history entries look like: date|result|seconds|answer|confidence|error_type */
function parseHistory(h) {
  return (Array.isArray(h) ? h : []).map((line) => {
    const p = str(line).split("|");
    return { when: p[0] || "", result: p[1] || "", seconds: Number(p[2]) || 0, answer: p[3] || "", conf: p[4] || "", error: (p[5] || "").trim(), id: (p[6] || "").trim() };
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

/** A 1-based, inclusive question range. An empty or zero end means the last question. */
function sliceQuestionRange(items, from, to) {
  const list = Array.isArray(items) ? items : [];
  const start = Math.max(1, Math.floor(Number(from) || 1));
  const endRaw = Number(to);
  const end = !Number.isFinite(endRaw) || endRaw <= 0 ? list.length : Math.min(list.length, Math.floor(endRaw));
  if (end < start) return [];
  return list.slice(start - 1, end);
}

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

/* ---- trends: how accuracy is moving */

const dayOf = (when) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(when));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Monday of the week a date falls in. */
function weekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Accuracy for each of the last `weeks` weeks (oldest first), from every attempt in the notes' history. */
function weeklyAccuracy(questions, today, weeks) {
  const n = weeks || 8;
  const first = weekStart(today);
  first.setDate(first.getDate() - 7 * (n - 1));
  const rows = Array.from({ length: n }, (_v, i) => {
    const d = new Date(first.getTime());
    d.setDate(d.getDate() + 7 * i);
    return { start: isoDay(d), attempts: 0, correct: 0, accuracy: null };
  });
  for (const q of questions) {
    for (const e of parseHistory(q.fm.history)) {
      const day = dayOf(e.when);
      if (!day || day < first) continue;
      const row = rows[Math.round((weekStart(day) - first) / (7 * 86400000))]; // rounds away daylight-saving shifts
      if (!row) continue;
      row.attempts++;
      if (e.result === "correct") row.correct++;
    }
  }
  for (const r of rows) r.accuracy = r.attempts ? r.correct / r.attempts : null;
  return rows;
}

/** Recent versus earlier accuracy per value: { value -> { recent: {n, c}, earlier: {n, c} } }. "Recent" is the last `days` days. */
function trendBy(questions, field, today, days) {
  const span = days || 14;
  const cut = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cut.setDate(cut.getDate() - span);
  const out = new Map();
  for (const q of questions) {
    const entries = parseHistory(q.fm.history);
    if (!entries.length) continue;
    for (const v of statVals(q, field)) {
      let t = out.get(v);
      if (!t) out.set(v, (t = { recent: { n: 0, c: 0 }, earlier: { n: 0, c: 0 } }));
      for (const e of entries) {
        const day = dayOf(e.when);
        if (!day) continue;
        const b = day >= cut ? t.recent : t.earlier;
        b.n++;
        if (e.result === "correct") b.c++;
      }
    }
  }
  return out;
}

/** Change in accuracy, in percentage points, or null when there isn't enough on both sides to say. */
function trendDelta(t, minEach) {
  const min = minEach === undefined ? 3 : minEach;
  if (!t || t.recent.n < min || t.earlier.n < min) return null;
  return Math.round((t.recent.c / t.recent.n - t.earlier.c / t.earlier.n) * 100);
}

/* ---- a timed test that survives closing Obsidian */

const TEST_SESSION_GRACE_MS = 12 * 3600 * 1000; // a test left this long after its time ran out is dropped, not graded

function packTestSession(items, meta) {
  const sections = (Array.isArray(meta.sections) ? meta.sections : []).map((s) => ({
    name: str(s.name),
    count: Number(s.count) || 0,
    minutes: Number(s.minutes) || 0,
    endAt: Number(s.endAt) || 0,
  }));
  return {
    v: 1,
    idx: meta.idx,
    startedAt: meta.startedAt,
    deadline: meta.deadline,
    allowedSeconds: meta.allowedSeconds,
    sectionIdx: Number(meta.sectionIdx) || 0,
    sections,
    items: items.map((it) => ({
      path: it.file.path,
      ...(sections.length ? { section: Number(it.section) || 0 } : {}),
      ...(Number(it.conf) ? { conf: Number(it.conf) } : {}),
      sel: str(it.sel),
      seconds: Math.round(it.seconds || 0),
      flagged: !!it.flagged,
      ...(it.mode === "frq" ? { frq: true } : {}),
      ...(it.variant && it.variant.ok && Number.isFinite(Number(it.variant.seed)) ? { seed: Number(it.variant.seed) } : {}),
    })),
  };
}

/** What to do with a saved test: null to drop it, otherwise the rows to reload and whether the time already ran out. */
function unpackTestSession(s, now) {
  if (!s || s.v !== 1 || !Array.isArray(s.items)) return null;
  if (![s.deadline, s.startedAt, s.allowedSeconds].every((x) => Number.isFinite(x))) return null;
  if (now - s.deadline > TEST_SESSION_GRACE_MS) return null;
  const items = s.items
    .filter((r) => r && typeof r.path === "string")
    .map((r) => ({
      path: r.path,
      section: Math.max(0, Number(r.section) || 0),
      conf: Math.max(0, Math.min(3, Number(r.conf) || 0)),
      sel: str(r.sel),
      seconds: Number(r.seconds) || 0,
      flagged: !!r.flagged,
      frq: r.frq === true,
      seed: Number.isFinite(Number(r.seed)) ? Number(r.seed) : undefined,
    }));
  if (!items.length) return null;
  const sections = (Array.isArray(s.sections) ? s.sections : [])
    .map((section) => ({
      name: str(section && section.name).trim(),
      count: Math.max(0, Number(section && section.count) || 0),
      minutes: Math.max(0, Number(section && section.minutes) || 0),
      endAt: Number(section && section.endAt) || 0,
    }))
    .filter((section) => section.count > 0 && section.minutes > 0);
  return {
    items,
    idx: Math.min(items.length - 1, Math.max(0, Number(s.idx) || 0)),
    sectionIdx: sections.length ? Math.min(sections.length - 1, Math.max(0, Number(s.sectionIdx) || 0)) : 0,
    sections,
    startedAt: s.startedAt,
    deadline: s.deadline,
    allowedSeconds: s.allowedSeconds,
    expired: now >= s.deadline,
  };
}

module.exports = {
  WEAK_MIN_ATTEMPTS,
  statVals,
  computeStats,
  weakestRow,
  overallStats,
  fmtPct,
  parseHistory,
  errorLog,
  sliceQuestionRange,
  buildTestSet,
  suggestMinutes,
  weekStart,
  weeklyAccuracy,
  trendBy,
  trendDelta,
  packTestSession,
  unpackTestSession,
};
