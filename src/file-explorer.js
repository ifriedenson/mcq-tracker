"use strict";
/*
 * Optional due/new markers for the file explorer.
 *
 * Obsidian has no public file-explorer decoration API. This module therefore
 * treats the explorer view as optional: it finds the built-in view when it is
 * present, adds a class to the matching file item, and otherwise does nothing.
 * The feature is off by default and never changes a note.
 */
const { isDue } = require("./filters");
const { isStudyable } = require("./study-status");

const DUE_CLASS = "qt-card-due";
const NEW_CLASS = "qt-card-new";

/** Pure path -> "due" | "new" map used by the decorator and its tests. */
function dueFilePaths(cards, today) {
  const out = new Map();
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = (card && card.fm) || {};
    const path = card && card.file && card.file.path;
    if (!path || !isStudyable(fm, today)) continue;
    if (isDue(fm, today)) out.set(path, "due");
    else if (!Number(fm.attempts)) out.set(path, "new");
  }
  return out;
}

function classListOf(item) {
  const el = item && (item.selfEl || item.el || item.innerEl);
  return el && el.classList ? el.classList : null;
}

/** Applies markers to the current built-in file-explorer items. Returns the count. */
function decorateFileExplorer(app, cards, today, enabled) {
  if (enabled !== true) return 0;
  let leaves = [];
  try {
    leaves = app && app.workspace && typeof app.workspace.getLeavesOfType === "function"
      ? app.workspace.getLeavesOfType("file-explorer")
      : [];
  } catch (e) {
    return 0;
  }
  const wanted = dueFilePaths(cards, today);
  let marked = 0;
  for (const leaf of Array.isArray(leaves) ? leaves : []) {
    const items = leaf && leaf.view && leaf.view.fileItems;
    if (!items || typeof items !== "object") continue;
    for (const item of Object.values(items)) {
      const classes = classListOf(item);
      if (!classes) continue;
      classes.remove(DUE_CLASS, NEW_CLASS);
      const path = item.file && item.file.path;
      const state = path ? wanted.get(path) : "";
      if (!state) continue;
      classes.add(state === "due" ? DUE_CLASS : NEW_CLASS);
      marked++;
    }
  }
  return marked;
}

module.exports = { DUE_CLASS, NEW_CLASS, dueFilePaths, decorateFileExplorer };
