"use strict";
// Complex arithmetic and the Calculator tab's complex mode.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

const close = (actual, expected, epsilon) => Math.abs(actual - expected) < (epsilon || 1e-10);

test("complex: arithmetic, division, conjugate and powers", () => {
  const c = T.complex;
  const z = c.make(2, 3);
  assert.deepEqual(c.add(z, c.make(1, -3)), { re: 3, im: 0 });
  assert.deepEqual(c.sub(z, c.make(1, 1)), { re: 1, im: 2 });
  assert.deepEqual(c.mul(z, c.make(1, -1)), { re: 5, im: 1 });
  assert.deepEqual(c.div(c.make(1, 0), c.make(1, 1)), { re: 0.5, im: -0.5 });
  assert.deepEqual(c.conj(z), { re: 2, im: -3 });
  assert.equal(c.abs(c.make(3, 4)), 5);
  assert.ok(close(c.arg(c.make(0, 1)), Math.PI / 2));
  assert.deepEqual(c.pow(c.make(0, 1), c.make(2, 0)), { re: -1, im: 0 });
  assert.ok(close(c.pow(c.make(0, 1), c.make(2, 0)).re, -1));
});

test("complex: square root, exponential, logarithm and formatting", () => {
  const c = T.complex;
  const root = c.sqrt(c.make(-1, 0));
  assert.ok(close(root.re, 0) && close(root.im, 1));
  const exp = c.exp(c.make(0, Math.PI));
  assert.ok(close(exp.re, -1) && close(exp.im, 0));
  const log = c.log(c.make(-1, 0));
  assert.ok(close(log.re, 0) && close(log.im, Math.PI));
  assert.equal(c.format(c.make(3, 2)), "3 + 2i");
  assert.equal(c.format(c.make(3, -2)), "3 - 2i");
  assert.equal(c.format(c.make(0, 1)), "i");
  assert.equal(c.format(c.make(0, -1)), "-i");
  assert.equal(c.format(c.make(0, -2)), "-2i");
  assert.equal(c.format(c.make(3, 0)), "3");
});

test("complex: parser handles implicit multiplication, functions and variables", () => {
  const c = T.complex;
  assert.deepEqual(c.evaluateComplexText("(2+3i)*(1-i)").value, { re: 5, im: 1 });
  assert.deepEqual(c.evaluateComplexText("2i").value, { re: 0, im: 2 });
  assert.deepEqual(c.evaluateComplexText("2(3+i)").value, { re: 6, im: 2 });
  assert.ok(close(c.evaluateComplexText("sqrt(-1)").value.im, 1));
  assert.ok(close(c.evaluateComplexText("1/(1+i)").value.re, 0.5));
  assert.ok(close(c.evaluateComplexText("sin(0)").value.re, 0));
  const fn = c.compileComplex("z^2 + 1", { variables: ["z"] });
  assert.deepEqual(fn({ z: c.make(2, 1) }), { re: 4, im: 4 });
  assert.equal(c.evaluateComplexText("process.exit()").ok, false);
  assert.equal(c.evaluateComplexText("1/0").ok, false);
  assert.equal(c.evaluateComplexText("nope").ok, false);
});

test("reference view: complex calculator mode evaluates and persists", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.complexCalculator = true;
  view.calculatorExpression = "(2+3i)*(1-i)";
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "calculator";
  view.render();
  assert.ok(dom.texts().includes("complex"));
  view.persistCalculatorMode();
  view.calculatorEquals();
  assert.equal(view.calculatorError, "");
  assert.equal(view.calculatorResult, "5 + i");
  assert.equal(plugin.settings.reference.complexCalculator, true);
  view.complexCalculator = false;
  view.calculatorExpression = "2+3";
  view.calculatorEquals();
  assert.equal(view.calculatorResult, "5");
});
