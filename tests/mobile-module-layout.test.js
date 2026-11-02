"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

const byClass = (dom, cls) => dom.all.filter((el) => el.classes && el.classes.has(cls));

async function mount(View) {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new View({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  await view.onOpen();
  return { app, plugin, dom, view };
}

test("cards: the phone summary is pending-aware and keeps every stat in the grid", async () => {
  const note = {
    path: "Cards/test-card.md",
    noFm: true,
    fm: { card_id: "test-card", item_type: "card", deck: "Biology" },
    text: "---\ncard_id: test-card\nitem_type: card\ndeck: Biology\n---\n\n## Front\nWhat is a cell?\n\n## Back\nThe basic unit of life.\n",
  };
  const app = makeApp([note]);
  app.files[0].fm = { ...note.fm };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards = T.cards.mergeCardSettings({
    enabled: true,
    newCardFolder: "Cards",
    defaultDeck: "General",
    reviewLimit: 20,
    order: "due",
    decks: [{ name: "Biology", folder: "Cards", course: "Biology" }],
  });
  plugin.pendingCardGrades = () => [{ path: note.path, front: "What is a cell?" }];
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  const summary = byClass(dom, "qt-cards-stats")[0];
  assert.ok(summary, "the Cards summary renders");
  assert.ok(summary.classes.has("has-pending"), "the summary knows it has a fourth stat");
  assert.equal(summary.children.length, 4);
});

test("study tools: the phone summary and tab layout expose a scoped card action", async () => {
  const { dom } = await mount(T.StudyToolsView);
  assert.equal(byClass(dom, "qt-study-tools-view-wrap").length, 1, "the view has its own wrap class");
  assert.equal(byClass(dom, "qt-study-tab").length, 4, "all four Study Tools tabs remain in the DOM");
  const action = dom.all.find((el) => el.meta.tag === "button" && el.meta.text === "Set a goal");
  assert.ok(action, "the empty Study goals card renders its action");
  assert.ok(action.classes.has("qt-study-card-action"), "the action opts into the touch-sized phone treatment");
});

test("study workspace: every section is available in the phone picker", async () => {
  const { dom } = await mount(T.StudyWorkspaceView);
  assert.equal(byClass(dom, "qt-study-workspace-wrap").length, 1);
  const nav = byClass(dom, "qt-workspace-tabs")[0];
  assert.ok(nav, "the desktop tab rail remains in the DOM");
  const picker = byClass(dom, "qt-workspace-picker")[0];
  assert.ok(picker, "the phone picker is mounted beside the rail");
  const select = picker.children.find((el) => el.meta.tag === "select");
  const options = select.children.filter((el) => el.meta.tag === "option");
  assert.ok(options.length >= 10, "the picker lists every enabled section");
  assert.ok(options.some((el) => el.meta.text === "Feynman"));
  assert.equal((select.meta.attrs || select.meta.attr)["aria-label"], "Study Workspace section");
});

test("pomodoro: reset and skip are explicit secondary controls", async () => {
  const { dom } = await mount(T.PomodoroView);
  const secondary = byClass(dom, "qt-pomodoro-secondary").filter((el) => el.meta.tag === "button");
  assert.deepEqual(secondary.map((el) => el.meta.text), ["Reset", "Skip phase"]);
});

test("assignments: first run is one onboarding panel with the only add action", async () => {
  const { dom } = await mount(T.AssignmentsView);
  const addButtons = dom.all.filter((el) => el.meta.tag === "button" && el.meta.text === "Add assignment");
  assert.equal(addButtons.length, 1, "the actions row holds the only add button");
  assert.equal(byClass(dom, "qt-assignment-onboarding").length, 1);
  assert.equal(byClass(dom, "qt-assignment-courses-empty").length, 1, "the first-run panel keeps its empty course landmark");
  assert.equal(byClass(dom, "qt-assignment-gpa").length, 0, "no separate empty GPA card");
  assert.equal(byClass(dom, "qt-assignment-tasks").length, 0, "no separate empty task block");
});

test("phone module contracts are scoped and ordered after the shared rules", () => {
  assert.match(css, /\.qt-today-hero \.qt-today-actions \{[^}]*display: grid/s);
  assert.match(css, /\.qt-today \.qt-progress-window \{[^}]*grid-template-columns: repeat\(3/s);
  assert.match(css, /\.qt-screen \.qt-cards-stats\.has-pending \{[^}]*grid-template-columns: repeat\(2/s);
  assert.match(css, /\.qt-screen \.qt-cards-tools \{[^}]*display: grid/s);
  assert.match(css, /\.qt-screen\.qt-study-tools-view-wrap \.qt-study-tabs \{[^}]*grid-template-columns: repeat\(2/s);
  assert.match(css, /\.qt-screen\.qt-study-tools-view-wrap \.qt-study-stats \{[^}]*grid-template-columns: repeat\(3/s);
  assert.match(css, /\.qt-screen\.qt-study-tools-view-wrap \.qt-study-card > \.qt-study-card-action \{[^}]*min-height: 44px/s);
  assert.match(css, /\.qt-workspace-picker \{\s*display: none;\s*\}/s);
  assert.match(css, /\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-tabs \{[^}]*display: flex/s);
  assert.match(css, /@container qt-screen \(max-width: 760px\) \{[\s\S]*?\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-tabs \{[^}]*display: none/s);
  assert.match(css, /@container qt-screen \(max-width: 760px\) \{[\s\S]*?\.qt-screen\.qt-study-workspace-wrap \.qt-workspace-picker \{[^}]*display: grid/s);
  assert.match(css, /\.qt-screen \.qt-pomodoro-actions \{[^}]*grid-template-columns: repeat\(2/s);
  assert.match(css, /\.qt-screen \.qt-dash-stats > \.qt-dash-stat:last-child:nth-child\(odd\) \{[^}]*grid-column: 1 \/ -1/s);
  assert.match(css, /\.qt-day-agenda-actions \{[^}]*grid-auto-flow: column/s);
  assert.match(css, /\.qt-day-agenda \.qt-day-agenda-list\.is-empty \{[^}]*min-height: 0/s);
  assert.match(css, /\.qt-day-agenda \.qt-day-agenda-list\.is-empty \{[^}]*align-self: stretch/s);
  assert.match(css, /\.qt-ins\.qt-screen \.qt-tabbar \{[^}]*grid-template-columns: repeat\(6/s);
  assert.match(css, /@container qt-screen \(max-width: 360px\) \{[\s\S]*?\.qt-ins\.qt-screen \.qt-tabbar button \{[^}]*font-size/s);
  assert.match(css, /\.qt-assignment-summary \{[^}]*display: flex/s);
  assert.match(css, /\.qt-assignment-overview \{[^}]*grid-template-columns: repeat\(2/s);
  assert.match(css, /\.qt-screen \.qt-assignment-onboarding \{[^}]*padding: 18px 20px/s);
  assert.match(css, /\.qt-screen \.qt-dash-activity \{[^}]*repeat\(4/s);
  assert.match(css, /\.qt-screen \.qt-dash-empty \{[^}]*padding: 20px 22px/s);
  assert.match(css, /\.qt-assignment-actions > \.qt-primary \{[^}]*min-height: 44px/s);
  assert.match(css, /\.qt-screen \.qt-assignment-course-actions > button \{[^}]*min-height: 40px/s);
  assert.match(css, /@container qt-screen \(max-width: 460px\) \{[\s\S]*?\.qt-screen \.qt-assignment-course-actions \{[^}]*repeat\(2/s);
  assert.match(css, /\.qt-screen \.qt-progress-legend \.qt-link \{[^}]*min-height: 40px/s);
  assert.match(css, /@container qt-screen \(min-width: 761px\) \{[\s\S]*?\.qt-assignment-actions > \.qt-primary \{[^}]*width: auto/s);
  assert.match(css, /\.qt-day-agenda \.qt-study-row-actions button \{[^}]*min-height: 40px/s);
  assert.match(css, /\.qt-today \.qt-progress-legend \.qt-link[^{]*\{[^}]*min-height: 40px/s);
  assert.match(css, /\.qt-local-events-tab \{[^}]*min-width: 44px/s);
  assert.match(css, /\.qt-screen\.qt-review-calendar \.qt-study-card[^{]*\{[^}]*min-height: 0/s);
  assert.match(css, /\.qt-study-stats-view \.qt-study-card \{[^}]*min-height: 0/s);
  assert.match(css, /\.qt-screen\.qt-study-stats-view \.qt-study-stats > \.qt-study-stat:last-child:nth-child\(odd\) \{[^}]*grid-column: 1 \/ -1/s);
  assert.match(css, /\.qt-today-grid \{[^}]*align-items: start/s);
  assert.match(css, /\.qt-today-panel > \.qt-today-card \{[^}]*flex: 0 0 auto/s);
  assert.match(css, /\.qt-screen\.qt-pomodoro-view \{[^}]*min-height: 100%/s);
  assert.match(css, /\.qt-today-header \.qt-row \.qt-link \{[^}]*flex: 0 0 auto/s);
});
