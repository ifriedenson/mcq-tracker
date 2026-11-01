"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const D = T.noteReviewDock;
const N = T.noteReview;

function note(path, fm) {
  return { file: { path, basename: path.replace(/^.*\//, "").replace(/\.md$/i, "") }, fm: fm || {} };
}

test("docked review previews use the exact applyAttempt next date for every rating", () => {
  const now = new Date(2026, 10, 1, 9, 0, 0);
  const fm = { attempts: 0, history: [], intervals: [1, 3, 7, 21] };
  const settings = { scheduler: "ladder", intervals: [1, 3, 7, 21], fsrsRetention: 0.9 };
  const previews = D.noteReviewPreviews(fm, settings, now);
  for (const grade of D.GRADES) {
    const copy = JSON.parse(JSON.stringify(fm));
    const direct = T.applyAttempt(copy, N.noteReviewAttempt(grade, 0, now), settings.intervals, {
      scheduler: "ladder",
      fsrsRetention: 0.9,
      grade,
    });
    assert.equal(previews[grade].nextReview, direct.nextReview, grade);
    assert.ok(previews[grade].label, grade);
    assert.ok(previews[grade].days >= 0, grade);
  }
});

test("docked review interval previews expose the scheduler's exact intervals", () => {
  const now = new Date(2026, 10, 1, 9, 0, 0);
  const previews = D.noteReviewPreviews({ attempts: 0, history: [] }, { scheduler: "ladder", intervals: [1, 3, 7, 21] }, now);
  assert.equal(previews.again.days, 1);
  assert.equal(previews.hard.days, 2);
  assert.equal(previews.good.days, 1);
  assert.equal(previews.easy.days, 3);
  assert.equal(previews.easy.label, "3d");
});

test("keyboard mapping accepts 0-5 and ignores unrelated keys", () => {
  assert.equal(D.gradeForKey("1", "ladder"), "again");
  assert.equal(D.gradeForKey("2", "ladder"), "hard");
  assert.equal(D.gradeForKey("3", "ladder"), "good");
  assert.equal(D.gradeForKey("4", "ladder"), "easy");
  assert.equal(D.gradeForKey("5", "ladder"), "easy");
  assert.equal(D.gradeForKey("0", "ladder"), "again");
  assert.equal(D.gradeForKey("0", "sm2"), "again");
  assert.equal(D.gradeForKey("3", "sm2"), "hard");
  assert.equal(D.gradeForKey("5", "sm2"), "easy");
  assert.equal(D.gradeForKey("x", "ladder"), "");
});

test("snapshot and restore preserve history, scheduler state and lapse counters", () => {
  const fm = {
    history: ["2026-10-01|correct|20|B|2||q1|"],
    attempts: 4,
    correct_count: 3,
    streak: 2,
    next_review: "2026-11-02",
    srs: "fsrs|1|2|3",
    last_card_rating: "good",
    note_lapse_streak: 1,
  };
  const snap = D.noteReviewSnapshot(fm);
  fm.history.push("2026-11-01|incorrect|5|A|0||q1|");
  fm.attempts = 99;
  fm.next_review = "2027-01-01";
  delete fm.srs;
  D.restoreNoteReviewSnapshot(fm, snap);
  assert.equal(fm.attempts, 4);
  assert.equal(fm.next_review, "2026-11-02");
  assert.equal(fm.srs, "fsrs|1|2|3");
  assert.equal(fm.history.length, 1);
  assert.equal(fm.note_lapse_streak, 1);
});

test("lapse actions reset, rest, remove and carry on without touching history", () => {
  const now = new Date(2026, 10, 1);
  const reset = { attempts: 5, history: ["x"], srs: "fsrs|1", next_review: "2026-11-03", note_lapse_streak: 8 };
  D.applyLapseAction(reset, "reset", now);
  assert.equal(reset.srs, undefined);
  assert.equal(reset.next_review, "2026-11-01");
  assert.equal(reset.attempts, 5);
  assert.deepEqual(reset.history, ["x"]);

  const rest = { next_review: "2026-11-01", note_lapse_streak: 8 };
  D.applyLapseAction(rest, "rest", now);
  assert.equal(rest.next_review, "2026-11-08");
  assert.equal(rest.note_lapse_streak, 0);

  const remove = { next_review: "2026-11-01", note_lapse_streak: 8 };
  D.applyLapseAction(remove, "remove", now);
  assert.equal(remove.note_review_excluded, true);
  assert.equal(remove.next_review, "");

  const carry = { next_review: "2026-11-01", note_lapse_streak: 8 };
  D.applyLapseAction(carry, "carry", now);
  assert.equal(carry.next_review, "2026-11-01");
  assert.equal(carry.note_lapse_streak, 0);
  assert.equal(D.lapseThresholdReached({ note_lapse_streak: 8 }, 8), true);
});

test("an explicitly marked note joins a queue even when sets exist", () => {
  const set = { name: "Review", folders: ["Notes"], tags: [], priority: "normal" };
  const queue = N.buildNoteQueue([note("Other/Marked.md", { note_review: true }), note("Notes/InSet.md", {})], {
    sets: [set],
    today: "2026-11-01",
    limit: 10,
  });
  assert.deepEqual(queue.all.map((row) => row.path).sort(), ["Notes/InSet.md", "Other/Marked.md"]);
});

test("grade layout and session-report settings normalize safely", () => {
  assert.equal(D.normalizeNoteReviewDockSettings({}).gradeLayout, "auto");
  assert.equal(D.normalizeNoteReviewDockSettings({ gradeLayout: "stacked" }).gradeLayout, "stacked");
  assert.equal(D.normalizeNoteReviewDockSettings({ gradeLayout: "nope" }).gradeLayout, "auto");
  assert.equal(D.normalizeNoteReviewDockSettings({}).reportEnabled, false);
  assert.equal(D.normalizeNoteReviewDockSettings({ reportEnabled: true, reportFolder: " Reports/ " }).reportFolder, "Reports");
});

test("the dock exposes the configured grade layout to CSS", () => {
  const { makeDom } = require("./helpers/fake");
  const dom = makeDom();
  const plugin = {
    settings: { scheduler: "ladder", intervals: [1, 3, 7, 21], fsrsRetention: 0.9, noteReviewDock: { enabled: true, gradeLayout: "stacked" } },
    noteReviewDockEnabled: () => true,
  };
  const dock = new D.NoteReviewDock(plugin);
  dock.render(
    { containerEl: dom.root },
    { path: "Notes/A.md", title: "A", set: "Set", isNew: false, dueDate: "2026-11-01", note: { fm: { attempts: 0, history: [] } } },
    {}
  );
  const bar = dom.all.find((element) => element.meta && element.meta.cls === "qt-note-review-dock");
  assert.ok(bar);
  assert.equal(bar.meta.attrs["data-grade-layout"], "stacked");
});
