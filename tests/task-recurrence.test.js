"use strict";
/*
 * Narrow recurrence for study tasks: daily, every weekday and weekly. Every
 * case below goes through the plugin's own add and completion handlers
 * (addStudyTask -> updateStudyTask), the same path the checkbox and the task
 * list use, and reads the result back out of what would be data.json.
 */
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

/** Add a task, complete it through the plugin handler, return its rows. */
async function finish(plugin, input) {
  const task = await plugin.addStudyTask(input);
  const done = await plugin.updateStudyTask(task.id, { done: true });
  const rows = plugin.settings.studyTasks.tasks.filter((row) => row.title === task.title);
  const successor = rows.find((row) => !row.done) || null;
  return { task: done, successor, rows, original: task };
}

/* ---- the rule vocabulary ------------------------------------------------ */

test("recurrence: three rules, and nothing else", () => {
  assert.equal(W.repeatValue("daily"), "daily");
  assert.equal(W.repeatValue("weekday"), "weekday");
  assert.equal(W.repeatValue("Weekdays"), "weekday");
  assert.equal(W.repeatValue("weekly"), "weekly");
  assert.equal(W.repeatValue("monthly"), "");
  assert.equal(W.repeatValue("every Tuesday"), "");
});

test("recurrence: titles can name every weekday", () => {
  assert.deepEqual(TD.extractTaskRepeat("Review Biochem every weekday"), { title: "Review Biochem", repeat: "weekday" });
  assert.deepEqual(TD.extractTaskRepeat("Drill weekdays"), { title: "Drill", repeat: "weekday" });
  assert.deepEqual(TD.extractTaskRepeat("Water plants every day"), { title: "Water plants", repeat: "daily" });
  // The weekday stays for the due parser, which strips it from the title.
  assert.deepEqual(TD.extractTaskRepeat("Review cells every Tuesday"), { title: "Review cells Tuesday", repeat: "weekly" });
  assert.equal(TD.extractTaskWhen("Review cells every Tuesday", "2026-11-15").due, "2026-11-17");
});

/* ---- advancement through the plugin's completion handler ---------------- */

test("recurrence: daily advances one day and keeps the time", async () => {
  const { plugin } = await setup();
  const { successor, rows } = await finish(plugin, {
    title: "Drill",
    repeat: "daily",
    due: "2027-01-31",
    time: "18:00",
    tags: "bio",
    priority: "high",
  });
  assert.equal(rows.length, 2, "the finished task plus one successor");
  assert.equal(successor.due, "2027-02-01", "month end rolls into February");
  assert.equal(successor.time, "18:00", "the due time is preserved");
  assert.equal(successor.repeat, "daily");
  assert.equal(successor.priority, "high");
  assert.deepEqual(successor.tags, ["bio"]);
  assert.equal(successor.source, "repeat");
});

test("recurrence: daily crosses February and the leap day correctly", async () => {
  const { plugin } = await setup();
  const leap = await finish(plugin, { title: "Leap", repeat: "daily", due: "2028-02-28" });
  assert.equal(leap.successor.due, "2028-02-29", "2028 is a leap year");
  const leapDay = await finish(plugin, { title: "LeapDay", repeat: "daily", due: "2028-02-29" });
  assert.equal(leapDay.successor.due, "2028-03-01", "day after the leap day");
  const plain = await finish(plugin, { title: "Plain", repeat: "daily", due: "2027-02-28" });
  assert.equal(plain.successor.due, "2027-03-01", "2027 has no 29 February");
});

test("recurrence: every weekday skips the weekend", async () => {
  const { plugin } = await setup();
  // 2026-11-20 is a Friday, 21-22 the weekend.
  const friday = await finish(plugin, { title: "Fri", repeat: "weekday", due: "2026-11-20", time: "08:15" });
  assert.equal(friday.successor.due, "2026-11-23", "Friday lands on Monday");
  assert.equal(friday.successor.time, "08:15");
  const saturday = await finish(plugin, { title: "Sat", repeat: "weekday", due: "2026-11-21" });
  assert.equal(saturday.successor.due, "2026-11-23", "a weekend due date lands on Monday");
  const sunday = await finish(plugin, { title: "Sun", repeat: "weekday", due: "2026-11-22" });
  assert.equal(sunday.successor.due, "2026-11-23");
  const monday = await finish(plugin, { title: "Mon", repeat: "weekday", due: "2026-11-23" });
  assert.equal(monday.successor.due, "2026-11-24", "a weekday moves to the next day");
});

test("recurrence: weekly keeps the weekday across month and year ends", async () => {
  const { plugin } = await setup();
  const month = await finish(plugin, { title: "Week", repeat: "weekly", due: "2027-01-29", time: "09:00" });
  assert.equal(month.successor.due, "2027-02-05", "29 January plus a week crosses into February");
  const year = await finish(plugin, { title: "Year", repeat: "weekly", due: "2027-12-29" });
  assert.equal(year.successor.due, "2028-01-05", "and across the year end");
  const leap = await finish(plugin, { title: "LeapWeek", repeat: "weekly", due: "2028-02-29" });
  assert.equal(leap.successor.due, "2028-03-07", "a leap day keeps its weekday a week later");
  assert.equal(leap.successor.time, "", "no time stays no time");
});

test("recurrence: an overdue task advances from its own due date, into the future", async () => {
  const { plugin } = await setup();
  // 2026-01-01 is a Thursday, long past when the task is completed today.
  const weekly = await finish(plugin, { title: "OldWeekly", repeat: "weekly", due: "2026-01-01", time: "17:00" });
  const weeklyDue = weekly.successor.due;
  assert.ok(weeklyDue > T.util.localDate(), "the successor is in the future");
  assert.equal(new Date(`${weeklyDue}T12:00:00`).getDay(), 4, "and still a Thursday");
  assert.equal(weekly.successor.time, "17:00");

  const weekday = await finish(plugin, { title: "OldWeekday", repeat: "weekday", due: "2026-01-02" });
  const weekdayDue = weekday.successor.due;
  const weekdayDay = new Date(`${weekdayDue}T12:00:00`).getDay();
  assert.ok(weekdayDay !== 0 && weekdayDay !== 6, "a weekday rule never lands on a weekend");
  assert.ok(weekdayDue > T.util.localDate(), "and never in the past");

  const daily = await finish(plugin, { title: "OldDaily", repeat: "daily", due: "2026-01-03" });
  assert.ok(daily.successor.due > T.util.localDate());
});

test("recurrence: the successor is written to the saved data, and survives a reload", async () => {
  const { app, plugin } = await setup();
  await finish(plugin, { title: "Saved", repeat: "weekday", due: "2026-11-20", time: "07:45" });
  const stored = plugin.saved.studyTasks.tasks.filter((row) => row.title === "Saved");
  assert.equal(stored.length, 2, "what data.json holds");
  const next = stored.find((row) => !row.done);
  assert.equal(next.due, "2026-11-23");
  assert.equal(next.time, "07:45");
  assert.equal(next.repeat, "weekday");

  // A fresh plugin instance reading that same data (the next Obsidian launch).
  const restarted = new QT(app);
  restarted.saved = JSON.parse(JSON.stringify(plugin.saved));
  await restarted.loadSettings();
  const reloaded = restarted.settings.studyTasks.tasks.find((row) => row.title === "Saved" && !row.done);
  assert.equal(reloaded.due, "2026-11-23");
  assert.equal(reloaded.repeat, "weekday");
  assert.equal(reloaded.time, "07:45");
});

test("recurrence: completing twice still yields exactly one successor", async () => {
  const { plugin } = await setup();
  const task = await plugin.addStudyTask({ title: "Once", repeat: "daily", due: "2027-03-01", time: "12:00" });
  await plugin.updateStudyTask(task.id, { done: true });
  await plugin.updateStudyTask(task.id, { done: true });
  let rows = plugin.settings.studyTasks.tasks.filter((row) => row.title === "Once");
  assert.equal(rows.length, 2, "one finished task and one successor");
  assert.equal(rows.filter((row) => !row.done).length, 1);

  // Reopening and finishing again must not queue the same day twice either.
  await plugin.updateStudyTask(task.id, { done: false });
  await plugin.updateStudyTask(task.id, { done: true });
  rows = plugin.settings.studyTasks.tasks.filter((row) => row.title === "Once");
  assert.equal(rows.filter((row) => !row.done).length, 1, "still one open successor");
  assert.equal(rows.find((row) => !row.done).due, "2027-03-02");
});

test("recurrence: a plain task and a repeatless successor spawn nothing", async () => {
  const { plugin } = await setup();
  const plain = await plugin.addStudyTask({ title: "One-off", due: "2027-05-01" });
  await plugin.updateStudyTask(plain.id, { done: true });
  assert.equal(plugin.settings.studyTasks.tasks.filter((row) => row.title === "One-off").length, 1);

  // Finish the successor of a repeat: it repeats again, once.
  const first = await finish(plugin, { title: "Chain", repeat: "weekly", due: "2027-05-03" });
  const second = await plugin.updateStudyTask(first.successor.id, { done: true });
  assert.ok(second && second.done);
  const chain = plugin.settings.studyTasks.tasks.filter((row) => row.title === "Chain");
  assert.equal(chain.length, 3, "original, first successor, second successor");
  assert.deepEqual(chain.filter((row) => !row.done).map((row) => row.due), ["2027-05-17"]);
});

/* ---- surfaces ----------------------------------------------------------- */

test("recurrence: the note mirror writes every weekday and the successor line", async () => {
  assert.equal(
    TM.studyTaskLine({ title: "Review Biochem", due: "2026-11-20", time: "08:15", repeat: "weekday" }),
    "- [ ] Review Biochem 📅 2026-11-20 ⏰ 08:15 🔁 every weekday"
  );
  assert.equal(TM.studyTaskLine({ title: "Drill", due: "2026-11-20", repeat: "daily" }), "- [ ] Drill 📅 2026-11-20 🔁 every day");

  const { app, plugin } = await setup();
  plugin.settings.studyTasks = W.normalizeStudyTasks({ ...plugin.settings.studyTasks, mirrorNote: "Study tasks.md" });
  await finish(plugin, { title: "Review Biochem", repeat: "weekday", due: "2026-11-20", time: "08:15" });
  const mirror = app.files.find((file) => file.path === "Study tasks.md");
  assert.ok(mirror, "the configured mirror note is refreshed on completion");
  assert.ok(mirror.text.includes("- [ ] Review Biochem 📅 2026-11-23 ⏰ 08:15 🔁 every weekday"), "the successor line is in the note");
  assert.ok(mirror.text.includes("- [x] Review Biochem 📅 2026-11-20"), "the finished line stays under Done");
});

test("recurrence: the task list cycles off, daily, weekdays, weekly", async () => {
  const { plugin } = await setup();
  const task = await plugin.addStudyTask({ title: "Cycle", due: "2027-04-01" });
  const dom = makeDom();
  const view = new T.TaskListView({ app: plugin.app }, plugin);
  view.contentEl = dom.root;
  const cycle = async () => {
    view.render();
    const button = dom.all
      .filter((entry) => entry.classes && entry.classes.has("qt-task-list-repeat"))
      .pop();
    assert.ok(button, "the repeat button is drawn");
    for (const handler of button.handlers.filter((entry) => entry.ev === "click")) await handler.fn({});
  };
  await cycle();
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).repeat, "daily");
  await cycle();
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).repeat, "weekday");
  await cycle();
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).repeat, "weekly");
  await cycle();
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).repeat, "");

  const pill = await plugin.addStudyTask({ title: "Pill", due: "2027-04-02", repeat: "weekday" });
  assert.ok(pill.repeat === "weekday");
  view.render();
  assert.ok(dom.texts().includes("🔁 weekdays"), "the row names the rule");
});
