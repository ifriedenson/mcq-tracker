"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, TFile } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");
const { T, Plugin: QT } = load();
const agentWriteGuard = T.agentWriteGuard;

test("snapshotProtected keeps only review notes and their protected values", () => {
  const state = agentWriteGuard.snapshotProtected([
    {
      file: { path: "Questions/q.md" },
      fm: {
        question_id: "q1",
        answer: "B",
        attempts: 4,
        correct_count: 2,
        history: [{ at: "2026-10-01", correct: true }],
        next_review: "2026-11-02",
      },
    },
    { file: { path: "Cards/c.md" }, fm: {} },
  ]);
  assert.deepEqual([...state.keys()], ["Questions/q.md"]);
  assert.equal(state.get("Questions/q.md").attempts, 4);
  assert.equal(state.get("Questions/q.md").answer, undefined);
});

test("changedProtected ignores content edits and reports review-state edits", () => {
  const before = { attempts: 4, correct_count: 2, history: ["a"], next_review: "2026-11-02" };
  const after = { attempts: 0, correct_count: 2, history: [], next_review: "2026-11-02" };
  assert.deepEqual(agentWriteGuard.changedProtected(before, after).sort(), ["attempts", "history"]);
});

test("restoreFrontmatter puts values back and removes properties the agent added", () => {
  const before = { attempts: 4, history: ["a"], next_review: "2026-11-02" };
  const fm = { attempts: 0, history: [], next_review: "2027-01-01", srs: 4, answer: "C" };
  const changed = agentWriteGuard.restoreFrontmatter(fm, before);
  assert.deepEqual(changed.sort(), ["attempts", "history", "next_review", "srs"]);
  assert.equal(fm.attempts, 4);
  assert.deepEqual(fm.history, ["a"]);
  assert.equal(fm.next_review, "2026-11-02");
  assert.equal(fm.srs, undefined);
  assert.equal(fm.answer, "C", "content edits are kept");
});

test("restoreProtectedState repairs review state an agent changed", async () => {
  const app = makeApp([
    {
      path: "Questions/q.md",
      fm: {
        question_id: "q1",
        answer: "B",
        attempts: 4,
        correct_count: 2,
        history: [{ at: "2026-10-01", correct: true }],
        next_review: "2026-11-02",
      },
    },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const snapshot = plugin.snapshotProtectedState();
  assert.ok(snapshot instanceof Map);
  assert.equal(snapshot.size, 1);

  const file = app.files[0];
  const before = JSON.parse(JSON.stringify(file.fm));
  file.fm.attempts = 0;
  file.fm.correct_count = 0;
  file.fm.history = [];
  file.fm.next_review = "2027-01-01";
  file.fm.answer = "C";

  const restored = await plugin.restoreProtectedState(snapshot);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].path, "Questions/q.md");
  assert.deepEqual(restored[0].changes.sort(), ["attempts", "correct_count", "history", "next_review"]);
  assert.equal(file.fm.attempts, 4);
  assert.equal(file.fm.correct_count, 2);
  assert.deepEqual(file.fm.history, before.history);
  assert.equal(file.fm.next_review, "2026-11-02");
  assert.equal(file.fm.answer, "C");
});

test("restoreProtectedState does nothing when the agent left review state alone", async () => {
  const app = makeApp([{ path: "Questions/q.md", fm: { question_id: "q1", attempts: 1 } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const snapshot = plugin.snapshotProtectedState();
  app.files[0].fm.answer = "A";
  assert.deepEqual(await plugin.restoreProtectedState(snapshot), []);
});

test("restoreProtectedState skips notes that were deleted", async () => {
  const app = makeApp([{ path: "Questions/q.md", fm: { question_id: "q1", attempts: 1 } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const snapshot = plugin.snapshotProtectedState();
  app.vault.getAbstractFileByPath = () => null;
  assert.deepEqual(await plugin.restoreProtectedState(snapshot), []);
  assert.ok(TFile);
});
