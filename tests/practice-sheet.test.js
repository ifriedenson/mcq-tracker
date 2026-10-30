"use strict";
// Answer-free practice sheets: prompts and choices only, never an answer key,
// rationale or private note, and the command must not touch question state.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ex = T.resultsExport;

const QUESTION_TEXT = (id, answer = "B") => `---
question_id: ${id}
answer: ${answer}
course: BIO
skill: cells
difficulty: easy
---

## Stimulus

The powerhouse of the cell is being discussed.

## Question

Which organelle makes most ATP?

## Answer Choices

- A. Nucleus
- B. Mitochondria
- C. Ribosome
- D. Golgi

## Answer

> [!answer]- Reveal answer
> **Correct Answer: ${answer}**
>
> Because mitochondria carry out oxidative phosphorylation.

## My Notes

Remember this private study note.
`;

test("practice sheet keeps prompts and choices but removes the answer key and notes", () => {
  const out = ex.buildPracticeSheet(
    [{ file: { basename: "q1" }, fm: { question_id: "q1", answer: "B", course: "BIO", skill: "cells", difficulty: "easy" }, text: QUESTION_TEXT("q1") }],
    { date: "2026-10-30" }
  );

  assert.equal(out.count, 1);
  assert.match(out.text, /^# Answer-free practice sheet/m);
  assert.match(out.text, /Generated 2026-10-30 from 1 question/);
  assert.match(out.text, /###|## 1\. q1/);
  assert.match(out.text, /Which organelle makes most ATP\?/);
  assert.match(out.text, /The powerhouse of the cell/);
  assert.match(out.text, /- \*\*A\.\*\* Nucleus/);
  assert.match(out.text, /- \*\*B\.\*\* Mitochondria/);
  assert.match(out.text, /_BIO · cells · easy_/);
  assert.match(out.text, /Your answer:/);
  assert.match(out.text, /## Answer sheet/);
  assert.doesNotMatch(out.text, /Correct Answer|Reveal answer|Because mitochondria|Remember this private study note/);
  assert.doesNotMatch(out.text, /^answer:/m);
  assert.equal(ex.practiceSheetFileName("2026-10-30"), "mcq-practice-sheet-2026-10-30.md");
  assert.equal(ex.practiceSheetFileName("not-a-date"), "mcq-practice-sheet-export.md");
});

test("practice sheet preserves filter order and blanks matching right-hand answers", () => {
  const out = ex.buildPracticeSheet(
    [
      {
        file: { basename: "m1" },
        fm: { question_id: "m1" },
        text: "## Question\nMatch each term.\n\n## Pairs\n- ATP :: Energy currency\n- DNA :: Genetic material\n\n## Answer\nUse the pairs above.\n",
      },
      { file: { basename: "q2" }, fm: { question_id: "q2" }, text: QUESTION_TEXT("q2", "C") },
    ],
    { date: "2026-10-30" }
  );

  assert.equal(out.count, 2);
  assert.ok(out.text.indexOf("## 1. m1") < out.text.indexOf("## 2. q2"));
  assert.match(out.text, /## 1\. m1/);
  assert.match(out.text, /- ATP →/);
  assert.doesNotMatch(out.text, /Energy currency|Genetic material/);
  assert.match(out.text, /- \*\*C\.\*\* Ribosome/);
  assert.match(out.text, /- \*\*2\. q2:\*\*/);
});

test("practice sheet command writes one sheet and leaves the question untouched", async () => {
  const app = makeApp([
    {
      path: "Q/one.md",
      fm: {
        attempts: 3,
        correct_count: 1,
        history: ["2026-10-01T09:00:00|incorrect|20|A|2||a1", "2026-10-02T09:00:00|correct|15|B|3||a2"],
        next_review: "2026-11-02",
        streak: 2,
      },
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files[0];
  const before = JSON.stringify(file.fm);
  const beforeText = file.text;

  const out = await plugin.exportPracticeSheet();
  const today = T.fmtDate(new Date());

  assert.deepEqual(out, { path: `mcq-practice-sheet-${today}.md`, count: 1 });
  assert.equal(app.created.length, 1);
  assert.equal(app.created[0].path, out.path);
  assert.match(app.created[0].text, /What is one\?/);
  assert.match(app.created[0].text, /- \*\*A\.\*\* one/);
  assert.doesNotMatch(app.created[0].text, /Correct Answer|Because\.|Reveal answer/);
  assert.equal(JSON.stringify(file.fm), before);
  assert.equal(file.text, beforeText);
  assert.equal(file.fm.attempts, 3);
  assert.equal(file.fm.next_review, "2026-11-02");
  assert.equal(file.fm.streak, 2);
  assert.equal(app.modified, undefined);
  assert.ok(plugin.commands.some((command) => command.id === "export-practice-sheet"));
});

test("practice sheet command uses a numbered name instead of overwriting an earlier sheet", async () => {
  const app = makeApp([{ path: "Q/one.md" }]);
  const plugin = new QT(app);
  await plugin.onload();
  const today = T.fmtDate(new Date());
  await app.vault.create(`mcq-practice-sheet-${today}.md`, "earlier sheet");

  const out = await plugin.exportPracticeSheet();

  assert.equal(out.path, `mcq-practice-sheet-${today} 2.md`);
  assert.equal(app.files.find((file) => file.path === `mcq-practice-sheet-${today}.md`).text, "earlier sheet");
  assert.equal(app.created.at(-1).path, out.path);
});

test("practice sheet command writes nothing when the current filter has no questions", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();

  const out = await plugin.exportPracticeSheet();

  assert.equal(out, null);
  assert.equal(app.created, undefined);
});
