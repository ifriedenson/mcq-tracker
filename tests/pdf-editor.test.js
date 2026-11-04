"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { PDFDocument, PDFName, PDFDict, StandardFonts, degrees } = require("../vendor/pdf-lib.js");
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

test("adding pages from a form PDF creates live, independently fillable fields", async () => {
  const sourceBytes = await fixture();
  const source = await PDFDocument.load(sourceBytes);
  source.getForm().getTextField("student").setText("keep me");
  source.getForm().getCheckBox("agree").check();
  source.getForm().getDropdown("grade").select("B");
  addLinkAnnotation(source, source.getPage(0));
  const bytes = await source.save();

  const target = await PDFDocument.create();
  target.addPage([300, 300]);
  const targetField = target.getForm().createTextField("student");
  targetField.addToPage(target.getPage(0), { x: 20, y: 200, width: 100, height: 20 });
  targetField.setText("target");

  const merged = await editor.insertPdfPages(target, bytes, 0);
  assert.equal(merged.ok, true, merged.message);
  assert.equal(merged.flattened, false, "live fields are not flattened");
  assert.equal(merged.liveForm, true);
  assert.equal(merged.fields, 3, "three source fields were cloned");
  assert.equal(merged.added, 4);
  assert.equal(target.getPageCount(), 5);

  assert.deepEqual(editor.formFields(target).fields.map((field) => field.name), ["student", "student_2", "agree", "grade"]);
  const fields = editor.formFields(target).fields;
  assert.equal(fields.find((field) => field.name === "student").page, 4, "the target's own field stays on its page");
  assert.equal(fields.find((field) => field.name === "student_2").page, 0);
  assert.equal(fields.find((field) => field.name === "agree").page, 0);
  assert.equal(fields.find((field) => field.name === "grade").page, 1);
  assert.equal(fields.find((field) => field.name === "student_2").value, "keep me");
  assert.equal(fields.find((field) => field.name === "agree").value, true);
  assert.equal(fields.find((field) => field.name === "grade").value, "B");

  assert.equal(editor.setFieldValue(target, "student_2", "merged copy").ok, true);
  assert.equal(editor.formFields(target).fields.find((field) => field.name === "student").value, "target", "filling the merged field leaves the target field alone");

  const saved = await editor.savePdf(target);
  const reopened = await PDFDocument.load(saved.bytes);
  const form = reopened.getForm();
  assert.deepEqual(form.getFields().map((field) => field.getName()), ["student", "student_2", "agree", "grade"]);
  assert.equal(form.getTextField("student_2").getText(), "merged copy");
  assert.equal(form.getTextField("student").getText(), "target");
  assert.equal(form.getCheckBox("agree").isChecked(), true);
  assert.deepEqual(form.getDropdown("grade").getSelected(), ["B"]);
  assert.ok(form.getTextField("student_2").acroField.getWidgets()[0].dict.get(PDFName.of("AP")), "the merged widget has an appearance");
  const annots = reopened.getPage(0).node.Annots();
  const subtypes = annots.asArray().map((ref) => String(reopened.context.lookup(ref).get(PDFName.of("Subtype"))));
  assert.ok(subtypes.includes("/Widget"), "the merged widget is live on its page");
  assert.ok(subtypes.includes("/Link"), "the non-widget link annotation survives the merge");
  assert.doesNotMatch(await pageContent(saved.bytes, 0), /FlatWidget/, "the merged page is not a flattened appearance");

  const sourceAgain = await PDFDocument.load(bytes);
  assert.equal(sourceAgain.getForm().getTextField("student").getText(), "keep me");
  assert.equal(sourceAgain.getForm().getCheckBox("agree").isChecked(), true);
  assert.deepEqual(sourceAgain.getForm().getDropdown("grade").getSelected(), ["B"]);
});

test("adding the same form PDF twice creates distinct live field names", async () => {
  const source = await PDFDocument.load(await fixture());
  source.getForm().getTextField("student").setText("keep me");
  const bytes = await source.save();
  const target = await PDFDocument.create();
  target.addPage([300, 300]);
  const first = await editor.insertPdfPages(target, bytes, 1);
  const second = await editor.insertPdfPages(target, bytes, target.getPageCount());
  assert.equal(first.ok, true, first.message);
  assert.equal(second.ok, true, second.message);
  const names = editor.formFields(target).fields.map((field) => field.name);
  assert.deepEqual(names, ["student", "agree", "grade", "student_2", "agree_2", "grade_2"]);
  assert.equal(new Set(names).size, 6);
  assert.equal(editor.formFields(target).fields.find((field) => field.name === "student_2").page, 5);
});

test("adding pages with an unsupported form field refuses with an add-pages form message", async () => {
  const source = await PDFDocument.load(await fixture());
  const button = source.getForm().createButton("submit");
  button.addToPage("Submit", source.getPage(0), { x: 240, y: 400, width: 80, height: 22 });
  const bytes = await source.save();
  const target = await PDFDocument.create();
  target.addPage([300, 300]);
  const targetField = target.getForm().createTextField("student");
  targetField.addToPage(target.getPage(0), { x: 20, y: 200, width: 100, height: 20 });
  targetField.setText("target");

  const refused = await editor.insertPdfPages(target, bytes, 0);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "form");
  assert.match(refused.message, /add-pages/i);
  assert.match(refused.message, /button|signature|flatten/i);
  assert.equal(target.getPageCount(), 1, "a refused merge leaves the page count alone");
  assert.equal(editor.formFields(target).fields.find((field) => field.name === "student").value, "target");
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
    { page: 1, type: "underline", color: "blue", areas: [{ x: 0.1, y: 0.5, width: 0.4, height: 0.03, color: "blue", style: "underline" }] },
    { page: 1, type: "strike", color: "red", areas: [{ x: 0.1, y: 0.6, width: 0.4, height: 0.03, color: "red", style: "strike" }] },
    { page: 1, type: "box", color: "green", areas: [{ x: 0.1, y: 0.7, width: 0.4, height: 0.08, color: "green", style: "box" }] },
    { page: 2, type: "text", color: "blue", boxes: [{ text: "Check this derivation again", x: 0.1, y: 0.6, width: 0.5, height: 0.15, size: 0.02, color: "blue" }] },
    highlight(9),
  ];
  const burned = await editor.flattenAnnotations(loaded.doc, annotations, { pageMap: [1, 2, 3, 4] });
  assert.equal(burned.ok, true);
  assert.equal(burned.pages, 2);
  assert.ok(burned.drawn >= 7, "every mark style is drawn");
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

test("keeps annotations on their own page after pages are reordered", async () => {
  const loaded = await editor.loadEditorDocument(await fixture());
  const beforeBytes = (await editor.savePdf(loaded.doc)).bytes;
  const before = await Promise.all([0, 1, 2, 3].map((index) => pageContent(beforeBytes, index)));

  const burned = await editor.flattenAnnotations(loaded.doc, [highlight(1)], { pageMap: [2, 3, 1, 4] });
  assert.equal(burned.ok, true);
  assert.equal(burned.pages, 1, "only the moved original page is touched");

  const afterBytes = (await editor.savePdf(loaded.doc)).bytes;
  const after = await Promise.all([0, 1, 2, 3].map((index) => pageContent(afterBytes, index)));
  assert.equal(after[0], before[0], "the page now in slot 1 did not receive the mark");
  assert.equal(after[1], before[1], "the page now in slot 2 did not receive the mark");
  assert.notEqual(after[2], before[2], "original page 1 received its mark in its new slot");
  assert.equal(after[3], before[3], "the last page did not receive the mark");
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

test("extracting pages from a form bakes the values in instead of dropping the form", async () => {
  const doc = await authorFixture();
  const extracted = await editor.extractPdfPages(doc, [0, 1]);
  assert.equal(extracted.ok, true, extracted.message);
  assert.equal(extracted.flattened, true, "the extracted copy is flattened first");
  assert.deepEqual(extracted.indexes, [0, 1]);
  const reopened = await PDFDocument.load(extracted.bytes);
  assert.equal(reopened.getPageCount(), 2);
  assert.deepEqual(reopened.getForm().getFields().map((field) => field.getName()), [], "no orphan fields without a form");
  const annots = reopened.getPage(0).node.Annots();
  assert.ok(!annots || annots.size() === 0, "the extracted page carries no dead widget annotation");
  assert.equal(editor.formFields(doc).fields.length, 1, "the edited document keeps its live form");
});

/** Adds a non-form link annotation to a page, so page copies can prove it survives. */
function addLinkAnnotation(doc, page) {
  const annot = doc.context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of("Link"),
    Rect: [20, 20, 180, 40],
    Border: [0, 0, 0],
    A: doc.context.obj({ S: PDFName.of("URI"), URI: "https://example.com/study" }),
  });
  const ref = doc.context.register(annot);
  const annots = page.node.Annots();
  if (annots) annots.push(ref);
  else page.node.set(PDFName.of("Annots"), doc.context.obj([ref]));
  return ref;
}

test("duplicating a form page creates a live, independently fillable copy", async () => {
  const doc = await authorFixture();
  addLinkAnnotation(doc, doc.getPage(0));
  const duplicated = await editor.duplicatePage(doc, 0);
  assert.equal(duplicated.ok, true, duplicated.message);
  assert.equal(duplicated.flattened, false, "a live duplicate is not flattened");
  assert.equal(duplicated.liveForm, true);
  assert.equal(duplicated.fields, 1, "one field was cloned");
  assert.equal(duplicated.pageCount, 4);

  const fields = editor.formFields(doc).fields;
  assert.deepEqual(fields.map((field) => field.name), ["student", "student_2"]);
  assert.equal(fields[0].page, 0, "the source field stays on the source page");
  assert.equal(fields[1].page, 1, "the cloned field sits on the duplicate");
  assert.equal(fields[0].value, "keep me");
  assert.equal(fields[1].value, "keep me");

  assert.equal(editor.setFieldValue(doc, "student_2", "copy value").ok, true);
  assert.equal(editor.formFields(doc).fields.find((field) => field.name === "student").value, "keep me", "filling the copy does not change the source");

  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  const form = reopened.getForm();
  assert.deepEqual(form.getFields().map((field) => field.getName()), ["student", "student_2"]);
  assert.equal(form.getTextField("student").getText(), "keep me");
  assert.equal(form.getTextField("student_2").getText(), "copy value");
  assert.equal(reopened.getPageCount(), 4);

  const pages = reopened.getPages();
  const widgetPage = (name) => {
    const widget = form.getTextField(name).acroField.getWidgets()[0];
    return pages.findIndex((page) => page.ref === widget.P());
  };
  assert.equal(widgetPage("student"), 0);
  assert.equal(widgetPage("student_2"), 1);
  const duplicateWidget = form.getTextField("student_2").acroField.getWidgets()[0];
  assert.ok(duplicateWidget.dict.get(PDFName.of("AP")), "the cloned widget has an appearance");
  assert.equal(form.getFields().filter((field) => field.getName().startsWith("student")).length, 2, "both names are registered in the AcroForm");

  const duplicateAnnots = reopened.getPage(1).node.Annots();
  const subtypes = duplicateAnnots.asArray().map((ref) => String(reopened.context.lookup(ref).get(PDFName.of("Subtype"))));
  assert.ok(subtypes.includes("/Widget"), "the live widget is on the duplicate");
  assert.ok(subtypes.includes("/Link"), "the non-widget link annotation survives the copy");
  assert.doesNotMatch(await pageContent(saved.bytes, 1), /FlatWidget/, "the duplicate is not a flattened appearance");
});

test("duplicating a page keeps checkbox and dropdown values in live cloned fields", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 500]);
  doc.addPage([400, 500]);
  const form = doc.getForm();
  const agree = form.createCheckBox("agree");
  agree.addToPage(doc.getPage(0), { x: 40, y: 350, width: 16, height: 16 });
  agree.check();
  const grade = form.createDropdown("grade");
  grade.addOptions(["A", "B"]);
  grade.addToPage(doc.getPage(0), { x: 40, y: 300, width: 80, height: 18 });
  grade.select("B");
  const duplicated = await editor.duplicatePage(doc, 0);
  assert.equal(duplicated.ok, true, duplicated.message);
  assert.equal(duplicated.fields, 2);
  const fields = editor.formFields(doc).fields;
  assert.deepEqual(fields.map((field) => field.name), ["agree", "grade", "agree_2", "grade_2"]);
  assert.deepEqual(fields.map((field) => field.value), [true, "B", true, "B"]);
  assert.deepEqual(fields.find((field) => field.name === "grade_2").options, ["A", "B"]);

  assert.equal(editor.setFieldValue(doc, "agree_2", false).ok, true);
  assert.equal(editor.setFieldValue(doc, "grade_2", "A").ok, true);
  assert.equal(editor.formFields(doc).fields.find((field) => field.name === "agree").value, true, "unchecking the copy leaves the source checked");
  assert.equal(editor.formFields(doc).fields.find((field) => field.name === "grade").value, "B", "changing the copy leaves the source selection alone");

  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  const reopenedForm = reopened.getForm();
  assert.equal(reopenedForm.getCheckBox("agree").isChecked(), true);
  assert.equal(reopenedForm.getCheckBox("agree_2").isChecked(), false);
  assert.deepEqual(reopenedForm.getDropdown("grade").getSelected(), ["B"]);
  assert.deepEqual(reopenedForm.getDropdown("grade_2").getSelected(), ["A"]);
});

test("duplicating twice creates distinct, collision-free live fields", async () => {
  const doc = await authorFixture();
  const first = await editor.duplicatePage(doc, 0);
  const second = await editor.duplicatePage(doc, 0);
  assert.equal(first.ok, true, first.message);
  assert.equal(second.ok, true, second.message);
  const fields = editor.formFields(doc).fields;
  assert.deepEqual(fields.map((field) => field.name), ["student", "student_2", "student_3"]);
  assert.equal(new Set(fields.map((field) => field.name)).size, 3);
  assert.equal(fields.find((field) => field.name === "student_3").page, 1, "the newest duplicate is first");
  assert.equal(fields.find((field) => field.name === "student_2").page, 2, "the first duplicate moved down with its page");
  assert.equal(fields.filter((field) => field.value === "keep me").length, 3);
});

test("duplicating a form page avoids an existing field name", async () => {
  const doc = await authorFixture();
  const existing = doc.getForm().createTextField("student_2");
  existing.addToPage(doc.getPage(1), { x: 40, y: 300, width: 120, height: 20 });
  existing.setText("already here");
  const duplicated = await editor.duplicatePage(doc, 0);
  assert.equal(duplicated.ok, true, duplicated.message);
  const fields = editor.formFields(doc).fields;
  assert.deepEqual(fields.map((field) => field.name), ["student", "student_2", "student_3"]);
  assert.equal(fields.find((field) => field.name === "student_2").value, "already here", "the existing field is untouched");
  assert.equal(fields.find((field) => field.name === "student_3").page, 1);
});

test("duplicating a page with an unsupported field refuses with a duplicate-page form message", async () => {
  const doc = await authorFixture();
  const button = doc.getForm().createButton("submit");
  button.addToPage("Submit", doc.getPage(0), { x: 240, y: 400, width: 80, height: 22 });
  const refused = await editor.duplicatePage(doc, 0);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "form");
  assert.match(refused.message, /duplicate-page/i);
  assert.match(refused.message, /button|signature|flatten/i);
  assert.equal(doc.getPageCount(), 3, "a refused duplicate leaves the page count alone");
  assert.equal(editor.formFields(doc).fields.find((field) => field.name === "student").value, "keep me");
});

test("reordering a form page keeps its live form and moves its widget without copying", async () => {
  const doc = await authorFixture();
  const moved = editor.movePage(doc, 0, 2);
  assert.equal(moved.ok, true, moved.message);
  assert.equal(moved.flattened, false, "a move does not flatten the live form");
  assert.equal(moved.liveForm, true, "the form stays live after the move");
  assert.equal(editor.formFields(doc).fields.length, 1);
  assert.equal(editor.formFields(doc).fields[0].page, 2, "the live field follows its page");
  assert.equal(editor.formFields(doc).fields[0].value, "keep me");

  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  assert.equal(reopened.getForm().getFields().length, 1, "the form survives a save");
  assert.equal(reopened.getForm().getTextField("student").getText(), "keep me", "the value survives a save");
  const pages = reopened.getPages();
  const widgets = reopened.getForm().getTextField("student").acroField.getWidgets();
  assert.equal(widgets.length, 1, "the field still has exactly one widget");
  assert.equal(pages.findIndex((page) => page.ref === widgets[0].P()), 2, "the widget moved with its page");
  const annots = pages.map((page) => {
    const entries = page.node.Annots();
    return entries ? entries.size() : 0;
  });
  assert.deepEqual(annots, [0, 0, 1], "only the moved page carries the live widget");
  assert.doesNotMatch(await pageContent(saved.bytes, 2), /FlatWidget/, "a move keeps the field interactive rather than baking it");
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
  const positioned = editor.formFields(reopened).fields.find((row) => row.name === "Agree");
  assert.ok(positioned.rect && positioned.rect.width > 0, "the field carries its widget rectangle for overlays");
  assert.equal(positioned.pageWidth, 400, "the field carries its page width");
  assert.equal(positioned.pageHeight, 500, "the field carries its page height");
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

test("draws a rectangle, an ellipse and a rule into the page content", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 500]);
  doc.addPage([400, 500]);
  const rect = editor.addShape(doc, { shape: "rectangle", pages: "all", width: 200, height: 100, color: "red" });
  assert.equal(rect.ok, true, rect.message);
  assert.equal(rect.drawn, 2);
  const ellipse = editor.addShape(doc, { shape: "ellipse", pages: 0, width: 120, height: 60, fill: "yellow" });
  assert.equal(ellipse.ok, true, ellipse.message);
  const rule = editor.addShape(doc, { shape: "line", pages: 1, width: 300, height: 20, color: "blue" });
  assert.equal(rule.ok, true, rule.message);
  const saved = await editor.savePdf(doc);
  const first = await pageContent(saved.bytes, 0);
  assert.match(first, /\b200 100 l\b/, "the rectangle is a four-corner path");
  assert.match(first, /\bc\b/, "the ellipse is drawn with Bézier curves");
  const second = await pageContent(saved.bytes, 1);
  assert.match(second, /\b200 100 l\b/, "the rectangle reached the second page too");
  assert.match(second, /\b350 \d+ l\b/, "the rule is one straight 300-point segment, centred on the page");
});

test("refuses shapes that are the wrong kind, too small, too large or off the page", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 500]);
  assert.equal(editor.addShape(doc, { shape: "star", pages: 0, width: 100, height: 100 }).reason, "shape");
  assert.equal(editor.addShape(doc, { shape: "rectangle", pages: 0, width: 2, height: 100 }).reason, "size");
  assert.equal(editor.addShape(doc, { shape: "rectangle", pages: 0, width: 2001, height: 100 }).reason, "size");
  assert.equal(editor.addShape(doc, { shape: "rectangle", pages: 0, width: 500, height: 100 }).reason, "size");
  assert.equal(editor.addShape(doc, { shape: "rectangle", pages: 4, width: 100, height: 100 }).reason, "index");
  assert.equal(editor.addShape(doc, { shape: "rectangle", pages: 0, width: 200, height: 100 }).drawn, 1);
  doc.getPage(0).setRotation(degrees(90));
  assert.equal(editor.addShape(doc, { shape: "rectangle", pages: 0, width: 100, height: 100 }).reason, "rotation");
});

test("resizes pages to A4, Letter and a custom size, skipping pages already there", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([595.28, 841.89]);
  const a4 = editor.resizePages(doc, { size: "a4", pages: "all" });
  assert.equal(a4.ok, true, a4.message);
  assert.equal(a4.resized, 1);
  assert.equal(a4.skipped, 1, "the page already at A4 is left alone");
  assert.equal(a4.size, "a4");
  assert.equal(a4.scales.length, 1);
  assert.ok(Math.abs(a4.scales[0].scale - 595.28 / 612) < 1e-9, "the Letter page scales by its width");
  const letter = editor.resizePages(doc, { size: "letter", pages: 0 });
  assert.equal(letter.ok, true, letter.message);
  assert.equal(letter.resized, 1);
  const custom = editor.resizePages(doc, { width: 300, height: 300, pages: 1 });
  assert.equal(custom.ok, true, custom.message);
  assert.equal(custom.size, "custom");
  const saved = await editor.savePdf(doc);
  const back = await PDFDocument.load(saved.bytes);
  assert.deepEqual(back.getPage(0).getSize(), { width: 612, height: 792 });
  assert.deepEqual(back.getPage(1).getSize(), { width: 300, height: 300 });
  assert.deepEqual(back.getPage(1).getCropBox(), { x: 0, y: 0, width: 300, height: 300 });
});

test("refuses a resize on a rotated page, a form PDF or a size that is not a page", async () => {
  const form = await PDFDocument.load(await fixture());
  const refused = editor.resizePages(form, { size: "a4" });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "form", "a live form would no longer line up");
  const rotated = await PDFDocument.create();
  rotated.addPage([400, 500]).setRotation(degrees(90));
  assert.equal(editor.resizePages(rotated, { size: "a4" }).reason, "rotation");
  const plain = await PDFDocument.create();
  plain.addPage([400, 500]);
  assert.equal(editor.resizePages(plain, { width: 10, height: 10 }).reason, "size");
  assert.equal(editor.resizePages(plain, { width: 6000, height: 6000 }).reason, "size");
  assert.equal(editor.resizePages(plain, { pages: 2, size: "a4" }).reason, "index");
});

test("rotates a page through 90, 180 and 270 degrees and refuses any other angle", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 500]);
  assert.deepEqual(editor.rotatePage(doc, 0, 90), { ok: true, index: 0, rotation: 90 });
  assert.equal(editor.pageList(doc)[0].rotation, 90);
  assert.equal(editor.rotatePage(doc, 0, 90).rotation, 180);
  assert.equal(editor.rotatePage(doc, 0, 90).rotation, 270);
  assert.equal(editor.rotatePage(doc, 0, -270).rotation, 0);
  for (const angle of [45, -45, 1, 91]) {
    const refused = editor.rotatePage(doc, 0, angle);
    assert.equal(refused.ok, false, `${angle} degrees is refused`);
    assert.equal(refused.reason, "rotation");
    assert.match(refused.message, /multiple of 90/);
  }
  assert.equal(editor.pageList(doc)[0].rotation, 0, "a refused rotation changes nothing");
  const missing = editor.rotatePage(doc, 4, 90);
  assert.equal(missing.reason, "index");
  assert.match(missing.message, /not in this PDF/);
  editor.rotatePage(doc, 0, 270);
  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  assert.equal(reopened.getPage(0).getRotation().angle, 270, "the rotation survives a save");
});

test("moves a page to a new position and refuses a target outside the file", async () => {
  const doc = await PDFDocument.create();
  for (const size of [[400, 500], [410, 510], [420, 520]]) doc.addPage(size);
  const widths = () => doc.getPages().map((page) => Math.round(page.getSize().width));
  assert.deepEqual(editor.movePage(doc, 0, 2), { ok: true, moved: true, pageCount: 3, flattened: false, liveForm: false });
  assert.deepEqual(widths(), [410, 420, 400], "the page really moved to the end");
  assert.deepEqual(editor.movePage(doc, 1, 1), { ok: true, moved: false, pageCount: 3, flattened: false, liveForm: false });
  assert.deepEqual(widths(), [410, 420, 400], "moving onto itself changes nothing");
  for (const target of [3, -1, 9]) {
    const refused = editor.movePage(doc, 0, target);
    assert.equal(refused.ok, false, `${target} is outside the file`);
    assert.equal(refused.reason, "index");
    assert.match(refused.message, /not in this PDF/);
  }
  assert.equal(editor.movePage(doc, 7, 0).reason, "index", "the source page has to exist");
  assert.deepEqual(widths(), [410, 420, 400], "refusals leave the order alone");
  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  assert.deepEqual(
    reopened.getPages().map((page) => Math.round(page.getSize().width)),
    [410, 420, 400],
    "the new order survives a save",
  );
});

test("inserts a blank page at a chosen position with its own size and refuses one outside the file", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 500]);
  doc.addPage([410, 510]);
  const first = editor.addBlankPage(doc, 0, { width: 300, height: 320 });
  assert.equal(first.ok, true, first.message);
  assert.equal(first.index, 0, "the blank page went in first");
  assert.equal(first.pageCount, 3);
  assert.deepEqual(
    editor.pageList(doc).map((page) => [Math.round(page.width), Math.round(page.height)]),
    [[300, 320], [400, 500], [410, 510]],
    "the new page is first and the others kept their order",
  );
  const middle = editor.addBlankPage(doc, 2, { width: 200, height: 240 });
  assert.equal(middle.ok, true, middle.message);
  assert.equal(middle.index, 2);
  assert.deepEqual(editor.pageList(doc)[2].width, 200);
  for (const position of [5, -1, 2.5]) {
    const refused = editor.addBlankPage(doc, position);
    assert.equal(refused.ok, false, `${position} is not a position in a 4-page PDF`);
    assert.equal(refused.reason, "index");
    assert.match(refused.message, /cannot go at position/);
  }
  const appended = editor.addBlankPage(doc);
  assert.equal(appended.ok, true);
  assert.equal(appended.index, 4, "no position means the end");
  const saved = await editor.savePdf(doc);
  const reopened = await PDFDocument.load(saved.bytes);
  assert.equal(reopened.getPageCount(), 5);
  assert.deepEqual(reopened.getPage(0).getSize(), { width: 300, height: 320 });
  assert.deepEqual(reopened.getPage(2).getSize(), { width: 200, height: 240 });
  assert.deepEqual(reopened.getPage(4).getSize(), {
    width: editor.DEFAULT_PAGE[0],
    height: editor.DEFAULT_PAGE[1],
  });
});

test("refuses to delete the last page and refuses a page that is not in the file", async () => {
  const single = await PDFDocument.create();
  single.addPage([400, 500]);
  const refused = editor.deletePage(single, 0);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "last-page");
  assert.match(refused.message, /at least one page/i);
  assert.equal(editor.pageList(single).length, 1, "the page is still there");
  assert.equal(editor.deletePage(single, 3).reason, "index");
  const two = await PDFDocument.create();
  two.addPage([400, 500]);
  two.addPage([410, 510]);
  const removed = editor.deletePage(two, 1);
  assert.equal(removed.ok, true);
  assert.equal(removed.pageCount, 1);
  assert.equal(editor.pageList(two)[0].width, 400, "the right page was removed");
});

test("a URL link is stored as a link annotation and reads back unchanged", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  assert.equal(opened.ok, true);
  assert.equal(editor.readLinks(opened.doc).total, 0);
  const added = editor.addLink(opened.doc, {
    target: "url",
    url: "https://example.com/atp",
    area: { x: 0.1, y: 0.2, width: 0.4, height: 0.05 },
    pages: 0,
  });
  assert.equal(added.ok, true);
  assert.equal(added.pages, 1);
  const saved = await editor.savePdf(opened.doc);
  const links = editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc);
  assert.equal(links.total, 1);
  assert.deepEqual(links.links[0], {
    page: 1,
    target: "url",
    url: "https://example.com/atp",
    to: 0,
    area: { x: 0.1, y: 0.2, width: 0.4, height: 0.05 },
  });
  assert.equal((await pageContent(saved.bytes, 0)).includes("example.com"), false, "a link draws nothing into the page");
});

test("a page-jump link points at the chosen page and survives a save", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  const added = editor.addLink(opened.doc, {
    target: "page",
    to: 3,
    area: { x: 0.5, y: 0.5, width: 0.2, height: 0.1 },
    pages: [1, 2],
  });
  assert.equal(added.ok, true);
  assert.equal(added.pages, 2);
  const saved = await editor.savePdf(opened.doc);
  const links = editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc);
  assert.equal(links.total, 2);
  assert.deepEqual(links.links.map((row) => [row.page, row.target, row.to]), [[2, "page", 3], [3, "page", 3]]);
});

test("a link on a rotated page keeps the same visible area", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([400, 500]).setRotation(degrees(90));
  const opened = await editor.loadEditorDocument(await doc.save());
  const added = editor.addLink(opened.doc, {
    target: "url",
    url: "https://example.com/rotated",
    area: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
    pages: 0,
  });
  assert.equal(added.ok, true);
  const saved = await editor.savePdf(opened.doc);
  const links = editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc);
  assert.deepEqual(links.links[0].area, { x: 0.1, y: 0.2, width: 0.3, height: 0.1 });
});

test("refuses a link without a usable address, page or area", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  const area = { x: 0.1, y: 0.1, width: 0.2, height: 0.05 };
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "", area }).reason, "empty");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "javascript:alert(1)", area }).reason, "scheme");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "data:text/html,x", area }).reason, "scheme");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "file:///etc/passwd", area }).reason, "scheme");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: `https://example.com/${"a".repeat(3000)}`, area }).reason, "url");
  assert.equal(editor.addLink(opened.doc, { target: "page", to: 5, area }).reason, "page");
  assert.equal(editor.addLink(opened.doc, { target: "page", to: 0, area }).reason, "page");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "https://example.com", area: { x: 0.9, y: 0.1, width: 0.4, height: 0.1 } }).reason, "area");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "https://example.com", area: { x: 0.1, y: 0.1, width: 0, height: 0.1 } }).reason, "area");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "https://example.com", area: { x: 0.1, y: 0.1, width: 0.0005, height: 0.1 } }).reason, "area");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "https://example.com", area: { x: "left", y: 0.1, width: 0.2, height: 0.05 } }).reason, "area");
  assert.equal(editor.addLink(opened.doc, { target: "url", url: "https://example.com", area, pages: 9 }).reason, "index");
  assert.equal(editor.readLinks(opened.doc).total, 0, "a refused link is not added");
});

test("writes a nested document outline and reads it back after a save", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  const written = editor.setOutline(opened.doc, [
    { title: "Unit 1", page: 1 },
    { title: "Cells", page: 2, level: 1 },
    { title: "ATP", page: 3, level: 2 },
    { title: "Unit 2", page: 4 },
  ]);
  assert.equal(written.ok, true);
  assert.equal(written.written, 4);
  assert.equal(written.depth, 3);
  const saved = await editor.savePdf(opened.doc);
  const outline = editor.readOutline((await editor.loadEditorDocument(saved.bytes)).doc);
  assert.equal(outline.total, 4);
  assert.deepEqual(outline.entries, [
    { title: "Unit 1", page: 1, level: 0 },
    { title: "Cells", page: 2, level: 1 },
    { title: "ATP", page: 3, level: 2 },
    { title: "Unit 2", page: 4, level: 0 },
  ]);
  const raw = await PDFDocument.load(saved.bytes);
  const root = raw.catalog.lookup(PDFName.of("Outlines"), PDFDict);
  assert.ok(root, "the catalog carries an outline");
  assert.equal(root.lookup(PDFName.of("Count")).asNumber(), 4);
  const first = raw.context.lookup(root.lookup(PDFName.of("First")), PDFDict);
  assert.equal(first.lookup(PDFName.of("Count")).asNumber(), 2, "the first item counts its two descendants");
  assert.equal(first.lookup(PDFName.of("Next")).toString(), root.lookup(PDFName.of("Last")).toString(), "the second top-level item follows it");

  const replaced = editor.setOutline(opened.doc, [{ title: "Only", page: 2 }]);
  assert.equal(replaced.written, 1);
  const replacedRead = editor.readOutline((await editor.loadEditorDocument((await editor.savePdf(opened.doc)).bytes)).doc);
  assert.deepEqual(replacedRead.entries, [{ title: "Only", page: 2, level: 0 }]);
});

test("clears an outline, and refuses one that cannot be written", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  editor.setOutline(opened.doc, [{ title: "Unit 1", page: 1 }]);
  const cleared = editor.setOutline(opened.doc, []);
  assert.equal(cleared.ok, true);
  assert.equal(cleared.written, 0);
  assert.equal(editor.readOutline(opened.doc).total, 0);
  assert.equal((await editor.loadEditorDocument((await editor.savePdf(opened.doc)).bytes)).doc.catalog.lookupMaybe(PDFName.of("Outlines"), PDFDict), undefined);

  assert.equal(editor.setOutline(opened.doc, [{ title: "", page: 1 }]).reason, "title");
  assert.equal(editor.setOutline(opened.doc, [{ title: "x".repeat(200), page: 1 }]).reason, "title");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 0 }]).reason, "page");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 9 }]).reason, "page");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 1, level: 1 }]).reason, "level");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 1 }, { title: "B", page: 2, level: 2 }]).reason, "level");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 1 }, { title: "B", page: 2, level: 3 }]).reason, "level");
  const many = Array.from({ length: 201 }, (unused, index) => ({ title: `Part ${index}`, page: 1 }));
  assert.equal(editor.setOutline(opened.doc, many).reason, "size");
  assert.equal(editor.setOutline(opened.doc, "nope").reason, "shape");
});

test("bookmark text round-trips through the textarea format", () => {
  const parsed = editor.parseBookmarkText("Unit 1 | 1\n  Cells | 2\n    ATP | 3\n\nUnit 2 | 4");
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.entries, [
    { title: "Unit 1", page: 1, level: 0 },
    { title: "Cells", page: 2, level: 1 },
    { title: "ATP", page: 3, level: 2 },
    { title: "Unit 2", page: 4, level: 0 },
  ]);
  assert.equal(parsed.depth, 3);
  assert.equal(editor.formatBookmarkText(parsed.entries), "Unit 1 | 1\n  Cells | 2\n    ATP | 3\nUnit 2 | 4");
  assert.equal(editor.formatBookmarkText([]), "");
  assert.deepEqual(editor.parseBookmarkText("").entries, []);
  assert.equal(editor.parseBookmarkText("Unit 1").reason, "format");
  assert.equal(editor.parseBookmarkText(" | 2").reason, "title");
  assert.equal(editor.parseBookmarkText("Intro | two").reason, "format");
  assert.equal(editor.parseBookmarkText("Intro | 1.5").reason, "format");
});

test("reads a link whose destination is an indirect object", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.addPage([200, 200]);
  const context = doc.context;
  const dest = context.register(context.obj([doc.getPage(1).ref, PDFName.of("Fit")]));
  const annot = context.obj({ Type: "Annot", Subtype: "Link", Rect: [10, 10, 60, 30], Border: [0, 0, 0] });
  annot.set(PDFName.of("Dest"), dest);
  doc.getPage(0).node.addAnnot(context.register(annot));
  const links = editor.readLinks((await editor.loadEditorDocument(await doc.save())).doc);
  assert.deepEqual(links.links.map((row) => [row.page, row.target, row.to]), [[1, "page", 2]]);
});

test("renames a form field, keeping its value and its widget", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  assert.equal(editor.setFieldValue(opened.doc, "student", "Ada").ok, true);
  const annots = opened.doc.getPage(0).node.Annots().size();
  const renamed = editor.renameFormField(opened.doc, "student", "pupil");
  assert.equal(renamed.ok, true);
  assert.deepEqual([renamed.from, renamed.to, renamed.kind], ["student", "pupil", "text"]);
  assert.equal(opened.doc.getPage(0).node.Annots().size(), annots, "the widget stays on its page");
  const saved = await editor.savePdf(opened.doc);
  const reopened = await editor.loadEditorDocument(saved.bytes);
  const rows = editor.formFields(reopened.doc).fields;
  assert.equal(rows.some((row) => row.name === "student"), false);
  const pupil = rows.find((row) => row.name === "pupil");
  assert.equal(pupil.value, "Ada", "the value follows the name");
  assert.equal(pupil.page, 0);
  assert.equal(editor.setFieldValue(reopened.doc, "pupil", "Grace").ok, true, "the renamed field is still fillable");
});

test("deletes a form field and takes its widget off the page", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  const before = opened.doc.getPage(1).node.Annots().size();
  const removed = editor.deleteFormField(opened.doc, "grade");
  assert.equal(removed.ok, true);
  assert.equal(removed.widgets, 1);
  assert.equal(removed.fields, 2);
  assert.equal(opened.doc.getPage(1).node.Annots().size(), before - 1, "the widget annotation is gone");
  const saved = await editor.savePdf(opened.doc);
  const reopened = await editor.loadEditorDocument(saved.bytes);
  assert.deepEqual(editor.formFields(reopened.doc).fields.map((row) => row.name).sort(), ["agree", "student"]);
  assert.equal(editor.setFieldValue(reopened.doc, "student", "still here").ok, true, "the other fields stay live");
  assert.equal(editor.deleteFormField(reopened.doc, "grade").reason, "missing");
});

test("refuses to rename or delete a field that is missing, empty or duplicated", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  assert.equal(editor.deleteFormField(opened.doc, "").reason, "empty");
  assert.equal(editor.deleteFormField(opened.doc, "nope").reason, "missing");
  assert.equal(editor.renameFormField(opened.doc, "", "x").reason, "empty");
  assert.equal(editor.renameFormField(opened.doc, "nope", "x").reason, "missing");
  assert.equal(editor.renameFormField(opened.doc, "student", "").reason, "name");
  assert.equal(editor.renameFormField(opened.doc, "student", "student").reason, "name");
  assert.equal(editor.renameFormField(opened.doc, "student", "agree").reason, "duplicate");
  assert.equal(editor.formFields(opened.doc).fields.length, 3, "nothing was removed or renamed");
  const long = "x".repeat(200);
  const trimmed = editor.renameFormField(opened.doc, "student", long);
  assert.equal(trimmed.ok, true);
  assert.equal(trimmed.to.length, editor.MAX_FIELD_NAME);
});

test("removes one link by its number and leaves the others", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  editor.addLink(opened.doc, { target: "url", url: "https://example.com/one", area: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 }, pages: 0 });
  editor.addLink(opened.doc, { target: "page", to: 3, area: { x: 0.5, y: 0.5, width: 0.2, height: 0.1 }, pages: 1 });
  const removed = editor.removeLinks(opened.doc, { index: 1 });
  assert.equal(removed.ok, true);
  assert.deepEqual([removed.removed, removed.left, removed.pages], [1, 1, [1]]);
  const saved = await editor.savePdf(opened.doc);
  const links = editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc);
  assert.equal(links.total, 1);
  assert.deepEqual([links.links[0].page, links.links[0].target, links.links[0].to], [2, "page", 3]);
  assert.equal((await pageContent(saved.bytes, 0)).includes("Page 1"), true, "the page content is untouched");
});

test("removes every link, and refuses a missing link or a linkless file", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  assert.equal(editor.removeLinks(opened.doc, { all: true }).reason, "empty");
  editor.addLink(opened.doc, { target: "url", url: "https://example.com/a", area: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 }, pages: 0 });
  editor.addLink(opened.doc, { target: "url", url: "https://example.com/b", area: { x: 0.1, y: 0.3, width: 0.2, height: 0.05 }, pages: 2 });
  assert.equal(editor.removeLinks(opened.doc, { index: 0 }).reason, "index");
  assert.equal(editor.removeLinks(opened.doc, { index: 3 }).reason, "index");
  const all = editor.removeLinks(opened.doc, { all: true });
  assert.equal(all.ok, true);
  assert.deepEqual([all.removed, all.left, all.pages], [2, 0, [1, 3]]);
  const saved = await editor.savePdf(opened.doc);
  assert.equal(editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc).total, 0);
  assert.equal(editor.removeLinks(opened.doc, { all: true }).reason, "empty", "removing twice has nothing left to do");
});

test("writes bookmark destinations with a zoom and a position", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  const written = editor.setOutline(opened.doc, [{ title: "Unit 1", page: 2 }, { title: "Cells", page: 3, level: 1 }], { zoom: 150, top: 25 });
  assert.equal(written.ok, true);
  assert.deepEqual(written.view, { zoom: 150, top: 25 });
  const saved = await editor.savePdf(opened.doc);
  assert.deepEqual(editor.readOutline((await editor.loadEditorDocument(saved.bytes)).doc).entries, [
    { title: "Unit 1", page: 2, level: 0, zoom: 150, top: 25 },
    { title: "Cells", page: 3, level: 1, zoom: 150, top: 25 },
  ]);
  const raw = await PDFDocument.load(saved.bytes);
  const root = raw.catalog.lookup(PDFName.of("Outlines"), PDFDict);
  const first = raw.context.lookup(root.lookup(PDFName.of("First")), PDFDict);
  const dest = first.lookup(PDFName.of("Dest"));
  assert.equal(dest.get(1).toString(), "/XYZ", "the destination names a view");
  assert.equal(dest.get(2).asNumber(), 0);
  assert.equal(dest.get(3).asNumber(), 375, "25% down a 500 point page");
  assert.equal(dest.get(4).asNumber(), 1.5, "150% zoom is 1.5");

  const plain = editor.setOutline(opened.doc, [{ title: "Plain", page: 1 }]);
  assert.equal(plain.view, null);
  const plainRow = editor.readOutline((await editor.loadEditorDocument((await editor.savePdf(opened.doc)).bytes)).doc).entries[0];
  assert.equal("zoom" in plainRow, false, "a whole-page bookmark carries no zoom");
});

test("refuses an unusable bookmark zoom or position", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 1 }], { zoom: 5 }).reason, "zoom");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 1 }], { zoom: 401 }).reason, "zoom");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 1 }], { zoom: "wide" }).reason, "zoom");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 1 }], { zoom: 100, top: -1 }).reason, "top");
  assert.equal(editor.setOutline(opened.doc, [{ title: "A", page: 1 }], { zoom: 100, top: 101 }).reason, "top");
  assert.equal(editor.readOutline(opened.doc).total, 0, "a refused view writes nothing");

  const topOnly = editor.setOutline(opened.doc, [{ title: "A", page: 1 }], { top: 40 });
  assert.equal(topOnly.ok, true);
  const rows = editor.readOutline((await editor.loadEditorDocument((await editor.savePdf(opened.doc)).bytes)).doc).entries;
  assert.deepEqual([rows[0].zoom, rows[0].top], [0, 40], "a position on its own keeps the viewer's zoom");
});

test("retargets an existing link and keeps its page and area", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  editor.addLink(opened.doc, { target: "url", url: "https://example.com/old", area: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 }, pages: 0 });
  const before = editor.readLinks(opened.doc).links[0];
  const changed = editor.updateLink(opened.doc, { index: 1, target: "url", url: "https://example.com/new" });
  assert.equal(changed.ok, true);
  assert.deepEqual([changed.page, changed.target, changed.url], [1, "url", "https://example.com/new"]);
  const saved = await editor.savePdf(opened.doc);
  const after = editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc).links;
  assert.equal(after.length, 1, "no second annotation is added");
  assert.deepEqual([after[0].page, after[0].target, after[0].url], [1, "url", "https://example.com/new"]);
  assert.deepEqual(after[0].area, before.area, "the clickable area stays exactly where it was");
});

test("turns a link into a page jump and back into an address", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  editor.addLink(opened.doc, { target: "url", url: "https://example.com/a", area: { x: 0.5, y: 0.5, width: 0.2, height: 0.1 }, pages: 1 });
  const jumped = editor.updateLink(opened.doc, { index: 1, target: "page", to: 4 });
  assert.deepEqual([jumped.target, jumped.to, jumped.page], ["page", 4, 2], "the link stays on its own page");
  const saved = await editor.savePdf(opened.doc);
  const rows = editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc).links;
  assert.deepEqual([rows[0].target, rows[0].to, rows[0].url], ["page", 4, ""]);
  const raw = await PDFDocument.load(saved.bytes);
  const annot = raw.context.lookup(raw.getPage(1).node.Annots().asArray()[0], PDFDict);
  assert.equal(annot.lookupMaybe(PDFName.of("A"), PDFDict), undefined, "the old address action is gone");
  const back = editor.updateLink(opened.doc, { index: 1, target: "url", url: "https://example.com/b" });
  assert.equal(back.url, "https://example.com/b");
  assert.equal(editor.readLinks(opened.doc).links[0].to, 0, "the page jump is replaced, not kept");
});

test("refuses a link edit that cannot be applied", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  assert.equal(editor.updateLink(opened.doc, { index: 1, target: "url", url: "https://example.com/a" }).reason, "empty");
  editor.addLink(opened.doc, { target: "url", url: "https://example.com/keep", area: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 }, pages: 0 });
  assert.equal(editor.updateLink(opened.doc, { index: 0, target: "url", url: "https://example.com/a" }).reason, "index");
  assert.equal(editor.updateLink(opened.doc, { index: 2, target: "url", url: "https://example.com/a" }).reason, "index");
  assert.equal(editor.updateLink(opened.doc, { index: 1, target: "url", url: "" }).reason, "empty");
  assert.equal(editor.updateLink(opened.doc, { index: 1, target: "url", url: "javascript:alert(1)" }).reason, "scheme");
  assert.equal(editor.updateLink(opened.doc, { index: 1, target: "url", url: `https://example.com/${"a".repeat(2000)}` }).reason, "url");
  assert.equal(editor.updateLink(opened.doc, { index: 1, target: "page", to: 9 }).reason, "page");
  assert.equal(editor.readLinks(opened.doc).links[0].url, "https://example.com/keep", "a refused edit changes nothing");
});

/** The first /Link annotation on a page of a reloaded document, not a form widget. */
function linkAnnotation(doc, pageIndex) {
  for (const ref of doc.getPage(pageIndex).node.Annots().asArray()) {
    const dict = doc.context.lookup(ref, PDFDict);
    if (dict && String(dict.get(PDFName.of("Subtype"))) === "/Link") return dict;
  }
  return null;
}

test("moves a link rectangle and keeps its annotation and address", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  editor.addLink(opened.doc, { target: "url", url: "https://example.com/keep", area: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 }, pages: 0 });
  const moved = editor.updateLink(opened.doc, { index: 1, area: { x: 0.5, y: 0.6, width: 0.25, height: 0.1 } });
  assert.equal(moved.ok, true);
  assert.equal(moved.moved, true);
  const saved = await editor.savePdf(opened.doc);
  const links = editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc);
  assert.equal(links.total, 1, "the same single annotation is edited, not replaced");
  assert.equal(links.links[0].url, "https://example.com/keep", "the address is untouched");
  const raw = await PDFDocument.load(saved.bytes);
  const annot = linkAnnotation(raw, 0);
  assert.ok(annot, "the link annotation is still there");
  const rect = annot.lookup(PDFName.of("Rect"));
  const corners = [rect.get(0).asNumber(), rect.get(1).asNumber(), rect.get(2).asNumber(), rect.get(3).asNumber()].map((value) => Math.round(value * 100) / 100);
  assert.deepEqual(corners, [200, 150, 300, 200], "the new box is written to /Rect in PDF points");
  assert.deepEqual([annot.lookup(PDFName.of("Border")).get(0).asNumber(), annot.lookup(PDFName.of("F")).asNumber()], [0, 4], "border and flags survive");
});

test("moves the rectangle and retargets in the same edit", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  editor.addLink(opened.doc, { target: "page", to: 3, area: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 }, pages: 1 });
  const changed = editor.updateLink(opened.doc, {
    index: 1,
    target: "url",
    url: "https://example.com/moved",
    area: { x: 0, y: 0, width: 0.5, height: 0.2 },
  });
  assert.deepEqual([changed.ok, changed.page, changed.target, changed.url], [true, 2, "url", "https://example.com/moved"]);
  const saved = await editor.savePdf(opened.doc);
  const rows = editor.readLinks((await editor.loadEditorDocument(saved.bytes)).doc).links;
  assert.deepEqual([rows.length, rows[0].page, rows[0].url, rows[0].to], [1, 2, "https://example.com/moved", 0]);
  const area = rows[0].area;
  assert.ok(Math.abs(area.width - 0.5) < 0.01 && Math.abs(area.height - 0.2) < 0.01, `moved area is ${JSON.stringify(area)}`);
});

test("refuses an unusable link rectangle", async () => {
  const opened = await editor.loadEditorDocument(await fixture());
  assert.equal(editor.updateLink(opened.doc, { index: 1, area: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } }).reason, "empty");
  editor.addLink(opened.doc, { target: "url", url: "https://example.com/keep", area: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 }, pages: 0 });
  assert.equal(editor.updateLink(opened.doc, { index: 0, area: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } }).reason, "index");
  assert.equal(editor.updateLink(opened.doc, { index: 2, area: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } }).reason, "index");
  assert.equal(editor.updateLink(opened.doc, { index: 1, area: { x: "left", y: 0.1, width: 0.2, height: 0.1 } }).reason, "area");
  assert.equal(editor.updateLink(opened.doc, { index: 1, area: { x: 0.1, y: 0.1, width: 0, height: 0.1 } }).reason, "area");
  assert.equal(editor.updateLink(opened.doc, { index: 1, area: { x: 0.1, y: 0.1, width: 0.2, height: -0.1 } }).reason, "area");
  assert.equal(editor.updateLink(opened.doc, { index: 1, area: { x: 0.9, y: 0.1, width: 0.5, height: 0.1 } }).reason, "area");
  assert.equal(editor.updateLink(opened.doc, { index: 1, area: { x: 0.1, y: 0.1, width: 0.2 } }).reason, "area");
  assert.equal(editor.updateLink(opened.doc, { index: 1, target: "page", to: 9, area: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 } }).reason, "page");
  const raw = await PDFDocument.load((await editor.savePdf(opened.doc)).bytes);
  const annot = linkAnnotation(raw, 0);
  const rect = annot.lookup(PDFName.of("Rect"));
  const kept = [rect.get(0).asNumber(), rect.get(1).asNumber(), rect.get(2).asNumber(), rect.get(3).asNumber()].map((value) => Math.round(value * 100) / 100);
  assert.deepEqual(kept, [40, 425, 120, 450], "a refused edit leaves the original rectangle alone");
  assert.equal(editor.readLinks((await editor.loadEditorDocument((await editor.savePdf(opened.doc)).bytes)).doc).links[0].url, "https://example.com/keep");
});
