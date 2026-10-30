"use strict";
/*
 * Mochi .mochi export.
 *
 * A .mochi file is a ZIP with `data.edn` (or `data.json`) and optional media.
 * This writes the documented EDN form:
 *
 *   {:version 2, :decks [{:name "Biology", :cards [{:name "...", :content "front\n---\nback"}]}]}
 *
 * Cards are grouped by their deck. Media stays in the vault, matching the
 * Anki text export: the card text is exported and a warning names the cards
 * whose images or audio were not bundled.
 */
const { str } = require("./util");
const { zipStore } = require("./zip-write");

const MOCHI_VERSION = 2;

/** JSON string escaping is valid EDN string escaping. */
function ednString(value) {
  return JSON.stringify(str(value));
}

function oneLine(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

function mochiCardFor(record) {
  const fm = (record && record.fm) || {};
  const body = (record && record.body) || {};
  const front = str(body.front || fm.front || fm.question).trim();
  if (!front) return null;
  const back = str(body.back || fm.back || fm.answer).trim();
  const name = oneLine(fm.card_title || (record.file && record.file.basename) || front) || "Card";
  return { name, content: back ? `${front}\n---\n${back}` : front };
}

/** One deck entry per distinct deck name, in first-seen order. */
function cardsToMochiDecks(records) {
  const decks = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const card = mochiCardFor(record);
    if (!card) continue;
    const name = oneLine((record.fm && record.fm.deck) || record.deck || "Cards") || "Cards";
    if (!decks.has(name)) decks.set(name, []);
    decks.get(name).push(card);
  }
  return [...decks.entries()].map(([name, cards]) => ({ name, cards }));
}

function cardsToMochiEdn(records) {
  const decks = cardsToMochiDecks(records);
  const body = decks
    .map((deck) => {
      const cards = deck.cards.map((card) => `{:name ${ednString(card.name)}, :content ${ednString(card.content)}}`);
      return `{:name ${ednString(deck.name)}, :cards [${cards.join(", ")}]}`;
    })
    .join(", ");
  return `{:version ${MOCHI_VERSION}, :decks [${body}]}\n`;
}

/** The complete .mochi archive: one stored `data.edn` entry. */
function buildMochiArchive(records) {
  return zipStore([{ name: "data.edn", data: cardsToMochiEdn(records) }]);
}

/** A single warning when any card references media that the archive does not carry. */
function mochiMediaWarning(records) {
  const found = (Array.isArray(records) ? records : []).filter((record) => {
    const text = `${str(record.body && record.body.front)}\n${str(record.body && record.body.back)}`;
    return /!\[\[|!\[[^\]]*\]\(/.test(text);
  });
  if (!found.length) return "";
  return `${found.length} card${found.length === 1 ? "" : "s"} reference images or audio. The .mochi file contains text only; add those files in Mochi if you need them.`;
}

module.exports = {
  MOCHI_VERSION,
  cardsToMochiDecks,
  cardsToMochiEdn,
  buildMochiArchive,
  mochiMediaWarning,
};
