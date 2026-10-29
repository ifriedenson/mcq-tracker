"use strict";
const { Notice, Platform, Plugin, TFile, TFolder, requestUrl } = require("obsidian");
const { OpenCodeManager } = require("./opencode-manager");
const { DEFAULT_SETTINGS, FILTER_FIELDS, FOLDER_AUTO_MAX, VIEW_TYPE, VIEW_TYPE_TODAY, VIEW_TYPE_CALENDAR, VIEW_TYPE_CARDS, VIEW_TYPE_REFERENCE, VIEW_TYPE_ASSIGNMENTS } = require("./constants");
const { PracticeView } = require("./practice-view");
const { InsightsView, VIEW_TYPE_INSIGHTS } = require("./insights-view");
const { TestView, VIEW_TYPE_TEST } = require("./exam-view");
const { TodayView } = require("./today-view");
const { ConfirmModal, FindQuestionModal, QuestionFolderModal } = require("./modals");
const { cloneFilters, fvals, hasFilters, isDue, matchSets, renameFolderInSettings } = require("./filters");
const { QuestionTrackerSettingTab } = require("./settings-tab");
const { AssignmentsView } = require("./assignments-view");
const { AssignmentModal } = require("./assignments-modal");
const { assignmentId, assignmentMarkdown, assignmentStats, categoryFor, isAssignmentNote, normalizeAssignmentSettings, normalizeStatus, parseAssignment, safeName, typeId, uniquePath, updateTaskCheckbox, updateTaskDue, updateTaskTitle } = require("./assignments");
const { OpenCodeClient, modelFromString, partsToTurns } = require("./opencode-client");
const { ApiClient } = require("./api-client");
const { sleep, hashString, localDate, ensureFolder, str } = require("./util");
const { normalizeLocalOcr } = require("./local-ocr");
const { PdfImportModal } = require("./import-modal");
const { CourseNotesModal, removeAiSummary } = require("./course-notes");
const { DocumentReviewModal } = require("./document-review-modal");
const { OcrModal } = require("./ocr-modal");
const { PaperScannerModal } = require("./paper-scanner");
const { PdfAnnotationModal } = require("./pdf-annotation-modal");
const { PdfInkModal } = require("./pdf-ink-modal");
const { sidecarPathFor } = require("./pdf-annotations");
const { WelcomeModal } = require("./welcome-modal");
const { FocusLogModal } = require("./focus-modal");
const { FOCUS_STORAGE_KEY, addStudySession, elapsedFocusMs, finishFocus, normalizeStudyLog, pauseFocus, resumeFocus, startFocus, studySummary } = require("./focus");
const { WELCOME_PRESETS, welcomeShouldShow } = require("./welcome");
const { applyAttempt, fillDefaults, findAnswerKey, parseSections, replaceMyNotes, setAttemptError, setLastErrorType } = require("./notes");
const { addVerificationBanner, buildBlindVerificationPrompt, normalizeVerificationMode, parseBlindVerification, verificationFields } = require("./answer-verification");
const { assertAllowedWritePath, assertProtectedUnchanged } = require("./ai-write-guard");
const agentWriteGuard = require("./agent-write-guard");
const { CalendarImportModal, CalendarView, StudySlotModal, applyCalendarWidth, parseScheduleBlock, renderDaySection } = require("./calendar-view");
const { cleanSubjectTitle, examMatchesCourse, examReviewCap, mergeCalendarSettings, nextClassStatus, nextExamForCourse, subjectKey, upcomingExams, visibleEvents } = require("./calendar-model");
const { buildStudyPlan } = require("./study-plan");
const { buildDashboard, courseMatches } = require("./analytics");
const { parseDashboardBlock, renderDashboardEmbed } = require("./analytics-embed");
const { dateKey, deriveSourceLabel, expandIcs, exportIcs, icsLooksValid, normalizeCalendarUrl, parseIcs } = require("./calendar-ics");
const { addResourceLink, classNoteIndex, findClassNote, openOrCreateClassNote, vaultFolders } = require("./calendar-notes");
const { cloneFrontmatter, enqueuePending, newAttemptId, packPendingAttempts, removePending, unpackAttempt, unpackPendingAttempts, updatePendingError } = require("./offline");
const { CardView } = require("./cards-view");
const { ReferenceView } = require("./reference-view");
const { mergeReferenceSettings } = require("./reference-data");
const { AP_EXAM_FOLDER, buildApExamNote, entryFromFrontmatter, sortApExamEntries, uniqueApExamPath } = require("./ap-exam-history");
const { attachFrontmatter, attachStudySlotFrontmatter, buildApResourceNote, detachFrontmatter, detachStudySlotFrontmatter, entryFromFrontmatter: resourceNoteEntry, findApResourceNote, markCheckedFrontmatter, sortApResourceNotes, uniqueApResourcePath } = require("./ap-resource-notes");
const { CardModal } = require("./card-modal");
const { ImageOcclusionModal } = require("./image-occlusion-modal");
const { CardExportModal, CardImportModal, cardsToAnki, cardsToQuestionSet, cardsToQuizlet, parseAnkiText, parseCrowdAnkiJson, parseGenericCsv, parseGiftText, parseMochiMarkdown, parseMoodleXml, parseQtiXml, parseQuestionSetText, parseQuizletText, parseSpacedRepetition } = require("./cards-import");
const { CardExtractModal } = require("./cards-extract-modal");
const { AnkiConnectModal, AnkiConnectClient, buildAnkiNotes, localSyncRecord, normalizeAnkiConnect, remoteSyncRecord, syncDecision, syncHash } = require("./anki-connect");
const { parseApkg } = require("./apkg");
const { extractCardsFromMarkdown, flashcardsFlag } = require("./cards-extract");
const { cardAttempt, cardNote, cardQueue, courseForFolder, deckConfig, deckSummary, isCardNote, mergeCardSettings, parseCardBody, parseMaskRows, resolveCard } = require("./cards");
const { cardUpdateDiff } = require("./card-write-diff");
const { DueQueueModal, buildDueQueue } = require("./due-queue");
const { MixedReviewModal, buildMixedQueue } = require("./mixed-review");
const { isStudyable, setStudyStatus: updateStudyStatus, restoreStudyStatus: applyStudyStatusSnapshot, studyStatusSummary, statusOf } = require("./study-status");
const { STUDY_SKIN_LABELS, normalizeStudySkin, studySkinEnabled } = require("./study-skin");
const { StudyStatusModal } = require("./study-status-modal");
const { gradeWithAi } = require("./card-grading-ai");
const { enqueuePendingGrade, newGradeId, packPendingGrades, removePendingGrade, unpackPendingGrades } = require("./card-grade-queue");
const { completeDailyQuiz: recordDailyCompletion, normalizeDailyQuiz, pickDailyQuiz } = require("./daily-quiz");
const { normalizeTutorRole } = require("./tutor-presets");
const { normalizeAiContext } = require("./ai-context");
const { AI_WRITE_STORAGE_KEY, appendAiWrite, latestAiWrite, makeAiWriteRecord, normalizeAiWrites } = require("./ai-writes");
const { findSourceFile, sourceOf } = require("./provenance");
const { buildTranscriptCardPrompt, buildTranscriptQuestionPrompt, isTranscriptNote, parseAiCards, parseAiQuestions, questionNote, safeFileName, transcriptInfo } = require("./transcript");
const { TranscriptPracticeModal } = require("./transcript-modal");
const { WeakSpotModal } = require("./weak-spot-modal");
const { buildWeakSpotPrompt, pickWeakSpot, weakSpotRows } = require("./weak-spot");
const { buildAttemptsCsv, buildResultsCsv, resultFileNames } = require("./results-export");
const { normalizeSupport } = require("./support");
const { migrateApiKeys } = require("./secret-keys");
const { hasAttemptId, repairHistoryCounters } = require("./history");
const { normalizeBlueprint } = require("./exam-sections");

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
    await this.loadSettings();
    this._calendarNoteIndex = null;
    this._calendarFolders = null;
    this._calendarCache = null;
    this._pendingCardGradeFlush = null;
    // Calendar notes are resolved by their durable UID/date properties, so any
    // create/delete/rename (or frontmatter edit) invalidates the shared index.
    const invalidateNotes = () => this.invalidateCalendarNotes();
    this.registerEvent(this.app.vault.on("create", invalidateNotes));
    this.registerEvent(this.app.vault.on("delete", invalidateNotes));
    this.registerEvent(this.app.vault.on("rename", invalidateNotes));
    this.registerEvent(this.app.metadataCache.on("changed", invalidateNotes));

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
      if (welcomeShouldShow(this.app)) activeWindow.setTimeout(() => this.openWelcome(), 1200);
      const ai = this.settings.ai;
      if (Platform.isDesktopApp && ai.enabled && ai.managed && ai.preStart && this.backend() === "opencode") {
        this.manager.ensure(() => {}).catch(() => {}); // quiet: errors show when you actually use the chat
      }
      if (this.settings.openPracticeOnStartUp && this.mcqEnabled()) this.activateView().catch(() => {});
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
    this.ribbonButtons = {};
    this.ribbonAdded = {};
    this.refreshRibbon();

    this.addCommand({ id: "open-practice-view", name: "Open practice view", callback: () => this.activateView() });
    this.addCommand({ id: "open-welcome", name: "Open welcome guide", callback: () => this.openWelcome() });
    this.addCommand({ id: "focus-start", name: "Focus: start a 25-minute session", callback: () => this.startFocusSession(25, this.settings.studyLog.lastCourse) });
    this.addCommand({ id: "focus-log", name: "Focus: log study time", callback: () => this.openFocusLog() });
    this.addCommand({ id: "study-plan", name: "Study plan: start for the next exam", callback: () => this.startNextExamPlan() });
    this.addCommand({ id: "open-dashboard", name: "Open analytics dashboard", callback: () => this.activateInsights("overview") });
    this.addCommand({ id: "export-results-csv", name: "Export practice results to CSV", callback: () => this.exportResultsCsv() });
    this.addCommand({ id: "import-pdf", name: "Import questions from a file (PDF, PowerPoint, Word)", callback: () => this.openPdfImport() });
    this.addCommand({ id: "ai-undo-last-write", name: "AI: undo the last generated notes", callback: () => this.undoLastAiWriteCommand() });
    this.addCommand({ id: "course-notes-import", name: "Import course notes from a lecture or chapter", callback: () => this.openCourseNotesImport() });
    this.addCommand({ id: "paper-scanner", name: "Paper scanner: photos to PDF", callback: () => this.openPaperScanner() });
    this.addCommand({ id: "document-review", name: "Review a document for import", callback: () => this.openDocumentReview() });
    this.addCommand({ id: "ocr-pdf", name: "OCR a scanned PDF", callback: () => this.openOcr() });
    this.addCommand({ id: "pdf-annotate", name: "PDF: add an annotation", callback: () => this.openPdfAnnotation() });
    this.addCommand({ id: "pdf-draw", name: "PDF: draw with pen or highlighter", callback: () => this.openPdfInk() });
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
    this.addCommand({ id: "calendar-add-schedule", name: "Calendar: add an .ics schedule", callback: () => this.openCalendarImport() });
    this.addCommand({
      id: "calendar-note-next-class",
      name: "Calendar: create or open the note for the next class",
      callback: () => this.openNextClassNote(),
    });
    this.addCommand({ id: "calendar-export", name: "Calendar: export the visible schedule to .ics", callback: () => this.exportCalendarIcs() });
    this.addCommand({ id: "open-cards", name: "Open cards", callback: () => this.activateCards() });
    this.addCommand({ id: "open-assignments", name: "Open assignments and grades", callback: () => this.activateAssignments() });
    this.addCommand({ id: "new-assignment", name: "Assignments: add an assignment", callback: () => this.openNewAssignment() });
    this.addCommand({ id: "open-reference", name: "Open Reference", callback: () => this.activateReference() });
    this.addCommand({ id: "open-ap-score", name: "Open AP score calculator", callback: () => this.openApScore() });
    this.addCommand({ id: "open-ap-resources", name: "Open AP resources", callback: () => this.openApResources() });
    this.addCommand({ id: "new-card", name: "Create a flashcard or vocabulary card", callback: () => this.openNewCard() });
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
    this.addCommand({ id: "export-cards", name: "Cards: export to Quizlet, Anki, Kahoot, Blooket or Gimkit", callback: () => this.openCardExport() });
    this.addCommand({ id: "push-cards-anki", name: "Cards: push to Anki (AnkiConnect)", callback: () => this.openAnkiConnectPush() });
    this.addCommand({ id: "sync-cards-anki", name: "Cards: sync with Anki (AnkiConnect)", callback: () => this.openAnkiConnectPush({ sync: true }) });
    this.addCommand({ id: "open-due-queue", name: "Open today's due queue", callback: () => this.openDueQueue() });
    this.addCommand({ id: "mixed-review", name: "Start mixed review", callback: () => this.openMixedReview() });
    this.addCommand({ id: "manage-study-status", name: "Manage known and excluded items", callback: () => this.openStudyStatusManager() });

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
    this.addCommand({ id: "weak-spots", name: "Show weak spots", callback: () => this.activateInsights("weak") });
    this.addCommand({ id: "error-log", name: "Show error log", callback: () => this.activateInsights("errors") });
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

    this.addSettingTab(new QuestionTrackerSettingTab(this.app, this));

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
    this.settings.localOcr = normalizeLocalOcr(saved.localOcr);
    this.settings.ai.tutorRole = normalizeTutorRole(this.settings.ai.tutorRole);
    this.settings.ai.context = normalizeAiContext(this.settings.ai.context);
    this.settings.ai.verification = normalizeVerificationMode(this.settings.ai.verification);
    // 0.2.0 saved settings had no `managed` flag: move those users to the automatic setup.
    if (saved.explanationDefault === undefined && saved.showRationale === false) this.settings.explanationDefault = "hide";
    delete this.settings.showRationale;
    if (!["show", "wrong", "hide"].includes(this.settings.explanationDefault)) this.settings.explanationDefault = "wrong";
    this.settings.testDefaults = Object.assign({}, DEFAULT_SETTINGS.testDefaults, saved.testDefaults || {});
    this.settings.testBlueprints = (Array.isArray(saved.testBlueprints) ? saved.testBlueprints : [])
      .map(normalizeBlueprint)
      .filter(Boolean)
      .slice(0, 20);
    this.settings.quickDefaults = Object.assign({}, DEFAULT_SETTINGS.quickDefaults, saved.quickDefaults || {});
    this.settings.dailyQuiz = normalizeDailyQuiz(saved.dailyQuiz);
    this.settings.practicePath = str(this.settings.practicePath).trim();
    this.settings.quickSession = saved.quickSession && typeof saved.quickSession === "object" ? saved.quickSession : null;
    this.settings.cards = mergeCardSettings(saved.cards, DEFAULT_SETTINGS.cards);
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
    if (migrateApiKeys(this.app, this.settings.ai.api)) await this.save();
  }

  save() {
    return this.saveData(this.settings);
  }

  /** Phones always use the direct API (OpenCode can't run there); desktop follows the setting. */
  backend() {
    return Platform.isMobile || this.settings.ai.backend === "api" ? "api" : "opencode";
  }

  /** Connection details: the managed local server if running, otherwise the manual settings. */
  conn() {
    const ai = this.settings.ai;
    if (ai.managed && this.manager.conn) return this.manager.conn;
    return { url: ai.url, username: ai.username, password: ai.password };
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

  openPdfInk(pdfPath) {
    if (this.moduleOff("mcq")) return;
    new PdfInkModal(this.app, this, { pdfPath: pdfPath || "" }).open();
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
    if (this.manager) this.manager.stop();
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

  /** The local formula sheet and unit converter are opt-in. */
  referenceEnabled() {
    return !!(this.settings.reference && this.settings.reference.enabled);
  }

  /** Assignments and grades are on unless the module was turned off. */
  assignmentsEnabled() {
    return !!(this.settings.assignments && this.settings.assignments.enabled !== false);
  }

  assignmentSettings() {
    return this.settings.assignments;
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
  }

  setupCalendarRibbon() {
    this.refreshRibbon();
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
    if (!this.calendarEnabled() || !String(course || "").trim()) return null;
    const at = now instanceof Date && !isNaN(now.getTime()) ? now : new Date();
    const exam = nextExamForCourse(this.calendarEvents(at), course, at);
    return exam ? examReviewCap(exam, at) : null;
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
    const signature = `${dateKey(range.start)}|${dateKey(range.end)}|${sources.map((s) => `${s.id}:${hashString(s.content)}`).join("|")}`;
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
    const events = visibleEvents(this.calendarSettings(), all);
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
    const url = normalizeCalendarUrl(rawUrl);
    if (!/^https?:\/\//i.test(url)) throw new Error("Enter an https:// or webcal:// calendar link.");
    const response = await requestUrl({ url, method: "GET" });
    const text = response && response.text;
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
    const response = await requestUrl({ url: source.url, method: "GET" });
    if (!icsLooksValid(response && response.text)) throw new Error("That calendar did not return an iCalendar feed.");
    source.content = response.text;
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
      if (String(data.points || "").trim() === "") delete fm.points;
      else fm.points = Number(data.points);
      if (String(data.score || "").trim() === "") delete fm.score;
      else fm.score = Number(data.score);
      if (status === "submitted" || status === "graded") fm.submitted = fm.submitted || localDate();
      else delete fm.submitted;
    });
    const text = await this.app.vault.read(file);
    let next = updateTaskTitle(updateTaskDue(text, data.due), data.title);
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

  /** Open the source note or the exact PDF page. */
  async openSource(fm, notePath) {
    const source = this.sourceInfo(fm, notePath);
    if (!source.has) {
      new Notice("This note has no source link. Imported questions get one automatically.");
      return false;
    }
    const target = source.link.replace(/^\[\[|\]\]$/g, "");
    if (this.app.workspace.openLinkText) {
      await this.app.workspace.openLinkText(target, notePath || "", false);
      return true;
    }
    const file = source.path ? this.app.vault.getAbstractFileByPath(source.path) : null;
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf("tab").openFile(file);
      return true;
    }
    new Notice("The source is not in this vault.");
    return false;
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

  /** Optional push. It also records note IDs so the next sync can pull changes. */
  async pushCardsToAnki(options) {
    if (this.moduleOff("cards")) throw new Error("Turn on the Cards module first.");
    const opts = options || {};
    const settings = normalizeAnkiConnect(this.settings.cards.ankiConnect);
    if (!settings.enabled) throw new Error("Turn on AnkiConnect sync under Settings, Cards, Decks first.");
    const cards = this.filteredCards({ deck: opts.deck, course: opts.course, includeHidden: true });
    if (!cards.length) throw new Error("No cards match the current deck and course filter.");
    const records = [];
    const warnings = [];
    for (const card of cards) {
      try {
        const text = await this.app.vault.cachedRead(card.file);
        records.push({ ...card, body: parseCardBody(text, card.fm) });
      } catch (e) {
        warnings.push(`${card.file.path}: ${String((e && e.message) || e)}`);
      }
    }
    const built = buildAnkiNotes(records, {
      deck: opts.targetDeck || settings.deck,
      defaultDeck: this.settings.cards.defaultDeck,
    });
    if (!built.notes.length) throw new Error("Nothing in this filter can be sent to Anki yet.");
    const result = await new AnkiConnectClient({ url: settings.url }).push(built.notes);
    const byPath = new Map(records.map((record) => [record.file.path, record]));
    let stamped = 0;
    for (let i = 0; i < result.acceptedIndexes.length; i++) {
      const id = result.ids[i];
      const note = built.notes[result.acceptedIndexes[i]];
      const record = note && byPath.get(built.paths[result.acceptedIndexes[i]]);
      if (id === null || id === undefined || !record) continue;
      // A configured target deck is applied by the sync, not compared as a
      // content edit. Stamp the same normalized deck the next sync will use,
      // otherwise every card would look changed on both sides.
      const local = localSyncRecord(record);
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
    return { ...result, stamped, format: "ankiconnect", count: built.notes.length, warnings: [...warnings, ...built.warnings] };
  }

  /** Push new cards and merge edits for cards already linked to Anki. */
  async syncCardsWithAnki(options) {
    if (this.moduleOff("cards")) throw new Error("Turn on the Cards module first.");
    const opts = options || {};
    const settings = normalizeAnkiConnect(this.settings.cards.ankiConnect);
    if (!settings.enabled) throw new Error("Turn on AnkiConnect sync under Settings, Cards, Decks first.");
    const cards = this.filteredCards({ deck: opts.deck, course: opts.course, includeHidden: true });
    if (!cards.length) throw new Error("No cards match the current deck and course filter.");
    const records = [];
    const errors = [];
    const warnings = [];
    for (const card of cards) {
      try {
        const text = await this.app.vault.cachedRead(card.file);
        records.push({ ...card, body: parseCardBody(text, card.fm) });
      } catch (e) {
        errors.push(`${card.file.path}: ${String((e && e.message) || e)}`);
      }
    }
    const client = new AnkiConnectClient({ url: settings.url });
    const unlinked = records.filter((record) => !str(record.fm && record.fm.anki_note_id).trim());
    let pushed = 0;
    let duplicates = 0;
    if (unlinked.length) {
      const built = buildAnkiNotes(unlinked, {
        deck: opts.targetDeck || settings.deck,
        defaultDeck: this.settings.cards.defaultDeck,
      });
      const result = await client.push(built.notes);
      duplicates += result.duplicates;
      warnings.push(...built.warnings);
      const byPath = new Map(unlinked.map((record) => [record.file.path, record]));
      for (let i = 0; i < result.acceptedIndexes.length; i++) {
        const noteId = result.ids[i];
        const note = built.notes[result.acceptedIndexes[i]];
        const record = note && byPath.get(built.paths[result.acceptedIndexes[i]]);
        if (noteId === null || noteId === undefined || !record) continue;
        const local = localSyncRecord(record);
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
          warnings.push(`${record.file.path}: the Anki note ${noteId} was not found.`);
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
        let local = localSyncRecord(record);
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
        let action = decision.action;
        if (action === "conflict" && settings.conflict === "local") action = "push";
        if (action === "conflict" && settings.conflict === "anki") action = "pull";
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
            const built = buildAnkiNotes([record], {
              deck: opts.targetDeck || settings.deck,
              defaultDeck: this.settings.cards.defaultDeck,
            });
            if (!built.notes.length) {
              skipped++;
              continue;
            }
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
    return {
      pushed,
      pulled,
      updated,
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

  openTranscriptPractice(path) {
    if (this.moduleOff("mcq") && this.moduleOff("cards")) {
      new Notice("Turn on MCQ Tracker or Cards before generating practice.");
      return;
    }
    const target = path && path.path ? path.path : str(path).trim();
    if (!target) {
      new Notice("Open a lecture note first.");
      return;
    }
    new TranscriptPracticeModal(this.app, this, { path: target }, () => this.refreshViews()).open();
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
    const reply = await this.aiComplete(prompt.system, prompt.user, { maxTokens: kind === "questions" ? 3500 : 2500 });
    const parsed = kind === "questions" ? parseAiQuestions(reply, count) : parseAiCards(reply, count);
    const items = kind === "questions" ? parsed.questions : parsed.cards;
    const verification = kind === "questions" ? await this.verifyDraftQuestions(items) : null;
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
      model: this.aiModelLabel(),
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

  /** Ask one independent question, without showing the stored key. */
  async verifyQuestionDraft(item) {
    const data = item || {};
    const key = str(data.answer).trim().toUpperCase();
    if (!/^[A-H]$/.test(key)) throw new Error("Only multiple-choice items with a letter answer can be checked.");
    if (!Array.isArray(data.choices) || !data.choices.length) throw new Error("This item has no answer choices to check.");
    const prompt = buildBlindVerificationPrompt({ question: data.question, choices: data.choices });
    const reply = await this.aiComplete(prompt.system, prompt.user, { maxTokens: 800 });
    const verdict = parseBlindVerification(reply);
    if (!verdict.answer) throw new Error("The AI did not return a usable answer letter.");
    return { match: verdict.answer === key, answer: verdict.answer, key, confidence: verdict.confidence };
  }

  /**
   * Runs the blind check over generated or imported drafts. A mismatch is
   * marked for review, or dropped when the user chose that setting.
   */
  async verifyDraftQuestions(items) {
    const list = Array.isArray(items) ? items : [];
    const mode = normalizeVerificationMode(this.settings.ai.verification);
    const model = this.aiModelLabel();
    const date = localDate();
    let checked = 0;
    let dropped = 0;
    let failed = 0;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      if (!Array.isArray(item.choices) || !item.choices.length || !str(item.answer).trim()) {
        item.verification = { status: "unchecked", match: null, answer: "", key: str(item.answer).trim(), model, date, drop: false };
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
      model: this.aiModelLabel(),
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

  aiModelLabel() {
    const ai = this.settings.ai;
    return (
      str(ai.backend === "opencode" ? ai.model : ai.api && ai.api.model).trim() ||
      str(ai.api && ai.api.provider).trim() ||
      "AI"
    );
  }

  /** Draft cards or questions from a transcript. This method writes nothing. */
  async generateTranscriptPractice(path, options) {
    const opts = options || {};
    const info = await this.inspectTranscript(path);
    if (!info.isTranscript && !opts.force) {
      throw new Error("This note does not look like a lecture transcript. Add `transcript: true` or open it from the lecture-practice command to use it anyway.");
    }
    const kind = opts.kind === "questions" ? "questions" : "cards";
    if (kind === "questions" && this.moduleOff("mcq")) throw new Error("Turn on MCQ Tracker to create practice questions.");
    if (kind === "cards" && this.moduleOff("cards")) throw new Error("Turn on Cards to create flashcards.");
    const count = Math.min(30, Math.max(1, Math.round(Number(opts.count) || (kind === "questions" ? 5 : 8))));
    const course = str(opts.course).trim() || info.course || courseForFolder(this.settings, info.path) || "";
    const base = { kind, sourcePath: info.path, title: info.title, course, items: [], errors: [], ai: false, model: "" };

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
        ? buildTranscriptQuestionPrompt({ title: info.title, course, text: info.text, count })
        : buildTranscriptCardPrompt({ title: info.title, course, text: info.text, count });
    const reply = await this.aiComplete(prompt.system, prompt.user, { maxTokens: kind === "questions" ? 4000 : 3000 });
    const parsed = kind === "questions" ? parseAiQuestions(reply, count) : parseAiCards(reply, count);
    const items = kind === "questions" ? parsed.questions : parsed.cards;
    const verification = kind === "questions" ? await this.verifyDraftQuestions(items) : null;
    return {
      ...base,
      ai: true,
      model: this.aiModelLabel(),
      items: items.filter((item) => !(item.verification && item.verification.drop)),
      verification,
    };
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
        const note = questionNote(
          item,
          { course: g.course, source: g.title },
          qid,
          { model: g.model || this.aiModelLabel(), date: localDate(), sourcePath: g.sourcePath, sourceKind: "note", verification: item.verification }
        );
        assertAllowedWritePath(path, this.settings);
        await this.app.vault.create(path, note);
        paths.push(path);
      } catch (e) {
        errors.push(`${title}: ${str(e && e.message ? e.message : e)}`);
      }
    }
    if (paths.length) this.refreshViews();
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
    const parsed = extractCardsFromMarkdown(text, { sourcePath: file.path, deck, course, tags });
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
      const data = buildDashboard({
        questions: this.getQuestions(),
        cards: this.getCards ? this.getCards() : [],
        studyLog: this.settings.studyLog,
        confidenceLabels: this.settings.confidenceLabels,
        today: new Date(),
        course: opts.course,
        field: opts.field,
        weeks: opts.weeks,
      });
      const plan = this.studyPlan ? this.studyPlan() : null;
      data.plan = plan && (!opts.course || courseMatches(plan.course, opts.course)) ? plan : null;
      renderDashboardEmbed(box, data, opts, {
        onPractice: (field, value) => this.practiceWith({ [field]: [value] }, "smart"),
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

  /** The next exam's plan, scoped to matching question and card courses. */
  studyPlan() {
    if (!this.calendarEnabled()) return null;
    const exam = upcomingExams(this.calendarEvents(), new Date(), 1)[0];
    if (!exam) return null;
    const title = cleanSubjectTitle(exam.summary) || str(exam.summary);
    const course =
      str(exam.course).trim() ||
      title.replace(/\s*[-–—:]\s*(final|midterm|exam|test|quiz|assessment)\b.*$/i, "").replace(/\s+(final|midterm|exam|test|quiz|assessment)(\s+exam)?\s*$/i, "").trim() ||
      title;
    const matches = (value) => !!str(value).trim() && examMatchesCourse({ summary: value }, course);
    const questions = this.getQuestions().filter((q) => matches(q.fm.course) || matches(q.fm.test));
    if (!questions.length) return null;
    const cards = this.cardsEnabled() ? this.getCards().filter((c) => matches(c.course || (c.fm && c.fm.course))) : [];
    return buildStudyPlan(exam, questions, cards, { today: localDate(), course });
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
    const minutes = Math.max(1, Math.round(Number(opts.minutes) || 5));
    await view.startQuick("time", minutes, { pool: opts.pool, mode: opts.mode, label: opts.label });
    return view;
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
    const picked = pickDailyQuiz(this.getQuestions(), cfg, today);
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

  async exportCalendarIcs() {
    if (this.moduleOff("calendar")) return;
    const events = this.calendarEvents();
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
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (isCardNote(fm)) out.push(resolveCard(file, fm, this.settings));
    }
    return out;
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
    return this.recordAttempt(card.file, {
      ...cardAttempt(grade, seconds),
      ...(extra || {}),
      course: (extra && extra.course) || card.course || (card.fm && card.fm.course) || "",
      now: new Date(),
    });
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

  queueCardGrade(card, typed, strictness) {
    const id = newGradeId();
    const entry = {
      id,
      path: card.file.path,
      cardId: String(card.fm && card.fm.card_id ? card.fm.card_id : ""),
      front: card.body && card.body.front ? card.body.front : "",
      expected: card.body && card.body.back ? card.body.back : "",
      typed: String(typed || ""),
      strictness: strictness || "standard",
      createdAt: new Date().toISOString(),
    };
    this.writePendingCardGrades(enqueuePendingGrade(this.readPendingCardGrades(), entry));
    return id;
  }

  discardPendingCardGrade(id) {
    if (!id) return;
    this.writePendingCardGrades(removePendingGrade(this.readPendingCardGrades(), id));
  }

  pendingCardGrades() {
    return this.readPendingCardGrades();
  }

  /** One completion path for both AI backends; the card grader only sees a chat-shaped client. */
  async aiComplete(system, user, opts) {
    const ai = this.settings.ai;
    if (!ai.enabled) throw new Error("Turn on AI features in the plugin settings first.");
    if (this.backend() === "opencode") {
      await this.ensureOpenCode();
      const oc = this.openCode();
      const session = await oc.createSession("Grade a flashcard answer");
      const body = { parts: [{ type: "text", text: user }], system };
      const model = modelFromString(ai.model);
      if (model) body.model = model;
      await oc.send(session.id, body);
      const turns = partsToTurns(await oc.messages(session.id));
      const last = [...turns].reverse().find((turn) => turn.role === "assistant");
      const text = last ? last.texts.join("\n").trim() : "";
      if (!text) throw new Error("OpenCode returned an empty reply.");
      return text;
    }
    return new ApiClient(ai, this.app).chat(system, [{ role: "user", content: user }], opts);
  }

  /** Opt-in image request for OCR. Only Direct AI can receive page images. */
  async aiVision(system, prompt, images, opts) {
    const ai = this.settings.ai;
    if (!ai.enabled) throw new Error("Turn on AI features in the plugin settings first.");
    if (this.backend() !== "api") throw new Error("Vision OCR needs the Direct AI backend; OpenCode cannot receive page images through this plugin.");
    return new ApiClient(ai, this.app).vision(system, prompt, images, opts);
  }

  gradeCardWithAi(card, typed, strictness) {
    const client = { chat: (system, messages, opts) => this.aiComplete(system, messages && messages[0] ? messages[0].content : "", opts) };
    return gradeWithAi(client, { front: card.body && card.body.front, expected: card.body && card.body.back, typed, strictness });
  }

  /** Replay the device-local card-grade queue. One pending entry becomes exactly one AI grade. */
  flushPendingCardGrades() {
    if (this._pendingCardGradeFlush) return this._pendingCardGradeFlush;
    if (!this.settings.ai.enabled || !this.settings.cards.aiGrading) {
      return Promise.resolve({ graded: 0, remaining: this.readPendingCardGrades().length, disabled: true });
    }
    this._pendingCardGradeFlush = (async () => {
      let list = this.readPendingCardGrades().slice();
      let graded = 0;
      for (const entry of list.slice()) {
        const file = this.app.vault.getAbstractFileByPath(entry.path);
        if (!(file instanceof TFile)) {
          list = removePendingGrade(list, entry.id);
          continue;
        }
        try {
          const ai = await gradeWithAi(
            { chat: (system, messages, opts) => this.aiComplete(system, messages && messages[0] ? messages[0].content : "", opts) },
            entry
          );
          await this.app.fileManager.processFrontMatter(file, (fm) => {
            fm.last_typed_answer = entry.typed.slice(0, 1000);
            fm.last_verdict = ai.verdict;
            fm.graded_by = "ai";
            fm.graded_on = localDate();
            fm.grade_status = "graded";
            fm.grade_confidence = ai.confidence;
            fm.grade_feedback = ai.reason;
          });
          list = removePendingGrade(list, entry.id);
          graded++;
        } catch (e) {
          break; // still offline or provider unavailable: keep this and the rest for later
        }
      }
      this.writePendingCardGrades(list);
      return { graded, remaining: list.length, disabled: false };
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
    return buildDueQueue(questions, cards, { today, limit: opts.limit });
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
    const queue = buildMixedQueue(this.getQuestions(), this.getCards(), {
      today: localDate(),
      limit: this.settings.cards.reviewLimit || 20,
    });
    if (!queue.items.length) {
      new Notice("Nothing is due across both modules yet.");
      return null;
    }
    const modal = new MixedReviewModal(this.app, this, { limit: this.settings.cards.reviewLimit || 20 }, () => {
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
      cfg = { name: deck, folder: "", course: "" };
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
    const result = await this.importParsedCards(parsed.cards, { ...opts, errors: parsed.errors });
    return { ...result, warnings: parsed.warnings, skippedInFile: parsed.skipped };
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
    if (!/\.(xml|txt)$/i.test(String(path || ""))) {
      throw new Error("Choose the .xml file exported by Moodle or your QTI quiz bank.");
    }
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = kind === "qti" ? parseQtiXml(text, { sourcePath: file.path, deck: opts.deck }) : parseMoodleXml(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, { ...opts, deck: String(opts.deck || "").trim() || file.basename, errors: parsed.errors });
  }

  /** Import a Quizlet text/CSV export. Quizlet has no deck field, so the fallback deck is used. */
  async importCardsFromQuizlet(path, options) {
    if (this.moduleOff("cards")) return { created: 0, skipped: 0, errors: [] };
    const opts = options || {};
    if (/\.pdf$/i.test(String(path || ""))) {
      throw new Error("Save the Quizlet export as .txt or .csv; PDFs are not read by this plugin.");
    }
    const file = this.app.vault.getAbstractFileByPath(String(path || ""));
    if (!file) throw new Error("That file is not in the vault.");
    const text = await this.app.vault.cachedRead(file);
    const parsed = parseQuizletText(text, { sourcePath: file.path, deck: opts.deck });
    return this.importParsedCards(parsed.cards, opts);
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
    const result = await this.importParsedCards(parsed.cards, { ...opts, errors: parsed.errors });
    return { ...result, headers: parsed.headers, mapping: parsed.mapping, headerKey: parsed.headerKey, hasHeader: parsed.hasHeader, skippedRows: parsed.skipped, delimiter: parsed.delimiter };
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
    return this.importParsedCards(parsed.cards, { ...opts, deck, errors: parsed.errors });
  }

  /** Write the current card filter as Quizlet or Anki text, or a platform CSV. */
  async exportCards(format, options) {
    if (this.moduleOff("cards")) throw new Error("Turn on the Cards module first.");
    const opts = options || {};
    const kind = String(format || "quizlet").toLowerCase();
    if (!["quizlet", "anki", "kahoot", "blooket", "gimkit"].includes(kind)) {
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
        if (!["quizlet", "anki"].includes(kind) && !record.body.back) warnings.push(`${card.file.path} has no answer and was skipped.`);
      } catch (e) {
        warnings.push(`${card.file.path}: ${String((e && e.message) || e)}`);
      }
    }
    const output = kind === "quizlet" ? cardsToQuizlet(records) : kind === "anki" ? cardsToAnki(records) : cardsToQuestionSet(kind, records);
    if (!output) throw new Error("Nothing in this filter can be exported in that format yet.");
    const root = String(this.settings.cards.newCardFolder || "Cards").replace(/^\/+|\/+$/g, "") || "Cards";
    const folder = `${root}/exports`;
    await ensureFolder(this.app, folder);
    const base = `${opts.deck && opts.deck !== "all" ? opts.deck : "cards"} ${kind} ${localDate()}`
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const extension = kind === "quizlet" || kind === "anki" ? "txt" : "csv";
    let path = `${folder}/${base}.${extension}`;
    let n = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = `${folder}/${base} ${n}.${extension}`;
      n++;
    }
    await this.app.vault.create(path, output);
    new Notice(`Exported ${records.length} card${records.length === 1 ? "" : "s"} to ${path}.`, 6000);
    return { path, count: records.length, format: kind, warnings };
  }

  /** Parsed-card preview with duplicate counts, used before writing anything. */
  async previewCardsImport(type, path, options) {
    if (this.moduleOff("cards")) return { cards: [], total: 0, duplicates: 0, duplicatePaths: [], errors: ["Turn on the Cards module first."], format: type };
    const kind = String(type || "").toLowerCase();
    const opts = options || {};
    const cards = [];
    const errors = [];
    const add = (parsed) => {
      cards.push(...((parsed && parsed.cards) || []));
      if (parsed && Array.isArray(parsed.errors)) errors.push(...parsed.errors);
    };
    try {
      if (kind === "spaced" || kind === "mochi") {
        const root = String(path || "").replace(/^\/+|\/+$/g, "");
        const files = this.app.vault.getMarkdownFiles().filter((file) => (!root || file.path === root || file.path.startsWith(root + "/")) && !isCardNote(this.app.metadataCache.getFileCache(file)?.frontmatter));
        for (const file of files) {
          try {
            const text = await this.app.vault.cachedRead(file);
            const folder = String(file.path || "").split("/").slice(0, -1).join("/");
            const deck = String(opts.deck || "").trim() || (kind === "mochi" ? (folder ? folder.split("/").pop() : "Imported") : (root ? root.split("/").pop() : this.settings.cards.defaultDeck));
            add(kind === "mochi" ? parseMochiMarkdown(text, { sourcePath: file.path, deck }) : parseSpacedRepetition(text, { sourcePath: file.path, deck }));
          } catch (e) {
            errors.push(`${file.path}: ${String((e && e.message) || e)}`);
          }
        }
      } else if (kind === "csv") {
        const parsed = await this.previewCardsCsv(path, opts);
        add(parsed);
      } else if (kind === "apkg") {
        const file = this.app.vault.getAbstractFileByPath(String(path || ""));
        if (!file) throw new Error("That .apkg file is not in the vault.");
        const bytes = await this.readVaultBytes(file);
        add(parseApkg(bytes, { sourcePath: file.path, deck: String(opts.deck || "").trim() || file.basename }));
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
        else if (["kahoot", "blooket", "gimkit"].includes(kind)) add(parseQuestionSetText(text, { ...base, format: kind }));
        else throw new Error(`Unsupported import format: ${kind || "none"}.`);
      }
    } catch (e) {
      errors.push(String((e && e.message) || e));
    }
    const existing = this.existingImportCardMap();
    const duplicatePaths = cards.filter((card) => card.importKey && existing.has(card.importKey)).map((card) => existing.get(card.importKey).file.path);
    return this.decorateImportPreview({ cards, total: cards.length, duplicates: duplicatePaths.length, duplicatePaths, errors, format: kind });
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
    for (const card of Array.isArray(parsed) ? parsed : []) {
      const duplicate = card.importKey ? existing.get(card.importKey) : null;
      if (duplicate && mode === "skip") {
        skipped++;
        continue;
      }
      if (duplicate && mode === "update") {
        try {
          await this.updateCardFromImport(duplicate, card, { ...opts, importBatch });
          updated++;
        } catch (e) {
          errors.push(`${card.importSource || "import"}: ${String((e && e.message) || e)}`);
        }
        continue;
      }
      const copy = !!duplicate;
      const target = copy ? { ...card, importKey: `${card.importKey}~copy-${Date.now().toString(36)}-${copied + 1}` } : card;
      try {
        await this.createCard({
          ...target,
          deck: target.deck || String(opts.deck || "").trim(),
          course: String(opts.course || "").trim() || target.course || "",
          importBatch: target.importBatch || importBatch,
          importSourceUrl: target.importSourceUrl || opts.importSourceUrl || "",
        });
        if (target.importKey) existing.set(target.importKey, target);
        if (copy) copied++;
        else created++;
      } catch (e) {
        errors.push(`${target.importSource || "import"}: ${String((e && e.message) || e)}`);
      }
    }
    return { created, updated, copied, skipped, errors, total: Array.isArray(parsed) ? parsed.length : 0, duplicateMode: mode };
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
  startSession(path) {
    this.session = { path, elapsedMs: 0, runningSince: Date.now(), lastBeat: Date.now() };
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

  async recordAttempt(file, a) {
    const attempt = { ...a, attemptId: a.attemptId || newAttemptId(a.now) };
    const opts = { scheduler: this.settings.scheduler, fsrsRetention: this.settings.fsrsRetention, attemptId: attempt.attemptId };

    // Build the result the UI should show before touching the note. If the write
    // fails, this summary is still correct and the attempt can be replayed later.
    let preview;
    try {
      const cached = this.app.metadataCache.getFileCache(file);
      const copy = cloneFrontmatter(cached && cached.frontmatter);
      preview = applyAttempt(copy, attempt, this.settings.intervals, {
        ...opts,
        examCap: this.examCapFor(attempt.course || copy.course, attempt.now),
      });
    } catch (e) {
      preview = null;
    }

    let summary;
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        summary = applyAttempt(fm, attempt, this.settings.intervals, {
          ...opts,
          examCap: this.examCapFor(attempt.course || fm.course, attempt.now),
        });
      });
    } catch (e) {
      if (!preview) throw e;
      const list = enqueuePending(this.readPendingAttempts(), file.path, attempt);
      this.writePendingAttempts(list);
      new Notice("Saved offline. This result will be added to the note when the vault is writable.", 7000);
      return { ...preview, queued: true, pending: list.length, attemptId: attempt.attemptId };
    }

    if (summary && summary.fsrsError) {
      new Notice("FSRS couldn't schedule this question, so the simple ladder was used.");
    }
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
            applyAttempt(fm, attempt, this.settings.intervals, {
              scheduler: this.settings.scheduler,
              fsrsRetention: this.settings.fsrsRetention,
              attemptId: entry.id,
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
    let summary;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      summary = updateStudyStatus(fm, status, {
        now: opts.now || new Date(),
        days: opts.days === undefined ? this.settings.knownDays : opts.days,
        reason: opts.reason,
      });
    });
    this.refreshViews();
    return summary;
  }

  studyStatusNotice(summary) {
    if (!summary) return "Study status updated.";
    if (summary.status === "known") return `Known for ${summary.days} days (until ${summary.until}).`;
    if (summary.status === "excluded") return "Excluded from practice. Restore it from Manage known and excluded items.";
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
        model: generated.model || this.aiModelLabel(),
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
    return out.sort((a, b) =>
      a.status === b.status
        ? a.title.localeCompare(b.title, undefined, { numeric: true })
        : a.status === "excluded"
          ? -1
          : 1
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

  async saveMyNotes(file, text) {
    await this.app.vault.process(file, (data) => replaceMyNotes(data, text));
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
