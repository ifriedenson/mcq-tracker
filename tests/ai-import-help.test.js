"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

function openHelp(plugin, state) {
  const dom = makeDom();
  const modal = new T.AiImportHelpModal(plugin.app, plugin, state);
  modal.containerEl = dom.root;
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.titleEl = dom.root;
  modal.open();
  return { dom, modal };
}

async function withRequests(handler, fn) {
  obsidian.requestImpl = handler;
  try {
    return await fn();
  } finally {
    obsidian.requestImpl = null;
  }
}

test("ai import help: the import entry point opens the file-first importer when AI is off", async () => {
  const { plugin } = await setup();
  plugin.settings.ai.enabled = false;
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;

  plugin.openPdfImport();

  assert.equal(obsidian.modals.length, 1, "one import surface opens");
  assert.ok(obsidian.modals[0] instanceof T.PdfImportModal, "the importer opens before AI setup");
  assert.equal(obsidian.modals[0] instanceof T.AiImportHelpModal, false, "the explanation waits for a readable file");
  assert.equal(obsidian.notices.some((n) => /Turn on AI features/.test(n)), false, "no terse dead-end notice");
});

test("ai import help: the explanation keeps the AI split, the data caveat and the beginner controls", async () => {
  const { plugin } = await setup();
  const { dom } = openHelp(plugin, "off");
  const text = dom.texts().join("\n");

  for (const needle of [
    "Turning a PDF, PowerPoint or Word file into question notes is the one everyday step that needs AI.",
    "Practice, timed tests, review and Today, cards, the calendar, assignments, and the reference and AP tools all work without it.",
    "Direct AI uses your own provider key.",
    "The file's text is sent to that provider",
    "OpenCode is the recommended desktop setup",
    "There is no offline PDF-to-question converter.",
    "import ready-made flashcards (Quizlet, Kahoot, Moodle, QTI, GIFT, CSV or Markdown)",
  ]) assert.ok(text.includes(needle), `the explanation says: ${needle}`);

  assert.ok(dom.find("Install OpenCode").length, "OpenCode is the first route");
  await dom.click("Direct API key");
  assert.equal(dom.field("AI provider").value, "anthropic", "the recommended provider is preselected");
  assert.ok(dom.find("Create a key ↗").length, "the key page is one click");
  assert.ok(dom.find("Fetch models").length, "the shared fetch control is here");
  assert.ok(dom.find("Test connection").length, "the shared test control is here");
  assert.ok(dom.find("Paste questions instead (works offline)").length, "the offline route is the obvious alternative");
  assert.equal(dom.find("Write a question note instead").length, 0, "the confusing manual wording is gone");
});

test("ai import help: the full wizard enables AI and opens the importer", async () => {
  const { plugin } = await setup();
  let imports = 0;
  plugin.openPdfImport = () => {
    imports++;
  };
  const { dom, modal } = openHelp(plugin, "off");

  await withRequests(
    async (request) => {
      if (request.method === "GET") {
        return { status: 200, json: { data: [{ id: "claude-sonnet-4-5" }, { id: "claude-haiku-4-5" }] } };
      }
      return { status: 200, json: { content: [{ type: "text", text: "OK" }] } };
    },
    async () => {
      await dom.click("Direct API key");
      dom.type(dom.field("API key"), "sk-ant-test");
      await dom.clickLast("Fetch models");
      assert.equal(plugin.settings.ai.api.model, "claude-sonnet-4-5");
      await dom.clickLast("Test connection");
      await dom.clickLast("Continue to import");
    }
  );

  assert.equal(plugin.settings.ai.enabled, true);
  assert.equal(plugin.settings.ai.backend, "api");
  assert.equal(imports, 1, "the importer opens after a real test");
  assert.equal(modal.closed, true);
});

test("ai import help: OpenCode is the default and installs in place", async () => {
  const { plugin } = await setup();
  const { dom } = openHelp(plugin, "off");
  assert.ok(dom.find("Install OpenCode").length, "the installer is on the first screen");
  assert.ok(dom.find("Direct API key").length, "the key route is one click away");
  assert.equal(dom.find("Open OpenCode settings").length, 0, "there is no settings detour");
});

test("ai import help: the offline route closes the help and opens Quick add", async () => {
  const { plugin } = await setup();
  let quickAdd = 0;
  plugin.openQuickAdd = () => {
    quickAdd++;
  };
  const { dom, modal } = openHelp(plugin, "off");

  await dom.clickLast("Paste questions instead (works offline)");

  assert.equal(quickAdd, 1, "the offline paste path opens");
  assert.equal(modal.closed, true);
});

test("ai import help: a Direct AI import without a key still offers the wizard", async () => {
  const { plugin } = await setup();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api = { provider: "openai", keys: {} };

  assert.equal(T.importAiState(plugin), "no-key");
  const { dom } = openHelp(plugin);
  assert.equal(dom.field("AI provider").value, "openai");
  assert.ok(dom.find("Create a key ↗").length, "the OpenAI key page is offered");
  assert.ok(dom.find("Fetch models").length);
  assert.equal(dom.find("Add a provider key in settings").length, 0, "the old settings detour is gone");
});

test("ai import help: a configured import still opens the importer", async () => {
  const { plugin } = await setup();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api = { provider: "openai", keys: { openai: "sk-test" } };
  assert.equal(T.importAiState(plugin), "ready");
  obsidian.modals.length = 0;

  plugin.openPdfImport();

  assert.ok(obsidian.modals.at(-1) instanceof T.PdfImportModal, "a working setup is not blocked");
});
