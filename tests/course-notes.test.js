"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const courseNotes = T.courseNotes;

const PAGES = [
  { n: 1, text: "Cell division\n\n• Mitosis\n• Meiosis" },
  { n: 2, text: "Mitosis phases\n\nProphase\nMetaphase\nAnaphase\nTelophase" },
];

test("course notes: builds one note with a title, page headings, bullets and a source link", () => {
  const note = courseNotes.buildCourseNote(PAGES, {
    course: "BIOL 201",
    sourceName: "Lecture 3",
    sourceLink: "[[Course notes/sources/Lecture 3.pptx]]",
    sourceFormat: "pptx",
    sourcePageCount: 2,
    importedOn: "2026-10-29",
    pageLabel: "Slide",
  });
  assert.match(note.text, /^---\ncourse_notes: true\ntitle: "Cell division"/);
  assert.match(note.text, /course: "BIOL 201"/);
  assert.match(note.text, /source_document: "\[\[Course notes\/sources\/Lecture 3.pptx\]\]"/);
  assert.match(note.text, /source_format: "pptx"/);
  assert.match(note.text, /source_page_count: 2/);
  assert.match(note.text, /^## Cell division$/m);
  assert.match(note.text, /^## Mitosis phases$/m);
  assert.match(note.text, /^- Mitosis$/m);
  assert.match(note.text, /^- Meiosis$/m);
  assert.match(note.text, /\*Source: \[\[Course notes\/sources\/Lecture 3.pptx\]\] · slide 1\*/);
  assert.equal(note.title, "Cell division");
});

test("course notes: falls back to a page label and keeps text-only note wording", () => {
  const note = courseNotes.buildCourseNote(
    [{ n: 4, text: "This is a complete sentence." }],
    { sourceName: "Chapter", sourcePageCount: 1, importedOn: "2026-10-29" }
  );
  assert.match(note.text, /^## Page 4$/m);
  assert.match(note.text, /This is a complete sentence\./);
  assert.match(note.text, /Text-only study notes/);
  assert.equal(note.title, "Chapter");
});

test("course notes: AI summary is marked, placed before page sections, and strips fences", () => {
  const summary = courseNotes.parseCourseSummary(
    "```markdown\n## Summary\n- Cells divide by mitosis.\n- Meiosis makes gametes.\n\n## Key terms\n- **Mitosis** — division for growth.\n```"
  );
  assert.match(summary, /^## Summary/m);
  assert.match(summary, /^## Key terms/m);
  assert.doesNotMatch(summary, /```/);
  const note = courseNotes.buildCourseNote(PAGES, {
    sourceName: "Cells",
    sourcePageCount: 2,
    importedOn: "2026-10-29",
    summary,
    summaryModel: "test-model",
  });
  assert.match(note.text, /^ai_summary: true$/m);
  assert.match(note.text, /^ai_model: "test-model"$/m);
  assert.ok(note.text.indexOf("## Summary") < note.text.indexOf("## Mitosis phases"));
  assert.match(note.text, /The AI summary may be wrong/);
  assert.match(note.text, /<!-- ai-summary:start -->/);
  assert.match(note.text, /<!-- ai-summary:end -->/);
});

test("course notes: removing the AI summary keeps the extracted pages", () => {
  const note = courseNotes.buildCourseNote(PAGES, {
    sourceName: "Cells",
    sourcePageCount: 2,
    importedOn: "2026-10-29",
    summary: "## Summary\n\n- Cells divide by mitosis.",
    summaryModel: "test-model",
  });
  const cleaned = courseNotes.removeAiSummary(note.text);
  assert.equal(cleaned.removed, true);
  assert.doesNotMatch(cleaned.text, /## Summary/);
  assert.doesNotMatch(cleaned.text, /ai-summary/);
  assert.match(cleaned.text, /## Cell division/);
  assert.match(cleaned.text, /Mitosis phases/);
  assert.equal(courseNotes.removeAiSummary("ordinary note").removed, false);
});

test("plugin: undo removes an AI summary but keeps the course note", async () => {
  const note = courseNotes.buildCourseNote(PAGES, {
    sourceName: "Cells",
    sourcePageCount: 2,
    importedOn: "2026-10-29",
    summary: "## Summary\n\n- Cells divide by mitosis.",
    summaryModel: "test-model",
  });
  const app = makeApp([{ path: "Course notes/Cells.md", text: note.text, noFm: true }]);
  app.files[0].fm = { course_notes: true, ai_summary: true, ai_model: "test-model" };
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.recordAiSummaryNote({ path: "Course notes/Cells.md", title: "Cells", model: "test-model" });
  const result = await plugin.undoLastAiWrite();
  assert.equal(result.removed, 1);
  assert.doesNotMatch(app.files[0].text, /## Summary/);
  assert.match(app.files[0].text, /## Cell division/);
  assert.equal(app.files[0].fm.ai_summary, undefined);
  assert.equal(app.trashed.length, 0, "the note itself is kept");
});

test("course notes: summary prompt includes metadata and clips very long documents", () => {
  const pages = [{ n: 1, text: "x".repeat(15000) }];
  const prompt = courseNotes.buildCourseSummaryPrompt({ title: "Long chapter", course: "BIO 101", pages });
  assert.match(prompt.system, /three sections|two sections/i);
  assert.match(prompt.user, /Document: Long chapter/);
  assert.match(prompt.user, /Course: BIO 101/);
  assert.match(prompt.user, /Text truncated for the summary/);
});

test("course notes: PDF figure markers become embedded images", () => {
  const note = courseNotes.buildCourseNote(
    [{ n: 2, text: "Cell structure\n[FIGURE page 2: ![[Course notes/images/cell-fig1.png]]]\nNucleus" }],
    { sourceName: "Cells", sourcePageCount: 1, importedOn: "2026-10-29" }
  );
  assert.match(note.text, /!\[\[Course notes\/images\/cell-fig1\.png\]\]/);
  assert.match(note.text, /\*Figure from page 2\*/);
  assert.doesNotMatch(note.text, /\[FIGURE/);
});

test("course notes: safe names and unique paths do not overwrite existing notes", () => {
  assert.equal(courseNotes.safeName("Lecture 1: Cells / Mitosis"), "Lecture 1- Cells - Mitosis");
  assert.equal(courseNotes.safeName("", "Fallback"), "Fallback");
  const vault = {
    getAbstractFileByPath: (path) => (path === "Course notes/Cells.md" ? { path } : null),
  };
  assert.equal(courseNotes.uniquePath(vault, "Course notes", "Cells"), "Course notes/Cells 2.md");
  assert.equal(courseNotes.uniquePath(vault, "Course notes", "Cells 2"), "Course notes/Cells 2.md");
});
