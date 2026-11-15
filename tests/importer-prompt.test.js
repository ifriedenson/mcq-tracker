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

test("importer prompt: the agent reads only the supplied text file", () => {
  // A live run with a weaker model spent minutes unzipping export bundles and
  // reading unrelated vault notes instead of the extracted text, because the
  // prompt listed the files without saying not to go looking for more.
  const prompt = T.importer.agentPrompt(PROMPT_ARGS);
  assert.match(prompt, /Read this one file:/i);
  assert.match(prompt, /Do not open the original document/i);
  assert.match(prompt, /do not search the vault/i);
});

test("importer prompt: notes are written immediately after one read, before any command", () => {
  const prompt = T.importer.agentPrompt(PROMPT_ARGS);
  assert.match(prompt, /Do exactly these three steps, in this order/i);
  assert.match(prompt, /Read this one file: import-text\.txt/);
  assert.match(prompt, /Write every note from it, starting immediately/i);
  assert.match(prompt, /Never run a command before the notes exist/i);
});

test("importer prompt: absolute vault paths survive any server working directory", () => {
  // Live: a user-run OpenCode server started in $HOME resolved the prompt's
  // vault-relative note folder against its own directory, so two finished
  // notes landed outside the vault while the file recorded done with 0 notes.
  const abs = T.importer.absoluteVaultPath;
  assert.equal(abs("/vault", "Questions/Unit A"), "/vault/Questions/Unit A");
  assert.equal(abs("/vault/", "Questions/Unit A/_import-text-ab12.txt"), "/vault/Questions/Unit A/_import-text-ab12.txt");
  assert.equal(abs("", "Questions/Unit A"), "Questions/Unit A");
  assert.equal(abs("/vault", "/already/abs.md"), "/already/abs.md");
  assert.equal(abs("C:\\vault", "Questions\\Unit A"), "C:/vault/Questions/Unit A");
  assert.equal(abs("/vault", ""), "");
});

test("importer prompt: paths are given exactly as written, never as relative", () => {
  const prompt = T.importer.agentPrompt({
    ...PROMPT_ARGS,
    textPath: "/vault/Questions/Unit A/_import-text-ab12.txt",
    docPath: "/vault/Unit A.pdf",
    imagesDir: "/vault/Questions/Unit A/images",
    folder: "/vault/Questions/Unit A",
  });
  assert.match(prompt, /Read this one file: \/vault\/Questions\/Unit A\/_import-text-ab12\.txt/);
  assert.match(prompt, /Create the notes in this folder, which already exists: \/vault\/Questions\/Unit A/);
  assert.match(prompt, /exactly as written/);
  assert.equal(prompt.includes("relative to the folder"), false);
});
