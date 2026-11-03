"use strict";
/*
 * Local, dependency-free time-block planning. Blocks own a span of a day;
 * tasks live inside them. Projects and domains are optional lenses, and the
 * backlog reuses the plugin's existing study tasks instead of creating a
 * second task system.
 */
const { hashString, str } = require("./util");

const MAX_BLOCKS = 2000;
const MAX_PROJECTS = 100;
const MAX_ROUTINES = 100;
const MAX_BACKLOG = 500;
const MAX_TASKS_PER_BLOCK = 40;
const MAX_TITLE = 200;
const MAX_TEXT = 12000;
const TIME_BLOCK_TYPES = ["study", "class", "personal", "review", "practice", "other"];
const TIME_BLOCK_VIEWS = ["day", "week", "grid", "backlog", "routines", "projects", "timeline"];
const PROJECT_KINDS = ["project", "domain"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PROJECT_COLORS = ["#6f8ff5", "#d97757", "#5cae8a", "#c084d6", "#d5a84f", "#5ba8c9"];

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function textValue(value, max) {
  return str(value).replace(/\r\n?/g, "\n").trim().slice(0, max || MAX_TITLE);
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function idFor(prefix, parts) {
  return `${prefix}-${hashString(parts.join("|"))}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDay(value) {
  const key = str(value).trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  return date;
}

function dayKey(date) {
  const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function dayValue(value) {
  const parsed = parseDay(value);
  if (!parsed) return "";
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}`;
}

function todayValue(now) {
  return dayKey(now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date());
}

function addDays(value, count) {
  const parsed = parseDay(value);
  if (!parsed) return "";
  parsed.setUTCDate(parsed.getUTCDate() + Math.round(count));
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}`;
}

function weekdayOf(value) {
  const parsed = parseDay(value);
  return parsed ? parsed.getUTCDay() : 0;
}

function startOfWeek(value, weekStartsOn) {
  const key = dayValue(value) || todayValue();
  const day = weekdayOf(key);
  const offset = weekStartsOn === "sunday" ? day : (day + 6) % 7;
  return addDays(key, -offset);
}

function weekDates(value, weekStartsOn) {
  const start = startOfWeek(value, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function normalizeTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(str(value).trim());
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${pad(hour)}:${pad(minute)}`;
}

function minutesOf(value) {
  const time = normalizeTime(value);
  if (!time) return -1;
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(total) {
  const value = Math.max(0, Math.min(1439, Math.round(total)));
  return `${pad(Math.floor(value / 60))}:${pad(value % 60)}`;
}

function durationMinutes(block) {
  const start = minutesOf(block && block.start);
  const end = minutesOf(block && block.end);
  return start >= 0 && end > start ? end - start : 0;
}

function durationLabel(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return `${hours}h${rest ? ` ${rest}m` : ""}`;
}

function enabledValue(value) {
  return !!(value && typeof value === "object" && value.enabled === true);
}

function normalizeType(value) {
  const type = str(value).trim().toLowerCase();
  return TIME_BLOCK_TYPES.includes(type) ? type : "study";
}

function normalizeView(value) {
  const view = str(value).trim();
  return TIME_BLOCK_VIEWS.includes(view) ? view : "day";
}

function normalizeProjectKind(value) {
  const kind = str(value).trim().toLowerCase();
  return PROJECT_KINDS.includes(kind) ? kind : "project";
}

function projectColor(value, id) {
  const color = str(value).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  return PROJECT_COLORS[Math.abs(Number.parseInt(hashString(id || "project"), 36)) % PROJECT_COLORS.length];
}

function normalizeBlockTask(value, createdAt) {
  const source = objectValue(value);
  const title = textValue(source.title, MAX_TITLE);
  if (!title) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("tbt", [title, source.studyTaskId || "", createdAt || 0]),
    title,
    done: source.done === true,
    studyTaskId: textValue(source.studyTaskId, 160),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, createdAt || 0))),
  };
}

function normalizeTimeBlock(value) {
  const source = objectValue(value);
  const title = textValue(source.title, MAX_TITLE);
  const date = dayValue(source.date);
  const start = normalizeTime(source.start);
  const end = normalizeTime(source.end);
  if (!title || !date || !start || !end || minutesOf(end) <= minutesOf(start)) return null;
  const createdAt = Math.max(0, Math.round(numberValue(source.createdAt, 0)));
  const tasks = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.tasks) ? source.tasks : []) {
    const task = normalizeBlockTask(raw, createdAt);
    if (!task || seen.has(task.id)) continue;
    seen.add(task.id);
    tasks.push(task);
    if (tasks.length >= MAX_TASKS_PER_BLOCK) break;
  }
  const projectId = textValue(source.projectId, 160);
  const routineId = textValue(source.routineId, 160);
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("tb", [date, start, end, title, source.createdAt || 0]),
    date,
    start,
    end,
    title,
    type: normalizeType(source.type),
    projectId,
    course: textValue(source.course, MAX_TITLE),
    notes: textValue(source.notes, MAX_TEXT),
    tasks,
    routineId,
    createdAt,
    updatedAt: Math.max(0, Math.round(numberValue(source.updatedAt, createdAt))),
  };
}

function normalizeTimeBlocks(value) {
  const source = objectValue(value);
  const blocks = [];
  const seenBlocks = new Set();
  for (const raw of Array.isArray(source.blocks) ? source.blocks : []) {
    const block = normalizeTimeBlock(raw);
    if (!block || seenBlocks.has(block.id)) continue;
    seenBlocks.add(block.id);
    blocks.push(block);
    if (blocks.length >= MAX_BLOCKS) break;
  }
  const projects = [];
  const seenProjects = new Set();
  for (const raw of Array.isArray(source.projects) ? source.projects : []) {
    const project = normalizeTimeProject(raw);
    if (!project || seenProjects.has(project.id)) continue;
    seenProjects.add(project.id);
    projects.push(project);
    if (projects.length >= MAX_PROJECTS) break;
  }
  const routines = [];
  const seenRoutines = new Set();
  for (const raw of Array.isArray(source.routines) ? source.routines : []) {
    const routine = normalizeTimeRoutine(raw);
    if (!routine || seenRoutines.has(routine.id)) continue;
    seenRoutines.add(routine.id);
    routines.push(routine);
    if (routines.length >= MAX_ROUTINES) break;
  }
  const backlog = [];
  const seenBacklog = new Set();
  for (const raw of Array.isArray(source.backlog) ? source.backlog : []) {
    const item = normalizeBacklogItem(raw);
    if (!item || seenBacklog.has(item.id)) continue;
    seenBacklog.add(item.id);
    backlog.push(item);
    if (backlog.length >= MAX_BACKLOG) break;
  }
  return {
    enabled: enabledValue(source),
    showCalendar: source.showCalendar !== false,
    weekStartsOn: source.weekStartsOn === "sunday" ? "sunday" : "monday",
    dayStart: normalizeTime(source.dayStart) || "07:00",
    dayEnd: normalizeTime(source.dayEnd) || "22:00",
    notesFolder: textValue(source.notesFolder, 200) || "Time blocks",
    dailyNoteFolder: textValue(source.dailyNoteFolder, 200),
    view: normalizeView(source.view),
    blocks,
    projects,
    routines,
    backlog,
  };
}

function createTimeBlock(input, now) {
  const source = objectValue(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeTimeBlock({
    ...source,
    id: source.id || idFor("tb", [source.date || "", source.start || "", source.end || "", source.title || "", stamp]),
    createdAt: source.createdAt || stamp,
    updatedAt: stamp,
  });
}

function normalizeTimeProject(value) {
  const source = objectValue(value);
  const name = textValue(source.name, MAX_TITLE);
  if (!name) return null;
  const id = str(source.id).trim().slice(0, 160) || idFor("tbp", [name, source.kind || "project", source.createdAt || 0]);
  return {
    id,
    name,
    kind: normalizeProjectKind(source.kind),
    color: projectColor(source.color, id),
    course: textValue(source.course, MAX_TITLE),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function createTimeProject(input, now) {
  const source = objectValue(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeTimeProject({ ...source, createdAt: source.createdAt || stamp });
}

function normalizeRoutineDays(value) {
  const raw = Array.isArray(value) ? value : str(value).split(/[,\s]+/);
  const found = new Set();
  for (const item of raw) {
    const text = str(item).trim().toLowerCase();
    if (!text) continue;
    const index = WEEKDAY_NAMES.findIndex((name) => name.toLowerCase() === text.slice(0, 3));
    const numeric = Number(text);
    if (index >= 0) found.add(index);
    else if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) found.add(numeric);
  }
  return [...found].sort((a, b) => a - b);
}

function normalizeTimeRoutine(value) {
  const source = objectValue(value);
  const title = textValue(source.title, MAX_TITLE);
  const start = normalizeTime(source.start);
  const end = normalizeTime(source.end);
  const days = normalizeRoutineDays(source.days);
  if (!title || !start || !end || minutesOf(end) <= minutesOf(start) || !days.length) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("tbr", [title, start, end, days.join(""), source.createdAt || 0]),
    title,
    days,
    start,
    end,
    type: normalizeType(source.type),
    projectId: textValue(source.projectId, 160),
    course: textValue(source.course, MAX_TITLE),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function createTimeRoutine(input, now) {
  const source = objectValue(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeTimeRoutine({ ...source, createdAt: source.createdAt || stamp });
}

function normalizeBacklogItem(value) {
  const source = objectValue(value);
  const title = textValue(source.title, MAX_TITLE);
  if (!title) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("tbb", [title, source.projectId || "", source.createdAt || 0]),
    title,
    projectId: textValue(source.projectId, 160),
    course: textValue(source.course, MAX_TITLE),
    resurface: dayValue(source.resurface),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function createBacklogItem(input, now) {
  const source = objectValue(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeBacklogItem({ ...source, createdAt: source.createdAt || stamp });
}

function blocksForDate(blocks, date) {
  const key = dayValue(date);
  return (Array.isArray(blocks) ? blocks : [])
    .filter((block) => block && block.date === key)
    .sort((a, b) => a.start.localeCompare(b.start) || a.createdAt - b.createdAt);
}

function blocksInRange(blocks, start, end) {
  const first = dayValue(start);
  const last = dayValue(end);
  if (!first || !last || last < first) return [];
  return (Array.isArray(blocks) ? blocks : []).filter((block) => block.date >= first && block.date <= last);
}

function blockSummary(blocks, date) {
  const list = blocksForDate(blocks, date);
  const minutes = list.reduce((sum, block) => sum + durationMinutes(block), 0);
  const tasks = list.flatMap((block) => block.tasks);
  return {
    date: dayValue(date),
    blocks: list.length,
    minutes,
    tasks: tasks.length,
    done: tasks.filter((task) => task.done).length,
    open: tasks.filter((task) => !task.done).length,
  };
}

function weekSummary(blocks, date, weekStartsOn) {
  const days = weekDates(date, weekStartsOn).map((key) => blockSummary(blocks, key));
  return {
    days,
    blocks: days.reduce((sum, day) => sum + day.blocks, 0),
    minutes: days.reduce((sum, day) => sum + day.minutes, 0),
    open: days.reduce((sum, day) => sum + day.open, 0),
  };
}

function scheduledStudyTaskIds(blocks) {
  const ids = new Set();
  for (const block of Array.isArray(blocks) ? blocks : []) {
    for (const task of block.tasks || []) {
      if (task.studyTaskId) ids.add(task.studyTaskId);
    }
  }
  return ids;
}

/** Existing open study tasks that are not already inside any time block. */
function unscheduledStudyTasks(tasks, blocks, today) {
  const scheduled = scheduledStudyTaskIds(blocks);
  const day = dayValue(today);
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task && !task.done && !scheduled.has(task.id))
    .sort((a, b) => (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") || a.createdAt - b.createdAt)
    .map((task) => ({ ...task, overdue: !!(day && task.due && task.due < day) }));
}

function eventClock(value) {
  const date = value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return timeFromMinutes(date.getHours() * 60 + date.getMinutes());
}

function eventMinute(value) {
  const date = value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) return -1;
  return date.getHours() * 60 + date.getMinutes();
}

function overlapsBlock(event, block) {
  const start = eventMinute(event.dtstart);
  const finish = eventMinute(event.dtend);
  const blockStart = minutesOf(block.start);
  const blockEnd = minutesOf(block.end);
  if (start < 0 || finish <= start || blockStart < 0 || blockEnd <= blockStart) return false;
  return Math.max(start, blockStart) < Math.min(finish, blockEnd);
}

/**
 * Read-only calendar context for one day. Events come from the existing
 * calendar; a block that shares their time is marked, never moved or copied.
 */
function calendarDaySummary(events, date, blocks) {
  const key = dayValue(date);
  const list = (Array.isArray(events) ? events : [])
    .filter((event) => {
      if (!event) return false;
      if (str(event.dateKey)) return event.dateKey === key;
      return event.dtstart instanceof Date && !Number.isNaN(event.dtstart.getTime()) && dayKey(event.dtstart) === key;
    })
    .sort((a, b) => {
      const aAll = a.allDay === true;
      const bAll = b.allDay === true;
      if (aAll !== bAll) return aAll ? -1 : 1;
      return eventMinute(a.dtstart) - eventMinute(b.dtstart);
    });
  const dayBlocks = blocksForDate(blocks, key);
  const rows = list.map((event, index) => {
    const allDay = event.allDay === true;
    const start = allDay ? "" : eventClock(event.dtstart);
    const end = allDay ? "" : eventClock(event.dtend);
    const overlapping = allDay
      ? []
      : dayBlocks
          .filter((block) => overlapsBlock(event, block))
          .map((block) => ({ id: block.id, title: block.title, start: block.start, end: block.end }));
    return {
      id: str(event.uid || event.id).trim() || idFor("tbc", [key, str(event.summary), start, index]),
      title: textValue(event.summary, MAX_TITLE) || "Untitled event",
      start,
      end,
      allDay,
      location: textValue(event.location, MAX_TITLE),
      course: textValue(event.course || (event.details && event.details.subject), MAX_TITLE),
      overlaps: overlapping,
    };
  });
  const spans = rows
    .filter((row) => !row.allDay && row.start && row.end)
    .map((row) => ({ start: minutesOf(row.start), end: minutesOf(row.end) }))
    .filter((span) => span.start >= 0 && span.end > span.start)
    .sort((a, b) => a.start - b.start);
  let busyMinutes = 0;
  let cursor = 0;
  for (const span of spans) {
    const start = Math.max(cursor, span.start);
    if (span.end > start) busyMinutes += span.end - start;
    cursor = Math.max(cursor, span.end);
  }
  const conflictBlocks = new Set(rows.flatMap((row) => row.overlaps.map((block) => block.id)));
  return {
    date: key,
    events: rows.length,
    rows,
    busyMinutes,
    conflicts: rows.filter((row) => row.overlaps.length > 0).length,
    conflictBlocks: conflictBlocks.size,
  };
}

function calendarWeekSummary(events, date, weekStartsOn, blocks) {
  const days = weekDates(date, weekStartsOn).map((key) => calendarDaySummary(events, key, blocks));
  return {
    days,
    events: days.reduce((sum, day) => sum + day.events, 0),
    busyMinutes: days.reduce((sum, day) => sum + day.busyMinutes, 0),
    conflicts: days.reduce((sum, day) => sum + day.conflicts, 0),
  };
}

function projectMap(projects) {
  const map = new Map();
  for (const project of Array.isArray(projects) ? projects : []) map.set(project.id, project);
  return map;
}

/** One-way reader for a daily-note folder; never writes to the source note. */
function parseDailyNoteLines(markdown) {
  const text = str(markdown).replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
  const rows = [];
  const seen = new Set();
  let fence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^(\x60{3}|~{3})/.test(line.trim())) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const match = /^\s*(?:[-*+]\s+)?(?:\[[ xX]\]\s+)?(\d{1,2}:\d{2})(?:\s*(?:-|–|—|to)\s*(\d{1,2}:\d{2}))?\s+(.+?)\s*$/i.exec(line);
    if (!match) continue;
    const start = normalizeTime(match[1]);
    const title = textValue(match[3], MAX_TITLE);
    if (!start || !title) continue;
    let end = normalizeTime(match[2]);
    if (!end) end = timeFromMinutes(Math.min(minutesOf(start) + 60, 1439));
    if (minutesOf(end) <= minutesOf(start)) continue;
    const key = [start, end, title.toLowerCase()].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ start, end, title });
    if (rows.length >= 200) break;
  }
  return rows;
}

function dailyNotePath(date, folder) {
  const key = dayValue(date);
  const clean = str(folder).trim().replace(/^\/+|\/+$/g, "");
  if (!key || !clean || clean.split("/").some((part) => part === "..")) return "";
  return clean + "/" + key + ".md";
}

function blocksToMarkdown(date, blocks, projects) {
  const map = projectMap(projects);
  const lines = [`# ${dayValue(date) || date}`, "", "## Schedule", ""];
  for (const block of blocksForDate(blocks, date)) {
    const project = map.get(block.projectId);
    const tag = project ? ` [${project.kind === "domain" ? "D" : "P"}:${project.name}]` : "";
    lines.push(`- ${block.start} - ${block.end} ${block.title}${tag}`);
    for (const task of block.tasks) lines.push(`  - [${task.done ? "x" : " "}] ${task.title}`);
    for (const noteLine of str(block.notes).split("\n").filter(Boolean)) lines.push(`  - ${noteLine}`);
    lines.push("");
  }
  if (lines[lines.length - 1] === "") lines.pop();
  return `${lines.join("\n")}\n`;
}

/** Create any routine blocks missing for a date; existing routine blocks win. */
function applyRoutines(routines, blocks, date, now) {
  const key = dayValue(date);
  if (!key) return { blocks: Array.isArray(blocks) ? blocks : [], created: [] };
  const day = weekdayOf(key);
  const existing = new Set(
    (Array.isArray(blocks) ? blocks : [])
      .filter((block) => block && block.date === key && block.routineId)
      .map((block) => block.routineId)
  );
  const created = [];
  for (const routine of Array.isArray(routines) ? routines : []) {
    if (!routine || !routine.days.includes(day) || existing.has(routine.id)) continue;
    const block = createTimeBlock(
      {
        date: key,
        start: routine.start,
        end: routine.end,
        title: routine.title,
        type: routine.type,
        projectId: routine.projectId,
        course: routine.course,
        routineId: routine.id,
      },
      Math.max(0, Math.round(numberValue(now, Date.now()))) + created.length
    );
    if (block) {
      created.push(block);
      existing.add(routine.id);
    }
  }
  return { blocks: (Array.isArray(blocks) ? blocks : []).concat(created), created };
}

function projectMinutes(blocks, start, end) {
  const totals = {};
  for (const block of blocksInRange(blocks, start, end)) {
    const key = block.projectId || "none";
    totals[key] = (totals[key] || 0) + durationMinutes(block);
  }
  return totals;
}

function projectTimeline(blocks, projects, days, endDate) {
  const end = dayValue(endDate);
  const count = Math.max(1, Math.round(Number(days) || 14));
  const start = addDays(end, -(count - 1));
  const dates = Array.from({ length: count }, (_, index) => addDays(start, index));
  const map = projectMap(projects);
  const rows = [];
  for (const project of Array.isArray(projects) ? projects : []) rows.push({ id: project.id, name: project.name, kind: project.kind, color: project.color, minutes: 0, byDay: {} });
  rows.push({ id: "", name: "Unassigned", kind: "domain", color: "#8a8a8a", minutes: 0, byDay: {} });
  const index = new Map(rows.map((row) => [row.id, row]));
  for (const block of blocksInRange(blocks, start, end)) {
    const row = index.get(block.projectId) || index.get("");
    row.minutes += durationMinutes(block);
    row.byDay[block.date] = (row.byDay[block.date] || 0) + durationMinutes(block);
  }
  for (const row of rows) {
    for (const date of dates) row.byDay[date] = row.byDay[date] || 0;
  }
  return {
    start,
    end,
    dates,
    rows: rows.filter((row) => row.minutes > 0).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name)),
  };
}

function normalizeTimeline(value) {
  const blocks = Array.isArray(value) ? value : [];
  const future = blocks.filter((block) => block.date > todayValue());
  const totalMinutes = blocks.reduce((sum, block) => sum + durationMinutes(block), 0);
  return {
    blocks: blocks.length,
    future: future.length,
    totalMinutes,
    tasks: blocks.reduce((sum, block) => sum + block.tasks.length, 0),
  };
}

module.exports = {
  MAX_BACKLOG,
  MAX_BLOCKS,
  MAX_PROJECTS,
  MAX_ROUTINES,
  MAX_TASKS_PER_BLOCK,
  PROJECT_COLORS,
  PROJECT_KINDS,
  TIME_BLOCK_TYPES,
  TIME_BLOCK_VIEWS,
  WEEKDAY_NAMES,
  addDays,
  applyRoutines,
  blockSummary,
  blocksForDate,
  blocksInRange,
  blocksToMarkdown,
  calendarDaySummary,
  calendarWeekSummary,
  createBacklogItem,
  dailyNotePath,
  createTimeBlock,
  createTimeProject,
  createTimeRoutine,
  dayValue,
  durationLabel,
  durationMinutes,
  normalizeBacklogItem,
  normalizeTime,
  normalizeTimeBlock,
  normalizeTimeBlocks,
  normalizeTimeProject,
  normalizeTimeRoutine,
  normalizeTimeline,
  parseDailyNoteLines,
  projectMinutes,
  projectTimeline,
  startOfWeek,
  timeFromMinutes,
  todayValue,
  unscheduledStudyTasks,
  weekDates,
  weekSummary,
  weekdayOf,
};
