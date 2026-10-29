"use strict";
/*
 * Matching questions and normalized text answers.
 *
 * A matching note lists pairs under `## Pairs`, one per line, as
 * `Left :: Right` (or `=>`). The right column is shuffled for display, but a
 * pick is stored as its index in the note's pair order, so the same attempt
 * grades identically after a restart and history stays free of raw text.
 */

const { str } = require("./util");

/** Case, whitespace, surrounding punctuation and a leading article are ignored. */
function normalizeTextAnswer(value) {
  return str(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^[\s"'“”‘’([{]+|[\s"'“”‘’)\]}.,;:!?]+$/g, "")
    .replace(/^(?:a|an|the)\s+/, "")
    .replace(/\s+/g, " ");
}

/** One `- Left :: Right` line, or null when the line is not a pair. */
function parsePairLine(line) {
  const text = str(line)
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .trim();
  const m = /^(.+?)\s*(?:::|=>|->)\s*(.+)$/.exec(text);
  if (!m) return null;
  const left = m[1].trim();
  const right = m[2].trim();
  if (!left || !right) return null;
  return { left, right };
}

/** Pairs from a `## Pairs` section; a repeated left item is ignored. */
function parsePairs(text) {
  const out = [];
  const seen = new Set();
  for (const line of str(text).split("\n")) {
    const pair = parsePairLine(line);
    if (!pair) continue;
    const key = normalizeTextAnswer(pair.left);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(pair);
  }
  return out;
}

function seedValue(seed) {
  let h = 2166136261;
  for (const ch of str(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable shuffle, so a re-render or a restart keeps the same option order. */
function shuffleForSeed(list, seed) {
  const arr = (Array.isArray(list) ? list : []).slice();
  let h = seedValue(seed) || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    const j = h % (i + 1);
    const swap = arr[i];
    arr[i] = arr[j];
    arr[j] = swap;
  }
  return arr;
}

/** Reads `[2,0,1]`; a missing or malformed pick becomes -1. */
function parsePicks(value) {
  const text = str(value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => (Number.isInteger(Number(item)) ? Number(item) : -1));
  } catch (e) {
    return [];
  }
}

/**
 * Grades a full matching attempt. `chosen` is the JSON index array written by
 * the view; each row is correct only when it points at that row's own answer.
 */
function gradeMatching(pairs, chosen) {
  const list = Array.isArray(pairs) ? pairs : [];
  const picks = parsePicks(chosen);
  const rows = list.map((pair, index) => {
    const at = picks[index];
    const picked = Number.isInteger(at) && at >= 0 && at < list.length ? str(list[at].right).trim() : "";
    return {
      left: str(pair.left).trim(),
      right: str(pair.right).trim(),
      picked,
      correct: !!picked && normalizeTextAnswer(picked) === normalizeTextAnswer(pair.right),
    };
  });
  const right = rows.filter((row) => row.correct).length;
  return {
    correct: list.length > 0 && right === list.length,
    mode: "match",
    interpreted: `${right} of ${list.length} pairs matched`,
    reason: right === list.length ? "" : `${list.length - right} pair${list.length - right === 1 ? "" : "s"} not matched`,
    rows,
    right,
    total: list.length,
  };
}

module.exports = {
  normalizeTextAnswer,
  parsePairLine,
  parsePairs,
  shuffleForSeed,
  parsePicks,
  gradeMatching,
};
