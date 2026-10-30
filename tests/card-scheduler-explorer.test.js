"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const cards = T.cards;
const explorer = T.fileExplorer;

const SETTINGS = {
  cards: {
    enabled: true,
    newCardFolder: "Cards",
    defaultDeck: "General",
    reviewLimit: 20,
    order: "due",
    decks: [{ name: "Biology", folder: "Cards/Biology", scheduler: "fsrs" }],
  },
};

test("per-note scheduler: card property wins over deck and global scheduler", () => {
  const resolved = cards.resolveCard(
    { path: "Cards/Biology/country.md" },
    { card_id: "country", item_type: "card", deck: "Biology", scheduler: "sm2" },
    { ...SETTINGS, scheduler: "ladder" }
  );
  assert.equal(resolved.scheduler, "sm2");
  assert.equal(cards.effectiveScheduler({ ...SETTINGS, scheduler: "ladder" }, "Biology"), "fsrs");
  assert.equal(cards.normalizeSchedulerChoice("leitner"), "");
});

test("per-note scheduler: a new card writes its scheduler property", () => {
  const made = cards.cardNote({ deck: "Biology", front: "France", back: "Paris", scheduler: "sm2" });
  assert.match(made.text, /scheduler: "sm2"/);
  const none = cards.cardNote({ deck: "Biology", front: "France", back: "Paris" });
  assert.doesNotMatch(none.text, /scheduler:/);
});

test("per-note scheduler: the plugin records the review through that scheduler", async () => {
  const note = {
    path: "Cards/Biology/country.md",
    noFm: true,
    fm: { card_id: "country", item_type: "card", deck: "Biology", scheduler: "sm2" },
    text: "---\ncard_id: country\nitem_type: card\ndeck: Biology\nscheduler: sm2\n---\n\n## Front\nFrance\n\n## Back\nParis",
  };
  const app = makeApp([note]);
  app.files[0].fm = { ...note.fm };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards = cards.mergeCardSettings(SETTINGS.cards);
  const card = plugin.getCards()[0];
  const summary = await plugin.recordCardReview(card, "good", 5);
  assert.equal(summary.scheduler, "sm2");
  assert.equal(app.files[0].fm.scheduler, "sm2");
});

test("file explorer: due and new card paths are selected, hidden cards are omitted", () => {
  const today = "2026-10-30";
  const map = explorer.dueFilePaths(
    [
      { file: { path: "a.md" }, fm: { item_type: "card", attempts: 1, next_review: "2026-10-29" } },
      { file: { path: "b.md" }, fm: { item_type: "card", attempts: 0 } },
      { file: { path: "c.md" }, fm: { item_type: "card", attempts: 1, next_review: "2026-11-05" } },
      { file: { path: "d.md" }, fm: { item_type: "card", study_status: "suspended", attempts: 0 } },
    ],
    today
  );
  assert.equal(map.get("a.md"), "due");
  assert.equal(map.get("b.md"), "new");
  assert.equal(map.has("c.md"), false);
  assert.equal(map.has("d.md"), false);
});

test("file explorer: the optional decorator clears and applies classes without a public API", () => {
  const classes = new Set();
  const el = { classList: { add: (c) => classes.add(c), remove: (...cs) => cs.forEach((c) => classes.delete(c)) } };
  const app = {
    workspace: { getLeavesOfType: () => [{ view: { fileItems: { "a.md": { file: { path: "a.md" }, selfEl: el } } } }] },
  };
  const n = explorer.decorateFileExplorer(
    app,
    [{ file: { path: "a.md" }, fm: { item_type: "card", attempts: 1, next_review: "2026-10-29" } }],
    "2026-10-30",
    true
  );
  assert.equal(n, 1);
  assert.ok(classes.has(explorer.DUE_CLASS));
  explorer.decorateFileExplorer(app, [], "2026-10-30", true);
  assert.ok(!classes.has(explorer.DUE_CLASS));
});
