"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, q } = require("./helpers/load");
const { T } = load();

const SAT = "Questions/sat-reading-export-2.2.3.4";
const qs = [
  q(`${SAT}/Q1.md`, { skill: "grammer", difficulty: "medium" }),
  q(`${SAT}/Q2.md`, { skill: "grammer", difficulty: "hard" }),
  q(`${SAT}/sub/Q3.md`, { skill: "grammer", difficulty: "medium" }),
  q(`${SAT}/sub/Q4.md`, { skill: "vocab", difficulty: "medium" }),
  q("Questions/other/Q5.md", { skill: "grammer", difficulty: "medium" }),
  q("Root.md", { skill: "grammer", difficulty: "medium" }),
];

test("folderChain lists every folder a note is in; root notes are in '/'", () => {
  assert.deepEqual(T.folderChain("A/B/c.md"), ["A", "A/B"]);
  assert.deepEqual(T.folderChain("c.md"), ["/"]);
});

test("folderLabel is relative to the question folder and names the root", () => {
  assert.equal(T.folderLabel("Questions/a/b", "Questions"), "a/b");
  assert.equal(T.folderLabel("Questions", "Questions"), "Questions");
  assert.equal(T.folderLabel("X/y", ""), "X/y");
  assert.equal(T.folderLabel("/", "Questions"), "(vault root)");
});

test("folder + skill + difficulty filters combine, and a folder includes its sub folders", () => {
  const f = { folder: [SAT], skill: ["grammer"], difficulty: ["medium"] };
  const hit = qs.filter((x) => T.matchSets(x.fm, [f], x.file.path)).map((x) => x.file.basename);
  assert.deepEqual(hit, ["Q1", "Q3"]);
});

test("several folders mean any of them", () => {
  const f = { folder: [`${SAT}/sub`, "Questions/other"] };
  const hit = qs.filter((x) => T.matchSets(x.fm, [f], x.file.path)).map((x) => x.file.basename);
  assert.deepEqual(hit, ["Q3", "Q4", "Q5"]);
});

test("notes saved in the vault root can be filtered with '/'", () => {
  const hit = qs.filter((x) => T.matchSets(x.fm, [{ folder: ["/"] }], x.file.path));
  assert.deepEqual(hit.map((x) => x.file.basename), ["Root"]);
});

test("filterOptionCounts counts notes per value, parents include sub folders, and other fields narrow it", () => {
  const folders = T.filterOptionCounts(qs, {}, "folder");
  const get = (v) => folders.find((o) => o.value === v).count;
  assert.equal(get("Questions"), 5);
  assert.equal(get(SAT), 4);
  assert.equal(get(`${SAT}/sub`), 2);
  assert.equal(get("/"), 1);
  const skills = T.filterOptionCounts(qs, { difficulty: ["hard"] }, "skill");
  assert.deepEqual(skills, [{ value: "grammer", count: 1 }]);
  assert.deepEqual(T.filterOptions(qs, {}, "difficulty"), ["hard", "medium"]);
});

test("error type is a filter field", () => {
  const list = [q("A/1.md", { last_error_type: "careless" }), q("A/2.md", {})];
  assert.deepEqual(T.filterOptions(list, {}, "last_error_type"), ["careless"]);
  assert.equal(T.matchSets(list[0].fm, [{ last_error_type: ["careless"] }], "A/1.md"), true);
  assert.equal(T.matchSets(list[1].fm, [{ last_error_type: ["careless"] }], "A/2.md"), false);
});

test("adaptive mode starts at medium difficulty for unseen questions", () => {
  const pool = [
    q("easy.md", { difficulty: "easy" }),
    q("medium.md", { difficulty: "medium" }),
    q("hard.md", { difficulty: "hard" }),
  ];
  assert.equal(T.adaptiveTargetRank(pool), 1);
  assert.equal(T.adaptiveWeight(pool[1].fm, 1), 5);
  assert.equal(T.adaptiveWeight(pool[0].fm, 1), 2);
});

test("adaptive mode steps down for weak performance and up for strong performance", () => {
  const weak = [
    q("weak-1.md", { difficulty: "easy", attempts: 2, correct_count: 1, streak: 0 }),
    q("weak-2.md", { difficulty: "medium", attempts: 2, correct_count: 1, streak: 0 }),
  ];
  const strong = [
    q("strong-1.md", { difficulty: "medium", attempts: 4, correct_count: 4, streak: 3 }),
    q("strong-2.md", { difficulty: "hard", attempts: 4, correct_count: 4, streak: 3 }),
  ];
  assert.equal(T.adaptiveTargetRank(weak), 0);
  assert.equal(T.adaptiveTargetRank(strong), 2);
});

test("renameFolderPath only touches the folder and what is inside it", () => {
  assert.equal(T.renameFolderPath("A", "A", "B"), "B");
  assert.equal(T.renameFolderPath("A/x/y", "A", "B"), "B/x/y");
  assert.equal(T.renameFolderPath("AB", "A", "B"), "AB");
  assert.equal(T.renameFolderPath("Other", "A", "B"), "Other");
});

test("renaming a folder updates filters, extra sets, presets and folder settings", () => {
  const st = {
    questionFolder: "Questions",
    importFolder: "Questions/new",
    filters: { folder: ["Questions/sat"], skill: ["x"] },
    moreSets: [{ folder: ["Questions/sat/sub"] }, { skill: ["y"] }],
    presets: [{ id: "p", name: "P", filters: { folder: ["Questions"] }, moreSets: [{ folder: ["Questions/other"] }] }],
  };
  assert.equal(T.renameFolderInSettings(st, "Questions", "Bank"), true);
  assert.equal(st.questionFolder, "Bank");
  assert.equal(st.importFolder, "Bank/new");
  assert.deepEqual(st.filters, { folder: ["Bank/sat"], skill: ["x"] });
  assert.deepEqual(st.moreSets[0], { folder: ["Bank/sat/sub"] });
  assert.deepEqual(st.presets[0].filters, { folder: ["Bank"] });
  assert.deepEqual(st.presets[0].moreSets[0], { folder: ["Bank/other"] });
  assert.equal(T.renameFolderInSettings(st, "Nothing", "Else"), false);
});
