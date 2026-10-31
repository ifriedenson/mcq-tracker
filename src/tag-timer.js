"use strict";
/*
 * Tag timers are local stopwatches/countdowns grouped by an Obsidian tag.
 * A `tag-timer` block declares the tags and kinds; state is stored in plugin
 * settings by note path + tag so a restart resumes the same timer. Nothing here
 * writes notes or touches the question/card scheduler.
 */
const { dayKey, formatFocusClock } = require("./focus");
const { hashString, localDate, str } = require("./util");

const MAX_TIMERS = 200;
const MAX_BLOCK_TIMERS = 40;
const MAX_SESSIONS = 1000;
const MAX_ELAPSED_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_COUNTDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_COUNTDOWN_SECONDS = 25 * 60;
const STATES = ["idle", "running", "paused", "stopped"];
const TAG_RE = /^#[A-Za-z0-9_/-]+$/;

function timerNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function tagKey(tag) {
  return str(tag).trim().toLowerCase();
}

function tagTimerKey(sourcePath, tag) {
  return `tt-${hashString(`${str(sourcePath) || "note"}|${tagKey(tag)}`)}`;
}

/** Parse `25`, `25m`, `25 minutes`, `mm:ss` or `hh:mm:ss`. */
function parseCountdownSeconds(value) {
  const text = str(value).trim().toLowerCase();
  if (!text) return null;
  const plain = text.replace(/\s+/g, " ");
  let seconds = null;
  const clock = plain.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    const first = Number(clock[1]);
    const second = Number(clock[2]);
    const third = clock[3] === undefined ? null : Number(clock[3]);
    if (second > 59 || (third !== null && third > 59)) return null;
    seconds = third === null ? first * 60 + second : first * 3600 + second * 60 + third;
  } else {
    const minutes = plain.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)?$/);
    const secs = plain.match(/^(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)$/);
    if (minutes) seconds = Math.round(Number(minutes[1]) * 60);
    else if (secs) seconds = Math.round(Number(secs[1]));
  }
  if (!Number.isFinite(seconds) || seconds < 1 || seconds * 1000 > MAX_COUNTDOWN_MS) return null;
  return seconds;
}

/**
 * A block is one or more lines:
 *   #study/biology stopwatch
 *   #study/chemistry | countdown 25
 * A bare tag is a stopwatch; a countdown without a duration defaults to 25m.
 */
function parseTagTimers(source) {
  const entries = [];
  const issues = [];
  const seen = new Set();
  const lines = str(source).replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    const lineNo = index + 1;
    if (!line || line.startsWith("//")) continue;
    if (!line.startsWith("#")) {
      issues.push(`Line ${lineNo}: add a #tag before the timer kind.`);
      continue;
    }
    const tags = line.match(/#[A-Za-z0-9_/-]+/g) || [];
    if (tags.length > 1) {
      issues.push(`Line ${lineNo}: "${line}" has more than one #tag. Use one tag per timer.`);
      continue;
    }
    const tag = tags[0];
    if (!tag || !line.startsWith(tag) || !TAG_RE.test(tag) || tag.endsWith("/")) {
      issues.push(`Line ${lineNo}: "${tag || ""}" is not a valid tag. Use letters, numbers, /, - or _.`);
      continue;
    }
    const key = tagKey(tag);
    if (seen.has(key)) {
      issues.push(`Line ${lineNo}: ${tag} is already declared in this block.`);
      continue;
    }
    const rest = line.slice(tag.length).replace(/^\s*[|:]\s*/, "").trim();
    let kind = "stopwatch";
    let durationMs = 0;
    if (rest) {
      const parts = rest.split(/\s+/);
      const kindToken = parts[0].toLowerCase().replace(/:$/, "");
      if (kindToken === "stopwatch") {
        if (parts.length > 1) {
          issues.push(`Line ${lineNo}: stopwatch does not take a time. Use countdown 25 for a timed timer.`);
          continue;
        }
      } else if (kindToken === "countdown") {
        kind = "countdown";
        const duration = parts.length > 1 ? parseCountdownSeconds(parts.slice(1).join(" ")) : DEFAULT_COUNTDOWN_SECONDS;
        if (duration === null) {
          issues.push(`Line ${lineNo}: countdown needs a time from 1 second to 24 hours, for example countdown 25.`);
          continue;
        }
        durationMs = duration * 1000;
      } else {
        issues.push(`Line ${lineNo}: "${parts[0]}" is not a timer kind. Use stopwatch or countdown.`);
        continue;
      }
    }
    if (entries.length >= MAX_BLOCK_TIMERS) {
      issues.push(`This block has more than ${MAX_BLOCK_TIMERS} timers. Split it into smaller blocks.`);
      break;
    }
    seen.add(key);
    entries.push({ tag, key, kind, durationMs, line: lineNo });
  }
  return { entries, issues, valid: entries.length > 0 && issues.length === 0 };
}

function defaultTagTimer(entry, now) {
  return {
    tag: entry.tag,
    kind: entry.kind,
    state: "idle",
    elapsedMs: 0,
    runningSince: 0,
    durationMs: entry.kind === "countdown" ? entry.durationMs : 0,
    startedAt: 0,
    stoppedAt: 0,
    completedAt: 0,
    sessionId: "",
  };
}

function normalizeTagTimerState(value) {
  const source = value && typeof value === "object" ? value : {};
  const tag = str(source.tag).trim();
  if (!TAG_RE.test(tag) || tag.endsWith("/")) return null;
  const kind = source.kind === "countdown" ? "countdown" : "stopwatch";
  const durationMs = kind === "countdown" ? clamp(Math.round(timerNumber(source.durationMs, DEFAULT_COUNTDOWN_SECONDS * 1000)), 1000, MAX_COUNTDOWN_MS) : 0;
  let elapsedMs = clamp(Math.round(timerNumber(source.elapsedMs, 0)), 0, kind === "countdown" ? durationMs : MAX_ELAPSED_MS);
  let state = STATES.includes(source.state) ? source.state : "idle";
  let runningSince = state === "running" ? Math.max(0, Math.round(timerNumber(source.runningSince, 0))) : 0;
  if (state === "running" && !runningSince) state = "paused";
  const startedAt = Math.max(0, Math.round(timerNumber(source.startedAt, 0)));
  const stoppedAt = Math.max(0, Math.round(timerNumber(source.stoppedAt, 0)));
  const completedAt = Math.max(0, Math.round(timerNumber(source.completedAt, 0)));
  if (kind === "countdown" && state === "stopped" && completedAt) elapsedMs = durationMs;
  return {
    tag,
    kind,
    state,
    elapsedMs,
    runningSince,
    durationMs,
    startedAt,
    stoppedAt,
    completedAt,
    sessionId: str(source.sessionId).trim().slice(0, 160),
  };
}

function normalizeTagTimerSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const timers = {};
  const rawTimers = source.timers && typeof source.timers === "object" && !Array.isArray(source.timers) ? source.timers : {};
  let count = 0;
  for (const [rawKey, rawValue] of Object.entries(rawTimers)) {
    if (count >= MAX_TIMERS) break;
    const key = str(rawKey).trim().slice(0, 80);
    const timer = normalizeTagTimerState(rawValue);
    if (!key || !timer) continue;
    timers[key] = timer;
    count++;
  }
  const rawSessions = Array.isArray(source.sessions) ? source.sessions : [];
  const sessions = rawSessions
    .map((session) => {
      if (!session || typeof session !== "object") return null;
      const tag = str(session.tag).trim();
      if (!TAG_RE.test(tag) || tag.endsWith("/")) return null;
      const seconds = Math.round(timerNumber(session.seconds, 0));
      if (seconds <= 0 || seconds > MAX_ELAPSED_MS / 1000) return null;
      const date = str(session.date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return {
        id: str(session.id).trim().slice(0, 160) || `tts-${hashString(`${tag}|${date}|${seconds}`)}`,
        tag,
        kind: session.kind === "countdown" ? "countdown" : "stopwatch",
        seconds,
        date,
        startedAt: Math.max(0, Math.round(timerNumber(session.startedAt, 0))),
        endedAt: Math.max(0, Math.round(timerNumber(session.endedAt, 0))),
      };
    })
    .filter(Boolean)
    .slice(-MAX_SESSIONS);
  return { timers, sessions };
}

function currentTagElapsed(state, now) {
  if (!state) return 0;
  const at = Math.max(0, Math.round(timerNumber(now, Date.now())));
  const running = state.state === "running" ? Math.max(0, at - Math.max(0, timerNumber(state.runningSince, at))) : 0;
  const elapsed = Math.max(0, timerNumber(state.elapsedMs, 0)) + running;
  const capped = state.kind === "countdown" ? Math.min(elapsed, Math.max(0, timerNumber(state.durationMs, 0))) : elapsed;
  return Math.min(MAX_ELAPSED_MS, capped);
}

function tagTimerRemaining(state, now) {
  if (!state || state.kind !== "countdown") return 0;
  return Math.max(0, timerNumber(state.durationMs, 0) - currentTagElapsed(state, now));
}

/** Stopwatch time goes up; an unfinished countdown counts down. */
function tagTimerShownMs(state, now) {
  if (!state) return 0;
  if (state.kind === "countdown" && state.state !== "stopped") return tagTimerRemaining(state, now);
  return currentTagElapsed(state, now);
}

function tagTimerDisplay(state, now) {
  return formatFocusClock(tagTimerShownMs(state, now));
}

function tagTimerStateLabel(state) {
  if (!state) return "Ready";
  if (state.state === "running") return "Running";
  if (state.state === "paused") return "Paused";
  if (state.state === "stopped") return state.completedAt ? "Finished" : "Stopped";
  return "Ready";
}

function mergeTagTimer(entry, saved) {
  const normalized = normalizeTagTimerState(saved);
  if (!normalized || normalized.kind !== entry.kind || tagKey(normalized.tag) !== tagKey(entry.tag)) return defaultTagTimer(entry, 0);
  const durationMs = entry.kind === "countdown" ? entry.durationMs : 0;
  return {
    ...normalized,
    tag: entry.tag,
    durationMs,
    elapsedMs: entry.kind === "countdown" ? Math.min(normalized.elapsedMs, durationMs) : normalized.elapsedMs,
  };
}

function startTagTimer(state, now) {
  const at = Math.max(0, Math.round(timerNumber(now, Date.now())));
  if (!state || state.state === "running") return state;
  const restart = state.state === "idle" || state.state === "stopped" || !!state.completedAt;
  const elapsed = restart ? 0 : currentTagElapsed(state, at);
  return {
    ...state,
    state: "running",
    elapsedMs: state.kind === "countdown" ? Math.min(elapsed, state.durationMs) : elapsed,
    runningSince: at,
    startedAt: restart || !state.startedAt ? at : state.startedAt,
    stoppedAt: 0,
    completedAt: 0,
    sessionId: "",
  };
}

function pauseTagTimer(state, now) {
  if (!state || state.state !== "running") return state;
  return {
    ...state,
    state: "paused",
    elapsedMs: currentTagElapsed(state, now),
    runningSince: 0,
  };
}

function stopTagTimer(state, now) {
  if (!state || state.state === "stopped") return state;
  return {
    ...state,
    state: "stopped",
    elapsedMs: currentTagElapsed(state, now),
    runningSince: 0,
    stoppedAt: Math.max(0, Math.round(timerNumber(now, Date.now()))),
  };
}

function resetTagTimer(state) {
  if (!state) return state;
  return {
    ...state,
    state: "idle",
    elapsedMs: 0,
    runningSince: 0,
    startedAt: 0,
    stoppedAt: 0,
    completedAt: 0,
    sessionId: "",
  };
}

/** Complete a countdown that has reached zero. */
function settleTagTimer(state, now) {
  if (!state || state.kind !== "countdown" || state.state === "stopped") return { state, finished: false };
  if (state.state !== "running" && state.state !== "paused") return { state, finished: false };
  if (currentTagElapsed(state, now) < state.durationMs) return { state, finished: false };
  const at = Math.max(0, Math.round(timerNumber(now, Date.now())));
  return {
    finished: true,
    state: {
      ...state,
      state: "stopped",
      elapsedMs: state.durationMs,
      runningSince: 0,
      stoppedAt: at,
      completedAt: at,
    },
  };
}

/** Add a completed timer to the local session log. A timer is logged once. */
function recordTagSession(settings, state, now) {
  const target = settings && typeof settings === "object" ? settings : { timers: {}, sessions: [] };
  if (!target.timers || typeof target.timers !== "object") target.timers = {};
  if (!Array.isArray(target.sessions)) target.sessions = [];
  const elapsed = currentTagElapsed(state, now);
  if (!state || elapsed < 1000 || state.sessionId) return { session: null, state };
  const at = Math.max(0, Math.round(timerNumber(now, Date.now())));
  const id = `tts-${hashString(`${state.tag}|${state.startedAt || 0}|${at}`)}`;
  const session = {
    id,
    tag: state.tag,
    kind: state.kind,
    seconds: Math.round(elapsed / 1000),
    date: dayKey(new Date(at)),
    startedAt: state.startedAt || 0,
    endedAt: at,
  };
  target.sessions = target.sessions.concat(session).slice(-MAX_SESSIONS);
  return { session, state: { ...state, sessionId: id } };
}

function stopRunningTagTimers(settings, now) {
  const target = normalizeTagTimerSettings(settings);
  let count = 0;
  for (const [key, state] of Object.entries(target.timers)) {
    if (state.state !== "running") continue;
    const stopped = stopTagTimer(state, now);
    const recorded = recordTagSession(target, stopped, now);
    target.timers[key] = recorded.state;
    count++;
  }
  return { settings: target, count };
}

function shiftDay(key, offset) {
  const date = new Date(`${key}T00:00:00`);
  if (isNaN(date.getTime())) return key;
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}

function formatTagDuration(seconds) {
  const total = Math.max(0, Math.round(timerNumber(seconds, 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes) return `${minutes}m`;
  return `${total}s`;
}

/** Aggregate completed sessions by tag for the block's analytics panel. */
function tagTimerSummary(value, today) {
  const settings = normalizeTagTimerSettings(value);
  const day = str(today).trim() || localDate();
  const weekStart = shiftDay(day, -6);
  const rows = new Map();
  let todayTotal = 0;
  let weekTotal = 0;
  for (const session of settings.sessions) {
    if (session.date > day) continue;
    const row = rows.get(tagKey(session.tag)) || {
      tag: session.tag,
      todaySeconds: 0,
      weekSeconds: 0,
      totalSeconds: 0,
      sessions: 0,
      lastDate: "",
    };
    row.totalSeconds += session.seconds;
    if (session.date === day) {
      row.todaySeconds += session.seconds;
      todayTotal += session.seconds;
    }
    if (session.date >= weekStart) {
      row.weekSeconds += session.seconds;
      weekTotal += session.seconds;
    }
    row.sessions++;
    if (!row.lastDate || session.date > row.lastDate) row.lastDate = session.date;
    rows.set(tagKey(session.tag), row);
  }
  return {
    todayTotal,
    weekTotal,
    sessionCount: settings.sessions.length,
    rows: [...rows.values()].sort((a, b) => b.totalSeconds - a.totalSeconds || a.tag.localeCompare(b.tag)),
    recent: settings.sessions.slice(-5).reverse(),
  };
}

module.exports = {
  DEFAULT_COUNTDOWN_SECONDS,
  MAX_COUNTDOWN_MS,
  MAX_ELAPSED_MS,
  MAX_SESSIONS,
  MAX_TIMERS,
  currentTagElapsed,
  defaultTagTimer,
  formatTagDuration,
  mergeTagTimer,
  normalizeTagTimerSettings,
  normalizeTagTimerState,
  parseCountdownSeconds,
  parseTagTimers,
  pauseTagTimer,
  recordTagSession,
  resetTagTimer,
  settleTagTimer,
  startTagTimer,
  stopRunningTagTimers,
  stopTagTimer,
  tagTimerDisplay,
  tagTimerKey,
  tagTimerRemaining,
  tagTimerShownMs,
  tagTimerStateLabel,
  tagTimerSummary,
};
