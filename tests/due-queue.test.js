"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const { buildDueQueue } = T;

test("due queue: merges questions, cards and vocabulary and puts due before new", () => {
  const questions = [
    { file: { path: "Questions/due.md", basename: "due" }, fm: { question_id: "q-due", attempts: 2, next_review: "2020-01-01" } },
    { file: { path: "Questions/new.md", basename: "new" }, fm: { question_id: "q-new", attempts: 0 } },
    { file: { path: "Questions/later.md", basename: "later" }, fm: { question_id: "q-later", attempts: 2, next_review: "2999-01-01" } },
  ];
  const cards = [
    { file: { path: "Cards/bio/a.md", basename: "a" }, fm: { card_id: "a", attempts: 1, next_review: "2020-01-02" }, deck: "Biology", course: "BIO 101" },
    { file: { path: "Cards/lang/b.md", basename: "b" }, fm: { card_id: "b", attempts: 0 }, deck: "Spanish", course: "SPAN 101", kind: "vocab" },
  ];
  const queue = buildDueQueue(questions, cards, { today: "2026-10-29", limit: 10 });
  assert.deepEqual(queue.counts, { questions: 2, cards: 1, vocab: 1, total: 4 });
  assert.equal(queue.items[0].title, "q-due");
  assert.equal(queue.items[1].type, "card");
  assert.deepEqual(queue.items.slice(2).map((item) => item.title).sort(), ["b", "q-new"]);
  assert.ok(queue.items.slice(2).every((item) => item.isNew));
  assert.equal(buildDueQueue(questions, cards, { today: "2026-10-29", limit: 2 }).items.length, 2);
  assert.equal(buildDueQueue(questions, cards, { today: "2026-10-29" }).all.length, 4);
});

test("plugin: the due queue respects the enabled modules and connects to real card notes", async () => {
  const notes = [
    { path: "Questions/due.md", fm: { attempts: 2, next_review: "2020-01-01", answer: "B" } },
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
  const queue = plugin.getDueQueue({ today: "2026-10-29" });
  assert.equal(queue.counts.questions, 1);
  assert.equal(queue.counts.cards, 1);
  assert.equal(queue.counts.total, 2);

  plugin.settings.cards.enabled = false;
  assert.equal(plugin.getDueQueue({ today: "2026-10-29" }).counts.cards, 0);
  plugin.settings.mcqEnabled = false;
  assert.equal(plugin.getDueQueue({ today: "2026-10-29" }).counts.total, 0);
});
