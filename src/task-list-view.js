"use strict";
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_TASK_LIST } = require("./constants");
const { localDate } = require("./util");
const { formatTaskTime, previewTaskEntry } = require("./task-dates");
const { agendaSections, compareStudyTasks, isHighPriority, normalizeStudyTasks, taskSummary } = require("./study-workspace");

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

  /** High priority first, then open work by due date, then completed work. */
  ordered(tasks) {
    return tasks
      .slice()
      .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1) || compareStudyTasks(a, b));
  }

  dueLabel(due, today, time) {
    const clock = formatTaskTime(time);
    const suffix = clock ? ` · ${clock}` : "";
    if (due < today) return `Overdue · ${due}${suffix}`;
    if (due === today) return `Due today${suffix}`;
    return `Due ${due}${suffix}`;
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
    head
      .createEl("button", { text: "Mirror to note", cls: "qt-link qt-task-list-open", attr: { title: "Copy the tasks into a note for search and other plugins" } })
      .addEventListener("click", async () => {
        try {
          const result = await this.plugin.syncStudyTasksToNote();
          new Notice(`Mirrored ${result.open} open task${result.open === 1 ? "" : "s"} to ${result.path}.`);
        } catch (error) {
          new Notice("Could not mirror the tasks.");
        }
        this.render();
      });
    head.createDiv({
      cls: "qt-task-list-count",
      text: `${summary.open} open · ${summary.overdue} overdue · ${summary.dueToday} due today`,
    });
    const agenda = this.plugin.settings.studyTasks.agenda === true;
    const layout = head.createDiv({ cls: "qt-task-list-layout", attr: { role: "group", "aria-label": "Task list layout" } });
    for (const [id, label] of [["list", "List"], ["agenda", "Agenda"]]) {
      const active = (id === "agenda") === agenda;
      const tab = layout.createEl("button", {
        cls: `qt-task-list-layout-tab${active ? " is-active" : ""}`,
        text: label,
        attr: { "aria-pressed": active ? "true" : "false" },
      });
      tab.addEventListener("click", async () => {
        this.plugin.settings.studyTasks = normalizeStudyTasks({ ...this.plugin.settings.studyTasks, agenda: id === "agenda" });
        await this.plugin.save();
        this.render();
      });
    }

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
    // The add row can make the next task high priority; normal stays the default.
    let addHigh = false;
    const priority = addRow.createEl("button", {
      text: "☆ High",
      cls: "qt-task-list-add-priority",
      attr: {
        "aria-label": "Make the next task high priority",
        "aria-pressed": "false",
        title: "Mark the next task high priority",
      },
    });
    priority.addEventListener("click", () => {
      addHigh = !addHigh;
      priority.setText(addHigh ? "★ High" : "☆ High");
      priority.setAttribute("aria-pressed", addHigh ? "true" : "false");
      if (typeof updatePreview === "function") updatePreview();
    });
    const add = async () => {
      const task = await this.plugin.addStudyTask({
        title: title.value,
        due: due.value,
        tags: tags.value,
        priority: addHigh ? "high" : "",
      });
      if (!task) return;
      // Keep the cursor in the box so the next task needs no mouse, like Deadline.
      this.focusNewAfterRender = true;
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
    const preview = form.createDiv({ cls: "qt-task-list-preview", attr: { "aria-live": "polite" } });
    const updatePreview = () => {
      const draft = previewTaskEntry(title.value, new Date(), { due: due.value });
      const name = (draft.title || title.value).trim();
      if (!name) {
        preview.setText("");
        return;
      }
      const bits = [`Adds “${name}”`];
      if (draft.due) bits.push(`due ${draft.due}`);
      if (draft.time) bits.push(formatTaskTime(draft.time));
      if (draft.repeat) bits.push(`repeats ${draft.repeat === "weekday" ? "weekdays" : draft.repeat}`);
      if (tags.value.trim()) bits.push(`tags ${tags.value.trim()}`);
      if (addHigh) bits.push("high priority");
      preview.setText(bits.join(" · "));
    };
    for (const field of [title, due, tags]) field.addEventListener("input", updatePreview);
    updatePreview();
    root.createDiv({ cls: "qt-task-list-hint", text: "Tip: name a day (tomorrow, Tuesday), a time (at 3pm, in 2 hours) or a repeat (every Monday, daily) to schedule it. Star the urgent ones, or ★ High before adding." });
    if (this.focusNewAfterRender) {
      this.focusNewAfterRender = false;
      if (typeof title.focus === "function") title.focus();
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

    if (agenda) {
      this.renderAgenda(root, visible, today);
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

    const checkWrap = row.createEl("label", { cls: "qt-task-check-wrap" });
    const box = checkWrap.createEl("input", {
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
      text: task.due ? this.dueLabel(task.due, today, task.time) : formatTaskTime(task.time) || "No due date",
    });
    if (overdue) due.addClass("is-overdue");
    else if (dueToday) due.addClass("is-today");
    if (isHighPriority(task)) meta.createSpan({ cls: "qt-task-pill qt-task-high", text: "★ High" });
    const repeatName = task.repeat === "weekday" ? "weekdays" : task.repeat;
    if (repeatName) meta.createSpan({ cls: "qt-task-pill qt-task-repeat", text: `🔁 ${repeatName}` });
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

    const actions = row.createDiv({ cls: "qt-task-list-actions" });
    const star = actions.createEl("button", {
      text: isHighPriority(task) ? "★" : "☆",
      cls: "qt-task-list-star",
      attr: {
        "aria-label": isHighPriority(task) ? `Remove high priority from ${task.title}` : `Mark ${task.title} high priority`,
        title: isHighPriority(task) ? "High priority" : "Mark high priority",
      },
    });
    star.addEventListener("click", async () => {
      const high = isHighPriority(task);
      await this.plugin.updateStudyTaskWithUndo(
        task.id,
        { priority: high ? "" : "high" },
        () => this.render(),
        high ? `Normal priority for \u201c${task.title}\u201d.` : `High priority for \u201c${task.title}\u201d.`
      );
    });
    const repeatLabel = task.repeat === "daily" ? "🔁 daily" : task.repeat === "weekday" ? "🔁 weekdays" : task.repeat === "weekly" ? "🔁 weekly" : "🔁 off";
    const repeat = actions.createEl("button", {
      text: repeatLabel,
      cls: "qt-task-list-repeat",
      attr: { "aria-label": `Repeat for ${task.title}: ${task.repeat || "off"}`, title: "Cycle repeat: off, daily, weekdays, weekly" },
    });
    repeat.addEventListener("click", async () => {
      const next = !task.repeat ? "daily" : task.repeat === "daily" ? "weekday" : task.repeat === "weekday" ? "weekly" : "";
      const name = next === "weekday" ? "weekdays" : next || "off";
      await this.plugin.updateStudyTaskWithUndo(task.id, { repeat: next }, () => this.render(), `Repeat for \u201c${task.title}\u201d set to ${name}.`);
    });
    actions
      .createEl("button", { text: "×", cls: "qt-task-list-remove", attr: { "aria-label": `Delete ${task.title}`, title: "Delete task" } })
      .addEventListener("click", async () => {
        // One click and no dialog; the notice's Undo is the way back, and the
        // Study Workspace queue goes through the same helper.
        await this.plugin.deleteStudyTaskWithUndo(task.id, () => this.render());
      });
  }

  renderAgenda(root, tasks, today) {
    const sections = agendaSections(tasks, today);
    if (!sections.length) {
      root.createDiv({ cls: "qt-task-list-empty", text: "Nothing scheduled. Add a task above." });
      return;
    }
    const host = root.createDiv({ cls: "qt-task-list-agenda" });
    for (const section of sections) {
      host.createEl("h3", { cls: "qt-task-list-agenda-title", text: section.title });
      if (section.capped) {
        host.createDiv({ cls: "qt-task-list-meta", text: `Showing ${section.tasks.length} of ${section.total}. Add dates to more tasks to plan further ahead.` });
      }
      for (const task of section.tasks) this.renderRow(host, task, today);
    }
  }

  async toggle(task) {
    // Completing or reopening is one click, so it leaves the same eight-second
    // Undo every other task action does; a repeat's successor goes back too.
    const text = task.done ? `Reopened \u201c${task.title}\u201d.` : `Completed \u201c${task.title}\u201d.`;
    await this.plugin.updateStudyTaskWithUndo(task.id, { done: !task.done }, () => this.render(), text);
  }
}

module.exports = { TaskListView };
