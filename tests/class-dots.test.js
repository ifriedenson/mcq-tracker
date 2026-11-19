"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const D = T.classDots;

function meeting(course, key) {
  return { course, name: course, key, label: `${course} class` };
}

test("class dots: meetings normalize and bad rows drop out", () => {
  assert.equal(D.normalizeMeeting(null), null);
  assert.equal(D.normalizeMeeting({ course: "", key: "2026-11-19" }), null);
  assert.equal(D.normalizeMeeting({ course: "Bio", key: "tomorrow" }), null);
  assert.deepEqual(D.normalizeMeeting({ course: "  Biology 101 ", key: "2026-11-19" }), {
    course: "biology 101",
    name: "Biology 101",
    key: "2026-11-19",
    label: "",
    event: null,
  });
});

test("class dots: held beats checked beats empty, ordered by day", () => {
  const built = D.buildClassDots({
    meetings: [meeting("Biology", "2026-11-19"), meeting("Biology", "2026-11-12"), meeting("Chemistry", "2026-11-19")],
    noted: ["biology|2026-11-12"],
    checked: ["biology|2026-11-19", "chemistry|2026-11-19"],
    termStart: "2026-09-01",
    termEnd: "2026-12-31",
  });
  assert.equal(built.total, 3);
  const biology = built.courses.find((course) => course.course === "biology");
  assert.deepEqual(
    biology.dots.map((dot) => [dot.key, dot.state]),
    [
      ["2026-11-12", "held"],
      ["2026-11-19", "checked"],
    ]
  );
  const chemistry = built.courses.find((course) => course.course === "chemistry");
  assert.equal(chemistry.dots[0].state, "checked");
});

test("class dots: term windows and the cap keep the hub row small", () => {
  const meetings = [];
  for (let day = 1; day <= 100; day++) {
    meetings.push(meeting("Biology", `2026-09-${String(day).padStart(2, "0")}`.slice(0, 10)));
  }
  const built = D.buildClassDots({ meetings, termStart: "2026-09-01", termEnd: "2026-12-31", cap: 10 });
  const biology = built.courses[0];
  assert.equal(biology.dots.length, 10);
  assert.equal(biology.overflow, 90);
  const filtered = D.buildClassDots({ meetings, termStart: "2026-10-01", termEnd: "2026-10-31" });
  assert.equal(filtered.total, 0, "september meetings fall outside an october term");
  assert.ok(D.MAX_DOTS > 0);
});

test("plugin: the course hub gets one dot per scheduled class meeting", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  const today = T.util.localDate();
  const at = (hour) => new Date(`${today}T${String(hour).padStart(2, "0")}:00:00`);
  plugin.calendarEvents = () => [
    { summary: "Biology 101", course: "Biology", dateKey: today, dtstart: at(9), dtend: at(10), termReadingWeek: false, foreign: false },
    { summary: "Chemistry 101", course: "Chemistry", dateKey: today, dtstart: at(11), dtend: at(12), termReadingWeek: false, foreign: false },
  ];
  const data = plugin.classDotsData();
  assert.equal(data.total, 2);
  assert.deepEqual(
    data.courses.map((course) => course.course).sort(),
    ["biology", "chemistry"]
  );
  assert.ok(data.courses.every((course) => course.dots.every((dot) => dot.state === "empty")));
});

test("plugin: a logged lecture with a note fills the dot, an absence rings it", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  const today = T.util.localDate();
  const at = (hour) => new Date(`${today}T${String(hour).padStart(2, "0")}:00:00`);
  plugin.calendarEvents = () => [
    { summary: "Biology 101", course: "Biology", dateKey: today, dtstart: at(9), dtend: at(10), termReadingWeek: false, foreign: false },
    { summary: "Chemistry 101", course: "Chemistry", dateKey: today, dtstart: at(11), dtend: at(12), termReadingWeek: false, foreign: false },
  ];
  plugin.settings.lectureLog = { enabled: true, lectures: [{ course: "Biology", title: "Cells", date: today, notePath: "Notes/cells.md" }] };
  plugin.settings.subjectManager = { enabled: true, subjects: [], absences: [{ subject: "Chemistry", date: today }] };
  const data = plugin.classDotsData();
  const biology = data.courses.find((course) => course.course === "biology");
  const chemistry = data.courses.find((course) => course.course === "chemistry");
  assert.equal(biology.dots[0].state, "held");
  assert.equal(chemistry.dots[0].state, "checked");
});
