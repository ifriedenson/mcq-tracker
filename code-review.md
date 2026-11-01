# Agent handoff: finish "What you need to learn" (courses, lectures, readings, exams)

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
