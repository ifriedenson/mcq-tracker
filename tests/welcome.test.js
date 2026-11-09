"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const welcome = T.welcome;

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("welcome: presets cover the seven starting points and describe their modules", () => {
  assert.equal(welcome.WELCOME_PRESETS.length, 7);
  assert.deepEqual(welcome.WELCOME_PRESETS.map((p) => p.id), ["ap", "sat", "university", "language", "stem", "flashcards", "off"]);
  const byId = Object.fromEntries(welcome.WELCOME_PRESETS.map((preset) => [preset.id, preset]));
  for (const preset of welcome.WELCOME_PRESETS) {
    assert.ok(preset.description.length > 20);
    for (const key of ["mcq", "cards", "calendar", "assignments", "ai", "reference"]) assert.equal(typeof preset.modules[key], "boolean");
  }
  assert.match(welcome.moduleSummary(byId.university.modules), /MCQ Tracker, Cards, Calendar, Assignments/);
  assert.equal(welcome.moduleSummary(byId.off.modules), "All modules off");
  assert.deepEqual(welcome.WELCOME_PRESETS.filter((preset) => preset.adaptive === true).map((preset) => preset.id), ["ap", "sat", "university", "stem"]);
  assert.deepEqual(welcome.WELCOME_PRESETS.filter((preset) => preset.adaptiveFrequency === true).map((preset) => preset.id), ["ap", "university", "language", "flashcards"]);
  assert.equal(byId.ap.modules.reference, true, "the AP setup includes AP resources and the score estimator");
  assert.equal(byId.ap.modules.ai, false, "the AP setup leaves AI optional");
  assert.match(byId.ap.description, /AP resources/);
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

test("welcome: a first enable in an already-ready workspace creates and opens one Start here note", async () => {
  const original = global.activeWindow.setTimeout;
  const timers = [];
  global.activeWindow.setTimeout = (fn, ms) => {
    timers.push({ fn, ms });
    return timers.length;
  };
  try {
    const app = makeApp([]);
    let readyCalls = 0;
    app.workspace.onLayoutReady = (callback) => {
      readyCalls += 1;
      callback();
    };
    const before = obsidian.modals.length;
    const plugin = new QT(app);
    await plugin.onload();

    assert.equal(readyCalls, 1, "the plugin uses Obsidian's layout-ready hook");
    assert.equal(obsidian.modals.length, before, "the first run does not pop up");
    const scheduled = timers.find((timer) => timer.ms === 1200);
    assert.ok(scheduled, "the first-run note is scheduled");
    await scheduled.fn();

    const note = app.created.find((entry) => entry.path === welcome.WELCOME_NOTE_PATH);
    assert.ok(note, "one Start here note is written");
    assert.match(note.text, /# Start here with MCQ Tracker/);
    assert.match(note.text, /New to Obsidian in five minutes/);
    assert.match(note.text, /AP student path/);
    assert.match(note.text, /Make this guide better/);
    assert.equal(app.opened.at(-1), welcome.WELCOME_NOTE_PATH, "the note opens in the main workspace");
    assert.equal(obsidian.modals.length, before, "the first run is a note, not a popup");
    assert.equal(welcome.welcomeShouldShow(app), false, "opening the note marks the first run as seen");
  } finally {
    global.activeWindow.setTimeout = original;
  }
});

test("welcome: the Start here note teaches Obsidian and gives every experience level a path", () => {
  const text = welcome.welcomeNoteMarkdown();
  for (const needle of [
    "Pick your path",
    "New to Obsidian in five minutes",
    "A vault is a folder",
    "command palette",
    "Settings → Global → Modules",
    "AP student path",
    "AP courses",
    "Open AP resources",
    "AP: import free-response questions from a PDF",
    "Obsidian user path",
    "Power-user shortcuts",
    "obsidian://mcq-tracker-quick?minutes=10",
    "Open Start here note",
    "Make this guide better",
  ]) assert.ok(text.includes(needle), `the note mentions ${needle}`);
});

test("welcome: the Start here note says which parts need AI and which do not", () => {
  const text = welcome.welcomeNoteMarkdown();
  assert.match(text, /## What needs AI, and what does not/);
  assert.match(text, /Turning a PDF into questions needs AI/);
  assert.match(text, /no offline PDF-to-question converter/i);
  assert.ok(text.includes("**Direct AI**"), "the note names the provider-key path");
  assert.ok(text.includes("**OpenCode agent**"), "the note names the desktop agent path");
  assert.ok(text.includes("| Works with AI off | Needs AI turned on"), "the note splits local work from AI work");
  assert.ok(text.includes("Writing question notes by hand"), "manual questions are listed as local");
  assert.ok(text.includes("AP resources and the unofficial AP score calculator"), "AP reference tools are listed as local");
  assert.match(text, /Bring in one small batch of practice[\s\S]*?This step needs AI/, "the AP path warns before the import");
  assert.match(text, /An import says to turn on AI/);
});

test("welcome: every command the Start here note tells you to run exists", async () => {
  const { plugin } = await setup();
  const text = welcome.welcomeNoteMarkdown();
  const names = [
    "Open welcome guide",
    "Open Start here note",
    "Open AP resources",
    "Open AP score calculator",
    "Exams: add an exam",
    "Import questions from a file (PDF, PowerPoint, Word)",
    "AP: import free-response questions from a PDF",
    "AP: create a free-response note",
    "AP: open free-response practice and grader",
    "Open practice view",
    "Open Today",
    "Quick Practice",
  ];
  for (const name of names) {
    assert.ok(text.includes(`**${name}**`), `the note names ${name}`);
    assert.ok(plugin.commands.some((command) => command.name === name), `${name} is a registered command`);
  }
});

test("welcome: the Start here path links point at real headings", () => {
  const text = welcome.welcomeNoteMarkdown();
  const links = [...text.matchAll(/\[\[#([^\]]+)\]\]/g)].map((match) => match[1]);
  assert.ok(links.length >= 4, "the path table links to the four routes");
  for (const link of links) assert.ok(text.includes(`\n## ${link}\n`), `the note has a ${link} heading`);
});

test("welcome: opening the Start here guide again reuses the one note", async () => {
  const { app, plugin } = await setup();
  await plugin.openWelcomeNote();
  const count = () => app.created.filter((entry) => entry.path === welcome.WELCOME_NOTE_PATH).length;
  assert.equal(count(), 1);
  const note = app.files.find((file) => file.path === welcome.WELCOME_NOTE_PATH);
  note.text = "My own edits";
  app.opened.length = 0;

  await plugin.openWelcomeNote();

  assert.equal(count(), 1, "the note is not duplicated");
  assert.equal(note.text, "My own edits", "existing content is not overwritten");
  assert.equal(app.opened.at(-1), welcome.WELCOME_NOTE_PATH);
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

  await plugin.applyWelcomePreset("ap");
  assert.equal(plugin.mcqEnabled(), true);
  assert.equal(plugin.cardsEnabled(), true);
  assert.equal(plugin.calendarEnabled(), true);
  assert.equal(plugin.assignmentsEnabled(), true);
  assert.equal(plugin.referenceEnabled(), true, "the AP preset turns on AP resources and the score calculator");
  assert.equal(plugin.settings.ai.enabled, false, "the AP preset leaves AI off");

  plugin.settings.quickAdaptive = { ...plugin.settings.quickAdaptive, enabled: false };
  await plugin.applyWelcomePreset("sat");
  assert.equal(plugin.settings.quickAdaptive.enabled, true, "a study preset turns adaptive session sizing on");
  assert.match(welcome.WELCOME_PRESETS.find((preset) => preset.id === "sat").description, /adaptive/i);

  plugin.settings.cards.adaptiveFrequency = false;
  await plugin.applyWelcomePreset("university");
  assert.equal(plugin.settings.cards.adaptiveFrequency, true, "a card preset turns adaptive card intervals on");
});

test("welcome: the reopen command opens the guide on demand", async () => {
  const { plugin } = await setup();
  const command = plugin.commands.find((c) => c.id === "open-welcome");
  assert.ok(command, "the command is registered");
  const before = obsidian.modals.length;
  command.callback();
  assert.equal(obsidian.modals.length, before + 1, "the command opens the guide");
  assert.ok(obsidian.modals.at(-1) instanceof T.WelcomeModal);
});

test("welcome: the Start here note command opens and recreates the guide", async () => {
  const { app, plugin } = await setup();
  const command = plugin.commands.find((c) => c.id === "open-welcome-note");
  assert.ok(command, "the command is registered");

  await command.callback();
  assert.equal(app.opened.at(-1), welcome.WELCOME_NOTE_PATH);
  const created = app.created.filter((entry) => entry.path === welcome.WELCOME_NOTE_PATH).length;
  assert.equal(created, 1);

  const note = app.files.find((file) => file.path === welcome.WELCOME_NOTE_PATH);
  app.files.splice(app.files.indexOf(note), 1);
  await command.callback();
  assert.equal(app.created.filter((entry) => entry.path === welcome.WELCOME_NOTE_PATH).length, created + 1, "the command recreates a deleted guide");
  assert.equal(app.opened.at(-1), welcome.WELCOME_NOTE_PATH);
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
