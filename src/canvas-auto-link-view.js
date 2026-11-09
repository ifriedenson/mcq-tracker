"use strict";
const { QtModal } = require("./a11y");
/*
 * The read-only auto-link report window. Matching and writing stay in
 * canvas-auto-link.js; this only draws the report it is given.
 */
const { Modal } = require("obsidian");

class LinkReportModal extends QtModal {
  constructor(app, report) {
    super(app);
    this.report = report || { proposals: [], skipped: { existing: [], self: [], ambiguous: [], unresolved: [] }, summary: "" };
  }

  section(parent, title, rows, render) {
    const wrap = parent.createDiv({ cls: "qt-link-section" });
    wrap.createEl("h4", { text: title + " (" + rows.length + ")" });
    if (!rows.length) {
      wrap.createDiv({ cls: "qt-hint", text: "Nothing here." });
      return;
    }
    const list = wrap.createEl("ul", { cls: "qt-link-rows" });
    for (const row of rows) list.createEl("li", { text: render(row) });
  }

  onOpen() {
    const { contentEl } = this;
    const skipped = this.report.skipped || { existing: [], self: [], ambiguous: [], unresolved: [] };
    contentEl.empty();
    contentEl.addClass("qt-link-modal");
    contentEl.createEl("h3", { text: "Proposed canvas links" });
    contentEl.createEl("p", { cls: "setting-item-description", text: this.report.summary });

    this.section(contentEl, "Proposed", this.report.proposals, (row) => row.fromLabel + " → " + row.toLabel + " (" + row.reason + ")");
    this.section(contentEl, "Ambiguous, not linked", skipped.ambiguous, (row) =>
      row.fromLabel + " mentions \"" + row.title + "\" but " + row.candidates.join(" and ") + " share that title"
    );
    this.section(contentEl, "Unresolved links", skipped.unresolved, (row) => row.fromLabel + " links [[" + row.title + "]] but nothing on the board matches it");
    this.section(contentEl, "Already linked", skipped.existing, (row) => row.fromLabel + " → " + row.toLabel);
    this.section(contentEl, "Linked to itself", skipped.self, (row) => row.fromLabel + " ([" + row.title + "])");

    if (!this.report.proposals.length) {
      contentEl.createDiv({ cls: "qt-hint", text: "Apply the Canvas auto-link command to write the proposals that are listed." });
    }
    const done = contentEl.createEl("button", { text: "Done", cls: "qt-done" });
    done.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { LinkReportModal };
