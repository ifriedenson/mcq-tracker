"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const focus = T.focus;

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("focus: timestamps drive elapsed, pause, resume and finish", () => {
  let state = focus.startFocus({ minutes: 25, course: "Biology" }, 1000);
  assert.equal(focus.elapsedFocusMs(state, 61000), 60000);
  assert.equal(focus.formatFocusClock(60000), "1:00");
  state = focus.pauseFocus(state, 61000);
  assert.equal(focus.elapsedFocusMs(state, 999999), 60000);
  state = focus.resumeFocus(state, 100000);
  assert.equal(focus.elapsedFocusMs(state, 130000), 90000);
  const session = focus.finishFocus(state, 130000);
  assert.equal(session.minutes, 2);
  assert.equal(session.course, "Biology");
  assert.equal(session.source, "focus");
  assert.equal(focus.finishFocus(focus.startFocus({}, 1), 2), null);
});

test("focus: study log totals, goal, per-course and streak", () => {
  let log = focus.normalizeStudyLog(null);
  log = focus.addStudySession(log, { date: "2026-10-29", minutes: 30, course: "Biology" });
  log = focus.addStudySession(log, { date: "2026-10-29", minutes: 15, course: "Chemistry" });
  log = focus.addStudySession(log, { date: "2026-10-28", minutes: 20, course: "Biology" });
  const summary = focus.studySummary(log, "2026-10-29");
  assert.equal(summary.todayMinutes, 45);
  assert.equal(summary.weekMinutes, 65);
  assert.equal(summary.goalPct, 75);
  assert.equal(summary.streak, 2);
  assert.equal(summary.byCourse.Biology, 50);
  assert.equal(focus.studySummary(log, "2026-10-30").streak, 2, "yesterday keeps a streak alive");
  assert.equal(focus.normalizeStudyLog({ sessions: [], dailyGoalMinutes: 9999 }).dailyGoalMinutes, 480);
});

test("plugin: start, finish and log a focus session", async () => {
  const { app, plugin } = await setup();
  const started = plugin.startFocusSession(25, "Biology", "Review cells");
  assert.equal(started.course, "Biology");
  assert.equal(plugin.startFocusSession(25, "Other"), null, "one session at a time");
  plugin.focus.startedAt = Date.now() - 60000;
  plugin.focus.runningSince = Date.now() - 60000;
  const session = await plugin.finishFocusSession();
  assert.ok(session.minutes >= 1);
  assert.equal(plugin.focus, null);
  assert.equal(plugin.settings.studyLog.sessions.length, 1);
  assert.equal(plugin.settings.studyLog.lastCourse, "Biology");
  const stored = app.loadLocalStorage("mcqTrackerFocus");
  assert.equal(stored, null);
  await plugin.logStudySession({ date: "2026-10-29", minutes: 20, course: "Chemistry" });
  assert.equal(plugin.settings.studyLog.sessions.length, 2);
  assert.equal(plugin.studySummary("2026-10-29").byCourse.Chemistry, 20);
});

test("focus: Today shows the focus card and the commands exist", async () => {
  const { app, plugin } = await setup();
  assert.ok(plugin.commands.some((c) => c.id === "focus-start"));
  assert.ok(plugin.commands.some((c) => c.id === "focus-log"));
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Focus"));
  assert.ok(dom.texts().includes("Start 25"));
  assert.ok(dom.texts().includes("Log study time"));
});
