"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditImportHealth, cleanSourcePath, healthSummary } = require("../src/import-health");

const note = (path, source) => ({ file: { path }, fm: source ? { source_pdf: source } : {} });

test("health: cleanSourcePath strips wiki brackets, aliases and slashes", () => {
  assert.equal(cleanSourcePath("[[Questions/Unit 1/source.pdf|the PDF]]"), "Questions/Unit 1/source.pdf");
  assert.equal(cleanSourcePath("/Questions/a.pdf/"), "Questions/a.pdf");
  assert.equal(cleanSourcePath(""), "");
});

test("health: a present source is healthy and a missing one is grouped", () => {
  const report = auditImportHealth(
    [note("Questions/Unit 1/Q01.md", "Questions/Unit 1/source.pdf"), note("Questions/Unit 1/Q02.md", "[[Questions/Unit 1/source.pdf]]"), note("Questions/Unit 2/Q01.md", "Questions/Unit 2/gone.pdf")],
    (path) => path === "Questions/Unit 1/source.pdf"
  );
  assert.equal(report.healthy, 2);
  assert.equal(report.missing.length, 1);
  assert.equal(report.missing[0].source, "Questions/Unit 2/gone.pdf");
  assert.equal(report.missing[0].count, 1);
  assert.match(healthSummary(report), /1 source file is missing, linked from 1 note/);
});

test("health: notes with no stamp are counted separately, never as missing", () => {
  const report = auditImportHealth([note("Questions/a.md", ""), note("Questions/b.md", "")], () => false);
  assert.deepEqual(report.missing, []);
  assert.equal(report.unstamped, 2);
  assert.match(healthSummary(report), /no source file stamped/);
});

test("health: a fully healthy vault says so", () => {
  const report = auditImportHealth([note("Questions/a.md", "p.pdf")], () => true);
  assert.equal(healthSummary(report), "Every linked source file is present.");
});
