"use strict";
const { QtModal } = require("./a11y");
/*
 * The read-only kanban structure window. Column derivation and the re-stack stay
 * in canvas-kanban.js; this only draws the report it is given.
 */
const { Modal } = require("obsidian");

class KanbanReportModal extends QtModal {
  constructor(app, report) {
    super(app);
    this.report = report || { columns: [], unassigned: [], summary: "" };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qt-kanban-modal");
    contentEl.createEl("h3", { text: "Kanban columns" });
    contentEl.createEl("p", { cls: "setting-item-description", text: this.report.summary });
    if (!this.report.columns.length) {
      contentEl.createDiv({ cls: "qt-hint", text: "No columns were found on this board." });
    }
    for (const column of this.report.columns) {
      const section = contentEl.createDiv({ cls: "qt-kanban-column" });
      section.createEl("h4", { text: column.title + " (" + column.cards.length + ")" });
      if (!column.cards.length) {
        section.createDiv({ cls: "qt-hint", text: "No cards in this column." });
        continue;
      }
      const list = section.createEl("ul", { cls: "qt-kanban-cards" });
      for (const card of column.cards) list.createEl("li", { text: card.label });
    }
    if (this.report.unassigned.length) {
      const loose = contentEl.createDiv({ cls: "qt-kanban-unsorted" });
      loose.createEl("h4", { text: "Unassigned (" + this.report.unassigned.length + ")" });
      const list = loose.createEl("ul", { cls: "qt-kanban-cards" });
      for (const card of this.report.unassigned) list.createEl("li", { text: card.label });
    }
    const hint = contentEl.createDiv({
      cls: "qt-hint",
      text: "Re-stack the board with the Canvas command to line the columns up.",
    });
    hint.addClass("qt-kanban-hint");
    const done = contentEl.createEl("button", { text: "Done", cls: "qt-done" });
    done.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { KanbanReportModal };
