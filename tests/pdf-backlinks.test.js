"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const deep = T.pdfDeepLink;
const backlinks = T.pdfBacklinks;
const ink = T.pdfInk;

test("pdf backlinks: selection and colour round-trip as PDF++ links", () => {
  const link = deep.formatPdfDeepLink("Papers/Exam.pdf", 3, { selection: "4,0,5,20", color: "Green" });
  assert.equal(link, "[[Papers/Exam.pdf#page=3&selection=4,0,5,20&color=green]]");
  const parsed = deep.parsePdfDeepLink(link);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.page, 3);
  assert.equal(parsed.selection, "4,0,5,20");
  assert.equal(parsed.color, "green");
  assert.match(deep.describePdfDeepLink(parsed), /text range 4,0,5,20/);
  assert.match(deep.describePdfDeepLink(parsed), /green/);

  assert.equal(deep.formatPdfDeepLink("Papers/Exam.pdf", 3, { selection: "5,0,4,1" }), "");
  assert.equal(deep.formatPdfDeepLink("Papers/Exam.pdf", 3, { color: "red!" }), "");
  assert.equal(deep.parsePdfDeepLink("[[Papers/Exam.pdf#page=3&selection=bad&color=green]]").selection, "");
});

test("pdf backlinks: notes become rows, including relative and bare PDF links", () => {
  const notes = [
    {
      path: "Notes/Reading.md",
      text: "Intro\n[[Papers/Exam.pdf#page=2&selection=0,0,1,5&color=blue|Exam p2]]\n[[Papers/Other.pdf#page=1]]\n[[Exam.pdf#page=3&rect=0.1,0.2,0.3,0.04]]",
    },
    { path: "Papers/Exam.annotations.md", text: "[[Papers/Exam.pdf#page=9]]" },
    { path: "Papers/Notes.md", text: "[[Exam.pdf#page=4]]" },
  ];
  const rows = backlinks.collectPdfBacklinks(notes, "Papers/Exam.pdf");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].page, 2);
  assert.equal(rows[0].sourcePath, "Notes/Reading.md");
  assert.equal(rows[0].line, 2);
  assert.equal(rows[0].color, "blue");
  assert.equal(rows[0].selection, "0,0,1,5");
  assert.equal(rows[0].quote, "Exam p2");
  assert.equal(rows[1].page, 3);
  assert.equal(rows[1].sourcePath, "Notes/Reading.md");
  assert.equal(rows[2].page, 4);
  assert.equal(rows[2].sourcePath, "Papers/Notes.md");
  assert.equal(backlinks.collectPdfBacklinks(notes, "Missing.pdf").length, 0);
});

test("pdf backlinks: text ranges map to page rectangles and drags produce ranges", () => {
  const items = [
    { i: 0, s: "Hello", x: 0.1, y: 0.1, w: 0.2, h: 0.02 },
    { i: 1, s: "world", x: 0.32, y: 0.1, w: 0.2, h: 0.02 },
    { i: 2, s: "Next", x: 0.1, y: 0.2, w: 0.1, h: 0.02 },
  ];
  const areas = backlinks.selectionAreas(items, "0,0,1,5", { color: "green" });
  assert.equal(areas.length, 2);
  assert.equal(areas[0].style, "backlink");
  assert.equal(areas[0].color, "green");
  assert.equal(areas[0].x, 0.1);
  assert.equal(areas[0].width, 0.2);
  assert.equal(areas[1].x, 0.32);
  assert.equal(areas[1].width, 0.2);

  const drag = backlinks.selectionFromArea(items, { x: 0.05, y: 0.05, width: 0.6, height: 0.2 });
  assert.equal(drag.selection, "0,0,2,4");
  assert.equal(drag.quote, "Hello world Next");
  assert.equal(drag.areas.length, 3);

  const rect = backlinks.backlinkAreasFor(
    { page: 1, color: "red", rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 } },
    []
  );
  assert.equal(rect.length, 1);
  assert.equal(rect[0].style, "backlink");
  assert.equal(rect[0].color, "red");
  assert.equal(rect[0].backlink.page, 1);
});

test("pdf backlinks: the plugin scans the vault and opens the source note", async () => {
  const app = makeApp([
    { path: "Papers/Exam.pdf", noFm: true, text: "" },
    { path: "Notes/Reading.md", text: "Read this: [[Papers/Exam.pdf#page=2&selection=0,0,1,5&color=green]]" },
  ]);
  const plugin = new QT(app);
  await plugin.onload();

  const rows = await plugin.pdfBacklinkRows("Papers/Exam.pdf");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourcePath, "Notes/Reading.md");
  assert.equal(await plugin.openPdfBacklink(rows[0]), true);
  assert.deepEqual(app.opened, ["Notes/Reading.md"]);
  assert.equal(await plugin.openPdfBacklink({}), false);
});

test("pdf backlinks: the reader paints them and a selection link uses the selected colour", async () => {
  const app = makeApp([
    { path: "Papers/Exam.pdf", noFm: true, text: "" },
    { path: "Notes/Reading.md", text: "[[Papers/Exam.pdf#page=1&rect=0.1,0.2,0.3,0.04&color=green]]" },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const modal = new T.PdfInkModal(app, plugin, { pdfPath: "Papers/Exam.pdf", page: 1 });
  modal.page = 1;
  modal.annotationRows = [];
  modal.selectedId = "";
  modal.pageTexts = new Map([[1, []]]);
  modal.pageAnnotations = new Map();
  await modal.loadBacklinks();
  assert.equal(modal.backlinkCount, 1);

  const calls = [];
  const ctx = new Proxy({}, {
    get(_target, key) {
      if (key === "measureText") return () => ({ width: 10 });
      return (...args) => calls.push([key, ...args]);
    },
    set() { return true; },
  });
  modal.pageCanvases.set(1, { width: 1000, height: 1400 });
  modal.pageContexts.set(1, ctx);
  modal.redrawPage(1);
  assert.ok(calls.some((call) => call[0] === "fillRect"), "the backlink highlight is painted");

  modal.lastSelection = { page: 1, selection: "0,0,1,5" };
  modal.color = "purple";
  const copied = [];
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (text) => copied.push(text) } },
  });
  try {
    assert.equal(await modal.copySelectionLink(), true);
  } finally {
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  }
  assert.deepEqual(copied, ["[[Papers/Exam.pdf#page=1&selection=0,0,1,5&color=purple]]"]);
});

test("pdf ink: backlink highlights fill without the sidecar mark border", () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_target, key) {
      return (...args) => calls.push([key, ...args]);
    },
    set() { return true; },
  });
  ink.drawMarks(ctx, [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05, color: "green", style: "backlink" }], 1000, 1400);
  assert.equal(calls.some((call) => call[0] === "fillRect"), true);
  assert.equal(calls.some((call) => call[0] === "strokeRect"), false);
});
