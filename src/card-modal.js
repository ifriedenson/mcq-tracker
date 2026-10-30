"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const { CARD_TYPES } = require("./cards");

/** Create a basic, reversed, cloze, or vocabulary note in a chosen deck. */
class CardModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.kind = this.options.kind === "vocab" ? "vocab" : "card";
    this.deck = str(this.options.deck || plugin.settings.cards.defaultDeck).trim();
    this.course = str(this.options.course).trim();
    this.sourceNote = str(this.options.sourceNote).trim();
    this.sourceHeading = str(this.options.sourceHeading).trim();
    this.sourceQuote = str(this.options.sourceQuote).trim();
    this.sourceContext = str(this.options.sourceContext).trim();
    this.initialFront = str(this.options.front);
    this.initialBack = str(this.options.back);
    this.deckFolder = "";
    this.deckCourse = "";
  }

  onOpen() {
    const { contentEl } = this;
    const p = this.plugin;
    contentEl.empty();
    contentEl.createEl("h3", { text: this.sourceQuote ? "New source-anchored recall" : "New card" });

    const kindWrap = contentEl.createDiv({ cls: "qt-field" });
    kindWrap.createEl("label", { text: "Type" });
    const kind = kindWrap.createEl("select", { cls: "dropdown" });
    kind.createEl("option", { text: "Flashcard", value: "card" });
    kind.createEl("option", { text: "Vocabulary", value: "vocab" });
    kind.value = this.kind;

    const typeWrap = contentEl.createDiv({ cls: "qt-field" });
    typeWrap.createEl("label", { text: "Card style" });
    const typeSel = typeWrap.createEl("select", { cls: "dropdown" });
    cardTypeOptions(typeSel);
    typeSel.value = "basic";
    this.cardType = "basic";
    typeSel.addEventListener("change", () => {
      this.cardType = typeSel.value;
      if (typeof updatePreview === "function") updatePreview();
    });

    const deckWrap = contentEl.createDiv({ cls: "qt-field" });
    deckWrap.createEl("label", { text: "Deck" });
    const deck = deckWrap.createEl("select", { cls: "dropdown" });
    const decks = p.cardDecks().map((d) => d.name);
    // Keep the preferred/default deck selectable even before it has a note or
    // a saved deck entry.
    if (this.deck && !decks.includes(this.deck)) decks.unshift(this.deck);
    for (const name of decks) deck.createEl("option", { text: name, value: name });
    deck.createEl("option", { text: "New deck…", value: "__new" });
    if (decks.includes(this.deck)) deck.value = this.deck;

    const newDeckWrap = contentEl.createDiv({ cls: "qt-field qt-hidden" });
    newDeckWrap.createEl("label", { text: "New deck name" });
    const newDeck = newDeckWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. Spanish verbs" } });
    newDeckWrap.createEl("label", { text: "Deck folder (optional)" });
    const newDeckFolder = newDeckWrap.createEl("input", {
      type: "text",
      attr: { placeholder: "Defaults to Cards/<deck name>" },
    });
    newDeckWrap.createEl("label", { text: "Deck course (optional)" });
    const newDeckCourse = newDeckWrap.createEl("input", {
      type: "text",
      attr: { placeholder: "e.g. BIOL 201" },
    });
    newDeckWrap.createDiv({
      cls: "qt-hint",
      text: "The deck and its folder/course settings are saved automatically with the first card.",
    });

    const courseWrap = contentEl.createDiv({ cls: "qt-field" });
    courseWrap.createEl("label", { text: "Course (optional)" });
    const course = courseWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. BIOL 201" } });
    course.value = this.course;

    const schedulerWrap = contentEl.createDiv({ cls: "qt-field" });
    schedulerWrap.createEl("label", { text: "Scheduler (optional)" });
    const scheduler = schedulerWrap.createEl("select", { cls: "dropdown" });
    scheduler.createEl("option", { text: "Use deck or global scheduler", value: "" });
    scheduler.createEl("option", { text: "Simple ladder (Leitner)", value: "ladder" });
    scheduler.createEl("option", { text: "SM-2", value: "sm2" });
    scheduler.createEl("option", { text: "FSRS", value: "fsrs" });

    if (this.sourceQuote) {
      const anchor = contentEl.createDiv({ cls: "qt-source-anchor" });
      anchor.createDiv({ cls: "qt-source-anchor-label", text: "Source anchor" });
      anchor.createEl("blockquote", { cls: "qt-source-anchor-quote", text: this.sourceQuote });
      const where = [this.sourceNote, this.sourceHeading].filter(Boolean).join(" · ");
      if (where) anchor.createDiv({ cls: "qt-hint", text: where });
      anchor.createDiv({
        cls: "qt-hint",
        text: "The selected passage is stored as the anchor and prefilled as the answer. Edit either side before saving.",
      });
    }

    const frontWrap = contentEl.createDiv({ cls: "qt-field" });
    const frontLabel = frontWrap.createEl("label", { text: "Front" });
    const front = frontWrap.createEl("textarea", { attr: { rows: "3", placeholder: "What should the card ask?" } });
    front.value = this.initialFront;

    const backWrap = contentEl.createDiv({ cls: "qt-field" });
    const backLabel = backWrap.createEl("label", { text: "Back" });
    const back = backWrap.createEl("textarea", { attr: { rows: "3", placeholder: "The answer" } });
    back.value = this.initialBack;

    const expectationWrap = contentEl.createDiv({ cls: "qt-field" });
    expectationWrap.createEl("label", { text: "What each side expects (optional)" });
    const expectations = expectationWrap.createDiv({ cls: "qt-row" });
    const frontExpectation = expectations.createEl("input", {
      type: "text",
      attr: { placeholder: "Front expectation, e.g. capital city" },
    });
    const backExpectation = expectations.createEl("input", {
      type: "text",
      attr: { placeholder: "Back expectation, e.g. country" },
    });

    const previewWrap = contentEl.createDiv({ cls: "qt-field" });
    previewWrap.createEl("label", { text: "Live preview" });
    const preview = previewWrap.createEl("pre", { cls: "qt-card-preview" });
    const updatePreview = () => {
      preview.setText(cardPreview({ front: front.value, back: back.value, cardType: this.cardType, kind: this.kind }));
    };

    const exampleWrap = contentEl.createDiv({ cls: "qt-field qt-hidden" });
    exampleWrap.createEl("label", { text: "Example sentence (optional)" });
    const example = exampleWrap.createEl("textarea", { attr: { rows: "2" } });

    const metaWrap = contentDiv(contentEl, "qt-field qt-hidden");
    metaWrap.createEl("label", { text: "Part of speech and language (optional)" });
    const meta = metaWrap.createDiv({ cls: "qt-row" });
    const pos = meta.createEl("input", { type: "text", attr: { placeholder: "noun" } });
    const language = meta.createEl("input", { type: "text", attr: { placeholder: "Spanish" } });

    const applyKind = () => {
      const vocab = this.kind === "vocab";
      frontLabel.setText(vocab ? "Term" : "Front");
      backLabel.setText(vocab ? "Definition" : "Back");
      exampleWrap.toggleClass("qt-hidden", !vocab);
      metaWrap.toggleClass("qt-hidden", !vocab);
      typeWrap.toggleClass("qt-hidden", vocab);
      front.placeholder = vocab ? "The word" : this.cardType === "cloze" ? "The capital of France is ==Paris==." : "What should the card ask?";
    };
    kind.addEventListener("change", () => {
      this.kind = kind.value;
      applyKind();
      updatePreview();
    });
    const applyDeck = () => {
      const isNew = deck.value === "__new";
      newDeckWrap.toggleClass("qt-hidden", !isNew);
      const cfg = p.cardDecks().find((d) => d.name === deck.value);
      if (cfg && cfg.course) course.value = cfg.course;
    };
    deck.addEventListener("change", applyDeck);
    front.addEventListener("input", updatePreview);
    back.addEventListener("input", updatePreview);
    applyKind();
    applyDeck();
    updatePreview();

    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const save = row.createEl("button", { text: "Create card", cls: "mod-cta qt-grow" });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", async () => {
      if (!str(front.value).trim() || !str(back.value).trim()) {
        new Notice("A card needs both sides filled in.");
        return;
      }
      let deckName = deck.value;
      if (deckName === "__new") deckName = str(newDeck.value).trim();
      if (!deckName) deckName = str(p.settings.cards.defaultDeck).trim() || "General";
      save.disabled = true;
      try {
        const result = await p.createCard({
          kind: this.kind,
          cardType: this.cardType,
          deck: deckName,
          deckFolder: newDeckFolder.value,
          deckCourse: newDeckCourse.value,
          course: course.value || newDeckCourse.value,
          scheduler: scheduler.value,
          front: front.value,
          back: back.value,
          example: example.value,
          frontExpectation: frontExpectation.value,
          backExpectation: backExpectation.value,
          partOfSpeech: pos.value,
          language: language.value,
          sourceNote: this.sourceNote,
          sourceHeading: this.sourceHeading,
          sourceQuote: this.sourceQuote,
          sourceContext: this.sourceContext,
        });
        this.close();
        this.onDone(result);
      } catch (e) {
        save.disabled = false;
        new Notice(str(e && e.message) || "Could not create the card.");
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** A small, dependency-free preview of the note the dialog will create. */
function cardPreview(input) {
  const data = input || {};
  const front = str(data.front).trim() || "(front)";
  const back = str(data.back).trim() || "(back)";
  if (data.kind === "vocab") return `**Term**\n\n${front}\n\n**Definition**\n\n${back}`;
  if (data.cardType === "cloze") return `**Cloze**\n\n${front}\n\n> The back is used for the answer side.`;
  const reverse = data.cardType === "reversed" ? "\n\n**Also reviewed in reverse**" : "";
  return `**Front**\n\n${front}\n\n---\n\n**Back**\n\n${back}${reverse}`;
}

function contentDiv(parent, cls) {
  return parent.createDiv({ cls });
}

/** A basic/reversed/cloze picker shown after the kind is chosen. */
function cardTypeOptions(select) {
  for (const type of CARD_TYPES) {
    // Image occlusion needs an image and mask fields, so it has its own dialog.
    if (type === "image-occlusion") continue;
    select.createEl("option", { text: type[0].toUpperCase() + type.slice(1), value: type });
  }
}

module.exports = { CardModal, cardPreview, cardTypeOptions };
