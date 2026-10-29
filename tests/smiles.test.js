"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const smiles = T.smiles;

test("smiles: a chain, a branch and a ring parse into the expected graph", () => {
  const ethanol = smiles.parseSmiles("CCO");
  assert.equal(ethanol.ok, true);
  assert.equal(ethanol.graph.atoms.length, 3);
  assert.equal(ethanol.graph.bonds.length, 2);
  const acid = smiles.parseSmiles("CC(=O)O");
  assert.equal(acid.ok, true);
  assert.equal(acid.graph.atoms.length, 4);
  assert.equal(acid.graph.bonds.length, 3);
  const benzene = smiles.parseSmiles("c1ccccc1");
  assert.equal(benzene.ok, true);
  assert.equal(benzene.graph.atoms.length, 6);
  assert.equal(benzene.graph.bonds.length, 6);
});

test("smiles: bracket atoms keep charge and hydrogen count", () => {
  const result = smiles.parseSmiles("[NH4+].[Cl-]");
  assert.equal(result.ok, true);
  assert.equal(result.graph.atoms[0].hydrogen, undefined);
  assert.equal(result.graph.atoms[0].hydrogens, 4);
  assert.equal(result.graph.atoms[0].charge, 1);
  assert.equal(result.graph.atoms[1].element, "Cl");
  assert.equal(result.graph.atoms[1].charge, -1);
});

test("smiles: invalid or incomplete syntax returns an error instead of guessing", () => {
  assert.equal(smiles.parseSmiles("C1CC").ok, false);
  assert.match(smiles.parseSmiles("C1CC").error, /Unclosed ring/);
  assert.equal(smiles.parseSmiles("C(C").ok, false);
  assert.equal(smiles.parseSmiles("C=$").ok, false);
});

test("smiles: rendering is local SVG, escapes labels and shows hetero atoms", () => {
  const result = smiles.renderSmilesSvg("CC(=O)O");
  assert.equal(result.ok, true);
  assert.match(result.svg, /^<svg /);
  assert.match(result.svg, /viewBox=/);
  assert.match(result.svg, />O</);
  assert.match(result.svg, /aria-label="Chemical structure: CC\(=O\)O"/);
  assert.equal(result.svg.includes("<script"), false);
});

test("plugin: the smiles code block is registered without a chemistry plugin", async () => {
  const { makeApp } = require("./helpers/fake");
  const { load } = require("./helpers/load");
  const { Plugin: QT } = load();
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  assert.equal(typeof plugin.codeBlocks.smiles, "function");
});
