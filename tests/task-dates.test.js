"use strict";
/*
 * Task input understands days: typing "today", "tomorrow" or "Tuesday" in a
 * task sets its due date and the words leave the title. The parser is local
 * and date-only — surveyed MIT plugins (nldates, Task Center, Smart Gantt)
 * lean on chrono or a server-shaped engine, which would blow the startup
 * bundle budget, so the closed set of expressions here is clean-room.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

// 2026-11-15 is a Sunday; every expectation below counts from it.
const REF = "2026-11-15";

test("task dates: relative days resolve from the reference day", () => {
  assert.equal(T.taskDates.parseTaskDate("Practice 8 AP World questions today", REF).date, "2026-11-15");
  assert.equal(T.taskDates.parseTaskDate("do it tonight", REF).date, "2026-11-15");
  assert.equal(T.taskDates.parseTaskDate("do it tomorrow", REF).date, "2026-11-16");
  assert.equal(T.taskDates.parseTaskDate("do it tmr", REF).date, "2026-11-16");
  assert.equal(T.taskDates.parseTaskDate("day after tomorrow", REF).date, "2026-11-17");
  assert.equal(T.taskDates.parseTaskDate("since yesterday", REF).date, "2026-11-14");
});

test("task dates: weekday names pick the upcoming day, next picks next week", () => {
  assert.equal(T.taskDates.parseTaskDate("drill verbs tuesday", REF).date, "2026-11-17");
  assert.equal(T.taskDates.parseTaskDate("drill verbs Tuesday", REF).date, "2026-11-17");
  assert.equal(T.taskDates.parseTaskDate("drill verbs tue", REF).date, "2026-11-17");
  assert.equal(T.taskDates.parseTaskDate("drill verbs this tuesday", REF).date, "2026-11-17");
  assert.equal(T.taskDates.parseTaskDate("drill verbs next tuesday", REF).date, "2026-11-24");
  assert.equal(T.taskDates.parseTaskDate("rest sunday", REF).date, "2026-11-15");
  assert.equal(T.taskDates.parseTaskDate("rest saturday", REF).date, "2026-11-21");
  assert.equal(T.taskDates.parseTaskDate("next week", REF).date, "2026-11-22");
  assert.equal(T.taskDates.parseTaskDate("weekend trip", REF).date, "2026-11-15");
  assert.equal(T.taskDates.parseTaskDate("weekend trip", "2026-11-18").date, "2026-11-21"); // a Wednesday looks to Saturday
  assert.equal(T.taskDates.parseTaskDate("in 3 days", REF).date, "2026-11-18");
  assert.equal(T.taskDates.parseTaskDate("in a week", REF).date, "2026-11-22");
  assert.equal(T.taskDates.parseTaskDate("in 2 weeks", REF).date, "2026-11-29");
});

test("task dates: month days and ISO dates roll to next year when passed", () => {
  assert.equal(T.taskDates.parseTaskDate("quiz on nov 20", REF).date, "2026-11-20");
  assert.equal(T.taskDates.parseTaskDate("quiz dec 1", REF).date, "2026-12-01");
  assert.equal(T.taskDates.parseTaskDate("quiz on jan 5", REF).date, "2027-01-05");
  assert.equal(T.taskDates.parseTaskDate("quiz 2026-11-20", REF).date, "2026-11-20");
  assert.equal(T.taskDates.parseTaskDate("next month", REF).date, "2026-12-15");
});

test("task dates: ordinary words are not dates", () => {
  assert.equal(T.taskDates.parseTaskDate("may need review", REF).date, "");
  assert.equal(T.taskDates.parseTaskDate("review cell respiration", REF).date, "");
  assert.equal(T.taskDates.parseTaskDate("", REF).date, "");
});

test("task dates: the matched words leave the title", () => {
  assert.deepEqual(T.taskDates.extractTaskDue("Practice 8 AP World questions today", REF), {
    title: "Practice 8 AP World questions",
    due: "2026-11-15",
  });
  assert.deepEqual(T.taskDates.extractTaskDue("Read chapter 2 by Friday", "2026-11-12"), {
    title: "Read chapter 2",
    due: "2026-11-13",
  });
  assert.deepEqual(T.taskDates.extractTaskDue("no date here", REF), { title: "no date here", due: "" });
});

test("task dates: adding a study task reads the title when no date was picked", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const task = await plugin.addStudyTask({ title: "Practice 8 AP World questions today" });
  assert.equal(task.due, plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).due);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(task.due), "a real due date is stored");
  assert.ok(!task.title.toLowerCase().includes("today"), "the date word leaves the title");
});

test("task dates: a picked date beats the words in the title", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const task = await plugin.addStudyTask({ title: "Practice tomorrow", due: "2026-12-01" });
  assert.equal(task.due, "2026-12-01");
  assert.ok(task.title.toLowerCase().includes("tomorrow"), "explicit dates leave the title alone");
});

test("task dates: the focus scratchpad dates a task and chips it", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.FocusDayView({ app }, plugin);
  view.contentEl = dom.root;
  const parsed = T.taskDates.extractTaskDue("Read chapter 2 tuesday", REF);
  view.tasks = T.focusDay.addFocusTask([], parsed.title || "Read chapter 2", "x1", parsed.due);
  assert.equal(view.tasks[0].due, "2026-11-17");
  assert.equal(view.tasks[0].text, "Read chapter 2");
  await view.onOpen();
  view.tasks = T.focusDay.addFocusTask([], "Undated chore", "x2", "");
  view.render();
  const chips = dom.all.filter((o) => o.classes.has("qt-focus-due"));
  assert.equal(chips.length, 1);
  assert.equal(chips[0].meta.text, T.taskDates.dueChipLabel("2026-11-17"));
});

test("task dates: the chip names today, tomorrow and overdue", () => {
  assert.equal(T.taskDates.dueChipLabel("2026-11-15", "2026-11-15"), "Due today");
  assert.equal(T.taskDates.dueChipLabel("2026-11-16", "2026-11-15"), "Due tomorrow · 2026-11-16");
  assert.equal(T.taskDates.dueChipLabel("2026-11-14", "2026-11-15"), "Overdue · 2026-11-14");
  assert.equal(T.taskDates.dueChipLabel("2026-11-20", "2026-11-15"), "Due 2026-11-20");
  assert.equal(T.taskDates.dueChipLabel("", "2026-11-15"), "");
});

test("task dates: the task list hints at naming a day", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.TaskListView({ app }, plugin);
  view.contentEl = dom.root;
  await view.onOpen();
  assert.ok(dom.texts().some((text) => text.includes("tomorrow") && text.includes("every Monday")));});
