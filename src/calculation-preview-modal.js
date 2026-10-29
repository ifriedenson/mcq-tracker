"use strict";
const { Modal, Notice } = require("obsidian");

const STATUS_LABELS = {
  match: "Agrees",
  mismatch: "Disagrees",
  error: "Could not check",
  review: "Needs review",
};

function displayValue(value) {
  if (value === undefined || value === null || value === "") return "(empty)";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

class CalculationPreviewModal extends Modal {
  constructor(app, plugin, preview) {
    super(app);
    this.plugin = plugin;
    this.preview = preview || { items: [] };
    this.applying = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qt-agent-review");
    contentEl.createEl("h3", { text: "Review calculation checks" });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text:
        "Nothing has been written yet. The plugin compared each note's stored numeric answer with its calculation or answer formula. " +
        "Tick the notes you want to update, then apply the check results.",
    });
    const p = this.preview;
    contentEl.createEl("p", {
      cls: "qt-hint",
      text:
        `${p.checked || 0} checked · ${p.items.length} to update · ${p.unchanged || 0} already up to date` +
        `${p.mismatched ? ` · ${p.mismatched} disagree` : ""}${p.errors ? ` · ${p.errors} could not be checked` : ""}`,
    });

    this.boxes = new Map();
    for (const item of p.items || []) {
      const wrap = contentEl.createDiv({ cls: "qt-agent-file" });
      const head = wrap.createDiv({ cls: "qt-agent-file-head" });
      const box = head.createEl("input", { type: "checkbox", attr: { "aria-label": `Apply ${item.path}` } });
      box.checked = true;
      this.boxes.set(item.path, box);
      const name = head.createSpan({ cls: "qt-agent-file-name", text: item.path });
      name.title = item.path;
      head.createSpan({ cls: `qt-agent-status is-${item.status}`, text: STATUS_LABELS[item.status] || item.status });
      if (item.result && item.result.reason) {
        wrap.createDiv({ cls: "qt-hint", text: item.result.reason });
      }
      const list = wrap.createDiv({ cls: "qt-calc-changes" });
      for (const change of item.changes || []) {
        list.createDiv({
          cls: "qt-calc-change",
          text: `${change.key}: ${displayValue(change.before)} → ${displayValue(change.after)}`,
        });
      }
    }

    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    cancel.addEventListener("click", () => this.close());
    const apply = row.createEl("button", { text: "Apply checked", cls: "mod-cta qt-grow" });
    apply.addEventListener("click", () => this.apply());
    this.applyButton = apply;
  }

  selectedPaths() {
    const out = [];
    for (const [path, box] of this.boxes || []) if (box && box.checked) out.push(path);
    return out;
  }

  async apply() {
    if (this.applying || !this.plugin || typeof this.plugin.applyCalculationPreview !== "function") return;
    const paths = this.selectedPaths();
    if (!paths.length) {
      this.close();
      return;
    }
    this.applying = true;
    if (this.applyButton) {
      this.applyButton.disabled = true;
      this.applyButton.setText("Applying...");
    }
    try {
      const result = await this.plugin.applyCalculationPreview(this.preview.items, paths);
      const applied = (result && result.applied) || [];
      const conflicts = (result && result.conflicts) || [];
      const failed = (result && result.failed) || [];
      if (applied.length) {
        new Notice(`Updated calculation checks in ${applied.length} note${applied.length === 1 ? "" : "s"}.`, 7000);
      }
      if (conflicts.length) {
        new Notice(`Skipped ${conflicts.length} note${conflicts.length === 1 ? "" : "s"} that changed during review.`, 9000);
      }
      if (failed.length) {
        new Notice(`Could not update ${failed.length} note${failed.length === 1 ? "" : "s"}.`, 9000);
      }
      this.close();
    } catch (e) {
      if (this.applyButton) {
        this.applyButton.disabled = false;
        this.applyButton.setText("Apply checked");
      }
      new Notice(`Could not apply the calculation checks: ${e && e.message ? e.message : e}`, 10000);
    } finally {
      this.applying = false;
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  CalculationPreviewModal,
};
