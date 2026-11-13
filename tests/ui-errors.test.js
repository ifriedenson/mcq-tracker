"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const { MESSAGE_LIMIT, REPEAT_MS, makeRejectionReporter, rejectionMessage } = T.uiErrors;

test("an error message names the failure and tells the user what to do", () => {
  assert.equal(
    rejectionMessage(new Error("vault not ready")),
    "MCQ Tracker hit an error: vault not ready. Try again; if it keeps happening, send feedback from Settings, About.",
  );
  assert.match(rejectionMessage("plain string"), /plain string/);
  assert.match(rejectionMessage(null), /unknown error/);
  assert.match(rejectionMessage({}), /unknown error/);
});

test("a long error is clamped so the notice stays readable", () => {
  const message = rejectionMessage(new Error("x".repeat(5000)));
  assert.ok(message.length <= MESSAGE_LIMIT + 120, `message is bounded, got ${message.length}`);
  assert.ok(message.includes("MCQ Tracker hit an error:"));
  assert.ok(message.endsWith("send feedback from Settings, About."));
});

test("whitespace in an error is collapsed to one line", () => {
  assert.equal(rejectionMessage(new Error("line one\n\nline two")).includes("\n"), false);
  assert.match(rejectionMessage(new Error("line one\n\nline two")), /line one line two/);
});

test("a repeated failure is reported once inside the dedupe window, then again after it", () => {
  const shown = [];
  let clock = 1_000;
  const report = makeRejectionReporter({ notice: (m) => shown.push(m), now: () => clock });
  report(new Error("same failure"));
  report(new Error("same failure"));
  assert.equal(shown.length, 1, "the second identical failure is dropped");
  clock += REPEAT_MS + 1;
  report(new Error("same failure"));
  assert.equal(shown.length, 2, "it is reported again after the window");
});

test("a different failure is reported immediately, even inside the window", () => {
  const shown = [];
  let clock = 5_000;
  const report = makeRejectionReporter({ notice: (m) => shown.push(m), now: () => clock });
  report(new Error("first failure"));
  clock += 10;
  report(new Error("second failure"));
  assert.equal(shown.length, 2);
  assert.match(shown[1], /second failure/);
});

test("the reporter returns the message it showed, and an empty string when deduped", () => {
  let clock = 0;
  const report = makeRejectionReporter({ notice: () => {}, now: () => clock });
  assert.match(report(new Error("boom")), /boom/);
  assert.equal(report(new Error("boom")), "", "a deduped report shows nothing");
});
