"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const P = T.quizport;

const QUIZ = {
  title: "Capitals",
  description: "European capitals",
  category: "Geography",
  difficulty: "easy",
  questions: [
    {
      question: "What is the capital of France?",
      choices: ["London", "Paris", "Berlin", "Madrid"],
      answer: 1,
      explanation: "Paris has been the capital since 987 AD.",
      hint: "It is on the Seine.",
    },
    {
      question: "Which of these are capitals?",
      choices: ["Paris", "Lyon", "Berlin", "Munich"],
      answer: [0, 2],
    },
  ],
};

test("quizport: parses title, single and multi-select answers, hints and explanations", () => {
  const parsed = P.parseQuizPortBlock(JSON.stringify(QUIZ));
  assert.equal(parsed.title, "Capitals");
  assert.equal(parsed.description, "European capitals");
  assert.equal(parsed.category, "Geography");
  assert.equal(parsed.questions.length, 2);
  assert.deepEqual(parsed.questions[0].answers, [1]);
  assert.equal(parsed.questions[0].multi, false);
  assert.equal(parsed.questions[0].hint, "It is on the Seine.");
  assert.equal(parsed.questions[0].explanation, "Paris has been the capital since 987 AD.");
  assert.deepEqual(parsed.questions[1].answers, [0, 2]);
  assert.equal(parsed.questions[1].multi, true);
  assert.deepEqual(parsed.questions.map((question) => question.valid), [true, true]);
});

test("quizport: accepts a bare array, letters, choice text and marked choices", () => {
  const array = P.parseQuizPortBlock(JSON.stringify([{ question: "2 + 2?", choices: ["3", "4"], answer: 1 }]));
  assert.equal(array.questions[0].answers[0], 1);

  const letters = P.parseQuizPortBlock(JSON.stringify([{ question: "Pick one", choices: ["a", "b"], answer: "B" }]));
  assert.deepEqual(letters.questions[0].answers, [1]);

  const text = P.parseQuizPortBlock(JSON.stringify([{ question: "Pick one", choices: ["alpha", "beta"], answer: "beta" }]));
  assert.deepEqual(text.questions[0].answers, [1]);

  const marked = P.parseQuizPortBlock(
    JSON.stringify([{ question: "Pick one", choices: [{ text: "alpha", correct: true }, { text: "beta" }] }])
  );
  assert.deepEqual(marked.questions[0].answers, [0]);
});

test("quizport: malformed input reports issues instead of throwing", () => {
  assert.match(P.parseQuizPortBlock("{not json").issues[0], /not valid JSON/);
  assert.match(P.parseQuizPortBlock("").issues[0], /Add QuizPort JSON/);
  assert.match(P.parseQuizPortBlock(JSON.stringify({})).issues[0], /questions array/);
  assert.match(P.parseQuizPortBlock(JSON.stringify({ questions: [] })).issues[0], /no questions/);
  const bad = P.parseQuizPortBlock(JSON.stringify({ questions: [{ question: "Q", choices: ["only"], answer: 5 }] }));
  assert.equal(bad.questions[0].valid, false);
  assert.match(bad.issues.join(" "), /at least two choices/);
  assert.match(bad.issues.join(" "), /no valid answer index/);
});

test("quizport: answers are graded as an exact set", () => {
  const [single, multi] = P.parseQuizPortBlock(JSON.stringify(QUIZ)).questions;
  assert.equal(P.scoreQuizPortAnswer(single, [1]).correct, true);
  assert.equal(P.scoreQuizPortAnswer(single, [0]).correct, false);
  assert.equal(P.scoreQuizPortAnswer(multi, [2, 0]).correct, true);
  assert.equal(P.scoreQuizPortAnswer(multi, [0]).correct, false);
  assert.equal(P.scoreQuizPortAnswer(multi, [0, 1, 2]).correct, false);
});

test("quizport: quiz results count misses and unanswered questions", () => {
  const questions = P.parseQuizPortBlock(JSON.stringify(QUIZ)).questions;
  const result = P.quizPortResult(questions, [{ correct: true }]);
  assert.equal(result.answered, 1);
  assert.equal(result.correct, 1);
  assert.equal(result.percent, 50);
  assert.deepEqual(result.missed, []);
  const failed = P.quizPortResult(questions, [{ correct: false }, { correct: true }]);
  assert.deepEqual(failed.missed, [0]);
  assert.equal(failed.percent, 50);
});

test("quizport: shuffle is deterministic and keeps the same correct choice text", () => {
  const many = Array.from({ length: 12 }, (_value, index) => ({
    question: `Question ${index}`,
    choices: ["alpha", "beta", "gamma"],
    answer: index % 3,
  }));
  const questions = P.parseQuizPortBlock(JSON.stringify(many)).questions;
  const first = P.shuffleQuizPortQuestions(questions, "seed-1");
  const second = P.shuffleQuizPortQuestions(questions, "seed-1");
  assert.deepEqual(first, second);
  const other = P.shuffleQuizPortQuestions(questions, "seed-2");
  assert.notDeepEqual(other.map((question) => question.prompt), first.map((question) => question.prompt));

  for (const original of questions) {
    const shuffled = first.find((question) => question.prompt === original.prompt);
    const before = original.answers.map((index) => original.choices[index].text).sort();
    const after = shuffled.answers.map((index) => shuffled.choices[index].text).sort();
    assert.deepEqual(after, before);
  }
});

test("quizport: the block renders hints, feedback and a missed-only retry", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const dom = makeDom();
  const single = { title: "Capitals", questions: [QUIZ.questions[0]] };
  await plugin.renderQuizPortBlock(JSON.stringify(single), dom.root, { sourcePath: "Quiz.md" });
  assert.ok(dom.texts().includes("Capitals"));
  assert.ok(dom.texts().some((text) => text.includes("What is the capital of France?")));

  await dom.click("Show hint");
  assert.ok(dom.texts().includes("It is on the Seine."));

  await dom.click("A. London");
  assert.ok(dom.texts().includes("Not quite"));
  assert.ok(dom.texts().includes("Paris has been the capital since 987 AD."));
  await dom.click("See results");
  assert.ok(dom.texts().some((text) => /0\/1 correct/.test(text)));
  assert.ok(dom.texts().includes("Retry 1 missed"));
});

test("quizport: file blocks load JSON from the vault and are registered", async () => {
  const app = makeApp([]);
  await app.vault.create("quizzes/capitals.json", JSON.stringify(QUIZ));
  const plugin = new QT(app);
  await plugin.onload();
  assert.ok(plugin.codeBlocks.quizport);
  const dom = makeDom();
  await plugin.renderQuizPortBlock("file: quizzes/capitals.json", dom.root, { sourcePath: "Notes/Test.md" });
  assert.ok(dom.texts().includes("Capitals"));
  assert.ok(dom.texts().some((text) => text.includes("What is the capital of France?")));
});
