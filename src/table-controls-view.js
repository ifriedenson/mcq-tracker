"use strict";
/*
 * The docked table controls panel, mirroring the upstream plugin's sidebar.
 * Every button calls the plugin's own action runner, so the panel writes
 * through exactly the same path as the command palette and the table toolbar.
 */
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_TABLE_CONTROLS } = require("./constants");
const { str } = require("./util");

/** Button groups, in the upstream order (Align, Move, Edit, Sort, More). */
const TABLE_CONTROL_GROUPS = [
  {
    label: "Align",
    actions: [
      ["tables-align-left", "Left"],
      ["tables-align-center", "Center"],
      ["tables-align-right", "Right"],
    ],
  },
  {
    label: "Move",
    actions: [
      ["tables-move-row-down", "Row ↓"],
      ["tables-move-row-up", "Row ↑"],
      ["tables-move-column-right", "Column →"],
      ["tables-move-column-left", "Column ←"],
      ["tables-transpose", "Transpose"],
    ],
  },
  {
    label: "Edit",
    actions: [
      ["tables-insert-row-above", "Row above"],
      ["tables-insert-row-below", "Row below"],
      ["tables-insert-column-left", "Column left"],
      ["tables-insert-column-right", "Column right"],
      ["tables-delete-row", "Delete row"],
      ["tables-delete-column", "Delete column"],
    ],
  },
  {
    label: "Sort and formulas",
    actions: [
      ["tables-sort-asc", "Sort ↑"],
      ["tables-sort-desc", "Sort ↓"],
      ["tables-formulas", "Σ formulas"],
    ],
  },
  {
    label: "More",
    actions: [
      ["tables-format", "Format table"],
      ["tables-export-csv", "CSV"],
      ["tables-escape", "Leave table"],
    ],
  },
];

class TableControlsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_TABLE_CONTROLS;
  }

  getDisplayText() {
    return "Advanced Tables";
  }

  getIcon() {
    return "table";
  }

  async onOpen() {
    this.draw();
  }

  /** Rebuilds the panel and its status line from the cursor's table. */
  draw() {
    const container = this.containerEl && this.containerEl.children ? this.containerEl.children[1] || this.containerEl : this.containerEl;
    if (!container || typeof container.empty !== "function") return null;
    container.empty();
    const root = container.createDiv({ cls: "qt-table-controls" });
    root.createEl("h4", { cls: "qt-table-controls-title", text: "Advanced Tables" });
    const context = this.plugin && typeof this.plugin.activeTableContext === "function" ? this.plugin.activeTableContext() : null;
    const status = root.createEl("p", { cls: "qt-table-controls-status" });
    status.setText(
      context
        ? `In a table: ${context.table.rows.length} rows × ${context.table.columns} columns.`
        : "Put the cursor in a table, then use these buttons."
    );
    for (const group of TABLE_CONTROL_GROUPS) {
      const row = root.createDiv({ cls: "qt-table-controls-row" });
      row.createSpan({ cls: "qt-table-controls-label", text: group.label });
      const buttons = row.createDiv({ cls: "qt-table-controls-buttons" });
      for (const entry of group.actions) {
        const id = entry[0];
        const label = entry[1];
        const button = buttons.createEl("button", { cls: "qt-table-controls-button", text: label });
        button.setAttribute("type", "button");
        button.setAttribute("aria-label", label);
        button.setAttribute("data-qt-table-command", id);
        if (typeof button.addEventListener === "function") {
          button.addEventListener("click", () => {
            let pending = null;
            try {
              pending = this.plugin.runTableAction(id);
            } catch (error) {
              new Notice(str(error && error.message ? error.message : error) || "The table action failed.");
              return;
            }
            Promise.resolve(pending)
              .then((value) => {
                if (value && value.ok === false && value.message) new Notice(value.message);
                this.draw();
              })
              .catch((error) => new Notice(str(error && error.message ? error.message : error) || "The table action failed."));
          });
        }
      }
    }
    return root;
  }
}

module.exports = { TABLE_CONTROL_GROUPS, TableControlsView };
