# Study Workspace tool audit (Nov 3, 2026)

**Scope:** every tab in the Study Workspace view (`src/study-workspace-view.js`), plus the
shared model (`src/study-workspace.js`) and the plugin methods each tab calls.

**Method.** For each tool I checked four things in code, not by reading the plan: a render path
exists and is reachable from the tab dispatch; every `this.plugin.*` member the tab calls is
defined; each rendered action has a handler that reaches a real model or plugin path; and the
empty state names what to do next. Model exports that no view used were listed separately to
catch implemented-but-unwired capability.

**Result:** all 21 tabs render and call only defined plugin members. Two tools were incomplete and
were finished in **1.210.11** (the Retention fit card was a stub) and **1.210.12** (Course health rows
had no action); the rest were already implemented. No tab renders a settings-only
placeholder card any more.

| # | Tool (tab id) | Actions | Workspace tests | Status |
|---|---|---|---|---|
| 1 | Feynman (`feynman`) | 3 | 0 | complete; no dedicated workspace test, reviewed in code |
| 2 | Recall (`recall`) | 3 | 0 | complete; no dedicated workspace test, reviewed in code |
| 3 | Topic planner (`planner`) | 7 | 0 | complete; no dedicated workspace test, reviewed in code |
| 4 | Study Flow (`flow`) | 5 | 1 | complete |
| 5 | Subjects (`subjects`) | 7 | 1 | complete |
| 6 | Courses (`courses`) | 3 | 0 | complete; no dedicated workspace test, reviewed in code |
| 7 | Tasks (`tasks`) | 8 | 3 | complete |
| 8 | Time blocks (`timeBlocks`) | 1 | 2 | complete |
| 9 | Annotations (`annotations`) | 4 | 0 | complete; no dedicated workspace test, reviewed in code |
| 10 | Deep Notes (`deepNotes`) | 3 | 0 | complete; no dedicated workspace test, reviewed in code |
| 11 | Retention (`retention`) | 2 | 4 | complete in 1.210.11 (fit card was a stub) |
| 12 | Vocabulary (`vocabulary`) | 4 | 2 | complete |
| 13 | Reading library (`readingLibrary`) | 1 | 4 | complete |
| 14 | Citations (`citations`) | 4 | 1 | complete |
| 15 | Quiz index (`quizIndex`) | 2 | 0 | complete; no dedicated workspace test, reviewed in code |
| 16 | Course health (`health`) | 0 | 1 | complete |
| 17 | Lecture notes (`lectures`) | 2 | 2 | complete |
| 18 | Read aloud (`readAloud`) | 7 | 1 | complete |
| 19 | Bookmarks (`bookmarks`) | 3 | 1 | complete |
| 20 | AI feedback (`feynmanAi`) | 2 | 1 | complete |
| 21 | PDF annotations (`pdfAnnotations`) | 5 | 2 | complete |

## The one gap found and fixed: Retention → per-deck fit

`renderSchedulerFit` rendered a title, a hint and **Open Scheduler settings** while
`plugin.fsrsRetentionReports()`, `applyFsrsRetention`, `resetFsrsRetention` and
`describeFsrsRetentionFit` already existed for the Settings page. The card now lists every deck
with its review count, card count and current target, the observation behind the suggestion or
the reviews still needed, **Apply \<value\>** for an accepted fit and **Reset** for a custom
target. It appears without a card scan because it reads review counters, stays hidden when there
are no cards, and is covered by `tests/fsrs-fit.test.js`. Shipped as 1.210.11.

## Unwired-looking exports that are not gaps

`allocatePlan`, `daysBetween`, `recallStats`, `normalizeStudyTask`, `normalizeGrade`,
`normalizeFlowExcerpt`, `normalizeVocabWord` and the constant tables are used inside
`study-workspace.js` itself or destructured by name in the view; the module-qualified search that
listed them was a false positive, not dead capability. `timeBlocks` is the sibling module the
planner imports directly.

## Second gap fixed: Course health had no actions

`renderCourseHealth` printed each course's checks but gave the reader nothing to
do, so a warning was a dead end. Each row now states how many warnings remain and
offers **Overview**, which reuses `plugin.openCourseOverview` from the Courses tab.
Shipped as 1.210.12 and covered by `tests/study-workspace-health.test.js`.

## What is still open

- **Test coverage, not implementation:** Feynman, Recall, Topic planner, Courses, Annotations,
  Deep Notes and Quiz index have no workspace-level test that mounts their tab. Each was read in
  code: creation form, list of saved rows, open/select, delete and an empty state are all wired
  to plugin methods, and the plugin methods are exercised by their own module tests.
- **Owner-gated work is unchanged:** the §5.22.12 subject colours and event tags remain behind
  their gate, and nothing in the workspace was changed to work around it.
