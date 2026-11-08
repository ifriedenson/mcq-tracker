"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { Plugin: QT, obsidian } = load();
const M = require("../src/review-sidebar-model");
const U = require("../src/utc-dates");
const { ReviewSidebarView } = require("../src/review-sidebar");

function snapshot(rows) {
  return {
    today: "2026-11-08",
    notes: rows.map((row) => ({
      kind: "note",
      path: row.path,
      title: row.title || row.path.replace(/\.md$/, ""),
      set: row.set === undefined ? "Review" : row.set,
      due: row.due,
      isNew: row.isNew === true,
      priority: row.priority || "normal",
      minutes: row.minutes === undefined ? 2 : row.minutes,
    })),
  };
}

function settings(extra) {
  return { ...M.normalizeReviewSidebarSettings(undefined), ...extra };
}

test("review sidebar: settings clamp corrupt values and keep their defaults", () => {
  assert.deepEqual(M.normalizeReviewSidebarSettings(undefined), {
    enabled: true,
    sort: "due",
    filter: "all",
    upcomingDays: 14,
    showEstimates: true,
    showPomodoro: true,
    overrideHours: 0,
    overrideMinutes: 0,
    overrideMode: "add",
    weekStartsOn: "monday",
  });
  const fixed = M.normalizeReviewSidebarSettings({
    enabled: false,
    sort: "nope",
    filter: "nope",
    upcomingDays: 500,
    overrideHours: -3,
    overrideMinutes: 90,
    overrideMode: "nope",
    weekStartsOn: "sunday",
  });
  assert.equal(fixed.enabled, false);
  assert.equal(fixed.sort, "due");
  assert.equal(fixed.filter, "all");
  assert.equal(fixed.upcomingDays, 90);
  assert.equal(fixed.overrideHours, 0);
  assert.equal(fixed.overrideMinutes, 59);
  assert.equal(fixed.overrideMode, "add");
  assert.equal(fixed.weekStartsOn, "sunday");
});

test("review sidebar: today, overdue and upcoming notes group and the far future stays out", () => {
  const data = M.buildReviewSidebar(
    snapshot([
      { path: "Notes/Overdue.md", due: "2026-11-06", minutes: 3 },
      { path: "Notes/Today.md", due: "2026-11-08", minutes: 2 },
      { path: "Notes/New.md", due: "2026-11-08", isNew: true, minutes: 2 },
      { path: "Notes/Soon.md", due: "2026-11-12", minutes: 4 },
      { path: "Notes/Far.md", due: "2027-03-01", minutes: 5 },
    ]),
    { all: [] },
    { today: "2026-11-08", settings: settings({ upcomingDays: 14 }) }
  );
  assert.deepEqual(data.rows.map((row) => row.path), ["Notes/Overdue.md", "Notes/New.md", "Notes/Today.md", "Notes/Soon.md"]);
  assert.equal(data.counts.overdue, 1);
  assert.equal(data.counts.due, 2);
  assert.equal(data.counts.upcoming, 1);
  assert.equal(data.minutes, 11);
  assert.deepEqual(data.groups.map((group) => group.label), ["Overdue", "Today", "2026-11-12"]);
  assert.equal(M.workloadLabel(data.minutes), "11 min");
});

test("review sidebar: the queue contributes new notes and the sort/filter never edits a due date", () => {
  const queue = {
    all: [
      { path: "Notes/Queued.md", title: "Queued", set: "Review", dueDate: "2026-11-08", isNew: true, priority: "high" },
    ],
  };
  const data = M.buildReviewSidebar(snapshot([{ path: "Notes/Later.md", due: "2026-11-20" }]), queue, {
    today: "2026-11-08",
    noteMinutes: 4,
    settings: settings({ sort: "priority", filter: "all", upcomingDays: 20 }),
  });
  assert.deepEqual(data.rows.map((row) => row.path), ["Notes/Queued.md", "Notes/Later.md"]);
  assert.equal(data.rows[0].priority, "high");
  assert.equal(data.rows[0].minutes, 4);
  assert.equal(data.rows[0].due, "2026-11-08");
  const onlyDue = M.buildReviewSidebar(snapshot([{ path: "A.md", due: "2026-11-30" }]), { all: [] }, {
    today: "2026-11-08",
    settings: settings({ filter: "due", upcomingDays: 30 }),
  });
  assert.deepEqual(onlyDue.rows, []);
});

test("review sidebar: the manual target adds to or replaces the estimate only", () => {
  assert.equal(M.timeTarget(30, { overrideHours: 1, overrideMinutes: 15 }), 105);
  assert.equal(M.timeTarget(30, { overrideMode: "replace", overrideMinutes: 25 }), 25);
  const data = M.buildReviewSidebar(snapshot([{ path: "A.md", due: "2026-11-08", minutes: 10 }]), { all: [] }, {
    today: "2026-11-08",
    settings: settings({ overrideHours: 1 }),
  });
  assert.equal(data.rows[0].due, "2026-11-08");
  assert.equal(data.minutes, 10);
  assert.equal(data.targetMinutes, 70);
  assert.equal(M.adjacentPath([{ path: "A.md" }, { path: "B.md" }], "A.md", "previous"), "B.md");
  assert.equal(M.adjacentPath([{ path: "A.md" }, { path: "B.md" }], "B.md", "next"), "A.md");
});

test("review sidebar: the view renders the due list and its calendar from the same queue", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reviewSidebar = settings({ showPomodoro: false });
  plugin.reviewCalendarSnapshot = () =>
    snapshot([
      { path: "Notes/Overdue.md", due: "2026-11-06", minutes: 3 },
      { path: "Notes/Today.md", due: "2026-11-08", minutes: 2 },
    ]);
  plugin.getNoteQueue = () => ({ all: [], counts: { due: 2 } });
  plugin.reviewCalendarSettings = () => ({ noteMinutes: 2 });
  plugin.app.vault.getAbstractFileByPath = () => null;

  const dom = makeDom();
  const view = new ReviewSidebarView({ app }, plugin);
  view.contentEl = dom.root;
  await view.onOpen();
  const texts = dom.texts();
  assert.ok(texts.includes("Review schedule"));
  assert.ok(texts.includes("Notes/Overdue"));
  assert.ok(texts.includes("Notes/Today"));
  assert.ok(texts.includes("Overdue"));
  assert.ok(texts.some((text) => /\dd overdue/.test(text)), "the overdue row says how late it is");

  view.tab = "calendar";
  view.render();
  const month = U.monthLabel(view.cursor.getUTCFullYear(), view.cursor.getUTCMonth());
  assert.ok(dom.texts().includes(month), `the calendar shows ${month}`);
  assert.ok(dom.texts().includes("Mon") || dom.texts().includes("Sun"));
});

test("review sidebar: the Open review sidebar command opens the view and refuses when it is off", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const command = plugin.commands.find((entry) => entry.id === "open-review-sidebar");
  assert.ok(command, "open-review-sidebar is registered");
  plugin.activateReviewSidebar = async () => "opened";
  assert.equal(await command.callback(), "opened");
  delete plugin.activateReviewSidebar; // fall back to the real method so its guard runs
  plugin.settings.reviewSidebar = settings({ enabled: false });
  assert.equal(await plugin.activateReviewSidebar(), null);
  assert.equal(plugin.reviewSidebarEnabled(), false);
});

test("review sidebar: review-next-note and review-previous-note walk the queue in both directions", async () => {
  const app = makeApp([
    { path: "Notes/A.md", fm: { question_id: undefined, tags: ["review"] }, text: "# A\n\nWhole note." },
    { path: "Notes/B.md", fm: { question_id: undefined, tags: ["review"] }, text: "# B\n\nWhole note." },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.noteReview = {
    enabled: true,
    limit: 20,
    sets: [{ name: "Review", folders: ["Notes"], tags: ["review"], priority: "normal" }],
  };
  // Obsidian makes the opened note active; the fake workspace records opens only.
  app.workspace.getActiveFile = () => {
    const last = app.opened[app.opened.length - 1];
    return app.files.find((file) => file.path === last) || null;
  };
  const next = plugin.commands.find((entry) => entry.id === "review-next-note");
  const previous = plugin.commands.find((entry) => entry.id === "review-previous-note");
  assert.ok(next && previous);
  assert.deepEqual(plugin.getNoteQueue({ limit: 0 }).all.map((row) => row.path), ["Notes/A.md", "Notes/B.md"]);
  await next.callback();
  assert.deepEqual(app.opened.slice(-1), ["Notes/A.md"]);
  await next.callback();
  assert.deepEqual(app.opened.slice(-1), ["Notes/B.md"]);
  await next.callback();
  assert.deepEqual(app.opened.slice(-1), ["Notes/A.md"], "next wraps to the first note");
  await previous.callback();
  assert.deepEqual(app.opened.slice(-1), ["Notes/B.md"], "previous wraps to the last note");
});

test("review sidebar: Review current note hands the active note to the single-note review", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = new obsidian.TFile();
  file.path = "Notes/Unit 1.md";
  file.basename = "Unit 1";
  app.workspace.getActiveFile = () => file;
  const reviewed = [];
  plugin.openNoteReviewForFile = (target) => reviewed.push(target && target.path);
  const command = plugin.commands.find((entry) => entry.id === "review-current-note");
  assert.ok(command, "review-current-note is registered");
  await command.callback();
  assert.deepEqual(reviewed, ["Notes/Unit 1.md"]);
});

test("review sidebar: removing a note hides it from review without deleting its schedule", async () => {
  const app = makeApp([{ path: "Notes/Unit 2.md", fm: { question_id: undefined, tags: ["review"], attempts: 3, next_review: "2026-11-09" } }]);
  const plugin = new QT(app);
  await plugin.onload();
  const file = app.files[0];
  assert.equal(await plugin.removeNoteFromReview(file), true);
  assert.equal(file.fm.note_review_excluded, true);
  assert.equal(file.fm.next_review, "2026-11-09");
  assert.equal(file.fm.attempts, 3);
  assert.equal(await plugin.removeNoteFromReview({ path: "Notes/not-a-note.txt" }), false);
});
