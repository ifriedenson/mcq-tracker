"use strict";
/*
 * Pure view model for the review sidebar. It joins the due-note queue to the
 * forecast buckets, applies the user's sort/filter, and calculates the
 * additive or replacement time target. No Obsidian API and no writes.
 */
const str = (value) => (value === undefined || value === null ? "" : String(value));
const { addUtcDays, dayDifference, todayKey, validDayKey } = require("./utc-dates");

const SORTS = ["due", "title", "time", "priority"];
const FILTERS = ["all", "due", "upcoming", "overdue"];

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeReviewSidebarSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: src.enabled !== false,
    sort: SORTS.includes(src.sort) ? src.sort : "due",
    filter: FILTERS.includes(src.filter) ? src.filter : "all",
    upcomingDays: Math.round(clampNumber(src.upcomingDays, 1, 90, 14)),
    showEstimates: src.showEstimates !== false,
    showPomodoro: src.showPomodoro !== false,
    overrideHours: Math.round(clampNumber(src.overrideHours, 0, 24, 0)),
    overrideMinutes: Math.round(clampNumber(src.overrideMinutes, 0, 59, 0)),
    overrideMode: src.overrideMode === "replace" ? "replace" : "add",
    weekStartsOn: src.weekStartsOn === "sunday" ? "sunday" : "monday",
  };
}

function overrideMinutes(settings) {
  const config = normalizeReviewSidebarSettings(settings);
  return config.overrideHours * 60 + config.overrideMinutes;
}

/** The time target shown beside the due list. */
function timeTarget(baseMinutes, settings) {
  const override = overrideMinutes(settings);
  const base = Math.max(0, Number(baseMinutes) || 0);
  if (normalizeReviewSidebarSettings(settings).overrideMode === "replace") {
    return Math.round(override * 10) / 10;
  }
  return Math.round((base + override) * 10) / 10;
}

function rowFromNote(note, today) {
  const due = validDayKey(note.due || note.date) || today;
  const isNew = note.isNew === true;
  const overdue = !isNew && due < today;
  return {
    path: str(note.path),
    title: str(note.title) || str(note.path).split("/").pop().replace(/\.md$/i, ""),
    set: str(note.set),
    kind: note.kind === "card" ? "card" : "note",
    deck: str(note.deck),
    due,
    status: overdue ? "overdue" : due <= today ? "due" : "upcoming",
    isNew,
    priority: str(note.priority) || "normal",
    minutes: Math.max(0, Number(note.minutes) || 0),
    days: dayDifference(due, today),
  };
}

/**
 * Build the sidebar groups. `snapshot` is reviewCalendarSnapshot(), `queue`
 * is getNoteQueue(), and both are read-only inputs.
 */
function buildReviewSidebar(snapshot, queue, options) {
  const opts = options && typeof options === "object" ? options : {};
  const settings = normalizeReviewSidebarSettings(opts.settings);
  const today = validDayKey(opts.today) || validDayKey(snapshot && snapshot.today) || todayKey();
  const byPath = new Map();
  for (const note of (snapshot && Array.isArray(snapshot.notes) ? snapshot.notes : [])) {
    if (!note || !note.path) continue;
    byPath.set(str(note.path), rowFromNote(note, today));
  }
  for (const row of (queue && Array.isArray(queue.all) ? queue.all : [])) {
    const existing = byPath.get(row.path);
    const next = rowFromNote(
      {
        path: row.path,
        title: row.title,
        set: row.set,
        due: row.dueDate || today,
        isNew: row.isNew,
        priority: row.priority,
        minutes: existing ? existing.minutes : (opts.noteMinutes === undefined ? 2 : opts.noteMinutes),
      },
      today
    );
    byPath.set(str(row.path), { ...existing, ...next });
  }

  let rows = [...byPath.values()].filter((row) => row.path);
  if (settings.filter === "due") rows = rows.filter((row) => row.status === "due");
  else if (settings.filter === "overdue") rows = rows.filter((row) => row.status === "overdue");
  else if (settings.filter === "upcoming") {
    const limit = addUtcDays(today, settings.upcomingDays);
    rows = rows.filter((row) => row.status === "upcoming" && row.due <= limit);
  } else {
    const limit = addUtcDays(today, settings.upcomingDays);
    rows = rows.filter((row) => row.status !== "upcoming" || row.due <= limit);
  }

  const priorityRank = { high: 0, normal: 1, low: 2 };
  rows.sort((a, b) => {
    if (settings.sort === "title") return a.title.localeCompare(b.title);
    if (settings.sort === "time") return b.minutes - a.minutes || a.title.localeCompare(b.title);
    if (settings.sort === "priority") {
      return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || a.due.localeCompare(b.due);
    }
    return a.due.localeCompare(b.due) || (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || a.title.localeCompare(b.title);
  });

  const groups = [];
  const index = new Map();
  for (const row of rows) {
    const label = row.status === "overdue" ? "Overdue" : row.status === "due" ? "Today" : row.due;
    if (!index.has(label)) {
      index.set(label, { label, date: row.due, rows: [], minutes: 0 });
      groups.push(index.get(label));
    }
    const group = index.get(label);
    group.rows.push(row);
    group.minutes += row.minutes;
  }
  const totalMinutes = Math.round(rows.reduce((sum, row) => sum + row.minutes, 0) * 10) / 10;
  return {
    today,
    settings,
    rows,
    groups,
    counts: {
      due: rows.filter((row) => row.status === "due").length,
      overdue: rows.filter((row) => row.status === "overdue").length,
      upcoming: rows.filter((row) => row.status === "upcoming").length,
      total: rows.length,
    },
    minutes: totalMinutes,
    targetMinutes: timeTarget(totalMinutes, settings),
    overrideMinutes: overrideMinutes(settings),
  };
}

function adjacentPath(rows, currentPath, direction) {
  const list = Array.isArray(rows) ? rows.filter((row) => row && row.path) : [];
  if (!list.length) return "";
  const index = list.findIndex((row) => row.path === currentPath);
  if (index < 0) return direction === "previous" ? list[list.length - 1].path : list[0].path;
  const delta = direction === "previous" ? -1 : 1;
  return list[(index + delta + list.length) % list.length].path;
}

function workloadLabel(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  if (!value) return "no work";
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const rest = Math.round(value - hours * 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

module.exports = {
  FILTERS,
  SORTS,
  adjacentPath,
  buildReviewSidebar,
  normalizeReviewSidebarSettings,
  overrideMinutes,
  timeTarget,
  workloadLabel,
};
