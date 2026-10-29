"use strict";
const { ItemView } = require("obsidian");
const { WEAK_MIN_ATTEMPTS, computeStats, errorLog, fmtPct, overallStats, trendBy, trendDelta, weakestRow, weeklyAccuracy } = require("./stats");
const { fmtClock, str } = require("./util");
const { STAT_FIELDS } = require("./constants");
const { folderLabel, officialIdOf } = require("./filters");
const { buildDashboard } = require("./analytics");
const { renderBreakdown, renderCalibration, renderGrade, renderRetention, renderSkips } = require("./analytics-embed");

/* ------------------------------------------- weak spots and error log */

const VIEW_TYPE_INSIGHTS = "question-tracker-insights";

class InsightsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "weak"; // weak | errors | overview
    this.overviewField = "skill";
    this.field = "skill";
    this.showAll = {};
    this.timer = null;
  }
  getViewType() {
    return VIEW_TYPE_INSIGHTS;
  }
  getDisplayText() {
    return "Insights";
  }
  getIcon() {
    return "bar-chart-2";
  }
  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.registerEvent(this.app.metadataCache.on("changed", () => this.later()));
    this.render();
  }
  async onClose() {
    if (this.timer) activeWindow.clearTimeout(this.timer);
    this.timer = null;
  }
  later() {
    if (this.timer) return;
    this.timer = activeWindow.setTimeout(() => {
      this.timer = null;
      this.render();
    }, 600);
  }

  render() {
    const el = this.contentEl;
    const top = el.scrollTop;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-ins" });
    if (this.plugin.mcqEnabled && !this.plugin.mcqEnabled()) {
      root.createDiv({ cls: "qt-hint", text: "The MCQ Tracker module is off. Turn it on in Settings, Global." });
      return;
    }
    const tabs = root.createDiv({ cls: "qt-row qt-small-row" });
    for (const [id, label] of [["overview", "Overview"], ["weak", "Weak spots"], ["errors", "Error log"]]) {
      const b = tabs.createEl("button", { text: label });
      if (this.tab === id) b.addClass("mod-cta");
      b.addEventListener("click", () => {
        this.tab = id;
        this.render();
      });
    }
    const questions = this.plugin.getQuestions();
    if (this.tab === "overview") {
      this.renderOverview(root, questions);
      el.scrollTop = top;
      return;
    }
    if (this.tab === "weak") {
      if (questions.length) this.renderWeak(root, questions);
      else root.createDiv({ cls: "qt-empty", text: "No question notes found yet." });
      this.renderFrqWeak(root);
      el.scrollTop = top;
      return;
    }
    if (!questions.length) {
      root.createDiv({ cls: "qt-empty", text: "No question notes found yet." });
      return;
    }
    this.renderErrors(root, questions);
    el.scrollTop = top;
  }

  /** One local dashboard: attempts, study heatmap, course time, weak skills and the next exam. */
  renderOverview(root, questions) {
    const p = this.plugin;
    const cards = p.getCards ? p.getCards() : [];
    const data = buildDashboard({
      questions,
      cards,
      studyLog: p.settings.studyLog,
      confidenceLabels: p.settings.confidenceLabels,
      field: this.overviewField,
      today: new Date(),
    });
    const o = data.overall;
    const activeDays = data.heatmap.reduce((n, week) => n + week.days.filter((d) => !d.future && (d.minutes || d.attempts)).length, 0);
    const studyMinutes = data.heatmap.reduce((n, week) => n + week.days.reduce((m, d) => m + d.minutes, 0), 0);

    if (!o.notes && !data.cardStats.total && !studyMinutes) {
      root.createDiv({
        cls: "qt-empty",
        text: "No study activity yet. Answer a question or start a focus session and this dashboard fills in.",
      });
      return;
    }

    const tiles = root.createDiv({ cls: "qt-dash-stats" });
    const tile = (label, value, hint) => {
      const box = tiles.createDiv({ cls: "qt-dash-stat" });
      box.createDiv({ cls: "qt-dash-value", text: value });
      box.createDiv({ cls: "qt-dash-label", text: label });
      if (hint) box.createDiv({ cls: "qt-hint", text: hint });
    };
    tile("Attempts", String(o.attempts), `${o.seen} of ${o.notes} questions tried`);
    tile("Accuracy", fmtPct(o.accuracy), o.attempts ? `${fmtClock(Math.round(o.avgSeconds))} per question` : "No attempts yet");
    tile("Study today", `${data.study.todayMinutes} min`, `${data.study.streak} day streak`);
    tile("Cards due", String(data.cardStats.due), `${data.cardStats.total} cards in decks`);
    tile("Logged skips", String(o.skipped), o.skipped ? "Not counted as wrong" : "None logged");
    renderGrade(root, data);

    root.createEl("h3", { cls: "qt-today-section", text: "Study heatmap" });
    root.createDiv({
      cls: "qt-hint",
      text: `Last 12 weeks · ${activeDays} active day${activeDays === 1 ? "" : "s"} · ${studyMinutes} logged minute${studyMinutes === 1 ? "" : "s"}`,
    });
    const heat = root.createDiv({ cls: "qt-dash-heat" });
    for (const week of data.heatmap) {
      const col = heat.createDiv({ cls: "qt-dash-week" });
      for (const day of week.days) {
        const cell = col.createDiv({ cls: `qt-dash-day is-level-${day.level}${day.future ? " is-future" : ""}` });
        cell.setAttr("title", `${day.date}: ${day.minutes} study min · ${day.attempts} attempt${day.attempts === 1 ? "" : "s"}`);
        cell.setAttr("aria-label", `${day.date}: ${day.minutes} study minutes, ${day.attempts} attempts`);
      }
    }
    const legend = root.createDiv({ cls: "qt-dash-legend" });
    legend.createSpan({ cls: "qt-hint", text: "Less" });
    for (let i = 0; i < 5; i++) legend.createSpan({ cls: `qt-dash-day is-level-${i}` });
    legend.createSpan({ cls: "qt-hint", text: "More" });

    renderCalibration(root, data);
    renderRetention(root, data);

    const chips = root.createDiv({ cls: "qt-chips" });
    for (const [field, label] of [["skill", "Skill"], ["domain", "Domain"], ["difficulty", "Difficulty"]]) {
      const chip = chips.createEl("button", { text: label, cls: "qt-chip" });
      if (this.overviewField === field) chip.addClass("is-selected");
      chip.addEventListener("click", () => {
        this.overviewField = field;
        this.render();
      });
    }
    renderBreakdown(root, data, {
      onPractice: (field, value) => p.practiceWith({ [field]: [value] }, "smart"),
    });
    renderSkips(root, data);

    if (data.byCourse.length) {
      root.createEl("h3", { cls: "qt-today-section", text: "Study time by course" });
      const list = root.createDiv({ cls: "qt-ins-list" });
      const max = Math.max(...data.byCourse.map(([, minutes]) => minutes), 1);
      for (const [course, minutes] of data.byCourse) {
        const row = list.createDiv({ cls: "qt-ins-row qt-dash-course" });
        const main = row.createDiv({ cls: "qt-ins-main" });
        main.createDiv({ cls: "qt-ins-name", text: course });
        main.createDiv({ cls: "qt-hint", text: `${minutes} minute${minutes === 1 ? "" : "s"}` });
        const meter = row.createDiv({ cls: "qt-ins-meter" });
        meter.createDiv({ cls: "qt-meter-track" }).createDiv({ cls: "qt-meter-fill is-high" }).setCssProps({ "--qt-pct": `${Math.round((minutes / max) * 100)}%` });
      }
    }

    const plan = p.studyPlan ? p.studyPlan() : null;
    if (plan) {
      root.createEl("h3", { cls: "qt-today-section", text: "Next exam" });
      const box = root.createDiv({ cls: "qt-dash-exam" });
      box.createDiv({ cls: "qt-today-kicker", text: plan.daysLeft === 0 ? "Exam today" : `${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"} away` });
      box.createDiv({ cls: "qt-today-title", text: plan.course });
      box.createDiv({ cls: "qt-today-meta", text: `Readiness ${plan.readiness}% · ${plan.due} due · ${plan.fresh} new · ${plan.cardsDue} cards` });
      box.createEl("button", { text: "Start 10 min", cls: "mod-cta" }).addEventListener("click", () => p.startStudyPlan(plan, false));
    }

    root.createDiv({ cls: "qt-hint qt-dash-privacy", text: "Everything on this dashboard is calculated locally; nothing is uploaded." });
  }

  renderWeak(root, questions) {
    const p = this.plugin;
    const st = p.settings;
    const o = overallStats(questions);
    root.createDiv({
      cls: "qt-count",
      text: o.attempts
        ? `${o.attempts} attempt${o.attempts === 1 ? "" : "s"} on ${o.seen} of ${o.notes} questions · ${fmtPct(o.accuracy)} correct · ${fmtClock(Math.round(o.avgSeconds))} per question`
        : `${o.notes} questions, none attempted yet.`,
    });

    this.renderWeekly(root, questions);

    const weak = weakestRow(computeStats(questions, "skill"));
    if (weak && weak.accuracy < 1) {
      const b = root.createEl("button", { cls: "mod-cta qt-primary", text: `Practice my weakest skill: ${weak.value}` });
      root.createDiv({
        cls: "qt-hint",
        text: `${fmtPct(weak.accuracy)} correct over ${weak.attempts} attempt${weak.attempts === 1 ? "" : "s"}${weak.attempts < WEAK_MIN_ATTEMPTS ? " (not many yet, so this may change)" : ""}.`,
      });
      b.addEventListener("click", () => p.practiceWith({ skill: [weak.value] }, "smart"));
    } else {
      root.createDiv({
        cls: "qt-hint",
        text: weak
          ? "Every skill you've tried is at 100%. Nothing to fix yet."
          : "Your weakest skill shows up here once your notes have a skill property and you've answered some questions.",
      });
    }

    const chips = root.createDiv({ cls: "qt-chips" });
    for (const [key, label] of STAT_FIELDS) {
      const c = chips.createEl("button", { text: label, cls: "qt-chip" });
      if (this.field === key) c.addClass("is-selected");
      c.addEventListener("click", () => {
        this.field = key;
        this.render();
      });
    }

    const rows = computeStats(questions, this.field);
    if (!rows.length) {
      root.createDiv({ cls: "qt-hint", text: "None of your notes have a value for this yet." });
      return;
    }
    const trends = trendBy(questions, this.field, new Date());
    const list = root.createDiv({ cls: "qt-ins-list" });
    for (const r of rows) {
      const row = list.createDiv({ cls: "qt-ins-row" });
      const main = row.createDiv({ cls: "qt-ins-main" });
      main.createDiv({ cls: "qt-ins-name", text: this.field === "folder" ? folderLabel(r.value, st.questionFolder) : r.value });
      const delta = trendDelta(trends.get(r.value));
      const trendText = delta === null ? "" : delta === 0 ? " · steady lately" : ` · ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} points in the last 2 weeks`;
      main.createDiv({
        cls: "qt-hint",
        text: r.attempts
          ? `${r.notes} note${r.notes === 1 ? "" : "s"} · ${r.seen} tried · ${fmtClock(Math.round(r.avgSeconds))} on average${trendText}`
          : `${r.notes} note${r.notes === 1 ? "" : "s"} · not tried yet`,
      });
      const meter = row.createDiv({ cls: "qt-ins-meter" });
      const band = r.accuracy === null ? "" : r.accuracy < 0.6 ? "is-low" : r.accuracy < 0.8 ? "is-mid" : "is-high";
      const fill = meter.createDiv({ cls: "qt-meter-track" }).createDiv({ cls: `qt-meter-fill ${band}` });
      fill.setCssProps({ "--qt-pct": `${Math.round((r.accuracy || 0) * 100)}%` });
      meter.createSpan({ cls: "qt-ins-pct", text: fmtPct(r.accuracy) });
      const go = row.createEl("button", { text: "Practice" });
      go.addEventListener("click", () => p.practiceWith({ [this.field]: [r.value] }, "smart"));
    }
  }

  /** Accuracy for each of the last 8 weeks, as a small bar chart. */
  renderWeekly(root, questions) {
    const weeks = weeklyAccuracy(questions, new Date(), 8);
    if (weeks.filter((w) => w.attempts).length < 2) return; // one week isn't a trend
    root.createDiv({ cls: "qt-label", text: "Accuracy by week" });
    const chart = root.createDiv({ cls: "qt-trend" });
    for (const w of weeks) {
      const col = chart.createDiv({ cls: "qt-trend-col" });
      col.setAttr("title", w.attempts ? `Week of ${w.start}: ${fmtPct(w.accuracy)} of ${w.attempts} attempts` : `Week of ${w.start}: no attempts`);
      const bar = col.createDiv({ cls: "qt-trend-bar" });
      const band = w.accuracy === null ? "" : w.accuracy < 0.6 ? "is-low" : w.accuracy < 0.8 ? "is-mid" : "is-high";
      bar.createDiv({ cls: `qt-meter-fill ${band}` }).setCssProps({ "--qt-pct": `${Math.round((w.accuracy || 0) * 100)}%` });
      col.createDiv({ cls: "qt-hint qt-trend-lab", text: w.accuracy === null ? "" : fmtPct(w.accuracy) });
    }
    root.createDiv({ cls: "qt-hint", text: "Each bar is one week, oldest on the left." });
  }

  /** Missed FRQ rubric criteria from saved attempts. Scheduler routing is still open. */
  async renderFrqWeak(root) {
    if (!this.plugin.getFrqWeakSpotRows) return;
    const box = root.createDiv({ cls: "qt-frq-weak" });
    box.createEl("h3", { cls: "qt-today-section", text: "FRQ criteria to review" });
    let rows = [];
    try {
      rows = await this.plugin.getFrqWeakSpotRows();
    } catch (e) {
      rows = [];
    }
    if (!rows.length) {
      box.createDiv({ cls: "qt-hint", text: "Saved FRQ attempts will show missed rubric criteria here." });
      return;
    }
    box.createDiv({
      cls: "qt-hint",
      text: "Built from criteria marked short in your saved AP FRQ attempts. This is a practice signal, not a score prediction.",
    });
    for (const row of rows.slice(0, 6)) {
      const line = box.createDiv({ cls: "qt-ins-row" });
      const main = line.createDiv({ cls: "qt-ins-main" });
      main.createDiv({ cls: "qt-ins-name", text: row.criterion });
      main.createDiv({
        cls: "qt-hint",
        text: `${row.course} · short in ${row.misses} of ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}`,
      });
      const go = line.createEl("button", { text: "Practice", cls: "qt-link" });
      go.addEventListener("click", () => this.plugin.openFrqGrader(row.path ? { path: row.path } : undefined));
    }
    box.createEl("button", { cls: "mod-cta qt-primary", text: "Open AP FRQ practice" }).addEventListener("click", () => this.plugin.openFrqGrader());
  }

  renderErrors(root, questions) {
    const p = this.plugin;
    const groups = errorLog(questions);
    if (!groups.length) {
      root.createDiv({
        cls: "qt-hint",
        text: "No missed questions yet. When you miss one, pick why on the result screen and it will be grouped here.",
      });
      return;
    }
    root.createDiv({ cls: "qt-hint", text: "Questions whose latest attempt was a miss, grouped by the reason you gave." });
    for (const g of groups) {
      const box = root.createDiv({ cls: "qt-ins-group" });
      const head = box.createDiv({ cls: "qt-fset-head" });
      head.createSpan({ cls: "qt-ins-name", text: g.type || "No reason picked" });
      head.createSpan({
        cls: "qt-hint",
        text: g.type ? `${g.notes.length} still missed · ${g.total} in all` : `${g.notes.length} still missed`,
      });
      const key = g.type || "(none)";
      const shown = this.showAll[key] ? g.notes : g.notes.slice(0, 8);
      for (const q of shown) {
        const row = box.createDiv({ cls: "qt-ins-note" });
        const a = row.createEl("a", { text: officialIdOf(q.fm) || str(q.fm.question_id) || q.file.basename, cls: "qt-link" });
        a.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(q.file));
        const bits = [q.fm.skill, q.fm.difficulty, str(q.fm["date attempted"]).slice(0, 10)].filter(Boolean).join(" · ");
        if (bits) row.createSpan({ cls: "qt-hint", text: bits });
      }
      if (g.notes.length > shown.length) {
        const more = box.createEl("button", { text: `Show all ${g.notes.length}`, cls: "qt-link" });
        more.addEventListener("click", () => {
          this.showAll[key] = true;
          this.render();
        });
      }
      const go = box.createEl("button", { text: g.type ? `Practice these (${g.notes.length})` : `Practice all missed` });
      go.addEventListener("click", () => p.practiceWith(g.type ? { last_error_type: [g.type] } : {}, "missed"));
    }
  }
}

module.exports = {
  VIEW_TYPE_INSIGHTS,
  InsightsView,
};
