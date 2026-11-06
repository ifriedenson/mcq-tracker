"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const cards = T.cards;
const cram = T.cram;

const CARD_TEXT = "---\ncard_id: cell\nitem_type: card\ndeck: Biology\n---\n\n## Front\nWhat is a cell?\n\n## Back\nThe basic unit of life.\n";

async function setup() {
  const note = {
    path: "Cards/Biology/cell.md",
    noFm: true,
    fm: { card_id: "cell", item_type: "card", deck: "Biology" },
    text: CARD_TEXT,
  };
  const app = makeApp([note]);
  app.files[0].fm = { ...note.fm };
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

test("cram: the four session intervals are exact and labelled", () => {
  assert.deepEqual(cram.CRAM_INTERVALS, { again: 3, hard: 5, good: 10, easy: 1440 });
  for (const [grade, minutes] of [["again", 3], ["hard", 5], ["good", 10], ["easy", 1440]]) {
    assert.equal(cram.cramIntervalMinutes(grade), minutes);
    assert.equal(cram.cramIntervalMinutes(grade.toUpperCase()), minutes);
  }
  assert.equal(cram.cramIntervalLabel("again"), "3m");
  assert.equal(cram.cramIntervalLabel("hard"), "5m");
  assert.equal(cram.cramIntervalLabel("good"), "10m");
  assert.equal(cram.cramIntervalLabel("easy"), "1d");
  assert.equal(cram.cramIntervalLabel("unknown"), "");

  const now = new Date(2026, 10, 6, 10, 0);
  for (const [grade, minutes] of [["again", 3], ["hard", 5], ["good", 10], ["easy", 1440]]) {
    assert.equal(cram.cramDueAt(now, grade).getTime() - now.getTime(), minutes * 60000);
  }
});

test("cram: a cram review writes an exact due timestamp and a normal review clears it", () => {
  const now = new Date(2026, 10, 6, 10, 0);
  for (const [grade, minutes] of [["again", 3], ["hard", 5], ["good", 10], ["easy", 1440]]) {
    const fm = {};
    T.applyAttempt(
      fm,
      { ...cards.cardAttempt(grade, 12), now },
      [1, 3, 7, 21, 60],
      { scheduler: "ladder", cram: true }
    );
    const due = new Date(now.getTime() + minutes * 60000);
    assert.equal(fm.next_review_at, due.toISOString());
    assert.equal(fm.next_review, T.fmtDate(due));
    assert.equal(fm.last_card_rating, grade);
  }

  const fm = { next_review_at: new Date(now.getTime() + 60000).toISOString() };
  T.applyAttempt(fm, { ...cards.cardAttempt("good", 12), now }, [1, 3, 7], { scheduler: "ladder" });
  assert.equal("next_review_at" in fm, false, "normal scheduling removes the cram timestamp");
});

test("cram: exact due times control isDue and the card queue", () => {
  const now = new Date(2026, 10, 6, 10, 0);
  const today = T.fmtDate(now);
  const card = {
    file: { path: "Cards/Biology/cell.md" },
    deck: "Biology",
    course: "",
    fm: {
      card_id: "cell",
      item_type: "card",
      attempts: 1,
      next_review: today,
      next_review_at: new Date(now.getTime() + 3 * 60000).toISOString(),
    },
  };

  assert.equal(T.isDue(card.fm, today, now), false);
  assert.equal(cards.cardQueue([card], { today, now, order: "due" }).length, 0);
  const later = new Date(now.getTime() + 3 * 60000);
  assert.equal(T.isDue(card.fm, today, later), true);
  assert.equal(cards.cardQueue([card], { today, now: later, order: "due" }).length, 1);
  assert.equal(cards.cardStats([card], today, now).due, 0);
  assert.equal(cards.cardStats([card], today, later).due, 1);
});

test("cram: the plugin records the compressed interval through the normal review path", async () => {
  const { plugin } = await setup();
  const card = plugin.getCards()[0];
  const now = new Date(2026, 10, 6, 10, 0);
  const summary = await plugin.recordCardReview(card, "again", 4, { cram: true, now });
  assert.equal(summary.cram, true);
  assert.equal(summary.nextReviewAt, new Date(now.getTime() + 3 * 60000).toISOString());
  assert.equal(card.file.fm.next_review_at, summary.nextReviewAt);
});

test("cards view: Cram session shows the compressed intervals and records the rating", async () => {
  const { app, plugin } = await setup();
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();

  assert.ok(dom.texts().includes("Cram session"));
  assert.ok(dom.texts().some((text) => /Again 3m.*Hard 5m.*Good 10m.*Easy 1d/.test(text)));

  await dom.click("Cram session");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(view.state, "review");
  assert.equal(view.cram, true);
  assert.ok(dom.texts().includes("Cram · 3m / 5m / 10m / 1d"));

  await dom.click("Show answer");
  assert.ok(dom.texts().includes("3m"));
  assert.ok(dom.texts().includes("5m"));
  assert.ok(dom.texts().includes("10m"));
  assert.ok(dom.texts().includes("1d"));

  const card = view.current;
  await dom.click("Again");
  assert.equal(view.state, "summary");
  assert.ok(dom.texts().includes("Cram session complete"));
  assert.ok(card.file.fm.next_review_at);
  assert.ok(new Date(card.file.fm.next_review_at).getTime() > Date.now(), "the card is due in the future");
});
