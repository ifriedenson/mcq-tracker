"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const model = require("../src/calendar-model");
const { Plugin: QT } = load();

test("the semester transition stamps only courses that have no label", () => {
  const result = model.rolloverCourses(
    [
      { name: "Biology", semester: "" },
      { name: "Chemistry", semester: "Fall 2025" },
    ],
    "Spring 2027"
  );
  assert.equal(result.stamped, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.courses[0].semester, "Spring 2027");
  assert.equal(result.courses[1].semester, "Fall 2025", "a labelled course keeps its term");
  assert.equal(result.courses[0].id, "biology", "the registry shape is unchanged");

  const blank = model.rolloverCourses([{ name: "Biology" }], "  ");
  assert.equal(blank.stamped, 0, "no label stamps nothing");
  assert.equal(blank.courses[0].semester, "");
});

test("starting the next semester moves the term window and leaves courses alone", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.courses = [
    { id: "bio", name: "Biology", semester: "" },
    { id: "chem", name: "Chemistry", semester: "Fall 2025" },
  ];

  const result = await plugin.rolloverSemester({ label: "Spring 2027", start: "2027-01-12", end: "2027-05-07" });
  assert.equal(result.stamped, 1);
  assert.equal(plugin.settings.calendar.semesterStart, "2027-01-12");
  assert.equal(plugin.settings.calendar.semesterEnd, "2027-05-07");
  assert.equal(plugin.settings.calendar.courses.find((course) => course.id === "chem").semester, "Fall 2025");
  assert.equal(plugin.settings.calendar.courses.find((course) => course.id === "bio").semester, "Spring 2027");
  assert.equal(typeof plugin.openSemesterRollover, "function");
});

test("a rollover without a usable start date changes nothing", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.semesterStart = "2026-09-01";

  const result = await plugin.rolloverSemester({ label: "Spring 2027", start: "next week" });
  assert.equal(result, null);
  assert.equal(plugin.settings.calendar.semesterStart, "2026-09-01");
  assert.ok(obsidian.notices.includes("Pick the first day of the new semester."), obsidian.notices.join(" | "));
});

test("an end date before the new start is dropped rather than stored backwards", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();

  const result = await plugin.rolloverSemester({ label: "Spring 2027", start: "2027-01-12", end: "2026-12-01" });
  assert.equal(result.start, "2027-01-12");
  assert.equal(result.end, "");
  assert.equal(plugin.settings.calendar.semesterEnd, "");
  assert.equal(plugin.settings.calendar.semesterStart, "2027-01-12");
});
