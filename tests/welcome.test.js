"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

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
  assert.deepEqual(welcome.WELCOME_PRESETS.filter((preset) => preset.adaptive === true).map((preset) => preset.id), ["sat", "university", "stem"]);
  assert.deepEqual(welcome.WELCOME_PRESETS.filter((preset) => preset.adaptiveFrequency === true).map((preset) => preset.id), ["university", "language", "flashcards"]);
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

  plugin.settings.quickAdaptive = { ...plugin.settings.quickAdaptive, enabled: false };
  await plugin.applyWelcomePreset("sat");
  assert.equal(plugin.settings.quickAdaptive.enabled, true, "a study preset turns adaptive session sizing on");
  assert.match(welcome.WELCOME_PRESETS[0].description, /adaptive/i);

  plugin.settings.cards.adaptiveFrequency = false;
  await plugin.applyWelcomePreset("university");
  assert.equal(plugin.settings.cards.adaptiveFrequency, true, "a card preset turns adaptive card intervals on");
});

test("welcome: the reopen command is registered", async () => {
  const { plugin } = await setup();
  assert.ok(plugin.commands.some((c) => c.id === "open-welcome"));
});

function openWelcomeModal(plugin) {
  const dom = makeDom();
  const modal = new T.WelcomeModal(plugin.app, plugin);
  modal.containerEl = dom.root;
  modal.modalEl = dom.root;
  modal.contentEl = dom.root;
  modal.titleEl = dom.root;
  modal.open();
  return { dom, modal };
}

test("welcome: the quick start has three steps and a real example", () => {
  assert.equal(welcome.WELCOME_SETUP_STEPS.length, 3);
  assert.equal(welcome.WELCOME_EXAMPLE.answer, "B");
  assert.equal(welcome.WELCOME_EXAMPLE.choices.length, 4);
  assert.match(welcome.WELCOME_EXAMPLE.question, /carbon dioxide/i);
  assert.match(welcome.WELCOME_EXAMPLE.explanation, /photosynthesis/i);
});

test("welcome: the example is written as an ordinary question note with a unique path", async () => {
  const { app, plugin } = await setup();
  const first = await plugin.createWelcomeExample();
  assert.equal(first, "Questions/Getting started example.md");
  assert.equal(app.created.length, 1);
  const text = app.created[0].text;
  assert.match(text, /question_id: Getting started example/);
  assert.match(text, /## Question/);
  assert.match(text, /## Answer Choices/);
  assert.match(text, /- B\. It falls because photosynthesis uses carbon dioxide\./);
  assert.match(text, /Correct Answer: B/);
  const second = await plugin.createWelcomeExample();
  assert.equal(second, "Questions/Getting started example 2.md");
});

test("welcome: the example opens Practice limited to the new note", async () => {
  const { plugin } = await setup();
  let planned = null;
  plugin.createWelcomeExample = async () => "Questions/Getting started example.md";
  plugin.getQuestions = () => [{ file: { path: "Questions/Getting started example.md" }, fm: { question_id: "Getting started example" } }];
  plugin.practiceWith = async (filters, mode, options) => {
    planned = { filters, mode, options };
  };
  await plugin.openWelcomeExample();
  assert.equal(planned.mode, "unseen");
  assert.equal(planned.options.practicePath, "Questions/Getting started example.md");
});

test("welcome: the install button installs OpenCode directly and switches the AI backend", async () => {
  const { plugin } = await setup();
  const progress = [];
  let confirmed = false;
  plugin.manager = {
    findBinary: async () => "",
    install: async (say, confirm) => {
      confirmed = await confirm({ tag: "v1.2.3" });
      say("Downloading...");
      return { version: "1.2.3", path: "/tmp/opencode" };
    },
  };
  const result = await plugin.installOpenCodeFromWelcome((message) => progress.push(message));
  assert.equal(confirmed, true);
  assert.equal(result.version, "1.2.3");
  assert.deepEqual(progress, ["Downloading..."]);
  assert.equal(plugin.settings.ai.enabled, true);
  assert.equal(plugin.settings.ai.backend, "opencode");
  assert.equal(plugin.settings.ai.managed, true);
  assert.equal(plugin.settings.ai.autoDeclined, false);
});

test("welcome: an existing OpenCode is reused instead of downloaded again", async () => {
  const { plugin } = await setup();
  let installs = 0;
  plugin.manager = {
    findBinary: async () => "/tmp/opencode",
    install: async () => {
      installs++;
    },
  };
  const result = await plugin.installOpenCodeFromWelcome(() => {});
  assert.equal(result.already, true);
  assert.equal(result.path, "/tmp/opencode");
  assert.equal(installs, 0);
  assert.equal(plugin.settings.ai.enabled, true);
});

test("welcome: the quick start shows the example, direct install and feedback", async () => {
  const { plugin } = await setup();
  let opened = 0;
  plugin.openWelcomeExample = async () => {
    opened++;
  };
  const { dom } = openWelcomeModal(plugin);
  assert.ok(dom.find("Welcome to MCQ Tracker").length);
  assert.ok(dom.find("Try the example question").length);
  assert.ok(dom.find("Install OpenCode").length);
  assert.ok(dom.find("Send feedback").length);
  assert.ok(dom.find("Read the quick start guide").length);
  await dom.click("Try the example question");
  assert.equal(opened, 1);
});

test("welcome: the install button shows progress and the installed state on the screen", async () => {
  const { plugin } = await setup();
  plugin.installOpenCodeFromWelcome = async (say) => {
    say("Downloading OpenCode... 50%");
    return { version: "1.2.3" };
  };
  const { dom } = openWelcomeModal(plugin);
  await dom.click("Install OpenCode");
  assert.ok(dom.find(/Downloading OpenCode/).length === 0, "the final status replaces the progress line");
  assert.ok(dom.find(/OpenCode v1\.2\.3 installed/).length);
  assert.ok(dom.find("Installed").length);
});
