"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { Plugin: QT } = load();
const decks = require("../src/canvas-presentations");

const FRAMES = JSON.stringify({
  nodes: [
    { id: "f-late", type: "group", label: "", x: 800, y: 0, width: 400, height: 400 },
    { id: "f-first", type: "group", label: "Intro", x: 0, y: 0, width: 400, height: 400 },
    { id: "a1", type: "text", text: "Cell Biology\nFirst line body", x: 20, y: 20, width: 200, height: 80 },
    { id: "a2", type: "file", file: "Biology/ATP.md", x: 20, y: 200, width: 200, height: 80 },
    { id: "b1", type: "link", url: "https://example.test/x", text: "Reading list", x: 820, y: 20, width: 200, height: 80 },
    { id: "loose", type: "text", text: "Loose card", x: 2000, y: 0, width: 200, height: 80 },
  ],
  edges: [{ id: "e1", fromNode: "a1", toNode: "loose" }],
});

const ROOTS = JSON.stringify({
  nodes: [
    { id: "grand", type: "text", text: "ATP", x: 600, y: 0, width: 200, height: 80 },
    { id: "island", type: "text", text: "Island", x: 0, y: 300, width: 200, height: 80 },
    { id: "kid", type: "text", text: "Mitochondria", x: 300, y: 0, width: 200, height: 80 },
    { id: "root", type: "text", text: "Cell Biology\nBody text", x: 0, y: 0, width: 200, height: 80 },
  ],
  edges: [
    { id: "e1", fromNode: "root", toNode: "kid" },
    { id: "e2", fromNode: "kid", toNode: "grand" },
  ],
});

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
    click() {
      for (const handler of node.handlers.filter((entry) => entry.ev === "click")) handler.fn({});
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
    find(text) {
      if (node.text === text) return node;
      for (const child of node.children) {
        const hit = child.find(text);
        if (hit) return hit;
      }
      return null;
    },
    allText() {
      return [node.text].concat(node.children.map((child) => child.allText())).filter(Boolean).join(" | ");
    },
  };
  return node;
}

test("frames become slides with their own title, members, body and links out", () => {
  const plan = decks.presentationPlan(FRAMES);
  assert.equal(plan.ok, true);
  assert.equal(plan.mode, "frames");
  assert.deepEqual(plan.slides.map((slide) => slide.number + ":" + slide.title + ":" + slide.kind), ["1:Intro:frame", "2:Slide 2:frame"]);
  assert.deepEqual(plan.slides[0].members.map((member) => member.label), ["Cell Biology", "ATP"]);
  assert.deepEqual(plan.slides[0].members.map((member) => member.type), ["text", "file"]);
  assert.equal(plan.slides[0].body, "Cell Biology\nFirst line body");
  assert.deepEqual(plan.slides[0].links.map((link) => link.label), ["Loose card"], "a link that leaves the slide is listed");
  assert.deepEqual(plan.slides[1].members.map((member) => member.label), ["Reading list"]);
  assert.equal(plan.slides[1].body, "https://example.test/x", "a link card with no body shows its address");
  assert.deepEqual(plan.unplaced.map((node) => node.id), ["loose"]);
  assert.match(plan.summary, /^2 slides from 4 cards in 2 frames; 1 card is not on a slide\.$/);
});

test("a board without frames presents one root card per slide, then its direct children", () => {
  const plan = decks.presentationPlan(ROOTS);
  assert.equal(plan.mode, "roots");
  assert.deepEqual(plan.slides.map((slide) => slide.title), ["Cell Biology", "Island"]);
  assert.deepEqual(plan.slides[0].members.map((member) => member.label), ["Cell Biology", "Mitochondria"]);
  assert.deepEqual(plan.slides[0].links.map((link) => link.label), ["ATP"], "the card one hop further out is a link, not a member");
  assert.deepEqual(plan.unplaced.map((node) => node.id), ["grand"], "a card two hops from a root is reported, not guessed at");
  assert.match(plan.summary, /2 slides from 4 cards/);

  const loop = JSON.stringify({
    nodes: [
      { id: "b", type: "text", text: "Second", x: 300, y: 0 },
      { id: "a", type: "text", text: "First", x: 0, y: 0 },
    ],
    edges: [{ id: "e1", fromNode: "a", toNode: "b" }, { id: "e2", fromNode: "b", toNode: "a" }],
  });
  const looped = decks.presentationPlan(loop);
  assert.equal(looped.mode, "cards", "a closed loop still presents");
  assert.deepEqual(looped.slides.map((slide) => slide.title), ["First", "Second"]);
  assert.equal(looped.unplaced.length, 0);
});

test("the deck is ordered, capped by named limits, and the same whatever order the file uses", () => {
  const frames = [];
  for (let index = 0; index < decks.MAX_SLIDES + 1; index += 1) {
    frames.push({ id: "f" + String(index).padStart(2, "0"), type: "group", label: "Frame " + index, x: index * 500, y: 0, width: 300, height: 300 });
  }
  const many = decks.presentationPlan(JSON.stringify({ nodes: frames, edges: [] }));
  assert.equal(many.slides.length, decks.MAX_SLIDES);
  assert.equal(many.stats.slidesSkipped, 1);
  assert.equal(many.stats.limits, true);
  assert.match(many.summary, /1 beyond the 60-slide limit/);

  const crowded = [];
  for (let index = 0; index < decks.MAX_SLIDE_CARDS + 1; index += 1) {
    crowded.push({ id: "c" + index, type: "text", text: "Card " + index, x: 20, y: index * 100, width: 200, height: 80 });
  }
  crowded.push({ id: "frame", type: "group", label: "Crowded", x: 0, y: -20, width: 400, height: 3000 });
  const packed = decks.presentationPlan(JSON.stringify({ nodes: crowded, edges: [] }));
  assert.equal(packed.slides[0].members.length, decks.MAX_SLIDE_CARDS);
  assert.equal(packed.slides[0].more, 1);
  assert.equal(packed.stats.cardsDropped, 1);

  const long = JSON.stringify({
    nodes: [{ id: "only", type: "text", text: "word ".repeat(1000), x: 0, y: 0 }],
    edges: [],
  });
  const trimmed = decks.presentationPlan(long);
  assert.ok(trimmed.slides[0].body.length <= decks.MAX_BODY, "the body is capped");
  assert.ok(trimmed.slides[0].body.endsWith("…"));

  const shuffled = JSON.parse(FRAMES);
  shuffled.nodes.reverse();
  assert.deepEqual(decks.presentationPlan(JSON.stringify(shuffled)), decks.presentationPlan(FRAMES));
});

test("derivation is pure: repeating it returns the same plan and never edits the board", () => {
  const first = decks.presentationPlan(ROOTS);
  const second = decks.presentationPlan(ROOTS);
  assert.deepEqual(second, first);
  const parsed = require("../src/canvas-markdown").parseCanvas(ROOTS).canvas;
  const before = JSON.parse(JSON.stringify(parsed));
  decks.deriveSlides(parsed);
  assert.deepEqual(parsed, before, "the canvas object is read, never mutated");
});

test("navigation clamps at both ends and refuses a nonsense step", () => {
  const plan = decks.presentationPlan(ROOTS);
  const start = decks.moveSlide(plan, 0, -1);
  assert.equal(start.ok, true);
  assert.equal(start.index, 0);
  assert.equal(start.moved, false);
  assert.equal(start.atStart, true);
  const forward = decks.moveSlide(plan, 0, 1);
  assert.equal(forward.index, 1);
  assert.equal(forward.atEnd, true);
  const past = decks.moveSlide(plan, 1, 1);
  assert.equal(past.index, 1, "the last Next keeps the last slide instead of wrapping");
  assert.equal(past.moved, false);
  const jump = decks.moveSlide(plan, 0, 9);
  assert.equal(jump.index, 1);
  assert.equal(decks.moveSlide(plan, 5, 0).index, 1, "an out-of-range index is clamped first");
  assert.equal(decks.moveSlide(plan, 0, 1.5).reason, "direction");
  assert.equal(decks.moveSlide({ slides: [] }, 0, 1).reason, "slides");
});

test("the report names every step and everything left out", () => {
  const report = decks.presentationReport(FRAMES);
  assert.equal(report.ok, true);
  assert.equal(report.slides.length, 2);
  assert.deepEqual(report.slides[0], {
    number: 1,
    id: "f-first",
    kind: "frame",
    title: "Intro",
    members: ["Cell Biology", "ATP"],
    more: 0,
    body: "Cell Biology\nFirst line body",
    links: ["Loose card"],
    linksMore: 0,
  });
  assert.deepEqual(report.unplaced.map((card) => card.label), ["Loose card"]);
  assert.equal(report.stats.cards, 4);
});

test("an empty, damaged, unknown-type or oversized board is refused before anything is drawn", () => {
  assert.equal(decks.presentationPlan("").reason, "empty");
  assert.equal(decks.presentationPlan("not json").reason, "json");
  assert.equal(decks.presentationPlan('{"nodes":[]}').reason, "empty");
  assert.equal(decks.presentationPlan('{"nodes":[{"id":"a","type":"draw"}]}').reason, "node");
  assert.equal(decks.presentationReport("nope").reason, "json");
  const many = JSON.stringify({ nodes: Array.from({ length: 2001 }, (unused, index) => ({ id: "n" + index, type: "text" })) });
  assert.equal(decks.presentationPlan(many).reason, "size");
});

test("the commands report the plan and walk the deck without writing the board", async () => {
  const app = makeApp([{ path: "Boards/Deck.canvas", text: FRAMES, noFm: true }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files.find((entry) => entry.path === "Boards/Deck.canvas");
  file.extension = "canvas";
  app.workspace.getActiveFile = () => file;

  const ids = plugin.commands.map((command) => command.id);
  assert.ok(ids.includes("canvas-present"));
  assert.ok(ids.includes("canvas-present-report"));

  const before = obsidian.modals.length;
  const report = await plugin.reportCanvasPresentation();
  assert.equal(report.ok, true);
  assert.equal(obsidian.modals.length, before + 1, "the report opens a window");
  const planWin = obsidian.modals[obsidian.modals.length - 1];
  planWin.contentEl = fakeEl();
  planWin.onOpen();
  const drawn = planWin.contentEl.allText();
  assert.match(drawn, /Presentation plan/);
  assert.match(drawn, /1\. Intro \(frame\)/);
  assert.match(drawn, /Slide 2 \(frame\)/);
  assert.match(drawn, /Not on a slide \(1\)/);
  assert.match(drawn, /Loose card/);

  const shown = await plugin.presentActiveCanvas();
  assert.equal(shown.ok, true);
  assert.equal(shown.slides, 2);
  const deck = obsidian.modals[obsidian.modals.length - 1];
  deck.contentEl = fakeEl();
  deck.onOpen();
  assert.match(deck.contentEl.allText(), /Slide 1 of 2/);
  assert.equal(deck.next().index, 1);
  assert.equal(deck.next().index, 1, "the last Next stays put");
  assert.equal(deck.previous().index, 0);
  assert.equal(deck.previous().index, 0, "the first Previous stays put");
  assert.ok(obsidian.notices.some((line) => /Slide 2 of 2: Slide 2/.test(line)), "each step is announced");
  deck.close();
  assert.equal(deck.closed, true);

  assert.equal(app.modified, undefined, "presenting never writes the board");

  app.workspace.getActiveFile = () => null;
  assert.equal((await plugin.presentActiveCanvas()).reason, "file");
  assert.equal((await plugin.reportCanvasPresentation()).reason, "file");

  file.text = "not json";
  app.workspace.getActiveFile = () => file;
  const modalsBefore = obsidian.modals.length;
  assert.equal((await plugin.presentActiveCanvas()).reason, "json");
  assert.equal(obsidian.modals.length, modalsBefore, "a damaged board opens no window");
});
