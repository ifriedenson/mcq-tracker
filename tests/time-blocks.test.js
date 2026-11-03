"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const B = T.timeBlocks;

function setup() {
  return QT.prototype && (async () => {
    const plugin = new QT(makeApp([]));
    await plugin.onload();
    plugin.settings.timeBlocks = { enabled: true };
    return plugin;
  })();
}

test("time blocks: default off, validate times and build a day summary", () => {
  const defaults = B.normalizeTimeBlocks({});
  assert.equal(defaults.enabled, false);
  assert.equal(defaults.showCalendar, true);
  assert.equal(B.normalizeTimeBlocks({ showCalendar: false }).showCalendar, false);
  assert.equal(defaults.weekStartsOn, "monday");
  assert.equal(defaults.dayStart, "07:00");
  assert.equal(B.normalizeTimeBlocks({ enabled: true }).enabled, true);
  assert.equal(B.createTimeBlock({ date: "2026-11-03", start: "09:00", end: "10:30", title: "Study" }).end, "10:30");
  assert.equal(B.createTimeBlock({ date: "2026-11-03", start: "10:00", end: "09:00", title: "Backwards" }), null);
  assert.equal(B.createTimeBlock({ date: "not-a-day", start: "09:00", end: "10:00", title: "Bad date" }), null);
  assert.equal(B.durationLabel(90), "1h 30m");
  assert.equal(B.durationLabel(25), "25 min");
  const block = B.createTimeBlock({
    date: "2026-11-03",
    start: "09:00",
    end: "10:30",
    title: "Cell respiration",
    tasks: [{ title: "Read", done: true }, { title: "Practice" }],
  });
  const summary = B.blockSummary([block], "2026-11-03");
  assert.equal(summary.blocks, 1);
  assert.equal(summary.minutes, 90);
  assert.equal(summary.tasks, 2);
  assert.equal(summary.done, 1);
  assert.equal(summary.open, 1);
});

test("time blocks: routines are offers and are added only once per day", () => {
  const routine = B.createTimeRoutine({ title: "Morning review", start: "08:00", end: "08:30", days: ["mon", "wed"] }, 1);
  assert.deepEqual(routine.days, [1, 3]);
  const first = B.applyRoutines([routine], [], "2026-11-02", 2);
  assert.equal(first.created.length, 1);
  assert.equal(first.created[0].routineId, routine.id);
  const second = B.applyRoutines([routine], first.blocks, "2026-11-02", 3);
  assert.equal(second.created.length, 0);
  assert.equal(B.applyRoutines([routine], first.blocks, "2026-11-03", 4).created.length, 0);
  assert.equal(B.weekDates("2026-11-04", "monday")[0], "2026-11-02");
  assert.equal(B.weekDates("2026-11-04", "monday")[6], "2026-11-08");
});

test("time blocks: backlog reuses open study tasks and projects derive timeline totals", () => {
  const project = B.createTimeProject({ name: "Biology", kind: "project", color: "#123456" }, 1);
  const domain = B.createTimeProject({ name: "School", kind: "domain" }, 2);
  assert.equal(domain.kind, "domain");
  const task = { id: "task-1", title: "Review cells", done: false, due: "2026-11-03", createdAt: 1 };
  const block = B.createTimeBlock({ date: "2026-11-03", start: "09:00", end: "10:30", title: "Study", projectId: project.id, tasks: [{ title: task.title, studyTaskId: task.id }] }, 3);
  assert.deepEqual(B.unscheduledStudyTasks([task], [block], "2026-11-03"), []);
  const other = { id: "task-2", title: "Review chemistry", done: false, due: "2026-11-02", createdAt: 2 };
  assert.equal(B.unscheduledStudyTasks([task, other], [block], "2026-11-03")[0].overdue, true);
  const minutes = B.projectMinutes([block], "2026-11-01", "2026-11-07");
  assert.equal(minutes[project.id], 90);
  const timeline = B.projectTimeline([block], [project, domain], 3, "2026-11-03");
  assert.equal(timeline.start, "2026-11-01");
  assert.equal(timeline.end, "2026-11-03");
  const biology = timeline.rows.find((row) => row.id === project.id);
  assert.equal(biology.minutes, 90);
  assert.equal(biology.byDay["2026-11-03"], 90);
  assert.equal(timeline.rows.find((row) => row.id === domain.id), undefined, "an unused project is omitted");
  assert.match(B.blocksToMarkdown("2026-11-03", [block], [project]), /## Schedule/);
  assert.match(B.blocksToMarkdown("2026-11-03", [block], [project]), /\[P:Biology\]/);
});

test("time blocks: calendar context is read-only and marks overlapping blocks", () => {
  const block = B.createTimeBlock({ date: "2026-11-03", start: "09:30", end: "10:30", title: "Cell respiration" }, 1);
  const adjacent = B.createTimeBlock({ date: "2026-11-03", start: "10:00", end: "11:00", title: "After class" }, 2);
  const events = [
    {
      uid: "class-1",
      dateKey: "2026-11-03",
      summary: "Cell biology",
      location: "B2",
      dtstart: new Date(2026, 10, 3, 9, 0),
      dtend: new Date(2026, 10, 3, 10, 0),
    },
    { uid: "all-day", dateKey: "2026-11-03", summary: "Reading day", allDay: true, dtstart: new Date(2026, 10, 3) },
  ];
  const day = B.calendarDaySummary(events, "2026-11-03", [block, adjacent]);
  assert.equal(day.events, 2);
  assert.equal(day.busyMinutes, 60);
  assert.equal(day.conflicts, 1);
  assert.equal(day.conflictBlocks, 1);
  assert.equal(day.rows[1].title, "Cell biology");
  assert.equal(day.rows[1].overlaps[0].id, block.id);
  assert.equal(day.rows[0].allDay, true);
  const week = B.calendarWeekSummary(events, "2026-11-03", "monday", [block, adjacent]);
  assert.equal(week.events, 2);
  assert.equal(week.busyMinutes, 60);
  assert.equal(week.conflicts, 1);
});

test("time blocks: the plugin persists blocks, projects, routines, backlog and linked task completion", async () => {
  const plugin = await setup();
  const project = await plugin.addTimeBlockProject({ name: "Biology", kind: "project" });
  const task = await plugin.addStudyTask({ title: "Review cells", due: "2026-11-03" });
  const block = await plugin.addTimeBlock({
    date: "2026-11-03",
    start: "09:00",
    end: "10:00",
    title: "Deep work",
    projectId: project.id,
    tasks: [{ title: task.title, studyTaskId: task.id }],
  });
  assert.ok(project && task && block);
  const scheduled = await plugin.toggleTimeBlockTask(block.id, block.tasks[0].id, true);
  assert.equal(scheduled.tasks[0].done, true);
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).done, true);
  const routine = await plugin.addTimeBlockRoutine({ title: "Warm-up", start: "08:00", end: "08:15", days: ["tue"] });
  assert.ok(routine);
  const created = await plugin.applyTimeBlockRoutines("2026-11-03");
  assert.equal(created.length, 1);
  const item = await plugin.addTimeBlockBacklog({ title: "Read chapter 4" });
  assert.ok(item);
  const placed = await plugin.scheduleTimeBlockBacklog(item.id, { date: "2026-11-04", start: "10:00", end: "11:00" });
  assert.ok(placed);
  assert.equal(plugin.timeBlocksSettings().backlog.length, 0);
  const path = await plugin.writeTimeBlockDay("2026-11-03");
  assert.equal(path, "Time blocks/2026-11-03.md");
  assert.match(plugin.app.files.find((file) => file.path === path).text, /## Schedule/);

  const restarted = new QT(makeApp([]));
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.timeBlocksSettings().blocks.length, 3);
  assert.equal(restarted.timeBlocksSettings().projects.length, 1);
  assert.equal(restarted.timeBlocksSettings().routines.length, 1);
});

test("time blocks: the workspace shows current calendar events without copying them", async () => {
  const plugin = await setup();
  const block = await plugin.addTimeBlock({ date: "2026-11-03", start: "09:30", end: "10:30", title: "Cell respiration" });
  assert.ok(block);
  const events = [
    {
      uid: "class-1",
      dateKey: "2026-11-03",
      summary: "Cell biology",
      location: "B2",
      dtstart: new Date(2026, 10, 3, 9, 0),
      dtend: new Date(2026, 10, 3, 10, 0),
    },
  ];
  plugin.calendarSettings = () => ({ enabled: true });
  plugin.calendarEvents = () => events;
  const view = new T.StudyWorkspaceView({ app: plugin.app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "timeBlocks";
  view.timeBlockDate = "2026-11-03";
  view.render();
  assert.ok(dom.texts().some((text) => text.includes("Calendar")));
  assert.ok(dom.texts().some((text) => text.includes("Cell biology")));
  assert.ok(dom.texts().some((text) => text.includes("Overlaps")));
  assert.equal(plugin.timeBlocksSettings().blocks.length, 1, "calendar context does not add blocks");
  assert.equal(events.length, 1, "calendar events are not edited");
  await dom.click("Week");
  assert.ok(dom.texts().some((text) => text.includes("Cell biology")));
  assert.ok(dom.texts().some((text) => text.includes("1 calendar")));
});

test("time blocks: the Study Workspace renders the planner views and empty states", async () => {
  const plugin = await setup();
  const view = new T.StudyWorkspaceView({ app: plugin.app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "timeBlocks";
  view.render();
  assert.ok(dom.texts().includes("Time blocks"));
  assert.ok(dom.texts().includes("Day plan"));
  assert.ok(dom.texts().includes("Add a time block"));
  assert.ok(dom.texts().some((text) => text.includes("No blocks on this day")));
  await dom.click("Backlog");
  assert.ok(dom.texts().includes("Backlog"));
  assert.ok(dom.texts().some((text) => text.includes("The backlog is clear")));
  await dom.click("Routines");
  assert.ok(dom.texts().some((text) => text.includes("No routines yet")));
  await dom.click("Projects & domains");
  assert.ok(dom.texts().some((text) => text.includes("No projects or domains yet")));
  await dom.click("Timeline");
  assert.ok(dom.texts().some((text) => text.includes("No project time yet")));
});
