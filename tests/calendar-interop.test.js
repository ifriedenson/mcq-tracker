"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const interop = T.calendarInterop;

const range = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 31, 23, 59) };
const note = (path, fm) => ({ path, fm, text: "" });

test("interop: reads single, all-day and multi-day Full Calendar notes", () => {
  const app = makeApp([
    note("Calendar/2026-10-05 Lecture.md", {
      title: "Linear Algebra",
      date: "2026-10-05",
      type: "single",
      allDay: false,
      startTime: "10:00",
      endTime: "11:30",
    }),
    note("Calendar/2026-10-06 Reading.md", { title: "Reading day", date: "2026-10-06", allDay: true }),
    note("Calendar/2026-10-08 Conference.md", {
      title: "Conference",
      date: "2026-10-08",
      endDate: "2026-10-10",
      allDay: true,
    }),
    note("Calendar/2026-10-05 Class note.md", { date: "2026-10-05", subject: "Math" }),
    note("Elsewhere/2026-10-05 Other.md", { title: "Other", date: "2026-10-05", allDay: true }),
  ]);
  const result = interop.fullCalendarNotes(app, "Calendar", range);
  assert.deepEqual(
    result.events.map((event) => `${event.dateKey} ${event.summary}`),
    ["2026-10-05 Linear Algebra", "2026-10-06 Reading day", "2026-10-08 Conference", "2026-10-09 Conference"]
  );
  assert.equal(result.events[0].allDay, false);
  assert.equal(result.events[0].dtstart.getHours(), 10);
  assert.equal(result.events[0].foreign, true);
  assert.equal(result.events[0].sourcePath, "Calendar/2026-10-05 Lecture.md");
  assert.match(result.signature, /full-calendar/);
});

test("interop: expands weekly Full Calendar events and preserves the end time", () => {
  const app = makeApp([
    note("Calendar/Weekly.md", {
      title: "Weekly seminar",
      type: "recurring",
      daysOfWeek: ["M"],
      startRecur: "2026-10-05",
      endRecur: "2026-10-19",
      startTime: "09:00",
      endTime: "10:15",
    }),
  ]);
  const result = interop.fullCalendarNotes(app, "Calendar", { start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) });
  assert.deepEqual(result.events.map((event) => event.dateKey), ["2026-10-05", "2026-10-12", "2026-10-19"]);
  assert.equal(result.events[0].dtend.getHours(), 10);
  assert.equal(result.events[0].dtend.getMinutes(), 15);
});

test("plugin: Full Calendar notes appear and open the source note without creating a class note", async () => {
  const path = "Calendar/2026-10-05 Lecture.md";
  const app = makeApp([note(path, { title: "Linear Algebra", date: "2026-10-05", allDay: true })]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  plugin.settings.calendar.eventNoteFolder = "Calendar";
  const events = plugin.calendarEvents(new Date(2026, 9, 5));
  assert.equal(events.length, 1);
  assert.equal(events[0].summary, "Linear Algebra");
  const result = await plugin.openClassNote(events[0], events[0].dateKey);
  assert.equal(result.created, false);
  assert.deepEqual(app.opened, [path]);
  assert.equal(app.created, undefined);
});
