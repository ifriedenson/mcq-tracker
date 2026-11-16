"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const merge = require("../src/calendar-merge");

function pluginWith(overrides) {
  const state = {
    settings: {
      calendar: { enabled: true, layers: {} },
      timeBlocks: { enabled: true, blocks: [] },
      localEvents: { enabled: true, events: [] },
      studyTasks: { enabled: true, tasks: [] },
    },
    calendarEnabled: () => true,
    timeBlocksEnabled: () => true,
    localEventsEnabled: () => true,
    reviewCalendarEnabled: () => true,
    studyTasksEnabled: () => true,
    timeBlocksSettings: () => ({ enabled: true, blocks: state.settings.timeBlocks.blocks }),
    reviewCalendarSnapshot: () => ({ days: [] }),
  };
  return Object.assign(state, overrides || {});
}

test("calendar merge: every layer is on unless it was switched off", () => {
  assert.deepEqual(merge.normalizeLayers(undefined), { classes: true, planned: true, events: true, review: true, tasks: true });
  assert.deepEqual(merge.normalizeLayers({ review: false, tasks: false }), { classes: true, planned: true, events: true, review: false, tasks: false });
  assert.deepEqual(merge.LAYER_IDS, ["classes", "planned", "events", "review", "tasks"]);
});

test("calendar merge: a day collects blocks, local events, review due and tasks", () => {
  const plugin = pluginWith();
  plugin.settings.timeBlocks.blocks = [
    { id: "b1", date: "2026-11-17", start: "09:00", end: "10:00", title: "Cardio reading", minutes: 60, course: "MED101", createdAt: 1 },
  ];
  plugin.settings.localEvents.events = [
    { id: "e1", title: "Study group", date: "2026-11-17", startTime: "18:00", endTime: "19:00", category: "study", repeat: "none", createdAt: 1, updatedAt: 1 },
  ];
  plugin.settings.studyTasks.tasks = [
    { id: "t1", title: "Finish question bank", due: "2026-11-17", course: "MED101", done: false, tags: [], createdAt: 1 },
    { id: "t2", title: "Already done", due: "2026-11-17", done: true, tags: [], createdAt: 1 },
  ];
  plugin.reviewCalendarSnapshot = () => ({
    days: [{ date: "2026-11-17", notes: [{ id: "n1" }], cards: [{ id: "c1" }], total: 2, minutes: 4 }],
  });

  const merged = merge.collect(plugin, { startKey: "2026-11-16", endKey: "2026-11-20" });
  const rows = merged.byDay.get("2026-11-17");
  assert.deepEqual(rows.map((row) => row.layer), ["planned", "events", "review", "tasks"]);
  assert.equal(rows[0].title, "Cardio reading");
  assert.equal(rows[0].time, "09:00–10:00");
  assert.equal(rows[1].title, "Study group");
  assert.equal(rows[2].title, "2 due");
  assert.equal(rows[3].title, "Finish question bank");
  assert.deepEqual(merged.extras("2026-11-17").map((row) => row.layer), ["events", "review", "tasks"]);
  assert.equal(merged.counts.tasks, 1, "completed tasks are not drawn");
});

test("calendar merge: a layer switched off contributes nothing", () => {
  const plugin = pluginWith();
  plugin.settings.studyTasks.tasks = [{ id: "t1", title: "Task", due: "2026-11-17", done: false, tags: [], createdAt: 1 }];
  plugin.reviewCalendarSnapshot = () => ({ days: [{ date: "2026-11-17", notes: [], cards: [], total: 3, minutes: 0 }] });
  const merged = merge.collect(plugin, { startKey: "2026-11-17", endKey: "2026-11-17", layers: { tasks: false, review: false } });
  assert.equal(merged.byDay.size, 0);
});

test("calendar merge: disabled modules hide their layer", () => {
  const plugin = pluginWith({
    timeBlocksEnabled: () => false,
    localEventsEnabled: () => false,
    reviewCalendarEnabled: () => false,
    studyTasksEnabled: () => false,
  });
  assert.deepEqual(merge.enabledLayers(plugin, {}), {
    classes: true,
    planned: false,
    events: false,
    review: false,
    tasks: false,
  });
});

test("calendar merge: countsForDay feeds the month dots", () => {
  const plugin = pluginWith();
  plugin.settings.studyTasks.tasks = [
    { id: "t1", title: "One", due: "2026-11-17", done: false, tags: [], createdAt: 1 },
    { id: "t2", title: "Two", due: "2026-11-17", done: false, tags: [], createdAt: 2 },
  ];
  const merged = merge.collect(plugin, { startKey: "2026-11-17", endKey: "2026-11-17" });
  assert.equal(merge.countsForDay(merged, "2026-11-17").tasks, 2);
  assert.equal(merge.countsForDay(merged, "2026-11-18").tasks, 0);
});
