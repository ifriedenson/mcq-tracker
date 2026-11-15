"use strict";
/*
 * Focus day gaps from the Deadline comparison: a month calendar whose day
 * click creates or opens that date's daily note, inline Pomodoro duration
 * edits, a break-coloured progress bar, and one pane combining the calendar,
 * the timer and a session scratch task list.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

function viewOf(plugin) {
  const dom = makeDom();
  const view = new T.FocusDayView({ app: plugin.app }, plugin);
  view.contentEl = dom.root;
  return { dom, view };
}

test("focus day: November 2026 starts on a Monday-first grid with six blanks", () => {
  // 2026-11-01 is a Sunday, so six leading blanks precede 30 day cells.
  const cells = T.focusDay.focusMonthGrid(2026, 10, "2026-11-15");
  assert.equal(cells.length, 36);
  assert.ok(cells.slice(0, 6).every((cell) => cell.blank));
  assert.equal(cells[6].label, "1");
  assert.equal(cells[6].key, "2026-11-01");
  assert.equal(cells[35].key, "2026-11-30");
  assert.equal(cells.find((cell) => cell.key === "2026-11-15").today, true);
  assert.equal(cells.find((cell) => cell.key === "2026-11-16").today, false);
  assert.equal(T.focusDay.focusMonthLabel(2026, 10), "November 2026");
});

test("focus day: month shifts cross year boundaries", () => {
  assert.deepEqual(T.focusDay.shiftFocusMonth(2026, 0, -1), { year: 2025, month: 11 });
  assert.deepEqual(T.focusDay.shiftFocusMonth(2026, 11, 1), { year: 2027, month: 0 });
});

test("focus day: date keys reject overflow and junk", () => {
  assert.equal(T.focusDay.validFocusDateKey("2026-11-15"), "2026-11-15");
  assert.equal(T.focusDay.validFocusDateKey("2026-13-01"), "");
  assert.equal(T.focusDay.validFocusDateKey("2026-02-30"), "");
  assert.equal(T.focusDay.validFocusDateKey("tomorrow"), "");
  assert.equal(T.focusDay.focusDateKey(2026, 10, 15), "2026-11-15");
});

test("focus day: daily-note paths default to the vault root and refuse escapes", () => {
  assert.equal(T.focusDay.focusDailyNotePath("2026-11-15", ""), "2026-11-15.md");
  assert.equal(T.focusDay.focusDailyNotePath("2026-11-15", "Daily notes"), "Daily notes/2026-11-15.md");
  assert.equal(T.focusDay.focusDailyNotePath("2026-11-15", "../Outside"), "");
  assert.equal(T.focusDay.focusDailyNotePath("junk", ""), "");
  const template = T.focusDay.focusDailyNoteTemplate("2026-11-15");
  assert.match(template, /^# 2026-11-15/m);
  assert.match(template, /^## Schedule$/m);
});

test("focus day: session tasks add, toggle and delete without touching notes", () => {
  let tasks = T.focusDay.addFocusTask([], "  ", "a");
  assert.deepEqual(tasks, []);
  tasks = T.focusDay.addFocusTask(tasks, "Read chapter 2", "a");
  tasks = T.focusDay.addFocusTask(tasks, "Drill verbs", "b");
  assert.equal(tasks.length, 2);
  tasks = T.focusDay.toggleFocusTask(tasks, "a");
  assert.equal(tasks.find((task) => task.id === "a").done, true);
  tasks = T.focusDay.deleteFocusTask(tasks, "a");
  assert.deepEqual(tasks.map((task) => task.id), ["b"]);
});

test("focus day: opening a day creates the note from the template and reopens it", async () => {
  const { app, plugin } = await setup();
  const first = await plugin.openDailyNote("2026-11-15");
  assert.deepEqual(first, { path: "2026-11-15.md", created: true });
  assert.ok(app.created.some((row) => row.path === "2026-11-15.md" && row.text.startsWith("# 2026-11-15")));
  const second = await plugin.openDailyNote("2026-11-15");
  assert.deepEqual(second, { path: "2026-11-15.md", created: false });
  assert.deepEqual(app.opened, ["2026-11-15.md", "2026-11-15.md"]);
  assert.equal(await plugin.openDailyNote("not-a-date"), null);
});

test("focus day: durations save clamped and reset a paused timer", async () => {
  const { plugin } = await setup();
  await plugin.setPomodoroDurations({ workMinutes: 0, shortBreakMinutes: 999, longBreakMinutes: "x" });
  const settings = plugin.settings.pomodoro;
  assert.equal(settings.workMinutes, 1);
  assert.equal(settings.shortBreakMinutes, 180);
  assert.equal(settings.longBreakMinutes, 15);
  assert.equal(settings.state.remainingSec, 60);
});

test("focus day: the running timer keeps its remaining time through a duration edit", async () => {
  const { plugin } = await setup();
  await plugin.startPomodoro();
  await plugin.setPomodoroDurations({ workMinutes: 40 });
  assert.equal(plugin.settings.pomodoro.workMinutes, 40);
  assert.ok(plugin.settings.pomodoro.state.remainingSec > 1400);
});

test("focus day: the pane shows the calendar, the timer and the scratch list", async () => {
  const { plugin } = await setup();
  const { dom, view } = viewOf(plugin);
  await view.onOpen();
  assert.ok(dom.texts().includes("Calendar"));
  assert.ok(dom.texts().includes("Pomodoro"));
  assert.ok(dom.texts().includes("Quick tasks"));
  assert.ok(dom.texts().includes("November 2026") || dom.texts().some((text) => /20\d\d/.test(text)));
  assert.ok(dom.all.some((o) => o.classes.has("is-today")), "today is highlighted");
  assert.ok(dom.all.some((o) => o.classes.has("qt-focus-empty")), "the empty task message shows");
  const adjust = dom.all.filter((o) => o.meta.tag === "button" && o.meta.text === "Adjust");
  assert.equal(adjust.length, 1);
  view.adjusting = true;
  view.render();
  assert.ok(dom.all.some((o) => o.meta.tag === "input" && o.meta.attr && o.meta.attr["aria-label"] === "Focus minutes"));
});

test("focus day: break phases colour the progress bar differently", async () => {
  const { plugin } = await setup();
  const { dom, view } = viewOf(plugin);
  await view.onOpen();
  plugin.settings.pomodoro.state = { ...plugin.settings.pomodoro.state, phase: "short", remainingSec: 150, running: false, startedAt: 0 };
  view.render();
  const fills = dom.all.filter((o) => o.classes.has("qt-focus-progress-fill"));
  assert.ok(fills[fills.length - 1].classes.has("is-break"));
});

test("focus day: the pomodoro view edits durations inline and marks break fills", async () => {
  const { plugin } = await setup();
  const dom = makeDom();
  const view = new T.PomodoroView({ app: plugin.app }, plugin);
  view.contentEl = dom.root;
  await view.onOpen();
  view.adjusting = true;
  view.render();
  assert.ok(dom.all.some((o) => o.meta.tag === "input" && o.meta.attr && o.meta.attr["aria-label"] === "Short break minutes"));
  plugin.settings.pomodoro.state = { ...plugin.settings.pomodoro.state, phase: "long", remainingSec: 100, running: false, startedAt: 0 };
  view.adjusting = false;
  view.render();
  const fills = dom.all.filter((o) => o.classes.has("qt-pomodoro-progress-fill"));
  assert.ok(fills[fills.length - 1].classes.has("is-break"));
});

test("focus day: the command is registered and opens through the module view", async () => {
  const { plugin } = await setup();
  const command = plugin.commands.find((entry) => entry.id === "open-focus-day");
  assert.ok(command, "Open Focus day is registered");
  assert.equal(typeof plugin.activateFocusDay, "function");
});

test("focus day: a ribbon button opens the pane like every module view", async () => {
  const { plugin } = await setup();
  const ribbon = [];
  plugin.addRibbonIcon = (icon, title, onClick) => {
    ribbon.push({ icon, title, onClick });
    return { remove() {} };
  };
  plugin.ribbonAdded = {};
  plugin.ribbonButtons = {};
  plugin.refreshRibbon();
  assert.ok(ribbon.some((item) => item.icon === "calendar-days" && item.title === "Open Focus day"));
});

test("focus day: opening a day confirms, then the note reopens", async () => {
  const { plugin } = await setup();
  const dom = makeDom();
  const view = new T.FocusDayView({ app: plugin.app }, plugin);
  view.contentEl = dom.root;
  await view.onOpen();
  const first = await view.openDay("2026-11-15");
  assert.equal(first.created, true);
  assert.ok(dom.texts().includes("Created 2026-11-15.md."));
  const second = await view.openDay("2026-11-15");
  assert.equal(second.created, false);
  assert.ok(dom.texts().includes("Opened 2026-11-15.md."));
});
