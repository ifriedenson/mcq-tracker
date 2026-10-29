"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const reminder = T.reminder;

test("reminder: off by default and silent before the chosen hour", () => {
  const off = reminder.reminderState({}, { now: new Date(2026, 9, 29, 12, 0), due: 4 });
  assert.equal(off.visible, false);
  assert.equal(off.text, "4 questions due today");

  const early = reminder.reminderState({ enabled: true, hour: 9 }, { now: new Date(2026, 9, 29, 8, 59), due: 4 });
  assert.equal(early.visible, false);
  const later = reminder.reminderState({ enabled: true, hour: 9 }, { now: new Date(2026, 9, 29, 9, 0), due: 4 });
  assert.equal(later.visible, true);
  assert.equal(later.freshNudge, true);
});

test("reminder: dismiss hides it for the rest of the local day", () => {
  const state = reminder.dismissReminder({ enabled: true, hour: 9 }, new Date(2026, 9, 29, 10, 0));
  const today = reminder.reminderState(state, { now: new Date(2026, 9, 29, 11, 0), due: 2 });
  assert.equal(today.visible, false);
  const tomorrow = reminder.reminderState(state, { now: new Date(2026, 9, 30, 11, 0), due: 2 });
  assert.equal(tomorrow.visible, true);
});

test("reminder: a daily quiz is a valid nudge when no questions are due", () => {
  const state = reminder.reminderState({ enabled: true, hour: 7 }, { now: new Date(2026, 9, 29, 9, 0), due: 0, fresh: 0, daily: true });
  assert.equal(state.visible, true);
  assert.match(state.text, /daily quiz/i);
});
