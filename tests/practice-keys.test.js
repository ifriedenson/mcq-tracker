"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const { practiceKeyboardAction } = T.practiceKeys;

const key = (value, extra) => Object.assign({ key: value, target: {} }, extra || {});

test("practice keys: Space and Enter submit an armed question but never invent a grade", () => {
  assert.equal(practiceKeyboardAction(key(" "), { state: "question", submitReady: true }), "submit");
  assert.equal(practiceKeyboardAction(key("Enter"), { state: "question", submitReady: true }), "submit");
  assert.equal(practiceKeyboardAction(key(" "), { state: "question", submitReady: false }), "");
  assert.equal(practiceKeyboardAction(key("1"), { state: "question", submitReady: true }), "");
  assert.equal(practiceKeyboardAction(key("u"), { state: "question", submitReady: true }), "");
});

test("practice keys: study cards reveal first and only advance after recording", () => {
  assert.equal(practiceKeyboardAction(key(" "), { state: "study", revealed: false }), "reveal");
  assert.equal(practiceKeyboardAction(key("Enter"), { state: "study", revealed: true, recorded: false }), "");
  assert.equal(practiceKeyboardAction(key("Enter"), { state: "study", revealed: true, recorded: true }), "next-study");
});

test("practice keys: Esc ends and the map leaves inputs, controls and modifiers alone", () => {
  assert.equal(practiceKeyboardAction(key("Escape"), { state: "question" }), "end");
  assert.equal(practiceKeyboardAction(key(" "), { state: "question", submitReady: true, active: false }), "");
  assert.equal(practiceKeyboardAction(key(" ", { target: { tagName: "INPUT" } }), { state: "question", submitReady: true }), "");
  assert.equal(practiceKeyboardAction(key(" ", { target: { tagName: "TEXTAREA" } }), { state: "question", submitReady: true }), "");
  assert.equal(practiceKeyboardAction(key("Enter", { target: { tagName: "BUTTON" } }), { state: "question", submitReady: true }), "");
  assert.equal(practiceKeyboardAction(key(" ", { ctrlKey: true }), { state: "question", submitReady: true }), "");
  assert.equal(practiceKeyboardAction(key("Enter", { repeat: true }), { state: "result" }), "");
});

test("practice keys: the result advances and unrelated screens do nothing", () => {
  assert.equal(practiceKeyboardAction(key(" "), { state: "result" }), "next");
  assert.equal(practiceKeyboardAction(key(" "), { state: "idle" }), "");
  assert.equal(practiceKeyboardAction(key(" "), { state: "study-summary" }), "");
});

test("practice keys: the Practice view handles the active question and Esc returns to filters", async () => {
  const app = makeApp([{ path: "Questions/one.md", fm: { answer: "B", choices: 4 } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  await view.loadQuestion({ file: app.files[0], fm: app.files[0].fm }, true);
  view.render();

  view.sel = "B";
  view.conf = 2;
  view.render();
  assert.equal(view.keyboardSubmit.ready(), true, "the submit button is armed");
  let prevented = 0;
  const event = key(" ", { preventDefault: () => prevented++ });
  assert.equal(view.handlePracticeKey(event), "submit");
  assert.equal(prevented, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.state, "result");

  assert.equal(view.handlePracticeKey(key("Escape")), "end");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view.state, "idle", "Esc returns to the filter screen");
});
