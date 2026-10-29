"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const transcript = T.transcript;

test("adaptive parity: a don't-know skip is logged without counting as wrong", () => {
  const fm = {
    attempts: 4,
    correct_count: 3,
    streak: 3,
    history: ["2026-10-20 10:00:00|correct|10|A|2||old"],
    next_review: "2026-11-20",
  };
  const result = T.applySkip(fm, new Date(2026, 9, 29, 12, 0, 0), "skip-1");
  assert.equal(result.skipped, true);
  assert.equal(fm.attempts, 4);
  assert.equal(fm.correct_count, 3);
  assert.equal(fm.streak, 3);
  assert.equal(fm.skip_count, 1);
  assert.equal(fm.last_skipped, "2026-10-29");
  assert.equal(fm.next_review, "2026-10-30");
  assert.match(fm.history[1], /skipped/);
  assert.match(fm.history[1], /skip-1$/);
});

test("adaptive parity: generation prompts accept any note, difficulty and covered subtopics", () => {
  const prompt = transcript.buildTranscriptQuestionPrompt({
    title: "Cell lecture",
    course: "BIOL 201",
    text: "The membrane is selectively permeable.",
    count: 3,
    difficulty: "hard",
    coveredSubtopics: ["osmosis", "diffusion"],
  });
  assert.match(prompt.user, /from this note/);
  assert.match(prompt.user, /Target difficulty: hard/);
  assert.match(prompt.user, /Already covered: osmosis; diffusion/);
  assert.match(prompt.user, /"subtopic"/);
});

test("adaptive parity: generated questions keep difficulty and subtopic", () => {
  const parsed = transcript.parseAiQuestions(
    JSON.stringify({
      questions: [{
        question: "What is the membrane?",
        choices: ["Rigid", "Selectively permeable", "Empty", "Opaque"],
        answer: "B",
        explanation: "It controls what crosses.",
        difficulty: "medium",
        subtopic: "membrane transport",
      }],
    }),
    3
  );
  assert.equal(parsed.questions[0].difficulty, "medium");
  assert.equal(parsed.questions[0].subtopic, "membrane transport");
  const note = transcript.questionNote(parsed.questions[0], { course: "BIOL 201" }, "Q1", {
    model: "test-model", date: "2026-10-29", sourcePath: "Courses/Bio/lecture.md", sourceKind: "note",
  });
  const { fm } = T.parseNote(note);
  assert.equal(fm.difficulty, "medium");
  assert.equal(fm.subtopic, "membrane transport");
});

test("adaptive parity: the any-note command is registered", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.ok(plugin.commands.some((command) => command.id === "generate-from-note"));
});

test("adaptive parity: plugin recordSkip writes the signal to the note", async () => {
  const app = makeApp([{ path: "Questions/skip.md", fm: { answer: "A", attempts: 2, correct_count: 1, next_review: "2026-12-01" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files[0];
  const summary = await plugin.recordSkip(file);
  assert.equal(summary.skipped, true);
  assert.equal(file.fm.skip_count, 1);
  assert.equal(file.fm.attempts, 2);
  assert.equal(file.fm.next_review <= "2026-10-30", true);
});
