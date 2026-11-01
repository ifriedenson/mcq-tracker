"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const P = T.pomodoro;

const at = (min) => new Date(2026, 10, 1, 9, min, 0);

test("pomodoro starts, ticks and moves from focus to a short break", () => {
  const settings = P.normalizePomodoroSettings({ workMinutes: 1, shortBreakMinutes: 2, longBreakMinutes: 5, longBreakEvery: 4 });
  let state = P.startPomodoro(settings.state, at(0));
  assert.equal(state.running, true);
  let tick = P.tickPomodoro(settings, state, at(0));
  assert.equal(tick.completedPhase, null);
  tick = P.tickPomodoro(settings, state, at(1));
  assert.equal(tick.completedPhase, "work");
  assert.equal(tick.state.phase, "short");
  assert.equal(tick.state.remainingSec, 120);
  assert.equal(tick.state.running, false, "breaks do not auto-start by default");
  assert.equal(tick.state.workSessions, 1);
});

test("every fourth work session becomes a long break and auto-start is honoured", () => {
  const settings = P.normalizePomodoroSettings({
    workMinutes: 1,
    shortBreakMinutes: 1,
    longBreakMinutes: 5,
    longBreakEvery: 2,
    autoStartBreaks: true,
    autoStartWork: true,
  });
  let state = { ...settings.state, workSessions: 1 };
  state = P.startPomodoro(state, at(0));
  let tick = P.tickPomodoro(settings, state, at(1));
  assert.equal(tick.completedPhase, "work");
  assert.equal(tick.state.phase, "long");
  assert.equal(tick.state.running, true);
  tick = P.tickPomodoro(settings, tick.state, at(7));
  assert.equal(tick.completedPhase, "long");
  assert.equal(tick.state.phase, "work");
  assert.equal(tick.state.running, true);
});

test("pause preserves remaining time and reset returns to a fresh focus phase", () => {
  const settings = P.normalizePomodoroSettings({ workMinutes: 10 });
  let state = P.startPomodoro(settings.state, at(0));
  state = P.pausePomodoro(state, settings, at(2));
  assert.equal(state.running, false);
  assert.equal(state.remainingSec, 480);
  const reset = P.resetPomodoro(settings, at(3));
  assert.equal(reset.phase, "work");
  assert.equal(reset.remainingSec, 600);
  assert.equal(reset.running, false);
});

test("skip and formatted output are deterministic", () => {
  const settings = P.normalizePomodoroSettings({ workMinutes: 25, shortBreakMinutes: 5 });
  const skipped = P.skipPomodoro(settings, settings.state, at(0));
  assert.equal(skipped.skippedPhase, "work");
  assert.equal(skipped.state.phase, "short");
  assert.equal(P.formatPomodoroTime(0), "00:00");
  assert.equal(P.formatPomodoroTime(1499), "24:59");
});

test("the snapshot exposes the phase length so the view can label start or resume", () => {
  const settings = P.normalizePomodoroSettings({ workMinutes: 10 });
  const paused = P.pomodoroSnapshot(settings, { ...settings.state, remainingSec: 300 }, at(0));
  assert.equal(paused.phaseSeconds, 600);
  assert.equal(paused.display, "05:00");
  const running = P.pomodoroSnapshot(settings, { ...paused.state, running: true, startedAt: at(0).getTime() }, at(2));
  assert.equal(running.remaining, 180, "a running snapshot accounts for elapsed seconds");
  assert.equal(running.display, "03:00");
});

test("normalization clamps corrupt saved timer state", () => {
  const config = P.normalizePomodoroSettings({ workMinutes: 999, longBreakEvery: 1, state: { phase: "bogus", remainingSec: -5 } });
  assert.equal(config.workMinutes, 180);
  assert.equal(config.longBreakEvery, 2);
  assert.equal(config.state.phase, "work");
  assert.equal(config.state.remainingSec, 180 * 60);
});
