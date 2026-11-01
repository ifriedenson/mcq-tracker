"use strict";
/* Review calendar: due-date grid and next-7-day workload. */
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_REVIEW_CALENDAR } = require("./constants");
const { calendarCells, workloadLabel } = require("./review-calendar");
const { localDate, str } = require("./util");

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

class ReviewCalendarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.cursor = new Date();
    this.selected = "";
  }

  getViewType() {
    return VIEW_TYPE_REVIEW_CALENDAR;
  }

  getDisplayText() {
    return "Review calendar";
  }

  getIcon() {
    return "calendar-clock";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.selected = localDate();
    this.render();
  }

  async onClose() {}

  settings() {
    return this.plugin.reviewCalendarSettings();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-review-calendar" });
    if (!this.plugin.reviewCalendarEnabled()) {
      this.renderOff(root);
      return;
    }
    const snapshot = this.plugin.reviewCalendarSnapshot({ days: 400 });
    const today = snapshot.today;
    if (!this.selected || !/^\d{4}-\d{2}-\d{2}$/.test(this.selected)) this.selected = today;
    const head = root.createDiv({ cls: "qt-review-calendar-head" });
    head.createEl("h2", { text: "Review calendar" });
    head.createDiv({ cls: "qt-hint", text: "Due whole notes and cards from their own next_review properties. Separate from classes and exams." });

    const stats = root.createDiv({ cls: "qt-review-calendar-stats" });
    const stat = (value, label) => {
      const card = stats.createDiv({ cls: "qt-study-stat" });
      card.createDiv({ cls: "qt-study-stat-value", text: String(value) });
      card.createDiv({ cls: "qt-study-stat-label", text: label });
    };
    stat(snapshot.totals.notes, "notes due");
    stat(snapshot.totals.cards, "cards due");
    stat(snapshot.next7.total, "next 7 days");
    stat(workloadLabel(snapshot.next7.minutes), "estimated work");

    const actions = root.createDiv({ cls: "qt-row qt-review-calendar-actions" });
    actions.createEl("button", { text: "Add this note", cls: "mod-cta" }).addEventListener("click", () => this.addNote());
    actions.createEl("button", { text: "Add this folder" }).addEventListener("click", () => this.addFolder());
    actions.createEl("button", { text: "Previous month" }).addEventListener("click", () => this.shiftMonth(-1));
    actions.createEl("button", { text: "Today" }).addEventListener("click", () => this.goToday());
    actions.createEl("button", { text: "Next month" }).addEventListener("click", () => this.shiftMonth(1));

    this.renderWorkload(root, snapshot);
    this.renderMonth(root, snapshot);
    this.renderSelected(root, snapshot);
  }

  renderOff(root) {
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Review calendar is off" });
    card.createDiv({ cls: "qt-onboard-text", text: "Turn it on in Settings → Review calendar." });
    card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
  }

  renderWorkload(root, snapshot) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Next 7 days" });
    const row = card.createDiv({ cls: "qt-review-calendar-week" });
    for (const day of snapshot.next7.days) {
      const cell = row.createDiv({ cls: "qt-review-calendar-day" });
      if (day.date === snapshot.today) cell.addClass("is-today");
      cell.createDiv({ cls: "qt-review-calendar-day-label", text: day.date.slice(5) });
      cell.createDiv({ cls: "qt-review-calendar-day-count", text: String(day.total) });
      cell.createDiv({ cls: "qt-review-calendar-day-minutes", text: workloadLabel(day.minutes) });
      cell.addEventListener("click", () => {
        this.selected = day.date;
        this.render();
      });
    }
  }

  renderMonth(root, snapshot) {
    const settings = this.settings();
    const card = root.createDiv({ cls: "qt-study-card" });
    const title = card.createDiv({ cls: "qt-review-calendar-month-title" });
    title.createEl("h3", { text: `${MONTHS[this.cursor.getMonth()]} ${this.cursor.getFullYear()}` });
    const grid = card.createDiv({ cls: "qt-review-calendar-grid" });
    const labels = settings.weekStartsOn === "sunday" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : WEEK_LABELS;
    for (const label of labels) grid.createDiv({ cls: "qt-review-calendar-weekday", text: label });
    for (const cell of calendarCells(snapshot, this.cursor.getFullYear(), this.cursor.getMonth(), settings.weekStartsOn, new Date())) {
      const day = grid.createDiv({ cls: "qt-review-calendar-cell" });
      if (!cell.inMonth) day.addClass("is-other-month");
      if (cell.isToday) day.addClass("is-today");
      if (cell.key === this.selected) day.addClass("is-selected");
      day.createDiv({ cls: "qt-review-calendar-cell-day", text: String(cell.day) });
      if (cell.total) day.createDiv({ cls: "qt-review-calendar-cell-count", text: `${cell.total}` });
      day.addEventListener("click", () => {
        this.selected = cell.key;
        this.render();
      });
    }
  }

  renderSelected(root, snapshot) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: this.selected });
    const day = (snapshot.days || []).find((item) => item.date === this.selected);
    if (!day || !day.total) {
      card.createDiv({ cls: "qt-study-empty", text: "No notes or cards due on this day." });
      return;
    }
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const row of [...day.notes, ...day.cards]) {
      const item = list.createDiv({ cls: "qt-study-row" });
      const main = item.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: row.title });
      main.createDiv({
        cls: "qt-study-row-meta",
        text: `${row.kind === "note" ? `Note · ${row.set}` : `Card · ${row.deck || "Deck"}`} · ${row.isNew ? "new" : `due ${row.due}`} · ${workloadLabel(row.minutes)}`,
      });
      const buttons = item.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Open" }).addEventListener("click", () => this.openPath(row.path));
    }
  }

  openPath(path) {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (file) this.plugin.app.workspace.getLeaf("tab").openFile(file);
  }

  async addNote() {
    const result = await this.plugin.addActiveNoteToReview();
    if (result) new Notice(result);
    this.render();
  }

  async addFolder() {
    const result = await this.plugin.addActiveFolderToReview();
    if (result) new Notice(result);
    this.render();
  }

  shiftMonth(delta) {
    this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + delta, 1);
    this.render();
  }

  goToday() {
    const now = new Date();
    this.cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    this.selected = localDate();
    this.render();
  }
}

module.exports = {
  REVIEW_CALENDAR_MONTHS: MONTHS,
  ReviewCalendarView,
};
