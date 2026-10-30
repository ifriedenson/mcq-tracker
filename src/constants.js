"use strict";
const { DEFAULT_REFERENCE_SETTINGS } = require("./reference-data");
const { DEFAULT_ASSIGNMENT_SETTINGS } = require("./assignments");
const { DEFAULT_SUPPORT } = require("./support");
const { DEFAULT_AI_LIMITS } = require("./ai-service");

const VIEW_TYPE = "question-tracker-view";
const VIEW_TYPE_TODAY = "question-tracker-today";
const VIEW_TYPE_CALENDAR = "question-tracker-calendar";
const VIEW_TYPE_CARDS = "question-tracker-cards";
const VIEW_TYPE_REFERENCE = "question-tracker-reference";
const VIEW_TYPE_ASSIGNMENTS = "question-tracker-assignments";

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
  ["adaptive", "Adaptive difficulty"],
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
  errorTypes: ["careless", "content gap", "misread", "ran out of time", "guessed"],
  confidenceLabels: ["Guessing", "Unsure", "Confident"],
  knownDays: 14, // default snooze length for the Known button
  knownDaysByCourse: {}, // optional course-specific snooze overrides
  leechThreshold: 0, // consecutive misses that flag a leech; 0 turns leech handling off
  leechAction: "flag", // "flag" keeps it in rotation | "suspend" also hides it until restored
  autoPauseOnMobile: true,
  explanationDefault: "wrong", // "show" | "wrong" (only after a miss) | "hide"
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
    model: "",
    agent: "",
    mode: "tutor",
    reviewAgentEdits: true, // agent mode: pause file edits and show a diff before applying them
    tutorRole: "private", // "private" | "socratic" | "language"
    context: { stats: false, due: false, exams: false }, // read-only aggregate context sent only when a toggle is on
    verification: "mark", // after AI writes an answer: "mark" mismatches for review, or "drop" them
    sessionId: "",
    autoDeclined: false, // the user said no to the automatic OpenCode download: don't ask again until they press the button
    backend: "api", // desktop choice: "api" (default) or "opencode". Phones always use "api".
    api: { provider: "anthropic", baseUrl: "", model: "claude-sonnet-5-5", keys: {} },
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
  reminder: { enabled: false, hour: 9, lastShown: "", dismissed: "" }, // local, once-a-day in-app nudge
  dailyQuiz: {
    enabled: false, // opt-in; no command, card or notifications until it is on
    count: 5,
    folders: [],
    lastDate: "",
    paths: [],
    streak: 0,
    best: 0,
    lastCompleted: "",
  },
  reference: Object.assign({}, DEFAULT_REFERENCE_SETTINGS), // optional local formula sheet and unit converter
  assignments: Object.assign({}, DEFAULT_ASSIGNMENT_SETTINGS, {
    categories: DEFAULT_ASSIGNMENT_SETTINGS.categories.map((category) => ({ ...category })),
    courses: [],
  }),
  noteReview: { enabled: false, limit: 20, sets: [] }, // optional whole-note review queue
  cardGenerator: { count: 8, customPrompt: "", style: "inline", separator: "::", hideInPreview: false, output: "notes", source: "auto", deck: "" }, // last flashcard-generator choices
  quizGenerator: { folders: [], count: 5, language: "English", types: ["mcq"] }, // last AI quiz-generator choices
  cards: {
    enabled: false, // cards and vocabulary are opt-in; nothing else changes when this is off
    newCardFolder: "Cards", // where new cards go when their deck has no folder
    defaultDeck: "General",
    reviewLimit: 20,
    order: "due", // "due" (due + new) | "all"
    answerMode: "flip", // "flip" | "type" | "speak" (speak uses the text box with OS dictation)
    gradingStrictness: "standard", // "strict" | "standard" | "lenient"
    aiGrading: false, // optional AI second opinion when the local typed-answer grader is unsure
    decks: [], // [{ name, folder, course, answerMode, gradingStrictness }]
    csvMappings: {}, // header-signature -> column mapping remembered by the generic CSV importer
    ankiConnect: { enabled: false, url: "http://127.0.0.1:8765", deck: "" }, // optional local AnkiConnect push; off by default
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
  FILTER_FIELDS,
  MODES,
  DEFAULT_SETTINGS,
  TRACKING_DEFAULTS,
  FOLDER_AUTO_MAX,
  STAT_FIELDS,
};
