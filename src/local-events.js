"use strict";
/*
 * Local calendar events: a small, dependency-free event store that is completely
 * separate from imported .ics feeds and read-only Full Calendar notes.
 *
 * Dates are date-only strings (YYYY-MM-DD) and recurrence is expanded with UTC
 * arithmetic, so a clock change never moves an event to another day. Monthly and
 * yearly recurrences are always calculated from the original anchor date: a
 * 31 January event becomes 28/29 February, then returns to 31 March rather than
 * drifting forward one month at a time.
 */
const { hashString, str } = require("./util");

const LOCAL_EVENT_CATEGORIES = [
  { id: "work", label: "Work", color: "#5b8def" },
  { id: "personal", label: "Personal", color: "#d97757" },
  { id: "study", label: "Study", color: "#4f9d69" },
  { id: "meeting", label: "Meeting", color: "#8b6fd6" },
  { id: "health", label: "Health", color: "#d65b8f" },
  { id: "social", label: "Social", color: "#d9a441" },
  { id: "other", label: "Other", color: "#7a8494" },
];

const REPEAT_KINDS = ["none", "daily", "weekly", "monthly", "yearly"];
const WEEK_STARTS = ["monday", "sunday"];
const MAX_EVENTS = 1000;
const MAX_OCCURRENCES = 2000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad(value, length) {
  return String(value).padStart(length || 2, "0");
}

function parseDateKey(value) {
  const match = DATE_RE.exec(str(value).trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function dateKey(date) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function todayKey(now) {
  const date = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDaysKey(key, days) {
  const date = parseDateKey(key);
  if (!date) return key;
  return dateKey(new Date(date.getTime() + Math.round(days) * 86400000));
}

/** Add whole months from an anchor day, clamping 29/30/31 to the target month. */
function addMonthsKey(key, months) {
  const date = parseDateKey(key);
  if (!date) return key;
  const anchorDay = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Math.round(months), 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(anchorDay, last));
  return dateKey(target);
}

/** Add whole years from an anchor date, clamping 29 February to 28 February. */
function addYearsKey(key, years) {
  const date = parseDateKey(key);
  if (!date) return key;
  const anchorMonth = date.getUTCMonth();
  const anchorDay = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear() + Math.round(years), anchorMonth, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), anchorMonth + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(anchorDay, last));
  return dateKey(target);
}

function categoryOf(value) {
  const text = str(value).trim().toLowerCase();
  return LOCAL_EVENT_CATEGORIES.find((item) => item.id === text) || LOCAL_EVENT_CATEGORIES.find((item) => item.id === "other");
}

function normalizeCategory(value) {
  return categoryOf(value).id;
}

function normalizeColor(value, category) {
  const text = str(value).trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : categoryOf(category).color;
}

function normalizeRepeat(value) {
  const text = str(value).trim().toLowerCase();
  return REPEAT_KINDS.includes(text) ? text : "none";
}

function normalizeTime(value) {
  const text = str(value).trim();
  return TIME_RE.test(text) ? text : "";
}

function normalizeEvent(input, now, defaults) {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const fallbackDate = todayKey(now);
  const date = parseDateKey(src.date) ? str(src.date).trim() : fallbackDate;
  const title = str(src.title).trim().slice(0, 200) || "Untitled event";
  const category = normalizeCategory(src.category || (defaults && defaults.defaultCategory));
  const repeat = normalizeRepeat(src.repeat || src.recurrence);
  const repeatEveryRaw = Number(src.repeatEvery ?? src.recurrenceEvery);
  const repeatEvery = Math.min(365, Math.max(1, Math.round(Number.isFinite(repeatEveryRaw) ? repeatEveryRaw : 1)));
  const untilCandidate = str(src.repeatUntil ?? src.until).trim();
  const repeatUntil = parseDateKey(untilCandidate) && untilCandidate >= date ? untilCandidate : "";
  const id = str(src.id).trim().slice(0, 120) || `le-${hashString(`${title}|${date}|${category}|${repeat}`)}`;
  return {
    id,
    title,
    date,
    endDate: parseDateKey(src.endDate) && str(src.endDate).trim() >= date ? str(src.endDate).trim() : "",
    startTime: normalizeTime(src.startTime),
    endTime: normalizeTime(src.endTime),
    category,
    color: normalizeColor(src.color, category),
    notes: str(src.notes).slice(0, 2000),
    repeat,
    repeatEvery,
    repeatUntil,
    createdAt: Number(src.createdAt) || Number(now) || Date.now(),
    updatedAt: Number(src.updatedAt) || Number(now) || Date.now(),
  };
}

function normalizeLocalEventsSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const events = (Array.isArray(src.events) ? src.events : [])
    .map((event) => normalizeEvent(event, Date.now(), src))
    .slice(0, MAX_EVENTS);
  const seen = new Set();
  const unique = [];
  for (const event of events) {
    let id = event.id;
    let n = 2;
    while (seen.has(id)) id = `${event.id}-${n++}`;
    seen.add(id);
    unique.push({ ...event, id });
  }
  return {
    enabled: src.enabled !== false,
    defaultCategory: normalizeCategory(src.defaultCategory || "study"),
    weekStartsOn: WEEK_STARTS.includes(str(src.weekStartsOn).toLowerCase()) ? str(src.weekStartsOn).toLowerCase() : "monday",
    events: unique,
  };
}

/** Every occurrence of one event between two inclusive date keys. */
function expandRecurrence(event, rangeStart, rangeEnd) {
  const clean = normalizeEvent(event, Date.now());
  const start = parseDateKey(rangeStart) ? rangeStart : clean.date;
  const end = parseDateKey(rangeEnd) ? rangeEnd : clean.date;
  if (end < start) return [];
  const out = [];
  const push = (key) => {
    if (key < clean.date) return;
    if (clean.repeatUntil && key > clean.repeatUntil) return false;
    if (key >= start && key <= end) out.push(key);
    if (out.length >= MAX_OCCURRENCES) return false;
    return true;
  };

  if (clean.repeat === "none") {
    if (clean.date >= start && clean.date <= end) out.push(clean.date);
    return out;
  }

  for (let index = 0; index < MAX_OCCURRENCES; index++) {
    let key;
    if (clean.repeat === "daily") key = addDaysKey(clean.date, index * clean.repeatEvery);
    else if (clean.repeat === "weekly") key = addDaysKey(clean.date, index * 7 * clean.repeatEvery);
    else if (clean.repeat === "monthly") key = addMonthsKey(clean.date, index * clean.repeatEvery);
    else key = addYearsKey(clean.date, index * clean.repeatEvery);
    if (key > end) break;
    if (push(key) === false) break;
  }
  return out;
}

function eventsOnDate(events, key) {
  const out = [];
  for (const event of Array.isArray(events) ? events : []) {
    if (expandRecurrence(event, key, key).length) out.push(event);
  }
  return out.sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99") || a.title.localeCompare(b.title));
}

function eventsInRange(events, rangeStart, rangeEnd) {
  const rows = [];
  for (const event of Array.isArray(events) ? events : []) {
    for (const key of expandRecurrence(event, rangeStart, rangeEnd)) rows.push({ key, event });
  }
  return rows.sort((a, b) => a.key.localeCompare(b.key) || (a.event.startTime || "99:99").localeCompare(b.event.startTime || "99:99"));
}

function upsertLocalEvent(value, input, now) {
  const settings = normalizeLocalEventsSettings(value);
  const event = normalizeEvent(input, now, settings);
  const existing = settings.events.findIndex((item) => item.id === event.id);
  const events = settings.events.slice();
  if (existing >= 0) events[existing] = { ...event, createdAt: events[existing].createdAt || event.createdAt, updatedAt: Number(now) || Date.now() };
  else events.unshift(event);
  return { settings: { ...settings, events: events.slice(0, MAX_EVENTS) }, event };
}

function removeLocalEvent(value, id) {
  const settings = normalizeLocalEventsSettings(value);
  const events = settings.events.filter((event) => event.id !== id);
  return { settings: { ...settings, events }, removed: events.length !== settings.events.length };
}

function monthCells(year, month, weekStartsOn, now) {
  const first = new Date(year, month, 1);
  const startOffset = weekStartsOn === "sunday" ? first.getDay() : (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells = [];
  const push = (date, inMonth) => cells.push({ key: dateKey(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))), day: date.getDate(), inMonth });
  for (let i = startOffset; i > 0; i--) push(new Date(year, month - 1, daysInPrev - i + 1), false);
  for (let day = 1; day <= daysInMonth; day++) push(new Date(year, month, day), true);
  while (cells.length % 7) push(new Date(year, month + 1, cells.length - startOffset - daysInMonth + 1), false);
  return cells.map((cell) => ({ ...cell, isToday: cell.key === todayKey(now) }));
}

module.exports = {
  LOCAL_EVENT_CATEGORIES,
  MAX_EVENTS,
  REPEAT_KINDS,
  WEEK_STARTS,
  addDaysKey,
  addMonthsKey,
  addYearsKey,
  dateKey,
  eventsInRange,
  eventsOnDate,
  expandRecurrence,
  monthCells,
  normalizeCategory,
  normalizeEvent,
  normalizeLocalEventsSettings,
  removeLocalEvent,
  todayKey,
  upsertLocalEvent,
};
