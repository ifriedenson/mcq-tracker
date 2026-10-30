# Progress Dashboard & Scoped Mastery — Handoff

**Purpose:** give a new agent everything it needs to continue this work without the original chat.
**Repository:** `ifriedenson/mcq-tracker`
**Branch:** `main` (committed and pushed)
**Version in the tree:** `1.118.0` (manifest + `versions.json` bumped; not yet tagged or released)
**Last verified:** `npm test` → **696 passing, 0 failing**; `npm run check` → `main.js is up to date`.

Read `AGENTS.md` and the **Current focus** section of `plan.md` first. `plan.md` remains the product source of truth; this document is only the implementation handoff for the progress dashboard work.

---

## 1. What the owner asked for

1. "Add a better progress dashboard page" to the plugin.
2. Make each mastery band able to drive practice.
3. Let mastery bands be scoped to a subject/class chosen by the learner (examples given by the owner were illustrative only — **do not hardcode any subject names into the plugin**).

Everything is local, dependency-free, and uses the existing note properties. No network calls, no telemetry.

---

## 2. What shipped

### 2.1 New **Progress** tab in Insights

`src/insights-view.js` gains `renderProgress()`, a goal-first page. The existing tabs (Overview, Weak spots, Concepts, Error log) and the `open-dashboard` command are unchanged.

Sections, top to bottom:

1. **Today's study goal**
   - Conic-gradient ring driven by `--qt-pct`; shows today's minutes and the configured daily goal.
   - Title line: "N min to go" or "Goal reached".
   - Meta: streak, minutes in the last 7 days, sessions logged today.
   - Buttons: **Log study time** (`plugin.openFocusLog()`) and **Start 25-minute focus** (`plugin.startFocusSession(25, lastCourse)`).
2. **This week**
   - Four tiles: Accuracy, Attempts, Study time, Mastery.
   - First three show a delta against last week (for example `+8 pts vs last week`, `+25 min vs last week`, `No change vs last week`, or `First week`).
   - Accuracy/attempts/day counts come from the question history; minutes come from the study log.
3. **Question mastery** (the scoped part)
   - **Show mastery for** picker: `All questions` plus one option per distinct `course` value found in question notes.
   - Stacked band bar + legend with count and share for each band:
     `Not tried` → `Needs work` (<60%) → `Developing` (60–79%) → `Strong` (80–99%) → `Mastered` (100%).
   - Every non-empty band has a **Practice** button that starts a quick session over exactly those questions, within the selected scope.
   - If no question note has a `course` value, the picker is hidden and the page suggests adding one.
4. **Study heatmap**
   - 4 / 8 / 12 week chips (view state `progressWeeks`, default 12).
   - Reuses the existing `renderHeatmap()` from `analytics-embed.js`.
5. **Course progress**
   - One row per course: accuracy meter, attempts, logged study minutes, **Practice** button.
   - Rows are skipped for `No course` when rendering the Practice button (the filter would not match blank values).
6. **Next up**
   - Weakest skill (`weakestRow` over `skill`) with accuracy and attempts, plus a **Practice** button.
   - Counts: due, new, hidden, cards due.
   - Buttons: **Review N due**, **Practice N new**, **Review cards** / **Open cards**.
7. Privacy line: everything is calculated locally.

### 2.2 Entry points

- New command: **Open progress dashboard** (`open-progress`) → `plugin.activateInsights("progress")` in `src/plugin.js`.
- Existing `Open analytics dashboard` still opens the Overview tab.
- The default Insights tab remains `weak`, so existing behaviour and tests are unchanged.

### 2.3 Band practice plumbing

New plugin method `practiceQuestionPool(pool, label)` in `src/plugin.js`:

- Filters the pool to real question objects and to **visible** items (`isStudyable(q.fm, localDate())`), so suspended/buried notes can never re-enter practice through a band.
- Opens the practice view and calls `view.startQuick("count", list.length, { pool, label })` — the same Quick Practice queue/timer/resume machinery used elsewhere.
- Shows a Notice when the pool is empty or the practice view cannot open.

---

## 3. File map

### Added

| File | Role |
|---|---|
| `src/progress.js` | Pure local data helpers for the page: bands, scopes, weeks, momentum, courses, next-step counts. |
| `tests/progress.test.js` | Six unit tests for those helpers. |
| `docs/progress-dashboard-handoff.md` | This document. |

### Modified

| File | Change |
|---|---|
| `src/insights-view.js` | Imports the progress helpers; adds the Progress tab, scope picker, band Practice buttons, 4/8/12-week chips; `masteryScope` view state. |
| `src/plugin.js` | Adds `open-progress` command and `practiceQuestionPool()`. |
| `src/analytics-embed.js` | Exports `renderHeatmap` so the Progress tab reuses it instead of duplicating heatmap rendering. |
| `src/main.js` | Requires `./progress`; exposes the progress helpers on `module.exports.__test`. |
| `styles.css` | Adds `.qt-progress-*` styles (hero, ring, deltas, stacked bar, legend, scope row, next-up card) and a small-screen rule. |
| `tests/views.test.js` | Adds tests for the tab, scoped mastery + band practice, and the pool method. |
| `plan.md` | Records the work under the 1.118.0 entry in **Current focus** and updates the status line. |
| `manifest.json`, `versions.json` | Version `1.118.0`, minimum app `1.8.7`. |
| `main.js` | Generated by `npm run build` (1,853,952 bytes, 134 modules). Never hand-edit. |

---

## 4. API reference (`src/progress.js`)

```js
const {
  MASTERY_BANDS,       // [{ id, label }] in weakest-first order
  accuracyOf,          // question -> null | 0..1
  masteryBandOf,       // question -> "untried" | "weak" | "developing" | "strong" | "mastered"
  buildMastery,        // questions -> { total, tried, mastered, bands:[{id,label,count,pct}] }
  masteryScopes,       // questions -> sorted unique course labels (case-insensitive dedupe)
  scopeQuestions,      // (questions, scope) -> questions; "" returns everything
  bandQuestions,       // (questions, bandId) -> questions; unknown band returns []
  buildWeeks,          // (questions, sessions, today, count) -> Monday-first week rows
  buildMomentum,       // weeks -> { current, previous, attemptsDelta, minutesDelta, accuracyDelta }
  buildCourses,        // (questions, sessions, limit) -> [{ course, notes, seen, attempts, correct, accuracy, minutes }]
  buildNext,           // (questions, cards, today) -> { due, fresh, hidden, dueCards, freshCards, weak }
  buildProgress,       // the whole snapshot (see below)
} = require("./progress");
```

`buildProgress(options)` accepts:

```js
{
  questions,       // [{ file, fm }]
  cards,           // [{ file, fm, ... }]
  studyLog,        // { sessions: [{ date, minutes, course }], dailyGoalMinutes }
  today,           // Date or "YYYY-MM-DD"
  weeks,           // weeks on the momentum chart (default 4)
  masteryScope,    // course label, "" = all
  courseLimit,     // course rows (default 6)
}
```

It returns:

```js
{
  today,
  overall,        // overallStats(questions)
  study,          // studySummary(studyLog, today): todayMinutes, weekMinutes, goalPct, streak, byCourse, sessionsToday
  goal: { minutes, goalMinutes, pct, remaining, streak, sessionsToday },
  weeks: [{ start, attempts, correct, accuracy, minutes, activeDays }],
  momentum: { current, previous, attemptsDelta, minutesDelta, accuracyDelta } | null,
  mastery: { total, tried, mastered, bands },
  masteryScope,
  masteryScopes,
  courses: [{ course, notes, seen, attempts, correct, accuracy, minutes }],
  next: { due, fresh, hidden, dueCards, freshCards, weak },
}
```

Dates use local `YYYY-MM-DD` keys. Week buckets are Monday-first and ignore future entries. Course matching reuses `courseKey` from `analytics.js`, which lowercases and strips non-alphanumerics, so `AP World History` and `ap world history` are one scope.

---

## 5. Decisions and edge cases (keep these if you extend the page)

- **Only mastery is scoped.** Goal, weekly momentum, heatmap and course rows stay global. A scoped goal/streak would be ambiguous (study sessions can be logged without a course).
- **`course` is the scope knob** because the plugin already uses it for calendar colours, cards, GPA credits and course progress. Folders are not used as scopes.
- **No example subjects anywhere in code or copy.** The picker is built from real note values at render time.
- **Mastery bands count every note in scope, including hidden ones.** Practice, however, filters to visible questions, so the button can start fewer questions than the band count if some are suspended/buried. If you want the band counts to exclude hidden notes too, filter with `isStudyable` before `buildMastery` — decide deliberately, since excluding them changes historical mastery.
- **Scope resets when its course disappears** from the vault, and on a fresh view instance. It is view state, not a saved setting.
- **Band practice uses a count-based Quick Practice session**, not `practiceWith()` filters. There is no mastery-band field in the filter schema, and adding one would touch constants, filtering and settings; the explicit pool keeps the change small.
- **Band practice ignores the saved practice filters** on purpose: the band + scope is the selection.
- **`renderHeatmap` is now exported** from `analytics-embed.js` rather than copied.

---

## 6. Tests

Run everything with `npm test` (Node's built-in runner, no dependencies).

New coverage:

- `tests/progress.test.js`
  - band thresholds and counts (untried/weak/developing/strong/mastered)
  - course scopes: dedupe, sort, case-insensitive filtering, band filtering, unknown band
  - weekly buckets: Monday start, future entries ignored, minutes and active days
  - momentum: attempt/minute deltas and percentage-point accuracy delta
  - course rollups: case-insensitive merge, study minutes, `No course`, limit
  - full dashboard snapshot: goal, due/fresh/hidden counts, due cards, weakest skill
- `tests/views.test.js`
  - Progress tab renders the hero, week section, mastery, course progress and next steps
  - scoped mastery changes the hint and the picker switches scopes; a band button starts exactly the band's questions
  - `practiceQuestionPool` starts a `count` session with the exact pool and returns `null` for an empty pool

---

## 7. How to verify (repeat exactly)

```bash
npm run build     # regenerate main.js from src/
npm test          # 696 tests expected
npm run check     # must print "main.js is up to date."
```

Expected result at handoff:

```
tests 696
pass 696
fail 0
```

No browser/preview verification applies: this is an Obsidian plugin, not a web app. The real-Obsidian visual pass is an external gate in `plan.md` and was **not** performed.

---

## 8. Known limitations / open checks

- **Visual pass not done.** The layout has not been seen in a real Obsidian window (desktop, mobile, light/dark themes). Check the ring, the stacked bar, the legend with buttons, and the select on a narrow phone width.
- **Scope is not remembered** between view instances. A saved setting would be a small follow-up.
- **Mastery is all-time.** There is no date window for bands.
- **Quick Practice header does not show the band name.** `label` is currently only used for the empty-result Notice.
- **Band counts vs. practice pool can differ** when notes are hidden (see §5).
- **Community directory listing remains externally blocked** per `plan.md`; this work does not address it.

---

## 9. Suggested next steps

1. Persist the chosen mastery scope (view state → settings) so the learner keeps their subject context.
2. Add a date window (for example last 30 days) to the mastery bands, reusing the existing history parser.
3. Surface band practice in the `mcq-dashboard` embed and/or Today, not only the Progress tab.
4. Use names from the course registry when notes have no `course` value, so the picker can still offer subjects.
5. Let a band's Practice button pre-filter the practice view header with the band name.

---

## 10. Instructions for the next agent

1. Read `AGENTS.md` and the **Handoff snapshot** + **Current focus** in `plan.md`.
2. `src/` is the source of truth; `main.js` is generated. After any source edit run `npm run build`, then `npm test` and `npm run check`.
3. No dependencies may be added. Keep the plugin dependency-free and local-first.
4. Update `plan.md` before pushing implementation work.
5. The 1.118.0 changes are **committed and pushed to `main`**, but not tagged. To release them:
   - confirm `npm test` and `npm run check` still pass on the tag commit;
   - create a tag equal to `1.118.0` and push it; `.github/workflows/release.yml` then publishes `main.js`, `manifest.json` and `styles.css` with build attestations;
   - do not bump the version again unless new scope is added.
6. Do not claim the community-directory problem is fixed without the owner's dashboard confirmation.
