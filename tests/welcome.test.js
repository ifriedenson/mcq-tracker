"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const welcome = T.welcome;

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("welcome: presets cover the six starting points and describe their modules", () => {
  assert.equal(welcome.WELCOME_PRESETS.length, 6);
  assert.deepEqual(welcome.WELCOME_PRESETS.map((p) => p.id), ["sat", "university", "language", "stem", "flashcards", "off"]);
  for (const preset of welcome.WELCOME_PRESETS) {
    assert.ok(preset.description.length > 20);
    for (const key of ["mcq", "cards", "calendar", "assignments", "ai", "reference"]) assert.equal(typeof preset.modules[key], "boolean");
  }
  assert.match(welcome.moduleSummary(welcome.WELCOME_PRESETS[1].modules), /MCQ Tracker, Cards, Calendar, Assignments/);
  assert.equal(welcome.moduleSummary(welcome.WELCOME_PRESETS[5].modules), "All modules off");
});

test("welcome: state is local, shows once, remembers completion and dismissal", async () => {
  const { app } = await setup();
  assert.equal(welcome.welcomeShouldShow(app), true);
  assert.deepEqual(welcome.loadWelcomeState(app), { seenVersion: "", dismissed: false, completed: [] });
  welcome.markWelcomeStep(app, "practice");
  assert.deepEqual(welcome.loadWelcomeState(app).completed, ["practice"]);
  welcome.markWelcomeStep(app, "nope");
  assert.deepEqual(welcome.loadWelcomeState(app).completed, ["practice"]);
  welcome.markWelcomeSeen(app, "1.28.0");
  assert.equal(welcome.welcomeShouldShow(app), false);
  assert.equal(welcome.loadWelcomeState(app).seenVersion, "1.28.0");
  assert.equal(welcome.loadWelcomeState(app).dismissed, true);
});

test("welcome: applying a preset changes the real module settings", async () => {
  const { plugin } = await setup();
  await plugin.applyWelcomePreset("university");
  assert.equal(plugin.mcqEnabled(), true);
  assert.equal(plugin.cardsEnabled(), true);
  assert.equal(plugin.calendarEnabled(), true);
  assert.equal(plugin.assignmentsEnabled(), true);
  assert.equal(plugin.referenceEnabled(), false);
  assert.equal(plugin.settings.ai.enabled, false);

  await plugin.applyWelcomePreset("stem");
  assert.equal(plugin.cardsEnabled(), false);
  assert.equal(plugin.assignmentsEnabled(), true);
  assert.equal(plugin.referenceEnabled(), true);

  await plugin.applyWelcomePreset("off");
  assert.equal(plugin.assignmentsEnabled(), false, "Everything off turns Assignments off too");

  await plugin.setWelcomeModule("cards", true);
  assert.equal(plugin.cardsEnabled(), true);
  assert.equal(plugin.welcomeModuleOn("cards"), true);
  await plugin.setWelcomeModule("ai", true);
  assert.equal(plugin.settings.ai.enabled, true);
});

test("welcome: the reopen command is registered", async () => {
  const { plugin } = await setup();
  assert.ok(plugin.commands.some((c) => c.id === "open-welcome"));
});
