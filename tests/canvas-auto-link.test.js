"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { Plugin: QT } = load();
const autolink = require("../src/canvas-auto-link");

const LINKS = JSON.stringify({
  nodes: [
    { id: "atp-card", type: "text", text: "Mitochondria make ATP", x: 0, y: 0, width: 240, height: 90, custom: { keep: true } },
    { id: "atp-file", type: "file", file: "Biology/ATP.md", x: 400, y: 0, width: 240, height: 90 },
    { id: "cell", type: "text", text: "Cell Biology\nEverything else", x: 800, y: 0, width: 240, height: 90 },
    { id: "notes", type: "text", text: "See [[Cell   Biology]] and [[Nowhere]]", x: 0, y: 300, width: 240, height: 90 },
  ],
  edges: [],
});

function pairs(proposals) {
  return proposals.map((proposal) => proposal.from + "→" + proposal.to + ":" + proposal.via);
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

test("a node's title is read by type and every name it answers to is listed", () => {
  assert.equal(autolink.titleOf({ type: "text", text: "\n  Cell Biology \nSecond line" }), "Cell Biology");
  assert.equal(autolink.titleOf({ type: "file", file: "Biology/ATP.md" }), "ATP");
  assert.equal(autolink.titleOf({ type: "link", url: "https://example.test/a", text: "Reading list" }), "Reading list");
  assert.equal(autolink.titleOf({ type: "link", url: "https://example.test/a" }), "https://example.test/a");
  assert.equal(autolink.titleOf({ type: "group", label: "Backlog" }), "", "a frame is not a link target");
  assert.deepEqual(autolink.keysOf({ type: "file", file: "Biology/ATP.md" }), ["atp", "biology/atp.md", "biology/atp"]);
  assert.deepEqual(autolink.tokensOf("Cell   Biology, again!"), ["cell", "biology", "again"]);
  assert.equal(autolink.MIN_TITLE, 3);
});

test("wikilinks and whole-phrase mentions match, and near misses do not", () => {
  const report = autolink.linkReport(LINKS);
  assert.equal(report.ok, true);
  assert.deepEqual(pairs(report.proposals), ["atp-card→atp-file:mention", "notes→cell:wikilink"]);
  assert.equal(report.skipped.unresolved.length, 1, "a wikilink to nothing is reported");
  assert.equal(report.skipped.unresolved[0].title, "nowhere");
  assert.match(report.summary, /2 links proposed \(1 wikilink, 1 mention\)/);
  assert.match(report.summary, /1 unresolved/);

  const near = JSON.stringify({
    nodes: [
      { id: "a", type: "text", text: "ATPase is an enzyme", x: 0, y: 0 },
      { id: "b", type: "text", text: "ATP", x: 300, y: 0 },
      { id: "c", type: "text", text: "the AB test", x: 0, y: 200 },
      { id: "d", type: "text", text: "AB", x: 300, y: 200 },
      { id: "e", type: "text", text: "cell   BIOLOGY matters", x: 0, y: 400 },
      { id: "f", type: "text", text: "Cell Biology", x: 300, y: 400 },
    ],
    edges: [],
  });
  const nearReport = autolink.linkReport(near);
  assert.deepEqual(pairs(nearReport.proposals), ["e→f:mention"], "inside-a-word and two-letter near misses never match");
  assert.equal(nearReport.skipped.unresolved.length, 0);
});

test("ambiguous, self, existing and missing targets are refused instead of guessed", () => {
  const raw = JSON.stringify({
    nodes: [
      { id: "one", type: "file", file: "Biology/ATP.md", x: 0, y: 0 },
      { id: "two", type: "file", file: "Chemistry/ATP.md", x: 300, y: 0 },
      { id: "linker", type: "text", text: "Read [[ATP]] first", x: 0, y: 200 },
      { id: "selfie", type: "text", text: "Intro notes\n[[Intro notes]]", x: 300, y: 200 },
      { id: "named", type: "text", text: "Cell Biology", x: 0, y: 400 },
      { id: "already", type: "text", text: "See Cell Biology", x: 300, y: 400 },
    ],
    edges: [
      { id: "keep-1", fromNode: "already", toNode: "named" },
    ],
  });
  const result = autolink.proposeLinks(require("../src/canvas-markdown").parseCanvas(raw).canvas);
  assert.equal(result.ok, true);
  assert.deepEqual(result.proposals, [], "nothing is proposed for an ambiguous or already linked target");
  assert.equal(result.skipped.ambiguous.length, 1);
  assert.deepEqual(result.skipped.ambiguous[0].candidates, ["one", "two"]);
  assert.equal(result.skipped.self.length, 1);
  assert.equal(result.skipped.existing.length, 1);
  assert.equal(result.skipped.existing[0].to, "named");
  assert.match(result.summary, /1 ambiguous/);
  assert.match(result.summary, /1 self/);
  assert.match(result.summary, /1 already linked/);
});

test("applying adds only the missing edges, keeps every node, and is idempotent", () => {
  const applied = autolink.applyLinks(LINKS);
  assert.equal(applied.ok, true);
  assert.equal(applied.changed, true);
  const before = JSON.parse(LINKS);
  const after = JSON.parse(applied.text);
  assert.deepEqual(after.nodes, before.nodes, "positions, sizes, text and unknown fields are untouched");
  assert.equal(after.edges.length, 2);
  assert.deepEqual(after.edges.map((edge) => [edge.id, edge.fromNode, edge.toNode]), [
    ["auto-link-1", "atp-card", "atp-file"],
    ["auto-link-2", "notes", "cell"],
  ]);

  const again = autolink.applyLinks(applied.text);
  assert.equal(again.ok, true);
  assert.equal(again.changed, false, "nothing is proposed a second time");
  assert.equal(again.text, applied.text, "the document is not rewritten");

  const collision = JSON.parse(LINKS);
  collision.edges.push({ id: "auto-link-1", fromNode: "cell", toNode: "notes" });
  const withCollision = autolink.applyLinks(JSON.stringify(collision));
  assert.deepEqual(withCollision.applied.map((entry) => entry.id), ["auto-link-2", "auto-link-3"], "existing edge ids are never reused");
});

test("the result does not depend on the order of the nodes in the file", () => {
  const data = JSON.parse(LINKS);
  const reversed = Object.assign({}, data, { nodes: data.nodes.slice().reverse() });
  const straight = autolink.proposeLinks(require("../src/canvas-markdown").parseCanvas(LINKS).canvas);
  const shuffled = autolink.proposeLinks(require("../src/canvas-markdown").parseCanvas(JSON.stringify(reversed)).canvas);
  assert.deepEqual(pairs(shuffled.proposals), pairs(straight.proposals));
  assert.deepEqual(shuffled.proposals.map((entry) => entry.reason), straight.proposals.map((entry) => entry.reason));
});

test("a malformed, unknown-type or oversized board is refused before any write", () => {
  assert.equal(autolink.applyLinks("").reason, "empty");
  assert.equal(autolink.applyLinks("not json").reason, "json");
  assert.equal(autolink.applyLinks('{"nodes":[]}').reason, "empty");
  assert.equal(autolink.applyLinks('{"nodes":[{"id":"a","type":"draw"}]}').reason, "node");
  assert.equal(autolink.linkReport("nope").reason, "json");
  const many = JSON.stringify({ nodes: Array.from({ length: 2001 }, (unused, index) => ({ id: "n" + index, type: "text" })) });
  assert.equal(autolink.applyLinks(many).reason, "size");
});

test("the commands report the proposals and write the edges exactly once", async () => {
  const app = makeApp([{ path: "Boards/Links.canvas", text: LINKS, noFm: true }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files.find((entry) => entry.path === "Boards/Links.canvas");
  file.extension = "canvas";
  app.workspace.getActiveFile = () => file;

  const ids = plugin.commands.map((command) => command.id);
  assert.ok(ids.includes("canvas-auto-link-report"));
  assert.ok(ids.includes("canvas-auto-link-apply"));

  const before = obsidian.modals.length;
  const report = await plugin.reportCanvasLinks();
  assert.equal(report.ok, true);
  assert.equal(report.proposals.length, 2);
  assert.equal(obsidian.modals.length, before + 1, "the report opens a window");
  const modal = obsidian.modals[obsidian.modals.length - 1];
  assert.equal(modal.report.proposals[0].toLabel, "ATP");
  modal.contentEl = fakeEl();
  modal.onOpen();
  const drawn = modal.contentEl.allText();
  assert.match(drawn, /Mitochondria make ATP → ATP/);
  assert.match(drawn, /Ambiguous, not linked/);
  assert.match(drawn, /Unresolved links/);

  const applied = await plugin.applyCanvasLinks();
  assert.equal(applied.changed, true);
  assert.equal(app.modified.length, 1);
  const written = JSON.parse(app.modified[0].text);
  assert.equal(written.edges.length, 2);
  assert.deepEqual(written.nodes, JSON.parse(LINKS).nodes);

  const second = await plugin.applyCanvasLinks();
  assert.equal(second.changed, false);
  assert.equal(app.modified.length, 1, "a complete board is not rewritten");

  app.workspace.getActiveFile = () => null;
  assert.equal((await plugin.applyCanvasLinks()).reason, "file");
  assert.equal((await plugin.reportCanvasLinks()).reason, "file");

  file.text = "not json";
  app.workspace.getActiveFile = () => file;
  assert.equal((await plugin.applyCanvasLinks()).reason, "json");
  assert.equal(app.modified.length, 1, "a damaged board is refused before the write");
});
