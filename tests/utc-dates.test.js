"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const utc = require("../src/utc-dates");

test("UTC day keys do not depend on the machine timezone", () => {
  const instant = new Date("2026-03-08T03:30:00Z");
  assert.equal(utc.utcDayKey(instant), "2026-03-08");
  assert.equal(utc.todayKey(instant), "2026-03-08");
  assert.equal(utc.utcDayKey(new Date("2026-03-08T23:30:00-05:00")), "2026-03-09");
});

test("UTC day arithmetic crosses month and leap-day boundaries", () => {
  assert.equal(utc.addUtcDays("2026-02-28", 1), "2026-03-01");
  assert.equal(utc.addUtcDays("2024-02-28", 1), "2024-02-29");
  assert.equal(utc.addUtcDays("2026-01-01", -1), "2025-12-31");
  assert.equal(utc.dayDifference("2026-03-08", "2026-03-06"), 2);
});

test("invalid and impossible date keys are rejected", () => {
  assert.equal(utc.parseDayKey("2026-02-29"), null);
  assert.equal(utc.parseDayKey("2026-13-01"), null);
  assert.equal(utc.validDayKey("not-a-day"), "");
  assert.equal(utc.validDayKey("2024-02-29"), "2024-02-29");
});

test("UTC week starts are stable on both Sunday and Monday", () => {
  assert.equal(utc.startOfUtcWeek("2026-11-08", "monday"), "2026-11-02");
  assert.equal(utc.startOfUtcWeek("2026-11-08", "sunday"), "2026-11-08");
  assert.deepEqual(utc.weekdayLabels("monday").slice(0, 2), ["Mon", "Tue"]);
});

test("month cells include adjacent days and mark today in UTC", () => {
  const cells = utc.monthCells(2026, 10, "monday", new Date("2026-11-08T00:00:00Z"));
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0].key, "2026-10-26");
  assert.equal(cells[cells.length - 1].key, "2026-12-06");
  assert.equal(cells.find((cell) => cell.key === "2026-11-08").isToday, true);
  assert.equal(cells.find((cell) => cell.key === "2026-11-08").inMonth, true);
});

test("formatting a UTC key never shifts to the previous day", () => {
  const label = utc.formatDayLabel("2026-01-01", { weekday: "short", month: "short", day: "numeric" });
  assert.match(label, /Thu/);
  assert.match(label, /Jan/);
  assert.match(label, /1/);
});
