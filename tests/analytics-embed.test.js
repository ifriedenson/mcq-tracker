"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin } = load();
const q = (path, fm) => ({ file: { path, basename: path.split("/").pop().replace(/\.md$/, "") }, fm: Object.assign({ question_id: "Q" }, fm) });
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("dashboard embeds parse metric, weeks, course and title", () => {
  const opts = T.parseDashboardBlock("metric: Heatmap\nweeks: 52\ncourse: Biology\ntitle: Bio dashboard");
  assert.deepEqual(opts, { metric: "heatmap", weeks: 26, course: "Biology", field: "skill", title: "Bio dashboard" });
  assert.equal(T.parseDashboardBlock("field: Domain").field, "domain");
  assert.equal(T.parseDashboardBlock("field: nope").field, "skill");
  assert.equal(T.parseDashboardBlock("metric: Confidence").metric, "calibration");
  assert.equal(T.parseDashboardBlock("metric: trend").metric, "retention");
  assert.equal(T.parseDashboardBlock("metric: unknown").metric, "overview");
  assert.equal(T.parseDashboardBlock("metric: mastery").metric, "mastery");
  assert.equal(T.parseDashboardBlock("metric: bands").metric, "mastery");
  assert.equal(T.parseDashboardBlock("masteryDays: 7").masteryDays, 7);
  assert.equal(T.parseDashboardBlock("masteryDays: 30").masteryDays, 30);
  assert.equal(T.parseDashboardBlock("masteryDays: 0").masteryDays, 0);
  assert.equal(T.parseDashboardBlock("masteryDays: 14").masteryDays, undefined);
  assert.equal(T.parseDashboardBlock("masteryDays: nope").masteryDays, undefined);
  assert.equal(T.parseDashboardBlock("weeks: nope").weeks, 12);
  assert.deepEqual(T.parseDashboardBlock(""), { metric: "overview", weeks: 12, course: "", field: "skill", title: "" });
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
    questions: [q("Q/bio.md", {
      course: "Biology",
      attempts: 2,
      correct_count: 1,
      skill: "cells",
      history: ["2026-10-26|correct|10|A|1|", "2026-10-27|incorrect|10|B|2|"],
    })],
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

  const calibration = makeDom();
  T.renderDashboardEmbed(calibration.root, data, { metric: "calibration" });
  assert.ok(calibration.texts().includes("Confidence calibration"));
  assert.ok(calibration.texts().includes("Guessing"));
  assert.ok(!calibration.texts().includes("Retention trend"));

  const retention = makeDom();
  T.renderDashboardEmbed(retention.root, data, { metric: "retention" });
  assert.ok(retention.texts().includes("Retention trend"));
  assert.ok(!retention.texts().includes("Confidence calibration"));

  const grades = makeDom();
  T.renderDashboardEmbed(grades.root, data, { metric: "grades" });
  assert.ok(grades.texts().includes("Grade snapshot"));
  assert.ok(grades.texts().includes("F"));
  assert.ok(!grades.texts().includes("Retention trend"));

  const masteryData = Object.assign({}, data, { mastery: T.buildMastery([q("Q/bio.md", { attempts: 2, correct_count: 1, course: "Biology" })]), masteryScope: "Biology", masteryDays: 0 });
  const mastery = makeDom();
  const started = [];
  T.renderDashboardEmbed(mastery.root, masteryData, { metric: "mastery" }, { onMasteryPractice: (band, label) => started.push({ band, label }) });
  assert.ok(mastery.texts().includes("Question mastery · All time"));
  assert.ok(mastery.texts().some((text) => /1 of 1 question in Biology tried/.test(text)));
  assert.ok(mastery.texts().includes("Needs work"));
  const practice = mastery.all.find((el) => el.meta && el.meta.attrs && /^Practice 1 needs work question in Biology$/.test(String(el.meta.attrs["aria-label"] || "")));
  assert.ok(practice, "the band has a practice button");
  practice.handlers.find((h) => h.ev === "click").fn({});
  assert.deepEqual(started, [{ band: "weak", label: "Needs work · Biology · all time" }]);

  const empty = makeDom();
  T.renderDashboardEmbed(empty.root, T.buildDashboard({ today: "2026-10-28" }), { metric: "stats", course: "History" });
  assert.ok(empty.texts().some((text) => /No study activity for History yet/.test(text)));
});

test("plugin registers mcq-dashboard and renders the selected widget", async () => {
  const app = makeApp([
    { path: "Questions/sat/Q1.md", fm: { course: "SAT", skill: "grammar", attempts: 2, correct_count: 1, history: [`${daysAgo(1)}|correct|10|A|1|`, `${daysAgo(2)}|incorrect|10|B|1|`, `${daysAgo(3)}|incorrect|10|C|1|`, `${daysAgo(10)}|correct|10|A|1|`] } },
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

  plugin.settings.masteryDays = 7;
  plugin.settings.masteryScope = "SAT";
  const masteryDom = makeDom();
  plugin.codeBlocks["mcq-dashboard"]("metric: mastery\ncourse: SAT\nweeks: 4", masteryDom.root);
  const masteryTexts = masteryDom.texts();
  assert.ok(masteryTexts.includes("Question mastery · Last 7 days"));
  assert.ok(masteryTexts.includes("↓ 1"));
  const masteryHeading = masteryDom.all.find((el) => el.meta && el.meta.tag === "h3" && el.meta.text === "Question mastery · Last 7 days");
  assert.ok(masteryHeading, "the mastery heading carries the compact trend");
  assert.equal(masteryHeading.meta.attrs.title, "-1 mastered vs the previous 7 days.");
  assert.ok(masteryTexts.some((text) => /1 of 1 question in SAT tried in the last 7 days/.test(text)));
  assert.ok(masteryTexts.includes("Needs work"));

  const inlineDom = makeDom();
  const started = [];
  plugin.practiceQuestionPool = async (pool, label) => started.push({ paths: pool.map((q) => q.file.path), label });
  plugin.codeBlocks["mcq-dashboard"]("metric: mastery\ncourse: SAT\nmasteryDays: 30", inlineDom.root);
  assert.ok(inlineDom.texts().includes("Question mastery · Last 30 days"));
  assert.equal(plugin.settings.masteryDays, 7);
  await inlineDom.click("Practice");
  assert.deepEqual(started, [{ paths: ["Questions/sat/Q1.md"], label: "Needs work · SAT · last 30 days" }]);
});
