"use strict";
/*
 * The local workflow modules introduced by the MIT-parity pass. They share the
 * Study Tools visual language and the same responsive breakpoint, but each tab
 * is gated by its own Global -> Modules switch and owns its own data.
 */
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_STUDY_WORKSPACE } = require("./constants");
const { localDate, str } = require("./util");
const timeBlocks = require("./time-blocks");
const citations = require("./citations");
const pdfAnnotationIndex = require("./pdf-annotation-index");
const vaultTaskIndex = require("./vault-task-index");
const taskTags = require("./task-tags");
const glossary = require("./glossary");
const writingSessions = require("./writing-sessions");
const voiceMemo = require("./voice-memo");
const { CODE_BLOCK_MODES: READ_ALOUD_CODE, READ_ALOUD_STYLES, buildReadAloudPlan, durationLabel } = require("./read-aloud");
const { compileLectureNote } = require("./lecture-compiler");
const { courseHealthReport } = require("./course-health");
const courseIdentity = require("./course-identity");
const { bookmarkLink, bookmarkPaths, chaptersFor, formatTimestamp, parseTimestamp } = require("./audio-bookmarks");
const { STATUS_LABELS: READING_LABELS, bookProgress, librarySummary, shelfBooks } = require("./reading-library");
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
  { id: "timeBlocks", label: "Time blocks", module: "timeBlocks" },
  { id: "annotations", label: "Annotations", module: "annotations" },
  { id: "deepNotes", label: "Deep Notes", module: "deepNotes" },
  { id: "retention", label: "Retention", module: "retention" },
  { id: "vocabulary", label: "Vocabulary", module: "vocabulary" },
  { id: "readingLibrary", label: "Reading library", module: "readingLibrary" },
  { id: "citations", label: "Citations", module: "citations" },
  { id: "quizIndex", label: "Quiz index", module: "quizIndex" },
  { id: "health", label: "Course health", module: "courseHealth" },
  { id: "lectures", label: "Lecture notes", module: "lectureCompiler" },
  { id: "readAloud", label: "Read aloud", module: "readAloud" },
  { id: "bookmarks", label: "Bookmarks", module: "audioBookmarks" },
  { id: "feynmanAi", label: "AI feedback", module: "feynmanAi" },
  { id: "pdfAnnotations", label: "PDF annotations", module: "pdfAnnotationIndex" },
];

const SCORE_LABELS = { clarity: "Clarity", accuracy: "Accuracy", simplicity: "Simplicity" };

/* One composed first-run panel per section. The card above it owns the action;
   this panel explains what happens next instead of leaving a bare sentence at
   the bottom of a long form. */
const EMPTY_STATES = {
  feynman: {
    title: "Start with one concept",
    steps: ["Name a concept you can already explain roughly.", "Work through the four prompts without looking it up.", "Score the explanation and drill the weakest dimension."],
  },
  recall: {
    title: "Build your first recall queue",
    steps: ["Choose headings for structure or fragments for detail.", "Point the queue at a folder if you want a narrower scope.", "Review only the units that are due today."],
  },
  planner: {
    title: "Turn an exam date into a plan",
    steps: ["Set the exam date and keep a buffer before it.", "Add one topic per line and choose the number of passes.", "Tick off passes as you complete them; the day grid follows."],
  },
  flow: {
    title: "Capture a source while it is fresh",
    steps: ["Paste the passage and the source path.", "Explain it once in your own words.", "Draft a card or mark the excerpt understood."],
  },
  subjects: {
    title: "Add the courses you are tracking",
    steps: ["Give each subject a name and a folder.", "Pick a colour for course chips and dashboards.", "Add projects or absences from this tab later."],
  },
  courses: {
    title: "Build a course dashboard",
    steps: ["Add a subject or a first grade above.", "Weighted entries become the course average.", "Open a course overview for lectures, exams and readings."],
  },
  timeBlocks: {
    title: "Plan where the work happens",
    steps: ["Choose a day and add a block with a start and end time.", "Put small tasks inside the block; link an existing study task from the backlog.", "Use routines for repeating work and Project/domain lenses to see where the hours went."],
  },
  tasks: {
    title: "Keep the next study action visible",
    steps: ["Add a manual task, or generate passes from an exam date.", "The queue sorts open work by due date.", "Mark work done without touching any note."],
  },
  annotations: {
    title: "Keep the question with the quote",
    steps: ["Paste a passage or use the current editor selection.", "Write the question it raised and your answer.", "Search the index by quote, source or question later."],
  },
  deepNotes: {
    title: "Interrogate one idea",
    steps: ["Start with a claim you want to test.", "Move through five local Socratic prompts.", "Finish at synthesis; no model is called."],
  },
  retention: {
    title: "Forecast what is coming due",
    steps: ["Scan the cards already in this vault.", "See due, new and overdue work for the next 30 days.", "The scan is read-only and never moves a schedule."],
  },
  vocabulary: {
    title: "Start a local word bank",
    steps: ["Add a term, definition and optional example.", "Bulk import a list when you have one.", "Review each word on a simple 1/3/7/21-day ladder."],
  },
  citations: {
    title: "Build a local citation library",
    steps: ["Import a vault .bib file.", "Review the parsed authors, year, journal and DOI.", "Copy a reference or create a citation note; nothing leaves the vault."],
  },
  readingLibrary: {
    title: "Open your reading shelf",
    steps: ["Add a book to Want to read or Reading.", "Log page progress and keep the quotes that matter.", "Finished books move to their own shelf."],
  },
  quizIndex: {
    title: "Index the quizzes already in your vault",
    steps: ["Scan the whole vault or one folder.", "See quiz, question, result and attempt counts.", "Scanning is read-only; no attempts are created."],
  },
  health: {
    title: "See which course needs attention",
    steps: ["Add a subject, lecture or grade.", "Course health checks grades, attendance and overdue work.", "Open the reasons behind every Good, Watch or At-risk row."],
  },
  lectures: {
    title: "Turn the lecture log into a study note",
    steps: ["Add lectures with a course, title, date and topics.", "Preview one note with concepts and vocabulary.", "Save it with a numbered filename; nothing is overwritten."],
  },
  readAloud: {
    title: "Load a note and listen",
    steps: ["Load the active note or paste text.", "Choose Full note, a briefing or key points.", "Start reading; the current sentence stays highlighted."],
  },
  bookmarks: {
    title: "Mark the parts worth hearing again",
    steps: ["Point at an audio attachment in the vault.", "Add a timestamp and a short label.", "Copy a media link that opens at that moment."],
  },
  feynmanAi: {
    title: "Get a second opinion on an explanation",
    steps: ["Complete a Feynman cycle with at least one answer.", "Turn on AI under Settings and choose a provider.", "AI scores sit beside your own; they never replace them."],
  },
  pdfAnnotations: {
    title: "Index your PDF annotations",
    steps: ["Annotate a PDF so its sidecar exists in the vault.", "Scan the sidecars without creating or editing files.", "Open the PDF or sidecar from every row."],
  },
};

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
    this.recallMode = ""; // empty means: use the saved mode from the Recall Scheduler settings page
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
    this.readingFilter = "all";
    this.lecturePreview = null;
    this.readAloudText = "";
    this.readAloudPlan = null;
    this.readAloudIndex = -1;
    this.readAloudPlaying = false;
    this.bookmarkPath = "";
    this.bookmarkAt = "";
    this.bookmarkLabel = "";
    this.feynmanAiId = "";
    this.pdfAnnotationData = null;
    this.vaultTaskData = null;
    this.vaultTaskFilter = "";
    this.glossaryData = null;
    this.glossaryFilter = "";
    this.writingReport = null;
    this.timeBlockView = "day";
    this.timeBlockDate = localDate();
    this.timeBlockEditId = "";
    this.timeBlockDailyPreview = null;
    this.citationFilter = "";
    this.voiceMemoRecorder = null;
    this.voiceMemoChunks = [];
    this.voiceMemoStartedAt = 0;
    this.voiceMemoLabel = "";
  }

  async onClose() {
    this.stopReadAloud(false);
    if (this.voiceMemoRecorder) {
      try {
        this.voiceMemoRecorder.stop();
      } catch (e) {
        /* the recorder already stopped */
      }
      this.voiceMemoRecorder = null;
    }
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
    this.contentEl.removeClass("qt-study-tools");
    this.contentEl.addClass("qt-study-tools-view");
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
    const requested = TABS.some((entry) => entry.id === tab) ? tab : "feynman";
    const next = this.enabledTabs().some((entry) => entry.id === requested) ? requested : "feynman";
    /* Action feedback belongs to the section that produced it. Carrying
       "Scanned 1 card" into Vocabulary or a saved preview into Bookmarks makes
       those sections look like they just ran someone else's action. */
    if (next !== this.tab) this.message = "";
    this.tab = next;
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
    const wrap = root.createDiv({ cls: "qt-wrap qt-study-tools-wrap qt-study-workspace-wrap qt-screen" });
    if (!this.plugin.studyWorkspaceEnabled()) {
      this.renderOff(wrap);
      return;
    }
    const tabs = this.enabledTabs();
    if (!tabs.some((tab) => tab.id === this.tab)) this.tab = tabs[0] ? tabs[0].id : "feynman";
    const header = wrap.createDiv({ cls: "qt-study-header qt-screen-head" });
    const title = header.createDiv({ cls: "qt-study-heading" });
    title.createEl("h2", { text: "Study Workspace" });
    title.createDiv({ cls: "qt-hint", text: "Guided, local study workflows. Each tab has its own settings switch." });
    const picker = header.createDiv({ cls: "qt-workspace-picker" });
    picker.createSpan({ cls: "qt-workspace-picker-label", text: "Section" });
    const sectionPicker = picker.createEl("select", { cls: "dropdown", attr: { "aria-label": "Study Workspace section", "aria-controls": "qt-study-workspace-panel" } });
    for (const tab of tabs) sectionPicker.createEl("option", { value: tab.id, text: tab.label });
    sectionPicker.value = this.tab;
    sectionPicker.addEventListener("change", () => this.setTab(sectionPicker.value));
    const nav = wrap.createDiv({ cls: "qt-study-tabs qt-workspace-tabs", attr: { "aria-label": "Study Workspace sections" } });
    for (const tab of tabs) {
      const button = nav.createEl("button", { cls: "qt-study-tab", text: tab.label });
      if (tab.id === this.tab) button.addClass("is-active");
      button.setAttr("aria-pressed", tab.id === this.tab ? "true" : "false");
      button.addEventListener("click", () => this.setTab(tab.id));
    }
    if (this.message) wrap.createDiv({ cls: "qt-study-message", attr: { role: "status" }, text: this.message });
    const body = wrap.createDiv({ cls: "qt-workspace-body", attr: { id: "qt-study-workspace-panel", role: "region", "aria-label": `${TABS.find((tab) => tab.id === this.tab).label} section` } });
    if (this.tab === "feynman") this.renderFeynman(body);
    else if (this.tab === "recall") this.renderRecall(body);
    else if (this.tab === "planner") this.renderPlanner(body);
    else if (this.tab === "flow") this.renderFlow(body);
    else if (this.tab === "subjects") this.renderSubjects(body);
    else if (this.tab === "courses") this.renderCourses(body);
    else if (this.tab === "tasks") this.renderTasks(body);
    else if (this.tab === "timeBlocks") this.renderTimeBlocks(body);
    else if (this.tab === "annotations") this.renderAnnotations(body);
    else if (this.tab === "deepNotes") this.renderDeepNotes(body);
    else if (this.tab === "retention") this.renderRetention(body);
    else if (this.tab === "vocabulary") this.renderVocabulary(body);
    else if (this.tab === "readingLibrary") this.renderReadingLibrary(body);
    else if (this.tab === "citations") this.renderCitations(body);
    else if (this.tab === "quizIndex") this.renderQuizIndex(body);
    else if (this.tab === "health") this.renderCourseHealth(body);
    else if (this.tab === "lectures") this.renderLectureCompiler(body);
    else if (this.tab === "readAloud") this.renderReadAloud(body);
    else if (this.tab === "bookmarks") this.renderAudioBookmarks(body);
    else if (this.tab === "feynmanAi") this.renderFeynmanAi(body);
    else if (this.tab === "pdfAnnotations") this.renderPdfAnnotations(body);
  }

  renderOff(root) {
    const card = root.createDiv({ cls: "qt-onboard-card" });
    card.createEl("h3", { text: "Study Workspace is off" });
    card.createDiv({
      cls: "qt-onboard-text",
      text: "Feynman Learning, Recall Scheduler, the topic planner, Study Flow, Subject Manager, Courses, Tasks, Time blocks, the citation library, Annotations, Deep Notes, Retention, Vocabulary, the Quiz index, Course health, the lecture-note compiler, Read aloud, audio Bookmarks, Feynman AI feedback, the PDF annotation index and the Reading library each have their own switch under Settings, Global, Modules.",
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
    const state = EMPTY_STATES[this.tab] || {};
    const panel = root.createDiv({ cls: "qt-workspace-empty-panel", attr: { "data-empty-state": this.tab } });
    panel.createDiv({ cls: "qt-workspace-empty-kicker", text: "First run" });
    panel.createEl("h3", { text: state.title || "Start here" });
    panel.createDiv({ cls: "qt-workspace-empty-copy", text });
    const steps = Array.isArray(state.steps) ? state.steps : [];
    if (!steps.length) return;
    const list = panel.createEl("ol", { cls: "qt-workspace-empty-steps" });
    for (const step of steps) list.createEl("li", { text: step });
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
    ], this.recallMode || data.mode);
    const folder = this.renderField(form, "Folder (optional)", "text", "Biology", data.folder);
    const limit = this.renderField(form, "Limit", "number", "20", String(data.limit));
    if (stats.tracked || stats.due || stats.learned) {
      controls.createDiv({ cls: "qt-study-next-meta", text: `${stats.tracked} tracked · ${stats.due} due · ${stats.learned} reviewed` });
    }
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
    const hasPlans = data.plans.length > 0;
    const add = hasPlans
      ? root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure" })
      : root.createDiv({ cls: "qt-study-card" });
    if (hasPlans) add.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "New topic plan" });
    else add.createEl("h3", { text: "New topic plan" });
    add.createDiv({ cls: "qt-hint", text: "Plan repeated passes over a course's topics. Buffer days stay free before the exam." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const course = this.renderField(form, "Course", "text", "Biology");
    const exam = this.renderField(form, "Exam date", "date", "", "");
    const buffer = this.renderField(form, "Buffer days", "number", "2", "2");
    const target = this.renderField(form, "Passes per topic", "number", "3", "3");
    const topics = this.renderTextarea(form, "Topics (one per line)", "Cell structure\nRespiration\nPhotosynthesis", "", 4);
    const seed = add.createDiv({ cls: "qt-row qt-study-actions" });
    seed.createEl("button", { text: "Use exam topics" }).addEventListener("click", () => {
      const wantedCourse = str(course.value).trim();
      const found = this.plugin.getExams({ today: localDate(), horizonDays: 3650 }).find((entry) => {
        if (exam.value && entry.date !== exam.value) return false;
        if (!wantedCourse) return true;
        return courseIdentity.sameCourse(this.plugin.calendarSettings(), entry.course, wantedCourse);
      });
      if (!found || !Array.isArray(found.topics) || !found.topics.length) {
        this.saveMessage("No matching exam topics found. Add topics to the exam note or type them here.");
        return;
      }
      topics.value = found.topics.join("\n");
      if (!course.value.trim() && found.course) course.value = found.course;
      if (!exam.value && found.date) exam.value = found.date;
      this.saveMessage(`Loaded ${found.topics.length} topic${found.topics.length === 1 ? "" : "s"} from ${found.title || "the exam"}.`);
    });
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
    const topicTools = plan.topics.length
      ? card.createEl("details", { cls: "qt-workspace-disclosure qt-workspace-inline-disclosure" })
      : null;
    if (topicTools) topicTools.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Add a topic" });
    const addTopic = (topicTools || card).createDiv({ cls: "qt-study-form qt-workspace-inline-form" });
    const topicName = this.renderField(addTopic, "Add topic", "text", "Krebs cycle");
    const topicTarget = this.renderField(addTopic, "Target passes", "number", "3", String(plan.targetPasses));
    const topicActions = (topicTools || card).createDiv({ cls: "qt-row qt-study-actions" });
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
    const hasExcerpts = data.excerpts.length > 0;
    const add = hasExcerpts
      ? root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure" })
      : root.createDiv({ cls: "qt-study-card" });
    if (hasExcerpts) add.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Capture a source excerpt" });
    else add.createEl("h3", { text: "Capture a source excerpt" });
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
    if (!data.excerpts.length) {
      this.renderTabsEmpty(root, "No source excerpts yet. Capture the first passage above; it stays in this vault.");
      this.renderWritingSession(root);
      return;
    }
    const filterRow = root.createDiv({ cls: "qt-row qt-study-actions qt-workspace-filters" });
    filterRow.createDiv({ cls: "qt-study-next-meta", text: `${stats.inbox} inbox · ${stats.review} reviewing · ${stats.understood} understood · ${stats.withCards} card drafts` });
    for (const [value, label] of [["all", "All"], ["inbox", "Inbox"], ["review", "Reviewing"], ["understood", "Understood"]]) {
      const button = filterRow.createEl("button", { text: label, cls: "qt-workspace-filter" });
      if (value === this.flowFilter) button.addClass("is-active");
      button.setAttr("aria-pressed", value === this.flowFilter ? "true" : "false");
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
      listCard.createDiv({ cls: "qt-study-empty qt-workspace-filter-empty", text: "No excerpts match this filter. Choose All to see the rest." });
      this.renderWritingSession(root);
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
    this.renderWritingSession(root);
  }

  /** Read-only word count for the active note and one local session log. */
  renderWritingSession(root) {
    const card = root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure", attr: this.writingReport ? { open: "" } : {} });
    card.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Writing session (read-only)" });
    card.createDiv({
      cls: "qt-hint",
      text: "Counts the words, sentences and reading time of the active note, plus the words added since you started. The note is only read: nothing is written to it and no background index runs. Only the session times are stored locally.",
    });
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    const refresh = async () => {
      this.writingReport = await this.plugin.writingSessionReport();
      this.render();
    };
    actions.createEl("button", { text: "Count words" }).addEventListener("click", async () => {
      this.writingReport = await this.plugin.writingSessionReport();
      this.saveMessage(writingSessions.writingSummary(this.writingReport));
      this.render();
    });
    if (this.writingReport) {
      const report = this.writingReport;
      card.createDiv({
        cls: "qt-study-row-meta",
        text: report.running ? `Running · ${report.path || "active note"} · ${report.minutes} min` : "No session running.",
      });
      card.createDiv({ cls: "qt-study-row-meta", text: writingSessions.writingSummary(report) });
      if (report.running) {
        actions.createEl("button", { text: "Finish session", cls: "mod-cta" }).addEventListener("click", async () => {
          const result = await this.plugin.finishWritingSession();
          await refresh();
          this.saveMessage(result.ok && result.session ? writingSessions.sessionLine(result.session) : str(result.message));
          this.render();
        });
        actions.createEl("button", { text: "Cancel" }).addEventListener("click", async () => {
          await this.plugin.cancelWritingSession();
          await refresh();
          this.saveMessage("Writing session cancelled.");
          this.render();
        });
      } else {
        actions.createEl("button", { text: "Start session", cls: "mod-cta" }).addEventListener("click", async () => {
          const result = await this.plugin.startWritingSession();
          if (!result.ok) {
            this.saveMessage(str(result.message));
            this.render();
            return;
          }
          await refresh();
          this.saveMessage("Writing session started.");
          this.render();
        });
      }
      if (report.totals.count) {
        card.createDiv({
          cls: "qt-study-row-meta",
          text: `${report.totals.count} session${report.totals.count === 1 ? "" : "s"} · ${report.totals.minutes} min · +${report.totals.words} words`,
        });
        const list = card.createDiv({ cls: "qt-study-list" });
        for (const session of report.sessions.slice(-5).reverse()) {
          list.createDiv({ cls: "qt-study-row-meta", text: writingSessions.sessionLine(session) });
        }
      }
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
    const dashboard = courseDashboard(subjects, lectures, absences, data.grades, { settings: this.plugin.calendarSettings() });
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
      head.createEl("button", { text: "Overview", cls: "qt-link" }).addEventListener("click", () => this.plugin.openCourseOverview(entry.courseId || entry.name));
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
    const tagField = this.renderField(form, "Tags (optional)", "text", "#math, exam");
    const addActions = add.createDiv({ cls: "qt-row qt-study-actions" });
    addActions.createEl("button", { text: "Add task", cls: "mod-cta" }).addEventListener("click", async () => {
      const task = await this.plugin.addStudyTask({ title: title.value, course: course.value, due: due.value, tags: tagField.value });
      if (!task) {
        this.saveMessage("Add a task name first.");
        this.render();
        return;
      }
      this.saveMessage("Task added.");
      this.render();
    });

    const tagCard = root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure" });
    tagCard.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Rename a task tag" });
    tagCard.createDiv({ cls: "qt-hint", text: "Renames one tag on the local study tasks below. Notes, frontmatter and other plugins' tags are never read or changed." });
    const tagUsage = this.plugin.taskTagUsage();
    tagCard.createDiv({
      cls: "qt-study-row-meta",
      text: tagUsage.length
        ? "In use: " + tagUsage.slice(0, 12).map((row) => `#${row.tag} (${row.count})`).join(" · ")
        : "No tags yet. Add tags when you add a task, or with + tag in the sidebar task list.",
    });
    const tagForm = tagCard.createDiv({ cls: "qt-study-form" });
    const tagFrom = this.renderField(tagForm, "Tag to rename", "text", tagUsage.length ? `#${tagUsage[0].tag}` : "#math");
    const tagTo = this.renderField(tagForm, "New tag name", "text", "#maths");
    const tagActions = tagCard.createDiv({ cls: "qt-row qt-study-actions" });
    tagActions.createEl("button", { text: "Rename tag" }).addEventListener("click", async () => {
      const result = await this.plugin.renameStudyTaskTag(tagFrom.value, tagTo.value);
      this.saveMessage(taskTags.renameSummary(result));
      this.render();
    });

    const generate = root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure" });
    generate.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Generate exam tasks" });
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

    const vault = root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure", attr: this.vaultTaskData ? { open: "" } : {} });
    vault.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Vault checklist (read-only)" });
    vault.createDiv({ cls: "qt-hint", text: "Scan the Markdown notes in this vault for checkbox lines such as \"- [ ] read chapter 3\". The index only reads: no note is edited, reopened or rewritten, and another plugin's task syntax is not interpreted." });
    const vaultActions = vault.createDiv({ cls: "qt-row qt-study-actions" });
    vaultActions.createEl("button", { text: "Scan vault" }).addEventListener("click", async () => {
      try {
        this.vaultTaskData = await this.plugin.scanVaultTasks();
        this.saveMessage(`Found ${this.vaultTaskData.stats.rows} checkbox line(s) in ${this.vaultTaskData.stats.files} note(s).`);
      } catch (e) {
        this.saveMessage(String((e && e.message) || "Could not read the vault checkboxes."));
      }
      this.render();
    });
    const vaultData = this.vaultTaskData;
    if (vaultData) {
      vault.createDiv({ cls: "qt-study-row-meta", text: `${vaultData.stats.rows} checkbox line(s) · ${vaultData.stats.open} open · ${vaultData.stats.done} done · ${vaultData.stats.files} note(s)` });
      if (vaultData.truncated) vault.createDiv({ cls: "qt-study-row-meta", text: "Only the first matches are listed; narrow the filter to see the rest." });
      const vaultFilter = this.renderField(vault, "Vault filter", "text", "Text, tag or note path", this.vaultTaskFilter);
      vaultFilter.addEventListener("input", () => {
        this.vaultTaskFilter = vaultFilter.value;
        this.render();
      });
      const vaultTatch = vaultTaskIndex.filterVaultTasks(vaultData.rows, this.vaultTaskFilter);
      if (!vaultTatch.length) vault.createDiv({ cls: "qt-study-row-meta", text: "No vault checkbox matches this filter." });
      const vaultList = vault.createDiv({ cls: "qt-study-list" });
      for (const row of vaultTatch) {
        const item = vaultList.createDiv({ cls: "qt-study-row" });
        const main = item.createDiv({ cls: "qt-study-row-main" });
        main.createDiv({ cls: "qt-study-row-title", text: (row.done ? "☑ " : "☐ ") + row.text });
        main.createDiv({ cls: "qt-study-row-meta", text: `${row.path}:${row.line}${row.tags.length ? " · " + row.tags.map((tag) => "#" + tag).join(" ") : ""}` });
        const buttons = item.createDiv({ cls: "qt-row qt-study-row-actions" });
        buttons.createEl("button", { text: "Open note" }).addEventListener("click", () => this.app.workspace.openLinkText(row.path, "", false));
      }
    }

    if (!data.tasks.length) {
      this.renderTabsEmpty(root, "No tasks yet. Add one above or generate passes from an exam date; nothing is written to a note.");
      return;
    }
    const summaryCard = root.createDiv({ cls: "qt-study-card" });
    const summaryHead = summaryCard.createDiv({ cls: "qt-workspace-head" });
    summaryHead.createEl("h3", { text: "Task queue" });
    summaryHead.createSpan({ cls: "qt-study-row-meta", text: `${summary.open} open · ${summary.overdue} overdue · ${summary.dueToday} due today · ${summary.done} done` });
    const summaryActions = summaryCard.createDiv({ cls: "qt-row qt-study-actions" });
    summaryActions.createEl("button", { text: "Remind" }).addEventListener("click", async () => {
      await this.plugin.remindStudyTasks();
    });
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
    if (!data.annotations.length) {
      this.renderTabsEmpty(root, "No annotations yet. Capture a passage and the question it raised; the source note is never modified.");
      return;
    }
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
      search.createDiv({ cls: "qt-study-empty qt-workspace-filter-empty", text: "No annotation matches that search." });
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
      this.renderTabsEmpty(root, "Scan the card module to see due work and a 30-day forecast. The scan does not change a schedule.");
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
      if (typeof this.plugin.schedulerFitEnabled === "function" && this.plugin.schedulerFitEnabled()) this.renderSchedulerFit(root);
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
    if (typeof this.plugin.schedulerFitEnabled === "function" && this.plugin.schedulerFitEnabled()) this.renderSchedulerFit(root);
  }

  renderSchedulerFit(root) {
    const card = root.createDiv({ cls: "qt-study-card qt-scheduler-fit" });
    card.createEl("h3", { text: "Per-deck retention fit" });
    card.createDiv({
      cls: "qt-hint",
      text: "Fit request_retention from each deck's own review history in Settings → MCQ Tracker → Scheduler. FSRS weights stay fixed at the shipped defaults, and no target changes until you press Apply.",
    });
    card.createEl("button", { text: "Open Scheduler settings" }).addEventListener("click", () => this.plugin.openSettings());
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
    const hasWords = data.words.length > 0;
    if (!hasWords) this.renderTabsEmpty(root, "No words yet. Add one above, or open the bulk list when you have several ready.");
    const bulk = root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure" });
    bulk.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Bulk import a word list" });
    bulk.createDiv({ cls: "qt-hint", text: "One word per line: term | definition | optional example | optional media (a vault embed, link or file path)." });
    const bulkForm = bulk.createDiv({ cls: "qt-study-form" });
    const lines = this.renderTextarea(bulkForm, "Words", "ATP | energy currency | ATP powers the cell.", "", 5);
    const bulkActions = bulk.createDiv({ cls: "qt-row qt-study-actions" });
    bulkActions.createEl("button", { text: "Import words" }).addEventListener("click", async () => {
      const result = await this.plugin.importVocabWords(lines.value);
      this.saveMessage(result.count ? `Imported ${result.count} word${result.count === 1 ? "" : "s"}.${result.issues.length ? ` ${result.issues[0]}` : ""}` : "No valid lines. Use term | definition.");
      this.render();
    });
    if (!hasWords) {
      this.renderGlossary(root);
      return;
    }
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
      this.renderGlossary(root);
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
    this.renderGlossary(root);
  }

  /** Read-only glossary from the vault's own `Term: definition` lines. */
  renderGlossary(root) {
    const card = root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure", attr: this.glossaryData ? { open: "" } : {} });
    card.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Glossary from your notes (read-only)" });
    card.createDiv({
      cls: "qt-hint",
      text: "Reads \"Term: definition\" lines and two-column tables in this vault's Markdown notes. The index only reads: no note is edited or rewritten, and no word leaves your vault.",
    });
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Build glossary" }).addEventListener("click", async () => {
      try {
        this.glossaryData = await this.plugin.scanGlossary();
        this.saveMessage(
          this.glossaryData.stats.terms
            ? `Found ${this.glossaryData.stats.terms} term(s) in ${this.glossaryData.stats.files} note(s).`
            : "No \"Term: definition\" lines found in this vault."
        );
      } catch (e) {
        this.saveMessage(String((e && e.message) || "Could not read the vault glossary."));
      }
      this.render();
    });
    const data = this.glossaryData;
    if (!data) return;
    card.createDiv({
      cls: "qt-study-row-meta",
      text: `${data.stats.terms} term(s) · ${data.stats.files} note(s)${data.stats.vocabulary ? ` · ${data.stats.vocabulary} from the vocabulary list` : ""}${data.stats.duplicates ? ` · ${data.stats.duplicates} duplicate(s) kept out` : ""}${data.truncated ? " · first matches only" : ""}`,
    });
    const field = this.renderField(card, "Glossary lookup", "text", "Search a term", this.glossaryFilter);
    field.addEventListener("input", () => {
      this.glossaryFilter = field.value;
      this.render();
    });
    const rows = glossary.lookupGlossary(data.entries, this.glossaryFilter).slice(0, 40);
    if (!rows.length) {
      card.createDiv({ cls: "qt-study-row-meta", text: data.entries.length ? "No term matches that lookup." : "No definitions found yet." });
      return;
    }
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const row of rows) {
      const item = list.createDiv({ cls: "qt-study-row" });
      const main = item.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: row.term });
      main.createDiv({ cls: "qt-study-row-meta", text: row.definition });
      main.createDiv({ cls: "qt-study-row-meta", text: row.path ? `${row.path}:${row.line}` : "Vocabulary list" });
      const buttons = item.createDiv({ cls: "qt-row qt-study-row-actions" });
      if (row.path) buttons.createEl("button", { text: "Open note" }).addEventListener("click", () => this.app.workspace.openLinkText(row.path, "", false));
    }
  }

  /* ---- Subject Manager ------------------------------------------------- */

  renderSubjects(root) {
    const data = this.settings().subjectManager;
    const lectures = this.plugin.studyToolsSettings ? this.plugin.studyToolsSettings().lectureLog.lectures : [];
    const summary = subjectSummary(data.subjects, data.absences, lectures, { settings: this.plugin.calendarSettings() });
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
    if (!data.subjects.length) {
      this.renderTabsEmpty(root, "No subjects yet. Add the courses you are tracking; projects and absences become available afterwards.");
      return;
    }
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
      search.createDiv({ cls: "qt-study-empty qt-workspace-filter-empty", text: "No subject matches that search." });
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

  /* ---- Feynman AI feedback (optional second opinion) ------------------- */

  renderFeynmanAi(root) {
    const aiOn = !!(this.plugin.settings && this.plugin.settings.ai && this.plugin.settings.ai.enabled);
    const feynman = this.settings().feynmanLearning;
    const sessions = feynman.sessions.filter((session) => session.completed || ["explain", "gaps", "simplify", "teach"].some((key) => session.answers && session.answers[key]));
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Feynman AI feedback" });
    card.createDiv({ cls: "qt-hint", text: "An optional second opinion on a saved explanation. Your own 1-5 score stays unchanged; this adds separate AI scores and two sentences of feedback." });
    if (!sessions.length) {
      this.renderTabsEmpty(root, "No explanation has an answer yet. Complete a Feynman cycle first.");
      return;
    }
    if (!this.feynmanAiId || !sessions.some((session) => session.id === this.feynmanAiId)) this.feynmanAiId = sessions[0].id;
    const form = card.createDiv({ cls: "qt-study-form" });
    const select = this.renderSelect(
      form,
      "Explanation",
      sessions.map((session) => ({ value: session.id, label: `${session.topic}${session.course ? ` · ${session.course}` : ""}` })),
      this.feynmanAiId
    );
    select.addEventListener("change", () => {
      this.feynmanAiId = select.value;
      this.render();
    });
    const active = sessions.find((session) => session.id === this.feynmanAiId) || sessions[0];
    if (!aiOn) card.createDiv({ cls: "qt-study-row-meta", text: "AI features are off. Turn them on under Settings, MCQ Tracker, AI and choose a provider first." });
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    const scoreButton = actions.createEl("button", { text: "Score with AI", cls: "mod-cta" });
    if (!aiOn) scoreButton.disabled = true;
    scoreButton.addEventListener("click", async () => {
      try {
        const updated = await this.plugin.scoreFeynmanSessionAi(active.id);
        this.saveMessage(updated ? `Scored: clarity ${updated.aiScores.clarity}/5, accuracy ${updated.aiScores.accuracy}/5, simplicity ${updated.aiScores.simplicity}/5.` : "This explanation has no answers to score yet.");
      } catch (e) {
        this.saveMessage(String((e && e.message) || "The AI request failed."));
      }
      this.render();
    });
    if (active.aiScores) {
      const scores = active.aiScores;
      card.createDiv({ cls: "qt-study-row-meta", text: `AI average ${active.aiAverage || 0}/5 · clarity ${scores.clarity} · accuracy ${scores.accuracy} · simplicity ${scores.simplicity}` });
      if (active.aiFeedback) card.createDiv({ cls: "qt-study-next-meta", text: active.aiFeedback });
      actions.createEl("button", { text: "Clear AI feedback", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.clearFeynmanAiFeedback(active.id);
        this.saveMessage("AI feedback cleared; your manual scores are kept.");
        this.render();
      });
    } else {
      card.createDiv({ cls: "qt-study-row-meta", text: "No AI feedback stored for this explanation yet." });
    }
  }

  /* ---- Time blocks ----------------------------------------------------- */

  timeBlockProjectOptions(data) {
    return [
      { value: "", label: "No project or domain" },
      ...data.projects.map((project) => ({ value: project.id, label: project.kind === "domain" ? "Domain · " + project.name : project.name })),
    ];
  }

  timeBlockProjectName(data, id) {
    const project = data.projects.find((entry) => entry.id === id);
    if (!project) return "";
    return project.kind === "domain" ? "Domain · " + project.name : project.name;
  }

  timeBlockCalendar() {
    if (typeof this.plugin.calendarSettings !== "function" || typeof this.plugin.calendarEvents !== "function") {
      return { enabled: false, events: [], settings: null };
    }
    let settings = null;
    try {
      settings = this.plugin.calendarSettings();
    } catch (e) {
      return { enabled: false, events: [], settings: null };
    }
    if (!settings || settings.enabled !== true) return { enabled: false, events: [], settings };
    try {
      return { enabled: true, events: this.plugin.calendarEvents() || [], settings };
    } catch (e) {
      return { enabled: true, events: [], settings };
    }
  }

  renderTimeBlockCalendar(root, data, date, calendar) {
    if (!calendar || !calendar.enabled || data.showCalendar === false) return;
    const summary = timeBlocks.calendarDaySummary(calendar.events, date, data.blocks);
    const card = root.createDiv({ cls: "qt-study-card qt-time-blocks-calendar" });
    card.createEl("h3", { text: "Calendar" });
    card.createDiv({ cls: "qt-hint", text: "Read-only classes and events from the current calendar. A block that shares their time is marked here; calendar entries are never edited, moved or copied." });
    card.createDiv({
      cls: "qt-study-row-meta",
      text: summary.events + " event" + (summary.events === 1 ? "" : "s") + " · " + timeBlocks.durationLabel(summary.busyMinutes) + " booked" + (summary.conflicts ? " · " + summary.conflicts + " block" + (summary.conflicts === 1 ? "" : "s") + " overlap" : ""),
    });
    if (!summary.rows.length) {
      card.createDiv({ cls: "qt-hint", text: "No calendar events on this day. The planner stays usable with the calendar module off." });
      return;
    }
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const event of summary.rows) {
      const row = list.createDiv({ cls: "qt-study-row qt-time-block-calendar-event" + (event.overlaps.length ? " is-conflict" : "") });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      const title = main.createDiv({ cls: "qt-study-row-title", text: event.title });
      const meta = [event.allDay ? "All day" : event.start + (event.end ? " – " + event.end : ""), event.location, event.course].filter(Boolean).join(" · ");
      if (meta) title.createSpan({ cls: "qt-study-row-meta", text: " " + meta });
      if (event.overlaps.length) {
        main.createDiv({ cls: "qt-time-block-calendar-conflict", text: "Overlaps: " + event.overlaps.map((block) => block.start + " " + block.title).join(", ") });
      }
    }
  }

  timeBlockDateControls(root) {
    const controls = root.createDiv({ cls: "qt-row qt-time-blocks-date" });
    controls.createEl("button", { text: "Previous day", attr: { "aria-label": "Previous day" } }).addEventListener("click", () => {
      this.timeBlockDate = timeBlocks.addDays(this.timeBlockDate, -1);
      this.render();
    });
    const date = controls.createEl("input", { cls: "qt-input", type: "date", attr: { "aria-label": "Time-block day" } });
    date.value = this.timeBlockDate;
    date.addEventListener("change", () => {
      this.timeBlockDate = timeBlocks.dayValue(date.value) || localDate();
      this.render();
    });
    controls.createEl("button", { text: "Today" }).addEventListener("click", () => {
      this.timeBlockDate = localDate();
      this.render();
    });
    controls.createEl("button", { text: "Next day", attr: { "aria-label": "Next day" } }).addEventListener("click", () => {
      this.timeBlockDate = timeBlocks.addDays(this.timeBlockDate, 1);
      this.render();
    });
    controls.createSpan({ cls: "qt-study-row-meta", text: this.timeBlockDate });
    return controls;
  }

  renderTimeBlocks(root) {
    const data = this.settings().timeBlocks;
    const labels = [
      ["day", "Day"],
      ["week", "Week"],
      ["grid", "Grid"],
      ["backlog", "Backlog"],
      ["routines", "Routines"],
      ["projects", "Projects & domains"],
      ["timeline", "Timeline"],
    ];
    const nav = root.createDiv({ cls: "qt-time-blocks-nav", attr: { "aria-label": "Time-block views" } });
    for (const [id, label] of labels) {
      const button = nav.createEl("button", { text: label, cls: "qt-time-blocks-nav-button" });
      if (this.timeBlockView === id) button.addClass("is-active");
      button.setAttr("aria-pressed", this.timeBlockView === id ? "true" : "false");
      button.addEventListener("click", () => {
        this.timeBlockView = id;
        this.timeBlockEditId = "";
        this.render();
      });
    }
    if (!timeBlocks.TIME_BLOCK_VIEWS.includes(this.timeBlockView)) this.timeBlockView = "day";
    if (!timeBlocks.dayValue(this.timeBlockDate)) this.timeBlockDate = localDate();
    const summary = timeBlocks.blockSummary(data.blocks, this.timeBlockDate);
    root.createDiv({
      cls: "qt-study-row-meta",
      text: summary.blocks + " block" + (summary.blocks === 1 ? "" : "s") + " · " + timeBlocks.durationLabel(summary.minutes) + " planned · " + summary.open + " open task" + (summary.open === 1 ? "" : "s") + " on this day",
    });
    if (this.timeBlockView === "day") this.renderTimeBlockDay(root, data);
    else if (this.timeBlockView === "week") this.renderTimeBlockWeek(root, data);
    else if (this.timeBlockView === "grid") this.renderTimeBlockGrid(root, data);
    else if (this.timeBlockView === "backlog") this.renderTimeBlockBacklog(root, data);
    else if (this.timeBlockView === "routines") this.renderTimeBlockRoutines(root, data);
    else if (this.timeBlockView === "projects") this.renderTimeBlockProjects(root, data);
    else if (this.timeBlockView === "timeline") this.renderTimeBlockTimeline(root, data);
  }

  renderTimeBlockDay(root, data) {
    const dayControls = root.createDiv({ cls: "qt-study-card" });
    const head = dayControls.createDiv({ cls: "qt-workspace-head" });
    head.createEl("h3", { text: "Day plan" });
    this.timeBlockDateControls(head);
    dayControls.createDiv({ cls: "qt-hint", text: "Blocks own the time; tasks live inside them. Add an existing study task from the Backlog, or write a small task directly here." });
    this.renderTimeBlockCalendar(root, data, this.timeBlockDate, this.timeBlockCalendar());
    const write = dayControls.createDiv({ cls: "qt-row qt-study-actions" });
    write.createEl("button", { text: "Write day note" }).addEventListener("click", async () => {
      try {
        const path = await this.plugin.writeTimeBlockDay(this.timeBlockDate);
        this.saveMessage("Saved " + path + ".");
      } catch (e) {
        this.saveMessage(String((e && e.message) || "Could not write the day note."));
      }
      this.render();
    });
    write.createEl("button", { text: "Preview daily note" }).addEventListener("click", async () => {
      this.timeBlockDailyPreview = await this.plugin.previewTimeBlockDayNote(this.timeBlockDate);
      this.saveMessage(this.timeBlockDailyPreview.ok ? "Daily-note lines previewed." : this.timeBlockDailyPreview.message);
      this.render();
    });
    if (this.timeBlockDailyPreview && this.timeBlockDailyPreview.date === this.timeBlockDate) this.renderTimeBlockDailyNote(root);
    const projectOptions = this.timeBlockProjectOptions(data);
    const add = root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure" });
    add.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Add a time block" });
    const form = add.createDiv({ cls: "qt-study-form" });
    const title = this.renderField(form, "Block", "text", "Deep work: cell respiration");
    const start = this.renderField(form, "Start", "time", "", data.dayStart);
    const end = this.renderField(form, "End", "time", "", "10:30");
    const type = this.renderSelect(form, "Type", timeBlocks.TIME_BLOCK_TYPES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })), "study");
    const project = this.renderSelect(form, "Project or domain", projectOptions, "");
    const course = this.renderField(form, "Course (optional)", "text", "Biology");
    const notes = this.renderTextarea(form, "Notes (optional)", "What is this block for?", "", 2);
    const actions = add.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add block", cls: "mod-cta" }).addEventListener("click", async () => {
      const block = await this.plugin.addTimeBlock({
        date: this.timeBlockDate,
        start: start.value,
        end: end.value,
        title: title.value,
        type: type.value,
        projectId: project.value,
        course: course.value,
        notes: notes.value,
      });
      if (!block) {
        this.saveMessage("Add a name and a valid end time after the start.");
        this.render();
        return;
      }
      this.saveMessage("Block added.");
      this.render();
    });
    const blocks = timeBlocks.blocksForDate(data.blocks, this.timeBlockDate);
    if (!blocks.length) {
      this.renderTabsEmpty(root, "No blocks on this day. Add one above, then put the work inside it.");
      return;
    }
    const list = root.createDiv({ cls: "qt-study-list qt-time-blocks-day-list" });
    for (const block of blocks) this.renderTimeBlockCard(list, block, data);
  }

  renderTimeBlockDailyNote(root) {
    const preview = this.timeBlockDailyPreview;
    const card = root.createDiv({ cls: "qt-study-card qt-time-blocks-daily" });
    card.createEl("h3", { text: "Daily-note preview" });
    if (!preview.ok) {
      card.createDiv({ cls: "qt-hint", text: preview.message + " The planner never writes to the daily note." });
      return;
    }
    card.createDiv({ cls: "qt-hint", text: "Read-only preview of " + preview.path + ". Nothing is changed until you add the blocks; the daily note itself is never written." });
    card.createDiv({
      cls: "qt-study-row-meta",
      text: preview.rows.length + " line" + (preview.rows.length === 1 ? "" : "s") + " · " + preview.newRows.length + " new · " + preview.duplicates + " already planned",
    });
    if (!preview.rows.length) {
      card.createDiv({ cls: "qt-hint", text: "No HH:MM lines found. Add a line such as 09:00 Cell biology, or 09:00 - 10:30 Problem set." });
      return;
    }
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const row of preview.rows) {
      const item = list.createDiv({ cls: "qt-study-row qt-time-block-daily-row" + (row.duplicate ? " is-duplicate" : "") });
      const main = item.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: row.start + " – " + row.end + " · " + row.title });
      if (row.duplicate) main.createDiv({ cls: "qt-study-row-meta", text: "Already planned; it will be skipped." });
    }
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: preview.newRows.length ? "Add " + preview.newRows.length + " block" + (preview.newRows.length === 1 ? "" : "s") : "Nothing new to add", cls: "mod-cta" }).addEventListener("click", async () => {
      if (!preview.newRows.length) return;
      const result = await this.plugin.importTimeBlockDayNote(preview.date);
      this.timeBlockDailyPreview = null;
      this.saveMessage(result.added ? "Added " + result.added + " block" + (result.added === 1 ? "" : "s") + " from " + result.path + "." : "Nothing new to add.");
      this.render();
    });
    actions.createEl("button", { text: "Open daily note" }).addEventListener("click", () => {
      this.app.workspace.openLinkText(preview.path, "", false);
    });
  }

  renderTimeBlockCard(list, block, data) {
    const card = list.createDiv({ cls: "qt-time-block qt-study-card" });
    if (block.type) card.addClass("is-" + block.type);
    const head = card.createDiv({ cls: "qt-workspace-head" });
    const main = head.createDiv({ cls: "qt-time-block-main" });
    main.createDiv({ cls: "qt-time-block-time", text: block.start + " – " + block.end + " · " + timeBlocks.durationLabel(timeBlocks.durationMinutes(block)) });
    main.createDiv({ cls: "qt-time-block-title", text: block.title });
    const meta = [block.type, this.timeBlockProjectName(data, block.projectId), block.course].filter(Boolean).join(" · ");
    if (meta) main.createDiv({ cls: "qt-study-row-meta", text: meta });
    const actions = head.createDiv({ cls: "qt-row qt-study-row-actions" });
    if (block.type === "review" || block.type === "practice") {
      actions.createEl("button", { text: block.type === "review" ? "Start cards" : "Start practice", cls: "mod-cta" }).addEventListener("click", () => {
        if (block.type === "review" && typeof this.plugin.openStudySkin === "function") this.plugin.openStudySkin();
        else if (block.type === "practice" && typeof this.plugin.activateQuickPractice === "function") this.plugin.activateQuickPractice();
      });
    }
    actions.createEl("button", { text: this.timeBlockEditId === block.id ? "Cancel edit" : "Edit" }).addEventListener("click", () => {
      this.timeBlockEditId = this.timeBlockEditId === block.id ? "" : block.id;
      this.render();
    });
    actions.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
      await this.plugin.removeTimeBlock(block.id);
      this.saveMessage("Block removed.");
      this.render();
    });

    if (this.timeBlockEditId === block.id) {
      const form = card.createDiv({ cls: "qt-study-form qt-time-block-edit" });
      const title = this.renderField(form, "Block", "text", "", block.title);
      const start = this.renderField(form, "Start", "time", "", block.start);
      const end = this.renderField(form, "End", "time", "", block.end);
      const type = this.renderSelect(form, "Type", timeBlocks.TIME_BLOCK_TYPES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })), block.type);
      const project = this.renderSelect(form, "Project or domain", this.timeBlockProjectOptions(data), block.projectId);
      const course = this.renderField(form, "Course (optional)", "text", "", block.course);
      const notes = this.renderTextarea(form, "Notes (optional)", "", block.notes, 2);
      form.createEl("button", { text: "Save block", cls: "mod-cta" }).addEventListener("click", async () => {
        const updated = await this.plugin.updateTimeBlock(block.id, {
          title: title.value,
          start: start.value,
          end: end.value,
          type: type.value,
          projectId: project.value,
          course: course.value,
          notes: notes.value,
        });
        if (!updated) {
          this.saveMessage("Keep a name and an end time after the start.");
          this.render();
          return;
        }
        this.timeBlockEditId = "";
        this.saveMessage("Block saved.");
        this.render();
      });
    } else if (block.notes) {
      card.createDiv({ cls: "qt-time-block-notes", text: block.notes });
    }

    const tasks = card.createDiv({ cls: "qt-time-block-tasks" });
    for (const task of block.tasks) {
      const row = tasks.createDiv({ cls: "qt-time-block-task" });
      const check = row.createEl("input", { type: "checkbox", attr: { "aria-label": "Done: " + task.title } });
      check.checked = task.done;
      check.addEventListener("change", async () => {
        await this.plugin.toggleTimeBlockTask(block.id, task.id, check.checked);
        this.render();
      });
      const label = row.createDiv({ cls: "qt-time-block-task-title" + (task.done ? " is-done" : ""), text: task.title });
      if (task.studyTaskId) label.createSpan({ cls: "qt-study-row-meta", text: " linked task" });
      row.createEl("button", { text: "Remove", cls: "qt-link qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeTimeBlockTask(block.id, task.id);
        this.render();
      });
    }
    const addTask = card.createDiv({ cls: "qt-row qt-time-block-task-add" });
    const input = addTask.createEl("input", { cls: "qt-input", type: "text", attr: { placeholder: "Add a task inside this block" } });
    addTask.createEl("button", { text: "Add task" }).addEventListener("click", async () => {
      if (!str(input.value).trim()) {
        this.saveMessage("Name the task first.");
        this.render();
        return;
      }
      await this.plugin.addTimeBlockTask(block.id, { title: input.value });
      this.render();
    });
  }

  renderTimeBlockWeek(root, data) {
    const week = timeBlocks.weekSummary(data.blocks, this.timeBlockDate, data.weekStartsOn);
    const calendar = this.timeBlockCalendar();
    const calWeek = calendar.enabled && data.showCalendar !== false
      ? timeBlocks.calendarWeekSummary(calendar.events, this.timeBlockDate, data.weekStartsOn, data.blocks)
      : null;
    const card = root.createDiv({ cls: "qt-study-card" });
    const head = card.createDiv({ cls: "qt-workspace-head" });
    head.createEl("h3", { text: "Week" });
    this.timeBlockDateControls(head);
    card.createDiv({ cls: "qt-study-row-meta", text: week.blocks + " blocks · " + timeBlocks.durationLabel(week.minutes) + " planned · " + week.open + " open tasks" });
    const grid = card.createDiv({ cls: "qt-time-blocks-week" });
    for (const day of week.days) {
      const calDay = calWeek ? calWeek.days.find((entry) => entry.date === day.date) : null;
      const conflictBlockIds = new Set(calDay ? calDay.rows.flatMap((event) => event.overlaps.map((block) => block.id)) : []);
      const column = grid.createDiv({ cls: "qt-time-blocks-week-day" + (day.date === this.timeBlockDate ? " is-selected" : "") });
      const title = column.createDiv({ cls: "qt-time-blocks-week-title" });
      title.createSpan({ text: timeBlocks.WEEKDAY_NAMES[timeBlocks.weekdayOf(day.date)] + " " + day.date.slice(5) });
      title.createSpan({ cls: "qt-study-row-meta", text: timeBlocks.durationLabel(day.minutes) });
      if (calDay && calDay.events) {
        column.createDiv({ cls: "qt-time-blocks-week-calendar", text: calDay.events + " calendar · " + timeBlocks.durationLabel(calDay.busyMinutes) });
        for (const event of calDay.rows) {
          column.createDiv({
            cls: "qt-time-blocks-week-event" + (event.overlaps.length ? " is-conflict" : ""),
            text: (event.allDay ? "All day · " : event.start + " · ") + event.title,
          });
        }
      }
      const blocks = timeBlocks.blocksForDate(data.blocks, day.date);
      if (!blocks.length) column.createDiv({ cls: "qt-hint", text: "No blocks" });
      for (const block of blocks) {
        const row = column.createDiv({ cls: "qt-time-blocks-week-block" + (conflictBlockIds.has(block.id) ? " is-conflict" : "") });
        row.createDiv({ cls: "qt-time-blocks-week-block-time", text: block.start + "–" + block.end });
        row.createDiv({ cls: "qt-time-blocks-week-block-title", text: block.title });
        if (block.projectId) row.createDiv({ cls: "qt-study-row-meta", text: this.timeBlockProjectName(data, block.projectId) });
        row.addEventListener("click", () => {
          this.timeBlockDate = day.date;
          this.timeBlockView = "day";
          this.render();
        });
      }
      column.createEl("button", { text: "Open day", cls: "qt-link" }).addEventListener("click", () => {
        this.timeBlockDate = day.date;
        this.timeBlockView = "day";
        this.render();
      });
    }
  }

  renderTimeBlockGrid(root, data) {
    const week = timeBlocks.weekSummary(data.blocks, this.timeBlockDate, data.weekStartsOn);
    const dates = week.days.map((day) => day.date);
    const timeline = timeBlocks.projectTimeline(data.blocks, data.projects, 7, dates[6]);
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Grid" });
    card.createDiv({ cls: "qt-hint", text: "One row per project or domain, one column per day. Minutes come from the blocks; click a cell to open that day." });
    if (!timeline.rows.length) {
      this.renderTabsEmpty(root, "No projects or time blocks yet. Add a project or a block first.");
      return;
    }
    const table = card.createDiv({ cls: "qt-time-blocks-grid" });
    const header = table.createDiv({ cls: "qt-time-blocks-grid-row is-header" });
    header.createDiv({ cls: "qt-time-blocks-grid-label", text: "Project" });
    for (const date of dates) header.createDiv({ cls: "qt-time-blocks-grid-cell", text: timeBlocks.WEEKDAY_NAMES[timeBlocks.weekdayOf(date)] + " " + date.slice(5) });
    for (const row of timeline.rows) {
      const line = table.createDiv({ cls: "qt-time-blocks-grid-row" });
      const label = line.createDiv({ cls: "qt-time-blocks-grid-label" });
      const dot = label.createSpan({ cls: "qt-workspace-subject-dot" });
      dot.style.background = row.color;
      label.createSpan({ text: row.name });
      for (const date of dates) {
        const minutes = row.byDay[date] || 0;
        const cell = line.createEl("button", { cls: "qt-time-blocks-grid-cell" + (minutes ? " has-work" : ""), text: minutes ? timeBlocks.durationLabel(minutes) : "—" });
        cell.setAttr("aria-label", row.name + " on " + date);
        cell.addEventListener("click", () => {
          this.timeBlockDate = date;
          this.timeBlockView = "day";
          this.render();
        });
      }
    }
  }

  renderTimeBlockBacklog(root, data) {
    const studyTasks = this.settings().studyTasks.tasks;
    const tasks = timeBlocks.unscheduledStudyTasks(studyTasks, data.blocks, this.timeBlockDate);
    const add = root.createDiv({ cls: "qt-study-card" });
    add.createEl("h3", { text: "Backlog" });
    add.createDiv({ cls: "qt-hint", text: "Intentions that have not been placed yet. Existing open study tasks are included; scheduling one puts it in a block without creating a second task." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const intention = this.renderField(form, "New intention", "text", "Review the chapter 4 summary");
    const project = this.renderSelect(form, "Project or domain", this.timeBlockProjectOptions(data), "");
    const course = this.renderField(form, "Course (optional)", "text", "");
    const resurface = this.renderField(form, "Resurface on (optional)", "date", "");
    const addActions = add.createDiv({ cls: "qt-row qt-study-actions" });
    addActions.createEl("button", { text: "Add to backlog", cls: "mod-cta" }).addEventListener("click", async () => {
      const item = await this.plugin.addTimeBlockBacklog({ title: intention.value, projectId: project.value, course: course.value, resurface: resurface.value });
      if (!item) {
        this.saveMessage("Name the intention first.");
        this.render();
        return;
      }
      this.saveMessage("Backlog intention added.");
      this.render();
    });
    const schedule = root.createDiv({ cls: "qt-study-card" });
    schedule.createEl("h3", { text: "Place work" });
    schedule.createDiv({ cls: "qt-hint", text: "Choose where a backlog item should land, then schedule it." });
    const scheduleForm = schedule.createDiv({ cls: "qt-study-form" });
    const date = this.renderField(scheduleForm, "Date", "date", "", this.timeBlockDate);
    const start = this.renderField(scheduleForm, "Start", "time", "", data.dayStart);
    const end = this.renderField(scheduleForm, "End", "time", "", "10:30");
    const scheduleProject = this.renderSelect(scheduleForm, "Project or domain", this.timeBlockProjectOptions(data), "");
    const scheduleValues = () => ({ date: date.value, start: start.value, end: end.value, projectId: scheduleProject.value });
    if (!tasks.length && !data.backlog.length) {
      this.renderTabsEmpty(root, "The backlog is clear. Add an intention above or leave it empty until something new appears.");
      return;
    }
    const list = schedule.createDiv({ cls: "qt-study-list" });
    for (const task of tasks) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: task.title });
      main.createDiv({ cls: "qt-study-row-meta", text: (task.course ? task.course + " · " : "") + (task.due ? "due " + task.due : "no due date") + (task.overdue ? " · overdue" : "") });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Schedule", cls: "mod-cta" }).addEventListener("click", async () => {
        const block = await this.plugin.scheduleStudyTask(task.id, scheduleValues());
        this.saveMessage(block ? "Scheduled " + task.title + "." : "Use an end time after the start.");
        this.render();
      });
    }
    for (const item of data.backlog) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: item.title });
      main.createDiv({ cls: "qt-study-row-meta", text: (item.projectId ? this.timeBlockProjectName(data, item.projectId) + " · " : "") + (item.resurface ? "resurface " + item.resurface : "unscheduled") });
      const buttons = row.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Schedule", cls: "mod-cta" }).addEventListener("click", async () => {
        const block = await this.plugin.scheduleTimeBlockBacklog(item.id, scheduleValues());
        this.saveMessage(block ? "Scheduled " + item.title + "." : "Use an end time after the start.");
        this.render();
      });
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeTimeBlockBacklog(item.id);
        this.render();
      });
    }
  }

  renderTimeBlockRoutines(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Routines" });
    card.createDiv({ cls: "qt-hint", text: "Repeating blocks are offers, not automatic writes. Add the missing routines to " + this.timeBlockDate + " when you want them." });
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add this day's routines", cls: "mod-cta" }).addEventListener("click", async () => {
      const created = await this.plugin.applyTimeBlockRoutines(this.timeBlockDate);
      this.saveMessage(created.length ? "Added " + created.length + " routine block" + (created.length === 1 ? "" : "s") + "." : "This day already has every matching routine.");
      this.render();
    });
    const form = card.createDiv({ cls: "qt-study-form" });
    const title = this.renderField(form, "Routine", "text", "Morning review");
    const start = this.renderField(form, "Start", "time", "", data.dayStart);
    const end = this.renderField(form, "End", "time", "", "10:30");
    const type = this.renderSelect(form, "Type", timeBlocks.TIME_BLOCK_TYPES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })), "study");
    const project = this.renderSelect(form, "Project or domain", this.timeBlockProjectOptions(data), "");
    const daysWrap = form.createDiv({ cls: "qt-time-block-days" });
    const boxes = {};
    for (let index = 0; index < 7; index++) {
      const label = daysWrap.createEl("label", { cls: "qt-time-block-day" });
      const box = label.createEl("input", { type: "checkbox", attr: { "aria-label": "Routine on " + timeBlocks.WEEKDAY_NAMES[index] } });
      box.checked = index === timeBlocks.weekdayOf(this.timeBlockDate);
      boxes[index] = box;
      label.createSpan({ text: timeBlocks.WEEKDAY_NAMES[index] });
    }
    const add = card.createDiv({ cls: "qt-row qt-study-actions" });
    add.createEl("button", { text: "Add routine" }).addEventListener("click", async () => {
      const days = Object.entries(boxes).filter(([, box]) => box.checked).map(([index]) => Number(index));
      const routine = await this.plugin.addTimeBlockRoutine({ title: title.value, start: start.value, end: end.value, type: type.value, projectId: project.value, days });
      if (!routine) {
        this.saveMessage("Add a name, a valid time range and at least one day.");
        this.render();
        return;
      }
      this.saveMessage("Routine added.");
      this.render();
    });
    if (!data.routines.length) {
      this.renderTabsEmpty(root, "No routines yet. Add one above; it stays an offer until you place it on a day.");
      return;
    }
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const routine of data.routines) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: routine.title });
      main.createDiv({ cls: "qt-study-row-meta", text: routine.start + "–" + routine.end + " · " + routine.days.map((day) => timeBlocks.WEEKDAY_NAMES[day]).join(", ") });
      row.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeTimeBlockRoutine(routine.id);
        this.render();
      });
    }
  }

  renderTimeBlockProjects(root, data) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Projects & domains" });
    card.createDiv({ cls: "qt-hint", text: "Projects group related work; domains are broader life areas. Both are optional lenses over the same blocks." });
    const form = card.createDiv({ cls: "qt-study-form" });
    const name = this.renderField(form, "Name", "text", "Biology");
    const kind = this.renderSelect(form, "Kind", [{ value: "project", label: "Project" }, { value: "domain", label: "Domain" }], "project");
    const color = this.renderField(form, "Colour (optional)", "text", "#6f8ff5");
    const course = this.renderField(form, "Course (optional)", "text", "Biology");
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add project or domain", cls: "mod-cta" }).addEventListener("click", async () => {
      const project = await this.plugin.addTimeBlockProject({ name: name.value, kind: kind.value, color: color.value, course: course.value });
      if (!project) {
        this.saveMessage("Name the project or domain first.");
        this.render();
        return;
      }
      this.saveMessage("Project added.");
      this.render();
    });
    if (!data.projects.length) {
      this.renderTabsEmpty(root, "No projects or domains yet. Add one above to group blocks and see where the hours went.");
      return;
    }
    const totals = {};
    for (const block of data.blocks) totals[block.projectId || ""] = (totals[block.projectId || ""] || 0) + timeBlocks.durationMinutes(block);
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const project of data.projects) {
      const row = list.createDiv({ cls: "qt-study-row" });
      const main = row.createDiv({ cls: "qt-study-row-main" });
      const heading = main.createDiv({ cls: "qt-study-row-title" });
      const dot = heading.createSpan({ cls: "qt-workspace-subject-dot" });
      dot.style.background = project.color;
      heading.createSpan({ text: project.name });
      main.createDiv({ cls: "qt-study-row-meta", text: project.kind + (project.course ? " · " + project.course : "") + " · " + timeBlocks.durationLabel(totals[project.id] || 0) + " planned" });
      row.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeTimeBlockProject(project.id);
        this.render();
      });
    }
  }

  renderTimeBlockTimeline(root, data) {
    const timeline = timeBlocks.projectTimeline(data.blocks, data.projects, 14, this.timeBlockDate);
    const totals = timeBlocks.normalizeTimeline(data.blocks);
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Timeline" });
    card.createDiv({ cls: "qt-hint", text: "The last 14 days of block time, grouped by project or domain. It is history, not a second calendar." });
    card.createDiv({ cls: "qt-study-row-meta", text: totals.blocks + " blocks · " + timeBlocks.durationLabel(totals.totalMinutes) + " total · " + totals.tasks + " tasks" });
    if (!timeline.rows.length) {
      this.renderTabsEmpty(root, "No project time yet. Add a block and a project to build the timeline.");
      return;
    }
    const max = Math.max(1, ...timeline.rows.map((row) => row.minutes));
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const row of timeline.rows) {
      const item = list.createDiv({ cls: "qt-study-row" });
      const main = item.createDiv({ cls: "qt-study-row-main" });
      const heading = main.createDiv({ cls: "qt-study-row-title" });
      const dot = heading.createSpan({ cls: "qt-workspace-subject-dot" });
      dot.style.background = row.color;
      heading.createSpan({ text: row.name });
      const bar = main.createDiv({ cls: "qt-study-bar" });
      bar.createDiv({ cls: "qt-study-bar-fill" }).style.width = Math.round((row.minutes / max) * 100) + "%";
      main.createDiv({ cls: "qt-study-row-meta", text: row.kind + " · " + timeBlocks.durationLabel(row.minutes) });
    }
  }

  /* ---- PDF annotation index (read-only) -------------------------------- */

  renderPdfAnnotations(root) {
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "PDF annotations" });
    card.createDiv({ cls: "qt-hint", text: "Read-only index of the .annotations.md sidecars already in the vault. Nothing is created or edited. Each row can copy a [[file.pdf#page=N]] deep link or open the PDF at that page." });
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Scan annotations", cls: "mod-cta" }).addEventListener("click", async () => {
      try {
        this.pdfAnnotationData = await this.plugin.getPdfAnnotationIndex();
        this.saveMessage(`Found ${this.pdfAnnotationData.stats.annotations} annotation(s) in ${this.pdfAnnotationData.stats.files} sidecar file(s).`);
      } catch (e) {
        this.saveMessage(String((e && e.message) || "Could not read the annotation sidecars."));
      }
      this.render();
    });
    const data = this.pdfAnnotationData;
    if (!data) {
      this.renderTabsEmpty(root, "Scan to list the PDF annotations already in this vault.");
      return;
    }
    const stats = data.stats;
    card.createDiv({ cls: "qt-study-row-meta", text: `${stats.annotations} annotations · ${stats.pdfs} PDFs · ${stats.files} sidecars · ${stats.pages} annotated pages` });
    const typeText = Object.entries(stats.byType).map(([type, count]) => `${type} ${count}`).join(" · ");
    if (typeText) card.createDiv({ cls: "qt-study-row-meta", text: typeText });
    for (const issue of data.issues.slice(0, 5)) card.createDiv({ cls: "qt-study-row-meta", text: `Warning: ${issue}` });
    if (!data.rows.length) {
      this.renderTabsEmpty(root, "No sidecar annotations found. Annotate a PDF first.");
      return;
    }
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const row of data.rows) {
      const item = list.createDiv({ cls: "qt-study-row" });
      const main = item.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: `${row.pdfPath} · page ${row.page}` });
      main.createDiv({ cls: "qt-study-row-meta", text: `${row.type} · ${row.color}: ${row.summary}` });
      const buttons = item.createDiv({ cls: "qt-study-row-actions" });
      buttons.createEl("button", { text: "Open PDF" }).addEventListener("click", () => this.app.workspace.openLinkText(row.pdfPath, "", false));
      buttons.createEl("button", { text: "Open sidecar" }).addEventListener("click", () => this.app.workspace.openLinkText(row.sidecarPath, "", false));
      const pageLink = pdfAnnotationIndex.pdfPageLink(row.pdfPath, row.page);
      if (pageLink) {
        const subpath = pdfAnnotationIndex.pdfPageSubpath(row.pdfPath, row.page);
        buttons.createEl("button", { text: "Open at page " + row.page }).addEventListener("click", () => this.app.workspace.openLinkText(subpath, "", false));
        buttons.createEl("button", { text: "Copy page link" }).addEventListener("click", async () => {
          try {
            if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("Clipboard unavailable");
            await navigator.clipboard.writeText(pageLink);
            this.saveMessage("Copied " + pageLink + ".");
          } catch (e) {
            this.saveMessage("Could not copy " + pageLink + " in this view.");
          }
          this.render();
        });
      }
    }
  }

  /* ---- Citations (local BibTeX library) ------------------------------- */

  renderCitations(root) {
    const data = this.settings().citations;
    const stats = citations.citationStats(data.entries);
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Citations" });
    card.createDiv({ cls: "qt-hint", text: "Import a .bib file from this vault, keep the parsed entries locally, copy a formatted reference or create a citation note. No reference-manager login, network request or automatic note write is involved." });
    const form = card.createDiv({ cls: "qt-study-form" });
    const path = this.renderField(form, "BibTeX file", "text", "References/library.bib");
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Import .bib", cls: "mod-cta" }).addEventListener("click", async () => {
      const result = await this.plugin.importCitationFile(path.value);
      this.saveMessage(result.ok ? "Imported " + result.added + " citation(s); skipped " + result.skipped + " duplicate(s)." : result.message);
      this.render();
    });
    card.createDiv({ cls: "qt-study-row-meta", text: stats.total + " citation(s) · " + stats.withDoi + " with DOI · saved notes go to " + data.folder });
    if (!data.entries.length) {
      this.renderTabsEmpty(root, "No citations yet. Import a .bib file above; parsing and storage stay local.");
      return;
    }
    const filter = this.renderField(card, "Filter", "text", "Author, title, journal or key", this.citationFilter);
    filter.addEventListener("input", () => {
      this.citationFilter = filter.value;
      this.render();
    });
    const needle = str(this.citationFilter).trim().toLowerCase();
    const rows = data.entries.filter((entry) => {
      if (!needle) return true;
      return [entry.key, entry.title, entry.authors.join(" "), entry.year, entry.journal, entry.doi].join(" ").toLowerCase().includes(needle);
    });
    if (!rows.length) {
      this.renderTabsEmpty(root, "No citations match this filter.");
      return;
    }
    const list = root.createDiv({ cls: "qt-study-list" });
    for (const entry of rows) {
      const item = list.createDiv({ cls: "qt-study-row" });
      const main = item.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: entry.title });
      main.createDiv({ cls: "qt-study-row-meta", text: citations.citationLabel(entry) + (entry.journal ? " · " + entry.journal : "") + (entry.doi ? " · DOI " + entry.doi : "") });
      main.createDiv({ cls: "qt-study-row-meta", text: entry.key + " · " + entry.type + (entry.url ? " · " + entry.url : "") });
      const buttons = item.createDiv({ cls: "qt-row qt-study-row-actions" });
      buttons.createEl("button", { text: "Copy citation" }).addEventListener("click", async () => {
        const text = citations.citationText(entry);
        try {
          if (typeof navigator === "undefined" || !navigator.clipboard) throw new Error("Clipboard unavailable");
          await navigator.clipboard.writeText(text);
          this.saveMessage("Citation copied.");
        } catch (e) {
          this.saveMessage("Could not copy the citation in this view.");
        }
        this.render();
      });
      buttons.createEl("button", { text: "Create note", cls: "mod-cta" }).addEventListener("click", async () => {
        const result = await this.plugin.createCitationNote(entry.id);
        this.saveMessage(result.ok ? "Saved " + result.path + "." : result.message);
        this.render();
      });
      buttons.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
        await this.plugin.removeCitation(entry.id);
        this.saveMessage("Citation removed.");
        this.render();
      });
    }
  }

  /* ---- Reading library (Verso library, shelves and quotes) ------------ */

  renderReadingLibrary(root) {
    const data = this.settings().readingLibrary;
    const summary = librarySummary(data.books, localDate());
    const hasBooks = data.books.length > 0;
    if (hasBooks) {
      const stats = root.createDiv({ cls: "qt-study-stats" });
      const stat = (value, label) => {
        const card = stats.createDiv({ cls: "qt-study-stat" });
        card.createDiv({ cls: "qt-study-stat-value", text: String(value) });
        card.createDiv({ cls: "qt-study-stat-label", text: label });
      };
      stat(summary.reading, "reading");
      stat(summary.finished, "finished");
      stat(summary.pagesRead, "pages read");
      stat(summary.quotes, "quotes");
      if (summary.finishedToday) {
        const done = root.createDiv({ cls: "qt-study-card qt-reading-celebration" });
        done.createEl("h3", { text: "Finished today" });
        done.createDiv({ cls: "qt-hint", text: `${summary.finishedToday} book${summary.finishedToday === 1 ? "" : "s"} finished today. Add a quote while it is fresh.` });
      }
    }

    const add = hasBooks
      ? root.createEl("details", { cls: "qt-study-card qt-workspace-disclosure" })
      : root.createDiv({ cls: "qt-study-card" });
    if (hasBooks) add.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Add another book" });
    else add.createEl("h3", { text: "Add a book" });
    add.createDiv({ cls: "qt-hint", text: "A local bookshelf with want, reading and finished shelves, page progress and quotes. Nothing leaves the vault." });
    const form = add.createDiv({ cls: "qt-study-form" });
    const title = this.renderField(form, "Title", "text", "Deep Work");
    const author = this.renderField(form, "Author (optional)", "text", "Cal Newport");
    const bookCourse = this.renderField(form, "Course (optional)", "text", "Econ 101");
    const bookDue = this.renderField(form, "Due (optional)", "date", "");
    const pages = this.renderField(form, "Pages (optional)", "number", "300");
    const status = this.renderSelect(form, "Shelf", [
      { value: "want", label: "Want to read" },
      { value: "reading", label: "Reading" },
      { value: "finished", label: "Finished" },
    ], "want");
    const addActions = add.createDiv({ cls: "qt-row qt-study-actions" });
    addActions.createEl("button", { text: "Add book", cls: "mod-cta" }).addEventListener("click", async () => {
      const book = await this.plugin.addReadingBook({ title: title.value, author: author.value, course: bookCourse.value, due: bookDue.value, totalPages: pages.value, status: status.value });
      if (!book) {
        this.saveMessage("Add a title first, and avoid adding the same book twice.");
        this.render();
        return;
      }
      this.saveMessage(`Added ${book.title}.`);
      this.render();
    });

    if (!hasBooks) {
      this.renderTabsEmpty(root, "No books on the shelf yet. Add one above; page progress, shelves and quotes stay local.");
      return;
    }
    const controls = root.createDiv({ cls: "qt-study-card" });
    controls.createEl("h3", { text: "Bookshelf" });
    controls.createDiv({ cls: "qt-hint", text: data.hideFinished ? "Finished books are hidden from the All shelf. Choose Finished to see them." : "Use a shelf to narrow the list; page progress and ratings stay local." });
    const filter = this.renderSelect(controls, "Show", [
      { value: "all", label: "All books" },
      { value: "reading", label: "Reading" },
      { value: "want", label: "Want to read" },
      { value: "finished", label: "Finished" },
    ], this.readingFilter || "all");
    filter.addEventListener("change", () => {
      this.readingFilter = filter.value;
      this.render();
    });
    const books = shelfBooks(data.books, this.readingFilter || "all", data.hideFinished);
    if (!books.length) {
      this.renderTabsEmpty(root, "No books on this shelf yet. Add one above, or switch shelves.");
      return;
    }
    const list = root.createDiv({ cls: "qt-study-list" });
    for (const book of books) this.renderReadingBook(list, book);
  }

  renderReadingBook(list, book) {
    const item = list.createDiv({ cls: "qt-study-row qt-reading-book" });
    const main = item.createDiv({ cls: "qt-study-row-main" });
    main.createDiv({ cls: "qt-study-row-title", text: `${book.title}${book.author ? ` · ${book.author}` : ""}` });
    const progress = bookProgress(book);
    const links = [book.course ? `Course: ${book.course}` : "", book.due ? `Due ${book.due}` : ""].filter(Boolean).join(" · ");
    main.createDiv({ cls: "qt-study-row-meta", text: `${READING_LABELS[book.status]} · ${progress.known ? `${book.currentPage}/${book.totalPages} pages (${progress.percent}%)` : `${book.currentPage} pages`}${book.rating ? ` · ${book.rating}/5` : ""}${links ? ` · ${links}` : ""}` });
    if (progress.known) {
      const bar = main.createDiv({ cls: "qt-study-bar" });
      bar.createDiv({ cls: "qt-study-bar-fill" }).style.width = `${progress.percent}%`;
    }
    const actions = item.createDiv({ cls: "qt-row qt-study-row-actions" });
    if (book.status !== "reading") {
      actions.createEl("button", { text: "Start" }).addEventListener("click", async () => {
        await this.plugin.updateReadingBook(book.id, { status: "reading" });
        this.render();
      });
    }
    if (book.status !== "finished") {
      actions.createEl("button", { text: "Finish", cls: "mod-cta" }).addEventListener("click", async () => {
        await this.plugin.updateReadingBook(book.id, { status: "finished" });
        this.render();
      });
    } else {
      actions.createEl("button", { text: "Reopen" }).addEventListener("click", async () => {
        await this.plugin.updateReadingBook(book.id, { status: "reading" });
        this.render();
      });
    }
    if (book.status !== "want") {
      actions.createEl("button", { text: "Want" }).addEventListener("click", async () => {
        await this.plugin.updateReadingBook(book.id, { status: "want" });
        this.render();
      });
    }
    actions.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
      await this.plugin.removeReadingBook(book.id);
      this.saveMessage(`Removed ${book.title}.`);
      this.render();
    });

    const tools = item.createEl("details", { cls: "qt-reading-tools qt-workspace-disclosure" });
    tools.createEl("summary", { cls: "qt-workspace-disclosure-title", text: "Update progress and quotes" });
    const progressForm = tools.createDiv({ cls: "qt-study-form" });
    const page = this.renderField(progressForm, "Current page", "number", "0", String(book.currentPage));
    progressForm.createEl("button", { text: "Save page" }).addEventListener("click", async () => {
      const updated = await this.plugin.setReadingProgress(book.id, page.value);
      this.saveMessage(updated ? `Saved page ${updated.currentPage}.` : "That book is gone.");
      this.render();
    });
    const rating = this.renderSelect(progressForm, "Rating", [
      { value: "0", label: "No rating" },
      { value: "1", label: "1 / 5" },
      { value: "2", label: "2 / 5" },
      { value: "3", label: "3 / 5" },
      { value: "4", label: "4 / 5" },
      { value: "5", label: "5 / 5" },
    ], String(book.rating));
    rating.addEventListener("change", async () => {
      await this.plugin.updateReadingBook(book.id, { rating: rating.value });
      this.render();
    });

    const quoteForm = tools.createDiv({ cls: "qt-study-form" });
    const quoteText = this.renderTextarea(quoteForm, "Quote", "A sentence worth keeping", "", 2);
    const quotePage = this.renderField(quoteForm, "Quote page (optional)", "number", "0", "");
    quoteForm.createEl("button", { text: "Add quote" }).addEventListener("click", async () => {
      const quote = await this.plugin.addReadingQuote(book.id, { text: quoteText.value, page: quotePage.value });
      this.saveMessage(quote ? "Quote saved." : "Write a quote first.");
      this.render();
    });
    if (book.quotes.length) {
      const quotes = item.createDiv({ cls: "qt-study-list" });
      for (const quote of book.quotes) {
        const row = quotes.createDiv({ cls: "qt-study-row" });
        const quoteMain = row.createDiv({ cls: "qt-study-row-main" });
        quoteMain.createDiv({ cls: "qt-study-row-title", text: `“${quote.text}”` });
        quoteMain.createDiv({ cls: "qt-study-row-meta", text: `${quote.page ? `page ${quote.page} · ` : ""}${quote.addedOn || ""}` });
        row.createEl("button", { text: "Remove" }).addEventListener("click", async () => {
          await this.plugin.removeReadingQuote(book.id, quote.id);
          this.render();
        });
      }
    }
  }

  /* ---- Course health (Course Command Center-style local checks) -------- */

  renderCourseHealth(root) {
    const data = this.settings();
    const dashboard = courseDashboard(
      data.subjectManager.subjects,
      this.plugin.studyToolsSettings ? this.plugin.studyToolsSettings().lectureLog.lectures : [],
      data.subjectManager.absences,
      data.courseHub.grades,
      { settings: this.plugin.calendarSettings() }
    );
    const report = courseHealthReport({
      courses: dashboard,
      plans: data.lerntracker.plans,
      tasks: data.studyTasks.tasks,
      exams: this.plugin.getExams ? this.plugin.getExams({ includePast: true }) : [],
      settings: this.plugin.calendarSettings ? this.plugin.calendarSettings() : undefined,
      today: localDate(),
      ...data.courseHealth,
    });
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Course health" });
    card.createDiv({ cls: "qt-hint", text: "Local checks over the course dashboard, topic planner and tasks. No Canvas request, login or note write is made." });
    if (!report.rows.length) {
      this.renderTabsEmpty(root, "Add a subject, a lecture or a grade to build the course list. Every check below is local.");
      return;
    }
    card.createDiv({ cls: "qt-study-row-meta", text: `${report.total} courses · ${report.good} good · ${report.watch} to watch · ${report.atRisk} at risk · ${report.warnings} warning${report.warnings === 1 ? "" : "s"}` });
    const list = card.createDiv({ cls: "qt-study-list" });
    for (const row of report.rows) {
      const item = list.createDiv({ cls: "qt-study-row" });
      const main = item.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: `${row.name} · ${row.status === "at-risk" ? "At risk" : row.status === "watch" ? "Watch" : "Good"}` });
      main.createDiv({ cls: "qt-study-row-meta", text: `${row.lectures} lecture${row.lectures === 1 ? "" : "s"} · ${row.absences} absence${row.absences === 1 ? "" : "s"}${row.attendance !== null ? ` · ${row.attendance}% attendance` : ""}` });
      for (const check of row.checks) {
        main.createDiv({ cls: "qt-study-row-meta", text: `${check.level === "warn" ? "⚠" : "·"} ${check.text}` });
      }
    }
  }

  /* ---- Lecture note compiler (Lecture Transcriber-style, no audio) ----- */

  renderLectureCompiler(root) {
    const data = this.settings().lectureCompiler;
    const lectures = this.plugin.studyToolsSettings ? this.plugin.studyToolsSettings().lectureLog.lectures : [];
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Compile one study note" });
    card.createDiv({ cls: "qt-hint", text: "Turns the local lecture log into one note with an overview, key concepts, a vocabulary table and one section per lecture. Audio transcription stays out of scope." });
    if (!lectures.length) {
      this.renderTabsEmpty(root, "The lecture log is empty. Add a lecture in Study Tools first; the compiler only reads that local log.");
      return;
    }
    card.createDiv({ cls: "qt-study-row-meta", text: `${lectures.length} lecture${lectures.length === 1 ? "" : "s"} in the log · saves to ${data.folder}` });
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Preview", cls: "mod-cta" }).addEventListener("click", () => {
      const compiled = compileLectureNote(lectures, data);
      if (!compiled) {
        this.lecturePreview = null;
        this.saveMessage("Add lectures with a course, title, date and topics first.");
        this.render();
        return;
      }
      this.lecturePreview = compiled;
      this.saveMessage("Preview built. Save it when it looks right.");
      this.render();
    });
    if (this.lecturePreview) {
      actions.createEl("button", { text: "Save study note" }).addEventListener("click", async () => {
        const path = await this.plugin.saveCompiledLectureNote(this.lecturePreview);
        this.saveMessage(path ? `Saved ${path}.` : "Could not save the study note.");
        this.render();
      });
      const stats = this.lecturePreview.stats;
      card.createDiv({ cls: "qt-study-row-meta", text: `${stats.lectures} lectures · ${stats.concepts} concepts · ${stats.vocabulary} vocabulary rows · ${stats.from} to ${stats.to}` });
      const preview = card.createEl("pre", { cls: "qt-lecture-preview" });
      preview.setText(this.lecturePreview.markdown);
    }
  }

  /* ---- Read aloud (device speech synthesis) ---------------------------- */

  speech() {
    try {
      return typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis : null;
    } catch (e) {
      return null;
    }
  }

  stopReadAloud(redraw) {
    const synth = this.speech();
    if (synth) {
      try {
        synth.cancel();
      } catch (e) {
        /* the device can refuse to cancel after the view closes */
      }
    }
    this.readAloudPlaying = false;
    this.readAloudIndex = -1;
    if (redraw !== false) this.render();
  }

  highlightSentence(index) {
    const nodes = this.contentEl.querySelectorAll(".qt-read-aloud-sentence");
    nodes.forEach((node, position) => {
      if (position === index) node.addClass("is-speaking");
      else node.removeClass("is-speaking");
    });
  }

  speakSentence(index) {
    const plan = this.readAloudPlan;
    const synth = this.speech();
    if (!plan || !synth || !this.readAloudPlaying) return;
    if (index >= plan.sentences.length) {
      this.readAloudPlaying = false;
      this.readAloudIndex = -1;
      this.saveMessage("Finished reading.");
      this.render();
      return;
    }
    const settings = this.settings().readAloud;
    const Utterance = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
    if (!Utterance) {
      this.saveMessage("This device has no speech synthesis available.");
      this.readAloudPlaying = false;
      this.render();
      return;
    }
    const utterance = new Utterance(plan.sentences[index]);
    utterance.rate = plan.rate;
    utterance.pitch = settings.pitch;
    if (settings.voice && typeof synth.getVoices === "function") {
      const match = synth.getVoices().find((voice) => String(voice.name).toLowerCase() === settings.voice.toLowerCase());
      if (match) utterance.voice = match;
    }
    utterance.onstart = () => this.highlightSentence(index);
    utterance.onend = () => {
      if (!this.readAloudPlaying) return;
      this.readAloudIndex = index + 1;
      this.speakSentence(index + 1);
    };
    this.readAloudIndex = index;
    try {
      synth.speak(utterance);
    } catch (e) {
      this.saveMessage("The device refused to speak this sentence.");
      this.readAloudPlaying = false;
      this.render();
    }
  }

  voiceMemoMedia() {
    const media = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
    if (!media || typeof media.getUserMedia !== "function") return null;
    if (typeof MediaRecorder !== "function") return null;
    return media;
  }

  async startVoiceMemo() {
    const media = this.voiceMemoMedia();
    if (!media) {
      this.saveMessage("Recording is not available on this device.");
      this.render();
      return;
    }
    try {
      const stream = await media.getUserMedia({ audio: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event && event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        try {
          if (typeof stream.getTracks === "function") stream.getTracks().forEach((track) => track.stop());
        } catch (e) {
          /* the stream is already closed */
        }
        const seconds = Math.max(1, Math.round((Date.now() - this.voiceMemoStartedAt) / 1000));
        this.voiceMemoRecorder = null;
        this.voiceMemoChunks = [];
        this.voiceMemoStartedAt = 0;
        if (!chunks.length) {
          this.saveMessage("Nothing was recorded.");
          this.render();
          return;
        }
        let data = null;
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          data = typeof blob.arrayBuffer === "function" ? await blob.arrayBuffer() : null;
        } catch (e) {
          data = null;
        }
        if (!data) {
          this.saveMessage("This device could not hand over the recording.");
          this.render();
          return;
        }
        const result = await this.plugin.saveVoiceMemo({ data, mimeType: recorder.mimeType || "audio/webm", durationSeconds: seconds, label: this.voiceMemoLabel });
        this.saveMessage(result.ok ? "Saved " + result.path + (result.notePath ? " and added a line to " + result.notePath : "") + "." : result.message);
        this.render();
      };
      recorder.start();
      this.voiceMemoRecorder = recorder;
      this.voiceMemoChunks = chunks;
      this.voiceMemoStartedAt = Date.now();
      this.saveMessage("Recording. Press Stop and save when you are done.");
    } catch (e) {
      this.saveMessage(String((e && e.message) || "Could not start recording."));
    }
    this.render();
  }

  stopVoiceMemo() {
    const recorder = this.voiceMemoRecorder;
    if (!recorder) {
      this.saveMessage("No recording is running.");
      this.render();
      return;
    }
    try {
      recorder.stop();
    } catch (e) {
      this.voiceMemoRecorder = null;
      this.saveMessage("Could not stop the recording.");
    }
    this.render();
  }

  renderReadAloud(root) {
    const data = this.settings().readAloud;
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Read aloud" });
    card.createDiv({ cls: "qt-hint", text: "Speaks a note with the device voice and highlights the current sentence. Nothing is uploaded; the voice, rate and pitch stay on this device." });
    const form = card.createDiv({ cls: "qt-study-form" });
    const style = this.renderSelect(form, "Style", READ_ALOUD_STYLES.map((entry) => ({ value: entry.id, label: entry.label })), data.style);
    style.addEventListener("change", async () => {
      await this.plugin.updateReadAloud({ style: style.value });
      this.render();
    });
    const rate = this.renderField(form, "Rate", "number", "1", String(data.rate));
    rate.min = "0.5";
    rate.max = "2";
    rate.step = "0.1";
    rate.addEventListener("change", async () => {
      await this.plugin.updateReadAloud({ rate: rate.value });
      this.render();
    });
    const code = this.renderSelect(form, "Code blocks", READ_ALOUD_CODE.map((mode) => ({ value: mode.id, label: mode.label })), data.codeBlocks);
    code.addEventListener("change", async () => {
      await this.plugin.updateReadAloud({ codeBlocks: code.value });
      this.render();
    });
    const urls = this.renderSelect(form, "Website addresses", [{ value: "keep", label: "Read them" }, { value: "skip", label: "Skip them" }], data.skipUrls ? "skip" : "keep");
    urls.addEventListener("change", async () => {
      await this.plugin.updateReadAloud({ skipUrls: urls.value === "skip" });
      this.render();
    });
    const acronyms = this.renderSelect(form, "Acronyms", [{ value: "natural", label: "Read naturally" }, { value: "spell", label: "Spell out" }], data.spellAcronyms ? "spell" : "natural");
    acronyms.addEventListener("change", async () => {
      await this.plugin.updateReadAloud({ spellAcronyms: acronyms.value === "spell" });
      this.render();
    });
    const memoCard = root.createDiv({ cls: "qt-study-card" });
    memoCard.createEl("h3", { text: "Voice memo" });
    const memoFolder = this.plugin.voiceMemoSettings();
    memoCard.createDiv({ cls: "qt-hint", text: "Record with this device's microphone. Stopping saves the audio to " + memoFolder.folder + (memoFolder.dailyNoteFolder ? " and appends one timestamped line to the day's note in " + memoFolder.dailyNoteFolder : "; set a daily-note folder in settings to also append a line to the day's note") + ". Nothing is transcribed, uploaded or sent to a model." });
    const memoLabel = this.renderField(memoCard, "Memo label", "text", "Optional note to add with the recording", this.voiceMemoLabel);
    memoLabel.addEventListener("input", () => {
      this.voiceMemoLabel = memoLabel.value;
    });
    const memoActions = memoCard.createDiv({ cls: "qt-row qt-study-actions" });
    if (this.voiceMemoRecorder) {
      memoActions.createEl("button", { text: "Stop and save", cls: "mod-cta" }).addEventListener("click", () => this.stopVoiceMemo());
      memoCard.createDiv({ cls: "qt-study-row-meta", text: "Recording since " + voiceMemo.memoTime(this.voiceMemoStartedAt) + "." });
    } else {
      memoActions.createEl("button", { text: "Record voice memo", cls: "mod-cta" }).addEventListener("click", () => this.startVoiceMemo());
      memoCard.createDiv({ cls: "qt-study-row-meta", text: "Audio files are saved as " + voiceMemo.memoPath(memoFolder.folder, new Date(), "audio/webm").replace(/^.*\//, "") + " (the name follows the recording time)." });
    }

    const load = card.createDiv({ cls: "qt-row qt-study-actions" });
    load.createEl("button", { text: "Load the active note" }).addEventListener("click", async () => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        this.saveMessage("Open a note first.");
        this.render();
        return;
      }
      this.readAloudText = await this.app.vault.read(file);
      this.readAloudPlan = null;
      this.saveMessage(`Loaded ${file.path}.`);
      this.render();
    });
    const textarea = this.renderTextarea(card, "Text to read", "Load the active note or paste text here", this.readAloudText, 6);
    textarea.addEventListener("input", () => {
      this.readAloudText = textarea.value;
      this.readAloudPlan = null;
    });
    const plan = this.readAloudPlan || buildReadAloudPlan(this.readAloudText, data);
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Start", cls: "mod-cta" }).addEventListener("click", () => {
      const synth = this.speech();
      if (!synth) {
        this.saveMessage("This device has no speech synthesis available.");
        this.render();
        return;
      }
      const current = buildReadAloudPlan(this.readAloudText, data);
      if (!current.sentences.length) {
        this.saveMessage("Load a note or paste text first.");
        this.render();
        return;
      }
      try {
        synth.cancel();
      } catch (e) {
        /* nothing to cancel */
      }
      this.readAloudPlan = current;
      this.readAloudIndex = 0;
      this.readAloudPlaying = true;
      this.saveMessage(`Reading ${current.sentences.length} sentence${current.sentences.length === 1 ? "" : "s"} · about ${durationLabel(current.estimatedSeconds)}.`);
      this.render();
      this.speakSentence(0);
    });
    if (!plan.sentences.length) {
      this.renderTabsEmpty(root, "Load a note or paste text above to build a speaking plan. Nothing is uploaded and no voice settings leave this device.");
      return;
    }
    actions.createEl("button", { text: "Pause" }).addEventListener("click", () => {
      const synth = this.speech();
      if (synth && synth.pause) synth.pause();
    });
    actions.createEl("button", { text: "Resume" }).addEventListener("click", () => {
      const synth = this.speech();
      if (synth && synth.resume) synth.resume();
    });
    actions.createEl("button", { text: "Stop" }).addEventListener("click", () => this.stopReadAloud(true));
    card.createDiv({ cls: "qt-study-row-meta", text: `${plan.sentences.length} sentences · about ${durationLabel(plan.estimatedSeconds)}${plan.truncated ? ` · shortened from ${plan.total}` : ""}` });
    const list = card.createDiv({ cls: "qt-study-list qt-read-aloud-list" });
    plan.sentences.forEach((sentence, index) => {
      const line = list.createDiv({ cls: "qt-read-aloud-sentence", text: sentence });
      if (index === this.readAloudIndex) line.addClass("is-speaking");
      line.addEventListener("click", () => {
        if (!this.readAloudPlan) return;
        const synth = this.speech();
        if (synth) {
          try {
            synth.cancel();
          } catch (e) {
            /* nothing to cancel */
          }
        }
        this.readAloudPlaying = true;
        this.speakSentence(index);
      });
    });
  }

  /* ---- Audio bookmarks and chapters ------------------------------------ */

  renderAudioBookmarks(root) {
    const data = this.settings().audioBookmarks;
    const card = root.createDiv({ cls: "qt-study-card" });
    card.createEl("h3", { text: "Add a timestamp bookmark" });
    card.createDiv({ cls: "qt-hint", text: "Stores a timestamp for an audio attachment and builds a copyable Obsidian link. The plugin does not record or upload audio." });
    const form = card.createDiv({ cls: "qt-study-form" });
    const path = this.renderField(form, "Audio file", "text", "Recordings/lecture-01.mp3", this.bookmarkPath);
    path.addEventListener("input", () => (this.bookmarkPath = path.value));
    const at = this.renderField(form, "Timestamp", "text", "12:30", this.bookmarkAt);
    at.addEventListener("input", () => (this.bookmarkAt = at.value));
    const label = this.renderField(form, "Label (optional)", "text", "Cell respiration", this.bookmarkLabel);
    label.addEventListener("input", () => (this.bookmarkLabel = label.value));
    const actions = card.createDiv({ cls: "qt-row qt-study-actions" });
    actions.createEl("button", { text: "Add bookmark", cls: "mod-cta" }).addEventListener("click", async () => {
      const seconds = parseTimestamp(this.bookmarkAt || "0:00");
      if (seconds < 0) {
        this.saveMessage("Use a timestamp like 1:23 or 01:02:03.");
        this.render();
        return;
      }
      const entry = await this.plugin.addAudioBookmark({ path: this.bookmarkPath, at: seconds, label: this.bookmarkLabel });
      if (!entry) {
        this.saveMessage("Use an audio path that ends in mp3, m4a, wav, ogg, flac, aac, opus, webm or mp4.");
        this.render();
        return;
      }
      this.bookmarkPath = entry.path;
      this.bookmarkAt = "";
      this.bookmarkLabel = "";
      this.saveMessage(`Bookmark saved at ${formatTimestamp(entry.at)}.`);
      this.render();
    });
    const paths = bookmarkPaths(data.entries);
    if (!paths.length) {
      this.renderTabsEmpty(root, "No bookmarks yet. Add the first timestamp above; the plugin stores the path and time, never the audio.");
      return;
    }
    const listCard = root.createDiv({ cls: "qt-study-card" });
    listCard.createEl("h3", { text: "Chapters" });
    const list = listCard.createDiv({ cls: "qt-study-list" });
    for (const audioPath of paths) {
      const chapters = chaptersFor(data.entries, audioPath);
      const group = list.createDiv({ cls: "qt-study-row" });
      const main = group.createDiv({ cls: "qt-study-row-main" });
      main.createDiv({ cls: "qt-study-row-title", text: audioPath });
      main.createDiv({ cls: "qt-study-row-meta", text: `${chapters.length} bookmark${chapters.length === 1 ? "" : "s"}` });
      for (const chapter of chapters) {
        const row = main.createDiv({ cls: "qt-study-row-meta qt-audio-chapter" });
        row.createSpan({ text: `${chapter.chapter}. ${chapter.atLabel} — ${chapter.label}` });
        row.createEl("button", { text: "Copy link" }).addEventListener("click", async () => {
          const link = bookmarkLink(chapter);
          try {
            await navigator.clipboard.writeText(link);
            this.saveMessage(`Copied ${link}.`);
          } catch (e) {
            this.saveMessage(link);
          }
          this.render();
        });
        row.createEl("button", { text: "Delete", cls: "qt-danger" }).addEventListener("click", async () => {
          await this.plugin.removeAudioBookmark(chapter.id);
          this.render();
        });
      }
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
