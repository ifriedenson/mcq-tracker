"use strict";
/*
 * Reading schedules for one book. A `reading-plan` block declares the page
 * count, start and target dates, reading days and optional days off. Scheduling
 * starts from the pages actually read, so a missed day increases the remaining
 * daily chunks instead of creating a second plan. Nothing here writes notes or
 * touches the question/card scheduler.
 */
const { hashString, localDate, str } = require("./util");

const MAX_PAGES = 1_000_000;
const MAX_SPAN_DAYS = 3650;
const MAX_PROGRESS_ENTRIES = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_PREFIXES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function parseDay(value) {
  const text = str(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function dayKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(date, count) {
  return new Date(date.getTime() + count * DAY_MS);
}

function weekdayOf(date) {
  return (date.getUTCDay() + 6) % 7;
}

function formatDay(key) {
  const date = parseDay(key);
  if (!date) return key;
  return `${WEEKDAY_LABELS[weekdayOf(date)]}, ${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function dayIndex(token) {
  const clean = str(token).trim().toLowerCase().replace(/\.$/, "").slice(0, 3);
  return DAY_PREFIXES.indexOf(clean);
}

function allDays() {
  return [0, 1, 2, 3, 4, 5, 6];
}

/** Parse `everyday`, `weekdays`, `weekends`, `mon-fri` or a list of day names. */
function parseReadingDays(value) {
  const text = str(value).trim().toLowerCase();
  if (!text || /^(every|daily|all|everyday|any)$/.test(text)) return { days: allDays(), issues: [] };
  if (/^weekdays?$/.test(text) || /^mon\s*-\s*fri$/.test(text)) return { days: [0, 1, 2, 3, 4], issues: [] };
  if (/^weekends?$/.test(text)) return { days: [5, 6], issues: [] };

  const days = [];
  const issues = [];
  const groups = text.split(/[,;|]+/).map((part) => part.trim()).filter(Boolean);
  for (const group of groups) {
    const range = group.match(/^([a-z.]+)\s*(?:-|–|—|to|\.\.)\s*([a-z.]+)$/);
    if (range) {
      const from = dayIndex(range[1]);
      const to = dayIndex(range[2]);
      if (from < 0 || to < 0 || from > to) {
        issues.push(`Read day range "${group}" is not valid. Use mon-fri.`);
        continue;
      }
      for (let at = from; at <= to; at++) days.push(at);
      continue;
    }
    for (const token of group.split(/\s+/).filter(Boolean)) {
      const at = dayIndex(token);
      if (at < 0) issues.push(`Read day "${token}" is not a weekday.`);
      else days.push(at);
    }
  }
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (!unique.length) issues.push("Add at least one reading day, for example days: mon-fri.");
  return { days: unique, issues };
}

function readPages(value, fallback) {
  const text = str(value).trim();
  if (!text) return fallback;
  const n = Number(text);
  return Number.isInteger(n) ? n : NaN;
}

function parseReadingPlan(source) {
  const text = str(source).replace(/\r\n?/g, "\n");
  const fields = {};
  const issues = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!match) {
      issues.push(`Could not read "${line}". Use key: value.`);
      continue;
    }
    fields[match[1].toLowerCase()] = match[2].trim();
  }

  const title = str(fields.title || fields.book).trim();
  if (!title) issues.push("Add a title: line with the book name.");

  const pages = readPages(fields.pages, 0);
  if (!Number.isInteger(pages) || pages <= 0 || pages > MAX_PAGES) {
    issues.push("Add pages: with a whole number greater than zero.");
  }

  const start = str(fields.start).trim();
  const target = str(fields.target).trim();
  const startDate = parseDay(start);
  const targetDate = parseDay(target);
  if (!startDate) issues.push("Add start: as a date in YYYY-MM-DD form.");
  if (!targetDate) issues.push("Add target: as a date in YYYY-MM-DD form.");
  if (startDate && targetDate) {
    if (startDate > targetDate) issues.push("The start date must be on or before the target date.");
    else if ((targetDate - startDate) / DAY_MS > MAX_SPAN_DAYS) issues.push("This schedule is longer than ten years. Choose a nearer target date.");
  }

  const daysParsed = parseReadingDays(fields.days);
  issues.push(...daysParsed.issues);

  const off = [];
  for (const raw of str(fields.off).split(/[,;|]+/).map((part) => part.trim()).filter(Boolean)) {
    const key = str(raw).trim();
    if (!parseDay(key)) issues.push(`Off day "${key}" is not a date in YYYY-MM-DD form.`);
    else if (!off.includes(key)) off.push(key);
  }

  const read = readPages(fields.read, 0);
  const validPages = Number.isInteger(pages) && pages > 0;
  if (!Number.isInteger(read) || read < 0 || read > pages) {
    issues.push("Add read: as a whole number from 0 to the page count.");
  }

  const id =
    str(fields.id).trim().replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) ||
    `reading-${hashString(`${title}|${start}|${target}`)}`;

  return {
    title,
    author: str(fields.author).trim(),
    pages: validPages ? pages : 0,
    start,
    target,
    days: daysParsed.days,
    off,
    read: Number.isInteger(read) ? Math.max(0, Math.min(validPages ? pages : read, read)) : 0,
    id,
    valid: issues.length === 0,
    issues,
  };
}

function readingDaysBetween(startKey, endKey, days, off) {
  const start = parseDay(startKey);
  const end = parseDay(endKey);
  if (!start || !end || start > end) return [];
  const wanted = new Set(Array.isArray(days) ? days : []);
  const skipped = new Set(Array.isArray(off) ? off : []);
  const out = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard <= MAX_SPAN_DAYS) {
    const key = dayKey(cursor);
    if (wanted.has(weekdayOf(cursor)) && !skipped.has(key)) out.push(key);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return out;
}

/** Distribute integer pages as evenly as possible, with the remainder first. */
function distributePages(total, count) {
  if (count <= 0) return [];
  const pages = Math.max(0, Math.round(Number(total) || 0));
  const base = Math.floor(pages / count);
  const extra = pages % count;
  return Array.from({ length: count }, (_value, index) => base + (index < extra ? 1 : 0));
}

function sumPages(items) {
  return (Array.isArray(items) ? items : []).reduce((total, item) => total + (Number(item && item.pages) || 0), 0);
}

function normalizeReadingSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const raw = source.progress && typeof source.progress === "object" && !Array.isArray(source.progress) ? source.progress : {};
  const progress = {};
  let count = 0;
  for (const [key, rawValue] of Object.entries(raw)) {
    if (count >= MAX_PROGRESS_ENTRIES) break;
    const id = str(key).trim().slice(0, 120);
    const pages = Math.round(Number(rawValue));
    if (!id || !Number.isFinite(pages) || pages < 0) continue;
    progress[id] = Math.min(MAX_PAGES, pages);
    count++;
  }
  return { progress };
}

/**
 * Rebuild the schedule from current progress. The "behind" check uses pages
 * planned through yesterday, so a reader is not called late before today's
 * chunk has had a chance to be read.
 */
function planReading(parsed, options) {
  const opts = options || {};
  const today = str(opts.today || localDate()).trim();
  const todayDate = parseDay(today);
  if (!parsed || !parsed.valid) {
    return { ok: false, issue: parsed && parsed.issues && parsed.issues.length ? parsed.issues.join(" ") : "The reading plan is not valid.", parsed };
  }
  if (!todayDate) return { ok: false, issue: "Today's date is not valid. Use YYYY-MM-DD.", parsed };

  const read = Math.max(0, Math.min(parsed.pages, Math.round(Number(opts.read !== undefined ? opts.read : parsed.read) || 0)));
  const pct = Math.round((read / parsed.pages) * 100);
  const allDays = readingDaysBetween(parsed.start, parsed.target, parsed.days, parsed.off);
  if (!allDays.length) {
    return {
      ok: false,
      issue: "No reading days fall between start and target. Add a reading day or change the dates.",
      parsed,
      read,
      pct,
      status: "off-pace",
    };
  }

  const plannedPages = distributePages(parsed.pages, allDays.length);
  const planned = allDays.map((date, index) => ({ date, pages: plannedPages[index] }));
  const throughYesterday = sumPages(planned.filter((item) => item.date < today));
  const remainingDays = allDays.filter((date) => date >= today);
  const complete = read >= parsed.pages;
  const remainingPages = Math.max(0, parsed.pages - read);
  const schedulePages = complete ? [] : distributePages(remainingPages, remainingDays.length);
  const schedule = complete ? [] : remainingDays.map((date, index) => ({ date, pages: schedulePages[index] }));
  const behindBy = Math.max(0, throughYesterday - read);
  const aheadBy = Math.max(0, read - throughYesterday);

  let status = "on-track";
  if (complete) status = "complete";
  else if (today < parsed.start) status = "not-started";
  else if (today > parsed.target || !remainingDays.length) status = "off-pace";
  else if (behindBy > 0) status = "behind";
  else if (aheadBy > 0) status = "ahead";

  const todayChunk = schedule.find((item) => item.date === today);
  return {
    ok: true,
    parsed,
    today,
    read,
    pct,
    planned,
    schedule,
    totalReadingDays: allDays.length,
    daysLeft: remainingDays.length,
    remainingPages,
    expectedThroughYesterday: throughYesterday,
    behindBy,
    aheadBy,
    todayChunk: todayChunk ? todayChunk.pages : 0,
    nextDate: schedule.length ? schedule[0].date : "",
    status,
    issue: "",
  };
}

module.exports = {
  MAX_PAGES,
  MAX_SPAN_DAYS,
  MAX_PROGRESS_ENTRIES,
  parseDay,
  dayKey,
  formatDay,
  parseReadingDays,
  parseReadingPlan,
  readingDaysBetween,
  distributePages,
  normalizeReadingSettings,
  planReading,
};
