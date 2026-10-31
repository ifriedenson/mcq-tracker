"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const extract = T.cardsExtract;

const NOTE = [
  "---",
  "flashcards: true",
  "---",
  "# Cell biology",
  "",
  "Question: What is the powerhouse of the cell?",
  "Answer: The mitochondrion.",
  "",
  "Q. What is osmosis?",
  "A. Movement of water across a membrane.",
  "",
  "**Question:** What is mitosis?",
  "**Answer:** Cell division.",
  "",
  "GDP :: Market value of final goods.",
  "Supply → Amount producers offer.",
  "Demand => Willingness to buy.",
  "- Photosynthesis — process plants use to make sugar.",
  "",
  "## Question",
  "What is DNA?",
  "## Answer",
  "The genetic material.",
  "",
  "Water {{c1::freezes}} at zero Celsius.",
  "",
  "```",
  "Fake: this code is not a card.",
  "```",
].join("\n");

const SEPARATOR_NOTE = [
  "Alpha :: One",
  "Beta :: Two",
  "Gamma :: Three",
  "Delta :: Four",
  "Epsilon :: Five",
  "Zeta :: Six",
].join("\n");

function sourceApp(text) {
  const notes = [{ path: "Notes/Deterministic.md", noFm: true, fm: {}, text }];
  const app = makeApp(notes);
  notes.forEach((note, index) => {
    app.files[index].fm = { ...note.fm };
  });
  return app;
}

async function sourcePlugin(text) {
  const app = sourceApp(text);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  return { app, plugin };
}

test("extract: explicit labels and separators join the deterministic rules", () => {
  const result = extract.extractCardsFromMarkdown(NOTE, { sourcePath: "Notes/Deterministic.md", deck: "Biology" });
  assert.equal(result.cards.length, 9);
  const pairs = result.cards.map((card) => `${card.front}=>${card.back}`);
  assert.ok(pairs.includes("What is the powerhouse of the cell?=>The mitochondrion."));
  assert.ok(pairs.includes("What is osmosis?=>Movement of water across a membrane."));
  assert.ok(pairs.includes("What is mitosis?=>Cell division."));
  assert.ok(pairs.includes("GDP=>Market value of final goods."));
  assert.ok(pairs.includes("Supply=>Amount producers offer."));
  assert.ok(pairs.includes("Demand=>Willingness to buy."));
  assert.ok(pairs.includes("Photosynthesis=>process plants use to make sugar."));
  assert.ok(pairs.includes("What is DNA?=>The genetic material."));
  assert.ok(pairs.includes("Water […] at zero Celsius.=>freezes"));
  assert.ok(result.cards.every((card) => card.importFormat === "outline"));
  assert.equal(result.seed, "");
  assert.equal(pairs.some((pair) => pair.includes("Fake")), false);
});

test("extract: the same seed reproduces card order across parses and a plugin restart", async () => {
  const first = extract.extractCardsFromMarkdown(SEPARATOR_NOTE, { sourcePath: "Notes/Deterministic.md", seed: "midterm-1" });
  const second = extract.extractCardsFromMarkdown(SEPARATOR_NOTE, { sourcePath: "Notes/Deterministic.md", seed: "midterm-1" });
  assert.deepEqual(first.cards.map((card) => card.front), second.cards.map((card) => card.front));
  assert.deepEqual(first.cards.map((card) => card.importKey), second.cards.map((card) => card.importKey));

  const one = await sourcePlugin(SEPARATOR_NOTE);
  const preview = await one.plugin.previewNoteCards("Notes/Deterministic.md", { seed: "midterm-1" });
  const reloaded = await sourcePlugin(SEPARATOR_NOTE);
  const afterRestart = await reloaded.plugin.previewNoteCards("Notes/Deterministic.md", { seed: "midterm-1" });
  assert.deepEqual(preview.cards.map((card) => [card.front, card.back]), afterRestart.cards.map((card) => [card.front, card.back]));
  assert.deepEqual(preview.cards.map((card) => card.importKey), afterRestart.cards.map((card) => card.importKey));
  assert.equal(preview.seed, "midterm-1");
});

test("extract: a different seed reorders the same cards and a blank seed keeps source order", () => {
  const plain = extract.extractCardsFromMarkdown(SEPARATOR_NOTE, { sourcePath: "Notes/Deterministic.md" });
  assert.deepEqual(plain.cards.map((card) => card.front), ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"]);
  const seeded = extract.extractCardsFromMarkdown(SEPARATOR_NOTE, { sourcePath: "Notes/Deterministic.md", seed: "midterm-1" });
  const other = extract.extractCardsFromMarkdown(SEPARATOR_NOTE, { sourcePath: "Notes/Deterministic.md", seed: "final-2" });
  assert.notDeepEqual(seeded.cards.map((card) => card.front), other.cards.map((card) => card.front));
  assert.deepEqual(
    seeded.cards.map((card) => card.front).sort(),
    plain.cards.map((card) => card.front).sort()
  );
});

test("extract: empty and malformed notes explain what is missing", () => {
  const empty = extract.extractCardsFromMarkdown("", { sourcePath: "Notes/Empty.md" });
  assert.equal(empty.cards.length, 0);
  assert.match(empty.warnings[0], /No card-like/i);

  const malformed = extract.extractCardsFromMarkdown("Question: Only a question\n\nThere is no answer.", { sourcePath: "Notes/Malformed.md" });
  assert.equal(malformed.cards.length, 0);
  assert.match(malformed.warnings[0], /needs both a question and an answer/i);

  assert.equal(extract.parseSeparatorCard("Front :: ", ["::"]), null);
  assert.equal(extract.parseSeparatorCard("- [ ] Read :: later", ["::"]), null);
  assert.equal(extract.parseSeparatorCard("Text {{c1::hidden}}", ["::"]), null);
  assert.deepEqual(extract.parseSeparatorCard("GDP :: Market value", ["::"]), {
    front: "GDP",
    back: "Market value",
    separator: "::",
  });
});

test("cards view: repeat-review retention is scoped and has an empty state", async () => {
  const notes = [
    {
      path: "Cards/Biology/reviewed.md",
      noFm: true,
      fm: {
        card_id: "reviewed",
        item_type: "card",
        deck: "Biology",
        history: ["2026-10-01|incorrect|10|A|1|", "2026-10-08|correct|10|A|1|", "2026-10-15|incorrect|10|A|1|"],
      },
      text: "## Front\nReviewed card\n\n## Back\nAnswer.",
    },
    {
      path: "Cards/Biology/fresh.md",
      noFm: true,
      fm: { card_id: "fresh", item_type: "card", deck: "Biology", history: ["2026-10-09|incorrect|10|A|1|"] },
      text: "## Front\nFresh card\n\n## Back\nAnswer.",
    },
  ];
  const app = makeApp(notes);
  notes.forEach((note, index) => {
    app.files[index].fm = { ...note.fm };
  });
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Card retention"));
  assert.ok(dom.texts().some((text) => /50% over 2 repeat reviews/.test(text)));

  const empty = makeDom();
  view.contentEl = empty.root;
  view.deck = "Chemistry";
  view.render();
  assert.ok(empty.texts().includes("Card retention"));
  assert.ok(empty.texts().some((text) => /appears after a card's second review/.test(text)));
});
