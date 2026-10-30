"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const { QUIZ_LANGUAGES, QUIZ_TYPES, normalizeQuizGenerator } = require("./quiz-generator");

/** Choose source folders, type, count and language, then review before writing. */
class QuizGeneratorModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.config = normalizeQuizGenerator(plugin.settings.quizGenerator);
    this.folderText = this.config.folders.join(", ");
    this.count = this.config.count;
    this.language = this.config.language;
    this.types = this.config.types.slice();
    this.generated = null;
    this.busy = false;
    this.error = "";
  }

  onOpen() {
    this.modalEl.addClass("qt-transcript-modal");
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Generate quiz questions from notes" });
    if (!this.plugin.settings.ai.enabled) {
      el.createEl("p", { cls: "qt-hint", text: "Turn on AI features and choose a provider under Settings → MCQ Tracker → AI first. Nothing is sent until you press Generate." });
    }
    if (this.error) el.createEl("p", { cls: "qt-error", text: this.error });
    if (this.generated && this.generated.items.length) return this.renderPreview(el);
    if (this.busy) {
      el.createEl("p", { cls: "qt-hint", text: `Drafting questions in ${this.language}…` });
      return;
    }

    const folders = el.createDiv({ cls: "qt-field" });
    folders.createEl("label", { text: "Source folders (comma-separated; blank means the whole vault)" });
    const folderInput = folders.createEl("input", { type: "text", attr: { placeholder: "Lectures, Notes/Bio" } });
    folderInput.value = this.folderText;
    folderInput.addEventListener("input", () => (this.folderText = folderInput.value));

    const row = el.createDiv({ cls: "qt-row" });
    const countWrap = row.createDiv({ cls: "qt-field qt-grow" });
    countWrap.createEl("label", { text: "How many?" });
    const count = countWrap.createEl("select", { cls: "qt-select" });
    for (const n of [5, 8, 10, 12, 15, 20]) count.createEl("option", { value: String(n), text: `${n} questions` });
    count.value = String(this.count);
    count.addEventListener("change", () => (this.count = Number(count.value)));

    const languageWrap = row.createDiv({ cls: "qt-field qt-grow" });
    languageWrap.createEl("label", { text: "Output language" });
    const language = languageWrap.createEl("select", { cls: "qt-select" });
    for (const name of QUIZ_LANGUAGES) language.createEl("option", { value: name, text: name });
    language.value = this.language;
    language.addEventListener("change", () => (this.language = language.value));

    const types = el.createDiv({ cls: "qt-field" });
    types.createEl("label", { text: "Question types" });
    for (const type of QUIZ_TYPES) {
      const label = types.createEl("label", { cls: "qt-check" });
      const box = label.createEl("input", { type: "checkbox" });
      box.checked = this.types.includes(type.id);
      box.addEventListener("change", () => {
        this.types = this.types.includes(type.id) ? this.types.filter((id) => id !== type.id) : [...this.types, type.id];
      });
      label.createSpan({ text: ` ${type.label}` });
    }

    el.createDiv({
      cls: "qt-hint",
      text: "Only notes in the chosen folders are sent. The draft is shown here first; files are created only after you confirm.",
    });
    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const go = actions.createEl("button", { text: "Generate draft", cls: "mod-cta qt-grow" });
    go.disabled = !this.plugin.settings.ai.enabled;
    go.addEventListener("click", () => this.generate());
  }

  renderPreview(el) {
    const g = this.generated;
    el.createEl("h4", { text: `Ready to write ${g.items.length} question${g.items.length === 1 ? "" : "s"}` });
    const list = el.createEl("ul", { cls: "qt-extract-preview" });
    for (const item of g.items.slice(0, 20)) {
      const type = item.questionType === "multi" ? "select all" : item.questionType === "true_false" ? "true/false" : "multiple choice";
      list.createEl("li", { text: `${item.question} (${type}, answer ${item.answer})` });
    }
    if (g.items.length > 20) el.createEl("p", { cls: "qt-hint", text: `…and ${g.items.length - 20} more.` });
    el.createDiv({ cls: "qt-hint", text: `Drafted from ${g.sourceCount} note${g.sourceCount === 1 ? "" : "s"} in ${g.language}. Nothing was written yet.` });
    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => {
      this.generated = null;
      this.render();
    });
    actions.createEl("button", { text: "Create questions", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.write());
  }

  async generate() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.render();
    try {
      const config = normalizeQuizGenerator({
        folders: this.folderText.split(","),
        count: this.count,
        language: this.language,
        types: this.types,
      });
      this.plugin.settings.quizGenerator = config;
      await this.plugin.save();
      this.generated = await this.plugin.generateQuizFromNotes(config);
      if (!this.generated.items.length) this.error = "The AI returned no usable questions. Try different notes or fewer types.";
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not generate questions.";
    }
    this.busy = false;
    this.render();
  }

  async write() {
    if (this.busy || !this.generated) return;
    this.busy = true;
    this.render();
    try {
      const result = await this.plugin.createQuickAddQuestions(this.generated.items, { folder: this.plugin.settings.questionFolder });
      const made = result.created || 0;
      new Notice(made ? `Created ${made} question${made === 1 ? "" : "s"}.` : "Nothing new was written.", 6000);
      this.close();
      this.onDone(result);
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not write the generated questions.";
      this.busy = false;
      this.render();
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { QuizGeneratorModal };
