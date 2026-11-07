"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const vault = path.join(__dirname, "..", "samples", "sample-vault");
const questionsDir = path.join(vault, "Questions");
const questions = fs
  .readdirSync(questionsDir)
  .filter((name) => name.endsWith(".md"))
  .sort();

test("the sample vault keeps five original question notes with the normal schema", () => {
  assert.deepEqual(questions, [
    "math-audit.md",
    "sample-001.md",
    "sample-002.md",
    "sample-003.md",
    "sample-004.md",
  ]);
  for (const name of questions) {
    const text = fs.readFileSync(path.join(questionsDir, name), "utf8");
    assert.match(text, /^---\n[\s\S]*?question_id: SAMPLE-/);
    assert.match(text, /## Question/);
    assert.match(text, /## Answer Choices/);
    assert.match(text, /## Answer/);
  }
});

test("the math audit note exercises fractions, a matrix, integrals and the chemistry fallback", () => {
  const text = fs.readFileSync(path.join(questionsDir, "math-audit.md"), "utf8");
  assert.match(text, /\\frac\{3\}\{4\}/);
  assert.match(text, /\\begin\{bmatrix\}/);
  assert.match(text, /\\int_0\^1/);
  assert.match(text, /\\ce\{2H2 \+ O2 -> 2H2O\}/);
  assert.match(text, /\\ce\{Ca\(OH\)2\}/);
  assert.match(text, /answer: A/);
});
