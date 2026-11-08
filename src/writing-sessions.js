"use strict";
/*
 * Read-only writing-session count. This is the local, dependency-free half of
 * the Better Word Count row in plan.md §5.24: it counts the words in the active
 * note and how many were added since the session started. A note is only read;
 * nothing is written to it, and no background index runs. The only state is a
 * bounded local list of finished session times in the plugin's own settings.
 */
const { str } = require("./util");

const MAX_SESSIONS = 200;
const MAX_PATH = 400;
const WORDS_PER_MINUTE = 200;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;
const SENTENCE = /[.!?]+(?:\s|$)/g;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Words, characters, sentences and paragraphs in one note body. */
function countText(text) {
  const source = str(text).replace(/\r\n?/g, "\n");
  const words = source.match(WORD) || [];
  const sentences = (source.match(SENTENCE) || []).length;
  const trimmed = source.trim();
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((block) => block.trim()).length : 0;
  return {
    words: words.length,
    characters: source.replace(/\s/g, "").length,
    sentences,
    paragraphs,
  };
}

/** Whole minutes at 200 words per minute; a non-empty note always reads as 1. */
function readingMinutes(words) {
  const count = Math.max(0, Math.round(number(words, 0)));
  return count ? Math.max(1, Math.ceil(count / WORDS_PER_MINUTE)) : 0;
}

function sessionRow(value) {
  const source = asObject(value);
  const path = str(source.path).trim().slice(0, MAX_PATH);
  const startedAt = Math.max(0, Math.round(number(source.startedAt, 0)));
  if (!path || !startedAt) return null;
  const endedAt = Math.max(startedAt, Math.round(number(source.endedAt, 0)));
  return {
    path,
    startedAt,
    endedAt,
    words: Math.max(0, Math.round(number(source.words, 0))),
    minutes: Math.max(0, Math.round((endedAt - startedAt) / 60000)),
  };
}

function normalizeWritingSession(value) {
  const source = asObject(value);
  const sessions = [];
  for (const raw of Array.isArray(source.sessions) ? source.sessions : []) {
    const row = sessionRow(raw);
    if (!row) continue;
    sessions.push(row);
    if (sessions.length >= MAX_SESSIONS) break;
  }
  const path = str(source.path).trim().slice(0, MAX_PATH);
  const startedAt = Math.max(0, Math.round(number(source.startedAt, 0)));
  return {
    path: startedAt ? path : "",
    startedAt: path ? startedAt : 0,
    baseline: path && startedAt ? Math.max(0, Math.round(number(source.baseline, 0))) : 0,
    sessions,
  };
}

/** Start counting one note from its current word count. */
function startWritingSession(current, input, now) {
  const state = normalizeWritingSession(current);
  const source = asObject(input);
  const path = str(source.path).trim().slice(0, MAX_PATH);
  if (!path) return { ok: false, reason: "path", message: "Open a note before starting a writing session." };
  if (state.startedAt) return { ok: false, reason: "running", message: "A writing session is already running. Finish or cancel it first." };
  const stamp = Math.max(0, Math.round(number(now, Date.now())));
  return {
    ok: true,
    value: {
      path,
      startedAt: stamp,
      baseline: countText(source.text).words,
      sessions: state.sessions,
    },
  };
}

/** Stop counting, record the added words and keep the newest bounded sessions. */
function finishWritingSession(current, text, now) {
  const state = normalizeWritingSession(current);
  if (!state.startedAt) return { ok: false, reason: "idle", message: "No writing session is running." };
  const stamp = Math.max(state.startedAt, Math.round(number(now, Date.now())));
  const session = sessionRow({
    path: state.path,
    startedAt: state.startedAt,
    endedAt: stamp,
    words: Math.max(0, countText(text).words - state.baseline),
  });
  const sessions = state.sessions.concat(session).slice(-MAX_SESSIONS);
  return {
    ok: true,
    session,
    value: { path: "", startedAt: 0, baseline: 0, sessions },
  };
}

/** Drop the running session without recording it. */
function cancelWritingSession(current) {
  const state = normalizeWritingSession(current);
  return { path: "", startedAt: 0, baseline: 0, sessions: state.sessions };
}

/** The current counts plus the bounded session totals, for the view. */
function sessionReport(current, text, now) {
  const state = normalizeWritingSession(current);
  const counts = countText(text);
  const added = state.startedAt ? Math.max(0, counts.words - state.baseline) : 0;
  const elapsed = state.startedAt ? Math.max(0, Math.round(number(now, Date.now())) - state.startedAt) : 0;
  const totals = state.sessions.reduce(
    (sum, session) => ({ count: sum.count + 1, words: sum.words + session.words, minutes: sum.minutes + session.minutes }),
    { count: 0, words: 0, minutes: 0 }
  );
  return {
    running: !!state.startedAt,
    path: state.path,
    startedAt: state.startedAt,
    baseline: state.baseline,
    minutes: Math.round(elapsed / 60000),
    counts: { ...counts, readingMinutes: readingMinutes(counts.words) },
    added,
    sessions: state.sessions,
    totals,
  };
}

function baseName(path) {
  const parts = str(path).split("/");
  return parts[parts.length - 1] || str(path);
}

/** `Cells.md · 12 min · +340 words` for one finished session. */
function sessionLine(session) {
  const row = sessionRow(session);
  if (!row) return "";
  return `${baseName(row.path)} · ${row.minutes} min · +${row.words} words`;
}

/** `412 words · 3 min read · +96 this session` for the current note. */
function writingSummary(report) {
  const source = asObject(report);
  const counts = asObject(source.counts);
  const parts = [`${Math.max(0, Math.round(number(counts.words, 0)))} words`];
  parts.push(`${Math.max(0, Math.round(number(counts.sentences, 0)))} sentences`);
  parts.push(`${readingMinutes(counts.words)} min read`);
  if (source.running) parts.push(`+${Math.max(0, Math.round(number(source.added, 0)))} this session`);
  return parts.join(" · ");
}

module.exports = {
  MAX_SESSIONS,
  WORDS_PER_MINUTE,
  cancelWritingSession,
  countText,
  finishWritingSession,
  normalizeWritingSession,
  readingMinutes,
  sessionLine,
  sessionReport,
  startWritingSession,
  writingSummary,
};
