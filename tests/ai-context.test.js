"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const context = T.aiContext;

function dayKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fakePlugin() {
  const examStart = new Date();
  examStart.setDate(examStart.getDate() + 5);
  examStart.setHours(9, 0, 0, 0);
  const examEnd = new Date(examStart.getTime() + 60 * 60 * 1000);
  return {
    getQuestions: () => [
      { fm: { attempts: 4, correct_count: 2, skill: "Algebra", next_review: "2020-01-01" } },
      { fm: { attempts: 0, skill: "Geometry" } },
    ],
    getCards: () => [{ fm: { attempts: 2, next_review: "2020-01-01" } }, { fm: {} }],
    calendarEvents: () => [
      { uid: "exam", summary: "AP Biology Exam", allDay: false, dateKey: dayKey(examStart), dtstart: examStart, dtend: examEnd },
    ],
  };
}

test("AI context: every toggle is off by default and only true values survive normalization", () => {
  assert.deepEqual(context.normalizeAiContext(undefined), { stats: false, due: false, exams: false });
  assert.deepEqual(context.normalizeAiContext({ stats: true, due: "yes", exams: 1 }), { stats: true, due: false, exams: false });
  assert.equal(context.anyContext({}), false);
  assert.equal(context.anyContext({ exams: true }), true);
  assert.equal(context.buildStudyContext(fakePlugin(), {}), "", "nothing is built while every toggle is off");
});

test("AI context: selected toggles add only their own aggregate lines", () => {
  const plugin = fakePlugin();
  const stats = context.buildStudyContext(plugin, { stats: true });
  assert.match(stats, /READ-ONLY STUDY CONTEXT/);
  assert.match(stats, /2 questions; 1 attempted; 4 attempts; accuracy 50%/);
  assert.match(stats, /Weakest skill with at least 3 attempts: Algebra \(50%, 4 attempts\)/);
  assert.doesNotMatch(stats, /Due today/);
  assert.doesNotMatch(stats, /Next exam/);

  const due = context.buildStudyContext(plugin, { due: true });
  assert.match(due, /Due today: 1 question \(1 unseen\), 1 card due \(1 new\)/);
  assert.doesNotMatch(due, /accuracy/);

  const exams = context.buildStudyContext(plugin, { exams: true });
  assert.match(exams, /Next exam: AP Biology Exam on \d{4}-\d{2}-\d{2} \(in 5 days\)/);
});

test("AI context: the general assistant prompt includes study context only when it is enabled", () => {
  const app = { vault: { adapter: {} } };
  const withContext = T.buildGeneralContext(app, "tutor", "private", context.buildStudyContext(fakePlugin(), { exams: true }));
  assert.match(withContext, /READ-ONLY STUDY CONTEXT/);
  assert.match(withContext, /Next exam: AP Biology Exam/);
  const without = T.buildGeneralContext(app, "tutor", "private");
  assert.doesNotMatch(without, /READ-ONLY STUDY CONTEXT/);
});
