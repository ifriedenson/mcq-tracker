"use strict";
const { Modal, Notice } = require("obsidian");
const { renderMarkdownInto } = require("./view-helpers");
const {
  clearSimpleNoteQuizMarks,
  selectSimpleNoteQuizQuestions,
  simpleNoteQuizCounts,
} = require("./simple-note-quiz");
const { str } = require("./util");

const MODE_LABELS = { all: "All questions", unmarked: "Unmarked", unknown: "Missed" };

/** A small, note-local quiz. Marks are saved only when the answer summary is accepted. */
class SimpleNoteQuizModal extends Modal {
  constructor(app, plugin, file, parsed, options) {
    super(app);
    this.app = app;
    this.plugin = plugin;
    this.file = file;
    this.parsed = parsed;
    this.options = options || parsed.options || {};
    this.phase = "setup";
    this.mode = "all";
    this.queue = [];
    this.index = 0;
    this.results = [];
    this.busy = false;
    this.error = "";
    this.startedAt = 0;
  }

  onOpen() {
    if (this.modalEl && typeof this.modalEl.addClass === "function") this.modalEl.addClass("qt-simple-note-quiz-modal");
    this.draw();
  }

  draw() {
    if (!this.contentEl) return;
    const el = this.contentEl;
    el.empty();
    if (this.phase === "question" || this.phase === "answer") this.drawCard(el);
    else if (this.phase === "summary") this.drawSummary(el);
    else this.drawSetup(el);
  }

  drawSetup(el) {
    const counts = simpleNoteQuizCounts(this.parsed.questions);
    el.createEl("h3", { text: "Simple note quiz" });
    el.createDiv({
      cls: "qt-hint",
      text: "Questions are lines ending in your question marker. The lines below each question are its answer. Marks are saved back to this note only when you accept them.",
    });
    el.createDiv({
      cls: "qt-simple-note-quiz-count",
      text: `${counts.total} question${counts.total === 1 ? "" : "s"} · ${counts.known} known · ${counts.unknown} missed · ${counts.unmarked} unmarked`,
    });
    if (this.error) el.createDiv({ cls: "qt-error", text: this.error });

    if (!counts.total) {
      el.createDiv({ cls: "qt-hint", text: "No questions with answers were found in this note." });
      this.addCloseButton(el);
    } else {
      const row = el.createDiv({ cls: "qt-row qt-simple-note-quiz-actions" });
      this.addStartButton(row, "all", `Start all (${counts.total})`, counts.total);
      this.addStartButton(row, "unmarked", `Review unmarked (${counts.unmarked})`, counts.unmarked);
      this.addStartButton(row, "unknown", `Review missed (${counts.unknown})`, counts.unknown);
      if (counts.known || counts.unknown) {
        row.createEl("button", { text: "Clear marks", cls: "qt-link" }).addEventListener("click", () => this.clearMarks());
      }
      this.addCloseButton(el);
    }

    if (this.parsed.issues && this.parsed.issues.length) {
      const issues = el.createDiv({ cls: "qt-simple-note-quiz-issues" });
      for (const issue of this.parsed.issues.slice(0, 6)) issues.createDiv({ cls: "qt-hint", text: issue });
      if (this.parsed.issues.length > 6) {
        issues.createDiv({ cls: "qt-hint", text: `…and ${this.parsed.issues.length - 6} more.` });
      }
    }
  }

  addStartButton(el, mode, label, count) {
    const button = el.createEl("button", { text: label, cls: "qt-simple-note-quiz-start" });
    button.disabled = !count;
    button.addEventListener("click", () => this.start(mode));
  }

  addCloseButton(el) {
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
  }

  start(mode) {
    this.error = "";
    this.mode = mode;
    this.queue = selectSimpleNoteQuizQuestions(this.parsed.questions, mode, {
      shuffle: this.options.shuffle,
      random: this.options.random,
    });
    this.index = 0;
    this.results = [];
    this.startedAt = Date.now();
    this.phase = this.queue.length ? "question" : "setup";
    this.draw();
  }

  drawCard(el) {
    const item = this.queue[this.index];
    if (!item) {
      this.phase = "setup";
      this.draw();
      return;
    }
    const answer = this.phase === "answer";
    el.createEl("h3", { text: "Simple note quiz" });
    el.createDiv({
      cls: "qt-hint",
      text: `${MODE_LABELS[this.mode] || MODE_LABELS.all} · ${this.index + 1} of ${this.queue.length}`,
    });
    el.createDiv({ cls: "qt-simple-note-quiz-progress", text: item.mark ? `Previously marked ${item.mark}.` : "Not marked yet." });

    const question = el.createDiv({ cls: "qt-simple-note-quiz-question" });
    renderMarkdownInto(this.app, item.question, question, this.file.path, this);

    if (!answer) {
      const row = el.createDiv({ cls: "qt-row" });
      row.createEl("button", { text: "Show answer", cls: "mod-cta" }).addEventListener("click", () => {
        this.phase = "answer";
        this.draw();
      });
      row.createEl("button", { text: "Exit" }).addEventListener("click", () => {
        this.phase = "setup";
        this.draw();
      });
      return;
    }

    const answerEl = el.createDiv({ cls: "qt-simple-note-quiz-answer" });
    renderMarkdownInto(this.app, item.answer, answerEl, this.file.path, this);
    const row = el.createDiv({ cls: "qt-row qt-simple-note-quiz-actions" });
    row.createEl("button", { text: "Known", cls: "mod-cta" }).addEventListener("click", () => this.record("known"));
    row.createEl("button", { text: "Still learning" }).addEventListener("click", () => this.record("unknown"));
    row.createEl("button", { text: "Exit", cls: "qt-link" }).addEventListener("click", () => {
      this.phase = "setup";
      this.draw();
    });
  }

  record(status) {
    const item = this.queue[this.index];
    if (!item) return;
    this.results.push({ lineIndex: item.lineIndex, status });
    this.index++;
    this.phase = this.index >= this.queue.length ? "summary" : "question";
    this.draw();
  }

  drawSummary(el) {
    const known = this.results.filter((result) => result.status === "known").length;
    const unknown = this.results.length - known;
    el.createEl("h3", { text: "Quiz complete" });
    el.createDiv({
      cls: "qt-simple-note-quiz-score",
      text: `Known ${known} of ${this.results.length}${unknown ? ` · ${unknown} still learning` : ""}.`,
    });
    el.createDiv({
      cls: "qt-hint",
      text: "Save the marks to this note? You can clear them later from the quiz setup.",
    });
    if (this.error) el.createDiv({ cls: "qt-error", text: this.error });
    const row = el.createDiv({ cls: "qt-row qt-simple-note-quiz-actions" });
    const save = row.createEl("button", { text: this.busy ? "Saving…" : "Save marks", cls: "mod-cta" });
    save.disabled = this.busy;
    save.addEventListener("click", () => this.saveMarks());
    row.createEl("button", { text: "Start over" }).addEventListener("click", () => {
      this.phase = "setup";
      this.results = [];
      this.draw();
    });
    row.createEl("button", { text: "Close", cls: "qt-link" }).addEventListener("click", () => this.close());
  }

  async saveMarks() {
    if (this.busy || !this.results.length) return;
    this.busy = true;
    this.error = "";
    this.draw();
    try {
      const result = await this.plugin.saveSimpleNoteQuizMarks(this.file, this.results);
      new Notice(`Saved ${result.changed || 0} note quiz mark${result.changed === 1 ? "" : "s"}.`, 5000);
      this.close();
    } catch (e) {
      this.busy = false;
      this.error = str(e && e.message ? e.message : e) || "Could not save the marks.";
      this.draw();
    }
  }

  async clearMarks() {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    try {
      const result = await this.plugin.clearSimpleNoteQuizMarks(this.file);
      this.parsed = await this.plugin.loadSimpleNoteQuiz(this.file);
      this.busy = false;
      this.draw();
      new Notice(`Cleared ${result.changed || 0} note quiz mark${result.changed === 1 ? "" : "s"}.`, 5000);
    } catch (e) {
      this.busy = false;
      this.error = str(e && e.message ? e.message : e) || "Could not clear the marks.";
      this.draw();
    }
  }

  onClose() {
    if (this.contentEl) this.contentEl.empty();
  }
}

module.exports = {
  MODE_LABELS,
  SimpleNoteQuizModal,
};
