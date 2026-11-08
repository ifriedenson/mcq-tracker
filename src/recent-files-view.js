"use strict";
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_RECENT_FILES } = require("./constants");
const recentFiles = require("./recent-files");

/*
 * Recent Files view. Obsidian already knows the last opened files, so this
 * view reuses `workspace.getLastOpenFiles()` and adds local pinning, search
 * and a folder path. It does not maintain a second history.
 */
class RecentFilesView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.query = "";
    this.pinnedOnly = false;
  }

  getViewType() {
    return VIEW_TYPE_RECENT_FILES;
  }

  getDisplayText() {
    return "Recent files";
  }

  getIcon() {
    return "history";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
  }

  settings() {
    return recentFiles.normalizeRecentFiles(this.plugin && this.plugin.settings ? this.plugin.settings.recentFiles : null);
  }

  /** Obsidian's own recents first; a vault mtime sort is the fallback. */
  paths() {
    const app = this.app || {};
    const workspace = app.workspace || {};
    if (typeof workspace.getLastOpenFiles === "function") {
      const list = workspace.getLastOpenFiles();
      if (Array.isArray(list) && list.length) return list.slice();
    }
    const files = app.vault && typeof app.vault.getMarkdownFiles === "function" ? app.vault.getMarkdownFiles() : [];
    return files
      .slice()
      .sort((a, b) => {
        const am = Number(a && a.stat && a.stat.mtime) || 0;
        const bm = Number(b && b.stat && b.stat.mtime) || 0;
        return bm - am || String(a.path).localeCompare(String(b.path));
      })
      .map((file) => file.path);
  }

  info() {
    const app = this.app || {};
    const files = app.vault && typeof app.vault.getMarkdownFiles === "function" ? app.vault.getMarkdownFiles() : [];
    const map = {};
    for (const file of files) {
      const stat = file && file.stat ? file.stat : {};
      map[file.path] = { mtime: Number(stat.mtime) || 0, size: Number(stat.size) || 0 };
    }
    return map;
  }

  render() {
    if (!this.contentEl) return;
    this.contentEl.empty();
    this.contentEl.addClass("qt-recent");
    const head = this.contentEl.createDiv({ cls: "qt-recent-head" });
    head.createEl("h3", { text: "Recent files" });
    head.createEl("button", { text: "Refresh", cls: "qt-recent-refresh" }).addEventListener("click", () => this.render());

    const controls = this.contentEl.createDiv({ cls: "qt-recent-controls" });
    const search = controls.createEl("input", {
      cls: "qt-recent-search",
      attr: { type: "search", placeholder: "Filter recent files", "aria-label": "Filter recent files" },
    });
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderRows(list, rows);
    });
    const pinFilter = controls.createEl("button", {
      cls: `qt-recent-filter${this.pinnedOnly ? " mod-cta" : ""}`,
      text: this.pinnedOnly ? "Pinned only" : "Show pinned",
    });
    pinFilter.addEventListener("click", () => {
      this.pinnedOnly = !this.pinnedOnly;
      this.render();
    });

    const rows = recentFiles.recentRows(this.paths(), this.info(), {
      pinned: this.settings().pinned,
      limit: this.settings().limit,
      now: Date.now(),
    });
    const list = this.contentEl.createDiv({ cls: "qt-recent-list" });
    this.renderRows(list, rows);
    this.contentEl.createDiv({
      cls: "qt-recent-note",
      text: "Recent order comes from Obsidian. Pins and the search filter are local; no note is copied or modified.",
    });
  }

  renderRows(list, rows) {
    if (!list) return;
    list.empty();
    const visible = recentFiles.filterRecentRows(rows, this.query, this.pinnedOnly);
    if (!visible.length) {
      list.createDiv({
        cls: "qt-recent-empty",
        text: this.pinnedOnly ? "No pinned files yet." : this.query ? "No recent file matches that filter." : "Open a note and it will appear here.",
      });
      return;
    }
    for (const row of visible) {
      const item = list.createDiv({ cls: `qt-recent-row${row.pinned ? " is-pinned" : ""}` });
      const open = item.createEl("button", { cls: "qt-recent-open" });
      open.createSpan({ cls: "qt-recent-name", text: row.name });
      open.createSpan({ cls: "qt-recent-path", text: row.folder || "Vault root" });
      const meta = item.createDiv({ cls: "qt-recent-meta" });
      if (row.relative) meta.createSpan({ cls: "qt-recent-age", text: row.relative });
      const pin = item.createEl("button", {
        cls: "qt-recent-pin",
        text: row.pinned ? "Unpin" : "Pin",
        attr: { "aria-label": `${row.pinned ? "Unpin" : "Pin"} ${row.name}` },
      });
      open.addEventListener("click", () => this.open(row.path));
      pin.addEventListener("click", () => this.togglePin(row.path));
    }
  }

  open(path) {
    const app = this.app || {};
    const file = app.vault && typeof app.vault.getAbstractFileByPath === "function" ? app.vault.getAbstractFileByPath(path) : null;
    if (!file) {
      new Notice(`Could not find ${path}.`);
      return;
    }
    const leaf = app.workspace && typeof app.workspace.getLeaf === "function" ? app.workspace.getLeaf("tab") : null;
    if (!leaf || typeof leaf.openFile !== "function") {
      new Notice("This Obsidian build cannot open that file from the recent list.");
      return;
    }
    leaf.openFile(file);
  }

  togglePin(path) {
    const settings = this.settings();
    const pinned = recentFiles.togglePinned(settings.pinned, path, settings.limit);
    if (this.plugin && typeof this.plugin.updateRecentFiles === "function") {
      this.plugin.updateRecentFiles({ pinned });
    } else if (this.plugin && this.plugin.settings) {
      this.plugin.settings.recentFiles = { ...settings, pinned };
    }
    this.render();
  }
}

module.exports = { RecentFilesView };
