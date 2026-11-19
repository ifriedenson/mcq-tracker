"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");
const { T, Plugin: QT } = load();

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function setup() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  const view = new T.TaskListView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  return { app, plugin, dom, view };
}

function byLabel(dom, label) {
  return dom.all
    .filter((o) => {
      const attrs = o.meta.attrs || o.meta.attr;
      return attrs && attrs["aria-label"] === label;
    })
    .pop();
}

test("the sidebar task list shows open work first with overdue and due-today labels", async () => {
  const { plugin, dom, view } = await setup();
  await plugin.addStudyTask({ title: "Past task", due: day(-2) });
  await plugin.addStudyTask({ title: "Today task", due: day(0), course: "Biology" });
  const done = await plugin.addStudyTask({ title: "Finished task", due: day(1) });
  await plugin.updateStudyTask(done.id, { done: true });
  view.render();
  const texts = dom.texts();
  assert.ok(texts.includes("Past task"));
  assert.ok(texts.includes("Today task"));
  assert.ok(texts.includes("Finished task"));
  assert.ok(texts.some((text) => /^Overdue · /.test(text)), "overdue rows say so");
  assert.ok(texts.some((text) => /Due today/.test(text)));
  assert.ok(texts.some((text) => /^2 open · 1 overdue · 1 due today$/.test(text)), dom.texts().join(" | "));
  assert.ok(texts.includes("2/3"), "the header shows open of total");
  const order = texts.indexOf("Past task") < texts.indexOf("Today task");
  assert.ok(order, "overdue work comes before upcoming work");
  assert.ok(texts.indexOf("Today task") < texts.indexOf("Finished task"), "completed work sorts last");
});

test("the sidebar task list completes, reopens and deletes a task", async () => {
  const { plugin, dom, view } = await setup();
  const task = await plugin.addStudyTask({ title: "Review cells" });
  view.render();
  await view.toggle(task);
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).done, true);
  view.render();
  assert.ok(dom.texts().includes("0 open · 0 overdue · 0 due today"));
  await view.toggle(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id));
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).done, false);
  await plugin.removeStudyTask(task.id);
  view.render();
  assert.equal(plugin.settings.studyTasks.tasks.length, 0);
  assert.ok(dom.texts().includes("No tasks yet. Add one above, or generate exam tasks in the Study Workspace."));
});

test("deleting a task from its row offers an Undo that restores every field", async () => {
  const { plugin, dom, view } = await setup();
  const task = await plugin.addStudyTask({ title: "Keep me", tags: "#bio", priority: "high", repeat: "weekly", due: day(3) });
  view.render();
  const remove = byLabel(dom, "Delete Keep me");
  assert.ok(remove, "the row has a delete control");
  await remove.handlers.find((h) => h.ev === "click").fn({});
  assert.equal(plugin.settings.studyTasks.tasks.length, 0, "the row is gone");
  assert.ok(obsidian.notices.includes("Deleted “Keep me”."), obsidian.notices.join(" | "));

  const notice = obsidian.noticeObjects.find((entry) => entry.message === "Deleted “Keep me”.");
  const undo = notice.noticeEl.children.find((el) => el.cls === "qt-notice-undo");
  assert.ok(undo, "the notice carries an Undo control");
  assert.equal(undo.text, "Undo");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  const restored = plugin.settings.studyTasks.tasks.find((entry) => entry.id === task.id);
  assert.ok(restored, "Undo puts the task back");
  assert.deepEqual(restored.tags, ["bio"]);
  assert.equal(restored.priority, "high");
  assert.equal(restored.repeat, "weekly");
  assert.equal(restored.due, task.due);
  assert.equal(undo.disabled, true, "the same control cannot restore twice");
});

test("the sidebar task list says when the Tasks module is off", async () => {
  const { plugin, dom, view } = await setup();
  plugin.settings.studyTasks = { enabled: false, tasks: [] };
  view.render();
  assert.ok(dom.texts().includes("Tasks are off"));
});

test("tasks can be tagged when they are added, and tags filter the list", async () => {
  const { plugin, dom, view } = await setup();
  const exam = await plugin.addStudyTask({ title: "Read chapter", tags: "#Exam, bio exam, exam" });
  assert.deepEqual(exam.tags, ["Exam", "bio"], "tags lose their hash and duplicates; spaces separate tags");
  await plugin.addStudyTask({ title: "Buy milk", tags: "home" });
  view.render();
  assert.ok(dom.texts().includes("#Exam"));
  assert.ok(dom.texts().includes("#bio"));
  await dom.click("#Exam");
  dom.all.length = 0;
  view.render();
  assert.ok(dom.texts().includes("Read chapter"));
  assert.ok(!dom.texts().includes("Buy milk"), "filtering hides other tags");
  await dom.click("#Exam");
  dom.all.length = 0;
  view.render();
  assert.ok(dom.texts().includes("Buy milk"), "clicking the active tag clears the filter");
});

test("an existing task can be tagged from its row", async () => {
  const { plugin, dom, view } = await setup();
  const task = await plugin.addStudyTask({ title: "Review cells" });
  view.render();
  const edit = byLabel(dom, "Edit tags for Review cells");
  assert.ok(edit, "the row offers a tag editor");
  for (const handler of edit.handlers.filter((h) => h.ev === "click")) await handler.fn({});
  const input = byLabel(dom, "Tags for Review cells");
  assert.ok(input, "the tag field appears in the row");
  assert.equal(input.meta.tag, "input", "the field is a text input");
  input.value = "cells #biology";
  const keydown = input.handlers.find((h) => h.ev === "keydown");
  await keydown.fn({ key: "Enter", preventDefault() {} });
  assert.deepEqual(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).tags, ["cells", "biology"]);
  view.render();
  assert.ok(dom.texts().includes("#biology"));
});

test("a tag added to a task never gains a second hash and stays bounded", async () => {
  const { plugin } = await setup();
  const task = await plugin.addStudyTask({ title: "Long tags", tags: "one, two, three, four, five" });
  assert.deepEqual(task.tags, ["one", "two", "three", "four"], "at most four tags are kept");
  await plugin.updateStudyTask(task.id, { tags: "##deep work" });
  assert.deepEqual(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).tags, ["deep", "work"]);
});

test("the task list opens in the right sidebar", async () => {
  const { app, plugin } = await setup();
  const opened = [];
  const leaf = {
    view: null,
    setViewState: async (state) => {
      opened.push(state.type);
      leaf.view = new T.TaskListView(leaf, plugin);
      leaf.view.contentEl = makeDom().root;
      await leaf.view.onOpen();
    },
  };
  let rightCalls = 0;
  app.workspace.getLeavesOfType = () => [];
  app.workspace.getRightLeaf = (split) => {
    rightCalls += split === false ? 1 : 10;
    return leaf;
  };
  app.workspace.revealLeaf = async () => {};
  const view = await plugin.activateTaskList();
  assert.equal(opened[0], "question-tracker-task-list");
  assert.equal(rightCalls, 1, "the existing right sidebar is reused without a new split");
  assert.ok(view && view.getDisplayText() === "Task list");
});

test("the task list command and ribbon entry are registered with the view", async () => {
  const { plugin } = await setup();
  assert.ok(plugin.commands.some((command) => command.id === "open-task-list"));
  assert.ok(plugin.views["question-tracker-task-list"]);
});

test("adding a task with Enter keeps the cursor in the new-task box", async () => {
  const { plugin, dom, view } = await setup();
  view.render();
  const input = byLabel(dom, "New task");
  assert.ok(input, "the new-task box exists");
  input.value = "Buy milk";
  const keydown = input.handlers.find((h) => h.ev === "keydown");
  await keydown.fn({ key: "Enter", preventDefault() {} });
  for (let i = 0; i < 100 && !(byLabel(dom, "New task") || {}).focused; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(plugin.settings.studyTasks.tasks.some((task) => task.title === "Buy milk"), "Enter adds the task");
  assert.equal(byLabel(dom, "New task").focused, true, "the fresh box is focused for the next task");
});

test("the Study Workspace task queue deletes through the same Undo notice", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  const task = await plugin.addStudyTask({ title: "Workspace task", tags: "#chem", due: day(2) });
  const view = new T.StudyWorkspaceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.containerEl = dom.root;
  view.renderTasks(dom.root);
  const remove = dom.all.find((o) => {
    const attrs = o.meta.attrs || o.meta.attr;
    return attrs && attrs["aria-label"] === "Delete Workspace task";
  });
  assert.ok(remove, "the workspace queue row has a delete control");
  await remove.handlers.find((h) => h.ev === "click").fn({});
  assert.equal(plugin.settings.studyTasks.tasks.length, 0, "the row is gone");
  const notice = obsidian.noticeObjects.find((entry) => entry.message === "Deleted “Workspace task”.");
  assert.ok(notice, obsidian.notices.join(" | "));
  const undo = notice.noticeEl.children.find((el) => el.cls === "qt-notice-undo");
  assert.ok(undo, "the workspace delete offers the same Undo");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  const restored = plugin.settings.studyTasks.tasks.find((entry) => entry.id === task.id);
  assert.ok(restored, "Undo puts the workspace task back");
  assert.deepEqual(restored.tags, ["chem"]);
  assert.equal(restored.due, task.due);
});

test("completing a task offers an Undo that reopens it and removes a repeat's successor", async () => {
  const { plugin, dom, view } = await setup();
  const task = await plugin.addStudyTask({ title: "Daily drill", repeat: "daily", due: day(-1) });
  view.render();
  const box = byLabel(dom, "Complete Daily drill");
  assert.ok(box, "the row has a completion checkbox");
  await box.handlers.find((h) => h.ev === "change").fn({});
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).done, true);
  assert.equal(plugin.settings.studyTasks.tasks.length, 2, "a daily task schedules its successor");

  const label = "Completed \u201cDaily drill\u201d.";
  assert.ok(obsidian.notices.includes(label), obsidian.notices.join(" | "));
  const notice = obsidian.noticeObjects.find((entry) => entry.message === label);
  const undo = notice.noticeEl.children.find((el) => el.cls === "qt-notice-undo");
  assert.ok(undo, "the notice carries an Undo control");
  await undo.handlers.find((h) => h.ev === "click").fn({});
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).done, false, "Undo reopens the task");
  assert.equal(plugin.settings.studyTasks.tasks.length, 1, "and takes the successor with it");
  assert.equal(undo.disabled, true, "the same control cannot restore twice");
});

test("starring and repeating a task each leave an Undo that puts the field back", async () => {
  const { plugin, dom, view } = await setup();
  const task = await plugin.addStudyTask({ title: "Review cells" });
  view.render();
  const star = byLabel(dom, "Mark Review cells high priority");
  assert.ok(star, "the row offers the star");
  await star.handlers.find((h) => h.ev === "click").fn({});
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).priority, "high");
  const starNotice = obsidian.noticeObjects.find((entry) => entry.message === "High priority for \u201cReview cells\u201d.");
  assert.ok(starNotice, obsidian.notices.join(" | "));
  await starNotice.noticeEl.children.find((el) => el.cls === "qt-notice-undo").handlers.find((h) => h.ev === "click").fn({});
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).priority, "");

  view.render();
  const repeat = byLabel(dom, "Repeat for Review cells: off");
  assert.ok(repeat, "the row offers the repeat cycle");
  await repeat.handlers.find((h) => h.ev === "click").fn({});
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).repeat, "daily");
  const repeatNotice = obsidian.noticeObjects.find((entry) => entry.message === "Repeat for \u201cReview cells\u201d set to daily.");
  assert.ok(repeatNotice, obsidian.notices.join(" | "));
  await repeatNotice.noticeEl.children.find((el) => el.cls === "qt-notice-undo").handlers.find((h) => h.ev === "click").fn({});
  assert.equal(plugin.settings.studyTasks.tasks.find((row) => row.id === task.id).repeat, "");
});
