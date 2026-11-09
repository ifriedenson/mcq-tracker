"use strict";
const { QtModal } = require("./a11y");
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");

class CourseOverviewModal extends QtModal {
  constructor(app, plugin, courseId) {
    super(app);
    this.plugin = plugin;
    this.courseId = courseId;
  }

  onOpen() {
    const data = this.plugin.courseOverviewData(this.courseId);
    const { contentEl } = this;
    contentEl.empty();
    if (!data) {
      contentEl.createEl("h3", { text: "Course overview" });
      contentEl.createDiv({ cls: "qt-hint", text: "That course is no longer in the registry or dashboard." });
      return;
    }
    const head = contentEl.createDiv({ cls: "qt-workspace-head" });
    const title = head.createEl("h3");
    const dot = title.createSpan({ cls: "qt-workspace-subject-dot" });
    dot.style.background = data.color || "#7c9cf5";
    title.createSpan({ text: data.name });
    head.createSpan({ cls: "qt-workspace-grade", text: data.grade && data.grade.letter ? `${data.grade.letter}${data.grade.weighted !== null ? ` · ${data.grade.weighted}%` : ""}` : "No grades" });
    contentEl.createDiv({ cls: "qt-hint", text: "Everything here is derived from your notes and local settings. Open a row to jump to its source." });

    if (!data.sections.length) {
      contentEl.createDiv({ cls: "qt-study-empty", text: "Nothing is scheduled or due for this course yet." });
      return;
    }
    for (const section of data.sections) {
      const card = contentEl.createDiv({ cls: "qt-study-card" });
      card.createEl("h4", { text: section.title });
      const list = card.createDiv({ cls: "qt-study-list" });
      for (const row of section.rows) {
        const item = list.createDiv({ cls: "qt-study-row" });
        const main = item.createDiv({ cls: "qt-study-row-main" });
        main.createDiv({ cls: "qt-study-row-title", text: row.label });
        if (row.detail) main.createDiv({ cls: "qt-study-row-meta", text: row.detail });
        if (row.evidence) main.createDiv({ cls: "qt-study-row-meta", text: row.evidence });
        const canOpen = !!(
          row.widget ||
          row.notePath ||
          row.path ||
          ["plan", "reading", "task", "assignment", "grade"].includes(row.source) ||
          (row.source === "exam" && row.exam && row.exam.calendarEvent)
        );
        if (canOpen) item.createEl("button", { text: "Open" }).addEventListener("click", () => this.openRow(row));
      }
    }
  }

  openRow(row) {
    if (row.notePath) {
      this.plugin.app.workspace.openLinkText(row.notePath, "", false);
      return;
    }
    if (row.path) {
      this.plugin.app.workspace.openLinkText(row.path, "", false);
      return;
    }
    if (row.source === "exam" && row.exam && row.exam.calendarEvent) {
      this.plugin.openClassNote(row.exam.calendarEvent, row.exam.date);
      return;
    }
    if (row.source === "plan") {
      this.plugin.activateStudyWorkspace("planner");
      return;
    }
    if (row.source === "reading") {
      this.plugin.activateStudyWorkspace("readingLibrary");
      return;
    }
    if (row.source === "task") {
      this.plugin.activateStudyWorkspace("tasks");
      return;
    }
    if (row.source === "assignment" || row.source === "grade") {
      this.plugin.activateAssignments();
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { CourseOverviewModal };
