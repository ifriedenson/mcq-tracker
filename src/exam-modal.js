"use strict";
const { Modal, Notice } = require("obsidian");
const { localDate, str } = require("./util");

/* Manual exams are ordinary assignment notes with type: exam. */
class ExamModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Add an exam" });
    contentEl.createDiv({
      cls: "qt-hint",
      text: "This creates a normal assignment note with type Exam. It is included in review-date caps, the study plan, course health and the course overview.",
    });
    const field = (label, placeholder, type) => {
      const wrap = contentEl.createDiv({ cls: "qt-field" });
      wrap.createEl("label", { text: label });
      return wrap.createEl("input", { type: type || "text", attr: { placeholder: placeholder || "" } });
    };
    const title = field("Exam title", "e.g. Biology final", "text");
    title.value = str(this.options.title || "");
    const course = field("Course", "e.g. Biology", "text");
    course.value = str(this.options.course || "");
    const date = field("Exam date", "", "date");
    date.value = str(this.options.date || localDate());
    const time = field("Start time (optional)", "", "time");
    const weight = field("Weight inside exams (optional)", "e.g. 25", "number");
    const topicsWrap = contentEl.createDiv({ cls: "qt-field" });
    topicsWrap.createEl("label", { text: "Topics (comma or newline separated)" });
    const topics = topicsWrap.createEl("textarea", { attr: { rows: "3", placeholder: "Cells, Genetics, Respiration" } });

    const row = contentEl.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const save = row.createEl("button", { text: "Create exam", cls: "mod-cta qt-grow" });
    save.addEventListener("click", async () => {
      if (!str(title.value).trim()) {
        new Notice("Give the exam a title.");
        return;
      }
      if (!str(course.value).trim()) {
        new Notice("Add the course this exam belongs to.");
        return;
      }
      if (!str(date.value).trim()) {
        new Notice("Choose the exam date.");
        return;
      }
      save.disabled = true;
      try {
        const result = await this.plugin.createAssignment({
          title: str(title.value).trim(),
          course: str(course.value).trim(),
          type: "exam",
          category: "exam",
          due: str(date.value).trim(),
          examTime: str(time.value).trim(),
          weight: str(weight.value).trim() || "1",
          topics: str(topics.value).split(/[,;\n]/).map((part) => part.trim()).filter(Boolean),
          status: "todo",
        });
        this.close();
        this.onDone(result);
      } catch (e) {
        save.disabled = false;
        new Notice(str(e && e.message) || "Could not create the exam note.");
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { ExamModal };
