"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const C = T.cornell;

const SOURCE = `Title: Respiration
Course: Biology
Cue: What is glycolysis?
Note: Splits glucose into pyruvate.
Margin: Key term: glycolysis.
Cue: Where is the Krebs cycle?
Note: Mitochondrial matrix.
Summary: Respiration makes ATP.`;

test("cornell margins: parse Margin lines and build them back", () => {
  const parsed = C.parseCornellNote(SOURCE);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.cues[0].margin, "Key term: glycolysis.");
  assert.equal(parsed.cues[1].margin, "");
  const built = C.buildCornellBlockSource({ title: "Cells", cues: [{ cue: "What?", note: "Answer.", margin: "Remember ATP." }] });
  assert.match(built, /Cue: What\?/);
  assert.match(built, /Note: Answer\./);
  assert.match(built, /Margin: Remember ATP\./);
  const orphan = C.parseCornellNote("Margin: no cue\\nCue: What?\\nNote: Answer.");
  assert.match(orphan.issues.join(" "), /Cue: line before each Margin/);
});

test("cornell margins: the block renders a margin column and reveal restores it", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const dom = makeDom();
  plugin.codeBlocks["cornell-note"](SOURCE, dom.root, {});
  assert.ok(dom.texts().includes("Margins"));
  assert.ok(dom.texts().some((text) => /Key term: glycolysis/.test(text)));
  await dom.click("Start recall");
  assert.ok(dom.texts().some((text) => /Key term: glycolysis/.test(text)), "the margin text stays in the DOM while hidden");
  await dom.click("Reveal");
  assert.ok(dom.texts().some((text) => /Splits glucose into pyruvate/.test(text)));
});

test("cornell margins: explicit key terms drive deterministic highlighting", async () => {
  assert.deepEqual(C.cornellHighlightTerms("Key term: glycolysis; Term: ATP."), ["glycolysis", "ATP"]);
  assert.deepEqual(C.cornellHighlightTerms("Key term: ATP; Concept: atp"), ["ATP"]);
  assert.deepEqual(C.cornellHighlightTerms("Page 42"), []);
  const dom = makeDom();
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.codeBlocks["cornell-note"]("Title: Respiration\nCue: What is glycolysis?\nNote: Glycolysis splits glucose.\nMargin: Key term: glycolysis", dom.root, {});
  assert.ok(dom.texts().some((text) => text === "glycolysis"));
});
