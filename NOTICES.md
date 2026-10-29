# Third-party notices

MCQ Tracker is MIT licensed; see [LICENSE](LICENSE). Copyright (c) 2026 Isaac Friedenson.

This file lists code and ideas taken from other projects. Each entry names the license,
the copyright holder, the exact version used, and which files in this repository contain
the work.

## University Schedule and Calendar

- **Project:** [obsidian-uni-calendar](https://github.com/Cesemess/obsidian-uni-calendar) (plugin id `university-calendar`, "University Schedule and Calendar")
- **Author:** Cesemess
- **License:** MIT, Copyright (c) 2026 Cesemess (verified in the repository's `LICENSE` on October 28, 2026)
- **Baseline:** commit `35778e473a1d7ad7827c83c065b0f61dcbefdbc5` ("release: v1.2.0", October 24, 2026)
- **What was absorbed:** the calendar parser and expander (`parseICS`, `parseICSDate`, `expandRecurringEvents`), calendar URL normalization (Google `?cid=`/`?src=` and `webcal://`), class-detail parsing (`parseUniDetails`), subject cleaning (`cleanSubjectTitle`), note naming and note templates, the `.ics` export format, and the month-grid, daily-timeline, event-card, break-gap and live-countdown presentation, including its DOM markup and calendar stylesheet rules.
- **Files in this repository that contain adapted work:**
  - `src/calendar-ics.js` — parser, recurrence expander and exporter
  - `src/calendar-model.js` — class details, subject cleaning, note variables, templates, folder mapping
  - `src/calendar-notes.js` — class-note creation built on those helpers
  - `src/calendar-view.js` — month grid, day timeline, countdown and `uni-schedule` embed
  - `styles.css` — the calendar view rules, kept under the original `uni-` class names
- **Marked as modified.** These are not verbatim copies: the logic was rewritten for this
  plugin's plain-JavaScript module layout and its settings and data model. The calendar view
  keeps the original's `uni-` markup and stylesheet rules on purpose so the two calendars look
  the same. Documented changes:
  - the month card, day cells, timeline, event cards and note badges follow the original's DOM and CSS; the Month / Day / Upcoming switcher, exam panel, note identity and study-slot launcher are local to this plugin;
  - the ported calendar stylesheet rules are scoped beneath `.uni-calendar-container` and `.uni-schedule-embed`, so they cannot override the original plugin when both are enabled;
  - all recurrence loops are bounded (`MAX_INSTANCES`), where the original could loop indefinitely on a malformed rule;
  - COUNT, UNTIL, INTERVAL, EXDATE, RECURRENCE-ID, DURATION and RDATE share one occurrence iterator;
  - expansion keeps wall-clock time, so a class does not move when daylight saving changes;
  - `TZID` values are treated as wall-clock time (documented limitation; Obsidian has no IANA database);
  - label and UI text is English-only rather than the original's 11 languages;
  - the visual note-template builder is not absorbed; the template is editable text in settings.
- **Audit notes (October 28, 2026):** plain JavaScript, single committed `main.js`, no build
  tooling, no dependencies (`package-lock.json` has no packages), no test suite in the
  repository. Version 1.2.0 was about a week old at audit time; the project may change quickly,
  which is why the baseline commit is pinned above.

The MIT notice that applies to those adapted parts:

```
MIT License

Copyright (c) 2026 Cesemess

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ts-fsrs

- **Project:** [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (npm package `ts-fsrs`)
- **Author:** Open Spaced Repetition
- **License:** MIT, Copyright (c) 2026 Open Spaced Repetition (verified in the package's `LICENSE` on October 29, 2026)
- **Version:** 5.4.1 (FSRS-6; chosen for its Node >=20 compatibility and because it is the version used by the MIT Spaced Repetition plugin at audit time. ts-fsrs 6.x is newer but requires Node 24.)
- **What was absorbed:** the published package's compiled CommonJS bundle, `dist/index.cjs`, vendored as `src/fsrs-lib.js`. It has no external `require()` calls and runs in the plugin's plain-JavaScript bundle.
- **Files in this repository that contain the work:** `src/fsrs-lib.js` (the vendored scheduler) and `src/fsrs.js` (the local adapter for note properties, ratings and history replay). The adapter is original code, not a copy of another plugin's wrapper.
- **Modifications:** the vendored bundle is unmodified except for a header comment naming the version and license, removal of the trailing `sourceMappingURL` comment, and trimming one whitespace-only line. The 21 default weights are FSRS-6.
- **Why this instead of copying LearnKit or Spaced Repetition:** both plugins are MIT, but both delegate FSRS to `ts-fsrs`; copying their wrappers would add Obsidian- and UI-specific code without adding a scheduler. The plan's candidate library is therefore used directly.

The MIT notice that applies to the vendored scheduler:

```
MIT License

Copyright (c) 2026 Open Spaced Repetition

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Bundled Reference content

The Reference module's formula list, constants and unit factors in `src/reference-data.js`, the
element facts in `src/reference-elements.js` and the small expression parser in
`src/reference-graph.js` are written for this plugin. No third-party formula-sheet PDF,
periodic-table dataset, calculator library or Desmos code is bundled. The formulas, constants
and element facts use standard definitions; course and exam formula sheets can differ in
rounding or notation.

## Not absorbed (yet)

The product plan also names LearnKit as a future absorb source. It has **not** been copied
into this repository. Its license, dependencies and architecture still need the audit
described in the plan before any code is reused.
