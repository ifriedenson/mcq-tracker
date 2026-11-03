"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const C = T.citations;

const BIB = [
  "@article{smith2020,",
  "  title = {A {Nested} Title},",
  "  author = {Smith, Jane and Doe, John},",
  "  year = {2020},",
  "  journal = {Journal of Tests},",
  "  doi = {10.1234/example}",
  "}",
  "@book{lee2019, title={A Book}, author={Lee, Ann}, year={2019}}",
].join("\n");

function setup() {
  return (async () => {
    const plugin = new QT(makeApp([]));
    await plugin.onload();
    plugin.settings.citations = { enabled: true, folder: "Citations" };
    return plugin;
  })();
}

test("citations: parse BibTeX, normalize authors and build a citation note", () => {
  const entries = C.parseBibTeX(BIB);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].key, "smith2020");
  assert.equal(entries[0].title, "A Nested Title");
  assert.deepEqual(entries[0].authors, ["Jane Smith", "John Doe"]);
  assert.equal(entries[0].doi, "10.1234/example");
  assert.equal(entries[1].type, "book");
  assert.match(C.citationText(entries[0]), /Jane Smith, John Doe \(2020\)/);
  assert.match(C.citationText(entries[0]), /https:\/\/doi.org\/10.1234\/example/);
  const note = C.citationNoteMarkdown(entries[0]);
  assert.match(note, /type: citation/);
  assert.match(note, /citation_key: "smith2020"/);
  assert.match(note, /# A Nested Title/);
  assert.equal(C.normalizeCitationSettings({}).enabled, false);
  assert.equal(C.normalizeCitationSettings({}).folder, "Citations");
  assert.equal(C.normalizeCitation({ title: "" }), null);
  assert.equal(C.safeCitationName(entries[0]), "Jane Smith 2020 A Nested Title");
});

test("citations: plugin imports a .bib, skips duplicates and never overwrites a note", async () => {
  const plugin = await setup();
  await plugin.app.vault.create("References/library.bib", BIB);
  const first = await plugin.importCitationFile("References/library.bib");
  assert.equal(first.ok, true);
  assert.equal(first.added, 2);
  assert.equal(first.skipped, 0);
  assert.equal(plugin.citationsSettings().entries.length, 2);
  const second = await plugin.importCitationFile("References/library.bib");
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 2);
  const note = await plugin.createCitationNote("smith2020");
  assert.equal(note.ok, true);
  assert.match(note.path, /^Citations\/.*\.md$/);
  const saved = plugin.app.files.find((file) => file.path === note.path);
  assert.match(saved.text, /# A Nested Title/);
  const duplicate = await plugin.createCitationNote("smith2020");
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "exists");
  assert.equal(plugin.citationsSettings().entries.length, 2);
  assert.equal(await plugin.removeCitation("smith2020"), true);
  assert.equal(plugin.citationsSettings().entries.length, 1);
  assert.equal(await plugin.removeCitation("missing"), false);
});

test("citations: the Study Workspace renders the local library", async () => {
  const plugin = await setup();
  await plugin.app.vault.create("References/library.bib", BIB);
  await plugin.importCitationFile("References/library.bib");
  const view = new T.StudyWorkspaceView({ app: plugin.app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "citations";
  view.render();
  const texts = dom.texts();
  assert.ok(texts.some((text) => text.includes("Citations")));
  assert.ok(texts.some((text) => text.includes("A Nested Title")));
  assert.ok(texts.some((text) => text.includes("Create note")));
});
