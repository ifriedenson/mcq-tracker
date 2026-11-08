# MCQ Tracker — Completed Plan

> Derived from [plan.md](plan.md) at commit `2ce2979` on November 8, 2026. This is a focused, read-only view, not the source of truth. It contains the shipped surface summary and every completed checkbox row from the plan.
>
> **112 completed checkbox rows** (98 top-level, 14 nested; 108 under the phased roadmap and 4 historical implementation records). The current plan also has **3 partial owner-gated rows** and **0 unchecked rows**; those are in [plan-to-implement.md](plan-to-implement.md). Narrative design notes, rejected ideas and external research scans remain in [plan.md](plan.md).
>
> A few checked rows record closed decisions (for example, the declined pronunciation row), not shipped features; they remain here because they are checked in the source plan. The shipped-surface table is copied verbatim from plan §A, so its test count is the count recorded there rather than the current status block.

## Shipped surfaces

Source: [plan.md §A](plan.md#a-what-is-shipped).

| Area | In the plugin | Where |
|---|---|---|
| **Practice and exams** | Quick Practice and Today, full-screen practice, timed tests with section blueprints and question ranges, adaptive difficulty, confidence/timing fluency signals, partial credit, mistake taxonomy, weak-spot drills, study skin, CBT exam blocks, session reports, results CSV export, Space/Enter/Esc keyboard map | `src/practice*.js`, `src/quick-practice.js`, `src/exam*.js`, `src/cbt-exam.js`, `src/adaptive-session.js`, `src/weak-spot*.js`, `src/session-report.js` |
| **Scheduling and review** | FSRS and SM-2, per-deck `request_retention` fitting, interval previews, docked whole-note review with undo and lapse actions, one mixed due queue across questions/cards/vocabulary, review calendar and workload estimate, Anki-style statistics, exam-aware interval caps, daily quiz and streak, reminders and opt-in OS notifications | `src/fsrs*.js`, `src/sm2.js`, `src/note-review-dock.js`, `src/due-queue.js`, `src/mixed-review.js`, `src/review-calendar*.js`, `src/study-stats*.js`, `src/os-notifications.js` |
| **Cards and vocabulary** | Card types including image occlusion, typed and dictated answers with cheap-first grading, AI fallback and a validated verdict, durable grade-later queue, self-grade fallback, a grader-accuracy summary (AI/local agreement, self-grades, overrides and an eight-week trend), cram sessions (Again 3m / Hard 5m / Good 10m / Easy 1d), a practice-only Mother cram loop (Know / Do not know), decks and course tagging, card archive, Vocabulary tab, offline WordNet import, glossary lookup, rule-based note→card extraction with preview | `src/cards*.js`, `src/cram.js`, `src/answer-types.js`, `src/card-grading*.js`, `src/image-occlusion-modal.js`, `src/card-archive.js`, `src/wordnet.js`, `src/glossary.js` |
| **Import and interop** | `.apkg` import/export, two-way AnkiConnect, CouchDB sync, Quizlet/Kahoot/Blooket/Gimkit CSV, Moodle GIFT and XML, QTI, Mochi, CrowdAnki, LearnKit, Markdown tables, study bundle export/import, portable card archive, service exports (Evernote, Keep, Notion, Airtable, Bear, Roam, HTML) | `src/apkg*.js`, `src/anki-connect.js`, `src/couchdb-sync.js`, `src/cards-import.js`, `src/importer.js`, `src/qti-archive.js`, `src/study-bundle*.js`, `src/service-import.js` |
| **Markdown blocks** | `mcq-quiz` inline blocks (choice, slider, text, weights, bands), `quiz-definition`/`playable-quiz` partial credit, `quiz-maker`, `quizport`, `sfc-cards`, `spaced-quiz`, `simple-note-quiz`, `tally`, `text-timer`, `tag-timer`, `study-map`, `sat-math`, `mindmap`, local `chem`/`biology`/`circuit` diagram blocks | `src/quiz-block.js`, `src/quiz-maker.js`, `src/quizport-view.js`, `src/sfc-cards.js`, `src/tally*.js`, `src/text-timer*.js`, `src/study-map.js`, `src/sat-math.js`, `src/mindmap.js`, `src/stem-diagrams.js` |
| **Courses, calendar, grades** | Course registry with identity/aliases, ICS import and filtered export, month grid and daily timeline, exams and countdowns, study blocks in free gaps, assignments/tasks/grades, course health, course templates, course notes, local recurring events, lecture log, Time blocks (Day/Week/Grid/Timeline, drag/resize, routines, backlog, project files, tags, subject colours, daily-note sync) | `src/course-*.js`, `src/calendar-*.js`, `src/assignments*.js`, `src/exams.js`, `src/local-events*.js`, `src/time-blocks.js`, `src/study-workspace-view.js` |
| **AI (optional)** | Direct API presets (OpenAI-compatible, Anthropic, Qwen/DashScope, Ollama, LM Studio, llama.cpp, Jan), OpenCode chat, streaming with Stop/Regenerate/Retry, tutor roles and slash commands, inline Quick Ask, Quick Chat, message bookmarks with chat links, per-message rewind and fork, saved study commands, per-chat and per-command model overrides with visible fallback, `/compact` local summarisation, `@` note/folder mentions, a context/token/model footer, a searchable conversation library with pins and archive, passage retrieval with citations, write guards with diff-confirm and undo journal, quiz generation with blind verification and distractor checks, AP FRQ rubric grader with second pass and history, Feynman feedback, PDF passage Q&A, offline local-model guide | `src/api-client.js`, `src/ai-*.js`, `src/agent-*.js`, `src/chat-*.js`, `src/quick-ask*.js`, `src/quick-chat-modal.js`, `src/study-commands.js`, `src/opencode-*.js`, `src/quiz-generator*.js`, `src/frq*.js`, `src/feynman-ai.js`, `src/reading-companion.js`, `src/local-models.js` |
| **Documents and ingestion** | PDF annotator (ink, highlights, quotes, notes, tags, searchable index, digest export, deep links), PDF page/form editor on vendored pdf-lib (rotate, reorder, insert, duplicate, delete, merge, extract, split, live forms, links, bookmarks, 20-step undo), continuous reader, embedded PDF++, EPUB annotations and reader, paper scanner, document import (`.pptx`/`.pptm`/`.ppsx`/`.docx`/`.docm`/`.odt`/`.odp`/HTML/Markdown), BYOK vision OCR with editable page text, lecture-note compiler, transcript import, audio bookmarks | `src/pdf*.js`, `src/epub*.js`, `src/paper-scanner.js`, `src/documents.js`, `src/ocr*.js`, `src/lecture-compiler.js`, `src/transcript*.js`, `vendor/pdf-lib.js`, `vendor/pdf-plus.js` |
| **Reference and STEM** | Graph with implicit, polar, parametric, 3D, sliders, regression, table, summation and complex modes; calculator, calculus, geometry, matrix/vector fields; constants and formula sheets; unit circle, trig identities, codon table, Punnett square; periodic-table data; local SMILES renderer; math-rendering audit and goldens; polynomial equivalence and numeric grading; computed-answer verification | `src/graph-*.js`, `src/calculator.js`, `src/calculus.js`, `src/geometry*.js`, `src/matrix.js`, `src/vector-*.js`, `src/reference-*.js`, `src/smiles.js`, `src/math-rendering.js`, `src/polynomial.js`, `src/numeric-grading.js` |
| **Study workspace** | 36 per-tool settings pages plus a Global index, and the workspace tabs (Cornell, lecture log, goals, Feynman, Recall Scheduler, topic planner, Study Flow, Subject Manager, quiz index, course hub, tasks, annotations, Deep Notes, Retention, Vocabulary, Quiz Maker, SFC cards, CBT, SAT math, Read aloud, lecture notes, bookmarks, Feynman AI, PDF annotations, scheduler fitting, study map, vault search, card archive, study nudge, reading library, course templates), writing-session count, vault task index and tag rename, opt-in Web browser | `src/study-tool-settings.js`, `src/settings-global.js`, `src/study-workspace*.js`, `src/vault-task-index.js`, `src/web-browser*.js` |
| **Advanced Tables** | Upstream 0.23.2 parity: draft completion, cell editing and Tab/Enter navigation in reading and source views, row/column insert/delete/move, formatting and alignment, TBLFM formulas (datetime and duration aware), CSV/TSV import, transpose, header toggle, stable body-row sorting, merged cells, controls panel | `src/table-editor.js`, `src/table-formulas.js`, `src/table-controls-view.js`, `src/table-csv-modal.js` |
| **Canvas** | Six clean-room slices: Canvas ⇄ Markdown, map walking and auto-layout, kanban columns, auto-link, query groups, presentations | `src/canvas-*.js` |
| **Quality** | 2,409-test suite, capability and security inventories re-derived by tests, dynamic-code lint, vendor guard, one release note per version, licence audit and `NOTICES.md` | `tests/`, `docs/capability-inventory.md`, `docs/security-inventory.md`, `scripts/` |

## Completed roadmap

Every checked `[x]` row from the phased roadmap, in phase order. The three `[~]` owner passes are omitted here and linked in the future file.

### Phase 0: Foundations and safety

> Three owner-gated rows are omitted here; see [plan-to-implement.md](plan-to-implement.md#open-owner-passes).

- [x] Module system: every module off by default, lazy-loaded, with first-run presets (§4.5)
- [x] Shared AI service layer: BYOK + OpenCode, capability flags, queue, cost caps (§4.6) — shipped in 1.79.0; the grade-later queue is the offline/retry path
- [x] Move API keys to Obsidian secret storage where supported (§4.4) — shipped in 1.75.0, with a plain-text fallback for older app versions and one-time migration
- [x] Publish the property schema and a data contract (§6) — schema version 1 and the stability rules shipped in 1.76.1, building on the 1.39.0 schema page
- [x] Item-type model (§4.2)
- [x] Append-only `history` with unique attempt ids, duplicate-safe retries, a merge helper and phone/desktop conflict tests (§5.19) — shipped in 1.76.0; the repair command also rebuilds counters and streak, while scheduling is left unchanged
- [x] Test suite, CI, and quality gates for agent-written code (§8.5)
- [x] Confirm licenses of anything currently bundled (§9) — audited in NOTICES and `docs/license-audit.md`; every future candidate still needs a repo-level check before use

### Phase 1: Quick Practice and smarter scheduling

- [x] Quick Practice entry and Today screen (§5.19)
- [x] FSRS scheduler option + time/confidence fluency signals; migration from existing `history` (§5.1) — logged skip signal shipped in 1.89.0 (§5.23)
- [x] Adaptive difficulty pick mode (§5.2)
- [x] Offline-tolerant sessions

### Phase 2: Flashcards and vocab (priority)

- [x] Card and vocab item types, deck organization, course tagging (§5.7) — shipped in 1.12.0
- [x] Image occlusion cards, one card per mask (§5.7, §5.22.4) — shipped in 1.19.0
- [x] Tutor role presets and slash commands (§5.18, §5.22.4) — shipped in 1.20.0
- [x] Moodle GIFT import (§5.22.3) — shipped in 1.21.0
- [x] Moodle XML and QTI import (§5.22.3) — shipped in 1.22.0
- [x] Mochi Markdown and CrowdAnki JSON import (§5.22.3) — shipped in 1.23.0
- [x] Import preview, report and duplicate update/copy (§5.22.3) — shipped in 1.24.0
- [x] Card syntax compatibility and importers: Spaced Repetition, Anki, Quizlet, Kahoot, Blooket and Gimkit CSV import/export (§5.15) — desktop `.apkg` import shipped in 1.50.0, `.apkg` export in 1.116.0, two-way AnkiConnect sync in 1.51.0, Quizlet PDF/test-bank import in 1.102.0 and its device file picker in 1.103.0; LearnKit import/export shipped in 1.114.0
- [x] Answer modes: flip, type and speak via an editable microphone transcript (browser SpeechRecognition; OS dictation still works), with the deterministic cheap-first grading pipeline (§5.17)
- [x] AI fallback for typed answers that the local grader cannot settle, using the shared AI layer and a validated structured verdict (§5.17)
- [x] Durable grade-later queue for offline, slow or over-budget grading, with batch retry, idempotency and a pending-grade badge (§5.17)
- [x] Self-grade fallback when AI grading is off or the queue is discarded, recorded as `graded_by: self` (§5.17)
- [x] Unified due queue model and Today/command list across cards, vocab and MCQs — interleaved mixed-review sessions shipped in 1.55.0
- [x] Pending-grade visibility in Today and the Cards list, with per-card Review actions and a Grade now retry control (§5.17)
- [x] **Decided — device speech only** Optional TTS/audio — the owner kept the existing device voices and declined provider TTS, audio-only commute and mobile audio work (§11 decision 2 / E5); exam-aware scheduling caps have landed (§4.3).

### Phase 2b: AP exam tools (research next; highly wanted)

- [x] **Scope complete, no accuracy claim — AP FRQ grader** — rubric-based, partial-credit grading with per-criterion feedback, self-grade fallback, score history, second pass, official-rubric marker, rubric categories and a scheduler/study-plan feed shipped in 1.97.0–1.101.0 for six courses (§5.20); photo-of-handwritten-work reading shipped in 1.104.0; the owner declined a human-scored accuracy claim (§11 E6).
- [x] **PDF→FRQ import** — command/picker reads a vault PDF text layer, splits prompts and rubrics, reviews/edits/discards them in a preview, then creates ordinary FRQ notes through `buildFrqNote`/`createFrqNote`; typed or dictated answers grade through the existing rubric grader. Shipped text-layer only (no OCR/vision fallback); no dependency, bundled content, new schema or accuracy claim; covered by `tests/frq-import.test.js`. (§5.20)
- [x] **AP score calculator** — four 2027 profiles, weighted section and part inputs, editable practice cutoffs, incomplete estimates, a likely band and a reverse "what do I need?" calculation (§5.20) — shipped in 1.56.0
- [x] **Saved AP practice-exam history** — save a complete result as an ordinary note, list attempts newest first, show the average and change from the previous attempt (§5.20.2) — shipped in 1.58.0; per-question FRQ history shipped in 1.95.0 and per-section trends in 1.96.0
- [x] **AP resource hub** — one place for official AP Central/AP Classroom links, course and exam descriptions, released FRQs and scoring guidelines, AP Videos, and exam dates (§5.20) — link-only version shipped in 1.57.0; resource notes, course/unit tags and stale-link checks shipped in 1.59.0; calendar/Today integration shipped in 1.60.0–1.62.0
- [x] **AP resource notes** — save an official link as a tagged note with course, optional unit, type, URL and checked-on date; list saved notes and warn when a link is older than 180 days (§5.20.3) — shipped in 1.59.0
- [x] **AP resource recommendation on Today** — match the next AP exam to saved resources for its course, prefer fresh practice material, label stale links and open the note in one click (§5.20.3) — shipped in 1.60.0
- [x] **AP exam-specific resource attachment** — bind a saved resource note to one calendar exam with `exam_uid`, `exam_date` and `exam_title`, prefer the attached note over generic matches, and attach in one click from Today (§5.20.3) — shipped in 1.61.0; study-block attachment shipped in 1.63.0
- [x] **Attached resources in the calendar exam panel** — show the resource bound to each exam in the Upcoming exams panel, open it in one click, and detach the binding from Today (§5.20.3) — shipped in 1.62.0
- [x] **Study-block resource attachment** — suggest a saved resource for the next class in the free-time chooser, bind it to that date and start time, and detach it without changing the exam binding (§5.20.3) — shipped in 1.63.0
- [x] **Resource link in the exam class note** — add the attached resource as a wikilink under a managed `## AP resources` heading, creating the note when needed and skipping duplicates (§5.20.3) — shipped in 1.64.0
- [x] **Binding management in Reference** — label exam and study-block bindings on saved resource notes and detach either one without touching the other (§5.20.3) — shipped in 1.65.0
- [x] **Research specification** — supported-course recommendation, rubric and score-profile schemas, evaluation plan, copyright/permissions questions, data model, UX flows, and acceptance tests ([spec](docs/ap-frq-grader-spec.md), §5.20)
- [x] **No numeric threshold** **Pilot gate passed** — the owner approved six courses and user-supplied prompts on 2026-10-29; 1.97.0 shipped the pilot, 1.98.0 added the second pass and 1.99.0 added the review schedule and study-plan feed. The owner set no go/no-go bar, so the pilot stays approved and shipped, never validated (§11 E6).

### Phase 3: Calendar and courses (priority)

- [x] Course registry (name, code, folder, color, semester, instructor and credits), folder mapping, `.ics` import, per-class notes (§5.8) — full registry in 1.101.0
- [x] Month grid, daily timeline, live countdown, mobile Today and Upcoming views
- [x] Exam model, exam countdowns, SAT/AP-style non-semester exam events
- [x] **Exam-aware scheduling caps (§4.3)** — shipped. Cap ladder and FSRS due dates before a matching exam; never extend an interval; leave unknown courses untouched.
  - [x] Apply the cap after ladder/FSRS scheduling and explain it in the result summary.
  - [x] Test ladder, FSRS, no exam, exam after the due date, exam before it, exam day, two exams for one course, and unknown courses.
- [x] Suggested study blocks in free gaps
- [x] Filtered `.ics` export

### Phase 4: AI assistant and generation

- [x] Study-aware assistant: tutor mode, quick actions, context toggles (§5.18) — shipped across 1.66.0–1.71.0
  - [x] Read-only aggregate study context behind three default-off toggles, with no note text (§5.18) — shipped in 1.66.0
  - [x] Per-chat current-note and selection context, both default off, plus the study quick actions (plan my week, mistakes study guide) and the tutor command menu (§5.18) — shipped in 1.71.0
- [x] Enforced write protections, diff-and-confirm, undo, prompt-injection defenses
  - [x] Device-local undo journal for confirmed AI-generated notes, with a command to remove the last batch (§5.3, §5.18) — shipped in 1.67.0
  - [x] Marked AI course-note summaries that undo can remove without deleting the extracted page text (§5.13) — shipped in 1.68.0
  - [x] Code-level AI write guard: destination allow-list, protected tracking properties, and untrusted-data boundaries for lecture/PDF prompts — shipped in 1.72.0
  - [x] Field-level diff and review confirmation for existing-card imports (§5.22.3) — shipped in 1.73.0
  - [x] Agent-mode protected-state snapshot and restore, so review history survives an agent edit (§5.18) — shipped in 1.74.0
  - [x] Agent-edit diff review, per-file approval and undo (§5.18) — shipped in 1.87.0
  - [x] Bulk calculation verification preview with selective apply and conflict detection (§5.16.5) — shipped in 1.88.0
- [x] AI question and card generation in plugin formats (§5.3) — shipped in 1.69.0 and extended in 1.89.0
  - [x] Preview-first weak-spot generation for questions and cards, with no note text sent and undo through the AI write journal (§5.3) — shipped in 1.69.0
  - [x] **Generate practice from any note or selected PDF** with a preview of count, difficulty and destination; reuse the write guard, undo journal and blind verification (§5.3, §5.23) — shipped in this working tree
  - [x] Per-note subtopic coverage memory for generated questions (§5.3, §5.23) — shipped in this working tree
- [x] Blind verification pass for generated and imported answers (§5.4) — shipped in 1.70.0: an independent call solves each AI-written multiple-choice answer without the key, mismatches are flagged or dropped, and `verified`/`verified_by`/`verified_on` plus a visible banner are written.
- [x] Weak-spot-targeted generation (§5.3) — shipped in 1.69.0
- [x] Adaptive session sizing for Quick Practice and the daily quiz (§5.2, §5.23) — shipped in 1.89.0
- [x] Logged "don't know" skip signal for fluency and Insights (§5.1, §5.23) — shipped in 1.89.0
- [x] Optional in-app daily reminder or status-bar nudge (§5.23) — shipped in 1.89.0
- [x] Agent mode via OpenCode (desktop) and allow-listed tools for BYOK — shipped in 1.90.0

### Phase 5: FRQ and STEM

- [x] **Typed FRQ, rubric grading, override and per-criterion feedback** (§5.5; AP-specific research in §5.20) — shipped in 1.97.0 for the six AP pilot courses; second pass and official/teacher rubric marker in 1.98.0, and the scheduler/study-plan feed in 1.99.0. Mixed MCQ/SPR/FRQ timed tests shipped in 1.100.0; rubric categories and the answer math preview in 1.101.0.
- [x] Numeric answer grading for SPR items (§5.16.3) — shipped in 1.81.0 with fractions, decimals, scientific notation, percentages, tolerances, ranges, multiple answers, significant figures, unit conversion and an interpretation on every result
- [x] Parameterized questions with seeded numeric variants, placeholders and computed answers (§5.16.4) — shipped in 1.82.0
- [x] Verification by computation for numeric answers (§5.16.5) — shipped in 1.83.0
- [x] Imported PDF figures and normal Obsidian embeds display in practice, timed tests and reviews (§5.16.7) — shipped in 1.84.0
- [x] Local Basic/Scientific calculator in Reference, with a timed-test guard (§5.16.8) — shipped in 1.85.0
- [x] Math, chemistry, and physics: formula sheets, local SMILES structures, numeric grading and parameterized questions ship (§5.16) — SMILES rendering shipped in 1.91.0
- [x] Timed tests with sections, separate timers and saved blueprints (§5.6) — shipped in 1.77.0; confidence calibration and average time per question shipped in 1.78.0; mixed MCQ/SPR/FRQ items shipped in 1.100.0

### Phase 6: Plans, time, and dashboard

- [x] Study plan and cram mode (§5.11) — first exam-scoped slice shipped in 1.30.0
- [x] Focus timer and study-time logging (§5.10) — shipped in 1.29.0
- [x] Analytics dashboard (§5.12) — shipped in 1.31.0
- [x] Embeddable analytics widgets (§5.12) — shipped in 1.32.0
- [x] Assignments, tasks, and grades (§5.9) — shipped in 1.35.0

### Phase 7: Ingestion, interop, polish

- [x] Provenance links on imported questions and extracted cards, with a source action on a miss (§5.13, §5.14) — shipped in 1.36.0
- [x] Visual pen/highlighter overlay for rendered PDF pages, with normalized strokes in the annotation sidecar (§5.13, §5.22.4) — shipped in 1.52.0
- [x] Visual text boxes on rendered PDF pages, with placement, editing, erasing and sidecar persistence (§5.13, §5.22.4) — shipped in 1.53.0
- [x] Visual highlight regions on rendered PDF pages, with an optional note, editing, erasing and sidecar persistence (§5.13, §5.22.4) — shipped in 1.54.0
- [x] Transcript-to-practice flow: detect transcript notes, draft cards or questions with a preview, and keep the source note link (§5.13, §5.14) — shipped in 1.37.0
- [x] Local course-notes import for PDF, slide, Word and text sources, with page/slide headings, source links and optional PDF figure copying (§5.13) — shipped in 1.43.0
- [x] Optional AI summary and key-terms section for course notes, marked with the model and preserved when the summary fails (§5.13) — shipped in 1.44.0; local auto-classification shipped in 1.47.0; §11 E3 closed the bundled-engine question, so the BYOK vision path is the shipped route and no bundled engine is scope
- [x] Paper scanner: camera or photos → crop, rotate, reorder → one PDF saved in the vault (§5.13.1) — shipped in 1.46.0; automatic classification shipped in 1.47.0; §11 E3 closed the bundled-engine question, so the BYOK vision path is the shipped route and no bundled engine is scope
- [x] OCR for image-only scans: opt-in BYOK vision path with editable per-page text and a Markdown OCR note. The desktop user-installed OCR command adapter shipped in 1.49.0 and was removed in 1.86.0, so the plugin no longer requires `child_process` or `fs` directly; §11 E3 closed that gap on Nov 1, 2026 — no bundled engine, and the BYOK vision path is the shipped route
- [x] Auto-classify a text document as MCQ, FRQ, mixed, cards or notes, then route it through the existing importers (§5.13.1) — shipped in 1.47.0; image-only OCR shipped through the opt-in vision path in 1.49.0
- [x] Provenance links from generated items back to the source PDF page (§5.13.1) — shared with 1.36.0
- [x] First-run welcome screen with presets, module toggles and a short how-to guide (§5.21) — shipped in 1.28.0
- [x] Reopen the welcome from a command and settings, and remember dismissal per device (§5.21) — shipped in 1.28.0
- [x] Optional external feedback and donation links, configurable under Global → About and never gating features (§5.21) — shipped in 1.41.0; the local in-plugin survey form shipped in 1.115.0
- [x] CSV export of a per-note summary and full attempt history for outside analysis (§5.15) — shipped in 1.38.0
- [x] Anki plain-text export with deck, note type and tag columns (§5.15) — shipped in 1.39.0
- [x] Documented property schema and Dataview examples in [docs/property-schema.md](docs/property-schema.md) (§5.15) — shipped in 1.39.0
- [x] Optional AnkiConnect push to a running Anki desktop, with duplicate reporting (§5.15) — shipped in 1.40.0
- [x] Optional `.apkg` import through a local ZIP/SQLite reader, with scheduling metadata (§5.15) — shipped in 1.50.0; `.apkg` export through a local SQLite writer and stored-ZIP writer in 1.116.0
- [x] Bidirectional AnkiConnect sync with note-ID mapping, content hashes and conflict handling (§5.15) — shipped in 1.51.0
- [x] Notes ↔ practice links — **Reread this** and source backlinks shipped in 1.36.0; the Insights **Concepts** mastery list shipped in 1.107.0 (§5.14)
- [x] Exam/quiz import breadth — GIFT, Moodle XML, QTI, Mochi Markdown and CrowdAnki shipped in 1.21.0–1.23.0; FlashQuiz `@mc`/`@sata`/`@tf`, QuizPort JSON and Markdown checkbox quizzes shipped in 1.108.0; zipped Canvas/Blackboard QTI archives are read in 1.109.0 and LearnKit blocks/quick cards in 1.114.0 (§5.22.3)
- [x] Card and question export — Anki text, Anki `.apkg` (1.116.0), CSV, Markdown, JSON, Mochi `.mochi` (1.113.0) and LearnKit (1.114.0) shipped (§5.15)
- [x] **Declined** Pronunciation feedback for language learners — no audio capture or speech scoring (§11 E5).
- [x] Handwritten-work photo reading — shipped in 1.104.0 as an opt-in vision transcript; since 1.107.0 one answer can use up to eight photos read in order and appended, recorded as `answer_pages`; grading still runs on text

## Other completed implementation records

These are checked implementation records outside the phased roadmap. They are kept because they are completed in the source plan.

### 13.9 What this changes in the backlog

- [x] **Native select-all, true/false, fill-in and matching practice.** True/false and select-all practice shipped in 1.110.0 with automatic set grading, selectable buttons, attempt history, timed-test support and result marking. Fill-in (`question_type: fill_in`, normalized text with `|` and `accepted_answers` variants) and matching (`question_type: matching`, `Left :: Right` pairs under `## Pairs`, shuffled row pickers, whole-set and per-row grading in practice and timed tests) shipped in 1.112.0. Import already understands `@sata`, `@tf` and QuizPort choice sets (1.108.0).
- [x] **Lighter multi-question authoring.** Shipped in 1.128.0 as **Quick add questions** (§5.22.10): pasted blocks are previewed and written as one ordinary question note each, with a plain-text fallback for SPR items.
- [x] **Timed-test option shuffling and a pass-score threshold.** Shipped in 1.117.0. The test setup screen has **Shuffle answer choices** and a pass percentage, both saved in defaults and blueprints. A shuffled order is stored with the session, so the review and a reopened test show the same order while saved answer letters still match the note. The pass mark is reported on objective questions.
- [x] **Leech handling** for repeatedly failed items, shipped in 1.111.0 as an opt-in threshold with a flag or suspend action, `leech_lapses`/`leech_since` properties and automatic clearing on a correct answer. Distinct from the manual Suspend/Bury controls.

## Not included

The following are intentionally not copied here: narrative architecture and design sections, the research/source-map inventories, the owner decision history, and the **Decided against** table. They remain in [plan.md](plan.md) and are not open work.

See [plan-to-implement.md](plan-to-implement.md) for the current owner gates and captured future ideas.
