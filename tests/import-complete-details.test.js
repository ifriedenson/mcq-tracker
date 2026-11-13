"use strict";
/*
 * The end-of-batch summary must keep the reason a file failed: a bare
 * "Could not import" (or a bare "Error") tells the user nothing. These tests
 * drive the real PdfImportModal into a failed file and read back the real
 * completion summary, plus the agent watchdog's lost-contact/idle messages.
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

function completionModal(modal) {
  return obsidian.modals.find((entry) => entry !== modal && entry.onOpen && entry.render);
}

async function waitFor(check, label) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error(`timed out waiting for ${label}`);
}

test("completion summary: a failed file keeps its error text instead of a bare state", async () => {
  const state = await setup();
  const bytes = await textPdf();
  state.failCreateBinary = (path) => path.startsWith("Questions/Broken/");
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Good.pdf", bytes), file("Broken.pdf", bytes)] });
  const dom = attach(modal);
  modal.onOpen();
  await modal.startBatch();

  await dom.click("Create 1 note");
  await waitFor(() => completionModal(modal), "the completion summary after the failed copy");

  const complete = completionModal(modal);
  const completeDom = attach(complete);
  complete.onOpen();
  const summary = completeDom.texts().join("\n");
  assert.match(summary, /Could not import/, "the failed file is marked");
  assert.ok(summary.includes("Broken.pdf"), "the failed file is named");
  assert.ok(summary.includes("The disk is full."), "the per-file reason survives into the summary");
});

test("agent wait: repeated status failures fail fast with lost contact", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes)] });
  attach(modal);
  modal.agentPollMs = 2;
  modal.pollAgent = async () => null;
  await assert.rejects(modal.waitForAgent("sid", "Questions/Unit A"), /Lost contact with OpenCode/);
});

test("agent wait: there is no time limit, so a quiet agent runs until it finishes", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes)] });
  attach(modal);
  modal.agentPollMs = 2;
  modal.agentSettleMs = 10000;
  // Silent for far longer than any old cutoff, then finished: the wait must
  // still be running in the middle and return normally at the end.
  let polls = 0;
  modal.pollAgent = async () => {
    polls++;
    return polls < 60
      ? { noteCount: 0, terminal: false, signature: "static", lines: ["write · running · Unit A-Q01.md"] }
      : { noteCount: 3, terminal: true, signature: "done", lines: ["write · completed · Unit A-Q03.md"] };
  };
  await modal.waitForAgent("sid", "Questions/Unit A");
  assert.equal(polls, 60, "the silent agent was polled all the way to its finish");
});

test("agent wait: a 100-page file has no time limit either", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit Big.pdf", bytes)] });
  attach(modal);
  assert.equal(modal.agentMaxMs, undefined, "no total-time cutoff is configured");
});

test("lost contact points at the one-press OpenCode check", async () => {
  const state = await setup();
  const bytes = await textPdf();
  const modal = new T.PdfImportModal(state.app, state.plugin, { files: [file("Unit A.pdf", bytes)] });
  attach(modal);
  modal.agentPollMs = 2;
  modal.pollAgent = async () => null;
  await assert.rejects(
    modal.waitForAgent("sid", "Questions/Unit A"),
    (error) =>
      /Lost contact with OpenCode/.test(error.message) &&
      /Check OpenCode/.test(error.message) &&
      /already imported are kept/.test(error.message)
  );
});
