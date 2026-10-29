"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const q = (path, fm) => ({ file: { path, basename: path.split("/").pop().replace(/\.md$/, "") }, fm: Object.assign({ question_id: "Q" }, fm) });
const day = (map, date) => map.find((d) => d.date === date);

test("analytics heatmap merges study minutes and attempts onto the same day", () => {
  const questions = [
    q("Q/a.md", { history: ["2026-10-26|correct|20|A|1|", "2026-10-26|incorrect|30|B|1|careless"], attempts: 2, correct_count: 1 }),
  ];
  const weeks = T.buildHeatmap([{ date: "2026-10-26", minutes: 75 }], questions, "2026-10-28", 12);
  assert.equal(weeks.length, 12);
  assert.equal(weeks[0].days.length, 7);
  const cell = day(weeks.flatMap((w) => w.days), "2026-10-26");
  assert.equal(cell.minutes, 75);
  assert.equal(cell.attempts, 2);
  assert.equal(cell.level, 4);
  assert.equal(day(weeks.flatMap((w) => w.days), "2026-10-28").future, false);
});

test("analytics levels stay at zero without activity and scale with minutes", () => {
  assert.equal(T.activityLevel({ minutes: 0, attempts: 0 }), 0);
  assert.equal(T.activityLevel({ minutes: 5, attempts: 0 }), 1);
  assert.equal(T.activityLevel({ minutes: 20, attempts: 0 }), 2);
  assert.equal(T.activityLevel({ minutes: 45, attempts: 0 }), 3);
  assert.equal(T.activityLevel({ minutes: 0, attempts: 20 }), 4);
});

test("analytics dashboard reports accuracy, due cards, course time and the weakest skill", () => {
  const today = "2026-10-28";
  const questions = [
    q("Q/a.md", {
      skill: "grammar",
      attempts: 4,
      correct_count: 1,
      time_spent_total: 240,
      history: ["2026-10-27|incorrect|60|A|1|careless"],
    }),
    q("Q/b.md", { skill: "vocab", attempts: 4, correct_count: 4, time_spent_total: 120 }),
  ];
  const cards = [
    { file: { path: "Cards/a.md" }, fm: { attempts: 2, next_review: "2026-10-20" } },
    { file: { path: "Cards/b.md" }, fm: { attempts: 0 } },
  ];
  const studyLog = {
    sessions: [
      { date: "2026-10-27", minutes: 40, course: "Biology" },
      { date: "2026-10-28", minutes: 25, course: "Chemistry" },
    ],
    dailyGoalMinutes: 60,
  };
  const d = T.buildDashboard({ questions, cards, studyLog, today });
  assert.equal(d.overall.attempts, 8);
  assert.equal(d.overall.accuracy, 0.625);
  assert.equal(d.cardStats.total, 2);
  assert.equal(d.cardStats.due, 1);
  assert.equal(d.cardStats.fresh, 1);
  assert.equal(d.study.todayMinutes, 25);
  assert.equal(d.study.streak, 2);
  assert.deepEqual(d.byCourse, [["Biology", 40], ["Chemistry", 25]]);
  assert.equal(d.weak.value, "grammar");
  assert.ok(d.skills.some((r) => r.value === "vocab" && r.accuracy === 1));
});
