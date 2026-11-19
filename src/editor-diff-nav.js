"use strict";
/*
 * The diff the transcript card and the review dialog already show, brought into
 * the note itself: instead of a second overlay, stepping through a proposal
 * selects the changed lines in the open editor, so the change is seen in place.
 * Pure: hunk spans are derived from the shipped diffPreview rows, and the
 * selection only touches a duck-typed editor, so the headless suite can prove
 * it without Obsidian.
 */

/**
 * One span per maximal changed block, in old-file line numbers (what the open
 * editor holds before applying). A pure insertion anchors on the line it
 * follows, or line 1 when the file starts with the change.
 */
function hunkSpans(diff) {
  const lines = diff && Array.isArray(diff.lines) ? diff.lines : [];
  const spans = [];
  let current = null;
  let anchor = null;
  const push = () => {
    if (!current) return;
    if (current.startOld === null) current.startOld = current.endOld = anchor === null ? 1 : anchor;
    spans.push(current);
    current = null;
  };
  for (const line of lines || []) {
    const kind = line && line.kind;
    if (kind !== "add" && kind !== "del") {
      push();
      if (kind === "context" && typeof line.oldNo === "number") anchor = line.oldNo;
      continue;
    }
    if (!current) current = { startOld: null, endOld: null, startNew: null, endNew: null, anchor };
    if (typeof line.oldNo === "number" && line.oldNo !== null) {
      if (current.startOld === null || line.oldNo < current.startOld) current.startOld = line.oldNo;
      if (current.endOld === null || line.oldNo > current.endOld) current.endOld = line.oldNo;
    }
    if (typeof line.newNo === "number" && line.newNo !== null) {
      if (current.startNew === null || line.newNo < current.startNew) current.startNew = line.newNo;
      if (current.endNew === null || line.newNo > current.endNew) current.endNew = line.newNo;
    }
  }
  push();
  return spans;
}

/** Hunk spans per changed path, skipping changes with no hunks. */
function spansForChanges(changes) {
  const out = [];
  for (const change of Array.isArray(changes) ? changes : []) {
    if (!change) continue;
    const spans = hunkSpans(change.diff);
    if (!spans.length) continue;
    out.push({ path: String(change.path || ""), status: String(change.status || ""), spans });
  }
  return out;
}

/**
 * Select an old-file hunk in an open editor and scroll it into view. Returns
 * true only when the selection landed; anything missing or throwing answers
 * false so callers can fall back to opening the note instead.
 */
function selectHunk(editor, span) {
  if (!editor || !span) return false;
  try {
    if (typeof editor.getLine !== "function" || typeof editor.setSelection !== "function") return false;
    const last = typeof editor.lastLine === "function" ? Math.max(0, Math.round(Number(editor.lastLine()) || 0)) : 0;
    const start = Math.max(1, Math.round(Number(span.startOld) || 1));
    const end = Math.max(start, Math.round(Number(span.endOld) || start));
    const fromLine = Math.min(start - 1, last);
    const toLine = Math.min(end - 1, last);
    const toText = editor.getLine(toLine);
    editor.setSelection({ line: fromLine, ch: 0 }, { line: toLine, ch: String(toText === null || toText === undefined ? "" : toText).length });
    if (typeof editor.scrollIntoView === "function") {
      editor.scrollIntoView({ from: { line: fromLine, ch: 0 }, to: { line: toLine, ch: 0 } }, true);
    }
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  hunkSpans,
  selectHunk,
  spansForChanges,
};
