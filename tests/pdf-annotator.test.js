"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, Plugin: QT } = load();
const pdf = T.pdfAnnotations;
const { makeApp } = require("./helpers/fake");
const ink = T.pdfInk;

test("pdf annotator: underline, strike and box marks take their type's style", () => {
  for (const type of ["underline", "strike", "box", "highlight"]) {
    const annotation = pdf.normalizeAnnotation({
      page: 2,
      type,
      color: "green",
      areas: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.02, color: "green" }],
    });
    assert.equal(annotation.type, type);
    assert.equal(annotation.areas.length, 1);
    assert.equal(annotation.areas[0].style, type, `${type} areas are drawn as ${type}`);
  }
  const quote = pdf.normalizeAnnotation({
    page: 1,
    type: "quote",
    quote: "The mitochondria is the powerhouse.",
    areas: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.02 }],
    tags: ["#exam", "Exam", "key idea", "", "a".repeat(40)],
  });
  assert.equal(quote.areas[0].style, "highlight", "a selected quote keeps the highlight fill");
  assert.deepEqual(quote.tags, ["exam", "key-idea", "a".repeat(24)]);
  assert.equal(quote.updatedAt, "");
});

test("pdf annotator: marks, tags and quotes round-trip through the sidecar", () => {
  const area = ink.normalizeHighlightArea({ x: 0.2, y: 0.4, width: 0.25, height: 0.004, color: "blue", style: "underline", note: "definition" });
  const saved = pdf.upsertAnnotation("", { page: 5, type: "underline", color: "blue", areas: [area], tags: ["vocab"] }, { pdfPath: "Bio/Unit 3.pdf", pdfHash: "abc" });
  assert.match(saved.text, /Page 5/);
  assert.match(saved.text, /#vocab/);
  const parsed = pdf.parseAnnotationFile(saved.text);
  assert.equal(parsed.annotations[0].type, "underline");
  assert.equal(parsed.annotations[0].areas[0].style, "underline");
  assert.deepEqual(parsed.annotations[0].tags, ["vocab"]);
  assert.equal(pdf.normalizeTags(["#a", "A", "b c"]).join(","), "a,b-c", "tags are unique and hash-free");
});

test("pdf annotator: exact annotation links and a Markdown digest", () => {
  assert.equal(pdf.annotationLink("Papers/Exam.pdf", 3, "ann-1"), "[[Papers/Exam.pdf#page=3&annotation=ann-1]]");
  assert.equal(pdf.annotationLink("Papers/Exam.pdf", 3, ""), "[[Papers/Exam.pdf#page=3]]");
  assert.equal(pdf.annotationLink("Papers/Exam.pdf", 0, "ann-1"), "");
  assert.equal(pdf.annotationLink("notes.md", 3, "ann-1"), "");
  assert.equal(pdf.annotationLink("Papers/Exam.pdf", 3, "bad id!"), "");

  const rows = [
    { id: "ann-1", pdfPath: "Papers/Exam.pdf", page: 3, type: "quote", color: "yellow", quote: "ATP is energy", note: "Link to unit 2", tags: ["exam"], createdAt: "2026-01-01" },
    { id: "ann-2", pdfPath: "Papers/Exam.pdf", page: 4, type: "highlight", color: "green", quote: "", note: "", tags: [], summary: "2 marked areas", createdAt: "2026-01-02" },
  ];
  const text = pdf.annotationsMarkdown(rows);
  assert.match(text, /^# PDF annotations/);
  assert.match(text, /## Papers\/Exam\.pdf/);
  assert.match(text, /### Page 3/);
  assert.match(text, /- \*\*quote\*\* \(yellow\): “ATP is energy”/);
  assert.match(text, /- Note: Link to unit 2/);
  assert.match(text, /- Tags: #exam/);
  assert.match(text, /- Link: \[\[Papers\/Exam\.pdf#page=3&annotation=ann-1\]\]/);
  assert.match(text, /### Page 4/);
  assert.match(text, /2 marked areas/);
  assert.equal(pdf.annotationsMarkdown([]), "");
});

test("pdf annotator: filtering and counts work on index rows", () => {
  const rows = [
    { pdfPath: "A.pdf", page: 1, type: "quote", color: "yellow", quote: "mitochondria", note: "", tags: ["bio"], createdAt: "1" },
    { pdfPath: "A.pdf", page: 2, type: "underline", color: "blue", quote: "", note: "check this", tags: ["exam"], createdAt: "2" },
    { pdfPath: "B.pdf", page: 1, type: "quote", color: "green", quote: "ribosome", note: "", tags: ["bio"], createdAt: "3" },
  ];
  assert.equal(pdf.filterAnnotations(rows, { query: "MITO" }).length, 1);
  assert.equal(pdf.filterAnnotations(rows, { type: "quote" }).length, 2);
  assert.equal(pdf.filterAnnotations(rows, { color: "blue" }).length, 1);
  assert.equal(pdf.filterAnnotations(rows, { tag: "#bio" }).length, 2);
  assert.equal(pdf.filterAnnotations(rows, { page: 2 }).length, 1);
  assert.equal(pdf.filterAnnotations(rows, {}).length, 3);
  const counts = pdf.annotationCounts(rows);
  assert.equal(counts.total, 3);
  assert.equal(counts.pdfs, 2);
  assert.equal(counts.pages, 3);
  assert.equal(counts.byType.quote, 2);
  assert.equal(counts.byTag.bio, 2);
});

test("pdf annotator: a drag selects the text under it in reading order", () => {
  const items = [
    { s: "Hello", x: 0.1, y: 0.1, w: 0.2, h: 0.02 },
    { s: "world", x: 0.32, y: 0.1, w: 0.2, h: 0.02 },
    { s: "Next", x: 0.1, y: 0.2, w: 0.1, h: 0.02 },
    { s: "Outside", x: 0.6, y: 0.6, w: 0.2, h: 0.02 },
  ];
  const picked = ink.textInArea(items, { x: 0.05, y: 0.05, width: 0.6, height: 0.2 });
  assert.equal(picked.quote, "Hello world\nNext");
  assert.equal(picked.areas.length, 2, "one mark per selected line");
  assert.ok(picked.areas[0].width > 0.3, "the first line spans both words");
  assert.equal(picked.areas[0].style, "highlight");
  assert.deepEqual(ink.textInArea(items, { x: 0.05, y: 0.05, width: 0.0001, height: 0.0001 }), { quote: "", areas: [] });
  assert.deepEqual(ink.textInArea(items, { x: 0.85, y: 0.85, width: 0.1, height: 0.1 }), { quote: "", areas: [] });
});

test("pdf annotator: every mark style paints through one draw path", () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get(_t, key) {
      if (key === "measureText") return () => ({ width: 10 });
      return (...args) => calls.push([key, ...args]);
    },
    set() { return true; },
  });
  for (const style of ["highlight", "underline", "strike", "box"]) {
    calls.length = 0;
    ink.drawMarks(ctx, [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05, color: "yellow", style }], 1000, 1400);
    const ops = calls.map((call) => call[0]);
    if (style === "box") assert.ok(ops.includes("strokeRect"), "a box outlines");
    if (style === "highlight") assert.ok(ops.includes("fillRect"), "a highlight fills");
    if (style === "underline" || style === "strike") {
      assert.ok(ops.includes("stroke"), "a line mark strokes");
      const move = calls.find((call) => call[0] === "moveTo");
      const y = move[2];
      const middle = (0.2 + 0.05 / 2) * 1400;
      if (style === "strike") assert.ok(Math.abs(y - middle) < 4, "strike sits across the middle");
      else assert.ok(y > middle, "underline sits at the bottom");
    }
  }
  ink.drawMarks(ctx, [{ x: 0, y: 0, width: 0.1, height: 0.1, color: "red", style: "box", note: "note" }], 800, 1000);
  assert.ok(calls.some((call) => call[0] === "arc"), "a note puts a marker on the mark");
});

test("pdf annotator plugin: rows, note edits, deletion, export and reading position", async () => {
  const sidecar = pdf.serializeAnnotationFile("Papers/Exam.pdf", "hash", [
    { page: 2, type: "quote", color: "yellow", quote: "ATP is energy", note: "old note", areas: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.02 }], tags: ["exam"] },
    { page: 3, type: "underline", color: "blue", areas: [{ x: 0.1, y: 0.3, width: 0.2, height: 0.004 }] },
  ]);
  const app = makeApp([
    { path: "Papers/Exam.pdf", noFm: true, text: "" },
    { path: "Papers/Exam.annotations.md", noFm: true, text: sidecar },
  ]);
  const plugin = new QT(app);
  await plugin.onload();

  const data = await plugin.pdfAnnotationRows("Papers/Exam.pdf");
  assert.equal(data.rows.length, 2);
  assert.equal(data.rows[0].quote, "ATP is energy");
  assert.deepEqual(data.rows[0].tags, ["exam"]);
  assert.equal(data.rows[0].summary.includes("#exam"), true, "the summary carries the tags");
  const id = data.rows[0].id;

  const updated = await plugin.updatePdfAnnotationNote("Papers/Exam.pdf", id, "new note");
  assert.equal(updated.note, "new note");
  assert.ok(updated.updatedAt, "an edit stamps the annotation");
  assert.equal((await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows.length, 2, "editing does not duplicate the row");
  assert.equal(await plugin.updatePdfAnnotationNote("Papers/Exam.pdf", "missing", "x"), null);

  const exported = await plugin.exportPdfAnnotations("Papers/Exam.pdf");
  assert.match(exported, /^Papers\/Exam annotations\.md$/);
  const digest = app.files.find((file) => file.path === exported);
  assert.match(digest.text, /## Papers\/Exam\.pdf/);
  assert.match(digest.text, /new note/);
  assert.match(digest.text, /#exam/);
  assert.match(digest.text, /annotation=/);
  const second = await plugin.exportPdfAnnotations("Papers/Exam.pdf");
  assert.equal(second, "Papers/Exam annotations 2.md", "a second export is numbered, never overwritten");
  assert.equal(await plugin.exportPdfAnnotations("Papers/Missing.pdf"), null, "a PDF without a sidecar exports nothing");

  assert.equal(await plugin.deletePdfAnnotation("Papers/Exam.pdf", id), 1);
  assert.equal((await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows.length, 1);

  plugin.rememberPdfPage("Papers/Exam.pdf", 7);
  assert.equal(plugin.pdfLastPage("Papers/Exam.pdf"), 7);
  plugin.rememberPdfPage("", 3);
  assert.equal(plugin.pdfLastPage("Other.pdf"), 0);
  assert.ok(plugin.commands.some((command) => command.id === "pdf-export-notes"), "the export command is registered");
  assert.equal(typeof plugin.openPdfInk, "function");
});
