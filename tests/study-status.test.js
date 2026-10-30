"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.studyStatus;
const NOW = new Date(2026, 9, 29, 10, 0);
const TODAY = "2026-10-29";

function tomorrowKey(from) {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

test("study status: suspend stays hidden until restored and bury returns tomorrow", () => {
  const fm = {};
  S.setStudyStatus(fm, "buried", { now: NOW });
  assert.equal(fm.study_status, "buried");
  assert.equal(fm.buried_until, "2026-10-30");
  assert.equal(S.statusOf(fm, TODAY), "buried");
  assert.equal(S.statusOf(fm, "2026-10-30"), "active", "bury ends at the day boundary");
  assert.equal(S.studyStatusSummary(fm, TODAY), "Buried until 2026-10-30");
  assert.equal(S.statusLabel("buried"), "Buried");

  S.setStudyStatus(fm, "suspended", { now: NOW });
  assert.equal(fm.study_status, "suspended");
  assert.equal(fm.suspended_on, TODAY);
  assert.equal(fm.buried_until, undefined);
  assert.equal(S.statusOf(fm, "2999-01-01"), "suspended", "suspend does not expire on its own");
  assert.equal(S.studyStatusSummary(fm, TODAY), "Suspended on 2026-10-29");
  assert.equal(S.statusLabel("suspended"), "Suspended");
  assert.equal(S.isStudyable(fm, TODAY), false);

  S.setStudyStatus(fm, "known", { now: NOW, days: 7 });
  assert.equal(fm.suspended_on, undefined);
  assert.equal(S.statusOf(fm, TODAY), "known");
  S.setStudyStatus(fm, "active", { now: NOW });
  assert.equal(fm.buried_until, undefined);
});

test("study status: suspended and buried items leave every queue", () => {
  const suspended = question("Q/suspended.md", { attempts: 1, next_review: "2020-01-01", answer: "A", study_status: "suspended" });
  const buried = question("Q/buried.md", { attempts: 1, next_review: "2020-01-01", answer: "B", study_status: "buried", buried_until: "2026-10-30" });
  assert.equal(T.isDue(suspended.fm, TODAY), false);
  assert.equal(T.isDue(buried.fm, TODAY), false);
  assert.equal(T.isDue(buried.fm, "2026-10-30"), true);
  assert.equal(T.pickQuestion([suspended, buried], "due", TODAY, [], () => 0), null);
  assert.equal(T.pickQuestion([suspended, buried], "due", "2026-10-30", [], () => 0).file.path, "Q/buried.md");

  const activeCard = card("Cards/active.md", { card_id: "a", attempts: 0 });
  const buriedCard = card("Cards/buried.md", { card_id: "b", attempts: 1, next_review: "2020-01-01", study_status: "buried", buried_until: "2026-10-30" });
  const suspendedCard = card("Cards/suspended.md", { card_id: "s", attempts: 1, next_review: "2020-01-01", study_status: "suspended" });
  assert.deepEqual(T.cards.cardQueue([activeCard, buriedCard, suspendedCard], { today: TODAY, order: "all" }).map((c) => c.fm.card_id), ["a"]);
  assert.deepEqual(T.cards.cardQueue([activeCard, buriedCard, suspendedCard], { today: "2026-10-30", order: "all" }).map((c) => c.fm.card_id).sort(), ["a", "b"]);
});

test("study status: per-course Known days parse and override the global default", () => {
  const map = S.parseCourseDays("BIO 101=7, CHEM 201:21\nBROKEN\nNEG=-2");
  assert.deepEqual(map, { "BIO 101": 7, "CHEM 201": 21 });
  assert.equal(S.formatCourseDays(map), "BIO 101=7, CHEM 201=21");
  assert.equal(S.knownDaysForCourse(map, "bio 101", 14), 7);
  assert.equal(S.knownDaysForCourse(map, "  CHEM   201 ", 14), 21);
  assert.equal(S.knownDaysForCourse(map, "PHYS 101", 14), 14);
  assert.deepEqual(S.normalizeCourseDays({ BIO: 4, BAD: 0, NOPE: "x" }), { BIO: 4 });
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
  { path: "Questions/active.md", fm: { attempts: 2, next_review: "2020-01-01", answer: "B", course: "BIOL 201" } },
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

test("plugin: a course-specific Known snooze is used only for that course", async () => {
  const { plugin } = await setup();
  plugin.settings.knownDays = 14;
  plugin.settings.knownDaysByCourse = { "BIOL 201": 9 };
  const active = plugin.getQuestions().find((q) => q.file.path === "Questions/active.md");
  const other = plugin.getQuestions().find((q) => q.file.path === "Questions/known.md");
  assert.equal(plugin.knownDaysForFile(active.file), 9);
  assert.equal(plugin.knownDaysForFile(other.file), 14);
  const summary = await plugin.setStudyStatus(active.file, "known", { now: NOW });
  assert.equal(summary.days, 9);
  assert.equal(summary.until, "2026-11-07");
  assert.equal(active.fm.known_days, 9);
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

  const buryNow = new Date();
  const buried = await plugin.setStudyStatus(active.file, "buried", { now: buryNow });
  assert.equal(buried.status, "buried");
  assert.equal(active.fm.buried_until, tomorrowKey(buryNow));
  assert.match(plugin.studyStatusNotice(buried), /returns tomorrow/);
  assert.ok(plugin.studyStatusItems().some((item) => item.file.path === "Questions/active.md" && item.status === "buried"));

  const suspended = await plugin.setStudyStatus(active.file, "suspended", { now: NOW });
  assert.equal(suspended.status, "suspended");
  assert.equal(active.fm.suspended_on, TODAY);
  assert.equal(active.fm.buried_until, undefined);
  assert.match(plugin.studyStatusNotice(suspended), /Suspended/);
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
