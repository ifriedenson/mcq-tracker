"use strict";
/*
 * Focus day: one pane combining a small month calendar, the Pomodoro timer
 * and a quick session task list. The calendar opens a daily note for any
 * clicked day, the timer drives the shared Pomodoro state, and the task
 * list is a session scratchpad that never writes to a note.
 */
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_FOCUS_DAY } = require("./constants");
const { phaseLabel } = require("./pomodoro");
const {
  FOCUS_DAY_WEEKDAYS,
  addFocusTask,
  deleteFocusTask,
  focusDailyNotePath,
  focusMonthGrid,
  focusMonthLabel,
  focusTodayKey,
  normalizeFocusTasks,
  shiftFocusMonth,
  toggleFocusTask,
  validFocusDateKey,
} = require("./focus-day");

class FocusDayView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth();
    this.tasks = [];
    this.taskSeq = 0;
    this.adjusting = false;
  }

  getViewType() {
    return VIEW_TYPE_FOCUS_DAY;
  }

  getDisplayText() {
    return "Focus day";
  }

  getIcon() {
    return "calendar-days";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
  }

  async onClose() {}

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-focus-day qt-screen" });
    this.renderCalendar(root);
    this.renderTimer(root);
    this.renderTasks(root);
  }

  renderCalendar(root) {
    const card = root.createDiv({ cls: "qt-focus-card qt-focus-calendar" });
    card.createEl("h2", { text: "Calendar", cls: "qt-focus-title" });
    const nav = card.createDiv({ cls: "qt-focus-nav" });
    nav.createEl("button", { text: "‹ Prev", attr: { "aria-label": "Previous month" } }).addEventListener("click", () => {
      const next = shiftFocusMonth(this.year, this.month, -1);
      this.year = next.year;
      this.month = next.month;
      this.render();
    });
    nav.createDiv({ cls: "qt-focus-month", text: focusMonthLabel(this.year, this.month) });
    nav.createEl("button", { text: "Next ›", attr: { "aria-label": "Next month" } }).addEventListener("click", () => {
      const next = shiftFocusMonth(this.year, this.month, 1);
      this.year = next.year;
      this.month = next.month;
      this.render();
    });
    const grid = card.createDiv({ cls: "qt-focus-grid", attr: { role: "grid", "aria-label": focusMonthLabel(this.year, this.month) } });
    for (const name of FOCUS_DAY_WEEKDAYS) grid.createDiv({ cls: "qt-focus-dow", text: name });
    const today = focusTodayKey();
    for (const cell of focusMonthGrid(this.year, this.month, today)) {
      if (cell.blank) {
        grid.createDiv({ cls: "qt-focus-date is-empty", attr: { "aria-hidden": "true" } });
        continue;
      }
      const day = grid.createEl("button", {
        cls: `qt-focus-date${cell.today ? " is-today" : ""}`,
        text: cell.label,
        attr: { "aria-label": cell.today ? `${cell.key}, today` : cell.key },
      });
      if (cell.today) day.setAttr("aria-current", "date");
      day.addEventListener("click", () => this.openDay(cell.key));
    }
    this.messageEl = card.createDiv({ cls: "qt-hint qt-focus-message", attr: { "aria-live": "polite" } });
  }

  async openDay(dateKey) {
    if (!this.plugin || typeof this.plugin.openDailyNote !== "function") {
      new Notice("Update MCQ Tracker to open daily notes from here.");
      return null;
    }
    try {
      const result = await this.plugin.openDailyNote(dateKey);
      if (!result) return null;
      this.say(result.created ? `Created ${result.path}.` : `Opened ${result.path}.`);
      return result;
    } catch (error) {
      this.say(`Could not open the daily note: ${error && error.message ? error.message : error}`);
      return null;
    }
  }

  say(text) {
    if (this.messageEl) this.messageEl.setText(text);
  }

  renderTimer(root) {
    const card = root.createDiv({ cls: "qt-focus-card qt-focus-timer" });
    card.createEl("h2", { text: "Pomodoro", cls: "qt-focus-title" });
    if (!this.plugin.pomodoroEnabled()) {
      card.createDiv({ cls: "qt-hint", text: "Turn on Pomodoro in Settings → Pomodoro." });
      card.createEl("button", { text: "Open settings" }).addEventListener("click", () => this.plugin.openSettings());
      return;
    }
    const data = this.plugin.pomodoroSnapshot();
    card.createDiv({ cls: "qt-focus-phase", text: phaseLabel(data.phase) });
    card.createDiv({ cls: "qt-focus-clock", text: data.display });
    const progress = card.createDiv({
      cls: "qt-meter-track qt-focus-progress",
      attr: {
        role: "progressbar",
        "aria-label": `${data.label} progress`,
        "aria-valuemin": "0",
        "aria-valuemax": String(data.phaseSeconds),
        "aria-valuenow": String(Math.min(data.phaseSeconds, Math.max(0, data.phaseSeconds - data.remaining))),
        "aria-valuetext": `${data.display} remaining`,
      },
    });
    const elapsed = Math.min(data.phaseSeconds, Math.max(0, data.phaseSeconds - data.remaining));
    const percent = data.phaseSeconds ? Math.round((elapsed / data.phaseSeconds) * 1000) / 10 : 0;
    const fill = progress.createDiv({ cls: `qt-meter-fill qt-focus-progress-fill${data.running ? " is-running" : ""}${data.phase === "work" ? "" : " is-break"}` });
    fill.style.width = `${percent}%`;
    card.createDiv({
      cls: "qt-hint",
      text: `${data.completed} completed · ${data.workSessions} work session${data.workSessions === 1 ? "" : "s"} · ${data.running ? "running" : "paused"}`,
    });
    const actions = card.createDiv({ cls: "qt-row qt-focus-actions" });
    if (data.running) {
      actions.createEl("button", { text: "Pause", cls: "mod-cta" }).addEventListener("click", async () => {
        await this.plugin.pausePomodoro();
        this.render();
      });
    } else {
      actions.createEl("button", { text: data.remaining < data.phaseSeconds ? "Resume" : "Start", cls: "mod-cta" }).addEventListener("click", async () => {
        await this.plugin.startPomodoro();
        this.render();
      });
    }
    actions.createEl("button", { text: "Reset" }).addEventListener("click", async () => {
      await this.plugin.resetPomodoro();
      this.render();
    });
    actions.createEl("button", { text: "Skip phase" }).addEventListener("click", async () => {
      await this.plugin.skipPomodoro();
      this.render();
    });
    actions.createEl("button", { text: this.adjusting ? "Close" : "Adjust" }).addEventListener("click", () => {
      this.adjusting = !this.adjusting;
      this.render();
    });
    if (this.adjusting) this.renderAdjust(card, data.settings);
    else {
      card.createDiv({
        cls: "qt-hint",
        text: `Focus ${data.settings.workMinutes} min · short ${data.settings.shortBreakMinutes} min · long ${data.settings.longBreakMinutes} min every ${data.settings.longBreakEvery} sessions`,
      });
    }
  }

  renderAdjust(card, settings) {
    const form = card.createDiv({ cls: "qt-focus-adjust" });
    const fields = [
      { key: "workMinutes", label: "Focus", value: settings.workMinutes },
      { key: "shortBreakMinutes", label: "Short break", value: settings.shortBreakMinutes },
      { key: "longBreakMinutes", label: "Long break", value: settings.longBreakMinutes },
    ];
    const inputs = {};
    for (const field of fields) {
      const row = form.createDiv({ cls: "qt-focus-adjust-row" });
      row.createEl("label", { text: `${field.label} (min)` });
      inputs[field.key] = row.createEl("input", {
        type: "number",
        cls: "qt-input",
        attr: { "aria-label": `${field.label} minutes`, min: "1", max: "180" },
      });
      inputs[field.key].value = String(field.value);
    }
    const buttons = form.createDiv({ cls: "qt-row qt-focus-actions" });
    buttons.createEl("button", { text: "Save", cls: "mod-cta" }).addEventListener("click", async () => {
      const durations = {};
      for (const field of fields) durations[field.key] = Number(inputs[field.key].value);
      await this.plugin.setPomodoroDurations(durations);
      this.adjusting = false;
      this.render();
    });
    buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => {
      this.adjusting = false;
      this.render();
    });
  }

  renderTasks(root) {
    const card = root.createDiv({ cls: "qt-focus-card qt-focus-tasks" });
    card.createEl("h2", { text: "Quick tasks", cls: "qt-focus-title" });
    card.createDiv({ cls: "qt-hint", text: "A session scratchpad — tasks vanish when the view closes and never touch a note." });
    const form = card.createDiv({ cls: "qt-focus-add" });
    const input = form.createEl("input", {
      type: "text",
      cls: "qt-input",
      attr: { placeholder: "Add a task...", "aria-label": "New quick task" },
    });
    const add = () => {
      const text = input.value;
      if (!String(text || "").trim()) return;
      this.taskSeq += 1;
      this.tasks = addFocusTask(this.tasks, text, `focus-${Date.now()}-${this.taskSeq}`);
      this.render();
    };
    form.createEl("button", { text: "Add", cls: "mod-cta" }).addEventListener("click", add);
    input.addEventListener("keydown", (event) => {
      if (!event || event.key !== "Enter") return;
      if (typeof event.preventDefault === "function") event.preventDefault();
      add();
    });
    this.tasks = normalizeFocusTasks(this.tasks);
    if (!this.tasks.length) {
      card.createDiv({ cls: "qt-focus-empty", text: "No tasks yet. Add your first one above." });
      return;
    }
    const list = card.createDiv({ cls: "qt-focus-list" });
    for (const task of this.tasks) {
      const row = list.createDiv({ cls: `qt-focus-task${task.done ? " is-done" : ""}` });
      const box = row.createEl("input", { type: "checkbox", attr: { "aria-label": task.text } });
      box.checked = task.done;
      box.addEventListener("change", () => {
        this.tasks = toggleFocusTask(this.tasks, task.id);
        this.render();
      });
      row.createDiv({ cls: "qt-focus-task-text", text: task.text });
      row.createEl("button", { text: "Delete", attr: { "aria-label": `Delete ${task.text}` } }).addEventListener("click", () => {
        this.tasks = deleteFocusTask(this.tasks, task.id);
        this.render();
      });
    }
  }
}

module.exports = { FocusDayView };
