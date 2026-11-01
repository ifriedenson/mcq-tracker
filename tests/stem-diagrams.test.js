"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.stemDiagrams;

test("stem: chemistry blocks render structures and balanced-looking equations locally", () => {
  const structure = S.renderChemistryDiagram("SMILES: CC(=O)O");
  assert.equal(structure.ok, true);
  assert.equal(structure.kind, "structure");
  assert.match(structure.svg, /^<svg /);
  assert.match(structure.html, /qt-chem-structure/);
  assert.match(structure.svg, /aria-label="Chemical structure: CC\(=O\)O"/);

  const equation = S.renderChemistryDiagram("2H2 + O2 -> 2H2O");
  assert.equal(equation.ok, true);
  assert.equal(equation.kind, "equation");
  assert.equal(equation.plain, "2 H2 + O2 → 2 H2O");
  assert.match(equation.html, /H<sub>2<\/sub>O/);
  assert.match(equation.html, /qt-chem-arrow/);
  assert.equal(equation.html.includes("<script"), false);
});

test("stem: chemistry rejects malformed or unsupported syntax instead of guessing", () => {
  assert.equal(S.renderChemistryDiagram("H2O +").ok, false);
  assert.match(S.renderChemistryDiagram("A ->[heat] B").error, /Unsupported chemical formula/);
  assert.equal(S.renderChemistryDiagram("SMILES: C1CC").ok, false);
  assert.match(S.renderChemistryDiagram("SMILES: C1CC").error, /Unclosed ring/);
  assert.equal(S.parseChemicalSpecies("Ca(OH)2").formula, "Ca(OH)2");
  assert.equal(S.parseChemicalSpecies("SO4^2-").charge, "2-");
});

test("stem: biology blocks show strands, complements and codon translation", () => {
  const dna = S.renderBiologyDiagram("DNA: ATGGCCTAA\ncomplement: true");
  assert.equal(dna.ok, true);
  assert.equal(dna.type, "dna");
  assert.equal(dna.complement, "TACCGGATT");
  assert.equal(dna.protein, "MA*");
  assert.match(dna.html, /qt-bio-codon/);
  assert.match(dna.html, /qt-bio-complement/);
  assert.match(dna.html, /title="Methionine"/);
  assert.match(dna.html, /qt-bio-stop/);

  const rna = S.renderBiologyDiagram("type: rna\nsequence: AUG GCU UAA");
  assert.equal(rna.ok, true);
  assert.equal(rna.sequence, "AUGGCUUAA");
  assert.equal(rna.protein, "MA*");
  assert.match(rna.html, /RNA · 9 nt/);

  const protein = S.renderBiologyDiagram("type: protein\nsequence: MKT*");
  assert.equal(protein.ok, true);
  assert.equal(protein.kind, "protein");
  assert.match(protein.html, /4 residues/);
});

test("stem: biology validates the sequence type and alphabet", () => {
  assert.equal(S.renderBiologyDiagram("type: dna\nsequence: AUG").ok, false);
  assert.match(S.renderBiologyDiagram("type: dna\nsequence: AUG").error, /cannot contain U/);
  assert.equal(S.renderBiologyDiagram("type: rna\nsequence: ATG").ok, true);
  assert.equal(S.renderBiologyDiagram("type: protein\nsequence: MKT!").ok, false);
});

test("stem: circuit blocks parse a loop and a parallel branch network", () => {
  const loop = S.renderCircuitDiagram("battery V1 1 0 9V\nresistor R1 1 2 100Ω\nlamp L1 2 0");
  assert.equal(loop.ok, true);
  assert.equal(loop.components, 3);
  assert.equal(loop.nodes, 3);
  assert.match(loop.svg, /^<svg /);
  assert.match(loop.svg, /V1 9V/);
  assert.match(loop.svg, /R1 100Ω/);
  assert.equal(loop.svg.includes("<script"), false);

  const parallel = S.renderCircuitDiagram("V1 1 0 9\nR1 1 0 100\nLED1 1 0 red");
  assert.equal(parallel.ok, true);
  assert.equal(parallel.mode, "parallel");
  assert.match(parallel.svg, /LED1 red/);

  assert.equal(S.renderCircuitDiagram("battery V1 1 0\nresistor V1 1 2").ok, false);
  assert.match(S.renderCircuitDiagram("battery V1 1 0\nresistor R1 1").error, /missing its nodes/);
  assert.equal(S.renderCircuitDiagram("ground GND 0").ok, false);
});

test("stem: plugin registers all local diagram blocks and reports errors in place", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  for (const name of ["chem", "biology", "biosequence", "circuit"]) assert.equal(typeof plugin.codeBlocks[name], "function");
  const dom = makeDom();
  plugin.codeBlocks.chem("H2O +", dom.root);
  assert.ok(dom.texts().some((text) => /Chemistry:/.test(text)));
  plugin.codeBlocks.biology("not a sequence", dom.root);
  assert.ok(dom.texts().some((text) => /Biology:/.test(text)));
  plugin.codeBlocks.circuit("nonsense", dom.root);
  assert.ok(dom.texts().some((text) => /Circuit:/.test(text)));
  const success = makeDom();
  plugin.codeBlocks.chem("2H2 + O2 -> 2H2O", success.root);
  assert.ok(success.all.some((element) => element.classes.has("qt-stem-block")));
  assert.ok(!success.all.some((element) => element.classes.has("qt-stem") && element.meta.tag === "div"), "the wrapper must not borrow the question-stem class");
});

test("stem: question Markdown preserves fenced blocks for the registered processors", async () => {
  const previous = obsidian.MarkdownRenderer.render;
  let seen = "";
  obsidian.MarkdownRenderer.render = async (_app, markdown) => {
    seen = markdown;
  };
  try {
    T.renderMarkdownInto({}, "Read the diagram.\n\n```chem\n2H2 + O2 -> 2H2O\n```", { setText() {} }, "Questions/stem.md", {});
    await Promise.resolve();
    assert.match(seen, /```chem/);
    assert.match(seen, /2H2 \+ O2 -> 2H2O/);
  } finally {
    obsidian.MarkdownRenderer.render = previous;
  }
});
