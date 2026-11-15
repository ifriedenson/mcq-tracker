"use strict";
/*
 * Task input understands times: "review at 3pm", "call 9am", "15:30",
 * "in 2 hours", "tonight", "noon". A time sets an HH:MM beside the due date,
 * a bare hour means the next time it comes round, and "in N hours/minutes" is
 * real clock math that can roll past midnight. Still dependency-free and
 * local: no chrono, no server.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const TD = T.taskDates;
const W = T.studyWorkspace;
const TM = T.taskMirror;
const F = T.focusDay;

// 2026-11-15 is a Sunday; every expectation below counts from it.
const REF = "2026-11-15";
const AT_4PM = new Date(2026, 10, 15, 16, 0);

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  return { app, plugin };
}

/* ---- the clock parser --------------------------------------------------- */

test("task times: every clock shape people type", () => {
  assert.equal(TD.parseTaskTime("review at 3pm").time, "15:00");
  assert.equal(TD.parseTaskTime("review at 3pm").matched, "at 3pm");
  assert.equal(TD.parseTaskTime("review 3:30 pm").time, "15:30");
  assert.equal(TD.parseTaskTime("review 3:30pm").time, "15:30");
  assert.equal(TD.parseTaskTime("review at 15:00").time, "15:00");
  assert.equal(TD.parseTaskTime("review 09:05").time, "09:05");
  assert.equal(TD.parseTaskTime("review at 9").time, "09:00");
  assert.equal(TD.parseTaskTime("review 3p").time, "15:00");
  assert.equal(TD.parseTaskTime("review 9a").time, "09:00");
  assert.equal(TD.parseTaskTime("review 12am").time, "00:00");
  assert.equal(TD.parseTaskTime("review 12pm").time, "12:00");
});

test("task times: named hours, and the words nobody means as a time", () => {
  assert.equal(TD.parseTaskTime("quiz at noon").time, "12:00");
  assert.equal(TD.parseTaskTime("quiz at midnight").time, "00:00");
  assert.equal(TD.parseTaskTime("quiz tonight").time, "20:00");
  assert.equal(TD.parseTaskTime("quiz this evening").time, "18:00");
  assert.equal(TD.parseTaskTime("quiz this morning").time, "09:00");
  assert.equal(TD.parseTaskTime("read chapter 9").time, "");
  assert.equal(TD.parseTaskTime("read 2 books").time, "");
  assert.equal(TD.parseTaskTime("review at 25:00").time, "");
  assert.equal(TD.parseTaskTime("review at 13pm").time, "");
  assert.equal(TD.parseTaskTime("").time, "");
});

test("task times: HH:MM reads as a friendly clock", () => {
  assert.equal(TD.validTime("15:30"), "15:30");
  assert.equal(TD.validTime("9:5"), "");
  assert.equal(TD.validTime("25:00"), "");
  assert.equal(TD.validTime(undefined), "");
  assert.equal(TD.formatTaskTime("15:30"), "3:30 PM");
  assert.equal(TD.formatTaskTime("09:00"), "9 AM");
  assert.equal(TD.formatTaskTime("00:00"), "12 AM");
  assert.equal(TD.formatTaskTime("12:00"), "12 PM");
  assert.equal(TD.formatTaskTime(""), "");
});

/* ---- day and time together ---------------------------------------------- */

test("task when: an hour already gone by means tomorrow", () => {
  assert.deepEqual(TD.extractTaskWhen("review at 3pm", AT_4PM), { title: "review", due: "2026-11-16", time: "15:00" });
  assert.deepEqual(TD.extractTaskWhen("call at 9am", AT_4PM), { title: "call", due: "2026-11-16", time: "09:00" });
  assert.deepEqual(TD.extractTaskWhen("standup at 5pm", AT_4PM), { title: "standup", due: "2026-11-15", time: "17:00" });
  // With no clock to compare against, today is the honest answer.
  assert.deepEqual(TD.extractTaskWhen("review at 3pm", REF), { title: "review", due: "2026-11-15", time: "15:00" });
});

test("task when: a stated day wins, and tonight never rolls", () => {
  assert.deepEqual(TD.extractTaskWhen("study cells tomorrow at 15:30", AT_4PM), {
    title: "study cells",
    due: "2026-11-16",
    time: "15:30",
  });
  assert.deepEqual(TD.extractTaskWhen("drill verbs Tuesday at 8am", REF), {
    title: "drill verbs",
    due: "2026-11-17",
    time: "08:00",
  });
  const late = new Date(2026, 10, 15, 21, 0);
  assert.deepEqual(TD.extractTaskWhen("quiz tonight", late), { title: "quiz", due: "2026-11-15", time: "20:00" });
});

test("task when: in N hours is real clock math that rolls past midnight", () => {
  const night = new Date(2026, 10, 15, 23, 30);
  assert.deepEqual(TD.extractTaskWhen("water plants in 2 hours", night), {
    title: "water plants",
    due: "2026-11-16",
    time: "01:30",
  });
  assert.deepEqual(TD.extractTaskWhen("stretch in 30 minutes", AT_4PM), {
    title: "stretch",
    due: "2026-11-15",
    time: "16:30",
  });
  assert.deepEqual(TD.extractTaskWhen("stretch in an hour", AT_4PM), {
    title: "stretch",
    due: "2026-11-15",
    time: "17:00",
  });
  // The old day-based "in N days" still works and brings no time.
  assert.deepEqual(TD.extractTaskWhen("essay in 3 days", REF), { title: "essay", due: "2026-11-18", time: "" });
});

test("task when: a plain title is left exactly as typed", () => {
  assert.deepEqual(TD.extractTaskWhen("Practice 8 AP World questions today", REF), {
    title: "Practice 8 AP World questions",
    due: "2026-11-15",
    time: "",
  });
  assert.deepEqual(TD.extractTaskWhen("Mark the mock exam", REF), { title: "Mark the mock exam", due: "", time: "" });
  assert.deepEqual(TD.extractTaskWhen("   ", REF), { title: "", due: "", time: "" });
  // The date-only helper is unchanged for callers that never wanted a time.
  assert.deepEqual(TD.extractTaskDue("review at 3pm today", REF), { title: "review at 3pm", due: "2026-11-15" });
});

/* ---- the task model and the add path ------------------------------------ */

test("study tasks: a time normalizes or drops", () => {
  assert.equal(W.createStudyTask({ title: "Drill", time: "15:00" }, 0).time, "15:00");
  assert.equal(W.createStudyTask({ title: "Drill", time: "9:5" }, 0).time, "");
  assert.equal(W.createStudyTask({ title: "Drill", time: "25:00" }, 0).time, "");
  assert.equal(W.createStudyTask({ title: "Drill" }, 0).time, "");
});

test("plugin: typing a time sets it, and a picked day or time wins", async () => {
  const { plugin } = await setup();
  const spoken = await plugin.addStudyTask({ title: "Review Biochem at 7pm" });
  assert.equal(spoken.time, "19:00");
  assert.equal(spoken.title, "Review Biochem");
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(spoken.due), "an hour alone still dates the task");

  const picked = await plugin.addStudyTask({ title: "Review Biochem at 7pm", due: "2099-06-10" });
  assert.equal(picked.due, "2099-06-10", "the date picker wins");
  assert.equal(picked.time, "19:00");
  assert.equal(picked.title, "Review Biochem");

  const both = await plugin.addStudyTask({ title: "Review at 7pm", due: "2099-06-10", time: "08:00" });
  assert.equal(both.time, "08:00", "an explicit time wins");
  assert.equal(both.due, "2099-06-10");
});

test("task list: the due chip names the time", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  await plugin.addStudyTask({ title: "Timed task", due: day(0), time: "15:00" });
  const dom = makeDom();
  const view = new T.TaskListView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().includes("Due today · 3 PM"), "the chip reads Due today · 3 PM");
  assert.ok(dom.texts().includes("Tip: name a day (tomorrow, Tuesday), a time (at 3pm, in 2 hours) or a repeat (every Monday, daily) to schedule it. Star the urgent ones."));
});

test("focus day: a scratch task keeps its time beside the day", () => {
  const at = new Date(2026, 10, 15, 9, 0);
  const when = TD.extractTaskWhen("message tutor in 2 hours", at);
  const tasks = F.addFocusTask([], when.title, "t1", when.due, when.time);
  assert.equal(tasks[0].text, "message tutor");
  assert.equal(tasks[0].due, "2026-11-15");
  assert.equal(tasks[0].time, "11:00");
  assert.equal(F.normalizeFocusTasks([{ text: "x", time: "9:5" }])[0].time, "");
  assert.equal(TD.dueChipLabel("2026-11-15", "2026-11-15", "11:00"), "Due today · 11 AM");
});

/* ---- the note mirror ---------------------------------------------------- */

test("mirror: the time rides along in Tasks syntax", () => {
  const line = TM.studyTaskLine({ title: "Review Biochem", due: "2026-11-16", time: "15:00", priority: "high", tags: ["bio"] });
  assert.equal(line, "- [ ] Review Biochem 📅 2026-11-16 ⏰ 15:00 ⏫ #bio");
  assert.equal(TM.studyTaskLine({ title: "Read ⏰ 9am", due: "" }), "- [ ] Read 9am", "a stray clock emoji leaves the title");
  assert.equal(TM.studyTaskLine({ title: "Read", due: "", time: "99:99" }), "- [ ] Read", "a broken time is left out");
});

test("mirror: same day sorts by clock, unscheduled work last", () => {
  const markdown = TM.mirrorMarkdown(
    [
      { title: "Evening", due: "2026-11-16", time: "18:00" },
      { title: "Someday" },
      { title: "Morning", due: "2026-11-16", time: "09:00" },
    ],
    "2026-11-16"
  );
  const rows = markdown.split("\n").filter((line) => line.startsWith("- [ ]"));
  assert.deepEqual(rows, ["- [ ] Morning 📅 2026-11-16 ⏰ 09:00", "- [ ] Evening 📅 2026-11-16 ⏰ 18:00", "- [ ] Someday"]);
});
