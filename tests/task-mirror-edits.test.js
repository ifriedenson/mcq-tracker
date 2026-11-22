"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

const { Plugin: QT } = load();
const TM = require("../src/task-mirror");

async function mirrorPlugin() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.studyTasks = { enabled: true, tasks: [], mirrorNote: "Plans/loop.md" };
  await plugin.save();
  return { app, plugin };
}

const noteText = (app, path) => {
  const file = app.vault.getAbstractFileByPath(path);
  return file ? file.text : "";
};

/* ---- parseMirrorTaskLine ----------------------------------------------- */

test("mirror edits: a task line parses back to its fields", () => {
  const row = TM.parseMirrorTaskLine("- [ ] Review cells 📅 2026-11-20 ⏰ 08:15 ⏫ 🔁 every week #deep · Biology");
  assert.equal(row.title, "Review cells");
  assert.equal(row.due, "2026-11-20");
  assert.equal(row.time, "08:15");
  assert.equal(row.done, false);
  assert.equal(row.cancelled, false);
});

test("mirror edits: boxes, bare lines and non-task lines", () => {
  assert.equal(TM.parseMirrorTaskLine("- [x] Done 📅 2026-11-20").done, true);
  assert.equal(TM.parseMirrorTaskLine("- [-] Gone 📅 2026-11-20").cancelled, true);
  assert.equal(TM.parseMirrorTaskLine("- [/] Gone 📅 2026-11-20").cancelled, true);
  const bare = TM.parseMirrorTaskLine("- [ ] Just a title");
  assert.equal(bare.title, "Just a title");
  assert.equal(bare.due, "");
  assert.equal(bare.time, "");
  // Due-queue rows link at a note: never task edits.
  assert.equal(TM.parseMirrorTaskLine("- [ ] [[Q/a.md|Enzymes]] 📅 2026-11-10 · Question"), null);
  assert.equal(TM.parseMirrorTaskLine("# Study tasks"), null);
  assert.equal(TM.parseMirrorTaskLine(""), null);
});

/* ---- applyMirrorEdits (pure) -------------------------------------------- */

const TASKS = () => [
  { id: "a", title: "Review cells", due: "2026-11-20", time: "", done: false, doneAt: "" },
  { id: "b", title: "Drill", due: "", time: "", done: false, doneAt: "" },
];

const NOTE = (body) => `# Study tasks\n\n_One-way mirror from MCQ Tracker — edits here are overwritten._\n\n${body}\n\n_Mirrored 2026-11-15 · 2 open · 0 done._\n`;

test("mirror edits: a changed date reschedules, a removed date clears", () => {
  const first = TM.applyMirrorEdits(TASKS(), NOTE("- [ ] Review cells 📅 2026-11-25\n- [ ] Drill"), "2026-11-15");
  assert.equal(first.tasks.find((t) => t.id === "a").due, "2026-11-25");
  assert.equal(first.rescheduled, 1);
  assert.equal(first.cancelled, 0);
  const second = TM.applyMirrorEdits(
    [{ id: "a", title: "Review cells", due: "2026-11-20", time: "08:15", done: false, doneAt: "" }],
    NOTE("- [ ] Review cells"),
    "2026-11-15",
  );
  assert.equal(second.tasks[0].due, "");
  assert.equal(second.tasks[0].time, "");
  assert.equal(second.rescheduled, 1);
});

test("mirror edits: tick completes, untick reopens, [-] and a deleted line cancel", () => {
  const done = TM.applyMirrorEdits(TASKS(), NOTE("- [x] Review cells 📅 2026-11-20\n- [ ] Drill"), "2026-11-16");
  assert.equal(done.tasks.find((t) => t.id === "a").done, true);
  assert.equal(done.tasks.find((t) => t.id === "a").doneAt, "2026-11-16");
  assert.equal(done.completed, 1);

  const open = [{ id: "a", title: "Review cells", due: "2026-11-20", time: "", done: true, doneAt: "2026-11-15" }];
  const back = TM.applyMirrorEdits(open, NOTE("- [ ] Review cells 📅 2026-11-20"), "2026-11-16");
  assert.equal(back.tasks[0].done, false);
  assert.equal(back.reopened, 1);

  const crossed = TM.applyMirrorEdits(TASKS(), NOTE("- [-] Review cells 📅 2026-11-20\n- [ ] Drill"), "2026-11-15");
  assert.ok(!crossed.tasks.some((t) => t.id === "a"), "a [-] line cancels the task");
  assert.equal(crossed.cancelled, 1);

  const deleted = TM.applyMirrorEdits(TASKS(), NOTE("- [ ] Drill"), "2026-11-15", { renderedIds: ["a", "b"] });
  assert.ok(!deleted.tasks.some((t) => t.id === "a"), "a deleted line cancels the task");
  assert.equal(deleted.cancelled, 1);
  // A task added after the last rewrite is missing from a stale note too, but
  // it was never rendered, so the read-back before the next rewrite keeps it.
  const stale = TM.applyMirrorEdits(TASKS(), NOTE("- [ ] Drill"), "2026-11-15", { renderedIds: ["b"] });
  assert.ok(stale.tasks.some((t) => t.id === "a"), "a never-rendered task survives a stale note");
  assert.equal(stale.cancelled, 0);
});

test("mirror edits: a foreign note never wipes the store", () => {
  const foreign = TM.applyMirrorEdits(TASKS(), "# Somebody else\n\n- [ ] Review cells 📅 2026-11-25\n", "2026-11-15");
  assert.equal(foreign.tasks.length, 2);
  assert.equal(foreign.rescheduled, 0);
  assert.equal(foreign.cancelled, 0);
  // No footer either: reschedules still apply, deletions do not.
  const noFoot = TM.applyMirrorEdits(TASKS(), "# Study tasks\n\n- [ ] Drill\n", "2026-11-15");
  assert.equal(noFoot.tasks.length, 2, "a truncated mirror keeps the missing task");
  assert.equal(noFoot.cancelled, 0);
});

/* ---- through the plugin --------------------------------------------------- */

test("mirror edits: editing the note's date then syncing reschedules the task", async () => {
  const { app, plugin } = await mirrorPlugin();
  await plugin.addStudyTask({ title: "Review cells", due: "2026-11-20" });
  const file = app.vault.getAbstractFileByPath("Plans/loop.md");
  file.text = file.text.replace("📅 2026-11-20", "📅 2026-11-25");
  const result = await plugin.syncStudyTasksToNote();
  assert.equal(result.ok, true);
  assert.equal(plugin.settings.studyTasks.tasks[0].due, "2026-11-25");
  assert.ok(noteText(app, "Plans/loop.md").includes("📅 2026-11-25"), "the rewrite keeps the reschedule");
});

test("mirror edits: deleting the note's line then syncing cancels the task", async () => {
  const { app, plugin } = await mirrorPlugin();
  await plugin.addStudyTask({ title: "Review cells", due: "2026-11-20" });
  await plugin.addStudyTask({ title: "Drill" });
  const file = app.vault.getAbstractFileByPath("Plans/loop.md");
  file.text = file.text
    .split("\n")
    .filter((line) => !line.includes("Review cells"))
    .join("\n");
  await plugin.syncStudyTasksToNote();
  assert.ok(!plugin.settings.studyTasks.tasks.some((t) => t.title === "Review cells"), "deleted line cancelled");
  assert.ok(plugin.settings.studyTasks.tasks.some((t) => t.title === "Drill"), "the kept line stays");
});

test("mirror edits: the apply command reports what it did", async () => {
  const { app, plugin } = await mirrorPlugin();
  await plugin.addStudyTask({ title: "Review cells", due: "2026-11-20" });
  assert.ok(plugin.commands.some((command) => command.id === "apply-mirror-edits"), "apply-mirror-edits registered");
  const file = app.vault.getAbstractFileByPath("Plans/loop.md");
  file.text = file.text.replace("📅 2026-11-20", "📅 2026-11-25");
  const applied = await plugin.applyMirrorNoteEditsCommand();
  assert.equal(applied.rescheduled, 1);
  assert.equal(plugin.settings.studyTasks.tasks[0].due, "2026-11-25");
});
