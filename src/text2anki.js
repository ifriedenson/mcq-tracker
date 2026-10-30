"use strict";
/*
 * Text2Anki: the one-shot selection path from the MIT text2anki-openai plugin.
 *
 * It deliberately uses the same source batch, card store and Anki bridge as
 * Auto Anki; this module only normalizes the shortcut's settings, strips its
 * note-level Deck: directive and builds the user-facing result line.
 */
const { str } = require("./util");
const { autoAnkiSourceKey } = require("./auto-anki");

const DEFAULT_TEXT2ANKI = {
  count: 5,
  deck: "",
  customPrompt: "",
};

function normalizeText2Anki(value, fallbackDeck) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    count: Math.max(1, Math.min(20, Math.round(Number(src.count) || DEFAULT_TEXT2ANKI.count))),
    deck: str(src.deck).trim() || str(fallbackDeck).trim(),
    customPrompt: str(src.customPrompt).trim().slice(0, 2000),
  };
}

/** `Deck: Computer Science::Python` at the start of a line sets the deck for this run. */
function text2AnkiDeckDirective(text) {
  const match = str(text).match(/^[ \t]*Deck:[ \t]*(.+?)[ \t]*$/im);
  return match ? match[1].trim() : "";
}

function stripText2AnkiDeck(text) {
  return str(text)
    .replace(/^[ \t]*Deck:[ \t]*.+?[ \t]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The one-shot command requires a selection; it never silently falls back to the note. */
function chooseText2AnkiSource(context) {
  const ctx = context || {};
  const raw = str(ctx.selection).trim();
  if (!raw) throw new Error("Select some text in the note first.");
  const deck = text2AnkiDeckDirective(raw) || text2AnkiDeckDirective(ctx.text);
  const text = stripText2AnkiDeck(raw);
  if (!text) throw new Error("The selection has no text after the Deck line.");
  return { kind: "selection", text, deck };
}

function text2AnkiSourceKey(path, text) {
  return autoAnkiSourceKey(path, "selection", text);
}

function text2AnkiNotice(result) {
  const r = result || {};
  const count = Number.isFinite(Number(r.cards)) ? Number(r.cards) : 0;
  const added = r.pushed && Number.isFinite(Number(r.pushed.added)) ? Number(r.pushed.added) : 0;
  const updated = r.pushed && Number.isFinite(Number(r.pushed.updated)) ? Number(r.pushed.updated) : 0;
  if (r.reused) return `Text2Anki reused ${count} existing card${count === 1 ? "" : "s"} and sent them to Anki.`;
  return `Text2Anki created ${count} card${count === 1 ? "" : "s"} and added ${added} to Anki${updated ? ` (${updated} updated)` : ""}.`;
}

module.exports = {
  DEFAULT_TEXT2ANKI,
  chooseText2AnkiSource,
  normalizeText2Anki,
  stripText2AnkiDeck,
  text2AnkiDeckDirective,
  text2AnkiNotice,
  text2AnkiSourceKey,
};
