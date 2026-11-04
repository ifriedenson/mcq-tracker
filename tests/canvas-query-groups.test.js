"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { Plugin: QT } = load();
const query = require("../src/canvas-query");

const BOARD = JSON.stringify({
  nodes: [
    { id: "q-exam", type: "group", label: "query: exam", x: 0, y: 0, width: 400, height: 300, colour: "1" },
    { id: "c1", type: "text", text: "Exam prep\n#exam notes", x: 20, y: 20, width: 200, height: 80, custom: { keep: true } },
    { id: "c2", type: "text", text: "Exam strategy", x: 20, y: 200, width: 200, height: 80 },
    { id: "c3", type: "text", text: "Unrelated card", x: 600, y: 20, width: 200, height: 80 },
    { id: "c4", type: "text", text: "Exam outside the frame", x: 600, y: 300, width: 200, height: 80 },
    { id: "c5", type: "text", text: "Stray card", x: 220, y: 20, width: 200, height: 80 },
    { id: "f1", type: "file", file: "Biology/ATP.md", x: 600, y: 600, width: 200, height: 80 },
  ],
  edges: [{ id: "e1", fromNode: "c1", toNode: "c2", label: "leads to" }],
  extra: "kept",
});

function boardWith(extra, frame) {
  return JSON.stringify({
    nodes: (frame ? [frame] : []).concat(extra),
    edges: [],
  });
}

function fakeEl() {
  const node = {
    tag: "div",
    text: "",
    disabled: false,
    classes: new Set(),
    children: [],
    handlers: [],
    empty() {
      node.children = [];
    },
    addClass(name) {
      node.classes.add(name);
    },
    addEventListener(ev, fn) {
      node.handlers.push({ ev, fn });
    },
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

test("only a label that starts with query: is a query, and its terms are read one by one", () => {
  assert.equal(query.parseQuery("Biology").isQuery, false, "an ordinary frame label is not a query");
  assert.equal(query.parseQuery("a query: in the middle").isQuery, false);
  assert.deepEqual(query.parseQuery("query: Exam #Test type:TEXT").terms, [
    { kind: "text", value: "exam" },
    { kind: "tag", value: "test" },
    { kind: "type", value: "text" },
  ]);
  assert.equal(query.parseQuery("  QUERY :  exam  ").text, "exam");
  assert.deepEqual(query.parseQuery("query: foo:bar").unsupported, ["foo:bar"], "an unknown operator is reported");
  assert.deepEqual(query.parseQuery("query: type:video").unsupported, ["type:video"]);
  assert.deepEqual(query.parseQuery("query: -hidden").unsupported, ["-hidden"]);
  assert.deepEqual(query.parseQuery('query: "two words"').unsupported, ['"two', 'words"']);
  assert.deepEqual(query.parseQuery("query:").terms, [], "an empty query is a query with nothing to look for");

  const many = query.parseQuery("query: " + Array.from({ length: 15 }, (unused, index) => "t" + index).join(" "));
  assert.equal(many.terms.length, query.MAX_TERMS);
  assert.equal(many.dropped, 3);
  const long = query.parseQuery("query: " + "a".repeat(query.MAX_QUERY_TEXT + 50));
  assert.equal(long.truncated, true);
  assert.equal(long.text.length, query.MAX_QUERY_TEXT);
});

test("substring, tag and type matching are case-insensitive and never partial on tags", () => {
  const textCard = { id: "t", type: "text", text: "Cell Biology\n#exam" };
  const fileCard = { id: "f", type: "file", file: "Biology/Cell.md", text: "" };
  assert.equal(query.matchesQuery(textCard, query.parseQuery("query: cell")), true);
  assert.equal(query.matchesQuery(textCard, query.parseQuery("query: BIOLOGY")), true, "the first line is a name too");
  assert.equal(query.matchesQuery(fileCard, query.parseQuery("query: cell.md")), true, "a file card is reachable by its path");
  assert.equal(query.matchesQuery(textCard, query.parseQuery("query: cell #exam")), true);
  assert.equal(query.matchesQuery(textCard, query.parseQuery("query: cell #exams")), false, "a longer tag is not a match");
  assert.equal(query.matchesQuery(textCard, query.parseQuery("query: cell type:file")), false);
  assert.equal(query.matchesQuery(fileCard, query.parseQuery("query: type:file")), true);
  assert.equal(query.matchesQuery(textCard, query.parseQuery("query: nothing")), false);
});

test("members are ordered by the board, not by the file, and every query is reported", () => {
  const report = query.queryReport(BOARD);
  assert.equal(report.ok, true);
  assert.equal(report.groups.length, 1);
  const group = report.groups[0];
  assert.equal(group.label, "query: exam");
  assert.deepEqual(group.terms, ["text:exam"]);
  assert.deepEqual(group.members, ["Exam prep", "Exam strategy", "Exam outside the frame"]);
  assert.deepEqual(group.strays, ["Stray card"], "a card inside the frame that does not match is reported, not absorbed");
  assert.equal(group.strayCount, 1);
  assert.deepEqual(group.fit, { x: 4, y: 4, width: 812, height: 392 });
  assert.equal(report.summary, "1 query group; 3 cards matched; 1 card sits inside a group without matching and stays put.");

  const tagOnly = query.queryReport(boardWith(
    [{ id: "t1", type: "text", text: "Tagged\n#exam" }, { id: "t2", type: "text", text: "Exam strategy" }],
    { id: "q", type: "group", label: "query: #exam", x: 0, y: 0, width: 100, height: 100 },
  ));
  assert.deepEqual(tagOnly.groups[0].members, ["Tagged"]);

  const files = query.queryReport(boardWith(
    [{ id: "t1", type: "text", text: "notes" }, { id: "f1", type: "file", file: "Biology/ATP.md" }],
    { id: "q", type: "group", label: "query: type:file", x: 0, y: 0, width: 100, height: 100 },
  ));
  assert.deepEqual(files.groups[0].members, ["ATP"]);

  const shuffled = JSON.parse(BOARD);
  shuffled.nodes.reverse();
  assert.deepEqual(query.queryReport(JSON.stringify(shuffled)), report, "node order in the file changes nothing");
  assert.deepEqual(query.queryReport(BOARD), report, "resolving twice returns the same report");
});

test("limits clamp and are counted, and a query that matches nothing or spans too far is refused", () => {
  const crowded = Array.from({ length: query.MAX_MEMBERS + 1 }, (unused, index) => ({
    id: "c" + String(index).padStart(3, "0"),
    type: "text",
    text: "shared card",
    x: 20 + (index % 10) * 240,
    y: 20 + Math.floor(index / 10) * 120,
    width: 200,
    height: 80,
  }));
  const capped = query.queryReport(boardWith(crowded, { id: "q", type: "group", label: "query: shared", x: 0, y: 0, width: 3000, height: 2000 }));
  assert.equal(capped.groups[0].members.length, query.MAX_MEMBERS);
  assert.equal(capped.groups[0].dropped, 1);
  assert.equal(capped.stats.membersDropped, 1);
  assert.equal(capped.stats.limits, true);
  assert.match(capped.summary, /1 beyond the 120-member limit/);

  const frames = Array.from({ length: query.MAX_QUERIES + 1 }, (unused, index) => ({
    id: "q" + String(index).padStart(2, "0"),
    type: "group",
    label: "query: shared",
    x: index * 400,
    y: 0,
    width: 300,
    height: 300,
  }));
  const many = query.queryReport(JSON.stringify({
    nodes: frames.concat({ id: "only", type: "text", text: "shared card", x: 0, y: 0 }),
    edges: [],
  }));
  assert.equal(many.groups.length, query.MAX_QUERIES);
  assert.equal(many.stats.groupsSkipped, 1);
  assert.match(many.summary, /1 beyond the 24-query limit/);

  const nothing = query.queryReport(boardWith(
    [{ id: "t", type: "text", text: "unrelated" }],
    { id: "q", type: "group", label: "query: absent", x: 0, y: 0, width: 100, height: 100 },
  ));
  assert.equal(nothing.groups[0].reason, "empty");
  assert.equal(nothing.stats.unfitted, 1);
  assert.match(nothing.summary, /not fitted/);

  const far = query.queryReport(boardWith(
    [{ id: "a", type: "text", text: "far apart", x: 0, y: 0 }, { id: "b", type: "text", text: "far apart", x: 30000, y: 0 }],
    { id: "q", type: "group", label: "query: far", x: 0, y: 0, width: 100, height: 100 },
  ));
  assert.equal(far.groups[0].reason, "span");
  assert.equal(far.groups[0].fit, null);

  const bad = query.queryReport(boardWith(
    [{ id: "t", type: "text", text: "anything", x: 0, y: 0 }],
    { id: "q", type: "group", label: "query: foo:bar", x: 0, y: 0, width: 100, height: 100 },
  ));
  assert.equal(bad.groups[0].reason, "syntax");
  assert.match(bad.groups[0].message, /Unsupported query term: foo:bar/);
  assert.equal(bad.stats.unsupported, 1);
});

test("apply fits each group frame around its matches and is idempotent", () => {
  const first = query.applyQueries(BOARD);
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.deepEqual(first.applied, [{ id: "q-exam", x: 4, y: 4, width: 812, height: 392 }]);
  const before = JSON.parse(BOARD);
  const after = JSON.parse(first.text);
  assert.deepEqual(after.edges, before.edges, "no edge is touched");
  assert.equal(after.extra, "kept", "an unknown top-level field survives");
  const cardsBefore = before.nodes.filter((node) => node.type !== "group");
  const cardsAfter = after.nodes.filter((node) => node.type !== "group");
  assert.deepEqual(cardsAfter, cardsBefore, "every card keeps its position, size, text and unknown fields");
  const frameAfter = after.nodes.find((node) => node.id === "q-exam");
  assert.equal(frameAfter.label, "query: exam");
  assert.equal(frameAfter.colour, "1");

  const second = query.applyQueries(first.text);
  assert.equal(second.ok, true);
  assert.equal(second.changed, false, "a fitted board proposes nothing");
  assert.equal(second.text, first.text, "and is not rewritten");
  assert.deepEqual(second.applied, []);

  const strays = query.queryReport(first.text);
  assert.equal(strays.groups[0].strayCount, 2, "the fitted frame overlaps another card, which is reported and left alone");
});

test("an empty, damaged, unknown-type or oversized board, a board without queries, and unfittable queries are refused", () => {
  assert.equal(query.applyQueries("").reason, "empty");
  assert.equal(query.applyQueries("not json").reason, "json");
  assert.equal(query.applyQueries('{"nodes":[]}').reason, "empty");
  assert.equal(query.applyQueries('{"nodes":[{"id":"a","type":"draw"}]}').reason, "node");
  assert.equal(query.queryReport("nope").reason, "json");
  const many = JSON.stringify({ nodes: Array.from({ length: 2001 }, (unused, index) => ({ id: "n" + index, type: "text" })) });
  assert.equal(query.applyQueries(many).reason, "size");
  assert.equal(query.applyQueries(JSON.stringify({ nodes: [{ id: "a", type: "text", text: "plain" }], edges: [] })).reason, "queries");
  const nothing = boardWith([{ id: "t", type: "text", text: "unrelated", x: 0, y: 0 }], { id: "q", type: "group", label: "query: absent", x: 0, y: 0, width: 100, height: 100 });
  const unfitted = query.applyQueries(nothing);
  assert.equal(unfitted.reason, "fit");
  assert.match(unfitted.message, /could be fitted/);
});

test("the commands report the groups and fit them once, announcing every refusal", async () => {
  const app = makeApp([{ path: "Boards/Queries.canvas", text: BOARD, noFm: true }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files.find((entry) => entry.path === "Boards/Queries.canvas");
  file.extension = "canvas";
  app.workspace.getActiveFile = () => file;

  const ids = plugin.commands.map((command) => command.id);
  assert.ok(ids.includes("canvas-query-report"));
  assert.ok(ids.includes("canvas-query-apply"));

  const before = obsidian.modals.length;
  const report = await plugin.reportCanvasQueryGroups();
  assert.equal(report.ok, true);
  assert.equal(obsidian.modals.length, before + 1, "the report opens a window");
  assert.equal(app.modified, undefined, "the report writes nothing");
  const modal = obsidian.modals[obsidian.modals.length - 1];
  modal.contentEl = fakeEl();
  modal.onOpen();
  const drawn = modal.contentEl.allText();
  assert.match(drawn, /Query groups/);
  assert.match(drawn, /query: exam — 3 matches/);
  assert.match(drawn, /Exam outside the frame/);
  assert.match(drawn, /Inside but not matching \(1\)/);
  assert.match(drawn, /Stray card/);
  assert.match(drawn, /Frame: 812 × 392 at 4, 4/);

  const applied = await plugin.applyCanvasQueryGroups();
  assert.equal(applied.changed, true);
  assert.equal(app.modified.length, 1);
  const written = JSON.parse(app.modified[0].text);
  assert.deepEqual(written.nodes.find((node) => node.id === "q-exam"), Object.assign({}, JSON.parse(BOARD).nodes[0], { x: 4, y: 4, width: 812, height: 392 }));
  assert.ok(obsidian.notices.some((line) => /Fitted 1 query group around 3 cards/.test(line)));

  const again = await plugin.applyCanvasQueryGroups();
  assert.equal(again.changed, false);
  assert.equal(app.modified.length, 1, "an already fitted board is not rewritten");
  assert.ok(obsidian.notices.some((line) => /already fit/.test(line)));

  app.workspace.getActiveFile = () => null;
  assert.equal((await plugin.applyCanvasQueryGroups()).reason, "file");
  assert.equal((await plugin.reportCanvasQueryGroups()).reason, "file");
  assert.ok(obsidian.notices.some((line) => line === "Open a canvas first."));

  app.workspace.getActiveFile = () => file;
  file.text = "not json";
  assert.equal((await plugin.applyCanvasQueryGroups()).reason, "json");
  file.text = '{"nodes":[{"id":"a","type":"draw"}]}';
  const modals = obsidian.modals.length;
  assert.equal((await plugin.applyCanvasQueryGroups()).reason, "node");
  assert.equal((await plugin.reportCanvasQueryGroups()).reason, "node");
  assert.equal(obsidian.modals.length, modals, "an unknown node type opens no window");
  assert.equal(app.modified.length, 1, "and writes nothing");

  file.text = JSON.stringify({ nodes: [{ id: "a", type: "text", text: "plain" }], edges: [] });
  assert.equal((await plugin.applyCanvasQueryGroups()).reason, "queries");
  assert.ok(obsidian.notices.some((line) => /no query group/.test(line)));
});
