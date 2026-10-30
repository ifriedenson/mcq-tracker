"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const SQ = T.spacedQuiz;
const CI = T.cardsImport;

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
      fm[row[1].trim()] = /^".*"$/.test(value) ? JSON.parse(value) : value;
    }
    file.fm = fm;
  }
}

async function setup(text) {
  const app = makeApp([
    {
      path: "Courses/Bio/cell.md",
      fm: { course: "BIOL 201", attempts: 4, history: ["old"], streak: 2, next_review: "2026-11-01" },
      text: text === undefined ? NOTE_TEXT : text,
    },
  ]);
  const file = app.files[0];
  app.workspace.getActiveFile = () => file;
  app.workspace.activeEditor = { file, editor: { getSelection: () => "" } };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.defaultDeck = "Biology";
  plugin.settings.cards.newCardFolder = "Cards";
  return { app, file, plugin };
}

function cardsReply() {
  return '{"cards":[{"front":"What is the membrane like?","back":"Selectively permeable."},{"front":"What makes ATP?","back":"Mitochondria."}]}';
}

test("spaced quiz: renders multiline Spaced Repetition syntax and round-trips through the importer", () => {
  const built = SQ.buildSpacedQuizNote(
    [
      { front: "What is the membrane like?", back: "Selectively permeable." },
      { front: "What makes ATP?\nExtra cue", back: "Mitochondria." },
    ],
    { sourcePath: "Courses/Bio/cell.md", deck: "Biology", title: "Cell Spaced Quiz", model: "gpt-test" }
  );
  assert.match(built.text, /^---\nspaced_quiz_source: "Courses\/Bio\/cell.md"/);
  assert.match(built.text, /# Cell Spaced Quiz/);
  assert.match(built.text, /#flashcards\n/);
  assert.match(built.text, /What is the membrane like\?\n\?\nSelectively permeable\./);
  assert.match(built.text, /What makes ATP\? Extra cue\n\?\nMitochondria\./);
  const parsed = CI.parseSpacedRepetition(built.text, { sourcePath: "Cards/Cell Spaced Quiz.md", deck: "Biology" });
  assert.equal(parsed.cards.length, 2);
  assert.equal(parsed.cards[0].front, "What is the membrane like?");
  assert.equal(parsed.cards[1].back, "Mitochondria.");
  assert.equal(parsed.cards[0].deck, "Biology");
  assert.equal(built.cards.length, 2);
  assert.equal(SQ.spacedQuizNotice({ cards: 2, created: 2 }), "Saved a Spaced Repetition quiz with 2 cards (2 new tracked cards).");
  assert.equal(SQ.spacedQuizNotice({ cards: 2, reused: true }), "Spaced quiz updated: 2 cards already tracked.");
});

test("spaced quiz: command, generation, note write and tracked-card import work end to end", async () => {
  const { app, file, plugin } = await setup();
  assert.ok(plugin.commands.some((command) => command.id === "generate-spaced-quiz"));
  const command = plugin.commands.find((item) => item.id === "generate-spaced-quiz");
  assert.equal(command.checkCallback(true), true);
  plugin.aiComplete = async () => cardsReply();
  const draft = await plugin.generateCardsFromNote({ source: "note", count: 2 });
  assert.equal(draft.items.length, 2);
  const result = await plugin.writeSpacedQuiz(draft, { deck: "Biology" });
  assert.equal(result.path, "Cards/cell Spaced Quiz.md");
  assert.equal(result.cards, 2);
  assert.equal(result.created, 2);
  assert.equal(result.skipped, 0);
  const note = app.files.find((item) => item.path === result.path);
  assert.ok(note);
  assert.match(note.text, /#flashcards/);
  assert.match(note.text, /What is the membrane like\?\n\?\nSelectively permeable\./);
  assert.equal(app.created.length, 3);
  const cardNotes = app.created.filter((entry) => entry.path !== result.path);
  assert.equal(cardNotes.length, 2);
  for (const entry of cardNotes) {
    assert.match(entry.text, /import_format: "spaced-quiz"/);
    assert.match(entry.text, /import_batch: "spaced-quiz-source:/);
    assert.match(entry.text, /source_note: "Courses\/Bio\/cell.md"/);
    assert.match(entry.text, /## Front/);
  }
  assert.equal(file.fm.attempts, 4);
  assert.deepEqual(file.fm.history, ["old"]);
  assert.equal(file.fm.streak, 2);
  assert.equal(file.fm.next_review, "2026-11-01");
});

test("spaced quiz: a rerun updates the same note and skips duplicate cards across a restart", async () => {
  const { app, plugin } = await setup();
  plugin.aiComplete = async () => cardsReply();
  const first = await plugin.writeSpacedQuiz(await plugin.generateCardsFromNote({ source: "note", count: 2 }), { deck: "Biology" });
  assert.equal(first.created, 2);
  hydrateCreated(app);
  const before = app.created.length;

  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    return cardsReply();
  };
  const second = await plugin.writeSpacedQuiz(await plugin.generateCardsFromNote({ source: "note", count: 2 }), { deck: "Biology" });
  assert.equal(calls, 1);
  assert.equal(second.created, 0);
  assert.equal(second.skipped, 2);
  assert.equal(second.reused, true);
  assert.equal(app.created.length, before);
  assert.equal(app.files.filter((item) => item.path === first.path).length, 1);
  assert.ok((app.modified || []).some((entry) => entry.path === first.path));

  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  restarted.settings.ai.enabled = true;
  restarted.settings.cards.enabled = true;
  restarted.settings.cards.defaultDeck = "Biology";
  restarted.settings.cards.newCardFolder = "Cards";
  app.workspace.getActiveFile = () => app.files.find((item) => item.path === "Courses/Bio/cell.md");
  restarted.aiComplete = async () => cardsReply();
  const third = await restarted.writeSpacedQuiz(await restarted.generateCardsFromNote({ source: "note", count: 2 }), { deck: "Biology" });
  assert.equal(third.path, first.path);
  assert.equal(third.created, 0);
  assert.equal(third.skipped, 2);
  assert.equal(app.created.length, before);
});

test("spaced quiz: empty sources, failed requests and missing providers never write", async () => {
  const empty = await setup("   ");
  let attempted = false;
  empty.plugin.aiComplete = async () => {
    attempted = true;
    return cardsReply();
  };
  await assert.rejects(() => empty.plugin.generateCardsFromNote({ source: "note" }), /no readable text/);
  assert.equal(attempted, false);
  assert.equal((empty.app.created || []).length, 0);

  const failed = await setup();
  failed.plugin.aiComplete = async () => {
    throw new Error("HTTP 500: provider unavailable");
  };
  await assert.rejects(() => failed.plugin.generateCardsFromNote({ source: "note" }), /provider unavailable/);
  assert.equal((failed.app.created || []).length, 0);
  failed.plugin.aiComplete = async () => cardsReply();
  const retry = await failed.plugin.writeSpacedQuiz(await failed.plugin.generateCardsFromNote({ source: "note" }), { deck: "Biology" });
  assert.equal(retry.created, 2);

  const noKey = await setup();
  noKey.plugin.settings.ai.api = { ...noKey.plugin.settings.ai.api, provider: "openai", model: "gpt-test", baseUrl: "", keys: {}, secrets: {} };
  await assert.rejects(() => noKey.plugin.generateCardsFromNote({ source: "note" }), /API key/);
  assert.equal((noKey.app.created || []).length, 0);
});

test("spaced quiz: malformed drafts are rejected before writing and a user note is never overwritten", async () => {
  assert.throws(() => SQ.buildSpacedQuizNote([], { sourcePath: "A.md" }), /no usable cards/);
  assert.throws(() => SQ.buildSpacedQuizNote([{ front: "", back: "x" }], { sourcePath: "A.md" }), /no usable cards/);
  assert.equal(T.cardGenerator.normalizeCardGenerator({ output: "spaced" }).output, "spaced");
  assert.equal(T.cardGenerator.normalizeCardGenerator({ output: "nonsense" }).output, "notes");
  assert.equal(SQ.spacedQuizTitle("Courses/Bio/cell.md"), "cell Spaced Quiz");
  assert.equal(SQ.spacedQuizFileName('A/B: "C"?'), "A B C.md");

  const { app, plugin } = await setup();
  const occupied = { path: "Cards/cell Spaced Quiz.md", basename: "cell Spaced Quiz", extension: "md", fm: {}, heading: [], text: "# My own note\n\nDo not replace me.\n" };
  app.files.push(occupied);
  plugin.aiComplete = async () => cardsReply();
  const result = await plugin.writeSpacedQuiz(await plugin.generateCardsFromNote({ source: "note" }), { deck: "Biology" });
  assert.equal(result.path, "Cards/cell Spaced Quiz 2.md");
  assert.equal(occupied.text, "# My own note\n\nDo not replace me.\n");
  assert.equal(app.files.filter((item) => item.path === "Cards/cell Spaced Quiz.md").length, 1);
});
