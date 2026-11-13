"use strict";
/*
 * Non-network failures that used to reach the user as a raw runtime string or as
 * nothing at all. Each case simulates the throw and reads the real Notice text.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();

async function loadedPlugin() {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  return plugin;
}

test("service export: a failed import names the import and the detail, not just the throw", async () => {
  // Regression: the notice was the bare e.message ("Unexpected token < in JSON at position 0").
  const plugin = await loadedPlugin();
  plugin.importServiceExport = async () => {
    throw new SyntaxError("Unexpected token < in JSON at position 0");
  };
  plugin.app.workspace.getActiveFile = () => ({ path: "Imports/takeout.json" });

  obsidian.notices.length = 0;
  const result = await plugin.importActiveServiceExport();
  assert.equal(result, null);
  assert.equal(obsidian.notices.length, 1);
  assert.match(obsidian.notices[0], /^Could not import that export: Unexpected token < in JSON at position 0\./);
  assert.match(obsidian.notices[0], /Check the open file is the export you meant, then try again\./);
});

test("service export: a failed clipboard import names the paste and what to check", async () => {
  const plugin = await loadedPlugin();
  plugin.importServiceExport = async () => {
    throw new Error("That export did not contain any notes.");
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { clipboard: { readText: async () => "{}" } }, configurable: true });
  try {
    obsidian.notices.length = 0;
    const result = await plugin.importServiceClipboard();
    assert.equal(result, null);
    assert.match(obsidian.notices[0], /^Could not import the pasted export: That export did not contain any notes\./);
    assert.match(obsidian.notices[0], /Check the text is a complete export, then try again\./);
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else delete globalThis.navigator;
  }
});

test("timed test: a saved session that cannot be restored says so instead of silently resetting", async () => {
  // Regression: the catch only wrote to the console and the user saw an empty setup screen.
  const plugin = await loadedPlugin();
  const dom = makeDom();
  const view = new T.TestView({ app: plugin.app }, plugin);
  view.contentEl = dom.root;
  view.restore = async () => {
    throw new Error("Unexpected end of JSON input");
  };
  obsidian.notices.length = 0;
  await view.onOpen();
  assert.equal(view.phase, "setup", "the view still opens on the setup screen");
  assert.equal(obsidian.notices.length, 1);
  assert.match(obsidian.notices[0], /^Could not restore your saved timed test: Unexpected end of JSON input\./);
  assert.match(obsidian.notices[0], /start a new test, or check the developer console for details\./);
});

test("errorDetail: a thrown non-error and an empty error both produce readable text", () => {
  assert.equal(T.util.errorDetail(new Error("  disk full  ")), "disk full");
  assert.equal(T.util.errorDetail("plain string"), "plain string");
  assert.equal(T.util.errorDetail(null), "unknown error");
  assert.equal(T.util.errorDetail({}), "unknown error");
  assert.equal(T.util.errorDetail(new Error(""), "the file could not be read"), "the file could not be read");
  assert.equal(T.util.errorDetail(new Error("x".repeat(500))).length, 300);
});
