"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");
const { parseMaskRows } = require("./cards");

/** Create one card per mask on an already-saved vault image. */
class ImageOcclusionModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    const p = this.plugin;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Image occlusion" });
    contentEl.createDiv({
      cls: "setting-item-description",
      text: "Use an image already in your vault. Each mask becomes its own card, sharing the same diagram and prompt, so every mask has its own review history.",
    });

    const deckWrap = contentEl.createDiv({ cls: "qt-field" });
    deckWrap.createEl("label", { text: "Deck" });
    const deck = deckWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. Biology" } });
    deck.value = str(this.options.deck || p.settings.cards.defaultDeck || "General").trim();

    const courseWrap = contentEl.createDiv({ cls: "qt-field" });
    courseWrap.createEl("label", { text: "Course (optional)" });
    const course = courseWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. BIOL 201" } });
    course.value = str(this.options.course).trim();

    const imageWrap = contentEl.createDiv({ cls: "qt-field" });
    imageWrap.createEl("label", { text: "Image path" });
    const image = imageWrap.createEl("input", {
      type: "text",
      attr: { placeholder: "diagrams/cell.png or ![[cell.png]]" },
    });

    const promptWrap = contentEl.createDiv({ cls: "qt-field" });
    promptWrap.createEl("label", { text: "Prompt" });
    const prompt = promptWrap.createEl("input", {
      type: "text",
      attr: { placeholder: "What is hidden in the highlighted area?" },
    });
    prompt.value = "What is hidden in the highlighted area?";

    const masksWrap = contentEl.createDiv({ cls: "qt-field" });
    masksWrap.createEl("label", { text: "Masks, one per line" });
    const masks = masksWrap.createEl("textarea", {
      attr: {
        rows: "6",
        placeholder: "20, 30, 15, 10, Nucleus\n55, 60, 12, 10, Mitochondrion",
      },
    });
    masksWrap.createDiv({
      cls: "setting-item-description",
      text: "Each line is x, y, width, height, label. Coordinates are percentages of the image, so they resize with it.",
    });

    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const save = row.createEl("button", { text: "Create cards", cls: "mod-cta qt-grow" });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", async () => {
      const imagePath = str(image.value).trim();
      const maskList = parseMaskRows(masks.value);
      if (!imagePath) {
        new Notice("Choose an image in your vault first.");
        return;
      }
      if (!maskList.length) {
        new Notice("Add at least one mask: x, y, width, height, label.");
        return;
      }
      save.disabled = true;
      try {
        const result = await p.createImageOcclusionCards({
          deck: deck.value,
          course: course.value,
          image: imagePath,
          prompt: prompt.value,
          masks: maskList,
        });
        this.close();
        this.onDone(result);
      } catch (e) {
        save.disabled = false;
        new Notice(str(e && e.message) || "Could not create the image occlusion cards.");
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { ImageOcclusionModal };
