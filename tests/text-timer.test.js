"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const TT = T.textTimer;

test("text timer: reads an optional title and keeps the passage verbatim", () => {
  const parsed = TT.parseTextTimerBlock("title: Read this\nid: passage-1\n---\nFirst line\n\nSecond line");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.title, "Read this");
  assert.equal(parsed.id, "passage-1");
  assert.equal(parsed.body, "First line\n\nSecond line");
  assert.equal(TT.textTimerKey("Notes/Read.md", "", "passage-1"), TT.textTimerKey("Notes/Read.md", "other", "passage-1"));

  const empty = TT.parseTextTimerBlock("title: Nothing here");
  assert.equal(empty.valid, false);
  assert.match(empty.issues.join(" "), /Add the passage/);
});

test("text timer: starts, pauses, resumes and resets with timestamps", () => {
  let state = TT.normalizeTextTimerState(null);
  state = TT.startTextTimer(state, 1000);
  assert.equal(state.state, "running");
  assert.equal(TT.currentTextTimerElapsed(state, 61000), 60000);
  assert.equal(TT.formatTextTimerClock(60000), "1:00");
  state = TT.pauseTextTimer(state, 61000);
  assert.equal(state.state, "paused");
  assert.equal(TT.currentTextTimerElapsed(state, 999999), 60000);
  state = TT.startTextTimer(state, 100000);
  assert.equal(TT.currentTextTimerElapsed(state, 130000), 90000);
  state = TT.resetTextTimer(state);
  assert.equal(state.state, "idle");
  assert.equal(state.elapsedMs, 0);
  assert.equal(state.startedAt, 0);
});

test("text timer: the block counts up and persists its state", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  let now = 1000;
  const dom = makeDom();
  const block = await plugin.renderTextTimerBlock("title: Read this\n---\nThe passage.", dom.root, {
    sourcePath: "Notes/Read.md",
    now: () => now,
  });
  assert.ok(plugin.codeBlocks["text-timer"]);
  assert.ok(dom.texts().includes("The passage."));
  assert.ok(dom.texts().includes("0:00"));

  await dom.click("Start");
  assert.equal(plugin.settings.textTimers.timers[TT.textTimerKey("Notes/Read.md", "title: Read this\n---\nThe passage.", "")].state, "running");
  now = 46000;
  block.refresh();
  assert.ok(dom.texts().includes("0:45"));

  await dom.click("Pause");
  assert.ok(dom.texts().includes("Timer paused."));
  const key = TT.textTimerKey("Notes/Read.md", "title: Read this\n---\nThe passage.", "");
  assert.equal(plugin.settings.textTimers.timers[key].state, "paused");
  assert.equal(plugin.settings.textTimers.timers[key].elapsedMs, 45000);

  const reloaded = new QT(makeApp([]));
  reloaded.saved = plugin.saved;
  await reloaded.loadSettings();
  assert.equal(reloaded.settings.textTimers.timers[key].state, "paused");
  assert.equal(reloaded.settings.textTimers.timers[key].elapsedMs, 45000);

  await dom.click("Reset");
  assert.equal(plugin.settings.textTimers.timers[key].state, "idle");
  assert.equal(plugin.settings.textTimers.timers[key].elapsedMs, 0);
  assert.ok(dom.texts().includes("Timer reset."));
});

test("text timer: corrupt settings are normalized", () => {
  const normalized = TT.normalizeTextTimerSettings({
    timers: {
      a: { state: "running", elapsedMs: 5000, runningSince: 0 },
      b: { state: "bogus", elapsedMs: -1 },
      c: { elapsedMs: 999999999999 },
    },
  });
  assert.equal(normalized.timers.a.state, "paused");
  assert.equal(normalized.timers.b.state, "idle");
  assert.equal(normalized.timers.b.elapsedMs, 0);
  assert.equal(normalized.timers.c.elapsedMs, TT.MAX_ELAPSED_MS);
});
