"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const figures = T.figures;

test("figures: a PDF marker becomes the cropped image embed", () => {
  const text = [
    "Read the chart.",
    "[FIGURE page 3: ![[Bank/images/fig.png]] (the whole page: ![[Bank/images/page-3.png]])]",
    "Which trend is shown?",
  ].join("\n");
  const out = figures.normalizeFigureMarkers(text);
  assert.match(out, /!\[\[Bank\/images\/fig\.png\]\]/);
  assert.doesNotMatch(out, /FIGURE page/);
  assert.doesNotMatch(out, /page-3\.png/);
});

test("figures: a page-only marker still shows the page image", () => {
  const out = figures.normalizeFigureMarkers("[FIGURE page 2: ![[Bank/images/page-2.png]]]");
  assert.equal(out, "![[Bank/images/page-2.png]]");
});

test("figures: ordinary embeds and missing-figure placeholders are untouched", () => {
  const text = "![[diagrams/cell.png]]\n\n[Figure not captured]";
  assert.equal(figures.normalizeFigureMarkers(text), text);
});

test("figures: embedded paths are unique and ignore aliases and headings", () => {
  const text = [
    "![[Bank/images/a.png|300]]",
    "![[Bank/images/a.png]]",
    "> ![[Bank/images/b.png#center]]",
    "![[Bank/images/c.png]]",
  ].join("\n");
  assert.deepEqual(figures.figureEmbeds(text), [
    "Bank/images/a.png",
    "Bank/images/b.png",
    "Bank/images/c.png",
  ]);
});

test("figures: markers inside a blockquote keep the quote", () => {
  const out = figures.normalizeFigureMarkers("> [FIGURE page 4: ![[images/map.png]]]");
  assert.equal(out, "> ![[images/map.png]]");
});
