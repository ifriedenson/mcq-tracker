"use strict";
// Offline-tolerant attempts: device-local queue, idempotent retry, and error tags.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const O = T.offline;
const NOW = new Date(2026, 10, 2, 10, 0);
const ATTEMPT = { correct: true, chosen: "A", conf: 2, seconds: 20 };

test("offline: queue entries are validated, packed and deduplicated", () => {
  const first = O.enqueuePending([], "Questions/q1.md", { ...ATTEMPT, now: NOW, attemptId: "a1" });
  assert.equal(first.length, 1);
  assert.equal(first[0].id, "a1");
  assert.equal(first[0].errorType, "");

  const again = O.enqueuePending(first, "Questions/q1.md", { ...ATTEMPT, now: NOW, attemptId: "a1" });
  assert.equal(again.length, 1, "the same attempt id replaces the queued copy");

  const packed = O.packPendingAttempts(again);
  assert.equal(packed[0].attempt.now, NOW.toISOString());
  const unpacked = O.unpackPendingAttempts(packed);
  assert.equal(unpacked[0].attempt.now instanceof Date, true);
  assert.equal(unpacked[0].attempt.attemptId, "a1");

  assert.deepEqual(O.unpackPendingAttempts([{ id: "bad" }]), []);
  assert.equal(O.updatePendingError(unpacked, "Questions/other.md", "a1", "careless"), null);
  assert.equal(O.updatePendingError(unpacked, "Questions/q1.md", "a1", "careless")[0].errorType, "careless");
  assert.deepEqual(O.removePending(unpacked, "a1"), []);
});

test("offline: the queue is capped so a broken vault cannot grow it forever", () => {
  let list = [];
  for (let i = 0; i < O.MAX_PENDING + 5; i++) {
    list = O.enqueuePending(list, `Questions/q${i}.md`, { ...ATTEMPT, now: NOW, attemptId: `a${i}` });
  }
  assert.equal(list.length, O.MAX_PENDING);
  assert.equal(list[0].id, "a5");
});

test("offline: a failed note write is queued, tagged, and then flushed", async () => {
  const app = makeApp([{ path: "Questions/q1.md", fm: { answer: "A" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files[0];
  const original = app.fileManager.processFrontMatter;
  let offline = true;
  app.fileManager.processFrontMatter = async (f, fn) => {
    if (offline) throw new Error("vault unavailable");
    return original(f, fn);
  };

  const summary = await plugin.recordAttempt(file, { ...ATTEMPT, now: NOW, attemptId: "off-1" });
  assert.equal(summary.queued, true);
  assert.equal(summary.attemptId, "off-1");
  assert.equal(file.fm.attempts, undefined, "the note was not touched");
  assert.equal(plugin.readPendingAttempts().length, 1);

  assert.equal(await plugin.setPendingAttemptError(file.path, "off-1", "careless"), true);
  assert.equal(plugin.readPendingAttempts()[0].errorType, "careless");

  offline = false;
  const result = await plugin.flushPendingAttempts();
  assert.equal(result.sent, 1);
  assert.equal(result.remaining, 0);
  assert.equal(file.fm.attempts, 1);
  assert.equal(file.fm.last_attempt_id, "off-1");
  assert.equal(file.fm.last_error_type, "careless");
  assert.equal(plugin.readPendingAttempts().length, 0);
  assert.equal(await plugin.setPendingAttemptError(file.path, "off-1", "careless"), false);
});

test("offline: the outbox survives a restart and duplicate writes are skipped", async () => {
  const app = makeApp([{ path: "Questions/q1.md", fm: { answer: "A" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files[0];
  const original = app.fileManager.processFrontMatter;
  let offline = true;
  app.fileManager.processFrontMatter = async (f, fn) => {
    if (offline) throw new Error("vault unavailable");
    return original(f, fn);
  };
  await plugin.recordAttempt(file, { ...ATTEMPT, now: NOW, attemptId: "restart-1" });
  offline = false;

  const restarted = new QT(app);
  await restarted.onload();
  const result = await restarted.flushPendingAttempts();
  assert.equal(result.sent, 1);
  assert.equal(file.fm.attempts, 1);

  // A write that looked like a failure but reached the note must not count twice.
  restarted.writePendingAttempts([
    { id: "restart-1", path: file.path, errorType: "", attempt: { ...ATTEMPT, now: NOW, attemptId: "restart-1" } },
  ]);
  const replay = await restarted.flushPendingAttempts();
  assert.equal(replay.sent, 1, "the duplicate was cleared");
  assert.equal(file.fm.attempts, 1, "but the note was not incremented again");
  assert.equal(restarted.readPendingAttempts().length, 0);
});
