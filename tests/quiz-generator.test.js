"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const G = T.quizGenerator;

function note(path, text, fm) {
  return { file: { path, basename: path.replace(/^.*\//, "").replace(/\.md$/, "") }, fm: fm || {}, text };
}

test("quiz generator: offers 22 languages and normalises settings", () => {
  assert.equal(G.QUIZ_LANGUAGES.length, 22);
  const config = G.normalizeQuizGenerator({ folders: [" Notes/ ", ""], count: 99, language: "Klingon", types: ["multi", "nope"] });
  assert.deepEqual(config.folders, ["Notes"]);
  assert.equal(config.count, 20);
  assert.equal(config.language, "English");
  assert.deepEqual(config.types, ["multi"]);
});

test("quiz generator: collects chosen folders and excludes question/card notes", () => {
  const sources = G.collectGeneratorSources(
    [
      note("Notes/Bio/ATP.md", "ATP is energy currency."),
      note("Notes/Bio/Q.md", "question note", { question_id: "Q1" }),
      note("Other/Bio.md", "not selected"),
      note("Notes/Empty.md", "   "),
    ],
    { folders: ["Notes"], maxNotes: 5 }
  );
  assert.deepEqual(sources.titles, ["ATP"]);
  assert.match(sources.text, /ATP is energy currency/);
  assert.equal(sources.count, 1);
});

test("quiz generator: prompt names the language, count, allowed types and source", () => {
  const prompt = G.buildQuizGeneratorPrompt({ text: "Cells use ATP.", titles: ["ATP"], count: 3, language: "Spanish", types: ["mcq", "true_false"] });
  assert.match(prompt.user, /Output language: Spanish/);
  assert.match(prompt.user, /Write 3 quiz questions/);
  assert.match(prompt.user, /true_false/);
  assert.match(prompt.user, /Cells use ATP/);
  assert.match(prompt.system, /Spanish/);
});

test("quiz generator: local retrieval ranks focused passages and reports its budget", () => {
  const sources = G.collectGeneratorSources(
    [
      note("Notes/Photo.md", "Photosynthesis converts light into sugar in the chloroplast."),
      note("Notes/ATP.md", "ATP is the energy currency of the cell and is regenerated during respiration."),
    ],
    { folders: ["Notes"], focus: "ATP energy currency", maxChars: 500, maxNotes: 1 }
  );
  assert.equal(sources.retrieval.mode, "local-passages");
  assert.equal(sources.retrieval.query, "ATP energy currency Photo ATP");
  assert.match(sources.text, /ATP is the energy currency/);
  assert.doesNotMatch(sources.text, /chloroplast/);
  assert.equal(sources.retrieval.passages, 1);
  assert.ok(sources.chars <= 500);
});

test("quiz generator: the prompt carries an optional focus topic", () => {
  const prompt = G.buildQuizGeneratorPrompt({ text: "ATP is energy.", titles: ["ATP"], focus: "oxidative phosphorylation", count: 1, types: ["mcq"] });
  assert.match(prompt.user, /Focus topic: oxidative phosphorylation/);
});

test("quiz generator: parses multiple-choice, select-all and true/false replies", () => {
  const reply = JSON.stringify({
    questions: [
      { question: "What is ATP?", choices: ["Energy currency", "DNA", "Lipid"], answer: "A", type: "mcq", explanation: "ATP carries energy." },
      { question: "Pick the gases.", choices: ["Oxygen", "Nitrogen", "Sugar"], answer: "A, B", type: "multi" },
      { question: "ATP is energy currency.", choices: ["True", "False"], answer: "True", type: "true_false" },
      { question: "Broken", choices: ["One"], answer: "A" },
    ],
  });
  const parsed = G.parseGeneratorQuestions(reply, { count: 5, types: ["mcq", "multi", "true_false"] });
  assert.equal(parsed.items.length, 3);
  assert.deepEqual(parsed.items.map((item) => item.questionType), ["mcq", "multi", "true_false"]);
  assert.equal(parsed.items[1].answer, "A, B");
  assert.equal(parsed.items[2].answer, "True");
  assert.equal(parsed.issues.length, 1);
});

test("quiz generator: generation sends the selected focus and exposes retrieval metadata", async () => {
  const app = makeApp([
    { path: "Notes/ATP.md", noFm: true, text: "ATP is the energy currency of the cell." },
    { path: "Notes/Photo.md", noFm: true, text: "Photosynthesis converts light into sugar." },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  let sent = null;
  let calls = 0;
  plugin.aiComplete = async (system, user) => {
    calls += 1;
    if (calls === 1) {
      sent = { system, user };
      return JSON.stringify({ questions: [{ question: "What is ATP?", choices: ["Energy currency", "DNA", "Lipid"], answer: "A" }] });
    }
    return '{"answer":"A"}';
  };
  const generated = await plugin.generateQuizFromNotes({ folders: ["Notes"], focus: "ATP energy", count: 1, types: ["mcq"] });
  assert.match(sent.user, /Focus topic: ATP energy/);
  assert.match(sent.user, /ATP is the energy currency/);
  assert.equal(generated.retrieval.mode, "local-passages");
  assert.equal(generated.retrieval.query, "ATP energy ATP Photo");
  assert.ok(generated.retrieval.passages >= 1);
});

test("quiz generator: the command is registered and generation reuses the AI request path", async () => {
  const app = makeApp([{ path: "Notes/Bio.md", fm: { question_id: undefined }, text: "ATP is the energy currency of the cell." }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  let sent = null;
  let calls = 0;
  plugin.aiComplete = async (system, user) => {
    calls++;
    if (calls === 1) {
      sent = { system, user };
      return JSON.stringify({ questions: [{ question: "What is ATP?", choices: ["Energy currency", "DNA", "Lipid"], answer: "A", explanation: "It carries energy." }] });
    }
    return '{"answer":"A"}';
  };
  assert.ok(plugin.commands.some((command) => command.id === "generate-quiz"));
  const generated = await plugin.generateQuizFromNotes({ folders: ["Notes"], count: 2, language: "English", types: ["mcq"] });
  assert.equal(generated.items.length, 1);
  assert.match(sent.user, /ATP is the energy currency/);
  assert.equal(generated.items[0].answer, "A");
  assert.equal(generated.verification.checked, 1);
  assert.equal(generated.items[0].verification.status, "match");
  assert.equal(calls, 2, "generation is followed by the blind answer check");
});

test("quiz generator: confirmed drafts write select-all questions with their full key", async () => {
  const app = makeApp([{ path: "Notes/Chem.md", noFm: true, text: "Gases include oxygen and nitrogen." }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.aiComplete = async () =>
    JSON.stringify({ questions: [{ question: "Pick the gases.", choices: ["Oxygen", "Nitrogen", "Sugar"], answer: "A, B", type: "multi" }] });
  const generated = await plugin.generateQuizFromNotes({ folders: ["Notes"], count: 1, types: ["multi"] });
  const result = await plugin.createQuickAddQuestions(generated.items, { folder: "Questions" });
  assert.equal(result.created, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(plugin.aiWriteHistory().length, 1, "AI-generated quick-add notes are undoable");
  const text = await app.vault.read(app.vault.getAbstractFileByPath(result.paths[0]));
  assert.match(text, /question_type: multi/);
  assert.match(text, /answer: "?A, B"?/);
  assert.match(text, /Pick the gases/);
});
