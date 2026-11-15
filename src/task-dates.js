"use strict";
/*
 * Natural-language due dates for task input: "Practice 8 AP World questions
 * today" gets today's date, "tomorrow" the next day, "Tuesday" the upcoming
 * Tuesday. Dependency-free and date-only: the parser returns YYYY-MM-DD and
 * the exact words it matched, so callers can strip them from the title.
 * Times of day are never read — a task keeps no time, only a due date.
 */
const { localDate, str } = require("./util");

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const WEEKDAY_ALIASES = {
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6,
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function keyOf(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(key));
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (date.getFullYear() !== Number(m[1]) || date.getMonth() !== Number(m[2]) - 1 || date.getDate() !== Number(m[3])) return null;
  return date;
}

/** Reference day as a Date: a Date, a YYYY-MM-DD key, or today. Time is ignored. */
function refDate(ref) {
  if (ref instanceof Date && !isNaN(ref.getTime())) return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const parsed = parseKey(ref);
  if (parsed) return parsed;
  const today = parseKey(localDate());
  return today || new Date(2026, 10, 15);
}

function shiftDays(base, n) {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  return keyOf(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function shiftMonths(base, n) {
  const total = base.getFullYear() * 12 + base.getMonth() + n;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const day = Math.min(base.getDate(), daysInMonth(year, month));
  return keyOf(year, month, day);
}

function weekdayIndex(name) {
  const clean = str(name).toLowerCase();
  const full = WEEKDAYS.indexOf(clean);
  if (full >= 0) return full;
  return WEEKDAY_ALIASES[clean] == null ? -1 : WEEKDAY_ALIASES[clean];
}

function monthIndex(name) {
  const clean = str(name).toLowerCase();
  const full = MONTHS.indexOf(clean);
  if (full >= 0) return full;
  const short = MONTHS.findIndex((month) => month.slice(0, 3) === clean.slice(0, 3) && clean.length >= 3);
  return short;
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WEEKDAY_NAMES = [...WEEKDAYS, ...Object.keys(WEEKDAY_ALIASES)].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
const MONTH_NAMES = [...MONTHS, ...MONTHS.map((month) => month.slice(0, 3))].map(escapeRe).join("|");

/*
 * Each rule returns { date, matched } or null. Rules run in order, so an
 * ISO date beats a weekday and "next Tuesday" beats a bare "Tuesday".
 */
function ruleIso(text, base) {
  const m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (!m) return null;
  const key = `${m[1]}-${m[2]}-${m[3]}`;
  if (!parseKey(key)) return null;
  return { date: key, matched: m[0] };
}

function ruleRelative(text, base) {
  const m = /\b(day after tomorrow|today|tonight|tomorrow|tmrw|tmr|yesterday)\b/i.exec(text);
  if (!m) return null;
  const word = m[1].toLowerCase();
  if (word === "today" || word === "tonight") return { date: shiftDays(base, 0), matched: m[0] };
  if (word === "tomorrow" || word === "tmr" || word === "tmrw") return { date: shiftDays(base, 1), matched: m[0] };
  if (word === "yesterday") return { date: shiftDays(base, -1), matched: m[0] };
  return { date: shiftDays(base, 2), matched: m[0] };
}

function ruleWeekend(text, base) {
  if (!/\b(weekend|this weekend)\b/i.test(text)) return null;
  const dow = base.getDay();
  const offset = dow === 0 || dow === 6 ? 0 : 6 - dow;
  const m = /\b(?:this\s+)?weekend\b/i.exec(text);
  return { date: shiftDays(base, offset), matched: m[0] };
}

function ruleNextSpan(text, base) {
  const m = /\bnext\s+(week|month)\b/i.exec(text);
  if (!m) return null;
  return { date: m[1].toLowerCase() === "week" ? shiftDays(base, 7) : shiftMonths(base, 1), matched: m[0] };
}

function ruleInSpan(text, base) {
  const m = /\bin\s+(a|an|\d+)\s+(day|days|week|weeks)\b/i.exec(text);
  if (!m) return null;
  const amount = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  const days = /week/i.test(m[2]) ? amount * 7 : amount;
  return { date: shiftDays(base, Math.min(366, days)), matched: m[0] };
}

function ruleWeekday(text, base, nextOnly) {
  const pattern = nextOnly ? `\\bnext\\s+(${WEEKDAY_NAMES})\\b` : `\\b(?:this\\s+)?(${WEEKDAY_NAMES})\\b`;
  const m = new RegExp(pattern, "i").exec(text);
  if (!m) return null;
  const want = weekdayIndex(m[1]);
  if (want < 0) return null;
  const offset = (want - base.getDay() + 7) % 7;
  return { date: shiftDays(base, nextOnly ? offset + 7 : offset), matched: m[0] };
}

function ruleMonthDay(text, base) {
  const m = new RegExp(`\\bon\\s+(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{4}))?`, "i").exec(text);
  const bare = m ? null : new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i").exec(text);
  const hit = m || bare;
  if (!hit) return null;
  const month = monthIndex(hit[1]);
  const day = Number(hit[2]);
  if (month < 0 || day < 1 || day > daysInMonth(base.getFullYear(), month)) return null;
  let year = hit[3] ? Number(hit[3]) : base.getFullYear();
  if (!hit[3]) {
    const candidate = keyOf(year, month, day);
    if (candidate < keyOf(base.getFullYear(), base.getMonth(), base.getDate())) year += 1;
    if (day > daysInMonth(year, month)) return null;
  }
  const date = new Date(year, month, day);
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  return { date: keyOf(year, month, day), matched: hit[0] };
}

/** First date expression in the text, or an empty date when there is none. */
function parseTaskDate(text, ref) {
  const input = str(text);
  if (!input.trim()) return { date: "", matched: "" };
  const base = refDate(ref);
  const rules = [ruleIso, ruleRelative, ruleWeekend, ruleNextSpan, ruleInSpan, (t, b) => ruleWeekday(t, b, true), (t, b) => ruleWeekday(t, b, false), ruleMonthDay];
  for (const rule of rules) {
    const hit = rule(input, base);
    if (hit) return hit;
  }
  return { date: "", matched: "" };
}

/**
 * Split a task title into a clean title and a due date: the first date
 * expression sets the due date and its words come out of the title.
 */
function extractTaskDue(title, ref) {
  const input = str(title);
  const hit = parseTaskDate(input, ref);
  if (!hit.date) return { title: input.trim(), due: "" };
  // A preposition belongs to the date ("read it by Friday"), so it leaves too.
  const withPrep = new RegExp(`\\b(?:by|on|for|due)\\s+${escapeRe(hit.matched)}`, "i");
  const cleaned = input
    .replace(withPrep, " ")
    .replace(hit.matched, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  return { title: cleaned, due: hit.date };
}

/** Short chip for a due date next to a task: Due today, Overdue, or the date. */
function dueChipLabel(due, today) {
  const key = str(due);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  const day = str(today) || localDate();
  if (key === day) return "Due today";
  if (key < day) return `Overdue · ${key}`;
  if (key === shiftDays(parseKey(day) || refDate(), 1)) return `Due tomorrow · ${key}`;
  return `Due ${key}`;
}

module.exports = {
  dueChipLabel,
  extractTaskDue,
  parseTaskDate,
};
