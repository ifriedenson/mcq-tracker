"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

test("course health: each row is actionable and names the warnings", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const subjects = T.studyWorkspace.normalizeSubjectManager({ subjects: [{ name: "Biology", folder: "Biology" }] }).subjects;
  plugin.settings.subjectManager = { ...plugin.settings.subjectManager, subjects };
  await plugin.addCourseGrade({ course: "Biology", title: "Midterm", score: 42, weight: 1, date: "2026-10-01" });

  const report = T.courseHealth.courseHealthReport({
    courses: T.studyWorkspace.courseDashboard(subjects, [], [], plugin.settings.courseHub.grades, { settings: plugin.calendarSettings() }),
    plans: [],
    tasks: [],
    exams: [],
    settings: plugin.calendarSettings(),
    today: "2026-11-03",
    ...plugin.settings.courseHealth,
  });
  assert.ok(report.rows.length, "the fixture builds one course");

  const dom = makeDom();
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.contentEl = dom.root;
  view.tab = "health";
  view.render();
  const texts = dom.texts();
  assert.ok(texts.includes("Course health"), "the tab renders");
  assert.ok(texts.some((text) => text.startsWith("Biology")), texts.join(" | "));
  assert.ok(texts.includes("Overview"), "the row offers the existing course overview");
  assert.ok(
    texts.some((text) => /warning$|warnings to clear$/.test(text)),
    "a row with warnings says how many are left: " + texts.join(" | ")
  );
});
