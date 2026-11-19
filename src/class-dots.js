"use strict";
/*
 * Class-held dots for the course hub: one dot per scheduled class meeting this
 * term. A dot is filled when that day's lecture note exists, a ring when
 * attendance was checked without a note, and empty when the class did not meet.
 * Clicking an empty dot creates the note from the existing course template.
 *
 * Pure: the plugin supplies the meetings and the note/attendance sets; this
 * only matches days, orders them and caps the row.
 */
const { str } = require("./util");

const MAX_DOTS = 90;

function courseKeyOf(value) {
  return str(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function dayKeyOf(value) {
  const text = str(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeMeeting(value) {
  const source = value && typeof value === "object" ? value : {};
  const course = courseKeyOf(source.course);
  const key = dayKeyOf(source.key);
  if (!course || !key) return null;
  return {
    course,
    name: str(source.name).trim() || str(source.course).trim(),
    key,
    label: str(source.label).trim(),
    event: source.event === undefined ? null : source.event,
  };
}

function idSet(value) {
  const out = new Set();
  for (const entry of Array.isArray(value) ? value : []) {
    const text = str(entry).trim().toLowerCase();
    if (text) out.add(text);
  }
  return out;
}

/**
 * meetings: [{ course, name?, key, label?, event? }]; noted/checked hold
 * "course|key" ids (course already lowercased, or any case). termStart/termEnd
 * bound the meetings; cap bounds one course's dots with an overflow count.
 */
function buildClassDots(input) {
  const opts = input && typeof input === "object" ? input : {};
  const noted = idSet(opts.noted);
  const checked = idSet(opts.checked);
  const termStart = dayKeyOf(opts.termStart);
  const termEnd = dayKeyOf(opts.termEnd);
  const cap = Math.max(1, Math.min(MAX_DOTS, Math.round(Number(opts.cap) || MAX_DOTS)));
  const courses = new Map();
  for (const raw of Array.isArray(opts.meetings) ? opts.meetings : []) {
    const meeting = normalizeMeeting(raw);
    if (!meeting) continue;
    if (termStart && meeting.key < termStart) continue;
    if (termEnd && meeting.key > termEnd) continue;
    if (!courses.has(meeting.course)) {
      courses.set(meeting.course, { course: meeting.course, name: meeting.name, dots: [], overflow: 0 });
    }
    const entry = courses.get(meeting.course);
    if (!entry.name && meeting.name) entry.name = meeting.name;
    const id = `${meeting.course}|${meeting.key}`;
    const state = noted.has(id) ? "held" : checked.has(id) ? "checked" : "empty";
    entry.dots.push({ key: meeting.key, state, label: meeting.label, event: meeting.event });
  }
  let total = 0;
  for (const entry of courses.values()) {
    entry.dots.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    total += entry.dots.length;
    if (entry.dots.length > cap) {
      entry.overflow = entry.dots.length - cap;
      entry.dots = entry.dots.slice(0, cap);
    }
  }
  return { courses: [...courses.values()], total };
}

module.exports = {
  MAX_DOTS,
  buildClassDots,
  courseKeyOf,
  normalizeMeeting,
};
