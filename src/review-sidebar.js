"use strict";
/* Sidebar review schedule: due list, estimates, manual target, calendar and Pomodoro. */
const { ItemView, Notice, Platform, setIcon } = require("obsidian");
const { VIEW_TYPE_REVIEW_SIDEBAR } = require("./constants");
const { normalizeReviewSidebarSettings, buildReviewSidebar, adjacentPath, workloadLabel } = require("./review-sidebar-model");
const { monthCells, monthLabel, addUtcDays, todayKey, validDayKey, formatDayLabel } = require("./utc-dates");
const { makeKeyboardClickable } = require("./view-helpers");

const SORT_LABELS = { due: "Due date", title: "Title", time: "Longest first", priority: "Priority" };
const FILTER_LABELS = { all: "All", due: "Due today", upcoming: "Upcoming", overdue: "Overdue" };
const GRADE_LABELS = [["again", "Again"], ["hard", "Hard"], ["good", "Good"], ["easy", "Easy"]];

class ReviewSidebarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "list";
    this.cursor = new Date();
    this.selectedDay = "";
    this.expandedPath = "";
  }

  getViewType() {
    return VIEW_TYPE_REVIEW_SIDEBAR;
  }

  getDisplayText() {
    return "Review schedule";
  }

  getIcon() {
    return "calendar-check";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
  }

  async onClose() {
    this.contentEl.empty();
  }

  settings() {
    return normalizeReviewSidebarSettings(this.plugin.settings.reviewSidebar);
  }

  isNarrow() {
    return Platform.isMobile === true || (this.contentEl && this.contentEl.clientWidth > 0 && this.contentEl.clientWidth < 360);
  }

  snapshot() {
    const config = this.settings();
    return this.plugin.reviewCalendarSnapshot({ days: Math.max(35, config.upcomingDays + 7) });
  }

  model() {
    const config = this.settings();
    return buildReviewSidebar(this.snapshot(), this.plugin.getNoteQueue({ limit: 0 }), {
      settings: config,
      today: todayKey(new Date()),
      noteMinutes: this.plugin.reviewCalendarSettings().noteMinutes,
    });
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-review-sidebar qt-screen" });
    const config = this.settings();
    if (!config.enabled) {
      const card = root.createDiv({ cls: "qt-onboard-card" });
      card.createEl("h3", { text: "Review sidebar is off" });
      card.createDiv({ cls: "qt-onboard-text", text: "Turn it on in Settings → Review schedule." });
      card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
      return;
    }

    const head = root.createDiv({ cls: "qt-review-sidebar-head qt-screen-head" });
    const title = head.createDiv();
    title.createEl("h2", { text: "Review schedule" });
    title.createDiv({ cls: "qt-hint", text: "Whole notes due from your review sets. Times are estimates and never change a schedule." });
    const headActions = head.createDiv({ cls: "qt-review-sidebar-head-actions" });
    const calendarButton = headActions.createEl("button", { cls: "qt-icon-button", attr: { "aria-label": "Open the full review calendar", title: "Full review calendar" } });
    setIcon(calendarButton, "calendar-days");
    calendarButton.addEventListener("click", () => this.plugin.activateReviewCalendar());
    const addButton = headActions.createEl("button", { cls: "qt-icon-button", attr: { "aria-label": "Add the current note to review", title: "Add this note" } });
    setIcon(addButton, "plus");
    addButton.addEventListener("click", async () => {
      const result = await this.plugin.addActiveNoteToReview();
      if (result) new Notice(`${result} is now in review.`);
      this.render();
    });

    const tabs = root.createDiv({ cls: "qt-review-sidebar-tabs" });
    for (const [id, label, icon] of [["list", "List", "list"], ["calendar", "Calendar", "calendar-days"]]) {
      const button = tabs.createEl("button", { cls: "qt-review-sidebar-tab", attr: { "aria-pressed": this.tab === id ? "true" : "false" } });
      setIcon(button, icon);
      button.createSpan({ text: label });
      if (this.tab === id) button.addClass("is-active");
      button.addEventListener("click", () => {
        this.tab = id;
        this.render();
      });
    }

    if (this.tab === "calendar") {
      this.renderCalendar(root);
      return;
    }

    const data = this.model();
    this.renderStats(root, data);
    this.renderToolbar(root);
    if (this.selectedDay) {
      const selected = root.createDiv({ cls: "qt-review-sidebar-selected" });
      selected.createSpan({ text: formatDayLabel(this.selectedDay, { weekday: "short", month: "short", day: "numeric" }) });
      selected.createEl("button", { cls: "qt-link", text: "Clear" }).addEventListener("click", () => {
        this.selectedDay = "";
        this.render();
      });
    }
    this.renderList(root, data);
    if (config.showPomodoro) this.renderPomodoro(root);
  }

  renderStats(root, data) {
    const stats = root.createDiv({ cls: "qt-review-sidebar-stats" });
    const stat = (value, label, hint) => {
      const card = stats.createDiv({ cls: "qt-review-sidebar-stat" });
      card.createDiv({ cls: "qt-review-sidebar-stat-value", text: String(value) });
      card.createDiv({ cls: "qt-review-sidebar-stat-label", text: label });
      if (hint) card.setAttr("title", hint);
    };
    stat(data.counts.overdue, "overdue", "Notes whose next review date is before today");
    stat(data.counts.due, "due today", "New notes and notes due today");
    stat(data.settings.showEstimates ? workloadLabel(data.minutes) : "—", "estimate");
    stat(data.settings.showEstimates ? workloadLabel(data.targetMinutes) : "—", data.settings.overrideMode === "replace" ? "target" : "with extra time");
  }

  renderToolbar(root) {
    const config = this.settings();
    const bar = root.createDiv({ cls: "qt-review-sidebar-toolbar" });
    const sortWrap = bar.createDiv({ cls: "qt-review-sidebar-select" });
    sortWrap.createEl("label", { text: "Sort" });
    const sort = sortWrap.createEl("select", { cls: "dropdown", attr: { "aria-label": "Sort review notes" } });
    for (const [value, label] of Object.entries(SORT_LABELS)) sort.createEl("option", { value, text: label });
    sort.value = config.sort;
    sort.addEventListener("change", async () => {
      this.plugin.settings.reviewSidebar = { ...this.plugin.settings.reviewSidebar, sort: sort.value };
      await this.plugin.save();
      this.render();
    });
    const filterWrap = bar.createDiv({ cls: "qt-review-sidebar-select" });
    filterWrap.createEl("label", { text: "Show" });
    const filter = filterWrap.createEl("select", { cls: "dropdown", attr: { "aria-label": "Filter review notes" } });
    for (const [value, label] of Object.entries(FILTER_LABELS)) filter.createEl("option", { value, text: label });
    filter.value = config.filter;
    filter.addEventListener("change", async () => {
      this.plugin.settings.reviewSidebar = { ...this.plugin.settings.reviewSidebar, filter: filter.value };
      await this.plugin.save();
      this.render();
    });

    const time = bar.createDiv({ cls: "qt-review-sidebar-time" });
    time.createEl("label", { text: "Extra time" });
    const hours = time.createEl("input", { cls: "qt-input", attr: { type: "number", min: "0", max: "24", "aria-label": "Extra hours" } });
    hours.value = String(config.overrideHours);
    hours.addEventListener("change", async () => {
      this.plugin.settings.reviewSidebar = normalizeReviewSidebarSettings({ ...config, overrideHours: hours.value });
      await this.plugin.save();
      this.render();
    });
    time.createSpan({ text: "h" });
    const minutes = time.createEl("input", { cls: "qt-input", attr: { type: "number", min: "0", max: "59", "aria-label": "Extra minutes" } });
    minutes.value = String(config.overrideMinutes);
    minutes.addEventListener("change", async () => {
      this.plugin.settings.reviewSidebar = normalizeReviewSidebarSettings({ ...config, overrideMinutes: minutes.value });
      await this.plugin.save();
      this.render();
    });
    time.createSpan({ text: "m" });
    const mode = time.createEl("select", { cls: "dropdown", attr: { "aria-label": "How extra time applies" } });
    mode.createEl("option", { value: "add", text: "Add" });
    mode.createEl("option", { value: "replace", text: "Replace" });
    mode.value = config.overrideMode;
    mode.addEventListener("change", async () => {
      this.plugin.settings.reviewSidebar = { ...config, overrideMode: mode.value };
      await this.plugin.save();
      this.render();
    });
  }

  visibleRows(data) {
    if (!this.selectedDay) return data.rows;
    return data.rows.filter((row) => row.due === this.selectedDay);
  }

  renderList(root, data) {
    const rows = this.visibleRows(data);
    if (!rows.length) {
      const empty = root.createDiv({ cls: "qt-study-card qt-review-sidebar-empty" });
      empty.createEl("h3", { text: this.selectedDay ? "No notes for that day" : "All caught up" });
      empty.createDiv({ cls: "qt-study-empty", text: this.selectedDay ? "Pick another day or clear the day filter." : "No whole notes are due in the next " + data.settings.upcomingDays + " days." });
      return;
    }
    const groups = [];
    const index = new Map();
    for (const row of rows) {
      const label = row.status === "overdue" ? "Overdue" : row.status === "due" ? "Today" : row.due;
      if (!index.has(label)) {
        index.set(label, { label, rows: [], minutes: 0 });
        groups.push(index.get(label));
      }
      index.get(label).rows.push(row);
      index.get(label).minutes += row.minutes;
    }
    for (const group of groups) {
      const section = root.createDiv({ cls: "qt-review-sidebar-section" });
      const header = section.createDiv({ cls: "qt-review-sidebar-section-head" });
      header.createSpan({ cls: "qt-review-sidebar-section-title", text: group.label });
      header.createSpan({ cls: "qt-review-sidebar-section-count", text: `${group.rows.length} · ${workloadLabel(group.minutes)}` });
      const list = section.createDiv({ cls: "qt-review-sidebar-list" });
      for (const row of group.rows) this.renderRow(list, row);
    }
  }

  renderRow(list, row) {
    const item = list.createDiv({ cls: `qt-review-sidebar-row is-${row.status}` });
    const main = item.createDiv({ cls: "qt-review-sidebar-row-main" });
    const titleRow = main.createDiv({ cls: "qt-review-sidebar-row-title-row" });
    const title = titleRow.createEl("button", { cls: "qt-review-sidebar-row-title", text: row.title });
    title.setAttr("aria-label", `Open ${row.title}`);
    title.addEventListener("click", () => this.openPath(row.path));
    if (row.isNew) titleRow.createSpan({ cls: "qt-review-sidebar-badge", text: "new" });
    const meta = main.createDiv({ cls: "qt-review-sidebar-row-meta" });
    const dueLabel = row.status === "overdue" ? `${Math.abs(row.days)}d overdue` : row.status === "due" ? "due today" : `due ${row.due}`;
    meta.setText([row.set, dueLabel, workloadLabel(row.minutes), this.algorithmFor(row.path)].filter(Boolean).join(" · "));
    if (row.isNew) meta.setText([row.set, "new", workloadLabel(row.minutes), this.algorithmFor(row.path)].filter(Boolean).join(" · "));

    const actions = item.createDiv({ cls: "qt-review-sidebar-row-actions" });
    const review = actions.createEl("button", { cls: "qt-review-sidebar-review", text: "Review" });
    review.setAttr("aria-label", `Review ${row.title}`);
    review.addEventListener("click", (event) => {
      event.stopPropagation();
      this.openForReview(row.path);
    });
    const more = actions.createEl("button", { cls: "qt-icon-button", attr: { "aria-label": `Actions for ${row.title}`, title: "Actions" } });
    setIcon(more, "more-horizontal");
    more.addEventListener("click", (event) => {
      event.stopPropagation();
      this.expandedPath = this.expandedPath === row.path ? "" : row.path;
      this.render();
    });
    if (this.expandedPath === row.path) {
      const detail = item.createDiv({ cls: "qt-review-sidebar-row-detail" });
      const grades = detail.createDiv({ cls: "qt-review-sidebar-grades" });
      for (const [grade, label] of GRADE_LABELS) {
        const button = grades.createEl("button", { cls: `qt-review-sidebar-grade is-${grade}`, text: label });
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          this.grade(row.path, grade);
        });
      }
      const secondary = detail.createDiv({ cls: "qt-review-sidebar-secondary" });
      secondary.createEl("button", { text: "Postpone 1 day" }).addEventListener("click", (event) => {
        event.stopPropagation();
        this.postpone(row.path);
      });
      secondary.createEl("button", { text: "Remove from review", cls: "qt-danger" }).addEventListener("click", (event) => {
        event.stopPropagation();
        this.remove(row.path);
      });
    }
    makeKeyboardClickable(item, () => this.openPath(row.path), { label: `Open ${row.title}` });
  }

  algorithmFor(path) {
    try {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      const fm = file ? (this.plugin.app.metadataCache.getFileCache(file) || {}).frontmatter || {} : {};
      if (fm.scheduler === "fsrs" || fm.srs) return "FSRS";
      if (fm.sm2) return "SM-2";
    } catch (error) {
      /* metadata is optional */
    }
    return "";
  }

  renderCalendar(root) {
    const data = this.model();
    const config = this.settings();
    const counts = new Map();
    for (const row of data.rows) counts.set(row.due, (counts.get(row.due) || 0) + 1);
    const card = root.createDiv({ cls: "qt-study-card qt-review-sidebar-calendar" });
    const head = card.createDiv({ cls: "qt-review-sidebar-calendar-head" });
    const prev = head.createEl("button", { cls: "qt-icon-button", attr: { "aria-label": "Previous month" } });
    setIcon(prev, "chevron-left");
    prev.addEventListener("click", () => this.shiftMonth(-1));
    head.createEl("h3", { text: monthLabel(this.cursor.getUTCFullYear(), this.cursor.getUTCMonth()) });
    const next = head.createEl("button", { cls: "qt-icon-button", attr: { "aria-label": "Next month" } });
    setIcon(next, "chevron-right");
    next.addEventListener("click", () => this.shiftMonth(1));
    const today = head.createEl("button", { cls: "qt-link", text: "Today" });
    today.addEventListener("click", () => {
      const now = new Date();
      this.cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      this.selectedDay = todayKey(now);
      this.render();
    });
    const grid = card.createDiv({ cls: "qt-review-sidebar-calendar-grid" });
    const labels = config.weekStartsOn === "sunday" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (const label of labels) grid.createDiv({ cls: "qt-review-sidebar-calendar-weekday", text: label });
    for (const cell of monthCells(this.cursor.getUTCFullYear(), this.cursor.getUTCMonth(), config.weekStartsOn, new Date())) {
      const button = grid.createEl("button", { cls: "qt-review-sidebar-calendar-cell", attr: { "aria-label": formatDayLabel(cell.key, { weekday: "long", month: "long", day: "numeric" }) } });
      if (!cell.inMonth) button.addClass("is-other-month");
      if (cell.isToday) button.addClass("is-today");
      if (cell.key === this.selectedDay) button.addClass("is-selected");
      button.createSpan({ cls: "qt-review-sidebar-calendar-day", text: String(cell.day) });
      const count = counts.get(cell.key) || 0;
      if (count) button.createSpan({ cls: "qt-review-sidebar-calendar-count", text: String(count) });
      button.addEventListener("click", () => {
        this.selectedDay = cell.key;
        this.tab = "list";
        this.render();
      });
    }
  }

  shiftMonth(delta) {
    this.cursor = new Date(Date.UTC(this.cursor.getUTCFullYear(), this.cursor.getUTCMonth() + delta, 1));
    this.render();
  }

  async openPath(path) {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!file) {
      new Notice("That note is no longer in the vault.");
      return;
    }
    await this.plugin.app.workspace.getLeaf("tab").openFile(file);
  }

  async openForReview(path) {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!file) return;
    await this.plugin.app.workspace.getLeaf("tab").openFile(file);
    if (this.plugin.openNoteReviewForFile) this.plugin.openNoteReviewForFile(file);
    else this.plugin.refreshNoteReviewDock();
  }

  async grade(path, grade) {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!file) return;
    try {
      await this.plugin.recordNoteReview(file, grade, 0);
      this.expandedPath = "";
      this.render();
    } catch (error) {
      new Notice(error && error.message ? error.message : "Could not record the review.");
    }
  }

  async postpone(path) {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!file) return;
    await this.plugin.postponeNoteReview(file, 1);
    this.expandedPath = "";
    this.render();
  }

  async remove(path) {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!file) return;
    await this.plugin.removeNoteFromReview(file);
    this.expandedPath = "";
    this.render();
  }

  renderPomodoro(root) {
    const data = this.plugin.pomodoroSnapshot();
    if (!data || !this.plugin.pomodoroEnabled()) return;
    const card = root.createDiv({ cls: "qt-review-sidebar-pomodoro" });
    const head = card.createDiv({ cls: "qt-review-sidebar-pomodoro-head" });
    const icon = head.createSpan({ cls: "qt-review-sidebar-pomodoro-icon" });
    setIcon(icon, "timer");
    head.createSpan({ cls: "qt-review-sidebar-pomodoro-label", text: data.label });
    head.createSpan({ cls: "qt-review-sidebar-pomodoro-clock", text: data.display });
    const actions = card.createDiv({ cls: "qt-review-sidebar-pomodoro-actions" });
    const start = actions.createEl("button", { text: data.running ? "Pause" : data.remaining < data.phaseSeconds ? "Resume" : "Start", cls: "mod-cta" });
    start.addEventListener("click", async () => {
      if (data.running) await this.plugin.pausePomodoro();
      else await this.plugin.startPomodoro();
      this.render();
    });
    actions.createEl("button", { text: "Reset" }).addEventListener("click", async () => {
      await this.plugin.resetPomodoro();
      this.render();
    });
    actions.createEl("button", { text: "Skip" }).addEventListener("click", async () => {
      await this.plugin.skipPomodoro();
      this.render();
    });
  }
}

module.exports = {
  ReviewSidebarView,
};
