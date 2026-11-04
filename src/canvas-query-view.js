"use strict";
/*
 * The read-only query-group report window. Parsing, matching and the fit stay in
 * canvas-query.js; this only draws the report it is given.
 */
const { Modal } = require("obsidian");

class QueryGroupsModal extends Modal {
  constructor(app, report) {
    super(app);
    this.report = report || { groups: [], stats: {}, summary: "" };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qt-query-groups");
    contentEl.createEl("h3", { text: "Query groups" });
    contentEl.createEl("p", { cls: "setting-item-description", text: this.report.summary });
    if (!this.report.groups.length) {
      contentEl.createDiv({ cls: "qt-hint", text: "This board has no query group." });
    }
    for (const group of this.report.groups) {
      const section = contentEl.createDiv({ cls: "qt-query-group" });
      section.createEl("h4", { text: group.label + " — " + group.members.length + " match" + (group.members.length === 1 ? "" : "es") });
      if (group.terms.length) {
        section.createDiv({ cls: "qt-query-terms", text: "Looking for: " + group.terms.join(", ") });
      }
      if (group.message) section.createDiv({ cls: "qt-hint", text: group.message });
      if (group.members.length) {
        const list = section.createEl("ul", { cls: "qt-query-members" });
        for (const member of group.members) list.createEl("li", { text: member });
        if (group.dropped) {
          section.createDiv({ cls: "qt-hint", text: group.dropped + " more match" + (group.dropped === 1 ? "" : "es") + " beyond the member limit." });
        }
      }
      if (group.strayCount) {
        const loose = section.createDiv({ cls: "qt-query-strays" });
        loose.createEl("h5", { text: "Inside but not matching (" + group.strayCount + ")" });
        const list = loose.createEl("ul", { cls: "qt-query-members" });
        for (const stray of group.strays) list.createEl("li", { text: stray });
        loose.createDiv({ cls: "qt-hint", text: "These cards stay exactly where they are." });
      }
      if (group.fit) {
        section.createDiv({
          cls: "qt-query-fit",
          text: "Frame: " + group.fit.width + " × " + group.fit.height + " at " + group.fit.x + ", " + group.fit.y,
        });
      }
    }
    const hint = contentEl.createDiv({
      cls: "qt-hint",
      text: "Applying fits each group frame around its matches; no card is moved.",
    });
    hint.addClass("qt-query-hint");
    const done = contentEl.createEl("button", { text: "Done", cls: "qt-done" });
    done.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { QueryGroupsModal };
