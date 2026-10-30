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

/* ---- trends */

const withHistory = (path, skill, lines) => q(path, { skill, history: lines });

test("weeklyAccuracy buckets every attempt by week, oldest first, and ignores older ones", () => {
  const today = new Date(2026, 9, 27); // Tuesday 27 Oct 2026; its week starts Monday 26 Oct
  const list = [
    withHistory("Q/1.md", "a", [
      "2026-10-26T09:00|correct|10|A|3|",
      "2026-10-27T09:00|incorrect|10|A|3|x",
      "2026-10-19T09:00|correct|10|A|3|", // the week before
      "2026-08-01T09:00|correct|10|A|3|", // far outside the last 4 weeks
    ]),
  ];
  const weeks = T.weeklyAccuracy(list, today, 4);
  assert.equal(weeks.length, 4);
  assert.deepEqual(weeks.map((w) => w.start), ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.deepEqual(weeks.map((w) => w.attempts), [0, 0, 1, 2]);
  assert.equal(weeks[3].accuracy, 0.5);
  assert.equal(weeks[2].accuracy, 1);
  assert.equal(weeks[0].accuracy, null);
  assert.equal(T.weekStart(new Date(2026, 9, 25)).getDate(), 19); // a Sunday belongs to the week that began the Monday before
});

test("trendBy and trendDelta compare the last two weeks with what came before", () => {
  const today = new Date(2026, 9, 27);
  const rows = (...r) => r.map((x, i) => `2026-10-${String(x[0]).padStart(2, "0")}T09:00|${x[1]}|5|A|3|`);
  const list = [
    withHistory("Q/1.md", "a", rows([1, "incorrect"], [2, "incorrect"], [3, "incorrect"], [4, "correct"], [24, "correct"], [25, "correct"], [26, "correct"])),
    withHistory("Q/2.md", "b", rows([25, "correct"])),
  ];
  const t = T.trendBy(list, "skill", today, 14);
  assert.deepEqual(t.get("a"), { recent: { n: 3, c: 3 }, earlier: { n: 4, c: 1 } });
  assert.equal(T.trendDelta(t.get("a")), 75); // 100% now versus 25% before
  assert.equal(T.trendDelta(t.get("b")), null); // not enough on either side to say
  assert.equal(T.trendDelta(undefined), null);
});

/* ---- a saved timed test */

test("a timed test is packed small and unpacked safely", () => {
  const items = [
    { file: { path: "Q/a.md" }, sel: "B", seconds: 12.6, flagged: true },
    { file: { path: "Q/b.md" }, sel: "", seconds: 0, flagged: false },
  ];
  const s = T.packTestSession(items, { idx: 1, startedAt: 1000, deadline: 61000, allowedSeconds: 60 });
  assert.deepEqual(s.items[0], { path: "Q/a.md", sel: "B", seconds: 13, flagged: true });
  const live = T.unpackTestSession(JSON.parse(JSON.stringify(s)), 30000);
  assert.equal(live.expired, false);
  assert.equal(live.idx, 1);
  assert.equal(live.items.length, 2);
  const withSections = T.packTestSession(items, {
    idx: 0,
    startedAt: 1000,
    deadline: 121000,
    allowedSeconds: 120,
    sectionIdx: 1,
    sections: [
      { name: "Reading", count: 1, minutes: 1, endAt: 61000 },
      { name: "Writing", count: 1, minutes: 1, endAt: 121000 },
    ],
  });
  const sectionPlan = T.unpackTestSession(JSON.parse(JSON.stringify(withSections)), 30000);
  assert.equal(sectionPlan.sections.length, 2);
  assert.equal(sectionPlan.sections[1].name, "Writing");
  assert.equal(sectionPlan.sections[1].endAt, 121000);
  assert.equal(sectionPlan.sectionIdx, 1);
  const over = T.unpackTestSession(s, 61000 + 60000);
  assert.equal(over.expired, true);
  // days later it is dropped rather than graded
  assert.equal(T.unpackTestSession(s, 61000 + 13 * 3600 * 1000), null);
  // junk is dropped
  assert.equal(T.unpackTestSession(null, 0), null);
  assert.equal(T.unpackTestSession({ v: 2 }, 0), null);
  assert.equal(T.unpackTestSession({ v: 1, items: [], deadline: 1, startedAt: 1, allowedSeconds: 1 }, 0), null);
  assert.equal(T.unpackTestSession({ v: 1, items: [{ path: "x" }], deadline: "soon", startedAt: 1, allowedSeconds: 1 }, 0), null);
  assert.equal(T.unpackTestSession({ ...s, idx: 99 }, 30000).idx, 1); // out-of-range position is clamped
});

test("a saved timed test keeps shuffled choice order and the pass mark", () => {
  const items = [{ file: { path: "Q/a.md" }, sel: "C", seconds: 0, flagged: false, optionOrder: ["C", "A", "D", "B"] }];
  const packed = T.packTestSession(items, {
    idx: 0,
    startedAt: 1000,
    deadline: 61000,
    allowedSeconds: 60,
    shuffleChoices: true,
    passScore: 85,
  });
  assert.deepEqual(packed.items[0].order, ["C", "A", "D", "B"]);
  assert.equal(packed.shuffleChoices, true);
  assert.equal(packed.passScore, 85);
  const live = T.unpackTestSession(JSON.parse(JSON.stringify(packed)), 30000);
  assert.deepEqual(live.items[0].order, ["C", "A", "D", "B"]);
  assert.equal(live.shuffleChoices, true);
  assert.equal(live.passScore, 85);
  assert.equal(T.unpackTestSession({ ...packed, passScore: 150 }, 30000).passScore, 100);
  assert.equal(T.unpackTestSession({ ...packed, passScore: -4 }, 30000).passScore, 0);
});
