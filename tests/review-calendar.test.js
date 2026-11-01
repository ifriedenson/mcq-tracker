"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const C = T.reviewCalendar;

function note(path, fm) {
  return { file: { path, basename: path.replace(/^.*\//, "").replace(/\.md$/i, "") }, fm: fm || {} };
}

test("workload estimate folds overdue work into today and uses the configured minutes", () => {
  const notes = [
    note("Notes/New.md", { tags: ["review"] }),
    note("Notes/Overdue.md", { tags: ["review"], attempts: 2, next_review: "2026-10-28" }),
    note("Notes/Future.md", { tags: ["review"], attempts: 1, next_review: "2026-11-03" }),
  ];
  const cards = [
    { file: { path: "Cards/One.md", basename: "One" }, fm: { next_review: "2026-10-30", attempts: 3 }, deck: "Deck" },
  ];
  const data = C.buildReviewForecast({
    notes,
    cards,
    today: "2026-11-01",
    days: 7,
    settings: { noteMinutes: 1.5, cardMinutes: 2, showCards: true },
    sets: [{ name: "Review", folders: ["Notes"], tags: ["review"], priority: "normal" }],
  });
  assert.equal(data.overdue, 2);
  assert.equal(data.next7.days[0].total, 3);
  assert.equal(data.next7.days[0].minutes, 5);
  assert.equal(data.next7.days[2].total, 1);
  assert.equal(data.next7.minutes, 6.5);
  assert.equal(data.totals.notes, 3);
  assert.equal(data.totals.cards, 1);
  assert.equal(C.workloadLabel(0), "no work");
  assert.equal(C.workloadLabel(95), "1 h 35 min");
});

test("calendar cells include leading and trailing days across a month boundary", () => {
  const cells = C.calendarCells({ days: [] }, 2026, 10, "monday", new Date(2026, 10, 1));
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0].key, "2026-10-26");
  assert.equal(cells.find((cell) => cell.key === "2026-11-01").inMonth, true);
  assert.equal(cells.find((cell) => cell.key === "2026-11-01").isToday, true);
  assert.equal(cells[cells.length - 1].key, "2026-12-06");
});

test("main-note detection picks the note with the most outgoing links, then the path", () => {
  const main = C.pickMainNote([
    { path: "Course/Intro.md", links: ["a", "b"] },
    { path: "Course/Home.md", links: ["a", "b", "c"] },
    { path: "Course/Empty.md", links: [] },
  ]);
  assert.equal(main.path, "Course/Home.md");
  assert.equal(main.links, 3);
  const tie = C.pickMainNote([{ path: "B.md", links: 1 }, { path: "A.md", links: 1 }]);
  assert.equal(tie.path, "A.md");
});

test("plugin registers the new views, commands and settings modules", async () => {
  const app = makeApp([{ path: "Notes/Unit.md", fm: { question_id: undefined, tags: ["review"] }, text: "# Unit\n\nA note." }]);
  const plugin = new QT(app);
  await plugin.onload();
  assert.ok(plugin.views["question-tracker-review-calendar"]);
  assert.ok(plugin.views["question-tracker-study-stats"]);
  assert.ok(plugin.views["question-tracker-local-events"]);
  const ids = plugin.commands.map((command) => command.id);
  for (const id of ["open-review-calendar", "review-calendar-add-note", "review-calendar-add-folder", "open-study-stats", "open-local-events", "new-local-event", "open-next-due-note"]) {
    assert.ok(ids.includes(id), id);
  }
  assert.ok(T.SETTINGS_MODULES.some((module) => module.id === "note-review"));
  assert.ok(T.SETTINGS_MODULES.some((module) => module.id === "review-calendar"));
  assert.ok(T.SETTINGS_MODULES.some((module) => module.id === "study-stats"));
  assert.ok(T.SETTINGS_MODULES.some((module) => module.id === "local-events"));
});

test("adding a folder deduplicates sets and keeps the existing one", () => {
  const first = C.addFolderSet([], "Course", "Course notes");
  assert.equal(first.added, true);
  assert.equal(first.sets[0].folders[0], "Course");
  const second = C.addFolderSet(first.sets, "Course", "Another name");
  assert.equal(second.added, false);
  assert.equal(second.sets.length, 1);
});
