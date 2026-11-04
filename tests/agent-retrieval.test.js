"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const v = T.agentRetrieval;

test("agent retrieval: terms are lowercase, unique, longer than two characters and capped", () => {
  assert.deepEqual(v.terms("Cells, ATP! mitochondria Mitochondria a of the"), ["cells", "atp", "mitochondria"]);
  assert.equal(v.terms("one two three four five six seven eight nine ten").length, 8);
  assert.deepEqual(v.terms(""), []);
});

test("agent retrieval: passages start at headings, end at blank lines and keep line numbers", () => {
  const list = v.passages("# Cells\n\nMitochondria make ATP.\nThey also divide.\n\n# Other\nText.");
  assert.deepEqual(list.map((p) => p.lineNumber), [1, 3, 6]);
  assert.equal(list[1].heading, "Cells");
  assert.equal(list[1].endLine, 4);
  assert.match(list[1].text, /They also divide\./);
});

test("agent retrieval: a long block is split into bounded passages", () => {
  const text = Array.from({ length: 9 }, (_, i) => `line ${i + 1}`).join("\n");
  const list = v.passages(text);
  assert.equal(list.length, 2);
  assert.ok(list.every((p) => p.text.split("\n").length <= v.MAX_PASSAGE_LINES));
  assert.equal(list[0].lineNumber, 1);
  assert.equal(list[1].lineNumber, 7);
});

test("agent retrieval: coverage beats one repeated word", () => {
  const hits = v.searchText(
    [
      { path: "A.md", text: "alpha beta" },
      { path: "B.md", text: "alpha alpha alpha alpha" },
    ],
    "alpha beta"
  );
  assert.equal(hits[0].path, "A.md");
  assert.ok(hits[0].score > hits[1].score);
});

test("agent retrieval: a path match breaks a tie and an exact phrase earns a bonus", () => {
  const pathHits = v.searchText(
    [
      { path: "alpha/notes.md", text: "gamma" },
      { path: "beta/notes.md", text: "gamma" },
    ],
    "gamma alpha"
  );
  assert.equal(pathHits[0].path, "alpha/notes.md");

  const phraseHits = v.searchText(
    [
      { path: "A.md", text: "cell and membrane" },
      { path: "B.md", text: "cell membrane" },
    ],
    "cell membrane"
  );
  assert.equal(phraseHits[0].path, "B.md");
});

test("agent retrieval: frontmatter is never searchable", () => {
  const hits = v.searchText([{ path: "A.md", text: "---\nsecret: true\n---\n\nPublic text." }], "secret");
  assert.deepEqual(hits, []);
});

test("agent retrieval: hits are capped per file and by the overall limit", () => {
  const text = "alpha one\n\nbeta two\n\nalpha three\n\nbeta four";
  const perFile = v.rankDocument("A.md", text, "alpha", { perFile: 2 });
  assert.equal(perFile.length, 2);
  assert.equal(perFile[0].path, "A.md");

  const capped = v.searchText(
    [
      { path: "A.md", text: "alpha" },
      { path: "B.md", text: "alpha" },
      { path: "C.md", text: "alpha" },
    ],
    "alpha",
    { limit: 2 }
  );
  assert.equal(capped.length, 2);
});

test("agent retrieval: an excerpt cites the passage, quotes it and respects a budget", () => {
  const hit = {
    path: "Biology/Cells.md",
    lineNumber: 3,
    endLine: 5,
    line: "Mitochondria make ATP.",
    snippet: "Mitochondria make ATP.\nThey have their own DNA.",
  };
  const block = v.excerptBlock([hit]);
  assert.match(block, /\[\[Biology\/Cells\.md#L3\|Biology\/Cells\.md\]\] \(lines 3-5\)/);
  assert.match(block, /> They have their own DNA\./);
  assert.equal(v.excerptBlock([{ ...hit, snippet: "x".repeat(600) }], 200), "");
  assert.equal(v.excerptBlock([]), "");
});
