"use strict";
/*
 * Opt-in operating-system notifications for the daily study reminder.
 *
 * Obsidian desktop is an Electron renderer, so the standard Notification API
 * is usually present there. Mobile and some builds do not expose it, so every
 * entry point is feature-detected and returns a result object instead of
 * throwing: the caller keeps the in-app status-bar nudge either way. This module
 * makes no network request and asks for permission only when the user opts in.
 */
const { str } = require("./util");

const TITLE = "MCQ Tracker";
const MAX_BODY = 180;
const PERMISSIONS = ["granted", "denied", "default"];

function windowFor(env) {
  if (env && typeof env === "object" && env.window && typeof env.window === "object") return env.window;
  return typeof window !== "undefined" ? window : null;
}

function notificationCtor(env) {
  const win = windowFor(env);
  return win && typeof win.Notification === "function" ? win.Notification : null;
}

function supportReason(available, permission) {
  if (!available) return "This build exposes no operating-system notification API.";
  if (permission === "granted") return "Operating-system notifications are allowed.";
  if (permission === "denied") return "Operating-system notifications are blocked; the in-app reminder still works.";
  return "Operating-system notifications need permission before the first one is shown.";
}

/** Read-only support snapshot. Never prompts. */
function notificationSupport(env) {
  const Ctor = notificationCtor(env);
  if (!Ctor) return { available: false, permission: "unavailable", granted: false, reason: supportReason(false, "unavailable") };
  const raw = String(Ctor.permission || "");
  const permission = PERMISSIONS.includes(raw) ? raw : "default";
  return { available: true, permission, granted: permission === "granted", reason: supportReason(true, permission) };
}

/** Ask the operating system for permission. Only called from an explicit opt-in. */
async function requestOsPermission(env) {
  const support = notificationSupport(env);
  if (!support.available) return { ...support, requested: false };
  const Ctor = notificationCtor(env);
  if (typeof Ctor.requestPermission !== "function") return { ...support, requested: false, reason: "This build cannot request notification permission." };
  let permission = support.permission;
  try {
    const answer = await Ctor.requestPermission();
    permission = PERMISSIONS.includes(String(answer)) ? String(answer) : support.permission;
  } catch (err) {
    permission = "denied";
  }
  return { available: true, requested: true, permission, granted: permission === "granted", reason: supportReason(true, permission) };
}

function clampBody(text) {
  const body = str(text).trim();
  if (body.length <= MAX_BODY) return body;
  return `${body.slice(0, MAX_BODY - 1).trimEnd()}…`;
}

/** The notification payload for a reminder state, or null when nothing is due. */
function reminderNotification(info) {
  if (!info || typeof info !== "object") return null;
  const body = clampBody(info.text);
  if (!body) return null;
  return { title: TITLE, body };
}

/**
 * Show the reminder through the operating system when it is allowed.
 * Returns { sent, reason } and never throws; a false `sent` means the caller's
 * in-app reminder is the only channel.
 */
function showReminderNotification(env, info) {
  const payload = reminderNotification(info);
  if (!payload) return { sent: false, reason: "There is nothing to remind about." };
  const support = notificationSupport(env);
  if (!support.available) return { sent: false, reason: support.reason };
  if (support.permission !== "granted") return { sent: false, reason: support.reason };
  const Ctor = notificationCtor(env);
  try {
    const notification = new Ctor(payload.title, { body: payload.body, tag: "mcq-reminder" });
    if (notification && typeof notification.close === "function") notification.close();
    return { sent: true, reason: "Shown through the operating system." };
  } catch (err) {
    return { sent: false, reason: "The operating system rejected the notification." };
  }
}

module.exports = {
  MAX_BODY,
  TITLE,
  clampBody,
  notificationSupport,
  reminderNotification,
  requestOsPermission,
  showReminderNotification,
};
