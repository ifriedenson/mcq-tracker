"use strict";
/**
 * Obsidian logs "Plugin mcq-tracker is not passing Component in renderMarkdown"
 * when a render call has no Component. Every call site in this plugin passes
 * one; this test fails if a new call forgets it.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");

function callArguments(source, start) {
  let depth = 1;
  let i = start;
  while (i < source.length && depth) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

function splitTopLevel(args) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of args) {
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out.map((part) => part.trim());
}

test("every renderMarkdownInto call passes a component", () => {
  const misses = [];
  for (const name of fs.readdirSync(SRC).filter((file) => file.endsWith(".js"))) {
    const source = fs.readFileSync(path.join(SRC, name), "utf8");
    const pattern = /renderMarkdownInto\(/g;
    let match;
    while ((match = pattern.exec(source))) {
      const args = splitTopLevel(callArguments(source, match.index + match[0].length));
      const line = source.slice(0, match.index).split("\n").length;
      if (args.length < 5 || !args[4] || /^(undefined|null)$/.test(args[4])) {
        misses.push(`${name}:${line} (${args.length} argument${args.length === 1 ? "" : "s"})`);
      }
    }
  }
  assert.deepEqual(misses, [], `renderMarkdownInto without a Component: ${misses.join(", ")}`);
});

test("the shared helper hands a real Component to Obsidian, not a Modal", () => {
  const { load } = require("./helpers/load");
  const { T, obsidian } = load();
  const el = { createDiv() {}, setText() {} };
  // Obsidian's Modal is not a Component; a dialog that passes itself triggers
  // "not passing Component in renderMarkdown", which also leaks handlers.
  const dialog = { app: {}, mdComponent: new obsidian.Component() };
  dialog.mdComponent.load();
  T.renderMarkdownInto({ workspace: {} }, "# Hi", el, "a.md", dialog);
  assert.ok(obsidian.lastMarkdownComponent instanceof obsidian.Component, "the dialog's markdown Component is used");
  assert.notEqual(obsidian.lastMarkdownComponent, dialog, "the Modal itself is never passed");

  const view = new obsidian.Component();
  T.renderMarkdownInto({ workspace: {} }, "# Hi", el, "a.md", view);
  assert.equal(obsidian.lastMarkdownComponent, view, "a view is already a Component and is passed through");
});

test("a dialog loads its markdown Component on open and unloads it on close", async () => {
  const { load } = require("./helpers/load");
  const { makeApp, makeDom } = require("./helpers/fake");
  const { T, Plugin: QT } = load();
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const modal = new T.NoteReviewModal(plugin.app, plugin);
  const dom = makeDom();
  modal.containerEl = dom.root;
  modal.modalEl = dom.root;
  modal.contentEl = makeDom().root;
  modal.open();
  const component = modal.mdComponent;
  assert.ok(component, "the dialog owns a markdown Component");
  assert.equal(component.loaded, true, "it is loaded while the dialog is open");
  modal.close();
  assert.equal(component.unloaded, true, "it is unloaded when the dialog closes");
});
