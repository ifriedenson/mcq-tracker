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
});
