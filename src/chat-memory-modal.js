"use strict";
const { Modal } = require("obsidian");
const chatMemory = require("./chat-memory");

/** Add, edit and remove the short facts kept on this device. No network, no files. */
class ChatMemoryModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.render();
  }

  onClose() {
    if (this.contentEl) this.contentEl.empty();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Study agent memory" });
    contentEl.createDiv({
      cls: "qt-hint",
      text: "Short facts saved on this device. Key-like text is redacted before saving. Facts are added to a chat only while Include memory is on.",
    });
    const facts = chatMemory.normalizeFacts(this.plugin.settings.ai.chatMemory);
    if (!facts.length) contentEl.createDiv({ cls: "qt-hint", text: "No saved facts yet." });
    for (const fact of facts) {
      const row = contentEl.createDiv({ cls: "qt-row" });
      const input = row.createEl("input", { type: "text", attr: { "aria-label": "Saved fact" } });
      input.value = fact.text;
      const save = row.createEl("button", { text: "Save" });
      save.addEventListener("click", () => {
        this.plugin.updateMemoryFact(fact.id, input.value);
        this.render();
      });
      const remove = row.createEl("button", { text: "Remove" });
      remove.addEventListener("click", () => {
        this.plugin.removeMemoryFact(fact.id);
        this.render();
      });
    }
    const addRow = contentEl.createDiv({ cls: "qt-row" });
    const addInput = addRow.createEl("input", {
      type: "text",
      attr: { placeholder: "Add a short fact, for example: my exams start in May" },
    });
    const add = addRow.createEl("button", { text: "Add" });
    add.addEventListener("click", () => {
      const result = this.plugin.rememberFact(addInput.value);
      if (result && result.ok) addInput.value = "";
      this.render();
    });
    contentEl.createDiv({
      cls: "qt-hint",
      text: `At most ${chatMemory.MAX_FACTS} facts of ${chatMemory.MAX_FACT} characters each. Nothing leaves this device.`,
    });
  }
}

module.exports = { ChatMemoryModal };
