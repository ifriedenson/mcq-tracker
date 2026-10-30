"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.sourceRecall;
const cards = T.cards;

const SOURCE_TEXT = "# Cell\n\nThe membrane is\nselectively permeable.\n\nMitochondria make ATP.\n";
const CARD_TEXT = "---\ncard_id: recall\nitem_type: card\ndeck: Biology\n---\n\n## Front\nWhat controls what enters the cell?\n\n## Back\nThe membrane, because it is selectively permeable.\n";

async function setup() {
  const app = makeApp([{ path: "Cards/recall.md", noFm: true, fm: { card_id: "recall", item_type: "card", deck: "Biology" }, text: CARD_TEXT }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.cards.reviewLimit = 1;
  obsidian.notices.length = 0;
  return { app, plugin };
}

test("source recall: finds an anchored selection across source line wraps", () => {
  const range = S.findQuoteRange(SOURCE_TEXT, "The membrane is selectively permeable.");
  assert.ok(range);
  assert.equal(range.from.line, 2);
  assert.equal(range.to.line, 3);
  assert.equal(SOURCE_TEXT.slice(range.start, range.end), "The membrane is\nselectively permeable.");
  assert.equal(S.findQuoteRange(SOURCE_TEXT, "not in this note"), null);
});

test("source recall: stores the passage, heading and nearby context", () => {
  const anchor = S.buildSourceRecall({
    text: SOURCE_TEXT,
    selection: "selectively permeable",
    line: 3,
    cache: { headings: [{ heading: "Cell", position: { start: { line: 0 } } }] },
  });
  assert.equal(anchor.quote, "selectively permeable");
  assert.equal(anchor.heading, "Cell");
  assert.match(anchor.context, /The membrane is/);
  assert.ok(anchor.range);
  const parts = S.splitSourceContext(anchor.context, anchor.quote);
  assert.equal(parts.match, "selectively permeable");
  assert.match(parts.before, /The membrane is/);
  assert.match(parts.after, /Mitochondria make ATP/);
});

test("source recall: the quote and context survive a card note", () => {
  const made = cards.cardNote({
    deck: "Biology",
    front: "What controls what enters the cell?",
    back: "The membrane.",
    sourceNote: "Notes/lecture.md",
    sourceHeading: "Cell",
    sourceQuote: "selectively permeable",
    sourceContext: "The membrane is selectively permeable.",
  });
  assert.match(made.text, /source_quote: "selectively permeable"/);
  assert.match(made.text, /source_context: "The membrane is selectively permeable\."/);
  const source = T.provenance.sourceOf({
    source_note: "Notes/lecture.md",
    source_heading: "Cell",
    source_quote: "selectively permeable",
    source_context: "The membrane is selectively permeable.",
  });
  assert.equal(source.quote, "selectively permeable");
  assert.equal(source.context, "The membrane is selectively permeable.");
  assert.equal(source.heading, "Cell");
});

test("source recall: the command is registered and refuses an empty selection", async () => {
  const { app, plugin } = await setup();
  const file = app.files[0];
  app.workspace.getActiveFile = () => file;
  app.workspace.activeEditor = {
    file,
    editor: {
      getSelection: () => "",
      getValue: () => file.text,
      getCursor: () => ({ line: 0, ch: 0 }),
    },
  };
  assert.ok(plugin.commands.some((command) => command.id === "source-recall"));
  assert.equal(plugin.openSourceRecall(), null);
  assert.ok(obsidian.notices.some((message) => /Select the source text/.test(message)));
});

test("cards view: a recall shows its highlighted source passage and opens it in context", async () => {
  const note = {
    path: "Cards/recall.md",
    noFm: true,
    fm: {
      card_id: "recall",
      item_type: "card",
      deck: "Biology",
      source_note: "Notes/lecture.md",
      source_heading: "Cell",
      source_quote: "selectively permeable",
      source_context: "The membrane is selectively permeable. Mitochondria make ATP.",
    },
    text: CARD_TEXT,
  };
  const { app, plugin } = await setup();
  app.files[0] = note;
  const card = plugin.getCards()[0];
  let opened = null;
  plugin.openSource = async (fm, path, quote) => {
    opened = { fm, path, quote };
    return true;
  };
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  await view.reviewCard(card);
  await dom.click("Show answer");
  assert.ok(dom.texts().includes("Source passage"));
  assert.ok(dom.texts().some((text) => text === "selectively permeable"));
  assert.ok(dom.texts().some((text) => /The membrane is/.test(text)));
  await dom.click("Review in context");
  assert.equal(opened.quote, "selectively permeable");
  assert.equal(opened.path, "Cards/recall.md");
});

test("source recall: the card dialog prefills the passage and writes the anchor", async () => {
  const { app, plugin } = await setup();
  const dom = makeDom();
  const done = [];
  const modal = new T.CardModal(
    app,
    plugin,
    {
      deck: "Biology",
      sourceNote: "Notes/lecture.md",
      sourceHeading: "Cell",
      sourceQuote: "selectively permeable",
      sourceContext: "The membrane is selectively permeable.",
      front: "",
      back: "selectively permeable",
    },
    (result) => done.push(result)
  );
  modal.contentEl = dom.root;
  modal.close = () => {};
  modal.onOpen();
  assert.ok(dom.texts().includes("New source-anchored recall"));
  assert.ok(dom.texts().includes("Source anchor"));
  const areas = dom.all.filter((item) => item.meta && item.meta.tag === "textarea");
  assert.equal(areas[1].value, "selectively permeable");
  areas[0].value = "What controls what enters the cell?";
  await dom.click("Create card");
  assert.equal(done.length, 1);
  const made = app.created.at(-1).text;
  assert.match(made, /source_note: "Notes\/lecture.md"/);
  assert.match(made, /source_heading: "Cell"/);
  assert.match(made, /source_quote: "selectively permeable"/);
  assert.match(made, /source_context: "The membrane is selectively permeable\."/);
});

test("plugin: opening a source selects the anchored passage", async () => {
  const { app, plugin } = await setup();
  const sourceFile = {
    path: "Notes/lecture.md",
    basename: "lecture",
    extension: "md",
    parent: { path: "Notes" },
    fm: {},
    text: SOURCE_TEXT,
    headings: [],
  };
  app.files.push(sourceFile);
  let opened = null;
  let selected = null;
  let scrolled = null;
  app.workspace.openLinkText = async (target, from, newLeaf) => {
    opened = { target, from, newLeaf };
    app.workspace.activeEditor = {
      file: sourceFile,
      editor: {
        getValue: () => SOURCE_TEXT,
        setSelection: (from, to) => (selected = { from, to }),
        scrollIntoView: (at) => (scrolled = at),
      },
    };
  };
  const handled = await plugin.openSource({ source_note: "Notes/lecture.md" }, "Cards/recall.md", "selectively permeable");
  assert.equal(handled, true);
  assert.equal(opened.target, "Notes/lecture.md");
  assert.equal(selected.from.line, 3);
  assert.equal(selected.from.ch, 0);
  assert.equal(selected.to.line, 3);
  assert.equal(scrolled.line, 3);
});
