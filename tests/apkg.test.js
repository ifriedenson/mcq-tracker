"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const apkg = T.apkg;
const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "anki-basic.apkg"));

test("apkg: reads basic, cloze and reversed notes with decks, tags and scheduling metadata", () => {
  const parsed = apkg.parseApkg(fixture, { sourcePath: "deck.apkg" });
  assert.equal(parsed.cards.length, 3);
  assert.equal(parsed.skipped, 0);
  assert.equal(parsed.cards[0].front, "hola");
  assert.equal(parsed.cards[0].back, "hello");
  assert.equal(parsed.cards[0].deck, "Spanish::Verbs");
  assert.deepEqual(parsed.cards[0].tags, ["greeting", "spanish"]);
  assert.equal(parsed.cards[0].importKey, "apkg:guid-basic");
  assert.equal(parsed.cards[0].ankiNoteId, "1001");
  assert.equal(parsed.cards[0].ankiCardId, "2001");
  assert.equal(parsed.cards[0].attempts, 4);
  assert.equal(parsed.cards[0].nextReview, "2024-02-22");
  assert.equal(parsed.cards[1].cardType, "cloze");
  assert.equal(parsed.cards[1].front, "The capital of France is {{c1::Paris}}.");
  assert.equal(parsed.cards[1].back, "Paris");
  assert.equal(parsed.cards[2].cardType, "reversed");
  assert.equal(parsed.cards[2].deck, "Default");
  assert.equal(parsed.cards[2].nextReview, "2024-06-01");
});

test("apkg: rejects files that are not an Anki package", () => {
  assert.throws(() => apkg.parseApkg(Buffer.from("not a zip")), /valid \.apkg archive/);
});

test("plugin: imports an .apkg through the normal card writer and preserves Anki keys", async () => {
  const app = makeApp([{ path: "deck.apkg", text: "binary fixture" }]);
  app.vault.readBinary = async () => fixture;
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;

  const result = await plugin.importCardsFromApkg("deck.apkg", { course: "SPAN 101" });
  assert.equal(result.created, 3);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.errors, []);
  assert.equal(app.created.length, 3);
  assert.match(app.created[0].text, /anki_note_id: "1001"/);
  assert.match(app.created[0].text, /anki_card_id: "2001"/);
  assert.match(app.created[0].text, /anki_deck: "Spanish::Verbs"/);
  assert.match(app.created[0].text, /attempts: 4/);
  assert.match(app.created[0].text, /next_review: "2024-02-22"/);
  assert.match(app.created[0].text, /course: "SPAN 101"/);
  assert.match(app.created[1].text, /card_type: cloze/);
  assert.match(app.created[2].text, /card_type: reversed/);
  assert.ok(app.created.every((file) => /import_key: "apkg:guid-/.test(file.text)));
});

test("plugin: previews an .apkg and recognises existing import keys", async () => {
  const app = makeApp([{ path: "deck.apkg", text: "binary fixture" }]);
  app.vault.readBinary = async () => fixture;
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;

  const preview = await plugin.previewCardsImport("apkg", "deck.apkg", {});
  assert.equal(preview.total, 3);
  assert.equal(preview.duplicates, 0);
  assert.equal(preview.errors.length, 0);

  await plugin.importCardsFromApkg("deck.apkg", {});
  for (const created of app.created) {
    const file = app.files.find((candidate) => candidate.path === created.path);
    const key = /import_key: "([^"]+)"/.exec(created.text)[1];
    file.fm.import_key = key;
    file.fm.item_type = "card";
    file.fm.card_id = key;
  }
  const again = await plugin.previewCardsImport("apkg", "deck.apkg", {});
  assert.equal(again.total, 3);
  assert.equal(again.duplicates, 3);
});
