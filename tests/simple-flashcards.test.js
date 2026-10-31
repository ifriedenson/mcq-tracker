"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.simpleFlashcards;

const BLOCK = `- French vocab :::
  - Capital of France :: Paris
  - el perro >> the dog
  - the dog << el perro
  - uno <> one
  - A plain note
    - A deeper note is ignored
- Outside the block :: is ignored`;

async function start() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

async function withMarkdown(fn) {
  const previous = obsidian.MarkdownRenderer.render;
  obsidian.MarkdownRenderer.render = async (_app, markdown, el) => {
    el.createDiv({ cls: "test-markdown", text: markdown });
  };
  try {
    return await fn();
  } finally {
    obsidian.MarkdownRenderer.render = previous;
  }
}

test("simple flashcards: only direct children of a ::: block become cards", () => {
  const parsed = S.parseSimpleFlashcards(BLOCK);
  assert.equal(parsed.blocks, 1);
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.cards.map((card) => [card.front, card.back]), [
    ["Capital of France", "Paris"],
    ["el perro", "the dog"],
    ["el perro", "the dog"],
    ["uno", "one"],
    ["one", "uno"],
  ]);
});

test("simple flashcards: delimiters map to the documented directions", () => {
  const parsed = S.parseSimpleFlashcards(BLOCK);
  const byType = parsed.cards.reduce((out, card) => {
    out[card.type] = out[card.type] || [];
    out[card.type].push(card);
    return out;
  }, {});
  assert.equal(byType.basic[0].front, "Capital of France");
  assert.equal(byType.forward[0].front, "el perro");
  assert.equal(byType.backward[0].front, "el perro");
  assert.equal(byType.backward[0].direction, "reverse");
  assert.deepEqual(byType.bidirectional.map((card) => [card.front, card.back]), [
    ["uno", "one"],
    ["one", "uno"],
  ]);
});

test("simple flashcards: grouped clozes hide one group at a time", () => {
  const parsed = S.parseSimpleFlashcards(`- Geography :::
  - {1|Paris} is the capital of {1|France}; {2|Berlin} is in Germany.
  - The sky is {blue}.`);
  assert.equal(parsed.cards.length, 3);
  assert.equal(parsed.cards[0].front, "______ is the capital of ______; Berlin is in Germany.");
  assert.equal(parsed.cards[0].back, "Paris, France");
  assert.equal(parsed.cards[1].front, "Paris is the capital of France; ______ is in Germany.");
  assert.equal(parsed.cards[1].back, "Berlin");
  assert.equal(parsed.cards[2].front, "The sky is ______.");
  assert.equal(parsed.cards[2].back, "blue");
});

test("simple flashcards: multiline answers keep nested bullets and deck tags are scoped", () => {
  const parsed = S.parseSimpleFlashcards(`- Astronomy #deck/Science :::
  - Inner planets #deck/Space ;;
    - Mercury
    - Venus, Earth, Mars
  - Outer planets ;;
    - Jupiter
    - Saturn`);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.cards[0].deck, "Space");
  assert.equal(parsed.cards[0].type, "multiline");
  assert.equal(parsed.cards[0].back, "- Mercury\n- Venus, Earth, Mars");
  assert.equal(parsed.cards[1].deck, "Science");
  assert.equal(parsed.cards[1].back, "- Jupiter\n- Saturn");
});

test("simple flashcards: malformed blocks explain the missing piece without throwing", () => {
  const noBlock = S.parseSimpleFlashcards("Just an ordinary note");
  assert.match(noBlock.issues.join(" "), /bullet ending in :::/);

  const empty = S.parseSimpleFlashcards("- Empty :::\n- not a child");
  assert.match(empty.issues.join(" "), /no cards/);

  const noSide = S.parseSimpleFlashcards("- Block :::\n  - :: Paris");
  assert.match(noSide.issues.join(" "), /both sides/);

  const noAnswer = S.parseSimpleFlashcards("- Block :::\n  - Planets ;;");
  assert.match(noAnswer.issues.join(" "), /nested bullet/);

  const trailing = S.parseSimpleFlashcards("- Block :::\n  - Planets ;; extra\n    - Mercury");
  assert.match(trailing.issues.join(" "), /end of the card line/);
});

test("simple flashcards: the block reveals an answer, advances and restarts", async () => {
  const { plugin } = await start();
  await withMarkdown(async () => {
    const dom = makeDom();
    await plugin.renderSimpleFlashcardsBlock(BLOCK, dom.root, { sourcePath: "Notes/French.md" });
    assert.ok(dom.all.some((option) => option.classes.has("qt-flashcards")));
    assert.ok(dom.texts().includes("1 / 5"));
    assert.ok(dom.texts().includes("Capital of France"));
    assert.ok(!dom.texts().includes("Paris"));
    await dom.click("Show answer");
    assert.ok(dom.texts().includes("Paris"));
    await dom.click("Next card");
    assert.ok(dom.texts().includes("2 / 5"));
    await dom.click("Show answer");
    await dom.click("Next card");
    await dom.click("Show answer");
    await dom.click("Next card");
    await dom.click("Show answer");
    await dom.click("Next card");
    await dom.click("Show answer");
    assert.ok(dom.texts().includes("5 / 5"));
    await dom.click("Review again");
    assert.ok(dom.texts().includes("1 / 5"));
  });
});

test("simple flashcards: a malformed block renders a useful message", async () => {
  const { plugin } = await start();
  const dom = makeDom();
  await plugin.renderSimpleFlashcardsBlock("- Empty :::", dom.root, { sourcePath: "Notes/Broken.md" });
  assert.ok(dom.texts().some((text) => text.includes("no cards")), JSON.stringify(dom.texts()));
  assert.ok(dom.all.some((option) => option.classes.has("qt-flashcards-issue")));
});

test("simple flashcards: the block is registered and reading it writes nothing", async () => {
  const { app, plugin } = await start();
  assert.ok(plugin.codeBlocks["simple-flashcards"]);
  await withMarkdown(async () => {
    const dom = makeDom();
    await plugin.renderSimpleFlashcardsBlock(BLOCK, dom.root, { sourcePath: "Notes/French.md" });
    await dom.click("Show answer");
  });
  assert.equal(app.created, undefined);
  assert.equal(app.modified, undefined);
  assert.equal(plugin.saved, null);
});
