"use strict";
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_TODAY } = require("./constants");
const { pendingGradeCounts } = require("./card-grade-queue");
const { fmtDate } = require("./util");
const { isDue } = require("./filters");
const { isStudyable } = require("./study-status");
const { cleanSubjectTitle, examCountdown, formatDateValue, formatTime, humanizeDuration, isExamEvent, nextClassStatus, parseClassDetails, upcomingExams } = require("./calendar-model");
const { recommendApResource, resourceTitle } = require("./ap-exam-resources");
const { dailyDone, dailyStreak, normalizeDailyQuiz } = require("./daily-quiz");
const { adaptiveDailyCount, normalizeQuickAdaptive } = require("./adaptive-session");
const { elapsedFocusMs, focusRemainingMs, formatFocusClock } = require("./focus");
const { buildDailyTasks } = require("./assignments");
const { renderMastery } = require("./analytics-embed");
const { MASTERY_WINDOWS, bandQuestions, buildMastery, buildMasteryTrend, masteryScopes, masteryTrendText, masteryWindowDays, scopeQuestions } = require("./progress");

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
    this.registerInterval(activeWindow.setInterval(() => this.tickFocus(), 1000));
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
    const visible = questions.filter((q) => isStudyable(q.fm, today));
    const hidden = questions.length - visible.length;
    const due = visible.filter((q) => isDue(q.fm, today));
    const fresh = visible.filter((q) => !Number(q.fm.attempts));
    const hiddenText = hidden ? ` · ${hidden} hidden` : "";
    root.createDiv({
      cls: "qt-today-count",
      text: `${due.length} due · ${fresh.length} new · ${visible.length} question${visible.length === 1 ? "" : "s"}${hiddenText}`,
    });
    const manage = root.createDiv({ cls: "qt-row qt-small-row" });
    manage.createEl("button", { text: "Hidden items", cls: "qt-link" }).addEventListener("click", () => p.openStudyStatusManager());

    this.renderReminder(root, today, due, fresh);
    this.renderMasteryCard(root, questions, today);
    const plan = this.renderStudyPlan(root);
    this.renderFrqReview(root, plan);
    this.renderDaily(root, today);
    this.renderTasks(root, today, due, visible);
    this.renderFocus(root, today);

    if (visible.length) {
      const pool = due.length ? due : visible;
      const mode = due.length ? "due" : "smart";
      const label = due.length ? "questions due today" : "available questions";
      const start = root.createEl("button", { text: "Start 5 minutes", cls: "mod-cta qt-primary qt-today-start" });
      start.addEventListener("click", () => p.startQuickPractice({ minutes: 5, pool, mode, label }));
      const more = root.createDiv({ cls: "qt-today-actions" });
      more.createEl("button", { text: "More Quick Practice options" }).addEventListener("click", () => p.activateQuickPractice());
      more.createEl("button", { text: "Open practice view" }).addEventListener("click", () => p.activateView());
    } else {
      const card = root.createDiv({ cls: "qt-today-card" });
      card.createEl("h3", { text: hidden ? "All questions are hidden" : "No questions yet" });
      card.createDiv({
        cls: "qt-today-meta",
        text: hidden ? "Hidden items are not in the practice queue. Restore them whenever you want them back." : "Add notes with a question_id property, or import questions from a file.",
      });
      card
        .createEl("button", { text: hidden ? "Manage hidden items" : "Open practice view", cls: "mod-cta qt-primary" })
        .addEventListener("click", () => (hidden ? p.openStudyStatusManager() : p.activateView()));
    }

    this.renderDueQueue(root);
    this.renderCards(root);
    this.renderNext(root, now);
  }

  /** A quiet, local nudge. It never uses an OS notification or the network. */
  renderReminder(root, today, due, fresh) {
    const p = this.plugin;
    if (!p.reminderInfo) return;
    const info = p.reminderInfo();
    if (!info.visible) return;
    const card = root.createDiv({ cls: "qt-today-card qt-reminder-card" });
    card.createDiv({ cls: "qt-today-kicker", text: "Study reminder" });
    card.createDiv({ cls: "qt-today-title", text: info.text });
    card.createDiv({
      cls: "qt-today-meta",
      text: `Local only · shown once a day from ${String(info.hour).padStart(2, "0")}:00 · no notification is sent`,
    });
    const row = card.createDiv({ cls: "qt-row qt-small-row" });
    if (info.counts.daily) {
      row.createEl("button", { text: "Start daily quiz", cls: "mod-cta" }).addEventListener("click", () => p.startDailyQuiz());
    } else if (due.length) {
      row.createEl("button", { text: "Start 5 minutes", cls: "mod-cta" }).addEventListener("click", () =>
        p.startQuickPractice({ minutes: 5, pool: due, mode: "due", label: "questions due today" })
      );
    }
    row.createEl("button", { text: "Dismiss today" }).addEventListener("click", () => p.dismissTodayReminder());
  }

  /** The Progress tab's selected scope and window, with exact band practice. */
  renderMasteryCard(root, questions, today) {
    const p = this.plugin;
    const settings = p.settings || {};
    const savedScope = String(settings.masteryScope || "").trim();
    const scopes = masteryScopes(questions);
    const scope = savedScope && scopes.some((entry) => entry.toLowerCase() === savedScope.toLowerCase()) ? savedScope : "";
    const days = masteryWindowDays(settings.masteryDays);
    const pool = scopeQuestions(questions, scope);
    const mastery = buildMastery(pool, { days, today });
    if (!mastery.total) return;
    const trend = buildMasteryTrend(pool, { days, today });
    const controls = (container) => {
      if (scopes.length) {
        const scopeRow = container.createDiv({ cls: "qt-progress-scope" });
        scopeRow.createSpan({ cls: "qt-hint", text: "Show mastery for" });
        const picker = scopeRow.createEl("select", { cls: "qt-select" });
        picker.createEl("option", { value: "", text: "All questions" });
        for (const entry of scopes) picker.createEl("option", { value: entry, text: entry });
        picker.value = scope;
        picker.addEventListener("change", () => {
          p.settings.masteryScope = picker.value;
          p.save();
          this.render();
        });
      }
      const range = container.createDiv({ cls: "qt-chips qt-progress-window" });
      for (const option of [0, ...MASTERY_WINDOWS]) {
        const chip = range.createEl("button", { text: option ? `Last ${option} days` : "All time", cls: "qt-chip" });
        if (days === option) chip.addClass("is-selected");
        chip.setAttr("aria-pressed", days === option ? "true" : "false");
        chip.addEventListener("click", () => {
          p.settings.masteryDays = option;
          p.save();
          this.render();
        });
      }
      const change = trend.hasComparison && trend.direction !== "same" ? ` is-${trend.direction}` : "";
      container.createDiv({ cls: `qt-progress-delta qt-mastery-trend${change}`, text: masteryTrendText(trend) });
      const actions = container.createDiv({ cls: "qt-row qt-small-row" });
      actions.createEl("button", { text: "Open progress", cls: "qt-link" }).addEventListener("click", () => p.activateInsights("progress"));
    };
    renderMastery(
      root,
      { mastery, masteryScope: scope, masteryDays: days },
      {
        onMasteryPractice: (band, label) => {
          p.practiceQuestionPool(bandQuestions(pool, band, { days, today }), label);
        },
      },
      controls
    );
  }

  renderStudyPlan(root) {
    const p = this.plugin;
    if (!p.studyPlan) return null;
    const plan = p.studyPlan();
    if (!plan) return null;
    root.createEl("h3", { cls: "qt-today-section", text: "Study plan" });
    const card = root.createDiv({ cls: "qt-today-card qt-plan-card" });
    card.createDiv({ cls: "qt-today-kicker", text: plan.daysLeft === 0 ? "Exam today" : `Next exam in ${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"}` });
    card.createDiv({ cls: "qt-today-title", text: plan.course });
    card.createDiv({
      cls: "qt-today-meta",
      text: `Readiness ${plan.readiness}% · ${plan.due} due · ${plan.fresh} new · ${plan.cardsDue} cards${plan.frqTotal ? ` · ${plan.frqDue} FRQ due` : ""}${plan.topics ? ` · ${plan.topics.mastered}/${plan.topics.declared} topics mastered (${plan.topics.pct}%)` : ""}`,
    });
    const evidence = [`${plan.attempted}/${plan.total} questions practised`];
    if (plan.accuracy !== null) evidence.push(`${Math.round(plan.accuracy * 100)}% accuracy`);
    if (plan.weakSkill) evidence.push(`weakest: ${plan.weakSkill}`);
    card.createDiv({ cls: "qt-toggle-hint", text: evidence.join(" · ") });
    if (plan.frqTotal) {
      const next = plan.frqNext;
      card.createDiv({
        cls: "qt-toggle-hint",
        text: next
          ? `FRQ: ${next.title} · ${next.missed.length ? `${next.missed.length} missed rubric line${next.missed.length === 1 ? "" : "s"}` : "no missed rubric lines"}`
          : "FRQ prompts for this course are scheduled for later this week.",
      });
    }
    const row = card.createDiv({ cls: "qt-row qt-small-row" });
    row.createEl("button", { text: "Start 10 min", cls: "mod-cta" }).addEventListener("click", () => p.startStudyPlan(plan, false));
    row.createEl("button", { text: "Cram 10 min" }).addEventListener("click", () => p.startStudyPlan(plan, true));
    if (plan.frqNext) {
      row.createEl("button", { text: "Practice FRQ" }).addEventListener("click", () => p.openFrqGrader({ path: plan.frqNext.path }));
    }
    return plan;
  }

  /** Due FRQ prompts when the exam plan is not already showing them. */
  renderFrqReview(root, plan) {
    const p = this.plugin;
    if (!p.getFrqReviewQueue || (plan && plan.frqTotal)) return;
    let due = [];
    try {
      due = p.getFrqReviewQueue({}).filter((row) => row.due);
    } catch (e) {
      due = [];
    }
    if (!due.length) return;
    root.createEl("h3", { cls: "qt-today-section", text: "FRQ review" });
    const card = root.createDiv({ cls: "qt-today-card qt-frq-review" });
    card.createDiv({
      cls: "qt-today-kicker",
      text: due.length === 1 ? "1 free-response prompt due" : `${due.length} free-response prompts due`,
    });
    card.createDiv({ cls: "qt-today-meta", text: "Weak attempts and missed rubric lines return in 1–3 days; stronger attempts wait longer." });
    for (const row of due.slice(0, 3)) {
      const line = card.createDiv({ cls: "qt-ins-row" });
      const main = line.createDiv({ cls: "qt-ins-main" });
      main.createDiv({ cls: "qt-ins-name", text: row.title });
      main.createDiv({
        cls: "qt-hint",
        text: `${row.course} · ${row.percent === null ? "not scored" : `${Math.round(row.percent)}%`} · ${row.missed.length} missed rubric line${row.missed.length === 1 ? "" : "s"}`,
      });
      line.createEl("button", { text: "Practice", cls: "qt-link" }).addEventListener("click", () => p.openFrqGrader({ path: row.path }));
    }
    const actions = card.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Open AP FRQ practice", cls: "mod-cta" }).addEventListener("click", () => p.openFrqGrader());
  }

  /** The opt-in daily quiz, with its own streak so it never competes with study-time streaks. */
  renderDaily(root, today) {
    const p = this.plugin;
    const daily = normalizeDailyQuiz(p.settings.dailyQuiz);
    if (!daily.enabled) return;
    const streak = dailyStreak(daily, today);
    const done = dailyDone(daily, today);
    const plan = adaptiveDailyCount(p.getQuestions(), daily, { today, settings: normalizeQuickAdaptive(p.settings.quickAdaptive) });
    const count = plan.value;
    const card = root.createDiv({ cls: "qt-today-card qt-daily-card" });
    card.createDiv({ cls: "qt-today-kicker", text: "Daily quiz" });
    card.createDiv({
      cls: "qt-today-title",
      text: done ? "Today is complete" : `${count} question${count === 1 ? "" : "s"} today`,
    });
    const freezeText = daily.freezeEnabled ? ` · ${daily.freezes} freeze${daily.freezes === 1 ? "" : "s"}` : "";
    card.createDiv({
      cls: "qt-today-meta",
      text: `Streak ${streak} day${streak === 1 ? "" : "s"} · best ${daily.best}${freezeText}${done ? " · finish once counts once" : ""}`,
    });
    card
      .createEl("button", { text: done ? "Practice again" : "Start daily quiz", cls: "mod-cta qt-primary" })
      .addEventListener("click", () => p.startDailyQuiz());
  }

  /** One mixed list when both modules have due work; the dedicated buttons stay below. */
  renderDueQueue(root) {
    const p = this.plugin;
    if (!p.cardsEnabled || !p.cardsEnabled() || !p.getDueQueue) return;
    const queue = p.getDueQueue({ limit: 5 });
    const pending = pendingGradeCounts(p.pendingCardGrades ? p.pendingCardGrades() : []);
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
      if (pending.get(item.path)) row.createSpan({ cls: "qt-due-badge is-pending", text: "Pending" });
    }
    const actions = root.createDiv({ cls: "qt-row" });
    actions.createEl("button", { text: "Start mixed review", cls: "mod-cta qt-primary" }).addEventListener("click", () => p.openMixedReview());
    actions.createEl("button", { text: "Open due queue" }).addEventListener("click", () => p.openDueQueue());
  }

  renderCards(root) {
    const p = this.plugin;
    if (!p.cardsEnabled || !p.cardsEnabled()) return;
    const cards = p.getCards ? p.getCards() : [];
    const pending = p.pendingCardGrades ? p.pendingCardGrades() : [];
    const pendingByPath = pendingGradeCounts(pending);
    const today = fmtDate(new Date());
    const due = cards.filter(
      (c) => isStudyable(c.fm, today) && (!Number(c.fm.attempts) || (!!c.fm.next_review && String(c.fm.next_review).slice(0, 10) <= today))
    ).length;
    root.createEl("h3", { cls: "qt-today-section", text: "Cards" });
    const card = root.createDiv({ cls: "qt-today-card" });
    card.createDiv({ cls: "qt-today-kicker", text: due ? "Ready to review" : "All caught up" });
    card.createDiv({
      cls: "qt-today-title",
      text: due ? `${due} card${due === 1 ? "" : "s"} due or new` : `${cards.length} card${cards.length === 1 ? "" : "s"} in your decks`,
    });
    card.createDiv({ cls: "qt-today-meta", text: "Flashcards and vocabulary share the same review schedule as your questions." });
    if (pending.length) {
      const box = card.createDiv({ cls: "qt-today-pending" });
      box.createDiv({ cls: "qt-today-kicker", text: pending.length === 1 ? "Pending AI grade" : `${pending.length} pending AI grades` });
      box.createDiv({ cls: "qt-today-meta", text: "Typed answers waiting for the AI grader. They are not counted as incorrect." });
      const list = box.createDiv({ cls: "qt-pending-list" });
      const seen = new Set();
      const pendingCards = [];
      for (const entry of pending) {
        if (seen.has(entry.path)) continue;
        seen.add(entry.path);
        pendingCards.push(entry);
      }
      for (const entry of pendingCards.slice(0, 3)) {
        const line = list.createDiv({ cls: "qt-pending-row" });
        line.createSpan({ cls: "qt-pending-name", text: entry.front || entry.path.split("/").pop().replace(/\.md$/, "") });
        const n = pendingByPath.get(entry.path) || 0;
        if (n > 1) line.createSpan({ cls: "qt-pending-count", text: `${n} answers` });
        const card = cards.find((c) => c.file.path === entry.path);
        if (card) {
          const review = line.createEl("button", { text: "Review", cls: "qt-link" });
          review.addEventListener("click", () => p.reviewCard(card));
        }
      }
      if (pendingCards.length > 3) list.createDiv({ cls: "qt-pending-more", text: `+${pendingCards.length - 3} more` });
      const actions = box.createDiv({ cls: "qt-row" });
      const grade = actions.createEl("button", { text: "Grade pending", cls: "mod-cta" });
      grade.addEventListener("click", () => this.gradePending(grade));
    }
    const row = card.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: due ? "Review cards" : "Open cards", cls: "mod-cta qt-primary" }).addEventListener("click", () => p.activateCards());
    if (due) row.createEl("button", { text: "New card" }).addEventListener("click", () => p.openNewCard());
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

  /** One small task card: due practice plus the nearest assignment deadlines. */
  renderTasks(root, today, due, visible) {
    const p = this.plugin;
    if (!p.assignmentsEnabled || !p.assignmentsEnabled()) return;
    const assignments = p.getAssignments ? p.getAssignments() : [];
    const cardsDue =
      p.cardsEnabled && p.cardsEnabled()
        ? (p.getCards ? p.getCards() : []).filter(
            (c) => isStudyable(c.fm, today) && (!Number(c.fm.attempts) || (!!c.fm.next_review && String(c.fm.next_review).slice(0, 10) <= today))
          ).length
        : 0;
    const tasks = buildDailyTasks({ reviewCount: due.length + cardsDue, assignments, today });
    if (!tasks.length) return;
    root.createEl("h3", { cls: "qt-today-section", text: "Tasks" });
    const card = root.createDiv({ cls: "qt-today-card qt-tasks-card" });
    for (const task of tasks) {
      const row = card.createDiv({ cls: `qt-today-task is-${task.kind}` });
      const main = row.createDiv({ cls: "qt-today-task-main" });
      main.createDiv({ cls: "qt-today-task-title", text: task.title });
      main.createDiv({ cls: "qt-today-meta", text: task.meta });
      if (task.kind === "review") {
        if (due.length) {
          row.createEl("button", { text: "Start 5 minutes", cls: "mod-cta" }).addEventListener("click", () =>
            p.startQuickPractice({ minutes: 5, pool: due, mode: "due", label: "due today" })
          );
        }
      } else if (task.assignment) {
        row.createEl("button", { text: "Open", cls: "qt-link" }).addEventListener("click", () => p.openAssignmentNote(task.assignment));
      }
    }
    const actions = card.createDiv({ cls: "qt-row qt-small-row" });
    actions.createEl("button", { text: "Open Assignments" }).addEventListener("click", () => p.activateAssignments());
  }

  renderFocus(root, today) {
    const p = this.plugin;
    if (!p.studySummary) return;
    const summary = p.studySummary(today);
    root.createEl("h3", { cls: "qt-today-section", text: "Focus" });
    const card = root.createDiv({ cls: "qt-today-card qt-focus-card" });
    const focus = p.focus;
    if (focus) {
      card.createDiv({ cls: "qt-today-kicker", text: focus.course ? `Focus · ${focus.course}` : "Focus session" });
      this.focusClockEl = card.createDiv({ cls: "qt-focus-clock" });
      const row = card.createDiv({ cls: "qt-row qt-small-row" });
      row.createEl("button", { text: focus.runningSince ? "Pause" : "Resume", cls: "mod-cta" }).addEventListener("click", () =>
        focus.runningSince ? p.pauseFocusSession() : p.resumeFocusSession()
      );
      row.createEl("button", { text: "Finish & log" }).addEventListener("click", () => p.finishFocusSession());
      row.createEl("button", { text: "Discard", cls: "qt-link" }).addEventListener("click", () => p.discardFocusSession());
      this.tickFocus();
    } else {
      this.focusClockEl = null;
      card.createDiv({ cls: "qt-today-kicker", text: "Focus session" });
      card.createDiv({
        cls: "qt-today-meta",
        text: `${summary.todayMinutes} / ${summary.goalMinutes} min today · ${summary.streak}-day streak`,
      });
      const course = card.createEl("input", { cls: "qt-focus-course", attr: { placeholder: "Course (optional)", "aria-label": "Course for this focus session" } });
      course.value = p.settings.studyLog.lastCourse || "";
      const row = card.createDiv({ cls: "qt-row qt-small-row" });
      for (const minutes of [15, 25, 45]) {
        row.createEl("button", { text: `Start ${minutes}`, cls: minutes === 25 ? "mod-cta" : "" }).addEventListener("click", () =>
          p.startFocusSession(minutes, course.value)
        );
      }
      row.createEl("button", { text: "Log study time", cls: "qt-link" }).addEventListener("click", () => p.openFocusLog());
    }
    if (summary.weekMinutes || summary.todayMinutes) {
      card.createDiv({ cls: "qt-toggle-hint", text: `${summary.weekMinutes} min in the last 7 days · goal ${summary.goalPct}% today` });
    }
    const courses = Object.entries(summary.byCourse).filter(([name]) => name !== "No course").sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (courses.length) card.createDiv({ cls: "qt-toggle-hint", text: courses.map(([name, mins]) => `${name}: ${mins} min`).join(" · ") });
  }

  tickFocus() {
    if (!this.focusClockEl) return;
    const focus = this.plugin.focus;
    if (!focus) return;
    const left = focusRemainingMs(focus, Date.now());
    const elapsed = elapsedFocusMs(focus, Date.now());
    const text = left > 0 ? `${formatFocusClock(left)} left` : `${formatFocusClock(elapsed)} elapsed`;
    this.focusClockEl.setText(`${formatFocusClock(elapsed)} · ${text}`);
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
      const resource =
        p.referenceEnabled && p.referenceEnabled() && p.getApResourceNotes
          ? recommendApResource(exam, p.getApResourceNotes())
          : null;
      if (resource) {
        const attached = !!(resource.examUid && exam.uid && resource.examUid === exam.uid);
        const row = card.createDiv({ cls: "qt-today-resource" });
        row.createDiv({ cls: "qt-today-meta", text: `${attached ? "Attached resource" : "Saved resource"}${resource.stale ? " (stale)" : ""}: ${resourceTitle(resource)}` });
        if (!attached && p.attachApResourceToExam) {
          row.createEl("button", { text: "Attach to exam", cls: "qt-link" }).addEventListener("click", () => this.attachResource(resource, exam));
        }
        if (attached && p.detachApResourceFromExam) {
          row.createEl("button", { text: "Detach from exam", cls: "qt-link" }).addEventListener("click", () => this.detachResource(resource));
        }
        row.createEl("button", { text: "Open resource", cls: "qt-link" }).addEventListener("click", () => this.openResource(resource));
      }
    }
  }

  async attachResource(entry, exam) {
    if (!this.plugin.attachApResourceToExam) return;
    try {
      await this.plugin.attachApResourceToExam(entry.path, exam);
      this.render();
    } catch (err) {
      new Notice(err && err.message ? err.message : "Could not attach that resource.");
    }
  }

  async detachResource(entry) {
    if (!this.plugin.detachApResourceFromExam) return;
    try {
      await this.plugin.detachApResourceFromExam(entry.path);
      this.render();
    } catch (err) {
      new Notice(err && err.message ? err.message : "Could not detach that resource.");
    }
  }

  openResource(entry) {
    if (!this.app || !entry) return;
    const file = this.app.vault.getAbstractFileByPath(entry.path);
    if (file) {
      this.app.workspace.getLeaf("tab").openFile(file);
      return;
    }
    if (this.app.workspace.openLinkText) this.app.workspace.openLinkText(entry.path, "", false);
  }
}

module.exports = {
  VIEW_TYPE_TODAY,
  TodayView,
};
