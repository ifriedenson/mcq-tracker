"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const transcript = T.transcript;

const LECTURE = [
  "---",
  "transcript: true",
  "course: BIOL 201",
  "title: Cell lecture",
  "---",
  "",
  "## Transcript",
  "",
  "00:01 Today we look at the cell membrane.",
  "00:18 The membrane is selectively permeable.",
  "00:41 Mitochondria produce most of the cell's ATP.",
].join("\n");

async function setup(text, fm) {
  const notes = [
    {
      path: "Courses/Bio/lecture.md",
      noFm: true,
      fm: fm || { transcript: true, course: "BIOL 201", title: "Cell lecture" },
      text: text || LECTURE,
    },
  ];
  const app = makeApp(notes);
  notes.forEach((n, i) => {
    if (n.noFm && n.fm) app.files[i].fm = { ...n.fm };
  });
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.defaultDeck = "Biology";
  return { app, plugin };
}

test("transcript: detection accepts markers, headings, filenames and timestamped lectures", () => {
  assert.equal(transcript.isTranscriptNote({ transcript: true }, "note.md", "", []), true);
  assert.equal(transcript.isTranscriptNote({ type: "transcript" }, "note.md", "", []), true);
  assert.equal(transcript.isTranscriptNote({ source: "whisper" }, "note.md", "", []), true);
  assert.equal(transcript.isTranscriptNote({}, "Courses/Bio/lecture-transcript.md", "", []), true);
  assert.equal(transcript.isTranscriptNote({}, "Courses/Bio/lecture.md", "## Transcript\n00:10 hello", []), true);
  assert.equal(
    transcript.isTranscriptNote({}, "Courses/Bio/lecture.md", "00:10 hello", ["Transcript"]),
    true
  );
  assert.equal(transcript.isTranscriptNote({}, "Questions/Q1.md", "Question: what is a cell?", []), false);
  assert.equal(transcript.isTranscriptNote({ transcript: false }, "transcript.md", "00:10 hello", []), false);
});

test("transcript: the transcript text drops timestamps and keeps the lecture words", () => {
  const info = transcript.transcriptInfo({ path: "Courses/Bio/lecture.md" }, { course: "BIOL 201" }, LECTURE);
  assert.equal(info.isTranscript, true);
  assert.equal(info.course, "BIOL 201");
  assert.equal(info.chars > 60, true);
  assert.match(info.text, /selectively permeable/);
  assert.doesNotMatch(info.text, /00:18/);
  assert.equal(info.title, "lecture");
});

test("transcript: AI card replies tolerate code fences, a preface and Q/A fallback lines", () => {
  const json = transcript.parseAiCards(
    'Here are your cards:\n```json\n{"cards":[{"front":"What is the membrane?","back":"It is selectively permeable."}]}\n```',
    8
  );
  assert.equal(json.cards.length, 1);
  assert.equal(json.cards[0].front, "What is the membrane?");

  const fallback = transcript.parseAiCards("Q: What makes ATP?\nA: Mitochondria.\n\nQ: What is the membrane?\nA: Selectively permeable.", 8);
  assert.equal(fallback.cards.length, 2);
  assert.equal(fallback.cards[0].front, "What makes ATP?");
  assert.equal(fallback.cards[1].back, "Selectively permeable.");

  const duplicate = transcript.parseAiCards(
    '{"cards":[{"front":"Same","back":"One"},{"front":"same","back":"one"}]}',
    8
  );
  assert.equal(duplicate.cards.length, 1);
});

test("transcript: AI question replies accept letters, numbers and full-text answers", () => {
  const parsed = transcript.parseAiQuestions(
    JSON.stringify({
      questions: [
        { question: "What makes ATP?", choices: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"], answer: "B", explanation: "Mitochondria produce ATP." },
        { question: "What is permeable?", choices: ["The membrane", "The nucleus"], answer: 1, explanation: "The membrane is selectively permeable." },
        { question: "Bad question", choices: ["One"], answer: "A" },
      ],
    }),
    8
  );
  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.questions[0].answer, "B");
  assert.equal(parsed.questions[1].answer, "A");
  assert.equal(transcript.parseAiQuestions('{"questions":[{"question":"x","choices":["a","b"],"answer":"C"}]}', 8).questions.length, 0);
});

test("transcript: a generated question note keeps its source note and tracking format", () => {
  const text = transcript.questionNote(
    { question: "What makes ATP?", choices: ["Nucleus", "Mitochondria", "Ribosome", "Golgi"], answer: "B", explanation: "Mitochondria produce ATP." },
    { course: "BIOL 201" },
    "LEC-Q01",
    { model: "test-model", date: "2026-10-29", sourcePath: "Courses/Bio/lecture.md", sourceKind: "note" }
  );
  const { fm } = T.parseNote(text);
  assert.equal(fm.question_id, "LEC-Q01");
  assert.equal(fm.course, "BIOL 201");
  assert.equal(fm.answer, "B");
  assert.equal(fm.source_note, "Courses/Bio/lecture.md");
  assert.equal(fm.source_link, "[[Courses/Bio/lecture.md]]");
  assert.equal(fm.ai_model, "test-model");
  assert.equal(fm.attempts, 0);
  assert.match(text, /## Answer Choices/);
  assert.match(text, /- B\. Mitochondria/);
});

test("plugin: transcript cards preview with AI, then write source and AI provenance", async () => {
  const { app, plugin } = await setup();
  plugin.settings.ai.enabled = true;
  let asked = null;
  plugin.aiComplete = async (system, user) => {
    asked = { system, user };
    return '{"cards":[{"front":"What is the membrane?","back":"It is selectively permeable."}]}';
  };
  const draft = await plugin.generateTranscriptPractice("Courses/Bio/lecture.md", { kind: "cards", count: 5 });
  assert.equal(draft.ai, true);
  assert.equal(draft.items.length, 1);
  assert.equal(draft.sourcePath, "Courses/Bio/lecture.md");
  assert.match(asked.user, /Cell lecture/);
  assert.match(asked.user, /selectively permeable/);
  assert.equal(app.created, undefined, "the preview writes nothing");

  const result = await plugin.writeTranscriptPractice(draft, { deck: "Biology" });
  assert.equal(result.created, 1);
  const made = app.created[0].text;
  assert.match(made, /deck: "Biology"/);
  assert.match(made, /source_note: "?Courses\/Bio\/lecture.md"?/);
  assert.match(made, /ai_model: /);
  assert.match(made, /## Front\n\nWhat is the membrane\?/);
});

test("plugin: transcript questions are written as normal practice notes with provenance", async () => {
  const { app, plugin } = await setup();
  plugin.settings.ai.enabled = true;
  plugin.aiComplete = async () =>
    '{"questions":[{"question":"What makes ATP?","choices":["Nucleus","Mitochondria","Ribosome","Golgi"],"answer":"B","explanation":"Mitochondria produce ATP."}]}';
  const draft = await plugin.generateTranscriptPractice("Courses/Bio/lecture.md", { kind: "questions", count: 1 });
  assert.equal(draft.items.length, 1);
  const result = await plugin.writeTranscriptPractice(draft, { folder: "Questions/Lecture" });
  assert.equal(result.created, 1);
  assert.equal(result.paths[0], "Questions/Lecture/What makes ATP.md");
  const made = app.created[0].text;
  assert.match(made, /question_id: What makes ATP/);
  assert.match(made, /source_note: "?Courses\/Bio\/lecture.md"?/);
  assert.match(made, /source_link: "\[\[Courses\/Bio\/lecture.md\]\]"/);
  assert.match(made, /answer: B/);
  assert.match(made, /- B\. Mitochondria/);
});

test("plugin: local heading extraction still works when AI is off", async () => {
  const body = [
    "---",
    "transcript: true",
    "course: BIOL 201",
    "---",
    "",
    "## Transcript",
    "00:01 Lecture text.",
    "",
    "## Key terms",
    "## Question",
    "What makes ATP?",
    "## Answer",
    "Mitochondria.",
  ].join("\n");
  const { app, plugin } = await setup(body);
  plugin.settings.ai.enabled = false;
  const draft = await plugin.generateTranscriptPractice("Courses/Bio/lecture.md", { kind: "cards", local: true });
  assert.equal(draft.ai, false);
  assert.ok(draft.items.some((card) => card.front === "What makes ATP?"));
  const result = await plugin.writeTranscriptPractice(draft, { deck: "Biology" });
  assert.equal(result.created >= 1, true);
  const made = app.created.find((file) => /What makes ATP/.test(file.text)).text;
  assert.match(made, /source_note: "?Courses\/Bio\/lecture.md"?/);
  assert.doesNotMatch(made, /ai_model/);
});
