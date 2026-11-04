"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const rc = T.readingCompanion;

test("reading companion: a passage prompt carries its page link, quote, note and tags", () => {
  const prompt = rc.passagePrompt(
    "Papers/Exam.pdf",
    {
      id: "ann-1",
      page: 2,
      type: "quote",
      quote: "ATP is energy",
      note: "remember this",
      tags: ["bio", "key-idea"],
    },
    "Why does ATP matter here?"
  );
  assert.match(prompt, /\[\[Papers\/Exam\.pdf#page=2&annotation=ann-1\]\]/);
  assert.match(prompt, /Page 2 · quote/);
  assert.match(prompt, /> ATP is energy/);
  assert.match(prompt, /My note: remember this/);
  assert.match(prompt, /Tags: #bio #key-idea/);
  assert.match(prompt, /Question: Why does ATP matter here\?/);
  assert.match(prompt, /untrusted study material/);
  assert.match(prompt, /Cite the source/);
});

test("reading companion: note-only, page and empty annotations are shaped correctly", () => {
  const note = rc.passagePrompt("Papers/Exam.pdf", { page: 3, type: "note", note: "Check chapter 4" });
  assert.match(note, /My note: Check chapter 4/);
  assert.doesNotMatch(note, /Passage:/);
  assert.match(note, new RegExp(rc.DEFAULT_QUESTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const page = rc.passagePrompt("Papers/Exam.pdf", { page: 4, type: "page", quote: "A whole page" });
  assert.match(page, /Page text:/);
  assert.match(page, /> A whole page/);
  assert.match(page, /\[\[Papers\/Exam\.pdf#page=4\]\]/);

  assert.equal(rc.passagePrompt("Papers/Exam.pdf", { page: 2, type: "highlight", quote: "", note: "" }), "");
  assert.equal(rc.passagePrompt("", null), "");
});

test("reading companion: prompt text is bounded and control characters are removed", () => {
  const long = "x".repeat(rc.MAX_QUOTE + 50);
  const prompt = rc.passagePrompt("Papers/Exam.pdf", { page: 2, type: "quote", quote: long }, "q".repeat(rc.MAX_QUESTION + 50));
  const quoteLine = prompt.split("\n").find((line) => line.startsWith("> "));
  assert.equal(quoteLine.length, rc.MAX_QUOTE + 2, "the quote is capped");
  const questionLine = prompt.split("\n").find((line) => line.startsWith("Question: "));
  assert.equal(questionLine.length, "Question: ".length + rc.MAX_QUESTION, "the question is capped");

  const dirty = rc.passagePrompt("Papers/Exam.pdf", { page: 2, type: "quote", quote: "a\u0000b\u0007c" });
  assert.match(dirty, /> abc/);
  assert.doesNotMatch(dirty, /\u0000|\u0007/);
});

test("reading companion: an unsafe source path falls back to a readable page reference", () => {
  assert.equal(rc.passageSource("Papers/Exam.pdf", 2, "bad id!"), "Papers/Exam.pdf (page 2)");
  assert.equal(rc.passageSource("", 0, ""), "PDF (page 1)");
  const prompt = rc.passagePrompt("Papers/Exam.pdf", { page: 2, type: "quote", quote: "text" }, "");
  assert.match(prompt, /Source: \[\[Papers\/Exam\.pdf#page=2\]\]/);
});

test("reading companion: page text is rebuilt in reading order and capped", () => {
  const text = rc.pageTextFromItems([
    { s: "world", x: 0.6, y: 0.2 },
    { s: "hello", x: 0.1, y: 0.2 },
    { s: "next", x: 0.1, y: 0.4 },
    { s: "   ", x: 0.1, y: 0.5 },
    { s: "last", x: 0.1, y: 0.6 },
  ]);
  assert.equal(text, "hello world\nnext\nlast");
  assert.equal(rc.pageTextFromItems([{ s: "a" }, { s: "b" }]), "a b");
  assert.equal(rc.pageTextFromItems([]), "");
  assert.equal(rc.pageTextFromItems([{ s: "x".repeat(50) }], 10).length, 10);
});
