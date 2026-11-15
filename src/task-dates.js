"use strict";
/*
 * Natural-language due dates and times for task input: "Practice 8 AP World
 * questions today" gets today's date, "tomorrow" the next day, "Tuesday" the
 * upcoming Tuesday, "at 3pm" three in the afternoon and "in 2 hours" the
 * clock two hours from now. Dependency-free: dates come back as YYYY-MM-DD,
 * times as HH:MM, along with the exact words matched so callers can strip
 * them from the title. A time with no day means the next time it comes round;
 * "tonight" is the one anchored word and always means this evening.
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
  const m = /\bin\s+(a|an|\d+)\s+(day|days|week|weeks|month|months)\b/i.exec(text);
  if (!m) return null;
  const amount = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  if (/month/i.test(m[2])) return { date: shiftMonths(base, Math.min(24, amount)), matched: m[0] };
  const days = /week/i.test(m[2]) ? amount * 7 : amount;
  return { date: shiftDays(base, Math.min(366, days)), matched: m[0] };
}

/**
 * A repeat in the title: "every day", "daily", "every week", "weekly" or
 * "every Tuesday". The words leave the title; times of day are never read.
 */
function parseTaskRepeat(text) {
  const input = str(text);
  if (!input.trim()) return { repeat: "", matched: "", keep: "" };
  const every = new RegExp(`\\bevery\\s+(day|week|${WEEKDAY_NAMES})\\b`, "i").exec(input);
  if (every) {
    const word = every[1].toLowerCase();
    const weekday = weekdayIndex(word) >= 0;
    // "every Tuesday" stays weekly but keeps the weekday for the due parser.
    return { repeat: word === "day" ? "daily" : "weekly", matched: every[0], keep: weekday ? every[1] : "" };
  }
  if (/\bdaily\b/i.test(input)) return { repeat: "daily", matched: /\bdaily\b/i.exec(input)[0], keep: "" };
  if (/\bweekly\b/i.test(input)) return { repeat: "weekly", matched: /\bweekly\b/i.exec(input)[0], keep: "" };
  return { repeat: "", matched: "", keep: "" };
}

/** Split a task title into a clean title and a daily/weekly repeat. */
function extractTaskRepeat(title) {
  const input = str(title);
  const hit = parseTaskRepeat(input);
  if (!hit.repeat) return { title: input.trim(), repeat: "" };
  const cleaned = input
    .replace(hit.matched, hit.keep ? ` ${hit.keep} ` : " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  return { title: cleaned, repeat: hit.repeat };
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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* Words that name an hour. "tonight" is anchored to today: it never rolls. */
const NAMED_TIMES = [
  ["midnight", 0, 0],
  ["tonight", 20, 0],
  ["evening", 18, 0],
  ["morning", 9, 0],
  ["noon", 12, 0],
  ["midday", 12, 0],
];

const NAMED_TIME_RE = new RegExp(`\\b(?:this\\s+)?(${NAMED_TIMES.map(([word]) => word).join("|")})\\b`, "i");

/** A valid HH:MM string, or "" for anything else. */
function validTime(value) {
  const clean = str(value).trim();
  return TIME_RE.test(clean) ? clean : "";
}

/** Minutes past midnight for an HH:MM string, or null. */
function clockMinutes(value) {
  const clean = validTime(value);
  if (!clean) return null;
  const [hours, minutes] = clean.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "15:30" reads as "3:30 PM" beside a task. */
function formatTaskTime(value) {
  const clean = validTime(value);
  if (!clean) return "";
  const [hours, minutes] = clean.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${hour} ${suffix}` : `${hour}:${pad(minutes)} ${suffix}`;
}

function clockParts(hour, minute, meridiem) {
  let hours = Number(hour);
  const minutes = minute == null || minute === "" ? 0 : Number(minute);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null;
  const mark = str(meridiem).toLowerCase();
  if (mark) {
    if (hours < 1 || hours > 12) return null;
    const evening = mark === "pm" || mark === "p";
    hours = (hours % 12) + (evening ? 12 : 0);
  }
  if (hours < 0 || hours > 23) return null;
  return timeKey(hours, minutes);
}

function timeKey(hours, minutes) {
  return `${pad(hours)}:${pad(minutes)}`;
}

/** The clock on "now": an HH:MM string when it carries a real time, else "". */
function nowClock(now) {
  if (!(now instanceof Date) || isNaN(now.getTime())) return "";
  return timeKey(now.getHours(), now.getMinutes());
}

/**
 * "in 2 hours", "in 30 minutes", "in an hour": real clock math from now, so
 * 11pm plus three hours lands on tomorrow at 02:00.
 */
function ruleInHours(text, now) {
  const m = /\bin\s+(a|an|\d+)\s+(hours?|hrs?|minutes?|mins?)\b/i.exec(text);
  if (!m) return null;
  const amount = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  const clock = now instanceof Date && !isNaN(now.getTime()) ? new Date(now.getTime()) : new Date();
  const minutes = /^h/i.test(m[2]) ? amount * 60 : amount;
  const at = new Date(clock.getTime() + Math.min(24 * 60, Math.max(0, minutes)) * 60000);
  return {
    time: timeKey(at.getHours(), at.getMinutes()),
    date: keyOf(at.getFullYear(), at.getMonth(), at.getDate()),
    matched: m[0],
    named: "",
  };
}

/**
 * The first time of day in the text: "3pm", "3:30 pm", "15:00", "at 9",
 * "3p" and the named hours. Returns the HH:MM, the words matched and, for a
 * named word, which one.
 */
function parseTaskTime(text, now) {
  const input = str(text);
  const empty = { time: "", date: "", matched: "", named: "" };
  if (!input.trim()) return empty;
  const inHours = ruleInHours(input, now);
  if (inHours) return inHours;
  const meridiem = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)\b/i.exec(input);
  if (meridiem) {
    const time = clockParts(meridiem[1], meridiem[2], meridiem[3]);
    if (time) return { time, date: "", matched: meridiem[0], named: "" };
  }
  const named = NAMED_TIME_RE.exec(input);
  if (named) {
    const hit = NAMED_TIMES.find(([word]) => word === named[1].toLowerCase());
    if (hit) return { time: timeKey(hit[1], hit[2]), date: "", matched: named[0], named: hit[0] };
  }
  const written = /\b(?:at\s+)?(\d{1,2}):(\d{2})\b/.exec(input);
  if (written) {
    const time = clockParts(written[1], written[2], "");
    if (time) return { time, date: "", matched: written[0], named: "" };
  }
  // A bare hour only counts right after "at": "at 9", never "chapter 9".
  const bare = /\bat\s+(\d{1,2})\b/i.exec(input);
  if (bare) {
    const time = clockParts(bare[1], "", "");
    if (time) return { time, date: "", matched: bare[0], named: "" };
  }
  return empty;
}

/** Take one matched expression, and a preposition in front of it, out of the text. */
function stripPhrase(text, matched) {
  const prep = new RegExp(`\\b(?:at|by|on|for|due)\\s+${escapeRe(matched)}`, "i");
  return text.replace(prep, " ").replace(matched, " ");
}

function tidyTitle(text) {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Split a task title into a clean title, a due date and a due time. The first
 * date expression sets the day; the first time sets the clock. A clock time
 * with no day means today, or tomorrow when that hour has already gone by.
 * Pass { takeDate: false } or { takeTime: false } to leave a half the caller
 * already has alone: its words then stay in the title.
 */
function extractTaskWhen(title, now, options) {
  const input = str(title);
  if (!input.trim()) return { title: input.trim(), due: "", time: "" };
  const take = options && typeof options === "object" ? options : {};
  const wantDate = take.takeDate !== false;
  const wantTime = take.takeTime !== false;
  const timeHit = wantTime ? parseTaskTime(input, now) : { time: "", date: "", matched: "", named: "" };
  const dateHit = wantDate ? parseTaskDate(input, now) : { date: "", matched: "" };
  if (!timeHit.matched && !dateHit.matched) return { title: input.trim(), due: "", time: "" };
  let due = dateHit.date || "";
  let time = timeHit.time || "";
  if (timeHit.date) due = timeHit.date;
  let cleaned = input;
  for (const matched of [timeHit.matched, dateHit.matched]) {
    if (matched) cleaned = stripPhrase(cleaned, matched);
  }
  if (time && !due && wantDate) {
    const base = refDate(now);
    due = keyOf(base.getFullYear(), base.getMonth(), base.getDate());
    const clock = nowClock(now);
    // The next time that hour comes round, unless the words anchor it today.
    if (timeHit.named !== "tonight" && clock && clockMinutes(time) <= clockMinutes(clock)) due = shiftDays(base, 1);
  }
  return { title: tidyTitle(cleaned), due, time };
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
function dueChipLabel(due, today, time) {
  const key = str(due);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  const day = str(today) || localDate();
  const clock = formatTaskTime(time);
  const suffix = clock ? ` · ${clock}` : "";
  if (key === day) return `Due today${suffix}`;
  if (key < day) return `Overdue · ${key}${suffix}`;
  if (key === shiftDays(parseKey(day) || refDate(), 1)) return `Due tomorrow · ${key}${suffix}`;
  return `Due ${key}${suffix}`;
}

module.exports = {
  clockMinutes,
  dueChipLabel,
  extractTaskDue,
  extractTaskRepeat,
  extractTaskWhen,
  formatTaskTime,
  parseTaskDate,
  parseTaskRepeat,
  parseTaskTime,
  validTime,
};
