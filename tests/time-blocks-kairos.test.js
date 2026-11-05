"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const B = T.timeBlocks;

function setup() {
  const plugin = new QT(makeApp([]));
  return plugin.onload().then(() => {
    plugin.settings.timeBlocks = { enabled: true };
    return plugin;
  });
}

const SCHEDULE = [
  "---",
  "title: Tuesday",
  "---",
  "",
  "# Tuesday",
  "",
  "## Schedule",
  "- 09:30 - 11:00 Deep Work [Thesis]",
  "\t- [ ] Rework the parser",
  "\t- [/] Fix the figures (p1)",
  "\t- Got through half of it",
  "- 13:00 - 14:00 Gym [D:Health]",
  "\t- [x] Gym",
  "- Unscheduled",
  "\t- [ ] Call mom [D:Home]",
  "",
  "## Journal",
  "keep me",
].join("\n");

test("kairos parity: Schedule markdown reads blocks, tasks, notes and associations", () => {
  const drafts = B.parseScheduleMarkdown(SCHEDULE);
  assert.equal(drafts.length, 3);
  assert.equal(drafts[0].title, "Deep Work");
  assert.equal(drafts[0].start, "09:30");
  assert.equal(drafts[0].end, "11:00");
  assert.equal(drafts[0].assoc.name, "Thesis");
  assert.equal(drafts[0].assoc.kind, "project");
  assert.deepEqual(drafts[0].tasks.map((task) => task.status), ["open", "half"]);
  assert.equal(drafts[0].tasks[1].tag, "p1");
  assert.deepEqual(drafts[0].notes, ["Got through half of it"]);
  assert.equal(drafts[1].assoc.kind, "domain");
  assert.equal(drafts[1].tasks[0].status, "done");
  assert.equal(drafts[2].untimed, true);
  assert.equal(drafts[2].title, "Unscheduled");
  assert.equal(drafts[2].tasks[0].assoc.kind, "domain");
  assert.equal(B.parseScheduleMarkdown(SCHEDULE.replace("## Schedule", "## Plan")).length, 0);
});

test("kairos parity: schedule drafts become blocks and round-trip through markdown", () => {
  const drafts = B.parseScheduleMarkdown(SCHEDULE);
  const converted = B.timeBlocksFromSchedule(drafts, "2026-11-03", [], 1000);
  assert.equal(converted.blocks.length, 3);
  assert.equal(converted.projects.length, 3);
  assert.equal(converted.blocks[0].tasks[1].status, "half");
  assert.equal(converted.blocks[2].untimed, true);
  assert.equal(converted.blocks[2].tasks[0].projectId, converted.projects.find((project) => project.name === "Home").id);
  const blocks = B.blocksForDate(converted.blocks, "2026-11-03");
  assert.equal(blocks[2].title, "Unscheduled");
  const section = B.scheduleMarkdown(blocks, { projects: converted.projects });
  assert.match(section, /^## Schedule/);
  assert.match(section, /- 09:30 - 11:00 Deep Work \[Thesis\]/);
  assert.match(section, /\t- \[\/\] Fix the figures \(p1\)/);
  assert.match(section, /- Unscheduled/);
  const again = B.timeBlocksFromSchedule(B.parseScheduleMarkdown(section), "2026-11-03", converted.projects, 2000);
  assert.deepEqual(again.blocks.map((block) => [block.title, block.start, block.end]), blocks.map((block) => [block.title, block.start, block.end]));
  assert.deepEqual(again.blocks[0].tasks.map((task) => task.status), ["open", "half"]);
  const replaced = B.replaceScheduleSection(SCHEDULE, section, "## Schedule");
  assert.match(replaced, /## Journal\nkeep me/);
  assert.match(replaced, /Deep Work/);
  assert.doesNotMatch(replaced, /Rework the parser[\s\S]*Rework the parser/);
});

test("kairos parity: routine rules cover daily, weekdays, weekends, day lists and monthly", () => {
  assert.deepEqual(B.parseRoutineRule("Weekdays").days, [1, 2, 3, 4, 5]);
  assert.deepEqual(B.parseRoutineRule("Weekends").days, [0, 6]);
  assert.deepEqual(B.parseRoutineRule("Daily").days, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(B.parseRoutineRule("Tue/Thu").days, [2, 4]);
  assert.deepEqual(B.parseRoutineRule("Every Sunday").days, [0]);
  assert.equal(B.parseRoutineRule("Monthly on 15").monthlyDay, 15);
  assert.equal(B.parseRoutineRule("nonsense"), null);
  const monthly = B.createTimeRoutine({ title: "Rent", start: "10:00", end: "10:30", monthlyDay: 15 });
  assert.equal(B.routineOccursOn(monthly, "2026-11-15"), true);
  assert.equal(B.routineOccursOn(monthly, "2026-11-16"), false);
  const weekdays = B.createTimeRoutine({ title: "Standup", start: "09:00", end: "09:15", days: ["mon", "tue"] });
  assert.equal(B.routineOccursOn(weekdays, "2026-11-03"), true);
  assert.equal(B.routineOccursOn(weekdays, "2026-11-04"), false);
  assert.equal(B.createTimeRoutine({ title: "Never", start: "09:00", end: "09:15" }), null);
});

test("kairos parity: Routines.md parses rules, overrides and nested tasks", () => {
  const markdown = [
    "## Weekdays",
    "- 07:30 - 08:00 Morning routine",
    "\t- [ ] Take meds",
    "- 18:00 - 19:00 Gym [D:Health] 🔁 Tue, Thu",
    "\t- [ ] Train",
    "",
    "## Monthly on 15",
    "- 10:00 - 10:30 Pay rent",
  ].join("\n");
  const parsed = B.parseRoutinesMarkdown(markdown, { projects: [] });
  assert.equal(parsed.routines.length, 3);
  assert.deepEqual(parsed.routines[0].days, [1, 2, 3, 4, 5]);
  assert.equal(parsed.routines[0].tasks[0].title, "Take meds");
  assert.deepEqual(parsed.routines[1].days, [2, 4]);
  assert.equal(parsed.routines[1].title, "Gym");
  assert.equal(parsed.routines[2].monthlyDay, 15);
  const section = B.routinesMarkdown(parsed.routines);
  assert.match(section, /## Weekdays/);
  assert.match(section, /## Monthly on 15/);
  assert.match(section, /\t- \[ \] Take meds/);
  const again = B.parseRoutinesMarkdown(section);
  assert.equal(again.routines.length, 3);
  assert.deepEqual(again.routines.map((routine) => routine.title).sort(), ["Gym", "Morning routine", "Pay rent"]);
});

test("kairos parity: routines apply once a day, carry their tasks and can be regenerated", () => {
  const routine = B.createTimeRoutine({
    title: "Morning",
    start: "08:00",
    end: "08:30",
    days: ["tue"],
    tasks: [{ title: "Stretch" }],
  }, 10);
  const applied = B.applyRoutines([routine], [], "2026-11-03", 20);
  assert.equal(applied.created.length, 1);
  assert.equal(applied.created[0].tasks[0].title, "Stretch");
  const again = B.applyRoutines([routine], applied.blocks, "2026-11-03", 30);
  assert.equal(again.created.length, 0);
  const regenerated = B.regenerateRoutines([routine], applied.blocks, "2026-11-03", 40);
  assert.equal(regenerated.removed, 1);
  assert.equal(regenerated.created.length, 1);
  assert.equal(regenerated.created[0].tasks[0].title, "Stretch");
  assert.equal(B.regenerateRoutines([routine], [], "2026-11-04", 50).created.length, 0);
});

test("kairos parity: Backlog.md reads associations and resurface dates", () => {
  const markdown = [
    "# Backlog",
    "- Read Atomic Habits [D:Learning] 📅 2026-11-01",
    "- Fix bike",
    "- Draft outline [Novel] 📅 2026-10-25",
    "not an item",
  ].join("\n");
  const items = B.parseBacklogMarkdown(markdown, { projects: [] });
  assert.equal(items.length, 3);
  assert.equal(items[0].resurface, "2026-11-01");
  assert.equal(items[0].title, "Read Atomic Habits");
  assert.equal(items[2].resurface, "2026-10-25");
  const section = B.backlogMarkdown(items);
  assert.match(section, /- Fix bike/);
  assert.match(section, /📅 2026-11-01/);
  const due = B.resurfacedBacklog(items, "2026-11-01");
  assert.deepEqual(due.map((item) => item.title), ["Draft outline", "Read Atomic Habits"]);
  assert.equal(B.resurfacedBacklog(items, "2026-10-24").length, 0);
});

test("kairos parity: leftovers exclude done and duplicate tasks and materialise associations", () => {
  const source = B.createTimeBlock({
    date: "2026-11-03",
    start: "09:00",
    end: "10:00",
    title: "Deep work",
    projectId: "p1",
    tasks: [{ title: "Open" }, { title: "Half", status: "half" }, { title: "Done", done: true }, { title: "Cancelled", status: "cancelled" }],
  }, 100);
  const today = B.createTimeBlock({
    date: "2026-11-04",
    start: "09:00",
    end: "10:00",
    title: "Today",
    tasks: [{ title: "Half", status: "half", projectId: "p1" }],
  }, 200);
  const leftovers = B.blockLeftovers([source], [today]);
  assert.deepEqual(leftovers.map((row) => row.title), ["Open"]);
  const carried = B.carryOverTasks([source], [today], null, "2026-11-04", 300);
  assert.equal(carried.moved, 1);
  const unscheduled = carried.to.find((block) => block.untimed);
  assert.ok(unscheduled);
  assert.equal(unscheduled.title, "Unscheduled");
  assert.equal(unscheduled.tasks[0].title, "Open");
  assert.equal(unscheduled.tasks[0].projectId, "p1");
  assert.deepEqual(carried.from[0].tasks.map((task) => task.title), ["Half", "Done", "Cancelled"]);
  const picked = B.carryOverTasks([source], [today], [{ blockId: source.id, taskId: source.tasks[1].id }], "2026-11-04", 400);
  assert.equal(picked.moved, 1);
  assert.equal(picked.to.find((block) => block.untimed).tasks[0].projectId, "p1");
});

test("kairos parity: the plugin carries leftovers, regenerates routines and imports files", async () => {
  const plugin = await setup();
  const project = await plugin.addTimeBlockProject({ name: "Biology", kind: "project" });
  const source = await plugin.addTimeBlock({
    date: "2026-11-03",
    start: "09:00",
    end: "10:00",
    title: "Deep work",
    projectId: project.id,
    tasks: [{ title: "Open" }, { title: "Half", status: "half" }, { title: "Done", done: true }],
  });
  assert.ok(source);
  const carried = await plugin.carryTimeBlockLeftovers("2026-11-04");
  assert.equal(carried.moved, 2);
  assert.equal(carried.from, "2026-11-03");
  const today = B.blocksForDate(plugin.timeBlocksSettings().blocks, "2026-11-04");
  assert.equal(today.length, 1);
  assert.equal(today[0].untimed, true);
  assert.deepEqual(today[0].tasks.map((task) => task.title), ["Open", "Half"]);
  assert.equal(today[0].tasks[0].projectId, project.id);
  assert.equal(await plugin.carryTimeBlockLeftovers("2026-11-04").then((row) => row.moved), 0);

  const routine = await plugin.addTimeBlockRoutine({ title: "Warm-up", start: "08:00", end: "08:15", days: ["tue"], tasks: [{ title: "Stretch" }] });
  assert.ok(routine);
  await plugin.applyTimeBlockRoutines("2026-11-03");
  const regenerated = await plugin.regenerateTimeBlockRoutines("2026-11-03");
  assert.equal(regenerated.removed, 1);
  assert.equal(regenerated.created.length, 1);
  assert.equal(regenerated.created[0].tasks[0].title, "Stretch");

  await plugin.app.vault.create("Routines.md", "- 07:00 - 07:30 Coffee\n\t- [ ] Beans\n## Daily\n- 07:00 - 07:30 Coffee\n\t- [ ] Beans\n");
  const routines = await plugin.importTimeBlockRoutinesFile();
  assert.equal(routines.ok, true);
  assert.equal(routines.added, 1);
  assert.equal((await plugin.importTimeBlockRoutinesFile()).added, 0);

  await plugin.app.vault.create("Backlog.md", "- Read chapter 4 [Biology] 📅 2026-11-05\n- Fix bike\n");
  const backlog = await plugin.importTimeBlockBacklogFile();
  assert.equal(backlog.ok, true);
  assert.equal(backlog.added, 2);
  assert.equal(plugin.timeBlocksSettings().backlog[0].projectId, project.id);
  assert.equal(plugin.timeBlocksSettings().backlog[0].resurface, "2026-11-05");
  assert.equal((await plugin.importTimeBlockBacklogFile()).added, 0);
});

test("kairos parity: syncing a daily note reads and writes the Schedule section only", async () => {
  const plugin = await setup();
  plugin.settings.timeBlocks = { enabled: true, dailyNoteFolder: "Daily" };
  const note = [
    "# Tuesday",
    "",
    "Prose outside the section stays.",
    "",
    "## Schedule",
    "- 09:00 - 10:00 Read [Bio]",
    "\t- [ ] Chapter 1",
    "",
    "## Journal",
    "A private line.",
  ].join("\n");
  await plugin.app.vault.create("Daily/2026-11-10.md", note);
  const synced = await plugin.syncTimeBlockDailyNote("2026-11-10");
  assert.equal(synced.ok, true);
  assert.equal(synced.imported, 1);
  const settings = plugin.timeBlocksSettings();
  const day = B.blocksForDate(settings.blocks, "2026-11-10");
  assert.equal(day.length, 1);
  assert.equal(day[0].title, "Read");
  assert.equal(day[0].tasks[0].title, "Chapter 1");
  const bio = settings.projects.find((project) => project.name === "Bio");
  assert.ok(bio);
  assert.equal(day[0].projectId, bio.id);
  const written = plugin.app.files.find((file) => file.path === "Daily/2026-11-10.md").text;
  assert.match(written, /Prose outside the section stays/);
  assert.match(written, /## Journal\nA private line\./);
  assert.match(written, /- 09:00 - 10:00 Read \[Bio\]/);
  assert.equal(written.match(/## Schedule/g).length, 1);

  const file = plugin.app.files.find((row) => row.path === "Daily/2026-11-10.md");
  await plugin.app.vault.modify(file, written.replace("- 09:00 - 10:00 Read [Bio]", "- 09:00 - 10:00 Read deeply [Bio]"));
  const second = await plugin.syncTimeBlockDailyNote("2026-11-10");
  assert.equal(second.ok, true);
  const day2 = B.blocksForDate(plugin.timeBlocksSettings().blocks, "2026-11-10");
  assert.equal(day2.length, 1);
  assert.equal(day2[0].title, "Read deeply");
  const after = plugin.app.files.find((row) => row.path === "Daily/2026-11-10.md").text;
  assert.match(after, /## Journal\nA private line\./);

  const exported = await plugin.addTimeBlock({ date: "2026-11-11", start: "11:00", end: "12:00", title: "Write summary" });
  assert.ok(exported);
  const created = await plugin.syncTimeBlockDailyNote("2026-11-11");
  assert.equal(created.ok, true);
  assert.equal(created.path, "Daily/2026-11-11.md");
  const fresh = plugin.app.files.find((row) => row.path === "Daily/2026-11-11.md").text;
  assert.match(fresh, /## Schedule/);
  assert.match(fresh, /- 11:00 - 12:00 Write summary/);
});

test("kairos parity: the planner registers a command for every view and action", async () => {
  const plugin = await setup();
  const ids = [
    "open-time-blocks-day",
    "open-time-blocks-week",
    "open-time-blocks-grid",
    "open-time-blocks-backlog",
    "open-time-blocks-routines",
    "open-time-blocks-projects",
    "open-time-blocks-timeline",
    "time-blocks-carry-leftovers",
    "time-blocks-regenerate-routines",
    "time-blocks-sync-daily-note",
    "time-blocks-import-routines",
    "time-blocks-import-backlog",
  ];
  for (const id of ids) assert.ok(plugin.commands.some((row) => row.id === id), id);
  const view = { timeBlockView: "day", render() {} };
  plugin.activateStudyWorkspace = async () => view;
  const command = plugin.commands.find((row) => row.id === "open-time-blocks-week");
  await command.callback();
  assert.equal(view.timeBlockView, "week");
  assert.equal(typeof plugin.activateTimeBlocksView, "function");
});
