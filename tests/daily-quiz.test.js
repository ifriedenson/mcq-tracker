"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const daily = T.dailyQuiz;

const NOTES = [
  { path: "Questions/SAT/a.md", fm: { answer: "A", attempts: 2, next_review: "2020-01-01" } },
  { path: "Questions/SAT/b.md", fm: { answer: "B" } },
  { path: "Questions/AP/c.md", fm: { answer: "C" } },
  { path: "Questions/AP/hidden.md", fm: { answer: "D", study_status: "excluded" } },
  { path: "Other/d.md", fm: { answer: "A" } },
];

function questions(app) {
  return app.files
    .filter((file) => file.fm && file.fm.question_id !== undefined)
    .map((file) => ({ file, fm: file.fm }));
}

test("daily quiz: folder filter, hidden items and the count are respected", () => {
  const app = makeApp(NOTES);
  const picked = daily.buildDailyQuiz(questions(app), { today: "2026-10-29", count: 10, folders: ["Questions/SAT"] });
  assert.deepEqual(picked.map((q) => q.file.path).sort(), ["Questions/SAT/a.md", "Questions/SAT/b.md"]);
  assert.ok(!picked.some((q) => q.file.path.endsWith("hidden.md")), "known/excluded items stay out");
});

test("daily quiz: the same day gives the same set, and due questions come first", () => {
  const app = makeApp(NOTES);
  const first = daily.buildDailyQuiz(questions(app), { today: "2026-10-29", count: 3, folders: ["Questions"] });
  const again = daily.buildDailyQuiz(questions(app), { today: "2026-10-29", count: 3, folders: ["Questions"] });
  assert.deepEqual(first.map((q) => q.file.path), again.map((q) => q.file.path));
  assert.equal(first[0].file.path, "Questions/SAT/a.md", "the due question is first");
  assert.equal(new Set(first.map((q) => q.file.path)).size, first.length, "no duplicates");
});

test("daily quiz: a missing saved path regenerates today's set", () => {
  const app = makeApp(NOTES);
  const state = {
    enabled: true,
    count: 2,
    folders: ["Questions/SAT"],
    lastDate: "2026-10-29",
    paths: ["Questions/SAT/gone.md", "Questions/SAT/b.md"],
  };
  const picked = daily.pickDailyQuiz(questions(app), state, "2026-10-29");
  assert.equal(picked.questions.length, 2);
  assert.ok(picked.questions.every((q) => q.file.path.startsWith("Questions/SAT/")));
  assert.deepEqual(picked.state.paths, picked.questions.map((q) => q.file.path));
});

test("daily quiz: the streak increments on consecutive days and resets after a gap", () => {
  let state = daily.completeDailyQuiz({}, "2026-10-27");
  assert.equal(state.streak, 1);
  state = daily.completeDailyQuiz(state, "2026-10-28");
  assert.equal(state.streak, 2);
  state = daily.completeDailyQuiz(state, "2026-10-28");
  assert.equal(state.streak, 2, "finishing twice in one day does not add a day");
  assert.equal(daily.dailyStreak(state, "2026-10-29"), 2, "the streak is still alive today");
  assert.equal(daily.dailyStreak(state, "2026-10-31"), 0, "a missed day ends the streak");
  state = daily.completeDailyQuiz(state, "2026-10-31");
  assert.equal(state.streak, 1);
  assert.equal(state.best, 2);
});

test("daily quiz: Today shows the opt-in card and starts it", async () => {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.dailyQuiz = { enabled: true, count: 3, streak: 2, best: 4 };
  let started = 0;
  plugin.startDailyQuiz = async () => started++;
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Daily quiz"));
  assert.ok(dom.texts().includes("3 questions today"));
  assert.ok(dom.texts().some((text) => /Streak 0 days · best 4/.test(text)));
  await dom.click("Start daily quiz");
  assert.equal(started, 1);
});

test("daily quiz: the settings tab sits beside the other MCQ tabs", () => {
  assert.ok(T.MCQ_TABS.some((tab) => tab.id === "daily" && tab.label === "Daily quiz"));
});

test("daily quiz: plugin starts exactly the saved set and records completion", async () => {
  const app = makeApp(NOTES);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.dailyQuiz = { enabled: true, count: 2, folders: ["Questions/SAT"] };
  plugin.save = async () => {};
  let started = null;
  plugin.activateView = async () => ({
    startDailySession: async (paths, date) => {
      started = { paths, date };
    },
  });

  await plugin.startDailyQuiz();
  assert.ok(started);
  assert.equal(started.paths.length, 2);
  assert.ok(started.paths.every((p) => p.startsWith("Questions/SAT/")));
  assert.equal(plugin.settings.dailyQuiz.lastDate, started.date);
  assert.deepEqual(plugin.settings.dailyQuiz.paths, started.paths);

  const after = await plugin.completeDailyQuiz(started.date);
  assert.equal(after.lastCompleted, started.date);
  assert.equal(after.streak, 1);
});
