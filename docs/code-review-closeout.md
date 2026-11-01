# `code-review.md` close-out

**Date:** November 1, 2026  
**Version:** 1.169.0  
**Scope:** every concrete finding in `code-review.md` (Claude/connector G1–G7 and the GLM capability review) is classified exactly once below.

**Status vocabulary**

- **Implemented and tested** — the behavior is in runtime code under `src/`, reachable from a user path, and a test fails if that behavior regresses.
- **Not code-fixable** — the finding requires data, a schema, an external contract, or a real Obsidian/device observation that this repository cannot supply. The specific missing input is stated in the row.

## Verification

- `npm test` — **1,325 pass / 0 fail**.
- `npm run check` — no dynamic code in **230 files**; `main.js` is the current build.
- `git diff --check` — clean.
- Packaged as **1.169.0**; the release workflow publishes `main.js`, `manifest.json` and `styles.css`.
- No real-Obsidian or device verification is claimed; those observations are listed separately at the end.

## Connector review (G1–G7)

| Item | Status | Reachable behavior and test evidence |
|---|---|---|
| **G1 — shared course identity** | **Implemented and tested.** | `src/course-identity.js` resolves registry name, code, folder, id and aliases, with raw-string fallback. Subject/course dashboard, course health, assignment rows, Today and exam lookups use it. The Course Settings name field calls `renameCalendarCourse()`, which preserves the old name and code in `aliases`, invalidates the calendar cache, saves and refreshes views. Tests: `tests/core-values.test.js` (G1 and G1 plugin), `tests/study-workspace.test.js`. |
| **G2 — app-created exam model** | **Implemented and tested.** | `src/exams.js` merges ICS/Full Calendar events, `type: exam` assignment notes and Topic-planner dates; it carries optional topics, time, weight, type, source and course+date de-duplication. **Add exam** creates a normal assignment note. `plugin.getExams()` feeds exam caps, study plans, course health, Today and planner seeding. The manual-exam acceptance path is now exercised directly: `tests/exam-schedule.test.js` creates a `type: exam` assignment with no calendar event and asserts the attempt is capped at T-3. Today's next-exam card reads the merged list and preserves the countdown. Tests: `tests/exam-schedule.test.js`, `tests/core-values.test.js` (G2 and Today merged-exam), `tests/study-plan.test.js`, `tests/today.test.js`. |
| **G3 — study plan for every exam, with non-question work** | **Implemented and tested.** | `studyPlans()` covers the configured window (default 30 days), keeps a plan with `readiness: null` when there are no questions, and includes lectures, readings, planner passes, assignments, work items and readiness evidence. `buildExamPlan()` limits lectures to those after the previous exam or matching the exam's topics. Tests: `tests/core-values.test.js` (G3 and G3 plugin), `tests/study-plan.test.js`. |
| **G4 — lectures connected to calendar and exams** | **Implemented and tested.** | Calendar/class-note attendance is idempotent; lectures carry `topicList` and `notePath`; the optional after-class prompt is off by default; lecture topics feed exam-plan filtering; generated practice links back with `lecture_id`/`lecture_path`. Tests: `tests/core-values.test.js` (G4 and G4 prompt), `tests/lecture-links.test.js`. |
| **G5 — readings tied to courses, exams and deadlines** | **Implemented and tested.** | Reading plans/books carry optional `course`, `exam` and `due`; `readingStatus()` exposes pages remaining, pages behind and due date. Today, course overview and study plans consume them. `indexReadingPlans()` scans fenced `reading-plan` blocks at `onLayoutReady`, so Today and course plans work before the block renders; rendered blocks still register immediately. Tests: `tests/reading-plan.test.js` (including startup index), `tests/core-values.test.js` (G5 and G5 Today). |
| **G6 — one course overview** | **Implemented and tested.** | `courseOverview()` combines next exam (countdown, readiness, evidence, topics), topics remaining, lectures since the last exam, readings, assignments, open tasks and grades; empty sections are hidden. Exam rows include assignment paths and evidence; reading and task rows carry source paths. `CourseOverviewModal` shows **Open** for every actionable row and routes reading, plan, task, assignment and grade destinations. The nearest-exam Today plan card has a **Course overview** button, so the panel is reachable without a duplicate Today card. Tests: `tests/core-values.test.js` (G6 and G6 UI). |
| **G7 — smaller gaps** | **Implemented and tested.** | False-positive titles are covered by keyword guards plus the “not an exam” override; SAT/AP are first-class exam types; course health reads the merged exam list; the registry is the single source for exam dates. Tests: `tests/core-values.test.js` (G2/G7), `tests/exam-schedule.test.js`. |

## GLM capability review

### Capability 1 — what you need to learn

| Finding | Status |
|---|---|
| Readings invisible in the unified picture | **Implemented and tested.** Today readings card, course-overview rows and study-plan input; startup indexing fixes the restart-before-render case. `tests/reading-plan.test.js`, `tests/core-values.test.js`. |
| No per-lecture state | **Implemented and tested.** Lecture rows carry `processed`, `processedOn` and `processedPath`; generated cards/questions carry `lecture_id`/`lecture_path`; the lecture log resolves generated counts and offers **Generate practice**. `tests/lecture-links.test.js`. |
| “What's on the exam” only inferred | **Implemented and tested.** Exam `topics` and `weight` flow through `listExams()`, planner seeding, plan filtering and the course overview. `tests/core-values.test.js`. |
| Two course registries do not share data | **Implemented and tested.** `courseIdentity` resolves the registry for dashboard, health, assignment, Today and exam readers; registry credits, folder, colour and name flow through the resolver with legacy fallback. `tests/core-values.test.js`, `tests/study-workspace.test.js`. |
| Syllabus template is a static skeleton, not parsed | **Not code-fixable.** The review supplies no syllabus schema or authoritative mapping from prose lines to `topics`/`weight`, and does not say whether a parse writes the course registry or only previews. Code cannot decide which line wins when a syllabus contains multiple grading policies, duplicate headings or several test dates; that would be a new import subsystem plus a missing schema. |
| Reading progress key follows `title\|start\|target` | **Not code-fixable without a new identity store.** Date edits no longer orphan progress because the key uses a stable title key; an optional `id:` preserves identity explicitly. After a title edit, a Markdown block has no durable ID, so code cannot distinguish a rename from a different book. Automatic migration would need a persisted alias map keyed by source and a matching rule for multiple plans. `tests/reading-plan.test.js` covers the stable key and `id:`. |
| Dead `FolderSuggest` no-op; `durability.enabled` not read | **Implemented and tested.** The dead `FolderSuggest` path is removed, and durable recall is gated by the live `statsCfg.durableRecall` normalization rather than an unread flag. `tests/durability.test.js`. |
| Hard data caps silently drop oldest | **Implemented and tested.** Capped stores emit a Notice naming the cap and removed count; a full reading-progress map refuses a new key with a Notice. `tests/review-caps.test.js`, `tests/reading-plan.test.js`. |

### Capability 2 — what you know

| Finding | Status |
|---|---|
| Partial credit flattened to binary in history | **Implemented and tested.** Optional numeric `score` (0–100) is written and feeds accuracy, retention, calibration, mastery, concept mastery, dashboards and CSV; old binary/counter notes still load. `tests/history.test.js`, `tests/progress.test.js`, `tests/analytics-embed.test.js`. |
| FRQ siloed out of knowledge aggregates | **Implemented and tested.** Saved FRQ attempts feed `frqKnowledge`, Insights, course bands and a combined knowledge accuracy. `tests/frq.test.js`, `tests/views.test.js`. |
| Timing depth is averages only | **Implemented and tested.** Study Stats adds a seconds histogram, average/median, slow/fast thresholds and a bounded slow-row list. `tests/study-stats.test.js`. |
| Calibration pollution from hardcoded `conf: 2` | **Implemented and tested.** Inline-quiz answers store unrated confidence `0`, which `buildCalibration()` excludes. `tests/today.test.js`, `tests/analytics-embed.test.js`. |
| Exam confidence `0` is dropped from calibration | **Implemented and tested.** `0` stays out of the 1–3 confidence buckets, and `buildCalibration()` now returns an explicit `unrated` count (attempts, correct, credit, accuracy) instead of silently dropping those rows. The calibration panel says “N attempts had no confidence rating…”, while a blank confidence is still ignored. `tests/analytics.test.js`, `tests/analytics-embed.test.js`, `tests/today.test.js`. |
| `fm.history` unbounded | **Implemented and tested.** `historyLimit` defaults to 500, clamps to 100–5000, keeps the newest rows, and reports pruning through attempts, skips and sync merges. `tests/history.test.js`, `tests/review-caps.test.js`. |
| Mastery is raw accuracy, acceptable but should be documented | **Implemented and tested.** Mastery remains accuracy-based, while the panel documents the band thresholds and FSRS recall gates the **Mastered** band so a stale perfect score is held at **Strong**. `tests/progress.test.js`, `tests/views.test.js`. |

### Capability 3 — adaptive review

| Finding | Status |
|---|---|
| FSRS weights never optimized | **Not code-fixable without training data and an objective.** The review permits per-deck `request_retention` fitting as the smaller step; `src/fsrs-fit.js` implements exactly that (0.85–0.95, 20-review minimum, Apply/Reset). Fitting the 21 weights needs a labelled review corpus and an optimization target the repository does not have; no provider supplies either. `tests/fsrs-fit.test.js`. |
| `scheduler-fit` reads an unwritten `interval` | **Implemented and tested.** `applyAttempt` writes the scheduler interval; real history feeds scheduler-fit. `tests/scheduler-fit.test.js`, `tests/exam-schedule.test.js`. |
| No load balancing / overflow control | **Implemented and tested.** The due queue has a daily cap that holds overflow without rescheduling; cram remains intentional. `tests/due-queue.test.js`, `tests/today.test.js`. |
| No graduated pre-exam compression | **Implemented and tested.** Exam caps ramp T-14 → T-7 → T-3 → T-1, skip same-day checkpoints, and release after the exam. Both calendar and manual-assignment exams are covered. `tests/exam-schedule.test.js`. |
| No sub-day scheduling | **Not code-fixable without a schema change.** Existing note properties store day keys, and the review records sub-day steps as intentionally disabled. Sub-day scheduling requires time fields, sync semantics and a short-term-step model; that changes the note contract rather than fixing a missing branch. |
| Adaptive session sizing / frequency ship dark | **Implemented and tested.** Card-oriented welcome presets enable `adaptiveFrequency`; `sat`, `university` and `stem` enable adaptive session sizing, and adaptive sizing remains an explicit user setting. `tests/welcome.test.js`. |
| SM-2 Hard did not lower ease | **Implemented and tested.** Hard lowers ease; the scheduler path is covered. `tests/sm2.test.js`. |
| FSRS same-day +1 clamp undocumented | **Implemented and tested.** Scheduler settings render `SAME_DAY_NOTE`, and the clamp behavior is covered by the scheduler tests. `src/constants.js`, `tests/fsrs.test.js`. |
| Interval previews replay history repeatedly | **Implemented and tested.** CardView caches one replay per card until the card changes. `tests/interval-preview.test.js`. |

### Capability 4 — creating practice with verification

| Finding | Status |
|---|---|
| Quiz Generator modal skipped blind verification | **Implemented and tested.** The modal path runs `verifyDraftQuestions` with drop support. `tests/quiz-generator.test.js`, `tests/ai-tools.test.js`. |
| Quick-add bypassed write guards/journal | **Implemented and tested.** Allowed-root checks and the AI-write journal cover quick-add. `tests/ai-tools.test.js`, `tests/ai-write-guard.test.js`. |
| Chat-created questions never blind-verified | **Implemented and tested.** `applyByokToolProposals()` verifies, filters drops and stamps the note. `tests/ai-tools.test.js`. |
| `update_section` active-file guard bypass | **Implemented and tested.** The guard applies to the active note too. `tests/ai-tools.test.js`. |
| Verification only letter MCQs | **Implemented and tested.** Multi-select, True/False and numeric/SPR are covered; generated cards get rule-based checks; FRQ keeps its second pass. `tests/ai-service.test.js`, `tests/ai-tools.test.js`. |
| Same-model verification | **Implemented and tested.** Per-feature model settings support a separate verification model; `verifyQuestionDraft()` passes `feature: "verification"` and `tests/ai-service.test.js` now asserts the request uses the configured verifier and counts the request against that feature. |
| `isRetryableError` dead | **Implemented and tested.** Capped backoff covers 408/409/425/429/5xx/network and counts against the budget. `tests/ai-service.test.js`. |
| No distractor quality / dedup / finite defaults | **Implemented and tested.** Deterministic distractor rejection, generated-stem dedup and fresh-install caps of 100/day and 20/run (explicit `0` unlimited) ship with tests. `tests/distractor-quality.test.js`, `tests/quiz-dedup.test.js`, `tests/ai-service.test.js`. |
| No cost estimate before send | **Not code-fixable without provider pricing and tokenization.** A pre-send estimate needs a per-model price table and a reliable output-token estimate; the review supplies neither, and a wrong estimate would mislead. The finite per-day/per-run request caps bound spend instead. |
| No whole-vault retrieval | **Not code-fixable without an index and privacy contract.** Whole-vault retrieval needs a persistent local index, a folder-exclusion policy and a prompt-budget rule; the review does not settle those. Selected-note BM25-style passage retrieval ships in `src/context-retrieval.js`, covered by `tests/context-retrieval.test.js` and `tests/quiz-generator.test.js`. |

### Capability 5 — overall dashboard

| Finding | Status |
|---|---|
| No single view combines everything | **Implemented and tested.** Insights opens on **Overview** and starts with an **At a glance** row that combines grades, course health, FSRS depth, forward due load and exam readiness, followed by a **Courses to watch** detail list from the same course-health path as Study Workspace. Below it remain today's goal, weekly momentum, scoped mastery, memory-now, the study heatmap with card reviews, course progress with practice accuracy beside the weighted gradebook, next-up actions and FRQ knowledge. `tests/views.test.js` asserts the default tab, the five combined cards and the course-health detail; `tests/progress.test.js`, `tests/analytics-embed.test.js` and `tests/today.test.js` cover the individual aggregates. |
| FRQ excluded from aggregates | **Implemented and tested.** See Capability 2; `tests/frq.test.js`, `tests/views.test.js`. |
| Two grade systems never meet | **Implemented and tested.** Practice accuracy and the weighted gradebook letter render side by side, including gradebook-only embeds. `tests/views.test.js`, `tests/analytics-embed.test.js`. |
| Heatmap excludes card reviews | **Implemented and tested.** Card reviews are included in the heatmap. `tests/analytics-embed.test.js`, `tests/views.test.js`. |
| Duplicate aggregation layers / Today repaint | **Implemented and tested.** The bounded snapshot cache reuses derived aggregates; Today's 60-second tick updates text without a full repaint. `tests/snapshot-cache.test.js`, `tests/today.test.js`. |
| Band-count vs practice-pool divergence | **Implemented and tested.** The counts are unchanged by design: mastery counts every visible question by accuracy, while practice filters suspended/buried notes through `practiceQuestionPool()`. The shared `MASTERY_POOL_NOTE` in `src/progress.js` states the distinction in the Insights mastery panel and the Today/Progress embeds. `tests/progress.test.js`, `tests/analytics-embed.test.js`, `tests/today.test.js`, `tests/views.test.js`. |
| Embed windows limited to 0/7/30 | **Implemented and tested.** 1–365 days are accepted; 0 remains the all-time window. `tests/analytics-embed.test.js`, `tests/progress.test.js`. |
| Trend cold-start message | **Implemented and tested.** Today and Progress say “No earlier attempts in the previous N days to compare.” when the baseline is empty, and the weekly tiles say “First week” instead of inventing a delta. `tests/today.test.js`, `tests/views.test.js`. |

## Real-Obsidian and device observations

These are the only remaining observations that no unit test can supply. They are not code claims.

| Observation | Status |
|---|---|
| Real-Obsidian desktop/mobile visual pass | **Not code-fixable.** Requires an actual Obsidian window and theme/device rendering; the suite uses DOM and metadata stubs and cannot verify native layout, font fallback, safe-area insets or live theme switching. |
| Calendar attendance from desktop and phone | **Not code-fixable.** Requires the native Obsidian click path on real hardware; unit tests can prove the handler and idempotent data write, but not the platform event delivery. |
| Phone-width `course:` reading block and Today readings card | **Not code-fixable.** Requires a real narrow pane/device; the mounted-DOM tests prove the elements and handlers, not the final CSS layout. |

## Regression tests touched by this close-out

- `tests/exam-schedule.test.js` — manual `type: exam` assignment with no ICS feed caps the attempt at T-3 and writes `exam_cap_name`.
- `tests/ai-service.test.js` — blind verification sends the configured per-feature verification model and records usage under `verification`.
- `tests/core-values.test.js` — G1 rename/aliases, G2 exam merge, G3 lecture filtering, G5 Today, G6 evidence/source paths and mounted G6 routing.
- `tests/today.test.js` — merged manual exam appears in Today; mastery cold-start copy.
- `tests/reading-plan.test.js` — startup indexing and stable reading progress identity.
- `tests/views.test.js` — Insights opens on Overview and renders grades, course health, FSRS depth, due load and readiness in one At a glance row.
