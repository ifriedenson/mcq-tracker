"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin } = load();
const q = (path, fm) => ({ file: { path, basename: path.split("/").pop().replace(/\.md$/, "") }, fm: Object.assign({ question_id: "Q" }, fm) });

test("dashboard embeds parse metric, weeks, course and title", () => {
  const opts = T.parseDashboardBlock("metric: Heatmap\nweeks: 52\ncourse: Biology\ntitle: Bio dashboard");
  assert.deepEqual(opts, { metric: "heatmap", weeks: 26, course: "Biology", title: "Bio dashboard" });
  assert.equal(T.parseDashboardBlock("metric: unknown").metric, "overview");
  assert.equal(T.parseDashboardBlock("weeks: nope").weeks, 12);
  assert.deepEqual(T.parseDashboardBlock(""), { metric: "overview", weeks: 12, course: "", title: "" });
});

test("dashboard course scoping filters questions, cards and study sessions", () => {
  const questions = [
    q("Q/bio.md", { course: "Biology", attempts: 2, correct_count: 1, skill: "cells" }),
    q("Q/chem.md", { course: "Chemistry", attempts: 3, correct_count: 3, skill: "bonds" }),
  ];
  const cards = [
    { file: { path: "Cards/bio.md" }, fm: { course: "Biology", attempts: 3, next_review: "2026-10-20" } },
    { file: { path: "Cards/chem.md" }, fm: { course: "Chemistry", attempts: 0 } },
  ];
  const studyLog = {
    sessions: [
      { date: "2026-10-27", minutes: 40, course: "Biology" },
      { date: "2026-10-27", minutes: 30, course: "Chemistry" },
    ],
    dailyGoalMinutes: 60,
  };
  const bio = T.buildDashboard({ questions, cards, studyLog, today: "2026-10-28", course: "biology" });
  assert.equal(bio.overall.notes, 1);
  assert.equal(bio.overall.attempts, 2);
  assert.equal(bio.cardStats.total, 1);
  assert.equal(bio.cardStats.due, 1);
  assert.deepEqual(bio.byCourse, [["Biology", 40]]);
  assert.equal(bio.heatmap.reduce((n, week) => n + week.days.reduce((m, day) => m + day.minutes, 0), 0), 40);
});

test("dashboard embed draws only the requested metric and keeps the empty state honest", () => {
  const data = T.buildDashboard({
    questions: [q("Q/bio.md", { course: "Biology", attempts: 2, correct_count: 1, skill: "cells" })],
    cards: [],
    studyLog: { sessions: [{ date: "2026-10-27", minutes: 20, course: "Biology" }], dailyGoalMinutes: 60 },
    today: "2026-10-28",
  });
  const heat = makeDom();
  T.renderDashboardEmbed(heat.root, data, { metric: "heatmap", title: "Bio heatmap" });
  const heatText = heat.texts();
  assert.ok(heatText.includes("Bio heatmap"));
  assert.ok(heatText.includes("Study heatmap"));
  assert.ok(!heatText.includes("Attempts"));
  assert.ok(!heatText.includes("Weak spots"));

  const empty = makeDom();
  T.renderDashboardEmbed(empty.root, T.buildDashboard({ today: "2026-10-28" }), { metric: "stats", course: "History" });
  assert.ok(empty.texts().some((text) => /No study activity for History yet/.test(text)));
});

test("plugin registers mcq-dashboard and renders the selected widget", async () => {
  const app = makeApp([
    { path: "Questions/sat/Q1.md", fm: { course: "SAT", skill: "grammar", attempts: 2, correct_count: 1 } },
  ]);
  const plugin = new Plugin(app);
  await plugin.onload();
  assert.equal(typeof plugin.codeBlocks["mcq-dashboard"], "function");
  const dom = makeDom();
  plugin.codeBlocks["mcq-dashboard"]("metric: stats\ncourse: SAT\nweeks: 4", dom.root);
  const texts = dom.texts();
  assert.ok(texts.some((text) => /Study stats · SAT/.test(text)));
  assert.ok(texts.includes("Attempts"));
  assert.ok(texts.includes("Refresh"));
  assert.ok(!texts.includes("Weak spots"));
});
