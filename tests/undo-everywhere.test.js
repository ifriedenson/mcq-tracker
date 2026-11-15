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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

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

function byText(dom, text) {
  return dom.all.filter((o) => String((o.meta && o.meta.text) || "").trim() === text).pop();
}

test("deleting a saved conversation from the library can be undone", async () => {
  const { app, plugin } = await setup();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.chatSessions = [
    {
      id: "saved-chat",
      title: "Saved conversation probe",
      messages: [
        { role: "user", content: "What is mitosis?" },
        { role: "assistant", content: "Cell division." },
      ],
      updatedAt: 1763000000000,
    },
  ];
  await plugin.save();
  const before = JSON.parse(JSON.stringify(plugin.settings.ai));
  const { AgentView } = T.agentView;
  const view = new AgentView({ app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  await view.onOpen();
  const panel = view.chatTabs[0].panel;
  panel.toggleLibrary();
  panel.refreshLibrary();
  await click(byLabel(dom, "Delete conversation Saved conversation probe"));
  await tick();
  assert.equal(plugin.settings.ai.chatSessions.length, 0, "the saved conversation is gone");
  const undo = undoButton("Deleted “Saved conversation probe”.");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  const restored = plugin.settings.ai.chatSessions[0];
  const original = before.chatSessions[0];
  assert.equal(restored.title, original.title);
  assert.deepEqual(restored.messages, original.messages, "the whole transcript came back");
  assert.equal(restored.updatedAt, original.updatedAt);
  assert.equal(undo.disabled, true, "one notice cannot restore twice");
});

test("removing a chat project can be undone", async () => {
  const { app, plugin } = await setup();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.chatProjects = [{ id: "proj-live", name: "Live project probe", createdAt: 1763000000000 }];
  plugin.settings.ai.studyChatProject = "proj-live";
  await plugin.save();
  const { AgentView } = T.agentView;
  const view = new AgentView({ app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  await view.onOpen();
  const panel = view.chatTabs[0].panel;
  panel.toggleLibrary();
  panel.refreshProjectOptions();
  const before = JSON.parse(JSON.stringify(plugin.settings.ai));
  await click(byText(dom, "Remove project"));
  await tick();
  assert.equal(plugin.settings.ai.chatProjects.length, 0, "the project is gone");
  assert.equal(plugin.settings.ai.studyChatProject, "", "and the chat is no longer filed under it");
  const undo = undoButton("Deleted “Live project probe”.");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.settings.ai)), before);
  assert.equal(undo.disabled, true);
});

test("deleting a practice preset can be undone", async () => {
  const noteText = ["---", "question_id: bio-1", "---", "", "## Question", "What is a cell?", "", "## Options", "- A. The basic unit of life", "- B. A type of protein", "", "## Answer", "A"].join("\n");
  const app = makeApp([{ path: "Questions/bio.md", fm: { question_id: "bio-1" }, text: noteText }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.presets = [{ id: "p-live", name: "Live preset probe", filters: { course: ["Biology"] }, moreSets: [], mode: "smart" }];
  plugin.settings.activePreset = "p-live";
  await plugin.save();
  const before = snapshot(plugin, "presets");
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.renderIdle(dom.root);
  await click(byLabel(dom, "Delete the saved filter preset"));
  await tick();
  assert.equal(plugin.settings.presets.length, 0, "the preset is gone");
  const undo = undoButton("Deleted “Live preset probe”.");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(snapshot(plugin, "presets"), before);
  assert.equal(undo.disabled, true);
});

test("a pending grade undo refuses rather than overwriting a newer queued answer", async () => {
  const { app, plugin } = await setup();
  plugin.settings.cards.enabled = true;
  const card = { file: { path: "Cards/live-probe.md", basename: "live-probe" }, fm: { card_id: "live-probe" }, body: { front: "What is a cell?" } };
  plugin.queueCardGrade(card, "first answer", "standard");
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.renderPendingGrades(dom.root, plugin.readPendingCardGrades());
  await click(byLabel(dom, "Discard the pending grade for What is a cell?"));
  await tick();
  assert.equal(plugin.readPendingCardGrades().length, 0);
  plugin.queueCardGrade(card, "later answer", "standard");
  const message = obsidian.notices.filter((text) => /pending grade for What is a cell/.test(text)).pop();
  const undo = undoButton(message);
  await undo.handlers.find((h) => h.ev === "click").fn({});
  await tick();
  const remaining = plugin.readPendingCardGrades();
  assert.equal(remaining.length, 1, "the newer answer is kept");
  assert.equal(remaining[0].typed, "later answer");
  assert.ok(obsidian.notices.some((text) => /left as it is/.test(text)), obsidian.notices.join(" | "));
});

test("discarding a pending card grade can be undone from device storage", async () => {
  const { app, plugin } = await setup();
  plugin.settings.cards.enabled = true;
  const card = {
    file: { path: "Cards/live-probe.md", basename: "live-probe" },
    fm: { card_id: "live-probe" },
    body: { front: "What is a cell?", back: "The basic unit of life." },
  };
  plugin.queueCardGrade(card, "a cell is the unit of life", "standard");
  const before = JSON.parse(JSON.stringify(plugin.readPendingCardGrades()));
  assert.equal(before.length, 1);
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.renderPendingGrades(dom.root, plugin.readPendingCardGrades());
  await click(byLabel(dom, "Discard the pending grade for What is a cell?"));
  await tick();
  assert.equal(plugin.readPendingCardGrades().length, 0, "the queued answer is gone");
  const message = obsidian.notices.filter((text) => /pending grade for What is a cell/.test(text)).pop();
  const undo = undoButton(message);
  await undo.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.readPendingCardGrades())), before, "the stored answer and its metadata came back");
  assert.equal(undo.disabled, true);
});
