"use strict";
/*
 * UTC day arithmetic for date-only study data.
 *
 * A review date, a calendar day and a "due today" answer are all calendar
 * labels, not instants. Using UTC for the label means a clock change or a
 * machine timezone cannot move a review to another day. Display formatting
 * still uses the user's locale, but always with timeZone: "UTC".
 */

const DAY_MS = 86400000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function asDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** The UTC calendar label for an instant. */
function utcDayKey(value) {
  const date = asDate(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The UTC label for "now", which is the canonical due-today key. */
function todayKey(now) {
  return utcDayKey(now);
}

/** Parse YYYY-MM-DD as a UTC midnight. Returns null for an invalid or impossible date. */
function parseDayKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function validDayKey(value) {
  const text = String(value || "").trim();
  return parseDayKey(text) ? text : "";
}

function addUtcDays(key, days) {
  const date = parseDayKey(key);
  if (!date) return String(key || "");
  return utcDayKey(new Date(date.getTime() + Math.round(Number(days) || 0) * DAY_MS));
}

function dayDifference(later, earlier) {
  const a = parseDayKey(later);
  const b = parseDayKey(earlier);
  if (!a || !b) return 0;
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

function weekdayIndex(key) {
  const date = parseDayKey(key);
  return date ? date.getUTCDay() : 0;
}

function startOfUtcWeek(key, weekStartsOn) {
  const day = validDayKey(key);
  if (!day) return "";
  const offset = weekStartsOn === "sunday" ? weekdayIndex(day) : (weekdayIndex(day) + 6) % 7;
  return addUtcDays(day, -offset);
}

function weekdayLabels(weekStartsOn) {
  return weekStartsOn === "sunday" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

/** Locale-aware label for a date-only key, without allowing the local zone to shift it. */
function formatDayLabel(key, options) {
  const date = parseDayKey(key);
  if (!date) return String(key || "");
  const opts = options && typeof options === "object" ? options : {};
  try {
    return new Intl.DateTimeFormat(opts.locale, {
      timeZone: "UTC",
      weekday: opts.weekday || "long",
      month: opts.month || "long",
      day: opts.day || "numeric",
      year: opts.year,
    }).format(date);
  } catch (error) {
    return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  }
}

function monthLabel(year, month) {
  return `${MONTHS[((month % 12) + 12) % 12]} ${year}`;
}

/**
 * A compact month grid in UTC. `month` is 0-based, matching Date. The first
 * and last cells can belong to the adjacent month, as a calendar expects.
 */
function monthCells(year, month, weekStartsOn, now) {
  const y = Math.trunc(Number(year) || 0);
  const m = Math.trunc(Number(month) || 0);
  const first = new Date(Date.UTC(y, m, 1));
  const startOffset = weekStartsOn === "sunday" ? first.getUTCDay() : (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const daysInPrev = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = todayKey(now);
  const cells = [];
  const push = (date, inMonth) => {
    const key = utcDayKey(date);
    cells.push({ key, day: date.getUTCDate(), inMonth, isToday: key === today });
  };
  for (let index = startOffset; index > 0; index--) {
    push(new Date(Date.UTC(y, m - 1, daysInPrev - index + 1)), false);
  }
  for (let day = 1; day <= daysInMonth; day++) push(new Date(Date.UTC(y, m, day)), true);
  let nextDay = 1;
  while (cells.length % 7) push(new Date(Date.UTC(y, m + 1, nextDay++)), false);
  return cells;
}

function dayRange(start, end) {
  const first = validDayKey(start);
  const last = validDayKey(end);
  if (!first || !last || last < first) return [];
  const out = [];
  for (let key = first; key <= last && out.length < 3700; key = addUtcDays(key, 1)) out.push(key);
  return out;
}

module.exports = {
  DAY_MS,
  MONTHS,
  WEEKDAYS,
  addUtcDays,
  dayDifference,
  dayRange,
  formatDayLabel,
  monthCells,
  monthLabel,
  parseDayKey,
  startOfUtcWeek,
  todayKey,
  utcDayKey,
  validDayKey,
  weekdayIndex,
  weekdayLabels,
};
