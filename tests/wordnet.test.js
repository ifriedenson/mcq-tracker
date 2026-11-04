"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const W = T.wordnet;

const NOUN = [
  "  1 WordNet license header, not a synset",
  "00001740 03 n 01 entity 0 0 | that which has existence",
  "00002000 03 n 01 dog 0 1 @ 00001740 n 0000 | a domestic animal",
  "00003000 03 n 02 canine 0 dog 0 0 | a dog",
].join("\n");
const VERB = "00004000 02 v 01 run 0 0 | move fast";
const ADJ = "00005000 00 a 01 quick 0 0 | moving fast";
const ADV = "00006000 00 r 01 quickly 0 0 | at a fast speed";

function dataFiles() {
  return [
    { name: "data.noun", text: NOUN },
    { name: "data.verb", text: VERB },
    { name: "data.adj", text: ADJ },
    { name: "data.adv", text: ADV },
  ];
}

test("wordnet: parses synsets, glosses, synonyms and pointers", () => {
  const dog = W.parseWordNetLine("00002000 03 n 01 dog 0 1 @ 00001740 n 0000 | a domestic animal");
  assert.equal(dog.offset, 2000);
  assert.equal(dog.pos, "n");
  assert.deepEqual(dog.words, ["dog"]);
  assert.equal(dog.gloss, "a domestic animal");
  assert.deepEqual(dog.pointers, [{ symbol: "@", target: 1740, targetPos: "n" }]);
  assert.equal(W.parseWordNetLine("  1 This is a license header, not data"), null);
  assert.equal(W.parseWordNetLine("00003000 03 n 00 0 0 | empty"), null);
  assert.equal(W.parseWordNetLine("00003000 03 n 01 no_gloss 0 0"), null, "a line without a gloss is ignored");
  assert.equal(W.normalizeWord(" physical_entity "), "physical entity");
  assert.equal(W.normalizePos("s"), "a", "adjective satellites use the adjective bucket");
});

test("wordnet: builds one index, resolves relations and looks up every sense", () => {
  const index = W.buildWordNetIndex(dataFiles());
  assert.equal(index.ok, true);
  assert.equal(index.stats.files, 4);
  assert.equal(index.stats.synsets, 6);
  assert.equal(index.stats.words, 6);
  assert.equal(index.stats.senses, 7);
  assert.equal(index.stats.relations, 1);
  assert.equal(index.stats.skipped, 0, "the license line is not counted as a broken synset");

  const found = W.lookupWord(index, "dog");
  assert.equal(found.ok, true);
  assert.equal(found.word, "dog");
  assert.equal(found.senses.length, 2);
  assert.equal(found.senses.some((sense) => sense.gloss === "a domestic animal"), true);
  assert.equal(found.senses.some((sense) => sense.gloss === "a dog"), true);
  const animal = found.senses.find((sense) => sense.gloss === "a domestic animal");
  assert.equal(animal.posLabel, "Noun");
  assert.deepEqual(animal.synonyms, ["dog"]);
  assert.equal(animal.relations.some((relation) => relation.label === "Hypernym" && relation.words.includes("entity")), true);

  assert.deepEqual(W.searchWords(index, "d"), ["dog"]);
  const missing = W.lookupWord(index, "d");
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "missing");
  assert.deepEqual(missing.suggestions, ["dog"]);
  assert.equal(W.lookupWord(index, "dog house").ok, false);
  assert.equal(W.lookupWord(null, "dog").reason, "not_loaded");
  assert.equal(W.lookupWord(index, "  ").reason, "query");
});

test("wordnet: rejects incomplete imports and normalises settings", () => {
  assert.deepEqual(W.normalizeWordNetSettings({}), { enabled: false, folder: "WordNet" });
  assert.deepEqual(W.normalizeWordNetSettings({ enabled: true, folder: "/Lexicon/" }), { enabled: true, folder: "Lexicon" });
  assert.equal(W.filePath("WordNet", "data.noun"), "WordNet/data.noun");

  const empty = W.buildWordNetIndex([{ name: "data.noun", text: "  1 no synsets here" }]);
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "empty");
});

test("wordnet: imports all four files into the vault, then reloads them from disk", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();

  const incomplete = await plugin.importWordNetFiles([{ name: "data.noun", text: NOUN }]);
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.message, /Missing: data\.verb/);
  assert.equal(app.created, undefined, "a refused import writes nothing");

  const result = await plugin.importWordNetFiles(dataFiles());
  assert.equal(result.ok, true, result.message);
  assert.equal(result.folder, "WordNet");
  assert.equal(app.created.filter((entry) => entry.path.startsWith("WordNet/data.")).length, 4);
  assert.equal(plugin.wordNetStatus().loaded, true);
  assert.equal(plugin.settings.wordNet.enabled, true);
  const lookup = plugin.wordNetLookup("dog");
  assert.equal(lookup.ok, true);
  assert.equal(lookup.senses.length, 2);

  plugin.wordNetIndex = null;
  const reloaded = await plugin.loadWordNet();
  assert.equal(reloaded.ok, true, reloaded.message);
  assert.equal(reloaded.stats.words, 6);
  assert.equal(plugin.wordNetStatus().loaded, true);
  assert.equal(plugin.wordNetLookup("quick").senses[0].posLabel, "Adjective");

  const duplicate = await plugin.importWordNetFiles(dataFiles());
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "exists");
});

test("wordnet: the enabled Vocabulary card renders senses and relations", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.wordNet = { enabled: true, folder: "WordNet" };
  plugin.wordNetIndex = W.buildWordNetIndex(dataFiles());
  const dom = makeDom();
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.contentEl = dom.root;
  view.tab = "vocabulary";
  view.wordNetFilter = "dog";
  view.render();
  const texts = dom.texts();
  assert.ok(texts.includes("WordNet offline dictionary"));
  assert.ok(texts.includes("a domestic animal"));
  assert.ok(texts.some((text) => text.includes("Synonyms: canine, dog")));
  assert.ok(texts.some((text) => text.includes("Hypernym: entity")));
});
