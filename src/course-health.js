"use strict";
/*
 * Local course health checks over the course dashboard, topic plans and study
 * tasks. This is the offline part of Course Command Center's health-check
 * workflow (MIT): no Canvas request, no login and no note is written.
 */
const { str } = require("./util");
const { dayValue, addDays } = require("./study-tools");
const courseIdentity = require("./course-identity");

const COURSE_HEALTH_LEVELS = ["ok", "warn"];

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function enabledValue(value) {
  if (value === false) return false;
  if (value && typeof value === "object" && value.enabled === false) return false;
  return true;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function clampOr(value, low, high, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(n, low, high) : fallback;
}

function normalizeCourseHealthSettings(value) {
  const source = asObject(value);
  return {
    enabled: enabledValue(value),
    attendanceThreshold: clampOr(source.attendanceThreshold, 0, 100, 75),
    examWindowDays: clampOr(source.examWindowDays, 1, 120, 14),
    minSessions: clampOr(source.minSessions, 1, 50, 3),
  };
}

function daysBetween(start, end) {
  const a = dayValue(start);
  const b = dayValue(end);
  if (!a || !b) return 0;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad)) / 86400000);
}

function sameCourse(a, b, settings) {
  if (settings) return courseIdentity.sameCourse(settings, a, b);
  return str(a).trim().toLowerCase() === str(b).trim().toLowerCase() && !!str(a).trim();
}

/** Remaining topic passes and exam date for a course, from the topic planner. */
function planForCourse(plans, course, today, settings) {
  const day = str(today);
  const rows = (Array.isArray(plans) ? plans : []).filter((plan) => sameCourse(plan && plan.course, course, settings));
  const future = rows
    .filter((plan) => dayValue(plan.examDate) && plan.examDate >= day)
    .sort((a, b) => a.examDate.localeCompare(b.examDate));
  const plan = future[0] || null;
  if (!plan) return null;
  let target = 0;
  let passes = 0;
  for (const topic of Array.isArray(plan.topics) ? plan.topics : []) {
    target += Math.max(0, Number(topic.targetPasses) || Number(plan.targetPasses) || 1);
    passes += Math.max(0, Number(topic.passes) || 0);
  }
  return { plan, examDate: plan.examDate, daysLeft: daysBetween(day, plan.examDate), remaining: Math.max(0, target - passes) };
}

/**
 * Build one row per course with a status and the checks that explain it.
 * `courses` is the course dashboard output (name, lectures, absences, graded,
 * weighted, folder, attendance); `plans` and `tasks` are the local planner and
 * task lists. Nothing is mutated.
 */
function courseHealthReport(input) {
  const source = asObject(input);
  const settings = normalizeCourseHealthSettings(source);
  const today = dayValue(source.today) || dayValue(addDays("1970-01-01", 0));
  const day = today || str(source.today).slice(0, 10);
  const tasks = Array.isArray(source.tasks) ? source.tasks : [];
  const plans = Array.isArray(source.plans) ? source.plans : [];
  const courses = Array.isArray(source.courses) ? source.courses : [];
  const examList = Array.isArray(source.exams) ? source.exams : null;

  const rows = courses.map((course) => {
    const checks = [];
    const name = str(course && course.name).trim() || "Untitled course";
    const attended = Math.max(0, Number(course && course.lectures) || 0);
    const absences = Math.max(0, Number(course && course.absences) || 0);
    const attendance = Number.isFinite(Number(course && course.attendance)) ? Number(course.attendance) : null;

    if (!Number(course && course.graded)) {
      checks.push({ id: "grades", level: "warn", text: "No grade items yet, so the course estimate is empty." });
    }
    if (!attended && !absences) {
      checks.push({ id: "lectures", level: "warn", text: "No lectures or absences logged for this course." });
    } else if (attendance !== null && attended + absences >= settings.minSessions && attendance < settings.attendanceThreshold) {
      checks.push({
        id: "attendance",
        level: "warn",
        text: `Attendance is ${attendance}% (${attended} of ${attended + absences}), under the ${settings.attendanceThreshold}% target.`,
      });
    }
    const overdue = tasks.filter(
      (task) => task && !task.done && dayValue(task.due) && task.due < day && sameCourse(task.course, name, source.settings)
    );
    if (overdue.length) {
      checks.push({
        id: "tasks",
        level: "warn",
        text: `${overdue.length} open ${overdue.length === 1 ? "task is" : "tasks are"} overdue for this course.`,
      });
    }
    const plan = planForCourse(plans, name, day, source.settings);
    const exam = examList
      ? examList
          .filter((entry) => entry && dayValue(entry.date) && entry.date >= day && sameCourse(entry.course, name, source.settings))
          .sort((a, b) => a.date.localeCompare(b.date))[0] || null
      : null;
    const examDays = exam ? daysBetween(day, exam.date) : null;
    if (exam && examDays <= settings.examWindowDays) {
      const remaining = plan ? plan.remaining : 0;
      checks.push({
        id: "exam",
        level: "warn",
        text: `Exam ${exam.title || ""} in ${examDays} ${examDays === 1 ? "day" : "days"}${remaining > 0 ? ` with ${remaining} topic ${remaining === 1 ? "pass" : "passes"} left` : ""}.`,
      });
    } else if (!examList && plan && plan.remaining > 0 && plan.daysLeft <= settings.examWindowDays) {
      checks.push({
        id: "exam",
        level: "warn",
        text: `Exam in ${plan.daysLeft} ${plan.daysLeft === 1 ? "day" : "days"} with ${plan.remaining} topic ${plan.remaining === 1 ? "pass" : "passes"} left.`,
      });
    }
    if (!str(course && course.folder).trim()) {
      checks.push({ id: "folder", level: "ok", text: "No course folder set; notes are not grouped for this course." });
    }
    if (!checks.length) checks.push({ id: "clear", level: "ok", text: "No open issue found." });
    const warnings = checks.filter((check) => check.level === "warn").length;
    const status = warnings === 0 ? "good" : warnings === 1 ? "watch" : "at-risk";
    return { name, status, warnings, attendance, lectures: attended, absences, checks };
  }).sort((a, b) => a.status.localeCompare(b.status) === 0 ? a.name.localeCompare(b.name) : (a.status === "at-risk" ? -1 : b.status === "at-risk" ? 1 : a.status === "watch" ? -1 : 1));

  return {
    rows,
    total: rows.length,
    good: rows.filter((row) => row.status === "good").length,
    watch: rows.filter((row) => row.status === "watch").length,
    atRisk: rows.filter((row) => row.status === "at-risk").length,
    warnings: rows.reduce((sum, row) => sum + row.warnings, 0),
  };
}

module.exports = {
  COURSE_HEALTH_LEVELS,
  courseHealthReport,
  daysBetween,
  normalizeCourseHealthSettings,
  planForCourse,
};
