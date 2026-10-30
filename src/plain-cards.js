"use strict";
/*
 * Plain Markdown card structure, after Yanki's public syntax but written
 * independently for this plugin.
 *
 *   A basic card:              A reversed pair:
 *   front                      front
 *   ---                        ---
 *   back                       ---
 *                              back
 *
 *   A cloze card uses ~~struck-through~~ text, and a note may keep any
 *   ordinary Markdown around it. Folders below the configured source folder
 *   become nested Anki decks with `::`.
 */
const { str } = require("./util");

const DEFAULT_PLAIN_CARDS = { enabled: false, folder: "" };

function normalizeFolder(value) {
  return str(value).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

/** Normalise saved plain-card settings without inventing a folder. */
function normalizePlainCards(value) {
  const src = value && typeof value === "object" ? value : {};
  return {
    enabled: src.enabled === true,
    folder: normalizeFolder(src.folder),
  };
}

function bodyOnly(text) {
  return str(text).replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

/** Horizontal rules and cloze markers inside fenced code are examples, not syntax. */
function structureLines(text) {
  const lines = bodyOnly(text).split("\n");
  const rules = [];
  const cloze = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (/^\s*---\s*$/.test(lines[i])) rules.push(i);
    if (/~~[^~\n]+~~/.test(lines[i])) cloze.push(i);
  }
  return { lines, rules, cloze };
}

function sectionsOf(lines, rules) {
  const out = [];
  let start = 0;
  for (const at of rules) {
    out.push(lines.slice(start, at).join("\n").trim());
    start = at + 1;
  }
  out.push(lines.slice(start).join("\n").trim());
  return out;
}

/**
 * Infer the note type from structure alone. Returns null when the note has no
 * front/back separator, so a stray note in the folder is not presented as an
 * empty card.
 */
function inferPlainCard(text) {
  const { lines, rules, cloze } = structureLines(text);
  const sections = sectionsOf(lines, rules);
  if (cloze.length) {
    const front = sections[0] || bodyOnly(text);
    return front ? { cardType: "cloze", front, back: "" } : null;
  }
  if (rules.length === 1) {
    const front = sections[0].trim();
    const back = sections[1].trim();
    return front && back ? { cardType: "basic", front, back } : null;
  }
  // Two adjacent rules are Yanki's reversed marker: A --- --- B.
  if (rules.length === 2 && rules[1] === rules[0] + 1) {
    const front = sections[0].trim();
    const back = sections[2].trim();
    return front && back ? { cardType: "reversed", front, back } : null;
  }
  return null;
}

/** True when a path is the plain-card folder or one of its descendants. */
function isPlainPath(path, folder) {
  const root = normalizeFolder(folder);
  if (!root) return false;
  const p = normalizeFolder(path);
  return p === root || p.startsWith(root + "/");
}

/**
 * Yanki-style folder deck: the source folder and each subfolder become a
 * `::`-separated deck. A note directly in the source folder uses that folder's
 * own name; a nested note adds its subfolders.
 */
function plainDeckName(path, folder, fallback) {
  const root = normalizeFolder(folder);
  if (!root || !isPlainPath(path, root)) return "";
  const dirs = normalizeFolder(path).split("/").slice(0, -1);
  const rootParts = root.split("/");
  const rootName = rootParts[rootParts.length - 1] || "";
  const relative = dirs.slice(rootParts.length).filter(Boolean);
  const parts = [rootName, ...relative].filter(Boolean);
  return parts.length ? parts.join("::") : str(fallback).trim();
}

module.exports = {
  DEFAULT_PLAIN_CARDS,
  normalizePlainCards,
  normalizeFolder,
  inferPlainCard,
  isPlainPath,
  plainDeckName,
};
