"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { Plugin } = load();

test("study data caps report the oldest record they drop", async () => {
  const plugin = new Plugin(makeApp([]));
  await plugin.onload();
  const lectures = Array.from({ length: 300 }, (_, i) => ({
    id: `lecture-${i}`,
    course: "Biology",
    date: "2026-01-01",
    title: `Lecture ${i}`,
  }));
  plugin.settings.lectureLog = { enabled: true, lectures };
  obsidian.notices.length = 0;
  const added = await plugin.addStudyLecture({ course: "Biology", date: "2026-01-02", title: "New lecture" });
  assert.ok(added);
  assert.equal(plugin.settings.lectureLog.lectures.length, 300);
  assert.equal(plugin.settings.lectureLog.lectures[299].title, "New lecture");
  assert.ok(obsidian.notices.some((message) => /Lecture log keeps the newest 300 records; removed 1 older record/.test(message)));
});

test("reading library caps report the oldest book they drop", async () => {
  const plugin = new Plugin(makeApp([]));
  await plugin.onload();
  const books = Array.from({ length: 300 }, (_, i) => ({
    id: `book-${i}`,
    title: `Book ${i}`,
    totalPages: 100,
    currentPage: 0,
    status: "want",
  }));
  plugin.settings.readingLibrary = { enabled: true, books };
  obsidian.notices.length = 0;
  const added = await plugin.addReadingBook({ title: "New book", totalPages: 100 });
  assert.ok(added);
  assert.equal(plugin.settings.readingLibrary.books.length, 300);
  assert.equal(plugin.settings.readingLibrary.books[299].title, "New book");
  assert.ok(obsidian.notices.some((message) => /Reading library keeps the newest 300 records; removed 1 older record/.test(message)));
});
