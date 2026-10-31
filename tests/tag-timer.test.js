"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const TT = T.tagTimer;

const BLOCK = `#study/biology stopwatch
#study/chemistry | countdown 25
#review countdown 0:30
// a comment
#study`;

test("tag timer: parses tag, stopwatch and countdown declarations", () => {
  const parsed = TT.parseTagTimers(BLOCK);
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.entries.map((entry) => entry.tag), ["#study/biology", "#study/chemistry", "#review", "#study"]);
  assert.equal(parsed.entries[0].kind, "stopwatch");
  assert.equal(parsed.entries[1].durationMs, 25 * 60 * 1000);
  assert.equal(parsed.entries[2].durationMs, 30 * 1000);
  assert.equal(parsed.entries[3].kind, "stopwatch");
  assert.notEqual(TT.tagTimerKey("Notes/A.md", "#study"), TT.tagTimerKey("Notes/B.md", "#study"));
  assert.equal(TT.tagTimerKey("Notes/A.md", "#STUDY"), TT.tagTimerKey("Notes/A.md", "#study"));
});

test("tag timer: malformed declarations explain the missing or ambiguous part", () => {
  const empty = TT.parseTagTimers("");
  assert.equal(empty.entries.length, 0);
  assert.equal(empty.valid, false);

  const missing = TT.parseTagTimers("stopwatch");
  assert.match(missing.issues.join(" "), /add a #tag/);

  const ambiguous = TT.parseTagTimers("#study/biology #study/chemistry stopwatch");
  assert.match(ambiguous.issues.join(" "), /more than one #tag/);

  const unknown = TT.parseTagTimers("#study pomodoro");
  assert.match(unknown.issues.join(" "), /not a timer kind/);

  const noTime = TT.parseTagTimers("#study countdown 0");
  assert.match(noTime.issues.join(" "), /1 second to 24 hours/);

  const extra = TT.parseTagTimers("#study stopwatch 5");
  assert.match(extra.issues.join(" "), /does not take a time/);

  const duplicate = TT.parseTagTimers("#study stopwatch\n#STUDY countdown 5");
  assert.match(duplicate.issues.join(" "), /already declared/);

  const badTag = TT.parseTagTimers("#study/");
  assert.match(badTag.issues.join(" "), /not a valid tag/);
});

test("tag timer: start, pause, resume, stop and restart use timestamps", () => {
  let state = TT.defaultTagTimer({ tag: "#study", kind: "stopwatch", durationMs: 0 }, 0);
  state = TT.startTagTimer(state, 1000);
  assert.equal(TT.currentTagElapsed(state, 11000), 10000);
  assert.equal(TT.tagTimerDisplay(state, 11000), "0:10");
  state = TT.pauseTagTimer(state, 11000);
  assert.equal(TT.currentTagElapsed(state, 99999), 10000);
  state = TT.startTagTimer(state, 20000);
  assert.equal(TT.currentTagElapsed(state, 30000), 20000);
  state = TT.stopTagTimer(state, 30000);
  assert.equal(state.state, "stopped");
  state = TT.startTagTimer(state, 40000);
  assert.equal(state.state, "running");
  assert.equal(TT.currentTagElapsed(state, 50000), 10000, "a stopped stopwatch starts a fresh run");

  let countdown = TT.defaultTagTimer({ tag: "#chem", kind: "countdown", durationMs: 60000 }, 0);
  countdown = TT.startTagTimer(countdown, 0);
  assert.equal(TT.tagTimerRemaining(countdown, 15000), 45000);
  const settled = TT.settleTagTimer(countdown, 60000);
  assert.equal(settled.finished, true);
  assert.equal(settled.state.state, "stopped");
  assert.equal(TT.tagTimerDisplay(settled.state, 60000), "1:00");
  assert.equal(TT.settleTagTimer(settled.state, 90000).finished, false);
});

test("tag timer: completed sessions are recorded once and grouped by tag", () => {
  const settings = { timers: {} };
  const start = Date.UTC(2026, 9, 31, 10, 0, 0);
  const end = start + 2 * 60 * 1000;
  let state = TT.startTagTimer(TT.defaultTagTimer({ tag: "#study/biology", kind: "stopwatch", durationMs: 0 }, start), start);
  state = TT.stopTagTimer(state, end);
  const recorded = TT.recordTagSession(settings, state, end);
  assert.equal(recorded.session.seconds, 120);
  assert.ok(recorded.state.sessionId);
  assert.equal(TT.recordTagSession(settings, recorded.state, end).session, null, "a stopped timer is only logged once");
  settings.timers.biology = recorded.state;

  const today = T.focus.dayKey(new Date(end));
  const summary = TT.tagTimerSummary(settings, today);
  assert.equal(summary.todayTotal, 120);
  assert.equal(summary.weekTotal, 120);
  assert.equal(summary.rows[0].tag, "#study/biology");
  assert.equal(summary.rows[0].sessions, 1);
  assert.equal(summary.rows[0].totalSeconds, 120);
});

test("tag timer: corrupt settings are bounded and a running timer without a start is paused", () => {
  const settings = TT.normalizeTagTimerSettings({
    timers: {
      a: { tag: "#ok", kind: "countdown", durationMs: 60000, elapsedMs: 999999, state: "running", runningSince: 0 },
      b: { tag: "not a tag", kind: "stopwatch", state: "running" },
      c: { tag: "#bad-state", kind: "stopwatch", state: "bogus", elapsedMs: 5000 },
    },
    sessions: [
      { tag: "#ok", seconds: 60, date: "2026-10-31" },
      { tag: "#bad", seconds: 0, date: "2026-10-31" },
      { tag: "#bad", seconds: 5, date: "not-a-date" },
    ],
  });
  assert.equal(settings.timers.a.elapsedMs, 60000);
  assert.equal(settings.timers.a.state, "paused");
  assert.equal(settings.timers.b, undefined);
  assert.equal(settings.timers.c.state, "idle");
  assert.equal(settings.sessions.length, 1);
  assert.equal(settings.sessions[0].tag, "#ok");
});

test("tag timer: the block starts, pauses and logs a stopwatch session", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  let now = 1000;
  const block = await plugin.renderTagTimerBlock("#study/biology stopwatch", makeDom().root, {
    sourcePath: "Notes/Study.md",
    today: "2026-10-31",
    now: () => now,
  });
  assert.ok(plugin.codeBlocks["tag-timer"]);
  const key = TT.tagTimerKey("Notes/Study.md", "#study/biology");
  assert.equal(plugin.settings.tagTimers.timers[key].state, "idle");

  const startDom = makeDom();
  const started = await plugin.renderTagTimerBlock("#study/biology stopwatch", startDom.root, {
    sourcePath: "Notes/Study.md",
    today: "2026-10-31",
    now: () => now,
  });
  assert.ok(startDom.texts().includes("#study/biology"));
  await startDom.click("Start");
  assert.equal(plugin.settings.tagTimers.timers[key].state, "running");
  assert.equal(plugin.saved.tagTimers.timers[key].state, "running");

  const reloaded = new QT(makeApp([]));
  reloaded.saved = plugin.saved;
  await reloaded.loadSettings();
  const savedRunning = reloaded.settings.tagTimers.timers[key];
  assert.equal(savedRunning.state, "running");
  assert.equal(TT.currentTagElapsed(savedRunning, 61000), 60000);

  now = 61000;
  started.refresh();
  started.render();
  assert.ok(startDom.texts().includes("1:00"));

  await startDom.click("Pause");
  assert.equal(plugin.settings.tagTimers.timers[key].state, "paused");
  assert.equal(plugin.settings.tagTimers.timers[key].elapsedMs, 60000);

  await startDom.click("Stop");
  assert.equal(plugin.settings.tagTimers.timers[key].state, "stopped");
  assert.equal(plugin.settings.tagTimers.sessions.length, 1);
  assert.equal(plugin.settings.tagTimers.sessions[0].seconds, 60);
  assert.ok(startDom.texts().some((text) => text.includes("1m total")));

  const reloadedAfterStop = new QT(makeApp([]));
  reloadedAfterStop.saved = plugin.saved;
  await reloadedAfterStop.loadSettings();
  assert.equal(reloadedAfterStop.settings.tagTimers.timers[key].state, "stopped");
  assert.equal(reloadedAfterStop.settings.tagTimers.sessions.length, 1);
});

test("tag timer: a countdown expires in the background and records its session", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  let now = 1000;
  const dom = makeDom();
  const block = await plugin.renderTagTimerBlock("#study/chemistry countdown 0:01", dom.root, {
    sourcePath: "Notes/Chem.md",
    today: "2026-10-31",
    now: () => now,
  });
  const key = TT.tagTimerKey("Notes/Chem.md", "#study/chemistry");
  await dom.click("Start");
  assert.equal(plugin.settings.tagTimers.timers[key].state, "running");
  now = 3000;
  block.refresh();
  assert.equal(plugin.settings.tagTimers.timers[key].state, "stopped");
  assert.equal(plugin.settings.tagTimers.sessions.length, 1);
  assert.equal(plugin.settings.tagTimers.sessions[0].seconds, 1);
  assert.ok(dom.texts().some((text) => /Countdown finished/.test(text)));
});

test("tag timer: malformed and empty blocks stay readable", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const empty = makeDom();
  await plugin.renderTagTimerBlock("", empty.root, { sourcePath: "Notes/Empty.md", today: "2026-10-31" });
  assert.ok(empty.texts().some((text) => text.includes("Add a timer line")));

  const bad = makeDom();
  await plugin.renderTagTimerBlock("#study #other", bad.root, { sourcePath: "Notes/Bad.md", today: "2026-10-31" });
  assert.ok(bad.texts().some((text) => /more than one #tag/.test(text)));
  assert.ok(bad.all.some((option) => option.classes.has("qt-tag-timer-issue")));
});

test("tag timer: stop all refreshes an open block and records running timers", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  let now = 1000;
  const dom = makeDom();
  await plugin.renderTagTimerBlock("#study/biology stopwatch", dom.root, {
    sourcePath: "Notes/Live.md",
    today: "2026-10-31",
    now: () => now,
  });
  await dom.click("Start");
  const key = TT.tagTimerKey("Notes/Live.md", "#study/biology");
  assert.equal(plugin.settings.tagTimers.timers[key].state, "running");
  const count = await plugin.stopAllTagTimers();
  assert.equal(count, 1);
  assert.equal(plugin.settings.tagTimers.timers[key].state, "stopped");
  assert.equal(plugin.settings.tagTimers.sessions.length, 1);
  assert.ok(dom.texts().includes("Stopped"));
  assert.ok(plugin.commands.some((command) => command.id === "tag-timer-stop-all"));
});

test("tag timer: stop all records running timers and the command is registered", async () => {
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const now = Date.now();
  plugin.settings.tagTimers = {
    timers: {
      a: {
        tag: "#study",
        kind: "stopwatch",
        state: "running",
        elapsedMs: 0,
        runningSince: now - 60000,
        durationMs: 0,
        startedAt: now - 60000,
        stoppedAt: 0,
        completedAt: 0,
        sessionId: "",
      },
    },
    sessions: [],
  };
  assert.ok(plugin.commands.some((command) => command.id === "tag-timer-stop-all"));
  const count = await plugin.stopAllTagTimers();
  assert.equal(count, 1);
  assert.equal(plugin.settings.tagTimers.timers.a.state, "stopped");
  assert.equal(plugin.settings.tagTimers.sessions.length, 1);
});
