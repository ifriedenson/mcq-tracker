"use strict";
/*
 * AP resource hub data.
 *
 * This module stores links, labels and short original descriptions only. It
 * contains no College Board questions, rubrics, videos or other copied
 * material. AP Classroom content is account-gated and is never fetched by the
 * plugin; the user opens it in a browser.
 *
 * Links were checked on 2026-10-29. AP Daily has been folded into AP Videos in
 * AP Classroom, so no separate AP Daily URL is shipped.
 */

const AP_RESOURCES_CHECKED_ON = "2026-10-29";

const AP_RESOURCE_TYPES = {
  course: "Course page",
  exam: "Exam format",
  practice: "Released FRQs",
  students: "Dates and registration",
  account: "AP Classroom",
  calendar: "Exam calendar",
};

const AP_RESOURCE_COURSES = [
  {
    id: "ap-biology",
    name: "AP Biology",
    slug: "ap-biology",
    studentsSlug: "ap-biology",
  },
  {
    id: "ap-calculus-ab",
    name: "AP Calculus AB",
    slug: "ap-calculus-ab",
    studentsSlug: "ap-calculus-ab",
  },
  {
    id: "ap-english-language",
    name: "AP English Language and Composition",
    slug: "ap-english-language-and-composition",
    studentsSlug: "ap-english-language-and-composition",
  },
  {
    id: "ap-us-history",
    name: "AP United States History",
    slug: "ap-united-states-history",
    studentsSlug: "ap-united-states-history",
  },
];

const AP_RESOURCE_POLICY = [
  "This is a link index, not a copy of AP material. Prompts, rubrics, videos and question banks stay on College Board's sites.",
  "AP Classroom and AP Videos need your own College Board account. The plugin never signs in, scrapes or stores that content.",
  "AP is a trademark of the College Board. This plugin is not affiliated with or endorsed by the College Board.",
];

function apCentral(slug, suffix) {
  return `https://apcentral.collegeboard.org/courses/${slug}${suffix || ""}`;
}

function apStudents(slug) {
  return `https://apstudents.collegeboard.org/courses/${slug}`;
}

/** Return the ordered "start here" set for one supported AP course. */
function resourcesForCourse(courseId) {
  const course = AP_RESOURCE_COURSES.find((item) => item.id === courseId) || AP_RESOURCE_COURSES[0];
  return {
    course,
    checkedOn: AP_RESOURCES_CHECKED_ON,
    resources: [
      {
        id: "course-page",
        type: "course",
        title: `${course.name} on AP Central`,
        description: "The official course home: course and exam description, unit guides, teacher resources and the current exam overview.",
        url: apCentral(course.slug),
      },
      {
        id: "exam-format",
        type: "exam",
        title: "Exam format and section weights",
        description: "Official section structure, timing, question counts, calculator rules and the exam date for this course.",
        url: apCentral(course.slug, "/exam"),
      },
      {
        id: "released-frqs",
        type: "practice",
        title: "Released free-response questions",
        description: "Past free-response questions with scoring guidelines, sample student responses and reader commentary. Use these for timed practice and self-grading.",
        url: apCentral(course.slug, "/exam/past-exam-questions"),
      },
      {
        id: "ap-students",
        type: "students",
        title: `${course.name} on AP Students`,
        description: "The student-facing course page with the exam date, registration and fee deadlines, and what to bring on exam day.",
        url: apStudents(course.studentsSlug),
      },
      {
        id: "ap-classroom",
        type: "account",
        title: "AP Classroom and AP Videos",
        description: "Sign in with your own College Board account for AP Videos (formerly AP Daily), unit progress checks and the question bank. Account-gated; the plugin only opens the page.",
        url: "https://apclassroom.collegeboard.org/",
      },
      {
        id: "exam-calendar",
        type: "calendar",
        title: "AP exam calendar",
        description: "Official dates for every AP exam, including late-testing windows. Check this before adding exam dates to the calendar.",
        url: "https://apstudents.collegeboard.org/exam-calendar",
      },
    ],
  };
}

/** All resources across courses, deduplicated by URL, for tests and exports. */
function allResources() {
  const seen = new Set();
  const out = [];
  for (const course of AP_RESOURCE_COURSES) {
    for (const resource of resourcesForCourse(course.id).resources) {
      if (seen.has(resource.url)) continue;
      seen.add(resource.url);
      out.push({ ...resource, course: course.id });
    }
  }
  return out;
}

function resourceTypeLabel(type) {
  return AP_RESOURCE_TYPES[type] || "Resource";
}

module.exports = {
  AP_RESOURCES_CHECKED_ON,
  AP_RESOURCE_COURSES,
  AP_RESOURCE_POLICY,
  AP_RESOURCE_TYPES,
  allResources,
  resourceTypeLabel,
  resourcesForCourse,
};
