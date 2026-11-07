"use strict";

const { pickQuestion } = require("./filters");
const { str } = require("./util");

const QUICK_TIME_OPTIONS = [2, 5, 10];
const QUICK_COUNT_OPTIONS = [5, 10, 20];

/**
 * Selects distinct questions without mutating the caller's pool. The queue is
 * persisted by path so it can be resumed after Obsidian restarts.
 */
function buildQuickQueue(pool, mode, today, limit, all) {
  const rest = pool.slice();
  const out = [];
  while (out.length < limit && rest.length) {
    const pick = pickQuestion(rest, mode, today, [], undefined, all);
    if (!pick) break;
    out.push(pick);
    rest.splice(rest.indexOf(pick), 1);
  }
  return out;
}

function createQuickSession(items, options, now) {
  const startedAt = Number.isFinite(now) ? now : Date.now();
  const kind = options && options.kind === "time" ? "time" : "count";
  const value = Math.max(1, Math.round(Number(options && options.value) || 1));
  return {
    v: 1,
    paths: items.map((q) => q.file.path),
    index: 0,
    mode: str(options && options.mode) || "smart",
    label: str(options && options.label),
    kind,
    value,
    startedAt,
    remainingSeconds: kind === "time" ? value * 60 : 0,
    runningSince: kind === "time" ? startedAt : 0,
    daily: options && options.daily === true,
    date: str(options && options.date),
  };
}

function packQuickSession(session) {
  if (!session) return null;
  return {
    v: 1,
    paths: Array.isArray(session.paths) ? session.paths.slice() : [],
    index: Math.max(0, Math.floor(Number(session.index) || 0)),
    mode: str(session.mode) || "smart",
    label: str(session.label),
    kind: session.kind === "time" ? "time" : "count",
    value: Math.max(1, Math.round(Number(session.value) || 1)),
    startedAt: Number(session.startedAt) || 0,
    deadline: Number(session.deadline) || 0,
    remainingSeconds: Number.isFinite(session.remainingSeconds) ? Math.max(0, session.remainingSeconds) : 0,
    runningSince: Number(session.runningSince) || 0,
    daily: session.daily === true,
    date: str(session.date),
  };
}

function unpackQuickSession(saved, now) {
  if (!saved || saved.v !== 1 || !Array.isArray(saved.paths) || !saved.paths.length) return null;
  if (!saved.paths.every((p) => typeof p === "string" && p)) return null;
  const session = packQuickSession(saved);
  if (!session.startedAt || session.index >= session.paths.length) return null;
  if (session.kind === "time" && quickRemainingSeconds(session, now) <= 0) {
    return { ...session, expired: true };
  }
  return session;
}

function quickRemainingSeconds(session, now) {
  if (!session || session.kind !== "time") return null;
  const current = now || Date.now();
  const base = Number.isFinite(session.remainingSeconds) && session.remainingSeconds
    ? session.remainingSeconds
    : Math.max(0, (session.deadline - session.startedAt) / 1000);
  const spent = session.runningSince ? Math.max(0, (current - session.runningSince) / 1000) : 0;
  return Math.max(0, Math.ceil(base - spent));
}

function pauseQuickSession(session, now) {
  if (!session || session.kind !== "time" || !session.runningSince) return;
  session.remainingSeconds = quickRemainingSeconds(session, now);
  session.runningSince = 0;
}

function resumeQuickSession(session, now) {
  if (!session || session.kind !== "time" || session.runningSince || quickRemainingSeconds(session, now) <= 0) return;
  session.runningSince = now || Date.now();
}

/**
 * Parse the home-screen shortcut parameters. Obsidian hands the handler
 * already-decoded query values; only the documented keys are read, so an
 * extra `vault` parameter does not break a multi-vault shortcut.
 */
function parseQuickPracticeUri(params) {
  const p = params || {};
  const hasMinutes = Object.prototype.hasOwnProperty.call(p, "minutes");
  const hasCount = Object.prototype.hasOwnProperty.call(p, "count");
  if (hasMinutes && hasCount) return { error: "Use either minutes= or count=, not both." };
  let kind = "time";
  let value = null;
  if (hasMinutes) {
    const raw = String(p.minutes == null ? "" : p.minutes).trim();
    if (!/^\d+$/.test(raw) || !QUICK_TIME_OPTIONS.includes(Number(raw))) {
      return { error: `minutes must be one of ${QUICK_TIME_OPTIONS.join(", ")}.` };
    }
    value = Number(raw);
  } else if (hasCount) {
    const raw = String(p.count == null ? "" : p.count).trim();
    if (!/^\d+$/.test(raw) || !QUICK_COUNT_OPTIONS.includes(Number(raw))) {
      return { error: `count must be one of ${QUICK_COUNT_OPTIONS.join(", ")}.` };
    }
    kind = "count";
    value = Number(raw);
  }
  const course = str(p.course).trim();
  if (course.length > 80) return { error: "course must be 80 characters or fewer." };
  return { kind, value, course };
}

module.exports = {
  parseQuickPracticeUri,
  QUICK_TIME_OPTIONS,
  QUICK_COUNT_OPTIONS,
  buildQuickQueue,
  createQuickSession,
  packQuickSession,
  unpackQuickSession,
  quickRemainingSeconds,
  pauseQuickSession,
  resumeQuickSession,
};
