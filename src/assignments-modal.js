"use strict";
const { Modal, Notice } = require("obsidian");
const { localDate, str } = require("./util");
const { ASSIGNMENT_STATUSES, ASSIGNMENT_TYPES, normalizeDate } = require("./assignments");

/** Create or edit one assignment note. */
class AssignmentModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.assignment = this.options.assignment || null;
    this.onDone = onDone || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    const p = this.plugin;
    const a = this.assignment;
    contentEl.empty();
    contentEl.createEl("h3", { text: a ? "Edit assignment" : "New assignment" });

    const field = (label, placeholder) => {
      const wrap = contentEl.createDiv({ cls: "qt-field" });
      wrap.createEl("label", { text: label });
      return wrap.createEl("input", { type: "text", attr: { placeholder: placeholder || "" } });
    };

    const title = field("Title", "e.g. Unit 4 problem set");
    title.value = a ? a.title : "";

    const course = field("Course", "e.g. BIOL 201");
    course.value = a ? a.course : str(this.options.course || "");

    const typeWrap = contentEl.createDiv({ cls: "qt-field" });
    typeWrap.createEl("label", { text: "Type" });
    const type = typeWrap.createEl("select", { cls: "dropdown" });
    for (const t of ASSIGNMENT_TYPES) type.createEl("option", { text: t.label, value: t.id });
    type.value = a ? a.type : "homework";

    const dueWrap = contentEl.createDiv({ cls: "qt-field" });
    dueWrap.createEl("label", { text: "Due date" });
    const due = dueWrap.createEl("input", { type: "date" });
    due.value = a ? normalizeDate(a.due) : normalizeDate(this.options.due) || localDate();

    const statusWrap = contentEl.createDiv({ cls: "qt-field" });
    statusWrap.createEl("label", { text: "Status" });
    const status = statusWrap.createEl("select", { cls: "dropdown" });
    for (const s of ASSIGNMENT_STATUSES) status.createEl("option", { text: s.label, value: s.id });
    status.value = a ? a.status : "todo";

    const points = field("Points possible", "100");
    points.inputEl.type = "number";
    points.value = a && a.points !== null && a.points !== undefined ? String(a.points) : "100";

    const score = field("Points earned (when graded)", "e.g. 87");
    score.inputEl.type = "number";
    score.value = a && a.earned !== null && a.earned !== undefined ? String(a.earned) : "";

    const weight = field("Weight inside its category", "1");
    weight.inputEl.type = "number";
    weight.value = a ? String(a.weight) : "1";

    const estimate = field("Time estimate (minutes)", "e.g. 45");
    estimate.inputEl.type = "number";
    estimate.value = a && a.estimate ? String(a.estimate) : "";
    const hint = contentEl.createDiv({ cls: "qt-hint" });
    hint.setText("Category weights (homework, quizzes, tests, exams) are under Settings, Assignments, Grading. Weight here only orders assignments within one category. A time estimate is optional; 0 or blank means no estimate.");

    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const save = row.createEl("button", { text: a ? "Save changes" : "Create assignment", cls: "mod-cta qt-grow" });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", async () => {
      const data = {
        title: str(title.value).trim(),
        course: str(course.value).trim(),
        type: type.value,
        due: due.value,
        status: status.value,
        points: str(points.value).trim(),
        score: str(score.value).trim(),
        weight: str(weight.value).trim(),
        estimate: str(estimate.value).trim(),
      };
      if (!data.title) {
        new Notice("Give the assignment a title.");
        return;
      }
      if (!data.course) {
        new Notice("Add a course so the grade can be calculated.");
        return;
      }
      save.disabled = true;
      try {
        const result = a ? await p.updateAssignment(a, data) : await p.createAssignment(data);
        this.close();
        this.onDone(result);
      } catch (e) {
        save.disabled = false;
        new Notice(str(e && e.message) || "Could not save the assignment.");
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { AssignmentModal };
