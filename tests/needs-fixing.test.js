"use strict";
// The opt-in needs-fixing flag: distinct miss days, a non-destructive Mark fixed
// action, corrupt-state repair and no change to the existing scheduling path.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom, NOTE_TEXT } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const H = T.history;
const DAYS = (n) => new Date(2026, 9, 1 + n, 9, 0);
const ON = { needsFixingDays: 5 };

function miss(fm, day, opts = ON) {
  return T.applyAttempt(
    fm,
    { correct: false, chosen: "B", conf: 2, seconds: 20, now: DAYS(day), attemptId: `miss-${day}-${Math.random()}` },
    [1, 3, 7],
    opts
  );
}

test("needs fixing is off by default and malformed settings normalize to false", async () => {
  const fm = {};
  for (let i = 0; i < 6; i++) miss(fm, i, {});
  assert.equal(fm.needs_fixing, undefined);
  assert.equal(miss(fm, 6, {}).needsFixing, null);

  const app = makeApp([]);
  const plugin = new QT(app);
  plugin.saved = { needsFixing: "true" };
  await plugin.onload();
  assert.equal(plugin.settings.needsFixing, false);
});

test("same-day misses never raise the flag, even past the threshold", () => {
  const fm = {};
  for (let i = 0; i < 8; i++) {
    const summary = miss(fm, 0);
    assert.equal(summary.needsFixing, null);
  }
  assert.equal(fm.needs_fixing, undefined);
  assert.equal(fm.attempts, 8);
  assert.equal(fm.history.length, 8);
  assert.equal(H.needsFixingStatus(fm).missDays, 1);
});

test("five distinct miss days raise the flag once and keep history intact", () => {
  const fm = {};
  for (let i = 0; i < 4; i++) miss(fm, i);
  assert.equal(fm.needs_fixing, undefined);

  const fifth = miss(fm, 4);
  assert.deepEqual(fifth.needsFixing, { flagged: true, missDays: 5, threshold: 5, since: "2026-10-05" });
  assert.equal(fm.needs_fixing, true);
  assert.equal(fm.needs_fixing_since, "2026-10-05");
  assert.equal(fm.needs_fixing_miss_days, 5);
  assert.equal(fm.history.length, 5);

  const sixth = miss(fm, 5);
  assert.equal(sixth.needsFixing, null, "an existing flag is not raised twice");
  assert.equal(sixth.needsFixingFlagged, true);
  assert.equal(fm.needs_fixing_miss_days, 6);
  assert.equal(fm.attempts, 6);
});

test("Mark fixed clears the flag but leaves attempts and history, and starts a new cycle", () => {
  const fm = {};
  for (let i = 0; i < 5; i++) miss(fm, i);
  const history = fm.history.slice();
  const attempts = fm.attempts;

  const fixed = H.markNeedsFixingFixed(fm, DAYS(5));
  assert.equal(fixed.wasFlagged, true);
  assert.equal(fm.needs_fixing, undefined);
  assert.equal(fm.needs_fixing_since, undefined);
  assert.equal(fm.needs_fixing_miss_days, undefined);
  assert.equal(fm.needs_fixing_fixed_on, "2026-10-06");
  assert.deepEqual(fm.history, history);
  assert.equal(fm.attempts, attempts);

  // A miss on the repaired day does not immediately re-flag the old history.
  assert.equal(miss(fm, 5).needsFixing, null);
  assert.equal(fm.needs_fixing, undefined);
  for (let i = 1; i < 5; i++) miss(fm, 5 + i);
  assert.equal(fm.needs_fixing, undefined);
  const reflagged = miss(fm, 10);
  assert.equal(reflagged.needsFixing.missDays, 5);
  assert.equal(fm.needs_fixing, true);
  assert.equal(fm.history.length, 11);
});

test("corrupt saved flag fields are removed instead of keeping an item stuck", () => {
  const fm = {
    needs_fixing: "yes",
    needs_fixing_since: "not-a-date",
    needs_fixing_miss_days: "many",
    needs_fixing_fixed_on: "10/05/2026",
  };
  assert.equal(H.normalizeNeedsFixing(fm), true);
  assert.equal(fm.needs_fixing, undefined);
  assert.equal(fm.needs_fixing_since, undefined);
  assert.equal(fm.needs_fixing_miss_days, undefined);
  assert.equal(fm.needs_fixing_fixed_on, undefined);
});

test("the flag and cleared state survive a plugin restart; the Mark fixed command is registered", async () => {
  const app = makeApp([{ path: "Questions/q1.md", fm: { answer: "A" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.needsFixing = true;
  await plugin.save();
  const file = app.files[0];
  app.workspace.getActiveFile = () => file;

  for (let i = 0; i < 5; i++) {
    await plugin.recordAttempt(file, {
      correct: false,
      chosen: "B",
      conf: 2,
      seconds: 20,
      now: DAYS(i),
      attemptId: `restart-${i}`,
    });
  }
  assert.equal(file.fm.needs_fixing, true);
  assert.equal(file.fm.history.length, 5);
  assert.equal(file.fm.attempts, 5);

  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.needsFixing, true);
  assert.equal(file.fm.needs_fixing, true);
  const command = restarted.commands.find((c) => c.id === "mark-question-fixed");
  assert.ok(command);
  assert.equal(command.checkCallback(true), true);

  restarted.askConfirm = async () => true;
  const cleared = await restarted.markQuestionFixed(file, DAYS(5));
  assert.equal(cleared, true);
  assert.equal(file.fm.needs_fixing, undefined);
  assert.equal(file.fm.needs_fixing_fixed_on, "2026-10-06");
  assert.equal(file.fm.history.length, 5);
  assert.equal(file.fm.attempts, 5);
  assert.equal(command.checkCallback(true), false, "the command disappears after repair");

  const third = new QT(app);
  third.saved = restarted.saved;
  await third.onload();
  assert.equal(file.fm.needs_fixing, undefined);
  assert.equal(file.fm.needs_fixing_fixed_on, "2026-10-06");
  assert.equal(file.fm.history.length, 5);
});

test("the result screen shows Needs fixing and Mark fixed clears it without touching history", async () => {
  const app = makeApp([{ path: "Questions/q1.md", fm: { answer: "A" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.needsFixing = true;
  plugin.askConfirm = async () => true;
  const file = app.files[0];
  for (let i = 0; i < 5; i++) {
    await plugin.recordAttempt(file, {
      correct: false,
      chosen: "B",
      conf: 2,
      seconds: 20,
      now: DAYS(i),
      attemptId: `ui-${i}`,
    });
  }
  const dom = makeDom();
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.state = "result";
  view.result = {
    file,
    correct: false,
    chosen: "B",
    key: "A",
    mode: "mcq",
    seconds: 20,
    summary: { streak: 0, correctCount: 0, attempts: 5, nextReview: "2026-10-10", needsFixing: { missDays: 5 }, needsFixingFlagged: true, needsFixingMissDays: 5 },
    errorType: "",
    flagged: false,
    sections: T.parseSections(file.text),
    fm: file.fm,
    conf: 2,
  };
  view.render();
  assert.ok(dom.texts().some((text) => /Needs fixing: missed on 5 different days/.test(text)));
  assert.ok(dom.texts().includes("Mark fixed"));

  await dom.click("Mark fixed");
  assert.equal(file.fm.needs_fixing, undefined);
  assert.equal(file.fm.history.length, 5);
  assert.equal(file.fm.attempts, 5);
});

test("the flag never changes scheduling or existing review fields", () => {
  const history = [0, 1, 2, 3].map((i) => `2026-10-0${i + 1}T09:00:00|incorrect|20|B|2||h${i}`);
  const base = {
    history: history.slice(),
    attempts: 4,
    correct_count: 0,
    streak: 0,
    time_spent_total: 80,
    srs: "keep-me",
    sm2: "keep-me-too",
    deck: "Biology",
    "se-interval": 2,
  };
  const off = JSON.parse(JSON.stringify(base));
  const on = JSON.parse(JSON.stringify(base));
  const offSummary = T.applyAttempt(off, { correct: false, chosen: "B", conf: 2, seconds: 20, now: DAYS(4) }, [1, 3, 7], {});
  const onSummary = T.applyAttempt(on, { correct: false, chosen: "B", conf: 2, seconds: 20, now: DAYS(4) }, [1, 3, 7], ON);

  assert.equal(on.next_review, off.next_review);
  assert.equal(on.streak, off.streak);
  assert.equal(on.attempts, off.attempts);
  assert.equal(on.correct_count, off.correct_count);
  assert.deepEqual(on.history, off.history);
  assert.equal(on.srs, "keep-me");
  assert.equal(on.sm2, "keep-me-too");
  assert.equal(on.deck, "Biology");
  assert.equal(on["se-interval"], 2);
  assert.equal(off.needs_fixing, undefined);
  assert.equal(on.needs_fixing, true);
  assert.equal(onSummary.needsFixingFlagged, true);
  assert.equal(offSummary.needsFixingFlagged, false);
});
