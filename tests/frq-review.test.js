"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const frq = T.frq;

function prompt(path, fm) {
  return {
    path,
    fm: Object.assign(
      {
        type: "ap_frq",
        ap_course: "ap-biology",
        course: "AP Biology",
        title: path.split("/").pop().replace(/\.md$/, ""),
        max_points: 10,
      },
      fm,
    ),
  };
}

test("frq review: weak attempts return sooner and missed criteria cap the interval", () => {
  assert.equal(frq.frqReviewIntervalDays(95, []), 14);
  assert.equal(frq.frqReviewIntervalDays(85, []), 7);
  assert.equal(frq.frqReviewIntervalDays(70, []), 3);
  assert.equal(frq.frqReviewIntervalDays(40, []), 1);
  assert.equal(frq.frqReviewIntervalDays(95, ["Thesis"]), 3, "a missed rubric line brings a strong attempt back");
  assert.equal(frq.frqReviewIntervalDays(40, ["Thesis"]), 1, "the cap never delays a weak attempt");
});

test("frq review: a saved attempt writes its next review date", () => {
  const update = frq.sourceFrontmatterUpdate(
    { earned: 7, max: 10, percent: 70, missedLabels: ["Explanation"], gradedOn: "2026-10-29" },
    0,
  );
  assert.equal(update.frq_next_review, "2026-11-01");
  assert.equal(update.frq_review_interval, 3);
  assert.equal(update.frq_attempts, 1);
});

test("frq review: entries report due, scheduled and unpractised prompts", () => {
  const due = frq.frqReviewEntry(
    {
      type: "ap_frq",
      ap_course: "ap-biology",
      course: "AP Biology",
      title: "Cells",
      frq_attempts: 2,
      frq_last_percent: 55,
      frq_criteria_missed: ["Explanation"],
      frq_graded_on: "2026-10-27",
    },
    "AP FRQs/Biology/Cells.md",
    "2026-10-29",
  );
  assert.equal(due.due, true);
  assert.equal(due.state, "due");
  assert.equal(due.nextReview, "2026-10-28", "falls back to the interval when no saved date exists");

  const scheduled = frq.frqReviewEntry(
    {
      type: "ap_frq",
      ap_course: "ap-biology",
      course: "AP Biology",
      title: "Genetics",
      frq_attempts: 1,
      frq_last_percent: 92,
      frq_graded_on: "2026-10-28",
      frq_next_review: "2026-11-11",
    },
    "AP FRQs/Biology/Genetics.md",
    "2026-10-29",
  );
  assert.equal(scheduled.due, false);
  assert.equal(scheduled.state, "scheduled");

  const fresh = frq.frqReviewEntry(
    { type: "ap_frq", ap_course: "ap-biology", course: "AP Biology", title: "New" },
    "AP FRQs/Biology/New.md",
    "2026-10-29",
  );
  assert.equal(fresh.due, false);
  assert.equal(fresh.state, "new");
});

test("frq review: the plugin queue scopes prompts to the exam course", async () => {
  const app = makeApp([
    prompt("AP FRQs/Biology/Cells.md", {
      frq_attempts: 1,
      frq_last_percent: 60,
      frq_criteria_missed: ["Explanation"],
      frq_graded_on: "2026-10-25",
      frq_next_review: "2026-10-28",
    }),
    prompt("AP FRQs/Chemistry/Equilibrium.md", {
      ap_course: "ap-chemistry",
      course: "AP Chemistry",
      frq_attempts: 1,
      frq_last_percent: 55,
      frq_graded_on: "2026-10-25",
      frq_next_review: "2026-10-26",
    }),
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.moduleOff = () => false;

  const all = plugin.getFrqReviewQueue({});
  assert.equal(all.length, 2);
  assert.equal(all[0].course, "AP Chemistry", "oldest due review comes first");

  const biology = plugin.getFrqReviewQueue({ course: "Biology" });
  assert.equal(biology.length, 1);
  assert.equal(biology[0].title, "Cells");
});

test("frq review: a due prompt joins the exam study plan", async () => {
  const app = makeApp([
    prompt("AP FRQs/Biology/Cells.md", {
      frq_attempts: 1,
      frq_last_percent: 70,
      frq_criteria_missed: ["Explanation"],
      frq_graded_on: "2026-10-25",
      frq_next_review: "2026-10-28",
    }),
    { path: "Bio/Q1.md", fm: { answer: "A", course: "Biology", attempts: 2, correct_count: 1, next_review: "2026-10-20" } },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.moduleOff = () => false;
  plugin.calendarEnabled = () => true;
  plugin.calendarEvents = () => [
    { summary: "Biology - Final Exam", dateKey: "2026-11-05", course: "Biology", dtstart: new Date(2026, 10, 5) },
  ];
  const plan = plugin.studyPlan();
  assert.equal(plan.frqTotal, 1);
  assert.equal(plan.frqDue, 1);
  assert.equal(plan.frqNext.title, "Cells");

  plugin.calls = [];
  plugin.openFrqGrader = (options) => plugin.calls.push(options);
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().some((text) => text.includes("1 FRQ due")));
  assert.ok(dom.texts().includes("Practice FRQ"));
  await dom.click("Practice FRQ");
  assert.equal(plugin.calls[0].path, "AP FRQs/Biology/Cells.md");
});
