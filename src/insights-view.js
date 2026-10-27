"use strict";
const { ItemView } = require("obsidian");
const { WEAK_MIN_ATTEMPTS, computeStats, errorLog, fmtPct, overallStats, weakestRow } = require("./stats");
const { fmtClock, str } = require("./util");
const { STAT_FIELDS } = require("./constants");
const { folderLabel, officialIdOf } = require("./filters");

/* ------------------------------------------- weak spots and error log */

const VIEW_TYPE_INSIGHTS = "question-tracker-insights";

class InsightsView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "weak"; // weak | errors
    this.field = "skill";
    this.showAll = {};
    this.timer = null;
  }
  getViewType() {
    return VIEW_TYPE_INSIGHTS;
  }
  getDisplayText() {
    return "Weak spots";
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
    const tabs = root.createDiv({ cls: "qt-row qt-small-row" });
    for (const [id, label] of [["weak", "Weak spots"], ["errors", "Error log"]]) {
      const b = tabs.createEl("button", { text: label });
      if (this.tab === id) b.addClass("mod-cta");
      b.addEventListener("click", () => {
        this.tab = id;
        this.render();
      });
    }
    const questions = this.plugin.getQuestions();
    if (!questions.length) {
      root.createDiv({ cls: "qt-empty", text: "No question notes found yet." });
      return;
    }
    if (this.tab === "weak") this.renderWeak(root, questions);
    else this.renderErrors(root, questions);
    el.scrollTop = top;
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
    const list = root.createDiv({ cls: "qt-ins-list" });
    for (const r of rows) {
      const row = list.createDiv({ cls: "qt-ins-row" });
      const main = row.createDiv({ cls: "qt-ins-main" });
      main.createDiv({ cls: "qt-ins-name", text: this.field === "folder" ? folderLabel(r.value, st.questionFolder) : r.value });
      main.createDiv({
        cls: "qt-hint",
        text: r.attempts
          ? `${r.notes} note${r.notes === 1 ? "" : "s"} · ${r.seen} tried · ${fmtClock(Math.round(r.avgSeconds))} on average`
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
