"use strict";
const { ItemView } = require("obsidian");
const { VIEW_TYPE_POMODORO } = require("./constants");
const { phaseLabel } = require("./pomodoro");

class PomodoroView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.adjusting = false;
  }

  getViewType() {
    return VIEW_TYPE_POMODORO;
  }

  getDisplayText() {
    return "Pomodoro";
  }

  getIcon() {
    return "timer";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
  }

  async onClose() {}

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-pomodoro-view qt-screen" });
    if (!this.plugin.pomodoroEnabled()) {
      const card = root.createDiv({ cls: "qt-onboard-card" });
      card.createEl("h3", { text: "Pomodoro is off" });
      card.createDiv({ cls: "qt-onboard-text", text: "Turn it on in Settings → Pomodoro." });
      card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
      return;
    }
    const data = this.plugin.pomodoroSnapshot();
    const card = root.createDiv({ cls: "qt-pomodoro-card" });
    card.createDiv({ cls: "qt-pomodoro-phase", text: phaseLabel(data.phase) });
    card.createDiv({ cls: "qt-pomodoro-clock", text: data.display });
    const elapsed = Math.min(data.phaseSeconds, Math.max(0, data.phaseSeconds - data.remaining));
    const percent = data.phaseSeconds ? Math.round((elapsed / data.phaseSeconds) * 1000) / 10 : 0;
    const progress = card.createDiv({ cls: "qt-meter-track qt-pomodoro-progress" });
    progress.setAttr("role", "progressbar");
    progress.setAttr("aria-label", `${data.label} progress`);
    progress.setAttr("aria-valuemin", "0");
    progress.setAttr("aria-valuemax", String(data.phaseSeconds));
    progress.setAttr("aria-valuenow", String(elapsed));
    progress.setAttr("aria-valuetext", `${data.display} remaining`);
    const fill = progress.createDiv({ cls: `qt-meter-fill qt-pomodoro-progress-fill${data.running ? " is-running" : ""}${data.phase === "work" ? "" : " is-break"}` });
    fill.style.width = `${percent}%`;
    if (data.running) {
      fill.style.setProperty("--qt-pomodoro-duration", `${data.phaseSeconds}s`);
      if (elapsed) fill.style.animationDelay = `-${elapsed}s`;
    }
    card.createDiv({
      cls: "qt-hint",
      text: `${data.completed} completed · ${data.workSessions} work session${data.workSessions === 1 ? "" : "s"} · ${data.running ? "running" : "paused"}`,
    });
    const actions = card.createDiv({ cls: "qt-row qt-pomodoro-actions" });
    if (data.running) actions.createEl("button", { text: "Pause", cls: "mod-cta" }).addEventListener("click", () => this.plugin.pausePomodoro());
    else actions.createEl("button", { text: data.remaining < data.phaseSeconds ? "Resume" : "Start", cls: "mod-cta" }).addEventListener("click", () => this.plugin.startPomodoro());
    actions.createEl("button", { text: "Reset", cls: "qt-pomodoro-secondary" }).addEventListener("click", () => this.plugin.resetPomodoro());
    actions.createEl("button", { text: "Skip phase", cls: "qt-pomodoro-secondary" }).addEventListener("click", () => this.plugin.skipPomodoro());
    actions.createEl("button", { text: this.adjusting ? "Close" : "Adjust", cls: "qt-pomodoro-secondary" }).addEventListener("click", () => {
      this.adjusting = !this.adjusting;
      this.render();
    });
    const settings = data.settings;
    if (this.adjusting) this.renderAdjust(card, settings);
    else {
      card.createDiv({
        cls: "qt-hint",
        text: `Focus ${settings.workMinutes} min · short ${settings.shortBreakMinutes} min · long ${settings.longBreakMinutes} min every ${settings.longBreakEvery} sessions`,
      });
    }
  }

  renderAdjust(card, settings) {
    const form = card.createDiv({ cls: "qt-pomodoro-adjust" });
    const fields = [
      { key: "workMinutes", label: "Focus", value: settings.workMinutes },
      { key: "shortBreakMinutes", label: "Short break", value: settings.shortBreakMinutes },
      { key: "longBreakMinutes", label: "Long break", value: settings.longBreakMinutes },
    ];
    const inputs = {};
    for (const field of fields) {
      const row = form.createDiv({ cls: "qt-pomodoro-adjust-row" });
      row.createEl("label", { text: `${field.label} (min)` });
      inputs[field.key] = row.createEl("input", {
        type: "number",
        cls: "qt-input",
        attr: { "aria-label": `${field.label} minutes`, min: "1", max: "180" },
      });
      inputs[field.key].value = String(field.value);
    }
    const buttons = form.createDiv({ cls: "qt-row qt-pomodoro-actions" });
    buttons.createEl("button", { text: "Save", cls: "mod-cta" }).addEventListener("click", async () => {
      const durations = {};
      for (const field of fields) durations[field.key] = Number(inputs[field.key].value);
      await this.plugin.setPomodoroDurations(durations);
      this.adjusting = false;
      this.render();
    });
    buttons.createEl("button", { text: "Cancel", cls: "qt-pomodoro-secondary" }).addEventListener("click", () => {
      this.adjusting = false;
      this.render();
    });
  }
}

module.exports = { PomodoroView };
