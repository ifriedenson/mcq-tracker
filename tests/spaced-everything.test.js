"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();
const S = T.spacedEverything;

function note(path, fm, text) {
  return { file: { path, basename: path.replace(/^.*\//, "").replace(/\.md$/, "") }, fm: fm || {}, text: text || "" };
}

async function start(notes) {
  const app = makeApp((notes || []).map((n) => (n.file ? { path: n.file.path, fm: n.fm, text: n.text } : n)));
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.spacedEverything = S.normalizeSpacedEverything({ enabled: true });
  return { app, plugin };
}

test("spaced everything: SM-2 uses the writing-practice scores", () => {
  assert.deepEqual(S.superMemoSchedule({ interval: 7, easeFactor: 2.5, reviewScore: 1 }), { interval: 1, easeFactor: 1.96 });
  assert.deepEqual(S.superMemoSchedule({ interval: 7, easeFactor: 2.5, reviewScore: 3 }), { interval: 16.52, easeFactor: 2.36 });
  assert.deepEqual(S.superMemoSchedule({ interval: 7, easeFactor: 2.5, reviewScore: 5 }), { interval: 18.2, easeFactor: 2.6 });
  assert.equal(S.ratingFor("fruitful").score, 1);
  assert.equal(S.ratingFor("unfruitful").score, 5);
  assert.equal(S.ratingFor("ignore").score, 3);
  assert.equal(S.ratingFor("bogus"), null);
});

test("spaced everything: queue includes due and new onboarded notes, not future or excluded notes", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const notes = [
    note("Notes/Due.md", { question_id: undefined, "se-interval": 1, "se-ease": 2.5, "se-last-reviewed": "2026-10-28T12:00:00Z" }),
    note("Notes/New.md", { question_id: undefined, "se-interval": 1, "se-ease": 2.5 }),
    note("Notes/Future.md", { question_id: undefined, "se-interval": 5, "se-ease": 2.5, "se-last-reviewed": "2026-10-30T12:00:00Z" }),
    note("Notes/Off.md", { question_id: undefined, tags: ["other"] }),
    note("Notes/Suspended.md", { question_id: undefined, "se-interval": 1, "study_status": "suspended" }),
    note("Questions/Q.md", { question_id: "Q", "se-interval": 1 }),
    note("Notes/Bad.md", { question_id: undefined, "se-interval": "bad", "se-ease": "bad", "se-last-reviewed": "bad" }),
  ];
  const queue = S.buildSpacedQueue(notes, { now, limit: 20 });
  assert.deepEqual(queue.items.map((row) => row.path), ["Notes/Bad.md", "Notes/New.md", "Notes/Due.md"]);
  assert.equal(queue.counts.due, 3);
  assert.equal(queue.counts.onboarded, 3);
  assert.equal(queue.items[0].onboarded, true);
  assert.equal(queue.items[2].overdueDays, 1);
});

test("spaced everything: missing and malformed state is safe", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  assert.equal(S.spacedDueAt({}, {}), null);
  assert.equal(S.spacedDueAt({ "se-interval": 1, "se-last-reviewed": "not a date" }, {}), 0);
  const state = S.spacedState({ "se-interval": -4, "se-ease": 0, "se-last-reviewed": "" }, { defaultInterval: 3, defaultEase: 2.1 });
  assert.equal(state.interval, 3);
  assert.equal(state.easeFactor, 2.1);
  assert.equal(state.lastReviewed, null);
  assert.deepEqual(S.buildSpacedQueue([], {}).counts, { due: 0, onboarded: 0 });
});

test("spaced everything: review updates se-* only and leaves question tracking untouched", async () => {
  const file = note("Notes/Unit.md", { question_id: undefined, attempts: 8, history: [{ correct: true }], "se-interval": 2, "se-ease": 2.5, "se-last-reviewed": "2026-10-20T10:00:00Z" });
  const { app, plugin } = await start([file]);
  app.workspace.getActiveFile = () => app.files[0];
  const summary = await plugin.recordSpacedReview(app.files[0], "ignore", 30, new Date("2026-10-30T12:00:00Z"));
  assert.equal(summary.rating, "ignore");
  assert.equal(summary.interval, 4.72);
  assert.equal(app.files[0].fm.attempts, 8);
  assert.deepEqual(app.files[0].fm.history, [{ correct: true }]);
  assert.equal(app.files[0].fm["se-interval"], 4.72);
  assert.equal(app.files[0].fm["se-last-reviewed"], "2026-10-30T12:00:00Z");
});

test("spaced everything: templates, capture notes, restart persistence and queue integration", async () => {
  const now = new Date("2026-10-30T12:34:00Z");
  const { app, plugin } = await start([{ path: "Notes/Due.md", fm: { question_id: undefined, "se-interval": 1, "se-last-reviewed": "2026-10-28T12:00:00Z" }, text: "# Due" }]);
  plugin.settings.spacedEverything = S.normalizeSpacedEverything({
    enabled: true,
    captureFolder: "Inbox",
    titleTemplate: "Thought {{date}} {{time}}",
    noteTemplate: "# {{thought}}\nCaptured {{date}}",
  });
  const rendered = S.renderSpacedTemplate("{{date}}|{{time}}|{{unixtime}}|{{thought}}", "idea", now);
  assert.match(rendered, /^2026-10-30\|\d{2}:\d{2}\|\d+\|idea$/);
  const made = await plugin.captureSpacedThought("Remember {{date}}", { now });
  assert.match(made.path, /^Inbox\/Thought /);
  const written = app.created.find((entry) => entry.path === made.path);
  assert.match(written.text, /se-interval: 1/);
  assert.match(written.text, /se-ease: 2.5/);
  assert.match(written.text, /se-last-reviewed: ""/);
  assert.match(written.text, /Remember 2026-10-30/);
  const again = await plugin.captureSpacedThought("Second", { now });
  assert.match(again.path, / 2\.md$/);
  assert.equal(plugin.getSpacedQueue({ now }).counts.due, 1);
  await plugin.save();
  const restarted = new QT(app);
  restarted.saved = plugin.saved;
  await restarted.onload();
  assert.equal(restarted.settings.spacedEverything.enabled, true);
  assert.equal(restarted.getSpacedQueue({ now }).counts.due, 1);
});

test("spaced everything: commands and modal use the shared note-review queue", async () => {
  const { app, plugin } = await start([{ path: "Notes/Modal.md", fm: { question_id: undefined, "se-interval": 1, "se-last-reviewed": "2026-10-28T12:00:00Z" }, text: "# Modal note" }]);
  assert.ok(plugin.commands.some((command) => command.id === "spaced-everything-review"));
  assert.ok(plugin.commands.some((command) => command.id === "spaced-everything-log"));
  assert.ok(plugin.commands.some((command) => command.id === "spaced-everything-capture"));
  const modal = new T.NoteReviewModal(app, plugin, { mode: "spaced", files: [app.files[0]], includeUnonboarded: true });
  modal.app = app;
  const dom = makeDom();
  modal.contentEl = dom.root;
  await modal.onOpen();
  assert.ok(dom.texts().includes("Fruitful"));
  assert.ok(dom.texts().includes("Unfruitful"));
  assert.ok(dom.texts().includes("Ignore"));
  await dom.click("Fruitful");
  assert.equal(app.files[0].fm["se-interval"], 1);
  assert.equal(app.files[0].fm["se-ease"], 1.96);
  assert.equal(app.files[0].fm.attempts, undefined);
  obsidian.notices.length = 0;
});
