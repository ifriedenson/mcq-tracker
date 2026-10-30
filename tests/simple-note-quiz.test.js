"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const N = T.simpleNoteQuiz;

async function start(notes) {
  const app = makeApp(notes || []);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("simple note quiz: parses questions, answers and ignores frontmatter and code", () => {
  const text = `---
tags: [review]
---
# Cell biology

What is the capital of France?
Paris, on the Seine.

What is 7 × 8?
56

\`\`\`markdown
This is an example?
It is not a quiz card.
\`\`\`
`;
  const parsed = N.parseSimpleNoteQuiz(text);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.questions[0].question, "What is the capital of France?");
  assert.equal(parsed.questions[0].answer, "Paris, on the Seine.");
  assert.equal(parsed.questions[0].lineIndex, 5);
  assert.equal(parsed.questions[1].answer, "56");
  assert.equal(parsed.counts.unmarked, 2);
});

test("simple note quiz: custom markers, bullet separators and missing answers", () => {
  const bullets = N.parseSimpleNoteQuiz(
    `- What is A?
    - alpha
    - first
- What is B?
    - beta

No answer here?
Next question?
has an answer`,
    { separator: "bullet" }
  );
  assert.equal(bullets.questions.length, 3);
  assert.equal(bullets.questions[0].answer, "- alpha\n- first");
  assert.equal(bullets.questions[1].answer, "- beta");
  assert.equal(bullets.issues.length, 1);
  assert.match(bullets.issues[0], /has no answer/);

  const custom = N.parseSimpleNoteQuiz("Define osmosis::\nwater movement across a membrane", { questionMark: "::" });
  assert.equal(custom.questions.length, 1);
  assert.equal(custom.questions[0].answer, "water movement across a membrane");
});

test("simple note quiz: marks are visible, replaceable and clearable", () => {
  const source = "Q1?\nA1\n\nQ2?\nA2\n";
  const applied = N.applySimpleNoteQuizMarks(source, [
    { lineIndex: 0, status: "known" },
    { lineIndex: 3, status: "unknown" },
  ]);
  assert.match(applied.text, /^Q1\? ✅$/m);
  assert.match(applied.text, /^Q2\? ❌$/m);
  assert.equal(applied.changed, 2);
  const parsed = N.parseSimpleNoteQuiz(applied.text);
  assert.deepEqual(parsed.questions.map((question) => question.mark), ["known", "unknown"]);

  const replaced = N.applySimpleNoteQuizMarks(applied.text, [{ lineIndex: 3, status: "known" }]);
  assert.match(replaced.text, /^Q2\? ✅$/m);
  assert.doesNotMatch(replaced.text, /❌/);
  const cleared = N.clearSimpleNoteQuizMarks(replaced.text);
  assert.equal(cleared.changed, 2);
  assert.doesNotMatch(cleared.text, /[✅❌]/);
  assert.equal(N.parseSimpleNoteQuiz(cleared.text).questions.length, 2);
});

test("simple note quiz: malformed settings normalize and session selection is deterministic", () => {
  assert.deepEqual(N.normalizeSimpleNoteQuiz({ questionMark: "", separator: "nope", shuffle: "yes" }), {
    questionMark: "?",
    separator: "blank",
    shuffle: false,
  });
  const questions = [
    { mark: "known", lineIndex: 0 },
    { mark: "", lineIndex: 1 },
    { mark: "unknown", lineIndex: 2 },
  ];
  assert.deepEqual(N.selectSimpleNoteQuizQuestions(questions, "unmarked").map((question) => question.lineIndex), [1]);
  assert.deepEqual(N.selectSimpleNoteQuizQuestions(questions, "unknown").map((question) => question.lineIndex), [2]);
  assert.deepEqual(
    N.selectSimpleNoteQuizQuestions(questions, "all", { shuffle: true, random: () => 0 }).map((question) => question.lineIndex),
    [1, 2, 0]
  );
  assert.deepEqual(questions.map((question) => question.lineIndex), [0, 1, 2], "selection never mutates the parsed list");
});

test("simple note quiz: a complete modal session saves marks without touching question tracking", async () => {
  const text = "What is 2 + 2?\n4\n\nWhat is 3 + 3?\n6\n";
  const { app, plugin } = await start([{ path: "Notes/Math.md", fm: { attempts: 7, history: [{ correct: true }] }, text }]);
  app.workspace.getActiveFile = () => app.files[0];
  assert.ok(plugin.commands.some((command) => command.id === "simple-note-quiz"));
  assert.deepEqual(plugin.settings.simpleNoteQuiz, { questionMark: "?", separator: "blank", shuffle: false });

  const parsed = await plugin.loadSimpleNoteQuiz(app.files[0]);
  const modal = new T.SimpleNoteQuizModal(app, plugin, app.files[0], parsed, parsed.options);
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.close = () => {};
  await modal.onOpen();
  assert.ok(dom.texts().includes("2 questions · 0 known · 0 missed · 2 unmarked"));

  await dom.click(/^Start all/);
  await dom.click("Show answer");
  await dom.click("Known");
  await dom.click("Show answer");
  await dom.click("Still learning");
  assert.equal(modal.phase, "summary");
  assert.ok(dom.texts().some((value) => value.includes("Known 1 of 2")));
  await dom.click("Save marks");

  assert.match(app.files[0].text, /^What is 2 \+ 2\? ✅$/m);
  assert.match(app.files[0].text, /^What is 3 \+ 3\? ❌$/m);
  assert.equal(app.files[0].fm.attempts, 7);
  assert.deepEqual(app.files[0].fm.history, [{ correct: true }]);
  assert.deepEqual(plugin.settings.simpleQuiz.stats.days, {});
});

test("simple note quiz: marks survive a plugin restart and can be cleared", async () => {
  const { app, plugin } = await start([{ path: "Notes/Review.md", noFm: true, text: "Q?\nA\n" }]);
  await plugin.saveSimpleNoteQuizMarks(app.files[0], [{ lineIndex: 0, status: "known" }]);
  const restarted = new QT(app);
  await restarted.onload();
  const parsed = await restarted.loadSimpleNoteQuiz(app.files[0]);
  assert.equal(parsed.questions[0].mark, "known");

  const cleared = await restarted.clearSimpleNoteQuizMarks(app.files[0]);
  assert.equal(cleared.changed, 1);
  assert.doesNotMatch(app.files[0].text, /✅/);
  assert.equal((await restarted.loadSimpleNoteQuiz(app.files[0])).questions[0].mark, "");
});

test("simple note quiz: empty notes and missing active files are reported, not opened", async () => {
  const { app, plugin } = await start([{ path: "Notes/Empty.md", noFm: true, text: "Just a note.\n" }]);
  app.workspace.getActiveFile = () => null;
  assert.equal(await plugin.openSimpleNoteQuiz(), null);
  app.workspace.getActiveFile = () => app.files[0];
  const parsed = await plugin.openSimpleNoteQuiz();
  assert.equal(parsed.questions.length, 0);
  assert.ok(obsidian.notices.some((notice) => /No question\/answer pairs found/.test(notice)));
});
