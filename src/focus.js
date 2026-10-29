"use strict";
/* Focus sessions and study-time totals. Pure helpers, so the UI and tests share one clock model. */

const FOCUS_STORAGE_KEY = "mcqTrackerFocus";
const MAX_FOCUS_MS = 4 * 3600 * 1000; // a session left open overnight should not become a 9-hour block
const MAX_SESSIONS = 5000;
const DEFAULT_STUDY_LOG = { sessions: [], dailyGoalMinutes: 60, lastCourse: "" };

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(key, n) {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

function startFocus(options, now) {
  const at = Number(now) || Date.now();
  const minutes = Math.max(1, Math.min(480, Math.round(Number(options && options.minutes) || 25)));
  return {
    id: `focus-${at.toString(36)}`,
    course: str(options && options.course).trim(),
    task: str(options && options.task).trim(),
    targetMinutes: minutes,
    startedAt: at,
    runningSince: at,
    accumulatedMs: 0,
  };
}

function elapsedFocusMs(state, now) {
  if (!state) return 0;
  const at = Number(now) || Date.now();
  const running = state.runningSince ? Math.max(0, at - Number(state.runningSince)) : 0;
  return Math.min(MAX_FOCUS_MS, Math.max(0, Number(state.accumulatedMs) || 0) + running);
}

function pauseFocus(state, now) {
  if (!state || !state.runningSince) return state;
  const ms = elapsedFocusMs(state, now);
  return Object.assign({}, state, { accumulatedMs: ms, runningSince: null });
}

function resumeFocus(state, now) {
  if (!state || state.runningSince) return state;
  return Object.assign({}, state, { runningSince: Number(now) || Date.now() });
}

function focusRemainingMs(state, now) {
  const target = Math.max(1, Number(state && state.targetMinutes) || 25) * 60000;
  return Math.max(0, target - elapsedFocusMs(state, now));
}

function formatFocusClock(ms) {
  const seconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function finishFocus(state, now) {
  if (!state) return null;
  const at = Number(now) || Date.now();
  const elapsed = elapsedFocusMs(state, at);
  if (elapsed < 1000) return null;
  return {
    id: str(state.id) || `study-${at.toString(36)}`,
    date: dayKey(at),
    minutes: Math.max(1, Math.round(elapsed / 60000)),
    seconds: Math.round(elapsed / 1000),
    course: str(state.course).trim(),
    note: str(state.task).trim(),
    source: "focus",
    startedAt: Number(state.startedAt) || at,
    endedAt: at,
  };
}

function normalizeStudyLog(saved) {
  const src = saved && typeof saved === "object" ? saved : {};
  const sessions = (Array.isArray(src.sessions) ? src.sessions : [])
    .filter((s) => s && typeof s === "object" && /^\d{4}-\d{2}-\d{2}$/.test(str(s.date)))
    .map((s) => ({
      id: str(s.id) || `study-${Math.random().toString(36).slice(2, 9)}`,
      date: str(s.date),
      minutes: Math.max(1, Math.min(1440, Math.round(Number(s.minutes) || 0))),
      course: str(s.course).trim(),
      note: str(s.note).trim(),
      source: s.source === "focus" ? "focus" : "manual",
      startedAt: Number(s.startedAt) || 0,
      endedAt: Number(s.endedAt) || 0,
    }))
    .slice(-MAX_SESSIONS);
  const goal = Math.round(Number(src.dailyGoalMinutes));
  return {
    sessions,
    dailyGoalMinutes: Number.isFinite(goal) ? Math.max(5, Math.min(480, goal)) : DEFAULT_STUDY_LOG.dailyGoalMinutes,
    lastCourse: str(src.lastCourse).trim(),
  };
}

function addStudySession(log, session) {
  const base = normalizeStudyLog(log);
  const date = str(session && session.date) || dayKey(new Date());
  const minutes = Math.max(1, Math.min(1440, Math.round(Number(session && session.minutes) || 0)));
  const next = {
    id: str(session && session.id) || `study-${Date.now().toString(36)}`,
    date,
    minutes,
    course: str(session && session.course).trim(),
    note: str(session && session.note).trim(),
    source: session && session.source === "focus" ? "focus" : "manual",
    startedAt: Number(session && session.startedAt) || 0,
    endedAt: Number(session && session.endedAt) || 0,
  };
  const sessions = base.sessions.concat(next).slice(-MAX_SESSIONS);
  return {
    sessions,
    dailyGoalMinutes: base.dailyGoalMinutes,
    lastCourse: next.course || base.lastCourse,
  };
}

function studyStreak(sessions, today) {
  const dates = new Set((sessions || []).map((s) => str(s.date)));
  let cursor = dates.has(today) ? today : dates.has(addDays(today, -1)) ? addDays(today, -1) : "";
  let streak = 0;
  while (cursor && dates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function studySummary(log, today) {
  const normalized = normalizeStudyLog(log);
  const day = str(today) || dayKey(new Date());
  const weekStart = addDays(day, -6);
  const sessions = normalized.sessions;
  const todaySessions = sessions.filter((s) => s.date === day);
  const todayMinutes = todaySessions.reduce((n, s) => n + s.minutes, 0);
  const weekMinutes = sessions.filter((s) => s.date >= weekStart && s.date <= day).reduce((n, s) => n + s.minutes, 0);
  const byCourse = {};
  for (const s of sessions) {
    const key = s.course || "No course";
    byCourse[key] = (byCourse[key] || 0) + s.minutes;
  }
  const goal = normalized.dailyGoalMinutes;
  return {
    todayMinutes,
    weekMinutes,
    goalMinutes: goal,
    goalPct: goal ? Math.min(100, Math.round((todayMinutes / goal) * 100)) : 0,
    streak: studyStreak(sessions, day),
    byCourse,
    sessionsToday: todaySessions.length,
  };
}

module.exports = {
  DEFAULT_STUDY_LOG,
  FOCUS_STORAGE_KEY,
  MAX_FOCUS_MS,
  addStudySession,
  dayKey,
  elapsedFocusMs,
  finishFocus,
  focusRemainingMs,
  formatFocusClock,
  normalizeStudyLog,
  pauseFocus,
  resumeFocus,
  startFocus,
  studyStreak,
  studySummary,
};
