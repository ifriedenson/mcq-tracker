"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const Q = T.quizBlock;

const BLOCK = `A. True
B. False
C. Unknown

Q: Coconut may have bisexual flowers.
Answer: A

Q: The year 1970 came before 1971.
Answer: A`;

async function setup(saved, block = BLOCK) {
  const app = makeApp([{ path: "Quiz.md", noFm: true, text: `# Quiz\n\n\`\`\`mcq-quiz\n${block}\n\`\`\`\n` }]);
  const plugin = new QT(app);
  plugin.saved = saved;
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderQuizBlock(block, dom.root, { sourcePath: "Quiz.md" });
  return { app, plugin, dom, source: app.files[0] };
}

test("shared choice: options before the first question are reused", () => {
  const parsed = Q.parseQuizBlock(BLOCK);
  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.questions[0].sharedOptions, true);
  assert.equal(parsed.questions[0].choices.length, 3);
  assert.deepEqual(parsed.questions[0].choices.map((c) => c.text), ["True", "False", "Unknown"]);
  assert.equal(parsed.questions[1].answer, "A");
  assert.equal(parsed.questions.every((q) => q.valid), true);
});

test("shared choice: per-question options do not inherit the shared set", () => {
  const parsed = Q.parseQuizBlock(`A. One\nB. Two\n\nQ: First?\nAnswer: A\n\nQ: Second?\nA. Alpha\nB. Beta\nAnswer: B`);
  assert.equal(parsed.questions[0].sharedOptions, true);
  assert.equal(parsed.questions[1].sharedOptions, false);
  assert.deepEqual(parsed.questions[1].choices.map((c) => c.text), ["Alpha", "Beta"]);
  assert.equal(parsed.questions[1].answer, "B");
});

test("shared choice: off by default and shows no answer buttons", async () => {
  const { plugin, dom, source } = await setup({});
  assert.equal(plugin.settings.inlineQuizSharedChoice, false);
  assert.ok(dom.texts().some((text) => /Shared-option questions are off/.test(text)));
  assert.equal(dom.texts().filter((text) => /^A\. True$/.test(text)).length, 0);
  assert.equal(source.fm.attempts, undefined);
});

test("shared choice: enabled questions share one option set and record each answer", async () => {
  const { plugin, dom } = await setup({ inlineQuizSharedChoice: true });
  assert.equal(plugin.settings.inlineQuizSharedChoice, true);
  assert.equal(dom.texts().filter((text) => /^A\. True$/.test(text)).length, 2);
  const buttons = dom.find("A. True");
  await buttons[1].handlers.find((h) => h.ev === "click").fn({});
  assert.equal(dom.texts().filter((text) => text === "Correct").length, 1);
  await buttons[0].handlers.find((h) => h.ev === "click").fn({});
  assert.equal(dom.texts().filter((text) => text === "Correct").length, 2);
});

test("shared choice: corrupt settings normalize and the opt-in survives restart", async () => {
  const app = makeApp([{ path: "Quiz.md", noFm: true }]);
  const plugin = new QT(app);
  plugin.saved = { inlineQuizSharedChoice: "yes" };
  await plugin.onload();
  assert.equal(plugin.settings.inlineQuizSharedChoice, false);

  plugin.settings.inlineQuizSharedChoice = true;
  await plugin.save();
  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.inlineQuizSharedChoice, true);

  restarted.saved.inlineQuizSharedChoice = 1;
  await restarted.onload();
  assert.equal(restarted.settings.inlineQuizSharedChoice, false);
});
