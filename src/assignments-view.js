"use strict";
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_ASSIGNMENTS } = require("./constants");
const { localDate } = require("./util");
const { AssignmentModal } = require("./assignments-modal");
const { assignmentTasks, dueState, formatEstimate } = require("./assignments");

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
    const root = el.createDiv({ cls: "qt-wrap qt-assignments qt-screen" });

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
    const empty = !summary.total && !stats.courses.length;
    const head = root.createDiv({ cls: "qt-screen-head" });
    head.createDiv({ cls: "qt-today-kicker", text: "Gradebook" });
    head.createEl("h2", { text: "Assignments & grades" });
    if (empty) {
      head.createDiv({ cls: "qt-screen-subtitle", text: "Add a deadline, a score and a course target; the gradebook does the rest." });
    } else {
      const line = head.createDiv({ cls: "qt-assignment-summary qt-screen-subtitle" });
      for (const [value, label, mod] of [
        [summary.open, "open", ""],
        [summary.overdue, "overdue", summary.overdue ? " is-alert" : ""],
        [summary.graded, "graded", ""],
        [stats.courses.length, `course${stats.courses.length === 1 ? "" : "s"}`, ""],
      ]) {
        const item = line.createSpan({ cls: `qt-assignment-summary-item${mod}` });
        item.createSpan({ cls: "qt-assignment-summary-value", text: String(value) });
        item.createSpan({ cls: "qt-assignment-summary-label", text: label });
      }
    }
    const actions = root.createDiv({ cls: "qt-row qt-assignment-actions" });
    actions.createEl("button", { text: "Add assignment", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.openNew());
    actions.createEl("button", { text: "Assignment settings" }).addEventListener("click", () => p.openSettings());

    if (empty) {
      this.renderOnboarding(root);
      el.scrollTop = top;
      return;
    }

    const work = stats.workload;
    const showWorkload = !!(work && work.total);
    const showGpa = stats.gpa !== null || stats.courses.length > 0;
    if (showWorkload || showGpa) {
      const overview = root.createDiv({ cls: "qt-assignment-overview" });
      let cards = 0;
      if (showWorkload) {
        const card = overview.createDiv({ cls: "qt-assignment-workload" });
        card.createDiv({ cls: "qt-today-kicker", text: "Estimated workload" });
        const row = card.createDiv({ cls: "qt-assignment-workload-stats" });
        const stat = (label, value, alert) => {
          const box = row.createDiv({ cls: `qt-assignment-workload-stat${alert ? " is-alert" : ""}` });
          box.createDiv({ cls: "qt-assignment-workload-value", text: value });
          box.createDiv({ cls: "qt-assignment-workload-label", text: label });
        };
        stat("Today", formatEstimate(work.todayMinutes) || "0m", false);
        stat("Next 7 days", formatEstimate(work.weekMinutes) || "0m", false);
        stat("Overdue", work.overdueMinutes ? formatEstimate(work.overdueMinutes) : "None", work.overdueMinutes > 0);
        cards++;
      }
      if (showGpa) {
        const card = overview.createDiv({ cls: "qt-assignment-gpa" });
        card.createDiv({ cls: "qt-today-kicker", text: "Credit-weighted GPA" });
        card.createDiv({ cls: "qt-assignment-gpa-value", text: stats.gpa === null ? "—" : String(stats.gpa.toFixed(2)) });
        const copy = card.createDiv({ cls: "qt-assignment-gpa-copy" });
        copy.createDiv({
          cls: "qt-today-meta",
          text:
            stats.gpa === null
              ? "No graded work yet. Add a score to an assignment to calculate GPA."
              : `${stats.gradedCourses} graded course${stats.gradedCourses === 1 ? "" : "s"} · ${stats.credits} credits · unweighted ${stats.unweightedGpa.toFixed(2)}`,
        });
        cards++;
      }
      if (cards === 1) overview.addClass("is-single");
    }

    root.createEl("h3", { cls: "qt-today-section", text: "Courses" });
    if (!stats.courses.length) {
      const card = root.createDiv({ cls: "qt-assignment-empty qt-assignment-courses-empty" });
      card.createDiv({ cls: "qt-today-title", text: "Add your first assignment" });
      card.createDiv({ cls: "qt-today-meta", text: "Assignments are ordinary notes with a due date, course, category weight and optional score. Use Add assignment above to start." });
    } else {
      const grid = root.createDiv({ cls: "qt-assignment-courses" });
      for (const course of stats.courses) this.renderCourse(grid, course);
    }

    root.createEl("h3", { cls: "qt-today-section", text: "Tasks" });
    this.renderFilters(root);
    this.renderTasks(root, today);
    el.scrollTop = top;
  }

  renderOnboarding(root) {
    const card = root.createDiv({ cls: "qt-assignment-empty qt-assignment-courses-empty qt-assignment-onboarding" });
    card.createDiv({ cls: "qt-today-kicker", text: "Start here" });
    card.createEl("h3", { text: "One place for every deadline" });
    card.createDiv({
      cls: "qt-today-meta",
      text: "Add your first assignment above. Each one is an ordinary note, so it stays searchable and works with your other notes.",
    });
    const steps = card.createDiv({ cls: "qt-assignment-onboarding-steps" });
    for (const [number, title, copy] of [
      ["01", "Capture the work", "Add a course, due date and estimate for each assignment."],
      ["02", "Record the score", "A scored assignment feeds the course grade and GPA immediately."],
      ["03", "Set the target", "Add credits and a final weight under Assignment settings to plan the final."],
    ]) {
      const step = steps.createDiv({ cls: "qt-assignment-onboarding-step" });
      step.createSpan({ cls: "qt-assignment-onboarding-step-number", text: number });
      step.createDiv({ cls: "qt-assignment-onboarding-step-title", text: title });
      step.createDiv({ cls: "qt-assignment-onboarding-step-copy", text: copy });
    }
  }

  renderFilters(root) {
    const row = root.createDiv({ cls: "qt-row qt-small-row qt-assignment-filters qt-segmented" });
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

    const actions = card.createDiv({ cls: "qt-row qt-small-row qt-assignment-course-actions" });
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
        text: [a.course, a.typeLabel, a.due ? state.label : "No due date", a.estimate ? `~${formatEstimate(a.estimate)}` : "", a.percent === null ? "" : numberText(a.percent)].filter(Boolean).join(" · "),
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
