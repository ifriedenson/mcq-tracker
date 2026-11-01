"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

function note(path, text, fm) {
  return { path, text, fm: fm || {} };
}

async function setup() {
  const app = makeApp([
    note("Lectures/Respiration.md", "Glycolysis splits glucose into pyruvate.\n\nThe Krebs cycle makes NADH.", { transcript: true }),
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.cards.enabled = true;
  return { app, plugin };
}

function setFrontmatter(file, fields) {
  file.fm = Object.assign({}, file.fm || {}, fields);
}

test("lecture identity: generated cards and questions carry lecture_id and resolve back to the row", async () => {
  const { app, plugin } = await setup();
  const lecturePath = "Lectures/Respiration.md";
  const lectureId = "lec-respiration";

  plugin.aiComplete = async (system) => {
    if (/exam answer checker/i.test(system)) return '{"answer":"A"}';
    return JSON.stringify({
      cards: [{ front: "What does glycolysis split glucose into?", back: "Pyruvate." }],
      questions: [{ question: "What does glycolysis produce?", choices: ["Pyruvate", "DNA", "Lipid"], answer: "A", explanation: "Glycolysis ends in pyruvate." }],
    });
  };

  const cards = await plugin.generateTranscriptPractice(lecturePath, {
    kind: "cards",
    count: 1,
    force: true,
    lectureId,
    lecturePath,
    deck: "Biology",
  });
  assert.equal(cards.lectureId, lectureId);
  assert.equal(cards.lecturePath, lecturePath);
  const cardWrite = await plugin.writeTranscriptPractice(cards, { deck: "Biology" });
  assert.equal(cardWrite.created, 1);
  const cardFile = app.files.find((file) => file.path.startsWith("Cards/"));
  assert.ok(cardFile);
  assert.match(cardFile.text, /lecture_id: "lec-respiration"/);
  assert.match(cardFile.text, /lecture_path: "Lectures\/Respiration\.md"/);
  setFrontmatter(cardFile, { card_id: "card-1", item_type: "card", deck: "Biology", lecture_id: lectureId });

  plugin.aiComplete = async (system) => {
    if (/exam answer checker/i.test(system)) return '{"answer":"A"}';
    return JSON.stringify({
      questions: [{ question: "What does glycolysis produce?", choices: ["Pyruvate", "DNA", "Lipid"], answer: "A", explanation: "Glycolysis ends in pyruvate." }],
    });
  };
  const questions = await plugin.generateTranscriptPractice(lecturePath, {
    kind: "questions",
    count: 1,
    force: true,
    lectureId,
    lecturePath,
    folder: "Questions",
  });
  assert.equal(questions.lectureId, lectureId);
  assert.equal(questions.items.length, 1);
  const questionWrite = await plugin.writeTranscriptPractice(questions, { folder: "Questions" });
  assert.equal(questionWrite.created, 1);
  const questionFile = app.files.find((file) => file.path.startsWith("Questions/"));
  assert.ok(questionFile);
  assert.match(questionFile.text, /lecture_id: lec-respiration/);
  assert.match(questionFile.text, /lecture_path: Lectures\/Respiration\.md/);
  setFrontmatter(questionFile, { question_id: "q-respiration", lecture_id: lectureId });

  assert.deepEqual(plugin.lecturePracticeSummary(lectureId), { cards: 1, questions: 1 });

  plugin.settings.lectureLog = {
    enabled: true,
    lectures: [{
      id: lectureId,
      course: "Biology",
      date: "2026-11-01",
      title: "Respiration",
      topics: "glycolysis",
      topicList: ["glycolysis"],
      processed: true,
      processedPath: lecturePath,
      notePath: "",
      createdAt: 1,
    }],
  };
  const view = new T.StudyToolsView({ app: plugin.app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "lectures";
  view.render();
  assert.ok(dom.texts().some((text) => /Generated: 1 card, 1 question/.test(text)), "the lecture row resolves to its generated batch");
  assert.ok(dom.texts().includes("Generate practice"));
});
