"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const plan = T.studyPlan;

const Q = (path, fm) => ({ file: { path }, fm: Object.assign({ answer: "A" }, fm) });
const EXAM = { summary: "Biology - Final Exam", dateKey: "2026-11-05", course: "Biology", dtstart: new Date(2026, 10, 5) };

test("study plan: days, due, weak skill and readiness evidence", () => {
  const questions = [
    Q("Q1.md", { course: "Biology", skill: "Genetics", attempts: 4, correct_count: 1, next_review: "2026-10-20" }),
    Q("Q2.md", { course: "Biology", skill: "Genetics", attempts: 3, correct_count: 1 }),
    Q("Q3.md", { course: "Biology", skill: "Cells", attempts: 2, correct_count: 2 }),
    Q("Q4.md", { course: "Biology", skill: "Cells" }),
  ];
  const result = plan.buildStudyPlan(EXAM, questions, [], { today: "2026-10-29", course: "Biology" });
  assert.equal(result.daysLeft, 7);
  assert.equal(result.due, 1);
  assert.equal(result.fresh, 1);
  assert.equal(result.total, 4);
  assert.equal(result.weakSkill, "Genetics");
  assert.equal(result.readiness > 0 && result.readiness < 100, true);
  assert.equal(result.cramPool[0].file.path, "Q1.md", "most-missed comes first");
});

test("study plan: cram skips long-interval reviews but keeps misses", () => {
  const questions = [
    Q("future.md", { attempts: 3, correct_count: 3, next_review: "2099-01-01" }),
    Q("missed.md", { attempts: 3, correct_count: 1, result: "incorrect", next_review: "2099-01-01" }),
    Q("new.md", {}),
  ];
  const cram = plan.buildCramPool(questions, "2026-10-29", 10);
  assert.deepEqual(cram.map((q) => q.file.path), ["missed.md", "new.md"]);
});

test("study plan: a plugin plan scopes to the exam course and starts Quick Practice", async () => {
  const app = makeApp([
    { path: "Bio/Q1.md", fm: { answer: "A", course: "Biology", attempts: 2, correct_count: 1, next_review: "2026-10-20" } },
    { path: "Chem/Q2.md", fm: { answer: "B", course: "Chemistry", attempts: 2, correct_count: 2 } },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.calendarEnabled = () => true;
  plugin.calendarEvents = () => [EXAM];
  plugin.calls = [];
  plugin.startQuickPractice = async (opts) => plugin.calls.push(opts);
  const result = plugin.studyPlan();
  assert.equal(result.course, "Biology");
  assert.equal(result.pool.length, 1);
  await plugin.startStudyPlan(result, false);
  assert.equal(plugin.calls[0].mode, "smart");
  await plugin.startStudyPlan(result, true);
  assert.equal(plugin.calls[1].mode, "cram");
});

test("study plan: Today shows the plan and cram button", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.studyPlan = () => ({
    course: "Biology",
    daysLeft: 3,
    readiness: 55,
    due: 4,
    fresh: 2,
    cardsDue: 1,
    attempted: 5,
    total: 7,
    accuracy: 0.6,
    weakSkill: "Genetics",
    pool: [{ file: { path: "x.md" } }],
    cramPool: [],
  });
  plugin.startStudyPlan = async () => {};
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Study plan"));
  assert.ok(dom.texts().includes("Biology"));
  assert.ok(dom.texts().includes("Cram 10 min"));
});
