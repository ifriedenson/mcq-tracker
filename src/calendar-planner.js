"use strict";
/*
 * Kairos-style planning over the university calendar. This module is pure: it
 * merges the calendar's read-only classes with the local time blocks, works out
 * what is still free, and builds block drafts. It never edits a calendar event,
 * never writes a note and never invents a second timetable.
 */
const { str } = require("./util");
const timeBlocks = require("./time-blocks");

const DEFAULT_DAY_START = "08:00";
const DEFAULT_DAY_END = "22:00";
const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_AFTER_CLASS_MINUTES = 45;
const MAX_SLOTS = 24;
const MAX_TITLE = 200;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function minutesOf(value) {
  const time = timeBlocks.normalizeTime(value);
  if (!time) return -1;
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function clockOf(total) {
  return timeBlocks.timeFromMinutes(total);
}

function clampTitle(value, fallback) {
  const text = str(value).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
  return text || fallback;
}

/** The planning window for a day, with unusable or inverted input falling back. */
function planningWindow(options) {
  const opts = asObject(options);
  const start = minutesOf(opts.dayStart);
  const end = minutesOf(opts.dayEnd);
  if (start < 0 || end < 0 || end <= start) {
    return { start: minutesOf(DEFAULT_DAY_START), end: minutesOf(DEFAULT_DAY_END) };
  }
  return { start, end };
}

function dateMinutes(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return -1;
  return value.getHours() * 60 + value.getMinutes();
}

function eventStamp(event) {
  const start = dateMinutes(event && event.dtstart);
  const end = dateMinutes(event && event.dtend);
  if (start < 0 || end < 0 || end <= start) return null;
  return { start, end };
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

/**
 * One day's plan: classes as read-only context, planned blocks as the editable
 * layer, the free slots still open inside the planning window, and a summary.
 */
function dayPlan(events, date, blocks, options) {
  const opts = asObject(options);
  const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
  const window = planningWindow(opts);
  const minMinutes = Math.max(5, Math.min(240, Math.round(Number(opts.minSlotMinutes) || DEFAULT_SLOT_MINUTES)));
  const list = Array.isArray(events) ? events : [];

  const classes = [];
  for (const event of list) {
    if (!event) continue;
    const stamp = eventStamp(event);
    const allDay = event.allDay === true || !stamp;
    const sameDay = str(event.dateKey) ? event.dateKey === key : event.dtstart instanceof Date && timeBlocks.todayValue(event.dtstart) === key;
    if (!sameDay) continue;
    classes.push({
      kind: "class",
      id: str(event.uid || event.id).trim(),
      title: clampTitle(event.summary, "Class"),
      start: allDay ? "" : clockOf(stamp.start),
      end: allDay ? "" : clockOf(stamp.end),
      startMinutes: allDay ? -1 : stamp.start,
      endMinutes: allDay ? -1 : stamp.end,
      allDay,
      location: str(event.location).trim(),
      course: clampTitle(event.summary, ""),
    });
  }

  const planned = timeBlocks
    .blocksForDate(Array.isArray(blocks) ? blocks : [], key)
    .map((block) => ({
      kind: "block",
      id: block.id,
      title: block.title,
      start: block.start,
      end: block.end,
      startMinutes: minutesOf(block.start),
      endMinutes: minutesOf(block.end),
      minutes: timeBlocks.durationMinutes(block),
      type: block.type,
      course: block.course,
      done: block.done === true,
      projectId: block.projectId || "",
      overlap: false,
    }));

  const timedClasses = classes.filter((row) => !row.allDay);
  for (const block of planned) {
    block.overlap = timedClasses.some((row) => overlaps(block, row));
  }

  const items = classes
    .map((row) => ({ ...row, startMinutes: row.allDay ? -1 : row.startMinutes }))
    .concat(planned)
    .sort((a, b) => {
      const aAll = a.allDay === true;
      const bAll = b.allDay === true;
      if (aAll !== bAll) return aAll ? -1 : 1;
      return a.startMinutes - b.startMinutes;
    });

  const busy = timedClasses
    .concat(planned)
    .filter((row) => row.startMinutes >= 0 && row.endMinutes > row.startMinutes)
    .map((row) => ({ start: Math.max(window.start, row.startMinutes), end: Math.min(window.end, row.endMinutes) }))
    .filter((row) => row.end > row.start)
    .sort((a, b) => a.start - b.start)
    .reduce((merged, row) => {
      const last = merged[merged.length - 1];
      if (last && row.start <= last.end) last.end = Math.max(last.end, row.end);
      else merged.push({ ...row });
      return merged;
    }, []);

  const slots = [];
  let cursor = window.start;
  for (const span of busy) {
    if (span.start - cursor >= minMinutes) slots.push({ start: clockOf(cursor), end: clockOf(span.start), minutes: span.start - cursor });
    cursor = Math.max(cursor, span.end);
    if (slots.length >= MAX_SLOTS) break;
  }
  if (slots.length < MAX_SLOTS && window.end - cursor >= minMinutes) {
    slots.push({ start: clockOf(cursor), end: clockOf(window.end), minutes: window.end - cursor });
  }
  for (const slot of slots.slice(0, MAX_SLOTS)) {
    const next = timedClasses.find((row) => row.startMinutes >= minutesOf(slot.end)) || null;
    slot.subject = next ? next.title : "";
    slot.course = next ? next.course : "";
  }

  const classMinutes = timedClasses.reduce((sum, row) => sum + Math.max(0, row.endMinutes - row.startMinutes), 0);
  const plannedMinutes = planned.reduce((sum, row) => sum + Math.max(0, row.minutes), 0);
  return {
    date: key,
    windowStart: clockOf(window.start),
    windowEnd: clockOf(window.end),
    items,
    classes,
    blocks: planned,
    slots: slots.slice(0, MAX_SLOTS),
    summary: {
      classes: timedClasses.length,
      blocks: planned.length,
      classMinutes,
      plannedMinutes,
      freeMinutes: slots.reduce((sum, slot) => sum + slot.minutes, 0),
      overlaps: planned.filter((row) => row.overlap).length,
      openSlots: slots.length,
    },
  };
}

/** A draft study block for a free slot; the title borrows the next class. */
function slotDraft(slot, date, options) {
  const opts = asObject(options);
  const source = asObject(slot);
  const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
  const start = timeBlocks.normalizeTime(source.start);
  const end = timeBlocks.normalizeTime(source.end);
  if (!key || !start || !end || minutesOf(end) <= minutesOf(start)) return null;
  const subject = clampTitle(source.subject || source.course, "");
  return {
    date: key,
    start,
    end,
    title: clampTitle(opts.title, subject ? `Study: ${subject}` : "Study block"),
    type: "study",
    course: subject,
    source: "calendar-slot",
  };
}

/** A draft review block that follows a class, bounded by the planning window. */
function afterClassDraft(item, date, options) {
  const opts = asObject(options);
  const source = asObject(item);
  const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
  const startMinutes = Math.round(Number(source.endMinutes));
  if (!key || !Number.isFinite(startMinutes) || startMinutes < 0) return null;
  const window = planningWindow(opts);
  const length = Math.max(15, Math.min(240, Math.round(Number(opts.minutes) || DEFAULT_AFTER_CLASS_MINUTES)));
  const from = Math.max(startMinutes, window.start);
  const end = Math.min(from + length, Math.min(window.end, 1439));
  if (end <= from) return null;
  const subject = clampTitle(source.course || source.title, "");
  return {
    date: key,
    start: clockOf(from),
    end: clockOf(end),
    title: clampTitle(opts.title, subject ? `Review: ${subject}` : "Review after class"),
    type: "review",
    course: subject,
    source: "calendar-class",
  };
}

/** One readable line for the calendar card. */
function planSummaryLine(summary) {
  const source = asObject(summary);
  const parts = [];
  parts.push(`${timeBlocks.durationLabel(source.plannedMinutes || 0) || "0 min"} planned`);
  if (source.classes) parts.push(`${timeBlocks.durationLabel(source.classMinutes || 0)} in class`);
  if (source.freeMinutes) parts.push(`${timeBlocks.durationLabel(source.freeMinutes)} free time`);
  if (source.overlaps) parts.push(`${source.overlaps} block${source.overlaps === 1 ? "" : "s"} over a class`);
  return parts.join(" · ");
}

module.exports = {
  DEFAULT_AFTER_CLASS_MINUTES,
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  DEFAULT_SLOT_MINUTES,
  MAX_SLOTS,
  afterClassDraft,
  dayPlan,
  planSummaryLine,
  planningWindow,
  slotDraft,
};
