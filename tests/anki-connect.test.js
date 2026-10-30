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
  assert.equal(anki.normalizeAnkiConnect({}).conflict, "report");
  assert.equal(anki.normalizeAnkiConnect({ conflict: "anki" }).conflict, "anki");
  assert.equal(anki.normalizeAnkiConnect({ conflict: "wizard" }).conflict, "report");
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

  await assert.rejects(() => plugin.pushCardsToAnki({ deck: "Biology" }), /Turn on AnkiConnect sync/);

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
    assert.equal(app.files[0].fm.anki_note_id, "123");
    assert.ok(app.files[0].fm.anki_synced_hash);
    assert.deepEqual(actions, ["createDeck", "canAddNotes", "addNotes"]);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("AnkiConnect: sync records normalize tags and choose push, pull or conflict", () => {
  const local = anki.syncRecord({ front: "Q", back: "A", deck: "D", tags: ["b", "a"], type: "Basic" });
  assert.deepEqual(local.tags, ["a", "b"]);
  const hash = anki.syncHash(local);
  assert.equal(anki.syncDecision(local, local, { local: hash, remote: hash }).action, "none");

  const remote = anki.remoteSyncRecord(
    {
      noteId: 1,
      cards: [2],
      modelName: "Basic",
      fields: { Front: { value: "Q", order: 0 }, Back: { value: "A", order: 1 } },
      tags: ["a", "b"],
    },
    { cardId: 2, deckName: "D", modelName: "Basic", ord: 0, due: 3, interval: 4, reps: 5, lapses: 6 }
  );
  assert.equal(remote.front, "Q");
  assert.equal(remote.back, "A");
  assert.equal(remote.deck, "D");
  assert.equal(remote.cardId, "2");
  assert.equal(remote.interval, 4);

  const baseline = { local: hash, remote: hash };
  const localChanged = anki.syncRecord({ ...local, back: "B" });
  const remoteChanged = anki.syncRecord({ ...local, back: "C" });
  assert.equal(anki.syncDecision(localChanged, local, baseline).action, "push");
  assert.equal(anki.syncDecision(local, remoteChanged, baseline).action, "pull");
  assert.equal(anki.syncDecision(localChanged, remoteChanged, baseline).action, "conflict");
});

test("plugin: sync pushes a new card, then pulls a linked Anki edit without losing history", async () => {
  const notes = [
    {
      path: "Cards/Biology/Q.md",
      noFm: true,
      fm: {
        card_id: "q1",
        item_type: "card",
        deck: "Biology",
        attempts: 3,
        history: ["2026-10-01 10:00 | correct | 20 | B | 2 | "],
      },
      text: "---\ncard_id: q1\nitem_type: card\ndeck: Biology\n---\n\n## Front\nWhich one?\n\n## Back\nB\n\n## Notes\nKeep this note\n",
    },
  ];
  const app = makeApp(notes);
  app.files[0].fm = { ...notes[0].fm };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "", conflict: "report" };

  let remoteBack = "B";
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    if (body.action === "canAddNotes") return { status: 200, json: { result: [true] } };
    if (body.action === "addNotes") return { status: 200, json: { result: [123] } };
    if (body.action === "notesInfo") {
      return {
        status: 200,
        json: {
          result: [
            {
              noteId: 123,
              cards: [456],
              modelName: "Basic",
              tags: ["bio"],
              fields: { Front: { value: "Which one?", order: 0 }, Back: { value: remoteBack, order: 1 } },
            },
          ],
        },
      };
    }
    if (body.action === "cardsInfo") {
      return {
        status: 200,
        json: {
          result: [
            { cardId: 456, deckName: "Biology", modelName: "Basic", ord: 0, due: 5, interval: 7, reps: 8, lapses: 1 },
          ],
        },
      };
    }
    return { status: 200, json: { result: 1 } };
  };
  try {
    const pushed = await plugin.syncCardsWithAnki({});
    assert.equal(pushed.pushed, 1);
    assert.equal(app.files[0].fm.anki_note_id, "123");
    assert.ok(app.files[0].fm.anki_synced_hash);
    assert.ok(app.files[0].fm.anki_remote_hash);

    remoteBack = "C";
    const pulled = await plugin.syncCardsWithAnki({});
    assert.equal(pulled.pulled, 1, JSON.stringify(pulled));
    assert.match(app.files[0].text, /## Back\n\nC/);
    assert.match(app.files[0].text, /Keep this note/);
    assert.equal(app.files[0].fm.attempts, 3);
    assert.equal(app.files[0].fm.history.length, 1);
    assert.equal(app.files[0].fm.anki_reps, 8);
    assert.equal(app.files[0].fm.anki_interval, 7);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("plugin: a target deck does not make linked cards conflict on the next sync", async () => {
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
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "School::Biology", conflict: "report" };

  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [123] } };
    if (body.action === "notesInfo") {
      return {
        status: 200,
        json: {
          result: [
            {
              noteId: 123,
              cards: [456],
              modelName: "Basic",
              tags: [],
              fields: { Front: { value: "Which one?", order: 0 }, Back: { value: "B", order: 1 } },
            },
          ],
        },
      };
    }
    if (body.action === "cardsInfo") {
      return {
        status: 200,
        json: {
          result: [
            { cardId: 456, deckName: "School::Biology", modelName: "Basic", ord: 0, due: 1, interval: 2, reps: 3, lapses: 0 },
          ],
        },
      };
    }
    return { status: 200, json: { result: 1 } };
  };
  try {
    const first = await plugin.syncCardsWithAnki({});
    assert.equal(first.pushed, 1);
    assert.equal(first.conflicts, 0, JSON.stringify(first));
    const second = await plugin.syncCardsWithAnki({});
    assert.equal(second.pushed, 0);
    assert.equal(second.pulled, 0);
    assert.equal(second.updated, 0);
    assert.equal(second.conflicts, 0, JSON.stringify(second));
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("plugin: a card changed on both sides is reported, then an Anki policy can replace it", async () => {
  const base = anki.syncHash(anki.syncRecord({ front: "Which one?", back: "B", deck: "Biology", tags: [], type: "Basic" }));
  const notes = [
    {
      path: "Cards/Biology/Q.md",
      noFm: true,
      fm: {
        card_id: "q1",
        item_type: "card",
        deck: "Biology",
        attempts: 2,
        anki_note_id: "123",
        anki_card_id: "456",
        anki_synced_hash: base,
        anki_remote_hash: base,
      },
      text: "---\ncard_id: q1\nitem_type: card\ndeck: Biology\nattempts: 2\nanki_note_id: \"123\"\nanki_card_id: \"456\"\n---\n\n## Front\nWhich one?\n\n## Back\nLocal edit\n\n## Notes\nKeep this\n",
    },
  ];
  const app = makeApp(notes);
  app.files[0].fm = { ...notes[0].fm };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "", conflict: "report" };

  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    if (body.action === "notesInfo") {
      return {
        status: 200,
        json: {
          result: [
            {
              noteId: 123,
              cards: [456],
              modelName: "Basic",
              tags: [],
              fields: { Front: { value: "Which one?", order: 0 }, Back: { value: "Anki edit", order: 1 } },
            },
          ],
        },
      };
    }
    if (body.action === "cardsInfo") {
      return {
        status: 200,
        json: {
          result: [
            { cardId: 456, deckName: "Biology", modelName: "Basic", ord: 0, due: 1, interval: 2, reps: 3, lapses: 0 },
          ],
        },
      };
    }
    return { status: 200, json: { result: 1 } };
  };
  try {
    const reported = await plugin.syncCardsWithAnki({});
    assert.equal(reported.conflicts, 1, JSON.stringify(reported));
    assert.match(reported.warnings.join(" "), /changed in both/);
    assert.match(app.files[0].text, /## Back\nLocal edit/);
    assert.equal(app.files[0].fm.attempts, 2);

    plugin.settings.cards.ankiConnect.conflict = "anki";
    const resolved = await plugin.syncCardsWithAnki({});
    assert.equal(resolved.conflicts, 0);
    assert.equal(resolved.pulled, 1);
    assert.match(app.files[0].text, /## Back\n\nAnki edit/);
    assert.match(app.files[0].text, /Keep this/);
    assert.equal(app.files[0].fm.attempts, 2);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("AnkiConnect: Markdown, math, code and media become Anki-ready fields", () => {
  assert.match(anki.markdownToAnkiHtml("**Bold** and `code` and $x^2$"), /<strong>Bold<\/strong>/);
  assert.match(anki.markdownToAnkiHtml("**Bold** and `code` and $x^2$"), /<code>code<\/code>/);
  assert.match(anki.markdownToAnkiHtml("**Bold** and `code` and $x^2$"), /\\\(x\^2\\\)/);
  assert.match(anki.markdownToAnkiHtml("```js\nconst x = 1;\n```"), /<pre><code>const x = 1;<\/code><\/pre>/);
  const refs = anki.mediaRefs("![[diagram.png]] ![](audio.mp3) ![alt](https://example.com/x.png)");
  assert.deepEqual(refs.map((ref) => ref.name), ["diagram.png", "audio.mp3"]);
  assert.equal(refs[1].kind, "audio");
  assert.match(anki.markdownToAnkiHtml("![[diagram.png]]"), /<img src="diagram.png">/);
  assert.match(anki.markdownToAnkiHtml("![[lecture.mp3]]"), /\[sound:lecture\.mp3\]/);
});

test("AnkiConnect: folder decks and frontmatter precedence are opt-in", () => {
  assert.equal(anki.normalizeAnkiConnect({}).folderDecks, false);
  assert.equal(anki.normalizeAnkiConnect({ folderDecks: true }).folderDecks, true);
  assert.equal(anki.folderDeckName("Cards/Biology/Q.md", "Cards"), "Biology");
  assert.equal(anki.folderDeckName("Other/Biology/Q.md", "Cards"), "Other");
  const cards = [{ file: { path: "Cards/Biology/Q.md" }, fm: {}, body: { front: "Q", back: "A" } }];
  assert.equal(anki.buildAnkiNotes(cards, { defaultDeck: "General" }).notes[0].deckName, "General");
  const built = anki.buildAnkiNotes(cards, { defaultDeck: "General", folderDecks: true, cardRoot: "Cards" });
  assert.equal(built.notes[0].deckName, "Biology");
  const explicit = anki.buildAnkiNotes([{ ...cards[0], fm: { deck: "Frontmatter" } }], { defaultDeck: "General", folderDecks: true, cardRoot: "Cards" });
  assert.equal(explicit.notes[0].deckName, "Frontmatter");
});

test("plugin: preview lists creates, pulls and Anki deletions without writing", async () => {
  const base = anki.syncHash(anki.syncRecord({ front: "Linked?", back: "Old", deck: "Biology", tags: [], type: "Basic" }));
  const notes = [
    { path: "Cards/Bio/New.md", noFm: true, fm: { card_id: "new", item_type: "card", deck: "Biology" }, text: "## Front\nNew?\n\n## Back\nYes" },
    { path: "Cards/Bio/Linked.md", noFm: true, fm: { card_id: "linked", item_type: "card", deck: "Biology", anki_note_id: "9", anki_card_id: "90", anki_synced_hash: base, anki_remote_hash: base }, text: "## Front\nLinked?\n\n## Back\nOld" },
    { path: "Cards/Bio/Gone.md", noFm: true, fm: { card_id: "gone", item_type: "card", deck: "Biology", anki_note_id: "8" }, text: "## Front\nGone?\n\n## Back\nAway" },
  ];
  const app = makeApp(notes);
  notes.forEach((n, i) => (app.files[i].fm = { ...n.fm }));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "", conflict: "report", deleteMissing: true, index: { "Cards/Bio/Deleted.md": { noteId: "7", cardId: "70" } } };
  const before = app.files.map((f) => f.text);
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    if (body.action === "notesInfo") return { status: 200, json: { result: [{ noteId: 9, cards: [90], modelName: "Basic", tags: [], fields: { Front: { value: "Linked?", order: 0 }, Back: { value: "New", order: 1 } } }] } };
    if (body.action === "cardsInfo") return { status: 200, json: { result: [{ cardId: 90, deckName: "Biology", modelName: "Basic", due: 1, interval: 2, reps: 3, lapses: 0 }] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const plan = await plugin.previewAnkiSync({});
    assert.equal(plan.counts.create, 1);
    assert.equal(plan.counts.pull, 1);
    assert.equal(plan.counts.missing, 1);
    assert.equal(plan.counts.delete, 1);
    assert.deepEqual(plan.entries.map((entry) => entry.action).sort(), ["create", "delete", "missing", "pull"]);
    assert.deepEqual(app.files.map((f) => f.text), before, "preview never writes");
    assert.equal(app.created, undefined);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("plugin: push uploads images and audio and sends Markdown, math and code as HTML", async () => {
  const notes = [
    { path: "Cards/Bio/Media.md", noFm: true, fm: { card_id: "media", item_type: "card", deck: "Biology" }, text: "## Front\n![[diagram.png]]\n\n## Back\n**A** and `code` and $x^2$\n" },
  ];
  const app = makeApp(notes);
  app.files[0].fm = { ...notes[0].fm };
  const binary = { path: "Cards/Bio/diagram.png", name: "diagram.png", basename: "diagram", extension: "png" };
  app.files.push(binary);
  app.vault.readBinary = async () => Buffer.from([1, 2, 3]);
  app.metadataCache.getFirstLinkpathDest = (name) => (name === "diagram.png" ? binary : null);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "" };
  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push({ action: body.action, params: body.params });
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [123] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const result = await plugin.pushCardsToAnki({ deck: "Biology" });
    assert.equal(result.added, 1);
    const media = actions.find((entry) => entry.action === "storeMediaFile");
    assert.ok(media, JSON.stringify(actions.map((entry) => entry.action)));
    assert.equal(media.params.filename, "diagram.png");
    assert.equal(media.params.data, "AQID");
    const note = actions.find((entry) => entry.action === "canAddNotes").params.notes[0];
    assert.match(note.fields.Front, /<img src="diagram.png">/);
    assert.match(note.fields.Back, /<strong>A<\/strong>/);
    assert.match(note.fields.Back, /<code>code<\/code>/);
    assert.match(note.fields.Back, /\\\(x\^2\\\)/);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("AnkiConnect: Markdown and the HTML Anki returns compare as the same content", () => {
  const markdown = anki.syncRecord({ front: "**Bold** ![[diagram.png]]", back: "`code` $x^2$", deck: "D", tags: [], type: "Basic" });
  const html = anki.syncRecord({ front: "<strong>Bold</strong> <img src=\"diagram.png\">", back: "<code>code</code> \\(x^2\\)", deck: "D", tags: [], type: "Basic" });
  assert.equal(anki.syncHash(markdown), anki.syncHash(html));
  assert.match(anki.markdownToAnkiHtml("<strong>Already HTML</strong>"), /^<strong>Already HTML<\/strong>$/);
});

test("AnkiConnect: video, tables, vault tags and source backlinks are opt-in", () => {
  const video = anki.mediaRefs("![[clip.mp4]]");
  assert.equal(video.length, 1);
  assert.equal(video[0].kind, "video");
  assert.match(anki.markdownToAnkiHtml("![[clip.mp4]]"), /<video controls src="clip\.mp4"><\/video>/);
  const table = anki.markdownToAnkiHtml("| Term | Meaning |\n| --- | --- |\n| ATP | Energy |");
  assert.equal(
    table,
    "<table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody><tr><td>ATP</td><td>Energy</td></tr></tbody></table>"
  );
  assert.equal(anki.markdownToAnkiHtml("Term | Meaning\n--- | ---\nATP | Energy"), table);
  const card = {
    file: { path: "Cards/Bio/Q.md" },
    fm: { deck: "Biology", tags: ["exam"], source_note: "Notes/Bio Lecture.md" },
    body: { front: "Q", back: "A" },
  };
  assert.equal(anki.buildAnkiNotes([card], { defaultDeck: "General" }).notes[0].fields.Back, "A");
  const built = anki.buildAnkiNotes([card], {
    defaultDeck: "General",
    vaultTags: "vault, extra",
    backlinks: true,
    vaultName: "Study Vault",
  });
  assert.deepEqual(built.notes[0].tags, ["exam", "vault", "extra"]);
  assert.match(built.notes[0].fields.Back, /obsidian:\/\/open\?vault=Study%20Vault&amp;file=Notes%2FBio%20Lecture\.md/);
  assert.match(built.notes[0].fields.Back, />Source note<\/a>$/);
  const local = anki.syncRecord({ front: "| Term | Meaning |\n| --- | --- |\n| ATP | Energy |", back: "A", deck: "D", tags: [], type: "Basic" });
  const remote = anki.syncRecord({
    front: "<table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody><tr><td>ATP</td><td>Energy</td></tr></tbody></table>",
    back: 'A<br><br><a href="obsidian://open?vault=Study%20Vault&amp;file=Notes%2FBio.md">Source note</a>',
    deck: "D",
    tags: [],
    type: "Basic",
  });
  assert.equal(anki.syncHash(local), anki.syncHash(remote));
});

test("plugin: vault-wide push includes every card and applies vault tags and backlinks", async () => {
  const notes = [
    { path: "Cards/Bio/Q.md", noFm: true, fm: { card_id: "q1", item_type: "card", deck: "Biology", source_note: "Notes/Bio.md" }, text: "## Front\nQ1\n\n## Back\nA1" },
    { path: "Cards/Chem/Q.md", noFm: true, fm: { card_id: "q2", item_type: "card", deck: "Chemistry" }, text: "## Front\nQ2\n\n## Back\nA2" },
  ];
  const app = makeApp(notes);
  notes.forEach((n, i) => (app.files[i].fm = { ...n.fm }));
  app.vault.getName = () => "Study Vault";
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "", vaultTags: "vault, extra", backlinks: true };
  assert.ok(plugin.commands.some((command) => command.id === "push-vault-anki"));
  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push(body);
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [123, 456] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const result = await plugin.pushCardsToAnki({ deck: "Biology", vaultWide: true });
    assert.equal(result.count, 2);
    const add = actions.find((body) => body.action === "canAddNotes");
    assert.equal(add.params.notes.length, 2);
    assert.deepEqual(add.params.notes[0].tags, ["vault", "extra"]);
    assert.match(add.params.notes[0].fields.Back, /obsidian:\/\/open\?vault=Study%20Vault&amp;file=Notes%2FBio\.md/);
    assert.match(add.params.notes[1].fields.Back, /obsidian:\/\/open\?vault=Study%20Vault&amp;file=Cards%2FChem%2FQ\.md/);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("AnkiConnect: regex omission, Excalidraw rewrites and exclusion filters are opt-in", () => {
  const plain = anki.normalizeAnkiConnect({});
  assert.equal(plain.omitRegex, "");
  assert.equal(plain.excludeTags, "");
  assert.equal(plain.excludeDecks, "");
  assert.equal(plain.clearMissing, false);
  assert.equal(plain.excalidraw.enabled, false);
  assert.equal(plain.excalidraw.folder, "");

  const card = {
    file: { path: "Cards/Bio/Q.md" },
    fm: { deck: "Biology", tags: ["exam"] },
    body: { front: "Question? %%hidden%% ![[Drawing.excalidraw|300]]", back: "Answer %%note%%" },
  };
  const options = { defaultDeck: "General", omitRegex: "%%[^%]*%%", excalidraw: { enabled: true, folder: "Drawings" } };
  const built = anki.buildAnkiNotes([card], options);
  assert.equal(built.notes.length, 1);
  assert.doesNotMatch(built.notes[0].fields.Front, /hidden/);
  assert.match(built.notes[0].fields.Front, /Question\?/);
  assert.match(built.notes[0].fields.Front, /<img src="Drawing\.excalidraw\.svg">/);
  assert.doesNotMatch(built.notes[0].fields.Back, /%%note%%/);
  assert.equal(built.notes[0].fields.Back, "Answer ");
  const drawing = built.media.find((item) => item.name === "Drawing.excalidraw.svg");
  assert.ok(drawing, JSON.stringify(built.media));
  assert.equal(drawing.target, "Drawings/Drawing.excalidraw.svg");

  const local = anki.localSyncRecord(card, options);
  const remote = anki.syncRecord({
    front: 'Question? <img src="Drawing.excalidraw.svg">',
    back: "Answer",
    deck: "Biology",
    tags: ["exam"],
    type: "Basic",
  });
  assert.equal(anki.syncHash(local), anki.syncHash(remote), "omitted and exported text must compare cleanly");

  const tagged = { ...card, fm: { deck: "Biology", tags: ["hold"] }, body: { front: "Q", back: "A" } };
  const byTag = anki.buildAnkiNotes([tagged], { defaultDeck: "General", excludeTags: "#hold" });
  assert.equal(byTag.notes.length, 0);
  assert.match(byTag.warnings.join(" "), /tag #hold is excluded/);

  const decked = { ...card, fm: { deck: "Biology::Draft", tags: [] }, body: { front: "Q", back: "A" } };
  const byDeck = anki.buildAnkiNotes([decked], { defaultDeck: "General", excludeDecks: "Biology" });
  assert.equal(byDeck.notes.length, 0);
  assert.match(byDeck.warnings.join(" "), /deck Biology::Draft is excluded/);

  const invalid = anki.buildAnkiNotes([{ ...card, body: { front: "Q", back: "A" } }], { defaultDeck: "General", omitRegex: "[" });
  assert.equal(invalid.notes[0].fields.Front, "Q");
  assert.match(invalid.warnings.join(" "), /Omission regex is invalid/);
});

test("plugin: push omits regex text, uploads an Excalidraw SVG and skips excluded cards", async () => {
  const notes = [
    {
      path: "Cards/Bio/Send.md",
      noFm: true,
      fm: { card_id: "send", item_type: "card", deck: "Biology", tags: ["exam"] },
      text: "## Front\nQuestion? %%secret%% ![[Drawing.excalidraw|300]]\n\n## Back\nAnswer %%note%%\n",
    },
    {
      path: "Cards/Bio/Hold.md",
      noFm: true,
      fm: { card_id: "hold", item_type: "card", deck: "Biology", tags: ["hold"] },
      text: "## Front\nHold?\n\n## Back\nNo\n",
    },
  ];
  const app = makeApp(notes);
  notes.forEach((note, index) => (app.files[index].fm = { ...note.fm }));
  const svg = { path: "Drawings/Drawing.excalidraw.svg", name: "Drawing.excalidraw.svg", basename: "Drawing.excalidraw", extension: "svg" };
  app.files.push(svg);
  app.vault.readBinary = async (file) => (file === svg ? Buffer.from([4, 5, 6]) : Buffer.from([1]));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = {
    enabled: true,
    url: "http://127.0.0.1:8765",
    deck: "",
    omitRegex: "%%[^%]*%%",
    excludeTags: "#hold",
    excalidraw: { enabled: true, folder: "Drawings" },
  };
  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push({ action: body.action, params: body.params });
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [321] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const plan = await plugin.previewAnkiSync({ deck: "Biology", pushOnly: true });
    assert.equal(plan.counts.create, 1);
    assert.match(plan.warnings.join(" "), /Hold\.md: skipped because tag #hold is excluded/);
    const result = await plugin.pushCardsToAnki({ deck: "Biology" });
    assert.equal(result.added, 1, JSON.stringify(result));
    assert.equal(result.count, 1);
    assert.match(result.warnings.join(" "), /Hold\.md: skipped because tag #hold is excluded/);
    const media = actions.find((entry) => entry.action === "storeMediaFile");
    assert.ok(media, JSON.stringify(actions.map((entry) => entry.action)));
    assert.equal(media.params.filename, "Drawing.excalidraw.svg");
    assert.equal(media.params.data, "BAUG");
    const note = actions.find((entry) => entry.action === "canAddNotes").params.notes[0];
    assert.doesNotMatch(note.fields.Front, /secret/);
    assert.match(note.fields.Front, /<img src="Drawing\.excalidraw\.svg">/);
    assert.doesNotMatch(note.fields.Back, /%%note%%/);
    assert.equal(app.files[1].fm.anki_note_id, undefined);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("plugin: clearing a stale Anki link is off by default and opt-in", async () => {
  const notes = [
    {
      path: "Cards/Bio/Gone.md",
      noFm: true,
      fm: {
        card_id: "gone",
        item_type: "card",
        deck: "Biology",
        anki_note_id: "777",
        anki_card_id: "778",
        anki_synced_hash: "old-local",
        anki_remote_hash: "old-remote",
      },
      text: "## Front\nGone?\n\n## Back\nA\n",
    },
  ];
  const app = makeApp(notes);
  app.files[0].fm = { ...notes[0].fm };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "" };
  const before = app.files[0].text;
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    if (body.action === "notesInfo") return { status: 200, json: { result: [] } };
    if (body.action === "cardsInfo") return { status: 200, json: { result: [] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const kept = await plugin.syncCardsWithAnki({});
    assert.equal(kept.cleared, 0);
    assert.equal(kept.skipped, 1);
    assert.equal(app.files[0].fm.anki_note_id, "777");
    assert.match(kept.warnings.join(" "), /the Anki note 777 was not found/);

    plugin.settings.cards.ankiConnect.clearMissing = true;
    const cleared = await plugin.syncCardsWithAnki({});
    assert.equal(cleared.cleared, 1, JSON.stringify(cleared));
    assert.equal(cleared.skipped, 1);
    assert.equal(app.files[0].fm.anki_note_id, undefined);
    assert.equal(app.files[0].fm.anki_card_id, undefined);
    assert.equal(app.files[0].fm.anki_synced_hash, undefined);
    assert.equal(app.files[0].text, before, "cleanup never rewrites the card body");
    assert.equal(plugin.settings.cards.ankiConnect.index["Cards/Bio/Gone.md"], undefined);
    assert.match(cleared.warnings.join(" "), /local Anki link was cleared/);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("AnkiConnect: content authority and exact source links are opt-in", () => {
  assert.equal(anki.normalizeAnkiConnect({}).contentAuthority, "two-way");
  assert.equal(anki.normalizeAnkiConnect({ contentAuthority: "obsidian" }).contentAuthority, "obsidian");
  assert.equal(anki.normalizeAnkiConnect({ contentAuthority: "wizard" }).contentAuthority, "two-way");

  assert.equal(anki.resolveSyncAction({ action: "conflict" }, { conflict: "report" }), "conflict");
  assert.equal(anki.resolveSyncAction({ action: "conflict" }, { conflict: "anki" }), "pull");
  assert.equal(anki.resolveSyncAction({ action: "pull" }, { contentAuthority: "obsidian" }), "push");
  assert.equal(anki.resolveSyncAction({ action: "conflict" }, { contentAuthority: "obsidian", conflict: "report" }), "push");
  assert.equal(anki.resolveSyncAction({ action: "none" }, { contentAuthority: "obsidian" }), "none");

  const pdf = {
    file: { path: "Cards/Bio/PDF.md" },
    fm: { deck: "Biology", source_pdf: "Notes/Bio.pdf", source_page: "4-5" },
    body: { front: "Q", back: "A" },
  };
  const pdfBuilt = anki.buildAnkiNotes([pdf], { defaultDeck: "General", backlinks: true, vaultName: "Study Vault" });
  assert.match(pdfBuilt.notes[0].fields.Back, /file=Notes%2FBio\.pdf&amp;page=4/);

  const heading = {
    file: { path: "Cards/Bio/Heading.md" },
    fm: { deck: "Biology", source_note: "Notes/Bio Lecture.md", source_heading: "## Cell theory" },
    body: { front: "Q", back: "A" },
  };
  const headingBuilt = anki.buildAnkiNotes([heading], { defaultDeck: "General", backlinks: true, vaultName: "Study Vault" });
  assert.match(headingBuilt.notes[0].fields.Back, /file=Notes%2FBio%20Lecture\.md&amp;heading=Cell%20theory/);
});

test("plugin: Obsidian content authority overwrites Anki text but pulls Anki scheduling", async () => {
  const notes = [
    {
      path: "Cards/Bio/Authority.md",
      noFm: true,
      fm: {
        card_id: "authority",
        item_type: "card",
        deck: "Biology",
        tags: ["exam"],
        source_note: "Notes/Bio.md",
        source_heading: "Cell theory",
        anki_note_id: "123",
        anki_card_id: "456",
        anki_synced_hash: "old-local",
        anki_remote_hash: "old-remote",
        attempts: 2,
      },
      text: "## Front\nLocal question?\n\n## Back\nLocal answer\n",
    },
  ];
  const app = makeApp(notes);
  app.files[0].fm = { ...notes[0].fm };
  app.vault.getName = () => "Study Vault";
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = {
    enabled: true,
    url: "http://127.0.0.1:8765",
    deck: "",
    backlinks: true,
    contentAuthority: "obsidian",
  };
  const before = app.files[0].text;
  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push({ action: body.action, params: body.params });
    if (body.action === "notesInfo") {
      return {
        status: 200,
        json: {
          result: [
            {
              noteId: 123,
              cards: [456],
              modelName: "Basic",
              tags: ["remote"],
              fields: { Front: { value: "Remote question?", order: 0 }, Back: { value: "Remote answer", order: 1 } },
            },
          ],
        },
      };
    }
    if (body.action === "cardsInfo") {
      return {
        status: 200,
        json: {
          result: [{ cardId: 456, deckName: "Biology", modelName: "Basic", ord: 0, due: 9, interval: 12, reps: 34, lapses: 2 }],
        },
      };
    }
    return { status: 200, json: { result: 1 } };
  };
  try {
    const plan = await plugin.previewAnkiSync({});
    assert.equal(plan.counts.update, 1, JSON.stringify(plan));
    assert.equal(plan.counts.conflict, 0);
    assert.equal(plan.entries[0].action, "update");
    assert.match(plan.entries[0].detail, /Obsidian owns card content/);
    assert.equal(app.files[0].text, before, "preview does not write the local card");

    const result = await plugin.syncCardsWithAnki({});
    assert.equal(result.updated, 1, JSON.stringify(result));
    assert.equal(result.pulled, 0);
    assert.equal(result.conflicts, 0);
    assert.deepEqual(result.errors, []);
    assert.equal(app.files[0].text, before, "Anki text never replaces the Obsidian card");
    assert.equal(app.files[0].fm.anki_note_id, "123");
    assert.equal(app.files[0].fm.anki_due, 9);
    assert.equal(app.files[0].fm.anki_interval, 12);
    assert.equal(app.files[0].fm.anki_reps, 34);
    assert.equal(app.files[0].fm.anki_lapses, 2);

    const update = actions.find((entry) => entry.action === "updateNoteFields");
    assert.ok(update, JSON.stringify(actions.map((entry) => entry.action)));
    assert.equal(update.params.note.id, 123);
    assert.match(update.params.note.fields.Back, /Local answer/);
    assert.doesNotMatch(update.params.note.fields.Back, /Remote answer/);
    assert.match(update.params.note.fields.Back, /file=Notes%2FBio\.md&amp;heading=Cell%20theory/);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("plugin: push-only updates linked cards and creates only unlinked ones in a vault-wide push", async () => {
  const notes = [
    {
      path: "Cards/Bio/New.md",
      noFm: true,
      fm: { card_id: "new", item_type: "card", deck: "Biology" },
      text: "## Front\nNew question?\n\n## Back\nNew answer",
    },
    {
      path: "Cards/Chem/Linked.md",
      noFm: true,
      fm: { card_id: "linked", item_type: "card", deck: "Chemistry", anki_note_id: "9", anki_card_id: "90" },
      text: "## Front\nLinked question?\n\n## Back\nLinked answer",
    },
  ];
  const app = makeApp(notes);
  notes.forEach((note, index) => (app.files[index].fm = { ...note.fm }));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "" };
  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push(body);
    if (body.action === "notesInfo") {
      return {
        status: 200,
        json: {
          result: [
            {
              noteId: 9,
              cards: [90],
              modelName: "Basic",
              tags: [],
              fields: { Front: { value: "Old linked question", order: 0 }, Back: { value: "Old linked answer", order: 1 } },
            },
          ],
        },
      };
    }
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [123] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const preview = await plugin.previewAnkiSync({ vaultWide: true, pushOnly: true });
    assert.equal(preview.counts.create, 1, JSON.stringify(preview));
    assert.equal(preview.counts.update, 1, JSON.stringify(preview));
    assert.deepEqual(preview.entries.map((entry) => entry.action).sort(), ["create", "update"]);

    const result = await plugin.pushCardsToAnki({ vaultWide: true, targetDeck: "School" });
    assert.equal(result.added, 1, JSON.stringify(result));
    assert.equal(result.updated, 1, JSON.stringify(result));
    assert.deepEqual(result.errors, []);
    const add = actions.find((body) => body.action === "canAddNotes");
    assert.equal(add.params.notes.length, 1, "only the unlinked card is a create");
    assert.match(add.params.notes[0].fields.Front, /New question/);
    const update = actions.find((body) => body.action === "updateNoteFields");
    assert.ok(update, JSON.stringify(actions.map((body) => body.action)));
    assert.equal(update.params.note.id, 9);
    assert.match(update.params.note.fields.Front, /Linked question/);
    const deckChange = actions.find((body) => body.action === "changeDeck");
    assert.deepEqual(deckChange.params.cards, [90]);
    assert.equal(deckChange.params.deck, "School");
    assert.ok(app.files[1].fm.anki_synced_hash, "linked card gets a fresh baseline");
    assert.equal(app.files[1].fm.anki_note_id, "9");
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("AnkiConnect: a page, heading and special characters survive in one source backlink", () => {
  const card = {
    file: { path: "Cards/Bio/Special.md" },
    fm: {
      deck: "Biology",
      source_note: "Notes/A & B.md",
      source_page: "12-14",
      source_heading: "## Cell & theory",
    },
    body: { front: "Q", back: "A" },
  };
  const built = anki.buildAnkiNotes([card], { defaultDeck: "General", backlinks: true, vaultName: "Study & Lab" });
  const back = built.notes[0].fields.Back;
  assert.ok(
    back.includes("vault=Study%20%26%20Lab&amp;file=Notes%2FA%20%26%20B.md&amp;page=12&amp;heading=Cell%20%26%20theory"),
    back
  );
  assert.equal((back.match(/>Source note<\/a>/g) || []).length, 1);

  const fallback = anki.buildAnkiNotes(
    [{ file: { path: "Cards/Bio/NoSource.md" }, fm: { deck: "Biology" }, body: { front: "Q", back: "A" } }],
    { defaultDeck: "General", backlinks: true }
  );
  assert.ok(fallback.notes[0].fields.Back.includes("file=Cards%2FBio%2FNoSource.md"), fallback.notes[0].fields.Back);
  assert.doesNotMatch(fallback.notes[0].fields.Back, /[?&]page=|[?&]heading=/);
});

test("AnkiConnect: table cells keep escaped pipes and inline formatting", () => {
  const html = anki.markdownToAnkiHtml(
    "| **Term** | Meaning |\n| --- | --- |\n| ATP | Energy \\| work |\n| `cAMP` | *Second messenger* |"
  );
  assert.match(html, /<th><strong>Term<\/strong><\/th>/);
  assert.match(html, /<td>ATP<\/td><td>Energy \| work<\/td>/);
  assert.match(html, /<td><code>cAMP<\/code><\/td><td><em>Second messenger<\/em><\/td>/);
  const local = anki.syncRecord({ front: "| **Term** | Meaning |\n| --- | --- |\n| ATP | Energy \\| work |", back: "A", deck: "D", tags: [], type: "Basic" });
  const remote = anki.syncRecord({
    front: "<table><thead><tr><th><strong>Term</strong></th><th>Meaning</th></tr></thead><tbody><tr><td>ATP</td><td>Energy | work</td></tr></tbody></table>",
    back: "A",
    deck: "D",
    tags: [],
    type: "Basic",
  });
  assert.equal(anki.syncHash(local), anki.syncHash(remote));
});

test("plugin: duplicate media basenames warn instead of silently overwriting, and upload failures stay warnings", async () => {
  const app = makeApp([]);
  const first = { path: "Media/A/same.png", name: "same.png", basename: "same", extension: "png" };
  const second = { path: "Media/B/same.png", name: "same.png", basename: "same", extension: "png" };
  app.metadataCache.getFirstLinkpathDest = (_name, sourcePath) => (String(sourcePath).startsWith("Cards/A") ? first : second);
  app.vault.readBinary = async (file) => Buffer.from(file.path.startsWith("Media/A") ? [1] : [2]);
  const plugin = new QT(app);
  await plugin.onload();
  const stored = [];
  const warnings = await plugin.uploadAnkiMedia(
    { storeMedia: async (files) => stored.push(...files) },
    {
      media: [
        { name: "same.png", target: "Media/A/same.png", sourcePath: "Cards/A.md" },
        { name: "same.png", target: "Media/B/same.png", sourcePath: "Cards/B.md" },
      ],
    }
  );
  assert.equal(stored.length, 1);
  assert.equal(stored[0].filename, "same.png");
  assert.equal(stored[0].data, "AQ==");
  assert.match(warnings.join(" "), /filename conflict/);
  assert.match(warnings.join(" "), /Media\/A\/same\.png/);
  assert.match(warnings.join(" "), /Media\/B\/same\.png/);

  const failed = await plugin.uploadAnkiMedia(
    {
      storeMedia: async () => {
        throw new Error("disk full");
      },
    },
    { media: [{ name: "same.png", target: "Media/A/same.png", sourcePath: "Cards/A.md" }] }
  );
  assert.match(failed.join(" "), /Media upload failed: disk full/);
  assert.equal(failed.length, 1);
});
