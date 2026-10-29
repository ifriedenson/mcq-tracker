"use strict";
const { ItemView, Notice, setIcon } = require("obsidian");
const { VIEW_TYPE_CARDS } = require("./constants");
const { localDate, str } = require("./util");
const { cardQueue, cardStats, courseOptions, deckSummary, parseCardBody } = require("./cards");
const { CardModal } = require("./card-modal");
const { renderMarkdownInto } = require("./view-helpers");
const { gradeTypedAnswer } = require("./card-grading");
const { needsAi } = require("./card-grading-ai");

const REVIEW_KEYS = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
const GRADE_LABELS = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

class CardView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.state = "browse"; // browse | review | summary
    this.deck = "";
    this.course = "";
    this.queue = [];
    this.index = 0;
    this.current = null;
    this.revealed = false;
    this.busy = false;
    this.typedAnswer = "";
    this.verdict = null;
    this.suggestedGrade = "";
    this.override = false;
    this.aiChecking = false;
    this.aiError = "";
    this.pendingGrade = false;
    this.pendingGradeId = "";
    this.session = { reviewed: 0, correct: 0, grades: { again: 0, hard: 0, good: 0, easy: 0 } };
  }

  getViewType() {
    return VIEW_TYPE_CARDS;
  }

  getDisplayText() {
    return "Cards";
  }

  getIcon() {
    return "layers";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
    // Keyboard review: space flips, 1-4 rate. Typing in a field is left alone.
    if (typeof activeDocument.addEventListener === "function") {
      this.registerDomEvent(activeDocument, "keydown", (ev) => this.onKey(ev));
    }
  }

  md(markdown, el, path) {
    renderMarkdownInto(this.app, markdown, el, path, this);
  }

  onKey(ev) {
    if (this.state !== "review" || this.busy || !this.current) return;
    const t = ev && ev.target;
    if (t && /^(input|textarea|select)$/i.test(t.tagName || "")) return;
    if (ev.key === " " || ev.key === "Enter") {
      if (this.current.answerMode && this.current.answerMode !== "flip") return;
      ev.preventDefault();
      if (!this.revealed) this.reveal();
      return;
    }
    const grade = REVIEW_KEYS[ev.key];
    if (grade && this.revealed) {
      ev.preventDefault();
      this.rate(grade);
    }
  }

  render() {
    const p = this.plugin;
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-cards" });
    if (!p.cardsEnabled || !p.cardsEnabled()) return this.renderModuleOff(root);
    root.createEl("h2", { text: "Cards" });

    if (this.state === "review") return this.renderReview(root);
    if (this.state === "summary") return this.renderSummary(root);
    this.renderBrowse(root);
  }

  renderModuleOff(root) {
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Cards are off" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: "Flashcards and vocabulary are a separate module. Your notes are untouched; turn it on under Settings, Global, Modules.",
    });
    card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () =>
      this.plugin.openSettings()
    );
  }

  renderBrowse(root) {
    const p = this.plugin;
    const today = localDate();
    const all = p.getCards();
    const stats = cardStats(all, today);
    const shown = p.filteredCards({ deck: this.deck, course: this.course });

    const tools = root.createDiv({ cls: "qt-row qt-cards-tools" });
    const add = tools.createEl("button", { text: "New card", cls: "mod-cta" });
    add.addEventListener("click", () => this.openCardModal());
    const imp = tools.createEl("button", { text: "Import" });
    imp.addEventListener("click", () =>
      p.openCardImport({ deck: this.deck, course: this.course }, () => this.render())
    );
    const exp = tools.createEl("button", { text: "Export" });
    exp.addEventListener("click", () =>
      p.openCardExport({ deck: this.deck, course: this.course })
    );
    const sync = tools.createEl("button", { text: "Tag courses from folders" });
    sync.addEventListener("click", async () => {
      const n = await p.tagCardsByCourse();
      new Notice(n ? `Tagged ${n} card${n === 1 ? "" : "s"} with a course.` : "Every card already has a course tag.");
      this.render();
    });

    const summary = root.createDiv({ cls: "qt-cards-stats" });
    summary.createSpan({ text: `${stats.total} card${stats.total === 1 ? "" : "s"}` });
    summary.createSpan({ text: `${stats.due} due` });
    summary.createSpan({ text: `${stats.fresh} new` });

    this.renderDeckPicker(root, all, today);
    this.renderCoursePicker(root, all);

    if (!all.length) {
      const empty = root.createDiv({ cls: "qt-onboard-card" });
      empty.createEl("h3", { text: "No cards yet" });
      empty.createDiv({
        cls: "qt-onboard-text",
        text: "Create a flashcard or a vocabulary note. Each card is a Markdown note with its own deck, course tag and review history.",
      });
      empty.createEl("button", { text: "Create the first card", cls: "mod-cta qt-primary" }).addEventListener("click", () =>
        this.openCardModal()
      );
      return;
    }

    const dueHere = shown.filter((c) => !Number(c.fm.attempts) || str(c.fm.next_review).slice(0, 10) <= today).length;
    const start = root.createEl("button", {
      text: dueHere ? `Start review (${dueHere})` : "Review all cards",
      cls: "mod-cta qt-primary qt-cards-start",
    });
    start.disabled = !shown.length;
    start.addEventListener("click", () => this.startReview(dueHere ? "due" : "all"));

    root.createEl("h3", { cls: "qt-cards-heading", text: "In this view" });
    if (!shown.length) {
      root.createDiv({ cls: "qt-hint", text: "No cards match this deck and course. Pick another deck or clear the course filter." });
      return;
    }
    const list = root.createDiv({ cls: "qt-cards-list" });
    const preview = shown
      .slice()
      .sort((a, b) => str(a.fm.next_review).localeCompare(str(b.fm.next_review)) || a.file.path.localeCompare(b.file.path))
      .slice(0, 12);
    for (const card of preview) {
      const row = list.createDiv({ cls: "qt-cards-row" });
      const main = row.createDiv({ cls: "qt-cards-row-main" });
      main.createDiv({ cls: "qt-cards-row-title", text: str(card.fm.card_title || card.file.basename) });
      const bits = [card.deck, card.course, card.kind === "vocab" ? "Vocabulary" : "Flashcard"].filter(Boolean);
      main.createDiv({ cls: "qt-cards-row-meta", text: bits.join(" · ") });
      const due = !Number(card.fm.attempts) ? "New" : str(card.fm.next_review).slice(0, 10) <= today ? "Due" : `Due ${str(card.fm.next_review).slice(0, 10)}`;
      row.createSpan({ cls: `qt-cards-due${due === "Due" ? " is-due" : ""}`, text: due });
      const open = row.createEl("button", { text: "Open", cls: "qt-link" });
      open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(card.file));
    }
    if (shown.length > preview.length) {
      root.createDiv({ cls: "qt-hint", text: `Showing ${preview.length} of ${shown.length}. Start a review for the rest.` });
    }
  }

  renderDeckPicker(root, cards, today) {
    const decks = deckSummary(cards, this.plugin.settings, today);
    const wrap = root.createDiv({ cls: "qt-cards-filter" });
    wrap.createSpan({ cls: "qt-cards-filter-label", text: "Deck" });
    const chips = wrap.createDiv({ cls: "qt-chips" });
    const addChip = (label, value, count) => {
      const b = chips.createEl("button", { text: count === undefined ? label : `${label} ${count}`, cls: "qt-chip" });
      if ((this.deck || "") === value) b.addClass("is-selected");
      b.addEventListener("click", () => {
        this.deck = this.deck === value ? "" : value;
        this.render();
      });
    };
    addChip("All decks", "", undefined);
    for (const deck of decks) addChip(deck.name, deck.name, deck.total);
    if (!decks.length) chips.createSpan({ cls: "qt-hint", text: "No decks yet" });
  }

  renderCoursePicker(root, cards) {
    const courses = courseOptions(cards);
    if (!courses.length) return;
    const wrap = root.createDiv({ cls: "qt-cards-filter" });
    wrap.createSpan({ cls: "qt-cards-filter-label", text: "Course" });
    const chips = wrap.createDiv({ cls: "qt-chips" });
    const add = (label, value) => {
      const b = chips.createEl("button", { text: label, cls: "qt-chip" });
      if ((this.course || "") === value) b.addClass("is-selected");
      b.addEventListener("click", () => {
        this.course = this.course === value ? "" : value;
        this.render();
      });
    };
    add("All courses", "");
    for (const course of courses) add(course, course);
  }

  openCardModal() {
    new CardModal(
      this.app,
      this.plugin,
      { deck: this.deck, course: this.course },
      (result) => {
        if (result && result.path) new Notice(`Created ${result.path}.`);
        this.render();
      }
    ).open();
  }

  startReview(order, only) {
    const p = this.plugin;
    const pool = Array.isArray(only) ? only : p.filteredCards({ deck: this.deck, course: this.course });
    const queue = cardQueue(pool, {
      today: localDate(),
      order: order || p.settings.cards.order,
      limit: Array.isArray(only) ? Math.max(1, only.length) : p.settings.cards.reviewLimit,
    });
    if (!queue.length) {
      new Notice("Nothing to review in this deck. Try another deck or review all cards.");
      return;
    }
    this.queue = queue;
    this.index = 0;
    this.state = "review";
    this.session = { reviewed: 0, correct: 0, grades: { again: 0, hard: 0, good: 0, easy: 0 } };
    this.showCard();
  }

  /** Start a one-card review from the unified due queue. */
  async reviewCard(card) {
    if (!card) return;
    this.queue = [card];
    this.index = 0;
    this.state = "review";
    this.session = { reviewed: 0, correct: 0, grades: { again: 0, hard: 0, good: 0, easy: 0 } };
    await this.showCard();
  }

  async showCard() {
    const card = this.queue[this.index];
    if (!card) return this.finish();
    this.current = null;
    this.revealed = false;
    this.typedAnswer = "";
    this.verdict = null;
    this.suggestedGrade = "";
    this.override = false;
    this.aiChecking = false;
    this.aiError = "";
    this.pendingGrade = false;
    this.pendingGradeId = "";
    try {
      const text = await this.app.vault.cachedRead(card.file);
      this.current = { ...card, body: parseCardBody(text, card.fm) };
    } catch (e) {
      new Notice(`Could not read ${card.file.path}.`);
      this.queue.splice(this.index, 1);
      return this.showCard();
    }
    this.render();
  }

  reveal() {
    if (!this.current) return;
    this.revealed = true;
    this.render();
  }

  /** Grade a typed or dictated answer locally, then ask AI only when the local result is unsure. */
  async checkTyped(value) {
    if (!this.current || this.aiChecking) return;
    const card = this.current;
    const typed = str(value).trim();
    const graded = gradeTypedAnswer(card.body.back, typed, {
      strictness: card.gradingStrictness,
      variants: card.body.acceptedVariants,
    });
    this.typedAnswer = typed;
    this.verdict = graded;
    this.suggestedGrade = graded.suggestedGrade;
    this.override = false;
    this.revealed = true;
    this.aiError = "";
    this.pendingGrade = false;
    this.pendingGradeId = "";
    this.render();

    if (!needsAi(graded)) return;
    const st = this.plugin.settings;
    if (!st.cards.aiGrading) return;
    if (!st.ai.enabled) {
      this.aiError = "AI fallback is on for cards, but AI features are off. Turn them on under Settings, Global, Modules.";
      this.render();
      return;
    }
    this.aiChecking = true;
    this.render();
    try {
      const ai = await this.plugin.gradeCardWithAi(card, typed, card.gradingStrictness);
      if (this.current !== card) return;
      this.verdict = ai;
      this.suggestedGrade = ai.suggestedGrade;
      this.override = false;
    } catch (e) {
      if (this.current !== card) return;
      this.aiError = str(e && e.message ? e.message : e) || "The AI grader is unavailable.";
      this.pendingGrade = true;
      try {
        this.pendingGradeId = this.plugin.queueCardGrade(card, typed, card.gradingStrictness);
      } catch (err) {
        this.pendingGradeId = "";
      }
    } finally {
      this.aiChecking = false;
      this.render();
    }
  }

  async rate(grade) {
    if (this.busy || this.aiChecking || !this.current) return;
    this.busy = true;
    const card = this.current;
    const override = !!(this.verdict && this.suggestedGrade && grade !== this.suggestedGrade);
    try {
      const extra = this.verdict
        ? {
            typedAnswer: this.typedAnswer,
            verdict: this.verdict.verdict,
            matchedBy: this.verdict.matchedBy,
            verdictOverride: override,
            gradedBy: this.pendingGrade ? "self" : this.verdict.gradedBy || "deterministic",
            gradeStatus: this.pendingGrade ? "self" : "graded",
            gradeConfidence: this.verdict.confidence,
            gradeFeedback: this.verdict.reason,
          }
        : null;
      const summary = await this.plugin.recordCardReview(card, grade, 0, extra);
      if (this.pendingGrade && this.pendingGradeId) this.plugin.discardPendingCardGrade(this.pendingGradeId);
      if (summary && summary.queued) {
        new Notice("Saved offline. This card review will be written when the vault is available.", 6000);
      }
      this.session.reviewed++;
      this.session.grades[grade] = (this.session.grades[grade] || 0) + 1;
      if (grade !== "again") this.session.correct++;
      this.index++;
      this.busy = false;
      if (this.index >= this.queue.length) return this.finish();
      await this.showCard();
    } catch (e) {
      this.busy = false;
      new Notice(str(e && e.message) || "Could not save this review.");
    }
  }

  finish() {
    this.state = "summary";
    this.current = null;
    this.render();
  }

  renderReview(root) {
    root.addClass("qt-cards-review");
    const top = root.createDiv({ cls: "qt-row qt-cards-top" });
    const back = top.createEl("button", { text: "Decks" });
    back.addEventListener("click", () => {
      this.state = "browse";
      this.current = null;
      this.render();
    });
    top.createDiv({
      cls: "qt-cards-progress",
      text: `${this.index + 1} / ${this.queue.length}`,
    });
    if (!this.current) {
      root.createDiv({ cls: "qt-hint", text: "Loading card…" });
      return;
    }
    const card = this.current;
    const box = root.createDiv({ cls: "qt-cards-box" });
    const head = box.createDiv({ cls: "qt-cards-cardhead" });
    const chips = head.createDiv({ cls: "qt-chips" });
    chips.createSpan({ cls: "qt-cards-deck", text: card.deck });
    if (card.course) chips.createSpan({ cls: "qt-cards-course", text: card.course });
    if (card.body.kind === "vocab") chips.createSpan({ cls: "qt-cards-kind", text: "Vocabulary" });
    else if (card.body.cardType !== "basic") chips.createSpan({ cls: "qt-cards-kind", text: card.body.cardType });
    const open = head.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": "Open note", title: "Open note" } });
    setIcon(open, "file-text");
    open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(card.file));

    const front = box.createDiv({ cls: "qt-cards-front" });
    if (card.body.language || card.body.partOfSpeech) {
      front.createDiv({ cls: "qt-cards-lang", text: [card.body.language, card.body.partOfSpeech].filter(Boolean).join(" · ") });
    }
    this.md(card.body.front || "*This card has no front.*", front.createDiv({ cls: "qt-cards-term" }), card.file.path);

    const mode = card.answerMode || "flip";
    if (!this.revealed && mode !== "flip") {
      const typedWrap = root.createDiv({ cls: "qt-cards-typed-wrap" });
      typedWrap.createEl("label", {
        text: mode === "speak" ? "Your spoken answer (dictation or type)" : "Your answer",
      });
      const typed = typedWrap.createEl("textarea", {
        cls: "qt-cards-typed",
        attr: { rows: "3", placeholder: mode === "speak" ? "Use your device's dictation, or type here…" : "Type your answer…" },
      });
      typed.value = this.typedAnswer || "";
      typed.addEventListener("input", () => (this.typedAnswer = typed.value));
      typed.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          this.checkTyped(typed.value);
        }
      });
      const check = root.createEl("button", { text: "Check answer", cls: "mod-cta qt-primary qt-cards-show" });
      check.addEventListener("click", () => this.checkTyped(typed.value));
      root.createDiv({
        cls: "qt-hint",
        text:
          mode === "speak"
            ? "Use your keyboard's dictation or microphone key. The local match stays on this device; if AI fallback is on, only the card front, stored answer and your answer are sent when the local check is unsure."
            : "Exact wording is not required at standard strictness; small typos and accepted variants count. If AI fallback is on, only the card front, stored answer and your answer are sent when the local check is unsure.",
      });
      return;
    }

    if (!this.revealed) {
      const show = root.createEl("button", { text: "Show answer", cls: "mod-cta qt-primary qt-cards-show" });
      show.addEventListener("click", () => this.reveal());
      root.createDiv({ cls: "qt-hint", text: "Space or Enter also flips the card." });
      return;
    }

    if (this.verdict) {
      const kind = this.aiChecking ? "checking" : this.verdict.verdict;
      const verdict = root.createDiv({ cls: `qt-cards-verdict qt-cards-verdict-${kind}` });
      verdict.createDiv({
        cls: "qt-cards-verdict-title",
        text: this.aiChecking ? "Checking with AI…" : this.verdict.verdict === "correct" ? "Correct" : this.verdict.verdict === "partial" ? "Partly correct" : "Not yet",
      });
      verdict.createDiv({
        cls: "qt-cards-verdict-reason",
        text: this.aiChecking ? "The local check was unsure, so the AI is taking a second look." : this.verdict.reason,
      });
      if (this.typedAnswer) verdict.createDiv({ cls: "qt-cards-verdict-typed", text: `You wrote: ${this.typedAnswer}` });
      if (!this.aiChecking && this.verdict.gradedBy === "ai") verdict.createDiv({ cls: "qt-hint", text: "Graded by AI." });
    }
    if (this.aiError) root.createDiv({ cls: "qt-error", text: this.aiError });
    if (this.pendingGrade) root.createDiv({ cls: "qt-hint qt-cards-pending", text: "Pending grade. Rate the card yourself to save this review now, or leave it and it will be graded when AI is available." });

    const answer = root.createDiv({ cls: "qt-cards-box qt-cards-answer" });
    answer.createDiv({ cls: "qt-cards-answer-label", text: card.body.kind === "vocab" ? "Definition" : "Answer" });
    this.md(card.body.back || "*This card has no answer.*", answer.createDiv({ cls: "qt-cards-back" }), card.file.path);
    if (card.body.example) {
      answer.createDiv({ cls: "qt-cards-answer-label", text: "Example" });
      this.md(card.body.example, answer.createDiv({ cls: "qt-cards-example" }), card.file.path);
    }

    const ratings = root.createDiv({ cls: "qt-cards-ratings" });
    const buttons = [
      ["again", "Again", "1"],
      ["hard", "Hard", "2"],
      ["good", "Good", "3"],
      ["easy", "Easy", "4"],
    ];
    for (const [grade, label, key] of buttons) {
      const b = ratings.createEl("button", { text: label, cls: `qt-cards-rate qt-cards-rate-${grade}` });
      if (grade === this.suggestedGrade) b.addClass("is-suggested");
      if (this.aiChecking) b.disabled = true;
      b.createSpan({ cls: "qt-cards-rate-key", text: key });
      b.addEventListener("click", () => this.rate(grade));
    }
    root.createDiv({
      cls: "qt-hint",
      text: this.aiChecking
        ? "Waiting for the AI check. You can rate the card after it finishes."
        : this.pendingGrade
          ? "The AI grade is pending. Rate the card yourself now, or leave it and it will be graded later."
          : this.verdict
            ? `Suggested rating: ${GRADE_LABELS[this.suggestedGrade] || "Good"}. Choose another rating to record an override.`
            : "Rate how well you recalled it. 1 = again, 4 = easy.",
    });
  }

  renderSummary(root) {
    const s = this.session;
    const box = root.createDiv({ cls: "qt-onboard-card" });
    box.createEl("h3", { text: "Review complete" });
    box.createDiv({
      cls: "qt-onboard-text",
      text: `${s.reviewed} card${s.reviewed === 1 ? "" : "s"} reviewed · ${s.correct} recalled.`,
    });
    const row = box.createDiv({ cls: "qt-row" });
    row.createEl("span", { cls: "qt-cards-summary", text: `Again ${s.grades.again} · Hard ${s.grades.hard} · Good ${s.grades.good} · Easy ${s.grades.easy}` });
    const again = box.createEl("button", { text: "Review again", cls: "mod-cta qt-primary" });
    again.addEventListener("click", () => this.startReview("all"));
    const back = box.createEl("button", { text: "Back to decks" });
    back.addEventListener("click", () => {
      this.state = "browse";
      this.render();
    });
  }
}

module.exports = {
  VIEW_TYPE_CARDS,
  CardView,
};
