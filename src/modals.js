"use strict";
const { AbstractInputSuggest, FuzzySuggestModal, Modal } = require("obsidian");
const { str } = require("./util");
const { filterOptionCounts, folderLabel, officialIdOf } = require("./filters");

/* ------------------------------------------------------------------ modal */

class NameModal extends Modal {
  constructor(app, title, initial, onSubmit) {
    super(app);
    this.title = title;
    this.initial = initial || "";
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.title });
    const input = contentEl.createEl("input", { type: "text", cls: "qt-modal-input" });
    input.value = this.initial;
    const go = () => {
      const v = input.value.trim();
      if (!v) return;
      this.close();
      this.onSubmit(v);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
    const btn = contentEl.createEl("button", { text: "Save", cls: "mod-cta qt-modal-btn" });
    btn.addEventListener("click", go);
    setTimeout(() => input.focus(), 50);
  }
  onClose() {
    this.contentEl.empty();
  }
}

class ConfirmModal extends Modal {
  constructor(app, title, body, okText, resolve) {
    super(app);
    this.title = title;
    this.body = body;
    this.okText = okText;
    this.resolve = resolve;
    this.done = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: this.title });
    for (const par of this.body.split("\n\n")) contentEl.createEl("p", { text: par });
    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const ok = row.createEl("button", { text: this.okText, cls: "mod-cta qt-grow" });
    cancel.addEventListener("click", () => this.finish(false));
    ok.addEventListener("click", () => this.finish(true));
  }
  finish(v) {
    this.done = true;
    this.resolve(v);
    this.close();
  }
  onClose() {
    if (!this.done) this.resolve(false);
    this.contentEl.empty();
  }
}

class FolderSuggest extends AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  getSuggestions(query) {
    const q = str(query).toLowerCase();
    return this.app.vault
      .getAllFolders(false)
      .filter((f) => f.path.toLowerCase().includes(q))
      .slice(0, 20);
  }
  renderSuggestion(f, el) {
    el.setText(f.path);
  }
  selectSuggestion(f) {
    this.inputEl.value = f.path;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
}

/** Choose a folder that holds questions ("Practice a folder"). */
class QuestionFolderModal extends FuzzySuggestModal {
  constructor(app, plugin, onPick) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
    this.setPlaceholder("Type a folder name...");
  }
  getItems() {
    return filterOptionCounts(this.plugin.getQuestions(), {}, "folder");
  }
  getItemText(o) {
    return `${folderLabel(o.value, this.plugin.settings.questionFolder)} (${o.count})`;
  }
  onChooseItem(o) {
    this.onPick(o.value);
  }
}

/** Jump to a question note by its official id (or the plugin's own id). */
class FindQuestionModal extends FuzzySuggestModal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.setPlaceholder("Type a question ID...");
  }
  getItems() {
    return this.plugin.getQuestions().map((q) => ({ file: q.file, official: officialIdOf(q.fm), qid: str(q.fm.question_id) }));
  }
  getItemText(it) {
    return [it.official, it.qid, it.file.parent ? it.file.parent.path : ""].filter(Boolean).join(" · ");
  }
  onChooseItem(it) {
    this.app.workspace.getLeaf("tab").openFile(it.file);
  }
}

/** Type-ahead for the folder filter: matches any part of the path and shows how many notes each folder holds. */
class FolderFilterSuggest extends AbstractInputSuggest {
  constructor(app, inputEl, getOptions, onPick, root) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.getOptions = getOptions;
    this.onPick = onPick;
    this.root = root;
  }
  getSuggestions(query) {
    const q = str(query).toLowerCase().trim();
    return this.getOptions()
      .filter((o) => !q || o.value.toLowerCase().includes(q))
      .slice(0, 40);
  }
  renderSuggestion(o, el) {
    el.setText(`${folderLabel(o.value, this.root)} (${o.count})`);
  }
  selectSuggestion(o) {
    this.inputEl.value = "";
    this.close();
    this.onPick(o.value);
  }
}

module.exports = {
  NameModal,
  ConfirmModal,
  FolderSuggest,
  QuestionFolderModal,
  FindQuestionModal,
  FolderFilterSuggest,
};
