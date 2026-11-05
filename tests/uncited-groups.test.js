"use strict";
/**
 * The pure groups the capability inventory listed as uncited. Each test drives the
 * real export and asserts what it does for the user — the quick-practice timer and
 * session restore, the filter semantics behind the filter bar, the review weight
 * that decides what comes back first, and the folder counting behind the stats —
 * rather than only that the name exists in the bundle.
 */
const test = require("node:test");
const assert = require("node:assert");
const { load } = require("./helpers/load");

const { T } = load();

test("the quick-practice size options are the documented ones", () => {
  assert.deepEqual(T.QUICK_TIME_OPTIONS, [2, 5, 10], "time options are minutes");
  assert.deepEqual(T.QUICK_COUNT_OPTIONS, [5, 10, 20], "count options are questions");
});

test("fmtDateTime writes a local minute stamp", () => {
  assert.equal(T.fmtDateTime(new Date(2026, 10, 5, 9, 5)), "2026-11-05T09:05");
  assert.equal(T.fmtDateTime(new Date(2026, 0, 1, 0, 0)), "2026-01-01T00:00");
});

test("normalizeExamReadyPasses clamps to the 1-10 range with a default", () => {
  assert.equal(T.normalizeExamReadyPasses(0), 1, "below the range clamps up");
  assert.equal(T.normalizeExamReadyPasses(4.4), 4, "fractions round");
  assert.equal(T.normalizeExamReadyPasses(99), 10, "above the range clamps down");
  assert.equal(T.normalizeExamReadyPasses("nonsense"), 2, "a non-number falls back to the default");
});

test("cloneFilters copies each value list and drops empty fields", () => {
  const source = { folder: ["A", "B"], skill: [] };
  const copy = T.cloneFilters(source);
  assert.deepEqual(copy, { folder: ["A", "B"] }, "only populated fields survive");
  copy.folder.push("C");
  assert.deepEqual(source.folder, ["A", "B"], "the copy does not share the array");
  assert.equal(T.hasFilters({}), false, "an empty filter set is no filter");
  assert.equal(T.hasFilters(copy), true, "a populated one is");
});

test("matchFilters ORs within a field, ANDs across fields and honours the skip", () => {
  const fm = { folder: [] };
  assert.equal(T.matchFilters(fm, { folder: ["A"] }, null, "A/B/c.md"), true, "a parent folder matches its child");
  assert.equal(T.matchFilters(fm, { folder: ["Z"] }, null, "A/B/c.md"), false, "an unrelated folder does not");
  assert.equal(T.matchFilters(fm, { folder: ["Z"] }, "folder", "A/B/c.md"), true, "the skipped field is ignored");
});

test("weightOf brings flagged, unseen and missed notes back first", () => {
  const today = "2026-11-05";
  assert.equal(T.weightOf({ attempts: 2, result: "correct" }, today), 1, "a seen, correct note has the base weight");
  assert.equal(T.weightOf({ attempts: 2, result: "incorrect" }, today), 3, "a missed note weighs more");
  assert.equal(T.weightOf({ attempts: 2, result: "incorrect", flagged: true }, today), 6, "a flag doubles the weight");
  assert.equal(T.weightOf({}, today), 4, "an unseen note outranks a missed one");
});

test("statVals counts a note once, in its own folder, and keeps list values", () => {
  assert.deepEqual(T.statVals({ file: { path: "A/B/c.md" }, fm: {} }, "folder"), ["A/B"], "only the deepest folder is counted");
  assert.deepEqual(
    T.statVals({ file: { path: "A/B/c.md" }, fm: { skill: ["Algebra", "Geometry"] } }, "skill"),
    ["Algebra", "Geometry"],
    "a list property counts under each value"
  );
});

test("a saved quick session round-trips and refuses damaged input", () => {
  const session = {
    paths: ["a.md", "b.md"],
    index: 1,
    mode: "smart",
    label: "Quick",
    kind: "time",
    value: 5,
    startedAt: 1000,
    deadline: 61000,
    remainingSeconds: 30,
    runningSince: 0,
    daily: false,
    date: "",
  };
  const packed = T.packQuickSession(session);
  assert.equal(packed.v, 1, "the stored shape is versioned");
  const restored = T.unpackQuickSession(packed, 5000);
  assert.deepEqual(restored.paths, ["a.md", "b.md"], "the note order survives a restart");
  assert.equal(restored.index, 1, "so does the position");
  assert.equal(T.unpackQuickSession(null, 0), null, "nothing stored restores nothing");
  assert.equal(T.unpackQuickSession({ v: 1, paths: [] }, 0), null, "an empty session is refused");
  assert.equal(T.unpackQuickSession({ ...packed, v: 2 }, 0), null, "an unknown version is refused");
  assert.equal(T.unpackQuickSession({ ...packed, index: 9 }, 0), null, "a position past the end is refused");
});

test("a timed session counts down, pauses, resumes and expires", () => {
  const session = { kind: "time", startedAt: 0, deadline: 60000, remainingSeconds: 0, runningSince: 1000 };
  assert.equal(T.quickRemainingSeconds(session, 11000), 50, "ten seconds of a minute are gone");
  T.pauseQuickSession(session, 11000);
  assert.equal(session.runningSince, 0, "a paused session stops running");
  assert.equal(session.remainingSeconds, 50, "and keeps the time left");
  T.resumeQuickSession(session, 20000);
  assert.equal(session.runningSince, 20000, "resuming restarts the clock");
  const expired = { kind: "time", startedAt: 0, deadline: 1000, remainingSeconds: 0, runningSince: 1000 };
  assert.equal(T.quickRemainingSeconds(expired, 10000), 0, "it never counts below zero");
  assert.equal(T.quickRemainingSeconds({ kind: "count" }, 0), null, "a question-count run has no clock");
});
