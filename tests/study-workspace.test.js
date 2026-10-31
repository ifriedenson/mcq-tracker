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

test("study workspace: five independent modules default on and can be switched off", () => {
  const defaults = W.normalizeStudyWorkspaceSettings({});
  assert.deepEqual(Object.keys(defaults), ["feynmanLearning", "recallScheduler", "lerntracker", "studyFlow", "subjectManager"]);
  for (const value of Object.values(defaults)) assert.equal(value.enabled, true);
  const off = W.normalizeStudyWorkspaceSettings({
    feynmanLearning: { enabled: false },
    recallScheduler: { enabled: false },
    lerntracker: { enabled: false },
    studyFlow: { enabled: false },
    subjectManager: { enabled: false },
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

  const feynman = await plugin.addFeynmanSession({ topic: "Osmosis", course: "Biology" });
  const excerpt = await plugin.addFlowExcerpt({ sourcePath: "Readings/bio.md", quote: "Water moves across a membrane." });
  const subject = await plugin.addStudySubject({ name: "Biology", folder: "Courses/Biology" });
  const plan = await plugin.addPlannerPlan({ course: "Biology", examDate: "2099-01-10", bufferDays: 1, topics: ["Osmosis"] });
  assert.ok(feynman && excerpt && subject && plan);
  await plugin.addPlannerPass(plan.id, plugin.studyWorkspaceSettings().lerntracker.plans[0].topics[0].id);
  assert.equal(plugin.studyWorkspaceSettings().lerntracker.plans[0].topics[0].passes, 1);

  const restarted = new QT(makeApp([]));
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.studyWorkspaceSettings().feynmanLearning.sessions.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().studyFlow.excerpts.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().subjectManager.subjects.length, 1);
  assert.equal(restarted.studyWorkspaceSettings().lerntracker.plans.length, 1);

  for (const key of ["feynmanLearning", "recallScheduler", "lerntracker", "studyFlow", "subjectManager"]) {
    restarted.settings[key].enabled = false;
  }
  assert.equal(restarted.studyWorkspaceEnabled(), false);
  const off = new T.StudyWorkspaceView({ app: restarted.app }, restarted);
  const offDom = makeDom();
  off.contentEl = offDom.root;
  off.render();
  assert.ok(offDom.texts().some((text) => /Study Workspace is off/.test(text)));
});
