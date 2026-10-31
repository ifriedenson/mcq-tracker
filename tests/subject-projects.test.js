"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const W = T.studyWorkspace;

test("subject projects: normalize with due dates, done state and caps", () => {
  const subject = W.createSubject({
    name: "Biology",
    folder: "Courses/Biology",
    projects: [
      { title: "Cell lab report", due: "2026-11-05" },
      { title: "Ecology presentation", due: "2026-12-01", done: true },
      { title: "" },
    ],
  }, 1000);
  assert.equal(subject.projects.length, 2);
  assert.equal(subject.projects[1].done, true);
  assert.equal(subject.projects[0].due, "2026-11-05");
  assert.equal(W.createSubject({ name: "Chemistry", projects: [{ title: "Titration", due: "bogus" }] }, 1).projects[0].due, "");
});

test("subject projects: summary reports open, done, next and attendance", () => {
  const subject = W.createSubject({ name: "Biology", projects: [
    { title: "Lab report", due: "2026-11-05" },
    { title: "Presentation", due: "2026-11-01" },
    { title: "Essay", due: "2026-12-01", done: true },
  ] }, 1);
  const lectures = [
    { course: "Biology", date: "2026-10-01", title: "Cells" },
    { course: "Biology", date: "2026-10-08", title: "Genes" },
    { course: "Biology", date: "2026-10-15", title: "Ecology" },
  ];
  const absences = [{ subject: "Biology", date: "2026-10-08", reason: "Medical" }];
  const [summary] = W.subjectSummary([subject], absences, lectures);
  assert.equal(summary.openProjects, 2);
  assert.equal(summary.doneProjects, 1);
  assert.equal(summary.nextProject.title, "Presentation");
  assert.equal(summary.attendance, 75);
  assert.equal(summary.lectures, 3);
});

test("subject projects: plugin adds, toggles and removes a project", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const subject = await plugin.addStudySubject({ name: "Biology" });
  const project = await plugin.addStudyProject({ subject: "biology", title: "Lab report", due: "2026-11-05" });
  assert.equal(project.title, "Lab report");
  assert.equal(plugin.settings.subjectManager.subjects[0].projects.length, 1);
  const toggled = await plugin.toggleStudyProject(subject.id, project.id);
  assert.equal(toggled.done, true);
  assert.equal(plugin.settings.subjectManager.subjects[0].projects[0].done, true);
  await plugin.removeStudyProject(subject.id, project.id);
  assert.equal(plugin.settings.subjectManager.subjects[0].projects.length, 0);
  assert.equal(await plugin.addStudyProject({ subject: "missing", title: "Nope" }), null);
});
