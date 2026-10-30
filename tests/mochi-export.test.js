"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const M = T.mochiExport;

const records = [
  {
    file: { path: "Cards/Biology/ATP.md", basename: "ATP" },
    fm: { card_id: "a", item_type: "card", deck: "Biology", card_title: "ATP" },
    body: { front: "What is ATP?", back: "The cell's energy currency" },
  },
  {
    file: { path: "Cards/Biology/Mitosis.md", basename: "Mitosis" },
    fm: { card_id: "b", item_type: "card", deck: "Biology" },
    body: { front: "What does mitosis produce?", back: "Two identical cells" },
  },
  {
    file: { path: "Cards/Chemistry/Gold.md", basename: "Gold" },
    fm: { card_id: "c", item_type: "card", deck: "Chemistry" },
    body: { front: "Symbol for gold?", back: "Au" },
  },
];

/** Reads the stored entries of the ZIP this plugin writes, without a ZIP dependency. */
function readStoredZip(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  assert.ok(eocd >= 0, "EOCD record");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(p, true), 0x02014b50);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(u8.subarray(p + 46, p + 46 + nameLen));
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localName + localExtra;
    out.set(name, decoder.decode(u8.subarray(start, start + size)));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

test("Mochi EDN groups cards by deck and keeps both sides", () => {
  const edn = M.cardsToMochiEdn(records);
  assert.match(edn, /^\{:version 2, :decks \[/);
  assert.match(edn, /:name "Biology"/);
  assert.match(edn, /:name "Chemistry"/);
  assert.match(edn, /"What is ATP\?\\n---\\nThe cell's energy currency"/);
  const decks = M.cardsToMochiDecks(records);
  assert.equal(decks.length, 2);
  assert.equal(decks[0].cards.length, 2);
  assert.equal(decks[1].cards.length, 1);
  assert.equal(decks[0].cards[0].name, "ATP");
});

test("a .mochi archive is a stored ZIP holding data.edn", () => {
  const archive = M.buildMochiArchive(records);
  assert.ok(archive instanceof Uint8Array);
  assert.equal(String.fromCharCode(...archive.subarray(0, 4)), "PK\u0003\u0004");
  const entries = readStoredZip(archive);
  assert.deepEqual([...entries.keys()], ["data.edn"]);
  assert.match(entries.get("data.edn"), /:decks \[/);
});

test("the plugin writes a .mochi file and reports its cards", async () => {
  const app = makeApp(
    records.map((record) => ({
      path: record.file.path,
      fm: record.fm,
      text: `## Front\n${record.body.front}\n\n## Back\n${record.body.back}`,
    }))
  );
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const result = await plugin.exportCards("mochi", { deck: "Biology" });
  assert.equal(result.format, "mochi");
  assert.equal(result.count, 2);
  assert.match(result.path, /^Cards\/exports\/Biology mochi .*\.mochi$/);
  const written = (app.createdBinary || []).find((file) => file.path === result.path);
  assert.ok(written, "binary file was written");
  const entries = readStoredZip(written.buffer);
  const edn = entries.get("data.edn");
  assert.match(edn, /What is ATP\?/);
  assert.doesNotMatch(edn, /Symbol for gold/, "the deck filter excluded Chemistry");
});

test("media that the archive cannot carry produces one warning", () => {
  assert.equal(M.mochiMediaWarning(records), "");
  const warning = M.mochiMediaWarning([
    { body: { front: "![[diagram.png]] Label this", back: "Nucleus" } },
    { body: { front: "Plain", back: "Text" } },
  ]);
  assert.match(warning, /1 card/);
  assert.match(warning, /text only/);
});

test("cards without front text are skipped, not counted as exported", async () => {
  const app = makeApp([
    {
      path: "Cards/Biology/ATP.md",
      fm: { card_id: "a", item_type: "card", deck: "Biology" },
      text: "## Front\nWhat is ATP?\n\n## Back\nEnergy",
    },
    {
      path: "Cards/Biology/Blank.md",
      fm: { card_id: "b", item_type: "card", deck: "Biology" },
      text: "## Front\n\n## Back\nNo prompt",
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const result = await plugin.exportCards("mochi", { deck: "Biology" });
  assert.equal(result.count, 1);
  assert.match(result.warnings.join(" "), /1 card had no front text/);
  const written = (app.createdBinary || []).find((file) => file.path === result.path);
  const edn = readStoredZip(written.buffer).get("data.edn");
  assert.match(edn, /What is ATP\?/);
  assert.doesNotMatch(edn, /No prompt/);
});

test("an all-empty Mochi export fails instead of writing an empty archive", async () => {
  const app = makeApp([
    {
      path: "Cards/Biology/Blank.md",
      fm: { card_id: "b", item_type: "card", deck: "Biology" },
      text: "## Front\n\n## Back\nNo prompt",
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  await assert.rejects(() => plugin.exportCards("mochi", { deck: "Biology" }), /front text/);
  assert.equal((app.createdBinary || []).length, 0);
});
