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

## Grill

- **Project:** [grill](https://github.com/theadamdanielsson/grill) (Obsidian plugin)
- **Author:** Adam Danielsson
- **License:** MIT, Copyright (c) 2026 Adam Danielsson (verified in the repository's `LICENSE` on November 7, 2026)
- **Baseline:** commit `6dd05d884f8f9d77e684d6c814e160aaa5d2ea83` (version 8.7.12)
- **What was absorbed:** the idea of a persistent per-concept record, deterministic concept
  extraction from note structure, the 8-concept coverage target and 80% known band, source-hash
  reopening, reconciliation with orphan retention, and the shape of a bounded learner digest
  and misconception evidence.
- **Files in this repository that contain adapted work:**
  - `src/knowledge-record.js` — extraction, reconciliation, coverage, misconceptions and digest
  - `src/knowledge-store.js` — local, rebuildable index
  - `src/insights-view.js` — the Knowledge record panel, written in this plugin's own UI
  - `src/plugin.js` — commands, opt-in settings, attempt refresh and chat digest wiring
  - `tests/knowledge-record.test.js` — tests for the adapted logic
- **Marked as modified.** These are not verbatim copies: the logic was rewritten for this
  plugin's plain-JavaScript module layout, question-level FSRS model, `source_note` /
  `source_heading` links, error taxonomy, settings and Insights UI. Grill's theme, home, chat and
  test-session interfaces were not copied. Concept scheduling is projected from the existing
  question schedule instead of creating a second scheduler. See `plan.md` §5.27.

The MIT notice that applies to those adapted parts:

```
MIT License

Copyright (c) 2026 Adam Danielsson

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
- **Feynman Learning** — [obsidian-feynman-learning](https://github.com/jialingxiao/obsidian-feynman-learning), MIT, Copyright (c) jialingxiao (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: automatic evaluation of a Feynman explanation. The four-step cycle and manual scoring were already original work here; `src/feynman-ai.js` adds an optional AI second opinion through the plugin's existing bring-your-own-key AI settings, stored beside the manual score. No upstream prompt, rubric or code is copied.
- **Pick Me** — [pickme](https://github.com/sxinyuhoo/pickme), MIT, Copyright (c) sxinyuhoo (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: an annotation index with page and source navigation. `src/pdf-annotation-index.js` is an original read-only reader of this plugin's own PDF annotation sidecars; it has no PDF parsing, rendering or writing code.

## Scheduler fitting, study map and cited vault search (October 31, 2026)

Three more MIT-licensed plugin concepts are adapted here. The source projects were read as feature references; the implementations are original, dependency-free JavaScript, and no source file, function or stylesheet rule was copied.

- **LearnKit** — [learnkit](https://github.com/ctrlaltwill/learnkit), MIT, Copyright (c) Will (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: fitting the desired-retention target from the learner's own review history. `src/scheduler-fit.js` reads this plugin's own card counters and proposes a bounded target; no LearnKit scheduler or parameter-fit code is bundled.
- **Qard** — [qard-obsidian](https://github.com/kylianmarceau/qard-obsidian), MIT, Copyright (c) Kylian Marceau (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: FSRS self-fitting once enough ratings exist. `src/scheduler-fit.js` implements the local fit.
- **Spaceforge** — [spaceforge](https://github.com/dralkh/spaceforge), MIT, Copyright (c) dralkh (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: a visualise/summary workspace with a mind-map view. `src/study-map.js` builds an outline tree and key-term list from this plugin's own notes; it calls no model.
- **Gemini Helper** — [obsidian-gemini-helper](https://github.com/takeshy/obsidian-gemini-helper), MIT, Copyright (c) takeshy (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: search results with citations. `src/vault-search.js` ranks notes with a local index and links each snippet; no model or network request is made.
- **LLM Hub** — [obsidian-llm-hub](https://github.com/takeshy/obsidian-llm-hub), MIT, Copyright (c) takeshy (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: cited vault search across study notes. `src/vault-search.js` implements the local ranking and snippet citation.

## Portable card archive and study nudge (October 31, 2026)

Two more MIT-licensed concepts are adapted. The source projects were read as feature references; the implementations are original, dependency-free JavaScript, and no source file, function or stylesheet rule was copied.

- **Retain** — [retain](https://github.com/sejder/retain), MIT, Copyright (c) sejder (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: keeping card data in a store outside the notes. `src/card-archive.js` writes and restores one portable JSON archive; it does not move schedules out of notes or change the scheduler.
- **Better Task** — [better-task](https://github.com/st-vin/better-task), MIT, Copyright (c) st-vin (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: due-work reminders. `src/study-nudge.js` shows one in-app Notice per day and a ribbon label with quiet hours; it requests no OS notification permission and sends nothing.

## Course note templates (October 31, 2026)

- **Course Command Center** — [CourseCommandCenter](https://github.com/flippinhutt/CourseCommandCenter), MIT, Copyright (c) flippinhutt (licence verified via the repository's `LICENSE`, October 30, 2026). Concept adapted: note-type/template mapping for course notes. `src/course-templates.js` implements local templates and note creation; it contains no Canvas client, OAuth flow or network request.

## Sidebar study agent (November 3, 2026)

The right-sidebar **Study agent** (`src/agent-view.js`, `src/agent-note.js` and
the existing `src/chat-panel.js`) is original code written for MCQ Tracker. It
is covered by this repository's MIT license. No Obsidian Copilot source,
stylesheet, prompt or other AGPL-licensed code was copied into it, and no
Copilot package or runtime is bundled. The current composer hint is original
wording for this plugin; no Copilot prompt text is reproduced. The panel reuses
this plugin's existing AI provider settings and write-review guards. See
[docs/sidebar-agent.md](docs/sidebar-agent.md).

## Not absorbed (yet)

The product plan also names LearnKit as a future absorb source. It has **not** been copied
into this repository. Its license, dependencies and architecture still need the audit
described in the plan before any code is reused.


## Shipped dependency audit

See [docs/license-audit.md](docs/license-audit.md) for the current inventory of bundled code, the packages with zero runtime dependencies, and the rule that every future reuse must be checked at its repository and recorded here before it is copied.

## pdf-lib

- **Project:** [pdf-lib](https://github.com/Hopding/pdf-lib) (npm package `pdf-lib`)
- **Author:** Andrew Dillon
- **License:** MIT, Copyright (c) 2019 Andrew Dillon (verified in the package's `LICENSE` and `package.json` on November 4, 2026)
- **Version:** 1.17.1, the published UMD browser build `dist/pdf-lib.min.js`
- **What was absorbed:** the compiled browser bundle, vendored as `vendor/pdf-lib.js`. It parses and writes PDF object graphs: page trees, page rotation, AcroForm fields with their appearance streams, content streams, fonts and embedded images.
- **Files in this repository that use the work:** `vendor/pdf-lib.js` (the engine), `src/pdf-editor.js` (the bounded page, form and annotation operations), `src/pdf-editor-modal.js` (the editor window) and the `src/plugin.js` wiring. The operations, the window and the wiring are original code for this plugin.
- **Bundled inside that build:** `pako` (MIT, Copyright (c) 2014-2017 Vitaly Puzrin and Andrei Tuputcyn), `tslib` (Apache-2.0, Copyright (c) Microsoft Corporation), `@pdf-lib/standard-fonts` (MIT, Andrew Dillon) and `@pdf-lib/upng` (MIT, Photopea). The `tslib` Apache-2.0 banner is retained at the top of `vendor/pdf-lib.js`.
- **Modifications:** none. The file is byte-for-byte the published `dist/pdf-lib.min.js` (525,099 bytes, SHA-256 `0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f`), so it can be compared with the released artifact; the engine's own trailing `sourceMappingURL` comment is left as published. `scripts/check-vendor.js` fails `npm run check` if the file drifts.
- **Why this library:** page operations, form filling and flattening need real object-level PDF writing, not canvas tricks. pdf-lib is MIT, pure JavaScript with no native code, so it works on desktop and mobile, and it is the audited engine the plan's PDF gate asked for.
- **Deliberate limits:** XFA forms and editing the text of an existing page are not supported. The editor refuses them with a message instead of approximating them.

The MIT notice that applies to the vendored engine:

```
MIT License

Copyright (c) 2019 Andrew Dillon

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

The Apache-2.0 notice that applies to the bundled `tslib` helpers, retained inside `vendor/pdf-lib.js`:

```
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
```


## PDF++ (embedded native-viewer subsystem)

- **Project:** [obsidian-pdf-plus](https://github.com/RyotaUshio/obsidian-pdf-plus)
- **Author:** Ryota Ushio
- **License:** MIT, Copyright (c) 2023 Ryota Ushio
- **Version embedded:** 0.40.31 (`manifest.json` in the upstream repository)
- **What is bundled:** the unmodified upstream production bundle in `vendor/pdf-plus.js` and its stylesheet in `vendor/pdf-plus-css.js`. MCQ Tracker hosts the upstream plugin class as a child component; it does not reimplement the features or copy them into the plain-JavaScript modules.
- **Files:** `vendor/pdf-plus.js`, the appended PDF++ section of `styles.css`, `src/pdf-plus.js` (host and settings adapter), and `src/plugin.js` (lifecycle).
- **Modification:** none to the upstream bundle or stylesheet. The host supplies a namespaced manifest and stores PDF++ settings under MCQ Tracker's `data.json` entry.

The upstream MIT notice:

```
MIT License

Copyright (c) 2023 Ryota Ushio

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

### Upstream third-party notices

# Third Party Licenses

## Mozilla pdf.js

Portions of this software may include code derived from Mozilla pdf.js (https://github.com/mozilla/pdf.js).

Copyright 2012 Mozilla Foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

**Full text of the Apache License 2.0:**

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

## Tridactyl

Portions of this software may include code derived from Tridactyl (https://github.com/tridactyl/tridactyl).

   Copyright 2020 Colin Caine, Oliver Blanthorn and Koushien

   Tridactyl is licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.


                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS
