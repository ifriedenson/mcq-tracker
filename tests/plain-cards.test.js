"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const plain = T.plainCards;

test("plain cards: basic, reversed, cloze and folder-deck syntax", () => {
  assert.deepEqual(plain.normalizePlainCards({ enabled: true, folder: "/Flashcards/" }), {
    enabled: true,
    folder: "Flashcards",
  });
  assert.deepEqual(plain.normalizePlainCards({}), { enabled: false, folder: "" });

  assert.deepEqual(plain.inferPlainCard("What is a cell?\n---\nThe basic unit."), {
    cardType: "basic",
    front: "What is a cell?",
    back: "The basic unit.",
  });
  assert.deepEqual(plain.inferPlainCard("A prompt\n---\n---\nA reversed answer"), {
    cardType: "reversed",
    front: "A prompt",
    back: "A reversed answer",
  });
  assert.deepEqual(plain.inferPlainCard("The ~~capital~~ is Paris."), {
    cardType: "cloze",
    front: "The ~~capital~~ is Paris.",
    back: "",
  });
  assert.equal(plain.inferPlainCard("A note without a divider"), null);
  assert.equal(plain.inferPlainCard("```\nfront\n---\nback\n```"), null);

  assert.equal(plain.plainDeckName("Flashcards/Cell.md", "Flashcards"), "Flashcards");
  assert.equal(plain.plainDeckName("Flashcards/Bio/Cell.md", "Flashcards"), "Flashcards::Bio");
  assert.equal(plain.plainDeckName("Flashcards/Bio/Chem/Atom.md", "Flashcards"), "Flashcards::Bio::Chem");
  assert.equal(plain.plainDeckName("Notes/Cell.md", "Flashcards"), "");
  assert.equal(plain.isPlainPath("Flashcards/Bio/Cell.md", "Flashcards"), true);
  assert.equal(plain.isPlainPath("FlashcardsOld/Cell.md", "Flashcards"), false);
});

test("cards: plain structure feeds the existing card parser without frontmatter", () => {
  const basic = T.cards.parseCardBody("What is a cell?\n---\nThe basic unit.", {});
  assert.equal(basic.cardType, "basic");
  assert.equal(basic.front, "What is a cell?");
  assert.equal(basic.back, "The basic unit.");

  const reversed = T.cards.parseCardBody("A prompt\n---\n---\nA reversed answer", {});
  assert.equal(reversed.cardType, "reversed");
  assert.equal(reversed.front, "A reversed answer");
  assert.equal(reversed.back, "A prompt");

  const cloze = T.cards.parseCardBody("The ~~capital~~ is Paris.", {});
  assert.equal(cloze.cardType, "cloze");
  assert.equal(cloze.front, "The […] is Paris.");
  assert.equal(cloze.back, "capital");
});

test("plugin: plain Markdown cards are opt-in and use the folder tree in Anki", async () => {
  const notes = [
    { path: "Flashcards/Bio/Cell.md", noFm: true, text: "What is a cell?\n---\nThe basic unit." },
    { path: "Flashcards/Chem/Atom.md", noFm: true, text: "What is an atom?\n---\nA unit of matter." },
    { path: "Notes/NotACard.md", noFm: true, text: "Ordinary note\n---\nNot in the card folder." },
  ];
  const app = makeApp(notes);
  notes.forEach((note, index) => (app.files[index].fm = {}));
  const plugin = new QT(app);
  await plugin.onload();

  assert.equal(plugin.settings.cards.plainMarkdown.enabled, false);
  assert.equal(plugin.getCards().length, 0);

  plugin.settings.cards.enabled = true;
  plugin.settings.cards.plainMarkdown = { enabled: true, folder: "Flashcards" };
  assert.equal(await plugin.refreshPlainCards(), 2);
  const cards = plugin.getCards();
  assert.deepEqual(cards.map((card) => card.file.path).sort(), ["Flashcards/Bio/Cell.md", "Flashcards/Chem/Atom.md"]);
  assert.equal(cards.find((card) => card.file.path === "Flashcards/Bio/Cell.md").deck, "Flashcards::Bio");
  assert.ok(plugin.commands.some((command) => command.id === "cards-rescan-plain"));

  const card = cards.find((item) => item.file.path === "Flashcards/Bio/Cell.md");
  await plugin.recordCardReview(card, "good", 5);
  assert.equal(app.files.find((file) => file.path === card.file.path).fm.attempts, 1);

  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push(body);
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [101, 102] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "" };
    const result = await plugin.pushCardsToAnki({});
    assert.equal(result.count, 2);
    const push = actions.find((body) => body.action === "canAddNotes");
    const bio = push.params.notes.find((note) => note.fields.Front === "What is a cell?");
    assert.equal(bio.deckName, "Flashcards::Bio");
    assert.equal(bio.fields.Front, "What is a cell?");
    assert.equal(bio.fields.Back, "The basic unit.");
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("plugin: a plain note without a front/back structure stays out of the card queue", async () => {
  const app = makeApp([
    { path: "Flashcards/Loose.md", noFm: true, text: "Just an ordinary note with no divider." },
    { path: "Flashcards/Good.md", noFm: true, text: "Front\n---\nBack" },
  ]);
  app.files.forEach((file) => (file.fm = {}));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.plainMarkdown = { enabled: true, folder: "Flashcards" };
  assert.equal(await plugin.refreshPlainCards(), 1);
  assert.deepEqual(plugin.getCards().map((card) => card.file.path), ["Flashcards/Good.md"]);
});

test("plugin: repeated question and card reads reuse the cache until data changes", async () => {
  const notes = [
    { path: "Questions/One.md", fm: { question_id: "one" } },
    { path: "Cards/One.md", fm: { card_id: "one", deck: "Default" } },
  ];
  const app = makeApp(notes);
  app.files[1].fm = { card_id: "one", deck: "Default" };
  const plugin = new QT(app);
  await plugin.onload();

  let scans = 0;
  const original = app.vault.getMarkdownFiles;
  app.vault.getMarkdownFiles = () => {
    scans++;
    return original();
  };

  const first = plugin.getQuestions();
  const second = plugin.getQuestions();
  assert.equal(scans, 1);
  assert.notEqual(second, first);
  assert.equal(second[0], first[0]);
  assert.equal(second.length, 1);

  const cards = plugin.getCards();
  const cardsAgain = plugin.getCards();
  assert.equal(scans, 2);
  assert.notEqual(cardsAgain, cards);
  assert.equal(cardsAgain[0], cards[0]);

  await plugin.recordCardReview(cards[0], "good", 5);
  scans = 0;
  const afterReview = plugin.getCards();
  assert.equal(scans, 1, "a review invalidates the card cache");
  assert.equal(afterReview[0].fm.attempts, 1);

  scans = 0;
  plugin.settings.questionFolder = "Elsewhere";
  assert.equal(plugin.getQuestions().length, 0);
  assert.equal(scans, 1, "changing the question folder does not reuse another folder's cache");
});

test("plugin: plain-card events are debounced and limited to the card folder", async () => {
  const app = makeApp([
    { path: "Flashcards/Inside.md", noFm: true, text: "Front\n---\nBack" },
    { path: "Notes/Outside.md", noFm: true, text: "Front\n---\nBack" },
  ]);
  app.files.forEach((file) => (file.fm = {}));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.plainMarkdown = { enabled: true, folder: "Flashcards" };

  const inside = app.files.find((file) => file.path === "Flashcards/Inside.md");
  const outside = app.files.find((file) => file.path === "Notes/Outside.md");
  assert.equal(plugin.plainCardsEventRelevant(inside), true);
  assert.equal(plugin.plainCardsEventRelevant(outside), false);
  assert.equal(plugin.plainCardsEventRelevant(outside, "Flashcards/Inside.md"), true);

  let scans = 0;
  plugin.refreshPlainCards = async () => {
    scans++;
    return 0;
  };
  plugin.schedulePlainCardRefresh(0);
  plugin.schedulePlainCardRefresh(0);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(scans, 1);
});
