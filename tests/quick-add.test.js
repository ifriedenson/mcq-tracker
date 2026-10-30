"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const { parseQuickAdd, quickAddNote, quickAddTitle, resolveKey } = T.quickAdd;

const PASTE = `Ignore this line; it is not part of a question.

Q: Which gas do plants take in during photosynthesis?
A. Oxygen
B. Carbon dioxide
Answer: B
Why: Photosynthesis consumes carbon dioxide.
Course: Biology
Skill: photosynthesis
Difficulty: easy

---

Q: What is 3/4 written as a decimal?
Answer: 0.75
`;

async function start(notes = []) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("quick add: blocks become MCQ and SPR items with their own properties", () => {
  const parsed = parseQuickAdd(PASTE);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.items.length, 2);

  const first = parsed.items[0];
  assert.equal(first.questionType, "mcq");
  assert.deepEqual(first.choices, ["Oxygen", "Carbon dioxide"]);
  assert.equal(first.answer, "B");
  assert.equal(first.explanation, "Photosynthesis consumes carbon dioxide.");
  assert.equal(first.course, "Biology");
  assert.equal(first.skill, "photosynthesis");
  assert.equal(first.difficulty, "easy");

  const second = parsed.items[1];
  assert.equal(second.questionType, "spr");
  assert.equal(second.answer, "0.75");
  assert.deepEqual(second.choices, []);
});

test("quick add: wrapped question lines, a stimulus and a lowercase key", () => {
  const parsed = parseQuickAdd(
    `Q: A student mixes two solutions
and records the temperature.
Stimulus: The table shows the results.
A. 21 °C
B. 23 °C
Answer: b`,
    { course: "Chemistry" }
  );
  assert.deepEqual(parsed.issues, []);
  const item = parsed.items[0];
  assert.match(item.question, /mixes two solutions\nand records the temperature\./);
  assert.equal(item.stimulus, "The table shows the results.");
  assert.equal(item.answer, "B");
  assert.equal(item.course, "Chemistry");
});

test("quick add: an unusable block is reported and the good ones still parse", () => {
  const parsed = parseQuickAdd(`Q: Only one choice here?
A. one
Answer: A

Q: Key is not a choice?
A. one
B. two
Answer: D

Q: Missing the key?
A. one
B. two

Q: This one is fine?
A. one
B. two
Answer: B`);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].question, "This one is fine?");
  const messages = parsed.issues.map((issue) => issue.message);
  assert.equal(messages.length, 3);
  assert.ok(messages.some((message) => /at least two answer choices/.test(message)));
  assert.ok(messages.some((message) => /is not one of the choices/.test(message)));
  assert.ok(messages.some((message) => /Add the key/.test(message)));
  assert.equal(parsed.issues[0].index, 0);
});

test("quick add: a set key becomes a select-all item, and a key can name a choice", () => {
  const multi = parseQuickAdd(`Q: Which of these are prime?
A. 2
B. 4
C. 5
Answer: A, C`).items[0];
  assert.equal(multi.questionType, "multi");
  assert.equal(multi.answer, "A, C");
  assert.equal(resolveKey("Carbon dioxide", ["Oxygen", "Carbon dioxide"]), "B");
  assert.equal(resolveKey("B. Four", ["Three", "Four"]), "B");
  assert.equal(resolveKey("Z", ["One", "Two"]), "");
});

test("quick add: the note text is an ordinary question note", () => {
  const note = quickAddNote(
    {
      question: "What is 2 + 2?",
      stimulus: "A short passage.",
      choices: ["3", "4", "5", "6"],
      answer: "B",
      explanation: "Two plus two is four.",
      questionType: "mcq",
      course: "Math",
      unit: 3,
      difficulty: "easy",
    },
    "What is 2 + 2"
  );
  const { fm } = T.parseNote(note);
  assert.equal(fm.question_id, "What is 2 + 2");
  assert.equal(fm.question_type, "mcq");
  assert.equal(fm.choices, 4);
  assert.equal(fm.answer, "B");
  assert.equal(fm.course, "Math");
  assert.equal(fm.unit, 3);
  assert.equal(fm.attempts, undefined, "no tracking properties are pre-filled");
  assert.equal(fm.answer_source, undefined, "the note is not marked as imported or AI-written");
  assert.match(note, /## Stimulus\n\n> A short passage\./);
  assert.match(note, /- C\. 5/);
  assert.match(note, /> \*\*Correct Answer: B\*\*/);
  assert.match(note, /> Two plus two is four\./);
  assert.match(note, /## My Notes/);

  const spr = quickAddNote({ question: "Give a number.", choices: [], answer: "12.5", questionType: "spr" }, "Give a number");
  assert.match(spr, /> \*\*Answer: 12\.5\*\*/);
  assert.ok(!/## Answer Choices/.test(spr), "SPR notes have no choices section");
});

test("quick add: writing makes one note per item, numbering repeated titles", async () => {
  const items = parseQuickAdd(PASTE).items;
  const { app, plugin } = await start([{ path: "Questions/existing.md", fm: { question_id: "existing" } }]);
  plugin.settings.questionFolder = "Questions";
  const result = await plugin.createQuickAddQuestions(items, { course: "" });
  assert.equal(result.created, 2);
  assert.deepEqual(result.errors, []);
  assert.ok(result.paths.every((path) => path.startsWith("Questions/")));

  const written = app.created.find((entry) => entry.path === result.paths[0]);
  const { fm } = T.parseNote(written.text);
  assert.equal(fm.question_type, "mcq");
  assert.equal(fm.answer, "B");
  assert.equal(fm.course, "Biology");
  assert.equal(fm.attempts, undefined);
  assert.equal(fm.answer_source, undefined);

  const again = await plugin.createQuickAddQuestions([items[0]], { folder: "Questions" });
  assert.equal(again.created, 1);
  assert.notEqual(again.paths[0], result.paths[0]);
  assert.match(again.paths[0], / 2\.md$/);
});

test("quick add: the command exists and writing is refused while MCQ Tracker is off", async () => {
  const { plugin } = await start();
  assert.ok(plugin.commands.some((command) => command.id === "quick-add"));
  plugin.settings.mcqEnabled = false;
  await assert.rejects(() => plugin.createQuickAddQuestions(parseQuickAdd(PASTE).items, {}), /Turn on MCQ Tracker/);
  assert.equal(quickAddTitle("  A question?  "), "A question");
});
