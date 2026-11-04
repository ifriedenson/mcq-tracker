"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { Plugin: QT } = load();
const kanban = require("../src/canvas-kanban");

const board = (nodes, edges) => JSON.stringify({ nodes, edges });

const SPRINT = board(
  [
    { id: "frame-backlog", type: "group", label: "Backlog", x: 0, y: 0, width: 300, height: 600 },
    { id: "frame-doing", type: "group", label: "Doing", x: 400, y: 0, width: 300, height: 600 },
    { id: "b-low", type: "text", text: "Write the outline", x: 20, y: 300, width: 200, height: 80 },
    { id: "b-high", type: "text", text: "Collect sources", x: 20, y: 60, width: 200, height: 80 },
    { id: "d-one", type: "text", text: "Draft section 1", x: 420, y: 40, width: 200, height: 80 },
    { id: "loose", type: "text", text: "Loose idea", x: 1500, y: 500, width: 200, height: 80 },
  ],
  []
);

function rects(nodes) {
  return nodes.filter((node) => node.type !== "group").map((node) => ({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height }));
}

function overlaps(list) {
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      if (!apart) return a.id + " overlaps " + b.id;
    }
  }
  return "";
}

function fakeEl() {
  const node = {
    tag: "div",
    text: "",
    classes: new Set(),
    children: [],
    empty() {
      node.children = [];
    },
    addClass(name) {
      node.classes.add(name);
    },
    addEventListener() {},
    createEl(tag, opts) {
      return node.add(tag, opts);
    },
    createDiv(opts) {
      return node.add("div", opts);
    },
    add(tag, opts) {
      const child = fakeEl();
      child.tag = tag;
      child.text = (opts && opts.text) || "";
      node.children.push(child);
      return child;
    },
    allText() {
      return [node.text].concat(node.children.map((child) => child.allText())).filter(Boolean).join(" | ");
    },
  };
  return node;
}

test("group frames are the columns, in order, with cards assigned by geometry", () => {
  const parsed = require("../src/canvas-markdown").parseCanvas(SPRINT);
  const derived = kanban.deriveColumns(parsed.canvas);
  assert.equal(derived.ok, true);
  assert.equal(derived.mode, "frames");
  assert.deepEqual(derived.columns.map((column) => column.title), ["Backlog", "Doing"]);
  assert.deepEqual(derived.columns[0].cards.map((card) => card.id), ["b-high", "b-low"], "cards stack top to bottom");
  assert.deepEqual(derived.columns[1].cards.map((card) => card.id), ["d-one"]);
  assert.deepEqual(derived.unassigned.map((card) => card.id), ["loose"], "a card outside every frame is reported, not guessed");
  assert.deepEqual(derived.stats, { cards: 4, columns: 2, assigned: 3, unassigned: 1, groups: 2 });
});

test("a board without frames falls back to its vertical stacks", () => {
  const raw = board(
    [
      { id: "a1", type: "text", text: "One", x: 0, y: 0 },
      { id: "a2", type: "text", text: "Two", x: 30, y: 100 },
      { id: "a3", type: "text", text: "Three", x: 10, y: 200 },
      { id: "b1", type: "text", text: "Four", x: 500, y: 50 },
      { id: "b2", type: "text", text: "Five", x: 560, y: 10 },
      { id: "b3", type: "text", text: "Six", x: 500, y: 300 },
    ],
    []
  );
  const derived = kanban.deriveColumns(require("../src/canvas-markdown").parseCanvas(raw).canvas);
  assert.equal(derived.ok, true);
  assert.equal(derived.mode, "positions");
  assert.deepEqual(derived.columns.map((column) => column.title), ["Column 1", "Column 2"]);
  assert.deepEqual(derived.columns[0].cards.map((card) => card.id), ["a1", "a2", "a3"], "a near-left edge joins the stack");
  assert.deepEqual(derived.columns[1].cards.map((card) => card.id), ["b2", "b1", "b3"], "in-column order is vertical");
  assert.deepEqual(derived.unassigned, [], "every card belongs to a stack");
  assert.equal(kanban.COLUMN_SNAP, 80, "the stack tolerance is fixed");
});

test("loops, dangling edges and unknown fields cannot affect the columns", () => {
  const raw = JSON.stringify({
    nodes: [
      { id: "frame", type: "group", label: "Doing", x: 0, y: 0, width: 400, height: 400 },
      { id: "a", type: "text", text: "A", x: 20, y: 20, color: "2", custom: { keep: true } },
      { id: "b", type: "text", text: "B", x: 20, y: 200 },
    ],
    edges: [
      { id: "e1", fromNode: "a", toNode: "b" },
      { id: "e2", fromNode: "b", toNode: "a" },
      { id: "e3", fromNode: "a", toNode: "gone" },
      { id: "e4", fromNode: "a", toNode: "a" },
    ],
  });
  const derived = kanban.deriveColumns(require("../src/canvas-markdown").parseCanvas(raw).canvas);
  assert.equal(derived.ok, true);
  assert.deepEqual(derived.columns[0].cards.map((card) => card.id), ["a", "b"]);
  const stacked = kanban.restackColumns(raw);
  assert.equal(stacked.ok, true);
  const written = JSON.parse(stacked.text);
  assert.equal(written.edges.length, 4, "edges are untouched, including the dangling one");
  assert.deepEqual(written.nodes.find((node) => node.id === "a").custom, { keep: true }, "unknown fields survive");
  assert.equal(written.nodes.find((node) => node.id === "a").color, "2");
});

test("the re-stack aligns columns, keeps sizes, parks unassigned cards and is idempotent", () => {
  const stacked = kanban.restackColumns(SPRINT);
  assert.equal(stacked.ok, true);
  assert.equal(stacked.changed, true);
  const data = JSON.parse(stacked.text);
  const card = (id) => data.nodes.find((node) => node.id === id);
  const frame = (id) => data.nodes.find((node) => node.id === id);

  assert.equal(card("b-high").y, kanban.TOP, "columns share one top");
  assert.equal(card("d-one").y, kanban.TOP);
  assert.equal(card("b-high").x, card("b-low").x, "a column has one left edge");
  assert.equal(card("b-low").y, kanban.TOP + 80 + kanban.CARD_GAP, "cards keep their in-column order with fixed spacing");
  assert.equal(card("d-one").x, kanban.MIN_COLUMN_WIDTH + kanban.COLUMN_GAP, "columns sit a fixed gap apart");
  assert.deepEqual([card("b-high").width, card("b-high").height], [200, 80], "card sizes are preserved");
  const backdrop = frame("frame-backlog");
  assert.equal(backdrop.x, kanban.TOP + -kanban.PAD);
  assert.equal(backdrop.width, kanban.MIN_COLUMN_WIDTH + kanban.PAD * 2, "the frame is sized to its column");
  assert.ok(backdrop.y <= card("b-high").y - kanban.PAD + 1);
  const loose = card("loose");
  const frameRight = Math.max(frame("frame-backlog").x + frame("frame-backlog").width, frame("frame-doing").x + frame("frame-doing").width);
  assert.ok(loose.x >= frameRight + kanban.UNASSIGNED_GAP - kanban.PAD, "unassigned cards are parked clear of the frames");
  assert.equal(overlaps(rects(data.nodes)), "", "no two cards overlap");

  const again = kanban.restackColumns(stacked.text);
  assert.equal(again.changed, false, "an already stacked board is not rewritten");
  assert.equal(again.text, stacked.text);

  const reversed = JSON.parse(stacked.text);
  reversed.nodes = reversed.nodes.slice().reverse();
  const coordinates = (target) => target.nodes.map((node) => node.id + ":" + node.x + "," + node.y + "," + node.width + "," + node.height).sort().join("|");
  assert.equal(coordinates(JSON.parse(kanban.restackColumns(JSON.stringify(reversed)).text)), coordinates(data), "file order does not change the result");
});

test("a malformed, frame-only or oversized board is refused before any write", () => {
  assert.equal(kanban.restackColumns("").reason, "empty");
  assert.equal(kanban.restackColumns("not json").reason, "json");
  assert.equal(kanban.restackColumns('{"nodes":[]}').reason, "empty");
  assert.equal(kanban.restackColumns('{"nodes":[{"id":"a","type":"draw"}]}').reason, "node");
  assert.equal(kanban.restackColumns('{"nodes":[{"id":"g","type":"group"}]}').reason, "cards", "a frame-only board has nothing to stack");
  assert.equal(kanban.kanbanReport("nope").reason, "json");
  const many = JSON.stringify({ nodes: Array.from({ length: 2001 }, (unused, index) => ({ id: "n" + index, type: "text" })), edges: [] });
  assert.equal(kanban.restackColumns(many).reason, "size");
});

test("the commands report the columns and re-stack the open board once", async () => {
  const app = makeApp([{ path: "Boards/Sprint.canvas", text: SPRINT, noFm: true }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files.find((entry) => entry.path === "Boards/Sprint.canvas");
  file.extension = "canvas";
  app.workspace.getActiveFile = () => file;

  const ids = plugin.commands.map((command) => command.id);
  assert.ok(ids.includes("canvas-kanban-report"));
  assert.ok(ids.includes("canvas-kanban-restack"));

  const before = obsidian.modals.length;
  const report = await plugin.reportCanvasKanban();
  assert.equal(report.ok, true);
  assert.equal(report.columns[0].title, "Backlog");
  assert.equal(report.unassigned.length, 1);
  assert.match(report.summary, /2 columns, 4 cards/);
  assert.equal(obsidian.modals.length, before + 1, "the report opens a window");
  const modal = obsidian.modals[obsidian.modals.length - 1];
  assert.equal(modal.report.columns[1].title, "Doing");
  modal.contentEl = fakeEl();
  modal.onOpen();
  const drawn = modal.contentEl.allText();
  assert.match(drawn, /Backlog \(2\)/);
  assert.match(drawn, /Draft section 1/);
  assert.match(drawn, /Unassigned \(1\)/);
  assert.match(drawn, /Loose idea/);

  const first = await plugin.restackCanvasKanban();
  assert.equal(first.changed, true);
  assert.equal(app.modified.length, 1);
  assert.equal(app.modified[0].path, "Boards/Sprint.canvas");

  const second = await plugin.restackCanvasKanban();
  assert.equal(second.changed, false);
  assert.equal(app.modified.length, 1, "an already stacked board is not rewritten");

  app.workspace.getActiveFile = () => null;
  assert.equal((await plugin.restackCanvasKanban()).reason, "file");
  assert.equal((await plugin.reportCanvasKanban()).reason, "file");

  file.text = "not json";
  app.workspace.getActiveFile = () => file;
  assert.equal((await plugin.restackCanvasKanban()).reason, "json");
  assert.equal(app.modified.length, 1, "a damaged board is refused before the write");
});
