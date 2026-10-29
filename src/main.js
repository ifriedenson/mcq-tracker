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
const { buildReportMarkdown, cacheIssues, finalizeNote, groupIssues, noteIssues, parseNote } = require("./importer");
const { fmtDate, fmtDateTime } = require("./util");
const { adaptiveTargetRank, adaptiveWeight, cloneFilters, filterOptionCounts, filterOptions, findDuplicateIds, folderChain, folderLabel, hasFilters, indexOfficialIds, isDue, matchFilters, matchSets, officialIdOf, pickQuestion, renameFolderInSettings, renameFolderPath, weightOf } = require("./filters");
const { answerFromSection, applyAttempt, extractRationale, fillDefaults, gradeAnswer, parseSections, replaceMyNotes, setLastErrorType } = require("./notes");
const fsrs = require("./fsrs");
const { OpenCodeClient, buildGeneralContext, buildTutorContext, friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { PracticeView } = require("./practice-view");
const { ApiClient, apiTurns, friendlyApiError } = require("./api-client");
const { ChatPanel } = require("./chat-panel");
const tutorPresets = require("./tutor-presets");
const { MAX_OPENCODE_MAJOR, OpenCodeManager, candidateAssetNames, chooseRelease, downloadFile, extractArchive, findBinaryIn, mergeAuth, opencodeMajor, platformTriple } = require("./opencode-manager");
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
const { CardView } = require("./cards-view");
const { CardModal } = require("./card-modal");
const cardsImport = require("./cards-import");
const cardsExtract = require("./cards-extract");
const { CardExtractModal } = require("./cards-extract-modal");
const cardGrading = require("./card-grading");
const cardGradingAi = require("./card-grading-ai");
const cardGradeQueue = require("./card-grade-queue");
const { buildDueQueue, DueQueueModal } = require("./due-queue");
const studyStatus = require("./study-status");
const studySkin = require("./study-skin");
const { StudyStatusModal } = require("./study-status-modal");
const { renderSettingsTabs } = require("./settings-ui");
const { FindQuestionModal, FolderFilterSuggest, QuestionFolderModal } = require("./modals");
const { PdfImportModal } = require("./import-modal");
const { QUICK_START_URL, aiReady, emptyState, hasValidQuestion, scanQuestionNotes } = require("./empty-state");
const { loadQuestionData } = require("./view-helpers");
const offline = require("./offline");
const documents = require("./documents");
const calendarIcs = require("./calendar-ics");
const calendarModel = require("./calendar-model");
const calendarNotes = require("./calendar-notes");
const { CalendarView, StudySlotModal, parseScheduleBlock } = require("./calendar-view");
const { QUICK_TIME_OPTIONS, QUICK_COUNT_OPTIONS, buildQuickQueue, createQuickSession, packQuickSession, pauseQuickSession, quickRemainingSeconds, resumeQuickSession, unpackQuickSession } = require("./quick-practice");
const referenceData = require("./reference-data");
const pdfAnnotations = require("./pdf-annotations");
const { PdfAnnotationModal } = require("./pdf-annotation-modal");
const welcome = require("./welcome");
const focus = require("./focus");
const studyPlan = require("./study-plan");
const analytics = require("./analytics");
const analyticsEmbed = require("./analytics-embed");
const { FocusLogModal } = require("./focus-modal");
const { WelcomeModal } = require("./welcome-modal");
const referenceElements = require("./reference-elements");
const referenceGraph = require("./reference-graph");
const { ReferenceView } = require("./reference-view");
const { REFERENCE_TABS, renderReferenceSettings } = require("./reference-settings");
const dailyQuiz = require("./daily-quiz");
const { renderDailySettings } = require("./daily-quiz-settings");
const provenance = require("./provenance");
const transcript = require("./transcript");
const { TranscriptPracticeModal } = require("./transcript-modal");

module.exports = QuestionTrackerPlugin;
QuestionTrackerPlugin.__test = {
  finalizeNote,
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
  OpenCodeManager,
  MAX_OPENCODE_MAJOR,
  opencodeMajor,
  platformTriple,
  candidateAssetNames,
  chooseRelease,
  mergeAuth,
  downloadFile,
  extractArchive,
  findBinaryIn,
  replaceMyNotes,
  gradeAnswer,
  applyAttempt,
  fsrs,
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
  pdfAnnotations,
  PdfAnnotationModal,
  welcome,
  WelcomeModal,
  focus,
  studyPlan,
  analytics,
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
  AssignmentsView,
  AssignmentModal,
  renderAssignmentsSettings,
  CALENDAR_TABS,
  cards,
  cardsImport,
  cardsExtract,
  CardExtractModal,
  cardGrading,
  cardGradingAi,
  cardGradeQueue,
  buildDueQueue,
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
  documents,
  QUICK_START_URL,
  aiReady,
  emptyState,
  hasValidQuestion,
  scanQuestionNotes,
  loadQuestionData,
  offline,
  weekStart,
  weeklyAccuracy,
  trendBy,
  trendDelta,
  packTestSession,
  unpackTestSession,
  dailyQuiz,
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
  CalendarView,
  StudySlotModal,
  parseScheduleBlock,
};
