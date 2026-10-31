"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T } = load();
const M = T.studyMap;

const NOTE = `# Cell respiration

## Glycolysis
- Splits glucose
- Produces pyruvate

## Krebs cycle
- Mitochondrial matrix
- Produces NADH

## Electron transport
- Inner membrane
- ATP synthase`;

test("study map: source keys are parsed and unknown lines stay in the outline", () => {
  const parsed = M.parseStudyMapSource("Source: Biology/Cell respiration.md\nTitle: Respiration\nDepth: 3\nTerms: 5\n# Extra\n- One");
  assert.equal(parsed.path, "Biology/Cell respiration.md");
  assert.equal(parsed.title, "Respiration");
  assert.equal(parsed.depth, 3);
  assert.equal(parsed.terms, 5);
  assert.deepEqual(parsed.lines, ["# Extra", "- One"]);
});

test("study map: headings and bullets nest into a tree", () => {
  const outline = M.buildOutline(NOTE, { depth: 4 });
  assert.equal(outline.issues.length, 0);
  assert.equal(outline.nodes.length, 1);
  assert.equal(outline.nodes[0].text, "Cell respiration");
  assert.deepEqual(outline.nodes[0].children.map((node) => node.text), ["Glycolysis", "Krebs cycle", "Electron transport"]);
  assert.equal(outline.nodes[0].children[0].children.length, 2);
});

test("study map: key terms are repeated meaningful words", () => {
  const terms = M.extractKeyTerms("Osmosis moves water. Osmosis needs a membrane. The membrane is selective. Water moves again.");
  assert.equal(terms[0].term, "osmosis", "repeated, capitalised terms score highest");
  assert.ok(terms.some((term) => term.term === "membrane"));
  assert.ok(terms.every((term) => term.count >= 2));
});

test("study map: the map summarizes its size, focus and nodes", () => {
  const map = M.buildStudyMap(NOTE, { title: "Respiration", terms: 6 });
  assert.equal(map.title, "Respiration");
  assert.equal(map.nodes.length, 1);
  assert.equal(map.nodeCount, 10);
  assert.match(map.summary, /1 section/);
  assert.ok(map.terms.length > 0);
});

test("study map: the block renders an inline outline, reads a source note, and the switch gates it", async () => {
  const app = makeApp([{ path: "Biology/cell.md", text: NOTE }]);
  const plugin = { app, studyMapEnabled: () => true };
  const dom = makeDom();
  await M.renderStudyMapBlock(plugin, "# Osmosis\n## Definition\n- Water crosses a membrane", dom.root);
  assert.ok(dom.find("Osmosis").length > 0);
  assert.ok(dom.find("Water crosses a membrane").length > 0);

  const source = makeDom();
  await M.renderStudyMapBlock(plugin, "Source: Biology/cell.md\nTerms: 4", source.root);
  assert.ok(source.find(/Glycolysis/).length > 0);
  assert.ok(source.find(/Electron transport/).length > 0);

  const off = makeDom();
  await M.renderStudyMapBlock({ app, studyMapEnabled: () => false }, "# Title", off.root);
  assert.match(off.texts().join(" "), /Study map is off/);
});
