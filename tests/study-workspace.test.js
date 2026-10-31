"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const W = T.studyWorkspace;

async function setup(saved) {
  const plugin = new QT(makeApp([]));
  if (saved) plugin.saved = saved;
  await plugin.onload();
  return plugin;
}

test("study workspace: twelve independent modules default on and can be switched off", () => {
  const defaults = W.normalizeStudyWorkspaceSettings({});
  assert.deepEqual(Object.keys(defaults), ["feynmanLearning", "recallScheduler", "lerntracker", "studyFlow", "subjectManager", "quizIndex", "courseHub", "studyTasks", "annotations", "deepNotes", "retention", "vocabulary"]);
  for (const value of Object.values(defaults)) assert.equal(value.enabled, true);
  const off = W.normalizeStudyWorkspaceSettings({
    feynmanLearning: { enabled: false },
    recallScheduler: { enabled: false },
    lerntracker: { enabled: false },
    studyFlow: { enabled: false },
    subjectManager: { enabled: false },
    quizIndex: { enabled: false },
    courseHub: { enabled: false },
    studyTasks: { enabled: false },
    annotations: { enabled: false },
    deepNotes: { enabled: false },
    retention: { enabled: false },
    vocabulary: { enabled: false },
  });
  assert.equal(Object.values(off).every((value) => value.enabled === false), true);
});

test("Feynman Learning: builds four steps, averages scores and finds weak dimensions", () => {
  const session = W.createFeynmanSession({ topic: "Cellular respiration", course: "Biology" }, 1);
  assert.ok(session);
  assert.equal(session.step, 0);
  assert.equal(W.feynmanStepKey(0), "explain");
  assert.equal(W.feynmanStepKey(3), "teach");
  assert.equal(W.feynmanAverage({ clarity: 4, accuracy: 3, simplicity: 0 }), 3.5);
  assert.deepEqual(W.feynmanWeakPoints({ clarity: 4, accuracy: 2, simplicity: 0 }), ["accuracy"]);
  const complete = W.normalizeFeynmanSession({ ...session, step: 4, scores: { clarity: 5, accuracy: 4, simplicity: 4 } });
  assert.equal(complete.completed, true);
  assert.equal(W.feynmanAverage(complete.scores), 4.3);
});

test("Study Flow: captures a source excerpt and tracks inbox/review/understood", () => {
  const excerpt = W.createFlowExcerpt({ sourcePath: "Readings/bio.md", quote: "ATP is the energy currency.", understanding: "It transfers energy.", card: "ATP :: energy currency" }, 1);
  assert.ok(excerpt);
  assert.equal(excerpt.status, "inbox");
  const review = { ...excerpt, id: "review", status: "review" };
  const done = { ...excerpt, id: "done", status: "understood" };
  assert.deepEqual(W.flowStats([excerpt, review, done]), { total: 3, inbox: 1, review: 1, understood: 1, withCards: 3 });
  assert.equal(W.createFlowExcerpt({ quote: "   " }, 1), null);
});

test("Subject Manager: summarizes lecture counts and removes matching absences", () => {
  const biology = W.createSubject({ name: "Biology", folder: "Courses/Biology", color: "#123456" }, 1);
  const chemistry = W.createSubject({ name: "Chemistry" }, 2);
  const absence = W.createAbsence({ subject: "Biology", date: "2026-11-02", reason: "Appointment" }, 3);
  assert.equal(absence.date, "2026-11-02");
  const summary = W.subjectSummary(
    [biology, chemistry],
    [absence],
    [{ course: "Biology", date: "2026-11-01", title: "Cells" }, { course: "Biology", date: "2026-11-03", title: "Respiration" }]
  );
  const bio = summary.find((subject) => subject.name === "Biology");
  assert.equal(bio.lectures, 2);
  assert.equal(bio.absences, 1);
  assert.equal(bio.lastLecture.title, "Respiration");
  assert.equal(W.createAbsence({ subject: "Biology", date: "not-a-date" }, 1), null);
});

test("Topic planner: allocates passes before the buffer and advances topic progress", () => {
  const plan = W.createPlannerPlan(
    { course: "Biology", examDate: "2026-11-10", bufferDays: 2, targetPasses: 2, topics: ["Cells", "Respiration"] },
    1
  );
  const summary = W.planSummary(plan, "2026-11-01");
  assert.equal(summary.daysLeft, 9);
  assert.equal(summary.studyEnd, "2026-11-08");
  assert.equal(summary.studyDays, 4);
  assert.deepEqual(summary.days[0], { date: "2026-11-01", topics: ["Cells"] });
  assert.equal(summary.nextDay.date, "2026-11-01");
  assert.equal(summary.percent, 0);
  const advanced = {
    ...plan,
    topics: plan.topics.map((topic) => (topic.name === "Cells" ? { ...topic, passes: 2 } : topic)),
  };
  assert.equal(W.planProgress(advanced).passes, 2);
  assert.equal(W.planProgress(advanced).complete, false);
  const complete = { ...advanced, topics: advanced.topics.map((topic) => ({ ...topic, passes: topic.targetPasses })) };
  assert.equal(W.planProgress(complete).complete, true);
});

test("Recall Scheduler: parses headings and fragments, schedules them and filters due units", () => {
  const text = "---\ntags: biology\n---\n# Cells\n\nCells are the basic unit of life and contain organelles.\n\n# Respiration\n\nRespiration releases energy from glucose in the mitochondria.";
  const headings = W.parseRecallUnits(text, "Biology.md", "headings");
  assert.equal(headings.length, 2);
  assert.equal(headings[0].title, "Cells");
  assert.match(headings[0].key, /^recall-/);
  const fragments = W.parseRecallUnits("A short line.\n\nA much longer knowledge fragment that is useful for active recall and has enough detail to review.", "Biology.md", "fragments");
  assert.equal(fragments.length, 1);
  const reviewed = W.reviewRecallUnit(headings[0], "good", "2026-11-01", null);
  assert.equal(reviewed.due, "2026-11-04");
  const reviews = { [headings[0].key]: reviewed };
  assert.deepEqual(W.recallDueUnits(headings, reviews, "2026-11-02").map((unit) => unit.title), ["Respiration"]);
  assert.equal(W.recallDueUnits(headings, reviews, "2026-11-04").length, 2);
});

test("Quiz index: counts parsed quizzes, levels and recorded results without creating attempts", () => {
  const text = [
    "```mcq-quiz",
    "Id: biology-1",
    "Level: L2",
    "Q: Which gas do plants take in?",
    "A. Oxygen",
    "B. Carbon dioxide",
    "Answer: B",
    "```",
    "",
    "```quiz-definition",
    "Id: biology-2",
    "Q: What is ATP?",
    "A. Energy currency",
    "B. A protein",
    "Answer: A",
    "```",
  ].join("\n");
  const index = W.collectQuizIndex([{ path: "Biology/Quiz.md", text, fm: { quizResults: { "biology-1": { percentage: 100, passed: true, score: 1, totalPoints: 1 } } } }]);
  assert.equal(index.stats.quizzes, 2);
  assert.equal(index.stats.questions, 2);
  assert.equal(index.stats.withResults, 1);
  assert.equal(index.stats.average, 100);
  assert.deepEqual(index.stats.levels, { L2: 1, Unlevelled: 1 });
  assert.deepEqual(index.stats.types, { choice: 2 });
  assert.equal(index.rows[0].result.passed, true);
  assert.equal(index.rows[1].result, null);
  assert.equal(W.normalizeQuizIndex({ limit: 999 }).limit, 200);
});

test("Course hub: combines lectures, absences and weighted grade chips", () => {
  const biology = W.createSubject({ name: "Biology", folder: "Courses/Biology", color: "#123456" }, 1);
  const grades = [
    W.createGrade({ course: "Biology", title: "Quiz", score: 90, weight: 1, date: "2026-10-01" }, 2),
    W.createGrade({ course: "Biology", title: "Midterm", score: 80, weight: 3, date: "2026-10-20" }, 3),
    W.createGrade({ course: "Chemistry", title: "Lab", score: 95, weight: 1 }, 4),
  ];
  const dashboard = W.courseDashboard(
    [biology],
    [{ course: "Biology", date: "2026-10-10", title: "Cells" }, { course: "Biology", date: "2026-10-24", title: "Respiration" }],
    [{ subject: "Biology", date: "2026-10-12" }],
    grades
  );
  const bio = dashboard.find((entry) => entry.name === "Biology");
  assert.equal(bio.lectures, 2);
  assert.equal(bio.absences, 1);
  assert.equal(bio.graded, 2);
  assert.equal(bio.weighted, 82.5);
  assert.equal(bio.letter, "B");
  assert.equal(bio.lastLecture.title, "Respiration");
  const chem = dashboard.find((entry) => entry.name === "Chemistry");
  assert.equal(chem.letter, "A");
  assert.equal(W.letterGrade(59), "F");
});

test("Study tasks: generates and sorts exam tasks, and finds due work", () => {
  const tasks = W.planExamTasks({ course: "Biology", examDate: "2026-11-10", startDate: "2026-11-01", topics: ["Cells", "Respiration"], passes: 2 }, "2026-11-01", 1);
  assert.equal(tasks.length, 4);
  assert.equal(tasks[0].source, "exam");
  assert.equal(tasks[0].due, "2026-11-01");
  assert.equal(tasks.every((task) => task.due < "2026-11-10"), true);
  assert.equal(tasks.filter((task) => /pass 2/.test(task.title)).length, 2);
  const manual = W.createStudyTask({ title: "Review cells", course: "Biology", due: "2026-10-31" }, 9);
  const summary = W.taskSummary([...tasks, { ...manual, done: true }], "2026-11-02");
  assert.equal(summary.total, 5);
  assert.equal(summary.done, 1);
  assert.equal(summary.open, 4);
  assert.equal(summary.overdue, 1);
  assert.equal(W.dueStudyTasks([...tasks, manual], "2026-11-02").length, 2);
  assert.deepEqual(W.planExamTasks({ course: "Biology", examDate: "2026-11-01", topics: ["Cells"] }, "2026-11-01", 1), []);
});

test("Annotations and Deep Notes: keep local Q&A and complete the Socratic prompts", () => {
  const annotation = W.createAnnotation({ sourcePath: "Biology/Cells.md", quote: "Water crosses the membrane.", question: "How?", answer: "Osmosis." }, 1);
  assert.equal(annotation.question, "How?");
  assert.equal(W.createAnnotation({ quote: "  " }, 1), null);
  const session = W.createDeepNotesSession({ topic: "Natural selection", course: "Biology" }, 2);
  assert.equal(session.step, 0);
  assert.equal(W.deepNotesStepKey(4), "synthesis");
  const complete = W.normalizeDeepNotesSession({ ...session, step: 5, answers: { synthesis: "Variation plus selection." } });
  assert.equal(complete.completed, true);
  assert.equal(complete.answers.synthesis, "Variation plus selection.");
});

test("Retention: projects card due work without changing schedules", () => {
  const cards = [
    { file: { path: "Cards/A.md" }, deck: "Biology", fm: { attempts: 2, next_review: "2026-11-01" } },
    { file: { path: "Cards/B.md" }, deck: "Chemistry", fm: { attempts: 0 } },
    { file: { path: "Cards/C.md" }, deck: "Biology", fm: { attempts: 1, next_review: "2026-11-03" } },
  ];
  const forecast = W.retentionForecast(cards, { today: "2026-11-01", days: 3 });
  assert.equal(forecast.total, 3);
  assert.equal(forecast.due, 2);
  assert.equal(forecast.fresh, 1);
  assert.equal(forecast.scheduled, 1);
  assert.equal(forecast.overdue, 0);
  assert.equal(forecast.forecast[0].count, 2);
  assert.equal(forecast.forecast[2].count, 1);
});

test("Vocabulary: parses bulk lines and advances a new word locally", () => {
  const parsed = W.parseVocabLines("ATP | energy currency | ATP powers the cell.\nnot a valid line");
  assert.equal(parsed.words.length, 1);
  assert.equal(parsed.words[0].term, "ATP");
  assert.equal(parsed.issues.length, 1);
  const word = W.createVocabWord(parsed.words[0], 1);
  assert.ok(word);
  assert.equal(W.vocabSummary([word], "2026-11-01").due, 1);
  const reviewed = W.reviewVocabWord(word, "good", "2026-11-01");
  assert.equal(reviewed.due, "2026-11-02");
  assert.equal(reviewed.reviews, 1);
  assert.equal(W.vocabSummary([reviewed], "2026-11-01").due, 0);
});

test("plugin: workflow switches gate the view and workflow data survives a reload", async () => {
  const plugin = await setup();
  assert.equal(plugin.studyWorkspaceEnabled(), true);
  const view = new T.StudyWorkspaceView({ app: plugin.app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Study Workspace"));
  assert.ok(dom.texts().includes("Feynman"));
  assert.ok(dom.texts().includes("Recall"));
  assert.ok(dom.texts().includes("Topic planner"));
  assert.ok(dom.texts().includes("Study Flow"));
  assert.ok(dom.texts().includes("Subjects"));
  assert.ok(dom.texts().includes("Courses"));
  assert.ok(dom.texts().includes("Tasks"));
  assert.ok(dom.texts().includes("Annotations"));
  assert.ok(dom.texts().includes("Deep Notes"));
  assert.ok(dom.texts().includes("Retention"));
  assert.ok(dom.texts().includes("Vocabulary"));
  assert.ok(dom.texts().includes("Quiz index"));

  const feynman = await plugin.addFeynmanSession({ topic: "Osmosis", course: "Biology" });
  const excerpt = await plugin.addFlowExcerpt({ sourcePath: "Readings/bio.md", quote: "Water moves across a membrane." });
  const subject = await plugin.addStudySubject({ name: "Biology", folder: "Courses/Biology" });
  const plan = await plugin.addPlannerPlan({ course: "Biology", examDate: "2099-01-10", bufferDays: 1, topics: ["Osmosis"] });
  const grade = await plugin.addCourseGrade({ course: "Biology", title: "Midterm", score: 91, weight: 2, date: "2026-10-30" });
  const task = await plugin.addStudyTask({ title: "Review osmosis", course: "Biology", due: "2026-11-02" });
  const annotation = await plugin.addAnnotation({ sourcePath: "Biology/Cells.md", quote: "Water crosses the membrane.", question: "How?", answer: "Osmosis." });
  const socratic = await plugin.addDeepNotesSession({ topic: "Osmosis", course: "Biology" });
  const vocab = await plugin.addVocabWord({ term: "osmosis", definition: "Water movement across a membrane" });
  assert.ok(feynman && excerpt && subject && plan && grade && task && annotation && socratic && vocab);
  await plugin.addPlannerPass(plan.id, plugin.studyWorkspaceSettings().lerntracker.plans[0].topics[0].id);
  assert.equal(plugin.studyWorkspaceSettings().lerntracker.plans[0].topics[0].passes, 1);

  const restarted = new QT(makeApp([]));
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.studyWorkspaceSettings().feynmanLearning.sessions.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().studyFlow.excerpts.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().subjectManager.subjects.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().lerntracker.plans.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().courseHub.grades.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().studyTasks.tasks.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().annotations.annotations.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().deepNotes.sessions.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().vocabulary.words.length, 1);

  for (const tab of ["courses", "tasks", "annotations", "deepNotes", "retention", "vocabulary"]) {
    view.setTab(tab);
    assert.equal(view.tab, tab);
  }

  for (const key of ["feynmanLearning", "recallScheduler", "lerntracker", "studyFlow", "subjectManager", "quizIndex", "courseHub", "studyTasks", "annotations", "deepNotes", "retention", "vocabulary"]) {
    restarted.settings[key].enabled = false;
  }
  assert.equal(restarted.studyWorkspaceEnabled(), false);
  const off = new T.StudyWorkspaceView({ app: restarted.app }, restarted);
  const offDom = makeDom();
  off.contentEl = offDom.root;
  off.render();
  assert.ok(offDom.texts().some((text) => /Study Workspace is off/.test(text)));
});
