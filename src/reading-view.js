"use strict";
/*
 * Render a `reading-plan` block. Progress is stored in the plugin's local
 * settings, keyed by the plan's stable id, so logging pages survives a restart
 * without changing the note or the MCQ/card scheduler.
 */
const { localDate } = require("./util");
const { formatDay, parseReadingPlan, planReading } = require("./reading");

const STATUS_LABELS = {
  complete: "Complete",
  "not-started": "Not started",
  "off-pace": "Off pace",
  behind: "Behind",
  ahead: "Ahead",
  "on-track": "On track",
};

function pageLabel(count) {
  return `${count} page${count === 1 ? "" : "s"}`;
}

function paceText(plan) {
  if (plan.status === "complete") return `Finished ${pageLabel(plan.parsed.pages)}.`;
  if (plan.status === "not-started") return `Starts ${formatDay(plan.parsed.start)}.`;
  if (plan.status === "off-pace") {
    return `The target date has passed. Set a new target date in the block to rebuild the schedule from page ${plan.read}.`;
  }
  if (plan.status === "behind") {
    return `Behind by ${pageLabel(plan.behindBy)}. The remaining ${pageLabel(plan.remainingPages)} are redistributed across ${plan.daysLeft} reading day${plan.daysLeft === 1 ? "" : "s"}.`;
  }
  if (plan.status === "ahead") return `Ahead by ${pageLabel(plan.aheadBy)}.`;
  return `On pace with ${plan.daysLeft} reading day${plan.daysLeft === 1 ? "" : "s"} left.`;
}

function todayText(plan) {
  if (plan.status === "complete" || plan.status === "off-pace") return "";
  if (plan.todayChunk > 0) return `Today: ${pageLabel(plan.todayChunk)}.`;
  if (plan.nextDate) {
    const next = plan.schedule[0];
    return `Next reading day: ${formatDay(next.date)} · ${pageLabel(next.pages)}.`;
  }
  return "";
}

async function renderReadingPlanBlock(plugin, source, el, ctx) {
  const parsed = parseReadingPlan(source);
  const box = el.createDiv({ cls: "qt-reading-plan" });
  const today = ctx && ctx.today ? ctx.today : localDate();

  const paint = () => {
    box.empty();
    box.createDiv({ cls: "qt-reading-title", text: parsed.title || "Reading plan" });
    if (parsed.author) box.createDiv({ cls: "qt-reading-author", text: parsed.author });

    if (!parsed.valid) {
      for (const issue of parsed.issues) box.createDiv({ cls: "qt-reading-issue", text: issue });
      return;
    }

    const saved = plugin.settings.reading && plugin.settings.reading.progress ? plugin.settings.reading.progress[parsed.id] : undefined;
    const read = Number.isFinite(Number(saved)) ? Number(saved) : parsed.read;
    const plan = planReading(parsed, { today, read });
    if (!plan.ok) {
      box.createDiv({ cls: "qt-reading-issue", text: plan.issue });
      return;
    }

    const head = box.createDiv({ cls: "qt-reading-head" });
    head.createSpan({ cls: `qt-reading-status is-${plan.status}`, text: STATUS_LABELS[plan.status] || plan.status });
    head.createSpan({ cls: "qt-reading-count", text: `${plan.read} / ${parsed.pages} pages` });

    const bar = box.createDiv({ cls: "qt-reading-bar" });
    const fill = bar.createDiv({ cls: "qt-reading-fill" });
    fill.style.width = `${plan.pct}%`;
    box.createDiv({ cls: "qt-reading-pct", text: `${plan.pct}% complete` });
    box.createDiv({ cls: "qt-reading-pace", text: paceText(plan) });
    const todayLine = todayText(plan);
    if (todayLine) box.createDiv({ cls: "qt-reading-today", text: todayLine });

    if (plan.schedule.length) {
      const details = box.createEl("details", { cls: "qt-reading-schedule" });
      details.createEl("summary", { text: "Reading schedule" });
      const list = details.createDiv({ cls: "qt-reading-days" });
      for (const item of plan.schedule) {
        list.createDiv({ cls: "qt-reading-day", text: `${formatDay(item.date)} · ${pageLabel(item.pages)}` });
      }
    }

    if (plan.status !== "complete") {
      const log = box.createDiv({ cls: "qt-reading-log" });
      const input = log.createEl("input", { cls: "qt-reading-pages" });
      input.type = "number";
      input.min = "1";
      input.max = String(parsed.pages);
      input.placeholder = "Pages read";
      const button = log.createEl("button", { cls: "qt-reading-log-button", text: "Log pages" });
      const message = log.createDiv({ cls: "qt-reading-message" });
      button.addEventListener("click", async () => {
        const amount = Math.round(Number(input.value));
        if (!Number.isFinite(amount) || amount <= 0) {
          message.setText("Enter a whole number of pages greater than zero.");
          return;
        }
        const next = Math.min(parsed.pages, plan.read + amount);
        if (next === plan.read) {
          message.setText("That would not change the page count.");
          return;
        }
        plugin.settings.reading = plugin.settings.reading || { progress: {} };
        plugin.settings.reading.progress = plugin.settings.reading.progress || {};
        plugin.settings.reading.progress[parsed.id] = next;
        try {
          await plugin.save();
        } catch (e) {
          message.setText("Could not save reading progress. Try again.");
          return;
        }
        paint();
      });
    }
  };

  paint();
}

module.exports = { renderReadingPlanBlock };
