"use strict";
/*
 * The file-first importer against real PDF bytes: pdf-lib writes the files and
 * the reader parses the bytes again, so the preflight and the question
 * extraction both run through the shipping code in src/pdf.js and
 * src/import-modal.js. Obsidian itself is still a stand-in.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeDom } = require("./helpers/fake");
const { imageOnlyPdf, makePdfRuntime, makeTrackedApp, textPdf } = require("./helpers/real-pdf");

// src/pdf.js captures loadPdfJs when the bundle loads, so install the real-bytes
// reader before the first load().
const runtime = makePdfRuntime();
obsidian.loadPdfJs = async () => runtime;

const { T, Plugin: QT } = load();
global.createEl = (tag, opts) => makeDom().root.createEl(tag, opts);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WRITE_OPS = new Set(["create", "createBinary", "mkdir", "write", "remove", "rmdir", "create-failed", "createBinary-failed"]);

function writes(state) {
  return state.ops.filter((entry) => WRITE_OPS.has(entry[0]));
}

function enableAi(plugin) {
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api.provider = "anthropic";
  plugin.settings.ai.api.keys.anthropic = "sk-test";
  plugin.settings.ai.api.model = "claude-sonnet-4-5";
}

async function setup(notes) {
  const state = makeTrackedApp(notes || []);
  const plugin = new QT(state.app);
  await plugin.onload();
  plugin.settings.importOptions = { capture: false, pagePics: false };
  plugin.settings.importDefaults = {};
  plugin.settings.importFolder = "";
  plugin.settings.questionFolder = "Questions";
  state.plugin = plugin;
  return state;
}

function attach(modal) {
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.modalEl = dom.root;
  return dom;
}

function openImport(plugin, bytes, options) {
  const opts = options || {};
  obsidian.modals.length = 0;
  plugin.openPdfImport();
  const modal = obsidian.modals[0];
  assert.ok(modal instanceof T.PdfImportModal, "the real import modal opens");
  const dom = attach(modal);
  modal.file = {
    name: opts.name || "Unit 1.pdf",
    async arrayBuffer() {
      return bytes;
    },
  };
  modal.folder = opts.folder || "Questions/Unit 1";
  modal.onOpen();
  return { modal, dom };
}

async function waitFor(check, label) {
  const end = Date.now() + 4000;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function noteReply(n, question, choices, answer) {
  return (
    `---\nnumber: ${n}\nanswer: ${answer}\nanswer_source: pdf\n---\n\n` +
    `## Question\n${question}\n\n` +
    `## Answer Choices\n${choices.map((text, i) => `- ${String.fromCharCode(65 + i)}. ${text}`).join("\n")}\n\n` +
    `## Answer\n**Correct Answer: ${answer}**\n`
  );
}

/* ------------------------------------------------------------ entry points */

test("empty Practice: a real text PDF passes the local check and reaches AI setup with zero writes", async () => {
  const state = await setup([]);
  const view = new T.PracticeView({ app: state.app }, state.plugin);
  view.app = state.app;
  const screen = makeDom();
  view.contentEl = screen.root;
  view.render();
  assert.ok(screen.texts().includes("Import files (needs AI)"), "the empty Practice screen offers the importer");

  const bytes = await textPdf();
  obsidian.modals.length = 0;
  await screen.click("Import files (needs AI)");
  assert.equal(obsidian.modals.length, 1, "Practice opens the real file-first importer");
  const modal = obsidian.modals[0];
  assert.ok(modal instanceof T.PdfImportModal);
  const dom = attach(modal);
  modal.file = {
    name: "Unit 1.pdf",
    async arrayBuffer() {
      return bytes;
    },
  };
  modal.folder = "Questions/Unit 1";
  modal.onOpen();
  assert.ok(dom.texts().includes("Import questions from a file"), "the file check comes before AI setup");

  await dom.click("Check this file");
  await waitFor(() => dom.texts().includes("This file is readable"), "the readable result");
  assert.ok(dom.texts().some((text) => /2 question starts spotted/.test(text)), "the real text layer was counted");
  assert.equal(obsidian.modals.filter((m) => m instanceof T.AiImportHelpModal).length, 0, "AI setup waits for Continue");
  assert.deepEqual(writes(state), [], "the check writes nothing");
  assert.equal(state.dirs.size, 0);
  assert.equal(state.files.size, 0);

  await dom.click("Continue to AI setup");
  const help = obsidian.modals[obsidian.modals.length - 1];
  assert.ok(help instanceof T.AiImportHelpModal, "the real AI wizard opens");
  assert.equal(help.state, "off");
  assert.equal(help.options.preflight.likelyQuestions, 2);
  assert.deepEqual(writes(state), [], "opening AI setup still writes nothing");

  help.options.onReady();
  const reopened = obsidian.modals[obsidian.modals.length - 1];
  assert.ok(reopened instanceof T.PdfImportModal, "the importer reopens after AI setup");
  assert.equal(reopened.preflight.likelyQuestions, 2, "the checked result is carried forward");
  assert.equal(reopened.file.name, "Unit 1.pdf");
});

test("command palette: a real image-only PDF shows the scanned message and leaves the vault untouched", async () => {
  const state = await setup([]);
  const bytes = await imageOnlyPdf();
  const command = state.plugin.commands.find((c) => c.id === "import-pdf");
  assert.ok(command, "the import-pdf command exists");

  obsidian.modals.length = 0;
  await command.callback();
  const modal = obsidian.modals[0];
  assert.ok(modal instanceof T.PdfImportModal, "the command opens the same importer");
  const dom = attach(modal);
  modal.file = {
    name: "Scanned handout.pdf",
    async arrayBuffer() {
      return bytes;
    },
  };
  modal.folder = "Questions/Scanned handout";
  modal.onOpen();

  await dom.click("Check this file");
  await waitFor(() => dom.texts().includes("This file can't be read"), "the unreadable result");
  const text = dom.texts().join("\n");
  assert.match(text, /scanned images/);
  assert.match(text, /text recognition \(OCR\)/);
  assert.match(text, /Nothing was added to your vault/);
  assert.ok(text.includes("Paste questions instead (works offline)"), "the offline escape hatch stays visible");
  assert.ok(!text.includes("Continue to AI setup"), "AI setup is never offered");
  assert.equal(obsidian.modals.filter((m) => m instanceof T.AiImportHelpModal).length, 0);
  assert.deepEqual(writes(state), [], "no folder, source copy, note, sidecar or temp file");
  assert.equal(state.files.size, 0);
  assert.equal(state.dirs.size, 0);
});

/* ------------------------------------------- the same bytes become questions */

test("Direct AI: the real extracted text reaches the review list and then a note", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  state.plugin.verifyDraftQuestions = async () => {};
  let asked = "";
  state.plugin.aiChat = async (system, messages) => {
    asked = String(messages[0] && messages[0].content);
    return noteReply(1, "What is 2 + 2?", ["3", "4"], "B");
  };

  const bytes = await textPdf();
  const { modal, dom } = openImport(state.plugin, bytes);
  assert.ok(dom.texts().includes("Import questions from a file"), "AI-ready setup skips the extra gate");
  await modal.start();

  assert.match(asked, /Question 1: What is 2 \+ 2\?/, "the preflight's real extraction is the text sent to the AI");
  assert.match(asked, /Question 2: Which gas do plants take in\?/);
  assert.ok(asked.indexOf("Question 1") < asked.indexOf("Question 2"), "the lines keep their reading order");
  assert.ok(asked.indexOf("A. 3") < asked.indexOf("B. 4"), "choices keep their order");
  assert.ok(dom.texts().includes("Found 1 question"), "the Direct AI review list appears");
  assert.ok(state.files.has("Questions/Unit 1/Unit 1.pdf"), "the source copy exists during review");
  assert.ok(![...state.files.keys()].some((path) => /\.md$/i.test(path)), "review alone writes no note");

  await modal.createNotes();
  const notePath = [...state.files.keys()].find((path) => /Q01\.md$/.test(path));
  assert.ok(notePath, "the reviewed question became a note");
  assert.match(state.files.get(notePath).text, /What is 2 \+ 2\?/);
  assert.ok(state.files.has("Questions/Unit 1/Unit 1.pdf"), "a finished import keeps its source copy");
});

/* ------------------------------------------------- cleanup after the check */

test("Direct AI: a page request that never settles times out and removes the attempt", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  state.plugin.verifyDraftQuestions = async () => {};
  state.plugin.aiChat = () => new Promise(() => {});

  const bytes = await textPdf();
  const { modal, dom } = openImport(state.plugin, bytes);
  modal.apiChunkTimeoutMs = 25;
  await modal.start();

  const text = dom.texts().join("\n");
  assert.match(text, /No questions found/);
  assert.match(text, /The AI took too long to read pages 1-1/);
  assert.equal(state.files.size, 0, "the timed-out attempt removes its source copy");
  assert.equal(state.dirs.size, 0, "the timed-out attempt removes its folder");
});

test("cleanup: a failure copying the source after the text check removes the folder it made", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  const bytes = await textPdf();
  const { modal, dom } = openImport(state.plugin, bytes);
  state.failCreateBinary = (path) => /Unit 1\.pdf$/.test(path);

  await modal.start();
  const text = dom.texts().join("\n");
  assert.match(text, /Couldn't import/);
  assert.match(text, /disk is full/);
  assert.deepEqual(writes(state).filter(([op]) => op === "mkdir").map(([, path]) => path), ["Questions", "Questions/Unit 1"]);
  assert.ok(state.ops.some(([op, path]) => op === "remove" && /Unit 1\.pdf$/.test(path)), "the half-written source is removed");
  assert.ok(state.ops.some(([op]) => op === "rmdir"), "the created folder is removed");
  assert.equal(state.files.size, 0);
  assert.equal(state.dirs.size, 0, "no folder is left behind");
});

test("cleanup: a failure in the picture pass after the text check removes the source and folder", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  state.plugin.settings.importOptions = { capture: true, pagePics: false };
  const bytes = await textPdf();
  const { modal, dom } = openImport(state.plugin, bytes);

  // The precheck opens the first document; the capture pass opens the second and fails.
  runtime.failOn(runtime.opened + 2);
  try {
    await modal.start();
  } finally {
    runtime.failOn(0);
  }
  const text = dom.texts().join("\n");
  assert.match(text, /Couldn't import/);
  assert.match(text, /couldn't open that PDF/);
  assert.ok(state.ops.some(([op]) => op === "createBinary"), "the source copy was written before the failure");
  assert.ok(state.ops.some(([op, path]) => op === "remove" && /Unit 1\.pdf$/.test(path)));
  assert.ok(state.ops.some(([op]) => op === "rmdir"));
  assert.equal(state.files.size, 0);
  assert.equal(state.dirs.size, 0);
});

test("cleanup: closing while the AI is still answering removes the attempt after it finishes", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  state.plugin.verifyDraftQuestions = async () => {};
  let modal = null;
  state.plugin.aiChat = async () => {
    modal.close();
    return noteReply(1, "What is 2 + 2?", ["3", "4"], "B");
  };

  const bytes = await textPdf();
  const opened = openImport(state.plugin, bytes);
  modal = opened.modal;
  await modal.start();
  assert.equal(modal.closed, true);
  assert.ok(state.ops.some(([op, path]) => op === "remove" && /Unit 1\.pdf$/.test(path)), "the source copy is removed after the request settles");
  assert.ok(state.ops.some(([op]) => op === "rmdir"));
  assert.equal(state.files.size, 0);
  assert.equal(state.dirs.size, 0);
});

test("cleanup: closing while notes are being written removes the notes and folder", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  state.plugin.verifyDraftQuestions = async () => {};
  state.plugin.aiChat = async () => noteReply(1, "What is 2 + 2?", ["3", "4"], "B");

  const bytes = await textPdf();
  const { modal, dom } = openImport(state.plugin, bytes);
  await modal.start();
  assert.ok(dom.texts().includes("Found 1 question"));

  const create = state.app.vault.create;
  state.app.vault.create = async (path, text) => {
    const f = await create.call(state.app.vault, path, text);
    modal.close();
    return f;
  };
  await modal.createNotes();
  assert.equal(modal.closed, true);
  assert.ok(![...state.files.keys()].some((path) => /\.md$/i.test(path)), "the note written in flight is removed");
  assert.ok(!state.files.has("Questions/Unit 1/Unit 1.pdf"), "the source copy is removed");
  assert.equal(state.files.size, 0);
  assert.equal(state.dirs.size, 0);
});

test("cleanup: closing the importer during review removes the folder and source copy", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  state.plugin.verifyDraftQuestions = async () => {};
  state.plugin.aiChat = async () => noteReply(1, "What is 2 + 2?", ["3", "4"], "B");

  const bytes = await textPdf();
  const { modal } = openImport(state.plugin, bytes);
  await modal.start();
  assert.ok(state.files.has("Questions/Unit 1/Unit 1.pdf"), "the source copy exists before the abort");

  modal.close();
  assert.ok(modal.cleanupPromise, "closing starts the cleanup");
  await modal.cleanupPromise;
  assert.ok(state.ops.some(([op, path]) => op === "remove" && /Unit 1\.pdf$/.test(path)));
  assert.ok(state.ops.some(([op]) => op === "rmdir"));
  assert.equal(state.files.size, 0);
  assert.equal(state.dirs.size, 0);
});

test("cleanup: a note-creation failure removes the notes already written, the source and the folder", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  state.plugin.verifyDraftQuestions = async () => {};
  state.plugin.aiChat = async () =>
    `${noteReply(1, "What is 2 + 2?", ["3", "4"], "B")}\n=====NOTE=====\n${noteReply(2, "Which gas do plants take in?", ["Oxygen", "Carbon dioxide"], "B")}`;

  const bytes = await textPdf();
  const { modal, dom } = openImport(state.plugin, bytes);
  await modal.start();
  assert.ok(dom.texts().includes("Found 2 questions"));

  state.failCreate = (path) => /Q02\.md$/.test(path);
  await modal.createNotes();
  const text = dom.texts().join("\n");
  assert.match(text, /Some notes may have been created before this stopped/);
  assert.match(text, /disk is full/);

  const madeFirst = state.ops.find(([op, path]) => op === "create" && /Q01\.md$/.test(path));
  assert.ok(madeFirst, "the first note was created before the failure");
  assert.ok(state.ops.some(([op, path]) => op === "remove" && path === madeFirst[1]), "the first note is removed again");
  assert.ok(![...state.files.keys()].some((path) => /\.md$/i.test(path)), "no note survives");
  assert.ok(!state.files.has("Questions/Unit 1/Unit 1.pdf"), "the source copy is removed");
  assert.equal(state.files.size, 0);
  assert.equal(state.dirs.size, 0, "the folder is removed");
});

test("stop: a hanging Direct AI request ends promptly and leaves nothing behind", async () => {
  const state = await setup([]);
  enableAi(state.plugin);
  state.plugin.verifyDraftQuestions = async () => {};
  let finish = null;
  state.plugin.aiChat = () => new Promise((resolve) => {
    finish = resolve;
  });

  const bytes = await textPdf();
  const { modal, dom } = openImport(state.plugin, bytes);
  const run = modal.start();
  await waitFor(() => dom.texts().includes("Discard this file"), "the running import");
  await dom.click("Discard this file");
  await run;
  const complete = obsidian.modals.find((entry) => entry !== modal && entry.render);
  assert.ok(complete, "the stop opens the larger summary");
  const completeDom = attach(complete);
  complete.onOpen();
  assert.match(completeDom.texts().join("\n"), /Import stopped/);
  assert.match(completeDom.texts().join("\n"), /No question notes were imported/);
  assert.ok(!dom.texts().includes("Found 1 question"), "the stopped file never reaches review");
  assert.equal(modal.running, false);
  assert.equal(state.files.size, 0, "the stopped attempt removes its folder and source copy");
  assert.equal(state.dirs.size, 0);

  finish(noteReply(1, "What is 2 + 2?", ["3", "4"], "B"));
  await sleep(0);
  assert.equal(state.files.size, 0, "the late reply writes nothing");
});
