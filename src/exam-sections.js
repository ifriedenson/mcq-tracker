"use strict";
/*
 * Timed-test sections and saved blueprints. Sections are sequential modules
 * with their own count and timer; the question order stays in the picked pool.
 */
const { str } = require("./util");

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** 0 means no pass mark; anything else is a whole percentage from 1 to 100. */
function normalizePassScore(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

/** Fit section counts/minutes to the requested totals without dropping the blueprint's shape. */
function normalizeSections(raw, totalCount, totalMinutes) {
  const count = clampInt(totalCount, 1, 200, 10);
  const minutes = clampInt(totalMinutes, 1, 300, 12);
  let list = (Array.isArray(raw) ? raw : [])
    .filter((s) => s && typeof s === "object")
    .map((s, i) => ({
      name: str(s.name).trim().slice(0, 60) || `Section ${i + 1}`,
      count: clampInt(s.count, 1, 200, 1),
      minutes: clampInt(s.minutes, 1, 300, 1),
    }));
  if (!list.length) list = [{ name: "Section 1", count, minutes }];
  while (list.length > count) list.pop();
  if (!list.length) list = [{ name: "Section 1", count, minutes }];

  let sum = list.reduce((n, s) => n + s.count, 0);
  if (sum > count) {
    let excess = sum - count;
    for (let i = list.length - 1; i >= 0 && excess > 0; i--) {
      const take = Math.min(list[i].count - 1, excess);
      list[i].count -= take;
      excess -= take;
    }
    list = list.filter((s) => s.count > 0);
  } else if (sum < count) {
    list[list.length - 1].count += count - sum;
  }

  let mins = list.reduce((n, s) => n + s.minutes, 0);
  if (mins < minutes) {
    list[list.length - 1].minutes += minutes - mins;
  } else if (mins > minutes) {
    let excess = mins - minutes;
    for (let i = list.length - 1; i >= 0 && excess > 0; i--) {
      const take = Math.min(list[i].minutes - 1, excess);
      list[i].minutes -= take;
      excess -= take;
    }
  }
  return list;
}

/** Attach section indexes to items and compute each section's bounds and absolute end time. */
function buildSections(items, specs, startedAt) {
  const list = Array.isArray(items) ? items : [];
  const raw = Array.isArray(specs) ? specs : [];
  const totalMinutes = raw.reduce((sum, section) => sum + clampInt(section && section.minutes, 1, 300, 1), 0) || 1;
  const clean = normalizeSections(raw, list.length || 1, totalMinutes);
  const out = [];
  let cursor = 0;
  for (const spec of clean) {
    if (cursor >= list.length) break;
    const take = Math.min(spec.count, list.length - cursor);
    if (take <= 0) continue;
    const start = cursor;
    cursor += take;
    const index = out.length;
    out.push({ name: spec.name, count: take, minutes: spec.minutes, start, end: cursor });
    for (let i = start; i < cursor; i++) list[i].section = index;
  }
  if (!out.length) return out;
  if (cursor < list.length) {
    const last = out[out.length - 1];
    for (let i = cursor; i < list.length; i++) list[i].section = out.length - 1;
    last.count = list.length - last.start;
    last.end = list.length;
  }
  let elapsed = 0;
  for (const section of out) {
    elapsed += section.minutes;
    section.endAt = startedAt + elapsed * 60000;
  }
  return out;
}

function sectionAt(sections, index) {
  const list = Array.isArray(sections) ? sections : [];
  const i = Math.max(0, Math.floor(Number(index) || 0));
  for (let s = 0; s < list.length; s++) {
    if (i >= list[s].start && i < list[s].end) return s;
  }
  return list.length ? list.length - 1 : -1;
}

/** Read a saved blueprint defensively; unknown fields are ignored. */
function normalizeBlueprint(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = str(raw.name).trim().slice(0, 80);
  if (!name) return null;
  const count = clampInt(raw.count, 1, 200, 10);
  const minutes = clampInt(raw.minutes, 1, 300, 12);
  return {
    name,
    count,
    minutes,
    from: Math.max(1, Math.round(Number(raw.from) || 1)),
    to: Math.max(0, Math.round(Number(raw.to) || 0)),
    mode: str(raw.mode).trim() || "random",
    frq: clampInt(raw.frq, 0, 20, 0),
    shuffleChoices: !!raw.shuffleChoices,
    passScore: normalizePassScore(raw.passScore),
    sections: normalizeSections(raw.sections, count, minutes),
  };
}

module.exports = {
  buildSections,
  clampInt,
  normalizeBlueprint,
  normalizePassScore,
  normalizeSections,
  sectionAt,
};
