"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const D = T.distractorQuality;

test("distractor quality: pure checks catch empty, duplicate, all/none and length tells", () => {
  assert.equal(D.checkDistractorQuality({ choices: ["", "B", "C"], answer: "B" }).ok, false);
  assert.equal(D.checkDistractorQuality({ choices: ["ATP", "atp.", "DNA"], answer: "C" }).ok, false);
  assert.equal(D.checkDistractorQuality({ choices: ["All of the above", "ATP", "DNA"], answer: "B" }).ok, false);
  assert.equal(D.checkDistractorQuality({ choices: ["None of the above", "ATP", "DNA"], answer: "B" }).ok, false);
  const longCorrect = "This is a very long correct answer that contains far more detail than any distractor should.";
  const length = D.checkDistractorQuality({ choices: [longCorrect, "ATP", "DNA", "RNA"], answer: "A" });
  assert.equal(length.ok, false);
  assert.match(length.reasons.join(" "), /much longer/);
  assert.equal(D.checkDistractorQuality({ choices: ["3", "4", "5"], answer: "B" }).ok, true);
  assert.equal(D.checkDistractorQuality({ choices: ["True", "False"], answer: "A" }).ok, true);
});

test("plugin: invalid distractors are dropped even in mark mode and never written", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.verification = "mark";
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    return '{"answer":"B"}';
  };
  const items = [{ question: "Pick one.", choices: ["ATP", "atp.", "DNA"], answer: "A" }];
  const summary = await plugin.verifyDraftQuestions(items);
  assert.equal(calls, 0, "the local quality rule runs before the blind verifier");
  assert.equal(summary.dropped, 1);
  assert.equal(items[0].verification.drop, true);
  assert.equal(items[0].verification.quality, true);

  const written = await plugin.writeTranscriptPractice(
    { kind: "questions", title: "Bad draft", course: "", items: [items[0]], errors: [] },
    { folder: "Questions" }
  );
  assert.equal(written.created, 0);
  assert.match(written.errors.join(" "), /duplicate choice/);
});

test("plugin: generated questions with invalid choices are removed before the write step", async () => {
  const app = makeApp([{ path: "Lectures/L1.md", fm: { transcript: true }, text: "Glycolysis converts glucose into pyruvate." }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.verification = "mark";
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    return JSON.stringify({
      questions: [{ question: "What happens in glycolysis?", choices: ["All of the above", "Glucose becomes pyruvate", "DNA is copied"], answer: "B" }],
    });
  };
  const generated = await plugin.generateTranscriptPractice("Lectures/L1.md", { kind: "questions", count: 1, force: true });
  assert.equal(calls, 1, "no verifier request is spent on an invalid distractor set");
  assert.equal(generated.items.length, 0);
  assert.equal(generated.verification.dropped, 1);
  const written = await plugin.writeTranscriptPractice(generated, { folder: "Questions" });
  assert.equal(written.created, 0);
});
