"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyStatus,
  checkPlan,
  countRows,
  formatDate,
  readPlan,
  renderStatus,
} = require("../scripts/plan-status");

const PLAN = [
  "# Plan",
  "",
  "**Status: v1.0.0 (Jan 1, 2026).** One plugin.",
  "",
  "**0 unchecked rows, 2 partial/gated rows, no locally implementable row left open.**",
  "",
  "**Verified at this commit:** `node --test` → 10 tests pass, 0 fail;",
  "`npm run check` clean (no dynamic code across 5 source files, vendor guard,",
  "bundle up to date); `main.js` generated from 6 modules at 7,000 bytes.",
  "Re-run both before quoting these numbers.",
  "",
  "**Sweep result (Jan 1, 2026).** `plan.md` has **3 checked `[x]` roadmap rows, 2 `[~]` partial/blocked rows and 0 unchecked `[ ]` rows**. A further 1 checked rows were release-log bullets at the top of the file; they now live in `docs/release-notes/` and `AGENTS.md` rather than being duplicated here.",
  "",
  "- [x] one",
  "- [x] two",
  "- [x] three",
  "- [~] four",
  "- [~] five",
  "",
].join("\n");

const VALUES = {
  version: "2.3.4",
  date: "Nov 6, 2026",
  checked: 3,
  partial: 2,
  unchecked: 0,
  tests: 2218,
  fail: 0,
  srcFiles: 309,
  modules: 312,
  bytes: 6374495,
};

test("countRows counts roadmap rows only", () => {
  assert.deepEqual(countRows(PLAN), { checked: 3, partial: 2, unchecked: 0 });
  assert.deepEqual(countRows("- [ ] prose mention\n- [x] done\n- [~] gated"), {
    checked: 1,
    partial: 1,
    unchecked: 1,
  });
});

test("readPlan reads the recorded status block", () => {
  const parsed = readPlan(PLAN);
  assert.equal(parsed.version, "1.0.0");
  assert.equal(parsed.date, "Jan 1, 2026");
  assert.deepEqual(parsed.statusCounts, { unchecked: 0, partial: 2 });
  assert.deepEqual(parsed.verified, {
    tests: 10,
    fail: 0,
    srcFiles: 5,
    modules: 6,
    bytes: 7000,
  });
  assert.deepEqual(parsed.sweep, { checked: 3, partial: 2, unchecked: 0 });
});

test("readPlan fails closed when an anchor is missing", () => {
  assert.equal(readPlan("# Plan\n\n**Status: v1.0.0 (Jan 1, 2026).**\n"), null);
});

test("renderStatus writes the current numbers in the plan's style", () => {
  const lines = renderStatus(VALUES);
  assert.equal(lines.status, "**Status: v2.3.4 (Nov 6, 2026).**");
  assert.match(lines.counts, /^\*\*0 unchecked rows, 2 partial\/gated rows, no locally implementable row left open\.\*\*$/);
  assert.match(lines.verified, /→ 2,218 tests pass, 0 fail;/);
  assert.match(lines.verified, /across 309 source files/);
  assert.match(lines.verified, /from 312 modules at 6,374,495 bytes/);
  assert.equal(lines.sweepPrefix, "**Sweep result (Nov 6, 2026).**");
  assert.equal(
    lines.sweepNumbers,
    "**3 checked `[x]` roadmap rows, 2 `[~]` partial/blocked rows and 0 unchecked `[ ]` rows**"
  );
});

test("renderStatus omits the all-clear sentence when rows are unchecked", () => {
  const lines = renderStatus({ ...VALUES, unchecked: 1 });
  assert.match(lines.counts, /^\*\*1 unchecked rows, 2 partial\/gated rows\.\*\*$/);
});

test("applyStatus replaces only the status block", () => {
  const { text, missing } = applyStatus(PLAN, renderStatus(VALUES));
  assert.deepEqual(missing, []);
  assert.match(text, /v2\.3\.4/);
  assert.match(text, /2,218 tests pass/);
  assert.match(text, /Sweep result \(Nov 6, 2026\)/);
  assert.match(text, /3 checked `\[x\]` roadmap rows/);
  assert.match(text, /A further 1 checked rows were release-log bullets/);
  assert.match(text, /- \[~\] four/);
  assert.equal((text.match(/\*\*Status:/g) || []).length, 1);
});

test("applyStatus reports each missing anchor instead of guessing", () => {
  const { missing } = applyStatus("# Plan\n", renderStatus(VALUES));
  assert.deepEqual(missing, [
    "Status line",
    "row-count line",
    "Verified paragraph",
    "Sweep result line",
  ]);
});

test("checkPlan passes matching values and reports drift by field", () => {
  const expected = {
    version: "1.0.0",
    checked: 3,
    partial: 2,
    unchecked: 0,
    srcFiles: 5,
    modules: 6,
    bytes: 7000,
    tests: 10,
  };
  assert.equal(checkPlan(PLAN, expected).ok, true);

  const drifted = checkPlan(PLAN, { ...expected, version: "1.0.1", bytes: 7001, tests: 11 });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.problems.length, 3);
});

test("checkPlan ignores the recorded test count when none is supplied", () => {
  const expected = {
    version: "1.0.0",
    checked: 3,
    partial: 2,
    unchecked: 0,
    srcFiles: 5,
    modules: 6,
    bytes: 7000,
  };
  assert.equal(checkPlan(PLAN, expected).ok, true);
});

test("formatDate writes the plan date style", () => {
  assert.equal(formatDate(new Date(2026, 10, 6)), "Nov 6, 2026");
  assert.equal(formatDate(new Date(2026, 0, 1)), "Jan 1, 2026");
});
