"use strict";
/*
 * P1 review contract: a 0-100 score is the same evidence wherever accuracy,
 * calibration, mastery or the dashboard is calculated. Older binary rows keep
 * their old meaning.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();

function question(fm, path) {
  return { file: { path: path || "Questions/one.md", basename: "one" }, fm: Object.assign({ question_id: "one" }, fm) };
}

test("partial credit: applyAttempt stores the score and every accuracy view reads it", () => {
  const fm = { skill: "Algebra", source_note: "Notes/Algebra.md" };
  const result = T.applyAttempt(
    fm,
    { chosen: "A", correct: true, conf: 2, seconds: 10, score: 60, now: new Date("2026-10-30T10:00:00") },
    [1, 3, 7, 21, 60],
    {}
  );
  assert.equal(result.score, 60);
  assert.equal(fm.last_score, 60);
  assert.equal(T.parseHistory(fm.history)[0].score, 60);
  const q = question(fm);
  assert.equal(T.overallStats([q]).accuracy, 0.6);
  assert.equal(T.computeStats([q], "skill")[0].accuracy, 0.6);
  assert.equal(T.progress.accuracyOf(q), 0.6);
  assert.equal(T.conceptMastery.conceptMasteryRows([q])[0].accuracy, 0.6);

  const calibration = T.analytics.buildCalibration([q], ["Guessing", "Unsure", "Confident"]);
  assert.equal(calibration.buckets[1].accuracy, 0.6);
});

test("partial credit: an old binary row remains fully correct", () => {
  const fm = {};
  T.applyAttempt(fm, { chosen: "A", correct: true, conf: 2, seconds: 10, now: new Date("2026-10-30T10:00:00") }, [1, 3], {});
  assert.equal(T.parseHistory(fm.history)[0].score, null);
  assert.equal(T.overallStats([question(fm)]).accuracy, 1);
});

test("FRQ attempts join the knowledge snapshot and keep their own mastery rows", () => {
  const frq = T.frq.frqKnowledge([
    { course: "AP Biology", courseId: "ap-bio", percent: 50, takenOn: "2026-10-30", path: "AP FRQ attempts/one.md" },
    { course: "AP Biology", courseId: "ap-bio", percent: 70, takenOn: "2026-10-29", path: "AP FRQ attempts/two.md" },
  ]);
  assert.equal(frq.attempts, 2);
  assert.equal(frq.average, 60);
  assert.equal(frq.credit, 1.2);
  assert.equal(frq.courses[0].band, "developing");

  const fm = {};
  T.applyAttempt(fm, { chosen: "A", correct: true, conf: 2, seconds: 10, score: 100, now: new Date("2026-10-30T10:00:00") }, [1, 3], {});
  const q = question(fm);
  const dash = T.analytics.buildDashboard({ questions: [q], frq, today: "2026-10-30" });
  assert.equal(dash.knowledge.attempts, 3);
  assert.equal(Math.round(dash.knowledge.accuracy * 100) / 100, 0.73);
  assert.equal(T.progress.buildProgress({ questions: [q], frq, today: "2026-10-30" }).knowledge.accuracy, dash.knowledge.accuracy);
});
