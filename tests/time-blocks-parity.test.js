"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT, obsidian } = load();

const B = T.timeBlocks;

async function setup() {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.timeBlocks = { enabled: true };
  return plugin;
}

test("parity: project files carry lifecycle history and keep the user's body", () => {
  const project = B.normalizeTimeProject({
    name: "Thesis",
    kind: "project",
    color: "#123456",
    course: "Writing",
    statusHistory: [
      { date: "2026-11-01", status: "active", intensity: 3, note: "start" },
      { date: "2026-11-04", status: "inactive" },
    ],
  });
  const markdown = B.projectMarkdown(project, { body: "# Thesis\n\nMy own notes." });
  assert.match(markdown, /mcq\/project/);
  assert.match(markdown, /status:/);
  assert.match(markdown, /2026-11-01: \{ active, intensity: 3, note: "start" \}/);
  const parsed = B.parseProjectMarkdown(markdown, "Projects/Thesis.md");
  assert.equal(parsed.name, "Thesis");
  assert.equal(parsed.kind, "project");
  assert.equal(parsed.statusHistory.length, 2);
  assert.equal(parsed.statusHistory[0].intensity, 3);
  assert.equal(B.effectiveProjectRecord(parsed.statusHistory, "2026-11-03").status, "active");
  assert.equal(B.effectiveProjectRecord(parsed.statusHistory, "2026-11-05").status, "inactive");
  assert.equal(B.projectIntensity(parsed, "2026-11-03"), 3);
  assert.equal(B.projectIntensity(parsed, "2026-11-05"), null);
  const replaced = B.replaceProjectFrontmatter("---\ntags:\n  - other\n---\n\n# Thesis\n\nkeep me", markdown);
  assert.match(replaced, /keep me/);
  assert.doesNotMatch(replaced, /  - other/);
  assert.equal(B.parseProjectMarkdown("---\ntags:\n  - kairos/domain\n---\n# Health\n", "Domains/Health.md").kind, "domain");
  assert.equal(B.parseProjectMarkdown("# Not a project\n", "x.md"), null);
});

test("parity: daily intensity and project status reach the timeline", () => {
  const blocks = [
    B.normalizeTimeBlock({ date: "2026-11-05", start: "09:00", end: "10:30", title: "A" }),
    B.normalizeTimeBlock({ date: "2026-11-05", start: "11:00", end: "12:00", title: "B" }),
  ];
  const days = B.intensityByDay(blocks, ["2026-11-05", "2026-11-06"]);
  assert.deepEqual(days.map((day) => day.level), [3, 0]);
  assert.equal(days[0].minutes, 150);
  const project = B.normalizeTimeProject({
    name: "Thesis",
    statusHistory: [{ date: "2026-11-01", status: "active", intensity: 4 }],
  });
  const timeline = B.projectTimeline(blocks.concat(B.normalizeTimeBlock({ date: "2026-11-05", start: "13:00", end: "14:00", title: "C", projectId: project.id })), [project], 2, "2026-11-06");
  const row = timeline.rows.find((item) => item.id === project.id);
  assert.equal(row.status, "active");
  assert.equal(row.intensity, 4);
});

test("parity: drag geometry snaps, clamps and keeps a minimum block", () => {
  assert.equal(B.snapMinutes(8, 15), 15);
  assert.equal(B.snapMinutes(7, 15), 0);
  assert.deepEqual(B.shiftBlockTimes({ start: "09:00", end: "10:00" }, 90), { start: "10:30", end: "11:30" });
  assert.deepEqual(B.shiftBlockTimes({ start: "00:30", end: "01:30" }, -60), { start: "00:00", end: "01:00" });
  assert.deepEqual(B.resizeBlockTimes({ start: "09:00", end: "10:00" }, "end", 30), { start: "09:00", end: "10:30" });
  assert.deepEqual(B.resizeBlockTimes({ start: "09:00", end: "10:00" }, "start", 120), { start: "09:45", end: "10:00" });
  assert.deepEqual(B.timeRangeFromDrag(600, 600), { start: "10:00", end: "10:15" });
  assert.deepEqual(B.timeRangeFromDrag(700, 640), { start: "10:45", end: "11:45" });
  assert.equal(B.nextTaskStatus("open"), "half");
  assert.equal(B.nextTaskStatus("half"), "done");
  assert.equal(B.nextTaskStatus("done"), "open");
  assert.equal(B.nextTaskStatus("cancelled"), "open");
});

test("parity: Kairos settings map without touching its code or files", () => {
  const patch = B.kairosSettingsPatch({
    timelineStartHour: 8,
    timelineEndHour: 21,
    scheduleHeading: "Plan",
    backlogPath: "Backlog.md",
    routinesPath: "Routines.md",
    projectsFolder: "P",
    domainsFolder: "D",
    autoApplyRoutines: true,
    askAssocOnBlockCreate: true,
    dropBlockTitle: "Deep work",
    ignored: "x",
  });
  assert.equal(patch.dayStart, "08:00");
  assert.equal(patch.dayEnd, "21:00");
  assert.equal(patch.scheduleHeading, "## Plan");
  assert.equal(patch.projectsFolder, "P");
  assert.equal(patch.domainsFolder, "D");
  assert.equal(patch.autoApplyRoutines, true);
  assert.equal(patch.askAssocOnBlockCreate, true);
  assert.equal(patch.dropBlockTitle, "Deep work");
  assert.deepEqual(B.kairosSettingsPatch("not json"), {});
  assert.deepEqual(B.kairosSettingsPatch(null), {});
  const inverted = B.kairosSettingsPatch({ timelineStartHour: 20, timelineEndHour: 6 });
  assert.ok(B.minutesOf(inverted.dayEnd) > B.minutesOf(inverted.dayStart));
});

test("parity: plugin cycles and cancels a task, then moves it to another day", async () => {
  const plugin = await setup();
  const block = await plugin.addTimeBlock({ date: "2026-11-05", start: "09:00", end: "10:00", title: "Deep", tasks: [{ title: "One" }] });
  const task = block.tasks[0];
  await plugin.cycleTimeBlockTask(block.id, task.id);
  assert.equal(plugin.settings.timeBlocks.blocks[0].tasks[0].status, "half");
  await plugin.cycleTimeBlockTask(block.id, task.id);
  assert.equal(plugin.settings.timeBlocks.blocks[0].tasks[0].status, "done");
  assert.equal(plugin.settings.timeBlocks.blocks[0].tasks[0].done, true);
  await plugin.cycleTimeBlockTask(block.id, task.id);
  assert.equal(plugin.settings.timeBlocks.blocks[0].tasks[0].status, "open");
  await plugin.cancelTimeBlockTask(block.id, task.id);
  assert.equal(plugin.settings.timeBlocks.blocks[0].tasks[0].status, "cancelled");
  assert.equal(plugin.settings.timeBlocks.blocks[0].tasks[0].done, false);
  const moved = await plugin.moveTimeBlockTask(block.id, task.id, "2026-11-06");
  assert.equal(moved.date, "2026-11-06");
  const target = plugin.settings.timeBlocks.blocks.find((row) => row.id === moved.blockId);
  assert.equal(target.untimed, true);
  assert.equal(target.tasks.length, 1);
  assert.equal(plugin.settings.timeBlocks.blocks.find((row) => row.id === block.id).tasks.length, 0);
});

test("parity: project status history is recorded and updated", async () => {
  const plugin = await setup();
  const project = await plugin.addTimeBlockProject({ name: "Thesis" });
  const updated = await plugin.setTimeBlockProjectStatus(project.id, "active", 3, "push", "2026-11-05");
  assert.equal(updated.statusHistory.length, 1);
  assert.equal(updated.statusHistory[0].intensity, 3);
  assert.equal(updated.statusHistory[0].note, "push");
  const archived = await plugin.setTimeBlockProjectStatus(project.id, "archived", undefined, "", "2026-11-06");
  assert.equal(archived.statusHistory.length, 2);
  assert.equal(B.effectiveProjectRecord(archived.statusHistory, "2026-11-06").status, "archived");
  assert.equal(await plugin.setTimeBlockProjectStatus(project.id, "nope"), null);
});

test("parity: routines, backlog and project files write and import", async () => {
  const plugin = await setup();
  await plugin.addTimeBlockRoutine({ title: "Morning", start: "08:00", end: "09:00", days: [1], tasks: [{ title: "Read" }] });
  const routines = await plugin.writeTimeBlockRoutinesFile("Routines.md");
  assert.equal(routines.ok, true);
  assert.match(plugin.app.vault.getAbstractFileByPath("Routines.md").text, /Morning/);
  await plugin.addTimeBlockBacklog({ title: "Review chapter", resurface: "2026-11-10" });
  const backlog = await plugin.writeTimeBlockBacklogFile("Backlog.md");
  assert.equal(backlog.ok, true);
  assert.match(plugin.app.vault.getAbstractFileByPath("Backlog.md").text, /Review chapter/);
  const project = await plugin.addTimeBlockProject({ name: "Thesis", course: "Writing" });
  const written = await plugin.writeTimeBlockProjectFiles();
  assert.equal(written.written, 1);
  const path = written.paths[0];
  const file = plugin.app.vault.getAbstractFileByPath(path);
  assert.match(file.text, /mcq\/project/);
  await plugin.setTimeBlockProjectStatus(project.id, "active", 4, "", "2026-11-05");
  await plugin.app.vault.modify(file, file.text + "\n\nMy own body\n");
  await plugin.writeTimeBlockProjectFiles();
  assert.match(plugin.app.vault.getAbstractFileByPath(path).text, /My own body/);
  assert.match(plugin.app.vault.getAbstractFileByPath(path).text, /intensity: 4/);
  const imported = await plugin.importTimeBlockProjectFiles();
  assert.equal(imported.imported, 1);
  assert.equal(imported.projects, 1);
});

test("parity: Kairos settings import merges data.json and refuses a missing file", async () => {
  const plugin = await setup();
  plugin.app.vault.adapter = {
    read: async () => JSON.stringify({ timelineStartHour: 9, timelineEndHour: 20, scheduleHeading: "Plan", projectsFolder: "P", autoApplyRoutines: true }),
  };
  const result = await plugin.importKairosSettings();
  assert.equal(result.ok, true);
  assert.ok(result.applied.includes("dayStart"));
  assert.equal(plugin.settings.timeBlocks.dayStart, "09:00");
  assert.equal(plugin.settings.timeBlocks.dayEnd, "20:00");
  assert.equal(plugin.settings.timeBlocks.scheduleHeading, "## Plan");
  assert.equal(plugin.settings.timeBlocks.autoApplyRoutines, true);
  plugin.app.vault.adapter = { read: async () => { throw new Error("missing"); } };
  const missing = await plugin.importKairosSettings();
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "missing");
});

test("parity: the six new commands are registered and the tour opens", async () => {
  const plugin = await setup();
  const ids = [
    "time-blocks-tour",
    "time-blocks-write-routines",
    "time-blocks-write-backlog",
    "time-blocks-write-projects",
    "time-blocks-import-projects",
    "time-blocks-import-kairos",
  ];
  for (const id of ids) assert.ok(plugin.commands.some((row) => row.id === id), id);
  assert.equal(typeof plugin.openTimeBlocksTour, "function");
  assert.equal(typeof plugin.writeTimeBlockRoutinesFile, "function");
  assert.equal(typeof plugin.writeTimeBlockBacklogFile, "function");
  assert.equal(typeof plugin.writeTimeBlockProjectFiles, "function");
  assert.equal(typeof plugin.importTimeBlockProjectFiles, "function");
  assert.equal(typeof plugin.importKairosSettings, "function");
  assert.equal(B.TIME_BLOCK_TOUR.length, 7);
  const before = obsidian.modals.length;
  plugin.openTimeBlocksTour();
  assert.equal(obsidian.modals.length, before + 1);
});
