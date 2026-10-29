"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const extract = T.cardsExtract;

const NOTE = [
  "---",
  "flashcards: true",
  "---",
  "# Cell biology",
  "",
  "## Question",
  "What is the powerhouse of the cell?",
  "",
  "## Answer",
  "The mitochondrion.",
  "",
  "- Photosynthesis: the process plants use to make sugar.",
  "- Osmosis — movement of water across a membrane.",
  "",
  "| Term | Definition |",
  "| --- | --- |",
  "| Mitosis | Cell division |",
  "| Meiosis | Division that makes gametes |",
  "",
  "The mitochondrion is the ==powerhouse== of the cell.",
  "Water {{c1::freezes}} at zero Celsius.",
  "",
  "```",
  "Fake: this code is not a card.",
  "```",
].join("\n");

async function setup(notes) {
  const app = makeApp(notes);
  // The fake vault adds a question_id to every note unless told not to; copy
  // the explicit frontmatter back so lecture notes can carry flashcards flags.
  notes.forEach((n, i) => {
    if (n.noFm && n.fm) app.files[i].fm = { ...n.fm };
  });
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  obsidian.notices.length = 0;
  return { app, plugin };
}

test("extract: headings, definitions, tables and cloze marks become cards", () => {
  const result = extract.extractCardsFromMarkdown(NOTE, { sourcePath: "Courses/Bio/lecture.md", deck: "Biology", course: "BIOL 201" });
  assert.equal(result.cards.length, 7);
  assert.equal(result.cards[0].front, "What is the powerhouse of the cell?");
  assert.equal(result.cards[0].back, "The mitochondrion.");
  assert.ok(result.cards.some((c) => c.front === "Photosynthesis" && c.back.includes("make sugar")));
  assert.ok(result.cards.some((c) => c.front === "Osmosis" && c.back.includes("water")));
  assert.ok(result.cards.some((c) => c.front === "Mitosis" && c.back === "Cell division"));
  assert.ok(result.cards.some((c) => c.front === "Meiosis" && c.back.includes("gametes")));
  const cloze = result.cards.filter((c) => c.cardType === "cloze");
  assert.equal(cloze.length, 2);
  assert.ok(cloze.some((c) => c.front.includes("[…]") && c.back === "powerhouse"));
  assert.ok(cloze.some((c) => c.front.includes("Water [") && c.back === "freezes"));
  assert.ok(result.cards.every((c) => c.importFormat === "outline" && c.deck === "Biology" && c.course === "BIOL 201"));
  assert.ok(result.cards.every((c) => c.importKey.startsWith("outline:")));
  assert.equal(result.cards.some((c) => c.front.includes("Fake")), false);
});

test("extract: duplicate pairs are removed, and code and frontmatter are ignored", () => {
  const text = [
    "---",
    "flashcards: true",
    "---",
    "## Front",
    "Alpha",
    "## Back",
    "One",
    "## Front",
    "Alpha",
    "## Back",
    "One",
    "## Question",
    "Beta?",
    "## Answer",
    "Two.",
    "```",
    "Gamma: not a card",
    "```",
  ].join("\n");
  const result = extract.extractCardsFromMarkdown(text, { sourcePath: "note.md" });
  assert.equal(result.cards.length, 2);
  assert.deepEqual(result.cards.map((c) => c.front), ["Alpha", "Beta?"]);
  assert.equal(result.cards.some((c) => c.front === "Gamma"), false);
});

test("extract: flashcardsFlag distinguishes opt-in, opt-out and unset notes", () => {
  assert.equal(extract.flashcardsFlag({ flashcards: true }), true);
  assert.equal(extract.flashcardsFlag({ flashcards: "yes" }), true);
  assert.equal(extract.flashcardsFlag({ flashcards: false }), false);
  assert.equal(extract.flashcardsFlag({ flashcards: "no" }), false);
  assert.equal(extract.flashcardsFlag({}), null);
});

test("plugin: previews and extracts cards from a note, then stamps the opt-in", async () => {
  const notes = [
    { path: "Courses/Bio/lecture.md", noFm: true, fm: {}, text: NOTE },
    { path: "Courses/Bio/blocked.md", noFm: true, fm: { flashcards: false }, text: "Mitochondria: the powerhouse." },
  ];
  const { app, plugin } = await setup(notes);
  const preview = await plugin.previewNoteCards("Courses/Bio/lecture.md", { deck: "Biology", course: "BIOL 201" });
  assert.equal(preview.blocked, undefined);
  assert.equal(preview.cards.length, 7);
  assert.equal(preview.deck, "Biology");
  assert.equal(preview.course, "BIOL 201");
  assert.equal(app.created, undefined, "preview writes nothing");

  const result = await plugin.extractCardsFromNote("Courses/Bio/lecture.md", { deck: "Biology", course: "BIOL 201" });
  assert.equal(result.created, 7);
  assert.equal(app.created.length, 7);
  assert.match(app.created[0].text, /import_format: "outline"/);
  assert.match(app.created[0].text, /import_source: "Courses\/Bio\/lecture.md"/);
  assert.match(app.created[0].text, /deck: "Biology"/);
  assert.match(app.created[0].text, /course: "BIOL 201"/);
  assert.equal(app.files.find((f) => f.path === "Courses/Bio/lecture.md").fm.flashcards, true);

  const blocked = await plugin.previewNoteCards("Courses/Bio/blocked.md");
  assert.equal(blocked.blocked, true);
  assert.match(blocked.reason, /flashcards: false/);
  const attempted = await plugin.extractCardsFromNote("Courses/Bio/blocked.md");
  assert.equal(attempted.created, 0);
  assert.match(attempted.errors[0], /flashcards: false/);
});

test("plugin: practice this note only limits the filtered pool and clears normally", async () => {
  const notes = [
    { path: "Questions/a.md", fm: { question_id: "a" } },
    { path: "Questions/b.md", fm: { question_id: "b" } },
  ];
  const { app, plugin } = await setup(notes);
  const view = { next: async () => {} };
  plugin.activateView = async () => view;
  await plugin.practiceNote("Questions/a.md");
  assert.equal(plugin.settings.practicePath, "Questions/a.md");
  assert.deepEqual(plugin.filtered(plugin.getQuestions()).map((q) => q.file.path), ["Questions/a.md"]);
  await plugin.practiceWith({}, "smart");
  assert.equal(plugin.settings.practicePath, "");
  assert.equal(plugin.filtered(plugin.getQuestions()).length, 2);
});
