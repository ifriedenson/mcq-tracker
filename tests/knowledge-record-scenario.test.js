"use strict";
/*
 * End-to-end scenario for the opt-in knowledge record. This drives the real
 * plugin, store, vault events and Insights view rather than the pure helpers
 * alone: one source note is moved, renamed, deleted, recreated at a new path and
 * restored, and its concepts must keep their identity through every step.
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
const MOVED_PATH = "Courses/Biology.md";
const RENAMED_PATH = "Courses/Biology 101.md";
const RECREATED_PATH = "Archive/Biology 101.md";
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

/** Move a file the way Obsidian's vault does just before it emits `rename`. */
function moveFile(file, nextPath) {
  const oldPath = file.path;
  file.path = nextPath;
  file.basename = nextPath.replace(/^.*\//, "").replace(/\.md$/, "");
  file.parent = { path: nextPath.includes("/") ? nextPath.replace(/\/[^/]*$/, "") : "/" };
  return oldPath;
}

/** Remove a file the way Obsidian's vault does just before it emits `delete`. */
function dropFile(app, file) {
  const index = app.files.indexOf(file);
  assert.ok(index >= 0, "the file is still in the vault");
  app.files.splice(index, 1);
  return file.path;
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
  // The vault listeners are registered after layout is ready; the fake app keeps
  // one handler per event, so this is also how the scenario reaches the real one.
  plugin.startDeferredStartup();
  for (const event of ["vault:rename", "vault:delete", "vault:create"]) {
    assert.equal(typeof app.handlers[event], "function", `the vault ${event} listener is registered`);
  }

  await plugin.enableKnowledgeRecord();
  assert.ok(plugin.knowledgeRecordSettings().enabled);
  const stored = app.files.find((file) => file.path === ks.RECORD_PATH);
  assert.ok(stored, "the record is written at the knowledge-store path");
  const initial = JSON.parse(stored.text);
  assert.ok(initial.notes[SOURCE_PATH]);
  assert.ok(concept(initial, SOURCE_PATH, "Osmosis"));
  assert.ok(concept(initial, SOURCE_PATH, "Diffusion"));
  const noteId = initial.notes[SOURCE_PATH].noteId;
  assert.ok(noteId, "the note carries a stable identity token");

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
  const osmosisId = osmosis.id;
  const osmosisFirstSeen = osmosis.firstSeen;

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
  const diffusionFirstSeen = concept(plugin.knowledgeRecord, SOURCE_PATH, "Diffusion").firstSeen;
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

  /* ---- the note itself moves: the record follows the path, not a new note ---- */
  const oldSourcePath = moveFile(source, MOVED_PATH);
  assert.equal(oldSourcePath, SOURCE_PATH);
  // Obsidian rewrites the links it can see; one question follows the move and
  // the other is left pointing at the old path on purpose.
  osmosisQuestion.fm.source_note = MOVED_PATH;
  await app.handlers["vault:rename"](source, oldSourcePath);
  await plugin.flushKnowledgeRecordRefresh();

  assert.deepEqual(Object.keys(plugin.knowledgeRecord.notes), [MOVED_PATH], "the entry moved instead of being copied");
  const movedEntry = plugin.knowledgeRecord.notes[MOVED_PATH];
  assert.equal(movedEntry.noteId, noteId, "the note identity survives the move");
  assert.ok(movedEntry.pathAliases.includes(SOURCE_PATH), "the old path is kept as an alias");
  assert.ok(!movedEntry.pathAliases.includes(MOVED_PATH), "the current path is not its own alias");
  assert.equal(movedEntry.missingAt, null);
  osmosis = concept(plugin.knowledgeRecord, MOVED_PATH, "Osmosis");
  const movedDiffusion = concept(plugin.knowledgeRecord, MOVED_PATH, "Diffusion and osmosis");
  assert.equal(osmosis.id, osmosisId, "concept ids survive the move");
  assert.equal(movedDiffusion.id, diffusionId, "concept ids survive the move");
  assert.equal(osmosis.firstSeen, osmosisFirstSeen, "firstSeen survives the move");
  assert.equal(movedDiffusion.firstSeen, diffusionFirstSeen, "firstSeen survives the move");
  assert.equal(osmosis.attempts, 2, "evidence is not duplicated by the move");
  assert.equal(movedDiffusion.attempts, 2, "a question still on the old path is matched through the alias");
  assert.equal(movedDiffusion.correct, 1);
  assert.equal(movedDiffusion.incorrect, 1);
  misconception = kr.topMisconceptions(plugin.knowledgeRecord, 6).find((item) => item.tag === "content_gap");
  assert.ok(misconception, "the misconception survives the move");
  assert.equal(misconception.count, 1);
  assert.equal(misconception.open, false, "a fixed misconception stays fixed across the move");
  const movedRow = rowFor(plugin.knowledgeRecord, MOVED_PATH);
  assert.ok(movedRow);
  assert.equal(movedRow.missing, false);
  assert.equal(movedRow.known, 1);
  assert.equal(movedRow.tested, 2);
  assert.ok(movedRow.due >= 1);
  assert.ok(movedRow.coverage > 0 && movedRow.coverage < 1);

  // The Insights -> Concepts card links the moved note rather than orphaning it.
  const dom = makeDom();
  const view = new T.InsightsView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.tab = "concepts";
  view.render();
  let texts = dom.texts();
  for (const expected of ["Knowledge record", "Biology", "Rebuild record", "Copy learner digest"]) {
    assert.ok(texts.includes(expected), `Insights renders ${expected}`);
  }
  assert.ok(texts.some((text) => text.includes("1/3 concepts known")), "the card shows the real known count");
  assert.ok(!texts.some((text) => text.includes("source missing")), "the moved note is not reported missing");

  // Practising through a question that still names the old path updates the
  // moved entry in place, reopens the misconception and then fixes it again.
  await plugin.recordAttempt(diffusionQuestion, {
    chosen: "A",
    correct: false,
    conf: 1,
    seconds: 25,
    now: daysAgo(6),
  });
  await lastRefresh;
  await plugin.setErrorType(diffusionQuestion, "content_gap");
  await plugin.refreshKnowledgeRecordFor(diffusionQuestion);
  assert.deepEqual(Object.keys(plugin.knowledgeRecord.notes), [MOVED_PATH], "no stale copy is recreated at the old path");
  misconception = kr.topMisconceptions(plugin.knowledgeRecord, 6).find((item) => item.tag === "content_gap");
  assert.equal(misconception.open, true, "a new miss reopens the misconception after the move");
  assert.equal(misconception.count, 2);
  assert.equal(concept(plugin.knowledgeRecord, MOVED_PATH, "Diffusion and osmosis").attempts, 3);

  await plugin.recordAttempt(diffusionQuestion, {
    chosen: "B",
    correct: true,
    conf: 3,
    seconds: 10,
    now: daysAgo(5),
  });
  await lastRefresh;
  misconception = kr.topMisconceptions(plugin.knowledgeRecord, 6).find((item) => item.tag === "content_gap");
  assert.equal(misconception.open, false, "a correct response fixes the reopened misconception");
  assert.equal(concept(plugin.knowledgeRecord, MOVED_PATH, "Diffusion and osmosis").attempts, 4);

  /* ---- renaming the note file is the note-level analog of a heading rename ---- */
  const renamedOldPath = moveFile(source, RENAMED_PATH);
  await app.handlers["vault:rename"](source, renamedOldPath);
  await plugin.flushKnowledgeRecordRefresh();
  assert.deepEqual(Object.keys(plugin.knowledgeRecord.notes), [RENAMED_PATH], "the entry moved with the renamed file");
  const renamedEntry = plugin.knowledgeRecord.notes[RENAMED_PATH];
  assert.equal(renamedEntry.noteId, noteId);
  assert.ok(renamedEntry.pathAliases.includes(SOURCE_PATH));
  assert.ok(renamedEntry.pathAliases.includes(MOVED_PATH));
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Osmosis").id, osmosisId);
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Diffusion and osmosis").id, diffusionId);
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Osmosis").firstSeen, osmosisFirstSeen);
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Diffusion and osmosis").attempts, 4);

  // A full rebuild after the move and rename is content-idempotent and does not
  // re-create the note under an old path or double its evidence.
  const afterRename = stable(plugin.knowledgeRecord);
  await plugin.rebuildKnowledgeRecord({ quiet: true });
  await plugin.rebuildKnowledgeRecord({ quiet: true });
  assert.deepEqual(stable(plugin.knowledgeRecord), afterRename, "repeated rebuilds are idempotent after a move");
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Osmosis").attempts, 2);
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Diffusion and osmosis").attempts, 4);

  /* ---- a genuine delete keeps the concepts as owed work ---- */
  const keptText = source.text;
  dropFile(app, source);
  await app.handlers["vault:delete"](source);
  const missingEntry = plugin.knowledgeRecord.notes[RENAMED_PATH];
  assert.ok(missingEntry, "a deleted source is retained");
  assert.ok(missingEntry.missingAt, "the retained entry is marked missing");
  assert.equal(missingEntry.noteId, noteId);
  assert.equal(kr.activeConcepts(missingEntry).length, 3);
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Osmosis").id, osmosisId);
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Diffusion and osmosis").id, diffusionId);
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Osmosis").firstSeen, osmosisFirstSeen);
  assert.equal(concept(plugin.knowledgeRecord, RENAMED_PATH, "Diffusion and osmosis").attempts, 4);
  assert.equal(rowFor(plugin.knowledgeRecord, RENAMED_PATH).missing, true);

  // The Insights -> Concepts card renders the retained record and its actions
  // operate on that record.
  view.render();
  texts = dom.texts();
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
  assert.ok(plugin.knowledgeRecord.notes[RENAMED_PATH].missingAt, "a rebuild keeps the missing note as owed");

  // The Study-agent toggle is the only route into the prompt, and the digest is bounded.
  const digest = plugin.learnerDigest();
  assert.ok(digest.length <= kr.DIGEST_CHARS, `digest is ${digest.length} characters`);
  assert.match(digest, /source missing/);
  assert.doesNotMatch(digest, /never been practised/);
  plugin.settings.ai.context = aiContext.normalizeAiContext({ record: true });
  const withRecord = aiContext.buildStudyContext(plugin, plugin.settings.ai.context);
  assert.match(withRecord, /KNOWLEDGE RECORD/);
  assert.match(withRecord, /source missing/);
  plugin.settings.ai.context = aiContext.normalizeAiContext({});
  const withoutRecord = aiContext.buildStudyContext(plugin, plugin.settings.ai.context);
  assert.doesNotMatch(withoutRecord, /KNOWLEDGE RECORD/);

  /* ---- delete then recreate at a new path: identity is matched by content ---- */
  const recreated = await app.vault.create(RECREATED_PATH, keptText);
  await app.handlers["vault:create"](recreated);
  await plugin.flushKnowledgeRecordRefresh();
  assert.deepEqual(Object.keys(plugin.knowledgeRecord.notes), [RECREATED_PATH], "the recreated note relinks instead of duplicating");
  const recreatedEntry = plugin.knowledgeRecord.notes[RECREATED_PATH];
  assert.equal(recreatedEntry.noteId, noteId, "the recreated note keeps the identity anchor");
  assert.equal(recreatedEntry.missingAt, null, "the recreated note is linked again");
  assert.ok(recreatedEntry.pathAliases.includes(SOURCE_PATH));
  assert.ok(recreatedEntry.pathAliases.includes(MOVED_PATH));
  assert.ok(recreatedEntry.pathAliases.includes(RENAMED_PATH));
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Osmosis").id, osmosisId);
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Diffusion and osmosis").id, diffusionId);
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Osmosis").firstSeen, osmosisFirstSeen);
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Diffusion and osmosis").firstSeen, diffusionFirstSeen);
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Osmosis").attempts, 2, "recreating does not double evidence");
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Diffusion and osmosis").attempts, 4, "recreating does not double evidence");
  misconception = kr.topMisconceptions(plugin.knowledgeRecord, 6).find((item) => item.tag === "content_gap");
  assert.equal(misconception.open, false, "the fixed misconception relinks with the note");
  assert.equal(misconception.count, 2);
  assert.equal(rowFor(plugin.knowledgeRecord, RECREATED_PATH).missing, false);
  assert.doesNotMatch(plugin.learnerDigest(), /source missing/);

  /* ---- restoring a retained missing note at the same path also relinks ---- */
  dropFile(app, recreated);
  await app.handlers["vault:delete"](recreated);
  assert.ok(plugin.knowledgeRecord.notes[RECREATED_PATH].missingAt, "the note is retained as owed when deleted again");
  await plugin.rebuildKnowledgeRecord({ quiet: true });
  assert.ok(plugin.knowledgeRecord.notes[RECREATED_PATH].missingAt, "a rebuild keeps it retained");
  const restored = await app.vault.create(RECREATED_PATH, keptText);
  await app.handlers["vault:create"](restored);
  await plugin.flushKnowledgeRecordRefresh();
  assert.deepEqual(Object.keys(plugin.knowledgeRecord.notes), [RECREATED_PATH]);
  const restoredEntry = plugin.knowledgeRecord.notes[RECREATED_PATH];
  assert.equal(restoredEntry.noteId, noteId, "restoring keeps the identity anchor");
  assert.equal(restoredEntry.missingAt, null);
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Osmosis").id, osmosisId);
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Diffusion and osmosis").id, diffusionId);
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Osmosis").attempts, 2);
  assert.equal(concept(plugin.knowledgeRecord, RECREATED_PATH, "Diffusion and osmosis").attempts, 4);

  const restoredStable = stable(plugin.knowledgeRecord);
  await plugin.flushKnowledgeRecordRebuild();
  await plugin.flushKnowledgeRecordRebuild();
  assert.deepEqual(stable(plugin.knowledgeRecord), restoredStable, "repeated full rebuilds are idempotent after restoring");

  let copied = "";
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async (text) => { copied = text; } } },
  });
  try {
    view.render();
    await dom.click("Copy learner digest");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
  assert.match(copied, /KNOWLEDGE RECORD/);
  assert.match(copied, /Osmosis/);
  assert.doesNotMatch(copied, /source missing/);

  // A fresh plugin instance loads the same record from the vault.
  const reloaded = new QT(app);
  await reloaded.onload();
  reloaded.settings.knowledgeRecord.enabled = true;
  await reloaded.loadKnowledgeRecord();
  assert.deepEqual(stable(reloaded.knowledgeRecord), stable(plugin.knowledgeRecord));
  assert.equal(reloaded.knowledgeRecord.notes[RECREATED_PATH].noteId, noteId);
});
