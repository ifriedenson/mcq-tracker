"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const B = T.studyBundle;
const I = T.studyBundleImport;
const { zipStore } = T.zipWrite;

const QUESTION_ONE = "---\nquestion_id: Q1\ncourse: Bio\n---\n\n## Question\nWhat is ATP?\n";
const QUESTION_TWO = "---\nquestion_id: Q2\n---\n\n## Question\nSymbol for gold?\n";
const CARD_ONE = "---\ncard_id: c1\ndeck: Biology\n---\n\n## Front\nATP\n";

async function start(notes = []) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

function addZipFile(app, path, bytes) {
  const file = new obsidian.TFile();
  file.path = path;
  file.basename = path.replace(/\.zip$/i, "");
  file.extension = "zip";
  file.parent = { path: "/" };
  file.buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  app.files.push(file);
  return file;
}

function archive(input) {
  return B.buildStudyBundle(Object.assign({ date: "2026-10-30", version: "1.129.0" }, input)).archive;
}

test("study bundle import: parse reads notes and their original sources", () => {
  const parsed = I.parseStudyBundle(archive({
    questions: [{ path: "Questions/Bio/Q1.md", text: QUESTION_ONE }],
    cards: [{ path: "Cards/Bio/ATP.md", text: CARD_ONE }],
  }));
  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].source, "Questions/Bio/Q1.md");
  assert.equal(parsed.questions[0].text, QUESTION_ONE);
  assert.equal(parsed.cards[0].source, "Cards/Bio/ATP.md");
  assert.deepEqual(parsed.invalid, []);
});

test("study bundle import: a missing or invalid manifest fails before writing", () => {
  assert.throws(() => I.parseStudyBundle(zipStore([{ name: "questions/Q.md", data: QUESTION_ONE }])), /manifest\.json is missing/);
  assert.throws(() => I.parseStudyBundle(zipStore([{ name: "manifest.json", data: "{oops" }])), /not valid JSON/);
  assert.throws(
    () => I.parseStudyBundle(zipStore([{ name: "manifest.json", data: JSON.stringify({ schema: 2, plugin: "mcq-tracker", notes: { questions: [], cards: [] } }) }])),
    /schema 2/
  );
  assert.throws(
    () => I.parseStudyBundle(zipStore([{ name: "manifest.json", data: JSON.stringify({ schema: 1, plugin: "mcq-tracker" }) }])),
    /no note list/
  );
});

test("study bundle import: unsafe paths are rejected, never redirected", () => {
  const zip = zipStore([
    { name: "manifest.json", data: JSON.stringify({ schema: 1, plugin: "mcq-tracker", counts: { questions: 1, cards: 0 }, notes: { questions: [{ path: "questions/Q.md", source: "../../Escape.md" }], cards: [] } }) },
    { name: "questions/Q.md", data: QUESTION_ONE },
  ]);
  const parsed = I.parseStudyBundle(zip);
  assert.equal(parsed.questions.length, 1);
  return I.planStudyBundleRestore(parsed, { readExisting: async () => null }).then((plan) => {
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.invalid.length, 1);
    assert.match(plan.invalid[0].reason, /unsafe/);
  });
});

test("study bundle import: export then import restores byte-identical notes", async () => {
  const source = await start([
    { path: "Questions/Bio/Q1.md", fm: { question_id: "Q1", course: "Bio" }, text: QUESTION_ONE },
    { path: "Cards/Bio/ATP.md", fm: { question_id: undefined, card_id: "c1", deck: "Biology" }, text: CARD_ONE },
  ]);
  source.plugin.settings.cards.enabled = true;
  const exported = await source.plugin.exportStudyBundle();
  const bytes = source.app.createdBinary.find((file) => file.path === exported.path).buffer;

  const target = await start([]);
  target.plugin.settings.cards.enabled = true;
  addZipFile(target.app, exported.path, new Uint8Array(bytes));
  const result = await target.plugin.importStudyBundle(exported.path);
  assert.equal(result.imported, 2);
  assert.equal(result.conflicts, 0);
  assert.equal(result.invalid, 0);
  const created = target.app.created || [];
  const question = created.find((file) => file.path === "Questions/Bio/Q1.md");
  const card = created.find((file) => file.path === "Cards/Bio/ATP.md");
  assert.equal(question.text, QUESTION_ONE, "question text is byte-identical");
  assert.equal(card.text, CARD_ONE, "card text is byte-identical");
});

test("study bundle import: a different existing note is skipped, never overwritten", async () => {
  const existing = "---\nquestion_id: Q1\n---\n\n## Question\nMy edited copy.\n";
  const target = await start([{ path: "Questions/Bio/Q1.md", fm: { question_id: "Q1" }, text: existing }]);
  addZipFile(target.app, "mcq-study-bundle-2026-10-30.zip", archive({
    questions: [{ path: "Questions/Bio/Q1.md", text: QUESTION_ONE }],
  }));
  const result = await target.plugin.importStudyBundle("mcq-study-bundle-2026-10-30.zip");
  assert.equal(result.imported, 0);
  assert.equal(result.conflicts, 1);
  assert.equal((target.app.created || []).length, 0, "nothing was created");
  assert.equal((target.app.modified || []).length, 0, "the existing note was not rewritten");
  assert.equal(taskFileText(target.app, "Questions/Bio/Q1.md"), existing);
});

function taskFileText(app, path) {
  const file = app.files.find((entry) => entry.path === path);
  return file ? file.text : null;
}

test("study bundle import: an identical existing note is not duplicated", async () => {
  const target = await start([{ path: "Questions/Bio/Q1.md", fm: { question_id: "Q1" }, text: QUESTION_ONE }]);
  addZipFile(target.app, "mcq-study-bundle-2026-10-30.zip", archive({
    questions: [{ path: "Questions/Bio/Q1.md", text: QUESTION_ONE }],
  }));
  const result = await target.plugin.importStudyBundle("mcq-study-bundle-2026-10-30.zip");
  assert.equal(result.imported, 0);
  assert.equal(result.identical, 1);
  assert.equal(result.conflicts, 0);
  assert.equal((target.app.created || []).length, 0);
});

test("study bundle import: cards are skipped while the Cards module is off", async () => {
  const target = await start([]);
  target.plugin.settings.cards.enabled = false;
  addZipFile(target.app, "mcq-study-bundle-2026-10-30.zip", archive({
    questions: [{ path: "Questions/Bio/Q1.md", text: QUESTION_ONE }],
    cards: [{ path: "Cards/Bio/ATP.md", text: CARD_ONE }],
  }));
  const result = await target.plugin.importStudyBundle("mcq-study-bundle-2026-10-30.zip");
  assert.equal(result.imported, 1);
  assert.equal(result.cardsSkipped, 1);
  assert.ok(!(target.app.created || []).some((file) => file.path === "Cards/Bio/ATP.md"));
});

test("study bundle import: an empty bundle imports nothing and a corrupt one writes nothing", async () => {
  const target = await start([]);
  addZipFile(target.app, "mcq-study-bundle-2026-10-30.zip", B.buildStudyBundle({}).archive);
  const empty = await target.plugin.importStudyBundle("mcq-study-bundle-2026-10-30.zip");
  assert.equal(empty.imported, 0);
  assert.equal((target.app.created || []).length, 0);

  const corrupt = await start([]);
  addZipFile(corrupt.app, "mcq-study-bundle-2026-10-31.zip", zipStore([{ name: "manifest.json", data: "not json" }]));
  await assert.rejects(() => corrupt.plugin.importStudyBundle("mcq-study-bundle-2026-10-31.zip"), /not valid JSON/);
  assert.equal((corrupt.app.created || []).length, 0);
});

test("study bundle import: the command is registered", async () => {
  const { plugin } = await start([]);
  assert.ok(plugin.commands.some((command) => command.id === "import-study-bundle"));
});
