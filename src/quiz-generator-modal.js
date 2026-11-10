"use strict";
const { QtModal } = require("./a11y");
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const chatBudget = require("./chat-budget");
const chatPricing = require("./chat-pricing");
const {
  QUIZ_LANGUAGES,
  QUIZ_TYPES,
  MAX_BRIEF_CHARS,
  MAX_PASTE_CHARS,
  MAX_PDF_SOURCES,
  normalizeQuizGenerator,
} = require("./quiz-generator");

const SOURCE_OPTIONS = [
  {
    id: "notes",
    label: "My notes",
    hint: "Searches only the folders you choose. Relevant passages are selected locally and sent with the brief.",
  },
  {
    id: "prompt",
    label: "My prompt (AI's own knowledge)",
    hint: "Only your brief is sent. The AI writes original questions from its general knowledge; it does not browse the web.",
  },
  {
    id: "pdfs",
    label: "PDFs in my vault",
    hint: "Reads the PDF text locally, then sends it with the brief. PDFs with no readable text are skipped and reported instead of guessed at.",
  },
  {
    id: "paste",
    label: "Text I paste",
    hint: "Only the text in the box is sent. It is not saved to settings.",
  },
];

function sourceOption(mode) {
  return SOURCE_OPTIONS.find((option) => option.id === mode) || SOURCE_OPTIONS[0];
}

/** A short, honest description of what a prepared draft will send. */
function sourceSummary(source) {
  const s = source || {};
  const retrieval = s.retrieval || {};
  if (retrieval.mode === "pdf-pages") {
    const pages = Number(retrieval.pages) || 0;
    const base = `${s.count || 0} PDF${s.count === 1 ? "" : "s"} (${pages} page${pages === 1 ? "" : "s"}, ${Number(s.chars || 0).toLocaleString()} characters)`;
    const skipped = Array.isArray(s.skipped) ? s.skipped.length : 0;
    return skipped ? `${base}; ${skipped} skipped PDF${skipped === 1 ? "" : "s"} (no readable text)` : base;
  }
  if (retrieval.mode === "pasted-text") {
    return `your pasted text (${Number(s.chars || 0).toLocaleString()} characters)`;
  }
  if (retrieval.mode === "model-knowledge") {
    return "your brief and the AI's general knowledge (no source text)";
  }
  const passages = Number(retrieval.passages) || 0;
  return `${s.count || 0} note${s.count === 1 ? "" : "s"}${passages ? ` from ${passages} passage${passages === 1 ? "" : "s"}` : ""}`;
}

/** The exact PDFs that were left out, with the readable reason, for the preview. */
function skippedPdfDetail(source) {
  const skipped = Array.isArray(source && source.skipped) ? source.skipped : [];
  if (!skipped.length) return "";
  const details = skipped.map((item) => `${str(item.path) || "PDF"}: ${str(item.reason) || "no readable text"}`).join("; ");
  return `Skipped ${skipped.length === 1 ? "PDF" : "PDFs"}: ${details}`;
}

/** Choose a source, ask for a kind of question, preview, then write. */
class QuizGeneratorModal extends QtModal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.config = normalizeQuizGenerator(plugin.settings.quizGenerator);
    this.sourceMode = this.config.sourceMode;
    this.folderText = this.config.folders.join(", ");
    this.brief = this.config.brief || "";
    this.pdfPaths = this.config.pdfPaths.slice();
    this.pasteText = "";
    this.count = this.config.count;
    this.language = this.config.language;
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
    el.createEl("h3", { text: "Find or generate quiz questions" });
    el.createEl("p", {
      cls: "qt-hint",
      text: "Ask for the kind of question you want, use your own notes, or give it a PDF or pasted source. Drafts are shown here first; nothing is written until you confirm.",
    });
    if (!this.plugin.settings.ai.enabled) {
      el.createEl("p", { cls: "qt-hint", text: "Turn on AI features and choose a provider under Settings → MCQ Tracker → AI first. Nothing is sent until you press Generate draft." });
    }
    if (this.error) el.createEl("p", { cls: "qt-error", text: this.error });
    if (this.generated && this.generated.items.length) return this.renderPreview(el);
    if (this.busy) {
      el.createEl("p", { cls: "qt-hint", text: this.busyLabel || `Drafting questions in ${this.language}…` });
      return;
    }
    if (this.prepared) return this.renderEstimate(el);

    const sourceField = el.createDiv({ cls: "qt-field" });
    sourceField.createEl("label", { text: "Where should the questions come from?" });
    const source = sourceField.createEl("select", { cls: "qt-select", attr: { "aria-label": "Question source" } });
    for (const option of SOURCE_OPTIONS) source.createEl("option", { value: option.id, text: option.label });
    source.value = this.sourceMode;
    source.addEventListener("change", () => {
      this.sourceMode = source.value;
      this.error = "";
      this.render();
    });
    sourceField.createDiv({ cls: "qt-hint", text: sourceOption(this.sourceMode).hint });

    const briefField = el.createDiv({ cls: "qt-field" });
    briefField.createEl("label", { text: this.sourceMode === "prompt" ? "Question brief (required)" : "Question brief (optional)" });
    const brief = briefField.createEl("textarea", {
      attr: {
        placeholder: "e.g. 10 SAT-style reading questions on social science, medium difficulty, four choices",
        "aria-label": "Question brief",
        rows: "2",
        maxlength: String(MAX_BRIEF_CHARS),
      },
    });
    brief.value = this.brief;
    brief.addEventListener("input", () => (this.brief = brief.value));
    briefField.createDiv({
      cls: "qt-hint",
      text: "Name the subject, level, exam style, difficulty or source preference. Examples: “hard IB biology questions on membranes” or “US History questions in a document-based style”.",
    });

    if (this.sourceMode === "notes") {
      const folders = el.createDiv({ cls: "qt-field" });
      folders.createEl("label", { text: "Source folders (comma-separated; blank means the whole vault)" });
      const folderInput = folders.createEl("input", { type: "text", attr: { placeholder: "Lectures, Notes/Bio", "aria-label": "Source folders" } });
      folderInput.value = this.folderText;
      folderInput.addEventListener("input", () => (this.folderText = folderInput.value));
    }

    if (this.sourceMode === "pdfs") this.renderPdfPicker(el);
    if (this.sourceMode === "paste") this.renderPasteBox(el);

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
      text: "Questions are original and may be wrong. A blind answer check runs before you see the list, and you can untick anything before Create questions.",
    });
    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const go = actions.createEl("button", { text: "Generate draft", cls: "mod-cta qt-grow" });
    go.disabled = !this.plugin.settings.ai.enabled;
    go.addEventListener("click", () => this.prepare());
  }

  renderPdfPicker(el) {
    const pdfs = this.app.vault.getFiles().filter((file) => /\.pdf$/i.test(file.path || file.name || ""));
    const field = el.createDiv({ cls: "qt-field" });
    field.createEl("label", { text: `Source PDFs (up to ${MAX_PDF_SOURCES})` });
    const select = field.createEl("select", { cls: "qt-select", attr: { "aria-label": "Add a source PDF" } });
    select.createEl("option", { value: "", text: pdfs.length ? "Choose a PDF…" : "No PDFs in this vault" });
    for (const file of pdfs.slice(0, 100)) select.createEl("option", { value: file.path, text: file.path });
    select.addEventListener("change", () => {
      const path = select.value;
      if (!path) return;
      if (this.pdfPaths.includes(path)) {
        this.error = "That PDF is already selected.";
      } else if (this.pdfPaths.length >= MAX_PDF_SOURCES) {
        this.error = `Choose at most ${MAX_PDF_SOURCES} PDFs.`;
      } else {
        this.pdfPaths.push(path);
        this.error = "";
      }
      this.render();
    });
    if (this.pdfPaths.length) {
      const list = field.createDiv({ cls: "qt-imp-list" });
      for (const path of this.pdfPaths) {
        const row = list.createDiv({ cls: "qt-row" });
        row.createSpan({ cls: "qt-grow", text: path });
        const remove = row.createEl("button", { text: "Remove", attr: { "aria-label": `Remove ${path}` } });
        remove.addEventListener("click", () => {
          this.pdfPaths = this.pdfPaths.filter((item) => item !== path);
          this.error = "";
          this.render();
        });
      }
    } else {
      field.createDiv({ cls: "qt-hint", text: "No PDF chosen yet. Add one, or choose another source above." });
    }
    field.createDiv({ cls: "qt-hint", text: "Reads up to 40 pages from each PDF, locally. The text is sent only when you press Send request." });
  }

  renderPasteBox(el) {
    const field = el.createDiv({ cls: "qt-field" });
    field.createEl("label", { text: "Source text" });
    const box = field.createEl("textarea", {
      attr: {
        placeholder: "Paste a textbook section, article, study guide or your own notes…",
        "aria-label": "Source text",
        rows: "7",
        maxlength: String(MAX_PASTE_CHARS),
      },
    });
    box.value = this.pasteText;
    box.addEventListener("input", () => (this.pasteText = box.value));
    field.createDiv({ cls: "qt-hint", text: `Up to ${MAX_PASTE_CHARS.toLocaleString()} characters. The text is not saved to settings.` });
  }

  renderEstimate(el) {
    const p = this.prepared;
    const est = p.estimate || {};
    el.createEl("h4", { text: "Ready to send" });
    el.createDiv({
      cls: "qt-hint",
      text: `Model: ${p.model || "not configured"} · ${sourceSummary(p.source)}. No request has been sent yet.`,
    });
    const skipped = skippedPdfDetail(p.source);
    if (skipped) el.createDiv({ cls: "qt-hint", text: skipped });
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
    el.createDiv({ cls: "qt-hint", text: `Drafted from ${sourceSummary(g.source)} in ${g.language}. Nothing was written yet.` });
    const skipped = skippedPdfDetail(g.source);
    if (skipped) el.createDiv({ cls: "qt-hint", text: skipped });
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
    this.error = "";
    if (this.sourceMode === "prompt" && !str(this.brief).trim()) {
      this.error = "Write a question brief first, for example “10 SAT-style reading questions on social science”.";
      this.render();
      return;
    }
    if (this.sourceMode === "pdfs" && !this.pdfPaths.length) {
      this.error = `Choose at least one PDF, or switch to another source.`;
      this.render();
      return;
    }
    if (this.sourceMode === "paste" && !str(this.pasteText).trim()) {
      this.error = "Paste some source text first, or switch to another source.";
      this.render();
      return;
    }
    this.busy = true;
    this.busyLabel = "Preparing the request…";
    this.prepared = null;
    this.render();
    try {
      const config = normalizeQuizGenerator({
        sourceMode: this.sourceMode,
        folders: this.folderText.split(","),
        count: this.count,
        language: this.language,
        brief: this.brief,
        types: this.types,
        pdfPaths: this.pdfPaths,
      });
      this.plugin.settings.quizGenerator = config;
      await this.plugin.save();
      this.prepared = await this.plugin.prepareQuizGeneration({ ...config, paste: this.pasteText });
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
      if (!this.generated.items.length) this.error = "The AI returned no usable questions. Try a different brief, source or fewer types.";
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
        summary: "Question finder",
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

module.exports = { QuizGeneratorModal, sourceSummary };
