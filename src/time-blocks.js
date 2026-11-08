"use strict";
/*
 * Local, dependency-free time-block planning. Blocks own a span of a day;
 * tasks live inside them. Projects and domains are optional lenses, and the
 * backlog reuses the plugin's existing study tasks instead of creating a
 * second task system.
 */
const { boundedText, hashString, str } = require("./util");

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
const SUBJECT_COLOR_LIMIT = 40;
const MAX_TAGS = 6;
const MAX_TAG_LENGTH = 40;
const TASK_STATUSES = ["open", "half", "done", "cancelled"];
const UNSCHEDULED_TITLE = "Unscheduled";
const DEFAULT_SCHEDULE_HEADING = "## Schedule";
const PROJECT_STATUSES = ["active", "inactive", "archived"];
const INTENSITY_MAX = 5;
const MAX_PROJECT_HISTORY = 200;
const DEFAULT_PROJECTS_FOLDER = "Projects";
const DEFAULT_DOMAINS_FOLDER = "Domains";
const DEFAULT_DROP_TITLE = "New block";

/** The guided tour's copy. Original text: no Kairos prose is reused. */
const TIME_BLOCK_TOUR = [
  { title: "Start in Day", body: "Time blocks opens on Day. A block owns a span of time and the work you put inside it lives as tasks." },
  { title: "Draw a block", body: "Press empty timeline space and drag down, with a mouse or a finger. Times snap to 15 minutes; release to create the block." },
  { title: "Move and resize", body: "Drag a block to shift it, or drag its bottom edge to make it longer or shorter. In Week, drag a block onto another day to move it there." },
  { title: "Cycle a task", body: "Click a task box to move it through open, half-done and done. Right-click, or long-press on touch, to cancel it instead." },
  { title: "Let routines help", body: "A routine is an offer, not an automatic write. Add the day's missing routines, and regenerate the day when its plan changes." },
  { title: "Park work in the Backlog", body: "Put an intention in the Backlog, then place it on a date. Open study tasks you already have appear there too." },
  { title: "Keep it as Markdown", body: "Write the day's Schedule, Routines.md, Backlog.md or project files. They stay plain Markdown and YAML that you can edit by hand." },
];

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

/** A `#rrggbb` colour, or an empty string when the value is not usable. */
function normalizeColor(value) {
  const color = str(value).trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : "";
}

function subjectColorKey(value) {
  return str(value).trim().toLowerCase().slice(0, MAX_TITLE);
}

/** Explicit subject/course colours, bounded and keyed case-insensitively. */
function normalizeSubjectColors(value) {
  const source = objectValue(value);
  const colors = {};
  let count = 0;
  for (const [rawKey, rawColor] of Object.entries(source)) {
    const key = subjectColorKey(rawKey);
    const color = normalizeColor(rawColor);
    if (!key || !color || key in colors) continue;
    colors[key] = color;
    count += 1;
    if (count >= SUBJECT_COLOR_LIMIT) break;
  }
  return colors;
}

/** A block's own course colour wins, then its project's colour, then nothing. */
function subjectColorFor(block, subjectColors, projects) {
  const colors = objectValue(subjectColors);
  const key = subjectColorKey(block && block.course);
  if (key && colors[key]) return colors[key];
  const projectId = str(block && block.projectId).trim();
  if (projectId) {
    for (const project of Array.isArray(projects) ? projects : []) {
      if (project && project.id === projectId && project.color) return project.color;
    }
  }
  return "";
}

/** Every course a block names, with its colour, block count and planned minutes. */
function subjectColorRows(blocks, subjectColors, projects) {
  const colors = objectValue(subjectColors);
  const rows = new Map();
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const course = boundedText(block && block.course, MAX_TITLE);
    if (!course) continue;
    const key = subjectColorKey(course);
    const row = rows.get(key) || { course, color: colors[key] || "", blocks: 0, minutes: 0 };
    row.blocks += 1;
    row.minutes += durationMinutes(block);
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.course.localeCompare(b.course));
}

function normalizeTag(value) {
  const tag = str(value).trim().replace(/^#+/, "").toLowerCase().slice(0, MAX_TAG_LENGTH);
  return /^[a-z0-9][a-z0-9/_-]*$/.test(tag) ? tag : "";
}

/** Up to six hash-free tags from an array or a comma/space separated string. */
function normalizeBlockTags(value) {
  const list = Array.isArray(value) ? value : str(value).split(/[,\s]+/);
  const tags = [];
  for (const item of list) {
    const tag = normalizeTag(item);
    if (!tag || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

function normalizeTaskStatus(value, done) {
  const status = str(value).trim().toLowerCase();
  if (TASK_STATUSES.includes(status)) return status;
  return done === true ? "done" : "open";
}

function statusChar(status) {
  if (status === "done") return "x";
  if (status === "half") return "/";
  if (status === "cancelled") return "-";
  return " ";
}

function statusFromChar(value) {
  const char = str(value);
  if (char === "x" || char === "X") return "done";
  if (char === "/") return "half";
  if (char === "-") return "cancelled";
  return "open";
}

function normalizeBlockTask(value, createdAt) {
  const source = objectValue(value);
  const title = boundedText(source.title, MAX_TITLE);
  if (!title) return null;
  const status = normalizeTaskStatus(source.status, source.done);
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("tbt", [title, source.studyTaskId || "", createdAt || 0]),
    title,
    done: status === "done",
    status,
    projectId: boundedText(source.projectId, 160),
    tag: boundedText(source.tag, MAX_TITLE),
    studyTaskId: boundedText(source.studyTaskId, 160),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, createdAt || 0))),
  };
}

function normalizeTimeBlock(value) {
  const source = objectValue(value);
  const title = boundedText(source.title, MAX_TITLE);
  const date = dayValue(source.date);
  const untimed = source.untimed === true;
  const start = untimed ? "" : normalizeTime(source.start);
  const end = untimed ? "" : normalizeTime(source.end);
  if (!title || !date) return null;
  if (!untimed && (!start || !end || minutesOf(end) <= minutesOf(start))) return null;
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
  const projectId = boundedText(source.projectId, 160);
  const routineId = boundedText(source.routineId, 160);
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("tb", [date, start, end, title, source.createdAt || 0]),
    date,
    start,
    end,
    untimed,
    title,
    type: normalizeType(source.type),
    projectId,
    course: boundedText(source.course, MAX_TITLE),
    tags: normalizeBlockTags(source.tags),
    notes: boundedText(source.notes, MAX_TEXT),
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
    notesFolder: boundedText(source.notesFolder, 200) || "Time blocks",
    dailyNoteFolder: boundedText(source.dailyNoteFolder, 200),
    scheduleHeading: normalizeScheduleHeading(source.scheduleHeading),
    backlogPath: boundedText(source.backlogPath, 200) || "Backlog.md",
    routinesPath: boundedText(source.routinesPath, 200) || "Routines.md",
    projectsFolder: boundedText(source.projectsFolder, 200) || DEFAULT_PROJECTS_FOLDER,
    domainsFolder: boundedText(source.domainsFolder, 200) || DEFAULT_DOMAINS_FOLDER,
    autoApplyRoutines: source.autoApplyRoutines === true,
    askAssocOnBlockCreate: source.askAssocOnBlockCreate === true,
    dropBlockTitle: boundedText(source.dropBlockTitle, MAX_TITLE) || DEFAULT_DROP_TITLE,
    subjectColors: normalizeSubjectColors(source.subjectColors),
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
  const name = boundedText(source.name, MAX_TITLE);
  if (!name) return null;
  const id = str(source.id).trim().slice(0, 160) || idFor("tbp", [name, source.kind || "project", source.createdAt || 0]);
  return {
    id,
    name,
    kind: normalizeProjectKind(source.kind),
    color: projectColor(source.color, id),
    course: boundedText(source.course, MAX_TITLE),
    statusHistory: normalizeProjectHistory(source.statusHistory),
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
  const title = boundedText(source.title, MAX_TITLE);
  const start = normalizeTime(source.start);
  const end = normalizeTime(source.end);
  const days = normalizeRoutineDays(source.days);
  const monthlyDay = Math.min(31, Math.max(0, Math.round(numberValue(source.monthlyDay, 0))));
  if (!title || !start || !end || minutesOf(end) <= minutesOf(start)) return null;
  if (!days.length && !monthlyDay) return null;
  const createdAt = Math.max(0, Math.round(numberValue(source.createdAt, 0)));
  const tasks = [];
  for (const raw of Array.isArray(source.tasks) ? source.tasks : []) {
    const task = normalizeBlockTask(raw, createdAt);
    if (task) tasks.push(task);
    if (tasks.length >= MAX_TASKS_PER_BLOCK) break;
  }
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("tbr", [title, start, end, days.join(""), monthlyDay, source.createdAt || 0]),
    title,
    days,
    monthlyDay,
    start,
    end,
    type: normalizeType(source.type),
    projectId: boundedText(source.projectId, 160),
    course: boundedText(source.course, MAX_TITLE),
    tasks,
    createdAt,
  };
}

/** Whether a routine is offered on a date: a weekday rule or a day of the month. */
function routineOccursOn(routine, date) {
  const key = dayValue(date);
  if (!routine || !key) return false;
  if (routine.monthlyDay) return Number(key.slice(8, 10)) === routine.monthlyDay;
  return Array.isArray(routine.days) && routine.days.includes(weekdayOf(key));
}

function createTimeRoutine(input, now) {
  const source = objectValue(input);
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  return normalizeTimeRoutine({ ...source, createdAt: source.createdAt || stamp });
}

function normalizeBacklogItem(value) {
  const source = objectValue(value);
  const title = boundedText(source.title, MAX_TITLE);
  if (!title) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("tbb", [title, source.projectId || "", source.createdAt || 0]),
    title,
    projectId: boundedText(source.projectId, 160),
    course: boundedText(source.course, MAX_TITLE),
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
    .sort((a, b) => (a.untimed ? 1 : 0) - (b.untimed ? 1 : 0) || a.start.localeCompare(b.start) || a.createdAt - b.createdAt);
}

/** Blocks carrying one tag; no tag means every block is returned unchanged. */
function blocksForTag(blocks, tag) {
  const wanted = normalizeTag(tag);
  const list = Array.isArray(blocks) ? blocks : [];
  if (!wanted) return list;
  return list.filter((block) => block && Array.isArray(block.tags) && block.tags.includes(wanted));
}

function tagSummary(blocks) {
  const rows = new Map();
  for (const block of Array.isArray(blocks) ? blocks : []) {
    for (const tag of Array.isArray(block && block.tags) ? block.tags : []) {
      const row = rows.get(tag) || { tag, blocks: 0, minutes: 0 };
      row.blocks += 1;
      row.minutes += durationMinutes(block);
      rows.set(tag, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.blocks - a.blocks || a.tag.localeCompare(b.tag));
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
      title: boundedText(event.summary, MAX_TITLE) || "Untitled event",
      start,
      end,
      allDay,
      location: boundedText(event.location, MAX_TITLE),
      course: boundedText(event.course || (event.details && event.details.subject), MAX_TITLE),
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
    const title = boundedText(match[3], MAX_TITLE);
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
    const tags = block.tags.map((value) => ` #${value}`).join("");
    lines.push(`- ${block.start} - ${block.end} ${block.title}${tag}${tags}`);
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
  const existing = new Set(
    (Array.isArray(blocks) ? blocks : [])
      .filter((block) => block && block.date === key && block.routineId)
      .map((block) => block.routineId)
  );
  const created = [];
  for (const routine of Array.isArray(routines) ? routines : []) {
    if (!routine || !routineOccursOn(routine, key) || existing.has(routine.id)) continue;
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
        tasks: routine.tasks,
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
  for (const project of Array.isArray(projects) ? projects : []) {
    const record = effectiveProjectRecord(project.statusHistory, end);
    rows.push({
      id: project.id,
      name: project.name,
      kind: project.kind,
      color: project.color,
      status: record.status,
      intensity: record.status === "active" ? record.intensity : null,
      minutes: 0,
      byDay: {},
    });
  }
  rows.push({ id: "", name: "Unassigned", kind: "domain", color: "#8a8a8a", status: "", intensity: null, minutes: 0, byDay: {} });
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

// ── Kairos-compatible markdown, carry-over and routine rules ────────────────
// Original implementation of the behaviours Kairos documents: a "## Schedule"
// section, Backlog.md and Routines.md, task statuses, routine rules and
// carry-over of unfinished tasks. No Kairos code, styles or copy is used.

function stripFrontmatter(markdown) {
  return str(markdown).replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
}

/** Lines under a markdown heading, stopping at the next heading of the same level. */
function sectionLines(markdown, heading) {
  const wanted = str(heading).trim() || DEFAULT_SCHEDULE_HEADING;
  const wantedText = wanted.replace(/^#+\s*/, "").toLowerCase();
  const lines = stripFrontmatter(markdown).split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.*)$/.exec(lines[index].trim());
    if (!match) continue;
    if (match[2].trim().toLowerCase() === wantedText) {
      start = index;
      level = match[1].length;
      break;
    }
  }
  if (start < 0) return [];
  const out = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[index].trim());
    if (match && match[1].length <= level) break;
    out.push(lines[index]);
  }
  return out;
}

function parseClock(value, allowMidnight) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(str(value).trim());
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59) return "";
  if (hour === 24 && minute === 0 && allowMidnight) return "24:00";
  if (hour > 23) return "";
  return `${pad(hour)}:${pad(minute)}`;
}

function findProjectByName(projects, name, kind) {
  const wanted = str(name).trim().toLowerCase();
  if (!wanted) return null;
  const list = Array.isArray(projects) ? projects : [];
  return list.find((project) => project && project.kind === kind && str(project.name).toLowerCase() === wanted)
    || list.find((project) => project && str(project.name).toLowerCase() === wanted)
    || null;
}

function parseAssocTag(token, projects) {
  const text = str(token).trim();
  if (!text) return null;
  const domain = /^d\s*:\s*(.+)$/i.exec(text);
  const name = (domain ? domain[1] : text).trim();
  if (!name) return null;
  const kind = domain ? "domain" : "project";
  const project = findProjectByName(projects, name, kind);
  return { kind, name, projectId: project ? project.id : "" };
}

/** Strip a trailing `(tag)`, then any trailing `[Project]` / `[D:Domain]` tags. */
function splitTrailingMetadata(body) {
  let title = str(body).trim();
  let tag = "";
  const assocs = [];
  const paren = /\s*\(([^()]{0,80})\)\s*$/.exec(title);
  if (paren) {
    tag = paren[1].trim();
    title = title.slice(0, paren.index).trim();
  }
  for (;;) {
    const match = /\s*\[([^\]]+)\]\s*$/.exec(title);
    if (!match) break;
    const inner = match[1].trim();
    if (!inner) break;
    assocs.unshift(inner);
    title = title.slice(0, match.index).trim();
  }
  const assoc = assocs.length ? assocs[assocs.length - 1] : "";
  return { title, tag, assoc };
}

/**
 * Parse the `## Schedule` section of a daily note into block drafts.
 * Supports Block/Task/Note lines, `- Unscheduled`, statuses, associations and
 * the legacy single-line checkbox forms.
 */
function parseScheduleMarkdown(markdown, options) {
  const opts = objectValue(options);
  const projects = Array.isArray(opts.projects) ? opts.projects : [];
  const drafts = [];
  let current = null;
  for (const raw of sectionLines(markdown, opts.heading)) {
    const line = raw.replace(/\t/g, "  ");
    if (!line.trim()) continue;
    const item = /^(\s*)[-*+]\s+(?:\[(.)\]\s+)?(.*)$/.exec(line);
    if (!item) continue;
    const indent = item[1].length;
    const status = item[2] ? statusFromChar(item[2]) : "";
    const meta = splitTrailingMetadata(item[3]);
    const assoc = meta.assoc ? parseAssocTag(meta.assoc, projects) : null;
    if (indent > 0 && current) {
      if (item[2]) current.tasks.push({ title: meta.title, status, tag: meta.tag, assoc });
      else if (meta.title) current.notes.push(meta.tag ? `${meta.title} (${meta.tag})` : meta.title);
      continue;
    }
    const range = /^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s+(.*)$/.exec(meta.title);
    if (!item[2] && /^unscheduled$/i.test(meta.title)) {
      current = { title: UNSCHEDULED_TITLE, start: "", end: "", untimed: true, assoc: null, tag: "", tasks: [], notes: [] };
      drafts.push(current);
      continue;
    }
    if (item[2] && !range) {
      if (!current || !current.untimed) {
        current = { title: UNSCHEDULED_TITLE, start: "", end: "", untimed: true, assoc: null, tag: "", tasks: [], notes: [] };
        drafts.push(current);
      }
      current.tasks.push({ title: meta.title, status, tag: meta.tag, assoc });
      continue;
    }
    if (range) {
      const start = parseClock(range[1]);
      const end = parseClock(range[2], true);
      if (!range[3] || !start || !end) continue;
      current = {
        title: range[3],
        start,
        end,
        untimed: false,
        assoc: meta.assoc ? parseAssocTag(meta.assoc, projects) : null,
        tag: meta.tag,
        tasks: [],
        notes: [],
      };
      drafts.push(current);
      if (item[2]) current.tasks.push({ title: range[3], status, tag: "", assoc: null });
      continue;
    }
    if (!meta.title) continue;
    current = { title: meta.title, start: "", end: "", untimed: true, assoc, tag: meta.tag, tasks: [], notes: [] };
    drafts.push(current);
  }
  return drafts;
}

function associationTag(projectId, projects) {
  const project = (Array.isArray(projects) ? projects : []).find((row) => row && row.id === projectId);
  if (!project) return "";
  return project.kind === "domain" ? `[D:${project.name}]` : `[${project.name}]`;
}

function taskLine(task) {
  let line = `\t- [${statusChar(normalizeTaskStatus(task.status, task.done))}] ${task.title}`;
  if (task.projectId) {
    const tag = associationTag(task.projectId, task.projects);
    if (tag && task.projectId !== task.blockProjectId) line += ` ${tag}`;
  }
  if (task.tag) line += ` (${task.tag})`;
  return line;
}

/** Serialize blocks into a complete Schedule section, heading included. */
function scheduleMarkdown(blocks, options) {
  const opts = objectValue(options);
  const projects = Array.isArray(opts.projects) ? opts.projects : [];
  const heading = str(opts.heading).trim() || DEFAULT_SCHEDULE_HEADING;
  const lines = [heading, ""];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!block || !block.title) continue;
    let line = "- ";
    if (!block.untimed && block.start && block.end) line += `${block.start} - ${block.end === "23:59" ? "24:00" : block.end} `;
    line += block.title;
    const tag = associationTag(block.projectId, projects);
    if (tag) line += ` ${tag}`;
    if (Array.isArray(block.tags) && block.tags.length) line += ` (${block.tags[0]})`;
    lines.push(line);
    for (const task of Array.isArray(block.tasks) ? block.tasks : []) {
      lines.push(taskLine({ ...task, projects, blockProjectId: block.projectId }));
    }
    for (const note of str(block.notes).split("\n").map((row) => row.trim()).filter(Boolean)) {
      lines.push(`\t- ${note}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

/** Resolve parsed drafts into stored blocks, creating missing projects/domains. */
function timeBlocksFromSchedule(drafts, date, projects, now) {
  const key = dayValue(date);
  const pool = (Array.isArray(projects) ? projects : []).slice();
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  const resolve = (assoc) => {
    if (!assoc || !assoc.name) return "";
    let project = findProjectByName(pool, assoc.name, assoc.kind);
    if (!project) {
      project = createTimeProject({ name: assoc.name, kind: assoc.kind }, stamp + pool.length);
      if (project) pool.push(project);
    }
    return project ? project.id : "";
  };
  const blocks = [];
  for (const draft of Array.isArray(drafts) ? drafts : []) {
    const tasks = (Array.isArray(draft.tasks) ? draft.tasks : []).map((task, index) => ({
      title: task.title,
      status: task.status,
      tag: task.tag,
      projectId: resolve(task.assoc),
      createdAt: stamp + index,
    }));
    const block = createTimeBlock({
      date: key,
      start: draft.untimed ? "" : draft.start === "24:00" ? "23:59" : draft.start,
      end: draft.untimed ? "" : draft.end === "24:00" ? "23:59" : draft.end,
      untimed: draft.untimed === true,
      title: draft.title,
      projectId: resolve(draft.assoc),
      tags: draft.tag ? [draft.tag] : [],
      tasks,
    }, stamp + blocks.length);
    if (block) blocks.push(block);
  }
  return { blocks, projects: pool };
}

function parseBacklogMarkdown(markdown, options) {
  const opts = objectValue(options);
  const projects = Array.isArray(opts.projects) ? opts.projects : [];
  const items = [];
  for (const line of stripFrontmatter(markdown).split(/\r?\n/)) {
    const item = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (!item) continue;
    let body = item[1].trim();
    let resurface = "";
    const due = /📅\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(body);
    if (due) {
      resurface = dayValue(due[1]);
      body = body.slice(0, due.index).trim();
    }
    const meta = splitTrailingMetadata(body);
    const assoc = meta.assoc ? parseAssocTag(meta.assoc, projects) : null;
    const entry = createBacklogItem({ title: meta.title, resurface, projectId: assoc ? resolveProjectId(assoc, projects) : "" });
    if (entry) items.push(entry);
  }
  return items;
}

function resolveProjectId(assoc, projects) {
  if (!assoc) return "";
  const project = findProjectByName(projects, assoc.name, assoc.kind);
  return project ? project.id : "";
}

function backlogMarkdown(items, options) {
  const opts = objectValue(options);
  const projects = Array.isArray(opts.projects) ? opts.projects : [];
  const lines = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || !item.title) continue;
    let line = `- ${item.title}`;
    const tag = associationTag(item.projectId, projects);
    if (tag) line += ` ${tag}`;
    if (item.resurface) line += ` 📅 ${item.resurface}`;
    lines.push(line);
  }
  return lines.length ? `${lines.join("\n")}\n` : "";
}

/** Backlog items whose resurface day has arrived, oldest first. */
function resurfacedBacklog(backlog, date) {
  const key = dayValue(date);
  if (!key) return [];
  return (Array.isArray(backlog) ? backlog : [])
    .filter((item) => item && item.resurface && item.resurface <= key)
    .sort((a, b) => a.resurface.localeCompare(b.resurface) || a.createdAt - b.createdAt);
}

/** A repeat rule from Routines.md: weekdays, or a day of the month. */
function parseRoutineRule(value) {
  const raw = str(value).toLowerCase().replace(/^every\s+/, "").replace(/[.!]+$/, "").trim();
  if (!raw) return null;
  const all = [0, 1, 2, 3, 4, 5, 6];
  if (/^(daily|day|each day)$/.test(raw)) return { days: all, monthlyDay: 0, label: "Daily" };
  if (/^weekdays?$/.test(raw) || /^monday\s*(?:to|[-–—])\s*friday$/.test(raw)) return { days: [1, 2, 3, 4, 5], monthlyDay: 0, label: "Weekdays" };
  if (/^weekends?$/.test(raw)) return { days: [0, 6], monthlyDay: 0, label: "Weekends" };
  const monthly = /^(?:monthly|month|every month)\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?$/.exec(raw);
  if (monthly) {
    const day = Number(monthly[1]);
    if (day >= 1 && day <= 31) return { days: [], monthlyDay: day, label: `Monthly on ${day}` };
    return null;
  }
  const parts = raw.replace(/\band\b/g, ",").split(/[,/&]+/).map((part) => part.trim()).filter(Boolean);
  const days = [];
  for (const part of parts) {
    const name = part.replace(/s$/, "");
    const index = WEEKDAY_NAMES.findIndex((weekday) => weekday.toLowerCase() === name.slice(0, 3));
    if (index < 0) return null;
    if (!days.includes(index)) days.push(index);
  }
  if (!days.length) return null;
  days.sort((a, b) => a - b);
  return { days, monthlyDay: 0, label: days.map((day) => WEEKDAY_NAMES[day]).join(", ") };
}

function routineRuleLabel(routine) {
  if (routine.monthlyDay) return `Monthly on ${routine.monthlyDay}`;
  const days = Array.isArray(routine.days) ? routine.days : [];
  if (days.length === 7) return "Daily";
  if (days.length === 5 && days.every((day) => day >= 1 && day <= 5)) return "Weekdays";
  if (days.length === 2 && days.includes(0) && days.includes(6)) return "Weekends";
  return days.map((day) => WEEKDAY_NAMES[day]).join(", ");
}

/** Parse Routines.md into timed block routines with their nested tasks. */
function parseRoutinesMarkdown(markdown, options) {
  const opts = objectValue(options);
  const projects = Array.isArray(opts.projects) ? opts.projects : [];
  const routines = [];
  const unread = [];
  let headingRule = null;
  let current = null;
  const flush = () => {
    if (!current) return;
    if (!current.start || !current.end || !current.rule) {
      unread.push(current.title);
    } else {
      const routine = createTimeRoutine({
        title: current.title,
        start: current.start,
        end: current.end,
        days: current.rule.days,
        monthlyDay: current.rule.monthlyDay,
        projectId: resolveProjectId(current.assoc, projects),
        tasks: current.tasks,
      });
      if (routine) routines.push(routine);
      else unread.push(current.title);
    }
    current = null;
  };
  for (const raw of stripFrontmatter(markdown).split(/\r?\n/)) {
    const line = raw.replace(/\t/g, "  ");
    const heading = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (heading) {
      flush();
      headingRule = parseRoutineRule(heading[2]);
      continue;
    }
    const item = /^(\s*)[-*+]\s+(?:\[(.)\]\s+)?(.*)$/.exec(line);
    if (!item) continue;
    if (item[1].length > 0 && current) {
      if (item[2]) current.tasks.push({ title: splitTrailingMetadata(item[3]).title, status: statusFromChar(item[2]) });
      continue;
    }
    if (item[1].length > 0) continue;
    flush();
    let body = item[3].trim();
    let rule = headingRule;
    const repeat = /\s*🔁\s*(.+)$/.exec(body);
    if (repeat) {
      rule = parseRoutineRule(repeat[1]) || rule;
      body = body.slice(0, repeat.index).trim();
    }
    const range = /^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s+(.*)$/.exec(body);
    if (!range) continue;
    const meta = splitTrailingMetadata(range[3]);
    current = {
      title: meta.title,
      start: parseClock(range[1]),
      end: parseClock(range[2], true),
      assoc: meta.assoc ? parseAssocTag(meta.assoc, projects) : null,
      rule,
      tasks: [],
    };
  }
  flush();
  return { routines, unread };
}

function routinesMarkdown(routines, options) {
  const opts = objectValue(options);
  const projects = Array.isArray(opts.projects) ? opts.projects : [];
  const groups = new Map();
  for (const routine of Array.isArray(routines) ? routines : []) {
    if (!routine || !routine.title) continue;
    const label = routineRuleLabel(routine);
    if (!label) continue;
    const rows = groups.get(label) || [];
    rows.push(routine);
    groups.set(label, rows);
  }
  const lines = [];
  for (const [label, rows] of groups) {
    lines.push(`## ${label}`, "");
    for (const routine of rows) {
      let line = `- ${routine.start} - ${routine.end} ${routine.title}`;
      const tag = associationTag(routine.projectId, projects);
      if (tag) line += ` ${tag}`;
      lines.push(line);
      for (const task of Array.isArray(routine.tasks) ? routine.tasks : []) {
        lines.push(`\t- [${statusChar(normalizeTaskStatus(task.status, task.done))}] ${task.title}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}

/** Open and half-done tasks from earlier blocks that a day does not already have. */
function blockLeftovers(fromBlocks, toBlocks) {
  const present = new Set();
  for (const block of Array.isArray(toBlocks) ? toBlocks : []) {
    for (const task of block.tasks || []) present.add(`${task.title.toLowerCase()}|${task.projectId || block.projectId}`);
  }
  const rows = [];
  for (const block of Array.isArray(fromBlocks) ? fromBlocks : []) {
    for (const task of block.tasks || []) {
      const status = normalizeTaskStatus(task.status, task.done);
      if (status !== "open" && status !== "half") continue;
      const projectId = task.projectId || block.projectId;
      if (present.has(`${task.title.toLowerCase()}|${projectId}`)) continue;
      rows.push({ blockId: block.id, taskId: task.id, title: task.title, status, projectId, tag: task.tag || "" });
    }
  }
  return rows;
}

/**
 * Move chosen open/half tasks out of one day's blocks into the target day's
 * Unscheduled block. Association is written onto the task as it moves, so a
 * task that inherited its block's project keeps it.
 */
function carryOverTasks(fromBlocks, toBlocks, picks, date, now) {
  const stamp = Math.max(0, Math.round(numberValue(now, Date.now())));
  const wanted = new Set(
    (Array.isArray(picks) ? picks : blockLeftovers(fromBlocks, toBlocks)).map((pick) => `${pick.blockId}|${pick.taskId}`)
  );
  const to = (Array.isArray(toBlocks) ? toBlocks : []).slice();
  let target = to.find((block) => block && block.untimed);
  if (!target) {
    target = createTimeBlock({ date: dayValue(date), untimed: true, title: UNSCHEDULED_TITLE }, stamp);
    if (target) to.push(target);
  }
  if (!target) return { from: Array.isArray(fromBlocks) ? fromBlocks : [], to, moved: 0 };
  const from = [];
  const moved = [];
  for (const block of Array.isArray(fromBlocks) ? fromBlocks : []) {
    const tasks = [];
    for (const task of block.tasks || []) {
      const status = normalizeTaskStatus(task.status, task.done);
      const key = `${block.id}|${task.id}`;
      const carries = (status === "open" || status === "half") && wanted.has(key);
      if (!carries) {
        tasks.push(task);
        continue;
      }
      const projectId = task.projectId || block.projectId;
      const copy = normalizeBlockTask({ ...task, status, projectId }, stamp + moved.length);
      if (!copy || target.tasks.length >= MAX_TASKS_PER_BLOCK) {
        tasks.push(task);
        continue;
      }
      target.tasks.push({ ...copy, id: idFor("tbt", [copy.title, projectId, stamp, moved.length]) });
      moved.push(copy);
    }
    from.push({ ...block, tasks });
  }
  return { from, to, moved: moved.length };
}

/** Remove a day's routine blocks, then offer the routines again. */
function regenerateRoutines(routines, blocks, date, now) {
  const key = dayValue(date);
  if (!key) return { blocks: Array.isArray(blocks) ? blocks : [], created: [], removed: 0 };
  const kept = (Array.isArray(blocks) ? blocks : []).filter((block) => !(block && block.date === key && block.routineId));
  const applied = applyRoutines(routines, kept, key, now);
  return { blocks: applied.blocks, created: applied.created, removed: (Array.isArray(blocks) ? blocks.length : 0) - kept.length };
}

/**
 * Replace (or append) the Schedule section in a daily note, leaving every line
 * outside it untouched. `section` is a complete section, heading included.
 */
function replaceScheduleSection(markdown, section, heading) {
  const text = str(markdown);
  const wanted = str(heading).trim() || DEFAULT_SCHEDULE_HEADING;
  const wantedText = wanted.replace(/^#+\s*/, "").toLowerCase();
  const block = str(section).replace(/\s+$/, "") + "\n";
  const lines = text.split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.*)$/.exec(lines[index].trim());
    if (!match || match[2].trim().toLowerCase() !== wantedText) continue;
    start = index;
    level = match[1].length;
    break;
  }
  if (start < 0) {
    const before = text.replace(/\s+$/, "");
    return (before ? before + "\n\n" : "") + block;
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[index].trim());
    if (match && match[1].length <= level) {
      end = index;
      break;
    }
  }
  const before = lines.slice(0, start).join("\n");
  const after = lines.slice(end).join("\n");
  const body = (before ? before + "\n" : "") + block;
  return (after ? body + "\n" + after : body).replace(/\s+$/, "\n");
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


// ── Project status, project files, intensity, drag geometry and migration ────

/** A schedule heading in canonical "## Name" form. */
function normalizeScheduleHeading(value) {
  const name = str(value).trim().replace(/^#+\s*/, "").slice(0, 60);
  return name ? "## " + name : DEFAULT_SCHEDULE_HEADING;
}

function normalizeProjectStatus(value) {
  const status = str(value).trim().toLowerCase();
  return PROJECT_STATUSES.includes(status) ? status : "";
}

/** A whole number from 0 to 5, or undefined when the value is not a number. */
function coerceIntensity(value) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) return undefined;
  return Math.min(INTENSITY_MAX, Math.max(0, Math.round(number)));
}

function normalizeProjectStatusRecord(value) {
  const source = objectValue(value);
  const date = dayValue(source.date);
  const status = normalizeProjectStatus(source.status);
  if (!date || !status) return null;
  const intensity = coerceIntensity(source.intensity);
  return {
    date,
    status,
    ...(intensity !== undefined ? { intensity } : {}),
    note: boundedText(source.note, 500),
  };
}

/** Status records sorted by date, one per date, oldest first, bounded. */
function normalizeProjectHistory(value) {
  const rows = [];
  if (Array.isArray(value)) {
    for (const raw of value) {
      const row = normalizeProjectStatusRecord(raw);
      if (row) rows.push(row);
    }
  } else if (value && typeof value === "object") {
    for (const [key, raw] of Object.entries(value)) {
      const padded = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str(key).trim());
      const date = padded ? padded[1] + "-" + pad(padded[2]) + "-" + pad(padded[3]) : dayValue(key);
      if (!date) continue;
      const source = objectValue(raw);
      const row = normalizeProjectStatusRecord({
        date,
        status: typeof raw === "string" ? raw : source.status,
        intensity: typeof raw === "string" ? undefined : source.intensity,
        note: typeof raw === "string" ? "" : source.note,
      });
      if (row) rows.push(row);
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const unique = [];
  for (const row of rows) {
    const at = unique.findIndex((item) => item.date === row.date);
    if (at >= 0) unique[at] = row;
    else unique.push(row);
  }
  return unique.slice(-MAX_PROJECT_HISTORY);
}

/** The record in effect on a date: the last one dated on or before it. */
function effectiveProjectRecord(history, date) {
  const key = dayValue(date) || todayValue();
  let found = null;
  for (const row of normalizeProjectHistory(history)) {
    if (row.date <= key) found = row;
  }
  return found || { date: "", status: "active", note: "" };
}

/** The 0-5 intensity of an active project on a date, or null. */
function projectIntensity(project, date) {
  const record = effectiveProjectRecord(project && project.statusHistory, date);
  return record.status === "active" && record.intensity !== undefined ? record.intensity : null;
}

/** Add or replace the record for one date. */
function appendProjectStatus(history, record) {
  const row = normalizeProjectStatusRecord(record);
  if (!row) return normalizeProjectHistory(history);
  return normalizeProjectHistory(normalizeProjectHistory(history).filter((item) => item.date !== row.date).concat([row]));
}

/** A whole day's block minutes as a 0-5 intensity level. */
function intensityLevel(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return 0;
  if (value < 60) return 1;
  if (value < 120) return 2;
  if (value < 180) return 3;
  if (value < 240) return 4;
  return 5;
}

/** One {date, minutes, level} row per date, in the order given. */
function intensityByDay(blocks, dates) {
  return (Array.isArray(dates) ? dates : []).map((date) => {
    const key = dayValue(date);
    const minutes = key ? blocksForDate(blocks, key).reduce((sum, block) => sum + durationMinutes(block), 0) : 0;
    return { date: key, minutes, level: intensityLevel(minutes) };
  });
}

/** Project markdown: frontmatter beside the user's untouched body. */
function projectMarkdown(project, options) {
  const value = normalizeTimeProject(project);
  if (!value) return "";
  const settings = objectValue(options);
  const lines = ["---", "tags:", "  - " + (value.kind === "domain" ? "mcq/domain" : "mcq/project"), "id: " + value.id, "color: " + value.color];
  if (value.course) lines.push("course: " + value.course);
  if (value.statusHistory.length) {
    lines.push("status:");
    for (const row of value.statusHistory) {
      const fields = [row.status];
      if (row.intensity !== undefined) fields.push("intensity: " + row.intensity);
      if (row.note) fields.push('note: "' + row.note.replace(/"/g, '\\"') + '"');
      lines.push("  " + row.date + ": " + (fields.length > 1 ? "{ " + fields.join(", ") + " }" : row.status));
    }
  }
  lines.push("---", "");
  const body = boundedText(settings.body, MAX_TEXT);
  return lines.join("\n") + (body ? body + "\n" : "# " + value.name + "\n");
}

/** Read a project/domain file's frontmatter; null when it is not one. */
function parseProjectMarkdown(markdown, path) {
  const value = str(markdown);
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(value);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const tags = [];
  let id = "";
  let color = "";
  let course = "";
  let statusMode = false;
  let tagsMode = false;
  const history = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^tags\s*:/.test(trimmed)) {
      const inline = trimmed.replace(/^tags\s*:/, "").trim().replace(/^\[|\]$/g, "");
      for (const raw of inline.split(/[,\s]+/)) {
        const tag = raw.replace(/^["']|["']$/g, "").trim();
        if (tag) tags.push(tag);
      }
      tagsMode = !inline;
      statusMode = false;
      continue;
    }
    if (tagsMode && /^\s+-\s+/.test(line)) {
      const tag = trimmed.replace(/^-\s+/, "").trim();
      if (tag) tags.push(tag);
      continue;
    }
    if (tagsMode && !/^\s/.test(line)) tagsMode = false;
    if (/^id\s*:/.test(trimmed)) {
      id = trimmed.replace(/^id\s*:/, "").trim();
      statusMode = false;
      tagsMode = false;
      continue;
    }
    if (/^color\s*:/.test(trimmed)) {
      color = normalizeColor(trimmed.replace(/^color\s*:/, "").trim());
      statusMode = false;
      tagsMode = false;
      continue;
    }
    if (/^course\s*:/.test(trimmed)) {
      course = boundedText(trimmed.replace(/^course\s*:/, ""), MAX_TITLE);
      statusMode = false;
      tagsMode = false;
      continue;
    }
    if (/^status\s*:/.test(trimmed)) {
      statusMode = true;
      tagsMode = false;
      continue;
    }
    if (!statusMode) continue;
    const entry = /^\s+(\d{4}-\d{1,2}-\d{1,2})\s*:\s*(.+)$/.exec(line);
    if (!entry) {
      if (!/^\s/.test(line)) statusMode = false;
      continue;
    }
    const padded = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(entry[1]);
    const raw = entry[2].trim();
    const object = /^\{(.*)\}$/.exec(raw);
    let status = raw;
    let intensity;
    let note = "";
    if (object) {
      status = "";
      for (const part of object[1].split(",")) {
        const colon = part.indexOf(":");
        if (colon < 0) {
          if (!status) status = part.trim();
          continue;
        }
        const field = part.slice(0, colon).trim().toLowerCase();
        const fieldValue = part.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
        if (field === "status") status = fieldValue;
        else if (field === "intensity") intensity = fieldValue;
        else if (field === "note") note = fieldValue;
      }
    }
    const row = normalizeProjectStatusRecord({
      date: padded ? padded[1] + "-" + pad(padded[2]) + "-" + pad(padded[3]) : entry[1],
      status,
      intensity,
      note,
    });
    if (row) history.push(row);
  }
  const tagged = tags.some((tag) => tag === "mcq/project" || tag === "mcq/domain" || tag === "kairos/project" || tag === "kairos/domain");
  if (!tagged) return null;
  const base = str(path).replace(/\\/g, "/").split("/").pop().replace(/\.md$/i, "");
  const heading = /^#\s+(.+)$/m.exec(stripFrontmatter(value));
  return {
    name: boundedText(heading ? heading[1] : base, MAX_TITLE),
    kind: tags.some((tag) => tag === "mcq/domain" || tag === "kairos/domain") ? "domain" : "project",
    id,
    color,
    course,
    statusHistory: normalizeProjectHistory(history),
  };
}

/** Replace only a file's frontmatter fence, keeping its body byte for byte. */
function replaceProjectFrontmatter(markdown, fence) {
  const value = str(markdown);
  const block = str(fence).replace(/\s+$/, "") + "\n";
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(value);
  if (!match) return block + (value.startsWith("\n") ? "" : "\n") + value;
  return block + "\n" + value.slice(match[0].length).replace(/^\r?\n/, "");
}

/** Vault path for a project or domain file, sanitised for a vault path. */
function projectFilePath(project, settings) {
  const value = normalizeTimeProject(project);
  if (!value) return "";
  const source = objectValue(settings);
  const folder = value.kind === "domain" ? boundedText(source.domainsFolder, 200) || DEFAULT_DOMAINS_FOLDER : boundedText(source.projectsFolder, 200) || DEFAULT_PROJECTS_FOLDER;
  const name = value.name.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim() || "Project";
  return folder ? folder + "/" + name + ".md" : name + ".md";
}

/** Round to a step and keep the value inside one day. */
function snapMinutes(value, step) {
  const size = Math.max(1, Math.round(Number(step) || 15));
  const minutes = Math.max(0, Math.min(1440, Math.round(Number(value) || 0)));
  return Math.min(1440, Math.round(minutes / size) * size);
}

/** Shift a timed block by whole minutes without changing its length. */
function shiftBlockTimes(block, deltaMinutes) {
  const start = minutesOf(block && block.start);
  const end = minutesOf(block && block.end);
  const span = end - start;
  if (start < 0 || span <= 0 || span >= 1440) return null;
  const next = Math.max(0, Math.min(1440 - span, start + Math.round(Number(deltaMinutes) || 0)));
  return { start: timeFromMinutes(next), end: timeFromMinutes(next + span) };
}

/** Move one edge of a timed block, keeping at least 15 minutes. */
function resizeBlockTimes(block, edge, deltaMinutes) {
  const start = minutesOf(block && block.start);
  const end = minutesOf(block && block.end);
  if (start < 0 || end <= start) return null;
  const delta = Math.round(Number(deltaMinutes) || 0);
  if (edge === "start") {
    const next = Math.max(0, Math.min(end - 15, start + delta));
    return { start: timeFromMinutes(next), end: timeFromMinutes(end) };
  }
  const next = Math.max(start + 15, Math.min(1440, end + delta));
  return { start: timeFromMinutes(start), end: timeFromMinutes(next) };
}

/** A dragged range: ordered, snapped and at least 15 minutes long. */
function timeRangeFromDrag(a, b, step) {
  const size = Math.max(1, Math.round(Number(step) || 15));
  let start = snapMinutes(Math.min(Number(a) || 0, Number(b) || 0), size);
  let end = snapMinutes(Math.max(Number(a) || 0, Number(b) || 0), size);
  if (start >= 1440) start = 1440 - size;
  if (end - start < size) end = Math.min(1440, start + size);
  return { start: timeFromMinutes(start), end: timeFromMinutes(Math.min(1439, end)) };
}

/** open → half-done → done → open. Cancelling is a separate action. */
function nextTaskStatus(value) {
  const status = normalizeTaskStatus(value, false);
  if (status === "open") return "half";
  if (status === "half") return "done";
  return "open";
}

/**
 * Map a Kairos data.json to the fields this planner shares. Unknown keys are
 * ignored and nothing is written; the caller normalises the merged object.
 */
function kairosSettingsPatch(value) {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const patch = {};
  const hour = (number) => {
    const value = Math.round(Number(number));
    return Number.isFinite(value) ? pad(Math.max(0, Math.min(23, value))) + ":00" : "";
  };
  const start = hour(raw.timelineStartHour);
  const end = hour(raw.timelineEndHour);
  if (start) patch.dayStart = start;
  if (end) patch.dayEnd = end;
  if (patch.dayStart && patch.dayEnd && minutesOf(patch.dayEnd) <= minutesOf(patch.dayStart)) {
    patch.dayEnd = timeFromMinutes(Math.min(1439, minutesOf(patch.dayStart) + 60));
  }
  if (raw.scheduleHeading) patch.scheduleHeading = normalizeScheduleHeading(raw.scheduleHeading);
  for (const [from, to] of [
    ["backlogPath", "backlogPath"],
    ["routinesPath", "routinesPath"],
    ["projectsFolder", "projectsFolder"],
    ["domainsFolder", "domainsFolder"],
    ["dailyNoteFolder", "dailyNoteFolder"],
    ["dailyNotesFolder", "dailyNoteFolder"],
    ["notesFolder", "notesFolder"],
    ["dropBlockTitle", "dropBlockTitle"],
  ]) {
    const text = boundedText(raw[from], 200);
    if (text) patch[to] = text;
  }
  if (typeof raw.autoApplyRoutines === "boolean") patch.autoApplyRoutines = raw.autoApplyRoutines;
  if (typeof raw.askAssocOnBlockCreate === "boolean") patch.askAssocOnBlockCreate = raw.askAssocOnBlockCreate;
  return patch;
}

module.exports = {
  MAX_BACKLOG,
  MAX_BLOCKS,
  MAX_PROJECTS,
  MAX_ROUTINES,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MAX_TASKS_PER_BLOCK,
  TASK_STATUSES,
  UNSCHEDULED_TITLE,
  DEFAULT_SCHEDULE_HEADING,
  PROJECT_COLORS,
  PROJECT_KINDS,
  SUBJECT_COLOR_LIMIT,
  TIME_BLOCK_TYPES,
  TIME_BLOCK_VIEWS,
  WEEKDAY_NAMES,
  addDays,
  appendProjectStatus,
  INTENSITY_MAX,
  MAX_PROJECT_HISTORY,
  PROJECT_STATUSES,
  DEFAULT_PROJECTS_FOLDER,
  DEFAULT_DOMAINS_FOLDER,
  DEFAULT_DROP_TITLE,
  TIME_BLOCK_TOUR,
  coerceIntensity,
  effectiveProjectRecord,
  intensityByDay,
  intensityLevel,
  kairosSettingsPatch,
  nextTaskStatus,
  minutesOf,
  normalizeProjectHistory,
  normalizeProjectStatus,
  normalizeProjectStatusRecord,
  normalizeTaskStatus,
  normalizeScheduleHeading,
  parseProjectMarkdown,
  projectFilePath,
  projectIntensity,
  projectMarkdown,
  replaceProjectFrontmatter,
  resizeBlockTimes,
  shiftBlockTimes,
  snapMinutes,
  timeRangeFromDrag,
  applyRoutines,
  backlogMarkdown,
  blockLeftovers,
  blockSummary,
  blocksForDate,
  blocksForTag,
  blocksInRange,
  blocksToMarkdown,
  calendarDaySummary,
  calendarWeekSummary,
  carryOverTasks,
  createBacklogItem,
  dailyNotePath,
  createTimeBlock,
  createTimeProject,
  createTimeRoutine,
  dayValue,
  durationLabel,
  durationMinutes,
  normalizeBacklogItem,
  normalizeBlockTags,
  normalizeColor,
  normalizeSubjectColors,
  normalizeTag,
  normalizeTime,
  normalizeTimeBlock,
  normalizeTimeBlocks,
  normalizeTimeProject,
  normalizeTimeRoutine,
  normalizeTimeline,
  normalizeView,
  parseBacklogMarkdown,
  parseDailyNoteLines,
  parseRoutineRule,
  parseRoutinesMarkdown,
  parseScheduleMarkdown,
  projectMinutes,
  projectTimeline,
  regenerateRoutines,
  replaceScheduleSection,
  resurfacedBacklog,
  routineOccursOn,
  routinesMarkdown,
  scheduleMarkdown,
  startOfWeek,
  stripFrontmatter,
  subjectColorFor,
  subjectColorRows,
  tagSummary,
  timeBlocksFromSchedule,
  timeFromMinutes,
  todayValue,
  unscheduledStudyTasks,
  weekDates,
  weekSummary,
  weekdayOf,
};
