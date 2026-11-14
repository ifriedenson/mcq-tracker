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

function agentMessage(id) {
  return [{ info: { id, role: "assistant", time: { completed: Date.now() }, finish: "stop" }, parts: [] }];
}

const AGENT_NOTE = `---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n\n## Answer\n**Correct Answer: B**\n`;

async function waitFor(check, label, ms) {
  const end = Date.now() + (Number(ms) > 0 ? Number(ms) : 5000);
  while (Date.now() < end) {
    if (check()) return;
    await sleep(15);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/** Opens the import through the real popout path and returns the live view. */
async function openPopoutImport(plugin, app, options) {
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
  plugin.openPdfImport(options);
  await waitFor(() => leaf.view && leaf.view.modal, "the import popout");
  return { leaf, view: leaf.view, dom };
}

/** A real PracticeView behind the real activateView path, with a stand-in screen. */
function attachPracticeView(app, plugin) {
  const leaf = { app, view: null, screen: null };
  leaf.setViewState = async () => {
    const view = new T.PracticeView(leaf, plugin);
    view.app = app;
    const screen = makeDom();
    view.contentEl = screen.root;
    view.containerEl = screen.root;
    leaf.view = view;
    leaf.screen = screen;
  };
  app.workspace.getLeaf = () => leaf;
  app.workspace.revealLeaf = () => {};
  return leaf;
}

/**
 * Obsidian's metadata cache parses the frontmatter of a note it just wrote; the
 * test vault does not, so read the note text the import actually produced. This
 * is what makes the imported notes visible to getQuestions() and Practice.
 */
function indexImportedNotes(app, plugin) {
  for (const made of app.created || []) {
    const file = app.vault.getAbstractFileByPath(made.path);
    if (!file) continue;
    const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(made.text || "");
    const fm = {};
    if (block) {
      for (const line of block[1].split(/\r?\n/)) {
        const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
        if (m) fm[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      }
    }
    file.fm = fm;
    file.text = made.text;
    file.headings = [...String(made.text || "").matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => ({ heading: m[1] }));
  }
  if (plugin) {
    plugin.invalidateSnapshots();
    plugin.rebuildQuestionIndex();
  }
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

const ONE_NOTE_REPLY = `---\nnumber: 1\nanswer: B\nanswer_source: pdf\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n\n## Answer\n**Correct Answer: B**\n`;

test("source picker: the chooser is created in the button's window, asks for several files, and opens immediately", async () => {
  const appended = [];
  const handlers = {};
  const input = {
    type: "",
    accept: "",
    multiple: false,
    value: "",
    style: {},
    attrs: {},
    files: null,
    parentNode: null,
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    addEventListener(ev, fn) {
      handlers[ev] = fn;
    },
    click() {
      this.clicked = true;
    },
    remove() {
      this.removed = true;
    },
  };
  const doc = {
    createElement(tag) {
      assert.equal(tag, "input");
      return input;
    },
    body: {
      appendChild(el) {
        appended.push(el);
        el.parentNode = {
          removeChild() {
            el.parentNode = null;
          },
        };
        return el;
      },
    },
    defaultView: {
      setTimeout(fn) {
        fn();
        return 0;
      },
    },
  };

  const state = await setup();
  const modal = new T.PdfImportModal(state.app, state.plugin, {});
  const picked = [];
  const returned = modal.openFileChooser({ ownerDocument: doc }, (list) => picked.push(list));
  assert.equal(returned, input, "the caller gets the input that was used");
  assert.equal(appended.length, 1, "the input is attached before the OS chooser is asked");
  assert.equal(input.clicked, true, "the chooser opens from the same click, not on a later tick");
  assert.equal(input.multiple, true, "more than one file can be chosen at once");
  assert.match(input.accept, /\.pdf/, "PDFs are accepted");
  assert.equal(input.attrs["aria-hidden"], "true", "the temporary input is hidden from assistive tech");

  input.files = [file("Unit A.pdf"), file("Unit B.pdf")];
  handlers.change();
  assert.deepEqual(picked[0].map((entry) => entry.name), ["Unit A.pdf", "Unit B.pdf"], "every chosen file is handed over");
  assert.equal(input.parentNode, null, "the temporary input is removed after the pick");
  assert.equal(input.value, "", "the same file can be chosen again");
});

test("source picker: choosing files replaces the queue and labels the batch", async () => {
  const state = await setup();
  const modal = new T.PdfImportModal(state.app, state.plugin, {});
  attach(modal);
  modal.onOpen();

  const described = [];
  const changes = [];
  const count = modal.acceptChosenFiles(
    [file("Unit A.pdf"), file("Unit B.pdf")],
    { setDesc: (text) => described.push(text) },
    (names, n) => changes.push([names, n])
  );

  assert.equal(count, 2, "both files are accepted");
  assert.equal(modal.files.length, 2);
  assert.equal(modal.batchMode, true, "two files make a batch");
  assert.deepEqual(changes, [[["Unit A.pdf", "Unit B.pdf"], 2]], "the screen is told about the whole pick");
  assert.equal(described.at(-1), "Unit A.pdf, Unit B.pdf", "the pick is described by its file names");
});

test("single import: adding a second PDF while the first one runs imports both", async () => {
  const state = await setup();
  const bytes = await textPdf();
  let release;
  let calls = 0;
  state.plugin.aiChat = () => {
    if (calls++ === 0) return new Promise((resolve) => { release = () => resolve(ONE_NOTE_REPLY); });
    return Promise.resolve(ONE_NOTE_REPLY);
  };

  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  const started = modal.start();
  await waitFor(() => typeof release === "function", "the pending AI request");
  assert.equal(dom.find("Add more files...").length, 1, "the running screen offers the queue button");

  const added = await modal.addFiles([file("Unit B.pdf", bytes)]);
  assert.equal(added, 1, "the second file is queued");
  assert.equal(modal.batchJobs.length, 2, "the running file is the first job in the new queue");
  assert.equal(modal.batchMode, true, "the single import becomes a batch");
  assert.equal(modal.batchJobs[0].folder, "Questions/Unit A", "the running file keeps its own folder");
  assert.equal(modal.batchJobs[1].folder, "Questions/Unit B", "the added file gets a sibling folder");

  release();
  await started;
  assert.equal(dom.find("Add more files...").length, 2, "the review screen offers the queue button too");
  assert.ok(dom.texts().join("\n").includes("File 1 of 2"), "the first review names the larger queue");
  await dom.click("Create 1 note");
  await waitFor(() => dom.texts().join("\n").includes("File 2 of 2"), "the added file's review");
  assert.ok(dom.texts().join("\n").includes("Unit B.pdf"), "the added file is the one being reviewed");
  await dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the two-file summary");

  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  assert.match(completeDom.texts().join("\n"), /2 question notes imported from 2 files/);
});

test("batch import: a file added during review is imported after the current one", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  await modal.startBatch();
  assert.ok(dom.texts().join("\n").includes("File 1 of 2"));

  const added = await modal.addFiles([file("Unit C.pdf", bytes)]);
  assert.equal(added, 1, "the file chosen during review is queued");
  assert.equal(modal.batchJobs.length, 3);
  assert.equal(modal.batchJobs.at(-1).folder, "Questions/Unit C", "the added file gets its own subfolder");
  assert.equal(modal.progress.total, 3, "the live notice knows the queue grew");

  await dom.click("Create 1 note");
  await waitFor(() => dom.texts().join("\n").includes("File 2 of 3"), "the second review with the larger queue");
  await dom.clickLast("Create 1 note");
  await waitFor(() => dom.texts().join("\n").includes("File 3 of 3"), "the added file's review");
  assert.ok(dom.texts().join("\n").includes("Unit C.pdf"));
  await dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the three-file summary");

  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /3 question notes imported from 3 files/);
  assert.ok(summary.includes("Unit C.pdf"), "the added file appears in the summary");
});

test("import end to end: a PDF added mid-import, the live notice, the summary and real Practice", async () => {
  const state = await setup();
  const bytes = await textPdf();
  let release;
  let calls = 0;
  state.plugin.aiChat = () => {
    if (calls++ === 0) return new Promise((resolve) => { release = () => resolve(ONE_NOTE_REPLY); });
    return Promise.resolve(ONE_NOTE_REPLY);
  };
  const practiceLeaf = attachPracticeView(state.app, state.plugin);

  // The real popout path, starting from one PDF exactly as a user would.
  const opened = await openPopoutImport(state.plugin, state.app, { files: [file("Unit A.pdf", bytes)] });
  const modal = opened.view.modal;
  await opened.dom.click("Start import");
  await waitFor(() => typeof release === "function", "the first AI request");

  // Add the second PDF from the popout while the first is still importing.
  let chooserButton = null;
  modal.openFileChooser = (buttonEl, onPicked) => {
    chooserButton = buttonEl;
    onPicked([file("Unit B.pdf", bytes)]);
    return null;
  };
  await opened.dom.click("Add more files...");
  await waitFor(() => modal.batchJobs.length === 2, "the second file joins the running queue");
  assert.ok(chooserButton, "the add button asked for another file");
  const live = modal.progress.notice;
  assert.equal(live.hidden, false, "the live notice appears while the queue runs");
  assert.match(live.message, /Importing 1 of 2/, "the notice names the running file and the new total");

  release();
  await waitFor(() => opened.dom.texts().join("\n").includes("File 1 of 2"), "the first review");
  assert.match(live.message, /Importing 1 of 2/, "the notice still reports the first of two");
  assert.match(live.message, /Waiting for your review/, "the notice reports the review stage");

  await opened.dom.click("Create 1 note");
  await waitFor(() => opened.dom.texts().join("\n").includes("File 2 of 2"), "the added file's review");
  assert.match(live.message, /Importing 2 of 2/, "the notice advances to the added file");
  assert.equal(live.hidden, false, "the notice stays up for the added file");

  await opened.dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the completion summary");
  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /Import complete/);
  assert.match(summary, /2 question notes imported from 2 files/, "the popup reports the true file and note counts");
  assert.ok(summary.includes("Unit A.pdf") && summary.includes("Unit B.pdf"), "both files are listed");
  assert.equal((summary.match(/1 note/g) || []).length, 2, "each file reports its own note count");
  assert.equal(live.hidden, true, "the live notice is replaced at the end");
  assert.ok(
    obsidian.notices.some((line) => /Imported 2 question notes from 2 files/.test(line)),
    "the long-lived summary notice reports the true total"
  );

  // What the import actually wrote is now visible to the question index.
  indexImportedNotes(state.app, state.plugin);
  const imported = (state.app.created || []).map((row) => row.path).filter((path) => /\.md$/i.test(path));
  assert.deepEqual(
    imported.map((path) => path.replace(/^Questions\//, "").split("/")[0]).sort(),
    ["Unit A", "Unit B"],
    "each PDF got its own folder under the parent"
  );
  assert.equal(state.plugin.getQuestions().length, 2, "both imported notes are practiceable");

  // The real button, the real practiceFolder and the real activateView.
  await completeDom.click("Practice these questions");
  await waitFor(() => practiceLeaf.view && practiceLeaf.view.state === "question", "practice to start");
  assert.deepEqual(state.plugin.settings.filters.folder, ["Questions"], "practice is limited to the imported parent folder");
  assert.equal(state.plugin.settings.practicePath, "", "practice is not limited to a single note");
  const started = practiceLeaf.view.current;
  assert.ok(started && imported.includes(started.file.path), "practice opened one of the imported notes");
  assert.equal(practiceLeaf.view.plugin.getQuestions().length, 2, "both imported notes were available to practice");
});

test("popout import: refocusing the main window keeps the import window and its progress alive", async () => {
  const state = await setup();
  const bytes = await textPdf();
  state.plugin.aiChat = async () => ONE_NOTE_REPLY;
  const opened = await openPopoutImport(state.plugin, state.app, {
    files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)],
  });
  const modal = opened.view.modal;
  await modal.startBatch();
  const live = modal.progress.notice;
  assert.equal(live.hidden, false);
  assert.match(live.message, /Importing 1 of 2/);

  // What Obsidian emits when the main window takes focus after the popout.
  assert.equal(typeof state.app.handlers["ws:active-leaf-change"], "function", "the plugin listens for focus changes");
  state.app.handlers["ws:active-leaf-change"]();
  state.app.handlers["ws:layout-change"]();
  await sleep(0);

  assert.equal(state.plugin.importSession.modal, modal, "the import session survives the main window taking focus");
  assert.equal(opened.view.modal, modal, "the popout still shows the same import");
  assert.equal(opened.leaf.view, opened.view, "the popout view is not detached");
  assert.equal(modal.closed, false, "the import is not cancelled");
  assert.equal(live.hidden, false, "the long-lived notice is still visible");
  assert.match(live.message, /Importing 1 of 2/, "the notice still shows the queue position");

  await opened.dom.click("Create 1 note");
  await waitFor(() => opened.dom.texts().join("\n").includes("File 2 of 2"), "the queue to advance after refocus");
  assert.match(live.message, /Importing 2 of 2/, "progress keeps advancing after the refocus");
  await opened.dom.clickLast("Create 1 note");
  await waitFor(() => completionModal(modal), "the summary after refocus");
  assert.equal(live.hidden, true, "the notice is replaced when the batch completes");
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

test("batch import: Stop ends a hanging OpenCode send and summarizes the batch", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  let finishSend = null;
  const aborted = [];
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "import-1" }),
    send: () => new Promise((resolve) => {
      finishSend = resolve;
    }),
    messages: async () => [],
    abort: async (id) => {
      aborted.push(id);
      return {};
    },
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  assert.equal(modal.method, "agent");
  const started = modal.startBatch();
  await waitFor(() => modal.progress && modal.progress.notice, "the live progress notice");
  const live = modal.progress.notice;
  await waitFor(() => dom.texts().includes("Discard this file"), "the running import");
  await dom.click("Discard this file");
  await started;

  assert.deepEqual(aborted, ["import-1"], "Stop asks OpenCode to abort the import session");
  assert.equal(modal.finishedBatch, true);
  assert.equal(modal.batchResults.length, 1, "the queue stops after the current file");
  assert.match(modal.batchResults[0].skipped.join(" "), /Stopped before this file finished/);
  assert.equal(modal.progress, null);
  assert.equal(live.hidden, true, "the live notice is replaced, not left on Stopping");
  assert.equal(state.files.size, 0, "the stopped file is cleaned up");
  assert.equal(state.dirs.size, 0);

  await waitFor(() => completionModal(modal), "the stopped summary");
  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /Import stopped/);
  assert.match(summary, /No question notes were imported/);
  assert.equal(completeDom.texts().includes("Practice these questions"), false);

  finishSend({});
  await sleep(0);
  assert.equal(state.files.size, 0, "the late agent reply writes nothing");
  assert.ok(!state.plugin.importSession, "no session survives the stopped batch");
});

test("batch import: a slow answer check is waited on and the note is verified", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  const notePath = "Questions/Unit A/Unit A-Q01.md";
  const aiNote = AGENT_NOTE.replace("answer_source: pdf", "answer_source: ai").replace(
    "- A. 3\n- B. 4\n",
    "- A. 3\n- B. 4\n- C. 5\n- D. 6\n"
  );
  let sessions = 0;
  let checks = 0;
  delete state.plugin.verifyDraftQuestions;
  const realVerify = state.plugin.verifyDraftQuestions;
  state.plugin.verifyDraftQuestions = function (items) {
    checks++;
    return realVerify.call(this, items);
  };
  state.plugin.aiChat = async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return '{"answer":"B"}';
  };
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "import-" + ++sessions }),
    promptAsync: async (id) => {
      if (id === "import-1") await state.app.vault.create(notePath, aiNote);
      return {};
    },
    messages: async () => agentMessage("done"),
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  const statuses = [];
  const status = modal.status.bind(modal);
  modal.status = (text, ...args) => {
    statuses.push(String(text));
    return status(text, ...args);
  };
  const started = modal.startBatch();
  await started;
  await waitFor(() => completionModal(modal), "the completion summary after a slow check");

  assert.equal(checks, 1, "the real blind check ran once instead of hanging");
  assert.ok(statuses.some((text) => text.includes("Checking answer 1 of 1")), "the import says which answer it is checking");
  assert.equal(state.files.has(notePath), true, "a slow check still writes the note");
  assert.match(state.files.get(notePath).text, /verified: true/, "a slow matching reply verifies the note");
  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /1 question note imported/);
  assert.ok(summary.includes("Practice these questions"));
});

test("batch import: a long answer check shows how long it has been waiting", async () => {
  const state = await setup();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [] });
  attach(modal);
  modal.onOpen();
  let text = "";
  modal.statusEl = { setText: (value) => (text = String(value)) };
  const stop = modal.waitClock(() => "Checking answer 1 of 1: note...");
  assert.match(text, /Checking answer 1 of 1: note\.\.\. \(0:00\)/, "the wait starts at zero");
  await sleep(1100);
  assert.match(text, /\(0:01\)/, "the line counts up, so a stall is visible in minutes");
  stop();
  const kept = text;
  await sleep(1100);
  assert.equal(text, kept, "stopping the clock leaves the last line on screen");
});

test("batch import: a provider error inside OpenCode is reported at once, not waited out", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = true;
  state.plugin.settings.ai.enabled = true;
  state.plugin.settings.ai.binaryPath = require.resolve("./answer-verification.test.js");
  let restarts = 0;
  state.plugin.ensureOpenCode = async () => {};
  state.plugin.recoverAiConnection = async () => {
    restarts++;
    return true;
  };
  // The shape OpenCode returns for a provider failure: an assistant message
  // with an error and no parts.
  const failed = [
    { info: { id: "u", role: "user" }, parts: [{ type: "text", text: "Write the notes" }] },
    { info: { id: "a", role: "assistant", error: { name: "APIError", data: { message: "429 rate limit exceeded" } } }, parts: [] },
  ];
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "refused" }),
    promptAsync: async () => ({}),
    messages: async () => failed,
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSilenceMs = 60000;
  await modal.startBatch();
  await waitFor(() => completionModal(modal), "the batch summary after a provider error", 20000);

  assert.equal(restarts, 0, "a provider error is not a server problem, so nothing is restarted");
  const text = JSON.stringify(modal.batchResults);
  assert.match(text, /could not write this file: 429 rate limit exceeded/i, "the provider's own words are shown");
  assert.match(text, /waiting a few minutes/i, "a rate limit says what to do next");
});

test("batch import: a silent agent is restarted once and the file is written on the retry", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = true;
  state.plugin.settings.ai.enabled = true;
  state.plugin.settings.ai.binaryPath = require.resolve("./answer-verification.test.js");
  state.plugin.settings.ai.verifyPanel = false;
  let starts = 0;
  let restarts = 0;
  state.plugin.ensureOpenCode = async () => {
    starts++;
  };
  const notePath = "Questions/Unit A/Unit A-Q01.md";
  const aiNote = AGENT_NOTE.replace("answer_source: pdf", "answer_source: ai").replace(
    "- A. 3\n- B. 4\n",
    "- A. 3\n- B. 4\n- C. 5\n- D. 6\n"
  );
  let sessions = 0;
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "silent-" + ++sessions }),
    promptAsync: async (id) => {
      // The first session is frozen on its model call and writes nothing; the
      // session created after the restart writes the note.
      if (id === "silent-2") await state.app.vault.create(notePath, aiNote);
      return {};
    },
    messages: async (id) => (id === "silent-2" ? agentMessage("done") : []),
    abort: async () => ({}),
  });
  state.plugin.recoverAiConnection = async (reason, options) => {
    restarts++;
    if (options && typeof options.onNotice === "function") options.onNotice("Starting OpenCode...");
    return true;
  };

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  modal.agentSilenceMs = 120;
  const statuses = [];
  const status = modal.status.bind(modal);
  modal.status = (text, ...args) => {
    statuses.push(String(text));
    return status(text, ...args);
  };
  await modal.startBatch();
  await waitFor(() => completionModal(modal), "the completion summary after a restarted agent", 20000);

  assert.equal(restarts, 2, "each silent file is restarted once");
  assert.equal(sessions, 4, "each file is started again in a fresh session");
  assert.ok(
    statuses.some((text) => /The agent stopped answering, so OpenCode is being restarted/i.test(text)),
    "the window says why the file is starting again"
  );
  assert.equal(state.files.has("Questions/Unit A/Unit A-Q01.md"), true, "the retried agent writes the note");
});

test("batch import: an agent that stays silent twice ends with a plain reason", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = true;
  state.plugin.settings.ai.enabled = true;
  state.plugin.settings.ai.binaryPath = require.resolve("./answer-verification.test.js");
  let restarts = 0;
  state.plugin.ensureOpenCode = async () => {};
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "silent" }),
    promptAsync: async () => ({}),
    messages: async () => [],
    abort: async () => ({}),
  });
  state.plugin.recoverAiConnection = async () => {
    restarts++;
    return true;
  };

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSilenceMs = 80;
  await modal.startBatch();
  await waitFor(() => completionModal(modal), "the batch summary after two stalled files", 20000);

  assert.equal(restarts, 2, "only one restart is attempted per file");
  assert.equal([...state.files.keys()].filter((k) => k.endsWith(".md")).length, 0, "no notes are left behind");
});

test("batch import: a frozen answer check restarts OpenCode and verifies the same note", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  // Managed, so the recovery has a server of its own to stop and start; the
  // saved program only has to name one for the import to be ready.
  state.plugin.settings.ai.managed = true;
  state.plugin.settings.ai.enabled = true;
  state.plugin.settings.ai.binaryPath = require.resolve("./answer-verification.test.js");
  state.plugin.settings.ai.verifyPanel = false;
  // setup() stubs the check away; this test drives the real one.
  delete state.plugin.verifyDraftQuestions;
  // The agent itself starts OpenCode once per file; count the restarts that
  // the frozen check triggers separately.
  let starts = 0;
  let restarts = 0;
  let frozen = false;
  state.plugin.ensureOpenCode = async () => {
    starts++;
    if (frozen) restarts++;
  };
  const notePath = "Questions/Unit A/Unit A-Q01.md";
  const aiNote = AGENT_NOTE.replace("answer_source: pdf", "answer_source: ai").replace(
    "- A. 3\n- B. 4\n",
    "- A. 3\n- B. 4\n- C. 5\n- D. 6\n"
  );
  let sessions = 0;
  let checks = 0;
  state.plugin.aiChat = async () => {
    checks++;
    if (checks === 1) {
      frozen = true;
      throw new Error("OpenCode accepted the request but wrote nothing new for 6 minutes.");
    }
    frozen = false;
    return '{"answer":"B"}';
  };
  state.plugin.openCode = () => ({
    // The first probe fails, so the frozen check takes the restart path; a
    // server that still answered would keep the note without restarting.
    providers: async () => {
      if (frozen) throw new Error("fetch failed");
      return { providers: [{}] };
    },
    createSession: async () => ({ id: "frozen-" + ++sessions }),
    promptAsync: async (id) => {
      if (id === "frozen-1") await state.app.vault.create(notePath, aiNote);
      return {};
    },
    messages: async () => agentMessage("done"),
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  const statuses = [];
  const status = modal.status.bind(modal);
  modal.status = (text, ...args) => {
    statuses.push(String(text));
    return status(text, ...args);
  };
  await modal.startBatch();
  await waitFor(() => completionModal(modal), "the completion summary after a recovered check", 20000);

  assert.equal(checks, 2, "the same answer is asked again after the server is restarted");
  assert.equal(restarts, 1, "the frozen check starts the server again once");
  assert.ok(
    statuses.some((text) => /OpenCode stopped answering/i.test(text)),
    "the window says why the answer is being asked again"
  );
  assert.ok(statuses.some((text) => text.includes("Checking answer 1 of 1")), "the check line stays on screen");
  assert.match(state.files.get(notePath).text, /verified: true/, "the retried answer verifies the note");
});

test("agent import: no notes removes the source copy and the empty folder", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "import-empty" }),
    promptAsync: async () => ({}),
    messages: async () => agentMessage("done"),
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.folder = "Questions/Unit A";
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  await modal.start();

  assert.equal(state.files.size, 0, "a no-notes agent run leaves no source copy");
  assert.equal(state.dirs.size, 0, "a no-notes agent run leaves no empty folders");
  assert.ok(dom.texts().includes("No notes were created"));
  assert.ok(dom.texts().some((text) => /copied source and any empty folders/.test(text)));
  assert.ok(!dom.texts().some((text) => /^Saved in /.test(text)), "the UI does not claim it saved a folder");
});

test("batch import: an agent finish advances the queue even when send never resolves", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  let sessions = 0;
  const sent = [];
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "import-" + ++sessions }),
    send: (id) => {
      sent.push(id);
      return new Promise(() => {});
    },
    messages: async () => agentMessage("done"),
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  const started = modal.startBatch();
  await started;
  await waitFor(() => completionModal(modal), "the completion summary after both files");

  assert.deepEqual(sent, ["import-1", "import-2"], "a blocking send is started once per file but never awaited");
  assert.equal(modal.batchResults.length, 2, "the second PDF is imported when the first send stays unresolved");
});

test("batch import: Undo everything removes the notes from files that already finished", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  const notePath = "Questions/Unit A/Unit A-Q01.md";
  let sessions = 0;
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "import-" + ++sessions }),
    promptAsync: async (id) => {
      if (id === "import-1") await state.app.vault.create(notePath, AGENT_NOTE);
      return {};
    },
    messages: async (id) => (id === "import-1" ? agentMessage("done") : []),
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  const started = modal.startBatch();
  await started;
  await waitFor(() => dom.texts().join("\n").includes("Importing 2 of 2"), "the second file to start");
  assert.equal(state.files.has(notePath), true, "the first file's note is committed before Undo");

  await dom.click("Undo everything");
  await waitFor(() => completionModal(modal), "the undo summary");
  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /Import undone/);
  assert.match(summary, /No imported notes were kept/);
  assert.match(summary, /Removed by Undo/);
  assert.equal(state.files.has(notePath), false, "Undo removes notes made by earlier files");
  assert.ok(![...state.files.keys()].some((path) => path.startsWith("Questions/Unit A/")), "the finished folder is removed too");
  assert.equal(state.dirs.has("Questions/Unit A"), false);
});

test("batch import: Discard this file keeps earlier files and removes only the current one", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  const notePath = "Questions/Unit A/Unit A-Q01.md";
  let sessions = 0;
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "import-" + ++sessions }),
    promptAsync: async (id) => {
      if (id === "import-1") await state.app.vault.create(notePath, AGENT_NOTE);
      return {};
    },
    messages: async (id) => (id === "import-1" ? agentMessage("done") : []),
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  const started = modal.startBatch();
  await started;
  await waitFor(() => dom.texts().join("\n").includes("Importing 2 of 2"), "the second file to start");
  assert.equal(state.files.has(notePath), true, "the first file's note is committed before Discard");

  await dom.click("Discard this file");
  await waitFor(() => completionModal(modal), "the discard summary");
  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /Import stopped/);
  assert.match(summary, /1 question note imported/);
  assert.match(summary, /Stopped/);
  assert.equal(state.files.has(notePath), true, "Discard keeps the PDF that already finished");
  assert.ok([...state.files.keys()].some((path) => path.startsWith("Questions/Unit A/")), "the finished folder stays");
  assert.ok(![...state.files.keys()].some((path) => path.startsWith("Questions/Unit B/")), "only the current folder is removed");
});

test("batch import: Finish this file, then stop saves the current file and leaves the queue", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  const notePath = "Questions/Unit A/Unit A-Q01.md";
  let sessions = 0;
  let calls = 0;
  let release = false;
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "import-" + ++sessions }),
    promptAsync: async () => {
      calls++;
      await state.app.vault.create(notePath, AGENT_NOTE);
      while (!release) await sleep(5);
      return {};
    },
    messages: async () => (release ? agentMessage("done") : []),
    abort: async () => ({}),
  });

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes), file("Unit B.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  modal.agentPollMs = 5;
  modal.agentSettleMs = 20;
  const started = modal.startBatch();
  await waitFor(() => dom.texts().includes("Finish this file, then stop"), "the stop choices");
  await dom.click("Finish this file, then stop");
  release = true;
  await started;
  await waitFor(() => completionModal(modal), "the finish-current summary");

  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.equal(calls, 1, "the next PDF is never sent to the agent");
  assert.equal(modal.batchResults.length, 1);
  assert.match(summary, /The current file finished/);
  assert.match(summary, /1 question note imported/);
  assert.ok(summary.includes("Practice these questions"));
});

test("agent import: a key only in the Answer section is still verified", async () => {
  const state = await setup();
  state.plugin.settings.ai.backend = "opencode";
  state.plugin.settings.ai.managed = false;
  state.plugin.ensureOpenCode = async () => {};
  const notePath = "Questions/Unit A/Unit A-Q01.md";
  // What opencode/big-pickle actually wrote for the AP World PDFs: no answer
  // property, the key only in the reveal callout.
  const sectionOnly = `---\nnumber: 1\n---\n\n## Question\nWhat is 2 + 2?\n\n## Answer Choices\n- A. 3\n- B. 4\n- C. 5\n- D. 6\n\n## Answer\n> [!answer]- Reveal answer\n> **Correct Answer: B**\n>\n> Four.\n`;
  state.plugin.openCode = () => ({
    providers: async () => ({ providers: [{}] }),
    createSession: async () => ({ id: "import-check" }),
    promptAsync: async () => {
      await state.app.vault.create(notePath, sectionOnly);
      return {};
    },
    messages: async () => agentMessage("done"),
    abort: async () => ({}),
  });
  const checked = [];
  state.plugin.verifyDraftQuestions = async (items) => {
    checked.push(items[0].answer);
    items[0].verification = { status: "match", match: true, answer: "B", key: items[0].answer, model: "test", date: "2026-11-13" };
  };

  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes)] });
  attach(modal);
  modal.onOpen();
  await modal.start();

  assert.deepEqual(checked, ["B"], "the blind check runs against the section key instead of being skipped");
  const saved = state.files.get(notePath).text;
  assert.match(saved, /^answer: B$/m, "the key becomes the answer property");
  assert.match(saved, /verification: match/, "the check result is written to the note");
  assert.match(saved, /verified: true/, "the note is no longer left unverified");
});
