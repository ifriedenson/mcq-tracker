"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const L = T.learnkit;

const NOTE = `# Territory

Some prose that is not a card.

T | France |
Q | What is the capital of France? |
A | Paris |
I | Located on the Seine |
G | Geography |

T | Cloze |
CQ | The capital of France is {{c1::Paris}} and the river is the {{c2::Seine}} |
G | Geography |

T | Capitals |
MCQ | Which of these are French cities? |
A | Paris |
A | Lyon |
O | London |
O | Berlin |
I | Paris and Lyon are in France |
G | Geography |
^learnkit-123456
`;

test("LearnKit: reads basic, cloze and MCQ blocks with title, notes and group", () => {
  const parsed = L.parseLearnKit(NOTE, { sourcePath: "Notes/Deck.md" });
  assert.equal(parsed.cards.length, 3);
  const basic = parsed.cards[0];
  assert.equal(basic.front, "What is the capital of France?");
  assert.equal(basic.back, "Paris");
  assert.equal(basic.title, "France");
  assert.equal(basic.notes, "Located on the Seine");
  assert.equal(basic.deck, "Geography");
  assert.deepEqual(basic.tags, ["Geography"]);

  const cloze = parsed.cards[1];
  assert.equal(cloze.cardType, "cloze");
  assert.match(cloze.front, /\{\{c1::Paris\}\}/);

  const mcq = parsed.cards[2];
  assert.deepEqual(mcq.choices, ["Paris", "Lyon", "London", "Berlin"]);
  assert.deepEqual(mcq.correctChoices, [1, 2]);
  assert.equal(mcq.questionSet, "learnkit");
});

test("LearnKit: reads quick cards, auto-numbers bare cloze tokens and keeps hints", () => {
  const text = [
    "What is 2 + 2?::4",
    "Reverse this?:::The answer",
    "cloze::The {{capital}} of France is {{Paris::city}}",
    "{{c9::kept}} stays numbered",
  ].join("\n");
  const parsed = L.parseLearnKit(text, { sourcePath: "Notes/Quick.md", deck: "Quick" });
  assert.equal(parsed.cards.length, 3, "a bare cloze token is prose, not a quick card");
  const basic = parsed.cards.find((card) => card.front === "What is 2 + 2?");
  assert.equal(basic.cardType, "basic");
  assert.equal(basic.back, "4");
  const reversed = parsed.cards.find((card) => card.front === "Reverse this?");
  assert.equal(reversed.cardType, "reversed");
  const cloze = parsed.cards.find((card) => card.cardType === "cloze");
  assert.match(cloze.front, /\{\{c1::capital\}\}/);
  assert.match(cloze.front, /\{\{c2::Paris::city\}\}/);
});

test("LearnKit: ordered questions become basic cards and hotspot cards are skipped", () => {
  const text = [
    "OQ | Arrange the water cycle |",
    "1 | Evaporation |",
    "2 | Condensation |",
    "3 | Precipitation |",
    "G | Earth science |",
    "",
    "HQ | ![[diagram.png]] |",
    "Q | Click the nucleus |",
    "M | click |",
  ].join("\n");
  const parsed = L.parseLearnKit(text, { sourcePath: "Notes/Science.md" });
  assert.equal(parsed.cards.length, 1);
  assert.equal(parsed.skipped, 1);
  assert.match(parsed.cards[0].back, /1\. Evaporation\n2\. Condensation/);
  assert.ok(parsed.warnings.some((warning) => /Ordered questions/.test(warning)));
  assert.ok(parsed.skippedDetails.some((detail) => /hotspot/.test(detail.reason)));
});

test("LearnKit: ::: pairs variants and :: makes every combination", () => {
  const sequential = L.parseLearnKit("Q | France ::: Spain |\nA | Paris ::: Madrid |", { sourcePath: "Notes/Combo.md" });
  assert.deepEqual(sequential.cards.map((card) => [card.front, card.back]), [["France", "Paris"], ["Spain", "Madrid"]]);
  const cross = L.parseLearnKit("Q | One :: Two |\nA | A :: B |", { sourcePath: "Notes/Combo.md" });
  assert.equal(cross.cards.length, 4);
});

test("LearnKit: export writes blocks that read back with the same sides", () => {
  const records = [
    {
      file: { basename: "France" },
      fm: { card_title: "France", deck: "Geography", card_type: "basic" },
      body: { cardType: "basic", front: "Capital?", back: "Paris" },
    },
    {
      file: { basename: "Cities" },
      fm: {
        card_title: "Cities",
        deck: "Geography",
        choice_1: "Paris",
        choice_2: "Lyon",
        choice_3: "London",
        correct_choices: "1,2",
      },
      body: { cardType: "basic", front: "Which are French?", back: "Paris · Lyon" },
    },
    {
      file: { basename: "Cloze" },
      fm: { card_title: "Cloze", deck: "Geography", card_type: "cloze" },
      body: { cardType: "cloze", rawFront: "The capital is {{c1::Paris}}", back: "Paris" },
    },
  ];
  const text = L.cardsToLearnKit(records);
  assert.match(text, /Q \| Capital\? \|/);
  assert.match(text, /MCQ \| Which are French\? \|/);
  assert.match(text, /CQ \| The capital is \{\{c1::Paris\}\} \|/);
  const parsed = L.parseLearnKit(text, { sourcePath: "Cards/exports/Geography learnkit.md" });
  assert.equal(parsed.cards.length, 3);
  assert.deepEqual(parsed.cards.map((card) => card.front), ["Capital?", "Which are French?", "The capital is {{c1::Paris}}"]);
  assert.equal(parsed.cards[1].choices.length, 3);
  assert.deepEqual(parsed.cards[1].correctChoices, [1, 2]);
});

test("plugin: imports a LearnKit note and exports it back", async () => {
  const app = makeApp([{ path: "Notes/Deck.md", fm: {}, text: NOTE }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;

  const preview = await plugin.previewCardsImport("learnkit", "Notes/Deck.md", {});
  assert.equal(preview.total, 3);
  assert.equal(preview.duplicates, 0);

  const result = await plugin.importCardsFromLearnKit("Notes/Deck.md", {});
  assert.equal(result.created, 3);
  const imported = app.created.filter((file) => file.path.startsWith("Cards/Geography/"));
  assert.equal(imported.length, 3);
  assert.ok(imported.some((file) => /deck: "Geography"/.test(file.text)));

  const exportApp = makeApp([
    { path: "Cards/Geography/France.md", fm: { card_id: "a", item_type: "card", deck: "Geography" }, text: "## Front\nWhat is the capital of France?\n\n## Back\nParis" },
    { path: "Cards/Geography/Cloze.md", fm: { card_id: "b", item_type: "card", deck: "Geography", card_type: "cloze" }, text: "## Front\nThe capital is {{c1::Paris}}\n\n## Back\nParis" },
    { path: "Cards/Geography/Cities.md", fm: { card_id: "c", item_type: "card", deck: "Geography", choice_1: "Paris", choice_2: "Lyon", choice_3: "London", correct_choices: "1,2" }, text: "## Front\nWhich are French?\n\n## Back\nParis · Lyon" },
  ]);
  const exportPlugin = new QT(exportApp);
  await exportPlugin.onload();
  exportPlugin.settings.cards.enabled = true;
  const exported = await exportPlugin.exportCards("learnkit", { deck: "Geography" });
  assert.match(exported.path, /^Cards\/exports\/Geography learnkit .*\.md$/);
  const written = exportApp.created.find((file) => file.path === exported.path);
  assert.ok(written);
  assert.match(written.text, /T \| France \|/);
  assert.match(written.text, /Q \| What is the capital of France\? \|/);
  assert.match(written.text, /MCQ \| Which are French\? \|/);
});
