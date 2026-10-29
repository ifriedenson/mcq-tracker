"use strict";
/*
 * Code-level guard for AI writes.
 *
 * A prompt can ask a model not to touch review history, but that is not a lock.
 * These helpers enforce two rules in the plugin itself: AI writes stay inside
 * the folders the user configured, and protected tracking properties cannot
 * change when an import updates an existing note.
 */
const { str } = require("./util");

const PROTECTED_PROPERTIES = [
  "result",
  "date attempted",
  "first_attempted",
  "attempts",
  "correct_count",
  "streak",
  "time_spent_total",
  "last_time_spent",
  "last_answer",
  "last_confidence",
  "last_error_type",
  "flagged",
  "next_review",
  "last_attempt_id",
  "srs",
  "scheduler",
  "history",
  "study_status",
  "status_until",
  "known_days",
  "known_until",
  "excluded",
  "excluded_on",
  "excluded_reason",
  "suspended_on",
  "buried_until",
  "exam_cap",
  "exam_cap_name",
  "exam_cap_exam_date",
  "grade_status",
  "graded_by",
  "grade_confidence",
  "verdict_override",
];

function normalizePath(path) {
  return str(path).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function pathInside(path, root) {
  const file = normalizePath(path);
  const base = normalizePath(root);
  if (!file) return false;
  if (!base) return true;
  return file === base || file.startsWith(base + "/");
}

/** The folders AI generation may write into: the question folder, the card folder and every deck folder. */
function allowedWriteRoots(settings) {
  const s = settings || {};
  const cards = s.cards || {};
  const roots = [];
  const questionFolder = normalizePath(s.questionFolder) || "Questions";
  roots.push(questionFolder);
  roots.push(normalizePath(cards.newCardFolder) || "Cards");
  for (const deck of Array.isArray(cards.decks) ? cards.decks : []) {
    if (deck && normalizePath(deck.folder)) roots.push(normalizePath(deck.folder));
  }
  return [...new Set(roots.filter(Boolean))];
}

function assertAllowedWritePath(path, settings) {
  const roots = allowedWriteRoots(settings);
  if (!roots.some((root) => pathInside(path, root))) {
    throw new Error(
      `AI writes are limited to ${roots.join(", ") || "your configured folders"}. "${normalizePath(path)}" is outside those folders.`
    );
  }
  return normalizePath(path);
}

function sameValue(a, b) {
  return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

/** Protected properties whose values differ between two frontmatter objects. */
function protectedChanges(before, after) {
  const a = before && typeof before === "object" ? before : {};
  const b = after && typeof after === "object" ? after : {};
  return PROTECTED_PROPERTIES.filter((key) => !sameValue(a[key], b[key]));
}

/** Throws before an update is written if it would change review state. */
function assertProtectedUnchanged(before, after) {
  const changes = protectedChanges(before, after);
  if (changes.length) {
    throw new Error(`This write would change protected tracking properties: ${changes.join(", ")}.`);
  }
  return changes;
}

module.exports = {
  PROTECTED_PROPERTIES,
  allowedWriteRoots,
  assertAllowedWritePath,
  assertProtectedUnchanged,
  normalizePath,
  pathInside,
  protectedChanges,
};
