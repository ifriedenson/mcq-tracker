"use strict";
/*
 * Bounded, byte-level undo history for the PDF editor.
 *
 * Every step stores the *serialized bytes* of the whole document next to the
 * state that belongs with those bytes (page map, annotation list, save
 * options), so undoing restores a real document rather than replaying UI
 * actions. State zero is always the file as it was opened and is never dropped,
 * so undoing every step returns exactly the bytes that were read from the vault;
 * redoing forward returns the bytes each step saved.
 *
 * The history is session-only and never persisted. It has no DOM, Obsidian,
 * network or storage imports, and every refusal is a `{ok:false, reason,
 * message}` value.
 */

const HISTORY_LIMIT = 20;
const HISTORY_BYTES = 96 * 1024 * 1024;
const MAX_LIMIT = 100;

function refusal(reason, message) {
  return { ok: false, reason, message };
}

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function normalizeLimit(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number < 1) return HISTORY_LIMIT;
  return Math.min(MAX_LIMIT, number);
}

function normalizeByteLimit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return HISTORY_BYTES;
  return Math.round(number);
}

function normalizeEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : {};
  const bytes = source.bytes && typeof source.bytes.length === "number" ? source.bytes : null;
  return {
    label: str(source.label),
    bytes,
    state: source.state && typeof source.state === "object" ? source.state : {},
  };
}

function normalizeHistory(history) {
  const source = history && typeof history === "object" ? history : {};
  const limit = normalizeLimit(source.limit);
  const byteLimit = normalizeByteLimit(source.byteLimit);
  const states = Array.isArray(source.states) ? source.states.map(normalizeEntry) : [];
  if (!states.length) return { states: [{ label: "Open the PDF", bytes: null, state: {} }], cursor: 0, limit, byteLimit };
  const raw = Math.round(Number(source.cursor));
  const cursor = Number.isFinite(raw) ? Math.max(0, Math.min(states.length - 1, raw)) : states.length - 1;
  return { states, cursor, limit, byteLimit };
}

/** The opened file is state zero; the name is only shown on a clear. */
function createHistory(bytes, state, options) {
  const source = options && typeof options === "object" ? options : {};
  return {
    states: [{ label: str(source.label) || "Open the PDF", bytes: bytes || null, state: state && typeof state === "object" ? state : {} }],
    cursor: 0,
    limit: normalizeLimit(source.limit),
    byteLimit: normalizeByteLimit(source.byteLimit),
  };
}

function byteTotal(states) {
  let total = 0;
  for (const entry of states) total += entry.bytes && entry.bytes.length ? entry.bytes.length : 0;
  return total;
}

/** Keeps state zero and bounds both the step count and the bytes held. */
function trim(history) {
  const states = history.states.slice();
  let cursor = history.cursor;
  while (states.length > history.limit + 1) {
    states.splice(1, 1);
    cursor = Math.max(0, cursor - 1);
  }
  while (states.length > 2 && byteTotal(states) > history.byteLimit) {
    const victim = cursor === 1 ? 2 : 1;
    if (victim >= states.length) break;
    states.splice(victim, 1);
    if (victim < cursor) cursor -= 1;
  }
  return Object.assign({}, history, { states, cursor });
}

/** Records the document after one finished edit; a new edit drops the redo tail. */
function recordEdit(history, label, bytes, state) {
  const value = normalizeHistory(history);
  if (!bytes || typeof bytes.length !== "number" || !bytes.length) {
    return Object.assign(refusal("bytes", "An edit needs the document's saved bytes."), { history: value });
  }
  const states = value.states.slice(0, value.cursor + 1);
  states.push({ label: str(label) || "edit", bytes, state: state && typeof state === "object" ? state : {} });
  return trim(Object.assign({}, value, { states, cursor: states.length - 1 }));
}

function canUndo(history) {
  return normalizeHistory(history).cursor > 0;
}

function canRedo(history) {
  const value = normalizeHistory(history);
  return value.cursor < value.states.length - 1;
}

/** The action that undo would reverse, or "" when there is nothing to undo. */
function nextUndoLabel(history) {
  const value = normalizeHistory(history);
  return value.cursor > 0 ? value.states[value.cursor].label : "";
}

/** The action that redo would replay, or "" when there is nothing to redo. */
function nextRedoLabel(history) {
  const value = normalizeHistory(history);
  return value.cursor < value.states.length - 1 ? value.states[value.cursor + 1].label : "";
}

function undoStep(history) {
  const value = normalizeHistory(history);
  if (value.cursor <= 0) return Object.assign(refusal("empty", "Nothing to undo."), { history: value });
  return {
    ok: true,
    label: value.states[value.cursor].label,
    entry: value.states[value.cursor - 1],
    history: Object.assign({}, value, { cursor: value.cursor - 1 }),
  };
}

function redoStep(history) {
  const value = normalizeHistory(history);
  if (value.cursor >= value.states.length - 1) return Object.assign(refusal("empty", "Nothing to redo."), { history: value });
  const entry = value.states[value.cursor + 1];
  return { ok: true, label: entry.label, entry, history: Object.assign({}, value, { cursor: value.cursor + 1 }) };
}

/** After a save the old steps contradict the written file, so only the copy remains. */
function clearHistory(history, bytes, state, label) {
  const value = normalizeHistory(history);
  return createHistory(bytes, state, {
    label: str(label) || "Saved copy",
    limit: value.limit,
    byteLimit: value.byteLimit,
  });
}

function historySummary(history) {
  const value = normalizeHistory(history);
  const undoable = value.cursor;
  const redoable = value.states.length - 1 - value.cursor;
  if (!undoable && !redoable) return "No changes yet.";
  const parts = [];
  if (undoable) parts.push(`${undoable} change${undoable === 1 ? "" : "s"} to undo`);
  if (redoable) parts.push(`${redoable} to redo`);
  return `${parts.join(", ")}.`;
}

module.exports = {
  HISTORY_LIMIT,
  HISTORY_BYTES,
  MAX_LIMIT,
  createHistory,
  recordEdit,
  canUndo,
  canRedo,
  nextUndoLabel,
  nextRedoLabel,
  undoStep,
  redoStep,
  clearHistory,
  historySummary,
};
