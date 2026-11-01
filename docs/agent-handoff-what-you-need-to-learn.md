# Agent handoff: finish "What you need to learn" (courses, lectures, readings, exams)

Target: `mcq-tracker` v1.168.1, reviewed Nov 1, 2026.

Source of the requirement: `plan.md` §1 Vision, first bullet — **"What you need to learn (courses, lectures, readings, exams)"** — detailed in §5.8, §5.9, §5.11 and §4.3.

> Scope note: the checklist I was given contained only this one bullet (the second bullet was blank). The other four Vision bullets were **not** reviewed.

> Review limit: static read of `src/`, `plan.md` and `AGENTS.md`, plus the existing test suite. I did not run the plugin inside Obsidian, so UI reachability is inferred from code paths. No source code was changed for this review.

## 0. Project rules

1. Read `plan.md` before touching code. `main.js` is generated — never hand-edit it; run `npm run build`.
2. No new dependencies. Dependency-free JavaScript only. Only MIT/BSD/ISC/0BSD/Apache-2.0 code may be copied; everything below is original work.
3. Update `plan.md` before pushing implementation work, and add a dated entry to `AGENTS.md` "Current state".
4. Tests are part of the change. Run affected tests, then `npm test` and `npm run check`.
5. Never break existing notes or saved settings. Every new field must be optional, and every `normalize*` function must accept old data.
6. Make the smallest change that meets the request. Do not bump the version or release unless told.

Baseline: `npm test` → **1,245 pass, 0 fail**. `npm run check` → clean across **220 files**, `main.js` current.

## 1. Verdict

Every individual piece exists and is tested. The missing part is the **connective layer** that makes the plugin know what the learner needs to study as one picture. Courses, lectures, readings and exams live in separate stores and are joined only by case-insensitive text matching, or not joined at all.

| Entity | What exists | Verdict |
|---|---|---|
| **Courses** | Calendar course registry (`name`, `code`, `folder`, `color`, `semester`, `instructor`, `credits`, `totalTopics`); Subject Manager; assignment course config; folder-to-course tagging; course dashboard, health, templates and document-to-note ingestion | **Partial.** Three overlapping course stores, no shared identity (G1) |
| **Exams** | ICS/Full Calendar exam detection (multilingual keywords); countdowns; review-interval cap; next-exam study plan and cram pool; Topic planner with `examDate`; generated study tasks; exam-type assignments; practice exam views | **Partial.** No in-app exam creation, no topics/weight, three unsynced sources, plan covers only the next exam (G2, G3) |
| **Study plan** | Questions, cards and FRQs for the single next exam; accuracy, coverage, backlog and cram pool | **Partial.** Ignores lectures, readings and topic passes; disappears if the course has no questions (G3) |
| **Lectures** | Manual lecture log, bulk paste, lecture compiler, transcript, Cornell notes, per-class notes from the calendar | **Partial.** Not connected to calendar classes, class notes, exam topics or the study plan (G4) |
| **Readings** | `reading-plan` block (one book, pace redistribution); Reading library (shelves, progress, quotes) | **Weakest.** No course, exam or deadline link anywhere (G5) |

## 2. Verified evidence

These are the actual join points, not a feature inventory.

- Calendar registry: `src/calendar-model.js` `normalizeCourseRegistry()` and `findRegisteredCourse()`. It is the only store with code-aware matching, but it is not the shared identity for other stores.
- Subject Manager: `src/study-workspace.js` `normalizeSubject()` uses `name`, `folder`, `color`, `notes`, `projects`.
- Assignments: `src/assignments.js` `courseConfig()` and `courseRow()` compare `str(course).trim().toLowerCase()`.
- Course dashboard: `src/study-workspace.js` `courseDashboard(subjects, lectures, absences, grades)` only combines those four inputs.
- Course health: `src/course-health.js` `sameCourse()` compares lowercase names; `planForCourse()` takes the exam date from the Topic planner.
- Calendar events: `src/plugin.js` `calendarEvents()` merges parsed ICS sources and read-only Full Calendar notes, then applies term weeks. It does **not** include `local-events.js` events.
- Local events: `src/local-events.js` has `work`, `personal`, `study`, `meeting`, `health`, `social`, `other`; no exam category.
- Exam keywords: `src/calendar-model.js` matches `EXAM_WORDS` plus `\btest\b`; `final` and `test` can produce false positives.
- Topic planner: `src/study-workspace.js` `normalizePlan()` has its own `examDate`, independent of calendar exams and exam-type assignments.
- Study plan: `src/plugin.js` `studyPlan()` calls `upcomingExams(..., 1)[0]` and returns `null` when `questions.length === 0`.
- Study-plan builder: `src/study-plan.js` `buildStudyPlan(exam, questions, cards, options)` has no lecture, reading or topic input.
- Lecture log: `src/study-tools.js` `normalizeLecture()` stores `course`, `date`, `title`, `topics` as one string. No `notePath` or matchable `topicList`.
- Reading plan: `src/reading.js` `parseReadingPlan()` has `title`, `author`, `pages`, `start`, `target`, `days`, `off`, `read` — no `course`, `exam` or `due`.
- Reading library: `src/reading-library.js` `normalizeBook()` has no `course` or deadline field.
- Reading surfaces: no `readingPlan` or `readingLibrary` references in `src/today-view.js`, `src/calendar-view.js`, `src/study-plan.js`, `src/course-health.js` or `src/assignments.js`.

## 3. Findings and build instructions

### G1 (P0): No shared course identity

**Problem.** "Course" is a free-text string repeated across stores. A lecture for `Calc`, a grade for `MATH 101`, and an assignment for `MATH 101 - Calculus` do not join. Renaming a subject orphans its lectures, grades, plans and tasks.

**Build.**
- Add pure `src/course-identity.js`. Make the calendar course registry the source of truth.
- `resolveCourse(settings, input)` should resolve a name, code or folder to a registry row, returning `null` when nothing matches. Support optional per-course `aliases`.
- Route `courseDashboard`, `subjectSummary`, `courseHealthReport`, `courseRow` and Today/exam lookups through the resolver. Fall back to the raw string when nothing resolves, so users without a registry see no change.
- Rename propagation: when a registry course is renamed, add the old name to `aliases`; do not rewrite stored lecture, grade or plan data.
- Stop duplicating folder, color and credits where the resolved course already supplies them.

**Accept.** A lecture, grade and assignment using three different labels appear under one course row when the registry maps them. Renaming the registry course drops no joined data. Old data with no registry behaves exactly as today. New `tests/course-identity.test.js`; extend `tests/study-workspace.test.js`.

### G2 (P0): Exams cannot be created in-app, and the exam model is thin

**Problem.** An exam exists only when an imported `.ics` feed or Full Calendar note has an exam keyword, or when an assignment is manually typed as an exam. A student with no timetable feed cannot add "Chem final, Dec 12" so the scheduler and study plan see it. Exams have no topics or weight.

**Recommended design (no owner question needed).** Reuse assignment notes as the manual exam record. Add optional `topics` and `exam_time` fields, and an **Add exam** command/button that creates an assignment note with `type: exam`, course, date, weight and topics. Do not introduce a separate exam note type unless the owner asks.

**Build.**
- Add pure `src/exams.js` with `listExams(ctx)`. Merge:
  - calendar events flagged `isExamEvent`;
  - exam-type assignments;
  - Topic-planner plans with an `examDate`.
- Output shape: `{ id, courseId, title, date, time, type, weight, topics[], source }`.
- De-duplicate by resolved course + date, preferring the richest record (manual topics/weight win over a bare ICS event).
- Exam `type`: `midterm | final | quiz | sat | ap | other`. Let the user mark an event as "not an exam" to guard keyword false positives.
- Switch every reader to `listExams()`: `examCapFor`, `studyPlan()`, `course-health.js` `planForCourse`, Today, Topic planner defaults and `generateStudyTasks`.
- Seed the Topic planner's topics from an exam's `topics` when present.

**Accept.** With no ICS feed, a manual exam caps card/question intervals before that date, shows a countdown, and appears in the study plan and course health with one date everywhere. An ICS exam and a manual exam on the same course/date show once. ICS-only users see no change. Add `tests/exams.test.js`; extend `tests/exam-schedule.test.js` and `tests/study-plan.test.js`.

### G3 (P1): Study plan covers one exam and ignores lectures, readings and topics

**Problem.** The plan is MCQs, cards and FRQs only, for the next exam, and disappears if the course has no matching questions. It does not say "review Lecture 7", "read 20 pages" or "finish two topic passes", and it has no evidence for its readiness score.

**Build.**
- `studyPlans()` returns a plan for every exam in the next N days (setting, default 30), soonest first. Keep `studyPlan()` as a thin wrapper.
- Never return `null` because there are no questions. Return the plan with `readiness: null` and the non-question work items.
- Extend `buildStudyPlan` options with `lectures`, `readings`, `plannerRemaining` and `assignments` due before the exam.
- Add `workItems[]` (type, label, count/estimate) and `readinessEvidence[]` (accuracy, coverage, backlog, topics covered, readings behind).
- Render the evidence where readiness is shown today.

**Accept.** A course with lectures and a topic plan but zero questions still gets a plan listing "review N lectures" and "K topic passes left". Two exams in one week both appear. Existing `tests/study-plan.test.js` expectations still pass.

### G4 (P1): Lectures are a manual log, disconnected from the calendar and exams

**Problem.** The calendar knows when classes happen and can create per-class notes, but none of that feeds the lecture log. Attendance is "lectures logged ÷ (lectures + absences logged)", so it is only meaningful if the student hand-logs everything. Lecture `topics` is one free-text string.

**Build.**
- Add **Log as attended** / **Log as absent** actions on a calendar class event and its class note.
- Use an idempotent id such as `calendar_uid|calendar_date`; repeat clicks must be no-ops.
- Add optional `notePath` (class-note link) and `topicList` (parsed on `,` or `;`) to lectures. Keep `topics` for old data.
- Optional, off by default: after a class ends, show a Today prompt "Mark attended?" for classes with no entry.
- Feed lectures into G3 and match `topicList` to exam `topics` case-insensitively, whole-phrase.

**Accept.** Logging from a calendar class creates exactly one lecture entry with a working class-note link and updates attendance. Re-logging is a no-op. Old entries load unchanged. Extend the study-module/calendar-note tests.

### G5 (P1): Readings are not tied to courses, exams or deadlines

**Problem.** Reading plans and the Reading library have no course, exam or due date. They do not appear on Today, the calendar, the course dashboard, course health or the study plan.

**Build.**
- Add optional `course:` and `due:` (or `exam:`) keys to `reading-plan` blocks, and a `course` field to library books.
- Parse them in the existing normalizers without changing old output.
- Expose `{ pagesRemaining, behindPages, dueDate }` from the existing pace calculation.
- Surface readings in the course overview, Today's reading chunk and the study plan's `readings` input.
- Optionally create a study task per reading chunk via `createStudyTask` with `source: "reading"`.
- No network, no note writes beyond what the block already does.

**Accept.** A plan with `course: Econ 101` and `due: <exam date>` shows on Today when pages are due, on the Econ overview with a behind-pace flag, and in the Econ exam plan. Blocks without the new keys render exactly as before; `tests/reading-plan.test.js` stays green.

### G6 (P2): No single "what do I need to learn for this course" view

**Problem.** `courseDashboard()` only combines subjects, lectures, absences and grades. A student must open six tabs to answer "what's left for Chemistry?".

**Build.** Add pure `src/course-overview.js` `courseOverview(courseId, ctx)`: next exam (countdown, readiness, evidence), topics remaining, lectures since the last exam, readings behind, assignments due, open tasks and the existing grade summary. Render it when a course row is opened in the Study workspace Courses tab; optionally add a Today card for the course with the nearest exam. Build after G1–G5.

**Accept.** One panel per course shows all six sections, hides empty ones, and every row opens its source note/plan/block. Cover with a mounted-DOM style test like the existing Today widget test.

### G7 (P2): Smaller gaps and cleanups

- Exam keyword false positives: `final` matches "Final project presentation"; `test` matches "Test prep session". Add the "not an exam" override from G2 and a unit-test list of tricky titles.
- SAT/AP: `ap-exam-history.js` and `ap-exam-resources.js` exist for scores/resources, but SAT/AP dates and registration deadlines are not calendar exam types. Add `type: sat|ap` in G2; registration deadlines can be exam-type assignments with a deadline category.
- `course-health.js` should use `listExams()` from G2 instead of `planForCourse()`'s planner-only `examDate`.
- The course registry currently lists `totalTopics`; after G2, exam dates are derived from `listExams()`. Do not store a second exam-date list in the registry.

## 4. Build order

1. **G1** course identity — everything else depends on it.
2. **G2** exam model, `listExams()` and Add exam — switch all readers.
3. **G5** readings link — small once G1 exists.
4. **G4** lectures ↔ calendar.
5. **G3** study plans — consumes G2, G4 and G5.
6. **G6** course overview, then **G7** cleanups.

One commit per item, each with `plan.md` updated first and tests green. Do not combine G1 with anything else; it touches the most files.

## 5. Do not do

- Do not add Canvas/LMS integrations, accounts or network calls. Everything here is local.
- Do not introduce a new database or move per-item state out of note properties. Plugin `data.json` is fine for lists that already live there.
- Do not rename or delete existing settings keys (`lectureLog`, `studyWorkspace`, `calendar.courses`, assignment `courses`). Add fields; keep old ones readable.
- Do not claim real-device or in-Obsidian verification. Say what unit/mounted-DOM tests cover and what needs a manual check.
- Do not copy code from a plugin unless `plan.md` §3.10 records a compatible licence. This handoff is original work.

## 6. Verification

```bash
npm ci --ignore-scripts
npm test            # must stay green from 1,245
npm run build
npm run check       # clean, main.js current
```

Manual checks to list in `plan.md` for the owner (not claimable by tests):

- Add a manual exam with no ICS feed and confirm review dates move before it.
- Log a calendar class as attended from desktop and phone.
- Open a reading-plan block with `course:` on a phone-width pane; confirm it appears on Today and the course view.
- Reopen a renamed course and confirm its lectures, grades and plans are still joined.

## 7. Questions

No blocking question for G1–G7. G2's recommended default is the assignment-note exam record described above. If a separate exam note type is chosen instead, ask the owner first; do not invent a second note schema.
