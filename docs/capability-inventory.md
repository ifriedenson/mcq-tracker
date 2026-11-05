# Capability inventory — derived from the bundle

Generated Nov 5, 2026 from the built `main.js` (`T`, the plugin's test surface) and the
plugin's registered commands, not from prose. Each row names the exports a group carries
and the test files that cite that group; `tests/capability-inventory.test.js` re-derives
the table and fails if a group, export count, command or citing test drifts.

**Modules:** 384 groups, 2494 exports. **Commands:** 150. **Gaps:** 57 groups and 30 commands with no citing test (listed at the end).

## Modules

| Group | Exports | Tests that cite it |
| --- | --- | --- |
| `API_PRESETS` | 10 | `tests/local-models.test.js`<br>`tests/qwen-preset.test.js` |
| `API_SYSTEM` | 0 | `tests/ai-write-guard.test.js` |
| `ASSIGNMENTS_TABS` | 3 | `tests/modules.test.js` |
| `AgentEditReviewModal` | 0 | — |
| `ApiClient` | 0 | `tests/chat-stream.test.js`<br>`tests/local-models.test.js`<br>`tests/model-discovery.test.js`<br>`tests/ocr.test.js`<br>`tests/qwen-preset.test.js`<br>`tests/secret-keys.test.js` |
| `AssignmentModal` | 0 | — |
| `AssignmentsView` | 0 | `tests/assignments.test.js`<br>`tests/mobile-module-layout.test.js` |
| `AutoAnkiModal` | 0 | `tests/auto-anki.test.js` |
| `CALENDAR_TABS` | 7 | `tests/calendar.test.js` |
| `CARDS_TABS` | 4 | `tests/modules.test.js` |
| `CalculationPreviewModal` | 0 | — |
| `CalendarView` | 0 | `tests/calendar.test.js`<br>`tests/term-calendar.test.js` |
| `CardExtractModal` | 0 | — |
| `CardModal` | 0 | `tests/source-recall.test.js` |
| `CardView` | 0 | `tests/card-learning.test.js`<br>`tests/card-reveal.test.js`<br>`tests/cards.test.js`<br>`tests/flashcard-generate.test.js`<br>`tests/interval-preview.test.js`<br>`tests/mobile-module-layout.test.js`<br>`tests/source-recall.test.js`<br>`tests/study-status.test.js` |
| `ChatPanel` | 1 | `tests/agent-view.test.js`<br>`tests/note-context.test.js`<br>`tests/security-hardening.test.js`<br>`tests/think-first.test.js` |
| `CourseOverviewModal` | 0 | `tests/core-values.test.js` |
| `DEFAULT_SETTINGS` | 112 | `tests/grading.test.js` |
| `DocumentReviewModal` | 0 | — |
| `DueQueueModal` | 0 | — |
| `FindQuestionModal` | 0 | `tests/views.test.js` |
| `FocusLogModal` | 0 | — |
| `FolderFilterSuggest` | 0 | `tests/views.test.js` |
| `FrqGraderModal` | 0 | `tests/frq-handwriting.test.js`<br>`tests/frq.test.js` |
| `GLOBAL_TABS` | 3 | `tests/modules.test.js` |
| `InsightsView` | 0 | `tests/study-plan.test.js`<br>`tests/views.test.js` |
| `LocalEventModal` | 0 | — |
| `LocalEventsView` | 0 | `tests/mobile-calendar-agenda.test.js` |
| `MAX_OPENCODE_MAJOR` | 0 | — |
| `MCQ_TABS` | 5 | `tests/calendar.test.js`<br>`tests/daily-quiz.test.js` |
| `MixedReviewModal` | 0 | `tests/mixed-review.test.js` |
| `NewFrqNoteModal` | 0 | `tests/frq.test.js` |
| `NoteReviewDock` | 0 | — |
| `NoteReviewModal` | 0 | `tests/spaced-everything.test.js` |
| `OcrModal` | 0 | — |
| `OpenCodeClient` | 0 | `tests/chat-stream.test.js`<br>`tests/opencode-compat.test.js` |
| `OpenCodeManager` | 0 | `tests/opencode-compat.test.js` |
| `PdfAnnotationModal` | 0 | — |
| `PdfImportModal` | 0 | `tests/empty-state.test.js`<br>`tests/import-source.test.js`<br>`tests/views.test.js` |
| `PdfInkModal` | 0 | `tests/pdf-ink.test.js` |
| `PomodoroView` | 0 | `tests/mobile-module-layout.test.js`<br>`tests/pomodoro-view.test.js` |
| `PracticeView` | 0 | `tests/closed-book.test.js`<br>`tests/empty-state.test.js`<br>`tests/exam-ready.test.js`<br>`tests/hints.test.js`<br>`tests/matching.test.js`<br>`tests/math-rendering.test.js`<br>`tests/mobile-practice.test.js`<br>`tests/modules.test.js`<br>`tests/needs-fixing.test.js`<br>`tests/practice-fullscreen.test.js`<br>`tests/practice-keys.test.js`<br>`tests/study-modes.test.js`<br>`tests/study-skin.test.js`<br>`tests/study-status.test.js`<br>`tests/views.test.js` |
| `QUICK_COUNT_OPTIONS` | 3 | — |
| `QUICK_START_URL` | 0 | `tests/empty-state.test.js` |
| `QUICK_TIME_OPTIONS` | 3 | — |
| `QuestionFolderModal` | 0 | `tests/views.test.js` |
| `QuestionTrackerSettingTab` | 0 | — |
| `QuickAddModal` | 0 | — |
| `REFERENCE_TABS` | 2 | `tests/modules.test.js` |
| `ReferenceView` | 0 | `tests/ap-exam-history.test.js`<br>`tests/ap-resource-notes.test.js`<br>`tests/ap-score.test.js`<br>`tests/calculator.test.js`<br>`tests/complex.test.js`<br>`tests/geometry.test.js`<br>`tests/graph-3d.test.js`<br>`tests/graph-complex.test.js`<br>`tests/matrix.test.js`<br>`tests/mobile-reference-stats.test.js`<br>`tests/reference-advanced.test.js`<br>`tests/reference-sheets.test.js`<br>`tests/reference-tools.test.js`<br>`tests/reference.test.js` |
| `ReviewCalendarView` | 0 | `tests/mobile-calendar-agenda.test.js` |
| `SETTINGS_MODULES` | 46 | `tests/calendar.test.js`<br>`tests/modules.test.js`<br>`tests/review-calendar.test.js`<br>`tests/study-tool-settings.test.js` |
| `SimpleNoteQuizModal` | 0 | `tests/simple-note-quiz.test.js` |
| `SpacedEverythingCaptureModal` | 0 | — |
| `StudyMatchModal` | 0 | `tests/study-modes.test.js` |
| `StudySlotModal` | 0 | `tests/calendar.test.js` |
| `StudyStatsView` | 0 | `tests/mobile-reference-stats.test.js` |
| `StudyStatusModal` | 0 | — |
| `StudyToolsView` | 0 | `tests/lecture-links.test.js`<br>`tests/mobile-module-layout.test.js`<br>`tests/study-tools.test.js` |
| `StudyWorkspaceView` | 0 | `tests/citations.test.js`<br>`tests/fsrs-fit.test.js`<br>`tests/glossary.test.js`<br>`tests/mobile-module-layout.test.js`<br>`tests/reading-library.test.js`<br>`tests/settings-consolidation.test.js`<br>`tests/study-modules-2.test.js`<br>`tests/study-modules-3.test.js`<br>`tests/study-workspace-health.test.js`<br>`tests/study-workspace-layout.test.js`<br>`tests/study-workspace-tabs.test.js`<br>`tests/study-workspace.test.js`<br>`tests/task-tags.test.js`<br>`tests/time-blocks.test.js`<br>`tests/vault-task-index.test.js`<br>`tests/wordnet.test.js`<br>`tests/writing-sessions.test.js` |
| `TaskListView` | 0 | `tests/task-list.test.js` |
| `TestView` | 0 | `tests/views.test.js` |
| `TodayView` | 0 | `tests/ap-exam-resources.test.js`<br>`tests/core-values.test.js`<br>`tests/daily-quiz-freeze.test.js`<br>`tests/daily-quiz.test.js`<br>`tests/focus.test.js`<br>`tests/frq-review.test.js`<br>`tests/reading-plan.test.js`<br>`tests/study-plan.test.js`<br>`tests/study-tools.test.js`<br>`tests/today-dom.test.js`<br>`tests/today.test.js` |
| `TranscriptPracticeModal` | 0 | — |
| `WeakSpotModal` | 0 | — |
| `WelcomeModal` | 0 | — |
| `activityLevel` | 0 | `tests/analytics.test.js` |
| `adaptiveSession` | 5 | `tests/adaptive-session.test.js` |
| `adaptiveTargetRank` | 0 | `tests/filters.test.js` |
| `adaptiveWeight` | 0 | `tests/filters.test.js` |
| `agentEditReview` | 9 | `tests/agent-edit-review.test.js` |
| `agentNote` | 2 | `tests/agent-view.test.js` |
| `agentRetrieval` | 14 | `tests/agent-retrieval.test.js` |
| `agentView` | 5 | `tests/agent-view.test.js` |
| `agentWriteGuard` | 3 | `tests/agent-write-guard.test.js` |
| `aiContext` | 5 | `tests/ai-context.test.js` |
| `aiReady` | 0 | `tests/empty-state.test.js` |
| `aiService` | 27 | `tests/ai-service.test.js`<br>`tests/frq-handwriting.test.js` |
| `aiTools` | 7 | `tests/ai-tools.test.js` |
| `aiWriteGuard` | 7 | `tests/ai-write-guard.test.js` |
| `aiWrites` | 7 | `tests/ai-writes.test.js` |
| `analytics` | 18 | `tests/p1-knowledge.test.js` |
| `analyticsEmbed` | 11 | — |
| `ankiConnect` | 21 | `tests/anki-connect.test.js`<br>`tests/anki-folder-exclusions.test.js` |
| `answerFromSection` | 0 | `tests/grading.test.js`<br>`tests/math-rendering.test.js` |
| `answerSetFromSection` | 0 | `tests/question-types.test.js` |
| `answerTrueFalseFromSection` | 0 | `tests/question-types.test.js` |
| `answerTypes` | 9 | `tests/question-types.test.js` |
| `answerVerification` | 10 | `tests/answer-verification.test.js`<br>`tests/computed-verification.test.js` |
| `apExamHistory` | 12 | `tests/ap-exam-history.test.js` |
| `apExamResources` | 8 | `tests/ap-exam-resources.test.js` |
| `apResourceNotes` | 19 | `tests/ap-resource-notes.test.js` |
| `apResources` | 7 | `tests/ap-resource-notes.test.js` |
| `apScore` | 10 | `tests/ap-exam-history.test.js`<br>`tests/ap-score.test.js`<br>`tests/frq.test.js` |
| `apiTurns` | 0 | — |
| `apkg` | 7 | `tests/apkg.test.js`<br>`tests/security-hardening.test.js` |
| `apkgExport` | 6 | `tests/apkg.test.js` |
| `applyAttempt` | 0 | `tests/card-learning.test.js`<br>`tests/cards.test.js`<br>`tests/exam-schedule.test.js`<br>`tests/fsrs-fit.test.js`<br>`tests/fsrs.test.js`<br>`tests/grading.test.js`<br>`tests/history.test.js`<br>`tests/leech.test.js`<br>`tests/needs-fixing.test.js`<br>`tests/note-review-dock.test.js`<br>`tests/p1-knowledge.test.js`<br>`tests/parameterized.test.js`<br>`tests/scheduler-fit.test.js`<br>`tests/sm2.test.js` |
| `applySkip` | 0 | `tests/adaptive-parity.test.js`<br>`tests/history.test.js` |
| `assertExtractedTree` | 0 | `tests/security-hardening.test.js` |
| `assignments` | 48 | `tests/assignments.test.js`<br>`tests/core-values.test.js` |
| `audioBookmarks` | 10 | `tests/study-modules-2.test.js` |
| `audioTrace` | 5 | `tests/reference-advanced.test.js` |
| `autoAnki` | 7 | `tests/auto-anki.test.js`<br>`tests/text2anki-openai.test.js` |
| `bandQuestions` | 0 | `tests/progress.test.js` |
| `buildCalibration` | 0 | `tests/analytics-embed.test.js`<br>`tests/analytics.test.js` |
| `buildCourses` | 0 | `tests/progress.test.js` |
| `buildDashboard` | 0 | `tests/analytics-embed.test.js`<br>`tests/analytics.test.js` |
| `buildDueQueue` | 0 | `tests/study-status.test.js` |
| `buildGeneralContext` | 0 | `tests/ai-context.test.js`<br>`tests/tutor-presets.test.js` |
| `buildGradeSnapshot` | 0 | — |
| `buildHeatmap` | 0 | `tests/analytics.test.js` |
| `buildMastery` | 0 | `tests/analytics-embed.test.js`<br>`tests/progress.test.js` |
| `buildMasteryTrend` | 0 | `tests/progress.test.js` |
| `buildMixedQueue` | 0 | `tests/due-queue.test.js`<br>`tests/mixed-review.test.js` |
| `buildMomentum` | 0 | `tests/progress.test.js` |
| `buildProgress` | 0 | `tests/progress.test.js` |
| `buildQuickQueue` | 0 | — |
| `buildReportMarkdown` | 0 | `tests/import.test.js` |
| `buildRetention` | 0 | `tests/analytics.test.js` |
| `buildTestSet` | 0 | `tests/stats.test.js` |
| `buildTutorContext` | 0 | `tests/tutor-presets.test.js` |
| `buildWeeks` | 0 | `tests/progress.test.js` |
| `cacheIssues` | 0 | `tests/empty-state.test.js` |
| `calculator` | 8 | `tests/calculator.test.js` |
| `calculus` | 5 | `tests/reference-tools.test.js` |
| `calendarIcs` | 19 | `tests/calendar.test.js`<br>`tests/term-calendar.test.js` |
| `calendarInterop` | 3 | `tests/calendar-interop.test.js` |
| `calendarModel` | 52 | `tests/calendar.test.js`<br>`tests/core-values.test.js`<br>`tests/exam-schedule.test.js`<br>`tests/term-calendar.test.js` |
| `calendarNotes` | 8 | `tests/calendar.test.js` |
| `calendarPlanner` | 10 | `tests/calendar-planner.test.js` |
| `candidateAssetNames` | 0 | — |
| `cardArchive` | 8 | `tests/card-archive.test.js` |
| `cardGenerator` | 11 | `tests/card-generator.test.js`<br>`tests/spaced-quiz.test.js` |
| `cardGradeQueue` | 8 | `tests/card-grading-ai.test.js` |
| `cardGrading` | 10 | `tests/card-grading-ai.test.js`<br>`tests/card-grading.test.js` |
| `cardGradingAi` | 6 | `tests/card-grading-ai.test.js` |
| `cardPreview` | 0 | `tests/couchdb-sync.test.js` |
| `cardWriteDiff` | 2 | `tests/card-write-diff.test.js` |
| `cards` | 46 | `tests/card-learning.test.js`<br>`tests/card-reveal.test.js`<br>`tests/card-scheduler-explorer.test.js`<br>`tests/cards-extract.test.js`<br>`tests/cards-import.test.js`<br>`tests/cards.test.js`<br>`tests/flashcard-generate.test.js`<br>`tests/fsrs-fit.test.js`<br>`tests/mobile-module-layout.test.js`<br>`tests/plain-cards.test.js`<br>`tests/quizlet-pdf-fixtures.test.js`<br>`tests/sm2.test.js`<br>`tests/source-recall.test.js`<br>`tests/spaced-quiz.test.js`<br>`tests/study-status.test.js` |
| `cardsExtract` | 13 | `tests/cards-extract.test.js`<br>`tests/flashcard-generate.test.js` |
| `cardsImport` | 39 | `tests/cards-import.test.js`<br>`tests/quizlet-pdf-fixtures.test.js`<br>`tests/spaced-quiz.test.js` |
| `cbtExam` | 7 | `tests/cbt-exam.test.js` |
| `chatHistory` | 5 | `tests/chat-history.test.js` |
| `chatSessions` | 11 | `tests/chat-sessions.test.js` |
| `chatStream` | 5 | `tests/chat-stream.test.js` |
| `chooseRelease` | 0 | `tests/opencode-compat.test.js` |
| `citations` | 11 | `tests/citations.test.js` |
| `cloneFilters` | 0 | — |
| `complex` | 27 | `tests/complex.test.js`<br>`tests/graph-complex.test.js` |
| `computeStats` | 0 | `tests/p1-knowledge.test.js`<br>`tests/skip-insights.test.js`<br>`tests/stats.test.js` |
| `computedVerification` | 5 | `tests/computed-verification.test.js` |
| `conceptMastery` | 4 | `tests/concept-mastery.test.js`<br>`tests/p1-knowledge.test.js` |
| `contextRetrieval` | 7 | `tests/context-retrieval.test.js` |
| `cornell` | 5 | `tests/cornell-margins.test.js`<br>`tests/study-tools.test.js` |
| `couchdbSync` | 15 | `tests/couchdb-sync.test.js` |
| `courseHealth` | 5 | `tests/core-values.test.js`<br>`tests/study-modules-2.test.js`<br>`tests/study-workspace-health.test.js` |
| `courseNotes` | 11 | `tests/course-notes.test.js` |
| `courseTemplates` | 12 | `tests/course-templates.test.js` |
| `createQuickSession` | 0 | — |
| `dailyQuiz` | 14 | `tests/daily-quiz-freeze.test.js`<br>`tests/daily-quiz.test.js` |
| `distractorQuality` | 5 | `tests/distractor-quality.test.js` |
| `documentCards` | 7 | `tests/document-cards.test.js`<br>`tests/import-routes-audit.test.js` |
| `documentClassify` | 5 | `tests/document-classify.test.js` |
| `documents` | 18 | `tests/documents.test.js`<br>`tests/import-source.test.js` |
| `downloadFile` | 0 | — |
| `durability` | 9 | `tests/durability.test.js` |
| `emptyState` | 0 | `tests/empty-state.test.js` |
| `errorLog` | 0 | `tests/stats.test.js` |
| `examBlock` | 2 | `tests/exam-block.test.js` |
| `extractArchive` | 0 | — |
| `extractRationale` | 0 | `tests/math-rendering.test.js` |
| `feynmanAi` | 8 | `tests/study-modules-3.test.js` |
| `figures` | 3 | `tests/figures.test.js` |
| `fileExplorer` | 4 | `tests/card-scheduler-explorer.test.js` |
| `fillDefaults` | 0 | — |
| `filterOptionCounts` | 0 | `tests/filters.test.js` |
| `filterOptions` | 0 | `tests/filters.test.js` |
| `finalizeNote` | 0 | `tests/computed-verification.test.js`<br>`tests/import.test.js` |
| `findAnswerKey` | 0 | `tests/question-types.test.js` |
| `findBinaryIn` | 0 | — |
| `findDuplicateIds` | 0 | `tests/import.test.js` |
| `fmtDate` | 0 | `tests/cards.test.js`<br>`tests/practice-sheet.test.js`<br>`tests/results-export.test.js` |
| `fmtDateTime` | 0 | — |
| `fmtPct` | 0 | `tests/stats.test.js` |
| `focus` | 15 | `tests/focus.test.js`<br>`tests/tag-timer.test.js` |
| `folderChain` | 0 | `tests/filters.test.js` |
| `folderLabel` | 0 | `tests/filters.test.js` |
| `friendlyApiError` | 0 | — |
| `friendlyError` | 0 | — |
| `frq` | 40 | `tests/frq-handwriting.test.js`<br>`tests/frq-review.test.js`<br>`tests/frq.test.js`<br>`tests/p1-knowledge.test.js` |
| `fsrs` | 14 | `tests/analytics.test.js`<br>`tests/cards.test.js`<br>`tests/fsrs-fit.test.js`<br>`tests/fsrs.test.js`<br>`tests/progress.test.js` |
| `fsrsFit` | 6 | `tests/fsrs-fit.test.js` |
| `geometry` | 35 | `tests/geometry.test.js` |
| `geometryPanel` | 9 | — |
| `glossary` | 10 | `tests/glossary.test.js` |
| `gradeAnswer` | 0 | `tests/grading.test.js`<br>`tests/matching.test.js`<br>`tests/numeric-grading.test.js`<br>`tests/question-types.test.js` |
| `gradeAnswerDetailed` | 0 | `tests/numeric-grading.test.js`<br>`tests/question-types.test.js` |
| `gradeLetter` | 0 | `tests/analytics.test.js` |
| `graph3d` | 23 | `tests/graph-3d.test.js`<br>`tests/reference-advanced.test.js` |
| `graph3dExport` | 3 | `tests/reference-advanced.test.js` |
| `graph3dPanel` | 19 | — |
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
| `hasFilters` | 0 | — |
| `hasValidQuestion` | 0 | `tests/empty-state.test.js` |
| `history` | 23 | `tests/history.test.js`<br>`tests/needs-fixing.test.js` |
| `indexOfficialIds` | 0 | `tests/import.test.js` |
| `inferMode` | 0 | `tests/matching.test.js`<br>`tests/math-rendering.test.js`<br>`tests/question-types.test.js` |
| `intervalPreview` | 4 | `tests/interval-preview.test.js` |
| `isDue` | 0 | `tests/study-status.test.js` |
| `isExamReady` | 0 | `tests/exam-ready.test.js` |
| `learnkit` | 6 | `tests/learnkit.test.js` |
| `lectureCompiler` | 6 | `tests/study-modules-2.test.js` |
| `loadQuestionData` | 0 | `tests/parameterized.test.js`<br>`tests/study-modes.test.js`<br>`tests/study-skin.test.js` |
| `localEvents` | 18 | `tests/local-events.test.js` |
| `localModels` | 5 | `tests/local-models.test.js` |
| `masteryBandOf` | 0 | `tests/progress.test.js` |
| `masteryPicker` | 15 | `tests/mastery-picker.test.js` |
| `masteryScopes` | 0 | `tests/progress.test.js` |
| `masteryTrendText` | 0 | — |
| `masteryWindowDays` | 0 | `tests/analytics-embed.test.js`<br>`tests/progress.test.js` |
| `matchFilters` | 0 | — |
| `matchSets` | 0 | `tests/filters.test.js` |
| `matching` | 6 | `tests/matching.test.js` |
| `mathRendering` | 9 | `tests/math-rendering.test.js` |
| `matrix` | 22 | `tests/matrix.test.js` |
| `memoryOf` | 0 | `tests/progress.test.js` |
| `mergeAuth` | 0 | — |
| `mixedQuestionAttempt` | 0 | `tests/mixed-review.test.js` |
| `mochiExport` | 5 | `tests/mochi-export.test.js` |
| `modelDiscovery` | 4 | `tests/model-discovery.test.js` |
| `modelFromString` | 0 | — |
| `normalizeDailyCap` | 0 | `tests/due-queue.test.js` |
| `normalizeExamReadyPasses` | 0 | — |
| `noteContext` | 7 | `tests/note-context.test.js` |
| `noteIssues` | 0 | `tests/empty-state.test.js`<br>`tests/import.test.js` |
| `noteReview` | 14 | `tests/note-review-dock.test.js`<br>`tests/note-review.test.js` |
| `noteReviewDock` | 13 | `tests/note-review-dock.test.js` |
| `numericGrading` | 19 | `tests/numeric-grading.test.js` |
| `ocr` | 5 | `tests/ocr.test.js` |
| `officialIdOf` | 0 | `tests/import.test.js` |
| `offline` | 10 | `tests/offline.test.js` |
| `opencodeMajor` | 0 | `tests/opencode-compat.test.js` |
| `osNotifications` | 7 | `tests/os-notifications.test.js` |
| `overallStats` | 0 | `tests/p1-knowledge.test.js`<br>`tests/skip-insights.test.js`<br>`tests/stats.test.js` |
| `packQuickSession` | 0 | — |
| `packTestSession` | 0 | `tests/parameterized.test.js`<br>`tests/stats.test.js` |
| `paperScanner` | 10 | `tests/paper-scanner.test.js` |
| `parameterized` | 14 | `tests/parameterized.test.js` |
| `parseDashboardBlock` | 0 | `tests/analytics-embed.test.js` |
| `parseHistory` | 0 | `tests/p1-knowledge.test.js`<br>`tests/stats.test.js` |
| `parseNote` | 0 | `tests/adaptive-parity.test.js`<br>`tests/empty-state.test.js`<br>`tests/hints.test.js`<br>`tests/import.test.js`<br>`tests/note-quiz-clipboard.test.js`<br>`tests/quick-add.test.js`<br>`tests/transcript.test.js` |
| `parseScheduleBlock` | 0 | `tests/calendar.test.js` |
| `parseSections` | 0 | `tests/grading.test.js`<br>`tests/hints.test.js`<br>`tests/matching.test.js`<br>`tests/math-rendering.test.js`<br>`tests/needs-fixing.test.js`<br>`tests/question-types.test.js`<br>`tests/views.test.js` |
| `partsToTurns` | 0 | — |
| `pauseQuickSession` | 0 | — |
| `pdf` | 17 | `tests/cards-import.test.js`<br>`tests/pdf-annotations.test.js`<br>`tests/pdf-annotator-sidebar.test.js`<br>`tests/pdf-annotator.test.js`<br>`tests/pdf-editor-window.test.js`<br>`tests/pdf-ink.test.js`<br>`tests/pdf-reader-page-ops.test.js`<br>`tests/study-modules-3.test.js` |
| `pdfAnnotationIndex` | 7 | `tests/study-modules-3.test.js` |
| `pdfAnnotations` | 22 | `tests/pdf-annotations.test.js`<br>`tests/pdf-annotator-sidebar.test.js`<br>`tests/pdf-annotator.test.js`<br>`tests/pdf-ink.test.js`<br>`tests/pdf-reader-page-ops.test.js`<br>`tests/study-modules-3.test.js` |
| `pdfAnnotatorSidebar` | 8 | `tests/pdf-annotator-sidebar.test.js` |
| `pdfEditor` | 56 | `tests/pdf-editor-window.test.js`<br>`tests/pdf-reader-page-ops.test.js` |
| `pdfEditorModal` | 3 | `tests/pdf-editor-window.test.js` |
| `pdfInk` | 27 | `tests/pdf-annotations.test.js`<br>`tests/pdf-annotator-sidebar.test.js`<br>`tests/pdf-annotator.test.js`<br>`tests/pdf-editor-window.test.js`<br>`tests/pdf-ink.test.js`<br>`tests/pdf-reader-page-ops.test.js` |
| `pdfInkModal` | 2 | `tests/pdf-annotator-sidebar.test.js`<br>`tests/pdf-editor-window.test.js`<br>`tests/pdf-reader-page-ops.test.js` |
| `pickQuestion` | 0 | `tests/mastery-picker.test.js`<br>`tests/study-status.test.js` |
| `plainCards` | 6 | `tests/plain-cards.test.js` |
| `platformTriple` | 0 | — |
| `pomodoro` | 16 | `tests/pomodoro.test.js` |
| `practiceFullscreen` | 6 | `tests/practice-fullscreen.test.js` |
| `practiceKeys` | 1 | `tests/practice-keys.test.js` |
| `progress` | 18 | `tests/p1-knowledge.test.js` |
| `provenance` | 10 | `tests/import.test.js`<br>`tests/source-recall.test.js` |
| `qtiArchive` | 1 | `tests/cards-import.test.js` |
| `quickAdd` | 7 | `tests/hints.test.js`<br>`tests/note-quiz-clipboard.test.js`<br>`tests/quick-add.test.js` |
| `quickRemainingSeconds` | 0 | — |
| `quizBlock` | 18 | `tests/numeric-quiz.test.js`<br>`tests/quiz-bind.test.js`<br>`tests/quiz-block.test.js`<br>`tests/quiz-note-gate.test.js`<br>`tests/quiz-results.test.js`<br>`tests/reorder.test.js`<br>`tests/shared-choice.test.js` |
| `quizClipboard` | 2 | `tests/note-quiz-clipboard.test.js` |
| `quizDedup` | 2 | `tests/quiz-dedup.test.js` |
| `quizGenerator` | 13 | `tests/quiz-generator.test.js` |
| `quizMaker` | 8 | `tests/quiz-maker.test.js` |
| `quizNoteGate` | 2 | `tests/quiz-note-gate.test.js` |
| `quizport` | 7 | `tests/quizport.test.js` |
| `readAloud` | 12 | `tests/read-aloud.test.js`<br>`tests/settings-consolidation.test.js`<br>`tests/study-modules-2.test.js` |
| `reading` | 14 | `tests/core-values.test.js`<br>`tests/reading-companion.test.js`<br>`tests/reading-library.test.js`<br>`tests/reading-plan.test.js` |
| `readingCompanion` | 9 | `tests/reading-companion.test.js` |
| `readingLibrary` | 16 | `tests/reading-library.test.js` |
| `referenceData` | 13 | `tests/graph-3d.test.js`<br>`tests/reference-advanced.test.js`<br>`tests/reference.test.js` |
| `referenceElements` | 5 | `tests/reference-tools.test.js` |
| `referenceGraph` | 41 | `tests/reference-tools.test.js` |
| `referenceSheets` | 9 | `tests/reference-sheets.test.js` |
| `reminder` | 6 | `tests/os-notifications.test.js`<br>`tests/reminder.test.js` |
| `renameFolderInSettings` | 0 | `tests/filters.test.js` |
| `renameFolderPath` | 0 | `tests/filters.test.js` |
| `renderAssignmentsSettings` | 0 | — |
| `renderDailySettings` | 0 | — |
| `renderDashboardEmbed` | 0 | `tests/analytics-embed.test.js` |
| `renderMarkdownInto` | 0 | `tests/math-rendering.test.js`<br>`tests/stem-diagrams.test.js` |
| `renderReferenceSettings` | 0 | — |
| `renderSettingsTabs` | 0 | `tests/calendar.test.js` |
| `replaceMyNotes` | 0 | — |
| `resultsExport` | 12 | `tests/practice-sheet.test.js`<br>`tests/results-export.test.js` |
| `resumeQuickSession` | 0 | — |
| `reviewCalendar` | 15 | `tests/review-calendar.test.js` |
| `reviewSession` | 10 | `tests/review-session.test.js` |
| `satMath` | 11 | `tests/sat-math.test.js` |
| `scanQuestionNotes` | 0 | `tests/empty-state.test.js` |
| `schedulerFit` | 8 | `tests/scheduler-fit.test.js` |
| `scopeQuestions` | 0 | `tests/progress.test.js` |
| `secretKeys` | 13 | `tests/secret-keys.test.js`<br>`tests/security-hardening.test.js` |
| `sessionReport` | 5 | `tests/session-report.test.js` |
| `setLastErrorType` | 0 | `tests/grading.test.js` |
| `settingsGlobal` | 7 | `tests/settings-consolidation.test.js` |
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
| `statVals` | 0 | — |
| `statistics` | 8 | `tests/reference-tools.test.js` |
| `stemDiagrams` | 6 | `tests/security-inventory.test.js`<br>`tests/stem-diagrams.test.js` |
| `studyBundle` | 7 | `tests/study-bundle-import.test.js`<br>`tests/study-bundle.test.js` |
| `studyBundleImport` | 4 | `tests/study-bundle-import.test.js` |
| `studyCounters` | 13 | `tests/study-counters.test.js`<br>`tests/study-stats.test.js` |
| `studyMap` | 6 | `tests/study-map.test.js` |
| `studyNudge` | 7 | `tests/settings-consolidation.test.js`<br>`tests/study-nudge.test.js` |
| `studyPlan` | 10 | `tests/core-values.test.js`<br>`tests/study-plan.test.js` |
| `studySkin` | 18 | `tests/study-modes.test.js`<br>`tests/study-skin.test.js` |
| `studyStats` | 18 | `tests/study-stats.test.js` |
| `studyStatus` | 18 | `tests/study-status.test.js` |
| `studyToolSettings` | 3 | `tests/calendar.test.js`<br>`tests/modules.test.js`<br>`tests/reading-library.test.js`<br>`tests/settings-consolidation.test.js`<br>`tests/study-tool-settings.test.js`<br>`tests/table-editor.test.js` |
| `studyTools` | 19 | `tests/core-values.test.js`<br>`tests/study-modules-2.test.js`<br>`tests/study-tools.test.js` |
| `studyWorkspace` | 79 | `tests/core-values.test.js`<br>`tests/quiz-attempts.test.js`<br>`tests/settings-consolidation.test.js`<br>`tests/study-workspace-health.test.js`<br>`tests/study-workspace.test.js`<br>`tests/subject-projects.test.js`<br>`tests/vocab-stats.test.js` |
| `suggestMinutes` | 0 | `tests/stats.test.js` |
| `support` | 6 | `tests/support.test.js` |
| `survey` | 4 | `tests/survey.test.js` |
| `svgSafety` | 1 | `tests/security-hardening.test.js`<br>`tests/security-inventory.test.js` |
| `tableEditor` | 30 | `tests/table-editor.test.js` |
| `tagTimer` | 26 | `tests/tag-timer.test.js` |
| `tally` | 15 | `tests/tally.test.js` |
| `taskTags` | 5 | `tests/task-tags.test.js` |
| `testSections` | 6 | `tests/test-sections.test.js` |
| `text2anki` | 7 | `tests/text2anki-openai.test.js` |
| `textTimer` | 12 | `tests/text-timer.test.js` |
| `thinkFirst` | 6 | `tests/think-first.test.js` |
| `timeBlocks` | 54 | `tests/time-blocks.test.js` |
| `transcript` | 10 | `tests/adaptive-parity.test.js`<br>`tests/ai-write-guard.test.js`<br>`tests/transcript.test.js` |
| `trendBy` | 0 | `tests/stats.test.js` |
| `trendDelta` | 0 | `tests/stats.test.js` |
| `tutorPresets` | 7 | `tests/tutor-presets.test.js` |
| `unpackQuickSession` | 0 | — |
| `unpackTestSession` | 0 | `tests/parameterized.test.js`<br>`tests/stats.test.js` |
| `urlSafety` | 5 | `tests/security-hardening.test.js`<br>`tests/security-inventory.test.js` |
| `vaultSearch` | 8 | `tests/vault-search.test.js` |
| `vaultTaskIndex` | 9 | `tests/vault-task-index.test.js` |
| `vectorField` | 14 | `tests/reference-advanced.test.js` |
| `vectorPanel` | 7 | — |
| `voiceMemo` | 12 | `tests/voice-memo.test.js` |
| `weakSpot` | 4 | `tests/weak-spot.test.js` |
| `weakestRow` | 0 | `tests/stats.test.js` |
| `weekStart` | 0 | `tests/stats.test.js` |
| `weeklyAccuracy` | 0 | `tests/stats.test.js` |
| `weightOf` | 0 | — |
| `welcome` | 12 | `tests/welcome.test.js` |
| `wordnet` | 18 | `tests/wordnet.test.js` |
| `writingSessions` | 11 | `tests/writing-sessions.test.js` |
| `zipWrite` | 2 | `tests/study-bundle-import.test.js` |

## Commands

| Command id | Name | Callback | Test |
| --- | --- | --- | --- |
| `open-practice-view` | Open practice view | `activateView` | `tests/calendar.test.js` |
| `open-welcome` | Open welcome guide | `openWelcome` | `tests/welcome.test.js` |
| `focus-start` | Focus: start a 25-minute session | `startFocusSession` | `tests/focus.test.js` |
| `tag-timer-stop-all` | Tag Timer: stop all running timers | `stopAllTagTimers` | `tests/tag-timer.test.js` |
| `focus-log` | Focus: log study time | `openFocusLog` | `tests/focus.test.js` |
| `study-plan` | Study plan: start for the next exam | `startNextExamPlan` | `tests/core-values.test.js` |
| `open-dashboard` | Open analytics dashboard | `activateInsights` | `tests/modules.test.js` |
| `open-progress` | Open progress dashboard | `activateInsights` | `tests/modules.test.js` |
| `export-results-csv` | Export practice results to CSV | `exportResultsCsv` | `tests/results-export.test.js` |
| `export-practice-sheet` | Export an answer-free practice sheet | `exportPracticeSheet` | `tests/practice-sheet.test.js` |
| `export-review-sheet` | Export an error-log review sheet | `exportReviewSheet` | `tests/practice-sheet.test.js` |
| `import-pdf` | Import questions from a file (PDF, PowerPoint, Word) | `openPdfImport` | `tests/empty-state.test.js` |
| `quick-add` | Quick add questions from pasted text | `openQuickAdd` | `tests/note-quiz-clipboard.test.js` |
| `import-quiz-clipboard` | Import a generated quiz from the clipboard | `openQuizClipboardImport` | `tests/note-quiz-clipboard.test.js` |
| `export-study-bundle` | Export a study bundle (backup of questions and cards) | `exportStudyBundle` | `tests/study-bundle-import.test.js` |
| `import-study-bundle` | Import a study bundle (restore questions and cards) | `importStudyBundle` | `tests/study-bundle-import.test.js` |
| `ai-undo-last-write` | AI: undo the last generated notes | `undoLastAiWriteCommand` | — |
| `ai-undo-agent-edits` | AI: undo the last agent edits | `undoLastAgentEditCommand` | — |
| `course-notes-import` | Import course notes from a lecture or chapter | `openCourseNotesImport` | — |
| `paper-scanner` | Paper scanner: photos to PDF | `openPaperScanner` | `tests/plugin.test.js` |
| `document-review` | Review a document for import | `openDocumentReview` | `tests/plugin.test.js` |
| `ocr-pdf` | OCR a scanned PDF | `openOcr` | `tests/plugin.test.js` |
| `pdf-annotate` | PDF: add an annotation | `openPdfAnnotation` | — |
| `pdf-draw` | PDF: draw with pen or highlighter | `openPdfInk` | `tests/pdf-annotator.test.js` |
| `pdf-edit` | PDF: open the editor (pages and forms) | `openActivePdfEditor` | `tests/pdf-editor-history.test.js` |
| `pdf-export-notes` | PDF: export annotations to Markdown | `exportActivePdfAnnotations` | `tests/pdf-annotator.test.js` |
| `pdf-open-annotations` | PDF: open annotations | `openPdfAnnotations` | — |
| `practice-folder` | Practice a folder... | `practiceFolder` | `tests/plugin.test.js` |
| `practice-current-folder` | Practice the folder of this note | `folderHasQuestions` | `tests/plugin.test.js` |
| `timed-test` | Start a timed test | `activateTest` | `tests/modules.test.js` |
| `open-today` | Open Today | `activateToday` | `tests/plugin.test.js` |
| `quick-practice` | Quick Practice | `activateQuickPractice` | `tests/today.test.js` |
| `daily-quiz` | Daily quiz | `startDailyQuiz` | `tests/daily-quiz.test.js` |
| `dismiss-reminder` | Dismiss today's study reminder | `dismissTodayReminder` | — |
| `study-skin` | Open study cards | `openStudySkin` | — |
| `retry-pending-attempts` | Retry saving offline practice results | `flushPendingAttempts` | `tests/offline.test.js` |
| `open-calendar` | Open calendar | `activateCalendar` | `tests/plugin.test.js` |
| `open-review-calendar` | Open review calendar | `activateReviewCalendar` | `tests/review-calendar.test.js` |
| `review-calendar-add-note` | Review calendar: add this note to review | `addActiveNoteToReview` | `tests/mobile-calendar-agenda.test.js` |
| `review-calendar-add-folder` | Review calendar: add this folder to review | `addActiveFolderToReview` | `tests/mobile-calendar-agenda.test.js` |
| `open-study-stats` | Open study statistics | `activateStudyStats` | `tests/review-calendar.test.js` |
| `open-local-events` | Open local events | `activateLocalEvents` | `tests/review-calendar.test.js` |
| `new-local-event` | Local events: create an event | `openNewLocalEvent` | `tests/review-calendar.test.js` |
| `open-next-due-note` | Note review: open the next due note | `openNextDueNote` | `tests/review-calendar.test.js` |
| `note-review-dock-toggle` | Note review: show or hide the review bar | `toggleNoteReviewDock` | — |
| `save-review-session-report` | Note review: save a session report | `saveReviewSessionReport` | `tests/session-report.test.js` |
| `open-pomodoro` | Open Pomodoro timer | `activatePomodoro` | `tests/plugin.test.js` |
| `pomodoro-start-pause` | Pomodoro: start or pause | `togglePomodoro` | `tests/plugin.test.js` |
| `pomodoro-reset` | Pomodoro: reset the current cycle | `resetPomodoro` | `tests/plugin.test.js` |
| `pomodoro-skip` | Pomodoro: skip the current phase | `skipPomodoro` | `tests/plugin.test.js` |
| `calendar-add-schedule` | Calendar: add an .ics schedule | `openCalendarImport` | — |
| `calendar-note-next-class` | Calendar: create or open the note for the next class | `openNextClassNote` | — |
| `calendar-export` | Calendar: export the visible schedule to .ics | `exportCalendarIcs` | `tests/calendar.test.js` |
| `open-cards` | Open cards | `activateCards` | `tests/cards.test.js` |
| `open-assignments` | Open assignments and grades | `activateAssignments` | `tests/core-values.test.js` |
| `open-study-tools` | Open Study Tools | `activateStudyTools` | `tests/plugin.test.js` |
| `new-cornell-note` | Cornell notes: create a note | `activateStudyTools` | `tests/plugin.test.js` |
| `open-study-workspace` | Open Study Workspace | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `open-time-blocks` | Time blocks: open the planner | `activateStudyWorkspace` | — |
| `open-web-browser` | Web browser: open | `openWebBrowser` | `tests/plugin.test.js` |
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
| `open-task-list` | Open the task list | `activateTaskList` | `tests/plugin.test.js` |
| `open-reading-library` | Reading library: open the bookshelf | `activateStudyWorkspace` | — |
| `new-feynman-cycle` | Feynman Learning: start a cycle | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `build-recall-queue` | Recall Scheduler: build a queue | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `new-topic-plan` | Topic planner: create an exam plan | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `study-flow-capture` | Study Flow: capture a source excerpt | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `subject-manager` | Subject Manager: open subjects | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `open-quiz-index` | Quiz index: scan quizzes and results | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `read-aloud` | Read aloud: speak the active note | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `compile-lecture-notes` | Lecture notes: compile the log into one note | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `course-health` | Course health: check the course list | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `audio-bookmarks` | Audio bookmarks: timestamp an attachment | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `feynman-ai-feedback` | Feynman: get AI feedback on an explanation | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `pdf-annotation-index` | PDF annotations: index the vault sidecars | `activateStudyWorkspace` | `tests/plugin.test.js` |
| `new-assignment` | Assignments: add an assignment | `openNewAssignment` | `tests/plugin.test.js` |
| `new-exam` | Exams: add an exam | `refreshViews` | `tests/core-values.test.js` |
| `calendar-class-attended` | Calendar: mark this class note attended | `classNoteEvent` | — |
| `calendar-class-absent` | Calendar: mark this class note absent | `classNoteEvent` | — |
| `course-overview` | Courses: open the course overview | `openCourseOverview` | `tests/core-values.test.js` |
| `open-reference` | Open Reference | `activateReference` | `tests/plugin.test.js` |
| `open-ap-score` | Open AP score calculator | `openApScore` | `tests/ap-score.test.js` |
| `open-ap-resources` | Open AP resources | `openApResources` | — |
| `open-frq-grader` | AP: open free-response practice and grader | `openFrqGrader` | `tests/frq-review.test.js` |
| `new-frq-note` | AP: create a free-response note | `openNewFrqNote` | — |
| `new-card` | Create a flashcard or vocabulary card | `openNewCard` | `tests/plugin.test.js` |
| `source-recall` | Create a source-anchored recall from selection | `openSourceRecall` | `tests/source-recall.test.js` |
| `generate-cards` | Generate flashcards from this note or selection | `openCardGenerator` | `tests/card-generator.test.js` |
| `generate-spaced-quiz` | Spaced quiz: generate from this note | `moduleOff` | `tests/frq-review.test.js` |
| `auto-anki-send` | Auto Anki: send this note or selection | `moduleOff` | `tests/auto-anki.test.js` |
| `text2anki-send` | Text2Anki: send the selection to Anki | `runText2AnkiCommand` | `tests/text2anki-openai.test.js` |
| `new-image-occlusion` | Cards: create image occlusion cards | `openImageOcclusion` | — |
| `practice-note` | Practice this note only | `practiceNote` | `tests/cards-extract.test.js` |
| `cards-extract-note` | Cards: extract cards from this note | `moduleOff` | `tests/frq-review.test.js` |
| `lecture-practice` | Generate practice from this lecture | `openTranscriptPractice` | — |
| `generate-from-note` | AI: generate practice from this note | `openTranscriptPractice` | `tests/adaptive-parity.test.js` |
| `weak-spot-generate` | AI: generate practice from a weak spot | `openWeakSpotGenerate` | — |
| `verify-answer-ai` | AI: verify the answer for this note | `verifyAnswerWithAi` | `tests/answer-verification.test.js` |
| `verify-calculation-note` | Verify this answer by calculation | `verifyAnswerByCalculation` | `tests/computed-verification.test.js` |
| `verify-calculation-all` | Verify numeric answers by calculation | `verifyAllByCalculation` | — |
| `tag-card-courses` | Cards: tag cards with their folder's course | `tagCardsByCourse` | `tests/cards.test.js` |
| `cards-grade-pending` | Cards: grade pending typed answers | `flushPendingCardGrades` | `tests/cards.test.js` |
| `import-cards` | Cards: import existing decks | `openCardImport` | `tests/plugin.test.js` |
| `cards-import-document` | Cards: extract cards from a PDF or Markdown file | `openDocumentCards` | — |
| `open-study-agent` | Study agent: open the sidebar | `activateAgent` | `tests/agent-view.test.js` |
| `cards-rescan-plain` | Cards: rescan plain Markdown folder | `moduleOff` | `tests/frq-review.test.js` |
| `export-cards` | Cards: export to Quizlet, Anki package, Anki text, Mochi, LearnKit, Kahoot, Blooket or Gimkit | `openCardExport` | — |
| `push-cards-anki` | Cards: push to Anki (AnkiConnect) | `openAnkiConnectPush` | — |
| `push-vault-anki` | Cards: push the whole vault to Anki (AnkiConnect) | `openAnkiConnectPush` | `tests/anki-connect.test.js` |
| `sync-cards-anki` | Cards: sync with Anki (AnkiConnect) | `openAnkiConnectPush` | — |
| `test-couchdb` | Cards: test CouchDB connection | `testCouchDbConnection` | `tests/secret-keys.test.js` |
| `sync-cards-couchdb` | Cards: sync review state with CouchDB | `syncCardsCouchDb` | `tests/couchdb-sync.test.js` |
| `open-due-queue` | Open today's due queue | `openDueQueue` | — |
| `review-notes` | Review notes (whole-note queue) | `openNoteReview` | `tests/note-review.test.js` |
| `spaced-everything-review` | Spaced Everything: review due notes | `moduleOff` | `tests/frq-review.test.js` |
| `spaced-everything-log` | Spaced Everything: log review outcome for this note | `moduleOff` | `tests/frq-review.test.js` |
| `spaced-everything-capture` | Spaced Everything: capture thought | `moduleOff` | `tests/frq-review.test.js` |
| `simple-note-quiz` | Simple note quiz: start on this note | `moduleOff` | `tests/frq-review.test.js` |
| `generate-quiz` | Generate quiz questions from notes | `openQuizGenerator` | `tests/quiz-generator.test.js` |
| `cards-export-archive` | Cards: export a portable archive | `exportCardArchive` | `tests/card-archive.test.js` |
| `cards-import-archive` | Cards: import a portable archive | `openCardArchiveImport` | — |
| `study-nudge-show` | Show today's study nudge | `maybeShowStudyNudge` | `tests/study-nudge.test.js` |
| `course-note-from-template` | Course notes: create a note from a template | `openCourseNoteBuilder` | — |
| `mixed-review` | Start mixed review | `openMixedReview` | `tests/mixed-review.test.js` |
| `manage-study-status` | Manage hidden study items | `openStudyStatusManager` | `tests/today.test.js` |
| `weak-spots` | Show weak spots | `activateInsights` | `tests/modules.test.js` |
| `error-log` | Show error log | `activateInsights` | `tests/modules.test.js` |
| `find-question` | Find a question by ID | inline | `tests/plugin.test.js` |
| `rename-source-id` | Rename old source_question_id properties to official_question_id | `migrateOfficialIds` | `tests/plugin.test.js` |
| `open-ai-assistant` | Open AI assistant (OpenCode) | `activateView` | `tests/calendar.test.js` |
| `next-question` | Next question (from current filters) | `activateView` | `tests/calendar.test.js` |
| `toggle-flag` | Toggle flag on this question | `toggleFlag` | — |
| `mark-question-fixed` | Mark this question fixed | `markQuestionFixed` | `tests/needs-fixing.test.js` |
| `add-fields-this-note` | Add missing tracking properties to this note | `addMissingFields` | — |
| `add-fields-all` | Add missing tracking properties to all question notes | `addMissingFields` | — |
| `repair-review-history` | Repair review counters from history | `repairReviewHistory` | `tests/history.test.js` |

## Gaps (57 groups, 30 commands)

Each entry below is implemented in the bundle but has no test that names it. They are
listed rather than claimed as covered; adding a test removes the row.

- module `AgentEditReviewModal` (0 exports) — no test cites `T.AgentEditReviewModal`.
- module `AssignmentModal` (0 exports) — no test cites `T.AssignmentModal`.
- module `CalculationPreviewModal` (0 exports) — no test cites `T.CalculationPreviewModal`.
- module `CardExtractModal` (0 exports) — no test cites `T.CardExtractModal`.
- module `DocumentReviewModal` (0 exports) — no test cites `T.DocumentReviewModal`.
- module `DueQueueModal` (0 exports) — no test cites `T.DueQueueModal`.
- module `FocusLogModal` (0 exports) — no test cites `T.FocusLogModal`.
- module `LocalEventModal` (0 exports) — no test cites `T.LocalEventModal`.
- module `MAX_OPENCODE_MAJOR` (0 exports) — no test cites `T.MAX_OPENCODE_MAJOR`.
- module `NoteReviewDock` (0 exports) — no test cites `T.NoteReviewDock`.
- module `OcrModal` (0 exports) — no test cites `T.OcrModal`.
- module `PdfAnnotationModal` (0 exports) — no test cites `T.PdfAnnotationModal`.
- module `QUICK_COUNT_OPTIONS` (3 exports) — no test cites `T.QUICK_COUNT_OPTIONS`.
- module `QUICK_TIME_OPTIONS` (3 exports) — no test cites `T.QUICK_TIME_OPTIONS`.
- module `QuestionTrackerSettingTab` (0 exports) — no test cites `T.QuestionTrackerSettingTab`.
- module `QuickAddModal` (0 exports) — no test cites `T.QuickAddModal`.
- module `SpacedEverythingCaptureModal` (0 exports) — no test cites `T.SpacedEverythingCaptureModal`.
- module `StudyStatusModal` (0 exports) — no test cites `T.StudyStatusModal`.
- module `TranscriptPracticeModal` (0 exports) — no test cites `T.TranscriptPracticeModal`.
- module `WeakSpotModal` (0 exports) — no test cites `T.WeakSpotModal`.
- module `WelcomeModal` (0 exports) — no test cites `T.WelcomeModal`.
- module `analyticsEmbed` (11 exports) — no test cites `T.analyticsEmbed`.
- module `apiTurns` (0 exports) — no test cites `T.apiTurns`.
- module `buildGradeSnapshot` (0 exports) — no test cites `T.buildGradeSnapshot`.
- module `buildQuickQueue` (0 exports) — no test cites `T.buildQuickQueue`.
- module `candidateAssetNames` (0 exports) — no test cites `T.candidateAssetNames`.
- module `cloneFilters` (0 exports) — no test cites `T.cloneFilters`.
- module `createQuickSession` (0 exports) — no test cites `T.createQuickSession`.
- module `downloadFile` (0 exports) — no test cites `T.downloadFile`.
- module `extractArchive` (0 exports) — no test cites `T.extractArchive`.
- module `fillDefaults` (0 exports) — no test cites `T.fillDefaults`.
- module `findBinaryIn` (0 exports) — no test cites `T.findBinaryIn`.
- module `fmtDateTime` (0 exports) — no test cites `T.fmtDateTime`.
- module `friendlyApiError` (0 exports) — no test cites `T.friendlyApiError`.
- module `friendlyError` (0 exports) — no test cites `T.friendlyError`.
- module `geometryPanel` (9 exports) — no test cites `T.geometryPanel`.
- module `graph3dPanel` (19 exports) — no test cites `T.graph3dPanel`.
- module `hasFilters` (0 exports) — no test cites `T.hasFilters`.
- module `masteryTrendText` (0 exports) — no test cites `T.masteryTrendText`.
- module `matchFilters` (0 exports) — no test cites `T.matchFilters`.
- module `mergeAuth` (0 exports) — no test cites `T.mergeAuth`.
- module `modelFromString` (0 exports) — no test cites `T.modelFromString`.
- module `normalizeExamReadyPasses` (0 exports) — no test cites `T.normalizeExamReadyPasses`.
- module `packQuickSession` (0 exports) — no test cites `T.packQuickSession`.
- module `partsToTurns` (0 exports) — no test cites `T.partsToTurns`.
- module `pauseQuickSession` (0 exports) — no test cites `T.pauseQuickSession`.
- module `platformTriple` (0 exports) — no test cites `T.platformTriple`.
- module `quickRemainingSeconds` (0 exports) — no test cites `T.quickRemainingSeconds`.
- module `renderAssignmentsSettings` (0 exports) — no test cites `T.renderAssignmentsSettings`.
- module `renderDailySettings` (0 exports) — no test cites `T.renderDailySettings`.
- module `renderReferenceSettings` (0 exports) — no test cites `T.renderReferenceSettings`.
- module `replaceMyNotes` (0 exports) — no test cites `T.replaceMyNotes`.
- module `resumeQuickSession` (0 exports) — no test cites `T.resumeQuickSession`.
- module `statVals` (0 exports) — no test cites `T.statVals`.
- module `unpackQuickSession` (0 exports) — no test cites `T.unpackQuickSession`.
- module `vectorPanel` (7 exports) — no test cites `T.vectorPanel`.
- module `weightOf` (0 exports) — no test cites `T.weightOf`.
- command `ai-undo-last-write` (`undoLastAiWriteCommand`) — no test cites the id or callback.
- command `ai-undo-agent-edits` (`undoLastAgentEditCommand`) — no test cites the id or callback.
- command `course-notes-import` (`openCourseNotesImport`) — no test cites the id or callback.
- command `pdf-annotate` (`openPdfAnnotation`) — no test cites the id or callback.
- command `pdf-open-annotations` (`openPdfAnnotations`) — no test cites the id or callback.
- command `dismiss-reminder` (`dismissTodayReminder`) — no test cites the id or callback.
- command `study-skin` (`openStudySkin`) — no test cites the id or callback.
- command `note-review-dock-toggle` (`toggleNoteReviewDock`) — no test cites the id or callback.
- command `calendar-add-schedule` (`openCalendarImport`) — no test cites the id or callback.
- command `calendar-note-next-class` (`openNextClassNote`) — no test cites the id or callback.
- command `open-time-blocks` (`activateStudyWorkspace`) — no test cites the id or callback.
- command `open-reading-library` (`activateStudyWorkspace`) — no test cites the id or callback.
- command `calendar-class-attended` (`classNoteEvent`) — no test cites the id or callback.
- command `calendar-class-absent` (`classNoteEvent`) — no test cites the id or callback.
- command `open-ap-resources` (`openApResources`) — no test cites the id or callback.
- command `new-frq-note` (`openNewFrqNote`) — no test cites the id or callback.
- command `new-image-occlusion` (`openImageOcclusion`) — no test cites the id or callback.
- command `lecture-practice` (`openTranscriptPractice`) — no test cites the id or callback.
- command `weak-spot-generate` (`openWeakSpotGenerate`) — no test cites the id or callback.
- command `verify-calculation-all` (`verifyAllByCalculation`) — no test cites the id or callback.
- command `cards-import-document` (`openDocumentCards`) — no test cites the id or callback.
- command `export-cards` (`openCardExport`) — no test cites the id or callback.
- command `push-cards-anki` (`openAnkiConnectPush`) — no test cites the id or callback.
- command `sync-cards-anki` (`openAnkiConnectPush`) — no test cites the id or callback.
- command `open-due-queue` (`openDueQueue`) — no test cites the id or callback.
- command `cards-import-archive` (`openCardArchiveImport`) — no test cites the id or callback.
- command `course-note-from-template` (`openCourseNoteBuilder`) — no test cites the id or callback.
- command `toggle-flag` (`toggleFlag`) — no test cites the id or callback.
- command `add-fields-this-note` (`addMissingFields`) — no test cites the id or callback.
- command `add-fields-all` (`addMissingFields`) — no test cites the id or callback.
