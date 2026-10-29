"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

test("mixed review: due items stay first and item families alternate", () => {
  const questions = [
    { file: { path: "Questions/due.md", basename: "due" }, fm: { question_id: "q-due", attempts: 2, next_review: "2020-01-01" } },
    { file: { path: "Questions/new.md", basename: "new" }, fm: { question_id: "q-new", attempts: 0 } },
  ];
  const cards = [
    { file: { path: "Cards/Bio/due.md", basename: "due" }, fm: { card_id: "c-due", attempts: 2, next_review: "2020-01-02" }, deck: "Biology", course: "BIO 101" },
    { file: { path: "Cards/Spanish/new.md", basename: "new" }, fm: { card_id: "v-new", item_type: "vocab", attempts: 0 }, deck: "Spanish", course: "SPAN 101", kind: "vocab" },
  ];
  const queue = T.buildMixedQueue(questions, cards, { today: "2026-10-29", limit: 10 });
  assert.deepEqual(queue.counts, { questions: 2, cards: 1, vocab: 1, total: 4 });
  assert.deepEqual(queue.items.map((item) => item.type), ["question", "card", "question", "vocab"]);
  assert.ok(queue.items.slice(0, 2).every((item) => !item.isNew));
  assert.ok(queue.items.slice(2).every((item) => item.isNew));
  assert.deepEqual(T.buildMixedQueue(questions, cards, { today: "2026-10-29", limit: 2 }).items.map((item) => item.type), ["question", "card"]);
  assert.equal(T.buildMixedQueue(questions, cards, { today: "2026-10-29", limit: 0 }).items.length, 4);
});

test("mixed review: question ratings become ordinary scheduled attempts", () => {
  const again = T.mixedQuestionAttempt("again", 42, new Date("2026-10-29T12:00:00Z"));
  assert.equal(again.correct, false);
  assert.equal(again.conf, 0);
  assert.equal(again.rating, 1);
  assert.equal(again.grade, "again");
  assert.equal(again.chosen, "");
  assert.equal(again.seconds, 42);
  const easy = T.mixedQuestionAttempt("easy", 3);
  assert.equal(easy.correct, true);
  assert.equal(easy.rating, 4);
  assert.equal(easy.conf, 3);
});

test("mixed review: the session reveals and rates a question, then a card", async () => {
  const notes = [
    { path: "Questions/q1.md", fm: { answer: "B", attempts: 2, next_review: "2020-01-01" } },
    {
      path: "Cards/Biology/cell.md",
      noFm: true,
      fm: { card_id: "cell", item_type: "card", deck: "Biology", attempts: 1, next_review: "2020-01-02" },
      text: "## Front\nWhat is a cell?\n\n## Back\nThe basic unit of life.",
    },
  ];
  const app = makeApp(notes);
  app.files[1].fm = { card_id: "cell", item_type: "card", deck: "Biology", attempts: 1, next_review: "2020-01-02" };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const modal = new T.MixedReviewModal(app, plugin, { limit: 10 }, () => {});
  const dom = makeDom();
  modal.contentEl = dom.root;
  await modal.onOpen();
  assert.ok(dom.texts().includes("q1"));
  await dom.click("Show answer");
  assert.ok(dom.texts().some((text) => String(text).includes("Correct answer: B")));
  await dom.click("Good");
  assert.equal(app.files[0].fm.attempts, 3);
  assert.equal(modal.current.row.type, "card");
  assert.ok(dom.texts().includes("cell"));
  modal.reveal();
  assert.match(modal.current.card.body.back, /basic unit of life/);
  await modal.rate("good");
  assert.equal(app.files[1].fm.attempts, 2);
});

test("mixed review: the plugin registers the command and requires both modules", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.ok(plugin.commands.some((command) => command.id === "mixed-review"));
  assert.equal(typeof plugin.openMixedReview, "function");
  plugin.settings.cards.enabled = false;
  assert.equal(plugin.openMixedReview(), null);
  plugin.settings.cards.enabled = true;
  assert.equal(plugin.openMixedReview(), null);
});
