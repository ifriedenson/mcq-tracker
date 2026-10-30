"use strict";
const { Modal, Notice } = require("obsidian");
const { parseQuickAdd } = require("./quick-add");
const { str } = require("./util");

const EXAMPLE = `Q: Which gas do plants take in during photosynthesis?
A. Oxygen
B. Carbon dioxide
Answer: B
Why: Photosynthesis consumes carbon dioxide and releases oxygen.
Course: Biology
Skill: photosynthesis

Q: What is 3/4 written as a decimal?
Answer: 0.75`;

/**
 * Paste several questions at once, review them, then write one normal note per
 * question. Pasting never writes on its own: the preview always comes first.
 */
class QuickAddModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.text = "";
    this.course = "";
    this.folder = str(plugin.settings.questionFolder).trim() || "Questions";
    this.items = [];
    this.issues = [];
    this.busy = false;
    this.error = "";
  }

  onOpen() {
    this.modalEl.addClass("qt-transcript-modal");
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Quick add questions" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "Paste one or more questions. Each one starts with \"Q:\", its choices go on lines like \"A.\", and the key goes on \"Answer:\". Nothing is written until you press Create.",
    });
    el.createEl("pre", { cls: "qt-quick-add-example", text: EXAMPLE });

    this.box = el.createEl("textarea", {
      cls: "qt-quick-add",
      attr: { rows: "14", placeholder: "Paste your questions here…", spellcheck: "false" },
    });
    this.box.value = this.text;
    this.box.addEventListener("input", () => {
      this.text = this.box.value;
      this.refresh();
    });

    const row = el.createDiv({ cls: "qt-row" });
    const folderWrap = row.createDiv({ cls: "qt-field qt-grow" });
    folderWrap.createEl("label", { text: "Folder" });
    this.folderInput = folderWrap.createEl("input", { type: "text", attr: { placeholder: "Questions" } });
    this.folderInput.value = this.folder;
    this.folderInput.addEventListener("input", () => (this.folder = this.folderInput.value));
    const courseWrap = row.createDiv({ cls: "qt-field qt-grow" });
    courseWrap.createEl("label", { text: "Course (optional)" });
    this.courseInput = courseWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. AP Biology" } });
    this.courseInput.value = this.course;
    this.courseInput.addEventListener("input", () => {
      this.course = this.courseInput.value;
      this.refresh();
    });

    this.previewEl = el.createDiv({ cls: "qt-quick-add-preview" });
    this.statusEl = el.createDiv({ cls: "qt-hint" });
    this.footer = el.createDiv({ cls: "qt-row" });
    this.footer.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    this.createBtn = this.footer.createEl("button", { text: "Create questions", cls: "mod-cta qt-grow" });
    this.createBtn.addEventListener("click", () => this.write());
    this.refresh();
  }

  /** Re-read the textarea and redraw only the preview and the button. */
  refresh() {
    if (!this.previewEl) return;
    const parsed = parseQuickAdd(this.text, { course: this.course });
    this.items = parsed.items;
    this.issues = parsed.issues;
    this.previewEl.empty();
    this.statusEl.empty();
    this.createBtn.disabled = this.busy || !this.items.length;
    this.createBtn.setText(`Create ${this.items.length} question${this.items.length === 1 ? "" : "s"}`);

    if (this.error) this.statusEl.createEl("p", { cls: "qt-error", text: this.error });
    if (!str(this.text).trim()) {
      this.statusEl.createEl("p", { cls: "qt-hint", text: "Paste questions above to see the preview." });
      return;
    }
    const ready = this.items.length;
    const summary = `${ready} ${ready === 1 ? "question is" : "questions are"} ready`;
    this.statusEl.createEl("p", {
      cls: this.issues.length ? "qt-hint" : "setting-item-description",
      text: this.issues.length ? `${summary} · ${this.issues.length} line${this.issues.length === 1 ? " needs" : "s need"} attention` : summary,
    });

    if (this.issues.length) {
      const list = this.previewEl.createEl("ul", { cls: "qt-quick-add-issues" });
      for (const issue of this.issues.slice(0, 8)) {
        const where = issue.question ? `“${issue.question}…” ` : `Block ${issue.index + 1}: `;
        list.createEl("li", { cls: "qt-error", text: where + issue.message });
      }
      if (this.issues.length > 8) this.previewEl.createEl("p", { cls: "qt-hint", text: `…and ${this.issues.length - 8} more.` });
    }

    if (ready) {
      const list = this.previewEl.createEl("ol", { cls: "qt-extract-preview" });
      for (const item of this.items.slice(0, 20)) {
        const choices = item.choices.length ? ` (${item.choices.length} choices, answer ${item.answer})` : ` (written answer: ${item.answer})`;
        list.createEl("li", { text: `${item.question.slice(0, 120)}${item.question.length > 120 ? "…" : ""}${choices}` });
      }
      if (ready > 20) this.previewEl.createEl("p", { cls: "qt-hint", text: `…and ${ready - 20} more.` });
    }
  }

  async write() {
    if (this.busy || !this.items.length) return;
    this.busy = true;
    this.error = "";
    this.refresh();
    this.createBtn.setText("Writing…");
    try {
      const result = await this.plugin.createQuickAddQuestions(this.items, {
        folder: this.folder,
        course: this.course,
      });
      const bits = [`Created ${result.created} question${result.created === 1 ? "" : "s"}`];
      if (result.errors && result.errors.length) bits.push(`${result.errors.length} failed`);
      new Notice(bits.join(" · "), 6000);
      if (!result.created) {
        this.busy = false;
        this.error = (result.errors && result.errors[0]) || "Nothing was written.";
        this.refresh();
        return;
      }
      this.close();
      this.onDone(result);
    } catch (e) {
      this.busy = false;
      this.error = str(e && e.message ? e.message : e) || "Could not create the questions.";
      this.refresh();
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { EXAMPLE, QuickAddModal };
