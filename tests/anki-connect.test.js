"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const anki = T.ankiConnect;

test("AnkiConnect: defaults are off and malformed addresses fall back to loopback", () => {
  assert.equal(anki.DEFAULT_ANKI_CONNECT.enabled, false);
  assert.equal(anki.normalizeAnkiConnect({}).url, "http://127.0.0.1:8765");
  assert.equal(anki.normalizeAnkiConnect({ url: "http://localhost:8765/" }).url, "http://localhost:8765");
  assert.equal(anki.normalizeAnkiConnect({ url: "localhost:8765" }).url, "http://127.0.0.1:8765");
  assert.equal(anki.normalizeAnkiConnect({ enabled: true, deck: "  Spanish  " }).enabled, true);
  assert.equal(anki.normalizeAnkiConnect({ enabled: true, deck: "  Spanish  " }).deck, "Spanish");
});

test("AnkiConnect: builds Basic and Cloze notes with decks, tags and a media warning", () => {
  const cards = [
    {
      file: { path: "Cards/Biology/Q.md" },
      fm: { deck: "Biology", tags: ["exam prep"] },
      body: { front: "Which one?", back: "B" },
    },
    {
      file: { path: "Cards/Biology/C.md" },
      fm: { deck: "Biology", card_type: "cloze", tags: "bio" },
      body: { cardType: "cloze", front: "The capital is […].", back: "Paris" },
    },
    {
      file: { path: "Cards/Biology/Diagram.md" },
      fm: { deck: "Biology", image: "diagram.png" },
      body: { front: "What is hidden?", back: "Nucleus" },
    },
  ];
  const built = anki.buildAnkiNotes(cards, { deck: "Target", defaultDeck: "General" });
  assert.equal(built.notes.length, 3);
  assert.equal(built.notes[0].deckName, "Target");
  assert.equal(built.notes[0].modelName, "Basic");
  assert.deepEqual(built.notes[0].fields, { Front: "Which one?", Back: "B" });
  assert.deepEqual(built.notes[0].tags, ["exam_prep"]);
  assert.equal(built.notes[1].modelName, "Cloze");
  assert.equal(built.notes[1].fields.Text, "The capital is {{c1::Paris}}.");
  assert.equal(built.notes[1].fields["Back Extra"], "");
  assert.match(built.warnings.join(" "), /image stays in the vault/);
});

test("AnkiConnect: client creates decks, checks duplicates and reports failures", async () => {
  const calls = [];
  const request = async (req) => {
    const body = JSON.parse(req.body);
    calls.push(body);
    if (body.action === "createDeck") return { status: 200, json: { result: 1 } };
    if (body.action === "canAddNotes") return { status: 200, json: { result: [true, false, true] } };
    if (body.action === "addNotes") return { status: 200, json: { result: [123, null] } };
    return { status: 200, json: { result: 6 } };
  };
  const client = new anki.AnkiConnectClient({ url: "http://localhost:8765", request });
  const notes = [
    { deckName: "A", modelName: "Basic", fields: { Front: "a", Back: "b" } },
    { deckName: "A", modelName: "Basic", fields: { Front: "c", Back: "d" } },
    { deckName: "B", modelName: "Basic", fields: { Front: "e", Back: "f" } },
  ];
  const result = await client.push(notes);
  assert.deepEqual(calls.map((c) => c.action), ["createDeck", "createDeck", "canAddNotes", "addNotes"]);
  assert.equal(result.added, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.decks, ["A", "B"]);
});

test("AnkiConnect: an AnkiConnect error is surfaced without trying to add notes", async () => {
  const client = new anki.AnkiConnectClient({
    url: "http://localhost:8765",
    request: async () => ({ status: 200, json: { error: "collection is not available" } }),
  });
  await assert.rejects(() => client.version(), /AnkiConnect: collection is not available/);
});

test("AnkiConnect: an unreachable Anki gives a setup hint", async () => {
  const client = new anki.AnkiConnectClient({
    url: "http://localhost:8765",
    request: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  await assert.rejects(() => client.version(), /Open Anki with AnkiConnect installed/);
});

test("plugin: pushes the filtered cards to AnkiConnect and honours the opt-in", async () => {
  const notes = [
    {
      path: "Cards/Biology/Q.md",
      noFm: true,
      fm: { card_id: "q1", item_type: "card", deck: "Biology" },
      text: "## Front\nWhich one?\n\n## Back\nB",
    },
  ];
  const app = makeApp(notes);
  app.files[0].fm = { ...notes[0].fm };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: false, url: "http://127.0.0.1:8765", deck: "" };

  await assert.rejects(() => plugin.pushCardsToAnki({ deck: "Biology" }), /Turn on AnkiConnect push/);

  plugin.settings.cards.ankiConnect.enabled = true;
  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push(body.action);
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [123] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const result = await plugin.pushCardsToAnki({ deck: "Biology", targetDeck: "School::Biology" });
    assert.equal(result.added, 1);
    assert.equal(result.duplicates, 0);
    assert.equal(result.count, 1);
    assert.deepEqual(actions, ["createDeck", "canAddNotes", "addNotes"]);
  } finally {
    obsidian.requestImpl = previous;
  }
});
