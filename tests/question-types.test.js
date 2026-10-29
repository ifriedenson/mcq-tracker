"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();
const A = T.answerTypes;

const choices = [
  { letter: "A", text: "Alpha" },
  { letter: "B", text: "Beta" },
  { letter: "C", text: "Gamma" },
  { letter: "D", text: "Delta" },
];
const tfChoices = [
  { letter: "A", text: "True" },
  { letter: "B", text: "False" },
];

test("true/false and select-all keys are read from properties", () => {
  assert.equal(A.parseChoiceSet("A, C").join(""), "AC");
  assert.equal(A.parseChoiceSet("C and A").join(""), "AC");
  assert.equal(A.parseChoiceSet("AC").join(""), "AC");
  assert.equal(A.parseChoiceSet("True").length, 0);
  assert.equal(A.formatChoiceSet(A.parseChoiceSet("c, a")), "A, C");

  assert.equal(A.normalizeTrueFalse("True"), "True");
  assert.equal(A.normalizeTrueFalse("f"), "False");
  assert.equal(A.normalizeTrueFalse("B", tfChoices), "False");
  assert.equal(A.normalizeTrueFalse("A", tfChoices), "True");
  assert.equal(A.normalizeTrueFalse("Beta", choices), "");
});

test("the answer section can carry a set or a true/false key", () => {
  assert.equal(T.answerSetFromSection("Correct Answers: A, C"), "A, C");
  assert.equal(T.answerSetFromSection("Answer: B and D"), "B, D");
  assert.equal(T.answerSetFromSection("Correct Answer: B"), "");
  assert.equal(T.answerTrueFalseFromSection("Correct Answer: False"), "False");
  assert.equal(T.answerTrueFalseFromSection("Correct Answer: B"), "");

  const set = T.parseSections("## Question\nQ\n\n## Answer Choices\n- A. Alpha\n- B. Beta\n- C. Gamma\n- D. Delta\n\n## Answer\nAnswers: B and D\n");
  assert.equal(T.findAnswerKey({}, set), "B, D");

  const tf = T.parseSections("## Question\nQ\n\n## Answer Choices\n- A. True\n- B. False\n\n## Answer\nCorrect Answer: B\n");
  assert.equal(T.findAnswerKey({}, tf), "B");
});

test("a question's mode follows its declared type, then its key and choices", () => {
  assert.equal(T.inferMode("mcq", "B", choices), "mcq");
  assert.equal(T.inferMode("Multiple choice (4 choices)", "B", choices), "mcq");
  assert.equal(T.inferMode("spr", "1/2", []), "spr");
  assert.equal(T.inferMode("true_false", "B", tfChoices), "tf");
  assert.equal(T.inferMode("", "True", []), "tf");
  assert.equal(T.inferMode("", "B", tfChoices), "tf");
  assert.equal(T.inferMode("select_all", "A, C", choices), "multi");
  assert.equal(T.inferMode("select-all-that-apply", "A, C", choices), "multi");
  assert.equal(T.inferMode("", "A, C", choices), "multi");
  assert.equal(T.inferMode("mcq", "A, C", choices), "multi");
  assert.equal(T.inferMode("", "B", choices), "mcq");
  assert.equal(T.inferMode("", "", choices), "self");
});

test("true/false and select-all answers are graded as sets", () => {
  assert.equal(T.gradeAnswer({ answer: "True", question_type: "true_false" }, "true"), true);
  assert.equal(T.gradeAnswer({ answer: "True", question_type: "true_false" }, "False"), false);
  assert.equal(T.gradeAnswer({ answer: "A, C", question_type: "select_all" }, "C, A"), true);
  assert.equal(T.gradeAnswer({ answer: "A, C", question_type: "select_all" }, "A, B"), false);
  assert.equal(T.gradeAnswer({ answer: "A, C", question_type: "select_all" }, "A"), false);
  assert.equal(T.gradeAnswer({ answer: "A, C", question_type: "select_all" }, ""), false);

  const detail = T.gradeAnswerDetailed({ answer: "A, C", question_type: "select_all" }, "A, B");
  assert.equal(detail.mode, "multi");
  assert.deepEqual(detail.selected, ["A", "B"]);
  assert.deepEqual(detail.missing, ["C"]);
  assert.deepEqual(detail.extra, ["B"]);
  assert.match(detail.reason, /Missing C/);

  const partial = T.gradeAnswerDetailed({ answer: "A, C", question_type: "select_all" }, "A");
  assert.equal(partial.correct, false);
  assert.deepEqual(partial.missing, ["C"]);

  const tf = T.gradeAnswerDetailed({ answer: "False", question_type: "true_false" }, "TRUE");
  assert.equal(tf.mode, "tf");
  assert.equal(tf.correct, false);
  assert.equal(tf.interpreted, "True");
});

test("a free-text select-all key still compares as a list", () => {
  assert.equal(T.gradeAnswer({ answer: "mitosis, meiosis", question_type: "select_all" }, "meiosis, mitosis"), true);
  assert.equal(T.gradeAnswer({ answer: "mitosis, meiosis", question_type: "select_all" }, "mitosis"), false);
});
