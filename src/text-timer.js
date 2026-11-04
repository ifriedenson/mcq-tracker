"use strict";
/*
 * Count-up timing for one passage in a `text-timer` block. This is a local
 * reading aid; it does not write a note, log a study session or change the
 * scheduler. State is keyed by source path + block content or an optional id.
 */
const { hashString, str } = require("./util");

const MAX_TIMERS = 300;
const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000;
const MAX_TITLE = 80;

function cleanTitle(value) {
  return str(value).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE) || "Text timer";
}

/**
 * A block may start with `title: ...`, `id: ...` and an optional `---` rule.
 * Everything after the header is shown verbatim as the passage being timed.
 */
function parseTextTimerBlock(source) {
  const lines = str(source).replace(/\r\n?/g, "\n").split("\n");
  let title = "Text timer";
  let id = "";
  let index = 0;
  for (; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line === "---") continue;
    const match = line.match(/^(title|id)\s*:\s*(.*)$/i);
    if (!match) break;
    if (match[1].toLowerCase() === "title") title = cleanTitle(match[2]);
    else id = str(match[2]).trim().slice(0, 80);
  }
  const body = lines.slice(index).join("\n").replace(/^\s+|\s+$/g, "");
  return {
    title,
    id,
    body,
    issues: body ? [] : ["Add the passage you want to time below the optional title line."],
    valid: !!body,
  };
}

function normalizeTextTimerSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const source = src.timers && typeof src.timers === "object" && !Array.isArray(src.timers) ? src.timers : {};
  const timers = {};
  for (const key of Object.keys(source).slice(-MAX_TIMERS)) {
    const raw = source[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    timers[key] = normalizeTextTimerState(raw);
  }
  return { timers };
}

function normalizeTextTimerState(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const state = ["idle", "running", "paused"].includes(src.state) ? src.state : "idle";
  const elapsedMs = Math.max(0, Math.min(MAX_ELAPSED_MS, Math.round(Number(src.elapsedMs) || 0)));
  const startedAt = Math.max(0, Math.round(Number(src.startedAt) || 0));
  const runningSince = Math.max(0, Math.round(Number(src.runningSince) || 0));
  if (state === "running" && !runningSince) return { state: "paused", elapsedMs, startedAt, runningSince: 0 };
  if (state === "running" && elapsedMs >= MAX_ELAPSED_MS) return { state: "paused", elapsedMs: MAX_ELAPSED_MS, startedAt, runningSince: 0 };
  return { state, elapsedMs, startedAt, runningSince: state === "running" ? runningSince : 0 };
}

function textTimerKey(sourcePath, source, id) {
  const stable = str(id).trim() ? `id:${str(id).trim()}` : `src:${str(source).replace(/\r\n?/g, "\n").trim()}`;
  return `txt-${hashString(`${str(sourcePath) || "note"}|${stable}`)}`;
}

function currentTextTimerElapsed(state, now) {
  const src = normalizeTextTimerState(state);
  const at = Math.max(0, Math.round(Number(now) || Date.now()));
  const running = src.state === "running" ? Math.max(0, at - src.runningSince) : 0;
  return Math.min(MAX_ELAPSED_MS, src.elapsedMs + running);
}

function startTextTimer(state, now) {
  const src = normalizeTextTimerState(state);
  const at = Math.max(0, Math.round(Number(now) || Date.now()));
  if (src.state === "running" || src.elapsedMs >= MAX_ELAPSED_MS) return src;
  return { state: "running", elapsedMs: src.elapsedMs, startedAt: src.startedAt || at, runningSince: at };
}

function pauseTextTimer(state, now) {
  const src = normalizeTextTimerState(state);
  if (src.state !== "running") return src;
  const at = Math.max(0, Math.round(Number(now) || Date.now()));
  return {
    state: "paused",
    elapsedMs: Math.min(MAX_ELAPSED_MS, src.elapsedMs + Math.max(0, at - src.runningSince)),
    startedAt: src.startedAt,
    runningSince: 0,
  };
}

function resetTextTimer(state) {
  const src = normalizeTextTimerState(state);
  return { state: "idle", elapsedMs: 0, startedAt: 0, runningSince: 0, previous: src.elapsedMs };
}

function formatTextTimerClock(ms) {
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function textTimerSettings(plugin) {
  if (!plugin.settings.textTimers || typeof plugin.settings.textTimers !== "object" || Array.isArray(plugin.settings.textTimers)) {
    plugin.settings.textTimers = { timers: {} };
  }
  if (!plugin.settings.textTimers.timers || typeof plugin.settings.textTimers.timers !== "object" || Array.isArray(plugin.settings.textTimers.timers)) {
    plugin.settings.textTimers.timers = {};
  }
  return plugin.settings.textTimers;
}

module.exports = {
  MAX_ELAPSED_MS,
  MAX_TIMERS,
  currentTextTimerElapsed,
  formatTextTimerClock,
  normalizeTextTimerSettings,
  normalizeTextTimerState,
  parseTextTimerBlock,
  pauseTextTimer,
  resetTextTimer,
  startTextTimer,
  textTimerKey,
  textTimerSettings,
};
