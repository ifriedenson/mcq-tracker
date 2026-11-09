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

test("ai import help: the import entry point opens the explanation when AI is off", async () => {
  const { plugin } = await setup();
  plugin.settings.ai.enabled = false;
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;

  plugin.openPdfImport();

  assert.equal(obsidian.modals.length, 1, "one help surface opens");
  assert.ok(obsidian.modals[0] instanceof T.AiImportHelpModal, "it is the explanation, not the importer");
  assert.equal(obsidian.notices.some((n) => /Turn on AI features/.test(n)), false, "no terse dead-end notice");
});

test("ai import help: the explanation carries the documentation's AI split and data caveat", async () => {
  const { plugin } = await setup();
  const { dom } = openHelp(plugin, "off");
  const text = dom.texts().join("\n");

  for (const needle of [
    "Turning a PDF, PowerPoint or Word file into question notes is the one everyday step that needs AI.",
    "Writing question notes by hand, practice, timed tests, review and Today, cards, the calendar, assignments, and the reference and AP tools",
    "Direct AI: turn on AI features and add a provider key.",
    "The file's text is sent to that provider",
    "OpenCode agent (desktop)",
    "There is no offline PDF-to-question converter.",
    "import ready-made flashcards (Quizlet, Kahoot, Moodle, QTI, GIFT, CSV or Markdown)",
  ]) assert.ok(text.includes(needle), `the explanation says: ${needle}`);

  assert.ok(dom.find("Enable AI features and open settings").length, "the setup route is actionable");
  assert.ok(dom.find("Write a question note instead").length, "the manual route is actionable");
});

test("ai import help: enabling AI saves the switch and opens settings", async () => {
  const { plugin } = await setup();
  plugin.settings.ai.enabled = false;
  let opened = 0;
  plugin.openSettings = () => { opened++; };
  const { dom, modal } = openHelp(plugin, "off");

  await dom.click("Enable AI features and open settings");

  assert.equal(plugin.settings.ai.enabled, true, "AI features are switched on");
  assert.equal(opened, 1, "settings are opened to add the key or finish setup");
  assert.equal(modal.closed, true, "the help closes once the route is taken");
});

test("ai import help: the manual route opens Quick add", async () => {
  const { plugin } = await setup();
  let quickAdd = 0;
  plugin.openQuickAdd = () => { quickAdd++; };
  const { dom, modal } = openHelp(plugin, "off");

  await dom.click("Write a question note instead");

  assert.equal(quickAdd, 1, "the manual question-note path opens");
  assert.equal(modal.closed, true);
});

test("ai import help: a Direct AI import without a key offers the key route", async () => {
  const { plugin } = await setup();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.api = { provider: "openai", keys: {} };

  assert.equal(T.importAiState(plugin), "no-key");
  const { dom } = openHelp(plugin);
  assert.ok(dom.find("Add a provider key in settings").length, "the key fix is actionable");
  assert.equal(dom.find("Enable AI features and open settings").length, 0, "the off-state button is not shown");
  assert.equal(dom.find("Add a provider key to import a file").length, 1, "the title names the missing key");
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
