"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const { parseExamBlock } = T.examBlock;

const SINGLE = `<num>5</num>
<source>2022 practice</source>
<stem>What is the capital of France? ___</stem>
<options>
A. London
B. Paris
C. Berlin
D. Madrid
</options>
<answer>B</answer>
<analysis>Paris is the capital of France.</analysis>`;

const MULTI = `<stem>Which of these are mammals?</stem>
<options>
A. Whale
B. Shark
C. Dolphin
D. Turtle
</options>
<answer>A,C</answer>
<analysis>Whales and dolphins are mammals.</analysis>`;

async function start() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

async function withMarkdown(fn) {
  const previous = obsidian.MarkdownRenderer.render;
  obsidian.MarkdownRenderer.render = async (_app, markdown, el) => {
    el.createDiv({ cls: "test-markdown", text: markdown });
  };
  try {
    return await fn();
  } finally {
    obsidian.MarkdownRenderer.render = previous;
  }
}

test("exam block: parses num, source, stem, options, key and analysis", () => {
  const parsed = parseExamBlock(SINGLE);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.num, "05");
  assert.equal(parsed.source, "2022 practice");
  assert.match(parsed.stem, /capital of France/);
  assert.deepEqual(parsed.answers, ["B"]);
  assert.deepEqual(parsed.options.map((option) => [option.letter, option.text]), [
    ["A", "London"],
    ["B", "Paris"],
    ["C", "Berlin"],
    ["D", "Madrid"],
  ]);
  assert.match(parsed.analysis, /capital of France/);
});

test("exam block: multi-select keys, no-space options, entities and missing optional tags", () => {
  const parsed = parseExamBlock(`<stem>Which are mammals? &amp; why?</stem>
<options>
A.Whale
B.Shark
C.Dolphin
</options>
<answer>A, C</answer>`);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.num, "");
  assert.equal(parsed.source, "");
  assert.match(parsed.stem, /mammals\? & why\?/);
  assert.deepEqual(parsed.answers, ["A", "C"]);
  assert.deepEqual(parsed.options.map((option) => option.letter), ["A", "B", "C"]);
});

test("exam block: malformed input explains stem, options and answer problems", () => {
  const missing = parseExamBlock("<num>1</num><stem>Only a stem</stem>");
  assert.equal(missing.valid, false);
  assert.match(missing.issues.join(" "), /at least two options/);
  assert.match(missing.issues.join(" "), /Add the key/);

  const badKey = parseExamBlock("<stem>Question</stem><options>\nA. one\nB. two\n</options><answer>Z</answer>");
  assert.equal(badKey.valid, false);
  assert.match(badKey.issues.join(" "), /option letters/);

  const unknown = parseExamBlock("<stem>Question</stem><options>\nA. one\nB. two\n</options><answer>C</answer>");
  assert.equal(unknown.valid, false);
  assert.match(unknown.issues.join(" "), /not one of the options/);
});

test("exam block: study mode marks the key and shows the analysis without inputs", async () => {
  const { plugin } = await start();
  plugin.settings.examBlockMode = "study";
  await withMarkdown(async () => {
    const dom = makeDom();
    await plugin.renderExamBlock(SINGLE, dom.root, { sourcePath: "Exam.md" });
    assert.ok(dom.all.some((o) => o.classes.has("qt-exam-card")));
    assert.ok(dom.texts().includes("05"));
    assert.ok(dom.texts().includes("2022 practice"));
    assert.ok(dom.texts().some((text) => text.includes("capital of France")));
    assert.ok(dom.all.some((o) => o.classes.has("qt-exam-option") && o.classes.has("is-correct")));
    assert.ok(dom.texts().includes("Show analysis"));
    assert.ok(dom.texts().some((text) => text.includes("Paris is the capital")));
    assert.equal(dom.all.filter((o) => o.meta && o.meta.tag === "button").length, 0);
  });
});

test("exam block: answer mode grades a single choice immediately", async () => {
  const { plugin } = await start();
  plugin.settings.examBlockMode = "answer";
  await withMarkdown(async () => {
    const dom = makeDom();
    await plugin.renderExamBlock(SINGLE, dom.root, { sourcePath: "Exam.md" });
    assert.ok(dom.all.some((o) => o.meta && o.meta.tag === "button"));
    await dom.click("B. Paris");
    assert.ok(dom.all.some((o) => o.classes.has("qt-exam-feedback") && o.classes.has("is-correct")));
    assert.ok(dom.texts().includes("Correct"));
    assert.ok(dom.all.some((o) => o.meta && o.meta.tag === "details" && !o.classes.has("qt-hidden")));
  });
});

test("exam block: answer mode requires a submit for multi-select", async () => {
  const { plugin } = await start();
  plugin.settings.examBlockMode = "answer";
  await withMarkdown(async () => {
    const dom = makeDom();
    await plugin.renderExamBlock(MULTI, dom.root, { sourcePath: "Exam.md" });
    await dom.click("A. Whale");
    await dom.click("C. Dolphin");
    await dom.click("Submit answer");
    assert.ok(dom.all.some((o) => o.classes.has("qt-exam-feedback") && o.classes.has("is-correct")));
    assert.ok(dom.texts().includes("Correct"));
  });
});

test("exam block: malformed XML renders an in-place message, not a crash", async () => {
  const { plugin } = await start();
  const dom = makeDom();
  await plugin.renderExamBlock("<stem>Broken</stem>", dom.root, { sourcePath: "Exam.md" });
  assert.ok(dom.texts().some((text) => text.includes("at least two options")));
  assert.ok(dom.all.some((o) => o.classes.has("qt-exam-error")));
});

test("exam block: the code block is registered and the default mode is study", async () => {
  const { plugin } = await start();
  assert.ok(plugin.codeBlocks.exam);
  assert.equal(plugin.settings.examBlockMode, "study");
});
