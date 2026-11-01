"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const L = T.readingLibrary;

async function setup(saved) {
  const plugin = new QT(makeApp([]));
  if (saved) plugin.saved = saved;
  await plugin.onload();
  return plugin;
}

test("reading library: shelves, progress, finishing and quotes", () => {
  const book = L.createBook({ id: "b1", title: "Deep Work", author: "Cal Newport", totalPages: 300, status: "want", today: "2026-11-01" });
  assert.equal(book.status, "want");
  assert.deepEqual(L.bookProgress(book), { known: true, percent: 0, pagesLeft: 300 });

  const started = L.updateBook([book], "b1", { status: "reading" }, "2026-11-02");
  assert.equal(started[0].status, "reading");
  assert.equal(started[0].startedOn, "2026-11-02");

  const advanced = L.updateBook(started, "b1", { currentPage: 120 }, "2026-11-03");
  assert.deepEqual(L.bookProgress(advanced[0]), { known: true, percent: 40, pagesLeft: 180 });

  const finished = L.updateBook(advanced, "b1", { status: "finished", rating: 5 }, "2026-11-04");
  assert.equal(finished[0].status, "finished");
  assert.equal(finished[0].currentPage, 300);
  assert.equal(finished[0].finishedOn, "2026-11-04");

  const withQuote = L.addQuote(finished, "b1", { text: "Focus is the new IQ.", page: 42, seed: 1 }, "2026-11-05");
  assert.ok(withQuote.quote);
  assert.equal(withQuote.books[0].quotes.length, 1);
  assert.equal(L.quoteRows(withQuote.books)[0].bookTitle, "Deep Work");

  const summary = L.librarySummary(withQuote.books, "2026-11-05");
  assert.equal(summary.finished, 1);
  assert.equal(summary.quotes, 1);
  assert.equal(summary.pagesRead, 300);
  assert.equal(summary.finishedToday, 0);
  assert.equal(L.librarySummary(withQuote.books, "2026-11-04").finishedToday, 1);
  assert.equal(summary.averageRating, 5);

  assert.equal(L.shelfBooks(withQuote.books, "all", true).length, 0);
  assert.equal(L.shelfBooks(withQuote.books, "finished", true).length, 1);
  assert.equal(L.removeQuote(withQuote.books, "b1", withQuote.quote.id)[0].quotes.length, 0);
  assert.equal(L.removeBook(withQuote.books, "b1").length, 0);
});

test("reading library: rejects a blank title, duplicate ids and bad values", () => {
  assert.equal(L.createBook({ author: "Nobody" }, "2026-11-01"), null);
  const normalized = L.normalizeLibrary({ books: [{ id: "same", title: "A" }, { id: "same", title: "B" }, { title: "" }] });
  assert.equal(normalized.books.length, 1);
  assert.equal(normalized.books[0].title, "A");
  assert.equal(normalized.enabled, true);
  assert.equal(L.normalizeLibrary({ enabled: false }).enabled, false);
  assert.equal(L.normalizeLibrary({ hideFinished: true }).hideFinished, true);
  const clamped = L.createBook({ title: "Big", totalPages: 100, currentPage: 500, rating: 9, today: "2026-11-01" });
  assert.equal(clamped.currentPage, 100);
  assert.equal(clamped.rating, 5);
});

test("plugin: book data persists, finishing celebrates and the settings page drives the shelf", async () => {
  const plugin = await setup();
  const book = await plugin.addReadingBook({ title: "Deep Work", author: "Cal Newport", totalPages: 300, status: "reading" });
  assert.ok(book);
  assert.equal(plugin.readingLibraryEnabled(), true);

  const updated = await plugin.setReadingProgress(book.id, 150);
  assert.equal(updated.currentPage, 150);
  const quote = await plugin.addReadingQuote(book.id, { text: "Focus is the new IQ.", page: 42 });
  assert.ok(quote);

  obsidian.notices.length = 0;
  const finished = await plugin.updateReadingBook(book.id, { status: "finished", rating: 5 });
  assert.equal(finished.status, "finished");
  assert.ok(obsidian.notices.some((message) => /Finished "Deep Work"/.test(message)));

  const restarted = await setup(plugin.saved);
  assert.equal(restarted.readingLibrarySettings().books.length, 1);
  assert.equal(restarted.readingLibrarySettings().books[0].quotes.length, 1);
  assert.equal(restarted.readingLibrarySettings().books[0].status, "finished");
  assert.equal(restarted.readingLibrarySettings().books[0].rating, 5);

  const page = T.studyToolSettings.STUDY_TOOL_SETTINGS_BY_ID["reading-library"].page;
  const field = page.fields.find((entry) => entry.name === "Hide finished books on the All shelf");
  await field.set(restarted, true);
  assert.equal(restarted.readingLibrarySettings().hideFinished, true);

  const view = new T.StudyWorkspaceView({ app: restarted.app }, restarted);
  assert.equal(view.settings().readingLibrary.hideFinished, true);
  assert.ok(view.enabledTabs().some((tab) => tab.id === "readingLibrary"));
  const dom = makeDom();
  view.contentEl = dom.root;
  view.setTab("readingLibrary");
  view.render();
  assert.ok(dom.texts().includes("Bookshelf"));
  assert.ok(dom.texts().some((text) => /No books on this shelf yet/.test(text)));

  const disabled = await setup({ readingLibrary: { enabled: false } });
  assert.equal(disabled.readingLibraryEnabled(), false);
  const offView = new T.StudyWorkspaceView({ app: disabled.app }, disabled);
  assert.ok(!offView.enabledTabs().some((tab) => tab.id === "readingLibrary"));
});
