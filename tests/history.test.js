"use strict";
// Append-only review history, duplicate-safe retries and phone/desktop merges.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, NOTE_TEXT } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const H = T.history;
const NOW = new Date(2026, 9, 29, 10, 0, 0);
const LATER = new Date(2026, 9, 29, 10, 0, 30);
const ROW = "2026-10-01T10:00|correct|40|A|3||base";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("history rows keep a unique attempt id and second-level timestamp", () => {
  const fm = { history: [] };
  const summary = T.applyAttempt(fm, { correct: true, chosen: "A", conf: 2, seconds: 20, now: NOW }, [1, 3, 7], { attemptId: "a1" });
  assert.equal(summary.duplicate, undefined);
  assert.equal(fm.history.length, 1);
  const row = H.rowData(fm.history[0]);
  assert.equal(row.id, "a1");
  assert.equal(row.when, "2026-10-29T10:00:00");
  assert.equal(row.result, "correct");
});

test("appending the same attempt id twice does not add a row", () => {
  const once = H.appendHistory([ROW], "2026-10-02T10:00|incorrect|10|B|1||a1", "a1");
  const twice = H.appendHistory(once, "2026-10-02T10:00|incorrect|10|B|1||a1", "a1");
  assert.equal(once.length, 2);
  assert.equal(twice.length, 2);
  assert.equal(H.hasAttemptId(twice, "a1"), true);
});

test("mergeHistory keeps both devices' attempts and sorts them", () => {
  const phone = H.appendHistory([ROW], "2026-10-02T10:00:30|correct|20|A|2||phone-1", "phone-1");
  const desktop = H.appendHistory([ROW], "2026-10-02T10:00:00|incorrect|30|B|1||desktop-1", "desktop-1");
  const merged = H.mergeHistory(phone, desktop, [ROW]);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map((line) => H.rowData(line).id), ["base", "desktop-1", "phone-1"]);
  assert.equal(H.mergeHistory(merged, phone).length, 3, "a repeated merge is idempotent");
});

test("the same attempt replayed after another attempt is not counted twice", () => {
  const fm = { history: [] };
  T.applyAttempt(fm, { correct: true, chosen: "A", conf: 2, seconds: 20, now: NOW }, [1, 3, 7], { attemptId: "a1" });
  T.applyAttempt(fm, { correct: false, chosen: "B", conf: 2, seconds: 20, now: LATER }, [1, 3, 7], { attemptId: "a2" });
  const attempts = fm.attempts;
  const replay = T.applyAttempt(fm, { correct: true, chosen: "A", conf: 2, seconds: 20, now: NOW }, [1, 3, 7], { attemptId: "a1" });
  assert.equal(replay.duplicate, true);
  assert.equal(fm.attempts, attempts);
  assert.equal(fm.history.length, 2);
});

test("a merge from two devices can be repaired into correct counters", () => {
  const base = { attempts: 1, correct_count: 1, time_spent_total: 40, history: [ROW] };
  const phone = clone(base);
  const desktop = clone(base);
  T.applyAttempt(phone, { correct: true, chosen: "A", conf: 2, seconds: 20, now: NOW }, [1, 3, 7], { attemptId: "phone-1" });
  T.applyAttempt(desktop, { correct: false, chosen: "B", conf: 2, seconds: 30, now: LATER }, [1, 3, 7], { attemptId: "desktop-1" });
  const merged = clone(base);
  merged.history = H.mergeHistory(phone.history, desktop.history);
  const repaired = H.repairHistoryCounters(merged);
  assert.equal(repaired.changed, true);
  assert.equal(merged.attempts, 3);
  assert.equal(merged.correct_count, 2);
  assert.equal(merged.time_spent_total, 90);
  assert.equal(merged.streak, 0, "the last merged attempt was a miss");
  assert.equal(merged.result, "incorrect");
  assert.equal(merged.last_answer, "B");
  assert.equal(merged.history.length, 3);
});

test("repairing an empty history does not zero existing counters", () => {
  const fm = { attempts: 5, correct_count: 3, history: [] };
  assert.deepEqual(H.repairHistoryCounters(fm), { changed: false, attempts: 0 });
  assert.equal(fm.attempts, 5);
});

test("error tags update the matching attempt and keep its id", () => {
  const rows = ["d|incorrect|5|A|1||one", "d|incorrect|5|B|1||two"];
  const tagged = H.setAttemptErrorType(rows, "one", "careless");
  assert.equal(H.rowData(tagged[0]).error, "careless");
  assert.equal(H.rowData(tagged[0]).id, "one");
  assert.equal(H.rowData(tagged[1]).error, "");
});

test("plugin retries are idempotent even after another attempt changes last_attempt_id", async () => {
  const app = makeApp([{ path: "Questions/q1.md", fm: { answer: "A" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files[0];
  await plugin.recordAttempt(file, { correct: true, chosen: "A", conf: 2, seconds: 20, now: NOW, attemptId: "one" });
  await plugin.recordAttempt(file, { correct: false, chosen: "B", conf: 2, seconds: 20, now: LATER, attemptId: "two" });
  assert.equal(file.fm.last_attempt_id, "two");
  await plugin.recordAttempt(file, { correct: true, chosen: "A", conf: 2, seconds: 20, now: NOW, attemptId: "one" });
  assert.equal(file.fm.attempts, 2);
  assert.equal(file.fm.history.length, 2);
});

test("the repair command fixes counters from history", async () => {
  const app = makeApp([
    {
      path: "Questions/q1.md",
      fm: { answer: "A", attempts: 9, correct_count: 0, time_spent_total: 0, history: [ROW] },
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.askConfirm = async () => true;
  await plugin.repairReviewHistory();
  const fm = app.files[0].fm;
  assert.equal(fm.attempts, 1);
  assert.equal(fm.correct_count, 1);
  assert.equal(fm.time_spent_total, 40);
  assert.equal(fm.streak, 1);
  const ids = plugin.commands.map((c) => c.id);
  assert.ok(ids.includes("repair-review-history"));
});

test("historyLimit keeps the newest rows and reports the trimmed count", () => {
  const rows = Array.from({ length: 120 }, (_, i) => `2026-09-${String((i % 28) + 1).padStart(2, "0")}T10:00:00|correct|5|A|2||old-${i}`);
  const fm = { history: rows };
  const summary = T.applyAttempt(fm, { correct: true, chosen: "B", conf: 2, seconds: 10, now: LATER }, [1, 3, 7], { attemptId: "new-1", historyLimit: 100 });
  assert.equal(fm.history.length, 100);
  assert.equal(summary.historyPruned, 21);
  assert.match(fm.history[99], /new-1/);

  const skipped = { history: rows };
  const skip = T.applySkip(skipped, LATER, "skip-1", { historyLimit: 100 });
  assert.equal(skipped.history.length, 100);
  assert.equal(skip.historyPruned, 21);
});

test("historyLimit is documented, bounded and enforced through the plugin paths", async () => {
  assert.equal(T.history.DEFAULT_HISTORY_LIMIT, 500);
  assert.equal(T.history.normalizeHistoryLimit(undefined), 500);
  assert.equal(T.history.normalizeHistoryLimit(1), 100);
  assert.equal(T.history.normalizeHistoryLimit(99999), 5000);

  const rows = Array.from({ length: 120 }, (_, i) => `2026-09-${String((i % 28) + 1).padStart(2, "0")}T10:00:00|correct|5|A|2||old-${i}`);
  const app = makeApp([{ path: "Questions/q.md", fm: { history: rows, attempts: 120, correct_count: 120 }, text: NOTE_TEXT("q", "A") }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.historyLimit = 100;
  const summary = await plugin.recordAttempt(app.files[0], { correct: true, chosen: "A", conf: 2, seconds: 10, now: NOW });
  assert.equal(app.files[0].fm.history.length, 100);
  assert.equal(summary.historyPruned, 21);
  const skip = await plugin.recordSkip(app.files[0]);
  assert.equal(app.files[0].fm.history.length, 100);
  assert.equal(skip.historyPruned, 1);
});
