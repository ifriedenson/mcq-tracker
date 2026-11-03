"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();
const d = T.documentCards;

test("document cards: Markdown separators, tables and cloze become cards", () => {
  const text = [
    "# Biology",
    "",
    "- Mitochondrion: powerhouse of the cell.",
    "Osmosis :: movement of water.",
    "| Term | Definition |",
    "| --- | --- |",
    "| Mitosis | Cell division |",
    "Water {{c1::freezes}} at zero.",
  ].join("\n");
  const out = d.extractDocumentCards(text, { sourcePath: "Biology.md", deck: "Biology" });
  assert.ok(out.cards.length >= 4);
  assert.ok(out.cards.every((card) => card.importFormat === "document"));
  assert.ok(out.cards.every((card) => card.importKey.startsWith("document:")));
  assert.ok(out.cards.some((card) => card.front === "Osmosis"));
  assert.ok(out.cards.every((card) => card.sourceNote === "Biology.md"));
});

test("document cards: pages are joined in order and blank pages are skipped", () => {
  assert.equal(d.pagesText([{ text: "one" }, { text: "  " }, { text: "two" }]), "one\n\ntwo");
  assert.equal(d.pagesText([]), "");
});

test("document cards: the modal previews before writing", () => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "document-cards.js"), "utf8");
  assert.match(source, /Preview cards/);
  assert.match(source, /Nothing is written yet/);
  assert.match(source, /importParsedCards/);
});

test("document cards: AI fallback is opt-in", () => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "document-cards.js"), "utf8");
  assert.match(source, /opts\.useAi === true/);
  assert.match(source, /if \(!local\.cards\.length && opts\.useAi === true\)/);
});
