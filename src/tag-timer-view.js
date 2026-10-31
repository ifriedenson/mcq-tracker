"use strict";
/*
 * Render a `tag-timer` block as a local timer panel. Each declared Obsidian
 * tag gets its own stopwatch or countdown, and completed sessions are grouped
 * by tag in the analytics section. No note, attempt, history, streak or
 * scheduler write happens here.
 */
const { MarkdownRenderChild } = require("obsidian");
const { localDate, str } = require("./util");
const {
  formatTagDuration,
  mergeTagTimer,
  parseTagTimers,
  pauseTagTimer,
  recordTagSession,
  resetTagTimer,
  settleTagTimer,
  startTagTimer,
  stopTagTimer,
  tagTimerDisplay,
  tagTimerKey,
  tagTimerStateLabel,
  tagTimerSummary,
} = require("./tag-timer");

function tagSettings(plugin) {
  const current = plugin.settings.tagTimers;
  if (!current || typeof current !== "object") {
    plugin.settings.tagTimers = { timers: {}, sessions: [] };
  }
  if (!plugin.settings.tagTimers.timers || typeof plugin.settings.tagTimers.timers !== "object") plugin.settings.tagTimers.timers = {};
  if (!Array.isArray(plugin.settings.tagTimers.sessions)) plugin.settings.tagTimers.sessions = [];
  return plugin.settings.tagTimers;
}

function timerDetail(state) {
  return state.kind === "countdown" ? (state.state === "stopped" ? "Elapsed" : "Time left") : "Elapsed";
}

class TagTimerBlock extends MarkdownRenderChild {
  constructor(containerEl, plugin, parsed, ctx) {
    super(containerEl);
    this.plugin = plugin;
    this.parsed = parsed;
    this.ctx = ctx || {};
    this.now = typeof this.ctx.now === "function" ? this.ctx.now : () => Date.now();
    this.today = str(this.ctx.today).trim() || localDate();
    this.rows = new Map();
    this.ticker = null;
    this.message = "";
    this.messageEl = null;
    this.needsSave = false;
  }

  onload() {
    this.render();
  }

  onunload() {
    this.stopTicker();
  }

  saveState() {
    return Promise.resolve(this.plugin.save()).catch(() => {
      this.message = "Could not save timer state. Try again.";
      this.showMessage();
      return false;
    });
  }

  stopTicker() {
    if (this.ticker !== null && typeof activeWindow !== "undefined") activeWindow.clearInterval(this.ticker);
    this.ticker = null;
  }

  syncTicker() {
    const running = [...this.rows.values()].some((row) => row.state.state === "running");
    if (running && this.ticker === null && typeof activeWindow !== "undefined") {
      this.ticker = activeWindow.setInterval(() => this.refresh(), 1000);
    } else if (!running) {
      this.stopTicker();
    }
  }

  showMessage() {
    if (this.messageEl) this.messageEl.setText(this.message);
  }

  rowState(entry) {
    const settings = tagSettings(this.plugin);
    const key = tagTimerKey(this.ctx.sourcePath || "", entry.tag);
    let state = mergeTagTimer(entry, settings.timers[key]);
    const settled = settleTagTimer(state, this.now());
    state = settled.state;
    if (settled.finished) {
      const recorded = recordTagSession(settings, state, this.now());
      state = recorded.state;
      if (recorded.session) {
        this.message = `Countdown finished: logged ${formatTagDuration(recorded.session.seconds)} for ${entry.tag}.`;
        this.needsSave = true;
      }
    }
    settings.timers[key] = state;
    return { key, state };
  }

  paintRow(root, entry) {
    const { key, state } = this.rowState(entry);
    const row = root.createDiv({ cls: "qt-tag-timer-row" });
    const head = row.createDiv({ cls: "qt-tag-timer-head" });
    head.createSpan({ cls: "qt-tag-timer-tag", text: entry.tag });
    head.createSpan({ cls: "qt-tag-timer-kind", text: entry.kind === "countdown" ? "Countdown" : "Stopwatch" });
    const stateEl = head.createSpan({ cls: `qt-tag-timer-state is-${state.state}`, text: tagTimerStateLabel(state) });

    const clock = row.createDiv({ cls: "qt-tag-timer-clock" });
    const time = clock.createSpan({ cls: "qt-tag-timer-time", text: tagTimerDisplay(state, this.now()) });
    const detail = clock.createSpan({ cls: "qt-tag-timer-detail", text: timerDetail(state) });
    time.setAttr("aria-label", `${entry.tag} ${tagTimerStateLabel(state)} ${tagTimerDisplay(state, this.now())}`);

    let fill = null;
    if (state.kind === "countdown") {
      const bar = row.createDiv({ cls: "qt-tag-timer-bar" });
      fill = bar.createDiv({ cls: "qt-tag-timer-fill" });
      const pct = state.durationMs ? Math.min(100, Math.round((state.elapsedMs / state.durationMs) * 100)) : 0;
      fill.style.width = `${pct}%`;
    }

    const actions = row.createDiv({ cls: "qt-tag-timer-actions" });
    const toggle = actions.createEl("button", {
      cls: "qt-tag-timer-toggle",
      text: state.state === "running" ? "Pause" : state.state === "stopped" ? "Start again" : "Start",
    });
    toggle.addEventListener("click", () => this.act(entry, "toggle").catch(() => {}));
    const stop = actions.createEl("button", { cls: "qt-tag-timer-stop", text: "Stop" });
    stop.addEventListener("click", () => this.act(entry, "stop").catch(() => {}));
    const reset = actions.createEl("button", { cls: "qt-tag-timer-reset", text: "Reset" });
    reset.addEventListener("click", () => this.act(entry, "reset").catch(() => {}));

    this.rows.set(key, { entry, state, timeEl: time, detailEl: detail, stateEl, fillEl: fill });
  }

  paintAnalytics(root) {
    const summary = tagTimerSummary(tagSettings(this.plugin), this.today);
    const details = root.createEl("details", { cls: "qt-tag-timer-analytics" });
    details.createEl("summary", { text: "Per-tag analytics" });
    details.createDiv({
      cls: "qt-tag-timer-totals",
      text: `Today ${formatTagDuration(summary.todayTotal)} · Last 7 days ${formatTagDuration(summary.weekTotal)}`,
    });
    if (!summary.rows.length) {
      details.createDiv({ cls: "qt-tag-timer-empty", text: "No completed sessions yet. Stop a timer to record one." });
      return;
    }
    for (const row of summary.rows) {
      const line = details.createDiv({ cls: "qt-tag-timer-analytics-row" });
      line.createSpan({ cls: "qt-tag-timer-analytics-tag", text: row.tag });
      line.createSpan({
        cls: "qt-tag-timer-analytics-time",
        text: `${row.todaySeconds ? `${formatTagDuration(row.todaySeconds)} today · ` : ""}${formatTagDuration(row.totalSeconds)} total · ${row.sessions} session${row.sessions === 1 ? "" : "s"}`,
      });
    }
  }

  render() {
    this.rows.clear();
    this.stopTicker();
    this.containerEl.empty();
    const root = this.containerEl.createDiv({ cls: "qt-tag-timer" });
    root.createDiv({ cls: "qt-tag-timer-title", text: "Tag timers" });
    for (const issue of this.parsed.issues.slice(0, 10)) root.createDiv({ cls: "qt-tag-timer-issue", text: issue });
    if (!this.parsed.entries.length) {
      root.createDiv({ cls: "qt-tag-timer-empty", text: "Add a timer line such as #study/biology stopwatch or #study/chemistry countdown 25." });
    }
    this.messageEl = root.createDiv({ cls: "qt-tag-timer-message", text: this.message });
    if (this.message) this.messageEl.setText(this.message);
    for (const entry of this.parsed.entries) this.paintRow(root, entry);
    this.paintAnalytics(root);
    this.syncTicker();
    if (this.needsSave) {
      this.needsSave = false;
      this.saveState();
    }
  }

  refresh() {
    const now = this.now();
    let repaint = false;
    for (const [key, row] of this.rows) {
      let state = row.state;
      const settled = settleTagTimer(state, now);
      if (settled.finished) {
        const recorded = recordTagSession(tagSettings(this.plugin), settled.state, now);
        state = recorded.state;
        tagSettings(this.plugin).timers[key] = state;
        if (recorded.session) {
          this.message = `Countdown finished: logged ${formatTagDuration(recorded.session.seconds)} for ${row.entry.tag}.`;
          this.needsSave = true;
        }
        repaint = true;
      } else if (settled.state !== state) {
        state = settled.state;
        tagSettings(this.plugin).timers[key] = state;
      }
      row.state = state;
      row.timeEl.setText(tagTimerDisplay(state, now));
      row.detailEl.setText(timerDetail(state));
      if (row.stateEl) row.stateEl.setText(tagTimerStateLabel(state));
      if (row.fillEl) {
        const pct = state.durationMs ? Math.min(100, Math.round((state.elapsedMs / state.durationMs) * 100)) : 0;
        row.fillEl.style.width = `${pct}%`;
      }
    }
    if (repaint) {
      this.render();
      return;
    }
    this.syncTicker();
  }

  async act(entry, action) {
    const row = this.rows.get(tagTimerKey(this.ctx.sourcePath || "", entry.tag));
    if (!row) return;
    const now = this.now();
    let state = row.state;
    if (action === "toggle") {
      state = state.state === "running" ? pauseTagTimer(state, now) : startTagTimer(state, now);
    } else if (action === "stop") {
      if (state.state === "stopped") {
        this.message = "This timer is already stopped.";
        this.showMessage();
        return;
      }
      const stopped = stopTagTimer(state, now);
      const recorded = recordTagSession(tagSettings(this.plugin), stopped, now);
      state = recorded.state;
      this.message = recorded.session
        ? `Logged ${formatTagDuration(recorded.session.seconds)} for ${entry.tag}.`
        : "Run the timer for at least one second before stopping it.";
    } else if (action === "reset") {
      state = resetTagTimer(state);
      this.message = `Reset ${entry.tag}.`;
    }
    tagSettings(this.plugin).timers[tagTimerKey(this.ctx.sourcePath || "", entry.tag)] = state;
    await this.saveState();
    this.render();
  }
}

async function renderTagTimerBlock(plugin, source, el, ctx) {
  const block = new TagTimerBlock(el, plugin, parseTagTimers(source), ctx);
  if (ctx && typeof ctx.addChild === "function") ctx.addChild(block);
  else block.load();
  return block;
}

module.exports = { TagTimerBlock, renderTagTimerBlock };
