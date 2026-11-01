"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const S = T.reviewSession;

test("a missed item moves behind the items still waiting", () => {
  const session = S.createReviewSession([{ path: "A.md" }, { path: "B.md" }, { path: "C.md" }], { requeueEnabled: true, requeueLimit: 2 });
  S.gradeReviewSession(session, "A.md", false);
  assert.deepEqual(session.queue, ["B.md", "C.md", "A.md"]);
  assert.equal(S.nextPath(session), "B.md");
  S.gradeReviewSession(session, "B.md", true);
  S.gradeReviewSession(session, "C.md", true);
  assert.deepEqual(session.queue, ["A.md"]);
  S.gradeReviewSession(session, "A.md", true);
  assert.equal(S.sessionStatus(session).done, true);
  assert.equal(S.sessionStatus(session).completed, 3);
});

test("the requeue limit stops an impossible item from trapping the run", () => {
  const session = S.createReviewSession(["A.md"], { requeueEnabled: true, requeueLimit: 2 });
  S.gradeReviewSession(session, "A.md", false);
  assert.deepEqual(session.queue, ["A.md"]);
  S.gradeReviewSession(session, "A.md", false);
  assert.deepEqual(session.queue, ["A.md"]);
  S.gradeReviewSession(session, "A.md", false);
  assert.deepEqual(session.queue, []);
  assert.deepEqual(session.missed, ["A.md"]);
  assert.equal(S.requeueCount(session, "A.md"), 2);
});

test("requeue can be disabled and skip removes without marking a pass", () => {
  const session = S.createReviewSession(["A.md", "B.md"], { requeueEnabled: false });
  S.gradeReviewSession(session, "A.md", false);
  assert.deepEqual(session.queue, ["B.md"]);
  assert.deepEqual(session.missed, ["A.md"]);
  S.dropReviewSession(session, "B.md");
  assert.equal(S.sessionStatus(session).done, true);
  assert.equal(S.sessionStatus(session).completed, 0);
});

test("requeue settings clamp and default safely", () => {
  assert.deepEqual(S.normalizeReviewSessionSettings(undefined), { requeueEnabled: true, requeueLimit: 3 });
  assert.equal(S.normalizeReviewSessionSettings({ requeueLimit: 999 }).requeueLimit, 25);
  assert.equal(S.normalizeReviewSessionSettings({ requeueLimit: -2 }).requeueLimit, 1);
});
