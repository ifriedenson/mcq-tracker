"use strict";
/*
 * The local workflow modules introduced by the MIT-parity pass. They share the
 * Study Tools visual language and the same responsive breakpoint, but each tab
 * is gated by its own Global -> Modules switch and owns its own data.
 */
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_STUDY_WORKSPACE } = require("./constants");
const { localDate, str } = require("./util");
const {
  FEYNMAN_STEPS,
  allocatePlan,
  feynmanAverage,
  feynmanStepKey,
  feynmanWeakPoints,
  flowStats,
  normalizeStudyWorkspaceSettings,
  planProgress,
  planSummary,
  recallStats,
  recallDueUnits,
  subjectSummary,
} = require("./study-workspace");

const TABS = [
  { id: "feynman", label: "Feynman", module: "feynmanLearning" },
  { id: "recall", label: "Recall", module: "recallScheduler" },
  { id: "planner", label: "Topic planner", module: "lerntracker" },
  { id: "flow", label: "Study Flow", module: "studyFlow" },
  { id: "subjects", label: "Subjects", module: "subjectManager" },
  { id: "quizIndex", label: "Quiz index", module: "quizIndex" },
];

const SCORE_LABELS = { clarity: "Clarity", accuracy: "Accuracy", simplicity: "Simplicity" };

class StudyWorkspaceView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "feynman";
    this.message = "";
    this.feynmanId = "";
    this.planId = "";
    this.feynmanScoreSelects = {};
    this.flowFilter = "all";
    this.recallMode = "headings";
    this.recallQueue = [];
    this.recallIndex = 0;
    this.recallRevealed = false;
    this.recallBuilt = false;
    this.subjectFilter = "";
    this.quizIndexData = null;
    this.quizIndexFolder = "";
    this.quizIndexLimit = "50";
  }

  getViewType() {
    return VIEW_TYPE_STUDY_WORKSPACE;
  }

  getDisplayText() {
    return "Study Workspace";
  }

  getIcon() {
    return "workflow";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.contentEl.addClass("qt-study-tools");
    this.contentEl.addClass("qt-study-workspace");
    this.render();
  }

  settings() {
    return normalizeStudyWorkspaceSettings(this.plugin.settings);
  }

  enabledTabs() {
    const data = this.settings();
    return TABS.filter((tab) => data[tab.module].enabled);
  }

  setTab(tab) {
    this.tab = TABS.some((entry) => entry.id === tab) ? tab : "feynman";
    if (!this.enabledTabs().some((entry) => entry.id === this.tab)) this.tab = "feynman";
    this.render();
  }

  saveMessage(text) {
    this.message = str(text);
  }

  async refresh() {
    this.render();
  }

  render() {
    const root = this.contentEl;
    root.empty();
    const wrap = root.createDiv({ cls: "qt-wrap qt-study-tools-wrap" });
    if (!this.plugin.studyWorkspaceEnabled()) {
      this.renderOff(wrap);
      return;
    }
    const tabs = this.enabledTabs();
    if (!tabs.some((tab) => tab.id === this.tab)) this.tab = tabs[0] ? tabs[0].id : "feynman";
    const header = wrap.createDiv({ cls: "qt-study-header" });
    const title = header.createDiv({ cls: "qt-study-heading" });
    title.createEl("h2", { text: "Study Workspace" });
    title.createDiv({ cls: "qt-hint", text: "Guided, local study workflows. Each tab has its own settings switch." });
    const nav = wrap.createDiv({ cls: "qt-study-tabs" });
    for (const tab of tabs) {
      const button = nav.createEl("button", { cls: "qt-study-tab", text: tab.label });
      if (tab.id === this.tab) button.addClass("is-active");
      button.setAttr("aria-pressed", tab.id === this.tab ? "true" : "false");
      button.addEventListener("click", () => this.setTab(tab.id));
    }
    if (this.message) wrap.createDiv({ cls: "qt-study-message", text: this.message });
    if (this.tab === "feynman") this.renderFeynman(wrap);
    else if (this.tab === "recall") this.renderRecall(wrap);
    else if (this.tab === "planner") this.renderPlanner(wrap);
    else if (this.tab === "flow") this.renderFlow(wrap);
    else if (this.tab === "subjects") this.renderSubjects(wrap);
    else if (this.tab === "quizIndex") this.renderQuizIndex(wrap);
  }

  renderOff(root) {
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Study Workspace is off" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: "Feynman Learning, Recall Scheduler, the topic planner, Study Flow, Subject Manager and the Quiz index each have their own switch under Settings, Global, Modules.",
    });
    card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
  }

  renderField(form, label, type, placeholder, value) {
    const field = form.createDiv({ cls: "qt-study-field" });
    field.createEl("label", { text: label });
    const input = field.createEl("input", { cls: "qt-input" });
    input.type = type || "text";
    if (placeholder) input.placeholder = placeholder;
    if (value) input.value = value;
    return input;
  }

  renderTextarea(form, label, placeholder, value, rows) {
    const field = form.createDiv({ cls: "qt-study-field qt-study-field-wide" });
    field.createEl("label", { text: label });
    const textarea = field.createEl("textarea", { cls: "qt-study-bulk" });
    textarea.placeholder = placeholder || "";
    textarea.rows = rows || 4;
    if (value) textarea.value = value;
    return textarea;
  }

  renderSelect(form, label, options, value) {
    const field = form.createDiv({ cls: "qt-study-field" });
    field.createEl("label", { text: label });
    const select = field.createEl("select", { cls: "dropdown" });
    for (const option of options) {
      const el = select.createEl("option", { text: option.label, value: option.value });
      if (option.value === value) el.selected = true;
    }
    return select;
  }

  renderTabsEmpty(root, text) {
    root.createDiv({ cls: "qt-study-empty", text });
  }

  /* ---- Feynman Learning ------------------------------------------------ */

  renderFeynman(root) {
    const data = this.settings().feynmanLearning;
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Start a Feynman cycle" });
    add.createDiv({ cls: "qt-hint", text: "Explain a concept in four steps, then score your explanation. Nothing leaves this vault." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const topic = this.renderField(form, "Concept", "text", "Cellular respiration");
    const course = this.renderField(form, "Course", "text", "Biology");
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Start cycle", cls: "mod-cta" }).addEventListener("click", async () => {
      const session = await this.plugin.addFeynmanSession({ topic: topic.value, course: course.value });
      if (!session) {
        this.saveMessage("Add a concept first.");
        this.render();
        return;
      }
      this.feynmanId = session.id;
      this.saveMessage("Cycle started.");
      this.render();
    });

    const sessions = data.sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);
    if (!sessions.length) {
      this.renderTabsEmpty(root, "No Feynman cycles yet. Start with one concept you can explain in your own words.");
      return;
    }
    if (!this.feynmanId || !sessions.some((session) => session.id === this.feynmanId)) {
      this.feynmanId = (sessions.find((session) => !session.completed) || sessions[0]).id;
    }
    const active = sessions.find((session) => session.id === this.feynmanId);
    if (active) this.renderFeynmanActive(root, active);
    const list = root.createDiv({ cls: "qt-study-card" });
    list.createEl("h3", { text: "Saved cycles" });
    const rows = list.createDiv({ cls: "qt-study-list" });
    for (const session of sessions) {
      const row = rows.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: session.topic });
      const average = feynmanAverage(session.scores);
      main.createDiv({
        cls: "qt-study-row-meta",
        text: `${session.course ? `${session.course} · ` : ""}${session.completed ? "Complete" : `Step ${session.step + 1} of ${FEYNMAN_STEPS.length}`}${average ? ` · ${average}/5` : ""}`,
      });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: session.id === this.feynmanId ? "Open" : "Review" }).addEventListener("click", () => {
        this.feynmanId = session.id;
        this.render();
      });
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeFeynmanSession(session.id);
        if (this.feynmanId === session.id) this.feynmanId = "";
        this.render();
      });
    }
  }

  renderFeynmanActive(root, session) {
    const card = root.createDiv({ cls: "qt-study-card qt-workspace-active" });
    const head = card.createDiv({ cls: "qt-workspace-head" });
    head.createEl("h3", { text: session.topic });
    head.createSpan({ cls: "qt-study-row-meta", text: session.completed ? "Complete" : `Step ${Math.min(session.step + 1, FEYNMAN_STEPS.length)} of ${FEYNMAN_STEPS.length}` });
    if (session.completed) {
      card.createDiv({ cls: "qt-study-next-meta", text: `Average score: ${feynmanAverage(session.scores) || 0}/5` });
      const weak = feynmanWeakPoints(session.scores);
      card.createDiv({
        cls: "qt-study-row-meta",
        text: weak.length ? `Review: ${weak.map((key) => SCORE_LABELS[key]).join(", ")}` : "No weak dimension recorded. Start another cycle for a new concept.",
      });
      card.createEl("button", { text: "Open for editing" }).addEventListener("click", async () => {
        await this.plugin.updateFeynmanSession(session.id, { completed: false, step: FEYNMAN_STEPS.length - 1 });
        this.render();
      });
      return;
    }
    const step = Math.min(session.step, FEYNMAN_STEPS.length - 1);
    const key = feynmanStepKey(step);
    card.createDiv({ cls: "qt-workspace-step-label", text: `Step ${step + 1}: ${FEYNMAN_STEPS[step]}` });
    card.createDiv({ cls: "qt-hint", text: feynmanPrompt(step) });
    const textarea = card.createEl("textarea", { cls: "qt-study-bulk qt-workspace-answer" });
    textarea.rows = 7;
    textarea.value = session.answers[key] || "";
    textarea.placeholder = "Write your explanation in your own words.";
    const controls = card.createDiv({ cls: "qt-row qt-study-actions" });
    if (step > 0) {
      controls.createEl("button", { text: "Back" }).addEventListener("click", async () => {
        await this.plugin.updateFeynmanSession(session.id, { step: step - 1, answers: { ...session.answers, [key]: textarea.value } });
        this.render();
      });
    }
    controls.createEl("button", { text: step === FEYNMAN_STEPS.length - 1 ? "Finish and score" : "Next step", cls: "mod-cta" }).addEventListener("click", async () => {
      const answers = { ...session.answers, [key]: textarea.value };
      if (!str(textarea.value).trim()) {
        this.saveMessage("Write an explanation before moving on.");
        this.render();
        return;
      }
      if (step < FEYNMAN_STEPS.length - 1) {
        await this.plugin.updateFeynmanSession(session.id, { step: step + 1, answers });
        this.saveMessage("Saved. Keep going.");
        this.render();
        return;
      }
      await this.plugin.updateFeynmanSession(session.id, { step: FEYNMAN_STEPS.length, completed: true, answers, scores: this.readScores() });
      this.saveMessage("Cycle complete. Weak dimensions are ready to drill.");
      this.render();
    });
    if (step === FEYNMAN_STEPS.length - 1) {
      const scoreRow = card.createDiv({ cls: "qt-workspace-scores" });
      for (const dimension of ["clarity", "accuracy", "simplicity"]) {
        const label = scoreRow.createDiv({ cls: "qt-study-field" });
        label.createEl("label", { text: SCORE_LABELS[dimension] });
        const select = label.createEl("select", { cls: "dropdown qt-feynman-score" });
        select.dataset.score = dimension;
        this.feynmanScoreSelects[dimension] = select;
        for (let value = 1; value <= 5; value++) {
          const option = select.createEl("option", { text: `${value}/5`, value: String(value) });
          if ((session.scores[dimension] || 3) === value) option.selected = true;
        }
      }
    }
    const dates = card.createDiv({ cls: "qt-study-row-meta", text: `Started ${new Date(session.createdAt || Date.now()).toLocaleDateString()}` });
  }

  readScores() {
    const scores = {};
    for (const [dimension, select] of Object.entries(this.feynmanScoreSelects)) {
      scores[dimension] = Number(select && select.value) || 0;
    }
    return scores;
  }

  /* ---- Recall Scheduler ------------------------------------------------ */

  renderRecall(root) {
    const data = this.settings().recallScheduler;
    const stats = recallStats(data.reviews, localDate());
    const controls = root.createDiv({ cls: "qt-study-card" });
    controls.createEl("h3", { text: "Build a recall queue" });
    controls.createDiv({ cls: "qt-hint", text: "Review headings or knowledge fragments from Markdown notes. Ratings are stored locally; note text is never rewritten." });
    const form = controls.createDiv({ cls: "qt-study-form" });
    const mode = this.renderSelect(form, "Mode", [
      { value: "headings", label: "Headings" },
      { value: "fragments", label: "Knowledge fragments" },
    ], this.recallMode);
    const folder = this.renderField(form, "Folder (optional)", "text", "Biology", data.folder);
    const limit = this.renderField(form, "Limit", "number", "20", String(data.limit));
    const statsRow = controls.createDiv({ cls: "qt-study-next-meta", text: `${stats.tracked} tracked · ${stats.due} due · ${stats.learned} reviewed` });
    const actions = controls.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Build queue", cls: "mod-cta" }).addEventListener("click", async () => {
      this.recallMode = mode.value;
      try {
        const result = await this.plugin.buildRecallQueue({ mode: mode.value, folder: folder.value, limit: limit.value });
        this.recallQueue = Array.isArray(result) ? result : [];
        this.recallIndex = 0;
        this.recallRevealed = false;
        this.recallBuilt = true;
        this.saveMessage(this.recallQueue.length ? `Loaded ${this.recallQueue.length} due unit${this.recallQueue.length === 1 ? "" : "s"}.` : "No due recall units in that scope.");
        this.render();
      } catch (e) {
        new Notice(`Could not build the recall queue: ${str(e && e.message ? e.message : e)}`);
      }
    });
    if (!this.recallBuilt) {
      this.renderTabsEmpty(root, "Choose a mode and build a queue. Only units that are due now are included.");
      return;
    }
    if (!this.recallQueue.length || this.recallIndex >= this.recallQueue.length) {
      const done = root.createDiv({ cls: "qt-study-card" });
      done.createEl("h3", { text: "Queue complete" });
      done.createDiv({ cls: "qt-study-empty", text: "No more due units in this queue. Build another queue later or switch modes." });
      return;
    }
    const unit = this.recallQueue[this.recallIndex];
    const card = root.createDiv({ cls: "qt-study-card qt-workspace-active" });
    card.createDiv({ cls: "qt-workspace-step-label", text: `${unit.kind === "headings" ? "Heading" : "Fragment"} ${this.recallIndex + 1} of ${this.recallQueue.length}` });
    card.createEl("h3", { text: unit.title });
    card.createDiv({ cls: "qt-study-row-meta", text: unit.path });
    const body = card.createDiv({ cls: `qt-workspace-quote${this.recallRevealed ? "" : " is-hidden"}` });
    body.createDiv({ cls: "qt-workspace-quote-text", text: unit.body });
    const actionsRow = card.createDiv({ cls: "qt-row qt-study-actions" });
    if (!this.recallRevealed) {
      actionsRow.createEl("button", { text: "Reveal", cls: "mod-cta" }).addEventListener("click", () => {
        this.recallRevealed = true;
        this.render();
      });
      return;
    }
    for (const [grade, label] of [["again", "Again"], ["hard", "Hard"], ["good", "Good"], ["easy", "Easy"]]) {
      actionsRow.createEl("button", { text: label }).addEventListener("click", async () => {
        await this.plugin.reviewRecallUnit(unit, grade);
        this.recallIndex++;
        this.recallRevealed = false;
        this.saveMessage(`Rated ${label.toLowerCase()}.`);
        this.render();
      });
    }
  }

  /* ---- Topic planner --------------------------------------------------- */

  renderPlanner(root) {
    const data = this.settings().lerntracker;
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "New topic plan" });
    add.createDiv({ cls: "qt-hint", text: "Plan repeated passes over a course's topics. Buffer days stay free before the exam." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const course = this.renderField(form, "Course", "text", "Biology");
    const exam = this.renderField(form, "Exam date", "date", "", "");
    const buffer = this.renderField(form, "Buffer days", "number", "2", "2");
    const target = this.renderField(form, "Passes per topic", "number", "3", "3");
    const topics = this.renderTextarea(form, "Topics (one per line)", "Cell structure\nRespiration\nPhotosynthesis", "", 4);
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Create plan", cls: "mod-cta" }).addEventListener("click", async () => {
      const names = topics.value.split("\n").map((line) => line.trim()).filter(Boolean);
      const plan = await this.plugin.addPlannerPlan({
        course: course.value,
        examDate: exam.value,
        bufferDays: buffer.value,
        targetPasses: target.value,
        topics: names.map((name) => ({ name })),
      });
      if (!plan) {
        this.saveMessage("Add a course and an exam date first.");
        this.render();
        return;
      }
      this.planId = plan.id;
      this.saveMessage("Plan created.");
      this.render();
    });

    const plans = data.plans.slice().sort((a, b) => (a.examDate || "9999").localeCompare(b.examDate || "9999"));
    if (!plans.length) {
      this.renderTabsEmpty(root, "No topic plans yet. Add an exam date and a few topics to get a day-by-day allocation.");
      return;
    }
    if (!this.planId || !plans.some((plan) => plan.id === this.planId)) this.planId = plans[0].id;
    const plan = plans.find((entry) => entry.id === this.planId);
    if (!plan) return;
    const summary = planSummary(plan, localDate());
    const card = root.createDiv({ cls: "qt-study-card qt-workspace-active" });
    const head = card.createDiv({ cls: "qt-workspace-head" });
    head.createEl("h3", { text: plan.course });
    head.createSpan({ cls: "qt-study-row-meta", text: `${summary.daysLeft} day${summary.daysLeft === 1 ? "" : "s"} left${summary.examDate ? ` · exam ${summary.examDate}` : ""}` });
    card.createDiv({ cls: "qt-study-next-meta", text: `${summary.passes} of ${summary.target} passes · ${summary.bufferDays} buffer day${summary.bufferDays === 1 ? "" : "s"}` });
    const bar = card.createDiv({ cls: "qt-study-bar" });
    bar.createDiv({ cls: "qt-study-bar-fill" }).style.width = `${summary.percent}%`;
    if (summary.examDate && summary.percent < 100) {
      card.createDiv({
        cls: "qt-study-row-meta",
        text: summary.nextDay ? `Next allocation: ${summary.nextDay.date} — ${summary.nextDay.topics.join(", ")}` : "No study day fits before the buffer. Move the exam date or shorten the buffer.",
      });
    }
    const addTopic = card.createDiv({ cls: "qt-study-form qt-workspace-inline-form" });
    const topicName = this.renderField(addTopic, "Add topic", "text", "Krebs cycle");
    const topicTarget = this.renderField(addTopic, "Target passes", "number", "3", String(plan.targetPasses));
    const topicActions = card.createDiv({ cls: "qt-row qt-study-actions" });
    topicActions.createEl("button", { text: "Add topic" }).addEventListener("click", async () => {
      await this.plugin.addPlannerTopic(plan.id, { name: topicName.value, targetPasses: topicTarget.value });
      this.render();
    });
    const list = card.createDiv({ cls: "qt-study-list" });
    if (!plan.topics.length) list.createDiv({ cls: "qt-study-empty", text: "No topics yet. Add the first one above." });
    for (const topic of plan.topics) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: topic.name });
      main.createDiv({ cls: "qt-study-row-meta", text: `${topic.passes} / ${topic.targetPasses} passes` });
      const topicBar = main.createDiv({ cls: "qt-study-bar" });
      topicBar.createDiv({ cls: "qt-study-bar-fill" }).style.width = `${Math.round((topic.passes / topic.targetPasses) * 100)}%`;
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      if (topic.passes < topic.targetPasses) {
        buttons.createEl("button", { text: "+1 pass" }).addEventListener("click", async () => {
          await this.plugin.addPlannerPass(plan.id, topic.id);
          this.render();
        });
      }
      buttons.createEl("button", { text: "Remove", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removePlannerTopic(plan.id, topic.id);
        this.render();
      });
    }
    const daysCard = root.createDiv({ cls: "qt-study-card" });
    daysCard.createEl("h3", { text: "Day-level allocation" });
    if (!summary.days.length) {
      daysCard.createDiv({ cls: "qt-study-empty", text: "No study days fit before the buffer." });
    } else {
      const days = daysCard.createDiv({ cls: "qt-workspace-days" });
      for (const day of summary.days.slice(0, 14)) {
        const row = days.createDiv({ cls: "qt-workspace-day" });
        row.createSpan({ cls: "qt-workspace-day-date", text: day.date });
        row.createSpan({ cls: "qt-workspace-day-topic", text: day.topics.length ? day.topics.join(", ") : "Free" });
      }
      if (summary.days.length > 14) daysCard.createDiv({ cls: "qt-study-row-meta", text: `+${summary.days.length - 14} more days` });
    }
    const planRow = root.createDiv({ cls: "qt-row qt-study-actions" });
    planRow.createEl("button", { text: "Delete plan", cls: "qt-danger" }).addEventListener("click", async () => {
      await this.plugin.removePlannerPlan(plan.id);
      this.planId = "";
      this.render();
    });
    const switchRow = root.createDiv({ cls: "qt-row qt-study-actions" });
    for (const entry of plans) {
      switchRow.createEl("button", { text: entry === plan ? `${entry.course} (open)` : entry.course }).addEventListener("click", () => {
        this.planId = entry.id;
        this.render();
      });
    }
  }

  /* ---- Study Flow ------------------------------------------------------ */

  renderFlow(root) {
    const data = this.settings().studyFlow;
    const stats = flowStats(data.excerpts);
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Capture a source excerpt" });
    add.createDiv({ cls: "qt-hint", text: "Keep the source path, the passage, your explanation and a card draft together. The source note is not modified." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const source = this.renderField(form, "Source path", "text", "Readings/biology.pdf");
    const quote = this.renderTextarea(form, "Excerpt", "Paste the passage or your raw notes", "", 4);
    const understanding = this.renderTextarea(form, "What it means", "Explain it in your own words", "", 3);
    const cardDraft = this.renderTextarea(form, "Card draft (optional)", "Question :: Answer", "", 2);
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add to inbox", cls: "mod-cta" }).addEventListener("click", async () => {
      const excerpt = await this.plugin.addFlowExcerpt({
        sourcePath: source.value,
        quote: quote.value,
        understanding: understanding.value,
        card: cardDraft.value,
      });
      if (!excerpt) {
        this.saveMessage("Add an excerpt first.");
        this.render();
        return;
      }
      this.saveMessage("Excerpt added to the inbox.");
      this.render();
    });
    const filterRow = root.createDiv({ cls: "qt-row qt-study-actions" });
    filterRow.createDiv({ cls: "qt-study-next-meta", text: `${stats.inbox} inbox · ${stats.review} reviewing · ${stats.understood} understood · ${stats.withCards} card drafts` });
    for (const [value, label] of [["all", "All"], ["inbox", "Inbox"], ["review", "Reviewing"], ["understood", "Understood"]]) {
      const button = filterRow.createEl("button", { text: label });
      if (value === this.flowFilter) button.addClass("is-active");
      button.addEventListener("click", () => {
        this.flowFilter = value;
        this.render();
      });
    }
    const listCard = root.createDiv({ cls: "qt-study-card" });
    listCard.createEl("h3", { text: "Source review" });
    const excerpts = data.excerpts
      .filter((entry) => this.flowFilter === "all" || entry.status === this.flowFilter)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (!excerpts.length) {
      listCard.createDiv({ cls: "qt-study-empty", text: "Nothing in this view. Capture an excerpt above." });
      return;
    }
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const excerpt of excerpts) {
      const row = list.createDiv({ cls: "qt-study-row qt-workspace-flow-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: excerpt.sourcePath || "Unlinked source" });
      const quote = main.createDiv({ cls: "qt-workspace-flow-quote", text: excerpt.quote });
      if (excerpt.understanding) main.createDiv({ cls: "qt-study-row-meta", text: excerpt.understanding });
      if (excerpt.card) main.createDiv({ cls: "qt-study-row-meta", text: `Card draft: ${excerpt.card}` });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      if (excerpt.status !== "understood") {
        buttons.createEl("button", { text: "Understood" }).addEventListener("click", async () => {
          await this.plugin.updateFlowExcerpt(excerpt.id, { status: "understood" });
          this.render();
        });
      }
      if (excerpt.sourcePath && this.plugin.openStudyFlowSource) {
        buttons.createEl("button", { text: "Source" }).addEventListener("click", () => this.plugin.openStudyFlowSource(excerpt.sourcePath));
      }
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeFlowExcerpt(excerpt.id);
        this.render();
      });
    }
  }

  /* ---- Quiz index ------------------------------------------------------ */

  renderQuizIndex(root) {
    const data = this.settings().quizIndex;
    const controls = root.createDiv({ cls: "qt-study-card" });
    controls.createEl("h3", { text: "Quiz index" });
    controls.createDiv({
      cls: "qt-hint",
      text: "Scan inline quizzes across the vault. Counts and recorded results come from the existing quiz blocks and opt-in quizResults properties; scanning never creates attempts or changes a note.",
    });
    const form = controls.createDiv({ cls: "qt-study-form" });
    const folder = this.renderField(form, "Folder (optional)", "text", "Quizzes", this.quizIndexFolder || data.folder);
    const limit = this.renderField(form, "Limit", "number", "50", this.quizIndexLimit || String(data.limit));
    const actions = controls.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Scan vault", cls: "mod-cta" }).addEventListener("click", async () => {
      this.quizIndexFolder = str(folder.value).trim();
      this.quizIndexLimit = str(limit.value).trim() || "50";
      try {
        this.quizIndexData = await this.plugin.buildQuizIndex({
          folder: this.quizIndexFolder,
          limit: this.quizIndexLimit,
        });
        const stats = this.quizIndexData.stats;
        this.saveMessage(`Found ${stats.quizzes} quiz${stats.quizzes === 1 ? "" : "zes"} with ${stats.questions} question${stats.questions === 1 ? "" : "s"}.`);
        this.render();
      } catch (e) {
        new Notice(`Could not scan quizzes: ${str(e && e.message ? e.message : e)}`);
      }
    });
    if (!this.quizIndexData) {
      this.renderTabsEmpty(root, "Scan the vault to build the quiz index.");
      return;
    }
    const stats = this.quizIndexData.stats;
    const statGrid = root.createDiv({ cls: "qt-study-stats" });
    const stat = (value, label) => {
      const card = statGrid.createDiv({ cls: "qt-study-stat" });
      card.createDiv({ cls: "qt-study-stat-value", text: String(value) });
      card.createDiv({ cls: "qt-study-stat-label", text: label });
    };
    stat(stats.quizzes, "quizzes");
    stat(stats.questions, "questions");
    stat(stats.withResults, "recorded results");
    stat(stats.average ? `${stats.average}%` : "—", stats.withResults ? "average result" : "no results yet");
    const levels = Object.entries(stats.levels || {});
    const types = Object.entries(stats.types || {});
    const index = root.createDiv({ cls: "qt-study-card" });
    index.createEl("h3", { text: "Index" });
    if (levels.length) index.createDiv({ cls: "qt-study-row-meta", text: `Levels: ${levels.map(([key, count]) => `${key} ${count}`).join(" · ")}` });
    if (types.length) index.createDiv({ cls: "qt-study-row-meta", text: `Types: ${types.map(([key, count]) => `${key} ${count}`).join(" · ")}` });
    if (!this.quizIndexData.rows.length) {
      index.createDiv({ cls: "qt-study-empty", text: "No inline quizzes were found in that scope." });
      return;
    }
    const list = index.createDiv({ cls: "qt-study-list" });
    for (const row of this.quizIndexData.rows) {
      const item = list.createDiv({ cls: "qt-study-row" });
      const main = item.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: `${row.id} · ${row.count} question${row.count === 1 ? "" : "s"}` });
      if (row.title) main.createDiv({ cls: "qt-study-row-meta", text: row.title });
      main.createDiv({ cls: "qt-study-row-meta", text: row.path });
      if (row.result) {
        main.createDiv({
          cls: "qt-study-row-meta",
          text: `Recorded: ${row.result.percentage}% (${row.result.score}/${row.result.totalPoints})${row.result.passed ? " · passed" : ""}`,
        });
      }
      const buttons = item.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Open note" }).addEventListener("click", () => this.plugin.openStudyFlowSource(row.path));
    }
  }

  /* ---- Subject Manager ------------------------------------------------- */

  renderSubjects(root) {
    const data = this.settings().subjectManager;
    const lectures = this.plugin.studyToolsSettings ? this.plugin.studyToolsSettings().lectureLog.lectures : [];
    const summary = subjectSummary(data.subjects, data.absences, lectures);
    const filtered = summary.filter((subject) => !this.subjectFilter || `${subject.name} ${subject.folder} ${subject.notes}`.toLowerCase().includes(this.subjectFilter));
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Add a subject" });
    const form = add.createDiv({ cls: "qt-study-form" });
    const name = this.renderField(form, "Subject", "text", "Biology");
    const folder = this.renderField(form, "Folder", "text", "Courses/Biology");
    const color = this.renderField(form, "Color", "text", "#7c9cf5");
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add subject", cls: "mod-cta" }).addEventListener("click", async () => {
      const subject = await this.plugin.addStudySubject({ name: name.value, folder: folder.value, color: color.value });
      if (!subject) {
        this.saveMessage("Add a subject name first.");
        this.render();
        return;
      }
      this.saveMessage("Subject added.");
      this.render();
    });
    const search = root.createDiv({ cls: "qt-study-card" });
    search.createEl("h3", { text: "Subjects" });
    const filter = search.createEl("input", { cls: "qt-input", type: "search" });
    filter.placeholder = "Search subjects";
    filter.value = this.subjectFilter;
    filter.addEventListener("input", () => {
      this.subjectFilter = filter.value.toLowerCase();
      this.render();
    });
    if (!filtered.length) {
      search.createDiv({ cls: "qt-study-empty", text: data.subjects.length ? "No subject matches that search." : "No subjects yet. Add the courses you are tracking." });
    } else {
      const list = search.createDiv({ cls: "qt-study-list" });
      for (const subject of filtered) {
        const row = list.createDiv({ cls: "qt-study-row" });
        const main = row.createDiv({ cls: "qt-study-row-main" });
        const title = main.createDiv({ cls: "qt-study-row-title" });
        const dot = title.createSpan({ cls: "qt-workspace-subject-dot" });
        dot.style.background = subject.color;
        title.createSpan({ text: subject.name });
        main.createDiv({
          cls: "qt-study-row-meta",
          text: `${subject.lectures} lecture${subject.lectures === 1 ? "" : "s"} · ${subject.absences} absence${subject.absences === 1 ? "" : "s"}${subject.folder ? ` · ${subject.folder}` : ""}`,
        });
        const buttons = row.createDiv({ cls: "qt-study-row-actions" });
        buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
          await this.plugin.removeStudySubject(subject.id);
          this.render();
        });
      }
    }
    const absenceCard = root.createDiv({ cls: "qt-study-card" });
    absenceCard.createEl("h3", { text: "Log an absence" });
    if (!data.subjects.length) {
      absenceCard.createDiv({ cls: "qt-study-empty", text: "Add a subject before logging an absence." });
      return;
    }
    const absenceForm = absenceCard.createDiv({ cls: "qt-study-form" });
    const subjectSelect = this.renderSelect(
      absenceForm,
      "Subject",
      data.subjects.map((subject) => ({ value: subject.name, label: subject.name })),
      data.subjects[0].name
    );
    const date = this.renderField(absenceForm, "Date", "date", "", localDate());
    const reason = this.renderField(absenceForm, "Reason (optional)", "text", "Medical appointment");
    const absenceActions = absenceCard.createDiv({ cls: "qt-row qt-study-actions" });
    absenceActions.createEl("button", { text: "Add absence" }).addEventListener("click", async () => {
      const absence = await this.plugin.addStudyAbsence({ subject: subjectSelect.value, date: date.value, reason: reason.value });
      if (!absence) {
        this.saveMessage("Choose a subject and a real date.");
        this.render();
        return;
      }
      this.render();
    });
    const absences = data.absences.slice().sort((a, b) => b.date.localeCompare(a.date));
    if (!absences.length) return;
    const absenceList = absenceCard.createDiv({ cls: "qt-study-list" });
    for (const absence of absences.slice(0, 12)) {
      const row = absenceList.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: `${absence.subject} · ${absence.date}` });
      if (absence.reason) main.createDiv({ cls: "qt-study-row-meta", text: absence.reason });
      row.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeStudyAbsence(absence.id);
        this.render();
      });
    }
  }
}

function feynmanPrompt(step) {
  return [
    "Write what you already know without looking anything up.",
    "Where did you hesitate, hand-wave or use a term you cannot define?",
    "Rewrite the explanation with a concrete example or analogy.",
    "Explain it again as if teaching someone who has never seen it.",
  ][step] || "";
}

module.exports = { StudyWorkspaceView };
