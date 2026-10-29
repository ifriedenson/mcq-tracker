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
    uid: "e1",
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
  assert.match(body, /calendar_uid: e1/);
  assert.match(body, /calendar_date: 2026-10-05/);
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

test("breaks: gaps between classes respect the minimum and maximum and skip all-day events", () => {
  const settings = model.mergeCalendarSettings({ timelineGaps: { enabled: true, minMinutes: 15, maxMinutes: 120 } });
  const at = (h, m) => new Date(2026, 9, 5, h, m || 0);
  const events = [
    { summary: "Reading day", allDay: true, dtstart: new Date(2026, 9, 5), dtend: new Date(2026, 9, 6) },
    { summary: "A", allDay: false, dtstart: at(9), dtend: at(10) },
    { summary: "B", allDay: false, dtstart: at(10, 10), dtend: at(11) },
    { summary: "C", allDay: false, dtstart: at(12), dtend: at(13) },
    { summary: "D", allDay: false, dtstart: at(15), dtend: at(16) },
  ];
  const entries = model.timelineEntries(events, settings);
  assert.deepEqual(entries.filter((e) => e.kind === "gap").map((e) => e.minutes), [60, 120]);
  assert.equal(entries[0].event.summary, "Reading day", "all-day events stay first");

  settings.timelineGaps.maxMinutes = 30;
  assert.deepEqual(model.timelineEntries(events, settings).filter((e) => e.kind === "gap"), []);
  settings.timelineGaps.maxMinutes = 0;
  settings.timelineGaps.enabled = false;
  assert.equal(model.timelineEntries(events, settings).filter((e) => e.kind === "gap").length, 0);

  assert.equal(model.gapLabel(90), "1h 30m");
  assert.equal(model.gapLabel(60), "1h");
  assert.equal(model.gapLabel(15), "15m");

  const fallback = model.mergeCalendarSettings({ timelineGaps: { style: "nope", icon: "nope", minMinutes: 0, maxMinutes: -2 } });
  assert.deepEqual(fallback.timelineGaps, { enabled: false, style: "pill", icon: "coffee", minMinutes: 15, maxMinutes: 0 });
  assert.equal(model.mergeCalendarSettings({ timelineGaps: { enabled: true } }).timelineGaps.enabled, true);
});

test("free time: unbooked minutes between the first and last timed class", () => {
  const at = (h, m) => new Date(2026, 9, 5, h, m || 0);
  const cls = (summary, sh, sm, eh, em) => ({ summary, allDay: false, dtstart: at(sh, sm), dtend: at(eh, em) });
  const allDay = { summary: "Reading day", allDay: true, dtstart: new Date(2026, 9, 5), dtend: new Date(2026, 9, 6) };
  const events = [allDay, cls("A", 9, 0, 10, 0), cls("B", 10, 30, 11, 30), cls("C", 12, 0, 13, 0)];

  assert.equal(model.dayFreeMinutes(events), 60, "30 minutes before B and 30 before C");
  assert.equal(model.dayFreeMinutes([...events, cls("D", 9, 30, 12, 30)]), 0, "classes can cover the whole span");
  assert.equal(model.dayFreeMinutes([events[1]]), 0, "one class has no free time to measure");
  assert.equal(model.dayFreeMinutes([]), 0);
  assert.equal(
    model.dayFreeMinutes([cls("A", 9, 0, 11, 0), cls("B", 10, 0, 10, 30), cls("C", 12, 0, 13, 0)]),
    60,
    "the shared hour is not counted twice"
  );

  const slots = model.freeSlots(events);
  assert.deepEqual(slots.map((s) => s.minutes), [30, 30]);
  assert.equal(model.freeSlots(events, { minMinutes: 31 }).length, 0, "the same engine can filter short breaks");
  const entries = model.timelineEntries(events, model.mergeCalendarSettings({ timelineGaps: { enabled: true, minMinutes: 15 } }));
  assert.equal(entries.find((e) => e.kind === "gap").nextEvent.summary, "B", "a marker knows the class after the break");
  assert.equal(model.mergeCalendarSettings({ studySlotBufferMinutes: 0 }).studySlotBufferMinutes, 0);
  assert.equal(model.mergeCalendarSettings({ studySlotBufferMinutes: 99 }).studySlotBufferMinutes, 5);
});

test("calendar settings: maximum width is bounded and 0 means the full pane", () => {
  assert.equal(model.mergeCalendarSettings({}).calendarMaxWidth, 0);
  assert.equal(model.mergeCalendarSettings({ calendarMaxWidth: 640 }).calendarMaxWidth, 640);
  assert.equal(model.mergeCalendarSettings({ calendarMaxWidth: 9999 }).calendarMaxWidth, 1600);
  assert.equal(model.mergeCalendarSettings({ calendarMaxWidth: -5 }).calendarMaxWidth, 0);
  assert.equal(model.mergeCalendarSettings({ calendarMaxWidth: "nope" }).calendarMaxWidth, 0);
});

test("settings: module and calendar navigation groups expose the requested tabs", () => {
  assert.deepEqual(T.SETTINGS_MODULES.map((m) => m.id), ["global", "mcq", "cards", "calendar", "assignments", "reference"]);
  assert.deepEqual(T.MCQ_TABS.map((t) => t.id), ["practice", "review", "daily", "ai", "about"]);
  assert.deepEqual(T.CALENDAR_TABS.map((t) => t.label), [
    "About",
    "Schedules & Sync",
    "Notes & Templates",
    "Exclusions",
    "Appearance & Colors",
    "Language & Region",
  ]);

  const dom = makeDom();
  let picked = "";
  T.renderSettingsTabs(dom.root, T.CALENDAR_TABS, "notes", (id) => (picked = id));
  const buttons = dom.all.filter((o) => o.meta && o.meta.tag === "button");
  assert.equal(buttons.length, T.CALENDAR_TABS.length);
  const active = buttons.find((o) => o.meta.cls && o.meta.cls.includes("is-active"));
  assert.ok(active, "the current tab is marked active");
  active.handlers.find((h) => h.ev === "click").fn();
  assert.equal(picked, "notes", "clicking a tab reports its id");
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
  assert.deepEqual(Object.keys(plugin.codeBlocks).sort(), ["mcq-dashboard", "mcq-schedule", "uni-calendar", "uni-schedule"]);
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
  const actual = app.files.find((f) => f.path === result.path);
  assert.ok(file, "the note is written");
  assert.ok(actual, "the note is in the vault");
  assert.ok(result.path.startsWith("University/Linear Algebra/"), result.path);
  assert.match(file.text, /course: "Linear Algebra"/);
  assert.match(file.text, /Room 204/);
  assert.deepEqual(app.opened, [result.path], "the new note opens");
  assert.equal(notes.notePathFor(app, plugin.calendarSettings(), ev, ev.dateKey), result.path);
  assert.equal(plugin.settings.calendar.subjectFolders["Linear Algebra"], "University/Linear Algebra");
  assert.equal(actual.fm.calendar_uid, "today");
  assert.equal(actual.fm.calendar_date, ev.dateKey);

  // Moving or renaming the note must not make the calendar create a duplicate.
  actual.path = "Moved/Linear Algebra.md";
  actual.parent = { path: "Moved" };
  let folderScans = 0;
  const loadedFiles = app.vault.getAllLoadedFiles;
  app.vault.getAllLoadedFiles = () => {
    folderScans++;
    return loadedFiles();
  };
  plugin.invalidateCalendarNotes();
  assert.equal(plugin.findCalendarNote(ev, ev.dateKey).path, "Moved/Linear Algebra.md");
  const scansAfterFirst = folderScans;
  plugin.findCalendarNote(ev, ev.dateKey);
  plugin.findCalendarNote(ev, ev.dateKey);
  assert.equal(folderScans, scansAfterFirst, "the folder list is reused between cards");
  const again = await plugin.openClassNote(ev, ev.dateKey);
  assert.equal(again.created, false);
  assert.equal(again.path, "Moved/Linear Algebra.md");
  assert.equal(app.created.filter((f) => f.path.endsWith("Linear Algebra.md")).length, 1);
});

test("view: shows the module hint while off and a month grid once a schedule exists", async () => {
  const { app, plugin } = await pluginWith(TODAY_EVENT());
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().some((t) => /calendar is off/i.test(t)));

  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  const dom2 = makeDom();
  view.contentEl = dom2.root;
  view.render();
  const texts = dom2.texts();
  assert.ok(texts.includes("Month"));
  assert.ok(texts.includes(model.monthLabel(new Date().getFullYear(), new Date().getMonth())));
  assert.ok(texts.includes("Linear Algebra"), "the day panel lists the class");
});

test("view: clicking a different day keeps the month grid and redraws the schedule below it", async () => {
  const today = new Date();
  const other = new Date(today.getFullYear(), today.getMonth(), today.getDate() === 1 ? 2 : 1);
  const offset = other.getDate() - today.getDate();
  const icsText = wrap(
    event({ uid: "today", start: stamp(at(0, 10)), end: stamp(at(0, 11)) }),
    event({ uid: "other", summary: "Physics", start: stamp(at(offset, 10)), end: stamp(at(offset, 11)) })
  );
  const { app, plugin } = await pluginWith(icsText);
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  const key = ics.dateKey(other);
  const cell = dom.all.find((o) => o.meta && o.meta.attrs && o.meta.attrs["data-date"] === key);
  assert.ok(cell, "the month grid has a cell for the other day");
  for (const handler of cell.handlers.filter((h) => h.ev === "click")) await handler.fn({});

  assert.equal(view.mode, "month", "selecting a day must not switch to the day view");
  assert.equal(view.selectedKey, key, "the clicked day becomes the selected day");
  const texts = dom.texts();
  assert.ok(texts.includes(model.monthLabel(new Date().getFullYear(), new Date().getMonth())), "the month grid is still there");
  assert.ok(texts.includes(model.dayHeading(key)), "the panel names the selected day");
  assert.ok(texts.includes("Physics"), "the panel lists the selected day's class");
});

test("view: the Day tab is a standalone day without the month grid", async () => {
  const { app, plugin } = await pluginWith(TODAY_EVENT());
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  await dom.click("Day");
  assert.equal(view.mode, "day");

  const dayDom = makeDom();
  view.contentEl = dayDom.root;
  view.render();
  const texts = dayDom.texts();
  assert.ok(texts.includes(model.dayHeading(ics.dateKey(new Date()))));
  assert.ok(!texts.includes(model.monthLabel(new Date().getFullYear(), new Date().getMonth())));
  assert.ok(!dayDom.all.some((o) => o.meta && o.meta.cls === "uni-days-grid"), "the month grid is gone");
});

test("view: break markers appear between classes and follow the style setting", async () => {
  const icsText = wrap(
    event({ uid: "a", start: stamp(at(0, 9)), end: stamp(at(0, 10)) }),
    event({ uid: "b", summary: "Physics", start: stamp(at(0, 11, 30)), end: stamp(at(0, 12, 30)) })
  );
  const { app, plugin } = await pluginWith(icsText);
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  const toggle = dom.all.find((o) => o.meta && o.meta.attrs && /Show breaks between classes/i.test(o.meta.attrs["aria-label"] || ""));
  assert.ok(toggle, "the header has a break toggle");
  for (const handler of toggle.handlers.filter((h) => h.ev === "click")) await handler.fn({});
  assert.equal(plugin.settings.calendar.timelineGaps.enabled, true);
  assert.ok(
    dom.all.some((o) => o.meta && /uni-timeline-gap/.test(String(o.meta.cls || ""))),
    "the free period has a break marker"
  );
  assert.ok(dom.texts().some((t) => t.includes("1h 30m")), "the free period is labelled");

  plugin.settings.calendar.timelineGaps.style = "card";
  const cardDom = makeDom();
  view.contentEl = cardDom.root;
  view.render();
  assert.ok(cardDom.texts().includes("Free period / Break"), "the card style is used");

  const offToggle = cardDom.all.find((o) => o.meta && o.meta.attrs && /Hide breaks between classes/i.test(o.meta.attrs["aria-label"] || ""));
  assert.ok(offToggle, "the header toggle reflects the on state");
  for (const handler of offToggle.handlers.filter((h) => h.ev === "click")) await handler.fn({});
  assert.equal(plugin.settings.calendar.timelineGaps.enabled, false);

  const offDom = makeDom();
  view.contentEl = offDom.root;
  view.render();
  assert.ok(
    !offDom.all.some((o) => o.meta && /uni-timeline-(gap|break)/.test(String(o.meta.cls || ""))),
    "turning breaks off removes the marker"
  );
});

test("view: upcoming exams are restored with countdowns", async () => {
  const icsText = wrap(event({ uid: "final", summary: "Calculus - Final Exam", start: stamp(at(7, 9)), end: stamp(at(7, 11)) }));
  const { app, plugin } = await pluginWith(icsText);
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("Upcoming exams"), "the exam panel is back");
  assert.ok(dom.texts().includes("Calculus - Final Exam"));
  assert.ok(dom.texts().some((text) => /in 7 days/.test(text)), "the exam countdown is shown");
  const row = dom.all.find((o) => o.meta && o.meta.cls === "uni-exam-row");
  assert.ok(row && row.meta.tag === "button", "exam rows are real buttons");
});

test("view: an exam's attached AP resource is shown with an open action", async () => {
  const icsText = wrap(event({ uid: "final", summary: "AP Biology Exam", start: stamp(at(7, 9)), end: stamp(at(7, 11)) }));
  const resourcePath = "AP resources/AP Biology/Released FRQs.md";
  const app = makeApp([
    { path: "schedule.ics", text: icsText, noFm: true },
    {
      path: resourcePath,
      fm: {
        type: "ap_resource",
        ap_course: "ap-biology",
        course: "AP Biology",
        resource_type: "practice",
        source_url: "https://apcentral.collegeboard.org/courses/ap-biology/exam/past-exam-questions",
        checked_on: local(new Date()),
        official: true,
        exam_uid: "final",
        exam_date: local(at(7, 9)),
        exam_title: "AP Biology Exam",
      },
      text: "An official AP resource link.",
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  plugin.settings.reference.enabled = true;
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("Attached: Released FRQs"), "the attached resource appears beside its exam");
  await dom.click("Open");
  assert.deepEqual(app.opened, [resourcePath]);
});

test("view: free time opens a study-slot chooser with durations and a buffer", async () => {
  const icsText = wrap(
    event({ uid: "a", start: stamp(at(0, 9)), end: stamp(at(0, 10)) }),
    event({ uid: "b", summary: "Physics", start: stamp(at(0, 12)), end: stamp(at(0, 13)) })
  );
  const app = makeApp([
    { path: "schedule.ics", text: icsText, noFm: true },
    { path: "questions/q1.md", fm: { question_id: "q1", course: "Linear Algebra", attempts: 1, next_review: "2020-01-01" } },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;

  const modal = new T.StudySlotModal(app, plugin, [
    { start: at(0, 10), end: at(0, 12), minutes: 120, subject: "Linear Algebra" },
  ]);
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.onOpen();
  const texts = dom.texts();
  assert.ok(texts.includes("Study in your free time"));
  assert.ok(texts.some((t) => /1h 55m usable/.test(t)), "the 5-minute buffer is deducted");
  assert.ok(texts.includes("Start 5 minutes"), "the default Quick Practice length is offered");
  assert.ok(texts.some((t) => /Next class: Linear Algebra \(1\)/.test(t)), "the next class filter has a count");

  let captured = null;
  plugin.activateView = async () => ({ startQuick: async (...args) => (captured = args) });
  modal.close = () => {};
  const select = dom.all.find((o) => o.meta && o.meta.tag === "select");
  select.value = "course";
  for (const handler of select.handlers.filter((h) => h.ev === "change")) await handler.fn({});
  const start = dom.find("Start 5 minutes")[0];
  assert.ok(start, "the start button is present");
  for (const handler of start.handlers.filter((h) => h.ev === "click")) await handler.fn({});
  assert.equal(captured[0], "time");
  assert.equal(captured[1], 5);
  assert.equal(captured[2].pool.length, 1, "the next-class pool is passed to Quick Practice");
  assert.match(captured[2].label, /Linear Algebra/);
});

test("view: a study block can attach and detach an AP resource", async () => {
  const icsText = wrap(
    event({ uid: "a", summary: "AP Biology", start: stamp(at(0, 9)), end: stamp(at(0, 10)) }),
    event({ uid: "b", summary: "Physics", start: stamp(at(0, 12)), end: stamp(at(0, 13)) })
  );
  const resourcePath = "AP resources/AP Biology/Released FRQs.md";
  const app = makeApp([
    { path: "schedule.ics", text: icsText, noFm: true },
    {
      path: resourcePath,
      fm: {
        type: "ap_resource",
        ap_course: "ap-biology",
        course: "AP Biology",
        resource_type: "practice",
        source_url: "https://apcentral.collegeboard.org/courses/ap-biology/exam/past-exam-questions",
        checked_on: local(new Date()),
        official: true,
      },
      text: "An official AP resource link.",
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  plugin.settings.reference.enabled = true;

  const slot = { start: at(0, 10), end: at(0, 12), minutes: 120, subject: "AP Biology" };
  const modal = new T.StudySlotModal(app, plugin, [slot]);
  modal.close = () => {};
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.onOpen();

  assert.ok(dom.texts().some((text) => text.includes("Suggested: Released FRQs")), "the next class's resource is suggested");
  await dom.click("Attach to this block");
  assert.equal(app.files[1].fm.study_slot_date, local(slot.start));
  assert.equal(app.files[1].fm.study_slot_start, "10:00");
  assert.ok(dom.texts().some((text) => text.includes("Attached: Released FRQs")));
  await dom.click("Detach");
  assert.equal(app.files[1].fm.study_slot_date, undefined, "detaching clears the block binding");
  assert.ok(dom.texts().some((text) => text.includes("Suggested: Released FRQs")));
});

test("view: day cells and class cards are keyboard operable", async () => {
  const { app, plugin } = await pluginWith(TODAY_EVENT());
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  const todayKey = ics.dateKey(new Date());
  const cell = dom.all.find((o) => o.meta && o.meta.attrs && o.meta.attrs["data-date"] === todayKey);
  assert.ok(cell);
  assert.equal(cell.meta.attrs.role, "gridcell");
  assert.equal(cell.meta.attrs.tabindex, "0");
  const card = dom.all.find((o) => o.meta && String(o.meta.cls || "") === "uni-event-card");
  assert.ok(card);
  assert.equal(card.meta.attrs.role, "button");
  assert.equal(card.meta.attrs.tabindex, "0");

  const keydown = cell.handlers.find((h) => h.ev === "keydown");
  assert.ok(keydown, "a day cell listens for keys");
  await keydown.fn({ key: "ArrowRight", preventDefault() {}, stopPropagation() {} });
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.equal(view.selectedKey, ics.dateKey(tomorrow));
});

test("plugin: source edits invalidate the cache and the range follows the viewed month", async () => {
  const base = wrap(event({ uid: "a", start: stamp(at(0, 9)), end: stamp(at(0, 10)) }));
  const { plugin } = await pluginWith(base);
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;

  const edited = base.replace("T090000", "T110000").replace("T100000", "T120000");
  assert.equal(edited.length, base.length);
  assert.equal(edited.slice(0, 40), base.slice(0, 40));
  plugin.settings.calendar.sources[0].content = edited;
  assert.equal(plugin.calendarEvents()[0].dtstart.getHours(), 11, "a same-length edit is not lost in the cache");

  const far = new Date();
  far.setMonth(far.getMonth() + 8);
  far.setHours(9, 0, 0, 0);
  const farEnd = new Date(far.getTime() + 60 * 60 * 1000);
  plugin.settings.calendar.sources[0].content = wrap(event({ uid: "far", summary: "Far class", start: stamp(far), end: stamp(farEnd) }));
  assert.equal(plugin.calendarEvents().length, 0, "the current window does not see eight months ahead");
  assert.equal(plugin.calendarEvents(far).length, 1, "asking for the viewed month expands the range");
});

test("view: a maximum calendar width centers the calendar container", async () => {
  const { app, plugin } = await pluginWith(TODAY_EVENT());
  plugin.settings.calendar.calendarMaxWidth = 640;
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.equal(dom.root.style.maxWidth, "640px");
  assert.equal(dom.root.style.marginLeft, "auto");
  assert.equal(dom.root.style.marginRight, "auto");

  plugin.settings.calendar.calendarMaxWidth = 0;
  view.render();
  assert.equal(dom.root.style.maxWidth, "", "0 returns the calendar to full width");
});

test("view: the day header shows free time beside the class count", async () => {
  const icsText = wrap(
    event({ uid: "a", start: stamp(at(0, 9)), end: stamp(at(0, 10)) }),
    event({ uid: "b", summary: "Physics", start: stamp(at(0, 12)), end: stamp(at(0, 13)) })
  );
  const { app, plugin } = await pluginWith(icsText);
  await plugin.addCalendarFileSource("schedule.ics");
  plugin.settings.calendar.enabled = true;
  const dom = makeDom();
  const view = new T.CalendarView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("2 classes"));
  const badge = dom.find("2h free")[0];
  assert.ok(badge, "the day's free time is shown in the header");
  assert.equal(badge.meta.cls, "uni-schedule-badge-free");
  assert.match(badge.meta.attrs.title, /first and last class/);

  const single = await pluginWith(wrap(event({ uid: "a", start: stamp(at(0, 9)), end: stamp(at(0, 10)) })));
  await single.plugin.addCalendarFileSource("schedule.ics");
  single.plugin.settings.calendar.enabled = true;
  const singleDom = makeDom();
  const singleView = new T.CalendarView({ app: single.app }, single.plugin);
  singleView.app = single.app;
  singleView.contentEl = singleDom.root;
  singleView.render();
  assert.ok(!singleDom.texts().some((t) => / free$/.test(t)), "a single class has no free-time badge");
});

test("stylesheet: ported calendar selectors stay scoped to the calendar or its modal", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const css = fs
    .readFileSync(path.join(__dirname, "..", "styles.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const roots = [":is(.uni-calendar-container, .uni-schedule-embed)", ".uni-calendar-container", ".uni-schedule-embed"];
  const isRoot = (s) => roots.some((root) => s === root || s.startsWith(root + " ") || s.startsWith(root + ".") || s.startsWith(root + ":"));
  const isModal = (s) => /^\.uni-(modal-title|modal-filter-pills|study-slot)(?:\b|$)/.test(s);
  const splitSelectors = (text) => {
    const out = [];
    let buf = "";
    let depth = 0;
    for (const ch of text) {
      if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        if (buf.trim()) out.push(buf.trim());
        buf = "";
      } else buf += ch;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  };
  const unscoped = [];
  for (const match of css.matchAll(/([^{}]+)\{/g)) {
    for (const selector of splitSelectors(match[1])) {
      if (selector.includes(".uni-") && !isRoot(selector) && !isModal(selector)) unscoped.push(selector);
    }
  }
  assert.deepEqual(unscoped, [], `global calendar selectors: ${unscoped.join(" | ")}`);
});
