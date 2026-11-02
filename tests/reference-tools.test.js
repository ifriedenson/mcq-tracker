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
  assert.equal(graph.parseGraphRow("y < x").kind, "inequality");
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

test("graph: parameter rows feed later rows and accept overrides", () => {
  const parsed = graph.parseGraphRow("a = 2");
  assert.equal(parsed.kind, "parameter");
  assert.equal(parsed.name, "a");
  assert.equal(parsed.value, 2);
  assert.equal(graph.parseGraphRow("k = -1.5").value, -1.5);
  assert.throws(() => graph.parseGraphRow("sin = 2"), /built-in/);
  assert.throws(() => graph.parseGraphRow("a = x + 1"), /must be a number/);
  assert.equal(graph.parseGraphRow("x = y^2").kind, "implicit");

  const built = graph.buildGraph({ rows: ["a = 2", "y = a x"], xMin: -1, xMax: 1, yMin: -2, yMax: 2, samples: 5 });
  assert.equal(built.rows[0].kind, "parameter");
  assert.equal(built.rows[0].value, 2);
  const mid = built.rows[1].points.find((point) => Math.abs(point.x - 0.5) < 1e-9);
  assert.ok(Math.abs(mid.y - 1) < 1e-9, "a = 2 doubles x");

  const moved = graph.buildGraph({
    rows: ["a = 2", "y = a x"],
    parameters: { a: 4 },
    xMin: 1,
    xMax: 1.5,
    yMin: 0,
    yMax: 8,
    samples: 3,
  });
  assert.ok(Math.abs(moved.rows[1].points[0].y - 4) < 1e-9, "the slider value overrides the typed value");
});

test("reference view: a parameter row renders a slider and repaints", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.graphRows = [{ text: "a = 2", hidden: false }, { text: "y = a x", hidden: false }];
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.render();
  assert.ok(view.graphSliderEls[0], "the slider controls are rendered");
  assert.ok(dom.texts().includes("Play"));
  assert.ok(dom.texts().includes("a = 2"));
  assert.equal(view.graphRows[0].min, "-10");
  assert.equal(view.graphRows[0].max, "10");
  assert.equal(view.graphRows[0].step, "0.1");

  view.graphRows[0].value = 3;
  view.drawGraph();
  assert.ok(dom.texts().includes("a = 3"), "the readout follows the slider value");
  view.onClose();
  assert.equal(view.graphAnimationTimer, null);
});

test("graph: inequality rows shade the correct region and draw the boundary", () => {
  const strict = graph.parseGraphRow("y < 2x + 1");
  assert.equal(strict.kind, "inequality");
  assert.equal(strict.strict, true);
  assert.equal(graph.parseGraphRow("y <= 2x + 1").strict, false);
  assert.equal(graph.parseGraphRow("x^2 + y^2 ≥ 9").op, "≥");
  assert.equal(graph.parseGraphRow("x^2 + y^2 ≤ 9").strict, false);
  assert.throws(() => graph.parseGraphRow("y <"), /Both sides/);

  const built = graph.buildGraph({
    rows: ["y < 2x + 1"],
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    samples: 41,
    resolution: { x: 80, y: 80 },
    regionResolution: { x: 40, y: 40 },
  });
  const row = built.rows[0];
  assert.equal(row.kind, "inequality");
  assert.equal(row.error, "");
  assert.ok(row.segments.length > 5, "the boundary is traced");
  const cellAt = (source, x, y) => {
    const region = source.rows[0].region;
    const i = Math.floor((x - region.x0) / region.dx);
    const j = Math.floor((y - region.y0) / region.dy);
    return region.cells[j * region.cols + i];
  };
  assert.equal(cellAt(built, 0, -4), 1, "below the line is shaded");
  assert.equal(cellAt(built, 0, 4), 0, "above the line is clear");

  const disk = graph.buildGraph({
    rows: ["x^2 + y^2 <= 9"],
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    samples: 21,
    resolution: { x: 60, y: 60 },
    regionResolution: { x: 60, y: 60 },
  });
  assert.equal(cellAt(disk, 0, 0), 1, "the centre is inside the disk");
  assert.equal(cellAt(disk, 4, 4), 0, "a corner is outside the disk");
  assert.equal(disk.rows[0].strict, false);
});

test("graph: restrictions parse and limit the plotted domain", () => {
  const parsed = graph.parseGraphRow("y = x^2 {0 < x < 3}");
  assert.equal(parsed.kind, "explicit");
  assert.equal(parsed.body, "x^2");
  assert.equal(parsed.condition, "0 < x < 3");
  assert.equal(graph.parseGraphRow("x^2 {x > 0}").condition, "x > 0");
  assert.equal(graph.parseGraphRow("y = x {x > 0} {x < 1}").condition, "x < 1 and x > 0");
  assert.equal(graph.parseGraphRow("y = {x<0: -x, x>=0: x}").condition, "", "a piecewise brace is not a restriction");

  const built = graph.buildGraph({
    rows: ["y = x^2 {0 < x < 3}"],
    xMin: -1,
    xMax: 4,
    yMin: -1,
    yMax: 10,
    samples: 51,
  });
  const row = built.rows[0];
  assert.equal(row.error, "");
  const inside = row.points.filter((point) => point.y !== null);
  assert.ok(inside.length > 0);
  assert.ok(inside.every((point) => point.x > 0 && point.x < 3), "only the restricted domain is drawn");
  const at = (x) => inside.reduce((best, point) => (Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best));
  assert.ok(Math.abs(at(1.5).y - 2.25) < 0.05);
  assert.equal(row.points.filter((point) => point.x < 0 && point.y !== null).length, 0);
  assert.equal(row.points.filter((point) => point.x > 3 && point.y !== null).length, 0);
});

test("graph: piecewise rows switch branches and meet at the boundary", () => {
  const built = graph.buildGraph({
    rows: ["y = {x < 0: -x, x >= 0: x}"],
    xMin: -2,
    xMax: 2,
    yMin: -1,
    yMax: 3,
    samples: 41,
  });
  const row = built.rows[0];
  assert.equal(row.error, "");
  const at = (x) => row.points.reduce((best, point) => (Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best));
  assert.ok(Math.abs(at(-1.5).y - 1.5) < 1e-9);
  assert.ok(Math.abs(at(1.5).y - 1.5) < 1e-9);
  assert.ok(Math.abs(at(0).y) < 1e-9, "the branches meet at the boundary");

  const stepped = graph.buildGraph({
    rows: ["y = {x < 0: x^2, x < 1: x, 2}"],
    xMin: -2,
    xMax: 3,
    yMin: -1,
    yMax: 3,
    samples: 51,
  });
  const steppedAt = (x) => stepped.rows[0].points.reduce((best, point) => (Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best));
  assert.ok(Math.abs(steppedAt(-1).y - 1) < 0.05);
  assert.ok(Math.abs(steppedAt(0.5).y - 0.5) < 0.05);
  assert.ok(Math.abs(steppedAt(2.5).y - 2) < 1e-9, "the final value is the default branch");
});

test("graph: restrictions compose with sliders, y-ranges and inequalities", () => {
  const slider = graph.buildGraph({
    rows: ["a = 2", "y = x^2 {x > a}"],
    xMin: -1,
    xMax: 4,
    yMin: -1,
    yMax: 16,
    samples: 51,
  });
  assert.equal(slider.rows[0].kind, "parameter");
  const live = slider.rows[1].points.filter((point) => point.y !== null);
  assert.ok(live.length > 0);
  assert.ok(live.every((point) => point.x > 2), "the slider value is the restriction boundary");
  const moved = graph.buildGraph({
    rows: ["a = 2", "y = x^2 {x > a}"],
    parameters: { a: 3 },
    xMin: -1,
    xMax: 4,
    yMin: -1,
    yMax: 16,
    samples: 51,
  });
  assert.ok(moved.rows[1].points.filter((point) => point.y !== null).every((point) => point.x > 3));

  const band = graph.buildGraph({ rows: ["y = x {0 < y < 1}"], xMin: -2, xMax: 2, yMin: -2, yMax: 2, samples: 81 });
  const banded = band.rows[0].points.filter((point) => point.y !== null);
  assert.ok(banded.length > 0);
  assert.ok(banded.every((point) => point.y > 0 && point.y < 1), "the y-range restriction is applied");

  const circle = graph.buildGraph({
    rows: ["x^2 + y^2 = 9 {x > 0}"],
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    samples: 21,
    resolution: { x: 80, y: 80 },
  });
  assert.ok(circle.rows[0].segments.length > 5);
  assert.ok(circle.rows[0].segments.every((segment) => segment.x1 >= -0.2 && segment.x2 >= -0.2), "only the right half is drawn");

  const shaded = graph.buildGraph({
    rows: ["x^2 + y^2 < 9 {y > 0}"],
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    samples: 21,
    resolution: { x: 60, y: 60 },
    regionResolution: { x: 60, y: 60 },
  });
  const region = shaded.rows[0].region;
  const cellAt = (x, y) => region.cells[Math.floor((y - region.y0) / region.dy) * region.cols + Math.floor((x - region.x0) / region.dx)];
  assert.equal(cellAt(0, 2), 1, "the upper half is shaded");
  assert.equal(cellAt(0, -2), 0, "the lower half is not");
  assert.equal(cellAt(4, 0), 0, "outside the disk is not shaded");
});

test("reference view: restriction and piecewise rows render without an error", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.graphRows = [
    { text: "y = x^2 {0 < x < 3}", hidden: false },
    { text: "y = {x < 0: -x, x >= 0: x}", hidden: false },
  ];
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.render();
  const text = dom.texts().join(" | ");
  assert.ok(!/not valid|Unknown name|Expected|incomplete/i.test(text), "neither row reports an error");
});

test("graph: polar rows parse with theta and the theta symbol", () => {
  const parsed = graph.parseGraphRow("r = 1 + cos(theta)");
  assert.equal(parsed.kind, "polar");
  assert.equal(parsed.body, "1 + cos(theta)");
  assert.equal(graph.parseGraphRow("r = 2 sin(3 theta)").kind, "polar");
  assert.equal(graph.parseGraphRow("r = 3").kind, "polar");
  assert.equal(graph.parseGraphRow("r = 1 + cos(θ)").body, "1 + cos(theta)", "θ is accepted as theta");
  assert.equal(graph.parseGraphRow("a = 2").kind, "parameter");
  assert.equal(graph.parseGraphRow("y = cos(theta)").kind, "explicit");
});

test("graph: polar curves sweep the full turn without gaps or chords", () => {
  const circle = graph.buildGraph({ rows: ["r = 3"], xMin: -5, xMax: 5, yMin: -5, yMax: 5, samples: 400 });
  const row = circle.rows[0];
  assert.equal(row.error, "");
  assert.ok(row.points.length >= 700, "the sweep is densely sampled");
  for (const point of row.points) {
    assert.ok(point.y !== null, "every sample is finite");
    assert.ok(Math.abs(Math.hypot(point.x, point.y) - 3) < 1e-9);
  }
  const first = row.points[0];
  const last = row.points[row.points.length - 1];
  assert.ok(Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9, "the sweep closes exactly at 2π");

  const cardioid = graph.buildGraph({ rows: ["r = 1 + cos(theta)"], xMin: -3, xMax: 3, yMin: -3, yMax: 3, samples: 200 });
  const points = cardioid.rows[0].points;
  assert.ok(Math.abs(points[0].x - 2) < 1e-9 && Math.abs(points[0].y) < 1e-9, "theta = 0 sits at r = 2");
  const nearest = points.reduce((best, point) => (Math.abs(point.theta - Math.PI) < Math.abs(best.theta - Math.PI) ? point : best), points[0]);
  assert.ok(Math.hypot(nearest.x, nearest.y) < 0.01, "the cusp closes at the origin");
  assert.ok(points.every((point) => point.y !== null), "a cardioid has no gaps");

  const negative = graph.buildGraph({ rows: ["r = 1 + 2 cos(theta)"], xMin: -4, xMax: 4, yMin: -4, yMax: 4, samples: 120 });
  assert.ok(negative.rows[0].points.every((point) => point.y !== null), "negative radii still plot");
});

test("graph: polar rows read sliders and restrictions", () => {
  const built = graph.buildGraph({
    rows: ["a = 2", "r = a + cos(theta) {theta < pi}"],
    xMin: -4,
    xMax: 4,
    yMin: -4,
    yMax: 4,
    samples: 120,
  });
  const polar = built.rows[1];
  assert.equal(polar.error, "");
  const drawn = polar.points.filter((point) => point.y !== null);
  assert.ok(drawn.length > 0);
  assert.ok(drawn.every((point) => point.theta < Math.PI + 1e-9), "the theta restriction limits the sweep");
  assert.ok(Math.abs(polar.points[0].x - 3) < 1e-9, "a = 2 puts the theta = 0 point at r = 3");

  const rRestriction = graph.buildGraph({ rows: ["r = 3 {r > 0}"], xMin: -5, xMax: 5, yMin: -5, yMax: 5, samples: 120 });
  assert.equal(rRestriction.rows[0].error, "");
  assert.ok(rRestriction.rows[0].points.every((point) => point.y !== null), "an r restriction keeps the curve");

  const moved = graph.buildGraph({
    rows: ["a = 2", "r = a + cos(theta)"],
    parameters: { a: 4 },
    xMin: -6,
    xMax: 6,
    yMin: -6,
    yMax: 6,
    samples: 120,
  });
  assert.ok(Math.abs(moved.rows[1].points[0].x - 5) < 1e-9, "the slider value moves the radius");
});

test("graph: unsupported polar input reports a clear error", () => {
  assert.match(graph.buildGraph({ rows: ["r = 1 + cos(x)"] }).rows[0].error, /Unknown name "x"/);
  assert.match(graph.buildGraph({ rows: ["r ="] }).rows[0].error, /Both sides/);
  assert.match(graph.buildGraph({ rows: ["r = 1 + cos(theta) {x > 0}"] }).rows[0].error, /Unknown name "x"/);
  assert.match(graph.buildGraph({ rows: ["f(x) = x {x > 0}"] }).rows[0].error, /restriction goes on an expression/);
});

test("reference view: polar rows and the polar grid render", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.graphRows = [{ text: "r = 1 + cos(theta)", hidden: false }];
  view.graphPolarGrid = true;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.render();
  const text = dom.texts().join(" | ");
  assert.ok(!/Unknown name|not valid|Expected|incomplete/i.test(text), "the polar row renders without an error");
  assert.ok(text.includes("polar grid"), "the polar grid control is present");
});

test("graph: parametric rows parse the pair, the parameter and fill", () => {
  const parsed = graph.parseGraphRow("(cos(t), sin(t))");
  assert.equal(parsed.kind, "parametric");
  assert.equal(parsed.xBody, "cos(t)");
  assert.equal(parsed.yBody, "sin(t)");
  assert.equal(parsed.fill, false);
  assert.equal(parsed.condition, "");
  const bounded = graph.parseGraphRow("(cos(t), sin(t)) {0 < t < 2pi}");
  assert.equal(bounded.kind, "parametric");
  assert.equal(bounded.condition, "0 < t < 2pi");
  const filled = graph.parseGraphRow("(cos(t), sin(t)) fill {0 < t < 2pi}");
  assert.equal(filled.kind, "parametric");
  assert.equal(filled.fill, true);
  assert.equal(filled.condition, "0 < t < 2pi");
  const theta = graph.parseGraphRow("(cos(θ), sin(θ))");
  assert.equal(theta.xBody, "cos(theta)", "θ is accepted as theta");
  assert.equal(graph.parseGraphRow("(sin(t))").kind, "explicit", "a single parenthesised expression stays explicit");
  assert.throws(() => graph.parseGraphRow("(cos(t), sin(t), 1)"), /exactly two/);
  assert.throws(() => graph.parseGraphRow("(cos(t),)"), /Both x and y/);
});

test("graph: parametric curves sweep smoothly over bounds and defaults", () => {
  const circle = graph.buildGraph({ rows: ["(cos(t), sin(t))"], xMin: -2, xMax: 2, yMin: -2, yMax: 2, samples: 200 });
  const row = circle.rows[0];
  assert.equal(row.error, "");
  assert.deepEqual(row.bounds, [0, Math.PI * 2]);
  assert.ok(row.points.length >= 380, "the sweep is densely sampled");
  for (const point of row.points) {
    assert.ok(point.y !== null, "a circle has no gaps");
    assert.ok(Math.abs(Math.hypot(point.x, point.y) - 1) < 1e-9);
  }
  assert.ok(Math.abs(row.points[0].x - 1) < 1e-9 && Math.abs(row.points[0].y) < 1e-9);
  const last = row.points[row.points.length - 1];
  assert.ok(Math.abs(last.x - 1) < 1e-9 && Math.abs(last.y) < 1e-9, "the sweep closes at 2π");
  let maxStep = 0;
  for (let i = 1; i < row.points.length; i++) {
    maxStep = Math.max(maxStep, Math.hypot(row.points[i].x - row.points[i - 1].x, row.points[i].y - row.points[i - 1].y));
  }
  assert.ok(maxStep < (Math.PI * 2) / 400 * 1.5, "consecutive samples stay adjacent");

  const bounded = graph.buildGraph({ rows: ["(t, t^2) {0 < t < 2}"], xMin: -1, xMax: 3, yMin: -1, yMax: 5, samples: 100 });
  const curve = bounded.rows[0];
  assert.equal(curve.error, "");
  assert.deepEqual(curve.bounds, [0, 2]);
  assert.ok(Math.abs(curve.points[0].x) < 1e-9 && Math.abs(curve.points[0].y) < 1e-9);
  const end = curve.points[curve.points.length - 1];
  assert.ok(Math.abs(end.x - 2) < 1e-9 && Math.abs(end.y - 4) < 1e-9, "the upper bound is reached exactly");
});

test("graph: parametric rows read sliders, definitions and restrictions", () => {
  const withSlider = graph.buildGraph({ rows: ["a = 2", "(a cos(t), a sin(t))"], xMin: -3, xMax: 3, yMin: -3, yMax: 3, samples: 100 });
  assert.ok(Math.abs(Math.hypot(withSlider.rows[1].points[0].x, withSlider.rows[1].points[0].y) - 2) < 1e-9, "the slider scales the curve");
  const moved = graph.buildGraph({ rows: ["a = 2", "(a cos(t), a sin(t))"], parameters: { a: 0.5 }, samples: 100 });
  assert.ok(Math.abs(Math.hypot(moved.rows[1].points[0].x, moved.rows[1].points[0].y) - 0.5) < 1e-9);

  const definition = graph.buildGraph({ rows: ["f(x) = x^2", "(t, f(t)) {0 < t < 2}"], samples: 100 });
  assert.equal(definition.rows[1].error, "");
  const end = definition.rows[1].points[definition.rows[1].points.length - 1];
  assert.ok(Math.abs(end.y - 4) < 1e-9, "a definition is callable in both coordinates");

  const filtered = graph.buildGraph({ rows: ["(cos(t), sin(t)) {t < pi}"], samples: 100 });
  const drawn = filtered.rows[0].points.filter((point) => point.y !== null);
  assert.ok(drawn.length > 0 && drawn.every((point) => point.t < Math.PI + 1e-9), "a one-sided condition filters the default sweep");

  const gap = graph.buildGraph({ rows: ["(sqrt(t - 3), t)"], xMin: -1, xMax: 3, yMin: 0, yMax: 7, samples: 100 });
  assert.equal(gap.rows[0].error, "");
  assert.ok(gap.rows[0].points.some((point) => point.y === null), "a non-real coordinate leaves a gap");
});

test("graph: parametric fill shades a closed curve and rejects the rest", () => {
  const filled = graph.buildGraph({ rows: ["(cos(t), sin(t)) fill"], samples: 100 });
  assert.equal(filled.rows[0].error, "");
  assert.ok(filled.rows[0].polygon.length >= 200, "the polygon follows the curve");
  assert.ok(filled.rows[0].polygon.every((point) => Math.abs(Math.hypot(point.x, point.y) - 1) < 1e-9));

  const open = graph.buildGraph({ rows: ["(t, t^2) fill {0 < t < 2}"], samples: 100 });
  assert.match(open.rows[0].error, /closed curve/);

  const gaps = graph.buildGraph({ rows: ["(sqrt(t - 3), t) fill"], xMin: -1, xMax: 3, yMin: 0, yMax: 7, samples: 100 });
  assert.match(gaps.rows[0].error, /continuous/);
});

test("graph: unsupported parametric input reports a clear error", () => {
  assert.match(graph.buildGraph({ rows: ["(cos(x), sin(x))"] }).rows[0].error, /Unknown name "x"/);
  assert.match(graph.buildGraph({ rows: ["(t, )"] }).rows[0].error, /Both x and y/);
  assert.match(graph.buildGraph({ rows: ["(t, t) {0 < t < q}"] }).rows[0].error, /parametric bound must be a number/i);
  assert.match(graph.buildGraph({ rows: ["(t, t) {2 < t < 1}"] }).rows[0].error, /larger than its start/);
  assert.match(graph.buildGraph({ rows: ["(sqrt(-1 - t), t)"] }).rows[0].error, /no values in this window/);
});

test("reference view: parametric and filled rows render", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.graphRows = [
    { text: "(cos(t), sin(t)) fill", hidden: false },
    { text: "(t, t^2) {0 < t < 2}", hidden: false },
  ];
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.render();
  const text = dom.texts().join(" | ");
  assert.ok(!/Unknown name|not valid|Expected|incomplete/i.test(text), "parametric rows render without an error");
  assert.ok(text.toLowerCase().includes("parametric"), "the note explains parametric rows");
});

test("graph: pairs are points unless they use the parameter", () => {
  const point = graph.parseGraphRow("(1, 2)");
  assert.equal(point.kind, "point");
  assert.equal(point.xBody, "1");
  assert.equal(point.yBody, "2");
  assert.equal(point.style, "closed");
  assert.equal(point.label, "");
  const sliderPoint = graph.parseGraphRow("(a, b)");
  assert.equal(sliderPoint.kind, "point", "a slider pair is a point");
  assert.equal(graph.parseGraphRow("(-3, 0.5)").kind, "point");
  assert.equal(graph.parseGraphRow("(cos(t), sin(t))").kind, "parametric", "t keeps a pair parametric");
  assert.equal(graph.parseGraphRow("(theta, 2)").kind, "parametric", "theta keeps a pair parametric");
  assert.equal(graph.parseGraphRow("(sin(t))").kind, "explicit");
  const list = graph.parseGraphRow("[(1, 2), (3, 4)]");
  assert.equal(list.kind, "points");
  assert.equal(list.pairs.length, 2);
  const open = graph.parseGraphRow("(1, 2) open");
  assert.equal(open.kind, "point");
  assert.equal(open.style, "open");
  const labelled = graph.parseGraphRow('(1, 2) "A" open');
  assert.equal(labelled.label, "A");
  assert.equal(labelled.style, "open");
  const filtered = graph.parseGraphRow("(1, 2) {x > 0}");
  assert.equal(filtered.kind, "point");
  assert.equal(filtered.condition, "x > 0");
});

test("graph: points build markers, not a polyline", () => {
  const built = graph.buildGraph({ rows: ["(1, 2)", '(0, 0) "origin" open', "[(1, 2), (3, 4)]"], samples: 100 });
  const single = built.rows[0];
  assert.equal(single.error, "");
  assert.equal(single.kind, "point");
  assert.equal(single.points, undefined, "a point is never sampled as a line");
  assert.deepEqual(single.markers, [{ x: 1, y: 2, label: "(1, 2)" }]);
  assert.equal(single.style, "closed");

  const labelled = built.rows[1];
  assert.equal(labelled.style, "open");
  assert.equal(labelled.markers[0].label, "origin");

  const list = built.rows[2];
  assert.equal(list.error, "");
  assert.equal(list.markers.length, 2);
  assert.deepEqual(list.markers.map((marker) => marker.label), ["(1, 2)", "(3, 4)"]);
  assert.equal(list.points, undefined);
});

test("graph: point markers follow the view transform and clamp labels on-canvas", () => {
  const view = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  const middle = graph.markerLayout([{ x: 0, y: 0, label: "(0, 0)" }], view, 400, 320);
  assert.deepEqual(middle[0], { x: 200, y: 160, label: "(0, 0)", labelX: 208, labelY: 152, align: "left" });

  const corner = graph.markerLayout([{ x: 10, y: 10, label: "(10, 10)" }], view, 400, 320);
  assert.equal(corner[0].x, 400);
  assert.equal(corner[0].y, 0);
  assert.equal(corner[0].align, "right", "a label at the right edge flips inward");
  assert.ok(corner[0].labelX <= 400);
  assert.equal(corner[0].labelY, 16, "a label at the top edge drops below the marker");
  for (const marker of middle.concat(corner)) {
    assert.ok(marker.labelX >= 0 && marker.labelX <= 400);
    assert.ok(marker.labelY >= 0 && marker.labelY <= 320);
  }

  const scaled = graph.markerLayout([{ x: 1, y: 2, label: "(1, 2)" }], { xMin: 0, xMax: 2, yMin: 0, yMax: 4 }, 200, 200);
  assert.equal(scaled[0].x, 100);
  assert.equal(scaled[0].y, 100);
});

test("graph: point rows read sliders, definitions and restrictions", () => {
  const withSliders = graph.buildGraph({ rows: ["a = 2", "b = 3", "(a, b)"], samples: 100 });
  assert.deepEqual(withSliders.rows[2].markers, [{ x: 2, y: 3, label: "(2, 3)" }]);
  const moved = graph.buildGraph({ rows: ["a = 2", "b = 3", "(a, b)"], parameters: { a: 5, b: 1 }, samples: 100 });
  assert.deepEqual(moved.rows[2].markers, [{ x: 5, y: 1, label: "(5, 1)" }], "a slider update moves the marker and its label");

  const definition = graph.buildGraph({ rows: ["f(x) = x + 1", "(2, f(2))"], samples: 100 });
  assert.equal(definition.rows[1].error, "");
  assert.equal(definition.rows[1].markers[0].y, 3);

  const kept = graph.buildGraph({ rows: ["[(1, 2), (-1, 2)] {x > 0}"], samples: 100 });
  assert.equal(kept.rows[0].markers.length, 1);
  assert.equal(kept.rows[0].error, "");

  const removed = graph.buildGraph({ rows: ["(-1, 2) {x > 0}"] });
  assert.equal(removed.rows[0].markers.length, 0);
  assert.match(removed.rows[0].error, /No point matches/);
});

test("graph: unsupported point input reports a clear error", () => {
  assert.match(graph.buildGraph({ rows: ["(x, 2)"] }).rows[0].error, /Unknown name "x"/);
  assert.match(graph.buildGraph({ rows: ["[]"] }).rows[0].error, /at least one point/);
  assert.match(graph.buildGraph({ rows: ["[(1, 2), 3]"] }).rows[0].error, /needs a pair/);
  assert.match(graph.buildGraph({ rows: ["(1, 2) fill"] }).rows[0].error, /Fill needs a curve/);
  assert.match(graph.buildGraph({ rows: ["[(1, 2)] fill"] }).rows[0].error, /not a point list/);
});

test("reference view: points, lists and open markers render", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.graphRows = [
    { text: "(1, 2)", hidden: false },
    { text: "[(0, 0), (2, 2)] open", hidden: false },
  ];
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.render();
  const text = dom.texts().join(" | ");
  assert.ok(!/Unknown name|not valid|Expected|incomplete/i.test(text), "point rows render without an error");
  assert.ok(/point marker/i.test(text), "the note explains point markers");
});

test("graph: the reciprocal and hyperbolic families evaluate", () => {
  const val = (text) => graph.compileExpression(text)(0);
  assert.equal(val("sec(0)"), 1);
  assert.ok(Math.abs(val("csc(pi / 2)") - 1) < 1e-12);
  assert.ok(Math.abs(val("cot(pi / 4)") - 1) < 1e-12);
  assert.ok(Number.isNaN(val("sec(pi / 2)")), "sec has a gap at its pole");
  assert.ok(Number.isNaN(val("csc(0)")));
  assert.ok(Number.isNaN(val("cot(0)")));
  assert.equal(val("sinh(0)"), 0);
  assert.equal(val("cosh(0)"), 1);
  assert.equal(val("tanh(0)"), 0);
  assert.ok(Math.abs(val("csch(1)") - 1 / Math.sinh(1)) < 1e-12);
  assert.equal(val("sech(0)"), 1);
  assert.ok(Math.abs(val("coth(2)") - 1 / Math.tanh(2)) < 1e-12);
  assert.ok(Math.abs(val("asinh(sinh(1))") - 1) < 1e-12);
  assert.ok(Math.abs(val("acosh(cosh(2))") - 2) < 1e-12);
  assert.ok(Math.abs(val("atanh(tanh(0.5))") - 0.5) < 1e-12);
  assert.ok(Math.abs(val("acsch(csch(1))") - 1) < 1e-12);
  assert.ok(Math.abs(val("asech(sech(0.5))") - 0.5) < 1e-12);
  assert.ok(Math.abs(val("acoth(coth(2))") - 2) < 1e-12);
  assert.ok(Number.isNaN(val("acosh(0.5)")), "acosh keeps its domain");
  assert.ok(Number.isNaN(val("atanh(1)")), "atanh keeps its domain");
});

test("graph: sign, round and tau evaluate", () => {
  const val = (text) => graph.compileExpression(text)(0);
  assert.equal(val("sign(-3)"), -1);
  assert.equal(val("sign(0)"), 0);
  assert.equal(val("sign(2.5)"), 1);
  assert.equal(val("round(2.5)"), 3, "halves round away from zero");
  assert.equal(val("round(-2.5)"), -3);
  assert.equal(val("round(2.4)"), 2);
  assert.ok(Math.abs(val("tau") - Math.PI * 2) < 1e-12);
  assert.ok(Math.abs(val("sin(tau)") - 0) < 1e-12);
});

test("graph: two-value functions evaluate and reject bad arguments", () => {
  const val = (text) => graph.compileExpression(text)(0);
  assert.equal(val("mod(7, 3)"), 1);
  assert.equal(val("mod(-1, 3)"), 2, "mod follows the divisor sign");
  assert.equal(val("mod(1.5, 1)"), 0.5);
  assert.ok(Number.isNaN(val("mod(1, 0)")));
  assert.ok(Math.abs(val("nthroot(8, 3)") - 2) < 1e-12);
  assert.ok(Math.abs(val("nthroot(-8, 3)") + 2) < 1e-12, "an odd root accepts a negative radicand");
  assert.ok(Number.isNaN(val("nthroot(-4, 2)")), "an even root of a negative is not real");
  assert.ok(Math.abs(val("nthroot(16, 4)") - 2) < 1e-12);
  assert.equal(val("gcd(12, 18)"), 6);
  assert.equal(val("gcd(-12, 18)"), 6);
  assert.equal(val("gcd(0, 0)"), 0);
  assert.equal(val("lcm(4, 6)"), 12);
  assert.equal(val("lcm(0, 5)"), 0);
  assert.equal(val("nCr(5, 2)"), 10);
  assert.equal(val("nPr(5, 2)"), 20);
  assert.equal(val("nCr(6, 0)"), 1);
  assert.ok(Number.isNaN(graph.compileExpression("gcd(x, 2)")(1.5)), "a non-whole argument yields no value");
  assert.ok(Number.isNaN(graph.compileExpression("nCr(x, 2)")(5.5)));
  assert.ok(Number.isNaN(graph.compileExpression("nPr(x, 2)")(-1)));
  assert.ok(Number.isNaN(graph.compileExpression("nthroot(x, 2)")(-4)));
});

test("graph: malformed function calls report inline instead of drawing", () => {
  assert.match(graph.buildGraph({ rows: ["y = gcd(1.5, 2)"] }).rows[0].error, /gcd needs whole numbers/);
  assert.match(graph.buildGraph({ rows: ["y = lcm(2, 3.5)"] }).rows[0].error, /lcm needs whole numbers/);
  assert.match(graph.buildGraph({ rows: ["y = nCr(5, 6)"] }).rows[0].error, /0 ≤ r ≤ n/);
  assert.match(graph.buildGraph({ rows: ["y = nPr(4, 5)"] }).rows[0].error, /0 ≤ r ≤ n/);
  assert.match(graph.buildGraph({ rows: ["y = nthroot(8, 2.5)"] }).rows[0].error, /whole root/);
  assert.match(graph.buildGraph({ rows: ["y = mod(1, 2, 3)"] }).rows[0].error, /mod takes 2 values/);
  assert.match(graph.buildGraph({ rows: ["y = sinh(1, 2)"] }).rows[0].error, /sinh takes one value/);
  assert.match(graph.buildGraph({ rows: ["tau = 2"] }).rows[0].error, /built-in name/);
  assert.match(graph.buildGraph({ rows: ["y = arcsinh(x)"] }).rows[0].error, /Unknown name "arcsinh"/);
});

test("graph: new functions compose with sliders, definitions, polar, parametric and points", () => {
  const built = graph.buildGraph({
    rows: ["a = 2", "g(x) = nthroot(x, 3)", "y = a sinh(x)", "y = g(x)", "r = sec(theta)", "(pi, tau)"],
    xMin: -2,
    xMax: 2,
    yMin: -10,
    yMax: 10,
    samples: 200,
  });
  const curve = built.rows[2];
  assert.equal(curve.error, "");
  const drawn = curve.points.filter((point) => point.y !== null);
  assert.ok(drawn.length > 100);
  const middle = drawn.find((point) => Math.abs(point.x) < 0.02);
  assert.ok(Math.abs(middle.y - 2 * Math.sinh(middle.x)) < 1e-9, "the slider drives the new function");

  const definition = built.rows[3];
  assert.equal(definition.error, "");
  const cube = definition.points.find((point) => Math.abs(point.x + 1.5) < 0.02);
  assert.ok(cube.y < 0 && Math.abs(cube.y - Math.cbrt(cube.x)) < 1e-6, "a nthroot definition draws across negative x");

  assert.equal(built.rows[4].error, "");
  assert.ok(built.rows[4].points.some((point) => point.y !== null), "sec draws in polar form");

  assert.equal(built.rows[5].kind, "point");
  assert.ok(Math.abs(built.rows[5].markers[0].x - Math.PI) < 1e-12);
  assert.ok(Math.abs(built.rows[5].markers[0].y - Math.PI * 2) < 1e-12, "tau is a point coordinate");
});

test("graph: a new function samples through the view transform without Infinity", () => {
  const built = graph.buildGraph({
    rows: ["y = 2 sinh(x)", "y = sec(x)"],
    xMin: -2,
    xMax: 2,
    yMin: -12,
    yMax: 12,
    samples: 400,
  });
  const curve = built.rows[0];
  assert.equal(curve.error, "");
  const first = curve.points[0];
  assert.ok(Math.abs(first.x + 2) < 1e-9);
  assert.ok(Math.abs(first.y - 2 * Math.sinh(-2)) < 1e-9);
  const px = (x) => ((x - built.xMin) / (built.xMax - built.xMin)) * 400;
  const py = (y) => 320 - ((y - built.yMin) / (built.yMax - built.yMin)) * 320;
  assert.ok(Math.abs(px(first.x) - 0) < 1e-9, "the first sample sits on the left edge");
  assert.ok(Math.abs(py(first.y) - (320 - ((2 * Math.sinh(-2) + 12) / 24) * 320)) < 1e-9);

  const sec = built.rows[1];
  assert.equal(sec.error, "");
  assert.ok(sec.points.every((point) => point.y === null || Number.isFinite(point.y)), "sec never yields Infinity");
  assert.ok(sec.points.filter((point) => point.y !== null).length > 300);
  assert.ok(Number.isNaN(graph.compileExpression("sec(pi / 2)")(0)), "the pole is a gap");
});


test("graph: roots, intercepts and extrema are refined, and restrictions hide excluded roots", () => {
  const built = graph.buildGraph({ rows: ["y = x^2 - 4"], xMin: -5, xMax: 5, yMin: -6, yMax: 22, samples: 41 });
  const row = built.rows[0];
  assert.equal(row.error, "");
  const roots = row.interest.filter((point) => point.kinds.includes("root"));
  assert.equal(roots.length, 2);
  assert.ok(Math.abs(roots[0].x + 2) < 1e-6, "the left root is refined by bisection");
  assert.ok(Math.abs(roots[1].x - 2) < 1e-6);
  assert.ok(roots.every((point) => Math.abs(point.y) < 1e-9));
  const intercept = row.interest.find((point) => point.kinds.includes("intercept"));
  assert.ok(intercept && Math.abs(intercept.y + 4) < 1e-9);
  assert.ok(intercept.kinds.includes("minimum"), "the vertex is both the intercept and the minimum");

  const positive = graph.buildGraph({ rows: ["y = x^2 + 1"], xMin: -2, xMax: 2, yMin: 0, yMax: 6, samples: 21 }).rows[0];
  const low = positive.interest.find((point) => point.kinds.includes("minimum"));
  assert.ok(low && Math.abs(low.x) < 1e-9 && Math.abs(low.y - 1) < 1e-9);

  const restricted = graph.buildGraph({ rows: ["y = x^2 - 4 {x > 0}"], xMin: -5, xMax: 5, yMin: -6, yMax: 22, samples: 41 }).rows[0];
  const live = restricted.interest.filter((point) => point.kinds.includes("root"));
  assert.equal(live.length, 1, "a restriction hides the root it excludes");
  assert.ok(Math.abs(live[0].x - 2) < 1e-6);
  assert.ok(built.interest.length >= row.interest.length, "the graph collects every row's points");
});

test("graph: crossings between two rows are found, and a tangency is not", () => {
  const built = graph.buildGraph({ rows: ["y = x^2", "y = 2x + 3"], xMin: -5, xMax: 5, yMin: -5, yMax: 25, samples: 81 });
  const crossings = built.interest.filter((point) => point.kinds.includes("intersection"));
  assert.equal(crossings.length, 2);
  assert.ok(Math.abs(crossings[0].x + 1) < 1e-6);
  assert.ok(Math.abs(crossings[1].x - 3) < 1e-6);
  assert.deepEqual(crossings[0].rows, [0, 1]);
  assert.ok(crossings.every((point) => Math.abs(point.x * point.x - (2 * point.x + 3)) < 1e-6));
  assert.equal(built.rows[1].interest.filter((point) => point.kinds.includes("intersection")).length, 2, "the later row carries the crossings");

  const apart = graph.buildGraph({ rows: ["y = x^2", "y = -1"], xMin: -2, xMax: 2, yMin: -3, yMax: 5, samples: 21 });
  assert.equal(apart.interest.filter((point) => point.kinds.includes("intersection")).length, 0, "a tangency with no sign change is not a crossing");
  const single = graph.buildGraph({ rows: ["y = x"], xMin: -2, xMax: 2, yMin: -2, yMax: 2, samples: 21 });
  assert.equal(single.interest.filter((point) => point.kinds.includes("intersection")).length, 0);
});

test("graph: the cursor trace interpolates a curve and reports a gap as nothing", () => {
  const built = graph.buildGraph({ rows: ["y = x^2", "y = 1 / x"], xMin: -2, xMax: 2, yMin: -5, yMax: 5, samples: 41 });
  const onSample = graph.traceAt(built, 1.5).find((trace) => trace.rowIndex === 0);
  assert.ok(onSample && Math.abs(onSample.y - 2.25) < 1e-9);
  const between = graph.traceAt(built, 1.55).find((trace) => trace.rowIndex === 0);
  assert.ok(between && Math.abs(between.y - 1.55 * 1.55) < 0.02, "between samples it interpolates");
  assert.equal(graph.traceAt(built, 0).some((trace) => trace.rowIndex === 1), false, "the pole is a gap");
  assert.deepEqual(graph.traceAt(built, 42), [], "an x outside the window reports nothing");
  const polar = graph.buildGraph({ rows: ["r = 3"], xMin: -5, xMax: 5, yMin: -5, yMax: 5, samples: 60 });
  assert.deepEqual(graph.traceAt(polar, 2), [], "only explicit and fitted rows trace by x");
});

test("reference view: points of interest and the cursor trace paint without errors", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.graphRows = [{ text: "y = x^2 - 4", hidden: false }, { text: "y = 2x", hidden: false }];
  view.render();
  assert.equal(view.graphInterest, true, "points of interest are on by default");
  assert.ok(view.graphTraceEl);
  view.drawGraph();
  assert.ok(view.graphBuilt.interest.length >= 3);
  assert.ok(view.graphBuilt.interest.some((point) => point.kinds.includes("intersection")));
  view.graphTrace = { x: 1, y: -3 };
  view.drawGraph();
  view.graphInterest = false;
  view.drawGraph();
  assert.equal(view.graphInterest, false);
});


test("graph: the viewport pans and zooms about the focus with bounded spans", () => {
  const start = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  const zoomed = graph.zoomView(start, 0.5, { x: 5, y: 5 });
  assert.equal(zoomed.xMax - zoomed.xMin, 10);
  assert.equal(zoomed.yMax - zoomed.yMin, 10);
  assert.ok(Math.abs(zoomed.xMin + 2.5) < 1e-9, "the focus keeps its place");
  assert.ok(Math.abs(zoomed.xMax - 7.5) < 1e-9);
  assert.ok(Math.abs((5 - zoomed.xMin) / 10 - 0.75) < 1e-9, "the focus is at the same fraction as before");
  const panned = graph.panView(start, 0.25, -0.25);
  assert.equal(panned.xMin, -5);
  assert.equal(panned.yMin, -15);
  const tiny = graph.zoomView(start, 1e-9, { x: 0, y: 0 });
  assert.ok(Math.abs(tiny.xMax - tiny.xMin - graph.VIEW_LIMITS.minSpan) < 1e-9, "zoom in is bounded");
  const huge = graph.zoomView(start, 1e9);
  assert.ok(Math.abs(huge.xMax - huge.xMin - graph.VIEW_LIMITS.maxSpan) < 1e-6, "zoom out is bounded");
  assert.equal(graph.clampView({ xMin: 2, xMax: 2 }).xMin, -10, "an unusable window falls back to the default");
  assert.equal(graph.clampView({ xMin: -1, xMax: 1, yMin: -4, yMax: 4 }).yMax, 4);
});

test("graph: points of interest, intersections and the trace stay correct in a panned and zoomed window", () => {
  const panned = graph.buildGraph({ rows: ["y = x^2 - 4", "y = 2x"], xMin: 1, xMax: 5, yMin: -2, yMax: 10, samples: 81 });
  const roots = panned.interest.filter((point) => point.kinds.includes("root"));
  assert.equal(roots.length, 1, "the root at -2 is outside the window");
  assert.ok(Math.abs(roots[0].x - 2) < 1e-6);
  const crossings = panned.interest.filter((point) => point.kinds.includes("intersection"));
  assert.equal(crossings.length, 1, "x = 1 - sqrt(5) is outside the window");
  assert.ok(Math.abs(crossings[0].x - (1 + Math.sqrt(5))) < 1e-6);
  const trace = graph.traceAt(panned, 3);
  assert.ok(Math.abs(trace.find((row) => row.rowIndex === 0).y - 5) < 1e-9);
  assert.ok(Math.abs(trace.find((row) => row.rowIndex === 1).y - 6) < 1e-9);

  const zoomed = graph.buildGraph({ rows: ["y = x^2 - 4"], xMin: 1.9, xMax: 2.1, yMin: -0.2, yMax: 0.2, samples: 61 });
  const tight = zoomed.interest.filter((point) => point.kinds.includes("root"));
  assert.equal(tight.length, 1);
  assert.ok(Math.abs(tight[0].x - 2) < 1e-9, "a zoomed window refines the same root");
  assert.ok(Math.abs(graph.traceAt(zoomed, 2)[0].y) < 1e-9);

  const fitted = graph.fitView(panned);
  assert.ok(fitted.xMin < 1 && fitted.xMax > 5, "auto-fit covers the drawn data");
  assert.ok(fitted.yMin < -1 && fitted.yMax > 9);
  assert.deepEqual(graph.fitView({ rows: [] }), { xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
});

test("reference view: pan, zoom, lock and reset control one persisted viewport", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.graphRows = [{ text: "y = x^2 - 4", hidden: false }];
  view.render();
  const start = Object.assign({}, view.graphViewport);
  view.zoomGraph(0.5);
  assert.ok(view.graphViewport.xMax - view.graphViewport.xMin < start.xMax - start.xMin, "zoom in narrows the window");
  const beforePan = Object.assign({}, view.graphViewport);
  view.onGraphKeydown({ key: "ArrowRight", preventDefault() {} });
  assert.ok(view.graphViewport.xMin > beforePan.xMin, "the arrow key pans");
  assert.ok(Math.abs(view.graphViewport.xMax - view.graphViewport.xMin - (beforePan.xMax - beforePan.xMin)) < 1e-9, "panning keeps the span");
  view.graphLocked = true;
  view.persistGraphView();
  const lockedSpan = view.graphViewport.xMax - view.graphViewport.xMin;
  view.zoomGraph(0.5);
  view.onGraphKeydown({ key: "ArrowLeft", preventDefault() {} });
  view.resetGraphView();
  assert.equal(view.graphViewport.xMax - view.graphViewport.xMin, lockedSpan, "a locked viewport ignores zoom, pan and reset");
  assert.equal(plugin.settings.reference.graph.locked, true);

  const restored = new T.ReferenceView({ app }, plugin);
  assert.equal(restored.graphLocked, true, "the lock survives a reload");
  assert.equal(restored.graphViewport.xMin, view.graphViewport.xMin);
  assert.equal(restored.graphViewport.xMax, view.graphViewport.xMax);

  view.graphLocked = false;
  view.resetGraphView();
  assert.ok(view.graphViewport.xMin <= -2 && view.graphViewport.xMax >= 2, "reset fits the expression");
  assert.equal(plugin.settings.reference.graph.locked, false);
});

test("reference view: the viewport controls are focusable labelled buttons on a keyboard canvas", async () => {
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
  const labelled = (name) => dom.all.find((element) => element.meta && element.meta.tag === "button" && (element.meta.attr || element.meta.attrs || {})["aria-label"] === name);
  for (const name of ["Zoom in", "Zoom out", "Reset view to fit the expressions", "Lock the viewport"]) {
    assert.ok(labelled(name), `a labelled button exists for ${name}`);
  }
  const canvas = dom.all.find((element) => element.meta && element.meta.tag === "canvas");
  assert.equal((canvas.meta.attr || canvas.meta.attrs || {}).tabindex, "0");
  assert.match((canvas.meta.attr || canvas.meta.attrs || {})["aria-label"], /arrow keys pan/i);
  await dom.click("Reset view");
  await dom.click("+");
  await dom.click("\u2212");
});


test("graph: tick steps stay readable and pi/degree labels cover zero, negatives and multiples past 2pi", () => {
  assert.equal(graph.formatAxisTick(0, { axis: "x", piTicks: true }), "0");
  assert.equal(graph.formatAxisTick(Math.PI / 2, { axis: "x", piTicks: true }), "\u03c0/2");
  assert.equal(graph.formatAxisTick(-Math.PI / 2, { axis: "x", piTicks: true }), "-\u03c0/2");
  assert.equal(graph.formatAxisTick(Math.PI, { axis: "x", piTicks: true }), "\u03c0");
  assert.equal(graph.formatAxisTick(-Math.PI, { axis: "x", piTicks: true }), "-\u03c0");
  assert.equal(graph.formatAxisTick(3 * Math.PI / 2, { axis: "x", piTicks: true }), "3\u03c0/2");
  assert.equal(graph.formatAxisTick(2 * Math.PI, { axis: "x", piTicks: true }), "2\u03c0");
  assert.equal(graph.formatAxisTick(3 * Math.PI, { axis: "x", piTicks: true }), "3\u03c0");
  assert.equal(graph.formatAxisTick(4 * Math.PI, { axis: "x", piTicks: true }), "4\u03c0");
  assert.equal(graph.formatAxisTick(0, { axis: "x", angleMode: "degrees" }), "0\u00b0");
  assert.equal(graph.formatAxisTick(Math.PI / 2, { axis: "x", angleMode: "degrees" }), "90\u00b0");
  assert.equal(graph.formatAxisTick(-Math.PI, { axis: "x", angleMode: "degrees" }), "-180\u00b0");
  assert.equal(graph.formatAxisTick(2 * Math.PI, { axis: "x", angleMode: "degrees" }), "360\u00b0");
  assert.equal(graph.formatAxisTick(Math.PI / 2, { axis: "y", piTicks: true }), "1.5708", "the y axis stays decimal");

  const pi = graph.axisTicks(-10, 10, 7, { axis: "x", piTicks: true });
  assert.ok(pi.ticks.length >= 5 && pi.ticks.length <= 15);
  assert.ok(pi.ticks.every((value) => Math.abs(value / (Math.PI / 2) - Math.round(value / (Math.PI / 2))) < 1e-6));
  assert.ok(Math.abs(pi.minorStep * 5 - pi.step) < 1e-12, "minor lines share the major scale");
  const narrow = graph.axisTicks(-0.01, 0.01, 7, { axis: "x", piTicks: true });
  assert.ok(narrow.ticks.length >= 2, "a narrow window falls back to decimal ticks");
  assert.ok(narrow.minors.length < 60, "a narrow window does not draw thousands of minor lines");
  for (const span of [graph.VIEW_LIMITS.minSpan, graph.VIEW_LIMITS.maxSpan]) {
    const plain = graph.axisTicks(-span / 2, span / 2, 7);
    assert.ok(plain.ticks.length >= 2 && plain.ticks.length <= 30);
    assert.ok(plain.minors.length < 200);
    const angled = graph.axisTicks(-span / 2, span / 2, 7, { axis: "x", piTicks: true });
    assert.ok(angled.minors.length < 200);
  }
  const degrees = graph.axisTicks(-10, 10, 7, { axis: "x", angleMode: "degrees" });
  assert.ok(degrees.ticks.length >= 3);
  assert.ok(degrees.ticks.every((value) => Math.abs((value * 180) / Math.PI - Math.round((value * 180) / Math.PI / 90) * 90) < 1e-6));
  assert.equal(graph.formatTickValue(2.5), "2.5");
});

test("reference view: display settings render labels without changing samples, points of interest or the trace", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.graphRows = [{ text: "y = x^2 - 4", hidden: false }, { text: "y = 2x", hidden: false }];
  view.render();
  const signature = (built) => JSON.stringify({
    rows: built.rows.map((row) => ({ kind: row.kind, points: row.points || null, interest: row.interest || null })),
    interest: built.interest,
    trace: graph.traceAt(built, 1.5),
  });
  view.graphDisplay = { minorGrid: false, axisLabels: false, piTicks: false, angle: "radians" };
  view.drawGraph();
  const plain = signature(view.graphBuilt);
  assert.ok(view.graphBuilt.interest.some((point) => point.kinds.includes("intersection")));
  for (const display of [
    { minorGrid: true, axisLabels: true, piTicks: true, angle: "radians" },
    { minorGrid: true, axisLabels: true, piTicks: true, angle: "degrees" },
    { minorGrid: true, axisLabels: false, piTicks: false, angle: "degrees" },
  ]) {
    view.graphDisplay = display;
    view.drawGraph();
    assert.equal(signature(view.graphBuilt), plain, "display options must not change geometry, points of interest or the trace");
  }
});

test("reference view: display controls are labelled, default off, and persist with the graph settings", async () => {
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
  assert.deepEqual(view.graphDisplay, { minorGrid: false, axisLabels: false, piTicks: false, angle: "radians" }, "existing blocks keep the old rendering");
  const labelled = (name) => dom.all.find((element) => element.meta && (element.meta.attr || {})["aria-label"] === name);
  for (const name of ["Minor gridlines", "Axis labels", "Pi ticks"]) {
    const box = labelled(name);
    assert.ok(box, `a labelled checkbox exists for ${name}`);
    assert.equal(box.meta.attr.type, "checkbox");
  }
  const angle = labelled("Angle mode");
  assert.ok(angle);
  assert.equal(angle.meta.tag, "select");
  view.graphDisplay = { minorGrid: true, axisLabels: true, piTicks: true, angle: "degrees" };
  view.persistGraphDisplay();
  assert.deepEqual(plugin.settings.reference.graph.display, view.graphDisplay, "the display options persist beside the viewport");
  assert.ok(plugin.settings.reference.graph.view, "persisting display keeps the stored window");
  const restored = new T.ReferenceView({ app }, plugin);
  assert.deepEqual(restored.graphDisplay, { minorGrid: true, axisLabels: true, piTicks: true, angle: "degrees" }, "the options restore on reload");
});


test("graph: row styles default to the pre-1.185 values and clamp to on-screen bounds", () => {
  assert.deepEqual(graph.resolveRowStyle(null), { width: 2, dashed: false, fillOpacity: 0.16, pointSize: 4.5 });
  assert.equal(graph.resolveRowStyle({ width: 0 }).width, 1);
  assert.equal(graph.resolveRowStyle({ width: 99 }).width, 8);
  assert.equal(graph.resolveRowStyle({ fillOpacity: -1 }).fillOpacity, 0);
  assert.equal(graph.resolveRowStyle({ fillOpacity: 2 }).fillOpacity, 1);
  assert.equal(graph.resolveRowStyle({ pointSize: 0 }).pointSize, 2);
  assert.equal(graph.resolveRowStyle({ pointSize: 99 }).pointSize, 12);
  assert.equal(graph.resolveRowStyle({ dashed: true }).dashed, true);
  assert.deepEqual(graph.DASH_PATTERN, [6, 4]);
  const unstyled = graph.buildGraph({ rows: ["y = x^2 - 4"], xMin: -5, xMax: 5, yMin: -6, yMax: 22, samples: 41 });
  assert.deepEqual(unstyled.rows[0].styling, { width: 2, dashed: false, fillOpacity: 0.16, pointSize: 4.5 });
  const explicit = graph.buildGraph({ rows: [{ text: "y = x^2 - 4", styling: {} }], xMin: -5, xMax: 5, yMin: -6, yMax: 22, samples: 41 });
  const strip = (built) => JSON.stringify({ rows: built.rows.map((row) => ({ points: row.points, interest: row.interest })), interest: built.interest });
  assert.equal(strip(explicit), strip(unstyled), "an unstyled block renders exactly as before");
});

test("reference view: style controls appear only where they apply and are labelled", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.graphRows = [
    { text: "y = x^2 - 4", hidden: false },
    { text: "(1, 2)", hidden: false },
    { text: "(cos(t), sin(t)) fill", hidden: false },
    { text: "f(x) = x^2", hidden: false },
  ];
  view.render();
  const labels = () => dom.all.map((element) => (element.meta && (element.meta.attr || {})["aria-label"]) || "").filter(Boolean);
  const has = (text) => labels().some((label) => label === text);
  assert.ok(has("Line width for expression 1"));
  assert.ok(has("Dashed line for expression 1"));
  assert.equal(has("Point size for expression 1"), false, "a curve has no point size control");
  assert.ok(has("Point size for expression 2"), "a point row gets a point size");
  assert.equal(has("Line width for expression 2"), false, "a point row has no width control");
  assert.ok(has("Fill opacity for expression 3"), "only a filled row gets fill opacity");
  assert.equal(has("Line width for expression 4"), false, "a definition has nothing to stroke");
  const width = dom.all.find((element) => element.meta && (element.meta.attr || {})["aria-label"] === "Line width for expression 1");
  assert.equal(width.meta.attr.type, "number");
  assert.equal(String(width.meta.attr.min), "1");
  assert.equal(String(width.meta.attr.max), "8");
});

test("reference view: styles persist per row, restore on reload, and never change the geometry", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "graph";
  view.graphRows = [
    { text: "y = x^2 - 4", hidden: false },
    { text: "y = 2x", hidden: false },
    { text: "(1, 2)", hidden: false },
    { text: "(cos(t), sin(t)) fill", hidden: false },
  ];
  view.render();
  const signature = (built) => JSON.stringify({
    rows: built.rows.map((row) => ({ points: row.points || null, markers: row.markers || null, polygon: row.polygon || null, interest: row.interest || null })),
    interest: built.interest,
    trace: graph.traceAt(built, 1.5),
  });
  view.drawGraph();
  const plain = signature(view.graphBuilt);
  view.graphRows[0].styling = { width: 8, dashed: true, fillOpacity: 1, pointSize: 12 };
  view.graphRows[1].styling = { width: 1, dashed: true, fillOpacity: 0, pointSize: 2 };
  view.graphRows[2].styling = { width: 8, dashed: false, fillOpacity: 0, pointSize: 12 };
  view.graphRows[3].styling = { width: 1, dashed: true, fillOpacity: 0, pointSize: 2 };
  view.persistGraphState();
  view.drawGraph();
  assert.equal(signature(view.graphBuilt), plain, "styles are rendering only");
  assert.ok(view.graphBuilt.interest.some((point) => point.kinds.includes("intersection")));
  view.graphViewport = { xMin: -10000, xMax: 10000, yMin: -10000, yMax: 10000 };
  view.drawGraph();
  view.graphViewport = { xMin: -0.01, xMax: 0.01, yMin: -0.01, yMax: 0.01 };
  view.drawGraph();
  assert.equal(view.graphBuilt.rows[0].styling.width, 8, "styles survive both zoom extremes");

  const stored = plugin.settings.reference.graph.rows;
  assert.equal(stored.length, 4);
  assert.deepEqual(stored[0].styling, { width: 8, dashed: true, fillOpacity: 1, pointSize: 12 });
  const restored = new T.ReferenceView({ app }, plugin);
  assert.equal(restored.graphRows.length, 4);
  assert.equal(restored.graphRows[0].text, "y = x^2 - 4");
  assert.deepEqual(restored.graphRows[0].styling, { width: 8, dashed: true, fillOpacity: 1, pointSize: 12 });
  assert.deepEqual(restored.graphRows[2].styling, { width: 8, dashed: false, fillOpacity: 0, pointSize: 12 });
  assert.deepEqual(restored.graphRows[3].styling, { width: 1, dashed: true, fillOpacity: 0, pointSize: 2 });
});
