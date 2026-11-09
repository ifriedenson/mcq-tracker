# Capability inventory — derived from the bundle

Generated Nov 7, 2026 from the built `main.js` (`T`, the plugin's test surface) and the
plugin's registered commands, not from prose. Each row names the exports a group carries
and the test files that cite that group; `tests/capability-inventory.test.js` re-derives
the table and fails if a group, export count, command or citing test drifts.

**Modules:** 437 groups, 3048 exports. **Commands:** 231. **Gaps:** 3 groups and 0 commands with no citing test (listed at the end).

## Modules

| Group | Exports | Tests that cite it |
| --- | --- | --- |
| `API_PRESETS` | 11 | `tests/local-models.test.js`, `tests/qwen-preset.test.js` |
| `API_SYSTEM` | 0 | `tests/ai-write-guard.test.js` |
| `ASSIGNMENTS_TABS` | 3 | `tests/modules.test.js` |
| `AgentEditReviewModal` | 0 | `tests/feature-surfaces.test.js` |
| `AiImportHelpModal` | 0 | `tests/ai-import-help.test.js` |
| `ApiClient` | 0 | `tests/chat-stream.test.js`, `tests/local-models.test.js`, `tests/model-discovery.test.js`, `tests/ocr.test.js`, `tests/qwen-preset.test.js`, `tests/secret-keys.test.js` |
| `AssignmentModal` | 0 | `tests/feature-surfaces.test.js` |
| `AssignmentsView` | 0 | `tests/assignments.test.js`, `tests/mobile-module-layout.test.js` |
| `AutoAnkiModal` | 0 | `tests/auto-anki.test.js` |
| `CALENDAR_TABS` | 7 | `tests/calendar.test.js` |
| `CARDS_TABS` | 4 | `tests/modules.test.js` |
| `CalculationPreviewModal` | 0 | `tests/feature-surfaces.test.js` |
| `CalendarView` | 0 | `tests/calendar.test.js`, `tests/term-calendar.test.js` |
| `CardExtractModal` | 0 | `tests/feature-surfaces.test.js` |
| `CardModal` | 0 | `tests/source-recall.test.js` |
| `CardView` | 0 | `tests/card-cram.test.js`, `tests/card-learning.test.js`, `tests/card-mother-cram.test.js`, `tests/card-reveal.test.js`, `tests/card-speech.test.js`, `tests/cards.test.js`, `tests/flashcard-generate.test.js`, `tests/interval-preview.test.js`, `tests/mobile-module-layout.test.js`, `tests/source-recall.test.js`, `tests/study-status.test.js` |
| `ChatPanel` | 1 | `tests/agent-view.test.js`, `tests/chat-branches.test.js`, `tests/chat-panel-copilot.test.js`, `tests/chat-panel-mentions.test.js`, `tests/diagnostics-gauge.test.js`, `tests/memory-export.test.js`, `tests/note-context.test.js`, `tests/quick-ask.test.js`, `tests/security-hardening.test.js`, `tests/skills-pricing.test.js`, `tests/think-first.test.js` |
| `CourseOverviewModal` | 0 | `tests/core-values.test.js` |
| `DEFAULT_SETTINGS` | 118 | `tests/grading.test.js` |
| `DocumentReviewModal` | 0 | `tests/feature-surfaces.test.js` |
| `DueQueueModal` | 0 | `tests/feature-surfaces.test.js` |
| `EpubReaderModal` | 0 | `tests/epub.test.js` |
| `FindQuestionModal` | 0 | `tests/views.test.js` |
| `FocusLogModal` | 0 | `tests/feature-surfaces.test.js` |
| `FolderFilterSuggest` | 0 | `tests/views.test.js` |
| `FrqGraderModal` | 0 | `tests/frq-handwriting.test.js`, `tests/frq.test.js` |
| `FrqImportPreviewModal` | 0 | `tests/frq-import.test.js` |
| `FrqPdfPickerModal` | 0 | `tests/frq-import.test.js` |
| `GLOBAL_TABS` | 3 | `tests/modules.test.js` |
| `InsightsView` | 0 | `tests/knowledge-record-scenario.test.js`, `tests/knowledge-view.test.js`, `tests/study-plan.test.js`, `tests/views.test.js` |
| `LocalEventModal` | 0 | `tests/feature-surfaces.test.js` |
| `LocalEventsView` | 0 | `tests/mobile-calendar-agenda.test.js` |
| `MAX_OPENCODE_MAJOR` | 0 | `tests/feature-surfaces.test.js` |
| `MCQ_TABS` | 5 | `tests/calendar.test.js`, `tests/daily-quiz.test.js` |
| `MixedReviewModal` | 0 | `tests/mixed-review.test.js` |
| `NewFrqNoteModal` | 0 | `tests/frq.test.js` |
| `NoteReviewDock` | 0 | `tests/feature-surfaces.test.js` |
| `NoteReviewModal` | 0 | `tests/spaced-everything.test.js` |
| `OcrModal` | 0 | `tests/feature-surfaces.test.js` |
| `OpenCodeClient` | 0 | `tests/chat-stream.test.js`, `tests/opencode-compat.test.js` |
| `OpenCodeManager` | 0 | `tests/opencode-compat.test.js` |
| `PdfAnnotationModal` | 0 | `tests/feature-surfaces.test.js` |
| `PdfImportModal` | 0 | `tests/ai-import-help.test.js`, `tests/empty-state.test.js`, `tests/import-existing-folder.test.js`, `tests/import-properties.test.js`, `tests/import-source.test.js`, `tests/views.test.js` |
| `PdfInkModal` | 0 | `tests/pdf-backlinks.test.js`, `tests/pdf-ink.test.js` |
| `PomodoroView` | 0 | `tests/mobile-module-layout.test.js`, `tests/pomodoro-view.test.js` |
| `PracticeView` | 0 | `tests/ai-beginner-wizard.test.js`, `tests/closed-book.test.js`, `tests/empty-state.test.js`, `tests/exam-ready.test.js`, `tests/hints.test.js`, `tests/matching.test.js`, `tests/math-rendering.test.js`, `tests/mobile-practice.test.js`, `tests/modules.test.js`, `tests/needs-fixing.test.js`, `tests/practice-chrome.test.js`, `tests/practice-fullscreen.test.js`, `tests/practice-keys.test.js`, `tests/practice-tools.test.js`, `tests/study-modes.test.js`, `tests/study-skin.test.js`, `tests/study-status.test.js`, `tests/views.test.js` |
| `QUICK_COUNT_OPTIONS` | 3 | `tests/uncited-groups.test.js` |
| `QUICK_START_URL` | 0 | `tests/empty-state.test.js` |
| `QUICK_TIME_OPTIONS` | 3 | `tests/uncited-groups.test.js` |
| `QuestionFolderModal` | 0 | `tests/views.test.js` |
| `QuestionTrackerSettingTab` | 0 | `tests/feature-surfaces.test.js`, `tests/settings-navigation.test.js`, `tests/settings-simple-mode.test.js` |
| `QuickAddModal` | 0 | `tests/ai-beginner-wizard.test.js`, `tests/feature-surfaces.test.js` |
| `QuickAskModal` | 0 | `tests/quick-ask.test.js` |
| `QuickChatModal` | 0 | `tests/quick-chat-bookmarks.test.js` |
| `REFERENCE_TABS` | 2 | `tests/modules.test.js` |
| `ReferenceView` | 0 | `tests/ap-exam-history.test.js`, `tests/ap-resource-notes.test.js`, `tests/ap-score.test.js`, `tests/calculator.test.js`, `tests/complex.test.js`, `tests/geometry.test.js`, `tests/graph-3d.test.js`, `tests/graph-complex.test.js`, `tests/matrix.test.js`, `tests/mobile-reference-stats.test.js`, `tests/reference-advanced.test.js`, `tests/reference-sheets.test.js`, `tests/reference-tools.test.js`, `tests/reference.test.js` |
| `ReviewCalendarView` | 0 | `tests/mobile-calendar-agenda.test.js` |
| `SETTINGS_MODULES` | 48 | `tests/calendar.test.js`, `tests/modules.test.js`, `tests/review-calendar.test.js`, `tests/study-tool-settings.test.js` |
| `SimpleNoteQuizModal` | 0 | `tests/simple-note-quiz.test.js` |
| `SpacedEverythingCaptureModal` | 0 | `tests/feature-surfaces.test.js` |
| `StudyMatchModal` | 0 | `tests/study-modes.test.js` |
| `StudySlotModal` | 0 | `tests/calendar.test.js` |
| `StudyStatsView` | 0 | `tests/mobile-reference-stats.test.js` |
| `StudyStatusModal` | 0 | `tests/feature-surfaces.test.js` |
| `StudyToolsView` | 0 | `tests/lecture-links.test.js`, `tests/mobile-module-layout.test.js`, `tests/study-tools.test.js` |
| `StudyWorkspaceView` | 0 | `tests/citations.test.js`, `tests/fsrs-fit.test.js`, `tests/glossary.test.js`, `tests/mobile-module-layout.test.js`, `tests/reading-library.test.js`, `tests/settings-consolidation.test.js`, `tests/study-modules-2.test.js`, `tests/study-modules-3.test.js`, `tests/study-workspace-health.test.js`, `tests/study-workspace-layout.test.js`, `tests/study-workspace-tabs.test.js`, `tests/study-workspace.test.js`, `tests/task-tags.test.js`, `tests/time-blocks.test.js`, `tests/vault-task-index.test.js`, `tests/wordnet.test.js`, `tests/writing-sessions.test.js` |
| `TaskListView` | 0 | `tests/task-list.test.js` |
| `TestView` | 0 | `tests/views.test.js` |
| `TodayView` | 0 | `tests/ap-exam-resources.test.js`, `tests/core-values.test.js`, `tests/daily-quiz-freeze.test.js`, `tests/daily-quiz.test.js`, `tests/focus.test.js`, `tests/frq-review.test.js`, `tests/reading-plan.test.js`, `tests/study-plan.test.js`, `tests/study-tools.test.js`, `tests/today-dom.test.js`, `tests/today.test.js` |
| `TranscriptPracticeModal` | 0 | `tests/feature-surfaces.test.js` |
| `WeakSpotModal` | 0 | `tests/feature-surfaces.test.js` |
| `WelcomeModal` | 0 | `tests/feature-surfaces.test.js`, `tests/welcome.test.js` |
| `WhatsNewModal` | 0 | `tests/feature-surfaces.test.js`, `tests/whats-new.test.js` |
| `activityLevel` | 0 | `tests/analytics.test.js` |
| `adaptiveSession` | 5 | `tests/adaptive-session.test.js` |
| `adaptiveTargetRank` | 0 | `tests/filters.test.js` |
| `adaptiveWeight` | 0 | `tests/filters.test.js` |
| `agentEditReview` | 9 | `tests/agent-edit-review.test.js` |
| `agentNote` | 2 | `tests/agent-view.test.js` |
| `agentRetrieval` | 14 | `tests/agent-retrieval.test.js` |
| `agentView` | 5 | `tests/agent-view.test.js`, `tests/chat-branches.test.js`, `tests/chat-pdf.test.js`, `tests/chat-plan.test.js`, `tests/chat-tabs-queue.test.js`, `tests/memory-export.test.js`, `tests/projects-cost.test.js`, `tests/quick-chat-bookmarks.test.js` |
| `agentWriteGuard` | 3 | `tests/agent-write-guard.test.js` |
| `aiConnection` | 18 | `tests/ai-beginner-wizard.test.js` |
| `aiContext` | 5 | `tests/ai-context.test.js`, `tests/knowledge-record-scenario.test.js` |
| `aiReady` | 0 | `tests/empty-state.test.js` |
| `aiService` | 27 | `tests/ai-service.test.js`, `tests/frq-handwriting.test.js` |
| `aiToolReviewModal` | 1 | `tests/chat-plan.test.js` |
| `aiTools` | 7 | `tests/ai-tools.test.js` |
| `aiWriteGuard` | 7 | `tests/ai-write-guard.test.js` |
| `aiWrites` | 7 | `tests/ai-writes.test.js` |
| `analytics` | 18 | `tests/feature-surfaces.test.js`, `tests/p1-knowledge.test.js` |
| `analyticsEmbed` | 11 | `tests/feature-surfaces.test.js` |
| `ankiConnect` | 21 | `tests/anki-connect.test.js`, `tests/anki-folder-exclusions.test.js` |
| `answerFromSection` | 0 | `tests/grading.test.js`, `tests/math-rendering.test.js` |
| `answerSetFromSection` | 0 | `tests/question-types.test.js` |
| `answerTrueFalseFromSection` | 0 | `tests/question-types.test.js` |
| `answerTypes` | 9 | `tests/question-types.test.js` |
| `answerVerification` | 10 | `tests/answer-verification.test.js`, `tests/computed-verification.test.js` |
| `apExamHistory` | 12 | `tests/ap-exam-history.test.js` |
| `apExamResources` | 8 | `tests/ap-exam-resources.test.js` |
| `apResourceNotes` | 19 | `tests/ap-resource-notes.test.js` |
| `apResources` | 7 | `tests/ap-resource-notes.test.js` |
| `apScore` | 10 | `tests/ap-exam-history.test.js`, `tests/ap-score.test.js`, `tests/frq.test.js` |
| `apiTurns` | 0 | `tests/feature-surfaces.test.js` |
| `apkg` | 7 | `tests/apkg.test.js`, `tests/security-hardening.test.js` |
| `apkgExport` | 6 | `tests/apkg.test.js` |
| `applyAttempt` | 0 | `tests/card-cram.test.js`, `tests/card-learning.test.js`, `tests/cards.test.js`, `tests/exam-schedule.test.js`, `tests/fsrs-fit.test.js`, `tests/fsrs.test.js`, `tests/grading.test.js`, `tests/history.test.js`, `tests/leech.test.js`, `tests/needs-fixing.test.js`, `tests/note-review-dock.test.js`, `tests/p1-knowledge.test.js`, `tests/parameterized.test.js`, `tests/scheduler-fit.test.js`, `tests/sm2.test.js` |
| `applySkip` | 0 | `tests/adaptive-parity.test.js`, `tests/history.test.js` |
| `assertExtractedTree` | 0 | `tests/security-hardening.test.js` |
| `assignments` | 48 | `tests/assignments.test.js`, `tests/core-values.test.js` |
| `audioBookmarks` | 10 | `tests/study-modules-2.test.js` |
| `audioTrace` | 5 | `tests/reference-advanced.test.js` |
| `autoAnki` | 7 | `tests/auto-anki.test.js`, `tests/text2anki-openai.test.js` |
| `bandQuestions` | 0 | `tests/progress.test.js` |
| `buildCalibration` | 0 | `tests/analytics-embed.test.js`, `tests/analytics.test.js` |
| `buildCourses` | 0 | `tests/progress.test.js` |
| `buildDashboard` | 0 | `tests/analytics-embed.test.js`, `tests/analytics.test.js` |
| `buildDueQueue` | 0 | `tests/study-status.test.js` |
| `buildGeneralContext` | 0 | `tests/ai-context.test.js`, `tests/tutor-presets.test.js` |
| `buildGradeSnapshot` | 0 | `tests/feature-surfaces.test.js` |
| `buildHeatmap` | 0 | `tests/analytics.test.js` |
| `buildMastery` | 0 | `tests/analytics-embed.test.js`, `tests/progress.test.js` |
| `buildMasteryTrend` | 0 | `tests/progress.test.js` |
| `buildMixedQueue` | 0 | `tests/due-queue.test.js`, `tests/mixed-review.test.js` |
| `buildMomentum` | 0 | `tests/progress.test.js` |
| `buildProgress` | 0 | `tests/progress.test.js` |
| `buildQuickQueue` | 0 | `tests/feature-surfaces.test.js` |
| `buildReportMarkdown` | 0 | `tests/import.test.js` |
| `buildRetention` | 0 | `tests/analytics.test.js` |
| `buildTestSet` | 0 | `tests/stats.test.js` |
| `buildTutorContext` | 0 | `tests/tutor-presets.test.js` |
| `buildWeeks` | 0 | `tests/progress.test.js` |
| `cacheIssues` | 0 | `tests/ai-beginner-wizard.test.js`, `tests/empty-state.test.js` |
| `calculator` | 10 | `tests/calculator.test.js` |
| `calculus` | 5 | `tests/reference-tools.test.js` |
| `calendarIcs` | 19 | `tests/calendar.test.js`, `tests/term-calendar.test.js` |
| `calendarInterop` | 3 | `tests/calendar-interop.test.js` |
| `calendarModel` | 52 | `tests/calendar.test.js`, `tests/core-values.test.js`, `tests/exam-schedule.test.js`, `tests/term-calendar.test.js` |
| `calendarNotes` | 8 | `tests/calendar.test.js` |
| `calendarPlanner` | 10 | `tests/calendar-planner.test.js` |
| `candidateAssetNames` | 0 | `tests/feature-surfaces.test.js` |
| `cardArchive` | 8 | `tests/card-archive.test.js` |
| `cardGenerator` | 11 | `tests/card-generator.test.js`, `tests/spaced-quiz.test.js` |
| `cardGradeQueue` | 9 | `tests/card-grading-ai.test.js` |
| `cardGraderAccuracy` | 1 | `tests/card-grader-accuracy.test.js` |
| `cardGrading` | 11 | `tests/card-grading-ai.test.js`, `tests/card-grading.test.js` |
| `cardGradingAi` | 7 | `tests/card-grading-ai.test.js` |
| `cardPreview` | 0 | `tests/couchdb-sync.test.js` |
| `cardWriteDiff` | 2 | `tests/card-write-diff.test.js` |
| `cards` | 46 | `tests/card-cram.test.js`, `tests/card-learning.test.js`, `tests/card-mother-cram.test.js`, `tests/card-reveal.test.js`, `tests/card-scheduler-explorer.test.js`, `tests/card-speech.test.js`, `tests/cards-extract.test.js`, `tests/cards-import.test.js`, `tests/cards.test.js`, `tests/flashcard-generate.test.js`, `tests/fsrs-fit.test.js`, `tests/mobile-module-layout.test.js`, `tests/plain-cards.test.js`, `tests/quizlet-pdf-fixtures.test.js`, `tests/sm2.test.js`, `tests/source-recall.test.js`, `tests/spaced-quiz.test.js`, `tests/study-status.test.js` |
| `cardsExtract` | 13 | `tests/cards-extract.test.js`, `tests/flashcard-generate.test.js` |
| `cardsImport` | 39 | `tests/cards-import.test.js`, `tests/quizlet-pdf-fixtures.test.js`, `tests/spaced-quiz.test.js` |
| `cbtExam` | 7 | `tests/cbt-exam.test.js` |
| `chatBookmarks` | 17 | `tests/quick-chat-bookmarks.test.js` |
| `chatBranches` | 11 | `tests/chat-branches.test.js` |
| `chatBudget` | 6 | `tests/chat-budget.test.js`, `tests/chat-compact.test.js`, `tests/chat-panel-mentions.test.js`, `tests/diagnostics-gauge.test.js`, `tests/quick-chat-bookmarks.test.js` |
| `chatCompact` | 9 | `tests/chat-compact.test.js` |
| `chatExport` | 3 | `tests/memory-export.test.js` |
| `chatHistory` | 5 | `tests/chat-history.test.js` |
| `chatMemory` | 12 | `tests/memory-export.test.js` |
| `chatMentions` | 17 | `tests/chat-mentions.test.js` |
| `chatModels` | 13 | `tests/chat-models.test.js` |
| `chatPdf` | 20 | `tests/chat-pdf.test.js` |
| `chatPdfModal` | 1 | `tests/chat-pdf.test.js` |
| `chatPlan` | 27 | `tests/chat-plan.test.js` |
| `chatPricing` | 8 | `tests/projects-cost.test.js`, `tests/skills-pricing.test.js` |
| `chatProjects` | 14 | `tests/projects-cost.test.js` |
| `chatSessions` | 13 | `tests/chat-pdf.test.js`, `tests/chat-sessions.test.js` |
| `chatSkills` | 9 | `tests/skills-pricing.test.js` |
| `chatStream` | 5 | `tests/chat-stream.test.js` |
| `chooseRelease` | 0 | `tests/opencode-compat.test.js` |
| `citations` | 11 | `tests/citations.test.js` |
| `cloneFilters` | 0 | `tests/uncited-groups.test.js` |
| `complex` | 27 | `tests/complex.test.js`, `tests/graph-complex.test.js` |
| `computeStats` | 0 | `tests/p1-knowledge.test.js`, `tests/skip-insights.test.js`, `tests/stats.test.js` |
| `computedVerification` | 5 | `tests/computed-verification.test.js` |
| `conceptMastery` | 4 | `tests/concept-mastery.test.js`, `tests/p1-knowledge.test.js` |
| `contextRetrieval` | 7 | `tests/context-retrieval.test.js` |
| `cornell` | 5 | `tests/cornell-margins.test.js`, `tests/study-tools.test.js` |
| `couchdbSync` | 15 | `tests/couchdb-sync.test.js` |
| `courseHealth` | 5 | `tests/core-values.test.js`, `tests/study-modules-2.test.js`, `tests/study-workspace-health.test.js` |
| `courseNotes` | 11 | `tests/course-notes.test.js` |
| `courseTemplates` | 12 | `tests/course-templates.test.js` |
| `cram` | 9 | `tests/card-cram.test.js`, `tests/card-mother-cram.test.js` |
| `createQuickSession` | 0 | `tests/feature-surfaces.test.js` |
| `dailyQuiz` | 14 | `tests/daily-quiz-freeze.test.js`, `tests/daily-quiz.test.js` |
| `diagnostics` | 8 | `tests/diagnostics-gauge.test.js` |
| `distractorQuality` | 5 | `tests/distractor-quality.test.js` |
| `documentCards` | 7 | `tests/document-cards.test.js`, `tests/import-routes-audit.test.js` |
| `documentClassify` | 5 | `tests/document-classify.test.js` |
| `documents` | 18 | `tests/documents.test.js`, `tests/import-source.test.js` |
| `downloadFile` | 0 | — |
| `durability` | 9 | `tests/durability.test.js` |
| `emptyState` | 0 | `tests/empty-state.test.js` |
| `epub` | 8 | `tests/epub.test.js` |
| `epubAnnotations` | 17 | `tests/epub.test.js` |
| `errorLog` | 0 | `tests/stats.test.js` |
| `examBlock` | 2 | `tests/exam-block.test.js` |
| `extractArchive` | 0 | — |
| `extractRationale` | 0 | `tests/math-rendering.test.js` |
| `feynmanAi` | 8 | `tests/study-modules-3.test.js` |
| `figures` | 3 | `tests/figures.test.js` |
| `fileExplorer` | 4 | `tests/card-scheduler-explorer.test.js` |
| `fillDefaults` | 0 | `tests/feature-surfaces.test.js` |
| `filterOptionCounts` | 0 | `tests/filters.test.js` |
| `filterOptions` | 0 | `tests/filters.test.js` |
| `finalizeNote` | 0 | `tests/computed-verification.test.js`, `tests/import.test.js` |
| `findAnswerKey` | 0 | `tests/question-types.test.js` |
| `findBinaryIn` | 0 | — |
| `findDuplicateIds` | 0 | `tests/import.test.js` |
| `fmtDate` | 0 | `tests/card-cram.test.js`, `tests/cards.test.js`, `tests/practice-sheet.test.js`, `tests/results-export.test.js`, `tests/uncited-groups.test.js` |
| `fmtDateTime` | 0 | `tests/uncited-groups.test.js` |
| `fmtPct` | 0 | `tests/stats.test.js` |
| `focus` | 15 | `tests/focus.test.js`, `tests/tag-timer.test.js` |
| `folderChain` | 0 | `tests/filters.test.js` |
| `folderLabel` | 0 | `tests/filters.test.js` |
| `friendlyApiError` | 0 | `tests/feature-surfaces.test.js` |
| `friendlyError` | 0 | `tests/feature-surfaces.test.js` |
| `frq` | 40 | `tests/frq-handwriting.test.js`, `tests/frq-import.test.js`, `tests/frq-review.test.js`, `tests/frq.test.js`, `tests/p1-knowledge.test.js` |
| `frqImport` | 4 | `tests/frq-import.test.js` |
| `fsrs` | 14 | `tests/analytics.test.js`, `tests/cards.test.js`, `tests/feature-engines.test.js`, `tests/fsrs-fit.test.js`, `tests/fsrs.test.js`, `tests/progress.test.js` |
| `fsrsFit` | 6 | `tests/fsrs-fit.test.js` |
| `fsrsTrain` | 11 | `tests/feature-engines.test.js` |
| `geometry` | 35 | `tests/feature-surfaces.test.js`, `tests/geometry.test.js` |
| `geometryPanel` | 9 | `tests/feature-surfaces.test.js` |
| `glossary` | 10 | `tests/glossary.test.js` |
| `gradeAnswer` | 0 | `tests/grading.test.js`, `tests/matching.test.js`, `tests/numeric-grading.test.js`, `tests/question-types.test.js` |
| `gradeAnswerDetailed` | 0 | `tests/numeric-grading.test.js`, `tests/question-types.test.js` |
| `gradeLetter` | 0 | `tests/analytics.test.js` |
| `graph3d` | 23 | `tests/feature-surfaces.test.js`, `tests/graph-3d.test.js`, `tests/reference-advanced.test.js` |
| `graph3dExport` | 3 | `tests/reference-advanced.test.js` |
| `graph3dPanel` | 19 | `tests/feature-surfaces.test.js` |
| `graphAccessibility` | 5 | `tests/reference-tools.test.js` |
| `graphComplex` | 4 | `tests/graph-complex.test.js` |
| `graphExamples` | 3 | `tests/reference-tools.test.js` |
| `graphExport` | 7 | `tests/reference-tools.test.js` |
| `graphFolders` | 7 | `tests/reference-tools.test.js` |
| `graphHistory` | 13 | `tests/reference-tools.test.js` |
| `graphImage` | 6 | `tests/reference-tools.test.js` |
| `graphPaper` | 6 | `tests/reference-tools.test.js` |
| `graphPrint` | 6 | `tests/reference-tools.test.js` |
| `graphSummation` | 8 | `tests/reference-tools.test.js` |
| `graphTable` | 16 | `tests/reference-tools.test.js` |
| `groupIssues` | 0 | `tests/import.test.js` |
| `handwriting` | 7 | `tests/frq-handwriting.test.js` |
| `hasFilters` | 0 | `tests/uncited-groups.test.js` |
| `hasValidQuestion` | 0 | `tests/empty-state.test.js` |
| `history` | 23 | `tests/history.test.js`, `tests/needs-fixing.test.js` |
| `importAiState` | 0 | `tests/ai-import-help.test.js` |
| `indexOfficialIds` | 0 | `tests/import.test.js` |
| `inferMode` | 0 | `tests/matching.test.js`, `tests/math-rendering.test.js`, `tests/question-types.test.js` |
| `intervalPreview` | 4 | `tests/interval-preview.test.js` |
| `isDue` | 0 | `tests/card-cram.test.js`, `tests/study-status.test.js` |
| `isExamReady` | 0 | `tests/exam-ready.test.js` |
| `knowledgeRecord` | 32 | `tests/knowledge-record-scenario.test.js`, `tests/knowledge-record.test.js`, `tests/knowledge-store.test.js`, `tests/knowledge-view.test.js` |
| `knowledgeStore` | 4 | `tests/knowledge-record-scenario.test.js`, `tests/knowledge-store.test.js` |
| `learnkit` | 6 | `tests/learnkit.test.js` |
| `lectureCompiler` | 6 | `tests/study-modules-2.test.js` |
| `loadQuestionData` | 0 | `tests/parameterized.test.js`, `tests/study-modes.test.js`, `tests/study-skin.test.js` |
| `localEvents` | 18 | `tests/local-events.test.js` |
| `localModels` | 5 | `tests/local-models.test.js` |
| `makeKeyboardClickable` | 0 | `tests/ui-view-accessibility.test.js` |
| `masteryBandOf` | 0 | `tests/progress.test.js` |
| `masteryPicker` | 15 | `tests/mastery-picker.test.js` |
| `masteryScopes` | 0 | `tests/progress.test.js` |
| `masteryTrendText` | 0 | `tests/feature-surfaces.test.js` |
| `masteryWindowDays` | 0 | `tests/analytics-embed.test.js`, `tests/progress.test.js` |
| `matchFilters` | 0 | `tests/uncited-groups.test.js` |
| `matchSets` | 0 | `tests/filters.test.js` |
| `matching` | 6 | `tests/matching.test.js` |
| `mathRendering` | 9 | `tests/math-rendering.test.js` |
| `matrix` | 22 | `tests/matrix.test.js` |
| `memoryOf` | 0 | `tests/progress.test.js` |
| `mergeAuth` | 0 | `tests/feature-surfaces.test.js` |
| `mindmap` | 11 | `tests/feature-engines.test.js`, `tests/mindmap-edit.test.js` |
| `mixedQuestionAttempt` | 0 | `tests/mixed-review.test.js` |
| `mochiExport` | 5 | `tests/mochi-export.test.js` |
| `modelDiscovery` | 4 | `tests/model-discovery.test.js` |
| `modelFromString` | 0 | `tests/feature-surfaces.test.js` |
| `normalizeDailyCap` | 0 | `tests/due-queue.test.js` |
| `normalizeExamReadyPasses` | 0 | `tests/uncited-groups.test.js` |
| `noteContext` | 7 | `tests/note-context.test.js` |
| `noteIssues` | 0 | `tests/empty-state.test.js`, `tests/import.test.js` |
| `noteReview` | 14 | `tests/note-review-dock.test.js`, `tests/note-review.test.js` |
| `noteReviewDock` | 13 | `tests/note-review-dock.test.js` |
| `numericGrading` | 19 | `tests/numeric-grading.test.js` |
| `ocr` | 5 | `tests/ocr.test.js` |
| `officialIdOf` | 0 | `tests/import.test.js` |
| `offline` | 10 | `tests/offline.test.js` |
| `opencodeMajor` | 0 | `tests/opencode-compat.test.js` |
| `osNotifications` | 7 | `tests/os-notifications.test.js` |
| `overallStats` | 0 | `tests/p1-knowledge.test.js`, `tests/skip-insights.test.js`, `tests/stats.test.js` |
| `packQuickSession` | 0 | `tests/uncited-groups.test.js` |
| `packTestSession` | 0 | `tests/parameterized.test.js`, `tests/stats.test.js` |
| `paperScanner` | 10 | `tests/paper-scanner.test.js` |
| `parameterized` | 14 | `tests/parameterized.test.js` |
| `parseDashboardBlock` | 0 | `tests/analytics-embed.test.js` |
| `parseHistory` | 0 | `tests/p1-knowledge.test.js`, `tests/stats.test.js` |
| `parseNote` | 0 | `tests/adaptive-parity.test.js`, `tests/ai-beginner-wizard.test.js`, `tests/empty-state.test.js`, `tests/hints.test.js`, `tests/import-existing-folder.test.js`, `tests/import.test.js`, `tests/note-quiz-clipboard.test.js`, `tests/quick-add.test.js`, `tests/transcript.test.js` |
| `parseScheduleBlock` | 0 | `tests/calendar.test.js` |
| `parseSections` | 0 | `tests/grading.test.js`, `tests/hints.test.js`, `tests/matching.test.js`, `tests/math-rendering.test.js`, `tests/needs-fixing.test.js`, `tests/question-types.test.js`, `tests/views.test.js` |
| `partsToTurns` | 0 | `tests/chat-panel-copilot.test.js`, `tests/feature-surfaces.test.js` |
| `pauseQuickSession` | 0 | `tests/uncited-groups.test.js` |
| `pdf` | 17 | `tests/cards-import.test.js`, `tests/feature-engines.test.js`, `tests/pdf-annotations.test.js`, `tests/pdf-annotator-sidebar.test.js`, `tests/pdf-annotator.test.js`, `tests/pdf-backlinks.test.js`, `tests/pdf-deep-link.test.js`, `tests/pdf-editor-window.test.js`, `tests/pdf-ink.test.js`, `tests/pdf-latex.test.js`, `tests/pdf-plus-boot.test.js`, `tests/pdf-plus.test.js`, `tests/pdf-reader-page-ops.test.js`, `tests/settings-navigation.test.js`, `tests/study-modules-3.test.js` |
| `pdfAnnotationIndex` | 7 | `tests/study-modules-3.test.js` |
| `pdfAnnotations` | 22 | `tests/pdf-annotations.test.js`, `tests/pdf-annotator-sidebar.test.js`, `tests/pdf-annotator.test.js`, `tests/pdf-deep-link.test.js`, `tests/pdf-ink.test.js`, `tests/pdf-reader-page-ops.test.js`, `tests/study-modules-3.test.js` |
| `pdfAnnotatorSidebar` | 8 | `tests/pdf-annotator-sidebar.test.js` |
| `pdfBacklinks` | 11 | `tests/pdf-backlinks.test.js` |
| `pdfDeepLink` | 8 | `tests/feature-engines.test.js`, `tests/pdf-backlinks.test.js`, `tests/pdf-deep-link.test.js` |
| `pdfEditor` | 56 | `tests/pdf-editor-window.test.js`, `tests/pdf-plus-boot.test.js`, `tests/pdf-reader-page-ops.test.js` |
| `pdfEditorModal` | 3 | `tests/pdf-editor-window.test.js`, `tests/pdf-plus-boot.test.js` |
| `pdfInk` | 26 | `tests/pdf-annotations.test.js`, `tests/pdf-annotator-sidebar.test.js`, `tests/pdf-annotator.test.js`, `tests/pdf-backlinks.test.js`, `tests/pdf-editor-window.test.js`, `tests/pdf-ink.test.js`, `tests/pdf-plus-boot.test.js`, `tests/pdf-reader-page-ops.test.js` |
| `pdfInkModal` | 2 | `tests/pdf-annotator-sidebar.test.js`, `tests/pdf-editor-window.test.js`, `tests/pdf-plus-boot.test.js`, `tests/pdf-reader-page-ops.test.js` |
| `pdfLatex` | 6 | `tests/feature-engines.test.js`, `tests/pdf-latex.test.js` |
| `pdfPlus` | 8 | `tests/pdf-plus-boot.test.js`, `tests/pdf-plus.test.js`, `tests/settings-navigation.test.js` |
| `pdfPlusSettings` | 2 | `tests/settings-navigation.test.js` |
| `pickQuestion` | 0 | `tests/mastery-picker.test.js`, `tests/study-status.test.js` |
| `plainCards` | 6 | `tests/plain-cards.test.js` |
| `platformTriple` | 0 | `tests/feature-surfaces.test.js` |
| `pomodoro` | 16 | `tests/pomodoro.test.js` |
| `practiceFullscreen` | 6 | `tests/practice-fullscreen.test.js` |
| `practiceKeys` | 1 | `tests/practice-keys.test.js` |
| `practiceTools` | 33 | `tests/practice-chrome.test.js`, `tests/practice-tools.test.js` |
| `progress` | 18 | `tests/p1-knowledge.test.js` |
| `provenance` | 10 | `tests/import.test.js`, `tests/source-recall.test.js` |
| `qtiArchive` | 1 | `tests/cards-import.test.js` |
| `quickAdd` | 7 | `tests/hints.test.js`, `tests/note-quiz-clipboard.test.js`, `tests/quick-add.test.js` |
| `quickAsk` | 8 | `tests/quick-ask.test.js` |
| `quickPractice` | 10 | `tests/quick-practice-uri.test.js` |
| `quickRemainingSeconds` | 0 | `tests/uncited-groups.test.js` |
| `quizBlock` | 18 | `tests/numeric-quiz.test.js`, `tests/quiz-bind.test.js`, `tests/quiz-block.test.js`, `tests/quiz-note-gate.test.js`, `tests/quiz-results.test.js`, `tests/reorder.test.js`, `tests/shared-choice.test.js` |
| `quizClipboard` | 2 | `tests/note-quiz-clipboard.test.js` |
| `quizDedup` | 2 | `tests/quiz-dedup.test.js` |
| `quizGenerator` | 13 | `tests/quiz-generator.test.js` |
| `quizMaker` | 8 | `tests/quiz-maker.test.js` |
| `quizNoteGate` | 2 | `tests/quiz-note-gate.test.js` |
| `quizport` | 7 | `tests/quizport.test.js` |
| `readAloud` | 12 | `tests/read-aloud.test.js`, `tests/settings-consolidation.test.js`, `tests/study-modules-2.test.js` |
| `reading` | 14 | `tests/core-values.test.js`, `tests/reading-companion.test.js`, `tests/reading-library.test.js`, `tests/reading-plan.test.js` |
| `readingCompanion` | 9 | `tests/reading-companion.test.js` |
| `readingLibrary` | 16 | `tests/reading-library.test.js` |
| `recentFiles` | 6 | `tests/recent-files.test.js` |
| `recentFilesView` | 1 | `tests/recent-files.test.js` |
| `referenceData` | 13 | `tests/graph-3d.test.js`, `tests/reference-advanced.test.js`, `tests/reference.test.js` |
| `referenceElements` | 5 | `tests/reference-tools.test.js` |
| `referenceGraph` | 41 | `tests/reference-tools.test.js` |
| `referenceSheets` | 9 | `tests/reference-sheets.test.js` |
| `reminder` | 6 | `tests/os-notifications.test.js`, `tests/reminder.test.js` |
| `renameFolderInSettings` | 0 | `tests/filters.test.js` |
| `renameFolderPath` | 0 | `tests/filters.test.js` |
| `renderAiConnectionForm` | 0 | `tests/ai-beginner-wizard.test.js` |
| `renderAssignmentsSettings` | 0 | `tests/feature-surfaces.test.js` |
| `renderDailySettings` | 0 | `tests/feature-surfaces.test.js` |
| `renderDashboardEmbed` | 0 | `tests/analytics-embed.test.js` |
| `renderMarkdownInto` | 0 | `tests/math-rendering.test.js`, `tests/stem-diagrams.test.js` |
| `renderReferenceSettings` | 0 | `tests/feature-surfaces.test.js` |
| `renderSettingsTabs` | 0 | `tests/calendar.test.js` |
| `replaceMyNotes` | 0 | `tests/feature-surfaces.test.js` |
| `resultsExport` | 12 | `tests/practice-sheet.test.js`, `tests/results-export.test.js` |
| `resumeQuickSession` | 0 | `tests/uncited-groups.test.js` |
| `reviewCalendar` | 15 | `tests/review-calendar.test.js` |
| `reviewSession` | 10 | `tests/review-session.test.js` |
| `satMath` | 11 | `tests/sat-math.test.js` |
| `scanQuestionNotes` | 0 | `tests/empty-state.test.js` |
| `schedulerFit` | 8 | `tests/scheduler-fit.test.js` |
| `scopeQuestions` | 0 | `tests/progress.test.js` |
| `secretKeys` | 13 | `tests/secret-keys.test.js`, `tests/security-hardening.test.js` |
| `serviceImport` | 22 | `tests/service-import.test.js` |
| `sessionReport` | 5 | `tests/session-report.test.js` |
| `setLastErrorType` | 0 | `tests/grading.test.js` |
| `settingsCategories` | 9 | `tests/settings-navigation.test.js`, `tests/settings-simple-mode.test.js` |
| `settingsGlobal` | 8 | `tests/settings-consolidation.test.js`, `tests/settings-simple-mode.test.js` |
| `sfcCards` | 11 | `tests/sfc-cards.test.js` |
| `simpleFlashcards` | 2 | `tests/simple-flashcards.test.js` |
| `simpleNoteQuiz` | 15 | `tests/simple-note-quiz.test.js` |
| `simpleQuiz` | 15 | `tests/simple-quiz.test.js` |
| `sliceQuestionRange` | 0 | `tests/views.test.js` |
| `sm2` | 12 | `tests/sm2.test.js` |
| `smiles` | 2 | `tests/smiles.test.js` |
| `snapshotCache` | 1 | `tests/snapshot-cache.test.js` |
| `sourceRecall` | 8 | `tests/source-recall.test.js` |
| `spacedEverything` | 15 | `tests/spaced-everything.test.js` |
| `spacedQuiz` | 6 | `tests/spaced-quiz.test.js` |
| `statVals` | 0 | `tests/uncited-groups.test.js` |
| `statistics` | 8 | `tests/reference-tools.test.js` |
| `stemDiagrams` | 6 | `tests/security-inventory.test.js`, `tests/stem-diagrams.test.js` |
| `studyBlocks` | 14 | `tests/study-blocks.test.js` |
| `studyBundle` | 7 | `tests/study-bundle-import.test.js`, `tests/study-bundle.test.js` |
| `studyBundleImport` | 4 | `tests/study-bundle-import.test.js` |
| `studyCommands` | 12 | `tests/quick-ask.test.js` |
| `studyCounters` | 13 | `tests/study-counters.test.js`, `tests/study-stats.test.js` |
| `studyMap` | 6 | `tests/study-map.test.js` |
| `studyNudge` | 7 | `tests/settings-consolidation.test.js`, `tests/study-nudge.test.js` |
| `studyPlan` | 10 | `tests/core-values.test.js`, `tests/study-plan.test.js` |
| `studySkin` | 18 | `tests/study-modes.test.js`, `tests/study-skin.test.js` |
| `studyStats` | 18 | `tests/study-stats.test.js` |
| `studyStatus` | 18 | `tests/study-status.test.js` |
| `studyToolSettings` | 4 | `tests/calendar.test.js`, `tests/modules.test.js`, `tests/reading-library.test.js`, `tests/settings-consolidation.test.js`, `tests/settings-navigation.test.js`, `tests/study-tool-settings.test.js`, `tests/table-editor.test.js` |
| `studyTools` | 19 | `tests/core-values.test.js`, `tests/study-modules-2.test.js`, `tests/study-tools.test.js` |
| `studyWorkspace` | 79 | `tests/core-values.test.js`, `tests/quiz-attempts.test.js`, `tests/settings-consolidation.test.js`, `tests/study-workspace-health.test.js`, `tests/study-workspace.test.js`, `tests/subject-projects.test.js`, `tests/vocab-stats.test.js` |
| `suggestMinutes` | 0 | `tests/stats.test.js` |
| `support` | 8 | `tests/support.test.js` |
| `survey` | 4 | `tests/survey.test.js` |
| `svgSafety` | 1 | `tests/security-hardening.test.js`, `tests/security-inventory.test.js` |
| `tableControls` | 2 | `tests/table-commands.test.js` |
| `tableCsvModal` | 1 | `tests/table-commands.test.js` |
| `tableEditor` | 59 | `tests/advanced-tables-executable-parity.test.js`, `tests/advanced-tables-upstream.test.js`, `tests/table-commands.test.js`, `tests/table-editor.test.js` |
| `tagTimer` | 26 | `tests/tag-timer.test.js` |
| `tally` | 15 | `tests/tally.test.js` |
| `taskTags` | 5 | `tests/task-tags.test.js` |
| `testSections` | 6 | `tests/test-sections.test.js` |
| `text2anki` | 7 | `tests/text2anki-openai.test.js` |
| `textTimer` | 12 | `tests/text-timer.test.js` |
| `thinkFirst` | 6 | `tests/think-first.test.js` |
| `timeBlocks` | 102 | `tests/time-blocks-kairos.test.js`, `tests/time-blocks-parity.test.js`, `tests/time-blocks.test.js` |
| `transcript` | 10 | `tests/adaptive-parity.test.js`, `tests/ai-write-guard.test.js`, `tests/transcript.test.js` |
| `trendBy` | 0 | `tests/stats.test.js` |
| `trendDelta` | 0 | `tests/stats.test.js` |
| `tutorPresets` | 7 | `tests/plugin.test.js`, `tests/tutor-presets.test.js` |
| `unpackQuickSession` | 0 | `tests/uncited-groups.test.js` |
| `unpackTestSession` | 0 | `tests/parameterized.test.js`, `tests/stats.test.js` |
| `urlSafety` | 5 | `tests/security-hardening.test.js`, `tests/security-inventory.test.js` |
| `vaultSearch` | 8 | `tests/vault-search.test.js` |
| `vaultTaskIndex` | 9 | `tests/vault-task-index.test.js` |
| `vectorField` | 14 | `tests/reference-advanced.test.js` |
| `vectorPanel` | 7 | `tests/feature-surfaces.test.js` |
| `voiceMemo` | 12 | `tests/voice-memo.test.js` |
| `weakSpot` | 4 | `tests/weak-spot.test.js` |
| `weakestRow` | 0 | `tests/stats.test.js` |
| `weekStart` | 0 | `tests/stats.test.js` |
| `weeklyAccuracy` | 0 | `tests/stats.test.js` |
| `weightOf` | 0 | `tests/uncited-groups.test.js` |
| `welcome` | 16 | `tests/welcome.test.js`, `tests/whats-new.test.js` |
| `whatsNew` | 10 | `tests/feature-surfaces.test.js`, `tests/whats-new.test.js` |
| `wordnet` | 18 | `tests/wordnet.test.js` |
| `writingSessions` | 11 | `tests/writing-sessions.test.js` |
| `zipWrite` | 2 | `tests/epub.test.js`, `tests/study-bundle-import.test.js` |

## Commands

| Command id | Name | Callback | Test |
| --- | --- | --- | --- |
| `open-practice-view` | Open practice view | `activateView` | `tests/calendar.test.js`, `tests/cards-extract.test.js`, `tests/daily-quiz.test.js`, `tests/modules.test.js`, `tests/plugin.test.js`, `tests/quick-practice-uri.test.js`, `tests/today.test.js`, `tests/views.test.js` |
| `open-welcome` | Open welcome guide | `openWelcome` | `tests/welcome.test.js` |
| `open-welcome-note` | Open Start here note | `openWelcomeNote` | `tests/welcome.test.js` |
| `open-whats-new` | Show what's new | `openWhatsNew` | `tests/whats-new.test.js` |
| `focus-start` | Focus: start a 25-minute session | `startFocusSession` | `tests/focus.test.js` |
| `tag-timer-stop-all` | Tag Timer: stop all running timers | `stopAllTagTimers` | `tests/tag-timer.test.js` |
| `focus-log` | Focus: log study time | `openFocusLog` | `tests/focus.test.js`, `tests/ui-layout.test.js` |
| `study-plan` | Study plan: start for the next exam | `startNextExamPlan` | `tests/core-values.test.js` |
| `open-dashboard` | Open analytics dashboard | `activateInsights` | `tests/modules.test.js`, `tests/views.test.js` |
| `open-progress` | Open progress dashboard | `activateInsights` | `tests/modules.test.js`, `tests/views.test.js` |
| `export-results-csv` | Export practice results to CSV | `exportResultsCsv` | `tests/results-export.test.js` |
| `export-practice-sheet` | Export an answer-free practice sheet | `exportPracticeSheet` | `tests/practice-sheet.test.js` |
| `export-review-sheet` | Export an error-log review sheet | `exportReviewSheet` | `tests/practice-sheet.test.js`, `tests/views.test.js` |
| `import-pdf` | Import questions from a file (PDF, PowerPoint, Word) | `openPdfImport` | `tests/ai-beginner-wizard.test.js`, `tests/ai-import-help.test.js`, `tests/empty-state.test.js`, `tests/modules.test.js`, `tests/plugin.test.js` |
| `import-service-export` | Import notes from an export (Airtable, Notion, Evernote, Keep, Bear, Roam) | `importActiveServiceExport` | `tests/service-import.test.js` |
| `import-service-clipboard` | Import notes from a pasted export | `importServiceClipboard` | `tests/service-import.test.js` |
| `quick-add` | Quick add questions from pasted text | `openQuickAdd` | `tests/ai-import-help.test.js`, `tests/note-quiz-clipboard.test.js`, `tests/plugin.test.js`, `tests/quick-add.test.js`, `tests/quiz-generator.test.js` |
| `import-quiz-clipboard` | Import a generated quiz from the clipboard | `openQuizClipboardImport` | `tests/note-quiz-clipboard.test.js` |
| `export-study-bundle` | Export a study bundle (backup of questions and cards) | `exportStudyBundle` | `tests/study-bundle-import.test.js`, `tests/study-bundle.test.js` |
| `import-study-bundle` | Import a study bundle (restore questions and cards) | `importStudyBundle` | `tests/study-bundle-import.test.js` |
| `ai-undo-last-write` | AI: undo the last generated notes | `undoLastAiWriteCommand` | `tests/command-effects.test.js` |
| `ai-undo-agent-edits` | AI: undo the last agent edits | `undoLastAgentEditCommand` | `tests/command-effects.test.js` |
| `course-notes-import` | Import course notes from a lecture or chapter | `openCourseNotesImport` | `tests/command-effects.test.js` |
| `paper-scanner` | Paper scanner: photos to PDF | `openPaperScanner` | `tests/plugin.test.js`, `tests/security-inventory.test.js` |
| `document-review` | Review a document for import | `openDocumentReview` | `tests/plugin.test.js` |
| `ocr-pdf` | OCR a scanned PDF | `openOcr` | `tests/plugin.test.js` |
| `pdf-annotate` | PDF: add an annotation | `openPdfAnnotation` | `tests/command-effects.test.js` |
| `pdf-draw` | PDF: draw with pen or highlighter | `openPdfInk` | `tests/pdf-annotator.test.js`, `tests/pdf-deep-link.test.js`, `tests/pdf-ink.test.js` |
| `pdf-latex` | PDF: convert pages to a LaTeX note | `convertActivePdfLatex` | `tests/pdf-latex.test.js` |
| `mindmap-add-child` | Mind map: add a child | `promptMindMap` | `tests/mindmap-edit.test.js` |
| `mindmap-rename` | Mind map: rename a node | `promptMindMap` | `tests/mindmap-edit.test.js` |
| `mindmap-remove` | Mind map: remove a node | `promptMindMap` | `tests/mindmap-edit.test.js` |
| `mindmap-move` | Mind map: move a node | `promptMindMap` | `tests/mindmap-edit.test.js` |
| `mindmap-from-note` | Mind map: make a Markmind map from this note | `mindMapFromNote` | `tests/mindmap-edit.test.js` |
| `pdf-open-link` | PDF: open a copied deep link | `openPdfDeepLink` | `tests/pdf-deep-link.test.js` |
| `epub-read` | EPUB: open the reader | `openActiveEpubReader` | `tests/epub.test.js` |
| `epub-annotations` | EPUB: open this book's annotations | `openEpubAnnotations` | `tests/epub.test.js` |
| `pdf-edit` | PDF: open the editor (pages and forms) | `openActivePdfEditor` | `tests/pdf-editor-history.test.js`, `tests/pdf-editor-record.test.js`, `tests/pdf-editor-window.test.js`, `tests/pdf-editor.test.js`, `tests/pdf-reader-page-ops.test.js`, `tests/security-inventory.test.js`, `tests/ui-layout.test.js` |
| `pdf-export-notes` | PDF: export annotations to Markdown | `exportActivePdfAnnotations` | `tests/pdf-annotator.test.js` |
| `pdf-open-annotations` | PDF: open annotations | `openPdfAnnotations` | `tests/command-effects.test.js` |
| `practice-folder` | Practice a folder... | `practiceFolder` | `tests/plugin.test.js` |
| `practice-current-folder` | Practice the folder of this note | `folderHasQuestions` | `tests/plugin.test.js` |
| `timed-test` | Start a timed test | `activateTest` | `tests/modules.test.js`, `tests/plugin.test.js`, `tests/views.test.js` |
| `open-today` | Open Today | `activateToday` | `tests/plugin.test.js` |
| `quick-practice` | Quick Practice | `activateQuickPractice` | `tests/today.test.js`, `tests/uncited-groups.test.js` |
| `daily-quiz` | Daily quiz | `startDailyQuiz` | `tests/daily-quiz.test.js` |
| `dismiss-reminder` | Dismiss today's study reminder | `dismissTodayReminder` | `tests/command-effects.test.js` |
| `study-skin` | Open study cards | `openStudySkin` | `tests/command-effects.test.js` |
| `retry-pending-attempts` | Retry saving offline practice results | `flushPendingAttempts` | `tests/offline.test.js` |
| `open-calendar` | Open calendar | `activateCalendar` | `tests/plugin.test.js` |
| `open-review-calendar` | Open review calendar | `activateReviewCalendar` | `tests/review-calendar.test.js` |
| `open-review-sidebar` | Open review sidebar | `activateReviewSidebar` | `tests/review-sidebar.test.js` |
| `review-next-note` | Next review note | `openAdjacentReviewNote` | `tests/review-sidebar.test.js` |
| `review-previous-note` | Previous review note | `openAdjacentReviewNote` | `tests/review-sidebar.test.js` |
| `review-current-note` | Review current note | `openNoteReviewForFile` | `tests/review-sidebar.test.js` |
| `review-add-current-note` | Add current note to review schedule | `addActiveNoteToReview` | `tests/mobile-calendar-agenda.test.js` |
| `review-add-current-folder` | Add current note's folder to review schedule | `addActiveFolderToReview` | `tests/mobile-calendar-agenda.test.js` |
| `review-calendar-add-note` | Review calendar: add this note to review | `addActiveNoteToReview` | `tests/mobile-calendar-agenda.test.js`, `tests/review-calendar.test.js` |
| `review-calendar-add-folder` | Review calendar: add this folder to review | `addActiveFolderToReview` | `tests/mobile-calendar-agenda.test.js`, `tests/review-calendar.test.js` |
| `open-study-stats` | Open study statistics | `activateStudyStats` | `tests/review-calendar.test.js` |
| `open-local-events` | Open local events | `activateLocalEvents` | `tests/review-calendar.test.js` |
| `new-local-event` | Local events: create an event | `openNewLocalEvent` | `tests/review-calendar.test.js` |
| `open-next-due-note` | Note review: open the next due note | `openNextDueNote` | `tests/review-calendar.test.js` |
| `note-review-dock-toggle` | Note review: show or hide the review bar | `toggleNoteReviewDock` | `tests/command-effects.test.js` |
| `save-review-session-report` | Note review: save a session report | `saveReviewSessionReport` | `tests/session-report.test.js` |
| `open-pomodoro` | Open Pomodoro timer | `activatePomodoro` | `tests/plugin.test.js` |
| `pomodoro-start-pause` | Pomodoro: start or pause | `togglePomodoro` | `tests/plugin.test.js` |
| `pomodoro-reset` | Pomodoro: reset the current cycle | `resetPomodoro` | `tests/plugin.test.js`, `tests/pomodoro.test.js` |
| `pomodoro-skip` | Pomodoro: skip the current phase | `skipPomodoro` | `tests/plugin.test.js`, `tests/pomodoro.test.js` |
| `calendar-add-schedule` | Calendar: add an .ics schedule | `openCalendarImport` | `tests/command-effects.test.js` |
| `calendar-note-next-class` | Calendar: create or open the note for the next class | `openNextClassNote` | `tests/command-effects.test.js` |
| `calendar-export` | Calendar: export the visible schedule to .ics | `exportCalendarIcs` | `tests/calendar.test.js`, `tests/term-calendar.test.js` |
| `open-cards` | Open cards | `activateCards` | `tests/cards.test.js`, `tests/hotkey-cleanup.test.js`, `tests/plugin.test.js` |
| `ankiweb-find-deck` | Cards: find a deck on AnkiWeb | `openAnkiWebSearch` | `tests/plugin.test.js` |
| `open-assignments` | Open assignments and grades | `activateAssignments` | `tests/core-values.test.js`, `tests/plugin.test.js`, `tests/today.test.js` |
| `open-study-tools` | Open Study Tools | `activateStudyTools` | `tests/plugin.test.js` |
| `new-cornell-note` | Cornell notes: create a note | `activateStudyTools` | `tests/plugin.test.js` |
| `open-study-workspace` | Open Study Workspace | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `open-time-blocks` | Time blocks: open the planner | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/time-blocks-kairos.test.js` |
| `open-time-blocks-day` | Time blocks: open the day view | `activateTimeBlocksView` | `tests/time-blocks-kairos.test.js` |
| `open-time-blocks-week` | Time blocks: open the week view | `activateTimeBlocksView` | `tests/time-blocks-kairos.test.js` |
| `open-time-blocks-grid` | Time blocks: open the grid view | `activateTimeBlocksView` | `tests/time-blocks-kairos.test.js` |
| `open-time-blocks-backlog` | Time blocks: open the backlog view | `activateTimeBlocksView` | `tests/time-blocks-kairos.test.js` |
| `open-time-blocks-routines` | Time blocks: open the routines view | `activateTimeBlocksView` | `tests/time-blocks-kairos.test.js` |
| `open-time-blocks-projects` | Time blocks: open the projects and domains view | `activateTimeBlocksView` | `tests/time-blocks-kairos.test.js` |
| `open-time-blocks-timeline` | Time blocks: open the timeline view | `activateTimeBlocksView` | `tests/time-blocks-kairos.test.js` |
| `time-blocks-carry-leftovers` | Time blocks: carry unfinished tasks to today | `carryTimeBlockLeftovers` | `tests/time-blocks-kairos.test.js` |
| `time-blocks-regenerate-routines` | Time blocks: regenerate today's routines | `regenerateTimeBlockRoutines` | `tests/time-blocks-kairos.test.js` |
| `time-blocks-sync-daily-note` | Time blocks: sync today's Schedule section with the daily note | `syncTimeBlockDailyNote` | `tests/time-blocks-kairos.test.js` |
| `time-blocks-import-routines` | Time blocks: import routines from Routines.md | `importTimeBlockRoutinesFile` | `tests/time-blocks-kairos.test.js` |
| `time-blocks-import-backlog` | Time blocks: import Backlog.md | `importTimeBlockBacklogFile` | `tests/time-blocks-kairos.test.js` |
| `time-blocks-tour` | Time blocks: open the guided tour | `openTimeBlocksTour` | `tests/time-blocks-parity.test.js` |
| `time-blocks-write-routines` | Time blocks: write routines to Routines.md | `writeTimeBlockRoutinesFile` | `tests/time-blocks-parity.test.js` |
| `time-blocks-write-backlog` | Time blocks: write the backlog to Backlog.md | `writeTimeBlockBacklogFile` | `tests/time-blocks-parity.test.js` |
| `time-blocks-write-projects` | Time blocks: write project and domain files | `writeTimeBlockProjectFiles` | `tests/time-blocks-parity.test.js` |
| `time-blocks-import-projects` | Time blocks: import project and domain files | `importTimeBlockProjectFiles` | `tests/time-blocks-parity.test.js` |
| `time-blocks-import-kairos` | Time blocks: import Kairos settings | `importKairosSettings` | `tests/time-blocks-parity.test.js` |
| `open-web-browser` | Web browser: open | `openWebBrowser` | `tests/plugin.test.js`, `tests/web-browser-view.test.js`, `tests/web-browser.test.js` |
| `open-recent-files` | Recent files: open | `openRecentFiles` | `tests/recent-files.test.js` |
| `canvas-to-outline` | Canvas: export the active canvas to a Markdown outline | `exportCanvasToMarkdown` | `tests/canvas-markdown.test.js` |
| `canvas-from-outline` | Canvas: build a board from the active note outline | `boardFromActiveNote` | `tests/canvas-markdown.test.js` |
| `canvas-walk-parent` | Canvas: mind map, go to the parent card | `walkCanvas` | `tests/canvas-map.test.js` |
| `canvas-walk-child` | Canvas: mind map, go to the first child card | `walkCanvas` | `tests/canvas-map.test.js` |
| `canvas-walk-next-sibling` | Canvas: mind map, go to the next sibling card | `walkCanvas` | `tests/canvas-map.test.js` |
| `canvas-walk-prev-sibling` | Canvas: mind map, go to the previous sibling card | `walkCanvas` | `tests/canvas-map.test.js` |
| `canvas-layout` | Canvas: arrange the active board as a mind map | `layoutActiveCanvas` | `tests/canvas-map.test.js` |
| `canvas-kanban-report` | Canvas: report the active board's kanban columns | `reportCanvasKanban` | `tests/canvas-kanban.test.js` |
| `canvas-kanban-restack` | Canvas: re-stack the active board's kanban columns | `restackCanvasKanban` | `tests/canvas-kanban.test.js` |
| `canvas-auto-link-report` | Canvas: report the active board's proposed links | `reportCanvasLinks` | `tests/canvas-auto-link.test.js` |
| `canvas-auto-link-apply` | Canvas: link the active board's matching cards | `applyCanvasLinks` | `tests/canvas-auto-link.test.js` |
| `canvas-present-report` | Canvas: report the active board's presentation plan | `reportCanvasPresentation` | `tests/canvas-presentations.test.js` |
| `canvas-present` | Canvas: present the active board | `presentActiveCanvas` | `tests/canvas-presentations.test.js` |
| `canvas-query-report` | Canvas: report the active board's query groups | `reportCanvasQueryGroups` | `tests/canvas-query-groups.test.js` |
| `canvas-query-apply` | Canvas: fit the active board's query groups around their matches | `applyCanvasQueryGroups` | `tests/canvas-query-groups.test.js` |
| `open-task-list` | Open the task list | `activateTaskList` | `tests/plugin.test.js`, `tests/task-list.test.js` |
| `open-reading-library` | Reading library: open the bookshelf | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/time-blocks-kairos.test.js` |
| `new-feynman-cycle` | Feynman Learning: start a cycle | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `build-recall-queue` | Recall Scheduler: build a queue | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `new-topic-plan` | Topic planner: create an exam plan | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `study-flow-capture` | Study Flow: capture a source excerpt | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `subject-manager` | Subject Manager: open subjects | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `open-quiz-index` | Quiz index: scan quizzes and results | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `read-aloud` | Read aloud: speak the active note | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/settings-consolidation.test.js`, `tests/time-blocks-kairos.test.js` |
| `compile-lecture-notes` | Lecture notes: compile the log into one note | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `course-health` | Course health: check the course list | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/settings-consolidation.test.js`, `tests/time-blocks-kairos.test.js` |
| `audio-bookmarks` | Audio bookmarks: timestamp an attachment | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `feynman-ai-feedback` | Feynman: get AI feedback on an explanation | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `pdf-annotation-index` | PDF annotations: index the vault sidecars | `activateStudyWorkspace` | `tests/command-effects.test.js`, `tests/plugin.test.js`, `tests/time-blocks-kairos.test.js` |
| `new-assignment` | Assignments: add an assignment | `openNewAssignment` | `tests/plugin.test.js` |
| `new-exam` | Exams: add an exam | `refreshViews` | `tests/core-values.test.js`, `tests/knowledge-view.test.js` |
| `calendar-class-attended` | Calendar: mark this class note attended | `classNoteEvent` | `tests/command-effects.test.js` |
| `calendar-class-absent` | Calendar: mark this class note absent | `classNoteEvent` | `tests/command-effects.test.js` |
| `course-overview` | Courses: open the course overview | `openCourseOverview` | `tests/core-values.test.js`, `tests/study-workspace-tabs.test.js` |
| `open-reference` | Open Reference | `activateReference` | `tests/plugin.test.js`, `tests/reference.test.js` |
| `open-ap-score` | Open AP score calculator | `openApScore` | `tests/ap-score.test.js` |
| `open-ap-resources` | Open AP resources | `openApResources` | `tests/command-effects.test.js` |
| `open-frq-grader` | AP: open free-response practice and grader | `openFrqGrader` | `tests/frq-review.test.js`, `tests/views.test.js` |
| `new-frq-note` | AP: create a free-response note | `openNewFrqNote` | `tests/command-effects.test.js` |
| `import-frq-pdf` | AP: import free-response questions from a PDF | `openFrqPdfImport` | `tests/frq-import.test.js` |
| `new-card` | Create a flashcard or vocabulary card | `openNewCard` | `tests/plugin.test.js` |
| `source-recall` | Create a source-anchored recall from selection | `openSourceRecall` | `tests/source-recall.test.js` |
| `generate-cards` | Generate flashcards from this note or selection | `openCardGenerator` | `tests/card-generator.test.js` |
| `generate-spaced-quiz` | Spaced quiz: generate from this note | `moduleOff` | `tests/frq-review.test.js`, `tests/spaced-quiz.test.js`, `tests/views.test.js` |
| `auto-anki-send` | Auto Anki: send this note or selection | `moduleOff` | `tests/auto-anki.test.js`, `tests/frq-review.test.js`, `tests/views.test.js` |
| `text2anki-send` | Text2Anki: send the selection to Anki | `runText2AnkiCommand` | `tests/text2anki-openai.test.js` |
| `new-image-occlusion` | Cards: create image occlusion cards | `openImageOcclusion` | `tests/command-effects.test.js` |
| `practice-note` | Practice this note only | `practiceNote` | `tests/cards-extract.test.js`, `tests/plugin.test.js` |
| `cards-extract-note` | Cards: extract cards from this note | `moduleOff` | `tests/frq-review.test.js`, `tests/plugin.test.js`, `tests/views.test.js` |
| `lecture-practice` | Generate practice from this lecture | `openTranscriptPractice` | `tests/command-effects.test.js` |
| `generate-from-note` | AI: generate practice from this note | `openTranscriptPractice` | `tests/adaptive-parity.test.js` |
| `weak-spot-generate` | AI: generate practice from a weak spot | `openWeakSpotGenerate` | `tests/command-effects.test.js` |
| `verify-answer-ai` | AI: verify the answer for this note | `verifyAnswerWithAi` | `tests/answer-verification.test.js` |
| `verify-calculation-note` | Verify this answer by calculation | `verifyAnswerByCalculation` | `tests/computed-verification.test.js` |
| `verify-calculation-all` | Verify numeric answers by calculation | `verifyAllByCalculation` | `tests/command-effects.test.js` |
| `tag-card-courses` | Cards: tag cards with their folder's course | `tagCardsByCourse` | `tests/cards.test.js`, `tests/plugin.test.js` |
| `cards-grade-pending` | Cards: grade pending typed answers | `flushPendingCardGrades` | `tests/cards.test.js`, `tests/today.test.js` |
| `import-cards` | Cards: import existing decks | `openCardImport` | `tests/plugin.test.js` |
| `cards-import-document` | Cards: extract cards from a PDF or Markdown file | `openDocumentCards` | `tests/command-effects.test.js` |
| `open-study-agent` | Study agent: open the sidebar | `activateAgent` | `tests/agent-view.test.js`, `tests/chat-branches.test.js`, `tests/chat-pdf.test.js`, `tests/chat-plan.test.js`, `tests/pdf-annotator-sidebar.test.js`, `tests/quick-chat-bookmarks.test.js` |
| `ai-quick-ask` | AI: Quick Ask about the selection or note | `openQuickAsk` | `tests/quick-ask.test.js` |
| `study-agent-quick-chat` | Study agent: Quick Chat | `openQuickChat` | `tests/quick-chat-bookmarks.test.js` |
| `study-agent-skill` | Study agent: create a skill note | `createSkillNote` | `tests/skills-pricing.test.js` |
| `study-agent-project` | Study agent: create a chat project | `promptChatProject` | `tests/projects-cost.test.js` |
| `study-agent-cost` | Study agent: show this chat's cost estimate | `showChatCostEstimate` | `tests/projects-cost.test.js` |
| `study-agent-memory` | Study agent: manage saved memory | `openMemoryModal` | `tests/memory-export.test.js` |
| `study-agent-export` | Study agent: export a conversation as Markdown | `exportChatAsMarkdown` | `tests/memory-export.test.js` |
| `study-agent-rewind` | Study agent: rewind to the last question | `rewindLastQuestion` | `tests/chat-branches.test.js` |
| `study-agent-fork` | Study agent: fork from the last question | `forkLastQuestion` | `tests/chat-branches.test.js` |
| `study-agent-plan` | Study agent: plan a multi-step task | `promptStudyPlan` | `tests/chat-plan.test.js` |
| `study-agent-attach-pdf` | Study agent: attach a PDF | `attachPdfToStudyAgent` | `tests/chat-pdf.test.js` |
| `study-agent-diagnostics` | Study agent: save diagnostics bundle | `saveDiagnosticsBundle` | `tests/diagnostics-gauge.test.js` |
| `cards-rescan-plain` | Cards: rescan plain Markdown folder | `moduleOff` | `tests/frq-review.test.js`, `tests/plain-cards.test.js`, `tests/views.test.js` |
| `export-cards` | Cards: export to Quizlet, Anki package, Anki text, Mochi, LearnKit, Kahoot, Blooket or Gimkit | `openCardExport` | `tests/command-effects.test.js` |
| `push-cards-anki` | Cards: push to Anki (AnkiConnect) | `openAnkiConnectPush` | `tests/command-effects.test.js` |
| `push-vault-anki` | Cards: push the whole vault to Anki (AnkiConnect) | `openAnkiConnectPush` | `tests/anki-connect.test.js`, `tests/command-effects.test.js` |
| `sync-cards-anki` | Cards: sync with Anki (AnkiConnect) | `openAnkiConnectPush` | `tests/command-effects.test.js` |
| `test-couchdb` | Cards: test CouchDB connection | `testCouchDbConnection` | `tests/secret-keys.test.js` |
| `sync-cards-couchdb` | Cards: sync review state with CouchDB | `syncCardsCouchDb` | `tests/couchdb-sync.test.js` |
| `open-due-queue` | Open today's due queue | `openDueQueue` | `tests/command-effects.test.js` |
| `review-notes` | Review notes (whole-note queue) | `openNoteReview` | `tests/note-review.test.js`, `tests/quiz-block.test.js`, `tests/review-sidebar.test.js` |
| `spaced-everything-review` | Spaced Everything: review due notes | `moduleOff` | `tests/frq-review.test.js`, `tests/spaced-everything.test.js`, `tests/views.test.js` |
| `spaced-everything-log` | Spaced Everything: log review outcome for this note | `moduleOff` | `tests/frq-review.test.js`, `tests/spaced-everything.test.js`, `tests/views.test.js` |
| `spaced-everything-capture` | Spaced Everything: capture thought | `moduleOff` | `tests/frq-review.test.js`, `tests/spaced-everything.test.js`, `tests/views.test.js` |
| `simple-note-quiz` | Simple note quiz: start on this note | `moduleOff` | `tests/frq-review.test.js`, `tests/simple-note-quiz.test.js`, `tests/views.test.js` |
| `generate-quiz` | Generate quiz questions from notes | `openQuizGenerator` | `tests/quiz-generator-cost.test.js`, `tests/quiz-generator.test.js` |
| `cards-export-archive` | Cards: export a portable archive | `exportCardArchive` | `tests/card-archive.test.js` |
| `cards-import-archive` | Cards: import a portable archive | `openCardArchiveImport` | `tests/command-effects.test.js` |
| `study-nudge-show` | Show today's study nudge | `maybeShowStudyNudge` | `tests/study-nudge.test.js` |
| `course-note-from-template` | Course notes: create a note from a template | `openCourseNoteBuilder` | `tests/command-effects.test.js` |
| `mixed-review` | Start mixed review | `openMixedReview` | `tests/mixed-review.test.js` |
| `manage-study-status` | Manage hidden study items | `openStudyStatusManager` | `tests/today.test.js` |
| `weak-spots` | Show weak spots | `activateInsights` | `tests/modules.test.js`, `tests/plugin.test.js`, `tests/views.test.js` |
| `error-log` | Show error log | `activateInsights` | `tests/modules.test.js`, `tests/plugin.test.js`, `tests/views.test.js` |
| `knowledge-record` | Open the knowledge record | `activateInsights` | `tests/knowledge-commands.test.js`, `tests/knowledge-store.test.js`, `tests/modules.test.js`, `tests/views.test.js` |
| `rebuild-knowledge-record` | Knowledge record: rebuild from notes | `rebuildKnowledgeRecord` | `tests/knowledge-commands.test.js`, `tests/knowledge-record-scenario.test.js`, `tests/knowledge-view.test.js` |
| `copy-learner-digest` | Knowledge record: copy learner digest | `copyLearnerDigest` | `tests/knowledge-commands.test.js`, `tests/knowledge-view.test.js` |
| `find-question` | Find a question by ID | — | `tests/plugin.test.js` |
| `rename-source-id` | Rename old source_question_id properties to official_question_id | `migrateOfficialIds` | `tests/plugin.test.js` |
| `open-ai-assistant` | Open AI assistant (OpenCode) | `activateView` | `tests/calendar.test.js`, `tests/cards-extract.test.js`, `tests/daily-quiz.test.js`, `tests/modules.test.js`, `tests/plugin.test.js`, `tests/quick-practice-uri.test.js`, `tests/today.test.js`, `tests/views.test.js` |
| `next-question` | Next question (from current filters) | `activateView` | `tests/calendar.test.js`, `tests/cards-extract.test.js`, `tests/daily-quiz.test.js`, `tests/modules.test.js`, `tests/plugin.test.js`, `tests/quick-practice-uri.test.js`, `tests/today.test.js`, `tests/views.test.js` |
| `toggle-flag` | Toggle flag on this question | `toggleFlag` | `tests/command-effects.test.js` |
| `mark-question-fixed` | Mark this question fixed | `markQuestionFixed` | `tests/needs-fixing.test.js` |
| `add-fields-this-note` | Add missing tracking properties to this note | `addMissingFields` | `tests/command-effects.test.js` |
| `add-fields-all` | Add missing tracking properties to all question notes | `addMissingFields` | `tests/command-effects.test.js` |
| `repair-review-history` | Repair review counters from history | `repairReviewHistory` | `tests/history.test.js` |
| `tables-next-cell` | Tables: go to the next cell | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-previous-cell` | Tables: go to the previous cell | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-next-row` | Tables: go to the next row | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-escape` | Tables: move the cursor out of the table | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-format` | Tables: format the table under the cursor | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-insert-row-above` | Tables: insert a row above | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-insert-row-below` | Tables: insert a row below | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-insert-column-left` | Tables: insert a column to the left | `activeTableContext` | `tests/table-commands.test.js` |
| `tables-insert-column-right` | Tables: insert a column to the right | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-delete-row` | Tables: delete the row | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-delete-column` | Tables: delete the column | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-move-row-up` | Tables: move the row up | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-move-row-down` | Tables: move the row down | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-move-column-left` | Tables: move the column left | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-move-column-right` | Tables: move the column right | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-align-left` | Tables: align the column left | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-align-center` | Tables: align the column center | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-align-right` | Tables: align the column right | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-align-default` | Tables: clear the column alignment | `activeTableContext` | `tests/table-commands.test.js` |
| `tables-sort-asc` | Tables: sort rows ascending | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-sort-desc` | Tables: sort rows descending | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-transpose` | Tables: transpose | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-formulas` | Tables: evaluate formulas | `activeTableContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/advanced-tables-upstream.test.js`, `tests/table-commands.test.js` |
| `tables-export-csv` | Tables: export as CSV | `activeTableContext` | `tests/table-commands.test.js` |
| `tables-format-all` | Tables: format every table in this note | `activeEditorContext` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |
| `tables-open-controls` | Tables: open the table controls panel | `openTableControls` | `tests/advanced-tables-executable-parity.test.js`, `tests/table-commands.test.js` |

## Gaps (3 groups, 0 commands)

Each entry is implemented in the bundle but has no test that names it. They are listed
rather than claimed as covered, with the reason it is not separately tested. A group that
backs a README feature claim is not allowed here: `tests/capability-inventory.test.js`
fails unless every uncited group is on its three-item plumbing allowlist.

- module `downloadFile` (0 exports) — plumbing: wraps `requestUrl` and the vault write for the installer — its only effect is bytes reaching disk.
- module `extractArchive` (0 exports) — plumbing: unpacks an already-downloaded archive into a temp directory; it keeps no state of its own.
- module `findBinaryIn` (0 exports) — plumbing: probes candidate paths for an already-installed binary and returns the first that exists.
