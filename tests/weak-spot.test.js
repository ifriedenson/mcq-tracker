"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const weakSpot = T.weakSpot;

const QUESTIONS = [
  { fm: { skill: "Algebra", attempts: 5, correct_count: 1 } },
  { fm: { skill: "Algebra", attempts: 5, correct_count: 2 } },
  { fm: { skill: "Geometry", attempts: 4, correct_count: 4 } },
  { fm: { skill: "Reading", attempts: 0 } },
];

test("weak spots: rows are ranked by accuracy and the weakest enough-attempted skill wins", () => {
  const rows = weakSpot.weakSpotRows(QUESTIONS);
  assert.equal(rows[0].value, "Algebra");
  assert.equal(rows[0].attempts, 10);
  assert.equal(weakSpot.pickWeakSpot(QUESTIONS).value, "Algebra");
  assert.equal(weakSpot.pickWeakSpot([{ fm: { skill: "Algebra", attempts: 0 } }]), null);
});

test("weak spots: the prompt carries only the skill, course and format", () => {
  const prompt = weakSpot.buildWeakSpotPrompt({ skill: "Algebra", course: "Algebra II", kind: "questions", count: 3 });
  assert.match(prompt.user, /skill: Algebra/);
  assert.match(prompt.user, /Course: Algebra II/);
  assert.match(prompt.user, /"questions"/);
  assert.doesNotMatch(prompt.user, /What is/);
  assert.doesNotMatch(prompt.user, /source note/i);
});

test("plugin: weak-spot generation previews items, writes them and records undo", async () => {
  const app = makeApp([
    { path: "Questions/algebra.md", fm: { question_id: "algebra", skill: "Algebra", attempts: 5, correct_count: 1, answer: "B" } },
    { path: "Questions/geometry.md", fm: { question_id: "geometry", skill: "Geometry", attempts: 4, correct_count: 4, answer: "B" } },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  let asked = null;
  let calls = 0;
  plugin.aiComplete = async (system, user) => {
    if (++calls === 1) asked = { system, user };
    return calls === 1
      ? '{"questions":[{"question":"What is 2x when x is 3?","choices":["3","6","9","12"],"answer":"B","explanation":"2 × 3 = 6."}]}'
      : '{"answer":"B","confidence":"high"}';
  };

  const draft = await plugin.generateWeakSpotPractice({ skill: "Algebra", kind: "questions", count: 1, course: "Algebra II" });
  assert.equal(draft.items.length, 1);
  assert.equal(draft.skill, "Algebra");
  assert.equal(draft.ai, true);
  assert.match(asked.user, /skill: Algebra/);
  assert.doesNotMatch(asked.user, /algebra\.md/);
  assert.equal(app.created, undefined, "generation writes nothing");

  const result = await plugin.writeTranscriptPractice(draft, { folder: "Questions/Generated" });
  assert.equal(result.created, 1);
  assert.equal(app.created[0].path, "Questions/Generated/What is 2x when x is 3.md");
  assert.equal(plugin.aiWriteHistory().length, 1);

  const undone = await plugin.undoLastAiWrite();
  assert.equal(undone.removed, 1);
  assert.deepEqual(app.trashed, [app.created[0].path]);
});
