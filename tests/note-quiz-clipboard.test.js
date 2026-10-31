"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const { noteQuizToQuickAdd } = T.quizClipboard;
const { parseQuickAdd } = T.quickAdd;

const CLIP = `Here is the generated quiz:

\`\`\`note-quiz
quiz:
type: choice
question: "Which command shows memory usage?"
options:
- "df"
- "free"
- "top"
answer: 2
explanation: "free lists memory and swap."
\`\`\`

\`\`\`note-quiz
quiz:
type: text
question: "Name a command that shows memory."
answers:
- "free"
- "free -h"
explanation: "Either form is accepted."
\`\`\`

Done.`;

async function start(notes = []) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.questionFolder = "Questions";
  obsidian.notices.length = 0;
  return { app, plugin };
}

async function withClipboard(value, fn) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else delete globalThis.navigator;
  }
}

test("note-quiz clipboard: choice and text blocks become previewed quick-add text", () => {
  const result = noteQuizToQuickAdd(CLIP);
  assert.equal(result.found, 2);
  assert.equal(result.valid, 2);
  assert.deepEqual(result.issues, []);
  assert.match(result.text, /Q: Which command shows memory usage\?/);
  assert.match(result.text, /B\. free/);
  assert.match(result.text, /Accepted: free -h/);

  const parsed = parseQuickAdd(result.text);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].questionType, "mcq");
  assert.equal(parsed.items[0].answer, "B");
  assert.deepEqual(parsed.items[0].choices, ["df", "free", "top"]);
  assert.equal(parsed.items[1].questionType, "spr");
  assert.equal(parsed.items[1].answer, "free");
  assert.deepEqual(parsed.items[1].accepted, ["free -h"]);

  const note = T.quickAdd.quickAddNote(parsed.items[1], "Memory command");
  const { fm } = T.parseNote(note);
  assert.deepEqual(fm.accepted_answers, ["free -h"]);
});

test("note-quiz clipboard: malformed blocks are reported and good blocks still import", () => {
  const broken = `\`\`\`note-quiz
quiz:
type: choice
question: "Only one option"
options:
- "one"
answer: 1
\`\`\`
\`\`\`note-quiz
quiz:
type: text
question: "No answer at all"
\`\`\`
\`\`\`note-quiz
quiz:
type: essay
question: "Unsupported"
\`\`\`
\`\`\`note-quiz
quiz:
type: choice
question: "This one is fine"
options:
- "yes"
- "no"
answer: 2
\`\`\``;
  const result = noteQuizToQuickAdd(broken);
  assert.equal(result.found, 4);
  assert.equal(result.valid, 1);
  assert.equal(result.issues.length, 3);
  const messages = result.issues.map((issue) => issue.message).join(" ");
  assert.match(messages, /at least two options/);
  assert.match(messages, /has no answers/);
  assert.match(messages, /unsupported type/);
  assert.match(result.text, /Q: This one is fine/);
  assert.doesNotMatch(result.text, /Only one option/);
});

test("note-quiz clipboard: text that is not a note-quiz block gets a legible hint", () => {
  const result = noteQuizToQuickAdd("Q: This is quick-add text, not a note-quiz block\nA. one\nB. two\nAnswer: B");
  assert.equal(result.valid, 0);
  assert.match(result.issues[0].message, /No note-quiz blocks/);
});

test("note-quiz clipboard: the browser clipboard path is exercised with a stub", async () => {
  const { plugin } = await start();
  const result = await withClipboard({ clipboard: { readText: async () => CLIP } }, () => plugin.readQuizFromClipboard());
  assert.equal(result.valid, 2);
  assert.match(result.text, /Q: Which command shows memory usage\?/);

  const empty = await withClipboard({ clipboard: { readText: async () => "   " } }, () => plugin.readQuizFromClipboard());
  assert.match(empty.errors[0], /clipboard is empty/);

  const unavailable = await withClipboard({}, () => plugin.readQuizFromClipboard());
  assert.match(unavailable.errors[0], /cannot read the clipboard/);
});

test("note-quiz clipboard: a malformed clipboard shows a Notice and writes nothing", async () => {
  const { app, plugin } = await start();
  const result = await withClipboard(
    { clipboard: { readText: async () => "```note-quiz\nquiz:\ntype: choice\nquestion: Broken\noptions:\n- one\nanswer: 1\n```" } },
    () => plugin.openQuizClipboardImport()
  );
  assert.equal(result.valid, 0);
  assert.equal(app.created, undefined);
  assert.equal(obsidian.notices.length, 1);
  assert.match(obsidian.notices[0], /at least two options/);
});

test("note-quiz clipboard: a valid clipboard writes ordinary notes, including accepted answers", async () => {
  const { app, plugin } = await start();
  const result = await withClipboard({ clipboard: { readText: async () => CLIP } }, async () => {
    const parsed = await plugin.readQuizFromClipboard();
    const items = parseQuickAdd(parsed.text).items;
    const written = await plugin.createQuickAddQuestions(items, { folder: "Questions" });
    return { parsed, written };
  });
  assert.equal(result.parsed.valid, 2);
  assert.equal(result.written.created, 2);
  assert.deepEqual(result.written.errors, []);
  assert.ok(result.written.paths.every((path) => path.startsWith("Questions/")));

  const notes = result.written.paths.map((path) => T.parseNote(app.created.find((entry) => entry.path === path).text).fm);
  assert.ok(notes.some((fm) => fm.question_type === "mcq" && fm.answer === "B"));
  const textNote = notes.find((fm) => fm.question_type === "spr");
  assert.equal(textNote.answer, "free");
  assert.deepEqual(textNote.accepted_answers, ["free -h"]);
  assert.equal(textNote.attempts, undefined);
  assert.equal(textNote.answer_source, undefined);
});

test("note-quiz clipboard: the command is registered", async () => {
  const { plugin } = await start();
  assert.ok(plugin.commands.some((command) => command.id === "import-quiz-clipboard"));
});
