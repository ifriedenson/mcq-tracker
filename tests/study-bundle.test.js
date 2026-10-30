"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const B = T.studyBundle;

/** Reads the stored entries of the ZIP this plugin writes, without a ZIP dependency. */
function readStoredZip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const decoder = new TextDecoder();
  const out = new Map();
  let p = 0;
  while (p + 30 <= u8.length && view.getUint32(p, true) === 0x04034b50) {
    const method = view.getUint16(p + 8, true);
    const size = view.getUint32(p + 18, true);
    const nameLen = view.getUint16(p + 26, true);
    const extraLen = view.getUint16(p + 28, true);
    const name = decoder.decode(u8.subarray(p + 30, p + 30 + nameLen));
    const start = p + 30 + nameLen + extraLen;
    assert.equal(method, 0, "stored entries only");
    out.set(name, decoder.decode(u8.subarray(start, start + size)));
    p = start + size;
  }
  return out;
}

const QUESTION_ONE = "---\nquestion_id: Q1\ncourse: Bio\n---\n\n## Question\nWhat is ATP?\n";
const QUESTION_TWO = "---\nquestion_id: Q2\n---\n\n## Question\nSymbol for gold?\n";
const CARD_ONE = "---\ncard_id: c1\ndeck: Biology\n---\n\n## Front\nATP\n";

test("study bundle: notes, manifest and README are stored unchanged", () => {
  const built = B.buildStudyBundle({
    questions: [
      { path: "Questions/Bio/Q1.md", text: QUESTION_ONE },
      { path: "Questions/Chem/Q2.md", text: QUESTION_TWO },
    ],
    cards: [{ path: "Cards/Bio/ATP.md", text: CARD_ONE }],
    date: "2026-10-30",
    version: "1.129.0",
  });
  const entries = readStoredZip(built.archive);
  assert.deepEqual([...entries.keys()].sort(), [
    "README.md",
    "cards/Cards/Bio/ATP.md",
    "manifest.json",
    "questions/Questions/Bio/Q1.md",
    "questions/Questions/Chem/Q2.md",
  ]);
  assert.equal(entries.get("questions/Questions/Bio/Q1.md"), QUESTION_ONE, "note text is untouched");
  assert.equal(entries.get("cards/Cards/Bio/ATP.md"), CARD_ONE);
  const manifest = JSON.parse(entries.get("manifest.json"));
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.plugin_version, "1.129.0");
  assert.equal(manifest.exported, "2026-10-30");
  assert.deepEqual(manifest.counts, { questions: 2, cards: 1 });
  assert.equal(manifest.notes.questions[0].source, "Questions/Bio/Q1.md");
  assert.match(entries.get("README.md"), /2 question notes/);
  assert.match(entries.get("README.md"), /1 card note/);
});

test("study bundle: unsafe paths cannot escape and repeated names are numbered", () => {
  const built = B.buildStudyBundle({
    questions: [
      { path: "../Escape/Q.md", text: "one" },
      { path: "Notes/Same.md", text: "two" },
      { path: "Notes\\Same.md", text: "three" },
    ],
    date: "not-a-date",
  });
  const names = built.entries.filter((name) => name.startsWith("questions/"));
  assert.ok(names.every((name) => !name.includes("..")), "no parent-directory hop");
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, names.length, "unique entries");
  assert.ok(names.includes("questions/Escape/Q.md"));
  assert.ok(names.includes("questions/Notes/Same.md"));
  assert.ok(names.includes("questions/Notes/Same 2.md"));
  assert.equal(B.safeDay("not-a-date"), "export");
  assert.equal(B.bundleFileName("2026-10-30"), "mcq-study-bundle-2026-10-30.zip");
});

test("study bundle: an empty note is skipped instead of writing a blank file", () => {
  const built = B.buildStudyBundle({ questions: [{ path: "Questions/Empty.md", text: "   " }] });
  assert.equal(built.manifest.counts.questions, 0);
  assert.ok(!built.entries.some((name) => name.includes("Questions/Empty.md")));
});

async function start(notes) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

test("study bundle: the plugin writes questions and cards to a numbered-safe ZIP", async () => {
  const { app, plugin } = await start([
    { path: "Questions/Bio/Q1.md", fm: { question_id: "Q1", course: "Bio" }, text: QUESTION_ONE },
    { path: "Cards/Bio/ATP.md", fm: { question_id: undefined, card_id: "c1", deck: "Biology" }, text: CARD_ONE },
  ]);
  plugin.settings.cards.enabled = true;
  const result = await plugin.exportStudyBundle();
  assert.ok(result, "a bundle was written");
  assert.deepEqual(result.counts, { questions: 1, cards: 1 });
  assert.match(result.path, /^mcq-study-bundle-\d{4}-\d{2}-\d{2}\.zip$/);
  const written = (app.createdBinary || []).find((file) => file.path === result.path);
  assert.ok(written, "binary file was written");
  const entries = readStoredZip(written.buffer);
  assert.match(entries.get("questions/Questions/Bio/Q1.md"), /What is ATP\?/);
  assert.match(entries.get("cards/Cards/Bio/ATP.md"), /deck: Biology/);
  const manifest = JSON.parse(entries.get("manifest.json"));
  assert.equal(manifest.counts.cards, 1);
});

test("study bundle: cards stay out while the Cards module is off, and an empty vault writes nothing", async () => {
  const { app, plugin } = await start([
    { path: "Questions/Bio/Q1.md", fm: { question_id: "Q1" }, text: QUESTION_ONE },
    { path: "Cards/Bio/ATP.md", fm: { question_id: undefined, card_id: "c1", deck: "Biology" }, text: CARD_ONE },
  ]);
  plugin.settings.cards.enabled = false;
  const result = await plugin.exportStudyBundle();
  assert.deepEqual(result.counts, { questions: 1, cards: 0 });
  const written = (app.createdBinary || []).find((file) => file.path === result.path);
  const entries = readStoredZip(written.buffer);
  assert.ok(!entries.has("cards/Cards/Bio/ATP.md"), "the card was not bundled");

  const empty = await start([]);
  const none = await empty.plugin.exportStudyBundle();
  assert.equal(none, null);
  assert.equal((empty.app.createdBinary || []).length, 0);
  assert.ok(T.studyBundle);
});

test("study bundle: the command is registered", async () => {
  const { plugin } = await start([]);
  assert.ok(plugin.commands.some((command) => command.id === "export-study-bundle"));
});
