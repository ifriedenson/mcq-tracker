"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const anki = T.ankiConnect;

function card(path, front, deck) {
  return {
    file: { path },
    fm: { card_id: path, item_type: "card", deck: deck || "Biology" },
    body: { front, back: `Answer for ${front}` },
  };
}

test("AnkiConnect: excluded folders skip exact folders and subfolders without prefix false positives", () => {
  assert.equal(anki.normalizeAnkiConnect({}).excludeFolders, "");
  assert.equal(anki.normalizeAnkiConnect({ excludeFolders: " Cards/Archive/ " }).excludeFolders, "Cards/Archive/");

  const cards = [
    card("Cards/Biology/Q.md", "Biology question"),
    card("Cards/Archive/Q.md", "Archived question"),
    card("Cards/Archive/Old/Q.md", "Nested archived question"),
    card("Cards/Archived/Q.md", "Similar-prefix question"),
  ];
  const built = anki.buildAnkiNotes(cards, {
    defaultDeck: "General",
    excludeFolders: " cards/archive/ ",
  });
  assert.deepEqual(
    built.notes.map((note) => note.fields.Front),
    ["Biology question", "Similar-prefix question"]
  );
  assert.equal(built.warnings.length, 2);
  assert.ok(built.warnings.every((warning) => /folder cards\/archive\/ is excluded/i.test(warning)), built.warnings.join(" | "));

  const none = anki.buildAnkiNotes(cards, { defaultDeck: "General", excludeFolders: "" });
  assert.equal(none.notes.length, 4);

  const boundary = anki.buildAnkiNotes(cards, { defaultDeck: "General", excludeFolders: "Cards/Arch" });
  assert.equal(boundary.notes.length, 4, "a partial folder name must not exclude siblings");
});

test("plugin: Anki preview and push omit cards in an excluded vault folder", async () => {
  const notes = [
    { path: "Cards/Biology/Send.md", noFm: true, fm: { card_id: "send", item_type: "card", deck: "Biology" }, text: "## Front\nSend?\n\n## Back\nYes\n" },
    { path: "Cards/Archive/Hold.md", noFm: true, fm: { card_id: "hold", item_type: "card", deck: "Biology" }, text: "## Front\nHold?\n\n## Back\nNo\n" },
    { path: "Cards/Archive/Old/Hold2.md", noFm: true, fm: { card_id: "hold2", item_type: "card", deck: "Biology" }, text: "## Front\nHold nested?\n\n## Back\nNo\n" },
  ];
  const app = makeApp(notes);
  notes.forEach((note, index) => (app.files[index].fm = { ...note.fm }));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = {
    enabled: true,
    url: "http://127.0.0.1:8765",
    deck: "",
    excludeFolders: "Cards/Archive",
  };
  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push(body);
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [101] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const plan = await plugin.previewAnkiSync({ pushOnly: true, vaultWide: true });
    assert.equal(plan.counts.create, 1);
    assert.match(plan.warnings.join(" "), /Cards\/Archive\/Hold\.md: skipped because folder Cards\/Archive is excluded/);
    const result = await plugin.pushCardsToAnki({ vaultWide: true });
    assert.equal(result.added, 1);
    assert.equal(result.count, 1);
    const canAdd = actions.find((body) => body.action === "canAddNotes");
    assert.equal(canAdd.params.notes.length, 1);
    assert.match(canAdd.params.notes[0].fields.Front, /Send\?/);
    assert.doesNotMatch(JSON.stringify(actions), /Hold\?/);
  } finally {
    obsidian.requestImpl = previous;
  }
});
