"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const question = (path, fm) => ({ file: { path, basename: path.split("/").pop().replace(/\.md$/, "") }, fm: Object.assign({ question_id: "Q" }, fm) });
const card = (path, fm) => ({ file: { path }, fm: Object.assign({ card_id: "C" }, fm), course: "" });

test("progress mastery bands count untried, weak, developing, strong and mastered questions", () => {
  const questions = [
    question("Q/untried.md", {}),
    question("Q/weak.md", { attempts: 4, correct_count: 1 }),
    question("Q/developing.md", { attempts: 4, correct_count: 3 }),
    question("Q/strong.md", { attempts: 5, correct_count: 4 }),
    question("Q/mastered.md", { attempts: 3, correct_count: 3 }),
  ];
  assert.equal(T.masteryBandOf(questions[0]), "untried");
  assert.equal(T.masteryBandOf(questions[1]), "weak");
  assert.equal(T.masteryBandOf(questions[2]), "developing");
  assert.equal(T.masteryBandOf(questions[3]), "strong");
  assert.equal(T.masteryBandOf(questions[4]), "mastered");
  const mastery = T.buildMastery(questions);
  assert.equal(mastery.total, 5);
  assert.equal(mastery.tried, 4);
  assert.equal(mastery.mastered, 1);
  assert.deepEqual(mastery.bands.map((b) => b.count), [1, 1, 1, 1, 1]);
  assert.equal(mastery.bands[0].pct, 0.2);
});

test("progress mastery scopes list courses once, filter case-insensitively and drive a band", () => {
  const questions = [
    question("Q/a.md", { course: "AP World History", attempts: 1, correct_count: 1 }),
    question("Q/b.md", { course: "ap world history", attempts: 1, correct_count: 0 }),
    question("Q/c.md", { course: "SAT Reading", attempts: 1, correct_count: 0 }),
    question("Q/d.md", {}),
  ];
  assert.deepEqual(T.masteryScopes(questions), ["AP World History", "SAT Reading"]);
  const scoped = T.scopeQuestions(questions, "ap world history");
  assert.deepEqual(scoped.map((q) => q.file.path), ["Q/a.md", "Q/b.md"]);
  assert.equal(T.scopeQuestions(questions, "").length, 4);
  assert.deepEqual(T.bandQuestions(scoped, "mastered").map((q) => q.file.path), ["Q/a.md"]);
  assert.deepEqual(T.bandQuestions(scoped, "weak").map((q) => q.file.path), ["Q/b.md"]);
  assert.deepEqual(T.bandQuestions(scoped, "nonsense"), []);
  const progress = T.buildProgress({ questions, today: "2026-10-28", masteryScope: "SAT Reading" });
  assert.equal(progress.masteryScope, "SAT Reading");
  assert.equal(progress.mastery.total, 1);
  assert.equal(progress.mastery.bands.find((band) => band.id === "weak").count, 1);
  assert.deepEqual(progress.masteryScopes, ["AP World History", "SAT Reading"]);
});

test("progress weeks bucket attempts and study minutes by Monday-start week", () => {
  const today = "2026-10-28"; // a Wednesday
  const questions = [
    question("Q/a.md", {
      history: [
        "2026-10-12|correct|10|A|1|", // two weeks before the current week
        "2026-10-26|incorrect|10|B|1|",
        "2026-10-27|correct|10|A|1|",
        "2026-11-02|correct|10|A|1|", // future: ignored
      ],
    }),
  ];
  const sessions = [
    { date: "2026-10-26", minutes: 25 },
    { date: "2026-10-26", minutes: 5 },
    { date: "2026-10-20", minutes: 40 },
  ];
  const weeks = T.buildWeeks(questions, sessions, today, 3);
  assert.equal(weeks.length, 3);
  assert.deepEqual(weeks.map((w) => w.start), ["2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.equal(weeks[0].attempts, 1);
  assert.equal(weeks[0].accuracy, 1);
  assert.equal(weeks[1].minutes, 40);
  assert.equal(weeks[1].activeDays, 1);
  assert.equal(weeks[2].attempts, 2);
  assert.equal(weeks[2].correct, 1);
  assert.equal(weeks[2].accuracy, 0.5);
  assert.equal(weeks[2].minutes, 30);
  assert.equal(weeks[2].activeDays, 2);
});

test("progress momentum compares this week with last week", () => {
  const today = "2026-10-28";
  const questions = [
    question("Q/a.md", {
      history: ["2026-10-20|incorrect|10|A|1|", "2026-10-26|correct|10|A|1|", "2026-10-27|correct|10|A|1|"],
    }),
  ];
  const sessions = [
    { date: "2026-10-20", minutes: 20 },
    { date: "2026-10-26", minutes: 45 },
  ];
  const weeks = T.buildWeeks(questions, sessions, today, 2);
  const momentum = T.buildMomentum(weeks);
  assert.equal(momentum.attemptsDelta, 1);
  assert.equal(momentum.minutesDelta, 25);
  assert.equal(momentum.accuracyDelta, 100);
  assert.equal(T.buildMomentum([]), null);
});

test("progress courses combine practice accuracy and logged study minutes", () => {
  const questions = [
    question("Q/a.md", { course: "Biology", attempts: 4, correct_count: 3 }),
    question("Q/b.md", { course: "biology", attempts: 2, correct_count: 1 }),
    question("Q/c.md", { course: "Chemistry", attempts: 2, correct_count: 2 }),
    question("Q/d.md", {}),
  ];
  const sessions = [
    { date: "2026-10-26", minutes: 30, course: "Biology" },
    { date: "2026-10-26", minutes: 10, course: "History" },
  ];
  const rows = T.buildCourses(questions, sessions, 6);
  const byCourse = new Map(rows.map((row) => [row.course, row]));
  assert.equal(byCourse.get("Biology").notes, 2);
  assert.equal(byCourse.get("Biology").attempts, 6);
  assert.equal(byCourse.get("Biology").correct, 4);
  assert.equal(byCourse.get("Biology").accuracy, 4 / 6);
  assert.equal(byCourse.get("Biology").minutes, 30);
  assert.equal(byCourse.get("History").notes, 0);
  assert.equal(byCourse.get("History").minutes, 10);
  assert.equal(byCourse.get("No course").notes, 1);
  assert.equal(T.buildCourses(questions, sessions, 2).length, 2);
});

test("progress dashboard reports today's goal, due work and the weakest skill", () => {
  const today = "2026-10-28";
  const questions = [
    question("Q/a.md", { skill: "grammar", attempts: 4, correct_count: 1, next_review: "2026-10-20" }),
    question("Q/b.md", { skill: "vocab", attempts: 4, correct_count: 4, next_review: "2026-12-01" }),
    question("Q/c.md", { skill: "vocab" }),
    question("Q/d.md", { skill: "vocab", study_status: "suspended", attempts: 2, correct_count: 2, next_review: "2026-01-01" }),
  ];
  const cards = [
    card("Cards/a.md", { attempts: 2, next_review: "2026-10-20" }),
    card("Cards/b.md", { attempts: 0 }),
    card("Cards/c.md", { attempts: 2, next_review: "2026-10-20", study_status: "suspended" }),
  ];
  const studyLog = {
    sessions: [{ date: today, minutes: 40 }, { date: "2026-10-27", minutes: 20 }],
    dailyGoalMinutes: 60,
  };
  const progress = T.buildProgress({ questions, cards, studyLog, today, weeks: 4 });
  assert.equal(progress.goal.minutes, 40);
  assert.equal(progress.goal.goalMinutes, 60);
  assert.equal(progress.goal.remaining, 20);
  assert.equal(progress.goal.pct, 67);
  assert.equal(progress.goal.streak, 2);
  assert.equal(progress.study.weekMinutes, 60);
  assert.equal(progress.next.due, 1);
  assert.equal(progress.next.dueCards, 1);
  assert.equal(progress.next.fresh, 1);
  assert.equal(progress.next.freshCards, 1);
  assert.equal(progress.next.hidden, 1);
  assert.equal(progress.next.weak.value, "grammar");
  assert.equal(progress.overall.notes, 4);
  assert.equal(progress.weeks.length, 4);
  assert.equal(progress.mastery.total, 4);
});
