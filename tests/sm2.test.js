"use strict";
// Per-deck SM-2/FSRS scheduling: clean-room SM-2 state, deck overrides and
// lossless switching between schedulers during a gradual migration.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.sm2;
const cards = T.cards;
const NOW = new Date(2026, 9, 29, 10, 0);

async function setup() {
  const notes = [
    {
      path: "Cards/Biology/cell.md",
      noFm: true,
      fm: { card_id: "cell", item_type: "card", deck: "Biology" },
      text: "---\ncard_id: cell\nitem_type: card\ndeck: Biology\n---\n\n## Front\nWhat is a cell?\n\n## Back\nThe basic unit of life.",
    },
    {
      path: "Cards/Spanish/hablar.md",
      noFm: true,
      fm: { card_id: "hablar", item_type: "card", deck: "Spanish" },
      text: "---\ncard_id: hablar\nitem_type: card\ndeck: Spanish\n---\n\n## Front\nhablar\n\n## Back\nto speak",
    },
    {
      path: "Cards/General/plain.md",
      noFm: true,
      fm: { card_id: "plain", item_type: "card", deck: "General" },
      text: "---\ncard_id: plain\nitem_type: card\ndeck: General\n---\n\n## Front\nplain\n\n## Back\nordinary",
    },
  ];
  const app = makeApp(notes);
  notes.forEach((n, i) => (app.files[i].fm = { ...n.fm }));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards = cards.mergeCardSettings({
    enabled: true,
    newCardFolder: "Cards",
    defaultDeck: "General",
    decks: [
      { name: "Biology", folder: "Cards/Biology", scheduler: "sm2", sm2: { easyInterval: 8 } },
      { name: "Spanish", folder: "Cards/Spanish", scheduler: "fsrs", fsrsRetention: 0.85 },
      { name: "General", folder: "Cards/General" },
    ],
  });
  plugin.settings.scheduler = "ladder";
  plugin.settings.fsrsRetention = 0.9;
  return { app, plugin };
}

test("sm2: compact state round-trips and malformed values are ignored", () => {
  const first = S.reviewNote({}, { correct: true, conf: 2, seconds: 20, now: NOW }, {});
  const state = S.decodeSm2(first.sm2);
  assert.equal(state.reps, 1);
  assert.equal(state.interval, 1);
  assert.equal(state.ease, 2.5);
  assert.equal(S.decodeSm2("not sm2"), null);
  assert.equal(S.decodeSm2("sm2|1|1|bad|2026-10-30T10:00:00.000Z|-|0"), null);
  assert.equal(S.decodeSm2("sm2|1|1|2.5|not-a-date|-|0"), null);
});

test("sm2: first reviews use one day, Easy uses its longer first interval", () => {
  const good = S.reviewNote({}, { correct: true, conf: 2, seconds: 20, now: NOW }, {});
  const hard = S.reviewNote({}, { correct: true, conf: 1, seconds: 20, now: NOW }, {});
  const easy = S.reviewNote({}, { correct: true, conf: 3, seconds: 20, now: NOW, rating: 4 }, {});
  assert.deepEqual([good.rating, hard.rating, easy.rating], [3, 2, 4]);
  assert.deepEqual([good.days, hard.days, easy.days], [1, 1, 4]);
  assert.equal(good.nextReview, "2026-10-30");
  assert.equal(easy.nextReview, "2026-11-02");
  assert.equal(good.ease, 2.5);
  assert.equal(easy.ease, 2.65);
});

test("sm2: later Good reviews grow by the ease factor and Again resets with a lapse", () => {
  const first = S.reviewNote({}, { correct: true, conf: 2, seconds: 20, now: NOW }, {});
  const second = S.reviewNote({ sm2: first.sm2 }, { correct: true, conf: 2, seconds: 20, now: new Date(2026, 9, 30, 10, 0) }, {});
  assert.equal(second.days, 6);
  const third = S.reviewNote({ sm2: second.sm2 }, { correct: true, conf: 2, seconds: 20, now: new Date(2026, 10, 5, 10, 0) }, {});
  assert.equal(third.days, 15);
  const again = S.reviewNote({ sm2: third.sm2 }, { correct: false, conf: 2, seconds: 20, now: new Date(2026, 10, 20, 10, 0) }, {});
  assert.equal(again.days, 1);
  assert.equal(again.ease, 2.3);
  assert.equal(S.decodeSm2(again.sm2).reps, 0);
  assert.equal(S.decodeSm2(again.sm2).lapses, 1);
});

test("sm2: per-deck timing changes intervals without changing the algorithm", () => {
  const timing = S.normalizeSm2({ startingEase: 3, graduatingInterval: 2, easyInterval: 8, hardMultiplier: 2, easyBonus: 1.5 });
  const good = S.reviewNote({}, { rating: 3, now: NOW }, timing);
  const easy = S.reviewNote({}, { rating: 4, now: NOW }, timing);
  assert.equal(good.days, 2);
  assert.equal(easy.days, 8);
  assert.equal(easy.ease, 3.15);
});

test("sm2: existing history seeds the state once instead of restarting at zero", () => {
  const fm = {
    target_seconds: 90,
    history: [
      "2026-10-01T10:00|correct|40|A|3|",
      "2026-10-05T10:00|correct|50|A|2|",
      "2026-10-12T10:00|correct|80|B|2|",
    ],
  };
  const result = S.reviewNote(fm, { correct: true, conf: 2, seconds: 40, now: NOW }, {});
  assert.equal(result.replayed, 3);
  const state = S.decodeSm2(result.sm2);
  assert.equal(state.reps, 4, "three replayed rows plus the current review");
  assert.equal(state.lapses, 0);
});

test("cards: deck scheduler, intervals, retention and SM-2 timing resolve with inheritance", () => {
  const normalized = cards.normalizeDecks([
    { name: "Biology", scheduler: "SM2", intervals: "2, 4, 4, nope", sm2: { easyInterval: 8 } },
    { name: "Spanish", scheduler: "fsrs", fsrsRetention: 0.87 },
    { name: "General" },
  ]);
  const bio = normalized.find((d) => d.name === "Biology");
  const spanishDeck = normalized.find((d) => d.name === "Spanish");
  const generalDeck = normalized.find((d) => d.name === "General");
  assert.equal(bio.scheduler, "sm2");
  assert.deepEqual(bio.intervals, [2, 4]);
  assert.equal(bio.sm2.easyInterval, 8);
  assert.equal(spanishDeck.fsrsRetention, 0.87);
  assert.equal(generalDeck.scheduler, "");
  assert.equal(cards.normalizeDecks([{ name: "Inherit", scheduler: "fsrs", fsrsRetention: 0 }])[0].fsrsRetention, 0);

  const settings = {
    scheduler: "ladder",
    intervals: [1, 3, 7, 21, 60],
    fsrsRetention: 0.9,
    cards: { decks: normalized },
  };
  const biology = cards.schedulerForDeck(settings, "Biology");
  assert.equal(biology.scheduler, "sm2");
  assert.deepEqual(biology.intervals, [2, 4]);
  assert.equal(biology.sm2.easyInterval, 8);
  const spanish = cards.schedulerForDeck(settings, "Spanish");
  assert.equal(spanish.scheduler, "fsrs");
  assert.equal(spanish.fsrsRetention, 0.87);
  const general = cards.schedulerForDeck(settings, "General");
  assert.equal(general.scheduler, "ladder");
  assert.deepEqual(general.intervals, [1, 3, 7, 21, 60]);
  assert.equal(cards.normalizeSchedulerChoice("unknown"), "");
});

test("sm2: applyAttempt writes SM-2 state and switching to FSRS keeps it", () => {
  const fm = {};
  const first = T.applyAttempt(
    fm,
    { correct: true, chosen: "Good", conf: 2, seconds: 20, now: NOW, grade: "good", rating: 3 },
    [1, 3, 7],
    { scheduler: "sm2" }
  );
  assert.equal(first.scheduler, "sm2");
  assert.equal(fm.scheduler, "sm2");
  assert.equal(first.sm2Days, 1);
  assert.equal(first.sm2Ease, 2.5);
  assert.ok(fm.sm2);
  assert.equal(fm.next_review, "2026-10-30");
  const preserved = fm.sm2;

  const second = T.applyAttempt(
    fm,
    { correct: true, chosen: "Good", conf: 2, seconds: 20, now: new Date(2026, 9, 30, 10, 0), grade: "good", rating: 3 },
    [1, 3, 7],
    { scheduler: "fsrs", fsrsRetention: 0.9 }
  );
  assert.equal(second.scheduler, "fsrs");
  assert.ok(fm.srs);
  assert.equal(fm.sm2, preserved, "the SM-2 state is not deleted by an FSRS review");
  assert.equal(fm.scheduler, "fsrs");
});

test("plugin: a card review uses its deck scheduler and leaves other decks alone", async () => {
  const { plugin } = await setup();
  const byId = (id) => plugin.getCards().find((c) => c.fm.card_id === id);

  const biology = await plugin.recordCardReview(byId("cell"), "easy", 5);
  assert.equal(biology.scheduler, "sm2");
  assert.equal(biology.sm2Days, 8);
  assert.equal(byId("cell").file.fm.scheduler, "sm2");
  assert.ok(byId("cell").file.fm.sm2, "the deck's SM-2 state is written to the note");

  const spanish = await plugin.recordCardReview(byId("hablar"), "good", 5);
  assert.equal(spanish.scheduler, "fsrs");
  assert.equal(byId("hablar").file.fm.scheduler, "fsrs");
  assert.ok(byId("hablar").file.fm.srs, "the deck's FSRS state is written to the note");
  assert.equal(byId("hablar").file.fm.sm2, undefined);

  const general = await plugin.recordCardReview(byId("plain"), "good", 5);
  assert.equal(general.scheduler, "ladder", "a deck with no override keeps the global ladder");
  assert.equal(byId("plain").file.fm.sm2, undefined);
  assert.equal(byId("plain").file.fm.srs, undefined);
});
