"use strict";
const { Modal, Notice } = require("obsidian");
const { str } = require("./util");

class StudyStatusModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.items = [];
    this.query = "";
    this.course = "all";
    this.listEl = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("qt-status-modal");
    contentEl.createEl("h3", { text: "Known and excluded items" });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "Known items return to the due queue when their snooze ends. Excluded items stay in your vault but are skipped by practice, Quick Practice, timed tests and the due queue.",
    });

    this.items = this.plugin.studyStatusItems();
    if (!this.items.length) {
      contentEl.createDiv({
        cls: "qt-hint",
        text: "Nothing is marked Known or Excluded right now. Use the buttons on a practice or card review screen to hide something.",
      });
      this.addDone(contentEl);
      return;
    }

    const controls = contentEl.createDiv({ cls: "qt-status-controls" });
    const search = controls.createEl("input", {
      type: "search",
      cls: "qt-status-search",
      placeholder: "Search title, course, deck or type",
    });
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderRows();
    });

    const courses = [...new Set(this.items.map((item) => str(item.course).trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    if (courses.length > 1) {
      const select = controls.createEl("select", { cls: "dropdown qt-status-course" });
      const all = select.createEl("option", { text: "All courses" });
      all.value = "all";
      for (const course of courses) {
        const option = select.createEl("option", { text: course });
        option.value = course;
      }
      select.value = this.course;
      select.addEventListener("change", () => {
        this.course = select.value;
        this.renderRows();
      });
    }

    this.listEl = contentEl.createDiv({ cls: "qt-status-groups" });
    this.renderRows();
    this.addDone(contentEl);
  }

  addDone(container) {
    const done = container.createEl("button", { text: "Done", cls: "qt-done" });
    done.addEventListener("click", () => this.close());
  }

  renderRows() {
    if (!this.listEl) return;
    this.listEl.empty();
    const query = this.query.trim().toLowerCase();
    const course = this.course;
    const visible = this.items.filter((item) => {
      if (course !== "all" && str(item.course) !== course) return false;
      if (!query) return true;
      return [item.title, item.type, item.course, item.deck, item.meta, item.summary]
        .map((value) => str(value).toLowerCase())
        .some((value) => value.includes(query));
    });

    if (!visible.length) {
      this.listEl.createDiv({ cls: "qt-hint", text: "No hidden items match that search or course." });
      return;
    }

    for (const [status, label] of [
      ["excluded", "Excluded"],
      ["known", "Known"],
    ]) {
      const rows = visible.filter((item) => item.status === status);
      if (!rows.length) continue;
      this.listEl.createEl("h4", { text: `${label} (${rows.length})` });
      const list = this.listEl.createDiv({ cls: "qt-status-list" });
      for (const item of rows) {
        const row = list.createDiv({ cls: `qt-status-row qt-status-${status}` });
        const main = row.createDiv({ cls: "qt-status-main" });
        main.createDiv({ cls: "qt-status-title", text: str(item.title) });
        const bits = [item.type, item.meta, item.summary].filter(Boolean);
        main.createDiv({ cls: "qt-status-meta", text: bits.join(" · ") });

        const open = row.createEl("button", { text: "Open", cls: "qt-link" });
        open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(item.file));

        const restore = row.createEl("button", { text: "Restore", cls: "mod-cta" });
        restore.addEventListener("click", () => this.restore(item, restore));
      }
    }
  }

  async restore(item, button) {
    if (!item || !item.file) return;
    if (button) button.disabled = true;
    try {
      await this.plugin.setStudyStatus(item.file, "active");
      new Notice(`${str(item.title) || "Item"} is back in practice.`);
      this.items = this.plugin.studyStatusItems();
      if (!this.items.length) {
        this.onOpen();
        return;
      }
      this.course = "all";
      this.renderRows();
    } catch (e) {
      if (button) button.disabled = false;
      new Notice(str(e && e.message) || "Could not restore that item.");
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { StudyStatusModal };
