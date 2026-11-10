"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { BUDGET, MUST_STAY_LAZY, evaluate, measure } = require("../scripts/check-startup-budget");

const report = measure();

test("the tree's eager module load fits the startup budget", () => {
  assert.deepEqual(evaluate(report).problems, []);
  assert.ok(report.modules > 0 && report.modules <= report.total);
  assert.ok(report.bytes > 0);
});

test("the PDF editor stack and vendored engines stay lazy", () => {
  for (const id of MUST_STAY_LAZY) {
    assert.ok(!report.eager.includes(id), `${id} must not load with the entry point`);
  }
});

test("an eager load over the byte or module budget fails", () => {
  const overBytes = evaluate({ eager: [], modules: 1, bytes: BUDGET.bytes + 1, total: 2 });
  assert.equal(overBytes.ok, false);
  assert.match(overBytes.problems.join("\n"), /over the .*byte budget/);

  const overModules = evaluate({ eager: [], modules: BUDGET.modules + 1, bytes: 0, total: BUDGET.modules + 2 });
  assert.equal(overModules.ok, false);
  assert.match(overModules.problems.join("\n"), /over the .*module budget/);
});

test("an eager module on the lazy list fails even under budget", () => {
  const result = evaluate({ eager: [MUST_STAY_LAZY[0]], modules: 1, bytes: 0, total: 2 });
  assert.equal(result.ok, false);
  assert.match(result.problems.join("\n"), new RegExp(`${MUST_STAY_LAZY[0]} must stay lazy`));
});

test("a budget-sized eager load without the lazy modules passes", () => {
  const result = evaluate({ eager: ["main"], modules: 1, bytes: BUDGET.bytes, total: 2 });
  assert.deepEqual(result.problems, []);
});
