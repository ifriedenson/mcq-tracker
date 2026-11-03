"use strict";
/*
 * Read-only index of Markdown checkbox lines across the vault. This is the safe
 * half of the Tasks plugin idea (MIT): it lists what other notes already say and
 * never edits, rewrites or moves a note, and it does not interpret a query
 * language or another plugin's task syntax.
 */
const { str } = require("./util");

const MAX_FILES = 500;
const MAX_ROWS = 1000;
const MAX_TEXT = 200;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]\s+(.*)$/;
const TAG = /(?:^|\s)#([A-Za-z0-9][A-Za-z0-9/_-]*)/g;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function normalizeVaultTaskIndexOptions(value) {
  const source = asObject(value);
  return {
    openOnly: source.openOnly === true,
    folder: str(source.folder).trim().replace(/^\/+|\/+$/g, "").slice(0, 400),
    limit: clamp(Number.isFinite(Number(source.limit)) ? Number(source.limit) : DEFAULT_LIMIT, 1, MAX_LIMIT),
  };
}

function inFolder(path, folder) {
  if (!folder) return true;
  return path === folder || path.startsWith(`${folder}/`);
}

/** Tags written on the line itself, without an inline-code false positive. */
function tagsIn(text) {
  const plain = str(text).replace(/`[^`]*`/g, " ");
  const tags = [];
  let hit = TAG.exec(plain);
  while (hit) {
    const tag = hit[1];
    if (!tags.some((entry) => entry.toLowerCase() === tag.toLowerCase())) tags.push(tag);
    hit = TAG.exec(plain);
  }
  TAG.lastIndex = 0;
  return tags;
}

function taskRow(line) {
  const hit = CHECKBOX.exec(str(line));
  if (!hit) return null;
  const text = hit[2].replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (!text) return null;
  return { done: hit[1].toLowerCase() === "x", text, tags: tagsIn(text) };
}

/**
 * Every checkbox line in one note, with its 1-based line number. Fenced code is
 * skipped so an example inside a code block is not reported as a real task.
 */
function checkboxLines(text) {
  const lines = str(text).replace(/\r\n?/g, "\n").split("\n");
  const rows = [];
  let fence = "";
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const open = /^\s*(`{3,}|~{3,})/.exec(line);
    if (open) {
      const mark = open[1][0];
      if (!fence) fence = mark;
      else if (fence === mark) fence = "";
      continue;
    }
    if (fence) continue;
    const row = taskRow(line);
    if (!row) continue;
    rows.push({ line: index + 1, done: row.done, text: row.text, tags: row.tags });
  }
  return rows;
}

/**
 * Turn `[{ path, text }]` Markdown notes into one flat, sorted checkbox list.
 * Nothing here writes, resolves a link or touches the vault.
 */
function collectVaultTasks(entries, options) {
  const settings = normalizeVaultTaskIndexOptions(options);
  const rows = [];
  const files = [];
  let scanned = 0;
  let truncated = false;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const path = str(entry && entry.path).trim();
    const text = str(entry && entry.text);
    if (!path || !/\.md$/i.test(path) || !inFolder(path, settings.folder)) continue;
    if (scanned >= MAX_FILES) {
      truncated = true;
      break;
    }
    scanned += 1;
    const found = checkboxLines(text);
    if (!found.length) continue;
    files.push(path);
    for (const row of found) {
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
      rows.push({ path, line: row.line, done: row.done, text: row.text, tags: row.tags });
    }
    if (truncated) break;
  }
  const visible = settings.openOnly ? rows.filter((row) => !row.done) : rows;
  return {
    rows: visible.slice(0, settings.limit),
    files,
    truncated: truncated || visible.length > settings.limit,
    stats: {
      files: files.length,
      rows: rows.length,
      open: rows.filter((row) => !row.done).length,
      done: rows.filter((row) => row.done).length,
      shown: Math.min(visible.length, settings.limit),
    },
  };
}

/** Case-insensitive text, tag or note-path filter over already collected rows. */
function filterVaultTasks(rows, needle) {
  const list = Array.isArray(rows) ? rows : [];
  const query = str(needle).trim().toLowerCase().replace(/^#/, "");
  if (!query) return list.slice();
  return list.filter((row) => {
    if (str(row.path).toLowerCase().includes(query)) return true;
    if (str(row.text).toLowerCase().includes(query)) return true;
    return (Array.isArray(row.tags) ? row.tags : []).some((tag) => str(tag).toLowerCase().includes(query));
  });
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_FILES,
  MAX_LIMIT,
  MAX_ROWS,
  checkboxLines,
  collectVaultTasks,
  filterVaultTasks,
  normalizeVaultTaskIndexOptions,
  tagsIn,
};
