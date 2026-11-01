"use strict";
/* Anki-style study statistics, separate from the existing Insights dashboard. */
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_STUDY_STATS } = require("./constants");
const { MATURITY_ORDER, WEEK_DAYS } = require("./study-stats");
const { counterDay } = require("./study-counters");
const { workloadLabel } = require("./review-calendar");
const { str } = require("./util");

function pct(value) {
  return value === null || value === undefined ? "—" : `${Math.round(Number(value) * 100)}%`;
}

function formatMedian(value, key) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const text = String(Math.round(number * 100) / 100);
  if (key === "seconds") return `${text}s`;
  return key === "intervals" || key === "stability" ? `${text}d` : text;
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
    const root = el.createDiv({ cls: "qt-wrap qt-study-stats-view qt-screen" });
    if (!this.plugin.studyStatsEnabled()) {
      this.renderOff(root);
      return;
    }
    const data = this.plugin.studyStatsSnapshot();
    const head = root.createDiv({ cls: "qt-study-stats-head qt-screen-head" });
    head.createEl("h2", { text: "Study statistics" });
    head.createDiv({ cls: "qt-hint", text: "Read-only: true retention by maturity, memory-now, distributions, weekday rhythm, button mix, per-deck summaries, durable recall, a permanent heatmap and leeches." });

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

    this.renderButtonMix(root, data);
    this.renderDurability(root, data);
    this.renderHeatmap(root, data);
    this.renderRetention(root, data);
    this.renderMemory(root, data);
    this.renderDistributions(root, data);
    this.renderWeekday(root, data);
    this.renderDecks(root, data);
    this.renderDays(root, data);
    this.renderLeeches(root, data);
  }

  renderOff(root) {
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Study statistics is off" });
    card.createDiv({ cls: "qt-onboard-text", text: "Turn it on in Settings → Study statistics." });
    card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
  }

  renderButtonMix(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Answer button mix" });
    const mix = data.buttonMix;
    if (!mix || !mix.total) {
      card.createDiv({ cls: "qt-study-empty", text: "No rated reviews yet. Grade a note, card or question to start the mix." });
      return;
    }
    const max = Math.max(...mix.buckets.map((bucket) => bucket.count), 1);
    for (const bucket of mix.buckets) {
      const row = card.createDiv({ cls: "qt-study-stats-dist-row" });
      row.createSpan({ cls: "qt-study-stats-dist-label", text: bucket.rating.charAt(0).toUpperCase() + bucket.rating.slice(1) });
      bar(row, bucket.count, max, `is-${bucket.rating}`);
      row.createSpan({ cls: "qt-study-stats-dist-count", text: `${bucket.count} · ${pct(bucket.share)}` });
    }
    card.createDiv({ cls: "qt-hint", text: `Again rate ${pct(mix.againRate)} across ${mix.total} rated review${mix.total === 1 ? "" : "s"}.` });
    const split = data.buttonMixByMaturity;
    if (split) {
      card.createDiv({ cls: "qt-study-stats-dist-title", text: "Again rate by maturity" });
      const table = card.createDiv({ cls: "qt-study-stats-table" });
      const header = table.createDiv({ cls: "qt-study-stats-row is-mix is-head" });
      for (const label of ["Maturity", "Rated", "Again", "Again rate"]) header.createDiv({ text: label });
      for (const maturity of MATURITY_ORDER) {
        const bucket = split.byMaturity[maturity];
        const line = table.createDiv({ cls: "qt-study-stats-row is-mix" });
        line.createDiv({ text: data.retention.byMaturity[maturity].label });
        line.createDiv({ text: String(bucket.total) });
        line.createDiv({ text: String(bucket.again) });
        line.createDiv({ text: pct(bucket.againRate) });
      }
    }
  }

  renderDurability(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Two-day durable recall" });
    const summary = data.durability;
    if (!summary || !summary.total) {
      card.createDiv({ cls: "qt-study-empty", text: "No item has recorded a recall day yet." });
      return;
    }
    card.createDiv({
      cls: "qt-hint",
      text: `${summary.durable} durable · ${summary.learning} still learning · ${pct(summary.retention)} of tracked items recalled on ${data.settings.durableDays}+ distinct days.`,
    });
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const row of summary.rows.slice(0, 20)) {
      const line = list.createDiv({ cls: "qt-study-row" });
      const main = line.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: row.title || row.path });
      main.createDiv({
        cls: "qt-study-row-meta",
        text: `${row.count}/${row.requiredDays} day${row.count === 1 ? "" : "s"}${row.durableOn ? ` · durable ${row.durableOn}` : ""} · ${row.path}`,
      });
    }
  }

  renderHeatmap(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Study heatmap" });
    const map = data.heatmap;
    card.createDiv({
      cls: "qt-hint",
      text: `${map.activeDays} active day${map.activeDays === 1 ? "" : "s"} in the last ${map.weeks.length} week${map.weeks.length === 1 ? "" : "s"}. These counters are permanent and survive history trimming.`,
    });
    const grid = card.createDiv({ cls: "qt-study-stats-heatmap" });
    for (const week of map.weeks) {
      const column = grid.createDiv({ cls: "qt-study-stats-heatmap-week" });
      for (const day of week.days) {
        const cell = column.createDiv({ cls: `qt-study-stats-heatmap-cell is-level-${day.level}` });
        cell.setAttr("data-date", day.date);
        cell.setAttr("aria-label", `${day.date}: ${day.reviews} review${day.reviews === 1 ? "" : "s"}, ${day.minutes} minutes`);
        if (day.future) cell.addClass("is-future");
        cell.addEventListener("click", () => {
          this.selectedHeatDay = this.selectedHeatDay === day.date ? "" : day.date;
          this.render();
        });
      }
    }
    if (!this.selectedHeatDay) return;
    const detail = counterDay(data.counters, this.selectedHeatDay);
    const panel = card.createDiv({ cls: "qt-study-stats-day-detail" });
    if (!detail) {
      panel.createDiv({ cls: "qt-study-row-meta", text: `${this.selectedHeatDay}: no counter recorded.` });
      return;
    }
    panel.createDiv({ cls: "qt-study-row-title", text: this.selectedHeatDay });
    panel.createDiv({
      cls: "qt-study-row-meta",
      text: `${detail.reviews} review${detail.reviews === 1 ? "" : "s"} · ${pct(detail.accuracy)} · ${detail.minutes} min · ${detail.cards} cards · ${detail.questions} questions · ${detail.notes} notes`,
    });
    panel.createDiv({ cls: "qt-study-row-meta", text: `Again ${detail.again} · Hard ${detail.hard} · Good ${detail.good} · Easy ${detail.easy}` });
  }

  renderDecks(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Per-deck breakdown" });
    if (!data.decks.length) {
      card.createDiv({ cls: "qt-study-empty", text: "No cards yet, so there is no deck to compare." });
      return;
    }
    const table = card.createDiv({ cls: "qt-study-stats-table" });
    const header = table.createDiv({ cls: "qt-study-stats-row is-head" });
    for (const label of ["Deck", "Cards", "Reviews", "Retention", "Avg interval"]) header.createDiv({ text: label });
    for (const deck of data.decks) {
      const line = table.createDiv({ cls: "qt-study-stats-row" });
      line.createDiv({ text: deck.deck });
      line.createDiv({ text: String(deck.cards) });
      line.createDiv({ text: String(deck.reviews) });
      line.createDiv({ text: pct(deck.retention) });
      line.createDiv({ text: deck.averageInterval === null ? "—" : `${Math.round(deck.averageInterval)}d` });
    }
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
      ["seconds", "Answer time"],
      ["intervals", "Interval"],
      ["ease", "Ease"],
      ["stability", "FSRS stability"],
      ["difficulty", "FSRS difficulty"],
    ]) {
      const block = grid.createDiv({ cls: "qt-study-stats-dist" });
      block.createDiv({ cls: "qt-study-stats-dist-title", text: label });
      const dist = key === "seconds" ? data.timing && data.timing.seconds : data.metrics[key];
      if (!dist || !dist.total) {
        block.createDiv({ cls: "qt-study-empty", text: "No data yet." });
        continue;
      }
      if (dist.median !== null && dist.median !== undefined) {
        block.createDiv({ cls: "qt-study-row-meta", text: `Median ${formatMedian(dist.median, key)}` });
      }
      const max = Math.max(...dist.buckets.map((bucket) => bucket.count), 1);
      for (const bucket of dist.buckets) {
        const row = block.createDiv({ cls: "qt-study-stats-dist-row" });
        row.createSpan({ cls: "qt-study-stats-dist-label", text: bucket.label });
        bar(row, bucket.count, max, "is-dist");
        row.createSpan({ cls: "qt-study-stats-dist-count", text: String(bucket.count) });
      }
    }
    const timing = data.timing;
    if (timing && timing.targeted) {
      card.createDiv({
        cls: "qt-hint",
        text: `${timing.slow.count} of ${timing.targeted} timed answer${timing.targeted === 1 ? "" : "s"} went over ${timing.slow.threshold}× target (${pct(timing.slow.share)}). Average ${timing.averageSeconds}s; ${timing.fast} were at or under 75% of target.`,
      });
      if (timing.slow.rows.length) {
        const list = card.createDiv({ cls: "qt-study-list" });
        for (const row of timing.slow.rows.slice(0, 5)) {
          list.createDiv({
            cls: "qt-study-row-meta",
            text: `${row.title || row.path} · ${row.seconds}s against ${row.target}s target (${row.ratio}×) · ${row.date}`,
          });
        }
      }
    } else {
      card.createDiv({ cls: "qt-hint", text: "Set target_seconds on a note to flag slow answers; timed reviews are counted even without a target." });
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
