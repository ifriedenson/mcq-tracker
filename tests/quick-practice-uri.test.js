"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const quick = T.quickPractice;

function fakeView() {
  const calls = [];
  return {
    calls,
    startQuick: async (...args) => {
      calls.push(args);
    },
  };
}

async function makePlugin(app, view) {
  const plugin = new QT(app);
  const protocols = {};
  plugin.registerObsidianProtocolHandler = (name, callback) => {
    protocols[name] = callback;
  };
  await plugin.onload();
  plugin.activateView = async () => view;
  return { plugin, protocols };
}

test("Quick Practice URI parser accepts time, count and course parameters", () => {
  assert.deepEqual(quick.parseQuickPracticeUri({ minutes: "5" }), { kind: "time", value: 5, course: "" });
  assert.deepEqual(quick.parseQuickPracticeUri({ count: "10", course: " Biology " }), { kind: "count", value: 10, course: "Biology" });
  assert.deepEqual(quick.parseQuickPracticeUri({}), { kind: "time", value: null, course: "" });
  assert.deepEqual(quick.parseQuickPracticeUri({ minutes: "2", vault: "Study" }), { kind: "time", value: 2, course: "" });
});

test("Quick Practice URI parser refuses ambiguous, unsupported and over-long input", () => {
  assert.match(quick.parseQuickPracticeUri({ minutes: "5", count: "10" }).error, /either minutes= or count=/);
  assert.match(quick.parseQuickPracticeUri({ minutes: "3" }).error, /minutes must be one of/);
  assert.match(quick.parseQuickPracticeUri({ minutes: "five" }).error, /minutes must be one of/);
  assert.match(quick.parseQuickPracticeUri({ count: "15" }).error, /count must be one of/);
  assert.match(quick.parseQuickPracticeUri({ count: "5.0" }).error, /count must be one of/);
  assert.match(quick.parseQuickPracticeUri({ course: "x".repeat(81) }).error, /80 characters/);
});

test("the plugin registers the shortcut and opens a real time session", async () => {
  const view = fakeView();
  const { plugin, protocols } = await makePlugin(makeApp([]), view);

  assert.equal(typeof protocols["mcq-tracker-quick"], "function");
  assert.equal(await plugin.openQuickPracticeLink({ minutes: "10" }), view);
  assert.deepEqual(view.calls, [["time", 10, { pool: undefined, mode: undefined, label: "" }]]);
});

test("a count shortcut uses the count path and the saved default when no value is given", async () => {
  const view = fakeView();
  const { plugin } = await makePlugin(makeApp([]), view);
  plugin.settings.quickDefaults.count = 20;

  assert.equal(await plugin.openQuickPracticeLink({ count: "5" }), view);
  assert.equal(await plugin.openQuickPracticeLink({}), view);
  assert.deepEqual(view.calls, [
    ["count", 5, { pool: undefined, mode: undefined, label: "" }],
    ["time", 5, { pool: undefined, mode: undefined, label: "" }],
  ]);
});

test("a course shortcut scopes the queue and reports a missing course", async () => {
  const app = makeApp([
    {
      path: "Biology/Cells.md",
      fm: { question_id: "BIO-1", course: "Biology", skill: "Cells", answer: "B" },
    },
  ]);
  const view = fakeView();
  const { plugin } = await makePlugin(app, view);

  await plugin.openQuickPracticeLink({ count: "5", course: "Biology" });
  assert.equal(view.calls.length, 1);
  assert.equal(view.calls[0][0], "count");
  assert.equal(view.calls[0][1], 5);
  assert.equal(view.calls[0][2].label, 'course "Biology"');
  assert.equal(view.calls[0][2].pool.length, 1);
  assert.equal(view.calls[0][2].pool[0].file.path, "Biology/Cells.md");

  obsidian.notices.length = 0;
  assert.equal(await plugin.openQuickPracticeLink({ minutes: "5", course: "Chemistry" }), null);
  assert.ok(obsidian.notices.some((message) => /No questions match course "Chemistry"/.test(message)));
  assert.equal(view.calls.length, 1, "an empty course match does not open a different queue");
});

test("invalid links and a disabled module are refused without opening practice", async () => {
  const view = fakeView();
  const { plugin } = await makePlugin(makeApp([]), view);

  obsidian.notices.length = 0;
  assert.equal(await plugin.openQuickPracticeLink({ minutes: "5", count: "10" }), null);
  assert.ok(obsidian.notices.some((message) => /Use either minutes= or count=/.test(message)));
  assert.equal(view.calls.length, 0);

  plugin.settings.mcqEnabled = false;
  obsidian.notices.length = 0;
  assert.equal(await plugin.openQuickPracticeLink({ minutes: "5" }), null);
  assert.ok(obsidian.notices.some((message) => /MCQ Tracker is turned off/.test(message)));
  assert.equal(view.calls.length, 0);
});
