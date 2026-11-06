"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const cards = T.cards;
const cram = T.cram;

const cardText = (id, front, back) =>
  `---\ncard_id: ${id}\nitem_type: card\ndeck: Biology\n---\n\n## Front\n${front}\n\n## Back\n${back}\n`;

function makeNotes() {
  return [
    {
      path: "Cards/Biology/cell.md",
      noFm: true,
      fm: { card_id: "cell", item_type: "card", deck: "Biology" },
      text: cardText("cell", "What is a cell?", "The basic unit of life."),
    },
    {
      path: "Cards/Biology/mito.md",
      noFm: true,
      fm: { card_id: "mito", item_type: "card", deck: "Biology" },
      text: cardText("mito", "What makes ATP?", "The mitochondria."),
    },
  ];
}

async function setup() {
  const notes = makeNotes();
  const app = makeApp(notes);
  notes.forEach((note, i) => (app.files[i].fm = { ...note.fm }));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards = cards.mergeCardSettings({
    enabled: true,
    newCardFolder: "Cards",
    defaultDeck: "General",
    reviewLimit: 20,
    order: "due",
    decks: [{ name: "Biology", folder: "Cards/Biology" }],
  });
  return { app, plugin };
}

test("mother cram: know removes a card, do not know sends it to the back, and empty is a no-op", () => {
  const input = ["a", "b", "c"];
  const started = cram.motherCramStart(input);
  assert.deepEqual(started, input);
  assert.notEqual(started, input, "the loop owns its own queue");
  assert.deepEqual(cram.motherCramStart(null), []);

  const first = cram.motherCramTurn(started, false);
  assert.equal(first.card, "a");
  assert.deepEqual(first.queue, ["b", "c", "a"]);
  assert.equal(first.known, false);

  const second = cram.motherCramTurn(first.queue, true);
  assert.equal(second.card, "b");
  assert.deepEqual(second.queue, ["c", "a"]);
  assert.equal(second.known, true);

  assert.deepEqual(cram.motherCramTurn([], true), { card: null, queue: [], known: true });
});

test("cards view: Mother cram loops with only Know and Do not know and writes no scheduling", async () => {
  const { app, plugin } = await setup();
  const before = app.files.map((file) => ({ ...file.fm }));
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("Mother cram"));
  await dom.click("Mother cram");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(view.state, "review");
  assert.equal(view.mother, true);
  assert.equal(view.cram, false);
  assert.equal(view.queue.length, 2);
  assert.ok(dom.texts().includes("Known 0 / 2"));
  assert.ok(dom.texts().includes("Mother cram · Know / Do not know"));

  const first = view.current.file.path;
  await dom.click("Show answer");
  const ratings = dom.all.filter((el) => el.classes.has("qt-cards-rate"));
  assert.deepEqual(ratings.map((el) => el.meta.text), ["Do not know", "Know"]);
  assert.equal(ratings.some((el) => el.classes.has("qt-cards-rate-again")), false);
  assert.equal(ratings.some((el) => el.classes.has("qt-cards-rate-good")), false);

  await dom.click("Do not know");
  assert.equal(view.state, "review");
  assert.equal(view.queue.length, 2);
  assert.equal(view.queue.at(-1).file.path, first, "the unknown card returns at the back");
  assert.notEqual(view.current.file.path, first, "the loop moves on without waiting");
  assert.ok(dom.texts().includes("Known 0 / 2"));

  await dom.click("Show answer");
  await dom.click("Know");
  assert.equal(view.queue.length, 1);
  assert.ok(dom.texts().includes("Known 1 / 2"));

  await dom.click("Show answer");
  await dom.click("Know");
  assert.equal(view.state, "summary");
  assert.ok(dom.texts().includes("Mother cram complete"));
  assert.ok(dom.texts().includes("Known 2 · Do not know 1"));
  assert.deepEqual(app.files.map((file) => ({ ...file.fm })), before, "frontmatter is untouched");
  assert.equal(app.modified, undefined, "no note was written");
});
