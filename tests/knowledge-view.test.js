"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeDom } = require("./helpers/fake");

const { T } = load();
const kr = T.knowledgeRecord;

function viewWith(record, enabled) {
  const plugin = {
    settings: { knowledgeRecord: { enabled } },
    knowledgeRecord: record,
    knowledgeRecordSettings: () => ({ enabled }),
    rebuildKnowledgeRecord: async () => null,
    copyLearnerDigest: async () => true,
    refreshViews: () => {},
  };
  return new T.InsightsView({ app: {} }, plugin);
}

test("knowledge record: the Insights panel renders coverage, misconceptions and actions", () => {
  const record = kr.normalizeRecord({
    updatedAt: "2026-11-07T12:00:00.000Z",
    notes: {
      "Notes/Bio.md": {
        label: "Bio",
        concepts: [
          {
            id: "c1",
            note: "Notes/Bio.md",
            label: "Osmosis",
            kind: "heading",
            sourceHash: "h1",
            attempts: 3,
            correct: 1,
            incorrect: 2,
            status: "learning",
            lastSeen: "2026-11-05",
            dueAt: "2026-11-06",
            lastVerdict: "incorrect",
            lastError: "content_gap",
            errors: { content_gap: 2 },
          },
        ],
      },
    },
  });
  const dom = makeDom();
  viewWith(record, true).renderKnowledgeRecord(dom.root);
  const texts = dom.texts();
  for (const expected of [
    "Knowledge record",
    "Coverage by note",
    "Bio",
    "Osmosis",
    "Content gap",
    "Open",
    "Rebuild record",
    "Copy learner digest",
  ]) {
    assert.ok(texts.includes(expected), `renders ${expected}`);
  }
  assert.ok(texts.includes("0/1 concepts known · 1 tested · 1 due"));
});

test("knowledge record: the off state offers the opt-in build button", () => {
  const dom = makeDom();
  viewWith(kr.emptyRecord(), false).renderKnowledgeRecord(dom.root);
  assert.ok(dom.texts().includes("Build my knowledge record"));
});
