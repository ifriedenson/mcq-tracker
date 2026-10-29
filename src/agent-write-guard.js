"use strict";
/*
 * Agent-mode protection.
 *
 * OpenCode's agent can edit note files directly, so a prompt instruction is
 * not enough to protect review history. Before an agent request the plugin
 * snapshots the protected properties of every question/card note. After the
 * request it restores anything the agent changed. This is a restore guard, not
 * a file-lock: body/deck/course edits are allowed, review state is not.
 */
const { PROTECTED_PROPERTIES } = require("./ai-write-guard");
const { str } = require("./util");

function cloneValue(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return value;
  }
}

function sameValue(a, b) {
  return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
}

function isReviewNote(fm) {
  return !!(fm && (str(fm.question_id).trim() || str(fm.card_id).trim()));
}

/** Map of note path -> protected property snapshot. */
function snapshotProtected(records) {
  const map = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const fm = (record && record.fm) || {};
    const path = (record && record.file && record.file.path) || (record && record.path) || "";
    if (!path || !isReviewNote(fm) || map.has(path)) continue;
    const state = {};
    for (const key of PROTECTED_PROPERTIES) {
      if (Object.prototype.hasOwnProperty.call(fm, key)) state[key] = cloneValue(fm[key]);
    }
    map.set(path, state);
  }
  return map;
}

/** Protected keys whose value differs from the snapshot. */
function changedProtected(before, after) {
  const old = before && typeof before === "object" ? before : {};
  const next = after && typeof after === "object" ? after : {};
  return PROTECTED_PROPERTIES.filter((key) => !sameValue(old[key], next[key]));
}

/** Apply the snapshot values back to a frontmatter object. Returns the changed keys. */
function restoreFrontmatter(target, before) {
  const fm = target && typeof target === "object" ? target : {};
  const old = before && typeof before === "object" ? before : {};
  const changes = changedProtected(old, fm);
  for (const key of changes) {
    if (Object.prototype.hasOwnProperty.call(old, key)) fm[key] = cloneValue(old[key]);
    else delete fm[key];
  }
  return changes;
}

module.exports = {
  changedProtected,
  restoreFrontmatter,
  snapshotProtected,
};
