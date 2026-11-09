"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const E = T.localEvents;

test("monthly recurrence clamps to short months and returns to the anchor day", () => {
  const event = E.normalizeEvent({ title: "Rent", date: "2026-01-31", repeat: "monthly" }, new Date(2026, 0, 1));
  assert.deepEqual(E.expandRecurrence(event, "2026-01-01", "2026-06-30"), [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
    "2026-04-30",
    "2026-05-31",
    "2026-06-30",
  ]);
});

test("yearly recurrence handles leap day and returns to 29 February", () => {
  const event = E.normalizeEvent({ title: "Leap", date: "2024-02-29", repeat: "yearly" }, new Date(2024, 0, 1));
  assert.deepEqual(E.expandRecurrence(event, "2024-01-01", "2028-12-31"), [
    "2024-02-29",
    "2025-02-28",
    "2026-02-28",
    "2027-02-28",
    "2028-02-29",
  ]);
});

test("daily and weekly recurrence use calendar days across DST", () => {
  const daily = E.normalizeEvent({ title: "Daily", date: "2026-03-07", repeat: "daily" }, new Date(2026, 2, 1));
  assert.deepEqual(E.expandRecurrence(daily, "2026-03-07", "2026-03-10"), ["2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]);
  const weekly = E.normalizeEvent({ title: "Weekly", date: "2026-03-01", repeat: "weekly" }, new Date(2026, 2, 1));
  assert.deepEqual(E.expandRecurrence(weekly, "2026-03-01", "2026-03-22"), ["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22"]);
});

test("recurrence honours repeatUntil and repeatEvery", () => {
  const event = E.normalizeEvent(
    { title: "Every other", date: "2026-01-01", repeat: "daily", repeatEvery: 2, repeatUntil: "2026-01-06" },
    new Date(2026, 0, 1)
  );
  assert.deepEqual(E.expandRecurrence(event, "2026-01-01", "2026-01-31"), ["2026-01-01", "2026-01-03", "2026-01-05"]);
  assert.deepEqual(E.eventsOnDate([event], "2026-01-02"), []);
});

test("local event CRUD keeps categories, colour and recurrence independent", () => {
  let settings = E.normalizeLocalEventsSettings(undefined);
  const created = E.upsertLocalEvent(settings, { title: "Study", date: "2026-11-01", category: "study" }, new Date(2026, 10, 1));
  settings = created.settings;
  assert.equal(settings.events.length, 1);
  assert.equal(created.event.category, "study");
  assert.match(created.event.color, /^#[0-9a-f]{6}$/);
  const edited = E.upsertLocalEvent(settings, { ...created.event, title: "Study group", repeat: "weekly" }, new Date(2026, 10, 1));
  assert.equal(edited.settings.events.length, 1);
  assert.equal(edited.settings.events[0].title, "Study group");
  assert.equal(edited.settings.events[0].repeat, "weekly");
  const removed = E.removeLocalEvent(edited.settings, created.event.id);
  assert.equal(removed.removed, true);
  assert.equal(removed.settings.events.length, 0);
});

test("local events keep a trimmed location", () => {
  const event = E.normalizeEvent({ title: "Lab", date: "2026-11-01", location: "  Room 204  " }, new Date(2026, 10, 1));
  assert.equal(event.location, "Room 204");
  assert.equal(E.normalizeEvent({ title: "Online", date: "2026-11-01" }, new Date(2026, 10, 1)).location, "");
  const settings = E.upsertLocalEvent(E.normalizeLocalEventsSettings(undefined), { ...event, location: "Library" }, new Date(2026, 10, 1));
  assert.equal(settings.settings.events[0].location, "Library");
});

test("month grid has whole weeks and marks today", () => {
  const cells = E.monthCells(2026, 10, "monday", new Date(2026, 10, 1));
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.find((cell) => cell.key === "2026-11-01").isToday, true);
  assert.equal(cells[0].key, "2026-10-26");
});
