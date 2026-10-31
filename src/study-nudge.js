"use strict";
/*
 * In-app study nudge. Better Task's reminder idea, kept inside Obsidian: a
 * single Notice at startup (or when the user asks) plus a ribbon label that
 * names today's due work. No OS notification permission is requested and no
 * network request is made. Off by default.
 */
const { fmtDate, str } = require("./util");

const DEFAULT_STUDY_NUDGE = {
  enabled: false,
  hour: 9,
  quietFrom: 22,
  quietTo: 7,
  ribbonLabel: true,
  lastShown: "",
};

function clampHour(value, fallback) {
  const hour = Math.round(Number(value));
  return Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : fallback;
}

function normalizeStudyNudgeSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: source.enabled === true,
    hour: clampHour(source.hour, DEFAULT_STUDY_NUDGE.hour),
    quietFrom: clampHour(source.quietFrom, DEFAULT_STUDY_NUDGE.quietFrom),
    quietTo: clampHour(source.quietTo, DEFAULT_STUDY_NUDGE.quietTo),
    ribbonLabel: source.ribbonLabel !== false,
    lastShown: /^\d{4}-\d{2}-\d{2}$/.test(str(source.lastShown).slice(0, 10)) ? str(source.lastShown).slice(0, 10) : "",
  };
}

function nudgeCounts(input) {
  const counts = input && typeof input === "object" ? input : {};
  return {
    questions: Math.max(0, Math.round(Number(counts.questions) || 0)),
    cards: Math.max(0, Math.round(Number(counts.cards) || 0)),
    tasks: Math.max(0, Math.round(Number(counts.tasks) || 0)),
  };
}

function nudgeText(input) {
  const counts = nudgeCounts(input);
  const parts = [];
  if (counts.questions) parts.push(`${counts.questions} question${counts.questions === 1 ? "" : "s"}`);
  if (counts.cards) parts.push(`${counts.cards} card${counts.cards === 1 ? "" : "s"}`);
  if (counts.tasks) parts.push(`${counts.tasks} task${counts.tasks === 1 ? "" : "s"}`);
  return parts.length ? `${parts.join(", ")} due today.` : "";
}

function inQuietHours(hour, from, to) {
  if (from === to) return false;
  return from > to ? hour >= from || hour < to : hour >= from && hour < to;
}

function nudgeState(value, counts, now) {
  const cfg = normalizeStudyNudgeSettings(value);
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const today = fmtDate(date);
  const hour = date.getHours();
  const text = nudgeText(counts);
  const quiet = inQuietHours(hour, cfg.quietFrom, cfg.quietTo);
  const visible = cfg.enabled && !!text && hour >= cfg.hour && !quiet && cfg.lastShown !== today;
  return {
    enabled: cfg.enabled,
    visible,
    text,
    today,
    hour,
    quiet,
    banner: nudgeText(counts),
    badge: cfg.ribbonLabel && cfg.enabled && text ? `MCQ · ${nudgeText(counts).replace(" due today.", "")} due` : "",
  };
}

function markNudgeShown(value, now) {
  const cfg = normalizeStudyNudgeSettings(value);
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return { ...cfg, lastShown: fmtDate(date) };
}

module.exports = {
  DEFAULT_STUDY_NUDGE,
  inQuietHours,
  markNudgeShown,
  nudgeCounts,
  nudgeState,
  nudgeText,
  normalizeStudyNudgeSettings,
};
