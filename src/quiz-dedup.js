"use strict";
/*
 * Generated quizzes should not add a second note for a question the vault
 * already contains. Stems are compared after stripping markup, punctuation and
 * case, so "Pick the gases." and "pick the gases" are the same prompt. The
 * helper is pure; plugin.js supplies the existing questions.
 */
const { str } = require("./util");

function normalizeQuestionStem(value) {
  return str(value)
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep the first draft for each normalized stem and report the skipped copies. */
function uniqueQuestionDrafts(items, existingStems) {
  const seen = new Set((Array.isArray(existingStems) ? existingStems : []).map(normalizeQuestionStem).filter(Boolean));
  const kept = [];
  const skipped = [];
  for (const item of Array.isArray(items) ? items : []) {
    const stem = normalizeQuestionStem(item && item.question);
    if (stem && seen.has(stem)) {
      skipped.push(item);
      continue;
    }
    if (stem) seen.add(stem);
    kept.push(item);
  }
  return { items: kept, skipped };
}

module.exports = { normalizeQuestionStem, uniqueQuestionDrafts };
