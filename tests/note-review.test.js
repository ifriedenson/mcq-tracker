"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const N = T.noteReview;

function note(path, fm) {
  return {
    file: { path, basename: path.replace(/^.*\//, "").replace(/\.md$/, "") },
    fm: fm || {},
  };
}

test("note review: parses note sets from one line per set", () => {
  const sets = N.parseNoteSets("Class notes | Notes, Lectures | review, exam | high\nEverything | | | low");
  assert.deepEqual(sets[0], { name: "Class notes", folders: ["Notes", "Lectures"], tags: ["review", "exam"], priority: "high" });
  assert.deepEqual(sets[1], { name: "Everything", folders: [], tags: [], priority: "low" });
  assert.equal(N.formatNoteSets(sets), "Class notes | Notes, Lectures | review, exam | high\nEverything |  |  | low");
});

test("note review: queue honours sets, priority, due dates and excludes question notes", () => {
  const today = "2026-10-30";
  const notes = [
    note("Notes/High.md", { tags: ["review"], note_review_priority: "high" }),
    note("Notes/Due.md", { tags: ["review"], attempts: 3, next_review: "2026-10-29" }),
    note("Notes/Later.md", { tags: ["review"], attempts: 2, next_review: "2026-11-20" }),
    note("Notes/Other.md", { tags: ["other"] }),
    note("Questions/Q1.md", { question_id: "Q1", tags: ["review"] }),
    note("Cards/C1.md", { card_id: "C1", tags: ["review"] }),
  ];
  const sets = [{ name: "Review", folders: ["Notes"], tags: ["review"], priority: "normal" }];
  const queue = N.buildNoteQueue(notes, { sets, today, limit: 10 });
  assert.deepEqual(queue.items.map((row) => row.path), ["Notes/High.md", "Notes/Due.md"]);
  assert.equal(queue.counts.due, 2);
  assert.equal(queue.counts.new, 1);
});

test("note review: an empty set list falls back to explicitly marked notes", () => {
  const queue = N.buildNoteQueue(
    [note("A.md", { note_review: true }), note("B.md", {}), note("Q.md", { question_id: "Q", note_review: true })],
    { sets: [], today: "2026-10-30", limit: 10 }
  );
  assert.deepEqual(queue.items.map((row) => row.path), ["A.md"]);
});

test("note review: ratings map to the existing attempt shape", () => {
  const again = N.noteReviewAttempt("again", 12);
  assert.deepEqual(again, { grade: "again", chosen: "again", correct: false, conf: 0, seconds: 12, now: again.now });
  const good = N.noteReviewAttempt("good", 20);
  assert.equal(good.correct, true);
  assert.equal(good.conf, 2);
  assert.equal(N.noteReviewAttempt("easy", 5).conf, 3);
});

test("note review: the command and queue are registered and record through applyAttempt", async () => {
  const app = makeApp([{ path: "Notes/Unit 1.md", fm: { question_id: undefined, tags: ["review"] }, text: "# Unit 1\n\nA whole note." }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.noteReview = {
    enabled: true,
    limit: 20,
    sets: [{ name: "Review", folders: ["Notes"], tags: ["review"], priority: "normal" }],
  };
  assert.ok(plugin.commands.some((command) => command.id === "review-notes"));
  assert.equal(plugin.getNoteQueue({ limit: 0 }).counts.due, 1);
  const summary = await plugin.recordNoteReview(app.files[0], "good", 30);
  assert.equal(summary.attempts, 1);
  assert.ok(summary.nextReview);
  assert.equal(app.files[0].fm.attempts, 1);
  assert.equal(app.files[0].fm.result, "correct");
  await plugin.setNotePriority(app.files[0], "high");
  assert.equal(app.files[0].fm.note_review_priority, "high");
});
