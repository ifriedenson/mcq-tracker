"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const week = T.calendarWeek;

test("the week starts on Monday unless the calendar says Sunday", () => {
  // Nov 19, 2026 is a Thursday.
  assert.equal(week.weekStartKey("2026-11-19", "monday"), "2026-11-16");
  assert.equal(week.weekStartKey("2026-11-19", "sunday"), "2026-11-15");
  assert.equal(week.weekStartKey("2026-11-16", "monday"), "2026-11-16", "a Monday is already the start");
  assert.deepEqual(week.weekDayKeys("2026-11-16"), [
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
  ]);
});

test("a week label names one month, or both across a month or year change", () => {
  assert.equal(week.weekLabel("2026-11-16"), "Nov 16 \u2013 22, 2026");
  assert.equal(week.weekLabel("2026-11-30"), "Nov 30 \u2013 Dec 6, 2026");
  assert.equal(week.weekLabel("2025-12-29"), "Dec 29, 2025 \u2013 Jan 4, 2026");
  assert.equal(week.weekLabel("nope"), "");
});

test("clock strings and time ranges become minutes since midnight", () => {
  assert.equal(week.clockMinutes("9:00"), 540);
  assert.equal(week.clockMinutes("09:30"), 570);
  assert.equal(week.clockMinutes("3pm"), 900);
  assert.equal(week.clockMinutes("12 am"), 0);
  assert.equal(week.clockMinutes("12pm"), 720);
  assert.equal(week.clockMinutes("15:00"), 900);
  assert.equal(week.clockMinutes("25:00"), null);
  assert.equal(week.clockMinutes("soon"), null);
  assert.deepEqual(week.rowMinutes({ time: "09:00\u201310:30" }), { start: 540, end: 630 });
  assert.deepEqual(week.rowMinutes({ time: "15:00" }), { start: 900, end: 930 }, "a bare time is a short block");
  assert.deepEqual(week.rowMinutes({ layer: "classes", time: "09:00" }), { start: 540, end: 600 });
  assert.equal(week.rowMinutes({ time: "" }), null, "no time means no timed block");
});

test("overlapping rows share the column; sequential rows take the whole width", () => {
  const overlapping = week.layoutDay([
    { layer: "classes", title: "A", startMin: 540, endMin: 600 },
    { layer: "classes", title: "B", startMin: 570, endMin: 630 },
  ]);
  assert.deepEqual(overlapping.blocks.map((block) => block.lanes), [2, 2]);
  assert.deepEqual(overlapping.blocks.map((block) => block.lane), [0, 1]);
  assert.deepEqual(overlapping.blocks.map((block) => block.left), [0, 50]);
  assert.deepEqual(overlapping.blocks.map((block) => block.width), [50, 50]);

  const sequential = week.layoutDay([
    { layer: "classes", title: "A", startMin: 540, endMin: 570 },
    { layer: "classes", title: "B", startMin: 570, endMin: 630 },
    { layer: "classes", title: "C", startMin: 630, endMin: 690 },
  ]);
  assert.deepEqual(sequential.blocks.map((block) => block.lanes), [1, 1, 1]);
  assert.deepEqual(sequential.blocks.map((block) => block.left), [0, 0, 0]);
});

test("rows with no clock time wait in the all-day strip", () => {
  const laid = week.layoutDay([
    { layer: "tasks", title: "Essay", time: "" },
    { layer: "review", title: "12 due", time: "" },
    { layer: "planned", title: "Cardio reading", time: "09:00\u201310:00" },
  ]);
  assert.equal(laid.blocks.length, 1);
  assert.deepEqual(laid.allDay.map((row) => row.title), ["Essay", "12 due"]);
});

test("the grid widens its axis for an early or late row and places the now-line", () => {
  const rowsByDay = new Map([
    ["2026-11-16", [{ layer: "classes", title: "Early lab", time: "06:30\u201307:30" }]],
    [
      "2026-11-17",
      [
        { layer: "events", title: "Late talk", time: "22:30\u201323:30" },
        { layer: "tasks", title: "Essay", time: "" },
      ],
    ],
  ]);
  const layout = week.buildWeek({
    startKey: "2026-11-16",
    todayKey: "2026-11-19",
    rowsByDay,
    now: new Date(2026, 10, 19, 10, 30),
  });
  assert.equal(layout.dayStart, 6, "an 06:30 class pulls the axis up");
  assert.equal(layout.dayEnd, 24, "a 23:30 end pulls it down");
  assert.deepEqual(layout.hours.slice(0, 2), [6, 7]);
  assert.equal(layout.hours[layout.hours.length - 1], 23);
  assert.equal(layout.days.length, 7);
  assert.equal(layout.days.find((day) => day.key === "2026-11-19").isToday, true);
  assert.equal(layout.days.find((day) => day.key === "2026-11-18").isToday, false);

  const early = layout.days[0].blocks[0];
  assert.equal(early.top, 22, "half an hour after 06:00 at 44px per hour");

  const late = layout.days[1].blocks[0];
  assert.equal(late.height > 0, true);
  assert.deepEqual(layout.days[1].allDay.map((row) => row.title), ["Essay"]);

  assert.equal(layout.now.key, "2026-11-19");
  assert.equal(layout.now.dayIndex, 3);
  assert.equal(layout.now.top, 198, "4.5 hours after 06:00 at 44px per hour");
  assert.equal(layout.now.label, "10:30");
});

test("the default axis is 07:00 to 22:00 when nothing sits outside it", () => {
  const layout = week.buildWeek({
    startKey: "2026-11-16",
    rowsByDay: new Map([["2026-11-16", [{ layer: "classes", title: "Lecture", time: "09:00\u201310:00" }]]]),
  });
  assert.equal(layout.dayStart, 7);
  assert.equal(layout.dayEnd, 22);
  assert.equal(layout.hours[0], 7);
  assert.equal(layout.hours.length, 15);
});

test("a row that ends before it starts gets a sensible duration instead of a negative block", () => {
  assert.deepEqual(week.rowMinutes({ startMin: 1400, endMin: 20 }), { start: 1400, end: 1430 });
});
