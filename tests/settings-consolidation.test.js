"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const STS = T.studyToolSettings;
const MODULES = STS.STUDY_TOOL_SETTINGS_MODULES;

async function setup(saved) {
  const plugin = new QT(makeApp([]));
  if (saved) plugin.saved = saved;
  await plugin.onload();
  return plugin;
}

/** Minimal element stand-in for the settings renderers that build their own DOM. */
function fakeEl(tag) {
  const el = {
    tag,
    children: [],
    listeners: {},
    attrs: {},
    text: "",
    cls: "",
    value: "",
    createDiv(opts) {
      const child = fakeEl("div");
      if (opts && opts.cls) child.cls = opts.cls;
      if (opts && opts.text) child.text = opts.text;
      this.children.push(child);
      return child;
    },
    createEl(tagName, opts) {
      const child = fakeEl(tagName);
      if (opts && opts.cls) child.cls = opts.cls;
      if (opts && opts.text) child.text = opts.text;
      if (opts && opts.value !== undefined) child.value = opts.value;
      this.children.push(child);
      return child;
    },
    createSpan(opts) {
      return this.createEl("span", opts);
    },
    setAttr(name, value) {
      this.attrs[name] = value;
      return this;
    },
    addEventListener(name, fn) {
      (this.listeners[name] = this.listeners[name] || []).push(fn);
    },
    addClass(name) {
      this.cls = `${this.cls} ${name}`.trim();
      return this;
    },
    empty() {
      this.children = [];
    },
    querySelectorAll() {
      return [];
    },
  };
  return el;
}

function all(el, out = []) {
  for (const child of el.children || []) {
    out.push(child);
    all(child, out);
  }
  return out;
}

function pageField(id, name) {
  const page = STS.STUDY_TOOL_SETTINGS_BY_ID[id].page;
  const field = (page.fields || []).find((entry) => entry.name === name);
  assert.ok(field, `${id} has a "${name}" field`);
  return field;
}

test("global settings: the study tools are an index, not duplicate toggles", async () => {
  const plugin = await setup({ cornellNotes: { enabled: false } });
  const host = fakeEl("div");
  const opened = [];
  obsidian.settingNames.length = 0;
  T.settingsGlobal.renderModules(host, plugin, () => {}, (id) => opened.push(id));

  const buttons = all(host).filter((el) => el.tag === "button");
  assert.equal(buttons.length, MODULES.length, "one index button per study tool");
  assert.ok(MODULES.length >= 31, "the block study tools also have pages");

  const labels = all(host)
    .filter((el) => String(el.cls).includes("qt-module-link-label"))
    .map((el) => el.text);
  assert.deepEqual(labels, MODULES.map((module) => module.label));

  const cornellIndex = MODULES.findIndex((module) => module.id === "cornell");
  assert.match(buttons[cornellIndex].cls, /is-off/);
  const cornellState = all(buttons[cornellIndex]).find((el) => String(el.cls).includes("qt-module-link-state"));
  assert.equal(cornellState.text, "Off");
  buttons[cornellIndex].listeners.click[0]();
  assert.deepEqual(opened, ["cornell"]);

  for (const module of MODULES) {
    assert.ok(!obsidian.settingNames.includes(module.label), `${module.id} is not a Global toggle`);
  }
  for (const removed of [
    "Record inline quiz attempts",
    "Portable card archive",
    "Course note templates",
    "Lecture note compiler",
    "PDF annotation index",
    "Feynman AI scoring",
    "Course hub",
    "SFC-style card blocks",
    "Quiz Maker blocks",
    "SAT math solver",
    "CBT exam blocks",
  ]) {
    assert.ok(!obsidian.settingNames.includes(removed), `${removed} is not on Global`);
  }
  for (const core of ["MCQ Tracker", "Cards and vocabulary", "Calendar", "Assignments", "Reference"]) {
    assert.ok(obsidian.settingNames.includes(core), `${core} stays on Global`);
  }
  assert.ok(!obsidian.settingNames.includes("AI features"), "AI has one home on its own page, not a duplicate Global switch");

  const details = all(host).filter((el) => el.tag === "details");
  assert.equal(details.length, 2, "study tools and advanced options are disclosures");
  for (const disclosure of details) {
    assert.equal(disclosure.attrs.open, undefined, "advanced groups start collapsed");
  }
  assert.ok(
    all(host).some((el) => String(el.cls).includes("qt-settings-disclosure-title") && el.text === "Study tools"),
    "the study-tool index is behind its own summary"
  );
});

test("global settings: an already-disabled tool stays disabled and keeps its state", async () => {
  const plugin = await setup({
    cornellNotes: { enabled: false },
    recallScheduler: { enabled: false, mode: "fragments", limit: 7 },
  });
  assert.equal(plugin.cornellNotesEnabled(), false);
  assert.equal(plugin.recallSchedulerEnabled(), false);
  const rows = T.settingsGlobal.studyToolOverview(plugin);
  assert.equal(rows.find((row) => row.id === "cornell").enabled, false);
  assert.equal(rows.find((row) => row.id === "recall-scheduler").enabled, false);
  assert.equal(T.studyWorkspace.normalizeRecallScheduler(plugin.settings.recallScheduler).limit, 7);

  const page = STS.STUDY_TOOL_SETTINGS_BY_ID.cornell.page;
  page.enable(plugin, true);
  await plugin.save();
  const reloaded = await setup(plugin.saved);
  assert.equal(reloaded.cornellNotesEnabled(), true);
  assert.equal(reloaded.recallSchedulerEnabled(), false, "the other saved state is untouched");
});

test("study tool pages: fields reach the real consumers", async () => {
  const plugin = await setup();

  await pageField("read-aloud", "Speech rate").set(plugin, 1.7);
  assert.equal(T.readAloud.buildReadAloudPlan("One. Two.", plugin.settings.readAloud).rate, 1.7);

  await pageField("scheduler-fit", "Minimum review samples").set(plugin, 33);
  assert.equal(plugin.schedulerFitReport().minSamples, 33);

  const nudgePage = STS.STUDY_TOOL_SETTINGS_BY_ID["study-nudge"].page;
  nudgePage.enable(plugin, true);
  await pageField("study-nudge", "Earliest hour").set(plugin, 10);
  await pageField("study-nudge", "Quiet hours start").set(plugin, 22);
  await pageField("study-nudge", "Quiet hours end").set(plugin, 7);
  const counts = { questions: 2, cards: 0, tasks: 0 };
  assert.equal(T.studyNudge.nudgeState(plugin.settings.studyNudge, counts, new Date(2026, 10, 2, 11, 0, 0)).visible, true);
  await pageField("study-nudge", "Quiet hours start").set(plugin, 9);
  await pageField("study-nudge", "Quiet hours end").set(plugin, 12);
  assert.equal(T.studyNudge.nudgeState(plugin.settings.studyNudge, counts, new Date(2026, 10, 2, 11, 0, 0)).visible, false);

  await pageField("course-health", "Attendance threshold (%)").set(plugin, 60);
  const view = new T.StudyWorkspaceView({ app: plugin.app }, plugin);
  assert.equal(view.settings().courseHealth.attendanceThreshold, 60);

  await pageField("lecture-notes", "Output folder").set(plugin, "Wiring lecture notes");
  await plugin.saveCompiledLectureNote({ fileTitle: "Wiring check", markdown: "# Wiring check" });
  assert.ok(
    plugin.app.files.some((file) => file.path === "Wiring lecture notes/Wiring check.md"),
    "the compiled note lands in the configured folder"
  );

  const attemptField = pageField("quiz-index", "Record inline quiz attempts");
  await attemptField.set(plugin, true);
  assert.equal(T.studyWorkspace.normalizeQuizIndex(plugin.settings.quizIndex).recordAttempts, true);
});

test("recall scheduler: the page mode is the mode the tab starts with", async () => {
  const plugin = await setup({ recallScheduler: { enabled: true, mode: "fragments" } });
  const host = fakeEl("div");
  const view = new T.StudyWorkspaceView({ app: plugin.app }, plugin);
  view.renderRecall(host);
  const select = all(host).find((el) => el.tag === "select");
  assert.ok(select, "the mode select rendered");
  const fragments = all(select).find((el) => el.text === "Knowledge fragments");
  assert.ok(fragments, "the fragments option exists");
  assert.equal(fragments.selected, true, "the saved fragments mode is selected");
});
