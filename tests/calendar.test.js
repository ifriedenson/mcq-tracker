"use strict";
// Calendar module tests. Each test file runs in its own process, so this time zone
// change only affects these tests and lets the daylight-saving check be real.
process.env.TZ = "Europe/Berlin";

const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ics = T.calendarIcs;
const model = T.calendarModel;
const notes = T.calendarNotes;

const line = (...lines) => lines.join("\r\n");
const wrap = (...events) => line("BEGIN:VCALENDAR", "VERSION:2.0", ...events.flat(), "END:VCALENDAR");

function event(fields) {
  const f = fields || {};
  const lines = ["BEGIN:VEVENT", `UID:${f.uid || "e1"}`];
  if (f.summary !== null) lines.push(`SUMMARY:${f.summary === undefined ? "Linear Algebra" : f.summary}`);
  if (f.description) lines.push(`DESCRIPTION:${f.description}`);
  if (f.location) lines.push(`LOCATION:${f.location}`);
  if (f.start) lines.push(`DTSTART:${f.start}`);
  if (f.end) lines.push(`DTEND:${f.end}`);
  if (f.rrule) lines.push(`RRULE:${f.rrule}`);
  if (f.exdate) lines.push(`EXDATE:${f.exdate}`);
  if (f.status) lines.push(`STATUS:${f.status}`);
  if (f.recurrenceId) lines.push(`RECURRENCE-ID:${f.recurrenceId}`);
  for (const extra of f.extra || []) lines.push(extra);
  lines.push("END:VEVENT");
  return lines;
}

const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const at = (dayOffset, hours, minutes) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hours, minutes || 0, 0, 0);
  return d;
};

/* ------------------------------------------------------------------ parsing */

test("ics: reads timed and all-day events, folded lines and escaped text", () => {
  const text = wrap(
    line(
      "BEGIN:VEVENT",
      "UID:a",
      "SUMMARY:Linear alge",
      " bra",
      "DESCRIPTION:Lecturer: Dr Chen\\nRoom: 204",
      "LOCATION:Hall B",
      "DTSTART:20261005T100000",
      "DTEND:20261005T113000",
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "END:VALARM",
      "END:VEVENT"
    ),
    line("BEGIN:VEVENT", "UID:b", "SUMMARY:Reading day", "DTSTART;VALUE=DATE:20261215", "DTEND;VALUE=DATE:20261216", "END:VEVENT")
  );
  const parsed = ics.parseIcs(text);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].summary, "Linear algebra");
  assert.equal(parsed[0].description, "Lecturer: Dr Chen\nRoom: 204");
  assert.equal(parsed[0].location, "Hall B");
  assert.equal(parsed[0].allDay, false);
  assert.equal(parsed[0].dtstart.getHours(), 10);
  assert.equal(parsed[0].dtend.getHours(), 11);
  assert.equal(parsed[1].allDay, true);
  assert.equal(ics.dateKey(parsed[1].dtstart), "2026-12-15");
});

test("ics: UTC timestamps become the same instant, and DURATION fills in the end", () => {
  const parsed = ics.parseIcs(
    wrap(line("BEGIN:VEVENT", "UID:z", "SUMMARY:Office hours", "DTSTART:20261005T080000Z", "DURATION:PT90M", "END:VEVENT"))
  );
  assert.equal(parsed[0].dtstart.getTime(), Date.UTC(2026, 9, 5, 8, 0, 0));
  assert.equal(parsed[0].dtend.getTime() - parsed[0].dtstart.getTime(), 90 * 60 * 1000);
});

test("ics: weekly BYDAY expands to distinct starts inside the window", () => {
  const base = ics.parseIcs(
    wrap(event({ start: "20261005T100000", end: "20261005T113000", rrule: "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4" }))
  );
  const out = ics.expandIcs(base, new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59));
  assert.deepEqual(
    out.map((ev) => `${ev.dateKey} ${ev.dtstart.getHours()}`),
    ["2026-10-05 10", "2026-10-07 10", "2026-10-12 10", "2026-10-14 10"]
  );
});

test("ics: INTERVAL and UNTIL bound a fortnightly series", () => {
  const base = ics.parseIcs(
    wrap(event({ start: "20261005T100000", end: "20261005T110000", rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;UNTIL=20261130T000000" }))
  );
  const out = ics.expandIcs(base, new Date(2026, 9, 1), new Date(2027, 1, 1));
  assert.deepEqual(out.map((ev) => ev.dateKey), ["2026-10-05", "2026-10-19", "2026-11-02", "2026-11-16"]);
});

test("ics: EXDATE removes one occurrence but COUNT still applies to the series", () => {
  const base = ics.parseIcs(
    wrap(event({ start: "20261005T100000", end: "20261005T110000", rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3", exdate: "20261012T100000" }))
  );
  const out = ics.expandIcs(base, new Date(2026, 9, 1), new Date(2026, 10, 30));
  assert.deepEqual(out.map((ev) => ev.dateKey), ["2026-10-05", "2026-10-19"]);
});

test("ics: a RECURRENCE-ID override moves an occurrence instead of duplicating it", () => {
  const base = ics.parseIcs(
    wrap(
      event({ uid: "series", start: "20261005T100000", end: "20261005T110000", rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3" }),
      event({ uid: "series", summary: null, start: "20261013T140000", end: "20261013T153000", recurrenceId: "20261012T100000" })
    )
  );
  const out = ics.expandIcs(base, new Date(2026, 9, 1), new Date(2026, 10, 1));
  assert.deepEqual(out.map((ev) => `${ev.dateKey} ${ev.dtstart.getHours()}`), ["2026-10-05 10", "2026-10-13 14", "2026-10-19 10"]);
  assert.equal(out[1].summary, "Linear Algebra", "the override borrows the series title");
});

test("ics: a cancelled instance suppresses just that occurrence", () => {
  const base = ics.parseIcs(
    wrap(
      event({ uid: "series", start: "20261005T100000", end: "20261005T110000", rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3" }),
      event({ uid: "series", summary: null, start: "20261012T100000", recurrenceId: "20261012T100000", status: "CANCELLED" })
    )
  );
  const out = ics.expandIcs(base, new Date(2026, 9, 1), new Date(2026, 10, 1));
  assert.deepEqual(out.map((ev) => ev.dateKey), ["2026-10-05", "2026-10-19"]);
});

test("ics: a weekly class keeps its wall-clock time across a daylight-saving change", () => {
  const before = new Date(2026, 9, 12, 10, 0).getTimezoneOffset();
  const after = new Date(2026, 9, 26, 10, 0).getTimezoneOffset();
  assert.notEqual(before, after, "the test time zone must observe DST for this check to mean anything");
  const base = ics.parseIcs(wrap(event({ start: "20261005T100000", end: "20261005T113000", rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=5" })));
  const out = ics.expandIcs(base, new Date(2026, 9, 1), new Date(2026, 10, 30));
  assert.deepEqual(out.map((ev) => `${ev.dateKey} ${ev.dtstart.getHours()}:${pad(ev.dtstart.getMinutes())}`), [
    "2026-10-05 10:00",
    "2026-10-12 10:00",
    "2026-10-19 10:00",
    "2026-10-26 10:00",
    "2026-11-02 10:00",
  ]);
});

test("ics: monthly BYDAY ordinals and multi-day all-day events", () => {
  const base = ics.parseIcs(
    wrap(
      event({ uid: "m", start: "20261002T090000", end: "20261002T100000", rrule: "FREQ=MONTHLY;BYDAY=1FR;COUNT=2" }),
      line("BEGIN:VEVENT", "UID:span", "SUMMARY:Reading week", "DTSTART;VALUE=DATE:20261012", "DTEND;VALUE=DATE:20261015", "END:VEVENT")
    )
  );
  const out = ics.expandIcs(base, new Date(2026, 9, 1), new Date(2026, 10, 30));
  const monthly = out.filter((ev) => ev.uid === "m").map((ev) => ev.dateKey);
  assert.deepEqual(monthly, ["2026-10-02", "2026-11-06"]);
  assert.deepEqual(out.filter((ev) => ev.uid === "span").map((ev) => ev.dateKey), ["2026-10-12", "2026-10-13", "2026-10-14"]);
});

test("ics: export round-trips through the parser", () => {
  const base = ics.parseIcs(wrap(event({ start: "20261005T100000", end: "20261005T113000", rrule: "FREQ=WEEKLY;COUNT=2" })));
  const events = ics.expandIcs(base, new Date(2026, 9, 1), new Date(2026, 10, 1));
  const text = ics.exportIcs(events, { calendarName: "Study", now: new Date(2026, 9, 1) });
  assert.match(text, /X-WR-CALNAME:Study/);
  const again = ics.expandIcs(ics.parseIcs(text), new Date(2026, 9, 1), new Date(2026, 10, 1));
  assert.deepEqual(
    again.map((ev) => `${ev.dateKey} ${ev.dtstart.getHours()}:${pad(ev.dtstart.getMinutes())}`),
    ["2026-10-05 10:00", "2026-10-12 10:00"]
  );
});

test("feeds: Google share links, embed links and webcal are converted to .ics", () => {
  const calId = "abc123@group.calendar.google.com";
  const b64 = Buffer.from(calId).toString("base64");
  assert.equal(
    ics.normalizeCalendarUrl(`https://calendar.google.com/calendar/u/0?cid=${encodeURIComponent(b64)}`),
    `https://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`
  );
  assert.equal(
    ics.normalizeCalendarUrl(`https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calId)}`),
    `https://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`
  );
  assert.equal(ics.normalizeCalendarUrl("webcal://example.com/feed.ics"), "https://example.com/feed.ics");
  assert.equal(ics.deriveSourceLabel("https://example.com/feed.ics", "X-WR-CALNAME:Campus\r\nBEGIN:VCALENDAR"), "Campus (example.com)");
  assert.equal(ics.icsLooksValid("BEGIN:VCALENDAR"), false);
});

/* ----------------------------------------------------------------- details */

test("details: room, lecturer, class type and exam detection", () => {
  const lecture = model.parseClassDetails("Linear Algebra (Lecture)", "Lecturer: Dr Chen\nRoom: 204", "");
  assert.equal(lecture.lecturer, "Dr Chen");
  assert.equal(lecture.room, "204");
  assert.equal(lecture.category, "wyklad");
  assert.equal(lecture.isExam, false);

  const exam = model.parseClassDetails("Linear Algebra - Final Exam", "", "Hall B");
  assert.equal(exam.isExam, true);
  assert.equal(exam.category, "egzamin");
  assert.equal(exam.room, "Hall B");

  assert.equal(model.parseClassDetails("Spanish (Lektorat)", "", "").category, "lektorat");
  assert.equal(model.parseClassDetails("Physics Lab", "", "").category, "laboratorium");
  assert.equal(model.cleanSubjectTitle("Calculus (WYK)"), "Calculus");
  assert.equal(model.cleanSubjectTitle("Exam: Calculus"), "Calculus");
  assert.equal(model.parseClassDetails("Chemistry", "", "").category, "inne");
});

test("colors: category colors, subject overrides and exam fallbacks", () => {
  const settings = model.mergeCalendarSettings({});
  const exam = model.parseClassDetails("Final Exam", "", "");
  assert.equal(model.classColor(settings, exam, "Final Exam"), "#ef4444");
  settings.classColors.egzamin = "#000001";
  assert.equal(model.classColor(settings, exam, "Final Exam"), "#000001");
  settings.subjectColors.chemistry = "#000002";
  assert.equal(model.classColor(settings, { category: "inne" }, "Chemistry"), "#000002");
});

test("visibility: excluded subjects and keywords hide events", () => {
  const settings = model.mergeCalendarSettings({ excludedSubjects: ["Chemistry"], excludedKeywords: ["cancelled"] });
  const events = [
    { summary: "Chemistry", dateKey: "2026-10-05" },
    { summary: "Linear Algebra", description: "Cancelled this week", dateKey: "2026-10-05" },
    { summary: "Linear Algebra", dateKey: "2026-10-06" },
  ];
  assert.deepEqual(model.visibleEvents(settings, events).map((e) => e.dateKey), ["2026-10-06"]);
});

/* ------------------------------------------------------------ notes + grid */

test("notes: template variables fill the file name and the note body", () => {
  const settings = model.mergeCalendarSettings({ noteFolder: "University" });
  const ev = {
    summary: "Linear Algebra (WYK)",
    description: "Lecturer: Dr Chen\nRoom: 204",
    location: "Hall B",
    allDay: false,
    dtstart: new Date(2026, 9, 5, 10, 0),
    dtend: new Date(2026, 9, 5, 11, 30),
  };
  assert.equal(model.noteFileName(settings, ev, "2026-10-05"), "2026-10-05 - Linear Algebra.md");
  const body = model.noteContent(settings, ev, "2026-10-05");
  assert.match(body, /^---\nsubject: "Linear Algebra"/);
  assert.match(body, /course: "Linear Algebra"/);
  assert.match(body, /date: 2026-10-05/);
  assert.match(body, /room: "Hall B"/);
  assert.match(body, /lecturer: "Dr Chen"/);
  assert.match(body, /10:00–11:30/);
  assert.match(body, /\[ \]/);
  assert.equal(model.renderNoteTemplate("{subject} {unknown}", { subject: "Math" }), "Math {unknown}");
});

test("notes: subject folders resolve explicitly, then by name, then the base folder", () => {
  const settings = model.mergeCalendarSettings({ noteFolder: "University", subjectFolders: { Chemistry: "University/Chem" } });
  const folders = ["University/Chemistry Notes", "University/Chem", "Other/Linear Algebra"];
  assert.equal(model.resolveSubjectFolder(settings, "Chemistry", folders), "University/Chem");
  assert.equal(model.resolveSubjectFolder(settings, "Linear Algebra", folders), "University", "the base folder wins over a matching folder outside it");
  assert.equal(model.resolveSubjectFolder(model.mergeCalendarSettings({ noteFolder: "University" }), "Unknown", folders), "University");
  assert.equal(model.resolveSubjectFolder(model.mergeCalendarSettings({}), "Nothing", folders), "");
});

test("calendar grid: six weeks, Monday or Sunday start, today marked", () => {
  const monday = model.monthGrid(2026, 9, "monday", new Date(2026, 9, 5));
  assert.equal(monday.length, 42);
  assert.equal(monday[0].key, "2026-09-28");
  assert.equal(monday[3].inMonth, true);
  assert.equal(monday[7].key, "2026-10-05");
  assert.equal(monday[7].isToday, true);
  const sunday = model.monthGrid(2026, 9, "sunday", new Date(2026, 9, 5));
  assert.equal(sunday[0].key, "2026-09-27");
  assert.deepEqual(model.weekdayLabels("sunday")[0], "Sun");
});

test("countdowns: a running class is reported before the next one", () => {
  const events = [
    { summary: "Calculus", dtstart: new Date(2026, 9, 5, 9, 0), dtend: new Date(2026, 9, 5, 10, 30), allDay: false },
    { summary: "Physics", dtstart: new Date(2026, 9, 5, 12, 0), dtend: new Date(2026, 9, 5, 13, 0), allDay: false },
    { summary: "Reading", dtstart: new Date(2026, 9, 5), dtend: new Date(2026, 9, 5, 23, 59), allDay: true },
  ];
  const during = model.nextClassStatus(events, new Date(2026, 9, 5, 10, 0));
  assert.equal(during.state, "ongoing");
  assert.equal(during.event.summary, "Calculus");
  assert.equal(model.humanizeDuration(during.endsInMs), "30 min");
  const after = model.nextClassStatus(events, new Date(2026, 9, 5, 11, 0));
  assert.equal(after.state, "next");
  assert.equal(after.event.summary, "Physics");
  assert.equal(model.humanizeDuration(after.startsInMs), "1 h 00 m");
  assert.equal(model.nextClassStatus(events, new Date(2026, 9, 6, 9)).state, "none");
});

test("exams: upcoming exams are sorted, counted down and de-duplicated", () => {
  const now = new Date(2026, 9, 5, 8);
  const events = [
    { summary: "Chemistry", dtstart: new Date(2026, 9, 20, 9), dateKey: "2026-10-20", description: "Final exam" },
    { summary: "Chemistry", dtstart: new Date(2026, 9, 20, 9), dateKey: "2026-10-20", description: "Final exam" },
    { summary: "Linear Algebra", dtstart: new Date(2026, 8, 20, 9), dateKey: "2026-09-20", description: "Midterm" },
    { summary: "Physics", dtstart: new Date(2026, 9, 6, 9), dateKey: "2026-10-06", summaryOverride: true, isExam: true },
    { summary: "Lecture", dtstart: new Date(2026, 9, 7, 9), dateKey: "2026-10-07" },
  ];
  const exams = model.upcomingExams(events, now, 5);
  assert.deepEqual(exams.map((e) => e.summary), ["Physics", "Chemistry"]);
  assert.equal(model.examCountdown(exams[0], now), "tomorrow");
  assert.equal(model.examCountdown(exams[1], now), "in 15 days");
  assert.equal(model.upcomingExams(events, now, 1).length, 1);
});

/* ---------------------------------------------------------------- embeds */

test("embed: date: today, tomorrow and an explicit day", () => {
  const now = new Date(2026, 9, 5, 12);
  assert.equal(T.parseScheduleBlock("date: today", now).dateKey, "2026-10-05");
  assert.equal(T.parseScheduleBlock("date: tomorrow", now).dateKey, "2026-10-06");
  assert.equal(T.parseScheduleBlock("date: 2026-12-24", now).dateKey, "2026-12-24");
  assert.equal(T.parseScheduleBlock("", now).dateKey, "2026-10-05");
});

/* ---------------------------------------------------------- plugin wiring */

async function pluginWith(icsText) {
  const app = makeApp([{ path: "schedule.ics", text: icsText, noFm: true }]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

const TODAY_EVENT = () =>
  wrap(event({ uid: "today", start: stamp(at(0, 10)), end: stamp(at(0, 11)), location: "Room 204", description: "Lecturer: Dr Chen" }));

test("plugin: the calendar module is off by default and its embeds register safely", async () => {
  const { plugin } = await pluginWith(TODAY_EVENT());
  assert.equal(plugin.calendarEnabled(), false);
  assert.ok(plugin.views["question-tracker-calendar"], "the view is registered even while off");
  assert.deepEqual(Object.keys(plugin.codeBlocks).sort(), ["mcq-schedule", "uni-calendar", "uni-schedule"]);
  const dom = makeDom();
  plugin.codeBlocks["uni-schedule"]("date: today", dom.root);
  assert.ok(dom.texts().some((t) => /Calendar is off/.test(t)), "the embed explains why it is empty");
});

test("plugin: adding an .ics file feeds the calendar, countdown and export", async () => {
  const { app, plugin } = await pluginWith(TODAY_EVENT());
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  assert.equal(plugin.calendarSources().length, 1);
  assert.equal(plugin.calendarEvents()[0].summary, "Linear Algebra");
  const status = model.nextClassStatus(plugin.calendarEvents(), at(0, 10, 15));
  assert.equal(status.event.summary, "Linear Algebra");

  await plugin.exportCalendarIcs();
  const written = app.created.find((f) => f.path === "schedule-export.ics");
  assert.ok(written, "the export file is created");
  assert.match(written.text, /BEGIN:VCALENDAR/);
  assert.match(written.text, /SUMMARY:Linear Algebra/);

  plugin.settings.calendar.sources[0].hidden = true;
  plugin.invalidateCalendar();
  assert.deepEqual(plugin.calendarEvents(), []);
});

test("plugin: creating a class note uses the template and remembers the subject folder", async () => {
  const { app, plugin } = await pluginWith(TODAY_EVENT());
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  plugin.settings.calendar.subjectFolders["Linear Algebra"] = "University/Linear Algebra";
  const ev = plugin.calendarEvents()[0];
  const result = await plugin.openClassNote(ev, ev.dateKey);
  assert.equal(result.created, true);
  const file = app.created.find((f) => f.path === result.path);
  assert.ok(file, "the note is written");
  assert.ok(result.path.startsWith("University/Linear Algebra/"), result.path);
  assert.match(file.text, /course: "Linear Algebra"/);
  assert.match(file.text, /Room 204/);
  assert.deepEqual(app.opened, [result.path], "the new note opens");
  assert.equal(notes.notePathFor(app, plugin.calendarSettings(), ev, ev.dateKey), result.path);
  assert.equal(plugin.settings.calendar.subjectFolders["Linear Algebra"], "University/Linear Algebra");
});

test("view: shows the module hint while off and a month grid once a schedule exists", async () => {
  const { app, plugin } = await pluginWith(TODAY_EVENT());
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().some((t) => /calendar module is off/i.test(t)));

  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  const dom2 = makeDom();
  view.contentEl = dom2.root;
  view.render();
  const texts = dom2.texts();
  assert.ok(texts.includes("Calendar"));
  assert.ok(texts.includes("Month"));
  assert.ok(texts.includes(model.monthLabel(new Date().getFullYear(), new Date().getMonth())));
  assert.ok(texts.includes("Linear Algebra"), "the day panel lists the class");
});
