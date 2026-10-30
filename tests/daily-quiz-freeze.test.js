"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const daily = T.dailyQuiz;

const NOTES = [
  {
    path: "Questions/SAT/a.md",
    fm: { answer: "A" },
    text: "---\nquestion_id: a\nanswer: A\n---\n\n## Question\nA question?\n\n## Answer\nA\n",
  },
];

function appWithNotes() {
  return makeApp(NOTES);
}

test("daily quiz: streak freeze is off by default and corrupt saved values normalize", () => {
  const defaults = daily.normalizeDailyQuiz({});
  assert.equal(defaults.freezeEnabled, false);
  assert.equal(defaults.freezeEvery, 5);
  assert.equal(defaults.freezes, 0);
  assert.equal(defaults.completions, 0);

  const corrupt = daily.normalizeDailyQuiz({
    freezeEnabled: "true",
    freezeEvery: 0,
    freezes: 99,
    completions: -4,
  });
  assert.equal(corrupt.freezeEnabled, false, "only an explicit boolean enables freezes");
  assert.equal(corrupt.freezeEvery, 5);
  assert.equal(corrupt.freezes, 3, "freezes are capped");
  assert.equal(corrupt.completions, 0);
  assert.equal(daily.normalizeDailyQuiz({ freezeEvery: 100 }).freezeEvery, 50);
});

test("daily quiz: a freeze is earned every N completions and covers one missed day", () => {
  let state = daily.normalizeDailyQuiz({
    freezeEnabled: true,
    freezeEvery: 2,
    streak: 4,
    lastCompleted: "2026-10-27",
  });

  state = daily.completeDailyQuiz(state, "2026-10-28");
  assert.equal(state.streak, 5);
  assert.equal(state.freezes, 0);
  assert.equal(state.completions, 1);

  state = daily.completeDailyQuiz(state, "2026-10-29");
  assert.equal(state.streak, 6);
  assert.equal(state.freezes, 1, "the second completion earns a freeze");
  assert.equal(state.completions, 2);

  const held = daily.dailyFreezeStatus(state, "2026-10-31");
  assert.equal(held.missedDays, 1);
  assert.equal(held.canProtect, true);
  assert.equal(daily.dailyStreak(state, "2026-10-31"), 6, "the displayed streak survives one missed day");

  state = daily.completeDailyQuiz(state, "2026-10-31");
  assert.equal(state.streak, 7, "the freeze bridges the missed day");
  assert.equal(state.freezes, 0, "the freeze is spent on completion");
  assert.equal(state.completions, 3);
});

test("daily quiz: one freeze cannot cover two missed days", () => {
  const state = daily.normalizeDailyQuiz({
    freezeEnabled: true,
    freezeEvery: 10,
    streak: 8,
    lastCompleted: "2026-10-29",
    freezes: 1,
    completions: 4,
  });
  assert.equal(daily.dailyStreak(state, "2026-11-01"), 0);
  const after = daily.completeDailyQuiz(state, "2026-11-01");
  assert.equal(after.streak, 1, "an uncovered gap resets the streak");
  assert.equal(after.freezes, 1, "the single freeze is not wasted");
});

test("daily quiz: disabling the freeze leaves a missed-day streak reset unchanged", () => {
  const state = daily.normalizeDailyQuiz({
    freezeEnabled: false,
    freezeEvery: 5,
    streak: 9,
    lastCompleted: "2026-10-27",
    freezes: 3,
  });
  assert.equal(daily.dailyStreak(state, "2026-10-30"), 0);
  const after = daily.completeDailyQuiz(state, "2026-10-30");
  assert.equal(after.streak, 1);
  assert.equal(after.freezes, 3, "a disabled freeze is never spent");
});

test("daily quiz: earned freezes and completions survive a restart without changing question state", async () => {
  const firstApp = appWithNotes();
  const first = new QT(firstApp);
  await first.onload();
  first.settings.dailyQuiz = daily.normalizeDailyQuiz({
    enabled: true,
    freezeEnabled: true,
    freezeEvery: 3,
    streak: 2,
    lastCompleted: "2026-10-28",
    freezes: 1,
    completions: 1,
  });
  await first.save();
  const saved = JSON.parse(JSON.stringify(first.saved));

  const app = appWithNotes();
  const restarted = new QT(app);
  restarted.saved = saved;
  await restarted.onload();
  assert.equal(restarted.settings.dailyQuiz.freezeEnabled, true);
  assert.equal(restarted.settings.dailyQuiz.freezes, 1);
  assert.equal(restarted.settings.dailyQuiz.completions, 1);

  const before = JSON.stringify(app.files[0].fm);
  const after = await restarted.completeDailyQuiz("2026-10-30");
  assert.equal(after.streak, 3);
  assert.equal(after.freezes, 0);
  assert.equal(after.completions, 2);
  assert.equal(JSON.stringify(app.files[0].fm), before, "daily completion does not touch question tracking");
});

test("daily quiz: Today shows the earned freeze count only when the option is on", async () => {
  const app = appWithNotes();
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.dailyQuiz = daily.normalizeDailyQuiz({
    enabled: true,
    count: 3,
    streak: 4,
    best: 6,
    freezeEnabled: true,
    freezes: 2,
    lastCompleted: daily.dayKey(new Date()),
  });
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().some((text) => /Streak 4 days · best 6 · 2 freezes/.test(text)));

  plugin.settings.dailyQuiz = daily.normalizeDailyQuiz({ ...plugin.settings.dailyQuiz, freezeEnabled: false });
  const offDom = makeDom();
  const offView = new T.TodayView({ app }, plugin);
  offView.app = app;
  offView.contentEl = offDom.root;
  offView.render();
  assert.ok(offDom.texts().some((text) => /Streak 4 days · best 6 · finish once counts once/.test(text)));
  assert.ok(!offDom.texts().some((text) => /freezes/.test(text)));
});
