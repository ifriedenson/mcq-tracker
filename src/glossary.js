"use strict";
/*
 * Read-only glossary built from definitions the vault already contains. This is
 * the local alternative to the Dictionary row in plan.md §5.24: it reads
 * `Term: definition` lines and two-column Markdown tables, keeps everything in
 * memory and never edits, resolves or writes a note. No word leaves the vault
 * and no external dictionary is requested.
 */
const { str } = require("./util");

const MAX_FILES = 500;
const MAX_ENTRIES = 1000;
const MAX_TERM = 80;
const MAX_TEXT = 240;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const HEADER_TERM = /^(term|word|key|name|concept)$/i;
const HEADER_MEANING = /^(meaning|definition|description|explanation|notes?)$/i;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function normalizeGlossaryOptions(value) {
  const source = asObject(value);
  return {
    folder: str(source.folder).trim().replace(/^\/+|\/+$/g, "").slice(0, 400),
    limit: clamp(Number.isFinite(Number(source.limit)) ? Number(source.limit) : DEFAULT_LIMIT, 1, MAX_LIMIT),
  };
}

function inFolder(path, folder) {
  if (!folder) return true;
  return path === folder || path.startsWith(`${folder}/`);
}

/** Strip emphasis and inline code, then collapse whitespace. */
function clean(value) {
  return str(value)
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** One definition pair, or null when either side is empty or looks like a link. */
function pair(term, definition) {
  const key = clean(term);
  const meaning = clean(definition);
  if (!key || !meaning) return null;
  if (key.length > MAX_TERM) return null;
  if (/^(?:https?:\/\/|www\.)/i.test(key) || key.includes("://")) return null;
  if (key.startsWith("[") || key.includes("[[") || key.includes("](") || key.includes("|")) return null;
  if (/^(?:https?:\/\/|www\.)/i.test(meaning) || meaning.includes("://")) return null;
  return { term: key, definition: meaning.slice(0, MAX_TEXT) };
}

/**
 * `Term: definition`, `- Term: definition` or a two-column table row. Headings,
 * checkboxes, separator rows and a table's own `Term | Meaning` header are not
 * definitions.
 */
function definitionRow(line) {
  const raw = str(line).trim();
  if (!raw || /^#{1,6}\s/.test(raw)) return null;
  if (/^(?:[-*+]\s+)?\[[ xX]\]\s/.test(raw)) return null;
  if (raw.startsWith("|")) {
    const cells = raw
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => clean(cell));
    if (cells.length < 2 || !cells[0] || !cells[1]) return null;
    if (/^:?-{2,}:?$/.test(cells[0])) return null;
    if (HEADER_TERM.test(cells[0]) && HEADER_MEANING.test(cells[1])) return null;
    return pair(cells[0], cells[1]);
  }
  const body = raw.replace(/^(?:[-*+]|\d+[.)])\s+/, "").replace(/^>\s*/, "");
  const hit = /^([^:]{1,80}?):\s+(\S.*)$/.exec(body);
  if (!hit) return null;
  return pair(hit[1], hit[2]);
}

/** Every definition in one note, with its 1-based line number. */
function glossaryLines(text) {
  const lines = str(text).replace(/\r\n?/g, "\n").split("\n");
  const rows = [];
  let fence = "";
  let frontmatter = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (index === 0 && /^---\s*$/.test(line)) {
      frontmatter = true;
      continue;
    }
    if (frontmatter) {
      if (/^---\s*$/.test(line)) frontmatter = false;
      continue;
    }
    const open = /^\s*(`{3,}|~{3,})/.exec(line);
    if (open) {
      const mark = open[1][0];
      if (!fence) fence = mark;
      else if (fence === mark) fence = "";
      continue;
    }
    if (fence) continue;
    const row = definitionRow(line);
    if (row) rows.push({ line: index + 1, term: row.term, definition: row.definition });
  }
  return rows;
}

/**
 * Turn `[{ path, text }]` Markdown notes into one sorted glossary. The first
 * definition of a term wins; later copies are counted, not merged. Nothing is
 * written, linked or resolved.
 */
function collectGlossary(entries, options) {
  const settings = normalizeGlossaryOptions(options);
  const rows = [];
  const files = [];
  const seen = new Set();
  let scanned = 0;
  let duplicates = 0;
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
    const found = glossaryLines(text);
    if (!found.length) continue;
    files.push(path);
    for (const row of found) {
      if (seen.has(row.term.toLowerCase())) {
        duplicates += 1;
        continue;
      }
      if (rows.length >= MAX_ENTRIES) {
        truncated = true;
        break;
      }
      seen.add(row.term.toLowerCase());
      rows.push({ term: row.term, definition: row.definition, path, line: row.line });
    }
    if (truncated) break;
  }
  rows.sort((a, b) => a.term.localeCompare(b.term) || a.path.localeCompare(b.path));
  return {
    entries: rows.slice(0, settings.limit),
    files,
    truncated: truncated || rows.length > settings.limit,
    stats: {
      files: files.length,
      terms: rows.length,
      shown: Math.min(rows.length, settings.limit),
      duplicates,
    },
  };
}

/**
 * Ranked lookup: an exact term first, then a prefix, then a match inside the
 * term, then a match inside the definition. An empty query keeps the index.
 */
function lookupGlossary(entries, query) {
  const list = Array.isArray(entries) ? entries : [];
  const needle = str(query).trim().toLowerCase();
  if (!needle) return list.slice();
  const scored = [];
  for (const entry of list) {
    const term = str(entry && entry.term).toLowerCase();
    const definition = str(entry && entry.definition).toLowerCase();
    let score = -1;
    if (term === needle) score = 0;
    else if (term.startsWith(needle)) score = 1;
    else if (term.includes(needle)) score = 2;
    else if (definition.includes(needle)) score = 3;
    if (score >= 0) scored.push({ entry, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.entry.term.localeCompare(b.entry.term)).map((row) => row.entry);
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_ENTRIES,
  MAX_FILES,
  MAX_LIMIT,
  collectGlossary,
  definitionRow,
  glossaryLines,
  lookupGlossary,
  normalizeGlossaryOptions,
  pair,
};
