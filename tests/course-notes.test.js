"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
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

test("course notes: safe names and unique paths do not overwrite existing notes", () => {
  assert.equal(courseNotes.safeName("Lecture 1: Cells / Mitosis"), "Lecture 1- Cells - Mitosis");
  assert.equal(courseNotes.safeName("", "Fallback"), "Fallback");
  const vault = {
    getAbstractFileByPath: (path) => (path === "Course notes/Cells.md" ? { path } : null),
  };
  assert.equal(courseNotes.uniquePath(vault, "Course notes", "Cells"), "Course notes/Cells 2.md");
  assert.equal(courseNotes.uniquePath(vault, "Course notes", "Cells 2"), "Course notes/Cells 2.md");
});
