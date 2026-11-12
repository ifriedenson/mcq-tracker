"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { makeTrackedApp } = require("./helpers/real-pdf");

const { T, obsidian } = load();

const SOURCE_TEXT = "Question 1\nWhat is 2 + 2?\nA. 3\nB. 4\n\nAnswer: B\n";

function makePlugin(app, overrides) {
  return Object.assign(
    {
      app,
      settings: {
        ai: { enabled: true, backend: "api", api: { provider: "openai", keys: { openai: "sk-test" } } },
        importDefaults: {},
        importOptions: { capture: false, pagePics: false },
        importFolder: "",
        questionFolder: "Questions",
      },
      backend: () => "api",
      save: async () => {},
      refreshEmptyViews: () => {},
      getQuestions: () => [],
      verifyDraftQuestions: async () => {},
      askConfirm: async () => true,
    },
    overrides || {}
  );
}

function makeModal(app, plugin, sourceName) {
  const modal = new T.PdfImportModal(app, plugin, {});
  modal.contentEl = makeDom().root;
  modal.file = {
    name: sourceName,
    async arrayBuffer() {
      return Buffer.from(SOURCE_TEXT);
    },
  };
  const base = sourceName.replace(/\.[^.]+$/, "");
  modal.folder = modal.autoFolder(base);
  return modal;
}

function noteText(id) {
  return `---
question_id: ${id}
number: 1
answer: B
---

## Question
What is 2 + 2?

## Answer Choices
- A. 3
- B. 4

## Answer
> [!answer]- Reveal answer
> **Correct Answer: B**
`;
}

test("import: an occupied auto folder asks before adding, then writes only new names", async () => {
  const app = makeApp([]);
  const existingSource = { path: "Questions/Unit 1/Unit 1.txt", text: "keep me" };
  app.files.push(existingSource);
  app.vault.getFolderByPath = (p) => (p === "Questions/Unit 1" ? { path: p, children: [existingSource] } : null);
  let asked = null;
  let ran = 0;
  const plugin = makePlugin(app, {
    askConfirm: async (title, body, okText) => {
      asked = { title, body, okText };
      return true;
    },
  });
  const modal = makeModal(app, plugin, "Unit 1.txt");
  modal.runApi = async () => { ran++; };

  await modal.start();

  assert.ok(asked, "the occupied folder is confirmed first");
  assert.equal(asked.title, "Add to this existing folder?");
  assert.match(asked.body, /already has files in it/);
  assert.match(asked.body, /Existing notes stay as they are/);
  assert.match(asked.body, /agent is told not to overwrite existing notes/);
  assert.equal(asked.okText, "Add to this folder");
  assert.equal(ran, 1, "the import runs after the user agrees");
  assert.deepEqual(app.createdBinary.map((x) => x.path), ["Questions/Unit 1/Unit 1 2.txt"]);
  assert.equal(existingSource.text, "keep me", "the existing copy of the file is untouched");
});

test("import: declining an occupied folder writes nothing", async () => {
  const app = makeApp([]);
  const existing = { path: "Questions/Unit 1/Unit 1.txt" };
  app.files.push(existing);
  app.vault.getFolderByPath = (p) => (p === "Questions/Unit 1" ? { path: p, children: [existing] } : null);
  let ran = 0;
  const plugin = makePlugin(app, { askConfirm: async () => false });
  const modal = makeModal(app, plugin, "Unit 1.txt");
  modal.runApi = async () => { ran++; };

  await modal.start();

  assert.equal(ran, 0, "no import starts without consent");
  assert.equal(app.createdBinary, undefined, "no source copy is written");
  assert.equal(modal.target, undefined, "the import target is not committed");
});

test("import: an existing but empty folder needs no confirmation", async () => {
  const app = makeApp([]);
  app.vault.getFolderByPath = (p) => (p === "Questions/Unit 1" ? { path: p, children: [] } : null);
  let asked = 0;
  let ran = 0;
  const plugin = makePlugin(app, {
    askConfirm: async () => {
      asked++;
      return false;
    },
  });
  const modal = makeModal(app, plugin, "Unit 1.txt");
  modal.runApi = async () => { ran++; };

  await modal.start();

  assert.equal(asked, 0, "an empty folder stays a normal new-folder import");
  assert.equal(ran, 1);
  assert.deepEqual(app.createdBinary.map((x) => x.path), ["Questions/Unit 1/Unit 1.txt"]);
});

test("import: a question whose note name exists gets a free name instead of replacing it", async () => {
  const app = makeApp([]);
  const existing = { path: "Questions/Unit 1/TEST-Q01.md", text: "keep me" };
  app.files.push(existing);
  const plugin = makePlugin(app);
  const modal = new T.PdfImportModal(app, plugin, {});
  modal.contentEl = makeDom().root;
  modal.ctx = { folder: "Questions/Unit 1", prefix: "TEST", sourcePath: "Questions/Unit 1/Unit 1.txt", kind: "txt" };
  modal.meta = {};
  modal.source = "Unit 1";
  const text = noteText("TEST-Q01");
  modal.items = [Object.assign({ text, include: true }, T.parseNote(text))];
  modal.pruneImages = async () => {};
  modal.auditNotes = async () => [];
  modal.showAgentDone = () => {};

  await modal.createNotes();

  assert.ok(app.created.some((c) => c.path === "Questions/Unit 1/TEST-Q01-2.md"), "the new note takes a free name");
  assert.equal(existing.text, "keep me", "the existing question note is untouched");
});

test("import: choosing only duplicate notes removes the copied source and empty folder", async () => {
  const existingPath = "Questions/Unit 1/EXIST-Q01.md";
  const state = makeTrackedApp([
    { path: existingPath, fm: { question_id: "EXIST-Q01", official_question_id: "dup" } },
  ]);
  const app = state.app;
  const plugin = makePlugin(app, { getQuestions: () => [...state.files.values()] });
  const modal = makeModal(app, plugin, "Unit 1.txt");
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.runApi = async () => {
    const text = noteText("TEST-Q01").replace("question_id: TEST-Q01", "question_id: TEST-Q01\nofficial_question_id: dup");
    modal.ctx = { folder: "Questions/Unit 1", prefix: "TEST", sourcePath: "Questions/Unit 1/Unit 1.txt", kind: "txt" };
    modal.items = [Object.assign({ text, include: true }, T.parseNote(text))];
    modal.showReview();
  };

  await modal.start();
  await dom.click("Create 1 note");

  assert.equal(state.files.size, 1, "the pre-existing note is the only file left");
  assert.equal(state.files.has(existingPath), true);
  assert.ok(![...state.files.keys()].some((path) => /\.txt$/.test(path)), "the copied source is removed");
});

test("import: the agent finalizer leaves notes that already existed in the folder alone", async () => {
  const app = makeApp([]);
  const plugin = makePlugin(app);
  const oldPath = "Questions/Unit 1/OLD-Q01.md";
  const newPath = "Questions/Unit 1/NEW-Q01.md";
  const oldText = noteText("OLD-Q01");
  const newText = noteText("NEW-Q01");
  const makeFile = (path, text) => {
    const f = new obsidian.TFile();
    f.path = path;
    f.basename = path.replace(/^.*\//, "").replace(/\.md$/, "");
    f.extension = "md";
    f.text = text;
    f.fm = {};
    f.headings = [];
    app.files.push(f);
    return f;
  };
  const oldFile = makeFile(oldPath, oldText);
  const newFile = makeFile(newPath, newText);
  app.vault.adapter.list = async () => ({ files: [oldPath, newPath], folders: [] });
  app.vault.adapter.read = async (p) => (p === oldPath ? oldText : newText);
  const modal = new T.PdfImportModal(app, plugin, {});
  modal.contentEl = makeDom().root;
  modal.meta = {};
  modal.source = "Unit 1";

  const result = await modal.finishAgentNotes(
    "Questions/Unit 1",
    "Unit 1",
    { model: "test", date: "2026-11-09", sourcePath: "Questions/Unit 1/Unit 1.txt", sourceKind: "txt" },
    new Set([oldPath])
  );

  assert.equal(result.made, 1, "only the new agent note is finalised");
  assert.deepEqual(result.paths, [newPath]);
  assert.deepEqual(app.modified.map((m) => m.path), [newPath]);
  assert.equal(oldFile.text, oldText, "the existing agent-written note is not re-finalised");
});
