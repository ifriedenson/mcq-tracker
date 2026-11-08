"use strict";
/*
 * A same-session review queue. A missed item is moved behind the other items
 * instead of disappearing into tomorrow; a finite requeue limit prevents an
 * impossible item from trapping the session forever.
 */
const { str } = require("./util");

const MAX_LIMIT = 25;

/** Review settings return the caller's fallback for a non-finite value; the shared clamp() returns NaN. */
function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeReviewSessionSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    requeueEnabled: src.requeueEnabled !== false,
    requeueLimit: clamp(src.requeueLimit, 1, MAX_LIMIT, 3),
  };
}

function createReviewSession(items, options) {
  const opts = options || {};
  const settings = normalizeReviewSessionSettings(opts);
  const paths = (Array.isArray(items) ? items : [])
    .map((item) => str(item && item.path !== undefined ? item.path : item))
    .filter(Boolean);
  const unique = [...new Set(paths)];
  return {
    queue: unique.slice(),
    initial: unique.slice(),
    completed: [],
    missed: [],
    requeues: {},
    requeued: 0,
    requeueEnabled: settings.requeueEnabled,
    requeueLimit: settings.requeueLimit,
  };
}

function nextPath(session) {
  return session && session.queue.length ? session.queue[0] : "";
}

function requeueCount(session, path) {
  return Number(session && session.requeues && session.requeues[path]) || 0;
}

/** Move a path to the end, within the configured limit. Returns true if it was requeued. */
function requeuePath(session, path) {
  const id = str(path);
  if (!session || !id) return false;
  const index = session.queue.indexOf(id);
  if (index >= 0) session.queue.splice(index, 1);
  if (!session.requeueEnabled) return false;
  const count = requeueCount(session, id);
  if (count >= session.requeueLimit) {
    if (!session.completed.includes(id)) session.completed.push(id);
    if (!session.missed.includes(id)) session.missed.push(id);
    return false;
  }
  session.requeues[id] = count + 1;
  session.requeued++;
  session.queue.push(id);
  return true;
}

/**
 * Record one rating. `passed` follows the four-button semantics: only Again is
 * a miss. A requeued item is appended after every item still waiting.
 */
function gradeReviewSession(session, path, passed) {
  const id = str(path);
  if (!session || !id) return session;
  const index = session.queue.indexOf(id);
  if (index >= 0) session.queue.splice(index, 1);
  if (passed) {
    if (!session.completed.includes(id)) session.completed.push(id);
  } else {
    if (!session.missed.includes(id)) session.missed.push(id);
    requeuePath(session, id);
  }
  return session;
}

/** Skip or postpone: remove the item from this run without counting it as passed. */
function dropReviewSession(session, path) {
  const id = str(path);
  if (!session || !id) return session;
  const index = session.queue.indexOf(id);
  if (index >= 0) session.queue.splice(index, 1);
  return session;
}

function finishReviewSession(session) {
  if (!session) return session;
  session.queue = [];
  return session;
}

function sessionStatus(session) {
  const queue = Array.isArray(session && session.queue) ? session.queue : [];
  const completed = Array.isArray(session && session.completed) ? session.completed : [];
  return {
    remaining: queue.length,
    completed: completed.length,
    total: new Set([...(session.initial || []), ...completed, ...queue]).size,
    requeued: Number(session && session.requeued) || 0,
    missed: Array.isArray(session && session.missed) ? session.missed.slice() : [],
    done: queue.length === 0,
  };
}

module.exports = {
  MAX_LIMIT,
  createReviewSession,
  dropReviewSession,
  finishReviewSession,
  gradeReviewSession,
  nextPath,
  normalizeReviewSessionSettings,
  requeueCount,
  requeuePath,
  sessionStatus,
};
