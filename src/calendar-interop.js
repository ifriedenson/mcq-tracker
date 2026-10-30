"use strict";
/*
 * Read-only interop with Full Calendar's local event notes.
 *
 * Full Calendar stores local events as frontmatter on ordinary notes:
 * `title`, `date`, optional `endDate`, `allDay`, `startTime`, `endTime`,
 * plus `type: recurring` or `type: rrule` for repeated events. We read that
 * documented shape without copying upstream code, so a learner can keep using
 * both plugins without moving their calendar. Notes are never written here.
 */
const { dateKey, expandIcs, parseDateKey } = require("./calendar-ics");
const { normalizeFolder } = require("./calendar-model");

const FC_DAYS = { U: "SU", M: "MO", T: "TU", W: "WE", R: "TH", F: "FR", S: "SA" };
const DEFAULT_MINUTES = 90;

const text = (value) => (value === undefined || value === null ? "" : String(value)).trim();

/** A strict local date, or null when the value is not a real YYYY-MM-DD day. */
function noteDate(value) {
  const key = text(value);
  const date = parseDateKey(key);
  return date && dateKey(date) === key ? date : null;
}

/** Full Calendar accepts `HH:mm`, `H:mm` and 12-hour forms such as `9:05 PM`. */
function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?\.?m?\.?$/i.exec(text(value));
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = String(match[3] || "").toLowerCase();
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null;
  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    if (hours === 12) hours = 0;
    if (suffix === "p") hours += 12;
  }
  if (hours > 23) return null;
  return { hours, minutes };
}

function atTime(day, clock) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), clock.hours, clock.minutes, 0, 0);
}

function endOfDay(day) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
}

function fallbackTitle(file) {
  const base = text(file && file.basename).replace(/\.md$/i, "");
  return base.replace(/^\d{4}-\d{2}-\d{2}\s+/, "").trim() || base;
}

function timedSpan(day, startClock, endClock, endDate) {
  const start = atTime(day, startClock);
  let end;
  if (endClock) {
    end = atTime(endDate || day, endClock);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  } else if (endDate) {
    end = endOfDay(endDate);
  } else {
    end = new Date(start.getTime() + DEFAULT_MINUTES * 60 * 1000);
  }
  return { start, end };
}

/**
 * Converts one Full Calendar event note's frontmatter into the common event
 * shape used by `expandIcs`. Returns null for notes that do not carry an event
 * marker, so an unrelated note with a `date` property stays out of the calendar.
 */
function eventFromNote(frontmatter, file) {
  const fm = frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter) ? frontmatter : null;
  if (!fm || !file || !text(file.path)) return null;
  const type = text(fm.type).toLowerCase() || "single";
  if (!["single", "recurring", "rrule"].includes(type)) return null;

  const title = text(fm.title) || fallbackTitle(file);
  const startClock = parseClock(fm.startTime);
  const endClock = parseClock(fm.endTime);
  const allDay = fm.allDay === true;
  if (!allDay && !startClock) return null;

  const base = {
    uid: `full-calendar:${file.path}`,
    summary: title,
    description: text(fm.description),
    location: text(fm.location),
    allDay,
    sourcePath: file.path,
  };

  if (type === "single") {
    const day = noteDate(fm.date);
    if (!day) return null;
    const endDay = noteDate(fm.endDate);
    if (endDay && endDay <= day) return null;
    if (allDay) {
      base.dtstart = day;
      base.dtend = endDay ? new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate()) : new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    } else {
      const span = timedSpan(day, startClock || { hours: 0, minutes: 0 }, endClock, endDay);
      base.dtstart = span.start;
      base.dtend = span.end;
    }
    return base;
  }

  if (type === "recurring") {
    const startDay = noteDate(fm.startRecur);
    const days = (Array.isArray(fm.daysOfWeek) ? fm.daysOfWeek : []).map((day) => FC_DAYS[text(day).toUpperCase()]).filter(Boolean);
    if (!startDay || !days.length) return null;
    const endDay = noteDate(fm.endRecur);
    base.dtstart = allDay ? startDay : atTime(startDay, startClock || { hours: 0, minutes: 0 });
    base.dtend = allDay
      ? new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + 1)
      : timedSpan(startDay, startClock || { hours: 0, minutes: 0 }, endClock).end;
    base.rrule = `FREQ=WEEKLY;BYDAY=${[...new Set(days)].join(",")}`;
    if (endDay) base.rrule += `;UNTIL=${endDay.getFullYear()}${String(endDay.getMonth() + 1).padStart(2, "0")}${String(endDay.getDate()).padStart(2, "0")}T235959`;
    return base;
  }

  const startDay = noteDate(fm.startDate);
  const rule = text(fm.rrule);
  if (!startDay || !rule) return null;
  base.dtstart = allDay ? startDay : atTime(startDay, startClock || { hours: 0, minutes: 0 });
  base.dtend = allDay
    ? new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + 1)
    : timedSpan(startDay, startClock || { hours: 0, minutes: 0 }, endClock).end;
  base.rrule = rule;
  base.exdates = (Array.isArray(fm.skipDates) ? fm.skipDates : []).map(noteDate).filter(Boolean);
  return base;
}

/**
 * Reads the chosen folder and returns expanded events inside the calendar
 * window. The signature includes every note's frontmatter so the calendar
 * cache notices edits, additions and deletions without a vault-wide scan.
 */
function fullCalendarNotes(app, folder, range) {
  const root = normalizeFolder(folder);
  if (!root) return { events: [], signature: "" };
  const start = range && range.start instanceof Date ? range.start : new Date(0);
  const end = range && range.end instanceof Date ? range.end : new Date(2100, 0, 1);
  const files = typeof app.vault.getMarkdownFiles === "function" ? app.vault.getMarkdownFiles() : [];
  let signature = `full-calendar:${root}`;
  const bases = [];
  for (const file of files || []) {
    if (!file || !text(file.path).startsWith(`${root}/`)) continue;
    const fm = app.metadataCache && typeof app.metadataCache.getFileCache === "function" ? app.metadataCache.getFileCache(file)?.frontmatter : null;
    if (!fm) continue;
    signature += `|${file.path}:${JSON.stringify(fm)}`;
    const event = eventFromNote(fm, file);
    if (event) bases.push(event);
  }
  const events = expandIcs(bases, start, end).map((event) =>
    Object.assign(event, { sourceId: "full-calendar-notes", sourceName: "Full Calendar notes", foreign: true })
  );
  return { events, signature };
}

module.exports = { eventFromNote, fullCalendarNotes, parseClock };
