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

test("graph: each row parses as an expression, equation, definition or implicit relation", () => {
  assert.equal(graph.parseGraphRow("sin(x)").kind, "explicit");
  assert.equal(graph.parseGraphRow("y = 2x + 1").kind, "explicit");
  assert.equal(graph.parseGraphRow("f(x) = x^2").kind, "definition");
  assert.equal(graph.parseGraphRow("g(t) = f(t) + 1").params.length, 1);
  assert.equal(graph.parseGraphRow("x = y^2").kind, "implicit");
  assert.equal(graph.parseGraphRow("y^2 = 2x + 1").kind, "implicit");
  assert.equal(graph.parseGraphRow("y = x + y").kind, "implicit");
  assert.equal(graph.parseGraphRow("   ").kind, "empty");
  assert.throws(() => graph.parseGraphRow("y < x"), /Inequalities/);
  assert.throws(() => graph.parseGraphRow("sin(x) = 1"), /built-in/);
  assert.throws(() => graph.parseGraphRow("y = y = y"), /single "="/);
});

test("graph: multiple rows share f/g definitions and implicit curves are traced", () => {
  const built = graph.buildGraph({
    rows: ["f(x) = x^2", "g(x) = f(x) + 1", "y = g(x)", "y^2 = 2x + 1", "x^2 + y^2 = 9"],
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    samples: 201,
    resolution: { x: 120, y: 120 },
  });
  assert.equal(built.rows.length, 5);
  assert.equal(built.rows[0].kind, "definition");
  assert.equal(built.rows[1].kind, "definition");
  assert.deepEqual(built.definitions, ["f", "g"]);
  const explicit = built.rows[2];
  assert.equal(explicit.error, "");
  const nearest = explicit.points.reduce((best, point) => (Math.abs(point.x - 2) < Math.abs(best.x - 2) ? point : best));
  assert.ok(Math.abs(nearest.y - 5) < 0.2, "g(x) = x^2 + 1 comes from the earlier rows");
  const parabola = built.rows[3];
  assert.equal(parabola.kind, "implicit");
  assert.ok(parabola.segments.length > 20);
  assert.ok(parabola.segments.some((s) => s.x1 > 1 && s.y1 > 1), "upper branch");
  assert.ok(parabola.segments.some((s) => s.x1 > 1 && s.y1 < -1), "lower branch");
  const residuals = parabola.segments.map((s) => Math.abs(((s.y1 + s.y2) / 2) ** 2 - (2 * ((s.x1 + s.x2) / 2) + 1)));
  assert.ok(residuals.every((value) => value < 0.25));
  assert.ok(residuals.reduce((a, b) => a + b, 0) / residuals.length < 0.05);
  const circle = built.rows[4];
  assert.ok(circle.segments.length > 20);
  for (const segment of circle.segments.slice(0, 40)) {
    const mx = (segment.x1 + segment.x2) / 2;
    const my = (segment.y1 + segment.y2) / 2;
    assert.ok(Math.abs(mx * mx + my * my - 9) < 0.25);
  }
});

test("graph: one bad row reports its own error and the other rows still plot", () => {
  const built = graph.buildGraph({
    rows: ["y = x", "y = nope(x)", "y^2 = 2x + 1", ""],
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    samples: 41,
    resolution: { x: 60, y: 60 },
  });
  assert.equal(built.rows[0].error, "");
  assert.equal(built.rows[0].points.length, 41);
  assert.match(built.rows[1].error, /Unknown name/);
  assert.ok(built.rows[2].segments.length > 0);
  assert.equal(built.rows[3].kind, "empty");
  assert.equal(built.rows[3].error, "");
  assert.throws(() => graph.buildGraph({ rows: ["y = x"], xMin: 2, xMax: 2 }), /larger/);
  assert.throws(() => graph.buildGraph({ rows: ["y = x"], yMin: 2, yMax: 2 }), /larger/);
});

test("reference view: graph rows can be added, hidden, edited and removed", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.render();
  assert.equal(view.graphRows.length, 2);
  assert.equal(view.graphRows[0].text, "sin(x)");
  assert.equal(view.graphRows[1].text, "x^2 + y^2 = 9", "implicit rows are offered out of the box");
  assert.ok(view.graphCanvas);

  await dom.click("Add expression");
  assert.equal(view.graphRows.length, 3);

  view.graphRows[0].hidden = true;
  view.render();
  assert.ok(dom.texts().includes("○"), "the hidden row shows a hollow swatch");

  view.removeGraphRow(0);
  assert.equal(view.graphRows.length, 2);

  const badDom = makeDom();
  view.contentEl = badDom.root;
  view.graphRows = [{ text: "y = nope(x)", hidden: false }, { text: "y^2 = 2x + 1", hidden: false }];
  view.render();
  assert.ok(badDom.texts().some((text) => /Unknown name/.test(text)), "a bad row shows its error inline");
});

test("graph: a regression row parses like Desmos", () => {
  const parsed = graph.parseGraphRow("y ~ m x + b");
  assert.equal(parsed.kind, "regression");
  assert.equal(parsed.rhs, "m x + b");
  assert.equal(graph.parseGraphRow("y_1 ~ a x_1 + b").rhs, "a x + b");
  assert.throws(() => graph.parseGraphRow("x ~ a y + b"), /starts with y/);
  assert.throws(() => graph.parseGraphRow("y ~ a x + b = 2"), /either/);
  assert.throws(() => graph.parseGraphRow("y ~ m x ~ b"), /single "~"/);
  assert.throws(() => graph.parseGraphRow("y ~"), /Both sides/);
});

test("graph: a regression row fits its parameters to the data table", () => {
  const built = graph.buildGraph({
    rows: [{ text: "y ~ m x + b" }],
    data: [{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }, { x: 4, y: 9 }],
    xMin: -1,
    xMax: 5,
    yMin: -1,
    yMax: 11,
    samples: 51,
    resolution: { x: 40, y: 40 },
  });
  const row = built.rows[0];
  assert.equal(row.kind, "regression");
  assert.equal(row.error, "");
  assert.deepEqual(row.parameters.map((param) => param.name), ["m", "b"]);
  assert.ok(Math.abs(row.parameters[0].value - 2) < 1e-6, "fitted slope is 2");
  assert.ok(Math.abs(row.parameters[1].value - 1) < 1e-6, "fitted intercept is 1");
  assert.ok(Math.abs(row.r2 - 1) < 1e-9);
  assert.equal(built.data.length, 4);
  const near = row.points.reduce((best, point) => (Math.abs(point.x - 2) < Math.abs(best.x - 2) ? point : best));
  assert.ok(Math.abs(near.y - 5) < 0.05, "the fitted line is sampled in the window");
});

test("graph: regression handles curved models and reports unusable data", () => {
  const points = [0, 1, 2, 3].map((x) => ({ x, y: 2 * Math.exp(0.5 * x) }));
  const built = graph.buildGraph({ rows: [{ text: "y ~ a e^(b x)" }], data: points, samples: 21, resolution: { x: 20, y: 20 } });
  const [a, b] = built.rows[0].parameters.map((param) => param.value);
  assert.ok(Math.abs(a - 2) < 0.01);
  assert.ok(Math.abs(b - 0.5) < 0.01);
  assert.ok(built.rows[0].r2 > 0.999);

  assert.match(graph.buildGraph({ rows: ["y ~ m x + b"], data: [{ x: 1, y: 2 }] }).rows[0].error, /at least 2 data points/);
  assert.match(graph.buildGraph({ rows: ["y ~ m x"] }).rows[0].error, /data points/);
  assert.match(graph.buildGraph({ rows: ["y ~ y x"], data: [{ x: 1, y: 2 }] }).rows[0].error, /Use x on the right/);
  assert.match(graph.buildGraph({ rows: ["y ~ q(x)"], data: [{ x: 1, y: 2 }] }).rows[0].error, /Unknown function "q"/);
  const bad = graph.buildGraph({ rows: ["y = x"], data: [{ x: "abc", y: 2 }] });
  assert.match(bad.dataError, /two numbers/);
  assert.equal(bad.rows[0].error, "", "a bad data cell does not break the other rows");
});

test("reference view: the data table feeds a regression row", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.graphRows = [{ text: "y ~ m x + b", hidden: false }];
  view.graphData = [{ x: "1", y: "3" }, { x: "2", y: "5" }, { x: "3", y: "7" }];
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.render();
  const text = dom.texts().join(" | ");
  assert.ok(text.includes("Data table (x, y)"), "the table is rendered");
  assert.ok(/m = 2/.test(text), "the fitted slope is shown under the row");
  assert.ok(text.includes("R² = 1"));
  await dom.click("Add data point");
  assert.equal(view.graphData.length, 4);
});
