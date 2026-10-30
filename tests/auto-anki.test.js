"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const A = T.autoAnki;

const NOTE_TEXT = "# Cell\n\nThe membrane is selectively permeable.\n\nMitochondria make ATP.\n";

function cardFile(path, deck) {
  return {
    path,
    fm: { question_id: undefined, card_id: path.replace(/^.*\//, "").replace(/\.md$/, ""), item_type: "card", deck },
    text: "## Front\nWhich organelle makes ATP?\n\n## Back\nMitochondria",
  };
}

/** Obsidian's metadata cache updates after vault.create; teach the fake the written frontmatter too. */
function hydrateCreated(app) {
  for (const entry of app.created || []) {
    const file = app.files.find((item) => item.path === entry.path);
    if (!file) continue;
    const match = entry.text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;
    const fm = {};
    for (const line of match[1].split("\n")) {
      const row = line.match(/^([^:#\s][^:]*):\s*(.*)$/);
      if (!row) continue;
      const value = row[2];
      fm[row[1].trim()] = /^".*"$/.test(value) ? JSON.parse(value) : value;
    }
    file.fm = fm;
  }
}

async function setup(text, selection) {
  const app = makeApp([{ path: "Courses/Bio/cell.md", fm: { question_id: undefined, course: "BIOL 201", attempts: 4, history: ["old"], streak: 2, next_review: "2026-11-01" }, text: text === undefined ? NOTE_TEXT : text }]);
  const file = app.files[0];
  app.workspace.getActiveFile = () => file;
  app.workspace.activeEditor = { file, editor: { getSelection: () => selection || "" } };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.defaultDeck = "Biology";
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "", conflict: "report" };
  plugin.settings.autoAnki = A.normalizeAutoAnki({ count: 2, deck: "Biology" }, "Biology");
  const pushes = [];
  plugin.pushCardsToAnki = async (options) => {
    pushes.push(options);
    return { added: options.paths.length, updated: 0, warnings: [] };
  };
  return { app, file, plugin, pushes };
}

test("auto anki: source keys, settings and card metadata are deterministic", () => {
  assert.deepEqual(A.normalizeAutoAnki({ count: 99, deck: "  " }, "General"), { count: 20, deck: "General" });
  assert.deepEqual(A.normalizeAutoAnki({ count: "bad", deck: "  Spanish " }, "General"), { count: 8, deck: "Spanish" });
  assert.equal(A.autoAnkiSourceKey("A.md", "note", "same"), A.autoAnkiSourceKey("A.md", "note", "same"));
  assert.notEqual(A.autoAnkiSourceKey("A.md", "note", "same"), A.autoAnkiSourceKey("A.md", "note", "changed"));
  assert.deepEqual(A.chooseAutoAnkiSource({ text: "note", selection: "selected" }, "auto"), { kind: "selection", text: "selected" });
  assert.deepEqual(A.chooseAutoAnkiSource({ text: "note", selection: "selected" }, "note"), { kind: "note", text: "note" });
  assert.throws(() => A.chooseAutoAnkiSource({ text: "note", selection: "" }, "selection"), /Select some text/);
  const cards = A.autoAnkiCardInputs(
    { items: [{ front: "Q", back: "A" }], sourcePath: "Courses/Bio/cell.md", course: "BIOL 201", ai: true, model: "model", deck: "Biology" },
    { batch: "batch-1", deck: "Biology" }
  );
  assert.equal(cards.length, 1);
  assert.equal(cards[0].importBatch, "batch-1");
  assert.equal(cards[0].importFormat, "auto-anki");
  assert.match(cards[0].importKey, /^auto-anki-card:/);
  assert.equal(cards[0].sourceNote, "Courses/Bio/cell.md");
  assert.equal(cards[0].aiModel, "model");
});

test("auto anki: selection goes to AI, creates tracked cards, pushes only those cards and is idempotent", async () => {
  const { app, file, plugin, pushes } = await setup("WHOLE_NOTE_ONLY. This should not be selected.", "The membrane is selectively permeable.");
  let asked = null;
  plugin.aiComplete = async (system, user) => {
    asked = { system, user };
    return '{"cards":[{"front":"Membrane?","back":"Selectively permeable."},{"front":"ATP?","back":"Mitochondria."}]}';
  };
  const first = await plugin.runAutoAnki({ source: "selection", count: 2, deck: "Biology" });
  assert.equal(first.reused, false);
  assert.equal(first.created, 2);
  assert.equal(app.created.length, 2);
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].paths, first.paths);
  assert.match(asked.user, /selected passage/);
  assert.match(asked.user, /selectively permeable/);
  assert.doesNotMatch(asked.user, /WHOLE_NOTE_ONLY/);
  hydrateCreated(app);
  const made = app.created.map((entry) => entry.text);
  assert.ok(made.every((text) => /import_batch: "auto-anki-source:/.test(text)));
  assert.ok(made.every((text) => /import_format: "auto-anki"/.test(text)));
  assert.equal(file.fm.attempts, 4);
  assert.deepEqual(file.fm.history, ["old"]);
  assert.equal(file.fm.streak, 2);
  assert.equal(file.fm.next_review, "2026-11-01");

  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    throw new Error("AI must not be called on a reused batch");
  };
  const second = await plugin.runAutoAnki({ source: "selection", count: 2, deck: "Biology" });
  assert.equal(calls, 0);
  assert.equal(second.reused, true);
  assert.equal(second.created, 0);
  assert.equal(app.created.length, 2);
  assert.equal(pushes.length, 2);
  assert.deepEqual(pushes[1].paths, first.paths);
});

test("auto anki: a restart reuses the batch saved on the card notes", async () => {
  const { app, plugin } = await setup();
  plugin.aiComplete = async () => '{"cards":[{"front":"Membrane?","back":"Selectively permeable."}]}';
  const first = await plugin.runAutoAnki({ source: "note", count: 1 });
  assert.equal(first.created, 1);
  hydrateCreated(app);
  await plugin.save();

  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  restarted.settings.ai.enabled = true;
  restarted.settings.cards.enabled = true;
  restarted.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "" };
  restarted.settings.autoAnki = A.normalizeAutoAnki({ count: 1, deck: "Biology" });
  restarted.settings.cards.defaultDeck = "Biology";
  app.workspace.getActiveFile = () => app.files[0];
  app.workspace.activeEditor = { file: app.files[0], editor: { getSelection: () => "" } };
  let calls = 0;
  restarted.aiComplete = async () => {
    calls++;
    return '{"cards":[]}';
  };
  const pushes = [];
  restarted.pushCardsToAnki = async (options) => {
    pushes.push(options);
    return { added: 0, updated: options.paths.length, warnings: [] };
  };
  const second = await restarted.runAutoAnki({ source: "note", count: 1 });
  assert.equal(calls, 0);
  assert.equal(second.reused, true);
  assert.equal(second.paths.length, 1);
  assert.equal(pushes[0].paths.length, 1);
  assert.equal(app.created.length, 1);
});

test("auto anki: empty sources and disabled gates fail before writing or sending", async () => {
  const empty = await setup("   ");
  empty.plugin.aiComplete = async () => {
    throw new Error("AI should not be called");
  };
  await assert.rejects(() => empty.plugin.runAutoAnki({ source: "note" }), /no readable text/);
  assert.equal((empty.app.created || []).length, 0);
  assert.equal(empty.pushes.length, 0);

  const noSelection = await setup(NOTE_TEXT, "");
  await assert.rejects(() => noSelection.plugin.runAutoAnki({ source: "selection" }), /Select some text/);

  const gates = await setup();
  gates.plugin.settings.ai.enabled = false;
  await assert.rejects(() => gates.plugin.runAutoAnki({ source: "note" }), /Turn on AI features/);
  gates.plugin.settings.ai.enabled = true;
  gates.plugin.settings.cards.ankiConnect.enabled = false;
  await assert.rejects(() => gates.plugin.runAutoAnki({ source: "note" }), /Turn on AnkiConnect/);
  assert.equal((gates.app.created || []).length, 0);
});

test("auto anki: push paths limit the existing Anki bridge to the generated cards", async () => {
  const app = makeApp([cardFile("Cards/Biology/One.md", "Biology"), cardFile("Cards/Biology/Two.md", "Biology")]);
  app.files[1].fm = { ...app.files[1].fm, card_id: "two" };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "", conflict: "report" };
  const actions = [];
  const previous = obsidian.requestImpl;
  obsidian.requestImpl = async (req) => {
    const body = JSON.parse(req.body);
    actions.push(body.action);
    if (body.action === "canAddNotes") return { status: 200, json: { result: body.params.notes.map(() => true) } };
    if (body.action === "addNotes") return { status: 200, json: { result: [456] } };
    return { status: 200, json: { result: 1 } };
  };
  try {
    const result = await plugin.pushCardsToAnki({ paths: ["Cards/Biology/One.md"], deck: "Biology" });
    assert.equal(result.count, 1);
    assert.equal(result.added, 1);
    assert.ok(app.files[0].fm.anki_note_id);
    assert.equal(app.files[1].fm.anki_note_id, undefined);
    assert.deepEqual(actions, ["createDeck", "canAddNotes", "addNotes"]);
  } finally {
    obsidian.requestImpl = previous;
  }
});

test("auto anki: the command and modal use the shared card path", async () => {
  const { app, plugin } = await setup();
  assert.ok(plugin.commands.some((command) => command.id === "auto-anki-send"));
  plugin.aiComplete = async () => '{"cards":[{"front":"What does the membrane do?","back":"It is selectively permeable."}]}';
  const modal = new T.AutoAnkiModal(app, plugin);
  modal.app = app;
  const dom = makeDom();
  modal.contentEl = dom.root;
  await modal.onOpen();
  assert.ok(dom.texts().includes("Auto Anki"));
  assert.ok(dom.texts().includes("Generate and send"));
  await dom.click("Generate and send");
  assert.equal(app.created.length, 1);
  assert.equal(modal.result.created, 1);
  obsidian.notices.length = 0;
});
