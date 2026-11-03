"use strict";
/*
 * Folder groups for the Reference expression list, Desmos style.
 *
 * A folder is a header row `{ folder: "Name", collapsed: false }`. Every row after it
 * belongs to that folder until the next folder header, so membership is positional and
 * old row lists stay valid without a migration. Everything here is plain data: the view
 * renders the headers and the parser only ever sees expression rows, never folders.
 */

const MAX_FOLDER_NAME = 60;

/** A folder header, not an expression. */
function isFolderRow(row) {
  return !!row && typeof row === "object" && typeof row.folder === "string";
}

/** Trim, collapse whitespace and bound the name so a paste cannot grow the header without limit. */
function normalizeFolderName(value) {
  const text = String(value === null || value === undefined ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, MAX_FOLDER_NAME);
}

/** The name shown to the user; an empty name is still an addressable folder. */
function folderName(row) {
  const name = isFolderRow(row) ? normalizeFolderName(row.folder) : "";
  return name || "Untitled folder";
}

/** Each folder header with its exclusive end index and how many expression rows it holds. */
function folderGroups(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const groups = [];
  for (let i = 0; i < list.length; i++) {
    if (!isFolderRow(list[i])) continue;
    let end = i + 1;
    while (end < list.length && !isFolderRow(list[end])) end += 1;
    let count = 0;
    for (let j = i + 1; j < end; j++) if (!isFolderRow(list[j])) count += 1;
    groups.push({
      index: i,
      end,
      name: folderName(list[i]),
      collapsed: list[i].collapsed === true,
      count,
    });
  }
  return groups;
}

/**
 * Which rows can reach the drawing. Folder headers never draw, and every expression
 * inside a collapsed folder is skipped until the folder is expanded again.
 */
function rowVisibility(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const visible = list.map((row) => !isFolderRow(row));
  for (const group of folderGroups(list)) {
    if (!group.collapsed) continue;
    for (let i = group.index + 1; i < group.end; i++) visible[i] = false;
  }
  return visible;
}

/** One sentence for the screen-reader summary, or "" when the list has no folders. */
function folderSummary(rows) {
  const groups = folderGroups(rows);
  if (!groups.length) return "";
  const parts = groups.map((group) => {
    const count = `${group.count} expression${group.count === 1 ? "" : "s"}`;
    return `${group.name} (${count}, ${group.collapsed ? "collapsed" : "expanded"})`;
  });
  const hidden = groups.some((group) => group.collapsed);
  return `Folders: ${parts.join(", ")}.${hidden ? " Collapsed folders are not drawn." : ""}`;
}

module.exports = {
  MAX_FOLDER_NAME,
  isFolderRow,
  normalizeFolderName,
  folderName,
  folderGroups,
  rowVisibility,
  folderSummary,
};
