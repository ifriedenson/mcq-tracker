"use strict";
const { QtModal } = require("./a11y");
const { str } = require("./util");

/*
 * The due-date half of inline task chips: reading view shows a chip, and the
 * chip opens this picker. Setting writes `📅 YYYY-MM-DD` into that line only;
 * clearing removes the token. Priority needs no dialog and steps directly.
 */
class TaskChipDateModal extends QtModal {
  constructor(app, currentDay, onPick) {
    super(app);
    this.currentDay = str(currentDay);
    this.onPick = onPick;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Task due date" });
    const input = contentEl.createEl("input", { type: "date", cls: "qt-input" });
    input.setAttribute("aria-label", "Task due date");
    if (/^\d{4}-\d{2}-\d{2}$/.test(this.currentDay)) input.value = this.currentDay;
    const row = contentEl.createDiv({ cls: "qt-row" });
    const clear = row.createEl("button", { text: "Clear", cls: "qt-grow" });
    clear.addEventListener("click", () => {
      this.close();
      if (typeof this.onPick === "function") this.onPick("");
    });
    const save = row.createEl("button", { text: "Set date", cls: "mod-cta qt-grow" });
    save.addEventListener("click", () => {
      const day = str(input.value).trim();
      this.close();
      if (typeof this.onPick === "function") this.onPick(/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "");
    });
  }
}

module.exports = { TaskChipDateModal };
