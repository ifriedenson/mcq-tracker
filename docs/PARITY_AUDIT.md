# Spaceforge parity audit

**Audit date:** 2026-11-09
**Reference:** `dralkh/spaceforge` at commit [`fb5e4c7`](https://github.com/dralkh/spaceforge/commit/fb5e4c74635cb5d2e4a1b811fdb7866d162f51e3) (`1.2.92`, MIT), plus the README supplied for this pass
**MCQ Tracker:** 1.294.0 (`main`, working tree)
**Scope:** the current Spaceforge README, checked against the shipped code. This replaces the Phase A snapshot from 1.291.2; rows that shipped after that snapshot are marked below.

## Status at a glance

Status meanings: **Done** = the behaviour exists and is reachable; **Partial** = an equivalent exists but a named Spaceforge behaviour is absent or differently scoped; **Deliberate** = a product or storage decision, not an accidental omission; **Gated** = blocked on a provider, credential, fixture or owner decision.

| # | Spaceforge capability | Status | Evidence or remaining difference |
|---|---|---|---|
| 1 | FSRS scheduling | **Done** | `src/fsrs.js`, vendored `src/fsrs-lib.js`, interval previews and per-deck retention. |
| 2 | SM-2 scheduling | **Done** | `src/sm2.js`; selectable for whole notes and decks. |
| 3 | Docked whole-note review bar | **Done** | `src/note-review-dock.js`; grade buttons preview the exact next interval, keyboard grading, skip, postpone, undo, requeue. |
| 4 | Lapse checkpoints and leech handling | **Done** | `src/note-review-dock.js` checkpoint actions; question/card leech flags in `src/study-stats.js` and `src/leech.js`. |
| 5 | Review sidebar with estimates and time target | **Done** | `src/review-sidebar.js`, `src/review-sidebar-model.js`; sort, filter, extra time, Review, postpone, remove, Pomodoro. |
| 6 | Review calendar with estimated completion | **Done** | `src/review-calendar.js`; month grid, selected day, next-7-day workload. |
| 7 | Add note or folder from the file explorer | **Done** | `file-menu` handlers in `src/plugin.js`; note and folder commands. |
| 8 | Folder link hierarchy | **Done** | `src/link-hierarchy.js`; named root, depth-first links, most-linked fallback, subfolder isolation. |
| 9 | Anki-style statistics | **Done** | `src/study-stats.js`; heatmap, streaks, retention by maturity, memory-now, distributions, button mix, leeches, per-deck, durable recall. |
| 10 | Local events with categories and recurrence | **Done** | `src/local-events.js`; seven categories, custom colours, daily/weekly/monthly/yearly, end date, location, description. |
| 11 | Main-calendar integration for local events | **Partial** | Local events are a separate view; imported classes and exams stay in the Calendar view. |
| 12 | AI MCQ generation | **Done** | `src/quiz-generator.js`, `src/quiz-generator-modal.js`; optional BYOK generation, blind verification and note output. |
| 13 | Provider breadth | **Partial** | Ten presets plus any OpenAI-compatible endpoint and OpenCode. Spaceforge names more providers and more agent CLIs; the custom endpoint covers the same class. |
| 14 | Local agent CLIs | **Partial** | OpenCode only (`src/opencode-*`), desktop-guarded and explicitly installed. |
| 15 | Adaptive objective tutor | **Partial** | Study agent **Objective coach** role (`src/tutor-presets.js`) and the local knowledge record. No separate objective rail, per-objective transcript store or automatic transfer test. |
| 16 | Study workspace (Learn / Visualize / Mind map / Summary) | **Partial / equivalent** | `src/study-map.js`, mind map, canvas maps, summaries and the twenty-one study workflows; not the same single tabbed surface. |
| 17 | Cited web lookup | **Deliberate** | Local cited vault search (`src/vault-search.js`) only; no study text is sent to a search provider. |
| 18 | AnkiWeb search | **Partial** | **Cards: find a deck on AnkiWeb** opens the shared-deck search in the browser; the downloaded `.apkg` goes through the existing importer. No in-app site or stored session. |
| 19 | Anki `.apkg`, deck sync and scheduler | **Done** | `src/apkg.js`, `src/apkg-export.js`, `src/anki-connect.js`, `src/cards.js`; AnkiConnect sync is local-only. |
| 20 | Central data file and custom data path | **Deliberate** | Review state stays in each note; settings and local events live in `data.json`. There is no central review database or custom path. |
| 21 | Progress file carried in the vault | **Covered by design** | Review state is already in the notes, so a vault sync that excludes `.obsidian` still carries it. Shared settings do not travel this way. |
| 22 | Data export, import and recovery | **Partial** | Study bundle, card archive, `.apkg`, ICS, CSV, Markdown and JSON where the format supports it. No single whole-plugin JSON envelope. |
| 23 | Pomodoro timer | **Done** | `src/pomodoro.js`; work/break phases, auto-start, sound, sidebar and status bar. |
| 24 | Calendar event detail: location and description | **Done** | Local event record and modal now keep `location` and use the description field; existing `notes` events remain valid. |
| 25 | Commands and keyboard shortcuts | **Done** | More than 200 commands; review next/previous/current, add note/folder, sidebar, events and data export are present. |
| 26 | UI consistency, error handling and logging | **Partial** | `Setting`-based settings, 44 px targets and `Notice`-based failures; no separate leveled logger. |
| 27 | Mobile and responsive review | **Done** | Mobile Practice, agenda layouts, narrow sidebar and layout tests. A physical phone capture was not available. |
| 28 | Recurring notes | **Not in README** | A source-only Spaceforge service, not part of the supplied feature list. Not implemented; no note is created without a command. |
| 29 | First-attempt full-mark deduction | **Partial** | MCQ practice records correctness and attempt history, but not Spaceforge's optional AI-set scoring rule. |
| 30 | Word-count/reading-time cache | **Partial** | Review estimates use recorded times or a configured fallback; no vault-wide cache. |

## What closed since the 1.291.2 Phase A audit

- The **review sidebar** shipped (`src/review-sidebar.js`, `src/review-sidebar-model.js`, `src/review-sidebar-settings.js`), with the extra-time target, sorting, filtering, row actions and Pomodoro.
- **Add to review** is in the file explorer for notes and folders, and the **link hierarchy** follows a folder's main note and its outgoing links.
- **Together AI** is a preset; **Pomodoro sound** is implemented.
- **Local events** gained location and a description field; the event record still normalizes existing events without those fields.
- **AnkiWeb discovery** is reachable from the command palette and Cards settings without a network request from the plugin.
- The **Study agent** has an **Objective coach** role for an objective-by-objective session.

## Remaining differences and why

1. **Objective tutor rail.** A complete port needs an objective data model, per-objective conversation storage, AI grading, a transfer test and a report writer. The current role covers the workflow in chat without a second store. Gated by `plan.md` §11 decision 4.
2. **Cited web lookup.** The plugin stays offline for study text. Local cited vault search is the shipped path. Gated by §11 decision 5.
3. **AnkiWeb inside the plugin.** The plugin opens AnkiWeb in the browser and imports the `.apkg`; it does not store a password or session. This is the privacy-preserving equivalent.
4. **Central data file / custom path.** Note-backed review state is a deliberate architecture. A central mirror would be a second source of truth and a migration risk. The portable study bundle is the escape hatch. Gated by §11 decision 10.
5. **Generic agent CLIs.** OpenCode is the only local agent runtime. Other CLIs would execute arbitrary local programs and need a security decision. Gated by the same boundary as `plan.md` §11.
6. **Event integration in the main calendar.** Local events are deliberately separate from imported `.ics` feeds so a feed refresh cannot overwrite user-created events. The separate view is the current trade-off.
7. **First-attempt scoring rule.** Practice is single-attempt by design; the option would only apply to a new AI-set runner. It is not implemented to avoid changing existing grading.
8. **Recurring notes.** Not in the supplied README. It is a source-only service and remains unimplemented.

## Verification

- `node --test` covers the plugin, review sidebar, review calendar, study statistics, local events, link hierarchy, cards, AnkiConnect and capability inventory.
- `npm run check` verifies there is no dynamic code, the vendored PDF library is unchanged, `main.js` matches the source and the plan status is consistent.
- The Objective coach and AnkiWeb finder are covered by focused tests in `tests/plugin.test.js`; local event location is covered in `tests/local-events.test.js`.
- Exact test and bundle counts are recorded in the release notes for the version that ships this audit. This document does not claim a real Obsidian or phone visual pass.

## Licence note

Spaceforge is MIT. No source file was copied in this audit. The existing `src/link-hierarchy.js` adapts the MIT-licensed `LinkAnalyzer` idea and is attributed in the source and `NOTICES.md`; the other rows are feature descriptions and original implementations.
