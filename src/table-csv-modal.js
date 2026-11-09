"use strict";
/*
 * CSV export dialog for one table. It matches the upstream plugin's switch:
 * the header row can be left out of the copy. The text comes from the parsed
 * table, never from the note, so opening or copying never writes the note.
 */
const { Modal, Notice } = require("obsidian");
const tableEditor = require("./table-editor");
const { str } = require("./util");

class TableCsvModal extends Modal {
  constructor(app, table, onCopy) {
    super(app);
    this.table = table;
    this.includeHeader = true;
    this.useTabs = false;
    this.onCopy = typeof onCopy === "function" ? onCopy : null;
    this.copies = 0;
  }

  /** The CSV for the current header choice, or "" when the table is gone. */
  csv() {
    const result = tableEditor.tableCsvFromTable(this.table, {
      header: this.includeHeader,
      delimiter: this.useTabs ? "\t" : ",",
    });
    return result.ok ? result.csv : "";
  }

  onOpen() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h2", { text: "Export table as CSV" });
    const label = el.createEl("label", { cls: "qt-table-csv-toggle" });
    const checkbox = label.createEl("input", { attr: { "aria-label": "Include table headers" } });
    checkbox.type = "checkbox";
    checkbox.checked = this.includeHeader;
    label.createSpan({ text: "Include table headers" });
    const tabLabel = el.createEl("label", { cls: "qt-table-csv-toggle" });
    const tabCheckbox = tabLabel.createEl("input");
    tabCheckbox.type = "checkbox";
    tabCheckbox.checked = this.useTabs;
    tabLabel.createSpan({ text: "Separate with tabs" });
    const area = el.createEl("textarea", { cls: "qt-table-csv-text" });
    area.setAttribute("aria-label", "CSV output");
    area.readOnly = true;
    area.value = this.csv();
    const render = () => {
      this.includeHeader = checkbox.checked === true;
      this.useTabs = tabCheckbox.checked === true;
      area.value = this.csv();
    };
    if (typeof checkbox.addEventListener === "function") checkbox.addEventListener("change", render);
    if (typeof tabCheckbox.addEventListener === "function") tabCheckbox.addEventListener("change", render);
    const actions = el.createDiv({ cls: "qt-table-csv-actions" });
    const copy = actions.createEl("button", { cls: "mod-cta", text: "Copy CSV" });
    copy.setAttribute("type", "button");
    if (typeof copy.addEventListener === "function") copy.addEventListener("click", () => this.copy());
    this.area = area;
    this.checkbox = checkbox;
    this.tabCheckbox = tabCheckbox;
  }

  /** Copies the current CSV to the clipboard; the dialog stays open. */
  async copy() {
    const csv = this.csv();
    if (!csv) {
      new Notice("The table is no longer available.");
      return { ok: false, reason: "table" };
    }
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
    if (!clipboard || typeof clipboard.writeText !== "function") {
      new Notice("Clipboard access is unavailable.");
      return { ok: false, reason: "clipboard", message: "Clipboard access is unavailable." };
    }
    try {
      await clipboard.writeText(csv);
    } catch (e) {
      new Notice(`Could not copy the table as CSV: ${str(e && e.message ? e.message : e)}`);
      return { ok: false, reason: "clipboard", message: "Could not copy the table as CSV." };
    }
    this.copies += 1;
    if (this.onCopy) this.onCopy(csv, this.includeHeader);
    new Notice(this.includeHeader ? "Table copied as CSV with its header row." : "Table copied as CSV without its header row.");
    return { ok: true, csv, header: this.includeHeader };
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { TableCsvModal };
