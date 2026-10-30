"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const S = T.survey;

test("survey: summary keeps the answers and states that nothing was sent", () => {
  const text = S.buildSurveySummary({
    rating: 4,
    role: "College coursework",
    likes: "The import preview is clear.",
    improve: "Add an Anki package export.",
    quote: true,
    date: "2026-10-30",
  });
  assert.match(text, /^# MCQ Tracker feedback/);
  assert.match(text, /Date: 2026-10-30/);
  assert.match(text, /Rating: 4\/5/);
  assert.match(text, /Used for: College coursework/);
  assert.match(text, /## What works well\n\nThe import preview is clear\./);
  assert.match(text, /## What should improve\n\nAdd an Anki package export\./);
  assert.match(text, /You may quote this feedback\./);
  assert.match(text, /No network request was made\./);
});

test("survey: empty optional answers are omitted and ratings are clamped", () => {
  const empty = S.buildSurveySummary({ rating: 99, date: "2026-10-30" });
  assert.match(empty, /Rating: 5\/5/);
  assert.doesNotMatch(empty, /Used for:/);
  assert.doesNotMatch(empty, /What works well/);
  assert.equal(S.normalizeSurvey({ rating: -4 }).rating, 1);
  assert.equal(S.normalizeSurvey({ rating: "nope" }).rating, 0);
  assert.equal(S.normalizeSurvey({ likes: "  useful  " }).likes, "useful");
});
