"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const ST = T.studyTools;
const C = T.cornell;

async function setup(saved) {
  const plugin = new QT(makeApp([]));
  if (saved) plugin.saved = saved;
  await plugin.onload();
  return plugin;
}

test("study tools: each independent module defaults on and can be switched off", () => {
  const defaults = ST.normalizeStudyToolsSettings({});
  assert.deepEqual(Object.keys(defaults), ["cornellNotes", "lectureLog", "studyGoals"]);
  assert.equal(defaults.cornellNotes.enabled, true);
  assert.equal(defaults.lectureLog.enabled, true);
  assert.equal(defaults.studyGoals.enabled, true);
  const off = ST.normalizeStudyToolsSettings({
    cornellNotes: { enabled: false },
    lectureLog: { enabled: false },
    studyGoals: { enabled: false },
  });
  assert.equal(off.cornellNotes.enabled, false);
  assert.equal(off.lectureLog.enabled, false);
  assert.equal(off.studyGoals.enabled, false);
});

test("lecture log: parses bulk lines, rejects bad dates and finds the next lecture", () => {
  const parsed = ST.parseLectureLines("Biology | 2026-11-02 | Respiration | glycolysis\nChemistry | 2026-13-01 | Bad date");
  assert.equal(parsed.lectures.length, 1);
  assert.equal(parsed.lectures[0].title, "Respiration");
  assert.match(parsed.issues.join(" "), /real YYYY-MM-DD/);
  assert.equal(ST.nextLecture(parsed.lectures, "2026-11-01").title, "Respiration");
  assert.equal(ST.nextLecture(parsed.lectures, "2026-11-03"), null);
});

test("study goals: progress, completion and an exam-plan shortcut", () => {
  const goal = ST.createStudyGoal({ title: "Finish unit 3", course: "Biology", targetMinutes: 60, due: "2026-11-03" }, 1);
  assert.equal(ST.goalPercent(goal), 0);
  assert.equal(ST.goalSummary([goal]).open, 1);
  const exam = ST.examGoalFromPlan({ course: "Biology", daysLeft: 4 }, "2026-10-31");
  assert.equal(exam.title, "Biology exam prep");
  assert.equal(exam.due, "2026-11-04");
  assert.equal(exam.targetMinutes, 180);
  assert.equal(ST.formatStudyMinutes(75), "1h 15m");
});

test("Cornell notes: parses cues and summary and explains malformed blocks", () => {
  const parsed = C.parseCornellNote(`Title: Respiration\nCourse: Biology\nCue: What is glycolysis?\nNote: Splits glucose into pyruvate.\nCue: Where is the Krebs cycle?\nNote: Mitochondrial matrix.\nSummary: Respiration makes ATP.`);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.title, "Respiration");
  assert.equal(parsed.cues.length, 2);
  assert.equal(parsed.summary, "Respiration makes ATP.");
  const bad = C.parseCornellNote("Note: orphan\nCue: no answer");
  assert.equal(bad.valid, false);
  assert.match(bad.issues.join(" "), /Cue: line/);
  assert.match(bad.issues.join(" "), /no Note/);
  assert.match(C.cornellTemplate("Cells", "Biology"), /Cue: What is the main idea\?/);
  assert.match(C.buildCornellNote("Cells", "Biology"), /cornell: true/);
});

test("plugin: separate switches gate the Study Tools view and the Cornell block", async () => {
  const plugin = await setup();
  assert.equal(plugin.studyToolsEnabled(), true);
  plugin.settings.cornellNotes.enabled = false;
  const view = new T.StudyToolsView({ app: plugin.app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Study Tools"));
  assert.ok(dom.texts().includes("Goals"));
  assert.ok(!dom.texts().includes("Cornell notes"));
  const block = makeDom();
  plugin.codeBlocks["cornell-note"]("Title: Cells\nCue: What?\nNote: Answer.", block.root, {});
  assert.ok(block.texts().some((text) => /Cornell notes are off/.test(text)));

  plugin.settings.lectureLog.enabled = false;
  plugin.settings.studyGoals.enabled = false;
  view.render();
  assert.ok(dom.texts().some((text) => /Study Tools are off/.test(text)));
});

test("plugin: goals and lectures persist locally and a Cornell note is created", async () => {
  const plugin = await setup();
  const goal = await plugin.addStudyGoal({ title: "Read chapter 4", course: "Biology", targetMinutes: 30 });
  assert.ok(goal);
  await plugin.addStudyGoalProgress(goal.id, 15);
  assert.equal(plugin.studyToolsSettings().studyGoals.goals[0].minutes, 15);
  const lecture = await plugin.addStudyLecture({ course: "Biology", date: "2026-11-02", title: "Respiration" });
  assert.ok(lecture);
  assert.equal(plugin.studyToolsSettings().lectureLog.lectures.length, 1);
  const file = await plugin.createCornellNote({ title: "Respiration", course: "Biology" });
  assert.match(file.path, /Study Tools\/Cornell\/Respiration\.md/);
  assert.match(file.text, /```cornell-note/);
  const restarted = new QT(makeApp([]));
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.studyToolsSettings().studyGoals.goals.length, 1);
  assert.equal(restarted.studyToolsSettings().lectureLog.lectures.length, 1);
});

test("Today: the study-tools card appears only when a goal or lecture is available", async () => {
  const plugin = await setup();
  plugin.settings.studyGoals.goals = [
    ST.createStudyGoal({ title: "Finish chapter 2", targetMinutes: 60, due: "2099-01-01" }, 1),
  ];
  const view = new T.TodayView({ app: plugin.app }, plugin);
  const dom = makeDom();
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Study Tools"));
  assert.ok(dom.texts().some((text) => /Finish chapter 2/.test(text)));
  assert.ok(dom.texts().some((text) => /Open Study Tools/.test(text)));

  plugin.settings.studyGoals.enabled = false;
  const after = makeDom();
  view.contentEl = after.root;
  view.render();
  assert.ok(!after.texts().some((text) => /Finish chapter 2/.test(text)));
});
