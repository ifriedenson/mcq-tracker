"use strict";
/*
 * Render a `simple-flashcards` block. The reader is deliberately local and
 * read-only: it reveals answers in memory and never records attempts, history,
 * streak or scheduler state.
 */
const { renderMarkdownInto } = require("./view-helpers");
const { parseSimpleFlashcards } = require("./simple-flashcards");

const LABELS = {
  basic: "Basic",
  forward: "Forward",
  backward: "Reverse",
  bidirectional: "Both ways",
  cloze: "Cloze",
  multiline: "Multiline",
};

function kindLabel(card) {
  const label = LABELS[card.type] || "Card";
  if (card.type === "bidirectional") return card.direction === "reverse" ? `${label} ←` : `${label} →`;
  return label;
}

/** Draw one card at a time with a reveal step and a next/restart control. */
async function renderSimpleFlashcardsBlock(plugin, source, el, ctx) {
  const parsed = parseSimpleFlashcards(source);
  const cards = parsed.cards;
  const path = ctx && ctx.sourcePath ? ctx.sourcePath : "";
  const box = el.createDiv({ cls: "qt-flashcards" });
  box.createDiv({ cls: "qt-flashcards-title", text: "Simple flashcards" });
  if (cards.length) {
    const decks = [...new Set(cards.map((card) => card.deck).filter(Boolean))];
    const summary = `${cards.length} card${cards.length === 1 ? "" : "s"}`;
    box.createDiv({ cls: "qt-flashcards-summary", text: decks.length ? `${summary} · ${decks.join(", ")}` : summary });
  }
  for (const issue of parsed.issues.slice(0, 8)) box.createDiv({ cls: "qt-flashcards-issue", text: issue });
  if (!cards.length) return;

  const stage = box.createDiv({ cls: "qt-flashcards-stage" });
  let index = 0;
  let revealed = false;

  const paint = () => {
    stage.empty();
    const card = cards[index];
    const head = stage.createDiv({ cls: "qt-flashcards-head" });
    head.createSpan({ cls: "qt-flashcards-count", text: `${index + 1} / ${cards.length}` });
    head.createSpan({ cls: "qt-flashcards-kind", text: kindLabel(card) });
    if (card.deck) head.createSpan({ cls: "qt-flashcards-deck", text: card.deck });

    const prompt = stage.createDiv({ cls: "qt-flashcards-prompt" });
    renderMarkdownInto(plugin.app, card.front, prompt, path, plugin);

    if (!revealed) {
      const reveal = stage.createEl("button", { cls: "qt-flashcards-reveal", text: "Show answer" });
      reveal.addEventListener("click", () => {
        revealed = true;
        paint();
      });
      return;
    }

    const answer = stage.createDiv({ cls: "qt-flashcards-answer" });
    renderMarkdownInto(plugin.app, card.back, answer, path, plugin);
    const last = index === cards.length - 1;
    const next = stage.createEl("button", { cls: "qt-flashcards-next", text: last ? "Review again" : "Next card" });
    next.addEventListener("click", () => {
      if (last) {
        index = 0;
        revealed = false;
      } else {
        index++;
        revealed = false;
      }
      paint();
    });
  };

  paint();
}

module.exports = { renderSimpleFlashcardsBlock };
