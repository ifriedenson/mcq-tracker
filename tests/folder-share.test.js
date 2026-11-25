"use strict";
/*
 * Sharing one question folder as a ZIP: the folder list, the file name, the
 * archive contents, and importing a received ZIP by its name without knowing
 * its full path.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const F = T.folderShare;
const B = T.studyBundle;

const QUESTION_ONE = "---\nquestion_id: Q1\ncourse: Bio\n---\n\n## Question\nWhat is ATP?\n";
const QUESTION_TWO = "---\nquestion_id: Q2\ncourse: Bio\n---\n\n## Question\nSymbol for gold?\n";
const QUESTION_THREE = "---\nquestion_id: Q3\ncourse: Chem\n---\n\n## Question\nWhat is pH?\n";

/** Reads the stored entries of the ZIP this plugin writes, without a ZIP dependency. */
function readStoredZip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const decoder = new TextDecoder();
  const out = new Map();
  let p = 0;
  while (p + 30 <= u8.length && view.getUint32(p, true) === 0x04034b50) {
    const size = view.getUint32(p + 18, true);
    const nameLen = view.getUint16(p + 26, true);
    const extraLen = view.getUint16(p + 28, true);
    const name = decoder.decode(u8.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extraLen;
    out.set(name, decoder.decode(u8.subarray(start, start + size)));
    p = start + size;
  }
  return out;
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

async function start(notes = []) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("folder share: choices list the question folder and every note folder", () => {
  const choices = F.questionFolderChoices([
    "Questions/Bio/Q1.md",
    "Questions/Bio/Unit2/Q2.md",
    "Questions/Chem/Q3.md",
    "Elsewhere/NotAQuestion.md",
  ], "Questions");
  assert.deepEqual(choices.map((c) => [c.folder, c.label, c.count]), [
    ["Questions", "All questions", 3],
    ["Questions/Bio", "Bio", 2],
    ["Questions/Bio/Unit2", "Bio/Unit2", 1],
    ["Questions/Chem", "Chem", 1],
  ]);
  assert.deepEqual(F.questionFolderChoices([], "Questions"), []);
  assert.equal(F.insideFolder("QuestionsX/Q.md", "Questions"), false);
  assert.equal(F.insideFolder("Questions/Bio/Q.md", "Questions"), true);
  assert.equal(F.insideFolder("Questions/Q.md", ""), true, "an empty folder covers the vault");
  assert.equal(F.cleanFolder("../Escape"), "", "a parent hop is rejected");
});

test("folder share: the ZIP name carries the folder and the date", () => {
  assert.equal(B.folderBundleFileName("Questions/Bio Unit 3", "2026-11-24"), "mcq-folder-bio-unit-3-2026-11-24.zip");
  assert.equal(B.folderBundleFileName("", "2026-11-24"), "mcq-folder-questions-2026-11-24.zip");
  assert.equal(B.folderBundleFileName("Questions/Bio", "not-a-day"), "mcq-folder-bio-export.zip");
  assert.ok(F.isShareZip("mcq-folder-bio-2026-11-24.zip"));
  assert.ok(F.isShareZip("mcq-study-bundle-2026-11-24 2.zip"), "numbered duplicates are found");
  assert.equal(F.isShareZip("notes.zip"), false);
  assert.equal(F.isShareZip("mcq-folder-bio.zip"), false, "a ZIP without a date is not one of ours");
});

test("folder share: exporting one folder writes only its notes and records the folder", async () => {
  const { app, plugin } = await start([
    { path: "Questions/Bio/Q1.md", fm: { question_id: "Q1", course: "Bio" }, text: QUESTION_ONE },
    { path: "Questions/Bio/Unit2/Q2.md", fm: { question_id: "Q2", course: "Bio" }, text: QUESTION_TWO },
    { path: "Questions/Chem/Q3.md", fm: { question_id: "Q3", course: "Chem" }, text: QUESTION_THREE },
  ]);
  const result = await plugin.exportQuestionFolder("Questions/Bio");
  assert.ok(result, "a share was written");
  assert.match(result.path, /^mcq-folder-bio-\d{4}-\d{2}-\d{2}\.zip$/);
  assert.deepEqual(result.counts, { questions: 2, cards: 0 });
  const written = (app.createdBinary || []).find((file) => file.path === result.path);
  const entries = readStoredZip(written.buffer);
  assert.deepEqual([...entries.keys()].sort(), [
    "README.md",
    "manifest.json",
    "questions/Questions/Bio/Q1.md",
    "questions/Questions/Bio/Unit2/Q2.md",
  ]);
  assert.equal(entries.get("questions/Questions/Bio/Q1.md"), QUESTION_ONE, "the note text is untouched");
  const manifest = JSON.parse(entries.get("manifest.json"));
  assert.equal(manifest.folder, "Questions/Bio");
  assert.equal(manifest.counts.questions, 2);
  assert.match(entries.get("README.md"), /from the `Questions\/Bio` folder/);
});

test("folder share: an empty folder or an unsafe one writes nothing", async () => {
  const { app, plugin } = await start([
    { path: "Questions/Bio/Q1.md", fm: { question_id: "Q1" }, text: QUESTION_ONE },
  ]);
  assert.equal(await plugin.exportQuestionFolder("Questions/Chem"), null);
  await assert.rejects(() => plugin.exportQuestionFolder("../Escape"), /not a folder inside the vault/);
  assert.equal((app.createdBinary || []).length, 0);
});

test("folder share: a shared ZIP is found by name and restores its notes", async () => {
  const source = await start([
    { path: "Questions/Bio/Q1.md", fm: { question_id: "Q1", course: "Bio" }, text: QUESTION_ONE },
    { path: "Questions/Chem/Q3.md", fm: { question_id: "Q3", course: "Chem" }, text: QUESTION_THREE },
  ]);
  const shared = await source.plugin.exportQuestionFolder("Questions/Bio");
  assert.deepEqual(source.plugin.bundleZipFiles().map((file) => file.path), [shared.path]);

  const target = await start([]);
  addZipFile(target.app, shared.path, new Uint8Array(source.app.createdBinary[0].buffer));
  const result = await target.plugin.importStudyBundleCommand();
  assert.equal(result.imported, 1);
  assert.equal(result.conflicts, 0);
  assert.equal(result.invalid, 0);
  const created = (target.app.created || []).find((file) => file.path === "Questions/Bio/Q1.md");
  assert.equal(created.text, QUESTION_ONE, "the shared note is byte-identical");
  assert.ok(!(target.app.created || []).some((file) => file.path === "Questions/Chem/Q3.md"), "only the shared folder came");
});

test("folder share: the command is registered and the picker lists one folder per row", async () => {
  const { plugin } = await start([]);
  assert.ok(plugin.commands.some((command) => command.id === "export-question-folder-zip"));
  const modal = new F.ShareFolderPickerModal(null, plugin.questionFolderChoices(), () => {});
  assert.equal(modal.getItemText({ label: "Bio", count: 1 }), "Bio · 1 question");
  assert.equal(modal.getItemText({ label: "Bio", count: 2 }), "Bio · 2 questions");
  const zips = new F.SharedZipPickerModal(null, ["Questions/mcq-folder-bio-2026-11-24.zip"], () => {});
  assert.equal(zips.getItemText("Questions/mcq-folder-bio-2026-11-24.zip"), "mcq-folder-bio-2026-11-24.zip");
});
