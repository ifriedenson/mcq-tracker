"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const TX = T.text2anki;
const A = T.autoAnki;

const NOTE_TEXT = "# Cell\n\n- The membrane is selectively permeable.\n- Mitochondria make ATP.\n";

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
      fm[row[1].trim()] = /^\".*\"$/.test(value) ? JSON.parse(value) : value;
    }
    file.fm = fm;
  }
}

async function setup(text, selection) {
  const app = makeApp([
    {
      path: "Courses/Bio/cell.md",
      fm: { question_id: undefined, course: "BIOL 201", attempts: 4, history: ["old"], streak: 2, next_review: "2026-11-01" },
      text: text === undefined ? NOTE_TEXT : text,
    },
  ]);
  const file = app.files[0];
  app.workspace.getActiveFile = () => file;
  app.workspace.activeEditor = { file, editor: { getSelection: () => selection || "" } };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.defaultDeck = "Biology";
  plugin.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "", conflict: "report" };
  plugin.settings.text2anki = TX.normalizeText2Anki({ count: 2, deck: "Biology" }, "Biology");
  plugin.settings.autoAnki = A.normalizeAutoAnki({ count: 2, deck: "Biology" }, "Biology");
  const pushes = [];
  plugin.pushCardsToAnki = async (options) => {
    pushes.push(options);
    return { added: options.paths.length, updated: 0, warnings: [] };
  };
  return { app, file, plugin, pushes };
}

function cardsReply() {
  return '{"cards":[{"front":"Membrane?","back":"Selectively permeable."},{"front":"ATP?","back":"Mitochondria."}]}';
}

test("text2anki: settings, Deck directive and selection normalization", () => {
  assert.deepEqual(TX.normalizeText2Anki({}, "General"), { count: 5, deck: "General", customPrompt: "" });
  assert.deepEqual(TX.normalizeText2Anki({ count: 99, deck: "  ", customPrompt: "x".repeat(2500) }, "General"), {
    count: 20,
    deck: "General",
    customPrompt: "x".repeat(2000),
  });
  assert.equal(TX.normalizeText2Anki("corrupt", "General").count, 5);
  assert.equal(TX.text2AnkiDeckDirective("Deck: Computer Science::Python\n- a fact"), "Computer Science::Python");
  assert.equal(TX.stripText2AnkiDeck("Deck: Computer Science::Python\n\n- a fact"), "- a fact");
  assert.deepEqual(TX.chooseText2AnkiSource({ selection: "Deck: Bio::Cells\nATP is made.", text: "other" }), {
    kind: "selection",
    text: "ATP is made.",
    deck: "Bio::Cells",
  });
  assert.deepEqual(TX.chooseText2AnkiSource({ selection: "ATP is made.", text: "Deck: Bio\nother" }), {
    kind: "selection",
    text: "ATP is made.",
    deck: "Bio",
  });
  assert.throws(() => TX.chooseText2AnkiSource({ selection: "", text: "Note" }), /Select some text/);
  assert.throws(() => TX.chooseText2AnkiSource({ selection: "Deck: Bio", text: "Note" }), /after the Deck line/);
});

test("text2anki: selection, custom prompt and Deck directive create tracked cards and push only them", async () => {
  const { app, file, plugin, pushes } = await setup(NOTE_TEXT, "Deck: Bio::Cells\nThe membrane is selectively permeable. ATP is made by mitochondria.");
  plugin.settings.text2anki.customPrompt = "Focus on organelles.";
  let asked = null;
  plugin.aiComplete = async (system, user) => {
    asked = { system, user };
    return cardsReply();
  };
  const first = await plugin.runText2Anki();
  assert.equal(first.format, "text2anki-openai");
  assert.equal(first.reused, false);
  assert.equal(first.created, 2);
  assert.equal(app.created.length, 2);
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].paths, first.paths);
  assert.equal(pushes[0].deck, "Bio::Cells");
  assert.match(asked.user, /Make 2 flashcards from this selected passage/);
  assert.match(asked.user, /Focus on organelles/);
  assert.match(asked.user, /selectively permeable/);
  assert.doesNotMatch(asked.user, /Deck:/);
  hydrateCreated(app);
  const made = app.created.map((entry) => entry.text);
  assert.ok(made.every((text) => /import_batch: "auto-anki-source:/.test(text)));
  assert.ok(made.every((text) => /import_format: "text2anki-openai"/.test(text)));
  assert.equal(file.fm.attempts, 4);
  assert.deepEqual(file.fm.history, ["old"]);
  assert.equal(file.fm.streak, 2);
  assert.equal(file.fm.next_review, "2026-11-01");
});

test("text2anki: rerun and restart reuse the batch without calling the AI or duplicating cards", async () => {
  const { app, plugin, pushes } = await setup(NOTE_TEXT, "The membrane is selectively permeable.");
  plugin.aiComplete = async () => cardsReply();
  const first = await plugin.runText2Anki();
  assert.equal(first.created, 2);
  hydrateCreated(app);
  await plugin.save();

  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    throw new Error("AI must not be called on a reused batch");
  };
  const second = await plugin.runText2Anki();
  assert.equal(calls, 0);
  assert.equal(second.reused, true);
  assert.equal(second.created, 0);
  assert.equal(app.created.length, 2);
  assert.deepEqual(pushes[1].paths, first.paths);

  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  restarted.settings.ai.enabled = true;
  restarted.settings.cards.enabled = true;
  restarted.settings.cards.ankiConnect = { enabled: true, url: "http://127.0.0.1:8765", deck: "" };
  restarted.settings.cards.defaultDeck = "Biology";
  restarted.settings.text2anki = TX.normalizeText2Anki({ count: 2, deck: "Biology" });
  app.workspace.getActiveFile = () => app.files[0];
  app.workspace.activeEditor = { file: app.files[0], editor: { getSelection: () => "The membrane is selectively permeable." } };
  let restartedCalls = 0;
  restarted.aiComplete = async () => {
    restartedCalls++;
    throw new Error("AI must not be called after a restart");
  };
  const restartedPushes = [];
  restarted.pushCardsToAnki = async (options) => {
    restartedPushes.push(options);
    return { added: 0, updated: options.paths.length, warnings: [] };
  };
  const third = await restarted.runText2Anki();
  assert.equal(restartedCalls, 0);
  assert.equal(third.reused, true);
  assert.equal(third.paths.length, 2);
  assert.equal(restartedPushes[0].paths.length, 2);
  assert.equal(app.created.length, 2);
});

test("text2anki: empty sources and disabled AI, Cards or AnkiConnect gates stop before writing", async () => {
  const empty = await setup(NOTE_TEXT, "");
  empty.plugin.aiComplete = async () => {
    throw new Error("AI should not be called");
  };
  await assert.rejects(() => empty.plugin.runText2Anki(), /Select some text/);
  assert.equal((empty.app.created || []).length, 0);
  assert.equal(empty.pushes.length, 0);

  const directiveOnly = await setup(NOTE_TEXT, "Deck: Biology");
  await assert.rejects(() => directiveOnly.plugin.runText2Anki(), /after the Deck line/);

  const gates = await setup(NOTE_TEXT, "ATP is made by mitochondria.");
  gates.plugin.settings.ai.enabled = false;
  await assert.rejects(() => gates.plugin.runText2Anki(), /Turn on AI features/);
  gates.plugin.settings.ai.enabled = true;
  gates.plugin.settings.cards.enabled = false;
  await assert.rejects(() => gates.plugin.runText2Anki(), /Turn on Cards/);
  gates.plugin.settings.cards.enabled = true;
  gates.plugin.settings.cards.ankiConnect.enabled = false;
  await assert.rejects(() => gates.plugin.runText2Anki(), /Turn on AnkiConnect/);
  assert.equal((gates.app.created || []).length, 0);
});

test("text2anki: missing provider configuration and failed requests leave the vault untouched", async () => {
  const noKey = await setup(NOTE_TEXT, "ATP is made by mitochondria.");
  noKey.plugin.settings.ai.api = { ...noKey.plugin.settings.ai.api, provider: "openai", model: "gpt-test", baseUrl: "", keys: {}, secrets: {} };
  await assert.rejects(() => noKey.plugin.runText2Anki(), /API key/);
  assert.equal((noKey.app.created || []).length, 0);
  assert.equal(noKey.pushes.length, 0);

  const failed = await setup(NOTE_TEXT, "ATP is made by mitochondria.");
  let calls = 0;
  failed.plugin.aiComplete = async () => {
    calls++;
    throw new Error("HTTP 500: provider unavailable");
  };
  await assert.rejects(() => failed.plugin.runText2Anki(), /provider unavailable/);
  assert.equal(calls, 1);
  assert.equal((failed.app.created || []).length, 0);
  assert.equal(failed.pushes.length, 0);

  failed.plugin.aiComplete = async () => cardsReply();
  const retried = await failed.plugin.runText2Anki();
  assert.equal(retried.created, 2);
  assert.equal(failed.app.created.length, 2);
});

test("text2anki: command is registered and shares Auto Anki's source batch", async () => {
  const { app, plugin } = await setup(NOTE_TEXT, "The membrane is selectively permeable.");
  assert.ok(plugin.commands.some((command) => command.id === "text2anki-send"));
  plugin.aiComplete = async () => cardsReply();
  const auto = await plugin.runAutoAnki({ source: "selection" });
  assert.equal(auto.created, 2);
  hydrateCreated(app);

  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    throw new Error("Shared batch must be reused");
  };
  const command = plugin.commands.find((item) => item.id === "text2anki-send");
  const result = await command.callback();
  assert.equal(calls, 0);
  assert.equal(result.reused, true);
  assert.equal(result.cards, 2);
  assert.equal(app.created.length, 2);
  assert.ok(T.text2anki.text2AnkiNotice(result).includes("reused 2 existing cards"));
  obsidian.notices.length = 0;
});
