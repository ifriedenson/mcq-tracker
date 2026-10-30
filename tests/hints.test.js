"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const NOTE = `---
question_id: hint-1
answer: B
---

## Hint

Think about where photosynthesis happens.

## Question

Which organelle carries out photosynthesis?

## Answer Choices

- A. Mitochondrion
- B. Chloroplast
- C. Nucleus
- D. Ribosome

## Answer

> **Correct Answer: B**
>
> Chloroplasts contain chlorophyll.

## My Notes
`;

async function setup(saved, text = NOTE, fm = {}) {
  const app = makeApp([{ path: "Questions/hint.md", fm: { question_id: "hint-1", answer: "B", ...fm }, text }]);
  const plugin = new QT(app);
  plugin.saved = saved;
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const file = app.files[0];
  await view.loadQuestion({ file, fm: file.fm }, true);
  view.render();
  return { app, plugin, dom, view, file };
}

const hasHintButton = (dom) => dom.texts().includes("Show hint") || dom.texts().includes("Hide hint");

test("hints are off by default and leave the practice screen unchanged", async () => {
  const { plugin, dom } = await setup();
  assert.equal(plugin.settings.hints, false);
  assert.equal(hasHintButton(dom), false);
  assert.equal(dom.texts().some((text) => /Think about where photosynthesis/.test(text)), false);
});

test("an enabled hint stays hidden until Show hint is pressed, without recording an attempt", async () => {
  const { dom, view, file } = await setup({ hints: true });
  assert.ok(hasHintButton(dom));
  assert.equal(dom.texts().some((text) => /Think about where photosynthesis/.test(text)), false);
  await dom.click("Show hint");
  assert.equal(view.hintShown, true);
  assert.match(view.current.sections.hint, /Think about where photosynthesis/);
  assert.ok(dom.texts().includes("Hide hint"));
  assert.equal(file.fm.attempts, undefined);
  assert.equal(file.fm.history, undefined);
});

test("a hint can come from frontmatter, and notes without one show no control", async () => {
  const fromProperty = await setup({ hints: true }, NOTE.replace("## Hint\n\nThink about where photosynthesis happens.\n\n", ""), { hint: "Start with the light reactions." });
  assert.ok(fromProperty.dom.texts().includes("Show hint"));
  assert.match(fromProperty.view.current.sections.hint, /Start with the light reactions/);
  await fromProperty.dom.click("Show hint");
  assert.equal(fromProperty.view.hintShown, true);

  const none = await setup({ hints: true }, NOTE.replace("## Hint\n\nThink about where photosynthesis happens.\n\n", ""));
  assert.equal(hasHintButton(none.dom), false);
});

test("the hint setting normalizes corrupt state and survives a restart", async () => {
  const app = makeApp([{ path: "Questions/q.md", fm: { answer: "B" } }]);
  const plugin = new QT(app);
  plugin.saved = { hints: "yes" };
  await plugin.onload();
  assert.equal(plugin.settings.hints, false);
  plugin.settings.hints = true;
  await plugin.save();
  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.hints, true);
  restarted.saved.hints = 1;
  await restarted.onload();
  assert.equal(restarted.settings.hints, false);
});

test("showing a hint changes no attempt, history, streak or next review", async () => {
  const results = [];
  for (const openHint of [false, true]) {
    const { dom, view, file } = await setup({ hints: true });
    if (openHint) await dom.click("Show hint");
    view.sel = "B";
    view.conf = 2;
    await view.submit();
    results.push({ result: file.fm.result, attempts: file.fm.attempts, correct: file.fm.correct_count, streak: file.fm.streak, next: file.fm.next_review, history: file.fm.history.length });
  }
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[1].result, "correct");
  assert.equal(results[1].attempts, 1);
  assert.equal(results[1].streak, 1);
});

test("quick add accepts Hint and writes an ordinary Hint section", () => {
  const parsed = T.quickAdd.parseQuickAdd(`Q: Which organelle carries out photosynthesis?\nHint: Think about chlorophyll.\nA. Mitochondrion\nB. Chloroplast\nAnswer: B`);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.items[0].hint, "Think about chlorophyll.");
  const note = T.quickAdd.quickAddNote(parsed.items[0], "photosynthesis");
  assert.match(note, /## Hint\n\nThink about chlorophyll\./);
  assert.equal(T.parseSections(note).hint, "Think about chlorophyll.");
  assert.equal(T.parseNote(note).fm.attempts, undefined);
});
