"use strict";
/*
 * Local daily reminder.
 *
 * No OS notification and no network request: this only decides whether Today
 * and the status bar should show a quiet nudge, at most once per local day.
 */
const { fmtDate, str } = require("./util");

const DEFAULT_REMINDER = {
  enabled: false,
  hour: 9,
  lastShown: "",
  dismissed: "",
};

function normalizeReminder(value) {
  const src = value && typeof value === "object" ? value : {};
  const hour = Math.round(Number(src.hour));
  return {
    enabled: src.enabled === true,
    hour: Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : DEFAULT_REMINDER.hour,
    lastShown: /^\d{4}-\d{2}-\d{2}$/.test(str(src.lastShown).slice(0, 10)) ? str(src.lastShown).slice(0, 10) : "",
    dismissed: /^\d{4}-\d{2}-\d{2}$/.test(str(src.dismissed).slice(0, 10)) ? str(src.dismissed).slice(0, 10) : "",
  };
}

function reminderText(counts) {
  const c = counts || {};
  const due = Math.max(0, Math.round(Number(c.due) || 0));
  const fresh = Math.max(0, Math.round(Number(c.fresh) || 0));
  const daily = c.daily === true;
  if (due > 0) return `${due} question${due === 1 ? "" : "s"} due today`;
  if (fresh > 0) return `${fresh} new question${fresh === 1 ? "" : "s"} ready`;
  if (daily) return "Today's daily quiz is ready";
  return "";
}

function reminderState(state, opts) {
  const o = opts || {};
  const cfg = normalizeReminder(state);
  const now = o.now instanceof Date && !isNaN(o.now.getTime()) ? o.now : new Date();
  const today = fmtDate(now);
  const counts = {
    due: Math.max(0, Math.round(Number(o.due) || 0)),
    fresh: Math.max(0, Math.round(Number(o.fresh) || 0)),
    daily: o.daily === true,
  };
  const text = reminderText(counts);
  const afterHour = now.getHours() >= cfg.hour;
  const visible = cfg.enabled && !!text && afterHour && cfg.dismissed !== today;
  const freshNudge = visible && cfg.lastShown !== today;
  return { enabled: cfg.enabled, visible, freshNudge, text, today, counts, hour: cfg.hour, dismissed: cfg.dismissed === today };
}

function markReminderShown(state, now) {
  const cfg = normalizeReminder(state);
  const today = fmtDate(now instanceof Date ? now : new Date());
  return { ...cfg, lastShown: today };
}

function dismissReminder(state, now) {
  const cfg = normalizeReminder(state);
  const today = fmtDate(now instanceof Date ? now : new Date());
  return { ...cfg, dismissed: today, lastShown: today };
}

module.exports = {
  DEFAULT_REMINDER,
  dismissReminder,
  markReminderShown,
  normalizeReminder,
  reminderState,
  reminderText,
};
