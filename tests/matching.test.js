"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const M = T.matching;

const pairs = [
  { left: "Photosynthesis", right: "Converts light energy" },
  { left: "Respiration", right: "Releases energy from glucose" },
  { left: "Diffusion", right: "Moves particles down a gradient" },
];

test("matching pairs parse from bullets with ::, => or ->", () => {
  const text = ["## Pairs", "- Photosynthesis :: Converts light energy", "- Respiration => Releases energy from glucose", "3. Diffusion -> Moves particles down a gradient", "- not a pair"].join("\n");
  assert.deepEqual(M.parsePairs(text), pairs);
  assert.equal(M.parsePairLine("- A : B"), null);
  assert.equal(M.parsePairLine("-  :: B"), null);
});

test("matching pairs skip a repeated left item", () => {
  const parsed = M.parsePairs("- A :: 1\n- a :: 2\n- B :: 3\n");
  assert.deepEqual(parsed, [
    { left: "A", right: "1" },
    { left: "B", right: "3" },
  ]);
});

test("the display order is stable for a seed and keeps every option", () => {
  const order = M.shuffleForSeed([0, 1, 2, 3], "Questions/match.md");
  assert.deepEqual(order, M.shuffleForSeed([0, 1, 2, 3], "Questions/match.md"));
  assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
  assert.notDeepEqual(M.shuffleForSeed([0, 1, 2, 3], "a"), M.shuffleForSeed([0, 1, 2, 3], "b"));
});

test("a matching attempt is graded row by row", () => {
  const all = M.gradeMatching(pairs, JSON.stringify([0, 1, 2]));
  assert.equal(all.correct, true);
  assert.equal(all.right, 3);
  assert.equal(all.total, 3);
  assert.equal(all.mode, "match");

  const swapped = M.gradeMatching(pairs, JSON.stringify([1, 0, 2]));
  assert.equal(swapped.correct, false);
  assert.equal(swapped.right, 1);
  assert.equal(swapped.rows[0].picked, pairs[1].right);
  assert.equal(swapped.rows[0].correct, false);
  assert.match(swapped.reason, /2 pairs not matched/);
});

test("an incomplete or malformed matching key is wrong, never a crash", () => {
  const partial = M.gradeMatching(pairs, JSON.stringify([-1, 1, 2]));
  assert.equal(partial.correct, false);
  assert.equal(partial.right, 2);
  assert.equal(partial.rows[0].picked, "");
  assert.equal(M.gradeMatching(pairs, "").correct, false);
  assert.equal(M.gradeMatching(pairs, "not json").correct, false);
  assert.equal(M.gradeMatching([], JSON.stringify([])).correct, false);
});

test("matching notes are detected from their declared type and pairs", () => {
  const note = "---\nquestion_id: m1\n---\n\n## Question\nMatch each term.\n\n## Pairs\n- A :: 1\n- B :: 2\n";
  assert.deepEqual(T.parseSections(note).pairs, [
    { left: "A", right: "1" },
    { left: "B", right: "2" },
  ]);
  assert.equal(T.inferMode("matching", "", [], pairs), "match");
  assert.equal(T.inferMode("matching", "", [], [{ left: "A", right: "1" }]), "self");
  assert.equal(T.inferMode("mcq", "A", [{ letter: "A", text: "Alpha" }], pairs), "mcq");
});

test("a matching note renders row pickers and grades the whole mapping in practice", async () => {
  const text = [
    "---",
    "question_id: match-1",
    "question_type: matching",
    "---",
    "",
    "## Question",
    "Match each process to its description.",
    "",
    "## Pairs",
    "- Photosynthesis :: Converts light energy",
    "- Respiration :: Releases energy",
  ].join("\n");
  const app = makeApp([{ path: "Questions/match.md", fm: { question_id: "match-1", question_type: "matching" }, text }]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  const file = app.files[0];
  await view.loadQuestion({ file, fm: file.fm }, true);
  assert.equal(view.current.mode, "match");
  assert.equal(view.current.pairs.length, 2);
  view.render();
  const selects = dom.all.filter((el) => el.meta && el.meta.tag === "select");
  assert.equal(selects.length, 2);
  for (let i = 0; i < selects.length; i++) {
    selects[i].value = String(i);
    for (const handler of selects[i].handlers.filter((h) => h.ev === "change")) await handler.fn({});
  }
  view.conf = 2;
  await view.submit();
  assert.equal(file.fm.result, "correct");
  assert.equal(file.fm.correct_count, 1);
  assert.ok(file.fm.history.some((row) => /correct/.test(row)));
});

test("fill-in answers ignore case, spacing, punctuation and a leading article", () => {
  assert.equal(T.gradeAnswer({ answer: "mitochondria", question_type: "fill_in" }, "  Mitochondria. "), true);
  assert.equal(T.gradeAnswer({ answer: "the cell membrane", question_type: "fill_in" }, "Cell membrane"), true);
  assert.equal(T.gradeAnswer({ answer: "osmosis", question_type: "fill-in" }, "Osmosis!"), true);
  assert.equal(T.gradeAnswer({ answer: "mitochondria", question_type: "fill_in" }, "nucleus"), false);
  assert.equal(T.gradeAnswer({ answer: "osmosis|diffusion", question_type: "fill_in" }, "Diffusion"), true);
});
