"use strict";
/*
 * Docked whole-note review: pure preview/restore helpers plus the DOM bar.
 *
 * The bar does not own a queue or a scheduler. It asks the plugin for the
 * existing whole-note queue, writes through recordNoteReview (applyAttempt),
 * and restores a small snapshot for Undo.
 */
const { MarkdownView } = require("obsidian");
const { str } = require("./util");
const { applyAttempt } = require("./notes");
const { noteReviewAttempt } = require("./note-review");
const { formatInterval } = require("./interval-preview");
const session = require("./review-session");

const GRADES = ["again", "hard", "good", "easy"];
const GRADE_LABELS = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const SNAPSHOT_KEYS = [
  "history",
  "attempts",
  "correct_count",
  "streak",
  "time_spent_total",
  "last_time_spent",
  "last_answer",
  "last_confidence",
  "last_error_type",
  "result",
  "date attempted",
  "next_review",
  "srs",
  "sm2",
  "scheduler",
  "last_card_rating",
  "note_lapse_streak",
  "review_updated",
  "leech",
  "leech_lapses",
  "leech_since",
  "needs_fixing",
  "needs_fixing_miss_days",
  "recall_days",
  "recall_day_count",
  "durable_recall",
  "durable_on",
  "recall_checked",
  "exam_cap",
  "exam_cap_name",
  "exam_cap_exam_date",
];

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeNoteReviewDockSettings(value) {
  const src = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    enabled: src.enabled !== false,
    keyboard: src.keyboard !== false,
    lapseThreshold: Math.round(clampNumber(src.lapseThreshold, 1, 50, 8)),
    requeueEnabled: src.requeueEnabled !== false,
    requeueLimit: Math.round(clampNumber(src.requeueLimit, 1, 25, 3)),
    gradeLayout: ["row", "stacked", "auto"].includes(src.gradeLayout) ? src.gradeLayout : "auto",
    reportEnabled: src.reportEnabled === true,
    reportFolder: str(src.reportFolder).trim().replace(/^\/+|\/+$/g, ""),
  };
}

function schedulerForNote(fm, settings) {
  const declared = str(fm && fm.scheduler);
  if (declared === "fsrs" || declared === "sm2") return declared;
  return settings && settings.scheduler === "fsrs" ? "fsrs" : "ladder";
}

function cloneFrontmatter(fm) {
  try {
    return JSON.parse(JSON.stringify(fm || {}));
  } catch (_) {
    return {};
  }
}

function previewForGrade(fm, grade, settings, now) {
  const copy = cloneFrontmatter(fm);
  const attempt = noteReviewAttempt(grade, 0, now);
  const summary = applyAttempt(copy, attempt, settings.intervals, {
    scheduler: schedulerForNote(fm, settings),
    fsrsRetention: settings.fsrsRetention,
    grade,
  });
  const due = str(summary.nextReview).slice(0, 10);
  const today = dayKey(now);
  const days = due ? Math.max(0, Math.round((new Date(`${due}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000)) : 0;
  return { days, label: formatInterval(days), nextReview: due, summary };
}

/** Exact next interval for each rating, using the same applyAttempt path as the review. */
function noteReviewPreviews(fm, settings, now) {
  const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
  const out = {};
  for (const grade of GRADES) out[grade] = previewForGrade(fm, grade, settings || {}, at);
  return out;
}

function gradeForKey(key, scheduler) {
  const digit = String(key || "");
  if (!/^[0-5]$/.test(digit)) return "";
  const value = Number(digit);
  if (scheduler === "sm2") {
    if (value <= 2) return "again";
    if (value === 3) return "hard";
    if (value === 4) return "good";
    return "easy";
  }
  if (value === 0) return "again";
  if (value === 1) return "again";
  if (value === 2) return "hard";
  if (value === 3) return "good";
  return "easy";
}

function noteReviewSnapshot(fm) {
  const snapshot = {};
  for (const key of SNAPSHOT_KEYS) {
    if (fm && Object.prototype.hasOwnProperty.call(fm, key)) snapshot[key] = cloneFrontmatter({ value: fm[key] }).value;
  }
  return snapshot;
}

function restoreNoteReviewSnapshot(fm, snapshot) {
  for (const key of SNAPSHOT_KEYS) delete fm[key];
  for (const [key, value] of Object.entries(snapshot || {})) {
    if (SNAPSHOT_KEYS.includes(key)) fm[key] = cloneFrontmatter({ value }).value;
  }
}

function lapseThresholdReached(fm, threshold) {
  return (Number(fm && fm.note_lapse_streak) || 0) >= Math.max(1, Number(threshold) || 8);
}

function postponeDays(now, days) {
  const date = new Date(now instanceof Date && !isNaN(now.getTime()) ? now.getTime() : Date.now());
  date.setDate(date.getDate() + Math.max(1, Math.round(Number(days) || 1)));
  return dayKey(date);
}

function resetNoteSchedule(fm, now) {
  delete fm.srs;
  delete fm.sm2;
  delete fm.streak;
  delete fm.last_card_rating;
  delete fm.note_lapse_streak;
  fm.next_review = dayKey(now || new Date());
  // Keep the append-only history and attempt counters: this resets the
  // schedule, not the record of what was studied.
}

function applyLapseAction(fm, action, now) {
  const kind = str(action).toLowerCase();
  if (kind === "reset") resetNoteSchedule(fm, now);
  else if (kind === "rest") {
    fm.next_review = postponeDays(now, 7);
    fm.note_lapse_streak = 0;
  } else if (kind === "remove") {
    fm.note_review_excluded = true;
    fm.next_review = "";
    fm.note_lapse_streak = 0;
  } else if (kind === "carry") {
    fm.note_lapse_streak = 0;
  }
  return kind;
}

function dayKey(date) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function activeMarkdownView(app) {
  try {
    const workspace = app.workspace;
    if (MarkdownView && typeof workspace.getActiveViewOfType === "function") {
      const view = workspace.getActiveViewOfType(MarkdownView);
      if (view) return view;
    }
    const leaf = workspace.activeLeaf || (workspace.getMostRecentLeaf && workspace.getMostRecentLeaf());
    return leaf && leaf.view && leaf.view.file ? leaf.view : null;
  } catch (_) {
    return null;
  }
}

/** The docked bar for the active Markdown note. */
class NoteReviewDock {
  constructor(plugin) {
    this.plugin = plugin;
    this.bar = null;
    this.host = null;
    this.path = "";
    this.pendingLapse = null;
    this.lastUndo = null;
    this.done = false;
    this.session = null;
    this.log = [];
    this.currentTitle = "";
  }

  settings() {
    return normalizeNoteReviewDockSettings(this.plugin.settings.noteReviewDock);
  }

  remove() {
    if (this.bar && typeof this.bar.remove === "function") this.bar.remove();
    else if (this.bar && this.bar.parentNode) this.bar.parentNode.removeChild(this.bar);
    if (this.host && typeof this.host.removeClass === "function") this.host.removeClass("qt-note-review-host");
    this.bar = null;
    this.host = null;
    this.path = "";
    this.pendingLapse = null;
    this.done = false;
  }

  refresh() {
    const plugin = this.plugin;
    const config = this.settings();
    if (!config.enabled || !plugin.noteReviewDockEnabled || !plugin.noteReviewDockEnabled()) return this.remove();
    const view = activeMarkdownView(plugin.app);
    if (!view || !view.file) return this.remove();
    const queue = plugin.getNoteQueue({ limit: 0 });
    let item = (queue.all || []).find((row) => row.path === view.file.path);
    if (!item && this.session && this.session.queue.includes(view.file.path)) item = this.sessionItem(view.file);
    if (!item) return this.remove();
    if (!this.session) {
      const config = this.settings();
      this.session = session.createReviewSession((queue.all || []).map((row) => row.path), config);
      this.log = [];
    }
    this.path = view.file.path;
    this.host = view.containerEl || view.contentEl;
    if (!this.host) return this.remove();
    this.render(view, item, queue);
  }

  render(view, item, queue) {
    const host = view.containerEl || view.contentEl;
    this.host = host;
    if (!host || typeof host.createDiv !== "function") return;
    if (!this.bar || !this.bar.isConnected) {
      this.bar = host.createDiv({ cls: "qt-note-review-dock" });
      if (typeof host.addClass === "function") host.addClass("qt-note-review-host");
    }
    const bar = this.bar;
    bar.empty();
    const config = this.settings();
    bar.setAttr("data-grade-layout", config.gradeLayout);
    this.currentTitle = item.title;
    const head = bar.createDiv({ cls: "qt-note-review-dock-head" });
    head.createSpan({ cls: "qt-note-review-dock-title", text: "Whole-note review" });
    head.createSpan({ cls: "qt-note-review-dock-meta", text: `${item.title} · ${item.set} · ${item.isNew ? "new" : `due ${item.dueDate}`}` });
    const close = head.createEl("button", { cls: "qt-note-review-dock-close", text: "×" });
    close.setAttr("aria-label", "Hide the review bar");
    close.addEventListener("click", () => {
      this.done = true;
      this.remove();
    });

    if (this.done) {
      bar.createDiv({ cls: "qt-note-review-dock-message", text: "Review session finished." });
      const actions = bar.createDiv({ cls: "qt-row qt-note-review-dock-actions" });
      if (this.plugin.sessionReportEnabled && this.plugin.sessionReportEnabled()) {
        actions.createEl("button", { text: "Save session report", cls: "mod-cta" }).addEventListener("click", () => this.plugin.saveReviewSessionReport(this.log));
      }
      actions.createEl("button", { text: "Close" }).addEventListener("click", () => {
        this.done = true;
        this.remove();
      });
      return;
    }

    if (this.pendingLapse) {
      const panel = bar.createDiv({ cls: "qt-note-review-dock-lapse" });
      panel.createDiv({
        cls: "qt-note-review-dock-message",
        text: `This note has lapsed ${this.pendingLapse.streak} times in a row. What should happen next?`,
      });
      const actions = panel.createDiv({ cls: "qt-row qt-note-review-dock-actions" });
      for (const [action, label] of [
        ["reset", "Reset progress"],
        ["rest", "Rest for a week"],
        ["remove", "Remove from review"],
        ["carry", "Carry on"],
      ]) {
        actions.createEl("button", { text: label }).addEventListener("click", () => this.lapseAction(action));
      }
      return;
    }

    const previews = noteReviewPreviews(item.note.fm, this.plugin.settings, new Date());
    const grades = bar.createDiv({ cls: "qt-note-review-dock-grades" });
    for (const grade of GRADES) {
      const preview = previews[grade];
      const button = grades.createEl("button", { cls: `qt-note-review-dock-grade is-${grade}` });
      button.createSpan({ cls: "qt-note-review-dock-grade-label", text: GRADE_LABELS[grade] });
      button.createSpan({ cls: "qt-note-review-dock-grade-interval", text: preview.label });
      button.setAttr("aria-label", `${GRADE_LABELS[grade]}, next review ${preview.label}`);
      button.addEventListener("click", () => this.grade(grade));
    }

    const secondary = bar.createDiv({ cls: "qt-row qt-note-review-dock-secondary" });
    secondary.createEl("button", { text: "Skip" }).addEventListener("click", () => this.skip());
    secondary.createEl("button", { text: "Postpone 1 day" }).addEventListener("click", () => this.postpone());
    const undo = secondary.createEl("button", { text: "Undo" });
    undo.disabled = !this.lastUndo || this.lastUndo.path !== item.path;
    undo.addEventListener("click", () => this.undo());
    secondary.createEl("button", { text: "Open next" }).addEventListener("click", () => this.openNext(item.path));
    bar.createDiv({
      cls: "qt-note-review-dock-hint",
      text: this.settings().keyboard ? "Keys: 1–4 or 0–5 to grade · n skip · p postpone · u undo" : "Keyboard grading is off in settings.",
    });
    bar.setAttr("aria-label", `Whole-note review for ${item.title}`);
  }

  sessionItem(file) {
    const fm = (this.plugin.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    return {
      note: { file, fm },
      file,
      path: file.path,
      title: str(fm.title || file.basename || file.path),
      set: "Review session",
      priority: "normal",
      isNew: !Number(fm.attempts),
      dueDate: str(fm.next_review).slice(0, 10),
    };
  }

  async grade(grade) {
    const plugin = this.plugin;
    const view = activeMarkdownView(plugin.app);
    if (!view || !view.file || view.file.path !== this.path) return;
    const file = view.file;
    const confirmed = plugin.getNoteQueue({ limit: 0 }).all.find((row) => row.path === file.path);
    if (!confirmed && !(this.session && this.session.queue.includes(file.path))) {
      this.remove();
      return;
    }
    try {
      const summary = await plugin.recordNoteReview(file, grade, 0);
      this.lastUndo = { path: file.path, snapshot: summary && summary.previous };
      if (!Array.isArray(this.log)) this.log = [];
      this.log.push({ path: file.path, title: this.currentTitle || file.basename || file.path, grade });
      if (this.session) session.gradeReviewSession(this.session, file.path, grade !== "again");
      const config = this.settings();
      if (grade === "again" && summary && lapseThresholdReached({ note_lapse_streak: summary.lapseStreak }, config.lapseThreshold)) {
        this.pendingLapse = { streak: summary.lapseStreak };
        this.refresh();
        return;
      }
      await this.openNext(file.path);
    } catch (e) {
      this.showMessage(str(e && e.message ? e.message : e) || "Could not record the review.");
    }
  }

  async lapseAction(action) {
    const file = this.plugin.app.vault.getAbstractFileByPath(this.path);
    if (file && this.plugin.applyNoteLapseAction) await this.plugin.applyNoteLapseAction(file, action);
    if (this.session && action !== "carry") session.dropReviewSession(this.session, this.path);
    this.pendingLapse = null;
    this.lastUndo = null;
    await this.openNext(this.path);
  }

  async postpone() {
    const file = this.plugin.app.vault.getAbstractFileByPath(this.path);
    if (file && this.plugin.postponeNoteReview) await this.plugin.postponeNoteReview(file, 1);
    if (this.session) session.dropReviewSession(this.session, this.path);
    this.lastUndo = null;
    await this.openNext(this.path);
  }

  async undo() {
    if (!this.lastUndo || !this.lastUndo.snapshot) return;
    const file = this.plugin.app.vault.getAbstractFileByPath(this.lastUndo.path);
    if (!file) return;
    await this.plugin.undoNoteReview(file, this.lastUndo.snapshot);
    this.lastUndo = null;
    this.pendingLapse = null;
    this.done = false;
    this.session = null;
    this.log = [];
    this.refresh();
  }

  async skip() {
    if (this.session) session.dropReviewSession(this.session, this.path);
    await this.openNext(this.path);
  }

  async openNext(fromPath) {
    if (this.session) {
      const next = session.nextPath(this.session);
      if (!next) {
        this.done = true;
        this.refresh();
        return;
      }
      const file = this.plugin.app.vault.getAbstractFileByPath(next);
      if (!file) return this.remove();
      await this.plugin.app.workspace.getLeaf(false).openFile(file);
      this.done = false;
      this.pendingLapse = null;
      this.refresh();
      return;
    }
    const queue = this.plugin.getNoteQueue({ limit: 0 }).all;
    const current = queue.findIndex((row) => row.path === fromPath);
    const next = queue[current + 1] || queue[(current + 1) % Math.max(1, queue.length)];
    if (!next || next.path === fromPath) {
      this.done = true;
      this.refresh();
      return;
    }
    await this.plugin.app.workspace.getLeaf(false).openFile(next.file);
    this.done = false;
    this.pendingLapse = null;
    this.refresh();
  }

  showMessage(text) {
    if (!this.bar) return;
    this.bar.empty();
    this.bar.createDiv({ cls: "qt-note-review-dock-message", text });
  }

  onKey(event) {
    const config = this.settings();
    if (!config.enabled || !config.keyboard || !this.bar || this.pendingLapse) return;
    const target = event && event.target;
    if (target) {
      const tag = str(target.tagName).toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = str(event.key).toLowerCase();
    if (key === "n") {
      event.preventDefault();
      this.skip();
      return;
    }
    if (key === "p") {
      event.preventDefault();
      this.postpone();
      return;
    }
    if (key === "u") {
      event.preventDefault();
      this.undo();
      return;
    }
    const view = activeMarkdownView(this.plugin.app);
    const fm = view && view.file ? (this.plugin.app.metadataCache.getFileCache(view.file) || {}).frontmatter || {} : {};
    const grade = gradeForKey(key, schedulerForNote(fm, this.plugin.settings));
    if (!grade) return;
    event.preventDefault();
    this.grade(grade);
  }
}

module.exports = {
  GRADES,
  GRADE_LABELS,
  NoteReviewDock,
  applyLapseAction,
  gradeForKey,
  lapseThresholdReached,
  noteReviewPreviews,
  noteReviewSnapshot,
  normalizeNoteReviewDockSettings,
  postponeDays,
  resetNoteSchedule,
  restoreNoteReviewSnapshot,
  schedulerForNote,
};
