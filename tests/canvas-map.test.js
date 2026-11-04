"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { Plugin: QT } = load();
const map = require("../src/canvas-map");
const canvasMarkdown = require("../src/canvas-markdown");

const board = (nodes, edges) => JSON.stringify({ nodes, edges });

const TREE = board(
  [
    { id: "root", type: "text", text: "Cell biology", x: 400, y: 300, width: 200, height: 80 },
    { id: "mito", type: "text", text: "Mitochondria", x: 700, y: 200, width: 200, height: 80 },
    { id: "nucleus", type: "text", text: "Nucleus", x: 700, y: 400, width: 200, height: 80 },
    { id: "atp", type: "text", text: "ATP", x: 1000, y: 200, width: 200, height: 80 },
    { id: "loose", type: "text", text: "Loose card", x: 0, y: 900, width: 200, height: 80 },
  ],
  [
    { id: "e1", fromNode: "root", toNode: "mito" },
    { id: "e2", fromNode: "root", toNode: "nucleus" },
    { id: "e3", fromNode: "mito", toNode: "atp" },
  ]
);

function overlaps(rects) {
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      if (!apart) return `${a.id} overlaps ${b.id}`;
    }
  }
  return "";
}

test("a board resolves to one tree with roots, children and siblings in board order", () => {
  const parsed = canvasMarkdown.parseCanvas(TREE);
  const resolved = map.resolveTree(parsed.canvas);
  assert.equal(resolved.ok, true);
  const tree = resolved.tree;
  assert.equal(tree.root.id, "root", "the one card with no parent is the root");
  assert.deepEqual(tree.roots.map((node) => node.id), ["root", "loose"]);
  assert.deepEqual((tree.childrenOf.get("root") || []).map((node) => node.id), ["mito", "nucleus"], "the card higher on the board comes first");
  assert.deepEqual(tree.order.map((node) => node.id), ["root", "mito", "atp", "nucleus"]);
  assert.deepEqual(tree.orphans.map((node) => node.id), ["loose"], "a card the tree cannot reach is kept aside");
  assert.equal(tree.parentOf.get("atp"), "mito");
  assert.deepEqual(resolved.stats, { cards: 5, groups: 0, roots: 2, reachable: 4, orphans: 1, cut: 0 });
});

test("a loop is cut instead of followed, and a loop-only board still resolves", () => {
  const loop = board(
    [
      { id: "a", type: "text", text: "A", x: 0, y: 0 },
      { id: "b", type: "text", text: "B", x: 300, y: 100 },
      { id: "c", type: "text", text: "C", x: 600, y: 200 },
    ],
    [
      { fromNode: "a", toNode: "b" },
      { fromNode: "b", toNode: "c" },
      { fromNode: "c", toNode: "a" },
    ]
  );
  const resolved = map.resolveTree(canvasMarkdown.parseCanvas(loop).canvas);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.tree.root.id, "a", "with no root card, the top-most card is the root");
  assert.deepEqual(resolved.tree.order.map((node) => node.id), ["a", "b", "c"]);
  assert.deepEqual(resolved.tree.orphans, []);
  assert.equal(resolved.stats.cut, 1, "the edge back to the first card is cut");

  const extra = board(
    [
      { id: "a", type: "text", text: "A", x: 0, y: 0 },
      { id: "b", type: "text", text: "B", x: 300, y: 0 },
    ],
    [
      { fromNode: "a", toNode: "b" },
      { fromNode: "b", toNode: "a" },
      { fromNode: "a", toNode: "a" },
    ]
  );
  const second = map.resolveTree(canvasMarkdown.parseCanvas(extra).canvas);
  assert.deepEqual(second.tree.order.map((node) => node.id), ["a", "b"]);
  assert.equal(second.stats.cut, 2, "the loop and the card linked to itself are both cut");
  assert.equal(map.resolveTree({ nodes: [] }).reason, "empty");
});

test("mind-map walking moves along the tree and refuses at its edges", () => {
  const tree = map.resolveTree(canvasMarkdown.parseCanvas(TREE).canvas).tree;
  assert.equal(map.neighbour(tree, "root", "parent").reason, "edge");
  assert.match(map.neighbour(tree, "root", "parent").message, /root of this board/);
  assert.equal(map.neighbour(tree, "root", "child").id, "mito");
  assert.equal(map.neighbour(tree, "mito", "next").id, "nucleus");
  const last = map.neighbour(tree, "nucleus", "next");
  assert.equal(last.reason, "edge");
  assert.match(last.message, /last card in its branch/);
  assert.equal(map.neighbour(tree, "nucleus", "prev").id, "mito");
  const first = map.neighbour(tree, "mito", "prev");
  assert.equal(first.reason, "edge");
  assert.match(first.message, /first card in its branch/);
  assert.equal(map.neighbour(tree, "atp", "child").reason, "edge", "a leaf has no child");
  assert.equal(map.neighbour(tree, "root", "next").id, "loose", "root cards are siblings of each other");
  assert.equal(map.neighbour(tree, "missing", "child").reason, "card");
  assert.equal(map.neighbour(tree, "root", "sideways").reason, "direction");
});

test("the layout is idempotent, keeps card sizes and non-card content, and never overlaps", () => {
  const raw = JSON.stringify({
    nodes: [
      { id: "root", type: "text", text: "Root", x: 900, y: 700, width: 240, height: 90, color: "1" },
      { id: "a", type: "text", text: "A", x: 10, y: 20, width: 180, height: 60 },
      { id: "b", type: "text", text: "B", x: 30, y: 900, width: 300, height: 120 },
      { id: "note", type: "file", file: "Biology/ATP.md", x: 80, y: 40, width: 280, height: 90 },
      { id: "group", type: "group", label: "Unit 1", x: -100, y: -100, width: 500, height: 400 },
      { id: "loose", type: "text", text: "Loose", x: 0, y: 2000, width: 200, height: 80 },
    ],
    edges: [
      { id: "e1", fromNode: "root", toNode: "a" },
      { id: "e2", fromNode: "root", toNode: "b" },
      { id: "e3", fromNode: "a", toNode: "note" },
    ],
    extra: { plugin: "keep me" },
  });
  const first = map.layoutCanvas(raw);
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(first.rootId, "root");

  const data = JSON.parse(first.text);
  assert.deepEqual(data.extra, { plugin: "keep me" }, "unknown top-level fields survive");
  assert.equal(data.edges.length, 3);
  const root = data.nodes.find((node) => node.id === "root");
  const a = data.nodes.find((node) => node.id === "a");
  const note = data.nodes.find((node) => node.id === "note");
  const group = data.nodes.find((node) => node.id === "group");
  assert.equal(root.width, 240);
  assert.equal(root.height, 90);
  assert.equal(root.color, "1", "card styling survives");
  assert.equal(group.label, "Unit 1");
  assert.deepEqual([group.x, group.y], [-100, -100], "a group frame keeps its place");
  assert.deepEqual([a.width, a.height], [180, 60], "card sizes are preserved");
  assert.ok(a.x > root.x && note.x > a.x, "depth moves right");
  const loose = data.nodes.find((node) => node.id === "loose");
  assert.ok(loose.x > Math.max(root.x, a.x, note.x), "the unreachable card gets its own column");
  assert.equal(overlaps(data.nodes.filter((node) => node.type !== "group")), "", "no two cards overlap");

  const second = map.layoutCanvas(first.text);
  assert.equal(second.ok, true);
  assert.equal(second.changed, false, "a laid-out board is already in place");
  assert.equal(second.text, first.text, "running the layout again yields identical coordinates");

  const shuffled = JSON.parse(JSON.stringify(data));
  shuffled.nodes = shuffled.nodes.slice().reverse();
  const coordinates = (target) => target.nodes.map((node) => node.id + ":" + node.x + "," + node.y).sort().join("|");
  assert.equal(coordinates(JSON.parse(map.layoutCanvas(JSON.stringify(shuffled)).text)), coordinates(data), "input order does not change the coordinates");
});

test("a malformed or oversized board is refused before any layout", () => {
  assert.equal(map.layoutCanvas("").reason, "empty");
  assert.equal(map.layoutCanvas("not json").reason, "json");
  assert.equal(map.layoutCanvas('{"nodes":[]}').reason, "empty");
  assert.equal(map.layoutCanvas('{"nodes":[{"id":"a","type":"draw"}]}').reason, "node");
  assert.equal(map.layoutCanvas('{"nodes":[{"id":"g","type":"group"}]}').reason, "cards", "a board of only frames has nothing to arrange");
  const many = JSON.stringify({ nodes: Array.from({ length: map.MAX_NODES ? map.MAX_NODES + 1 : 2001 }, (unused, index) => ({ id: `n${index}`, type: "text" })) });
  assert.equal(map.layoutCanvas(many).reason, "size");
});

const RAW = JSON.stringify({
  nodes: [
    { id: "root", type: "text", text: "Root", x: 500, y: 500, width: 200, height: 90 },
    { id: "mito", type: "text", text: "Mitochondria", x: 900, y: 900, width: 200, height: 90, color: "1" },
  ],
  edges: [{ id: "e1", fromNode: "root", toNode: "mito" }],
});

test("the walk commands move a session cursor and refuse at the edge of the tree", async () => {
  const app = makeApp([{ path: "Biology/Map.canvas", text: TREE, noFm: true }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files.find((entry) => entry.path === "Biology/Map.canvas");
  file.extension = "canvas";
  app.workspace.getActiveFile = () => file;

  const ids = plugin.commands.map((command) => command.id);
  for (const id of ["canvas-walk-parent", "canvas-walk-child", "canvas-walk-next-sibling", "canvas-walk-prev-sibling", "canvas-layout"]) {
    assert.ok(ids.includes(id), `missing command ${id}`);
  }

  const start = await plugin.walkCanvas("child");
  assert.equal(start.ok, true);
  assert.equal(start.id, "root", "the first press focuses the root card");
  assert.equal(start.root, true);
  assert.equal((await plugin.walkCanvas("child")).id, "mito");
  assert.equal((await plugin.walkCanvas("next")).id, "nucleus");
  const edge = await plugin.walkCanvas("next");
  assert.equal(edge.ok, false);
  assert.equal(edge.reason, "edge");
  assert.equal((await plugin.walkCanvas("prev")).id, "mito");
  assert.equal((await plugin.walkCanvas("parent")).id, "root");
  assert.equal((await plugin.walkCanvas("parent")).reason, "edge");
  app.workspace.getActiveFile = () => null;
  assert.equal((await plugin.walkCanvas("child")).reason, "file");

  const note = makeApp([{ path: "Notes/Plain.md", text: "# Plain", noFm: true }]);
  const other = new QT(note);
  await other.onload();
  note.workspace.getActiveFile = () => note.files[0];
  assert.equal((await other.walkCanvas("child")).reason, "file");
});

test("the layout command arranges the open board once and writes nothing else", async () => {
  const app = makeApp([{ path: "Biology/Map.canvas", text: RAW, noFm: true }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files.find((entry) => entry.path === "Biology/Map.canvas");
  file.extension = "canvas";
  app.workspace.getActiveFile = () => file;

  const first = await plugin.layoutActiveCanvas();
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(app.modified.length, 1);
  assert.equal(app.modified[0].path, "Biology/Map.canvas");
  const written = JSON.parse(app.modified[0].text);
  assert.equal(written.nodes.find((node) => node.id === "mito").color, "1");
  assert.equal(written.edges.length, 1);
  assert.ok(written.nodes.find((node) => node.id === "mito").x > written.nodes.find((node) => node.id === "root").x);

  const again = await plugin.layoutActiveCanvas();
  assert.equal(again.changed, false);
  assert.equal(app.modified.length, 1, "an arranged board is not rewritten");

  app.workspace.getActiveFile = () => null;
  assert.equal((await plugin.layoutActiveCanvas()).reason, "file");

  file.text = "not json";
  app.workspace.getActiveFile = () => file;
  assert.equal((await plugin.layoutActiveCanvas()).reason, "json");
  assert.equal(app.modified.length, 1, "a damaged board is refused before the write");
});
