"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const kr = T.knowledgeRecord;

const NOW = new Date("2026-11-07T12:00:00Z");

function question(path, fm) {
  return { file: { path, basename: path.split("/").pop().replace(/\.md$/, "") }, fm };
}

test("knowledge record: extracts headings, definitions, terms, formulas and cards", () => {
  const text = `---
title: Cell biology
---

# Cell biology

## Osmosis

Osmosis is the movement of water across a membrane.

The **mitochondria** makes ATP.

**Entropy:** a measure of disorder in a system.

$$\\Delta G = \\Delta H - T\\Delta S$$

Active transport::movement against a gradient

## Question

This heading is generic and must be skipped.
`;
  const concepts = kr.extractConcepts(text, "Notes/Cell biology.md");
  const labels = concepts.map((concept) => concept.label);
  assert.ok(labels.includes("Osmosis"));
  assert.ok(labels.includes("mitochondria"));
  assert.ok(labels.includes("Entropy"));
  assert.ok(labels.includes("Osmosis formula"));
  assert.ok(labels.includes("Active transport"));
  assert.ok(!labels.includes("Question"));
  const osmosis = concepts.find((concept) => concept.label === "Osmosis");
  assert.equal(osmosis.kind, "heading");
  assert.match(osmosis.context, /movement of water/);
  assert.ok(concepts.every((concept) => concept.id && concept.sourceHash));
});

test("knowledge record: ids are stable and change only with the concept source", () => {
  const a = kr.extractConcepts("## Buffers\nA buffer resists pH change.", "Notes/Chemistry.md");
  const b = kr.extractConcepts("## Buffers\nA buffer resists pH change.", "Notes/Chemistry.md");
  const c = kr.extractConcepts("## Buffers\nA buffer resists pH change when acid is added.", "Notes/Chemistry.md");
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[0].id, c[0].id);
  assert.notEqual(a[0].sourceHash, c[0].sourceHash);
  const other = kr.extractConcepts("## Buffers\nA buffer resists pH change.", "Notes/Other.md");
  assert.notEqual(a[0].id, other[0].id);
});

test("knowledge record: reconcile keeps evidence, reopens changed sources and keeps orphans", () => {
  const first = kr.reconcileConcepts([], kr.extractConcepts("## Osmosis\nWater moves.", "Notes/Bio.md"), NOW);
  first[0].correct = 2;
  first[0].attempts = 2;
  first[0].status = "known";
  const same = kr.reconcileConcepts(first, kr.extractConcepts("## Osmosis\nWater moves.", "Notes/Bio.md"), NOW);
  assert.equal(same[0].correct, 2);
  assert.equal(same[0].status, "known");
  const changed = kr.reconcileConcepts(first, kr.extractConcepts("## Osmosis\nWater moves through a membrane.", "Notes/Bio.md"), NOW);
  assert.equal(changed[0].reopenedAt, NOW.toISOString());
  assert.equal(changed[0].dueAt, NOW.toISOString());
  const renamed = kr.reconcileConcepts(first, kr.extractConcepts("## Diffusion\nParticles spread.", "Notes/Bio.md"), NOW);
  const renamedConcept = renamed.find((concept) => concept.label === "Diffusion");
  assert.equal(renamedConcept.id, first[0].id, "a heading rename keeps its structural identity");
  assert.ok(renamedConcept.aliases.includes("Osmosis"));
  const removed = kr.reconcileConcepts(first, [], NOW);
  assert.ok(removed.some((concept) => concept.label === "Osmosis" && concept.orphanedAt));
  const restored = kr.reconcileConcepts(removed, kr.extractConcepts("## Osmosis\nWater moves.", "Notes/Bio.md"), NOW);
  assert.equal(restored.find((concept) => concept.label === "Osmosis").orphanedAt, null);
});

test("knowledge record: linked question history is projected onto the matching concept", () => {
  const text = `## Osmosis

Osmosis is the movement of water across a membrane.

## Diffusion

Diffusion is the movement of particles from high to low concentration.
`;
  const q = question("Questions/osmosis.md", {
    source_note: "Notes/Bio.md",
    source_heading: "Osmosis",
    attempts: 3,
    correct_count: 1,
    result: "incorrect",
    last_answer: "water moves uphill",
    last_error_type: "content_gap",
    next_review: "2026-11-06",
    "date attempted": "2026-11-05T10:00:00Z",
    history: [
      "2026-11-01T10:00:00Z|correct|20|water|3||a1",
      "2026-11-03T10:00:00Z|incorrect|20|water|2|content_gap|a2",
      "2026-11-05T10:00:00Z|incorrect|20|water moves uphill|2|content_gap|a3",
    ],
  });
  const entry = kr.buildNoteEntry("Notes/Bio.md", text, [q], [], NOW);
  assert.equal(entry.label, "Bio");
  const osmosis = entry.concepts.find((concept) => concept.label === "Osmosis");
  const diffusion = entry.concepts.find((concept) => concept.label === "Diffusion");
  assert.equal(osmosis.attempts, 3);
  assert.equal(osmosis.correct, 1);
  assert.equal(osmosis.incorrect, 2);
  assert.equal(osmosis.status, "learning");
  assert.equal(osmosis.dueAt, "2026-11-06");
  assert.equal(osmosis.errors.content_gap, 2);
  assert.equal(osmosis.lastVerdict, "incorrect");
  assert.match(osmosis.lastMiss.answer, /uphill/);
  assert.equal(diffusion.attempts, 0);
  assert.equal(diffusion.status, "untested");
});

test("knowledge record: coverage, note rows and the digest stay bounded", () => {
  const text = `## Alpha\nAlpha is the first letter and a concept here.\n\n## Beta\nBeta is the second letter and a concept here.\n\n## Gamma\nGamma is the third letter and a concept here.`;
  const q = question("Questions/a.md", {
    source_note: "Notes/Greek.md",
    source_heading: "Alpha",
    attempts: 2,
    correct_count: 2,
    result: "correct",
    next_review: "2026-11-06",
    "date attempted": "2026-11-05T10:00:00Z",
  });
  const entry = kr.buildNoteEntry("Notes/Greek.md", text, [q], [], NOW);
  const record = kr.normalizeRecord({ updatedAt: NOW.toISOString(), notes: { "Notes/Greek.md": entry } });
  const summary = kr.recordSummary(record, NOW);
  assert.equal(summary.notes, 1);
  assert.equal(summary.concepts, 3);
  assert.equal(summary.tested, 1);
  assert.equal(summary.known, 1);
  const rows = kr.noteRows(record, NOW);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 3);
  assert.equal(rows[0].known, 1);
  const digest = kr.buildLearnerDigest(record, { now: NOW, budget: 500 });
  assert.ok(digest.length <= 500);
  assert.match(digest, /KNOWLEDGE RECORD/);
  assert.match(digest, /Greek/);
  assert.match(digest, /Alpha/);
  assert.doesNotMatch(digest, /Alpha is the first letter/);
});

test("knowledge record: misconceptions group by tag and mark the latest miss open", () => {
  const text = `## Buffers\nA buffer resists pH change in a solution.\n\n## Titration\nTitration finds an unknown concentration.`;
  const a = question("Questions/buffer.md", {
    source_note: "Notes/Chem.md",
    source_heading: "Buffers",
    attempts: 2,
    correct_count: 1,
    result: "incorrect",
    last_error_type: "sign_error",
    "date attempted": "2026-11-05",
    history: ["2026-11-05|incorrect|10|pH 3|2|sign_error|a1"],
  });
  const b = question("Questions/titration.md", {
    source_note: "Notes/Chem.md",
    source_heading: "Titration",
    attempts: 2,
    correct_count: 2,
    result: "correct",
    "date attempted": "2026-11-06",
    history: [
      "2026-11-01|incorrect|10|x|2|sign_error|b1",
      "2026-11-06|correct|10|x|2||b2",
    ],
  });
  const entry = kr.buildNoteEntry("Notes/Chem.md", text, [a, b], [], NOW);
  const record = kr.normalizeRecord({ notes: { "Notes/Chem.md": entry } });
  const rows = kr.topMisconceptions(record, 5);
  const sign = rows.find((row) => row.tag === "sign_error");
  assert.ok(sign);
  assert.equal(sign.count, 2);
  assert.equal(sign.open, true);
  assert.equal(sign.label, "Sign error");
});

test("knowledge record: normalization guards malformed saved data", () => {
  const record = kr.normalizeRecord({
    notes: {
      "Notes/A.md": {
        label: "A",
        concepts: [
          { id: "x", label: "Concept", attempts: "4", correct: 9, errors: { Sign_Error: 2, "": 4 }, recentErrors: [{ at: "x", tag: "sign error" }] },
          null,
        ],
      },
      "Notes/B.md": { concepts: [] },
    },
  });
  assert.equal(Object.keys(record.notes).length, 1);
  const concept = record.notes["Notes/A.md"].concepts[0];
  assert.equal(concept.attempts, 4);
  assert.equal(concept.correct, 9);
  assert.equal(concept.errors.sign_error, 2);
  assert.equal(concept.recentErrors[0].tag, "sign_error");
  assert.deepEqual(kr.normalizeSettings({ enabled: "yes", notes: "4" }), { enabled: false, lastBuilt: "", notes: 4, concepts: 0, known: 0, due: 0 });
});
