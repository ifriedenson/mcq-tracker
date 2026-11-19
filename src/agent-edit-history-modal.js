"use strict";
const { QtModal } = require("./a11y");
const { Notice } = require("obsidian");
const { str } = require("./util");

/*
 * Review and undo agent edits: every applied OpenCode review is journalled
 * with its before text, so any message's edits can be rolled back on their own
 * instead of only the latest one (which also survives a reload this way).
 */
class AgentEditHistoryModal extends QtModal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  records() {
    if (!this.plugin || typeof this.plugin.agentEditHistory !== "function") return [];
    try {
      return this.plugin.agentEditHistory() || [];
    } catch (error) {
      return [];
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qt-agent-review");
    contentEl.createEl("h3", { text: "Agent edit history" });
    contentEl.createDiv({
      cls: "setting-item-description",
      text: "Each entry is one applied review. Undo restores the notes to how they were before that review; notes you edited since are left alone and listed as skipped.",
    });
    this.list(contentEl);
  }

  list(contentEl) {
    const host = contentEl.createDiv({ cls: "qt-agent-history" });
    const records = this.records();
    if (!records.length) {
      host.createDiv({ cls: "qt-hint", text: "No applied agent edits yet. Apply an OpenCode review to start a history." });
      return;
    }
    for (const record of records) {
      const row = host.createDiv({ cls: "qt-agent-file" });
      const head = row.createDiv({ cls: "qt-agent-file-head" });
      head.createSpan({ cls: "qt-agent-file-name", text: `${record.date} · ${record.changes.length} note${record.changes.length === 1 ? "" : "s"}` });
      if (str(record.label).trim()) head.createSpan({ cls: "qt-agent-count", text: str(record.label).trim() });
      const undo = head.createEl("button", { text: "Undo", cls: "qt-link" });
      undo.setAttribute("aria-label", `Undo the agent edits from ${record.date}`);
      undo.addEventListener("click", async () => {
        undo.disabled = true;
        undo.setText("Undoing…");
        try {
          const result = await this.plugin.undoAgentEdit(record.id);
          new Notice(
            result.restored
              ? `Restored ${result.restored} note${result.restored === 1 ? "" : "s"} from ${record.date}${result.skipped ? `; ${result.skipped} skipped (changed since).` : "."}`
              : "Nothing to undo: those notes changed since that review.",
            9000
          );
        } catch (error) {
          new Notice(`Could not undo those edits: ${error && error.message ? error.message : error}`, 10000);
        }
        this.onOpen();
      });
      const paths = row.createDiv({ cls: "qt-agent-proposal-note" });
      paths.setText(record.changes.map((change) => change.path).join(", "));
    }
  }
}

module.exports = { AgentEditHistoryModal };
