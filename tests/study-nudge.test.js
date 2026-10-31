"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const N = T.studyNudge;

const at = (hour, day) => new Date(`${day || "2026-10-31"}T${String(hour).padStart(2, "0")}:05:00`);

test("study nudge: settings default off and clamp hours", () => {
  const settings = N.normalizeStudyNudgeSettings(undefined);
  assert.equal(settings.enabled, false);
  assert.equal(settings.hour, 9);
  assert.equal(settings.quietFrom, 22);
  assert.equal(settings.quietTo, 7);
  assert.equal(settings.ribbonLabel, true);
  assert.equal(N.normalizeStudyNudgeSettings({ enabled: true, hour: 99, quietFrom: -1 }).hour, 23);
  assert.equal(N.normalizeStudyNudgeSettings({ quietFrom: -1 }).quietFrom, 0);
  assert.equal(N.normalizeStudyNudgeSettings({ ribbonLabel: false }).ribbonLabel, false);
});

test("study nudge: text lists only due work and quiet hours wrap midnight", () => {
  assert.equal(N.nudgeText({}), "");
  assert.equal(N.nudgeText({ questions: 1 }), "1 question due today.");
  assert.equal(N.nudgeText({ questions: 3, cards: 2, tasks: 1 }), "3 questions, 2 cards, 1 task due today.");
  assert.equal(N.inQuietHours(23, 22, 7), true);
  assert.equal(N.inQuietHours(3, 22, 7), true);
  assert.equal(N.inQuietHours(9, 22, 7), false);
  assert.equal(N.inQuietHours(12, 9, 22), true);
  assert.equal(N.inQuietHours(9, 9, 22), true, "quiet starts at the from hour");
  assert.equal(N.inQuietHours(9, 5, 5), false);
});

test("study nudge: visible once a day after the hour and outside quiet time", () => {
  const base = { enabled: true, hour: 9, quietFrom: 22, quietTo: 7, lastShown: "" };
  const early = N.nudgeState(base, { questions: 2 }, at(8));
  assert.equal(early.visible, false);

  const onTime = N.nudgeState(base, { questions: 2 }, at(10));
  assert.equal(onTime.visible, true);
  assert.match(onTime.text, /2 questions/);
  assert.equal(onTime.badge, "MCQ · 2 questions due");

  assert.equal(N.nudgeState(base, {}, at(10)).visible, false, "no due work means no nudge");
  assert.equal(N.nudgeState(base, { questions: 2 }, at(23)).visible, false, "quiet hours suppress it");
  assert.equal(N.nudgeState({ ...base, lastShown: "2026-10-31" }, { questions: 2 }, at(10)).visible, false);
  assert.equal(N.nudgeState({ ...base, enabled: false }, { questions: 2 }, at(10)).visible, false);
  assert.equal(N.nudgeState(base, { questions: 2 }, at(10, "2026-11-01")).visible, true, "a new day can nudge again");
});

test("study nudge: marking shown is stored and the plugin honors the switch", async () => {
  const marked = N.markNudgeShown({ enabled: true }, at(10));
  assert.equal(marked.lastShown, "2026-10-31");

  const app = makeApp([{ path: "Questions/Q1.md", fm: { answer: "B", attempts: 1, next_review: "2026-10-01" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.studyNudge.enabled = true;
  plugin.settings.studyNudge.hour = 0;
  plugin.settings.studyNudge.quietFrom = 23;
  plugin.settings.studyNudge.quietTo = 0;

  const info = plugin.studyNudgeInfo(at(10));
  assert.equal(info.visible, true);
  assert.match(info.text, /question/);

  obsidian.notices.length = 0;
  const shown = plugin.maybeShowStudyNudge(at(10));
  assert.ok(shown);
  assert.ok(obsidian.notices.some((notice) => /Study nudge/.test(notice)));
  plugin.maybeShowStudyNudge(at(11));
  assert.equal(obsidian.notices.filter((notice) => /Study nudge/.test(notice)).length, 1, "only once per day");
});
