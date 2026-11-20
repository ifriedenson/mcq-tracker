"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const fs = require("node:fs");
const path = require("node:path");
const { T, Plugin: QT } = load();

const CARD = (name, front, back, extra) => ({
  path: `Cards/${name}.md`,
  fm: { card_id: name, item_type: "card", deck: "Bio", ...(extra || {}) },
  body: { front, back },
  text: `---\ncard_id: ${name}\nitem_type: card\ndeck: Bio\n---\n\n## Front\n${front}\n\n## Back\n${back}\n`,
});

async function setup(notes) {
  const app = makeApp(notes);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const dom = makeDom();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  return { app, plugin, dom, view };
}

/* ---------------------------------------------------------------- #3 triage */

test("follow-ups: the flashcards view offers a Needs review filter with reasons", async () => {
  const { dom, view } = await setup([
    CARD("a", "Powerhouse of the cell", "mitochondria"),
    CARD("b", "powerhouse of the cell", "mitochondria"),
    CARD("c", "What is osmosis?", "water moving across a membrane"),
  ]);
  view.render();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(dom.texts().some((text) => /Needs review 2/.test(text)));
  await dom.click("Needs review 2");
  assert.ok(view.triageOnly, "the filter turns the triage list on");
  assert.ok(dom.texts().some((text) => /Same front as another flashcard/.test(text)));
  assert.ok(dom.texts().some((text) => /2 flashcards to review/.test(text)));
});

test("follow-ups: the quality and health commands are real palette commands", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "plugin.js"), "utf8");
  assert.match(source, /id: "check-import-health", name: "Check import folder health[^"]*", callback: \(\) => this\.checkImportHealth\(\)/);
  assert.match(source, /id: "review-card-quality", name: "Review flashcard quality", callback: \(\) => this\.activateCards\(\{ triage: true \}\)/);
});

/* ---------------------------------------------------------------- #5 bulk */

test("follow-ups: bulk tag writes the course on every selected card and leaves the rest", async () => {
  const { app, plugin } = await setup([CARD("a", "one", "1"), CARD("b", "two", "2")]);
  const cards = plugin.getCards();
  const changed = await plugin.setCardsCourse([cards[0]], "Biology");
  assert.equal(changed, 1);
  const first = app.files.find((file) => file.path === "Cards/a.md");
  assert.equal(first.fm.course, "Biology");
  const second = app.files.find((file) => file.path === "Cards/b.md");
  assert.notEqual(second.fm.course, "Biology");
});

test("follow-ups: bulk delete trashes every selected card and reports the count", async () => {
  const { app, plugin } = await setup([CARD("a", "one", "1"), CARD("b", "two", "2")]);
  const trashed = [];
  app.fileManager = { trashFile: async (file) => trashed.push(file.path) };
  const cards = plugin.getCards();
  const removed = await plugin.deleteCardsWithUndo(cards, () => {});
  assert.equal(removed, 2);
  assert.deepEqual(trashed.sort(), ["Cards/a.md", "Cards/b.md"]);
});

/* ---------------------------------------------------------------- #7 health */

test("follow-ups: import health names a missing source and re-links the notes", async () => {
  const app = makeApp([
    { path: "Questions/Q01.md", fm: { question_id: "Q01", answer: "B", source_pdf: "Questions/Unit 1/source.pdf" } },
    { path: "Questions/Q02.md", fm: { question_id: "Q02", answer: "C", source_pdf: "Questions/Unit 1/source.pdf" } },
  ]);
  app.files.push({ path: "Questions/Unit 1/moved.pdf", text: "" });
  const plugin = new QT(app);
  await plugin.onload();
  const report = await plugin.checkImportHealth();
  assert.equal(report.missing.length, 1);
  assert.equal(report.missing[0].source, "Questions/Unit 1/source.pdf");
  assert.equal(report.missing[0].count, 2);
  await assert.rejects(() => plugin.relinkImportSource(report.missing[0].source, "Questions/nowhere.pdf"), /in the vault/);
  const changed = await plugin.relinkImportSource(report.missing[0].source, "Questions/Unit 1/moved.pdf");
  assert.equal(changed, 2, "every note that stamped the old path is re-pointed");
  assert.equal(app.files.find((file) => file.path === "Questions/Q01.md").fm.source_pdf, "Questions/Unit 1/moved.pdf");
  assert.equal(app.files.find((file) => file.path === "Questions/Q02.md").fm.source_pdf, "Questions/Unit 1/moved.pdf");
});

test("follow-ups: import health is quiet when every source is present", async () => {
  const app = makeApp([{ path: "Questions/Q01.md", fm: { question_id: "Q01", answer: "B", source_pdf: "s.pdf" } }]);
  app.files.push({ path: "s.pdf", text: "" });
  const plugin = new QT(app);
  await plugin.onload();
  const report = await plugin.checkImportHealth();
  assert.deepEqual(report.missing, []);
});

/* ---------------------------------------------------------------- #6 exam */

test("follow-ups: missed test questions become flashcards with the source stamped", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const made = await plugin.createCardsFromMissed(
    [
      { file: { path: "Questions/Q01.md" }, fm: { question: "What is 2+2?", answer: "4", course: "Math" }, correct: false, answered: true, mode: "mcq" },
      { file: { path: "Questions/Q02.md" }, fm: { question: "What is 3+3?", answer: "6", course: "Math" }, correct: false, answered: true, mode: "mcq" },
    ],
    { deck: "Test misses" }
  );
  assert.equal(made, 2);
  const created = app.files.filter((file) => /Cards|Test misses/i.test(file.path));
  assert.ok(created.length >= 2, "two card notes were written");
  assert.match(created[0].text, /import_source: "Questions\/Q01\.md"/);
});

/* ---------------------------------------------------------------- #10 settings */

test("follow-ups: reset to recommended turns modules back on without touching notes", async () => {
  const app = makeApp([CARD("a", "one", "1")]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.mcqEnabled = false;
  plugin.settings.scheduler = "fsrs";
  plugin.settings.cards.enabled = false;
  const ok = await plugin.resetRecommendedSettings();
  assert.equal(ok, true);
  assert.equal(plugin.settings.mcqEnabled, true);
  assert.equal(plugin.settings.scheduler, "ladder");
  assert.equal(plugin.settings.cards.enabled, true);
  assert.equal(app.files.length, 1, "no note was written or removed");
});

/* ---------------------------------------------------------------- #2 summary */

test("follow-ups: the import summary counts silent skips and offers Retry skipped", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  let reopened = 0;
  plugin.openPdfImport = () => reopened++;
  const modal = new T.ImportCompleteModal(app, plugin, {
    folder: "Questions",
    results: [
      { name: "good.pdf", folder: "Questions", made: 3, skipped: [], error: "" },
      { name: "empty.pdf", folder: "Questions", made: 0, skipped: ["No questions found"], error: "" },
    ],
  });
  const dom = makeDom();
  modal.contentEl = dom.root;
  modal.render();
  const text = dom.texts().join("\n");
  assert.match(text, /3 question notes imported from 1 file/);
  assert.match(text, /1 file produced no notes/);
  assert.match(text, /Retry skipped \(1\)/);
  assert.equal(reopened, 0, "opening the importer is a user action, never a side effect");
});
