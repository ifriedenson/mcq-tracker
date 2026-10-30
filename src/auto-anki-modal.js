"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const { readActiveNoteContext } = require("./note-context");
const { normalizeAutoAnki } = require("./auto-anki");

/** Confirm the source and deck, then draft and send the cards in one action. */
class AutoAnkiModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.app = app;
    this.plugin = plugin;
    this.config = normalizeAutoAnki(plugin.settings.autoAnki, plugin.settings.cards.defaultDeck);
    this.context = null;
    this.source = "note";
    this.deck = this.config.deck || plugin.settings.cards.defaultDeck || "General";
    this.busy = false;
    this.error = "";
    this.result = null;
  }

  async onOpen() {
    if (this.modalEl && typeof this.modalEl.addClass === "function") this.modalEl.addClass("qt-auto-anki-modal");
    this.context = await readActiveNoteContext(this.app);
    this.source = this.context && this.context.selection ? "selection" : "note";
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Auto Anki" });
    el.createDiv({
      cls: "qt-hint",
      text: "Draft cards from the open note or selected text with AI, then send them to Anki. Existing cards generated from the same source are reused, not duplicated.",
    });
    if (!this.context) {
      el.createEl("p", { cls: "qt-hint", text: "Open a Markdown note first." });
      el.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
      return;
    }
    if (this.result) return this.renderResult(el);
    if (!this.plugin.settings.ai.enabled) {
      el.createEl("p", { cls: "qt-hint", text: "Turn on AI features under Settings → MCQ Tracker → AI first. Nothing is sent until you press Generate and send." });
    }
    if (!this.plugin.settings.cards.ankiConnect.enabled) {
      el.createEl("p", { cls: "qt-hint", text: "Turn on AnkiConnect under Settings → MCQ Tracker → Cards → Sync first." });
    }
    if (this.error) el.createEl("p", { cls: "qt-error", text: this.error });
    if (this.busy) {
      el.createEl("p", { cls: "qt-hint", text: "Drafting and sending cards…" });
      return;
    }

    const source = el.createDiv({ cls: "qt-field" });
    source.createEl("label", { text: "Source" });
    const select = source.createEl("select", { cls: "qt-select" });
    if (this.context.selection) select.createEl("option", { value: "selection", text: "Selected text" });
    select.createEl("option", { value: "note", text: "Whole note" });
    select.value = this.source;
    select.addEventListener("change", () => {
      this.source = select.value === "selection" ? "selection" : "note";
      this.render();
    });
    const text = this.source === "selection" ? this.context.selection : this.context.text;
    const excerpt = str(text).trim().slice(0, 400);
    el.createEl("p", { cls: "qt-auto-anki-excerpt", text: excerpt || "This source is empty." });

    const row = el.createDiv({ cls: "qt-row" });
    const countWrap = row.createDiv({ cls: "qt-field qt-grow" });
    countWrap.createEl("label", { text: "How many cards?" });
    const count = countWrap.createEl("select", { cls: "qt-select" });
    for (const n of [3, 5, 8, 10, 12, 15, 20]) count.createEl("option", { value: String(n), text: `${n} cards` });
    count.value = String(this.config.count);
    count.addEventListener("change", () => (this.config.count = Number(count.value)));

    const deckWrap = el.createDiv({ cls: "qt-field" });
    deckWrap.createEl("label", { text: "Deck for new cards" });
    const deck = deckWrap.createEl("input", { type: "text", attr: { placeholder: this.plugin.settings.cards.defaultDeck || "General" } });
    deck.value = this.deck;
    deck.addEventListener("input", () => (this.deck = deck.value));

    const actions = el.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    const go = actions.createEl("button", { text: "Generate and send", cls: "mod-cta qt-grow" });
    go.disabled = !this.plugin.settings.ai.enabled || !this.plugin.settings.cards.ankiConnect.enabled || !str(text).trim();
    go.addEventListener("click", () => this.run());
  }

  renderResult(el) {
    const r = this.result;
    const added = r.pushed && Number.isFinite(Number(r.pushed.added)) ? Number(r.pushed.added) : 0;
    const updated = r.pushed && Number.isFinite(Number(r.pushed.updated)) ? Number(r.pushed.updated) : 0;
    el.createEl("h4", { text: r.reused ? "Reused the existing cards" : `Created ${r.created} card${r.created === 1 ? "" : "s"}` });
    el.createEl("p", {
      cls: "qt-hint",
      text: `${r.cards} card${r.cards === 1 ? "" : "s"} from ${r.sourceKind === "selection" ? "the selection" : "the note"} · ${added} added to Anki${updated ? `, ${updated} updated` : ""}.`,
    });
    if (r.pushed && Array.isArray(r.pushed.warnings) && r.pushed.warnings.length) {
      el.createEl("p", { cls: "qt-hint", text: r.pushed.warnings.slice(0, 3).join(" ") });
    }
    el.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
  }

  async run() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    this.render();
    try {
      this.config = normalizeAutoAnki({ ...this.config, deck: this.deck }, this.plugin.settings.cards.defaultDeck);
      this.plugin.settings.autoAnki = this.config;
      await this.plugin.save();
      this.result = await this.plugin.runAutoAnki({
        source: this.source,
        count: this.config.count,
        deck: this.config.deck,
      });
      new Notice(
        this.result.reused
          ? `Reused ${this.result.cards} existing card${this.result.cards === 1 ? "" : "s"} and sent them to Anki.`
          : `Created ${this.result.created} card${this.result.created === 1 ? "" : "s"} and sent them to Anki.`,
        6000
      );
      this.busy = false;
      this.plugin.refreshViews();
      this.render();
    } catch (e) {
      this.busy = false;
      this.error = str(e && e.message ? e.message : e) || "Could not send the cards to Anki.";
      this.render();
    }
  }

  onClose() {
    if (this.contentEl) this.contentEl.empty();
  }
}

module.exports = { AutoAnkiModal };
