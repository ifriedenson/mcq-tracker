"use strict";
/*
 * Render a `tally` block as two large local counters plus live session stats.
 * Nothing here writes a note or records a graded attempt; the counters are a
 * scratchpad for self-marking a practice run.
 */
const { MarkdownRenderChild } = require("obsidian");
const {
  formatTallyClock,
  normalizeTallyState,
  parseTallyBlock,
  recordTally,
  resetTally,
  setTallyStep,
  tallyKey,
  tallySettings,
  tallyStats,
} = require("./tally");

class TallyBlock extends MarkdownRenderChild {
  constructor(containerEl, plugin, parsed, ctx, source) {
    super(containerEl);
    this.plugin = plugin;
    this.parsed = parsed;
    this.ctx = ctx || {};
    this.source = source;
    this.now = typeof this.ctx.now === "function" ? this.ctx.now : () => Date.now();
    this.key = tallyKey(this.ctx.sourcePath || "", source, parsed.id);
    this.settings = tallySettings(plugin);
    this.state = normalizeTallyState(this.settings.sessions[this.key], parsed);
    this.settings.sessions[this.key] = this.state;
    this.ticker = null;
    this.message = "";
    this.counts = null;
    this.statsEl = null;
    this.messageEl = null;
    this.stepButtons = [];
  }

  onload() {
    this.render();
  }

  onunload() {
    this.stopTicker();
  }

  saveState() {
    return Promise.resolve(this.plugin.save()).catch(() => {
      this.message = "Could not save the tally. Try again.";
      if (this.messageEl) this.messageEl.setText(this.message);
      return false;
    });
  }

  stopTicker() {
    if (this.ticker !== null && typeof activeWindow !== "undefined") activeWindow.clearInterval(this.ticker);
    this.ticker = null;
  }

  syncTicker() {
    if (this.state.startedAt && this.ticker === null && typeof activeWindow !== "undefined") {
      this.ticker = activeWindow.setInterval(() => this.refresh(), 1000);
    } else if (!this.state.startedAt) {
      this.stopTicker();
    }
  }

  paintStats() {
    if (!this.statsEl) return;
    const stats = tallyStats(this.state, this.now());
    const accuracy = stats.accuracy === null ? "—" : `${Math.round(stats.accuracy * 100)}%`;
    this.statsEl.setText(`Total ${stats.total} · ${accuracy} accuracy · ${stats.cps.toFixed(2)} CPS · ${formatTallyClock(stats.elapsedMs)}`);
  }

  paintCounts() {
    if (this.counts) {
      this.counts.correct.count.setText(String(this.state.correct));
      this.counts.incorrect.count.setText(String(this.state.incorrect));
      this.counts.correct.button.setAttr("aria-label", `Add ${this.state.step} to ${this.parsed.correct}`);
      this.counts.incorrect.button.setAttr("aria-label", `Add ${this.state.step} to ${this.parsed.incorrect}`);
    }
    this.paintStats();
  }

  paintSteps() {
    for (const item of this.stepButtons) {
      item.el.toggleClass("is-active", item.step === this.state.step);
      item.el.setAttr("aria-pressed", item.step === this.state.step ? "true" : "false");
    }
  }

  makeCounter(root, kind, label, cls) {
    const button = root.createEl("button", { cls: `qt-tally-button ${cls}`, text: label });
    button.setAttr("aria-label", `Add ${this.state.step} to ${label}`);
    const count = button.createSpan({ cls: "qt-tally-count", text: String(kind === "correct" ? this.state.correct : this.state.incorrect) });
    button.addEventListener("click", () => this.act(kind).catch(() => {}));
    return { button, count };
  }

  render() {
    this.stopTicker();
    this.containerEl.empty();
    const root = this.containerEl.createDiv({ cls: "qt-tally" });
    root.createDiv({ cls: "qt-tally-title", text: this.parsed.title });
    for (const issue of this.parsed.issues.slice(0, 6)) root.createDiv({ cls: "qt-tally-issue", text: issue });

    const counters = root.createDiv({ cls: "qt-tally-counters" });
    const correct = this.makeCounter(counters, "correct", this.parsed.correct, "is-correct");
    const incorrect = this.makeCounter(counters, "incorrect", this.parsed.incorrect, "is-incorrect");
    this.counts = { correct, incorrect };

    this.statsEl = root.createDiv({ cls: "qt-tally-stats" });
    this.statsEl.setAttr("aria-live", "polite");

    const stepRow = root.createDiv({ cls: "qt-tally-steps" });
    stepRow.createSpan({ cls: "qt-tally-step-label", text: "Step" });
    this.stepButtons = [];
    for (const step of this.parsed.steps) {
      const el = stepRow.createEl("button", { cls: "qt-tally-step", text: `×${step}` });
      el.setAttr("aria-label", `Count ${step} at a time`);
      el.addEventListener("click", () => this.chooseStep(step).catch(() => {}));
      this.stepButtons.push({ el, step });
    }
    const reset = stepRow.createEl("button", { cls: "qt-tally-reset", text: "Reset" });
    reset.addEventListener("click", () => this.act("reset").catch(() => {}));

    this.messageEl = root.createDiv({ cls: "qt-tally-message", text: this.message });
    this.paintCounts();
    this.paintSteps();
    this.syncTicker();
  }

  refresh() {
    this.paintStats();
  }

  async chooseStep(step) {
    this.state = setTallyStep(this.state, step, this.parsed);
    this.settings.sessions[this.key] = this.state;
    this.paintSteps();
    this.paintCounts();
    await this.saveState();
  }

  async act(kind) {
    this.state = kind === "reset" ? resetTally(this.state, this.parsed) : recordTally(this.state, kind, this.now(), this.parsed);
    this.settings.sessions[this.key] = this.state;
    this.message = kind === "reset" ? "Counters reset. The next click starts a new session." : "";
    this.paintCounts();
    this.syncTicker();
    await this.saveState();
  }
}

async function renderTallyBlock(plugin, source, el, ctx) {
  const block = new TallyBlock(el, plugin, parseTallyBlock(source), ctx, source);
  if (ctx && typeof ctx.addChild === "function") ctx.addChild(block);
  else block.load();
  return block;
}

module.exports = { TallyBlock, renderTallyBlock };
