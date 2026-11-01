"use strict";
const { str } = require("./util");
const { creditSummary } = require("./stats");

/* Mastery per source note. Questions and cards written from a note carry
 * `source_note`, so practice accuracy can be grouped back to the note that
 * taught the idea. Nothing leaves the vault and no note content is read. */

const MASTERY_BANDS = [
  { id: "weak", label: "Needs work" },
  { id: "developing", label: "Developing" },
  { id: "strong", label: "Strong" },
];

function masteryBand(accuracy) {
  if (accuracy === null || accuracy === undefined || !Number.isFinite(Number(accuracy))) return "untried";
  const value = Number(accuracy);
  if (value < 0.6) return "weak";
  if (value < 0.8) return "developing";
  return "strong";
}

function sourceLabel(path) {
  const clean = str(path).trim();
  const base = clean.split("/").pop() || clean;
  return base.replace(/\.md$/i, "") || "Untitled note";
}

/**
 * One row per note that generated practice items, weakest first. Accuracy uses
 * the note's own `attempts` and `correct_count`, the same counters as the rest
 * of Insights, so a question is never counted twice. Notes with no attempts are
 * kept but sorted last.
 */
function conceptMasteryRows(questions) {
  const rows = new Map();
  for (const q of Array.isArray(questions) ? questions : []) {
    const path = str(q && q.fm && q.fm.source_note).trim();
    if (!path) continue;
    let row = rows.get(path);
    if (!row) {
      rows.set(
        path,
        (row = { path, label: sourceLabel(path), questions: 0, attempts: 0, correct: 0, accuracy: null, band: "untried" })
      );
    }
    const summary = creditSummary(q.fm);
    row.questions++;
    row.attempts += summary.attempts;
    row.correct += summary.correct;
    row.credit = (row.credit || 0) + summary.credit;
  }

  const out = [...rows.values()].map((row) => {
    const accuracy = row.attempts ? (row.credit || 0) / row.attempts : null;
    return { ...row, accuracy, band: masteryBand(accuracy) };
  });
  out.sort((a, b) => {
    if ((a.accuracy === null) !== (b.accuracy === null)) return a.accuracy === null ? 1 : -1;
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return b.attempts - a.attempts || a.path.localeCompare(b.path, undefined, { numeric: true });
  });
  return out;
}

module.exports = {
  MASTERY_BANDS,
  conceptMasteryRows,
  masteryBand,
  sourceLabel,
};
