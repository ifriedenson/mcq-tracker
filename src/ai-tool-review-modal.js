"use strict";
const { Modal, Notice } = require("obsidian");
const { proposalPreview } = require("./ai-tools");

const TOOL_LABELS = {
  create_question: "New practice question",
  create_card: "New flashcard",
  update_section: "Section edit",
};

class AiToolReviewModal extends Modal {
  constructor(app, plugin, proposals) {
    super(app);
    this.plugin = plugin;
    this.proposals = Array.isArray(proposals) ? proposals : [];
    this.boxes = [];
    this.applying = false;
  }

  onOpen() {
    const el = this.contentEl;
    el.empty();
    el.addClass("qt-agent-review");
    el.createEl("h3", { text: "Review Direct AI actions" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "The Direct AI cannot touch your files. These are allow-listed proposals: a new question, a new card or one safe body section. Nothing is written until you press Apply selected.",
    });
    for (const proposal of this.proposals) {
      const box = el.createDiv({ cls: "qt-agent-file" });
      const head = box.createDiv({ cls: "qt-agent-file-head" });
      const check = head.createEl("input", { type: "checkbox", attr: { "aria-label": `Apply ${TOOL_LABELS[proposal.tool] || proposal.tool}` } });
      check.checked = true;
      this.boxes.push({ check, proposal });
      head.createSpan({ cls: "qt-agent-file-name", text: TOOL_LABELS[proposal.tool] || proposal.tool });
      if (proposal.tool === "update_section") head.createSpan({ cls: "qt-hint", text: proposal.path });
      const details = box.createEl("details", { cls: "qt-agent-details", open: "" });
      details.createEl("summary", { text: "Show preview" });
      details.createEl("pre", { cls: "qt-agent-diff", text: proposalPreview(proposal) });
    }
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Discard all", cls: "qt-grow" }).addEventListener("click", () => this.close());
    this.applyButton = row.createEl("button", { text: "Apply selected", cls: "mod-cta qt-grow" });
    this.applyButton.addEventListener("click", () => this.apply());
    this.statusEl = el.createDiv({ cls: "qt-hint" });
  }

  async apply() {
    if (this.applying || !this.plugin || typeof this.plugin.applyByokToolProposals !== "function") return;
    const selected = this.boxes.filter((item) => item.check && item.check.checked).map((item) => item.proposal);
    if (!selected.length) {
      this.close();
      return;
    }
    this.applying = true;
    this.applyButton.disabled = true;
    this.applyButton.setText("Applying...");
    try {
      const result = await this.plugin.applyByokToolProposals(selected);
      if (result.created || result.updated) {
        new Notice(`Applied ${result.created + result.updated} AI action${result.created + result.updated === 1 ? "" : "s"}.`, 7000);
      }
      if (result.errors && result.errors.length) {
        new Notice(`${result.errors.length} action${result.errors.length === 1 ? "" : "s"} could not be applied: ${result.errors[0]}`, 10000);
      }
      this.close();
    } catch (e) {
      this.applyButton.disabled = false;
      this.applyButton.setText("Apply selected");
      if (this.statusEl) this.statusEl.setText(e && e.message ? e.message : String(e));
    } finally {
      this.applying = false;
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  AiToolReviewModal,
};
