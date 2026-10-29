"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const writes = T.aiWrites;

test("AI writes: records keep only real paths and newest first", () => {
  const records = writes.normalizeAiWrites([
    { id: "a", kind: "questions", paths: ["Questions/a.md", "Questions/a.md", "  "] },
    null,
    { id: "b", paths: [] },
    { id: "c", kind: "cards", paths: ["Cards/b.md"] },
    { id: "d", kind: "summary", paths: ["Course notes/Cells.md"] },
  ]);
  assert.equal(records.length, 3);
  assert.deepEqual(records[0].paths, ["Questions/a.md"]);
  assert.equal(records[0].kind, "questions");
  assert.equal(records[1].kind, "cards");
  assert.equal(records[1].sourcePath, "");
  assert.equal(records[2].kind, "summary", "summary records are not relabelled as cards");
});

test("AI writes: making a record requires at least one path", () => {
  assert.equal(writes.makeAiWriteRecord({ paths: [] }), null);
  const record = writes.makeAiWriteRecord({ kind: "questions", paths: ["Q/a.md"], sourcePath: "Lecture.md", summary: "Lecture" });
  assert.equal(record.kind, "questions");
  assert.equal(record.sourcePath, "Lecture.md");
  assert.equal(record.summary, "Lecture");
  assert.match(record.id, /^ai-/);
});

test("AI writes: the journal is newest first and capped", () => {
  let list = [];
  for (let i = 0; i < writes.MAX_AI_WRITES + 4; i++) {
    list = writes.appendAiWrite(list, writes.makeAiWriteRecord({ paths: [`Q/${i}.md`] }));
  }
  assert.equal(list.length, writes.MAX_AI_WRITES);
  assert.deepEqual(list[0].paths, [`Q/${writes.MAX_AI_WRITES + 3}.md`]);
  assert.equal(writes.latestAiWrite(list).paths[0], `Q/${writes.MAX_AI_WRITES + 3}.md`);
  assert.equal(writes.latestAiWrite(list).id, list[0].id);
  assert.equal(writes.latestAiWrite([]), null);
});
