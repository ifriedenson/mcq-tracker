"use strict";
const { QtModal } = require("./a11y");
const { Modal } = require("obsidian");

class HotkeyAuditModal extends QtModal {
  constructor(app, report) {
    super(app);
    this.report = report || { available: false, conflicts: [] };
  }

  onOpen() {
    this.modalEl.addClass("qt-hotkey-audit-modal");
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h2", { text: "Hotkey audit" });
    const report = this.report;

    if (!report.available) {
      el.createEl("p", {
        cls: "setting-item-description",
        text: report.reason || "Obsidian's hotkey list is not available in this window.",
      });
      this.renderActions(el);
      return;
    }

    el.createEl("p", {
      cls: "setting-item-description",
      text: "A read-only check of MCQ Tracker's assigned shortcuts against Obsidian's own commands. Nothing is changed.",
    });
    el.createDiv({
      cls: "qt-hotkey-audit-counts",
      text: `${report.pluginBindingCount} MCQ Tracker shortcut${report.pluginBindingCount === 1 ? "" : "s"} checked against ${report.coreBindingCount} assigned Obsidian core shortcut${report.coreBindingCount === 1 ? "" : "s"}.`,
    });

    if (!report.conflicts.length) {
      const clear = el.createDiv({ cls: "qt-hotkey-audit-clear" });
      clear.createEl("strong", { text: "No collisions found." });
      clear.createEl("p", {
        text:
          report.pluginBindingCount === 0
            ? "MCQ Tracker has no assigned shortcuts, so there is nothing to collide with."
            : "Every MCQ Tracker shortcut is distinct from the Obsidian core shortcuts currently assigned on this device.",
      });
      this.renderActions(el);
      return;
    }

    el.createEl("p", {
      cls: "qt-hotkey-audit-summary",
      text: `${report.conflicts.length} shortcut${report.conflicts.length === 1 ? "" : "s"} also used by Obsidian:`,
    });
    const list = el.createDiv({ cls: "qt-hotkey-audit-list" });
    for (const conflict of report.conflicts) {
      const row = list.createDiv({ cls: "qt-hotkey-audit-item" });
      row.createDiv({ cls: "qt-hotkey-audit-key", text: conflict.shortcut });
      const body = row.createDiv({ cls: "qt-hotkey-audit-body" });
      body.createEl("strong", { text: conflict.command.name });
      body.createDiv({ cls: "qt-hotkey-audit-command", text: conflict.command.id });
      body.createDiv({ cls: "qt-hotkey-audit-core-label", text: "Obsidian core:" });
      for (const core of conflict.core) {
        body.createDiv({
          cls: "qt-hotkey-audit-core",
          text: `${core.name} (${core.id})`,
        });
      }
    }
    this.renderActions(el);
  }

  renderActions(el) {
    const actions = el.createDiv({ cls: "qt-hotkey-audit-actions" });
    actions.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
  }
}

module.exports = {
  HotkeyAuditModal,
};
