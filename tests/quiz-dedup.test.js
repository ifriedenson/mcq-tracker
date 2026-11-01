"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();

test("quiz dedup normalizes markup, punctuation and case but keeps distinct stems", () => {
  const dedup = T.quizDedup;
  assert.equal(dedup.normalizeQuestionStem("  **Pick the gases?** "), "pick the gases");
  assert.equal(dedup.normalizeQuestionStem("Pick   the gases"), "pick the gases");
  assert.equal(dedup.normalizeQuestionStem("Pick the liquids?"), "pick the liquids");
  const result = dedup.uniqueQuestionDrafts(
    [{ question: "Pick the gases." }, { question: "pick the gases" }, { question: "Pick the liquids?" }],
    ["What is a gas?"]
  );
  assert.deepEqual(result.items.map((item) => item.question), ["Pick the gases.", "Pick the liquids?"]);
  assert.equal(result.skipped.length, 1);
});

test("quiz generation skips a draft whose prompt already exists in the vault", async () => {
  const app = makeApp([
    {
      path: "Questions/existing.md",
      fm: { question_id: "existing", answer: "A" },
      text: "---\nquestion_id: existing\nanswer: A\n---\n\n## Question\nPick the gases.\n\n## Answer Choices\n- A. Oxygen\n- B. Sugar\n\n## Answer\n> **Correct Answer: A**\n",
    },
    { path: "Notes/Chem.md", noFm: true, text: "Gases include oxygen and nitrogen." },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.aiComplete = async () =>
    JSON.stringify({ questions: [{ question: "Pick the gases.", choices: ["Oxygen", "Sugar"], answer: "A", type: "mcq" }] });
  const generated = await plugin.generateQuizFromNotes({ folders: ["Notes"], count: 1, types: ["mcq"] });
  assert.equal(generated.items.length, 1);
  const result = await plugin.createQuickAddQuestions(generated.items, { folder: "Questions" });
  assert.equal(result.created, 0);
  assert.equal(result.duplicates, 1);
  assert.equal(app.created, undefined);
  assert.equal(plugin.aiWriteHistory().length, 0);
});
