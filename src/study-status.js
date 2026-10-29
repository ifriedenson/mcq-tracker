"use strict";
/*
 * Known, Exclude, Suspend and Bury are note-level study controls, not scheduler
 * state.
 *
 * - known: hide the item for a number of days, then it returns as due.
 * - excluded: keep the note but remove it from every practice queue.
 * - suspended: hide it until the learner restores it.
 * - buried: hide it until tomorrow, then it returns as due.
 *
 * The properties are intentionally readable and Dataview-friendly:
 *   study_status: active | known | excluded | suspended | buried
 *   known_until: YYYY-MM-DD
 *   known_days: number
 *   excluded_on: YYYY-MM-DD
 *   excluded_reason: short text
 *   suspended_on: YYYY-MM-DD
 *   buried_until: YYYY-MM-DD
 */
const { addDays, fmtDate, localDate, str } = require("./util");

const DEFAULT_KNOWN_DAYS = 14;
const MAX_KNOWN_DAYS = 3650;
const STUDY_STATUSES = ["active", "known", "excluded", "suspended", "buried"];
const STATUS_PROPS = ["study_status", "known_days", "known_until", "excluded_on", "excluded_reason", "suspended_on", "buried_until"];

/** Capture only the readable status properties so an action can be undone exactly. */
function snapshotStudyStatus(fm) {
  const snapshot = {};
  for (const key of STATUS_PROPS) {
    if (fm && fm[key] !== undefined) snapshot[key] = fm[key];
  }
  return snapshot;
}

/** Restore a snapshot in place, removing any status properties that were not there before. */
function restoreStudyStatus(fm, snapshot) {
  for (const key of STATUS_PROPS) delete fm[key];
  if (!snapshot) return;
  for (const key of STATUS_PROPS) {
    if (snapshot[key] !== undefined) fm[key] = snapshot[key];
  }
}

function normalizeStatus(value) {
  const s = str(value).trim().toLowerCase();
  return STUDY_STATUSES.includes(s) ? s : "active";
}

function normalizeDays(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Math.max(1, Math.round(Number(fallback) || DEFAULT_KNOWN_DAYS));
  return Math.min(MAX_KNOWN_DAYS, Math.max(1, Math.round(n)));
}

function dateKey(value) {
  const s = str(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/** The effective status today. An expired Known item becomes active again. */
function statusOf(fm, today) {
  const raw = normalizeStatus(fm && fm.study_status);
  const day = dateKey(today) || localDate();
  if (raw === "excluded") return "excluded";
  if (raw === "suspended") return "suspended";
  if (raw === "buried") {
    const until = dateKey(fm && fm.buried_until);
    return until && until > day ? "buried" : "active";
  }
  if (raw === "known") {
    const until = dateKey(fm && fm.known_until);
    if (until && until > day) return "known";
  }
  return "active";
}

function isStudyable(fm, today) {
  return statusOf(fm, today) === "active";
}

/** Mutates `fm` inside processFrontMatter. Returns what the UI should announce. */
function setStudyStatus(fm, status, options) {
  const opts = options || {};
  const next = normalizeStatus(status);
  const now = opts.now instanceof Date && !isNaN(opts.now.getTime()) ? opts.now : new Date();
  const day = fmtDate(now);
  const previous = snapshotStudyStatus(fm);

  if (next === "known") {
    const days = normalizeDays(opts.days, DEFAULT_KNOWN_DAYS);
    const until = fmtDate(addDays(now, days));
    fm.study_status = "known";
    fm.known_days = days;
    fm.known_until = until;
    delete fm.excluded_on;
    delete fm.excluded_reason;
    delete fm.suspended_on;
    delete fm.buried_until;
    return { status: "known", days, until, on: day, previous };
  }

  if (next === "excluded") {
    fm.study_status = "excluded";
    fm.excluded_on = day;
    fm.excluded_reason = str(opts.reason || "manual").trim().slice(0, 200) || "manual";
    delete fm.known_days;
    delete fm.known_until;
    delete fm.suspended_on;
    delete fm.buried_until;
    return { status: "excluded", on: day, reason: fm.excluded_reason, previous };
  }

  if (next === "suspended") {
    fm.study_status = "suspended";
    fm.suspended_on = day;
    delete fm.known_days;
    delete fm.known_until;
    delete fm.excluded_on;
    delete fm.excluded_reason;
    delete fm.buried_until;
    return { status: "suspended", on: day, previous };
  }

  if (next === "buried") {
    const until = dateKey(opts.until) || fmtDate(addDays(now, 1));
    fm.study_status = "buried";
    fm.buried_until = until;
    delete fm.known_days;
    delete fm.known_until;
    delete fm.excluded_on;
    delete fm.excluded_reason;
    delete fm.suspended_on;
    return { status: "buried", until, on: day, previous };
  }

  delete fm.study_status;
  delete fm.known_days;
  delete fm.known_until;
  delete fm.excluded_on;
  delete fm.excluded_reason;
  delete fm.suspended_on;
  delete fm.buried_until;
  return { status: "active", on: day, previous };
}

function studyStatusSummary(fm, today) {
  const status = statusOf(fm, today);
  if (status === "excluded") {
    const on = dateKey(fm && fm.excluded_on);
    return on ? `Excluded on ${on}` : "Excluded";
  }
  if (status === "suspended") {
    const on = dateKey(fm && fm.suspended_on);
    return on ? `Suspended on ${on}` : "Suspended";
  }
  if (status === "buried") {
    const until = dateKey(fm && fm.buried_until);
    return until ? `Buried until ${until}` : "Buried";
  }
  if (status === "known") {
    const until = dateKey(fm && fm.known_until);
    return until ? `Known until ${until}` : "Known";
  }
  return "";
}

function statusLabel(status) {
  const s = normalizeStatus(status);
  return s === "excluded" ? "Excluded" : s === "suspended" ? "Suspended" : s === "buried" ? "Buried" : s === "known" ? "Known" : "Active";
}

module.exports = {
  DEFAULT_KNOWN_DAYS,
  MAX_KNOWN_DAYS,
  STUDY_STATUSES,
  STATUS_PROPS,
  snapshotStudyStatus,
  restoreStudyStatus,
  normalizeStatus,
  normalizeDays,
  dateKey,
  statusOf,
  isStudyable,
  setStudyStatus,
  studyStatusSummary,
  statusLabel,
};
