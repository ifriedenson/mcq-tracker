"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const { readActiveNoteContext } = require("./note-context");
const { CARD_GENERATOR_OUTPUTS, CARD_GENERATOR_SOURCES, CARD_GENERATOR_STYLES, normalizeCardGenerator } = require("./card-generator");

/** Per-command settings and preview for custom-prompt flashcard generation. */
class CardGeneratorModal extends Modal {
  constructor(app, plugin, onDone) {
    super(app);
    this.plugin = plugin;
    this.onDone = onDone || (() => {});
    this.config = normalizeCardGenerator(plugin.settings.cardGenerator);
    this.context = null;
    this.useSelection = false;
    this.deck = this.config.deck || plugin.settings.cards.defaultDeck || "General";
    this.generated = null;
    this.reveal = false;
    this.busy = false;
    this.error = "";
  }

  async onOpen() {
    this.modalEl.addClass("qt-transcript-modal");
    this.context = await readActiveNoteContext(this.app);
    const selection = !!(this.context && this.context.selection);
    this.useSelection = this.config.source === "selection" ? selection : this.config.source === "auto" && selection;
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Generate flashcards from this note" });
    if (!this.context) {
      el.createEl("p", { cls: "qt-hint", text: "Open a Markdown note first. The generator reads only that note or the text you select." });
      el.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
      return;
    }
    if (!this.plugin.settings.ai.enabled) {
      el.createEl("p", { cls: "qt-hint", text: "Turn on AI features and choose a provider under Settings → MCQ Tracker → AI first. Nothing is sent until you press Generate." });
    }
    if (this.error) el.createEl("p", { cls: "qt-error", text: this.error });
    if (this.generated && this.generated.items.length) return this.renderPreview(el);
    if (this.busy) {
      el.createEl("p", { cls: "qt-hint", text: "Drafting flashcards…" });
      return;
    }

    const source = el.createDiv({ cls: "qt-field" });
    source.createEl("label", { text: "Source" });
    const sourceSelect = source.createEl("select", { cls: "qt-select" });
    for (const item of CARD_GENERATOR_SOURCES) {
      if (item.id === "selection" && !this.context.selection) continue;
      sourceSelect.createEl("option", { value: item.id, text: item.label });
    }
    sourceSelect.value = this.useSelection ? "selection" : this.config.source === "auto" && this.context.selection ? "auto" : "note";
    sourceSelect.addEventListener("change", () => {
      this.useSelection = sourceSelect.value === "selection";
      this.config.source = sourceSelect.value;
    });

    const row = el.createDiv({ cls: "qt-row" });
    const countWrap = row.createDiv({ cls: "qt-field qt-grow" });
    countWrap.createEl("label", { text: "How many cards?" });
    const count = countWrap.createEl("select", { cls: "qt-select" });
    for (const n of [3, 5, 8, 10, 12, 15, 20]) count.createEl("option", { value: String(n), text: `${n} cards` });
    count.value = String(this.config.count);
    count.addEventListener("change", () => (this.config.count = Number(count.value)));

    const outputWrap = row.createDiv({ cls: "qt-field qt-grow" });
    outputWrap.createEl("label", { text: "Output" });
    const output = outputWrap.createEl("select", { cls: "qt-select" });
    for (const item of CARD_GENERATOR_OUTPUTS) output.createEl("option", { value: item.id, text: item.label });
    output.value = this.config.output;
    output.addEventListener("change", () => {
      this.config.output = output.value === "insert" ? "insert" : "notes";
      this.render();
    });

    const promptWrap = el.createDiv({ cls: "qt-field" });
    promptWrap.createEl("label", { text: "Extra instruction (optional)" });
    const prompt = promptWrap.createEl("textarea", { cls: "qt-prompt", attr: { placeholder: "Focus on definitions and examples; write one-line answers." } });
    prompt.value = this.config.customPrompt;
    prompt.addEventListener("input", () => (this.config.customPrompt = prompt.value));

    const styleWrap = el.createDiv({ cls: "qt-field" });
    styleWrap.createEl("label", { text: "Card layout" });
    const style = styleWrap.createEl("select", { cls: "qt-select" });
    for (const item of CARD_GENERATOR_STYLES) style.createEl("option", { value: item.id, text: item.label });
    style.value = this.config.style;
    style.addEventListener("change", () => {
      this.config.style = style.value;
      this.config.separator = CARD_GENERATOR_STYLES.find((item) => item.id === style.value).separator;
      this.render();
    });

    const sepWrap = el.createDiv({ cls: "qt-field" });
    sepWrap.createEl("label", { text: "Separator" });
    const separator = sepWrap.createEl("input", { type: "text", attr: { placeholder: "::" } });
    separator.value = this.config.separator;
    separator.addEventListener("input", () => (this.config.separator = separator.value));

    const hideWrap = el.createDiv({ cls: "qt-check" });
    const hide = hideWrap.createEl("input", { type: "checkbox" });
    hide.checked = this.config.hideInPreview;
    hide.addEventListener("change", () => (this.config.hideInPreview = hide.checked));
    hideWrap.createSpan({ text: " Hide the inserted block in reading view (wraps it in %%)" });

    if (this.config.output === "notes") {
      const deckWrap = el.createDiv({ cls: "qt-field" });
      deckWrap.createEl("label", { text: "Deck for the new cards" });
      const deck = deckWrap.createEl("input", { type: "text", attr: { placeholder: "General" } });
      deck.value = this.deck;
      deck.addEventListener("input", () => (this.deck = deck.value));
    }

    el.createDiv({
      cls: "qt-hint",
      text: this.config.output === "insert"
        ? "This appends a block to the open note using the chosen layout. It is not tracked as cards; use Ctrl/Cmd+Z to undo the insertion. Tracking stays opt-in."
        : "This creates ordinary card notes through the existing card importer, with deck, source and AI provenance. Nothing is written until you confirm.",
    });
    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const go = actions.createEl("button", { text: "Generate draft", cls: "mod-cta qt-grow" });
    go.disabled = !this.plugin.settings.ai.enabled;
    go.addEventListener("click", () => this.generate());
  }

  renderPreview(el) {
    const g = this.generated;
    el.createEl("h4", { text: `Ready to ${this.config.output === "insert" ? "insert" : "create"} ${g.items.length} card${g.items.length === 1 ? "" : "s"}` });
    const list = el.createEl("ul", { cls: "qt-extract-preview" });
    for (const card of g.items.slice(0, 20)) {
      list.createEl("li", { text: `${card.front} → ${this.config.hideInPreview && !this.reveal ? "•••" : card.back}` });
    }
    if (g.items.length > 20) el.createEl("p", { cls: "qt-hint", text: `…and ${g.items.length - 20} more.` });
    if (this.config.hideInPreview && !this.reveal) {
      el.createEl("button", { text: "Reveal answers" }).addEventListener("click", () => {
        this.reveal = true;
        this.render();
      });
    }
    el.createDiv({
      cls: "qt-hint",
      text: this.config.output === "insert"
        ? `${g.sourceKind === "selection" ? "Selection" : "Note"}: ${g.sourcePath}. The block uses ${this.config.style} layout and is ${this.config.hideInPreview ? "hidden" : "visible"} in reading view.`
        : `${g.sourceKind === "selection" ? "Selection" : "Note"}: ${g.sourcePath}. Deck: ${this.deck || "General"}.`,
    });
    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => {
      this.generated = null;
      this.render();
    });
    actions.createEl("button", { text: this.config.output === "insert" ? "Insert cards" : "Create cards", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.write());
  }

  async generate() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.render();
    try {
      this.plugin.settings.cardGenerator = normalizeCardGenerator({ ...this.config, deck: this.deck });
      await this.plugin.save();
      this.generated = await this.plugin.generateCardsFromNote({
        ...this.plugin.settings.cardGenerator,
        source: this.useSelection ? "selection" : this.config.source === "note" ? "note" : "auto",
      });
      if (!this.generated.items.length) this.error = "The AI returned no usable cards. Try a different prompt or source.";
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not generate flashcards.";
    }
    this.busy = false;
    this.render();
  }

  async write() {
    if (this.busy || !this.generated) return;
    this.busy = true;
    this.render();
    try {
      if (this.config.output === "insert") {
        const result = await this.plugin.insertGeneratedCards(this.generated, this.config);
        new Notice(`Inserted ${result.inserted} card${result.inserted === 1 ? "" : "s"} at the end of the note. Use Ctrl/Cmd+Z to undo.`, 6000);
        this.close();
        this.onDone(result);
        return;
      }
      const result = await this.plugin.writeTranscriptPractice(this.generated, { deck: this.deck });
      const made = result.created || 0;
      new Notice(made ? `Created ${made} card${made === 1 ? "" : "s"}.` : "Nothing new was written.", 6000);
      this.close();
      this.onDone(result);
    } catch (e) {
      this.error = str(e && e.message ? e.message : e) || "Could not write the generated cards.";
      this.busy = false;
      this.render();
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { CardGeneratorModal };
