"use strict";
/*
 * Spaced Repetition quiz output for the existing card generator.
 *
 * The generated front/back pairs are rendered as the Spaced Repetition
 * plugin's multiline syntax (question, "?", answer, blank line). The note is
 * also imported through the normal card importer, so review scheduling and
 * duplicate protection stay in the existing card store.
 */
const { hashString, str } = require("./util");

function cleanLine(value) {
  return str(value).replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function spacedQuizSourceKey(sourcePath, text) {
  return `spaced-quiz-source:${hashString(`${str(sourcePath).trim()}|${str(text).trim()}`)}`;
}

function spacedQuizTitle(sourcePath) {
  const basename = str(sourcePath).replace(/^.*\//, "").replace(/\.md$/i, "").trim();
  return `${basename || "Note"} Spaced Quiz`;
}

function spacedQuizFileName(title) {
  const safe = cleanLine(title)
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90)
    .replace(/[. ]+$/g, "");
  return `${safe || "Spaced Quiz"}.md`;
}

/** Build one validated Spaced Repetition note from generated front/back pairs. */
function buildSpacedQuizNote(items, options) {
  const opts = options || {};
  const cards = (Array.isArray(items) ? items : [])
    .map((item) => ({ front: cleanLine(item && item.front), back: cleanLine(item && item.back) }))
    .filter((item) => item.front && item.back)
    .slice(0, 200);
  if (!cards.length) throw new Error("There are no usable cards to save as a Spaced Repetition quiz.");
  const sourcePath = str(opts.sourcePath).trim();
  const batch = str(opts.batch).trim() || spacedQuizSourceKey(sourcePath, cards.map((card) => `${card.front}\u0000${card.back}`).join("\n"));
  const deck = str(opts.deck).trim();
  const title = str(opts.title).trim() || spacedQuizTitle(sourcePath);
  const model = str(opts.model).trim();
  const lines = [
    "---",
    `spaced_quiz_source: ${JSON.stringify(sourcePath)}`,
    `spaced_quiz_batch: ${JSON.stringify(batch)}`,
  ];
  if (deck) lines.push(`spaced_quiz_deck: ${JSON.stringify(deck)}`);
  if (model) lines.push(`spaced_quiz_ai_model: ${JSON.stringify(model)}`);
  lines.push("---", "", `# ${title}`, "", "#flashcards", "");
  for (const card of cards) lines.push(card.front, "?", card.back, "");
  return {
    text: lines.join("\n").replace(/\n+$/, "\n"),
    cards,
    title,
    batch,
    sourcePath,
    deck,
  };
}

/** A compact result line for the command and modal. */
function spacedQuizNotice(result) {
  const r = result || {};
  const cards = Number(r.cards) || 0;
  const created = Number(r.created) || 0;
  if (r.reused) return `Spaced quiz updated: ${cards} card${cards === 1 ? "" : "s"} already tracked.`;
  return `Saved a Spaced Repetition quiz with ${cards} card${cards === 1 ? "" : "s"}${created ? ` (${created} new tracked card${created === 1 ? "" : "s"})` : ""}.`;
}

module.exports = {
  buildSpacedQuizNote,
  cleanLine,
  spacedQuizFileName,
  spacedQuizNotice,
  spacedQuizSourceKey,
  spacedQuizTitle,
};
