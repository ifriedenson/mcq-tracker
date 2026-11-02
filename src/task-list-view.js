"use strict";
const { ItemView } = require("obsidian");
const { VIEW_TYPE_TASK_LIST } = require("./constants");
const { localDate } = require("./util");
const { taskSummary } = require("./study-workspace");

/*
 * The sidebar task list: the same local `studyTasks` rows the Study Workspace
 * Tasks tab owns, in a compact pane-sized list. It never writes to a note.
 */
class TaskListView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_TASK_LIST;
  }

  getDisplayText() {
    return "Task list";
  }

  getIcon() {
    return "list-checks";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
  }

  tasks() {
    const data = this.plugin.settings.studyTasks;
    return data && Array.isArray(data.tasks) ? data.tasks : [];
  }

  /** Open work first by due date, then completed work; a task with no due date sorts last. */
  ordered(tasks) {
    return tasks
      .slice()
      .sort(
        (a, b) =>
          (a.done === b.done ? 0 : a.done ? 1 : -1) ||
          (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") ||
          a.createdAt - b.createdAt
      );
  }

  dueLabel(due, today) {
    if (due < today) return `Overdue · ${due}`;
    if (due === today) return "Due today";
    return `Due ${due}`;
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-task-list" });
    const header = root.createDiv({ cls: "qt-task-list-head" });
    header.createEl("h2", { text: "Tasks" });

    if (!this.plugin.studyTasksEnabled()) {
      const card = root.createDiv({ cls: "qt-task-list-empty" });
      card.createEl("h3", { text: "Tasks are off" });
      card.createDiv({ cls: "qt-task-list-meta", text: "Turn on Tasks in Settings, Global, Modules to use the task list." });
      card.createEl("button", { text: "Open settings", cls: "mod-cta" }).addEventListener("click", () => this.plugin.openSettings());
      return;
    }

    const tasks = this.tasks();
    const summary = taskSummary(tasks, localDate());
    header.createDiv({
      cls: "qt-task-list-count",
      text: `${summary.open} open · ${summary.overdue} overdue · ${summary.dueToday} due today`,
    });
    header.createEl("button", { text: "Open workspace", cls: "qt-link" }).addEventListener("click", () =>
      this.plugin.activateStudyWorkspace("tasks")
    );

    const form = root.createDiv({ cls: "qt-task-list-add" });
    const title = form.createEl("input", {
      type: "text",
      cls: "qt-input",
      attr: { placeholder: "Add a task", "aria-label": "New task" },
    });
    const due = form.createEl("input", { type: "date", cls: "qt-input", attr: { "aria-label": "Due date" } });
    const add = async () => {
      const task = await this.plugin.addStudyTask({ title: title.value, due: due.value });
      if (!task) return;
      this.render();
    };
    form.createEl("button", { text: "Add", cls: "mod-cta" }).addEventListener("click", add);
    title.addEventListener("keydown", (event) => {
      if (event && event.key === "Enter") {
        if (typeof event.preventDefault === "function") event.preventDefault();
        add();
      }
    });

    if (!tasks.length) {
      root.createDiv({ cls: "qt-task-list-empty", text: "No tasks yet. Add one above, or generate exam tasks in the Study Workspace." });
      return;
    }

    const today = localDate();
    const list = root.createDiv({ cls: "qt-task-list-rows" });
    for (const task of this.ordered(tasks)) this.renderRow(list, task, today);
  }

  renderRow(list, task, today) {
    const row = list.createDiv({ cls: "qt-task-list-row" });
    if (task.done) row.addClass("is-done");
    const box = row.createEl("input", {
      type: "checkbox",
      cls: "qt-task-check",
      attr: { "aria-label": task.done ? `Reopen ${task.title}` : `Complete ${task.title}` },
    });
    box.checked = !!task.done;
    box.addEventListener("change", () => this.toggle(task));
    const main = row.createDiv({ cls: "qt-task-list-main" });
    main.createDiv({ cls: "qt-task-list-title", text: task.title });
    const meta = [task.course, task.due ? this.dueLabel(task.due, today) : "No due date", task.source === "exam" ? "exam plan" : ""]
      .filter(Boolean)
      .join(" · ");
    main.createDiv({ cls: "qt-task-list-meta", text: meta });
    row
      .createEl("button", { text: "×", cls: "qt-task-list-remove", attr: { "aria-label": `Delete ${task.title}`, title: "Delete task" } })
      .addEventListener("click", async () => {
        await this.plugin.removeStudyTask(task.id);
        this.render();
      });
  }

  async toggle(task) {
    await this.plugin.updateStudyTask(task.id, { done: !task.done });
    this.render();
  }
}

module.exports = { TaskListView };
