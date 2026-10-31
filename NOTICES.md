# Third-party notices

MCQ Tracker is MIT licensed; see [LICENSE](LICENSE). Copyright (c) 2026 Isaac Friedenson.

This file lists code and ideas taken from other projects. Each entry names the license,
the copyright holder, the exact version used, and which files in this repository contain
the work.

The build embeds this file and `LICENSE` into the generated `main.js`, so the notices travel with the file Obsidian installs.

## AP resource links

The AP resource hub in `src/ap-resources.js` contains only official College Board URLs,
short titles and original descriptions written for this plugin. It does not copy or bundle
AP questions, rubrics, scoring guidelines, sample responses, videos, unit guides or question
banks, and it does not scrape AP Classroom. AP is a trademark of the College Board; this
plugin is not affiliated with or endorsed by the College Board.

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

## Anki .apkg reader and writer

- **Project:** original code in this repository.
- **License:** MIT, same as the rest of MCQ Tracker.
- **What it does:** reads a user-provided `.apkg` ZIP, its uncompressed SQLite collection, and the `notes`, `cards` and `col` tables, and writes the legacy `collection.anki2` package for export. It does not bundle Anki, AnkiConnect, SQLite, a ZIP library, or any third-party importer. Archive paths are never extracted and no SQL is executed; the writer emits the small `col`, `notes`, `cards`, `revlog` and `graves` tables directly.
- **Files:** `src/apkg.js` (reader), `src/apkg-export.js` (package writer), `src/sqlite-write.js` (SQLite page writer), `src/zip-write.js` (stored ZIP writer) and `src/plugin.js` (import/export wiring).
- **Limitation:** Anki's newer zstd-compressed `collection.anki21b` packages are rejected with a text-export hint rather than guessed at. Export is text-only; images and audio are not bundled.

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

## SM-2 scheduler

`src/sm2.js` is an original clean-room implementation of the published SM-2 spaced-repetition rules, adapted for notes that store a review date rather than a time. No Better Recall, Anki, SuperMemo or other plugin code is copied into this file. The plan records the algorithm as research input only; the implementation, state format and tests are local work.

## Bundled Reference content

The Reference module's formula list, constants and unit factors in `src/reference-data.js`, the
element facts in `src/reference-elements.js` and the small expression parser in
`src/reference-graph.js` are written for this plugin. No third-party formula-sheet PDF,
periodic-table dataset, calculator library or Desmos code is bundled.

The chemistry equations and constants match the College Board **AP Chemistry Equations and
Constants (2025)**. Periodic-table masses and blanks match the College Board **AP Chemistry
Periodic Table of the Elements (2020)**. Only factual equations, constants and element data are
included; no AP PDF pages, questions, rubrics or other AP material are bundled. AP is a
trademark of the College Board; this plugin is not affiliated with or endorsed by the College
Board.

## Math, chemistry and SMILES fallback

`src/math-rendering.js` and `src/smiles.js` are original code written for this plugin. The SMILES renderer implements a documented teaching subset and draws it as local SVG; no Chem, RDKit, Ketcher or other structure-rendering library is bundled. Complex or unsupported SMILES is rejected rather than approximated. It rewrites a small, conservative subset of `\ce{...}` notation into ordinary MathJax at display time. No MathJax, mhchem, KaTeX or other renderer code is bundled, and complex chemistry is left for the user's mhchem setup.

## Read aloud, lecture compiler, course health and audio bookmarks

Four local study modules adapt MIT-licensed plugin concepts. In each case the source was read as a feature reference only: no source file, function or stylesheet rule was copied, and the implementation in this repository is original, dependency-free JavaScript. The MIT licence texts below are recorded so the provenance of the ideas is auditable.

- **Aloud TTS** — [obsidian-aloud-tts](https://github.com/adrianlyjak/obsidian-aloud-tts), MIT, Copyright (c) Adrian Lyjak (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: sentence-level highlight while reading a note aloud. `src/read-aloud.js` and the **Read aloud** tab in `src/study-workspace-view.js` build a local sentence plan and use the device speech voice; no audio is cached or uploaded.
- **LearnKit** — [learnkit](https://github.com/ctrlaltwill/learnkit), MIT, Copyright (c) Will (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: read-aloud TTS access to note text. Only the idea of speaking a note is used; no LearnKit code, card type, scheduler or parameter-fit code is bundled.
- **Voice Briefing** — [voice-note-obsidian](https://github.com/reallygood83/voice-note-obsidian), MIT, Copyright (c) reallygood83 (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: a short spoken briefing with style presets. The 90-second briefing, key-points and full-note styles in `src/read-aloud.js` are original implementations.
- **Lecture Transcriber** — [obsidian-lecture-transcriber](https://github.com/AbyssLotus/obsidian-lecture-transcriber), MIT, Copyright (c) AbyssLotus (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: combine several lectures into one study note with an overview, key concepts and a vocabulary table. `src/lecture-compiler.js` is an original Markdown compiler over this plugin's own lecture log; it performs no transcription and calls no model.
- **Course Command Center** — [CourseCommandCenter](https://github.com/flippinhutt/CourseCommandCenter), MIT, Copyright (c) flippinhutt (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: course health checks. `src/course-health.js` implements local checks over this plugin's course dashboard, planner and tasks; it has no Canvas client, OAuth flow or note-template code.
- **Advanced Audio Recorder** — [advanced-audio-recorder](https://github.com/akhmialeuski/advanced-audio-recorder), MIT, Copyright (c) akhmialeuski (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: timestamp bookmarks, chapters and copyable timestamp links. `src/audio-bookmarks.js` stores timestamps in plugin data and builds Obsidian media-fragment links; it does not record, edit or play audio.

## Scheduler fitting, study map and cited vault search (October 31, 2026)

Three more MIT-licensed plugin concepts are adapted here. The source projects were read as feature references; the implementations are original, dependency-free JavaScript, and no source file, function or stylesheet rule was copied.

- **LearnKit** — [learnkit](https://github.com/ctrlaltwill/learnkit), MIT, Copyright (c) Will (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: fitting the desired-retention target from the learner's own review history. `src/scheduler-fit.js` reads this plugin's own card counters and proposes a bounded target; no LearnKit scheduler or parameter-fit code is bundled.
- **Qard** — [qard-obsidian](https://github.com/kylianmarceau/qard-obsidian), MIT, Copyright (c) Kylian Marceau (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: FSRS self-fitting once enough ratings exist. `src/scheduler-fit.js` implements the local fit.
- **Spaceforge** — [spaceforge](https://github.com/dralkh/spaceforge), MIT, Copyright (c) dralkh (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: a visualise/summary workspace with a mind-map view. `src/study-map.js` builds an outline tree and key-term list from this plugin's own notes; it calls no model.
- **Gemini Helper** — [obsidian-gemini-helper](https://github.com/takeshy/obsidian-gemini-helper), MIT, Copyright (c) takeshy (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: search results with citations. `src/vault-search.js` ranks notes with a local index and links each snippet; no model or network request is made.
- **LLM Hub** — [obsidian-llm-hub](https://github.com/takeshy/obsidian-llm-hub), MIT, Copyright (c) takeshy (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: cited vault search across study notes. `src/vault-search.js` implements the local ranking and snippet citation.

## Not absorbed (yet)

The product plan also names LearnKit as a future absorb source. It has **not** been copied
into this repository. Its license, dependencies and architecture still need the audit
described in the plan before any code is reused.


## Shipped dependency audit

See [docs/license-audit.md](docs/license-audit.md) for the current inventory of bundled code, the packages with zero runtime dependencies, and the rule that every future reuse must be checked at its repository and recorded here before it is copied.
