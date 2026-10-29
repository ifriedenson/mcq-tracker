"use strict";
/*
 * Interleaved mixed review across questions, flashcards and vocabulary.
 *
 * The queue is built from the unified due queue, then woven so consecutive
 * items alternate between item families. Each item is a recall prompt: reveal
 * the answer, then rate it. Ratings go through the existing question and card
 * schedulers, so this is a session UI, not another review system.
 */
const { Modal, Notice } = require("obsidian");
const { localDate, str } = require("./util");
const { extractRationale } = require("./notes");
const { parseCardBody } = require("./cards");
const { buildDueQueue } = require("./due-queue");
const { loadQuestionData, renderMarkdownInto } = require("./view-helpers");

const MIXED_LIMIT = 20;
const MIXED_GRADES = {
  again: { label: "Again", key: "1", correct: false, conf: 0, rating: 1 },
  hard: { label: "Hard", key: "2", correct: true, conf: 1, rating: 2 },
  good: { label: "Good", key: "3", correct: true, conf: 2, rating: 3 },
  easy: { label: "Easy", key: "4", correct: true, conf: 3, rating: 4 },
};

function gradeKey(value) {
  const key = str(value).toLowerCase();
  return MIXED_GRADES[key] ? key : "good";
}

/** A question rating in the same attempt shape the normal practice path writes. */
function mixedQuestionAttempt(grade, seconds, now) {
  const key = gradeKey(grade);
  const info = MIXED_GRADES[key];
  return {
    correct: info.correct,
    conf: info.conf,
    rating: info.rating,
    grade: key,
    chosen: "",
    seconds: Math.max(0, Math.round(Number(seconds) || 0)),
    now: now instanceof Date ? now : new Date(),
  };
}

function weave(rows) {
  const buckets = { question: [], card: [], vocab: [] };
  for (const row of rows) {
    const bucket = row.type === "question" ? "question" : row.type === "vocab" ? "vocab" : "card";
    buckets[bucket].push(row);
  }
  const out = [];
  let moved = true;
  while (moved) {
    moved = false;
    for (const key of ["question", "card", "vocab"]) {
      if (!buckets[key].length) continue;
      out.push(buckets[key].shift());
      moved = true;
    }
  }
  return out;
}

/**
 * One due session across modules. Due items stay ahead of new items; within
 * each group the item families alternate instead of arriving in long blocks.
 */
function buildMixedQueue(questions, cards, options) {
  const opts = options || {};
  const due = buildDueQueue(questions, cards, { today: str(opts.today) || localDate(), limit: 0 });
  const dueRows = due.all.filter((row) => !row.isNew);
  const newRows = due.all.filter((row) => row.isNew);
  const rows = [...weave(dueRows), ...weave(newRows)];
  const rawLimit = opts.limit === undefined ? MIXED_LIMIT : Math.round(Number(opts.limit) || 0);
  const limit = rawLimit === 0 ? rows.length : Math.max(1, Math.min(100, rawLimit || MIXED_LIMIT));
  return {
    items: rows.slice(0, limit),
    counts: due.counts,
  };
}

function typeLabel(type) {
  return type === "question" ? "Question" : type === "vocab" ? "Vocabulary" : "Flashcard";
}

class MixedReviewModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.app = app;
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.queue = [];
    this.index = 0;
    this.current = null;
    this.revealed = false;
    this.loading = false;
    this.busy = false;
    this.startedAt = 0;
    this.state = "review";
    this.session = { reviewed: 0, correct: 0, grades: { again: 0, hard: 0, good: 0, easy: 0 } };
  }

  async onOpen() {
    this.contentEl.empty();
    await this.rebuild();
  }

  async rebuild() {
    const queue = buildMixedQueue(this.plugin.getQuestions(), this.plugin.getCards(), {
      today: this.options.today,
      limit: this.options.limit,
    });
    this.queue = queue.items;
    this.index = 0;
    this.current = null;
    this.revealed = false;
    this.state = "review";
    this.session = { reviewed: 0, correct: 0, grades: { again: 0, hard: 0, good: 0, easy: 0 } };
    if (!this.queue.length) {
      this.renderEmpty();
      return;
    }
    await this.loadCurrent();
  }

  md(markdown, el, path) {
    renderMarkdownInto(this.app, str(markdown), el, path || "", this);
  }

  async loadCurrent() {
    const row = this.queue[this.index];
    if (!row) return this.finish();
    this.current = null;
    this.revealed = false;
    this.loading = true;
    this.render();
    try {
      if (row.type === "question") {
        this.current = { row, question: await loadQuestionData(this.plugin, row.source) };
      } else {
        const text = await this.app.vault.cachedRead(row.source.file);
        this.current = { row, card: { ...row.source, body: parseCardBody(text, row.source.fm) } };
      }
    } catch (e) {
      new Notice(`Could not open ${row.title || row.path}.`);
      this.queue.splice(this.index, 1);
      return this.loadCurrent();
    }
    this.loading = false;
    this.startedAt = Date.now();
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-mixed" });
    if (this.state === "summary") return this.renderSummary(root);
    if (!this.queue.length) return this.renderEmpty(root);
    if (this.loading || !this.current) {
      root.createEl("h2", { text: "Mixed review" });
      root.createDiv({ cls: "qt-hint", text: "Loading the next item…" });
      return;
    }
    this.renderReview(root);
  }

  renderEmpty(root) {
    const wrap = root || this.contentEl.createDiv({ cls: "qt-wrap qt-mixed" });
    wrap.createEl("h2", { text: "Mixed review" });
    const card = wrap.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Nothing due across modules" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: "Turn on both MCQ Tracker and Cards, and add or review some questions and cards. Due work from both modules will be woven into one session.",
    });
    const row = card.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Open due queue", cls: "mod-cta" }).addEventListener("click", () => {
      this.plugin.openDueQueue();
      this.close();
    });
    row.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
  }

  renderReview(root) {
    const row = this.current.row;
    const top = root.createDiv({ cls: "qt-row qt-mixed-top" });
    const close = top.createEl("button", { text: "Close", cls: "qt-link" });
    close.addEventListener("click", () => this.close());
    top.createDiv({
      cls: "qt-mixed-progress",
      text: `${this.index + 1} / ${this.queue.length}`,
    });

    const head = root.createDiv({ cls: "qt-mixed-head" });
    head.createSpan({ cls: `qt-mixed-badge qt-mixed-${row.type}`, text: typeLabel(row.type) });
    if (row.course) head.createSpan({ cls: "qt-cards-course", text: row.course });
    if (row.deck) head.createSpan({ cls: "qt-cards-deck", text: row.deck });
    root.createDiv({ cls: "qt-mixed-title", text: row.title });
    if (row.meta) root.createDiv({ cls: "qt-mixed-meta", text: row.meta });

    const box = root.createDiv({ cls: "qt-cards-box qt-mixed-box" });
    if (row.type === "question") this.renderQuestion(box);
    else this.renderCard(box);

    if (!this.revealed) {
      const show = root.createEl("button", { text: "Show answer", cls: "mod-cta qt-primary qt-cards-show" });
      show.addEventListener("click", () => this.reveal());
      root.createDiv({ cls: "qt-hint", text: "Recall the answer first, then reveal it and rate how well you did." });
      return;
    }

    this.renderRatings(root);

    const foot = root.createDiv({ cls: "qt-mixed-foot" });
    const open = foot.createEl("button", { text: "Open note", cls: "qt-link" });
    open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(row.source.file));
    foot.createDiv({ cls: "qt-hint", text: "Ratings save to the note and the shared scheduler immediately." });
  }

  renderQuestion(box) {
    const data = this.current.question;
    const sections = data.sections || {};
    if (sections.stimulus) this.md(sections.stimulus, box.createDiv({ cls: "qt-mixed-stimulus" }), this.current.row.path);
    const stem = box.createDiv({ cls: "qt-mixed-stem" });
    this.md(sections.question || this.current.row.title, stem, this.current.row.path);

    if (Array.isArray(sections.choices) && sections.choices.length) {
      const choices = box.createDiv({ cls: "qt-mixed-choices" });
      for (const choice of sections.choices) {
        const line = choices.createDiv({ cls: "qt-mixed-choice" });
        line.createSpan({ cls: "qt-mixed-letter", text: choice.letter });
        line.createSpan({ text: choice.text });
      }
    }

    if (!this.revealed) return;
    const answer = box.createDiv({ cls: "qt-cards-box qt-cards-answer qt-mixed-answer" });
    answer.createDiv({ cls: "qt-cards-answer-label", text: "Answer" });
    if (data.key) answer.createDiv({ cls: "qt-mixed-key", text: `Correct answer: ${data.key}` });
    const rationale = extractRationale(sections.answer) || sections.answer;
    if (rationale) this.md(rationale, answer.createDiv({ cls: "qt-cards-back" }), this.current.row.path);
    else answer.createDiv({ cls: "qt-hint", text: "This note has no answer text to show." });
  }

  renderCard(box) {
    const card = this.current.card;
    const body = card.body || {};
    if (body.language || body.partOfSpeech) {
      box.createDiv({ cls: "qt-cards-lang", text: [body.language, body.partOfSpeech].filter(Boolean).join(" · ") });
    }
    const front = box.createDiv({ cls: "qt-cards-front" });
    this.md(body.front || "*This card has no front.*", front.createDiv({ cls: "qt-cards-term" }), this.current.row.path);
    if (body.cardType === "image-occlusion") {
      box.createDiv({ cls: "qt-hint", text: "Open this card in Cards to see the diagram mask." });
    }
    if (!this.revealed) return;
    const answer = box.createDiv({ cls: "qt-cards-box qt-cards-answer qt-mixed-answer" });
    answer.createDiv({ cls: "qt-cards-answer-label", text: body.kind === "vocab" ? "Definition" : "Answer" });
    this.md(body.back || "*This card has no answer.*", answer.createDiv({ cls: "qt-cards-back" }), this.current.row.path);
    if (body.example) {
      answer.createDiv({ cls: "qt-cards-answer-label", text: "Example" });
      this.md(body.example, answer.createDiv({ cls: "qt-cards-example" }), this.current.row.path);
    }
  }

  renderRatings(root) {
    const ratings = root.createDiv({ cls: "qt-cards-ratings qt-mixed-ratings" });
    for (const [grade, info] of Object.entries(MIXED_GRADES)) {
      const button = ratings.createEl("button", { text: info.label, cls: `qt-cards-rate qt-cards-rate-${grade}` });
      button.createSpan({ cls: "qt-cards-rate-key", text: info.key });
      if (this.busy) button.disabled = true;
      button.addEventListener("click", () => this.rate(grade));
    }
    root.createDiv({ cls: "qt-hint", text: "Again means not recalled; Hard, Good and Easy mark it recalled and schedule it." });
  }

  reveal() {
    if (!this.current) return;
    this.revealed = true;
    this.render();
  }

  async rate(grade) {
    if (this.busy || !this.current) return;
    this.busy = true;
    const row = this.current.row;
    const seconds = Math.max(0, Math.round((Date.now() - this.startedAt) / 1000));
    const key = gradeKey(grade);
    try {
      const summary =
        row.type === "question"
          ? await this.plugin.recordAttempt(row.source.file, mixedQuestionAttempt(key, seconds))
          : await this.plugin.recordCardReview(row.source, key, seconds);
      if (summary && summary.queued) {
        new Notice("Saved offline. This result will be written when the vault is available.", 6000);
      }
      this.session.reviewed++;
      if (key !== "again") this.session.correct++;
      this.session.grades[key] = (this.session.grades[key] || 0) + 1;
      this.index++;
      this.busy = false;
      if (this.index >= this.queue.length) return this.finish();
      await this.loadCurrent();
    } catch (e) {
      this.busy = false;
      new Notice(str(e && e.message) || "Could not save this review.");
      this.render();
    }
  }

  finish() {
    this.state = "summary";
    this.current = null;
    this.render();
  }

  renderSummary(root) {
    const s = this.session;
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Mixed review complete" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: `${s.reviewed} item${s.reviewed === 1 ? "" : "s"} reviewed · ${s.correct} recalled.`,
    });
    card.createDiv({
      cls: "qt-cards-summary",
      text: `Again ${s.grades.again} · Hard ${s.grades.hard} · Good ${s.grades.good} · Easy ${s.grades.easy}`,
    });
    const row = card.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Review again", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.rebuild());
    row.createEl("button", { text: "Open due queue" }).addEventListener("click", () => {
      this.plugin.openDueQueue();
      this.close();
    });
    row.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
    this.onDone();
  }
}

module.exports = {
  MIXED_GRADES,
  MIXED_LIMIT,
  buildMixedQueue,
  mixedQuestionAttempt,
  MixedReviewModal,
};
