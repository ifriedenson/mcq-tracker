"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFolderHierarchy, chooseRoot } = require("../src/link-hierarchy");

function note(path, links) {
  return { path, links: (links || []).map((target) => ({ path: target, embed: false })) };
}

test("the note named after the folder is the root", () => {
  const result = buildFolderHierarchy(
    [note("Biology/Biology.md", ["Biology/Cells.md"]), note("Biology/Cells.md", []), note("Biology/Genetics.md", [])],
    "Biology"
  );
  assert.equal(result.root, "Biology/Biology.md");
  assert.deepEqual(result.order, ["Biology/Biology.md", "Biology/Cells.md"]);
});

test("links are followed depth-first in source order", () => {
  const result = buildFolderHierarchy(
    [
      note("Course/Course.md", ["Course/A.md", "Course/B.md"]),
      note("Course/A.md", ["Course/D.md"]),
      note("Course/B.md", ["Course/D.md"]),
      note("Course/D.md", []),
    ],
    "Course"
  );
  assert.deepEqual(result.order, ["Course/Course.md", "Course/A.md", "Course/D.md", "Course/B.md"]);
});

test("a linked subfolder note brings its links, not its sibling notes", () => {
  const result = buildFolderHierarchy(
    [
      note("Course/Course.md", ["Course/Unit 1/Unit 1.md"]),
      note("Course/Unit 1/Unit 1.md", ["Course/Unit 1/Overview.md"]),
      note("Course/Unit 1/Overview.md", []),
      note("Course/Unit 1/Unlinked sibling.md", []),
    ],
    "Course"
  );
  assert.deepEqual(result.order, ["Course/Course.md", "Course/Unit 1/Unit 1.md", "Course/Unit 1/Overview.md"]);
});

test("the most-linked note is the fallback root and cycles terminate", () => {
  const result = buildFolderHierarchy(
    [note("Course/A.md", ["Course/B.md", "Course/C.md"]), note("Course/B.md", ["Course/A.md"]), note("Course/C.md", [])],
    "Course"
  );
  assert.equal(result.root, "Course/A.md");
  assert.deepEqual(result.order, ["Course/A.md", "Course/B.md", "Course/C.md"]);
});

test("links outside the folder and unresolved paths are ignored", () => {
  const result = buildFolderHierarchy(
    [note("Course/Course.md", ["Course/A.md", "Other/Note.md", ""]), note("Course/A.md", [])],
    "Course"
  );
  assert.deepEqual(result.order, ["Course/Course.md", "Course/A.md"]);
});

test("chooseRoot prefers regular links over embeds", () => {
  const nodes = new Map([
    ["X/A.md", { path: "X/A.md", links: [{ path: "X/B.md", embed: true }] }],
    ["X/B.md", { path: "X/B.md", links: [] }],
  ]);
  assert.equal(chooseRoot(nodes, "X"), "X/A.md");
});
