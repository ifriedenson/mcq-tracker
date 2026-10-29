"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const recommend = T.apExamResources;

function entry(overrides) {
  return {
    path: "AP resources/AP Biology/Released free-response questions.md",
    course: "AP Biology",
    courseId: "ap-biology",
    resourceType: "practice",
    checkedOn: "2026-10-01",
    stale: false,
    ...overrides,
  };
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("AP exam resources: the exam title finds the supported AP course", () => {
  assert.equal(recommend.apCourseForExam({ summary: "AP Biology Exam" }).id, "ap-biology");
  assert.equal(recommend.apCourseForExam({ summary: "AP Calculus AB Final" }).id, "ap-calculus-ab");
  assert.equal(recommend.apCourseForExam({ summary: "US History Midterm" }), null);
  assert.equal(recommend.apCourseForExam({}), null);
});

test("AP exam resources: matching resources are ranked fresh first, then practice material", () => {
  const entries = [
    entry({ path: "stale-practice.md", resourceType: "practice", stale: true }),
    entry({ path: "course.md", resourceType: "course", stale: false }),
    entry({ path: "fresh-practice.md", resourceType: "practice", stale: false }),
    entry({ path: "other.md", course: "AP Chemistry", courseId: "ap-chemistry", resourceType: "practice" }),
  ];
  const picked = recommend.recommendApResource({ summary: "AP Biology Exam" }, entries);
  assert.equal(picked.path, "fresh-practice.md");
  assert.equal(recommend.resourceTitle(picked), "fresh-practice");
  assert.equal(recommend.rankApResources(entries).at(-1).path, "stale-practice.md");
});

test("AP exam resources: an explicitly attached note wins over a fresher generic candidate", () => {
  const attached = entry({ path: "attached.md", resourceType: "course", stale: true, examUid: "exam-1" });
  const fresh = entry({ path: "fresh.md", resourceType: "practice", stale: false });
  assert.equal(recommend.isAttachedToExam(attached, { uid: "exam-1" }), true);
  assert.equal(recommend.recommendApResource({ uid: "exam-1", summary: "AP Biology Exam" }, [fresh, attached]).path, "attached.md");
  assert.equal(recommend.recommendApResource({ uid: "exam-2", summary: "AP Biology Exam" }, [fresh, attached]).path, "fresh.md");
});

test("AP exam resources: a non-AP exam or another course gets no recommendation", () => {
  const entries = [entry()];
  assert.equal(recommend.recommendApResource({ summary: "Chemistry Final Exam" }, entries), null);
  assert.equal(recommend.recommendApResource({ summary: "AP Calculus AB Exam" }, entries), null);
});

test("today: the next AP exam shows one saved resource and opens it", async () => {
  const now = new Date();
  const examStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 9, 0);
  const examEnd = new Date(examStart.getTime() + 2 * 60 * 60 * 1000);
  const resourcePath = "AP resources/AP Biology/Released free-response questions.md";
  const app = makeApp([
    {
      path: resourcePath,
      fm: {
        type: "ap_resource",
        ap_course: "ap-biology",
        course: "AP Biology",
        unit: "Unit 3",
        resource_type: "practice",
        source_url: "https://apcentral.collegeboard.org/courses/ap-biology/exam/past-exam-questions",
        checked_on: dayKey(now),
        official: true,
        tags: ["ap", "ap-biology", "unit-3"],
      },
      text: "An official AP resource link.",
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  plugin.settings.reference.enabled = true;
  plugin.calendarEvents = () => [
    {
      uid: "exam",
      summary: "AP Biology Exam",
      allDay: false,
      dtstart: examStart,
      dtend: examEnd,
      dateKey: dayKey(examStart),
    },
  ];
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  const texts = dom.texts();
  assert.ok(texts.includes("Next exam"));
  assert.ok(texts.some((text) => text.includes("Saved resource")));
  assert.ok(texts.some((text) => text.includes("Released free-response questions")));
  assert.ok(texts.includes("Attach to exam"));
  await dom.click("Attach to exam");
  assert.equal(app.files[0].fm.exam_uid, "exam");
  assert.ok(dom.texts().some((text) => text.includes("Attached resource")));
  await dom.click("Open resource");
  assert.deepEqual(app.opened, [resourcePath]);
});

test("today: a stale saved resource is labelled instead of hidden", async () => {
  const now = new Date();
  const examStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 9, 0);
  const app = makeApp([
    {
      path: "AP resources/AP Biology/Old resource.md",
      fm: {
        type: "ap_resource",
        ap_course: "ap-biology",
        course: "AP Biology",
        resource_type: "course",
        source_url: "https://apcentral.collegeboard.org/courses/ap-biology",
        checked_on: "2020-01-01",
        official: true,
      },
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  plugin.settings.reference.enabled = true;
  plugin.calendarEvents = () => [
    {
      uid: "exam",
      summary: "AP Biology Exam",
      allDay: false,
      dtstart: examStart,
      dtend: new Date(examStart.getTime() + 60 * 60 * 1000),
      dateKey: dayKey(examStart),
    },
  ];
  const dom = makeDom();
  const view = new T.TodayView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().some((text) => text.includes("stale")));
  assert.ok(dom.texts().some((text) => text.includes("Old resource")));
});
