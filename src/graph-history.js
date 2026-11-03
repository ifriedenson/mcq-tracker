"use strict";
/*
 * Bounded undo/redo history for the Reference graph expression list.
 *
 * The history stores whole list snapshots, so an undo restores real row state
 * rather than only text fields. It is session-only and never persisted. This
 * module has no DOM, Obsidian, network or storage imports; invalid input is a
 * `{ok:false, reason, message}` refusal.
 */

const HISTORY_LIMIT = 50;
const MAX_LIMIT = 200;

const ROW_FIELDS = ["text", "hidden", "folder", "collapsed", "name", "value", "min", "max", "step", "guess"];

function cloneStyling(value) {
  if (!value || typeof value !== "object") return value;
  const copy = {};
  for (const key of ["width", "dashed", "fillOpacity", "pointSize"]) {
    if (value[key] !== undefined) copy[key] = value[key];
  }
  return copy;
}

function cloneRow(row) {
  const source = row && typeof row === "object" ? row : {};
  const copy = {};
  for (const key of ROW_FIELDS) {
    if (source[key] !== undefined) copy[key] = source[key];
  }
  if (source.styling !== undefined) copy.styling = cloneStyling(source.styling);
  return copy;
}

/** A detached, stable copy of the list for a history step. */
function snapshotRows(rows) {
  return Array.isArray(rows) ? rows.map(cloneRow) : [];
}

function sameRows(left, right) {
  return JSON.stringify(snapshotRows(left)) === JSON.stringify(snapshotRows(right));
}

function normalizeLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return HISTORY_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.round(number)));
}

function normalizeHistory(history) {
  const source = history && typeof history === "object" ? history : {};
  return {
    past: Array.isArray(source.past) ? source.past.map(snapshotRows) : [],
    future: Array.isArray(source.future) ? source.future.map(snapshotRows) : [],
    limit: normalizeLimit(source.limit),
  };
}

function refusal(reason, message) {
  return { ok: false, reason, message };
}

function createHistory(limit) {
  return { past: [], future: [], limit: normalizeLimit(limit) };
}

function canUndo(history) {
  return normalizeHistory(history).past.length > 0;
}

function canRedo(history) {
  return normalizeHistory(history).future.length > 0;
}

/** Record the state before a mutation; a new edit always drops the redo stack. */
function pushHistory(history, snapshot) {
  const value = normalizeHistory(history);
  if (!Array.isArray(snapshot)) return Object.assign(refusal("snapshot", "The expression list snapshot is not a list."), { history: value });
  const rows = snapshotRows(snapshot);
  const past = value.past.length && sameRows(value.past[value.past.length - 1], rows)
    ? value.past
    : value.past.concat([rows]).slice(-value.limit);
  return { ok: true, history: { past, future: [], limit: value.limit } };
}

function undoHistory(history, current) {
  const value = normalizeHistory(history);
  if (!value.past.length) return Object.assign(refusal("empty", "Nothing to undo."), { history: value });
  const snapshot = value.past[value.past.length - 1];
  return {
    ok: true,
    snapshot,
    history: {
      past: value.past.slice(0, -1),
      future: value.future.concat([snapshotRows(current)]).slice(-value.limit),
      limit: value.limit,
    },
  };
}

function redoHistory(history, current) {
  const value = normalizeHistory(history);
  if (!value.future.length) return Object.assign(refusal("empty", "Nothing to redo."), { history: value });
  const snapshot = value.future[value.future.length - 1];
  return {
    ok: true,
    snapshot,
    history: {
      past: value.past.concat([snapshotRows(current)]).slice(-value.limit),
      future: value.future.slice(0, -1),
      limit: value.limit,
    },
  };
}

/** Copy one expression row and insert the copy directly below it. */
function duplicateRows(rows, index) {
  if (!Array.isArray(rows)) return refusal("rows", "The expression list is not a list.");
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return refusal("index", "There is no expression at that position.");
  if (rows[index] && typeof rows[index].folder === "string") return refusal("folder", "Folders cannot be duplicated.");
  const copy = cloneRow(rows[index]);
  const next = snapshotRows(rows);
  next.splice(index + 1, 0, copy);
  return { ok: true, rows: next, index: index + 1 };
}

function listSummary(rows) {
  const count = Array.isArray(rows) ? rows.filter((row) => !(row && typeof row.folder === "string")).length : 0;
  return count === 1 ? "The list has 1 expression." : `The list has ${count} expressions.`;
}

function historyMessage(action, rows, index) {
  const summary = listSummary(rows);
  if (action === "undo") return `Undid the last expression change. ${summary}`;
  if (action === "redo") return `Redid the expression change. ${summary}`;
  if (action === "duplicate") return `Duplicated expression ${Number(index) + 1}. ${summary}`;
  if (action === "add") return `Added an expression. ${summary}`;
  if (action === "remove") return `Removed expression ${Number(index) + 1}. ${summary}`;
  if (action === "folder") return `Changed the folders. ${summary}`;
  return `Expression list changed. ${summary}`;
}

module.exports = {
  HISTORY_LIMIT,
  MAX_LIMIT,
  createHistory,
  canUndo,
  canRedo,
  pushHistory,
  undoHistory,
  redoHistory,
  duplicateRows,
  snapshotRows,
  sameRows,
  listSummary,
  historyMessage,
};
