"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { Plugin: QT } = load();
const canvas = require("../src/canvas-markdown");

const BOARD = JSON.stringify({
  nodes: [
    { id: "root", type: "text", text: "Cell biology", x: 0, y: 0, width: 200, height: 80 },
    { id: "mito", type: "text", text: "Mitochondria\nPowerhouse", x: 300, y: 100, width: 200, height: 80 },
    { id: "nucleus", type: "text", text: "Nucleus", x: 300, y: -100, width: 200, height: 80 },
    { id: "note", type: "file", file: "Biology/ATP.md", x: 600, y: 100, width: 200, height: 80 },
  ],
  edges: [
    { id: "e1", fromNode: "root", toNode: "mito" },
    { id: "e2", fromNode: "root", toNode: "nucleus" },
    { id: "e3", fromNode: "mito", toNode: "note" },
  ],
});

test("a canvas is validated before anything is written", () => {
  assert.equal(canvas.parseCanvas("").reason, "empty");
  assert.equal(canvas.parseCanvas("not json").reason, "json");
  assert.equal(canvas.parseCanvas('{"nodes":[]}').reason, "empty");
  assert.equal(canvas.parseCanvas('{"nodes":[{"id":"a","type":"draw"}]}').reason, "node");
  assert.equal(canvas.parseCanvas('{"nodes":[{"id":"a","type":"text"},{"id":"a","type":"text"}]}').reason, "node");
  const ok = canvas.parseCanvas(BOARD);
  assert.equal(ok.ok, true);
  assert.equal(ok.canvas.nodes.length, 4);
  assert.equal(ok.canvas.edges.length, 3);
});

test("roots become headings in board order and branches become nested bullets", () => {
  const parsed = canvas.parseCanvas(BOARD);
  const outline = canvas.canvasToOutline(parsed.canvas);
  assert.equal(outline.ok, true);
  const lines = outline.markdown.trim().split("\n");
  assert.equal(lines[0], "# Cell biology");
  assert.equal(lines[1], "- Nucleus", "the card higher on the board comes first");
  assert.equal(lines[2], "- Mitochondria");
  assert.equal(lines[3], "  - Powerhouse", "extra card lines stay nested");
  assert.equal(lines[4], "  - ![[Biology/ATP.md]]");
  assert.deepEqual(outline.stats, { cards: 4, roots: 1, skipped: 0 });
});

test("a cycle is broken instead of looping, and every root gets its own page heading", () => {
  const parsed = canvas.parseCanvas(
    JSON.stringify({
      nodes: [
        { id: "a", type: "text", text: "A", x: 0, y: 0 },
        { id: "b", type: "text", text: "B", x: 0, y: 200 },
        { id: "c", type: "text", text: "C", x: 0, y: 400 },
      ],
      edges: [
        { fromNode: "a", toNode: "b" },
        { fromNode: "b", toNode: "c" },
        { fromNode: "c", toNode: "a" },
      ],
    })
  );
  const outline = canvas.canvasToOutline(parsed.canvas);
  assert.equal(outline.ok, true);
  assert.match(outline.markdown, /^# A/m);
  assert.equal(outline.stats.skipped, 1, "the loop back to the first card is cut");
  const rooted = canvas.parseCanvas(
    JSON.stringify({ nodes: [{ id: "x", type: "text", text: "One" }, { id: "y", type: "text", text: "Two" }], edges: [] })
  );
  assert.equal(canvas.canvasToOutline(rooted.canvas).markdown, "# One\n# Two\n");
});

test("an outline becomes cards and edges with a stable left-to-right layout", () => {
  const converted = canvas.outlineToCanvas("# Root\n- Child\n  - Grandchild\n- Sibling\n");
  assert.equal(converted.ok, true);
  const { nodes, edges } = converted.canvas;
  assert.equal(nodes.length, 4);
  assert.deepEqual(edges.map((edge) => [edge.fromNode, edge.toNode]), [
    ["card-1", "card-2"],
    ["card-2", "card-3"],
    ["card-1", "card-4"],
  ]);
  const grandchild = nodes.find((node) => node.text === "Grandchild");
  const child = nodes.find((node) => node.text === "Child");
  assert.ok(grandchild.x > child.x && child.x > 0, "depth moves right");
  assert.equal(grandchild.y, 0, "the first leaf sits at the top");
  assert.ok(nodes.find((node) => node.text === "Sibling").y > grandchild.y, "the next branch is placed below");

  const parsed = canvas.parseCanvas(canvas.serializeCanvas(converted.canvas));
  assert.equal(parsed.ok, true, "the written canvas is valid JSON Canvas");
  assert.equal(parsed.canvas.nodes.length, 4);
  assert.equal(canvas.outlineToCanvas("").reason, "empty");
  assert.equal(canvas.outlineToCanvas("just a paragraph").reason, "empty");
});

test("the commands convert the active canvas and note without overwriting", async () => {
  const app = makeApp([{ path: "Biology/Board.canvas", text: BOARD, noFm: true }]);
  const plugin = new QT(app);
  await plugin.onload();
  const board = app.files.find((file) => file.path === "Biology/Board.canvas");
  board.extension = "canvas";
  app.workspace.getActiveFile = () => board;

  const exported = await plugin.exportCanvasToMarkdown();
  assert.equal(exported.ok, true);
  assert.equal(exported.path, "Biology/Board outline.md");
  assert.match(app.created.at(-1).text, /^# Cell biology/m);

  const again = await plugin.exportCanvasToMarkdown();
  assert.equal(again.path, "Biology/Board outline 2.md", "a second export gets its own file");

  app.workspace.getActiveFile = () => app.created.find((entry) => entry.path === "Biology/Board outline.md");
  app.files.push(Object.assign({ path: "Biology/Board outline.md", extension: "md", text: app.created.at(-1).text }, {}));
  const note = app.files.find((file) => file.path === "Biology/Board outline.md");
  note.extension = "md";
  app.workspace.getActiveFile = () => note;
  const built = await plugin.boardFromActiveNote();
  assert.equal(built.ok, true);
  assert.equal(built.path, "Biology/Board outline.canvas");
  const written = canvas.parseCanvas(app.created.at(-1).text);
  assert.equal(written.ok, true);
  assert.ok(written.canvas.nodes.length >= 4);
  assert.equal(written.canvas.edges.length, written.canvas.nodes.length - 1);

  app.workspace.getActiveFile = () => null;
  assert.equal((await plugin.exportCanvasToMarkdown()).reason, "file");
  assert.equal((await plugin.boardFromActiveNote()).reason, "file");
});
