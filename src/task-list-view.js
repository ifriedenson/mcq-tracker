"use strict";
const { ItemView } = require("obsidian");
const { VIEW_TYPE_TASK_LIST } = require("./constants");
const { localDate } = require("./util");
const { taskSummary } = require("./study-workspace");

/*
 * The sidebar task list: the same local `studyTasks` rows the Study Workspace
 * Tasks tab owns, in a compact pane-sized board. Rows can be tagged, and a tag
 * doubles as a filter. It never writes to a note.
 */
class TaskListView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tagFilter = "";
    this.tagEditor = "";
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

  tagsOf(task) {
    return task && Array.isArray(task.tags) ? task.tags : [];
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

    if (!this.plugin.studyTasksEnabled()) {
      const card = root.createDiv({ cls: "qt-task-list-empty" });
      card.createEl("h3", { text: "Tasks are off" });
      card.createDiv({ cls: "qt-task-list-meta", text: "Turn on Tasks in Settings, Global, Modules to use the task list." });
      card.createEl("button", { text: "Open settings", cls: "mod-cta" }).addEventListener("click", () => this.plugin.openSettings());
      return;
    }

    const tasks = this.tasks();
    const today = localDate();
    const summary = taskSummary(tasks, today);

    const head = root.createDiv({ cls: "qt-task-list-head" });
    const bar = head.createDiv({ cls: "qt-task-list-titlebar" });
    bar.createEl("h2", { text: "Tasks" });
    bar.createSpan({
      cls: "qt-task-list-badge",
      text: `${summary.open}/${summary.total}`,
      attr: { "aria-label": `${summary.open} open of ${summary.total} tasks` },
    });
    head
      .createEl("button", { text: "Workspace", cls: "qt-link qt-task-list-open" })
      .addEventListener("click", () => this.plugin.activateStudyWorkspace("tasks"));
    head.createDiv({
      cls: "qt-task-list-count",
      text: `${summary.open} open · ${summary.overdue} overdue · ${summary.dueToday} due today`,
    });

    const form = root.createDiv({ cls: "qt-task-list-add" });
    const title = form.createEl("input", {
      type: "text",
      cls: "qt-input qt-task-list-new",
      attr: { placeholder: "What needs doing?", "aria-label": "New task" },
    });
    const addRow = form.createDiv({ cls: "qt-task-list-add-row" });
    const due = addRow.createEl("input", {
      type: "date",
      cls: "qt-input qt-task-list-date",
      attr: { "aria-label": "Due date", title: "Due date" },
    });
    const tags = addRow.createEl("input", {
      type: "text",
      cls: "qt-input qt-task-list-new-tags",
      attr: { placeholder: "#tags", "aria-label": "Tags", title: "Tags, separated by commas" },
    });
    const add = async () => {
      const task = await this.plugin.addStudyTask({ title: title.value, due: due.value, tags: tags.value });
      if (!task) return;
      this.render();
    };
    addRow.createEl("button", { text: "Add", cls: "mod-cta qt-task-list-add-button" }).addEventListener("click", add);
    for (const field of [title, tags]) {
      field.addEventListener("keydown", (event) => {
        if (!event || event.key !== "Enter") return;
        if (typeof event.preventDefault === "function") event.preventDefault();
        add();
      });
    }

    const tagNames = [];
    for (const task of tasks) {
      for (const tag of this.tagsOf(task)) {
        if (!tagNames.some((name) => name.toLowerCase() === tag.toLowerCase())) tagNames.push(tag);
      }
    }
    tagNames.sort((a, b) => a.localeCompare(b));
    if (this.tagFilter && !tagNames.includes(this.tagFilter)) this.tagFilter = "";

    let visible = tasks;
    if (this.tagFilter) visible = tasks.filter((task) => this.tagsOf(task).includes(this.tagFilter));

    if (tagNames.length) {
      const filters = root.createDiv({ cls: "qt-task-list-filters" });
      for (const tag of tagNames) {
        const chip = filters.createEl("button", { cls: "qt-task-chip qt-task-filter", text: `#${tag}` });
        if (tag === this.tagFilter) chip.addClass("is-active");
        chip.setAttr("aria-pressed", tag === this.tagFilter ? "true" : "false");
        chip.setAttr("title", tag === this.tagFilter ? "Show all tasks" : `Show tasks tagged #${tag}`);
        chip.addEventListener("click", () => {
          this.tagFilter = this.tagFilter === tag ? "" : tag;
          this.render();
        });
      }
      if (this.tagFilter) {
        filters
          .createEl("button", { cls: "qt-link qt-task-list-filter-clear", text: "Clear" })
          .addEventListener("click", () => {
            this.tagFilter = "";
            this.render();
          });
      }
    }

    if (!tasks.length) {
      root.createDiv({ cls: "qt-task-list-empty", text: "No tasks yet. Add one above, or generate exam tasks in the Study Workspace." });
      return;
    }
    if (!visible.length) {
      root.createDiv({ cls: "qt-task-list-empty qt-task-list-blank", text: `Nothing tagged #${this.tagFilter} yet.` });
      return;
    }

    const list = root.createDiv({ cls: "qt-task-list-rows" });
    for (const task of this.ordered(visible)) this.renderRow(list, task, today);
  }

  renderRow(list, task, today) {
    const row = list.createDiv({ cls: "qt-task-list-row" });
    const overdue = !task.done && task.due && task.due < today;
    const dueToday = !task.done && task.due && task.due === today;
    if (task.done) row.addClass("is-done");
    else if (overdue) row.addClass("is-overdue");
    else if (dueToday) row.addClass("is-today");

    const box = row.createEl("input", {
      type: "checkbox",
      cls: "qt-task-check",
      attr: { "aria-label": task.done ? `Reopen ${task.title}` : `Complete ${task.title}` },
    });
    box.checked = !!task.done;
    box.addEventListener("change", () => this.toggle(task));

    const main = row.createDiv({ cls: "qt-task-list-main" });
    main.createDiv({ cls: "qt-task-list-title", text: task.title });

    const meta = main.createDiv({ cls: "qt-task-list-meta" });
    if (task.course) meta.createSpan({ cls: "qt-task-pill qt-task-course", text: task.course });
    const due = meta.createSpan({
      cls: "qt-task-pill qt-task-due",
      text: task.due ? this.dueLabel(task.due, today) : "No due date",
    });
    if (overdue) due.addClass("is-overdue");
    else if (dueToday) due.addClass("is-today");
    if (task.source === "exam") meta.createSpan({ cls: "qt-task-pill qt-task-source", text: "exam plan" });

    const tags = this.tagsOf(task);
    const tagRow = main.createDiv({ cls: "qt-task-tags" });
    for (const tag of tags) {
      const chip = tagRow.createEl("button", { cls: "qt-task-chip qt-task-row-chip", text: `#${tag}` });
      if (tag === this.tagFilter) chip.addClass("is-active");
      chip.setAttr("title", `Show tasks tagged #${tag}`);
      chip.addEventListener("click", () => {
        this.tagFilter = this.tagFilter === tag ? "" : tag;
        this.render();
      });
    }
    const edit = tagRow.createEl("button", { cls: "qt-task-tag-edit", text: tags.length ? "+" : "+ tag" });
    edit.setAttr("aria-label", `Edit tags for ${task.title}`);
    edit.setAttr("title", "Edit tags");
    edit.addEventListener("click", () => {
      this.tagEditor = this.tagEditor === task.id ? "" : task.id;
      this.render();
    });

    if (this.tagEditor === task.id) {
      const input = tagRow.createEl("input", {
        type: "text",
        cls: "qt-input qt-task-tag-input",
        attr: { "aria-label": `Tags for ${task.title}`, placeholder: "#math, exam" },
      });
      input.value = tags.join(", ");
      const save = async () => {
        await this.plugin.updateStudyTask(task.id, { tags: input.value });
        if (this.tagEditor === task.id) this.tagEditor = "";
        this.render();
      };
      input.addEventListener("keydown", async (event) => {
        if (!event) return;
        if (event.key === "Enter") {
          if (typeof event.preventDefault === "function") event.preventDefault();
          await save();
        } else if (event.key === "Escape") {
          this.tagEditor = "";
          this.render();
        }
      });
      input.addEventListener("blur", () => save());
    }

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
