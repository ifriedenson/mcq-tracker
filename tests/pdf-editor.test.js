"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { PDFDocument, PDFName, StandardFonts, degrees } = require("../vendor/pdf-lib.js");
const editor = require("../src/pdf-editor");

/** Four plain pages plus a text field, a checkbox and a dropdown on page one. */
async function fixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 4; index++) {
    const page = doc.addPage([400, 500]);
    page.drawText(`Page ${index + 1}`, { x: 40, y: 440, size: 18, font });
  }
  const form = doc.getForm();
  const name = form.createTextField("student");
  name.addToPage(doc.getPage(0), { x: 40, y: 400, width: 200, height: 20 });
  const agree = form.createCheckBox("agree");
  agree.addToPage(doc.getPage(0), { x: 40, y: 360, width: 14, height: 14 });
  const grade = form.createDropdown("grade");
  grade.addOptions(["A", "B"]);
  grade.addToPage(doc.getPage(1), { x: 40, y: 320, width: 80, height: 18 });
  return doc.save();
}

/** A real PNG of one flat colour, so the image code path is exercised for real. */
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
  return new Uint8Array(Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

/** The decoded content stream of one page, so drawn text can be checked. */
async function pageContent(bytes, index) {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(index).node.Contents();
  if (!contents) return "";
  const refs = typeof contents.asArray === "function" ? contents.asArray() : [contents];
  let raw = "";
  for (const ref of refs) {
    const stream = doc.context.lookup(ref);
    if (!stream || !stream.contents) continue;
    const buffer = Buffer.from(stream.contents);
    try {
      raw += zlib.inflateSync(buffer).toString("latin1");
    } catch (error) {
      raw += buffer.toString("latin1");
    }
  }
  const decoded = raw.replace(/<([0-9a-fA-F]+)>/g, (match, hex) => Buffer.from(hex, "hex").toString("latin1"));
  return `${raw}\n${decoded}`;
}

function highlight(page, extra) {
  return Object.assign({ page, type: "highlight", color: "yellow", areas: [{ x: 0.1, y: 0.3, width: 0.4, height: 0.03, color: "yellow", style: "highlight" }] }, extra || {});
}

test("opens a PDF, lists its pages and reports a readable refusal for bad input", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  assert.equal(loaded.ok, true);
  assert.equal(loaded.pageCount, 4);
  assert.deepEqual(
    editor.pageList(loaded.doc).map((page) => page.number),
    [1, 2, 3, 4],
  );
  assert.equal(editor.pageList(loaded.doc)[0].width, 400);

  const empty = await editor.loadEditorDocument(new Uint8Array([1, 2, 3]));
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "empty");

  const damaged = await editor.loadEditorDocument(new TextEncoder().encode("%PDF-1.7 not really a pdf"));
  assert.equal(damaged.ok, false);
  assert.equal(damaged.reason, "parse");
  assert.match(damaged.message, /could not be opened/i);
});

test("rotates, reorders, duplicates, deletes and inserts pages", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const doc = loaded.doc;

  assert.deepEqual(editor.rotatePage(doc, 0, 90), { ok: true, index: 0, rotation: 90 });
  assert.equal(editor.pageList(doc)[0].rotation, 90);
  assert.equal(editor.rotatePage(doc, 0, -90).rotation, 0);
  assert.equal(editor.rotatePage(doc, 0, 180).rotation, 180);
  assert.equal(editor.rotatePage(doc, 9, 90).ok, false);

  const moved = editor.movePage(doc, 0, 3);
  assert.equal(moved.ok, true);
  assert.equal(doc.getPageCount(), 4);

  const duplicated = await editor.duplicatePage(doc, 0);
  assert.equal(duplicated.ok, true);
  assert.equal(doc.getPageCount(), 5);

  assert.equal(editor.deletePage(doc, 0).pageCount, 4);
  const blank = editor.addBlankPage(doc, 2, { width: 300, height: 300 });
  assert.equal(blank.ok, true);
  assert.equal(editor.pageList(doc)[2].width, 300);
  assert.equal(editor.pageList(doc)[2].height, 300);

  const saved = await editor.savePdf(doc);
  assert.equal(saved.ok, true);
  const reloaded = await editor.loadEditorDocument(saved.bytes);
  assert.equal(reloaded.pageCount, 5);
});

test("merges another PDF's pages without changing the other file", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const other = await PDFDocument.create();
  other.addPage([200, 200]);
  other.addPage([200, 200]);
  const otherBytes = await other.save();

  const merged = await editor.insertPdfPages(loaded.doc, otherBytes, 4);
  assert.equal(merged.ok, true);
  assert.equal(merged.added, 2);
  assert.equal(loaded.doc.getPageCount(), 6);

  const again = await editor.loadEditorDocument(otherBytes);
  assert.equal(again.pageCount, 2, "the merged file keeps its own two pages");

  const saved = await editor.savePdf(loaded.doc);
  const reloaded = await editor.loadEditorDocument(saved.bytes);
  assert.equal(reloaded.pageCount, 6);
  assert.equal(editor.pageList(reloaded.doc)[4].width, 200);
});

test("reads AcroForm fields and fills them, refusing a value that is not a choice", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const fields = editor.formFields(loaded.doc);
  assert.equal(fields.ok, true);
  assert.deepEqual(
    fields.fields.map((field) => [field.name, field.kind]),
    [
      ["student", "text"],
      ["agree", "checkbox"],
      ["grade", "dropdown"],
    ],
  );
  assert.deepEqual(fields.fields[2].options, ["A", "B"]);
  assert.equal(fields.fields[2].page, 1);

  assert.deepEqual(editor.setFieldValue(loaded.doc, "student", "Ada Lovelace"), { ok: true, name: "student", value: "Ada Lovelace" });
  assert.equal(editor.setFieldValue(loaded.doc, "agree", true).value, true);
  assert.equal(editor.setFieldValue(loaded.doc, "grade", "B").value, "B");

  const badOption = editor.setFieldValue(loaded.doc, "grade", "Z");
  assert.equal(badOption.ok, false);
  assert.equal(badOption.reason, "option");
  assert.match(badOption.message, /not one of the choices/);

  const missing = editor.setFieldValue(loaded.doc, "nope", "x");
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "missing");
});

test("saved values survive a reload, and a flattened form loses its fields", async () => {
  const filled = await editor.loadEditorDocument(await fixture());
  editor.setFieldValue(filled.doc, "student", "Grace Hopper");
  editor.setFieldValue(filled.doc, "agree", true);
  const kept = await editor.savePdf(filled.doc);
  const reopened = await editor.loadEditorDocument(kept.bytes);
  const values = editor.formFields(reopened.doc).fields;
  assert.equal(values.find((field) => field.name === "student").value, "Grace Hopper");
  assert.equal(values.find((field) => field.name === "agree").value, true);

  const flattened = await editor.flattenForm(filled.doc);
  assert.equal(flattened.ok, true);
  const flat = await editor.savePdf(filled.doc);
  const reloaded = await editor.loadEditorDocument(flat.bytes);
  assert.equal(editor.formFields(reloaded.doc).fields.length, 0);
  assert.equal(reloaded.pageCount, 4);
});

test("burns sidecar annotations into the page content", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const before = (await editor.savePdf(loaded.doc)).bytes.length;
  const annotations = [
    highlight(1),
    { page: 1, type: "pen", color: "red", strokes: [{ tool: "pen", color: "red", width: 0.004, opacity: 0.9, points: [[0.1, 0.1], [0.3, 0.2], [0.5, 0.25]] }] },
    { page: 2, type: "text", color: "blue", boxes: [{ text: "Check this derivation again", x: 0.1, y: 0.6, width: 0.5, height: 0.15, size: 0.02, color: "blue" }] },
    highlight(9),
  ];
  const burned = await editor.flattenAnnotations(loaded.doc, annotations, { pageMap: [1, 2, 3, 4] });
  assert.equal(burned.ok, true);
  assert.equal(burned.pages, 2);
  assert.ok(burned.drawn >= 3);
  assert.equal(burned.skipped, 1, "an annotation on a page that is gone is skipped, not drawn somewhere else");

  const after = await editor.savePdf(loaded.doc);
  assert.ok(after.bytes.length > before, "the drawn marks are really in the new file");
  const reloaded = await editor.loadEditorDocument(after.bytes);
  assert.equal(reloaded.pageCount, 4);
});

test("keeps annotations on their own page after a page is deleted", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  editor.deletePage(loaded.doc, 1);
  const pageMap = [1, 3, 4];
  const burned = await editor.flattenAnnotations(loaded.doc, [highlight(3)], { pageMap });
  assert.equal(burned.ok, true);
  assert.equal(burned.pages, 1);

  const orphan = await editor.flattenAnnotations(loaded.doc, [highlight(2)], { pageMap });
  assert.equal(orphan.drawn, 0);
  assert.equal(orphan.skipped, 1);
});

test("maps normalized page coordinates into PDF points for every rotation", () => {
  const area = { x: 0, y: 0, width: 0.1, height: 0.1 };
  assert.deepEqual(editor.displayRect(area, 400, 500, 0), { x: 0, y: 450, width: 40, height: 50 });
  assert.deepEqual(editor.displayRect(area, 400, 500, 90), { x: 0, y: 0, width: 40, height: 50 });
  assert.deepEqual(editor.displayRect(area, 400, 500, 180), { x: 360, y: 450, width: 40, height: 50 });
  assert.deepEqual(editor.displayRect(area, 400, 500, 270), { x: 360, y: 450, width: 40, height: 50 });

  const tall = { x: 0, y: 0, width: 0.1, height: 0.2 };
  assert.deepEqual(editor.displayRect(tall, 400, 500, 270), { x: 320, y: 450, width: 80, height: 50 });
  assert.deepEqual(editor.displayPoint([0, 0], 400, 500, 0), { x: 0, y: 500 });
  assert.deepEqual(editor.displayPoint([1, 1], 400, 500, 0), { x: 400, y: 0 });
});

test("draws marks into a rotated page without leaving the page box", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 500]).setRotation(degrees(90));
  const burned = await editor.flattenAnnotations(doc, [highlight(1)], { pageMap: [1] });
  assert.equal(burned.ok, true);
  assert.equal(burned.drawn, 1);
  const saved = await editor.savePdf(doc);
  assert.equal(saved.ok, true);
});

test("a PDF needs one page left, and a copy never overwrites an existing name", async () => {
  const single = await PDFDocument.create();
  single.addPage();
  const loaded = await editor.loadEditorDocument(await single.save());
  const refused = editor.deletePage(loaded.doc, 0);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "last-page");

  assert.equal(editor.editedPathFor("study/report.pdf"), "study/report (edited).pdf");
  assert.equal(editor.editedPathFor("report.pdf".replace(/^/, "study/"), () => false, "extract"), "study/report (extract).pdf");
  const taken = new Set(["study/report (edited).pdf", "study/report (edited 2).pdf"]);
  assert.equal(editor.editedPathFor("study/report.pdf", (path) => taken.has(path)), "study/report (edited 3).pdf");
});

test("extracts selected pages into their own PDF", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const extracted = await editor.extractPdfPages(loaded.doc, [2, 0]);
  assert.equal(extracted.ok, true);
  assert.equal(extracted.pages, 2);
  assert.deepEqual(extracted.indexes, [0, 2]);
  const reopen = await editor.loadEditorDocument(extracted.bytes);
  assert.equal(reopen.pageCount, 2);

  const empty = await editor.extractPdfPages(loaded.doc, []);
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "empty");
});

test("text is converted to characters a standard PDF font can draw", () => {
  assert.equal(editor.winAnsiText("café — “quoted”…"), 'café - "quoted"...');
  assert.equal(editor.winAnsiText("漢字"), "??");
});

test("draws typed text on one page or on every page", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const before = (await editor.savePdf(loaded.doc)).bytes.length;

  const one = await editor.addText(loaded.doc, { text: "Reviewed", pages: 0, size: 18, position: "top-center" });
  assert.deepEqual(one, { ok: true, drawn: 1, pages: 1 });
  const all = await editor.addText(loaded.doc, { text: "DRAFT — do not submit", pages: "all", position: "middle-center", color: "red" });
  assert.equal(all.ok, true);
  assert.equal(all.pages, 4);
  assert.equal(all.drawn, 4);

  assert.equal((await editor.addText(loaded.doc, { text: "   " })).reason, "empty");
  assert.equal((await editor.addText(loaded.doc, { text: "x", pages: 9 })).reason, "index");

  const after = await editor.savePdf(loaded.doc);
  assert.ok(after.bytes.length > before, "the text is written into the page content");
  assert.equal((await editor.loadEditorDocument(after.bytes)).pageCount, 4);
});

test("crops the visible area and refuses a crop that eats the page", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  assert.deepEqual(editor.cropPages(loaded.doc, { top: 20, bottom: 20, left: 10, right: 10 }), { ok: true, pages: 4 });
  assert.deepEqual(loaded.doc.getPage(0).getCropBox(), { x: 10, y: 20, width: 380, height: 460 });
  assert.deepEqual(loaded.doc.getPage(3).getCropBox(), { x: 10, y: 20, width: 380, height: 460 });

  assert.equal(editor.cropPages(loaded.doc, {}).reason, "empty");
  assert.equal(editor.cropPages(loaded.doc, { left: 900 }).reason, "size");

  const saved = await editor.savePdf(loaded.doc);
  const reopened = await editor.loadEditorDocument(saved.bytes);
  assert.equal(reopened.additional, undefined);
  assert.deepEqual(reopened.doc.getPage(0).getCropBox(), { x: 10, y: 20, width: 380, height: 460 });
  assert.deepEqual(reopened.doc.getPage(0).getMediaBox(), { x: 0, y: 0, width: 400, height: 500 });
});

test("stamps page numbers with a format", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const result = await editor.addPageNumbers(loaded.doc, { format: "{n} / {total}", size: 9 });
  assert.deepEqual(result, { ok: true, drawn: 4, pages: 4 });

  const subset = await editor.addPageNumbers(loaded.doc, { format: "p{n}", pages: [1, 2], start: 5 });
  assert.deepEqual(subset, { ok: true, drawn: 2, pages: 2 });
  assert.equal((await editor.addPageNumbers(loaded.doc, { pages: 42 })).reason, "index");

  const saved = await editor.savePdf(loaded.doc);
  assert.equal((await editor.loadEditorDocument(saved.bytes)).pageCount, 4);
});

test("places a real PNG and refuses broken images or rotated pages", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const placed = await editor.addImage(loaded.doc, { bytes: tinyPng(4, 4, [255, 0, 0]), width: 0.25, pages: 0, position: "bottom-right" });
  assert.deepEqual(placed, { ok: true, drawn: 1, pages: 1 });
  const every = await editor.addImage(loaded.doc, { bytes: tinyPng(8, 4, [0, 128, 255]), width: 0.1, pages: "all" });
  assert.deepEqual(every, { ok: true, drawn: 4, pages: 4 });

  assert.equal((await editor.addImage(loaded.doc, { bytes: new Uint8Array() })).reason, "empty");
  assert.equal((await editor.addImage(loaded.doc, { bytes: new Uint8Array([0x47, 0x49, 0x46]) })).reason, "format");
  assert.equal((await editor.addImage(loaded.doc, { bytes: tinyPng(2, 2, [0, 0, 0]), pages: 12 })).reason, "index");

  const turned = await editor.loadEditorDocument(await fixture());
  turned.doc.getPage(0).setRotation(degrees(90));
  const refused = await editor.addImage(turned.doc, { bytes: tinyPng(4, 4, [0, 255, 0]), pages: 0 });
  assert.equal(refused.reason, "rotation");
  assert.match(refused.message, /rotate/i);

  const saved = await editor.savePdf(loaded.doc);
  assert.equal((await editor.loadEditorDocument(saved.bytes)).pageCount, 4);
});

test("writes the document properties into the copy", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const written = editor.setDocumentProperties(loaded.doc, {
    title: "  Biology   mock  ",
    author: "Ada Lovelace",
    subject: "Unit 3 review",
    keywords: ["atp", " enzymes ", ""],
  });
  assert.equal(written.ok, true);
  assert.equal(written.title, "Biology mock");
  assert.deepEqual(written.keywords, ["atp", "enzymes"]);

  const saved = await editor.savePdf(loaded.doc);
  const reopened = await PDFDocument.load(saved.bytes);
  assert.equal(reopened.getTitle(), "Biology mock");
  assert.equal(reopened.getAuthor(), "Ada Lovelace");
  assert.equal(reopened.getSubject(), "Unit 3 review");
  assert.equal(reopened.getKeywords(), "atp enzymes", "pdf-lib stores keywords as one string");

  const bounded = editor.setDocumentProperties(loaded.doc, { title: "x".repeat(400) });
  assert.equal(bounded.title.length, 200, "a property is bounded");
  assert.equal(bounded.author, "", "an absent property clears rather than throws");
  assert.equal(editor.setDocumentProperties(loaded.doc, {}).reason, "empty");
  assert.equal(editor.setDocumentProperties(loaded.doc, null).reason, "empty");
});

test("stamps a fitted watermark on every page and refuses rotated ones", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const result = await editor.addWatermark(loaded.doc, { text: "DRAFT", size: 120, angle: 45, opacity: 0.2, color: "red" });
  assert.equal(result.ok, true);
  assert.equal(result.drawn, 4);
  assert.equal(result.pages, 4);

  const saved = await editor.savePdf(loaded.doc);
  for (let index = 0; index < 4; index++) {
    const content = await pageContent(saved.bytes, index);
    assert.match(content, /DRAFT/, `page ${index + 1} carries the watermark`);
    assert.match(content, / gs/, "the opacity is written as a graphics state");
  }
  assert.equal((await editor.loadEditorDocument(saved.bytes)).pageCount, 4);

  // one page only, flat text, fitted by shrinking the size
  const single = await editor.addWatermark(loaded.doc, { text: "x".repeat(180), pages: 1, angle: 0, size: 200 });
  assert.equal(single.ok, true);
  assert.equal(single.pages, 1);
  assert.ok(single.size < 200, "the size shrinks to fit the page");

  assert.equal((await editor.addWatermark(loaded.doc, { text: "  " })).reason, "empty");
  assert.equal((await editor.addWatermark(loaded.doc, { text: "DRAFT", pages: 9 })).reason, "index");

  const turned = await editor.loadEditorDocument(await fixture());
  turned.doc.getPage(0).setRotation(degrees(90));
  const refused = await editor.addWatermark(turned.doc, { text: "DRAFT", pages: 0 });
  assert.equal(refused.reason, "rotation");
  assert.match(refused.message, /unrotated page/i);
});

test("splits the document every N pages into separate PDFs", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const two = await editor.splitPdf(loaded.doc, 2);
  assert.equal(two.ok, true);
  assert.equal(two.files, 2);
  assert.deepEqual(two.parts.map((part) => part.pages), [2, 2]);
  assert.deepEqual(two.parts[1].indexes, [2, 3]);
  assert.equal((await editor.loadEditorDocument(two.parts[0].bytes)).pageCount, 2);

  const three = await editor.splitPdf(loaded.doc, 3);
  assert.deepEqual(three.parts.map((part) => part.pages), [3, 1]);
  assert.equal((await editor.loadEditorDocument(three.parts[1].bytes)).pageCount, 1);

  assert.equal((await editor.splitPdf(loaded.doc, 0)).reason, "size");
  assert.equal((await editor.splitPdf(loaded.doc, "x")).reason, "size");

  const single = await editor.loadEditorDocument(await fixture());
  while (single.doc.getPageCount() > 1) editor.deletePage(single.doc, single.doc.getPageCount() - 1);
  assert.equal((await editor.splitPdf(single.doc, 5)).reason, "pages");

  const many = await PDFDocument.create();
  for (let index = 0; index < 101; index++) many.addPage([200, 200]);
  assert.equal((await editor.splitPdf(many, 1)).reason, "parts");
});

/* ------------------------------------------------- new AcroForm fields */

/** Three pages and one existing text field holding a value. */
async function authorFixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < 3; index++) {
    const page = doc.addPage([400, 500]);
    page.drawText(`page ${index + 1}`, { x: 30, y: 460, size: 12, font });
  }
  const form = doc.getForm();
  const existing = form.createTextField("student");
  existing.addToPage(doc.getPages()[0], { x: 40, y: 400, width: 160, height: 22 });
  existing.setText("keep me");
  return doc;
}

test("new text, checkbox and dropdown fields appear on their pages and stay fillable", async () => {
  const doc = await authorFixture();
  const text = await editor.addFormField(doc, { label: "Full name", type: "text", page: 1, x: 40, y: 300, width: 180, height: 24, value: "Ada Lovelace" });
  assert.equal(text.ok, true, text.message);
  assert.equal(text.name, "Full_name");
  assert.equal(text.page, 1);
  const box = await editor.addFormField(doc, { label: "Agree", type: "checkbox", page: 2, x: 60, y: 200, width: 18, height: 18, checked: true });
  assert.equal(box.ok, true, box.message);
  const drop = await editor.addFormField(doc, { label: "Size", type: "dropdown", page: 0, x: 40, y: 120, width: 160, height: 24, options: ["Small", "Medium", "Large"], select: "Medium" });
  assert.equal(drop.ok, true, drop.message);
  assert.deepEqual(drop.options, ["Small", "Medium", "Large"]);

  const saved = await editor.savePdf(doc);
  assert.equal(saved.ok, true);
  const reopened = await PDFDocument.load(saved.bytes);
  const form = reopened.getForm();
  assert.deepEqual(form.getFields().map((field) => field.getName()).sort(), ["Agree", "Full_name", "Size", "student"]);

  const textField = form.getTextField("Full_name");
  assert.equal(textField.getText(), "Ada Lovelace");
  const rows = editor.formFields(reopened).fields;
  assert.equal(rows.find((row) => row.name === "Full_name").page, 1);
  assert.equal(rows.find((row) => row.name === "Full_name").kind, "text");
  const widget = textField.acroField.getWidgets()[0];
  assert.deepEqual(widget.getRectangle(), text.rect, "the engine reports the widget rectangle it stored");
  assert.ok(Math.abs(text.rect.x - 40) <= 1 && Math.abs(text.rect.y - 300) <= 1, "the box sits where it was asked to");
  assert.ok(Math.abs(text.rect.width - 180) <= 1 && Math.abs(text.rect.height - 24) <= 1, "pdf-lib pads the box by its one-point border");
  assert.ok(widget.dict.get(PDFName.of("AP")), "the text field has an appearance stream");

  const checkbox = form.getCheckBox("Agree");
  assert.equal(checkbox.isChecked(), true);
  assert.equal(editor.formFields(reopened).fields.find((row) => row.name === "Agree").page, 2);
  const boxRect = checkbox.acroField.getWidgets()[0].getRectangle();
  assert.deepEqual(boxRect, box.rect, "the checkbox reports its stored rectangle");
  assert.ok(Math.abs(boxRect.x - 60) <= 1 && Math.abs(boxRect.width - 18) <= 1);
  assert.ok(checkbox.acroField.getWidgets()[0].dict.get(PDFName.of("AP")), "the checkbox has an appearance stream");

  const dropdown = form.getDropdown("Size");
  assert.deepEqual(dropdown.getOptions(), ["Small", "Medium", "Large"]);
  assert.deepEqual(dropdown.getSelected(), ["Medium"]);
  assert.equal(editor.formFields(reopened).fields.find((row) => row.name === "Size").page, 0);

  assert.equal(form.getTextField("student").getText(), "keep me", "the existing value survived the save");
  assert.equal(editor.formFields(reopened).fields.find((row) => row.name === "student").value, "keep me");

  assert.equal(editor.setFieldValue(reopened, "Full_name", "Grace Hopper").ok, true, "the new field is still fillable");
  const again = await editor.savePdf(reopened);
  const reread = await PDFDocument.load(again.bytes);
  assert.equal(reread.getForm().getTextField("Full_name").getText(), "Grace Hopper");
  assert.equal(reread.getForm().getFields().length, 4, "the form was never flattened");
});

test("a radio group adds one ring per option and can start selected", async () => {
  const doc = await authorFixture();
  const added = await editor.addFormField(doc, { label: "Colour choice", type: "radio", page: 1, x: 40, y: 100, width: 140, height: 72, options: ["Red", "Green", "Blue"], select: "Green" });
  assert.equal(added.ok, true, added.message);
  assert.equal(added.name, "Colour_choice");
  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  const group = reopened.getForm().getRadioGroup("Colour_choice");
  assert.deepEqual(group.getOptions(), ["Red", "Green", "Blue"]);
  assert.equal(group.getSelected(), "Green");
  const widgets = group.acroField.getWidgets();
  assert.equal(widgets.length, 3);
  assert.equal(added.rects.length, 3);
  widgets.forEach((widget, index) => {
    const rect = widget.getRectangle();
    assert.deepEqual(rect, added.rects[index], "each ring is reported as stored");
    assert.ok(Math.abs(rect.x - 40) <= 1, "rings share the left edge");
    assert.ok(Math.abs(rect.width - 140) <= 1);
    assert.ok(rect.height >= 8, "each ring keeps a usable height");
  });
  assert.equal(editor.formFields(reopened).fields.find((row) => row.name === "Colour_choice").page, 1);
});

test("a derived name avoids an existing field and an explicit duplicate is refused", async () => {
  const doc = await authorFixture();
  const added = await editor.addFormField(doc, { label: "student", type: "text", page: 1, x: 40, y: 250, width: 160, height: 22 });
  assert.equal(added.ok, true, added.message);
  assert.equal(added.name, "student_2");
  const duplicate = await editor.addFormField(doc, { name: "student", label: "Student again", type: "text", page: 1, x: 40, y: 220, width: 160, height: 22 });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "duplicate");
  assert.match(duplicate.message, /already has a field named “student”/);
  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  assert.equal(reopened.getForm().getTextField("student").getText(), "keep me", "the old field kept its value");
  assert.ok(reopened.getForm().getTextField("student_2"), "the new field has its own name");
});

test("unusable new fields are refused with a reason and add nothing", async () => {
  const doc = await authorFixture();
  const base = { label: "Field", type: "text", page: 0, x: 40, y: 40, width: 160, height: 24 };
  const cases = [
    [{ ...base, type: "signature" }, "type"],
    [{ ...base, label: "" }, "name"],
    [{ ...base, page: 9 }, "page"],
    [{ ...base, x: 360 }, "rect"],
    [{ ...base, y: -5 }, "rect"],
    [{ ...base, width: 4 }, "size"],
    [{ ...base, type: "dropdown", options: [] }, "options"],
    [{ ...base, type: "dropdown", options: " , , " }, "options"],
    [{ ...base, type: "radio", options: ["A", "A"] }, "options"],
    [{ ...base, type: "radio", options: ["A", "B", "C"], height: 20 }, "size"],
    [{ ...base, type: "dropdown", options: ["A"], select: "B" }, "option"],
  ];
  for (const [input, reason] of cases) {
    const result = await editor.addFormField(doc, input);
    assert.equal(result.ok, false, `${reason} case was accepted`);
    assert.equal(result.reason, reason, `${reason}: ${result.message}`);
    assert.ok(result.message.length > 10, "the refusal explains itself");
  }
  assert.equal(doc.getForm().getFields().length, 1, "no refused request created a field");
});

test("an explicit field name is shortened before the duplicate check", async () => {
  const doc = await authorFixture();
  const long = "n".repeat(70);
  const first = await editor.addFormField(doc, { name: long, label: "Long", type: "text", page: 0, x: 40, y: 100, width: 120, height: 20 });
  assert.equal(first.ok, true, first.message);
  assert.equal(first.name.length, 60, "the stored name is bounded");
  const clash = await editor.addFormField(doc, { name: long, label: "Again", type: "text", page: 0, x: 40, y: 160, width: 120, height: 20 });
  assert.equal(clash.ok, false);
  assert.equal(clash.reason, "duplicate", clash.message);
  const same = doc.getForm().getFields().filter((field) => field.getName() === long.slice(0, 60));
  assert.equal(same.length, 1, "no second field was created under the same name");
});

test("a new field is measured against the visible page, not just its size", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 500]);
  const offset = doc.addPage([400, 500]);
  offset.setMediaBox(20, 20, 400, 500);
  const outside = await editor.addFormField(doc, { label: "Offset", type: "text", page: 1, x: 0, y: 0, width: 60, height: 20 });
  assert.equal(outside.ok, false, "a box left of the visible area is refused");
  assert.equal(outside.reason, "rect");
  assert.match(outside.message, /visible area/);
  const inside = await editor.addFormField(doc, { label: "Offset", type: "text", page: 1, x: 40, y: 40, width: 60, height: 20 });
  assert.equal(inside.ok, true, inside.message);
  const edge = await editor.addFormField(doc, { label: "Edge", type: "text", page: 0, x: 0, y: 0, width: 400, height: 500 });
  assert.equal(edge.ok, false, "a page-filling box leaves no room for the border");
  assert.equal(edge.reason, "rect");
  assert.match(edge.message, /one-point border/);
  assert.equal(doc.getForm().getFields().length, 1, "only the usable field was kept");
  assert.equal(editor.formFields(doc).fields[0].page, 1);
});

test("splitting a PDF with a form bakes the values in instead of dropping the form", async () => {
  const doc = await authorFixture();
  const split = await editor.splitPdf(doc, 2);
  assert.equal(split.ok, true, split.message);
  assert.equal(split.flattened, true, "the split flattened a copy first");
  assert.equal(split.parts.length, 2);
  const first = await PDFDocument.load(split.parts[0].bytes);
  const second = await PDFDocument.load(split.parts[1].bytes);
  assert.equal(first.getPageCount(), 2);
  assert.equal(second.getPageCount(), 1);
  assert.deepEqual(first.getForm().getFields().map((field) => field.getName()), [], "no orphan widgets without a form");
  const annots = first.getPage(0).node.Annots();
  assert.ok(!annots || annots.size() === 0, "the page carries no dead widget annotations");
  assert.equal(editor.formFields(doc).fields.length, 1, "the edited document keeps its live form");
});

test("flattening a form leaves no orphan widget annotations on the pages", async () => {
  const doc = await authorFixture();
  const baked = await editor.flattenForm(doc);
  assert.equal(baked.ok, true, baked.message);
  assert.equal(doc.getForm().getFields().length, 0, "the fields are gone");
  const annots = doc.getPage(0).node.Annots();
  assert.ok(!annots || annots.size() === 0, "the widget annotation left the page");
  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  const reopenedAnnots = reopened.getPage(0).node.Annots();
  assert.ok(!reopenedAnnots || reopenedAnnots.size() === 0, "the saved copy carries no dead annotation");
  assert.equal(reopened.getForm().getFields().length, 0);
});
