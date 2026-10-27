"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, q } = require("./helpers/load");
const { T } = load();

const mk = (path, skill, attempts, correct, secs, extra) => q(path, Object.assign({ skill, difficulty: "medium", attempts, correct_count: correct, time_spent_total: secs }, extra));

const qs = [
  mk("Q/a/1.md", "grammar", 4, 1, 200),
  mk("Q/a/2.md", "grammar", 2, 1, 100),
  mk("Q/b/3.md", "vocab", 6, 6, 120),
  mk("Q/b/4.md", "vocab", 0, 0, 0),
  mk("Q/b/5.md", "logic", 0, 0, 0),
];

test("computeStats gives accuracy and time per value, weakest first, untried last", () => {
  const rows = T.computeStats(qs, "skill");
  assert.deepEqual(rows.map((r) => r.value), ["grammar", "vocab", "logic"]);
  const g = rows[0];
  assert.equal(g.notes, 2);
  assert.equal(g.attempts, 6);
  assert.equal(g.correct, 2);
  assert.ok(Math.abs(g.accuracy - 2 / 6) < 1e-9);
  assert.equal(g.avgSeconds, 50);
  const v = rows[1];
  assert.equal(v.notes, 2);
  assert.equal(v.seen, 1);
  assert.equal(v.accuracy, 1);
  assert.equal(rows[2].accuracy, null);
});

test("folder stats use only the folder a note sits in", () => {
  const rows = T.computeStats(qs, "folder");
  assert.deepEqual(rows.map((r) => r.value).sort(), ["Q/a", "Q/b"]);
  assert.equal(rows.find((r) => r.value === "Q/a").notes, 2);
});

test("correct answers can never exceed attempts", () => {
  const rows = T.computeStats([mk("Q/x.md", "s", 1, 5, 10)], "skill");
  assert.equal(rows[0].accuracy, 1);
});

test("weakestRow prefers rows with enough attempts, then falls back", () => {
  const rows = T.computeStats(qs, "skill");
  assert.equal(T.weakestRow(rows).value, "grammar");
  const few = T.computeStats([mk("Q/a.md", "x", 2, 0, 10), mk("Q/b.md", "y", 8, 4, 10)], "skill");
  assert.equal(T.weakestRow(few).value, "y"); // x is lower but has under 5 attempts
  assert.equal(T.weakestRow(few, 1).value, "x");
  const onlyFew = T.computeStats([mk("Q/a.md", "x", 2, 0, 10)], "skill");
  assert.equal(T.weakestRow(onlyFew).value, "x");
  assert.equal(T.weakestRow(T.computeStats([mk("Q/a.md", "x", 0, 0, 0)], "skill")), null);
});

test("overallStats totals everything attempted", () => {
  const o = T.overallStats(qs);
  assert.equal(o.attempts, 12);
  assert.equal(o.correct, 8);
  assert.equal(o.seen, 3);
  assert.equal(o.notes, 5);
  assert.ok(Math.abs(o.accuracy - 8 / 12) < 1e-9);
  assert.equal(T.fmtPct(o.accuracy), "67%");
  assert.equal(T.fmtPct(null), "-");
});

test("parseHistory reads the pipe format", () => {
  const h = T.parseHistory(["2026-10-01T10:00|incorrect|42|B|2|careless", "2026-10-02T10:00|correct|30|A|3|"]);
  assert.equal(h[0].result, "incorrect");
  assert.equal(h[0].seconds, 42);
  assert.equal(h[0].error, "careless");
  assert.equal(h[1].error, "");
  assert.deepEqual(T.parseHistory(undefined), []);
});

test("errorLog groups misses by the reason given", () => {
  const list = [
    q("Q/1.md", { last_error_type: "careless", result: "incorrect", "date attempted": "2026-10-02T09:00", history: ["d|incorrect|5|A|1|careless", "d|incorrect|5|A|1|careless"] }),
    q("Q/2.md", { last_error_type: "careless", result: "incorrect", "date attempted": "2026-10-05T09:00", history: ["d|incorrect|5|A|1|careless"] }),
    q("Q/3.md", { last_error_type: "misread", result: "incorrect", "date attempted": "2026-10-03T09:00", history: ["d|incorrect|5|A|1|misread"] }),
    q("Q/4.md", { last_error_type: "", result: "incorrect", "date attempted": "2026-10-03T09:00", history: ["d|incorrect|5|A|1|"] }),
    q("Q/5.md", { last_error_type: "", result: "correct", history: ["d|incorrect|5|A|1|misread", "d|correct|5|A|1|"] }),
  ];
  const g = T.errorLog(list);
  assert.deepEqual(g.map((x) => x.type), ["careless", "misread", ""]);
  assert.equal(g[0].total, 3);
  assert.deepEqual(g[0].notes.map((n) => n.file.basename), ["2", "1"]); // newest attempt first
  assert.equal(g[1].notes.length, 1);
  assert.equal(g[1].total, 2); // one still missed, one fixed later
  assert.equal(g[2].notes.length, 1);
  assert.deepEqual(T.errorLog([q("Q/9.md", { result: "correct" })]), []);
});

test("buildTestSet picks distinct questions, never more than asked or available", () => {
  const pool = Array.from({ length: 6 }, (_v, i) => mk(`Q/${i}.md`, "s", i, 0, 0));
  const set = T.buildTestSet(pool, "random", 4, "2026-10-26", () => 0.5);
  assert.equal(set.length, 4);
  assert.equal(new Set(set.map((x) => x.file.path)).size, 4);
  assert.equal(T.buildTestSet(pool, "random", 50, "2026-10-26", Math.random).length, 6);
  assert.equal(T.buildTestSet(pool, "flagged", 3, "2026-10-26", Math.random).length, 0);
  assert.equal(T.suggestMinutes(10), 12);
  assert.equal(T.suggestMinutes(27), 32);
  assert.equal(T.suggestMinutes(0), 1);
});
