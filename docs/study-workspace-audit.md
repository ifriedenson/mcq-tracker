# Study Workspace tool audit (Nov 3, 2026)

**Scope:** every tab in the Study Workspace view (`src/study-workspace-view.js`), the shared
model (`src/study-workspace.js`) and the plugin methods each tab calls.

**Method.** Per tool, four structural checks: a render path reachable from the tab dispatch;
every `this.plugin.*` member the tab calls defined; every rendered control reaching a real
model or plugin path; and no empty state left as a dead end. Then each tab is mounted through
the view's own dispatch and driven end to end: fill the form, create, assert the persisted
model, read the saved row, open it, delete it and reach the documented empty state.

**Result:** all 21 tabs render, call only defined plugin members, and every button, field and
row has a working path. Three tools were incomplete and are fixed: the Retention fit card was a
stub (1.210.11), Course health rows had no action (1.210.12), and the planner's **Use exam
topics** refusal was silent (1.210.13).

| # | Tool (tab id) | Backing test | Release |
|---|---|---|---|
| 1 | Feynman (`feynman`) | `tests/study-workspace-tabs.test.js` | 1.210.13 |
| 2 | Recall (`recall`) | `tests/study-workspace-tabs.test.js` | 1.210.13 |
| 3 | Topic planner (`planner`) | `tests/study-workspace-tabs.test.js` | 1.210.13 |
| 4 | Study Flow (`flow`) | `tests/writing-sessions.test.js` | 1.210.10 |
| 5 | Subjects (`subjects`) | `tests/subject-projects.test.js` | 1.166.0 |
| 6 | Courses (`courses`) | `tests/study-workspace-tabs.test.js` | 1.210.13 |
| 7 | Tasks (`tasks`) | `tests/task-list.test.js` | 1.172.0 |
| 8 | Time blocks (`timeBlocks`) | `tests/time-blocks.test.js` | 1.210.1 |
| 9 | Annotations (`annotations`) | `tests/study-workspace-tabs.test.js` | 1.210.13 |
| 10 | Deep Notes (`deepNotes`) | `tests/study-workspace-tabs.test.js` | 1.210.13 |
| 11 | Retention (`retention`) | `tests/fsrs-fit.test.js` | 1.210.11 |
| 12 | Vocabulary (`vocabulary`) | `tests/study-workspace.test.js` | 1.166.0 |
| 13 | Reading library (`readingLibrary`) | `tests/study-workspace-layout.test.js` | 1.169.3 |
| 14 | Citations (`citations`) | `tests/citations.test.js` | 1.210.3 |
| 15 | Quiz index (`quizIndex`) | `tests/study-workspace-tabs.test.js` | 1.210.13 |
| 16 | Course health (`health`) | `tests/study-workspace-health.test.js` | 1.210.12 |
| 17 | Lecture notes (`lectures`) | `tests/study-modules-2.test.js` | 1.166.0 |
| 18 | Read aloud (`readAloud`) | `tests/study-modules-2.test.js` | 1.166.0 |
| 19 | Bookmarks (`bookmarks`) | `tests/study-modules-2.test.js` | 1.166.0 |
| 20 | AI feedback (`feynmanAi`) | `tests/study-modules-3.test.js` | 1.166.0 |
| 21 | PDF annotations (`pdfAnnotations`) | `tests/study-modules-3.test.js` | 1.166.0 |

The **Release** column is the version in `manifest.json` at the commit that added the named
test file, read from git history; the three rows this audit shipped are pinned to their own
release. Every row therefore points at a file in the tree rather than at a memory.

## The three gaps, and what closed them

1. **Retention → per-deck fit (1.210.11).** `renderSchedulerFit` was a hint plus a Settings
   link while `fsrsRetentionReports`, `applyFsrsRetention`, `resetFsrsRetention` and
   `describeFsrsRetentionFit` already existed. It now lists each deck's reviews, cards, current
   target and the observation behind the suggestion, with **Apply** only for an accepted fit and
   **Reset** only for a custom target. Covered by `tests/fsrs-fit.test.js`.
2. **Course health (1.210.12).** Rows printed checks with no action, so a warning was a dead
   end. Each row now states how many warnings remain and offers **Overview**, which reuses
   `openCourseOverview`. Covered by `tests/study-workspace-health.test.js`.
3. **Topic planner → Use exam topics (1.210.13).** The refusal called `saveMessage` without a
   re-render, so pressing it with no matching exam showed nothing. It now raises the view's
   existing `Notice`, which also avoids re-rendering away a half-typed plan. Covered by
   `tests/study-workspace-tabs.test.js`.

## What the new suite covers

`tests/study-workspace-tabs.test.js` mounts each of Feynman, Recall, Topic planner, Courses, Annotations, Deep Notes and
Quiz index through the dispatch, and for every control asserts both the persisted state and
what the reader sees. Refusals are asserted too: an empty Feynman step, a plan with no course
or date, an annotation with no quote, and a quiz scan of an empty folder.

## Still open

- No real-Obsidian visual pass: these are DOM-stub tests, so layout and styling remain a manual
  check on desktop and phone.
- The §5.22.12 subject colours and event tags stay behind their owner gate; nothing here
  touches them.
