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
const { OpenCodeClient, buildGeneralContext, buildTutorContext, friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { PracticeView } = require("./practice-view");
const { ApiClient, apiTurns, friendlyApiError } = require("./api-client");
const { ChatPanel } = require("./chat-panel");
const { MAX_OPENCODE_MAJOR, OpenCodeManager, candidateAssetNames, chooseRelease, downloadFile, extractArchive, findBinaryIn, mergeAuth, opencodeMajor, platformTriple } = require("./opencode-manager");
const { buildTestSet, computeStats, errorLog, fmtPct, overallStats, packTestSession, parseHistory, statVals, suggestMinutes, trendBy, trendDelta, unpackTestSession, weakestRow, weekStart, weeklyAccuracy } = require("./stats");
const { InsightsView } = require("./insights-view");
const { TestView } = require("./exam-view");
const { QuestionTrackerSettingTab } = require("./settings-tab");
const { FindQuestionModal, FolderFilterSuggest, QuestionFolderModal } = require("./modals");
const { PdfImportModal } = require("./import-modal");
const { QUICK_START_URL, aiReady, emptyState, hasValidQuestion, scanQuestionNotes } = require("./empty-state");
const { loadQuestionData } = require("./view-helpers");
const calendarIcs = require("./calendar-ics");
const calendarModel = require("./calendar-model");
const calendarNotes = require("./calendar-notes");
const { CalendarView, parseScheduleBlock } = require("./calendar-view");
const { QUICK_TIME_OPTIONS, QUICK_COUNT_OPTIONS, buildQuickQueue, createQuickSession, packQuickSession, pauseQuickSession, quickRemainingSeconds, resumeQuickSession, unpackQuickSession } = require("./quick-practice");

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
  QuestionTrackerSettingTab,
  FolderFilterSuggest,
  QuestionFolderModal,
  FindQuestionModal,
  PdfImportModal,
  QUICK_START_URL,
  aiReady,
  emptyState,
  hasValidQuestion,
  scanQuestionNotes,
  loadQuestionData,
  weekStart,
  weeklyAccuracy,
  trendBy,
  trendDelta,
  packTestSession,
  unpackTestSession,
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
  parseScheduleBlock,
};
