"use strict";
/*
 * Device-local outbox for typed card answers waiting on the optional AI grader.
 * Pending grades never touch note frontmatter, so an offline answer cannot be
 * mistaken for a failed review or schedule the card as "Again".
 */
const { str } = require("./util");

const MAX_PENDING = 100;

function newGradeId(now) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  return `g-${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function validEntry(entry) {
  return !!(
    entry &&
    typeof entry === "object" &&
    typeof entry.id === "string" &&
    entry.id &&
    typeof entry.path === "string" &&
    entry.path &&
    typeof entry.expected === "string" &&
    entry.expected.trim() &&
    typeof entry.typed === "string" &&
    entry.typed.trim()
  );
}

function normalizeEntry(entry) {
  return {
    id: entry.id,
    path: entry.path,
    cardId: str(entry.cardId),
    front: str(entry.front).slice(0, 1000),
    expected: str(entry.expected).slice(0, 2000),
    typed: str(entry.typed).slice(0, 2000),
    strictness: ["strict", "lenient"].includes(str(entry.strictness)) ? str(entry.strictness) : "standard",
    createdAt: str(entry.createdAt) || new Date().toISOString(),
  };
}

function unpackPendingGrades(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(validEntry).slice(-MAX_PENDING).map(normalizeEntry);
}

function packPendingGrades(list) {
  return (Array.isArray(list) ? list : []).filter(validEntry).slice(-MAX_PENDING).map(normalizeEntry);
}

/** Add one pending grade, replacing the same id if it is already queued. */
function enqueuePendingGrade(list, entry) {
  const id = str(entry && entry.id) || newGradeId();
  const next = normalizeEntry({ ...(entry || {}), id });
  return [...(Array.isArray(list) ? list : []).filter((item) => item.id !== id), next].slice(-MAX_PENDING);
}

function removePendingGrade(list, id) {
  return (Array.isArray(list) ? list : []).filter((entry) => entry.id !== id);
}

function findPendingGrade(list, id) {
  return (Array.isArray(list) ? list : []).find((entry) => entry.id === id) || null;
}

/** Count queued answers by note path for badges in Today and the Cards list. */
function pendingGradeCounts(list) {
  const counts = new Map();
  for (const entry of Array.isArray(list) ? list : []) {
    if (!validEntry(entry)) continue;
    counts.set(entry.path, (counts.get(entry.path) || 0) + 1);
  }
  return counts;
}

module.exports = {
  MAX_PENDING,
  newGradeId,
  unpackPendingGrades,
  packPendingGrades,
  enqueuePendingGrade,
  removePendingGrade,
  findPendingGrade,
  pendingGradeCounts,
};
