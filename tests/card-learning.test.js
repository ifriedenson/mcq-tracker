"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const cards = T.cards;

const NOTE = {
  path: "Cards/Biology/country.md",
  noFm: true,
  fm: {
    card_id: "country",
    item_type: "card",
    deck: "Biology",
    front_expectation: "capital city",
    back_expectation: "country",
  },
  text: "---\ncard_id: country\nitem_type: card\ndeck: Biology\n---\n\n## Front\nFrance\n\n## Back\nParis",
};

async function setup() {
  const app = makeApp([NOTE]);
  app.files[0].fm = { ...NOTE.fm };
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

test("card learning: adaptive frequency lengthens a known-card ladder interval", () => {
  assert.equal(cards.adaptiveIntervalDays(10, 0, true), 10);
  assert.equal(cards.adaptiveIntervalDays(10, 1, true), 10);
  assert.equal(cards.adaptiveIntervalDays(10, 2, true), 12);
  assert.equal(cards.adaptiveIntervalDays(10, 6, true), 16);
  assert.equal(cards.adaptiveIntervalDays(10, 6, false), 10);
});

test("card learning: adaptive frequency only changes the simple ladder", () => {
  const now = new Date(2026, 9, 29, 10, 0);
  const ladder = [1, 3, 7, 21, 60];
  const plain = { streak: 4, correct_count: 4, attempts: 4 };
  const adaptive = { streak: 4, correct_count: 4, attempts: 4 };
  T.applyAttempt(plain, { correct: true, conf: 2, grade: "good", seconds: 10, now }, ladder, { scheduler: "ladder" });
  T.applyAttempt(adaptive, { correct: true, conf: 2, grade: "good", seconds: 10, now }, ladder, { scheduler: "ladder", adaptiveFrequency: true });
  assert.ok(new Date(adaptive.next_review) > new Date(plain.next_review));
  assert.equal(cards.adaptiveIntervalDays(10, 10, true), 16);
});

test("card learning: same-day reviews keep Again and Hard due today, but not Good", () => {
  const now = new Date(2026, 9, 29, 10, 0);
  const opts = { scheduler: "ladder", sameDayReviews: true };
  const again = {};
  const hard = {};
  const good = {};
  T.applyAttempt(again, { correct: false, conf: 0, grade: "again", rating: 1, seconds: 10, now }, [1, 3, 7], opts);
  T.applyAttempt(hard, { correct: false, conf: 1, grade: "hard", rating: 2, seconds: 10, now }, [1, 3, 7], opts);
  T.applyAttempt(good, { correct: true, conf: 2, grade: "good", rating: 3, seconds: 10, now }, [1, 3, 7], opts);
  assert.equal(again.next_review, "2026-10-29");
  assert.equal(hard.next_review, "2026-10-29");
  assert.equal(good.next_review, "2026-10-30");
});

test("card learning: same-day reviews also work with FSRS without losing memory state", () => {
  const fm = {};
  const summary = T.applyAttempt(
    fm,
    { correct: false, conf: 0, grade: "again", rating: 1, seconds: 10, now: new Date(2026, 9, 29, 10, 0) },
    [1, 3, 7],
    { scheduler: "fsrs", sameDayReviews: true }
  );
  assert.equal(fm.next_review, "2026-10-29");
  assert.ok(fm.srs);
  assert.equal(summary.scheduler, "fsrs");
});

test("card learning: expectation properties and sections parse, and reversed cards swap them", () => {
  const body = cards.parseCardBody("## Front\nFrance\n\n## Back\nParis", {
    front_expectation: "capital city",
    back_expectation: "country",
  });
  assert.equal(body.frontExpectation, "capital city");
  assert.equal(body.backExpectation, "country");
  const reversed = cards.parseCardBody("## Front\nFrance\n\n## Back\nParis", {
    card_type: "reversed",
    front_expectation: "capital city",
    back_expectation: "country",
  });
  assert.equal(reversed.front, "Paris");
  assert.equal(reversed.frontExpectation, "country");
  assert.equal(reversed.backExpectation, "capital city");
  const section = cards.parseCardBody("## Front\nFrance\n\n## Front expectation\ncapital city\n\n## Back\nParis\n\n## Back expectation\ncountry", {});
  assert.equal(section.frontExpectation, "capital city");
  assert.equal(section.backExpectation, "country");
});

test("card learning: cardNote writes both expectation properties", () => {
  const made = cards.cardNote({
    deck: "Biology",
    front: "France",
    back: "Paris",
    frontExpectation: "capital city",
    backExpectation: "country",
  });
  assert.match(made.text, /front_expectation: "capital city"/);
  assert.match(made.text, /back_expectation: "country"/);
  const parsed = cards.parseCardBody(made.text, { front_expectation: "capital city", back_expectation: "country" });
  assert.equal(parsed.frontExpectation, "capital city");
  assert.equal(parsed.backExpectation, "country");
});

test("card learning: settings default off but preserve explicit opt-ins", () => {
  const off = cards.mergeCardSettings({});
  assert.equal(off.sameDayReviews, false);
  assert.equal(off.adaptiveFrequency, false);
  const on = cards.mergeCardSettings({ sameDayReviews: true, adaptiveFrequency: true });
  assert.equal(on.sameDayReviews, true);
  assert.equal(on.adaptiveFrequency, true);
});

test("card learning: the card view shows the front and back expectation", async () => {
  const { app, plugin } = await setup();
  const card = plugin.getCards()[0];
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  await view.reviewCard(card);
  assert.ok(dom.texts().includes("Expected: capital city"));
  await dom.click("Show answer");
  assert.ok(dom.texts().includes("Expected: country"));
});
