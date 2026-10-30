# Progress Dashboard & Scoped Mastery — Handoff

**Purpose:** give a new agent everything it needs to continue this work without the original chat.
**Repository:** `ifriedenson/mcq-tracker`
**Branch:** `main` (committed and pushed)
**Version:** `1.118.0` released; `1.119.0`–`1.127.0` in the working tree (scope persistence, the 7-/30-day mastery windows, the dashboard-embed mastery section, band practice, per-block windows, the Today and Progress trend lines, the embed trend badge, and Quick Practice labels, not yet tagged)
**Last verified:** `npm test` → **703 passing, 0 failing**; `npm run check` → `main.js is up to date`.

Read `AGENTS.md` and the **Current focus** section of `plan.md` first. `plan.md` remains the product source of truth; this document is only the implementation handoff for the progress dashboard work.

---

## 1. What the owner asked for

1. "Add a better progress dashboard page" to the plugin.
2. Make each mastery band able to drive practice.
3. Let mastery bands be scoped to a subject/class chosen by the learner (examples given by the owner were illustrative only — **do not hardcode any subject names into the plugin**).
4. Add selectable 7-day and 30-day windows to the mastery bands so recent work matters more.
5. Show the selected mastery scope and window in the `mcq-dashboard` embed.
6. Let the embed's mastery bands start practice and let a block choose its own window.
7. Show the selected mastery window in Today.
8. Show the band name and mastery window in the Quick Practice header.
9. Add a mastery trend or recent-change indicator to Today.
10. Show the same trend in Progress and add a compact arrow to the dashboard embed.

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
   - **Show mastery for** picker: `All questions` plus one option per distinct `course` value found in question notes. The chosen scope is saved in plugin settings, so it is still selected the next time the dashboard opens.
   - **All time / Last 7 days / Last 30 days** chips: a finite view derives each note's accuracy from its dated history inside the selected window. Notes with no attempts in that period show as `Not tried recently`, and the band Practice buttons use the same windowed pool. The choice is saved as `settings.masteryDays` (`0` = all time, `7` or `30`).
   - Stacked band bar + legend with count and share for each band:
     `Not tried` → `Needs work` (<60%) → `Developing` (60–79%) → `Strong` (80–99%) → `Mastered` (100%). In a finite view the first band reads `Not tried recently`.
   - Every non-empty band has a **Practice** button that starts a quick session over exactly those questions, within the selected scope.
   - A trend line under the controls compares the mastered count with the immediately preceding window; All time uses the last 7 days against the 7 before. It uses the same green/red delta styling and reports when the earlier window has no attempts.
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

### 2.4 Dashboard embed

`mcq-dashboard` now includes **Question mastery** in the full overview and accepts `metric: mastery`. The block reads the saved `masteryScope` and `masteryDays`, draws the same stacked bands and legend as the Progress tab, and puts the selected window in the heading (`All time`, `Last 7 days` or `Last 30 days`). A `course:` value in the block overrides the saved scope so the block stays consistent with its other widgets. Every non-empty band has a **Practice** button that starts exactly that band's questions, using the same scope and window. A block can set `masteryDays: 0`, `7` or `30` to override the saved window just for that block; omitted or invalid values use the saved setting. The mastery heading carries a compact `↑ 1`, `↓ 1` or `→ 0` badge when the earlier window has attempts; its tooltip is the full trend sentence, and it is omitted when there is no baseline.

### 2.5 Today view

Today now renders the same mastery section after the reminder and before the study plan. It uses the saved `masteryScope` and `masteryDays`, falls back to all questions if the saved course disappears, and gives every non-empty band an exact-pool **Practice** button. The card also has a **Show mastery for** picker, All time / 7-day / 30-day chips and an **Open progress** link; changes save the shared settings and re-render Today. Below those controls, a trend line compares the mastered count with the immediately preceding window of the same length. All time uses the last 7 days against the 7 before. It reads like `+1 mastered vs the previous 7 days.` and uses the existing green/red delta styling. If the earlier window has no attempts, it says there were no earlier attempts to compare rather than presenting a misleading gain. Hidden questions remain excluded by `practiceQuestionPool`, exactly as in the Progress tab.

### 2.6 Quick Practice header

Band practice labels are stored on the quick session (`label` in `src/quick-practice.js`) and drawn first in the question header bar. A band launched from Progress, the embed or Today therefore reads like `Mastered · Alpha · last 7 days`; an all-time band reads `Mastered · Alpha · all time`. The label survives packing, pause/resume and reopening Obsidian with the rest of the session. The note's course is not repeated when the label already contains it.

---

## 3. File map

### Added

| File | Role |
|---|---|
| `src/progress.js` | Pure local data helpers for the page: bands, scopes, mastery trend, weeks, momentum, courses, next-step counts. |
| `tests/progress.test.js` | Nine unit tests for those helpers. |
| `docs/progress-dashboard-handoff.md` | This document. |

### Modified

| File | Change |
|---|---|
| `src/insights-view.js` | Imports the progress helpers; adds the Progress tab, scope picker, all-time/7-day/30-day chips, mastery trend line, band Practice buttons and 4/8/12-week chips; `masteryScope` and `masteryDays` are restored from and saved to settings. |
| `src/constants.js` | Adds the `masteryScope` default (`""`, meaning all questions) and `masteryDays` (`0` = all time, `7`/`30` = finite windows). |
| `src/plugin.js` | Adds `open-progress`, `practiceQuestionPool()` and the saved-scope/window mastery and trend data for dashboard embeds. |
| `src/today-view.js` | Renders the saved-scope/window mastery card in Today with inline scope/window controls, a mastered-count trend, exact band practice and an Open progress link. |
| `src/quick-practice.js` | Packs and restores the optional session label with the queue. |
| `src/practice-view.js` | Draws the session label at the start of the Quick Practice header. |
| `src/analytics-embed.js` | Exports `renderHeatmap` so the Progress tab reuses it, and renders the mastery section, compact trend badge and band Practice buttons for `mcq-dashboard`. |
| `src/main.js` | Requires `./progress`; exposes the progress helpers, including `buildMasteryTrend`, on `module.exports.__test`. |
| `styles.css` | Adds `.qt-progress-*` styles (hero, ring, deltas, stacked bar, legend, scope row, window chips, next-up card), the mastery trend line/badge styles, and a small-screen rule. |
| `tests/views.test.js` | Adds tests for the tab, scoped mastery + band practice, the 7/30-day windows + pools, the Progress trend line, and the pool method. |
| `tests/analytics-embed.test.js` | Covers the `mastery` metric, the all-time embed, the saved 7-day window, the compact trend badge, band practice and the inline `masteryDays` override. |
| `tests/today.test.js` | Covers the selected scope/window card, inline window change, mastered-count trend and exact band practice pool. |
| `tests/views.test.js` | Covers label packing/restoration and the rendered Quick Practice header label. |
| `README.md` | Documents the `mastery` metric, the saved window, the `masteryDays` override, band practice, the Today card with inline controls and its trend, and the Quick Practice header label. |
| `plan.md` | Records the work under the 1.119.0–1.127.0 entries in **Current focus** and updates the status line. |
| `manifest.json`, `versions.json` | Version `1.127.0`, minimum app `1.8.7`. |
| `main.js` | Generated by `npm run build` (1,868,303 bytes, 134 modules). Never hand-edit. |

---

## 4. API reference (`src/progress.js`)

```js
const {
  MASTERY_BANDS,       // [{ id, label }] in weakest-first order
  MASTERY_WINDOWS,     // [7, 30] finite windows; 0 means all time
  accuracyOf,          // (question, { days, today }) -> null | 0..1; days 0 = all-time counters
  masteryBandOf,       // (question, { days, today }) -> "untried" | "weak" | "developing" | "strong" | "mastered"
  buildMastery,        // (questions, { days, today }) -> { total, tried, mastered, bands, days, since }
  buildMasteryTrend,   // (questions, { days, today }) -> { days, allTime, current, previous, delta, direction, hasComparison }
  masteryTrendText,    // trend -> full one-line sentence, including the no-baseline case
  masteryScopes,       // questions -> sorted unique course labels (case-insensitive dedupe)
  scopeQuestions,      // (questions, scope) -> questions; "" returns everything
  bandQuestions,       // (questions, bandId, { days, today }) -> questions; unknown band returns []
  masteryWindowDays,   // value -> 0 (all time), 7 or 30
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
  masteryDays,     // 0 = all time; 7 or 30 = only dated history in that window
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
  mastery: { total, tried, mastered, bands, days, since },
  masteryTrend: { days, allTime, current, previous, delta, direction, hasComparison },
  masteryScope,
  masteryDays,
  masteryScopes,
  courses: [{ course, notes, seen, attempts, correct, accuracy, minutes }],
  next: { due, fresh, hidden, dueCards, freshCards, weak },
}
```

Dates use local `YYYY-MM-DD` keys. Week buckets are Monday-first and ignore future entries. The 7- and 30-day mastery windows are inclusive of today and the preceding 6 or 29 local days; they count only dated `history` rows whose result is `correct` or `incorrect`. The mastery trend uses the same boundary rule for the preceding window, ending the day before the current window starts; All time uses a 7-day trend. Course matching reuses `courseKey` from `analytics.js`, which lowercases and strips non-alphanumerics, so `AP World History` and `ap world history` are one scope.

---

## 5. Decisions and edge cases (keep these if you extend the page)

- **Only mastery is scoped.** Goal, weekly momentum, heatmap and course rows stay global. A scoped goal/streak would be ambiguous (study sessions can be logged without a course).
- **`course` is the scope knob** because the plugin already uses it for calendar colours, cards, GPA credits and course progress. Folders are not used as scopes.
- **No example subjects anywhere in code or copy.** The picker is built from real note values at render time.
- **Mastery bands count every note in scope, including hidden ones.** Practice, however, filters to visible questions, so the button can start fewer questions than the band count if some are suspended/buried. If you want the band counts to exclude hidden notes too, filter with `isStudyable` before `buildMastery` — decide deliberately, since excluding them changes historical mastery.
- **Scope and window are saved in `settings.masteryScope` / `settings.masteryDays`** and restored by a fresh view instance. If the course disappears from the vault, the page falls back to All questions but leaves the saved value alone. A value other than `0`, `7` or `30` for `masteryDays` falls back to all time.
- **The window reads history, not the lifetime counters.** A note with lifetime attempts but no dated attempts in the selected finite window is `Not tried recently` in that view. Band practice uses the same windowed filter, so its pool always matches the displayed band count (before hidden-note filtering).
- **The mastery trend compares mastered counts, not accuracy percentage points.** It uses the selected finite window, or the last 7 days for All time. A previous window with no attempted questions has no baseline, so the full line says so instead of showing a gain from zero, and the embed omits its compact badge.
- **Band practice uses a count-based Quick Practice session**, not `practiceWith()` filters. There is no mastery-band field in the filter schema, and adding one would touch constants, filtering and settings; the explicit pool keeps the change small.
- **Band practice ignores the saved practice filters** on purpose: the band + scope is the selection.
- **`renderHeatmap` is now exported** from `analytics-embed.js` rather than copied.

---

## 6. Tests

Run everything with `npm test` (Node's built-in runner, no dependencies).

New coverage:

- `tests/progress.test.js`
  - band thresholds and counts (untried/weak/developing/strong/mastered)
  - trend text: up/down/unchanged and no-baseline wording
  - 7- and 30-day windows: inclusive first day, old/future rows excluded, windowed bands and practice pools, allowlist fallback, all-time default
  - mastery trend: mastered-count delta, direction, previous-window attempts, no-baseline fallback and the All time 7-day comparison
  - course scopes: dedupe, sort, case-insensitive filtering, band filtering, unknown band
  - weekly buckets: Monday start, future entries ignored, minutes and active days
  - momentum: attempt/minute deltas and percentage-point accuracy delta
  - course rollups: case-insensitive merge, study minutes, `No course`, limit
  - full dashboard snapshot: goal, due/fresh/hidden counts, due cards, weakest skill
- `tests/analytics-embed.test.js`
  - parses the `mastery`/`bands` aliases, the `masteryDays` allowlist and renders the all-time mastery section
  - the plugin block uses the saved 7-day window, a per-block 30-day override and course scope
  - a band's Practice button receives the exact band and label
- `tests/today.test.js`
  - Today shows the saved 7-day window and its mastered-count trend, changes it to 30 days inline, reports that the earlier 30 days have no attempts, and starts exactly the mastered band's questions
- `tests/views.test.js`
  - the Quick Practice header shows the persisted band/window label
- `tests/views.test.js`
  - Progress tab renders the hero, week section, mastery trend, course progress and next steps
  - scoped mastery changes the hint and the picker switches scopes; a band button starts exactly the band's questions
  - the all-time/7-day/30-day chips change the bands, persist the choice, restore it in a fresh view and use the windowed practice pool
  - `practiceQuestionPool` starts a `count` session with the exact pool and returns `null` for an empty pool

---

## 7. How to verify (repeat exactly)

```bash
npm run build     # regenerate main.js from src/
npm test          # 703 tests expected
npm run check     # must print "main.js is up to date."
```

Expected result at handoff:

```
tests 703
pass 703
fail 0
```

No browser/preview verification applies: this is an Obsidian plugin, not a web app. The real-Obsidian visual pass is an external gate in `plan.md` and was **not** performed.

---

## 8. Known limitations / open checks

- **Visual pass not done.** The layout has not been seen in a real Obsidian window (desktop, mobile, light/dark themes). Check the ring, the stacked bar, the legend with buttons, the scope select, the all-time/7-day/30-day chips and the trend line on a narrow phone width.
- **The trend has no history before the current installation.** Until a full earlier window has attempts, Today and Progress show the no-comparison message and the embed omits its badge.
- **Band counts vs. practice pool can differ** when notes are hidden (see §5).
- **Embed windows are limited to `0`, `7` or `30` days.** Invalid block values use the saved setting.
- **Community directory listing remains externally blocked** per `plan.md`; this work does not address it.

---

## 9. Suggested next steps

1. **Done in 1.119.0:** the chosen mastery scope is saved in settings and restored when the dashboard reopens.
2. **Done in 1.120.0/1.121.0:** the bands can switch between all time, the last 7 days and the last 30 days, reading dated history and saving the choice.
3. **Done in 1.123.0:** the embed has band Practice buttons and a per-block `masteryDays` override.
4. Use names from the course registry when notes have no `course` value, so the picker can still offer subjects.
5. **Done in 1.125.0:** a band's Practice button names the band and window in the Quick Practice header.
6. **Done in 1.127.0:** Today shows a mastered-count trend against the previous window.

---

## 10. Instructions for the next agent

1. Read `AGENTS.md` and the **Handoff snapshot** + **Current focus** in `plan.md`.
2. `src/` is the source of truth; `main.js` is generated. After any source edit run `npm run build`, then `npm test` and `npm run check`.
3. No dependencies may be added. Keep the plugin dependency-free and local-first.
4. Update `plan.md` before pushing implementation work.
5. 1.118.0 is **tagged, released and published**; the workflow uploaded `main.js`, `manifest.json` and `styles.css`. The 1.119.0 scope-persistence, 1.120.0/1.121.0 mastery-window, 1.122.0 dashboard-embed, 1.123.0 embed-practice/inline-window, 1.124.0 Today, 1.125.0 Quick Practice header, 1.126.0 Today-controls and 1.127.0 Today/Progress/embed-trend changes are in the working tree. For the next version: bump the version, rebuild, confirm `npm test` and `npm run check`, push `main`, then push a tag equal to the manifest version so `.github/workflows/release.yml` publishes it.
6. Do not claim the community-directory problem is fixed without the owner's dashboard confirmation.
