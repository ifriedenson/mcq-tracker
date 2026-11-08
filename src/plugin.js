"use strict";
const { normalizeExamReadyPasses, renderMarkdownInto } = require("./view-helpers");
const { Modal, Notice, Platform, Plugin, TFile, TFolder, requestUrl, stringifyYaml } = require("obsidian");
const { OpenCodeManager } = require("./opencode-manager");
const { DEFAULT_SETTINGS, FILTER_FIELDS, FOLDER_AUTO_MAX, VIEW_TYPE, VIEW_TYPE_TODAY, VIEW_TYPE_CALENDAR, VIEW_TYPE_CARDS, VIEW_TYPE_REFERENCE, VIEW_TYPE_ASSIGNMENTS, VIEW_TYPE_STUDY_TOOLS, VIEW_TYPE_STUDY_WORKSPACE, VIEW_TYPE_REVIEW_CALENDAR, VIEW_TYPE_STUDY_STATS, VIEW_TYPE_LOCAL_EVENTS, VIEW_TYPE_POMODORO, VIEW_TYPE_TASK_LIST, VIEW_TYPE_WEB_BROWSER, VIEW_TYPE_AGENT } = require("./constants");
const { PracticeView } = require("./practice-view");
const { parseQuickPracticeUri } = require("./quick-practice");
const practiceFullscreen = require("./practice-fullscreen");
const { InsightsView, VIEW_TYPE_INSIGHTS } = require("./insights-view");
const knowledgeRecord = require("./knowledge-record");
const knowledgeStore = require("./knowledge-store");
const { TestView, VIEW_TYPE_TEST } = require("./exam-view");
const { TodayView } = require("./today-view");
const { ConfirmModal, FindQuestionModal, NameModal, QuestionFolderModal } = require("./modals");
const { cloneFilters, fvals, hasFilters, isDue, matchSets, renameFolderInSettings } = require("./filters");
const { QuestionTrackerSettingTab } = require("./settings-tab");
const { AssignmentsView } = require("./assignments-view");
const { StudyToolsView } = require("./study-tools-view");
const { StudyWorkspaceView } = require("./study-workspace-view");
const { TaskListView } = require("./task-list-view");
const studyWorkspace = require("./study-workspace");
const timeBlocks = require("./time-blocks");
const webBrowser = require("./web-browser");
const canvasMarkdown = require("./canvas-markdown");
const fsrsTrain = require("./fsrs-train");
const mindmap = require("./mindmap");
const pdfDeepLink = require("./pdf-deep-link");
const pdfBacklinks = require("./pdf-backlinks");
const pdfPlus = require("./pdf-plus");
const pdfLatex = require("./pdf-latex");
const epub = require("./epub");
const epubAnnotations = require("./epub-annotations");
const { EpubReaderModal } = require("./epub-reader-modal");
const serviceImport = require("./service-import");
const canvasMap = require("./canvas-map");
const canvasKanban = require("./canvas-kanban");
const { KanbanReportModal } = require("./canvas-kanban-view");
const canvasAutoLink = require("./canvas-auto-link");
const { LinkReportModal } = require("./canvas-auto-link-view");
const canvasPresentations = require("./canvas-presentations");
const { PresentationModal, PresentationPlanModal } = require("./canvas-presentations-view");
const canvasQuery = require("./canvas-query");
const { QueryGroupsModal } = require("./canvas-query-view");
const { WebBrowserView } = require("./web-browser-view");
const calendarPlanner = require("./calendar-planner");
const citations = require("./citations");
const courseIdentity = require("./course-identity");
const exams = require("./exams");
const { courseOverview } = require("./course-overview");
const { ExamModal } = require("./exam-modal");
const { CourseOverviewModal } = require("./course-overview-modal");
const readAloud = require("./read-aloud");
const lectureCompiler = require("./lecture-compiler");
const audioBookmarks = require("./audio-bookmarks");
const readingLibrary = require("./reading-library");
const courseHealth = require("./course-health");
const feynmanAi = require("./feynman-ai");
const pdfAnnotationIndex = require("./pdf-annotation-index");
const readingCompanion = require("./reading-companion");
const vaultTaskIndex = require("./vault-task-index");
const taskTags = require("./task-tags");
const glossary = require("./glossary");
const wordnet = require("./wordnet");
const tableEditor = require("./table-editor");
const { TableControlsView } = require("./table-controls-view");
const { TableCsvModal } = require("./table-csv-modal");
const { VIEW_TYPE_TABLE_CONTROLS } = require("./constants");

class TimeBlocksTourModal extends Modal {
  constructor(app, steps, onOpenDay) {
    super(app);
    this.steps = steps;
    this.onOpenDay = onOpenDay;
    this.index = 0;
  }

  onOpen() {
    this.renderStep();
  }

  renderStep() {
    const step = this.steps[this.index];
    const el = this.contentEl;
    el.textContent = "";
    el.createEl("h2", { text: step.title });
    el.createEl("p", { text: step.body });
    el.createEl("div", { cls: "qt-hint", text: "Step " + (this.index + 1) + " of " + this.steps.length });
    const row = el.createDiv({ cls: "qt-row qt-study-actions" });
    if (this.index > 0) row.createEl("button", { text: "Back" }).addEventListener("click", () => { this.index -= 1; this.renderStep(); });
    if (this.index < this.steps.length - 1) {
      row.createEl("button", { text: "Next", cls: "mod-cta" }).addEventListener("click", () => { this.index += 1; this.renderStep(); });
    } else {
      row.createEl("button", { text: "Open Day view", cls: "mod-cta" }).addEventListener("click", () => { this.close(); if (this.onOpenDay) this.onOpenDay(); });
    }
  }
}

/** Command-palette entries mirroring the Advanced Tables plugin. */
const TABLE_COMMANDS = [
  { id: "tables-next-cell", name: "Tables: go to the next cell", action: "next-cell" },
  { id: "tables-previous-cell", name: "Tables: go to the previous cell", action: "previous-cell" },
  { id: "tables-next-row", name: "Tables: go to the next row", action: "next-row" },
  { id: "tables-escape", name: "Tables: move the cursor out of the table", action: "escape" },
  { id: "tables-format", name: "Tables: format the table under the cursor", action: "format" },
  { id: "tables-insert-row-above", name: "Tables: insert a row above", action: "insert-row-above" },
  { id: "tables-insert-row-below", name: "Tables: insert a row below", action: "insert-row-below" },
  { id: "tables-insert-column-left", name: "Tables: insert a column to the left", action: "insert-column-left" },
  { id: "tables-insert-column-right", name: "Tables: insert a column to the right", action: "insert-column-right" },
  { id: "tables-delete-row", name: "Tables: delete the row", action: "delete-row" },
  { id: "tables-delete-column", name: "Tables: delete the column", action: "delete-column" },
  { id: "tables-move-row-up", name: "Tables: move the row up", action: "move-row-up" },
  { id: "tables-move-row-down", name: "Tables: move the row down", action: "move-row-down" },
  { id: "tables-move-column-left", name: "Tables: move the column left", action: "move-column-left" },
  { id: "tables-move-column-right", name: "Tables: move the column right", action: "move-column-right" },
  { id: "tables-align-left", name: "Tables: align the column left", action: "align-left" },
  { id: "tables-align-center", name: "Tables: align the column center", action: "align-center" },
  { id: "tables-align-right", name: "Tables: align the column right", action: "align-right" },
  { id: "tables-align-default", name: "Tables: clear the column alignment", action: "align-default" },
  { id: "tables-sort-asc", name: "Tables: sort rows ascending", action: "sort-asc" },
  { id: "tables-sort-desc", name: "Tables: sort rows descending", action: "sort-desc" },
  { id: "tables-transpose", name: "Tables: transpose", action: "transpose" },
  { id: "tables-formulas", name: "Tables: evaluate formulas", action: "formulas" },
  { id: "tables-export-csv", name: "Tables: export as CSV", action: "export-csv" },
];

const writingSessions = require("./writing-sessions");
const voiceMemo = require("./voice-memo");
const { buildCornellNote } = require("./cornell");
const { renderCornellBlock } = require("./cornell-view");
const studyTools = require("./study-tools");
const { AssignmentModal } = require("./assignments-modal");
const { assignmentId, assignmentMarkdown, assignmentStats, categoryFor, estimateMinutes, isAssignmentNote, normalizeAssignmentSettings, normalizeStatus, parseAssignment, safeName, typeId, uniquePath, updateTaskCheckbox, updateTaskDue, updateTaskEstimate, updateTaskTitle } = require("./assignments");
const { OpenCodeClient, modelFromString, partsToTurns } = require("./opencode-client");
const { ApiClient } = require("./api-client");
const modelDiscovery = require("./model-discovery");
const { normalizeThinkFirstSeconds } = require("./think-first");
const readingModel = require("./reading");
const { normalizeReadingSettings } = readingModel;
const { normalizeTagTimerSettings, stopRunningTagTimers } = require("./tag-timer");
const { normalizeTallySettings } = require("./tally");
const { renderTallyBlock } = require("./tally-view");
const { normalizeTextTimerSettings } = require("./text-timer");
const { renderTextTimerBlock } = require("./text-timer-view");
const { sleep, hashString, localDate, ensureFolder, str } = require("./util");
const diagnostics = require("./diagnostics");
const chatSkills = require("./chat-skills");
const chatPricing = require("./chat-pricing");
const chatMemory = require("./chat-memory");
const { ChatMemoryModal } = require("./chat-memory-modal");
const { PdfImportModal } = require("./import-modal");
const { readPdfPages, renderPdfPagesAsPng } = require("./pdf");
const { CourseNotesModal, removeAiSummary } = require("./course-notes");
const { DocumentReviewModal } = require("./document-review-modal");
const { OcrModal } = require("./ocr-modal");
const { PaperScannerModal } = require("./paper-scanner");
const { PdfAnnotationModal } = require("./pdf-annotation-modal");
const { PdfInkModal } = require("./pdf-ink-modal");
const { PdfEditorModal } = require("./pdf-editor-modal");
const { editedPathFor } = require("./pdf-editor");
const { annotationLink, annotationSummary, annotationsMarkdown, normalizeTags, parseAnnotationFile, sidecarPathFor, upsertAnnotation, removeAnnotation } = require("./pdf-annotations");
const { WelcomeModal } = require("./welcome-modal");
const { FocusLogModal } = require("./focus-modal");
const { FOCUS_STORAGE_KEY, addStudySession, elapsedFocusMs, finishFocus, normalizeStudyLog, pauseFocus, resumeFocus, startFocus, studySummary } = require("./focus");
const { WELCOME_PRESETS, welcomeShouldShow } = require("./welcome");
const { applyAttempt, applySkip, fillDefaults, findAnswerKey, parseSections, replaceMyNotes, setAttemptError, setLastErrorType } = require("./notes");
const { parseChoiceSet } = require("./answer-types");
const { addVerificationBanner, buildBlindVerificationPrompt, normalizeVerificationMode, parseBlindVerification, parseBlindVerificationNumber, parseBlindVerificationSet, verificationFields } = require("./answer-verification");
const { computedVerification } = require("./computed-verification");
const { renderSmilesSvg } = require("./smiles");
const { renderBiologyDiagram, renderChemistryDiagram, renderCircuitDiagram } = require("./stem-diagrams");
const { allowedWriteRoots, assertAllowedWritePath, assertProtectedUnchanged } = require("./ai-write-guard");
const agentWriteGuard = require("./agent-write-guard");
const agentEditReview = require("./agent-edit-review");
const { CalculationPreviewModal } = require("./calculation-preview-modal");
const { CalendarImportModal, CalendarView, StudySlotModal, applyCalendarWidth, parseScheduleBlock, renderDaySection } = require("./calendar-view");
const { applyTermWeeks, cleanSubjectTitle, eventKey, examMatchesCourse, examReviewCap, findRegisteredCourse, isExamEvent, mergeCalendarSettings, nextClassStatus, normalizeFolder, subjectKey, upcomingExams, visibleEvents } = require("./calendar-model");
const { buildStudyPlan, normalizeStudyPlanDays } = require("./study-plan");
const { buildDashboard, courseMatches } = require("./analytics");
const { bandQuestions, buildMastery, buildMasteryTrend, buildProgress, masteryScopes, masteryWindowDays, scopeQuestions } = require("./progress");
const { parseDashboardBlock, renderDashboardEmbed } = require("./analytics-embed");
const { dateKey, deriveSourceLabel, expandIcs, exportIcs, icsLooksValid, normalizeCalendarUrl, parseIcs } = require("./calendar-ics");
const { addResourceLink, classNoteIndex, findClassNote, openOrCreateClassNote, vaultFolders } = require("./calendar-notes");
const { fullCalendarNotes } = require("./calendar-interop");
const { cloneFrontmatter, enqueuePending, newAttemptId, packPendingAttempts, removePending, unpackAttempt, unpackPendingAttempts, updatePendingError } = require("./offline");
const { CardView } = require("./cards-view");
const { ReferenceView } = require("./reference-view");
const { mergeReferenceSettings } = require("./reference-data");
const { AP_EXAM_FOLDER, buildApExamNote, entryFromFrontmatter, sortApExamEntries, uniqueApExamPath } = require("./ap-exam-history");
const { attachFrontmatter, attachStudySlotFrontmatter, buildApResourceNote, detachFrontmatter, detachStudySlotFrontmatter, entryFromFrontmatter: resourceNoteEntry, findApResourceNote, markCheckedFrontmatter, sortApResourceNotes, uniqueApResourcePath } = require("./ap-resource-notes");
const { HANDWRITING_SYSTEM, cleanHandwritingText, handwritingPrompt } = require("./handwriting");
const { FRQ_ATTEMPT_FOLDER, FRQ_FOLDER, buildFrqAttemptNote, buildFrqNote, entryFromAttemptFrontmatter, frqCriterionWeakSpots, frqKnowledge, frqReviewEntry, frqReviewQueue, gradeFrqWithAi, isFrqNote, parseFrqNote, sortFrqAttempts, sourceFrontmatterUpdate, uniqueNotePath } = require("./frq");
const { FrqGraderModal, NewFrqNoteModal } = require("./frq-modal");
const { FrqImportPreviewModal, FrqPdfPickerModal } = require("./frq-import-modal");
const { splitFrqItems } = require("./frq-import");
const { CardModal } = require("./card-modal");
const { ImageOcclusionModal } = require("./image-occlusion-modal");
const { CardExportModal, CardImportModal, cardsToAnki, cardsToQuestionSet, cardsToQuizlet, parseAnkiText, parseCrowdAnkiJson, parseGenericCsv, parseFlashQuizText, parseGiftText, parseMarkdownQuiz, parseMarkdownTable, parseMochiMarkdown, parseMoodleXml, parseQtiXml, parseQuestionSetText, parseQuizPortJson, parseQuizletPdf, parseQuizletText, parseSpacedRepetition } = require("./cards-import");
const { CardExtractModal } = require("./cards-extract-modal");
const { DocumentCardsModal } = require("./document-cards");
const { buildMochiArchive, cardsToMochiDecks, mochiMediaWarning } = require("./mochi-export");
const { cardsToLearnKit, parseLearnKit } = require("./learnkit");
const { AnkiConnectModal, AnkiConnectClient, ankiExclusionReason, buildAnkiNotes, localSyncRecord, normalizeAnkiConnect, remoteSyncRecord, resolveSyncAction, syncDecision, syncHash } = require("./anki-connect");
const { COUCHDB_PASSWORD_SECRET, CouchDbClient, applyCardSyncState, cardSyncState, errorMessage: couchErrorMessage, mergeCardSyncStates, normalizeCouchDb, sameState, stateTimestamp } = require("./couchdb-sync");
const { parseApkg } = require("./apkg");
const { buildApkg, apkgMediaWarning } = require("./apkg-export");
const { parseQtiArchive } = require("./qti-archive");
const { extractCardsFromMarkdown, flashcardsFlag } = require("./cards-extract");
const { cardAttempt, cardNote, cardQueue, courseForFolder, deckConfig, deckOf, deckSummary, effectiveFsrsRetention, isCardNote, schedulerForDeck, mergeCardSettings, parseCardBody, parseMaskRows, resolveCard } = require("./cards");
const { inferPlainCard, isPlainPath, normalizePlainCards } = require("./plain-cards");
const { cardUpdateDiff } = require("./card-write-diff");
const { DueQueueModal, buildDueQueue, normalizeDailyCap } = require("./due-queue");
const { MixedReviewModal, buildMixedQueue } = require("./mixed-review");
const { isStudyable, setStudyStatus: updateStudyStatus, restoreStudyStatus: applyStudyStatusSnapshot, studyStatusSummary, statusOf, normalizeCourseDays, knownDaysForCourse } = require("./study-status");
const { STUDY_SKIN_LABELS, normalizeStudySkin, studySkinEnabled } = require("./study-skin");
const { StudyStatusModal } = require("./study-status-modal");
const { gradeWithAi } = require("./card-grading-ai");
const { MAX_PENDING, MAX_GRADE_BATCH, enqueuePendingGrade, newGradeId, packPendingGrades, removePendingGrade, unpackPendingGrades } = require("./card-grade-queue");
const { completeDailyQuiz: recordDailyCompletion, dailyDone, normalizeDailyQuiz, pickDailyQuiz } = require("./daily-quiz");
const { adaptiveDailyCount, normalizeQuickAdaptive } = require("./adaptive-session");
const { dismissReminder, markReminderShown, normalizeReminder, reminderState: computeReminderState } = require("./reminder");
const { requestOsPermission, showReminderNotification } = require("./os-notifications");
const { extractSimpleQuizBlocks, legacyQuizJsNotice, normalizeSimpleQuiz, parseSimpleQuizCards, parseSimpleQuizOptions, recordSimpleQuizSession, simpleQuizChartSeries, simpleQuizDaySummary } = require("./simple-quiz");
const { renderQuizPortBlock } = require("./quizport-view");
const { renderSimpleFlashcardsBlock } = require("./simple-flashcards-view");
const { renderReadingPlanBlock } = require("./reading-view");
const { renderTagTimerBlock } = require("./tag-timer-view");
const { applySimpleNoteQuizMarks, clearSimpleNoteQuizMarks, normalizeSimpleNoteQuiz, parseSimpleNoteQuiz } = require("./simple-note-quiz");
const { SimpleNoteQuizModal } = require("./simple-note-quiz-modal");
const { normalizeTutorRole } = require("./tutor-presets");
const { normalizeAiContext } = require("./ai-context");
const aiService = require("./ai-service");
const aiTools = require("./ai-tools");
const { AI_WRITE_STORAGE_KEY, appendAiWrite, latestAiWrite, makeAiWriteRecord, normalizeAiWrites } = require("./ai-writes");
const { findSourceFile, sourceOf } = require("./provenance");
const { buildTranscriptCardPrompt, buildTranscriptQuestionPrompt, isTranscriptNote, parseAiCards, parseAiQuestions, questionNote, safeFileName, transcriptInfo } = require("./transcript");
const { TranscriptPracticeModal } = require("./transcript-modal");
const { WeakSpotModal } = require("./weak-spot-modal");
const { QuickAddModal } = require("./quick-add-modal");
const { QuickAskModal } = require("./quick-ask-modal");
const { QuickChatModal } = require("./quick-chat-modal");
const chatBookmarks = require("./chat-bookmarks");
const studyCommands = require("./study-commands");
const { quickAddNote, quickAddTitle } = require("./quick-add");
const { noteQuizToQuickAdd } = require("./quiz-clipboard");
const { findQuizBlockSource, gradeNumericQuestion, gradeQuizBlockQuestion, gradeQuizQuestion, gradeReorderQuestion, parseQuizAiEvaluation, parseQuizBlock, quizBlockScore, quizResultProperties, visibleQuizCount } = require("./quiz-block");
const quizNoteGate = require("./quiz-note-gate");
const { parseExamBlock } = require("./exam-block");
const { normalizeQuizMakerSettings, renderQuizMakerBlock: renderQuizMaker } = require("./quiz-maker");
const { normalizeSatMathSettings, renderSatMathBlock: renderSatMath } = require("./sat-math");
const { normalizeSfcCardsSettings, renderSfcCardsBlock: renderSfcCards } = require("./sfc-cards");
const { normalizeCbtExamSettings, renderCbtExamBlock: renderCbtExam } = require("./cbt-exam");
const { CardArchiveImportModal, archiveFileName, buildCardArchive, mergeCardArchive, normalizeCardArchiveSettings, parseCardArchive } = require("./card-archive");
const { markNudgeShown, normalizeStudyNudgeSettings, nudgeState: computeNudgeState } = require("./study-nudge");
const { CourseTemplateModal, normalizeCourseTemplates, renderCourseNote } = require("./course-templates");
const { collectReviewRecords, fitRetention, normalizeSchedulerFitSettings } = require("./scheduler-fit");
const fsrsFit = require("./fsrs-fit");
const { normalizeStudyMapSettings, renderStudyMapBlock: renderStudyMap } = require("./study-map");
const { normalizeVaultSearchSettings, renderVaultSearchBlock: renderVaultSearch } = require("./vault-search");
const { buildSourceRecall, findQuoteRange } = require("./source-recall");
const { buildNoteQueue, normalizeNoteReview, normalizePriority, noteReviewAttempt } = require("./note-review");
const { NoteReviewModal } = require("./note-review-modal");
const reviewCalendar = require("./review-calendar");
const studyStats = require("./study-stats");
const snapshotCache = require("./snapshot-cache");
const quizDedup = require("./quiz-dedup");
const localEvents = require("./local-events");
const noteReviewDock = require("./note-review-dock");
const sessionReport = require("./session-report");
const { NoteReviewDock } = require("./note-review-dock");
const satCallout = require("./sat-callout");
const { ReviewCalendarView } = require("./review-calendar-view");
const { StudyStatsView } = require("./study-stats-view");
const { LocalEventModal, LocalEventsView } = require("./local-events-view");
const reviewSession = require("./review-session");
const durability = require("./durability");
const studyCounters = require("./study-counters");
const pomodoro = require("./pomodoro");
const { PomodoroView } = require("./pomodoro-view");
const { applySpacedReview, buildSpacedQueue, normalizeSpacedEverything, renderSpacedTemplate, spacedCaptureText } = require("./spaced-everything");
const { SpacedEverythingCaptureModal } = require("./spaced-everything-modal");
const { CardGeneratorModal } = require("./card-generator-modal");
const { AutoAnkiModal } = require("./auto-anki-modal");
const { autoAnkiBatchPaths, autoAnkiCardInputs, autoAnkiSourceKey, chooseAutoAnkiSource, normalizeAutoAnki } = require("./auto-anki");
const { chooseText2AnkiSource, normalizeText2Anki, text2AnkiNotice } = require("./text2anki");
const { appendPrefix, buildCardBlock, buildCardGeneratorPrompt, normalizeCardGenerator, verifyCardDrafts } = require("./card-generator");
const { buildSpacedQuizNote, spacedQuizFileName, spacedQuizSourceKey } = require("./spaced-quiz");
const { readActiveNoteContext } = require("./note-context");
const { QuizGeneratorModal } = require("./quiz-generator-modal");
const { buildQuizGeneratorPrompt, collectGeneratorSources, folderMatches, normalizeQuizGenerator, parseGeneratorQuestions } = require("./quiz-generator");
const { buildStudyBundle, bundleFileName } = require("./study-bundle");
const { parseStudyBundle, planStudyBundleRestore } = require("./study-bundle-import");
const { buildWeakSpotPrompt, pickWeakSpot, weakSpotRows } = require("./weak-spot");
const { buildAttemptsCsv, buildPracticeSheet, buildResultsCsv, buildReviewSheet, practiceSheetFileName, resultFileNames, reviewSheetFileName } = require("./results-export");
const { normalizeSupport } = require("./support");
const secretKeys = require("./secret-keys");
const { calendarText, safeCalendarFeedUrl } = require("./url-safety");
const { safeSvg } = require("./svg-safety");
const fileExplorer = require("./file-explorer");
const { NEEDS_FIXING_DAYS, hasAttemptId, markNeedsFixingFixed, normalizeHistoryLimit, repairHistoryCounters } = require("./history");
const { checkDistractorQuality } = require("./distractor-quality");
const { normalizeBlueprint, normalizePassScore } = require("./exam-sections");

function noteBodyText(text) {
  const close = str(text).indexOf("\n---\n", 3);
  return close >= 0 ? str(text).slice(close + 5) : str(text);
}

function noteNotesSection(body) {
  const lines = str(body).split("\n");
  const start = lines.findIndex((line) => /^##\s+Notes\b/i.test(line));
  if (start < 0) return "";
  const out = [];
  for (let i = start; i < lines.length; i++) {
    if (i > start && /^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trimEnd().replace(/^(##\s+Notes\b)[ \t]*\n?/i, "$1\n\n");
}

class QuestionTrackerPlugin extends Plugin {
  async onload() {
    // A previous plugin instance or a crash may have left the body class behind.
    practiceFullscreen.setPracticeFullscreen(null, false);
    this.pdfPlus = null;
    this._pdfPlusSettingsView = null;
    this.settingsTab = null;
    this.pdfPlusError = "";
    this.pdfPlusPaused = false;
    this.pdfPlusUiDepth = 0;
    this._pdfPlusQueue = Promise.resolve();
    await this.loadSettings();
    this.knowledgeRecord = knowledgeRecord.emptyRecord();
    this._knowledgeRecordLoaded = false;
    this._knowledgeRecordBuild = null;
    this._knowledgeRecordSaveTimer = null;
    this._knowledgeRecordRefreshTimer = null;
    this._knowledgeRecordRefreshPaths = new Set();
    this._knowledgeRecordRebuildTimer = null;
    this.plainCardIndex = new Map();
    this._calendarNoteIndex = null;
    this._calendarFolders = null;
    this._calendarCache = null;
    this._dataVersion = 0;
    this._snapshots = snapshotCache.createSnapshotCache({ limit: 12 });
    this._pendingCardGradeFlush = null;
    this._aiRun = { startedAt: 0, requests: 0 };
    this.agentEditUndo = null;
    this.wordNetIndex = null;
    this.wordNetLoadedAt = 0;
    this._tableEditQueue = Promise.resolve();

    // The timer is kept per device (not in the synced settings). One that was running when the
    // app closed becomes paused, counting only up to the last heartbeat (time away isn't counted).
    this.session = this.readSession();
    this.focus = this.readFocus();
    const s = this.session;
    if (s && s.runningSince) {
      s.elapsedMs += Math.max(0, (s.lastBeat || s.runningSince) - s.runningSince);
      s.runningSince = null;
      this.writeSession();
    }

    this.manager = new OpenCodeManager(this);
    this.app.workspace.onLayoutReady(() => {
      this.startPdfPlus().catch(() => {});
      this.startDeferredStartup();
      this.loadKnowledgeRecord().catch(() => {});
      if (welcomeShouldShow(this.app)) activeWindow.setTimeout(() => this.openWelcome(), 1200);
      const ai = this.settings.ai;
      if (Platform.isDesktopApp && ai.enabled && ai.managed && ai.preStart && this.backend() === "opencode") {
        this.manager.ensure(() => {}).catch(() => {}); // quiet: errors show when you actually use the chat
      }
      if (this.settings.openPracticeOnStartUp && this.mcqEnabled()) this.activateView().catch(() => {});
      this.decorateFileExplorer();
      this.flushPendingAttempts().then((r) => {
        if (r.sent) new Notice(`Saved ${r.sent} practice result${r.sent === 1 ? "" : "s"} that were waiting offline.`, 5000);
      }).catch(() => {});
      if (this.readPendingCardGrades().length && (this.backend() === "api" || (this.manager && this.manager.conn))) {
        this.flushPendingCardGrades()
          .then((r) => {
            if (r.graded) new Notice(`Graded ${r.graded} typed answer${r.graded === 1 ? "" : "s"} that were waiting for AI.`, 5000);
          })
          .catch(() => {});
      }
    });
    this.registerDomEvent(window, "beforeunload", () => this.manager.stop());
    this.registerView(VIEW_TYPE, (leaf) => new PracticeView(leaf, this));
    this.registerView(VIEW_TYPE_TODAY, (leaf) => new TodayView(leaf, this));
    this.registerView(VIEW_TYPE_INSIGHTS, (leaf) => new InsightsView(leaf, this));
    this.registerView(VIEW_TYPE_TEST, (leaf) => new TestView(leaf, this));
    this.registerView(VIEW_TYPE_CALENDAR, (leaf) => new CalendarView(leaf, this));
    this.registerView(VIEW_TYPE_CARDS, (leaf) => new CardView(leaf, this));
    this.registerView(VIEW_TYPE_REFERENCE, (leaf) => new ReferenceView(leaf, this));
    this.registerView(VIEW_TYPE_ASSIGNMENTS, (leaf) => new AssignmentsView(leaf, this));
    this.registerView(VIEW_TYPE_STUDY_TOOLS, (leaf) => new StudyToolsView(leaf, this));
    this.registerView(VIEW_TYPE_STUDY_WORKSPACE, (leaf) => new StudyWorkspaceView(leaf, this));
    this.registerView(VIEW_TYPE_REVIEW_CALENDAR, (leaf) => new ReviewCalendarView(leaf, this));
    this.registerView(VIEW_TYPE_STUDY_STATS, (leaf) => new StudyStatsView(leaf, this));
    this.registerView(VIEW_TYPE_LOCAL_EVENTS, (leaf) => new LocalEventsView(leaf, this));
    this.registerView(VIEW_TYPE_POMODORO, (leaf) => new PomodoroView(leaf, this));
    this.registerView(VIEW_TYPE_TASK_LIST, (leaf) => new TaskListView(leaf, this));
    this.registerView(VIEW_TYPE_WEB_BROWSER, (leaf) => new WebBrowserView(leaf, this));
    const { AgentView: StudyAgentView } = require("./agent-view");
    this.registerView(VIEW_TYPE_AGENT, (leaf) => new StudyAgentView(leaf, this));
    this.registerView(VIEW_TYPE_TABLE_CONTROLS, (leaf) => new TableControlsView(leaf, this));
    if (this.tableEditorSettings().enabled && this.tableEditorSettings().showRibbon) {
      this._tableRibbon = this.addRibbonIcon("table", "Advanced Tables: controls", () => this.openTableControls());
    }
    this.noteReviewDock = new NoteReviewDock(this);
    this._quickChatModal = null;
    this.recentDiagnosticErrors = [];
    // Chat bookmark links are handled by this plugin, not a hosted redirect.
    if (typeof this.registerObsidianProtocolHandler === "function") {
      this.registerObsidianProtocolHandler("mcq-tracker-chat", (params) => this.openChatBookmark(params));
      this.registerObsidianProtocolHandler("mcq-tracker-quick", (params) => {
        this.openQuickPracticeLink(params).catch((error) => {
          new Notice(`Quick Practice link failed: ${error && error.message ? error.message : "unknown error"}.`);
        });
      });
    }
    if (typeof this.registerMarkdownPostProcessor === "function") {
      this.registerMarkdownPostProcessor((el) => satCallout.syncSatCallouts(el));
      this.registerMarkdownPostProcessor((el, ctx) => this.decorateTableEditor(el, ctx));
    }
    if (typeof activeDocument !== "undefined" && activeDocument) {
      this.registerDomEvent(activeDocument, "click", (event) => {
        const target = event && event.target;
        const callout = target && typeof target.closest === "function" ? target.closest(satCallout.SAT_SELECTOR) : null;
        if (!callout) return;
        setTimeout(() => satCallout.syncSatCallout(callout), 0);
      });
    }
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.refreshNoteReviewDock();
        this.syncPracticeFullscreen();
      })
    );
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncPracticeFullscreen()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refreshNoteReviewDock()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.refreshNoteReviewDock()));
    if (typeof activeDocument !== "undefined" && activeDocument) {
      this.registerDomEvent(activeDocument, "keydown", (event) => this.noteReviewDock.onKey(event));
      this.registerDomEvent(activeDocument, "keydown", (event) => this.onTableEditorKeydown(event), true);
    }
    this.ribbonButtons = {};
    this.ribbonAdded = {};
    this.refreshRibbon();

    this.addCommand({ id: "open-practice-view", name: "Open practice view", callback: () => this.activateView() });
    this.addCommand({ id: "open-welcome", name: "Open welcome guide", callback: () => this.openWelcome() });
    this.addCommand({ id: "focus-start", name: "Focus: start a 25-minute session", callback: () => this.startFocusSession(25, this.settings.studyLog.lastCourse) });
    this.addCommand({ id: "tag-timer-stop-all", name: "Tag Timer: stop all running timers", callback: () => this.stopAllTagTimers() });
    this.addCommand({ id: "focus-log", name: "Focus: log study time", callback: () => this.openFocusLog() });
    this.addCommand({ id: "study-plan", name: "Study plan: start for the next exam", callback: () => this.startNextExamPlan() });
    this.addCommand({ id: "open-dashboard", name: "Open analytics dashboard", callback: () => this.activateInsights("overview") });
    this.addCommand({ id: "open-progress", name: "Open progress dashboard", callback: () => this.activateInsights("progress") });
    this.addCommand({ id: "export-results-csv", name: "Export practice results to CSV", callback: () => this.exportResultsCsv() });
    this.addCommand({ id: "export-practice-sheet", name: "Export an answer-free practice sheet", callback: () => this.exportPracticeSheet() });
    this.addCommand({ id: "export-review-sheet", name: "Export an error-log review sheet", callback: () => this.exportReviewSheet() });
    this.addCommand({ id: "import-pdf", name: "Import questions from a file (PDF, PowerPoint, Word)", callback: () => this.openPdfImport() });
    this.addCommand({ id: "import-service-export", name: "Import notes from an export (Airtable, Notion, Evernote, Keep, Bear, Roam)", callback: () => this.importActiveServiceExport() });
    this.addCommand({ id: "import-service-clipboard", name: "Import notes from a pasted export", callback: () => this.importServiceClipboard() });
    this.addCommand({ id: "quick-add", name: "Quick add questions from pasted text", callback: () => this.openQuickAdd() });
    this.addCommand({ id: "import-quiz-clipboard", name: "Import a generated quiz from the clipboard", callback: () => this.openQuizClipboardImport() });
    this.addCommand({ id: "export-study-bundle", name: "Export a study bundle (backup of questions and cards)", callback: () => this.exportStudyBundle() });
    this.addCommand({
      id: "import-study-bundle",
      name: "Import a study bundle (restore questions and cards)",
      callback: async () => {
        try {
          await this.importStudyBundle("");
        } catch (e) {
          new Notice(`Study bundle import failed: ${str(e && e.message ? e.message : e)}`, 10000);
        }
      },
    });
    this.addCommand({ id: "ai-undo-last-write", name: "AI: undo the last generated notes", callback: () => this.undoLastAiWriteCommand() });
    this.addCommand({ id: "ai-undo-agent-edits", name: "AI: undo the last agent edits", callback: () => this.undoLastAgentEditCommand() });
    this.addCommand({ id: "course-notes-import", name: "Import course notes from a lecture or chapter", callback: () => this.openCourseNotesImport() });
    this.addCommand({ id: "paper-scanner", name: "Paper scanner: photos to PDF", callback: () => this.openPaperScanner() });
    this.addCommand({ id: "document-review", name: "Review a document for import", callback: () => this.openDocumentReview() });
    this.addCommand({ id: "ocr-pdf", name: "OCR a scanned PDF", callback: () => this.openOcr() });
    this.addCommand({ id: "pdf-annotate", name: "PDF: add an annotation", callback: () => this.openPdfAnnotation() });
    this.addCommand({ id: "pdf-draw", name: "PDF: draw with pen or highlighter", callback: () => this.openPdfInk() });
    this.addCommand({ id: "pdf-latex", name: "PDF: convert pages to a LaTeX note", callback: () => this.convertActivePdfLatex() });
    this.addCommand({ id: "mindmap-add-child", name: "Mind map: add a child", callback: () => this.promptMindMap("add") });
    this.addCommand({ id: "mindmap-rename", name: "Mind map: rename a node", callback: () => this.promptMindMap("rename") });
    this.addCommand({ id: "mindmap-remove", name: "Mind map: remove a node", callback: () => this.promptMindMap("remove") });
    this.addCommand({ id: "mindmap-move", name: "Mind map: move a node", callback: () => this.promptMindMap("move") });
    this.addCommand({ id: "mindmap-from-note", name: "Mind map: make a Markmind map from this note", callback: () => this.mindMapFromNote() });
    this.addCommand({
      id: "pdf-open-link",
      name: "PDF: open a copied deep link",
      callback: async () => {
        let text = "";
        try {
          text = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : "";
        } catch (e) {
          new Notice("Could not read a link from the clipboard. Copy a PDF deep link first.");
          return;
        }
        this.openPdfDeepLink(text);
      },
    });
    this.addCommand({ id: "epub-read", name: "EPUB: open the reader", callback: () => this.openActiveEpubReader() });
    this.addCommand({ id: "epub-annotations", name: "EPUB: open this book's annotations", callback: () => this.openEpubAnnotations() });
    this.addCommand({ id: "pdf-edit", name: "PDF: open the editor (pages and forms)", callback: () => this.openActivePdfEditor() });
    this.addCommand({ id: "pdf-export-notes", name: "PDF: export annotations to Markdown", callback: () => this.exportActivePdfAnnotations() });
    this.addCommand({ id: "pdf-open-annotations", name: "PDF: open annotations", callback: () => this.openPdfAnnotations() });
    this.addCommand({
      id: "practice-folder",
      name: "Practice a folder...",
      callback: () => new QuestionFolderModal(this.app, this, (f) => this.practiceFolder(f)).open(),
    });
    this.addCommand({
      id: "practice-current-folder",
      name: "Practice the folder of this note",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        const dir = f && f.parent ? f.parent.path : "";
        if (!dir || !this.folderHasQuestions(dir)) return false;
        if (!checking) this.practiceFolder(dir);
        return true;
      },
    });
    this.addCommand({ id: "timed-test", name: "Start a timed test", callback: () => this.activateTest() });
    this.addCommand({ id: "open-today", name: "Open Today", callback: () => this.activateToday() });
    this.addCommand({ id: "quick-practice", name: "Quick Practice", callback: () => this.activateQuickPractice() });
    this.addCommand({ id: "daily-quiz", name: "Daily quiz", callback: () => this.startDailyQuiz() });
    this.addCommand({ id: "dismiss-reminder", name: "Dismiss today's study reminder", callback: () => this.dismissTodayReminder() });
    this.addCommand({ id: "study-skin", name: "Open study cards", callback: () => this.openStudySkin() });
    this.addCommand({
      id: "retry-pending-attempts",
      name: "Retry saving offline practice results",
      callback: async () => {
        const r = await this.flushPendingAttempts();
        if (r.remaining) new Notice(`${r.remaining} result${r.remaining === 1 ? "" : "s"} still waiting for the vault to be writable.`, 6000);
        else if (r.sent) new Notice(`Saved ${r.sent} offline result${r.sent === 1 ? "" : "s"}.`, 5000);
        else new Notice("No offline practice results are waiting.");
      },
    });
    this.addCommand({ id: "open-calendar", name: "Open calendar", callback: () => this.activateCalendar() });
    this.addCommand({ id: "open-review-calendar", name: "Open review calendar", callback: () => this.activateReviewCalendar() });
    this.addCommand({ id: "review-calendar-add-note", name: "Review calendar: add this note to review", callback: () => this.addActiveNoteToReview() });
    this.addCommand({ id: "review-calendar-add-folder", name: "Review calendar: add this folder to review", callback: () => this.addActiveFolderToReview() });
    this.addCommand({ id: "open-study-stats", name: "Open study statistics", callback: () => this.activateStudyStats() });
    this.addCommand({ id: "open-local-events", name: "Open local events", callback: () => this.activateLocalEvents() });
    this.addCommand({ id: "new-local-event", name: "Local events: create an event", callback: () => this.openNewLocalEvent() });
    this.addCommand({ id: "open-next-due-note", name: "Note review: open the next due note", callback: () => this.openNextDueNote() });
    this.addCommand({ id: "note-review-dock-toggle", name: "Note review: show or hide the review bar", callback: () => this.toggleNoteReviewDock() });
    this.addCommand({ id: "save-review-session-report", name: "Note review: save a session report", callback: () => this.saveReviewSessionReport(this.noteReviewDock ? this.noteReviewDock.log : []) });
    this.addCommand({ id: "open-pomodoro", name: "Open Pomodoro timer", callback: () => this.activatePomodoro() });
    this.addCommand({ id: "pomodoro-start-pause", name: "Pomodoro: start or pause", callback: () => this.togglePomodoro() });
    this.addCommand({ id: "pomodoro-reset", name: "Pomodoro: reset the current cycle", callback: () => this.resetPomodoro() });
    this.addCommand({ id: "pomodoro-skip", name: "Pomodoro: skip the current phase", callback: () => this.skipPomodoro() });
    this.addCommand({ id: "calendar-add-schedule", name: "Calendar: add an .ics schedule", callback: () => this.openCalendarImport() });
    this.addCommand({
      id: "calendar-note-next-class",
      name: "Calendar: create or open the note for the next class",
      callback: () => this.openNextClassNote(),
    });
    this.addCommand({ id: "calendar-export", name: "Calendar: export the visible schedule to .ics", callback: () => this.exportCalendarIcs() });
    this.addCommand({ id: "open-cards", name: "Open cards", callback: () => this.activateCards() });
    this.addCommand({ id: "open-assignments", name: "Open assignments and grades", callback: () => this.activateAssignments() });
    this.addCommand({ id: "open-study-tools", name: "Open Study Tools", callback: () => this.activateStudyTools() });
    this.addCommand({ id: "new-cornell-note", name: "Cornell notes: create a note", callback: () => this.activateStudyTools("cornell") });
    this.addCommand({ id: "open-study-workspace", name: "Open Study Workspace", callback: () => this.activateStudyWorkspace() });
    this.addCommand({ id: "open-time-blocks", name: "Time blocks: open the planner", callback: () => this.activateStudyWorkspace("timeBlocks") });
    this.addCommand({ id: "open-time-blocks-day", name: "Time blocks: open the day view", callback: () => this.activateTimeBlocksView("day") });
    this.addCommand({ id: "open-time-blocks-week", name: "Time blocks: open the week view", callback: () => this.activateTimeBlocksView("week") });
    this.addCommand({ id: "open-time-blocks-grid", name: "Time blocks: open the grid view", callback: () => this.activateTimeBlocksView("grid") });
    this.addCommand({ id: "open-time-blocks-backlog", name: "Time blocks: open the backlog view", callback: () => this.activateTimeBlocksView("backlog") });
    this.addCommand({ id: "open-time-blocks-routines", name: "Time blocks: open the routines view", callback: () => this.activateTimeBlocksView("routines") });
    this.addCommand({ id: "open-time-blocks-projects", name: "Time blocks: open the projects and domains view", callback: () => this.activateTimeBlocksView("projects") });
    this.addCommand({ id: "open-time-blocks-timeline", name: "Time blocks: open the timeline view", callback: () => this.activateTimeBlocksView("timeline") });
    this.addCommand({ id: "time-blocks-carry-leftovers", name: "Time blocks: carry unfinished tasks to today", callback: () => this.carryTimeBlockLeftovers() });
    this.addCommand({ id: "time-blocks-regenerate-routines", name: "Time blocks: regenerate today's routines", callback: () => this.regenerateTimeBlockRoutines() });
    this.addCommand({ id: "time-blocks-sync-daily-note", name: "Time blocks: sync today's Schedule section with the daily note", callback: () => this.syncTimeBlockDailyNote() });
    this.addCommand({ id: "time-blocks-import-routines", name: "Time blocks: import routines from Routines.md", callback: () => this.importTimeBlockRoutinesFile() });
    this.addCommand({ id: "time-blocks-import-backlog", name: "Time blocks: import Backlog.md", callback: () => this.importTimeBlockBacklogFile() });
    this.addCommand({ id: "time-blocks-tour", name: "Time blocks: open the guided tour", callback: () => this.openTimeBlocksTour() });
    this.addCommand({ id: "time-blocks-write-routines", name: "Time blocks: write routines to Routines.md", callback: () => this.writeTimeBlockRoutinesFile() });
    this.addCommand({ id: "time-blocks-write-backlog", name: "Time blocks: write the backlog to Backlog.md", callback: () => this.writeTimeBlockBacklogFile() });
    this.addCommand({ id: "time-blocks-write-projects", name: "Time blocks: write project and domain files", callback: () => this.writeTimeBlockProjectFiles() });
    this.addCommand({ id: "time-blocks-import-projects", name: "Time blocks: import project and domain files", callback: () => this.importTimeBlockProjectFiles() });
    this.addCommand({ id: "time-blocks-import-kairos", name: "Time blocks: import Kairos settings", callback: () => this.importKairosSettings() });
    this.addCommand({ id: "open-web-browser", name: "Web browser: open", callback: () => this.openWebBrowser() });
    this.addCommand({ id: "canvas-to-outline", name: "Canvas: export the active canvas to a Markdown outline", callback: () => this.exportCanvasToMarkdown() });
    this.addCommand({ id: "canvas-from-outline", name: "Canvas: build a board from the active note outline", callback: () => this.boardFromActiveNote() });
    this.addCommand({ id: "canvas-walk-parent", name: "Canvas: mind map, go to the parent card", callback: () => this.walkCanvas("parent") });
    this.addCommand({ id: "canvas-walk-child", name: "Canvas: mind map, go to the first child card", callback: () => this.walkCanvas("child") });
    this.addCommand({ id: "canvas-walk-next-sibling", name: "Canvas: mind map, go to the next sibling card", callback: () => this.walkCanvas("next") });
    this.addCommand({ id: "canvas-walk-prev-sibling", name: "Canvas: mind map, go to the previous sibling card", callback: () => this.walkCanvas("prev") });
    this.addCommand({ id: "canvas-layout", name: "Canvas: arrange the active board as a mind map", callback: () => this.layoutActiveCanvas() });
    this.addCommand({ id: "canvas-kanban-report", name: "Canvas: report the active board's kanban columns", callback: () => this.reportCanvasKanban() });
    this.addCommand({ id: "canvas-kanban-restack", name: "Canvas: re-stack the active board's kanban columns", callback: () => this.restackCanvasKanban() });
    this.addCommand({ id: "canvas-auto-link-report", name: "Canvas: report the active board's proposed links", callback: () => this.reportCanvasLinks() });
    this.addCommand({ id: "canvas-auto-link-apply", name: "Canvas: link the active board's matching cards", callback: () => this.applyCanvasLinks() });
    this.addCommand({ id: "canvas-present-report", name: "Canvas: report the active board's presentation plan", callback: () => this.reportCanvasPresentation() });
    this.addCommand({ id: "canvas-present", name: "Canvas: present the active board", callback: () => this.presentActiveCanvas() });
    this.addCommand({ id: "canvas-query-report", name: "Canvas: report the active board's query groups", callback: () => this.reportCanvasQueryGroups() });
    this.addCommand({ id: "canvas-query-apply", name: "Canvas: fit the active board's query groups around their matches", callback: () => this.applyCanvasQueryGroups() });
    this.addCommand({ id: "open-task-list", name: "Open the task list", callback: () => this.activateTaskList() });
    this.addCommand({ id: "open-reading-library", name: "Reading library: open the bookshelf", callback: () => this.activateStudyWorkspace("readingLibrary") });
    this.addCommand({ id: "new-feynman-cycle", name: "Feynman Learning: start a cycle", callback: () => this.activateStudyWorkspace("feynman") });
    this.addCommand({ id: "build-recall-queue", name: "Recall Scheduler: build a queue", callback: () => this.activateStudyWorkspace("recall") });
    this.addCommand({ id: "new-topic-plan", name: "Topic planner: create an exam plan", callback: () => this.activateStudyWorkspace("planner") });
    this.addCommand({ id: "study-flow-capture", name: "Study Flow: capture a source excerpt", callback: () => this.activateStudyWorkspace("flow") });
    this.addCommand({ id: "subject-manager", name: "Subject Manager: open subjects", callback: () => this.activateStudyWorkspace("subjects") });
    this.addCommand({ id: "open-quiz-index", name: "Quiz index: scan quizzes and results", callback: () => this.activateStudyWorkspace("quizIndex") });
    this.addCommand({ id: "read-aloud", name: "Read aloud: speak the active note", callback: () => this.activateStudyWorkspace("readAloud") });
    this.addCommand({ id: "compile-lecture-notes", name: "Lecture notes: compile the log into one note", callback: () => this.activateStudyWorkspace("lectures") });
    this.addCommand({ id: "course-health", name: "Course health: check the course list", callback: () => this.activateStudyWorkspace("health") });
    this.addCommand({ id: "audio-bookmarks", name: "Audio bookmarks: timestamp an attachment", callback: () => this.activateStudyWorkspace("bookmarks") });
    this.addCommand({ id: "feynman-ai-feedback", name: "Feynman: get AI feedback on an explanation", callback: () => this.activateStudyWorkspace("feynmanAi") });
    this.addCommand({ id: "pdf-annotation-index", name: "PDF annotations: index the vault sidecars", callback: () => this.activateStudyWorkspace("pdfAnnotations") });
    this.addCommand({ id: "new-assignment", name: "Assignments: add an assignment", callback: () => this.openNewAssignment() });
    this.addCommand({ id: "new-exam", name: "Exams: add an exam", callback: () => new ExamModal(this.app, this, {}, (result) => { if (result && result.path) new Notice(`Created ${result.path}.`); this.refreshViews(); }).open() });
    this.addCommand({ id: "calendar-class-attended", name: "Calendar: mark this class note attended", checkCallback: (checking) => { if (!this.classNoteEvent()) return false; if (!checking) this.logClassNoteAttendance(null, true); return true; } });
    this.addCommand({ id: "calendar-class-absent", name: "Calendar: mark this class note absent", checkCallback: (checking) => { if (!this.classNoteEvent()) return false; if (!checking) this.logClassNoteAttendance(null, false); return true; } });
    this.addCommand({ id: "course-overview", name: "Courses: open the course overview", checkCallback: (checking) => { const course = this.settings.calendar && this.settings.calendar.courses && this.settings.calendar.courses[0]; if (!course) return false; if (!checking) this.openCourseOverview(course.id || course.name); return true; } });
    this.addCommand({ id: "open-reference", name: "Open Reference", callback: () => this.activateReference() });
    this.addCommand({ id: "open-ap-score", name: "Open AP score calculator", callback: () => this.openApScore() });
    this.addCommand({ id: "open-ap-resources", name: "Open AP resources", callback: () => this.openApResources() });
    this.addCommand({ id: "open-frq-grader", name: "AP: open free-response practice and grader", callback: () => this.openFrqGrader() });
    this.addCommand({ id: "new-frq-note", name: "AP: create a free-response note", callback: () => this.openNewFrqNote() });
    this.addCommand({ id: "import-frq-pdf", name: "AP: import free-response questions from a PDF", callback: () => this.openFrqPdfImport() });
    this.addCommand({ id: "new-card", name: "Create a flashcard or vocabulary card", callback: () => this.openNewCard() });
    this.addCommand({ id: "source-recall", name: "Create a source-anchored recall from selection", callback: () => this.openSourceRecall() });
    this.addCommand({ id: "generate-cards", name: "Generate flashcards from this note or selection", callback: () => this.openCardGenerator() });
    this.addCommand({
      id: "generate-spaced-quiz",
      name: "Spaced quiz: generate from this note",
      checkCallback: (checking) => {
        if (this.moduleOff("cards")) return false;
        const file = this.app.workspace.getActiveFile();
        if (!file || !/\.md$/i.test(file.path)) return false;
        if (!checking) this.openSpacedQuiz();
        return true;
      },
    });
    this.addCommand({
      id: "auto-anki-send",
      name: "Auto Anki: send this note or selection",
      checkCallback: (checking) => {
        if (this.moduleOff("cards")) return false;
        const file = this.app.workspace.getActiveFile();
        if (!file || !/\.md$/i.test(file.path)) return false;
        if (!checking) this.openAutoAnki();
        return true;
      },
    });
    this.addCommand({ id: "text2anki-send", name: "Text2Anki: send the selection to Anki", callback: () => this.runText2AnkiCommand() });
    this.addCommand({ id: "new-image-occlusion", name: "Cards: create image occlusion cards", callback: () => this.openImageOcclusion() });
    this.addCommand({
      id: "practice-note",
      name: "Practice this note only",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const fm = file && this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!file || !fm || fm.question_id === undefined || fm.question_id === null || fm.question_id === "") return false;
        if (!checking) this.practiceNote(file.path);
        return true;
      },
    });
    this.addCommand({
      id: "cards-extract-note",
      name: "Cards: extract cards from this note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !/\.md$/i.test(file.path) || this.moduleOff("cards")) return false;
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (isCardNote(fm)) return false;
        if (!checking) this.openCardExtract(file.path);
        return true;
      },
    });
    this.addCommand({
      id: "lecture-practice",
      name: "Generate practice from this lecture",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !/\.md$/i.test(file.path)) return false;
        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter || {};
        if (isCardNote(fm) || (fm.question_id !== undefined && fm.question_id !== null && fm.question_id !== "")) return false;
        const headings = (cache?.headings || []).map((h) => h.heading);
        if (!isTranscriptNote(fm, file.path, "", headings)) return false;
        if (!checking) this.openTranscriptPractice(file.path);
        return true;
      },
    });
    this.addCommand({
      id: "generate-from-note",
      name: "AI: generate practice from this note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !/\.md$/i.test(file.path)) return false;
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
        if (isCardNote(fm) || (fm.question_id !== undefined && fm.question_id !== null && fm.question_id !== "")) return false;
        if (!checking) this.openTranscriptPractice(file.path, { force: true });
        return true;
      },
    });
    this.addCommand({ id: "weak-spot-generate", name: "AI: generate practice from a weak spot", callback: () => this.openWeakSpotGenerate() });
    this.addCommand({
      id: "verify-answer-ai",
      name: "AI: verify the answer for this note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const fm = file && this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!file || !fm || fm.question_id === undefined || fm.question_id === null || fm.question_id === "") return false;
        if (!checking) {
          this.verifyAnswerWithAi(file.path)
            .then((result) => {
              if (result) new Notice(result.match ? "The AI agrees with the stored answer." : `The AI chose ${result.answer}; the note says ${result.key}. Marked for review.`, 7000);
            })
            .catch((e) => new Notice(str(e && e.message ? e.message : e) || "Could not verify that answer.", 7000));
        }
        return true;
      },
    });

    this.addCommand({
      id: "verify-calculation-note",
      name: "Verify this answer by calculation",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const fm = file && this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!file || !fm || fm.question_id === undefined || fm.question_id === null || fm.question_id === "") return false;
        if (!checking) {
          this.verifyAnswerByCalculation(file.path)
            .then((result) => {
              if (result) {
                new Notice(
                  result.match
                    ? "The calculation agrees with the stored answer."
                    : `The calculation gives ${result.answer}; the note says ${result.key}. Marked for review.`,
                  7000
                );
              }
            })
            .catch((e) => new Notice(str(e && e.message ? e.message : e) || "Could not check that answer by calculation.", 7000));
        }
        return true;
      },
    });
    this.addCommand({
      id: "verify-calculation-all",
      name: "Verify numeric answers by calculation",
      callback: () => this.verifyAllByCalculation(),
    });
    this.addCommand({ id: "tag-card-courses", name: "Cards: tag cards with their folder's course", callback: () => this.tagCardsByCourse() });
    this.addCommand({
      id: "cards-grade-pending",
      name: "Cards: grade pending typed answers",
      callback: async () => {
        const r = await this.flushPendingCardGrades();
        if (r.disabled) new Notice("Turn on AI features and the Cards AI fallback first.", 6000);
        else if (r.remaining) new Notice(`Graded ${r.graded}; ${r.remaining} answer${r.remaining === 1 ? "" : "s"} still waiting.`, 6000);
        else if (r.graded) new Notice(`Graded ${r.graded} pending answer${r.graded === 1 ? "" : "s"}.`, 5000);
        else new Notice("No typed answers are waiting for an AI grade.");
      },
    });
    this.addCommand({ id: "import-cards", name: "Cards: import existing decks", callback: () => this.openCardImport() });
    this.addCommand({ id: "cards-import-document", name: "Cards: extract cards from a PDF or Markdown file", callback: () => this.openDocumentCards() });
    this.addCommand({ id: "open-study-agent", name: "Study agent: open the sidebar", callback: () => this.activateAgent() });
    this.addCommand({ id: "ai-quick-ask", name: "AI: Quick Ask about the selection or note", callback: () => this.openQuickAsk() });
    this.addCommand({ id: "study-agent-quick-chat", name: "Study agent: Quick Chat", callback: () => this.openQuickChat() });
    this.addCommand({
      id: "study-agent-skill",
      name: "Study agent: create a skill note",
      callback: () =>
        this.createSkillNote().catch((e) => {
          this.recordDiagnosticError("skill", e);
          new Notice(`Could not create the skill note: ${String((e && e.message) || e)}`, 8000);
        }),
    });
    this.addCommand({
      id: "study-agent-project",
      name: "Study agent: create a chat project",
      callback: () =>
        this.promptChatProject().catch((e) => {
          this.recordDiagnosticError("chat project", e);
          new Notice(`Could not create the project: ${String((e && e.message) || e)}`, 8000);
        }),
    });
    this.addCommand({
      id: "study-agent-cost",
      name: "Study agent: show this chat's cost estimate",
      callback: () => this.showChatCostEstimate(),
    });
    this.addCommand({
      id: "study-agent-memory",
      name: "Study agent: manage saved memory",
      callback: () => this.openMemoryModal(),
    });
    this.addCommand({
      id: "study-agent-export",
      name: "Study agent: export a conversation as Markdown",
      callback: () =>
        this.exportChatAsMarkdown().catch((e) => {
          this.recordDiagnosticError("chat export", e);
          new Notice(`Could not export the conversation: ${String((e && e.message) || e)}`, 8000);
        }),
    });
    this.addCommand({
      id: "study-agent-rewind",
      name: "Study agent: rewind to the last question",
      callback: () =>
        this.rewindLastQuestion().catch((e) => {
          this.recordDiagnosticError("chat rewind", e);
          new Notice(`Could not rewind the conversation: ${String((e && e.message) || e)}`, 8000);
        }),
    });
    this.addCommand({
      id: "study-agent-fork",
      name: "Study agent: fork from the last question",
      callback: () =>
        this.forkLastQuestion().catch((e) => {
          this.recordDiagnosticError("chat fork", e);
          new Notice(`Could not fork the conversation: ${String((e && e.message) || e)}`, 8000);
        }),
    });
    this.addCommand({
      id: "study-agent-plan",
      name: "Study agent: plan a multi-step task",
      callback: () =>
        this.promptStudyPlan().catch((e) => {
          this.recordDiagnosticError("chat plan", e);
          new Notice(`Could not start the plan: ${String((e && e.message) || e)}`, 8000);
        }),
    });
    this.addCommand({
      id: "study-agent-attach-pdf",
      name: "Study agent: attach a PDF",
      callback: () =>
        this.attachPdfToStudyAgent().catch((e) => {
          this.recordDiagnosticError("chat pdf", e);
          new Notice(`Could not attach the PDF: ${String((e && e.message) || e)}`, 8000);
        }),
    });
    this.addCommand({
      id: "study-agent-diagnostics",
      name: "Study agent: save diagnostics bundle",
      callback: () =>
        this.saveDiagnosticsBundle().catch((e) => {
          this.recordDiagnosticError("diagnostics", e);
          new Notice(`Could not save the diagnostics bundle: ${String((e && e.message) || e)}`, 8000);
        }),
    });
    this.addCommand({
      id: "cards-rescan-plain",
      name: "Cards: rescan plain Markdown folder",
      callback: async () => {
        if (this.moduleOff("cards")) return;
        const count = await this.refreshPlainCards({ refresh: true });
        new Notice(count ? `Found ${count} plain Markdown card${count === 1 ? "" : "s"}.` : "No plain Markdown cards found in the configured folder.");
      },
    });
    this.addCommand({ id: "export-cards", name: "Cards: export to Quizlet, Anki package, Anki text, Mochi, LearnKit, Kahoot, Blooket or Gimkit", callback: () => this.openCardExport() });
    this.addCommand({ id: "push-cards-anki", name: "Cards: push to Anki (AnkiConnect)", callback: () => this.openAnkiConnectPush() });
    this.addCommand({ id: "push-vault-anki", name: "Cards: push the whole vault to Anki (AnkiConnect)", callback: () => this.openAnkiConnectPush({ vaultWide: true }) });
    this.addCommand({ id: "sync-cards-anki", name: "Cards: sync with Anki (AnkiConnect)", callback: () => this.openAnkiConnectPush({ sync: true }) });
    this.addCommand({ id: "test-couchdb", name: "Cards: test CouchDB connection", callback: () => this.testCouchDbConnection() });
    this.addCommand({ id: "sync-cards-couchdb", name: "Cards: sync review state with CouchDB", callback: () => this.syncCardsCouchDb() });
    this.addCommand({ id: "open-due-queue", name: "Open today's due queue", callback: () => this.openDueQueue() });
    this.addCommand({ id: "review-notes", name: "Review notes (whole-note queue)", callback: () => this.openNoteReview() });
    this.addCommand({
      id: "spaced-everything-review",
      name: "Spaced Everything: review due notes",
      checkCallback: (checking) => {
        if (this.moduleOff("mcq") || !normalizeSpacedEverything(this.settings.spacedEverything).enabled) return false;
        if (!checking) this.openSpacedReview();
        return true;
      },
    });
    this.addCommand({
      id: "spaced-everything-log",
      name: "Spaced Everything: log review outcome for this note",
      checkCallback: (checking) => {
        if (this.moduleOff("mcq") || !normalizeSpacedEverything(this.settings.spacedEverything).enabled) return false;
        const file = this.app.workspace.getActiveFile();
        if (!file || !/\.md$/i.test(file.path)) return false;
        if (!checking) this.openSpacedReviewForFile(file);
        return true;
      },
    });
    this.addCommand({ id: "spaced-everything-capture", name: "Spaced Everything: capture thought", checkCallback: (checking) => {
      if (this.moduleOff("mcq") || !normalizeSpacedEverything(this.settings.spacedEverything).enabled) return false;
      if (!checking) this.openSpacedCapture();
      return true;
    } });
    this.addCommand({
      id: "simple-note-quiz",
      name: "Simple note quiz: start on this note",
      checkCallback: (checking) => {
        if (this.moduleOff("mcq")) return false;
        const file = this.app.workspace.getActiveFile();
        if (!file || !/\.md$/i.test(file.path)) return false;
        if (!checking) this.openSimpleNoteQuiz().catch((e) => new Notice(str(e && e.message ? e.message : e) || "Could not start the note quiz.", 6000));
        return true;
      },
    });
    this.addCommand({ id: "generate-quiz", name: "Generate quiz questions from notes", callback: () => this.openQuizGenerator() });
    this.addCommand({ id: "cards-export-archive", name: "Cards: export a portable archive", callback: () => this.exportCardArchive().catch((e) => new Notice(str(e && e.message ? e.message : e) || "Could not export the archive.", 6000)) });
    this.addCommand({ id: "cards-import-archive", name: "Cards: import a portable archive", callback: () => this.openCardArchiveImport() });
    this.addCommand({ id: "study-nudge-show", name: "Show today's study nudge", callback: () => this.maybeShowStudyNudge(new Date()) });
    this.addCommand({ id: "course-note-from-template", name: "Course notes: create a note from a template", callback: () => this.openCourseNoteBuilder() });
    this.addCommand({ id: "mixed-review", name: "Start mixed review", callback: () => this.openMixedReview() });
    this.addCommand({ id: "manage-study-status", name: "Manage hidden study items", callback: () => this.openStudyStatusManager() });

    // Embeds: `uni-schedule` and `uni-calendar` are the block names existing University
    // Schedule and Calendar notes use, so those keep working. If that plugin is enabled
    // it owns those names, and our own `mcq-schedule` block is always available.
    const renderBlock = (source, el) => this.renderScheduleBlock(source, el);
    if (!this.otherCalendarPluginActive()) {
      this.registerMarkdownCodeBlockProcessor("uni-schedule", renderBlock);
      this.registerMarkdownCodeBlockProcessor("uni-calendar", renderBlock);
    }
    this.registerMarkdownCodeBlockProcessor("mcq-schedule", renderBlock);
    this.registerMarkdownCodeBlockProcessor("mcq-dashboard", (source, el) => this.renderDashboardBlock(source, el));
    this.registerMarkdownCodeBlockProcessor("mcq-quiz", (source, el, ctx) => this.renderQuizBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("quiz-definition", (source, el, ctx) => this.renderQuizDefinitionBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("playable-quiz", (source, el, ctx) => this.renderPlayableQuizBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("exam", (source, el, ctx) => this.renderExamBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("quiz-maker", (source, el, ctx) => this.renderQuizMakerBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("sat-math", (source, el, ctx) => this.renderSatMathBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("sfc-cards", (source, el, ctx) => this.renderSfcCardsBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("cbt-exam", (source, el, ctx) => this.renderCbtExamBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("vault-search", (source, el) => this.renderVaultSearchBlock(source, el));
    this.registerMarkdownCodeBlockProcessor("quizport", (source, el, ctx) => this.renderQuizPortBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("simple-flashcards", (source, el, ctx) => this.renderSimpleFlashcardsBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("reading-plan", (source, el, ctx) => this.renderReadingPlanBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("tag-timer", (source, el, ctx) => this.renderTagTimerBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("tally", (source, el, ctx) => this.renderTallyBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("study-map", (source, el) => this.renderStudyMapBlock(source, el));
    this.registerMarkdownCodeBlockProcessor("text-timer", (source, el, ctx) => this.renderTextTimerBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("cornell-note", (source, el) => renderCornellBlock(this, source, el));
    this.registerMarkdownCodeBlockProcessor("quiz", (source, el, ctx) => this.renderSimpleQuizBlock(source, el, ctx));
    this.registerMarkdownCodeBlockProcessor("quizjson", (source, el) => this.renderSimpleQuizDataBlock(source, el, "json"));
    this.registerMarkdownCodeBlockProcessor("quizjs", (source, el) => this.renderSimpleQuizDataBlock(source, el, "js"));
    this.registerMarkdownCodeBlockProcessor("quiztoday", (source, el) => this.renderSimpleQuizTodayBlock(source, el));
    this.registerMarkdownCodeBlockProcessor("quizcharts", (source, el) => this.renderSimpleQuizChartsBlock(source, el));
    this.registerMarkdownCodeBlockProcessor("smiles", (source, el) => {
      const result = renderSmilesSvg(source);
      if (!result.ok) {
        el.createDiv({ cls: "qt-smiles-error", text: `SMILES: ${result.error}` });
        return;
      }
      const box = el.createDiv({ cls: "qt-smiles" });
      box.innerHTML = safeSvg(result.svg);
    });
    this.registerMarkdownCodeBlockProcessor("chem", (source, el) => {
      const result = renderChemistryDiagram(source);
      if (!result.ok) {
        el.createDiv({ cls: "qt-stem-error", text: `Chemistry: ${result.error}` });
        return;
      }
      el.createDiv({ cls: "qt-stem-block" }).innerHTML = result.html;
    });
    this.registerMarkdownCodeBlockProcessor("biology", (source, el) => {
      const result = renderBiologyDiagram(source);
      if (!result.ok) {
        el.createDiv({ cls: "qt-stem-error", text: `Biology: ${result.error}` });
        return;
      }
      el.createDiv({ cls: "qt-stem-block" }).innerHTML = result.html;
    });
    this.registerMarkdownCodeBlockProcessor("biosequence", (source, el) => {
      const result = renderBiologyDiagram(source);
      if (!result.ok) {
        el.createDiv({ cls: "qt-stem-error", text: `Biology: ${result.error}` });
        return;
      }
      el.createDiv({ cls: "qt-stem-block" }).innerHTML = result.html;
    });
    this.registerMarkdownCodeBlockProcessor("circuit", (source, el) => {
      const result = renderCircuitDiagram(source);
      if (!result.ok) {
        el.createDiv({ cls: "qt-stem-error", text: `Circuit: ${result.error}` });
        return;
      }
      el.createDiv({ cls: "qt-stem-block" }).innerHTML = result.html;
    });
    this.addCommand({ id: "weak-spots", name: "Show weak spots", callback: () => this.activateInsights("weak") });
    this.addCommand({ id: "error-log", name: "Show error log", callback: () => this.activateInsights("errors") });
    this.addCommand({ id: "knowledge-record", name: "Open the knowledge record", callback: () => this.activateInsights("concepts") });
    this.addCommand({ id: "rebuild-knowledge-record", name: "Knowledge record: rebuild from notes", callback: () => this.rebuildKnowledgeRecord() });
    this.addCommand({ id: "copy-learner-digest", name: "Knowledge record: copy learner digest", callback: () => this.copyLearnerDigest() });
    this.addCommand({ id: "find-question", name: "Find a question by ID", callback: () => new FindQuestionModal(this.app, this).open() });
    this.addCommand({
      id: "rename-source-id",
      name: "Rename old source_question_id properties to official_question_id",
      callback: () => this.migrateOfficialIds(),
    });

    // right-click a folder in the file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder) {
          if (!this.folderHasQuestions(file.path)) return;
          menu.addItem((item) =>
            item
              .setTitle("Practice this folder")
              .setIcon("graduation-cap")
              .onClick(() => this.practiceFolder(file.path))
          );
          return;
        }
        if (file instanceof TFile && /\.pdf$/i.test(file.path)) {
          menu.addItem((item) => item.setTitle("Add PDF annotation").setIcon("highlighter").onClick(() => this.openPdfAnnotation(file.path)));
          menu.addItem((item) => item.setTitle("Draw on PDF").setIcon("pencil").onClick(() => this.openPdfInk(file.path)));
          menu.addItem((item) => item.setTitle("Open PDF annotations").setIcon("notebook-pen").onClick(() => this.openPdfAnnotations(file.path)));
          return;
        }
        if (!(file instanceof TFile) || !/\.md$/i.test(file.path)) return;
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (fm && fm.calendar_uid && fm.calendar_date) {
          menu.addItem((item) => item.setTitle("Calendar: mark attended").setIcon("check").onClick(() => this.logClassNoteAttendance(file, true)));
          menu.addItem((item) => item.setTitle("Calendar: mark absent").setIcon("x").onClick(() => this.logClassNoteAttendance(file, false)));
        }
        if (fm && fm.question_id !== undefined && fm.question_id !== null && fm.question_id !== "") {
          menu.addItem((item) =>
            item
              .setTitle("Practice this note only")
              .setIcon("graduation-cap")
              .onClick(() => this.practiceNote(file.path))
          );
        }
        if (!isCardNote(fm) && !this.moduleOff("cards")) {
          menu.addItem((item) =>
            item
              .setTitle("Extract cards from this note")
              .setIcon("layers")
              .onClick(() => this.openCardExtract(file.path))
          );
        }
        const headings = (this.app.metadataCache.getFileCache(file)?.headings || []).map((h) => h.heading);
        if (
          fm &&
          fm.question_id === undefined &&
          !isCardNote(fm) &&
          isTranscriptNote(fm, file.path, "", headings)
        ) {
          menu.addItem((item) =>
            item
              .setTitle("Generate practice from this lecture")
              .setIcon("graduation-cap")
              .onClick(() => this.openTranscriptPractice(file.path))
          );
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!this.settings.ai || this.settings.ai.enabled !== true) return;
        menu.addItem((item) =>
          item
            .setTitle("Quick Ask about this selection")
            .setIcon("sparkles")
            .onClick(() => {
              const file = view && view.file;
              const selection = editor && typeof editor.getSelection === "function" ? editor.getSelection() : "";
              this.openQuickAsk({
                editor,
                context: file ? { path: file.path, title: file.basename || file.name, text: "", selection } : null,
              });
            })
        );
      })
    );
    // keep saved filters and presets pointing at a folder that was renamed or moved
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFolder)) return;
        if (renameFolderInSettings(this.settings, oldPath, file.path)) {
          this.save();
          this.refreshViews();
        }
      })
    );
    this.addCommand({
      id: "open-ai-assistant",
      name: "Open AI assistant (OpenCode)",
      callback: async () => {
        const view = await this.activateView();
        if (view && view.render) {
          view.state = "chat";
          view.render();
        }
      },
    });
    this.addCommand({
      id: "next-question",
      name: "Next question (from current filters)",
      callback: async () => {
        const view = await this.activateView();
        if (view && view.next) await view.next();
      },
    });
    this.addCommand({
      id: "toggle-flag",
      name: "Toggle flag on this question",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        const fm = f && this.app.metadataCache.getFileCache(f)?.frontmatter;
        if (!fm || !fm.question_id) return false;
        if (!checking) this.toggleFlag(f).then((v) => new Notice(v ? "Flagged" : "Unflagged"));
        return true;
      },
    });
    this.addCommand({
      id: "mark-question-fixed",
      name: "Mark this question fixed",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        const fm = f && this.app.metadataCache.getFileCache(f)?.frontmatter;
        if (!fm || !fm.question_id || fm.needs_fixing !== true) return false;
        if (!checking) this.markQuestionFixed(f);
        return true;
      },
    });
    this.addCommand({
      id: "add-fields-this-note",
      name: "Add missing tracking properties to this note",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f) return false;
        if (!checking) this.addMissingFields([f]);
        return true;
      },
    });
    this.addCommand({
      id: "add-fields-all",
      name: "Add missing tracking properties to all question notes",
      callback: () => this.addMissingFields(this.getQuestions().map((q) => q.file)),
    });
    this.addCommand({
      id: "repair-review-history",
      name: "Repair review counters from history",
      callback: () => this.repairReviewHistory(),
    });

    for (const command of TABLE_COMMANDS) {
      this.addCommand({
        id: command.id,
        name: command.name,
        checkCallback: (checking) => {
          const context = this.activeTableContext();
          if (!context) return false;
          if (!checking) {
            this.noticeDoubleBinding(command.action);
            this.runTableAction(command.action);
          }
          return true;
        },
      });
    }
    this.addCommand({
      id: "tables-format-all",
      name: "Tables: format every table in this note",
      checkCallback: (checking) => {
        const context = this.activeEditorContext();
        if (!context) return false;
        if (!checking) this.formatAllTablesInNote();
        return true;
      },
    });
    this.addCommand({
      id: "tables-open-controls",
      name: "Tables: open the table controls panel",
      callback: () => this.openTableControls(),
    });
    this.settingsTab = new QuestionTrackerSettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);

    this.registerInterval(
      activeWindow.setInterval(() => {
        const ses = this.session;
        if (ses && ses.runningSince) {
          ses.lastBeat = Date.now();
          this.writeSession();
        }
      }, 10000)
    );

    // A vault can be temporarily unwritable (sync lock, removable drive, mobile
    // storage). Retry the local outbox periodically and as soon as we are online.
    this.registerInterval(activeWindow.setInterval(() => this.flushPendingAttempts().catch(() => {}), 60000));
    this.registerDomEvent(window, "online", () => this.flushPendingAttempts().catch(() => {}));

    this.registerDomEvent(activeDocument, "visibilitychange", () => {
      if (activeDocument.hidden && Platform.isMobile && this.settings.autoPauseOnMobile && this.isRunning()) {
        this.pauseSession();
        for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
          if (leaf.view && leaf.view.pauseQuick) leaf.view.pauseQuick();
        }
        this.refreshViews();
      }
    });
  }

  /** Work that can wait until Obsidian has finished restoring the workspace. */
  startDeferredStartup() {
    this.setupReminder();
    this.setupStudyNudge();
    this.setupNoteReviewStatus();
    this.setupPomodoroStatus();
    this.registerInterval(activeWindow.setInterval(() => this.tickPomodoro(), 1000));

    // These are vault-wide listeners. Registering them after layout avoids
    // reacting to the initial file enumeration and metadata scan.
    const invalidateNotes = () => this.invalidateCalendarNotes();
    this.registerEvent(this.app.vault.on("create", invalidateNotes));
    this.registerEvent(this.app.vault.on("delete", invalidateNotes));
    this.registerEvent(this.app.vault.on("rename", invalidateNotes));
    this.registerEvent(this.app.metadataCache.on("changed", invalidateNotes));

    const refreshPlainCards = () => {
      const plain = this.settings.cards && this.settings.cards.plainMarkdown;
      if (!plain || plain.enabled !== true) return;
      this.refreshPlainCards()
        .then(() => this.refreshViews())
        .catch(() => {});
    };
    this.registerEvent(this.app.vault.on("create", refreshPlainCards));
    this.registerEvent(this.app.vault.on("delete", refreshPlainCards));
    this.registerEvent(this.app.vault.on("rename", refreshPlainCards));
    this.registerEvent(this.app.metadataCache.on("changed", refreshPlainCards));

    // The old onload awaited this full-folder scan before any view could open.
    // Start it after layout and repaint Cards once the index is ready.
    const plain = this.settings.cards && this.settings.cards.plainMarkdown;
    if (plain && plain.enabled === true) {
      this.refreshPlainCards()
        .then((count) => {
          if (count) this.refreshViews();
        })
        .catch(() => {});
    }

    // The opt-in knowledge record follows a source note as it is edited, moved,
    // renamed, deleted and restored.
    const knowledgeRenamed = (file, oldPath) => this.handleKnowledgeRecordRename(file, oldPath).catch(() => null);
    const knowledgeDeleted = (file) => this.handleKnowledgeRecordDelete(file).catch(() => null);
    const knowledgeCreated = (file) => this.handleKnowledgeRecordCreate(file).catch(() => null);
    const knowledgeModified = (file) => {
      if (!this.knowledgeRecordScannable(file)) return;
      this.scheduleKnowledgeRecordRefresh(file.path);
    };
    this.registerEvent(this.app.vault.on("rename", knowledgeRenamed));
    this.registerEvent(this.app.vault.on("delete", knowledgeDeleted));
    this.registerEvent(this.app.vault.on("create", knowledgeCreated));
    this.registerEvent(this.app.vault.on("modify", knowledgeModified));

    // Today and plans can render without this index; refresh them once the
    // reading-plan fences have been collected.
    this.indexReadingPlans()
      .then((count) => {
        if (count) this.refreshViews();
      })
      .catch(() => {});
  }

  /* ---- settings */

  async loadSettings() {
    const saved = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    delete this.settings.session; // older versions stored the timer here; it is per-device now
    this.settings.filters = cloneFilters(saved.filters);
    this.settings.moreSets = Array.isArray(saved.moreSets) ? saved.moreSets.map(cloneFilters) : [];
    this.settings.presets = (Array.isArray(saved.presets) ? saved.presets : []).map((pr) =>
      Object.assign({}, pr, { filters: cloneFilters(pr.filters), moreSets: Array.isArray(pr.moreSets) ? pr.moreSets.map(cloneFilters) : [] })
    );
    this.settings.ai = Object.assign({}, DEFAULT_SETTINGS.ai, saved.ai || {});
    const sa = (saved.ai && saved.ai.api) || {};
    this.settings.ai.api = Object.assign({}, DEFAULT_SETTINGS.ai.api, sa, { keys: Object.assign({}, sa.keys), secrets: Object.assign({}, sa.secrets) });
    this.settings.ai.api.models = modelDiscovery.normalizeModelList(this.settings.ai.api.models);
    this.settings.ai.tutorRole = normalizeTutorRole(this.settings.ai.tutorRole);
    this.settings.ai.thinkFirst = this.settings.ai.thinkFirst === true;
    this.settings.ai.thinkFirstSeconds = normalizeThinkFirstSeconds(this.settings.ai.thinkFirstSeconds);
    this.settings.ai.context = normalizeAiContext(this.settings.ai.context);
    this.settings.ai.verification = normalizeVerificationMode(this.settings.ai.verification);
    aiService.normalizeAiService(this.settings.ai);
    this.settings.ai.studyCommands = studyCommands.normalizeStudyCommands(this.settings.ai.studyCommands);
    this.settings.ai.studyChatBookmarks = chatBookmarks.normalizeBookmarks(this.settings.ai.studyChatBookmarks);
    // 0.2.0 saved settings had no `managed` flag: move those users to the automatic setup.
    if (saved.explanationDefault === undefined && saved.showRationale === false) this.settings.explanationDefault = "hide";
    delete this.settings.showRationale;
    if (!["show", "wrong", "hide"].includes(this.settings.explanationDefault)) this.settings.explanationDefault = "wrong";
    this.settings.closedBook = this.settings.closedBook === true;
    this.settings.distractionFreePractice = this.settings.distractionFreePractice !== false;
    this.settings.hints = this.settings.hints === true;
    this.settings.examReady = this.settings.examReady === true;
    this.settings.examReadyPasses = normalizeExamReadyPasses(this.settings.examReadyPasses);
    this.settings.inlineQuizResults = this.settings.inlineQuizResults === true;
    this.settings.inlineQuizReorder = this.settings.inlineQuizReorder === true;
    this.settings.inlineQuizNumeric = this.settings.inlineQuizNumeric === true;
    this.settings.inlineQuizSharedChoice = this.settings.inlineQuizSharedChoice === true;
    this.settings.examBlockMode = this.settings.examBlockMode === "answer" ? "answer" : "study";
    this.settings.knownDaysByCourse = normalizeCourseDays(saved.knownDaysByCourse);
    this.settings.historyLimit = normalizeHistoryLimit(this.settings.historyLimit);
    this.settings.knowledgeRecord = knowledgeRecord.normalizeSettings(saved.knowledgeRecord);
    this.settings.studyPlanDays = normalizeStudyPlanDays(this.settings.studyPlanDays);
    this.settings.leechThreshold = Math.max(0, Math.min(50, Math.round(Number(this.settings.leechThreshold) || 0)));
    this.settings.leechAction = this.settings.leechAction === "suspend" ? "suspend" : "flag";
    this.settings.needsFixing = this.settings.needsFixing === true;
    this.settings.testDefaults = Object.assign({}, DEFAULT_SETTINGS.testDefaults, saved.testDefaults || {});
    this.settings.testDefaults.shuffleChoices = !!this.settings.testDefaults.shuffleChoices;
    this.settings.testDefaults.passScore = normalizePassScore(this.settings.testDefaults.passScore);
    this.settings.testBlueprints = (Array.isArray(saved.testBlueprints) ? saved.testBlueprints : [])
      .map(normalizeBlueprint)
      .filter(Boolean)
      .slice(0, 20);
    this.settings.quickDefaults = Object.assign({}, DEFAULT_SETTINGS.quickDefaults, saved.quickDefaults || {});
    this.settings.dailyQuiz = normalizeDailyQuiz(saved.dailyQuiz);
    this.settings.simpleQuiz = normalizeSimpleQuiz(saved.simpleQuiz);
    this.settings.simpleNoteQuiz = normalizeSimpleNoteQuiz(saved.simpleNoteQuiz);
    this.settings.reading = normalizeReadingSettings(saved.reading);
    this.settings.tagTimers = normalizeTagTimerSettings(saved.tagTimers);
    this.settings.tallies = normalizeTallySettings(saved.tallies);
    this.settings.textTimers = normalizeTextTimerSettings(saved.textTimers);
    this.settings.cornellNotes = studyTools.normalizeCornellSettings(saved.cornellNotes);
    this.settings.lectureLog = studyTools.normalizeLectureLog(saved.lectureLog);
    this.settings.studyGoals = studyTools.normalizeStudyGoals(saved.studyGoals);
    this.settings.feynmanLearning = studyWorkspace.normalizeFeynmanSettings(saved.feynmanLearning);
    this.settings.recallScheduler = studyWorkspace.normalizeRecallScheduler(saved.recallScheduler);
    this.settings.lerntracker = studyWorkspace.normalizePlanner(saved.lerntracker);
    this.settings.studyFlow = studyWorkspace.normalizeStudyFlow(saved.studyFlow);
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager(saved.subjectManager);
    this.settings.quizIndex = studyWorkspace.normalizeQuizIndex(saved.quizIndex);
    this.settings.quizMaker = normalizeQuizMakerSettings(saved.quizMaker);
    this.settings.satMath = normalizeSatMathSettings(saved.satMath);
    this.settings.sfcCards = normalizeSfcCardsSettings(saved.sfcCards);
    this.settings.cbtExam = normalizeCbtExamSettings(saved.cbtExam);
    this.settings.cardArchive = normalizeCardArchiveSettings(saved.cardArchive);
    this.settings.studyNudge = normalizeStudyNudgeSettings(saved.studyNudge);
    this.settings.courseTemplates = normalizeCourseTemplates(saved.courseTemplates);
    this.settings.schedulerFit = normalizeSchedulerFitSettings(saved.schedulerFit);
    this.settings.studyMap = normalizeStudyMapSettings(saved.studyMap);
    this.settings.vaultSearch = normalizeVaultSearchSettings(saved.vaultSearch);
    this.settings.courseHub = studyWorkspace.normalizeCourseHub(saved.courseHub);
    this.settings.studyTasks = studyWorkspace.normalizeStudyTasks(saved.studyTasks);
    this.settings.annotations = studyWorkspace.normalizeAnnotations(saved.annotations);
    this.settings.deepNotes = studyWorkspace.normalizeDeepNotes(saved.deepNotes);
    this.settings.retention = studyWorkspace.normalizeRetention(saved.retention);
    this.settings.vocabulary = studyWorkspace.normalizeVocabulary(saved.vocabulary);
    this.settings.wordNet = wordnet.normalizeWordNetSettings(saved.wordNet);
    this.settings.tableEditor = tableEditor.normalizeTableEditorSettings(saved.tableEditor);
    this.settings.readingLibrary = readingLibrary.normalizeLibrary(saved.readingLibrary);
    this.settings.writingSession = writingSessions.normalizeWritingSession(saved.writingSession);
    this.settings.readAloud = readAloud.normalizeReadAloudSettings(saved.readAloud);
    this.settings.lectureCompiler = lectureCompiler.normalizeLectureCompilerSettings(saved.lectureCompiler);
    this.settings.courseHealth = courseHealth.normalizeCourseHealthSettings(saved.courseHealth);
    this.settings.audioBookmarks = audioBookmarks.normalizeAudioBookmarkSettings(saved.audioBookmarks);
    this.settings.feynmanAi = feynmanAi.normalizeFeynmanAiSettings(saved.feynmanAi);
    this.settings.pdfAnnotationIndex = pdfAnnotationIndex.normalizePdfAnnotationIndexSettings(saved.pdfAnnotationIndex);
    this.settings.pdfPlus = pdfPlus.normalizePdfPlusSettings(saved.pdfPlus);
    this.settings.quickAdaptive = normalizeQuickAdaptive(saved.quickAdaptive);
    this.settings.reminder = normalizeReminder(saved.reminder);
    this.settings.practicePath = str(this.settings.practicePath).trim();
    this.settings.quickSession = saved.quickSession && typeof saved.quickSession === "object" ? saved.quickSession : null;
    this.settings.cards = mergeCardSettings(saved.cards, DEFAULT_SETTINGS.cards);
    this.settings.noteReview = normalizeNoteReview(saved.noteReview);
    this.settings.noteReviewDock = noteReviewDock.normalizeNoteReviewDockSettings(saved.noteReviewDock);
    this.settings.reviewCalendar = reviewCalendar.normalizeReviewCalendarSettings(saved.reviewCalendar);
    this.settings.studyStats = studyStats.normalizeStudyStatsSettings(saved.studyStats);
    this.settings.localEvents = localEvents.normalizeLocalEventsSettings(saved.localEvents);
    this.settings.studyCounters = studyCounters.normalizeStudyCounters(saved.studyCounters);
    this.settings.pomodoro = pomodoro.normalizePomodoroSettings(saved.pomodoro);
    this.settings.spacedEverything = normalizeSpacedEverything(saved.spacedEverything);
    this.settings.quizGenerator = normalizeQuizGenerator(saved.quizGenerator);
    this.settings.cardGenerator = normalizeCardGenerator(saved.cardGenerator);
    this.settings.autoAnki = normalizeAutoAnki(saved.autoAnki, this.settings.cards.defaultDeck);
    this.settings.text2anki = normalizeText2Anki(saved.text2anki, this.settings.cards.defaultDeck);
    this.settings.calendar = mergeCalendarSettings(saved.calendar);
    this.settings.assignments = normalizeAssignmentSettings(saved.assignments);
    this.settings.reference = mergeReferenceSettings(saved.reference);
    this.settings.studyLog = normalizeStudyLog(saved.studyLog);
    // module switches and plugin-wide flags are always plain booleans
    this.settings.mcqEnabled = this.settings.mcqEnabled !== false;
    this.settings.showRibbonIcons = this.settings.showRibbonIcons !== false;
    this.settings.openPracticeOnStartUp = this.settings.openPracticeOnStartUp === true;
    this.settings.support = normalizeSupport(saved.support);
    if (!["auto", "buttons", "search"].includes(this.settings.folderFilterStyle)) this.settings.folderFilterStyle = "auto";
    if (!["ladder", "fsrs"].includes(this.settings.scheduler)) this.settings.scheduler = "ladder";
    const retention = Number(this.settings.fsrsRetention);
    this.settings.fsrsRetention = Number.isFinite(retention) ? Math.min(0.95, Math.max(0.85, retention)) : 0.9;
    for (const k of ["intervals", "errorTypes", "confidenceLabels"]) {
      if (!Array.isArray(this.settings[k]) || !this.settings[k].length) this.settings[k] = DEFAULT_SETTINGS[k].slice();
    }
    // Move legacy plain-text keys into Secret Storage where Obsidian provides it.
    // This runs before the settings page is drawn, so a migrated key is never
    // written back to data.json.
    let migratedSecrets = secretKeys.migrateApiKeys(this.app, this.settings.ai.api);
    migratedSecrets += secretKeys.migratePasswordSecret(this.app, this.settings.ai, secretKeys.OPENCODE_PASSWORD_SECRET);
    migratedSecrets += secretKeys.migratePasswordSecret(this.app, this.settings.cards.couchdb, COUCHDB_PASSWORD_SECRET);
    if (migratedSecrets) await this.save();
  }

  save() {
    this.invalidateSnapshots();
    return this.saveData(this.settings);
  }

  /** Any settings or vault change makes every cached dashboard snapshot stale. */
  invalidateSnapshots() {
    this._dataVersion = (Number(this._dataVersion) || 0) + 1;
    if (this._snapshots) this._snapshots.clear();
  }

  snapshot(key, build) {
    if (!this._snapshots) return build();
    return this._snapshots.get(key, Number(this._dataVersion) || 0, build);
  }

  /** Phones always use the direct API (OpenCode can't run there); desktop follows the setting. */
  backend() {
    return Platform.isMobile || this.settings.ai.backend === "api" ? "api" : "opencode";
  }

  /** Connection details: the managed local server if running, otherwise the manual settings. */
  conn() {
    const ai = this.settings.ai;
    if (ai.managed && this.manager.conn) return this.manager.conn;
    const fromSecret = secretKeys.readSecretValue(this.app, ai.passwordSecret || secretKeys.OPENCODE_PASSWORD_SECRET);
    return { url: ai.url, username: ai.username, password: fromSecret || ai.password || this.sessionOpenCodePassword || "" };
  }

  openCode() {
    return new OpenCodeClient(this.conn());
  }

  vaultPath() {
    try {
      return (this.app.vault.adapter && this.app.vault.adapter.basePath) || "";
    } catch (e) {
      return "";
    }
  }

  askConfirm(title, body, okText) {
    return new Promise((resolve) => new ConfirmModal(this.app, title, body, okText, resolve).open());
  }

  async ensureOpenCode(progress) {
    const note = new Notice("Setting up OpenCode...", 0);
    const say = (m) => {
      note.setMessage(m);
      if (progress) progress(m);
    };
    try {
      await this.manager.ensure(say);
    } finally {
      note.hide();
    }
  }

  /** Whether the folder filter shows a search box (true) or one button per folder (false). */
  folderSearchOn(nFolders) {
    const style = this.settings.folderFilterStyle;
    return style === "search" || (style === "auto" && nFolders > FOLDER_AUTO_MAX);
  }

  folderHasQuestions(path) {
    const pre = path + "/";
    return this.getQuestions().some((q) => q.file.path.startsWith(pre));
  }

  /** Opens the practice view with these filters and starts the first question. */
  async practiceWith(filters, mode, options) {
    const st = this.settings;
    const opts = options || {};
    st.filters = cloneFilters(filters);
    st.moreSets = [];
    st.activePreset = "";
    st.practicePath = str(opts.practicePath).trim();
    if (mode) st.mode = mode;
    await this.save();
    const view = await this.activateView();
    if (!view) return;
    view.filtersOpen = true;
    if (view.next) await view.next();
    else this.refreshViews();
  }

  /** Practice every note in a folder and its sub folders. `expected` waits for freshly written notes to be indexed. */
  async practiceFolder(folder, expected) {
    const inFolder = () => this.getQuestions().filter((q) => q.file.path.startsWith(folder + "/")).length;
    for (let i = 0; expected && i < 20 && inFolder() < expected; i++) await sleep(250);
    if (!inFolder()) {
      new Notice("No question notes in that folder yet.");
      return;
    }
    await this.practiceWith({ folder: [folder] }, "smart"); // smart mix: every note is eligible, new ones come first
  }

  /** Practice one note only, useful after a lecture or while fixing a question. */
  async practiceNote(path) {
    const note = this.getQuestions().find((q) => q.file.path === path);
    if (!note) {
      new Notice("That note is not a practice question.");
      return;
    }
    await this.practiceWith({}, "smart", { practicePath: note.file.path });
  }

  /** Practice exactly this set of questions (for example one mastery band) as a quick session. */
  async practiceQuestionPool(pool, label) {
    if (this.moduleOff("mcq")) return null;
    const today = localDate();
    const list = (Array.isArray(pool) ? pool : []).filter((q) => q && q.file && isStudyable(q.fm, today));
    if (!list.length) {
      new Notice("No questions are in that group right now.");
      return null;
    }
    const view = await this.activateView();
    if (!view || !view.startQuick) {
      new Notice("Could not open the practice view.");
      return null;
    }
    await view.startQuick("count", list.length, { pool: list, label });
    return view;
  }

  knowledgeRecordSettings() {
    return knowledgeRecord.normalizeSettings(this.settings && this.settings.knowledgeRecord);
  }

  async loadKnowledgeRecord() {
    if (this._knowledgeRecordLoaded) return this.knowledgeRecord;
    this._knowledgeRecordLoaded = true;
    try {
      this.knowledgeRecord = await knowledgeStore.loadRecord(this.app);
    } catch (e) {
      this.knowledgeRecord = knowledgeRecord.emptyRecord();
    }
    if (this.knowledgeRecordSettings().enabled && Object.keys(this.knowledgeRecord.notes || {}).length) this.refreshViews();
    return this.knowledgeRecord;
  }

  /** Build the opt-in local index from note structure and linked question history. */
  async rebuildKnowledgeRecord(options) {
    const quiet = !!(options && options.quiet);
    if (this._knowledgeRecordBuild) return this._knowledgeRecordBuild;
    if (!this.knowledgeRecordSettings().enabled) {
      if (!quiet) new Notice("Turn on the knowledge record in Settings, AI, Knowledge record first.");
      return null;
    }
    this._knowledgeRecordBuild = (async () => {
      const now = new Date();
      if (!this._knowledgeRecordLoaded) await this.loadKnowledgeRecord();
      const files = (this.app.vault.getMarkdownFiles ? this.app.vault.getMarkdownFiles() : [])
        .filter((file) => this.knowledgeRecordScannable(file))
        .slice(0, 1000);
      const bySource = new Map();
      const byBase = new Map();
      for (const question of this.getQuestions()) {
        const fm = (question && question.fm) || {};
        const source = knowledgeRecord.normalizePath(fm.source_note);
        if (!source) continue;
        if (!bySource.has(source)) bySource.set(source, []);
        bySource.get(source).push(question);
        const base = source.split("/").pop();
        if (!byBase.has(base)) byBase.set(base, []);
        byBase.get(base).push(question);
      }
      const questionsFor = (source, entry) => {
        const paths = new Set(
          [source, entry && entry.path, ...((entry && entry.pathAliases) || [])]
            .map((path) => knowledgeRecord.normalizePath(path))
            .filter(Boolean)
        );
        const bases = new Set([...paths].map((path) => path.split("/").pop()).filter(Boolean));
        const found = new Map();
        for (const path of paths) for (const question of bySource.get(path) || []) found.set(question.file.path, question);
        for (const base of bases) for (const question of byBase.get(base) || []) found.set(question.file.path, question);
        return [...found.values()];
      };
      const previous = this.knowledgeRecord || knowledgeRecord.emptyRecord();
      const previousNotes = previous.notes || {};
      const next = knowledgeRecord.emptyRecord();
      const currentPaths = new Set(files.map((file) => knowledgeRecord.normalizePath(file.path)));
      const usedPrevious = new Set();
      let read = 0;
      let failed = 0;
      for (const file of files) {
        try {
          const text = await this.app.vault.cachedRead(file);
          if (str(text).length < 40) continue;
          const source = knowledgeRecord.normalizePath(file.path);
          let previousEntry = previousNotes[source] || null;
          if (previousEntry) usedPrevious.add(source);
          if (!previousEntry) {
            // A note can be deleted and recreated at a new path without a
            // rename event. Match the retained missing entry by content, never
            // by stealing a note that still exists at its old path.
            const hash = knowledgeRecord.contentHash(text);
            for (const [path, candidate] of Object.entries(previousNotes)) {
              if (!candidate || usedPrevious.has(path) || currentPaths.has(knowledgeRecord.normalizePath(path))) continue;
              if (candidate.contentHash && candidate.contentHash === hash) {
                previousEntry = candidate;
                usedPrevious.add(path);
                break;
              }
            }
          }
          const questions = questionsFor(source, previousEntry);
          const entry = knowledgeRecord.buildNoteEntry(source, text, questions, previousEntry, now);
          if (!entry.concepts.length) continue;
          next.notes[source] = entry;
          read++;
        } catch (e) {
          failed++;
        }
      }
      // A source note that was deleted or moved out of the scanned set keeps its
      // last concepts as owed work instead of disappearing on the next rebuild.
      // A content-matched recreation above is marked used, so it is not duplicated.
      for (const [path, entry] of Object.entries(previousNotes)) {
        if (next.notes[path] || usedPrevious.has(path) || currentPaths.has(knowledgeRecord.normalizePath(path))) continue;
        const kept = knowledgeRecord.markNoteMissing(entry, now);
        if (kept) next.notes[path] = kept;
      }
      next.updatedAt = now.toISOString();
      this.knowledgeRecord = next;
      this._knowledgeRecordLoaded = true;
      await knowledgeStore.saveRecord(this.app, next);
      const summary = knowledgeRecord.recordSummary(next, now);
      this.settings.knowledgeRecord = Object.assign(this.knowledgeRecordSettings(), {
        lastBuilt: now.toISOString(),
        notes: summary.notes,
        concepts: summary.concepts,
        known: summary.known,
        due: summary.due,
      });
      await this.save();
      if (!quiet) {
        new Notice(`Knowledge record: ${summary.concepts} concepts from ${summary.notes} notes (${summary.known} known, ${summary.due} due).`, 7000);
      }
      if (failed) new Notice(`${failed} note${failed === 1 ? "" : "s"} could not be read and were skipped.`, 5000);
      this.refreshViews();
      return Object.assign({ read, failed }, summary);
    })();
    try {
      return await this._knowledgeRecordBuild;
    } finally {
      this._knowledgeRecordBuild = null;
    }
  }

  async enableKnowledgeRecord() {
    this.settings.knowledgeRecord = Object.assign(this.knowledgeRecordSettings(), { enabled: true });
    await this.save();
    this._knowledgeRecordLoaded = false;
    return this.rebuildKnowledgeRecord({ quiet: true });
  }

  /** True when a vault file is a source note the record indexes. */
  knowledgeRecordScannable(file) {
    if (!file || !str(file.path).endsWith(".md")) return false;
    const path = knowledgeRecord.normalizePath(file.path);
    if (!path || path.startsWith("MCQ Tracker/") || path.startsWith(".")) return false;
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    return !isCardNote(fm) && !str(fm.question_id).trim();
  }

  /** The record entry for a note path, following the aliases a move leaves behind. */
  knowledgeRecordEntryFor(path) {
    const record = this.knowledgeRecord;
    const notes = (record && record.notes) || {};
    const wanted = knowledgeRecord.normalizePath(path);
    if (!wanted) return null;
    if (notes[wanted]) return { path: wanted, entry: notes[wanted] };
    for (const key of Object.keys(notes)) {
      const aliases = (notes[key] && notes[key].pathAliases) || [];
      if (aliases.some((alias) => knowledgeRecord.normalizePath(alias) === wanted)) return { path: key, entry: notes[key] };
    }
    return null;
  }

  /** The same content with no entry at its new path: the note moved behind our back. */
  knowledgeRecordByContent(text, excludePath) {
    const record = this.knowledgeRecord;
    const notes = (record && record.notes) || {};
    const hash = knowledgeRecord.contentHash(text);
    const exclude = knowledgeRecord.normalizePath(excludePath);
    for (const key of Object.keys(notes)) {
      const entry = notes[key];
      if (!entry || !entry.contentHash || entry.contentHash !== hash) continue;
      if (knowledgeRecord.normalizePath(key) === exclude) continue;
      // A note that still exists at its own path is never stolen by a duplicate.
      if (this.app.vault.getAbstractFileByPath(knowledgeRecord.normalizePath(key))) continue;
      return { path: key, entry };
    }
    return null;
  }

  /** Every question whose source_note names one of these paths or their basenames. */
  knowledgeQuestionsFor(paths) {
    const wanted = new Set();
    for (const path of Array.isArray(paths) ? paths : [paths]) {
      const clean = knowledgeRecord.normalizePath(path);
      if (!clean) continue;
      wanted.add(clean);
      wanted.add(clean.split("/").pop());
    }
    if (!wanted.size) return [];
    return this.getQuestions().filter((question) => {
      const source = knowledgeRecord.normalizePath(question && question.fm && question.fm.source_note);
      if (!source) return false;
      return wanted.has(source) || wanted.has(source.split("/").pop());
    });
  }

  knowledgeNotePaths(path, entry) {
    const list = [path, entry && entry.path, ...((entry && entry.pathAliases) || [])];
    return [...new Set(list.map((item) => knowledgeRecord.normalizePath(item)).filter(Boolean))];
  }

  /**
   * Rebuild one note's entry in place. A moved note is found through its path
   * aliases and a deleted-then-recreated note through its content hash, so the
   * concepts keep the ids, firstSeen and evidence they already had.
   */
  async refreshKnowledgeRecordSource(path, options) {
    if (!this.knowledgeRecordSettings().enabled) return null;
    await this.loadKnowledgeRecord();
    const record = this.knowledgeRecord || knowledgeRecord.emptyRecord();
    this.knowledgeRecord = record;
    const requested = knowledgeRecord.normalizePath(path);
    if (!requested) return null;
    const now = (options && options.now) || new Date();
    const found = this.knowledgeRecordEntryFor(requested);
    let previous = found ? found.entry : null;
    let previousPath = found ? found.path : "";
    let current = found ? knowledgeRecord.normalizePath(found.entry.path || found.path) || requested : requested;
    const lookup = (target) =>
      this.app.vault.getAbstractFileByPath(target) ||
      (this.app.metadataCache.getFirstLinkpathDest ? this.app.metadataCache.getFirstLinkpathDest(target, "") : null);
    let note = lookup(current);
    if (!note && current !== requested) {
      current = requested;
      note = lookup(current);
    }
    if (!note) {
      if (!previous) return null;
      const key = previousPath || current;
      record.notes[key] = knowledgeRecord.markNoteMissing(previous, now);
      record.updatedAt = now.toISOString();
      this.scheduleKnowledgeRecordSave();
      return record.notes[key];
    }
    if (!this.knowledgeRecordScannable(note)) return null;
    let text = "";
    try {
      text = await this.app.vault.cachedRead(note);
    } catch (e) {
      return null;
    }
    if (!previous) {
      const matched = this.knowledgeRecordByContent(text, current);
      if (matched) {
        previous = matched.entry;
        previousPath = matched.path;
      }
    }
    const questions = this.knowledgeQuestionsFor(this.knowledgeNotePaths(current, previous));
    const entry = knowledgeRecord.buildNoteEntry(current, text, questions, previous, now);
    if (!entry.concepts.length) {
      if (previous) {
        const key = previousPath || current;
        record.notes[key] = knowledgeRecord.markNoteMissing(previous, now);
        record.updatedAt = now.toISOString();
        this.scheduleKnowledgeRecordSave();
      }
      return null;
    }
    if (previousPath && previousPath !== current) delete record.notes[previousPath];
    for (const key of Object.keys(record.notes)) {
      if (key === current) continue;
      const aliases = (record.notes[key] && record.notes[key].pathAliases) || [];
      if (aliases.some((alias) => knowledgeRecord.normalizePath(alias) === current)) delete record.notes[key];
    }
    record.notes[current] = entry;
    record.updatedAt = now.toISOString();
    this.scheduleKnowledgeRecordSave();
    return entry;
  }

  /** Update one source note after an attempt, without rescanning the whole vault. */
  async refreshKnowledgeRecordFor(file) {
    if (!this.knowledgeRecordSettings().enabled) return null;
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    const source = knowledgeRecord.normalizePath(fm.source_note);
    if (!source) return null;
    return this.refreshKnowledgeRecordSource(source);
  }

  /** Move one entry in the record, keeping its note id and remembering the old path. */
  moveKnowledgeRecordEntry(from, to, now) {
    const record = this.knowledgeRecord;
    if (!record || !record.notes) return null;
    const source = knowledgeRecord.normalizePath(from);
    const target = knowledgeRecord.normalizePath(to);
    if (!source || !target || source === target) return null;
    const entry = record.notes[source] || (this.knowledgeRecordEntryFor(source) || {}).entry;
    if (!entry) return null;
    const at = (now || new Date()).toISOString();
    const moved = Object.assign({}, entry, {
      path: target,
      noteId: str(entry.noteId) || knowledgeRecord.hashText(source),
      label: knowledgeRecord.noteLabel(target),
      pathAliases: knowledgeRecord.notePathAliases([...((entry.pathAliases) || []), str(entry.path) || source], target),
      contentHash: str(entry.contentHash),
      missingAt: null,
      updatedAt: at,
      concepts: (Array.isArray(entry.concepts) ? entry.concepts : []).map((concept) => Object.assign({}, concept, { note: target })),
    });
    delete record.notes[source];
    for (const key of Object.keys(record.notes)) {
      if (key === target) continue;
      const aliases = (record.notes[key] && record.notes[key].pathAliases) || [];
      if (aliases.some((alias) => knowledgeRecord.normalizePath(alias) === target)) delete record.notes[key];
    }
    record.notes[target] = moved;
    record.updatedAt = at;
    return moved;
  }

  /** Coalesce vault activity into one incremental update per note. */
  scheduleKnowledgeRecordRefresh(path) {
    if (!this.knowledgeRecordSettings().enabled) return null;
    const clean = knowledgeRecord.normalizePath(path);
    if (!clean) return null;
    this._knowledgeRecordRefreshPaths.add(clean);
    if (this._knowledgeRecordRefreshTimer) return this._knowledgeRecordRefreshTimer;
    this._knowledgeRecordRefreshTimer = activeWindow.setTimeout(() => {
      this._knowledgeRecordRefreshTimer = null;
      this.flushKnowledgeRecordRefresh().catch(() => {});
    }, 600);
    return this._knowledgeRecordRefreshTimer;
  }

  async flushKnowledgeRecordRefresh() {
    if (this._knowledgeRecordRefreshTimer) {
      activeWindow.clearTimeout(this._knowledgeRecordRefreshTimer);
      this._knowledgeRecordRefreshTimer = null;
    }
    const paths = [...this._knowledgeRecordRefreshPaths];
    this._knowledgeRecordRefreshPaths.clear();
    let updated = 0;
    for (const path of paths) {
      if (await this.refreshKnowledgeRecordSource(path)) updated++;
    }
    if (updated) this.refreshViews();
    return updated;
  }

  scheduleKnowledgeRecordRebuild() {
    if (!this.knowledgeRecordSettings().enabled) return null;
    if (this._knowledgeRecordRebuildTimer) return this._knowledgeRecordRebuildTimer;
    this._knowledgeRecordRebuildTimer = activeWindow.setTimeout(() => {
      this._knowledgeRecordRebuildTimer = null;
      this.rebuildKnowledgeRecord({ quiet: true }).catch(() => {});
    }, 4000);
    return this._knowledgeRecordRebuildTimer;
  }

  async flushKnowledgeRecordRebuild() {
    if (this._knowledgeRecordRebuildTimer) {
      activeWindow.clearTimeout(this._knowledgeRecordRebuildTimer);
      this._knowledgeRecordRebuildTimer = null;
    }
    return this.rebuildKnowledgeRecord({ quiet: true });
  }

  /** A source note moved or was renamed: move its entry rather than recreating it. */
  async handleKnowledgeRecordRename(file, oldPath) {
    if (!this.knowledgeRecordSettings().enabled) return null;
    const from = knowledgeRecord.normalizePath(oldPath);
    if (!from || !file) return null;
    await this.loadKnowledgeRecord();
    const isFolder = file instanceof TFolder || (!(file instanceof TFile) && !str(file.extension));
    if (isFolder) {
      const prefix = `${from}/`;
      const root = knowledgeRecord.normalizePath(file.path);
      let moved = 0;
      for (const key of Object.keys((this.knowledgeRecord && this.knowledgeRecord.notes) || {})) {
        if (!key.startsWith(prefix)) continue;
        if (this.moveKnowledgeRecordEntry(key, `${root}${key.slice(from.length)}`)) moved++;
      }
      if (moved) {
        this.knowledgeRecord.updatedAt = new Date().toISOString();
        this.scheduleKnowledgeRecordSave();
        this.refreshViews();
      }
      return moved;
    }
    const to = knowledgeRecord.normalizePath(file.path);
    if (!to || to === from) return null;
    this.moveKnowledgeRecordEntry(from, to);
    // Questions may still point at the old path, so the entry is rebuilt from
    // the file itself plus the aliases the move just added.
    const entry = await this.refreshKnowledgeRecordSource(to);
    this.refreshViews();
    return entry;
  }

  /** A source note was deleted: keep its concepts as owed work, marked missing. */
  async handleKnowledgeRecordDelete(file) {
    if (!this.knowledgeRecordSettings().enabled || !file) return null;
    await this.loadKnowledgeRecord();
    const deleted = knowledgeRecord.normalizePath(file.path);
    if (!deleted) return null;
    const isFolder = file instanceof TFolder || (!(file instanceof TFile) && !str(file.extension));
    const record = this.knowledgeRecord || knowledgeRecord.emptyRecord();
    const now = new Date();
    let marked = 0;
    for (const key of Object.keys(record.notes || {})) {
      if (isFolder ? key !== deleted && !key.startsWith(`${deleted}/`) : key !== deleted) continue;
      const entry = record.notes[key];
      if (!entry || entry.missingAt) continue;
      record.notes[key] = knowledgeRecord.markNoteMissing(entry, now);
      marked++;
    }
    if (marked) {
      this.knowledgeRecord = record;
      record.updatedAt = now.toISOString();
      await knowledgeStore.saveRecord(this.app, record);
      this.refreshViews();
    }
    return marked;
  }

  /** A note came back, at the same path or a new one: relink it to what it owes. */
  async handleKnowledgeRecordCreate(file) {
    if (!this.knowledgeRecordSettings().enabled || !file) return null;
    if (!str(file.path).endsWith(".md")) return null;
    const fm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
    if (str(fm.question_id).trim()) {
      const source = knowledgeRecord.normalizePath(fm.source_note);
      return source ? this.scheduleKnowledgeRecordRefresh(source) : null;
    }
    if (!this.knowledgeRecordScannable(file)) return null;
    return this.scheduleKnowledgeRecordRefresh(file.path);
  }

  scheduleKnowledgeRecordSave() {
    if (this._knowledgeRecordSaveTimer) activeWindow.clearTimeout(this._knowledgeRecordSaveTimer);
    this._knowledgeRecordSaveTimer = activeWindow.setTimeout(() => {
      this._knowledgeRecordSaveTimer = null;
      if (this.knowledgeRecord) knowledgeStore.saveRecord(this.app, this.knowledgeRecord).catch(() => {});
    }, 1500);
  }

  learnerDigest(focusPath) {
    if (!this.knowledgeRecordSettings().enabled) return "";
    const active = focusPath || (this.app.workspace.getActiveFile ? (this.app.workspace.getActiveFile() || {}).path : "");
    return knowledgeRecord.buildLearnerDigest(this.knowledgeRecord, { focusPath: active, now: new Date() });
  }

  async copyLearnerDigest() {
    const text = this.learnerDigest();
    if (!text) {
      new Notice("Build the knowledge record first, then copy its digest.");
      return false;
    }
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable.");
      await navigator.clipboard.writeText(text);
      new Notice("Learner digest copied.");
      return true;
    } catch (e) {
      new Notice("Could not reach the clipboard. The digest is in Insights, Concepts.");
      return false;
    }
  }

  async activateInsights(tab) {
    if (this.moduleOff("mcq")) return;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_INSIGHTS)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_INSIGHTS, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) {
      if (tab) leaf.view.tab = tab;
      leaf.view.render();
    }
  }

  async activateTest() {
    if (this.moduleOff("mcq")) return;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_TEST)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_TEST, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
  }

  async activateQuickPractice() {
    const view = await this.activateView();
    if (view && view.startQuickSetup) view.startQuickSetup();
    return view;
  }

  /** Opens the optional Quizlet-style skin over the same MCQ notes. */
  async openStudySkin(skin) {
    if (!studySkinEnabled(this.settings) && !skin) {
      new Notice("Study cards are off. Turn them on under Settings, MCQ Tracker, Practice.");
      return null;
    }
    const view = await this.activateView();
    if (view && view.startStudySkin) await view.startStudySkin(skin || this.settings.studySkin);
    return view;
  }

  studySkinLabel() {
    return STUDY_SKIN_LABELS[normalizeStudySkin(this.settings.studySkin)] || STUDY_SKIN_LABELS.off;
  }

  /** One-time: notes imported before the rename have source_question_id. */
  async migrateOfficialIds() {
    let n = 0;
    for (const q of this.getQuestions()) {
      if (!q.fm.source_question_id) continue;
      await this.app.fileManager.processFrontMatter(q.file, (fm) => {
        if (!fm.source_question_id) return;
        if (!fm.official_question_id) fm.official_question_id = fm.source_question_id;
        delete fm.source_question_id;
        n++;
      });
    }
    new Notice(n ? `Renamed the property on ${n} note${n === 1 ? "" : "s"}.` : "No notes use source_question_id.");
  }

  /** Opens this plugin's page in Obsidian's settings (the settings window has no public API, so this is best effort). */
  openSettings() {
    const setting = this.app.setting;
    if (setting && setting.open) {
      setting.open();
      if (setting.openTabById) setting.openTabById(this.manifest.id);
    } else {
      new Notice("Open Settings, then MCQ Tracker, to continue.");
    }
  }

  openWelcome() {
    new WelcomeModal(this.app, this).open();
  }

  welcomeModuleOn(id) {
    if (id === "mcq") return this.mcqEnabled();
    if (id === "cards") return this.cardsEnabled();
    if (id === "calendar") return this.calendarEnabled();
    if (id === "assignments") return this.assignmentsEnabled();
    if (id === "reference") return this.referenceEnabled();
    return !!this.settings.ai.enabled;
  }

  async setWelcomeModule(id, enabled) {
    if (id === "mcq") {
      this.settings.mcqEnabled = enabled === true;
      await this.save();
      await this.onMcqToggled();
    } else if (id === "cards") {
      this.settings.cards.enabled = enabled === true;
      await this.save();
      await this.onCardsToggled();
    } else if (id === "calendar") {
      this.settings.calendar.enabled = enabled === true;
      await this.save();
      await this.onCalendarToggled();
    } else if (id === "assignments") {
      this.settings.assignments.enabled = enabled === true;
      await this.save();
      await this.onAssignmentsToggled();
    } else if (id === "reference") {
      this.settings.reference.enabled = enabled === true;
      await this.save();
      await this.onReferenceToggled();
    } else if (id === "ai") {
      this.settings.ai.enabled = enabled === true;
      await this.save();
      this.refreshViews();
    }
    this.refreshRibbon();
  }

  async applyWelcomePreset(id) {
    const preset = WELCOME_PRESETS.find((p) => p.id === id);
    if (!preset) return null;
    const m = preset.modules;
    this.settings.mcqEnabled = m.mcq === true;
    this.settings.cards.enabled = m.cards === true;
    this.settings.calendar.enabled = m.calendar === true;
    this.settings.ai.enabled = m.ai === true;
    this.settings.assignments.enabled = m.assignments === true;
    this.settings.reference.enabled = m.reference === true;
    if (preset.adaptive === true) this.settings.quickAdaptive = { ...(this.settings.quickAdaptive || {}), enabled: true };
    if (preset.adaptiveFrequency === true) this.settings.cards.adaptiveFrequency = true;
    await this.save();
    await this.onMcqToggled();
    await this.onCardsToggled();
    await this.onCalendarToggled();
    await this.onAssignmentsToggled();
    await this.onReferenceToggled();
    this.refreshViews();
    return preset;
  }

  openPdfImport(options) {
    if (this.moduleOff("mcq")) return;
    if (!this.settings.ai.enabled) {
      new Notice("Turn on AI features in the plugin settings to import from a file.");
      return;
    }
    new PdfImportModal(this.app, this, options).open();
  }

  openCourseNotesImport(onDone, options) {
    new CourseNotesModal(this.app, this, onDone, options).open();
  }

  openDocumentReview(options) {
    new DocumentReviewModal(this.app, this, options).open();
  }

  openOcr(onDone) {
    new OcrModal(this.app, this, onDone).open();
  }

  openPaperScanner(onDone) {
    new PaperScannerModal(this.app, this, onDone).open();
  }

  openPdfAnnotation(pdfPath) {
    if (this.moduleOff("mcq")) return;
    new PdfAnnotationModal(this.app, this, { pdfPath: pdfPath || "" }).open();
  }

  openPdfInk(pdfPath, options) {
    if (this.moduleOff("mcq")) return;
    const extra = options && typeof options === "object" ? options : {};
    new PdfInkModal(this.app, this, { ...extra, pdfPath: pdfPath || extra.pdfPath || "" }).open();
  }

  /** Opens a PDF deep link in the reader on its page, with its rectangle ringed. */
  openPdfDeepLink(link) {
    if (this.moduleOff("mcq")) return null;
    const parsed = pdfDeepLink.parsePdfDeepLink(link);
    if (!parsed.valid) {
      new Notice("That is not a PDF deep link. Copy one from an annotation or the reader.");
      return null;
    }
    if (!this.app.vault.getAbstractFileByPath(parsed.path)) {
      new Notice(`There is no ${parsed.path} in this vault.`);
      return null;
    }
    this.openPdfInk(parsed.path, { page: parsed.page, rect: parsed.rect, annotation: parsed.annotation });
    return parsed;
  }

  /** Reads an EPUB from the vault: container, package, spine and chapter text. */
  async epubBook(path) {
    const file = this.app.vault.getAbstractFileByPath(str(path));
    if (!file) throw new Error(`There is no ${str(path)} in this vault.`);
    if (!/\.epub$/i.test(file.path || str(path))) throw new Error(`${str(path)} is not an EPUB; open an .epub file.`);
    return epub.readEpub(await this.app.vault.readBinary(file));
  }

  /** The annotation sidecar beside the book, or an empty set before the first highlight. */
  async epubAnnotations(path) {
    const sidecar = epubAnnotations.sidecarPathFor(path);
    const file = this.app.vault.getAbstractFileByPath(sidecar);
    if (!file) return { path: sidecar, epubPath: str(path), epubHash: "", annotations: [], damaged: [] };
    return { ...epubAnnotations.parseSidecar(await this.app.vault.cachedRead(file)), path: sidecar, epubPath: str(path) };
  }

  /** Adds or updates one highlight, anchored to the real chapter text, and writes the sidecar. */
  async addEpubHighlight(path, input) {
    const file = this.app.vault.getAbstractFileByPath(str(path));
    if (!file) throw new Error(`There is no ${str(path)} in this vault.`);
    const bytes = await this.app.vault.readBinary(file);
    const book = await epub.readEpub(bytes);
    const source = input && typeof input === "object" ? input : {};
    const number = Math.round(Number(source.chapter));
    const chapter = book.chapters.find((entry) => entry.n === number);
    if (!chapter) throw new Error(`Chapter ${str(source.chapter)} is not in ${epub.epubBaseName(path)} (1 to ${book.total}).`);
    const sidecar = epubAnnotations.sidecarPathFor(path);
    const existing = this.app.vault.getAbstractFileByPath(sidecar);
    const text = existing ? await this.app.vault.cachedRead(existing) : "";
    const result = epubAnnotations.addAnnotation(text, source, {
      chapterText: chapter.text,
      epubPath: str(path),
      hash: epubAnnotations.epubHash(bytes),
    });
    if (result.error) throw new Error(result.error);
    if (existing) await this.app.vault.modify(existing, result.text);
    else await this.app.vault.create(sidecar, result.text);
    return { annotation: result.annotation, annotations: result.annotations, path: sidecar };
  }

  /** Removes one annotation by id; false when the book has no such annotation. */
  async deleteEpubAnnotation(path, id) {
    const sidecar = epubAnnotations.sidecarPathFor(path);
    const file = this.app.vault.getAbstractFileByPath(sidecar);
    if (!file) return false;
    const result = epubAnnotations.removeAnnotation(await this.app.vault.cachedRead(file), id);
    if (!result.removed) return false;
    await this.app.vault.modify(file, result.text);
    return true;
  }

  openEpubReader(path) {
    if (this.moduleOff("mcq")) return null;
    new EpubReaderModal(this.app, this, { path: str(path) }).open();
    return true;
  }

  /** The reader's command entry: it needs an open EPUB. */
  openActiveEpubReader() {
    const active = this.app.workspace.getActiveFile();
    if (!active || !/\.epub$/i.test(active.path)) {
      new Notice("Open an EPUB first, then run the reader again.");
      return;
    }
    this.openEpubReader(active.path);
  }

  /** Opens the sidecar note, so the annotations are editable as Markdown too. */
  openEpubAnnotations(path) {
    const target = str(path) || str((this.app.workspace.getActiveFile() || {}).path);
    if (!/\.epub$/i.test(target)) {
      new Notice("Open an EPUB first.");
      return;
    }
    const sidecar = epubAnnotations.sidecarPathFor(target);
    if (!this.app.vault.getAbstractFileByPath(sidecar)) {
      new Notice(`No EPUB annotations yet: ${sidecar} appears after the first highlight.`);
      return;
    }
    this.app.workspace.openLinkText(sidecar, "", false);
  }

  openPdfEditor(pdfPath) {
    if (this.moduleOff("mcq")) return;
    new PdfEditorModal(this.app, this, { pdfPath: pdfPath || "" }).open();
  }

  /** The editor's command entry: it needs an open PDF to edit. */
  openActivePdfEditor() {
    const active = this.app.workspace.getActiveFile();
    if (!active || !/\.pdf$/i.test(active.path)) {
      new Notice("Open a PDF first, then run the editor again.");
      return;
    }
    this.openPdfEditor(active.path);
  }

  /**
   * Writes edited PDF bytes beside the original under a new name. The source
   * file, its sidecar and its stored hash are never touched, so annotations
   * keep pointing at the PDF they were drawn on.
   */
  async savePdfCopy(originalPath, bytes, label) {
    const path = editedPathFor(originalPath, (candidate) => Boolean(this.app.vault.getAbstractFileByPath(candidate)), label);
    const file = await this.app.vault.createBinary(path, bytes);
    return { path, file };
  }


  /** Rows for one PDF's sidecar, including tags and mark areas. */
  async pdfAnnotationRows(pdfPath) {
    const source = String(pdfPath || "").trim();
    const path = sidecarPathFor(source);
    const file = source ? this.app.vault.getAbstractFileByPath(path) : null;
    if (!file) return { pdfPath: source, sidecarPath: path, pdfHash: "", rows: [] };
    const parsed = parseAnnotationFile(await this.app.vault.cachedRead(file));
    const rows = (parsed.annotations || []).map((annotation) => ({
      id: annotation.id,
      pdfPath: source,
      sidecarPath: path,
      page: annotation.page,
      type: annotation.type,
      color: annotation.color,
      quote: annotation.quote,
      note: annotation.note,
      text: annotation.text,
      tags: annotation.tags,
      areas: annotation.areas,
      summary: annotationSummary(annotation),
      createdAt: annotation.createdAt,
      updatedAt: annotation.updatedAt,
    }));
    return { pdfPath: source, sidecarPath: path, pdfHash: parsed.pdfHash, rows };
  }

  /** Markdown links elsewhere in the vault that annotate this PDF. */
  async pdfBacklinkRows(pdfPath) {
    const source = String(pdfPath || "").trim();
    if (!source || !/\.pdf$/i.test(source)) return [];
    const all = typeof this.app.vault.getMarkdownFiles === "function" ? this.app.vault.getMarkdownFiles() : [];
    const notes = [];
    let chars = 0;
    for (const file of all.slice(0, 1200)) {
      if (!file || !/\.md$/i.test(file.path || "") || /\.annotations\.md$/i.test(file.path || "")) continue;
      try {
        const text = await this.app.vault.cachedRead(file);
        if (!text) continue;
        chars += text.length;
        notes.push({ path: file.path, text });
      } catch (e) {
        /* an open note being written is not a reader failure */
      }
      if (chars >= 4000000) break;
    }
    return pdfBacklinks.collectPdfBacklinks(notes, source);
  }

  /** Opens the Markdown note behind a backlink highlight. */
  async openPdfBacklink(row) {
    const path = String((row && row.sourcePath) || "").trim();
    if (!path) return false;
    try {
      await this.app.workspace.openLinkText(path, "", false);
      return true;
    } catch (e) {
      new Notice("Could not open " + path + ".");
      return false;
    }
  }

  /** Rewrites one annotation's note in place and stamps it. */
  async updatePdfAnnotationNote(pdfPath, id, note) {
    const source = String(pdfPath || "").trim();
    const path = sidecarPathFor(source);
    const file = await this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    const parsed = parseAnnotationFile(await this.app.vault.cachedRead(file));
    const current = (parsed.annotations || []).find((annotation) => annotation.id === id);
    if (!current) return null;
    const next = upsertAnnotation(await this.app.vault.cachedRead(file), { ...current, note: String(note || "").trim(), updatedAt: new Date().toISOString() }, { pdfPath: source, pdfHash: parsed.pdfHash });
    await this.app.vault.modify(file, next.text);
    return (await this.pdfAnnotationRows(source)).rows.find((row) => row.id === id) || null;
  }

  /** Replaces one annotation's tags with the bounded, hash-free tag list. */
  async updatePdfAnnotationTags(pdfPath, id, tags) {
    const source = String(pdfPath || "").trim();
    const path = sidecarPathFor(source);
    const file = await this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseAnnotationFile(text);
    const current = (parsed.annotations || []).find((annotation) => annotation.id === id);
    if (!current) return null;
    const next = upsertAnnotation(text, { ...current, tags: normalizeTags(tags), updatedAt: new Date().toISOString() }, { pdfPath: source, pdfHash: parsed.pdfHash });
    await this.app.vault.modify(file, next.text);
    this.pdfAnnotationRevision = (this.pdfAnnotationRevision || 0) + 1;
    return (await this.pdfAnnotationRows(source)).rows.find((row) => row.id === id) || null;
  }

  /** Removes one annotation and returns how many the sidecar still holds. */
  async deletePdfAnnotation(pdfPath, id) {
    const source = String(pdfPath || "").trim();
    const path = sidecarPathFor(source);
    const file = await this.app.vault.getAbstractFileByPath(path);
    if (!file) return 0;
    const parsed = parseAnnotationFile(await this.app.vault.cachedRead(file));
    const next = removeAnnotation(await this.app.vault.cachedRead(file), id, { pdfPath: source, pdfHash: parsed.pdfHash });
    await this.app.vault.modify(file, next.text);
    this.pdfAnnotationRevision = (this.pdfAnnotationRevision || 0) + 1;
    this.refreshViews();
    return next.annotations.length;
  }

  /**
   * Send a passage from the PDF reader to the Study agent. The prompt names the
   * page and annotation link, and the existing chat owns the provider request.
   */
  async askPdfPassage(pdfPath, row, question) {
    const source = String(pdfPath || "").trim();
    if (!source || !/\.pdf$/i.test(source)) {
      new Notice("Open a PDF first, then ask about a passage.");
      return false;
    }
    const ai = this.settings && this.settings.ai;
    if (!ai || ai.enabled !== true) {
      new Notice("Turn on AI under Settings > Study agent > AI and the assistant to ask about a passage.");
      return false;
    }
    const prompt = readingCompanion.passagePrompt(source, row, question);
    if (!prompt) {
      new Notice("That annotation has no quote or note to ask about.");
      return false;
    }
    try {
      const view = await this.activateAgent();
      if (!view || typeof view.askPassage !== "function") {
        new Notice("The Study agent could not open.");
        return false;
      }
      if (!(await view.askPassage(prompt))) {
        new Notice("The Study agent is busy or not ready. Nothing was sent.");
        return false;
      }
      return true;
    } catch (e) {
      new Notice(`Could not ask the Study agent: ${String(e && e.message ? e.message : e)}`);
      return false;
    }
  }

  /** Writes a Markdown digest beside the PDF, numbered instead of overwriting. */
  async exportPdfAnnotations(pdfPath) {
    const data = await this.pdfAnnotationRows(pdfPath);
    return this.writePdfAnnotationDigest(data.rows, data.pdfPath.replace(/^.*\//, "").replace(/\.pdf$/i, ""));
  }

  async writePdfAnnotationDigest(rows, label) {
    const text = annotationsMarkdown(rows, { title: `Annotations — ${String(label || "PDF")}` });
    if (!text) return null;
    const folder = (rows[0] && rows[0].sidecarPath ? rows[0].sidecarPath.replace(/[^/]*$/, "") : "");
    const base = `${folder}${String(label || "PDF").replace(/[\\/:*?"<>|]/g, "")} annotations`;
    let path = `${base}.md`;
    for (let n = 2; this.app.vault.getAbstractFileByPath(path) && n < 100; n++) path = `${base} ${n}.md`;
    const file = await this.app.vault.create(path, text);
    if (this.app.workspace.getLeaf) await this.app.workspace.getLeaf("tab").openFile(file);
    return path;
  }

  /** The last page read in a PDF, from local storage (never the vault). */
  pdfLastPage(pdfPath) {
    const map = this.app.loadLocalStorage("mcq-pdf-last-page") || {};
    const page = Math.round(Number(map[String(pdfPath || "")]) || 0);
    return page > 0 ? page : 0;
  }

  rememberPdfPage(pdfPath, page) {
    const key = String(pdfPath || "").trim();
    if (!key) return;
    const map = { ...(this.app.loadLocalStorage("mcq-pdf-last-page") || {}) };
    map[key] = Math.max(1, Math.round(Number(page) || 1));
    const keys = Object.keys(map);
    while (keys.length > 100) delete map[keys.shift()];
    this.app.saveLocalStorage("mcq-pdf-last-page", map);
  }

  /** Export the active PDF's annotations without opening the reader. */
  async exportActivePdfAnnotations() {
    const active = this.app.workspace.getActiveFile();
    const path = active && /\.pdf$/i.test(active.path) ? active.path : "";
    if (!path) {
      new Notice("Open a PDF first.");
      return;
    }
    const written = await this.exportPdfAnnotations(path);
    new Notice(written ? `Wrote ${written}.` : "No annotations to export yet.");
  }

  async openPdfAnnotations(pdfPath) {
    if (this.moduleOff("mcq")) return;
    const active = this.app.workspace.getActiveFile();
    const source = pdfPath || (active && /\.pdf$/i.test(active.path) ? active.path : "");
    if (!source) {
      new Notice("Open a PDF first, or run Add PDF annotation.");
      return;
    }
    const path = sidecarPathFor(source);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      new Notice("No annotations yet. Use Add PDF annotation to create the sidecar.");
      return;
    }
    await this.app.workspace.getLeaf("tab").openFile(file);
  }

  onunload() {
    if (this._quickChatModal) {
      try {
        this._quickChatModal.close();
      } catch (e) {
        /* the modal may already be closed */
      }
      this._quickChatModal = null;
    }
    practiceFullscreen.setPracticeFullscreen(null, false);
    if (this.manager) this.manager.stop();
    this.pdfPlusPaused = true;
    this.pdfPlusUiDepth = 0;
    pdfPlus.stop(this).catch(() => {});
  }

  /* ---- distraction-free practice ---- */

  activePracticeView() {
    const ws = this.app && this.app.workspace;
    const leaf = ws && ws.activeLeaf;
    const view = leaf && leaf.view;
    if (view && typeof view.getViewType === "function" && view.getViewType() === VIEW_TYPE) return view;
    return null;
  }

  isPracticeViewActive(view) {
    const ws = this.app && this.app.workspace;
    const leaf = ws && ws.activeLeaf;
    if (!leaf) return true;
    return leaf === view.leaf || leaf.view === view;
  }

  /** Recompute the one body class from the active view, session state and setting. */
  syncPracticeFullscreen(view) {
    const active = this.activePracticeView();
    const candidate = view && this.isPracticeViewActive(view) ? view : active;
    const on = practiceFullscreen.shouldHidePracticeChrome({
      enabled: !this.settings || this.settings.distractionFreePractice !== false,
      isMobile: practiceFullscreen.isMobileDocument(),
      active: !!(candidate && typeof candidate.isPracticeSessionActive === "function" && candidate.isPracticeSessionActive()),
    });
    practiceFullscreen.setPracticeFullscreen(null, on);
  }

  /* ---- views */

  async activateView() {
    if (this.moduleOff("mcq")) return null;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    return leaf.view;
  }

  async activateToday() {
    if (this.moduleOff("mcq")) return null;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_TODAY)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_TODAY, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  refreshViews() {
    this.invalidateSnapshots();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TODAY)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CARDS)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_REFERENCE)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ASSIGNMENTS)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_TOOLS)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_STUDY_WORKSPACE)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
    for (const type of [VIEW_TYPE_REVIEW_CALENDAR, VIEW_TYPE_STUDY_STATS, VIEW_TYPE_LOCAL_EVENTS, VIEW_TYPE_POMODORO, VIEW_TYPE_TASK_LIST]) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        if (leaf.view && leaf.view.render) leaf.view.render();
      }
    }
    this.refreshNoteReviewDock();
    this.refreshNoteReviewStatus();
    this.refreshPomodoro();
    this.decorateFileExplorer();
  }

  /** Optional due/new markers; the internal explorer view is treated as optional. */
  decorateFileExplorer() {
    if (!this.settings.cards || this.settings.cards.fileExplorerDue !== true) return 0;
    try {
      return fileExplorer.decorateFileExplorer(this.app, this.getCards(), localDate(), true);
    } catch (e) {
      return 0;
    }
  }

  /** Re-draws only the practice views that are showing the first-run screen (an import just finished). */
  refreshEmptyViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view && leaf.view.emptyShown && leaf.view.render) leaf.view.render();
    }
  }

  /* ---- calendar (off by default) */

  calendarEnabled() {
    return !!(this.settings.calendar && this.settings.calendar.enabled);
  }

  calendarSettings() {
    return this.settings.calendar;
  }

  calendarSources() {
    return (this.settings.calendar.sources || []).slice();
  }

  /** University Schedule and Calendar owns the `uni-schedule` block when it is enabled. */
  otherCalendarPluginActive() {
    try {
      const plugins = this.app.plugins;
      if (!plugins) return false;
      if (plugins.enabledPlugins && typeof plugins.enabledPlugins.has === "function") return plugins.enabledPlugins.has("university-calendar");
      return !!(plugins.plugins && plugins.plugins["university-calendar"]);
    } catch (e) {
      return false;
    }
  }

  /* ---- modules and the ribbon */

  /** The MCQ Tracker module (practice, weak spots, timed tests, import) is on unless it was turned off. */
  mcqEnabled() {
    return this.settings.mcqEnabled !== false;
  }

  /** Flashcards and vocabulary are opt-in. */
  cardsEnabled() {
    return !!(this.settings.cards && this.settings.cards.enabled);
  }

  noteReviewDockEnabled() {
    return noteReviewDock.normalizeNoteReviewDockSettings(this.settings.noteReviewDock).enabled;
  }

  reviewCalendarEnabled() {
    return reviewCalendar.normalizeReviewCalendarSettings(this.settings.reviewCalendar).enabled;
  }

  studyStatsEnabled() {
    return studyStats.normalizeStudyStatsSettings(this.settings.studyStats).enabled;
  }

  localEventsEnabled() {
    return localEvents.normalizeLocalEventsSettings(this.settings.localEvents).enabled;
  }

  pomodoroEnabled() {
    return pomodoro.normalizePomodoroSettings(this.settings.pomodoro).enabled;
  }

  /** The local formula sheet and unit converter are opt-in. */
  referenceEnabled() {
    return !!(this.settings.reference && this.settings.reference.enabled);
  }

  /** Cornell notes are an independent local module. */
  cornellNotesEnabled() {
    return studyTools.normalizeCornellSettings(this.settings.cornellNotes).enabled;
  }

  /** The local lecture log is an independent module. */
  lectureLogEnabled() {
    return studyTools.normalizeLectureLog(this.settings.lectureLog).enabled;
  }

  /** Local study goals are an independent module. */
  studyGoalsEnabled() {
    return studyTools.normalizeStudyGoals(this.settings.studyGoals).enabled;
  }

  /** Any of the independent study tools is enabled. */
  studyToolsEnabled() {
    return this.cornellNotesEnabled() || this.lectureLogEnabled() || this.studyGoalsEnabled();
  }

  studyToolsSettings() {
    return studyTools.normalizeStudyToolsSettings(this.settings);
  }

  /** Guided/local workflow modules are independent switches. */
  feynmanLearningEnabled() {
    return studyWorkspace.normalizeFeynmanSettings(this.settings.feynmanLearning).enabled;
  }

  recallSchedulerEnabled() {
    return studyWorkspace.normalizeRecallScheduler(this.settings.recallScheduler).enabled;
  }

  lerntrackerEnabled() {
    return studyWorkspace.normalizePlanner(this.settings.lerntracker).enabled;
  }

  studyFlowEnabled() {
    return studyWorkspace.normalizeStudyFlow(this.settings.studyFlow).enabled;
  }

  subjectManagerEnabled() {
    return studyWorkspace.normalizeSubjectManager(this.settings.subjectManager).enabled;
  }

  quizIndexEnabled() {
    return studyWorkspace.normalizeQuizIndex(this.settings.quizIndex).enabled;
  }

  quizMakerEnabled() {
    return normalizeQuizMakerSettings(this.settings.quizMaker).enabled;
  }

  satMathEnabled() {
    return normalizeSatMathSettings(this.settings.satMath).enabled;
  }

  sfcCardsEnabled() {
    return normalizeSfcCardsSettings(this.settings.sfcCards).enabled;
  }

  cbtExamEnabled() {
    return normalizeCbtExamSettings(this.settings.cbtExam).enabled;
  }

  schedulerFitEnabled() {
    return normalizeSchedulerFitSettings(this.settings.schedulerFit).enabled;
  }

  studyMapEnabled() {
    return normalizeStudyMapSettings(this.settings.studyMap).enabled;
  }

  vaultSearchEnabled() {
    return normalizeVaultSearchSettings(this.settings.vaultSearch).enabled;
  }

  cardArchiveEnabled() {
    return normalizeCardArchiveSettings(this.settings.cardArchive).enabled;
  }

  studyNudgeEnabled() {
    return normalizeStudyNudgeSettings(this.settings.studyNudge).enabled;
  }

  courseTemplatesEnabled() {
    return normalizeCourseTemplates(this.settings.courseTemplates).enabled;
  }

  courseTemplatesSettings() {
    return normalizeCourseTemplates(this.settings.courseTemplates);
  }

  courseHubEnabled() {
    return studyWorkspace.normalizeCourseHub(this.settings.courseHub).enabled;
  }

  studyTasksEnabled() {
    return studyWorkspace.normalizeStudyTasks(this.settings.studyTasks).enabled;
  }

  annotationsEnabled() {
    return studyWorkspace.normalizeAnnotations(this.settings.annotations).enabled;
  }

  deepNotesEnabled() {
    return studyWorkspace.normalizeDeepNotes(this.settings.deepNotes).enabled;
  }

  retentionEnabled() {
    return studyWorkspace.normalizeRetention(this.settings.retention).enabled;
  }

  vocabularyEnabled() {
    return studyWorkspace.normalizeVocabulary(this.settings.vocabulary).enabled;
  }

  tableEditorEnabled() {
    return tableEditor.normalizeTableEditorSettings(this.settings.tableEditor).enabled;
  }

  readingLibraryEnabled() {
    return this.readingLibrarySettings().enabled;
  }

  readAloudEnabled() {
    return readAloud.normalizeReadAloudSettings(this.settings.readAloud).enabled;
  }

  lectureCompilerEnabled() {
    return lectureCompiler.normalizeLectureCompilerSettings(this.settings.lectureCompiler).enabled;
  }

  courseHealthEnabled() {
    return courseHealth.normalizeCourseHealthSettings(this.settings.courseHealth).enabled;
  }

  audioBookmarksEnabled() {
    return audioBookmarks.normalizeAudioBookmarkSettings(this.settings.audioBookmarks).enabled;
  }

  feynmanAiEnabled() {
    return feynmanAi.normalizeFeynmanAiSettings(this.settings.feynmanAi).enabled;
  }

  pdfAnnotationIndexEnabled() {
    return pdfAnnotationIndex.normalizePdfAnnotationIndexSettings(this.settings.pdfAnnotationIndex).enabled;
  }

  timeBlocksEnabled() {
    return timeBlocks.normalizeTimeBlocks(this.settings.timeBlocks).enabled;
  }

  citationsEnabled() {
    return citations.normalizeCitationSettings(this.settings.citations).enabled;
  }

  citationsSettings() {
    return citations.normalizeCitationSettings(this.settings.citations);
  }

  studyWorkspaceEnabled() {
    return this.feynmanLearningEnabled() || this.recallSchedulerEnabled() || this.lerntrackerEnabled() || this.studyFlowEnabled() || this.subjectManagerEnabled() || this.quizIndexEnabled() || this.courseHubEnabled() || this.studyTasksEnabled() || this.timeBlocksEnabled() || this.citationsEnabled() || this.annotationsEnabled() || this.deepNotesEnabled() || this.retentionEnabled() || this.vocabularyEnabled() || this.readAloudEnabled() || this.lectureCompilerEnabled() || this.courseHealthEnabled() || this.audioBookmarksEnabled() || this.feynmanAiEnabled() || this.pdfAnnotationIndexEnabled() || this.readingLibraryEnabled();
  }

  studyWorkspaceSettings() {
    return studyWorkspace.normalizeStudyWorkspaceSettings(this.settings);
  }

  async uniqueVaultPath(path) {
    let candidate = path;
    let index = 2;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = path.replace(/(\.[^.]+)$/, ` ${index}$1`);
      index += 1;
    }
    return candidate;
  }

  /** Export the open canvas as a Markdown outline; the canvas itself is never written. */
  async exportCanvasToMarkdown() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const parsed = canvasMarkdown.parseCanvas(await this.app.vault.read(file));
    if (!parsed.ok) {
      new Notice(parsed.message);
      return parsed;
    }
    const converted = canvasMarkdown.canvasToOutline(parsed.canvas);
    const path = await this.uniqueVaultPath(file.path.replace(/\.canvas$/i, "") + " outline.md");
    await this.app.vault.create(path, converted.markdown);
    new Notice(`Wrote ${path} from ${converted.stats.cards} cards.`);
    return { ok: true, path, cards: converted.stats.cards };
  }

  /** Build a JSON Canvas board from the open note's heading/bullet outline. */
  async boardFromActiveNote() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.md$/i.test(file.path)) {
      new Notice("Open a Markdown note first.");
      return { ok: false, reason: "file", message: "Open a Markdown note first." };
    }
    const converted = canvasMarkdown.outlineToCanvas(await this.app.vault.read(file));
    if (!converted.ok) {
      new Notice(converted.message);
      return converted;
    }
    const path = await this.uniqueVaultPath(file.path.replace(/\.md$/i, "") + ".canvas");
    await this.app.vault.create(path, canvasMarkdown.serializeCanvas(converted.canvas));
    new Notice(`Wrote ${path} with ${converted.canvas.nodes.length} cards.`);
    return { ok: true, path, cards: converted.canvas.nodes.length };
  }

  /** The remembered card for one board, so the walk continues where it stopped. */
  canvasCursor(file) {
    const cursor = this.canvasWalk;
    return cursor && cursor.path === file.path ? cursor.id : "";
  }

  /** One step of mind-map navigation from the cursor; the board file is never written. */
  async walkCanvas(direction) {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const parsed = canvasMarkdown.parseCanvas(await this.app.vault.read(file));
    if (!parsed.ok) {
      new Notice(parsed.message);
      return parsed;
    }
    const resolved = canvasMap.resolveTree(parsed.canvas);
    if (!resolved.ok) {
      new Notice(resolved.message);
      return resolved;
    }
    const tree = resolved.tree;
    const remembered = tree.byId.get(this.canvasCursor(file));
    if (!remembered) {
      this.canvasWalk = { path: file.path, id: tree.root.id };
      const revealed = await this.revealCanvasCard(file, tree.root);
      const message = 'Mind map: "' + canvasMarkdown.labelOf(tree.root) + '" is the root card.';
      new Notice(message);
      return { ok: true, id: tree.root.id, root: true, revealed, message };
    }
    const step = canvasMap.neighbour(tree, remembered.id, direction);
    if (!step.ok) {
      new Notice(step.message);
      return step;
    }
    this.canvasWalk = { path: file.path, id: step.id };
    const revealed = await this.revealCanvasCard(file, step.card);
    const message = 'Mind map: focused "' + canvasMarkdown.labelOf(step.card) + '".';
    new Notice(message);
    return { ok: true, id: step.id, card: step.card, revealed, message };
  }

  /**
   * Optional reveal. Obsidian has no public "focus this canvas card" API, so an
   * open canvas view is used only when it already exposes one: feature-detected,
   * guarded, and never patched. The notice above always names the card.
   */
  async revealCanvasCard(file, card) {
    try {
      const leaves = this.app.workspace && typeof this.app.workspace.getLeavesOfType === "function" ? this.app.workspace.getLeavesOfType("canvas") : [];
      for (const leaf of leaves || []) {
        const view = leaf && leaf.view;
        if (!view || !view.file || view.file.path !== file.path) continue;
        const api = view.canvas;
        if (!api || !api.nodes || typeof api.nodes.get !== "function") continue;
        const node = api.nodes.get(card.id);
        if (!node) continue;
        if (api.selection && typeof api.selection.clear === "function") api.selection.clear();
        if (api.selection && typeof api.selection.add === "function") api.selection.add(node);
        if (typeof api.zoomToSelection === "function") api.zoomToSelection();
        if (typeof api.requestFrame === "function") api.requestFrame();
        return true;
      }
    } catch (error) {
      /* the notice still names the card */
    }
    return false;
  }

  /** Arrange the open board as a tree; only each card's x and y are written. */
  async layoutActiveCanvas() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const laid = canvasMap.layoutCanvas(await this.app.vault.read(file));
    if (!laid.ok) {
      new Notice(laid.message);
      return laid;
    }
    if (!laid.changed) {
      const message = "That board is already arranged (" + laid.stats.cards + " cards).";
      new Notice(message);
      return { ok: true, path: file.path, changed: false, stats: laid.stats, message };
    }
    await this.app.vault.modify(file, laid.text);
    const loose = laid.stats.orphans ? " and " + laid.stats.orphans + " loose card" + (laid.stats.orphans === 1 ? "" : "s") + " beside it" : "";
    const message = "Arranged " + laid.stats.placed + " cards" + loose + ".";
    new Notice(message);
    return { ok: true, path: file.path, changed: true, stats: laid.stats, message };
  }

  /** Show the board's kanban columns and the cards that belong to none of them. */
  async reportCanvasKanban() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const report = canvasKanban.kanbanReport(await this.app.vault.read(file));
    if (!report.ok) {
      new Notice(report.message);
      return report;
    }
    new KanbanReportModal(this.app, report).open();
    new Notice(report.summary);
    return report;
  }

  /** Re-stack the open board's columns; only coordinates and group frames are written. */
  async restackCanvasKanban() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const stacked = canvasKanban.restackColumns(await this.app.vault.read(file));
    if (!stacked.ok) {
      new Notice(stacked.message);
      return stacked;
    }
    if (!stacked.changed) {
      const message = "Those columns are already stacked (" + stacked.stats.cards + " cards).";
      new Notice(message);
      return { ok: true, path: file.path, changed: false, mode: stacked.mode, stats: stacked.stats, message };
    }
    await this.app.vault.modify(file, stacked.text);
    const message = "Stacked " + stacked.stats.cards + " cards into " + stacked.stats.columns + (stacked.stats.columns === 1 ? " column" : " columns") + ".";
    new Notice(message);
    return { ok: true, path: file.path, changed: true, mode: stacked.mode, stats: stacked.stats, message };
  }

  /** Show the edges auto-link would add, plus everything it refuses to guess at. */
  async reportCanvasLinks() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const report = canvasAutoLink.linkReport(await this.app.vault.read(file));
    if (!report.ok) {
      new Notice(report.message);
      return report;
    }
    new LinkReportModal(this.app, report).open();
    new Notice(report.summary);
    return report;
  }

  /** Add the proposed edges to the open board; no node is touched. */
  async applyCanvasLinks() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const linked = canvasAutoLink.applyLinks(await this.app.vault.read(file));
    if (!linked.ok) {
      new Notice(linked.message);
      return linked;
    }
    if (!linked.changed) {
      const message = "No new links; that board is already linked (" + linked.stats.nodes + " cards).";
      new Notice(message);
      return { ok: true, path: file.path, changed: false, stats: linked.stats, summary: linked.summary, message };
    }
    await this.app.vault.modify(file, linked.text);
    const count = linked.applied.length;
    const message = "Added " + count + (count === 1 ? " link" : " links") + "; " + linked.summary;
    new Notice(message);
    return { ok: true, path: file.path, changed: true, applied: linked.applied, stats: linked.stats, summary: linked.summary, message };
  }

  /** Show the slide plan a presentation would walk through, without drawing it. */
  async reportCanvasPresentation() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const report = canvasPresentations.presentationReport(await this.app.vault.read(file));
    if (!report.ok) {
      new Notice(report.message);
      return report;
    }
    new PresentationPlanModal(this.app, report).open();
    new Notice(report.summary);
    return report;
  }

  /** Walk the open board as a read-only deck; the board is never written. */
  async presentActiveCanvas() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const plan = canvasPresentations.presentationPlan(await this.app.vault.read(file));
    if (!plan.ok) {
      new Notice(plan.message);
      return plan;
    }
    const modal = new PresentationModal(this.app, plan, (step) => {
      new Notice("Slide " + (step.index + 1) + " of " + step.total + ": " + step.slide.title);
    });
    modal.open();
    const first = plan.slides[0];
    const total = plan.slides.length;
    new Notice("Presenting " + total + (total === 1 ? " slide" : " slides") + ". Slide 1 of " + total + ": " + first.title);
    return { ok: true, path: file.path, slides: total, mode: plan.mode, summary: plan.summary, stats: plan.stats, modal };
  }

  /** Show the query groups on the open board and what each one would match. */
  async reportCanvasQueryGroups() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const report = canvasQuery.queryReport(await this.app.vault.read(file));
    if (!report.ok) {
      new Notice(report.message);
      return report;
    }
    new QueryGroupsModal(this.app, report).open();
    new Notice(report.summary);
    return report;
  }

  /** Fit each query group's frame around its matches; no card is moved. */
  async applyCanvasQueryGroups() {
    const file = typeof this.app.workspace.getActiveFile === "function" ? this.app.workspace.getActiveFile() : null;
    if (!file || !/\.canvas$/i.test(file.path)) {
      new Notice("Open a canvas first.");
      return { ok: false, reason: "file", message: "Open a canvas first." };
    }
    const fitted = canvasQuery.applyQueries(await this.app.vault.read(file));
    if (!fitted.ok) {
      new Notice(fitted.message);
      return fitted;
    }
    if (!fitted.changed) {
      const message = "Those query groups already fit their matches (" + fitted.stats.queries + ").";
      new Notice(message);
      return { ok: true, path: file.path, changed: false, stats: fitted.stats, summary: fitted.summary, message };
    }
    await this.app.vault.modify(file, fitted.text);
    const groups = fitted.applied.length;
    const message = "Fitted " + groups + (groups === 1 ? " query group" : " query groups")
      + " around " + fitted.stats.matched + (fitted.stats.matched === 1 ? " card" : " cards") + "; " + fitted.summary;
    new Notice(message);
    return { ok: true, path: file.path, changed: true, applied: fitted.applied, stats: fitted.stats, summary: fitted.summary, message };
  }

  webBrowserEnabled() {
    return webBrowser.normalizeBrowserSettings(this.settings.webBrowser).enabled;
  }

  webBrowserSettings() {
    return webBrowser.normalizeBrowserSettings(this.settings.webBrowser);
  }

  /** Save the browser's local bookmarks and history; nothing here is sent anywhere. */
  async updateWebBrowser(patch) {
    const next = webBrowser.normalizeBrowserSettings({ ...this.webBrowserSettings(), ...(patch || {}) });
    this.settings.webBrowser = next;
    await this.save();
    return next;
  }

  /** Open (or reuse) the browser view, optionally at an address or search. */
  async openWebBrowser(address) {
    const workspace = this.app.workspace;
    let leaf = null;
    if (typeof workspace.getLeavesOfType === "function") leaf = workspace.getLeavesOfType(VIEW_TYPE_WEB_BROWSER)[0] || null;
    if (!leaf && typeof workspace.getRightLeaf === "function") leaf = workspace.getRightLeaf(false);
    if (leaf && typeof leaf.setViewState === "function") await leaf.setViewState({ type: VIEW_TYPE_WEB_BROWSER, active: true });
    if (leaf && typeof workspace.revealLeaf === "function") workspace.revealLeaf(leaf);
    const view = leaf && leaf.view;
    if (view && address && typeof view.openAddress === "function") await view.openAddress(address);
    return view || null;
  }

  timeBlocksSettings() {
    return timeBlocks.normalizeTimeBlocks(this.settings.timeBlocks);
  }

  /** Assignments and grades are on unless the module was turned off. */
  assignmentsEnabled() {
    return !!(this.settings.assignments && this.settings.assignments.enabled !== false);
  }

  assignmentSettings() {
    const base = this.settings.assignments;
    const registry = (this.settings.calendar && this.settings.calendar.courses) || [];
    const registryCredits = {};
    for (const course of registry) {
      const credits = Number(course.credits);
      if (!Number.isFinite(credits)) continue;
      for (const name of [course.name, course.code, ...(course.aliases || [])]) {
        const key = str(name).trim().toLowerCase();
        if (key) registryCredits[key] = credits;
      }
    }
    return { ...base, registry, registryCredits };
  }

  /** All exams from calendar events, manual exam notes and topic plans. */
  getExams(options) {
    const opts = options || {};
    return exams.listExams({
      settings: this.calendarSettings(),
      events: this.calendarEvents(),
      assignments: this.getAssignments(),
      plans: this.studyWorkspaceSettings().lerntracker.plans,
      overrides: this.settings.calendar.examOverrides,
      today: opts.today || localDate(),
      horizonDays: opts.horizonDays === undefined ? 365 : opts.horizonDays,
      includePast: opts.includePast === true,
    });
  }

  async setExamOverride(event, value) {
    const key = eventKey(event);
    if (!key) return null;
    this.settings.calendar = mergeCalendarSettings({
      ...this.calendarSettings(),
      examOverrides: { ...(this.settings.calendar.examOverrides || {}), [key]: value },
    });
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
    return this.settings.calendar.examOverrides[key];
  }

  /** Rename one registry course without orphaning the old name. */
  async renameCalendarCourse(id, name) {
    const courses = (this.settings.calendar && this.settings.calendar.courses) || [];
    const course = courses.find((row) => row && row.id === id);
    const next = str(name).trim();
    if (!course || !next || next === course.name) return false;
    this.settings.calendar = mergeCalendarSettings({
      ...this.calendarSettings(),
      courses: courseIdentity.renameCourse(courses, id, next),
    });
    this.invalidateCalendar();
    await this.save();
    this.refreshViews();
    return true;
  }

  /** A saved timed test is still in progress (the test view is the only writer of testSession). */
  timedTestRunning() {
    const s = this.settings.testSession;
    return !!(s && typeof s === "object" && Array.isArray(s.items) && Number.isFinite(s.deadline));
  }

  /** Adds one module's ribbon button, once, if ribbon buttons are on. */
  addModuleRibbon(id, icon, title, onClick) {
    if (!this.ribbonAdded) this.ribbonAdded = {};
    if (!this.ribbonButtons) this.ribbonButtons = {};
    if (this.ribbonAdded[id] || !this.settings.showRibbonIcons) return;
    this.ribbonAdded[id] = true;
    this.ribbonButtons[id] = this.addRibbonIcon(icon, title, onClick) || null;
  }

  removeModuleRibbon(id) {
    const el = this.ribbonButtons && this.ribbonButtons[id];
    if (el && typeof el.remove === "function") el.remove();
    if (this.ribbonButtons) delete this.ribbonButtons[id];
    if (this.ribbonAdded) delete this.ribbonAdded[id];
  }

  /** Shows exactly the ribbon buttons the modules that are on call for. */
  refreshRibbon() {
    if (this.mcqEnabled()) {
      this.addModuleRibbon("today", "sun", "Open today", () => this.activateToday());
      this.addModuleRibbon("mcq", "graduation-cap", "Open practice view", () => this.activateView());
    } else {
      this.removeModuleRibbon("today");
      this.removeModuleRibbon("mcq");
    }
    if (this.cardsEnabled()) this.addModuleRibbon("cards", "layers", "Open cards", () => this.activateCards());
    else this.removeModuleRibbon("cards");
    if (this.calendarEnabled()) this.addModuleRibbon("calendar", "calendar-days", "Open calendar", () => this.activateCalendar());
    else this.removeModuleRibbon("calendar");
    if (this.referenceEnabled()) this.addModuleRibbon("reference", "book-open", "Open Reference", () => this.activateReference());
    else this.removeModuleRibbon("reference");
    if (this.assignmentsEnabled()) this.addModuleRibbon("assignments", "clipboard-list", "Open assignments and grades", () => this.activateAssignments());
    else this.removeModuleRibbon("assignments");
    if (this.studyToolsEnabled()) this.addModuleRibbon("study-tools", "notebook-pen", "Open Study Tools", () => this.activateStudyTools());
    else this.removeModuleRibbon("study-tools");
    if (this.studyWorkspaceEnabled()) this.addModuleRibbon("study-workspace", "workflow", "Open Study Workspace", () => this.activateStudyWorkspace());
    else this.removeModuleRibbon("study-workspace");
    if (this.studyTasksEnabled()) this.addModuleRibbon("task-list", "list-checks", "Open the task list", () => this.activateTaskList());
    else this.removeModuleRibbon("task-list");
    if (this.noteReviewDockEnabled()) this.addModuleRibbon("note-review", "repeat", "Open the next due note", () => this.openNextDueNote());
    else this.removeModuleRibbon("note-review");
    if (this.reviewCalendarEnabled()) this.addModuleRibbon("review-calendar", "calendar-clock", "Open review calendar", () => this.activateReviewCalendar());
    else this.removeModuleRibbon("review-calendar");
    if (this.studyStatsEnabled()) this.addModuleRibbon("study-stats", "bar-chart-3", "Open study statistics", () => this.activateStudyStats());
    else this.removeModuleRibbon("study-stats");
    if (this.localEventsEnabled()) this.addModuleRibbon("local-events", "calendar-plus", "Open local events", () => this.activateLocalEvents());
    else this.removeModuleRibbon("local-events");
    if (this.pomodoroEnabled()) this.addModuleRibbon("pomodoro", "timer", "Open Pomodoro timer", () => this.activatePomodoro());
    else this.removeModuleRibbon("pomodoro");
    if (this.settings.ai.enabled) this.addModuleRibbon("agent", "bot", "Open Study agent", () => this.activateAgent());
    else this.removeModuleRibbon("agent");
    this.refreshStudyNudgeLabel();
  }

  setupCalendarRibbon() {
    this.refreshRibbon();
  }

  /** Whether the embedded PDF++ native-viewer subsystem is enabled. */
  pdfPlusEnabled() {
    return pdfPlus.normalizePdfPlusSettings(this.settings && this.settings.pdfPlus).enabled;
  }

  /**
   * Serialize PDF++ start and stop. A reader that opens and closes in the same tick
   * queues a stop and a start, and PDF++ must never patch and unpatch at once.
   */
  queuePdfPlusTransition(fn) {
    const previous = this._pdfPlusQueue || Promise.resolve();
    const next = previous.then(fn, fn);
    this._pdfPlusQueue = next.catch(() => {});
    return next;
  }

  /** Start PDF++ after the workspace is ready; a failure leaves the rest of the plugin working. */
  async startPdfPlus() {
    return this.queuePdfPlusTransition(() => this.startPdfPlusNow());
  }

  async startPdfPlusNow() {
    if (!this.pdfPlusEnabled() || this.pdfPlusPaused) return null;
    try {
      const host = await pdfPlus.start(this);
      this.pdfPlus = host;
      if (host) this.pdfPlusError = "";
      else if (this.pdfPlusError) new Notice(this.pdfPlusError);
      return host;
    } catch (err) {
      this.pdfPlusError = err && err.message ? String(err.message) : String(err);
      new Notice(`PDF++ tools could not start: ${this.pdfPlusError}`);
      return null;
    }
  }

  async stopPdfPlus() {
    return this.queuePdfPlusTransition(() => this.stopPdfPlusNow());
  }

  async stopPdfPlusNow() {
    await pdfPlus.stop(this);
    this.pdfPlus = null;
  }

  async setPdfPlusEnabled(enabled) {
    const next = pdfPlus.normalizePdfPlusSettings(this.settings.pdfPlus);
    next.enabled = enabled === true;
    this.settings.pdfPlus = next;
    await this.save();
    if (next.enabled && !this.pdfPlusPaused) await this.startPdfPlus();
    else await this.stopPdfPlus();
  }

  /**
   * Opens MCQ Tracker's own PDF++ page. PDF++'s vendor tab is captured rather
   * than registered as a separate top-level plugin tab, so every "Customize..."
   * link in PDF++ lands on the one integrated settings page.
   */
  openPdfPlusSettingsTab() {
    const setting = this.app && this.app.setting;
    if (setting && typeof setting.open === "function") setting.open();
    const pluginId = (this.manifest && this.manifest.id) || "mcq-tracker";
    if (setting && typeof setting.openTabById === "function") setting.openTabById(pluginId);
    if (this.settingsTab && typeof this.settingsTab.openPage === "function") {
      this.settingsTab.openPage("pdf-plus");
      return true;
    }
    new Notice("Open Settings → App & documents → PDF++.");
    return false;
  }

  /**
   * An MCQ Tracker PDF surface (the reader or the page/form editor) is taking the file.
   *
   * PDF++ decorates Obsidian's native PDF view and patches its internals, while the MCQ
   * reader and editor draw their own canvas overlays over the same file. Running both
   * would give a user two competing PDF UIs, so the embedded host is stopped while any
   * MCQ PDF surface is open and started again when the last one closes. Nested opens
   * are counted, so a second surface closing never restarts the host early.
   */
  beginMcqPdfUi() {
    this.pdfPlusUiDepth = (this.pdfPlusUiDepth || 0) + 1;
    if (this.pdfPlusUiDepth > 1) return Promise.resolve();
    this.pdfPlusPaused = true;
    return this.stopPdfPlus();
  }

  /** The last MCQ PDF surface closed; resume the embedded host when the module is on. */
  endMcqPdfUi() {
    this.pdfPlusUiDepth = Math.max(0, (this.pdfPlusUiDepth || 0) - 1);
    if (this.pdfPlusUiDepth > 0) return Promise.resolve();
    this.pdfPlusPaused = false;
    if (!this.pdfPlusEnabled()) return Promise.resolve();
    return this.startPdfPlus();
  }

  /** Says a module is off and points at settings. True when it is off, so callers can stop. */
  moduleOff(id) {
    const on =
      id === "calendar"
        ? this.calendarEnabled()
        : id === "cards"
          ? this.cardsEnabled()
          : id === "assignments"
            ? this.assignmentsEnabled()
            : id === "reference"
              ? this.referenceEnabled()
              : this.mcqEnabled();
    if (on) return false;
    new Notice(
      id === "calendar"
        ? "The calendar module is off. Turn it on in Settings, Global."
        : id === "cards"
          ? "The Cards module is off. Turn it on in Settings, Global."
          : id === "assignments"
            ? "The Assignments module is off. Turn it on in Settings, Global."
            : id === "reference"
              ? "The Reference module is off. Turn it on in Settings, Global."
              : "The MCQ Tracker module is off. Turn it on in Settings, Global."
    );
    this.openSettings();
    return true;
  }

  /** Closes a module's open tabs when it is turned off (restored tabs would be stale). */
  detachModuleLeaves(types) {
    const ws = this.app.workspace;
    if (typeof ws.detachLeavesOfType !== "function") return;
    for (const type of types) ws.detachLeavesOfType(type);
  }

  async onMcqToggled() {
    this.refreshRibbon();
    if (!this.mcqEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE, VIEW_TYPE_TODAY, VIEW_TYPE_INSIGHTS, VIEW_TYPE_TEST]);
      this.pauseSession();
      return;
    }
    this.refreshViews();
  }

  async onCardsToggled() {
    this.refreshRibbon();
    if (!this.cardsEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_CARDS]);
      return;
    }
    this.refreshViews();
  }

  async onReviewCalendarToggled() {
    this.refreshRibbon();
    if (!this.reviewCalendarEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_REVIEW_CALENDAR]);
      return;
    }
    this.refreshViews();
  }

  async onStudyStatsToggled() {
    this.refreshRibbon();
    if (!this.studyStatsEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_STUDY_STATS]);
      return;
    }
    this.refreshViews();
  }

  async onLocalEventsToggled() {
    this.refreshRibbon();
    if (!this.localEventsEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_LOCAL_EVENTS]);
      return;
    }
    this.refreshViews();
  }

  async  onCalendarToggled() {
    this.invalidateCalendar();
    this.refreshRibbon();
    if (!this.calendarEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_CALENDAR]);
      return;
    }
    await this.refreshCalendarFileSources();
    this.refreshCalendarViews();
  }

  async onReferenceToggled() {
    this.refreshRibbon();
    if (!this.referenceEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_REFERENCE]);
      return;
    }
    this.refreshViews();
  }

  async onAssignmentsToggled() {
    this.refreshRibbon();
    if (!this.assignmentsEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_ASSIGNMENTS]);
      return;
    }
    this.refreshViews();
  }

  async onStudyToolToggled() {
    this.refreshRibbon();
    if (!this.studyToolsEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_STUDY_TOOLS]);
      return;
    }
    this.refreshViews();
  }

  async onStudyWorkspaceToggled() {
    this.refreshRibbon();
    if (!this.studyTasksEnabled()) this.detachModuleLeaves([VIEW_TYPE_TASK_LIST]);
    if (!this.studyWorkspaceEnabled()) {
      this.detachModuleLeaves([VIEW_TYPE_STUDY_WORKSPACE]);
      return;
    }
    this.refreshViews();
  }

  async onTableEditorToggled() {
    const leaves = [];
    const workspace = this.app && this.app.workspace;
    if (workspace && typeof workspace.iterateAllLeaves === "function") {
      workspace.iterateAllLeaves((leaf) => leaves.push(leaf));
    }
    for (const leaf of leaves) {
      const view = leaf && leaf.view;
      const preview = view && view.previewMode;
      if (preview && typeof preview.rerender === "function") {
        try {
          preview.rerender(true);
        } catch (e) {
          // A view that is closing can refuse a rerender; the next open applies the switch.
        }
      }
    }
    this.refreshViews();
  }

  onGlobalSettingsChanged() {
    this.refreshRibbon();
    this.refreshViews();
  }

  /** One month back, six months forward: enough for a semester and a month grid. */
  calendarWindow(now) {
    const at = now || new Date();
    return { start: new Date(at.getFullYear(), at.getMonth() - 1, 1), end: new Date(at.getFullYear(), at.getMonth() + 6, 0, 23, 59, 59) };
  }

  invalidateCalendar() {
    this._calendarCache = null;
  }

  /** The next review date compression for a course's upcoming exam, if there is one. */
  examCapFor(course, now) {
    if (!String(course || "").trim()) return null;
    const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
    const exam = exams.nextExam(this.getExams({ today: localDate(), horizonDays: 365 }), course, this.calendarSettings(), localDate());
    return exam ? examReviewCap({ dateKey: exam.date, summary: exam.title || "Exam" }, at) : null;
  }

  /** Cached index of class notes by `calendar_uid|calendar_date`. */
  calendarNoteIndex() {
    if (!this._calendarNoteIndex) this._calendarNoteIndex = classNoteIndex(this.app);
    return this._calendarNoteIndex;
  }

  /** Cached folder list for resolving class-note paths without scanning on every card. */
  calendarFolders() {
    if (!this._calendarFolders) this._calendarFolders = vaultFolders(this.app);
    return this._calendarFolders;
  }

  invalidateCalendarNotes() {
    this._calendarNoteIndex = null;
    this._calendarFolders = null;
    this.invalidateSnapshots();
  }

  /** Finds the existing note for a class occurrence, if there is one. */
  findCalendarNote(event, key) {
    return findClassNote(
      this.app,
      this.calendarSettings(),
      event,
      key || event.dateKey,
      this.calendarNoteIndex(),
      this.calendarFolders()
    );
  }

  /** Parses every shown source. Cached by a content hash so any edit invalidates it. */
  calendarEvents(now) {
    const range = this.calendarWindow(now);
    const sources = this.calendarSources().filter((s) => !s.hidden && s.content);
    const cal = this.calendarSettings();
    const foreignNotes = fullCalendarNotes(this.app, cal.eventNoteFolder, range);
    const termSignature = `${cal.semesterStart}|${cal.semesterEnd}|${(cal.readingWeeks || []).map((r) => `${r.start}:${r.end}:${r.label}`).join(",")}`;
    const signature = `${dateKey(range.start)}|${dateKey(range.end)}|${termSignature}|${JSON.stringify(cal.examOverrides || {})}|${foreignNotes.signature}|${sources.map((s) => `${s.id}:${hashString(s.content)}`).join("|")}`;
    if (this._calendarCache && this._calendarCache.signature === signature) return this._calendarCache.events;
    const all = [];
    const errors = [];
    for (const source of sources) {
      try {
        const expanded = expandIcs(parseIcs(source.content), range.start, range.end);
        for (const event of expanded) all.push(Object.assign(event, { sourceId: source.id, sourceName: source.name }));
      } catch (e) {
        errors.push(`${source.name}: ${e.message}`);
      }
    }
    all.push(...foreignNotes.events);
    const overrides = cal.examOverrides || {};
    for (const event of all) {
      if (!Object.prototype.hasOwnProperty.call(overrides, eventKey(event))) continue;
      event.examOverride = overrides[eventKey(event)];
    }
    const events = applyTermWeeks(this.calendarSettings(), visibleEvents(this.calendarSettings(), all));
    this._calendarCache = { signature, events };
    this._calendarErrors = errors;
    return events;
  }

  /** Re-reads .ics files from the vault so edits and re-downloads show up. */
  async refreshCalendarFileSources() {
    let changed = false;
    for (const source of this.settings.calendar.sources || []) {
      if (source.type !== "file" || !source.path) continue;
      const file = this.app.vault.getAbstractFileByPath(source.path);
      if (!file) continue;
      try {
        const text = await this.app.vault.cachedRead(file);
        if (text !== source.content) {
          source.content = text;
          changed = true;
        }
      } catch (e) {
        /* keep the cached copy */
      }
    }
    if (changed) {
      this.invalidateCalendar();
      await this.save();
    }
    return changed;
  }

  async addCalendarFileSource(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    if (!icsLooksValid(text)) throw new Error("That file is not an iCalendar (.ics) file.");
    const cal = this.settings.calendar;
    const name = file.name || file.basename || path;
    const existing = cal.sources.find((s) => s.type === "file" && s.path === path);
    if (existing) {
      existing.content = text;
      existing.lastSync = Date.now();
    } else {
      cal.sources.push({ id: `f${Date.now().toString(36)}`, name, type: "file", path, url: "", content: text, hidden: false, lastSync: Date.now() });
    }
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
    new Notice(`Added ${name}.`);
  }

  async addCalendarUrlSource(rawUrl) {
    const url = safeCalendarFeedUrl(normalizeCalendarUrl(rawUrl));
    const response = await requestUrl({ url, method: "GET" });
    const text = calendarText(response);
    if (!icsLooksValid(text)) throw new Error("That address did not return an iCalendar feed.");
    const cal = this.settings.calendar;
    const name = deriveSourceLabel(url, text);
    const existing = cal.sources.find((s) => s.type === "url" && s.url === url);
    if (existing) {
      existing.content = text;
      existing.name = name;
      existing.lastSync = Date.now();
    } else {
      cal.sources.push({ id: `u${Date.now().toString(36)}`, name, type: "url", path: "", url, content: text, hidden: false, lastSync: Date.now() });
    }
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
    new Notice(`Added ${name}.`);
  }

  async syncCalendarSource(id) {
    const source = (this.settings.calendar.sources || []).find((s) => s.id === id);
    if (!source) return;
    if (source.type === "file") {
      await this.refreshCalendarFileSources();
      this.refreshCalendarViews();
      return;
    }
    const url = safeCalendarFeedUrl(source.url);
    const response = await requestUrl({ url, method: "GET" });
    const text = calendarText(response);
    if (!icsLooksValid(text)) throw new Error("That calendar did not return an iCalendar feed.");
    source.content = text;
    source.lastSync = Date.now();
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
  }

  async removeCalendarSource(id) {
    this.settings.calendar.sources = (this.settings.calendar.sources || []).filter((s) => s.id !== id);
    this.invalidateCalendar();
    await this.save();
    this.refreshCalendarViews();
  }

  refreshCalendarViews() {
    this.invalidateCalendar();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
  }

  async activateCards() {
    if (this.moduleOff("cards")) return null;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_CARDS)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_CARDS, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  async activateAssignments() {
    if (this.moduleOff("assignments")) return null;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_ASSIGNMENTS)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_ASSIGNMENTS, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  async activateStudyTools(tab) {
    if (!this.studyToolsEnabled()) {
      new Notice("All Study Tools are off. Turn on Cornell notes, the lecture log or study goals in Settings, Global, Modules.");
      this.openSettings();
      return null;
    }
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_STUDY_TOOLS)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_STUDY_TOOLS, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.setTab && tab) leaf.view.setTab(tab);
    else if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  async activateStudyWorkspace(tab) {
    if (!this.studyWorkspaceEnabled()) {
      new Notice("All study workflow modules are off. Turn them on in Settings, Global, Modules.");
      this.openSettings();
      return null;
    }
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_STUDY_WORKSPACE)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_STUDY_WORKSPACE, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.setTab && tab) leaf.view.setTab(tab);
    else if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }


  /** Open the planner on a named view; the workspace keeps the last view otherwise. */
  async activateTimeBlocksView(view) {
    const leafView = await this.activateStudyWorkspace("timeBlocks");
    if (leafView && leafView.timeBlockView !== undefined) {
      leafView.timeBlockView = timeBlocks.normalizeView(view);
      if (leafView.render) leafView.render();
    }
    return leafView;
  }

  /** The compact task list lives in the right sidebar; phones fall back to a tab. */
  async activateTaskList() {
    if (!this.studyTasksEnabled()) {
      new Notice("Turn on Tasks in Settings, Global, Modules to use the task list.");
      this.openSettings();
      return null;
    }
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_TASK_LIST)[0];
    if (!leaf) {
      if (typeof ws.getRightLeaf === "function" && !Platform.isMobile) {
        leaf = ws.getRightLeaf(false) || ws.getRightLeaf(true);
      }
      if (!leaf) leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_TASK_LIST, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  /* ---- assignments and grades */

  /** Assignment notes are ordinary Markdown notes with `assignment: true`. */
  getAssignments() {
    const settings = this.assignmentSettings();
    const out = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!isAssignmentNote(fm)) continue;
      out.push(parseAssignment(file, fm, "", settings));
    }
    return out;
  }

  assignmentStats(options) {
    return assignmentStats(this.getAssignments(), this.assignmentSettings(), options || {});
  }

  openNewAssignment(options, onDone) {
    if (this.moduleOff("assignments")) return;
    new AssignmentModal(this.app, this, options || {}, (result) => {
      if (result && result.path) new Notice(`Created ${result.path}.`);
      this.refreshViews();
      if (onDone) onDone(result);
    }).open();
  }

  async createAssignment(data) {
    if (this.moduleOff("assignments")) return null;
    const settings = this.assignmentSettings();
    const title = safeName(data.title) || "Assignment";
    const folder = String(settings.folder || "").trim().replace(/^\/+|\/+$/g, "");
    if (folder) await ensureFolder(this.app, folder);
    const path = uniquePath(settings, title, (candidate) => !!this.app.vault.getAbstractFileByPath(candidate));
    const text = assignmentMarkdown({ ...data, title, id: assignmentId(new Date()) }, new Date());
    const file = await this.app.vault.create(path, text);
    this.refreshViews();
    return { file, path };
  }

  async updateAssignment(assignment, data) {
    if (this.moduleOff("assignments")) return null;
    const file = assignment && assignment.file ? assignment.file : this.app.vault.getAbstractFileByPath(assignment && assignment.path);
    if (!file) throw new Error("That assignment note is no longer in the vault.");
    const status = normalizeStatus(data.status || assignment.status);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.title = safeName(data.title) || fm.title || file.basename;
      fm.course = String(data.course || "").trim();
      fm.type = typeId(data.type || fm.type || "homework");
      fm.category = categoryFor(fm.type, data.category);
      if (data.due) fm.due = data.due;
      else delete fm.due;
      fm.status = status;
      fm.weight = Math.max(0.01, Number(data.weight) || 1);
      const estimate = estimateMinutes(data.estimate);
      if (estimate) fm.estimate = estimate;
      else delete fm.estimate;
      if (String(data.points || "").trim() === "") delete fm.points;
      else fm.points = Number(data.points);
      if (String(data.score || "").trim() === "") delete fm.score;
      else fm.score = Number(data.score);
      if (status === "submitted" || status === "graded") fm.submitted = fm.submitted || localDate();
      else delete fm.submitted;
    });
    const text = await this.app.vault.read(file);
    let next = updateTaskTitle(updateTaskDue(text, data.due), data.title);
    next = updateTaskEstimate(next, data.estimate);
    next = updateTaskCheckbox(next, status === "submitted" || status === "graded");
    if (next !== text) await this.app.vault.modify(file, next);
    this.refreshViews();
    return { file, path: file.path, assignment: parseAssignment(file, this.app.metadataCache.getFileCache(file)?.frontmatter || {}, next, this.assignmentSettings()) };
  }

  async setAssignmentStatus(assignment, status) {
    if (this.moduleOff("assignments")) return null;
    const file = assignment && assignment.file ? assignment.file : this.app.vault.getAbstractFileByPath(assignment && assignment.path);
    if (!file) throw new Error("That assignment note is no longer in the vault.");
    const nextStatus = normalizeStatus(status);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.status = nextStatus;
      if (nextStatus === "submitted" || nextStatus === "graded") fm.submitted = fm.submitted || localDate();
      else delete fm.submitted;
    });
    const text = await this.app.vault.read(file);
    const next = updateTaskCheckbox(text, nextStatus === "submitted" || nextStatus === "graded");
    if (next !== text) await this.app.vault.modify(file, next);
    this.refreshViews();
    return nextStatus;
  }

  /** Provenance for a question, with a fallback to the older plain `source` name. */
  sourceInfo(fm, notePath) {
    const direct = sourceOf(fm);
    if (direct.has) return direct;
    const file = findSourceFile(this.app.vault.getFiles(), fm, notePath);
    return file ? sourceOf({ ...(fm || {}), source_pdf: file.path }) : direct;
  }

  /** Select the anchored passage in an already-open source editor. */
  selectSourceQuote(path, quote) {
    const active = this.app.workspace && this.app.workspace.activeEditor;
    if (!active || !active.file || active.file.path !== path || !active.editor) return false;
    const text = typeof active.editor.getValue === "function" ? active.editor.getValue() : "";
    const range = findQuoteRange(text, quote);
    if (!range) return false;
    if (typeof active.editor.setSelection === "function") active.editor.setSelection(range.from, range.to);
    if (typeof active.editor.scrollIntoView === "function") active.editor.scrollIntoView(range.from, true);
    return true;
  }

  /** Open the source note or exact PDF page, optionally selecting a recall's passage. */
  async openSource(fm, notePath, quote) {
    const source = this.sourceInfo(fm, notePath);
    if (!source.has) {
      new Notice("This note has no source link. Imported questions get one automatically.");
      return false;
    }
    const anchored = str(quote || source.quote).trim();
    const target = source.link.replace(/^\[\[|\]\]$/g, "");
    if (this.app.workspace.openLinkText) {
      await this.app.workspace.openLinkText(target, notePath || "", false);
      if (anchored) {
        await sleep(20);
        if (!this.selectSourceQuote(source.path, anchored)) {
          await sleep(80);
          this.selectSourceQuote(source.path, anchored);
        }
      }
      return true;
    }
    const file = source.path ? this.app.vault.getAbstractFileByPath(source.path) : null;
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf("tab").openFile(file);
      if (anchored) {
        await sleep(20);
        this.selectSourceQuote(file.path, anchored);
      }
      return true;
    }
    new Notice("The source is not in this vault.");
    return false;
  }

  /** Open the card dialog with the selected source passage as its anchor. */
  openSourceRecall() {
    if (this.moduleOff("cards")) {
      new Notice("Turn on the Cards module under Settings, Global, Modules first.");
      return null;
    }
    const workspace = this.app.workspace || {};
    const file = typeof workspace.getActiveFile === "function" ? workspace.getActiveFile() : null;
    if (!file || !/\.md$/i.test(file.path)) {
      new Notice("Open a Markdown note and select the source text for the recall.");
      return null;
    }
    const active = workspace.activeEditor;
    const editor = active && active.file && active.file.path === file.path ? active.editor : null;
    const selection = editor && typeof editor.getSelection === "function" ? editor.getSelection() : "";
    if (!str(selection).trim()) {
      new Notice("Select the source text in the note first, then run the command again.");
      return null;
    }
    const from = editor && typeof editor.getCursor === "function" ? editor.getCursor("from") : null;
    const text = editor && typeof editor.getValue === "function" ? editor.getValue() : "";
    const anchor = buildSourceRecall({
      text,
      selection,
      cache: this.app.metadataCache.getFileCache(file),
      line: from && from.line,
    });
    const modal = new CardModal(
      this.app,
      this,
      {
        deck: this.settings.cards.defaultDeck,
        course: courseForFolder(this.settings, file.path),
        sourceNote: file.path,
        sourceHeading: anchor.heading,
        sourceQuote: anchor.quote,
        sourceContext: anchor.context,
        front: "",
        back: anchor.quote,
      },
      (result) => {
        if (result && result.path) new Notice(`Created ${result.path}.`);
        this.refreshViews();
      }
    );
    modal.open();
    return modal;
  }

  async openAssignmentNote(assignment) {
    if (!assignment) return;
    const file = assignment.file || this.app.vault.getAbstractFileByPath(assignment.path);
    if (!file) {
      new Notice("That assignment note is no longer in the vault.");
      return;
    }
    await this.app.workspace.getLeaf("tab").openFile(file);
  }

  /** Saves a complete calculator result as an ordinary note with history properties. */
  async saveApExamResult(profile, result, cutoffs, takenOn) {
    const note = buildApExamNote(profile, result, cutoffs, takenOn);
    if (!note) throw new Error("Enter every section before saving a practice exam.");
    await ensureFolder(this.app, AP_EXAM_FOLDER);
    const path = uniqueApExamPath(note, (candidate) => !!this.app.vault.getAbstractFileByPath(candidate));
    const file = await this.app.vault.create(path, note.text);
    return { file, path, frontmatter: note.frontmatter, entry: { ...note.entry, path } };
  }

  /** Reads saved practice-exam notes back from the metadata cache, newest first. */
  getApExamHistory() {
    const entries = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const entry = entryFromFrontmatter(fm, file.path);
      if (entry) entries.push(entry);
    }
    return sortApExamEntries(entries);
  }

  /** Saves one official AP link as a tagged note, or returns the existing note. */
  async saveApResourceNote(course, resource, unit, checkedOn) {
    const existing = findApResourceNote(this.getApResourceNotes(), resource && resource.url);
    if (existing) return { ...existing, created: false };
    const note = buildApResourceNote(course, resource, unit, checkedOn);
    if (!note) throw new Error("That resource is missing an official link.");
    const folder = note.path.replace(/\/[^/]+$/, "");
    await ensureFolder(this.app, folder);
    const path = uniqueApResourcePath(note, (candidate) => !!this.app.vault.getAbstractFileByPath(candidate));
    const file = await this.app.vault.create(path, note.text);
    return { file, path, frontmatter: note.frontmatter, entry: { ...note.entry, path }, created: true };
  }

  getApResourceNotes() {
    const entries = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const entry = resourceNoteEntry(fm, file.path);
      if (entry) entries.push(entry);
    }
    return sortApResourceNotes(entries);
  }

  /** Refreshes checked_on after the learner verifies a link. */
  async markApResourceChecked(path, checkedOn) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const next = markCheckedFrontmatter(fm, checkedOn);
    if (this.app.fileManager && this.app.fileManager.processFrontMatter) {
      await this.app.fileManager.processFrontMatter(file, (data) => {
        data.checked_on = next.checked_on;
      });
    } else {
      const text = await this.app.vault.read(file);
      await this.app.vault.modify(file, text.replace(/^checked_on:.*$/m, `checked_on: ${next.checked_on}`));
    }
    return resourceNoteEntry({ ...fm, ...next }, path);
  }

  /** Binds a saved resource note to the calendar exam it is meant to support. */
  async attachApResourceToExam(path, exam) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file || !exam || !exam.uid) return null;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const next = attachFrontmatter(fm, exam);
    if (!this.app.fileManager || !this.app.fileManager.processFrontMatter) return null;
    await this.app.fileManager.processFrontMatter(file, (data) => {
      data.exam_uid = next.exam_uid;
      data.exam_date = next.exam_date;
      data.exam_title = next.exam_title;
    });
    return resourceNoteEntry({ ...fm, ...next }, path);
  }

  /** Removes the exam binding from a saved resource note. */
  async detachApResourceFromExam(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    if (!this.app.fileManager || !this.app.fileManager.processFrontMatter) return null;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const next = detachFrontmatter(fm);
    await this.app.fileManager.processFrontMatter(file, (data) => {
      delete data.exam_uid;
      delete data.exam_date;
      delete data.exam_title;
    });
    return resourceNoteEntry(next, path);
  }

  /** Binds a saved resource to one computed study block (date and start time). */
  async attachApResourceToStudySlot(path, slot) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const next = attachStudySlotFrontmatter(fm, slot);
    if (!this.app.fileManager || !this.app.fileManager.processFrontMatter) return null;
    await this.app.fileManager.processFrontMatter(file, (data) => {
      data.study_slot_date = next.study_slot_date;
      data.study_slot_start = next.study_slot_start;
      data.study_slot_subject = next.study_slot_subject;
    });
    return resourceNoteEntry({ ...fm, ...next }, path);
  }

  /** Removes the study-block binding from a saved resource note. */
  async detachApResourceFromStudySlot(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    if (!this.app.fileManager || !this.app.fileManager.processFrontMatter) return null;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    const next = detachStudySlotFrontmatter(fm);
    await this.app.fileManager.processFrontMatter(file, (data) => {
      delete data.study_slot_date;
      delete data.study_slot_start;
      delete data.study_slot_subject;
    });
    return resourceNoteEntry(next, path);
  }

  async openApScore() {
    return this.openReferenceTab("ap", "Turn on the Reference module under Settings, Global, Modules to use the AP score calculator.");
  }

  async openApResources() {
    return this.openReferenceTab("resources", "Turn on the Reference module under Settings, Global, Modules to use AP resources.");
  }

  /** Opens the FRQ practice modal. Reference must be on; the grader is part of the AP tools. */
  openFrqGrader(options) {
    if (this.moduleOff("reference")) {
      new Notice("Turn on the Reference module under Settings, Global, Modules to use AP free-response practice.");
      return null;
    }
    if (this.settings.reference.hideDuringTests !== false && this.timedTestRunning()) {
      new Notice("AP tools are hidden while a timed test is running. Change this under Settings, Reference.");
      return null;
    }
    const modal = new FrqGraderModal(this.app, this, options);
    modal.open();
    return modal;
  }

  /** Opens the note creator for a learner-supplied prompt and rubric. */
  openNewFrqNote(onDone) {
    if (this.moduleOff("reference")) {
      new Notice("Turn on the Reference module under Settings, Global, Modules to create AP free-response notes.");
      return null;
    }
    const modal = new NewFrqNoteModal(this.app, this, onDone);
    modal.open();
    return modal;
  }

  /**
   * Chooses a vault PDF, reads its text layer and opens the preview. The PDF
   * itself is not copied, uploaded or stored; only the notes the learner
   * confirms are written.
   */
  openFrqPdfImport() {
    if (this.moduleOff("reference")) {
      new Notice("Turn on the Reference module under Settings, Global, Modules to import AP free-response questions.");
      return null;
    }
    if (this.settings.reference.hideDuringTests !== false && this.timedTestRunning()) {
      new Notice("AP tools are hidden while a timed test is running. Change this under Settings, Reference.");
      return null;
    }
    const files = (this.app.vault.getFiles ? this.app.vault.getFiles() : [])
      .filter((file) => /\.pdf$/i.test(str(file && (file.path || file.name))))
      .sort((a, b) => str(a.path).localeCompare(str(b.path)));
    if (!files.length) {
      new Notice("No PDFs were found in this vault. Add the free-response PDF first.");
      return null;
    }
    if (files.length === 1) return this.importFrqPdf(files[0]);
    new FrqPdfPickerModal(this.app, files, (file) => this.importFrqPdf(file)).open();
    return null;
  }

  /** Reads one PDF and opens the review-first import modal; returns that modal. */
  async importFrqPdf(file, options) {
    const opts = options || {};
    if (this.moduleOff("reference")) {
      new Notice("Turn on the Reference module under Settings, Global, Modules to import AP free-response questions.");
      return null;
    }
    const path = str(file && (file.path || file.name));
    if (!/\.pdf$/i.test(path)) {
      new Notice("Choose a PDF file first.");
      return null;
    }
    try {
      const bytes = opts.bytes || (await this.app.vault.readBinary(file));
      const reader = this.frqPdfReader || readPdfPages;
      const read = await reader(bytes, str(opts.pages), () => {});
      const split = splitFrqItems(read && read.pages);
      if (!split.items.length) {
        new Notice(split.warnings[0] || "No free-response prompts and rubrics were found in that PDF.");
        return null;
      }
      const modal = new FrqImportPreviewModal(this.app, this, {
        source: path,
        items: split.items,
        warnings: [...split.warnings, ...((read && read.warnings) || [])],
        onDone: opts.onDone,
      });
      modal.open();
      return modal;
    } catch (error) {
      new Notice(`I couldn't read that PDF: ${str(error && error.message ? error.message : error)}`);
      return null;
    }
  }

  /** Every user-supplied FRQ note, read through the normal note format. */
  async getFrqNotes() {
    const notes = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!isFrqNote(fm)) continue;
      try {
        const text = await this.app.vault.cachedRead(file);
        notes.push(parseFrqNote(text, fm, file.path));
      } catch (e) {
        /* an unreadable note should not hide the rest */
      }
    }
    return notes.sort((a, b) => String(a.course).localeCompare(String(b.course)) || String(a.title).localeCompare(String(b.title)));
  }

  /** Writes a new FRQ note under AP FRQs/<course>/ and returns the parsed result. */
  async createFrqNote(input) {
    const built = buildFrqNote(input);
    if (!built) throw new Error("Add a title, prompt and at least one rubric criterion.");
    const folder = built.path.replace(/\/[^/]+$/, "");
    await ensureFolder(this.app, FRQ_FOLDER);
    await ensureFolder(this.app, folder);
    const path = uniqueNotePath(built, (candidate) => !!this.app.vault.getAbstractFileByPath(candidate));
    const file = await this.app.vault.create(path, built.text);
    return { file, path, note: parseFrqNote(built.text, built.frontmatter, path) };
  }

  /** Saved attempts for one prompt, newest first. */
  async getFrqAttempts(notePath) {
    const entries = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const entry = entryFromAttemptFrontmatter(fm, file.path);
      if (!entry) continue;
      if (notePath && entry.frqNote !== notePath) continue;
      entries.push(entry);
    }
    return sortFrqAttempts(entries);
  }

  /** Saved FRQ attempt credit for the Insights dashboard; reads frontmatter only. */
  getFrqKnowledge() {
    const entries = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const entry = entryFromAttemptFrontmatter(fm, file.path);
      if (entry) entries.push(entry);
    }
    return frqKnowledge(entries);
  }

  /** Missed FRQ criteria across saved attempts, for the Insights weak-spot list. */
  async getFrqWeakSpotRows() {
    return frqCriterionWeakSpots(await this.getFrqAttempts());
  }

  /**
   * FRQ prompts whose review date has arrived, scoped to one exam course when
   * asked. This reads the summary already saved on each prompt note, so it can
   * run from the synchronous study-plan path without reading note bodies.
   */
  getFrqReviewQueue(options) {
    const opts = options || {};
    if (this.moduleOff && this.moduleOff("reference")) return [];
    const today = localDate();
    const rows = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const entry = frqReviewEntry(fm, file.path, today);
      if (!entry) continue;
      if (opts.course) {
        const matches =
          examMatchesCourse({ summary: entry.course }, opts.course) ||
          examMatchesCourse({ summary: entry.courseId }, opts.course);
        if (!matches) continue;
      }
      rows.push(entry);
    }
    return frqReviewQueue(rows, { limit: opts.limit });
  }

  /** Saves one graded attempt and records its summary on the prompt note. */
  async saveFrqAttempt(note, attempt) {
    const built = buildFrqAttemptNote(note, attempt, attempt && attempt.gradedOn);
    if (!built) throw new Error("Score at least one rubric criterion before saving.");
    await ensureFolder(this.app, FRQ_ATTEMPT_FOLDER);
    const path = uniqueNotePath(built, (candidate) => !!this.app.vault.getAbstractFileByPath(candidate));
    const file = await this.app.vault.create(path, built.text);
    const source = this.app.vault.getAbstractFileByPath(note.path);
    if (source && /\.md$/i.test(source.path)) {
      await this.app.fileManager.processFrontMatter(source, (data) => {
        Object.assign(data, sourceFrontmatterUpdate(attempt, data.frq_attempts));
      });
    }
    return { file, path, frontmatter: built.frontmatter, entry: { ...built.entry, path } };
  }

  /** One request path for AI FRQ grading, using the shared feature limits. */
  async gradeFrqWithAi(note, answer) {
    const client = {
      chat: (system, messages, opts) =>
        this.aiComplete(system, messages && messages[0] ? messages[0].content : "", { ...(opts || {}), feature: "frqGrading" }),
    };
    return gradeFrqWithAi(client, note, answer);
  }

  /** Whether a photo of handwritten work can be read right now. */
  handwritingPhotoSupport() {
    if (!this.settings.ai.enabled) return { ok: false, reason: "Turn on AI features to read a photo of handwritten work." };
    return this.aiCanSpend("handwriting");
  }

  /**
   * Reads one chosen photo into editable text. This method never grades, never
   * writes a note and never stores the image; grading stays a separate press.
   */
  async transcribeHandwritingPhoto(image, meta) {
    const support = this.handwritingPhotoSupport();
    if (!support.ok) throw new Error(support.reason);
    if (!image || !str(image.data)) throw new Error("Choose a photo of your handwritten answer first.");
    const reply = await this.aiVision(HANDWRITING_SYSTEM, handwritingPrompt(meta), [image], { feature: "handwriting", maxTokens: 2000 });
    const text = cleanHandwritingText(reply);
    if (!text) throw new Error("The model returned no readable answer. Try a sharper, well-lit photo.");
    return { text, model: this.aiModelLabel("handwriting"), name: str(image.name) };
  }

  async openReferenceTab(tab, offMessage) {
    const view = await this.activateReference();
    if (!view) {
      new Notice(offMessage);
      return null;
    }
    view.tab = tab;
    view.render();
    return view;
  }

  async activateReference() {
    if (this.moduleOff("reference")) return null;
    if (this.settings.reference.hideDuringTests !== false && this.timedTestRunning()) {
      new Notice("The Reference panel is hidden while a timed test is running. Change this under Settings, Reference.");
      return null;
    }
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_REFERENCE)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_REFERENCE, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  openNewCard(options, onDone) {
    if (this.moduleOff("cards")) return;
    new CardModal(this.app, this, options || {}, (result) => {
      if (result && result.path) new Notice(`Created ${result.path}.`);
      this.refreshViews();
      if (onDone) onDone(result);
    }).open();
  }

  openImageOcclusion(options, onDone) {
    if (this.moduleOff("cards")) return;
    new ImageOcclusionModal(this.app, this, options || {}, (result) => {
      if (result && result.paths && result.paths.length) {
        new Notice(`Created ${result.paths.length} image occlusion card${result.paths.length === 1 ? "" : "s"}.`);
      }
      this.refreshViews();
      if (onDone) onDone(result);
    }).open();
  }

  openCardImport(options, onDone) {
    if (this.moduleOff("cards")) return;
    new CardImportModal(
      this.app,
      this,
      options || {},
      (result) => {
        this.refreshViews();
        if (onDone) onDone(result);
      }
    ).open();
  }

  openDocumentCards(options, onDone) {
    if (this.moduleOff("cards")) {
      new Notice("Turn on Cards under Settings, Global, Modules to extract flashcards.");
      return;
    }
    new DocumentCardsModal(this.app, this, options || {}, (result) => {
      this.refreshViews();
      if (onDone) onDone(result);
    }).open();
  }

  /** Open the inline Quick Ask panel. Nothing is written until the learner presses Insert or Replace. */
  async openQuickAsk(options) {
    const ai = this.settings && this.settings.ai;
    if (!ai || ai.enabled !== true) {
      new Notice("Turn on AI under Settings > Study agent > AI and the assistant to use Quick Ask.");
      return null;
    }
    const opts = options && typeof options === "object" ? options : {};
    let context = opts.context && opts.context.path ? { ...opts.context } : await readActiveNoteContext(this.app);
    if (context && !context.text && context.path) {
      const file = this.app.vault.getAbstractFileByPath(context.path);
      if (file) {
        try {
          context.text = await this.app.vault.cachedRead(file);
        } catch (e) {
          /* the selection can still be used without the full note */
        }
      }
    }
    const active = this.app.workspace.activeEditor;
    const editor = opts.editor || (active && active.editor) || null;
    const modal = new QuickAskModal(this.app, this, {
      ...(context || {}),
      editor,
      action: opts.action,
      question: opts.question,
      includeNote: opts.includeNote === true,
      commands: ai.studyCommands,
    });
    modal.open();
    return modal;
  }

  /** Open the study agent in the right sidebar; every file write stays behind the existing review guards. */
  async activateAgent() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_AGENT)[0];
    if (!leaf) {
      if (typeof ws.getRightLeaf === "function" && !Platform.isMobile) leaf = ws.getRightLeaf(false) || ws.getRightLeaf(true);
      if (!leaf) leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_AGENT, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    return leaf.view;
  }

  /** Open the compact Quick Chat prompt; repeated invocations reuse the open modal. */
  openQuickChat(options) {
    const ai = this.settings && this.settings.ai;
    if (!ai || ai.enabled !== true) {
      new Notice("Turn on AI under Settings > Study agent > AI and the assistant to use Quick Chat.");
      return null;
    }
    if (this._quickChatModal) {
      this._quickChatModal.focus();
      return this._quickChatModal;
    }
    const modal = new QuickChatModal(this.app, this, options || {});
    this._quickChatModal = modal;
    modal.onClosed = () => {
      if (this._quickChatModal === modal) this._quickChatModal = null;
    };
    modal.open();
    return modal;
  }

  /** Dispatch a quick prompt into the active Study agent panel and its shipped guards. */
  async quickChat(text) {
    const value = String(text === undefined || text === null ? "" : text).trim();
    if (!value) return false;
    try {
      const view = await this.activateAgent();
      if (!view || typeof view.quickChat !== "function") {
        new Notice("The Study agent could not open. Nothing was sent.");
        return false;
      }
      return view.quickChat(value);
    } catch (e) {
      this.recordDiagnosticError("quick chat", e);
      new Notice(`Quick Chat could not send: ${String(e && e.message ? e.message : e)}`, 8000);
      return false;
    }
  }

  /** Handle an obsidian://mcq-tracker-chat bookmark link. */
  async openChatBookmark(params) {
    try {
      const view = await this.activateAgent();
      if (!view || typeof view.openBookmarkLink !== "function") {
        new Notice("The Study agent could not open that chat link.");
        return false;
      }
      return await view.openBookmarkLink(params);
    } catch (e) {
      this.recordDiagnosticError("chat bookmark", e);
      new Notice(`Could not open that chat link: ${String(e && e.message ? e.message : e)}`, 8000);
      return false;
    }
  }

  /** Keep a small bounded local error trail for the diagnostics bundle. */
  recordDiagnosticError(scope, error) {
    const message = String((error && error.message) || error || "").trim();
    if (!message) return;
    this.recentDiagnosticErrors = (this.recentDiagnosticErrors || []).concat({
      at: Date.now(),
      scope: String(scope || "local"),
      message: message.slice(0, 1000),
    }).slice(-20);
  }

  /** The active Study agent panel, or null when that view is not open. */
  activeChatPanel() {
    try {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT) || [];
      for (const leaf of leaves) {
        const view = leaf && leaf.view;
        if (view && view.chatPanel) return view.chatPanel;
      }
    } catch (e) {
      /* diagnostics must never fail because a view is closing */
    }
    return null;
  }

  /**
   * Save one self-contained local diagnostics report through the same Vault path
   * used by other exports. It reads nothing outside plugin/app state and makes no
   * network request; secrets are redacted before Markdown is written.
   */
  async saveDiagnosticsBundle(options) {
    const panel = this.activeChatPanel();
    const ai = this.settings.ai || {};
    const couch = (this.settings.cards && this.settings.cards.couchdb) || this.settings.couchdb || {};
    const bundle = diagnostics.buildDiagnosticsBundle({
      manifest: this.manifest,
      platform: Platform,
      settings: this.settings,
      appVersion: this.app && this.app.version,
      panelState: panel
        ? { budget: panel.lastBudget, modelPlan: panel.lastModelPlan, error: panel.error }
        : null,
      historyMessages: panel ? panel.historyCount() : null,
      openSessions: Array.isArray(ai.chatSessions) ? ai.chatSessions.length : 0,
      bookmarks: Array.isArray(ai.studyChatBookmarks) ? ai.studyChatBookmarks.length : 0,
      chatModel: panel ? panel.chatModel() : ai.studyChatModel,
      commandCount: Array.isArray(this.commands) ? this.commands.length : null,
      capabilities: typeof this.aiCapabilities === "function" ? this.aiCapabilities() : {},
      recentErrors: this.recentDiagnosticErrors || [],
      setupError: this.manager && this.manager.setupError,
      couchdbError: couch && couch.lastError,
      now: options && options.now instanceof Date ? options.now : new Date(),
    });
    const folder = diagnostics.bundleFolder();
    await ensureFolder(this.app, folder);
    const path = await this.uniqueVaultPath(`${folder}/${diagnostics.bundleFileName(options && options.now)}`);
    await this.app.vault.create(path, bundle.markdown.endsWith("\n") ? bundle.markdown : `${bundle.markdown}\n`);
    new Notice(`Saved the diagnostics bundle to ${path}.`, 8000);
    return { path, ...bundle };
  }

  /** Create one user-authored skill note and open it; no AI or network call. */
  async createSkillNote(name) {
    const value = str(name).trim();
    if (!value) {
      new NameModal(this.app, "Name this skill", "", (next) => this.createSkillNote(next)).open();
      return null;
    }
    const folder = chatSkills.normalizeSkillsFolder(this.settings.ai.skillsFolder);
    await ensureFolder(this.app, folder);
    const path = await this.uniqueVaultPath(`${folder}/${chatSkills.skillFileName(value)}`);
    await this.app.vault.create(path, chatSkills.skillTemplate(value));
    new Notice(`Created ${path}. Edit the note, then turn on Include skills in the Study agent.`, 9000);
    try {
      await this.app.workspace.openLinkText(path, "", false);
    } catch (e) {
      /* the note still exists if the workspace cannot focus it */
    }
    return path;
  }

  /** Create a local chat project and put the active conversation in it. */
  async promptChatProject() {
    const view = await this.activateAgent();
    if (!view || typeof view.promptNewProject !== "function") {
      new Notice("The Study agent could not open. No project was created.");
      return null;
    }
    return view.promptNewProject();
  }

  /** The name prompt behind the project pickers. No AI, network or file write. */
  promptNewChatProject(view, tab) {
    if (!view || typeof view.createChatProject !== "function") return false;
    new NameModal(this.app, "Name the new chat project", "", (name) => {
      const project = view.createChatProject(name);
      if (project) view.assignChatProjectById(project.id, tab);
    }).open();
    return true;
  }

  /** Notice a local cost estimate for the active conversation. Never sends a request. */
  showChatCostEstimate() {
    const ai = this.settings && this.settings.ai;
    if (!ai) return { ok: false, reason: "AI settings are not available" };
    const messages = Array.isArray(ai.studyChat) ? ai.studyChat : [];
    if (!messages.length) {
      new Notice("Start a conversation before estimating its cost.", 5000);
      return { ok: false, reason: "no messages yet" };
    }
    const model = String(ai.studyChatModel || ai.api.model || "").trim();
    if (!chatPricing.findPricing(ai.pricing, model)) {
      new Notice("Set local model prices in Settings → AI → Local model pricing to estimate this chat's cost.", 9000);
      return { ok: false, reason: "no pricing for this model" };
    }
    const cost = chatPricing.estimateConversationCost(ai.pricing, model, messages, {});
    if (!cost.ok) {
      new Notice("This chat has no cost estimate yet.", 5000);
      return cost;
    }
    new Notice(
      `This chat is about ${chatPricing.formatUsd(cost.total)} at your local prices (${cost.turns} repl${cost.turns === 1 ? "y" : "ies"}; an estimate, not an invoice).`,
      9000
    );
    return cost;
  }

  /** Open the local memory editor; facts stay in settings and on this device. */
  openMemoryModal() {
    if (!this.settings || !this.settings.ai) return null;
    const modal = new ChatMemoryModal(this.app, this);
    modal.open();
    return modal;
  }

  /** Save one short fact after redaction. No file, network or provider call. */
  rememberFact(text) {
    const ai = this.settings && this.settings.ai;
    if (!ai) return { ok: false, reason: "empty", facts: [] };
    const result = chatMemory.addFact(ai.chatMemory, text, Date.now());
    if (result.ok) {
      ai.chatMemory = result.facts;
      this.save();
      this.refreshViews();
      new Notice(`Saved a memory fact on this device: "${result.fact.text}"`, 7000);
    } else {
      new Notice(chatMemory.reasonText(result.reason), 6000);
    }
    return result;
  }

  updateMemoryFact(id, text) {
    const ai = this.settings && this.settings.ai;
    if (!ai) return { ok: false, reason: "missing", facts: [] };
    const result = chatMemory.updateFact(ai.chatMemory, id, text, Date.now());
    if (result.ok) {
      ai.chatMemory = result.facts;
      this.save();
      this.refreshViews();
      new Notice("Updated a memory fact on this device.", 5000);
    } else {
      new Notice(chatMemory.reasonText(result.reason), 6000);
    }
    return result;
  }

  removeMemoryFact(id) {
    const ai = this.settings && this.settings.ai;
    if (!ai) return false;
    const before = chatMemory.normalizeFacts(ai.chatMemory);
    const next = chatMemory.removeFact(ai.chatMemory, id);
    ai.chatMemory = next;
    this.save();
    this.refreshViews();
    const changed = next.length !== before.length;
    if (changed) new Notice("Removed a memory fact.", 5000);
    return changed;
  }

  /** Export the active conversation as Markdown through the existing Study agent view. */
  async exportChatAsMarkdown() {
    const view = await this.activateAgent();
    if (!view || typeof view.exportChat !== "function") {
      new Notice("The Study agent could not open. Nothing was exported.");
      return null;
    }
    const tab = view.activeTab();
    return view.exportChat(tab && tab.id);
  }

  /** Rewind the active Direct API conversation to its most recent question. */
  async rewindLastQuestion() {
    const view = await this.activateAgent();
    if (!view || typeof view.rewindLastQuestion !== "function") {
      new Notice("The Study agent could not open. Nothing changed.");
      return false;
    }
    return view.rewindLastQuestion();
  }

  /** Fork the active Direct API conversation from its most recent question. */
  async forkLastQuestion() {
    const view = await this.activateAgent();
    if (!view || typeof view.forkLastQuestion !== "function") {
      new Notice("The Study agent could not open. Nothing changed.");
      return false;
    }
    return view.forkLastQuestion();
  }

  /** Ask for a goal, then let the Study agent propose a numbered plan. Nothing runs yet. */
  async promptStudyPlan() {
    if (!(this.settings.ai && this.settings.ai.enabled)) {
      new Notice("Turn on AI under Settings > Study agent > AI and the assistant to plan a task.");
      return false;
    }
    new NameModal(this.app, "Plan a multi-step task", "", (goal) => {
      this.startAgentPlan(goal).catch((e) => {
        this.recordDiagnosticError("chat plan", e);
        new Notice(`Could not start the plan: ${String((e && e.message) || e)}`, 8000);
      });
    }).open();
    return true;
  }

  /** Open the Study agent and ask it for a plan for one goal. */
  async startAgentPlan(goal) {
    const view = await this.activateAgent();
    if (!view || typeof view.startPlan !== "function") {
      new Notice("The Study agent could not open. No plan was requested.");
      return false;
    }
    return view.startPlan(goal);
  }

  /** Open the Study agent and its vault PDF picker; nothing is sent or written. */
  async attachPdfToStudyAgent() {
    if (!(this.settings.ai && this.settings.ai.enabled)) {
      new Notice("Turn on AI under Settings > Study agent > AI and the assistant to attach a PDF to the Study agent.");
      return false;
    }
    const view = await this.activateAgent();
    if (!view || typeof view.attachPdf !== "function") {
      new Notice("The Study agent could not open. No PDF was attached.");
      return false;
    }
    return view.attachPdf();
  }

  openCardExport(options, onDone) {
    if (this.moduleOff("cards")) return;
    new CardExportModal(
      this.app,
      this,
      options || {},
      (result) => {
        this.refreshViews();
        if (onDone) onDone(result);
      }
    ).open();
  }

  /** Shared build options, including the opt-in vault tags and source backlinks. */
  ankiBuildOptions(options, settings) {
    const opts = options || {};
    const anki = settings || normalizeAnkiConnect(this.settings.cards.ankiConnect);
    return {
      deck: opts.targetDeck || anki.deck,
      defaultDeck: this.settings.cards.defaultDeck,
      folderDecks: anki.folderDecks,
      cardRoot: this.settings.cards.newCardFolder,
      vaultTags: anki.vaultTags,
      backlinks: anki.backlinks === true,
      excludeTags: anki.excludeTags,
      excludeDecks: anki.excludeDecks,
      excludeFolders: anki.excludeFolders,
      omitRegex: anki.omitRegex,
      excalidraw: { ...anki.excalidraw },
      vaultName: typeof this.app.vault.getName === "function" ? this.app.vault.getName() : "",
    };
  }

  openAnkiConnectPush(options, onDone) {
    if (this.moduleOff("cards")) return;
    const settings = normalizeAnkiConnect(this.settings.cards.ankiConnect);
    if (!settings.enabled) {
      new Notice("Turn on AnkiConnect sync under Settings, Cards, Decks first.");
      return;
    }
    new AnkiConnectModal(
      this.app,
      this,
      options || {},
      (result) => {
        this.refreshViews();
        if (onDone) onDone(result);
      }
    ).open();
  }

  /** Record the Anki identity and the content both sides last agreed on. */
  async stampAnkiCard(file, info) {
    if (!(file instanceof TFile)) return false;
    const data = info || {};
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (data.noteId !== undefined) fm.anki_note_id = String(data.noteId);
      if (data.cardId !== undefined) fm.anki_card_id = String(data.cardId);
      if (data.deck) fm.anki_deck = String(data.deck);
      if (data.model) fm.anki_model = String(data.model);
      if (data.ord !== undefined) fm.anki_ord = Math.max(0, Math.round(Number(data.ord) || 0));
      if (data.due !== undefined) fm.anki_due = Math.round(Number(data.due) || 0);
      if (data.interval !== undefined) fm.anki_interval = Math.max(0, Math.round(Number(data.interval) || 0));
      if (data.reps !== undefined) fm.anki_reps = Math.max(0, Math.round(Number(data.reps) || 0));
      if (data.lapses !== undefined) fm.anki_lapses = Math.max(0, Math.round(Number(data.lapses) || 0));
      if (data.localHash) fm.anki_synced_hash = data.localHash;
      if (data.remoteHash) fm.anki_remote_hash = data.remoteHash;
      if (data.localHash || data.remoteHash) fm.anki_last_sync = new Date().toISOString();
    });
    return true;
  }

  /** Drop the Anki identity after Anki reports that its note is gone. */
  async clearAnkiLink(file) {
    if (!(file instanceof TFile)) return false;
    const keys = [
      "anki_note_id",
      "anki_card_id",
      "anki_deck",
      "anki_model",
      "anki_ord",
      "anki_due",
      "anki_interval",
      "anki_reps",
      "anki_lapses",
      "anki_synced_hash",
      "anki_remote_hash",
      "anki_last_sync",
    ];
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      for (const key of keys) delete fm[key];
    });
    return true;
  }

  /** Replace a card's body with Anki's version while keeping its history and ## Notes. */
  async applyAnkiRemote(record, remote, options) {
    const opts = options || {};
    const fm = record.fm || {};
    const cloze = remote.type === "Cloze";
    let cardType = cloze ? "cloze" : str(fm.card_type).trim() || "basic";
    if (!["basic", "reversed", "cloze"].includes(cardType)) cardType = "basic";
    if (cloze) cardType = "cloze";
    let front = str(remote.front).trim();
    let back = str(remote.back).trim();
    if (!cloze && cardType === "reversed") {
      const swap = front;
      front = back;
      back = swap;
    }
    if (!front || !back) throw new Error("Anki returned a card without both sides; it was left unchanged.");
    const generated = cardNote({
      id: fm.card_id,
      front,
      back,
      cardType,
      deck: remote.deck || record.deck,
      course: record.course,
      tags: remote.tags,
    });
    const oldText = await this.app.vault.cachedRead(record.file);
    const close = oldText.indexOf("\n---\n", 3);
    if (close < 0) throw new Error("The existing card has no closing frontmatter fence.");
    const body = noteBodyText(generated.text);
    const notes = noteNotesSection(noteBodyText(oldText));
    const merged = notes ? `${body.trimEnd()}\n\n${notes}\n` : body;
    await this.app.vault.modify(record.file, oldText.slice(0, close + 5) + merged);
    const remoteHash = syncHash(remote);
    await this.app.fileManager.processFrontMatter(record.file, (next) => {
      if (remote.deck && !opts.keepDeck) next.deck = remote.deck;
      if (remote.tags && remote.tags.length) next.tags = remote.tags.slice();
      else delete next.tags;
      if (cardType !== "basic") next.card_type = cardType;
      else delete next.card_type;
      next.anki_note_id = String(record.fm.anki_note_id || "");
      if (remote.cardId) next.anki_card_id = String(remote.cardId);
      if (remote.deck) next.anki_deck = remote.deck;
      if (remote.modelName) next.anki_model = remote.modelName;
      if (remote.ord !== undefined) next.anki_ord = Math.max(0, Math.round(Number(remote.ord) || 0));
      if (remote.due !== undefined) next.anki_due = Math.round(Number(remote.due) || 0);
      if (remote.interval !== undefined) next.anki_interval = Math.max(0, Math.round(Number(remote.interval) || 0));
      if (remote.reps !== undefined) next.anki_reps = Math.max(0, Math.round(Number(remote.reps) || 0));
      if (remote.lapses !== undefined) next.anki_lapses = Math.max(0, Math.round(Number(remote.lapses) || 0));
      next.anki_synced_hash = remoteHash;
      next.anki_remote_hash = remoteHash;
      next.anki_last_sync = new Date().toISOString();
    });
    return remoteHash;
  }

  /** Remember which local paths are linked to which Anki notes, for safe deletion previews. */
  async rememberAnkiIndex() {
    const index = {};
    const cards = typeof this.getCards === "function" ? this.getCards() : [];
    for (const card of cards) {
      const fm = (card && card.fm) || {};
      const noteId = str(fm.anki_note_id).trim();
      const path = str(card && card.file && card.file.path).trim();
      if (!noteId || !path) continue;
      index[path] = { noteId, cardId: str(fm.anki_card_id).trim() };
    }
    this.settings.cards.ankiConnect.index = index;
    await this.save();
    return index;
  }

  /** Linked paths that no longer exist locally; only used when the owner opted in. */
  pendingAnkiDeletions(settings) {
    const index = settings && settings.index && typeof settings.index === "object" ? settings.index : {};
    const out = [];
    for (const [path, meta] of Object.entries(index)) {
      if (!path || !meta || !str(meta.noteId).trim()) continue;
      if (this.app.vault.getAbstractFileByPath(path)) continue;
      out.push({ path, noteId: str(meta.noteId).trim(), cardId: str(meta.cardId).trim() });
    }
    return out;
  }

  /** Upload referenced vault media before Anki fields point at it. Failures are warnings. */
  async uploadAnkiMedia(client, built) {
    const warnings = [];
    // Anki media is flat: the filename is the identity. Track the resolved
    // vault path as well, so two different files that share a basename cannot
    // silently overwrite each other in Anki.
    const seen = new Map();
    const files = [];
    for (const ref of Array.isArray(built && built.media) ? built.media : []) {
      const name = str(ref && ref.name).trim();
      if (!name) continue;
      let file = null;
      try {
        if (this.app.metadataCache && typeof this.app.metadataCache.getFirstLinkpathDest === "function") {
          file = this.app.metadataCache.getFirstLinkpathDest(name, ref.sourcePath || "");
        }
        if (!file) file = this.app.vault.getAbstractFileByPath(ref.target || name);
        if (!file && typeof this.app.vault.getFiles === "function") {
          file = this.app.vault.getFiles().find((item) => str(item.name || item.basename) === name) || null;
        }
      } catch (e) {
        file = null;
      }
      if (!file) {
        warnings.push(`${ref.sourcePath || "card"}: could not find ${name} in the vault; the text was sent without it.`);
        continue;
      }
      const resolvedPath = str(file.path || ref.target || name);
      if (seen.has(name)) {
        const previous = seen.get(name);
        if (previous !== resolvedPath) {
          warnings.push(
            `${ref.sourcePath || "card"}: media filename conflict for "${name}": ${previous} was selected for upload, so ${resolvedPath} will not be. Rename one of the files to sync both.`
          );
        }
        continue;
      }
      try {
        const bytes = await this.readVaultBytes(file);
        files.push({ filename: name, data: Buffer.from(bytes).toString("base64") });
        seen.set(name, resolvedPath);
      } catch (e) {
        warnings.push(`${ref.sourcePath || "card"}: could not read ${name}; the text was sent without it.`);
      }
    }
    if (files.length) {
      try {
        await client.storeMedia(files);
      } catch (e) {
        warnings.push(`Media upload failed: ${str(e && e.message ? e.message : e)}. The text was sent without it.`);
      }
    }
    return warnings;
  }

  /** Read-only AnkiConnect plan: creates, updates, pulls, conflicts and Anki-side deletions. */
  async previewAnkiSync(options) {
    if (this.moduleOff("cards")) throw new Error("Turn on the Cards module first.");
    const opts = options || {};
    const settings = normalizeAnkiConnect(this.settings.cards.ankiConnect);
    if (!settings.enabled) throw new Error("Turn on AnkiConnect sync under Settings, Cards, Decks first.");
    const cards = opts.vaultWide === true
      ? this.getCards()
      : this.filteredCards({ deck: opts.deck, course: opts.course, includeHidden: true });
    if (!cards.length) throw new Error(opts.vaultWide === true ? "No card notes were found in the vault." : "No cards match the current deck and course filter.");
    const buildOptions = this.ankiBuildOptions(opts, settings);
    const records = [];
    const errors = [];
    const warnings = [];
    for (const card of cards) {
      try {
        const text = await this.app.vault.cachedRead(card.file);
        const record = { ...card, body: parseCardBody(text, card.fm) };
        const exclusion = ankiExclusionReason(record, buildOptions);
        if (exclusion) {
          warnings.push(`${record.file.path}: skipped because ${exclusion}.`);
          continue;
        }
        records.push(record);
      } catch (e) {
        errors.push(`${card.file.path}: ${String((e && e.message) || e)}`);
      }
    }
    const entries = [];
    const counts = { create: 0, update: 0, pull: 0, conflict: 0, missing: 0, delete: 0, unchanged: 0, media: 0 };
    const build = (list) => buildAnkiNotes(list, buildOptions);
    const unlinked = records.filter((record) => !str(record.fm && record.fm.anki_note_id).trim());
    if (unlinked.length) {
      const built = build(unlinked);
      counts.create = built.notes.length;
      counts.media += built.media.length;
      for (let i = 0; i < built.notes.length; i++) {
        const note = built.notes[i];
        entries.push({ action: "create", path: built.paths[i], deck: note.deckName, front: note.fields.Front || note.fields.Text || "" });
      }
      warnings.push(...built.warnings);
    }
    if (!opts.pushOnly && settings.deleteMissing) {
      for (const item of this.pendingAnkiDeletions(settings)) {
        counts.delete++;
        entries.push({ action: "delete", path: item.path, noteId: item.noteId, detail: "The local note is gone; this Anki note will be deleted only after you apply." });
      }
    }
    if (opts.pushOnly) {
      const linked = records.filter((record) => str(record.fm && record.fm.anki_note_id).trim());
      if (linked.length) {
        const client = new AnkiConnectClient({ url: settings.url });
        const notes = await client.notesInfo(linked.map((record) => str(record.fm.anki_note_id)));
        const noteById = new Map(notes.map((note) => [str(note && note.noteId), note]));
        for (const record of linked) {
          const noteId = str(record.fm.anki_note_id).trim();
          if (!noteById.has(noteId)) {
            counts.missing++;
            entries.push({ action: "missing", path: record.file.path, noteId, detail: "Anki no longer has this note; the local card is kept." });
            continue;
          }
          const one = build([record]);
          if (!one.notes.length) {
            warnings.push(...one.warnings);
            continue;
          }
          counts.update++;
          counts.media += one.media.length;
          entries.push({ action: "update", path: record.file.path, noteId, detail: "Local content goes to Anki." });
        }
      }
      return { entries, counts, warnings, errors, total: records.length, format: "ankiconnect-preview", pushOnly: true, vaultWide: opts.vaultWide === true };
    }
    const linked = records.filter((record) => str(record.fm && record.fm.anki_note_id).trim());
    if (linked.length) {
      const client = new AnkiConnectClient({ url: settings.url });
      const notes = await client.notesInfo(linked.map((record) => record.fm.anki_note_id));
      const noteById = new Map(notes.map((note) => [str(note && note.noteId), note]));
      const cardIds = [];
      for (const note of notes) for (const id of (Array.isArray(note.cards) ? note.cards : [])) cardIds.push(id);
      const cardInfos = await client.cardsInfo(cardIds);
      const cardById = new Map(cardInfos.map((card) => [str(card && card.cardId), card]));
      for (const record of linked) {
        const noteId = str(record.fm.anki_note_id).trim();
        const note = noteById.get(noteId);
        if (!note) {
          counts.missing++;
          entries.push({
            action: "missing",
            path: record.file.path,
            noteId,
            detail: settings.clearMissing
              ? "Anki no longer has this note; the local Anki link will be cleared after you apply."
              : "Anki no longer has this note; the local card is kept.",
          });
          continue;
        }
        const noteCards = Array.isArray(note.cards) ? note.cards : [];
        const cardId = str(record.fm.anki_card_id).trim() || str(noteCards[0]);
        const card = cardById.get(cardId) || cardById.get(str(noteCards[0])) || null;
        const remote = remoteSyncRecord(note, card);
        if (!remote.front || !remote.back) {
          counts.missing++;
          entries.push({ action: "missing", path: record.file.path, noteId, detail: "Anki returned an empty card; the local card is kept." });
          continue;
        }
        let local = localSyncRecord(record, buildOptions);
        if (!remote.deck) remote.deck = local.deck;
        if (settings.deck) {
          local = { ...local, deck: "" };
          remote.deck = "";
        }
        const decision = syncDecision(local, remote, {
          local: str(record.fm.anki_synced_hash).trim(),
          remote: str(record.fm.anki_remote_hash).trim(),
        });
        const action = resolveSyncAction(decision, settings);
        if (action === "none") {
          counts.unchanged++;
          continue;
        }
        if (action === "conflict") {
          counts.conflict++;
          entries.push({ action: "conflict", path: record.file.path, noteId, detail: "Changed in both places; your conflict setting decides." });
        } else if (action === "push") {
          counts.update++;
          entries.push({
            action: "update",
            path: record.file.path,
            noteId,
            detail:
              settings.contentAuthority === "obsidian"
                ? "Obsidian owns card content; Anki keeps its schedule."
                : "Local edit goes to Anki.",
          });
        } else if (action === "pull") {
          counts.pull++;
          entries.push({ action: "pull", path: record.file.path, noteId, detail: "Anki edit comes into the note." });
        }
      }
      if (client) {
        const linkedMedia = [];
        for (const record of linked) {
          try {
            const built = build([record]);
            linkedMedia.push(...built.media);
          } catch (e) {
            /* a parse failure was already reported when the record was read */
          }
        }
        counts.media += new Set(linkedMedia.map((item) => item.name)).size;
      }
    }
    return { entries, counts, warnings, errors, total: records.length, format: "ankiconnect-preview", pushOnly: false, vaultWide: opts.vaultWide === true };
  }

  /** Optional push. It also records note IDs so the next sync can pull changes. */
  async pushCardsToAnki(options) {
    if (this.moduleOff("cards")) throw new Error("Turn on the Cards module first.");
    const opts = options || {};
    const settings = normalizeAnkiConnect(this.settings.cards.ankiConnect);
    if (!settings.enabled) throw new Error("Turn on AnkiConnect sync under Settings, Cards, Decks first.");
    const selectedPaths = Array.isArray(opts.paths) ? new Set(opts.paths.map((path) => str(path).trim()).filter(Boolean)) : null;
    const cards = selectedPaths
      ? this.getCards().filter((card) => selectedPaths.has(card.file.path))
      : opts.vaultWide === true
        ? this.getCards()
        : this.filteredCards({ deck: opts.deck, course: opts.course, includeHidden: true });
    if (!cards.length) throw new Error(selectedPaths ? "The selected card notes were not found." : opts.vaultWide === true ? "No card notes were found in the vault." : "No cards match the current deck and course filter.");
    const buildOptions = this.ankiBuildOptions(opts, settings);
    const records = [];
    const warnings = [];
    for (const card of cards) {
      try {
        const text = await this.app.vault.cachedRead(card.file);
        const record = { ...card, body: parseCardBody(text, card.fm) };
        const exclusion = ankiExclusionReason(record, buildOptions);
        if (exclusion) {
          warnings.push(`${record.file.path}: skipped because ${exclusion}.`);
          continue;
        }
        records.push(record);
      } catch (e) {
        warnings.push(`${card.file.path}: ${String((e && e.message) || e)}`);
      }
    }
    const unlinked = records.filter((record) => !str(record.fm && record.fm.anki_note_id).trim());
    const linked = records.filter((record) => str(record.fm && record.fm.anki_note_id).trim());
    const built = buildAnkiNotes(unlinked, buildOptions);
    if (!built.notes.length && !linked.length) throw new Error("Nothing in this filter can be sent to Anki yet.");
    const linkedBuilt = linked.map((record) => ({ record, built: buildAnkiNotes([record], buildOptions) }));
    const client = new AnkiConnectClient({ url: settings.url });
    warnings.push(...(await this.uploadAnkiMedia(client, { media: [...built.media, ...linkedBuilt.flatMap((entry) => entry.built.media)] })));
    const result = built.notes.length
      ? await client.push(built.notes)
      : { added: 0, duplicates: 0, failed: 0, decks: [], total: 0, ids: [], acceptedIndexes: [] };
    const byPath = new Map(unlinked.map((record) => [record.file.path, record]));
    let stamped = 0;
    for (let i = 0; i < result.acceptedIndexes.length; i++) {
      const id = result.ids[i];
      const note = built.notes[result.acceptedIndexes[i]];
      const record = note && byPath.get(built.paths[result.acceptedIndexes[i]]);
      if (id === null || id === undefined || !record) continue;
      // A configured target deck is applied by the sync, not compared as a
      // content edit. Stamp the same normalized deck the next sync will use,
      // otherwise every card would look changed on both sides.
      const local = localSyncRecord(record, buildOptions);
      if (settings.deck) local.deck = "";
      const localHash = syncHash(local);
      await this.stampAnkiCard(record.file, {
        noteId: id,
        deck: note.deckName,
        model: note.modelName,
        localHash,
        remoteHash: localHash,
      });
      stamped++;
    }
    const errors = [];
    let updated = 0;
    for (const entry of linkedBuilt) {
      const note = entry.built.notes[0];
      if (!note) {
        warnings.push(...entry.built.warnings);
        continue;
      }
      try {
        await client.updateNote(str(entry.record.fm.anki_note_id), str(entry.record.fm.anki_card_id), note);
        // Keep the same local hash normalization as sync, so the next run sees
        // this linked card as agreed instead of immediately pushing it again.
        const local = localSyncRecord(entry.record, buildOptions);
        if (settings.deck) local.deck = "";
        const localHash = syncHash(local);
        await this.stampAnkiCard(entry.record.file, {
          noteId: str(entry.record.fm.anki_note_id),
          cardId: str(entry.record.fm.anki_card_id) || undefined,
          deck: note.deckName,
          model: note.modelName,
          localHash,
          remoteHash: localHash,
        });
        updated++;
      } catch (e) {
        errors.push(`${entry.record.file.path}: ${str(e && e.message ? e.message : e)}`);
      }
    }
    await this.rememberAnkiIndex();
    return {
      ...result,
      stamped,
      updated,
      errors,
      format: "ankiconnect",
      count: records.length,
      warnings: [...warnings, ...built.warnings, ...linkedBuilt.flatMap((entry) => entry.built.warnings)],
    };
  }

  /** Push new cards and merge edits for cards already linked to Anki. */
  async syncCardsWithAnki(options) {
    if (this.moduleOff("cards")) throw new Error("Turn on the Cards module first.");
    const opts = options || {};
    const settings = normalizeAnkiConnect(this.settings.cards.ankiConnect);
    if (!settings.enabled) throw new Error("Turn on AnkiConnect sync under Settings, Cards, Decks first.");
    const cards = opts.vaultWide === true
      ? this.getCards()
      : this.filteredCards({ deck: opts.deck, course: opts.course, includeHidden: true });
    if (!cards.length) throw new Error(opts.vaultWide === true ? "No card notes were found in the vault." : "No cards match the current deck and course filter.");
    const buildOptions = this.ankiBuildOptions(opts, settings);
    const records = [];
    const errors = [];
    const warnings = [];
    for (const card of cards) {
      try {
        const text = await this.app.vault.cachedRead(card.file);
        const record = { ...card, body: parseCardBody(text, card.fm) };
        const exclusion = ankiExclusionReason(record, buildOptions);
        if (exclusion) {
          warnings.push(`${record.file.path}: skipped because ${exclusion}.`);
          continue;
        }
        records.push(record);
      } catch (e) {
        errors.push(`${card.file.path}: ${String((e && e.message) || e)}`);
      }
    }
    const client = new AnkiConnectClient({ url: settings.url });
    const unlinked = records.filter((record) => !str(record.fm && record.fm.anki_note_id).trim());
    let pushed = 0;
    let duplicates = 0;
    if (unlinked.length) {
      const built = buildAnkiNotes(unlinked, buildOptions);
      warnings.push(...(await this.uploadAnkiMedia(client, built)));
      const result = await client.push(built.notes);
      duplicates += result.duplicates;
      warnings.push(...built.warnings);
      const byPath = new Map(unlinked.map((record) => [record.file.path, record]));
      for (let i = 0; i < result.acceptedIndexes.length; i++) {
        const noteId = result.ids[i];
        const note = built.notes[result.acceptedIndexes[i]];
        const record = note && byPath.get(built.paths[result.acceptedIndexes[i]]);
        if (noteId === null || noteId === undefined || !record) continue;
        const local = localSyncRecord(record, buildOptions);
        if (settings.deck) local.deck = "";
        const localHash = syncHash(local);
        await this.stampAnkiCard(record.file, {
          noteId,
          deck: note.deckName,
          model: note.modelName,
          localHash,
          remoteHash: localHash,
        });
        pushed++;
      }
    }

    const linked = records.filter((record) => str(record.fm && record.fm.anki_note_id).trim());
    let pulled = 0;
    let updated = 0;
    let conflicts = 0;
    let cleared = 0;
    let skipped = duplicates;
    if (linked.length) {
      const notes = await client.notesInfo(linked.map((record) => record.fm.anki_note_id));
      const noteById = new Map(notes.map((note) => [str(note && note.noteId), note]));
      const cardIds = [];
      for (const note of notes) for (const id of (Array.isArray(note.cards) ? note.cards : [])) cardIds.push(id);
      const cardInfos = await client.cardsInfo(cardIds);
      const cardById = new Map(cardInfos.map((card) => [str(card && card.cardId), card]));
      for (const record of linked) {
        const noteId = str(record.fm.anki_note_id).trim();
        const note = noteById.get(noteId);
        if (!note) {
          skipped++;
          if (settings.clearMissing) {
            try {
              await this.clearAnkiLink(record.file);
              cleared++;
              warnings.push(`${record.file.path}: the Anki note ${noteId} was not found; the local Anki link was cleared.`);
            } catch (e) {
              errors.push(`${record.file.path}: could not clear the local Anki link: ${String((e && e.message) || e)}`);
            }
          } else {
            warnings.push(`${record.file.path}: the Anki note ${noteId} was not found.`);
          }
          continue;
        }
        const noteCards = Array.isArray(note.cards) ? note.cards : [];
        const cardId = str(record.fm.anki_card_id).trim() || str(noteCards[0]);
        const card = cardById.get(cardId) || cardById.get(str(noteCards[0])) || null;
        const remote = remoteSyncRecord(note, card);
        if (!remote.front || !remote.back) {
          skipped++;
          warnings.push(`${record.file.path}: Anki returned an empty card and it was left unchanged.`);
          continue;
        }
        let local = localSyncRecord(record, buildOptions);
        // Older or partial Anki replies can omit the deck; keep the local name
        // rather than treating that omission as a deck move.
        if (!remote.deck) remote.deck = local.deck;
        if (settings.deck) {
          local = { ...local, deck: "" };
          remote.deck = "";
        }
        const decision = syncDecision(local, remote, {
          local: str(record.fm.anki_synced_hash).trim(),
          remote: str(record.fm.anki_remote_hash).trim(),
        });
        const action = resolveSyncAction(decision, settings);
        if (action === "conflict") {
          conflicts++;
          warnings.push(`${record.file.path}: changed in both Obsidian and Anki; kept the local card.`);
          continue;
        }
        try {
          if (action === "none") {
            await this.stampAnkiCard(record.file, {
              noteId,
              cardId,
              deck: remote.deck,
              model: remote.modelName,
              ord: remote.ord,
              due: remote.due,
              interval: remote.interval,
              reps: remote.reps,
              lapses: remote.lapses,
              localHash: decision.localHash,
              remoteHash: decision.remoteHash,
            });
          } else if (action === "push") {
            const built = buildAnkiNotes([record], buildOptions);
            if (!built.notes.length) {
              skipped++;
              continue;
            }
            warnings.push(...(await this.uploadAnkiMedia(client, built)));
            await client.updateNote(noteId, cardId, built.notes[0]);
            updated++;
            await this.stampAnkiCard(record.file, {
              noteId,
              cardId,
              deck: remote.deck,
              model: remote.modelName,
              ord: remote.ord,
              due: remote.due,
              interval: remote.interval,
              reps: remote.reps,
              lapses: remote.lapses,
              localHash: decision.localHash,
              remoteHash: decision.localHash,
            });
          } else if (action === "pull") {
            await this.applyAnkiRemote(record, remote, { keepDeck: !!opts.targetDeck || !!settings.deck });
            pulled++;
          }
        } catch (e) {
          errors.push(`${record.file.path}: ${String((e && e.message) || e)}`);
        }
      }
    }
    let deleted = 0;
    if (settings.deleteMissing) {
      const pending = this.pendingAnkiDeletions(settings);
      if (pending.length) {
        try {
          const result = await client.deleteNotes(pending.map((item) => item.noteId));
          deleted = result.deleted;
        } catch (e) {
          errors.push(`Anki deletion failed: ${str(e && e.message ? e.message : e)}`);
        }
      }
    }
    await this.rememberAnkiIndex();
    return {
      pushed,
      pulled,
      updated,
      deleted,
      cleared,
      conflicts,
      skipped,
      duplicates,
      errors,
      warnings,
      total: records.length,
      format: "ankiconnect-sync",
    };
  }

  openCardExtract(path, options, onDone) {
    if (this.moduleOff("cards")) return;
    const target = path && path.path ? path.path : str(path).trim();
    if (!target) {
      new Notice("Open a Markdown note first.");
      return;
    }
    new CardExtractModal(this.app, this, { ...(options || {}), path: target }, (result) => {
      this.refreshViews();
      if (onDone) onDone(result);
    }).open();
  }

  openTranscriptPractice(path, options) {
    if (this.moduleOff("mcq") && this.moduleOff("cards")) {
      new Notice("Turn on MCQ Tracker or Cards before generating practice.");
      return;
    }
    const target = path && path.path ? path.path : str(path).trim();
    if (!target) {
      new Notice("Open a Markdown note first.");
      return;
    }
    new TranscriptPracticeModal(this.app, this, { ...(options || {}), path: target }, () => this.refreshViews()).open();
  }

  /** Count generated cards and questions linked to one lecture row. */
  lecturePracticeSummary(lectureId) {
    const wanted = str(lectureId).trim();
    if (!wanted) return { cards: 0, questions: 0 };
    const matches = (item) => str(item && item.fm && item.fm.lecture_id).trim() === wanted;
    return {
      cards: this.getCards().filter(matches).length,
      questions: this.getQuestions().filter(matches).length,
    };
  }

  /** Open the existing transcript generator with an explicit lecture identity. */
  openLecturePractice(lecture) {
    const data = lecture && typeof lecture === "object" ? lecture : {};
    const source = str(data.processedPath || data.notePath).trim();
    const file = source ? this.app.vault.getAbstractFileByPath(source) : null;
    if (!(file instanceof TFile)) {
      new Notice("Attach a lecture note or compile the lecture log before generating practice.");
      return;
    }
    this.openTranscriptPractice(file.path, {
      force: true,
      lectureId: str(data.id).trim(),
      lecturePath: file.path,
    });
  }

  weakSpotChoices() {
    return weakSpotRows(this.getQuestions())
      .slice(0, 8)
      .map((row) => ({ ...row, course: str(row.course).trim() }));
  }

  openWeakSpotGenerate(onDone) {
    if (!this.settings.ai.enabled) {
      new Notice("Turn on AI features under Settings, Global, Modules, then choose a provider under MCQ Tracker, AI.");
      return null;
    }
    const modal = new WeakSpotModal(this.app, this, onDone);
    modal.open();
    return modal;
  }

  /** Draft original questions or cards for one weak skill. This method writes nothing. */
  async generateWeakSpotPractice(options) {
    const opts = options || {};
    if (!this.settings.ai.enabled) throw new Error("Turn on AI features under Settings, Global, Modules first.");
    const rows = weakSpotRows(this.getQuestions());
    const row = (opts.skill && rows.find((item) => item.value === opts.skill)) || pickWeakSpot(this.getQuestions());
    if (!row) throw new Error("Answer at least one question first so the plugin can find a weak spot.");
    const kind = opts.kind === "cards" ? "cards" : "questions";
    if (kind === "questions" && this.moduleOff("mcq")) throw new Error("Turn on MCQ Tracker to create practice questions.");
    if (kind === "cards" && this.moduleOff("cards")) throw new Error("Turn on Cards to create flashcards.");
    const count = Math.max(1, Math.min(20, Math.round(Number(opts.count) || (kind === "cards" ? 8 : 5))));
    const prompt = buildWeakSpotPrompt({ skill: row.value, course: opts.course, kind, count });
    const reply = await this.aiComplete(prompt.system, prompt.user, { feature: "generation", maxTokens: kind === "questions" ? 3500 : 2500 });
    const parsed = kind === "questions" ? parseAiQuestions(reply, count) : parseAiCards(reply, count);
    const items = kind === "questions" ? parsed.questions : parsed.cards;
    const verification = kind === "questions" ? await this.verifyDraftQuestions(items) : await this.verifyDraftCards(items);
    return {
      kind,
      sourcePath: "",
      title: `Weak spot: ${row.value}`,
      course: str(opts.course).trim(),
      skill: row.value,
      items: items.filter((item) => !(item.verification && item.verification.drop)),
      verification,
      errors: [],
      ai: true,
      model: this.aiModelLabel("generation"),
    };
  }

  /** Remember protected review state before an Agent-mode request. */
  snapshotProtectedState() {
    const records = [...this.getQuestions(), ...(typeof this.getCards === "function" ? this.getCards() : [])];
    return agentWriteGuard.snapshotProtected(records);
  }

  /** Put back any protected review state an Agent-mode request changed. */
  async restoreProtectedState(snapshot) {
    if (!snapshot || typeof snapshot.forEach !== "function") return [];
    const restored = [];
    for (const [path, before] of snapshot) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) continue;
      const current = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
      const changes = agentWriteGuard.changedProtected(before, current);
      if (!changes.length) continue;
      await this.app.fileManager.processFrontMatter(file, (fm) => agentWriteGuard.restoreFrontmatter(fm, before));
      restored.push({ path, changes });
    }
    if (restored.length) this.refreshViews();
    return restored;
  }

  /** Folders whose markdown files an agent request can change. */
  agentReviewRoots() {
    return allowedWriteRoots(this.settings);
  }

  /**
   * Read the notes the agent may edit before a request. Open notes outside the
   * normal write folders are included when passed explicitly.
   */
  async captureAgentBaseline(extraPaths) {
    const roots = this.agentReviewRoots();
    const baseline = new Map();
    const read = async (file) => {
      if (!(file instanceof TFile) || !agentEditReview.isMarkdownPath(file.path) || baseline.has(file.path)) return;
      baseline.set(file.path, await this.app.vault.cachedRead(file));
    };
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (agentEditReview.isReviewablePath(file.path, roots)) await read(file);
    }
    for (const path of Array.isArray(extraPaths) ? extraPaths : []) {
      const file = this.app.vault.getAbstractFileByPath(str(path).trim());
      if (file instanceof TFile) await read(file);
    }
    return baseline;
  }

  /** Revert the agent's writes and return them for per-file approval. */
  async stageAgentEdits(baseline) {
    if (!(baseline instanceof Map)) return [];
    const roots = this.agentReviewRoots();
    const current = new Map();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!(file instanceof TFile)) continue;
      if (!baseline.has(file.path) && !agentEditReview.isReviewablePath(file.path, roots)) continue;
      current.set(file.path, await this.app.vault.cachedRead(file));
    }
    const changes = agentEditReview.compareSnapshots(baseline, current);
    if (!changes.length) return [];
    for (const change of changes) {
      if (change.status === "added") await this.trashAgentFile(change.path);
      else if (change.status === "modified") {
        const file = this.app.vault.getAbstractFileByPath(change.path);
        if (file instanceof TFile) await this.app.vault.modify(file, change.before);
      } else if (change.status === "deleted") {
        await this.writeAgentFile(change.path, change.before);
      }
    }
    this.refreshViews();
    return changes;
  }

  async writeAgentFile(path, text) {
    const found = this.app.vault.getAbstractFileByPath(path);
    if (found instanceof TFile) {
      await this.app.vault.modify(found, text);
      return found;
    }
    const dir = path.includes("/") ? path.replace(/\/[^/]*$/, "") : "";
    if (dir) await ensureFolder(this.app, dir);
    return this.app.vault.create(path, text);
  }

  async trashAgentFile(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return false;
    await this.app.fileManager.trashFile(file);
    return true;
  }

  /** Write only the files the learner selected in the agent review. */
  async applyAgentEdits(changes, selectedPaths) {
    const selected = agentEditReview.selectedChanges(changes, selectedPaths);
    const applied = [];
    const conflicts = [];
    for (const change of selected) {
      const file = this.app.vault.getAbstractFileByPath(change.path);
      const current = file instanceof TFile ? await this.app.vault.cachedRead(file) : null;
      if (agentEditReview.normalizeText(current) !== change.before) {
        conflicts.push(change.path);
        continue;
      }
      if (change.after === null) await this.trashAgentFile(change.path);
      else await this.writeAgentFile(change.path, change.after);
      applied.push(change.path);
    }
    if (applied.length) {
      this.agentEditUndo = selected.filter((change) => applied.includes(change.path));
      this.refreshViews();
    }
    return { applied, conflicts };
  }

  /** Reverse the last applied agent review. */
  async undoLastAgentEdit() {
    const changes = Array.isArray(this.agentEditUndo) ? this.agentEditUndo : [];
    if (!changes.length) return { restored: 0, paths: [] };
    const paths = [];
    for (const change of changes) {
      if (change.before === null) await this.trashAgentFile(change.path);
      else await this.writeAgentFile(change.path, change.before);
      paths.push(change.path);
    }
    this.agentEditUndo = null;
    this.refreshViews();
    return { restored: paths.length, paths };
  }

  async undoLastAgentEditCommand() {
    const result = await this.undoLastAgentEdit();
    if (!result.restored) {
      new Notice("No applied agent edits to undo.");
      return result;
    }
    new Notice(`Undid agent edits in ${result.restored} note${result.restored === 1 ? "" : "s"}.`, 7000);
    return result;
  }

  /** Ask one independent question, without showing the stored key. */
  async verifyQuestionDraft(item) {
    const data = item || {};
    const rawKey = str(data.answer).trim();
    if (!rawKey) throw new Error("This item has no answer to check.");
    const choices = Array.isArray(data.choices) ? data.choices : [];
    if (choices.length) {
      let keyLetters = parseChoiceSet(rawKey);
      if (!keyLetters.length) {
        const index = choices.findIndex((choice) => str(choice && choice.text !== undefined ? choice.text : choice).trim().toLowerCase() === rawKey.toLowerCase());
        if (index >= 0) keyLetters = [str(choices[index] && choices[index].letter ? choices[index].letter : "ABCDEFGH"[index]).trim().toUpperCase()];
      }
      if (!keyLetters.length) throw new Error("The stored answer does not match the choices.");
      const multiple = keyLetters.length > 1 || data.multiple === true;
      const prompt = buildBlindVerificationPrompt({ question: data.question, choices, multiple });
      const reply = await this.aiComplete(prompt.system, prompt.user, { feature: "verification", maxTokens: 800 });
      if (multiple) {
        const answer = parseBlindVerificationSet(reply);
        if (!answer.length) throw new Error("The AI did not return a usable answer set.");
        const key = keyLetters.join(", ");
        return { match: answer.join(", ") === key, answer: answer.join(", "), key, confidence: "" };
      }
      const verdict = parseBlindVerification(reply);
      if (!verdict.answer) throw new Error("The AI did not return a usable answer letter.");
      const key = keyLetters[0];
      return { match: verdict.answer === key, answer: verdict.answer, key, confidence: verdict.confidence };
    }
    const keyNumber = Number(rawKey.replace(/[^0-9+-.eE]/g, ""));
    if (!Number.isFinite(keyNumber)) throw new Error("Only multiple-choice, true/false, multi-select or numeric answers can be checked.");
    const prompt = buildBlindVerificationPrompt({ question: data.question });
    const reply = await this.aiComplete(prompt.system, prompt.user, { feature: "verification", maxTokens: 800 });
    const answer = parseBlindVerificationNumber(reply);
    if (answer === null) throw new Error("The AI did not return a usable numeric answer.");
    const tolerance = Math.max(1e-9, Math.abs(keyNumber) * 1e-9);
    return {
      match: Math.abs(answer - keyNumber) <= tolerance,
      answer: String(answer),
      key: String(keyNumber),
      confidence: "",
      method: "numeric",
    };
  }

  /**
   * Rule-based check for generated cards: both sides present, a basic answer
   * not sitting inside its prompt, and exactly one deletion on a cloze card.
   */
  async verifyDraftCards(items) {
    const list = Array.isArray(items) ? items : [];
    const mode = normalizeVerificationMode(this.settings.ai.verification);
    const date = localDate();
    let checked = 0;
    let dropped = 0;
    let failed = 0;
    const results = verifyCardDrafts(list);
    for (const result of results) {
      const item = result.card;
      if (!item || typeof item !== "object") continue;
      const status = result.match ? "match" : "mismatch";
      item.verification = {
        status,
        match: result.match,
        reasons: result.reasons,
        key: "",
        model: "local rule",
        date,
        drop: !result.match && mode === "drop",
      };
      checked++;
      if (item.verification.drop) dropped++;
      if (!result.match) failed++;
    }
    return { checked, dropped, failed, mode };
  }

  /**
   * Runs the blind check over generated or imported drafts. A mismatch is
   * marked for review, or dropped when the user chose that setting.
   */
  async verifyDraftQuestions(items) {
    const list = Array.isArray(items) ? items : [];
    const mode = normalizeVerificationMode(this.settings.ai.verification);
    const model = this.aiModelLabel("verification");
    const date = localDate();
    let checked = 0;
    let dropped = 0;
    let failed = 0;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const answerText = str(item.answer).trim();
      const quality = checkDistractorQuality(item);
      if (!quality.ok) {
        // Structural distractor defects are never written, even in "mark"
        // mode: a question with an invalid option is not usable practice.
        item.verification = {
          status: "mismatch",
          match: false,
          reasons: quality.reasons,
          answer: "",
          key: answerText,
          model: "local quality rule",
          date,
          drop: true,
          quality: true,
        };
        checked++;
        dropped++;
        failed++;
        continue;
      }
      const numeric = Number(answerText.replace(/[^0-9+-.eE]/g, ""));
      if (!answerText || (!(Array.isArray(item.choices) && item.choices.length) && !Number.isFinite(numeric))) {
        item.verification = { status: "unchecked", match: null, answer: "", key: answerText, model, date, drop: false };
        continue;
      }
      try {
        const result = await this.verifyQuestionDraft(item);
        const status = result.match ? "match" : "mismatch";
        item.verification = {
          status,
          match: result.match,
          answer: result.answer,
          key: result.key,
          confidence: result.confidence,
          model,
          date,
          drop: !result.match && mode === "drop",
        };
        checked++;
        if (item.verification.drop) dropped++;
      } catch (e) {
        item.verification = {
          status: "error",
          match: null,
          answer: "",
          key: str(item.answer).trim(),
          error: str(e && e.message ? e.message : e),
          model,
          date,
          drop: false,
        };
        failed++;
      }
    }
    return { checked, dropped, failed, mode };
  }

  /** Compare a blind AI answer with the note's stored key and record the result. */
  async verifyAnswerWithAi(path) {
    if (!this.settings.ai.enabled) throw new Error("Turn on AI features under Settings, Global, Modules first.");
    const file = this.app.vault.getAbstractFileByPath(str(path).trim());
    if (!(file instanceof TFile)) throw new Error("That note is not in the vault.");
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    if (fm.question_id === undefined || fm.question_id === null || fm.question_id === "") throw new Error("Only question notes can be verified.");
    const sections = parseSections(await this.app.vault.cachedRead(file));
    const key = str(findAnswerKey(fm, sections)).trim().toUpperCase();
    if (!key) throw new Error("This note has no stored answer to compare.");
    const result = await this.verifyQuestionDraft({ question: sections.question, choices: sections.choices, answer: key });
    const verification = {
      status: result.match ? "match" : "mismatch",
      match: result.match,
      answer: result.answer,
      key,
      confidence: result.confidence,
      model: this.aiModelLabel("verification"),
      date: localDate(),
    };
    await this.app.fileManager.processFrontMatter(file, (data) => {
      Object.assign(data, verificationFields(verification));
      delete data.answer_verified;
      delete data.answer_verified_on;
      delete data.answer_verified_model;
      delete data.answer_verification;
      if (!result.match) data.needs_review = true;
    });
    await this.app.vault.modify(file, addVerificationBanner(await this.app.vault.cachedRead(file), verification));
    this.refreshViews();
    return { ...verification, path: file.path };
  }

  /** Compare a note's numeric answer with its calculation, without calling a model. */
  async verifyAnswerByCalculation(path) {
    const file = this.app.vault.getAbstractFileByPath(str(path).trim());
    if (!(file instanceof TFile)) throw new Error("That note is not in the vault.");
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    if (fm.question_id === undefined || fm.question_id === null || fm.question_id === "") {
      throw new Error("Only question notes can be verified.");
    }
    const sections = parseSections(await this.app.vault.cachedRead(file));
    const key = findAnswerKey(fm, sections);
    const result = computedVerification({ ...fm, answer: key }, { key, date: localDate() });
    if (!result) throw new Error("This note has no numeric calculation or answer formula to check.");
    await this.applyComputedVerification(file, result);
    this.refreshViews();
    return { ...result, path: file.path };
  }

  /** Write one computed verification and refresh the visible warning banner. */
  async applyComputedVerification(file, result) {
    const verification = { ...result, date: result.date || localDate() };
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      Object.assign(fm, verificationFields(verification));
      if (verification.status === "mismatch" || verification.status === "error" || verification.status === "review") fm.needs_review = true;
      if (!fm.answer && verification.status === "match" && !fm.variables) fm.answer = verification.answer;
    });
    await this.app.vault.modify(file, addVerificationBanner(await this.app.vault.cachedRead(file), verification));
  }

  /** Properties a computed check would change, without writing them. */
  calculationPreviewChanges(fm, result) {
    const fields = verificationFields(result);
    if (!fm.answer && result.status === "match" && !fm.variables) fields.answer = result.answer;
    if (result.status === "mismatch" || result.status === "error" || result.status === "review") fields.needs_review = true;
    return Object.keys(fields)
      .filter((key) => JSON.stringify(fm[key] === undefined ? null : fm[key]) !== JSON.stringify(fields[key] === undefined ? null : fields[key]))
      .map((key) => ({ key, before: fm[key], after: fields[key] }));
  }

  /** Compute the whole vault's calculation checks first; write nothing. */
  async previewCalculationVerification() {
    const items = [];
    let checked = 0;
    let mismatched = 0;
    let errors = 0;
    let skipped = 0;
    let unchanged = 0;
    for (const q of this.getQuestions()) {
      try {
        const text = await this.app.vault.cachedRead(q.file);
        const sections = parseSections(text);
        const key = findAnswerKey(q.fm, sections);
        const result = computedVerification({ ...q.fm, answer: key }, { key, date: localDate() });
        if (!result) {
          skipped++;
          continue;
        }
        checked++;
        if (result.status === "mismatch") mismatched++;
        else if (result.status === "error") errors++;
        const changes = this.calculationPreviewChanges(q.fm, result);
        if (!changes.length) {
          unchanged++;
          continue;
        }
        items.push({ path: q.file.path, status: result.status, result, changes, beforeText: text });
      } catch (e) {
        errors++;
      }
    }
    items.sort((a, b) => a.path.localeCompare(b.path));
    return { items, checked, mismatched, errors, skipped, unchanged };
  }

  /** Apply only the calculation checks the learner confirmed. */
  async applyCalculationPreview(items, selectedPaths) {
    const wanted = selectedPaths instanceof Set ? selectedPaths : new Set(Array.isArray(selectedPaths) ? selectedPaths : []);
    const applied = [];
    const conflicts = [];
    const failed = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (!wanted.has(item.path)) continue;
      const file = this.app.vault.getAbstractFileByPath(item.path);
      if (!(file instanceof TFile)) {
        conflicts.push(item.path);
        continue;
      }
      try {
        const current = await this.app.vault.cachedRead(file);
        if (current !== item.beforeText) {
          conflicts.push(item.path);
          continue;
        }
        await this.applyComputedVerification(file, item.result);
        applied.push(item.path);
      } catch (e) {
        failed.push(item.path);
      }
    }
    if (applied.length) this.refreshViews();
    return { applied, conflicts, failed };
  }

  /** Check every question that carries a literal calculation or answer formula. */
  async verifyAllByCalculation() {
    const preview = await this.previewCalculationVerification();
    if (!preview.items.length) {
      new Notice(
        `Calculation check: ${preview.checked} numeric answer${preview.checked === 1 ? "" : "s"} checked` +
          `${preview.unchanged ? `; ${preview.unchanged} already up to date` : ""}` +
          `${preview.mismatched ? `; ${preview.mismatched} disagree` : ""}` +
          `${preview.errors ? `; ${preview.errors} could not be checked` : ""}.`,
        8000
      );
      return preview;
    }
    new CalculationPreviewModal(this.app, this, preview).open();
    return preview;
  }

  /** Read one note and describe whether it is a transcript. */
  async inspectTranscript(path) {
    const target = path && path.path ? path.path : str(path).trim();
    const file = this.app.vault.getAbstractFileByPath(target);
    if (!(file instanceof TFile)) throw new Error("That note is not in the vault.");
    if (!/\.md$/i.test(file.path)) throw new Error("Choose a Markdown note.");
    const text = await this.app.vault.cachedRead(file);
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    return { ...transcriptInfo(file, fm, text), file, fm };
  }

  /** Capability flags for the backend this device is actually using. */
  aiCapabilities() {
    return aiService.capabilities(this.backend());
  }

  aiSupports(capability) {
    return !!this.aiCapabilities()[str(capability).trim()];
  }

  aiModelFor(feature) {
    return aiService.featureModel(this.settings.ai, feature, this.backend());
  }

  /** Ask the Direct AI provider for its current chat-model list. */
  async refreshAiModels() {
    if (this.backend() !== "api") throw new Error("Runtime model discovery is available for Direct AI. Choose Direct API in the AI settings.");
    const ai = this.settings.ai;
    const found = await new ApiClient(ai, this.app).listModels();
    ai.api.models = found.models.slice();
    await this.save();
    return found;
  }

  /** Save one model chosen from the fetched list, or typed by hand. */
  async selectAiModel(model) {
    const id = str(model).trim().slice(0, 200);
    if (!id) throw new Error("Choose a model from the fetched list, or type a model name.");
    this.settings.ai.api.model = id;
    await this.save();
    return id;
  }

  /** The model name recorded in notes and shown in the UI for one feature. */
  aiModelLabel(feature) {
    const ai = this.settings.ai;
    const model = this.aiModelFor(feature || "chat");
    return model || str(ai.api && ai.api.provider).trim() || "AI";
  }

  aiUsageKey() {
    return aiService.AI_USAGE_STORAGE_KEY;
  }

  readAiUsage() {
    if (this._aiUsage && this._aiUsage.date === localDate()) return this._aiUsage;
    let usage = null;
    try {
      usage = aiService.usageForDate(this.app.loadLocalStorage(this.aiUsageKey()), localDate());
    } catch (e) {
      usage = aiService.usageForDate(null, localDate());
    }
    this._aiUsage = usage;
    return usage;
  }

  writeAiUsage(usage) {
    this._aiUsage = aiService.usageForDate(usage, localDate());
    try {
      this.app.saveLocalStorage(this.aiUsageKey(), aiService.packUsage(this._aiUsage));
    } catch (e) {
      // Keep the in-memory count for this session if device storage is unavailable.
    }
  }

  aiBudget() {
    return aiService.budgetState(this.readAiUsage(), this.settings.ai.limits, localDate());
  }

  aiRunBudget() {
    return aiService.runBudgetState(this._aiRun, this.settings.ai.limits, Date.now());
  }

  /** Check the daily and per-run caps before a request leaves the device. */
  aiCanSpend(feature) {
    const support = aiService.featureSupport(feature, this.backend());
    if (!support.ok) return support;
    const daily = this.aiBudget();
    if (!daily.allowed) return { ok: false, reason: daily.message };
    const run = this.aiRunBudget();
    if (!run.allowed) return { ok: false, reason: run.message };
    return { ok: true, reason: "" };
  }

  spendAiRequest(feature, tokens) {
    this.writeAiUsage(aiService.recordUsage(this.readAiUsage(), feature, tokens, localDate()));
    const now = Date.now();
    if (!this._aiRun || !this._aiRun.startedAt || now - this._aiRun.startedAt > 10 * 60 * 1000) {
      this._aiRun = { startedAt: now, requests: 0 };
    }
    this._aiRun.requests += 1;
  }

  /** Draft cards or questions from a transcript. This method writes nothing. */
  async generateTranscriptPractice(path, options) {
    const opts = options || {};
    const info = await this.inspectTranscript(path);
    if (!info.isTranscript && !opts.force) {
      throw new Error("This note does not look like a lecture transcript. Add `transcript: true` or use Generate practice from this note.");
    }
    const kind = opts.kind === "questions" ? "questions" : "cards";
    if (kind === "questions" && this.moduleOff("mcq")) throw new Error("Turn on MCQ Tracker to create practice questions.");
    if (kind === "cards" && this.moduleOff("cards")) throw new Error("Turn on Cards to create flashcards.");
    const count = Math.min(30, Math.max(1, Math.round(Number(opts.count) || (kind === "questions" ? 5 : 8))));
    const course = str(opts.course).trim() || info.course || courseForFolder(this.settings, info.path) || "";
    const difficulty = ["easy", "medium", "hard"].includes(str(opts.difficulty).toLowerCase()) ? str(opts.difficulty).toLowerCase() : "mixed";
    const coveredSubtopics = Array.isArray(info.fm && info.fm.generated_subtopics)
      ? info.fm.generated_subtopics.map((v) => str(v).trim()).filter(Boolean).slice(-12)
      : [];
    const folder = str(opts.folder).trim() || str(this.settings.questionFolder).trim() || "Questions";
    const sourceLectureId = str(opts.lectureId).trim() ||
      (Array.isArray(info.fm && info.fm.lecture_ids) && info.fm.lecture_ids.length === 1 ? str(info.fm.lecture_ids[0]).trim() : str(info.fm && info.fm.lecture_id).trim());
    const lecturePath = str(opts.lecturePath).trim() || (sourceLectureId ? info.path : "");
    const base = { kind, sourcePath: info.path, title: info.title, course, folder, difficulty, coveredSubtopics, lectureId: sourceLectureId, lecturePath, items: [], errors: [], ai: false, model: "" };

    if (kind === "cards" && opts.local) {
      const preview = await this.previewNoteCards(info.path, {
        deck: str(opts.deck).trim() || this.settings.cards.defaultDeck,
        course,
      });
      if (preview.blocked) return { ...base, errors: [preview.reason] };
      return { ...base, items: preview.cards || [], errors: preview.warnings || [] };
    }

    if (!this.settings.ai.enabled) {
      throw new Error("Turn on AI features under Settings, Global, Modules. Without AI, use the heading-based card option.");
    }
    const prompt =
      kind === "questions"
        ? buildTranscriptQuestionPrompt({ title: info.title, course, text: info.text, count, difficulty, coveredSubtopics })
        : buildTranscriptCardPrompt({ title: info.title, course, text: info.text, count, difficulty, coveredSubtopics });
    const reply = await this.aiComplete(prompt.system, prompt.user, { feature: "generation", maxTokens: kind === "questions" ? 4000 : 3000 });
    const parsed = kind === "questions" ? parseAiQuestions(reply, count) : parseAiCards(reply, count);
    const items = kind === "questions"
      ? parsed.questions.map((item) => ({ ...item, difficulty: item.difficulty || (difficulty === "mixed" ? "" : difficulty) }))
      : parsed.cards;
    const verification = kind === "questions" ? await this.verifyDraftQuestions(items) : await this.verifyDraftCards(items);
    return {
      ...base,
      ai: true,
      model: this.aiModelLabel("generation"),
      items: items.filter((item) => !(item.verification && item.verification.drop)),
      subtopics: [...new Set(items.map((item) => str(item.subtopic).trim()).filter(Boolean))],
      verification,
    };
  }

  /** Parse allow-listed Direct AI actions out of a chat reply. */
  parseByokToolProposals(reply) {
    return aiTools.parseToolProposals(reply);
  }

  /** Apply only the actions the learner checked in the review window. */
  async applyByokToolProposals(proposals) {
    const list = Array.isArray(proposals) ? proposals : [];
    const result = { created: 0, updated: 0, errors: [], verification: null };
    const questions = list.filter((item) => item && item.tool === "create_question");
    const cards = list.filter((item) => item && item.tool === "create_card");
    const edits = list.filter((item) => item && item.tool === "update_section");

    if (questions.length) {
      try {
        const verification = await this.verifyDraftQuestions(questions);
        const kept = questions.filter((item) => !(item.verification && item.verification.drop));
        result.verification = verification;
        const generated = {
          kind: "questions",
          title: "AI assistant",
          course: questions.map((item) => item.course).find(Boolean) || "",
          items: kept,
          verification,
          model: this.aiModelLabel("chat"),
          ai: true,
          sourcePath: "",
          subtopics: [...new Set(questions.map((item) => str(item.skill).trim()).filter(Boolean))],
        };
        const written = await this.writeTranscriptPractice(generated, { folder: this.settings.questionFolder });
        result.created += Number(written && written.created) || 0;
        result.errors.push(...((written && written.errors) || []));
      } catch (e) {
        result.errors.push(str(e && e.message ? e.message : e) || "Could not create the questions.");
      }
    }

    for (const card of cards) {
      try {
        const written = await this.createCard({
          ...card,
          aiGenerated: this.aiModelLabel("chat"),
          importFormat: "ai-tool",
        });
        if (written) result.created++;
      } catch (e) {
        result.errors.push(str(e && e.message ? e.message : e) || `Could not create the card "${card.front}".`);
      }
    }

    for (const edit of edits) {
      try {
        const file = this.app.vault.getAbstractFileByPath(edit.path);
        if (!(file instanceof TFile)) throw new Error(`"${edit.path}" is not in the vault.`);
        assertAllowedWritePath(file.path, this.settings);
        const text = await this.app.vault.cachedRead(file);
        await this.app.vault.modify(file, aiTools.replaceSection(text, edit.heading, edit.content));
        result.updated++;
      } catch (e) {
        result.errors.push(str(e && e.message ? e.message : e) || `Could not edit ${edit.path}.`);
      }
    }
    if (result.created || result.updated) this.refreshViews();
    return result;
  }

  /** Paste several questions, review the preview, then write one normal note each. */
  openQuickAdd() {
    if (this.moduleOff("mcq")) return;
    new QuickAddModal(this.app, this, () => this.refreshViews()).open();
  }

  /** Read Note Quiz Engine-style Markdown from the clipboard without writing anything. */
  async readQuizFromClipboard() {
    const empty = { text: "", found: 0, valid: 0, issues: [], errors: [] };
    if (this.moduleOff("mcq")) return { ...empty, errors: ["Turn on MCQ Tracker to import questions."] };
    const clipboard = typeof navigator !== "undefined" && navigator ? navigator.clipboard : null;
    if (!clipboard || typeof clipboard.readText !== "function") {
      return {
        ...empty,
        errors: ["This build cannot read the clipboard. Copy the generated Markdown and use Quick add questions instead."],
      };
    }
    let raw = "";
    try {
      raw = await clipboard.readText();
    } catch (e) {
      return { ...empty, errors: [`The clipboard could not be read (${str(e && e.message ? e.message : e)}). Copy the generated Markdown and try again.`] };
    }
    if (!str(raw).trim()) return { ...empty, errors: ["The clipboard is empty. Copy the generated Markdown first."] };
    return noteQuizToQuickAdd(raw);
  }

  /** Read a generated note-quiz block and pre-fill the previewed Quick add dialog. */
  async openQuizClipboardImport() {
    if (this.moduleOff("mcq")) return null;
    const parsed = await this.readQuizFromClipboard();
    if (!parsed.valid) {
      const issue = parsed.issues && parsed.issues[0];
      const message = (parsed.errors && parsed.errors[0]) || (issue && issue.message) || "No note-quiz blocks were found on the clipboard.";
      new Notice(message, 10000);
      return parsed;
    }
    new QuickAddModal(this.app, this, () => this.refreshViews(), {
      text: parsed.text,
      note: `Read ${parsed.valid} question${parsed.valid === 1 ? "" : "s"} from the clipboard. Review the preview, then press Create.`,
    }).open();
    return parsed;
  }

  /** Write already-previewed quick-add items as ordinary question notes. */
  async createQuickAddQuestions(items, options) {
    if (this.moduleOff("mcq")) throw new Error("Turn on MCQ Tracker to create practice questions.");
    const opts = options || {};
    const list = Array.isArray(items) ? items : [];
    const folder = str(opts.folder).trim() || str(this.settings.questionFolder).trim() || "Questions";
    const course = str(opts.course).trim();
    const paths = [];
    const errors = [];
    const aiGenerated = opts.ai === true || opts.aiGenerated === true || list.some((item) => item && (item.aiGenerated || item.verification));
    if (!list.length) return { created: 0, paths, errors: ["There are no questions to write."], duplicates: 0 };
    await ensureFolder(this.app, folder);
    let duplicates = 0;
    let pending = list;
    if (aiGenerated) {
      // Only generated drafts are deduplicated against the vault. Manual Quick
      // add intentionally allows the same prompt twice when the learner asks.
      const existing = [];
      for (const question of this.getQuestions()) {
        try {
          const sections = parseSections(await this.app.vault.cachedRead(question.file));
          if (sections.question) existing.push(sections.question);
        } catch (e) {
          /* an unreadable question must not block generation */
        }
      }
      const unique = quizDedup.uniqueQuestionDrafts(list, existing);
      pending = unique.items;
      duplicates = unique.skipped.length;
    }
    for (const item of pending) {
      // One note per question, titled from the question text like AI drafts; a
      // repeated title gets a numbered suffix so nothing is overwritten.
      const title = quickAddTitle(item.question);
      const base = (folder ? folder + "/" : "") + title + ".md";
      let path = base;
      let n = 2;
      while (this.app.vault.getAbstractFileByPath(path)) {
        path = base.replace(/\.md$/i, " " + n + ".md");
        n++;
      }
      const qid = path.replace(/^.*\//, "").replace(/\.md$/i, "");
      try {
        assertAllowedWritePath(path, this.settings);
        await this.app.vault.create(path, quickAddNote({ ...item, course: item.course || course }, qid));
        paths.push(path);
      } catch (e) {
        errors.push(title + ": " + str(e && e.message ? e.message : e));
      }
    }
    if (paths.length && aiGenerated) {
      this.recordAiWrite(makeAiWriteRecord({
        kind: "questions",
        model: opts.model || list.map((item) => item && item.aiGenerated).find(Boolean) || this.aiModelLabel("generation"),
        summary: opts.summary || "AI-generated questions",
        paths,
      }));
    }
    if (paths.length) this.refreshViews();
    return { created: paths.length, paths, errors, duplicates };
  }

  /** Write every question and card, unchanged, into one portable ZIP backup. */
  async exportStudyBundle() {
    if (this.moduleOff("mcq")) return null;
    const questions = [];
    for (const item of this.getQuestions()) {
      try {
        questions.push({ path: item.file.path, text: await this.app.vault.cachedRead(item.file) });
      } catch (e) {
        // An unreadable note is left out rather than failing the whole backup.
      }
    }
    const cards = [];
    if (this.cardsEnabled()) {
      for (const item of this.getCards()) {
        try {
          cards.push({ path: item.file.path, text: await this.app.vault.cachedRead(item.file) });
        } catch (e) {
          // Same as above: one unreadable card does not block the bundle.
        }
      }
    }
    if (!questions.length && !cards.length) {
      new Notice("There are no questions or cards to export.");
      return null;
    }
    const version = this.manifest && this.manifest.version ? this.manifest.version : "";
    const built = buildStudyBundle({ questions, cards, date: localDate(), version });
    const base = bundleFileName(localDate());
    let path = base;
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = base.replace(/\.zip$/i, " " + n + ".zip");
      n++;
    }
    const archive = built.archive;
    const binary = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);
    if (typeof this.app.vault.createBinary === "function") await this.app.vault.createBinary(path, binary);
    else await this.app.vault.create(path, binary);
    new Notice(`Exported ${built.manifest.counts.questions} questions and ${built.manifest.counts.cards} cards to ${path}.`, 6000);
    this.refreshViews();
    return { path, counts: built.manifest.counts, manifest: built.manifest };
  }

  /** The newest bundle at the vault root, used by the import command. */
  newestStudyBundle() {
    const files = this.app.vault
      .getFiles()
      .filter((file) => /^mcq-study-bundle-\d{4}-\d{2}-\d{2}(?: \d+)?\.zip$/i.test(file.path));
    return files.sort((a, b) => String(b.path).localeCompare(String(a.path), undefined, { numeric: true }))[0] || null;
  }

  /**
   * Restore a study bundle. Existing notes are never overwritten: identical
   * copies are skipped and different ones are reported as conflicts.
   */
  async importStudyBundle(path) {
    if (this.moduleOff("mcq")) return null;
    const chosen = str(path).trim();
    const file = chosen ? this.app.vault.getAbstractFileByPath(chosen) : this.newestStudyBundle();
    if (!file) throw new Error(chosen ? `"${chosen}" is not in the vault.` : "No study bundle was found at the vault root.");
    const bytes = typeof this.app.vault.readBinary === "function" ? await this.app.vault.readBinary(file) : file.buffer;
    if (!bytes) throw new Error("That study bundle could not be read.");
    const bundle = parseStudyBundle(bytes);
    const plan = await planStudyBundleRestore(bundle, {
      cardsEnabled: this.cardsEnabled(),
      folders: {
        questions: str(this.settings.questionFolder).trim() || "Questions",
        cards: str(this.settings.cards.newCardFolder).trim() || "Cards",
      },
      readExisting: async (target) => {
        const existing = this.app.vault.getAbstractFileByPath(target);
        if (!existing) return null;
        try {
          return await this.app.vault.cachedRead(existing);
        } catch (e) {
          return null;
        }
      },
    });
    const paths = [];
    const failed = [];
    for (const note of plan.creates) {
      try {
        const folder = note.path.includes("/") ? note.path.replace(/\/[^/]*$/, "") : "";
        if (folder) await ensureFolder(this.app, folder);
        await this.app.vault.create(note.path, note.text);
        paths.push(note.path);
      } catch (e) {
        failed.push({ path: note.path, reason: str(e && e.message ? e.message : e) });
      }
    }
    if (paths.length) this.refreshViews();
    const result = {
      imported: paths.length,
      paths,
      identical: plan.identical.length,
      conflicts: plan.conflicts.length,
      invalid: plan.invalid.length + failed.length,
      cardsSkipped: plan.cardsSkipped,
      details: { ...plan, failed },
    };
    const bits = [`Restored ${result.imported} note${result.imported === 1 ? "" : "s"}`];
    if (result.identical) bits.push(`${result.identical} already there`);
    if (result.conflicts) bits.push(`${result.conflicts} skipped (different note exists)`);
    if (result.cardsSkipped) bits.push(`${result.cardsSkipped} card${result.cardsSkipped === 1 ? "" : "s"} skipped (Cards is off)`);
    if (result.invalid) bits.push(`${result.invalid} invalid`);
    new Notice(bits.join(" · "), 8000);
    return result;
  }

  /** Record an inline quiz answer on its linked question note, if it has one. */
  async recordQuizBlockAnswer(question, result, seconds) {
    const id = str(question && question.id).trim();
    if (!id) return null;
    const target = this.getQuestions().find((q) => str(q.fm.question_id).trim() === id);
    if (!target) return null;
    return this.recordAttempt(target.file, {
      chosen: str(result && result.selected),
      correct: !!(result && result.correct),
      conf: 0, // inline quizzes never ask for a confidence rating
      seconds: Math.max(1, Math.round(Number(seconds) || 0)),
      score: result && Number.isFinite(Number(result.score)) ? Math.max(0, Math.min(100, Number(result.score))) : undefined,
      now: new Date(),
      course: target.fm.course,
    });
  }

  /** Grade one free-text inline quiz answer with the configured AI backend. */
  async evaluateQuizTextQuestion(question, answer) {
    if (!this.settings.ai.enabled) throw new Error("Turn on AI features under Settings, Global, Modules first.");
    const q = question || {};
    const system =
      "You grade one short free-text quiz answer. Return only JSON with a score from 0 to 100 and a short explanation: " +
      '{"score": 0, "explanation": ""}. Judge the learner answer against the expected answer and the optional context. ' +
      "Do not add a markdown fence or any other text.";
    const user = [
      `Question: ${str(q.question)}`,
      `Expected answer: ${str(q.answer)}`,
      q.context ? `Context: ${str(q.context)}` : "",
      `Learner answer: ${str(answer)}`,
    ]
      .filter(Boolean)
      .join("\n");
    const reply = await this.aiComplete(system, user, { feature: "cardGrading", maxTokens: 300 });
    return parseQuizAiEvaluation(reply);
  }

  /** Find the source of an `mcq-quiz` block by its stable id, current note first. */
  async findQuizBlockSourceById(id, sourcePath, blockName) {
    const wanted = str(id).trim();
    if (!wanted) return "";
    const files = this.app.vault.getMarkdownFiles ? this.app.vault.getMarkdownFiles() : [];
    const ordered = files.slice().sort((a, b) => (a.path === sourcePath ? -1 : b.path === sourcePath ? 1 : 0));
    for (const file of ordered) {
      let text = "";
      try {
        text = await this.app.vault.cachedRead(file);
      } catch (e) {
        continue;
      }
      const found = findQuizBlockSource(text, wanted, blockName);
      if (found) return found;
    }
    return "";
  }

  /** A definition block is a reusable quiz; it is not played in place. */
  renderQuizDefinitionBlock(source, el, ctx) {
    const parsed = parseQuizBlock(source);
    const card = el.createDiv({ cls: "qt-quiz-definition" });
    card.createDiv({ cls: "qt-quiz-definition-title", text: "Quiz definition" });
    card.createDiv({
      cls: "qt-quiz-definition-meta",
      text: `${parsed.id ? `ID: ${parsed.id} · ` : "No ID · "}${parsed.questions.length} question${parsed.questions.length === 1 ? "" : "s"}`,
    });
    if (!parsed.id) card.createDiv({ cls: "qt-quiz-definition-hint", text: "Add an ID to this block so a playable-quiz block can find it." });
    if (parsed.issues && parsed.issues.length) card.createDiv({ cls: "qt-quiz-definition-hint", text: parsed.issues.join(" ") });
  }

  /** Play the questions from a quiz-definition block somewhere else in the vault. */
  async renderPlayableQuizBlock(source, el, ctx) {
    const parsed = parseQuizBlock(source);
    if (!parsed.id) {
      el.createDiv({ cls: "qt-quiz-definition-error", text: "playable-quiz needs an Id: line naming a quiz-definition block." });
      return;
    }
    const target = await this.findQuizBlockSourceById(parsed.id, ctx && ctx.sourcePath, "quiz-definition");
    if (!target) {
      el.createDiv({ cls: "qt-quiz-definition-error", text: `No quiz-definition block with ID "${parsed.id}" was found.` });
      return;
    }
    await this.renderQuizBlock(target, el, ctx);
  }

  /** Render an `mcq-quiz` fenced block: choices, sliders, text and weighted scoring. */
  async renderQuizBlock(source, el, ctx) {
    let parsed = parseQuizBlock(source);
    const bindingId = str(parsed.bind || parsed.copy).trim();
    if (bindingId) {
      if (parsed.bind && parsed.copy) {
        el.createDiv({ cls: "qt-quiz-empty", text: "Use either Bind: or Copy: on a mirror block, not both." });
        return;
      }
      const readOnly = !!parsed.bind;
      const targetSource = await this.findQuizBlockSourceById(bindingId, ctx && ctx.sourcePath);
      if (!targetSource) {
        el.createDiv({
          cls: "qt-quiz-empty",
          text: `This ${readOnly ? "bind" : "copy"} block points to "${bindingId}", but no mcq-quiz block with that id was found. Add Id: ${bindingId} to the source block or check the spelling.`,
        });
        return;
      }
      const target = parseQuizBlock(targetSource);
      if (target.bind || target.copy) {
        el.createDiv({ cls: "qt-quiz-empty", text: `The block with id "${bindingId}" is itself a mirror. Point it at a block that contains questions.` });
        return;
      }
      if (!target.questions.length) {
        el.createDiv({ cls: "qt-quiz-empty", text: `The block with id "${bindingId}" has no questions to mirror.` });
        return;
      }
      if (readOnly) target.mode = "static";
      target.gated = false;
      if (parsed.keepStem === false) target.keepStem = false;
      parsed = target;
    }
    if (!parsed.questions.length) {
      el.createDiv({ cls: "qt-quiz-empty", text: "This quiz block has no questions. Start a question with Q: and add choices with A., B., ..." });
      return;
    }
    const staticMode = parsed.mode === "static";
    const box = el.createDiv({ cls: "qt-quiz-block" });
    const noteGate = quizNoteGate.canGate(parsed, this.settings) ? quizNoteGate.begin(el, parsed.questions.length) : null;
    let answered = 0;
    const cards = [];
    const selections = {};
    const summary = box.createDiv({ cls: "qt-quiz-summary" });
    const scoreNow = () => quizBlockScore(parsed.questions, selections, parsed);
    const paintSummary = () => {
      const score = scoreNow();
      summary.setText(`Score: ${score.percent}% · ${score.band} · ${score.answered}/${score.total} answered`);
      summary.toggleClass("is-pass", score.band === "pass");
      summary.toggleClass("is-imprecise", score.band === "imprecise");
      summary.toggleClass("is-fail", score.band === "fail");
    };
    if (staticMode) {
      const count = parsed.questions.length;
      summary.setText(`Answer key · ${count} question${count === 1 ? "" : "s"}`);
    } else {
      paintSummary();
    }

    const renderStaticQuestion = (question, card) => {
      if (question.type === "choice") {
        const result = gradeQuizBlockQuestion(question, "");
        const choices = card.createDiv({ cls: "qt-quiz-choices is-static" });
        result.options.forEach((option) => {
          const button = choices.createEl("button", {
            cls: `qt-quiz-choice is-static${option.correct ? " is-correct" : ""}`,
            text: `${option.letter}. ${option.text}`,
          });
          button.disabled = true;
        });
        card.createDiv({ cls: "qt-quiz-result is-correct", text: `Answer: ${question.answer}` });
        const feedback = card.createDiv({ cls: "qt-quiz-feedback" });
        result.options.forEach((option) => {
          if (!option.feedback) return;
          const line = feedback.createDiv({ cls: "qt-quiz-option-feedback" });
          line.createSpan({ text: `${option.letter}. ${option.correct ? "Correct" : "Why"} ` });
          line.createSpan({ text: option.feedback });
        });
        if (question.explanation) feedback.createDiv({ cls: "qt-quiz-explanation", text: question.explanation });
        return;
      }
      card.createDiv({ cls: "qt-quiz-result is-correct", text: `Answer: ${question.answer}` });
      if ((question.type === "numeric" || question.type === "slider") && question.tolerance) {
        card.createDiv({ cls: "qt-hint", text: `Tolerance ±${question.tolerance}` });
      }
      if (question.type === "text" && question.context) card.createDiv({ cls: "qt-hint", text: `Hint: ${question.context}` });
      if (question.explanation) card.createDiv({ cls: "qt-quiz-explanation", text: question.explanation });
    };

    const complete = async (index, question, result, started, card, feedback, extra) => {
      if (selections[index]) return;
      selections[index] = result;
      answered++;
      if (extra && extra.options) {
        // Choice feedback is rendered by the caller before this completes.
      }
      if (result.explanation) feedback.createDiv({ cls: "qt-quiz-explanation", text: result.explanation });
      if (question.type !== "choice") {
        feedback.createDiv({
          cls: `qt-quiz-score is-${result.band || (result.correct ? "pass" : "fail")}`,
          text: `${result.score}% · ${result.band || (result.correct ? "pass" : "fail")}${result.mode === "text" ? " · AI/local check" : ""}`,
        });
      }
      const label = result.correct ? "Correct" : result.band === "imprecise" ? "Imprecise" : "Not quite";
      card.createDiv({ cls: result.correct ? "qt-quiz-result is-correct" : "qt-quiz-result is-wrong", text: label });
      cards.forEach((item, i) => item.toggleClass("qt-quiz-hidden", parsed.gated && i >= visibleQuizCount(parsed.questions.length, answered, true)));
      if (noteGate) noteGate.update(answered);
      paintSummary();
      try {
        await this.recordQuizBlockAnswer(question, result, (Date.now() - started) / 1000);
      } catch (e) {
        new Notice(`Could not record this inline answer: ${str(e && e.message ? e.message : e)}`);
      }
      const score = scoreNow();
      if (this.settings.inlineQuizResults === true && parsed.id && score.answered === score.total) {
        try {
          await this.exportInlineQuizResult(ctx && ctx.sourcePath, parsed.id, score);
        } catch (e) {
          new Notice(`Could not export this quiz result: ${str(e && e.message ? e.message : e)}`, 8000);
        }
      }
      if (this.settings.quizIndex && this.settings.quizIndex.recordAttempts === true && parsed.id && score.answered === score.total) {
        try {
          await this.recordInlineQuizAttempt(ctx && ctx.sourcePath, parsed.id, parsed.questions, selections);
        } catch (e) {
          new Notice(`Could not record this quiz attempt: ${str(e && e.message ? e.message : e)}`, 8000);
        }
      }
    };

    parsed.questions.forEach((question, index) => {
      const card = box.createDiv({ cls: "qt-quiz-card" });
      if (question.sharedOptions && this.settings.inlineQuizSharedChoice !== true) {
        if (parsed.keepStem !== false) card.createDiv({ cls: "qt-quiz-question", text: `${index + 1}. ${question.question}` });
        card.createDiv({ cls: "qt-quiz-issue", text: "Shared-option questions are off. Turn on Shared-option quiz questions under Settings → MCQ Review." });
        return;
      }
      cards.push(card);
      if (parsed.keepStem !== false) card.createDiv({ cls: "qt-quiz-question", text: `${index + 1}. ${question.question}` });
      if (question.level) card.createDiv({ cls: "qt-quiz-level", text: `Level ${question.level}` });
      if (question.weight !== 1) card.createDiv({ cls: "qt-quiz-weight", text: `Weight ${question.weight}` });
      if (!question.valid) {
        card.createDiv({ cls: "qt-quiz-issue", text: question.issues.join(" ") });
        return;
      }
      if (staticMode) {
        renderStaticQuestion(question, card);
        return;
      }
      const feedback = card.createDiv({ cls: "qt-quiz-feedback" });
      const started = Date.now();
      let done = false;
      const finish = async (result) => {
        if (done) return;
        done = true;
        await complete(index, question, result, started, card, feedback);
      };

      if (question.type === "reorder") {
        if (this.settings.inlineQuizReorder !== true) {
          card.createDiv({ cls: "qt-quiz-issue", text: "Reorder questions are off. Turn on Inline reorder questions under Settings → MCQ Review." });
          return;
        }
        const wrap = card.createDiv({ cls: "qt-quiz-reorder" });
        const list = wrap.createDiv({ cls: "qt-quiz-reorder-list" });
        let order = question.choices.map((_choice, i) => i);
        const paint = () => {
          list.empty();
          order.forEach((itemIndex, position) => {
            const row = list.createDiv({ cls: "qt-quiz-reorder-row" });
            row.createSpan({ cls: "qt-quiz-reorder-text", text: `${position + 1}. ${question.choices[itemIndex].text}` });
            const up = row.createEl("button", { cls: "qt-quiz-reorder-move", text: "▲", attr: { "aria-label": `Move ${question.choices[itemIndex].text} up` } });
            up.disabled = position === 0;
            up.addEventListener("click", () => {
              if (position === 0 || done) return;
              [order[position - 1], order[position]] = [order[position], order[position - 1]];
              paint();
            });
            const down = row.createEl("button", { cls: "qt-quiz-reorder-move", text: "▼", attr: { "aria-label": `Move ${question.choices[itemIndex].text} down` } });
            down.disabled = position === order.length - 1;
            down.addEventListener("click", () => {
              if (position === order.length - 1 || done) return;
              [order[position], order[position + 1]] = [order[position + 1], order[position]];
              paint();
            });
          });
        };
        paint();
        wrap.createEl("button", { cls: "qt-quiz-submit", text: "Check order" }).addEventListener("click", async () => {
          if (done) return;
          const chosen = order.map((i) => question.choices[i].letter).join(", ");
          await finish(gradeReorderQuestion(question, chosen));
        });
        card.createDiv({ cls: "qt-hint", text: "Use ▲ and ▼ to put the items in order, then check." });
        return;
      }

      if (question.type === "numeric") {
        if (this.settings.inlineQuizNumeric !== true) {
          card.createDiv({ cls: "qt-quiz-issue", text: "Numeric questions are off. Turn on Inline numeric questions under Settings → MCQ Review." });
          return;
        }
        const wrap = card.createDiv({ cls: "qt-quiz-numeric" });
        const attrs = { placeholder: "Your answer", "aria-label": question.question };
        if (question.minSet) attrs.min = String(question.min);
        if (question.maxSet) attrs.max = String(question.max);
        const input = wrap.createEl("input", { type: "number", cls: "qt-spr", attr: attrs });
        if (question.step !== 1) input.setAttr("step", String(question.step));
        wrap.createEl("button", { cls: "qt-quiz-submit", text: "Check answer" }).addEventListener("click", async () => {
          if (done) return;
          await finish(gradeNumericQuestion(question, input.value));
        });
        const bounds = [question.minSet ? `min ${question.min}` : "", question.maxSet ? `max ${question.max}` : ""].filter(Boolean).join(" · ");
        card.createDiv({ cls: "qt-hint", text: `Tolerance ±${question.tolerance}${bounds ? ` · ${bounds}` : ""}` });
        return;
      }

      if (question.type === "slider") {
        const wrap = card.createDiv({ cls: "qt-quiz-slider" });
        const value = wrap.createSpan({ cls: "qt-quiz-slider-value", text: String(question.answer) });
        const input = wrap.createEl("input", {
          type: "range",
          attr: { min: String(question.min), max: String(question.max), step: String(question.step), "aria-label": question.question },
        });
        input.value = String(question.answer);
        input.addEventListener("input", () => value.setText(input.value));
        wrap.createEl("button", { cls: "qt-quiz-submit", text: "Check" }).addEventListener("click", () => finish(gradeQuizQuestion(question, input.value)));
        card.createDiv({ cls: "qt-hint", text: `Range ${question.min}–${question.max}${question.tolerance ? ` · ±${question.tolerance} accepted` : ""}` });
        return;
      }

      if (question.type === "text") {
        const wrap = card.createDiv({ cls: "qt-quiz-text" });
        const input = wrap.createEl("input", { type: "text", cls: "qt-spr", attr: { placeholder: "Your answer" } });
        input.addEventListener("input", () => {
          if (!done) card.toggleClass("qt-quiz-typed", !!input.value.trim());
        });
        wrap.createEl("button", { cls: "qt-quiz-submit", text: "Check answer" }).addEventListener("click", () => finish(gradeQuizQuestion(question, input.value)));
        if (this.settings.ai.enabled) {
          const ai = wrap.createEl("button", { cls: "qt-quiz-ai", text: "Evaluate with AI" });
          ai.addEventListener("click", async () => {
            if (done || !input.value.trim()) return;
            ai.disabled = true;
            try {
              const evaluation = await this.evaluateQuizTextQuestion(question, input.value);
              const result = gradeQuizQuestion(question, input.value, evaluation.score);
              result.explanation = evaluation.explanation || result.explanation;
              await finish(result);
            } catch (e) {
              new Notice(str(e && e.message ? e.message : e), 9000);
              ai.disabled = false;
            }
          });
        }
        if (question.context) card.createDiv({ cls: "qt-hint", text: `Hint: ${question.context}` });
        return;
      }

      const choices = card.createDiv({ cls: "qt-quiz-choices" });
      const buttons = [];
      question.choices.forEach((choice) => {
        const button = choices.createEl("button", { cls: "qt-quiz-choice", text: `${choice.letter}. ${choice.text}` });
        buttons.push(button);
        button.addEventListener("click", async () => {
          if (done) return;
          const result = gradeQuizBlockQuestion(question, choice.letter);
          result.options.forEach((option, i) => {
            buttons[i].addClass(option.correct ? "is-correct" : "is-wrong");
            if (option.selected) buttons[i].addClass("is-picked");
          });
          for (const option of result.options) {
            const line = feedback.createDiv({ cls: "qt-quiz-option-feedback" });
            line.createSpan({ text: `${option.letter}. ${option.correct ? "Correct" : option.selected ? "Your choice" : ""} ` });
            if (option.feedback) line.createSpan({ text: option.feedback });
          }
          await finish(result);
        });
      });
    });
    if (!staticMode) cards.forEach((card, index) => card.toggleClass("qt-quiz-hidden", parsed.gated && index >= visibleQuizCount(parsed.questions.length, 0, true)));
  }

  /** Render an Exam Plugin-compatible `exam` XML question card. */
  renderExamMarkdown(el, markdown, ctx) {
    const source = str(markdown).replace(/_{3,}/g, '<span class="qt-exam-blank" aria-hidden="true"></span>');
    renderMarkdownInto(this.app, source, el, ctx && ctx.sourcePath, this);
  }

  renderExamAnalysis(card, parsed, ctx, hidden) {
    if (!parsed.analysis) return null;
    const details = card.createEl("details", { cls: "qt-exam-analysis" });
    details.createEl("summary", { text: "Show analysis" });
    const body = details.createDiv({ cls: "qt-exam-analysis-body" });
    this.renderExamMarkdown(body, parsed.analysis, ctx);
    if (hidden) details.addClass("qt-hidden");
    return details;
  }

  async renderExamBlock(source, el, ctx) {
    const parsed = parseExamBlock(source);
    const card = el.createDiv({ cls: "qt-exam-card" });
    if (!parsed.valid) {
      card.createDiv({ cls: "qt-exam-error", text: parsed.issues.join(" ") });
      return;
    }
    const head = card.createDiv({ cls: "qt-exam-head" });
    if (parsed.num) head.createSpan({ cls: "qt-exam-num", text: parsed.num });
    if (parsed.source) head.createSpan({ cls: "qt-exam-source", text: parsed.source });
    const stem = card.createDiv({ cls: "qt-exam-stem" });
    this.renderExamMarkdown(stem, parsed.stem, ctx);

    const correct = new Set(parsed.answers);
    const choices = card.createDiv({ cls: "qt-exam-options" });
    const mode = this.settings.examBlockMode === "answer" ? "answer" : "study";
    if (mode === "study") {
      for (const option of parsed.options) {
        const row = choices.createDiv({ cls: `qt-exam-option${correct.has(option.letter) ? " is-correct" : ""}` });
        row.createSpan({ cls: "qt-exam-option-letter", text: option.letter });
        row.createSpan({ cls: "qt-exam-option-text", text: option.text });
        if (correct.has(option.letter)) row.createSpan({ cls: "qt-exam-check", text: "✓" });
      }
      this.renderExamAnalysis(card, parsed, ctx, false);
      return;
    }

    const feedback = card.createDiv({ cls: "qt-exam-feedback" });
    const analysis = this.renderExamAnalysis(card, parsed, ctx, true);
    const picked = new Set();
    const buttons = [];
    let graded = false;
    const finish = () => {
      if (graded) return;
      graded = true;
      const exact = picked.size === correct.size && [...picked].every((letter) => correct.has(letter));
      for (const { option, button } of buttons) {
        button.toggleClass("is-correct", correct.has(option.letter));
        button.toggleClass("is-wrong", picked.has(option.letter) && !correct.has(option.letter));
        button.toggleClass("is-picked", picked.has(option.letter));
        button.disabled = true;
      }
      feedback.toggleClass("is-correct", exact);
      feedback.toggleClass("is-wrong", !exact);
      feedback.createDiv({ cls: "qt-exam-verdict", text: exact ? "Correct" : `Not quite. Correct answer: ${parsed.answers.join(", ")}` });
      if (analysis) analysis.removeClass("qt-hidden");
    };
    const multi = parsed.answers.length > 1;
    for (const option of parsed.options) {
      const button = choices.createEl("button", { cls: "qt-exam-option", text: `${option.letter}. ${option.text}` });
      buttons.push({ option, button });
      button.addEventListener("click", () => {
        if (graded) return;
        if (!multi) {
          picked.clear();
          picked.add(option.letter);
          finish();
          return;
        }
        if (picked.has(option.letter)) picked.delete(option.letter);
        else picked.add(option.letter);
        button.toggleClass("is-picked", picked.has(option.letter));
      });
    }
    if (multi) {
      const submit = card.createEl("button", { cls: "qt-exam-submit", text: "Submit answer" });
      submit.addEventListener("click", () => {
        if (!graded && picked.size) finish();
      });
    }
  }

  /** Render a `quiz-maker` block with one of four local question formats. */
  async renderQuizMakerBlock(source, el, ctx) {
    if (!this.quizMakerEnabled()) {
      el.createDiv({ cls: "qt-quiz-maker-issue", text: "Quiz Maker is off. Turn it on in Settings, Global, Modules." });
      return null;
    }
    return renderQuizMaker(this, source, el, ctx);
  }

  /** Render a `sat-math` block with local step-by-step solutions. */
  async renderSatMathBlock(source, el, ctx) {
    if (!this.satMathEnabled()) {
      el.createDiv({ cls: "qt-sat-math-issue", text: "SAT Math is off. Turn it on in Settings, Global, Modules." });
      return null;
    }
    return renderSatMath(this, source, el, ctx);
  }

  /** Render an `sfc-cards` block with seven read-only card types. */
  async renderSfcCardsBlock(source, el, ctx) {
    if (!this.sfcCardsEnabled()) {
      el.createDiv({ cls: "qt-sfc-cards-issue", text: "SFC Cards is off. Turn it on in Settings, Global, Modules." });
      return null;
    }
    return renderSfcCards(this, source, el, ctx);
  }

  /** Render a `cbt-exam` block with a navigator, sidecar history and adaptive review. */
  async renderCbtExamBlock(source, el, ctx) {
    if (!this.cbtExamEnabled()) {
      el.createDiv({ cls: "qt-cbt-exam-issue", text: "CBT Exam is off. Turn it on in Settings, Global, Modules." });
      return null;
    }
    return renderCbtExam(this, source, el, ctx);
  }

  /** Render a `study-map` block: a read-only outline map with key terms. */
  async renderStudyMapBlock(source, el) {
    if (!this.studyMapEnabled()) {
      el.createDiv({ cls: "qt-study-map-issue", text: "Study map is off. Turn it on in Settings, Global, Modules." });
      return null;
    }
    return renderStudyMap(this, source, el);
  }

  /** Render a `vault-search` block with cited local results. */
  async renderVaultSearchBlock(source, el) {
    if (!this.vaultSearchEnabled()) {
      el.createDiv({ cls: "qt-vault-search-issue", text: "Vault search is off. Turn it on in Settings, Global, Modules." });
      return null;
    }
    return renderVaultSearch(this, source, el);
  }

  /** Render a `simple-flashcards` block with the local reveal reader. */
  async renderSimpleFlashcardsBlock(source, el, ctx) {
    return renderSimpleFlashcardsBlock(this, source, el, ctx);
  }

  /** Render a `reading-plan` block with local pace and progress tracking. */
  async renderReadingPlanBlock(source, el, ctx) {
    return renderReadingPlanBlock(this, source, el, ctx);
  }

  /** Render a `tag-timer` block with local timer state and per-tag analytics. */
  async renderTagTimerBlock(source, el, ctx) {
    return renderTagTimerBlock(this, source, el, ctx);
  }

  /** Render a `tally` block with local correct/incorrect counters. */
  async renderTallyBlock(source, el, ctx) {
    return renderTallyBlock(this, source, el, ctx);
  }

  /** Render a `text-timer` block with a local count-up clock. */
  async renderTextTimerBlock(source, el, ctx) {
    return renderTextTimerBlock(this, source, el, ctx);
  }

  async stopAllTagTimers() {
    const result = stopRunningTagTimers(this.settings.tagTimers, Date.now());
    this.settings.tagTimers = result.settings;
    if (result.count) await this.save();
    if (result.count && typeof activeDocument !== "undefined" && typeof activeDocument.dispatchEvent === "function") {
      activeDocument.dispatchEvent(new Event("mcq-tag-timer-change"));
    }
    new Notice(result.count ? `Stopped ${result.count} running tag timer${result.count === 1 ? "" : "s"}.` : "No tag timers are running.");
    return result.count;
  }

  /** Render a `quizport` block with the local QuizPort player. */
  async renderQuizPortBlock(source, el, ctx) {
    return renderQuizPortBlock(this, source, el, ctx);
  }

  /** Write one completed inline-quiz result into the source note's frontmatter. */
  /** Append an opt-in per-question attempt for a completed inline quiz. */
  async recordInlineQuizAttempt(path, id, questions, selections) {
    if (!this.settings.quizIndex || this.settings.quizIndex.recordAttempts !== true) return null;
    const attempt = studyWorkspace.buildQuizAttempt(path, id, questions, selections, Date.now());
    if (!attempt) return null;
    const attempts = studyWorkspace.normalizeQuizAttempts(this.settings.quizIndex.attempts);
    attempts.push(attempt);
    this.settings.quizIndex.attempts = attempts.slice(-500);
    await this.save();
    return attempt;
  }

  async exportInlineQuizResult(sourcePath, quizId, score) {
    const path = str(sourcePath).trim();
    const prop = quizResultProperties(quizId, score);
    if (!path || !prop) return false;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      const current = fm.quizResults && typeof fm.quizResults === "object" && !Array.isArray(fm.quizResults) ? fm.quizResults : {};
      fm.quizResults = { ...current, [prop.key]: prop.value };
    });
    return true;
  }

  /**
   * Read `quizjson` blocks and report legacy `quizjs` blocks from the selected
   * vault notes. A source can be a note or a folder; without sources the current
   * note is used.
   */
  async simpleQuizCardsFromSources(sources, sourcePath) {
    const list = (Array.isArray(sources) ? sources : []).map((item) => str(item).trim()).filter(Boolean);
    const files = [];
    const issues = [];
    const seenFiles = new Set();
    const addFile = (file) => {
      if (!file || !/\.md$/i.test(str(file.path)) || seenFiles.has(file.path)) return;
      seenFiles.add(file.path);
      files.push(file);
    };
    for (const raw of list) {
      const clean = str(raw).replace(/^\/+|\/+$/g, "");
      if (!clean) continue;
      let found = this.app.vault.getAbstractFileByPath(clean);
      if (!found && !/\.md$/i.test(clean)) found = this.app.vault.getAbstractFileByPath(`${clean}.md`);
      if (found instanceof TFile) {
        addFile(found);
        continue;
      }
      const matches = this.app.vault
        .getMarkdownFiles()
        .filter((file) => file.path === clean || file.path === `${clean}.md` || file.path.startsWith(`${clean}/`));
      if (!matches.length) {
        issues.push(`Quiz source "${raw}" was not found in the vault.`);
        continue;
      }
      matches.forEach(addFile);
    }
    if (!list.length && sourcePath) {
      const current = this.app.vault.getAbstractFileByPath(sourcePath);
      if (current instanceof TFile) addFile(current);
      else issues.push(`Quiz source note "${sourcePath}" was not found.`);
    }
    const cards = [];
    const ids = new Set();
    for (const file of files) {
      let text;
      try {
        text = await this.app.vault.cachedRead(file);
      } catch (e) {
        issues.push(`${file.path}: the note could not be read.`);
        continue;
      }
      const blocks = extractSimpleQuizBlocks(text);
      for (const block of blocks.json) {
        const parsed = parseSimpleQuizCards(block);
        issues.push(...parsed.issues.map((issue) => `${file.path}: ${issue}`));
        for (const card of parsed.cards) {
          if (ids.has(card.id)) issues.push(`${file.path}: duplicate card id "${card.id}" was skipped.`);
          else {
            ids.add(card.id);
            cards.push(card);
          }
        }
      }
      if (blocks.js.length) issues.push(`${file.path}: ${legacyQuizJsNotice()}`);
    }
    return { cards, issues };
  }

  /** Render a `quiz` block: choose a source, then review its cards inline. */
  async renderSimpleQuizBlock(source, el, ctx) {
    const parsed = parseSimpleQuizOptions(source);
    const options = parsed.options || {};
    let cards = parsed.cards.slice();
    const issues = parsed.issues.slice();
    if (!cards.length) {
      const loaded = await this.simpleQuizCardsFromSources(options.sources || [], ctx && ctx.sourcePath ? ctx.sourcePath : "");
      cards = loaded.cards;
      issues.push(...loaded.issues);
    }
    if (options.limit) cards = cards.slice(0, options.limit);
    if (options.shuffle && cards.length > 1) {
      const seed = hashString(str(source) + localDate());
      cards.sort((a, b) => hashString(seed + a.id) - hashString(seed + b.id));
    }
    const box = el.createDiv({ cls: `qt-simple-quiz${options.minify ? " is-minified" : ""}` });
    if (!options.hideTitle) box.createDiv({ cls: "qt-simple-quiz-title", text: "Simple quiz" });
    const summary = box.createDiv({ cls: "qt-simple-quiz-summary" });
    const paintSummary = () => {
      const stats = simpleQuizDaySummary(this.settings.simpleQuiz, localDate());
      summary.setText(`${stats.streak} day streak · ${stats.cards} cards today · ${stats.quizzes} quizzes today`);
    };
    paintSummary();
    for (const issue of issues.slice(0, 8)) box.createDiv({ cls: "qt-simple-quiz-issue", text: issue });
    if (!cards.length) {
      box.createDiv({
        cls: "qt-simple-quiz-empty",
        text: "No cards found. Add a quizjson block to this note, or set sources to a note or folder.",
      });
      return;
    }

    const stage = box.createDiv({ cls: "qt-simple-quiz-stage" });
    let index = 0;
    let correct = 0;
    const renderStart = () => {
      stage.empty();
      stage.createDiv({ cls: "qt-simple-quiz-meta", text: `${cards.length} card${cards.length === 1 ? "" : "s"} ready` });
      stage.createEl("button", { cls: "mod-cta", text: "Start simple quiz" }).addEventListener("click", () => {
        index = 0;
        correct = 0;
        renderCard();
      });
    };
    const finish = async () => {
      this.settings.simpleQuiz = recordSimpleQuizSession(this.settings.simpleQuiz, {
        today: localDate(),
        cards: cards.length,
        correct,
      });
      await this.save();
      paintSummary();
      stage.empty();
      const score = Math.round((correct / cards.length) * 100);
      stage.createDiv({ cls: "qt-simple-quiz-result", text: `Quiz complete: ${correct}/${cards.length} correct (${score}%).` });
      const stats = simpleQuizDaySummary(this.settings.simpleQuiz, localDate());
      stage.createDiv({ cls: "qt-simple-quiz-meta", text: `${stats.streak} day streak · best ${stats.best}` });
      stage.createEl("button", { text: "Start again" }).addEventListener("click", renderStart);
    };
    const renderCard = () => {
      if (index >= cards.length) {
        finish().catch((e) => new Notice(str(e && e.message ? e.message : e)));
        return;
      }
      const card = cards[index];
      const reverse = !card.notReversible && index % 2 === 1;
      const left = card.defaultSide === "right" !== reverse ? card.question.right : card.question.left;
      const right = card.defaultSide === "right" !== reverse ? card.question.left : card.question.right;
      stage.empty();
      stage.createDiv({ cls: "qt-simple-quiz-progress", text: `${index + 1} / ${cards.length}` });
      const front = stage.createDiv({ cls: "qt-simple-quiz-side" });
      for (const line of left) front.createDiv({ cls: "qt-simple-quiz-line", text: line });
      const reveal = stage.createEl("button", { cls: "mod-cta", text: "Show answer" });
      reveal.addEventListener("click", () => {
        reveal.disabled = true;
        const answer = stage.createDiv({ cls: "qt-simple-quiz-answer" });
        for (const line of right) answer.createDiv({ cls: "qt-simple-quiz-line", text: line });
        const actions = stage.createDiv({ cls: "qt-row" });
        actions.createEl("button", { cls: "qt-simple-quiz-missed", text: "Missed" }).addEventListener("click", () => {
          index++;
          renderCard();
        });
        actions.createEl("button", { cls: "mod-cta qt-simple-quiz-correct", text: "Got it" }).addEventListener("click", () => {
          correct++;
          index++;
          renderCard();
        });
      });
    };
    renderStart();
  }

  /** Render a quizjson block, or a disabled notice for a legacy quizjs block. */
  renderSimpleQuizDataBlock(source, el, kind) {
    const box = el.createDiv({ cls: "qt-simple-quiz-data" });
    const parsed = kind === "js" ? { cards: [], issues: [legacyQuizJsNotice()] } : parseSimpleQuizCards(source);
    box.createDiv({
      cls: "qt-simple-quiz-data-title",
      text: kind === "js" ? "Legacy JavaScript quiz block (disabled)" : "Quiz cards",
    });
    box.createDiv({
      cls: "qt-simple-quiz-meta",
      text: parsed.cards.length
        ? `${parsed.cards.length} card${parsed.cards.length === 1 ? "" : "s"} available to a quiz block.`
        : "No usable cards in this block.",
    });
    for (const issue of parsed.issues.slice(0, 6)) box.createDiv({ cls: "qt-simple-quiz-issue", text: issue });
  }

  /** Render the `quiztoday` stats card without starting a session. */
  renderSimpleQuizTodayBlock(source, el) {
    const parsed = parseSimpleQuizOptions(source || "{}");
    const stats = simpleQuizDaySummary(this.settings.simpleQuiz, localDate());
    const box = el.createDiv({ cls: `qt-simple-quiz-today${parsed.options && parsed.options.minify ? " is-minified" : ""}` });
    if (!parsed.options || !parsed.options.minify) box.createDiv({ cls: "qt-simple-quiz-title", text: "Simple quiz today" });
    if (!parsed.options || !parsed.options.hideCounters) {
      box.createDiv({ cls: "qt-simple-quiz-big", text: `${stats.streak} day streak` });
      box.createDiv({ cls: "qt-simple-quiz-meta", text: `${stats.cards} card${stats.cards === 1 ? "" : "s"} reviewed today · ${stats.quizzes} quiz${stats.quizzes === 1 ? "" : "zes"} today` });
      box.createDiv({ cls: "qt-simple-quiz-meta", text: `This week: ${stats.weekCards} cards · ${stats.weekQuizzes} quizzes · week streak ${stats.weekStreak}` });
    }
    for (const issue of parsed.issues.slice(0, 3)) box.createDiv({ cls: "qt-simple-quiz-issue", text: issue });
  }

  /** Render a dependency-free bar chart for `quizcharts`. */
  renderSimpleQuizChartsBlock(source, el) {
    const parsed = parseSimpleQuizOptions(source || "{}");
    const options = parsed.options || {};
    const series = simpleQuizChartSeries(this.settings.simpleQuiz, { days: 30 });
    const box = el.createDiv({ cls: `qt-simple-quiz-charts${options.minify ? " is-minified" : ""}` });
    if (!options.minify) box.createDiv({ cls: "qt-simple-quiz-title", text: "Simple quiz charts" });
    box.createDiv({ cls: "qt-simple-quiz-meta", text: "Last 30 days · cards reviewed and quizzes completed" });
    const chart = box.createDiv({ cls: "qt-simple-quiz-chart" });
    const maxCards = Math.max(1, series.maxCards);
    for (const row of series.days) {
      const col = chart.createDiv({ cls: "qt-simple-quiz-chart-day" });
      const bars = col.createDiv({ cls: "qt-simple-quiz-chart-bars" });
      const cardsBar = bars.createDiv({ cls: "qt-simple-quiz-chart-bar is-cards" });
      cardsBar.style.height = `${Math.round((row.cards / maxCards) * 100)}%`;
      const quizBar = bars.createDiv({ cls: "qt-simple-quiz-chart-bar is-quizzes" });
      quizBar.style.height = `${Math.round((row.quizzes / Math.max(1, series.maxQuizzes)) * 100)}%`;
      col.createDiv({ cls: "qt-simple-quiz-chart-label", text: row.label });
    }
    box.createDiv({ cls: "qt-simple-quiz-meta", text: `30-day total: ${series.totalCards} cards · ${series.totalQuizzes} quizzes` });
    for (const issue of parsed.issues.slice(0, 3)) box.createDiv({ cls: "qt-simple-quiz-issue", text: issue });
  }

  /** Draft quiz questions from chosen notes and folders. This method writes nothing. */
  async generateQuizFromNotes(options) {
    if (!this.settings.ai.enabled) throw new Error("Turn on AI features under Settings, Global, Modules first.");
    if (this.moduleOff("mcq")) throw new Error("Turn on MCQ Tracker to create practice questions.");
    const config = normalizeQuizGenerator({ ...normalizeQuizGenerator(this.settings.quizGenerator), ...(options || {}) });
    const sources = [];
    for (const candidate of this.getNoteCandidates()) {
      if (!folderMatches(candidate.file.path, config.folders)) continue;
      try {
        sources.push({ ...candidate, text: await this.app.vault.cachedRead(candidate.file) });
      } catch (e) {
        /* an unreadable note is left out rather than failing the whole draft */
      }
    }
    const source = collectGeneratorSources(sources, { folders: config.folders, maxNotes: 12, focus: config.focus });
    if (!source.text.trim()) throw new Error("No readable notes matched those folders.");
    const prompt = buildQuizGeneratorPrompt({ text: source.text, titles: source.titles, focus: config.focus, count: config.count, language: config.language, types: config.types });
    const reply = await this.aiComplete(prompt.system, prompt.user, { feature: "generation", maxTokens: 4000 });
    const parsed = parseGeneratorQuestions(reply, { count: config.count, types: config.types });
    if (!parsed.items.length) throw new Error("The AI returned no usable questions. Try different notes or fewer types.");
    const verification = await this.verifyDraftQuestions(parsed.items);
    for (const item of parsed.items) item.aiGenerated = this.aiModelLabel("generation");
    return {
      kind: "questions",
      items: parsed.items.filter((item) => !(item.verification && item.verification.drop)),
      verification,
      issues: parsed.issues,
      sourceCount: source.count,
      sourceChars: source.chars,
      retrieval: source.retrieval,
      truncated: source.truncated,
      language: config.language,
      types: config.types,
      model: this.aiModelLabel("generation"),
      ai: true,
    };
  }

  openQuizGenerator(onDone) {
    if (!this.settings.ai.enabled) {
      new Notice("Turn on AI features under Settings, Global, Modules, then choose a provider under MCQ Tracker, AI.");
      return null;
    }
    if (this.moduleOff("mcq")) return null;
    const modal = new QuizGeneratorModal(this.app, this, onDone || (() => this.refreshViews()));
    modal.open();
    return modal;
  }

  /** Draft cards from the open note or its selection. This method writes nothing. */
  async generateCardsFromNote(options) {
    if (!this.settings.ai.enabled) throw new Error("Turn on AI features under Settings, Global, Modules first.");
    if (this.moduleOff("cards")) throw new Error("Turn on Cards to create flashcards.");
    const requested = options || {};
    const config = normalizeCardGenerator({ ...normalizeCardGenerator(this.settings.cardGenerator), ...requested });
    const context = requested.context && requested.context.path ? requested.context : await readActiveNoteContext(this.app);
    if (!context || !context.path) throw new Error("Open a Markdown note first.");
    if (config.source === "selection" && !context.selection) throw new Error("Select some text in the note first, or choose the whole note.");
    const sourceKind = config.source === "note" ? "note" : config.source === "selection" ? "selection" : context.selection ? "selection" : "note";
    const supplied = requested.sourceText === undefined ? "" : str(requested.sourceText);
    const text = supplied || (sourceKind === "selection" ? context.selection : context.text);
    if (!str(text).trim()) throw new Error("That note has no readable text to turn into cards.");
    const file = this.app.vault.getAbstractFileByPath(context.path);
    const fm = (file && this.app.metadataCache.getFileCache(file)?.frontmatter) || {};
    const course = str(fm.course).trim() || courseForFolder(this.settings, context.path) || "";
    const prompt = buildCardGeneratorPrompt({
      title: context.title,
      course,
      text,
      sourceKind,
      count: config.count,
      customPrompt: config.customPrompt,
    });
    const reply = await this.aiComplete(prompt.system, prompt.user, { feature: "generation", maxTokens: 3000 });
    const parsed = parseAiCards(reply, config.count);
    if (!parsed.cards.length) throw new Error("The AI returned no usable cards. Try a different prompt or source.");
    const verification = await this.verifyDraftCards(parsed.cards);
    return {
      kind: "cards",
      items: parsed.cards.filter((item) => !(item.verification && item.verification.drop)),
      verification,
      sourcePath: context.path,
      sourceKind,
      title: context.title,
      course,
      count: parsed.cards.length,
      sourceText: text,
      ai: true,
      model: this.aiModelLabel("generation"),
    };
  }

  /** Append already-previewed cards to the open note. This is intentionally untracked. */
  async insertGeneratedCards(generated, options) {
    if (this.moduleOff("cards")) throw new Error("Turn on Cards to work with flashcards.");
    const g = generated || {};
    const items = Array.isArray(g.items) ? g.items : [];
    if (!items.length) throw new Error("There are no cards to insert.");
    const config = normalizeCardGenerator({ ...normalizeCardGenerator(this.settings.cardGenerator), ...(options || {}) });
    const block = buildCardBlock(items, config);
    if (!block) throw new Error("There are no cards to insert.");
    const active = this.app.workspace.activeEditor;
    const editor = active && active.editor;
    if (!active || !active.file || active.file.path !== g.sourcePath || !editor) {
      throw new Error("Keep that note open in the editor to insert cards into it.");
    }
    if (typeof editor.getValue !== "function") throw new Error("The open editor cannot be read.");
    const current = editor.getValue();
    if (typeof editor.replaceRange === "function" && typeof editor.lineCount === "function" && typeof editor.getLine === "function") {
      const line = Math.max(0, editor.lineCount() - 1);
      const ch = str(editor.getLine(line)).length;
      editor.replaceRange(appendPrefix(current) + block + "\n", { line, ch });
    } else if (typeof editor.setValue === "function") {
      editor.setValue(appendCardBlock(current, block));
    } else {
      throw new Error("The open editor cannot be changed.");
    }
    return { inserted: items.length, path: g.sourcePath, style: config.style, separator: config.separator, hidden: config.hideInPreview };
  }

  /**
   * Save previewed front/back cards as a #flashcards note in multiline
   * Spaced Repetition syntax, then import that note through the normal card
   * importer. The source batch and card import keys make a rerun idempotent.
   */
  async writeSpacedQuiz(generated, options) {
    if (this.moduleOff("cards")) throw new Error("Turn on Cards to save a Spaced Repetition quiz.");
    const g = generated || {};
    const items = Array.isArray(g.items) ? g.items : [];
    if (!items.length) throw new Error("There are no usable cards to save as a Spaced Repetition quiz.");
    const opts = options || {};
    const deck = str(opts.deck).trim() || str(g.deck).trim() || this.settings.cards.defaultDeck || "General";
    const folder = str(opts.folder).trim() || str(this.settings.cards.newCardFolder).trim() || "Cards";
    const sourcePath = str(g.sourcePath).trim();
    const sourceText = g.sourceText === undefined ? items.map((item) => `${str(item.front)}\n${str(item.back)}`).join("\n") : str(g.sourceText);
    const batch = spacedQuizSourceKey(sourcePath, sourceText);
    const title = g.title ? `${str(g.title).trim()} Spaced Quiz` : "";
    const built = buildSpacedQuizNote(items, { sourcePath, batch, deck, title, model: g.model });
    await ensureFolder(this.app, folder);

    const sourceFile = this.app.vault
      .getMarkdownFiles()
      .find((file) => {
        const cache = this.app.metadataCache && this.app.metadataCache.getFileCache ? this.app.metadataCache.getFileCache(file) : null;
        return str(cache && cache.frontmatter && cache.frontmatter.spaced_quiz_source).trim() === sourcePath;
      });
    let file = sourceFile || null;
    const fileName = spacedQuizFileName(built.title);
    let path = file ? file.path : `${folder ? folder + "/" : ""}${fileName}`;
    if (!file) {
      let n = 2;
      while (this.app.vault.getAbstractFileByPath(path)) {
        path = `${folder ? folder + "/" : ""}${fileName.replace(/\.md$/i, ` ${n}.md`)}`;
        n++;
      }
    }

    const parsed = parseSpacedRepetition(built.text, { sourcePath: path, deck });
    if (parsed.cards.length !== built.cards.length) {
      throw new Error("The Spaced Repetition quiz did not round-trip cleanly; nothing was written.");
    }
    const beforePaths = new Set(this.app.vault.getMarkdownFiles().map((entry) => entry.path));
    if (file) await this.app.vault.modify(file, built.text);
    else file = await this.app.vault.create(path, built.text);

    const inputs = parsed.cards.map((card) => ({
      ...card,
      deck,
      course: str(g.course).trim(),
      sourceNote: sourcePath,
      importSource: path,
      importFormat: "spaced-quiz",
      importedOn: localDate(),
      aiGenerated: g.ai ? g.model || "" : "",
      aiModel: g.ai ? g.model || "" : "",
      importBatch: batch,
    }));
    const write = await this.importParsedCards(inputs, {
      deck,
      course: str(g.course).trim(),
      duplicateMode: "skip",
    });
    if (write.created || write.updated) this.refreshViews();
    this.recordAiTranscriptWrite(g, beforePaths);
    return {
      path,
      notePath: path,
      file,
      batch,
      deck,
      cards: parsed.cards.length,
      created: write.created,
      skipped: write.skipped,
      write,
      reused: write.created === 0 && write.updated === 0 && write.copied === 0,
    };
  }

  openCardGenerator(onDone, options) {
    if (!this.settings.ai.enabled) {
      new Notice("Turn on AI features under Settings, Global, Modules, then choose a provider under MCQ Tracker, AI.");
      return null;
    }
    if (this.moduleOff("cards")) {
      new Notice("Turn on Cards under Settings, Global, Modules to generate flashcards.");
      return null;
    }
    const modal = new CardGeneratorModal(this.app, this, onDone || (() => this.refreshViews()), options);
    modal.open();
    return modal;
  }

  /** Dedicated whole-note command for the Spaced Repetition quiz output. */
  openSpacedQuiz(onDone) {
    return this.openCardGenerator(onDone, { output: "spaced", source: "note" });
  }

  openAutoAnki() {
    if (!this.settings.ai.enabled) {
      new Notice("Turn on AI features under Settings, Global, Modules, then choose a provider under MCQ Tracker, AI.");
      return null;
    }
    if (this.moduleOff("cards")) {
      new Notice("Turn on Cards under Settings, Global, Modules to use Auto Anki.");
      return null;
    }
    const modal = new AutoAnkiModal(this.app, this);
    modal.open();
    return modal;
  }

  /**
   * Generate cards from the active note (or selection) and push only those cards
   * to Anki. A source/text batch is reused on a second run, so the AI is not
   * called again and existing cards are never duplicated.
   */
  async runAutoAnki(options) {
    if (!this.settings.ai.enabled) throw new Error("Turn on AI features under Settings, Global, Modules first.");
    if (this.moduleOff("cards")) throw new Error("Turn on Cards to create flashcards.");
    const anki = normalizeAnkiConnect(this.settings.cards.ankiConnect);
    if (!anki.enabled) throw new Error("Turn on AnkiConnect sync under Settings, Cards, Sync first.");
    const opts = options || {};
    const context = opts.context && opts.context.path ? opts.context : await readActiveNoteContext(this.app);
    if (!context || !context.path) throw new Error("Open a Markdown note first.");
    const source = chooseAutoAnkiSource(context, opts.source || "auto");
    const config = normalizeAutoAnki(
      { ...normalizeAutoAnki(this.settings.autoAnki, this.settings.cards.defaultDeck), count: opts.count === undefined ? this.settings.autoAnki.count : opts.count },
      this.settings.cards.defaultDeck
    );
    const deck = str(opts.deck).trim() || config.deck || this.settings.cards.defaultDeck || "General";
    return this.runAnkiBatch({ context, source, count: config.count, deck, customPrompt: opts.customPrompt, format: "auto-anki" });
  }

  /**
   * Text2Anki: the one-shot selection shortcut. It uses the same source batch,
   * card store and Anki bridge as Auto Anki, so the two commands cannot create
   * duplicate cards for the same selected passage.
   */
  async runText2Anki(options) {
    if (!this.settings.ai.enabled) throw new Error("Turn on AI features under Settings, Global, Modules first.");
    if (this.moduleOff("cards")) throw new Error("Turn on Cards to create flashcards.");
    const anki = normalizeAnkiConnect(this.settings.cards.ankiConnect);
    if (!anki.enabled) throw new Error("Turn on AnkiConnect sync under Settings, Cards, Sync first.");
    const opts = options || {};
    const base = normalizeText2Anki(this.settings.text2anki, this.settings.cards.defaultDeck);
    const config = normalizeText2Anki(
      {
        ...base,
        count: opts.count === undefined ? base.count : opts.count,
        deck: opts.deck === undefined ? base.deck : opts.deck,
        customPrompt: opts.customPrompt === undefined ? base.customPrompt : opts.customPrompt,
      },
      this.settings.cards.defaultDeck
    );
    const context = opts.context && opts.context.path ? opts.context : await readActiveNoteContext(this.app);
    if (!context || !context.path) throw new Error("Open a Markdown note first.");
    const source = chooseText2AnkiSource(context);
    const deck = source.deck || config.deck || this.settings.cards.defaultDeck || "General";
    return this.runAnkiBatch({ context, source, count: config.count, deck, customPrompt: config.customPrompt, format: "text2anki-openai" });
  }

  /** Command wrapper: a failed shortcut explains itself instead of rejecting into Obsidian. */
  async runText2AnkiCommand() {
    try {
      const result = await this.runText2Anki();
      new Notice(text2AnkiNotice(result), 6000);
      return result;
    } catch (e) {
      new Notice(str(e && e.message ? e.message : e) || "Text2Anki could not send the selection.", 7000);
      return null;
    }
  }

  /** Shared generate-write-push path for Auto Anki and Text2Anki. */
  async runAnkiBatch(options) {
    const opts = options || {};
    const context = opts.context;
    const source = opts.source;
    if (!context || !context.path) throw new Error("Open a Markdown note first.");
    if (!source || !str(source.text).trim()) throw new Error("That source has no readable text to turn into cards.");
    const count = Math.max(1, Math.min(20, Math.round(Number(opts.count) || 8)));
    const deck = str(opts.deck).trim() || this.settings.cards.defaultDeck || "General";
    const customPrompt = str(opts.customPrompt).trim().slice(0, 2000);
    const format = str(opts.format).trim() || "auto-anki";
    const batch = autoAnkiSourceKey(context.path, source.kind, source.text);
    const existing = autoAnkiBatchPaths(this.getCards(), batch);
    if (existing.length) {
      const pushed = await this.pushCardsToAnki({ paths: existing, deck });
      return {
        batch,
        format,
        reused: true,
        sourceKind: source.kind,
        cards: existing.length,
        paths: existing,
        created: 0,
        skipped: existing.length,
        pushed,
      };
    }

    const generated = await this.generateCardsFromNote({
      context,
      source: source.kind,
      sourceText: source.text,
      count,
      deck,
      customPrompt,
    });
    if (!generated.items.length) throw new Error("The AI returned no usable cards. Try a different note or selection.");
    const inputs = autoAnkiCardInputs(generated, { deck, batch, format });
    if (!inputs.length) throw new Error("The AI returned no usable cards. Try a different note or selection.");
    const beforePaths = new Set(this.app.vault.getMarkdownFiles().map((file) => file.path));
    const write = await this.importParsedCards(inputs, {
      deck,
      course: generated.course,
      duplicateMode: "skip",
    });
    const rowPaths = write.rows
      .filter((row) => ["created", "updated", "copied", "skipped"].includes(row.status) && row.path)
      .map((row) => row.path);
    const paths = [...new Set([...autoAnkiBatchPaths(this.getCards(), batch), ...rowPaths])];
    if (!paths.length) throw new Error("The generated cards could not be written to the vault.");
    this.recordAiTranscriptWrite(generated, beforePaths);
    const pushed = await this.pushCardsToAnki({ paths, deck });
    return {
      batch,
      format,
      reused: false,
      sourceKind: source.kind,
      generated: generated.items.length,
      created: write.created,
      skipped: write.skipped,
      cards: paths.length,
      paths,
      write,
      pushed,
    };
  }

  /* ---- whole-note review, using the same scheduler as questions and cards */

  setupNoteReviewStatus() {
    if (typeof this.addStatusBarItem !== "function") return;
    this.noteReviewEl = this.addStatusBarItem();
    this.noteReviewEl.addClass("qt-note-review-status");
    this.noteReviewEl.addEventListener("click", () => this.openNoteReview());
    this.refreshNoteReviewStatus();
    this.registerInterval(activeWindow.setInterval(() => this.refreshNoteReviewStatus(), 60000));
  }

  refreshNoteReviewStatus() {
    if (!this.noteReviewEl) return;
    const config = normalizeNoteReview(this.settings.noteReview);
    if (!config.enabled) {
      this.noteReviewEl.setText("");
      this.noteReviewEl.toggleClass("qt-hidden", true);
      return;
    }
    const queue = this.getNoteQueue({ limit: 0 });
    this.noteReviewEl.toggleClass("qt-hidden", false);
    this.noteReviewEl.setText(`Notes due: ${queue.counts.due}`);
    this.noteReviewEl.setAttr("aria-label", `${queue.counts.due} whole note${queue.counts.due === 1 ? "" : "s"} due for review`);
  }

  getNoteCandidates() {
    return this.app.vault.getMarkdownFiles().map((file) => ({
      file,
      fm: (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {},
    }));
  }

  getNoteQueue(options) {
    const opts = options || {};
    const config = normalizeNoteReview(this.settings.noteReview);
    return buildNoteQueue(this.getNoteCandidates(), {
      sets: config.sets,
      today: localDate(),
      limit: opts.limit === undefined ? config.limit : opts.limit,
    });
  }

  openNoteReview() {
    const config = normalizeNoteReview(this.settings.noteReview);
    if (!config.enabled) {
      new Notice("Turn on whole-note review under Settings → MCQ Tracker → Review first.", 6000);
      return null;
    }
    const modal = new NoteReviewModal(this.app, this);
    modal.open();
    return modal;
  }

  /** The shared candidate set, filtered to notes onboarded to Spaced Everything. */
  getSpacedQueue(options) {
    const opts = options || {};
    const config = normalizeNoteReview(this.settings.noteReview);
    return buildSpacedQueue(this.getNoteCandidates(), {
      config: this.settings.spacedEverything,
      now: opts.now,
      limit: opts.limit === undefined ? config.limit : opts.limit,
      files: opts.files,
      includeUnonboarded: opts.includeUnonboarded === true,
    });
  }

  openSpacedReview() {
    const config = normalizeSpacedEverything(this.settings.spacedEverything);
    if (!config.enabled) {
      new Notice("Turn on Spaced Everything under Settings → MCQ Tracker → Review first.", 6000);
      return null;
    }
    const modal = new NoteReviewModal(this.app, this, { mode: "spaced" });
    modal.open();
    return modal;
  }

  openSpacedReviewForFile(file) {
    const config = normalizeSpacedEverything(this.settings.spacedEverything);
    if (!config.enabled) {
      new Notice("Turn on Spaced Everything under Settings → MCQ Tracker → Review first.", 6000);
      return null;
    }
    const modal = new NoteReviewModal(this.app, this, { mode: "spaced", files: [file], includeUnonboarded: true });
    modal.open();
    return modal;
  }

  /** Update only the readable se-* schedule fields; question tracking stays untouched. */
  async recordSpacedReview(file, rating, seconds, now) {
    let summary;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      summary = applySpacedReview(fm, rating, now instanceof Date ? now : new Date(), this.settings.spacedEverything);
    });
    if (!summary) throw new Error("Choose Fruitful, Unfruitful or Ignore.");
    this.refreshNoteReviewStatus();
    return { ...summary, seconds: Math.max(0, Math.round(Number(seconds) || 0)) };
  }

  openSpacedCapture() {
    const config = normalizeSpacedEverything(this.settings.spacedEverything);
    if (!config.enabled) {
      new Notice("Turn on Spaced Everything under Settings → MCQ Tracker → Review first.", 6000);
      return null;
    }
    const modal = new SpacedEverythingCaptureModal(this.app, this);
    modal.open();
    return modal;
  }

  /** Create an onboarded thought note from the configured title and body templates. */
  async captureSpacedThought(thought, options) {
    const text = str(thought).trim();
    if (!text) throw new Error("Write a thought first.");
    const config = normalizeSpacedEverything(this.settings.spacedEverything);
    const now = options && options.now instanceof Date && !isNaN(options.now.getTime()) ? options.now : new Date();
    const processedThought = renderSpacedTemplate(text, text, now);
    const title = safeName(renderSpacedTemplate(config.titleTemplate, processedThought, now)) || `Inbox ${Math.floor(now.getTime() / 1000)}`;
    const folder = config.captureFolder;
    if (folder) await ensureFolder(this.app, folder);
    let path = folder ? `${folder}/${title}.md` : `${title}.md`;
    let suffix = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = folder ? `${folder}/${title} ${suffix}.md` : `${title} ${suffix}.md`;
      suffix++;
    }
    const frontmatter = {
      "se-interval": config.defaultInterval,
      "se-ease": config.defaultEase,
      "se-last-reviewed": "",
    };
    const body = spacedCaptureText(processedThought, now, config);
    const content = `---
${stringifyYaml(frontmatter)}---

${body}
`;
    const file = await this.app.vault.create(path, content);
    try {
      const leaf = this.app.workspace.getLeaf("tab");
      if (leaf && typeof leaf.openFile === "function") await leaf.openFile(file);
    } catch (e) {
      /* the note exists even if the workspace cannot focus it */
    }
    return { path, file };
  }

  /** Read and parse the active note without changing its scheduler state. */
  async loadSimpleNoteQuiz(file) {
    const text = await this.app.vault.cachedRead(file);
    return { ...parseSimpleNoteQuiz(text, this.settings.simpleNoteQuiz), file, text };
  }

  /** Save the self-ratings as visible ✅/❌ marks on the question lines. */
  async saveSimpleNoteQuizMarks(file, results) {
    const current = await this.app.vault.read(file);
    const result = applySimpleNoteQuizMarks(current, results);
    if (result.changed) await this.app.vault.modify(file, result.text);
    return result;
  }

  /** Remove all Simple Note Quiz marks from one note. */
  async clearSimpleNoteQuizMarks(file) {
    const current = await this.app.vault.read(file);
    const result = clearSimpleNoteQuizMarks(current);
    if (result.changed) await this.app.vault.modify(file, result.text);
    return result;
  }

  async openSimpleNoteQuiz() {
    if (this.moduleOff("mcq")) {
      new Notice("Turn on MCQ Tracker to use Simple Note Quiz.", 6000);
      return null;
    }
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("Open a Markdown note first.", 5000);
      return null;
    }
    try {
      const parsed = await this.loadSimpleNoteQuiz(file);
      if (!parsed.questions.length) {
        const detail = parsed.issues && parsed.issues.length ? ` ${parsed.issues[0]}` : "";
        new Notice(`No question/answer pairs found.${detail}`, 7000);
        return parsed;
      }
      const modal = new SimpleNoteQuizModal(this.app, this, file, parsed, parsed.options);
      modal.open();
      return modal;
    } catch (e) {
      new Notice(`Could not read this note: ${str(e && e.message ? e.message : e)}`, 7000);
      return null;
    }
  }

  /** Record a whole-note rating through the same applyAttempt path as questions and cards. */
  async recordNoteReview(file, grade, seconds) {
    const attempt = noteReviewAttempt(grade, seconds);
    let summary;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      const previous = noteReviewDock.noteReviewSnapshot(fm);
      const scheduler = noteReviewDock.schedulerForNote(fm, this.settings);
      summary = applyAttempt(fm, attempt, this.settings.intervals, {
        scheduler,
        fsrsRetention: this.settings.fsrsRetention,
        grade: attempt.grade,
        historyLimit: this.settings.historyLimit,
      });
      const priorStreak = Number(fm.note_lapse_streak) || 0;
      fm.note_lapse_streak = attempt.grade === "again" ? priorStreak + 1 : 0;
      const statsCfg = studyStats.normalizeStudyStatsSettings(this.settings.studyStats);
      if (statsCfg.durableRecall) {
        summary.durability = durability.recordRecallDay(fm, { correct: attempt.correct, date: localDate(), requiredDays: statsCfg.durableDays });
      }
      summary.previous = previous;
      summary.lapseStreak = fm.note_lapse_streak;
    });
    await this.recordStudyCounter({ kind: "note", correct: attempt.correct, seconds: attempt.seconds, rating: attempt.grade });
    this.refreshViews();
    return summary;
  }

  refreshNoteReviewDock() {
    if (!this.noteReviewDock) return;
    try {
      this.noteReviewDock.refresh();
    } catch (e) {
      /* the dock is an optional overlay; a render error must not break the plugin */
    }
  }

  async toggleNoteReviewDock() {
    const config = noteReviewDock.normalizeNoteReviewDockSettings(this.settings.noteReviewDock);
    config.enabled = !config.enabled;
    this.settings.noteReviewDock = config;
    await this.save();
    this.refreshNoteReviewDock();
    new Notice(config.enabled ? "The whole-note review bar is shown." : "The whole-note review bar is hidden.");
  }

  sessionReportEnabled() {
    return noteReviewDock.normalizeNoteReviewDockSettings(this.settings.noteReviewDock).reportEnabled === true;
  }

  /** Write the docked run's grades as a local study note. No provider or second review store. */
  async saveReviewSessionReport(items) {
    const config = noteReviewDock.normalizeNoteReviewDockSettings(this.settings.noteReviewDock);
    const list = Array.isArray(items) ? items : [];
    const session = this.noteReviewDock && this.noteReviewDock.session;
    if (!list.length && !session) {
      new Notice("Finish a docked review session first, then save its report.", 6000);
      return null;
    }
    const status = session ? reviewSession.sessionStatus(session) : { completed: list.length, missed: [], requeued: 0 };
    const date = localDate();
    const markdown = sessionReport.sessionReportMarkdown({ status, items: list, date });
    const existing = this.app.vault.getMarkdownFiles().map((file) => file.path);
    const path = sessionReport.reportPath(config.reportFolder, date, existing);
    if (config.reportFolder) await ensureFolder(this.app, config.reportFolder);
    const file = await this.app.vault.create(path, markdown);
    new Notice(`Saved the review session report to ${path}.`, 6000);
    return { path, file, markdown };
  }

  async undoNoteReview(file, snapshot) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      noteReviewDock.restoreNoteReviewSnapshot(fm, snapshot);
    });
    this.refreshViews();
  }

  async postponeNoteReview(file, days) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.next_review = noteReviewDock.postponeDays(new Date(), days);
      fm.note_lapse_streak = 0;
    });
    this.refreshViews();
  }

  async applyNoteLapseAction(file, action) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      noteReviewDock.applyLapseAction(fm, action, new Date());
    });
    this.refreshViews();
  }

  reviewCalendarSettings() {
    return reviewCalendar.normalizeReviewCalendarSettings(this.settings.reviewCalendar);
  }

  reviewCalendarSnapshot(options) {
    const opts = options || {};
    const config = this.reviewCalendarSettings();
    const noteConfig = normalizeNoteReview(this.settings.noteReview);
    const cards = config.showCards && this.cardsEnabled() ? this.getCards() : [];
    return reviewCalendar.buildReviewForecast({
      notes: this.getNoteCandidates(),
      cards,
      settings: config,
      sets: noteConfig.sets,
      today: localDate(),
      days: opts.days || 45,
    });
  }

  async addNoteToReview(file, options) {
    const opts = options || {};
    const target = file || this.app.workspace.getActiveFile();
    if (!target || !/\.md$/i.test(target.path || "")) {
      if (!opts.silent) new Notice("Open a Markdown note first.");
      return null;
    }
    const fm = this.app.metadataCache.getFileCache(target)?.frontmatter || {};
    if (!noteReview.isNoteCandidate({ file: target, fm })) {
      if (!opts.silent) new Notice("Question and card notes are already reviewed by their own queues.");
      return null;
    }
    await this.app.fileManager.processFrontMatter(target, (noteFm) => {
      noteFm.note_review = true;
      noteFm.note_review_excluded = false;
      if (!str(noteFm.next_review).trim()) noteFm.next_review = localDate();
    });
    const config = normalizeNoteReview(this.settings.noteReview);
    config.enabled = true;
    this.settings.noteReview = config;
    await this.save();
    this.refreshViews();
    if (!opts.silent) new Notice(`${target.basename} is now in whole-note review.`);
    return target.path;
  }

  async addActiveNoteToReview() {
    return this.addNoteToReview(this.app.workspace.getActiveFile());
  }

  folderMainNote(folder) {
    const root = str(folder).trim().replace(/^\/+|\/+$/g, "");
    if (!root) return null;
    const rows = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (file.path !== root && !file.path.startsWith(`${root}/`)) continue;
      const cache = this.app.metadataCache.getFileCache(file) || {};
      rows.push({ path: file.path, title: file.basename, links: Array.isArray(cache.links) ? cache.links.length : 0 });
    }
    return reviewCalendar.pickMainNote(rows);
  }

  async addFolderToReview(folder, options) {
    const opts = options || {};
    const root = str(folder).trim().replace(/^\/+|\/+$/g, "");
    if (!root) {
      if (!opts.silent) new Notice("Open a note inside the folder first.");
      return null;
    }
    const config = normalizeNoteReview(this.settings.noteReview);
    const result = reviewCalendar.addFolderSet(config.sets, root, `Folder: ${root}`);
    config.sets = result.sets;
    config.enabled = true;
    this.settings.noteReview = config;
    if (opts.detectMainNote !== false && this.reviewCalendarSettings().detectMainNote) {
      const main = this.folderMainNote(root);
      if (main) await this.addNoteToReview(this.app.vault.getAbstractFileByPath(main.path), { silent: true });
    }
    await this.save();
    this.refreshViews();
    if (!opts.silent) new Notice(result.added ? `Added ${root} to whole-note review.` : `${root} is already in whole-note review.`);
    return result.added ? root : null;
  }

  async addActiveFolderToReview() {
    const file = this.app.workspace.getActiveFile();
    if (!file || !file.parent) {
      new Notice("Open a note inside the folder first.");
      return null;
    }
    return this.addFolderToReview(file.parent.path);
  }

  studyStatsSnapshot(now) {
    const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
    return this.snapshot(`study-stats|${localDate(at)}`, () =>
      studyStats.buildStudyStats({
        cards: this.getCards(),
        questions: this.getQuestions(),
        notes: this.getNoteCandidates(),
        counters: this.settings.studyCounters,
        settings: this.settings.studyStats,
        fsrsRetention: this.settings.fsrsRetention,
        now: at,
      })
    );
  }

  /** Cached dashboard aggregation. The caller only chooses presentation options. */
  dashboardSnapshot(options) {
    const opts = options || {};
    const at = opts.today instanceof Date && !isNaN(opts.today.getTime()) ? opts.today : new Date();
    const field = ["skill", "domain", "difficulty"].includes(opts.field) ? opts.field : "skill";
    const weeks = Math.max(1, Math.min(26, Math.round(Number(opts.weeks) || 12)));
    const course = str(opts.course).trim();
    const key = `dashboard|${localDate(at)}|${field}|${weeks}|${course}|${opts.retentionWeeks || 8}|${opts.forwardDays || 7}`;
    return this.snapshot(key, () => {
      const gradebook = this.assignmentStats ? this.assignmentStats() : null;
      return buildDashboard({
        questions: this.getQuestions(),
        cards: this.getCards ? this.getCards() : [],
        frq: this.getFrqKnowledge ? this.getFrqKnowledge() : null,
        gradebook,
        assignments: gradebook ? gradebook.summary : null,
        studyLog: this.settings.studyLog,
        confidenceLabels: this.settings.confidenceLabels,
        field,
        course,
        weeks,
        retentionWeeks: opts.retentionWeeks,
        forwardDays: opts.forwardDays,
        today: at,
      });
    });
  }

  /** Cached goal/mastery snapshot used by the Progress tab and its embedded cards. */
  progressSnapshot(options) {
    const opts = options || {};
    const at = opts.today instanceof Date && !isNaN(opts.today.getTime()) ? opts.today : new Date();
    const weeks = Math.max(1, Math.min(26, Math.round(Number(opts.weeks) || 12)));
    const scope = str(opts.masteryScope).trim();
    const days = masteryWindowDays(opts.masteryDays);
    const courses = this.settings.calendar && Array.isArray(this.settings.calendar.courses) ? this.settings.calendar.courses : [];
    const registryKey = courses.map((course) => `${course.id || course.name}:${course.name || ""}:${(course.aliases || []).join(",")}`).join("|");
    const key = `progress|${localDate(at)}|${weeks}|${scope}|${days}|${registryKey}`;
    return this.snapshot(key, () =>
      buildProgress({
        questions: this.getQuestions(),
        cards: this.getCards ? this.getCards() : [],
        frq: this.getFrqKnowledge ? this.getFrqKnowledge() : null,
        studyLog: this.settings.studyLog,
        today: at,
        weeks,
        masteryScope: scope,
        masteryDays: days,
        courses,
      })
    );
  }

  async recordStudyCounter(entry) {
    const result = studyCounters.recordStudyCounter(this.settings.studyCounters, entry);
    this.settings.studyCounters = result.counters;
    await this.save();
    return result;
  }

  setupPomodoroStatus() {
    if (typeof this.addStatusBarItem !== "function") return;
    this.pomodoroEl = this.addStatusBarItem();
    this.pomodoroEl.addClass("qt-pomodoro-status");
    this.pomodoroEl.addEventListener("click", () => this.activatePomodoro());
    this.refreshPomodoroStatus();
  }

  refreshPomodoroStatus() {
    if (!this.pomodoroEl) return;
    if (!this.pomodoroEnabled()) {
      this.pomodoroEl.setText("");
      this.pomodoroEl.toggleClass("qt-hidden", true);
      return;
    }
    const data = this.pomodoroSnapshot();
    this.pomodoroEl.toggleClass("qt-hidden", false);
    this.pomodoroEl.setText(`${data.label} ${data.display}`);
    this.pomodoroEl.setAttr("aria-label", `${data.label} ${data.display}. Open Pomodoro.`);
  }

  pomodoroSnapshot() {
    return pomodoro.pomodoroSnapshot(this.settings.pomodoro, this.settings.pomodoro && this.settings.pomodoro.state, new Date());
  }

  async savePomodoroState(state) {
    const config = pomodoro.normalizePomodoroSettings(this.settings.pomodoro);
    config.state = pomodoro.normalizePomodoroState(state);
    this.settings.pomodoro = config;
    await this.save();
    this.refreshPomodoro();
  }

  refreshPomodoro() {
    this.refreshPomodoroStatus();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_POMODORO)) {
      if (leaf.view && leaf.view.render) leaf.view.render();
    }
  }

  async startPomodoro() {
    if (!this.pomodoroEnabled()) return null;
    const config = pomodoro.normalizePomodoroSettings(this.settings.pomodoro);
    await this.savePomodoroState(pomodoro.startPomodoro(config.state, new Date()));
    return this.pomodoroSnapshot();
  }

  async pausePomodoro() {
    const config = pomodoro.normalizePomodoroSettings(this.settings.pomodoro);
    await this.savePomodoroState(pomodoro.pausePomodoro(config.state, config, new Date()));
    return this.pomodoroSnapshot();
  }

  async togglePomodoro() {
    const data = this.pomodoroSnapshot();
    return data.running ? this.pausePomodoro() : this.startPomodoro();
  }

  async resetPomodoro(save = true) {
    const config = pomodoro.normalizePomodoroSettings(this.settings.pomodoro);
    const state = pomodoro.resetPomodoro(config, new Date());
    if (save) return this.savePomodoroState(state);
    config.state = state;
    this.settings.pomodoro = config;
    return state;
  }

  async skipPomodoro() {
    const config = pomodoro.normalizePomodoroSettings(this.settings.pomodoro);
    const result = pomodoro.skipPomodoro(config, config.state, new Date());
    await this.savePomodoroState(result.state);
    return this.pomodoroSnapshot();
  }

  tickPomodoro() {
    if (!this.pomodoroEnabled()) return null;
    const config = pomodoro.normalizePomodoroSettings(this.settings.pomodoro);
    const result = pomodoro.tickPomodoro(config, config.state, new Date());
    config.state = result.state;
    this.settings.pomodoro = config;
    this.refreshPomodoro();
    if (result.completedPhase) this.save().catch(() => {});
    return result;
  }

  async activatePomodoro() {
    if (!this.pomodoroEnabled()) {
      new Notice("Turn on Pomodoro in Settings → Pomodoro.");
      return null;
    }
    return this.activateModuleView(VIEW_TYPE_POMODORO);
  }

  onPomodoroToggled() {
    this.refreshRibbon();
    if (!this.pomodoroEnabled()) this.detachModuleLeaves([VIEW_TYPE_POMODORO]);
    this.refreshPomodoro();
  }

  async saveLocalEvent(value) {
    const result = localEvents.upsertLocalEvent(this.settings.localEvents, value, new Date());
    this.settings.localEvents = result.settings;
    await this.save();
    this.refreshViews();
    return result.event;
  }

  async deleteLocalEvent(id) {
    const result = localEvents.removeLocalEvent(this.settings.localEvents, id);
    this.settings.localEvents = result.settings;
    await this.save();
    this.refreshViews();
    return result.removed;
  }

  openNewLocalEvent() {
    if (!this.localEventsEnabled()) {
      new Notice("Turn on Local events in Settings → Local events.");
      return null;
    }
    const modal = new LocalEventModal(this.app, this, null);
    modal.open();
    return modal;
  }

  openLocalEvent(id) {
    const event = (this.settings.localEvents.events || []).find((item) => item.id === id);
    if (!event) return null;
    const modal = new LocalEventModal(this.app, this, event);
    modal.open();
    return modal;
  }

  async openNextDueNote() {
    const queue = this.getNoteQueue({ limit: 0 });
    if (!queue.all.length) {
      new Notice("No whole notes are due for review.");
      return null;
    }
    const active = this.app.workspace.getActiveFile();
    const current = active ? queue.all.findIndex((row) => row.path === active.path) : -1;
    const next = queue.all[current + 1] || queue.all[0];
    await this.app.workspace.getLeaf(false).openFile(next.file);
    this.refreshNoteReviewDock();
    return next.file;
  }

  async activateReviewCalendar() {
    if (!this.reviewCalendarEnabled()) {
      new Notice("Turn on Review calendar in Settings → Review calendar.");
      return null;
    }
    return this.activateModuleView(VIEW_TYPE_REVIEW_CALENDAR);
  }

  async activateStudyStats() {
    if (!this.studyStatsEnabled()) {
      new Notice("Turn on Study statistics in Settings → Study statistics.");
      return null;
    }
    return this.activateModuleView(VIEW_TYPE_STUDY_STATS);
  }

  async activateLocalEvents() {
    if (!this.localEventsEnabled()) {
      new Notice("Turn on Local events in Settings → Local events.");
      return null;
    }
    return this.activateModuleView(VIEW_TYPE_LOCAL_EVENTS);
  }

  async activateModuleView(type) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(type)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  async setNotePriority(file, priority) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.note_review_priority = normalizePriority(priority);
    });
    this.refreshViews();
  }

  /** Write an already-previewed transcript draft. */
  async writeTranscriptPractice(generated, options) {
    const g = generated || {};
    const opts = options || {};
    const items = Array.isArray(g.items) ? g.items : [];
    const beforePaths = new Set(this.app.vault.getMarkdownFiles().map((file) => file.path));
    if (!items.length) return { created: 0, paths: [], errors: ["There are no items to write."] };
    if (g.kind === "questions" && this.moduleOff("mcq")) throw new Error("Turn on MCQ Tracker to create practice questions.");
    if (g.kind !== "questions" && this.moduleOff("cards")) throw new Error("Turn on Cards to create flashcards.");

    if (g.kind !== "questions") {
      const deck = str(opts.deck).trim() || this.settings.cards.defaultDeck || "Lecture";
      const cards = items.map((card) => ({
        ...card,
        deck,
        course: str(g.course).trim(),
        sourceNote: g.sourcePath,
        importSource: g.sourcePath,
        importFormat: g.ai ? "transcript-ai" : "outline",
        importedOn: localDate(),
        lectureId: g.lectureId,
        lecturePath: g.lecturePath,
        aiGenerated: g.ai ? g.model : "",
        aiModel: g.ai ? g.model : "",
        importKey: `transcript:${hashString(`${g.sourcePath}|${card.front}|${card.back}`)}`,
      }));
      const result = await this.importParsedCards(cards, {
        deck,
        course: str(g.course).trim(),
        errors: Array.isArray(g.errors) ? g.errors.slice() : [],
        duplicateMode: opts.duplicateMode || "skip",
      });
      if (result.created || result.updated) this.refreshViews();
      this.recordAiTranscriptWrite(g, beforePaths);
      return result;
    }

    const folder = str(opts.folder).trim() || str(this.settings.questionFolder).trim() || "Questions";
    await ensureFolder(this.app, folder);
    const paths = [];
    const errors = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = safeFileName(item.question || `${g.title} question ${i + 1}`);
      let path = `${folder ? folder + "/" : ""}${title}.md`;
      let n = 2;
      while (this.app.vault.getAbstractFileByPath(path)) {
        path = `${folder ? folder + "/" : ""}${title} ${n}.md`;
        n++;
      }
      const qid = path.replace(/^.*\//, "").replace(/\.md$/i, "");
      try {
        const quality = checkDistractorQuality(item);
        if (!quality.ok) {
          errors.push(`${title}: ${quality.reasons[0] || "invalid choices"}`);
          continue;
        }
        const note = questionNote(
          item,
          { course: g.course, source: g.title },
          qid,
          { model: g.model || this.aiModelLabel("generation"), date: localDate(), sourcePath: g.sourcePath, sourceKind: "note", lectureId: g.lectureId, lecturePath: g.lecturePath, verification: item.verification }
        );
        assertAllowedWritePath(path, this.settings);
        await this.app.vault.create(path, note);
        paths.push(path);
      } catch (e) {
        errors.push(`${title}: ${str(e && e.message ? e.message : e)}`);
      }
    }
    if (paths.length) this.refreshViews();
    const subtopics = Array.isArray(g.subtopics) ? g.subtopics.filter(Boolean) : [];
    if (subtopics.length && g.sourcePath) {
      const source = this.app.vault.getAbstractFileByPath(g.sourcePath);
      if (source instanceof TFile) {
        try {
          await this.app.fileManager.processFrontMatter(source, (fm) => {
            const prior = Array.isArray(fm.generated_subtopics) ? fm.generated_subtopics.map(String) : [];
            fm.generated_subtopics = [...new Set([...prior, ...subtopics])].slice(-50);
          });
        } catch (e) {
          // The generated notes are already safe; memory is best-effort.
        }
      }
    }
    this.recordAiTranscriptWrite(g, beforePaths);
    return { created: paths.length, paths, errors };
  }

  /** Read and map one note without writing anything, so the preview can be reviewed. */
  async previewNoteCards(path, options) {
    const opts = options || {};
    const target = path && path.path ? path.path : str(path).trim();
    const file = this.app.vault.getAbstractFileByPath(target);
    if (!(file instanceof TFile)) throw new Error("That note is not in the vault.");
    if (!/\.md$/i.test(file.path)) throw new Error("Choose a Markdown note.");
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    if (isCardNote(fm)) {
      return { blocked: true, reason: "This note is already a card; extract from a lecture or source note instead.", cards: [], skipped: 0, warnings: [], file, fm };
    }
    const flag = flashcardsFlag(fm);
    if (flag === false) {
      return {
        blocked: true,
        reason: "This note has `flashcards: false`, so nothing will be extracted. Change that property to true or remove it first.",
        cards: [],
        skipped: 0,
        warnings: [],
        file,
        fm,
      };
    }
    const text = await this.app.vault.cachedRead(file);
    const deck = str(opts.deck).trim() || str(fm.deck).trim() || str(this.settings.cards.defaultDeck).trim() || "Extracted";
    const course = str(opts.course).trim() || str(fm.course).trim() || courseForFolder(this.settings, file.path) || "";
    const tags = Array.isArray(fm.tags) ? fm.tags : [];
    const parsed = extractCardsFromMarkdown(text, { sourcePath: file.path, deck, course, tags, seed: opts.seed, separators: opts.separators });
    // Keep a durable link to the lecture or source note, not just the import label.
    const cards = parsed.cards.map((card) => ({ ...card, sourceNote: file.path }));
    return { ...parsed, cards, file, fm, deck, course, flashcards: flag };
  }

  /** Write previewed extraction cards. The note is stamped after the first successful write. */
  async extractCardsFromNote(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: ["Cards are off."] };
    const opts = options || {};
    const preview = await this.previewNoteCards(path, opts);
    if (preview.blocked) return { created: 0, skipped: 0, errors: [preview.reason], blocked: true };
    if (!preview.cards.length) return { created: 0, skipped: 0, errors: preview.warnings || [], total: 0 };
    const result = await this.importParsedCards(preview.cards, {
      deck: preview.deck,
      course: preview.course,
      errors: preview.warnings,
    });
    if (result.created && opts.stamp !== false) {
      await this.app.fileManager.processFrontMatter(preview.file, (fm) => {
        if (flashcardsFlag(fm) === null) fm.flashcards = true;
      });
    }
    this.refreshViews();
    return { ...result, path: preview.file.path };
  }

  async activateCalendar() {
    if (this.moduleOff("calendar")) return null;
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE_CALENDAR)[0];
    if (!leaf) {
      leaf = ws.getLeaf(Platform.isMobile ? true : "tab");
      await leaf.setViewState({ type: VIEW_TYPE_CALENDAR, active: true });
    }
    if (leaf.loadIfDeferred) await leaf.loadIfDeferred();
    await ws.revealLeaf(leaf);
    if (leaf.view && leaf.view.render) leaf.view.render();
    return leaf.view;
  }

  openCalendarImport() {
    if (this.moduleOff("calendar")) return;
    new CalendarImportModal(this.app, this, () => this.refreshCalendarViews()).open();
  }

  /** `uni-schedule` / `mcq-schedule` block: the classes of one day. */
  renderScheduleBlock(source, el) {
    el.empty();
    if (!this.calendarEnabled()) {
      const empty = el.createDiv({ cls: "uni-empty-schedule" });
      empty.createDiv({ cls: "uni-empty-schedule-desc", text: "Calendar is off. Turn it on in Settings, Global." });
      return;
    }
    const { dateKey: key } = parseScheduleBlock(source, new Date());
    const box = el.createDiv({ cls: "uni-schedule-embed" });
    applyCalendarWidth(box, this.calendarSettings());
    renderDaySection(this, box, key);
  }

  /** A local-only dashboard that can be placed inside any note. */
  renderDashboardBlock(source, el) {
    el.empty();
    if (this.moduleOff("mcq")) {
      el.createDiv({ cls: "qt-hint", text: "The MCQ Tracker module is off. Turn it on in Settings, Global." });
      return;
    }
    const opts = parseDashboardBlock(source);
    const draw = () => {
      el.empty();
      const box = el.createDiv({ cls: "qt-wrap qt-dash-embed" });
      const questions = this.getQuestions();
      const today = new Date();
      const data = buildDashboard({
        questions,
        cards: this.getCards ? this.getCards() : [],
        studyLog: this.settings.studyLog,
        confidenceLabels: this.settings.confidenceLabels,
        today,
        course: opts.course,
        field: opts.field,
        weeks: opts.weeks,
      });
      const courses = this.settings.calendar && Array.isArray(this.settings.calendar.courses) ? this.settings.calendar.courses : [];
      const requestedScope = data.course || str(this.settings.masteryScope).trim();
      const scopes = masteryScopes(questions, courses);
      const masteryScope = !data.course && requestedScope && !scopes.some((scope) => scope.toLowerCase() === requestedScope.toLowerCase()) ? "" : requestedScope;
      const masteryDays = opts.masteryDays === undefined ? masteryWindowDays(this.settings.masteryDays) : opts.masteryDays;
      const scopedMastery = scopeQuestions(questions, masteryScope, courses);
      data.mastery = buildMastery(scopedMastery, { days: masteryDays, today });
      data.masteryTrend = buildMasteryTrend(scopedMastery, { days: masteryDays, today });
      data.masteryScope = masteryScope;
      data.masteryDays = masteryDays;
      const plan = this.studyPlan ? this.studyPlan() : null;
      data.plan = plan && (!opts.course || courseMatches(plan.course, opts.course)) ? plan : null;
      renderDashboardEmbed(box, data, opts, {
        onPractice: (field, value) => this.practiceWith({ [field]: [value] }, "smart"),
        onMasteryPractice: (band, label) => {
          const pool = bandQuestions(scopedMastery, band, { days: masteryDays, today });
          this.practiceQuestionPool(pool, label);
        },
      });
      const footer = box.createDiv({ cls: "qt-row qt-small-row qt-dash-embed-footer" });
      footer.createSpan({ cls: "qt-hint", text: "Calculated locally." });
      footer.createEl("button", { text: "Refresh" }).addEventListener("click", draw);
      if (opts.course) footer.createSpan({ cls: "qt-hint", text: `Course: ${opts.course}` });
    };
    draw();
  }

  async openNextClassNote() {
    if (this.moduleOff("calendar")) return;
    const status = nextClassStatus(this.calendarEvents(), new Date());
    if (!status.event) {
      new Notice("No class found in the calendar.");
      return;
    }
    await this.openClassNote(status.event, status.event.dateKey);
  }

  async openClassNote(event, key) {
    if (event && event.sourcePath) {
      const source = this.app.vault.getAbstractFileByPath(event.sourcePath);
      if (!(source instanceof TFile)) {
        new Notice(`Could not find ${event.sourcePath}.`);
        return null;
      }
      const leaf = this.app.workspace.getLeaf(false);
      if (leaf && leaf.openFile) await leaf.openFile(source);
      return { file: source, path: source.path, created: false };
    }
    const result = await openOrCreateClassNote(
      this.app,
      this.calendarSettings(),
      event,
      key || event.dateKey,
      this.calendarNoteIndex(),
      this.calendarFolders()
    );
    this.invalidateCalendarNotes();
    const folder = result.path.includes("/") ? result.path.slice(0, result.path.lastIndexOf("/")) : "";
    if (folder && event.summary && this.settings.calendar.subjectFolders[event.summary] !== folder) {
      this.settings.calendar.subjectFolders[event.summary] = folder;
      await this.save();
    }
    if (result.created) new Notice(`Created ${result.path}.`);
    return result;
  }

  /** Adds a saved resource to the exam's class note, creating the note when needed. */
  async addApResourceToClassNote(event, key, entry) {
    if (!event || !entry) return null;
    const result = await this.openClassNote(event, key || event.dateKey);
    const added = await addResourceLink(this.app, result.file, entry);
    new Notice(
      added.added
        ? `Added ${entry.path.split("/").pop()?.replace(/\.md$/i, "") || "resource"} to ${result.path}.`
        : "That resource is already linked in the class note.",
    );
    return { ...result, added: added.added };
  }

  /** Plans for every exam in the configured window, soonest first. */
  studyPlans() {
    return this.getExams({ horizonDays: normalizeStudyPlanDays(this.settings.studyPlanDays) })
      .map((exam) => this.buildExamPlan(exam))
      .filter(Boolean);
  }

  /** The soonest exam plan, kept for the existing Today and command callers. */
  studyPlan() {
    return this.studyPlans()[0] || null;
  }

  buildExamPlan(exam) {
    if (!exam || !exam.date) return null;
    const course = str(exam.course || exam.title).trim();
    if (!course) return null;
    const settings = this.calendarSettings();
    const matches = (value) => !!str(value).trim() && (courseIdentity.sameCourse(settings, value, course) || examMatchesCourse({ summary: value, course: value }, course));
    const questions = this.getQuestions().filter((q) => matches(q.fm.course) || matches(q.fm.test));
    const cards = this.cardsEnabled() ? this.getCards().filter((c) => matches(c.course || (c.fm && c.fm.course))) : [];
    const frq = this.getFrqReviewQueue({ course });
    const registered = findRegisteredCourse(settings, course);
    const examTopics = (Array.isArray(exam.topics) ? exam.topics : [])
      .map((topic) => str(topic).trim().toLowerCase())
      .filter(Boolean);
    const priorExams = this.getExams({ includePast: true, horizonDays: 3650 })
      .filter((row) => row.date < exam.date && matches(row.course))
      .sort((a, b) => a.date.localeCompare(b.date));
    const previousExam = priorExams[priorExams.length - 1] || null;
    const lectures = this.studyToolsSettings().lectureLog.lectures.filter((lecture) => {
      if (!matches(lecture.course)) return false;
      const topics = Array.isArray(lecture.topicList) ? lecture.topicList : studyTools.parseTopicList(lecture.topics);
      const topicMatch = examTopics.length > 0 && topics.some((topic) => examTopics.includes(str(topic).trim().toLowerCase()));
      return topicMatch || !previousExam || (!!lecture.date && lecture.date > previousExam.date);
    });
    const readings = this.getReadingPlans().filter((reading) => !reading.course || matches(reading.course));
    const planner = this.studyWorkspaceSettings().lerntracker.plans.find((plan) => matches(plan.course));
    const plannerRemaining = planner
      ? (planner.topics || []).reduce((sum, topic) => sum + Math.max(0, (Number(topic.targetPasses) || Number(planner.targetPasses) || 1) - (Number(topic.passes) || 0)), 0)
      : 0;
    const assignments = this.getAssignments().filter((assignment) =>
      matches(assignment.course) &&
      assignment.open !== false &&
      assignment.done !== true &&
      assignment.type !== "exam" &&
      assignment.type !== "test" &&
      (!assignment.due || assignment.due <= exam.date)
    );
    return buildStudyPlan(
      { ...exam, summary: exam.title, dateKey: exam.date, course },
      questions,
      cards,
      { today: localDate(), examDate: exam.date, course, frq, totalTopics: registered ? registered.totalTopics : 0, lectures, readings, plannerRemaining, assignments }
    );
  }

  /** Rendered blocks register immediately; the startup index fills the rest. */
  rememberReadingPlan(parsed, ctx) {
    if (!parsed || !parsed.id) return null;
    if (!this._readingPlans) this._readingPlans = new Map();
    this._readingPlans.set(parsed.id, { ...parsed, sourcePath: ctx && ctx.sourcePath ? ctx.sourcePath : "" });
    return this._readingPlans.get(parsed.id);
  }

  /** Read `reading-plan` fences once so Today and plans work before a block renders. */
  async indexReadingPlans() {
    const files = this.app.vault && typeof this.app.vault.getMarkdownFiles === "function" ? this.app.vault.getMarkdownFiles() : [];
    const next = new Map();
    for (const file of files) {
      let text = "";
      try {
        text = await this.app.vault.cachedRead(file);
      } catch (e) {
        continue;
      }
      const pattern = /```reading-plan\b[^\n]*\n([\s\S]*?)```/gi;
      let match;
      while ((match = pattern.exec(text))) {
        const parsed = readingModel.parseReadingPlan(match[1]);
        if (parsed && parsed.valid) next.set(parsed.id, { ...parsed, sourcePath: file.path });
      }
    }
    this._readingPlans = next;
    return next.size;
  }

  getReadingPlans() {
    if (!this._readingPlans) return [];
    const progress = this.settings.reading && this.settings.reading.progress ? this.settings.reading.progress : {};
    const today = localDate();
    const rows = [];
    for (const parsed of this._readingPlans.values()) {
      if (!parsed || !parsed.valid) continue;
      const read = readingModel.readingProgress(parsed, progress);
      const plan = readingModel.planReading(parsed, { today, read });
      if (!plan.ok) continue;
      const status = readingModel.readingStatus(plan);
      rows.push({ ...parsed, ...status, sourcePath: parsed.sourcePath || "" });
    }
    return rows;
  }

  courseOverviewData(courseId) {
    const data = this.studyWorkspaceSettings();
    const settings = this.calendarSettings();
    const lectures = this.studyToolsSettings().lectureLog.lectures;
    const courses = studyWorkspace.courseDashboard(data.subjectManager.subjects, lectures, data.subjectManager.absences, data.courseHub.grades, { settings });
    const exams = this.getExams({ includePast: true, horizonDays: 3650 });
    const today = localDate();
    const nextExam = exams.find((exam) => exam.date >= today && courseIdentity.sameCourse(settings, exam.course, courseId));
    return courseOverview(courseId, {
      settings,
      today,
      courses,
      exams,
      studyPlan: nextExam ? this.buildExamPlan(nextExam) : null,
      lectures,
      readings: this.getReadingPlans(),
      assignments: this.getAssignments(),
      tasks: data.studyTasks.tasks,
      plans: data.lerntracker.plans,
    });
  }

  openCourseOverview(courseId) {
    new CourseOverviewModal(this.app, this, courseId).open();
  }

  /** The calendar event behind a class note, read from its durable frontmatter. */
  classNoteEvent(file) {
    const target = file || this.app.workspace.getActiveFile();
    if (!target) return null;
    const fm = (this.app.metadataCache.getFileCache(target) || {}).frontmatter || {};
    const uid = str(fm.calendar_uid).trim();
    const date = str(fm.calendar_date).slice(0, 10);
    if (!uid || !date) return null;
    return {
      uid,
      dateKey: date,
      course: str(fm.course).trim(),
      summary: str(fm.calendar_title || fm.title || target.basename).trim(),
      description: str(fm.topics).trim(),
    };
  }

  /** Mark a class note attended/absent without opening the calendar. */
  async logClassNoteAttendance(file, attended) {
    const event = this.classNoteEvent(file);
    if (!event) {
      new Notice("This note is not linked to a calendar class.");
      return null;
    }
    const result = await this.logCalendarLecture(event, event.dateKey, attended);
    new Notice(attended ? `Marked ${event.summary || "class"} attended.` : `Marked ${event.summary || "class"} absent.`);
    return result;
  }

  /** Idempotent attendance action used by calendar events and class notes. */
  async logCalendarLecture(event, key, attended) {
    if (!event) return null;
    const date = String(key || event.dateKey || "").slice(0, 10);
    if (!date) return null;
    const course = str(event.course).trim() || cleanSubjectTitle(event.summary) || str(event.summary).trim();
    if (!course) return null;
    const id = `calendar-${hashString(`${event.uid || event.summary}|${date}`)}`;
    const absenceId = `${id}-absence`;
    const current = this.studyToolsSettings();
    const workspace = this.studyWorkspaceSettings();
    const note = this.findCalendarNote(event, date);
    let lectures = current.lectureLog.lectures.filter((lecture) => lecture.id !== id);
    let absences = workspace.subjectManager.absences.filter((absence) => absence.id !== absenceId);
    if (attended) {
      const lecture = studyTools.normalizeLecture({
        id,
        course,
        date,
        title: str(event.summary).trim() || "Class",
        topics: str(event.description || "").trim(),
        notePath: note ? note.path : "",
        createdAt: Date.now(),
      });
      if (lecture) lectures = this.appendCapped(lectures, lecture, studyTools.MAX_LECTURES, "Lecture log");
    } else {
      const absence = studyWorkspace.normalizeAbsence({ id: absenceId, subject: course, date, reason: "Calendar class" });
      if (absence) absences = this.appendCapped(absences, absence, studyWorkspace.MAX_ABSENCES, "Absence log");
    }
    this.settings.lectureLog = { ...current.lectureLog, lectures };
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager({ ...workspace.subjectManager, absences });
    await this.save();
    this.refreshViews();
    this.refreshCalendarViews();
    return attended ? { id, course, date, attended: true } : { id: absenceId, course, date, attended: false };
  }

  /**
   * Optional after-class prompt: today's classes that have ended and have no
   * lecture or absence row yet. The setting is off by default.
   */
  attendancePrompt(now) {
    const current = this.studyToolsSettings();
    if (!this.calendarEnabled() || !current.lectureLog.afterClassPrompt) return [];
    const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
    const today = localDate(at);
    const overrides = (this.settings.calendar && this.settings.calendar.examOverrides) || {};
    const lectures = current.lectureLog.lectures;
    const absences = this.studyWorkspaceSettings().subjectManager.absences;
    const seen = new Set([...lectures.map((row) => row.id), ...absences.map((row) => row.id)]);
    const rows = [];
    for (const event of this.calendarEvents(at)) {
      if (!event || event.dateKey !== today || event.termReadingWeek) continue;
      if (isExamEvent(event, overrides)) continue;
      if (!(event.dtend instanceof Date) || isNaN(event.dtend.getTime()) || event.dtend >= at) continue;
      const id = `calendar-${hashString(`${event.uid || event.summary}|${today}`)}`;
      if (seen.has(id) || seen.has(`${id}-absence`)) continue;
      rows.push({
        id,
        event,
        date: today,
        course: str(event.course).trim() || cleanSubjectTitle(event.summary) || str(event.summary).trim(),
        title: str(event.summary).trim() || "Class",
        end: event.dtend,
      });
    }
    return rows.slice(0, 5);
  }

  async startStudyPlan(plan, cram) {
    if (this.moduleOff("mcq")) return null;
    if (!plan) return null;
    const pool = cram ? plan.cramPool : plan.pool;
    if (!pool || !pool.length) {
      new Notice("There are no questions in this study plan yet.");
      return null;
    }
    return this.startQuickPractice({
      minutes: 10,
      pool,
      mode: cram ? "cram" : "smart",
      label: `${cram ? "Cram" : "Study plan"}: ${plan.course}`,
    });
  }

  async startNextExamPlan() {
    const plan = this.studyPlan();
    if (!plan) {
      new Notice("Add a matching course exam and question notes to build a study plan.");
      return null;
    }
    return this.startStudyPlan(plan, false);
  }

  /** A free period from the calendar becomes a one-tap Quick Practice session. */
  openStudySlot(slots) {
    if (this.moduleOff("calendar")) return;
    const list = (Array.isArray(slots) ? slots : []).filter((slot) => slot && slot.minutes > 0);
    if (!list.length) {
      new Notice("There is no free period long enough for a study session.");
      return;
    }
    new StudySlotModal(this.app, this, list).open();
  }

  /** Pool for the study-slot chooser; filters are applied without changing saved settings. */
  quickPracticePool(filter, course) {
    const questions = this.getQuestions();
    if (filter === "due") return questions.filter((q) => isDue(q.fm, localDate()));
    if (filter === "course" && course) {
      const key = subjectKey(cleanSubjectTitle(course));
      return questions.filter((q) => {
        if (!isStudyable(q.fm, localDate())) return false;
        const values = [q.fm.course, q.fm.test].map((v) => subjectKey(cleanSubjectTitle(v)));
        return values.includes(key);
      });
    }
    return this.filtered(questions);
  }

  async startQuickPractice(options) {
    const opts = options || {};
    const view = await this.activateView();
    if (!view || !view.startQuick) {
      new Notice("Could not open the practice view.");
      return null;
    }
    const kind = opts.kind === "count" ? "count" : "time";
    const defaults = this.settings.quickDefaults || {};
    const requested = kind === "count" ? opts.count : opts.minutes;
    const fallback = kind === "count" ? defaults.count : defaults.minutes;
    const value = Math.max(1, Math.round(Number(requested) || Number(fallback) || 5));
    await view.startQuick(kind, value, { pool: opts.pool, mode: opts.mode, label: opts.label });
    return view;
  }

  /**
   * A home-screen shortcut: obsidian://mcq-tracker-quick?minutes=5
   * or ?count=10, optionally with course=<course>. It opens the same Quick
   * Practice view, scheduler and saved queue as the ribbon command; invalid
   * values are refused with a Notice instead of starting a different session.
   */
  async openQuickPracticeLink(params) {
    if (this.moduleOff("mcq")) {
      new Notice("MCQ Tracker is turned off. Turn it on under Settings, Global, Modules.");
      return null;
    }
    const parsed = parseQuickPracticeUri(params);
    if (parsed.error) {
      new Notice(`Quick Practice link: ${parsed.error}`, 6000);
      return null;
    }
    const kind = parsed.kind === "count" ? "count" : "time";
    const defaults = this.settings.quickDefaults || {};
    const fallback = kind === "count" ? defaults.count : defaults.minutes;
    const value = parsed.value || fallback || 5;
    let pool;
    if (parsed.course) {
      pool = this.quickPracticePool("course", parsed.course);
      if (!pool.length) {
        new Notice(`No questions match course "${parsed.course}".`, 6000);
        return null;
      }
    }
    return this.startQuickPractice({
      kind,
      minutes: kind === "time" ? value : undefined,
      count: kind === "count" ? value : undefined,
      pool,
      label: parsed.course ? `course "${parsed.course}"` : "",
    });
  }

  /* ---- local reminder (operating-system delivery is opt-in; no network) */

  setupReminder() {
    if (typeof this.addStatusBarItem !== "function") return;
    this.reminderEl = this.addStatusBarItem();
    this.reminderEl.addClass("qt-reminder");
    this.reminderEl.addEventListener("click", () => this.activateToday());
    this.refreshReminder();
    this.registerInterval(activeWindow.setInterval(() => this.refreshReminder(), 60000));
  }

  reminderCounts() {
    const today = localDate();
    const questions = this.mcqEnabled() ? this.getQuestions() : [];
    const visible = questions.filter((q) => isStudyable(q.fm, today));
    const daily = normalizeDailyQuiz(this.settings.dailyQuiz);
    return {
      due: visible.filter((q) => isDue(q.fm, today)).length,
      fresh: visible.filter((q) => !Number(q.fm.attempts)).length,
      daily: daily.enabled && !dailyDone(daily, today),
    };
  }

  /** Read-only reminder state for Today and the status bar. */
  reminderInfo(now) {
    const counts = this.reminderCounts();
    return computeReminderState(this.settings.reminder, { now, due: counts.due, fresh: counts.fresh, daily: counts.daily });
  }

  /** Ask the operating system for notification permission (user-triggered only). */
  async requestOsNotifications() {
    const result = await requestOsPermission({ window: activeWindow });
    new Notice(result.reason);
    return result;
  }

  refreshReminder() {
    if (!this.reminderEl) return;
    const info = this.reminderInfo();
    if (!info.enabled || !info.text || info.dismissed) {
      this.reminderEl.setText(info.enabled ? "MCQ" : "");
      this.reminderEl.toggleClass("qt-hidden", !info.enabled);
      return;
    }
    this.reminderEl.toggleClass("qt-hidden", false);
    this.reminderEl.setText(`MCQ: ${info.text}`);
    this.reminderEl.setAttr("aria-label", `${info.text}. Open Today.`);
    if (info.freshNudge) {
      if (this.settings.reminder && this.settings.reminder.osNotifications === true) {
        showReminderNotification({ window: activeWindow }, info);
      }
      this.settings.reminder = markReminderShown(this.settings.reminder);
      this.save().catch(() => {});
    }
  }

  async dismissTodayReminder() {
    this.settings.reminder = dismissReminder(this.settings.reminder);
    await this.save();
    this.refreshReminder();
    new Notice("Reminder dismissed until tomorrow.");
  }

  /** Start the opt-in daily quiz, reusing today's saved set when it is still valid. */
  async startDailyQuiz() {
    if (this.moduleOff("mcq")) return null;
    const cfg = normalizeDailyQuiz(this.settings.dailyQuiz);
    if (!cfg.enabled) {
      new Notice("Daily quiz is off. Turn it on in Settings, MCQ Tracker, Daily quiz.");
      return null;
    }
    const today = localDate();
    const questions = this.getQuestions();
    const adaptive = adaptiveDailyCount(questions, cfg, { today, settings: this.settings.quickAdaptive });
    const picked = pickDailyQuiz(questions, { ...cfg, count: adaptive.value }, today);
    this.settings.dailyQuiz = picked.state;
    await this.save();
    if (!picked.questions.length) {
      new Notice("No questions match the daily quiz folders.");
      return null;
    }
    const view = await this.activateView();
    if (!view || !view.startDailySession) {
      new Notice("Could not open the practice view.");
      return null;
    }
    await view.startDailySession(picked.questions.map((q) => q.file.path), today);
    return view;
  }

  /** Called when the last card in a daily quiz is answered; one completion per day. */
  async completeDailyQuiz(date) {
    const before = normalizeDailyQuiz(this.settings.dailyQuiz);
    const after = recordDailyCompletion(before, date || localDate());
    this.settings.dailyQuiz = after;
    await this.save();
    this.refreshViews();
    return after;
  }

  /** Write one summary row per note and one row per stored attempt, for outside analysis. */
  async exportResultsCsv() {
    const includeMcq = !this.moduleOff("mcq");
    const includeCards = !this.moduleOff("cards");
    if (!includeMcq && !includeCards) {
      new Notice("Turn on MCQ Tracker or Cards before exporting results.");
      return null;
    }
    const questions = includeMcq ? this.getQuestions() : [];
    const cards = includeCards ? this.getCards() : [];
    if (!questions.length && !cards.length) {
      new Notice("There are no practice questions or cards to export yet.");
      return null;
    }
    const today = localDate();
    const names = resultFileNames(today);
    const summary = buildResultsCsv(questions, cards, { today });
    const attempts = buildAttemptsCsv(questions, cards);
    const write = async (path, text) => {
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) await this.app.vault.modify(existing, text);
      else await this.app.vault.create(path, text);
    };
    try {
      await write(names.summary, summary.text);
      await write(names.attempts, attempts.text);
    } catch (e) {
      new Notice(`Could not write the CSV files: ${str(e && e.message ? e.message : e)}`, 7000);
      return null;
    }
    new Notice(`Exported ${summary.rows.length} notes and ${attempts.rows.length} attempts to ${names.summary} and ${names.attempts}.`, 7000);
    return { paths: [names.summary, names.attempts], summary, attempts };
  }

  /** Write the current filter as a Markdown practice sheet with no answer key or rationale. */
  async exportPracticeSheet() {
    if (this.moduleOff("mcq")) {
      new Notice("Turn on MCQ Tracker before exporting a practice sheet.");
      return null;
    }
    const questions = this.filtered(this.getQuestions());
    if (!questions.length) {
      new Notice("No questions match the current filter.");
      return null;
    }
    const records = [];
    for (const question of questions) {
      try {
        records.push({ file: question.file, fm: question.fm, text: await this.app.vault.cachedRead(question.file) });
      } catch (e) {
        // Skip an unreadable note; the rest of the sheet is still useful.
      }
    }
    if (!records.length) {
      new Notice("Could not read any of the filtered questions.");
      return null;
    }
    const today = localDate();
    const base = practiceSheetFileName(today);
    let path = base;
    for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) path = base.replace(/\.md$/i, ` ${n}.md`);
    const sheet = buildPracticeSheet(records, { date: today });
    try {
      await this.app.vault.create(path, sheet.text);
    } catch (e) {
      new Notice(`Could not write the practice sheet: ${str(e && e.message ? e.message : e)}`, 7000);
      return null;
    }
    new Notice(`Exported ${sheet.count} question${sheet.count === 1 ? "" : "s"} to ${path}.`, 7000);
    return { path, count: sheet.count };
  }

  /** Write every question due today as a printable sheet with its last recorded mistake. */
  async exportReviewSheet() {
    if (this.moduleOff("mcq")) {
      new Notice("Turn on MCQ Tracker before exporting a review sheet.");
      return null;
    }
    const today = localDate();
    const due = this.getQuestions().filter((question) => isDue(question.fm, today));
    if (!due.length) {
      new Notice("No questions are due for review.");
      return null;
    }
    const records = [];
    for (const question of due) {
      try {
        records.push({ file: question.file, fm: question.fm, text: await this.app.vault.cachedRead(question.file) });
      } catch (e) {
        // Skip an unreadable note; the rest of the sheet is still useful.
      }
    }
    if (!records.length) {
      new Notice("Could not read any of the due questions.");
      return null;
    }
    const base = reviewSheetFileName(today);
    let path = base;
    for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) path = base.replace(/\.md$/i, ` ${n}.md`);
    const sheet = buildReviewSheet(records, { date: today });
    try {
      await this.app.vault.create(path, sheet.text);
    } catch (e) {
      new Notice(`Could not write the review sheet: ${str(e && e.message ? e.message : e)}`, 7000);
      return null;
    }
    new Notice(`Exported ${sheet.count} due question${sheet.count === 1 ? "" : "s"} to ${path}.`, 7000);
    return { path, count: sheet.count };
  }

  async exportCalendarIcs() {
    if (this.moduleOff("calendar")) return;
    const events = this.calendarEvents().filter((event) => !event.termReadingWeek && !event.foreign);
    if (!events.length) {
      new Notice("There are no visible classes or exams to export.");
      return;
    }
    const target = "schedule-export.ics";
    const text = exportIcs(events, { calendarName: "MCQ Tracker calendar", now: new Date() });
    const existing = this.app.vault.getAbstractFileByPath(target);
    if (existing instanceof TFile) await this.app.vault.modify(existing, text);
    else await this.app.vault.create(target, text);
    new Notice(`Exported ${events.length} events to ${target}.`);
  }

  /* ---- questions */

  getQuestions() {
    const folder = this.settings.questionFolder.trim().replace(/^\/+|\/+$/g, "");
    const out = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (folder && file.path !== folder && !file.path.startsWith(folder + "/")) continue;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (fm && fm.question_id !== undefined && fm.question_id !== null && fm.question_id !== "") {
        out.push({ file, fm });
      }
    }
    return out;
  }

  filtered(questions, options) {
    const opts = options || {};
    const includeHidden = opts.includeHidden === true;
    const today = opts.today || localDate();
    const only = str(opts.practicePath !== undefined ? opts.practicePath : this.settings.practicePath).trim();
    return questions.filter(
      (q) =>
        (includeHidden || isStudyable(q.fm, today)) &&
        (!only || q.file.path === only) &&
        matchSets(q.fm, [this.settings.filters, ...(this.settings.moreSets || [])], q.file.path)
    );
  }

  /* ---- cards */

  /** Every card or vocabulary note, with its effective deck and course. */
  getCards() {
    const out = [];
    const plain = this.plainCardIndex || new Map();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (isCardNote(fm) || plain.has(file.path)) out.push(resolveCard(file, fm || {}, this.settings));
    }
    return out;
  }

  /**
   * Rebuild the opt-in index of plain notes that have a front/back structure.
   * The index keeps getCards() synchronous; plain notes stay ordinary notes
   * and receive tracking properties only when they are reviewed.
   */
  async refreshPlainCards(options) {
    const config = normalizePlainCards(this.settings.cards.plainMarkdown);
    const found = new Map();
    if (config.enabled && config.folder) {
      for (const file of this.app.vault.getMarkdownFiles()) {
        if (!isPlainPath(file.path, config.folder)) continue;
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
        if (isCardNote(fm) || (fm.question_id !== undefined && fm.question_id !== null && fm.question_id !== "")) continue;
        try {
          const parsed = inferPlainCard(await this.app.vault.cachedRead(file));
          if (parsed) found.set(file.path, parsed);
        } catch (e) {
          /* a folder scan must not break the Cards view */
        }
      }
    }
    this.plainCardIndex = found;
    if (options && options.refresh) this.refreshViews();
    return found.size;
  }

  filteredCards(options) {
    const opts = options || {};
    const deck = String(opts.deck || "").trim().toLowerCase();
    const course = String(opts.course || "").trim().toLowerCase();
    const includeHidden = opts.includeHidden === true;
    const today = opts.today || localDate();
    return this.getCards().filter((card) => {
      if (!includeHidden && !isStudyable(card.fm, today)) return false;
      if (deck && deck !== "all" && card.deck.toLowerCase() !== deck) return false;
      if (course && course !== "all" && card.course.toLowerCase() !== course) return false;
      return true;
    });
  }

  cardDecks() {
    return deckSummary(this.getCards(), this.settings, localDate());
  }

  /** Write one card review through the same scheduler and offline outbox as questions. */
  recordCardReview(card, grade, seconds, extra) {
    const opts = extra || {};
    const now = opts.now instanceof Date && !isNaN(opts.now.getTime()) ? opts.now : new Date();
    return this.recordAttempt(card.file, {
      ...cardAttempt(grade, seconds),
      ...opts,
      deck: opts.deck || card.deck || (card.fm && card.fm.deck) || "",
      course: opts.course || card.course || (card.fm && card.fm.course) || "",
      reviewUpdated: new Date().toISOString(),
      sameDayReviews: this.settings.cards.sameDayReviews === true,
      adaptiveFrequency: this.settings.cards.adaptiveFrequency === true,
      cram: opts.cram === true,
      now,
    });
  }

  /** Create one client per operation so a changed URL/password is picked up immediately. */
  couchDbClient() {
    const config = normalizeCouchDb(this.settings.cards.couchdb);
    const password = secretKeys.resolveSecretValue(
      this.app,
      config.passwordSecret || COUCHDB_PASSWORD_SECRET,
      config.password
    );
    return new CouchDbClient(config, {
      password,
      request: typeof this.couchDbRequest === "function" ? this.couchDbRequest : requestUrl,
    });
  }

  /** Check the server and database before the user relies on sync. */
  async testCouchDbConnection() {
    if (this.moduleOff("cards")) return { ok: false, error: "Turn on Cards first." };
    try {
      await this.couchDbClient().ensureDatabase();
      new Notice("CouchDB connection works and the database is ready.");
      return { ok: true };
    } catch (e) {
      const message = couchErrorMessage(e);
      this.settings.cards.couchdb = { ...normalizeCouchDb(this.settings.cards.couchdb), lastError: message };
      await this.save();
      new Notice(`CouchDB: ${message}`, 8000);
      return { ok: false, error: message };
    }
  }

  /**
   * Sync card review state. The newest review wins the schedule, histories are
   * unioned, and note text is never uploaded or overwritten.
   */
  async syncCardsCouchDb() {
    if (this.moduleOff("cards")) return { pulled: 0, pushed: 0, error: "Turn on Cards first." };
    let config = normalizeCouchDb(this.settings.cards.couchdb);
    if (!config.enabled) {
      new Notice("Turn on CouchDB sync in Settings → Cards → Sync first.");
      return { pulled: 0, pushed: 0, error: "CouchDB sync is off." };
    }
    const client = this.couchDbClient();
    let pulled = 0;
    let pushed = 0;
    let conflicts = 0;
    let remoteOnly = 0;
    try {
      await client.ensureDatabase();
      const remote = await client.allCards();
      const byId = new Map();
      for (const doc of remote) {
        const id = String((doc.state && doc.state.card_id) || "").trim();
        if (id) byId.set(id, doc);
      }
      const localIds = new Set();
      for (const card of this.getCards()) {
        const id = String((card.fm && card.fm.card_id) || "").trim();
        if (!id) continue;
        localIds.add(id);
        const local = cardSyncState(card.fm);
        const doc = byId.get(id);
        if (!doc) {
          await client.putCard(id, local, "");
          pushed++;
          continue;
        }
        const merged = mergeCardSyncStates(local, doc.state, this.settings.historyLimit);
        if (!sameState(merged, local)) {
          await this.app.fileManager.processFrontMatter(card.file, (fm) => applyCardSyncState(fm, merged));
          pulled++;
        }
        if (!sameState(merged, doc.state) || stateTimestamp(merged) !== stateTimestamp(doc.state)) {
          try {
            await client.putCard(id, merged, doc.rev);
            pushed++;
          } catch (e) {
            // A second device wrote between our read and write. Keep the local
            // note and retry the merge on the next manual sync.
            if (/HTTP 409\b/.test(couchErrorMessage(e))) conflicts++;
            else throw e;
          }
        }
      }
      for (const id of byId.keys()) if (!localIds.has(id)) remoteOnly++;
      config = { ...config, lastSync: new Date().toISOString(), lastError: "" };
      this.settings.cards.couchdb = config;
      await this.save();
      this.refreshViews();
      new Notice(`CouchDB sync: ${pulled} pulled, ${pushed} pushed${conflicts ? `, ${conflicts} conflict${conflicts === 1 ? "" : "s"} left for next sync` : ""}.`);
      return { pulled, pushed, conflicts, remoteOnly };
    } catch (e) {
      const message = couchErrorMessage(e);
      this.settings.cards.couchdb = { ...config, lastError: message };
      await this.save();
      new Notice(`CouchDB sync failed: ${message}`, 9000);
      return { pulled, pushed, conflicts, remoteOnly, error: message };
    }
  }

  /* ---- optional AI second opinion for typed card answers */

  cardGradeQueueKey() {
    return "question-tracker-pending-card-grades";
  }

  readPendingCardGrades() {
    if (Array.isArray(this._pendingCardGrades)) return this._pendingCardGrades;
    let list = [];
    try {
      list = unpackPendingGrades(this.app.loadLocalStorage(this.cardGradeQueueKey()));
    } catch (e) {
      list = [];
    }
    this._pendingCardGrades = list;
    return list;
  }

  writePendingCardGrades(list) {
    this._pendingCardGrades = Array.isArray(list) ? list : [];
    try {
      this.app.saveLocalStorage(this.cardGradeQueueKey(), packPendingGrades(this._pendingCardGrades));
    } catch (e) {
      // Keep the in-memory queue for this session if device storage is unavailable.
    }
  }

  cardGradeLocale() {
    let language = "";
    try {
      if (typeof navigator !== "undefined" && navigator && navigator.language) language = navigator.language;
    } catch (e) {
      /* no navigator in this host */
    }
    if (!language) {
      try {
        const doc = typeof activeDocument !== "undefined" ? activeDocument : null;
        const lang = doc && doc.documentElement && doc.documentElement.lang;
        if (lang) language = lang;
      } catch (e) {
        /* no document in this host */
      }
    }
    return str(language).slice(0, 40);
  }

  cardGradeModel() {
    try {
      return str(this.aiModelFor ? this.aiModelFor("cardGrading") : "").slice(0, 200);
    } catch (e) {
      return "";
    }
  }

  /** Queue one attempt, replacing an older pending answer for the same card. */
  queueCardGrade(card, typed, strictness, options) {
    const opts = options || {};
    const id = str(opts.id) || newGradeId();
    const withoutSameCard = this.readPendingCardGrades().filter((item) => item.path !== card.file.path);
    const dropped = withoutSameCard.length >= MAX_PENDING;
    const entry = {
      id,
      path: card.file.path,
      cardId: String(card.fm && card.fm.card_id ? card.fm.card_id : ""),
      front: card.body && card.body.front ? card.body.front : "",
      expected: card.body && card.body.back ? card.body.back : "",
      typed: String(typed || ""),
      strictness: strictness || "standard",
      locale: str(opts.locale) || this.cardGradeLocale(),
      model: str(opts.model) || this.cardGradeModel(),
      createdAt: new Date().toISOString(),
    };
    this.writePendingCardGrades(enqueuePendingGrade(withoutSameCard, entry));
    if (dropped) {
      new Notice("The pending AI grade queue was full, so the oldest answer was dropped. Grade or discard pending answers to keep room.", 8000);
    }
    return id;
  }

  discardPendingCardGrade(id) {
    if (!id) return;
    this.writePendingCardGrades(removePendingGrade(this.readPendingCardGrades(), id));
  }

  pendingCardGrades() {
    return this.readPendingCardGrades();
  }

  /**
   * One request path for every AI feature and both backends. It checks the
   * feature's capability, both request caps and the per-feature model, counts
   * the request before it is sent, then lets the provider client do the call.
   */
  async aiChat(system, messages, opts) {
    const o = opts || {};
    const feature = aiService.normalizeFeatureId(o.feature);
    const ai = this.settings.ai;
    if (!ai.enabled) throw new Error("Turn on AI features in the plugin settings first.");
    const support = aiService.featureSupport(feature, this.backend());
    if (!support.ok) throw new Error(support.reason);
    const can = this.aiCanSpend(feature);
    if (!can.ok) throw new Error(can.reason);
    const maxTokens = aiService.clampMaxTokens(ai, o.maxTokens);
    const model = str(o.model).trim().slice(0, 200) || this.aiModelFor(feature);
    const tokens = aiService.estimateRequestTokens(system, messages, o.images);
    this.spendAiRequest(feature, tokens);
    const call = async () => {
      if (this.backend() === "opencode") {
        await this.ensureOpenCode();
        const oc = this.openCode();
        const session = await oc.createSession("MCQ Tracker AI");
        const body = { parts: [{ type: "text", text: (Array.isArray(messages) ? messages : []).map((m) => str(m && m.content)).join("\n\n") }], system };
        const parsed = modelFromString(model);
        if (parsed) body.model = parsed;
        await oc.send(session.id, body);
        const turns = partsToTurns(await oc.messages(session.id));
        const last = [...turns].reverse().find((turn) => turn.role === "assistant");
        const text = last ? last.texts.join("\n").trim() : "";
        if (!text) throw new Error("OpenCode returned an empty reply.");
        return text;
      }
      const client = new ApiClient(ai, this.app, { model });
      if (typeof o.onDelta === "function") {
        return client.streamChat(system, Array.isArray(messages) ? messages : [], { ...o, maxTokens });
      }
      return client.chat(system, Array.isArray(messages) ? messages : [], { ...o, maxTokens });
    };
    return aiService.withRetry(call, {
      // A card-grade timeout is ambiguous and may already have been billed, so
      // that path opts out and leaves the attempt in the explicit retry queue.
      attempts: o.retry === false ? 1 : undefined,
      onRetry: () => {
        const retry = this.aiCanSpend(feature);
        if (!retry.ok) return false;
        this.spendAiRequest(feature, tokens);
        return true;
      },
    });
  }

  /** One-message convenience wrapper used by generation, verification and grading. */
  async aiComplete(system, user, opts) {
    return this.aiChat(system, [{ role: "user", content: user }], opts);
  }

  /** Renders the chosen pages once so the vision model can read the handwriting. */
  async renderLatexPages(bytes, spec) {
    return renderPdfPagesAsPng(bytes, spec, null, 2);
  }

  /** Converts chosen PDF pages into one LaTeX note through the configured vision model. */
  async convertPdfToLatex(pdfPath, spec) {
    if (this.moduleOff("mcq")) return null;
    const path = String(pdfPath || "").trim();
    const file = path ? this.app.vault.getAbstractFileByPath(path) : null;
    if (!file || !/\.pdf$/i.test(path)) throw new Error("Open a PDF first.");
    if (!(this.settings.ai && this.settings.ai.enabled)) throw new Error("Turn on AI features before converting handwriting.");
    const rendered = await this.renderLatexPages(await this.app.vault.readBinary(file), String(spec || "1").trim() || "1");
    const pages = [];
    for (const page of rendered.pages || []) {
      const data = pdfLatex.pngBase64(page.png);
      if (!data) continue;
      const reply = await this.aiVision(pdfLatex.LATEX_SYSTEM, pdfLatex.latexPrompt(page.n), [{ data, mime: "image/png" }], { feature: "ocr" });
      pages.push({ n: page.n, text: reply });
    }
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    const stem = pdfLatex.latexNotePath(path);
    const note = pdfLatex.buildLatexNote(pages, {
      title: path.split("/").pop().replace(/\.pdf$/i, ""),
      sourcePath: path,
      model: this.aiModelFor ? this.aiModelFor("ocr") : "",
      date: new Date().toISOString().slice(0, 10),
    });
    let target = folder + stem;
    for (let n = 2; n < 50 && this.app.vault.getAbstractFileByPath(target); n++) target = folder + stem.replace(/\.md$/i, " " + n + ".md");
    await this.app.vault.create(target, note.text);
    return { path: target, pages: note.pages };
  }

  /** Prompts for a page range and converts the active PDF. */
  convertActivePdfLatex() {
    const active = this.app.workspace.getActiveFile();
    if (!active || !/\.pdf$/i.test(active.path)) {
      new Notice("Open a PDF first.");
      return;
    }
    new NameModal(this.app, "Pages to convert (for example 1-3)", "1", async (spec) => {
      try {
        const result = await this.convertPdfToLatex(active.path, spec);
        if (result) new Notice("Wrote " + result.path + ".");
      } catch (e) {
        new Notice(e && e.message ? e.message : String(e));
      }
    }).open();
  }

  /** A note as a map: Markmind frontmatter when present, headings otherwise. */
  async mindMapTree(path) {
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("Open a Markdown note first.");
    const text = await this.app.vault.cachedRead(file);
    const root = mindmap.isMarkmind(text) ? mindmap.parseMarkmind(text).root : mindmap.mindmapFromMarkdown(text);
    return { path: file.path, root };
  }

  /** Applies one map edit and writes the Markmind shape back to the note. */
  async mindMapEdit(path, action, args) {
    const a = args && typeof args === "object" ? args : {};
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("Open a Markdown note first.");
    const { root } = await this.mindMapTree(path);
    let op = null;
    if (action === "add") op = mindmap.addChild(root, a.parent, a.text);
    else if (action === "rename") op = mindmap.renameNode(root, a.from, a.to);
    else if (action === "remove") op = mindmap.removeNode(root, a.text);
    else if (action === "move") op = mindmap.moveNode(root, a.text, a.parent);
    else throw new Error("Unknown mind-map action.");
    if (!op || !op.ok) throw new Error(op && op.message ? op.message : "That node is not in this map.");
    await this.app.vault.modify(file, mindmap.markmindMarkdown(op.tree));
    return { path: file.path, root: op.tree };
  }

  /** Two prompts for one map edit, with a notice when the edit is refused. */
  promptMindMap(action) {
    const active = this.app.workspace.getActiveFile();
    if (!active || !/\.md$/i.test(active.path)) {
      new Notice("Open a Markdown note first.");
      return;
    }
    const ask = (title, initial, cb) => new NameModal(this.app, title, initial, cb).open();
    const done = (args) => this.mindMapEdit(active.path, action, args)
      .then(() => new Notice("Saved the mind map."))
      .catch((e) => new Notice(e && e.message ? e.message : String(e)));
    if (action === "add") ask("Parent node", "", (parent) => ask("New child", "", (text) => done({ parent, text })));
    else if (action === "rename") ask("Node to rename", "", (from) => ask("New text", from, (to) => done({ from, to })));
    else if (action === "remove") ask("Node to remove", "", (text) => done({ text }));
    else if (action === "move") ask("Node to move", "", (text) => ask("New parent", "", (parent) => done({ text, parent })));
  }

  /** Writes a Markmind note beside this one from its headings and lists. */
  async mindMapFromNote() {
    const active = this.app.workspace.getActiveFile();
    if (!active || !/\.md$/i.test(active.path)) {
      new Notice("Open a Markdown note first.");
      return null;
    }
    const root = mindmap.mindmapFromMarkdown(await this.app.vault.cachedRead(active));
    const target = active.path.replace(/\.md$/i, "") + " (mind map).md";
    if (this.app.vault.getAbstractFileByPath(target)) {
      new Notice(target + " already exists.");
      return null;
    }
    await this.app.vault.create(target, mindmap.markmindMarkdown(root));
    new Notice("Wrote " + target + ".");
    return target;
  }

  /** Opt-in image request for vision work. Only Direct AI can receive images. */
  async aiVision(system, prompt, images, opts) {
    const o = opts || {};
    const feature = aiService.normalizeFeatureId(o.feature || "ocr");
    const { feature: _ignored, ...rest } = o;
    const ai = this.settings.ai;
    if (!ai.enabled) throw new Error("Turn on AI features in the plugin settings first.");
    const support = aiService.featureSupport(feature, this.backend());
    if (!support.ok) throw new Error(support.reason);
    const can = this.aiCanSpend(feature);
    if (!can.ok) throw new Error(can.reason);
    const maxTokens = aiService.clampMaxTokens(ai, rest.maxTokens);
    this.spendAiRequest(feature, aiService.estimateRequestTokens(system, [{ content: prompt }], images));
    return new ApiClient(ai, this.app, { model: this.aiModelFor(feature) }).vision(system, prompt, images, { ...rest, maxTokens });
  }

  cardGradeClient() {
    return {
      chat: (system, messages, opts) =>
        this.aiComplete(system, messages && messages[0] ? messages[0].content : "", {
          ...(opts || {}),
          feature: "cardGrading",
          retry: false,
        }),
    };
  }

  gradeCardWithAi(card, typed, strictness) {
    return gradeWithAi(this.cardGradeClient(), { front: card.body && card.body.front, expected: card.body && card.body.back, typed, strictness });
  }

  /**
   * Replay the device-local card-grade queue oldest first. One pending attempt
   * becomes exactly one recorded review, and a changed card is flagged rather
   * than silently graded as if it still had its old text.
   */
  flushPendingCardGrades(options) {
    if (this._pendingCardGradeFlush) return this._pendingCardGradeFlush;
    if (!this.settings.ai.enabled || !this.settings.cards.aiGrading) {
      return Promise.resolve({ graded: 0, stale: 0, skipped: 0, results: [], remaining: this.readPendingCardGrades().length, disabled: true });
    }
    const only = str(options && options.id);
    this._pendingCardGradeFlush = (async () => {
      const pending = this.readPendingCardGrades();
      const batch = (only ? pending.filter((item) => item.id === only) : pending).slice(0, MAX_GRADE_BATCH);
      let graded = 0;
      let stale = 0;
      let skipped = 0;
      const results = [];
      const drop = (id) => this.writePendingCardGrades(removePendingGrade(this.readPendingCardGrades(), id));
      for (const entry of batch) {
        // A discard or self-grade while the request was in flight wins.
        if (!this.readPendingCardGrades().some((item) => item.id === entry.id)) {
          skipped++;
          continue;
        }
        const file = this.app.vault.getAbstractFileByPath(entry.path);
        const card = this.getCards().find((item) => item.file.path === entry.path);
        if (!(file instanceof TFile) || !card) {
          drop(entry.id);
          skipped++;
          continue;
        }
        const cachedFm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
        if (str(cachedFm.grade_attempt_id) === entry.id) {
          drop(entry.id);
          skipped++;
          continue;
        }
        let ai;
        try {
          ai = await gradeWithAi(this.cardGradeClient(), entry);
        } catch (e) {
          break; // offline, over budget, low confidence or provider error: keep it pending
        }
        if (!this.readPendingCardGrades().some((item) => item.id === entry.id)) {
          skipped++;
          continue;
        }
        let body = null;
        try {
          body = parseCardBody(await this.app.vault.cachedRead(file), card.fm);
        } catch (e) {
          body = null;
        }
        const changed = !body || body.front !== entry.front || body.back !== entry.expected;
        const feedback = changed
          ? `${ai.reason} The card changed after this answer was queued; this grade uses the stored answer from that time.`.slice(0, 500)
          : ai.reason;
        try {
          await this.recordCardReview(card, ai.suggestedGrade, 0, {
            attemptId: entry.id,
            typedAnswer: entry.typed,
            verdict: ai.verdict,
            matchedBy: ai.matchedBy,
            verdictOverride: false,
            gradedBy: "ai",
            gradeStatus: "graded",
            gradeConfidence: ai.confidence,
            gradeFeedback: feedback,
            gradeModel: this.cardGradeModel() || entry.model,
            gradeAttemptId: entry.id,
            gradeStale: changed,
            now: new Date(entry.createdAt),
          });
          drop(entry.id);
          graded++;
          if (changed) stale++;
          results.push({ id: entry.id, grade: ai.suggestedGrade, verdict: ai.verdict, stale: changed });
        } catch (e) {
          break; // keep this and the rest for the next explicit retry
        }
      }
      return { graded, stale, skipped, results, remaining: this.readPendingCardGrades().length, disabled: false };
    })().finally(() => {
      this._pendingCardGradeFlush = null;
    });
    return this._pendingCardGradeFlush;
  }

  /** Merged due list across the enabled modules. */
  getDueQueue(options) {
    const opts = options || {};
    const today = opts.today || localDate();
    const questions = this.mcqEnabled() ? this.getQuestions() : [];
    const cards = this.cardsEnabled() ? this.getCards() : [];
    const dailyCap = normalizeDailyCap(this.settings && this.settings.dueQueue && this.settings.dueQueue.dailyCap);
    return buildDueQueue(questions, cards, { today, limit: opts.limit, dailyCap });
  }

  /** Open a one-card review from the unified queue. */
  async reviewCard(card) {
    const view = await this.activateCards();
    if (view && view.reviewCard) return view.reviewCard(card);
    return null;
  }

  /** Review a specific set of cards (used by the due queue). */
  async reviewCards(cards) {
    const view = await this.activateCards();
    if (view && view.startReview) return view.startReview("all", cards);
    return null;
  }

  openDueQueue(onDone) {
    if (this.moduleOff("mcq") && this.moduleOff("cards")) {
      new Notice("Turn on MCQ Tracker or Cards to use the due queue.");
      return;
    }
    new DueQueueModal(this.app, this, onDone).open();
  }

  /** Open one interleaved session across due questions, cards and vocabulary. */
  openMixedReview(onDone) {
    if (this.moduleOff("mcq") || this.moduleOff("cards")) {
      new Notice("Mixed review needs both MCQ Tracker and Cards turned on. Use Quick Practice or Cards for a single-module session.");
      return null;
    }
    const dailyCap = normalizeDailyCap(this.settings && this.settings.dueQueue && this.settings.dueQueue.dailyCap);
    const queue = buildMixedQueue(this.getQuestions(), this.getCards(), {
      today: localDate(),
      limit: this.settings.cards.reviewLimit || 20,
      dailyCap,
    });
    if (!queue.items.length) {
      new Notice("Nothing is due across both modules yet.");
      return null;
    }
    const modal = new MixedReviewModal(this.app, this, { limit: this.settings.cards.reviewLimit || 20, dailyCap }, () => {
      this.refreshViews();
      if (onDone) onDone();
    });
    modal.open();
    return modal;
  }

  /** Create a card note. The deck's folder, course and the note's own properties stay readable. */
  async createCard(input) {
    if (this.moduleOff("cards")) return null;
    const data = input || {};
    const st = this.settings.cards;
    const deck = String(data.deck || st.defaultDeck || "General").trim() || "General";
    let cfg = deckConfig(this.settings, deck);
    if (!cfg) {
      const folder = String(data.deckFolder || "").trim().replace(/^\/+|\/+$/g, "");
      cfg = { name: deck, folder, course: String(data.deckCourse || "").trim() };
      st.decks = Array.isArray(st.decks) ? st.decks : [];
      st.decks.push(cfg);
      await this.save();
    }
    const deckFolder = deck.replace(/[\\/:*?"<>|]/g, " ").trim();
    const root = String(st.newCardFolder || "").replace(/^\/+|\/+$/g, "");
    const folder = cfg.folder || (root ? `${root}/${deckFolder}` : deckFolder);
    const course =
      String(data.course || "").trim() ||
      cfg.course ||
      courseForFolder(this.settings, `${folder}/${deckFolder}.md`);
    const note = cardNote({ ...data, deck, course });
    if (folder) await ensureFolder(this.app, folder);
    let path = folder ? `${folder}/${note.title}.md` : `${note.title}.md`;
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = folder ? `${folder}/${note.title} ${n}.md` : `${note.title} ${n}.md`;
      n++;
    }
    if (data.aiGenerated || data.importFormat === "transcript-ai") assertAllowedWritePath(path, this.settings);
    const file = await this.app.vault.create(path, note.text);
    return { path, file, deck, course };
  }

  /** Create one card note per mask on the same image. */
  async createImageOcclusionCards(input) {
    if (this.moduleOff("cards")) return null;
    const data = input || {};
    const image = str(data.image || data.image_path).trim();
    const masks = Array.isArray(data.masks) ? data.masks.filter(Boolean) : parseMaskRows(data.masksText);
    if (!image) throw new Error("Choose an image in your vault first.");
    if (!masks.length) throw new Error("Add at least one mask: x, y, width, height, label.");
    const results = [];
    for (const mask of masks) {
      const label = str(mask.label).trim();
      if (!label) continue;
      results.push(
        await this.createCard({
          ...data,
          cardType: "image-occlusion",
          title: label,
          front: str(data.prompt || data.front).trim() || "What is hidden in the highlighted area?",
          back: label,
          mask,
        })
      );
    }
    if (!results.length) throw new Error("Add at least one mask with a label.");
    return { created: results.length, paths: results.map((r) => r.path), results };
  }

  /** Import cards from a folder of Spaced Repetition notes. */
  async importCardsFromFolder(folder, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    const root = String(folder || "").replace(/^\/+|\/+$/g, "");
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      if (root && file.path !== root && !file.path.startsWith(root + "/")) return false;
      // Never re-import notes this module already owns: cloze prompts contain `::`.
      return !isCardNote(this.app.metadataCache.getFileCache(file)?.frontmatter);
    });
    const cards = [];
    const errors = [];
    for (const file of files) {
      try {
        const text = await this.app.vault.cachedRead(file);
        const fallback = String(opts.deck || "").trim() || (root ? root.split("/").pop() : this.settings.cards.defaultDeck);
        const parsed = parseSpacedRepetition(text, {
          sourcePath: file.path,
          deck: fallback,
        });
        cards.push(...parsed.cards);
      } catch (e) {
        errors.push(`${file.path}: ${String((e && e.message) || e)}`);
      }
    }
    return this.importParsedCards(cards, { ...opts, errors });
  }

  /** Reads one export file from the vault as text. */
  async serviceExportText(path) {
    const file = this.app.vault.getAbstractFileByPath(str(path));
    if (!file) throw new Error(`There is no ${str(path)} in this vault.`);
    return str(await this.app.vault.cachedRead(file));
  }

  /**
   * Imports one service export: `{ path }` or `{ text, filename }`, into a folder of
   * notes. Each record becomes one note; an existing note is skipped, so a repeated
   * import never duplicates or overwrites. Returns what was written and skipped.
   */
  async importServiceExport(source, options) {
    const input = source && typeof source === "object" ? source : {};
    const settings = options && typeof options === "object" ? options : {};
    const path = str(input.path);
    const filename = path || str(input.filename);
    if (/\.text(bundle|pack)$/i.test(filename)) {
      throw new Error(serviceImport.detectServiceExport("", filename).error);
    }
    const text = path ? await this.serviceExportText(path) : str(input.text);
    const detected = serviceImport.detectServiceExport(text, filename);
    if (!detected.ok) throw new Error(detected.error);
    const parsed = serviceImport.parseServiceExport(text, { kind: settings.kind || detected.kind, filename });
    if (!parsed.ok) throw new Error(parsed.error);
    const folder = str(settings.folder).replace(/^\/+|\/+$/g, "") || `Imports/${detected.label}`;
    await ensureFolder(this.app, folder);
    const taken = new Set();
    const written = [];
    let skipped = 0;
    for (const record of parsed.records) {
      const notePath = serviceImport.uniqueNotePath(folder, record.title, taken);
      if (this.app.vault.getAbstractFileByPath(notePath)) {
        skipped += 1;
        continue;
      }
      await this.app.vault.create(notePath, serviceImport.recordMarkdown(record));
      taken.add(notePath);
      written.push(notePath);
    }
    new Notice(
      `${detected.service} import: ${written.length} note(s) written to ${folder}${skipped ? `, ${skipped} already there` : ""}${
        parsed.skipped ? `, ${parsed.skipped} empty or trashed skipped` : ""
      }.`,
      8000
    );
    return { service: detected.service, kind: detected.kind, folder, written, skipped, total: parsed.total };
  }

  /** The importer's command entry: it reads the export that is open. */
  async importActiveServiceExport() {
    const active = this.app.workspace.getActiveFile();
    if (!active || !active.path) {
      new Notice("Open an export file first (an .enex, .json, .csv or .md export).");
      return null;
    }
    try {
      return await this.importServiceExport({ path: active.path });
    } catch (e) {
      new Notice(str(e && e.message ? e.message : e), 10000);
      return null;
    }
  }

  /** Imports an export straight from the clipboard, so a pasted export needs no file. */
  async importServiceClipboard() {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      new Notice("Could not read the clipboard. Copy the export's text first.");
      return null;
    }
    try {
      return await this.importServiceExport({ text }, { folder: "" });
    } catch (e) {
      new Notice(str(e && e.message ? e.message : e), 10000);
      return null;
    }
  }

  /** Import an Anki plain-text/CSV export. Binary .apkg files need Anki's text export. */
  async importCardsFromAnki(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (/\.(apkg|colpkg)$/i.test(String(path || ""))) {
      throw new Error("Open the deck in Anki and use File → Export → Notes in Plain Text; .apkg files are not opened by this plugin.");
    }
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseAnkiText(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, opts);
  }

  /** Read a vault binary file without assuming a Node filesystem path. */
  async readVaultBytes(file) {
    const vault = this.app && this.app.vault;
    if (vault && typeof vault.readBinary === "function") {
      const data = await vault.readBinary(file);
      return Buffer.isBuffer(data) ? data : Buffer.from(data || []);
    }
    if (vault && vault.adapter && typeof vault.adapter.readBinary === "function") {
      const data = await vault.adapter.readBinary(file.path);
      return Buffer.isBuffer(data) ? data : Buffer.from(data || []);
    }
    throw new Error("This Obsidian build cannot read binary files from the vault.");
  }

  /** Import an Anki package (.apkg) through the same card writer and duplicate handling as text imports. */
  async importCardsFromApkg(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (!/\.apkg$/i.test(String(path || ""))) throw new Error("Choose the .apkg file exported by Anki.");
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That .apkg file is not in the vault.");
    const bytes = await this.readVaultBytes(file);
    const parsed = parseApkg(bytes, { sourcePath: file.path, deck: opts.deck });
    const result = await this.importParsedCards(parsed.cards, { ...opts, errors: parsed.errors, skippedDetails: parsed.skippedDetails, media: parsed.media, source: parsed.source });
    return { ...result, warnings: parsed.warnings, skippedInFile: parsed.skipped, skippedDetails: parsed.skippedDetails, media: parsed.media };
  }

  /** Import a Moodle GIFT text file. Each question becomes a basic card. */
  async importCardsFromGift(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (/\.(pdf|docx|xlsx?)$/i.test(String(path || ""))) {
      throw new Error("Save the Moodle export as GIFT text (.txt or .gift); this plugin does not read that file type.");
    }
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseGiftText(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, { ...opts, deck: String(opts.deck || "").trim() || file.basename, errors: parsed.errors });
  }

  /** Import a folder of Mochi Markdown cards, one file per card split by ---. */
  async importCardsFromMochi(folder, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    const root = String(folder || "").replace(/^\/+|\/+$/g, "");
    const files = this.app.vault.getMarkdownFiles().filter((file) => !root || file.path === root || file.path.startsWith(root + "/"));
    const cards = [];
    const errors = [];
    for (const file of files) {
      if (isCardNote(this.app.metadataCache.getFileCache(file)?.frontmatter)) continue;
      try {
        const text = await this.app.vault.cachedRead(file);
        const folder = String(file.path || "").split("/").slice(0, -1).join("/");
        const deck = String(opts.deck || "").trim() || (folder ? folder.split("/").pop() : "Imported");
        const parsed = parseMochiMarkdown(text, { sourcePath: file.path, deck });
        cards.push(...parsed.cards);
        if (!parsed.cards.length) errors.push(`${file.path}: no front/back separator found`);
      } catch (e) {
        errors.push(`${file.path}: ${String((e && e.message) || e)}`);
      }
    }
    return this.importParsedCards(cards, { ...opts, errors });
  }

  /** Import LearnKit pipe blocks and quick cards from a note or folder. */
  async importCardsFromLearnKit(folder, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    const root = String(folder || "").replace(/^\/+|\/+$/g, "");
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      if (root && file.path !== root && !file.path.startsWith(root + "/")) return false;
      return !isCardNote(this.app.metadataCache.getFileCache(file)?.frontmatter);
    });
    const cards = [];
    const errors = [];
    const warnings = [];
    const skippedDetails = [];
    for (const file of files) {
      try {
        const text = await this.app.vault.cachedRead(file);
        const parent = String(file.path || "").split("/").slice(0, -1).join("/");
        const deck = String(opts.deck || "").trim() || (parent ? parent.split("/").pop() : this.settings.cards.defaultDeck);
        const parsed = parseLearnKit(text, { sourcePath: file.path, deck });
        cards.push(...parsed.cards);
        warnings.push(...parsed.warnings);
        skippedDetails.push(...parsed.skippedDetails);
      } catch (e) {
        errors.push(`${file.path}: ${String((e && e.message) || e)}`);
      }
    }
    const result = await this.importParsedCards(cards, { ...opts, errors, skippedDetails });
    return { ...result, warnings: [...new Set(warnings)] };
  }

  /** Import a CrowdAnki JSON export. */
  async importCardsFromCrowdAnki(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (!/\.json$/i.test(String(path || ""))) throw new Error("Choose the .json file exported by CrowdAnki.");
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseCrowdAnkiJson(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, { ...opts, deck: String(opts.deck || "").trim() || file.basename, errors: parsed.errors });
  }

  /** Import a Moodle XML or QTI quiz bank. Each question becomes a basic card. */
  async importCardsFromLmsXml(path, format, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    const kind = String(format || "").toLowerCase();
    if (!["moodlexml", "qti"].includes(kind)) throw new Error(`Unsupported LMS format: ${kind || "none"}.`);
    const allowed = kind === "qti" ? /\.(xml|txt|zip)$/i : /\.(xml|txt)$/i;
    if (!allowed.test(String(path || ""))) {
      throw new Error(kind === "qti" ? "Choose the .xml or .zip file exported by your QTI quiz bank." : "Choose the .xml file exported by Moodle.");
    }
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    if (kind === "qti" && /\.zip$/i.test(String(path || ""))) {
      const bytes = await this.readVaultBytes(file);
      const parsed = parseQtiArchive(bytes, { sourcePath: file.path, deck: opts.deck });
      return this.importParsedCards(parsed.cards, {
        ...opts,
        deck: String(opts.deck || "").trim() || file.basename,
        errors: parsed.errors,
        skippedDetails: parsed.skipped ? [{ reason: `${parsed.skipped} QTI item${parsed.skipped === 1 ? "" : "s"} had no usable answer` }] : [],
      });
    }
    const text = await this.app.vault.cachedRead(file);
    const parsed = kind === "qti" ? parseQtiXml(text, { sourcePath: file.path, deck: opts.deck }) : parseMoodleXml(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, { ...opts, deck: String(opts.deck || "").trim() || file.basename, errors: parsed.errors });
  }

  /** Import a FlashQuiz text file with @mc, @sata and @tf blocks. */
  async importCardsFromFlashQuiz(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (!/\.(txt|md)$/i.test(String(path || ""))) throw new Error("Choose the .txt or .md FlashQuiz export.");
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseFlashQuizText(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, { ...opts, deck: String(opts.deck || "").trim() || file.basename, errors: parsed.errors });
  }

  /** Import a QuizPort JSON quiz. */
  async importCardsFromQuizPort(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (!/\.json$/i.test(String(path || ""))) throw new Error("Choose the .json QuizPort export.");
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseQuizPortJson(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, { ...opts, deck: String(opts.deck || "").trim() || file.basename, errors: parsed.errors });
  }

  /** Import a Markdown note whose headings are questions and checkboxes are choices. */
  async importCardsFromMarkdownQuiz(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (!/\.md$/i.test(String(path || ""))) throw new Error("Choose the .md Markdown quiz note.");
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseMarkdownQuiz(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, { ...opts, deck: String(opts.deck || "").trim() || file.basename, errors: parsed.errors });
  }

  /** Import a Quizlet text/CSV export. Quizlet has no deck field, so the fallback deck is used. */
  async importCardsFromQuizlet(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (opts.pdfData || /\.pdf$/i.test(String(path || ""))) return this.importCardsFromQuizletPdf(path, opts);
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseQuizletText(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, opts);
  }

  /** Read a text-based Quizlet PDF into card records, without writing anything. */
  async parseQuizletPdfCards(path, options) {
    const opts = options || {};
    const name = String(opts.pdfName || path || "").trim();
    if (!/\.pdf$/i.test(name)) throw new Error("Choose the .pdf file printed from Quizlet.");
    const { pdfData, pdfName, ...rest } = opts;
    let bytes;
    let sourcePath;
    let baseName;
    if (pdfData) {
      bytes = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);
      sourcePath = name;
      baseName = name.replace(/^.*\//, "").replace(/\.pdf$/i, "");
    } else {
      const file = this.app.vault.getAbstractFileByPath(String(path || ""));
      if (!file) throw new Error("That PDF is not in the vault. Choose it from this device instead, or add it to the vault.");
      bytes = await this.readVaultBytes(file);
      sourcePath = file.path;
      baseName = file.basename;
    }
    const read = await readPdfPages(bytes, String(rest.pages || ""), rest.progress || (() => {}));
    return parseQuizletPdf(read.pages, {
      ...rest,
      sourcePath,
      deck: String(rest.deck || "").trim() || baseName,
    });
  }

  /** Import a PDF of a Quizlet set or printed test bank as flashcards. */
  async importCardsFromQuizletPdf(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    const parsed = await this.parseQuizletPdfCards(path, opts);
    const result = await this.importParsedCards(parsed.cards, {
      ...opts,
      errors: parsed.errors,
      skippedDetails: parsed.skipped ? [{ reason: `${parsed.skipped} printed question${parsed.skipped === 1 ? "" : "s"} had no answer key` }] : [],
    });
    return { ...result, warnings: parsed.warnings, questions: parsed.questions, totalPages: parsed.totalPages };
  }

  /** Adds duplicate details to a read-only import preview so the dialog can show a diff. */
  decorateImportPreview(result) {
    const parsed = result && typeof result === "object" ? result : {};
    const existing = this.existingImportCardMap();
    const details = [];
    for (const card of Array.isArray(parsed.cards) ? parsed.cards : []) {
      const key = String(card.importKey || "").trim();
      if (!key || !existing.has(key)) continue;
      details.push(cardUpdateDiff(existing.get(key), card));
    }
    return {
      ...parsed,
      duplicates: details.length,
      duplicatePaths: details.map((diff) => diff.path).filter(Boolean),
      duplicateDetails: details,
    };
  }

  /** Read the first Markdown table in a note without writing anything. */
  async previewCardsMarkdownTable(path, options) {
    const opts = options || {};
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    if (!/\.(md|markdown)$/i.test(String(file.path || ""))) {
      throw new Error("Choose a .md or .markdown file with a Markdown table.");
    }
    const text = await this.app.vault.cachedRead(file);
    const base = {
      ...opts,
      sourcePath: file.path,
      deck: String(opts.deck || "").trim() || file.basename,
    };
    return this.decorateImportPreview(parseMarkdownTable(text, base));
  }

  /** Import the first Markdown table in a note as ordinary cards. */
  async importCardsFromMarkdownTable(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    const parsed = await this.previewCardsMarkdownTable(path, opts);
    const result = await this.importParsedCards(parsed.cards, { ...opts, errors: parsed.errors, skippedDetails: parsed.skippedDetails, source: parsed.source });
    return { ...result, headers: parsed.headers, mapping: parsed.mapping, headerKey: parsed.headerKey, skippedRows: parsed.skipped, skippedDetails: parsed.skippedDetails, delimiter: parsed.delimiter };
  }

  /** Read a generic CSV/TSV without writing anything, so the import dialog can preview its columns. */
  async previewCardsCsv(path, options) {
    const opts = options || {};
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    if (!/\.(csv|tsv|txt)$/i.test(String(file.path || ""))) {
      throw new Error("Choose a .csv, .tsv or .txt file. Spreadsheet and PDF files are not read directly.");
    }
    const text = await this.app.vault.cachedRead(file);
    const base = {
      ...opts,
      sourcePath: file.path,
      deck: String(opts.deck || "").trim() || file.basename,
    };
    const first = parseGenericCsv(text, base);
    const explicitMapping = opts.mapping !== undefined && opts.mapping !== null;
    const saved = !explicitMapping && this.settings.cards.csvMappings && this.settings.cards.csvMappings[first.headerKey];
    return this.decorateImportPreview(saved ? parseGenericCsv(text, { ...base, mapping: saved }) : first);
  }

  /** Import a generic CSV/TSV, remembering its column mapping by header layout. */
  async importCardsFromCsv(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    const parsed = await this.previewCardsCsv(path, opts);
    if (opts.saveMapping !== false && parsed.headerKey && parsed.mapping.front >= 0 && parsed.mapping.back >= 0) {
      this.settings.cards.csvMappings = this.settings.cards.csvMappings || {};
      this.settings.cards.csvMappings[parsed.headerKey] = { ...parsed.mapping };
      await this.save();
    }
    const result = await this.importParsedCards(parsed.cards, { ...opts, errors: parsed.errors, skippedDetails: parsed.skippedDetails, source: parsed.source });
    return { ...result, headers: parsed.headers, mapping: parsed.mapping, headerKey: parsed.headerKey, hasHeader: parsed.hasHeader, skippedRows: parsed.skipped, skippedDetails: parsed.skippedDetails, delimiter: parsed.delimiter };
  }

  /** Import a Kahoot, Blooket or Gimkit CSV. The source deck is the file name unless a fallback is set. */
  async importCardsFromQuestionSet(path, format, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    const kind = String(format || "").toLowerCase();
    if (!["kahoot", "blooket", "gimkit"].includes(kind)) throw new Error(`Unsupported question-set format: ${kind || "none"}.`);
    if (/\.(xlsx|xls|pdf|docx)$/i.test(String(path || ""))) {
      throw new Error("Save the spreadsheet as CSV first; .xlsx, .xls, PDF and Word files are not read by this plugin.");
    }
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const deck = String(opts.deck || "").trim() || file.basename;
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseQuestionSetText(text, { sourcePath: file.path, deck, format: kind });
    return this.importParsedCards(parsed.cards, { ...opts, deck, errors: parsed.errors, skippedDetails: parsed.skippedDetails, source: parsed.source });
  }

  /** Write the current card filter as Quizlet or Anki text, or a platform CSV. */
  async exportCards(format, options) {
    if (this.moduleOff("cards")) throw new Error("Turn on the Cards module first.");
    const opts = options || {};
    const kind = String(format || "quizlet").toLowerCase();
    if (!["quizlet", "anki", "apkg", "mochi", "learnkit", "kahoot", "blooket", "gimkit"].includes(kind)) {
      throw new Error(`Unsupported export format: ${kind}.`);
    }
    const cards = this.filteredCards({ deck: opts.deck, course: opts.course, includeHidden: true });
    if (!cards.length) throw new Error("No cards match the current deck and course filter.");
    const records = [];
    const warnings = [];
    for (const card of cards) {
      try {
        const text = await this.app.vault.cachedRead(card.file);
        const record = { ...card, body: parseCardBody(text, card.fm) };
        records.push(record);
        if (!["quizlet", "anki", "mochi"].includes(kind) && !record.body.back) warnings.push(`${card.file.path} has no answer and was skipped.`);
      } catch (e) {
        warnings.push(`${card.file.path}: ${String((e && e.message) || e)}`);
      }
    }
    const mochiDecks = kind === "mochi" ? cardsToMochiDecks(records) : null;
    const mochiCount = mochiDecks ? mochiDecks.reduce((sum, deck) => sum + deck.cards.length, 0) : 0;
    if (kind === "mochi" && !mochiCount) throw new Error("Nothing in this filter has front text to export to Mochi.");
    if (kind === "mochi") {
      const skipped = records.length - mochiCount;
      if (skipped > 0) warnings.push(`${skipped} card${skipped === 1 ? "" : "s"} had no front text and was skipped.`);
      const media = mochiMediaWarning(records);
      if (media) warnings.push(media);
    }
    if (kind === "apkg") {
      const media = apkgMediaWarning(records);
      if (media) warnings.push(media);
    }
    const output = kind === "quizlet" ? cardsToQuizlet(records) : kind === "anki" ? cardsToAnki(records) : kind === "apkg" ? buildApkg(records) : kind === "mochi" ? buildMochiArchive(records) : kind === "learnkit" ? cardsToLearnKit(records) : cardsToQuestionSet(kind, records);
    if (!output || (typeof output === "string" && !output.trim())) throw new Error("Nothing in this filter can be exported in that format yet.");
    const root = String(this.settings.cards.newCardFolder || "Cards").replace(/^\/+|\/+$/g, "") || "Cards";
    const folder = `${root}/exports`;
    await ensureFolder(this.app, folder);
    const base = `${opts.deck && opts.deck !== "all" ? opts.deck : "cards"} ${kind} ${localDate()}`
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const extension = kind === "apkg" ? "apkg" : kind === "mochi" ? "mochi" : kind === "learnkit" ? "md" : kind === "quizlet" || kind === "anki" ? "txt" : "csv";
    let path = `${folder}/${base}.${extension}`;
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${folder}/${base} ${n}.${extension}`;
      n++;
    }
    if (typeof output === "string") await this.app.vault.create(path, output);
    else {
      const binary = output instanceof Uint8Array ? output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) : output;
      if (typeof this.app.vault.createBinary === "function") await this.app.vault.createBinary(path, binary);
      else await this.app.vault.create(path, binary);
    }
    const exported = kind === "mochi" ? mochiCount : records.length;
    new Notice(`Exported ${exported} card${exported === 1 ? "" : "s"} to ${path}.`, 6000);
    return { path, count: exported, format: kind, warnings };
  }

  /** Parsed-card preview with duplicate counts, used before writing anything. */
  async previewCardsImport(type, path, options) {
    if (this.moduleOff("cards")) return { cards: [], total: 0, duplicates: 0, duplicatePaths: [], errors: ["Turn on the Cards module first."], format: type };
    const kind = String(type || "").toLowerCase();
    const opts = options || {};
    const cards = [];
    const errors = [];
    const warnings = [];
    const skippedDetails = [];
    let media = null;
    const add = (parsed) => {
      cards.push(...((parsed && parsed.cards) || []));
      if (parsed && Array.isArray(parsed.errors)) errors.push(...parsed.errors);
      if (parsed && Array.isArray(parsed.warnings)) warnings.push(...parsed.warnings);
      if (parsed && Array.isArray(parsed.skippedDetails)) skippedDetails.push(...parsed.skippedDetails);
      if (parsed && parsed.media) media = parsed.media;
    };
    try {
      if (kind === "spaced" || kind === "mochi" || kind === "learnkit") {
        const root = String(path || "").replace(/^\/+|\/+$/g, "");
        const files = this.app.vault.getMarkdownFiles().filter((file) => (!root || file.path === root || file.path.startsWith(root + "/")) && !isCardNote(this.app.metadataCache.getFileCache(file)?.frontmatter));
        for (const file of files) {
          try {
            const text = await this.app.vault.cachedRead(file);
            const folder = String(file.path || "").split("/").slice(0, -1).join("/");
            const deck = String(opts.deck || "").trim() || ((kind === "mochi" || kind === "learnkit") ? (folder ? folder.split("/").pop() : "Imported") : (root ? root.split("/").pop() : this.settings.cards.defaultDeck));
            add(kind === "mochi" ? parseMochiMarkdown(text, { sourcePath: file.path, deck }) : kind === "learnkit" ? parseLearnKit(text, { sourcePath: file.path, deck }) : parseSpacedRepetition(text, { sourcePath: file.path, deck }));
          } catch (e) {
            errors.push(`${file.path}: ${String((e && e.message) || e)}`);
          }
        }
      } else if (kind === "csv") {
        const parsed = await this.previewCardsCsv(path, opts);
        add(parsed);
      } else if (kind === "mdtable") {
        const parsed = await this.previewCardsMarkdownTable(path, opts);
        add(parsed);
      } else if (kind === "apkg") {
        const file = this.app.vault.getAbstractFileByPath(String(path || ""));
        if (!file) throw new Error("That .apkg file is not in the vault.");
        const bytes = await this.readVaultBytes(file);
        add(parseApkg(bytes, { sourcePath: file.path, deck: String(opts.deck || "").trim() || file.basename }));
      } else if (kind === "quizlet" && (opts.pdfData || /\.pdf$/i.test(String(path || "")))) {
        add(await this.parseQuizletPdfCards(path, { ...opts, progress: () => {} }));
      } else if (kind === "qti" && /\.zip$/i.test(String(path || ""))) {
        const file = this.app.vault.getAbstractFileByPath(String(path || ""));
        if (!file) throw new Error("That QTI archive is not in the vault.");
        add(parseQtiArchive(await this.readVaultBytes(file), { sourcePath: file.path, deck: String(opts.deck || "").trim() || file.basename }));
      } else {
        const file = this.app.vault.getAbstractFileByPath(String(path || ""));
        if (!file) throw new Error("That file is not in the vault.");
        const text = await this.app.vault.cachedRead(file);
        const deck = String(opts.deck || "").trim() || file.basename;
        const base = { sourcePath: file.path, deck };
        if (kind === "anki") add(parseAnkiText(text, base));
        else if (kind === "gift") add(parseGiftText(text, base));
        else if (kind === "moodlexml") add(parseMoodleXml(text, base));
        else if (kind === "qti") add(parseQtiXml(text, base));
        else if (kind === "crowdanki") add(parseCrowdAnkiJson(text, base));
        else if (kind === "quizlet") add(parseQuizletText(text, base));
        else if (kind === "flashquiz") add(parseFlashQuizText(text, base));
        else if (kind === "quizport") add(parseQuizPortJson(text, base));
        else if (kind === "mdquiz") add(parseMarkdownQuiz(text, base));
        else if (["kahoot", "blooket", "gimkit"].includes(kind)) add(parseQuestionSetText(text, { ...base, format: kind }));
        else throw new Error(`Unsupported import format: ${kind || "none"}.`);
      }
    } catch (e) {
      errors.push(String((e && e.message) || e));
    }
    const existing = this.existingImportCardMap();
    const duplicatePaths = cards.filter((card) => card.importKey && existing.has(card.importKey)).map((card) => existing.get(card.importKey).file.path);
    return this.decorateImportPreview({ cards, total: cards.length, duplicates: duplicatePaths.length, duplicatePaths, errors, warnings, skippedDetails, media, format: kind });
  }

  existingImportCardMap() {
    const map = new Map();
    for (const card of this.getCards()) {
      const key = String(card.fm.import_key || "").trim();
      if (key) map.set(key, card);
    }
    return map;
  }

  /** Replace a card's body while retaining its review history and study status. */
  async updateCardFromImport(existing, card, options) {
    const opts = options || {};
    const generated = cardNote({
      ...card,
      id: existing.fm && existing.fm.card_id,
      deck: card.deck || existing.deck,
      course: card.course || existing.course,
      importBatch: opts.importBatch,
    });
    const oldText = await this.app.vault.cachedRead(existing.file);
    const beforeFm = { ...((existing && existing.fm) || {}) };
    const nextFm = { ...beforeFm };
    if (generated.deck) nextFm.deck = generated.deck;
    if (generated.course) nextFm.course = generated.course;
    if (card.importSource) nextFm.import_source = card.importSource;
    if (card.importFormat) nextFm.import_format = card.importFormat;
    if (opts.importBatch) nextFm.import_batch = opts.importBatch;
    nextFm.imported_on = localDate();
    if (card.importKey) nextFm.import_key = card.importKey;
    if (generated.cardType && generated.cardType !== "basic") nextFm.card_type = generated.cardType;
    else delete nextFm.card_type;
    assertProtectedUnchanged(beforeFm, nextFm);
    const close = oldText.indexOf("\n---\n", 3);
    if (close < 0) throw new Error("The existing card has no closing frontmatter fence.");
    const body = noteBodyText(generated.text);
    const oldBody = noteBodyText(oldText);
    const notes = noteNotesSection(oldBody);
    const merged = notes ? `${body.trimEnd()}\n\n${notes}\n` : body;
    await this.app.vault.modify(existing.file, oldText.slice(0, close + 5) + merged);
    if (this.app.fileManager && typeof this.app.fileManager.processFrontMatter === "function") {
      await this.app.fileManager.processFrontMatter(existing.file, (fm) => {
        if (generated.deck) fm.deck = generated.deck;
        if (generated.course) fm.course = generated.course;
        if (card.importSource) fm.import_source = card.importSource;
        if (card.importFormat) fm.import_format = card.importFormat;
        if (opts.importBatch) fm.import_batch = opts.importBatch;
        fm.imported_on = localDate();
        if (card.importKey) fm.import_key = card.importKey;
        if (generated.cardType && generated.cardType !== "basic") fm.card_type = generated.cardType;
        else delete fm.card_type;
      });
    }
  }

  /** Write parsed cards, skipping, updating or copying duplicate import keys. */
  async importParsedCards(parsed, options) {
    const opts = options || {};
    const existing = this.existingImportCardMap();
    const mode = ["skip", "update", "copy"].includes(opts.duplicateMode) ? opts.duplicateMode : "skip";
    const importBatch = String(opts.importBatch || "").trim() || `import-${Date.now().toString(36)}`;
    let created = 0;
    let updated = 0;
    let copied = 0;
    let skipped = 0;
    const errors = Array.isArray(opts.errors) ? opts.errors.slice() : [];
    const rows = (Array.isArray(opts.skippedDetails) ? opts.skippedDetails : []).map((detail) => ({
      status: "skipped",
      row: detail && detail.row,
      reason: detail && detail.reason,
      source: opts.source || "",
    }));
    for (const card of Array.isArray(parsed) ? parsed : []) {
      const duplicate = card.importKey ? existing.get(card.importKey) : null;
      if (duplicate && mode === "skip") {
        skipped++;
        rows.push({ status: "skipped", reason: "Duplicate import key", source: card.importSource || "", path: duplicate.file && duplicate.file.path });
        continue;
      }
      if (duplicate && mode === "update") {
        try {
          await this.updateCardFromImport(duplicate, card, { ...opts, importBatch });
          updated++;
          rows.push({ status: "updated", source: card.importSource || "", path: duplicate.file && duplicate.file.path });
        } catch (e) {
          const reason = String((e && e.message) || e);
          errors.push(`${card.importSource || "import"}: ${reason}`);
          rows.push({ status: "failed", reason, source: card.importSource || "", path: duplicate.file && duplicate.file.path });
        }
        continue;
      }
      const copy = !!duplicate;
      const target = copy ? { ...card, importKey: `${card.importKey}~copy-${Date.now().toString(36)}-${copied + 1}` } : card;
      try {
        const written = await this.createCard({
          ...target,
          deck: target.deck || String(opts.deck || "").trim(),
          course: String(opts.course || "").trim() || target.course || "",
          importBatch: target.importBatch || importBatch,
          importSourceUrl: target.importSourceUrl || opts.importSourceUrl || "",
        });
        if (target.importKey) existing.set(target.importKey, target);
        if (copy) copied++;
        else created++;
        rows.push({ status: copy ? "copied" : "created", source: target.importSource || "", path: written && written.path });
      } catch (e) {
        const reason = String((e && e.message) || e);
        errors.push(`${target.importSource || "import"}: ${reason}`);
        rows.push({ status: "failed", reason, source: target.importSource || "" });
      }
    }
    return { created, updated, copied, skipped, errors, rows, media: opts.media || null, total: Array.isArray(parsed) ? parsed.length : 0, duplicateMode: mode };
  }

  /** Backfill missing course tags from deck and calendar folder mappings. */
  async tagCardsByCourse() {
    if (this.moduleOff("cards")) return 0;
    let n = 0;
    for (const card of this.getCards()) {
      if (String(card.fm.course || "").trim() || !card.course) continue;
      const course = card.course;
      await this.app.fileManager.processFrontMatter(card.file, (fm) => {
        if (!String(fm.course || "").trim()) fm.course = course;
      });
      n++;
    }
    return n;
  }

  /* ---- presets */

  applyPreset(id) {
    const st = this.settings;
    if (!id) {
      st.activePreset = "";
    } else {
      const pr = st.presets.find((x) => x.id === id);
      if (pr) {
        st.filters = cloneFilters(pr.filters);
        st.moreSets = (pr.moreSets || []).map(cloneFilters);
        st.mode = pr.mode || "smart";
        st.activePreset = id;
      }
    }
    this.save();
  }

  savePreset(name) {
    const st = this.settings;
    const id = "p" + Date.now().toString(36);
    st.presets.push({ id, name, filters: cloneFilters(st.filters), moreSets: (st.moreSets || []).map(cloneFilters), mode: st.mode });
    st.activePreset = id;
    this.save();
  }

  updatePreset() {
    const st = this.settings;
    const pr = st.presets.find((x) => x.id === st.activePreset);
    if (!pr) return;
    pr.filters = cloneFilters(st.filters);
    pr.moreSets = (st.moreSets || []).map(cloneFilters);
    pr.mode = st.mode;
    this.save();
  }

  deletePreset() {
    const st = this.settings;
    st.presets = st.presets.filter((x) => x.id !== st.activePreset);
    st.activePreset = "";
    this.save();
  }

  isModified() {
    const st = this.settings;
    const pr = st.presets.find((x) => x.id === st.activePreset);
    if (!pr) return false;
    const norm1 = (o) => JSON.stringify(FILTER_FIELDS.map(([k]) => [k, fvals(o, k).sort()]).filter((x) => x[1].length));
    const norm = (main, more) => JSON.stringify([main, ...(more || [])].filter(hasFilters).map(norm1).sort());
    return norm(pr.filters, pr.moreSets) !== norm(st.filters, st.moreSets) || (pr.mode || "smart") !== st.mode;
  }

  /* ---- focus timer and study log (timestamp-derived, survives reloads) */

  readFocus() {
    try {
      const s = this.app.loadLocalStorage(FOCUS_STORAGE_KEY);
      return s && typeof s === "object" && Number.isFinite(s.startedAt) && Number.isFinite(s.targetMinutes) ? s : null;
    } catch (e) {
      return null;
    }
  }

  writeFocus() {
    try {
      this.app.saveLocalStorage(FOCUS_STORAGE_KEY, this.focus || null);
    } catch (e) {
      /* the timer still works; it just will not survive a reload */
    }
  }

  focusElapsedMs() {
    return elapsedFocusMs(this.focus, Date.now());
  }

  startFocusSession(minutes, course, task) {
    if (this.moduleOff("mcq")) return null;
    if (this.focus) {
      new Notice("Finish or discard the current focus session first.");
      return null;
    }
    this.focus = startFocus({ minutes, course, task }, Date.now());
    this.writeFocus();
    this.refreshViews();
    return this.focus;
  }

  pauseFocusSession() {
    this.focus = pauseFocus(this.focus, Date.now());
    this.writeFocus();
    this.refreshViews();
    return this.focus;
  }

  resumeFocusSession() {
    this.focus = resumeFocus(this.focus, Date.now());
    this.writeFocus();
    this.refreshViews();
    return this.focus;
  }

  async finishFocusSession() {
    const session = finishFocus(this.focus, Date.now());
    if (!session) {
      new Notice("That session was too short to log.");
      return null;
    }
    this.settings.studyLog = addStudySession(this.settings.studyLog, session);
    this.focus = null;
    this.writeFocus();
    await this.save();
    this.refreshViews();
    return session;
  }

  discardFocusSession() {
    this.focus = null;
    this.writeFocus();
    this.refreshViews();
  }

  async logStudySession(entry) {
    this.settings.studyLog = addStudySession(this.settings.studyLog, entry);
    await this.save();
    this.refreshViews();
    return this.settings.studyLog;
  }

  openFocusLog() {
    if (this.moduleOff("mcq")) return;
    new FocusLogModal(this.app, this).open();
  }

  studySummary(today) {
    return studySummary(this.settings.studyLog, today);
  }

  /* ---- timer (survives reloads) */

  sessionKey() {
    return "question-tracker-session";
  }
  readSession() {
    try {
      const s = this.app.loadLocalStorage(this.sessionKey());
      return s && typeof s.path === "string" && typeof s.elapsedMs === "number" ? s : null;
    } catch (e) {
      return null;
    }
  }
  writeSession() {
    try {
      this.app.saveLocalStorage(this.sessionKey(), this.session || null);
    } catch (e) {
      /* storage unavailable: the timer still works, it just won't survive a reload */
    }
  }
  startSession(path, variantSeed) {
    const seed = Number(variantSeed);
    this.session = {
      path,
      elapsedMs: 0,
      runningSince: Date.now(),
      lastBeat: Date.now(),
      ...(Number.isFinite(seed) ? { variantSeed: seed } : {}),
    };
    this.writeSession();
  }
  isRunning() {
    const s = this.session;
    return !!(s && s.runningSince);
  }
  elapsedMs() {
    const s = this.session;
    if (!s) return 0;
    return s.elapsedMs + (s.runningSince ? Date.now() - s.runningSince : 0);
  }
  pauseSession() {
    const s = this.session;
    if (!s || !s.runningSince) return;
    s.elapsedMs += Date.now() - s.runningSince;
    s.runningSince = null;
    this.writeSession();
  }
  resumeSession() {
    const s = this.session;
    if (!s || s.runningSince) return;
    s.runningSince = Date.now();
    s.lastBeat = Date.now();
    this.writeSession();
  }
  clearSession() {
    this.session = null;
    this.writeSession();
  }

  /* ---- writing to notes */

  pendingKey() {
    return "question-tracker-pending-attempts";
  }

  readPendingAttempts() {
    if (Array.isArray(this._pendingAttempts)) return this._pendingAttempts;
    let list = [];
    try {
      list = unpackPendingAttempts(this.app.loadLocalStorage(this.pendingKey()));
    } catch (e) {
      list = [];
    }
    this._pendingAttempts = list;
    return list;
  }

  writePendingAttempts(list) {
    this._pendingAttempts = Array.isArray(list) ? list : [];
    try {
      this.app.saveLocalStorage(this.pendingKey(), packPendingAttempts(this._pendingAttempts));
    } catch (e) {
      // Keep the in-memory queue for this session even if device storage is unavailable.
    }
  }

  /** Recompute counters after a sync conflict or a hand-edited history. */
  async repairReviewHistory() {
    const items = [...this.getQuestions(), ...(typeof this.getCards === "function" ? this.getCards() : [])];
    const seen = new Set();
    const files = [];
    for (const item of items) {
      if (!item || !item.file || seen.has(item.file.path)) continue;
      seen.add(item.file.path);
      files.push(item.file);
    }
    if (!files.length) {
      new Notice("No question or card notes found.");
      return { changed: 0, scanned: 0 };
    }
    const ok = await this.askConfirm(
      "Repair review counters?",
      "This recalculates attempts, correct count, total time, streak and the latest-attempt fields from each note's append-only history. The next review date is not changed. Use it after a sync conflict or if the counters look wrong.",
      "Repair counters"
    );
    if (!ok) return { changed: 0, scanned: 0 };
    let changed = 0;
    for (const file of files) {
      try {
        const cached = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!cached || !repairHistoryCounters(cloneFrontmatter(cached)).changed) continue;
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          repairHistoryCounters(fm);
        });
        changed++;
      } catch (e) {
        /* one unreadable note should not block the rest */
      }
    }
    if (changed) this.refreshViews();
    new Notice(`Checked ${files.length} note${files.length === 1 ? "" : "s"}; repaired ${changed}.`);
    return { changed, scanned: files.length };
  }

  /** A deliberate "don't know": log it, keep accuracy/streak untouched, and schedule sooner. */
  async recordSkip(file) {
    const attemptId = newAttemptId(new Date());
    let summary;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        summary = applySkip(fm, new Date(), attemptId, { historyLimit: this.settings.historyLimit });
      });
    } catch (e) {
      throw new Error(str(e && e.message) || "Could not log this skip.");
    }
    this.refreshViews();
    return { ...summary, queued: false };
  }

  /** Cards can override the scheduler per deck; every other note keeps the global choice. */
  scheduleOptionsFor(fm, path, deckHint) {
    const hinted = str(deckHint).trim();
    const deck = hinted || (isCardNote(fm) ? deckOf(fm, this.settings, path) : "");
    return schedulerForDeck(this.settings, deck, fm);
  }

  async recordAttempt(file, a) {
    const attempt = { ...a, attemptId: a.attemptId || newAttemptId(a.now) };
    const shared = {
      attemptId: attempt.attemptId,
      historyLimit: this.settings.historyLimit,
      leechThreshold: this.settings.leechThreshold,
      leechAction: this.settings.leechAction,
      needsFixingDays: this.settings.needsFixing ? NEEDS_FIXING_DAYS : 0,
      sameDayReviews: attempt.sameDayReviews === true,
      adaptiveFrequency: attempt.adaptiveFrequency === true,
      cram: attempt.cram === true,
    };

    // Build the result the UI should show before touching the note. If the write
    // fails, this summary is still correct and the attempt can be replayed later.
    let preview;
    try {
      const cached = this.app.metadataCache.getFileCache(file);
      const copy = cloneFrontmatter(cached && cached.frontmatter);
      const sched = this.scheduleOptionsFor(copy, file.path, attempt.deck);
      preview = applyAttempt(copy, attempt, sched.intervals, {
        ...shared,
        scheduler: sched.scheduler,
        fsrsRetention: sched.fsrsRetention,
        sm2: sched.sm2,
        examCap: this.examCapFor(attempt.course || copy.course, attempt.now),
      });
    } catch (e) {
      preview = null;
    }

    let summary;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        const sched = this.scheduleOptionsFor(fm, file.path, attempt.deck);
        summary = applyAttempt(fm, attempt, sched.intervals, {
          ...shared,
          reviewUpdated: attempt.reviewUpdated,
          scheduler: sched.scheduler,
          fsrsRetention: sched.fsrsRetention,
          sm2: sched.sm2,
          examCap: this.examCapFor(attempt.course || fm.course, attempt.now),
        });
        const statsCfg = studyStats.normalizeStudyStatsSettings(this.settings.studyStats);
        if (statsCfg.durableRecall) {
          summary.durability = durability.recordRecallDay(fm, { correct: attempt.correct, date: localDate(), requiredDays: statsCfg.durableDays });
        }
      });
    } catch (e) {
      if (!preview) throw e;
      const list = enqueuePending(this.readPendingAttempts(), file.path, attempt);
      this.writePendingAttempts(list);
      new Notice("Saved offline. This result will be added to the note when the vault is writable.", 7000);
      return { ...preview, queued: true, pending: list.length, attemptId: attempt.attemptId };
    }

    try {
      const cachedFm = (this.app.metadataCache.getFileCache(file) || {}).frontmatter || {};
      const kind = isCardNote(cachedFm) ? "card" : str(cachedFm.question_id) ? "question" : "note";
      await this.recordStudyCounter({ kind, correct: attempt.correct, seconds: attempt.seconds, rating: attempt.grade || "" });
    } catch (e) {
      /* counters are best-effort and must not lose a recorded attempt */
    }
    if (summary && summary.fsrsError) {
      new Notice("FSRS couldn't schedule this question, so the simple ladder was used.");
    }
    if (summary && summary.sm2Error) {
      new Notice("SM-2 couldn't schedule this item, so the simple ladder was used.");
    }
    this.refreshKnowledgeRecordFor(file).catch(() => {});
    return { ...summary, queued: false, attemptId: attempt.attemptId };
  }

  /** Attach an error tag to a queued attempt, or return false if it has already been written. */
  async setPendingAttemptError(path, attemptId, type) {
    const list = this.readPendingAttempts();
    const next = updatePendingError(list, path, attemptId, type);
    if (!next) return false;
    this.writePendingAttempts(next);
    return true;
  }

  /** Replay the local outbox. The attempt id makes a retry safe if the first write partially succeeded. */
  flushPendingAttempts() {
    if (this._pendingFlush) return this._pendingFlush;
    this._pendingFlush = (async () => {
      let list = this.readPendingAttempts().slice();
      let sent = 0;
      for (const entry of list.slice()) {
        const file = this.app.vault.getAbstractFileByPath(entry.path);
        if (!(file instanceof TFile)) {
          list = removePending(list, entry.id);
          continue;
        }
        try {
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            if (fm.last_attempt_id === entry.id || hasAttemptId(fm.history, entry.id)) {
              if (entry.errorType) setAttemptError(fm, entry.id, entry.errorType);
              return;
            }
            const attempt = unpackAttempt(entry.attempt);
            const sched = this.scheduleOptionsFor(fm, file.path, attempt.deck);
            applyAttempt(fm, attempt, sched.intervals, {
              reviewUpdated: attempt.reviewUpdated,
              scheduler: sched.scheduler,
              fsrsRetention: sched.fsrsRetention,
              sm2: sched.sm2,
              sameDayReviews: attempt.sameDayReviews === true,
              adaptiveFrequency: attempt.adaptiveFrequency === true,
              cram: attempt.cram === true,
              attemptId: entry.id,
              historyLimit: this.settings.historyLimit,
              leechThreshold: this.settings.leechThreshold,
              leechAction: this.settings.leechAction,
              needsFixingDays: this.settings.needsFixing ? NEEDS_FIXING_DAYS : 0,
              examCap: this.examCapFor(attempt.course || fm.course, attempt.now),
            });
            if (entry.errorType) setAttemptError(fm, entry.id, entry.errorType);
          });
          list = removePending(list, entry.id);
          sent++;
        } catch (e) {
          break; // still offline: keep this and the rest for the next retry
        }
      }
      this.writePendingAttempts(list);
      return { sent, remaining: list.length };
    })().finally(() => {
      this._pendingFlush = null;
    });
    return this._pendingFlush;
  }

  async setErrorType(file, type) {
    await this.app.fileManager.processFrontMatter(file, (fm) => setLastErrorType(fm, type));
  }

  /** Mark a question or card Known for a snooze, Exclude it, or restore it. */
  async setStudyStatus(file, status, options) {
    const opts = options || {};
    const fm = file && this.app.metadataCache.getFileCache(file)?.frontmatter;
    const days = opts.days === undefined ? knownDaysForCourse(this.settings.knownDaysByCourse, fm && fm.course, this.settings.knownDays) : opts.days;
    let summary;
    await this.app.fileManager.processFrontMatter(file, (next) => {
      summary = updateStudyStatus(next, status, {
        now: opts.now || new Date(),
        days,
        reason: opts.reason,
      });
    });
    this.refreshViews();
    return summary;
  }

  /** The snooze a Known action will use for this note, after a course override. */
  knownDaysForFile(file) {
    const fm = file && this.app.metadataCache.getFileCache(file)?.frontmatter;
    return knownDaysForCourse(this.settings.knownDaysByCourse, fm && fm.course, this.settings.knownDays);
  }

  studyStatusNotice(summary) {
    if (!summary) return "Study status updated.";
    if (summary.status === "known") return `Known for ${summary.days} days (until ${summary.until}).`;
    if (summary.status === "excluded") return "Excluded from practice. Restore it from Manage hidden study items.";
    if (summary.status === "suspended") return "Suspended. Restore it from Manage hidden study items.";
    if (summary.status === "buried") return `Buried for today. It returns tomorrow (${summary.until}).`;
    return "Restored to practice.";
  }

  /** Put back the exact status properties captured before a Known or Exclude action. */
  async restoreStudyStatusSnapshot(file, snapshot) {
    await this.app.fileManager.processFrontMatter(file, (fm) => applyStudyStatusSnapshot(fm, snapshot));
    this.refreshViews();
  }

  /** New files written by a confirmed AI generation, recorded for one-click undo. */
  recordAiTranscriptWrite(generated, beforePaths) {
    if (!generated || !generated.ai) return null;
    const paths = this.app.vault
      .getMarkdownFiles()
      .map((file) => file.path)
      .filter((path) => !beforePaths.has(path));
    if (!paths.length) return null;
    return this.recordAiWrite(
      makeAiWriteRecord({
        kind: generated.kind,
        sourcePath: generated.sourcePath,
        model: generated.model || this.aiModelLabel("generation"),
        summary: generated.title,
        paths,
      }),
    );
  }

  recordAiSummaryNote(meta) {
    const m = meta || {};
    return this.recordAiWrite(
      makeAiWriteRecord({ kind: "summary", sourcePath: m.path, model: m.model, summary: m.title, paths: [m.path] }),
    );
  }

  aiWriteHistory() {
    return normalizeAiWrites(this.app.loadLocalStorage(AI_WRITE_STORAGE_KEY));
  }

  recordAiWrite(record) {
    const next = appendAiWrite(this.aiWriteHistory(), record);
    this.app.saveLocalStorage(AI_WRITE_STORAGE_KEY, next);
    return record;
  }

  /** Removes the files from the most recent confirmed AI generation. */
  async undoLastAiWrite() {
    const record = latestAiWrite(this.aiWriteHistory());
    if (!record) return { removed: 0, paths: [], record: null };
    const removed = [];
    if (record.kind === "summary") {
      for (const path of record.paths) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file || !/\.md$/i.test(file.path || path)) continue;
        const text = await this.app.vault.cachedRead(file);
        const cleaned = removeAiSummary(text);
        if (!cleaned.removed) continue;
        await this.app.vault.modify(file, cleaned.text);
        if (this.app.fileManager && this.app.fileManager.processFrontMatter) {
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            delete fm.ai_summary;
            delete fm.ai_model;
          });
        }
        removed.push(path);
      }
    } else {
      for (const path of record.paths) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file) continue;
        await this.app.fileManager.trashFile(file);
        removed.push(path);
      }
    }
    this.app.saveLocalStorage(AI_WRITE_STORAGE_KEY, this.aiWriteHistory().slice(1));
    if (removed.length) this.refreshViews();
    return { removed: removed.length, paths: removed, record };
  }

  async undoLastAiWriteCommand() {
    const result = await this.undoLastAiWrite();
    if (!result.record) {
      new Notice("No recent AI-generated practice notes to undo.");
      return result;
    }
    new Notice(
      result.removed
        ? result.record.kind === "summary"
          ? `Removed the AI summary from ${result.removed} note${result.removed === 1 ? "" : "s"}.`
          : `Removed ${result.removed} AI-generated note${result.removed === 1 ? "" : "s"}.`
        : result.record.kind === "summary"
          ? "That AI summary is already gone."
          : "Those generated notes are already gone.",
      6000,
    );
    return result;
  }

  /** Show the usual confirmation, plus an Undo button when there is a previous state. */
  notifyStudyStatusChange(summary, file, previous) {
    const notice = new Notice(this.studyStatusNotice(summary), 7000);
    if (!file || !previous) return notice;
    const undo = notice.noticeEl.createEl("button", { text: "Undo", cls: "qt-notice-undo" });
    undo.addEventListener("click", async () => {
      undo.disabled = true;
      try {
        await this.restoreStudyStatusSnapshot(file, previous);
        new Notice("Restored the previous study status.", 4000);
      } catch (e) {
        new Notice(str(e && e.message) || "Could not undo that change.", 6000);
      } finally {
        notice.hide();
      }
    });
    return notice;
  }

  studyStatusItems() {
    const today = localDate();
    const out = [];
    for (const q of this.getQuestions()) {
      const status = statusOf(q.fm, today);
      if (status === "active") continue;
      out.push({
        type: "Question",
        file: q.file,
        title: str(q.fm.question_id || q.file.basename),
        course: str(q.fm.course),
        meta: [q.fm.course, q.fm.skill].filter(Boolean).join(" · "),
        status,
        summary: studyStatusSummary(q.fm, today),
        fm: q.fm,
      });
    }
    for (const card of this.getCards()) {
      const status = statusOf(card.fm, today);
      if (status === "active") continue;
      out.push({
        type: card.kind === "vocab" ? "Vocabulary" : "Card",
        file: card.file,
        title: str(card.fm.card_title || card.file.basename),
        course: str(card.course),
        deck: str(card.deck),
        meta: [card.deck, card.course].filter(Boolean).join(" · "),
        status,
        summary: studyStatusSummary(card.fm, today),
        fm: card.fm,
      });
    }
    const order = { excluded: 0, suspended: 1, buried: 2, known: 3 };
    return out.sort((a, b) =>
      a.status === b.status
        ? a.title.localeCompare(b.title, undefined, { numeric: true })
        : (order[a.status] ?? 9) - (order[b.status] ?? 9)
    );
  }

  openStudyStatusManager() {
    new StudyStatusModal(this.app, this).open();
  }

  async toggleFlag(file) {
    let now = false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.flagged = fm.flagged !== true;
      now = fm.flagged;
    });
    return now;
  }

  /** Clear a needs-fixing flag without touching attempts, history or scheduling. */
  async markQuestionFixed(file, now) {
    const cached = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    if (!cached.question_id) {
      new Notice("This note is not a question.");
      return false;
    }
    if (cached.needs_fixing !== true) {
      new Notice("This question is not marked needs fixing.");
      return false;
    }
    const days = Number(cached.needs_fixing_miss_days) || 0;
    const since = str(cached.needs_fixing_since).trim();
    const detail = days ? ` after misses on ${days} different day${days === 1 ? "" : "s"}` : "";
    const ok = await this.askConfirm(
      "Mark this question fixed?",
      `This clears the needs-fixing flag${detail}${since ? ` since ${since}` : ""}. Attempts, history and scheduling are unchanged.`,
      "Mark fixed"
    );
    if (!ok) return false;
    let cleared = false;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      cleared = markNeedsFixingFixed(fm, now instanceof Date ? now : new Date()).wasFlagged;
    });
    if (cleared) {
      this.refreshViews();
      new Notice("Marked fixed. Review history is unchanged.");
    }
    return cleared;
  }

  async saveMyNotes(file, text) {
    await this.app.vault.process(file, (data) => replaceMyNotes(data, text));
  }

  /** Keep a local list bounded and tell the learner when an old record was dropped. */
  appendCapped(list, incoming, max, label) {
    const additions = Array.isArray(incoming) ? incoming : [incoming];
    const next = (Array.isArray(list) ? list : []).concat(additions);
    const dropped = Math.max(0, next.length - max);
    if (dropped) {
      new Notice(`${label} keeps the newest ${max} records; removed ${dropped} older record${dropped === 1 ? "" : "s"}.`, 7000);
    }
    return next.slice(-max);
  }

  async addStudyGoal(input) {
    const goal = studyTools.createStudyGoal(input, Date.now());
    if (!goal) return null;
    const current = this.studyToolsSettings().studyGoals;
    this.settings.studyGoals = { ...current, goals: this.appendCapped(current.goals, goal, studyTools.MAX_GOALS, "Study goals") };
    await this.save();
    this.refreshViews();
    return goal;
  }

  async updateStudyGoal(id, patch) {
    const current = this.studyToolsSettings().studyGoals;
    const goals = current.goals.map((goal) => (goal.id === id ? { ...goal, ...(patch || {}) } : goal));
    const normalized = studyTools.normalizeStudyGoals({ ...current, goals });
    this.settings.studyGoals = normalized;
    await this.save();
    this.refreshViews();
    return normalized.goals.find((goal) => goal.id === id) || null;
  }

  async addStudyGoalProgress(id, minutes) {
    const current = this.studyToolsSettings().studyGoals;
    const goal = current.goals.find((entry) => entry.id === id);
    if (!goal) return null;
    return this.updateStudyGoal(id, { minutes: Math.min(goal.targetMinutes, goal.minutes + Math.max(0, Number(minutes) || 0)) });
  }

  async removeStudyGoal(id) {
    const current = this.studyToolsSettings().studyGoals;
    this.settings.studyGoals = { ...current, goals: current.goals.filter((goal) => goal.id !== id) };
    await this.save();
    this.refreshViews();
  }

  async addStudyLecture(input) {
    const lecture = studyTools.createLecture(input, Date.now());
    if (!lecture) return null;
    const current = this.studyToolsSettings().lectureLog;
    this.settings.lectureLog = { ...current, lectures: this.appendCapped(current.lectures, lecture, studyTools.MAX_LECTURES, "Lecture log") };
    await this.save();
    this.refreshViews();
    return lecture;
  }

  async addStudyLectures(inputs) {
    const current = this.studyToolsSettings().lectureLog;
    const incoming = (Array.isArray(inputs) ? inputs : []).map((entry) => studyTools.createLecture(entry, Date.now())).filter(Boolean);
    if (!incoming.length) return 0;
    const before = current.lectures.length;
    this.settings.lectureLog = studyTools.normalizeLectureLog({ ...current, lectures: this.appendCapped(current.lectures, incoming, studyTools.MAX_LECTURES, "Lecture log") });
    await this.save();
    this.refreshViews();
    return this.settings.lectureLog.lectures.length - before;
  }

  async removeStudyLecture(id) {
    const current = this.studyToolsSettings().lectureLog;
    this.settings.lectureLog = { ...current, lectures: current.lectures.filter((lecture) => lecture.id !== id) };
    await this.save();
    this.refreshViews();
  }

  /* ---- read aloud, lecture compiler and audio bookmarks */

  readAloudSettings() {
    return readAloud.normalizeReadAloudSettings(this.settings.readAloud);
  }

  async updateReadAloud(patch) {
    this.settings.readAloud = readAloud.normalizeReadAloudSettings({ ...this.readAloudSettings(), ...(patch || {}) });
    await this.save();
    this.refreshViews();
    return this.settings.readAloud;
  }

  /** Write the compiled lecture note, never overwriting an existing file. */
  async saveCompiledLectureNote(compiled) {
    const source = compiled && typeof compiled === "object" ? compiled : null;
    if (!source || !str(source.markdown).trim()) return null;
    const settings = lectureCompiler.normalizeLectureCompilerSettings(this.settings.lectureCompiler);
    const folder = str(source.folder).trim() || settings.folder;
    if (folder) await ensureFolder(this.app, folder);
    const base = lectureCompiler.safeFileTitle(source.fileTitle || source.title);
    const prefix = folder ? `${folder}/` : "";
    let path = `${prefix}${base}.md`;
    for (let n = 2; this.app.vault.getAbstractFileByPath(path) && n < 100; n++) path = `${prefix}${base} ${n}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) return null;
    await this.app.vault.create(path, source.markdown);
    await this.markLecturesProcessed(source.lectureIds, path);
    new Notice(`Saved ${path}.`);
    return path;
  }

  /** Remember which lectures produced a compiled note, without rewriting old rows. */
  async markLecturesProcessed(ids, path) {
    const target = str(path).trim();
    const wanted = new Set((Array.isArray(ids) ? ids : []).map((id) => str(id).trim()).filter(Boolean));
    if (!wanted.size || !target) return 0;
    const current = this.studyToolsSettings().lectureLog;
    const on = localDate();
    let changed = 0;
    const lectures = current.lectures.map((lecture) => {
      if (!wanted.has(lecture.id)) return lecture;
      if (lecture.processed && lecture.processedPath === target) return lecture;
      changed += 1;
      return studyTools.normalizeLecture({ ...lecture, processed: true, processedOn: on, processedPath: target });
    });
    if (!changed) return 0;
    this.settings.lectureLog = studyTools.normalizeLectureLog({ ...current, lectures });
    await this.save();
    return changed;
  }

  /* ---- local reading library (Verso library, shelves and quotes) */

  readingLibrarySettings() {
    return readingLibrary.normalizeLibrary(this.settings.readingLibrary);
  }

  async addReadingBook(input) {
    const book = readingLibrary.createBook(input, localDate());
    if (!book) return null;
    const current = this.readingLibrarySettings();
    if (current.books.some((entry) => entry.id === book.id)) return null;
    this.settings.readingLibrary = readingLibrary.normalizeLibrary({ ...current, books: this.appendCapped(current.books, book, readingLibrary.MAX_BOOKS, "Reading library") });
    await this.save();
    this.refreshViews();
    return book;
  }

  async updateReadingBook(id, patch) {
    const current = this.readingLibrarySettings();
    const before = current.books.find((book) => book.id === id);
    if (!before) return null;
    const books = readingLibrary.updateBook(current.books, id, patch, localDate());
    const after = books.find((book) => book.id === id) || null;
    this.settings.readingLibrary = { ...current, books };
    await this.save();
    this.refreshViews();
    if (after && before.status !== "finished" && after.status === "finished") {
      new Notice(`Finished "${after.title}". Add a quote while it is fresh.`);
    }
    return after;
  }

  async removeReadingBook(id) {
    const current = this.readingLibrarySettings();
    this.settings.readingLibrary = { ...current, books: readingLibrary.removeBook(current.books, id) };
    await this.save();
    this.refreshViews();
  }

  async setReadingProgress(id, page) {
    return this.updateReadingBook(id, { currentPage: page });
  }

  async addReadingQuote(bookId, input) {
    const current = this.readingLibrarySettings();
    const result = readingLibrary.addQuote(current.books, bookId, input, localDate());
    if (!result.quote) return null;
    this.settings.readingLibrary = { ...current, books: result.books };
    await this.save();
    this.refreshViews();
    return result.quote;
  }

  async removeReadingQuote(bookId, quoteId) {
    const current = this.readingLibrarySettings();
    this.settings.readingLibrary = { ...current, books: readingLibrary.removeQuote(current.books, bookId, quoteId) };
    await this.save();
    this.refreshViews();
  }

  async addAudioBookmark(input) {
    const entry = audioBookmarks.addAudioBookmark(input, Date.now());
    if (!entry) return null;
    const current = audioBookmarks.normalizeAudioBookmarkSettings(this.settings.audioBookmarks);
    if (current.entries.some((existing) => existing.path === entry.path && existing.at === entry.at && existing.label === entry.label)) return entry;
    this.settings.audioBookmarks = audioBookmarks.normalizeAudioBookmarkSettings({
      ...current,
      entries: current.entries.concat(entry).slice(-audioBookmarks.MAX_BOOKMARKS),
    });
    await this.save();
    this.refreshViews();
    return entry;
  }

  async removeAudioBookmark(id) {
    const current = audioBookmarks.normalizeAudioBookmarkSettings(this.settings.audioBookmarks);
    this.settings.audioBookmarks = audioBookmarks.normalizeAudioBookmarkSettings({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  /* ---- Feynman AI second opinion and PDF annotation index */

  /** Ask the configured AI for a second opinion; the manual score is untouched. */
  async scoreFeynmanSessionAi(id) {
    const current = this.studyWorkspaceSettings().feynmanLearning;
    const session = current.sessions.find((entry) => entry.id === id);
    if (!session) return null;
    const request = feynmanAi.buildFeynmanScoreRequest(session);
    if (!request) return null;
    const reply = await this.aiComplete(request.system, request.user, { feature: "generation", maxTokens: 400 });
    const result = feynmanAi.parseFeynmanScoreReply(reply);
    const scored = feynmanAi.mergeFeynmanAiResult(session, result, Date.now());
    const sessions = current.sessions.map((entry) => (entry.id === id ? scored : entry));
    this.settings.feynmanLearning = studyWorkspace.normalizeFeynmanSettings({ ...current, sessions });
    await this.save();
    this.refreshViews();
    return this.settings.feynmanLearning.sessions.find((entry) => entry.id === id) || null;
  }

  async clearFeynmanAiFeedback(id) {
    const current = this.studyWorkspaceSettings().feynmanLearning;
    const sessions = current.sessions.map((entry) => (entry.id === id ? { ...entry, aiScores: null, aiAverage: 0, aiFeedback: "", aiScoredAt: 0 } : entry));
    this.settings.feynmanLearning = studyWorkspace.normalizeFeynmanSettings({ ...current, sessions });
    await this.save();
    this.refreshViews();
  }

  /** Read-only: list the PDF annotation sidecars already in the vault. */
  voiceMemoSettings() {
    return voiceMemo.normalizeVoiceMemoSettings(this.settings.voiceMemo);
  }

  async updateVoiceMemo(patch) {
    this.settings.voiceMemo = voiceMemo.normalizeVoiceMemoSettings({ ...this.voiceMemoSettings(), ...(patch || {}) });
    await this.save();
    this.refreshViews();
    return this.settings.voiceMemo;
  }

  /**
   * Save a recorded memo into the vault and, when a daily-note folder is set,
   * append one timestamped line. Nothing is transcribed or uploaded.
   */
  async saveVoiceMemo(input) {
    const source = input && typeof input === "object" ? input : {};
    const settings = this.voiceMemoSettings();
    if (!source.data || typeof source.data.byteLength !== "number" || !source.data.byteLength) {
      return { ok: false, reason: "empty", message: "Nothing was recorded." };
    }
    const when = source.date instanceof Date ? source.date : new Date();
    const base = voiceMemo.memoPath(settings.folder, when, source.mimeType);
    if (!base) return { ok: false, reason: "path", message: "Set a safe memo folder in the Read aloud settings." };
    let path = base;
    for (let n = 2; this.app.vault.getAbstractFileByPath(path) && n < 21; n++) {
      path = base.replace(/(\.[a-z0-9]+)$/i, " " + n + "$1");
    }
    if (this.app.vault.getAbstractFileByPath(path)) {
      return { ok: false, reason: "exists", message: "A recording with that name already exists." };
    }
    const folder = path.slice(0, path.lastIndexOf("/"));
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch (e) {
        /* the folder may already exist after a sync */
      }
    }
    if (typeof this.app.vault.createBinary !== "function") {
      return { ok: false, reason: "unsupported", message: "This vault cannot save audio files." };
    }
    await this.app.vault.createBinary(path, source.data);
    const notePath = timeBlocks.dailyNotePath(voiceMemo.dayKey(when), settings.dailyNoteFolder);
    const entry = notePath ? voiceMemo.memoEntry({ time: voiceMemo.memoTime(when), path, seconds: source.durationSeconds, label: source.label }) : "";
    if (notePath) {
      const note = this.app.vault.getAbstractFileByPath(notePath);
      if (note) {
        const text = await this.app.vault.read(note);
        await this.app.vault.modify(note, voiceMemo.appendMemoEntry(text, entry));
      } else {
        const noteFolder = notePath.slice(0, notePath.lastIndexOf("/"));
        if (noteFolder && !this.app.vault.getAbstractFileByPath(noteFolder)) {
          try {
            await this.app.vault.createFolder(noteFolder);
          } catch (e) {
            /* the folder may already exist after a sync */
          }
        }
        await this.app.vault.create(notePath, "# " + voiceMemo.dayKey(when) + "\n\n" + entry + "\n");
      }
    }
    this.refreshViews();
    return { ok: true, path, notePath, entry };
  }

  /** Read-only scan of Markdown checkbox lines; nothing is written. */
  async scanVaultTasks(options) {
    const settings = vaultTaskIndex.normalizeVaultTaskIndexOptions(options);
    const entries = [];
    const files = this.app.vault.getMarkdownFiles ? this.app.vault.getMarkdownFiles() : [];
    for (const file of files) {
      if (entries.length >= vaultTaskIndex.MAX_FILES) break;
      if (settings.folder && !(file.path === settings.folder || file.path.startsWith(settings.folder + "/"))) continue;
      let text = "";
      try {
        text = await this.app.vault.cachedRead(file);
      } catch (e) {
        continue;
      }
      entries.push({ path: file.path, text });
    }
    return vaultTaskIndex.collectVaultTasks(entries, settings);
  }

  /** Read-only glossary from `Term: definition` lines and two-column tables. */
  async scanGlossary(options) {
    const settings = glossary.normalizeGlossaryOptions(options);
    const entries = [];
    const files = this.app.vault.getMarkdownFiles ? this.app.vault.getMarkdownFiles() : [];
    for (const file of files) {
      if (entries.length >= glossary.MAX_FILES) break;
      if (settings.folder && !(file.path === settings.folder || file.path.startsWith(settings.folder + "/"))) continue;
      let text = "";
      try {
        text = await this.app.vault.cachedRead(file);
      } catch (e) {
        continue;
      }
      entries.push({ path: file.path, text });
    }
    const words = this.studyWorkspaceSettings().vocabulary.words.map((word) => ({
      term: word.term,
      definition: word.definition,
      source: "vocabulary",
    }));
    return glossary.collectGlossary(entries, settings, words);
  }

  /* ---- Offline WordNet dictionary ------------------------------------- */

  wordNetSettings() {
    return wordnet.normalizeWordNetSettings(this.settings.wordNet);
  }

  wordNetStatus() {
    const settings = this.wordNetSettings();
    const loaded = !!(this.wordNetIndex && this.wordNetIndex.ok);
    return {
      enabled: settings.enabled,
      folder: settings.folder,
      loaded,
      loadedAt: loaded ? this.wordNetLoadedAt : 0,
      stats: loaded ? this.wordNetIndex.stats : null,
    };
  }

  wordNetLookup(query) {
    return wordnet.lookupWord(this.wordNetIndex, query);
  }

  /* ---- Table commands: palette, panel and editor cursor ----------------- */

  /** The active Markdown editor and its note text, or null. */
  activeEditorContext() {
    const active = this.app.workspace && this.app.workspace.activeEditor;
    const editor = active && active.editor;
    const file = active && active.file;
    if (!editor || !file || typeof editor.getValue !== "function") return null;
    return { editor, file, path: str(file.path), text: str(editor.getValue()) };
  }

  /** The editor context plus the table under the cursor, TBLFM lines included. */
  activeTableContext() {
    const context = this.activeEditorContext();
    if (!context) return null;
    const cursor = typeof context.editor.getCursor === "function" ? context.editor.getCursor() : null;
    const line = cursor && Number.isInteger(cursor.line) ? cursor.line : -1;
    const table = tableEditor.tableAtLine(context.text, line);
    if (!table) return null;
    return { ...context, cursor, line, table };
  }

  /**
   * Upstream warns when a navigation command also has its key binding on, since
   * one press can move twice. Mobile has no physical keys, so it stays quiet.
   */
  noticeDoubleBinding(action) {
    const settings = this.tableEditorSettings();
    const platform = require("obsidian").Platform;
    if (platform && platform.isMobile) return false;
    let message = "";
    if (action === "next-cell" && settings.bindTab !== false) {
      message = "Advanced Tables: Next cell also bound to tab. Possibly producing double actions. See Advanced Tables settings.";
    } else if (action === "previous-cell" && settings.bindTab !== false) {
      message = "Advanced Tables: Previous cell also bound to shift+tab. Possibly producing double actions. See Advanced Tables settings.";
    } else if (action === "next-row" && settings.bindEnter !== false) {
      message = "Advanced Tables: Next row also bound to enter. Possibly producing double actions. See Advanced Tables settings.";
    }
    if (!message) return false;
    new Notice(message);
    return true;
  }

  /** Runs one palette, panel or toolbar action against the cursor's table. */
  runTableAction(action) {
    const id = str(action).trim().replace(/^tables-/, "");
    const editorContext = id === "next-cell" || id === "format" ? this.activeEditorContext() : null;
    if (editorContext) {
      const cursor = typeof editorContext.editor.getCursor === "function" ? editorContext.editor.getCursor() : null;
      const line = cursor && Number.isInteger(cursor.line) ? cursor.line : -1;
      if (!tableEditor.tableAtLine(editorContext.text, line) && tableEditor.tableDraftAtLine(editorContext.text, line)) {
        const settings = this.tableEditorSettings();
        const started = tableEditor.startTable(editorContext.text, line, {
          pad: settings.padCells !== false,
          addColumn: id === "next-cell",
        });
        if (started.ok) {
          return this.writeTableResult({ ...editorContext, cursor }, started).then(() => {
            if (typeof editorContext.editor.setCursor === "function") editorContext.editor.setCursor({ line: started.rowLine, ch: started.ch });
            if (id === "format") new Notice("Table formatted.");
            return started;
          });
        }
      }
    }
    const context = this.activeTableContext();
    if (!context) {
      const message = "Put the cursor in a table first.";
      new Notice(message);
      return Promise.resolve({ ok: false, reason: "not-table", message });
    }
    const line = context.line;
    const ch = context.cursor && Number.isInteger(context.cursor.ch) ? context.cursor.ch : 0;
    const start = context.table.start;
    if (id === "escape") return Promise.resolve(this.escapeTable(context));
    if (id === "format") return this.formatTable(context);
    if (id === "export-csv") return Promise.resolve(this.openTableCsv(context.table));
    if (id === "next-cell" || id === "previous-cell" || id === "next-row") return Promise.resolve(this.moveTableCell(context, id));
    const at = tableEditor.cellAtLine(context.text, line, ch);
    if (!at) {
      // Upstream's cursorIsInTableFormula offers evaluate-formulas on the TBLFM
      // line, where there is no cell; the table is still the one above it.
      if (id === "formulas") return this.updateTableFormulas(context.path, start, context.table);
      const message = "Put the cursor in one of the table rows first.";
      new Notice(message);
      return Promise.resolve({ ok: false, reason: "not-row", message });
    }
    const row = at.row;
    const column = at.column;
    const structure = {
      "insert-row-above": "row-insert-above",
      "insert-row-below": "row-insert-below",
      "insert-column-left": "column-insert-left",
      "insert-column-right": "column-insert-right",
      "delete-row": "row-delete",
      "delete-column": "column-delete",
      "move-row-up": "row-move-up",
      "move-row-down": "row-move-down",
      "move-column-left": "column-move-left",
      "move-column-right": "column-move-right",
    };
    if (structure[id]) return this.updateTableStructure(context.path, start, context.table, structure[id], row, column);
    const alignment = { "align-left": "left", "align-center": "center", "align-right": "right", "align-default": "none" };
    if (alignment[id]) return this.updateTableAlignment(context.path, start, context.table, alignment[id], column);
    if (id === "sort-asc" || id === "sort-desc") return this.updateTableSort(context.path, start, context.table, id === "sort-asc" ? "asc" : "desc", column);
    if (id === "transpose") return this.updateTableTranspose(context.path, start, context.table);
    if (id === "formulas") return this.updateTableFormulas(context.path, start, context.table);
    return Promise.resolve({ ok: false, reason: "action", message: "Unknown table action." });
  }

  /**
   * Tab, Shift+Tab, Enter and Shift+Enter inside a Markdown source-editor table.
   *
   * Runs in the capture phase, before CodeMirror's own Tab handling, so the
   * same keys indent and split lines normally when the cursor is outside a
   * table or the matching setting is off. Rendered reading-view cells keep
   * their own handler, so a target inside a `td`/`th` is left alone.
   */
  onTableEditorKeydown(event) {
    if (!event || event.defaultPrevented === true) return false;
    const settings = this.tableEditorSettings();
    if (!settings.enabled) return false;
    const key = str(event.key);
    if (key !== "Tab" && key !== "Enter") return false;
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (key === "Tab" && settings.bindTab === false) return false;
    if (key === "Enter" && settings.bindEnter === false) return false;
    const target = event.target;
    if (!target || typeof target.closest !== "function") return false;
    if (!target.closest(".cm-editor")) return false;
    if (target.closest("td") || target.closest("th")) return false;
    const context = this.activeEditorContext();
    if (!context) return false;
    const editor = context.editor;
    if (typeof editor.getCursor !== "function") return false;
    if (typeof editor.somethingSelected === "function" && editor.somethingSelected()) return false;
    const cursor = editor.getCursor();
    if (!cursor || !Number.isInteger(cursor.line)) return false;
    const ch = Number.isInteger(cursor.ch) ? cursor.ch : 0;
    if (!tableEditor.tableAtLine(context.text, cursor.line)) {
      // A bare pipe is a table being written: Tab finishes the header and the
      // delimiter row and moves into the next heading, as upstream's next cell
      // does. Anything else keeps the editor's own key handling.
      if (key !== "Tab" || event.shiftKey === true) return false;
      const started = tableEditor.startTable(context.text, cursor.line, { pad: settings.padCells !== false });
      if (!started.ok) return false;
      event.preventDefault();
      if (typeof event.stopPropagation === "function") event.stopPropagation();
      Promise.resolve(this.writeTableResult(context, started)).then(() => {
        if (typeof editor.setCursor === "function") editor.setCursor({ line: started.rowLine, ch: started.ch });
      });
      return true;
    }
    const shifted = event.shiftKey === true;
    let move;
    if (key === "Tab") {
      move = shifted
        ? tableEditor.previousCellTarget(context.text, cursor.line, ch)
        : tableEditor.nextCellTarget(context.text, cursor.line, ch);
    } else if (shifted) {
      move = tableEditor.previousRowTarget(context.text, cursor.line, ch);
      if (!move.ok) {
        event.preventDefault();
        if (typeof event.stopPropagation === "function") event.stopPropagation();
        this.escapeTable({ ...context, cursor });
        return true;
      }
    } else {
      move = tableEditor.nextRowTarget(context.text, cursor.line, ch);
    }
    if (!move || !move.ok) return false;
    let written = null;
    if (move.append) {
      written = tableEditor.appendTableRow(context.text, cursor.line);
      if (!written.ok) return false;
    } else if (move.addColumn) {
      written = tableEditor.addTableColumn(context.text, cursor.line, { pad: settings.padCells !== false });
      if (!written.ok) return false;
    }
    event.preventDefault();
    if (typeof event.stopPropagation === "function") event.stopPropagation();
    if (!written) {
      if (typeof editor.setCursor === "function") editor.setCursor({ line: move.line, ch: move.ch });
      return true;
    }
    Promise.resolve(this.writeTableResult(context, written)).then(() => {
      if (typeof editor.setCursor === "function") editor.setCursor({ line: written.rowLine, ch: written.ch || 0 });
    });
    return true;
  }

  /** Tab, Shift+Tab and Enter inside the source editor; adds a row at the end. */
  moveTableCell(context, action) {
    const cursor = context.cursor || { line: context.line, ch: 0 };
    const target = action === "next-cell"
      ? tableEditor.nextCellTarget(context.text, cursor.line, cursor.ch)
      : action === "previous-cell"
        ? tableEditor.previousCellTarget(context.text, cursor.line, cursor.ch)
        : tableEditor.nextRowTarget(context.text, cursor.line, cursor.ch);
    if (!target.ok) {
      if (target.message) new Notice(target.message);
      return target;
    }
    if (target.addColumn) {
      const added = tableEditor.addTableColumn(context.text, cursor.line, { pad: this.tableEditorSettings().padCells !== false });
      if (!added.ok) {
        if (added.message) new Notice(added.message);
        return added;
      }
      return this.writeTableResult(context, added).then(() => {
        if (typeof context.editor.setCursor === "function") context.editor.setCursor({ line: added.rowLine, ch: added.ch });
        return { ok: true, added: true, line: added.rowLine, column: added.column };
      });
    }
    if (!target.append) {
      if (typeof context.editor.setCursor === "function") context.editor.setCursor({ line: target.line, ch: target.ch });
      return { ok: true, line: target.line, ch: target.ch };
    }
    const appended = tableEditor.appendTableRow(context.text, cursor.line);
    if (!appended.ok) {
      if (appended.message) new Notice(appended.message);
      return appended;
    }
    return this.writeTableResult(context, appended).then(() => {
      if (typeof context.editor.setCursor === "function") context.editor.setCursor({ line: appended.rowLine, ch: appended.column });
      return { ok: true, appended: true, line: appended.rowLine };
    });
  }

  /** Moves the cursor to the line after the table, adding a blank line if needed. */
  escapeTable(context) {
    const cursor = context.cursor || { line: context.line, ch: 0 };
    const target = tableEditor.escapeTableTarget(context.text, cursor.line);
    if (!target.ok) {
      if (target.message) new Notice(target.message);
      return target;
    }
    const editor = context.editor;
    if (target.insert && typeof editor.replaceRange === "function" && typeof editor.getLine === "function") {
      const endLine = context.table.end;
      editor.replaceRange("\n", { line: endLine, ch: str(editor.getLine(endLine)).length });
    }
    if (typeof editor.setCursor === "function") editor.setCursor({ line: target.line, ch: 0 });
    return { ok: true, line: target.line };
  }

  /** Re-renders the cursor's table with padded, aligned cells. */
  async formatTable(context) {
    const settings = this.tableEditorSettings();
    const result = await this.updateTableBlock(context.path, context.table.start, context.table, (current, startLine) =>
      tableEditor.formatTableAt(current, startLine, { pad: settings.padCells !== false })
    );
    if (result && result.ok) new Notice(result.changed ? "Table formatted." : "The table is already formatted.");
    else if (result && result.message) new Notice(result.message);
    return result;
  }

  /** Re-renders every table in the open note. */
  async formatAllTablesInNote() {
    const context = this.activeEditorContext();
    if (!context) {
      const message = "Open a note with tables first.";
      new Notice(message);
      return { ok: false, reason: "no-editor", message };
    }
    const settings = this.tableEditorSettings();
    const result = tableEditor.formatAllTables(context.text, { pad: settings.padCells !== false });
    if (!result.ok) {
      if (result.message) new Notice(result.message);
      return result;
    }
    if (!result.changed) {
      new Notice("Every table is already formatted.");
      return result;
    }
    const editor = context.editor;
    if (editor && typeof editor.setValue === "function") editor.setValue(result.text);
    else if (context.file && this.app.vault && typeof this.app.vault.modify === "function") await this.app.vault.modify(context.file, result.text);
    else return { ok: false, reason: "write", message: "This note cannot be written." };
    new Notice(`Formatted ${result.tables} ${result.tables === 1 ? "table" : "tables"}.`);
    return result;
  }

  /** Writes a table result through the editor or the vault, like updateTableBlock. */
  async writeTableResult(context, result) {
    if (!result || !result.ok || !result.changed) return result || { ok: false, reason: "change" };
    const editor = context.editor;
    if (editor && typeof editor.replaceRange === "function" && typeof editor.getLine === "function") {
      const nextLine = editor.getLine(result.endLine + 1);
      const hasNextLine = nextLine !== undefined && nextLine !== null;
      editor.replaceRange(
        result.replacement.replace(/\r\n/g, "\n") + (hasNextLine ? "\n" : ""),
        { line: result.startLine, ch: 0 },
        hasNextLine ? { line: result.endLine + 1, ch: 0 } : { line: result.endLine, ch: str(editor.getLine(result.endLine)).length }
      );
      return result;
    }
    if (context.file && this.app.vault && typeof this.app.vault.modify === "function") {
      await this.app.vault.modify(context.file, result.text);
      return result;
    }
    return { ok: false, reason: "write", message: "This note cannot be written." };
  }

  /** Opens the CSV dialog for one table, with the header-row switch. */
  openTableCsv(table) {
    if (!table || !Array.isArray(table.rows)) return { ok: false, reason: "table", message: "The table is no longer available." };
    const modal = new TableCsvModal(this.app, table);
    modal.open();
    return { ok: true, modal };
  }

  /** Opens or reveals the docked table controls panel. */
  async openTableControls() {
    const workspace = this.app.workspace;
    if (!workspace) return null;
    const existing = typeof workspace.getLeavesOfType === "function" ? workspace.getLeavesOfType(VIEW_TYPE_TABLE_CONTROLS) : [];
    if (existing && existing.length) {
      if (typeof workspace.revealLeaf === "function") workspace.revealLeaf(existing[0]);
      return existing[0];
    }
    const leaf = typeof workspace.getRightLeaf === "function" ? workspace.getRightLeaf(false) : null;
    if (!leaf || typeof leaf.setViewState !== "function") return null;
    await leaf.setViewState({ type: VIEW_TYPE_TABLE_CONTROLS, active: true });
    if (typeof workspace.revealLeaf === "function") workspace.revealLeaf(leaf);
    return leaf;
  }

  /** Adds or removes the ribbon button after the settings change. */
  async onTableEditorToggled() {
    const settings = this.tableEditorSettings();
    const wanted = settings.enabled && settings.showRibbon;
    if (wanted && !this._tableRibbon) {
      this._tableRibbon = this.addRibbonIcon("table", "Advanced Tables: controls", () => this.openTableControls());
    } else if (!wanted && this._tableRibbon) {
      if (typeof this._tableRibbon.remove === "function") this._tableRibbon.remove();
      this._tableRibbon = null;
    }
    if (typeof this.refreshViews === "function") this.refreshViews();
  }

  /* ---- In-place rendered-table editing -------------------------------- */

  tableEditorSettings() {
    return tableEditor.normalizeTableEditorSettings(this.settings.tableEditor);
  }

  /** Attach editing only to rendered tables in a real reading view note. */
  decorateTableEditor(el, ctx) {
    if (!this.tableEditorEnabled() || !el) return;
    if (typeof el.closest === "function" && el.closest(".markdown-embed")) return;
    const root = typeof el.closest === "function" ? el.closest(".markdown-preview-view") || el.closest(".markdown-reading-view") : null;
    if (!root) return;
    const tables = typeof el.querySelectorAll === "function" ? Array.from(el.querySelectorAll("table")) : [];
    if (!tables.length) return;
    const sourcePath = str(ctx && ctx.sourcePath).trim();
    if (!sourcePath) return;
    const info = typeof ctx.getSectionInfo === "function" ? ctx.getSectionInfo(el) : null;
    if (!info || !info.text) return;
    const parsed = tableEditor.parseTables(info.text);
    if (!parsed.length) return;
    const lineStart = Math.max(0, Math.round(Number(info.lineStart) || 0));
    tables.forEach((tableEl, index) => {
      const table = tableEditor.findTable(parsed, tableEditor.renderedHeader(tableEl), index);
      if (!table) return;
      const tableSettings = this.tableEditorSettings();
      tableEditor.decorateTable(tableEl, {
        table,
        bindTab: tableSettings.bindTab,
        bindEnter: tableSettings.bindEnter,
        commit: (row, column, value) => this.updateTableCell(sourcePath, lineStart, table, row, column, value),
        structure: (action, row, column) => this.updateTableStructure(sourcePath, lineStart, table, action, row, column),
        format: (value, row, column) => this.updateTableCellFormat(sourcePath, lineStart, table, value, row, column),
        align: (value, column) => this.updateTableAlignment(sourcePath, lineStart, table, value, column),
        sort: (direction, column) => this.updateTableSort(sourcePath, lineStart, table, direction, column),
        formula: () => this.updateTableFormulas(sourcePath, lineStart, table),
        exportCsv: () => this.exportTableCsv(sourcePath, lineStart, table),
        importData: (mode) => this.importTableCsv(sourcePath, lineStart, table, mode),
        transpose: () => this.updateTableTranspose(sourcePath, lineStart, table),
        toggleHeader: () => this.updateTableHeader(sourcePath, lineStart, table),
        counts: () => this.reportTableCounts(table),
        onError: (message) => {
          if (message) new Notice(message);
        },
      });
    });
  }

  /** Rewrites one table block in the note, preferring the live editor over disk. */
  async updateTableCell(sourcePath, sectionStart, table, row, column, value) {
    return this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableText(current, startLine, row, column, value, expected)
    );
  }

  /** Applies a row/column insertion, deletion or move through the same write path. */
  async updateTableStructure(sourcePath, sectionStart, table, action, row, column) {
    return this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableStructure(current, startLine, expected, action, row, column)
    );
  }

  /** Toggles one cell format through the same queue and write path. */
  async updateTableCellFormat(sourcePath, sectionStart, table, format, row, column) {
    return this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableFormat(current, startLine, expected, row, column, format)
    );
  }

  /** Sets one column alignment through the same queue and write path. */
  async updateTableAlignment(sourcePath, sectionStart, table, alignment, column) {
    return this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableAlignment(current, startLine, expected, column, alignment)
    );
  }

  /** Sorts body rows through the same queue and write path as every table edit. */
  async updateTableSort(sourcePath, sectionStart, table, direction, column) {
    const result = await this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableSort(current, startLine, expected, column, direction)
    );
    if (result && result.ok) {
      const label = table && Array.isArray(table.header) && table.header[column] !== undefined
        ? String(table.header[column]).trim() || `column ${column + 1}`
        : `column ${column + 1}`;
      new Notice(result.changed ? `Sorted by ${label} ${direction === "asc" ? "ascending" : "descending"}.` : "The table is already sorted.");
    }
    return result;
  }

  /** Recalculates TBLFM formulas through the same queue and write path. */
  async updateTableFormulas(sourcePath, sectionStart, table) {
    const result = await this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableFormulas(current, startLine, expected)
    );
    if (result && result.ok) {
      new Notice(result.changed ? "Table formulas evaluated." : "Table formulas are already up to date.");
    }
    return result;
  }

  /** Imports pasted CSV/TSV through the same queue and write path as an edit. */
  async importTableCsv(sourcePath, sectionStart, table, mode) {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
    if (!clipboard || typeof clipboard.readText !== "function") {
      return { ok: false, reason: "clipboard", message: "Clipboard access is unavailable." };
    }
    let input = "";
    try {
      input = str(await clipboard.readText());
    } catch (e) {
      return { ok: false, reason: "clipboard", message: `Could not read the clipboard: ${str(e && e.message ? e.message : e)}` };
    }
    const result = await this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableCsvImport(current, startLine, expected, input, mode)
    );
    if (result && result.ok) {
      if (!result.changed) new Notice("The pasted rows are already in the table.");
      else new Notice(`Imported ${result.imported} ${result.imported === 1 ? "row" : "rows"} from the clipboard.`);
    }
    return result;
  }

  /** Transposes the table through the same queue and write path. */
  async updateTableTranspose(sourcePath, sectionStart, table) {
    const result = await this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableTranspose(current, startLine, expected)
    );
    if (result && result.ok) new Notice("Table transposed.");
    return result;
  }

  /** Toggles the header row through the same queue and write path. */
  async updateTableHeader(sourcePath, sectionStart, table) {
    const result = await this.updateTableBlock(sourcePath, sectionStart, table, (current, startLine, expected) =>
      tableEditor.updateTableHeader(current, startLine, expected)
    );
    if (result && result.ok) {
      new Notice(result.header === "on" ? "Header row restored." : "Header row removed; its values are now the first body row.");
    }
    return result;
  }

  /** Reports the table's shape without writing anything. */
  reportTableCounts(table) {
    const counts = tableEditor.tableCounts(table);
    new Notice(counts.ok ? counts.label : counts.message);
    return counts;
  }

  /** Copies the current table as CSV without changing the note. */
  async exportTableCsv(sourcePath, sectionStart, table) {
    const path = str(sourcePath).trim();
    if (!path) return { ok: false, reason: "path", message: "The note path is unavailable." };
    if (!table || !Array.isArray(table.rows)) return { ok: false, reason: "table", message: "The table is no longer available." };
    const task = async () => {
      const file = this.app.vault.getAbstractFileByPath ? this.app.vault.getAbstractFileByPath(path) : null;
      if (!file) return { ok: false, reason: "file", message: `Could not find ${path}.` };
      const active = this.app.workspace && this.app.workspace.activeEditor;
      const editor = active && active.file && active.file.path === path && active.editor ? active.editor : null;
      let current = "";
      if (editor && typeof editor.getValue === "function") current = str(editor.getValue());
      else {
        try {
          current = await this.app.vault.read(file);
        } catch (e) {
          return { ok: false, reason: "read", message: `Could not read ${path}: ${str(e && e.message ? e.message : e)}` };
        }
      }
      const startLine = Number.isFinite(Number(sectionStart)) ? Math.max(0, Math.round(Number(sectionStart))) : table.start;
      let result;
      try {
        result = tableEditor.tableCsvAt(current, startLine, table);
      } catch (e) {
        return { ok: false, reason: "export", message: `Could not export ${path}: ${str(e && e.message ? e.message : e)}` };
      }
      if (!result || !result.ok) return result || { ok: false, reason: "export", message: "The table could not be exported." };
      const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
      if (!clipboard || typeof clipboard.writeText !== "function") {
        return { ok: false, reason: "clipboard", message: "Clipboard access is unavailable." };
      }
      try {
        await clipboard.writeText(result.csv);
      } catch (e) {
        return { ok: false, reason: "clipboard", message: `Could not copy the table as CSV: ${str(e && e.message ? e.message : e)}` };
      }
      new Notice("Table copied as CSV.");
      return { ok: true, csv: result.csv };
    };
    const next = this._tableEditQueue.then(task, task);
    this._tableEditQueue = next.catch(() => {});
    return next;
  }

  async updateTableBlock(sourcePath, sectionStart, table, update) {
    const path = str(sourcePath).trim();
    if (!path) return { ok: false, reason: "path", message: "The note path is unavailable." };
    if (!table || !Array.isArray(table.rows)) return { ok: false, reason: "table", message: "The table is no longer available." };
    if (typeof update !== "function") return { ok: false, reason: "update", message: "The table change is unavailable." };
    const task = async () => {
      const file = this.app.vault.getAbstractFileByPath ? this.app.vault.getAbstractFileByPath(path) : null;
      if (!file) return { ok: false, reason: "file", message: `Could not find ${path}.` };
      const active = this.app.workspace && this.app.workspace.activeEditor;
      const editor = active && active.file && active.file.path === path && active.editor ? active.editor : null;
      let current = "";
      if (editor && typeof editor.getValue === "function") current = str(editor.getValue());
      else {
        try {
          current = await this.app.vault.read(file);
        } catch (e) {
          return { ok: false, reason: "read", message: `Could not read ${path}: ${str(e && e.message ? e.message : e)}` };
        }
      }
      const startLine = Number.isFinite(Number(sectionStart)) ? Math.max(0, Math.round(Number(sectionStart))) : table.start;
      let result;
      try {
        result = update(current, startLine, table);
      } catch (e) {
        return { ok: false, reason: "change", message: `Could not change ${path}: ${str(e && e.message ? e.message : e)}` };
      }
      if (!result || !result.ok || !result.changed) return result || { ok: false, reason: "change", message: "The table change was not available." };
      const canUseEditor = editor && typeof editor.replaceRange === "function" && typeof editor.getLine === "function";
      if (canUseEditor) {
        const nextLine = editor.getLine(result.endLine + 1);
        const hasNextLine = nextLine !== undefined && nextLine !== null;
        const from = { line: result.startLine, ch: 0 };
        const to = hasNextLine
          ? { line: result.endLine + 1, ch: 0 }
          : { line: result.endLine, ch: str(editor.getLine(result.endLine)).length };
        // CodeMirror uses \n even when the file on disk uses CRLF.
        editor.replaceRange(result.replacement.replace(/\r\n/g, "\n") + (hasNextLine ? "\n" : ""), from, to);
      } else {
        try {
          await this.app.vault.modify(file, result.text);
        } catch (e) {
          return { ok: false, reason: "write", message: `Could not save ${path}: ${str(e && e.message ? e.message : e)}` };
        }
      }
      return result;
    };
    const next = this._tableEditQueue.then(task, task);
    this._tableEditQueue = next.catch(() => {});
    return next;
  }

  async loadWordNet(folder) {
    const target = wordnet.normalizeFolder(folder || this.wordNetSettings().folder);
    const files = this.app.vault.getFiles ? this.app.vault.getFiles() : [];
    const byPath = new Map(files.map((file) => [file.path, file]));
    const found = [];
    const missing = [];
    for (const name of wordnet.DATA_FILES) {
      const path = wordnet.filePath(target, name);
      const file = byPath.get(path) || this.app.vault.getAbstractFileByPath(path);
      if (!file) {
        missing.push(name);
        continue;
      }
      let text = "";
      try {
        if (typeof this.app.vault.read === "function") text = await this.app.vault.read(file);
        else if (this.app.vault.adapter && typeof this.app.vault.adapter.read === "function") text = await this.app.vault.adapter.read(path);
      } catch (e) {
        return { ok: false, reason: "read", message: `Could not read ${path}: ${str(e && e.message ? e.message : e)}` };
      }
      if (!text) missing.push(name);
      else found.push({ name, text });
    }
    if (missing.length) {
      return { ok: false, reason: "missing", message: `No ${missing.join(", ")} in ${target}. Import the four WordNet data files first.` };
    }
    const index = wordnet.buildWordNetIndex(found);
    if (!index.ok) return index;
    this.settings.wordNet = wordnet.normalizeWordNetSettings({ enabled: true, folder: target });
    await this.save();
    this.wordNetIndex = index;
    this.wordNetLoadedAt = Date.now();
    return { ok: true, folder: target, stats: index.stats };
  }

  async importWordNetFiles(files, folder) {
    const target = wordnet.normalizeFolder(folder || this.wordNetSettings().folder);
    const provided = new Map();
    for (const file of Array.isArray(files) ? files : []) {
      const name = str(file && file.name).trim().toLowerCase();
      if (!wordnet.DATA_FILES.includes(name)) {
        return { ok: false, reason: "name", message: `Expected ${wordnet.DATA_FILES.join(", ")}; got ${name || "an unnamed file"}.` };
      }
      const text = str(file && file.text);
      if (!text) return { ok: false, reason: "empty_file", message: `${name} is empty.` };
      provided.set(name, text);
    }
    const missing = wordnet.DATA_FILES.filter((name) => !provided.has(name));
    if (missing.length) {
      return { ok: false, reason: "missing", message: `Select all four WordNet files. Missing: ${missing.join(", ")}.` };
    }
    const index = wordnet.buildWordNetIndex(wordnet.DATA_FILES.map((name) => ({ name, text: provided.get(name) })));
    if (!index.ok) return index;
    const paths = wordnet.DATA_FILES.map((name) => wordnet.filePath(target, name));
    const existing = paths.filter((path) => this.app.vault.getAbstractFileByPath(path));
    if (existing.length) {
      return { ok: false, reason: "exists", message: `WordNet data already exists at ${existing[0]}. Move or delete it first, or change the data folder.` };
    }
    try {
      await ensureFolder(this.app, target);
      for (const name of wordnet.DATA_FILES) await this.app.vault.create(wordnet.filePath(target, name), provided.get(name));
    } catch (e) {
      return { ok: false, reason: "write", message: `Could not save the WordNet files: ${str(e && e.message ? e.message : e)}` };
    }
    this.settings.wordNet = wordnet.normalizeWordNetSettings({ enabled: true, folder: target });
    await this.save();
    this.wordNetIndex = index;
    this.wordNetLoadedAt = Date.now();
    return { ok: true, folder: target, stats: index.stats, imported: wordnet.DATA_FILES.slice() };
  }

  /* ---- Read-only writing-session count -------------------------------- */

  writingSessionState() {
    return writingSessions.normalizeWritingSession(this.settings.writingSession);
  }

  /** The active note's path, without opening or creating anything. */
  activeNotePath() {
    const workspace = this.app.workspace || {};
    const active = workspace.activeEditor;
    if (active && active.file && active.file.path) return active.file.path;
    const file = typeof workspace.getActiveFile === "function" ? workspace.getActiveFile() : null;
    return file && file.path ? file.path : "";
  }

  /** The active note's text from the editor, or its cached file. Read-only. */
  async activeNoteText() {
    const workspace = this.app.workspace || {};
    const active = workspace.activeEditor;
    const editor = active && active.editor;
    if (editor && typeof editor.getValue === "function") return str(editor.getValue());
    const path = this.activeNotePath();
    if (!path) return "";
    const file = this.app.vault.getAbstractFileByPath ? this.app.vault.getAbstractFileByPath(path) : null;
    if (!file) return "";
    try {
      return await this.app.vault.cachedRead(file);
    } catch (e) {
      return "";
    }
  }

  async writingSessionReport() {
    return writingSessions.sessionReport(this.writingSessionState(), await this.activeNoteText(), Date.now());
  }

  async startWritingSession() {
    const text = await this.activeNoteText();
    const result = writingSessions.startWritingSession(this.writingSessionState(), { path: this.activeNotePath(), text }, Date.now());
    if (!result.ok) return result;
    this.settings.writingSession = result.value;
    await this.save();
    return result;
  }

  async finishWritingSession() {
    const text = await this.activeNoteText();
    const result = writingSessions.finishWritingSession(this.writingSessionState(), text, Date.now());
    if (!result.ok) return result;
    this.settings.writingSession = result.value;
    await this.save();
    this.refreshViews();
    return result;
  }

  async cancelWritingSession() {
    this.settings.writingSession = writingSessions.cancelWritingSession(this.writingSessionState());
    await this.save();
    return this.settings.writingSession;
  }

  async getPdfAnnotationIndex() {
    const settings = pdfAnnotationIndex.normalizePdfAnnotationIndexSettings(this.settings.pdfAnnotationIndex);
    const entries = [];
    const files = this.app.vault.getMarkdownFiles ? this.app.vault.getMarkdownFiles() : [];
    for (const file of files) {
      if (!/\.annotations\.md$/i.test(file.path)) continue;
      if (entries.length >= pdfAnnotationIndex.MAX_FILES) break;
      let text = "";
      try {
        text = await this.app.vault.cachedRead(file);
      } catch (e) {
        continue;
      }
      entries.push({ path: file.path, text });
    }
    return pdfAnnotationIndex.collectPdfAnnotations(entries, settings);
  }

  /* ---- study workspace: guided workflows and local indexes */

  async addFeynmanSession(input) {
    const session = studyWorkspace.createFeynmanSession(input, Date.now());
    if (!session) return null;
    const current = this.studyWorkspaceSettings().feynmanLearning;
    this.settings.feynmanLearning = studyWorkspace.normalizeFeynmanSettings({
      ...current,
      sessions: current.sessions.concat(session).slice(-studyWorkspace.MAX_FEYNMAN),
    });
    await this.save();
    this.refreshViews();
    return session;
  }

  async updateFeynmanSession(id, patch) {
    const current = this.studyWorkspaceSettings().feynmanLearning;
    const sessions = current.sessions.map((session) =>
      session.id === id ? { ...session, ...(patch || {}), updatedAt: Date.now() } : session
    );
    this.settings.feynmanLearning = studyWorkspace.normalizeFeynmanSettings({ ...current, sessions });
    await this.save();
    this.refreshViews();
    return this.settings.feynmanLearning.sessions.find((session) => session.id === id) || null;
  }

  async removeFeynmanSession(id) {
    const current = this.studyWorkspaceSettings().feynmanLearning;
    this.settings.feynmanLearning = studyWorkspace.normalizeFeynmanSettings({
      ...current,
      sessions: current.sessions.filter((session) => session.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async addFlowExcerpt(input) {
    const excerpt = studyWorkspace.createFlowExcerpt(input, Date.now());
    if (!excerpt) return null;
    const current = this.studyWorkspaceSettings().studyFlow;
    this.settings.studyFlow = studyWorkspace.normalizeStudyFlow({
      ...current,
      excerpts: current.excerpts.concat(excerpt).slice(-studyWorkspace.MAX_EXCERPTS),
    });
    await this.save();
    this.refreshViews();
    return excerpt;
  }

  async updateFlowExcerpt(id, patch) {
    const current = this.studyWorkspaceSettings().studyFlow;
    const excerpts = current.excerpts.map((excerpt) => {
      if (excerpt.id !== id) return excerpt;
      const next = { ...excerpt, ...(patch || {}) };
      if (next.status === "understood" && !next.reviewedAt) next.reviewedAt = Date.now();
      return next;
    });
    this.settings.studyFlow = studyWorkspace.normalizeStudyFlow({ ...current, excerpts });
    await this.save();
    this.refreshViews();
    return this.settings.studyFlow.excerpts.find((excerpt) => excerpt.id === id) || null;
  }

  async removeFlowExcerpt(id) {
    const current = this.studyWorkspaceSettings().studyFlow;
    this.settings.studyFlow = studyWorkspace.normalizeStudyFlow({
      ...current,
      excerpts: current.excerpts.filter((excerpt) => excerpt.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  openStudyFlowSource(path) {
    const target = str(path).trim();
    if (!target) return;
    const file = this.app.vault.getAbstractFileByPath(target);
    if (!file) {
      new Notice(`Source not found: ${target}`, 6000);
      return;
    }
    this.app.workspace.openLinkText(file.path, "", false);
  }

  /** Read-only desired-retention fit from the review counters already on cards. */
  schedulerFitReport() {
    const options = normalizeSchedulerFitSettings(this.settings.schedulerFit);
    const cards = typeof this.getCards === "function" ? this.getCards() : [];
    return fitRetention(collectReviewRecords(cards), { minSamples: options.minSamples, current: this.settings.fsrsRetention });
  }

  /** Per-deck desired-retention fit. Weights remain at the shipped defaults. */
  fsrsRetentionReports() {
    const options = normalizeSchedulerFitSettings(this.settings.schedulerFit);
    const cards = typeof this.getCards === "function" ? this.getCards() : [];
    const current = {};
    for (const config of (this.settings.cards && Array.isArray(this.settings.cards.decks) ? this.settings.cards.decks : [])) {
      const deck = str(config && config.name).trim();
      if (deck) current[deck] = effectiveFsrsRetention(this.settings, deck);
    }
    for (const card of cards) {
      const deck = str(card && card.deck).trim() || "Unsorted";
      if (!(deck in current)) current[deck] = effectiveFsrsRetention(this.settings, deck);
    }
    return fsrsFit.fitRetentionDecks(cards, {
      currentRetention: current,
      globalRetention: this.settings.fsrsRetention,
      minSamples: options.minSamples,
    });
  }

  /** Apply one validated target to one deck. Other decks and all weights stay untouched. */
  async applyFsrsRetention(deckName, retention) {
    const deck = str(deckName).trim();
    const target = fsrsFit.normalizeRetention(retention);
    if (!deck || target === null) return null;
    const current = this.settings.cards && typeof this.settings.cards === "object" ? this.settings.cards : {};
    const decks = Array.isArray(current.decks) ? current.decks.map((entry) => ({ ...entry })) : [];
    let cfg = decks.find((entry) => str(entry.name).trim().toLowerCase() === deck.toLowerCase());
    if (!cfg) {
      cfg = { name: deck, folder: "", course: "", answerMode: "", gradingStrictness: "", scheduler: "", intervals: [], fsrsRetention: 0, sm2: {} };
      decks.push(cfg);
    }
    cfg.fsrsRetention = target;
    this.settings.cards = mergeCardSettings({ ...current, decks });
    await this.save();
    this.refreshViews();
    return target;
  }

  /** One-click rollback: clear this deck's target and inherit the global one. */
  async resetFsrsRetention(deckName) {
    const deck = str(deckName).trim();
    if (!deck) return null;
    const current = this.settings.cards && typeof this.settings.cards === "object" ? this.settings.cards : {};
    const decks = Array.isArray(current.decks) ? current.decks.map((entry) => ({ ...entry })) : [];
    const cfg = decks.find((entry) => str(entry.name).trim().toLowerCase() === deck.toLowerCase());
    if (!cfg || !(Number(cfg.fsrsRetention) > 0)) return null;
    cfg.fsrsRetention = 0;
    this.settings.cards = mergeCardSettings({ ...current, decks });
    await this.save();
    this.refreshViews();
    return true;
  }

  /* ---- portable card archive (Retain-style storage outside plugin data) */

  /** Write every card note into one versioned JSON file in the vault. */
  async exportCardArchive() {
    if (!this.cardArchiveEnabled()) throw new Error("Card archive is off. Turn it on in Settings, Global, Modules.");
    if (!this.cardsEnabled()) throw new Error("Turn on Cards before exporting a card archive.");
    const entries = [];
    for (const card of this.getCards()) {
      const path = str(card.file && card.file.path);
      if (!path) continue;
      try {
        const text = await this.app.vault.cachedRead(card.file);
        entries.push({ path, text, deck: card.deck, course: card.course });
      } catch (e) {
        // an unreadable card is skipped rather than producing an empty entry
      }
    }
    const archive = buildCardArchive(entries, { exportedAt: new Date().toISOString() });
    const folder = normalizeCardArchiveSettings(this.settings.cardArchive).folder;
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch (e) {
        // the folder may already exist
      }
    }
    const path = `${folder}/${archiveFileName(localDate())}`;
    const existing = this.app.vault.getAbstractFileByPath(path);
    const body = JSON.stringify(archive, null, 2);
    if (existing) await this.app.vault.modify(existing, body);
    else await this.app.vault.create(path, body);
    new Notice(`Exported ${archive.count} card${archive.count === 1 ? "" : "s"} to ${path}.`, 6000);
    return { path, count: archive.count, issues: archive.issues };
  }

  /** Restore a card archive. `skip` leaves existing notes untouched. */
  async importCardArchiveText(text, mode) {
    if (!this.cardArchiveEnabled()) throw new Error("Card archive is off. Turn it on in Settings, Global, Modules.");
    const parsed = parseCardArchive(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const paths = this.app.vault.getMarkdownFiles().map((file) => str(file.path));
    const report = mergeCardArchive(paths, parsed.archive, mode === "overwrite" ? "overwrite" : "skip");
    const create = new Set(report.create.map((path) => path.toLowerCase()));
    const update = new Set(report.update.map((path) => path.toLowerCase()));
    for (const card of parsed.archive.cards) {
      const lower = card.path.toLowerCase();
      const slash = card.path.lastIndexOf("/");
      if (slash > 0) {
        const folder = card.path.slice(0, slash);
        if (!this.app.vault.getAbstractFileByPath(folder)) {
          try {
            await this.app.vault.createFolder(folder);
          } catch (e) {
            // created concurrently or already present
          }
        }
      }
      if (create.has(lower)) await this.app.vault.create(card.path, card.text);
      else if (update.has(lower)) {
        const existing = this.app.vault.getAbstractFileByPath(card.path);
        if (existing) await this.app.vault.modify(existing, card.text);
      }
    }
    if (typeof this.refreshPlainCards === "function") this.refreshPlainCards().catch(() => {});
    return report;
  }

  openCardArchiveImport() {
    if (!this.cardArchiveEnabled()) {
      new Notice("Card archive is off. Turn it on in Settings, Global, Modules.", 6000);
      this.openSettings();
      return null;
    }
    const modal = new CardArchiveImportModal(this.app, this);
    modal.open();
    return modal;
  }

  /* ---- in-app study nudge (no OS notification) */

  setupStudyNudge() {
    this.refreshStudyNudgeLabel();
    if (!this.studyNudgeEnabled()) return;
    activeWindow.setTimeout(() => {
      try {
        this.maybeShowStudyNudge();
      } catch (e) {
        // a nudge must never break startup
      }
    }, 1800);
  }

  studyNudgeCounts() {
    const today = localDate();
    const questions = this.mcqEnabled() ? this.getQuestions() : [];
    const dueQuestions = questions.filter((question) => isStudyable(question.fm, today) && isDue(question.fm, today)).length;
    const cards = this.cardsEnabled() ? this.getCards().filter((card) => {
      const fm = card.fm || {};
      const raw = str(fm.next_review || fm.due).slice(0, 10);
      return !Number(fm.attempts) || !raw || raw <= today;
    }).length : 0;
    const tasks = this.studyTasksEnabled() ? studyWorkspace.dueStudyTasks(this.settings.studyTasks.tasks, today).length : 0;
    return { questions: dueQuestions, cards, tasks };
  }

  studyNudgeInfo(now) {
    return computeNudgeState(this.settings.studyNudge, this.studyNudgeCounts(), now);
  }

  refreshStudyNudgeLabel() {
    const button = this.ribbonButtons && (this.ribbonButtons.today || this.ribbonButtons.mcq);
    if (!button || typeof button.setAttr !== "function") return;
    const info = this.studyNudgeInfo();
    button.setAttr("aria-label", info.badge ? `${info.badge}. Open Today.` : "Open today");
  }

  maybeShowStudyNudge(now) {
    const info = this.studyNudgeInfo(now);
    this.refreshStudyNudgeLabel();
    if (!info.visible) return null;
    new Notice(`Study nudge: ${info.banner}`, 8000);
    this.settings.studyNudge = markNudgeShown(this.settings.studyNudge, now || new Date());
    this.save();
    return info;
  }

  /* ---- course note templates (Course Command Center, local part) */

  /** Create one course note from a local note-type template. */
  async createCourseNote(input) {
    if (!this.courseTemplatesEnabled()) throw new Error("Course templates are off. Turn them on in Settings, Global, Modules.");
    const note = renderCourseNote(input, this.settings.courseTemplates);
    const folder = note.folder;
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch (e) {
        // the folder may already exist
      }
    }
    let path = note.path;
    let suffix = 2;
    while (this.app.vault.getAbstractFileByPath(path) && suffix <= 50) {
      path = `${folder}/${note.fileName} ${suffix}.md`;
      suffix += 1;
    }
    await this.app.vault.create(path, note.markdown);
    return { path, title: note.title, type: note.type };
  }

  openCourseNoteBuilder() {
    if (!this.courseTemplatesEnabled()) {
      new Notice("Course templates are off. Turn them on in Settings, Global, Modules.", 6000);
      this.openSettings();
      return null;
    }
    const modal = new CourseTemplateModal(this.app, this);
    modal.open();
    return modal;
  }

  async addStudySubject(input) {
    const subject = studyWorkspace.createSubject(input, Date.now());
    if (!subject) return null;
    const current = this.studyWorkspaceSettings().subjectManager;
    if (current.subjects.some((entry) => entry.name.toLowerCase() === subject.name.toLowerCase())) return subject;
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager({
      ...current,
      subjects: this.appendCapped(current.subjects, subject, studyWorkspace.MAX_SUBJECTS, "Subject manager"),
    });
    await this.save();
    this.refreshViews();
    return subject;
  }

  async removeStudySubject(id) {
    const current = this.studyWorkspaceSettings().subjectManager;
    const subject = current.subjects.find((entry) => entry.id === id);
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager({
      ...current,
      subjects: current.subjects.filter((entry) => entry.id !== id),
      absences: subject ? current.absences.filter((absence) => absence.subject.toLowerCase() !== subject.name.toLowerCase()) : current.absences,
    });
    await this.save();
    this.refreshViews();
  }

  async addStudyAbsence(input) {
    const absence = studyWorkspace.createAbsence(input, Date.now());
    if (!absence) return null;
    const current = this.studyWorkspaceSettings().subjectManager;
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager({
      ...current,
      absences: this.appendCapped(current.absences, absence, studyWorkspace.MAX_ABSENCES, "Absence log"),
    });
    await this.save();
    this.refreshViews();
    return absence;
  }

  async removeStudyAbsence(id) {
    const current = this.studyWorkspaceSettings().subjectManager;
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager({
      ...current,
      absences: current.absences.filter((absence) => absence.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async addStudyProject(input) {
    const source = input && typeof input === "object" ? input : {};
    const name = str(source.subject).trim().toLowerCase();
    const current = this.studyWorkspaceSettings().subjectManager;
    const subject = current.subjects.find((entry) => entry.name.toLowerCase() === name);
    if (!subject) return null;
    const project = studyWorkspace.createSubjectProject(source, Date.now());
    if (!project) return null;
    const subjects = current.subjects.map((entry) =>
      entry.id === subject.id ? { ...entry, projects: (entry.projects || []).concat(project).slice(-50) } : entry
    );
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager({ ...current, subjects });
    await this.save();
    this.refreshViews();
    return project;
  }

  async toggleStudyProject(subjectId, projectId) {
    const current = this.studyWorkspaceSettings().subjectManager;
    let changed = null;
    const subjects = current.subjects.map((subject) => {
      if (subject.id !== subjectId) return subject;
      const projects = (subject.projects || []).map((project) => {
        if (project.id !== projectId) return project;
        changed = { ...project, done: !project.done };
        return changed;
      });
      return { ...subject, projects };
    });
    if (!changed) return null;
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager({ ...current, subjects });
    await this.save();
    this.refreshViews();
    return changed;
  }

  async removeStudyProject(subjectId, projectId) {
    const current = this.studyWorkspaceSettings().subjectManager;
    const subjects = current.subjects.map((subject) =>
      subject.id === subjectId ? { ...subject, projects: (subject.projects || []).filter((project) => project.id !== projectId) } : subject
    );
    this.settings.subjectManager = studyWorkspace.normalizeSubjectManager({ ...current, subjects });
    await this.save();
    this.refreshViews();
  }

  /* ---- Course hub ------------------------------------------------------ */

  async addCourseGrade(input) {
    const grade = studyWorkspace.createGrade(input, Date.now());
    if (!grade) return null;
    const current = this.studyWorkspaceSettings().courseHub;
    this.settings.courseHub = studyWorkspace.normalizeCourseHub({
      ...current,
      grades: this.appendCapped(current.grades, grade, studyWorkspace.MAX_GRADES, "Course grades"),
    });
    await this.save();
    this.refreshViews();
    return grade;
  }

  async removeCourseGrade(id) {
    const current = this.studyWorkspaceSettings().courseHub;
    this.settings.courseHub = studyWorkspace.normalizeCourseHub({
      ...current,
      grades: current.grades.filter((grade) => grade.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  /* ---- Study tasks ----------------------------------------------------- */

  async addStudyTask(input) {
    const task = studyWorkspace.createStudyTask(input, Date.now());
    if (!task) return null;
    const current = this.studyWorkspaceSettings().studyTasks;
    this.settings.studyTasks = studyWorkspace.normalizeStudyTasks({
      ...current,
      tasks: current.tasks.concat(task).slice(-studyWorkspace.MAX_TASKS),
    });
    await this.save();
    this.refreshViews();
    return task;
  }

  /** Tags used by the local study tasks, with counts. Read-only. */
  taskTagUsage() {
    return taskTags.tagUsage(this.studyWorkspaceSettings().studyTasks.tasks);
  }

  /** Rename one tag on the local study tasks; no note is read or written. */
  async renameStudyTaskTag(from, to) {
    const current = this.studyWorkspaceSettings().studyTasks;
    const result = taskTags.planTagRename(current.tasks, from, to);
    if (!result.ok) return result;
    this.settings.studyTasks = studyWorkspace.normalizeStudyTasks({ ...current, tasks: result.tasks });
    await this.save();
    this.refreshViews();
    return result;
  }

  async updateStudyTask(id, patch) {
    const current = this.studyWorkspaceSettings().studyTasks;
    const tasks = current.tasks.map((task) => (task.id === id ? { ...task, ...(patch || {}) } : task));
    this.settings.studyTasks = studyWorkspace.normalizeStudyTasks({ ...current, tasks });
    await this.save();
    this.refreshViews();
    return this.settings.studyTasks.tasks.find((task) => task.id === id) || null;
  }

  async removeStudyTask(id) {
    const current = this.studyWorkspaceSettings().studyTasks;
    this.settings.studyTasks = studyWorkspace.normalizeStudyTasks({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async generateStudyTasks(input) {
    const opts = { ...(input && typeof input === "object" ? input : {}) };
    if (opts.course && (!str(opts.examDate).trim() || !str(opts.topics).trim())) {
      const exam = this.getExams({ horizonDays: 3650 }).find((row) =>
        courseIdentity.sameCourse(this.calendarSettings(), row.course, opts.course)
      );
      if (exam) {
        if (!str(opts.examDate).trim()) opts.examDate = exam.date;
        if (!str(opts.topics).trim() && Array.isArray(exam.topics) && exam.topics.length) opts.topics = exam.topics.join("\n");
      }
    }
    const tasks = studyWorkspace.planExamTasks(opts, localDate(), Date.now());
    if (!tasks.length) return [];
    const current = this.studyWorkspaceSettings().studyTasks;
    this.settings.studyTasks = studyWorkspace.normalizeStudyTasks({
      ...current,
      tasks: current.tasks.concat(tasks).slice(-studyWorkspace.MAX_TASKS),
    });
    await this.save();
    this.refreshViews();
    return tasks;
  }

  /* ---- Time-block planner --------------------------------------------- */

  /** Kairos-style plan for one calendar day: classes, blocks and free slots. */
  calendarPlannerDay(date, events) {
    const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
    const list = Array.isArray(events) ? events : this.calendarEnabled() ? this.calendarEvents() : [];
    return calendarPlanner.dayPlan(list, key, this.timeBlocksSettings().blocks, {});
  }

  async planBlockFromCalendarSlot(date, slot) {
    const draft = calendarPlanner.slotDraft(slot, date);
    if (!draft) return { ok: false, reason: "slot", message: "That free slot has no usable start and end." };
    if (!this.timeBlocksEnabled()) return { ok: false, reason: "disabled", message: "Turn on Time blocks first." };
    const block = await this.addTimeBlock(draft);
    if (!block) return { ok: false, reason: "block", message: "Could not create that block." };
    return { ok: true, block };
  }

  async planBlockAfterClass(date, item) {
    const draft = calendarPlanner.afterClassDraft(item, date);
    if (!draft) return { ok: false, reason: "class", message: "There is no room after that class in the planning window." };
    if (!this.timeBlocksEnabled()) return { ok: false, reason: "disabled", message: "Turn on Time blocks first." };
    const block = await this.addTimeBlock(draft);
    if (!block) return { ok: false, reason: "block", message: "Could not create that block." };
    return { ok: true, block };
  }

  async addTimeBlock(input) {
    const block = timeBlocks.createTimeBlock(input, Date.now());
    if (!block) return null;
    const current = this.timeBlocksSettings();
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      blocks: current.blocks.concat(block).slice(-timeBlocks.MAX_BLOCKS),
    });
    await this.save();
    this.refreshViews();
    return block;
  }

  async updateTimeBlock(id, patch) {
    const current = this.timeBlocksSettings();
    const existing = current.blocks.find((block) => block.id === id);
    if (!existing) return null;
    const updated = timeBlocks.normalizeTimeBlock({ ...existing, ...(patch || {}), id, createdAt: existing.createdAt });
    if (!updated) return null;
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      blocks: current.blocks.map((block) => (block.id === id ? updated : block)),
    });
    await this.save();
    this.refreshViews();
    return updated;
  }

  /** Store or clear one course colour used by the Time blocks planner. */
  async setTimeBlockSubjectColor(course, color) {
    const name = str(course).trim();
    if (!name) return "";
    const current = this.timeBlocksSettings();
    const subjectColors = { ...current.subjectColors };
    const key = name.toLowerCase();
    const next = timeBlocks.normalizeColor(color);
    if (next) subjectColors[key] = next;
    else delete subjectColors[key];
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      subjectColors,
    });
    await this.save();
    this.refreshViews();
    return next;
  }

  async removeTimeBlock(id) {
    const current = this.timeBlocksSettings();
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async addTimeBlockTask(blockId, input) {
    const current = this.timeBlocksSettings();
    const block = current.blocks.find((row) => row.id === blockId);
    if (!block) return null;
    const title = str(input && input.title).trim();
    if (!title) return null;
    return this.updateTimeBlock(blockId, {
      tasks: block.tasks.concat({ title, studyTaskId: input && input.studyTaskId, createdAt: Date.now() }),
    });
  }

  async toggleTimeBlockTask(blockId, taskId, done) {
    const current = this.timeBlocksSettings();
    const block = current.blocks.find((row) => row.id === blockId);
    if (!block) return null;
    const target = block.tasks.find((task) => task.id === taskId);
    if (!target) return null;
    const tasks = block.tasks.map((task) => (task.id === taskId ? { ...task, done: done === true, status: done === true ? "done" : "open" } : task));
    const updated = timeBlocks.normalizeTimeBlock({ ...block, tasks });
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      blocks: current.blocks.map((row) => (row.id === blockId ? updated : row)),
    });
    if (target.studyTaskId) {
      const taskState = this.studyWorkspaceSettings().studyTasks;
      this.settings.studyTasks = studyWorkspace.normalizeStudyTasks({
        ...taskState,
        tasks: taskState.tasks.map((task) => (task.id === target.studyTaskId ? { ...task, done: done === true } : task)),
      });
    }
    await this.save();
    this.refreshViews();
    return updated;
  }

  async removeTimeBlockTask(blockId, taskId) {
    const current = this.timeBlocksSettings();
    const block = current.blocks.find((row) => row.id === blockId);
    if (!block) return null;
    return this.updateTimeBlock(blockId, { tasks: block.tasks.filter((task) => task.id !== taskId) });
  }

  async addTimeBlockProject(input) {
    const project = timeBlocks.createTimeProject(input, Date.now());
    if (!project) return null;
    const current = this.timeBlocksSettings();
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      projects: current.projects.concat(project).slice(-timeBlocks.MAX_PROJECTS),
    });
    await this.save();
    this.refreshViews();
    return project;
  }

  async removeTimeBlockProject(id) {
    const current = this.timeBlocksSettings();
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      projects: current.projects.filter((project) => project.id !== id),
      blocks: current.blocks.map((block) => (block.projectId === id ? { ...block, projectId: "" } : block)),
      routines: current.routines.map((routine) => (routine.projectId === id ? { ...routine, projectId: "" } : routine)),
    });
    await this.save();
    this.refreshViews();
  }

  async addTimeBlockRoutine(input) {
    const routine = timeBlocks.createTimeRoutine(input, Date.now());
    if (!routine) return null;
    const current = this.timeBlocksSettings();
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      routines: current.routines.concat(routine).slice(-timeBlocks.MAX_ROUTINES),
    });
    await this.save();
    this.refreshViews();
    return routine;
  }

  async removeTimeBlockRoutine(id) {
    const current = this.timeBlocksSettings();
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      routines: current.routines.filter((routine) => routine.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async applyTimeBlockRoutines(date) {
    const current = this.timeBlocksSettings();
    const result = timeBlocks.applyRoutines(current.routines, current.blocks, date || timeBlocks.todayValue(), Date.now());
    if (!result.created.length) return [];
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...current, blocks: result.blocks });
    await this.save();
    this.refreshViews();
    return result.created;
  }

  /** Open and half-done tasks from the most recent earlier day that today lacks. */
  timeBlockLeftovers(date) {
    const current = this.timeBlocksSettings();
    const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
    const todayBlocks = timeBlocks.blocksForDate(current.blocks, key);
    for (let offset = 1; offset <= 30; offset += 1) {
      const day = timeBlocks.addDays(key, -offset);
      const blocks = timeBlocks.blocksForDate(current.blocks, day);
      if (!blocks.length) continue;
      const rows = timeBlocks.blockLeftovers(blocks, todayBlocks);
      if (!rows.length) continue;
      return { date: day, rows, blocks };
    }
    return { date: "", rows: [], blocks: [] };
  }

  /** Move the chosen unfinished tasks into today's Unscheduled block. */
  async carryTimeBlockLeftovers(date, picks) {
    const current = this.timeBlocksSettings();
    const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
    const found = this.timeBlockLeftovers(key);
    if (!found.rows.length) return { moved: 0, from: "", to: key };
    const chosen = Array.isArray(picks) && picks.length ? picks : found.rows.map((row) => ({ blockId: row.blockId, taskId: row.taskId }));
    const todayBlocks = timeBlocks.blocksForDate(current.blocks, key);
    const result = timeBlocks.carryOverTasks(found.blocks, todayBlocks, chosen, key, Date.now());
    const fromById = new Map(result.from.map((block) => [block.id, block]));
    const todayIds = new Set(todayBlocks.map((block) => block.id));
    const untouched = current.blocks.filter((block) => !fromById.has(block.id) && !todayIds.has(block.id));
    const blocks = untouched.concat([...fromById.values()], result.to).slice(-timeBlocks.MAX_BLOCKS);
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...current, blocks });
    await this.save();
    this.refreshViews();
    return { moved: result.moved, from: found.date, to: key };
  }

  /** Remove the day's routine blocks, then offer the routines again. */
  async regenerateTimeBlockRoutines(date) {
    const current = this.timeBlocksSettings();
    const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
    const result = timeBlocks.regenerateRoutines(current.routines, current.blocks, key, Date.now());
    if (!result.removed && !result.created.length) return { created: [], removed: 0 };
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...current, blocks: result.blocks });
    await this.save();
    this.refreshViews();
    return { created: result.created, removed: result.removed };
  }

  /** Import timed block routines (and their tasks) from Routines.md. */
  async importTimeBlockRoutinesFile(path) {
    const current = this.timeBlocksSettings();
    const clean = str(path || current.routinesPath).trim().replace(/^\/+|\/+$/g, "");
    if (!clean) return { ok: false, reason: "path", message: "Set a routines file path first." };
    const file = this.app.vault.getAbstractFileByPath(clean);
    if (!file) return { ok: false, reason: "missing", path: clean, message: "No " + clean + " in this vault." };
    let markdown = "";
    try {
      markdown = await this.app.vault.read(file);
    } catch (e) {
      return { ok: false, reason: "read", message: String((e && e.message) || "Could not read the routines file.") };
    }
    const parsed = timeBlocks.parseRoutinesMarkdown(markdown, { projects: current.projects });
    const keyOf = (routine) => [routine.title.toLowerCase(), routine.start, routine.end, routine.days.join(""), routine.monthlyDay].join("|");
    const seen = new Set(current.routines.map(keyOf));
    const added = [];
    for (const routine of parsed.routines) {
      const key = keyOf(routine);
      if (seen.has(key)) continue;
      seen.add(key);
      added.push(routine);
      if (current.routines.length + added.length >= timeBlocks.MAX_ROUTINES) break;
    }
    if (added.length) {
      this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...current, routines: current.routines.concat(added) });
      await this.save();
      this.refreshViews();
    }
    return { ok: true, path: clean, added: added.length, skipped: parsed.routines.length - added.length, unread: parsed.unread };
  }

  /** Import backlog items, their associations and resurface dates from Backlog.md. */
  async importTimeBlockBacklogFile(path) {
    const current = this.timeBlocksSettings();
    const clean = str(path || current.backlogPath).trim().replace(/^\/+|\/+$/g, "");
    if (!clean) return { ok: false, reason: "path", message: "Set a backlog file path first." };
    const file = this.app.vault.getAbstractFileByPath(clean);
    if (!file) return { ok: false, reason: "missing", path: clean, message: "No " + clean + " in this vault." };
    let markdown = "";
    try {
      markdown = await this.app.vault.read(file);
    } catch (e) {
      return { ok: false, reason: "read", message: String((e && e.message) || "Could not read the backlog file.") };
    }
    const parsed = timeBlocks.parseBacklogMarkdown(markdown, { projects: current.projects });
    const keyOf = (item) => [item.title.toLowerCase(), item.projectId].join("|");
    const seen = new Set(current.backlog.map(keyOf));
    const added = [];
    for (const item of parsed) {
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      added.push(item);
      if (current.backlog.length + added.length >= timeBlocks.MAX_BACKLOG) break;
    }
    if (added.length) {
      this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...current, backlog: current.backlog.concat(added) });
      await this.save();
      this.refreshViews();
    }
    return { ok: true, path: clean, added: added.length, skipped: parsed.length - added.length };
  }

  /** Two-way sync of one day with the Schedule section of its daily note. */
  async syncTimeBlockDailyNote(date) {
    const current = this.timeBlocksSettings();
    const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
    const path = timeBlocks.dailyNotePath(key, current.dailyNoteFolder);
    if (!path) return { ok: false, reason: "folder", message: "Set a Daily-note folder in Settings, Time blocks first." };
    const folder = path.split("/").slice(0, -1).join("/");
    const file = this.app.vault.getAbstractFileByPath(path);
    let markdown = "";
    if (file) {
      try {
        markdown = await this.app.vault.read(file);
      } catch (e) {
        return { ok: false, reason: "read", message: String((e && e.message) || "Could not read the daily note.") };
      }
    }
    const heading = current.scheduleHeading;
    const drafts = timeBlocks.parseScheduleMarkdown(markdown, { projects: current.projects, heading });
    const parsed = timeBlocks.timeBlocksFromSchedule(drafts, key, current.projects, Date.now());
    let blocks = current.blocks;
    let projects = current.projects;
    if (drafts.length) {
      const parsedIds = new Set(parsed.blocks.map((block) => block.id));
      blocks = current.blocks.filter((block) => !(block.date === key && !parsedIds.has(block.id))).concat(parsed.blocks);
      projects = parsed.projects;
    }
    const sectionBlocks = drafts.length ? parsed.blocks : timeBlocks.blocksForDate(blocks, key);
    const section = timeBlocks.scheduleMarkdown(sectionBlocks, { projects, heading });
    const nextMarkdown = timeBlocks.replaceScheduleSection(markdown, section, heading);
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch (e) {
        /* the folder may already exist after a sync */
      }
    }
    if (file) await this.app.vault.modify(file, nextMarkdown);
    else await this.app.vault.create(path, nextMarkdown);
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...current, blocks, projects });
    await this.save();
    this.refreshViews();
    return { ok: true, path, imported: drafts.length, blocks: sectionBlocks.length, projects: projects.length };
  }

  /** Open the seven-step tour; the last step opens Day. */
  openTimeBlocksTour() {
    const modal = new TimeBlocksTourModal(this.app, timeBlocks.TIME_BLOCK_TOUR, () => this.activateTimeBlocksView("day"));
    modal.open();
    return modal;
  }

  /** Write text at a vault path, creating one missing folder and never overwriting unexpectedly. */
  async writeTimeBlockTextFile(path, markdown) {
    const clean = str(path).trim().replace(/^\/+|\/+$/g, "");
    if (!clean) return "";
    const folder = clean.split("/").slice(0, -1).join("/");
    if (folder && !this.app.vault.getAbstractFileByPath(folder) && typeof this.app.vault.createFolder === "function") {
      try {
        await this.app.vault.createFolder(folder);
      } catch (e) {
        /* the folder appeared between the check and the write */
      }
    }
    const file = this.app.vault.getAbstractFileByPath(clean);
    if (file) await this.app.vault.modify(file, markdown);
    else await this.app.vault.create(clean, markdown);
    return clean;
  }

  async writeTimeBlockRoutinesFile(path) {
    const current = this.timeBlocksSettings();
    const written = await this.writeTimeBlockTextFile(path || current.routinesPath, timeBlocks.routinesMarkdown(current.routines, { projects: current.projects }));
    return written
      ? { ok: true, path: written, routines: current.routines.length }
      : { ok: false, reason: "path", message: "Set a routines file path first." };
  }

  async writeTimeBlockBacklogFile(path) {
    const current = this.timeBlocksSettings();
    const written = await this.writeTimeBlockTextFile(path || current.backlogPath, timeBlocks.backlogMarkdown(current.backlog, { projects: current.projects }));
    return written
      ? { ok: true, path: written, items: current.backlog.length }
      : { ok: false, reason: "path", message: "Set a backlog file path first." };
  }

  /** Write one Markdown file per project/domain, keeping the user's body. */
  async writeTimeBlockProjectFiles() {
    const current = this.timeBlocksSettings();
    const paths = [];
    for (const project of current.projects) {
      const path = timeBlocks.projectFilePath(project, current);
      if (!path) continue;
      const file = this.app.vault.getAbstractFileByPath(path);
      let body = "";
      if (file) {
        try {
          body = timeBlocks.stripFrontmatter(await this.app.vault.read(file));
        } catch (e) {
          continue;
        }
      }
      await this.writeTimeBlockTextFile(path, timeBlocks.projectMarkdown(project, { body }));
      paths.push(path);
    }
    return { ok: true, written: paths.length, paths };
  }

  /** Read project/domain files back, merging status history and colours by name. */
  async importTimeBlockProjectFiles() {
    const current = this.timeBlocksSettings();
    const files = typeof this.app.vault.getMarkdownFiles === "function" ? this.app.vault.getMarkdownFiles() : [];
    const folders = [current.projectsFolder, current.domainsFolder]
      .filter(Boolean)
      .map((folder) => str(folder).replace(/^\/+|\/+$/g, "") + "/");
    const projects = current.projects.slice();
    let imported = 0;
    for (const file of files) {
      const path = str(file && file.path);
      if (!folders.some((folder) => path.startsWith(folder))) continue;
      let markdown = "";
      try {
        markdown = await this.app.vault.read(file);
      } catch (e) {
        continue;
      }
      const parsed = timeBlocks.parseProjectMarkdown(markdown, path);
      if (!parsed) continue;
      const at = projects.findIndex((project) => project.name.toLowerCase() === parsed.name.toLowerCase());
      if (at >= 0) {
        projects[at] = timeBlocks.normalizeTimeProject({
          ...projects[at],
          kind: parsed.kind,
          color: parsed.color || projects[at].color,
          course: parsed.course || projects[at].course,
          statusHistory: parsed.statusHistory.length ? parsed.statusHistory : projects[at].statusHistory,
        });
      } else {
        const created = timeBlocks.createTimeProject(parsed, Date.now() + imported);
        if (created) projects.push(created);
      }
      imported += 1;
    }
    if (imported) {
      this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...current, projects });
      await this.save();
      this.refreshViews();
    }
    return { ok: true, imported, projects: projects.length };
  }

  /** Copy the settings Kairos stores in its own data.json, without reading its code. */
  async importKairosSettings() {
    const path = ".obsidian/plugins/kairos/data.json";
    const adapter = this.app.vault.adapter;
    if (!adapter || typeof adapter.read !== "function") {
      return { ok: false, reason: "adapter", message: "This vault cannot read plugin settings directly." };
    }
    let raw = "";
    try {
      raw = await adapter.read(path);
    } catch (e) {
      return { ok: false, reason: "missing", message: "No Kairos settings found at " + path + "." };
    }
    const patch = timeBlocks.kairosSettingsPatch(raw);
    const applied = Object.keys(patch);
    if (!applied.length) return { ok: false, reason: "empty", message: "No Kairos settings this planner can reuse." };
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...this.timeBlocksSettings(), ...patch });
    await this.save();
    this.refreshViews();
    return { ok: true, path, applied };
  }

  /** Set a task's four-state status; a linked study task follows done only. */
  async setTimeBlockTaskStatus(blockId, taskId, status) {
    const current = this.timeBlocksSettings();
    const block = current.blocks.find((row) => row.id === blockId);
    const target = block && block.tasks.find((task) => task.id === taskId);
    if (!target) return null;
    const next = timeBlocks.normalizeTaskStatus(status, false);
    const tasks = block.tasks.map((task) => (task.id === taskId ? { ...task, done: next === "done", status: next } : task));
    const updated = timeBlocks.normalizeTimeBlock({ ...block, tasks });
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      blocks: current.blocks.map((row) => (row.id === blockId ? updated : row)),
    });
    if (target.studyTaskId) {
      const taskState = this.studyWorkspaceSettings().studyTasks;
      this.settings.studyTasks = studyWorkspace.normalizeStudyTasks({
        ...taskState,
        tasks: taskState.tasks.map((task) => (task.id === target.studyTaskId ? { ...task, done: next === "done" } : task)),
      });
    }
    await this.save();
    this.refreshViews();
    return updated;
  }

  async cycleTimeBlockTask(blockId, taskId) {
    const current = this.timeBlocksSettings();
    const block = current.blocks.find((row) => row.id === blockId);
    const task = block && block.tasks.find((row) => row.id === taskId);
    if (!task) return null;
    return this.setTimeBlockTaskStatus(blockId, taskId, timeBlocks.nextTaskStatus(task.status));
  }

  async cancelTimeBlockTask(blockId, taskId) {
    return this.setTimeBlockTaskStatus(blockId, taskId, "cancelled");
  }

  /** Move one task to a day's Unscheduled block, creating it when needed. */
  async moveTimeBlockTask(blockId, taskId, date) {
    const current = this.timeBlocksSettings();
    const key = timeBlocks.dayValue(date);
    const source = current.blocks.find((row) => row.id === blockId);
    const task = source && source.tasks.find((row) => row.id === taskId);
    if (!key || !task || source.date === key) return null;
    const moved = { ...task, projectId: task.projectId || source.projectId };
    const blocks = current.blocks
      .map((row) => (row.id === blockId ? timeBlocks.normalizeTimeBlock({ ...row, tasks: row.tasks.filter((item) => item.id !== taskId) }) : row))
      .filter(Boolean);
    let target = blocks.find((row) => row.date === key && row.untimed);
    if (!target) {
      target = timeBlocks.createTimeBlock({ date: key, title: timeBlocks.UNSCHEDULED_TITLE, untimed: true, tasks: [moved] }, Date.now());
      if (!target) return null;
      blocks.push(target);
    } else {
      const at = blocks.indexOf(target);
      blocks[at] = timeBlocks.normalizeTimeBlock({ ...target, tasks: target.tasks.concat(moved) });
      target = blocks[at];
    }
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({ ...current, blocks });
    await this.save();
    this.refreshViews();
    return { date: key, blockId: target.id, title: task.title };
  }

  /** Record one project/domain lifecycle state for a date. */
  async setTimeBlockProjectStatus(projectId, status, intensity, note, date) {
    const current = this.timeBlocksSettings();
    const project = current.projects.find((row) => row.id === projectId);
    if (!project || !timeBlocks.normalizeProjectStatus(status)) return null;
    const statusHistory = timeBlocks.appendProjectStatus(project.statusHistory, {
      date: date || timeBlocks.todayValue(),
      status,
      intensity,
      note,
    });
    const updated = timeBlocks.normalizeTimeProject({ ...project, statusHistory });
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      projects: current.projects.map((row) => (row.id === projectId ? updated : row)),
    });
    await this.save();
    this.refreshViews();
    return updated;
  }

  async addTimeBlockBacklog(input) {
    const item = timeBlocks.createBacklogItem(input, Date.now());
    if (!item) return null;
    const current = this.timeBlocksSettings();
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      backlog: current.backlog.concat(item).slice(-timeBlocks.MAX_BACKLOG),
    });
    await this.save();
    this.refreshViews();
    return item;
  }

  async removeTimeBlockBacklog(id) {
    const current = this.timeBlocksSettings();
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      backlog: current.backlog.filter((item) => item.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async scheduleTimeBlockBacklog(id, input) {
    const current = this.timeBlocksSettings();
    const item = current.backlog.find((row) => row.id === id);
    if (!item) return null;
    const block = timeBlocks.createTimeBlock({
      ...(input || {}),
      title: input && input.title ? input.title : item.title,
      projectId: input && input.projectId ? input.projectId : item.projectId,
      course: input && input.course ? input.course : item.course,
      type: input && input.type ? input.type : "study",
    }, Date.now());
    if (!block) return null;
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      blocks: current.blocks.concat(block).slice(-timeBlocks.MAX_BLOCKS),
      backlog: current.backlog.filter((row) => row.id !== id),
    });
    await this.save();
    this.refreshViews();
    return block;
  }

  async scheduleStudyTask(taskId, input) {
    const task = this.studyWorkspaceSettings().studyTasks.tasks.find((row) => row.id === taskId);
    if (!task) return null;
    return this.addTimeBlock({
      ...(input || {}),
      title: input && input.title ? input.title : task.title,
      course: input && input.course ? input.course : task.course,
      tasks: [{ title: task.title, studyTaskId: task.id }],
    });
  }

  async importCitationFile(path) {
    const clean = str(path).trim();
    if (!clean) return { ok: false, reason: "path", message: "Enter a vault path to a .bib file." };
    const file = this.app.vault.getAbstractFileByPath(clean);
    if (!file) return { ok: false, reason: "missing", message: "No " + clean + " in this vault." };
    let markdown = "";
    try {
      markdown = await this.app.vault.read(file);
    } catch (e) {
      return { ok: false, reason: "read", message: String((e && e.message) || "Could not read the BibTeX file.") };
    }
    const parsed = citations.parseBibTeX(markdown);
    if (!parsed.length) return { ok: false, reason: "empty", message: "No usable BibTeX entries found." };
    const current = this.citationsSettings();
    const seen = new Set(current.entries.map((entry) => entry.key.toLowerCase()));
    const added = [];
    let skipped = 0;
    for (const entry of parsed) {
      const key = entry.key.toLowerCase();
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      added.push(entry);
    }
    if (added.length) {
      this.settings.citations = citations.normalizeCitationSettings({
        ...current,
        entries: current.entries.concat(added).slice(-citations.MAX_CITATIONS),
      });
      await this.save();
      this.refreshViews();
    }
    return { ok: true, added: added.length, skipped, entries: parsed.length };
  }

  async createCitationNote(id) {
    const current = this.citationsSettings();
    const entry = current.entries.find((row) => row.id === id || row.key === id);
    if (!entry) return { ok: false, reason: "missing", message: "That citation is gone." };
    const folder = str(current.folder).trim().replace(/^\/+|\/+$/g, "") || citations.CITATION_FOLDER;
    if (folder.split("/").some((part) => part === "..")) return { ok: false, reason: "path", message: "The citation folder is not safe." };
    const path = folder + "/" + citations.safeCitationName(entry) + ".md";
    if (this.app.vault.getAbstractFileByPath(path)) return { ok: false, reason: "exists", path, message: path + " already exists; nothing was overwritten." };
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch (e) {
        /* the folder may already exist after a sync */
      }
    }
    await this.app.vault.create(path, citations.citationNoteMarkdown(entry));
    return { ok: true, path };
  }

  async removeCitation(id) {
    const current = this.citationsSettings();
    if (!current.entries.some((entry) => entry.id === id)) return false;
    this.settings.citations = citations.normalizeCitationSettings({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id),
    });
    await this.save();
    this.refreshViews();
    return true;
  }

  async previewTimeBlockDayNote(date) {
    const current = this.timeBlocksSettings();
    const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
    const path = timeBlocks.dailyNotePath(key, current.dailyNoteFolder);
    if (!path) {
      return { ok: false, reason: "folder", date: key, message: "Set a Daily-note folder in Settings, Time blocks first." };
    }
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) return { ok: false, reason: "missing", date: key, path, message: "No " + path + " in this vault." };
    let markdown = "";
    try {
      markdown = await this.app.vault.read(file);
    } catch (e) {
      return { ok: false, reason: "read", date: key, path, message: String((e && e.message) || "Could not read the daily note.") };
    }
    const existing = new Set(
      timeBlocks.blocksForDate(current.blocks, key).map((block) => [block.start, block.end, block.title.toLowerCase()].join("|"))
    );
    const rows = timeBlocks.parseDailyNoteLines(markdown).map((row) => ({
      ...row,
      duplicate: existing.has([row.start, row.end, row.title.toLowerCase()].join("|")),
    }));
    return {
      ok: true,
      date: key,
      path,
      rows,
      newRows: rows.filter((row) => !row.duplicate),
      duplicates: rows.filter((row) => row.duplicate).length,
    };
  }

  async importTimeBlockDayNote(date) {
    const preview = await this.previewTimeBlockDayNote(date);
    if (!preview.ok || !preview.newRows.length) return { ...preview, added: 0, blocks: [] };
    const current = this.timeBlocksSettings();
    const created = [];
    const stamp = Date.now();
    for (const row of preview.newRows) {
      const block = timeBlocks.createTimeBlock({
        date: preview.date,
        start: row.start,
        end: row.end,
        title: row.title,
        type: "study",
      }, stamp + created.length);
      if (block) created.push(block);
    }
    this.settings.timeBlocks = timeBlocks.normalizeTimeBlocks({
      ...current,
      blocks: current.blocks.concat(created).slice(-timeBlocks.MAX_BLOCKS),
    });
    await this.save();
    this.refreshViews();
    return { ...preview, added: created.length, blocks: created };
  }

  async writeTimeBlockDay(date) {
    const current = this.timeBlocksSettings();
    const key = timeBlocks.dayValue(date) || timeBlocks.todayValue();
    const folder = str(current.notesFolder).trim().replace(/^\/+|\/+$/g, "") || "Time blocks";
    const path = folder + "/" + key + ".md";
    const markdown = timeBlocks.blocksToMarkdown(key, current.blocks, current.projects);
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      try {
        await this.app.vault.createFolder(folder);
      } catch (e) {
        /* the folder may already exist after a sync */
      }
    }
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing) await this.app.vault.modify(existing, markdown);
    else await this.app.vault.create(path, markdown);
    return path;
  }

  async remindStudyTasks() {
    const current = this.studyWorkspaceSettings().studyTasks;
    const due = studyWorkspace.dueStudyTasks(current.tasks, localDate());
    new Notice(
      due.length
        ? `${due.length} study task${due.length === 1 ? "" : "s"} due: ${due.slice(0, 4).map((task) => task.title).join("; ")}${due.length > 4 ? "; …" : ""}`
        : "No study tasks are due today.",
      6000
    );
    return due;
  }

  /* ---- Selection annotations ------------------------------------------ */

  async addAnnotation(input) {
    const annotation = studyWorkspace.createAnnotation(input, Date.now());
    if (!annotation) return null;
    const current = this.studyWorkspaceSettings().annotations;
    this.settings.annotations = studyWorkspace.normalizeAnnotations({
      ...current,
      annotations: current.annotations.concat(annotation).slice(-studyWorkspace.MAX_ANNOTATIONS),
    });
    await this.save();
    this.refreshViews();
    return annotation;
  }

  async removeAnnotation(id) {
    const current = this.studyWorkspaceSettings().annotations;
    this.settings.annotations = studyWorkspace.normalizeAnnotations({
      ...current,
      annotations: current.annotations.filter((annotation) => annotation.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  /* ---- Deep Notes ------------------------------------------------------ */

  async addDeepNotesSession(input) {
    const session = studyWorkspace.createDeepNotesSession(input, Date.now());
    if (!session) return null;
    const current = this.studyWorkspaceSettings().deepNotes;
    this.settings.deepNotes = studyWorkspace.normalizeDeepNotes({
      ...current,
      sessions: current.sessions.concat(session).slice(-studyWorkspace.MAX_SOCRATIC),
    });
    await this.save();
    this.refreshViews();
    return session;
  }

  async updateDeepNotesSession(id, patch) {
    const current = this.studyWorkspaceSettings().deepNotes;
    const sessions = current.sessions.map((session) => {
      if (session.id !== id) return session;
      return { ...session, ...(patch || {}), updatedAt: Date.now() };
    });
    this.settings.deepNotes = studyWorkspace.normalizeDeepNotes({ ...current, sessions });
    await this.save();
    this.refreshViews();
    return this.settings.deepNotes.sessions.find((session) => session.id === id) || null;
  }

  async removeDeepNotesSession(id) {
    const current = this.studyWorkspaceSettings().deepNotes;
    this.settings.deepNotes = studyWorkspace.normalizeDeepNotes({
      ...current,
      sessions: current.sessions.filter((session) => session.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async addVocabWord(input) {
    const word = studyWorkspace.createVocabWord(input, Date.now());
    if (!word) return null;
    const current = this.studyWorkspaceSettings().vocabulary;
    this.settings.vocabulary = studyWorkspace.normalizeVocabulary({
      ...current,
      words: current.words.concat(word).slice(-studyWorkspace.MAX_VOCAB),
    });
    await this.save();
    this.refreshViews();
    return word;
  }

  async importVocabWords(text) {
    const parsed = studyWorkspace.parseVocabLines(text);
    if (!parsed.words.length) return { count: 0, issues: parsed.issues };
    const current = this.studyWorkspaceSettings().vocabulary;
    const created = parsed.words.map((word) => studyWorkspace.createVocabWord(word, Date.now())).filter(Boolean);
    this.settings.vocabulary = studyWorkspace.normalizeVocabulary({
      ...current,
      words: current.words.concat(created).slice(-studyWorkspace.MAX_VOCAB),
    });
    await this.save();
    this.refreshViews();
    return { count: created.length, issues: parsed.issues };
  }

  async reviewVocabWord(id, grade) {
    const current = this.studyWorkspaceSettings().vocabulary;
    const word = current.words.find((entry) => entry.id === id);
    if (!word) return null;
    const next = studyWorkspace.reviewVocabWord(word, grade, localDate());
    this.settings.vocabulary = studyWorkspace.normalizeVocabulary({
      ...current,
      words: current.words.map((entry) => (entry.id === id ? next : entry)),
    });
    await this.save();
    this.refreshViews();
    return next;
  }

  async removeVocabWord(id) {
    const current = this.studyWorkspaceSettings().vocabulary;
    this.settings.vocabulary = studyWorkspace.normalizeVocabulary({
      ...current,
      words: current.words.filter((word) => word.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async addPlannerPlan(input) {
    const plan = studyWorkspace.createPlannerPlan(input, Date.now());
    if (!plan) return null;
    const current = this.studyWorkspaceSettings().lerntracker;
    this.settings.lerntracker = studyWorkspace.normalizePlanner({
      ...current,
      plans: this.appendCapped(current.plans, plan, studyWorkspace.MAX_PLANS, "Topic plans"),
    });
    await this.save();
    this.refreshViews();
    return plan;
  }

  async addPlannerTopic(id, input) {
    const current = this.studyWorkspaceSettings().lerntracker;
    const plan = current.plans.find((entry) => entry.id === id);
    if (!plan) return null;
    const topics = plan.topics.concat([{ name: input && input.name, targetPasses: input && input.targetPasses }]);
    const next = studyWorkspace.normalizePlanner({
      ...current,
      plans: current.plans.map((entry) => (entry.id === id ? { ...entry, topics } : entry)),
    });
    this.settings.lerntracker = next;
    await this.save();
    this.refreshViews();
    return next.plans.find((entry) => entry.id === id) || null;
  }

  async addPlannerPass(planId, topicId) {
    const current = this.studyWorkspaceSettings().lerntracker;
    const plan = current.plans.find((entry) => entry.id === planId);
    if (!plan) return null;
    const topics = plan.topics.map((topic) =>
      topic.id === topicId ? { ...topic, passes: Math.min(topic.targetPasses, topic.passes + 1) } : topic
    );
    const next = studyWorkspace.normalizePlanner({
      ...current,
      plans: current.plans.map((entry) => (entry.id === planId ? { ...entry, topics } : entry)),
    });
    this.settings.lerntracker = next;
    await this.save();
    this.refreshViews();
    return next.plans.find((entry) => entry.id === planId) || null;
  }

  async removePlannerTopic(planId, topicId) {
    const current = this.studyWorkspaceSettings().lerntracker;
    this.settings.lerntracker = studyWorkspace.normalizePlanner({
      ...current,
      plans: current.plans.map((plan) =>
        plan.id === planId ? { ...plan, topics: plan.topics.filter((topic) => topic.id !== topicId) } : plan
      ),
    });
    await this.save();
    this.refreshViews();
  }

  async removePlannerPlan(id) {
    const current = this.studyWorkspaceSettings().lerntracker;
    this.settings.lerntracker = studyWorkspace.normalizePlanner({
      ...current,
      plans: current.plans.filter((plan) => plan.id !== id),
    });
    await this.save();
    this.refreshViews();
  }

  async buildQuizIndex(options) {
    const opts = options && typeof options === "object" ? options : {};
    const folder = str(opts.folder).trim().replace(/^\/+|\/+$/g, "");
    const entries = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (folder && file.path !== folder && !file.path.startsWith(`${folder}/`)) continue;
      let text = "";
      try {
        text = this.app.vault.cachedRead ? await this.app.vault.cachedRead(file) : await this.app.vault.read(file);
      } catch (e) {
        continue;
      }
      entries.push({ path: file.path, text, fm: this.app.metadataCache.getFileCache(file)?.frontmatter || {} });
    }
    return studyWorkspace.collectQuizIndex(entries, {
      limit: opts.limit || this.settings.quizIndex.limit,
      attempts: this.settings.quizIndex.attempts,
    });
  }

  async buildRecallQueue(options) {
    const opts = options && typeof options === "object" ? options : {};
    const mode = opts.mode === "fragments" ? "fragments" : "headings";
    const folder = str(opts.folder).trim().replace(/^\/+|\/+$/g, "");
    const limit = Math.max(1, Math.min(100, Math.round(Number(opts.limit) || 20)));
    const units = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (folder && file.path !== folder && !file.path.startsWith(`${folder}/`)) continue;
      let text = "";
      try {
        text = this.app.vault.cachedRead ? await this.app.vault.cachedRead(file) : await this.app.vault.read(file);
      } catch (e) {
        continue;
      }
      units.push(...studyWorkspace.parseRecallUnits(text, file.path, mode));
    }
    const settings = this.studyWorkspaceSettings().recallScheduler;
    return studyWorkspace.recallDueUnits(units, settings.reviews, localDate()).slice(0, limit);
  }

  async reviewRecallUnit(unit, grade) {
    const current = this.studyWorkspaceSettings().recallScheduler;
    const previous = current.reviews[unit && unit.key] || null;
    const next = studyWorkspace.reviewRecallUnit(unit, grade, localDate(), previous);
    if (!next) return null;
    const reviews = { ...current.reviews, [next.key]: next };
    this.settings.recallScheduler = studyWorkspace.normalizeRecallScheduler({ ...current, reviews });
    await this.save();
    this.refreshViews();
    return next;
  }

  async createCornellNote(input) {
    const data = input && typeof input === "object" ? input : {};
    const title = str(data.title).trim();
    if (!title) return null;
    const folder = "Study Tools/Cornell";
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const base = safeName(title, "Cornell note");
    let path = `${folder}/${base}.md`;
    let suffix = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${folder}/${base} ${suffix}.md`;
      suffix++;
    }
    const file = await this.app.vault.create(path, buildCornellNote(title, data.course));
    const leaf = this.app.workspace.getLeaf ? this.app.workspace.getLeaf("tab") : null;
    if (leaf && leaf.openFile) await leaf.openFile(file);
    return file;
  }

  async addMissingFields(files) {
    let touched = 0;
    for (const f of files) {
      let n = 0;
      await this.app.fileManager.processFrontMatter(f, (fm) => {
        n = fillDefaults(fm);
      });
      if (n) touched++;
    }
    new Notice(`Added missing properties to ${touched} note${touched === 1 ? "" : "s"}.`);
  }
}

module.exports = {
  QuestionTrackerPlugin,
};
