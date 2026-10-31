"use strict";
/*
 * Local study-tool data. These helpers are deliberately independent of
 * Obsidian so the view, the Today card and the tests share the same rules.
 */
const { hashString, localDate, str } = require("./util");

const MAX_LECTURES = 300;
const MAX_GOALS = 200;
const MAX_TITLE = 160;
const MAX_TOPICS = 1000;
const MAX_GOAL_MINUTES = 100000;

function enabledValue(value, fallback) {
  if (value === false) return false;
  if (value === true) return true;
  if (value && typeof value === "object" && value.enabled === false) return false;
  return fallback;
}

function dayValue(value) {
  const text = str(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }
  return text;
}

function addDays(day, count) {
  const text = dayValue(day);
  if (!text) return "";
  const [year, month, date] = text.split("-").map(Number);
  const at = new Date(year, month - 1, date);
  at.setDate(at.getDate() + Math.round(Number(count) || 0));
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

function idFor(prefix, parts) {
  return `${prefix}-${hashString(parts.join("|"))}`;
}

function numberValue(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function normalizeCornellSettings(value) {
  return { enabled: enabledValue(value, true) };
}

function normalizeLecture(value) {
  const source = value && typeof value === "object" ? value : {};
  const course = str(source.course).trim().slice(0, MAX_TITLE);
  const title = str(source.title).trim().slice(0, MAX_TITLE);
  const date = dayValue(source.date);
  if (!course || !title || !date) return null;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("lecture", [course, date, title]),
    course,
    date,
    title,
    topics: str(source.topics).replace(/\s+/g, " ").trim().slice(0, MAX_TOPICS),
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizeLectureLog(value) {
  const source = value && typeof value === "object" ? value : {};
  const lectures = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.lectures) ? source.lectures : []) {
    const lecture = normalizeLecture(raw);
    if (!lecture || seen.has(lecture.id)) continue;
    seen.add(lecture.id);
    lectures.push(lecture);
    if (lectures.length >= MAX_LECTURES) break;
  }
  return { enabled: enabledValue(value, true), lectures };
}

function normalizeGoal(value) {
  const source = value && typeof value === "object" ? value : {};
  const title = str(source.title).trim().slice(0, MAX_TITLE);
  if (!title) return null;
  const targetMinutes = clamp(numberValue(source.targetMinutes, 60), 1, MAX_GOAL_MINUTES);
  const minutes = clamp(numberValue(source.minutes, 0), 0, MAX_GOAL_MINUTES);
  const done = source.done === true || minutes >= targetMinutes;
  return {
    id: str(source.id).trim().slice(0, 160) || idFor("goal", [title, source.course, source.due]),
    title,
    course: str(source.course).trim().slice(0, MAX_TITLE),
    targetMinutes,
    minutes: done ? Math.max(minutes, targetMinutes) : minutes,
    due: dayValue(source.due),
    done,
    createdAt: Math.max(0, Math.round(numberValue(source.createdAt, 0))),
  };
}

function normalizeStudyGoals(value) {
  const source = value && typeof value === "object" ? value : {};
  const goals = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.goals) ? source.goals : []) {
    const goal = normalizeGoal(raw);
    if (!goal || seen.has(goal.id)) continue;
    seen.add(goal.id);
    goals.push(goal);
    if (goals.length >= MAX_GOALS) break;
  }
  return { enabled: enabledValue(value, true), goals };
}

function normalizeStudyToolsSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    cornellNotes: normalizeCornellSettings(source.cornellNotes),
    lectureLog: normalizeLectureLog(source.lectureLog),
    studyGoals: normalizeStudyGoals(source.studyGoals),
  };
}

/** `Course | 2026-11-02 | Lecture title | Optional topics` */
function parseLectureLines(text) {
  const lectures = [];
  const issues = [];
  const lines = str(text).replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 3) {
      issues.push(`Line ${index + 1}: use Course | YYYY-MM-DD | Lecture title.`);
      continue;
    }
    const [course, date, title, ...rest] = parts;
    const lecture = normalizeLecture({
      course,
      date,
      title,
      topics: rest.join(" | "),
      createdAt: Date.now(),
    });
    if (!lecture) {
      issues.push(`Line ${index + 1}: add a course, a real YYYY-MM-DD date and a title.`);
      continue;
    }
    lectures.push(lecture);
  }
  return { lectures, issues };
}

function createStudyGoal(input, now) {
  const source = input && typeof input === "object" ? input : {};
  const title = str(source.title).trim();
  if (!title) return null;
  return normalizeGoal({
    ...source,
    id: idFor("goal", [title, source.course || "", source.due || "", now || 0]),
    createdAt: Math.max(0, Math.round(numberValue(now, Date.now()))),
  });
}

function createLecture(input, now) {
  return normalizeLecture({
    ...(input || {}),
    id: idFor("lecture", [input && input.course, input && input.date, input && input.title, now || 0]),
    createdAt: Math.max(0, Math.round(numberValue(now, Date.now()))),
  });
}

function goalPercent(goal) {
  if (!goal || !goal.targetMinutes) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(goal.minutes) / Number(goal.targetMinutes)) * 100)));
}

function openGoals(goals) {
  return (Array.isArray(goals) ? goals : [])
    .filter((goal) => goal && goal.done !== true)
    .sort((a, b) => {
      const ad = str(a.due);
      const bd = str(b.due);
      if (ad && bd && ad !== bd) return ad.localeCompare(bd);
      if (ad !== bd) return ad ? -1 : 1;
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });
}

function goalSummary(goals) {
  const list = Array.isArray(goals) ? goals : [];
  const open = openGoals(list);
  const done = list.filter((goal) => goal && goal.done);
  const minutes = list.reduce((sum, goal) => sum + (Number(goal.minutes) || 0), 0);
  const target = list.reduce((sum, goal) => sum + (Number(goal.targetMinutes) || 0), 0);
  return {
    total: list.length,
    open: open.length,
    done: done.length,
    minutes,
    target,
    percent: target ? Math.max(0, Math.min(100, Math.round((minutes / target) * 100))) : 0,
    next: open[0] || null,
  };
}

function nextLecture(lectures, today) {
  const day = dayValue(today) || localDate();
  return (Array.isArray(lectures) ? lectures : [])
    .filter((lecture) => lecture && lecture.date >= day)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))[0] || null;
}

function formatStudyMinutes(value) {
  const minutes = Math.max(0, Math.round(numberValue(value, 0)));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

/** Build a conservative goal from the existing next-exam study plan. */
function examGoalFromPlan(plan, today) {
  if (!plan || !str(plan.course).trim()) return null;
  const days = Math.max(0, Math.round(numberValue(plan.daysLeft, 0)));
  return createStudyGoal(
    {
      title: `${str(plan.course).trim()} exam prep`,
      course: str(plan.course).trim(),
      targetMinutes: Math.max(60, days * 45),
      due: addDays(today, days),
    },
    Date.now()
  );
}

module.exports = {
  MAX_GOALS,
  MAX_LECTURES,
  addDays,
  createLecture,
  createStudyGoal,
  dayValue,
  examGoalFromPlan,
  formatStudyMinutes,
  goalPercent,
  goalSummary,
  nextLecture,
  normalizeCornellSettings,
  normalizeLecture,
  normalizeLectureLog,
  normalizeStudyGoals,
  normalizeStudyToolsSettings,
  openGoals,
  parseLectureLines,
};
