"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T } = load();

// showSetup() uses Obsidian's global createEl for the hidden file input.
global.createEl = (tag, opts) => makeDom().root.createEl(tag, opts);

function makePlugin(app) {
  return {
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
  };
}

function setup() {
  const app = makeApp([]);
  const plugin = makePlugin(app);
  const modal = new T.PdfImportModal(app, plugin, {});
  const dom = makeDom();
  modal.contentEl = dom.root;
  return { modal, dom };
}

function propertyDetails(dom) {
  return dom.all.find((el) => el.meta && el.meta.tag === "details" && el.classes.has("qt-import-properties"));
}

test("import setup: optional properties are folded away and say AI fills them automatically", () => {
  const { modal, dom } = setup();
  modal.showSetup();
  const details = propertyDetails(dom);
  assert.ok(details, "the property overrides are a disclosure");
  const closedAttrs = details.meta.attrs || details.meta.attr || {};
  assert.equal(closedAttrs.open, undefined, "it starts closed when nothing is overridden");
  assert.ok(dom.texts().includes("Properties added to every note (optional)"));
  assert.ok(dom.texts().includes("AI fills these automatically; open to override"));
  const copy = dom.texts().find((text) => /You do not need to fill these in/.test(text));
  assert.ok(copy, "the disclosure explains the default");
  assert.match(copy, /AI reads each property from the file/);
  assert.match(copy, /To override that, type a value here/);
  assert.match(copy, /used for every note even when the file says something different/);
  assert.match(copy, /Leave a box blank to keep the AI's value/);
});

test("import setup: saved overrides open the property disclosure so they are visible", () => {
  const { modal, dom } = setup();
  modal.meta.test = "SAT";
  modal.showSetup();
  const details = propertyDetails(dom);
  assert.ok(details);
  const openAttrs = details.meta.attrs || details.meta.attr || {};
  assert.equal(openAttrs.open, "", "a saved override keeps the section open");
});
