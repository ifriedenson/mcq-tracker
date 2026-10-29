"use strict";
// Exam-aware scheduling caps: upcoming exams shorten review intervals without
// ever extending them, for both questions and cards.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const cm = T.calendarModel;

const at = (month, day) => new Date(2026, month - 1, day, 9, 0);
const key = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const exam = (summary, start) => ({ summary, dtstart: start, dateKey: key(start), allDay: false });

test("calendar: exam course matching handles codes and avoids precalculus", () => {
  assert.equal(cm.examMatchesCourse(exam("Calculus - Final Exam", at(11, 10)), "Calculus"), true);
  assert.equal(cm.examMatchesCourse(exam("MATH 221 Final Exam", at(11, 10)), "MATH 221 - Linear Algebra"), true);
  assert.equal(cm.examMatchesCourse(exam("Linear Algebra Final", at(11, 10)), "MATH 221 - Linear Algebra"), true);
  assert.equal(cm.examMatchesCourse(exam("Precalculus Final Exam", at(11, 10)), "Calculus"), false);
  assert.equal(cm.examMatchesCourse(exam("Calculus Final Exam", at(11, 10)), ""), false);
});

test("calendar: the soonest future exam for a course wins", () => {
  const events = [
    exam("Calculus Final Exam", at(11, 20)),
    exam("Calculus Midterm", at(11, 10)),
    exam("Physics Final Exam", at(11, 5)),
  ];
  const next = cm.nextExamForCourse(events, "Calculus", at(11, 1));
  assert.equal(next.summary, "Calculus Midterm");
  assert.equal(cm.nextExamForCourse(events, "Chemistry", at(11, 1)), null);
});

test("calendar: the cap is the day before the exam and never before today", () => {
  assert.equal(cm.examReviewCap(exam("Calculus Final Exam", at(11, 10)), at(11, 1)).date, "2026-11-09");
  assert.equal(cm.examReviewCap(exam("Calculus Final Exam", at(11, 10)), at(11, 10)).date, "2026-11-10");
  assert.equal(cm.examReviewCap(exam("Calculus Final Exam", at(11, 10)), at(11, 20)), null);
});

test("scheduling: a cap moves a due date earlier but never later", () => {
  const now = at(11, 1);
  const cap = { date: "2026-11-01", examDate: "2026-11-02", name: "Calculus Final Exam" };
  const fm = {};
  const capped = T.applyAttempt(fm, { correct: true, conf: 3, seconds: 20, chosen: "B", now }, [1, 3, 7], { examCap: cap });
  assert.equal(capped.nextReview, "2026-11-01");
  assert.equal(capped.examCap.date, "2026-11-01");
  assert.equal(fm.exam_cap, "2026-11-01");
  assert.equal(fm.exam_cap_name, "Calculus Final Exam");
  assert.equal(fm.exam_cap_exam_date, "2026-11-02");

  const later = {};
  const unchanged = T.applyAttempt(
    later,
    { correct: true, conf: 3, seconds: 20, chosen: "B", now },
    [1, 3, 7],
    { examCap: { date: "2026-11-20", examDate: "2026-11-21", name: "Later Exam" } }
  );
  assert.equal(unchanged.nextReview, "2026-11-02", "the scheduler's earlier date is kept");
  assert.equal(unchanged.examCap, null);
  assert.equal(later.exam_cap, undefined);
});

test("scheduling: FSRS review is capped by an upcoming exam", () => {
  const now = at(11, 1);
  const fm = {};
  const summary = T.applyAttempt(
    fm,
    { correct: true, conf: 2, seconds: 20, chosen: "B", now },
    [1, 3, 7],
    {
      scheduler: "fsrs",
      fsrsRetention: 0.9,
      examCap: { date: "2026-11-01", examDate: "2026-11-02", name: "Calculus Final Exam" },
    }
  );
  assert.equal(summary.scheduler, "fsrs");
  assert.equal(summary.nextReview, "2026-11-01");
  assert.equal(summary.examCap.examDate, "2026-11-02");
  assert.ok(fm.srs, "FSRS state is still written");
});

test("plugin: a question and a card are both capped for their course exam", async () => {
  const notes = [
    { path: "Questions/q.md", fm: { course: "Calculus", answer: "B" } },
    {
      path: "Cards/c.md",
      noFm: true,
      fm: { card_id: "c", item_type: "card", deck: "Biology", course: "Calculus" },
      text: "---\ncard_id: c\nitem_type: card\ndeck: Biology\ncourse: Calculus\n---\n\n## Front\nQ\n\n## Back\nA\n",
    },
  ];
  const app = makeApp(notes);
  // Card notes need card properties rather than the stand-in question_id.
  app.files.forEach((file, i) => {
    if (notes[i].noFm) file.fm = { ...notes[i].fm };
  });
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  plugin.settings.scheduler = "ladder";

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  plugin.calendarEvents = () => [exam("Calculus Final Exam", tomorrow)];

  const now = new Date();
  const summary = await plugin.recordAttempt(app.files[0], {
    correct: true,
    chosen: "B",
    conf: 3,
    seconds: 20,
    now,
  });
  assert.equal(summary.examCap.date, key(now));
  assert.equal(app.files[0].fm.next_review, key(now));

  const cardSummary = await plugin.recordCardReview({ file: app.files[1], course: "Calculus", deck: "Biology" }, "good", 20);
  assert.equal(cardSummary.examCap.date, key(now));
  assert.equal(app.files[1].fm.next_review, key(now));
  assert.equal(app.files[1].fm.exam_cap_name, "Calculus Final Exam");
});
