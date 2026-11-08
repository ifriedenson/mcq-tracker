# Spaceforge parity audit

**Audit date:** 2026-11-08
**Reference:** `dralkh/spaceforge` at commit [`fb5e4c7`](https://github.com/dralkh/spaceforge/commit/fb5e4c74635cb5d2e4a1b811fdb7866d162f51e3) (`1.2.92`, MIT)
**MCQ Tracker baseline:** `feat/spaceforge-parity`, working tree at 1.291.2
**Scope:** every behaviour and screen reachable from Spaceforge's source, not only its README. This is the Phase A record; implementation status below describes the baseline before the parity work in this branch.

## Executive summary

Spaceforge is a spaced-repetition and study workspace centred on one central `data.json` state file. MCQ Tracker already has strong equivalents for most of the learning engine: FSRS and clean-room SM-2, card scheduling, a study workspace, statistics, a Pomodoro timer, AI providers, and a local calendar/event store. The real gaps are not "write a scheduler from scratch"; they are:

1. **Review workflow shape.** Spaceforge has one review sidebar with the due list, estimates, an add/replace time override, sorting, postpone/remove and next/previous navigation. MCQ Tracker has a docked whole-note grading bar plus separate Review calendar and Local events views.
2. **Adding notes from the file explorer.** MCQ Tracker exposes add-note/add-folder commands and settings buttons, but its `file-menu` does not offer them. Its folder detection picks the most-linked note; it does not follow the folder's main-note link chain or exclude the linked note's own folder as Spaceforge does.
3. **Central persistence.** Spaceforge stores schedules, history, MCQ sets and events in `data.json`. MCQ Tracker stores review state in frontmatter and events in `settings.localEvents`; MCQs are notes. A naive replacement would be a destructive data migration, so this audit specifies a mirror-first migration with frontmatter retained.
4. **Calendar event integration.** Local events already have CRUD, categories, colours and recurrence, but they live in a separate view and lack Spaceforge's location/description fields, quick-create affordances and upcoming-events list inside the main calendar.
5. **Provider breadth.** OpenAI, OpenRouter, Gemini, Claude and Ollama presets exist. Together is absent. Keys are held per provider, but the UI edits only the selected provider.
6. **Operational polish.** There is no central data path/migration/import-export/integrity command set, no level-based logger, and only a small number of `console.error` calls. Pomodoro has no completion sound.

The detailed rows below are the implementation contract for Phase B.

## Feature matrix

Status meanings: **Done** = the behaviour exists and can be reached; **Partial** = an equivalent exists but a named Spaceforge behaviour is absent or differently scoped; **Missing** = not present; **N/A** = TypeScript/tooling-only and does not apply to this JavaScript repo.

| # | Spaceforge feature | Spaceforge files | MCQ Tracker status | Gap notes | Planned approach |
|---|---|---|---|---|---|
| 1 | FSRS scheduler | `services/fsrs-schedule-service.ts`, `services/review-schedule-service.ts` | **Done** | `src/fsrs.js` adapts vendored `src/fsrs-lib.js`; retention is exposed globally and per deck, with fit/train helpers. | Keep; add editable FSRS parameters only after the review-store work. |
| 2 | Enhanced SM-2, including overdue handling | `services/review-schedule-service.ts`, `models/review-schedule.ts` | **Done** | `src/sm2.js` is a clean-room adapter; overdue notes are handled by the queue and next-review date. | Keep; verify switching tests as the global selector is widened. |
| 3 | Algorithm selector that cannot corrupt schedules | `ui/settings-tab.ts`, `models/settings.ts` | **Partial** | MCQ global selector is `ladder` or `fsrs`; `sm2` is selectable per deck. Switching preserves state, but there is no global SM-2 choice. | Add `sm2` to the global selector with a lossless state-preservation test. |
| 4 | UTC date calculations everywhere | `utils/dates.ts`, `models/review-schedule.ts` | **Partial** | Local events use UTC date arithmetic (`src/local-events.js`); review-calendar/note-review use local `YYYY-MM-DD` keys (`src/review-calendar.js`, `src/note-review.js`). | Introduce shared UTC day helpers and use them for new schedule/calendar paths; migrate existing date-only values without shifting a day. |
| 5 | Manual rescheduling to a specific date | `services/review-schedule-service.ts` | **Partial** | FSRS library exposes reschedule support, but no user-facing "set next review date" flow was found. | Add a note-review reschedule modal/command; write through the existing note-review/frontmatter path. |
| 6 | Add current note from the file explorer | `main.ts` file-menu handler | **Partial** | Commands exist (`review-calendar-add-note`), but the file-menu handler at `src/plugin.js` ~1001 does not add a review item for `.md` notes. | Add a file-menu item for Markdown notes; reuse `addNoteToReview`. |
| 7 | Add folder from the file explorer | `main.ts` folder menu | **Partial** | Folder menu only offers "Practice this folder"; add-folder command exists. | Add "Add to review schedule" for folders; reuse `addFolderToReview`. |
| 8 | Folder link hierarchy: named main note is root, serial links, most-linked fallback, exclude linked note's own folder | `utils/link-analyzer.ts` | **Partial** | `folderMainNote`/`pickMainNote` choose a root by link count only; no serial traversal and no folder exclusion. | Add a pure `buildReviewHierarchy` module and use it when adding a folder; tests for named root, fallback, cycle, missing links and own-folder exclusion. |
| 9 | Dedicated review sidebar | `ui/sidebar-view.ts`, `ui/sidebar/list-view-renderer.ts` | **Missing** | Closest surfaces: `src/note-review-dock.js` (grading bar), `src/review-calendar-view.js` (calendar), `src/review-settings.js`. | Add a real sidebar `ItemView` with List/Calendar tabs; reuse `getNoteQueue`, `reviewCalendarSnapshot`, cards and Pomodoro snapshot. |
| 10 | Upcoming and due review list with estimated completion times | `ui/sidebar/list-view-renderer.ts`, `utils/estimation.ts` | **Partial** | Review calendar estimates notes/cards from recorded time or a fixed fallback; no word-count estimator and no list grouped by due state in a sidebar. | Feed existing estimates into the sidebar; add a word-count cache only if the estimate is materially better. |
| 11 | Manual time override (hours/minutes, add or replace) | `ui/sidebar/list-view-renderer.ts`, `models/plugin-data.ts` | **Missing** | No override fields. | Add bounded `overrideHours`/`overrideMinutes`/`addToEstimation` state to the review-view settings; show the resulting target in the sidebar. |
| 12 | Click a note, review button, rating buttons, next/previous with configurable hotkeys | `ui/sidebar-view.ts`, `controllers/review-navigation-controller.ts`, `models/review-flow.ts` | **Partial** | Dock supports grading keys, `openNextDueNote` exists; no sidebar review button or previous-note command in the requested naming. | Reuse `NoteReviewModal`/dock grading; add next/previous commands and focusable sidebar rows. |
| 13 | Sorting/filtering, postpone/remove, informative note items (MCQ icon, algorithm, due state) | `ui/sidebar/note-item-renderer.ts`, `ui/sidebar/list-view-renderer.ts` | **Partial** | Queue has priority and due sorting; no postpone/remove controls in a review list; algorithm/due metadata is not shown per row. | Add view-local sort/filter state and row actions; write postpone/remove through the existing scheduler path. |
| 14 | AI providers: OpenAI, OpenRouter, Ollama, Gemini, Claude, Together | `api/*-service.ts`, `api/provider-registry.ts` | **Partial** | `src/api-client.js` has OpenAI, OpenRouter, Google Gemini, Anthropic/Claude and Ollama plus local presets; Together is absent. | Add a Together OpenAI-compatible preset and provider test; keep per-provider key/base/model maps. |
| 15 | Generate MCQs from note content, central store, review flow | `services/mcq-service.ts`, `api/mcq-generation-service.ts`, `ui/review-mcq-runner.ts` | **Partial** | AI question/card generation exists (`src/quiz-generator.js`, `src/quiz-generator-modal.js`) and generated items are notes; no central `mcqSets` store or Spaceforge runner. | Preserve note generation; add a central set index for new AI sets, then make the review runner read both. |
| 16 | Scoring: incorrect first attempt deducts full marks; configurable | `models/mcq-scoring.ts` | **Partial** | Practice records correctness and attempt history; no Spaceforge-style first-attempt full-mark deduction setting was found. | Add an opt-in scoring rule to the AI MCQ session only; do not change existing question grading. |
| 17 | Pomodoro start/pause/reset/skip, phases, durations, sessions-until-long-break, sound | `services/pomodoro-service.ts`, `ui/sidebar/pomodoro-ui-manager.ts` | **Partial** | `src/pomodoro.js` implements the state machine and settings; state survives re-render, but there is no completion sound setting. | Add `soundEnabled` and a small Web Audio chime guarded for mobile/unsupported runtimes. |
| 18 | Review calendar with per-day counts and interactive cells | `ui/calendar-view.ts`, `services/review-schedule-service.ts` | **Done** | `src/review-calendar.js` + `src/review-calendar-view.js` provide counts, workload, month grid and day selection. | Keep; align UTC semantics with row 4. |
| 19 | Calendar events CRUD, categories, custom colours, recurrence, delete without confirmation | `models/calendar-event.ts`, `services/calendar-event-service.ts`, `ui/event-modal.ts` | **Partial** | `src/local-events.js`/`local-events-view.js` implement CRUD, seven categories, colours, daily/weekly/monthly/yearly recurrence and delete. Missing location/description separation, double-click edit, hover "+" and main-calendar integration. | Extend the normalized event shape and modal; add quick-create and upcoming list; embed events in the main calendar. |
| 20 | Events as coloured tabs in calendar cells, hover "+" per day, header plus, upcoming list grouped by day | `ui/calendar-view.ts`, `ui/upcoming-events.ts` | **Missing** | Local events render only in `LocalEventsView`; main `CalendarView` renders imported classes/exams. | Add a shared event layer to `calendar-view.js`, reusing `eventsOnDate`/`eventsInRange`; keep classes/exams separate. |
| 21 | Central storage for schedules, MCQs and events | `models/plugin-data.ts`, `data-storage.ts` | **Missing** | MCQ review state is frontmatter; events are settings; MCQs are notes. | Mirror-first central store (below), never delete frontmatter during migration. |
| 22 | Custom data path with automatic migration | `utils/paths.ts`, `main.ts`, `data-storage.ts` | **Missing** | No custom path setting. | Add path setting plus atomic write/backup/validate; first migration copies, then marks complete only after read-back. |
| 23 | Import/export and integrity verification, orphan cleanup, fail-safe backup | `ui/data-recovery-modal.ts`, `data-storage.ts`, `utils/data-file.ts` | **Partial** | Study bundle, card archive, CouchDB sync and ICS export exist; no whole-plugin data export/import or orphan cleanup. | Add JSON bundle export/import and an integrity report; use adapter writes and a pre-migration backup. |
| 24 | Settings sections: General, Scheduling, MCQ Generation, Pomodoro, Calendar Events, Data Management | `ui/settings-tab.ts` | **Partial** | Existing category/page settings already cover General, Review, Cards, Calendar, Pomodoro, Local events and AI, but names/grouping differ. | Add a parity "Review and data" page group or map existing pages; use Obsidian `Setting` throughout. |
| 25 | Commands: next/previous review, review current, add note/folder, open sidebar, create event | `main.ts` | **Partial** | Add note/folder, open next, create event and next-class exist. No previous-note, review-current, or dedicated open-sidebar IDs. | Add aliases/commands without removing existing IDs. |
| 26 | Review flow: dock/window/sidebar, undo, skip, leech, interval preview | `models/review-flow.ts`, `controllers/review-flow-controller.ts`, `ui/review-strip.ts` | **Partial** | MCQ dock/modal supports grading, keyboard, requeue, lapse checkpoint and interval buttons. No window/split placement chooser. | Reuse the dock in the new sidebar; add placement only if the public API supports it cleanly. |
| 27 | Statistics dashboard and charts | `ui/stats-view.ts`, `services/stats-service.ts` | **Done** | `src/study-stats.js`, `src/study-stats-view.js`, `src/insights-view.js`. | Keep; no port required. |
| 28 | Study workspace/adaptive tutor, objectives, sessions and reports | `services/study-session-service.ts`, `ui/study-panel.ts`, `models/study*.ts` | **Partial** | MCQ has Study agent chat, plan-then-act, notes, reading companions and many study tools; not the same objective/rubric transcript model. | Map objective/rubric concepts onto the existing Study agent; do not replace its chat or safety gates. |
| 29 | Anki ecosystem: AnkiConnect, AnkiWeb, `.apkg`, deck sync, Anki scheduler | `services/anki-*.ts`, `api/anki/*`, `models/anki*.ts` | **Partial** | MCQ has `.apkg` export/import helpers, AnkiConnect and auto-Anki; no AnkiWeb browser or full deck sync. | Preserve existing paths; add AnkiWeb only if MIT-compatible and network-opt-in. |
| 30 | Deck store, card editor, batch review, Anki-style sessions | `services/deck-store.ts`, `ui/card-editor-panel.ts`, `ui/batch-review-modal.ts` | **Partial** | Cards view and card modal exist; no dedicated batch-review modal. | Add batch actions to the existing Cards view before a new store. |
| 31 | Recurring notes | `services/recurring-notes-service.ts` | **Missing** | No recurring-note service found. | Add an opt-in note recurrence model; do not create notes without confirmation. |
| 32 | Data recovery and progress mirror | `ui/data-recovery-modal.ts`, `services/progress-mirror.ts` | **Partial** | CouchDB card sync and study bundle exist; no recovery modal or portable progress mirror. | Reuse the central bundle and integrity report; add opt-in mirror only after backup tests. |
| 33 | Local CLI providers | `api/cli/*`, `api/cli-service.ts` | **Missing** | MCQ has OpenCode only (`src/opencode-*`). | Keep OpenCode; add CLI providers only as desktop-guarded, explicit opt-ins. |
| 34 | Study plans, visual boards, mind maps, charts | `services/study-plan-service.ts`, `ui/study-visual-*.ts`, `ui/study-mindmap.ts` | **Partial** | MCQ has mind maps, canvas tools, STEM graphs and study plans, but different data/UX. | Preserve MCQ tools; map shared launch points rather than copying Spaceforge's visual code. |
| 35 | Web search for study | `services/study-web-search-service.ts` | **Missing** | `src/web-browser.js` exists but is an in-app browser, not a cited study search service. | Defer; requires a search provider and is outside the current privacy boundary. |
| 36 | Reading-time/word-count cache | `services/word-count-cache.ts`, `utils/estimation.ts` | **Partial** | Review estimates use recorded averages/fallback; no vault-wide word-count cache. | Add a small cache only if the sidebar estimate is visibly wrong. |
| 37 | Leech handling | `models/review-flow.ts`, `services/review-schedule-service.ts` | **Done** | `src/note-review-dock.js` lapse checkpoint; `src/study-stats.js` leeches. | Keep. |
| 38 | Mobile/responsive review, calendar and settings | `styles/responsive.css`, `ui/sidebar/*` | **Partial** | MCQ has extensive mobile layouts and 44px targets, but the new sidebar does not exist yet. | Build the sidebar with the existing `qt-*` responsive tokens and keyboard/touch fallbacks. |
| 39 | Error handling and no console noise | `main.ts`, services | **Partial** | Notices are used widely; `exam-view.js` has `console.error`; vendored FSRS warns. | Add a small leveled `src/logger.js`; keep errors actionable and route user-facing failures to `Notice`. |
| 40 | Focused TypeScript `include` | `tsconfig.json` | **N/A** | MCQ Tracker is dependency-free JavaScript built by `scripts/build.js`; there is no TypeScript build. | Do not add TypeScript or a bundler solely for parity; document the deliberate deviation. |

## Features MCQ Tracker has that Spaceforge does not

These are protected. No parity change may remove, rename or silently alter them:

- MCQ/FRQ practice, timed multi-section tests, Bluebook testing tools, confidence calibration, error tags, weak-spot practice and exam-ready tracking (`src/practice-view.js`, `src/exam-view.js`, `src/practice-tools.js`, `src/frq.js`).
- PDF annotation, PDF editor, PDF++ embedding, OCR, paper scanner, document review and PDF-to-LaTeX import (`src/pdf-*`, `src/ocr.js`, `src/paper-scanner.js`).
- The Study agent chat, OpenCode integration, Quick Ask/Chat, projects, memory, cost estimates, chat PDFs, plan-then-act and write-review gates (`src/chat-*`, `src/agent-*`, `src/opencode-*`).
- Course/class calendar, `.ics` import/export, attendance, assignments, grades, GPA and course health (`src/calendar-*`, `src/assignments*`, `src/course-*`).
- The wider Study Workspace tool set (reading plans, tag timers, Cornell notes, Feynman, lecture log, task list, citations, reference sheets, calculators, graphs, web browser, etc.).
- Card formats and exports (cloze, image occlusion, vocabulary, Anki `.apkg`, Mochi, LearnKit, Quizlet text) and CouchDB card sync.
- Cram/Mother cram, whole-note review, Spaced Everything, daily quiz, Quick Practice and Today.
- Obsidian mobile layouts and the existing `qt-*` design language.

## Data models

### Spaceforge

`SpaceforgePluginData` (`models/plugin-data.ts`) is one `data.json` document with two branches:

```text
{ settings: SpaceforgeSettings,
  pluginState: {
    schedules: { [notePath]: ReviewSchedule },
    history: ReviewHistoryItem[],
    reviewSessions, mcqSets, mcqSessions,
    customNoteOrder, lastLinkAnalysisTimestamp,
    pomodoro* state, calendarEvents: { [id]: CalendarEvent },
    studyPlans, studyProgress, studySessions,
    deckSitting, noteRun, reviewDayStats, deckHistory
  } }
```

A `ReviewSchedule` is timestamp-based (`nextReviewDate`, `lastReviewDate`), carries SM-2 ease/interval/repetitions and optional `fsrsData`, an algorithm name, leech fields and optional recurrence. `CalendarEvent` uses a millisecond `date`, optional `time`, category/color, recurrence/end date, all-day/location/description and timestamps (`models/calendar-event.ts`). MCQs are `MCQSet` records keyed by note, with sessions stored separately (`models/mcq.ts`, `services/mcq-service.ts`).

### MCQ Tracker

- **Review state:** per note in YAML frontmatter (`attempts`, `correct_count`, `streak`, `next_review`, `history`, `srs`, and card-specific `sm2`/FSRS fields). `src/notes.js` builds history rows; `src/plugin.js` writes through `processFrontMatter`.
- **Events:** `settings.localEvents` in `data.json`, with date-only `YYYY-MM-DD` strings, `startTime`/`endTime`, category/color, `repeat`/`repeatEvery`/`repeatUntil`, notes and timestamps (`src/local-events.js`).
- **MCQs/cards:** ordinary Markdown notes with tracking properties; generated sets are not stored centrally.
- **Study/chat/Pomodoro:** `settings` slices in `data.json`; chat sessions are local arrays.
- **Portable files:** study bundles, card archives, `.apkg`, ICS and Markdown exports.

### Migration plan (non-destructive, staged)

1. **Snapshot first.** Before any write, copy the current `data.json` to `data.json.mcq-tracker-backup-<ISO timestamp>` through the vault adapter and verify the copy is readable. A failed backup aborts the migration.
2. **Add a versioned central mirror, not a replacement.** New `reviewStore` / `mcqStore` / `eventStore` records live in a versioned `mcq-tracker/parity-state.json` (default; configurable). The store is a projection/index keyed by stable note path plus a content hash. Frontmatter remains authoritative until an explicit future cutover.
3. **Seed from existing data.** Read every question, card and whole-note candidate; copy schedule/history fields into the mirror; copy `settings.localEvents` into `eventStore`; index generated MCQ sets. Record `source: "frontmatter" | "settings" | "note"` and `schema: 1`.
4. **Write-through both stores.** Existing review writes continue to frontmatter and also update the mirror. Events write to the mirror and keep the legacy `settings.localEvents` view until a read-back proves parity. This preserves existing users' data even if the new file is removed.
5. **Conflict policy.** Last-write wins on the same path only when the mirror's `sourceHash` matches the note; if the note changed outside the plugin, re-seed that path instead of overwriting it. Never delete a schedule because a note is temporarily missing; mark it orphaned and require an explicit cleanup action.
6. **Atomic writes.** Write to `*.tmp`, fsync where available, read back/validate, then replace. Keep one previous file. Refuse a path outside the vault; cap file size and record counts.
7. **Custom-path switch.** Changing the path copies the current store, validates it, and only then updates the setting. The old file is retained. A missing/invalid target is reported and the old path stays active.
8. **Import/export.** Export a single JSON envelope with `schema`, `exportedAt`, settings sans secrets, `reviewStore`, `eventStore`, `mcqStore` and integrity metadata. Import validates the whole envelope before writing; a partial import is refused.
9. **Rollback.** Keep frontmatter/legacy settings as the rollback source. A `Restore from backup` action restores only the central files, never deletes notes. Document the exact steps in `docs/PARITY_REPORT.md`.

This plan deliberately does **not** move review state out of frontmatter in the first migration. That would reshape user data irreversibly and is prohibited by the project's data-preservation rule.

## Screen and interaction differences

| Spaceforge surface | Spaceforge behaviour | MCQ Tracker today | Required parity direction |
|---|---|---|---|
| Review sidebar | One sidebar with a persistent header, List/Calendar panes, due/upcoming groups, Pomodoro, estimates and a Review action; follows an active run. | Docked review bar under the note; separate Review calendar and Local events views; status-bar Pomodoro. | New sidebar view with List/Calendar tabs and a Pomodoro section; reuse dock grading and existing estimates. |
| Review strip/bar | Compact grades, interval previews, keyboard hints, responsive 2x2/2x3 palettes. | Dock already has responsive grade layout and keyboard handling. | Reuse; add a clear "Review" entry point in the sidebar. |
| Note item | Title, due label, scheduler, estimate, MCQ indicator, run position, postpone/remove. | Calendar rows show title/kind/set/due/minutes; no algorithm icon or actions. | Add metadata and row actions without changing card/question notes. |
| Review calendar | Month grid with counts, selected day, upcoming events. | Review calendar has month grid/counts, next-7 workload and selected-day list. | Add shared UTC helpers and event layering; keep the existing accessibility. |
| Event modal | Title, description, date, time, location, category/color, recurrence, delete without confirmation, validation. | Local event modal has title/date/start/end/category/color/repeat/notes; no location/description split, no all-day label, no upcoming list. | Extend the modal and normalized record; keep quick delete. |
| Main calendar | Month grid with class/exam events plus local event tabs and quick "+" per day; header plus; upcoming list. | Main calendar shows imported classes/exams; local events are a separate view. | Add a shared local-event layer and quick-create; do not merge imported feed data into the event store. |
| Settings | One settings tab with General/Scheduling/MCQ/Pomodoro/Calendar/Data sections using `Setting`. | Category/page navigation with many pages; all controls use `Setting`. | Add a parity group/page, keep the existing navigation and MCQ-specific pages. |
| MCQ runner | Generate, run and score a set; first wrong answer forfeits the mark; suggested rating. | Quiz generator writes notes and Practice runs questions with existing scoring. | Add an opt-in AI-set runner; do not change existing question scoring. |
| Data recovery | Backup/recover/repair/integrity modal. | Study bundle/import/export and CouchDB sync; no recovery wizard. | Add central store export/import and integrity report with explicit restore. |
| Study panel | Objective chooser, tabs, per-objective transcripts, reports. | Study agent chat and many study tools; different model. | Preserve; add only shared launch points and objective metadata where safe. |
| AnkiWeb search | Search, inspect and import shared decks. | AnkiConnect and `.apkg` helpers; no web search. | Defer until network/terms review; not required for the local review loop. |

## UX and design-token plan

The existing `qt-*` classes and Obsidian variables are the identity. Do not import Spaceforge CSS. New surfaces must:

- use a small local token layer (`--qt-space-1..4`, `--qt-radius-*`, type sizes, focus ring) built from the current palette, then map theme colours to Obsidian variables;
- use 44px minimum touch targets and visible `:focus-visible` rings;
- provide keyboard activation for every clickable row, not hover-only actions;
- keep light/dark and community themes working by using `--background-*`, `--text-*` and `--interactive-*`;
- keep all new classes prefixed `qt-`;
- use `Notice` for user-facing failures, with a leveled logger for diagnostics;
- make the sidebar usable at 268/340/480/826 px, matching the existing evidence sizes.

## Definition-of-done mapping

The audit is complete when every row above has an owner, a target release and a verification method. The implementation order is the user's order:

1. Data layer + migration + settings skeleton.
2. Scheduling engine/date helpers + tests.
3. Add-to-schedule context menus and hierarchy.
4. Review sidebar and review flow.
5. AI provider/scoring.
6. Pomodoro sound.
7. Calendar events integration.
8. UX/accessibility/mobile.
9. Docs, credits, version bump, final report and smoke test.

No row may be marked Done on the strength of a source diff; each needs the test or rendered evidence named in the final report.
