"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const W = T.studyWorkspace;
const TD = T.taskDates;
const TM = T.taskMirror;

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

/* ---- model: priority and repeat ---------------------------------------- */

test("study tasks: priority and repeat normalize to their small vocabularies", () => {
  assert.equal(W.priorityValue("high"), "high");
  assert.equal(W.priorityValue("HIGH"), "high");
  assert.equal(W.priorityValue("urgent"), "");
  assert.equal(W.repeatValue("daily"), "daily");
  assert.equal(W.repeatValue("Weekly"), "weekly");
  assert.equal(W.repeatValue("monthly"), "");
  const task = W.createStudyTask({ title: "Drill", priority: "HIGH", repeat: "Weekly" }, 0);
  assert.equal(task.priority, "high");
  assert.equal(task.repeat, "weekly");
  const plain = W.createStudyTask({ title: "Drill" }, 0);
  assert.equal(plain.priority, "");
  assert.equal(plain.repeat, "");
});

test("study tasks: high priority sorts before due dates", () => {
  const low = W.createStudyTask({ title: "low", due: "2026-11-01" }, 1);
  const high = W.createStudyTask({ title: "high", priority: "high", due: "2026-12-01" }, 2);
  const undated = W.createStudyTask({ title: "undated", priority: "high" }, 3);
  const ordered = [low, high, undated].sort(W.compareStudyTasks);
  assert.deepEqual(ordered.map((task) => task.title), ["high", "undated", "low"]);
});

test("study tasks: finishing a repeating task schedules its next instance", () => {
  const daily = { ...W.createStudyTask({ title: "Drill", repeat: "daily", due: "2026-11-10" }, 1), done: true };
  assert.equal(W.repeatFollowUp(daily, "2026-11-10").due, "2026-11-11");
  const overdue = { ...W.createStudyTask({ title: "Late", repeat: "weekly", due: "2026-01-01" }, 1), done: true };
  // 2026-01-01 is a Thursday, so the overdue weekly lands on the next Thursday.
  assert.equal(W.repeatFollowUp(overdue, "2026-11-10").due, "2026-11-12");
  const undated = { ...W.createStudyTask({ title: "Soon", repeat: "weekly" }, 1), done: true };
  assert.equal(W.repeatFollowUp(undated, "2026-11-10").due, "2026-11-17");
  assert.equal(W.repeatFollowUp({ ...daily, repeat: "" }, "2026-11-10"), null);
  assert.equal(W.repeatFollowUp({ ...daily, done: false }, "2026-11-10"), null);
  const follow = W.repeatFollowUp(daily, "2026-11-10");
  assert.equal(follow.source, "repeat");
  assert.equal(follow.repeat, "daily");
});

/* ---- parser: months and repeats ---------------------------------------- */

test("task dates: in N months counts calendar months", () => {
  assert.equal(TD.parseTaskDate("review in 2 months", "2026-11-15").date, "2027-01-15");
  assert.equal(TD.parseTaskDate("review in a month", "2026-11-15").date, "2026-12-15");
});

test("task dates: every day and every weekday set a repeat", () => {
  assert.deepEqual(TD.extractTaskRepeat("Water plants every day"), { title: "Water plants", repeat: "daily" });
  assert.deepEqual(TD.extractTaskRepeat("Read daily"), { title: "Read", repeat: "daily" });
  assert.deepEqual(TD.extractTaskRepeat("Weekly review"), { title: "review", repeat: "weekly" });
  const tuesday = TD.extractTaskRepeat("Review cells every Tuesday");
  assert.equal(tuesday.repeat, "weekly");
  // The weekday in the title resolves against a reference date, so the expected
  // date is pinned instead of read from the clock (this read "today" and broke
  // the day after it was written).
  const dated = TD.extractTaskDue(tuesday.title, "2026-11-17");
  assert.equal(dated.title, "Review cells");
  assert.equal(dated.due, "2026-11-17", "a Tuesday reference resolves to that same Tuesday");
  assert.deepEqual(TD.extractTaskRepeat("Just a title"), { title: "Just a title", repeat: "" });
});

/* ---- mirror: Tasks-compatible lines ------------------------------------ */

test("task mirror: lines carry due, priority, repeat and tags", () => {
  const line = TM.studyTaskLine({ title: "Review cells", due: "2026-11-20", priority: "high", repeat: "weekly", tags: ["bio"], course: "Biology" });
  assert.ok(line.startsWith("- [ ] Review cells"), "checkbox then title");
  assert.ok(line.includes("📅 2026-11-20"), "due date");
  assert.ok(line.includes("⏫"), "priority");
  assert.ok(line.includes("🔁 every week"), "repeat");
  assert.ok(line.includes("#bio"), "tag");
  assert.ok(line.includes("Biology"), "course context");
  assert.equal(TM.studyTaskLine({ title: "Done work", done: true }), "- [x] Done work");
  assert.equal(TM.studyTaskLine({ title: "" }), "");
});

test("task mirror: the note lists open first with a one-way footer", () => {
  const tasks = [
    W.createStudyTask({ title: "old done", due: "2026-01-01" }, 1),
    W.createStudyTask({ title: "urgent", priority: "high", due: "2026-12-01" }, 2),
    W.createStudyTask({ title: "later", due: "2026-11-20" }, 3),
  ];
  const done = { ...tasks[0], done: true };
  const text = TM.mirrorMarkdown([tasks[2], done, tasks[1]], "2026-11-15");
  const lines = text.split("\n").filter((line) => line.startsWith("- ["));
  assert.deepEqual(
    lines.map((line) => line.replace(/^-\s*\[[ x]\]\s*/, "").split(" 📅")[0]),
    ["urgent", "later", "old done"],
  );
  assert.ok(text.includes("## Done"), "done section");
  assert.ok(text.includes("overwritten"), "one-way rule");
  assert.ok(text.includes("1 done"), "footer counts");
});

/* ---- plugin: repeat wiring, recurrence, mirror -------------------------- */

test("plugin: a repeat in the title becomes a repeating task", async () => {
  const { plugin } = await setup();
  const task = await plugin.addStudyTask({ title: "Review cells every Tuesday" });
  assert.equal(task.repeat, "weekly");
  assert.equal(task.title, "Review cells");
  // "every Tuesday" resolves against the real clock, so the expectation is that
  // day's next Tuesday (today included) rather than the day this was written.
  const day = new Date();
  day.setHours(12, 0, 0, 0);
  day.setDate(day.getDate() + ((2 - day.getDay() + 7) % 7));
  const nextTuesday = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  assert.equal(task.due, nextTuesday);
  const daily = await plugin.addStudyTask({ title: "Water plants every day" });
  assert.equal(daily.repeat, "daily");
  assert.equal(daily.title, "Water plants");
});

test("plugin: completing a repeating task spawns the next one, once", async () => {
  const { plugin } = await setup();
  const task = await plugin.addStudyTask({ title: "Drill", repeat: "daily", due: "2099-06-10" });
  await plugin.updateStudyTask(task.id, { done: true });
  const rows = plugin.settings.studyTasks.tasks.filter((row) => row.title === "Drill");
  assert.equal(rows.length, 2, "the finished task plus its follow-up");
  assert.ok(rows.some((row) => row.done), "the original stays done");
  const next = rows.find((row) => !row.done);
  assert.equal(next.due, "2099-06-11", "a future due date advances by the interval");
  assert.equal(next.repeat, "daily");
  await plugin.updateStudyTask(task.id, { done: false });
  assert.equal(plugin.settings.studyTasks.tasks.filter((row) => row.title === "Drill").length, 2, "reopening spawns nothing");
  const late = await plugin.addStudyTask({ title: "Late", repeat: "weekly", due: "2000-01-01" });
  await plugin.updateStudyTask(late.id, { done: true });
  const lateNext = plugin.settings.studyTasks.tasks.find((row) => row.title === "Late" && !row.done);
  // 2000-01-01 is a Saturday: the overdue weekly keeps its weekday, in the future.
  const start = new Date(2000, 0, 1);
  const now = new Date();
  const step = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (step <= now) step.setDate(step.getDate() + 7);
  const key = `${step.getFullYear()}-${String(step.getMonth() + 1).padStart(2, "0")}-${String(step.getDate()).padStart(2, "0")}`;
  assert.equal(lateNext.due, key, "an overdue weekly keeps its weekday and stays in the future");
  assert.equal(new Date(`${lateNext.due}T12:00:00`).getDay(), 6, "still a Saturday");
});

test("plugin: completing a plain task spawns nothing", async () => {
  const { plugin } = await setup();
  const task = await plugin.addStudyTask({ title: "One-off" });
  await plugin.updateStudyTask(task.id, { done: true });
  assert.equal(plugin.settings.studyTasks.tasks.length, 1);
});

test("plugin: the mirror command writes and rewrites the note", async () => {
  const { plugin } = await setup();
  await plugin.addStudyTask({ title: "Review cells", due: "2026-11-20", priority: "high", repeat: "weekly", tags: ["bio"] });
  const first = await plugin.syncStudyTasksToNote();
  assert.equal(first.ok, true);
  assert.equal(first.path, "Study tasks.md");
  assert.equal(first.open, 1);
  const created = plugin.app.vault.getAbstractFileByPath("Study tasks.md");
  assert.ok(created, "the note is created");
  assert.ok(created.text.includes("🔁 every week"), "Tasks syntax");
  assert.ok(plugin.commands.some((command) => command.id === "mirror-study-tasks"), "command registered");
  await plugin.updateStudyTask(plugin.settings.studyTasks.tasks[0].id, { done: true });
  const second = await plugin.syncStudyTasksToNote();
  assert.equal(second.done, 1);
  assert.ok(plugin.app.vault.getAbstractFileByPath("Study tasks.md").text.includes("## Done"), "rewrite replaces");
  plugin.settings.studyTasks = { enabled: true, tasks: [], mirrorNote: "Plans/term.md" };
  const nested = await plugin.syncStudyTasksToNote();
  assert.equal(nested.path, "Plans/term.md");
  assert.ok(plugin.app.vault.getAbstractFileByPath("Plans/term.md"), "folders are created");
});

/* ---- views: priority and repeat controls -------------------------------- */

test("task list: the star toggles priority and the cycler walks repeats", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const task = await plugin.addStudyTask({ title: "Later", due: "2026-12-01" });
  await plugin.addStudyTask({ title: "Sooner", due: "2026-11-01" });
  const dom = makeDom();
  const view = new T.TaskListView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  const labelOf = (o) => (o.meta.attrs || o.meta.attr || {})["aria-label"];
  const star = dom.all.find((o) => labelOf(o) === "Mark Later high priority");
  assert.ok(star, "priority control");
  dom.all.length = 0;
  for (const handler of star.handlers.filter((h) => h.ev === "click")) await handler.fn({});
  const stored = plugin.settings.studyTasks.tasks.find((row) => row.id === task.id);
  assert.equal(stored.priority, "high");
  const titles = () =>
    dom.all.filter((o) => o.classes && o.classes.has("qt-task-list-title")).map((o) => o.meta.text);
  assert.deepEqual(titles(), ["Later", "Sooner"], "high priority sorts first");
  const cycle = dom.all.find((o) => labelOf(o) === "Repeat for Later: off");
  assert.ok(cycle, "repeat cycler");
  for (const handler of cycle.handlers.filter((h) => h.ev === "click")) await handler.fn({});
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).repeat, "daily");
  assert.ok(dom.texts().some((text) => text.includes("★ High")), "badge");
});

test("workspace tasks tab: priority and repeat show as badges", async () => {
  const { app, plugin } = await setup();
  await plugin.addStudyTask({ title: "Starred", priority: "high", repeat: "daily" });
  const dom = makeDom();
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.contentEl = dom.root;
  view.tab = "tasks";
  view.render();
  const texts = dom.texts();
  assert.ok(texts.some((text) => text.includes("★ Starred")), "priority star");
  assert.ok(texts.some((text) => text.includes("🔁 daily")), "repeat badge");
  assert.ok(texts.includes("Mirror to note"), "mirror action");
});
