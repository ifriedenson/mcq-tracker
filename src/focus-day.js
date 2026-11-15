"use strict";
/*
 * Focus day: one pane that combines a small month calendar, the Pomodoro
 * timer and a quick session task list. Nothing here copies a community
 * plugin; the month math, daily-note handling and task rows are local.
 *
 * The calendar opens a `YYYY-MM-DD.md` daily note for any clicked day
 * (creating it from a starter template when it does not exist yet), the
 * timer reuses the Pomodoro settings and state, and the task list is a
 * deliberate scratchpad: it lives only for the session, like a slip of
 * paper, and never writes to a note.
 */
const { localDate, str } = require("./util");

const FOCUS_DAY_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FOCUS_DAY_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FOCUS_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const MAX_FOCUS_TASKS = 200;

/** A strict calendar date like 2026-11-15; rejects overflow such as month 13. */
function validFocusDateKey(value) {
  const key = str(value).trim();
  if (!FOCUS_DATE_RE.test(key)) return "";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return "";
  return key;
}

function focusTodayKey(now) {
  if (now instanceof Date && !isNaN(now.getTime())) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return localDate();
}

function focusDateKey(year, month, day) {
  const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return validFocusDateKey(key);
}

function shiftFocusMonth(year, month, delta) {
  const y = Number(year) || 0;
  const total = y * 12 + (Number(month) || 0) + (Number(delta) || 0);
  const nextYear = Math.floor(total / 12);
  const nextMonth = ((total % 12) + 12) % 12;
  return { year: nextYear, month: nextMonth };
}

function focusMonthLabel(year, month) {
  return `${FOCUS_DAY_MONTHS[month] || ""} ${year}`;
}

/*
 * One cell per grid position: leading blanks keep the Monday-first columns
 * aligned, then one cell per day with its date key and today flag.
 */
function focusMonthGrid(year, month, todayKey) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < leading; i++) cells.push({ blank: true, key: "", label: "", today: false });
  for (let day = 1; day <= daysInMonth; day++) {
    const key = focusDateKey(year, month, day);
    cells.push({ blank: false, key, label: String(day), today: key !== "" && key === todayKey });
  }
  return cells;
}

/** Daily-note path for a date key: the configured folder, else the vault root. Never escapes with `..`. */
function focusDailyNotePath(dateKey, folder) {
  const key = validFocusDateKey(dateKey);
  if (!key) return "";
  const clean = str(folder).trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return `${key}.md`;
  if (clean.split("/").some((part) => part === ".." || part === "")) return "";
  return `${clean}/${key}.md`;
}

/** Starter note: a dated heading plus a Schedule section the Time blocks sync can read. */
function focusDailyNoteTemplate(dateKey) {
  const key = validFocusDateKey(dateKey) || focusTodayKey();
  return `# ${key}\n\n## Schedule\n\n## Notes\n`;
}

function normalizeFocusTasks(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const row of value) {
    if (out.length >= MAX_FOCUS_TASKS) break;
    if (!row || typeof row !== "object") continue;
    const text = str(row.text).trim();
    if (!text) continue;
    out.push({ id: str(row.id) || `${Date.now()}-${out.length}`, text, done: row.done === true, due: validFocusDateKey(row.due) || "" });
  }
  return out;
}

function addFocusTask(tasks, text, id, due) {
  const clean = str(text).trim();
  if (!clean) return normalizeFocusTasks(tasks);
  const next = normalizeFocusTasks(tasks);
  if (next.length >= MAX_FOCUS_TASKS) return next;
  next.push({ id: str(id) || `${Date.now()}-${next.length}`, text: clean, done: false, due: validFocusDateKey(due) || "" });
  return next;
}

function toggleFocusTask(tasks, id) {
  const want = str(id);
  return normalizeFocusTasks(tasks).map((task) => (task.id === want ? { ...task, done: !task.done } : task));
}

function deleteFocusTask(tasks, id) {
  const want = str(id);
  return normalizeFocusTasks(tasks).filter((task) => task.id !== want);
}

module.exports = {
  FOCUS_DAY_MONTHS,
  FOCUS_DAY_WEEKDAYS,
  MAX_FOCUS_TASKS,
  addFocusTask,
  deleteFocusTask,
  focusDailyNotePath,
  focusDailyNoteTemplate,
  focusDateKey,
  focusMonthGrid,
  focusMonthLabel,
  focusTodayKey,
  normalizeFocusTasks,
  shiftFocusMonth,
  toggleFocusTask,
  validFocusDateKey,
};
