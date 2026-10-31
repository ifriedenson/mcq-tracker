"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");

/** Preview and write rule-based cards extracted from one Markdown note. */
class CardExtractModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.path = str(this.options.path).trim();
    this.preview = null;
  }

  async onOpen() {
    const { contentEl } = this;
    const p = this.plugin;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Extract cards from this note" });

    let preview;
    try {
      preview = await p.previewNoteCards(this.path, this.options);
    } catch (e) {
      contentEl.createEl("p", { cls: "qt-error", text: str(e && e.message) || "Could not read this note." });
      return;
    }
    this.preview = preview;
    if (preview.blocked) {
      contentEl.createEl("p", { cls: "setting-item-description", text: preview.reason });
      const row = contentEl.createDiv({ cls: "qt-row" });
      row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
      return;
    }

    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `${preview.cards.length} card${preview.cards.length === 1 ? "" : "s"} ready from ${preview.file.basename}. Nothing is written until you press Extract cards.`,
    });
    if (preview.warnings.length) {
      contentEl.createEl("p", { cls: "qt-hint", text: preview.warnings[0] });
    }

    const deckWrap = contentEl.createDiv({ cls: "qt-field" });
    deckWrap.createEl("label", { text: "Deck" });
    const deck = deckWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. Biology" } });
    deck.value = preview.deck || "";

    const courseWrap = contentEl.createDiv({ cls: "qt-field" });
    courseWrap.createEl("label", { text: "Course tag (optional)" });
    const course = courseWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. BIOL 201" } });
    course.value = preview.course || "";

    const seedWrap = contentEl.createDiv({ cls: "qt-field" });
    seedWrap.createEl("label", { text: "Order seed (optional)" });
    const seedRow = seedWrap.createDiv({ cls: "qt-row" });
    const seed = seedRow.createEl("input", { type: "text", attr: { placeholder: "e.g. midterm-1" } });
    seed.value = preview.seed || "";
    const reorder = seedRow.createEl("button", { text: "Preview seed" });
    seedWrap.createDiv({
      cls: "qt-hint",
      text: "Same note and seed reproduce the same card order. Leave blank to keep the note's order.",
    });
    reorder.addEventListener("click", () => {
      this.close();
      p.openCardExtract(this.path, { ...this.options, seed: seed.value }, this.onDone);
    });

    if (preview.cards.length) {
      const list = contentEl.createEl("ul", { cls: "qt-extract-preview" });
      for (const card of preview.cards.slice(0, 8)) {
        list.createEl("li", {
          text: `${card.front} → ${card.back}${card.cardType === "cloze" ? " (cloze)" : ""}`,
        });
      }
      if (preview.cards.length > 8) {
        contentEl.createEl("p", {
          cls: "qt-hint",
          text: `…and ${preview.cards.length - 8} more.`,
        });
      }
      contentEl.createEl("p", {
        cls: "qt-hint",
        text: preview.flashcards === true
          ? "This note is opted in with `flashcards: true`."
          : "This note has no `flashcards` flag yet; extracting will mark it `flashcards: true` so later bulk extraction can find it.",
      });
    }

    const note = contentEl.createDiv({ cls: "qt-hint" });
    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const go = row.createEl("button", {
      text: `Extract ${preview.cards.length} card${preview.cards.length === 1 ? "" : "s"}`,
      cls: "mod-cta qt-grow",
    });
    if (!preview.cards.length) go.disabled = true;
    cancel.addEventListener("click", () => this.close());
    go.addEventListener("click", async () => {
      go.disabled = true;
      note.setText("Writing cards…");
      try {
        const result = await p.extractCardsFromNote(this.path, {
          deck: deck.value,
          course: course.value,
          seed: seed.value,
        });
        const bits = [`Created ${result.created} card${result.created === 1 ? "" : "s"}`];
        if (result.skipped) bits.push(`${result.skipped} already there`);
        if (result.errors && result.errors.length) bits.push(`${result.errors.length} failed`);
        note.setText(bits.join(" · "));
        new Notice(bits.join(" · "), 6000);
        if (result.created) {
          this.close();
          this.onDone(result);
        } else {
          go.disabled = false;
        }
      } catch (e) {
        go.disabled = false;
        note.setText(str(e && e.message) || "Could not extract cards.");
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { CardExtractModal };
