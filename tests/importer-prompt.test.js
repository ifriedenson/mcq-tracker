"use strict";
/*
 * The import agent prompt batches its own validation: write every note
 * first, then run one folder-wide check. One script per note costs a full
 * model round trip each, which is what makes a 70-question file slow to write
 * and would make a 100-file run several times slower.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();

const PROMPT_ARGS = {
  name: "Unit A.pdf",
  textPath: "import-text.txt",
  docPath: "Unit A.pdf",
  imagesDir: "images",
  folder: "Questions/Unit A",
  prefix: "UNIT-A",
  meta: {},
  kind: "pdf",
};

test("importer prompt: notes are written first, then one batched self-check", () => {
  const prompt = T.importer.agentPrompt(PROMPT_ARGS);
  assert.match(prompt, /write every note first/i);
  assert.match(prompt, /one command over the whole folder/i);
  assert.match(prompt, /prints only the files that fail/i);
  assert.match(prompt, /do not check notes one at a time/i);
});

test("importer prompt: the format, naming and done-line rules are unchanged", () => {
  const prompt = T.importer.agentPrompt(PROMPT_ARGS);
  assert.match(prompt, /UNIT-A-Q01\.md/);
  assert.match(prompt, /question_id match the file name/);
  assert.match(prompt, /how many notes you created/);
});
