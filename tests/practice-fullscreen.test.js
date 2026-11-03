"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const F = T.practiceFullscreen;
const CLASS = F.PRACTICE_FULLSCREEN_CLASS;
const body = makeDom().root;
body.addClass("is-mobile");
global.document = { body };

const notes = [{ path: "Questions/fullscreen.md", fm: { answer: "B", choices: 4 } }];

test.after(() => {
  F.setPracticeFullscreen(null, false);
  delete global.document;
});

function viewFor(app, plugin) {
  const leaf = { app };
  const view = new T.PracticeView(leaf, plugin);
  view.app = app;
  leaf.view = view;
  return { leaf, view };
}

test("the body class only applies while a question or result is active", () => {
  assert.equal(F.practiceSessionActive("question"), true);
  assert.equal(F.practiceSessionActive("result"), true);
  assert.equal(F.practiceSessionActive("idle"), false);
  assert.equal(F.practiceSessionActive("study"), false);
  assert.equal(F.shouldHidePracticeChrome({ enabled: true, isMobile: true, active: true }), true);
  assert.equal(F.shouldHidePracticeChrome({ enabled: false, isMobile: true, active: true }), false);
  assert.equal(F.shouldHidePracticeChrome({ enabled: true, isMobile: false, active: true }), false);
  assert.equal(F.shouldHidePracticeChrome({ enabled: true, isMobile: true, active: false }), false);
});

test("the body class toggle is idempotent and desktop stays untouched", () => {
  F.setPracticeFullscreen({ body }, true);
  F.setPracticeFullscreen({ body }, true);
  assert.equal(body.classList.contains(CLASS), true);
  F.setPracticeFullscreen({ body }, false);
  F.setPracticeFullscreen({ body }, false);
  assert.equal(body.classList.contains(CLASS), false);

  body.removeClass("is-mobile");
  assert.equal(F.isMobileDocument({ body }), false);
  F.setPracticeFullscreen({ body }, true);
  assert.equal(body.classList.contains(CLASS), true, "the helper itself is selector-neutral");
  body.addClass("is-mobile");
  F.setPracticeFullscreen({ body }, false);
});

test("the plugin adds the class for the active practice view and removes it on idle", async () => {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  const { leaf, view } = viewFor(app, plugin);
  app.workspace.activeLeaf = leaf;

  view.state = "question";
  plugin.syncPracticeFullscreen(view);
  assert.equal(body.classList.contains(CLASS), true);

  view.state = "result";
  plugin.syncPracticeFullscreen(view);
  assert.equal(body.classList.contains(CLASS), true, "the result screen keeps the chrome hidden");

  view.state = "idle";
  plugin.syncPracticeFullscreen(view);
  assert.equal(body.classList.contains(CLASS), false, "returning to filters restores the chrome");
});

test("switching to another leaf removes the class and returning restores it", async () => {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  const { leaf, view } = viewFor(app, plugin);
  app.workspace.activeLeaf = leaf;
  view.state = "question";
  plugin.syncPracticeFullscreen(view);
  assert.equal(body.classList.contains(CLASS), true);

  app.workspace.activeLeaf = { view: { getViewType: () => "markdown" } };
  plugin.syncPracticeFullscreen(view);
  assert.equal(body.classList.contains(CLASS), false, "a normal note must show the normal chrome");

  app.workspace.activeLeaf = leaf;
  plugin.syncPracticeFullscreen();
  assert.equal(body.classList.contains(CLASS), true, "the active-leaf event restores it");
});

test("the setting defaults on, persists off and applies immediately", async () => {
  const app = makeApp(notes);
  const fresh = new QT(app);
  await fresh.loadSettings();
  assert.equal(fresh.settings.distractionFreePractice, true);

  fresh.saved = { distractionFreePractice: false };
  await fresh.loadSettings();
  assert.equal(fresh.settings.distractionFreePractice, false);

  const plugin = new QT(app);
  await plugin.onload();
  const { leaf, view } = viewFor(app, plugin);
  app.workspace.activeLeaf = leaf;
  view.state = "question";
  plugin.settings.distractionFreePractice = false;
  plugin.syncPracticeFullscreen(view);
  assert.equal(body.classList.contains(CLASS), false);
});

test("closing, unloading and reloading all clear the body class", async () => {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  const { leaf, view } = viewFor(app, plugin);
  app.workspace.activeLeaf = leaf;
  view.state = "question";
  plugin.syncPracticeFullscreen(view);
  assert.equal(body.classList.contains(CLASS), true);
  await view.onClose();
  assert.equal(body.classList.contains(CLASS), false, "closing the practice view restores the chrome");

  view._practiceFullscreenClosed = false;
  plugin.syncPracticeFullscreen(view);
  assert.equal(body.classList.contains(CLASS), true);
  plugin.onunload();
  assert.equal(body.classList.contains(CLASS), false, "unloading the plugin restores the chrome");

  F.setPracticeFullscreen(null, true);
  const restarted = new QT(app);
  await restarted.onload();
  assert.equal(body.classList.contains(CLASS), false, "a fresh plugin load clears a stale class");
});

test("closing an inactive practice view does not clear a different active practice view", async () => {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  const first = viewFor(app, plugin);
  const second = viewFor(app, plugin);
  app.workspace.activeLeaf = first.leaf;
  first.view.state = "question";
  second.view.state = "question";
  plugin.syncPracticeFullscreen(first.view);
  assert.equal(body.classList.contains(CLASS), true);

  await second.view.onClose();
  assert.equal(body.classList.contains(CLASS), true, "the active practice view still owns the class");
});

test("the stylesheet scopes the hidden header and mobile navbar to mobile practice", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  assert.match(css, /body\.is-mobile\.mcq-practice-mode \.mobile-navbar\b/);
  assert.match(css, /body\.is-mobile\.mcq-practice-mode \.mobile-navbar-actions/);
  assert.match(css, /body\.is-mobile\.mcq-practice-mode \.workspace-leaf-content\[data-type="question-tracker-view"\] \.view-header/);
  assert.match(css, /data-type="question-tracker-view"\] \.view-header[\s\S]*?display: none;/);
  assert.equal(css.includes("!important"), false, "release scanner: no !important");
  assert.match(css, /data-type="question-tracker-view"\] \.view-content[\s\S]*?padding-top: env\(safe-area-inset-top\)/);
  assert.doesNotMatch(css, /^\s*\.mobile-navbar\s*\{/m, "the navbar is never hidden globally");
});
