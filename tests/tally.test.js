"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const TL = T.tally;

test("tally: parses labels, steps and an optional stable id", () => {
  const parsed = TL.parseTallyBlock("title: Biology drill\ncorrect: Right\nincorrect: Wrong\nsteps: 1, 2, 10\nid: bio-1");
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.issues, []);
  assert.equal(parsed.title, "Biology drill");
  assert.equal(parsed.correct, "Right");
  assert.equal(parsed.incorrect, "Wrong");
  assert.deepEqual(parsed.steps, [1, 2, 10]);
  assert.equal(parsed.step, 1);
  assert.equal(TL.tallyKey("Notes/Bio.md", "ignored", "bio-1"), TL.tallyKey("Notes/Bio.md", "different", "bio-1"));
  assert.notEqual(TL.tallyKey("Notes/A.md", "x"), TL.tallyKey("Notes/B.md", "x"));
});

test("tally: malformed settings explain the problem and fall back safely", () => {
  const parsed = TL.parseTallyBlock("steps: 0, 2\nstep: 3\nnonsense: yes\nplain text");
  assert.equal(parsed.valid, false);
  assert.match(parsed.issues.join(" "), /from 1 to 100/);
  assert.match(parsed.issues.join(" "), /not a tally setting/);
  assert.match(parsed.issues.join(" "), /key: value/);
  assert.ok(parsed.steps.includes(3));
  assert.equal(parsed.step, 3);
});

test("tally: counts use the selected step and keep accuracy and CPS", () => {
  const options = TL.parseTallyBlock("steps: 1, 2, 5");
  let state = TL.normalizeTallyState(null, options);
  state = TL.recordTally(state, "correct", 1000, options);
  state = TL.setTallyStep(state, 2, options);
  state = TL.recordTally(state, "incorrect", 5000, options);
  state = TL.recordTally(state, "correct", 11000, options);
  assert.equal(state.correct, 3);
  assert.equal(state.incorrect, 2);
  assert.equal(state.step, 2);
  const stats = TL.tallyStats(state, 11000);
  assert.equal(stats.total, 5);
  assert.equal(stats.accuracy, 3 / 5);
  assert.equal(stats.cps, 0.5);
  assert.equal(TL.formatTallyClock(stats.elapsedMs), "0:10");
  const reset = TL.resetTally(state, options);
  assert.equal(reset.correct, 0);
  assert.equal(reset.incorrect, 0);
  assert.equal(reset.startedAt, 0);
  assert.equal(TL.tallyStats(reset, 20000).accuracy, null);
});

test("tally: block clicks, step changes and state survive a reload", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  let now = 1000;
  const dom = makeDom();
  const source = "title: Drill\nsteps: 1, 2\nid: drill";
  const block = await plugin.renderTallyBlock(source, dom.root, {
    sourcePath: "Notes/Drill.md",
    now: () => now,
  });
  assert.ok(plugin.codeBlocks.tally);
  assert.ok(dom.texts().includes("Drill"));
  assert.ok(dom.texts().includes("Total 0 · — accuracy · 0.00 CPS · 0:00"));

  await dom.click("Correct");
  now = 7000;
  await dom.click("×2");
  await dom.click("Incorrect");
  assert.ok(dom.texts().includes("Total 3 · 33% accuracy · 0.50 CPS · 0:06"));

  const key = TL.tallyKey("Notes/Drill.md", source, "drill");
  assert.equal(plugin.settings.tallies.sessions[key].correct, 1);
  assert.equal(plugin.settings.tallies.sessions[key].incorrect, 2);
  assert.equal(plugin.settings.tallies.sessions[key].step, 2);

  const reloaded = new QT(makeApp([]));
  reloaded.saved = plugin.saved;
  await reloaded.loadSettings();
  assert.equal(reloaded.settings.tallies.sessions[key].correct, 1);
  assert.equal(reloaded.settings.tallies.sessions[key].incorrect, 2);

  await dom.click("Reset");
  assert.equal(plugin.settings.tallies.sessions[key].correct, 0);
  assert.equal(plugin.settings.tallies.sessions[key].incorrect, 0);
  assert.ok(block);
});

test("tally: corrupt saved sessions are bounded", () => {
  const normalized = TL.normalizeTallySettings({
    sessions: {
      good: { correct: 4, incorrect: 1, step: 2, startedAt: 1000, updated: 2000 },
      bad: { correct: -4, incorrect: "many", step: 999, startedAt: -1 },
      junk: "not an object",
    },
  });
  assert.equal(normalized.sessions.good.correct, 4);
  assert.equal(normalized.sessions.good.step, 2, "a saved step in the default set is preserved");
  assert.equal(normalized.sessions.bad.correct, 0);
  assert.equal(normalized.sessions.bad.incorrect, 0);
  assert.equal(normalized.sessions.bad.startedAt, 0);
  assert.equal(normalized.sessions.junk, undefined);
});
