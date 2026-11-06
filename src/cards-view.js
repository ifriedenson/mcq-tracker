"use strict";
const { ItemView, Notice, setIcon } = require("obsidian");
const { VIEW_TYPE_CARDS } = require("./constants");
const { localDate, str } = require("./util");
const { CARD_TYPE_LABELS, cardQueue, cardStats, courseOptions, deckSummary, parseCardBody, revealAnimationClass } = require("./cards");
const { isDue, nextReviewTime } = require("./filters");
const { CardModal } = require("./card-modal");
const { renderMarkdownInto } = require("./view-helpers");
const { gradeTypedAnswer } = require("./card-grading");
const { needsAi } = require("./card-grading-ai");
const { API_PRESETS } = require("./api-client");
const { resolveApiKey } = require("./secret-keys");
const { pendingGradeCounts } = require("./card-grade-queue");
const { splitSourceContext } = require("./source-recall");
const { formatInterval, intervalPreviews } = require("./interval-preview");
const { cramIntervalLabel, cramPreviews } = require("./cram");
const { buildRetention } = require("./analytics");

const REVIEW_KEYS = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
const GRADE_LABELS = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

/** Read the OS preference and CSS support once per reveal, with safe fallbacks. */
function revealEnvironment() {
  const win = typeof activeWindow !== "undefined" && activeWindow ? activeWindow : typeof window !== "undefined" ? window : null;
  if (!win) return { reducedMotion: false, supportsTransition: true };
  let reducedMotion = false;
  try {
    reducedMotion = typeof win.matchMedia === "function" && !!win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reducedMotion = false;
  }
  let supportsTransition = true;
  try {
    if (win.CSS && typeof win.CSS.supports === "function") supportsTransition = win.CSS.supports("transition", "opacity 1s");
  } catch (e) {
    supportsTransition = true;
  }
  return { reducedMotion, supportsTransition };
}

/** A visible, actionable message for the browser's speech-recognition errors. */
function speechErrorMessage(code) {
  const reason = String(code || "").trim().toLowerCase();
  if (reason === "not-allowed" || reason === "service-not-allowed") {
    return "Microphone access was denied. Allow microphone access for Obsidian, or type the answer instead.";
  }
  if (reason === "audio-capture") return "No microphone was found. Type the answer instead.";
  if (reason === "network") return "Speech recognition could not reach its speech service. Check your connection, or type the answer instead.";
  if (reason === "no-speech") return "No speech was heard. Try the microphone again, or type the answer instead.";
  if (reason === "language-not-supported") return "This device does not support speech recognition for its current language. Type the answer instead.";
  return "The microphone could not transcribe that. Try again, or type the answer instead.";
}

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
    this.revealEffect = ""; // consumed by the next render, so a refresh never replays the animation
    this.previewSource = null;
    this.previewValues = null;
    this.previewBuilds = 0;
    this.previewCram = false;
    this.speechFactory = null; // tests and hosts can inject a recognition boundary
    this.speechRecognition = null;
    this.speechListening = false;
    this.speechError = "";
    this.cram = false;
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

  /** Resolve a vault image to a URL the img element can display. */
  imageResourcePath(image, sourcePath) {
    const link = str(image).trim().replace(/^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/, "$1").replace(/^!\[[^\]]*\]\(([^)]+)\)$/, "$1").trim();
    if (!link) return "";
    if (/^https?:\/\//i.test(link)) return link;
    const file = this.app.metadataCache.getFirstLinkpathDest?.(link, sourcePath) || this.app.vault.getAbstractFileByPath(link);
    if (!file || !file.path) return "";
    const adapter = this.app.vault.adapter;
    return adapter && typeof adapter.getResourcePath === "function" ? adapter.getResourcePath(file.path) : "";
  }

  /** A diagram with a percentage-positioned mask; the mask lifts on reveal. */
  renderOcclusion(front, card) {
    const body = card.body || {};
    const wrap = front.createDiv({ cls: "qt-cards-occlusion" });
    const src = this.imageResourcePath(body.image, card.file.path);
    if (!src) {
      if (body.image) this.md(`![[${body.image}]]`, wrap.createDiv({ cls: "qt-cards-occlusion-fallback" }), card.file.path);
      wrap.createDiv({
        cls: "qt-hint",
        text: body.image ? `Diagram: ${body.image}` : "This image occlusion card has no image path.",
      });
      return;
    }
    wrap.createEl("img", { cls: "qt-cards-occlusion-image", attr: { src, alt: "Occlusion diagram" } });
    const mask = body.mask || { x: 0, y: 0, w: 100, h: 100 };
    const box = wrap.createDiv({ cls: "qt-cards-occlusion-mask" });
    box.style.left = `${mask.x}%`;
    box.style.top = `${mask.y}%`;
    box.style.width = `${mask.w}%`;
    box.style.height = `${mask.h}%`;
    if (this.revealed) {
      box.addClass("is-revealed");
      box.createSpan({ cls: "qt-cards-occlusion-label", text: body.back || body.mask.label || "" });
    }
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

  /** The browser's recognition constructor, or null when this runtime has none. */
  speechSupport() {
    if (typeof this.speechFactory === "function") {
      return { available: true, create: () => this.speechFactory(), reason: "" };
    }
    const windows = [];
    try {
      if (typeof activeWindow !== "undefined" && activeWindow) windows.push(activeWindow);
    } catch (e) {
      /* no active window in this host */
    }
    try {
      if (typeof window !== "undefined" && window && !windows.includes(window)) windows.push(window);
    } catch (e) {
      /* no global window in this host */
    }
    for (const win of windows) {
      const Constructor = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (typeof Constructor === "function") return { available: true, create: () => new Constructor(), reason: "" };
    }
    return {
      available: false,
      create: null,
      reason: "Speech recognition is not available in this Obsidian environment. Type the answer instead; the local check still works.",
    };
  }

  speechLanguage() {
    try {
      if (typeof navigator !== "undefined" && navigator && navigator.language) return String(navigator.language);
    } catch (e) {
      /* no navigator */
    }
    try {
      const doc = typeof activeDocument !== "undefined" ? activeDocument : null;
      const lang = doc && doc.documentElement && doc.documentElement.lang;
      if (lang) return String(lang);
    } catch (e) {
      /* no document */
    }
    return "";
  }

  stopDictation() {
    const recognition = this.speechRecognition;
    this.speechRecognition = null;
    this.speechListening = false;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch (e) {
      /* already stopped */
    }
  }

  /** Dictate into the same editable box the typed path uses. Never grades on its own. */
  startDictation(textarea, button, hint) {
    if (!textarea || !button || !hint) return;
    if (this.speechListening) {
      this.stopDictation();
      button.setText("Dictate again");
      hint.setText("Dictation stopped. Edit the transcript, then check your answer.");
      return;
    }
    const support = this.speechSupport();
    if (!support.available) {
      button.disabled = true;
      hint.setText(support.reason);
      return;
    }
    this.stopDictation();
    let recognition;
    try {
      recognition = support.create();
    } catch (e) {
      button.disabled = true;
      hint.setText("The microphone could not start. Type the answer instead.");
      return;
    }
    if (!recognition) {
      button.disabled = true;
      hint.setText("The microphone could not start. Type the answer instead.");
      return;
    }

    const base = str(textarea.value).trim();
    let finalText = "";
    let interimText = "";
    let failed = false;
    const updateTranscript = () => {
      const spoken = [finalText, interimText].filter(Boolean).join(" ").trim();
      const combined = base && spoken ? `${base} ${spoken}` : base || spoken;
      textarea.value = combined;
      this.typedAnswer = combined;
    };

    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    const language = this.speechLanguage();
    if (language) recognition.lang = language;
    recognition.onstart = () => {
      this.speechListening = true;
      button.setText("Stop dictation");
      hint.setText("Listening… Speak your answer, then edit the transcript before checking.");
    };
    recognition.onresult = (event) => {
      const results = event && event.results ? event.results : [];
      const start = event && Number.isFinite(Number(event.resultIndex)) ? Number(event.resultIndex) : 0;
      let nextInterim = "";
      for (let i = start; i < results.length; i++) {
        const result = results[i];
        const alternative = result && result[0] ? result[0] : result;
        const text = str(alternative && alternative.transcript).trim();
        if (!text) continue;
        if (result && result.isFinal) finalText = `${finalText} ${text}`.trim();
        else nextInterim = `${nextInterim} ${text}`.trim();
      }
      interimText = nextInterim;
      updateTranscript();
    };
    recognition.onerror = (event) => {
      failed = true;
      this.speechError = speechErrorMessage(event && event.error);
      this.speechListening = false;
      button.disabled = false;
      button.setText("Try dictation again");
      hint.setText(this.speechError);
    };
    recognition.onend = () => {
      this.speechListening = false;
      if (this.speechRecognition === recognition) this.speechRecognition = null;
      button.disabled = false;
      button.setText(failed ? "Try dictation again" : finalText || interimText ? "Dictate again" : "Dictate");
      if (!failed) hint.setText("Transcript ready. Edit it if needed, then check your answer. Audio is not recorded or uploaded by this plugin.");
    };

    this.speechError = "";
    this.speechRecognition = recognition;
    this.speechListening = true;
    button.setText("Stop dictation");
    hint.setText("Listening… Speak your answer, then edit the transcript before checking.");
    try {
      recognition.start();
    } catch (e) {
      this.stopDictation();
      button.disabled = false;
      button.setText("Dictate");
      hint.setText("The microphone could not start. Type the answer instead.");
    }
  }

  /** True only when the selected AI backend has enough configuration to try a grade. */
  aiCredentialsConfigured() {
    const ai = (this.plugin.settings && this.plugin.settings.ai) || {};
    if (ai.enabled !== true) return false;
    if (this.plugin.backend && this.plugin.backend() === "opencode") return !!(this.plugin.conn && this.plugin.conn().url);
    const api = ai.api || {};
    const preset = API_PRESETS[api.provider] || API_PRESETS.custom;
    if (preset && preset.noKey) return true;
    try {
      return !!resolveApiKey(this.plugin.app, api);
    } catch (e) {
      return false;
    }
  }

  /** One visible explanation for the local-only and AI-fallback paths. */
  aiGradingHint() {
    const st = (this.plugin && this.plugin.settings) || {};
    const cards = st.cards || {};
    if (cards.aiGrading !== true) {
      return "AI grading is off. This answer is checked locally on this device; the stored answer appears after you check so you can self-check.";
    }
    if (!st.ai || st.ai.enabled !== true) {
      return "No AI provider is configured, so this answer is checked locally on this device. Check it, then compare with the stored answer and rate yourself.";
    }
    if (!this.aiCredentialsConfigured()) {
      return "AI features are on, but no provider credentials are configured. This answer is checked locally; compare it with the stored answer and rate yourself.";
    }
    return "If the local check is unsure, the AI grader compares only the card front, stored answer, your answer and the strictness.";
  }

  render() {
    const p = this.plugin;
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-cards qt-screen" });
    if (!p.cardsEnabled || !p.cardsEnabled()) return this.renderModuleOff(root);
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
    const now = new Date();
    const all = p.getCards();
    const stats = cardStats(all, today, now);
    const shown = p.filteredCards({ deck: this.deck, course: this.course });
    const pending = p.pendingCardGrades ? p.pendingCardGrades() : [];
    const pendingByPath = pendingGradeCounts(pending);

    const head = root.createDiv({ cls: "qt-screen-head" });
    head.createEl("h2", { text: "Cards" });
    head.createDiv({ cls: "qt-screen-subtitle", text: "Build decks, clear what is due, and keep every card tied to its source note." });

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

    const dueHere = shown.filter((c) => !Number(c.fm.attempts) || isDue(c.fm, today, now)).length;
    const hero = root.createDiv({ cls: "qt-cards-hero" });
    const heroCopy = hero.createDiv({ cls: "qt-cards-hero-copy" });
    heroCopy.createDiv({ cls: "qt-cards-hero-kicker", text: dueHere ? "Review queue" : shown.length ? "Card library" : "Filtered view" });
    heroCopy.createDiv({
      cls: "qt-cards-hero-title",
      text: dueHere
        ? `${dueHere} card${dueHere === 1 ? "" : "s"} ready to review`
        : shown.length
          ? `${shown.length} card${shown.length === 1 ? "" : "s"} in this view`
          : "No cards match this view",
    });
    heroCopy.createDiv({
      cls: "qt-cards-hero-meta",
      text: dueHere
        ? "Clear the due queue first, then work through any new cards."
        : shown.length
          ? "Everything in this view is scheduled ahead. Start a review to browse the deck."
          : "Clear a deck or course filter, or add a card to this deck.",
    });
    const start = hero.createEl("button", {
      text: dueHere ? `Start review (${dueHere})` : "Review all cards",
      cls: "mod-cta qt-primary qt-cards-start",
    });
    start.disabled = !shown.length;
    start.addEventListener("click", () => this.startReview(dueHere ? "due" : "all"));
    const cramStart = hero.createEl("button", { text: "Cram session", cls: "qt-cards-cram-start" });
    cramStart.disabled = !shown.length;
    cramStart.addEventListener("click", () => this.startReview("all", undefined, true));
    root.createDiv({
      cls: "qt-hint qt-cards-cram-hint",
      text: "Cram session ratings: Again 3m · Hard 5m · Good 10m · Easy 1d.",
    });

    const tools = root.createDiv({ cls: "qt-row qt-cards-tools qt-toolbar" });
    const add = tools.createEl("button", { text: "New card", cls: "mod-cta" });
    add.addEventListener("click", () => this.openCardModal());
    const occlusion = tools.createEl("button", { text: "Image occlusion" });
    occlusion.addEventListener("click", () =>
      p.openImageOcclusion({ deck: this.deck, course: this.course }, () => this.render())
    );
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

    const summary = root.createDiv({ cls: "qt-cards-stats qt-summary-strip" });
    summary.createSpan({ text: `${stats.total} card${stats.total === 1 ? "" : "s"}` });
    summary.createSpan({ text: `${stats.due} due` });
    summary.createSpan({ text: `${stats.fresh} new` });
    if (pending.length) {
      summary.addClass("has-pending");
      summary.createSpan({ cls: "qt-cards-pending-count", text: `${pending.length} pending` });
    }

    this.renderPendingGrades(root, pending);

    const filters = root.createDiv({ cls: "qt-cards-filters" });
    this.renderDeckPicker(filters, all, today);
    this.renderCoursePicker(filters, all);

    root.createEl("h3", { cls: "qt-cards-heading", text: "In this view" });
    if (!shown.length) {
      root.createDiv({ cls: "qt-hint", text: "No cards match this deck and course. Pick another deck or clear the course filter." });
      this.renderCardRetention(root, shown, today);
      return;
    }
    const list = root.createDiv({ cls: "qt-cards-list" });
    const preview = shown
      .slice()
      .sort((a, b) => {
        const at = nextReviewTime(a.fm);
        const bt = nextReviewTime(b.fm);
        if (at !== null && bt !== null && at !== bt) return at - bt;
        return str(a.fm.next_review).localeCompare(str(b.fm.next_review)) || a.file.path.localeCompare(b.file.path);
      })
      .slice(0, 12);
    for (const card of preview) {
      const row = list.createDiv({ cls: "qt-cards-row" });
      const main = row.createDiv({ cls: "qt-cards-row-main" });
      main.createDiv({ cls: "qt-cards-row-title", text: str(card.fm.card_title || card.file.basename) });
      const kindLabel = String(card.fm && card.fm.card_type).toLowerCase() === "image-occlusion" ? CARD_TYPE_LABELS["image-occlusion"] : card.kind === "vocab" ? "Vocabulary" : "Flashcard";
      const bits = [card.deck, card.course, kindLabel].filter(Boolean);
      main.createDiv({ cls: "qt-cards-row-meta", text: bits.join(" · ") });
      const queued = pendingByPath.get(card.file.path) || 0;
      if (queued) row.createSpan({ cls: "qt-cards-pending-badge", text: queued > 1 ? `Pending ${queued}` : "Pending grade" });
      const due = !Number(card.fm.attempts) ? "New" : isDue(card.fm, today, now) ? "Due" : `Due ${str(card.fm.next_review).slice(0, 10)}`;
      row.createSpan({ cls: `qt-cards-due${due === "Due" ? " is-due" : ""}`, text: due });
      const action = row.createEl("button", { text: queued ? "Review" : "Open", cls: "qt-link" });
      action.addEventListener("click", () =>
        queued ? this.reviewCard(card) : this.app.workspace.getLeaf("tab").openFile(card.file)
      );
    }
    if (shown.length > preview.length) {
      root.createDiv({ cls: "qt-hint", text: `Showing ${preview.length} of ${shown.length}. Start a review for the rest.` });
    }

    this.renderCardRetention(root, shown, today);
  }

  /** Repeat-review accuracy for the cards in the current deck/course filter. */
  renderCardRetention(root, cards, today) {
    const retention = buildRetention(cards, today, 8);
    const box = root.createDiv({ cls: "qt-card-retention" });
    box.createEl("h3", { cls: "qt-cards-heading", text: "Card retention" });
    if (!retention.attempts) {
      box.createDiv({
        cls: "qt-hint",
        text: "Card retention appears after a card's second review. The first review of each card is excluded.",
      });
      return;
    }
    const chart = box.createDiv({ cls: "qt-trend" });
    for (const week of retention.weeks) {
      const column = chart.createDiv({ cls: "qt-trend-col" });
      column.setAttr(
        "title",
        week.attempts ? `${week.start}: ${Math.round((week.accuracy || 0) * 100)}% of ${week.attempts} repeat reviews` : `${week.start}: no repeat reviews`
      );
      const bar = column.createDiv({ cls: "qt-trend-bar" });
      const band = week.accuracy === null ? "" : week.accuracy < 0.6 ? "is-low" : week.accuracy < 0.8 ? "is-mid" : "is-high";
      bar.createDiv({ cls: `qt-meter-fill ${band}` }).setCssProps({ "--qt-pct": `${Math.round((week.accuracy || 0) * 100)}%` });
      column.createDiv({ cls: "qt-hint qt-trend-lab", text: week.accuracy === null ? "" : `${Math.round(week.accuracy * 100)}%` });
    }
    box.createDiv({
      cls: "qt-hint",
      text: `${Math.round((retention.accuracy || 0) * 100)}% over ${retention.attempts} repeat review${retention.attempts === 1 ? "" : "s"} in the last ${retention.weeks.length} weeks.`,
    });
  }

  renderDeckPicker(root, cards, today) {
    const decks = deckSummary(cards, this.plugin.settings, today, new Date());
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

  /** Queued typed answers are visible on the card list, not only inside a review. */
  renderPendingGrades(root, pending) {
    if (!pending.length) return;
    const panel = root.createDiv({ cls: "qt-cards-pending-panel" });
    panel.createDiv({ cls: "qt-cards-pending-title", text: pending.length === 1 ? "1 pending AI grade" : `${pending.length} pending AI grades` });
    panel.createDiv({
      cls: "qt-cards-pending-text",
      text: "Typed answers waiting for the AI grader. They stay out of your review history and are not counted as incorrect.",
    });
    const list = panel.createDiv({ cls: "qt-pending-list" });
    const cards = this.plugin.getCards ? this.plugin.getCards() : [];
    const seen = new Set();
    const pendingCards = [];
    for (const entry of pending) {
      if (seen.has(entry.path)) continue;
      seen.add(entry.path);
      pendingCards.push(entry);
    }
    for (const entry of pendingCards.slice(0, 5)) {
      const row = list.createDiv({ cls: "qt-pending-row" });
      row.createSpan({ cls: "qt-pending-name", text: entry.front || entry.path.split("/").pop().replace(/\.md$/, "") });
      const card = cards.find((c) => c.file.path === entry.path);
      if (card) {
        const review = row.createEl("button", { text: "Review", cls: "qt-link" });
        review.addEventListener("click", () => this.reviewCard(card));
      } else {
        const open = row.createEl("button", { text: "Open note", cls: "qt-link" });
        open.addEventListener("click", () => {
          const file = this.app.vault.getAbstractFileByPath(entry.path);
          if (file) this.app.workspace.getLeaf("tab").openFile(file);
        });
      }
    }
    if (pendingCards.length > 5) list.createDiv({ cls: "qt-pending-more", text: `+${pendingCards.length - 5} more` });
    const actions = panel.createDiv({ cls: "qt-row" });
    const grade = actions.createEl("button", { text: "Grade now", cls: "mod-cta" });
    grade.addEventListener("click", () => this.gradePending(grade));
  }

  async gradePending(button) {
    const p = this.plugin;
    if (!p || typeof p.flushPendingCardGrades !== "function") return;
    if (button) button.disabled = true;
    try {
      const r = await p.flushPendingCardGrades();
      if (r.disabled) new Notice("Turn on AI features and the Cards AI fallback first.", 6000);
      else if (r.remaining) new Notice(`Graded ${r.graded}; ${r.remaining} answer${r.remaining === 1 ? "" : "s"} still waiting.`, 6000);
      else if (r.graded) new Notice(`Graded ${r.graded} pending answer${r.graded === 1 ? "" : "s"}.`, 5000);
      else new Notice("No typed answers are waiting for an AI grade.");
    } catch (e) {
      new Notice((e && e.message) || "Could not grade pending answers.");
    } finally {
      this.render();
    }
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

  startReview(order, only, cram) {
    const p = this.plugin;
    this.cram = cram === true;
    this.previewSource = null;
    const pool = Array.isArray(only) ? only : p.filteredCards({ deck: this.deck, course: this.course });
    const queue = cardQueue(pool, {
      today: localDate(),
      now: new Date(),
      order: order || p.settings.cards.order,
      limit: Array.isArray(only) ? Math.max(1, only.length) : this.cram ? pool.length : p.settings.cards.reviewLimit,
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
    this.cram = false;
    this.previewSource = null;
    this.queue = [card];
    this.index = 0;
    this.state = "review";
    this.session = { reviewed: 0, correct: 0, grades: { again: 0, hard: 0, good: 0, easy: 0 } };
    await this.showCard();
  }

  async showCard() {
    this.stopDictation();
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
    this.revealEffect = "";
    try {
      const text = await this.app.vault.cachedRead(card.file);
      this.current = { ...card, body: parseCardBody(text, card.fm) };
      const queued = this.plugin.pendingCardGrades ? this.plugin.pendingCardGrades().find((entry) => entry.path === card.file.path) : null;
      this.pendingGrade = !!queued;
      this.pendingGradeId = queued ? queued.id : "";
    } catch (e) {
      new Notice(`Could not read ${card.file.path}.`);
      this.queue.splice(this.index, 1);
      return this.showCard();
    }
    this.render();
  }

  /** Reuse one scheduler replay for every re-render of the same card. */
  previewsForCurrent() {
    if (!this.current) return null;
    if (this.previewSource === this.current && this.previewCram === this.cram && this.previewValues) return this.previewValues;
    this.previewSource = this.current;
    this.previewCram = this.cram;
    this.previewBuilds += 1;
    this.previewValues = this.cram
      ? cramPreviews()
      : intervalPreviews(this.current.fm, this.current.deck, this.plugin.settings, new Date());
    return this.previewValues;
  }

  /** The class for this reveal only; empty when the effect is off or unavailable. */
  nextRevealEffect() {
    const cards = (this.plugin.settings && this.plugin.settings.cards) || {};
    return revealAnimationClass(cards.revealAnimation, revealEnvironment());
  }

  reveal() {
    if (!this.current) return;
    this.revealed = true;
    this.revealEffect = this.nextRevealEffect();
    this.render();
  }

  /** Grade a typed or dictated answer locally, then ask AI only when the local result is unsure. */
  async checkTyped(value) {
    if (!this.current || this.aiChecking) return;
    this.stopDictation();
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
    this.revealEffect = this.nextRevealEffect();
    this.aiError = "";
    this.pendingGrade = false;
    this.pendingGradeId = "";
    this.render();

    if (!needsAi(graded)) return;
    const st = this.plugin.settings;
    if (!st.cards.aiGrading) return;
    if (!st.ai.enabled) {
      this.aiError = "AI fallback is on for cards, but AI features are off. The local check above is still usable; turn on AI features under Settings, Global, Modules if you want a second opinion.";
      this.render();
      return;
    }
    if (!this.aiCredentialsConfigured()) {
      this.aiError = "No AI provider credentials are configured. The local check above is still usable; compare it with the stored answer and rate the card yourself.";
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
      const extra = {
        ...(this.verdict
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
          : {}),
        cram: this.cram,
      };
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

  async setCurrentStudyStatus(status) {
    const p = this.plugin;
    const card = this.current;
    if (!card || this.busy) return;
    if (status === "excluded") {
      const ok = await p.askConfirm(
        "Exclude this card?",
        "It will be skipped by card reviews and the due queue. The note stays in your vault, and you can restore it from Settings, MCQ Tracker, Review, Manage known and excluded items.",
        "Exclude"
      );
      if (!ok) return;
    }
    try {
      const summary = await p.setStudyStatus(card.file, status);
      p.notifyStudyStatusChange(summary, card.file, summary && summary.previous);
      if (this.pendingGradeId) p.discardPendingCardGrade(this.pendingGradeId);
      this.queue.splice(this.index, 1);
      if (!this.queue.length) {
        this.state = "browse";
        this.current = null;
        this.render();
        return;
      }
      this.index = Math.min(this.index, this.queue.length - 1);
      await this.showCard();
    } catch (e) {
      new Notice(str(e && e.message) || "Could not update this card.", 6000);
    }
  }

  finish() {
    this.stopDictation();
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
    if (this.cram) top.createDiv({ cls: "qt-cards-cram-mode", text: "Cram · 3m / 5m / 10m / 1d" });
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
    else if (card.body.cardType !== "basic") chips.createSpan({ cls: "qt-cards-kind", text: CARD_TYPE_LABELS[card.body.cardType] || card.body.cardType });
    const open = head.createEl("button", { cls: "qt-icon-btn", attr: { "aria-label": "Open note", title: "Open note" } });
    setIcon(open, "file-text");
    open.addEventListener("click", () => this.app.workspace.getLeaf("tab").openFile(card.file));

    const front = box.createDiv({ cls: "qt-cards-front" });
    if (card.body.language || card.body.partOfSpeech) {
      front.createDiv({ cls: "qt-cards-lang", text: [card.body.language, card.body.partOfSpeech].filter(Boolean).join(" · ") });
    }
    if (card.body.cardType === "image-occlusion") this.renderOcclusion(front, card);
    if (card.body.frontExpectation) {
      front.createDiv({ cls: "qt-cards-expectation", text: `Expected: ${card.body.frontExpectation}` });
    }
    this.md(card.body.front || "*This card has no front.*", front.createDiv({ cls: "qt-cards-term" }), card.file.path);

    const mode = card.body.cardType === "image-occlusion" ? "flip" : card.answerMode || "flip";
    if (!this.revealed && mode !== "flip") {
      const typedWrap = root.createDiv({ cls: "qt-cards-typed-wrap" });
      typedWrap.createEl("label", { text: "Your answer (type or dictate)" });
      const typed = typedWrap.createEl("textarea", {
        cls: "qt-cards-typed",
        attr: { rows: "3", placeholder: "Type your answer, or use the microphone to dictate it…" },
      });
      typed.value = this.typedAnswer || "";
      typed.addEventListener("input", () => (this.typedAnswer = typed.value));
      typed.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          this.checkTyped(typed.value);
        }
      });
      const speech = this.speechSupport();
      const speechRow = typedWrap.createDiv({ cls: "qt-cards-typed-actions" });
      const dictate = speechRow.createEl("button", { text: "Dictate", cls: "qt-cards-dictate" });
      dictate.disabled = !speech.available;
      if (speech.available) {
        dictate.setAttr("aria-label", "Dictate your answer with the microphone");
      } else {
        dictate.setAttr("aria-label", "Dictation unavailable");
        dictate.setAttr("title", speech.reason);
      }
      const dictateHint = typedWrap.createDiv({ cls: "qt-hint qt-cards-dictate-hint" });
      dictateHint.setText(
        speech.available
          ? "Dictate, then edit the transcript before checking. Audio is not recorded or uploaded by this plugin."
          : speech.reason
      );
      dictate.addEventListener("click", () => this.startDictation(typed, dictate, dictateHint));
      const check = root.createEl("button", { text: "Check answer", cls: "mod-cta qt-primary qt-cards-show" });
      check.addEventListener("click", () => this.checkTyped(typed.value));
      root.createDiv({ cls: "qt-hint", text: this.aiGradingHint() });
      root.createDiv({
        cls: "qt-hint",
        text: "Exact wording is not required at standard strictness; small typos and accepted variants count.",
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

    const effect = this.revealEffect;
    this.revealEffect = "";
    const answer = root.createDiv({ cls: `qt-cards-box qt-cards-answer${effect ? ` ${effect}` : ""}` });
    answer.createDiv({ cls: "qt-cards-answer-label", text: card.body.kind === "vocab" ? "Definition" : "Answer" });
    if (card.body.backExpectation) {
      answer.createDiv({ cls: "qt-cards-expectation", text: `Expected: ${card.body.backExpectation}` });
    }
    this.md(card.body.back || "*This card has no answer.*", answer.createDiv({ cls: "qt-cards-back" }), card.file.path);
    if (card.body.example) {
      answer.createDiv({ cls: "qt-cards-answer-label", text: "Example" });
      this.md(card.body.example, answer.createDiv({ cls: "qt-cards-example" }), card.file.path);
    }

    const source = this.plugin.sourceInfo ? this.plugin.sourceInfo(card.fm, card.file.path) : null;
    if (source && source.has) {
      const sourceRow = root.createDiv({ cls: "qt-source" });
      sourceRow.createSpan({ cls: "qt-source-label", text: "Source" });
      sourceRow.createSpan({ cls: "qt-source-name", text: source.detail });
      const openSource = sourceRow.createEl("button", { text: source.quote ? "Review in context" : "Reread source", cls: "qt-link" });
      openSource.addEventListener("click", () => this.plugin.openSource(card.fm, card.file.path, source.quote));
    }
    if (source && source.quote) {
      const passage = root.createDiv({ cls: "qt-cards-source-context" });
      passage.createDiv({ cls: "qt-cards-source-context-label", text: "Source passage" });
      const parts = splitSourceContext(source.context || source.quote, source.quote);
      const text = passage.createDiv({ cls: "qt-cards-source-context-text" });
      if (parts.match) {
        if (parts.before) text.createSpan({ text: parts.before });
        text.createEl("mark", { cls: "qt-cards-source-mark", text: parts.match });
        if (parts.after) text.createSpan({ text: parts.after });
      } else {
        text.setText(source.context || source.quote);
      }
    }

    const ratings = root.createDiv({ cls: "qt-cards-ratings" });
    const previews = this.previewsForCurrent();
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
      if (previews && previews[grade] !== null && previews[grade] !== undefined) {
        b.createSpan({ cls: "qt-cards-rate-interval", text: this.cram ? cramIntervalLabel(grade) : formatInterval(previews[grade]) });
      }
      b.addEventListener("click", () => this.rate(grade));
    }
    const manage = root.createDiv({ cls: "qt-row qt-cards-manage" });
    const known = manage.createEl("button", { text: `Known ${this.plugin.knownDaysForFile(this.current.file)}d`, cls: "qt-link" });
    known.addEventListener("click", () => this.setCurrentStudyStatus("known"));
    const bury = manage.createEl("button", { text: "Bury", cls: "qt-link" });
    bury.addEventListener("click", () => this.setCurrentStudyStatus("buried"));
    const suspend = manage.createEl("button", { text: "Suspend", cls: "qt-link" });
    suspend.addEventListener("click", () => this.setCurrentStudyStatus("suspended"));
    const exclude = manage.createEl("button", { text: "Exclude", cls: "qt-link qt-status-exclude" });
    exclude.addEventListener("click", () => this.setCurrentStudyStatus("excluded"));
    root.createDiv({
      cls: "qt-hint",
      text: this.aiChecking
        ? "Waiting for the AI check. You can rate the card after it finishes."
        : this.pendingGrade
          ? "The AI grade is pending. Rate the card yourself now, or leave it and it will be graded later."
          : this.verdict
            ? `Suggested rating: ${GRADE_LABELS[this.suggestedGrade] || "Good"}. Choose another rating to record an override.`
            : this.cram
              ? "Cram timing: Again 3m · Hard 5m · Good 10m · Easy 1d."
              : "Rate how well you recalled it. 1 = again, 4 = easy.",
    });
  }

  onClose() {
    this.stopDictation();
    this.contentEl.empty();
  }

  renderSummary(root) {
    const s = this.session;
    const box = root.createDiv({ cls: "qt-onboard-card" });
    box.createEl("h3", { text: this.cram ? "Cram session complete" : "Review complete" });
    box.createDiv({
      cls: "qt-onboard-text",
      text: `${s.reviewed} card${s.reviewed === 1 ? "" : "s"} reviewed · ${s.correct} recalled.`,
    });
    const row = box.createDiv({ cls: "qt-row" });
    row.createEl("span", { cls: "qt-cards-summary", text: `Again ${s.grades.again} · Hard ${s.grades.hard} · Good ${s.grades.good} · Easy ${s.grades.easy}` });
    const again = box.createEl("button", { text: this.cram ? "Cram again" : "Review again", cls: "mod-cta qt-primary" });
    again.addEventListener("click", () => this.startReview("all", undefined, this.cram));
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
