"use strict";
/*
 * Pick one saved AP resource to show beside the next AP exam.
 *
 * Matching is deliberately conservative: the exam title must contain a
 * supported AP course name. Saved notes are then filtered by that course, with
 * fresh links before stale ones and practice material before general pages.
 * Nothing here fetches a URL or copies AP content.
 */
const { courseMatches } = require("./analytics");
const { cleanSubjectTitle } = require("./calendar-model");
const { AP_RESOURCE_COURSES } = require("./ap-resources");
const { str } = require("./util");

const RESOURCE_PRIORITY = {
  practice: 0,
  exam: 1,
  course: 2,
  students: 3,
  account: 4,
  calendar: 5,
};

function examTitle(exam) {
  const raw = [exam && exam.course, exam && (exam.summary || exam.title)].filter(Boolean).join(" ");
  return cleanSubjectTitle(raw) || str(raw).trim();
}

function apCourseForExam(exam) {
  const title = examTitle(exam);
  if (!title) return null;
  return (
    AP_RESOURCE_COURSES.find((course) => courseMatches(title, course.name) || courseMatches(title, course.id)) || null
  );
}

function resourceTitle(entry) {
  const file = str(entry && entry.path).split("/").pop() || "";
  return file.replace(/\.md$/i, "") || "Resource";
}

function rankApResources(entries) {
  return (entries || [])
    .filter(Boolean)
    .slice()
    .sort(
      (a, b) =>
        Number(!!a.stale) - Number(!!b.stale) ||
        (RESOURCE_PRIORITY[a.resourceType] ?? 9) - (RESOURCE_PRIORITY[b.resourceType] ?? 9) ||
        String(b.checkedOn || "").localeCompare(String(a.checkedOn || "")) ||
        String(a.path || "").localeCompare(String(b.path || "")),
    );
}

function isAttachedToExam(entry, exam) {
  const uid = str(exam && exam.uid);
  return !!uid && str(entry && entry.examUid) === uid;
}

function recommendApResource(exam, entries) {
  const attached = (entries || []).filter((entry) => isAttachedToExam(entry, exam));
  if (attached.length) return rankApResources(attached)[0] || null;
  const course = apCourseForExam(exam);
  if (!course) return null;
  const matching = (entries || []).filter(
    (entry) => entry && (entry.courseId === course.id || courseMatches(entry.course, course.name)),
  );
  return rankApResources(matching)[0] || null;
}

module.exports = {
  RESOURCE_PRIORITY,
  apCourseForExam,
  examTitle,
  isAttachedToExam,
  rankApResources,
  recommendApResource,
  resourceTitle,
};
