"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const Q = T.quizBlock;

const BLOCK = `Q: Put these in order.
Type: reorder
A. First
B. Second
C. Third
Answer: A, B, C`;

async function setup(saved, block = BLOCK) {
  const app = makeApp([{ path: "Quiz.md", noFm: true, text: `# Quiz\n\n\`\`\`mcq-quiz\n${block}\n\`\`\`\n` }]);
  const plugin = new QT(app);
  plugin.saved = saved;
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderQuizBlock(block, dom.root, { sourcePath: "Quiz.md" });
  return { app, plugin, dom, source: app.files[0] };
}

test("reorder: items and an exact order parse, and malformed orders are rejected", () => {
  const parsed = Q.parseQuizBlock(BLOCK);
  assert.equal(parsed.questions[0].type, "reorder");
  assert.equal(parsed.questions[0].answer, "A, B, C");
  assert.equal(parsed.questions[0].valid, true);

  const bad = Q.parseQuizBlock("Q: Order\nType: reorder\nA. One\nB. Two\nAnswer: A, A");
  assert.equal(bad.questions[0].valid, false);
  assert.match(bad.questions[0].issues.join(" "), /every item letter once/);
});

test("reorder: grading requires the exact sequence and gives no partial credit", () => {
  const q = Q.parseQuizBlock(BLOCK).questions[0];
  assert.equal(Q.gradeReorderQuestion(q, "A, B, C").correct, true);
  assert.equal(Q.gradeReorderQuestion(q, "C, B, A").correct, false);
  assert.equal(Q.gradeReorderQuestion(q, "A, B").correct, false);
  assert.equal(Q.gradeReorderQuestion(q, "A, B, C").score, 100);
  assert.equal(Q.gradeReorderQuestion(q, "C, A, B").score, 0);
});

test("reorder: the type is off by default and shows no active controls", async () => {
  const { plugin, dom, source } = await setup({});
  assert.equal(plugin.settings.inlineQuizReorder, false);
  assert.ok(dom.texts().some((text) => /Reorder questions are off/.test(text)));
  assert.equal(dom.texts().includes("Check order"), false);
  assert.equal(source.fm.quizResults, undefined);
});

test("reorder: enabling the type renders move controls and scores the arranged order", async () => {
  const { plugin, dom } = await setup({ inlineQuizReorder: true });
  assert.equal(plugin.settings.inlineQuizReorder, true);
  assert.ok(dom.texts().includes("Check order"));
  assert.ok(dom.all.some((el) => el.meta && (el.meta.attrs && el.meta.attrs["aria-label"] === "Move First down") || (el.meta.attr && el.meta.attr["aria-label"] === "Move First down")));
  await dom.click("Check order");
  assert.ok(dom.texts().some((text) => /100% · pass/.test(text)));
});

test("reorder: corrupt settings normalize and the opt-in survives restart", async () => {
  const app = makeApp([{ path: "Quiz.md", noFm: true }]);
  const plugin = new QT(app);
  plugin.saved = { inlineQuizReorder: "yes" };
  await plugin.onload();
  assert.equal(plugin.settings.inlineQuizReorder, false);

  plugin.settings.inlineQuizReorder = true;
  await plugin.save();
  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.inlineQuizReorder, true);

  restarted.saved.inlineQuizReorder = 1;
  await restarted.onload();
  assert.equal(restarted.settings.inlineQuizReorder, false);
});
