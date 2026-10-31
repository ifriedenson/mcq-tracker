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
  SOCRATIC_STEPS,
  allocatePlan,
  courseDashboard,
  feynmanAverage,
  feynmanStepKey,
  feynmanWeakPoints,
  flowStats,
  normalizeStudyWorkspaceSettings,
  planProgress,
  planSummary,
  recallStats,
  recallDueUnits,
  retentionForecast,
  subjectSummary,
  taskSummary,
  vocabSummary,
} = require("./study-workspace");

const TABS = [
  { id: "feynman", label: "Feynman", module: "feynmanLearning" },
  { id: "recall", label: "Recall", module: "recallScheduler" },
  { id: "planner", label: "Topic planner", module: "lerntracker" },
  { id: "flow", label: "Study Flow", module: "studyFlow" },
  { id: "subjects", label: "Subjects", module: "subjectManager" },
  { id: "courses", label: "Courses", module: "courseHub" },
  { id: "tasks", label: "Tasks", module: "studyTasks" },
  { id: "annotations", label: "Annotations", module: "annotations" },
  { id: "deepNotes", label: "Deep Notes", module: "deepNotes" },
  { id: "retention", label: "Retention", module: "retention" },
  { id: "vocabulary", label: "Vocabulary", module: "vocabulary" },
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
    this.annotationFilter = "";
    this.deepNotesId = "";
    this.retentionData = null;
    this.vocabFilter = "";
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
    else if (this.tab === "courses") this.renderCourses(wrap);
    else if (this.tab === "tasks") this.renderTasks(wrap);
    else if (this.tab === "annotations") this.renderAnnotations(wrap);
    else if (this.tab === "deepNotes") this.renderDeepNotes(wrap);
    else if (this.tab === "retention") this.renderRetention(wrap);
    else if (this.tab === "vocabulary") this.renderVocabulary(wrap);
    else if (this.tab === "quizIndex") this.renderQuizIndex(wrap);
  }

  renderOff(root) {
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Study Workspace is off" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: "Feynman Learning, Recall Scheduler, the topic planner, Study Flow, Subject Manager, Courses, Tasks, Annotations, Deep Notes, Retention, Vocabulary and the Quiz index each have their own switch under Settings, Global, Modules.",
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
    stat(stats.attempts || 0, "recorded attempts");
    stat(stats.attempts ? `${stats.firstAttempt}%` : "—", "first-attempt accuracy");
    const levels = Object.entries(stats.levels || {});
    const types = Object.entries(stats.types || {});
    const index = root.createDiv({ cls: "qt-study-card" });
    index.createEl("h3", { text: "Index" });
    if (levels.length) index.createDiv({ cls: "qt-study-row-meta", text: `Levels: ${levels.map(([key, count]) => `${key} ${count}`).join(" · ")}` });
    if (types.length) index.createDiv({ cls: "qt-study-row-meta", text: `Types: ${types.map(([key, count]) => `${key} ${count}`).join(" · ")}` });
    const topics = stats.topics || [];
    if (topics.length) {
      const topicCard = root.createDiv({ cls: "qt-study-card" });
      topicCard.createEl("h3", { text: "Topic index" });
      for (const topic of topics) {
        topicCard.createDiv({ cls: "qt-study-row-meta", text: `${topic.topic}: ${topic.correct}/${topic.total} · ${topic.percentage}%` });
      }
    }
    const wrongAnswers = stats.wrongAnswers || [];
    if (wrongAnswers.length) {
      const wrongCard = root.createDiv({ cls: "qt-study-card" });
      wrongCard.createEl("h3", { text: "Wrong-answer index" });
      for (const item of wrongAnswers) {
        wrongCard.createDiv({ cls: "qt-study-row-meta", text: `${item.count}× ${item.question}` });
      }
    }
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
      if (row.attempts) {
        main.createDiv({
          cls: "qt-study-row-meta",
          text: `Attempts: ${row.attempts} · first ${row.firstAttempt}% · last ${row.lastAttempt}%`,
        });
      }
      const buttons = item.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Open note" }).addEventListener("click", () => this.plugin.openStudyFlowSource(row.path));
    }
  }

  /* ---- Course hub ------------------------------------------------------ */

  renderCourses(root) {
    const data = this.settings().courseHub;
    const subjects = this.settings().subjectManager.subjects;
    const absences = this.settings().subjectManager.absences;
    const lectures = this.plugin.studyToolsSettings ? this.plugin.studyToolsSettings().lectureLog.lectures : [];
    const dashboard = courseDashboard(subjects, lectures, absences, data.grades);
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Add a course grade" });
    add.createDiv({ cls: "qt-hint", text: "Grade chips are local estimates from weighted entries. Subjects and lectures are read from their own modules; nothing is written back to those notes." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const course = this.renderField(form, "Course", "text", "Biology");
    const title = this.renderField(form, "Grade item", "text", "Midterm");
    const score = this.renderField(form, "Score", "number", "85");
    const weight = this.renderField(form, "Weight", "number", "1");
    const date = this.renderField(form, "Date", "date", "", localDate());
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add grade", cls: "mod-cta" }).addEventListener("click", async () => {
      const grade = await this.plugin.addCourseGrade({ course: course.value, title: title.value, score: score.value, weight: weight.value, date: date.value });
      if (!grade) {
        this.saveMessage("Add a course and a grade-item name first.");
        this.render();
        return;
      }
      this.saveMessage("Grade added.");
      this.render();
    });
    if (!dashboard.length) {
      this.renderTabsEmpty(root, "Add a grade or a subject to build the course dashboard.");
      return;
    }
    const graded = dashboard.filter((entry) => entry.graded);
    const totalWeight = data.grades.reduce((sum, grade) => sum + grade.weight, 0);
    const overall = totalWeight ? Math.round((data.grades.reduce((sum, grade) => sum + grade.score * grade.weight, 0) / totalWeight) * 10) / 10 : 0;
    const stats = root.createDiv({ cls: "qt-study-stats" });
    const stat = (value, label) => {
      const card = stats.createDiv({ cls: "qt-study-stat" });
      card.createDiv({ cls: "qt-study-stat-value", text: String(value) });
      card.createDiv({ cls: "qt-study-stat-label", text: label });
    };
    stat(dashboard.length, "courses");
    stat(data.grades.length, "grades");
    stat(totalWeight ? `${overall}%` : "—", "weighted average");
    stat(graded.length, "courses graded");
    const cards = root.createDiv({ cls: "qt-study-grid" });
    for (const entry of dashboard) {
      const card = cards.createDiv({ cls: "qt-study-card qt-course-card" });
      const head = card.createDiv({ cls: "qt-workspace-head" });
      const heading = head.createEl("h3");
      const dot = heading.createSpan({ cls: "qt-workspace-subject-dot" });
      dot.style.background = entry.color;
      heading.createSpan({ text: entry.name });
      const chip = head.createSpan({ cls: "qt-workspace-grade", text: entry.graded ? `${entry.letter} · ${entry.weighted}%` : "No grades" });
      if (entry.graded) chip.addClass(`is-${entry.letter.toLowerCase()}`);
      card.createDiv({ cls: "qt-study-row-meta", text: `${entry.lectures} lecture${entry.lectures === 1 ? "" : "s"} · ${entry.absences} absence${entry.absences === 1 ? "" : "s"}${entry.folder ? ` · ${entry.folder}` : ""}` });
      if (entry.lastLecture) card.createDiv({ cls: "qt-study-row-meta", text: `Last lecture: ${entry.lastLecture.date} · ${entry.lastLecture.title}` });
      if (entry.grades.length) {
        const list = card.createDiv({ cls: "qt-study-list" });
        for (const grade of entry.grades.slice(0, 8)) {
          const row = list.createDiv({ cls: "qt-study-row" });
          const main = row.createDiv({ cls: "qt-study-row-main" });
          main.createDiv({ cls: "qt-study-row-title", text: `${grade.title} · ${grade.score}%` });
          main.createDiv({ cls: "qt-study-row-meta", text: `${grade.date || "No date"} · weight ${grade.weight}` });
          row.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
            await this.plugin.removeCourseGrade(grade.id);
            this.render();
          });
        }
      }
    }
  }

  /* ---- Study tasks ----------------------------------------------------- */

  renderTasks(root) {
    const data = this.settings().studyTasks;
    const summary = taskSummary(data.tasks, localDate());
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Add a study task" });
    add.createDiv({ cls: "qt-hint", text: "Tasks are local. Remind shows due work inside Obsidian; it does not use OS notifications." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const title = this.renderField(form, "Task", "text", "Review cell respiration");
    const course = this.renderField(form, "Course", "text", "Biology");
    const due = this.renderField(form, "Due", "date", "", localDate());
    const addActions = add.createDiv({ cls: "qt-row qt-study-actions" });
    addActions.createEl("button", { text: "Add task", cls: "mod-cta" }).addEventListener("click", async () => {
      const task = await this.plugin.addStudyTask({ title: title.value, course: course.value, due: due.value });
      if (!task) {
        this.saveMessage("Add a task name first.");
        this.render();
        return;
      }
      this.saveMessage("Task added.");
      this.render();
    });

    const generate = root.createDiv({ cls: "qt-study-card" });
    generate.createEl("h3", { text: "Generate exam tasks" });
    generate.createDiv({ cls: "qt-hint", text: "Spreads repeated topic passes over the days before the exam. Tasks are previews of work, not scheduled cards." });
    const genForm = generate.createDiv({ cls: "qt-study-form" });
    const genCourse = this.renderField(genForm, "Course", "text", "Biology");
    const exam = this.renderField(genForm, "Exam date", "date", "", "");
    const topics = this.renderTextarea(genForm, "Topics (one per line)", "Cells\nRespiration\nPhotosynthesis", "", 4);
    const passes = this.renderField(genForm, "Passes", "number", "2", "2");
    const genActions = generate.createDiv({ cls: "qt-row qt-study-actions" });
    genActions.createEl("button", { text: "Generate tasks" }).addEventListener("click", async () => {
      const created = await this.plugin.generateStudyTasks({ course: genCourse.value, examDate: exam.value, topics: topics.value, passes: passes.value });
      this.saveMessage(created.length ? `Generated ${created.length} task${created.length === 1 ? "" : "s"}.` : "Add a course, a future exam date and at least one topic.");
      this.render();
    });

    const summaryCard = root.createDiv({ cls: "qt-study-card" });
    const summaryHead = summaryCard.createDiv({ cls: "qt-workspace-head" });
    summaryHead.createEl("h3", { text: "Task queue" });
    summaryHead.createSpan({ cls: "qt-study-row-meta", text: `${summary.open} open · ${summary.overdue} overdue · ${summary.dueToday} due today · ${summary.done} done` });
    const summaryActions = summaryCard.createDiv({ cls: "qt-row qt-study-actions" });
    summaryActions.createEl("button", { text: "Remind" }).addEventListener("click", async () => {
      await this.plugin.remindStudyTasks();
    });
    if (!data.tasks.length) {
      summaryCard.createDiv({ cls: "qt-study-empty", text: "No tasks yet. Add one or generate an exam plan." });
      return;
    }
    const list = summaryCard.createDiv({ cls: "qt-study-list" });
    const tasks = data.tasks.slice().sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1) || (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31"));
    for (const task of tasks) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: task.title });
      main.createDiv({ cls: "qt-study-row-meta", text: `${task.course ? `${task.course} · ` : ""}${task.due || "No due date"}${task.source === "exam" ? " · exam plan" : ""}` });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: task.done ? "Reopen" : "Done" }).addEventListener("click", async () => {
        await this.plugin.updateStudyTask(task.id, { done: !task.done });
        this.render();
      });
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeStudyTask(task.id);
        this.render();
      });
    }
  }

  /* ---- Selection annotations ------------------------------------------ */

  renderAnnotations(root) {
    const data = this.settings().annotations;
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Capture a selection" });
    add.createDiv({ cls: "qt-hint", text: "Keep a quote, a question and your answer together. The source note is never modified; Open source only navigates to it." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const sourcePath = this.renderField(form, "Source path", "text", "Biology/Cells.md");
    const quote = this.renderTextarea(form, "Quote", "Paste a passage or use the current selection", "", 4);
    const question = this.renderTextarea(form, "Your question", "Why does this happen?", "", 2);
    const answer = this.renderTextarea(form, "Your answer", "Write the answer in your own words", "", 3);
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Use current selection" }).addEventListener("click", () => {
      const active = this.plugin.app.workspace.activeEditor;
      const editor = active && active.editor;
      if (!editor || typeof editor.getSelection !== "function") {
        this.saveMessage("Open a Markdown note and select some text first.");
        this.render();
        return;
      }
      const picked = editor.getSelection();
      if (!picked.trim()) {
        this.saveMessage("Select some text in the active note first.");
        this.render();
        return;
      }
      quote.value = picked;
      if (active.file && active.file.path) sourcePath.value = active.file.path;
    });
    actions.createEl("button", { text: "Add annotation", cls: "mod-cta" }).addEventListener("click", async () => {
      const annotation = await this.plugin.addAnnotation({ sourcePath: sourcePath.value, quote: quote.value, question: question.value, answer: answer.value });
      if (!annotation) {
        this.saveMessage("Add a quote first.");
        this.render();
        return;
      }
      this.saveMessage("Annotation added.");
      this.render();
    });
    const search = root.createDiv({ cls: "qt-study-card" });
    search.createEl("h3", { text: "Annotation index" });
    const filter = search.createEl("input", { cls: "qt-input", type: "search" });
    filter.placeholder = "Search quotes, questions and sources";
    filter.value = this.annotationFilter;
    filter.addEventListener("input", () => {
      this.annotationFilter = filter.value.toLowerCase();
      this.render();
    });
    const entries = data.annotations
      .filter((entry) => !this.annotationFilter || `${entry.quote} ${entry.question} ${entry.answer} ${entry.sourcePath}`.toLowerCase().includes(this.annotationFilter))
      .sort((a, b) => b.createdAt - a.createdAt);
    if (!entries.length) {
      search.createDiv({ cls: "qt-study-empty", text: data.annotations.length ? "No annotation matches that search." : "No annotations yet. Select a passage and capture your question." });
      return;
    }
    const list = search.createDiv({ cls: "qt-study-list" });
    for (const entry of entries) {
      const row = list.createDiv({ cls: "qt-study-row qt-workspace-flow-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: entry.sourcePath || "Unlinked source" });
      main.createDiv({ cls: "qt-workspace-flow-quote", text: entry.quote });
      if (entry.question) main.createDiv({ cls: "qt-study-row-meta", text: `Q: ${entry.question}` });
      if (entry.answer) main.createDiv({ cls: "qt-study-row-meta", text: `A: ${entry.answer}` });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      if (entry.sourcePath) buttons.createEl("button", { text: "Open source" }).addEventListener("click", () => this.plugin.openStudyFlowSource(entry.sourcePath));
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeAnnotation(entry.id);
        this.render();
      });
    }
  }

  /* ---- Deep Notes ------------------------------------------------------ */

  renderDeepNotes(root) {
    const data = this.settings().deepNotes;
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Start a guided Socratic session" });
    add.createDiv({ cls: "qt-hint", text: "Five local prompts move from a claim to assumptions, evidence, a counterexample and synthesis. No model is called." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const topic = this.renderField(form, "Topic", "text", "Natural selection");
    const course = this.renderField(form, "Course", "text", "Biology");
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Start session", cls: "mod-cta" }).addEventListener("click", async () => {
      const session = await this.plugin.addDeepNotesSession({ topic: topic.value, course: course.value });
      if (!session) {
        this.saveMessage("Add a topic first.");
        this.render();
        return;
      }
      this.deepNotesId = session.id;
      this.saveMessage("Session started.");
      this.render();
    });
    const sessions = data.sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);
    if (!sessions.length) {
      this.renderTabsEmpty(root, "No Deep Notes sessions yet. Start with one idea you want to interrogate.");
      return;
    }
    if (!this.deepNotesId || !sessions.some((session) => session.id === this.deepNotesId)) {
      this.deepNotesId = (sessions.find((session) => !session.completed) || sessions[0]).id;
    }
    const active = sessions.find((session) => session.id === this.deepNotesId);
    if (active) this.renderDeepNotesActive(root, active);
    const listCard = root.createDiv({ cls: "qt-study-card" });
    listCard.createEl("h3", { text: "Saved sessions" });
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const session of sessions) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: session.topic });
      main.createDiv({ cls: "qt-study-row-meta", text: `${session.course ? `${session.course} · ` : ""}${session.completed ? "Complete" : `Step ${session.step + 1} of ${SOCRATIC_STEPS.length}`}` });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: session.id === this.deepNotesId ? "Open" : "Review" }).addEventListener("click", () => {
        this.deepNotesId = session.id;
        this.render();
      });
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeDeepNotesSession(session.id);
        if (this.deepNotesId === session.id) this.deepNotesId = "";
        this.render();
      });
    }
  }

  renderDeepNotesActive(root, session) {
    const card = root.createDiv({ cls: "qt-study-card qt-workspace-active" });
    const head = card.createDiv({ cls: "qt-workspace-head" });
    head.createEl("h3", { text: session.topic });
    head.createSpan({ cls: "qt-study-row-meta", text: session.completed ? "Complete" : `Step ${session.step + 1} of ${SOCRATIC_STEPS.length}` });
    if (session.completed) {
      card.createDiv({ cls: "qt-study-empty", text: "You reached synthesis. Review the answers below or start another session." });
      for (const step of SOCRATIC_STEPS) {
        if (!session.answers[step.key]) continue;
        card.createDiv({ cls: "qt-workspace-step-label", text: step.title });
        card.createDiv({ cls: "qt-study-row-meta", text: session.answers[step.key] });
      }
      return;
    }
    const step = Math.min(session.step, SOCRATIC_STEPS.length - 1);
    const current = SOCRATIC_STEPS[step];
    card.createDiv({ cls: "qt-workspace-step-label", text: `Step ${step + 1}: ${current.title}` });
    card.createDiv({ cls: "qt-hint", text: current.prompt });
    const textarea = card.createEl("textarea", { cls: "qt-study-bulk qt-workspace-answer" });
    textarea.rows = 7;
    textarea.value = session.answers[current.key] || "";
    textarea.placeholder = "Write your answer in your own words.";
    const controls = card.createDiv({ cls: "qt-row qt-study-actions" });
    if (step > 0) {
      controls.createEl("button", { text: "Back" }).addEventListener("click", async () => {
        await this.plugin.updateDeepNotesSession(session.id, { step: step - 1, answers: { ...session.answers, [current.key]: textarea.value } });
        this.render();
      });
    }
    controls.createEl("button", { text: step === SOCRATIC_STEPS.length - 1 ? "Finish session" : "Next prompt", cls: "mod-cta" }).addEventListener("click", async () => {
      if (!str(textarea.value).trim()) {
        this.saveMessage("Write an answer before moving on.");
        this.render();
        return;
      }
      const answers = { ...session.answers, [current.key]: textarea.value };
      if (step < SOCRATIC_STEPS.length - 1) {
        await this.plugin.updateDeepNotesSession(session.id, { step: step + 1, answers });
        this.saveMessage("Saved. Next prompt.");
      } else {
        await this.plugin.updateDeepNotesSession(session.id, { step: SOCRATIC_STEPS.length, completed: true, answers });
        this.saveMessage("Session complete.");
      }
      this.render();
    });
  }

  /* ---- Retention ------------------------------------------------------- */

  renderRetention(root) {
    const controls = root.createDiv({ cls: "qt-study-card" });
    controls.createEl("h3", { text: "Card retention forecast" });
    controls.createDiv({
      cls: "qt-hint",
      text: "Read-only: this scans the cards you already have and projects their next due dates. It never changes a card schedule or moves review data out of a note.",
    });
    const actions = controls.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Scan cards", cls: "mod-cta" }).addEventListener("click", () => {
      if (!this.plugin.cardsEnabled || !this.plugin.cardsEnabled()) {
        this.saveMessage("Turn on Cards to forecast card retention.");
        this.render();
        return;
      }
      this.retentionData = retentionForecast(this.plugin.getCards ? this.plugin.getCards() : [], { today: localDate(), days: 30 });
      this.saveMessage(`Scanned ${this.retentionData.total} card${this.retentionData.total === 1 ? "" : "s"}.`);
      this.render();
    });
    if (!this.retentionData) {
      this.renderTabsEmpty(root, "Scan the card module to see due work and a 30-day forecast.");
      return;
    }
    const stats = root.createDiv({ cls: "qt-study-stats" });
    const stat = (value, label) => {
      const card = stats.createDiv({ cls: "qt-study-stat" });
      card.createDiv({ cls: "qt-study-stat-value", text: String(value) });
      card.createDiv({ cls: "qt-study-stat-label", text: label });
    };
    stat(this.retentionData.total, "cards");
    stat(this.retentionData.due, "due now");
    stat(this.retentionData.fresh, "new");
    stat(this.retentionData.overdue, "overdue");
    const forecastCard = root.createDiv({ cls: "qt-study-card" });
    forecastCard.createEl("h3", { text: "Next 14 days" });
    const max = Math.max(1, ...this.retentionData.forecast.slice(0, 14).map((day) => day.count));
    const forecast = forecastCard.createDiv({ cls: "qt-study-list" });
    for (const day of this.retentionData.forecast.slice(0, 14)) {
      const row = forecast.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: day.date });
      const bar = main.createDiv({ cls: "qt-study-bar" });
      bar.createDiv({ cls: "qt-study-bar-fill" }).style.width = `${Math.round((day.count / max) * 100)}%`;
      row.createSpan({ cls: "qt-study-row-meta", text: `${day.count} due` });
    }
    const listCard = root.createDiv({ cls: "qt-study-card" });
    listCard.createEl("h3", { text: "Due and future cards" });
    if (!this.retentionData.rows.length) {
      listCard.createDiv({ cls: "qt-study-empty", text: "No cards are available in this vault yet." });
      return;
    }
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const card of this.retentionData.rows.slice(0, 20)) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: card.deck || "Unsorted" });
      main.createDiv({ cls: "qt-study-row-meta", text: `${card.course ? `${card.course} · ` : ""}${card.fresh ? "New" : card.due || "Scheduled"}${card.attempts ? ` · ${card.attempts} review${card.attempts === 1 ? "" : "s"}` : ""}` });
      if (card.path) row.createEl("button", { text: "Open" }).addEventListener("click", () => this.plugin.openStudyFlowSource(card.path));
    }
  }

  /* ---- Vocabulary ------------------------------------------------------ */

  renderVocabulary(root) {
    const data = this.settings().vocabulary;
    const summary = vocabSummary(data.words, localDate());
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Add a word" });
    add.createDiv({ cls: "qt-hint", text: "The dictionary is local. Review ratings move each word along a simple 1/3/7/21-day ladder; no note or card schedule is changed." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const term = this.renderField(form, "Term", "text", "osmosis");
    const definition = this.renderTextarea(form, "Definition", "Movement of water across a membrane", "", 2);
    const example = this.renderTextarea(form, "Example (optional)", "Water enters the cell.", "", 2);
    const language = this.renderField(form, "Language (optional)", "text", "Biology");
    const media = this.renderField(form, "Media (optional)", "text", "![[diagram.png]]");
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add word", cls: "mod-cta" }).addEventListener("click", async () => {
      const word = await this.plugin.addVocabWord({ term: term.value, definition: definition.value, example: example.value, language: language.value, media: media.value });
      if (!word) {
        this.saveMessage("Add a term first.");
        this.render();
        return;
      }
      this.saveMessage("Word added.");
      this.render();
    });
    const bulk = root.createDiv({ cls: "qt-study-card" });
    bulk.createEl("h3", { text: "Bulk import" });
    bulk.createDiv({ cls: "qt-hint", text: "One word per line: term | definition | optional example | optional media (a vault embed, link or file path)." });
    const bulkForm = bulk.createDiv({ cls: "qt-study-form" });
    const lines = this.renderTextarea(bulkForm, "Words", "ATP | energy currency | ATP powers the cell.", "", 5);
    const bulkActions = bulk.createDiv({ cls: "qt-row qt-study-actions" });
    bulkActions.createEl("button", { text: "Import words" }).addEventListener("click", async () => {
      const result = await this.plugin.importVocabWords(lines.value);
      this.saveMessage(result.count ? `Imported ${result.count} word${result.count === 1 ? "" : "s"}.${result.issues.length ? ` ${result.issues[0]}` : ""}` : "No valid lines. Use term | definition.");
      this.render();
    });
    const stats = root.createDiv({ cls: "qt-study-stats" });
    const stat = (value, label) => {
      const card = stats.createDiv({ cls: "qt-study-stat" });
      card.createDiv({ cls: "qt-study-stat-value", text: String(value) });
      card.createDiv({ cls: "qt-study-stat-label", text: label });
    };
    stat(summary.total, "words");
    stat(summary.due, "due");
    stat(summary.fresh, "new");
    stat(summary.learned, "reviewed");
    stat(summary.accuracy ? `${summary.accuracy}%` : "—", "accuracy");
    const listCard = root.createDiv({ cls: "qt-study-card" });
    listCard.createEl("h3", { text: "Dictionary" });
    const filter = listCard.createEl("input", { cls: "qt-input", type: "search" });
    filter.placeholder = "Search terms, definitions and examples";
    filter.value = this.vocabFilter;
    filter.addEventListener("input", () => {
      this.vocabFilter = filter.value.toLowerCase();
      this.render();
    });
    const words = data.words
      .filter((word) => !this.vocabFilter || `${word.term} ${word.definition} ${word.example} ${word.language} ${word.media}`.toLowerCase().includes(this.vocabFilter))
      .sort((a, b) => (!a.due ? "" : a.due).localeCompare(!b.due ? "" : b.due) || a.term.localeCompare(b.term));
    if (!words.length) {
      listCard.createDiv({ cls: "qt-study-empty", text: data.words.length ? "No word matches that search." : "No words yet. Add one or paste a list." });
      return;
    }
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const word of words) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: word.term });
      if (word.definition) main.createDiv({ cls: "qt-study-row-meta", text: word.definition });
      if (word.example) main.createDiv({ cls: "qt-study-row-meta", text: `Example: ${word.example}` });
      if (word.media) main.createDiv({ cls: "qt-study-row-meta", text: `Media: ${word.media}` });
      const statsText = word.reviews
        ? `${word.reviews} review${word.reviews === 1 ? "" : "s"} · ${word.correct || 0}/${word.reviews} correct · streak ${word.streak || 0}${word.lapses ? ` · ${word.lapses} lapse${word.lapses === 1 ? "" : "s"}` : ""} · due ${word.due || "now"}`
        : "New";
      main.createDiv({ cls: "qt-study-row-meta", text: `${word.language ? `${word.language} · ` : ""}${statsText}` });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      for (const [grade, label] of [["again", "Again"], ["good", "Good"], ["easy", "Easy"]]) {
        buttons.createEl("button", { text: label }).addEventListener("click", async () => {
          await this.plugin.reviewVocabWord(word.id, grade);
          this.saveMessage(`Rated ${word.term} ${label.toLowerCase()}.`);
          this.render();
        });
      }
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeVocabWord(word.id);
        this.render();
      });
    }
  }

  /* ---- Subject Manager ------------------------------------------------- */

  renderSubjects(root) {
    const data = this.settings().subjectManager;
    const lectures = this.plugin.studyToolsSettings ? this.plugin.studyToolsSettings().lectureLog.lectures : [];
    const summary = subjectSummary(data.subjects, data.absences, lectures);
    const filtered = summary.filter((subject) => !this.subjectFilter || `${subject.name} ${subject.folder} ${subject.notes} ${(subject.projects || []).map((project) => project.title).join(" ")}`.toLowerCase().includes(this.subjectFilter));
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
          text: `${subject.lectures} lecture${subject.lectures === 1 ? "" : "s"} · ${subject.absences} absence${subject.absences === 1 ? "" : "s"} · ${subject.openProjects} open project${subject.openProjects === 1 ? "" : "s"}${subject.attendance !== null ? ` · ${subject.attendance}% attendance` : ""}${subject.folder ? ` · ${subject.folder}` : ""}`,
        });
        if (subject.nextProject) main.createDiv({ cls: "qt-study-row-meta", text: `Next project: ${subject.nextProject.title} · due ${subject.nextProject.due}` });
        for (const project of (subject.projects || []).slice(0, 8)) {
          const projectRow = main.createDiv({ cls: "qt-study-project-row qt-study-row-meta" });
          projectRow.createSpan({ text: `${project.done ? "✓" : "○"} ${project.title}${project.due ? ` · due ${project.due}` : ""}` });
          projectRow.createEl("button", { text: project.done ? "Reopen" : "Done" }).addEventListener("click", async () => {
            await this.plugin.toggleStudyProject(subject.id, project.id);
            this.render();
          });
          projectRow.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
            await this.plugin.removeStudyProject(subject.id, project.id);
            this.render();
          });
        }
        const buttons = row.createDiv({ cls: "qt-study-row-actions" });
        buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
          await this.plugin.removeStudySubject(subject.id);
          this.render();
        });
      }
    }
    const projectCard = root.createDiv({ cls: "qt-study-card" });
    projectCard.createEl("h3", { text: "Add a project" });
    if (!data.subjects.length) {
      projectCard.createDiv({ cls: "qt-study-empty", text: "Add a subject before adding a project." });
    } else {
      projectCard.createDiv({ cls: "qt-hint", text: "Projects are local to the subject and never create notes. Mark one done when it is submitted." });
      const projectForm = projectCard.createDiv({ cls: "qt-study-form" });
      const projectSubject = this.renderSelect(
        projectForm,
        "Subject",
        data.subjects.map((subject) => ({ value: subject.name, label: subject.name })),
        data.subjects[0].name
      );
      const projectTitle = this.renderField(projectForm, "Project", "text", "Cell lab report");
      const projectDue = this.renderField(projectForm, "Due (optional)", "date", "", "");
      const projectActions = projectCard.createDiv({ cls: "qt-row qt-study-actions" });
      projectActions.createEl("button", { text: "Add project", cls: "mod-cta" }).addEventListener("click", async () => {
        const project = await this.plugin.addStudyProject({ subject: projectSubject.value, title: projectTitle.value, due: projectDue.value });
        if (!project) {
          this.saveMessage("Add a project title first.");
          this.render();
          return;
        }
        this.saveMessage("Project added.");
        this.render();
      });
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
