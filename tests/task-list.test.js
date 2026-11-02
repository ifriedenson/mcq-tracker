"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
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

test("the sidebar task list says when the Tasks module is off", async () => {
  const { plugin, dom, view } = await setup();
  plugin.settings.studyTasks = { enabled: false, tasks: [] };
  view.render();
  assert.ok(dom.texts().includes("Tasks are off"));
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
