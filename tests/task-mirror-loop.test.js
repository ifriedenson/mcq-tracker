"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { Plugin: QT } = load();
const TM = require("../src/task-mirror");

/** A vault with one overdue question, one new question and one due card. */
function loopApp() {
  return makeApp([
    { path: "Questions/Biochem/enzymes.md", fm: { attempts: 2, next_review: "2026-11-10", answer: "B", course: "Biology" } },
    { path: "Questions/Biochem/fresh.md", fm: { attempts: 0, answer: "C", course: "Biology" } },
    {
      path: "Cards/Biology/cell.md",
      noFm: true,
      fm: { card_id: "cell", item_type: "card", deck: "Biology", course: "Biology", attempts: 1, next_review: "2026-11-12" },
      text: "## Front\nWhat is a cell?\n\n## Back\nThe basic unit of life.\n",
    },
  ]);
}

/** The fake app ignores a noFm card's frontmatter; give the card its real fields. */
function withCardFields(app) {
  const card = app.files.find((f) => f.path === "Cards/Biology/cell.md");
  card.fm = { card_id: "cell", item_type: "card", deck: "Biology", course: "Biology", attempts: 1, next_review: "2026-11-12" };
  return app;
}

async function loopPlugin() {
  const app = withCardFields(loopApp());
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  plugin.settings.studyTasks = { enabled: true, tasks: [], mirrorNote: "Plans/study-loop.md" };
  await plugin.save();
  return { app, plugin };
}

const noteText = (app, path) => {
  const file = app.vault.getAbstractFileByPath(path);
  return file ? file.text : "";
};

/* ---- lines ------------------------------------------------------------- */

test("mirror: a due item is a Tasks-compatible linked line with its date", () => {
  const line = TM.dueItemLine(
    { title: "Enzymes", path: "Questions/Biochem/enzymes.md", dueDate: "2026-11-10", meta: "Question · Biology" },
    "2026-11-15",
  );
  assert.equal(line, "- [ ] [[Questions/Biochem/enzymes.md|Enzymes]] 📅 2026-11-10 · Question · Biology");
  // Never reviewed: no date of its own, so it is due today.
  assert.equal(
    TM.dueItemLine({ title: "Fresh", path: "Questions/fresh.md", dueDate: "" }, "2026-11-15"),
    "- [ ] [[Questions/fresh.md|Fresh]] 📅 2026-11-15",
  );
  // No markers for data the item does not carry.
  const bare = TM.dueItemLine({ title: "Bare" }, "2026-11-15");
  assert.ok(!bare.includes("⏰") && !bare.includes("⏫") && !bare.includes("🔁"), "nothing invented");
  assert.equal(bare, "- [ ] Bare 📅 2026-11-15");
  // A pipe or bracket in a title cannot break the link.
  assert.equal(
    TM.dueItemLine({ title: "A | B ] C", path: "Q/x.md" }, "2026-11-15"),
    "- [ ] [[Q/x.md|A - B C]] 📅 2026-11-15",
  );
  assert.equal(TM.dueItemLine({ title: "" }, "2026-11-15"), "");
});

test("mirror: due items land in their own section and the footer counts them", () => {
  const tasks = [{ title: "Review cells", due: "2026-11-20" }];
  const dueItems = [{ title: "Enzymes", path: "Questions/enzymes.md", dueDate: "2026-11-10", meta: "Question" }];
  const text = TM.mirrorMarkdown(tasks, "2026-11-15", { dueItems });
  assert.ok(text.includes("## Due today"), "due section");
  assert.ok(text.includes("- [ ] [[Questions/enzymes.md|Enzymes]] 📅 2026-11-10 · Question"), "due line");
  assert.ok(text.includes("1 open · 0 done · 1 due"), "footer counts the due queue");
  const lines = text.split("\n").filter((line) => line.startsWith("- ["));
  assert.equal(lines.length, 2, "one line per item");
  // Without due items the note keeps the format shipped in 1.305/1.307.
  assert.ok(!TM.mirrorMarkdown(tasks, "2026-11-15").includes("Due today"));
  assert.ok(TM.mirrorMarkdown(tasks, "2026-11-15", { dueItems: [] }).includes("1 open · 0 done._"));
});

/* ---- the plugin writes the whole loop ---------------------------------- */

test("mirror: exam-plan tasks and the due queue are written to the chosen note", async () => {
  const { app, plugin } = await loopPlugin();
  const planned = await plugin.generateStudyTasks({
    course: "Biology",
    examDate: "2026-12-20",
    startDate: "2026-11-16",
    topics: "Enzymes\nMembranes",
    passes: 1,
  });
  assert.ok(planned.length >= 2, "the plan made tasks");
  assert.ok(planned.every((task) => task.source === "exam"), "they are exam-plan tasks");

  const result = await (async () => {
    // A plain task too, to show the same note carries both halves.
    await plugin.addStudyTask({ title: "Review Biochem", due: "2026-11-20" });
    return plugin.syncStudyTasksToNote();
  })();
  assert.equal(result.ok, true);
  assert.equal(result.path, "Plans/study-loop.md");
  assert.equal(result.due, 3, "three due items: two questions and one card");

  const text = noteText(app, "Plans/study-loop.md");
  for (const task of planned) assert.ok(text.includes(task.title), `planned task ${task.title} in the note`);
  assert.ok(text.includes("Review Biochem"), "plain task in the note");
  assert.ok(text.includes("## Due today"), "due section");
  assert.ok(text.includes("[[Questions/Biochem/enzymes.md|enzymes]]"), "due question linked");
  assert.ok(text.includes("[[Cards/Biology/cell.md|cell]]"), "due card linked");
  assert.ok(text.includes("📅 2026-11-10"), "question keeps its overdue date");
  assert.ok(text.includes("📅 2026-11-12"), "card keeps its due date");
  assert.ok(text.includes("[[Questions/Biochem/fresh.md|fresh]] 📅"), "a never-reviewed question is due today");
});

test("mirror: refreshing rewrites the note without duplicate lines or data changes", async () => {
  const { app, plugin } = await loopPlugin();
  await plugin.generateStudyTasks({
    course: "Biology",
    examDate: "2026-12-20",
    startDate: "2026-11-16",
    topics: "Enzymes\nMembranes",
    passes: 2,
  });
  const before = JSON.parse(JSON.stringify(plugin.settings.studyTasks));
  await plugin.syncStudyTasksToNote();
  const first = noteText(app, "Plans/study-loop.md");
  const writes = (app.modified || []).length;

  await plugin.syncStudyTasksToNote();
  await plugin.syncStudyTasksToNote();
  const third = noteText(app, "Plans/study-loop.md");
  assert.equal(third, first, "the same data renders the same note");
  assert.ok((app.modified || []).length > writes, "the note is rewritten, not appended to");
  const lines = third.split("\n").filter((line) => line.startsWith("- ["));
  assert.equal(new Set(lines).size, lines.length, "no duplicate lines");
  assert.deepEqual(JSON.parse(JSON.stringify(plugin.settings.studyTasks)), before, "data.json untouched");
});

test("mirror: task-line ticks are read back, due-item ticks are still overwritten", async () => {
  const { app, plugin } = await loopPlugin();
  await plugin.addStudyTask({ title: "Review Biochem", due: "2026-11-20" });
  await plugin.syncStudyTasksToNote();
  const file = app.vault.getAbstractFileByPath("Plans/study-loop.md");
  file.text = file.text.replace("- [ ] Review Biochem", "- [x] Review Biochem").replace("- [ ] [[", "- [x] [[");
  await plugin.syncStudyTasksToNote();
  const text = noteText(app, "Plans/study-loop.md");
  assert.ok(text.includes("- [x] Review Biochem"), "ticking a task line completes the task");
  assert.ok(plugin.settings.studyTasks.tasks.some((task) => task.title === "Review Biochem" && task.done), "data followed the tick");
  assert.ok(!text.includes("- [x] [["), "ticking a linked due item changed nothing");
});

test("mirror: completing a task rewrites the note, and a recorded review drops the due item", async () => {
  const { app, plugin } = await loopPlugin();
  const task = await plugin.addStudyTask({ title: "Review Biochem", due: "2026-11-20", time: "08:15" });
  assert.ok(noteText(app, "Plans/study-loop.md").includes("- [ ] Review Biochem 📅 2026-11-20 ⏰ 08:15"));

  await plugin.updateStudyTask(task.id, { done: true });
  const done = noteText(app, "Plans/study-loop.md");
  assert.ok(done.includes("- [x] Review Biochem 📅 2026-11-20 ⏰ 08:15"), "completion is reflected");
  assert.ok(done.includes("## Done"), "under the done heading");

  const question = app.files.find((f) => f.path === "Questions/Biochem/enzymes.md");
  await plugin.recordAttempt(question, { correct: false, seconds: 30, grade: 1, now: new Date() });
  // The review hook refreshes in the background; wait for the note to catch up.
  for (let i = 0; i < 100; i++) {
    if (!noteText(app, "Plans/study-loop.md").includes("enzymes")) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const after = noteText(app, "Plans/study-loop.md");
  assert.ok(!after.includes("[[Questions/Biochem/enzymes.md|enzymes]]"), "the reviewed question left the due list");
  assert.ok(after.includes("[[Questions/Biochem/fresh.md|fresh]]"), "the untouched one stays");
  assert.ok(after.includes("- [x] Review Biochem"), "the task list is still there");
});
