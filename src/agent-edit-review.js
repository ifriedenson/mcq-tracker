"use strict";
/*
 * Pure helpers for reviewing an OpenCode agent's file edits.
 *
 * The plugin snapshots the notes the agent may edit, lets the agent work, then
 * compares the after-state with the snapshot. The chat panel reverts those
 * changes immediately and only writes back the files the learner approves.
 * Keeping the comparison here makes the safety rule testable without Obsidian.
 */
const { pathInside } = require("./ai-write-guard");
const { str } = require("./util");

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/\r\n?/g, "\n");
}

function isMarkdownPath(path) {
  return /\.md$/i.test(str(path));
}

/** Files the agent may touch: configured write folders, plus explicitly reviewed open notes. */
function isReviewablePath(path, roots) {
  if (!isMarkdownPath(path)) return false;
  return (Array.isArray(roots) ? roots : []).some((root) => pathInside(path, root));
}

function statusFor(before, after) {
  if (before === null && after === null) return "unchanged";
  if (before === null) return "added";
  if (after === null) return "deleted";
  return "modified";
}

function splitLines(value) {
  return value === null ? [] : String(value).split("\n");
}

/**
 * A compact, readable diff. It trims the unchanged prefix and suffix, then
 * lists the changed block. Very large edits are shortened in the middle so a
 * modal cannot freeze on a whole-file rewrite.
 */
function diffPreview(before, after, maxLines) {
  const oldText = normalizeText(before);
  const newText = normalizeText(after);
  if (oldText === newText) return { lines: [], added: 0, removed: 0, truncated: false };
  const a = splitLines(oldText);
  const b = splitLines(newText);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const removed = a.slice(start, endA);
  const added = b.slice(start, endB);
  const raw = [];
  if (start > 0) raw.push({ kind: "context", text: a[start - 1], oldNo: start, newNo: start });
  for (let i = 0; i < removed.length; i++) raw.push({ kind: "del", text: removed[i], oldNo: start + i + 1, newNo: null });
  for (let i = 0; i < added.length; i++) raw.push({ kind: "add", text: added[i], oldNo: null, newNo: start + i + 1 });
  if (endA < a.length) raw.push({ kind: "context", text: a[endA], oldNo: endA + 1, newNo: endB + 1 });
  const limit = Math.max(4, Math.round(Number(maxLines) || 80));
  const truncated = raw.length > limit;
  let lines = raw;
  if (truncated) {
    const half = Math.floor(limit / 2);
    lines = raw.slice(0, half).concat([{ kind: "meta", text: `... ${raw.length - limit} more changed lines ...`, oldNo: null, newNo: null }], raw.slice(-half));
  }
  return { lines, added: added.length, removed: removed.length, truncated };
}

function changeFor(path, before, after) {
  const oldText = normalizeText(before);
  const newText = normalizeText(after);
  return {
    path: str(path),
    status: oldText === newText ? "unchanged" : statusFor(oldText, newText),
    before: oldText,
    after: newText,
    diff: diffPreview(oldText, newText),
  };
}

/** Compare two path -> text maps. A missing key means the file did not exist. */
function compareSnapshots(beforeMap, afterMap) {
  const before = beforeMap instanceof Map ? beforeMap : new Map(Object.entries(beforeMap || {}));
  const after = afterMap instanceof Map ? afterMap : new Map(Object.entries(afterMap || {}));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes = [];
  for (const path of paths) {
    const oldText = before.has(path) ? normalizeText(before.get(path)) : null;
    const newText = after.has(path) ? normalizeText(after.get(path)) : null;
    if (oldText === newText) continue;
    changes.push(changeFor(path, oldText, newText));
  }
  return changes;
}

function summarize(changes) {
  const list = Array.isArray(changes) ? changes : [];
  const counts = { added: 0, modified: 0, deleted: 0 };
  for (const change of list) if (counts[change.status] !== undefined) counts[change.status]++;
  return { ...counts, total: list.length };
}

function selectedChanges(changes, selectedPaths) {
  const wanted = selectedPaths instanceof Set ? selectedPaths : new Set(Array.isArray(selectedPaths) ? selectedPaths : []);
  return (Array.isArray(changes) ? changes : []).filter((change) => wanted.has(change.path));
}

module.exports = {
  changeFor,
  compareSnapshots,
  diffPreview,
  isMarkdownPath,
  isReviewablePath,
  normalizeText,
  selectedChanges,
  statusFor,
  summarize,
};
