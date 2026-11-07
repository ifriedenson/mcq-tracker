"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T } = load();
const store = T.knowledgeStore;
const kr = T.knowledgeRecord;

function sampleRecord() {
  return kr.normalizeRecord({
    updatedAt: "2026-11-07T12:00:00.000Z",
    notes: {
      "Notes/Bio.md": {
        label: "Bio",
        concepts: [{ id: "c1", note: "Notes/Bio.md", label: "Osmosis", kind: "heading", sourceHash: "h1" }],
      },
    },
  });
}

test("knowledge store: a missing record loads empty and a saved record round-trips", async () => {
  const app = makeApp([]);
  assert.deepEqual(await store.loadRecord(app), kr.emptyRecord());
  const record = sampleRecord();
  await store.saveRecord(app, record);
  const file = app.vault.getAbstractFileByPath(store.RECORD_PATH);
  assert.ok(file, "the record file is created");
  assert.equal(file.path, "MCQ Tracker/knowledge-record.json");
  const loaded = await store.loadRecord(app);
  assert.equal(loaded.updatedAt, record.updatedAt);
  assert.equal(loaded.notes["Notes/Bio.md"].concepts[0].label, "Osmosis");
});

test("knowledge store: malformed saved JSON is ignored rather than thrown", async () => {
  const app = makeApp([]);
  await app.vault.create(store.RECORD_PATH, "{not json");
  assert.deepEqual(await store.loadRecord(app), kr.emptyRecord());
});
