"use strict";
/*
 * MCQ Tracker - Obsidian plugin (plain JS, desktop + mobile).
 * Works on notes that have a `question_id` property. All data lives in each
 * note's properties; the plugin's own data.json only stores settings, presets
 * and the running timer.
 *
 * This is the entry point. The plugin is written as small modules in src/ and
 * bundled into the single main.js that Obsidian loads by scripts/build.js.
 */
const { QuestionTrackerPlugin } = require("./plugin");
const { API_SYSTEM, buildReportMarkdown, cacheIssues, finalizeNote, groupIssues, noteIssues, parseNote } = require("./importer");
const { fmtDate, fmtDateTime } = require("./util");
const { adaptiveTargetRank, adaptiveWeight, cloneFilters, filterOptionCounts, filterOptions, findDuplicateIds, folderChain, folderLabel, hasFilters, indexOfficialIds, isDue, matchFilters, matchSets, officialIdOf, pickQuestion, renameFolderInSettings, renameFolderPath, weightOf } = require("./filters");
const { answerFromSection,
  answerSetFromSection,
  answerTrueFalseFromSection,
  applyAttempt, applySkip, extractRationale, fillDefaults, findAnswerKey, gradeAnswer, inferMode, parseSections, replaceMyNotes, setLastErrorType } = require("./notes");
const numericGrading = require("./numeric-grading");
const answerTypes = require("./answer-types");
const matching = require("./matching");
const mochiExport = require("./mochi-export");
const apkgExport = require("./apkg-export");
const learnkit = require("./learnkit");
const survey = require("./survey");
const parameterized = require("./parameterized");
const fsrs = require("./fsrs");
const sm2 = require("./sm2");
const { OpenCodeClient, buildGeneralContext, buildTutorContext, friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { PracticeView } = require("./practice-view");
const { ApiClient, apiTurns, friendlyApiError } = require("./api-client");
const { ChatPanel } = require("./chat-panel");
const tutorPresets = require("./tutor-presets");
const aiContext = require("./ai-context");
const aiService = require("./ai-service");
const aiTools = require("./ai-tools");
const mathRendering = require("./math-rendering");
const smiles = require("./smiles");
const noteContext = require("./note-context");
const aiWriteGuard = require("./ai-write-guard");
const cardWriteDiff = require("./card-write-diff");
const agentWriteGuard = require("./agent-write-guard");
const agentEditReview = require("./agent-edit-review");
const { AgentEditReviewModal } = require("./agent-edit-review-modal");
const { CalculationPreviewModal } = require("./calculation-preview-modal");
const secretKeys = require("./secret-keys");
const urlSafety = require("./url-safety");
const svgSafety = require("./svg-safety");
const fileExplorer = require("./file-explorer");
const history = require("./history");
const testSections = require("./exam-sections");
const aiWrites = require("./ai-writes");
const weakSpot = require("./weak-spot");
const answerVerification = require("./answer-verification");
const computedVerification = require("./computed-verification");
const figures = require("./figures");
const calculator = require("./calculator");
const { WeakSpotModal } = require("./weak-spot-modal");
const { QuickAddModal } = require("./quick-add-modal");
const quickAdd = require("./quick-add");
const quizBlock = require("./quiz-block");
const sourceRecall = require("./source-recall");
const noteReview = require("./note-review");
const spacedEverything = require("./spaced-everything");
const { NoteReviewModal } = require("./note-review-modal");
const { SpacedEverythingCaptureModal } = require("./spaced-everything-modal");
const quizGenerator = require("./quiz-generator");
const cardGenerator = require("./card-generator");
const spacedQuiz = require("./spaced-quiz");
const autoAnki = require("./auto-anki");
const text2anki = require("./text2anki");
const { AutoAnkiModal } = require("./auto-anki-modal");
const studyBundle = require("./study-bundle");
const studyBundleImport = require("./study-bundle-import");
const zipWrite = require("./zip-write");
const { MAX_OPENCODE_MAJOR, OpenCodeManager, assertExtractedTree, candidateAssetNames, chooseRelease, downloadFile, extractArchive, findBinaryIn, mergeAuth, opencodeMajor, platformTriple } = require("./opencode-manager");
const { buildTestSet, computeStats, errorLog, fmtPct, overallStats, packTestSession, parseHistory, sliceQuestionRange, statVals, suggestMinutes, trendBy, trendDelta, unpackTestSession, weakestRow, weekStart, weeklyAccuracy } = require("./stats");
const { InsightsView } = require("./insights-view");
const { TestView } = require("./exam-view");
const { TodayView } = require("./today-view");
const { ASSIGNMENTS_TABS, CARDS_TABS, GLOBAL_TABS, MCQ_TABS, QuestionTrackerSettingTab, SETTINGS_MODULES } = require("./settings-tab");
const assignments = require("./assignments");
const { AssignmentsView } = require("./assignments-view");
const { AssignmentModal } = require("./assignments-modal");
const { renderAssignmentsSettings } = require("./assignments-settings");
const { CALENDAR_TABS } = require("./calendar-settings");
const cards = require("./cards");
const plainCards = require("./plain-cards");
const { CardView } = require("./cards-view");
const { CardModal, cardPreview } = require("./card-modal");
const couchdbSync = require("./couchdb-sync");
const cardsImport = require("./cards-import");
const ankiConnect = require("./anki-connect");
const apkg = require("./apkg");
const cardsExtract = require("./cards-extract");
const { CardExtractModal } = require("./cards-extract-modal");
const cardGrading = require("./card-grading");
const cardGradingAi = require("./card-grading-ai");
const cardGradeQueue = require("./card-grade-queue");
const { buildDueQueue, DueQueueModal } = require("./due-queue");
const { MixedReviewModal, buildMixedQueue, mixedQuestionAttempt } = require("./mixed-review");
const studyStatus = require("./study-status");
const studySkin = require("./study-skin");
const { StudyStatusModal } = require("./study-status-modal");
const { renderSettingsTabs } = require("./settings-ui");
const { FindQuestionModal, FolderFilterSuggest, QuestionFolderModal } = require("./modals");
const { PdfImportModal } = require("./import-modal");
const courseNotes = require("./course-notes");
const paperScanner = require("./paper-scanner");
const documentClassify = require("./document-classify");
const conceptMastery = require("./concept-mastery");
const qtiArchive = require("./qti-archive");
const { DocumentReviewModal } = require("./document-review-modal");
const ocr = require("./ocr");
const { OcrModal } = require("./ocr-modal");
const { QUICK_START_URL, aiReady, emptyState, hasValidQuestion, scanQuestionNotes } = require("./empty-state");
const { isExamReady, loadQuestionData, normalizeExamReadyPasses, renderMarkdownInto } = require("./view-helpers");
const offline = require("./offline");
const documents = require("./documents");
const calendarIcs = require("./calendar-ics");
const calendarModel = require("./calendar-model");
const calendarNotes = require("./calendar-notes");
const calendarInterop = require("./calendar-interop");
const { CalendarView, StudySlotModal, parseScheduleBlock } = require("./calendar-view");
const { QUICK_TIME_OPTIONS, QUICK_COUNT_OPTIONS, buildQuickQueue, createQuickSession, packQuickSession, pauseQuickSession, quickRemainingSeconds, resumeQuickSession, unpackQuickSession } = require("./quick-practice");
const referenceData = require("./reference-data");
const pdfAnnotations = require("./pdf-annotations");
const pdfInk = require("./pdf-ink");
const { PdfAnnotationModal } = require("./pdf-annotation-modal");
const { PdfInkModal } = require("./pdf-ink-modal");
const welcome = require("./welcome");
const focus = require("./focus");
const studyPlan = require("./study-plan");
const analytics = require("./analytics");
const analyticsEmbed = require("./analytics-embed");
const progress = require("./progress");
const { FocusLogModal } = require("./focus-modal");
const { WelcomeModal } = require("./welcome-modal");
const referenceElements = require("./reference-elements");
const referenceGraph = require("./reference-graph");
const { ReferenceView } = require("./reference-view");
const apScore = require("./ap-score");
const apResources = require("./ap-resources");
const apExamHistory = require("./ap-exam-history");
const frq = require("./frq");
const referenceSheets = require("./reference-sheets");
const handwriting = require("./handwriting");
const { FrqGraderModal, NewFrqNoteModal } = require("./frq-modal");
const { StudyMatchModal } = require("./study-match-modal");
const apResourceNotes = require("./ap-resource-notes");
const apExamResources = require("./ap-exam-resources");
const { REFERENCE_TABS, renderReferenceSettings } = require("./reference-settings");
const dailyQuiz = require("./daily-quiz");
const simpleQuiz = require("./simple-quiz");
const simpleNoteQuiz = require("./simple-note-quiz");
const { SimpleNoteQuizModal } = require("./simple-note-quiz-modal");
const adaptiveSession = require("./adaptive-session");
const reminder = require("./reminder");
const { renderDailySettings } = require("./daily-quiz-settings");
const provenance = require("./provenance");
const transcript = require("./transcript");
const { TranscriptPracticeModal } = require("./transcript-modal");
const resultsExport = require("./results-export");
const support = require("./support");

module.exports = QuestionTrackerPlugin;
QuestionTrackerPlugin.__test = {
  finalizeNote,
  API_SYSTEM,
  parseNote,
  fmtDate,
  fmtDateTime,
  isDue,
  weightOf,
  adaptiveWeight,
  adaptiveTargetRank,
  matchFilters,
  filterOptions,
  matchSets,
  folderChain,
  folderLabel,
  pickQuestion,
  parseSections,
  extractRationale,
  answerFromSection,
  answerSetFromSection,
  answerTrueFalseFromSection,
  findAnswerKey,
  inferMode,
  modelFromString,
  friendlyError,
  partsToTurns,
  buildTutorContext,
  buildGeneralContext,
  PracticeView,
  OpenCodeClient,
  ApiClient,
  friendlyApiError,
  apiTurns,
  ChatPanel,
  tutorPresets,
  aiContext,
  aiService,
  aiTools,
  mathRendering,
  smiles,
  renderMarkdownInto,
  loadQuestionData,
  noteContext,
  aiWriteGuard,
  cardWriteDiff,
  agentWriteGuard,
  agentEditReview,
  AgentEditReviewModal,
  CalculationPreviewModal,
  secretKeys,
  urlSafety,
  svgSafety,
  fileExplorer,
  history,
  testSections,
  aiWrites,
  weakSpot,
  answerVerification,
  computedVerification,
  figures,
  calculator,
  WeakSpotModal,
  QuickAddModal,
  quickAdd,
  quizBlock,
  sourceRecall,
  couchdbSync,
  cardPreview,
  noteReview,
  spacedEverything,
  NoteReviewModal,
  SpacedEverythingCaptureModal,
  quizGenerator,
  cardGenerator,
  spacedQuiz,
  autoAnki,
  AutoAnkiModal,
  text2anki,
  studyBundle,
  studyBundleImport,
  zipWrite,
  OpenCodeManager,
  MAX_OPENCODE_MAJOR,
  opencodeMajor,
  platformTriple,
  candidateAssetNames,
  chooseRelease,
  mergeAuth,
  downloadFile,
  extractArchive,
  assertExtractedTree,
  findBinaryIn,
  replaceMyNotes,
  gradeAnswer,
  gradeAnswerDetailed: numericGrading.gradeAnswerDetailed,
  numericGrading,
  answerTypes,
  matching,
  mochiExport,
  apkgExport,
  learnkit,
  survey,
  parameterized,
  applyAttempt,
  applySkip,
  fsrs,
  sm2,
  setLastErrorType,
  fillDefaults,
  // folders, ids, stats, errors, tests, import checks
  filterOptionCounts,
  renameFolderPath,
  renameFolderInSettings,
  officialIdOf,
  indexOfficialIds,
  findDuplicateIds,
  statVals,
  computeStats,
  weakestRow,
  overallStats,
  parseHistory,
  errorLog,
  buildTestSet,
  sliceQuestionRange,
  suggestMinutes,
  noteIssues,
  cacheIssues,
  groupIssues,
  buildReportMarkdown,
  fmtPct,
  cloneFilters,
  hasFilters,
  InsightsView,
  TestView,
  TodayView,
  QuestionTrackerSettingTab,
  SETTINGS_MODULES,
  GLOBAL_TABS,
  MCQ_TABS,
  ASSIGNMENTS_TABS,
  CARDS_TABS,
  REFERENCE_TABS,
  renderReferenceSettings,
  referenceData,
  apScore,
  apResources,
  apExamHistory,
  frq,
  handwriting,
  referenceSheets,
  FrqGraderModal,
  NewFrqNoteModal,
  StudyMatchModal,
  apResourceNotes,
  apExamResources,
  pdfAnnotations,
  pdfInk,
  PdfAnnotationModal,
  PdfInkModal,
  welcome,
  WelcomeModal,
  focus,
  studyPlan,
  analytics,
  progress,
  buildProgress: progress.buildProgress,
  buildMastery: progress.buildMastery,
  buildMasteryTrend: progress.buildMasteryTrend,
  masteryTrendText: progress.masteryTrendText,
  masteryBandOf: progress.masteryBandOf,
  masteryWindowDays: progress.masteryWindowDays,
  masteryScopes: progress.masteryScopes,
  scopeQuestions: progress.scopeQuestions,
  bandQuestions: progress.bandQuestions,
  buildWeeks: progress.buildWeeks,
  buildMomentum: progress.buildMomentum,
  buildCourses: progress.buildCourses,
  buildDashboard: analytics.buildDashboard,
  buildHeatmap: analytics.buildHeatmap,
  buildCalibration: analytics.buildCalibration,
  buildRetention: analytics.buildRetention,
  buildGradeSnapshot: analytics.buildGradeSnapshot,
  gradeLetter: analytics.gradeLetter,
  activityLevel: analytics.activityLevel,
  analyticsEmbed,
  parseDashboardBlock: analyticsEmbed.parseDashboardBlock,
  renderDashboardEmbed: analyticsEmbed.renderDashboardEmbed,
  FocusLogModal,
  referenceElements,
  referenceGraph,
  ReferenceView,
  assignments,
  provenance,
  transcript,
  TranscriptPracticeModal,
  resultsExport,
  support,
  AssignmentsView,
  AssignmentModal,
  renderAssignmentsSettings,
  CALENDAR_TABS,
  cards,
  plainCards,
  cardsImport,
  pdf: require("./pdf"),
  ankiConnect,
  apkg,
  cardsExtract,
  CardExtractModal,
  cardGrading,
  cardGradingAi,
  cardGradeQueue,
  buildDueQueue,
  buildMixedQueue,
  mixedQuestionAttempt,
  MixedReviewModal,
  DueQueueModal,
  studyStatus,
  studySkin,
  StudyStatusModal,
  CardView,
  CardModal,
  renderSettingsTabs,
  FolderFilterSuggest,
  QuestionFolderModal,
  FindQuestionModal,
  PdfImportModal,
  courseNotes,
  paperScanner,
  documentClassify,
  conceptMastery,
  qtiArchive,
  DocumentReviewModal,
  ocr,
  OcrModal,
  documents,
  QUICK_START_URL,
  aiReady,
  emptyState,
  hasValidQuestion,
  scanQuestionNotes,
  loadQuestionData,
  isExamReady,
  normalizeExamReadyPasses,
  offline,
  weekStart,
  weeklyAccuracy,
  trendBy,
  trendDelta,
  packTestSession,
  unpackTestSession,
  dailyQuiz,
  simpleQuiz,
  simpleNoteQuiz,
  SimpleNoteQuizModal,
  adaptiveSession,
  reminder,
  renderDailySettings,
  QUICK_TIME_OPTIONS,
  QUICK_COUNT_OPTIONS,
  buildQuickQueue,
  createQuickSession,
  packQuickSession,
  pauseQuickSession,
  unpackQuickSession,
  quickRemainingSeconds,
  resumeQuickSession,
  // calendar module
  calendarIcs,
  calendarModel,
  calendarNotes,
  calendarInterop,
  CalendarView,
  StudySlotModal,
  parseScheduleBlock,
};
