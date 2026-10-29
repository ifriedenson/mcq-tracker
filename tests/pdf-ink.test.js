"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ink = T.pdfInk;
const pdf = T.pdfAnnotations;

test("pdf ink: strokes are clamped, rounded and reduced to valid points", () => {
  const stroke = ink.normalizeInkStroke({
    tool: "highlighter",
    color: "green",
    width: 0.5,
    opacity: 5,
    points: [
      [-1, 0.2],
      [1.23456, 1.98765],
      ["nope", 0.5],
      [0.3, Number.NaN],
    ],
  });
  assert.equal(stroke.tool, "highlighter");
  assert.equal(stroke.color, "green");
  assert.equal(stroke.width, 0.08);
  assert.equal(stroke.opacity, 1);
  assert.deepEqual(stroke.points, [
    [0, 0.2],
    [1, 1],
  ]);
  assert.equal(ink.normalizeInkStroke({ points: [] }), null);
  assert.equal(ink.normalizeInkStroke({ points: [["x", "y"]] }), null);
});

test("pdf ink: points and strokes are capped so a sidecar cannot grow without limit", () => {
  const points = Array.from({ length: ink.MAX_INK_POINTS + 10 }, (_, i) => [i / (ink.MAX_INK_POINTS + 10), 0.5]);
  const stroke = ink.normalizeInkStroke({ points });
  assert.equal(stroke.points.length, ink.MAX_INK_POINTS);
  const strokes = Array.from({ length: ink.MAX_INK_STROKES + 5 }, () => stroke);
  assert.equal(ink.normalizeInkStrokes(strokes).length, ink.MAX_INK_STROKES);
});

test("pdf ink: the eraser hits dots and line segments and leaves other strokes alone", () => {
  const a = ink.normalizeInkStroke({ points: [[0.1, 0.1], [0.2, 0.1]] });
  const b = ink.normalizeInkStroke({ points: [[0.8, 0.8]] });
  const c = ink.normalizeInkStroke({ points: [[0.8, 0.2], [0.9, 0.2]] });
  assert.equal(ink.pointToSegmentDistance([0.15, 0.2], [0.1, 0.1], [0.2, 0.1]), 0.1);
  assert.deepEqual(ink.eraseStrokesAt([a, b, c], [0.15, 0.102], 0.01), [b, c]);
  assert.deepEqual(ink.eraseStrokesAt([a, b, c], [0.8, 0.81], 0.02), [a, c]);
});

test("pdf annotations: pen strokes round-trip through the sidecar and get a readable summary", () => {
  const stroke = ink.normalizeInkStroke({ tool: "pen", color: "red", points: [[0.1, 0.1], [0.2, 0.2]] });
  const saved = pdf.upsertAnnotation(
    "",
    { page: 3, type: "pen", color: "red", strokes: [stroke] },
    { pdfPath: "Papers/Exam.pdf", pdfHash: "abc123" }
  );
  assert.match(saved.text, /Page 3/);
  assert.match(saved.text, /1 ink stroke/);
  assert.match(saved.text, /mcq-pdf-annotations/);
  const parsed = pdf.parseAnnotationFile(saved.text);
  assert.equal(parsed.annotations.length, 1);
  assert.equal(parsed.annotations[0].type, "pen");
  assert.equal(parsed.annotations[0].page, 3);
  assert.deepEqual(parsed.annotations[0].strokes[0].points, [
    [0.1, 0.1],
    [0.2, 0.2],
  ]);
  assert.throws(() => pdf.normalizeAnnotation({ page: 1, type: "pen" }), /draw some ink|quote, note or text/);
});

test("pdf ink: the plugin registers the drawing command and the modal entry point", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.ok(plugin.commands.some((command) => command.id === "pdf-draw"), "pdf-draw command is registered");
  assert.equal(typeof plugin.openPdfInk, "function");
  assert.equal(typeof T.PdfInkModal, "function");
});

test("pdf ink: text boxes clamp to the page, keep newlines and hit-test by rectangle", () => {
  const box = ink.normalizeTextBox({ text: "  First line\nSecond line  ", x: 0.99, y: 0.99, width: 0.4, height: 0.2, size: 9, color: "green" });
  assert.equal(box.text, "First line\nSecond line");
  assert.equal(box.width, 0.4);
  assert.equal(box.height, 0.2);
  assert.equal(box.x, 0.6);
  assert.equal(box.y, 0.8);
  assert.equal(box.size, 0.05);
  assert.equal(box.color, "green");
  assert.equal(ink.normalizeTextBox({ text: "   " }), null);
  assert.equal(ink.boxAt([box], [0.7, 0.85]), box);
  assert.equal(ink.boxAt([box], [0.1, 0.1]), null);
});

test("pdf annotations: text boxes round-trip through the sidecar", () => {
  const box = ink.normalizeTextBox({ text: "Remember this", x: 0.2, y: 0.3, width: 0.35, height: 0.12, color: "purple" });
  const saved = pdf.upsertAnnotation("", { page: 4, type: "text", color: "purple", boxes: [box] }, { pdfPath: "Papers/Exam.pdf", pdfHash: "hash" });
  assert.match(saved.text, /1 text box/);
  const parsed = pdf.parseAnnotationFile(saved.text);
  assert.equal(parsed.annotations[0].type, "text");
  assert.deepEqual(parsed.annotations[0].boxes, [box]);
});

test("pdf ink: highlight areas clamp to the page, keep notes and hit-test by rectangle", () => {
  const area = ink.normalizeHighlightArea({ x: 0.99, y: 0.99, width: 0.4, height: 0.2, color: "green", note: "  Key idea\nSecond line  " });
  assert.equal(area.width, 0.4);
  assert.equal(area.height, 0.2);
  assert.equal(area.x, 0.6);
  assert.equal(area.y, 0.8);
  assert.equal(area.color, "green");
  assert.equal(area.note, "Key idea\nSecond line");
  assert.equal(ink.areaAt([area], [0.7, 0.85]), area);
  assert.equal(ink.areaAt([area], [0.1, 0.1]), null);
  assert.equal(ink.normalizeHighlightAreas([area, null]).length, 1);
});
