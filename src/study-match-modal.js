"use strict";
/*
 * Match mode for the optional study skin: pair question prompts with their
 * answers. A correct match records one ordinary review, so the same scheduler
 * owns everything; a wrong tap records nothing and only raises the try count.
 */
const { Modal } = require("obsidian");
const { str } = require("./util");
const { shufflePairs } = require("./study-skin");

class StudyMatchModal extends Modal {
  constructor(app, plugin, pairs, options) {
    super(app);
    this.app = app;
    this.plugin = plugin;
    this.pairs = (Array.isArray(pairs) ? pairs : []).slice();
    this.options = options || {};
    this.backs = shufflePairs(this.pairs);
    this.selected = "";
    this.selectedAt = 0;
    this.matched = [];
    this.tries = 0;
    this.wrong = "";
    this.message = "";
    this.recorded = new Set();
  }

  onOpen() {
    this.contentEl.addClass("qt-match-modal");
    this.draw();
  }

  isMatched(id) {
    return this.matched.includes(id);
  }

  draw() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Match cards" });
    el.createDiv({
      cls: "qt-hint",
      text: "Pick a question on the left, then its answer on the right. A correct match records one review in the normal scheduler; a wrong tap records nothing.",
    });
    el.createDiv({
      cls: "qt-count",
      text: `${this.matched.length} / ${this.pairs.length} matched · ${this.tries} ${this.tries === 1 ? "try" : "tries"}`,
    });
    if (this.message) el.createDiv({ cls: "qt-hint qt-match-message", text: this.message });

    if (!this.pairs.length) {
      el.createDiv({ cls: "qt-hint", text: "No question has both a prompt and an answer to match." });
      this.addDone(el);
      return;
    }

    if (this.matched.length === this.pairs.length) {
      el.createDiv({ cls: "qt-count", text: `All pairs matched in ${this.tries} ${this.tries === 1 ? "try" : "tries"}.` });
      this.addDone(el);
      return;
    }

    const board = el.createDiv({ cls: "qt-match-board" });
    const left = board.createDiv({ cls: "qt-match-column" });
    left.createEl("h4", { text: "Questions" });
    for (const pair of this.pairs) {
      if (this.isMatched(pair.id)) continue;
      const btn = left.createEl("button", { cls: "qt-match-card", text: pair.front });
      if (this.selected === pair.id) btn.addClass("is-selected");
      btn.addEventListener("click", () => {
        this.selected = pair.id;
        this.selectedAt = Date.now();
        this.wrong = "";
        this.message = "";
        this.draw();
      });
    }

    const right = board.createDiv({ cls: "qt-match-column" });
    right.createEl("h4", { text: "Answers" });
    for (const pair of this.backs) {
      if (this.isMatched(pair.id)) continue;
      const btn = right.createEl("button", { cls: "qt-match-card qt-match-answer", text: pair.back });
      if (this.wrong === pair.id) btn.addClass("is-wrong");
      btn.addEventListener("click", () => this.pick(pair.id));
    }

    if (!this.selected) el.createDiv({ cls: "qt-hint", text: "Choose a question first." });
    this.addDone(el);
  }

  async pick(id) {
    if (!this.selected) {
      this.message = "Choose a question first.";
      this.draw();
      return;
    }
    this.tries++;
    if (this.selected !== id) {
      this.wrong = id;
      this.message = "Not that one. Try again.";
      this.draw();
      return;
    }
    const pair = this.pairs.find((item) => item.id === id) || null;
    const seconds = Math.max(1, Math.round((Date.now() - (this.selectedAt || Date.now())) / 1000));
    this.matched.push(id);
    this.selected = "";
    this.selectedAt = 0;
    this.wrong = "";
    this.message = pair ? `Matched: ${pair.back}` : "Matched.";
    await this.record(pair, seconds);
    this.draw();
  }

  async record(pair, seconds) {
    if (!pair || this.recorded.has(pair.id)) return;
    this.recorded.add(pair.id);
    const file = this.app.vault.getAbstractFileByPath(pair.path);
    if (!file || !this.plugin || typeof this.plugin.recordAttempt !== "function") return;
    try {
      await this.plugin.recordAttempt(file, { correct: true, chosen: "match", conf: 2, seconds: Math.max(1, seconds || 1) });
    } catch (error) {
      this.message = str(error && error.message ? error.message : error);
    }
  }

  addDone(el) {
    const row = el.createDiv({ cls: "qt-row" });
    const done = row.createEl("button", { text: "Done", cls: "mod-cta qt-grow" });
    done.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
    if (typeof this.options.onDone === "function") {
      this.options.onDone({ matched: this.matched.length, tries: this.tries, total: this.pairs.length });
    }
  }
}

module.exports = { StudyMatchModal };
