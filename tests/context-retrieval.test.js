"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const R = T.contextRetrieval;

test("context retrieval: frontmatter is removed and headings stay with their passage", () => {
  const passages = R.splitPassages("---\ntitle: ATP\n---\n\n## Energy\n\nATP is the energy currency of the cell.\n\n## Cycle\n\nIt is regenerated during respiration.", 800);
  assert.equal(passages.length, 2);
  assert.equal(passages[0].heading, "Energy");
  assert.match(passages[0].text, /ATP is the energy currency/);
  assert.equal(passages[1].heading, "Cycle");
  assert.doesNotMatch(R.stripFrontmatter("---\ntitle: ATP\n---\n\nBody"), /title: ATP/);
});

test("context retrieval: a focus query ranks the relevant note and respects the note cap", () => {
  const notes = [
    { path: "Notes/Photo.md", title: "Photosynthesis", text: "Light reactions make sugar in the chloroplast." },
    { path: "Notes/ATP.md", title: "ATP", text: "## Energy\n\nATP is the energy currency of the cell and is regenerated during respiration." },
  ];
  const result = R.retrievePassages(notes, "ATP energy currency", { maxChars: 800, maxNotes: 1 });
  assert.match(result.text, /ATP is the energy currency/);
  assert.doesNotMatch(result.text, /chloroplast/);
  assert.equal(result.count, 1);
  assert.equal(result.passages, 1);
  assert.ok(result.chars <= 800);
  assert.equal(result.query, "ATP energy currency");
});

test("context retrieval: a tight budget truncates the selected context instead of oversending", () => {
  const notes = [
    { path: "Notes/Long.md", title: "Long", text: Array.from({ length: 20 }, (_, i) => `Paragraph ${i} explains a distinct fact about cell respiration and energy transfer.`).join("\n\n") },
  ];
  const result = R.retrievePassages(notes, "respiration", { maxChars: 1200, passageChars: 600 });
  assert.ok(result.chars <= 1200);
  assert.equal(result.truncated, true);
  assert.ok(result.passages >= 1);
});
