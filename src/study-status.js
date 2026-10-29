"use strict";
/*
 * Known and Exclude are note-level study controls, not scheduler state.
 *
 * - known: hide the item for a number of days, then it returns as due.
 * - excluded: keep the note but remove it from every practice queue.
 *
 * The properties are intentionally readable and Dataview-friendly:
 *   study_status: active | known | excluded
 *   known_until: YYYY-MM-DD
 *   known_days: number
 *   excluded_on: YYYY-MM-DD
 *   excluded_reason: short text
 */
const { addDays, fmtDate, localDate, str } = require("./util");

const DEFAULT_KNOWN_DAYS = 14;
const MAX_KNOWN_DAYS = 3650;
const STUDY_STATUSES = ["active", "known", "excluded"];
const STATUS_PROPS = ["study_status", "known_days", "known_until", "excluded_on", "excluded_reason"];

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
  return s === "known" || s === "excluded" ? s : "active";
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
  if (raw === "excluded") return "excluded";
  if (raw === "known") {
    const until = dateKey(fm && fm.known_until);
    const day = dateKey(today) || localDate();
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
    return { status: "known", days, until, on: day, previous };
  }

  if (next === "excluded") {
    fm.study_status = "excluded";
    fm.excluded_on = day;
    fm.excluded_reason = str(opts.reason || "manual").trim().slice(0, 200) || "manual";
    delete fm.known_days;
    delete fm.known_until;
    return { status: "excluded", on: day, reason: fm.excluded_reason, previous };
  }

  delete fm.study_status;
  delete fm.known_days;
  delete fm.known_until;
  delete fm.excluded_on;
  delete fm.excluded_reason;
  return { status: "active", on: day, previous };
}

function studyStatusSummary(fm, today) {
  const status = statusOf(fm, today);
  if (status === "excluded") {
    const on = dateKey(fm && fm.excluded_on);
    return on ? `Excluded on ${on}` : "Excluded";
  }
  if (status === "known") {
    const until = dateKey(fm && fm.known_until);
    return until ? `Known until ${until}` : "Known";
  }
  return "";
}

function statusLabel(status) {
  const s = normalizeStatus(status);
  return s === "excluded" ? "Excluded" : s === "known" ? "Known" : "Active";
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
