"use strict";
/*
 * One settings module per study tool. Each distinct tool that came from the
 * MIT parity plan keeps its own page instead of sharing a single switch list,
 * so its options, data counts and entry points stay together.
 *
 * Every page controls settings the tool already reads; nothing here adds a new
 * store, provider or network request.
 */
const { Setting } = require("obsidian");
const studyTools = require("./study-tools");
const studyWorkspace = require("./study-workspace");
const readAloud = require("./read-aloud");
const lectureCompiler = require("./lecture-compiler");
const courseHealth = require("./course-health");
const feynmanAi = require("./feynman-ai");
const pdfAnnotationIndex = require("./pdf-annotation-index");
const schedulerFit = require("./scheduler-fit");
const studyMap = require("./study-map");
const vaultSearch = require("./vault-search");
const cardArchive = require("./card-archive");
const studyNudge = require("./study-nudge");
const courseTemplates = require("./course-templates");
const audioBookmarks = require("./audio-bookmarks");
const readingLibrary = require("./reading-library");
const timeBlocks = require("./time-blocks");
const citations = require("./citations");

/** Sidebar order follows the plan: local tools, then the workspace, then analysis. */
const STUDY_TOOL_SETTINGS_MODULES = [
  { id: "cornell", label: "Cornell notes", icon: "notebook-pen" },
  { id: "lecture-log", label: "Lecture log", icon: "presentation" },
  { id: "study-goals", label: "Study goals", icon: "target" },
  { id: "feynman", label: "Feynman Learning", icon: "brain" },
  { id: "recall-scheduler", label: "Recall Scheduler", icon: "rotate-ccw" },
  { id: "topic-planner", label: "Topic planner", icon: "map" },
  { id: "study-flow", label: "Study Flow", icon: "inbox" },
  { id: "subjects", label: "Subject Manager", icon: "folder-tree" },
  { id: "courses", label: "Courses", icon: "graduation-cap" },
  { id: "study-tasks", label: "Tasks", icon: "check-square" },
  { id: "time-blocks", label: "Time blocks", icon: "calendar-clock" },
  { id: "annotations", label: "Annotations", icon: "highlighter" },
  { id: "deep-notes", label: "Deep Notes", icon: "messages-square" },
  { id: "retention", label: "Retention", icon: "line-chart" },
  { id: "vocabulary", label: "Vocabulary", icon: "book-a" },
  { id: "reading-library", label: "Reading library", icon: "library" },
  { id: "citations", label: "Citations", icon: "book-marked" },
  { id: "quiz-index", label: "Quiz index", icon: "list-checks" },
  { id: "quiz-maker", label: "Quiz Maker blocks", icon: "puzzle" },
  { id: "sat-math", label: "SAT math solver", icon: "calculator" },
  { id: "cbt-exam", label: "CBT exam blocks", icon: "monitor" },
  { id: "sfc-cards", label: "SFC card blocks", icon: "gallery-horizontal" },
  { id: "course-health", label: "Course health", icon: "stethoscope" },
  { id: "read-aloud", label: "Read aloud", icon: "volume-2" },
  { id: "lecture-notes", label: "Lecture notes", icon: "file-text" },
  { id: "audio-bookmarks", label: "Audio bookmarks", icon: "bookmark" },
  { id: "feynman-ai", label: "Feynman AI feedback", icon: "sparkles" },
  { id: "pdf-annotations", label: "PDF annotations", icon: "file-search" },
  { id: "scheduler-fit", label: "Scheduler fitting", icon: "gauge" },
  { id: "study-map", label: "Study map", icon: "network" },
  { id: "vault-search", label: "Vault search", icon: "search" },
  { id: "card-archive", label: "Card archive", icon: "archive" },
  { id: "study-nudge", label: "Study nudge", icon: "bell" },
  { id: "course-templates", label: "Course templates", icon: "file-plus" },
];

const DISABLED_HINT = "Off keeps its settings and your notes; it only hides the view, ribbon entry and command.";

/* ------------------------------------------------------------------ helpers */

function heading(containerEl, title, description) {
  containerEl.createEl("h2", { text: title });
  containerEl.createEl("p", { cls: "setting-item-description", text: description });
}

function numberField(containerEl, field, plugin) {
  new Setting(containerEl)
    .setName(field.name)
    .setDesc(field.desc || "")
    .addText((t) => {
      t.inputEl.type = "number";
      if (field.min !== undefined) t.inputEl.min = String(field.min);
      if (field.max !== undefined) t.inputEl.max = String(field.max);
      t.setValue(String(field.get(plugin)));
      t.onChange(async (v) => {
        await field.set(plugin, v);
        await plugin.save();
        if (typeof field.after === "function") field.after(plugin);
      });
    });
}

function textField(containerEl, field, plugin) {
  new Setting(containerEl)
    .setName(field.name)
    .setDesc(field.desc || "")
    .addText((t) => {
      if (field.placeholder) t.setPlaceholder(field.placeholder);
      t.setValue(String(field.get(plugin)));
      t.onChange(async (v) => {
        await field.set(plugin, v);
        await plugin.save();
        if (typeof field.after === "function") field.after(plugin);
      });
    });
}

function toggleField(containerEl, field, plugin) {
  new Setting(containerEl)
    .setName(field.name)
    .setDesc(field.desc || "")
    .addToggle((t) =>
      t.setValue(field.get(plugin) === true).onChange(async (v) => {
        await field.set(plugin, v);
        await plugin.save();
        if (typeof field.after === "function") field.after(plugin);
      })
    );
}

function selectField(containerEl, field, plugin) {
  new Setting(containerEl)
    .setName(field.name)
    .setDesc(field.desc || "")
    .addDropdown((d) => {
      for (const option of field.options) d.addOption(option.id, option.label);
      d.setValue(String(field.get(plugin))).onChange(async (v) => {
        await field.set(plugin, v);
        await plugin.save();
        if (typeof field.after === "function") field.after(plugin);
      });
    });
}

function renderField(containerEl, field, plugin) {
  if (field.type === "toggle") return toggleField(containerEl, field, plugin);
  if (field.type === "dropdown") return selectField(containerEl, field, plugin);
  if (field.type === "text") return textField(containerEl, field, plugin);
  return numberField(containerEl, field, plugin);
}

/** Writes one module object through its normalizer, so every page clamps the same way. */
function update(plugin, key, normalize, patch) {
  plugin.settings[key] = normalize({ ...plugin.settings[key], ...patch });
}

async function refreshModule(plugin, method) {
  const methods = Array.isArray(method) ? method : [method];
  for (const name of methods) {
    if (typeof name === "string" && typeof plugin[name] === "function") await plugin[name]();
  }
  if (typeof plugin.refreshViews === "function") plugin.refreshViews();
}

/* -------------------------------------------------------------------- pages */

const PAGES = {
  cornell: {
    title: "Cornell notes",
    description:
      "A read-only cornell-note block with cues, notes, margins, a summary and a recall mode, plus a note creator in Study Tools. Formatting only: it never writes questions, cards or schedules.",
    enabledGetter: "cornellNotesEnabled",
    enable: (plugin, v) => update(plugin, "cornellNotes", studyTools.normalizeCornellSettings, { enabled: v }),
    afterToggle: "onStudyToolToggled",
    status: (plugin) => {
      const notes = plugin.app && plugin.app.vault ? plugin.app.vault.getMarkdownFiles().filter((f) => f.path) : [];
      return `Cornell blocks render in any Markdown note. ${notes.length} Markdown note${notes.length === 1 ? "" : "s"} can use a block.`;
    },
    open: { label: "Open Study Tools", run: (plugin) => plugin.activateStudyTools("cornell") },
  },
  "lecture-log": {
    title: "Lecture log",
    description:
      "A local log of lectures by course, date and topic, with bulk paste and an upcoming-lecture card on Today. The optional after-class prompt asks you to mark attendance. No audio, transcript, account or network request is added.",
    enabledGetter: "lectureLogEnabled",
    enable: (plugin, v) => update(plugin, "lectureLog", studyTools.normalizeLectureLog, { enabled: v }),
    afterToggle: "onStudyToolToggled",
    fields: [
      {
        type: "toggle",
        name: "Prompt after class",
        desc: "After a calendar class has ended, Today shows Mark attended / Mark absent until that class has a lecture or absence row. Off by default; no notification is sent.",
        get: (plugin) => studyTools.normalizeLectureLog(plugin.settings.lectureLog).afterClassPrompt,
        set: async (plugin, v) => update(plugin, "lectureLog", studyTools.normalizeLectureLog, { afterClassPrompt: v }),
      },
    ],
    status: (plugin) => {
      const data = studyTools.normalizeLectureLog(plugin.settings.lectureLog);
      const next = studyTools.nextLecture(data.lectures, new Date().toISOString().slice(0, 10));
      return `${data.lectures.length} lecture${data.lectures.length === 1 ? "" : "s"} logged${next ? `; next: ${next.title} on ${next.date}` : ""}.`;
    },
    open: { label: "Open Lecture log", run: (plugin) => plugin.activateStudyTools("lectures") },
  },
  "study-goals": {
    title: "Study goals",
    description:
      "Small local goals with minute progress, an optional due date and a next-exam shortcut. Goals live in plugin data and appear on Today while they are open.",
    enabledGetter: "studyGoalsEnabled",
    enable: (plugin, v) => update(plugin, "studyGoals", studyTools.normalizeStudyGoals, { enabled: v }),
    afterToggle: "onStudyToolToggled",
    status: (plugin) => {
      const data = studyTools.normalizeStudyGoals(plugin.settings.studyGoals);
      return `${studyTools.openGoals(data.goals).length} open goal${studyTools.openGoals(data.goals).length === 1 ? "" : "s"} of ${data.goals.length}.`;
    },
    open: { label: "Open goals", run: (plugin) => plugin.activateStudyTools("goals") },
  },
  feynman: {
    title: "Feynman Learning",
    description:
      "A four-step explanation cycle with local self-scoring, a session browser and weak-dimension drills. Scoring is yours; AI feedback is a separate module.",
    enabledGetter: "feynmanLearningEnabled",
    enable: (plugin, v) => update(plugin, "feynmanLearning", studyWorkspace.normalizeFeynmanSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => `${studyWorkspace.normalizeFeynmanSettings(plugin.settings.feynmanLearning).sessions.length} saved cycle(s).`,
    open: { label: "Open Feynman", run: (plugin) => plugin.activateStudyWorkspace("feynman") },
  },
  "recall-scheduler": {
    title: "Recall Scheduler",
    description:
      "Heading and knowledge-fragment queues with due filtering, grading and interval tracking. It is separate from the card and whole-note schedulers.",
    enabledGetter: "recallSchedulerEnabled",
    enable: (plugin, v) => update(plugin, "recallScheduler", studyWorkspace.normalizeRecallScheduler, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "dropdown",
        name: "Queue source",
        desc: "Headings carve a note at # headings; fragments use one recall unit per paragraph.",
        options: [
          { id: "headings", label: "Headings" },
          { id: "fragments", label: "Fragments" },
        ],
        get: (plugin) => studyWorkspace.normalizeRecallScheduler(plugin.settings.recallScheduler).mode,
        set: async (plugin, v) => update(plugin, "recallScheduler", studyWorkspace.normalizeRecallScheduler, { mode: v }),
      },
      {
        type: "text",
        name: "Folder filter",
        desc: "Only scan notes in this folder. Leave empty for the whole vault.",
        placeholder: "Study/Biology",
        get: (plugin) => studyWorkspace.normalizeRecallScheduler(plugin.settings.recallScheduler).folder,
        set: async (plugin, v) => update(plugin, "recallScheduler", studyWorkspace.normalizeRecallScheduler, { folder: v }),
      },
      {
        type: "number",
        name: "Queue limit",
        desc: "How many recall units one queue may hold (1-100).",
        min: 1,
        max: 100,
        get: (plugin) => studyWorkspace.normalizeRecallScheduler(plugin.settings.recallScheduler).limit,
        set: async (plugin, v) => update(plugin, "recallScheduler", studyWorkspace.normalizeRecallScheduler, { limit: v }),
      },
    ],
    open: { label: "Open Recall", run: (plugin) => plugin.activateStudyWorkspace("recall") },
  },
  "topic-planner": {
    title: "Topic planner",
    description:
      "Multi-pass exam planning with exam dates, buffer days and a day-level allocation. It plans local topics; it does not create cards or move reviews.",
    enabledGetter: "lerntrackerEnabled",
    enable: (plugin, v) => update(plugin, "lerntracker", studyWorkspace.normalizePlanner, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => `${studyWorkspace.normalizePlanner(plugin.settings.lerntracker).plans.length} plan(s).`,
    open: { label: "Open Topic planner", run: (plugin) => plugin.activateStudyWorkspace("planner") },
  },
  "study-flow": {
    title: "Study Flow",
    description:
      "A source excerpt inbox: capture an excerpt, write your understanding and a card draft, then mark it reviewed. PDF extraction stays in the existing PDF workflow.",
    enabledGetter: "studyFlowEnabled",
    enable: (plugin, v) => update(plugin, "studyFlow", studyWorkspace.normalizeStudyFlow, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => {
      const stats = studyWorkspace.flowStats(studyWorkspace.normalizeStudyFlow(plugin.settings.studyFlow).excerpts);
      return `${stats.inbox} in the inbox, ${stats.reviewed} reviewed, ${stats.understood} understood.`;
    },
    open: { label: "Open Study Flow", run: (plugin) => plugin.activateStudyWorkspace("flow") },
  },
  subjects: {
    title: "Subject Manager",
    description:
      "Subjects with local projects, due dates, done/reopen state, attendance from the lecture and absence logs, and search across subjects and projects.",
    enabledGetter: "subjectManagerEnabled",
    enable: (plugin, v) => update(plugin, "subjectManager", studyWorkspace.normalizeSubjectManager, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => {
      const data = studyWorkspace.normalizeSubjectManager(plugin.settings.subjectManager);
      return `${data.subjects.length} subject(s), ${data.absences.length} absence(s).`;
    },
    open: { label: "Open Subjects", run: (plugin) => plugin.activateStudyWorkspace("subjects") },
  },
  courses: {
    title: "Courses",
    description:
      "A course dashboard with weighted grade chips, lecture and absence counts, and the same local course registry used by Course health and Assignments.",
    enabledGetter: "courseHubEnabled",
    enable: (plugin, v) => update(plugin, "courseHub", studyWorkspace.normalizeCourseHub, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => `${studyWorkspace.normalizeCourseHub(plugin.settings.courseHub).grades.length} grade chip(s).`,
    open: { label: "Open Courses", run: (plugin) => plugin.activateStudyWorkspace("courses") },
  },
  "study-tasks": {
    title: "Tasks",
    description:
      "Manual tasks and generated exam study tasks with due dates, completion and local reminders. It reads the same course and planner data as Today.",
    enabledGetter: "studyTasksEnabled",
    enable: (plugin, v) => update(plugin, "studyTasks", studyWorkspace.normalizeStudyTasks, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => {
      const tasks = studyWorkspace.normalizeStudyTasks(plugin.settings.studyTasks).tasks;
      return `${studyWorkspace.dueStudyTasks(tasks, new Date().toISOString().slice(0, 10)).length} due today of ${tasks.length}.`;
    },
    open: { label: "Open Tasks", run: (plugin) => plugin.activateStudyWorkspace("tasks") },
  },
  "time-blocks": {
    title: "Time blocks",
    description:
      "A local day planner: blocks own a span of time, tasks live inside them, and projects or domains are optional lenses. It reuses study tasks and courses, offers routines for the selected day, and keeps a backlog for work that has not been placed yet. No calendar sync or provider is added.",
    enabledGetter: "timeBlocksEnabled",
    enable: (plugin, v) => update(plugin, "timeBlocks", timeBlocks.normalizeTimeBlocks, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "dropdown",
        name: "Week starts on",
        desc: "Controls the Week and Grid columns.",
        options: [
          { id: "monday", label: "Monday" },
          { id: "sunday", label: "Sunday" },
        ],
        get: (plugin) => timeBlocks.normalizeTimeBlocks(plugin.settings.timeBlocks).weekStartsOn,
        set: async (plugin, v) => update(plugin, "timeBlocks", timeBlocks.normalizeTimeBlocks, { weekStartsOn: v }),
      },
      {
        type: "text",
        name: "Day starts at",
        desc: "The first hour shown in the Day timeline.",
        placeholder: "07:00",
        get: (plugin) => timeBlocks.normalizeTimeBlocks(plugin.settings.timeBlocks).dayStart,
        set: async (plugin, v) => update(plugin, "timeBlocks", timeBlocks.normalizeTimeBlocks, { dayStart: v }),
      },
      {
        type: "text",
        name: "Day ends at",
        desc: "The last hour shown in the Day timeline.",
        placeholder: "22:00",
        get: (plugin) => timeBlocks.normalizeTimeBlocks(plugin.settings.timeBlocks).dayEnd,
        set: async (plugin, v) => update(plugin, "timeBlocks", timeBlocks.normalizeTimeBlocks, { dayEnd: v }),
      },
      {
        type: "text",
        name: "Day-note folder",
        desc: "A day can be written as readable Markdown with a Schedule section. The planner itself stays local.",
        placeholder: "Time blocks",
        get: (plugin) => timeBlocks.normalizeTimeBlocks(plugin.settings.timeBlocks).notesFolder,
        set: async (plugin, v) => update(plugin, "timeBlocks", timeBlocks.normalizeTimeBlocks, { notesFolder: v }),
      },
      {
        type: "text",
        name: "Daily-note folder",
        desc: "Optional vault folder with YYYY-MM-DD.md notes. Time blocks can preview HH:MM lines and add them as blocks after confirmation; the daily note is never written.",
        placeholder: "Daily notes",
        get: (plugin) => timeBlocks.normalizeTimeBlocks(plugin.settings.timeBlocks).dailyNoteFolder,
        set: async (plugin, v) => update(plugin, "timeBlocks", timeBlocks.normalizeTimeBlocks, { dailyNoteFolder: v }),
      },
      {
        type: "toggle",
        name: "Show calendar events",
        desc: "Read-only classes and events from the current calendar; a block that shares their time is marked. Calendar entries are never edited or copied.",
        get: (plugin) => timeBlocks.normalizeTimeBlocks(plugin.settings.timeBlocks).showCalendar,
        set: async (plugin, v) => update(plugin, "timeBlocks", timeBlocks.normalizeTimeBlocks, { showCalendar: v }),
      },
    ],
    status: (plugin) => {
      const data = timeBlocks.normalizeTimeBlocks(plugin.settings.timeBlocks);
      return data.blocks.length + " block(s), " + data.projects.length + " project(s) and " + data.backlog.length + " backlog item(s).";
    },
    open: { label: "Open Time blocks", run: (plugin) => plugin.activateStudyWorkspace("timeBlocks") },
  },
  annotations: {
    title: "Annotations",
    description:
      "Capture the active Markdown selection, your question and an answer into a local index, then navigate back to the source note. Read-only with respect to the source.",
    enabledGetter: "annotationsEnabled",
    enable: (plugin, v) => update(plugin, "annotations", studyWorkspace.normalizeAnnotations, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => `${studyWorkspace.normalizeAnnotations(plugin.settings.annotations).annotations.length} saved selection(s).`,
    open: { label: "Open Annotations", run: (plugin) => plugin.activateStudyWorkspace("annotations") },
  },
  "deep-notes": {
    title: "Deep Notes",
    description:
      "Five local Socratic prompts per session: claim, assumptions, evidence, counterexample and synthesis. Answers are saved locally; no model is called.",
    enabledGetter: "deepNotesEnabled",
    enable: (plugin, v) => update(plugin, "deepNotes", studyWorkspace.normalizeDeepNotes, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => `${studyWorkspace.normalizeDeepNotes(plugin.settings.deepNotes).sessions.length} session(s).`,
    open: { label: "Open Deep Notes", run: (plugin) => plugin.activateStudyWorkspace("deepNotes") },
  },
  retention: {
    title: "Retention",
    description:
      "A read-only 30-day card due forecast with overdue and new counts and the scheduler self-fitting card. It never changes a card schedule.",
    enabledGetter: "retentionEnabled",
    enable: (plugin, v) => update(plugin, "retention", studyWorkspace.normalizeRetention, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    open: { label: "Open Retention", run: (plugin) => plugin.activateStudyWorkspace("retention") },
  },
  vocabulary: {
    title: "Vocabulary",
    description:
      "A local dictionary with bulk term|definition|example|media import, a due-date ladder and per-word correctness, streak, lapse and accuracy statistics.",
    enabledGetter: "vocabularyEnabled",
    enable: (plugin, v) => update(plugin, "vocabulary", studyWorkspace.normalizeVocabulary, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => `${studyWorkspace.normalizeVocabulary(plugin.settings.vocabulary).words.length} word(s).`,
    open: { label: "Open Vocabulary", run: (plugin) => plugin.activateStudyWorkspace("vocabulary") },
  },
  citations: {
    title: "Citations",
    description:
      "Import a BibTeX file from the vault into a local citation library, copy a formatted reference or create a citation note. No Zotero/ZotLit login, network request or automatic note write is added.",
    enabledGetter: "citationsEnabled",
    enable: (plugin, v) => update(plugin, "citations", citations.normalizeCitationSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "text",
        name: "Citation-note folder",
        desc: "Where Create note writes a citation note. Existing files are never overwritten.",
        placeholder: "Citations",
        get: (plugin) => citations.normalizeCitationSettings(plugin.settings.citations).folder,
        set: async (plugin, v) => update(plugin, "citations", citations.normalizeCitationSettings, { folder: v }),
      },
    ],
    status: (plugin) => {
      const data = citations.normalizeCitationSettings(plugin.settings.citations);
      return data.entries.length + " citation(s) in the local library.";
    },
    open: { label: "Open Citations", run: (plugin) => plugin.activateStudyWorkspace("citations") },
  },
  "reading-library": {
    title: "Reading library",
    description:
      "A local bookshelf with want, reading and finished shelves, page progress, ratings and captured quotes. Adapted from Verso's library and quote idea; it reads no book text, calls no provider and writes no note.",
    enabledGetter: "readingLibraryEnabled",
    enable: (plugin, v) => update(plugin, "readingLibrary", readingLibrary.normalizeLibrary, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "toggle",
        name: "Hide finished books on the All shelf",
        desc: "Keep the main shelf focused on books you are reading or still plan to read. The Finished shelf still shows them.",
        get: (plugin) => readingLibrary.normalizeLibrary(plugin.settings.readingLibrary).hideFinished,
        set: async (plugin, v) => update(plugin, "readingLibrary", readingLibrary.normalizeLibrary, { hideFinished: v }),
      },
    ],
    status: (plugin) => {
      const summary = readingLibrary.librarySummary(readingLibrary.normalizeLibrary(plugin.settings.readingLibrary).books);
      return `${summary.total} book(s) · ${summary.reading} reading · ${summary.finished} finished · ${summary.quotes} quote(s).`;
    },
    open: { label: "Open the bookshelf", run: (plugin) => plugin.activateStudyWorkspace("readingLibrary") },
  },
  "quiz-index": {
    title: "Quiz index",
    description:
      "A cross-vault index of inline quizzes and saved quizResults, with level/type counts, first-attempt accuracy, a folder topic index and a wrong-answer index.",
    enabledGetter: "quizIndexEnabled",
    enable: (plugin, v) => update(plugin, "quizIndex", studyWorkspace.normalizeQuizIndex, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "text",
        name: "Folder filter",
        desc: "Only index quizzes in this folder. Leave empty for the whole vault.",
        placeholder: "Quizzes",
        get: (plugin) => studyWorkspace.normalizeQuizIndex(plugin.settings.quizIndex).folder,
        set: async (plugin, v) => update(plugin, "quizIndex", studyWorkspace.normalizeQuizIndex, { folder: v }),
      },
      {
        type: "number",
        name: "Index limit",
        desc: "How many quiz notes the index may read (1-200).",
        min: 1,
        max: 200,
        get: (plugin) => studyWorkspace.normalizeQuizIndex(plugin.settings.quizIndex).limit,
        set: async (plugin, v) => update(plugin, "quizIndex", studyWorkspace.normalizeQuizIndex, { limit: v }),
      },
      {
        type: "toggle",
        name: "Record inline quiz attempts",
        desc: "Store a compact per-question attempt when an identified mcq-quiz block is completed. The note itself is never changed.",
        get: (plugin) => studyWorkspace.normalizeQuizIndex(plugin.settings.quizIndex).recordAttempts === true,
        set: async (plugin, v) => update(plugin, "quizIndex", studyWorkspace.normalizeQuizIndex, { recordAttempts: v }),
      },
    ],
    status: (plugin) => {
      const attempts = studyWorkspace.normalizeQuizIndex(plugin.settings.quizIndex).attempts.length;
      return `${attempts} recorded attempt note group(s).`;
    },
    open: { label: "Open Quiz index", run: (plugin) => plugin.activateStudyWorkspace("quizIndex") },
  },
  "quiz-maker": {
    title: "Quiz Maker blocks",
    description:
      "Play named study packs in local quiz-maker blocks: assertion-and-reason, error-correction, evidence-selection and branching-scenario questions. Answers are not recorded.",
    enabledGetter: "quizMakerEnabled",
    enable: (plugin, v) => {
      plugin.settings.quizMaker = { ...plugin.settings.quizMaker, enabled: v };
    },
    afterToggle: "refreshViews",
    note: "The block is read-only: it does not write attempts, history or a schedule.",
  },
  "sat-math": {
    title: "SAT math solver",
    description:
      "Solve linear equations, inequalities, quadratics, 2x2 systems, percentages, ratios and two-point line equations with step-by-step local working in sat-math blocks. No scaled score is estimated without an official curve.",
    enabledGetter: "satMathEnabled",
    enable: (plugin, v) => {
      plugin.settings.satMath = { ...plugin.settings.satMath, enabled: v };
    },
    afterToggle: "refreshViews",
  },
  "cbt-exam": {
    title: "CBT exam blocks",
    description:
      "Run a local exam navigator with answer flags, a submit score, per-topic breakdown, per-exam attempt history and a missed-first adaptive review pass in cbt-exam blocks. The note itself is never changed.",
    enabledGetter: "cbtExamEnabled",
    enable: (plugin, v) => {
      plugin.settings.cbtExam = { ...plugin.settings.cbtExam, enabled: v };
    },
    afterToggle: "refreshViews",
    note: "Attempt history stays in plugin data. The binary .vce converter is not included.",
  },
  "sfc-cards": {
    title: "SFC card blocks",
    description:
      "Study basic, reversed, cloze, essay, worked-solution, wrong-answer-sprint and source-marked cards in local sfc-cards blocks. Reveals and self-checks are local and are not recorded.",
    enabledGetter: "sfcCardsEnabled",
    enable: (plugin, v) => {
      plugin.settings.sfcCards = { ...plugin.settings.sfcCards, enabled: v };
    },
    afterToggle: "refreshViews",
  },
  "course-health": {
    title: "Course health",
    description:
      "Offline checks for missing grades, low attendance, overdue course tasks and an exam close by with topic passes left. Canvas sync is not included.",
    enabledGetter: "courseHealthEnabled",
    enable: (plugin, v) => update(plugin, "courseHealth", courseHealth.normalizeCourseHealthSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "number",
        name: "Attendance threshold (%)",
        desc: "A course below this share of attended lectures is flagged.",
        min: 1,
        max: 100,
        get: (plugin) => courseHealth.normalizeCourseHealthSettings(plugin.settings.courseHealth).attendanceThreshold,
        set: async (plugin, v) => update(plugin, "courseHealth", courseHealth.normalizeCourseHealthSettings, { attendanceThreshold: v }),
      },
      {
        type: "number",
        name: "Exam window (days)",
        desc: "How close an exam must be to count as a risk.",
        min: 1,
        max: 120,
        get: (plugin) => courseHealth.normalizeCourseHealthSettings(plugin.settings.courseHealth).examWindowDays,
        set: async (plugin, v) => update(plugin, "courseHealth", courseHealth.normalizeCourseHealthSettings, { examWindowDays: v }),
      },
      {
        type: "number",
        name: "Minimum sessions",
        desc: "Below this many logged sessions, attendance is reported as too thin to judge.",
        min: 1,
        max: 50,
        get: (plugin) => courseHealth.normalizeCourseHealthSettings(plugin.settings.courseHealth).minSessions,
        set: async (plugin, v) => update(plugin, "courseHealth", courseHealth.normalizeCourseHealthSettings, { minSessions: v }),
      },
    ],
    open: { label: "Run the health check", run: (plugin) => plugin.activateStudyWorkspace("health") },
  },
  "read-aloud": {
    title: "Read aloud",
    description:
      "Speak the active note with the device speech voice, sentence by sentence. Full note, 90-second briefing and key-points styles are local; cached audio and provider voices are not part of this module.",
    enabledGetter: "readAloudEnabled",
    enable: (plugin, v) => update(plugin, "readAloud", readAloud.normalizeReadAloudSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "dropdown",
        name: "Reading style",
        desc: "Briefing and key points speak a shorter extract; full note reads everything.",
        options: readAloud.READ_ALOUD_STYLES.map((style) => ({ id: style.id, label: style.label })),
        get: (plugin) => readAloud.normalizeReadAloudSettings(plugin.settings.readAloud).style,
        set: async (plugin, v) => update(plugin, "readAloud", readAloud.normalizeReadAloudSettings, { style: v }),
      },
      {
        type: "number",
        name: "Speech rate",
        desc: "0.5 to 2. The device voice decides how this sounds.",
        min: 0.5,
        max: 2,
        get: (plugin) => readAloud.normalizeReadAloudSettings(plugin.settings.readAloud).rate,
        set: async (plugin, v) => update(plugin, "readAloud", readAloud.normalizeReadAloudSettings, { rate: v }),
      },
      {
        type: "number",
        name: "Speech pitch",
        desc: "0 to 2.",
        min: 0,
        max: 2,
        get: (plugin) => readAloud.normalizeReadAloudSettings(plugin.settings.readAloud).pitch,
        set: async (plugin, v) => update(plugin, "readAloud", readAloud.normalizeReadAloudSettings, { pitch: v }),
      },
      {
        type: "text",
        name: "Preferred voice",
        desc: "Optional device voice name. Leave empty to use the system default.",
        get: (plugin) => readAloud.normalizeReadAloudSettings(plugin.settings.readAloud).voice,
        set: async (plugin, v) => update(plugin, "readAloud", readAloud.normalizeReadAloudSettings, { voice: v }),
      },
      {
        type: "dropdown",
        name: "Code blocks",
        desc: "Skip fenced code while reading aloud, or read it as text.",
        options: readAloud.CODE_BLOCK_MODES.map((mode) => ({ id: mode.id, label: mode.label })),
        get: (plugin) => readAloud.normalizeReadAloudSettings(plugin.settings.readAloud).codeBlocks,
        set: async (plugin, v) => update(plugin, "readAloud", readAloud.normalizeReadAloudSettings, { codeBlocks: v }),
      },
      {
        type: "toggle",
        name: "Skip website URLs",
        desc: "Drop bare http(s) and www addresses from the spoken text and keep link labels. Off by default.",
        get: (plugin) => readAloud.normalizeReadAloudSettings(plugin.settings.readAloud).skipUrls,
        set: async (plugin, v) => update(plugin, "readAloud", readAloud.normalizeReadAloudSettings, { skipUrls: v }),
      },
      {
        type: "toggle",
        name: "Spell out acronyms",
        desc: "Read NASA as N A S A. Off by default.",
        get: (plugin) => readAloud.normalizeReadAloudSettings(plugin.settings.readAloud).spellAcronyms,
        set: async (plugin, v) => update(plugin, "readAloud", readAloud.normalizeReadAloudSettings, { spellAcronyms: v }),
      },
    ],
    open: { label: "Open Read aloud", run: (plugin) => plugin.activateStudyWorkspace("readAloud") },
  },
  "lecture-notes": {
    title: "Lecture notes",
    description:
      "Compiles the local lecture log into one note with an overview, key concepts, a Term: definition table and one section per lecture. It previews the note and never overwrites an existing file.",
    enabledGetter: "lectureCompilerEnabled",
    enable: (plugin, v) => update(plugin, "lectureCompiler", lectureCompiler.normalizeLectureCompilerSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "text",
        name: "Output folder",
        desc: "Vault folder for compiled lecture notes. Leave empty for the vault root.",
        placeholder: "Lecture notes",
        get: (plugin) => lectureCompiler.normalizeLectureCompilerSettings(plugin.settings.lectureCompiler).folder,
        set: async (plugin, v) => update(plugin, "lectureCompiler", lectureCompiler.normalizeLectureCompilerSettings, { folder: v }),
      },
      {
        type: "toggle",
        name: "Include an overview",
        desc: "Add a short overview paragraph at the top of the note.",
        get: (plugin) => lectureCompiler.normalizeLectureCompilerSettings(plugin.settings.lectureCompiler).includeOverview,
        set: async (plugin, v) => update(plugin, "lectureCompiler", lectureCompiler.normalizeLectureCompilerSettings, { includeOverview: v }),
      },
      {
        type: "toggle",
        name: "Include key concepts",
        desc: "Add a bullet list of the topics named in the log.",
        get: (plugin) => lectureCompiler.normalizeLectureCompilerSettings(plugin.settings.lectureCompiler).includeConcepts,
        set: async (plugin, v) => update(plugin, "lectureCompiler", lectureCompiler.normalizeLectureCompilerSettings, { includeConcepts: v }),
      },
      {
        type: "toggle",
        name: "Include a vocabulary table",
        desc: "Add a Term: definition table built from the log.",
        get: (plugin) => lectureCompiler.normalizeLectureCompilerSettings(plugin.settings.lectureCompiler).includeVocabulary,
        set: async (plugin, v) => update(plugin, "lectureCompiler", lectureCompiler.normalizeLectureCompilerSettings, { includeVocabulary: v }),
      },
      {
        type: "toggle",
        name: "Include per-lecture sections",
        desc: "Add one section per lecture with its topics.",
        get: (plugin) => lectureCompiler.normalizeLectureCompilerSettings(plugin.settings.lectureCompiler).includeSections,
        set: async (plugin, v) => update(plugin, "lectureCompiler", lectureCompiler.normalizeLectureCompilerSettings, { includeSections: v }),
      },
    ],
    open: { label: "Open Lecture notes", run: (plugin) => plugin.activateStudyWorkspace("lectures") },
  },
  "audio-bookmarks": {
    title: "Audio bookmarks",
    description:
      "Timestamp bookmarks and chapters for an audio attachment, with a copyable Obsidian media link. Recording and playback stay out of scope.",
    enabledGetter: "audioBookmarksEnabled",
    enable: (plugin, v) => update(plugin, "audioBookmarks", audioBookmarks.normalizeAudioBookmarkSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    status: (plugin) => `${audioBookmarks.normalizeAudioBookmarkSettings(plugin.settings.audioBookmarks).entries.length} bookmark(s).`,
    open: { label: "Open Bookmarks", run: (plugin) => plugin.activateStudyWorkspace("bookmarks") },
  },
  "feynman-ai": {
    title: "Feynman AI feedback",
    description:
      "Sends a saved four-step explanation to the AI provider already configured under MCQ Tracker, AI, only after you press the button. It scores clarity, accuracy and simplicity and stores the result beside the manual score.",
    enabledGetter: "feynmanAiEnabled",
    enable: (plugin, v) => update(plugin, "feynmanAi", feynmanAi.normalizeFeynmanAiSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    note: "This module has no key of its own: it uses the existing AI settings and makes a request only on an explicit button press.",
    open: { label: "Open AI feedback", run: (plugin) => plugin.activateStudyWorkspace("feynmanAi") },
  },
  "pdf-annotations": {
    title: "PDF annotations",
    description:
      "A read-only index of the .annotations.md sidecars already in the vault: PDF, page, type, colour and summary, with Open PDF and Open sidecar actions.",
    enabledGetter: "pdfAnnotationIndexEnabled",
    enable: (plugin, v) => update(plugin, "pdfAnnotationIndex", pdfAnnotationIndex.normalizePdfAnnotationIndexSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "text",
        name: "Folder filter",
        desc: "Only index sidecars under this folder. Leave empty for the whole vault.",
        placeholder: "PDFs",
        get: (plugin) => pdfAnnotationIndex.normalizePdfAnnotationIndexSettings(plugin.settings.pdfAnnotationIndex).folder,
        set: async (plugin, v) => update(plugin, "pdfAnnotationIndex", pdfAnnotationIndex.normalizePdfAnnotationIndexSettings, { folder: v }),
      },
      {
        type: "number",
        name: "File limit",
        desc: "How many sidecars one scan may read (1-500).",
        min: 1,
        max: 500,
        get: (plugin) => pdfAnnotationIndex.normalizePdfAnnotationIndexSettings(plugin.settings.pdfAnnotationIndex).limit,
        set: async (plugin, v) => update(plugin, "pdfAnnotationIndex", pdfAnnotationIndex.normalizePdfAnnotationIndexSettings, { limit: v }),
      },
    ],
    open: { label: "Open PDF annotations", run: (plugin) => plugin.activateStudyWorkspace("pdfAnnotations") },
  },
  "scheduler-fit": {
    title: "Scheduler fitting",
    description:
      "Fits request_retention per deck from the review counters cards already keep. It suggests a bounded 0.85-0.95 target and only changes that deck's FSRS retention when you press Apply. The 21 FSRS weights stay fixed at the shipped defaults.",
    enabledGetter: "schedulerFitEnabled",
    enable: (plugin, v) => update(plugin, "schedulerFit", schedulerFit.normalizeSchedulerFitSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "number",
        name: "Minimum review samples",
        desc: "How many card reviews must exist before a fit is offered (10-500).",
        min: 10,
        max: 500,
        get: (plugin) => schedulerFit.normalizeSchedulerFitSettings(plugin.settings.schedulerFit).minSamples,
        set: async (plugin, v) => update(plugin, "schedulerFit", schedulerFit.normalizeSchedulerFitSettings, { minSamples: v }),
      },
    ],
    note: "Apply and Reset live in Settings -> MCQ Tracker -> Scheduler; the Retention tab links there. Weights are never trained.",
    open: { label: "Open Scheduler settings", run: (plugin) => plugin.openSettings() },
  },
  "study-map": {
    title: "Study map",
    description:
      "A study-map block that turns a note or an inline outline into a read-only tree with key terms and a summary, and links back to the source note. No model or network request is made.",
    enabledGetter: "studyMapEnabled",
    enable: (plugin, v) => update(plugin, "studyMap", studyMap.normalizeStudyMapSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "number",
        name: "Key terms",
        desc: "How many repeated terms the map extracts (3-20).",
        min: 3,
        max: 20,
        get: (plugin) => studyMap.normalizeStudyMapSettings(plugin.settings.studyMap).terms,
        set: async (plugin, v) => update(plugin, "studyMap", studyMap.normalizeStudyMapSettings, { terms: v }),
      },
      {
        type: "number",
        name: "Outline depth",
        desc: "How deep the outline tree may go (1-6).",
        min: 1,
        max: 6,
        get: (plugin) => studyMap.normalizeStudyMapSettings(plugin.settings.studyMap).depth,
        set: async (plugin, v) => update(plugin, "studyMap", studyMap.normalizeStudyMapSettings, { depth: v }),
      },
    ],
    note: "These options are the defaults for new study-map blocks; a block can override them with Terms: and Depth:.",
  },
  "vault-search": {
    title: "Vault search",
    description:
      "A vault-search block that ranks Markdown notes with a local BM25-style index and shows a cited snippet plus an Open note action. No embeddings or remote model are used.",
    enabledGetter: "vaultSearchEnabled",
    enable: (plugin, v) => update(plugin, "vaultSearch", vaultSearch.normalizeVaultSearchSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "number",
        name: "Results per search",
        desc: "How many cited results a block shows (1-20).",
        min: 1,
        max: 20,
        get: (plugin) => vaultSearch.normalizeVaultSearchSettings(plugin.settings.vaultSearch).limit,
        set: async (plugin, v) => update(plugin, "vaultSearch", vaultSearch.normalizeVaultSearchSettings, { limit: v }),
      },
    ],
    note: "A vault-search block can override the count with Limit:.",
  },
  "card-archive": {
    title: "Card archive",
    description:
      "Exports every card note's Markdown, deck and course into one versioned JSON file, and restores it with explicit skip or overwrite modes. Other notes are never deleted.",
    enabledGetter: "cardArchiveEnabled",
    enable: (plugin, v) => update(plugin, "cardArchive", cardArchive.normalizeCardArchiveSettings, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "text",
        name: "Archive folder",
        desc: "Vault folder for the exported JSON archive.",
        placeholder: "Archive",
        get: (plugin) => cardArchive.normalizeCardArchiveSettings(plugin.settings.cardArchive).folder,
        set: async (plugin, v) => update(plugin, "cardArchive", cardArchive.normalizeCardArchiveSettings, { folder: v }),
      },
    ],
    note: "Run Cards: export a portable archive and Cards: import a portable archive from the command palette.",
  },
  "study-nudge": {
    title: "Study nudge",
    description:
      "One in-app Notice a day naming due questions, cards and tasks, plus an optional ribbon label. Off by default; no operating-system permission is requested here.",
    enabledGetter: "studyNudgeEnabled",
    enable: (plugin, v) => update(plugin, "studyNudge", studyNudge.normalizeStudyNudgeSettings, { enabled: v }),
    afterToggle: ["onStudyWorkspaceToggled", "refreshStudyNudgeLabel"],
    fields: [
      {
        type: "number",
        name: "Earliest hour",
        desc: "Do not show the nudge before this hour (0-23).",
        min: 0,
        max: 23,
        get: (plugin) => studyNudge.normalizeStudyNudgeSettings(plugin.settings.studyNudge).hour,
        set: async (plugin, v) => update(plugin, "studyNudge", studyNudge.normalizeStudyNudgeSettings, { hour: v }),
      },
      {
        type: "number",
        name: "Quiet hours start",
        desc: "Start of the quiet window (0-23).",
        min: 0,
        max: 23,
        get: (plugin) => studyNudge.normalizeStudyNudgeSettings(plugin.settings.studyNudge).quietFrom,
        set: async (plugin, v) => update(plugin, "studyNudge", studyNudge.normalizeStudyNudgeSettings, { quietFrom: v }),
      },
      {
        type: "number",
        name: "Quiet hours end",
        desc: "End of the quiet window (0-23).",
        min: 0,
        max: 23,
        get: (plugin) => studyNudge.normalizeStudyNudgeSettings(plugin.settings.studyNudge).quietTo,
        set: async (plugin, v) => update(plugin, "studyNudge", studyNudge.normalizeStudyNudgeSettings, { quietTo: v }),
      },
      {
        type: "toggle",
        name: "Name the counts in the ribbon label",
        desc: "The Today ribbon label names due questions, cards and tasks while the nudge is on.",
        get: (plugin) => studyNudge.normalizeStudyNudgeSettings(plugin.settings.studyNudge).ribbonLabel,
        set: async (plugin, v) => update(plugin, "studyNudge", studyNudge.normalizeStudyNudgeSettings, { ribbonLabel: v }),
      },
    ],
    note: "The reminder can also be delivered as a desktop notification under MCQ Tracker, Review.",
    open: { label: "Open Today", run: (plugin) => plugin.activateToday() },
  },
  "course-templates": {
    title: "Course templates",
    description:
      "Maps five note types (lecture, unit, review, assignment, syllabus) to editable local templates with {{course}}, {{title}}, {{date}} and {{type}} placeholders.",
    enabledGetter: "courseTemplatesEnabled",
    enable: (plugin, v) => update(plugin, "courseTemplates", courseTemplates.normalizeCourseTemplates, { enabled: v }),
    afterToggle: "onStudyWorkspaceToggled",
    fields: [
      {
        type: "text",
        name: "Course notes folder",
        desc: "Vault folder for notes created from a template.",
        placeholder: "Courses",
        get: (plugin) => courseTemplates.normalizeCourseTemplates(plugin.settings.courseTemplates).folder,
        set: async (plugin, v) => update(plugin, "courseTemplates", courseTemplates.normalizeCourseTemplates, { folder: v }),
      },
    ],
    status: (plugin) => `${courseTemplates.normalizeCourseTemplates(plugin.settings.courseTemplates).templates.length} template(s) available.`,
    open: { label: "Create a course note", run: (plugin) => plugin.openCourseNoteBuilder() },
  },
};

const STUDY_TOOL_SETTINGS_BY_ID = Object.fromEntries(
  STUDY_TOOL_SETTINGS_MODULES.map((module) => [module.id, { ...module, page: PAGES[module.id] }])
);

/** Renders the page for one study tool. */
function renderStudyToolSettings(containerEl, plugin, redisplay, moduleId) {
  const entry = STUDY_TOOL_SETTINGS_BY_ID[moduleId];
  if (!entry || !entry.page) {
    heading(containerEl, "Study tool", "This study tool has no settings page.");
    return;
  }
  const page = entry.page;
  heading(containerEl, page.title, page.description);
  new Setting(containerEl)
    .setName(`Enable ${entry.label}`)
    .setDesc(page.toggleDesc || DISABLED_HINT)
    .addToggle((t) =>
      t.setValue(plugin[page.enabledGetter]()).onChange(async (v) => {
        page.enable(plugin, v);
        await plugin.save();
        await refreshModule(plugin, page.afterToggle);
        redisplay();
      })
    );
  if (typeof page.status === "function") {
    let status = "";
    try {
      status = page.status(plugin) || "";
    } catch (e) {
      status = "The data for this tool could not be read right now.";
    }
    if (status) new Setting(containerEl).setName("Current data").setDesc(status);
  }
  for (const field of page.fields || []) renderField(containerEl, field, plugin);
  if (page.note) {
    containerEl.createEl("p", { cls: "setting-item-description", text: page.note });
  }
  if (page.open) {
    new Setting(containerEl)
      .setName("Open the tool")
      .setDesc("The same view is available from its ribbon entry and command.")
      .addButton((b) => b.setButtonText(page.open.label).onClick(() => page.open.run(plugin)));
  }
}

module.exports = {
  STUDY_TOOL_SETTINGS_BY_ID,
  STUDY_TOOL_SETTINGS_MODULES,
  renderStudyToolSettings,
};
