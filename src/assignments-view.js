"use strict";
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_ASSIGNMENTS } = require("./constants");
const { localDate } = require("./util");
const { AssignmentModal } = require("./assignments-modal");
const { assignmentTasks, dueState } = require("./assignments");

const numberText = (value) => (value === null || value === undefined ? "—" : `${Math.round(Number(value) * 10) / 10}%`);

/** A compact gradebook and task list built from assignment notes. */
class AssignmentsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.filter = "open"; // open | all | graded
  }

  getViewType() {
    return VIEW_TYPE_ASSIGNMENTS;
  }

  getDisplayText() {
    return "Assignments";
  }

  getIcon() {
    return "clipboard-list";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
  }

  render() {
    const p = this.plugin;
    const el = this.contentEl;
    const top = el.scrollTop;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-assignments" });

    if (!p.assignmentsEnabled()) {
      const card = root.createDiv({ cls: "qt-assignment-empty" });
      card.createEl("h3", { text: "Assignments are off" });
      card.createDiv({ cls: "qt-today-meta", text: "Turn the Assignments module back on under Settings, Global, Modules." });
      card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => p.openSettings());
      return;
    }

    const today = localDate();
    const stats = p.assignmentStats({ today });
    const summary = stats.summary;
    root.createDiv({ cls: "qt-today-kicker", text: "Gradebook" });
    root.createEl("h2", { text: "Assignments & grades" });
    root.createDiv({
      cls: "qt-today-count",
      text: `${summary.open} open · ${summary.overdue} overdue · ${summary.graded} graded · ${stats.courses.length} course${stats.courses.length === 1 ? "" : "s"}`,
    });
    const actions = root.createDiv({ cls: "qt-row qt-small-row" });
    actions.createEl("button", { text: "Add assignment", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.openNew());
    actions.createEl("button", { text: "Assignment settings" }).addEventListener("click", () => p.openSettings());

    if (stats.gpa !== null) {
      const card = root.createDiv({ cls: "qt-assignment-gpa" });
      card.createDiv({ cls: "qt-today-kicker", text: "Credit-weighted GPA" });
      card.createDiv({ cls: "qt-assignment-gpa-value", text: String(stats.gpa.toFixed(2)) });
      card.createDiv({
        cls: "qt-today-meta",
        text: `${stats.gradedCourses} graded course${stats.gradedCourses === 1 ? "" : "s"} · ${stats.credits} credits · unweighted ${stats.unweightedGpa.toFixed(2)}`,
      });
      card.createDiv({ cls: "qt-toggle-hint", text: "Credits and course targets are under Settings, Assignments, Courses." });
    } else {
      const card = root.createDiv({ cls: "qt-assignment-empty" });
      card.createDiv({ cls: "qt-today-kicker", text: "No course grade yet" });
      card.createDiv({ cls: "qt-today-meta", text: "Add an assignment with a score, or set a course target and final weight in settings." });
    }

    root.createEl("h3", { cls: "qt-today-section", text: "Courses" });
    if (!stats.courses.length) {
      const card = root.createDiv({ cls: "qt-assignment-empty" });
      card.createDiv({ cls: "qt-today-title", text: "Add your first assignment" });
      card.createDiv({ cls: "qt-today-meta", text: "Assignments are ordinary notes with a due date, course, category weight and optional score." });
      card.createEl("button", { text: "Add assignment", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.openNew());
    } else {
      const grid = root.createDiv({ cls: "qt-assignment-courses" });
      for (const course of stats.courses) this.renderCourse(grid, course);
    }

    root.createEl("h3", { cls: "qt-today-section", text: "Tasks" });
    this.renderFilters(root);
    this.renderTasks(root, today);
    el.scrollTop = top;
  }

  renderFilters(root) {
    const row = root.createDiv({ cls: "qt-row qt-small-row qt-assignment-filters" });
    for (const [id, label] of [["open", "Open"], ["all", "All"], ["graded", "Graded"]]) {
      const button = row.createEl("button", { text: label, cls: this.filter === id ? "is-active" : "" });
      button.addEventListener("click", () => {
        this.filter = id;
        this.render();
      });
    }
  }

  renderCourse(parent, course) {
    const p = this.plugin;
    const card = parent.createDiv({ cls: "qt-assignment-course" });
    const head = card.createDiv({ cls: "qt-assignment-course-head" });
    const name = head.createDiv({ cls: "qt-assignment-course-name" });
    name.createDiv({ cls: "qt-today-title", text: course.course });
    name.createDiv({ cls: "qt-today-meta", text: `${course.credits} credit${course.credits === 1 ? "" : "s"} · ${course.graded} graded of ${course.total}` });
    const grade = head.createDiv({ cls: "qt-assignment-course-grade" });
    grade.createDiv({ cls: "qt-assignment-letter", text: course.letter });
    grade.createDiv({ cls: "qt-today-meta", text: numberText(course.current) });

    const bars = card.createDiv({ cls: "qt-assignment-categories" });
    for (const cat of course.categories.filter((c) => c.assignments || c.weight > 0)) {
      const line = bars.createDiv({ cls: "qt-assignment-category" });
      line.createSpan({ cls: "qt-assignment-category-name", text: `${cat.label} ${cat.weight}%` });
      line.createSpan({ cls: "qt-assignment-category-score", text: cat.percent === null ? "—" : numberText(cat.percent) });
      if (cat.graded < cat.assignments) line.createSpan({ cls: "qt-toggle-hint", text: `${cat.assignments - cat.graded} ungraded` });
    }

    let targetText = `Target ${course.target}% · final worth ${course.finalWeight}% · add a graded assignment to see what you need.`;
    let targetClass = "qt-assignment-target";
    if (course.current !== null && course.neededFinal === null) {
      targetText = `Target ${course.target}% · set a final weight below 100% to calculate the final score.`;
    } else if (course.neededFinal !== null && course.neededFinal <= 0) {
      targetText = `Target ${course.target}% already secured. Current ${numberText(course.current)} with a final worth ${course.finalWeight}%.`;
      targetClass += " is-secured";
    } else if (course.neededFinal !== null) {
      targetText = `Target ${course.target}% · final worth ${course.finalWeight}% · you need ${numberText(course.neededFinal)} on the final.`;
      if (course.neededFinal > 100) targetClass += " is-hard";
    }
    card.createDiv({ cls: targetClass, text: targetText });

    const actions = card.createDiv({ cls: "qt-row qt-small-row" });
    if (p.mcqEnabled()) {
      actions.createEl("button", { text: "Practice this course" }).addEventListener("click", () => p.practiceWith({ course: [course.course] }, "smart"));
    }
    actions.createEl("button", { text: "Add assignment", cls: "qt-link" }).addEventListener("click", () => this.openNew({ course: course.course }));
  }

  renderTasks(root, today) {
    const p = this.plugin;
    const all = p.getAssignments();
    const rows = all
      .filter((a) => this.filter === "all" || (this.filter === "graded" ? a.percent !== null : a.open))
      .sort((a, b) => {
        if (a.open !== b.open) return a.open ? -1 : 1;
        return (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99") || a.title.localeCompare(b.title);
      });
    if (!rows.length) {
      const card = root.createDiv({ cls: "qt-assignment-empty" });
      card.createDiv({ cls: "qt-today-meta", text: this.filter === "graded" ? "No graded assignments yet." : "No open tasks. Add an assignment or switch to All." });
      return;
    }
    const list = root.createDiv({ cls: "qt-assignment-tasks" });
    for (const a of rows) {
      const state = dueState(a, today);
      const row = list.createDiv({ cls: `qt-assignment-task is-${state.id}` });
      const main = row.createDiv({ cls: "qt-assignment-task-main" });
      main.createDiv({ cls: "qt-assignment-task-title", text: a.title });
      main.createDiv({
        cls: "qt-assignment-task-meta",
        text: [a.course, a.typeLabel, a.due ? state.label : "No due date", a.percent === null ? "" : numberText(a.percent)].filter(Boolean).join(" · "),
      });
      row.createSpan({ cls: `qt-assignment-status is-${a.status}`, text: a.statusLabel });
      const buttons = row.createDiv({ cls: "qt-assignment-task-actions" });
      buttons.createEl("button", { text: "Open", cls: "qt-link" }).addEventListener("click", () => p.openAssignmentNote(a));
      if (a.open) {
        buttons.createEl("button", { text: "Mark done" }).addEventListener("click", async () => {
          try {
            await p.setAssignmentStatus(a, "submitted");
            this.render();
          } catch (e) {
            new Notice((e && e.message) || "Could not update the assignment.");
          }
        });
      }
      buttons.createEl("button", { text: a.percent === null ? "Grade" : "Edit grade" }).addEventListener("click", () => this.edit(a));
    }
  }

  openNew(options) {
    new AssignmentModal(this.app, this.plugin, options || {}, () => this.render()).open();
  }

  edit(assignment) {
    new AssignmentModal(this.app, this.plugin, { assignment }, () => this.render()).open();
  }
}

module.exports = { VIEW_TYPE_ASSIGNMENTS, AssignmentsView };
