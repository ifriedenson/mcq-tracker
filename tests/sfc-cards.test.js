"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.sfcCards;

const DECK = `Deck: Cell biology
Type: basic
Front: What is the powerhouse of the cell?
Back: The mitochondrion.
---
Type: reversed
Front: The mitochondrion.
Back: What is the powerhouse of the cell?
---
Type: cloze
Text: The {{mitochondrion}} produces most of the cell's ATP.
---
Type: essay
Prompt: Explain how the sodium-potassium pump works.
Criterion: Mentions ATP
Criterion: Moves three sodium out and two potassium in
Model: The pump hydrolyses ATP to move ions against their gradients.
---
Type: worked
Problem: Solve 2x + 3 = 11.
Step: Subtract 3 from both sides: 2x = 8.
Step: Divide both sides by 2: x = 4.
Answer: x = 4
---
Type: sprint
Question: Which organelle produces most ATP?
A. Mitochondrion
B. Nucleus
Answer: A
Why: Oxidative phosphorylation happens in the inner membrane.
---
Type: source
Prompt: What does the passage say about osmosis?
Answer: Water moves across a semi-permeable membrane.
Source: Chapter 3, page 42`;

test("sfc cards: parses seven typed cards in one deck", () => {
  const parsed = S.parseSfcCardsBlock(DECK);
  assert.equal(parsed.deck, "Cell biology");
  assert.equal(parsed.cards.length, 7);
  assert.deepEqual(parsed.cards.map((card) => card.type), S.TYPES);
  assert.deepEqual(parsed.types, S.TYPES);
  assert.equal(parsed.cards[2].blanks[0], "mitochondrion");
  assert.equal(parsed.cards[3].criteria.length, 2);
  assert.equal(parsed.cards[4].steps.length, 2);
  assert.equal(parsed.cards[5].answer, "A");
  assert.equal(parsed.cards[6].source, "Chapter 3, page 42");
  assert.equal(parsed.issues.length, 0);
});

test("sfc cards: cloze blanks and reveals stay local", () => {
  const parsed = S.parseSfcCardsBlock(DECK);
  const cloze = parsed.cards[2];
  assert.match(S.clozePrompt(cloze.cloze), /\[ \.\.\. \]/);
  assert.doesNotMatch(S.clozePrompt(cloze.cloze), /mitochondrion/);
  assert.match(S.clozeRevealed(cloze.cloze), /mitochondrion/);
  assert.equal(S.revealSfcCard(parsed.cards[0]), "The mitochondrion.");
  assert.equal(S.revealSfcCard(parsed.cards[3]), "The pump hydrolyses ATP to move ions against their gradients.");
  assert.equal(S.revealSfcCard(parsed.cards[4]), "x = 4");
  assert.equal(S.revealSfcCard(parsed.cards[6]), "Water moves across a semi-permeable membrane.");
});

test("sfc cards: sprint grading accepts letters or answer text", () => {
  const sprint = S.parseSfcCardsBlock(DECK).cards[5];
  assert.equal(S.gradeSfcCard(sprint, "A").correct, true);
  assert.equal(S.gradeSfcCard(sprint, "a").correct, true);
  assert.equal(S.gradeSfcCard(sprint, "B").correct, false);
  assert.equal(S.gradeSfcCard(sprint, "B").key, "A");
  assert.equal(S.gradeSfcCard(sprint, "B").feedback, "Oxidative phosphorylation happens in the inner membrane.");
  assert.equal(S.gradeSfcCard(S.parseSfcCardsBlock(DECK).cards[0], "anything").correct, null);
});

test("sfc cards: malformed cards explain themselves and the switch gates the block", async () => {
  const parsed = S.parseSfcCardsBlock("Type: cloze\nText: No blanks here.\n---\nType: sprint\nQuestion: Pick one.\nA. Only choice\nAnswer: C");
  assert.equal(parsed.cards.length, 2);
  assert.equal(parsed.cards[0].valid, false);
  assert.match(parsed.issues.join(" "), /\{\{blank\}\}/);
  assert.equal(parsed.cards[1].valid, false);
  assert.match(parsed.issues.join(" "), /at least two/);

  const plugin = new QT(makeApp([]));
  await plugin.onload();
  assert.equal(plugin.sfcCardsEnabled(), true);
  plugin.settings.sfcCards.enabled = false;
  assert.equal(plugin.sfcCardsEnabled(), false);

  const dom = makeDom();
  S.renderSfcCardsBlock(null, "Deck: Warmup\nType: basic\nFront: What is ATP?\nBack: Cellular energy currency.", dom.root, {});
  assert.ok(dom.texts().includes("SFC Cards · Warmup"));
  await dom.click("Reveal");
  assert.ok(dom.texts().includes("Cellular energy currency."));
});
