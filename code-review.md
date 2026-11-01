# Made by claude sonnett 5.5 Agent handoff: finish "What you need to learn" (courses, lectures, readings, exams)

Target repo: `mcq-tracker` v1.168.1 (reviewed from `mcq-tracker-main.zip`, Nov 1, 2026).
Source of the requirement: `plan.md` §1 Vision, first bullet: **"What you need to learn (courses, lectures, readings, exams)"**, detailed in §5.8 (Courses, calendar, exams), §5.9, §5.11 (Study plan) and §4.3 (exam-date compression).

> Scope note: the review checklist I was given contained only this one bullet (the second bullet was blank). The other four Vision bullets (what you know, when to review, how to create practice, overall dashboard) were **not** reviewed. Send them separately if you want the same treatment.

## 0. Read this first (project rules from AGENTS.md)

1. Read `plan.md` (Handoff snapshot, Current focus, §5.8, §5.11) before touching code.
2. `main.js` is generated. Never hand-edit it. Run `npm run build` after changing `src/`.
3. No new dependencies. Dependency-free JavaScript only. Only MIT/BSD/ISC/0BSD/Apache-2.0 code may be copied; everything below is original work.
4. Update `plan.md` **before** pushing implementation work. Add a dated entry to AGENTS.md "Current state".
5. Tests are part of the change. Run affected tests, then `npm test` and `npm run check`.
6. Never break existing users' notes or saved settings. Every new field must be optional, and `normalize*` functions must accept old data.
7. Make the smallest change that meets the request. Do not bump the version or release unless told.

Baseline I verified: `npm test` → **1245 pass, 0 fail**. `npm run check` → clean, 220 files, `main.js` current.

## 1. Verdict

Every individual piece exists and is tested. What is **missing is the connective layer** that makes the plugin "know what you need to learn" as one picture. Each of the four entities lives in its own store and is joined to the others only by case-insensitive text matching, or not joined at all.

| Entity | What exists | Verdict |
|---|---|---|
| **Courses** | Calendar course registry (code, name, folder, color, semester, instructor, credits, totalTopics) `calendar-model.js:88`; Subject Manager `study-workspace.js` `normalizeSubject`; assignments course config `assignments.js` `courseConfig`; folder→course tagging `cards.js` `courseForFolder`; course dashboard, health, templates, document→note ingestion | **Partial.** Three overlapping course stores, no shared identity (G1) |
| **Lectures** | Manual lecture log `study-tools.js` `normalizeLecture`; bulk paste; `lecture-compiler.js`; `transcript.js`; Cornell notes; per-class notes from calendar; next lecture on Today | **Partial.** Not connected to calendar classes, class notes, exam topics or the study plan (G4) |
| **Readings** | `reading-plan` block `reading.js` (one book, pace redistribution); Reading library `reading-library.js` (shelves, progress, quotes) | **Partial, weakest area.** No course, exam or deadline link anywhere (G5) |
| **Exams** | ICS/Full-Calendar exam detection (multilingual keywords) `calendar-model.js:473`; countdowns; review-interval cap before exam `examReviewCap`; next-exam study plan + cram pool `study-plan.js`; Topic planner with exam date and buffer; generated study tasks; exam-type assignments; practice exam views | **Partial.** No way to create an exam in-app, no topics/weight, three unsynced exam sources, plan covers only the next exam (G2, G3) |

## 2. Findings, in priority order

Each item gives: problem, evidence, what to build, acceptance criteria. Suggested build order is in §3.

### G1 (P0): No shared course identity

**Problem.** "Course" is a free-text string, matched by `trim().toLowerCase()` equality in each module. A lecture logged as `Calc` does not join a registry course `MATH 101 - Calculus`. Renaming a subject silently orphans its lectures, grades, plans and tasks. Fields are duplicated across stores (folder, color, credits).

**Evidence.**
- Calendar registry: `calendar-model.js:88` (`id, name, code, folder, color, semester, instructor, credits, totalTopics`). It is the only store with code-aware matching (`findRegisteredCourse`, `calendar-model.js:156`).
- Subject Manager: `study-workspace.js` `normalizeSubject` (name, folder, color, notes, projects).
- Assignments: `assignments.js` `courseConfig` / `courseRow` (credits, target, finalWeight; lowercase equality).
- Joins by lowercase name: `study-workspace.js` `subjectSummary`, `courseDashboard`; `course-health.js` `sameCourse`; lectures, absences, grades, plans, tasks and goals all carry a raw `course` string.

**Build.**
- New pure module `src/course-identity.js`: `resolveCourse(settings, input)` returns the canonical registry course (`id`) for a name, code or folder, or `null`. Make the **calendar registry the source of truth**. Support an optional `aliases` list per course.
- Route `courseDashboard`, `subjectSummary`, `courseHealthReport`, `courseRow` and the Today/exam lookups through the resolver. Keep falling back to the raw string when nothing resolves, so nothing breaks for users without a registry.
- Rename propagation: when a registry course is renamed, add the old name to `aliases` instead of rewriting stored data.
- Stop duplicating folder/color/credits: Subject Manager and Assignments should read them from the resolved course when present.

**Accept.** A lecture for `Calc`, a grade for `MATH 101`, and an assignment for `MATH 101 - Calculus` all appear under one course row when the registry maps them. Renaming the registry course does not drop any joined data. Old data with no registry behaves exactly as today. Tests added to `tests/study-workspace.test.js` and a new `tests/course-identity.test.js`.

### G2 (P0): Exams cannot be created in the app, and the exam model is thin

**Problem.** An exam exists only if an imported `.ics` feed or a Full Calendar note has a title containing an exam keyword. A student with no timetable feed cannot add "Chem final, Dec 12" so that the scheduler and study plan see it. Plan §5.8 requires an exam model with **date, topics covered, weight**, linked to a course. Topics and weight do not exist on exams. SAT/AP dates as first-class exam types (§5.8 item 6) are not in the calendar.

**Evidence.**
- `plugin.js:1816` `calendarEvents()` returns ICS sources plus Full Calendar notes only. Local events (`local-events.js`) are not merged in, and their categories (work, personal, study, meeting, health, social, other) include no exam.
- Exam detection is title keywords only: `calendar-model.js:473-478` (`EXAM_WORDS`, plus `\btest\b`).
- `grep topics|weight` in `calendar-model.js`, `local-events.js`, `calendar-view.js` returns nothing.
- **Three unsynced exam sources exist:** (a) ICS keyword events, used by `examCapFor` and `studyPlan()`; (b) the Topic planner's own manual `examDate` (`study-workspace.js` `normalizePlan`), used by `course-health.js` `planForCourse` and `generateStudyTasks`; (c) assignment notes of type `exam`/`test`/`final` (`assignments.js` `ASSIGNMENT_TYPES`, `TYPE_ALIASES`). They can disagree, e.g. course health warns about one date while the scheduler caps reviews to another.

**Build.** *(Recommended default, matches "properties-first" and the note-backed decision in plan §11: reuse assignment notes as the manual exam record.)*
- Add optional `topics` (list) and `exam_time` to assignment notes, and an **Add exam** command/button that creates an assignment note with `type: exam`, course, date, weight, topics.
- New pure `src/exams.js` with `listExams(ctx)`: merges (a) calendar events flagged `isExamEvent`, (b) exam-type assignments, (c) Topic-planner plans with an `examDate`. Output shape: `{ id, courseId, title, date, time, type, weight, topics[], source }`. De-duplicate by resolved course + date, preferring the richest record (manual topics/weight win over bare ICS).
- Exam `type`: `midterm | final | quiz | sat | ap | other`. Let the user mark a calendar event as "not an exam" (guards the `final`/`test` keyword false positives).
- Switch **all** readers to `listExams()`: `examCapFor`, `studyPlan()`, `course-health.js` `planForCourse`, Today, Topic planner defaults, `generateStudyTasks`.
- Seed the Topic planner's topic list from an exam's `topics` when present.

**Accept.** With no ICS feed, adding a manual exam caps card/question review intervals before that date (same behaviour as `examReviewCap` today), shows a countdown, and appears in the study plan and course health with the same date everywhere. An ICS exam and a manual exam on the same course and date show once. Existing ICS-only users see no change. Tests in `tests/exam-schedule.test.js`, `tests/study-plan.test.js`, `tests/course-health` coverage, plus new `tests/exams.test.js`.

### G3 (P1): Study plan covers one exam and ignores lectures, readings and topics

**Problem.** Plan §5.11 describes: *"Today: 25 due MCQs, 10 cards, 1 FRQ, review Lecture 7"*, a per-exam readiness score **shown with evidence**, and re-planning when a day is missed. Today the plan is MCQs, cards and FRQs only, for the single next exam, and it vanishes if the course has no matching questions.

**Evidence.**
- `plugin.js` ~`studyPlan()` (~line 6038): `upcomingExams(..., 1)[0]` (next exam only) and `if (!questions.length) return null`.
- `study-plan.js` `buildStudyPlan(exam, questions, cards, options)` takes no lectures, readings, topics or assignments. Readiness = `0.5*accuracy + 0.32*coverage + 0.18*(1-backlog)`; topic coverage compares question `skill` values to the registry's single `totalTopics` number.

**Build.**
- `studyPlans()` returns a plan for every exam in the next N days (setting, default 30), soonest first. Keep `studyPlan()` as a thin wrapper for existing callers.
- Never return `null` just because there are no questions. Return the plan with `readiness: null` and the non-question work items.
- Extend `buildStudyPlan` options: `lectures` (logged since the last exam or matching exam topics), `readings` (pages remaining from G5), `plannerRemaining` (topic passes left), `assignments` due before the exam.
- Add a `workItems[]` list (type, label, count/estimate) and a `readinessEvidence[]` list (accuracy, coverage, backlog, topics covered, readings behind) so the UI can show *why* the score is what it is.

**Accept.** A course with lectures and a topic plan but zero questions still gets a plan listing "review N lectures" and "K topic passes left". Two exams in one week both appear. Existing `study-plan.test.js` expectations still pass. The readiness evidence list is rendered where readiness is shown today.

### G4 (P1): Lectures are a manual log, disconnected from the calendar and from exams

**Problem.** The calendar knows when classes happen and can create per-class notes, but none of that feeds the lecture log. Attendance % is "lectures logged ÷ (lectures logged + absences logged)", so it is only meaningful if the student hand-logs everything. Course health fires "No lectures or absences logged" for anyone who uses only the calendar. Lecture `topics` is one free-text string, not matchable to exam topics or question `skill`s.

**Evidence.**
- `grep lectureLog` hits only `constants.js, plugin.js, study-tool-settings.js, study-tools-view.js, study-tools.js, study-workspace-view.js, today-view.js`, nothing in `calendar-*.js`.
- `study-tools.js` `normalizeLecture` → `{ id, course, date, title, topics: string }`.
- `study-workspace.js` `subjectSummary` computes attendance from the two manual lists.

**Build.**
- On a calendar class event and on its class note: **Log as attended / Log as absent** actions. Use an idempotent id (`calendar_uid|calendar_date`, the same key `calendarNoteIndex` uses) so repeat clicks do not duplicate.
- Add optional `notePath` (link to the class note) and `topicList` (parsed from `topics` on `,` or `;`) on lectures. Keep `topics` string for old data.
- Optional setting (off by default): after a class ends, show a Today prompt "Mark attended?" for classes with no entry.
- Feed lectures into G3 (`review Lecture N`) and match `topicList` to exam `topics` (case-insensitive, whole-phrase).

**Accept.** Logging from a calendar class creates exactly one lecture entry, with a working link to the class note, and attendance updates. Re-logging is a no-op. Old log entries load unchanged. Tests in `tests/study-modules-*.test.js` style, plus calendar-notes coverage.

### G5 (P1): Readings are not tied to courses, exams or deadlines

**Problem.** `reading-plan` blocks and the Reading library have no `course`, `exam` or `due`. They are absent from Today, the calendar, the course dashboard, course health and the study plan. A student cannot see "I'm 40 pages behind on the Econ reading before the midterm".

**Evidence.**
- `grep course|exam|lecture` over `reading.js`, `reading-library.js`, `reading-view.js` finds nothing relevant. `grep readingPlan|readingLibrary|reading-plan` over `today-view.js, calendar-view.js, study-plan.js, course-health.js, assignments.js` is empty.
- The only course-linked "reading" path today is the assignment type alias `reading → homework` (`assignments.js` `TYPE_ALIASES`). The course template has a `## Readings` heading and nothing else.

**Build.**
- Optional `course:` and `due:` (or `exam:` id) keys on the `reading-plan` block, and a `course` field on library books. Parse them in the existing normalizers without changing old output.
- `readingStatus(plan, today)` already effectively computes pages-per-day; expose `{ pagesRemaining, behindPages, dueDate }` as a pure helper.
- Surface: a "Readings" section on the course overview (G6), today's reading chunk on the Today view, and `readings` input to the study plan (G3). Optionally generate a study task per reading chunk (reuse `createStudyTask` with `source: "reading"`).
- No network, no note writes beyond what the block already does.

**Accept.** A reading plan with `course: Econ 101` and `due: <exam date>` shows on Today when pages are due, on the Econ course overview with a behind-pace flag, and in the Econ exam plan. Blocks without the new keys render exactly as before (existing `tests/reading-plan.test.js` unchanged and passing).

### G6 (P2): No single "what do I need to learn for this course" view

**Problem.** `courseDashboard(subjects, lectures, absences, grades)` combines only lectures, absences and grades. A student has to open six tabs to answer "what's left for Chemistry?".

**Build.** `courseOverview(courseId, ctx)` (pure, in a new `src/course-overview.js`): next exam (countdown, readiness, evidence), topics remaining, lectures since last exam, readings behind, assignments due, open tasks, plus the existing grade summary. Render it as the detail view when a course row is opened in the Study workspace Courses tab, and as an optional Today card for the course with the nearest exam. Depends on G1–G5; build last.

**Accept.** One panel per course shows all six sections, hides empty ones, and every row opens its source (note, plan or block). Covered by a mounted-DOM style test like the existing Today widget test.

### G7 (P2): Smaller gaps and cleanups

- Exam keyword false positives: `"final"` matches "Final project presentation"; `\btest\b` matches "Test prep session". Covered by the "not an exam" override in G2, but also add a unit test list of tricky titles.
- SAT/AP: `ap-exam-history.js` and `ap-exam-resources.js` exist for scores/resources, but SAT/AP test dates and registration deadlines are not calendar exam types. Covered by `type: sat|ap` in G2. Registration deadlines can be exam-type assignments with a `deadline` category.
- `course-health.js` "exam" check should use `listExams()` (G2) instead of the planner's `examDate`.
- Course registry spec in §5.8 lists "exam dates"; after G2 these are derived from `listExams()`, so update the plan text rather than storing them twice.

## 3. Suggested build order

1. **G1** course identity (everything else depends on it).
2. **G2** exam model + `listExams()` + Add exam; switch all readers.
3. **G5** readings link (small, independent once G1 exists).
4. **G4** lectures ↔ calendar.
5. **G3** study plans (consumes G2, G4, G5).
6. **G6** course overview, then **G7** cleanups.

One commit per item, each with `plan.md` updated first and tests green. Do not combine G1 with anything else; it touches the most files.

## 4. Do not do

- Do not add Canvas/LMS integrations, accounts, or network calls. Everything here is local.
- Do not introduce a new database or move per-item state out of note properties (plan §4.4). Plugin `data.json` is fine for lists that already live there.
- Do not rename or delete existing settings keys (`lectureLog`, `studyWorkspace`, `calendar.courses`, assignment `courses`). Add fields; leave old ones readable.
- Do not claim real-device or in-Obsidian verification. Say what was tested by unit/mounted-DOM tests and what needs a manual check.

## 5. Verification checklist for the agent

```bash
npm ci --ignore-scripts
npm test            # must stay green (baseline 1245)
npm run build
npm run check       # clean, main.js current
```

Manual checks to list in `plan.md` for the owner (not claimable by tests): add a manual exam with no ICS feed and confirm review dates move before it; log a calendar class as attended from desktop and phone; reading-plan block with `course:` renders on Today on a phone-width pane.

## 6. Review method and limits

Static read of `src/` (220 modules), `plan.md`, `AGENTS.md`, plus running the existing test suite and check script. I did not run the plugin inside Obsidian, so UI reachability is inferred from code paths and settings modules, not observed. Line numbers are approximate; search by the function names given.
# Made by GLM 5.3 Flash
 MCQ Tracker — Capability Review & Next-Step Handoff

**For:** coding agent continuing work on `mcq-tracker` (uploaded snapshot: `mcq-tracker-main.zip`, version 1.168.1)
**Scope:** review whether the code fully implements five required capabilities, then list what to implement next and what to review.
**Review method:** full source audit of `src/` (220 modules) via five parallel deep audits (one per capability), manual spot-verification of every critical claim in `src/plugin.js` and related modules, plus a live run of the repo's own gates.

**Baseline health (verified in this review):**

- `npm test` → **1,245 pass / 0 fail** (57s)
- `npm run check` → `no dynamic code in 220 files`, `main.js is up to date.`
- Zero `TODO`/`FIXME`/stub markers anywhere in `src/` (grep-verified by all five audits)

**Read first:** `AGENTS.md` and the **Handoff snapshot** + **Current focus** sections of `plan.md` (the product source of truth). `docs/progress-dashboard-handoff.md` documents the dashboard work and its open gaps (§8). All file:line references below are for this snapshot.

---

## 1. Verdict summary

| # | Requirement | Verdict | Headline gap |
|---|---|---|---|
| 1 | What you need to learn (courses, lectures, readings, exams) | ✅ Substantially implemented | Readings are excluded from the unified "what to study today" picture |
| 2 | What you know (accuracy, confidence, timing, mistakes, partial credit) | ✅ Substantially implemented | Partial credit is flattened to binary in `history`; FRQ results are siloed out of all knowledge aggregates |
| 3 | When to review it (adaptive spaced repetition) | ✅ Implemented, one real gap | FSRS weights are never optimized from history; the one "fit" tool (`scheduler-fit`) reads a property nothing writes |
| 4 | How to create more practice (AI generation with verification) | ⚠️ Mostly implemented — **verification holes** | The Quiz Generator modal path saves AI questions **without blind verification**; two write paths bypass guards/journal |
| 5 | How you are doing overall (one dashboard) | ⚠️ ~70% implemented | No single view combines everything; FRQ, FSRS depth, forward due-load, and weighted grades each live in a different silo |

Bottom line: all five capabilities exist and are well-tested (1,245 behavior-level tests). The work remaining is not "build the features" — it is (a) closing three concrete verification/guard holes in AI generation, (b) unifying FRQ + partial-credit data into the knowledge model, and (c) consolidating the dashboard. Fix the P0 list before adding any new feature.

---

## 2. Capability 1 — What you need to learn

### What exists and works

- **Courses.** A course is the `course` frontmatter property (`docs/property-schema.md`) plus registry entries in the calendar (`src/calendar-model.js:88,120-147`: name, code, folder, color, semester, instructor, credits) and a second config in Assignments (`src/assignments.js:243-260`: credits, target, finalWeight) driving weighted category grades, per-course targets, `neededOnFinal` and credit-weighted GPA (`assignments.js:325-334,489-530`). A third aggregation, `courseDashboard()`, merges Subject Manager + lecture log + grades into weighted letter grades (`src/study-workspace.js:832-872`). Questions/cards link via `course`; practice surfaces course meta (`src/practice-view.js:1230,1965`).
- **Syllabus/topic planning.** Topic planner stores per-course plans (topics, passes, exam date, buffer days) with `allocatePlan` spreading passes over days (`src/study-workspace.js:329-420`); `topicCoverage` (`src/study-plan.js:60-80`) compares registered `totalTopics` against mastered skills.
- **Lectures.** Lecture log (rows `{course, date, title, topics}`, capped 300, `src/study-tools.js:63-91`), `lecture-compiler.js` compiles the log into one study note (overview, vocabulary table, per-lecture sections), `course-notes.js` imports PDF/PPTX/DOCX into per-page Markdown notes, and `transcript.js` builds AI prompts from existing transcripts (no audio transcription — documented limitation). Attendance is derived in `subjectSummary` (`study-workspace.js:303-319`).
- **Readings.** Two modules: `reading-plan` code blocks with `planReading()` pace redistribution (`src/reading.js:219-280` — on-track/behind/ahead/off-pace, today's chunk, `behindBy`) and a reading library with want/reading/finished shelves (`src/reading-library.js:59-86`).
- **Exams.** Calendar exams classified by keyword (`EXAM_WORDS`, `calendar-model.js:473-476,540`), with `upcomingExams`/`examCountdown`/`nextExamForCourse` (:720-790). Timed-test blueprints in `src/exam-sections.js` power `exam-view.js`; AP practice-exam results are saved as notes with per-section frontmatter (`src/ap-exam-history.js:82-118`). `buildStudyPlan` produces daysLeft, readiness score, weak skill and a cram pool (`src/study-plan.js:122-159`).
- **Assignments.** Markdown notes with `assignment: true`; statuses todo/in-progress/submitted/graded/missing/excused (`assignments.js:31-38`), grade parsing, 7-day workload totals (:452-487), Tasks-line mirroring and a UI gradebook (`assignments-view.js:50-78`).
- **Integration.** Today view merges exam study plan + countdown + readiness (`today-view.js:200-234`), review + assignment deadlines in one task list (`buildDailyTasks`, `assignments.js:555-580`), next class/exam card, FRQ review queue. `.ics` import/export, term/reading weeks, Full Calendar interop.

### Gaps (implementation candidates)

1. **Readings are invisible in the unified picture.** `src/today-view.js` has zero references to the reading plan or library (verified by grep). A "read X pages today (you're behind by N)" card is the single highest-value addition here.
2. **No per-lecture state.** Attendance is derived only from the absence log; there is no "lecture processed → questions/cards generated" flag, so lecture-compiler/transcript output never links back to the lecture row.
3. **"What's on the exam" is only inferred** (title match + skill coverage + manually declared topic count). No per-exam syllabus checklist.
4. **Two course registries don't share data** (calendar registry vs. assignments settings; only credits fall back, `assignments.js:291-297`).
5. Syllabus course-note template is a static heading skeleton (`course-templates.js:42-46`) — no parsing into data.

### Bugs to note

- Reading-plan progress key is a hash of `title|start|target` (`reading.js:148-150`): renaming a book or editing dates orphans stored progress.
- `course-notes.js:239-241`: dead `const suggest = new FolderSuggest(...); suggest;` no-op.
- Lecture/subject/reading data lives in `data.json` with hard caps (300 lectures, 300 books, 1,000 progress entries) — overflow silently drops oldest.

---

## 3. Capability 2 — What you know

### What exists and works

- **Storage model.** Per-note frontmatter `history` array of pipe rows `when|result|seconds|answer|confidence|error_type|attempt_id|variant` (`src/notes.js:324-341`) + derived counters; attempt IDs make merges idempotent (`src/history.js:30-61`). `buildStudyStats` merges cards + questions + notes (`src/study-stats.js:374-412`); CSV export tags rows by kind (`src/results-export.js:15-59`).
- **Accuracy.** Per-question counters; per-skill/domain/difficulty/course/folder via `computeStats` (`src/stats.js:17-56`); 8-week accuracy bars (`stats.js:156-177`); recent-vs-earlier `trendDelta` (:180-208); per-course practice letter grades (`src/analytics.js:30-52`); Anki-style true retention by maturity replaying the scheduler (`study-stats.js:74-190`).
- **Confidence.** Required 3-chip capture gates submit in practice (`practice-view.js:1469,1569-1579`); 0-3 chips per exam item (`exam-view.js:734-748`). **Real calibration**: `buildCalibration` (`analytics.js:60-75`) rendered in Insights Overview and `{{dashboard}}` embeds (`analytics-embed.js:116-135`), tested (`tests/analytics.test.js:32-52`). Confidence also affects scheduling (conf 1 → no streak advance, FSRS Hard).
- **Timing.** Seconds on every attempt; avg-seconds tiles (`insights-view.js:136`); per-question `target_seconds` timer (`practice-view.js:109`) feeding grading (>1.5× target correct → Hard, `fsrs.js:42-51`); day-level minutes + heatmap (`study-stats.js:328-349`, `analytics.js:133-183`).
- **Mistake types.** Ten-label taxonomy (`constants.js:53`), captured via post-miss "Why did you miss it?" chips (`practice-view.js:1842-1859`), written into history rows, grouped in the Error log tab with a "Practice these" filter (`insights-view.js:567-607`), exported to CSV.
- **Partial credit.** Inline quiz `partial:` mode with per-question penalty → 0-100 score + pass/imprecise/fail bands (`quiz-block.js:402-435`); matching per-pair rows (`matching.js:97-120`); card typed answers correct/partial/incorrect via token coverage (`card-grading.js:187-190`) + AI grader (`card-grading-ai.js`); AP FRQ per-criterion rubric scoring (`frq.js:404-545`) with criterion weak spots surfaced in Insights (:534-565).
- **Mastery.** Source-note accuracy bands untried/weak<60%/developing<80%/strong (`concept-mastery.js:8-63`) plus windowed 7/30-day model with trend (`progress.js:89-133`); FSRS stability/difficulty/memory-now as knowledge signals; leeches and `needs_fixing` flags.

### Gaps (implementation candidates)

1. **Partial credit is flattened at the stats boundary.** History rows store only binary `correct|incorrect` (`notes.js:326`); quiz-block 0-100 scores and matching per-pair detail never reach stats, so near-misses are invisible to accuracy, calibration and mastery. Add a numeric `score` field to history rows and aggregate it.
2. **FRQ is siloed out of the knowledge model.** FRQ attempt notes (percent, `frq_criteria_missed`) never enter `buildStudyStats`, `conceptMasteryRows`, or calibration (verified: zero `frq` references in `study-stats.js`, `progress.js`, `analytics.js`). No unified mastery across MCQ + FRQ + cards.
3. **Timing depth is averages only.** `distribution()` is applied to intervals/ease/stability but never to seconds — no per-question time distributions or slow-answer analytics.
4. Mastery is raw accuracy — no decay adjustment outside FSRS (acceptable, but document it).

### Bugs to note

- **Calibration pollution:** `recordQuizBlockAnswer` hardcodes `conf: 2` ("Confident") for inline-quiz answers the user never rated (`plugin.js:4063`, verified) — inflates the Confident calibration bucket. Fix: store an "unrated" sentinel and exclude it from `buildCalibration`.
- `durability.enabled` is computed but never read (`durability.js:27`); actual gating uses `studyStats.durableRecall` (`plugin.js:7758`).
- Exam confidence 0 is silently dropped from calibration (`analytics.js:65-66`) — documented, but exam attempts vanish from that chart.
- `fm.history` is unbounded per note (day counters are capped, history is not).

---

## 4. Capability 3 — When to review it (adaptive spaced repetition)

### What exists and works

- **Four schedulers, all real.** Ladder (default `[1,3,7,21,60]`, per-deck overridable, `notes.js:283-291`, `cards.js:255-259`); clean-room SM-2 with ease/lapses/multipliers and one-time 500-row history replay (`sm2.js:123-174`); **full vendored FSRS-6** (ts-fsrs 5.4.1, `fsrs-lib.js`, 21 default weights, migration/clamping, fuzz; plugin adapter `fsrs.js` with `request_retention` clamp 0.85-0.95); Recall Scheduler ladder for note headings (`study-workspace.js:572-591`). Scheduler switching is lossless and tested (`fsrs.test.js:99-120`).
- **What gets scheduled.** Questions, flashcards, vocabulary in one queue (`due-queue.js:56-81`); whole notes (`plugin.js:5384`); **Spaced Everything** schedules arbitrary notes via SM-2 state in `se-*` frontmatter (`spaced-everything.js:58-181`). `spaced-quiz.js` is only an exporter, not a scheduler.
- **Adaptivity beyond pass/fail.** Confidence and response time map onto grades (`fsrs.js:42-51`, `sm2.js:111-120`); `adaptive-session.js` stretches/warm-ups session size from accuracy, skip rate and pace (:116-140); `adaptiveFrequency` lengthens ladder intervals for known cards (`card-learning.js:25-30`); same-day requeue for Again/Hard; skips logged separately (`notes.js:409`).
- **Exam awareness.** `examReviewCap` (`calendar-model.js:775-788`) caps due dates to the day before the exam via `applyExamCap` (`notes.js:189-202`), wired into card/note attempts (`plugin.js:1779,7739,7755,7826`), cleared when inapplicable, tested in `exam-schedule.test.js`.
- **Reminders.** Three layers: daily in-app banner (`reminder.js:41-66`), startup Notice + ribbon badge (`study-nudge.js:59-77`), opt-in OS notifications (`os-notifications.js:44-92`).

### Gaps (implementation candidates)

1. **FSRS weights are never optimized.** The plugin never passes `w` — the vendored defaults are used forever; only `request_retention` is adjustable, and `scheduler-fit.js` (`fitRetention`, :71-122) fits desired retention from observed recall but is global, cards-only, suggestion-only.
2. **`scheduler-fit` reads a property nothing writes.** It buckets by `fm.interval` (`scheduler-fit.js:46,86`), but nothing ever writes `interval` (only `anki_interval` on Anki import, `cards.js:562`; the only other `interval:` writes are Anki sync stamps, `plugin.js:3156,3178`). Verified: interval bucketing and trend advice are degenerate on real notes, and `tests/scheduler-fit.test.js` masks this with synthetic `interval` fixtures. **Either write an `interval` property in `applyAttempt` or read it from the scheduler state.**
3. **No load balancing / overflow control.** Due = `next_review <= today` (`filters.js:6-9`); overdue accumulates indefinitely; no daily caps that push work forward, no review-ahead guard (cram mode is intentional).
4. No graduated pre-exam compression (single day-before cap, no ramping); no sub-day scheduling (short-term FSRS steps disabled by design, `fsrs.js:28-34`).
5. Adaptive session sizing and `adaptiveFrequency` both default **off** (`adaptive-session.js:14`, `constants.js:211-212`) — the "adaptive" story ships dark.

### Bugs to note

- SM-2 Hard doesn't lower ease (only Again decrements, `sm2.js:132-150`) — deviates from classic SM-2.
- FSRS due clamp silently converts same-day due to +1 day (`fsrs.js:158-161`) — fine, but undocumented.
- Interval previews re-run the 500-row history replay ×4 ratings per render when state is missing (`interval-preview.js:33-51`) — minor perf.

---

## 5. Capability 4 — How to create more practice (AI generation with verification) ⚠️ priority area

### What exists and works

- **Generation paths.** MCQ/multi/true-false quiz from vault notes (22 languages, 1-20 items, `quiz-generator.js`); questions/cards from transcripts with subtopic memory; PDF/DOCX/PPTX/.ppsx text extraction; vision OCR of scans; flashcards (`card-generator`, `auto-anki`, `text2anki`); weak-spot generation from worst skills; learnkits. Providers: Anthropic/OpenAI/OpenRouter/Gemini/Qwen/Ollama/custom + local OpenCode agent behind one gate (`plugin.js:6597-6629`, `api-client.js`, `opencode-client.js`).
- **Verification (real, layered).** *Blind self-check*: a second AI call solves the question without seeing the answer key (`answer-verification.js:17-38`); `verifyDraftQuestions` (`plugin.js:3451-3495`) marks mismatches for review or drops them, stamping `verified/verified_by/verification` frontmatter + warning banner. *Computed verification*: parameterized items (seeded variables, restricted recursive-descent evaluator, no `eval`) are checked by local arithmetic, with AI disagreement downgrading to "review" (`computed-verification.js:68-140`). *Human review*: every path is draft-then-confirm; direct-AI agent actions are allow-listed proposals (`ai-tools.js:12-128`) shown in `ai-tool-review-modal.js`; OpenCode edits are reverted wholesale and staged per-file (`chat-panel.js:304-392`).
- **Guardrails.** `ai-write-guard.js` confines AI writes to question/card/deck folders and locks 38 protected properties (result, attempts, history, srs…); `agent-write-guard.js` snapshots/restores protected frontmatter; writes are journaled for one-click undo (`ai-writes.js`); keys prefer Obsidian Secret Storage with legacy migration (`secret-keys.js:81-127`); HTTPS enforced (`url-safety.js:32-39`); budget caps block before send (`ai-service.test.js:60`).

### P0 bugs — verification holes (fix first)

1. **Quiz Generator modal path skips verification.** `generateQuizFromNotes` (`plugin.js:4830-4860`, verified) returns parsed items without calling `verifyDraftQuestions` — unlike the transcript path (`:3792`) and weak-spot path (`:3279`). AI questions from folders are saved **unverified**. Wire verification in (or document loudly).
2. **`createQuickAddQuestions` bypasses guards.** (`plugin.js:3911-3944`, verified) It calls neither `assertAllowedWritePath` nor the AI-write journal — inconsistent with `writeTranscriptPractice` (`:5825`) — so quiz-generator/quick-add writes are invisible to "Undo last AI write" and unguarded if a caller passes another folder.
3. **Chat-created questions are never blind-verified.** `applyByokToolProposals` (`plugin.js:3816-3834`) relies solely on human proposal review.
4. **`update_section` path-guard bypass:** when the target is the active file, `assertAllowedWritePath` is skipped (`plugin.js:3854`) — an approved chat proposal can edit any open note (mitigated only by the safe-heading allowlist, `ai-tools.js:13`).

### Other gaps

5. **Verification covers only letter-answer MCQs** — `verifyQuestionDraft` hard-rejects non-letter answers (`plugin.js:3438`); no verification for flashcards, cloze or FRQ.
6. **Same-model verification:** generation and verification share one backend, so correlated errors are likely. Consider an optional "verify with a second model" setting.
7. **`isRetryableError` is dead code.** Defined and tested (`ai-service.js:236-241`) but never called anywhere in `src/` (verified) — no retry/backoff actually happens. Implement it (429/5xx/network, capped attempts with backoff) or remove it.
8. No distractor-quality checks beyond structure; no dedup of generated questions against existing vault questions on the quiz path; no cost estimate before send; AI limits default to unlimited (`ai-service.js:54-58`).
9. Context grounding is prompt-stuffing (note text embedded directly, `quiz-generator.js:136`) — fine at ≤12 notes/18k chars, but no retrieval; `ai-context.js` deliberately sends only aggregate stats to chat.

---

## 6. Capability 5 — One dashboard across everything

### What exists and works

- **Six surfaces:** **Today view** (phone-sized entry: due/new counts, start-5-minutes hero, scoped mastery card with trend + band practice, exam plan/countdown/readiness, FRQ review, quiz streak, assignments + workload, focus/streak, mixed due queue, next class/exam; re-renders every 60s); **Insights view** with 5 tabs — Progress (goal ring, momentum tiles with deltas, scoped 7/30-day mastery bands + practice, 4/8/12-week heatmap, course meters, next-up), Overview (stat tiles, grade snapshot, calibration, retention trend, skill/domain/difficulty breakdowns), Weak spots, Concepts, Error log; **`mcq-dashboard` embed** (11 metrics, course/window overrides, trend badge); **Study Stats view** (Anki-style: true retention by maturity, memory-now, interval/ease/stability distributions, weekday rhythm, per-deck, permanent heatmap, leeches); **Study Workspace** (19 tabs incl. Courses gradebook with weighted grades/letters and Retention tab with 30-day due forecast); **Review Calendar view**.
- **Plumbing.** Two pure aggregators — `buildProgress` (`src/progress.js:284-318`) and `buildDashboard` (`src/analytics.js:185-229`) — plus `studyPlan()`. The project's own handoff (`docs/progress-dashboard-handoff.md`) documents the design decisions (§5), known gaps (§8) and next steps (§9: course-registry names as scopes is item 4, still open).

### Gaps (implementation candidates)

1. **No single view combines everything.** Closest is Insights Overview, which lacks assignments, FSRS depth, forward due-load and streaks; Progress lacks exam countdown and grades; card/FSRS depth (retention by maturity, memory-now, stability distributions) lives only in Study Stats; forward due-load only in Workspace Retention; weighted gradebook letters only in Workspace Courses.
2. **FRQ results are excluded from all aggregates** (verified — see §3). They appear only in Today's FRQ queue and Weak-tab criteria.
3. **Two grade systems never meet:** practice-derived A-F snapshot (`analytics.js:30-52`) vs. weighted gradebook (`study-workspace.js:821-871`). No reconciliation or shared display.
4. **Heatmap excludes card reviews** — `activityByDay` counts only study-log sessions + question history (`analytics.js:133-150`).
5. **Two duplicate aggregation layers** (`progress.js` vs `analytics.js`) re-parse history per render; Today rebuilds its DOM every 60s + 1s focus tick; no caching layer. Fine at small vaults, worth a snapshot cache at large ones.
6. Band-count vs practice-pool divergence (hidden notes counted in bands, filtered from pools) — deliberate per handoff §5, but visible to users; decide and document in-app.
7. The project's own §8 manual gates remain open: **real-Obsidian visual pass (desktop/mobile/light-dark) never done**; trend cold-start messaging; embed windows limited to 0/7/30.

---

## 7. Recommended work order for the coding agent

Conventions (from `AGENTS.md` — follow them): read `plan.md` first and update it **before** pushing implementation; no dependencies; tests are part of the change (`npm run build` → `npm test` → `npm run check` → commit generated `main.js`); MIT/BSD/ISC/0BSD/Apache-2.0 code only; smallest change that meets the request.

### P0 — correctness fixes (do these first, each is small and testable)

| # | Fix | Where |
|---|---|---|
| 1 | Wire `verifyDraftQuestions` into the Quiz Generator modal path | `plugin.js` `generateQuizFromNotes` (~:4846) |
| 2 | Add `assertAllowedWritePath` + AI-write journal to `createQuickAddQuestions` | `plugin.js:3911-3944` |
| 3 | Stop hardcoding `conf: 2` for inline-quiz answers; store "unrated" and exclude from calibration | `plugin.js:4063`, `analytics.js:60-75` |
| 4 | Fix `scheduler-fit` input: write an `interval` property in `applyAttempt` (or read scheduler state) so `fitRetention` bucketing works on real notes; add a real-data test | `notes.js`, `scheduler-fit.js:46,86`, `tests/scheduler-fit.test.js` |
| 5 | Close the `update_section` active-file guard bypass | `plugin.js:3854`, `ai-tools.js` |
| 6 | Implement (or delete) `isRetryableError` — retry 429/5xx/network with capped backoff | `ai-service.js:236-241` |

### P1 — completes the five requirements

1. **Unify FRQ into the knowledge model** (biggest single win): feed FRQ attempt notes into `buildStudyStats`/mastery/calibration/dashboard, or add a documented FRQ section to Insights Progress. Affects §2, §5 of this review at once.
2. **Preserve partial credit in history:** add a numeric `score` to history rows; aggregate quiz-block 0-100 scores and matching pair detail into accuracy/mastery; keep binary `result` for backward compatibility with existing notes and sync.
3. **Readings in Today:** a reading-plan card (today's pages, behind-by, one-tap progress) in `today-view.js`; optionally due-date support in the reading library.
4. **Dashboard consolidation:** add forward due-load and a retention/memory-now summary to Insights Progress or Overview; include card reviews in the heatmap; show practice grade and gradebook letter side-by-side with a note explaining the difference.
5. **FSRS parameter optimization from review history** (per-deck if not global) — the last big "adaptive" gap; otherwise optimize `request_retention` per deck as a smaller step and document that weights are fixed.
6. **Verification for non-MCQ generated items:** rule-based checks for cloze/flashcards (answer present, not a substring of the prompt, single cloze deletion) and a second-pass rubric sanity check for FRQ; optional "verify with a second model" setting.

### P2 — polish

- Load balancing / daily caps / review-ahead handling in the due queue (`filters.js`, `due-queue.js`).
- SM-2 Hard lowers ease (`sm2.js:132-150`); make the FSRS +1-day clamp visible in UI copy.
- Per-lecture "processed" state linking lecture log rows to generated notes/cards.
- Unify the two course registries (or share credits/targets both ways).
- Snapshot cache for dashboard aggregators; stop Today's full-DOM rebuild per 60s tick.
- Reading-plan progress key: decouple from `title|start|target` hash (`reading.js:148-150`); remove dead `FolderSuggest` no-op (`course-notes.js:239-241`); remove dead `durability.enabled` read or wire it.
- Surface the default-off adaptive features (adaptive session sizing, `adaptiveFrequency`) in onboarding/presets so the adaptivity actually runs.
- Do the manual real-Obsidian visual pass for the Progress dashboard (`docs/progress-dashboard-handoff.md` §8) — it is an owner gate, not code.

### What to review (not implement) before P1

- `plan.md` §11 decisions (esp. items 4, 13, O13) — several remaining features are gated on owner/product decisions, not code. Don't build past a `NEEDS USER DECISION` row.
- `docs/progress-dashboard-handoff.md` §5 decisions — keep them when extending the dashboard (only mastery is scoped; `course` is the scope knob; band counts include hidden notes; band practice uses explicit pools).
- Test asymmetries: inline-quiz `conf` handling and quiz-generator-path verification have **no** tests precisely because the behavior is broken/absent (see P0 1 and 3). Add tests with the fixes.

---

## 8. Data model cheat sheet (for any of the above work)

- Vault Markdown frontmatter is the source of truth for questions, cards, assignments, exam results (`docs/property-schema.md`, schema v1). History rows, counters, SRS state (`sm2|…`, FSRS state, `se-*`, `exam_cap*`) all live per-note.
- Plugin `data.json` holds settings plus: lecture log, subject/project data, topic plans, reading library + progress, calendar course registry, CBT attempts, daily counters, AI write journal.
- SQLite is used only to write Anki `.apkg` files; CouchDB sync covers review state only.
- No dependencies, no dynamic code (`scripts/check-no-dynamic-code.js` enforces), `main.js` is generated — never hand-edit.
