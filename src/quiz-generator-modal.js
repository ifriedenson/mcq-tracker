"use strict";
const { QtModal } = require("./a11y");
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const chatBudget = require("./chat-budget");
const chatPricing = require("./chat-pricing");
const { QUIZ_LANGUAGES, QUIZ_TYPES, normalizeQuizGenerator } = require("./quiz-generator");

/** Choose source folders, type, count and language, then review before writing. */
class QuizGeneratorModal extends QtModal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.config = normalizeQuizGenerator(plugin.settings.quizGenerator);
    this.folderText = this.config.folders.join(", ");
    this.count = this.config.count;
    this.language = this.config.language;
    this.focus = this.config.focus || "";
    this.types = this.config.types.slice();
    this.prepared = null;
    this.generated = null;
    this.busy = false;
    this.busyLabel = "";
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
      el.createEl("p", { cls: "qt-hint", text: this.busyLabel || `Drafting questions in ${this.language}…` });
      return;
    }
    if (this.prepared) return this.renderEstimate(el);

    const folders = el.createDiv({ cls: "qt-field" });
    folders.createEl("label", { text: "Source folders (comma-separated; blank means the whole vault)" });
    const folderInput = folders.createEl("input", { type: "text", attr: { placeholder: "Lectures, Notes/Bio", "aria-label": "Source folders" } });
    folderInput.value = this.folderText;
    folderInput.addEventListener("input", () => (this.folderText = folderInput.value));

    const focus = el.createDiv({ cls: "qt-field" });
    focus.createEl("label", { text: "Focus topic (optional)" });
    const focusInput = focus.createEl("input", { type: "text", attr: { placeholder: "e.g. oxidative phosphorylation", "aria-label": "Focus topic" } });
    focusInput.value = this.focus;
    focusInput.addEventListener("input", () => (this.focus = focusInput.value));

    const row = el.createDiv({ cls: "qt-row" });
    const countWrap = row.createDiv({ cls: "qt-field qt-grow" });
    countWrap.createEl("label", { text: "How many?" });
    const count = countWrap.createEl("select", { cls: "qt-select" });
    count.setAttribute("aria-label", "How many questions?");
    for (const n of [5, 8, 10, 12, 15, 20]) count.createEl("option", { value: String(n), text: `${n} questions` });
    count.value = String(this.count);
    count.addEventListener("change", () => (this.count = Number(count.value)));

    const languageWrap = row.createDiv({ cls: "qt-field qt-grow" });
    languageWrap.createEl("label", { text: "Output language" });
    const language = languageWrap.createEl("select", { cls: "qt-select" });
    language.setAttribute("aria-label", "Output language");
    for (const name of QUIZ_LANGUAGES) language.createEl("option", { value: name, text: name });
    language.value = this.language;
    language.addEventListener("change", () => (this.language = language.value));

    const types = el.createDiv({ cls: "qt-field" });
    types.createEl("label", { text: "Question types" });
    for (const type of QUIZ_TYPES) {
      const label = types.createEl("label", { cls: "qt-check" });
      const box = label.createEl("input", { type: "checkbox", attr: { "aria-label": type.label } });
      box.checked = this.types.includes(type.id);
      box.addEventListener("change", () => {
        this.types = this.types.includes(type.id) ? this.types.filter((id) => id !== type.id) : [...this.types, type.id];
      });
      label.createSpan({ text: ` ${type.label}` });
    }

    el.createDiv({
      cls: "qt-hint",
      text: "Only notes in the chosen folders are searched. Relevant passages are selected locally; the draft is shown here first, and files are created only after you confirm.",
    });
    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const go = actions.createEl("button", { text: "Generate draft", cls: "mod-cta qt-grow" });
    go.disabled = !this.plugin.settings.ai.enabled;
    go.addEventListener("click", () => this.prepare());
  }

  renderEstimate(el) {
    const p = this.prepared;
    const est = p.estimate || {};
    el.createEl("h4", { text: "Ready to send" });
    const passages = p.source && p.source.retrieval && p.source.retrieval.passages
      ? ` from ${p.source.retrieval.passages} relevant passage${p.source.retrieval.passages === 1 ? "" : "s"}`
      : "";
    el.createDiv({
      cls: "qt-hint",
      text: `Model: ${p.model || "not configured"} · ${p.source.count} note${p.source.count === 1 ? "" : "s"}${passages}. No request has been sent yet.`,
    });
    if (est.ok) {
      el.createDiv({
        cls: "qt-hint qt-chat-cost-line",
        text: `Estimated cost: ${chatPricing.formatUsd(est.total)} (${chatPricing.formatUsd(est.inputCost)} input + up to ${chatPricing.formatUsd(est.outputCost)} reply at local prices; an estimate, not an invoice).`,
      });
      el.createDiv({
        cls: "qt-hint",
        text: `~${chatBudget.formatTokenCount(est.inputTokens)} input tokens + up to ${chatBudget.formatTokenCount(est.outputTokens)} reply tokens.`,
      });
    } else {
      el.createDiv({
        cls: "qt-hint",
        text: `No local price for ${p.model || "this model"}. Add one under Settings → AI to see a cost estimate before sending. This request is ~${chatBudget.formatTokenCount(est.inputTokens || 0)} input tokens plus up to ${chatBudget.formatTokenCount(est.outputTokens || 0)} reply tokens.`,
      });
    }
    el.createDiv({
      cls: "qt-hint",
      text: "The estimate uses the prompt that will be sent and your local model prices. It is not an invoice.",
    });
    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => {
      this.prepared = null;
      this.render();
    });
    actions.createEl("button", { text: "Send request", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.send());
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
    const passages = g.retrieval && g.retrieval.passages ? ` from ${g.retrieval.passages} relevant passage${g.retrieval.passages === 1 ? "" : "s"}` : "";
    el.createDiv({ cls: "qt-hint", text: `Drafted from ${g.sourceCount} note${g.sourceCount === 1 ? "" : "s"}${passages} in ${g.language}. Nothing was written yet.` });
    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => {
      this.generated = null;
      this.prepared = null;
      this.render();
    });
    actions.createEl("button", { text: "Create questions", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.write());
  }

  async prepare() {
    if (this.busy) return;
    this.busy = true;
    this.busyLabel = "Preparing the request…";
    this.error = "";
    this.prepared = null;
    this.render();
    try {
      const config = normalizeQuizGenerator({
        folders: this.folderText.split(","),
        count: this.count,
        language: this.language,
        focus: this.focus,
        types: this.types,
      });
      this.plugin.settings.quizGenerator = config;
      await this.plugin.save();
      this.prepared = await this.plugin.prepareQuizGeneration(config);
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not prepare the quiz request.";
    }
    this.busy = false;
    this.busyLabel = "";
    this.render();
  }

  async send() {
    if (this.busy || !this.prepared) return;
    this.busy = true;
    this.busyLabel = `Drafting questions in ${this.language}…`;
    this.error = "";
    this.render();
    try {
      this.generated = await this.plugin.generateQuizFromNotes(this.prepared.config, this.prepared);
      if (!this.generated.items.length) this.error = "The AI returned no usable questions. Try different notes or fewer types.";
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not generate questions.";
    }
    this.busy = false;
    this.busyLabel = "";
    this.render();
  }

  async write() {
    if (this.busy || !this.generated) return;
    this.busy = true;
    this.render();
    try {
      const result = await this.plugin.createQuickAddQuestions(this.generated.items, {
        folder: this.plugin.settings.questionFolder,
        ai: true,
        model: this.generated.model,
        summary: "Quiz generator",
      });
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
