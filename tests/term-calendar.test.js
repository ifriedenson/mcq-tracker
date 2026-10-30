"use strict";
process.env.TZ = "Europe/Berlin";

const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const model = T.calendarModel;
const ics = T.calendarIcs;

const pad = (n) => String(n).padStart(2, "0");
const stamp = (key) => {
  const d = new Date(`${key}T10:00:00`);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
};
const event = (uid, key, summary) =>
  [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${stamp(key)}`,
    `DTEND:${stamp(key).replace(/T10/, "T11")}`,
    `SUMMARY:${summary || "Linear Algebra"}`,
    "END:VEVENT",
  ].join("\r\n");
const wrap = (...events) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");

const SETTINGS = {
  semesterStart: "2026-09-07",
  semesterEnd: "2026-12-18",
  readingWeeks: ["2026-10-19 ~ 2026-10-23 Reading week"],
};

function termSettings(overrides) {
  return model.mergeCalendarSettings(Object.assign({}, SETTINGS, overrides || {}));
}

async function pluginWith(icsText, notes) {
  const files = [{ path: "schedule.ics", text: icsText, noFm: true }].concat(notes || []);
  const app = makeApp(files);
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  return { app, plugin };
}

test("term settings: defaults are off, valid dates and ranges normalize, corrupt values reset", () => {
  const off = model.mergeCalendarSettings({});
  assert.equal(off.semesterStart, "");
  assert.equal(off.semesterEnd, "");
  assert.deepEqual(off.readingWeeks, []);
  assert.equal(model.termWeekInfo(off, "2026-10-19"), null, "no start date means no term features");

  const valid = termSettings({
    readingWeeks: [
      "2026-10-19 ~ 2026-10-23 Reading week",
      "2026-10-19 ~ 2026-10-23 Reading week",
      "2026-11-02 Study break",
      "not a date",
    ],
  });
  assert.equal(valid.semesterStart, "2026-09-07");
  assert.equal(valid.semesterEnd, "2026-12-18");
  assert.deepEqual(valid.readingWeeks, [
    { start: "2026-10-19", end: "2026-10-23", label: "Reading week" },
    { start: "2026-11-02", end: "2026-11-02", label: "Study break" },
  ]);

  const corrupt = model.mergeCalendarSettings({
    semesterStart: "2026-02-31",
    semesterEnd: "2026-12-18",
    readingWeeks: "2026-12-01 ~ 2026-11-01 backwards\n2026-13-01",
  });
  assert.equal(corrupt.semesterStart, "");
  assert.equal(corrupt.semesterEnd, "2026-12-18", "a valid end survives, while term behavior stays off without a start");
  assert.deepEqual(corrupt.readingWeeks, []);

  const reverse = model.mergeCalendarSettings({ semesterStart: "2026-12-01", semesterEnd: "2026-09-01" });
  assert.equal(reverse.semesterStart, "");
  assert.equal(reverse.semesterEnd, "");
});

test("term weeks: week 1 starts on the semester start and numbers continue across dates", () => {
  const settings = termSettings();
  assert.equal(model.termWeekInfo(settings, "2026-09-07").week, 1);
  assert.equal(model.termWeekInfo(settings, "2026-09-13").week, 1);
  assert.equal(model.termWeekInfo(settings, "2026-09-14").week, 2);
  assert.equal(model.termWeekInfo(settings, "2026-10-05").week, 5);
  assert.equal(model.termWeekInfo(settings, "2026-10-19").week, 7);
  assert.equal(model.termWeekInfo(settings, "2026-10-21").week, 7);
  assert.equal(model.termWeekLabel(model.termWeekInfo(settings, "2026-10-21")), "Week 7 · Reading week");
  assert.equal(model.termWeekInfo(settings, "2026-09-06").inTerm, false);
  assert.equal(model.termWeekInfo(settings, "2026-12-19").inTerm, false);
  assert.equal(model.termWeekLabel(model.termWeekInfo(settings, "2026-12-19")), "After term");
});

test("term filtering: classes outside the semester are hidden, reading classes are marked, exams stay", () => {
  const settings = termSettings();
  const events = [
    { uid: "before", summary: "Linear Algebra", dateKey: "2026-09-06" },
    { uid: "week1", summary: "Linear Algebra", dateKey: "2026-09-07" },
    { uid: "reading", summary: "Linear Algebra", dateKey: "2026-10-20" },
    { uid: "after", summary: "Linear Algebra", dateKey: "2026-12-19" },
    { uid: "exam", summary: "Linear Algebra - Final Exam", dateKey: "2026-12-21" },
  ];
  const kept = model.applyTermWeeks(settings, events);
  assert.deepEqual(kept.map((e) => e.uid), ["week1", "reading", "exam"]);
  assert.equal(kept[0].termWeek, 1);
  assert.equal(kept[1].termReadingWeek, true);
  assert.equal(kept[1].termReadingLabel, "Reading week");
  assert.equal(kept[2].termReadingWeek, undefined, "exams are never suspended");

  const off = model.mergeCalendarSettings({});
  assert.equal(model.applyTermWeeks(off, events), events, "with no semester start the same event list is returned");
});

test("next class: reading-week classes are skipped without changing event history", () => {
  const settings = termSettings();
  const morning = { uid: "morning", summary: "Linear Algebra", dateKey: "2026-10-20", dtstart: new Date(2026, 9, 20, 9), dtend: new Date(2026, 9, 20, 10) };
  const reading = { uid: "reading", summary: "Physics", dateKey: "2026-10-20", dtstart: new Date(2026, 9, 20, 11), dtend: new Date(2026, 9, 20, 12), termReadingWeek: true };
  const after = { uid: "after", summary: "Chemistry", dateKey: "2026-10-20", dtstart: new Date(2026, 9, 20, 13), dtend: new Date(2026, 9, 20, 14) };
  const status = model.nextClassStatus([morning, reading, after], new Date(2026, 9, 20, 8));
  assert.equal(status.event.uid, "morning", "the first class is unchanged");
  const later = model.nextClassStatus([morning, reading, after], new Date(2026, 9, 20, 10, 30));
  assert.equal(later.event.uid, "after", "a reading-week class is not selected as the next class");
  assert.equal(settings.readingWeeks.length, 1, "checking the schedule does not mutate settings");
});

test("calendar view: reading weeks and week numbers are visible, and the day is labelled", async () => {
  const { app, plugin } = await pluginWith(wrap(event("reading", "2026-10-21", "Linear Algebra")));
  Object.assign(plugin.settings.calendar, SETTINGS);
  plugin.invalidateCalendar();

  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.cursor = new Date(2026, 9, 1);
  view.selectedKey = "2026-10-21";
  view.render();

  const texts = dom.texts();
  assert.ok(texts.includes("W7"), "the month grid labels the week");
  assert.ok(texts.includes("Week 7 · Reading week"), "the selected day names its term week");
  assert.ok(texts.includes("Reading week"), "the reading-week class has a visible badge");
  assert.ok(dom.find(/Linear Algebra/).length, "the class is still shown rather than silently removed");
});

test("plugin: term settings survive restart, reading classes are omitted from .ics export, question state is untouched", async () => {
  const question = {
    path: "Q1.md",
    fm: { question_id: "Q1", attempts: 5, correct_count: 3, streak: 2, next_review: "2026-11-02", course: "Linear Algebra" },
  };
  const { app, plugin } = await pluginWith(
    wrap(event("normal", "2026-10-05", "Linear Algebra"), event("reading", "2026-10-20", "Physics")),
    [question]
  );
  Object.assign(plugin.settings.calendar, SETTINGS);
  plugin.invalidateCalendar();
  await plugin.save();

  assert.equal(plugin.calendarEvents(new Date(2026, 9, 1))[0].summary, "Linear Algebra");
  assert.equal(plugin.calendarEvents(new Date(2026, 9, 1))[1].termReadingWeek, true);
  await plugin.exportCalendarIcs();
  const written = app.created.find((f) => f.path === "schedule-export.ics");
  assert.match(written.text, /SUMMARY:Linear Algebra/);
  assert.doesNotMatch(written.text, /SUMMARY:Physics/);

  const saved = JSON.parse(JSON.stringify(app.saved || plugin.saved));
  const restarted = new QT(app);
  restarted.saved = saved;
  await restarted.onload();
  assert.equal(restarted.settings.calendar.semesterStart, "2026-09-07");
  assert.equal(restarted.settings.calendar.semesterEnd, "2026-12-18");
  assert.equal(restarted.settings.calendar.readingWeeks[0].label, "Reading week");

  const file = app.files.find((f) => f.path === "Q1.md");
  assert.equal(file.fm.attempts, 5);
  assert.equal(file.fm.correct_count, 3);
  assert.equal(file.fm.streak, 2);
  assert.equal(file.fm.next_review, "2026-11-02");
});
