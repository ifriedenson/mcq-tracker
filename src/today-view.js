"use strict";
const { ItemView } = require("obsidian");
const { VIEW_TYPE_TODAY } = require("./constants");
const { fmtDate } = require("./util");
const { isDue } = require("./filters");
const { cleanSubjectTitle, examCountdown, formatDateValue, formatTime, humanizeDuration, isExamEvent, nextClassStatus, parseClassDetails, upcomingExams } = require("./calendar-model");

/*
 * The phone-sized entry point: what is due, what is next, and one large
 * Start 5 minutes button. It deliberately does not own a review UI; Quick
 * Practice and the practice view already do that.
 */
class TodayView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_TODAY;
  }
  getDisplayText() {
    return "Today";
  }
  getIcon() {
    return "sun";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
    // Counts and the next event move while the tab stays open.
    this.registerInterval(activeWindow.setInterval(() => this.render(), 60000));
  }

  render() {
    const p = this.plugin;
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-today" });

    if (p.mcqEnabled && !p.mcqEnabled()) {
      const card = root.createDiv({ cls: "qt-today-card" });
      card.createEl("h3", { text: "MCQ Tracker is off" });
      card.createDiv({ cls: "qt-today-meta", text: "Turn the MCQ Tracker module back on under Settings, Global, Modules to use Today." });
      card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => p.openSettings());
      return;
    }

    const now = new Date();
    root.createDiv({ cls: "qt-today-date", text: now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) });
    root.createEl("h2", { text: "Today" });

    const questions = p.getQuestions();
    const today = fmtDate(now);
    const due = questions.filter((q) => isDue(q.fm, today));
    const fresh = questions.filter((q) => !Number(q.fm.attempts));
    root.createDiv({ cls: "qt-today-count", text: `${due.length} due · ${fresh.length} new · ${questions.length} question${questions.length === 1 ? "" : "s"}` });

    if (questions.length) {
      const pool = due.length ? due : questions;
      const mode = due.length ? "due" : "smart";
      const label = due.length ? "questions due today" : "available questions";
      const start = root.createEl("button", { text: "Start 5 minutes", cls: "mod-cta qt-primary qt-today-start" });
      start.addEventListener("click", () => p.startQuickPractice({ minutes: 5, pool, mode, label }));
      const more = root.createDiv({ cls: "qt-today-actions" });
      more.createEl("button", { text: "More Quick Practice options" }).addEventListener("click", () => p.activateQuickPractice());
      more.createEl("button", { text: "Open practice view" }).addEventListener("click", () => p.activateView());
    } else {
      const card = root.createDiv({ cls: "qt-today-card" });
      card.createEl("h3", { text: "No questions yet" });
      card.createDiv({ cls: "qt-today-meta", text: "Add notes with a question_id property, or import questions from a file." });
      card.createEl("button", { text: "Open practice view", cls: "mod-cta qt-primary" }).addEventListener("click", () => p.activateView());
    }

    this.renderDueQueue(root);
    this.renderCards(root);
    this.renderNext(root, now);
  }

  /** One mixed list when both modules have due work; the dedicated buttons stay below. */
  renderDueQueue(root) {
    const p = this.plugin;
    if (!p.cardsEnabled || !p.cardsEnabled() || !p.getDueQueue) return;
    const queue = p.getDueQueue({ limit: 5 });
    const cardCount = queue.counts.cards + queue.counts.vocab;
    if (!queue.counts.questions || !cardCount) return;
    root.createEl("h3", { cls: "qt-today-section", text: "Due across modules" });
    root.createDiv({
      cls: "qt-today-count",
      text: `${queue.counts.questions} question${queue.counts.questions === 1 ? "" : "s"} · ${cardCount} card${cardCount === 1 ? "" : "s"} due or new`,
    });
    const list = root.createDiv({ cls: "qt-due-list" });
    for (const item of queue.items) {
      const row = list.createDiv({ cls: `qt-due-row qt-due-${item.type}` });
      const main = row.createDiv({ cls: "qt-due-main" });
      main.createDiv({ cls: "qt-due-title", text: item.title });
      main.createDiv({ cls: "qt-due-meta", text: item.meta });
      row.createSpan({ cls: `qt-due-badge${item.isNew ? " is-new" : ""}`, text: item.isNew ? "New" : "Due" });
    }
    const open = root.createEl("button", { text: "Open due queue", cls: "mod-cta qt-primary" });
    open.addEventListener("click", () => p.openDueQueue());
  }

  renderCards(root) {
    const p = this.plugin;
    if (!p.cardsEnabled || !p.cardsEnabled()) return;
    const cards = p.getCards ? p.getCards() : [];
    const due = cards.filter((c) => !Number(c.fm.attempts) || (!!c.fm.next_review && String(c.fm.next_review).slice(0, 10) <= fmtDate(new Date()))).length;
    root.createEl("h3", { cls: "qt-today-section", text: "Cards" });
    const card = root.createDiv({ cls: "qt-today-card" });
    card.createDiv({ cls: "qt-today-kicker", text: due ? "Ready to review" : "All caught up" });
    card.createDiv({
      cls: "qt-today-title",
      text: due ? `${due} card${due === 1 ? "" : "s"} due or new` : `${cards.length} card${cards.length === 1 ? "" : "s"} in your decks`,
    });
    card.createDiv({ cls: "qt-today-meta", text: "Flashcards and vocabulary share the same review schedule as your questions." });
    const row = card.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: due ? "Review cards" : "Open cards", cls: "mod-cta qt-primary" }).addEventListener("click", () => p.activateCards());
    if (due) row.createEl("button", { text: "New card" }).addEventListener("click", () => p.openNewCard());
  }

  renderNext(root, now) {
    const p = this.plugin;
    if (!p.calendarEnabled || !p.calendarEnabled()) return;
    const events = p.calendarEvents() || [];
    const settings = p.calendarSettings();
    const classStatus = nextClassStatus(events.filter((ev) => !isExamEvent(ev)), now);
    const exam = upcomingExams(events, now, 1)[0];
    if (!classStatus.event && !exam) return;

    root.createEl("h3", { cls: "qt-today-section", text: "Next up" });
    if (classStatus.event) {
      const event = classStatus.event;
      const details = event.details || parseClassDetails(event.summary, event.description, event.location);
      const card = root.createDiv({ cls: "qt-today-card" });
      card.createDiv({ cls: "qt-today-kicker", text: classStatus.state === "ongoing" ? "In class now" : "Next class" });
      card.createDiv({ cls: "qt-today-title", text: cleanSubjectTitle(event.summary) || event.summary || "Class" });
      const when = classStatus.state === "ongoing"
        ? `Until ${formatTime(settings, event.dtend)}`
        : `${formatTime(settings, event.dtstart)}–${formatTime(settings, event.dtend)} · ${humanizeDuration(classStatus.startsInMs)}`;
      card.createDiv({ cls: "qt-today-meta", text: [when, details.room].filter(Boolean).join(" · ") });
    }
    if (exam) {
      const card = root.createDiv({ cls: "qt-today-card" });
      card.createDiv({ cls: "qt-today-kicker", text: "Next exam" });
      card.createDiv({ cls: "qt-today-title", text: cleanSubjectTitle(exam.summary) || exam.summary || "Exam" });
      card.createDiv({ cls: "qt-today-meta", text: `${formatDateValue(settings.dateFormat, exam.dateKey)} · ${examCountdown(exam, now)}` });
    }
  }
}

module.exports = {
  VIEW_TYPE_TODAY,
  TodayView,
};
