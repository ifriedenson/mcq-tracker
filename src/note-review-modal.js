"use strict";
const { Modal, Notice } = require("obsidian");
const { renderMarkdownInto } = require("./view-helpers");
const { str } = require("./util");

/** Review one whole note at a time, with the same four ratings as cards. */
class NoteReviewModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.queue = [];
    this.index = 0;
    this.started = Date.now();
  }

  async onOpen() {
    await this.load();
  }

  async load() {
    const queue = this.plugin.getNoteQueue({ limit: this.plugin.settings.noteReview.limit });
    this.queue = queue.items;
    this.index = 0;
    await this.render();
  }

  async render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Whole-note review" });
    const counts = this.plugin.getNoteQueue({ limit: 0 }).counts;
    el.createDiv({
      cls: "qt-hint",
      text: `${counts.due} note${counts.due === 1 ? "" : "s"} due or new · ${counts.new} new`,
    });
    if (this.index >= this.queue.length) {
      el.createDiv({ cls: "qt-hint", text: this.queue.length ? "Review complete." : "No notes are due in the configured sets." });
      return;
    }

    const item = this.queue[this.index];
    this.started = Date.now();
    const head = el.createDiv({ cls: "qt-note-review-head" });
    head.createEl("h4", { text: item.title });
    head.createDiv({
      cls: "qt-hint",
      text: `${item.set} · ${item.priority} priority · ${item.isNew ? "new" : `due ${item.dueDate}`} · ${this.index + 1}/${this.queue.length}`,
    });

    const grow = head.createEl("select", { cls: "qt-select" });
    for (const value of ["high", "normal", "low"]) grow.createEl("option", { value, text: `${value} priority` });
    grow.value = item.priority;
    grow.addEventListener("change", async () => {
      await this.plugin.setNotePriority(item.file, grow.value);
      new Notice(`Priority set to ${grow.value}.`);
    });

    const body = el.createDiv({ cls: "qt-note-review-body" });
    try {
      const text = await this.app.vault.cachedRead(item.file);
      renderMarkdownInto(this.app, text, body, item.path, this);
    } catch (e) {
      body.createDiv({ cls: "qt-error", text: "Could not read this note." });
    }

    const actions = el.createDiv({ cls: "qt-row qt-note-review-actions" });
    for (const [grade, label] of [
      ["again", "Again"],
      ["hard", "Hard"],
      ["good", "Good"],
      ["easy", "Easy"],
    ]) {
      actions.createEl("button", { text: label }).addEventListener("click", () => this.rate(grade));
    }
    el.createEl("button", { text: "Open note", cls: "qt-link" }).addEventListener("click", () => {
      this.app.workspace.getLeaf("tab").openFile(item.file);
    });
  }

  async rate(grade) {
    const item = this.queue[this.index];
    if (!item) return;
    const seconds = Math.max(1, Math.round((Date.now() - this.started) / 1000));
    try {
      await this.plugin.recordNoteReview(item.file, grade, seconds);
      this.index++;
      await this.render();
    } catch (e) {
      new Notice(`Could not record this note review: ${str(e && e.message ? e.message : e)}`);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { NoteReviewModal };
