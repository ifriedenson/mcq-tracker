"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_FRONT, triageCounts, triageIssues } = require("../src/card-triage");

const card = (path, front, back, extra) => ({
  path,
  file: { path: `Cards/${path}.md`, basename: path },
  fm: { card_title: path, deck: "Bio", ...(extra || {}) },
  body: { front, back },
});

test("triage: a clean deck has no findings", () => {
  const rows = triageIssues([card("a", "What is a cell?", "The basic unit of life.")]);
  assert.deepEqual(rows, []);
});

test("triage: two identical fronts are both flagged as duplicates", () => {
  const rows = triageIssues([card("a", "Powerhouse of the cell", "mitochondria"), card("b", "powerhouse of  the CELL!", "mitochondria")]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.reasons.some((reason) => reason.code === "duplicate")));
});

test("triage: a long front, an echoed answer and a single cloze are flagged", () => {
  const rows = triageIssues([
    card("long", "x".repeat(MAX_FRONT + 1), "short"),
    card("echo", "The mitochondria is the powerhouse of the cell", "mitochondria"),
    card("cloze", "The {{c1::nucleus}} stores DNA", "", { card_type: "cloze" }),
  ]);
  const byPath = Object.fromEntries(rows.map((row) => [row.path, row.reasons.map((reason) => reason.code)]));
  assert.deepEqual(byPath["Cards/long.md"], ["too-long"]);
  assert.ok(byPath["Cards/echo.md"].includes("answer-in-question"));
  assert.ok(byPath["Cards/cloze.md"].includes("single-cloze"));
});

test("triage: two or more clozes pass, and counts add up", () => {
  const rows = triageIssues([card("cloze2", "{{c1::A}} and {{c2::B}}", "", { card_type: "cloze" })]);
  assert.deepEqual(rows, []);
  const counts = triageCounts([
    { reasons: [{ code: "duplicate" }, { code: "duplicate" }] },
    { reasons: [{ code: "too-long" }] },
  ]);
  assert.equal(counts.duplicate, 2);
  assert.equal(counts["too-long"], 1);
  assert.equal(counts["single-cloze"], 0);
});

test("triage: an empty back never counts as an echoed answer", () => {
  const rows = triageIssues([card("blankback", "What is osmosis?", "")]);
  assert.deepEqual(rows, []);
});
