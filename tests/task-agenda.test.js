"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const W = T.studyWorkspace;
const TD = T.taskDates;

function day(offset) {
  const base = new Date(`${T.util.localDate()}T12:00:00`);
  base.setDate(base.getDate() + offset);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function task(title, fields) {
  return W.createStudyTask({ title, ...(fields || {}) }, 1);
}

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("agenda: open work groups into overdue, today, days, later and no-date", () => {
  const today = T.util.localDate();
  const tasks = [
    task("overdue", { due: day(-2) }),
    task("today", { due: today, time: "15:00" }),
    task("tomorrow", { due: day(1) }),
    task("far", { due: day(30) }),
    task("nodate"),
    task("done today", { done: true, doneAt: today }),
    task("done long ago", { done: true, doneAt: day(-9) }),
  ];
  const sections = W.agendaSections(tasks, today);
  const ids = sections.map((section) => section.id);
  assert.deepEqual(ids, ["overdue", "today", `day-${day(1)}`, `day-${day(30)}`, "nodate", "done"]);
  assert.equal(sections[0].tasks[0].title, "overdue");
  const done = sections.find((section) => section.id === "done");
  assert.deepEqual(
    done.tasks.map((row) => row.title),
    ["done today"]
  );
  assert.equal(W.agendaSections([], today).length, 0);
});

test("agenda: long tails cap with a total count", () => {
  const today = T.util.localDate();
  const tasks = [];
  for (let n = 1; n <= 30; n++) tasks.push(task(`far ${n}`, { due: day(30 + n) }));
  for (let n = 1; n <= 25; n++) tasks.push(task(`open ${n}`));
  const sections = W.agendaSections(tasks, today);
  const later = sections.find((section) => section.id === "later");
  const nodate = sections.find((section) => section.id === "nodate");
  assert.equal(later.tasks.length, 20);
  assert.equal(later.total, 23);
  assert.equal(later.capped, true);
  assert.equal(nodate.tasks.length, 20);
  assert.equal(nodate.total, 25);
});

test("quick-add preview: spoken dates, times and repeats show before adding", () => {
  const spoken = TD.previewTaskEntry("Review cells tomorrow at 3pm every day", new Date(`${T.util.localDate()}T12:00:00`));
  assert.equal(spoken.title, "Review cells");
  assert.equal(spoken.due, day(1));
  assert.equal(spoken.time, "15:00");
  assert.equal(spoken.repeat, "daily");
  const picked = TD.previewTaskEntry("Drill", new Date(), { due: "2026-12-01" });
  assert.equal(picked.due, "2026-12-01");
  assert.equal(TD.previewTaskEntry("   ", new Date()).title, "");
  assert.equal(W.agendaDayTitle("2026-11-19").includes("Nov"), true);
});

test("plugin: finishing a task stamps doneAt and reopening clears it", async () => {
  const { plugin } = await setup();
  const made = await plugin.addStudyTask({ title: "Drill" });
  assert.equal(made.doneAt, "");
  await plugin.updateStudyTask(made.id, { done: true });
  const done = plugin.settings.studyTasks.tasks.find((row) => row.id === made.id);
  assert.equal(done.doneAt, T.util.localDate());
  await plugin.updateStudyTask(made.id, { title: "Drill v2" });
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === made.id).doneAt, T.util.localDate(), "edits keep the stamp");
  await plugin.updateStudyTask(made.id, { done: false });
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === made.id).doneAt, "");
  const explicit = await plugin.addStudyTask({ title: "Dated", due: day(2) });
  await plugin.updateStudyTask(explicit.id, { done: true, doneAt: "2026-01-02" });
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === explicit.id).doneAt, "2026-01-02", "an explicit stamp wins");
  assert.equal(plugin.settings.studyTasks.agenda, false, "the list layout stays the default");
  const normalized = W.normalizeStudyTasks({ tasks: [{ title: "x", doneAt: "2026-01-01" }], agenda: true });
  assert.equal(normalized.tasks[0].doneAt, "2026-01-01");
  assert.equal(normalized.agenda, true);
});

test("task list: the agenda toggle switches layouts and renders sections", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.addStudyTask({ title: "Past task", due: day(-2) });
  await plugin.addStudyTask({ title: "No date task" });
  const dom = makeDom();
  const view = new T.TaskListView({ app }, plugin);
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("List"), "the layout toggle shows");
  assert.ok(!dom.texts().includes("Overdue"), "list mode has no agenda titles");
  plugin.settings.studyTasks = W.normalizeStudyTasks({ ...plugin.settings.studyTasks, agenda: true });
  view.render();
  const texts = dom.texts();
  assert.ok(texts.includes("Overdue"), "agenda mode groups by day");
  assert.ok(texts.includes("No date"), "agenda mode keeps undated work visible");
  assert.ok(dom.texts().some((text) => /Adds “.*”/.test(text)) === false, "an untouched box previews nothing");
});
