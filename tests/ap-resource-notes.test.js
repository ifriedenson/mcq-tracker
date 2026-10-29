"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const resources = T.apResources;
const notes = T.apResourceNotes;

function biologyPack() {
  return resources.resourcesForCourse("ap-biology");
}

function frqResource() {
  return biologyPack().resources.find((resource) => resource.id === "released-frqs");
}

test("AP resource notes: a saved link has course, unit, type, URL and checked date", () => {
  const pack = biologyPack();
  const note = notes.buildApResourceNote(pack.course, frqResource(), "Unit 3", "2026-10-29");
  assert.equal(note.path, "AP resources/AP Biology/Released free-response questions.md");
  assert.equal(note.frontmatter.type, "ap_resource");
  assert.equal(note.frontmatter.ap_course, "ap-biology");
  assert.equal(note.frontmatter.unit, "Unit 3");
  assert.equal(note.frontmatter.source_url, "https://apcentral.collegeboard.org/courses/ap-biology/exam/past-exam-questions");
  assert.deepEqual(note.frontmatter.tags, ["ap", "ap-biology", "unit-3"]);
  assert.match(note.text, /An official AP resource link/);
  assert.match(note.text, /Last checked:\*\* 2026-10-29/);
  assert.match(note.text, /Do not paste copyrighted AP prompts/);
  assert.equal(note.entry.unit, "Unit 3");
});

test("AP resource notes: stale checks use a 180-day boundary and invalid dates are stale", () => {
  assert.equal(notes.isStale("2026-01-01", new Date(2026, 5, 30), 180), false);
  assert.equal(notes.isStale("2026-01-01", new Date(2026, 6, 1), 180), true);
  assert.equal(notes.isStale("not-a-date", new Date(2026, 6, 1), 180), true);
  assert.equal(notes.daysSince("2026-01-01", new Date(2026, 5, 30)), 180);
});

test("AP resource notes: duplicate paths get a suffix and URL matching ignores a trailing slash or hash", () => {
  const pack = biologyPack();
  const note = notes.buildApResourceNote(pack.course, frqResource(), "", "2026-10-29");
  const existing = new Set([note.path, note.path.replace(/\.md$/, " 2.md")]);
  assert.equal(notes.uniqueApResourcePath(note, (path) => existing.has(path)), note.path.replace(/\.md$/, " 3.md"));
  const entries = [
    { path: "b.md", sourceUrl: "https://example.com/a/", stale: false, course: "B" },
    { path: "a.md", sourceUrl: "https://example.com/b", stale: true, course: "A" },
  ];
  assert.equal(notes.findApResourceNote(entries, "https://example.com/a#section").path, "b.md");
  assert.equal(notes.sortApResourceNotes(entries)[0].path, "a.md", "stale links come first");
});

test("AP resource notes: saving is idempotent and Mark checked updates the note", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const pack = biologyPack();
  const resource = frqResource();

  const saved = await plugin.saveApResourceNote(pack.course, resource, "Unit 3", "2026-01-01");
  assert.equal(saved.created, true);
  assert.ok(app.folders.includes("AP resources/AP Biology"));
  assert.match(saved.file.text, /source_url: https:\/\/apcentral\.collegeboard\.org/);
  saved.file.fm = saved.frontmatter;

  const again = await plugin.saveApResourceNote(pack.course, resource, "", "2026-10-29");
  assert.equal(again.created, false);
  assert.equal(again.path, saved.path);
  assert.equal(app.created.length, 1, "a second click does not create a duplicate note");

  const updated = await plugin.markApResourceChecked(saved.path, "2026-10-29");
  assert.equal(updated.checkedOn, "2026-10-29");
  assert.equal(updated.stale, false);
  assert.equal(saved.file.fm.checked_on, "2026-10-29");
});

test("AP resource notes: the Reference tab saves a link and lists saved notes", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "resources";
  view.apResourceUnit = "Unit 3";
  view.render();

  assert.ok(dom.texts().includes("Save as note"));
  assert.ok(dom.texts().includes("Saved resource notes"));
  assert.ok(dom.texts().some((text) => text.startsWith("No saved resource notes yet.")));

  const pack = biologyPack();
  await view.saveApResource(pack.course, frqResource());
  assert.equal(app.created.length, 1);
  assert.ok(dom.texts().some((text) => text.includes("1 saved")));
  assert.ok(dom.texts().some((text) => text.includes("Released free-response questions")));
  assert.ok(dom.texts().some((text) => text.includes("Unit 3")));
});
