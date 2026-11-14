"use strict";
/*
 * The overnight import: a queue of files imports with no clicks, no review
 * screen and no dialogs. A broken file is recorded and the queue continues,
 * every written note gets its blind check in a second pass, and one Notice
 * plus a log note say what happened in the morning.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeDom } = require("./helpers/fake");
const { makePdfRuntime, makeTrackedApp, textPdf } = require("./helpers/real-pdf");

const runtime = makePdfRuntime();
obsidian.loadPdfJs = async () => runtime;

const { T, Plugin: QT } = load();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const VIEW_TYPE_IMPORT_WINDOW = "question-tracker-import-window";

const NOTE_BLOCK = `---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n\n## Answer\n**Correct Answer: B**\n`;

async function setup() {
  const state = makeTrackedApp([]);
  const plugin = new QT(state.app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.provider = "anthropic";
  plugin.settings.ai.api.keys.anthropic = "sk-test";
  plugin.settings.ai.api.model = "claude-sonnet-4-5";
  plugin.settings.importOptions = { capture: false, pagePics: false };
  plugin.settings.importDefaults = {};
  plugin.settings.importFolder = "";
  plugin.settings.questionFolder = "Questions";
  plugin.aiChat = async () => NOTE_BLOCK;
  plugin.aiComplete = async () => '{"answer":"B"}';
  state.plugin = plugin;
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;
  obsidian.noticeObjects.length = 0;
  return state;
}

function file(name, bytes) {
  return {
    name,
    async arrayBuffer() {
      return bytes;
    },
  };
}

function openOvernight(plugin, app, sources, resume) {
  const dom = makeDom();
  const leaf = { app, view: null };
  leaf.setViewState = async () => {
    const view = plugin.views[VIEW_TYPE_IMPORT_WINDOW](leaf);
    leaf.view = view;
    view.contentEl = dom.root;
    view.containerEl = dom.root;
    await view.onOpen();
  };
  app.workspace.getLeavesOfType = (type) => (type === VIEW_TYPE_IMPORT_WINDOW && leaf.view ? [leaf] : []);
  app.workspace.openPopoutLeaf = () => leaf;
  app.workspace.revealLeaf = () => {};
  if (resume) plugin.resumeOvernightImport();
  else plugin.startOvernightImport(sources);
  return { leaf, dom };
}

async function waitFor(check, label, ms) {
  const end = Date.now() + (Number(ms) > 0 ? Number(ms) : 20000);
  while (Date.now() < end) {
    if (check()) return;
    await sleep(25);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function notices() {
  return obsidian.notices.map((n) => (typeof n === "string" ? n : (n && n.text) || "")).join("\n");
}

function questionNotes(app) {
  return app.vault.getMarkdownFiles().filter((f) => /Q\d+(-\d+)?\.md$/.test(f.path) && !/log\.md$/i.test(f.path));
}

function logNote(app) {
  return app.vault.getMarkdownFiles().find((f) => /Overnight import log\.md$/i.test(f.path));
}

test("overnight import: two files import with no clicks and every note is checked", async () => {
  const state = await setup();
  const { plugin, app } = state;
  const bytes = await textPdf();
  const { leaf } = openOvernight(plugin, app, [file("a.pdf", bytes), file("b.pdf", bytes)]);
  await waitFor(() => leaf.view && leaf.view.modal, "the import popout");
  const modal = leaf.view.modal;
  assert.equal(modal.unattended, true, "the run is unattended");
  assert.ok(modal.batchStarted, "writing starts without a setup screen");
  await waitFor(() => modal.closed, "the run to finish");
  const notes = questionNotes(app);
  assert.ok(notes.length >= 2, `both files wrote notes (got ${notes.length})`);
  for (const note of notes) {
    assert.equal(note.fm.verified, true, `${note.path} passed its blind check in the second pass`);
  }
  assert.match(notices(), /Overnight import finished/, "one closing Notice summarizes the run");
  const log = logNote(app);
  assert.ok(log, "the morning log note is written");
  assert.match(log.text, /\|.*File.*\|.*Notes.*\|/i, "the log has a per-file table");
  assert.match(log.text, /a\.pdf[\s\S]*b\.pdf/, "the log names both files");
});

test("overnight import: a broken file is recorded and the queue continues", async () => {
  const state = await setup();
  const { plugin, app } = state;
  const bytes = await textPdf();
  const { leaf } = openOvernight(plugin, app, [file("broken.pdf", Buffer.from([1, 2, 3, 4])), file("good.pdf", bytes)]);
  await waitFor(() => leaf.view && leaf.view.modal, "the import popout");
  const modal = leaf.view.modal;
  await waitFor(() => modal.closed, "the run to finish");
  assert.ok(modal.batchResults.length >= 1, "results were recorded");
  assert.ok(modal.batchResults[0].error, `the broken file is recorded: ${modal.batchResults[0].error}`);
  const notes = questionNotes(app);
  assert.ok(notes.length >= 1, "the good file still imported");
  assert.match(notices(), /Overnight import finished/, "the run still closes with a summary");
  const run = T.overnightRun.latestOvernightRun(app);
  assert.ok(run.files.some((f) => f.sourcePath === "broken.pdf" && f.status !== "done"), "the journal marks the broken file");
});

test("overnight import: vault files import by path and resume skips the finished file", async () => {
  const state = await setup();
  const { plugin, app } = state;
  const bytes = await textPdf();
  await app.vault.createBinary("Inbox/a.pdf", bytes);
  await app.vault.createBinary("Inbox/b.pdf", bytes);
  const first = openOvernight(plugin, app, ["Inbox/a.pdf", "Inbox/b.pdf"]);
  await waitFor(() => first.leaf.view && first.leaf.view.modal, "the import popout");
  await waitFor(() => first.leaf.view.modal.closed, "the first run to finish");
  const firstNotes = questionNotes(app).length;
  assert.ok(firstNotes >= 2, "both vault files imported");
  const journal = T.overnightRun.latestOvernightRun(app);
  assert.ok(journal.files.every((f) => f.status === "done"), "every file is marked done");
  // A later run left file1 finished: resume imports only what is left.
  const older = T.overnightRun.makeOvernightRun([
    { sourcePath: "Inbox/a.pdf", hash: "", vault: true },
    { sourcePath: "Inbox/b.pdf", hash: "", vault: true },
  ]);
  T.overnightRun.markRunFile(older, "Inbox/a.pdf", { status: "done", notes: ["Questions/a/A-PDF-Q01.md"] });
  T.overnightRun.storeOvernightRun(app, older);
  const before = questionNotes(app).length;
  const aNotes = questionNotes(app).filter((f) => f.path.startsWith("Questions/a/")).length;
  const second = openOvernight(plugin, app, null, true);
  await waitFor(() => second.leaf.view && second.leaf.view.modal, "the resume popout");
  await waitFor(() => second.leaf.view.modal.closed, "the resume to finish");
  assert.equal(questionNotes(app).length, before + 1, "resume writes only the unfinished file");
  assert.equal(questionNotes(app).filter((f) => f.path.startsWith("Questions/a/")).length, aNotes, "the finished file is never reopened");
});

test("overnight import: undo removes exactly what the run wrote", async () => {
  const state = await setup();
  const { plugin, app } = state;
  const bytes = await textPdf();
  const first = openOvernight(plugin, app, [file("a.pdf", bytes), file("b.pdf", bytes)]);
  await waitFor(() => first.leaf.view && first.leaf.view.modal, "the import popout");
  await waitFor(() => first.leaf.view.modal.closed, "the run to finish");
  const run = T.overnightRun.latestOvernightRun(app);
  const written = T.overnightRun.runNotePaths(run);
  assert.ok(written.length >= 4, `notes and copies are journaled (got ${written.length})`);
  const removed = await plugin.undoOvernightImport();
  assert.ok(removed >= 4, `everything the run wrote is removed (got ${removed})`);
  for (const path of written) assert.ok(!app.vault.getAbstractFileByPath(path), `${path} is gone`);
  assert.ok(!app.vault.getAbstractFileByPath("Questions/a"), "the run folders are removed");
  assert.ok(logNote(app), "the morning log stays as evidence");
  assert.equal(T.overnightRun.latestOvernightRun(app).status, "undone");
  assert.equal(await plugin.undoOvernightImport(), 0, "a second undo finds nothing to do");
});

test("overnight import: a spent budget pauses the checks and the queue resumes later", async () => {
  const state = await setup();
  const { plugin, app } = state;
  const bytes = await textPdf();
  plugin.aiComplete = async () => {
    throw new Error("The daily AI request cap (100) has been reached. Raise it in Settings, MCQ Tracker, AI, or try again tomorrow.");
  };
  const first = openOvernight(plugin, app, [file("a.pdf", bytes)]);
  await waitFor(() => first.leaf.view && first.leaf.view.modal, "the import popout");
  await waitFor(() => first.leaf.view.modal.closed, "the paused run to close");
  const paused = T.overnightRun.latestOvernightRun(app);
  assert.equal(paused.status, "paused", "the queue pauses instead of failing");
  assert.match(notices(), /paus/i, "the pause is announced");
  const notes = questionNotes(app);
  assert.ok(notes.length >= 1, "the notes are written");
  assert.ok(notes.every((n) => !n.fm.verified), "no note is marked either way");
  // The cap resets overnight: resume checks everything the run wrote.
  plugin.aiComplete = async () => '{"answer":"B"}';
  const second = openOvernight(plugin, app, null, true);
  await waitFor(() => second.leaf.view && second.leaf.view.modal, "the resume popout");
  await waitFor(() => second.leaf.view.modal.closed, "the resumed run to finish");
  const done = T.overnightRun.latestOvernightRun(app);
  assert.equal(done.status, "finished");
  assert.ok(questionNotes(app).every((n) => n.fm.verified === true), "every note is verified after the resume");
});

test("overnight import: a reload resumes the unfinished queue", async () => {
  const state = await setup();
  const { plugin, app } = state;
  const bytes = await textPdf();
  await app.vault.createBinary("Inbox/a.pdf", bytes);
  await app.vault.createBinary("Inbox/b.pdf", bytes);
  const older = T.overnightRun.makeOvernightRun([
    { sourcePath: "Inbox/a.pdf", hash: "", vault: true },
    { sourcePath: "Inbox/b.pdf", hash: "", vault: true },
  ]);
  T.overnightRun.markRunFile(older, "Inbox/a.pdf", { status: "done", notes: [] });
  T.overnightRun.storeOvernightRun(app, older);
  const dom = makeDom();
  const leaf = { app, view: null };
  leaf.setViewState = async () => {
    const view = plugin.views[VIEW_TYPE_IMPORT_WINDOW](leaf);
    leaf.view = view;
    view.contentEl = dom.root;
    view.containerEl = dom.root;
    await view.onOpen();
  };
  app.workspace.getLeavesOfType = () => [];
  app.workspace.openPopoutLeaf = () => leaf;
  app.workspace.revealLeaf = () => {};
  await plugin.resumeUnfinishedOvernightRun();
  await waitFor(() => leaf.view && leaf.view.modal, "the resumed run");
  await waitFor(() => leaf.view.modal.closed, "the resumed run to finish");
  assert.match(notices(), /resuming now/i, "one notice names the resume");
  assert.ok(questionNotes(app).length >= 1, "the unfinished file imports");
  assert.equal(plugin._overnightResumed, true);
});

test("overnight import: Stop ends the run and the journal keeps the queue", async () => {
  const state = await setup();
  const { plugin, app } = state;
  let release = null;
  plugin.aiChat = () =>
    new Promise((resolve) => {
      release = () => resolve(NOTE_BLOCK);
    });
  const bytes = await textPdf();
  const { leaf } = openOvernight(plugin, app, [file("slow-a.pdf", bytes), file("slow-b.pdf", bytes)]);
  await waitFor(() => leaf.view && leaf.view.modal && leaf.view.modal.running, "the run to start");
  const modal = leaf.view.modal;
  assert.ok(modal.stopBtns && modal.stopBtns.length, "Stop stays live while unattended");
  modal.requestStop(plugin, "discard");
  if (release) release();
  await waitFor(() => modal.closed, "the stopped run to close");
  assert.match(notices(), /overnight import (finished|stopped)/i, "the stop is announced");
  const run = T.overnightRun.latestOvernightRun(app);
  assert.ok(run, "the run is journaled");
  assert.ok(["stopped", "finished"].includes(run.status), `the journal says ${run.status}`);
});
