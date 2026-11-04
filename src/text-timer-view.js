"use strict";
/*
 * Render a `text-timer` block as a passage plus a local count-up clock. It is
 * deliberately plain text and does not write the note or record study time.
 */
const { MarkdownRenderChild } = require("obsidian");
const {
  currentTextTimerElapsed,
  formatTextTimerClock,
  normalizeTextTimerState,
  parseTextTimerBlock,
  pauseTextTimer,
  resetTextTimer,
  startTextTimer,
  textTimerKey,
  textTimerSettings,
} = require("./text-timer");

class TextTimerBlock extends MarkdownRenderChild {
  constructor(containerEl, plugin, parsed, ctx, source) {
    super(containerEl);
    this.plugin = plugin;
    this.parsed = parsed;
    this.ctx = ctx || {};
    this.now = typeof this.ctx.now === "function" ? this.ctx.now : () => Date.now();
    this.key = textTimerKey(this.ctx.sourcePath || "", source, parsed.id);
    this.settings = textTimerSettings(plugin);
    this.state = normalizeTextTimerState(this.settings.timers[this.key]);
    this.settings.timers[this.key] = this.state;
    this.ticker = null;
    this.message = "";
    this.clockEl = null;
    this.toggleEl = null;
    this.messageEl = null;
  }

  onload() {
    this.render();
  }

  onunload() {
    this.stopTicker();
  }

  saveState() {
    return Promise.resolve(this.plugin.save()).catch(() => {
      this.message = "Could not save the timer. Try again.";
      if (this.messageEl) this.messageEl.setText(this.message);
      return false;
    });
  }

  stopTicker() {
    if (this.ticker !== null && typeof activeWindow !== "undefined") activeWindow.clearInterval(this.ticker);
    this.ticker = null;
  }

  syncTicker() {
    if (this.state.state === "running" && this.ticker === null && typeof activeWindow !== "undefined") {
      this.ticker = activeWindow.setInterval(() => this.refresh(), 1000);
    } else if (this.state.state !== "running") {
      this.stopTicker();
    }
  }

  paint() {
    if (this.clockEl) this.clockEl.setText(formatTextTimerClock(currentTextTimerElapsed(this.state, this.now())));
    if (this.toggleEl) {
      this.toggleEl.setText(this.state.state === "running" ? "Pause" : "Start");
      this.toggleEl.setAttr("aria-label", this.state.state === "running" ? "Pause the text timer" : "Start the text timer");
    }
    if (this.messageEl) this.messageEl.setText(this.message);
  }

  render() {
    this.stopTicker();
    this.containerEl.empty();
    const root = this.containerEl.createDiv({ cls: "qt-text-timer" });
    root.createDiv({ cls: "qt-text-timer-title", text: this.parsed.title });
    for (const issue of this.parsed.issues.slice(0, 4)) root.createDiv({ cls: "qt-text-timer-issue", text: issue });
    if (this.parsed.body) root.createDiv({ cls: "qt-text-timer-body", text: this.parsed.body });

    const controls = root.createDiv({ cls: "qt-text-timer-controls" });
    this.clockEl = controls.createSpan({ cls: "qt-text-timer-clock", text: "0:00" });
    this.clockEl.setAttr("aria-live", "polite");
    this.toggleEl = controls.createEl("button", { cls: "qt-text-timer-toggle", text: "Start" });
    this.toggleEl.addEventListener("click", () => this.toggle().catch(() => {}));
    const reset = controls.createEl("button", { cls: "qt-text-timer-reset", text: "Reset" });
    reset.addEventListener("click", () => this.reset().catch(() => {}));
    root.createDiv({ cls: "qt-text-timer-hint", text: "Counts up while you read. It does not change your study history." });
    this.messageEl = root.createDiv({ cls: "qt-text-timer-message", text: this.message });
    this.paint();
    this.syncTicker();
  }

  refresh() {
    this.paint();
  }

  async toggle() {
    const now = this.now();
    this.state = this.state.state === "running" ? pauseTextTimer(this.state, now) : startTextTimer(this.state, now);
    this.settings.timers[this.key] = this.state;
    this.message = this.state.state === "running" ? "Timer started." : "Timer paused.";
    this.paint();
    this.syncTicker();
    await this.saveState();
  }

  async reset() {
    this.state = resetTextTimer(this.state);
    this.settings.timers[this.key] = this.state;
    this.message = "Timer reset.";
    this.stopTicker();
    this.paint();
    await this.saveState();
  }
}

async function renderTextTimerBlock(plugin, source, el, ctx) {
  const block = new TextTimerBlock(el, plugin, parseTextTimerBlock(source), ctx, source);
  if (ctx && typeof ctx.addChild === "function") ctx.addChild(block);
  else block.load();
  return block;
}

module.exports = { TextTimerBlock, renderTextTimerBlock };
