"use strict";
/* A dependency-free Pomodoro state machine. The view and status bar are only consumers. */

const PHASES = ["work", "short", "long"];
const MAX_MINUTES = 180;

function clampMinutes(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_MINUTES, Math.max(1, Math.round(n)));
}

function normalizePomodoroState(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const phase = PHASES.includes(src.phase) ? src.phase : "work";
  return {
    phase,
    remainingSec: Math.max(0, Math.round(Number(src.remainingSec) || 0)),
    running: src.running === true,
    startedAt: Math.max(0, Number(src.startedAt) || 0),
    workSessions: Math.max(0, Math.round(Number(src.workSessions) || 0)),
    completed: Math.max(0, Math.round(Number(src.completed) || 0)),
    skipped: Math.max(0, Math.round(Number(src.skipped) || 0)),
    lastCompleted: typeof src.lastCompleted === "string" ? src.lastCompleted : "",
  };
}

function normalizePomodoroSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const settings = {
    enabled: src.enabled !== false,
    workMinutes: clampMinutes(src.workMinutes, 25),
    shortBreakMinutes: clampMinutes(src.shortBreakMinutes, 5),
    longBreakMinutes: clampMinutes(src.longBreakMinutes, 15),
    longBreakEvery: Math.min(12, Math.max(2, Math.round(Number(src.longBreakEvery) || 4))),
    autoStartBreaks: src.autoStartBreaks === true,
    autoStartWork: src.autoStartWork === true,
  };
  settings.state = normalizePomodoroState(src.state);
  if (!settings.state.remainingSec) settings.state.remainingSec = phaseSeconds(settings, settings.state.phase);
  return settings;
}

function phaseSeconds(settings, phase) {
  if (phase === "short") return clampMinutes(settings.shortBreakMinutes, 5) * 60;
  if (phase === "long") return clampMinutes(settings.longBreakMinutes, 15) * 60;
  return clampMinutes(settings.workMinutes, 25) * 60;
}

function phaseLabel(phase) {
  return phase === "short" ? "Short break" : phase === "long" ? "Long break" : "Focus";
}

function nextPhase(settings, phase, workSessions) {
  if (phase !== "work") return "work";
  return workSessions > 0 && workSessions % Math.max(2, settings.longBreakEvery || 4) === 0 ? "long" : "short";
}

function autoStartFor(settings, phase) {
  return phase === "work" ? settings.autoStartWork === true : settings.autoStartBreaks === true;
}

function startPomodoro(state, now) {
  const current = normalizePomodoroState(state);
  if (current.running) return current;
  const at = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  return { ...current, running: true, startedAt: at, remainingSec: current.remainingSec > 0 ? current.remainingSec : 0 };
}

function pausePomodoro(state, settings, now) {
  const current = normalizePomodoroState(state);
  if (!current.running) return current;
  const at = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((at - current.startedAt) / 1000));
  return {
    ...current,
    running: false,
    startedAt: 0,
    remainingSec: Math.max(0, current.remainingSec - elapsed),
  };
}

function resetPomodoro(settings, now) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  return {
    phase: "work",
    remainingSec: phaseSeconds(settings, "work"),
    running: false,
    startedAt: 0,
    workSessions: 0,
    completed: 0,
    skipped: 0,
    lastCompleted: "",
    resetAt: at,
  };
}

/** Compute the running clock and advance exactly one phase when it reaches zero. */
function tickPomodoro(settings, state, now) {
  const current = normalizePomodoroState(state);
  if (!current.running) return { state: current, completedPhase: null };
  const at = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((at - current.startedAt) / 1000));
  const left = current.remainingSec - elapsed;
  if (left > 0) return { state: { ...current, remainingSec: left, startedAt: at }, completedPhase: null };

  const finishedPhase = current.phase;
  const workSessions = current.workSessions + (finishedPhase === "work" ? 1 : 0);
  const next = nextPhase(settings, finishedPhase, workSessions);
  const running = autoStartFor(settings, next);
  return {
    state: {
      ...current,
      phase: next,
      remainingSec: phaseSeconds(settings, next),
      running,
      startedAt: running ? at : 0,
      workSessions,
      completed: current.completed + 1,
      lastCompleted: finishedPhase,
    },
    completedPhase: finishedPhase,
  };
}

/** Manually skip the current phase; skipping focus does not count a completed work session. */
function skipPomodoro(settings, state, now) {
  const current = normalizePomodoroState(state);
  const at = now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now();
  const next = nextPhase(settings, current.phase, current.workSessions);
  const running = current.running || autoStartFor(settings, next);
  return {
    state: {
      ...current,
      phase: next,
      remainingSec: phaseSeconds(settings, next),
      running,
      startedAt: running ? at : 0,
      skipped: current.skipped + 1,
    },
    skippedPhase: current.phase,
  };
}

function advancePomodoro(settings, state, now) {
  return skipPomodoro(settings, state, now);
}

function formatPomodoroTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function pomodoroSnapshot(settings, state, now) {
  const config = normalizePomodoroSettings(settings);
  const current = normalizePomodoroState(state || config.state);
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const total = phaseSeconds(config, current.phase);
  const elapsed = current.running && current.startedAt ? Math.max(0, Math.floor((at.getTime() - current.startedAt) / 1000)) : 0;
  const remaining = Math.max(0, current.remainingSec - elapsed);
  return {
    settings: config,
    state: current,
    phase: current.phase,
    label: phaseLabel(current.phase),
    phaseSeconds: total,
    remaining,
    display: formatPomodoroTime(remaining),
    running: current.running,
    completed: current.completed,
    workSessions: current.workSessions,
  };
}

module.exports = {
  MAX_MINUTES,
  PHASES,
  advancePomodoro,
  autoStartFor,
  formatPomodoroTime,
  nextPhase,
  normalizePomodoroSettings,
  normalizePomodoroState,
  pausePomodoro,
  phaseLabel,
  phaseSeconds,
  pomodoroSnapshot,
  resetPomodoro,
  skipPomodoro,
  startPomodoro,
  tickPomodoro,
};
