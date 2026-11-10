"use strict";
/*
 * Batch import, popout lifecycle and the end-of-batch practice action.
 * These tests use real PDF bytes through the shipping pdf.js adapter, so the
 * two-file queue reads actual documents rather than a synthetic item list.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeDom } = require("./helpers/fake");
const { makePdfRuntime, makeTrackedApp, textPdf } = require("./helpers/real-pdf");

const runtime = makePdfRuntime();
obsidian.loadPdfJs = async () => runtime;

const { T, Plugin: QT } = load();
global.createEl = (tag, opts) => makeDom().root.createEl(tag, opts);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const VIEW_TYPE_IMPORT_WINDOW = "question-tracker-import-window";

function enableAi(plugin) {
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.provider = "anthropic";
  plugin.settings.ai.api.keys.anthropic = "sk-test";
  plugin.settings.ai.api.model = "claude-sonnet-4-5";
}

async function setup() {
  const state = makeTrackedApp([]);
  const plugin = new QT(state.app);
  await plugin.onload();
  enableAi(plugin);
  plugin.settings.importOptions = { capture: false, pagePics: false };
  plugin.settings.importDefaults = {};
  plugin.settings.importFolder = "";
  plugin.settings.questionFolder = "Questions";
  plugin.verifyDraftQuestions = async () => {};
  plugin.aiChat = async () =>
    `---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n\n## Answer\n**Correct Answer: B**\n`;
  state.plugin = plugin;
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;
  obsidian.noticeObjects.length = 0;
  return state;
}

function attach(modal) {
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.modalEl = dom.root;
  return dom;
}

function file(name, bytes) {
  return {
    name,
    async arrayBuffer() {
      return bytes;
    },
  };
}

function makeLeaf(app) {
  return {
    app,
    view: null,
    detached: false,
    detach() {
      this.detached = true;
      if (this.view && typeof this.view.onClose === "function") return this.view.onClose();
    },
  };
}

async function openWindow(plugin, app, options) {
  plugin.pendingImportOptions = options || {};
  const factory = plugin.views[VIEW_TYPE_IMPORT_WINDOW];
  const leaf = makeLeaf(app);
  const view = factory(leaf);
  leaf.view = view;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.containerEl = dom.root;
  await view.onOpen();
  return { view, leaf, dom };
}

function completionModal(modal) {
  return obsidian.modals.find((entry) => entry !== modal && entry.onOpen && entry.render);
}

async function waitFor(check, label) {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(15);
  }
  throw new Error(`timed out waiting for ${label}`);
}

test("batch import: two PDFs are queued, imported one after the other, and summarized", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();

  assert.ok(dom.texts().includes("Import questions from files"), "the batch setup is visible");
  assert.ok(dom.texts().includes("Import 2 files"), "one action starts both files");
  assert.deepEqual(modal.files.map((entry) => entry.name), ["Unit A.pdf", "Unit B.pdf"]);

  await modal.startBatch();
  assert.ok(dom.texts().join("\n").includes("File 1 of 2"), "the first file has a queue position");
  assert.ok(dom.texts().includes("Found 1 question"), "the first review is shown");

  await dom.click("Create 1 note");
  await waitFor(() => dom.texts().join("\n").includes("File 2 of 2"), "the second file review");
  assert.ok(dom.texts().includes("Unit B.pdf"), "the second review names its source");
  await dom.clickLast("Create 1 note");

  await waitFor(() => completionModal(modal), "the completion summary");
  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /Import complete/);
  assert.match(summary, /2 question notes imported from 2 files/);
  assert.ok(summary.includes("Practice these questions"), "the completion summary offers practice");
  assert.ok(obsidian.notices.some((line) => /Imported 2 question notes from 2 files/.test(line)), "the long summary notice is emitted");

  let practiced = null;
  state.plugin.practiceFolder = async (folder, expected) => {
    practiced = { folder, expected };
  };
  await completeDom.click("Practice these questions");
  await sleep(0);
  assert.deepEqual(practiced, { folder: "Questions", expected: 2 }, "the button practices the imported parent folder");
});

test("desktop import: a fresh import requests a popout and an open import is focused", async () => {
  const state = await setup();
  obsidian.modals.length = 0;
  let requests = 0;
  let revealed = 0;
  let leaves = [];
  let request = null;
  const leaf = { view: { getViewType: () => VIEW_TYPE_IMPORT_WINDOW } };
  leaf.setViewState = (viewState) => {
    request.viewState = viewState;
    leaves = [leaf];
    return Promise.resolve();
  };
  state.app.workspace.openPopoutLeaf = (options) => {
    requests++;
    request = { options };
    return leaf;
  };
  state.app.workspace.getLeavesOfType = () => leaves;
  state.app.workspace.revealLeaf = () => {
    revealed++;
  };

  state.plugin.openPdfImport();
  assert.equal(requests, 1, "the desktop importer requests one popout leaf");
  assert.equal(request.options.size.width, 780);
  assert.equal(request.options.size.height, 900);
  assert.equal(request.viewState.type, VIEW_TYPE_IMPORT_WINDOW);
  assert.equal(obsidian.modals.length, 0, "no in-window modal is opened when a popout is available");

  state.plugin.openPdfImport();
  assert.equal(requests, 1, "no second popout is opened while one is open");
  assert.equal(revealed, 1, "the second request focuses the existing import window");
  assert.ok(state.plugin.views[VIEW_TYPE_IMPORT_WINDOW], "the import window view is registered");
});

test("import window: close and reopen reattaches the same running batch and review", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const first = await openWindow(state.plugin, state.app, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const modal = first.view.modal;

  await modal.startBatch();
  assert.ok(first.dom.texts().join("\n").includes("File 1 of 2"));
  assert.ok(first.dom.texts().includes("Found 1 question"));
  const progress = modal.progress.notice;
  let reviewRenders = 0;
  const showReview = modal.showReview.bind(modal);
  modal.showReview = () => { reviewRenders++; return showReview(); };
  assert.match(progress.message, /Waiting for your review/, "the notice names the current stage");
  assert.equal(progress.hidden, false);

  await first.view.onClose();
  assert.equal(modal.closed, false, "closing the window does not close the import");
  assert.equal(state.plugin.importSession.modal, modal, "the plugin keeps the batch session");
  assert.equal(progress.hidden, false, "the progress notice stays visible after the popout closes");
  assert.equal(first.leaf.detached, false, "closing the view itself does not detach the leaf");

  const second = await openWindow(state.plugin, state.app, {});
  assert.equal(second.view.modal, modal, "reopening reuses the running import");
  assert.equal(second.view.contentEl.__own.children.some((child) => child.classes && child.classes.has("qt-import-panel")), true, "the existing panel is moved into the new window");
  assert.equal(reviewRenders, 1, "the review is rebuilt for the new popout window");
  assert.ok(first.dom.texts().join("\n").includes("File 1 of 2"), "the review state survived the window close");

  await first.dom.clickLast("Create 1 note");
  await waitFor(() => first.dom.texts().join("\n").includes("File 2 of 2"), "the second file review after reopen");
  await first.dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the completion summary after reopen");

  assert.equal(modal.closed, true, "finishing the batch closes the import session");
  assert.equal(progress.hidden, true, "finishing dismisses the live progress notice");
  assert.equal(obsidian.modals.filter((entry) => entry !== modal && entry.render).length, 1, "the completion summary opens once");
});

test("import window: closing while AI is answering still finishes and summarizes", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const reply = `---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n\n## Answer\n**Correct Answer: B**\n`;
  let release;
  let calls = 0;
  let windowClosed = false;
  let lateReads = 0;
  const guardedFile = (name) => ({
    name,
    async arrayBuffer() {
      if (windowClosed) {
        lateReads++;
        throw new Error("file handle no longer belongs to a live window");
      }
      return bytes;
    },
  });
  state.plugin.aiChat = () => {
    if (calls++ === 0) return new Promise((resolve) => { release = () => resolve(reply); });
    return Promise.resolve(reply);
  };

  const opened = await openWindow(state.plugin, state.app, { files: [guardedFile("Unit A.pdf"), guardedFile("Unit B.pdf")] });
  const modal = opened.view.modal;
  const started = modal.startBatch();
  await waitFor(() => typeof release === "function", "the pending AI request");
  const progress = modal.progress.notice;

  await opened.view.onClose();
  windowClosed = true;
  assert.equal(modal.closed, false, "closing during the AI request does not abort it");
  assert.equal(progress.hidden, false, "the progress notice remains visible");

  release();
  await started;
  assert.ok(opened.dom.texts().join("\n").includes("File 1 of 2"), "the first review arrives after the window closed");
  await opened.dom.click("Create 1 note");
  await waitFor(() => opened.dom.texts().join("\n").includes("File 2 of 2"), "the second file after the closed-window review");
  await opened.dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the summary after completing with the window closed");
  assert.equal(lateReads, 0, "the second file's bytes are captured before the window closes");

  assert.equal(modal.closed, true, "the batch closes its session after finishing");
  assert.equal(progress.hidden, true, "the summary dismisses the progress notice");
  assert.equal(state.plugin.importSession, null, "the finished session is cleared");
  assert.equal(obsidian.modals.filter((entry) => entry !== modal && entry.render).length, 1, "one summary opens without reopening the window");
});

test("batch import: a failed file is recorded and the remaining PDF still imports", async () => {
  const state = await setup();
  const bytes = await textPdf();
  state.failCreate = (path) => path.startsWith("Questions/Unit A/") && /\.md$/i.test(path);
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  await modal.startBatch();

  await dom.click("Create 1 note");
  await waitFor(() => dom.texts().join("\n").includes("File 2 of 2"), "the second file after the first failed");
  assert.ok(dom.texts().join("\n").includes("The other files will continue."), "the failure names the continuing queue");
  await dom.clickLast("Create 1 note");

  await waitFor(() => completionModal(modal), "the mixed-result summary");
  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /Import finished with problems/);
  assert.match(summary, /Could not import/);
  assert.match(summary, /1 question note imported from 1 file/);
  assert.match(summary, /1 file failed/);
  assert.ok(summary.includes("Unit B.pdf"), "the successful file is listed");
  assert.ok(completeDom.texts().includes("Practice these questions"), "practice is offered after a partial success");

  let practiced = null;
  state.plugin.practiceFolder = async (folder, expected) => {
    practiced = { folder, expected };
  };
  await completeDom.click("Practice these questions");
  await sleep(0);
  assert.deepEqual(practiced, { folder: "Questions", expected: 1 }, "practice still targets the imported parent folder");
});

test("batch import: a full failure dismisses progress and opens one summary", async () => {
  const state = await setup();
  const bytes = await textPdf();
  state.failCreate = (path) => /\.md$/i.test(path);
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  await modal.startBatch();
  const progress = modal.progress.notice;

  await dom.click("Create 1 note");
  await waitFor(() => dom.texts().join("\n").includes("File 2 of 2"), "the second file after the first failure");
  await dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the full-failure summary");

  assert.equal(modal.progress, null, "the progress object is cleared");
  assert.equal(progress.hidden, true, "the live progress notice is hidden");
  assert.equal(obsidian.notices.filter((line) => /No question notes were imported/.test(line)).length, 1, "one final summary notice is emitted");
  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /No question notes were imported/);
  assert.match(summary, /2 files failed/);
  assert.equal(completeDom.texts().includes("Practice these questions"), false, "there is nothing to practice");
  assert.equal(obsidian.modals.filter((entry) => entry !== modal && entry.render).length, 1, "the summary opens once");
});

test("batch import: cancelling the import dismisses the notice and the popout leaf", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const opened = await openWindow(state.plugin, state.app, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const modal = opened.view.modal;
  await modal.startBatch();
  const progress = modal.progress.notice;
  assert.equal(progress.hidden, false);

  modal.close();

  assert.equal(modal.closed, true, "Cancel closes the import");
  assert.equal(modal.progress, null, "Cancel clears the progress object");
  assert.equal(progress.hidden, true, "Cancel dismisses the live progress notice");
  assert.equal(state.plugin.importSession, null, "Cancel ends the plugin session");
  assert.equal(opened.leaf.detached, true, "Cancel detaches the popout leaf");
  if (modal.cleanupPromise) await modal.cleanupPromise;
  assert.equal(obsidian.modals.filter((entry) => entry !== modal && entry.render).length, 0, "Cancel does not open a completion summary");
});

test("notice placement: the import notice moves into the main window container", async () => {
  const container = {
    appendChild(el) {
      el.parentNode = this;
    },
  };
  const oldParent = {
    removeChild(el) {
      el.parentNode = null;
    },
  };
  const noticeEl = { parentNode: oldParent };
  const doc = {
    createElement() {
      return { appendChild() {} };
    },
    body: {
      querySelector(selector) {
        assert.equal(selector, ".notice-container");
        return container;
      },
    },
  };

  T.moveNoticeToMain({ noticeEl }, doc);
  assert.equal(noticeEl.parentNode, container, "the notice is parented by the main notice area");
});

test("import window: the popout view mounts the real import controls", async () => {
  const state = await setup();
  obsidian.modals.length = 0;
  const factory = state.plugin.views[VIEW_TYPE_IMPORT_WINDOW];
  const leaf = makeLeaf(state.app);
  const view = factory(leaf);
  leaf.view = view;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.containerEl = dom.root;
  await view.onOpen();
  assert.ok(view.modal, "the view owns the import panel");
  assert.ok(dom.texts().join("\n").includes("Import questions from a file"), "the importer renders in the popout");
  await view.onClose();
});
