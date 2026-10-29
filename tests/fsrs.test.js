"use strict";
// Optional FSRS scheduling: ratings, compact state, history migration and
// lossless switching back to the simple ladder.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const F = T.fsrs;
const NOW = new Date(2026, 9, 29, 10, 0);

test("fsrs: correctness, confidence and time map to the four FSRS grades", () => {
  assert.equal(F.gradeForAttempt(false, 3, 20, 90), F.RATING.Again);
  assert.equal(F.gradeForAttempt(true, 1, 20, 90), F.RATING.Hard);
  assert.equal(F.gradeForAttempt(true, 2, 20, 90), F.RATING.Good);
  assert.equal(F.gradeForAttempt(true, 3, 20, 0), F.RATING.Good, "no target means conservative Good");
  assert.equal(F.gradeForAttempt(true, 3, 50, 100), F.RATING.Easy);
  assert.equal(F.gradeForAttempt(true, 3, 160, 100), F.RATING.Hard, "slow correct answers are Hard");
});

test("fsrs: compact state round-trips and rejects corrupt values", () => {
  const card = F.decodeSrs(F.emptySrs(NOW));
  assert.equal(card.state, 0);
  assert.equal(card.reps, 0);
  assert.equal(F.decodeSrs("not fsrs"), null);
  assert.equal(F.decodeSrs("fsrs6|0|bad|-|0|0|0|0|0|0|0"), null);

  const scheduled = F.reviewNote({}, { correct: true, conf: 2, seconds: 20, now: NOW }, 0.9);
  const restored = F.decodeSrs(scheduled.srs);
  assert.equal(restored.reps, 1);
  assert.equal(restored.state, 2);
  assert.equal(restored.last_review.toISOString(), NOW.toISOString());
  assert.equal(restored.due.toISOString(), scheduled.due.toISOString());
});

test("fsrs: first reviews follow the reference intervals and never land today", () => {
  const again = F.reviewNote({}, { correct: false, conf: 2, seconds: 20, now: NOW }, 0.9);
  const hard = F.reviewNote({}, { correct: true, conf: 1, seconds: 20, now: NOW }, 0.9);
  const good = F.reviewNote({}, { correct: true, conf: 2, seconds: 20, now: NOW }, 0.9);
  const easy = F.reviewNote({ target_seconds: 100 }, { correct: true, conf: 3, seconds: 50, now: NOW }, 0.9);

  assert.deepEqual([again.rating, hard.rating, good.rating, easy.rating], [1, 2, 3, 4]);
  assert.deepEqual([again.days, hard.days, good.days, easy.days], [1, 2, 3, 8]);
  assert.equal(good.nextReview, "2026-11-01");
  for (const r of [again, hard, good, easy]) assert.ok(r.nextReview > "2026-10-29");
});

test("fsrs: higher desired retention schedules sooner", () => {
  const first = F.reviewNote({ target_seconds: 100 }, { correct: true, conf: 2, seconds: 50, now: NOW }, 0.9);
  const fm = { target_seconds: 100, srs: first.srs };
  const low = F.reviewNote(fm, { correct: true, conf: 2, seconds: 50, now: new Date(2026, 10, 1, 10, 0) }, 0.85);
  const high = F.reviewNote(fm, { correct: true, conf: 2, seconds: 50, now: new Date(2026, 10, 1, 10, 0) }, 0.95);
  assert.ok(low.days > high.days, `85% (${low.days}d) should be longer than 95% (${high.days}d)`);
});

test("fsrs: existing history is replayed once, then the stored state continues", () => {
  const history = [
    "2026-10-01T10:00|correct|40|A|3|",
    "2026-10-05T10:00|correct|50|A|2|",
    "2026-10-12T10:00|incorrect|80|B|2|careless",
  ];
  const fm = { target_seconds: 90, history: history.slice() };
  const first = T.applyAttempt(
    fm,
    { correct: true, chosen: "A", conf: 3, seconds: 40, now: NOW },
    [1, 3, 7],
    { scheduler: "fsrs", fsrsRetention: 0.9 }
  );
  assert.equal(first.scheduler, "fsrs");
  assert.equal(first.fsrsReplayed, 3, "three old rows seeded the state");
  assert.equal(first.fsrsError, "");
  assert.equal(fm.scheduler, "fsrs");
  assert.equal(fm.history.length, 4);
  const card = F.decodeSrs(fm.srs);
  assert.equal(card.reps, 4);
  assert.equal(card.lapses, 1);

  const second = T.applyAttempt(
    fm,
    { correct: true, chosen: "A", conf: 2, seconds: 40, now: new Date(2026, 10, 2, 10, 0) },
    [1, 3, 7],
    { scheduler: "fsrs", fsrsRetention: 0.9 }
  );
  assert.equal(second.fsrsReplayed, 0, "the saved state is reused");
  assert.equal(F.decodeSrs(fm.srs).reps, 5);
});

test("fsrs: corrupt state falls back to history instead of starting at zero", () => {
  const fm = {
    srs: "fsrs6|broken",
    history: ["2026-10-01T10:00|correct|40|A|3|", "2026-10-05T10:00|incorrect|40|B|2|"],
  };
  const r = F.reviewNote(fm, { correct: true, conf: 2, seconds: 20, now: NOW }, 0.9);
  assert.equal(r.replayed, 2);
  assert.equal(F.decodeSrs(r.srs).reps, 3);
});

test("fsrs: switching back to the ladder keeps FSRS state and resumes the old schedule", () => {
  const fm = { history: [] };
  T.applyAttempt(
    fm,
    { correct: true, chosen: "A", conf: 2, seconds: 20, now: NOW },
    [1, 3, 7],
    { scheduler: "fsrs", fsrsRetention: 0.9 }
  );
  const stored = fm.srs;
  const fsrsDue = fm.next_review;
  const summary = T.applyAttempt(
    fm,
    { correct: true, chosen: "A", conf: 2, seconds: 20, now: new Date(2026, 9, 30, 10, 0) },
    [1, 3, 7],
    { scheduler: "ladder", fsrsRetention: 0.9 }
  );
  assert.equal(summary.scheduler, "ladder");
  assert.equal(fm.srs, stored, "FSRS state is not deleted");
  assert.equal(fm.scheduler, "ladder");
  assert.notEqual(fm.next_review, fsrsDue);
  assert.equal(fm.next_review, "2026-11-02", "the ladder's second correct interval");
});

test("fsrs: recordAttempt uses the plugin's selected scheduler and writes note state", async () => {
  const app = makeApp([{ path: "Questions/q1.md", fm: { answer: "A" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.scheduler = "fsrs";
  plugin.settings.fsrsRetention = 0.9;

  const file = app.files[0];
  const summary = await plugin.recordAttempt(file, {
    correct: true,
    chosen: "A",
    conf: 2,
    seconds: 20,
    now: NOW,
  });
  assert.equal(summary.scheduler, "fsrs");
  assert.equal(file.fm.scheduler, "fsrs");
  assert.ok(file.fm.srs, "the compact FSRS state is saved");
  assert.equal(file.fm.next_review, summary.nextReview);
  assert.equal(F.decodeSrs(file.fm.srs).reps, 1);
});
