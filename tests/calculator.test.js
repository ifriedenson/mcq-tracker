"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const calculator = T.calculator;

test("calculator: arithmetic, functions and constants stay local", () => {
  assert.equal(calculator.evaluateCalculator("2 + 3 * 4").text, "14");
  assert.equal(calculator.evaluateCalculator("sqrt(81) / 3").text, "3");
  assert.equal(calculator.evaluateCalculator("sin(pi / 2)").text, "1");
  assert.equal(calculator.evaluateCalculator("2 ^ 10").text, "1024");
  assert.equal(calculator.evaluateCalculator("1 / 0").ok, false);
  assert.equal(calculator.evaluateCalculator("").ok, false);
  assert.match(calculator.evaluateCalculator("2 +").error, /incomplete|Expected/i);
});

test("calculator: keypad tokens edit the expression without guessing", () => {
  assert.equal(calculator.appendCalculatorToken("", "*"), "");
  assert.equal(calculator.appendCalculatorToken("2", "*"), "2*");
  assert.equal(calculator.appendCalculatorToken("2+3", "⌫"), "2+");
  assert.equal(calculator.appendCalculatorToken("2+3", "C"), "");
  assert.equal(calculator.appendCalculatorToken("2", "+/-"), "-2");
  assert.equal(calculator.normalizeCalculatorMode("SCIENTIFIC"), "scientific");
  assert.equal(calculator.normalizeCalculatorMode("nope"), "basic");
});

test("calculator: the Reference tab offers basic and scientific keys", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "calculator";
  view.render();
  assert.ok(dom.texts().includes("Calculator"));
  assert.ok(dom.texts().includes("Basic"));
  assert.ok(dom.texts().includes("Scientific"));
  assert.ok(dom.texts().includes("7"));

  const scientific = makeDom();
  view.calculatorMode = "scientific";
  view.contentEl = scientific.root;
  view.render();
  assert.ok(scientific.texts().includes("sqrt("));
});

test("calculator: the panel is hidden during a timed test unless the user allows it", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  plugin.settings.testSession = { v: 1, items: [{ path: "Q/a.md" }], deadline: Date.now() + 60000 };
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const hidden = makeDom();
  view.contentEl = hidden.root;
  view.tab = "calculator";
  view.render();
  assert.ok(hidden.texts().some((text) => /calculator is hidden/i.test(text)));

  const shown = makeDom();
  plugin.settings.reference.hideCalculatorDuringTests = false;
  view.contentEl = shown.root;
  view.render();
  assert.ok(shown.texts().includes("7"));
});
