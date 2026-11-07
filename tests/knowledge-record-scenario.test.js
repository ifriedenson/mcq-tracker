"use strict";
/*
 * End-to-end scenario for the opt-in knowledge record. This drives the real
 * plugin, store and Insights view rather than the pure helpers alone.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const kr = T.knowledgeRecord;
const ks = T.knowledgeStore;
const aiContext = T.aiContext;

const SOURCE_PATH = "Notes/Biology.md";
const SOURCE_TEXT = `# Biology

## Osmosis

Osmosis is the movement of water across a semipermeable membrane.

## Diffusion

Diffusion is the movement of particles from high to low concentration.

## Unlinked topic

This idea has never been practised.
`;

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function stable(record) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.updatedAt;
  for (const entry of Object.values(copy.notes || {})) delete entry.updatedAt;
  return copy;
}

function concept(record, path, label) {
  return ((record.notes[path] || {}).concepts || []).find((item) => item.label === label);
}

function rowFor(record, path) {
  return kr.noteRows(record, new Date()).find((row) => row.path === path);
}

test("knowledge record scenario: note to store to Insights to digest to rebuild", async () => {
  const app = makeApp([
    { path: SOURCE_PATH, noFm: true, text: SOURCE_TEXT },
    {
      path: "Questions/osmosis.md",
      fm: { source_note: SOURCE_PATH, source_heading: "Osmosis", answer: "B" },
    },
    {
      path: "Questions/diffusion.md",
      fm: { source_note: SOURCE_PATH, source_heading: "Diffusion", answer: "B" },
    },
  ]);
  const source = app.files.find((file) => file.path === SOURCE_PATH);
  const osmosisQuestion = app.files.find((file) => file.path === "Questions/osmosis.md");
  const diffusionQuestion = app.files.find((file) => file.path === "Questions/diffusion.md");
  const plugin = new QT(app);
  await plugin.onload();

  await plugin.enableKnowledgeRecord();
  assert.ok(plugin.knowledgeRecordSettings().enabled);
  const stored = app.files.find((file) => file.path === ks.RECORD_PATH);
  assert.ok(stored, "the record is written at the knowledge-store path");
  const initial = JSON.parse(stored.text);
  assert.ok(initial.notes[SOURCE_PATH]);
  assert.ok(concept(initial, SOURCE_PATH, "Osmosis"));
  assert.ok(concept(initial, SOURCE_PATH, "Diffusion"));

  const originalRefresh = plugin.refreshKnowledgeRecordFor.bind(plugin);
  let lastRefresh = null;
  plugin.refreshKnowledgeRecordFor = (file) => {
    lastRefresh = originalRefresh(file);
    return lastRefresh;
  };

  // Two correct answers make Osmosis known through the real attempt path.
  for (let i = 0; i < 2; i++) {
    lastRefresh = null;
    await plugin.recordAttempt(osmosisQuestion, {
      chosen: "B",
      correct: true,
      conf: 3,
      seconds: 10,
      now: daysAgo(12),
    });
    assert.ok(lastRefresh, "an attempt schedules the incremental refresh");
    await lastRefresh;
  }
  let osmosis = concept(plugin.knowledgeRecord, SOURCE_PATH, "Osmosis");
  assert.equal(osmosis.attempts, 2);
  assert.equal(osmosis.correct, 2);
  assert.equal(osmosis.status, "known");

  // A miss plus the UI's error tag opens a misconception on Diffusion.
  lastRefresh = null;
  await plugin.recordAttempt(diffusionQuestion, {
    chosen: "A",
    correct: false,
    conf: 1,
    seconds: 20,
    now: daysAgo(11),
  });
  assert.ok(lastRefresh, "a miss schedules the incremental refresh");
  await lastRefresh;
  await plugin.setErrorType(diffusionQuestion, "content_gap");
  await plugin.refreshKnowledgeRecordFor(diffusionQuestion);

  const diffusion = concept(plugin.knowledgeRecord, SOURCE_PATH, "Diffusion");
  assert.equal(diffusion.incorrect, 1);
  assert.equal(diffusion.lastError, "content_gap");
  assert.equal(diffusion.lastVerdict, "incorrect");
  const row = rowFor(plugin.knowledgeRecord, SOURCE_PATH);
  assert.equal(row.known, 1);
  assert.equal(row.tested, 2);
  assert.ok(row.due >= 1, "the recorded review dates are due");
  assert.ok(row.coverage > 0 && row.coverage < 1);
  let misconception = kr.topMisconceptions(plugin.knowledgeRecord, 6).find((item) => item.tag === "content_gap");
  assert.ok(misconception, "the linked miss is visible as a misconception");
  assert.equal(misconception.open, true);

  // Correcting the same concept closes the misconception without deleting its history.
  await plugin.recordAttempt(diffusionQuestion, {
    chosen: "B",
    correct: true,
    conf: 3,
    seconds: 10,
    now: daysAgo(10),
  });
  await lastRefresh;
  misconception = kr.topMisconceptions(plugin.knowledgeRecord, 6).find((item) => item.tag === "content_gap");
  assert.ok(misconception);
  assert.equal(misconception.open, false, "a correct response fixes the open state");
  assert.equal(concept(plugin.knowledgeRecord, SOURCE_PATH, "Diffusion").lastVerdict, "correct");

  // Renaming a heading keeps its structural identity, aliases the old label and
  // retains the linked question evidence.
  const diffusionId = concept(plugin.knowledgeRecord, SOURCE_PATH, "Diffusion").id;
  source.text = source.text.replace("## Diffusion", "## Diffusion and osmosis");
  await plugin.rebuildKnowledgeRecord({ quiet: true });
  const renamed = concept(plugin.knowledgeRecord, SOURCE_PATH, "Diffusion and osmosis");
  assert.ok(renamed, "the renamed heading is re-extracted");
  assert.equal(renamed.id, diffusionId, "the heading identity survives the rename");
  assert.equal(renamed.orphanedAt, null);
  assert.ok(renamed.aliases.includes("Diffusion"));
  assert.equal(renamed.attempts, 2, "linked evidence follows the alias");
  assert.equal(concept(plugin.knowledgeRecord, SOURCE_PATH, "Diffusion"), undefined);

  // A second rebuild from the same notes is content-idempotent.
  const firstRebuild = stable(plugin.knowledgeRecord);
  await plugin.rebuildKnowledgeRecord({ quiet: true });
  assert.deepEqual(stable(plugin.knowledgeRecord), firstRebuild);

  // Deleting the source retains its concepts as owed work and marks the row.
  app.files.splice(app.files.indexOf(source), 1);
  await plugin.rebuildKnowledgeRecord({ quiet: true });
  const missingEntry = plugin.knowledgeRecord.notes[SOURCE_PATH];
  assert.ok(missingEntry, "a deleted source is retained");
  assert.ok(missingEntry.missingAt, "the retained entry is marked missing");
  assert.equal(kr.activeConcepts(missingEntry).length, 3);
  assert.equal(rowFor(plugin.knowledgeRecord, SOURCE_PATH).missing, true);

  // The Insights -> Concepts card renders the populated record and its actions
  // operate on that record.
  const dom = makeDom();
  const view = new T.InsightsView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.tab = "concepts";
  view.render();
  const texts = dom.texts();
  for (const expected of ["Knowledge record", "Biology", "Rebuild record", "Copy learner digest"]) {
    assert.ok(texts.includes(expected), `Insights renders ${expected}`);
  }
  assert.ok(texts.some((text) => text.includes("source missing")), "the card names the missing source");
  assert.ok(texts.some((text) => text.includes("1/3 concepts known")), "the card shows the real known count");
  let rebuilds = 0;
  const originalRebuild = plugin.rebuildKnowledgeRecord.bind(plugin);
  plugin.rebuildKnowledgeRecord = async (...args) => {
    rebuilds++;
    return originalRebuild(...args);
  };
  await dom.click("Rebuild record");
  assert.equal(rebuilds, 1);
  let copied = "";
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (text) => { copied = text; } } },
  });
  try {
    await dom.click("Copy learner digest");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
  assert.match(copied, /KNOWLEDGE RECORD/);
  assert.match(copied, /Osmosis/);
  assert.match(copied, /source missing/);
  assert.doesNotMatch(copied, /never been practised/);

  // The Study-agent toggle is the only route into the prompt, and the digest is bounded.
  const digest = plugin.learnerDigest();
  assert.ok(digest.length <= kr.DIGEST_CHARS, `digest is ${digest.length} characters`);
  assert.doesNotMatch(digest, /Unlinked topic/);
  plugin.settings.ai.context = aiContext.normalizeAiContext({ record: true });
  const withRecord = aiContext.buildStudyContext(plugin, plugin.settings.ai.context);
  assert.match(withRecord, /KNOWLEDGE RECORD/);
  assert.match(withRecord, /source missing/);
  plugin.settings.ai.context = aiContext.normalizeAiContext({});
  const withoutRecord = aiContext.buildStudyContext(plugin, plugin.settings.ai.context);
  assert.doesNotMatch(withoutRecord, /KNOWLEDGE RECORD/);

  // A fresh plugin instance loads the same record from the vault.
  const reloaded = new QT(app);
  await reloaded.onload();
  reloaded.settings.knowledgeRecord.enabled = true;
  await reloaded.loadKnowledgeRecord();
  assert.deepEqual(stable(reloaded.knowledgeRecord), stable(plugin.knowledgeRecord));
  assert.ok(reloaded.knowledgeRecord.notes[SOURCE_PATH].missingAt);
});
