"use strict";
/*
 * Grader accuracy: how often the rating a learner kept matched the AI or local
 * grader's suggestion. A card note stores only its latest grade, so each card
 * contributes one event here; this is a current summary, not a review log.
 */
const { addDays, fmtDate, str } = require("./util");

const DEFAULT_WEEKS = 8;
const MIN_WEEKS = 1;
const MAX_WEEKS = 26;

function dayOf(value) {
  const text = str(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const d = new Date(`${text}T12:00:00`);
  if (Number.isNaN(d.getTime()) || fmtDate(d) !== text) return "";
  return text;
}

function mondayOf(day) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return fmtDate(d);
}

function weekIndex(day, start) {
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${day}T12:00:00`);
  return Math.floor((b.getTime() - a.getTime()) / (7 * 86400000));
}

function rate(part, whole) {
  return whole ? part / whole : null;
}

/** Self-grades win over a stale grader label, matching what notes.js writes. */
function graderOf(fm) {
  const by = str(fm && fm.graded_by).trim().toLowerCase();
  const status = str(fm && fm.grade_status).trim().toLowerCase();
  if (by === "self" || status === "self") return "self";
  if (by === "ai" || by === "deterministic") return by;
  return "";
}

function buildGraderAccuracy(cards, options) {
  const opts = options || {};
  const count = Math.max(
    MIN_WEEKS,
    Math.min(MAX_WEEKS, Math.round(Number(opts.weeks) || DEFAULT_WEEKS))
  );
  const today = dayOf(opts.today) || fmtDate(new Date());
  const start = addDays(new Date(`${mondayOf(today)}T12:00:00`), -7 * (count - 1));
  const weeks = Array.from({ length: count }, (_value, index) => ({
    start: fmtDate(addDays(start, index * 7)),
    ai: 0,
    local: 0,
    self: 0,
    graded: 0,
    overrides: 0,
    agreements: 0,
    agreement: null,
  }));
  const totals = {
    events: 0,
    ai: 0,
    local: 0,
    self: 0,
    graded: 0,
    overrides: 0,
    agreements: 0,
    agreement: null,
    aiAgreements: 0,
    aiAgreement: null,
    localAgreements: 0,
    localAgreement: null,
    undated: 0,
    outside: 0,
  };

  for (const raw of Array.isArray(cards) ? cards : []) {
    const fm = raw && raw.fm ? raw.fm : raw;
    const grader = graderOf(fm);
    if (!grader) continue;
    const key = grader === "deterministic" ? "local" : grader;
    const override = fm.verdict_override === true;
    totals.events += 1;
    totals[key] += 1;
    if (key === "self") {
      // No grader suggestion existed to agree or disagree with.
    } else {
      totals.graded += 1;
      if (override) totals.overrides += 1;
      else {
        totals.agreements += 1;
        if (key === "ai") totals.aiAgreements += 1;
        else totals.localAgreements += 1;
      }
    }

    const day = dayOf(fm.graded_on);
    if (!day) {
      totals.undated += 1;
      continue;
    }
    if (day > today) {
      totals.outside += 1;
      continue;
    }
    const index = weekIndex(day, weeks[0].start);
    if (index < 0 || index >= weeks.length) {
      totals.outside += 1;
      continue;
    }
    const week = weeks[index];
    week[key] += 1;
    if (key === "self") continue;
    week.graded += 1;
    if (override) week.overrides += 1;
    else week.agreements += 1;
  }

  for (const week of weeks) week.agreement = rate(week.agreements, week.graded);
  totals.agreement = rate(totals.agreements, totals.graded);
  totals.aiAgreement = rate(totals.aiAgreements, totals.ai);
  totals.localAgreement = rate(totals.localAgreements, totals.local);

  return {
    weeks,
    totals,
    start: weeks[0].start,
    end: weeks[weeks.length - 1].start,
    today,
    latestOnly: true,
    windowWeeks: count,
  };
}

module.exports = { buildGraderAccuracy };
