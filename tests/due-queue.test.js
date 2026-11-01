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

test("plugin: the due queue applies the saved daily cap", async () => {
  const notes = [1, 2, 3].map((n) => ({
    path: `Questions/q${n}.md`,
    fm: { attempts: 1, next_review: `2020-01-0${n}`, answer: "B" },
  }));
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.dueQueue = { dailyCap: 2 };
  const queue = plugin.getDueQueue({ today: "2026-10-29", limit: 10 });
  assert.equal(queue.counts.total, 3);
  assert.equal(queue.shown.total, 2);
  assert.equal(queue.items.length, 2);
  assert.equal(queue.deferred, 1);
});

test("due queue: a daily cap holds overflow without dropping or rescheduling it", () => {
  const questions = [1, 2, 3, 4].map((n) => ({
    file: { path: `Questions/q${n}.md`, basename: `q${n}` },
    fm: { question_id: `q${n}`, attempts: 1, next_review: `2020-01-0${n}` },
  }));
  const queue = buildDueQueue(questions, [], { today: "2026-10-29", limit: 10, dailyCap: 2 });
  assert.equal(queue.counts.total, 4);
  assert.equal(queue.shown.total, 2);
  assert.equal(queue.items.length, 2);
  assert.equal(queue.all.length, 2);
  assert.equal(queue.overflow.length, 2);
  assert.equal(queue.deferred, 2);
  assert.equal(queue.dailyCap, 2);
  assert.equal(T.normalizeDailyCap(-1), 0);
  assert.equal(T.normalizeDailyCap(999), 500);
});

test("mixed review honors the same daily cap", () => {
  const questions = [1, 2].map((n) => ({ file: { path: `Questions/m${n}.md`, basename: `m${n}` }, fm: { question_id: `m${n}`, attempts: 1, next_review: `2020-01-0${n}` } }));
  const cards = [
    { file: { path: "Cards/m1.md" }, fm: { card_id: "m1", attempts: 1, next_review: "2020-01-03" } },
    { file: { path: "Cards/m2.md" }, fm: { card_id: "m2", attempts: 1, next_review: "2020-01-04" } },
  ];
  const mixed = T.buildMixedQueue(questions, cards, { today: "2026-10-29", limit: 10, dailyCap: 2 });
  assert.equal(mixed.items.length, 2);
  assert.equal(mixed.counts.total, 2);
  assert.equal(mixed.deferred, 2);
});
