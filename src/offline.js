"use strict";
/*
 * A small, device-local outbox for practice attempts that could not be written
 * to a note. It deliberately lives in local storage, not the synced plugin data:
 * the vault may be the thing that is temporarily unavailable, and a per-device
 * queue avoids turning one failed attempt into several copies across devices.
 */
const { str } = require("./util");

const MAX_PENDING = 100;

function newAttemptId(now) {
  const t = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  return `a-${t.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function packAttempt(attempt) {
  const a = attempt || {};
  return { ...a, now: a.now instanceof Date && !isNaN(a.now.getTime()) ? a.now.toISOString() : a.now };
}

function unpackAttempt(attempt) {
  const a = { ...(attempt || {}) };
  if (a.now) {
    const at = new Date(a.now);
    a.now = isNaN(at.getTime()) ? new Date() : at;
  }
  return a;
}

function validEntry(entry) {
  return !!(
    entry &&
    typeof entry === "object" &&
    typeof entry.id === "string" &&
    entry.id &&
    typeof entry.path === "string" &&
    entry.path &&
    entry.attempt &&
    typeof entry.attempt === "object" &&
    typeof entry.attempt.correct === "boolean"
  );
}

/** Read whatever local storage returned. Malformed entries are ignored, newest kept. */
function unpackPendingAttempts(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(validEntry)
    .slice(-MAX_PENDING)
    .map((entry) => ({
      id: entry.id,
      path: entry.path,
      errorType: str(entry.errorType),
      attempt: unpackAttempt({ ...entry.attempt, attemptId: entry.id }),
    }));
}

function packPendingAttempts(list) {
  return (Array.isArray(list) ? list : [])
    .filter(validEntry)
    .slice(-MAX_PENDING)
    .map((entry) => ({
      id: entry.id,
      path: entry.path,
      errorType: str(entry.errorType),
      attempt: packAttempt({ ...entry.attempt, attemptId: entry.id }),
    }));
}

/** Add one attempt, replacing the same id if it is already queued. */
function enqueuePending(list, path, attempt) {
  const id = str(attempt && attempt.attemptId) || newAttemptId(attempt && attempt.now);
  const entry = {
    id,
    path: str(path),
    errorType: "",
    attempt: { ...(attempt || {}), attemptId: id },
  };
  return [...(Array.isArray(list) ? list : []).filter((e) => e.id !== id), entry].slice(-MAX_PENDING);
}

function removePending(list, id) {
  return (Array.isArray(list) ? list : []).filter((e) => e.id !== id);
}

/** Attach the "why did I miss it" tag to an attempt that has not been written yet. */
function updatePendingError(list, path, id, type) {
  const entry = (Array.isArray(list) ? list : []).find((e) => e.id === id && e.path === path);
  if (!entry) return null;
  entry.errorType = str(type);
  return list;
}

function cloneFrontmatter(fm) {
  try {
    return JSON.parse(JSON.stringify(fm || {}));
  } catch (e) {
    return {};
  }
}

module.exports = {
  MAX_PENDING,
  newAttemptId,
  packAttempt,
  unpackAttempt,
  unpackPendingAttempts,
  packPendingAttempts,
  enqueuePending,
  removePending,
  updatePendingError,
  cloneFrontmatter,
};
