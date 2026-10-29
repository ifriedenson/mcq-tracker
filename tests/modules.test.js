"use strict";
// Global settings: the module switches and the plugin-wide options.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();

const NOTES = [{ path: "Questions/Q1.md", fm: { answer: "B" } }];

async function setup(saved) {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  if (saved) plugin.saved = saved; // the stand-in loadData() returns this
  await plugin.onload();
  obsidian.notices.length = 0;
  return { app, plugin };
}

test("settings: Global sits beside MCQ Tracker, Cards and Calendar and has its own tabs", () => {
  assert.deepEqual(T.SETTINGS_MODULES.map((m) => m.id), ["global", "mcq", "cards", "calendar"]);
  assert.deepEqual(T.GLOBAL_TABS.map((t) => t.id), ["modules", "general"]);
  assert.deepEqual(T.GLOBAL_TABS.map((t) => t.label), ["Modules", "General"]);
  assert.deepEqual(T.CARDS_TABS.map((t) => t.id), ["decks", "review", "about"]);
});

test("modules: MCQ Tracker is on by default, Calendar and AI are opt-in", async () => {
  const { plugin } = await setup();
  assert.equal(plugin.mcqEnabled(), true);
  assert.equal(plugin.calendarEnabled(), false);
  assert.equal(plugin.cardsEnabled(), false, "Cards is opt-in");
  assert.equal(plugin.settings.ai.enabled, false);
  assert.equal(plugin.settings.showRibbonIcons, true);
  assert.equal(plugin.settings.openPracticeOnStartUp, false);
});

test("modules: saved switches survive a reload and odd values fall back to defaults", async () => {
  const saved = await setup({ mcqEnabled: false, showRibbonIcons: "maybe", openPracticeOnStartUp: "yes" });
  assert.equal(saved.plugin.mcqEnabled(), false);
  assert.equal(saved.plugin.settings.showRibbonIcons, true);
  assert.equal(saved.plugin.settings.openPracticeOnStartUp, false);

  const on = await setup({ mcqEnabled: "no", openPracticeOnStartUp: true });
  assert.equal(on.plugin.mcqEnabled(), true, "only an explicit false turns the module off");
  assert.equal(on.plugin.settings.openPracticeOnStartUp, true);
});

test("modules: with MCQ Tracker off its entry points point back at Global settings", async () => {
  const { plugin } = await setup();
  plugin.settings.mcqEnabled = false;

  assert.equal(await plugin.activateView(), null, "no practice view is opened");
  assert.ok(obsidian.notices.some((n) => /MCQ Tracker module is off/.test(n)));
  assert.ok(obsidian.notices.some((n) => /Settings/.test(n)), "and the settings are offered");

  obsidian.notices.length = 0;
  await plugin.activateInsights("weak");
  await plugin.activateTest();
  plugin.openPdfImport();
  assert.equal(obsidian.notices.filter((n) => /MCQ Tracker module is off/.test(n)).length, 3);
  assert.ok(!obsidian.notices.some((n) => /Turn on AI features/.test(n)), "PDF import stops at the module switch");
});

test("settings: scheduler defaults to the ladder and saved values are bounded", async () => {
  const { plugin } = await setup();
  assert.equal(plugin.settings.scheduler, "ladder");
  assert.equal(plugin.settings.fsrsRetention, 0.9);

  const bad = await setup({ scheduler: "something-else", fsrsRetention: 2 });
  assert.equal(bad.plugin.settings.scheduler, "ladder");
  assert.equal(bad.plugin.settings.fsrsRetention, 0.95);
});

test("modules: an already-open practice tab says the module is off", async () => {
  const { app, plugin } = await setup();
  plugin.settings.mcqEnabled = false;
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().some((t) => /MCQ Tracker is off/.test(t)));
  assert.ok(!dom.texts().some((t) => /No questions yet/.test(t)), "the first-run screen stays out of the way");
});

test("modules: Cards is opt-in, and switching it off closes its tab", async () => {
  const { app, plugin } = await setup();
  const detached = [];
  app.workspace.detachLeavesOfType = (type) => detached.push(type);
  assert.equal(plugin.cardsEnabled(), false);
  await plugin.onCardsToggled();
  assert.deepEqual(detached, ["question-tracker-cards"]);

  plugin.settings.cards.enabled = true;
  await plugin.onCardsToggled();
  assert.deepEqual(detached, ["question-tracker-cards"], "turning it on closes nothing");
  plugin.settings.cards.enabled = false;
  await plugin.onCardsToggled();
  assert.deepEqual(detached, ["question-tracker-cards", "question-tracker-cards"]);
});

test("modules: turning a module off closes its tabs, and on brings them back", async () => {
  const { app, plugin } = await setup();
  const detached = [];
  app.workspace.detachLeavesOfType = (type) => detached.push(type);

  await plugin.onCalendarToggled();
  assert.deepEqual(detached, ["question-tracker-calendar"], "an off calendar closes its own tab only");

  detached.length = 0;
  plugin.settings.mcqEnabled = false;
  await plugin.onMcqToggled();
  assert.equal(detached.length, 4, "today, practice, weak spots and timed test tabs");
  assert.ok(!detached.includes("question-tracker-calendar"), "the calendar is untouched");

  detached.length = 0;
  plugin.settings.calendar.enabled = true;
  await plugin.onCalendarToggled();
  assert.deepEqual(detached, [], "an enabled calendar stays open");
  assert.equal(plugin.calendarEnabled(), true);

  plugin.settings.mcqEnabled = true;
  await plugin.onMcqToggled();
  assert.equal(plugin.mcqEnabled(), true);
  assert.deepEqual(detached, [], "turning the module back on closes nothing");
});
