"use strict";
/*
 * Review calendar and workload: the due-date view for whole-note review and
 * cards. It reads the same `next_review` properties and note sets as the normal
 * queues, and only estimates time; it never schedules or writes anything.
 */
const { str } = require("./util");
const { isStudyable } = require("./study-status");
const { isNoteCandidate, noteDueDate, notePriority, noteSetFor, normalizePriority } = require("./note-review");

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeReviewCalendarSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: src.enabled !== false,
    noteMinutes: clampNumber(src.noteMinutes, 0.25, 60, 2),
    cardMinutes: clampNumber(src.cardMinutes, 0.25, 60, 1),
    showCards: src.showCards !== false,
    detectMainNote: src.detectMainNote !== false,
    weekStartsOn: str(src.weekStartsOn).toLowerCase() === "sunday" ? "sunday" : "monday",
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dayKey(date) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(key, days) {
  const date = new Date(`${key}T12:00:00`);
  if (isNaN(date.getTime())) return key;
  date.setDate(date.getDate() + Math.round(days));
  return dayKey(date);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str(value).trim()) ? str(value).trim() : "";
}

function titleOf(file, fm) {
  return str(fm && fm.title).trim() || str(file && file.basename).trim() || str(file && file.path).replace(/^.*\//, "").replace(/\.md$/i, "");
}

function estimateMinutes(fm, fallback) {
  const attempts = Number(fm && fm.attempts) || 0;
  const seconds = Number(fm && fm.time_spent_total) || 0;
  if (attempts > 0 && seconds > 0) return Math.min(30, Math.max(0.25, seconds / attempts / 60));
  return fallback;
}

/**
 * Every whole note that belongs to a review set, with its next due date.
 * New notes are due today; overdue notes are kept as-is so the forecast can
 * fold them into today's workload.
 */
function noteScheduleRows(notes, options) {
  const opts = options || {};
  const sets = Array.isArray(opts.sets) ? opts.sets : [];
  const today = validDate(opts.today) || dayKey(new Date());
  const rows = [];
  for (const note of Array.isArray(notes) ? notes : []) {
    const fm = note && note.fm ? note.fm : {};
    if (!isNoteCandidate(note)) continue;
    if (fm.note_review_excluded === true) continue;
    const set = noteSetFor(note, sets);
    if (!set) continue;
    if (!isStudyable(fm, today)) continue;
    const attempts = Number(fm.attempts) || 0;
    const due = validDate(noteDueDate(fm)) || today;
    rows.push({
      kind: "note",
      path: str(note.file && note.file.path),
      title: titleOf(note.file, fm),
      date: attempts ? due : today,
      due,
      isNew: !attempts,
      priority: notePriority(note, set),
      set: set.name,
      minutes: estimateMinutes(fm, opts.noteMinutes === undefined ? 2 : Number(opts.noteMinutes)),
    });
  }
  return rows;
}

function cardScheduleRows(cards, options) {
  const opts = options || {};
  const today = validDate(opts.today) || dayKey(new Date());
  const rows = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = card && card.fm ? card.fm : {};
    if (!isStudyable(fm, today)) continue;
    const attempts = Number(fm.attempts) || 0;
    const due = validDate(fm.next_review) || today;
    rows.push({
      kind: "card",
      path: str(card.file && card.file.path),
      title: titleOf(card.file, fm),
      deck: str(card.deck || fm.deck),
      date: attempts ? due : today,
      due,
      isNew: !attempts,
      minutes: estimateMinutes(fm, opts.cardMinutes === undefined ? 1 : Number(opts.cardMinutes)),
    });
  }
  return rows;
}

function buildReviewForecast(input) {
  const opts = input || {};
  const settings = normalizeReviewCalendarSettings(opts.settings);
  const today = validDate(opts.today) || dayKey(new Date());
  const days = Math.max(1, Math.min(400, Math.round(Number(opts.days) || 45)));
  const noteRows = noteScheduleRows(opts.notes, { ...settings, sets: Array.isArray(opts.sets) ? opts.sets : [], today });
  const cardRows = settings.showCards ? cardScheduleRows(opts.cards, { ...settings, today }) : [];
  const map = new Map();
  for (let index = 0; index < days; index++) {
    const key = addDays(today, index);
    map.set(key, { date: key, notes: [], cards: [], minutes: 0 });
  }
  let overdue = 0;
  const add = (row) => {
    if (!row.date) return;
    let key = row.date;
    if (key < today) {
      key = today;
      overdue++;
    }
    const bucket = map.get(key);
    if (!bucket) return;
    if (row.kind === "note") bucket.notes.push(row);
    else bucket.cards.push(row);
    bucket.minutes += row.minutes;
  };
  for (const row of noteRows) add(row);
  for (const row of cardRows) add(row);
  const list = [...map.values()].map((bucket) => ({
    ...bucket,
    total: bucket.notes.length + bucket.cards.length,
    minutes: Math.round(bucket.minutes * 10) / 10,
  }));
  const next7 = list.slice(0, 7);
  return {
    today,
    days: list,
    notes: noteRows,
    cards: cardRows,
    overdue,
    totals: {
      notes: noteRows.length,
      cards: cardRows.length,
      due: noteRows.length + cardRows.length,
      minutes: Math.round(list.reduce((sum, day) => sum + day.minutes, 0) * 10) / 10,
    },
    next7: {
      days: next7,
      total: next7.reduce((sum, day) => sum + day.total, 0),
      minutes: Math.round(next7.reduce((sum, day) => sum + day.minutes, 0) * 10) / 10,
    },
  };
}

function workloadLabel(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  if (!value) return "no work";
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const rest = Math.round(value - hours * 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function calendarCells(forecast, year, month, weekStartsOn, now) {
  const first = new Date(year, month, 1);
  const startOffset = weekStartsOn === "sunday" ? first.getDay() : (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const map = new Map((forecast && forecast.days ? forecast.days : []).map((day) => [day.date, day]));
  const today = dayKey(now || new Date());
  const cells = [];
  const push = (y, m, d, inMonth) => {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    const bucket = map.get(key);
    cells.push({ key, day: d, inMonth, isToday: key === today, total: bucket ? bucket.total : 0, minutes: bucket ? bucket.minutes : 0 });
  };
  for (let i = startOffset; i > 0; i--) push(month === 0 ? year - 1 : year, month === 0 ? 12 : month, daysInPrev - i + 1, false);
  for (let day = 1; day <= daysInMonth; day++) push(year, month + 1, day, true);
  while (cells.length % 7) {
    const nextDay = cells.length - startOffset - daysInMonth + 1;
    push(month === 11 ? year + 1 : year, month === 11 ? 1 : month + 2, nextDay, false);
  }
  return cells;
}

function pickMainNote(notes) {
  const rows = (Array.isArray(notes) ? notes : [])
    .map((note) => ({
      path: str(note && note.path),
      title: str(note && note.title) || str(note && note.path).replace(/^.*\//, "").replace(/\.md$/i, ""),
      links: Array.isArray(note && note.links) ? note.links.length : Math.max(0, Number(note && note.links) || 0),
    }))
    .filter((note) => note.path);
  rows.sort((a, b) => b.links - a.links || a.path.localeCompare(b.path));
  return rows[0] || null;
}

function addFolderSet(sets, folder, name) {
  const clean = str(folder).trim().replace(/^\/+|\/+$/g, "");
  if (!clean) return { sets: Array.isArray(sets) ? sets : [], added: false };
  const list = Array.isArray(sets) ? sets : [];
  if (list.some((set) => (set.folders || []).includes(clean))) return { sets: list, added: false };
  return {
    sets: list.concat({
      name: str(name).trim() || `Folder: ${clean}`,
      folders: [clean],
      tags: [],
      priority: "normal",
    }),
    added: true,
  };
}

function weekdayRhythm(rows) {
  const buckets = WEEK_DAYS.map((label) => ({ label, attempts: 0, correct: 0 }));
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = new Date(`${row.date}T12:00:00`);
    if (isNaN(date.getTime())) continue;
    const index = (date.getDay() + 6) % 7;
    buckets[index].attempts++;
    if (row.correct) buckets[index].correct++;
  }
  return buckets.map((bucket) => ({ ...bucket, accuracy: bucket.attempts ? bucket.correct / bucket.attempts : null }));
}

module.exports = {
  WEEK_DAYS,
  addDays,
  addFolderSet,
  buildReviewForecast,
  calendarCells,
  cardScheduleRows,
  dayKey,
  estimateMinutes,
  noteScheduleRows,
  normalizeReviewCalendarSettings,
  pad,
  pickMainNote,
  validDate,
  weekdayRhythm,
  workloadLabel,
};
