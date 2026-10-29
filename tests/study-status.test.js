"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.studyStatus;
const NOW = new Date(2026, 9, 29, 10, 0);
const TODAY = "2026-10-29";

const question = (path, fm) => ({ file: { path, basename: path.replace(/^.*\//, "").replace(/\.md$/, "") }, fm });
const card = (path, fm) => {
  const q = question(path, fm);
  return { ...q, deck: "Biology", course: "BIOL 201", kind: "card" };
};

test("study status: Known expires, Exclude persists, and Restore clears every property", () => {
  const fm = {};
  S.setStudyStatus(fm, "known", { now: NOW, days: 14 });
  assert.equal(fm.study_status, "known");
  assert.equal(fm.known_days, 14);
  assert.equal(fm.known_until, "2026-11-12");
  assert.equal(S.statusOf(fm, TODAY), "known");
  assert.equal(S.statusOf(fm, "2026-11-12"), "active", "the item returns on the day the snooze ends");
  assert.equal(S.studyStatusSummary(fm, TODAY), "Known until 2026-11-12");

  S.setStudyStatus(fm, "excluded", { now: NOW, reason: "already know it" });
  assert.equal(fm.study_status, "excluded");
  assert.equal(fm.excluded_on, TODAY);
  assert.equal(fm.excluded_reason, "already know it");
  assert.equal(fm.known_until, undefined);
  assert.equal(S.isStudyable(fm, TODAY), false);
  assert.equal(S.statusOf(fm, "2999-01-01"), "excluded", "excluding is not date-bound");

  S.setStudyStatus(fm, "active", { now: NOW });
  assert.equal(fm.study_status, undefined);
  assert.equal(fm.known_until, undefined);
  assert.equal(fm.excluded_on, undefined);
  assert.equal(fm.excluded_reason, undefined);
  assert.equal(S.isStudyable(fm, TODAY), true);
});

test("study status: missing and malformed dates fall back safely", () => {
  assert.equal(S.statusOf({}, TODAY), "active");
  assert.equal(S.statusOf({ study_status: "known" }, TODAY), "active", "a Known status without a date does not hide forever");
  assert.equal(S.statusOf({ study_status: "known", known_until: "not-a-date" }, TODAY), "active");
  assert.equal(S.statusOf({ study_status: "KNOWN", known_until: "2999-01-01" }, TODAY), "known");
  const fm = {};
  S.setStudyStatus(fm, "known", { now: NOW, days: -4 });
  assert.equal(fm.known_days, S.DEFAULT_KNOWN_DAYS);
});

test("study status: a snapshot restores the exact previous state for Undo", () => {
  const fm = { study_status: "known", known_days: 7, known_until: "2999-01-01", unrelated: "keep" };
  const snapshot = S.snapshotStudyStatus(fm);
  assert.deepEqual(snapshot, { study_status: "known", known_days: 7, known_until: "2999-01-01" });

  const summary = S.setStudyStatus(fm, "excluded", { now: NOW, reason: "test undo" });
  assert.deepEqual(summary.previous, snapshot);
  assert.equal(fm.study_status, "excluded");
  assert.equal(fm.known_until, undefined);

  S.restoreStudyStatus(fm, summary.previous);
  assert.equal(fm.study_status, "known");
  assert.equal(fm.known_days, 7);
  assert.equal(fm.known_until, "2999-01-01");
  assert.equal(fm.excluded_on, undefined);
  assert.equal(fm.excluded_reason, undefined);
  assert.equal(fm.unrelated, "keep", "undo only touches status properties");
});

test("study status: isDue, pickQuestion, cardQueue and the due queue all agree", () => {
  const active = question("Q/active.md", { attempts: 1, next_review: "2020-01-01", answer: "A" });
  const known = question("Q/known.md", {
    attempts: 1,
    next_review: "2020-01-01",
    answer: "B",
    study_status: "known",
    known_until: "2999-01-01",
  });
  const excluded = question("Q/excluded.md", { answer: "C", study_status: "excluded" });

  assert.equal(T.isDue(active.fm, TODAY), true);
  assert.equal(T.isDue(known.fm, TODAY), false);
  assert.equal(T.isDue(excluded.fm, TODAY), false);
  assert.equal(T.pickQuestion([active, known, excluded], "due", TODAY, [], () => 0).file.path, "Q/active.md");

  const activeCard = card("Cards/active.md", { card_id: "a", attempts: 0 });
  const knownCard = card("Cards/known.md", {
    card_id: "k",
    attempts: 2,
    next_review: "2020-01-01",
    study_status: "known",
    known_until: "2999-01-01",
  });
  const excludedCard = card("Cards/excluded.md", { card_id: "x", attempts: 0, study_status: "excluded" });

  assert.deepEqual(T.cards.cardQueue([activeCard, knownCard, excludedCard], { today: TODAY, order: "all" }).map((c) => c.fm.card_id), ["a"]);
  assert.deepEqual(T.cards.cardStats([activeCard, knownCard, excludedCard], TODAY), { total: 3, due: 0, fresh: 1 });

  const queue = T.buildDueQueue([active, known, excluded], [activeCard, knownCard, excludedCard], { today: TODAY });
  assert.equal(queue.counts.questions, 1);
  assert.equal(queue.counts.cards, 1);
  assert.equal(queue.counts.total, 2);
  assert.deepEqual(queue.items.map((item) => item.path).sort(), ["Cards/active.md", "Q/active.md"]);
});

const NOTES = [
  { path: "Questions/active.md", fm: { attempts: 2, next_review: "2020-01-01", answer: "B" } },
  {
    path: "Questions/known.md",
    fm: { attempts: 2, next_review: "2020-01-01", answer: "B", study_status: "known", known_until: "2999-01-01" },
  },
  { path: "Questions/excluded.md", fm: { answer: "C", study_status: "excluded" } },
  { path: "Cards/active.md", noFm: true, fm: { card_id: "active", item_type: "card", deck: "Biology", attempts: 0 } },
  {
    path: "Cards/known.md",
    noFm: true,
    fm: {
      card_id: "known",
      item_type: "card",
      deck: "Biology",
      attempts: 2,
      next_review: "2020-01-01",
      study_status: "known",
      known_until: "2999-01-01",
    },
  },
];

async function setup() {
  const app = makeApp(NOTES);
  NOTES.forEach((note, i) => {
    if (note.noFm && note.fm) app.files[i].fm = { ...note.fm };
  });
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.knownDays = 14;
  const dom = makeDom();
  return { app, plugin, dom };
}

test("plugin: hidden items leave practice, cards and the merged queue but stay in the vault", async () => {
  const { plugin } = await setup();
  assert.equal(plugin.getQuestions().length, 3, "the notes are still loaded");
  assert.deepEqual(plugin.filtered(plugin.getQuestions()).map((q) => q.file.path), ["Questions/active.md"]);
  assert.equal(plugin.filtered(plugin.getQuestions(), { includeHidden: true }).length, 3);
  assert.deepEqual(plugin.filteredCards().map((c) => c.file.path), ["Cards/active.md"]);
  assert.equal(plugin.filteredCards({ includeHidden: true }).length, 2);

  const queue = plugin.getDueQueue({ today: TODAY });
  assert.equal(queue.counts.questions, 1);
  assert.equal(queue.counts.cards, 1);
  assert.deepEqual(queue.items.map((item) => item.path).sort(), ["Cards/active.md", "Questions/active.md"]);

  const hidden = plugin.studyStatusItems();
  assert.deepEqual(hidden.map((item) => item.file.path).sort(), ["Cards/known.md", "Questions/excluded.md", "Questions/known.md"]);
});

test("plugin: setting and restoring a status writes readable properties and refreshes the queues", async () => {
  const { plugin } = await setup();
  const known = plugin.getQuestions().find((q) => q.file.path === "Questions/known.md");
  const active = plugin.getQuestions().find((q) => q.file.path === "Questions/active.md");

  const restored = await plugin.setStudyStatus(known.file, "active");
  assert.equal(restored.status, "active");
  assert.equal(known.fm.study_status, undefined);
  assert.equal(plugin.filtered(plugin.getQuestions()).length, 2);

  const snoozed = await plugin.setStudyStatus(active.file, "known", { now: NOW, days: 7 });
  assert.equal(snoozed.status, "known");
  assert.equal(active.fm.study_status, "known");
  assert.equal(active.fm.known_until, "2026-11-05");
  assert.deepEqual(plugin.filtered(plugin.getQuestions()).map((q) => q.file.path), ["Questions/known.md"]);

  const excluded = await plugin.setStudyStatus(known.file, "excluded", { reason: "known it" });
  assert.equal(excluded.status, "excluded");
  assert.equal(known.fm.excluded_reason, "known it");
  assert.equal(plugin.studyStatusNotice(snoozed), "Known for 7 days (until 2026-11-05).");
  assert.match(plugin.studyStatusNotice(excluded), /Excluded from practice/);
});

test("practice view: Known and Exclude update the current question and move on", async () => {
  const { app, plugin, dom } = await setup();
  const q = plugin.getQuestions().find((item) => item.file.path === "Questions/active.md");
  const view = new T.PracticeView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.current = q;
  let advanced = 0;
  view.next = async () => {
    advanced++;
  };
  const calls = [];
  plugin.setStudyStatus = async (file, status) => {
    calls.push([file.path, status]);
    return { status, days: 14, until: "2026-11-12" };
  };
  plugin.studyStatusNotice = () => "updated";

  await view.setCurrentStudyStatus("known");
  assert.deepEqual(calls.pop(), ["Questions/active.md", "known"]);
  assert.equal(advanced, 1);

  plugin.askConfirm = async () => false;
  await view.setCurrentStudyStatus("excluded");
  assert.equal(calls.length, 0, "cancelling the confirmation changes nothing");
  assert.equal(advanced, 1);
});

test("card view: Known removes the current card from the session", async () => {
  const { app, plugin, dom } = await setup();
  const cards = plugin.getCards();
  const view = new T.CardView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.current = cards[0];
  view.queue = cards.slice();
  view.index = 0;
  view.busy = false;
  view.pendingGradeId = "";
  let shown = 0;
  view.showCard = async () => {
    shown++;
  };
  plugin.setStudyStatus = async () => ({ status: "known", days: 14, until: "2026-11-12" });
  plugin.studyStatusNotice = () => "updated";

  await view.setCurrentStudyStatus("known");
  assert.equal(view.queue.length, 1);
  assert.equal(shown, 1);
  assert.equal(view.queue.includes(view.current), false);
});
