"use strict";
/*
 * The week timetable: a real-clock Monday-to-Sunday grid over the same rows the
 * merged calendar already reads. This module only turns rows into positions;
 * the calendar view decides how to draw them. Overlapping rows are split into
 * lanes so two things at 09:00 never sit on top of each other.
 */
const { str } = require("./util");

const WEEK_HOUR_START = 7;
const WEEK_HOUR_END = 22;
const WEEK_HOUR_HEIGHT = 44;
const SHORT_EVENT_MINUTES = 30;
const LONG_EVENT_MINUTES = 60;
const MIN_BLOCK_HEIGHT = 18;
const MINUTES_IN_DAY = 24 * 60;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function keyOf(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local noon, so a daylight-saving change cannot move the day. */
function dateOf(key) {
  const text = str(key).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysToKey(key, days) {
  const date = dateOf(key);
  if (!date) return "";
  return keyOf(new Date(date.getFullYear(), date.getMonth(), date.getDate() + Math.round(Number(days) || 0), 12));
}

/** Minutes since midnight for a clock string: "9:00", "09:00", "3pm", "12:30 am". */
function clockMinutes(value) {
  const text = str(value).trim().toLowerCase();
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text);
  if (!match) return null;
  const minutes = match[2] ? Number(match[2]) : 0;
  if (minutes > 59) return null;
  let hours = Number(match[1]);
  if (match[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (match[3] === "pm" ? 12 : 0);
  }
  if (hours > 23) return null;
  return hours * 60 + minutes;
}

/** Minutes since midnight for a Date, or null. */
function dayMinutes(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function clampMinutes(value) {
  return Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(Number(value) || 0)));
}

/**
 * Start and end minutes for a row. A row may carry `startMin`/`endMin`
 * already (classes, whose events carry real dates) or a `time` string such as
 * "09:00–10:30", "09:00 - 10:30" or "15:00". A block with only a start gets a
 * short duration rather than filling the day.
 */
function rowMinutes(row) {
  const source = row && typeof row === "object" ? row : {};
  let start = typeof source.startMin === "number" && Number.isFinite(source.startMin) ? Math.round(source.startMin) : null;
  let end = typeof source.endMin === "number" && Number.isFinite(source.endMin) ? Math.round(source.endMin) : null;
  if (start === null) {
    const parts = str(source.time)
      .split(/[\u2013\u2014-]/)
      .map((part) => part.trim())
      .filter(Boolean);
    start = clockMinutes(parts[0]);
    if (start !== null && parts.length > 1) end = clockMinutes(parts[1]);
  }
  if (start === null) return null;
  if (end === null || !Number.isFinite(end) || end <= start) {
    end = start + (source.layer === "classes" ? LONG_EVENT_MINUTES : SHORT_EVENT_MINUTES);
  }
  return { start: clampMinutes(start), end: clampMinutes(end) };
}

/** The first day of the week holding `anchorKey`. Monday unless asked otherwise. */
function weekStartKey(anchorKey, firstDayOfWeek) {
  const anchor = dateOf(anchorKey) || dateOf(keyOf(new Date())) || new Date();
  const start = str(firstDayOfWeek).trim().toLowerCase() === "sunday" ? 0 : 1;
  const offset = (anchor.getDay() - start + 7) % 7;
  return keyOf(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - offset, 12));
}

function weekDayKeys(startKey) {
  const start = dateOf(startKey) ? str(startKey).trim() : weekStartKey(startKey, "monday");
  const keys = [];
  for (let index = 0; index < 7; index++) {
    const key = addDaysToKey(start, index);
    if (key) keys.push(key);
  }
  return keys;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function weekdayShort(key) {
  const date = dateOf(key);
  return date ? WEEKDAY_SHORT[date.getDay()] : "";
}

function dayOfMonth(key) {
  const date = dateOf(key);
  return date ? date.getDate() : 0;
}

/** "Nov 16 – 22, 2026", "Nov 30 – Dec 6, 2026" or "Dec 29, 2025 – Jan 4, 2026". */
function weekLabel(startKey) {
  const start = dateOf(startKey);
  const end = dateOf(addDaysToKey(startKey, 6));
  if (!start || !end) return "";
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const head = sameMonth
    ? `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`
    : `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}${sameYear ? "" : `, ${start.getFullYear()}`}`;
  const tail = sameMonth ? `${end.getDate()}, ${end.getFullYear()}` : `${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  return `${head} \u2013 ${tail}`;
}

/**
 * Rows for one day as positioned blocks, plus the rows with no clock time.
 * Overlapping blocks form a cluster and share its lane count, so a 09:00
 * lecture and a 09:30 seminar each take half the column width.
 */
function layoutDay(rows, options) {
  const opts = options || {};
  const dayStart = Number.isFinite(opts.dayStart) ? Number(opts.dayStart) : WEEK_HOUR_START;
  const hourHeight = Number.isFinite(opts.hourHeight) && opts.hourHeight > 0 ? Number(opts.hourHeight) : WEEK_HOUR_HEIGHT;
  const timed = [];
  const allDay = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object" || !str(row.title).trim()) continue;
    const minutes = rowMinutes(row);
    const base = {
      layer: str(row.layer) || "events",
      title: str(row.title).trim(),
      time: str(row.time).trim(),
      meta: str(row.meta).trim(),
      color: str(row.color).trim(),
    };
    if (!minutes) {
      allDay.push(base);
      continue;
    }
    timed.push({ ...base, startMin: minutes.start, endMin: minutes.end });
  }
  timed.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.title.localeCompare(b.title));

  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -1;
  const closeCluster = () => {
    if (!cluster.length) return;
    const lanes = cluster.reduce((most, block) => Math.max(most, block.lane + 1), 1);
    for (const block of cluster) block.lanes = lanes;
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };
  for (const block of timed) {
    if (cluster.length && block.startMin >= clusterEnd) closeCluster();
    if (!cluster.length) clusterEnd = block.endMin;
    let lane = laneEnds.findIndex((end) => end <= block.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(block.endMin);
    } else {
      laneEnds[lane] = block.endMin;
    }
    block.lane = lane;
    clusterEnd = Math.max(clusterEnd, block.endMin);
    cluster.push(block);
  }
  closeCluster();

  const blocks = timed.map((block) => ({
    ...block,
    top: ((block.startMin - dayStart * 60) / 60) * hourHeight,
    height: Math.max(MIN_BLOCK_HEIGHT, ((block.endMin - block.startMin) / 60) * hourHeight - 2),
    left: block.lanes > 1 ? (block.lane / block.lanes) * 100 : 0,
    width: block.lanes > 1 ? 100 / block.lanes : 100,
  }));
  return { blocks, allDay };
}

/**
 * The whole week: days, hour axis, positioned blocks and the now-line.
 * The axis starts at 07:00 and ends at 22:00 unless something sits outside
 * that window, in which case it widens to hold it.
 */
function buildWeek(input) {
  const opts = input || {};
  const startKey = weekStartKey(opts.startKey, opts.firstDayOfWeek);
  const keys = weekDayKeys(startKey);
  const rowsByDay = opts.rowsByDay && typeof opts.rowsByDay.get === "function" ? opts.rowsByDay : new Map();
  const hourHeight = Number.isFinite(opts.hourHeight) && opts.hourHeight > 0 ? Number(opts.hourHeight) : WEEK_HOUR_HEIGHT;

  let earliest = WEEK_HOUR_START * 60;
  let latest = WEEK_HOUR_END * 60;
  for (const key of keys) {
    for (const row of rowsByDay.get(key) || []) {
      const minutes = rowMinutes(row);
      if (!minutes) continue;
      earliest = Math.min(earliest, minutes.start);
      latest = Math.max(latest, minutes.end);
    }
  }
  const dayStart = Math.max(0, Math.min(WEEK_HOUR_START, Math.floor(earliest / 60)));
  const dayEnd = Math.min(24, Math.max(WEEK_HOUR_END, Math.ceil(latest / 60)));

  const todayKey = str(opts.todayKey).trim() || keyOf(new Date());
  const days = keys.map((key) => {
    const laid = layoutDay(rowsByDay.get(key) || [], { dayStart, hourHeight });
    return {
      key,
      weekday: weekdayShort(key),
      dayOfMonth: dayOfMonth(key),
      isToday: key === todayKey,
      blocks: laid.blocks,
      allDay: laid.allDay,
    };
  });

  const hours = [];
  for (let hour = dayStart; hour < dayEnd; hour++) hours.push(hour);

  const now = opts.now === undefined || opts.now === null ? new Date() : opts.now instanceof Date ? opts.now : new Date(opts.now);
  const nowKey = Number.isNaN(now.getTime()) ? "" : keyOf(now);
  const dayIndex = nowKey ? keys.indexOf(nowKey) : -1;
  const minutes = dayMinutes(now);
  let nowLine = null;
  if (dayIndex >= 0 && minutes !== null && minutes >= dayStart * 60 && minutes <= dayEnd * 60) {
    const top = ((minutes - dayStart * 60) / 60) * hourHeight;
    nowLine = { key: nowKey, dayIndex, minutes, top, label: `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}` };
  }

  return {
    startKey,
    endKey: keys[keys.length - 1] || startKey,
    keys,
    days,
    hours,
    hourHeight,
    dayStart,
    dayEnd,
    now: nowLine,
    label: weekLabel(startKey),
  };
}

module.exports = {
  LONG_EVENT_MINUTES,
  MIN_BLOCK_HEIGHT,
  SHORT_EVENT_MINUTES,
  WEEK_HOUR_END,
  WEEK_HOUR_HEIGHT,
  WEEK_HOUR_START,
  buildWeek,
  clockMinutes,
  dayMinutes,
  dayOfMonth,
  layoutDay,
  rowMinutes,
  weekDayKeys,
  weekLabel,
  weekStartKey,
  weekdayShort,
};
