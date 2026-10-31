"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const C = T.cardArchive;

const CARD_TEXT = (id) => `---
card_id: ${id}
deck: Biology
attempts: 2
correct_count: 1
next_review: 2026-11-02
---

## Front

What is osmosis?

## Back

Water moving across a membrane.
`;

test("card archive: settings clamp the folder and path safety rejects escapes", () => {
  assert.deepEqual(C.normalizeCardArchiveSettings(undefined), { enabled: true, folder: "Archive" });
  assert.equal(C.normalizeCardArchiveSettings({ folder: "Backups/Cards" }).folder, "Backups/Cards");
  assert.equal(C.normalizeCardArchiveSettings({ enabled: false }).enabled, false);
  assert.equal(C.safeCardPath("Cards/a.md"), "Cards/a.md");
  assert.equal(C.safeCardPath("../escape.md"), "");
  assert.equal(C.safeCardPath("/absolute.md"), "absolute.md");
  assert.equal(C.safeCardPath("Cards/a.txt"), "");
  assert.equal(C.archiveFileName("2026-10-31"), "mcq-cards-2026-10-31.json");
});

test("card archive: export keeps note text, deck and course and is versioned", () => {
  const archive = C.buildCardArchive([
    { path: "Cards/b.md", text: CARD_TEXT("b"), deck: "Biology", course: "Bio 101" },
    { path: "../bad.md", text: "x" },
  ], { exportedAt: "2026-10-31T00:00:00.000Z" });
  assert.equal(archive.schema, 1);
  assert.equal(archive.count, 1);
  assert.equal(archive.exportedAt, "2026-10-31T00:00:00.000Z");
  assert.equal(archive.cards[0].deck, "Biology");
  assert.match(archive.cards[0].text, /next_review: 2026-11-02/);
  assert.match(archive.issues.join(" "), /safe \.md path/);
});

test("card archive: parsing rejects bad input and merge modes are explicit", () => {
  assert.equal(C.parseCardArchive("{not json").ok, false);
  assert.match(C.parseCardArchive("{not json").error, /not JSON/);
  assert.equal(C.parseCardArchive(JSON.stringify({ cards: [] })).ok, false, "schema is required");

  const archive = C.buildCardArchive([
    { path: "Cards/a.md", text: CARD_TEXT("a") },
    { path: "Cards/b.md", text: CARD_TEXT("b") },
  ]);
  const json = JSON.stringify(archive);
  const parsed = C.parseCardArchive(json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.archive.count, 2);

  const skip = C.mergeCardArchive(["cards/a.md"], parsed.archive, "skip");
  assert.deepEqual(skip.create, ["Cards/b.md"]);
  assert.deepEqual(skip.skip, ["Cards/a.md"]);
  const overwrite = C.mergeCardArchive(["Cards/a.md"], parsed.archive, "overwrite");
  assert.deepEqual(overwrite.update, ["Cards/a.md"]);
  assert.deepEqual(overwrite.skip, []);
});

test("card archive: malformed entries are skipped with a reason", () => {
  const parsed = C.parseCardArchive(JSON.stringify({
    schema: 1,
    cards: [
      { path: "../nope.md", text: "x" },
      { path: "Cards/empty.md", text: "   " },
      { path: "Cards/ok.md", text: CARD_TEXT("ok") },
    ],
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.archive.count, 1);
  assert.equal(parsed.issues.length, 2);
  assert.match(parsed.issues.join(" "), /no note text/);
});

test("card archive: the plugin exports and restores notes without touching other files", async () => {
  const app = makeApp([
    { path: "Cards/osmosis.md", fm: { card_id: "c1", deck: "Biology" }, text: CARD_TEXT("c1") },
    { path: "Notes/Q1.md", fm: { answer: "B" } },
  ]);
  // the fake vault adds question_id to every note; a card note must not have one
  delete app.files.find((file) => file.path === "Cards/osmosis.md").fm.question_id;
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;

  const exported = await plugin.exportCardArchive();
  assert.equal(exported.count, 1);
  assert.match(exported.path, /^Archive\/mcq-cards-\d{4}-\d{2}-\d{2}\.json$/);
  const archiveText = app.created.find((entry) => entry.path === exported.path).text;
  const parsed = C.parseCardArchive(archiveText);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.archive.cards[0].path, "Cards/osmosis.md");

  app.created.length = 0;
  const skipped = await plugin.importCardArchiveText(archiveText, "skip");
  assert.deepEqual(skipped.skip, ["Cards/osmosis.md"]);
  assert.equal(app.created.length, 0, "skip writes nothing");

  const overwritten = await plugin.importCardArchiveText(archiveText, "overwrite");
  assert.deepEqual(overwritten.update, ["Cards/osmosis.md"]);
  assert.equal(app.modified.at(-1).path, "Cards/osmosis.md");

  plugin.settings.cardArchive.enabled = false;
  await assert.rejects(() => plugin.importCardArchiveText(archiveText, "skip"), /off/);
});
