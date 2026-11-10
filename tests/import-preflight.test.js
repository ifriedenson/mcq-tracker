"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { checkDocumentText } = require("../src/import-preflight");

// pdf.js reads this at module load, so install the page provider before loading the bundle.
let pages = [];
obsidian.loadPdfJs = async () => ({
  getDocument() {
    return {
      promise: Promise.resolve({
        numPages: pages.length,
        async getPage(n) {
          return {
            async getTextContent() {
              return { items: pages[n - 1] || [] };
            },
            getViewport() {
              return { width: 612, height: 792, scale: 1, transform: [1, 0, 0, 1, 0, 0] };
            },
          };
        },
        async destroy() {},
      }),
    };
  },
});

const { T } = load();
global.createEl = (tag, opts) => makeDom().root.createEl(tag, opts);

function line(text, index) {
  return {
    str: text,
    hasEOL: true,
    transform: [1, 0, 0, 1, 10, 740 - index * 20],
    width: text.length * 6,
    height: 12,
  };
}

const READABLE = [
  line("Question 1", 0),
  line("What is 2 + 2?", 1),
  line("A. 3", 2),
  line("B. 4", 3),
  line("Question 2", 4),
  line("Which gas do plants take in?", 5),
  line("A. Oxygen", 6),
  line("B. Carbon dioxide", 7),
];

function makePlugin(app) {
  const plugin = {
    app,
    settings: {
      ai: { enabled: false, backend: "api", api: { provider: "anthropic", keys: {}, model: "" } },
      importDefaults: {},
      importOptions: { capture: false, pagePics: false },
      importFolder: "",
      questionFolder: "Questions",
    },
    backend: () => "api",
    save: async () => {},
    refreshEmptyViews() {},
    getQuestions: () => [],
    verifyDraftQuestions: async () => {},
    openAiImportHelp(state, options) {
      plugin.help = { state, options };
    },
    openPdfImport(options) {
      plugin.opened = options;
    },
    openQuickAdd() {
      plugin.quickAdd = (plugin.quickAdd || 0) + 1;
    },
  };
  return plugin;
}

function makeModal(items, aiReady) {
  const app = makeApp([]);
  const plugin = makePlugin(app);
  if (aiReady) {
    plugin.settings.ai.enabled = true;
    plugin.settings.ai.api.keys.anthropic = "sk-test";
    plugin.settings.ai.api.model = "claude-sonnet-4-5";
  }
  pages = [items];
  const modal = new T.PdfImportModal(app, plugin, {});
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.file = {
    name: "Unit 1.pdf",
    async arrayBuffer() {
      return Buffer.from("%PDF-1.4 test");
    },
  };
  modal.folder = "Questions/Unit 1";
  return { app, plugin, modal, dom };
}

test("preflight: readable text reports pages and question starts", () => {
  const check = checkDocumentText([{ n: 1, text: READABLE.map((item) => item.str).join("\n") }], { kind: "pdf" });
  assert.equal(check.ok, true);
  assert.equal(check.pages, 1);
  assert.equal(check.likelyQuestions, 2);
});

test("preflight: a scanned PDF is rejected with the OCR message", () => {
  const check = checkDocumentText([{ n: 1, text: "" }], { kind: "pdf" });
  assert.equal(check.ok, false);
  assert.match(check.message, /scanned images/);
  assert.match(check.message, /text recognition \(OCR\)/);
});

test("preflight: a readable file opens AI setup only after its local check, and writes nothing", async () => {
  const { app, plugin, modal, dom } = makeModal(READABLE, false);
  modal.showPreflight();
  await dom.click("Check this file");

  assert.ok(dom.texts().includes("This file is readable"));
  assert.ok(dom.texts().some((text) => /2 question starts spotted/.test(text)));
  assert.equal(plugin.help, undefined, "AI setup is not opened before the check");
  assert.equal(app.created, undefined);
  assert.equal(app.createdBinary, undefined);
  assert.equal(app.folders, undefined);

  await dom.click("Continue to AI setup");
  assert.equal(plugin.help.state, "off");
  assert.equal(plugin.help.options.preflight.pages, 1);
  assert.equal(plugin.help.options.preflight.likelyQuestions, 2);
  assert.equal(app.createdBinary, undefined, "opening AI setup writes nothing");

  plugin.help.options.onReady();
  assert.ok(plugin.opened, "the importer reopens after AI setup");
  assert.equal(plugin.opened.file, modal.file);
  assert.equal(plugin.opened.preflight.likelyQuestions, 2);
});

test("preflight: a scanned file shows the reason and leaves the vault empty", async () => {
  const { app, plugin, modal, dom } = makeModal([], false);
  modal.showPreflight();
  await dom.click("Check this file");

  const text = dom.texts().join("\n");
  assert.match(text, /This file can't be read/);
  assert.match(text, /scanned images/);
  assert.match(text, /Nothing was added to your vault/);
  assert.equal(plugin.help, undefined, "AI setup stays closed");
  assert.equal(app.created, undefined);
  assert.equal(app.createdBinary, undefined);
  assert.equal(app.folders, undefined);
});

test("start: an unreadable PDF is checked before any folder or copied file is created", async () => {
  const { app, plugin, modal, dom } = makeModal([], true);
  await modal.start();

  assert.match(dom.texts().join("\n"), /scanned images/);
  assert.equal(app.folders, undefined, "no folder is created");
  assert.equal(app.createdBinary, undefined, "no source copy is written");
  assert.equal(app.created, undefined, "no note is written");
  assert.equal(plugin.help, undefined, "the AI setup is not reopened when AI is already ready");
});
