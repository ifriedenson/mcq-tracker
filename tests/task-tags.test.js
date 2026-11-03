"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

const K = T.taskTags;

test("task tags: counts the tags the local tasks use", () => {
  const tasks = [
    { id: "a", tags: ["math", "exam"] },
    { id: "b", tags: ["Math", "essay"], done: true },
    { id: "c", tags: [] },
  ];
  assert.deepEqual(K.tagUsage(tasks).map((row) => [row.tag, row.count, row.open]), [
    ["math", 2, 1],
    ["essay", 1, 0],
    ["exam", 1, 1],
  ]);
  assert.deepEqual(K.tagUsage([]), []);
  assert.deepEqual(K.tagUsage(null), []);
});

test("task tags: renames one tag without touching the source list", () => {
  const tasks = [
    { id: "a", tags: ["math", "exam"] },
    { id: "b", tags: ["essay"] },
  ];
  const result = K.planTagRename(tasks, "#Math", " maths ");
  assert.equal(result.ok, true);
  assert.equal(result.changed, 1);
  assert.equal(result.merged, 0);
  assert.equal(result.from, "Math");
  assert.equal(result.to, "maths");
  assert.deepEqual(result.tasks[0].tags, ["maths", "exam"]);
  assert.deepEqual(result.tasks[1].tags, ["essay"]);
  assert.deepEqual(tasks[0].tags, ["math", "exam"], "the original tasks are not mutated");
  assert.equal(K.renameSummary(result), "Renamed #Math to #maths on 1 task.");
});

test("task tags: merges into a tag the task already had and keeps the cap", () => {
  const tasks = [{ id: "a", tags: ["math", "maths", "exam"] }];
  const result = K.planTagRename(tasks, "math", "maths");
  assert.equal(result.ok, true);
  assert.equal(result.changed, 1);
  assert.equal(result.merged, 1);
  assert.deepEqual(result.tasks[0].tags, ["maths", "exam"]);
  assert.equal(K.renameSummary(result), "Renamed #math to #maths on 1 task. 1 task already had #maths and was merged.");

  const full = [{ id: "a", tags: ["one", "two", "three", "four", "math"] }];
  assert.deepEqual(K.planTagRename(full, "math", "five").tasks[0].tags, ["one", "two", "three", "four"], "at most four tags");
});

test("task tags: refuses an empty, identical or unused tag", () => {
  const tasks = [{ id: "a", tags: ["math"] }];
  assert.equal(K.planTagRename(tasks, "", "maths").reason, "from");
  assert.equal(K.planTagRename(tasks, "math", "   ").reason, "to");
  assert.equal(K.planTagRename(tasks, "math", "#Math").reason, "same");
  const missing = K.planTagRename(tasks, "chemistry", "chem");
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "none");
  assert.equal(missing.message, "No task uses #chemistry.");
  assert.equal(K.renameSummary(missing), missing.message);
  assert.equal(K.renameSummary(null), "");
});

test("task tags: the plugin renames tags on study tasks only", async () => {
  const app = makeApp([]);
  let writes = 0;
  app.vault.create = async () => {
    writes += 1;
    return { path: "unexpected.md" };
  };
  app.vault.modify = async () => {
    writes += 1;
  };
  const plugin = new QT(app);
  await plugin.onload();
  const first = await plugin.addStudyTask({ title: "Problem set", tags: "math, exam" });
  await plugin.addStudyTask({ title: "Essay", tags: "math" });
  assert.deepEqual(plugin.taskTagUsage().map((row) => [row.tag, row.count]), [
    ["math", 2],
    ["exam", 1],
  ]);

  const result = await plugin.renameStudyTaskTag("math", "maths");
  assert.equal(result.ok, true);
  assert.equal(result.changed, 2);
  const stored = plugin.settings.studyTasks.tasks;
  assert.deepEqual(stored.find((task) => task.id === first.id).tags, ["maths", "exam"]);
  assert.deepEqual(stored.filter((task) => task.tags.includes("math")), [], "no task keeps the old tag");
  assert.equal(writes, 0, "no note or file is written");

  const missing = await plugin.renameStudyTaskTag("nope", "nah");
  assert.equal(missing.ok, false);

  const dom = makeDom();
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.contentEl = dom.root;
  view.tab = "tasks";
  view.render();
  const texts = dom.texts();
  assert.ok(texts.some((text) => text.includes("Rename a task tag")));
  assert.ok(texts.some((text) => text.includes("#maths")), "the tag in use is listed after the rename");
});
