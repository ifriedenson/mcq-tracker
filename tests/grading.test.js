"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();

test("multiple choice and fill-in answers are graded", () => {
  assert.equal(T.gradeAnswer({ answer: "B" }, "b"), true);
  assert.equal(T.gradeAnswer({ answer: "B" }, "C"), false);
  assert.equal(T.gradeAnswer({ answer: "1/2|0.5", question_type: "spr" }, " 0.5 "), true);
  assert.equal(T.gradeAnswer({ answer: "" }, "A"), null);
});

test("a correct answer extends the streak and schedules a review; a miss resets it", () => {
  const fm = {};
  const now = new Date(2026, 9, 26, 10, 0);
  T.applyAttempt(fm, { correct: true, chosen: "A", conf: 3, seconds: 40, now }, [1, 3, 7]);
  assert.equal(fm.attempts, 1);
  assert.equal(fm.correct_count, 1);
  assert.equal(fm.streak, 1);
  assert.equal(fm.next_review, "2026-10-27");
  T.applyAttempt(fm, { correct: true, chosen: "A", conf: 3, seconds: 20, now }, [1, 3, 7]);
  assert.equal(fm.streak, 2);
  assert.equal(fm.next_review, "2026-10-29");
  assert.equal(fm.time_spent_total, 60);
  T.applyAttempt(fm, { correct: false, chosen: "B", conf: 2, seconds: 10, now }, [1, 3, 7]);
  assert.equal(fm.streak, 0);
  assert.equal(fm.result, "incorrect");
  assert.equal(fm.history.length, 3);
});

test("an attempt with no confidence rating (timed test) uses the normal schedule", () => {
  const fm = {};
  T.applyAttempt(fm, { correct: true, chosen: "A", conf: 0, seconds: 40, now: new Date(2026, 9, 26) }, [1, 3, 7]);
  assert.equal(fm.streak, 1);
  assert.equal(fm.next_review, "2026-10-27");
});

test("the reason for a miss is saved in the properties and the last history line", () => {
  const fm = { history: ["d|incorrect|5|A|1|"] };
  T.setLastErrorType(fm, "careless");
  assert.equal(fm.last_error_type, "careless");
  assert.equal(fm.history[0], "d|incorrect|5|A|1|careless");
});

test("a note's answer key is found in the properties or the text", () => {
  const sec = T.parseSections("## Question\nQ?\n\n## Answer Choices\n- A. x\n- B. y\n\n## Answer\n**Correct Answer: B**\n");
  assert.equal(sec.choices.length, 2);
  assert.equal(T.answerFromSection(sec.answer), "B");
});
