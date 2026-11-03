"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, q } = require("./helpers/load");

const { T } = load();
const P = T.masteryPicker;
const TODAY = "2026-11-03";

const miss = (path, skill, when = "2026-10-30") =>
  q(path, {
    skill,
    unit: 2,
    difficulty: "medium",
    attempts: 2,
    correct_count: 0,
    history: [`${when}|incorrect|20|A|2||${path}-a`, `${when}|incorrect|20|A|2||${path}-b`],
  });

test("mastery facets include the question properties used for similarity", () => {
  const item = q("Q/a.md", {
    course: "BIO 201",
    unit: 3,
    skill: "Cell Respiration",
    test: "Midterm",
    tags: ["Unit 3", "energy"],
    difficulty: "hard",
  });
  const facets = P.facetsOf(item);
  const has = (kind, value) => facets.some((facet) => facet.kind === kind && facet.value === value);
  assert.equal(has("course", "bio 201"), true);
  assert.equal(has("unit", "3"), true);
  assert.equal(has("skill", "cell respiration"), true);
  assert.equal(has("test", "midterm"), true);
  assert.equal(has("tags", "energy"), true);
});

test("mastery ranking prefers a weak skill over a strong one", () => {
  const weak = miss("Q/weak.md", "respiration");
  const strong = q("Q/strong.md", {
    skill: "photosynthesis",
    unit: 3,
    attempts: 4,
    correct_count: 4,
    history: [
      "2026-10-01|correct|10|A|2||s1",
      "2026-10-02|correct|10|A|2||s2",
      "2026-10-03|correct|10|A|2||s3",
      "2026-10-04|correct|10|A|2||s4",
    ],
  });
  const rows = P.rankFacets([weak, strong], [weak, strong]);
  assert.equal(rows[0].kind, "skill");
  assert.equal(rows[0].value, "respiration");
});

test("adaptive mastery picks a similar different question, not the missed one", () => {
  const missed = miss("Q/missed.md", "respiration");
  const similar = q("Q/similar.md", { skill: "respiration", unit: 2, difficulty: "hard" });
  const other = q("Q/other.md", { skill: "photosynthesis", unit: 3, difficulty: "medium" });
  const result = P.pickAdaptiveQuestion([missed, similar, other], [missed, similar, other], TODAY, ["Q/missed.md"], () => 0);
  assert.equal(result.question.file.path, "Q/similar.md");
  assert.equal(result.reason.kind, "skill");
  assert.equal(result.reason.value, "respiration");
});

test("adaptive mastery does not require an FSRS due date", () => {
  const future = q("Q/future.md", { skill: "respiration", next_review: "2099-01-01" });
  const result = P.pickAdaptiveQuestion([future], [future], TODAY, [], () => 0);
  assert.equal(result.question.file.path, "Q/future.md");
});

test("adaptive mastery returns nothing when every candidate is inside the repeat window", () => {
  const a = miss("Q/a.md", "respiration", "2026-11-02");
  const b = miss("Q/b.md", "respiration", "2026-11-01");
  assert.equal(P.pickAdaptiveQuestion([a, b], [a, b], TODAY, [], () => 0), null);
});

test("a small subgroup borrows the global prior for the same facet", () => {
  const scoped = [
    q("Q/one.md", {
      skill: "rare skill",
      attempts: 1,
      correct_count: 0,
      history: ["2026-10-01|incorrect|10|A|2||rare-1"],
    }),
  ];
  const global = [scoped[0]];
  for (let i = 0; i < 6; i++) {
    const path = `Q/g${i}.md`;
    global.push(
      q(path, {
        skill: "rare skill",
        attempts: 10,
        correct_count: 10,
        history: Array.from({ length: 10 }, (_v, j) => `2026-09-${String(j + 1).padStart(2, "0")}|correct|5|A|2||${path}-${j}`),
      })
    );
  }
  const row = P.rankFacets(scoped, global).find((item) => item.kind === "skill" && item.value === "rare skill");
  assert.ok(row.effective > 0.5);
  assert.ok(row.effective < 0.9);
});

test("the adaptive menu mode uses the mastery selector", () => {
  const missed = miss("Q/missed.md", "respiration");
  const similar = q("Q/similar.md", { skill: "respiration", unit: 2 });
  const other = q("Q/other.md", { skill: "photosynthesis", unit: 3 });
  const picked = T.pickQuestion([missed, similar], "adaptive", TODAY, [], () => 0, [missed, similar, other]);
  assert.equal(picked.file.path, "Q/similar.md");
});
