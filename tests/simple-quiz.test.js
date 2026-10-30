"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.simpleQuiz;

const CARDS = [
  {
    id: "cap",
    question: { left: ["Capital of France?", "One word."], right: ["Paris"] },
    tags: ["geo"],
    notReversible: true,
  },
  {
    question: { left: ["2 + 2"], right: ["4"] },
    defaultSide: "right",
    pool: "math",
  },
];

test("simple quiz: JSON cards normalize, generate stable ids and report bad entries", () => {
  const parsed = S.parseSimpleQuizCards(JSON.stringify(CARDS));
  assert.equal(parsed.cards.length, 2);
  assert.equal(parsed.cards[0].id, "cap");
  assert.deepEqual(parsed.cards[0].question.left, ["Capital of France?", "One word."]);
  assert.equal(parsed.cards[0].notReversible, true);
  assert.equal(parsed.cards[1].defaultSide, "right");
  assert.equal(parsed.cards[1].pool, "math");
  assert.match(parsed.cards[1].id, /^h[a-z0-9]+$/);

  const invalid = S.parseSimpleQuizCards("[{\"question\":{\"left\":[],\"right\":[\"A\"]}},{\"question\":\"bad\"}]");
  assert.equal(invalid.cards.length, 0);
  assert.equal(invalid.issues.length, 2);

  const duplicate = S.parseSimpleQuizCards([
    { id: "same", question: { left: ["A"], right: ["B"] } },
    { id: "same", question: { left: ["C"], right: ["D"] } },
  ]);
  assert.equal(duplicate.cards.length, 1);
  assert.match(duplicate.issues.join(" "), /duplicate id/);
});

test("simple quiz: options accept sources, direct cards and safe defaults", () => {
  const options = S.parseSimpleQuizOptions(JSON.stringify({ sources: "Quiz.md", limit: 2, hideTitle: true, shuffle: true }));
  assert.deepEqual(options.options.sources, ["Quiz.md"]);
  assert.equal(options.options.limit, 2);
  assert.equal(options.options.hideTitle, true);
  assert.equal(options.options.shuffle, true);

  const direct = S.parseSimpleQuizOptions(JSON.stringify(CARDS));
  assert.equal(direct.cards.length, 2);
  const inline = S.parseSimpleQuizOptions(JSON.stringify({ cards: CARDS }));
  assert.equal(inline.cards.length, 2);
  assert.equal(inline.options.limit, 0);

  const broken = S.parseSimpleQuizOptions("{not json");
  assert.equal(broken.cards.length, 0);
  assert.match(broken.issues.join(" "), /not valid JSON/);
});

test("simple quiz: note blocks are extracted and legacy quizjs is rejected", () => {
  const note = [
    "Text",
    "```quizjson",
    '[{"question":{"left":["Q"],"right":["A"]}}]',
    "```",
    "```quizjs",
    'fc.addCard({question:{left:["Q2"], right:["A2"]}}); fc.commit();',
    "```",
  ].join("\n");
  const blocks = S.extractSimpleQuizBlocks(note);
  assert.equal(blocks.json.length, 1);
  assert.equal(blocks.js.length, 1);

  assert.match(S.legacyQuizJsNotice(), /disabled.*quizjson/);
});

test("simple quiz: no dynamic code execution remains", () => {
  const source = fs.readFileSync(require.resolve("../src/simple-quiz"), "utf8");
  assert.doesNotMatch(source, /new\s+Function|\beval\s*\(/);
});

test("simple quiz: malformed saved stats recover and sessions update streak and charts", () => {
  const recovered = S.normalizeSimpleQuiz({ enableJavaScript: "yes", stats: { days: { "2026-10-30": { cards: 4, correct: 9, quizzes: 1 }, bad: {} }, streak: -3 } });
  assert.equal("enableJavaScript" in recovered, false);
  assert.equal(recovered.stats.days["2026-10-30"].correct, 4);
  assert.equal(recovered.stats.streak, 0);

  let state = S.recordSimpleQuizSession(S.normalizeSimpleQuiz({}), { today: "2026-10-29", cards: 3, correct: 2 });
  state = S.recordSimpleQuizSession(state, { today: "2026-10-30", cards: 2, correct: 2 });
  const summary = S.simpleQuizDaySummary(state, "2026-10-30");
  assert.equal(summary.streak, 2);
  assert.equal(summary.cards, 2);
  assert.equal(summary.quizzes, 1);
  assert.equal(summary.best, 2);

  const again = S.recordSimpleQuizSession(state, { today: "2026-10-30", cards: 1, correct: 0 });
  assert.equal(again.stats.days["2026-10-30"].quizzes, 2);
  assert.equal(again.stats.days["2026-10-30"].cards, 3);

  const huge = S.recordSimpleQuizSession(again, { today: "2026-10-30", cards: 0, correct: 0 });
  assert.deepEqual(huge, again, "an empty session writes nothing");

  const chart = S.simpleQuizChartSeries(again, { today: "2026-10-30", days: 3 });
  assert.equal(chart.days.length, 3);
  assert.equal(chart.days[2].date, "2026-10-30");
  assert.equal(chart.days[2].cards, 3);
  assert.equal(chart.totalCards, 6);
});

test("simple quiz: the plugin registers blocks and records one inline session", async () => {
  const source = [
    "```quizjson",
    '[{"question":{"left":["Capital of France?"],"right":["Paris"]},"notReversible":true}]',
    "```",
  ].join("\n");
  const app = makeApp([{ path: "Quiz.md", noFm: true, text: source }]);
  app.files[0].fm = {};
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.simpleQuiz = S.normalizeSimpleQuiz({});
  assert.ok(plugin.codeBlocks.quiz);
  assert.ok(plugin.codeBlocks.quizjson);
  assert.ok(plugin.codeBlocks.quizjs);
  assert.ok(plugin.codeBlocks.quiztoday);
  assert.ok(plugin.codeBlocks.quizcharts);

  const dom = makeDom();
  await plugin.renderSimpleQuizBlock(JSON.stringify({ sources: ["Quiz.md"] }), dom.root, { sourcePath: "Quiz.md" });
  assert.ok(dom.texts().some((text) => text.includes("1 card ready")), JSON.stringify(dom.texts()));
  await dom.click("Start simple quiz");
  assert.ok(dom.texts().includes("Capital of France?"));
  await dom.click("Show answer");
  assert.ok(dom.texts().includes("Paris"));
  await dom.click("Got it");
  await new Promise((resolve) => setImmediate(resolve));

  const today = S.dayKey(new Date());
  const day = plugin.settings.simpleQuiz.stats.days[today];
  assert.equal(day.cards, 1);
  assert.equal(day.quizzes, 1);
  assert.equal(day.correct, 1);
  assert.equal(plugin.settings.simpleQuiz.stats.streak, 1);
  assert.equal(plugin.saved.simpleQuiz.stats.days[today].quizzes, 1);
});

test("simple quiz: empty and malformed input render a useful empty state", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const dom = makeDom();
  await plugin.renderSimpleQuizBlock("", dom.root, {});
  assert.ok(dom.texts().some((text) => text.includes("No cards found")), JSON.stringify(dom.texts()));
  const malformed = S.parseSimpleQuizOptions("[not a card array");
  assert.equal(malformed.cards.length, 0);
  assert.match(malformed.issues.join(" "), /not valid JSON/);
});

test("simple quiz: data blocks show a count, and legacy quizjs blocks stay visibly disabled", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const dom = makeDom();
  plugin.renderSimpleQuizDataBlock('[{"question":{"left":["Q"],"right":["A"]}}]', dom.root, "json");
  assert.ok(dom.texts().some((text) => text.includes("1 card available")));
  plugin.renderSimpleQuizDataBlock('fc.addCard({question:{left:["Q"],right:["A"]}});fc.commit();', dom.root, "js");
  assert.ok(dom.texts().some((text) => text.includes("disabled") && text.includes("quizjson")), JSON.stringify(dom.texts()));
});
