"use strict";
// Reference sheets: unit circle, trig identities, codon table and Punnett square.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const sheets = T.referenceSheets;

test("reference sheets: the unit circle lists all sixteen common angles", () => {
  assert.equal(sheets.UNIT_CIRCLE.length, 16);
  assert.deepEqual(sheets.UNIT_CIRCLE.map((row) => row.degrees), [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]);
  const at30 = sheets.UNIT_CIRCLE.find((row) => row.degrees === 30);
  assert.equal(at30.sin, "1/2");
  assert.equal(at30.cos, "√3/2");
  assert.equal(at30.tan, "√3/3");
  assert.equal(sheets.UNIT_CIRCLE.find((row) => row.degrees === 90).tan, "undefined");
  assert.equal(sheets.UNIT_CIRCLE.find((row) => row.degrees === 180).cos, "−1");
  for (const row of sheets.UNIT_CIRCLE) {
    for (const key of ["radians", "sin", "cos", "tan"]) assert.equal(typeof row[key], "string");
  }
});

test("reference sheets: trig identities keep their groups and the Pythagorean identity", () => {
  const groups = sheets.TRIG_IDENTITIES.map((group) => group.group);
  assert.deepEqual(groups, ["Pythagorean", "Reciprocal and quotient", "Sum and difference", "Double angle", "Triangle rules"]);
  const all = sheets.TRIG_IDENTITIES.flatMap((group) => group.items);
  assert.ok(all.some((item) => item.formula === "sin²θ + cos²θ = 1"));
  assert.ok(all.some((item) => item.name === "Law of cosines"));
  for (const item of all) {
    assert.ok(item.name && item.formula, "every identity has a name and a formula");
  }
});

test("reference sheets: the codon table is complete, unique and searches by name or codon", () => {
  assert.equal(sheets.CODON_TABLE.length, 64);
  assert.equal(new Set(sheets.CODON_TABLE.map((row) => row.codon)).size, 64);
  assert.equal(sheets.aminoAcidNames().length, 21, "20 amino acids plus Stop");
  assert.equal(sheets.codonEntry("aug").aminoAcid, "Methionine");
  assert.equal(sheets.codonEntry("ATG").codon, "AUG", "DNA spelling is accepted");
  assert.equal(sheets.codonEntry("UAA").stop, true);
  assert.equal(sheets.codonEntry("uag").aminoAcid, "Stop");
  assert.equal(sheets.codonEntry("XYZ"), null);
  assert.equal(sheets.searchCodons("lysine").length, 2);
  assert.deepEqual(sheets.searchCodons("UUU").map((row) => row.codon), ["UUU"]);
  assert.equal(sheets.searchCodons("").length, 64);
});

test("reference sheets: a Punnett square counts genotypes for one-gene crosses", () => {
  const cross = sheets.punnettSquare("Aa", "Aa");
  assert.deepEqual(cross.cells, ["AA", "Aa", "Aa", "aa"]);
  assert.deepEqual(cross.counts, { AA: 1, Aa: 2, aa: 1 });
  assert.equal(cross.ratio, "1:2:1");
  assert.equal(cross.dominant, 3);
  assert.equal(cross.recessive, 1);
  assert.deepEqual(sheets.punnettSquare("AA", "aa").cells, ["Aa", "Aa", "Aa", "Aa"]);
  assert.equal(sheets.punnettSquare("aa", "aa").ratio, "0:0:4");
  assert.equal(sheets.punnettSquare("nope", "AA").parentA, "Aa", "an unknown genotype falls back safely");
  assert.equal(sheets.normalizeGenotype("aa"), "aa");
});

test("reference view: the Sheets tab renders each sheet", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;

  const unit = makeDom();
  view.contentEl = unit.root;
  view.tab = "sheets";
  view.sheet = "unit-circle";
  view.render();
  assert.ok(unit.texts().includes("Unit circle"));
  assert.ok(unit.texts().includes("30"));
  assert.ok(unit.texts().includes("√3/2"));

  const identities = makeDom();
  view.contentEl = identities.root;
  view.sheet = "identities";
  view.render();
  assert.ok(identities.texts().includes("Trig identities"));
  assert.ok(identities.texts().includes("sin²θ + cos²θ = 1"));

  const codons = makeDom();
  view.contentEl = codons.root;
  view.sheet = "codons";
  view.codonQuery = "aug";
  view.render();
  assert.ok(codons.texts().includes("Codon table"));
  assert.ok(codons.texts().includes("AUG"));

  const punnett = makeDom();
  view.contentEl = punnett.root;
  view.sheet = "punnett";
  view.punnettA = "Aa";
  view.punnettB = "Aa";
  view.render();
  assert.ok(punnett.texts().includes("Punnett square"));
  assert.ok(punnett.texts().some((text) => text.includes("1:2:1")));
});
