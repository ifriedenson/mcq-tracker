"use strict";
/* Anki-style study statistics, separate from the existing Insights dashboard. */
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_STUDY_STATS } = require("./constants");
const { MATURITY_ORDER, WEEK_DAYS } = require("./study-stats");
const { workloadLabel } = require("./review-calendar");
const { str } = require("./util");

function pct(value) {
  return value === null || value === undefined ? "—" : `${Math.round(Number(value) * 100)}%`;
}

function bar(container, value, max, cls) {
  const track = container.createDiv({ cls: `qt-stat-bar ${cls || ""}`.trim() });
  const width = max > 0 ? Math.max(0, Math.min(100, (Number(value) / max) * 100)) : 0;
  const fill = track.createDiv({ cls: "qt-stat-bar-fill" });
  if (fill.style) fill.style.width = `${width}%`;
  return track;
}

class StudyStatsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.selectedDay = "";
  }

  getViewType() {
    return VIEW_TYPE_STUDY_STATS;
  }

  getDisplayText() {
    return "Study statistics";
  }

  getIcon() {
    return "bar-chart-3";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
  }

  async onClose() {}

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-study-stats-view" });
    if (!this.plugin.studyStatsEnabled()) {
      this.renderOff(root);
      return;
    }
    const data = this.plugin.studyStatsSnapshot();
    const head = root.createDiv({ cls: "qt-study-stats-head" });
    head.createEl("h2", { text: "Study statistics" });
    head.createDiv({ cls: "qt-hint", text: "Read-only: true retention by maturity, memory-now, distributions, weekday rhythm, day detail and leeches." });

    const stats = root.createDiv({ cls: "qt-study-stats" });
    const stat = (value, label) => {
      const card = stats.createDiv({ cls: "qt-study-stat" });
      card.createDiv({ cls: "qt-study-stat-value", text: String(value) });
      card.createDiv({ cls: "qt-study-stat-label", text: label });
    };
    stat(data.totals.reviews, "reviews");
    stat(data.totals.cardReviews, "card reviews");
    stat(data.totals.studyDays, "study days");
    stat(data.metrics.memoryNow === null ? "—" : pct(data.metrics.memoryNow), "memory now");
    stat(data.leeches.length, "leeches");

    this.renderRetention(root, data);
    this.renderMemory(root, data);
    this.renderDistributions(root, data);
    this.renderWeekday(root, data);
    this.renderDays(root, data);
    this.renderLeeches(root, data);
  }

  renderOff(root) {
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Study statistics is off" });
    card.createDiv({ cls: "qt-onboard-text", text: "Turn it on in Settings → Study statistics." });
    card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
  }

  renderRetention(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "True retention by maturity" });
    const table = card.createDiv({ cls: "qt-study-stats-table" });
    const header = table.createDiv({ cls: "qt-study-stats-row is-head" });
    for (const label of ["Maturity", "Reviews", "Retention"]) header.createDiv({ text: label });
    for (const id of MATURITY_ORDER) {
      const row = data.retention.byMaturity[id];
      const line = table.createDiv({ cls: "qt-study-stats-row" });
      line.createDiv({ text: row.label });
      line.createDiv({ text: String(row.attempts) });
      const value = line.createDiv({ cls: "qt-study-stats-retention" });
      value.createSpan({ text: pct(row.retention) });
      bar(value, row.retention === null ? 0 : row.retention * 100, 100, "is-retention");
    }
    const total = table.createDiv({ cls: "qt-study-stats-row is-total" });
    total.createDiv({ text: "All reviews" });
    total.createDiv({ text: String(data.retention.all.attempts) });
    total.createDiv({ cls: "qt-study-stats-retention", text: pct(data.retention.all.retention) });
  }

  renderMemory(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Memory now" });
    if (data.metrics.memoryNow === null) {
      card.createDiv({ cls: "qt-study-empty", text: "No FSRS card state yet. Review a card with FSRS to estimate recall." });
      return;
    }
    const line = card.createDiv({ cls: "qt-study-stats-memory" });
    line.createDiv({ cls: "qt-study-stats-big", text: pct(data.metrics.memoryNow) });
    line.createDiv({ cls: "qt-study-row-meta", text: `${data.metrics.memoryCards} FSRS card${data.metrics.memoryCards === 1 ? "" : "s"} with a stability estimate.` });
    bar(card, data.metrics.memoryNow * 100, 100, "is-memory");
  }

  renderDistributions(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Distributions" });
    const grid = card.createDiv({ cls: "qt-study-stats-grid" });
    for (const [key, label] of [
      ["intervals", "Interval"],
      ["ease", "Ease"],
      ["stability", "FSRS stability"],
      ["difficulty", "FSRS difficulty"],
    ]) {
      const block = grid.createDiv({ cls: "qt-study-stats-dist" });
      block.createDiv({ cls: "qt-study-stats-dist-title", text: label });
      const dist = data.metrics[key];
      if (!dist || !dist.total) {
        block.createDiv({ cls: "qt-study-empty", text: "No data yet." });
        continue;
      }
      const max = Math.max(...dist.buckets.map((bucket) => bucket.count), 1);
      for (const bucket of dist.buckets) {
        const row = block.createDiv({ cls: "qt-study-stats-dist-row" });
        row.createSpan({ cls: "qt-study-stats-dist-label", text: bucket.label });
        bar(row, bucket.count, max, "is-dist");
        row.createSpan({ cls: "qt-study-stats-dist-count", text: String(bucket.count) });
      }
    }
  }

  renderWeekday(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Weekday rhythm" });
    const max = Math.max(...data.weekday.map((day) => day.attempts), 1);
    const grid = card.createDiv({ cls: "qt-study-stats-weekday" });
    for (const day of data.weekday) {
      const block = grid.createDiv({ cls: "qt-study-stats-weekday-col" });
      block.createDiv({ cls: "qt-study-stats-weekday-count", text: String(day.attempts) });
      const track = block.createDiv({ cls: "qt-study-stats-weekday-track" });
      const fill = track.createDiv({ cls: "qt-study-stats-weekday-fill" });
      if (fill.style) fill.style.height = `${Math.round((day.attempts / max) * 100)}%`;
      block.createDiv({ cls: "qt-study-stats-weekday-label", text: day.label });
      block.createDiv({ cls: "qt-study-row-meta", text: pct(day.accuracy) });
    }
  }

  renderDays(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Day detail" });
    if (!data.days.length) {
      card.createDiv({ cls: "qt-study-empty", text: "No review history yet." });
      return;
    }
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const day of data.days.slice(0, 30)) {
      const row = list.createDiv({ cls: "qt-study-row qt-study-stats-day" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: day.date });
      main.createDiv({
        cls: "qt-study-row-meta",
        text: `${day.attempts} review${day.attempts === 1 ? "" : "s"} · ${pct(day.accuracy)} · ${day.minutes} min · ${day.cards} cards · ${day.questions} questions · ${day.notes} notes`,
      });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: day.date === this.selectedDay ? "Shown" : "Show" }).addEventListener("click", () => {
        this.selectedDay = this.selectedDay === day.date ? "" : day.date;
        this.render();
      });
      if (this.selectedDay === day.date) {
        const detail = card.createDiv({ cls: "qt-study-stats-day-detail" });
        for (const item of day.items) {
          detail.createDiv({
            cls: "qt-study-row-meta",
            text: `${item.kind} · ${item.title} · ${item.correct ? "correct" : "missed"} · ${item.maturity}`,
          });
        }
      }
    }
  }

  renderLeeches(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Leeches worth refactoring" });
    if (!data.leeches.length) {
      card.createDiv({ cls: "qt-study-empty", text: "No item has reached the leech threshold." });
      return;
    }
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const row of data.leeches) {
      const line = list.createDiv({ cls: "qt-study-row" });
      const main = line.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: row.title });
      main.createDiv({ cls: "qt-study-row-meta", text: `${row.kind} · ${row.lapses} lapse${row.lapses === 1 ? "" : "s"} · ${row.path}` });
      const buttons = line.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Open" }).addEventListener("click", () => {
        const file = this.plugin.app.vault.getAbstractFileByPath(row.path);
        if (file) this.plugin.app.workspace.getLeaf("tab").openFile(file);
      });
    }
  }
}

module.exports = {
  StudyStatsView,
  pct,
};
