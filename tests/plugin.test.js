"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian, TFile, TFolder } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { Plugin: QT } = load();

const NOTES = [
  { path: "Questions/sat/Q1.md", fm: { skill: "grammar", difficulty: "hard", source_question_id: "aaa111" } },
  { path: "Questions/sat/sub/Q2.md", fm: { skill: "vocab", difficulty: "medium", official_question_id: "bbb222" } },
  { path: "Questions/other/Q3.md", fm: { skill: "grammar", difficulty: "easy" } },
];

async function start(notes = NOTES) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("the plugin starts and registers its views, commands and folder events", async () => {
  const { app, plugin } = await start();
  assert.deepEqual(Object.keys(plugin.views).sort(), ["question-tracker-assignments", "question-tracker-calendar", "question-tracker-cards", "question-tracker-insights", "question-tracker-reference", "question-tracker-study-tools", "question-tracker-study-workspace", "question-tracker-test", "question-tracker-today", "question-tracker-view"]);
  const ids = plugin.commands.map((c) => c.id);
  for (const id of ["practice-folder", "practice-current-folder", "practice-note", "timed-test", "weak-spots", "error-log", "find-question", "rename-source-id", "open-practice-view", "open-today", "import-pdf", "quick-add", "open-calendar", "open-cards", "open-assignments", "new-assignment", "open-reference", "new-card", "cards-extract-note", "tag-card-courses", "import-cards", "paper-scanner", "document-review", "ocr-pdf", "open-study-tools", "new-cornell-note", "open-study-workspace", "new-feynman-cycle", "build-recall-queue", "new-topic-plan", "study-flow-capture", "subject-manager", "open-quiz-index"]) {
    assert.ok(ids.includes(id), `missing command ${id}`);
  }
  assert.ok(app.handlers["ws:file-menu"], "file explorer menu");
  assert.ok(app.handlers["vault:rename"], "folder rename");
});

test("settings load with safe defaults, and a bad folder style falls back to auto", async () => {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  plugin.saved = { folderFilterStyle: "nonsense", testDefaults: { count: 5 }, ai: {} };
  await plugin.loadSettings();
  assert.equal(plugin.settings.folderFilterStyle, "auto");
  assert.deepEqual(plugin.settings.testDefaults, { count: 5, minutes: 12, from: 1, to: 0, frq: 0, shuffleChoices: false, passScore: 0 });
  assert.equal(plugin.settings.ai.autoDeclined, false);
  assert.equal(plugin.settings.ai.tutorRole, "private");
});

test("an unknown saved tutor role safely falls back to private", async () => {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  plugin.saved = { ai: { tutorRole: "wizard" } };
  await plugin.loadSettings();
  assert.equal(plugin.settings.ai.tutorRole, "private");
});

test("the folder filter shows a search box only when there are many folders (or when asked)", async () => {
  const { plugin } = await start();
  assert.equal(plugin.folderSearchOn(3), false);
  assert.equal(plugin.folderSearchOn(9), true);
  plugin.settings.folderFilterStyle = "buttons";
  assert.equal(plugin.folderSearchOn(50), false);
  plugin.settings.folderFilterStyle = "search";
  assert.equal(plugin.folderSearchOn(1), true);
});

test("right-clicking a folder that holds questions adds 'Practice this folder'", async () => {
  const { app, plugin } = await start();
  const folder = new TFolder();
  folder.path = "Questions/sat";
  const items = [];
  const menu = {
    addItem: (cb) => {
      const item = { setTitle: (t) => ((item.title = t), item), setIcon: () => item, onClick: (fn) => ((item.fn = fn), item) };
      cb(item);
      items.push(item);
    },
  };
  app.handlers["ws:file-menu"](menu, folder);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Practice this folder");

  const calls = [];
  plugin.practiceWith = async (f, m) => calls.push([f, m]);
  await items[0].fn();
  assert.deepEqual(calls, [[{ folder: ["Questions/sat"] }, "smart"]]);

  const empty = new TFolder();
  empty.path = "Somewhere/else";
  const before = items.length;
  app.handlers["ws:file-menu"](menu, empty);
  assert.equal(items.length, before);
});

test("right-clicking a question note adds Practice this note only and Extract cards", async () => {
  const { app, plugin } = await start();
  plugin.settings.cards.enabled = true;
  const items = [];
  const menu = {
    addItem: (cb) => {
      const item = { setTitle: (t) => ((item.title = t), item), setIcon: () => item, onClick: (fn) => ((item.fn = fn), item) };
      cb(item);
      items.push(item);
    },
  };
  const file = new TFile();
  file.path = "Questions/sat/Q1.md";
  file.basename = "Q1";
  file.fm = { question_id: "Q1" };
  app.handlers["ws:file-menu"](menu, file);
  assert.deepEqual(items.map((item) => item.title), ["Practice this note only", "Extract cards from this note"]);
  let practised = "";
  let extracted = "";
  plugin.practiceNote = async (path) => (practised = path);
  plugin.openCardExtract = (path) => (extracted = path);
  await items[0].fn();
  await items[1].fn();
  assert.equal(practised, "Questions/sat/Q1.md");
  assert.equal(extracted, "Questions/sat/Q1.md");
});

test("practiceWith sets the filters, switches the mode and starts a question", async () => {
  const { plugin } = await start();
  const view = { started: 0, next: async () => view.started++ };
  plugin.activateView = async () => view;
  plugin.settings.moreSets = [{ skill: ["x"] }];
  plugin.settings.activePreset = "p1";
  await plugin.practiceWith({ skill: ["grammar"] }, "missed");
  assert.deepEqual(plugin.settings.filters, { skill: ["grammar"] });
  assert.deepEqual(plugin.settings.moreSets, []);
  assert.equal(plugin.settings.activePreset, "");
  assert.equal(plugin.settings.mode, "missed");
  assert.equal(view.started, 1);
  assert.equal(plugin.saved.mode, "missed");
});

test("practiceFolder only works for folders that have questions", async () => {
  const { plugin } = await start();
  const calls = [];
  plugin.practiceWith = async (f, m) => calls.push([f, m]);
  obsidian.notices.length = 0;
  await plugin.practiceFolder("Nothing/here");
  assert.equal(calls.length, 0);
  assert.match(obsidian.notices.at(-1), /No question notes/);
  await plugin.practiceFolder("Questions/sat");
  assert.deepEqual(calls, [[{ folder: ["Questions/sat"] }, "smart"]]);
});

test("renaming a folder keeps saved filters and the question folder pointing at it", async () => {
  const { app, plugin } = await start();
  plugin.settings.questionFolder = "Questions";
  plugin.settings.filters = { folder: ["Questions/sat"] };
  const folder = new TFolder();
  folder.path = "Bank";
  app.handlers["vault:rename"](folder, "Questions");
  assert.equal(plugin.settings.questionFolder, "Bank");
  assert.deepEqual(plugin.settings.filters, { folder: ["Bank/sat"] });
  assert.deepEqual(plugin.saved.filters, { folder: ["Bank/sat"] });
});

test("the one-time command renames source_question_id and leaves other notes alone", async () => {
  const { app, plugin } = await start();
  obsidian.notices.length = 0;
  await plugin.migrateOfficialIds();
  const f1 = app.files[0].fm;
  assert.equal(f1.official_question_id, "aaa111");
  assert.equal("source_question_id" in f1, false);
  assert.equal(app.files[1].fm.official_question_id, "bbb222");
  assert.match(obsidian.notices.at(-1), /Renamed the property on 1 note/);
  await plugin.migrateOfficialIds();
  assert.match(obsidian.notices.at(-1), /No notes use source_question_id/);
});

test("saying no to the automatic OpenCode download is remembered", async () => {
  const { plugin } = await start();
  const mgr = plugin.manager;
  mgr.install = async () => {
    const e = new Error("OpenCode install cancelled.");
    e.cancelled = true;
    throw e;
  };
  mgr.hasExisting = async () => "";
  await mgr.autoSetup(() => {});
  assert.equal(plugin.settings.ai.autoDeclined, true);
  assert.equal(plugin.saved.ai.autoDeclined, true);
  assert.equal(mgr.setupError, "");
});

test("a failed automatic download shows the error and doesn't set the declined flag", async () => {
  const { plugin } = await start();
  const mgr = plugin.manager;
  mgr.install = async () => {
    throw new Error("network down");
  };
  mgr.hasExisting = async () => "";
  await mgr.autoSetup(() => {});
  assert.equal(plugin.settings.ai.autoDeclined, false);
  assert.match(mgr.setupError, /network down/);
});

test("an OpenCode that is already on the computer is used instead of downloading", async () => {
  const { plugin } = await start();
  const mgr = plugin.manager;
  let downloaded = false;
  mgr.install = async () => {
    downloaded = true;
    return { path: "x" };
  };
  mgr.hasExisting = async () => "/usr/local/bin/opencode";
  await mgr.autoSetup(() => {});
  assert.equal(downloaded, false);
  assert.equal(mgr.foundPath, "/usr/local/bin/opencode");
});
