"use strict";
const { Modal, Notice, Setting } = require("obsidian");
const { localDate } = require("./util");

class FocusLogModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.date = (options && options.date) || localDate();
    this.minutes = "30";
    this.course = (options && options.course) || plugin.settings.studyLog.lastCourse || "";
    this.note = "";
  }

  onOpen() {
    this.modalEl.addClass("qt-focus-modal");
    const el = this.contentEl;
    el.createEl("h3", { text: "Log study time" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Add time you studied offline. The focus timer logs itself when you finish a session.",
    });
    new Setting(el).setName("Date").addText((t) => {
      t.inputEl.type = "date";
      t.setValue(this.date).onChange((v) => (this.date = v));
    });
    new Setting(el).setName("Minutes").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(this.minutes).onChange((v) => (this.minutes = v));
    });
    new Setting(el).setName("Course").addText((t) =>
      t.setPlaceholder("Optional").setValue(this.course).onChange((v) => (this.course = v))
    );
    new Setting(el).setName("Note").addText((t) =>
      t.setPlaceholder("Optional").setValue(this.note).onChange((v) => (this.note = v))
    );
    const row = el.createDiv({ cls: "qt-row qt-focus-actions" });
    row.createEl("button", { text: "Save time", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.save());
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
  }

  async save() {
    const minutes = Number(this.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      new Notice("Enter the number of minutes you studied.");
      return;
    }
    await this.plugin.logStudySession({
      date: this.date,
      minutes,
      course: this.course,
      note: this.note,
    });
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  FocusLogModal,
};
