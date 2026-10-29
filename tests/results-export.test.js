"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ex = T.resultsExport;

const QUESTION = {
  file: { path: "Q/a.md" },
  fm: {
    question_id: "q1",
    course: "BIO",
    skill: "cells",
    attempts: 2,
    correct_count: 1,
    time_spent_total: 30,
    result: "incorrect",
    "date attempted": "2026-10-01T10:00",
    next_review: "2026-10-02",
    last_confidence: "Unsure",
    last_error_type: "careless",
    source_pdf: "Papers/Exam.pdf",
    source_page: 3,
    history: ["2026-10-01T10:00|incorrect|12|A|2|careless", "2026-10-02T11:00|correct|18|B|3|"],
  },
};

const CARD = {
  file: { path: "Cards/b.md" },
  deck: "Biology",
  course: "BIO",
  fm: { card_id: "c1", attempts: 0, correct_count: 0, time_spent_total: 0 },
};

test("CSV cells quote commas, quotes and newlines, and neutralise formulas", () => {
  assert.equal(ex.csvCell("plain"), "plain");
  assert.equal(ex.csvCell("a,b"), '"a,b"');
  assert.equal(ex.csvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(ex.csvCell("one\ntwo"), '"one\ntwo"');
  assert.equal(ex.csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(ex.csvLine(["a", "b,c"]), 'a,"b,c"');
});

test("summary CSV has one row per note with accuracy, timing, status and source", () => {
  const out = ex.buildResultsCsv([QUESTION], [CARD], { today: "2026-10-03" });
  assert.equal(out.columns[0], "kind");
  assert.equal(out.rows.length, 2);
  const q = out.rows.find((row) => row.kind === "question");
  assert.equal(q.id, "q1");
  assert.equal(q.attempts, "2");
  assert.equal(q.correct_count, "1");
  assert.equal(q.accuracy, "0.5");
  assert.equal(q.accuracy_percent, "50");
  assert.equal(q.average_seconds, "15");
  assert.equal(q.due, "true");
  assert.equal(q.source, "Exam.pdf");
  assert.equal(q.source_link, "[[Papers/Exam.pdf#page=3]]");
  const c = out.rows.find((row) => row.kind === "card");
  assert.equal(c.deck, "Biology");
  assert.equal(c.due, "false");
  assert.match(out.text, /^kind,id,path,deck,course,/);
  assert.match(out.text, /question,q1,Q\/a\.md/);
});

test("attempt CSV has one row per stored attempt, with the pipe fields split out", () => {
  const out = ex.buildAttemptsCsv([QUESTION], [CARD]);
  assert.equal(out.rows.length, 2);
  assert.equal(out.rows[0].attempt, "1");
  assert.equal(out.rows[0].result, "incorrect");
  assert.equal(out.rows[0].seconds, "12");
  assert.equal(out.rows[0].answer, "A");
  assert.equal(out.rows[0].confidence, "2");
  assert.equal(out.rows[0].error_type, "careless");
  assert.equal(out.rows[1].result, "correct");
  assert.match(out.text, /^kind,id,path,deck,course,attempt,when,result,seconds,answer,confidence,error_type\n/);
});

test("export file names are stable and date-safe", () => {
  assert.deepEqual(ex.resultFileNames("2026-10-29"), {
    summary: "mcq-results-2026-10-29.csv",
    attempts: "mcq-attempts-2026-10-29.csv",
  });
  assert.deepEqual(ex.resultFileNames("not a date"), {
    summary: "mcq-results-export.csv",
    attempts: "mcq-attempts-export.csv",
  });
});

test("plugin: export writes the summary and attempt CSVs into the vault", async () => {
  const app = makeApp([{ path: "Q/a.md", fm: QUESTION.fm }]);
  const plugin = new QT(app);
  await plugin.onload();
  app.created = [];
  const result = await plugin.exportResultsCsv();
  assert.deepEqual(result.paths, ["mcq-results-" + T.fmtDate(new Date()) + ".csv", "mcq-attempts-" + T.fmtDate(new Date()) + ".csv"]);
  assert.equal(app.created.length, 2);
  const summary = app.created.find((file) => file.path.startsWith("mcq-results-"));
  assert.match(summary.text, /question,q1,Q\/a\.md/);
  assert.match(summary.text, /Papers\/Exam\.pdf/);
  const attempts = app.created.find((file) => file.path.startsWith("mcq-attempts-"));
  assert.match(attempts.text, /2026-10-01T10:00/);
  assert.match(attempts.text, /careless/);
});
