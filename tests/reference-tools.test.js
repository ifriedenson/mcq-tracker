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
