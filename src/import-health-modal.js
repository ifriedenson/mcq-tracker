"use strict";
const { QtModal } = require("./a11y");
const { Notice, Setting } = require("obsidian");

/*
 * Import health: a moved or deleted PDF leaves question notes pointing at a path
 * that no longer exists. This lists the missing sources and re-links them to a
 * file that is in the vault, so nothing has to be re-imported.
 */
class ImportHealthModal extends QtModal {
  constructor(app, plugin, report) {
    super(app);
    this.plugin = plugin;
    this.report = report || { missing: [], unstamped: 0, healthy: 0 };
    this.busy = false;
  }

  onOpen() {
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Import folder health" });
    const missing = Array.isArray(this.report.missing) ? this.report.missing : [];
    el.createEl("p", {
      cls: "qt-hint",
      text: missing.length
        ? "These source files are no longer where the notes say. Re-link one to a file in your vault; the notes keep their history and nothing is re-imported."
        : "Every stamped source file is present.",
    });

    const vaultFiles = (this.app.vault.getFiles ? this.app.vault.getFiles() : [])
      .filter((file) => /\.(pdf|docx?|pptx?|md)$/i.test(file.path || ""))
      .map((file) => file.path)
      .sort();
    const picker = new Setting(el)
      .setName("Re-link to")
      .setDesc(vaultFiles.length ? "Choose the file these notes should point at." : "No PDF, Word, PowerPoint or Markdown file is in this vault yet.");
    let target = vaultFiles[0] || "";
    picker.addDropdown((drop) => {
      if (!vaultFiles.length) drop.addOption("", "No file available");
      for (const path of vaultFiles.slice(0, 500)) drop.addOption(path, path);
      drop.setValue(target).onChange((value) => {
        target = value;
      });
    });

    for (const row of missing) {
      const box = el.createDiv({ cls: "qt-import-health-row" });
      box.createDiv({ cls: "qt-import-health-source", text: row.source });
      box.createDiv({
        cls: "qt-hint",
        text: `${row.count} note${row.count === 1 ? " points" : "s point"} here`,
      });
      const relink = box.createEl("button", { text: "Re-link", cls: "qt-link" });
      relink.disabled = !target;
      relink.addEventListener("click", () => this.relink(relink, row.source, target));
    }

    if (this.report.unstamped) {
      el.createEl("p", {
        cls: "qt-hint",
        text: `${this.report.unstamped} note${this.report.unstamped === 1 ? " has" : "s have"} no source file stamped at all. That is normal for hand-written notes.`,
      });
    }

    el.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
  }

  async relink(button, source, target) {
    if (this.busy) return;
    this.busy = true;
    if (button) {
      button.disabled = true;
      button.setText("Re-linking...");
    }
    try {
      const n = await this.plugin.relinkImportSource(source, target);
      new Notice(n ? `Re-linked ${n} note${n === 1 ? "" : "s"} to ${target}.` : "No note needed re-linking.", 8000);
      this.close();
    } catch (e) {
      this.busy = false;
      if (button) {
        button.disabled = false;
        button.setText("Re-link");
      }
      new Notice(`Could not re-link: ${e && e.message ? e.message : e}`, 8000);
    }
  }
}

module.exports = { ImportHealthModal };
