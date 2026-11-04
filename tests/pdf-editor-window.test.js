"use strict";
/*
 * Drives the shipped PDF editor, not just the engine: the window is opened
 * against a real PDF sitting in the mocked vault, its own methods perform the
 * edit, and the bytes that reach `vault.createBinary` are read back with
 * pdf-lib. The bundle under test is `main.js`, so this also proves the vendored
 * engine resolves through the same `require("../vendor/pdf-lib.js")` route the
 * installed plugin uses.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const { load } = require("./helpers/load");
const { T, Plugin: QT, obsidian } = load();
const { makeApp, makeDom } = require("./helpers/fake");
const zlib = require("node:zlib");
const { PDFDocument, PDFName, PDFString, StandardFonts } = require("../vendor/pdf-lib.js");
const vendorCheck = require("../scripts/check-vendor");

const editor = T.pdfEditor;
const modalApi = T.pdfEditorModal;

/** Four pages of different sizes and three fillable fields, on pages 1 and 2. */
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
  const student = form.createTextField("student");
  student.addToPage(doc.getPage(0), { x: 40, y: 400, width: 200, height: 20 });
  const agree = form.createCheckBox("agree");
  agree.addToPage(doc.getPage(0), { x: 40, y: 360, width: 14, height: 14 });
  const grade = form.createDropdown("grade");
  grade.addOptions(["A", "B"]);
  grade.addToPage(doc.getPage(1), { x: 40, y: 320, width: 80, height: 18 });
  return doc.save();
}

const SIDECAR = `---
pdf_annotations: true
pdf_path: "Papers/Exam.pdf"
pdf_hash: "abc"
---

# PDF annotations — Exam.pdf

## Data

\`\`\`mcq-pdf-annotations
${JSON.stringify({
  version: 1,
  pdf_path: "Papers/Exam.pdf",
  pdf_hash: "abc",
  annotations: [
    {
      id: "ann-1",
      page: 1,
      type: "highlight",
      color: "yellow",
      quote: "ATP is energy",
      note: "",
      text: "",
      tags: [],
      createdAt: "2026-11-04T00:00:00.000Z",
      areas: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.02, color: "yellow", style: "highlight", note: "" }],
    },
  ],
}, null, 2)}
\`\`\`
`;

/** Clicks a button by its label and waits for the handler it runs. */
async function clickButton(dom, label) {
  const button = dom.all
    .filter((entry) => entry.meta && entry.meta.tag === "button" && entry.meta.text === label)
    .pop();
  assert.ok(button, `no button labelled ${label}`);
  const handlers = button.handlers.filter((entry) => entry.ev === "click");
  assert.ok(handlers.length, `the ${label} button has no handler`);
  for (const handler of handlers) await handler.fn({});
}

/** A real one-colour PNG, at whatever size the test needs. */
function tinyPng(width, height, rgb) {
  const crc32 = (buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = rgb[0];
    row[2 + x * 3] = rgb[1];
    row[3 + x * 3] = rgb[2];
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function vault(notes) {
  const bytes = await fixture();
  const app = makeApp(notes || [
    { path: "Papers/Exam.pdf", noFm: true, text: "" },
    { path: "Papers/Exam.annotations.md", noFm: true, text: SIDECAR },
    { path: "Notes/Lecture.md", noFm: true, text: "# Lecture\n" },
  ]);
  app.files.find((file) => file.path === "Papers/Exam.pdf").buffer = bytes;
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin, bytes };
}

/** Constructs the real modal on a mocked DOM, exactly as Obsidian's Modal would. */
function openEditor(app, plugin, pdfPath) {
  const dom = makeDom();
  const modal = new modalApi.PdfEditorModal(app, plugin, { pdfPath });
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.onOpen();
  return Object.assign(modal, { dom });
}

/** Nodes that are still attached: the fake DOM keeps every element it ever made. */
function liveNodes(node, out) {
  const list = out || [];
  list.push(node);
  for (const child of node.children || []) liveNodes(child, list);
  return list;
}

function fireOwn(own, event, payload) {
  const handlers = own.handlers.filter((entry) => entry.ev === event);
  return Promise.all(handlers.map((handler) => handler.fn(payload || {})));
}

/** Clicks the newest element whose text matches, and waits for its handler. */
async function clickMatching(dom, pattern) {
  const hits = dom.all.filter(
    (entry) => entry.meta && typeof entry.meta.text === "string" && pattern.test(entry.meta.text) && entry.handlers.some((handler) => handler.ev === "click"),
  );
  const hit = hits.pop();
  assert.ok(hit, `no clickable element matching ${pattern}`);
  for (const handler of hit.handlers.filter((entry) => entry.ev === "click")) await handler.fn({});
}

/** Clicks the newest element carrying that aria-label (page buttons use one). */
async function clickLabeled(dom, label) {
  const hits = dom.all.filter((entry) => {
    if (!entry.meta || !entry.handlers.some((handler) => handler.ev === "click")) return false;
    const attrs = entry.meta.attrs || {};
    const raw = entry.meta.attr || {};
    return attrs["aria-label"] === label || raw["aria-label"] === label;
  });
  const hit = hits.pop();
  assert.ok(hit, `no clickable element labelled ${label}`);
  for (const handler of hit.handlers.filter((entry) => entry.ev === "click")) await handler.fn({});
}

/** Sends one key event to the window and waits for the handler it runs. */
async function fireKey(root, event) {
  const handlers = root.handlers.filter((entry) => entry.ev === "keydown");
  assert.ok(handlers.length, "the window listens for keys");
  for (const handler of handlers) await handler.fn(event);
}

/** The checkbox inside the footer label whose text matches. */
function checkboxFor(dom, text) {
  const span = dom.all.find((entry) => entry.meta && typeof entry.meta.text === "string" && text.test(entry.meta.text));
  assert.ok(span, `no footer option matching ${text}`);
  const label = span.parent;
  const box = (label.children || []).find((entry) => entry.meta.tag === "input" && entry.meta.type === "checkbox");
  assert.ok(box, `no checkbox for ${text}`);
  return box;
}

function statusText(modal) {
  return modal.statusEl && modal.statusEl.__own && typeof modal.statusEl.__own.meta.text === "string" ? modal.statusEl.__own.meta.text : "";
}

test("pdf editor window: opens a real PDF from the mocked vault and builds its cards and fields", async () => {
  const { app, plugin } = await vault();
  const before = obsidian.notices.length;
  const rejections = [];
  const onRejection = (reason) => rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  try {
    await modal.loading;
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(modal.doc.getPageCount(), 4, "the document really loaded");
    assert.deepEqual(modal.originOrder, [1, 2, 3, 4]);
    assert.deepEqual(modal.fields.map((field) => [field.name, field.kind]), [
      ["student", "text"],
      ["agree", "checkbox"],
      ["grade", "dropdown"],
    ]);

    const cards = liveNodes(modal.listEl.__own);
    assert.equal(cards.filter((node) => node.classes.has("qt-pdf-editor-page")).length, 4, "one card per page");
    const rows = liveNodes(modal.fieldsEl.__own);
    assert.equal(rows.filter((node) => node.classes.has("qt-pdf-editor-field")).length, 3, "every form field is rendered once");

    const texts = modal.dom.texts();
    for (const expected of ["Page 1", "Page 4", "Form fields", "student", "agree", "grade", "Save a copy", "Burn 1 annotation into the copy"]) {
      assert.ok(texts.includes(expected) || texts.some((text) => text === expected), `the window shows ${expected}`);
    }
    assert.match(statusText(modal), /4 pages, 3 form fields/);
    assert.match(statusText(modal), /never|unchanged|still|not written|stay/i);

    const notices = obsidian.notices.slice(before);
    assert.deepEqual(notices.filter((message) => /could not|is not a function|no such|undefined/i.test(message)), [], "no swallowed error reached a Notice");
    assert.deepEqual(rejections, [], "opening the window left no unhandled rejection");
    modal.close();
  } finally {
    process.off("unhandledRejection", onRejection);
  }
});

test("pdf editor window: duplicate creates live fields and reorder keeps them live", async () => {
  const { app, plugin } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  assert.equal(modal.fields.length, 3, "the fixture opens with three live fields");

  await clickLabeled(modal.dom, "Duplicate page 1");
  assert.match(statusText(modal), /Page 1 was duplicated\. Its live fields were copied with unique names; the source form stays untouched\./);
  assert.equal(modal.doc.getPageCount(), 5);
  assert.equal(modal.fields.length, 5, "the duplicate adds two live fields and keeps the source form");
  assert.deepEqual(modal.fields.map((field) => field.name), ["student", "agree", "grade", "student_2", "agree_2"]);
  assert.equal(modal.fields.find((field) => field.name === "student").page, 0);
  assert.equal(modal.fields.find((field) => field.name === "agree").page, 0);
  assert.equal(modal.fields.find((field) => field.name === "student_2").page, 1);
  assert.equal(modal.fields.find((field) => field.name === "agree_2").page, 1);
  assert.equal(modal.fields.find((field) => field.name === "grade").page, 2);

  await clickLabeled(modal.dom, "Move page 2 later");
  assert.match(statusText(modal), /Moved page 2 to position 3\. The live form stays fillable and its values move with the page\./);
  assert.equal(modal.fields.find((field) => field.name === "grade").page, 1, "the live field follows its moved page");
  assert.equal(modal.fields.find((field) => field.name === "student_2").page, 2, "the duplicated live field follows its page");
  assert.equal(modal.fields.find((field) => field.name === "agree_2").page, 2, "the second duplicated live field follows its page");
  assert.equal(modal.doc.getForm().getFields().length, 5, "reordering did not flatten or copy the form");
  assert.deepEqual(app.createdBinary || [], [], "neither operation writes before Save");
  modal.close();
});

test("pdf editor window: rotate, move, fill and burn, then save a valid copy and never overwrite", async () => {
  const { app, plugin, bytes } = await vault();
  const pdfFile = app.files.find((file) => file.path === "Papers/Exam.pdf");
  const before = obsidian.notices.length;
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;

  // rotate the first page, then move it to the third position
  await modal.rotate(0, 90);
  assert.equal(modal.pages[0].rotation, 90, "the card follows the rotation");
  await modal.reorder(0, 2);
  assert.deepEqual(modal.originOrder, [2, 3, 1, 4], "the page map follows the move");
  assert.deepEqual(modal.pages.map((page) => page.width), [401, 402, 400, 403], "the cards follow the move");
  assert.equal(modal.fields.find((field) => field.name === "student").page, 2, "the form field page label follows the move");
  assert.equal(modal.fields.find((field) => field.name === "grade").page, 0, "the other field page label follows the move");

  // fill a discovered text field through its rendered input
  const input = modal.dom.all.find((entry) => entry.meta.tag === "input" && entry.meta.type === "text" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "student");
  assert.ok(input, "the text field is rendered");
  input.value = "Ada Lovelace";
  await fireOwn(input, "change");
  assert.equal(modal.fields.find((field) => field.name === "student").value, "Ada Lovelace", "the field value follows the input");

  // and the dropdown on the other page
  const select = modal.dom.all.find((entry) => entry.meta.tag === "select" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "grade");
  assert.ok(select, "the dropdown is rendered");
  select.value = "B";
  await fireOwn(select, "change");
  assert.equal(modal.fields.find((field) => field.name === "grade").value, "B");

  // toggle both footer options through their real change handlers, ending where the save needs them
  const burn = checkboxFor(modal.dom, /Burn 1 annotation into the copy/);
  burn.checked = false;
  fireOwn(burn, "change");
  assert.equal(modal.flattenMarks, false, "the burn option is wired");
  burn.checked = true;
  fireOwn(burn, "change");
  assert.equal(modal.flattenMarks, true);

  const flatten = checkboxFor(modal.dom, /Flatten the form/);
  flatten.checked = true;
  fireOwn(flatten, "change");
  assert.equal(modal.flattenFields, true, "the flatten option is wired");
  flatten.checked = false;
  fireOwn(flatten, "change");
  assert.equal(modal.flattenFields, false);

  await modal.saveCopy();

  assert.equal(app.createdBinary.length, 1, "one file was written");
  const written = app.createdBinary[0];
  assert.equal(written.path, "Papers/Exam (edited).pdf");
  assert.ok(written.buffer instanceof Uint8Array && written.buffer.length > 0);

  const reopened = await PDFDocument.load(written.buffer);
  assert.equal(reopened.getPageCount(), 4, "the copy keeps four pages");
  assert.deepEqual(
    reopened.getPages().map((page) => [Math.round(page.getSize().width), Math.round(page.getSize().height)]),
    [
      [401, 501],
      [402, 502],
      [400, 500],
      [403, 503],
    ],
    "the moved page is really in its new position",
  );
  assert.equal(reopened.getPages()[2].getRotation().angle, 90, "the rotation survived the save");
  assert.equal(reopened.getForm().getTextField("student").getText(), "Ada Lovelace", "the text field value survived the save");
  assert.deepEqual(reopened.getForm().getDropdown("grade").getSelected(), ["B"], "the dropdown value survived the save");

  assert.equal(modal.flattenMarks, false, "the burn is consumed by the save");
  assert.deepEqual(modal.annotations, [], "annotations are not burned twice");
  assert.ok(obsidian.notices.slice(before).some((message) => message.includes("Saved Papers/Exam (edited).pdf")), "the save is announced");
  assert.deepEqual(
    obsidian.notices.slice(before).filter((message) => /could not|failed|is not a function/i.test(message)),
    [],
    "the save reported no failure",
  );

  assert.equal(pdfFile.buffer, bytes, "the source PDF was not rewritten");
  assert.equal(app.createdBinary.some((entry) => entry.path === "Papers/Exam.pdf"), false);
  assert.equal(app.modified, undefined, "no note or PDF was modified in place");

  // a second run proposes the next name instead of overwriting the first copy
  const again = openEditor(app, plugin, "Papers/Exam.pdf");
  await again.loading;
  await again.saveCopy();
  assert.equal(app.createdBinary.length, 2);
  assert.equal(app.createdBinary[1].path, "Papers/Exam (edited 2).pdf", "a second save never overwrites the first copy");
  assert.notEqual(Buffer.compare(Buffer.from(app.createdBinary[0].path), Buffer.from(app.createdBinary[1].path)), 0);
});

test("pdf editor window: adding another PDF's pages and extracting pages works through the window", async () => {
  const { app, plugin } = await vault();
  const other = await PDFDocument.create();
  other.addPage([200, 200]);
  other.addPage([201, 201]);
  const otherFile = app.files.find((file) => file.path === "Notes/Lecture.md");
  otherFile.path = "Papers/Handout.pdf";
  otherFile.buffer = await other.save();

  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  await modal.appendFrom(otherFile);
  assert.equal(modal.pages.length, 6, "two pages were appended");
  assert.deepEqual(modal.originOrder.slice(-2), [0, 0], "appended pages have no original page to map annotations to");

  modal.selection = new Set([0, 5]);
  await modal.extractSelected();
  const extracted = app.createdBinary.find((entry) => entry.path === "Papers/Exam (extract).pdf");
  assert.ok(extracted, "the selected pages were written to their own file");
  const reopened = await PDFDocument.load(extracted.buffer);
  assert.equal(reopened.getPageCount(), 2);
  assert.equal(Math.round(reopened.getPages()[0].getSize().width), 400);
  assert.equal(Math.round(reopened.getPages()[1].getSize().width), 201);
  modal.close();
});

test("pdf editor window: adding a form PDF keeps its fields live and says so", async () => {
  const { app, plugin } = await vault();
  const sourceBytes = await fixture();
  const source = await PDFDocument.load(sourceBytes);
  source.getForm().getTextField("student").setText("keep me");
  const otherFile = app.files.find((file) => file.path === "Notes/Lecture.md");
  otherFile.path = "Papers/Handout.pdf";
  otherFile.buffer = await source.save();

  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  await modal.appendFrom(otherFile);
  assert.equal(modal.pages.length, 8, "four pages were appended");
  assert.equal(modal.fields.length, 6, "the three source fields were cloned beside the three target fields");
  assert.deepEqual(modal.fields.map((field) => field.name), ["student", "agree", "grade", "student_2", "agree_2", "grade_2"]);
  assert.equal(modal.fields.find((field) => field.name === "student_2").page, 4);
  assert.equal(modal.fields.find((field) => field.name === "grade_2").page, 5);
  assert.equal(modal.fields.find((field) => field.name === "student_2").value, "keep me");
  assert.match(statusText(modal), /Added 4 pages \(3 live form fields copied\) from Papers\/Handout\.pdf\./);
  assert.deepEqual(app.createdBinary || [], [], "the merge writes nothing before Save");
  modal.close();
});

test("pdf editor: the command and the reader hand-over reach the window, and refuse a non-PDF", async () => {
  const { app, plugin } = await vault();
  const command = plugin.commands.find((entry) => entry.id === "pdf-edit");
  assert.ok(command, "the editor command is registered");
  assert.match(command.name, /PDF: open the editor/);

  obsidian.modals.length = 0;
  app.workspace.getActiveFile = () => app.files.find((file) => file.path === "Notes/Lecture.md");
  assert.doesNotThrow(() => command.callback(), "a non-PDF active file must not throw");
  assert.equal(obsidian.modals.length, 0, "a non-PDF active file opens no editor");
  assert.match(obsidian.notices[obsidian.notices.length - 1], /Open a PDF first/);

  app.workspace.getActiveFile = () => null;
  assert.doesNotThrow(() => command.callback());
  assert.equal(obsidian.modals.length, 0);
  assert.match(obsidian.notices[obsidian.notices.length - 1], /Open a PDF first/);

  app.workspace.getActiveFile = () => app.files.find((file) => file.path === "Papers/Exam.pdf");
  obsidian.notices.length = 0;
  assert.doesNotThrow(() => command.callback(), "the command must open the editor");
  assert.equal(obsidian.modals.length, 1, "one editor window was opened");
  assert.equal(obsidian.modals[0].constructor.name, "PdfEditorModal");
  assert.equal(obsidian.modals[0].pdfPath, "Papers/Exam.pdf", "the command hands over the active PDF");
  assert.equal(obsidian.modals[0].closed, false);

  // the reader's hand-over saves unsaved marks first, then opens the editor
  const reader = new T.pdfInkModal.PdfInkModal(app, plugin, { pdfPath: "Papers/Exam.pdf", page: 1 });
  const dom = makeDom();
  reader.modalEl = dom.root;
  reader.contentEl = dom.root;
  const calls = [];
  reader.save = async () => {
    calls.push("save");
    reader.dirty = false;
    return true;
  };
  const opened = [];
  const original = plugin.openPdfEditor;
  plugin.openPdfEditor = (pdfPath) => opened.push(pdfPath);
  try {
    reader.dirty = true;
    await reader.openEditor();
    assert.deepEqual(calls, ["save"], "unsaved marks are flushed before handing over");
    assert.deepEqual(opened, ["Papers/Exam.pdf"], "the reader hands over its own PDF");
    assert.equal(reader.closed, true, "the reader closes after handing over");

    calls.length = 0;
    opened.length = 0;
    reader.dirty = false;
    await reader.openEditor();
    assert.deepEqual(calls, [], "a clean reader does not save again");
    assert.deepEqual(opened, ["Papers/Exam.pdf"]);
  } finally {
    plugin.openPdfEditor = original;
  }
});

test("pdf editor: the engine loads through the vendored path the shipped bundle uses", async () => {
  assert.ok(editor, "main.js exports the editor module");
  assert.equal(typeof editor.loadEditorDocument, "function");

  const bundle = fs.readFileSync(path.join(root, "main.js"), "utf8");
  assert.ok(bundle.includes('__defs["vendor/pdf-lib"]'), "the built bundle contains the vendored engine");
  assert.match(fs.readFileSync(path.join(root, "src", "pdf-editor.js"), "utf8"), /require\("\.\.\/vendor\/pdf-lib\.js"\)/);

  const check = vendorCheck.verify();
  assert.deepEqual(check.problems, [], "the vendored engine is present and unmodified");
  assert.equal(check.ok, true);
  assert.equal(check.bytes, 525099);

  // and the bundled copy really parses, edits and writes a PDF
  const loaded = await editor.loadEditorDocument(await fixture());
  assert.equal(loaded.ok, true);
  assert.equal(loaded.pageCount, 4);
  assert.deepEqual(editor.formFields(loaded.doc).fields.map((field) => field.name), ["student", "agree", "grade"]);
  const saved = await editor.savePdf(loaded.doc);
  assert.equal(saved.ok, true);
  const reopened = await PDFDocument.load(saved.bytes);
  assert.equal(reopened.getPageCount(), 4);
});

test("pdf editor window: a broken PDF is reported in the window, not thrown", async () => {
  const { app, plugin } = await vault();
  const pdfFile = app.files.find((file) => file.path === "Papers/Exam.pdf");
  pdfFile.buffer = new TextEncoder().encode("%PDF-1.7 truncated");
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  assert.match(statusText(modal), /could not be opened|damaged/i);
  assert.equal(modal.doc, null);
  assert.equal(modal.pages.length, 0);
  assert.equal(app.createdBinary, undefined);
  modal.close();
});

test("pdf editor window: typed text, an image, a crop and page numbers reach the saved copy", async () => {
  const { app, plugin } = await vault();
  const png = tinyPng(6, 6, [255, 128, 0]);
  app.files.push({ path: "Assets/dot.png", name: "dot.png", basename: "dot", extension: "png", buffer: png, text: "" });
  const before = obsidian.notices.length;
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;

  assert.equal(modal.contentHost !== null, true, "the add-content section exists");
  const texts = modal.dom.texts();
  for (const expected of ["Add content", "Add text", "Add image…", "Place image", "Crop all pages", "Add page numbers"]) {
    assert.ok(texts.includes(expected), `the window offers ${expected}`);
  }

  // type text and add it to every page
  const textArea = modal.dom.all.find((entry) => entry.meta.tag === "textarea" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Text to add");
  assert.ok(textArea, "the text box is rendered");
  textArea.value = "Name: Ada";
  fireOwn(textArea, "change");
  assert.equal(modal.content.text, "Name: Ada", "the typed text is kept");
  await clickButton(modal.dom, "Add text");
  assert.match(statusText(modal), /Added 4 lines of text to 4 pages/);

  // place the PNG from the vault on the first page only
  modal.content.image = app.files.find((file) => file.path === "Assets/dot.png");
  modal.content.imagePage = "0";
  modal.content.imageWidth = "20";
  await clickButton(modal.dom, "Place image");
  assert.match(statusText(modal), /Placed the image on 1 page/);

  // crop every page by 18 points
  for (const side of ["top", "right", "bottom", "left"]) {
    const field = modal.dom.all.find((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === `Crop margin ${side}`);
    assert.ok(field, `the ${side} crop margin is rendered`);
    field.value = "18";
    fireOwn(field, "change");
  }
  assert.deepEqual([modal.content.cropTop, modal.content.cropRight, modal.content.cropBottom, modal.content.cropLeft], ["18", "18", "18", "18"]);
  await clickButton(modal.dom, "Crop all pages");
  assert.match(statusText(modal), /Cropped 4 pages/);

  // number the pages with the default format
  await clickButton(modal.dom, "Add page numbers");
  assert.match(statusText(modal), /Numbered 4 pages/);

  const sourceBefore = Uint8Array.from(app.files.find((file) => file.path === "Papers/Exam.pdf").buffer);

  await modal.saveCopy();
  const written = app.createdBinary[0];
  assert.ok(written, "a copy was written");
  assert.equal(written.path, "Papers/Exam (edited).pdf", "the source path is never reused");
  assert.deepEqual(app.files.find((file) => file.path === "Papers/Exam.pdf").buffer, sourceBefore, "the source PDF is byte-for-byte unchanged");

  const reopened = await PDFDocument.load(written.buffer);
  assert.equal(reopened.getPageCount(), 4);
  assert.deepEqual(reopened.getPage(0).getCropBox(), { x: 18, y: 18, width: 364, height: 464 });
  assert.deepEqual(reopened.getPage(3).getCropBox(), { x: 18, y: 18, width: 367, height: 467 });
  assert.deepEqual(reopened.getPage(0).getMediaBox(), { x: 0, y: 0, width: 400, height: 500 });

  const notices = obsidian.notices.slice(before);
  assert.deepEqual(notices.filter((message) => /could not|is not a function|no such|undefined/i.test(message)), [], "no swallowed error reached a Notice");
  modal.close();
});

test("pdf editor window: a mixed edit stack undoes to the opened bytes and redo restores the edit", async () => {
  const { app, plugin, bytes } = await vault();
  const png = tinyPng(6, 6, [0, 160, 255]);
  app.files.push({ path: "Assets/dot.png", name: "dot.png", basename: "dot", extension: "png", buffer: png, text: "" });
  const before = obsidian.notices.length;
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  const original = Uint8Array.from(bytes);
  assert.equal(modal.undoButton.disabled, true, "undo starts unavailable");
  assert.equal(modal.redoButton.disabled, true, "redo starts unavailable");

  // 1. a mark: the annotation tool, as an ordinary undoable edit
  await clickMatching(modal.dom, /^Burn annotations into the pages$/);
  assert.match(statusText(modal), /Burned 1 annotation item into 1 page/);

  // 2. a form field through its rendered input
  const student = modal.dom.all.find((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "student");
  assert.ok(student, "the text field is rendered");
  student.value = "Ada Lovelace";
  await fireOwn(student, "change");
  assert.equal(modal.fields.find((field) => field.name === "student").value, "Ada Lovelace");

  // 3. a page op through its own button
  await clickLabeled(modal.dom, "Rotate page 1 clockwise");
  assert.equal(modal.pages[0].rotation, 90);

  // 4. page numbers
  await clickMatching(modal.dom, /^Add page numbers$/);
  assert.match(statusText(modal), /Numbered 4 pages/);

  // 5. a crop
  for (const side of ["top", "right", "bottom", "left"]) {
    const field = modal.dom.all.find((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === `Crop margin ${side}`);
    assert.ok(field, `the ${side} crop margin is rendered`);
    field.value = "18";
    await fireOwn(field, "change");
  }
  await clickMatching(modal.dom, /^Crop all pages$/);
  assert.match(statusText(modal), /Cropped 4 pages/);

  // 6. a placed image
  modal.content.image = app.files.find((file) => file.path === "Assets/dot.png");
  modal.content.imagePage = "1"; // page 1 is rotated above; the engine refuses images there
  await clickMatching(modal.dom, /^Place image$/);
  assert.match(statusText(modal), /Placed the image on 1 page/);

  assert.deepEqual(app.createdBinary || [], [], "nothing reached the vault before Save");
  const edited = Uint8Array.from(modal.bytes);
  assert.notDeepEqual(Array.from(edited), Array.from(original), "the edits changed the document");
  assert.equal(modal.canUndo(), true);
  assert.equal(modal.canRedo(), false);
  assert.equal(modal.undoButton.getAttribute("aria-label"), "Undo place an image", "the control names the action");

  // undo everything through the rendered control
  let guard = 0;
  while (modal.canUndo() && guard < 20) {
    await clickMatching(modal.dom, /^Undo /);
    guard++;
  }
  assert.equal(guard, 6, "one undo per action");
  assert.deepEqual(Array.from(modal.bytes), Array.from(original), "full undo returns the opened bytes");
  assert.equal(modal.undoButton.disabled, true, "undo is unavailable at the opened file");
  assert.equal(modal.redoButton.disabled, false);
  assert.equal(modal.doc.getPageCount(), 4);
  assert.equal(modal.doc.getPage(0).getRotation().angle, 0);
  assert.deepEqual(modal.doc.getPage(0).getCropBox(), { x: 0, y: 0, width: 400, height: 500 });
  assert.deepEqual(modal.originOrder, [1, 2, 3, 4]);
  assert.equal(modal.fields.find((field) => field.name === "student").value, "");
  assert.deepEqual(app.createdBinary || [], [], "undo wrote nothing to the vault");

  // redo everything
  let redone = 0;
  while (modal.canRedo() && redone < 20) {
    await clickMatching(modal.dom, /^Redo /);
    redone++;
  }
  assert.equal(redone, 6, "one redo per action");
  assert.deepEqual(Array.from(modal.bytes), Array.from(edited), "redo restores the edited bytes");
  assert.deepEqual(modal.doc.getPage(0).getCropBox(), { x: 18, y: 18, width: 364, height: 464 });
  assert.equal(modal.doc.getPage(0).getRotation().angle, 90);
  assert.equal(modal.fields.find((field) => field.name === "student").value, "Ada Lovelace");
  assert.deepEqual(app.createdBinary || [], [], "redo wrote nothing to the vault");

  const notices = obsidian.notices.slice(before);
  assert.deepEqual(notices.filter((message) => /could not|is not a function|no such|undefined/i.test(message)), [], "no swallowed error reached a Notice");
  modal.close();
});

test("pdf editor window: a new edit after two undos discards the redo tail", async () => {
  const { app, plugin, bytes } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  const original = Uint8Array.from(bytes);

  await clickLabeled(modal.dom, "Rotate page 1 clockwise");
  await clickMatching(modal.dom, /^Add page numbers$/);
  assert.equal(modal.history.states.length, 3, "the opened file and two edits");

  await clickMatching(modal.dom, /^Undo add page numbers$/);
  await clickMatching(modal.dom, /^Undo rotate page 1$/);
  assert.equal(modal.canUndo(), false);
  assert.equal(modal.canRedo(), true);
  assert.deepEqual(Array.from(modal.bytes), Array.from(original));

  // a brand-new edit while redo is available
  await clickMatching(modal.dom, /^Add blank page$/);
  assert.equal(modal.doc.getPageCount(), 5);
  assert.equal(modal.canRedo(), false, "the redo tail is gone");
  assert.equal(modal.redoButton.disabled, true);
  assert.equal(modal.redoButton.getAttribute("aria-label"), "Nothing to redo");
  assert.equal(modal.history.states.length, 2, "the opened file and the new edit");

  await clickMatching(modal.dom, /^Undo add a blank page$/);
  assert.deepEqual(Array.from(modal.bytes), Array.from(original), "undo reaches the opened bytes, not the discarded tail");
  assert.equal(modal.doc.getPageCount(), 4);
  assert.equal(modal.canRedo(), true);
  modal.close();
});

test("pdf editor window: saving clears the history so undo cannot contradict the copy", async () => {
  const { app, plugin } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  await clickLabeled(modal.dom, "Rotate page 1 clockwise");
  await clickLabeled(modal.dom, "Rotate page 2 clockwise");
  assert.equal(modal.canUndo(), true);
  assert.equal(modal.history.states.length, 3);

  await modal.saveCopy();
  assert.equal(app.createdBinary.length, 1, "the copy was written");
  assert.equal(modal.canUndo(), false, "the saved copy cannot be undone past");
  assert.equal(modal.canRedo(), false);
  assert.equal(modal.history.states.length, 1);
  assert.equal(modal.history.states[0].label, "Saved copy");
  assert.equal(modal.undoButton.disabled, true);
  assert.equal(statusText(modal).length > 0, true, "the window still reports its state");
  modal.close();
});

test("pdf editor window: Cmd/Ctrl+Z and Shift+Z undo and redo from the keyboard", async () => {
  const { app, plugin, bytes } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  const original = Uint8Array.from(bytes);

  await clickLabeled(modal.dom, "Rotate page 1 clockwise");
  await clickMatching(modal.dom, /^Add page numbers$/);
  const edited = Uint8Array.from(modal.bytes);
  const root = modal.dom.root.__own;

  await fireKey(root, { key: "z", ctrlKey: true });
  await fireKey(root, { key: "z", ctrlKey: true });
  assert.deepEqual(Array.from(modal.bytes), Array.from(original), "two Ctrl+Z reach the opened bytes");

  await fireKey(root, { key: "z", ctrlKey: true, shiftKey: true });
  await fireKey(root, { key: "z", ctrlKey: true, shiftKey: true });
  assert.deepEqual(Array.from(modal.bytes), Array.from(edited), "two Shift+Ctrl+Z restore the edits");

  // Cmd (macOS) and Ctrl+Y take the same path, and plain typing keys are left alone
  await fireKey(root, { key: "y", metaKey: true });
  assert.equal(modal.canRedo(), false, "there was nothing left to redo");
  await fireKey(root, { key: "z" });
  await fireKey(root, { key: "z", ctrlKey: true, altKey: true });
  assert.deepEqual(Array.from(modal.bytes), Array.from(edited), "unmodified keys change nothing");
  modal.close();
});

test("pdf editor window: an edit accepted just before Save is written, not dropped", async () => {
  const { app, plugin } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;

  const edit = modal.rotate(0, 90); // accepted, deliberately not awaited
  await modal.saveCopy(); // has to drain the queued edit before it writes
  await edit;

  assert.equal(app.createdBinary.length, 1, "the copy was written");
  const copy = await PDFDocument.load(app.createdBinary[0].buffer);
  assert.equal(copy.getPage(0).getRotation().angle, 90, "the accepted edit reached the copy");
  assert.equal(modal.history.states.length, 1);
  assert.equal(modal.canUndo(), false);
  modal.close();
});

test("pdf editor window: properties and a watermark are undoable edits", async () => {
  const { app, plugin, bytes } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  const original = Uint8Array.from(bytes);

  const title = modal.dom.all.filter((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Document title").pop();
  assert.ok(title, "the title field is rendered");
  title.value = "Mock 3";
  await fireOwn(title, "change");
  await clickMatching(modal.dom, /^Save properties$/);
  assert.match(statusText(modal), /document properties are set/);
  assert.equal(modal.doc.getTitle(), "Mock 3");

  const keywords = modal.dom.all.filter((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Document keywords").pop();
  keywords.value = "atp, respiration";
  await fireOwn(keywords, "change");

  const watermark = modal.dom.all.filter((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Watermark text").pop();
  assert.ok(watermark, "the watermark field is rendered");
  watermark.value = "DRAFT";
  await fireOwn(watermark, "change");
  await clickMatching(modal.dom, /^Add watermark$/);
  assert.match(statusText(modal), /Added the watermark to 4 pages/);
  assert.deepEqual(app.createdBinary || [], [], "nothing reached the vault before Save");

  await clickMatching(modal.dom, /^Undo add a watermark$/);
  await clickMatching(modal.dom, /^Undo set the document properties$/);
  assert.deepEqual(Array.from(modal.bytes), Array.from(original), "undoing both returns the opened bytes");
  assert.equal(modal.doc.getTitle(), undefined);
  assert.equal(modal.undoButton.disabled, true);

  await clickMatching(modal.dom, /^Redo set the document properties$/);
  assert.equal(modal.doc.getTitle(), "Mock 3");
  modal.close();
});

test("pdf editor window: split writes one file per N pages and leaves the document alone", async () => {
  const { app, plugin } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;

  const field = modal.dom.all.filter((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Pages per split file").pop();
  assert.ok(field, "the pages-per-file field is rendered");
  field.value = "3";
  await fireOwn(field, "change");
  await clickMatching(modal.dom, /^Split every N pages$/);

  assert.match(statusText(modal), /Wrote 2 files/);
  assert.deepEqual(app.createdBinary.map((entry) => entry.path), ["Papers/Exam (split 1).pdf", "Papers/Exam (split 2).pdf"]);
  const first = await PDFDocument.load(app.createdBinary[0].buffer);
  const second = await PDFDocument.load(app.createdBinary[1].buffer);
  assert.equal(first.getPageCount(), 3);
  assert.equal(second.getPageCount(), 1);
  assert.equal(modal.doc.getPageCount(), 4, "the edited document keeps every page");
  assert.equal(modal.canUndo(), false, "splitting is an export, not a document edit");
  modal.close();
});

test("pdf editor window: a new form field is one undo step, writes nothing before Save and survives the copy", async () => {
  const { app, plugin, bytes } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;

  const written = () => (app.createdBinary || []).length;
  const input = (aria) => {
    const hits = modal.dom.all.filter((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === aria);
    return hits.pop();
  };
  const select = (aria) => {
    const hits = modal.dom.all.filter((entry) => entry.meta.tag === "select" && entry.meta.attrs && entry.meta.attrs["aria-label"] === aria);
    return hits.pop();
  };

  const existing = new Map(modal.fields.map((field) => [field.name, field.value]));

  // the new-field controls are rendered from the modal's own state
  const label = input("New field label");
  assert.ok(label, "the label input is rendered");
  label.value = "Full name";
  await fireOwn(label, "change");
  assert.equal(modal.content.fieldLabel, "Full name");

  const page = select("New field page");
  assert.ok(page, "the page select is rendered");
  page.value = "Page 2";
  await fireOwn(page, "change");
  assert.equal(modal.content.fieldPage, "1", "page 2 is index 1");

  for (const [aria, value] of [["New field x", "50"], ["New field y", "120"], ["New field width", "170"], ["New field height", "26"], ["New field default text", "Ada Lovelace"]]) {
    const field = input(aria);
    assert.ok(field, `${aria} is rendered`);
    field.value = value;
    await fireOwn(field, "change");
  }

  const steps = modal.history.states.length;
  assert.equal(written(), 0, "nothing is written before Save");

  await clickMatching(modal.dom, /^Add field$/);
  assert.match(statusText(modal), /Added the form field “Full_name” on page 2/);
  assert.equal(modal.history.states.length, steps + 1, "adding a field is exactly one undo step");
  assert.match(modal.undoButton.__own.meta.text, /^Undo add a form field$/);
  assert.equal(written(), 0, "still nothing is written before Save");
  assert.ok(modal.fields.some((field) => field.name === "Full_name"), "the new field joins the fillable list");

  // undo returns the exact opened bytes
  await clickMatching(modal.dom, /^Undo add a form field$/);
  assert.deepEqual(Buffer.from(modal.bytes), Buffer.from(bytes), "undo restores the opened file byte for byte");
  assert.equal(modal.history.cursor, 0, "the window is back on the opened state");
  assert.equal(written(), 0, "undo writes nothing either");

  // add the text field again, then a checkbox, through the same rendered controls
  await clickMatching(modal.dom, /^Add field$/);
  const type = select("New field type");
  assert.ok(type, "the type select is rendered");
  type.value = "checkbox";
  await fireOwn(type, "change");
  const box = input("New field starts checked");
  assert.ok(box, "the checkbox control replaces the text options");
  box.checked = true;
  await fireOwn(box, "change");
  const checkLabel = input("New field label");
  checkLabel.value = "Agree to terms";
  await fireOwn(checkLabel, "change");
  await clickMatching(modal.dom, /^Add field$/);
  assert.match(statusText(modal), /Added the form field “Agree_to_terms” on page 2/);
  assert.equal(written(), 0, "both edits are still unsaved");

  await modal.saveCopy();
  assert.equal(written(), 1, "Save writes one copy");
  const copied = app.createdBinary[0];
  assert.equal(copied.path, "Papers/Exam (edited).pdf");

  const reopened = await PDFDocument.load(copied.buffer);
  const form = reopened.getForm();
  assert.equal(form.getFields().length, 5, "the form kept every field and was not flattened");

  // The window runs the bundled pdf-lib, so its field classes are a different
  // module instance than this test's; read the copy through pdf-lib's own API.
  const pages = reopened.getPages();
  const pageIndexOf = (widgets) => {
    for (const widget of widgets) {
      const ref = widget.P();
      if (!ref) continue;
      const index = pages.findIndex((page) => page.ref === ref);
      if (index >= 0) return index;
    }
    return -1;
  };
  const valueOf = (name) => {
    try {
      const field = form.getTextField(name);
      if (field) return field.getText() || "";
    } catch (error) {
      /* not a text field */
    }
    try {
      const field = form.getCheckBox(name);
      if (field) return Boolean(field.isChecked());
    } catch (error) {
      /* not a checkbox */
    }
    try {
      const field = form.getDropdown(name);
      if (field) return (field.getSelected() || []).join(", ");
    } catch (error) {
      /* not a dropdown */
    }
    return "?";
  };

  const textField = form.getTextField("Full_name");
  assert.equal(textField.getText(), "Ada Lovelace", "the typed default reached the copy");
  const textWidget = textField.acroField.getWidgets()[0];
  assert.ok(textWidget.dict.get(PDFName.of("AP")), "the saved text field has an appearance stream");
  assert.ok(Math.abs(textWidget.getRectangle().width - 170) <= 1, "the saved widget keeps the requested width");
  assert.equal(pageIndexOf(textField.acroField.getWidgets()), 1, "the field sits on page 2");

  const checkbox = form.getCheckBox("Agree_to_terms");
  assert.equal(checkbox.isChecked(), true, "the checkbox starts checked");
  assert.ok(checkbox.acroField.getWidgets()[0].dict.get(PDFName.of("AP")), "the checkbox has an appearance stream");
  assert.equal(pageIndexOf(checkbox.acroField.getWidgets()), 1);

  for (const [name, value] of existing) {
    assert.deepEqual(valueOf(name), value, `${name} kept its value`);
  }

  // and the saved copy is still fillable
  form.getTextField("Full_name").setText("Grace Hopper");
  const filled = await editor.savePdf(reopened);
  assert.equal((await PDFDocument.load(filled.bytes)).getForm().getTextField("Full_name").getText(), "Grace Hopper");
  modal.close();
});

test("pdf editor window: insert a blank page at a position, rotate and delete with one undo step each", async () => {
  const { app, plugin } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;
  /* a click starts the edit; its save and repaint finish on the next task */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  // two clockwise clicks make a half turn, through the real card buttons
  await clickLabeled(modal.dom, "Rotate page 1 clockwise");
  await settle();
  await clickLabeled(modal.dom, "Rotate page 1 clockwise");
  await settle();
  assert.equal(modal.pages[0].rotation, 180, "two clicks make a half turn");
  assert.equal(modal.doc.getPage(0).getRotation().angle, 180);

  const input = modal.dom.all.find((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Insert a blank page at this position");
  assert.ok(input, "the insert position field is rendered");
  input.value = "2";
  await fireOwn(input, "change");
  await clickMatching(modal.dom, /^Insert blank page$/);
  await settle();
  assert.equal(modal.doc.getPageCount(), 5, "the blank page was inserted");
  assert.deepEqual(modal.originOrder, [1, 0, 2, 3, 4], "the page map follows the insert");
  assert.deepEqual(modal.pages.map((page) => Math.round(page.width)), [400, Math.round(editor.DEFAULT_PAGE[0]), 401, 402, 403]);
  assert.equal(modal.pages[1].height, Math.round(editor.DEFAULT_PAGE[1] * 10) / 10, "the blank page has the default size");
  assert.match(statusText(modal), /Inserted a blank page at position 2/);

  // the blank page is the second card, so its delete button targets it
  await clickLabeled(modal.dom, "Delete page 2");
  await settle();
  assert.equal(modal.doc.getPageCount(), 4);
  assert.deepEqual(modal.originOrder, [1, 2, 3, 4], "the page map follows the delete");
  assert.deepEqual(modal.pages.map((page) => Math.round(page.width)), [400, 401, 402, 403], "the cards follow the delete");

  // one undo step per action, each named after what it reverses
  assert.equal(modal.undoButton.getAttribute("aria-label"), "Undo delete page 2");
  await clickMatching(modal.dom, /^Undo delete page 2$/);
  await settle();
  assert.equal(modal.doc.getPageCount(), 5);
  await clickMatching(modal.dom, /^Undo insert a blank page$/);
  await settle();
  assert.equal(modal.doc.getPageCount(), 4);
  assert.deepEqual(modal.originOrder, [1, 2, 3, 4], "undo restores the page map");
  await clickMatching(modal.dom, /^Undo rotate page 1$/);
  await settle();
  assert.equal(modal.doc.getPage(0).getRotation().angle, 90, "one undo reverses the second turn");
  await clickMatching(modal.dom, /^Undo rotate page 1$/);
  await settle();
  assert.equal(modal.doc.getPage(0).getRotation().angle, 0, "undo restores the original rotation");
  assert.deepEqual(app.createdBinary || [], [], "nothing reached the vault");
  modal.close();
});

test("pdf editor window: the link rows move the box and then the link to another page", async () => {
  const { app, plugin } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;

  // 1. add a link through the panel, so the rows below act on a real annotation
  modal.content.linkTarget = "url";
  modal.content.linkUrl = "https://example.com/keep";
  modal.content.linkPage = "0";
  modal.content.linkX = "10";
  modal.content.linkY = "10";
  modal.content.linkWidth = "20";
  modal.content.linkHeight = "10";
  await clickButton(modal.dom, "Add link");
  assert.match(statusText(modal), /Linked 1 page to https:\/\/example\.com\/keep/);
  assert.equal(editor.readLinks(modal.doc).total, 1);

  // 2. Move link: the button 1.248.0 added, driven here for the first time
  modal.content.linkEdit = "1";
  modal.content.linkAreaLeft = "50";
  modal.content.linkAreaTop = "60";
  modal.content.linkAreaWidth = "25";
  modal.content.linkAreaHeight = "10";
  await clickButton(modal.dom, "Move link");
  assert.match(statusText(modal), /now sits 25% wide and 10% tall at 50% across and 60% down/);
  assert.equal(editor.readLinks(modal.doc).total, 1, "the same annotation is edited, not replaced");
  const boxed = editor.readLinks(modal.doc).links[0].area;
  assert.ok(Math.abs(boxed.x - 0.5) < 0.01 && Math.abs(boxed.width - 0.25) < 0.01, `the box moved to ${JSON.stringify(boxed)}`);

  // 3. Move to page: with no new box the link keeps its visible place on page 3
  const annotsOn = (pageIndex) => {
    try {
      return modal.doc.getPage(pageIndex).node.Annots().asArray().length;
    } catch (error) {
      return 0;
    }
  };
  const sourceAnnots = annotsOn(0);
  const targetAnnots = annotsOn(2);
  for (const key of ["linkAreaLeft", "linkAreaTop", "linkAreaWidth", "linkAreaHeight"]) modal.content[key] = "";
  modal.content.linkPageTo = "3";
  await clickButton(modal.dom, "Move to page");
  assert.match(statusText(modal), /now sits on page 3, was page 1/);
  const links = editor.readLinks(modal.doc);
  assert.equal(links.total, 1, "one single annotation after the page move");
  assert.deepEqual([links.links[0].page, links.links[0].url], [3, "https://example.com/keep"]);
  assert.equal(annotsOn(0), sourceAnnots - 1, "the annotation is taken out of the source page");
  assert.equal(annotsOn(2), targetAnnots + 1, "the same annotation is added to the target page once");
  assert.equal(modal.history.states[modal.history.cursor].label, "move a link to another page", "the page move is one undo step");

  // 4. the same page is refused with a message and no change
  const stillOn = editor.readLinks(modal.doc).links[0].page;
  await clickButton(modal.dom, "Move to page");
  assert.match(statusText(modal), /already on page 3/);
  assert.equal(editor.readLinks(modal.doc).links[0].page, stillOn, "a refused page move changes nothing");

  // 5. one undo returns the link to its own page, one redo brings it back
  await clickMatching(modal.dom, /^Undo move a link to another page$/);
  assert.deepEqual(editor.readLinks(modal.doc).links.map((row) => row.page), [1]);
  await clickMatching(modal.dom, /^Redo move a link to another page$/);
  assert.deepEqual(editor.readLinks(modal.doc).links.map((row) => row.page), [3]);

  // 6. the saved copy carries the relocated link exactly once
  const sourceBefore = Uint8Array.from(app.files.find((file) => file.path === "Papers/Exam.pdf").buffer);
  await modal.saveCopy();
  const written = app.createdBinary[0];
  assert.ok(written, "a copy was written");
  assert.deepEqual(app.files.find((file) => file.path === "Papers/Exam.pdf").buffer, sourceBefore, "the source PDF is byte-for-byte unchanged");
  const reopened = await editor.loadEditorDocument(written.buffer);
  assert.equal(reopened.ok, true, "the saved copy opens again");
  const rows = editor.readLinks(reopened.doc);
  assert.equal(rows.total, 1);
  assert.deepEqual([rows.links[0].page, rows.links[0].url], [3, "https://example.com/keep"]);
  modal.close();
});

test("pdf editor window: the style row restyles a link and keeps its box, page and target", async () => {
  const { app, plugin } = await vault();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;

  modal.content.linkTarget = "url";
  modal.content.linkUrl = "https://example.com/style";
  modal.content.linkPage = "0";
  modal.content.linkX = "10";
  modal.content.linkY = "10";
  modal.content.linkWidth = "20";
  modal.content.linkHeight = "10";
  await clickButton(modal.dom, "Add link");
  assert.equal(editor.readLinks(modal.doc).total, 1);
  const before = editor.readLinks(modal.doc).links[0];

  const width = modal.dom.all.find((entry) => entry.meta.tag === "input" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Link border width");
  assert.ok(width, "the border width input is rendered");
  width.value = "3";
  await fireOwn(width, "change");
  assert.equal(modal.content.linkStyleWidth, "3", "the typed width is kept");
  const dash = modal.dom.all.find((entry) => entry.meta.tag === "select" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Link border dash");
  assert.ok(dash, "the dash select is rendered");
  dash.value = "dashed";
  await fireOwn(dash, "change");
  const highlight = modal.dom.all.find((entry) => entry.meta.tag === "select" && entry.meta.attrs && entry.meta.attrs["aria-label"] === "Link highlight");
  assert.ok(highlight, "the highlight select is rendered");
  highlight.value = "invert";
  await fireOwn(highlight, "change");
  modal.content.linkEdit = "1";
  await clickButton(modal.dom, "Style link");
  assert.match(statusText(modal), /now has a 3-point dashed border and the invert highlight/);
  const styled = editor.readLinks(modal.doc);
  assert.equal(styled.total, 1, "styling keeps a single annotation");
  assert.deepEqual(styled.links[0].style, { width: 3, dash: "dashed", highlight: "invert" });
  assert.deepEqual(styled.links[0].area, before.area, "the clickable area is untouched");
  assert.deepEqual([styled.links[0].page, styled.links[0].url], [1, "https://example.com/style"]);
  assert.equal(modal.history.states[modal.history.cursor].label, "style a link", "the style change is one undo step");

  // a zero width is refused with a message and no change
  width.value = "0";
  await fireOwn(width, "change");
  await clickButton(modal.dom, "Style link");
  assert.match(statusText(modal), /width above 0/);
  assert.deepEqual(editor.readLinks(modal.doc).links[0].style, { width: 3, dash: "dashed", highlight: "invert" }, "a refused style changes nothing");

  // one undo returns the plain border, one redo brings the style back
  await clickMatching(modal.dom, /^Undo style a link$/);
  assert.deepEqual(editor.readLinks(modal.doc).links[0].style, { width: 0, dash: "solid", highlight: "none" });
  await clickMatching(modal.dom, /^Redo style a link$/);
  assert.deepEqual(editor.readLinks(modal.doc).links[0].style, { width: 3, dash: "dashed", highlight: "invert" });

  // the saved copy carries the style
  const sourceBefore = Uint8Array.from(app.files.find((file) => file.path === "Papers/Exam.pdf").buffer);
  await modal.saveCopy();
  const written = app.createdBinary[0];
  assert.ok(written, "a copy was written");
  assert.deepEqual(app.files.find((file) => file.path === "Papers/Exam.pdf").buffer, sourceBefore, "the source PDF is byte-for-byte unchanged");
  const reopened = await editor.loadEditorDocument(written.buffer);
  assert.equal(reopened.ok, true, "the saved copy opens again");
  const rows = editor.readLinks(reopened.doc);
  assert.equal(rows.total, 1);
  assert.deepEqual(rows.links[0].style, { width: 3, dash: "dashed", highlight: "invert" });
  modal.close();
});

/** The ordinary fixture plus a launch link and a script link on page 1. */
async function linkedFixture() {
  const doc = await PDFDocument.load(await fixture());
  const add = (rect, action) => {
    const annot = doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0], F: 4 });
    annot.set(PDFName.of("A"), action);
    doc.getPage(0).node.addAnnot(doc.context.register(annot));
  };
  const launch = doc.context.obj({ Type: "Action", S: "Launch" });
  launch.set(PDFName.of("F"), PDFString.of("chapter1.pdf"));
  add([40, 400, 120, 450], launch);
  const script = doc.context.obj({ Type: "Action", S: "JavaScript" });
  script.set(PDFName.of("JS"), PDFString.of("app.alert(1)"));
  add([40, 350, 120, 380], script);
  return doc.save();
}

test("pdf editor window: the change row retargets a launch link and refuses a script action", async () => {
  const app = makeApp([
    { path: "Papers/Exam.pdf", noFm: true, text: "" },
    { path: "Papers/Exam.annotations.md", noFm: true, text: SIDECAR },
    { path: "Notes/Lecture.md", noFm: true, text: "# Lecture\n" },
  ]);
  const sourceBytes = await linkedFixture();
  app.files.find((file) => file.path === "Papers/Exam.pdf").buffer = sourceBytes;
  const plugin = new QT(app);
  await plugin.onload();
  const modal = openEditor(app, plugin, "Papers/Exam.pdf");
  await modal.loading;

  const rows = editor.readLinks(modal.doc);
  assert.deepEqual(rows.links.map((row) => row.target), ["launch", "other"], "both links are read with their kind");
  assert.match(modal.linksSummary(), /launch chapter1\.pdf/);
  assert.match(modal.linksSummary(), /\/JavaScript action/);
  const hint = modal.dom.all.find((entry) => entry.meta && entry.meta.tag === "span" && /launch action for chapter1\.pdf/.test(entry.meta.text || ""));
  assert.ok(hint, "the change row names what the selected link opens");

  modal.content.linkEdit = "1";
  modal.content.linkTarget = "url";
  modal.content.linkUrl = "https://example.com/converted";
  await clickButton(modal.dom, "Change link");
  assert.match(statusText(modal), /now opens https:\/\/example\.com\/converted instead of a launch action/);
  const changed = editor.readLinks(modal.doc);
  assert.deepEqual([changed.total, changed.links[0].target, changed.links[0].url], [2, "url", "https://example.com/converted"], "the launch link becomes the address");
  assert.equal(changed.links[0].file, "", "the launch file goes with its action");
  assert.equal(modal.history.states[modal.history.cursor].label, "change a link", "the conversion is one undo step");

  await clickMatching(modal.dom, /^Undo change a link$/);
  const undone = editor.readLinks(modal.doc).links[0];
  assert.deepEqual([undone.target, undone.file], ["launch", "chapter1.pdf"], "one undo brings the launch link back");
  await clickMatching(modal.dom, /^Redo change a link$/);

  // a script action is refused with a message and no change
  modal.content.linkEdit = "2";
  await clickButton(modal.dom, "Change link");
  assert.match(statusText(modal), /does not rewrite/);
  const refused = editor.readLinks(modal.doc);
  assert.deepEqual([refused.total, refused.links[1].target, refused.links[1].name], [2, "other", "JavaScript"], "the script action is left alone");

  const sourceBefore = Uint8Array.from(app.files.find((file) => file.path === "Papers/Exam.pdf").buffer);
  await modal.saveCopy();
  assert.deepEqual(app.files.find((file) => file.path === "Papers/Exam.pdf").buffer, sourceBefore, "the source PDF is byte-for-byte unchanged");
  const written = app.createdBinary[0];
  assert.ok(written, "a copy was written");
  const reopened = await editor.loadEditorDocument(written.buffer);
  assert.equal(reopened.ok, true, "the saved copy opens again");
  assert.deepEqual(editor.readLinks(reopened.doc).links.map((row) => row.target), ["url", "other"], "the copy carries the converted link and the untouched script");
  modal.close();
});
