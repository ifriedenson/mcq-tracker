"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const Q = T.quizBlock;

const BLOCK = `Q: How many bits are in one byte?
Type: numeric
Answer: 8
Tolerance: 0.5
Min: 0
Max: 64`;

async function setup(saved, block = BLOCK) {
  const app = makeApp([{ path: "Quiz.md", noFm: true, text: `# Quiz\n\n\`\`\`mcq-quiz\n${block}\n\`\`\`\n` }]);
  const plugin = new QT(app);
  plugin.saved = saved;
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderQuizBlock(block, dom.root, { sourcePath: "Quiz.md" });
  return { app, plugin, dom, source: app.files[0] };
}

test("numeric: answer, tolerance and optional bounds parse", () => {
  const parsed = Q.parseQuizBlock(BLOCK);
  const q = parsed.questions[0];
  assert.equal(q.type, "numeric");
  assert.equal(q.answer, "8");
  assert.equal(q.tolerance, 0.5);
  assert.equal(q.min, 0);
  assert.equal(q.max, 64);
  assert.equal(q.valid, true);
});

test("numeric: malformed answers and out-of-range bounds are rejected", () => {
  const text = Q.parseQuizBlock("Q: Year?\nType: numeric\nAnswer: nineteen");
  assert.equal(text.questions[0].valid, false);
  assert.match(text.questions[0].issues.join(" "), /numeric Answer/);

  const out = Q.parseQuizBlock("Q: Year?\nType: numeric\nAnswer: 1995\nMax: 1900");
  assert.equal(out.questions[0].valid, false);
  assert.match(out.questions[0].issues.join(" "), /above Max/);

  const range = Q.parseQuizBlock("Q: Year?\nType: numeric\nAnswer: 5\nMin: 10\nMax: 0");
  assert.equal(range.questions[0].valid, false);
  assert.match(range.questions[0].issues.join(" "), /Min smaller than Max/);
});

test("numeric: grading uses an inclusive tolerance and rejects blanks", () => {
  const q = Q.parseQuizBlock(BLOCK).questions[0];
  assert.equal(Q.gradeNumericQuestion(q, "8").correct, true);
  assert.equal(Q.gradeNumericQuestion(q, "8.5").correct, true);
  assert.equal(Q.gradeNumericQuestion(q, "8.51").correct, false);
  assert.equal(Q.gradeNumericQuestion(q, "").correct, false);
  assert.equal(Q.gradeQuizQuestion(q, "7.5").score, 100);
});

test("numeric: the type is off by default and shows no input", async () => {
  const { plugin, dom, source } = await setup({});
  assert.equal(plugin.settings.inlineQuizNumeric, false);
  assert.ok(dom.texts().some((text) => /Numeric questions are off/.test(text)));
  assert.equal(dom.all.some((el) => el.meta && el.meta.tag === "input"), false);
  assert.equal(source.fm.attempts, undefined);
});

test("numeric: enabling the type renders an input and accepts a value within tolerance", async () => {
  const { plugin, dom, source } = await setup({ inlineQuizNumeric: true });
  assert.equal(plugin.settings.inlineQuizNumeric, true);
  assert.ok(dom.texts().includes("Tolerance ±0.5 · min 0 · max 64"));
  const input = dom.all.find((el) => el.meta && el.meta.tag === "input");
  assert.ok(input);
  input.value = "8.4";
  await dom.click("Check answer");
  assert.ok(dom.texts().some((text) => /100% · pass/.test(text)));
  assert.equal(source.fm.attempts, undefined, "an unlinked quiz question writes no attempt");
});

test("numeric: corrupt settings normalize and the opt-in survives restart", async () => {
  const app = makeApp([{ path: "Quiz.md", noFm: true }]);
  const plugin = new QT(app);
  plugin.saved = { inlineQuizNumeric: "yes" };
  await plugin.onload();
  assert.equal(plugin.settings.inlineQuizNumeric, false);

  plugin.settings.inlineQuizNumeric = true;
  await plugin.save();
  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.inlineQuizNumeric, true);

  restarted.saved.inlineQuizNumeric = 1;
  await restarted.onload();
  assert.equal(restarted.settings.inlineQuizNumeric, false);
});
