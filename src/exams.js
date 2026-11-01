"use strict";
/*
 * One exam list for the calendar, assignment notes and the topic planner.
 * Calendar events and topic plans are read-only; manual exams are ordinary
 * assignment notes with `type: exam`, plus optional topics, weight and time.
 */
const { str, localDate } = require("./util");
const courseIdentity = require("./course-identity");
const { cleanSubjectTitle, isExamEvent } = require("./calendar-model");

const EXAM_TYPES = ["midterm", "final", "quiz", "sat", "ap", "other"];

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function dateKeyOf(value) {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = str(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function timeOf(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return "";
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function typeOf(text, fallback) {
  const raw = str(fallback).trim().toLowerCase();
  const value = `${str(text)} ${raw}`.toLowerCase();
  if (/\bsat\b/.test(value)) return "sat";
  if (/\bap\b/.test(value) || /\badvanced placement\b/.test(value)) return "ap";
  if (/\bmidterm\b|\bmid-term\b/.test(value)) return "midterm";
  if (/\bfinal\b/.test(value)) return "final";
  if (/\bquiz\b/.test(value)) return "quiz";
  if (raw === "test") return "midterm";
  if (raw === "exam") return "other";
  return EXAM_TYPES.includes(raw) ? raw : "other";
}

function normalizeTopics(value) {
  const raw = Array.isArray(value) ? value : str(value).split(/[,;]/);
  const out = [];
  for (const item of raw) {
    const text = str(item).replace(/\s+/g, " ").trim().slice(0, 200);
    if (text && !out.some((entry) => entry.toLowerCase() === text.toLowerCase())) out.push(text);
    if (out.length >= 100) break;
  }
  return out;
}

function rank(row) {
  if (!row) return 0;
  let score = row.source === "assignment" ? 40 : row.source === "planner" ? 20 : 10;
  if (row.topics && row.topics.length) score += 8;
  if (row.weight !== null && row.weight !== undefined && row.weight !== "") score += 4;
  if (row.time) score += 2;
  return score;
}

function mergeRows(primary, secondary) {
  const out = { ...secondary, ...primary };
  if (!out.topics || !out.topics.length) out.topics = secondary.topics || [];
  if (out.weight === null || out.weight === undefined || out.weight === "") out.weight = secondary.weight;
  if (!out.time) out.time = secondary.time || "";
  if (!out.type || out.type === "other") out.type = secondary.type || out.type;
  out.sources = [...new Set([...(secondary.sources || []), ...(primary.sources || [])])];
  out.source = out.sources.length > 1 ? "merged" : out.sources[0] || out.source;
  return out;
}

function courseFromTitle(title, explicit) {
  if (str(explicit).trim()) return str(explicit).trim();
  return cleanSubjectTitle(title)
    .replace(/\s*[-–—:]\s*$/g, "")
    .replace(/\s+\b(final|midterm|exam|test|quiz|assessment|sat|ap)\b.*$/i, "")
    .trim() || str(title).trim();
}

function eventRow(event, settings) {
  const date = dateKeyOf(event.dateKey || event.dtstart);
  if (!date) return null;
  const rawCourse = courseFromTitle(event.summary, event.course || event.subject);
  const info = courseIdentity.courseDetails(settings, rawCourse);
  return {
    id: `calendar-${str(event.uid || event.dateKey || event.summary).replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}`,
    courseId: info.id,
    course: info.name || rawCourse,
    title: str(event.summary).trim() || "Exam",
    date,
    time: timeOf(event.dtstart),
    type: typeOf(event.summary, "other"),
    weight: null,
    topics: [],
    source: "calendar",
    sources: ["calendar"],
    calendarEvent: event,
  };
}

function assignmentRow(assignment, settings) {
  const date = dateKeyOf(assignment && assignment.due);
  if (!date) return null;
  const type = str(assignment.type).toLowerCase();
  if (!(type === "exam" || type === "test" || type === "final" || assignment.category === "exam")) return null;
  const rawCourse = courseFromTitle(assignment.title, assignment.course);
  const info = courseIdentity.courseDetails(settings, rawCourse);
  return {
    id: `assignment-${str(assignment.id || assignment.file && assignment.file.path || assignment.title).replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}`,
    courseId: info.id,
    course: info.name || rawCourse,
    title: str(assignment.title).trim() || "Exam",
    date,
    time: str(assignment.examTime || assignment.exam_time).trim(),
    type: typeOf(assignment.title, type),
    weight: assignment.weight === undefined || assignment.weight === null ? null : Number(assignment.weight),
    topics: normalizeTopics(assignment.topics),
    source: "assignment",
    sources: ["assignment"],
    assignment,
  };
}

function planRow(plan, settings) {
  const date = dateKeyOf(plan && plan.examDate);
  if (!date) return null;
  const rawCourse = str(plan.course).trim() || "Course";
  const info = courseIdentity.courseDetails(settings, rawCourse);
  return {
    id: `planner-${str(plan.id || `${rawCourse}-${date}`).replace(/[^a-z0-9]+/gi, "-").slice(0, 80)}`,
    courseId: info.id,
    course: info.name || rawCourse,
    title: `${info.name || rawCourse || "Course"} exam`,
    date,
    time: "",
    type: "other",
    weight: null,
    topics: normalizeTopics((plan.topics || []).map((topic) => topic && topic.name ? topic.name : topic)),
    source: "planner",
    sources: ["planner"],
    plan,
  };
}

function listExams(ctx) {
  const opts = asObject(ctx);
  const settings = opts.settings || {};
  const today = dateKeyOf(opts.today) || localDate();
  const horizon = Number.isFinite(Number(opts.horizonDays)) ? Math.max(0, Number(opts.horizonDays)) : 365;
  const overrides = opts.overrides || (settings.calendar && settings.calendar.examOverrides) || {};
  const rows = [];
  for (const event of Array.isArray(opts.events) ? opts.events : []) {
    if (!isExamEvent(event, overrides)) continue;
    const row = eventRow(event, settings);
    if (row) rows.push(row);
  }
  for (const assignment of Array.isArray(opts.assignments) ? opts.assignments : []) {
    const row = assignmentRow(assignment, settings);
    if (row) rows.push(row);
  }
  for (const plan of Array.isArray(opts.plans) ? opts.plans : []) {
    const row = planRow(plan, settings);
    if (row) rows.push(row);
  }
  const byKey = new Map();
  for (const row of rows) {
    if (opts.includePast !== true && row.date < today) continue;
    if (horizon && row.date > addDays(today, horizon)) continue;
    const courseKey = row.courseId || courseIdentity.normalizeKey(row.course) || "exam";
    const key = `${courseKey}|${row.date}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const preferred = rank(row) >= rank(existing) ? mergeRows(row, existing) : mergeRows(existing, row);
    preferred.sources = [...new Set([...(existing.sources || []), ...(row.sources || [])])];
    preferred.source = preferred.sources.length > 1 ? "merged" : preferred.sources[0] || preferred.source;
    byKey.set(key, preferred);
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

function addDays(key, count) {
  const date = new Date(`${key}T00:00:00`);
  if (isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + count);
  return dateKeyOf(date);
}

function nextExam(exams, course, settings, today) {
  const day = dateKeyOf(today) || localDate();
  return (Array.isArray(exams) ? exams : [])
    .filter((exam) => exam.date >= day && (!course || courseIdentity.sameCourse(settings, exam.course, course)))
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

module.exports = {
  EXAM_TYPES,
  asObject,
  assignmentRow,
  courseFromTitle,
  dateKeyOf,
  eventRow,
  listExams,
  mergeRows,
  nextExam,
  normalizeTopics,
  planRow,
  typeOf,
};
