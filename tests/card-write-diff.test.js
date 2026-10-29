"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const diff = T.cardWriteDiff;

test("card write diff: only changed fields are listed", () => {
  const existing = {
    file: { path: "Cards/Bio/cell.md" },
    fm: { deck: "Biology", course: "BIOL 201" },
    body: { front: "Old question", back: "Old answer" },
  };
  const incoming = {
    front: "New question",
    back: "Old answer",
    deck: "Biology",
    course: "BIOL 201",
  };
  const result = diff.cardUpdateDiff(existing, incoming);
  assert.equal(result.path, "Cards/Bio/cell.md");
  assert.equal(result.changed, true);
  assert.deepEqual(result.fields, [{ key: "front", label: "Front", before: "Old question", after: "New question" }]);
});

test("card write diff: deck and course changes are visible without touching history", () => {
  const result = diff.cardUpdateDiff(
    { path: "Cards/x.md", fm: { deck: "Old deck", course: "OLD 101" }, body: { front: "Q", back: "A" } },
    { front: "Q", back: "A", deck: "New deck", course: "NEW 101" }
  );
  assert.deepEqual(result.fields.map((field) => field.key), ["deck", "course"]);
  assert.equal(result.fields[0].before, "Old deck");
  assert.equal(result.fields[0].after, "New deck");
  assert.equal(result.fields[1].after, "NEW 101");
  const summary = diff.summarizeCardDiffs([result, diff.cardUpdateDiff({ path: "b.md", body: { front: "Q", back: "A" } }, { front: "Q", back: "A" })]);
  assert.equal(summary.count, 2);
  assert.equal(summary.changed, 1);
  assert.deepEqual(summary.fields, ["deck", "course"]);
});
