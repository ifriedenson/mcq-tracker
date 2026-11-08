"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T } = load();
const blocks = T.studyBlocks;

test("the study-block group exposes the four clean-room block surfaces", () => {
  assert.ok(blocks);
  for (const name of ["renderDesmosBlock", "renderMindmapBlock", "renderGrillBlock", "renderDeadlinesBlock"]) {
    assert.equal(typeof blocks[name], "function", `${name} is exported`);
  }
});

test("parseDesmosBlock reads view settings, separators and row controls", () => {
  const block = blocks.parseDesmosBlock(
    "left=-2\nright=2\nbottom=-3\ntop=3\nwidth=500\nheight=280\ngrid=false\n---\ny=\\sin(x)|color:#ff0000|style:dashed|width:3"
  );
  assert.deepEqual(block.settings, { xMin: -2, xMax: 2, yMin: -3, yMax: 3, width: 500, height: 280, grid: false });
  assert.equal(block.rows.length, 1);
  assert.equal(block.rows[0].text, "y=sin(x)");
  assert.equal(block.rows[0].options.color, "#ff0000");
  assert.equal(block.rows[0].options.dashed, true);
  assert.equal(block.rows[0].options.width, 3);
});

test("normalizeDesmosExpression handles common LaTeX without evaluating anything", () => {
  assert.equal(blocks.normalizeDesmosExpression("y=\\frac{1}{2}x"), "y=((1)/(2))x");
  assert.equal(blocks.normalizeDesmosExpression("r=\\sin(\\theta)"), "r=sin(theta)");
  assert.equal(blocks.normalizeDesmosExpression("y=\\sqrt{x}"), "y=sqrt(x)");
});

test("buildDesmosGraph samples the expression with the local graph engine", () => {
  const block = blocks.parseDesmosBlock("left=-2\nright=2\n---\ny=sin(x)");
  const graph = blocks.buildDesmosGraph(block);
  assert.equal(graph.rows.length, 1);
  assert.ok(graph.rows[0].points.some((point) => point.y !== null));
  assert.equal(graph.xMin, -2);
  assert.equal(graph.xMax, 2);
});

test("renderDesmosBlock draws an SVG, a legend and the block's expressions", () => {
  const dom = makeDom();
  const result = blocks.renderDesmosBlock("left=-2\nright=2\n---\ny=sin(x)|color:#2b8a3e", dom.root);
  assert.equal(result.ok, true);
  assert.ok(dom.texts().includes("y=sin(x)"));
  assert.ok(dom.texts().some((text) => /Drawn locally/.test(text)));
  assert.ok(dom.all.some((node) => node.meta && node.meta.tag === "svg"));
  assert.ok(dom.all.some((node) => node.meta && node.meta.tag === "path"));
});

test("renderDesmosBlock reports a bad expression instead of drawing a guess", () => {
  const dom = makeDom();
  const result = blocks.renderDesmosBlock("y=", dom.root);
  assert.equal(result.ok, false);
  assert.ok(dom.texts().some((text) => /expression|valid|Error/.test(text)));
});

test("parseMindmapBlock and mindmapTree build a visual tree from Markdown", () => {
  const block = blocks.parseMindmapBlock("title: Biology\nlayout: down\n---\n# Cells\n- Nucleus\n  - DNA\n- Membrane");
  assert.equal(block.settings.title, "Biology");
  assert.equal(block.settings.layout, "down");
  const root = blocks.mindmapTree(block.body, { title: block.settings.title });
  assert.equal(root.text, "Cells");
  assert.deepEqual(root.children.map((node) => node.text), ["Nucleus", "Membrane"]);
  assert.equal(root.children[0].children[0].text, "DNA");
});

test("renderMindmapBlock draws collapsible branches", async () => {
  const dom = makeDom();
  const result = await blocks.renderMindmapBlock(null, "# Root\n- Alpha\n  - Beta", dom.root, {});
  assert.equal(result.ok, true);
  assert.ok(dom.texts().includes("Root"));
  assert.ok(dom.texts().includes("Beta"));
  assert.ok(dom.all.some((node) => node.meta && node.meta.tag === "ul"));
  await dom.click("−");
  assert.ok(dom.all.some((node) => node.classes && node.classes.has("is-collapsed")));
});

test("renderMindmapBlock reads a Source note and reports a missing one", async () => {
  const app = makeApp([{ path: "Maps/Biology.md", text: "# Biology\n- Cells\n- Genes" }]);
  const plugin = { app };
  const dom = makeDom();
  const result = await blocks.renderMindmapBlock(plugin, "Source: Maps/Biology.md", dom.root, {});
  assert.equal(result.ok, true);
  assert.ok(dom.texts().includes("Cells"));
  const missing = await blocks.renderMindmapBlock(plugin, "Source: Maps/Missing.md", makeDom().root, {});
  assert.equal(missing.ok, false);
});

test("grillQuestions uses headings and definitions, without inventing an answer", () => {
  const text = "# Photosynthesis\n\nPlants turn light energy into chemical energy.\n\n- Chlorophyll: the green pigment that captures light.\n- Stomata: pores that let carbon dioxide enter.";
  const questions = blocks.grillQuestions(text, { count: 6 });
  assert.ok(questions.length >= 2);
  assert.ok(questions.some((row) => row.question === "Define “Chlorophyll”."));
  assert.ok(questions.some((row) => row.question.includes("Photosynthesis")));
  for (const row of questions) assert.ok(row.answer.length > 0);
});

test("renderGrillBlock runs a self-graded session from a note block", async () => {
  const dom = makeDom();
  const result = await blocks.renderGrillBlock(
    null,
    "count: 1\n---\n# Osmosis\nWater moves across a membrane toward higher solute concentration.",
    dom.root,
    {}
  );
  assert.equal(result.ok, true);
  assert.ok(dom.texts().some((text) => /Question 1 of 1/.test(text)));
  await dom.click("Show answer");
  assert.ok(dom.texts().some((text) => /higher solute/.test(text)));
  await dom.click("I knew it");
  assert.ok(dom.texts().includes("Next question"));
  await dom.click("Next question");
  assert.ok(dom.texts().some((text) => /Session complete/.test(text)));
});

test("deadlineRows filters upcoming assignments by course and window", () => {
  const assignments = [
    { id: "a1", title: "Lab report", course: "Biology", courseName: "Biology", due: "2026-11-10", open: true },
    { id: "a2", title: "Problem set", course: "Math", courseName: "Math", due: "2026-11-20", open: true },
    { id: "a3", title: "Old quiz", course: "Biology", courseName: "Biology", due: "2026-11-01", open: true },
  ];
  const rows = blocks.deadlineRows(assignments, { days: 14, course: "Biology", limit: 10 }, "2026-11-08");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.title).sort(), ["Lab report", "Old quiz"]);
  assert.ok(rows.every((row) => row.course === "Biology"));
  assert.equal(rows.find((row) => row.title === "Old quiz").state, "overdue");
});

test("renderDeadlinesBlock lists rows and handles an empty vault", () => {
  const app = makeApp([]);
  const plugin = {
    app,
    getAssignments: () => [{ id: "a1", title: "Essay", course: "English", due: "2026-11-10", open: true, file: null }],
  };
  const dom = makeDom();
  const result = blocks.renderDeadlinesBlock(plugin, "days: 14", dom.root, "2026-11-08");
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 1);
  assert.ok(dom.texts().includes("Essay"));
  const empty = makeDom();
  blocks.renderDeadlinesBlock({ app, getAssignments: () => [] }, "", empty.root, "2026-11-08");
  assert.ok(empty.texts().some((text) => /No open assignments/.test(text)));
});
