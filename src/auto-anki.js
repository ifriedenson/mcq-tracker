"use strict";
/*
 * Auto Anki: one command from an open note or selection to ordinary card notes
 * and the existing AnkiConnect push. The AI draft is not stored here; this
 * module only makes the generated batch and its cards deterministic.
 */
const { hashString, localDate, str } = require("./util");

const DEFAULT_AUTO_ANKI = {
  count: 8,
  deck: "",
};

function normalizeAutoAnki(value, fallbackDeck) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    count: Math.max(1, Math.min(20, Math.round(Number(src.count) || DEFAULT_AUTO_ANKI.count))),
    deck: str(src.deck).trim() || str(fallbackDeck).trim(),
  };
}

/** Resolve the requested source without silently turning an empty selection into the note. */
function chooseAutoAnkiSource(context, requested) {
  const ctx = context || {};
  const selection = str(ctx.selection).trim();
  const note = str(ctx.text).trim();
  const source = requested === "selection" || requested === "note" ? requested : "auto";
  if (source === "selection") {
    if (!selection) throw new Error("Select some text in the note first, or use the whole note.");
    return { kind: "selection", text: selection };
  }
  if (source === "auto" && selection) return { kind: "selection", text: selection };
  if (!note) throw new Error("That note has no readable text to turn into cards.");
  return { kind: "note", text: note };
}

/** Stable batch id for the exact source text, so a second run reuses the first set. */
function autoAnkiSourceKey(path, sourceKind, text) {
  return `auto-anki-source:${hashString(`${str(path).trim()}|${sourceKind === "selection" ? "selection" : "note"}|${str(text).trim()}`)}`;
}

/** Stable card identity even when another source run produces the same front/back. */
function autoAnkiCardKey(path, front, back) {
  return `auto-anki-card:${hashString(`${str(path).trim()}|${str(front).trim()}|${str(back).trim()}`)}`;
}

function autoAnkiCardInputs(generated, options) {
  const g = generated || {};
  const opts = options || {};
  const batch = str(opts.batch).trim();
  const deck = str(opts.deck).trim() || str(g.deck).trim() || "General";
  const course = str(g.course).trim();
  const sourcePath = str(g.sourcePath).trim();
  const items = Array.isArray(g.items) ? g.items : [];
  return items
    .map((card) => {
      const front = str(card && card.front).trim();
      const back = str(card && card.back).trim();
      if (!front || !back) return null;
      return {
        front,
        back,
        deck,
        course,
        sourceNote: sourcePath,
        importSource: sourcePath,
        importFormat: "auto-anki",
        importedOn: localDate(),
        aiGenerated: g.ai ? g.model || "AI" : "",
        aiModel: g.ai ? g.model || "AI" : "",
        importKey: autoAnkiCardKey(sourcePath, front, back),
        importBatch: batch,
      };
    })
    .filter(Boolean);
}

function autoAnkiBatchPaths(cards, batch) {
  const wanted = str(batch).trim();
  if (!wanted) return [];
  return [
    ...new Set(
      (Array.isArray(cards) ? cards : [])
        .filter((card) => str(card && card.fm && card.fm.import_batch).trim() === wanted)
        .map((card) => str(card && card.file && card.file.path).trim())
        .filter(Boolean)
    ),
  ];
}

module.exports = {
  DEFAULT_AUTO_ANKI,
  autoAnkiBatchPaths,
  autoAnkiCardInputs,
  autoAnkiCardKey,
  autoAnkiSourceKey,
  chooseAutoAnkiSource,
  normalizeAutoAnki,
};
