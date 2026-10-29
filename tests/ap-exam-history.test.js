"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ap = T.apScore;
const history = T.apExamHistory;

function biologyScores() {
  return {
    mcq: { score: 50 },
    frq: { long1: 8, long2: 7, short1: 4, short2: 3, short3: 3, short4: 3 },
  };
}

function biologyResult() {
  return ap.calculateApScore(ap.profileById("ap-biology"), biologyScores(), ap.DEFAULT_CUTOFFS);
}

function usHistoryScores() {
  return {
    mcq: { score: 45 },
    saq: { saq1: 3, saq2: 3, saq3: 2 },
    dbq: { score: 5 },
    leq: { score: 4 },
  };
}

function usHistoryResult() {
  return ap.calculateApScore(ap.profileById("ap-us-history"), usHistoryScores(), ap.DEFAULT_CUTOFFS);
}

test("AP exam history: a complete result becomes a note with durable properties and section detail", () => {
  const profile = ap.profileById("ap-biology");
  const note = history.buildApExamNote(profile, biologyResult(), ap.DEFAULT_CUTOFFS, "2026-10-29");
  assert.equal(note.path, "AP practice exams/2026-10-29 AP Biology 82.8.md");
  assert.equal(note.frontmatter.type, "ap_practice_exam");
  assert.equal(note.frontmatter.ap_course, "ap-biology");
  assert.equal(note.frontmatter.taken_on, "2026-10-29");
  assert.equal(note.frontmatter.composite, 82.8);
  assert.equal(note.frontmatter.estimated_ap_score, 5);
  assert.equal(note.frontmatter.frq_earned, 28);
  assert.equal(note.frontmatter.frq_max, 34);
  assert.equal(note.frontmatter.frq_percent, 82.4);
  assert.equal(note.frontmatter.frq_frq_earned, 28);
  assert.equal(note.frontmatter.frq_frq_max, 34);
  assert.equal(note.frontmatter.cut_score_5, 75);
  assert.match(note.text, /AP practice exam: AP Biology/);
  assert.match(note.text, /\| Multiple choice \| 50% \| 50 \/ 60 \| 83.3% \|/);
  assert.match(note.text, /\| Free response \| 50% \| 28 \/ 34 \| 82.4% \|/);
  assert.match(note.text, /not a College Board score/i);
  assert.match(note.text, /## Written scores/);
  assert.match(note.text, /\| Free response \| Long question 1 \| 8 \/ 9 \|/);
  assert.match(note.text, /## Practice cut scores/);
  assert.match(note.text, /Add what to review/);
  assert.equal(note.entry.course, "AP Biology");
  assert.equal(note.entry.estimated, 5);
  assert.equal(note.entry.frqEarned, 28);
  assert.equal(note.entry.frqMax, 34);
  assert.equal(note.entry.frqPercent, 82.4);
});

test("AP exam history: AP U.S. History keeps SAQ, DBQ and LEQ scores separately", () => {
  const profile = ap.profileById("ap-us-history");
  const result = usHistoryResult();
  assert.equal(result.composite, 78.4);
  const note = history.buildApExamNote(profile, result, ap.DEFAULT_CUTOFFS, "2026-10-29");
  assert.equal(note.frontmatter.frq_earned, 17);
  assert.equal(note.frontmatter.frq_max, 22);
  assert.equal(note.frontmatter.frq_percent, 77.3);
  assert.equal(note.frontmatter.frq_saq_earned, 8);
  assert.equal(note.frontmatter.frq_saq_max, 9);
  assert.equal(note.frontmatter.frq_dbq_earned, 5);
  assert.equal(note.frontmatter.frq_leq_earned, 4);
  assert.match(note.text, /\| Short answer \| Short answer 1 \| 3 \/ 3 \|/);
  assert.match(note.text, /\| Document-based question \| Document-based question \| 5 \/ 7 \|/);
  assert.match(note.text, /\| Long essay \| Long essay \| 4 \/ 6 \|/);
  assert.equal(note.entry.frqEarned, 17);
  assert.equal(note.entry.frqPercent, 77.3);
});

test("AP exam history: an incomplete estimate cannot be saved or parsed as a result", () => {
  const profile = ap.profileById("ap-biology");
  const partial = ap.calculateApScore(profile, { mcq: { score: 50 } }, ap.DEFAULT_CUTOFFS);
  assert.equal(history.buildApExamNote(profile, partial, ap.DEFAULT_CUTOFFS, "2026-10-29"), null);
  assert.equal(history.entryFromFrontmatter({ type: "ap_practice_exam", ap_course: "ap-biology" }, "x.md"), null);
});

test("AP exam history: duplicate dates get a unique filename instead of overwriting", () => {
  const profile = ap.profileById("ap-biology");
  const note = history.buildApExamNote(profile, biologyResult(), ap.DEFAULT_CUTOFFS, "2026-10-29");
  const existing = new Set([note.path, note.path.replace(/\.md$/, " 2.md")]);
  assert.equal(history.uniqueApExamPath(note, (path) => existing.has(path)), note.path.replace(/\.md$/, " 3.md"));
  assert.equal(history.uniqueApExamPath(note, () => false), note.path);
});

test("AP exam history: entries sort newest first and report the latest change", () => {
  const entries = [
    { path: "b.md", takenOn: "2026-09-20", composite: 60, estimated: 2, frqPercent: 60, frqEarned: 20, frqMax: 34 },
    { path: "c.md", takenOn: "2026-10-20", composite: 80, estimated: 5, frqPercent: 80, frqEarned: 27, frqMax: 34 },
    { path: "a.md", takenOn: "2026-10-01", composite: 70, estimated: 4, frqPercent: 70, frqEarned: 24, frqMax: 34 },
  ];
  const sorted = history.sortApExamEntries(entries);
  assert.deepEqual(sorted.map((entry) => entry.composite), [80, 70, 60]);
  const trend = history.apExamTrend(entries);
  assert.equal(trend.count, 3);
  assert.equal(trend.average, 70);
  assert.equal(trend.latest.composite, 80);
  assert.equal(trend.previous.composite, 70);
  assert.equal(trend.delta, 10);
  assert.equal(trend.direction, "up");
  assert.equal(trend.frqAverage, 70);
  assert.equal(trend.frqLatest.composite, 80);
  assert.equal(trend.frqDelta, 10);
  assert.equal(trend.frqDirection, "up");
  const noFrq = history.apExamTrend([{ composite: 70, takenOn: "2026-10-01" }]);
  assert.equal(noFrq.frqAverage, null);
  assert.equal(noFrq.frqDelta, null);
  assert.equal(history.apExamTrend([]).direction, "none");
});

test("AP exam history: a saved note is found by the plugin and a second save is unique", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const profile = ap.profileById("ap-biology");
  const result = biologyResult();

  const first = await plugin.saveApExamResult(profile, result, ap.DEFAULT_CUTOFFS, "2026-10-29");
  assert.ok(app.folders.includes("AP practice exams"));
  assert.equal(first.path, "AP practice exams/2026-10-29 AP Biology 82.8.md");
  assert.match(first.file.text, /estimated_ap_score: 5/);

  // The real metadata cache indexes the new note asynchronously; the fake cache
  // needs the frontmatter attached explicitly.
  first.file.fm = first.frontmatter;
  assert.equal(plugin.getApExamHistory().length, 1);
  assert.equal(plugin.getApExamHistory()[0].composite, 82.8);

  const second = await plugin.saveApExamResult(profile, result, ap.DEFAULT_CUTOFFS, "2026-10-29");
  assert.equal(second.path, "AP practice exams/2026-10-29 AP Biology 82.8 2.md");

  await assert.rejects(() => plugin.saveApExamResult(profile, ap.calculateApScore(profile, {}, ap.DEFAULT_CUTOFFS)), /Enter every section/);
});

test("AP exam history: the Reference tab saves a result and shows the trend", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "ap";
  view.apScores = biologyScores();
  view.render();

  assert.ok(dom.texts().includes("Save practice exam"));
  assert.ok(dom.texts().includes("Saved practice exams"));
  assert.ok(dom.texts().includes("No saved practice exams yet. Enter every section and save one to start a trend."));

  const profile = ap.profileById("ap-biology");
  await view.saveApExam(profile, biologyResult());
  assert.equal(app.created.length, 1);
  assert.ok(dom.texts().some((text) => text.includes("2026-") && text.includes("AP Biology")));
  assert.ok(dom.texts().some((text) => text.includes("1 saved") && text.includes("82.8%")));
  assert.ok(dom.texts().some((text) => text.includes("FRQ avg 82.4%")));
  assert.ok(dom.texts().some((text) => text.includes("FRQ 28/34 (82.4%)")));
});
