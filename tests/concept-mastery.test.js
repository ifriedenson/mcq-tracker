"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const cm = T.conceptMastery;

function q(source, attempts, correct, path) {
  return {
    file: { path: path || "Questions/q.md" },
    fm: source ? { source_note: source, attempts, correct_count: correct } : { attempts, correct_count: correct },
  };
}

test("concept mastery: questions are grouped by their source note", () => {
  const rows = cm.conceptMasteryRows([
    q("Notes/Buffers.md", 4, 1),
    q("Notes/Buffers.md", 6, 5),
    q("Notes/Entropy.md", 5, 5),
  ]);
  assert.equal(rows.length, 2);
  const buffers = rows.find((row) => row.path === "Notes/Buffers.md");
  assert.equal(buffers.questions, 2);
  assert.equal(buffers.attempts, 10);
  assert.equal(buffers.correct, 6);
  assert.equal(buffers.accuracy, 0.6);
  assert.equal(buffers.band, "developing");
  assert.equal(buffers.label, "Buffers");
});

test("concept mastery: weakest notes come first and untried notes come last", () => {
  const rows = cm.conceptMasteryRows([
    q("Notes/Strong.md", 5, 5),
    q("Notes/Weak.md", 5, 1),
    q("Notes/Untried.md", 0, 0),
    q("Notes/Mid.md", 5, 3),
  ]);
  assert.deepEqual(rows.map((row) => row.path), ["Notes/Weak.md", "Notes/Mid.md", "Notes/Strong.md", "Notes/Untried.md"]);
  assert.deepEqual(rows.map((row) => row.band), ["weak", "developing", "strong", "untried"]);
  assert.equal(rows[3].accuracy, null);
});

test("concept mastery: band thresholds are 60% and 80%", () => {
  assert.equal(cm.masteryBand(null), "untried");
  assert.equal(cm.masteryBand(0), "weak");
  assert.equal(cm.masteryBand(0.59), "weak");
  assert.equal(cm.masteryBand(0.6), "developing");
  assert.equal(cm.masteryBand(0.79), "developing");
  assert.equal(cm.masteryBand(0.8), "strong");
  assert.equal(cm.masteryBand(1), "strong");
});

test("concept mastery: notes without source_note are ignored and bad counters are clamped", () => {
  const rows = cm.conceptMasteryRows([q("", 9, 9), q("Notes/A.md", 2, 8), q("Notes/A.md", -3, 4), null, {}]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].attempts, 2);
  assert.equal(rows[0].correct, 2, "correct_count cannot exceed attempts");
  assert.equal(rows[0].accuracy, 1);
  assert.equal(rows[0].band, "strong");
});

test("concept mastery: an empty or missing list is safe", () => {
  assert.deepEqual(cm.conceptMasteryRows([]), []);
  assert.deepEqual(cm.conceptMasteryRows(null), []);
  assert.equal(cm.sourceLabel(""), "Untitled note");
  assert.equal(cm.sourceLabel("Notes/Unit 4.md"), "Unit 4");
});
