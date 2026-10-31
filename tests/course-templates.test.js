"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const C = T.courseTemplates;

test("course templates: defaults cover the five note types and settings clamp", () => {
  const settings = C.normalizeCourseTemplates(undefined);
  assert.equal(settings.enabled, true);
  assert.equal(settings.folder, "Courses");
  assert.deepEqual(settings.templates.map((template) => template.type), C.NOTE_TYPES);
  assert.equal(C.normalizeCourseTemplates({ folder: "Study/Courses" }).folder, "Study/Courses");
  assert.equal(C.normalizeCourseTemplates({ folder: "../escape" }).folder, "Courses");
  assert.equal(C.normalizeCourseTemplates({ enabled: false }).enabled, false);
  assert.equal(C.normalizeCourseTemplates({ templates: [{ name: "Only", type: "review", body: "Body" }] }).templates[0].type, "review");
});

test("course templates: placeholders fill and unknown types fall back", () => {
  assert.equal(C.fillTemplate("{{course}} — {{title}} ({{date}})", { course: "Biology", title: "Unit 1", date: "2026-10-31" }), "Biology — Unit 1 (2026-10-31)");
  const note = C.renderCourseNote({ course: "Biology", title: "Osmosis review", type: "review", date: "2026-10-31" }, undefined);
  assert.equal(note.type, "review");
  assert.equal(note.path, "Courses/Osmosis review.md");
  assert.match(note.markdown, /^---\ntype: course-note\ncourse: "Biology"\ncourse_note_type: review\ncreated: 2026-10-31/m);
  assert.match(note.markdown, /# Osmosis review/);
  assert.match(note.markdown, /\*\*Course:\*\* Biology/);
  assert.match(note.markdown, /What the exam covers/);

  const fallback = C.renderCourseNote({ course: "Chemistry", title: "Freeform", template: "missing-id" }, undefined);
  assert.equal(fallback.type, "lecture", "an unknown template falls back to the first");
});

test("course templates: titles are made into safe filenames", () => {
  assert.equal(C.safeFileName("Unit 3: Cells/Membranes?"), "Unit 3- Cells-Membranes-");
  assert.equal(C.safeFileName("   "), "Course note");
  const note = C.renderCourseNote({ course: "Biology", title: "Unit 3: Cells", type: "unit" }, undefined);
  assert.equal(note.fileName, "Unit 3- Cells");
  assert.equal(note.path, "Courses/Unit 3- Cells.md");
});

test("course templates: the plugin creates a note and never overwrites", async () => {
  const app = makeApp([{ path: "Notes/Q1.md", fm: { answer: "B" } }]);
  const plugin = new QT(app);
  await plugin.onload();

  const first = await plugin.createCourseNote({ course: "Biology", title: "Unit 3", template: "unit", date: "2026-10-31" });
  assert.equal(first.path, "Courses/Unit 3.md");
  assert.match(app.created[0].text, /course_note_type: unit/);

  const second = await plugin.createCourseNote({ course: "Biology", title: "Unit 3", template: "unit" });
  assert.equal(second.path, "Courses/Unit 3 2.md");

  plugin.settings.courseTemplates.enabled = false;
  await assert.rejects(() => plugin.createCourseNote({ course: "Biology", title: "Off" }), /off/);
});
