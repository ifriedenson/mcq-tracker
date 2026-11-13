"use strict";
const { QtModal } = require("./a11y");
const { Notice } = require("obsidian");

/** The larger end-of-batch summary: every file, every skipped note, and one practice action. */
class ImportCompleteModal extends QtModal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    this.opts = options || {};
    this.busy = false;
  }

  onOpen() {
    if (this.modalEl && typeof this.modalEl.addClass === "function") this.modalEl.addClass("qt-import-complete-modal");
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const results = Array.isArray(this.opts.results) ? this.opts.results : [];
    const folder = String(this.opts.folder || "").trim();
    const made = results.reduce((sum, row) => sum + (Number(row.made) || 0), 0);
    const failed = results.filter((row) => row.error).length;
    const stopped = !!this.opts.cancelled;
    const undo = !!this.opts.undo;
    const removed = Number(this.opts.removed) || 0;
    const filesWithNotes = results.filter((row) => Number(row.made) > 0).length;

    const root = el.createDiv({ cls: "qt-import-complete" });
    root.createEl("h3", {
      text: undo ? "Import undone" : stopped ? "Import stopped" : failed ? "Import finished with problems" : "Import complete",
    });
    const failureText = failed ? ` ${failed} file${failed === 1 ? "" : "s"} failed.` : "";
    root.createEl("p", {
      cls: "qt-import-complete-summary",
      text: undo
        ? `Undo removed ${removed} file${removed === 1 ? "" : "s"} from this import. No imported notes were kept.`
        : (made > 0
          ? `${made} question note${made === 1 ? "" : "s"} imported from ${filesWithNotes} file${filesWithNotes === 1 ? "" : "s"}.`
          : "No question notes were imported.") + failureText,
    });
    if (this.opts.stoppedAfterCurrent) {
      root.createEl("p", { cls: "qt-hint", text: "The current file finished. The remaining files were not started." });
    }
    if (folder && !undo) root.createEl("p", { cls: "qt-hint", text: `Saved under ${folder}.` });

    if (results.length) {
      const list = root.createDiv({ cls: "qt-import-complete-list" });
      for (const row of results) {
        const item = list.createDiv({ cls: "qt-import-complete-row" });
        item.createSpan({ cls: "qt-import-complete-name", text: row.name || "File" });
        const state = row.error
          ? "Could not import"
          : undo && Number(row.made) > 0
            ? "Removed by Undo"
            : Number(row.made) > 0
              ? `${row.made} note${Number(row.made) === 1 ? "" : "s"}`
              : Array.isArray(row.skipped) && row.skipped.length
                ? "Stopped"
                : "No questions found";
        item.createSpan({ cls: row.error ? "qt-import-complete-state is-error" : "qt-import-complete-state", text: state });
        // The state label alone never explains why a file produced nothing;
        // keep the per-file reason in the summary so a batch failure is actionable.
        if (row.error) item.createDiv({ cls: "qt-import-complete-detail", text: String(row.error) });
        else if (Array.isArray(row.skipped) && row.skipped.length) {
          for (const reason of row.skipped.slice(0, 5)) {
            item.createDiv({ cls: "qt-import-complete-detail", text: String(reason) });
          }
        }
      }
    }

    // A lost-contact failure tells the user to press this, so it has to be
    // here: one press says whether OpenCode is running and restarts it.
    const openCodeTrouble = results.some((row) => /OpenCode/i.test(String(row.error || "")));
    this.checkEl = null;
    if (openCodeTrouble) {
      const check = root.createEl("button", { text: "Check OpenCode", cls: "qt-grow" });
      check.addEventListener("click", () => this.checkOpenCode(check));
      this.checkEl = root.createDiv({ cls: "qt-hint" });
    }

    const row = root.createDiv({ cls: "qt-row qt-import-complete-actions" });
    if (made > 0 && folder && !undo) {
      const practice = row.createEl("button", { text: "Practice these questions", cls: "mod-cta qt-grow" });
      practice.addEventListener("click", () => this.practice(practice, folder, made));
    }
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
  }

  async checkOpenCode(button) {
    if (this.busy) return;
    if (!this.plugin || typeof this.plugin.checkOpenCodeServer !== "function") {
      new Notice("OpenCode cannot be checked from this window. Run the command Check that OpenCode is running.", 10000);
      return;
    }
    this.busy = true;
    if (button) {
      button.setDisabled(true);
      button.setText("Checking...");
    }
    if (this.checkEl) this.checkEl.setText("Checking whether OpenCode is running...");
    try {
      const status = await this.plugin.checkOpenCodeServer();
      if (this.checkEl) this.checkEl.setText(String(status && status.text ? status.text : "OpenCode did not answer the check."));
      if (button) button.setText(status && status.running ? "OpenCode is running" : "Check OpenCode again");
    } catch (e) {
      if (this.checkEl) this.checkEl.setText(`OpenCode could not be checked: ${String(e && e.message ? e.message : e)}`);
    } finally {
      this.busy = false;
      if (button) button.setDisabled(false);
    }
  }

  async practice(button, folder, made) {
    if (this.busy) return;
    if (!this.plugin || typeof this.plugin.practiceFolder !== "function") {
      new Notice("Practice is not available right now.", 7000);
      return;
    }
    this.busy = true;
    if (button) {
      button.disabled = true;
      button.setText("Opening practice...");
    }
    try {
      await this.plugin.practiceFolder(folder, made);
      this.close();
    } catch (e) {
      this.busy = false;
      if (button) {
        button.disabled = false;
        button.setText("Practice these questions");
      }
      new Notice(`Could not start practice: ${e && e.message ? e.message : e}`, 8000);
    }
  }
}

module.exports = { ImportCompleteModal };
