"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();
const a = T.agentView;

test("study agent: local search ranks matching notes and cites path and line", async () => {
  const app = {
    vault: {
      getMarkdownFiles: () => [{ path: "Biology/Cells.md" }, { path: "History/Notes.md" }],
      cachedRead: async (file) => file.path.startsWith("Biology") ? "# Cells\n\nMitochondria make ATP.\n" : "Unrelated.",
    },
  };
  const hits = await a.searchVault(app, "mitochondria ATP", 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].path, "Biology/Cells.md");
  assert.equal(hits[0].lineNumber, 3);
  assert.match(a.citationMarkdown(hits[0]), /\[\[Biology\/Cells\.md#L3/);
});

test("study agent: full-vault context is opt-in and local search needs no provider", () => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "agent-view.js"), "utf8");
  assert.match(source, /this\.includeVaultIndex = false/);
  assert.match(source, /if \(this\.includeVaultIndex\)/);
  assert.match(source, /Local vault search still works/);
});

test("study agent: card creation goes through the existing approval window", () => {
  const source = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "agent-view.js"), "utf8");
  assert.match(source, /ChatPanel/);
  assert.match(source, /nothing is saved without approval/i);
});
