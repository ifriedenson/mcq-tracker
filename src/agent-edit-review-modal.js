"use strict";
const { Modal, Notice } = require("obsidian");
const { summarize } = require("./agent-edit-review");

const STATUS_LABELS = {
  added: "New note",
  modified: "Changed",
  deleted: "Deleted",
};

class AgentEditReviewModal extends Modal {
  constructor(app, plugin, changes, onDone) {
    super(app);
    this.plugin = plugin;
    this.changes = Array.isArray(changes) ? changes : [];
    this.onDone = onDone;
    this.applying = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qt-agent-review");
    contentEl.createEl("h3", { text: "Review agent edits" });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text:
        "OpenCode's edits are paused and have been removed from your notes. Nothing is saved until you press Apply selected. " +
        "Close this window or choose Discard to keep the notes unchanged.",
    });
    const summary = summarize(this.changes);
    contentEl.createEl("p", {
      cls: "qt-hint",
      text: `${summary.total} note${summary.total === 1 ? "" : "s"} changed: ${summary.added} added, ${summary.modified} modified, ${summary.deleted} deleted.`,
    });

    this.boxes = new Map();
    for (const change of this.changes) {
      const wrap = contentEl.createDiv({ cls: "qt-agent-file" });
      const head = wrap.createDiv({ cls: "qt-agent-file-head" });
      const check = head.createEl("input", { type: "checkbox", attr: { "aria-label": `Apply ${change.path}` } });
      check.checked = true;
      this.boxes.set(change.path, check);
      const label = head.createSpan({ cls: "qt-agent-file-name", text: change.path });
      label.title = change.path;
      head.createSpan({ cls: `qt-agent-status is-${change.status}`, text: STATUS_LABELS[change.status] || change.status });
      const counts = change.diff.added || change.diff.removed ? ` +${change.diff.added} -${change.diff.removed}` : "";
      if (counts) head.createSpan({ cls: "qt-agent-count", text: counts.trim() });

      const details = wrap.createEl("details", { cls: "qt-agent-details" });
      details.createEl("summary", { text: change.diff.lines.length ? "Show diff" : "No text changes" });
      if (change.diff.lines.length) {
        const pre = details.createEl("pre", { cls: "qt-agent-diff" });
        for (const line of change.diff.lines) {
          const row = pre.createDiv({ cls: `qt-diff-${line.kind}` });
          const marker = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
          row.setText(`${marker}${line.text === "" ? " " : line.text}`);
        }
      }
    }

    const row = contentEl.createDiv({ cls: "qt-row" });
    const discard = row.createEl("button", { text: "Discard all", cls: "qt-grow" });
    discard.addEventListener("click", () => this.close());
    const apply = row.createEl("button", { text: "Apply selected", cls: "mod-cta qt-grow" });
    apply.addEventListener("click", () => this.apply());
    this.applyButton = apply;
  }

  selectedPaths() {
    const out = [];
    for (const [path, box] of this.boxes || []) if (box && box.checked) out.push(path);
    return out;
  }

  async apply() {
    if (this.applying || !this.plugin || typeof this.plugin.applyAgentEdits !== "function") return;
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
      const result = await this.plugin.applyAgentEdits(this.changes, paths);
      const applied = (result && result.applied) || [];
      const conflicts = (result && result.conflicts) || [];
      if (applied.length) {
        new Notice(
          `Applied agent edits to ${applied.length} note${applied.length === 1 ? "" : "s"}. Use "AI: undo the last agent edits" to reverse them.`,
          8000
        );
      }
      if (conflicts.length) {
        new Notice(
          `Skipped ${conflicts.length} note${conflicts.length === 1 ? "" : "s"} because they changed after the agent finished. Apply them again if you still want them.`,
          10000
        );
      }
      if (this.onDone) this.onDone(result);
      this.close();
    } catch (e) {
      if (this.applyButton) {
        this.applyButton.disabled = false;
        this.applyButton.setText("Apply selected");
      }
      new Notice(`Could not apply the agent edits: ${e && e.message ? e.message : e}`, 10000);
    } finally {
      this.applying = false;
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  AgentEditReviewModal,
};
