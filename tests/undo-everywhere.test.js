"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

function byLabel(dom, label) {
  return dom.all.filter((o) => {
    const attrs = o.meta.attrs || o.meta.attr;
    return attrs && attrs["aria-label"] === label;
  }).pop();
}

async function click(el) {
  assert.ok(el, "expected control");
  await el.handlers.find((h) => h.ev === "click").fn({});
}

function undoButton(message) {
  const notice = obsidian.noticeObjects.filter((entry) => entry.message === message).pop();
  assert.ok(notice, `notice ${message} (${obsidian.notices.join(" | ")})`);
  const undo = notice.noticeEl.children.find((el) => el.cls === "qt-notice-undo");
  assert.ok(undo, "the notice carries an Undo");
  return undo;
}

const snapshot = (plugin, key) => JSON.parse(JSON.stringify(plugin.settings[key]));

test("deleting an annotation can be undone, restoring the whole record", async () => {
  const { app, plugin } = await setup();
  await plugin.addAnnotation({ quote: "Cells respire", sourcePath: "Notes/Bio.md", question: "Why?", answer: "ATP" });
  const before = snapshot(plugin, "annotations");
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.renderAnnotations(dom.root);
  await click(byLabel(dom, "Delete annotation from Notes/Bio.md"));
  assert.equal(plugin.settings.annotations.annotations.length, 0, "the row is gone");
  const undo = undoButton("Deleted “Cells respire”.");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(snapshot(plugin, "annotations"), before);
  assert.equal(undo.disabled, true, "one notice cannot restore twice");
});

test("deleting a vocabulary word can be undone", async () => {
  const { app, plugin } = await setup();
  await plugin.addVocabWord({ term: "mitosis", definition: "cell division", course: "Biology" });
  const before = snapshot(plugin, "vocabulary");
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.renderVocabulary(dom.root);
  await click(byLabel(dom, "Delete word mitosis"));
  assert.equal(plugin.settings.vocabulary.words.length, 0);
  const undo = undoButton("Deleted “mitosis”.");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(snapshot(plugin, "vocabulary"), before);
});

test("deleting a time block can be undone, tasks included", async () => {
  const { app, plugin } = await setup();
  plugin.settings.timeBlocks = { ...plugin.settings.timeBlocks, enabled: true };
  const block = await plugin.addTimeBlock({ title: "Morning review", date: "2026-11-16", start: "09:00", end: "10:00" });
  assert.ok(block, "block added");
  await plugin.addTimeBlockTask(block.id, { title: "Read notes" });
  const before = snapshot(plugin, "timeBlocks");
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.timeBlockDate = "2026-11-16";
  view.renderTimeBlocks(dom.root);
  await click(byLabel(dom, "Delete block Morning review"));
  assert.equal(plugin.settings.timeBlocks.blocks.length, 0);
  const undo = undoButton("Deleted “Morning review”.");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(snapshot(plugin, "timeBlocks"), before);
  assert.equal(plugin.settings.timeBlocks.blocks[0].tasks.length, 1, "the task inside came back too");
});

test("removing a saved chat fact can be undone", async () => {
  const { app, plugin } = await setup();
  plugin.rememberFact("exams start in May");
  const before = JSON.parse(JSON.stringify(plugin.settings.ai.chatMemory));
  const { ChatMemoryModal } = T.chatMemoryModal;
  const modal = new ChatMemoryModal(app, plugin);
  modal.app = app;
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.render();
  await click(byLabel(dom, "Remove saved fact exams start in May"));
  assert.deepEqual(plugin.settings.ai.chatMemory, [], "the fact is gone");
  const undo = undoButton("Deleted “exams start in May”.");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(plugin.settings.ai.chatMemory, before);
});

test("undo refuses rather than overwriting a change made after the delete", async () => {
  const { plugin } = await setup();
  await plugin.addVocabWord({ term: "osmosis", definition: "water moves" });
  await plugin.deleteWithUndo({
    label: "osmosis",
    remove: async () => {
      const data = plugin.studyWorkspaceSettings().vocabulary;
      plugin.settings.vocabulary = { ...data, words: data.words.filter((word) => word.term !== "osmosis") };
      await plugin.save();
    },
  });
  await plugin.addVocabWord({ term: "diffusion", definition: "particles spread" });
  const undo = undoButton("Deleted “osmosis”.");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  const terms = plugin.settings.vocabulary.words.map((word) => word.term);
  assert.deepEqual(terms, ["diffusion"], "the later change is kept and the stale undo does nothing");
  assert.ok(obsidian.notices.some((text) => /left as it is/.test(text)), obsidian.notices.join(" | "));
});
