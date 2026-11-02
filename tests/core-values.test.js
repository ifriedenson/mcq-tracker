"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const identity = require("../src/course-identity");
const examModel = require("../src/exams");
const { courseOverview } = require("../src/course-overview");
const reading = T.reading;
const readingLibrary = require("../src/reading-library");
const W = T.studyWorkspace;
const A = T.assignments;
const H = T.courseHealth;
const ST = T.studyTools;
const util = require("../src/util");

const REGISTRY = [
  {
    id: "math",
    name: "MATH 101 - Calculus",
    code: "MATH 101",
    folder: "Courses/Math",
    color: "#123456",
    credits: 4,
    totalTopics: 5,
    aliases: ["Calc"],
  },
];
const SETTINGS = { calendar: { courses: REGISTRY, examOverrides: {} } };
const EXAM = { summary: "MATH 101 Final Exam", date: "2026-11-10", dateKey: "2026-11-10", uid: "exam-1", dtstart: new Date(2026, 10, 10, 9), course: "MATH 101" };

test("G1: registry identity joins lectures, grades and assignments, and a rename keeps aliases", () => {
  const subject = W.createSubject({ name: "Calculus", folder: "Courses/Math", color: "#abcdef" }, 1);
  const lectures = [{ course: "Calc", date: "2026-11-01", title: "Limits" }];
  const grades = [W.createGrade({ course: "MATH 101", title: "Midterm", score: 82, weight: 1 }, 2)];
  const dashboard = W.courseDashboard([subject], lectures, [], grades, { settings: SETTINGS });
  const row = dashboard.find((entry) => entry.name === "MATH 101 - Calculus");
  assert.ok(row);
  assert.equal(row.courseId, "math");
  assert.equal(row.lectures, 1);
  assert.equal(row.graded, 1);
  assert.equal(row.credits, 4);
  assert.equal(row.color, "#123456");

  const assignmentSettings = { ...A.DEFAULT_ASSIGNMENT_SETTINGS, registry: REGISTRY };
  const assignment = A.parseAssignment(
    { path: "Assignments/Final.md" },
    { assignment: true, title: "Final", course: "MATH 101 - Calculus", type: "exam", due: "2026-11-10", status: "todo", topics: ["Limits", "Derivatives"] },
    "",
    assignmentSettings
  );
  const assignmentRow = A.courseRow(assignmentSettings, "MATH 101", [assignment]);
  assert.equal(assignmentRow.course, "MATH 101 - Calculus");
  assert.equal(assignmentRow.courseId, "math");
  assert.equal(assignmentRow.total, 1);
  assert.deepEqual(assignment.topics, ["Limits", "Derivatives"]);

  const renamed = identity.renameCourse(REGISTRY, "math", "Calculus I");
  const renamedSettings = { calendar: { courses: renamed, examOverrides: {} } };
  assert.equal(identity.resolveCourse(renamedSettings, "Calc").name, "Calculus I");
  assert.equal(identity.resolveCourse(renamedSettings, "MATH 101").name, "Calculus I");
  const renamedDashboard = W.courseDashboard([subject], lectures, [], grades, { settings: renamedSettings });
  assert.equal(renamedDashboard.length, 1);
  assert.equal(renamedDashboard[0].lectures, 1);
  assert.equal(renamedDashboard[0].graded, 1);
});

test("G2: one exam list merges ICS, manual assignments and planner dates, with override and false-positive guards", () => {
  const assignment = {
    id: "manual-final",
    title: "Calculus Final",
    course: "MATH 101",
    type: "exam",
    due: "2026-11-10",
    weight: 30,
    topics: ["Limits", "Series"],
    examTime: "09:00",
    category: "exam",
    open: true,
  };
  const plans = [{ id: "p1", course: "MATH 101", examDate: "2026-11-12", topics: [{ name: "Integrals" }] }];
  const list = examModel.listExams({ settings: SETTINGS, events: [EXAM], assignments: [assignment], plans, today: "2026-11-01" });
  assert.equal(list.length, 2);
  const merged = list.find((exam) => exam.date === "2026-11-10");
  assert.equal(merged.source, "merged");
  assert.equal(merged.course, "MATH 101 - Calculus");
  assert.equal(merged.weight, 30);
  assert.deepEqual(merged.topics, ["Limits", "Series"]);
  assert.equal(merged.time, "09:00");

  assert.equal(examModel.typeOf("SAT Math", "exam"), "sat");
  assert.equal(examModel.typeOf("AP Biology", "exam"), "ap");
  assert.equal(T.calendarModel.detectExam("Final project presentation"), false);
  assert.equal(T.calendarModel.detectExam("Test prep session"), false);
  assert.equal(T.calendarModel.detectExam("Calculus Final Exam"), true);

  const overrideKey = T.calendarModel.eventKey(EXAM);
  const hidden = examModel.listExams({ settings: SETTINGS, events: [EXAM], assignments: [], plans: [], overrides: { [overrideKey]: false }, today: "2026-11-01" });
  assert.equal(hidden.length, 0);
  const project = { summary: "Final project presentation", dateKey: "2026-11-20", uid: "project-1", dtstart: new Date(2026, 10, 20, 9) };
  const shown = examModel.listExams({ settings: SETTINGS, events: [project], assignments: [], plans: [], overrides: { [T.calendarModel.eventKey(project)]: true }, today: "2026-11-01" });
  assert.equal(shown.length, 1);
});

test("G3: a no-question plan still exposes lecture, reading and planner work, readiness evidence and multiple exams", () => {
  const plan = T.studyPlan.buildStudyPlan(
    EXAM,
    [],
    [],
    {
      today: "2026-11-01",
      course: "MATH 101",
      readiness: null,
      lectures: [{ title: "Limits", date: "2026-11-01" }, { title: "Series", date: "2026-11-02" }],
      readings: [{ title: "Calculus", pagesRemaining: 40, behindPages: 10 }],
      plannerRemaining: 3,
      assignments: [{ title: "Problem set" }],
    }
  );
  assert.equal(plan.readiness, null);
  assert.equal(plan.total, 0);
  assert.ok(plan.workItems.some((item) => item.type === "lectures" && /Review 2 lectures/.test(item.label)));
  assert.ok(plan.workItems.some((item) => item.type === "readings" && /Read 40 pages/.test(item.label)));
  assert.ok(plan.workItems.some((item) => item.type === "planner" && /3 topic passes/.test(item.label)));
  assert.ok(plan.workItems.some((item) => item.type === "assignments"));
  assert.ok(plan.readinessEvidence.some((item) => item.id === "readings" && /behind/.test(item.detail)));
  assert.equal(plan.pool.length, 0);
  assert.equal(plan.cramPool.length, 0);

  const plugin = new QT(makeApp([]));
  return plugin.onload().then(() => {
    let horizon = null;
    plugin.getExams = (opts) => {
      if (opts && opts.includePast) return [EXAM];
      horizon = opts.horizonDays;
      return [EXAM, { ...EXAM, date: "2026-11-13", title: "MATH 101 Quiz" }];
    };
    plugin.getQuestions = () => [];
    plugin.getAssignments = () => [];
    plugin.getReadingPlans = () => [{ title: "Calculus", pagesRemaining: 10, behindPages: 2 }];
    plugin.studyToolsSettings = () => ({ lectureLog: { lectures: [{ course: "MATH 101", title: "Limits", date: "2026-11-01" }] } });
    plugin.studyWorkspaceSettings = () => ({ lerntracker: { plans: [] }, subjectManager: { subjects: [], absences: [] }, studyTasks: { tasks: [] } });
    plugin.getFrqReviewQueue = () => [];
    plugin.cardsEnabled = () => false;
    plugin.settings.studyPlanDays = 90;
    const plans = plugin.studyPlans();
    assert.equal(horizon, 90);
    assert.equal(plans.length, 2);
    assert.equal(plans[0].readiness, null);
    assert.equal(plans[0].workItems[0].type, "lectures");
  });
});

test("G4: calendar attendance is idempotent, links the class note and keeps old lecture data", async () => {
  const parsed = ST.normalizeLecture({ course: "Biology", date: "2026-11-01", title: "Cells", topics: "Membranes; ATP", notePath: "Classes/Bio.md" });
  assert.deepEqual(parsed.topicList, ["Membranes", "ATP"]);
  assert.equal(parsed.notePath, "Classes/Bio.md");

  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.findCalendarNote = () => ({ path: "Classes/Bio.md" });
  plugin.refreshViews = () => {};
  plugin.refreshCalendarViews = () => {};
  const event = { summary: "Biology", dateKey: "2026-11-01", uid: "bio-1", description: "Membranes; ATP" };
  await plugin.logCalendarLecture(event, "2026-11-01", true);
  await plugin.logCalendarLecture(event, "2026-11-01", true);
  assert.equal(plugin.settings.lectureLog.lectures.length, 1);
  assert.equal(plugin.settings.lectureLog.lectures[0].notePath, "Classes/Bio.md");
  assert.equal(plugin.settings.lectureLog.lectures[0].topicList[0], "Membranes");
  await plugin.logCalendarLecture(event, "2026-11-01", false);
  assert.equal(plugin.settings.lectureLog.lectures.length, 0);
  assert.equal(plugin.settings.subjectManager.absences.length, 1);
  await plugin.logCalendarLecture(event, "2026-11-01", false);
  assert.equal(plugin.settings.subjectManager.absences.length, 1);

  const note = { path: "Classes/Bio.md", basename: "Bio" };
  plugin.app.metadataCache.getFileCache = () => ({ frontmatter: { calendar_uid: "bio-1", calendar_date: "2026-11-01", course: "Biology", title: "Cells" } });
  await plugin.logClassNoteAttendance(note, true);
  assert.equal(plugin.settings.lectureLog.lectures.length, 1);
  assert.equal(plugin.settings.subjectManager.absences.length, 0);
});

test("G5: reading course/due links survive parsing and expose pages-behind status", () => {
  const parsed = reading.parseReadingPlan("title: Econ reading\nauthor: Author\ncourse: Econ 101\ndue: 2026-01-10\npages: 100\nstart: 2026-01-01\ntarget: 2026-01-10\ndays: everyday\nread: 0");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.course, "Econ 101");
  assert.equal(parsed.due, "2026-01-10");
  const plan = reading.planReading(parsed, { today: "2026-01-05", read: 20 });
  assert.equal(plan.pagesRemaining, 80);
  assert.equal(plan.behindPages, 20);
  assert.equal(plan.dueDate, "2026-01-10");
  const status = reading.readingStatus(plan);
  assert.equal(status.pagesRemaining, 80);
  assert.equal(status.behindPages, 20);
  assert.equal(status.dueDate, "2026-01-10");
  const book = readingLibrary.createBook({ title: "Econometrics", course: "Econ 101", due: "2026-01-10", totalPages: 200, status: "reading" }, "2026-01-01");
  assert.equal(book.course, "Econ 101");
  assert.equal(book.due, "2026-01-10");
  assert.equal(readingLibrary.createBook({ title: "Old book" }, "2026-01-01").course, "");
});

test("G6: course overview combines exam, topics, lectures, readings, assignments, tasks and grades", () => {
  const plans = [{ id: "p", course: "MATH 101", examDate: "2026-11-10", targetPasses: 2, topics: [{ name: "Limits", targetPasses: 2, passes: 0 }] }];
  const view = courseOverview("math", {
    settings: SETTINGS,
    today: "2026-11-01",
    exams: [{
      id: "e",
      title: "Final",
      date: "2026-11-10",
      dateKey: "2026-11-10",
      course: "MATH 101",
      weight: 25,
      topics: ["Limits"],
      assignment: { file: { path: "Assignments/Final.md" } },
    }],
    studyPlan: { course: "MATH 101", examDay: "2026-11-10", daysLeft: 9, readiness: 72, readinessEvidence: [{ id: "accuracy", label: "Accuracy", value: 80, detail: "4 attempted" }] },
    plans,
    lectures: [{ id: "l", course: "Calc", date: "2026-11-02", title: "Limits", topicList: ["Limits"], notePath: "Classes/Limits.md" }],
    readings: [{ id: "r", title: "Calculus", course: "MATH 101", pagesRemaining: 30, behindPages: 5, dueDate: "2026-11-10", sourcePath: "Reading/Calc.md" }],
    assignments: [{ id: "a", course: "MATH 101", title: "Problem set", open: true, due: "2026-11-05", file: { path: "Assignments/PS.md" } }],
    tasks: [{ id: "t", course: "MATH 101", title: "Review limits", done: false, due: "2026-11-04", path: "Tasks/limits.md" }],
    courses: [{ name: "MATH 101 - Calculus", current: 85, letter: "B", weighted: 85, graded: 2 }],
  });
  assert.equal(view.name, "MATH 101 - Calculus");
  assert.deepEqual(view.sections.map((section) => section.id), ["exam", "topics", "lectures", "readings", "assignments", "tasks", "grades"]);
  assert.equal(view.sections.find((section) => section.id === "readings").rows[0].detail.includes("5 behind"), true);
  assert.equal(view.sections.find((section) => section.id === "readings").rows[0].path, "Reading/Calc.md");
  assert.equal(view.sections.find((section) => section.id === "tasks").rows[0].path, "Tasks/limits.md");
  assert.equal(view.studyPlan.readiness, 72);
  const examRow = view.sections.find((section) => section.id === "exam").rows[0];
  assert.equal(examRow.path, "Assignments/Final.md");
  assert.match(examRow.detail, /readiness 72%/);
  assert.match(examRow.detail, /topics: Limits/);
  assert.match(examRow.evidence, /Accuracy: 80/);
  const empty = courseOverview("unknown", { settings: SETTINGS, today: "2026-11-01" });
  assert.equal(empty.sections.length, 0);
});

test("G1 plugin: renaming a registered course writes aliases and resolves old names", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.calendar = { ...plugin.settings.calendar, courses: JSON.parse(JSON.stringify(REGISTRY)) };
  let invalidated = 0;
  plugin.invalidateCalendar = () => { invalidated += 1; };
  const changed = await plugin.renameCalendarCourse("math", "Calculus I");
  assert.equal(changed, true);
  assert.equal(invalidated, 1);
  const course = plugin.settings.calendar.courses[0];
  assert.equal(course.name, "Calculus I");
  assert.ok(course.aliases.includes("MATH 101 - Calculus"));
  assert.ok(course.aliases.includes("MATH 101"));
  assert.equal(identity.resolveCourse(plugin.calendarSettings(), "MATH 101").name, "Calculus I");
  assert.equal(await plugin.renameCalendarCourse("math", "Calculus I"), false, "an unchanged name does not save or invalidate twice");
});

test("G3 plugin: exam plans use lectures after the last exam or matching exam topics", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.calendar = { ...plugin.settings.calendar, courses: JSON.parse(JSON.stringify(REGISTRY)) };
  const final = { id: "final", title: "MATH 101 Final", course: "MATH 101", date: "2026-11-10", topics: ["Series"] };
  const midterm = { id: "mid", title: "MATH 101 Midterm", course: "MATH 101", date: "2026-10-15", topics: ["Limits"] };
  plugin.getExams = (opts) => (opts && opts.includePast ? [midterm, final] : [final]);
  plugin.getQuestions = () => [];
  plugin.getAssignments = () => [];
  plugin.getReadingPlans = () => [];
  plugin.studyToolsSettings = () => ({
    lectureLog: {
      lectures: [
        { id: "old-limits", course: "MATH 101", title: "Old Limits", date: "2026-09-01", topics: "Limits" },
        { id: "new-integration", course: "MATH 101", title: "Recent Integration", date: "2026-11-01", topics: "Integration" },
        { id: "old-series", course: "MATH 101", title: "Old Series", date: "2026-09-02", topics: "Series" },
      ],
    },
  });
  plugin.studyWorkspaceSettings = () => ({ lerntracker: { plans: [] }, subjectManager: { subjects: [], absences: [] }, studyTasks: { tasks: [] } });
  plugin.getFrqReviewQueue = () => [];
  plugin.cardsEnabled = () => false;
  const plan = plugin.buildExamPlan(final);
  const titles = plan.lectures.map((lecture) => lecture.title).sort();
  assert.deepEqual(titles, ["Old Series", "Recent Integration"]);
});

test("G6 UI: course-overview rows open a source file or their destination", async () => {
  const app = makeApp([]);
  const opened = [];
  app.workspace.openLinkText = (...args) => opened.push(args);
  let assignments = 0;
  const plugin = {
    app,
    courseOverviewData: () => ({
      name: "MATH 101",
      color: "#123456",
      grade: null,
      sections: [{
        id: "sources",
        title: "Sources",
        rows: [
          { id: "reading", label: "Calculus", source: "reading", path: "Reading/Calc.md" },
          { id: "grade", label: "Grade", source: "grade" },
        ],
      }],
    }),
    activateAssignments: () => { assignments += 1; },
  };
  const dom = makeDom();
  const modal = new T.CourseOverviewModal(app, plugin, "math");
  modal.contentEl = dom.root;
  modal.onOpen();
  const buttons = dom.all.filter((option) => option.meta && option.meta.text === "Open");
  assert.equal(buttons.length, 2);
  buttons[0].handlers.find((handler) => handler.ev === "click").fn({});
  assert.equal(opened[0][0], "Reading/Calc.md");
  buttons[1].handlers.find((handler) => handler.ev === "click").fn({});
  assert.equal(assignments, 1);
});

test("G3b: the study-plan window is a bounded setting with a 30-day default", () => {
  assert.equal(T.studyPlan.normalizeStudyPlanDays(undefined), 30);
  assert.equal(T.studyPlan.normalizeStudyPlanDays(0), 1);
  assert.equal(T.studyPlan.normalizeStudyPlanDays(500), 365);
  assert.equal(T.studyPlan.normalizeStudyPlanDays(45), 45);
});

test("G7: course health reads the merged exam list instead of a planner-only date", () => {
  const report = H.courseHealthReport({
    courses: [{ name: "MATH 101 - Calculus", lectures: 2, absences: 0, attendance: 100, graded: 1, folder: "Courses/Math" }],
    exams: [{ course: "MATH 101 - Calculus", title: "Final", date: "2026-11-05" }],
    plans: [],
    tasks: [],
    settings: SETTINGS,
    today: "2026-11-01",
  });
  const check = report.rows[0].checks.find((row) => row.id === "exam");
  assert.ok(check);
  assert.match(check.text, /Final in 4 days/);
  assert.equal(report.rows[0].status, "watch");
});

test("G4 prompt: an ended class appears once in the opt-in attendance prompt and disappears after logging", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  plugin.settings.lectureLog = ST.normalizeLectureLog({ afterClassPrompt: true, lectures: [] });
  const at = new Date(2026, 10, 1, 12, 0, 0);
  assert.equal(util.localDate(at), "2026-11-01");
  const event = {
    summary: "Biology",
    dateKey: "2026-11-01",
    uid: "bio-prompt",
    dtstart: new Date(2026, 10, 1, 10, 0, 0),
    dtend: new Date(2026, 10, 1, 11, 0, 0),
  };
  plugin.calendarEvents = () => [event];
  plugin.findCalendarNote = () => null;
  plugin.refreshViews = () => {};
  plugin.refreshCalendarViews = () => {};
  assert.equal(plugin.attendancePrompt(at).length, 1);
  await plugin.logCalendarLecture(event, "2026-11-01", true);
  assert.equal(plugin.attendancePrompt(at).length, 0);
  plugin.settings.lectureLog = ST.normalizeLectureLog({ afterClassPrompt: false, lectures: plugin.settings.lectureLog.lectures });
  assert.equal(plugin.attendancePrompt(at).length, 0);
});

test("G5 Today: a registered reading plan appears in the Today readings card", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.getReadingPlans = () => [{ title: "Econ reading", course: "Econ 101", todayChunk: 12, behindPages: 4, dueDate: "2026-11-10" }];
  plugin.studyPlan = () => null;
  const dom = makeDom();
  const view = new T.TodayView({ app: plugin.app }, plugin);
  view.app = plugin.app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Readings"));
  assert.ok(dom.texts().some((text) => text.includes("Today: 12 pages")));
});
