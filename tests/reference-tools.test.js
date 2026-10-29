"use strict";
// Reference graph parser and periodic table: pure checks plus the two new tabs.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const graph = T.referenceGraph;
const elements = T.referenceElements;

test("graph: arithmetic, precedence, powers and functions evaluate correctly", () => {
  assert.equal(graph.compileExpression("2 + 3 * 4")(0), 14);
  assert.equal(graph.compileExpression("(2 + 3) * 4")(0), 20);
  assert.equal(graph.compileExpression("x^2")(3), 9);
  assert.equal(graph.compileExpression("-x^2")(3), -9);
  assert.equal(graph.compileExpression("2x + 1")(4), 9, "implicit multiplication");
  assert.ok(Math.abs(graph.compileExpression("sin(pi / 2)")(0) - 1) < 1e-12);
  assert.equal(graph.compileExpression("sqrt(16)")(0), 4);
});

test("graph: unsupported names and injection attempts are rejected", () => {
  assert.throws(() => graph.compileExpression("process.exit()"), /Unknown name|Unsupported|Bad number/);
  assert.throws(() => graph.compileExpression("x; alert(1)"), /Unsupported character/);
  assert.throws(() => graph.compileExpression("x +"), /incomplete/);
  assert.throws(() => graph.compileExpression("(x"), /closing parenthesis/);
  assert.throws(() => graph.compileExpression("y"), /Unknown name/);
});

test("graph: a plot samples the visible range and handles gaps", () => {
  const plot = graph.buildPlot("x^2", { xMin: -2, xMax: 2, samples: 5 });
  assert.equal(plot.points.length, 5);
  assert.equal(plot.points[0].x, -2);
  assert.equal(plot.points[0].y, 4);
  assert.ok(plot.yMin < 0 && plot.yMax > 4);
  const reciprocal = graph.buildPlot("1 / x", { xMin: -1, xMax: 1, samples: 3 });
  assert.equal(reciprocal.points[1].y, null, "the undefined point is preserved as a gap");
  assert.throws(() => graph.buildPlot("sqrt(-1 - x^2)", { xMin: -1, xMax: 1 }), /no real values/);
  assert.throws(() => graph.buildPlot("x", { xMin: 2, xMax: 2 }), /larger/);
});

test("periodic table: all 118 elements, lookup and search", () => {
  assert.equal(elements.ELEMENTS.length, 118);
  assert.equal(elements.ELEMENTS[0].symbol, "H");
  assert.equal(elements.ELEMENTS[117].symbol, "Og");
  assert.equal(elements.elementBySymbol("fe").name, "Iron");
  assert.equal(elements.elementBySymbol("FE").z, 26);
  assert.equal(elements.searchElements("gold")[0].symbol, "Au");
  assert.equal(elements.searchElements("26")[0].symbol, "Fe");
  assert.equal(elements.searchElements("").length, 118);
  assert.equal(elements.categoryLabel("noble"), "Noble gas");
});

test("reference view: graph and periodic-table tabs render and select an element", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.contentEl = makeDom().root;
  view.tab = "graph";
  view.render();
  assert.ok(view.contentEl && true);
  view.tab = "elements";
  const dom = makeDom();
  view.contentEl = dom.root;
  view.selectedElement = elements.elementBySymbol("Fe");
  view.render();
  assert.ok(dom.texts().includes("Periodic table"));
  assert.ok(dom.texts().includes("Fe - Iron"));
  assert.ok(dom.texts().includes("H"));
  assert.ok(dom.texts().includes("Og"));

  const blank = makeDom();
  view.contentEl = blank.root;
  view.selectedElement = elements.elementBySymbol("Tc");
  view.render();
  assert.ok(blank.texts().some((text) => text.includes("mass not listed on the AP table")));
  assert.ok(blank.texts().some((text) => text.includes("AP Chemistry Periodic Table")));
});


// AP Chemistry 2020 table. "-" marks a cell where the table prints no mass.
const AP_MASSES = `1.008 4.00 6.94 9.01 10.81 12.01 14.01 16.00 19.00 20.18 22.99 24.30 26.98 28.09 30.97 32.06 35.45 39.95 39.10 40.08 44.96 47.87 50.94 52.00 54.94 55.85 58.93 58.69 63.55 65.38 69.72 72.63 74.92 78.97 79.90 83.80 85.47 87.62 88.91 91.22 92.91 95.95 - 101.07 102.91 106.42 107.87 112.41 114.82 118.71 121.76 127.60 126.90 131.29 132.91 137.33 138.91 140.12 140.91 144.24 - 150.36 151.97 157.25 158.93 162.50 164.93 167.26 168.93 173.05 174.97 178.49 180.95 183.84 186.21 190.23 192.22 195.08 196.97 200.59 204.38 207.2 208.98 - - - - - - 232.04 231.04 238.03 - - - - - - - - - - - - - - - - - - - - - - - - - -`.trim().split(/\s+/).map((value) => (value === "-" ? "" : value));

test("periodic table: every mass and blank matches the AP Chemistry 2020 table", () => {
  assert.equal(AP_MASSES.length, 118);
  assert.deepEqual(elements.ELEMENTS.map((el) => el.mass), AP_MASSES);
  assert.equal(elements.elementBySymbol("Eu").mass, "151.97");
  assert.equal(elements.elementBySymbol("Tc").mass, "");
  assert.equal(elements.elementBySymbol("Og").mass, "");
});
