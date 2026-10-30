"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");

/** Capture a thought into a new note that is already onboarded to Spaced Everything. */
class SpacedEverythingCaptureModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.app = app;
    this.plugin = plugin;
    this.busy = false;
    this.error = "";
    this.text = "";
  }

  onOpen() {
    if (this.modalEl && typeof this.modalEl.addClass === "function") this.modalEl.addClass("qt-spaced-capture-modal");
    this.draw();
  }

  draw() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Capture thought" });
    el.createDiv({
      cls: "qt-hint",
      text: "Create an onboarded note from your thought. The title and note templates support {{date}}, {{time}}, {{unixtime}} and {{thought}}.",
    });
    this.box = el.createEl("textarea", {
      cls: "qt-spaced-capture-text",
      attr: { rows: "9", placeholder: "Write the thought you want to develop…" },
    });
    this.box.value = this.text;
    this.box.addEventListener("input", () => (this.text = this.box.value));
    if (this.error) el.createDiv({ cls: "qt-error", text: this.error });
    const row = el.createDiv({ cls: "qt-row" });
    const create = row.createEl("button", { text: this.busy ? "Creating…" : "Create thought", cls: "mod-cta" });
    create.disabled = this.busy;
    create.addEventListener("click", () => this.create());
    row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
  }

  async create() {
    if (this.busy) return;
    const thought = str(this.text).trim();
    if (!thought) {
      this.error = "Write a thought first.";
      this.draw();
      return;
    }
    this.busy = true;
    this.error = "";
    this.draw();
    try {
      const result = await this.plugin.captureSpacedThought(thought);
      new Notice(`Captured thought in ${result.path}.`, 5000);
      this.close();
    } catch (e) {
      this.busy = false;
      this.error = str(e && e.message ? e.message : e) || "Could not create the captured thought.";
      this.draw();
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  SpacedEverythingCaptureModal,
};
