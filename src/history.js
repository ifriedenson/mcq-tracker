"use strict";
/*
 * Review history rows are append-only:
 *   when|result|seconds|answer|confidence|error_type|attempt_id|variant
 *
 * Older rows stop at error_type; the variant field is optional. The attempt id
 * is what makes a retry or a sync merge safe: the same row cannot be counted
 * twice, while two devices can contribute different rows for the same note.
 */
const { fmtDate, str } = require("./util");

const VALID_RESULTS = new Set(["correct", "incorrect"]);
const NEEDS_FIXING_DAYS = 5;

function splitRow(line) {
  return str(line).split("|");
}

function attemptIdOf(line) {
  return str(splitRow(line)[6]).trim();
}

function hasAttemptId(list, id) {
  const wanted = str(id).trim();
  if (!wanted) return false;
  return (Array.isArray(list) ? list : []).some((line) => attemptIdOf(line) === wanted);
}

/** Append one row unless its attempt id is already present. */
function appendHistory(list, line, id) {
  const out = Array.isArray(list) ? list.slice() : [];
  const wanted = str(id).trim();
  if (wanted && hasAttemptId(out, wanted)) return out;
  out.push(str(line));
  return out;
}

/**
 * Union several histories. Attempt ids are the identity; legacy rows without
 * one are identified by their full text. Sorting by the ISO timestamp keeps a
 * phone and desktop merge in chronological order without dropping either side.
 */
function mergeHistory(...lists) {
  const seen = new Set();
  const rows = [];
  for (const list of lists) {
    for (const line of Array.isArray(list) ? list : []) {
      const text = str(line);
      if (!text) continue;
      const identity = attemptIdOf(text) || text;
      if (seen.has(identity)) continue;
      seen.add(identity);
      rows.push(text);
    }
  }
  return rows.sort((a, b) => {
    const whenA = str(splitRow(a)[0]);
    const whenB = str(splitRow(b)[0]);
    return whenA.localeCompare(whenB);
  });
}

/** Update the error tag on one attempt, preserving its id, or on the latest row. */
function setAttemptErrorType(list, id, type) {
  const rows = Array.isArray(list) ? list.slice() : [];
  const wanted = str(id).trim();
  let index = -1;
  if (wanted) {
    for (let i = rows.length - 1; i >= 0; i--) {
      if (attemptIdOf(rows[i]) === wanted) {
        index = i;
        break;
      }
    }
  }
  if (index < 0 && !wanted && rows.length) index = rows.length - 1;
  if (index < 0) return rows;
  const parts = splitRow(rows[index]);
  while (parts.length < 6) parts.push("");
  parts[5] = str(type);
  rows[index] = parts.join("|");
  return rows;
}

/** A valid calendar-day key from a history timestamp or property. */
function dayKey(value) {
  const key = str(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

/** Distinct days with a miss, optionally only after the last Mark fixed date. */
function needsFixingMissDays(fm, since) {
  if (!fm || typeof fm !== "object") return 0;
  const after = dayKey(since);
  const days = new Set();
  for (const line of Array.isArray(fm.history) ? fm.history : []) {
    const row = rowData(line);
    if (row.result !== "incorrect") continue;
    const day = dayKey(row.when);
    if (!day || (after && day <= after)) continue;
    days.add(day);
  }
  return days.size;
}

/** Repair malformed flag properties so they cannot keep an item stuck. */
function normalizeNeedsFixing(fm) {
  if (!fm || typeof fm !== "object") return false;
  let changed = false;
  if (fm.needs_fixing !== undefined && fm.needs_fixing !== true) {
    delete fm.needs_fixing;
    changed = true;
  }
  if (fm.needs_fixing === true) {
    if (fm.needs_fixing_since !== undefined && !dayKey(fm.needs_fixing_since)) {
      delete fm.needs_fixing_since;
      changed = true;
    }
    const count = Number(fm.needs_fixing_miss_days);
    if (fm.needs_fixing_miss_days !== undefined && (!Number.isFinite(count) || count < 1)) {
      delete fm.needs_fixing_miss_days;
      changed = true;
    }
  } else {
    if (fm.needs_fixing_since !== undefined) {
      delete fm.needs_fixing_since;
      changed = true;
    }
    if (fm.needs_fixing_miss_days !== undefined) {
      delete fm.needs_fixing_miss_days;
      changed = true;
    }
  }
  if (fm.needs_fixing_fixed_on !== undefined) {
    const fixed = dayKey(fm.needs_fixing_fixed_on);
    if (!fixed) {
      delete fm.needs_fixing_fixed_on;
      changed = true;
    } else if (str(fm.needs_fixing_fixed_on) !== fixed) {
      fm.needs_fixing_fixed_on = fixed;
      changed = true;
    }
  }
  return changed;
}

function needsFixingStatus(fm) {
  const fixedOn = fm && typeof fm === "object" ? dayKey(fm.needs_fixing_fixed_on) : "";
  return {
    flagged: !!(fm && typeof fm === "object" && fm.needs_fixing === true),
    missDays: needsFixingMissDays(fm, fixedOn),
    fixedOn,
  };
}

/** Flag once the history has misses on enough distinct days. Returns the new flag, if raised. */
function applyNeedsFixing(fm, now, threshold) {
  if (!fm || typeof fm !== "object") return null;
  const limit = Math.max(0, Math.round(Number(threshold) || 0));
  if (!limit) return null;
  normalizeNeedsFixing(fm);
  const state = needsFixingStatus(fm);
  if (state.flagged) {
    if (Number(fm.needs_fixing_miss_days) !== state.missDays) fm.needs_fixing_miss_days = state.missDays;
    return null;
  }
  if (state.missDays < limit) return null;
  fm.needs_fixing = true;
  fm.needs_fixing_since = fmtDate(now);
  fm.needs_fixing_miss_days = state.missDays;
  return { flagged: true, missDays: state.missDays, threshold: limit, since: fm.needs_fixing_since };
}

/** Clear the flag without touching attempts or history; new misses are counted after this date. */
function markNeedsFixingFixed(fm, now) {
  if (!fm || typeof fm !== "object") return { wasFlagged: false, fixedOn: "" };
  const wasFlagged = fm.needs_fixing === true;
  delete fm.needs_fixing;
  delete fm.needs_fixing_since;
  delete fm.needs_fixing_miss_days;
  if (wasFlagged) fm.needs_fixing_fixed_on = fmtDate(now);
  return { wasFlagged, fixedOn: wasFlagged ? fm.needs_fixing_fixed_on : "" };
}

function rowData(line) {
  const p = splitRow(line);
  return {
    when: str(p[0]),
    result: str(p[1]),
    seconds: Math.max(0, Number(p[2]) || 0),
    answer: str(p[3]),
    conf: str(p[4]),
    error: str(p[5]).trim(),
    id: str(p[6]).trim(),
  };
}

/**
 * Recompute the counters that can be derived without guessing a scheduler:
 * attempts, correct count, total time and the latest-attempt fields. Scheduling
 * and streak are left alone because they depend on the review policy used.
 */
function repairHistoryCounters(fm) {
  if (!fm || typeof fm !== "object") return { changed: false, attempts: 0 };
  const rows = (Array.isArray(fm.history) ? fm.history : []).map(rowData).filter((row) => VALID_RESULTS.has(row.result));
  if (!rows.length) return { changed: false, attempts: 0 };
  const attempts = rows.length;
  const correct = rows.filter((row) => row.result === "correct").length;
  const seconds = rows.reduce((sum, row) => sum + row.seconds, 0);
  const first = rows.reduce((a, row) => (row.when < a ? row.when : a), rows[0].when);
  const last = rows.reduce((a, row) => (row.when > a ? row.when : a), rows[0].when);
  const ordered = rows.slice().sort((a, b) => a.when.localeCompare(b.when));
  const latest = ordered[ordered.length - 1];
  // Replay the same streak rule the normal review path uses. Hard reviews
  // (confidence 1) keep the current streak; every other correct review adds one.
  let streak = 0;
  for (const row of ordered) {
    if (row.result === "incorrect") streak = 0;
    else if (row.conf !== "1") streak++;
  }
  const before = {
    attempts: Number(fm.attempts) || 0,
    correct: Number(fm.correct_count) || 0,
    seconds: Number(fm.time_spent_total) || 0,
    streak: Number(fm.streak) || 0,
    first: str(fm.first_attempted),
    last: str(fm["date attempted"]),
    result: str(fm.result),
    answer: str(fm.last_answer),
    confidence: str(fm.last_confidence),
    error: str(fm.last_error_type),
  };
  fm.attempts = attempts;
  fm.correct_count = correct;
  fm.time_spent_total = seconds;
  fm.streak = streak;
  if (first) fm.first_attempted = first;
  if (last) fm["date attempted"] = last;
  fm.result = latest.result;
  fm.last_answer = latest.answer;
  fm.last_confidence = latest.conf;
  fm.last_error_type = latest.error;
  const after = {
    attempts,
    correct,
    seconds,
    streak,
    first: str(fm.first_attempted),
    last: str(fm["date attempted"]),
    result: fm.result,
    answer: fm.last_answer,
    confidence: fm.last_confidence,
    error: fm.last_error_type,
  };
  const changed = Object.keys(after).some((key) => before[key] !== after[key]);
  return { changed, attempts };
}

module.exports = {
  NEEDS_FIXING_DAYS,
  VALID_RESULTS,
  applyNeedsFixing,
  dayKey,
  markNeedsFixingFixed,
  needsFixingMissDays,
  needsFixingStatus,
  normalizeNeedsFixing,
  appendHistory,
  attemptIdOf,
  hasAttemptId,
  mergeHistory,
  repairHistoryCounters,
  rowData,
  setAttemptErrorType,
  splitRow,
};
