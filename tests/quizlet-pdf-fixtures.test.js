"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { load } = require("./helpers/load");

const { T } = load();
const importer = T.cardsImport;
const FIXTURES = path.join(__dirname, "fixtures");

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), "utf8").replace(/\r\n?/g, "\n");
}

function pagesFrom(name) {
  return readFixture(name)
    .split("\n===PAGE===\n")
    .map((text, index) => ({ n: index + 1, text }));
}

function pairs(result) {
  return result.cards.map((card) => [card.front, card.back]);
}

test("quizlet PDF fixture: single-column flashcard printout", () => {
  const result = importer.parseQuizletPdf(pagesFrom("quizlet-flashcards-single-column.txt"), { deck: "Spanish" });
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards.length, 4);
  assert.deepEqual(pairs(result), [
    ["hola", "hello"],
    ["adiós", "goodbye"],
    ["gracias", "thank you"],
    ["por favor", "please"],
  ]);
});

test("quizlet PDF fixture: two-column tab-separated flashcard printout", () => {
  const result = importer.parseQuizletPdf(pagesFrom("quizlet-flashcards-two-column-tabs.txt"), { deck: "Spanish" });
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards.length, 4);
  assert.deepEqual(pairs(result), [
    ["hola", "hello"],
    ["adiós", "goodbye"],
    ["gracias", "thank you"],
    ["por favor", "please"],
  ]);
});

test("quizlet PDF fixture: tabbed header, set title and item numbers", () => {
  const result = importer.parseQuizletPdf(pagesFrom("quizlet-flashcards-tabbed-header.txt"), { deck: "Spanish" });
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards.length, 3);
  assert.deepEqual(pairs(result), [
    ["hola", "hello"],
    ["adiós", "goodbye"],
    ["gracias", "thank you"],
  ]);
});

test("quizlet PDF fixture: two pages with repeated handout headers", () => {
  const pages = pagesFrom("quizlet-flashcards-two-page-headers.txt");
  assert.equal(pages.length, 2);
  const result = importer.parseQuizletPdf(pages, { deck: "Spanish" });
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards.length, 4);
  assert.deepEqual(pairs(result), [
    ["hola", "hello"],
    ["adiós", "goodbye"],
    ["gracias", "thank you"],
    ["por favor", "please"],
  ]);
  assert.deepEqual(result.cards.map((card) => card.sourcePage), ["1", "1", "2", "2"]);
});

test("quizlet PDF fixture: numbered test with a multiple-choice answer key", () => {
  const result = importer.parseQuizletPdf(pagesFrom("quizlet-test-answer-key.txt"), { deck: "AP World" });
  assert.equal(result.errors.length, 0);
  assert.equal(result.questions, 3);
  assert.equal(result.cards.length, 3);
  assert.deepEqual(result.cards.map((card) => card.back), ["China", "Jefferson", "1914"]);
  assert.deepEqual(result.cards.map((card) => card.correctChoices), ["2", "2", "2"]);
  assert.equal(result.cards[0].choices.length, 4);
});

test("quizlet PDF fixture: mixed tabbed and plain term/definition rows", () => {
  const result = importer.parseQuizletPdf(pagesFrom("quizlet-flashcards-mixed-tabbed-plain.txt"), { deck: "Biology" });
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards.length, 4);
  assert.deepEqual(pairs(result), [
    ["mitochondria", "Powerhouse of the cell"],
    ["nucleus", "Contains DNA"],
    ["ribosome", "Makes proteins"],
    ["cell membrane", "Controls what enters and leaves"],
  ]);
});
