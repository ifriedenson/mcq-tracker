"use strict";
const { DEFAULT_REFERENCE_SETTINGS } = require("./reference-data");
const { DEFAULT_ASSIGNMENT_SETTINGS } = require("./assignments");
const { DEFAULT_SUPPORT } = require("./support");
const { DEFAULT_AI_LIMITS } = require("./ai-service");
const { DEFAULT_THINK_FIRST_SECONDS } = require("./think-first");
const { DEFAULT_HISTORY_LIMIT } = require("./history");

const VIEW_TYPE = "question-tracker-view";
const VIEW_TYPE_TODAY = "question-tracker-today";
const VIEW_TYPE_CALENDAR = "question-tracker-calendar";
const VIEW_TYPE_CARDS = "question-tracker-cards";
const VIEW_TYPE_REFERENCE = "question-tracker-reference";
const VIEW_TYPE_ASSIGNMENTS = "question-tracker-assignments";
const VIEW_TYPE_STUDY_TOOLS = "question-tracker-study-tools";
const VIEW_TYPE_STUDY_WORKSPACE = "question-tracker-study-workspace";
const VIEW_TYPE_REVIEW_CALENDAR = "question-tracker-review-calendar";
const VIEW_TYPE_STUDY_STATS = "question-tracker-study-stats";
const VIEW_TYPE_LOCAL_EVENTS = "question-tracker-local-events";
const VIEW_TYPE_POMODORO = "question-tracker-pomodoro";
const VIEW_TYPE_TASK_LIST = "question-tracker-task-list";

const FILTER_FIELDS = [
  ["folder", "Folder"], // not a property: comes from where the note is saved, and includes sub folders
  ["course", "Course"],
  ["test", "Test"],
  ["section", "Section"],
  ["domain", "Domain"],
  ["skill", "Skill"],
  ["unit", "Unit"],
  ["difficulty", "Difficulty"],
  ["last_error_type", "Error type"],
];

const MODES = [
  ["smart", "Smart mix (weighted)"],
  ["adaptive", "Adaptive mastery"],
  ["due", "Due for review"],
  ["unseen", "Never attempted"],
  ["missed", "Missed last time"],
  ["cram", "Cram: most-missed first"],
  ["flagged", "Flagged"],
  ["random", "Pure random"],
];

const DEFAULT_SETTINGS = {
  mcqEnabled: true, // the MCQ Tracker module (practice, weak spots, timed tests, import); turned off in Settings, Global
  showRibbonIcons: true, // show the plugin's ribbon buttons
  openPracticeOnStartUp: false, // open the practice view when the workspace is ready
  support: { ...DEFAULT_SUPPORT }, // optional feedback/donation links; never automatic, never gating
  questionFolder: "",
  intervals: [1, 3, 7, 21, 60],
  scheduler: "ladder", // "ladder" (default) | "fsrs"
  fsrsRetention: 0.9, // desired recall probability when FSRS is on (0.85-0.95)
  errorTypes: ["careless", "content gap", "misread", "ran out of time", "guessed", "setup error", "algebra/arithmetic slip", "unit error", "sign error", "wrong formula"],
  confidenceLabels: ["Guessing", "Unsure", "Confident"],
  knownDays: 14, // default snooze length for the Known button
  historyLimit: DEFAULT_HISTORY_LIMIT, // newest review rows kept per note (100-5000)
  knownDaysByCourse: {}, // optional course-specific snooze overrides
  studyPlanDays: 30, // how far ahead studyPlans() looks for exams (1-365)
  dueQueue: { dailyCap: 0 }, // 0 = no cap; otherwise hold overflow for another day
  leechThreshold: 0, // consecutive misses that flag a leech; 0 turns leech handling off
  leechAction: "flag", // "flag" keeps it in rotation | "suspend" also hides it until restored
  needsFixing: false, // opt-in: flag questions missed on five distinct days for repair
  autoPauseOnMobile: true,
  distractionFreePractice: true, // mobile only: hide Obsidian chrome while a question/result is active
  explanationDefault: "wrong", // "show" | "wrong" (only after a miss) | "hide"
  closedBook: false, // opt-in: hide the Open note shortcut until the current question is submitted
  hints: false, // opt-in: show a question's optional Hint section before answering
  examReady: false, // opt-in: mark a question after N consecutive correct answers
  examReadyPasses: 2, // consecutive correct answers for the exam-ready badge (Omniscient's default)
  inlineQuizResults: false, // opt-in: export mcq-quiz scores to the note under quizResults
  inlineQuizReorder: false, // opt-in: reorder questions in mcq-quiz blocks
  inlineQuizNumeric: false, // opt-in: typed numeric questions in mcq-quiz blocks
  inlineQuizSharedChoice: false, // opt-in: one option set reused by several mcq-quiz questions
  examBlockMode: "study", // exam fenced blocks: "study" shows the key, "answer" grades a click
  ai: {
    enabled: false, // nothing is ever sent anywhere until you turn this on
    managed: true, // plugin sets up, starts and stops OpenCode itself (downloads it the first time, after you confirm)
    preStart: false, // start OpenCode in the background when Obsidian opens, so the first chat doesn't wait
    binaryPath: "", // optional: use this opencode program instead
    managedBinary: "",
    installedVersion: "",
    url: "http://127.0.0.1:4096", // only used when managed is off
    username: "opencode",
    password: "",
    passwordSecret: "",
    rememberPassword: false, // older Obsidian only: opt in before a manual password enters data.json
    model: "",
    agent: "",
    mode: "tutor",
    agentShell: false, // Agent mode: shell commands stay off unless explicitly enabled
    reviewAgentEdits: true, // agent mode: pause file edits and show a diff before applying them
    tutorRole: "private", // "private" | "socratic" | "language"
    thinkFirst: false, // opt-in: block chat sends until a short in-session countdown ends
    thinkFirstSeconds: DEFAULT_THINK_FIRST_SECONDS, // 5-120; a conservative default, configurable in AI settings
    context: { stats: false, due: false, exams: false }, // read-only aggregate context sent only when a toggle is on
    verification: "mark", // after AI writes an answer: "mark" mismatches for review, or "drop" them
    sessionId: "",
    autoDeclined: false, // the user said no to the automatic OpenCode download: don't ask again until they press the button
    backend: "api", // desktop choice: "api" (default) or "opencode". Phones always use "api".
    api: { provider: "anthropic", baseUrl: "", model: "claude-sonnet-5-5", models: [], keys: {} },
    features: {}, // per-feature model overrides, filled by normalizeAiService
    limits: { ...DEFAULT_AI_LIMITS }, // one reply cap, optional daily and per-run request caps
  },
  presets: [],
  importFolder: "",
  importDefaults: {},
  importOptions: { capture: true, pagePics: false },
  filters: {},
  moreSets: [], // extra filter sets, OR'd with `filters`
  mode: "smart",
  practicePath: "", // when set, practice is limited to this note (Practice this note only)
  studySkin: "off", // "off" | "flip" | "choice": an extra way to review the same MCQ notes
  activePreset: "",
  folderFilterStyle: "auto", // "auto" (search box when there are many folders) | "buttons" | "search"
  testDefaults: { count: 10, minutes: 12, from: 1, to: 0, frq: 0, shuffleChoices: false, passScore: 0 }, // passScore 0 means no pass mark
  testSession: null, // a timed test in progress, so it survives closing Obsidian
  testBlueprints: [], // saved timed-test recipes: { name, count, minutes, from, to, mode, sections }
  quickDefaults: { count: 5, minutes: 5 },
  quickAdaptive: { enabled: false, useRecommended: true, minMinutes: 2, maxMinutes: 15, minCount: 3, maxCount: 20, lookbackDays: 21 },
  quickSession: null, // a Quick Practice queue in progress, so it survives closing Obsidian
  studyLog: { sessions: [], dailyGoalMinutes: 60, lastCourse: "" }, // focus sessions and manual study time
  masteryScope: "", // Insights > Progress: the course whose mastery is shown; "" means all questions
  masteryDays: 0, // Insights > Progress: 0 = all time, 7 or 30 = only attempts from that window
  reminder: { enabled: false, osNotifications: false, hour: 9, lastShown: "", dismissed: "" }, // local, once-a-day nudge; OS delivery is opt-in
  dailyQuiz: {
    enabled: false, // opt-in; no command, card or notifications until it is on
    count: 5,
    folders: [],
    freezeEnabled: false, // opt-in: earned freezes can cover a missed day
    freezeEvery: 5, // completed daily quizzes per earned freeze
    freezes: 0,
    completions: 0,
    lastDate: "",
    paths: [],
    streak: 0,
    best: 0,
    lastCompleted: "",
  },
  simpleQuiz: {
    stats: { days: {}, streak: 0, best: 0, lastCompleted: "" },
  },
  simpleNoteQuiz: {
    questionMark: "?", // a line ending with this becomes a question
    separator: "blank", // "blank" (blank line) | "bullet" (next unindented bullet)
    shuffle: false, // shuffle the selected questions for this session
  },
  reading: { progress: {} }, // reading-plan progress keyed by plan id; local only
  tagTimers: { timers: {}, sessions: [] }, // local tag-timer state and completed sessions
  cornellNotes: { enabled: true }, // independent local Cornell-note module
  lectureLog: { enabled: true, lectures: [] }, // independent local lecture-log module
  studyGoals: { enabled: true, goals: [] }, // independent local study-goal module
  feynmanLearning: { enabled: true, sessions: [] }, // independent guided Feynman-cycle module
  recallScheduler: { enabled: true, mode: "headings", folder: "", limit: 20, reviews: {} }, // heading/fragment recall queue
  lerntracker: { enabled: true, plans: [] }, // topic-pass planner with exam buffer days
  studyFlow: { enabled: true, excerpts: [] }, // source excerpt -> understanding -> card draft inbox
  subjectManager: { enabled: true, subjects: [], absences: [] }, // subjects and absence log
  quizIndex: { enabled: true, folder: "", limit: 50 }, // cross-vault quiz dashboard/index
  quizMaker: { enabled: true }, // Quiz Maker block: four formats and named packs
  satMath: { enabled: true }, // SAT Math block: local step-by-step solver, no score estimate
  cardArchive: { enabled: true, folder: "Archive" }, // portable JSON card archive export/import
  studyNudge: { enabled: false, hour: 9, quietFrom: 22, quietTo: 7, ribbonLabel: true, lastShown: "" }, // opt-in in-app nudge
  courseTemplates: { enabled: true, folder: "Courses", templates: [] }, // Course Command Center note-type/template mapping
  schedulerFit: { enabled: true, minSamples: 20 }, // LearnKit/Qard-style desired-retention self-fitting from card review counters
  studyMap: { enabled: true, terms: 8, depth: 4 }, // Spaceforge-style local outline/mind-map and key-term map
  vaultSearch: { enabled: true, limit: 5 }, // Gemini Helper/LLM Hub-style cited local vault search, no model call
  sfcCards: { enabled: true }, // SFC-style typed card block: seven card types, read-only
  cbtExam: { enabled: true, history: {} }, // CBT exam navigator, local sidecar history and adaptive review
  courseHub: { enabled: true, grades: [] }, // course dashboard and local grade chips
  studyTasks: { enabled: true, tasks: [] }, // manual and generated exam tasks with local reminders
  timeBlocks: { enabled: false }, // opt-in local time-block planner; off by default
  citations: { enabled: false }, // opt-in local BibTeX citation library; off by default
  annotations: { enabled: true, annotations: [] }, // selection Q&A and annotation index
  deepNotes: { enabled: true, sessions: [] }, // guided Socratic sessions
  retention: { enabled: true }, // read-only card forecast
  vocabulary: { enabled: true, words: [] }, // local dictionary and per-word review ladder
  readingLibrary: { enabled: true, hideFinished: false, books: [] }, // local bookshelf, page progress and captured quotes
  writingSession: { path: "", startedAt: 0, baseline: 0, sessions: [] }, // read-only writing-session count; only session times are stored
  readAloud: { enabled: true, style: "full", rate: 1, pitch: 1, voice: "" }, // device speech synthesis, local only
  lectureCompiler: { enabled: true, folder: "Lecture notes", includeOverview: true, includeConcepts: true, includeVocabulary: true, includeSections: true }, // compile the lecture log into one study note
  courseHealth: { enabled: true, attendanceThreshold: 75, examWindowDays: 14, minSessions: 3 }, // local course health checks
  audioBookmarks: { enabled: true, entries: [] }, // timestamp bookmarks and chapters for audio attachments
  feynmanAi: { enabled: true }, // optional AI second opinion on a completed Feynman explanation (uses the existing AI settings)
  pdfAnnotationIndex: { enabled: true, folder: "", limit: 200 }, // read-only index of PDF annotation sidecars
  reference: Object.assign({}, DEFAULT_REFERENCE_SETTINGS), // optional local formula sheet and unit converter
  assignments: Object.assign({}, DEFAULT_ASSIGNMENT_SETTINGS, {
    categories: DEFAULT_ASSIGNMENT_SETTINGS.categories.map((category) => ({ ...category })),
    courses: [],
  }),
  noteReview: { enabled: false, limit: 20, sets: [] }, // optional whole-note review queue
  noteReviewDock: { enabled: true, keyboard: true, lapseThreshold: 8, requeueEnabled: true, requeueLimit: 3, gradeLayout: "auto", reportEnabled: false, reportFolder: "" }, // docked whole-note review bar
  reviewCalendar: { enabled: true, noteMinutes: 2, cardMinutes: 1, showCards: true, detectMainNote: true, weekStartsOn: "monday" }, // due-date calendar and workload
  studyStats: { enabled: true, leechThreshold: 5, maxRows: 200, durableRecall: true, durableDays: 2, heatmapWeeks: 12 }, // Anki-style statistics and two-day durability
  studyCounters: { version: 1, days: {}, updated: "" }, // permanent per-day counters; survive history trimming
  pomodoro: { enabled: true, workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4, autoStartBreaks: false, autoStartWork: false, state: { phase: "work", remainingSec: 1500, running: false, startedAt: 0, workSessions: 0, completed: 0, skipped: 0, lastCompleted: "" } }, // independent focus timer
  localEvents: { enabled: true, defaultCategory: "study", weekStartsOn: "monday", events: [] }, // local-only event calendar
  spacedEverything: {
    enabled: false, // optional whole-note SM-2 queue, separate from standard note review
    defaultInterval: 1,
    defaultEase: 2.5,
    captureFolder: "",
    titleTemplate: "Inbox {{date}} {{time}}",
    noteTemplate: "## Captured thought\n{{thought}}",
  },
  cardGenerator: { count: 8, customPrompt: "", style: "inline", separator: "::", hideInPreview: false, output: "notes", source: "auto", deck: "" }, // last flashcard-generator choices
  autoAnki: { count: 8, deck: "" }, // Auto Anki: AI card creation sent through the existing Anki bridge
  text2anki: { count: 5, deck: "", customPrompt: "" }, // Text2Anki: one-shot selection to Anki through the same card store
  quizGenerator: { folders: [], count: 5, language: "English", types: ["mcq"] }, // last AI quiz-generator choices
  cards: {
    enabled: false, // cards and vocabulary are opt-in; nothing else changes when this is off
    newCardFolder: "Cards", // where new cards go when their deck has no folder
    defaultDeck: "General",
    reviewLimit: 20,
    order: "due", // "due" (due + new) | "all"
    answerMode: "flip", // "flip" | "type" | "speak" (speak uses the text box with OS dictation)
    revealAnimation: "instant", // "instant" | "fade" | "flip": optional answer reveal presentation
    gradingStrictness: "standard", // "strict" | "standard" | "lenient"
    aiGrading: false, // optional AI second opinion when the local typed-answer grader is unsure
    sameDayReviews: false, // optional: Again/Hard cards stay due today for another session
    adaptiveFrequency: false, // optional: a known-card streak lengthens simple-ladder intervals
    fileExplorerDue: false, // optional: due/new markers on card files in the file explorer
    decks: [], // [{ name, folder, course, answerMode, gradingStrictness }]
    csvMappings: {}, // header-signature -> column mapping remembered by the generic CSV importer
    ankiConnect: {
      enabled: false,
      url: "http://127.0.0.1:8765",
      deck: "",
      vaultTags: "",
      backlinks: false,
      contentAuthority: "two-way",
      excludeTags: "",
      excludeDecks: "",
      excludeFolders: "",
      omitRegex: "",
      clearMissing: false,
      excalidraw: { enabled: false, folder: "" },
    }, // optional local AnkiConnect push; off by default
    plainMarkdown: { enabled: false, folder: "" }, // optional Yanki-style plain Markdown cards; off by default
  },
};

// Tracking properties every question note should have.
const TRACKING_DEFAULTS = {
  result: "unknown",
  "date attempted": "",
  first_attempted: "",
  attempts: 0,
  correct_count: 0,
  streak: 0,
  time_spent_total: 0,
  last_time_spent: 0,
  last_answer: "",
  last_confidence: "",
  last_error_type: "",
  flagged: false,
  next_review: "",
  srs: "", // compact FSRS state; written only when FSRS schedules a review
  history: [],
};
const FOLDER_AUTO_MAX = 8; // "auto" folder filter: buttons up to this many folders, a search box beyond
const STAT_FIELDS = [
  ["skill", "Skill"],
  ["domain", "Domain"],
  ["difficulty", "Difficulty"],
  ["folder", "Folder"],
];

module.exports = {
  VIEW_TYPE,
  VIEW_TYPE_TODAY,
  VIEW_TYPE_CALENDAR,
  VIEW_TYPE_CARDS,
  VIEW_TYPE_REFERENCE,
  VIEW_TYPE_ASSIGNMENTS,
  VIEW_TYPE_STUDY_TOOLS,
  VIEW_TYPE_STUDY_WORKSPACE,
  VIEW_TYPE_REVIEW_CALENDAR,
  VIEW_TYPE_STUDY_STATS,
  VIEW_TYPE_LOCAL_EVENTS,
  VIEW_TYPE_POMODORO,
  VIEW_TYPE_TASK_LIST,
  FILTER_FIELDS,
  MODES,
  DEFAULT_SETTINGS,
  TRACKING_DEFAULTS,
  FOLDER_AUTO_MAX,
  STAT_FIELDS,
};
