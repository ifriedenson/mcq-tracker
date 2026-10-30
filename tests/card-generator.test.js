"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const G = T.cardGenerator;

function fileNote(path, text, fm) {
  return { path, noFm: true, fm: fm || {}, text };
}

async function setup(text, selection) {
  const app = makeApp([fileNote("Courses/Bio/cell.md", text)]);
  const file = app.files[0];
  file.fm = { course: "BIOL 201" };
  app.workspace.getActiveFile = () => file;
  app.workspace.activeEditor = {
    file,
    editor: {
      getSelection: () => selection || "",
      getValue: () => file.text,
      lineCount: () => file.text.split("\n").length,
      getLine: (line) => file.text.split("\n")[line] || "",
      replaceRange: (value, at) => {
        app.editorInserted = { value, at };
        app.files[0].text += value;
      },
    },
  };
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.defaultDeck = "Biology";
  return { app, file, plugin };
}

test("card generator: normalizes defaults, styles and separators", () => {
  assert.deepEqual(G.normalizeCardGenerator({}), {
    count: 8,
    customPrompt: "",
    style: "inline",
    separator: "::",
    hideInPreview: false,
    output: "notes",
    source: "auto",
    deck: "",
  });
  const config = G.normalizeCardGenerator({ count: 99, style: "multiline", separator: "", output: "insert", source: "selection", hideInPreview: true });
  assert.equal(config.count, 20);
  assert.equal(config.style, "multiline");
  assert.equal(config.separator, "---");
  assert.equal(config.output, "insert");
  assert.equal(config.source, "selection");
  assert.equal(config.hideInPreview, true);
});

test("card generator: prompt carries the source, quantity and custom instruction", () => {
  const prompt = G.buildCardGeneratorPrompt({
    title: "Cell",
    course: "BIOL 201",
    text: "The membrane is selectively permeable.",
    sourceKind: "selection",
    count: 3,
    customPrompt: "Focus on definitions.",
  });
  assert.match(prompt.user, /Make 3 flashcards from this selected passage/);
  assert.match(prompt.user, /Focus on definitions/);
  assert.match(prompt.user, /selectively permeable/);
  assert.match(prompt.user, /only to guide emphasis/);
  assert.match(prompt.system, /untrusted data/);
});

test("card generator: inline, multiline, hidden and append formatting", () => {
  const cards = [{ front: "Membrane?", back: "Selectively permeable." }];
  assert.equal(G.formatCardPair(cards[0], { style: "inline", separator: "::" }), "Membrane? :: Selectively permeable.");
  assert.equal(G.formatCardPair(cards[0], { style: "multiline", separator: "---" }), "Membrane?\n---\nSelectively permeable.");
  const visible = G.buildCardBlock(cards, { style: "inline", separator: "::" });
  assert.match(visible, /^> \[!note\] AI-generated flashcards/);
  assert.match(visible, /> Membrane\? :: Selectively permeable\./);
  const hidden = G.buildCardBlock(cards, { style: "multiline", separator: "---", hideInPreview: true });
  assert.match(hidden, /^%%\n/);
  assert.match(hidden, /\n%%$/);
  assert.equal(G.appendCardBlock("Body", visible), `Body\n\n${visible}\n`);
  assert.equal(G.appendPrefix("Body"), "\n\n");
});

test("card generator: command is registered and selection generation reuses the AI path", async () => {
  const { plugin } = await setup("WHOLE_ONLY The membrane is selectively permeable.\nMitochondria make ATP.", "The membrane is selectively permeable.");
  let asked = null;
  plugin.aiComplete = async (system, user) => {
    asked = { system, user };
    return '{"cards":[{"front":"What is the membrane like?","back":"Selectively permeable."}]}';
  };
  assert.ok(plugin.commands.some((command) => command.id === "generate-cards"));
  const draft = await plugin.generateCardsFromNote({
    source: "selection",
    count: 2,
    customPrompt: "Definitions only.",
  });
  assert.equal(draft.items.length, 1);
  assert.equal(draft.sourceKind, "selection");
  assert.match(asked.user, /selected passage/);
  assert.match(asked.user, /selectively permeable/);
  assert.doesNotMatch(asked.user, /WHOLE_ONLY/);
  assert.equal(draft.items[0].front, "What is the membrane like?");
});

test("card generator: confirmed drafts create tracked card notes with provenance", async () => {
  const { app, plugin } = await setup("The membrane is selectively permeable.");
  plugin.aiComplete = async () => '{"cards":[{"front":"Membrane?","back":"Selectively permeable."}]}';
  const draft = await plugin.generateCardsFromNote({ source: "note", count: 1 });
  const result = await plugin.writeTranscriptPractice(draft, { deck: "Biology" });
  assert.equal(result.created, 1);
  const made = app.created[0].text;
  assert.match(made, /deck: "Biology"/);
  assert.match(made, /source_note: "Courses\/Bio\/cell.md"/);
  assert.match(made, /ai_model: /);
  assert.match(made, /## Front\n\nMembrane\?/);
});

test("card generator: insert mode appends a hidden multiline block to the open note", async () => {
  const { app, plugin } = await setup("Body text.");
  plugin.aiComplete = async () => '{"cards":[{"front":"Membrane?","back":"Selectively permeable."}]}';
  const draft = await plugin.generateCardsFromNote({ source: "note", count: 1 });
  const result = await plugin.insertGeneratedCards(draft, { style: "multiline", separator: "---", hideInPreview: true });
  assert.equal(result.inserted, 1);
  assert.match(app.editorInserted.value, /\n\n%%\n> \[!note\]/);
  assert.match(app.editorInserted.value, /> Membrane\?\n> ---\n> Selectively permeable\./);
  assert.match(app.files[0].text, /Body text\.\n\n%%\n> \[!note\]/);
  assert.match(app.editorInserted.value, /\n%%\n$/);
});
