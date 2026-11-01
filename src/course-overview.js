"use strict";
/*
 * One read-only "what do I need to learn for this course" view. Every section
 * is derived from an existing store; this module never writes.
 */
const { str, localDate } = require("./util");
const courseIdentity = require("./course-identity");
const { listExams } = require("./exams");
const { planProgress } = require("./study-workspace");

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function openAssignment(assignment) {
  return assignment && assignment.open !== false && assignment.done !== true;
}

function courseOverview(courseId, ctx) {
  const input = asObject(ctx);
  const settings = input.settings || {};
  const today = str(input.today || localDate()).slice(0, 10);
  const info = courseIdentity.courseDetails(settings, courseId);
  const name = info.name || str(courseId);
  const same = (value) => courseIdentity.sameCourse(settings, value, courseId);
  const exams = Array.isArray(input.exams)
    ? input.exams
    : listExams({ settings, events: input.events, assignments: input.assignments, plans: input.plans, today, includePast: true });
  const futureExams = exams.filter((exam) => exam.date >= today && same(exam.course)).sort((a, b) => a.date.localeCompare(b.date));
  const nextExam = futureExams[0] || null;
  const studyPlan = input.studyPlan && (!input.studyPlan.course || same(input.studyPlan.course)) && (!nextExam || input.studyPlan.examDay === nextExam.date) ? input.studyPlan : null;
  const lastPast = exams.filter((exam) => exam.date < today && same(exam.course)).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const lectures = (Array.isArray(input.lectures) ? input.lectures : [])
    .filter((lecture) => same(lecture.course) && (!lastPast || !lecture.date || lecture.date > lastPast.date))
    .sort((a, b) => b.date.localeCompare(a.date));
  const readings = (Array.isArray(input.readings) ? input.readings : [])
    .filter((reading) => !reading.course || same(reading.course))
    .map((reading) => ({
      ...reading,
      course: name,
      pagesRemaining: Math.max(0, Number(reading.pagesRemaining ?? reading.remainingPages) || 0),
      behindPages: Math.max(0, Number(reading.behindPages ?? reading.behindBy) || 0),
      dueDate: str(reading.dueDate || reading.due || "").slice(0, 10),
      source: "reading",
    }));
  const assignments = (Array.isArray(input.assignments) ? input.assignments : [])
    .filter((assignment) => same(assignment.course) && openAssignment(assignment))
    .sort((a, b) => str(a.due || "9999-12-31").localeCompare(str(b.due || "9999-12-31")));
  const tasks = (Array.isArray(input.tasks) ? input.tasks : [])
    .filter((task) => same(task.course) && !task.done)
    .sort((a, b) => str(a.due || "9999-12-31").localeCompare(str(b.due || "9999-12-31")));
  const plan = (Array.isArray(input.plans) ? input.plans : []).find((row) => same(row.course)) || null;
  const progress = plan ? planProgress(plan) : { passes: 0, target: 0, percent: 0, complete: false };
  const course = (Array.isArray(input.courses) ? input.courses : []).find((row) => same(row.name || row.course)) || null;
  const grade = course ? { current: course.current ?? null, letter: course.letter || "", weighted: course.weighted ?? null, graded: Number(course.graded) || 0, credits: Number(course.credits) || 0 } : null;

  const sections = [];
  if (nextExam) {
    const topics = Array.isArray(nextExam.topics) ? nextExam.topics : [];
    const readiness = studyPlan
      ? ` · ${studyPlan.daysLeft} day${studyPlan.daysLeft === 1 ? "" : "s"} left · ${studyPlan.readiness === null ? "readiness not set" : `readiness ${studyPlan.readiness}%`}`
      : "";
    const evidence = studyPlan && Array.isArray(studyPlan.readinessEvidence)
      ? studyPlan.readinessEvidence.map((row) => `${row.label}: ${row.value == null ? "—" : row.value}${row.detail ? ` (${row.detail})` : ""}`).join(" · ")
      : "";
    sections.push({
      id: "exam",
      title: "Next exam",
      rows: [{
        id: nextExam.id,
        label: nextExam.title,
        detail: `${nextExam.date}${nextExam.time ? ` · ${nextExam.time}` : ""}${nextExam.weight ? ` · weight ${nextExam.weight}` : ""}${readiness}${topics.length ? ` · topics: ${topics.join(", ")}` : ""}`,
        source: "exam",
        exam: nextExam,
        path: nextExam.assignment && nextExam.assignment.file ? nextExam.assignment.file.path : "",
        evidence,
      }],
    });
  }
  if (!progress.complete && progress.target > 0) {
    sections.push({
      id: "topics",
      title: "Topics",
      rows: [{
        id: "topic-plan",
        label: `${Math.max(0, progress.target - progress.passes)} topic ${progress.target - progress.passes === 1 ? "pass" : "passes"} left`,
        detail: `${progress.passes}/${progress.target} passes complete`,
        source: "plan",
        plan,
      }],
    });
  }
  if (lectures.length) {
    sections.push({
      id: "lectures",
      title: "Lectures",
      rows: lectures.slice(0, 8).map((lecture) => ({
        id: lecture.id,
        label: lecture.title,
        detail: `${lecture.date}${lecture.topicList && lecture.topicList.length ? ` · ${lecture.topicList.join(", ")}` : ""}`,
        source: "lecture",
        notePath: lecture.notePath || "",
        lecture,
      })),
    });
  }
  if (readings.length) {
    sections.push({
      id: "readings",
      title: "Readings",
      rows: readings.map((reading) => ({
        id: reading.id,
        label: reading.title || "Reading",
        detail: `${reading.pagesRemaining} pages left${reading.behindPages ? ` · ${reading.behindPages} behind` : ""}${reading.dueDate ? ` · due ${reading.dueDate}` : ""}`,
        source: "reading",
        reading,
        path: reading.sourcePath || reading.path || "",
      })),
    });
  }
  if (assignments.length) {
    sections.push({
      id: "assignments",
      title: "Assignments",
      rows: assignments.slice(0, 10).map((assignment) => ({
        id: assignment.id,
        label: assignment.title,
        detail: `${assignment.typeLabel || assignment.type || "Assignment"}${assignment.due ? ` · due ${assignment.due}` : ""}`,
        source: "assignment",
        path: assignment.file && assignment.file.path ? assignment.file.path : "",
        assignment,
      })),
    });
  }
  if (tasks.length) {
    sections.push({
      id: "tasks",
      title: "Tasks",
      rows: tasks.slice(0, 10).map((task) => ({
        id: task.id,
        label: task.title,
        detail: task.due ? `due ${task.due}` : "no due date",
        source: "task",
        task,
        path: task.path || "",
      })),
    });
  }
  if (grade && (grade.graded || grade.current !== null)) {
    sections.push({
      id: "grades",
      title: "Grade",
      rows: [{
        id: "grade-summary",
        label: `${grade.letter || "Grade"}${grade.weighted !== null ? ` · ${grade.weighted}%` : ""}`,
        detail: `${grade.graded} graded item${grade.graded === 1 ? "" : "s"}`,
        source: "grade",
        grade,
      }],
    });
  }
  return {
    id: info.id || str(courseId),
    name,
    course: name,
    color: info.color || (course && course.color) || "",
    folder: info.folder || (course && course.folder) || "",
    nextExam,
    studyPlan,
    lectures,
    readings,
    assignments,
    tasks,
    plan,
    progress,
    grade,
    sections,
  };
}

module.exports = { courseOverview };
