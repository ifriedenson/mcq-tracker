"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");

/**
 * Preview before writing: detects a transcript note, generates cards or
 * questions with the configured AI (or extracts cards from headings locally),
 * then writes only what the learner confirms.
 */
class TranscriptPracticeModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.path = str(this.options.path).trim();
    this.info = null;
    this.error = "";
    this.generated = null;
    this.busy = false;
    this.mode = "cards";
    this.count = 8;
    this.deck = "";
    this.folder = "";
  }

  async onOpen() {
    this.modalEl.addClass("qt-transcript-modal");
    await this.load();
  }

  async load() {
    try {
      this.info = await this.plugin.inspectTranscript(this.path);
      this.deck = str(this.info.course).trim() || str(this.info.title).trim() || this.plugin.settings.cards.defaultDeck || "Lecture";
      this.folder = str(this.plugin.settings.questionFolder).trim() || "Questions";
      this.mode = this.plugin.settings.ai.enabled ? "cards" : "local";
      this.count = this.mode === "questions" ? 5 : 8;
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not read this note.";
    }
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Practice from this lecture" });
    if (this.error) {
      el.createEl("p", { cls: "qt-error", text: this.error });
      if (!this.info) {
        el.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
        return;
      }
    }
    if (!this.info) {
      el.createEl("p", { cls: "qt-hint", text: "Reading the note..." });
      return;
    }
    if (!this.info.isTranscript) {
      el.createEl("p", {
        cls: "qt-hint",
        text: "This note has no transcript markers. You can still use it if it holds a lecture recording or a long talk.",
      });
    }
    const meta = el.createDiv({ cls: "qt-transcript-meta" });
    meta.createDiv({ cls: "qt-transcript-title", text: this.info.title });
    meta.createDiv({
      cls: "qt-hint",
      text: [this.info.course, `${this.info.chars.toLocaleString()} characters`].filter(Boolean).join(" · "),
    });

    if (this.generated && this.generated.items.length) return this.renderPreview(el);
    if (this.busy) {
      el.createEl("p", { cls: "qt-hint", text: "Reading the transcript and drafting study items..." });
      return;
    }

    const ai = !!this.plugin.settings.ai.enabled;
    const canQuestions = ai && !this.plugin.moduleOff("mcq");
    const canCards = !this.plugin.moduleOff("cards");
    const modeWrap = el.createDiv({ cls: "qt-field" });
    modeWrap.createEl("label", { text: "What should it make?" });
    const mode = modeWrap.createEl("select", { cls: "qt-select" });
    mode.createEl("option", { value: "cards", text: ai ? "Flashcards (AI)" : "Flashcards from headings (no AI)" });
    mode.createEl("option", {
      value: "questions",
      text: canQuestions ? "Multiple-choice questions (AI)" : "Multiple-choice questions (AI and MCQ Tracker are required)",
    });
    mode.createEl("option", { value: "local", text: "Flashcards from headings (no AI)" });
    mode.value = this.mode;
    mode.addEventListener("change", () => {
      this.mode = mode.value;
      if (this.mode === "questions") this.count = 5;
      this.render();
    });

    const countWrap = el.createDiv({ cls: "qt-field" });
    countWrap.createEl("label", { text: "How many?" });
    const count = countWrap.createEl("select", { cls: "qt-select" });
    for (const n of [5, 8, 10, 12, 15, 20]) count.createEl("option", { value: String(n), text: `${n} items` });
    count.value = String(this.count);
    count.addEventListener("change", () => (this.count = Number(count.value)));

    if (this.mode === "cards" || this.mode === "local") {
      const deckWrap = el.createDiv({ cls: "qt-field" });
      deckWrap.createEl("label", { text: "Deck" });
      const deck = deckWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. Biology" } });
      deck.value = this.deck;
      deck.addEventListener("input", () => (this.deck = deck.value));
    } else {
      const folderWrap = el.createDiv({ cls: "qt-field" });
      folderWrap.createEl("label", { text: "Question folder" });
      const folder = folderWrap.createEl("input", { type: "text", attr: { placeholder: "Questions" } });
      folder.value = this.folder;
      folder.addEventListener("input", () => (this.folder = folder.value));
    }

    el.createDiv({
      cls: "qt-hint",
      text:
        this.mode === "local"
          ? "This reads headings, definition lines, tables and cloze marks already in the note. It sends nothing anywhere."
          : "This sends the transcript text to your configured AI provider. Review the draft before anything is written.",
    });
    el.createDiv({
      cls: "qt-hint",
      text: "Generated items keep a source_note link back to this note. AI-written answers are marked as AI-generated.",
    });

    const row = el.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    cancel.addEventListener("click", () => this.close());
    const go = row.createEl("button", {
      text: this.mode === "questions" ? "Draft questions" : "Draft cards",
      cls: "mod-cta qt-grow",
    });
    go.disabled = (this.mode === "questions" && !canQuestions) || (this.mode !== "questions" && !canCards);
    go.addEventListener("click", () => this.generate());
  }

  renderPreview(el) {
    const g = this.generated;
    el.createEl("h4", { text: `Ready to write ${g.items.length} ${g.kind === "questions" ? "question" : "card"}${g.items.length === 1 ? "" : "s"}` });
    if (g.errors && g.errors.length) el.createEl("p", { cls: "qt-error", text: g.errors[0] });
    const list = el.createEl("ul", { cls: "qt-extract-preview" });
    for (const item of g.items.slice(0, 20)) {
      list.createEl("li", {
        text: g.kind === "questions" ? `${item.question} (answer ${item.answer})` : `${item.front} → ${item.back}`,
      });
    }
    if (g.items.length > 20) el.createEl("p", { cls: "qt-hint", text: `…and ${g.items.length - 20} more.` });
    const row = el.createDiv({ cls: "qt-row" });
    const back = row.createEl("button", { text: "Back", cls: "qt-grow" });
    back.addEventListener("click", () => {
      this.generated = null;
      this.render();
    });
    const write = row.createEl("button", { text: "Create these", cls: "mod-cta qt-grow" });
    write.addEventListener("click", () => this.write());
  }

  async generate() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.render();
    try {
      const kind = this.mode === "questions" ? "questions" : "cards";
      const result = await this.plugin.generateTranscriptPractice(this.path, {
        kind,
        count: this.count,
        local: this.mode === "local",
        force: !this.info.isTranscript,
      });
      this.generated = result;
      if (!result.items.length) {
        this.error = result.errors && result.errors.length ? result.errors[0] : "No usable study items were found in this note.";
      }
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not generate practice items.";
    }
    this.busy = false;
    this.render();
  }

  async write() {
    if (this.busy || !this.generated) return;
    this.busy = true;
    this.render();
    try {
      const result = await this.plugin.writeTranscriptPractice(this.generated, {
        deck: this.deck,
        folder: this.folder,
      });
      const made = result.created || 0;
      new Notice(made ? `Created ${made} ${this.generated.kind === "questions" ? "question" : "card"}${made === 1 ? "" : "s"}.` : "Nothing new was written.", 6000);
      this.close();
      this.onDone(result);
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not write the generated items.";
      this.busy = false;
      this.render();
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { TranscriptPracticeModal };
