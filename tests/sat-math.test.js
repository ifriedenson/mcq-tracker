"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.satMath;

test("sat math: solves one-variable linear equations with steps", () => {
  const simple = S.solveLinear("2x + 3 = 11");
  assert.equal(simple.valid, true);
  assert.equal(simple.answer, "x = 4");
  assert.ok(simple.steps.some((step) => /2x = 8/.test(step)));
  assert.equal(S.solveLinear("3x - 5 = x + 7").answer, "x = 6");
  assert.equal(S.solveLinear("2x + 1 = 2x + 3").answer, "No solution.");
  assert.equal(S.solveLinear("2(x + 1) = 4").valid, false);
});

test("sat math: solves quadratics, systems, percentages and ratios", () => {
  const quadratic = S.solveQuadratic("x^2 - 5x + 6 = 0");
  assert.equal(quadratic.answer, "x = 2 or x = 3");
  assert.ok(quadratic.steps.some((step) => /Discriminant/.test(step)));
  assert.equal(S.solveQuadratic("x^2 + 1 = 0").answer, "No real solutions.");
  const system = S.solveSystem("2x + y = 7; x - y = 2");
  assert.equal(system.answer, "x = 3, y = 1");
  assert.equal(S.solvePercent("15% of 80").answer, "12");
  assert.equal(S.solveRatio("3:4 = 9:x").answer, "x = 12");
});

test("sat math: parses a block and explains malformed commands", () => {
  const parsed = S.parseSatMath("Solve: 2x + 3 = 11\nQuadratic: x^2 - 5x + 6 = 0\nPercent: 15% of 80");
  assert.equal(parsed.problems.length, 3);
  assert.deepEqual(parsed.problems.map((problem) => problem.kind), ["Linear equation", "Quadratic equation", "Percent"]);
  const bad = S.parseSatMath("Solve: 2(x + 1) = 4");
  assert.equal(bad.problems[0].valid, false);
  assert.match(bad.issues.join(" "), /powers or division/);
  assert.match(S.parseSatMath("just text").issues.join(" "), /Start each problem/);
});

test("sat math: the block gates on its module switch and renders the working", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  assert.equal(plugin.satMathEnabled(), true);
  plugin.settings.satMath.enabled = false;
  assert.equal(plugin.satMathEnabled(), false);
  const dom = makeDom();
  plugin.renderSatMathBlock("Solve: 2x + 3 = 11", dom.root, {});
  assert.ok(dom.texts().some((text) => /SAT Math is off/.test(text)));
  plugin.settings.satMath.enabled = true;
  const rendered = makeDom();
  plugin.renderSatMathBlock("Solve: 2x + 3 = 11", rendered.root, {});
  assert.ok(rendered.texts().includes("SAT Math · step by step"));
  assert.ok(rendered.texts().includes("x = 4"));
  assert.ok(rendered.texts().some((text) => /2x = 8/.test(text)));
});
