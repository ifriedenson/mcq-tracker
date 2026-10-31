"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const Q = T.quizBlock;

const SOURCE = `Id: box-1
Q: Which gas do plants take in?
A. Oxygen
B. Carbon dioxide
Answer: B
Why: Photosynthesis consumes carbon dioxide.`;

const NOTE = `# Science\n\n\`\`\`mcq-quiz\n${SOURCE}\n\`\`\`\n\nSome prose between the blocks.\n\n\`\`\`mcq-quiz\nId: box-2\nCopy: box-1\n\`\`\``;

test("quiz block: reads a stable id, bind/copy target and stem flag", () => {
  const parsed = Q.parseQuizBlock("Id: box-1\nBind: box-2\nStem: off");
  assert.equal(parsed.id, "box-1");
  assert.equal(parsed.bind, "box-2");
  assert.equal(parsed.copy, "");
  assert.equal(parsed.keepStem, false);

  const copied = Q.parseQuizBlock("Id: box-3\nCopy: box-1\nStem: on");
  assert.equal(copied.copy, "box-1");
  assert.equal(copied.bind, "");
  assert.equal(copied.keepStem, true);
});

test("quiz block: finds the source block by id and ignores mirror blocks", () => {
  const source = Q.findQuizBlockSource(NOTE, "box-1");
  assert.ok(source.includes("Which gas do plants take in?"));
  const parsed = Q.parseQuizBlock(source);
  assert.equal(parsed.questions[0].answer, "B");
  assert.equal(Q.findQuizBlockSource(NOTE, "box-2"), "");
});

test("quiz block: bind renders the target read-only from another note", async () => {
  const app = makeApp([
    { path: "Science.md", text: NOTE },
    { path: "Practice.md", text: "# Practice" },
  ]);
  const plugin = new QT(app);
  await plugin.onload();

  const dom = makeDom();
  await plugin.renderQuizBlock("Bind: box-1", dom.root, { sourcePath: "Practice.md" });
  assert.ok(dom.all.some((o) => o.classes.has("qt-quiz-summary")));
  assert.ok(dom.texts().some((text) => text.includes("Which gas do plants take in?")));
  assert.ok(dom.texts().some((text) => text.includes("Photosynthesis consumes carbon dioxide.")));
  assert.ok(dom.all.some((o) => o.classes.has("qt-quiz-choices") && o.classes.has("is-static")));
  assert.ok(dom.all.some((o) => o.classes.has("is-correct") && /B\. Carbon dioxide/.test(o.meta.text || "")));
  assert.equal(dom.all.filter((o) => o.meta && o.meta.tag === "input").length, 0);
});

test("quiz block: copy renders the target answerable and stem: off hides its stem", async () => {
  const app = makeApp([
    { path: "Science.md", text: NOTE },
    { path: "Practice.md", text: "# Practice" },
  ]);
  const plugin = new QT(app);
  await plugin.onload();

  const dom = makeDom();
  await plugin.renderQuizBlock("Copy: box-1\nStem: off", dom.root, { sourcePath: "Practice.md" });
  assert.ok(dom.all.some((o) => o.classes.has("qt-quiz-summary")));
  assert.ok(dom.all.some((o) => o.classes.has("qt-quiz-choices") && !o.classes.has("is-static")));
  assert.ok(dom.texts().some((text) => text.trim() === "A. Oxygen"));
  assert.ok(!dom.texts().some((text) => text.includes("Which gas do plants take in?")));
});

test("quiz block: a missing or mirrored target explains itself in place", async () => {
  const app = makeApp([{ path: "Science.md", text: NOTE }]);
  const plugin = new QT(app);
  await plugin.onload();

  const missing = makeDom();
  await plugin.renderQuizBlock("Bind: no-such-block", missing.root, { sourcePath: "Science.md" });
  assert.ok(missing.texts().some((text) => text.includes('points to "no-such-block"')));

  const mirror = makeDom();
  await plugin.renderQuizBlock("Bind: box-2", mirror.root, { sourcePath: "Science.md" });
  assert.ok(mirror.texts().some((text) => text.includes('points to "box-2"')));
  assert.equal(Q.findQuizBlockSource(NOTE, "box-2"), "", "mirror blocks are not source blocks");
});
