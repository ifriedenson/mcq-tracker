# Settings navigation

MCQ Tracker settings are organised as **categories → pages → controls**. A page is
one existing settings renderer; the navigation only decides where it lives, so
every setting still writes the same `data.json` key through the same normalizer.

The model is `src/settings-categories.js`; the renderer is
`QuestionTrackerSettingTab.renderModuleNav()` in `src/settings-tab.js`.

## Simple settings

A new install starts in **Simple settings**. It shows only Practice (session and
review), Study agent, and App & documents, plus Cards, Calendar or Assignments
when that main module is already on. Optional study tools and the specialist
pages stay out of the navigation and the Global page.

One switch at the top of settings, **Show all settings**, reveals the full tree;
**Use simple settings** returns to the short path without changing any saved
module or tool value. The choice is stored as `settings.simpleSettings`.
Existing data files written before the flag existed open the full tree, so an
upgrade never hides pages someone already uses. A PDF++ **Customize...** deep
link reveals the full tree because it has to land on its advanced page.

## Categories

These are the full categories, shown when **Show all settings** is on.

| Category | What it holds |
| --- | --- |
| **Practice** | Practice session, review and scheduling, daily quiz, note review, review calendar, study statistics, practice tools and export. |
| **Cards & memory** | Cards and vocabulary, recall scheduler, retention, scheduler fitting, card archive, quiz index. |
| **Courses & planning** | Calendar, assignments, Pomodoro, local events, study goals, topic planner, Study Flow, tasks, time blocks, courses, subjects, course health, course templates, study nudge. |
| **Notes & tools** | 20 note and document tools (Cornell, lecture log, lecture notes, Deep Notes, Feynman, vocabulary, reading library, citations, PDF annotations, tables, read aloud, audio bookmarks, search, study map, web browser, quiz blocks, SAT/CBT/SFC blocks) plus Reference. |
| **Study agent** | The assistant's backend, models, commands, skills, memory and study context. |
| **App & documents** | Module switches and plugin-wide options, plus PDF++. |

Every settings page has exactly one home. `tests/settings-navigation.test.js`
fails if a study tool loses its page or appears twice, if a page id or label is
duplicated, or if an MCQ Tracker tab disappears.

## Three levels in practice

1. Pick a category in the row (six in All settings, three to five in Simple
   settings).
2. Pick a page in the left list of that category. A category with one page uses
   the full width instead of a one-item list.
3. Set the controls on the page. Page renderers keep their own internal grouping
   (for example AI is split into Study agent, Commands and skills, Session
   pacing, Context and privacy, Knowledge record and AI backend cards).

The breadcrumb above the page names the category and page, and the page list
marks the current page with `aria-current="page"`.

## Narrow panes and phones

Below 540 px of settings content width, a container query hides the page list
and shows one grouped picker with the same pages under the same category
headings. Between 540 and 760 px the list stays visible in a compact 150–168 px
column, and its labels wrap rather than running into the page. On phones the
two-column grid always collapses and the picker is always used. Nothing is
removed in either case; the category row stays visible.

Obsidian's default 900 px settings window leaves a 599 px content column after
its own sidebar, so the page list is visible there (verified in Obsidian
1.15.0); it switches to the picker only after the window is narrowed further.

## PDF++

The embedded PDF++ host is a child plugin, but it no longer registers a separate
top-level settings tab. Instead:

- **App & documents → PDF++** owns the on/off switch, the running state and the
  settings themselves.
- The host captures the vendor settings tab before Obsidian can register it.
  `src/pdf-plus-settings.js` mounts a **second instance** of that tab class with
  the same hosted plugin. Its containers are created in the tab constructor, so
  reparenting the captured tab cannot work.
- PDF++'s **Customize...** links and `obsidian://pdf-plus` protocol links are
  routed through the host to this page, where they scroll the visible embedded
  controls.
- When the vendor controls cannot be mounted (host off, standalone PDF++ running,
  or a build that hides plugin tabs), the page explains why and offers **Start
  PDF++** when the integration is on.
- The Global modules page no longer duplicates the PDF++ toggle; it links to the
  PDF++ page instead.

## Verified in Obsidian

Real Obsidian 1.15.0 on Linux (Xvfb, the plugin copied into
`.obsidian/plugins/mcq-tracker`, settings opened from the app) was used to check
the category row, page list, breadcrumb, narrow grouped picker and the PDF++
page in light and dark themes. Three defects came from those screenshots and are
fixed here: the page list hid too early at the default 611 px settings column
(the container breakpoint is now 540 px), setting rows with wide controls
overflowed instead of wrapping (rows now wrap and the compact grid is 168 px),
and the embedded PDF++ tab inherited two gutters so its rows were only 259 px
wide (92 px narrow) and clipped labels. The vendor page now removes the outer
gutter and keeps a 16 px inner one, scoped to `.qt-pdf-plus-embedded`, giving
387 px rows in a 419 px page and 252 px narrow. The vendor stylesheet and
controls are unchanged; the selector includes the settings modal, so it
outranks Obsidian's `.vertical-tab-content` padding rule without a forced
declaration.

See `docs/pdf-plus.md` for the Page Preview compatibility guard that lets the
embedded vendor settings draw on Obsidian 1.15.
