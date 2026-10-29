"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const A = T.assignments;

function parsed(fm, text, settings) {
  return A.parseAssignment({ path: `Assignments/${fm.assignment_id || "note"}.md`, basename: fm.assignment_id || "note" }, { assignment: true, ...fm }, text || "", settings || A.normalizeAssignmentSettings({}));
}

test("assignments: parse a Tasks line, its date and its checked state", () => {
  const text = "- [ ] Lab report ⏳ 2026-11-02 🔁 every week\n\nBody.\n";
  const open = parsed({ course: "Biology", type: "lab" }, text);
  assert.equal(open.title, "Lab report");
  assert.equal(open.due, "2026-11-02");
  assert.equal(open.type, "project");
  assert.equal(open.category, "project");
  assert.equal(open.status, "todo");

  const checked = parsed({ course: "Biology", type: "quiz" }, "- [x] Quiz 4 📅 2026-11-03\n");
  assert.equal(checked.due, "2026-11-03");
  assert.equal(checked.status, "submitted");
  assert.equal(checked.done, true);

  const fromFrontmatter = parsed({ due: "2026-12-01", type: "essay", category: "project" }, "- [ ] Essay 📅 2026-11-01\n");
  assert.equal(fromFrontmatter.due, "2026-12-01", "frontmatter wins over the task line");
  assert.equal(fromFrontmatter.category, "project");
});

test("assignments: weighted categories, missing work and ungraded submissions", () => {
  const settings = A.normalizeAssignmentSettings({
    categories: [
      { id: "homework", weight: 40 },
      { id: "quiz", weight: 60 },
    ],
    targetGrade: 90,
    finalWeight: 20,
  });
  const rows = [
    parsed({ assignment_id: "h1", course: "Bio", type: "homework", status: "graded", points: 100, score: 80 }, "", settings),
    parsed({ assignment_id: "h2", course: "Bio", type: "homework", status: "graded", points: 100, score: 100 }, "", settings),
    parsed({ assignment_id: "q1", course: "Bio", type: "quiz", status: "graded", points: 100, score: 70 }, "", settings),
  ];
  const stats = A.assignmentStats(rows, settings, { today: "2026-10-29" });
  assert.equal(stats.courses[0].current, 78);
  assert.equal(stats.courses[0].letter, "C+");
  assert.equal(stats.courses[0].categories.find((c) => c.id === "homework").percent, 90);
  assert.equal(stats.courses[0].neededFinal, 138);

  const withMissing = [
    parsed({ assignment_id: "h3", course: "Bio", type: "homework", status: "graded", points: 100, score: 100 }, "", settings),
    parsed({ assignment_id: "h4", course: "Bio", type: "homework", status: "missing" }, "", settings),
    parsed({ assignment_id: "h5", course: "Bio", type: "homework", status: "submitted" }, "", settings),
  ];
  const missingStats = A.assignmentStats(withMissing, settings, { today: "2026-10-29" });
  assert.equal(missingStats.courses[0].categories.find((c) => c.id === "homework").percent, 50, "missing is zero and submitted is left out");
});

test("assignments: the final-score target and credit-weighted GPA", () => {
  assert.equal(A.neededOnFinal(80, 90, 20), 130);
  assert.equal(A.neededOnFinal(95, 90, 20), 70);
  assert.equal(A.neededOnFinal(null, 90, 20), null);
  assert.equal(A.neededOnFinal(80, 90, 0), null);

  const settings = A.normalizeAssignmentSettings({
    courses: [
      { name: "Biology", credits: 4 },
      { name: "Chemistry", credits: 3 },
    ],
  });
  const rows = [
    parsed({ assignment_id: "b1", course: "Biology", type: "homework", status: "graded", points: 100, score: 90 }, "", settings),
    parsed({ assignment_id: "c1", course: "Chemistry", type: "homework", status: "graded", points: 100, score: 85 }, "", settings),
  ];
  const stats = A.assignmentStats(rows, settings, { today: "2026-10-29" });
  assert.equal(stats.gpa, 3.4);
  assert.equal(stats.unweightedGpa, 3.35);
  assert.equal(stats.credits, 7);
  assert.equal(stats.courses.find((c) => c.course === "Biology").letter, "A-");
});

test("assignments: due states and the daily task order", () => {
  const settings = A.normalizeAssignmentSettings({});
  const rows = [
    parsed({ assignment_id: "old", title: "Old essay", course: "Bio", due: "2026-10-27", type: "essay" }, "", settings),
    parsed({ assignment_id: "today", title: "Today quiz", course: "Bio", due: "2026-10-29", type: "quiz" }, "", settings),
    parsed({ assignment_id: "later", title: "Later paper", course: "Bio", due: "2026-11-20", type: "paper" }, "", settings),
    parsed({ assignment_id: "done", title: "Done", course: "Bio", due: "2026-10-27", status: "submitted" }, "", settings),
  ];
  const tasks = A.assignmentTasks(rows, { today: "2026-10-29", days: 14 });
  assert.deepEqual(tasks.map((t) => t.assignment.id), ["old", "today"]);
  assert.equal(tasks[0].state.id, "overdue");
  assert.equal(tasks[1].state.label, "Due today");

  const daily = A.buildDailyTasks({ reviewCount: 12, assignments: rows, today: "2026-10-29" });
  assert.equal(daily[0].title, "Review 12 due items");
  assert.equal(daily[1].title, "Old essay");
  assert.equal(daily[2].title, "Today quiz");
});

test("assignments: markdown keeps frontmatter and a Tasks-compatible due date", () => {
  const md = A.assignmentMarkdown({ title: "Problem Set", course: "Physics", type: "homework", due: "2026-11-01", points: 20, score: 18 }, new Date("2026-10-01T12:00:00"));
  assert.match(md, /assignment: true/);
  assert.match(md, /course: Physics/);
  assert.match(md, /score: 18/);
  assert.match(md, /- \[ \] Problem Set 📅 2026-11-01/);

  const text = `---\nassignment: true\n---\n\n- [ ] Problem Set 📅 2026-11-01\n`;
  assert.match(A.updateTaskCheckbox(text, true), /- \[x\] Problem Set/);
  assert.match(A.updateTaskCheckbox(A.updateTaskCheckbox(text, true), false), /- \[ \] Problem Set/);
  assert.match(A.updateTaskDue(text, "2026-12-15"), /📅 2026-12-15/);
  assert.match(A.updateTaskTitle(text, "Revised title"), /- \[ \] Revised title 📅 2026-11-01/);
  assert.equal(A.scoreOf({ points: 100, score: "" }).percent, null, "an empty score is not zero");
});

test("assignments view: shows weighted grades, GPA and a working Mark done button", async () => {
  const app = makeApp([
    {
      path: "Assignments/paper.md",
      fm: { assignment: true, assignment_id: "paper", title: "Paper", course: "Biology", type: "essay", due: "2026-12-01", status: "todo", points: 100, score: 90 },
      text: "---\nassignment: true\nassignment_id: paper\ntitle: Paper\ncourse: Biology\ntype: essay\ndue: 2026-12-01\nstatus: todo\npoints: 100\nscore: 90\n---\n\n# Paper\n\n- [ ] Paper 📅 2026-12-01\n",
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.assignments.courses = [{ name: "Biology", credits: 4, target: 90, finalWeight: 20 }];
  const dom = makeDom();
  const view = new T.AssignmentsView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  const texts = dom.texts();
  assert.ok(texts.some((t) => /Assignments & grades/.test(t)));
  assert.ok(texts.includes("Biology"));
  assert.ok(texts.includes("A-"));
  assert.ok(texts.some((t) => /you need 90% on the final/.test(t)));
  assert.ok(texts.some((t) => /3.70/.test(t)));
  await dom.click("Mark done");
  assert.equal(app.files[0].fm.status, "submitted");
  assert.match(app.files[0].text, /- \[x\] Paper/);
});

test("plugin: creating an assignment writes the module note and a due task", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const result = await plugin.createAssignment({
    title: "Unit 4 essay",
    course: "Biology",
    type: "essay",
    due: "2026-11-14",
    points: 100,
    score: 87,
  });
  assert.equal(result.path, "Assignments/Unit 4 essay.md");
  assert.ok(app.folders.includes("Assignments"));
  assert.match(result.file.text, /assignment: true/);
  assert.match(result.file.text, /course: Biology/);
  assert.match(result.file.text, /- \[ \] Unit 4 essay 📅 2026-11-14/);
});

test("assignments: settings normalize bad saved values and deduplicate courses", () => {
  const settings = A.normalizeAssignmentSettings({
    enabled: "no",
    targetGrade: 150,
    finalWeight: -5,
    categories: [{ id: "homework", weight: "lots" }],
    courses: [
      { name: " Biology ", credits: 99 },
      { name: "biology", credits: 2 },
      { name: "", credits: 4 },
    ],
  });
  assert.equal(settings.enabled, true, "only an explicit false turns the module off");
  assert.equal(settings.targetGrade, 100);
  assert.equal(settings.finalWeight, 0);
  assert.equal(settings.categories.find((c) => c.id === "homework").weight, 25);
  assert.equal(settings.courses.length, 1);
  assert.equal(settings.courses[0].credits, 30);
});
