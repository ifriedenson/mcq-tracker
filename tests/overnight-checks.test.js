"use strict";
/*
 * The overnight check queue: every written note gets its blind check in a
 * second pass, a few at a time, with rate-limit backoff and a budget pause
 * instead of a failure. Verdicts land in frontmatter only; notes are
 * otherwise untouched.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, NOTE_TEXT } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const queue = () => T.overnightChecks;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function note(id, answer) {
  return {
    path: `Questions/${id}.md`,
    text: NOTE_TEXT(id, answer),
    fm: { answer },
  };
}

async function setup(files) {
  const app = makeApp(files);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.ai.enabled = true;
  plugin.settings.ai.backend = "api";
  plugin.settings.ai.verifyPanel = false;
  plugin.aiComplete = async () => '{"answer":"B"}';
  return { app, plugin };
}

function pathsOf(app) {
  return app.files.filter((f) => /\.md$/.test(f.path)).map((f) => f.path);
}

test("overnight checks: helpers clamp, parse and estimate", () => {
  const q = queue();
  assert.equal(q.checkConcurrency(null), 2);
  assert.equal(q.checkConcurrency({ checkConcurrency: 9 }), 4);
  assert.equal(q.checkConcurrency({ checkConcurrency: 0 }), 1);
  assert.equal(q.normalizeConcurrency("3"), 3);
  assert.ok(q.isRateLimitMessage("HTTP 429: Too Many Requests"));
  assert.ok(q.isRateLimitMessage("you exceeded your current quota"));
  assert.ok(!q.isRateLimitMessage("HTTP 400: bad model"));
  assert.ok(q.isCapMessage("The daily AI request cap (100) has been reached."));
  assert.ok(!q.isCapMessage("HTTP 429: slow down"));
  assert.equal(q.retryAfterMs("Retry-After: 45", 0), 45000);
  assert.ok(q.retryAfterMs("slow down", 0) >= 7000, "backs off without a header");
  assert.equal(q.medianMs([30, 10, 20]), 20);
  assert.equal(q.medianMs([]), 0);
  assert.match(q.etaLabel(120, 3000), /about 6 minutes/);
  assert.equal(q.etaLabel(0, 3000), "");
});

test("overnight checks: matching notes are verified in frontmatter", async () => {
  const { app, plugin } = await setup([note("Q01", "B"), note("Q02", "B")]);
  const progress = [];
  const { summary } = await queue().runCheckQueue(plugin, pathsOf(app), {
    concurrency: 2,
    onProgress: (done, total) => progress.push(`${done}/${total}`),
  });
  assert.deepEqual(progress, ["1/2", "2/2"]);
  assert.equal(summary.checked, 2);
  assert.equal(summary.matched, 2);
  assert.equal(summary.mismatched, 0);
  assert.ok(summary.medianMs >= 0);
  for (const file of app.files) {
    assert.equal(file.fm.verified, true, `${file.path} is marked verified`);
    assert.equal(file.fm.verification, "match");
    assert.ok(!file.fm.needs_review, `${file.path} is not flagged`);
  }
});

test("overnight checks: a mismatch keeps the note and flags it", async () => {
  const { app, plugin } = await setup([note("Q01", "B")]);
  plugin.aiComplete = async () => '{"answer":"A","confidence":"high"}';
  const { summary } = await queue().runCheckQueue(plugin, pathsOf(app), { concurrency: 1 });
  assert.equal(summary.mismatched, 1);
  assert.equal(summary.matched, 0);
  const file = app.files[0];
  assert.equal(file.fm.verified, false);
  assert.equal(file.fm.verification, "mismatch");
  assert.equal(file.fm.needs_review, true);
  assert.match(file.text, /Answer check failed/, "the visible banner names the disagreement");
});

test("overnight checks: a rate limit waits and the same note is asked again", async () => {
  const { app, plugin } = await setup([note("Q01", "B")]);
  let calls = 0;
  plugin.aiComplete = async () => {
    calls++;
    if (calls === 1) throw new Error("HTTP 429: Too Many Requests. Slow down.");
    return '{"answer":"B"}';
  };
  const notices = [];
  const { summary } = await queue().runCheckQueue(plugin, pathsOf(app), {
    concurrency: 1,
    retryBaseMs: 5,
    onNotice: (m) => notices.push(m),
  });
  assert.equal(calls, 2, "the same note is asked again after the wait");
  assert.equal(summary.matched, 1);
  assert.ok(notices.some((m) => /rate limited/i.test(m)), "the wait is announced");
  assert.equal(app.files[0].fm.verified, true);
});

test("overnight checks: a spent budget pauses the queue instead of failing it", async () => {
  const { app, plugin } = await setup([note("Q01", "B"), note("Q02", "B")]);
  plugin.aiComplete = async () => {
    throw new Error("The daily AI request cap (100) has been reached. Raise it in Settings.");
  };
  const { results, summary } = await queue().runCheckQueue(plugin, pathsOf(app), { concurrency: 1 });
  assert.ok(summary.paused, "the run pauses with the reason");
  assert.match(String(summary.paused.error), /request cap/i);
  assert.equal(results[0].status, "paused");
  assert.ok(!app.files[1].fm.verification, "notes after the pause are untouched");
  assert.ok(!app.files[0].fm.verified, "the paused note is not marked either way");
});

test("overnight checks: a stop ends the queue after the in-flight note", async () => {
  const { app, plugin } = await setup([note("Q01", "B"), note("Q02", "B"), note("Q03", "B")]);
  let finished = 0;
  plugin.aiComplete = async () => '{"answer":"B"}';
  const { summary } = await queue().runCheckQueue(plugin, pathsOf(app), {
    concurrency: 1,
    shouldStop: () => finished >= 1,
    onProgress: () => {
      finished++;
    },
  });
  assert.equal(summary.checked, 1, "nothing is sent after the stop");
  assert.ok(summary.stopped, "the stop is reported");
  assert.ok(!app.files[1].fm.verification && !app.files[2].fm.verification, "unreached notes stay unchecked");
});

test("overnight checks: a wall-clock gap is reported before judging anything frozen", async () => {
  const { app, plugin } = await setup([note("Q01", "B"), note("Q02", "B")]);
  let slow = true;
  plugin.aiComplete = async () => {
    if (slow) {
      slow = false;
      await sleep(80);
    }
    return '{"answer":"B"}';
  };
  const gaps = [];
  const { summary } = await queue().runCheckQueue(plugin, pathsOf(app), {
    concurrency: 1,
    wakeGapMs: 30,
    onWakeGap: async (gap) => gaps.push(gap),
  });
  assert.equal(summary.checked, 2);
  assert.equal(gaps.length, 1, "one gap is reported before the next note");
  assert.ok(gaps[0] >= 30, "the reported gap is the real elapsed time");
});
