"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const P = T.calendarPlanner;
const KEY = "2026-11-03";

function at(hour, minute) {
  return new Date(2026, 10, 3, hour, minute || 0);
}

function event(summary, startHour, startMinute, endHour, endMinute, extra) {
  return Object.assign({ summary, dtstart: at(startHour, startMinute), dtend: at(endHour, endMinute) }, extra || {});
}

test("calendar planner: merges classes and blocks and finds the free slots", () => {
  const events = [event("Biology", 9, 0, 10, 30), event("Chemistry", 13, 0, 14, 0)];
  const blocks = [{ date: KEY, start: "11:00", end: "12:00", title: "Problem set", type: "study" }];
  const plan = P.dayPlan(events, KEY, blocks);
  assert.equal(plan.date, KEY);
  assert.equal(plan.windowStart, "08:00");
  assert.equal(plan.windowEnd, "22:00");
  assert.equal(plan.summary.classes, 2);
  assert.equal(plan.summary.blocks, 1);
  assert.equal(plan.summary.classMinutes, 150);
  assert.equal(plan.summary.plannedMinutes, 60);
  assert.equal(plan.summary.freeMinutes, 630);
  assert.equal(plan.summary.overlaps, 0);
  assert.deepEqual(plan.slots.map((slot) => [slot.start, slot.end, slot.minutes]), [
    ["08:00", "09:00", 60],
    ["10:30", "11:00", 30],
    ["12:00", "13:00", 60],
    ["14:00", "22:00", 480],
  ]);
  assert.equal(plan.slots[0].subject, "Biology");
  assert.equal(plan.slots[2].subject, "Chemistry");
  assert.deepEqual(plan.items.map((item) => [item.kind, item.start]), [
    ["class", "09:00"],
    ["block", "11:00"],
    ["class", "13:00"],
  ]);
});

test("calendar planner: marks a block that sits over a class", () => {
  const events = [event("Biology", 9, 0, 10, 30)];
  const blocks = [{ date: KEY, start: "09:30", end: "10:00", title: "Review", type: "review" }];
  const plan = P.dayPlan(events, KEY, blocks);
  assert.equal(plan.summary.overlaps, 1);
  assert.equal(plan.blocks[0].overlap, true);
  assert.equal(plan.blocks[0].minutes, 30);
  assert.deepEqual(plan.slots.map((slot) => slot.start), ["08:00", "10:30"]);
});

test("calendar planner: the planning window and the slot minimum are honoured", () => {
  const events = [event("Biology", 9, 0, 10, 30), event("Chemistry", 13, 0, 14, 0)];
  const narrow = P.dayPlan(events, KEY, [], { dayStart: "09:00", dayEnd: "12:00" });
  assert.equal(narrow.windowStart, "09:00");
  assert.equal(narrow.windowEnd, "12:00");
  assert.deepEqual(narrow.slots.map((slot) => [slot.start, slot.end]), [["10:30", "12:00"]]);
  const longOnly = P.dayPlan(events, KEY, [], { minSlotMinutes: 120 });
  assert.deepEqual(longOnly.slots.map((slot) => slot.start), ["10:30", "14:00"]);
  const broken = P.dayPlan(events, KEY, [], { dayStart: "18:00", dayEnd: "09:00" });
  assert.equal(broken.windowStart, "08:00");
  assert.equal(broken.windowEnd, "22:00");
  assert.deepEqual(P.planningWindow({}), { start: 480, end: 1320 });
});

test("calendar planner: drafts for a free slot and for the time after a class", () => {
  const slot = P.slotDraft({ start: "14:00", end: "15:00", subject: "Biology" }, KEY);
  assert.deepEqual(slot, {
    date: KEY,
    start: "14:00",
    end: "15:00",
    title: "Study: Biology",
    type: "study",
    course: "Biology",
    source: "calendar-slot",
  });
  assert.equal(P.slotDraft({ start: "14:00", end: "14:00" }, KEY), null);
  assert.equal(P.slotDraft({ start: "", end: "15:00" }, KEY), null);

  const after = P.afterClassDraft({ endMinutes: 630, course: "Biology" }, KEY);
  assert.deepEqual(after, {
    date: KEY,
    start: "10:30",
    end: "11:15",
    title: "Review: Biology",
    type: "review",
    course: "Biology",
    source: "calendar-class",
  });
  const clamped = P.afterClassDraft({ endMinutes: 21 * 60 + 45, title: "Chemistry" }, KEY);
  assert.deepEqual([clamped.start, clamped.end], ["21:45", "22:00"]);
  assert.equal(P.afterClassDraft({ endMinutes: -1 }, KEY), null);
  const line = P.planSummaryLine({ plannedMinutes: 60, classes: 2, classMinutes: 150, freeMinutes: 30 });
  assert.match(line, /planned/);
  assert.match(line, /in class/);
  assert.match(line, /free time/);
  assert.match(P.planSummaryLine({ plannedMinutes: 0, overlaps: 2 }), /2 blocks over a class/);
});

test("calendar planner: the plugin plans blocks from the calendar day", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.timeBlocks = { enabled: true, blocks: [] };
  const events = [event("Biology", 9, 0, 10, 30), event("Chemistry", 13, 0, 14, 0)];
  const plan = plugin.calendarPlannerDay(KEY, events);
  assert.equal(plan.summary.classes, 2);
  assert.equal(plan.slots.length, 3);

  const slot = plan.slots.find((row) => row.start === "08:00");
  assert.equal(slot.subject, "Biology");
  const created = await plugin.planBlockFromCalendarSlot(KEY, slot);
  assert.equal(created.ok, true);
  assert.equal(created.block.title, "Study: Biology");
  assert.equal(plugin.timeBlocksSettings().blocks.length, 1);

  const after = await plugin.planBlockAfterClass(KEY, plan.classes[0]);
  assert.equal(after.ok, true);
  assert.equal(after.block.start, "10:30");
  assert.equal(after.block.end, "11:15");
  assert.equal(plugin.timeBlocksSettings().blocks.length, 2);

  plugin.settings.timeBlocks = { enabled: false, blocks: [] };
  const refused = await plugin.planBlockFromCalendarSlot(KEY, slot);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "disabled");
  assert.equal(plugin.timeBlocksSettings().blocks.length, 0);
});
