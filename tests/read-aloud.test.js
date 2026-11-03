"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const R = T.readAloud;

test("read aloud: settings keep the old defaults and normalize the speech options", () => {
  const settings = R.normalizeReadAloudSettings({});
  assert.equal(settings.codeBlocks, "skip");
  assert.equal(settings.skipUrls, false);
  assert.equal(settings.spellAcronyms, false);
  assert.equal(settings.style, "full");
  const on = R.normalizeReadAloudSettings({ codeBlocks: "read", skipUrls: true, spellAcronyms: true });
  assert.equal(on.codeBlocks, "read");
  assert.equal(on.skipUrls, true);
  assert.equal(on.spellAcronyms, true);
  assert.equal(R.normalizeReadAloudSettings({ codeBlocks: "nonsense" }).codeBlocks, "skip");
  assert.deepEqual(R.CODE_BLOCK_MODES.map((mode) => mode.id), ["skip", "read"]);
});

test("read aloud: code blocks are skipped by default and read on request", () => {
  const note = "# Notes\n\nBefore.\n\n```js\nconst x = 1;\n```\n\nAfter.";
  assert.equal(R.stripForSpeech(note).includes("const x"), false);
  const read = R.stripForSpeech(note, { codeBlocks: "read" });
  assert.equal(read.includes("const x = 1;"), true);
  assert.equal(read.includes("```"), false);
  assert.equal(read.includes("Before."), true);
  assert.equal(read.includes("After."), true);
});

test("read aloud: URLs are dropped only when asked and link labels survive", () => {
  const note = "Read [the paper](https://example.com/paper) and https://example.com/bare plus www.example.org/x now.";
  const kept = R.stripForSpeech(note);
  assert.equal(kept.includes("https://example.com/bare"), true);
  assert.equal(kept.includes("the paper"), true);
  const skipped = R.stripForSpeech(note, { skipUrls: true });
  assert.equal(skipped.includes("example.com"), false);
  assert.equal(skipped.includes("www.example.org"), false);
  assert.equal(skipped.includes("the paper"), true);
  assert.equal(skipped.includes("now."), true);
});

test("read aloud: acronyms are spelled out only when enabled", () => {
  const note = "The NASA API returns JSON.";
  assert.equal(R.stripForSpeech(note, { spellAcronyms: true }), "The N A S A A P I returns J S O N.");
  assert.equal(R.stripForSpeech(note).includes("NASA"), true);
  assert.equal(R.stripForSpeech(note, { spellAcronyms: true }).includes("N A S A"), true);
});

test("read aloud: the speaking plan follows the speech options", () => {
  const note = "Intro.\n\n```js\nconst x = 1;\n```\n\nSee https://example.com for NASA.";
  const plan = R.buildReadAloudPlan(note, { skipUrls: true, spellAcronyms: true });
  assert.equal(plan.text.includes("example.com"), false);
  assert.equal(plan.text.includes("const x"), false);
  assert.ok(plan.sentences.some((sentence) => sentence.includes("N A S A")));
  assert.ok(plan.estimatedSeconds > 0);
  const withCode = R.buildReadAloudPlan(note, { codeBlocks: "read" });
  assert.equal(withCode.text.includes("const x = 1;"), true);
});
