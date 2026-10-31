"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const os = T.osNotifications;
const reminder = T.reminder;

function fakeWindow(permission, answer) {
  const sent = [];
  class FakeNotification {
    constructor(title, options) {
      if (FakeNotification.throwOnConstruct) throw new Error("denied");
      this.title = title;
      this.options = options || {};
      sent.push(this);
    }
    close() {}
  }
  FakeNotification.permission = permission;
  FakeNotification.requests = 0;
  FakeNotification.requestPermission = async () => {
    FakeNotification.requests += 1;
    return answer;
  };
  FakeNotification.throwOnConstruct = false;
  return { win: { Notification: FakeNotification }, sent, FakeNotification };
}

test("os notifications: support is feature-detected and never prompts", () => {
  const missing = os.notificationSupport({ window: {} });
  assert.equal(missing.available, false);
  assert.equal(missing.permission, "unavailable");
  assert.match(missing.reason, /no operating-system notification API/i);

  const { win, FakeNotification } = fakeWindow("default");
  const support = os.notificationSupport({ window: win });
  assert.equal(support.available, true);
  assert.equal(support.permission, "default");
  assert.equal(support.granted, false);
  assert.equal(FakeNotification.requests, 0);
});

test("os notifications: permission is requested when the user asks for it", async () => {
  const { win, FakeNotification } = fakeWindow("default", "granted");
  const result = await os.requestOsPermission({ window: win });
  assert.equal(result.requested, true);
  assert.equal(result.permission, "granted");
  assert.equal(result.granted, true);
  assert.equal(FakeNotification.requests, 1);

  const blocked = await os.requestOsPermission({ window: {} });
  assert.equal(blocked.available, false);
  assert.equal(blocked.requested, false);
});

test("os notifications: a reminder is shown only when permission is granted", () => {
  const info = { visible: true, text: "3 questions due today" };

  const undecided = fakeWindow("default", "default");
  const skipped = os.showReminderNotification({ window: undecided.win }, info);
  assert.equal(skipped.sent, false);
  assert.equal(undecided.sent.length, 0);

  const allowed = fakeWindow("granted", "granted");
  const shown = os.showReminderNotification({ window: allowed.win }, info);
  assert.equal(shown.sent, true);
  assert.equal(allowed.sent.length, 1);
  assert.equal(allowed.sent[0].title, os.TITLE);
  assert.equal(allowed.sent[0].options.body, "3 questions due today");
  assert.equal(allowed.sent[0].options.tag, "mcq-reminder");
});

test("os notifications: a rejected notification and empty text fall back quietly", () => {
  const { win, FakeNotification, sent } = fakeWindow("granted", "granted");
  FakeNotification.throwOnConstruct = true;
  const failed = os.showReminderNotification({ window: win }, { text: "2 questions due today" });
  assert.equal(failed.sent, false);
  assert.equal(sent.length, 0);

  assert.equal(os.showReminderNotification({ window: win }, { text: "   " }).sent, false);
  assert.equal(os.showReminderNotification({ window: win }, null).sent, false);
});

test("os notifications: bodies are clamped and the reminder setting is off by default", () => {
  const long = "x".repeat(os.MAX_BODY + 40);
  assert.equal(os.clampBody("  " + long + "  ").length, os.MAX_BODY);
  assert.ok(os.clampBody(long).endsWith("…"));

  const state = reminder.reminderState({ enabled: true, hour: 9 }, { now: new Date(2026, 9, 29, 12, 0), due: 2 });
  assert.equal(state.osNotifications, false);
  const on = reminder.reminderState({ enabled: true, hour: 9, osNotifications: true }, { now: new Date(2026, 9, 29, 12, 0), due: 2 });
  assert.equal(on.osNotifications, true);
});
