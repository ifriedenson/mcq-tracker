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
const plusDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
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

test("calendar: the cap ramps through T-14, T-7, T-3 and T-1", () => {
  assert.deepEqual(cm.EXAM_CAP_DAYS, [14, 7, 3, 1]);
  const final = exam("Calculus Final Exam", at(11, 30));

  const first = cm.examReviewCap(final, at(11, 1));
  assert.equal(first.date, "2026-11-16");
  assert.equal(first.stage, "T-14");
  assert.equal(first.offsetDays, 14);

  const second = cm.examReviewCap(final, at(11, 16));
  assert.equal(second.date, "2026-11-23");
  assert.equal(second.stage, "T-7");

  const third = cm.examReviewCap(final, at(11, 23));
  assert.equal(third.date, "2026-11-27");
  assert.equal(third.stage, "T-3");

  const last = cm.examReviewCap(final, at(11, 27));
  assert.equal(last.date, "2026-11-29");
  assert.equal(last.stage, "T-1");

  assert.equal(cm.examReviewCap(final, at(11, 29)), null, "the last checkpoint is already today");
  assert.equal(cm.examReviewCap(final, at(11, 30)), null, "exam day has no earlier checkpoint");
  assert.equal(cm.examReviewCap(final, at(12, 1)), null, "past exams do not cap anything");
});

test("calendar: a nearer exam skips checkpoints that are already past", () => {
  const soon = exam("Calculus Quiz", at(11, 10));
  assert.equal(cm.examReviewCap(soon, at(11, 1)).date, "2026-11-03");
  assert.equal(cm.examReviewCap(soon, at(11, 3)).date, "2026-11-07");
  assert.equal(cm.examReviewCap(soon, at(11, 7)).date, "2026-11-09");
  assert.equal(cm.examReviewCap(soon, at(11, 9)), null);
});

test("scheduling: a cap moves a due date earlier but never later or onto today", () => {
  const now = at(11, 1);
  const cap = { date: "2026-11-02", examDate: "2026-11-03", name: "Calculus Final Exam" };
  const fm = {};
  const capped = T.applyAttempt(fm, { correct: true, conf: 3, seconds: 20, chosen: "B", now }, [3, 7], { examCap: cap });
  assert.equal(capped.nextReview, "2026-11-02");
  assert.equal(capped.examCap.date, "2026-11-02");
  assert.equal(fm.exam_cap, "2026-11-02");
  assert.equal(fm.exam_cap_name, "Calculus Final Exam");
  assert.equal(fm.exam_cap_exam_date, "2026-11-03");

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

  const sameDay = {};
  const noDouble = T.applyAttempt(
    sameDay,
    { correct: true, conf: 3, seconds: 20, chosen: "B", now },
    [3, 7],
    { examCap: { date: "2026-11-01", examDate: "2026-11-02", name: "Exam tomorrow" } }
  );
  assert.equal(noDouble.nextReview, "2026-11-04");
  assert.equal(noDouble.examCap, null);
  assert.equal(sameDay.exam_cap, undefined);
});

test("scheduling: review after the exam releases the cap and clears its fields", () => {
  const fm = { exam_cap: "2026-11-09", exam_cap_name: "Calculus Final", exam_cap_exam_date: "2026-11-10" };
  const summary = T.applyAttempt(
    fm,
    { correct: true, conf: 3, seconds: 20, chosen: "B", now: at(11, 11) },
    [1, 3, 7],
    { examCap: null }
  );
  assert.equal(summary.nextReview, "2026-11-12");
  assert.equal(summary.examCap, null);
  assert.equal(fm.exam_cap, undefined);
  assert.equal(fm.exam_cap_name, undefined);
  assert.equal(fm.exam_cap_exam_date, undefined);
});

test("scheduling: FSRS review is capped by the next exam checkpoint", () => {
  const now = at(11, 1);
  const fm = {};
  const summary = T.applyAttempt(
    fm,
    { correct: true, conf: 2, seconds: 20, chosen: "B", now },
    [1, 3, 7],
    {
      scheduler: "fsrs",
      fsrsRetention: 0.9,
      examCap: { date: "2026-11-02", examDate: "2026-11-03", name: "Calculus Final Exam" },
    }
  );
  assert.equal(summary.scheduler, "fsrs");
  assert.equal(summary.nextReview, "2026-11-02");
  assert.equal(summary.examCap.examDate, "2026-11-03");
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
  plugin.settings.intervals = [1, 3, 7, 21, 60];
  // Seed a long ladder rung so both next reviews land after the exam.
  app.files[0].fm.streak = 3;
  app.files[1].fm.streak = 3;

  const now = new Date();
  const examDay = plusDays(now, 5);
  plugin.calendarEvents = () => [exam("Calculus Final Exam", examDay)];
  const expectedCap = key(plusDays(now, 2));

  const summary = await plugin.recordAttempt(app.files[0], {
    correct: true,
    chosen: "B",
    conf: 3,
    seconds: 20,
    now,
  });
  assert.equal(summary.examCap.date, expectedCap);
  assert.equal(summary.examCap.stage, "T-3");
  assert.equal(app.files[0].fm.next_review, expectedCap);

  const cardSummary = await plugin.recordCardReview({ file: app.files[1], course: "Calculus", deck: "Biology" }, "good", 20);
  assert.equal(cardSummary.examCap.date, expectedCap);
  assert.equal(app.files[1].fm.next_review, expectedCap);
  assert.equal(app.files[1].fm.exam_cap_name, "Calculus Final Exam");
});

test("plugin: a manual assignment exam caps reviews without a calendar feed", async () => {
  const now = new Date();
  const examDay = plusDays(now, 5);
  const notes = [
    { path: "Questions/q.md", fm: { course: "Calculus", answer: "B" } },
    {
      path: "Assignments/calculus-final.md",
      noFm: true,
      fm: {
        assignment: true,
        assignment_id: "calculus-final",
        title: "Calculus Final",
        course: "Calculus",
        type: "exam",
        due: key(examDay),
        status: "todo",
      },
    },
  ];
  const app = makeApp(notes);
  app.files[1].fm = notes[1].fm;
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.calendar.enabled = true;
  plugin.settings.scheduler = "ladder";
  plugin.settings.intervals = [1, 3, 7, 21, 60];
  // Seed a long ladder rung so the computed review would land after the exam.
  app.files[0].fm.streak = 3;
  plugin.calendarEvents = () => [];

  const expectedCap = key(plusDays(now, 2));
  const summary = await plugin.recordAttempt(app.files[0], {
    correct: true,
    chosen: "B",
    conf: 3,
    seconds: 20,
    now,
  });
  assert.equal(summary.examCap.date, expectedCap);
  assert.equal(summary.examCap.stage, "T-3");
  assert.equal(app.files[0].fm.next_review, expectedCap);
  assert.equal(app.files[0].fm.exam_cap_name, "Calculus Final");
});
