"use strict";
/*
 * Reader-level page-operation coverage. The page edits run through the real
 * pdf-lib engine and the bytes are saved before the real continuous reader
 * loads them. PDF.js is mocked only at the render boundary, so its page sizes
 * and rotation still come from those saved bytes.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { PDFDocument, StandardFonts, degrees } = require("../vendor/pdf-lib.js");
const history = require("../src/pdf-editor-history");

/** PDF.js stand-in: page order and page boxes are read from the saved bytes. */
obsidian.loadPdfJs = async () => ({
  getDocument({ data }) {
    const promise = PDFDocument.load(data).then((document) => ({
      numPages: document.getPageCount(),
      async getPage(number) {
        const page = document.getPage(number - 1);
        const size = page.getSize();
        const rotation = ((Math.round(page.getRotation().angle) % 360) + 360) % 360;
        return {
          async getTextContent() {
            return { items: [] };
          },
          getViewport({ scale }) {
            const swapped = rotation === 90 || rotation === 270;
            return {
              width: (swapped ? size.height : size.width) * scale,
              height: (swapped ? size.width : size.height) * scale,
              scale,
              transform: [1, 0, 0, 1, 0, 0],
            };
          },
          render() {
            return { promise: Promise.resolve() };
          },
        };
      },
      async destroy() {},
    }));
    return { promise };
  },
});

const { T, Plugin: QT } = load();
const editor = T.pdfEditor;
const pdf = T.pdfAnnotations;
const { PdfInkModal } = T.pdfInkModal;

function pngPage(width, height) {
  const bytes = Buffer.alloc(33);
  bytes[0] = 0x89;
  bytes[1] = 0x50;
  bytes[2] = 0x4e;
  bytes[3] = 0x47;
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

/** A canvas with enough 2D surface for the renderer and the annotation painter. */
function fakeCanvas() {
  const ctx = {
    ops: [],
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "round",
    lineJoin: "round",
    measureText: () => ({ width: 10 }),
  };
  for (const name of [
    "save", "restore", "beginPath", "closePath", "moveTo", "lineTo", "stroke", "fill",
    "rect", "strokeRect", "clearRect", "setTransform", "translate", "scale", "arc", "ellipse",
    "setLineDash",
  ]) ctx[name] = () => {};
  ctx.fillRect = () => ctx.ops.push("fillRect");

  const canvas = {
    width: 0,
    height: 0,
    ctx,
    getContext: () => ctx,
    toBlob(callback) {
      const bytes = pngPage(canvas.width, canvas.height);
      callback({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    },
  };
  return canvas;
}

global.activeDocument.createElement = () => fakeCanvas();

/** Four pages with distinct sizes and form fields on pages two and four. */
async function fixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sizes = [
    [400, 500],
    [401, 501],
    [402, 502],
    [403, 503],
  ];
  for (const [width, height] of sizes) {
    const page = doc.addPage([width, height]);
    page.drawText("page", { x: 30, y: height - 40, size: 12, font });
  }
  const form = doc.getForm();
  const grade = form.createDropdown("grade");
  grade.addOptions(["A", "B"]);
  grade.addToPage(doc.getPage(1), { x: 40, y: 400, width: 80, height: 18 });
  const note = form.createTextField("note");
  note.addToPage(doc.getPage(3), { x: 40, y: 400, width: 160, height: 18 });
  return doc.save();
}

function mark(page, note) {
  return {
    id: `ann-${page}`,
    page,
    type: "highlight",
    color: "green",
    note,
    quote: "",
    tags: [],
    areas: [{ x: 0.1, y: 0.2, width: 0.25, height: 0.02, color: "green", style: "highlight", note: "" }],
  };
}

function sidecar(pdfPath, bytes, annotations) {
  return pdf.serializeAnnotationFile(pdfPath, pdf.hashBytes(bytes), annotations);
}

async function vault(pdfPath, bytes, sidecarText) {
  const notes = [{ path: pdfPath, noFm: true, text: "" }];
  if (sidecarText) notes.push({ path: pdf.sidecarPathFor(pdfPath), noFm: true, text: sidecarText });
  const app = makeApp(notes);
  app.files.find((file) => file.path === pdfPath).buffer = bytes;
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

async function openReader(app, plugin, pdfPath) {
  const dom = makeDom();
  const modal = new PdfInkModal(app, plugin, { pdfPath, page: 1 });
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.render();
  await modal.loadDocument();
  return modal;
}

function view(modal) {
  const labels = modal.stageEl.__own.children
    .filter((child) => child.classes && child.classes.has("qt-pdf-ink-page-number"))
    .map((child) => child.meta.text);
  const pages = [...modal.pageWraps.entries()].map(([number, wrap]) => {
    const own = wrap.__own;
    const canvas = modal.pageCanvases.get(number);
    return {
      number,
      dataPage: own.meta.attrs && own.meta.attrs["data-page"],
      ariaLabel: own.meta.attrs && own.meta.attrs["aria-label"],
      imageAlt: own.children[0] && own.children[0].alt,
      width: canvas.width,
      height: canvas.height,
      form: modal.formLayers.has(number),
    };
  });
  return { labels, pages };
}

function layout(modal) {
  let top = 0;
  for (const [number, wrap] of modal.pageWraps) {
    const height = modal.pageCanvases.get(number).height;
    wrap.__own.offsetTop = top;
    wrap.__own.offsetHeight = height;
    top += height + 20;
  }
  modal.stageEl.clientHeight = 600;
  return modal;
}

function fieldPage(modal, name) {
  const field = modal.formFields.find((entry) => entry.name === name);
  return field ? field.page : -99;
}

test("pdf reader page ops: reorder moves the page wrapper and keeps overlays on their indices", async () => {
  const original = await fixture();
  const loaded = await editor.loadEditorDocument(original);
  assert.equal(editor.movePage(loaded.doc, 1, 0).ok, true, "page two moves to the front");
  const bytes = (await editor.savePdf(loaded.doc)).bytes;
  const { app, plugin } = await vault("Papers/Exam.pdf", bytes, sidecar("Papers/Exam.pdf", original, [mark(2, "page two mark")]));
  const modal = await openReader(app, plugin, "Papers/Exam.pdf");

  const rendered = view(modal);
  assert.equal(rendered.pages.length, 4);
  assert.deepEqual(rendered.pages.map((page) => page.number), [1, 2, 3, 4]);
  assert.deepEqual(rendered.labels, ["Page 1", "Page 2", "Page 3", "Page 4"]);
  assert.deepEqual(rendered.pages.map((page) => page.width), [642, 640, 644, 645], "the moved page is first in the rendered stack");
  assert.deepEqual(rendered.pages.map((page) => page.imageAlt), ["Page 1", "Page 2", "Page 3", "Page 4"]);
  assert.ok(rendered.pages.every((page) => page.dataPage === String(page.number)));

  assert.equal(fieldPage(modal, "grade"), 0, "the form field follows page two to page one");
  assert.equal(rendered.pages[0].form, true, "the form overlay is on the moved page");
  assert.equal(modal.pageAnnotations.get(2).markIds.highlight, "ann-2", "the page-two annotation stays on page two");
  assert.ok(modal.pageCanvases.get(2).__own.ctx.ops.includes("fillRect"), "the page-two annotation is painted on its own canvas");

  layout(modal);
  await modal.goToPage(2);
  assert.equal(modal.page, 2);
  assert.equal(modal.pageInputEl.value, "2");
  assert.equal(modal.pageTotalEl.__own.meta.text, "of 4");
  assert.equal(modal.stageEl.scrollTop, modal.pageWraps.get(2).__own.offsetTop, "the page jump scrolls the real page wrapper into view");

  modal.onClose();
});

test("pdf reader page ops: delete removes its wrapper and insert adds a blank page at its index", async () => {
  const original = await fixture();
  const loaded = await editor.loadEditorDocument(original);
  assert.equal(editor.deletePage(loaded.doc, 2).ok, true, "the third page is deleted");
  assert.equal(editor.addBlankPage(loaded.doc, 1, { width: 300, height: 300 }).ok, true, "a blank page is inserted second");
  const bytes = (await editor.savePdf(loaded.doc)).bytes;
  const { app, plugin } = await vault("Papers/Exam.pdf", bytes, sidecar("Papers/Exam.pdf", original, [mark(4, "page four mark")]));
  const modal = await openReader(app, plugin, "Papers/Exam.pdf");

  const rendered = view(modal);
  assert.equal(rendered.pages.length, 4);
  assert.deepEqual(rendered.pages.map((page) => page.width), [640, 480, 642, 645], "the removed page is absent and the blank appears second");
  assert.deepEqual(rendered.labels, ["Page 1", "Page 2", "Page 3", "Page 4"]);
  assert.equal(rendered.pages.some((page) => page.width === 644), false, "the 402-point page is gone");
  assert.equal(rendered.pages[1].number, 2, "the inserted page is second");
  assert.equal(rendered.pages[1].width, 480, "the inserted blank page is rendered at its index");

  assert.equal(fieldPage(modal, "grade"), 2, "the page-two field follows the insert to page three");
  assert.equal(fieldPage(modal, "note"), 3, "the page-four field stays on page four");
  assert.equal(rendered.pages[2].form, true, "the grade overlay is on page three");
  assert.equal(rendered.pages[3].form, true, "the note overlay is on page four");
  assert.equal(modal.pageAnnotations.get(4).markIds.highlight, "ann-4", "the page-four annotation keeps its index");
  assert.ok(modal.pageCanvases.get(4).__own.ctx.ops.includes("fillRect"), "the page-four annotation is painted on page four");

  modal.onClose();
});

test("pdf reader page ops: rotate swaps the rendered page dimensions and keeps its index", async () => {
  const original = await fixture();
  const loaded = await editor.loadEditorDocument(original);
  assert.equal(editor.rotatePage(loaded.doc, 1, 90).ok, true, "page two rotates");
  const bytes = (await editor.savePdf(loaded.doc)).bytes;
  const { app, plugin } = await vault("Papers/Exam.pdf", bytes, sidecar("Papers/Exam.pdf", original, [mark(2, "rotated page mark")]));
  const modal = await openReader(app, plugin, "Papers/Exam.pdf");

  const rendered = view(modal);
  assert.equal(rendered.pages.length, 4);
  assert.equal(rendered.pages[1].number, 2, "the rotated page stays second");
  assert.deepEqual(rendered.labels, ["Page 1", "Page 2", "Page 3", "Page 4"]);
  assert.deepEqual([rendered.pages[1].width, rendered.pages[1].height], [802, 642], "90 degrees swaps the displayed page dimensions");
  assert.equal(rendered.pages[1].dataPage, "2");
  assert.equal(fieldPage(modal, "grade"), 1, "the form field stays on page two");
  assert.equal(rendered.pages[1].form, true, "the form overlay stays on the rotated page");
  assert.equal(modal.pageAnnotations.get(2).markIds.highlight, "ann-2", "the annotation keeps its page index");
  assert.ok(modal.pageCanvases.get(2).__own.ctx.ops.includes("fillRect"));

  modal.onClose();
});

test("pdf reader page ops: extract opens only the selected pages in order", async () => {
  const original = await fixture();
  const loaded = await editor.loadEditorDocument(original);
  const extracted = await editor.extractPdfPages(loaded.doc, [1, 0]);
  assert.equal(extracted.ok, true);
  const { app, plugin } = await vault("Papers/Extract.pdf", extracted.bytes, sidecar("Papers/Extract.pdf", extracted.bytes, [mark(2, "extracted page mark")]));
  const modal = await openReader(app, plugin, "Papers/Extract.pdf");

  const rendered = view(modal);
  assert.equal(rendered.pages.length, 2);
  assert.deepEqual(rendered.labels, ["Page 1", "Page 2"]);
  assert.deepEqual(rendered.pages.map((page) => page.width), [640, 642], "the extracted stack contains the selected pages in engine order");
  assert.deepEqual(rendered.pages.map((page) => page.number), [1, 2]);
  assert.equal(modal.pageAnnotations.get(2).markIds.highlight, "ann-2", "the extracted page keeps its annotation index");
  assert.ok(modal.pageCanvases.get(2).__own.ctx.ops.includes("fillRect"));
  assert.equal(modal.total, 2);

  modal.onClose();
});

test("pdf reader page ops: merge inserts the other document's pages and shifts form overlays", async () => {
  const original = await fixture();
  const loaded = await editor.loadEditorDocument(original);
  const other = await PDFDocument.create();
  other.addPage([200, 200]);
  other.addPage([201, 201]);
  const merged = await editor.insertPdfPages(loaded.doc, await other.save(), 1);
  assert.equal(merged.ok, true);
  const bytes = (await editor.savePdf(loaded.doc)).bytes;
  const { app, plugin } = await vault("Papers/Exam.pdf", bytes, sidecar("Papers/Exam.pdf", bytes, [mark(4, "merged page mark")]));
  const modal = await openReader(app, plugin, "Papers/Exam.pdf");

  const rendered = view(modal);
  assert.equal(rendered.pages.length, 6);
  assert.deepEqual(rendered.labels, ["Page 1", "Page 2", "Page 3", "Page 4", "Page 5", "Page 6"]);
  assert.deepEqual(rendered.pages.map((page) => page.width), [640, 320, 322, 642, 644, 645], "the merged pages appear at the requested index");
  assert.equal(fieldPage(modal, "grade"), 3, "the grade field moves to page four after the merge");
  assert.equal(fieldPage(modal, "note"), 5, "the note field moves to page six after the merge");
  assert.equal(rendered.pages[3].form, true);
  assert.equal(rendered.pages[5].form, true);
  assert.equal(modal.pageAnnotations.get(4).markIds.highlight, "ann-4", "the merged page keeps its annotation index");
  assert.ok(modal.pageCanvases.get(4).__own.ctx.ops.includes("fillRect"));
  assert.equal(modal.total, 6);

  modal.onClose();
});

test("pdf reader page ops: undo and redo rebuild the scroll stack from their real bytes", async () => {
  const original = await fixture();
  const loaded = await editor.loadEditorDocument(original);
  assert.equal(editor.movePage(loaded.doc, 0, 3).ok, true, "page one moves to the end");
  const moved = (await editor.savePdf(loaded.doc)).bytes;
  const initial = history.createHistory(original, {});
  const edited = history.recordEdit(initial, "move page 1", moved, {});
  const undo = history.undoStep(edited);
  assert.equal(undo.ok, true);
  const redo = history.redoStep(undo.history);
  assert.equal(redo.ok, true);

  const beforeVault = await vault("Papers/Exam.pdf", undo.entry.bytes, sidecar("Papers/Exam.pdf", undo.entry.bytes, [mark(2, "undo mark")]));
  const before = await openReader(beforeVault.app, beforeVault.plugin, "Papers/Exam.pdf");
  assert.deepEqual(view(before).pages.map((page) => page.width), [640, 642, 644, 645], "undo restores the original stack order");
  assert.deepEqual(view(before).labels, ["Page 1", "Page 2", "Page 3", "Page 4"]);
  assert.equal(before.pageAnnotations.get(2).markIds.highlight, "ann-2");
  assert.equal(before.total, 4);
  before.onClose();

  const afterVault = await vault("Papers/Exam.pdf", redo.entry.bytes, sidecar("Papers/Exam.pdf", redo.entry.bytes, [mark(2, "redo mark")]));
  const after = await openReader(afterVault.app, afterVault.plugin, "Papers/Exam.pdf");
  assert.deepEqual(view(after).pages.map((page) => page.width), [642, 644, 645, 640], "redo restores the moved stack order");
  assert.deepEqual(view(after).labels, ["Page 1", "Page 2", "Page 3", "Page 4"]);
  assert.equal(after.pageAnnotations.get(2).markIds.highlight, "ann-2");
  assert.equal(after.total, 4);
  after.onClose();
});
