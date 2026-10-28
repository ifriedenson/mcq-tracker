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
- **What was absorbed:** the calendar parser and expander (`parseICS`, `parseICSDate`, `expandRecurringEvents`), calendar URL normalization (Google `?cid=`/`?src=` and `webcal://`), class-detail parsing (`parseUniDetails`), subject cleaning (`cleanSubjectTitle`), note naming and note templates, the `.ics` export format, and the month-grid, daily-timeline and live-countdown presentation.
- **Files in this repository that contain adapted work:**
  - `src/calendar-ics.js` — parser, recurrence expander and exporter
  - `src/calendar-model.js` — class details, subject cleaning, note variables, templates, folder mapping
  - `src/calendar-notes.js` — class-note creation built on those helpers
  - `src/calendar-view.js` — month grid, day timeline, countdown and `uni-schedule` embed
- **Marked as modified.** These are not verbatim copies: every file was rewritten for this
  plugin's plain-JavaScript module layout, its `qt-` styles and its settings model. Documented
  changes:
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

## Not absorbed (yet)

The product plan also names LearnKit as a future absorb source. It has **not** been copied
into this repository. Its license, dependencies and architecture still need the audit
described in the plan before any code is reused.
