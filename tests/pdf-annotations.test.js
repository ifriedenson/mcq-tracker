"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();
const pdf = T.pdfAnnotations;

test("pdf annotations: sidecar paths and content hashes", () => {
  assert.equal(pdf.sidecarPathFor("Papers/Exam.pdf"), "Papers/Exam.annotations.md");
  assert.equal(pdf.sidecarPathFor("Papers/Exam.PDF"), "Papers/Exam.annotations.md");
  assert.equal(pdf.pdfPathFromSidecar("Papers/Exam.annotations.md"), "Papers/Exam.pdf");
  const a = pdf.hashBytes(new Uint8Array([1, 2, 3, 4]));
  const b = pdf.hashBytes(new Uint8Array([1, 2, 3, 5]));
  assert.notEqual(a, b);
  assert.equal(pdf.hashBytes(new Uint8Array([1, 2, 3, 4])), a);
});

test("pdf annotations: serialize, parse, add and remove round-trip", () => {
  let saved = pdf.upsertAnnotation(
    "",
    { page: 2, type: "highlight", color: "yellow", quote: "The mitochondria", note: "Energy." },
    { pdfPath: "Bio/Unit 3.pdf", pdfHash: "abc123" }
  );
  assert.equal(saved.annotations.length, 1);
  assert.match(saved.text, /pdf_hash: "abc123"/);
  assert.match(saved.text, /Page 2/);
  const parsed = pdf.parseAnnotationFile(saved.text);
  assert.equal(parsed.pdfPath, "Bio/Unit 3.pdf");
  assert.equal(parsed.annotations[0].quote, "The mitochondria");
  assert.equal(parsed.annotations[0].note, "Energy.");

  const added = pdf.upsertAnnotation(saved.text, { page: 1, type: "note", note: "Read again" }, { pdfPath: "Bio/Unit 3.pdf", pdfHash: "abc123" });
  assert.equal(added.annotations.length, 2);
  assert.equal(added.annotations[0].page, 1);
  assert.equal(pdf.annotationsForPage(added.annotations, 2).length, 1);

  const removed = pdf.removeAnnotation(added.text, added.annotations[0].id, { pdfPath: "Bio/Unit 3.pdf", pdfHash: "abc123" });
  assert.equal(removed.annotations.length, 1);
  assert.equal(removed.annotations[0].page, 2);
});

test("pdf annotations: an empty or damaged sidecar fails safely", () => {
  assert.deepEqual(pdf.parseAnnotationFile(""), { pdfPath: "", pdfHash: "", annotations: [] });
  assert.throws(() => pdf.parseAnnotationFile("```mcq-pdf-annotations\n{ nope\n```"), /damaged/);
  assert.throws(() => pdf.normalizeAnnotation({ page: 0 }), /quote, note or text/);
  assert.equal(pdf.normalizeAnnotation({ page: 3, note: "x" }).page, 3);
});

test("pdf annotations: highlight areas and their notes round-trip through the sidecar", () => {
  const area = T.pdfInk.normalizeHighlightArea({ x: 0.1, y: 0.2, width: 0.3, height: 0.08, color: "yellow", note: "Compare with unit 2." });
  const saved = pdf.upsertAnnotation("", { page: 5, type: "highlight", color: "yellow", areas: [area] }, { pdfPath: "Papers/Exam.pdf", pdfHash: "hash" });
  assert.match(saved.text, /1 highlighted area/);
  assert.match(saved.text, /Compare with unit 2\./);
  const parsed = pdf.parseAnnotationFile(saved.text);
  assert.equal(parsed.annotations[0].type, "highlight");
  assert.deepEqual(parsed.annotations[0].areas, [area]);
  assert.throws(() => pdf.normalizeAnnotation({ page: 1, type: "highlight" }), /quote, note or text/);
});
