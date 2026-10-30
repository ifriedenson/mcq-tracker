# MCQ Tracker → Ultimate Study Tool: Product & Integration Plan

**Status:** Implementation in progress — 1.115.0 adds a local-only in-plugin feedback survey, on top of 1.114.0's LearnKit import/export, 1.113.0's Mochi `.mochi` export, 1.112.0's native fill-in and matching practice, 1.111.1's true/false key fixes and offline leech handling, 1.111.0's opt-in leech handling, 1.110.0's native true/false and select-all practice and 1.109.0's zipped Canvas/Blackboard QTI archives, 1.108.0's FlashQuiz, QuizPort and Markdown-quiz import, 1.107.0's Insights Concepts mastery list and multi-photo FRQ answers, 1.106.0's one-screen reference sheets, 1.105.0's Learn, Test and Match study modes, 1.104.0's opt-in photo-of-handwritten-work reading to the FRQ grader, 1.103.0's device file picker for Quizlet PDF import, 1.102.0's local Quizlet PDF/test-bank import, 1.101.0's full course registry, FRQ math preview and rubric categories, 1.100.0's mixed MCQ/SPR/FRQ timed tests, 1.99.0's score-based FRQ review schedule, 1.98.0's optional second grading pass and official/teacher rubric marker and 1.97.0's six-course AP FRQ pilot. Remaining blocked items: the real-Obsidian visual/screenshot pass, a real-device mobile audit, TTS provider/mobile validation, and PDF form filling/full editor. Human-scored FRQ calibration remains a quality gate, not an implementation gate.
**Prepared:** October 27, 2026
**Revision:** Added decisions confirmed by the owner (§0), math/STEM (§5.16), typed/spoken flashcard answers (§5.17), AI assistant (§5.18), mobile quick sessions (§5.19), AP FRQ grader/score calculator/resource research (§5.20), growth plan (§10b), agent-driven quality gates (§8.5), the October 28 idea backlog (§5.22), and the Adaptive Practice parity audit (§5.23, Oct 29, 2026). Roadmap re-ordered (§7).
**Base plugin:** [MCQ Tracker](https://community.obsidian.md/plugins/mcq-tracker) (MIT, v1.5.1 at time of research)

> **How to read the license notes.** License information below comes from each plugin's community page, README, or a stats/index site as seen during research on Oct 27, 2026. Items marked **Verify** were not confirmed. Before copying any code, open the repo's `LICENSE` file and `package.json` yourself. MIT allows reuse if you keep the copyright and license notice. This is not legal advice.

---

## Current focus (Oct 29, 2026)

**Latest completed (1.115.0):** Settings, About now has an optional **feedback survey**: a rating, what the learner uses the plugin for, free-text strengths and improvements, and a quote permission toggle. **Copy feedback** builds a Markdown summary for the clipboard; nothing is sent, saved to the vault or counted, and there is no telemetry. The form is local-only and every field except the rating is optional.

**Previously (1.114.0):** Cards can be imported from and exported to **LearnKit**. The importer reads LearnKit's pipe blocks (`T`, `Q`, `A`, `CQ`, `MCQ`, `O`, `RQ`, `OQ`, `G`), single-line quick cards (`question::answer`, `question:::answer`, `cloze::...`) and `::`/`:::` combo cards. Groups become decks and tags, ordered questions become basic cards with the order on the back, and hotspot cards are skipped with a reason. The exporter writes the same block format as a Markdown note; LearnKit adds its anchors when the note is synced. The Cards import and export dialogs, Settings and the export command offer it. Nothing is uploaded and no dependency was added.

**Previously (1.113.0):** Cards can be exported as a **Mochi `.mochi` archive**. It is a ZIP containing `data.edn` in Mochi's documented version-2 format, grouped by deck, with each card's front and back separated by `---`. The Cards export dialog, Settings, Cards, Decks and the export command offer it; files go under the card folder's `exports` directory. Images and audio stay in the vault, and the result warns when a card references them. The archive is written with a small stored-ZIP writer, so no dependency was added.

**Previously (1.112.0):** Practice now handles **fill-in** and **matching** questions natively. `question_type: fill_in` is graded by the SPR text/numeric grader, which now ignores case, extra spacing, surrounding punctuation and a leading article; `|` and `accepted_answers` add variants. A `question_type: matching` note lists `Left :: Right` pairs under `## Pairs`; practice and timed tests show one shuffled dropdown per row, require a pick for every row, grade the whole mapping and mark each row in the result. A pick is stored as an answer position, so an attempt grades the same after a restart. Nothing is uploaded and no dependency was added.

**Previously (1.111.0):** Practice has optional **leech handling**. Settings, Practice adds a threshold (0 by default, so nothing changes until it is set) and an action. When a question misses that many times in a row, the attempt sets `leech: true`, `leech_lapses` and `leech_since`, and the result view explains the mark; the optional suspend action also hides it until it is restored under Hidden study items. A correct answer resets the count and clears the mark, and a question that already has a study status is never overwritten. 1.111.1 tightens this: a bare `F` answer with ordinary choices stays a multiple-choice key, a numeric key is not read as true/false, and offline-queued attempts now apply the leech settings when they are replayed.

**Previously (1.110.0):** Practice now handles **true/false** and **select-all-that-apply** questions natively. A note with `question_type: true_false` shows two True/False buttons, and `select_all` lets you toggle one or more choices before submitting; both grade the answer automatically, write the usual attempt history and appear in timed tests and the test review. Keys are read from a letter, a word (`true`, `False`, `T`) or a set (`A, C`, `A/C`, `A and C`, `AC`), including `Correct Answers: A, C` in the Answer section. Select-all compares exact sets, so a missed or extra choice is wrong. The practice and test result views mark the key, your picks and the missed choices. Nothing is uploaded and no dependency was added.

**Previously (1.109.0):** The QTI importer now accepts the **zipped archive** Canvas and Blackboard export. It reuses the existing local ZIP central-directory reader, ignores `imsmanifest.xml`, parses every question XML inside, and sends the combined cards through the normal preview, duplicate and report path. Nothing is extracted to disk; a `.zip` stays desktop-only because it needs the local decompressor, and mobile keeps the plain `.xml` path.

**Previously (1.108.0):** The Cards importer now reads three more quiz sources. **FlashQuiz** text uses a prompt, an `@mc`, `@sata` or `@tf` tag and checked, `+`/`-` or `Answer:` options. **QuizPort JSON** accepts a question array or an object with a `questions` array, with string or `{ text, correct }` choices and an index, letter or text answer. **Markdown checkbox quizzes** treat each `##`/`###` heading as a question and its `- [ ]`/`- [x]` lines as choices, with multiple correct boxes allowed. All three reuse the existing preview, duplicate and report path; nothing is uploaded.

**Previously (1.107.0):** Insights has a **Concepts** tab. It groups practice accuracy by the note each question came from (`source_note`), weakest first, colours each row, and opens the source note in one click; notes with no attempts stay listed last. The FRQ grader now accepts up to eight photos for one answer. Each page is read in the order chosen and appended to the answer box, a failure on a later page keeps the pages already read, and a saved attempt records `answer_pages`. Both are local-only: no note text or image is uploaded by the list, and photos are sent only when the button is pressed.

**Previously (1.106.0):** Reference has a **Sheets** tab with four one-screen references. The **unit circle** lists 16 common angles with radians, sin, cos and tan. **Trig identities** groups the Pythagorean, reciprocal, sum/difference, double-angle and triangle rules. The **codon table** covers all 64 RNA codons, searches by codon or amino acid and accepts DNA spelling. The **Punnett square** builds a one-gene cross from two parent genotypes and reports genotype counts plus the dominant/recessive split. All data is bundled and local; no calculator service, network request or third-party dataset is used.

**Previously (1.105.0):** the optional Quizlet-style study skin now has four modes. **Flashcards** keeps the flip and choice review. **Learn** brings a missed card back once later in the same session. **Test** hides the answer until the end and then lists every item with your answer, the key and a percentage. **Match** pairs up to six prompts with their answers on a two-column board, records one normal review per correct pair and nothing for a wrong tap. All four reuse the same filtered queue, history and scheduler, and the mode is a setting beside the skin.

**Previously (1.104.0):** the FRQ grader can read a photo of handwritten work. **Read a photo of handwritten work...** accepts one PNG, JPEG, WebP, GIF or HEIC image from the device, sends only that image, only when the button is pressed, to the `handwriting` feature on the Direct AI vision model, and puts the transcript in the answer box. Reading and grading stay separate: the transcript is editable, self-grading still needs no AI, and a saved attempt records `answer_source: photo`. The photo itself is never written to the vault. OpenCode cannot receive images, so it shows a clear message instead of failing silently.

**Previously (1.103.0):** the Quizlet PDF importer now has a **Choose PDF from device...** action in the Cards import dialog. The learner can pick a PDF from outside the vault; the file is read locally, never uploaded, and no copy is written into the vault. Preview, duplicate handling, import keys and card writing are identical to the vault-file path. The vault-file picker remains available, and switching back uses **Use a vault file**.

**Previously (1.102.0):** Quizlet **text exports or PDF test banks** can be imported into the Cards module. The PDF path reads the text layer locally through the plugin's existing PDF reader, drops Quizlet page furniture and repeated print headers, keeps column gaps as term/definition separators, and recognises either printed flashcard rows or numbered test questions with choices and an answer key. It shows the first extracted cards in the preview, then writes normal flashcard notes with `import_format: quizlet-pdf`, `source_page` and the usual duplicate handling. Scanned PDFs stop with an OCR hint instead of guessing. No new dependency or third-party code was added.

**Previously (1.101.0):** the Calendar now has a full course registry: name, code, folder, color, semester, instructor and credit weight in Settings, Calendar, Courses. A registered course drives class-note folders and calendar colors, and its credits fill the GPA when Assignments has no explicit credit. The FRQ grader shows a local **Math preview** under the answer box for `$...$`, `$$...$$` and `\ce{...}`, and rubric rows carry a category (`[thesis]`, `[evidence]`, `[reasoning]`, `[calculation]`, `[units]`, `[notation]`, `[communication]`), inferred from the label when omitted and included in the saved attempt and AI payload.

**Previously (1.100.0):** timed tests can include a chosen number of FRQ prompts alongside MCQ and SPR items. FRQ responses count toward each section's item total, are written in the timed test, are not counted as objective correct or incorrect, and are restored with a saved session. After the test, each response opens the existing FRQ grader with its answer prefilled for self-grading or optional AI grading. Blueprints keep the FRQ count.

**Previously (1.99.0):** every saved FRQ attempt writes `frq_review_interval` and `frq_next_review` to its prompt note. Below 60% returns in one day, 60–79% in three days, 80–89% in seven and 90%+ in fourteen; any missed rubric criterion caps the wait at three days. Due prompts appear in Today and in the next exam's study plan with a direct **Practice FRQ** button, and each Insights weak-criterion row opens the prompt where it was missed.

**Previously (1.98.0):** the AP FRQ grader added an optional second independent AI pass. It compares both passes criterion by criterion, reports disagreements without averaging them, and requires the learner to resolve them before saving. A pasted rubric can be marked `rubric_source: official`, and attempts record `second_pass` and `criteria_disagreed`. Saved missed criteria now appear in Insights → Weak spots. This closes the §5.5 second-pass, rubric-source and weak-spot visibility gaps for the six-course pilot.

**Completed in 1.24.0: import preview, report and duplicate handling (§5.22.3).** Imports now stage a readable preview before writing, and duplicate keys no longer have only one outcome.

**What shipped in 1.24.0**

- **Preview:** every importer reports ready, duplicate and issue counts before writing; CSV keeps its column-preview flow and other sources use the same report.
- **Duplicate control:** Skip duplicates, Update the existing card, or Create a copy with a distinct import key.
- **History-safe updates:** updating refreshes the card body, deck and course while preserving attempts, correct count, streak, next review, history, study status and the user's `## Notes`.
- **Report:** the result reports created, updated, copied, skipped and failed counts for every source.
- **Coverage:** preview duplicate detection, history preservation on update, and distinct keys on copy.
- **No third-party code was added.** The plugin remains MIT.

**Earlier shipped:** The Reference panel now ships formulas, constants, unit conversion, a local function plotter and the periodic table (1.26.0). The PDF annotation sidecar shipped in 1.27.0, the welcome guide shipped in 1.28.0, the focus timer/study log shipped in 1.29.0, and the exam-scoped study plan/cram mode shipped in 1.30.0. The visual pen/highlighter overlay shipped in 1.52.0, visual text boxes in 1.53.0 and highlight regions in 1.54.0; form filling and a fuller PDF editor remain future work. The unofficial AP score calculator shipped in 1.56.0, the link-only AP resource hub in 1.57.0 and saved practice-exam history with trends in 1.58.0, AP resource notes with course/unit tags and stale-link checks in 1.59.0, a next-exam resource recommendation on Today in 1.60.0, and exam-specific resource attachments in 1.61.0, the calendar exam panel showing attached resources with a detach action on Today in 1.62.0, study-block resource attachment in 1.63.0, the class-note resource link in 1.64.0, binding management in Reference in 1.65.0, a read-only study context for the AI assistant in 1.66.0, an undo journal for AI-generated practice notes in 1.67.0, undo for AI course-note summaries in 1.68.0, weak-spot practice generation in 1.69.0, and blind answer verification in 1.70.0. The six-course AP FRQ pilot shipped in 1.97.0 and gained an optional second grading pass and an official/teacher rubric marker in 1.98.0; human-scored calibration remains the next quality step. A full JSXGraph geometry/vector-field tool remains optional future work. Audio-only commute mode is still deferred until TTS provider and mobile support are validated.

**Recently completed (1.78.0):** timed tests now capture confidence per answer and report calibration and average time per answered question alongside the section and skill breakdowns. Previous release 1.77.0 added sections, separate timers and saved blueprints; 1.76.1 published the versioned property schema; 1.76.0 added merge-safe history.

**Latest completed (1.96.1):** mixed-course AP histories now compute the written average and per-section trends only from the latest course, so AP Biology attempts no longer leak into an AP U.S. History summary. 1.96.0 added per-section written trends (SAQ, DBQ and LEQ for APUSH; FRQ for Biology and the other profiles), with the correct “Written” label when a course has more than one written section. 1.95.0 added per-question FRQ history; 1.94.0 added per-course Known snooze defaults; 1.93.0 added Suspend and Bury; 1.92.0 added per-row import reporting and `.apkg` media reporting.

**Plan audit (Oct 29, 2026).** This is the evidence-based status pass over the whole document. A checked item is present in the code and covered by a test or a documented manual gate; a partial item has a working slice but a named gap.

| Area | Actual status | Evidence / remaining gap |
|---|---|---|
| Reference panel (formulas, constants, units, calculator, graph, periodic table, sheets) | **Done** | Data audited against the 2025 AP Chemistry sheet and 2020 AP table; tests cover search, conversion, plotting, the element table and the 1.106.0 unit-circle, trig, codon and Punnett sheets. |
| Reference sheets (§5.22.5) | **Done in 1.106.0** | Unit circle (16 angles), grouped trig identities, all 64 RNA codons with search, and a two-parent Punnett square with genotype counts. Local data only. |
| Generate practice from any note (P1 §5.23) | **Done** | `AI: generate practice from this note`; preview shows source, destination, count and difficulty; blind check and AI undo reused. |
| Per-note subtopic memory (P2 §5.23) | **Done** | AI output writes `subtopic` per question and `generated_subtopics` on the source note; later prompts avoid covered subtopics. |
| Logged **Don't know** signal (P2 §5.23) | **Done** | Practice writes a `skipped` history row, `skip_count` and an earlier next review without touching accuracy or streak. Insights shows the overall count, per-skill skip rate and a dedicated Logged skips section; the plain Skip still records nothing. |
| Adaptive session sizing (P2 §5.23) | **Done** | Optional warm-up/stretch planner reads recent accuracy, pace and logged skips. Quick Practice shows the recommendation and can override it per session; the daily quiz uses the same signal. Hard minute/count caps are configurable and off by default. |
| Optional local daily reminder (P3 §5.23) | **Done** | Off by default; a local Today card and status-bar nudge appear once a day after a chosen hour and can be dismissed until tomorrow. No OS notification, network request or telemetry. |
| Suspend and bury study states (§5.22.1) | **Done in 1.93.0** | Suspend stays hidden until restored; Bury returns tomorrow. Both are in practice, card review and the hidden-items manager, with Undo and protected properties. |
| Per-course Known snooze (§5.22.1) | **Done in 1.94.0** | `COURSE=days` overrides the global snooze; unmatched or malformed entries safely fall back. The Known button shows the resolved value. |
| FRQ score history (§5.20.2) | **Done in 1.95.0; trends in 1.96.0; isolated in 1.96.1** | Saved AP notes include per-question written scores and aggregate `frq_*` properties; the history view shows an aggregate average and per-section change. Covered for AP Biology's FRQ section and AP U.S. History's SAQ, DBQ and LEQ sections. |
| Import quality and reporting (§5.22.3) | **Done in 1.92.0** | Every import result lists each attempted card with its outcome and reason; CSV and question sets report exact skipped rows, and `.apkg` reports media counts and names. |
| Quizlet PDF / test-bank import (§5.22.3) | **Done in 1.102.0; device picker in 1.103.0** | The Cards importer reads a text-layer PDF printed from Quizlet, from the vault or directly from the device, extracts flashcard pairs or numbered questions with choices and an answer key, previews the cards, and writes normal flashcard notes. Device files are read locally and never copied into the vault. Scanned PDFs get an OCR hint. |
| Direct AI agent with allow-listed tools (§5.18) | **Done** | `create_question`, `create_card` and one safe `update_section` proposal; review window, existing write roots and protected properties enforced. |
| SMILES structure rendering (§5.16.2) | **Done in 1.91.0** | Local, original SVG renderer for a documented teaching subset; `smiles` code blocks in notes and a Structures tab in Reference. Invalid syntax reports an error rather than guessing. |
| AP FRQ grader | **Partial — pilot shipped in 1.97.0; calibration open** | Six owner-approved courses, user-supplied prompts and rubrics, self-grade plus optional AI grade, per-criterion feedback, quotes, override, attempt history and docs in `docs/ap-frq-practice.md`; 1.98.0 added the second pass and official-rubric marker; 1.99.0 added prompt-level review scheduling and Today/study-plan routing; 1.104.0 added an opt-in photo-of-handwritten-work transcript that stays editable before grading. |
| FRQ scheduler and study-plan feed | **Done in 1.99.0** | Saving an attempt writes `frq_review_interval` and `frq_next_review`; weak attempts and missed criteria return in 1–3 days, stronger attempts in 7–14. Today lists due prompts, the next exam's study plan includes the course's FRQ prompts with a **Practice FRQ** button, and each Insights weak-criterion row opens the prompt where it was missed. Photo answers are read into editable text in 1.104.0. |
| Handwritten answer photos (§5.5, §5.20) | **Done in 1.104.0; multi-page in 1.107.0** | Up to eight photos are read in the chosen order, one at a time, and their transcripts are appended to the editable answer; a later failure keeps earlier pages. Self-grading still needs no AI, `answer_source: photo` and `answer_pages` mark the attempt, and no image is stored. 8 MB per image; PNG, JPEG, WebP, GIF or HEIC. |
| Study skin modes (§5.22.2) | **Done in 1.105.0** | Flashcards, Learn, Test and Match run over the same notes, queue and scheduler; a correct Match pair writes one normal attempt and a wrong tap writes none. |
| Fill-in and matching practice (§13.9) | **Done in 1.112.0** | `fill_in` uses the SPR text/numeric grader with normalized text and variants; `matching` reads `## Pairs`, shuffles each row's options, requires every row, and grades per row in practice and timed tests. |
| Mixed MCQ/SPR/FRQ timed tests (§5.6) | **Done in 1.100.0** | A timed test takes an optional FRQ count included in the section totals, writes responses in the test, restores them with the saved session, and offers **Grade this response** after the test with the answer prefilled in the existing grader. Objective score, confidence and skill breakdown count only MCQ/SPR items; written responses are reported separately. |
| Course registry (§5.8) | **Done in 1.101.0** | Settings, Calendar, Courses stores name, code, folder, color, semester, instructor and credit weight. A match drives class-note folders and calendar colors; credits feed the GPA when Assignments has no explicit course credit. |
| FRQ math preview and rubric categories (§5.16.6, §5.20.1) | **Done in 1.101.0** | The answer box has a local **Math preview** for math and chemistry notation. Rubric rows accept an optional category tag, infer one from the label when omitted, show it in the grader, and preserve it in generated notes and the AI payload. |
| Concept mastery overlay (§5.14) | **Done in 1.107.0** | Insights → Concepts lists one row per source note, weakest first, with practice accuracy and a colour band; **Reread this** and source backlinks ship since 1.36.0. |
| Exam/quiz import breadth (§5.22.3) | **Done in 1.114.0** | GIFT, Moodle XML, QTI, Mochi Markdown, CrowdAnki, FlashQuiz `@mc`/`@sata`/`@tf`, QuizPort JSON, Markdown checkbox quizzes, zipped Canvas/Blackboard QTI archives and LearnKit blocks/quick cards. |
| Card and question export (§5.15) | **Partial** | Anki text, CSV, Markdown and JSON ship, plus Mochi `.mochi` in 1.113.0; `.apkg` export is missing. |
| LearnKit compatibility (§5.15) | **Done in 1.114.0** | Pipe blocks and quick cards import; groups map to decks/tags; ordered questions import as basic cards, hotspot cards are skipped. Export writes the same block format as a Markdown note. |
| Math/chemistry rendering audit | **Blocked — manual gate** | Renderer and golden tests are done; the remaining visual pass needs a real Obsidian window and cannot be completed in this cloud environment. |
| Mobile audit | **Blocked** | No real iOS/Android device is available in this environment. |
| TTS / audio commute | **Deferred** | Provider and mobile validation still missing. |
| PDF form filling / full editor | **Open** | Pen, highlighter, text boxes and highlight regions ship; true AcroForm filling needs an audited MIT PDF library and is not safe to approximate. |
| README, screenshots, sample vault, license confirmation | **Partial — screenshots blocked** | README, NOTICES, `docs/license-audit.md` and `samples/sample-vault` exist. Screenshots still need a real Obsidian window. |

**Whole-plan review (Oct 29, 2026).** Every checkbox in this document was checked against the code. Closed in 1.89.0–1.106.0: the course registry, FRQ rubric categories, Quizlet PDF import with a device picker and the reference sheets. The boxes that remain `[~]` are either gated on hardware or an audited library (visual pass, screenshots, mobile, TTS, PDF form filling, pronunciation) or carry a named, implementable gap: exam/quiz import breadth, `.apkg` export and the bundled OCR engine. The concept mastery overlay closed in 1.107.0, fill-in and matching practice closed in 1.112.0, Mochi `.mochi` export closed in 1.113.0, and LearnKit import/export closed in 1.114.0, and the in-plugin survey closed in 1.115.0. Human-scored FRQ calibration remains a quality gate, not an implementation gate. There is now a single status list; the superseded copy is archived.

**Partial review (Oct 29, 2026, 1.104.0).** Every partial marker was re-read after the handwriting work. Closed in this release: photo-of-handwritten-work grading. Still gated with a concrete reason: the real-Obsidian visual/screenshot pass (no Obsidian window here), the mobile audit (no real device), TTS/audio commute (no provider or mobile speech validation), PDF form filling (no audited MIT form-filling library; approximating it would corrupt files), pronunciation feedback (needs audio capture plus mobile validation), and human-scored FRQ calibration (a quality gate, not code). `.apkg` export stays open because it needs a tested SQLite writer; reading `.apkg` already works. Also closed in 1.105.0: the Learn, Test and Match study-skin modes. Also closed in 1.106.0: the one-screen reference sheets.

**Dedupe and re-mark (Oct 29, 2026, 1.106.0).** `plan.md` is now one document. The
pre-Oct-27 duplicate, the Gemini brainstorm and Appendix A were moved verbatim to
`docs/archive/plan-brainstorms.md`; the duplicate's §10c and open questions 10–11 were
promoted first, so no unique content was lost. Newly marked partial because a named gap
remains: LearnKit import/export, FRQ human-scored calibration, the bundled OCR engine, the
in-plugin survey form, the concept mastery overlay, exam/quiz import breadth and Mochi and
`.apkg` export. Items previously marked `[x]` whose own text said something “remains” were
corrected, including two stale claims that auto-classification was missing (it shipped in
1.47.0).

**Adaptive Practice parity audit (Oct 29, 2026):** compared with Adaptive Practice 0.7.2. MCQ Tracker already has the broader study system; the meaningful gaps are generation from any note, per-note subtopic memory, a logged skip/fluency signal, adaptive session size and an optional local reminder. The Whetstone engine (AGPL) and the persistent vault index are non-goals. Full matrix and acceptance criteria: §5.23.

---

## 0. Confirmed decisions (owner, Oct 27, 2026)

| Topic | Decision | Consequence for the plan |
|---|---|---|
| Packaging | **One modular plugin.** Modules are **off by default** | No separate satellite plugins planned (§4.5). First-run presets turn modules on |
| Audience | **Both** SAT/AP-style prep **and** university coursework | Exam-style practice and course/calendar features are both first-class |
| Calendar | **Important** | Moved up in the roadmap (§5.8, §7) |
| Flashcards | **Important, and built into this plugin** | Plugin owns flashcards and vocab review (§5.7, §5.17) |
| AI access | **Both BYOK and OpenCode** | One shared AI service layer used by every AI feature (§4.6) |
| Mobile | Phone-friendly **quick sessions**: flashcards, MCQs, and anything else that fits a few minutes on a bus or at lunch | Dedicated mobile design (§5.19) |
| Maintenance | **Agent-driven (vibe-coded) development with effectively unlimited agent time** | Scope can be large, but quality gates are mandatory (§8.5) |
| Distribution | **Already in the community directory** (42 downloads at last check). Features ship as updates | Growth and migration plan (§10b); never break existing users' notes |
| New idea 1 | Flashcards where the learner **types or speaks** an answer and an **AI grader** compares it to the stored answer | §5.17 |
| New idea 2 | A general-purpose **AI assistant/agent** (like Obsidian Copilot) | §5.18 |

---

## 1. Vision

Turn MCQ Tracker from a *question practice and tracking* plugin into a *complete exam-prep and study system* that knows:

- **What you need to learn** (courses, lectures, readings, exams)
- **What you know** (accuracy, confidence, timing, mistake types, partial credit)
- **When to review it** (adaptive spaced repetition)
- **How to create more practice** (AI generation with verification)
- **How you are doing overall** (one dashboard across everything)

### Design principles

1. **Markdown-first, properties-first.** All study state lives in readable note properties, as MCQ Tracker does today. No opaque database as the only source of truth.
2. **AI is optional.** Everything core works with no AI key. AI features are off by default, opt-in, and clearly disclosed.
3. **Modular.** Each major capability is a module that can be switched off. A student who only wants MCQs should not see flashcards, grading, or timers.
4. **One scheduler, one queue.** MCQs, FRQs, flashcards, and vocab all feed a single "due today" queue.
5. **Exam-style first.** The differentiator is realistic practice (stimulus + question + choices, timed tests, confidence, mistake tagging), not generic flashcards.
6. **Interoperate before rebuilding.** Where a strong MIT plugin already exists, prefer standard formats and integration over reimplementation.
7. **Phone-first for quick sessions.** Flashcards, MCQs, short-answer, and review queues must work well one-handed in a 2–5 minute session. Desktop-only features (local processes, binaries, OpenCode) are clearly labeled and optional.

---

## 2. Strategic reality check

Before building, note two things found in research.

### 2.1 LearnKit overlaps heavily, and it is MIT

[LearnKit](https://community.obsidian.md/plugins/learnkit) ([GitHub](https://github.com/ctrlaltwill/learnkit), [docs](https://ctrlaltwill.github.io/LearnKit/)) already advertises: FSRS scheduling, multiple card types (cloze, reversed, multiple choice, image occlusion), note review mode, text-to-speech, study analytics (charts, heatmaps, retention), a "study coach" for exam plans, AI-generated tests, Anki import/export, and about 28k downloads. It is MIT licensed per its page.

**Implication:** Do not rebuild a generic flashcard app. Options:

| Option | Description | Risk |
|---|---|---|
| **A. Differentiate** | Stay focused on exam-style practice (stimulus-based MCQ/FRQ, timed tests, confidence, mistake taxonomy, official-ID tracking). Add flashcards only as light, compatible cards. | Smaller scope, clearer identity |
| **B. Interoperate** | Keep flashcards in LearnKit or Spaced Repetition. Share course/exam tags via properties and show their due counts in your dashboard. | Depends on others' formats |
| **C. Absorb (MIT)** | Reuse MIT code from LearnKit with attribution. | Large codebase, ongoing merge burden |

**Updated decision:** Flashcards **are** built into this plugin (owner decision), so Option C-style competition with LearnKit is accepted. To avoid a me-too product:

- **Differentiate** with things LearnKit does not list: AI-graded *typed or spoken* answers on cards (§5.17), cards and MCQs in one due queue, calendar- and exam-aware scheduling (§5.8), stimulus-based exam practice, and a study-aware assistant (§5.18).
- **Lower switching cost** by importing existing decks (Spaced Repetition syntax, Anki, LearnKit-compatible formats).
- **Reuse small MIT components** with attribution (e.g., FSRS wrapper patterns, heatmap rendering) rather than absorbing a whole plugin.
- Revisit this if LearnKit adds the same differentiators; keep the property schema open so users can move between plugins.

### 2.2 Licensing traps

- **[Adaptive Practice](https://community.obsidian.md/plugins/adaptive-practice)** lists MIT, but its generation runs through the separate [Whetstone engine](https://github.com/anupchavan/whetstone-engine), described on its page as AGPL. Do not copy engine code into an MIT plugin.
- **[Full Calendar Remastered](https://community.obsidian.md/plugins/full-calendar-remastered)** states the FullCalendar library is GPLv3 there. The original [Full Calendar](https://github.com/obsidian-community/obsidian-full-calendar) is MIT. Use the original for reference.
- **[Obsidian Scribe](https://github.com/caridavidson/obsidian-scribe)** is "MIT License with Donation Request", a non-standard variant. Review the exact text before reuse.

---

## 3. Source plugin map (where each idea comes from)

Legend: **MIT ✅** = MIT stated on the page or repo seen. **Verify ⚠️** = not confirmed.

### 3.1 Your own and closest relatives

| Plugin | Role in plan | License | Link |
|---|---|---|---|
| **MCQ Tracker** | Core of the product | MIT ✅ | [community](https://community.obsidian.md/plugins/mcq-tracker) |
| **Adaptive Practice** | Ideas: adaptive difficulty, fluency-aware scheduling, blind verification, subtopic memory, generation prompts | MIT ✅ (engine AGPL) | [community](https://community.obsidian.md/plugins/adaptive-practice) |
| **University Schedule and Calendar** (uni-calendar) | Class schedule, `.ics` import, per-class note creation, subject→folder mapping, exam category | MIT ✅ | [GitHub](https://github.com/Cesemess/obsidian-uni-calendar) |

### 3.2 Flashcards, spaced repetition, FSRS

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **LearnKit** | FSRS-6 usage, card types, note review, analytics, study coach, Anki import/export, TTS | MIT ✅ | [community](https://community.obsidian.md/plugins/learnkit) · [GitHub](https://github.com/ctrlaltwill/learnkit) |
| **Spaced Repetition** (st3v3nmw) | De facto standard card syntax (`Q::A`, `?` multiline, cloze, `#flashcards/deck` tags); whole-note review; scheduling data stored in comments/frontmatter | MIT ✅ | [GitHub](https://github.com/st3v3nmw/obsidian-spaced-repetition) |
| **Obsidian Tutor** (st3v3nmw) | Topic marking with `> [!topic]` callouts and automatic review scheduling | MIT ✅ | [GitHub](https://github.com/st3v3nmw/obsidian-tutor) |
| **ts-fsrs** (library) | The FSRS implementation LearnKit credits; candidate scheduler dependency | Verify ⚠️ | [GitHub](https://github.com/open-spaced-repetition/ts-fsrs) |
| **Retain** | Simple `Question::Answer` cards with FSRS; scheduling data kept in plugin data, out of notes | Verify ⚠️ | [community](https://community.obsidian.md/plugins/retain) |
| **Simple Flashcards** | RemNote-style inline syntax, bidirectional and cloze, optional SRS | Verify ⚠️ | [community](https://community.obsidian.md/plugins/simple-flashcards) |
| **Decks** | FSRS flashcards | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/decks) |
| **Flashcards LLM** | AI flashcard generation from notes | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/flashcards-llm) |
| **Auto Anki** | AI card creation for Anki | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/auto-anki) |
| **Yanki** | Sync Markdown flashcards to Anki | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/yanki) |
| **Simple Quiz** | Lightweight quiz creation | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/simple-quiz) |
| **Cornell Marginalia** | Cornell-method notes for students | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/cornell-marginalia) |

### 3.3 Vocabulary and language

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **WordFolio** | Vocabulary as Markdown notes, FSRS state in frontmatter, offline dictionary, send-to-Anki | MIT ✅ | [community](https://community.obsidian.md/plugins/wordfolio) |
| **Dictionary Lexicon** | WordNet lookup, save to vocabulary file, vocab flashcards | MIT ✅ | [community](https://community.obsidian.md/plugins/lexicon-dictionary) |
| **FSRS Vocabulary** | Dictionary-as-note (`fsrs-vocabulary` property), per-word FSRS, image/audio/video question columns, stats code block | Verify ⚠️ | [community](https://community.obsidian.md/plugins/fsrs-vocabulary) |
| **Language Made Easy** | Reading with instant lookup, FSRS flashcards, video shadowing, dictation | Verify ⚠️ | [community](https://community.obsidian.md/plugins/language-made-easy) |
| **Obsidian Dictionary** (phibr0) | Multilingual lookup, offline dictionary option, frontmatter `lang` key | Verify ⚠️ | [GitHub](https://github.com/phibr0/obsidian-dictionary) |
| **Zhongwen Reader** | Chinese hover dictionary and vocab building | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/zhongwen-reader) |

### 3.4 Calendar, courses, assignments, grades

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **Full Calendar** (original) | Events as notes with frontmatter; ICS/CalDAV read-only feeds | MIT ✅ | [GitHub](https://github.com/obsidian-community/obsidian-full-calendar) · [community](https://community.obsidian.md/plugins/obsidian-full-calendar) |
| **Calendar Event Sync** | Link a note to the nearest calendar event via ICS URL | MIT ✅ | [community](https://community.obsidian.md/plugins/calendar-event-sync) |
| **ICS Calendar Viewer** | Read-only local `.ics` viewing, minimal permissions (good privacy model) | MIT ✅ | [community](https://community.obsidian.md/plugins/ics-calendar-viewer) |
| **Tasks** | Task syntax, due/scheduled/recurrence, query blocks; 3.4M downloads | MIT ✅ | [community](https://community.obsidian.md/plugins/obsidian-tasks-plugin) · [GitHub](https://github.com/obsidian-tasks-group/obsidian-tasks) |
| **Task Center** | Built on Tasks syntax: drag tasks between dates, review estimate vs actual | MIT ✅ | [community](https://community.obsidian.md/plugins/task-center) |
| **Hold Course** | Course, lecture, assignment, exam tracking; Today sidebar; global assignments view; grade chips | Verify ⚠️ | [community](https://community.obsidian.md/plugins/hold-course) · [GitHub](https://github.com/LiveAQuietLife/obsidian-hold-course) |
| **Course Command Center** | Per-course folders, artifact types, template mapping, course health checks, Canvas LMS tracking | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/course-command-center) |
| **Subject Manager** | Subjects, projects, assignments, exams, grades | Verify ⚠️ | [community](https://community.obsidian.md/plugins/subject-manager) |
| **Verso** (same author as Hold Course) | Reading schedules and pace | Verify ⚠️ | [author page](https://community.obsidian.md/users/liveaquietlife) |

### 3.5 Focus timers and study-time analytics

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **Pomodoro Timer** | Work/break intervals, logs to daily notes, updates task actual-time fields | MIT ✅ | [community](https://community.obsidian.md/plugins/pomodoro-timer) |
| **Timebox** | Session bar in notes; pomodoro phase derived from timestamps (no stored timer state) | MIT ✅ | [community](https://community.obsidian.md/plugins/timebox) |
| **Gentle Pomodoro** | Task-aware timer, overtime tracking, daily goal | MIT ✅ | [community](https://community.obsidian.md/plugins/gentle-pomo) |
| **Pomodoro Logger** | Inline start/end timestamps | MIT ✅ | [community](https://community.obsidian.md/plugins/obsidian-pomodoro-logger) |
| **Todoist Pomodoro Heatmap** | Manual time entry plus GitHub-style heatmap | MIT ✅ | [community](https://community.obsidian.md/plugins/todoist-pomodoro-heatmap) |
| **Scrying Mirror of Productivity** | Offline study logger, streaks, multi-timescale stats, lecture video + timestamped scratchpad | MIT ✅ | [Obsidian Stats](https://www.obsidianstats.com/plugins/scrying-mirror) |
| **Calendar Heatmap** | Heatmap over daily notes (based on Liam Cain's Calendar plugin) | MIT ✅ | [GitHub](https://github.com/deemsd/calendar-heatmap) |
| **Heatmap Calendar** | `renderHeatmapCalendar()` for DataviewJS | Verify ⚠️ | [GitHub](https://github.com/Richardsl/heatmap-calendar-obsidian) |
| **Contribution Graph** / **Activity Graph** | Heatmaps from Dataview queries | Verify ⚠️ | [Contribution Graph](https://community.obsidian.md/plugins/contribution-graph) · [Activity Graph](https://community.obsidian.md/plugins/activity-graph) |

### 3.6 Source ingestion: PDFs, transcription, annotation

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **PDF++** | Backlinked PDF highlights and annotations; link to exact PDF locations | MIT ✅ | [GitHub](https://github.com/RyotaUshio/obsidian-pdf-plus) |
| **Whisper** (TfTHacker) | Record and transcribe via Whisper API | MIT ✅ | [GitHub](https://github.com/TfTHacker/whisper-obsidian-plugin) |
| **Audio to Text** | Transcribe linked audio files to new or current notes | MIT ✅ | [GitHub](https://github.com/aaldrich29/Audio-To-Text) |
| **Local Whisper** | Offline transcription via whisper.cpp | MIT ✅ | [GitHub](https://github.com/cdiak/local-whisper) |
| **AI Transcriber** | GPT-4o Transcribe and Whisper for audio/video files | MIT ✅ | [community](https://community.obsidian.md/plugins/ai-transcriber) |
| **AI Audio Transcription and Summary** | Record, chunk, transcribe, summarize (macOS/iOS) | MIT ✅ | [community](https://community.obsidian.md/plugins/ai-audio-transcription-summary) |
| **Lecture Transcriber** | Local Whisper plus study-note generation from several lectures; flagged for process execution | Verify ⚠️ | [community](https://community.obsidian.md/plugins/lecture-transcriber) |
| **Pick Me** | Annotate and ask questions about selections in notes and PDFs; annotations in separate Markdown files | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/pickme) |

### 3.7 Math, chemistry, and physics

Obsidian renders LaTeX natively with MathJax. Forum posts report that the mhchem package (`\ce{...}`) is integrated, while chemfig is not supported. Confirm both in a test vault before relying on them.

| Plugin / tool | What to learn from it | License | Link |
|---|---|---|---|
| **Chem** | Renders SMILES strings in `smiles` code blocks as molecular structures (powered by RDKit); points to a Ketcher editor plugin for drawing structures | Verify ⚠️ | [community](https://community.obsidian.md/plugins/chem) · [Obsidian Stats](https://www.obsidianstats.com/plugins/chem) |
| **Obsidian Ketcher** (named on Chem's page) | In-vault structure editor that produces SMILES | Verify ⚠️ | Search "Ketcher" in Obsidian's plugin browser (no direct link confirmed) |
| **Latex Suite** | Fast LaTeX typing via customizable snippets; useful for FRQ answer entry | Verify ⚠️ | Listed on the [Obsidian Stats math tag page](https://obsidianstats.com/tags/math) |
| **Function Plot** | Graph functions inside notes; usable in question stimuli | Verify ⚠️ | Listed on the [Obsidian Stats math tag page](https://obsidianstats.com/tags/math) |
| **Calctex** | Solves LaTeX formulas and shows results inline; a model for computed answers | Verify ⚠️ | Listed on the [Obsidian Stats math tag page](https://obsidianstats.com/tags/math) |
| **Obsidian Math+, Quick LaTeX, Latex Environments, asciimath, matrix** | Assorted math-input helpers | Verify ⚠️ | Listed on the [Obsidian Stats math tag page](https://obsidianstats.com/tags/math) |
| **mhchem / MathJax** | Chemical equations via `\ce{}` in standard math blocks | Part of MathJax; verify the license text | See forum threads: [Obsidian for Chemistry](https://forum.obsidian.md/t/obsidian-for-chemistry/33491), [ChemDraw Plugin](https://forum.obsidian.md/t/chemdraw-plugin/61241) |
| **SMILES discussion** | Background on why SMILES is preferred over LaTeX packages for structures | n/a | [forum thread](https://forum.obsidian.md/t/smiles-in-obsidian/35974) |

### 3.8 AI assistants and agents inside Obsidian

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **Copilot** (Logan Yang) | Chat with your vault; runs agents such as OpenCode, Codex, Claude Code per its listing; the model the owner referenced | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/copilot) |
| **Agent Client** | Connects agents (Claude Code, Codex, Gemini CLI) via the Agent Client Protocol | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/agent-client) |
| **Codex Panel** | Codex in a sidebar for the vault | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/codex-panel) |
| **Gemini Helper** | AI chat, workflow automation, semantic search; desktop and mobile | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/gemini-helper) |
| **LLM Hub** | Chat, workflow automation, semantic search with several providers and CLI backends | Verify ⚠️ | [Obsidian Stats](https://www.obsidianstats.com/plugins/llm-hub) |
| **LearnKit Companion** | Study-focused assistant: ask about a note, generate cards and tests, rewrite notes (MIT) | MIT ✅ | [LearnKit](https://github.com/ctrlaltwill/learnkit) |
| **MCQ Tracker's own tutor** | Existing BYOK and OpenCode integration, tutor vs agent mode | MIT ✅ | [community](https://community.obsidian.md/plugins/mcq-tracker) |

---

## 4. Architecture

### 4.1 Core + modules

```
┌──────────────────────────────────────────────────────────────┐
│                       MCQ Tracker Core                       │
│  Item model · Scheduler · Queue · Properties I/O · Settings  │
└───────┬───────────┬───────────┬───────────┬───────────┬──────┘
        │           │           │           │           │
   Practice      Cards &     Courses &    Study       Content
   (MCQ/SPR/     Vocab       Calendar     Time &      Ingest &
    FRQ)                     & Tasks      Analytics   Generation
```

**Core (always on):** the item model, scheduler, due queue, property read/write, filters/presets, and settings.

**Modules (toggle each):**

1. Practice (MCQ, SPR, FRQ, timed tests)
2. Cards and Vocab
3. Courses, Calendar, Exams
4. Assignments, Tasks, Grades
5. Focus and Study Time
6. Analytics Dashboard
7. AI Generation and Grading
8. Source Ingestion (PDF, paper scans, audio)
9. Study Plan / Cram Mode
10. Interop (Anki, Spaced Repetition syntax, Tasks syntax)
11. Math, Chemistry, and Physics (rendering, numeric grading, parameterized questions)
12. AI Assistant (chat and agent, BYOK and OpenCode)
13. Quick Practice (mobile-first short sessions; cross-cutting)

### 4.2 Unified item model

Every studyable thing is an **item** with a common set of properties plus a type-specific body.

| Item type | Body format | Graded by |
|---|---|---|
| `mcq` | Existing format (Stimulus, Question, Answer Choices, Answer) | Auto |
| `spr` | Existing format | Auto (numeric/short text match) |
| `frq` | Prompt, optional stimulus, rubric, sample answer | AI against rubric, or self-grade |
| `card` | Front / back, cloze, reversed | Self-rated (Again/Hard/Good/Easy) |
| `vocab` | Term, definition, example, part of speech, audio | Self-rated |
| `note` | Whole-note review (from Tutor / Spaced Repetition idea) | Self-rated |

### 4.3 Shared scheduler

- Keep the existing fixed-interval mode (1, 3, 7, 21, 60 days) as the **simple default**.
- Add an **FSRS mode** as an opt-in. Candidate library: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (**Verify** license; LearnKit credits it).
- Map each item type's outcome to a rating:
  - MCQ/SPR: correct + confident → Good/Easy; correct but slow or guessed → Hard; wrong → Again
  - FRQ: rubric percentage → rating bands
  - Cards/vocab: user's own rating
- **Fluency signal** (idea from Adaptive Practice): slow, skipped, or low-confidence correct answers shorten the next interval.
- **Exam-date compression:** if an exam for the item's course falls before the computed due date, cap the interval so the item is reviewed before the exam. *(Implemented: see Current focus.)*

### 4.4 Where state lives

| Data | Location | Why |
|---|---|---|
| Per-item results, next review, history | Note properties (current approach) | Readable, queryable, synced |
| FSRS state (stability, difficulty) | Compact property on the note (e.g., `srs`), as FSRS Vocabulary does with a managed column | Keeps the note self-contained |
| Timers, in-progress tests, caches | Plugin `data.json` or device storage | Not worth syncing |
| API keys | Obsidian secret storage if available (Adaptive Practice uses it) rather than plain `data.json` | MCQ Tracker's page notes plain-text key storage today. Fixing this is a trust win |

### 4.5 Packaging: one modular plugin (confirmed)

**Decision (confirmed by owner):** One plugin. Modules are off by default. A first-run preset chooser in the welcome screen (§5.21) turns on the right set: "SAT/AP-style prep", "University courses", "Language learning", "STEM problem sets", "Just flashcards".

**Why this works**
- Value comes from modules sharing data (a missed question updates the schedule, exam plan, dashboard, and assistant context).
- One install is simpler for students, and simpler to support.

**Reach caveats to keep in mind**
- All-in-one is not automatically better for reach. LearnKit shows the model can work (about 28k downloads); Tasks shows single-purpose can reach millions.
- Large plugins carry more bugs, startup cost, and review scrutiny.

**Mitigations**
- Modules **off by default**, and **lazy-loaded** so unused modules cost no startup time or memory.
- Bundle-size and startup-time budgets enforced in CI (§8.5).
- Clear per-module docs and a "what's on" summary in settings.
- **No satellite plugins** are planned. Revisit only if the directory or users clearly benefit, after checking Obsidian's submission guidelines.

### 4.6 Shared AI service layer

Every AI feature (generation, verification, FRQ grading, flashcard answer grading, assistant, PDF import) goes through **one** layer so users configure AI once.

- **Backends:** BYOK direct API (Anthropic, OpenAI, Gemini, OpenRouter, Ollama, OpenAI-compatible) **and** OpenCode (desktop only).
- **Capability flags per backend:** vision, PDF, JSON/structured output, streaming, tool use. Features check flags and show a clear message when unsupported.
- **Per-feature on/off** and per-feature model choice (e.g., cheap model for card grading, stronger model for generation).
- **Cost controls:** size/cost estimate before large runs, per-run caps, optional daily cap.
- **Queueing and retries:** offline-tolerant queue for mobile (grade later when online).
- **Secrets:** use Obsidian secret storage where available; never log keys.
- **Privacy:** a single place that lists exactly what each feature sends.
- **Safety:** all note, PDF, and calendar content is treated as **untrusted data** (prompt-injection defense, §5.18, §8.5).

**Implemented in 1.79.0:** every AI call now goes through one request path (`src/ai-service.js` and `Plugin.aiChat`/`aiVision`). It normalises feature ids and per-feature models, checks backend capabilities before sending, enforces a reply-token ceiling plus optional daily and per-run request caps, counts requests per device before the provider call, and exposes the same feature/privacy list in Settings. Chat, document import, generation, answer verification, typed-card grading and vision OCR all use it. The durable card grade-later queue and offline practice outbox remain the retry path; network and 5xx errors are classified as retryable while bad keys and malformed requests are not. Third-party code: none added.

---

## 5. Feature modules in detail

Effort key: **S** (days), **M** (1–3 weeks), **L** (1+ months). Estimates assume a solo developer.

### 5.1 Adaptive scheduling (FSRS + fluency)  — **M**

**Goal:** Replace "fixed ladder" with memory-model scheduling, optionally.

**Ideas from:** Adaptive Practice (fluency-aware review), LearnKit and WordFolio (FSRS in Obsidian), ts-fsrs.

**Scope**
- Scheduler selector in settings: Simple ladder (default) or FSRS.
- Rating derived from correctness, confidence, time vs `target_seconds`.
- Desired-retention setting (e.g., 85–95%).
- Migration: seed FSRS state from existing `history` so users do not start from zero.
- Never overwrite the user's `next_review` without a migration prompt.

**Acceptance criteria**
- Same note reviewed on both schedulers yields sensible intervals.
- Switching back to the ladder is lossless.
- Property clutter limited to a small, documented set.

**Risks:** Scheduler bugs silently harm learning. Add unit tests with known FSRS reference cases.

### 5.2 Adaptive difficulty and pick modes  — **S–M**

**Ideas from:** Adaptive Practice (difficulty adapts within a session; shorter warm-up when recall is fragile).

**Scope**
- New pick mode: **Adaptive**. Start at the user's level for the chosen skill; step difficulty up after streaks, down after misses.
- Uses the existing `difficulty` property (easy/medium/hard).
- Session length adjusts: shorter when accuracy is low.

### 5.3 AI question generation  — **L**

**Ideas from:** Adaptive Practice (generation from notes and PDFs, analytical reasoning moves, provider choice), LearnKit Companion (generate tests from notes), Flashcards LLM.

**Scope**
- Generate MCQ/SPR/FRQ **notes in MCQ Tracker format** from a chosen note, folder, or PDF.
- Output includes `question_id`, `course`, `skill`, `difficulty`, `question_type`, `answer`, stimulus, explanation, and `ai_generated`, `ai_model`, `generated_on` properties.
- Reuse the existing provider layer (Anthropic, OpenAI, OpenRouter, Gemini, Ollama, OpenAI-compatible).
- **Do not** import the AGPL Whetstone engine. Implement generation with direct API calls and your own prompts.
- Prompt library: a catalog of question styles (application, limiting case, counterexample, data interpretation, etc.). The idea is taken from Adaptive Practice's approach. Write your own wording.

**Weak-spot targeting**
- Button: "Generate practice for my weakest skill" using the existing weak-spot data and error log.
- Pass missed-question context (skill, mistake type) to the generator.

**Cost and safety controls**
- Show estimated request size before sending.
- Cap questions per run.
- Require explicit per-run confirmation the first time.

### 5.4 Blind verification pass  — **M**

**Ideas from:** Adaptive Practice (re-solve every batch, drop wrong keys).

**Scope**
- After generation (and after PDF import where the AI wrote the answer), run a second independent call that solves each question without seeing the key.
- If the answers disagree: mark the note `needs_review: true` and add a visible banner, or drop it based on a setting.
- Record `verified: true|false`, `verified_by` (model), `verified_on`.

**Acceptance criteria**
- Every AI-written answer carries a verification status.
- Disagreements are never silently shipped as correct.

**Implemented in 1.70.0:** weak-spot and transcript generation plus both PDF import paths run the blind check before writing; the manual **AI: verify the answer for this note** command checks an existing note. A mismatch writes `needs_review: true`, `verified: false`, `verified_by`, `verified_on`, `verification: mismatch` and a visible warning banner, or is dropped when **Drop mismatched items** is selected. Answers with no letter key are recorded as `unchecked`, not as verified.

### 5.5 FRQ and AI grading  — **L**

**Scope**
- New `question_type: frq`. Note sections: `## Prompt`, optional `## Stimulus`, `## Rubric`, `## Sample Answer`.
- Rubric format: checklist of criteria with points, e.g. `- [2] States the correct claim`.
- Student answer box: typed or dictated. **Shipped in 1.104.0:** a photo of handwritten work is read by a vision model into editable text first, so grading and saving still run on text.
- **Grading:** AI scores each rubric line, returns per-criterion justification, total points.
- **Safeguards:**
  - Score criterion by criterion, not holistically.
  - Show reasoning so the student can spot a bad call.
  - Student can override any score.
  - Optional second grading pass; flag disagreement.
  - Store `graded_by` model and date with each grade.
- **Official rubrics:** allow pasting official scoring guidelines and mark `rubric_source: official | ai`.
- Uses the attempt percentage to set the next review date and records which rubric criteria were missed.

**Implemented in 1.97.0–1.99.0 (AP pilot).** A user-supplied note can use `type: ap_frq`, `## Question`, optional `## Stimulus`, `## Rubric` and optional `## Sample Answer`. The grader scores one criterion at a time with quotes, confidence and `awarded / max`; the learner can override every line; an optional second pass flags criterion-level disagreement instead of averaging it; and `rubric_source: official | user` records a pasted official or teacher rubric. Attempt notes keep `graded_by`, `graded_on`, `criteria_missed`, `second_pass` and `criteria_disagreed`. Since 1.99.0 the prompt note also gets `frq_review_interval` and `frq_next_review`: below 60% returns in one day, 60–79% in three, 80–89% in seven and 90%+ in fourteen, with any missed criterion capped at three days. Today shows due prompts, the next exam's study plan includes the course's FRQ prompts and a **Practice FRQ** button, and each Insights weak-criterion row opens the prompt where it was missed. Photo-of-handwriting reading shipped in 1.104.0 and mixed MCQ/SPR/FRQ timed tests in 1.100.0. Human-scored calibration remains the quality gate.

**Privacy:** the student's writing is sent to the provider. Off by default and disclosed.

### 5.6 Timed tests and full exams  — **M** (some already exist)

Build on the existing timed test.
- **Section structure:** multiple sections with separate timers (e.g., Reading/Writing module 1 and 2).
- **Test blueprints:** save a recipe ("32 questions, 4 domains, 30 minutes") as a preset.
- **Score report:** by skill, by domain, time per question, confidence calibration (how often "sure" answers were right).
- **Mixed item types** in one test: MCQ + SPR + FRQ.

**Implemented in 1.100.0:** the timed-test setup has a **Written responses (FRQ)** count. FRQ prompts come from the learner's own `ap_frq` notes, count toward the section totals, and are written in a text box during the test. They are never marked by the objective key or logged as MCQ attempts. After the test, **Grade this response** opens the existing FRQ grader with the prompt, rubric and answer prefilled; self-grading is local and AI grading stays opt-in. Saved sessions and blueprints keep the mixed composition.

### 5.7 Flashcards and vocabulary  — **M–L**

**Approach (confirmed):** Flashcards are a built-in, first-class module that shares the scheduler and due queue with MCQs and FRQs. Differentiate through answer modes (§5.17), calendar awareness, and compatibility (see §2.1).

**Ideas from:** Spaced Repetition (syntax), LearnKit (card types, TTS), WordFolio and FSRS Vocabulary (vocab-as-notes), Dictionary Lexicon (lookup).

**Scope**
- **Card syntax compatibility:** read `Q::A`, `Q:::A`, multiline `?` and `??`, and `==cloze==` so existing decks can be pulled in without conversion.
- **Card types:** basic, reversed, cloze, MCQ-as-card, image occlusion (one card per mask).
- **Vocab item:** term, definition, example sentence, part of speech, language, optional audio.
- **Lookup:** optional dictionary lookup that fills definition and example (see WordFolio and Dictionary Lexicon for approaches).
- **TTS / audio:** optional, provider-based, off by default (LearnKit and Language Made Easy show demand for this).
- **Generate cards from a lecture note** with AI, run through the verification pass.
- **Course tagging:** every card inherits `course` from its folder mapping.

**Decision (confirmed by owner):** the plugin owns flashcard creation and review. Keep import paths (Spaced Repetition syntax, Anki, LearnKit-compatible) so users can migrate easily. Review mobile ergonomics early (§5.19).

### 5.8 Courses, calendar, and exams  — **M–L**

**Ideas from:** uni-calendar, Full Calendar, Calendar Event Sync, ICS Calendar Viewer, Hold Course, Course Command Center.

**Scope**
- **Course registry:** code, name, folder, color, semester, instructor, exam dates, credit weight.
- **Schedule import:** `.ics` upload and public URL (including Google Calendar link conversion), as uni-calendar does. Reuse its patterns (MIT).
- **Per-class notes:** auto-create from templates with placeholders (`{subject}`, `{date}`, `{time}`, `{room}`, `{lecturer}`, `{type}`).
- **Subject → folder mapping:** the key link. Questions, cards, and notes in a mapped folder automatically get the course tag.
- **Exam model:** exam date, topics covered, weight. Exams are first-class so the scheduler and study plan can use them.
- **Embeds:** `uni-schedule`-style code blocks for daily notes.
- **Two-way option (later):** export filtered schedule to `.ics`.

**Priority upgrade (calendar is important to the owner).** Build a native calendar module, and still read course/exam properties other plugins write so nobody has to migrate.

1. **Native course registry and schedule import** (reuse uni-calendar patterns, MIT): `.ics` upload and URL, Google Calendar link conversion, region guides, excluded subjects, class categories and colors.
2. **Views:** month grid with color dots, daily timeline, live "class in progress" countdown, **exam countdowns**, and a **Today** view designed for phones (§5.19).
3. **Study blocks:** suggest short study slots in free gaps between classes (e.g., "15 min: 12 due cards before Chemistry"), and let the user accept them onto the calendar.
4. **Exam awareness:** each exam links to a course and topics; the scheduler caps review intervals before the exam (§4.3); the study plan (§5.11) uses it.
5. **Per-class note creation** from templates, with a note linked to every class (uni-calendar's strongest feature).
6. **SAT/AP support:** non-semester events (test dates, registration deadlines, AP exam dates) as first-class exam types, not just class meetings.
7. **Export:** filtered `.ics` for Apple/Google/Outlook.
8. **Interop:** also read events/properties from Full Calendar, Hold Course, or uni-calendar notes where practical.
9. **Mobile:** read-only Today and Upcoming views first; editing second.

**Shipped in 1.101.0:** the course registry stores name, code, folder, color, semester, instructor and credit weight. A code also matches timetable titles such as `CHEM 101 - Lecture`; a registered folder wins for new class notes, its color wins on the calendar, and its credits fill the GPA when Assignments has no explicit credit for that course. Existing subject/folder mappings and class colors still work as fallbacks.

**Risks:** time zones and recurring events are a bug magnet. Use a proven iCalendar parser (check its license), test against real exports from Canvas, Google, and Outlook, and handle daylight-saving transitions explicitly.

### 5.9 Assignments, tasks, and grades  — **M**

**Ideas from:** Tasks (syntax), Task Center, Hold Course (assignments, grade chips), Subject Manager.

**Scope**
- **Use Tasks syntax** (`📅`, `⏳`, recurrence) so existing Tasks queries keep working.
- **Assignments** linked to a course with type, due date, weight, status, grade.
- **Grade tracking:** weighted categories, current grade, "what do I need on the final to get X".
- **GPA view:** credit-weighted. Note: several consumer apps highlight weighted-credit support as a pain point, so make credit weighting first-class.
- **Study-linked tasks:** "Review 20 due items" appears as a task in the daily view.

**Shipped in 1.35.0:** assignment notes with course, type, due date, relative weight, status and score; Tasks-compatible `📅` lines; weighted categories (homework, quizzes, tests, exams, projects) with missing and ungraded handling; current letter grade; “what do I need on the final”; credit-weighted GPA with editable course credits; a gradebook/task view; Today’s **Review N due items** task beside the nearest deadlines; and an Assignments module switch plus settings tabs. All calculations are local and use no third-party code.

### 5.10 Focus timer and study time  — **S–M**

**Ideas from:** Pomodoro Timer, Timebox, Gentle Pomodoro, Scrying Mirror (offline study logger, streaks).

**Scope**
- Timer tied to a course and (optionally) a task or practice session.
- Derive phase from timestamps rather than storing running state (Timebox's approach) so restarts do not break it.
- Manual time entry for offline study.
- Per-course study-time totals, daily goal, streaks.
- Practice sessions log their time automatically (already tracked per question).

### 5.11 Study plan and cram mode  — **M–L**

**Ideas from:** LearnKit's study coach, Hold Course's "where am I" premise.

**Scope**
- Pick an exam → plan built from: days remaining, topics, weak skills, due items, past performance.
- Daily plan: "Today: 25 due MCQs, 10 cards, 1 FRQ, review Lecture 7."
- Re-plans when a day is missed.
- Readiness score per exam, shown with the evidence (accuracy by skill, coverage).
- **Cram mode:** compressed intervals, most-missed first, ignoring long-interval items.

### 5.12 Analytics dashboard  — **M**

**Ideas from:** LearnKit analytics, Heatmap Calendar / Calendar Heatmap / Contribution Graph, existing Weak Spots view.

**Scope**
- One dashboard, per course and overall:
  - Accuracy by skill / domain / difficulty
  - Time vs target time
  - Confidence calibration
  - Mistake-type breakdown (existing error log)
  - Heatmap of study days (items + minutes)
  - Retention trend
  - Cards due / items due / upcoming exams / assignments due
  - Grade snapshot
- Embeddable code blocks so users can place widgets in their own dashboards.
- Respect privacy: all computed locally.

**Shipped in 1.31.0:** the Insights **Overview** tab combines attempts and accuracy, a 12-week study heatmap (session minutes plus question attempts), study time by course, the weakest skills with one-tap practice, due/new card counts, and the next exam plan with its readiness evidence. All of it is computed locally from note properties and the study log.

**Shipped in 1.32.0:** the `mcq-dashboard` block embeds the overview or one section (`stats`, `heatmap`, `weak`, `courses`, `exam`) in any note, with optional course scoping, a week count and a custom title. It reuses the same local model as Insights and has a Refresh button.

**Shipped in 1.33.0:** Insights and the `mcq-dashboard` block now show **confidence calibration** (accuracy at each confidence label, sourced from the existing history field) and a **retention trend** built from repeat attempts. The first attempt on each question is excluded, so the trend measures recall after learning rather than first-pass accuracy. Both reuse the local analytics model, add no new storage, and support course scoping in embeds.

**Shipped in 1.34.0:** Insights and `mcq-dashboard` now include a **practice-grade snapshot** (a per-course letter derived from practice accuracy, explicitly not a transcript grade) and a **skill/domain/difficulty breakdown** switchable in Insights and with `field: domain|difficulty` in embeds. **§5.12 is complete for its current scope;** real assignment grades remain in §5.9.

### 5.13 Source ingestion  — **M–L**

**Ideas from:** MCQ Tracker's PDF import, PDF++, Whisper/Audio to Text/Local Whisper, Lecture Transcriber.

**Scope**
- **PDF → notes:** already exists for questions. Extend to lecture slides and textbook chapters (create course notes, not just questions).
- **Provenance links:** each question/card stores the source note and, for PDFs, the page. Use PDF++ link style where available so a miss can open the exact page.
- **Audio → transcript → notes:** do not rebuild transcription. Detect a transcript note (from Whisper, Audio to Text, Local Whisper, or Lecture Transcriber) in a course folder, then offer "generate practice from this lecture."
- **Optional built-in transcription** only after the above, using API or local Whisper, with clear process/network disclosure.

#### 5.13.1 Paper scanning → PDF → practice items

**Goal (owner):** A student can photograph or scan a paper worksheet, problem packet, or textbook page, turn it into a PDF in the vault, and have the plugin turn it into MCQs, FRQs, cards, or course notes depending on what the document contains.

**Pipeline**
1. **Capture.** On a phone, open the scanner from the ribbon or command palette and take one photo per page with the rear camera; also allow choosing existing photos. On desktop, drag in images or a PDF. Before saving, allow retake, rotate, crop, reorder and delete. Nothing is uploaded during capture.
2. **Build the PDF in the vault.** Combine the pages into one PDF named from a template such as `{date} {course} {title}.pdf`, in a folder the user chooses. Write it locally with a small, permissively licensed PDF writer (verify the licence before adding it); the PDF step must not require a native binary or an external service. Keep the page images only when "Keep original pages" is on.
3. **Get readable text.** Use an existing PDF text layer first. For image-only scans, OCR is required: offer a local option on desktop (for example a Tesseract-compatible engine, after verifying licence and packaging) and an opt-in BYOK vision/OCR option on mobile. Disclose exactly what is sent and keep it off by default. Show per-page confidence and let the user correct text before generation.
4. **Classify the document.** Ask what it is: **MCQ**, **FRQ**, **mixed**, **flashcards/vocab**, or **course notes**. Default to **Auto-detect** with a confidence label, looking for answer choices, numbered questions or `Question ID` labels, rubric-style criteria, and free-response prompts. Never guess silently: show the proposed type and let the user change it.
5. **Route through the existing converters.** MCQ pages go through the existing question importer. FRQ pages create `question_type: frq` notes with prompt, stimulus, rubric and sample answer. A mixed packet is split into blocks and classified per block. Course notes can become notes or card candidates. Reuse the AI layer and the existing review screen; do not build a second importer.
6. **Review before writing.** Show the pages, extracted text, detected type and proposed notes. The user can merge or split blocks, fix labels, choose a folder, and untick items. Run the existing duplicate checks (official question IDs, normalized text, and a page/image hash) before creating anything.
7. **Link provenance.** Every generated item stores `source_pdf`, `source_page`, `source_scan_id`, `scan_date`, `ocr_source` and `ocr_confidence`. Opening the source jumps to the page in the PDF, and the PDF note lists the generated items as backlinks.
8. **Offline and batch behavior.** Capture and PDF creation work offline. OCR and generation queue behind the existing offline/AI queue. Multi-page and multi-document scans show progress, can be paused, and never leave half-written notes. A failed page can be retried without redoing the whole packet.
9. **Mobile first.** The scanner is a primary phone surface: camera capture, thumbnails, reorder, crop, and one **Create notes** action. Desktop gets drag-and-drop and bulk import.
10. **Privacy and limits.** Paper often contains names, school IDs or handwriting. Keep images local until the user starts OCR or generation; never upload automatically; allow deleting the PDF and original pages after import. Printed text is the first target. Handwriting recognition is a later, opt-in vision feature and is not promised for accuracy.

**Data and settings**
- Scanner settings: default folder, filename template, keep original pages, OCR engine, auto-detect on/off, default item type, and vision model.
- `scan_id` groups the pages from one capture session. Re-scanning the same packet offers to replace or add pages instead of silently duplicating it.
- A scan is a normal vault PDF, so existing PDF annotation and backlink plugins keep working.

**Acceptance criteria**
- A three-page photo scan becomes one PDF in the chosen vault folder, in the order shown.
- A text PDF converts without OCR; an image-only PDF prompts for OCR and discloses the provider.
- The user can choose MCQ, FRQ, mixed, cards or notes, and auto-detect is never applied without showing the result.
- A mixed packet is split and classified per question, with a review step before any note is written.
- Every generated note links back to the PDF page it came from.
- Capture and saving work offline; OCR and generation queue and resume after a restart.
- No image is uploaded when AI features or OCR are off.

**Risks:** OCR quality on faint, skewed or handwritten pages; page order and duplicates; mistaking a worksheet heading for a question; vision cost; and privacy of student names. Mitigate with crop/rotate, confidence display, a review gate, provenance, and local-first defaults.

### 5.14 Notes ↔ practice links and concept views  — **S–M**

- **"Reread this" button:** on a miss, open the source note and heading.
- **Concept mastery overlay:** color note links or a simple list by mastery.
- **Backlinks:** each question note links to the lecture note it came from.
- Graph/mind-map generation is a nice-to-have; leave to existing plugins.

### 5.15 Interop and import/export  — **M**

- **Anki:** import/export through LearnKit-compatible formats, plain text, and an optional AnkiConnect push (Yanki and Auto Anki show demand). `.apkg` import shipped in 1.50.0 and two-way AnkiConnect sync shipped in 1.51.0.
- **Spaced Repetition card syntax:** read-only support to import existing decks.
- **CSV export** of results for outside analysis.
- **Dataview-friendly properties** so power users can build their own views.
- **Documented property schema** so other plugin authors can integrate with MCQ Tracker.

### 5.16 Math, chemistry, and physics  — **M–L**

**Goal:** Make MCQ Tracker a strong choice for calculus, physics, chemistry, and other quantitative courses, not just reading-based exams.

**Ideas from:** Obsidian's built-in MathJax (and mhchem), Chem (SMILES), Latex Suite (input), Function Plot (graphs), Calctex (computed results). See §3.7. All plugin licenses are **Verify ⚠️**; prefer integrating over copying.

**5.16.1 Rendering audit (do first, small effort)**
- Confirm LaTeX renders correctly in every place text appears: question body, stimulus, **answer choices**, explanations, review screen, error log, weak-spot rows, test score report, AI chat panel.
- Answer choices are the most likely failure point because they are list items and may be treated as plain text. Render them with Obsidian's Markdown renderer.
- Confirm `\ce{...}` chemistry notation renders in the same places.
- Add golden tests with math-heavy sample questions (fractions, matrices, integrals, chemical equations).

**Automated audit shipped in 1.80.0:** every learner-facing surface uses `renderMarkdownInto`/Obsidian's `MarkdownRenderer`; answer choices are rendered as Markdown rather than plain list text. `src/math-rendering.js` adds a conservative render-time `\ce{}` fallback for simple formulas, charges and equations, and leaves complex mhchem syntax untouched. `tests/math-rendering.test.js` is the golden corpus for fractions, matrices, integrals, chemical formulas/equations, choices, explanations, code fences and the practice review path. The visual check on a real Obsidian window and test vault is still open and documented in `docs/math-rendering-audit.md`.

**5.16.2 Chemistry structures**
- Support `smiles` code blocks in stimuli and choices when the Chem plugin is installed. Show a clear message when it is not (and which plugin provides it).
- Longer term, consider a built-in renderer only if integration proves unreliable.
- Allow answer choices that are structures (like FSRS Vocabulary's image/media question columns for the analogous pattern).

**Shipped in 1.91.0:** an original, local SMILES renderer (`src/smiles.js`) draws a documented teaching subset as SVG. `smiles` code blocks work in any Markdown surface because they use Obsidian's code-block processor, and Reference has a Structures tab with examples. Supported syntax: common organic atoms, bracket atoms with charge and hydrogen counts, single/double/triple/aromatic bonds, branches, ring-closure digits, `%nn` labels and disconnected fragments. Unsupported syntax returns a clear error; nothing is copied from Chem, RDKit, Ketcher or another GPL/AGPL project. The remaining visual check is the same real-Obsidian gate as §5.16.1.

**5.16.3 Numeric answer grading (extend SPR)**
- **Tolerance:** absolute and relative, per question (`tolerance`, `tolerance_type`).
- **Significant figures:** optionally require or check them.
- **Forms:** fractions, decimals, scientific notation, and percentages accepted as equivalent.
- **Units:** optional unit field with dimension checking and unit conversion (e.g., accept 1 km for 1000 m when allowed).
- **Multiple accepted answers** and **ranges**.
- **Equivalent expressions** (e.g., `x^2 - 1` vs `(x-1)(x+1)`): treat as a later, optional feature using a symbolic or sampling-based check, since this is much harder to do reliably.
- Always show the student how their answer was interpreted ("Read as 3.2 × 10⁻³ m/s") so parsing errors are visible.

**Shipped in 1.81.0:** `src/numeric-grading.js` reads fractions, mixed numbers, decimals, scientific notation and percentages; compares against `answer`, `accepted_answers` and `accepted_variants`; applies absolute, relative or percentage `tolerance`; supports inclusive/exclusive ranges (`1..2`, `[1, 2]`, `(1, 2)`); checks `sig_figs` (`at_least` or `exact`); and converts common length, mass, time, volume, energy, force, pressure, power, electricity, amount, speed and temperature units while rejecting incompatible dimensions. Practice and timed-test reviews show the interpretation and reason (for example `Read as 1 km (1000 m)`). Expression-equivalence grading remains intentionally out of scope. The pure rules are covered by `tests/numeric-grading.test.js`; the visual Obsidian check is not applicable because this is text-only grading.

**5.16.4 Parameterized questions**
- A question note defines **variables with ranges** and a **formula** for the answer; each attempt draws new values.
- Variables appear in the stimulus and question through placeholders; the answer is computed, not typed.
- Seeded randomness so a student can see "the same variant" in review.
- Each variant's attempt is stored with the variable values used.
- Great fit for physics, chemistry stoichiometry, and calculus drills where practicing many variants beats memorizing one.

**Shipped in 1.82.0:** `src/parameterized.js` adds numeric variable ranges, stepped ranges, lists and fixed values, `{{name}}` substitution in the stimulus, question, answer and choices, and a restricted recursive-descent formula evaluator (no `eval`, no `Function`) supporting arithmetic, powers, parentheses, constants and a small function set. Each load gets a seeded variant, the computed answer feeds the existing numeric grader, reviews show the values, `variant_seed`/`last_variant` are written, and the optional eighth `history` field records the variant per attempt. Saved timed tests retain each item's seed across a restart. Malformed variants are never graded against a stale static answer. Covered by `tests/parameterized.test.js`.

**5.16.5 Verification by computation (strengthens §5.4)**
- For AI-generated or PDF-imported math questions, verify answers with an actual calculation (evaluate the expression numerically) instead of only asking a second model.
- If model and computed answer disagree, mark `needs_review`.
- Never present an AI-solved numeric answer as verified unless the check passed.

**Shipped in 1.83.0:** `src/computed-verification.js` evaluates a note's `calculation` or `answer_formula` with the restricted numeric evaluator and compares the result with the stored numeric answer using the normal tolerance/unit rules. Import finalization runs it automatically; **Verify this answer by calculation** and **Verify numeric answers by calculation** cover existing notes. A mismatch or invalid expression writes `verification: mismatch|error`, `verified_by: calculation`, `verification_method: computed`, `verified_answer` and `needs_review: true` with a visible Calculation check banner. AI and calculated checks are merged conservatively: a model disagreement with a passing calculation is still marked for review, and a calculation never silently verifies a non-numeric answer. Covered by `tests/computed-verification.test.js`.

**5.16.6 FRQ and work-showing (extends §5.5)**
- Math-friendly answer box with live LaTeX preview.
- Compatibility with Latex Suite shortcuts for users who have it, without requiring it.
- Rubric lines for **method steps** and **final answer** separately, so a right method with an arithmetic slip earns partial credit.
- **Shipped in 1.104.0:** a photo of handwritten work is read into editable text by a vision-capable model before grading. Off by default, Direct AI only, with a clear privacy note; the image never enters the vault.

**Shipped in 1.101.0:** the FRQ answer box has a collapsible **Math preview** that renders the typed answer locally through Obsidian's Markdown renderer. `$...$`, `$$...$$` and `\\ce{...}` update as the learner types; nothing is sent anywhere. Rubric criteria can also carry a category; see §5.20.1.

**5.16.7 Figures and graphs**
- Embed Function Plot graphs or Excalidraw diagrams in stimuli (works because they are normal Obsidian embeds).
- Imported PDF figures are already captured as PNGs; ensure they display in tests and reviews.

**Shipped in 1.84.0:** PDF figure markers such as `[FIGURE page 3: ![[path]]]` are normalized into ordinary Obsidian embeds before every Markdown render, so the cropped figure wins over the whole-page fallback and diagrams appear in practice, timed tests, results, card reviews and explanations. Import checks find embedded images through the same helper, including markers left in an older note. Images scale to the pane, keep their aspect ratio, and get a themed border. Covered by `tests/figures.test.js`.

**5.16.8 Reference tools**
- **Formula and constants sheet** per course, viewable during practice.
- **Setting to hide it in timed tests** to match closed-book exams, or show a specific exam-provided sheet.
- Optional **calculator panel** with modes (basic, scientific). Allow disabling during no-calculator sections.

**Shipped in 1.85.0:** the Reference view has a local **Calculator** tab with Basic and Scientific keypads, a typed expression field, Enter-to-evaluate and Escape-to-clear. It uses the restricted expression evaluator (no `eval`), supports powers, roots, logs, trigonometry, `pi` and `e`, rejects non-finite results instead of showing `Infinity`, and adds no network request. The calculator is on by default, can be turned off in Settings, Reference, Tools, and is hidden during a timed test unless the learner explicitly allows it. Covered by `tests/calculator.test.js`.

**Shipped in 1.86.0:** OCR is now AI-vision only. The optional desktop OCR command adapter was removed, eliminating the plugin's direct `child_process` and `fs` usage while OpenCode keeps its lazy desktop-only setup path and automatic download. The plugin still enumerates the vault through Obsidian's API because import, filters, calendar and study views need the index.

**Shipped in 1.87.0:** Agent mode now pauses its file edits for review. Before a request the plugin snapshots the question, card, deck and current notes; after the agent finishes it reverts those writes and shows a per-file diff. Only checked files are written back, closing the review discards everything, files edited during review are reported as conflicts instead of overwritten, and **AI: undo the last agent edits** restores the previous contents. Covered by `tests/agent-edit-review.test.js`.

**Shipped in 1.88.0:** **Verify numeric answers by calculation** no longer writes while it scans. It computes every check first, then shows a review of the affected notes and the exact verification properties that would change. Only checked notes are written; a note edited during the review is skipped instead of overwritten. Covered by `tests/computed-verification.test.js`.




**5.16.9 Subject-aware analytics**
- Track errors by type common to STEM: setup error, algebra/arithmetic slip, unit error, sign error, wrong formula, concept gap. Extend the existing mistake-type labels (users can already add their own).

**Acceptance criteria**
- Math and chemistry render in every view listed in 5.16.1.
- Numeric grading explains how each answer was interpreted.
- Parameterized questions produce reproducible variants.
- AI-generated math answers cannot be marked verified without a computed check.

**Risks**
- Expression-equivalence grading is easy to get subtly wrong. Ship numeric tolerance first.
- Parameterized formulas are a form of code evaluation. Use a restricted expression evaluator, never `eval`.
- Reliance on third-party plugins (Chem) means behavior can change. Detect and degrade gracefully.

### 5.17 Flashcard answer modes with AI grading  — **M**

**Idea (owner):** Instead of only "see term, flip, see definition", the learner can **type** (or **speak**) their answer, and an AI grader judges whether it matches the stored answer. This is **active recall**, which is generally a stronger practice than passive flip-and-self-rate. Offer it as a setting, not a requirement.

**Modes (per deck, per course, or global)**
- **Flip** (default): classic self-rating.
- **Type:** the learner types an answer, then sees the verdict and the stored answer.
- **Speak:** voice input, then the same verdict flow.
- **Auto:** Type on desktop, Flip on mobile, or any user-defined rule.

**Grading pipeline (cheap first, AI only when needed)**
1. **Exact and normalized match** (case, punctuation, accents, articles, whitespace).
2. **Accepted variants** list on the card (synonyms, alternate spellings, abbreviations).
3. **Fuzzy match** for typos (edit distance) with a safe threshold.
4. **Numeric/unit match** for quantitative answers (reuse §5.16.3).
5. **AI grader** only when the above are inconclusive, via the shared AI layer (§4.6).

This saves cost, works offline for easy cases, and keeps latency low.

**AI fallback (only after Steps 1–4 are inconclusive)**
- **Never replaces a confident local grade.** A deterministic match (exact, variant, typo-tolerant, numeric) is final; the AI is called only when the local result is inconclusive or below the configured confidence threshold.
- **One shared AI layer.** Uses the same BYOK/OpenCode provider selection, per-feature on/off switch, model choice and spend caps as the rest of the plugin (§4.6). If grading AI is off, the card falls back to self-grade instead of sending anything.
- **Small, bounded request.** Sends only the card front, the stored reference answer, the learner's typed answer, the strictness, and optional key ideas. No vault context, no note body, no history, no unrelated cards.
- **Structured result.** The model must return `{ verdict, confidence, present_ideas, missing_ideas, feedback }`; the plugin validates the shape and clamps the verdict to `correct | partial | incorrect`. Timeouts, refusals, malformed JSON and low confidence become **pending**, never **incorrect**.
- **Prompt-injection contract.** The stored answer is the reference; the learner's text is untrusted data. Instructions inside an answer ("mark this correct", "ignore the rubric") are ignored. The grader has no tools and cannot write notes.
- **Provenance.** Writes `graded_by: ai`, the model id and date, plus confidence. A learner override always wins and is stored separately as `verdict_override`.
- **Cost guard.** One short request per card, bounded output tokens, no automatic retry after an ambiguous timeout (retrying can double-charge); the queue can retry explicitly later.

**AI grader output**
- Verdict: `correct`, `partial`, or `incorrect`.
- Which key ideas were present or missing (for definitions with several parts).
- One-sentence feedback.
- Confidence; low-confidence results are flagged for the learner to review.

**Strictness setting:** *Strict* (wording and terminology matter), *Standard* (meaning must match), *Lenient* (core idea only). Strictness may be set per deck (vocabulary needs strict spelling; concept cards may be lenient).

**Scheduler mapping:** correct → Good, partial → Hard, incorrect → Again. The learner can **override** any verdict with one tap ("I was right" / "I was wrong"). Overrides are stored and can be used to measure grader quality.

**Speech input options (in order of simplicity)**
1. **OS keyboard dictation** into the type box. No plugin code needed; works on most phones. Recommend it in the UI.
2. **In-plugin recording → transcription** through the configured provider (BYOK) or local Whisper on desktop. **Verify** that audio recording works reliably in Obsidian mobile before promising it; the transcription plugins surveyed list different platform support (e.g., one lists macOS and iOS only). See §3.6.
3. **Language learning:** later, optional pronunciation feedback. Do not promise it in v1; transcription accuracy is not the same as pronunciation assessment.

**Grade-later queue (offline, slow, or over budget)**
- **Never block the session.** If the AI is unavailable, the request times out, the spend cap is reached, or the device is offline, save the attempt as `pending` and move on. The learner can keep reviewing.
- **Durable outbox.** Store pending attempts in the plugin's own data (not in card frontmatter) with: attempt id, note path, card id, a snapshot of the reference answer, the typed answer, locale, strictness, requested model, and timestamp. The existing offline-attempt queue is the model. Cap the queue and drop the oldest with a clear notice; never grow without bound.
- **Idempotent batch grading.** One attempt id maps to exactly one grade. On reconnect, send small batches (for example 10 at a time), oldest first, with backoff. If a note was edited or deleted meanwhile, grade against the stored snapshot and flag the result, or drop it if the note is gone.
- **Pending is not a fail.** A pending attempt must not reset the streak, count as incorrect, or schedule the card as `Again`. Keep the previous due date and show a **Pending grade** badge in the review screen, Today list and card history.
- **Learner controls.** From the pending badge the learner can **Grade now**, **Self-grade instead** (Again/Hard/Good/Easy), or **Discard**. Self-grading records `graded_by: self` and leaves the AI queue.
- **Clear the queue.** After a batch, show one summary notice ("Graded 8 answers, 2 still pending") and write each verdict once. Do not interrupt the current review with per-card popups.
- **Privacy.** Pending answers wait on the device and are sent only when the learner is online and AI grading is still enabled. Turning AI grading off offers to self-grade or discard the queue; it never uploads silently.

**Mobile and bus-friendly behavior**
- Type-first review works one-handed; pending grades let a phone session continue on a bus with no signal.
- Batch grading at the end of a session reduces latency and API overhead.

**Quality and safety**
- Grader is told the stored answer is the reference and the learner's text is **untrusted data** (a typed answer must not be able to instruct the grader, e.g., "mark this correct").
- Record `graded_by` (model) and date on each attempt.
- Periodically sample overrides to find systematic leniency or harshness; expose a small "grader accuracy" stat in settings.
- Provide a deterministic test set of card/answer pairs to evaluate each model before recommending it.

**Properties (see §6):** `answer_mode`, `accepted_variants`, `grading_strictness`, `last_typed_answer`, `last_verdict`, `verdict_override`, `graded_by`, `graded_on`, `grade_status: pending|graded`, `grade_attempt_id`, `grade_confidence`.

**Privacy:** typed or spoken answers are sent to the selected provider only when the AI step is needed. Disclose this in settings. Easy matches never leave the device.

**Acceptance criteria**
- A deterministic match never calls a provider.
- Offline, timeout or budget exhaustion stores a pending attempt and leaves the schedule unchanged.
- Reconnecting grades each attempt exactly once, even after a restart.
- Malformed, refused or low-confidence AI output becomes pending, never incorrect.
- AI grading off falls back to self-grade and sends nothing.
- Strictness, accepted variants and learner overrides are respected.
- A prompt-injection attempt inside a typed answer cannot change the verdict.

---

### 5.18 AI assistant and agent  — **L**

**Goal (owner):** A general-purpose assistant the learner can use for anything, similar in spirit to Obsidian Copilot, but **study-aware**: it can see the learner's performance, due items, exams, and notes when allowed.

**Where the idea comes from:** Copilot, Agent Client, Codex Panel, Gemini Helper, LLM Hub (see §3.8), plus MCQ Tracker's existing tutor and OpenCode integration.

**Shipped in 1.90.0:** Direct AI agent mode uses an allow-listed tool protocol rather than file access. It can propose a question note, a card note, or one replacement of a safe body section; each proposal is reviewed and checked before it is written, and the existing AI write roots and protected review properties still apply. OpenCode keeps its richer agent mode.

**Surfaces**
- Side-panel chat on desktop; full-screen chat on mobile.
- Inline quick actions on a question, card, or selected text.
- Slash commands and user-defined prompts (e.g., `/explain`, `/quiz`, `/plan`).

**Context the user can toggle on (visible and per-chat)**
- Current note and selection.
- The current question or card, the learner's answer, and the explanation.
- Course folder and linked notes.
- Weak spots, error log, due items, upcoming exams and assignments (**study profile**).
- Whole-vault retrieval (later, opt-in).

**Study-specific actions**
- Explain this question; why did I miss it; make a similar question; quiz me on this note; make flashcards from this selection; summarize this lecture; plan my week before the chemistry exam; turn my mistakes into a study guide.

**Modes**
- **Tutor mode (read-only):** works with BYOK anywhere and OpenCode on desktop.
- **Agent mode (can edit the vault):** OpenCode on desktop. For BYOK, the plugin exposes a **small, allow-listed tool set** (create question notes, create cards, edit specific sections) instead of unrestricted file access.

**Safety (enforced in code, not just in prompts)**
- MCQ Tracker's page states that asking the AI not to touch tracking properties is "an instruction, not a lock". In this plan, protection becomes a lock:
  - **Protected properties** (results, history, next_review, streaks) cannot be written by the assistant.
  - **Folder allow-list** for writes; nothing outside it.
  - **Diff preview and confirm** before any write; one-click **undo**; automatic backup before bulk changes.
  - **No shell or arbitrary code execution** from BYOK mode.
- **Prompt injection:** notes, PDFs, web clips, calendar descriptions, and typed answers are **untrusted**. The assistant is told to treat them as data. Tool calls triggered by content in a note require explicit confirmation.

**Cost and transparency**
- Show model, token estimate, and running cost for the session.
- Per-session cap.
- Visible "sources used" list showing which notes were sent.

**Differentiation from general assistants:** generic vault chat tools do not know which skills you keep missing or when your exam is. This assistant does.

**Risks:** scope can sprawl. Keep the first release to chat + five or six study actions + safe note/card creation, then expand. Avoid duplicating Copilot's general-purpose breadth.

---

### 5.19 Mobile quick sessions  — **M**

**Goal (owner):** Someone can pull out a phone on the bus or at lunch and do a few problems in under a minute of setup.

**Entry points**
- Ribbon icon and command: **Quick Practice**.
- A **Today** screen: due counts, next class or exam, and a single **Start 5 minutes** button.
- Obsidian URI so users can add a home-screen shortcut (confirm what the OS allows).

**Session design**
- Pick by **time** (2/5/10 min) or by **count** (5/10/20 items).
- Mixed queue: due flashcards, vocab, MCQs, short-answer items, filtered by course or "everything due".
- **One-handed layout:** large tap targets, answer buttons at the bottom, minimal scrolling, numeric keypad for numeric answers.
- **Resume** an interrupted session after a notification, call, or app switch.
- Pause timer when the app is backgrounded (MCQ Tracker already does this on mobile).
- End-of-session summary: items done, accuracy, next due.

**What works on phone, what does not**

| Capability | Phone |
|---|---|
| Flashcards (flip, type, speak by OS dictation) | Yes |
| MCQ and numeric short-answer | Yes |
| Vocab review | Yes |
| Today / Upcoming calendar view | Yes (read-first) |
| Focus timer | Yes |
| Compact dashboard (due, streak, next exam) | Yes |
| AI generation and grading via BYOK | Yes (needs network) |
| PDF import via Direct AI | Yes (existing behavior) |
| FRQ | Possible but typing is awkward; use voice dictation; keep optional |
| OpenCode agent | No (desktop only) |
| Local Whisper, native binaries | No |

**Offline and sync**
- Sessions work with no network; AI grading is **queued** (§5.17).
- **Multi-device safety:** phone and desktop may edit the same note at different times through Obsidian Sync, iCloud, or similar. Make the `history` property **append-only with unique timestamps** and compute derived fields (streak, next review) from it, so merges do not corrupt results. Add tests that simulate conflicting edits.
- Keep a clear "last synced" indicator and avoid rewriting whole notes on every answer.

**Performance**
- Lazy-load modules; keep heavy libraries (charts, parsers) off the quick-session path.
- Budget: Quick Practice opens in about a second on a mid-range phone on a vault of several thousand notes (verify target with real tests).

**Risks:** Obsidian mobile has platform limits (background work, notifications, widgets). Validate each idea on real iOS and Android devices before committing to it.

### 5.20 AP FRQ grader, score calculator, and resource hub  — **M–L; research next, highly wanted**

**Why this is next after card import.** AP students already bring decks from Quizlet, Anki, and Spaced Repetition. The part those decks cannot grade is the part that decides many AP scores: free-response writing, worked solutions, and the rubric language used by readers. The owner explicitly wants the FRQ grader next. 1.97.0 ships the pilot FRQ grader described in 5.20.1 for six owner-approved courses, using user-supplied prompts and rubrics with self-grading and optional AI grading. The research spec and the human-scored evaluation remain the gate for any claim of reader-level accuracy.

**Provisional product shape.** One optional **AP exam tools** module, enabled per course, with three connected surfaces: FRQ practice and grading, an exam score calculator, and a curated AP resource hub.

#### 5.20.1 AP FRQ grader

Reuse the general FRQ model in §5.5 and add AP-specific structure.

- **Item format:** prompt, optional stimulus/source set, rubric, sample answer, and a course/exam link. Support `question_type: frq` notes that can live beside existing MCQ notes.
- **Rubric editor:** each criterion has points, a short description, and an optional category (thesis/claim, evidence, reasoning, calculation, units/significant figures, notation, communication). Allow pasted official or teacher rubrics; store `rubric_source: official | user | ai`.
- **Practice flow:** timed or untimed; typed answer first, with OS voice dictation where available. **Since 1.104.0** a photo of handwritten work can be read into editable text first: opt-in, Direct AI only, and the image is not stored.
- **Grading:** score criterion by criterion, never as one holistic number. The grader must quote the part of the student answer that earned or missed each criterion, return `awarded / max` per line, and explain the decision in one or two sentences.
- **Trust and control:** show a confidence value, flag low-confidence criteria, support a second independent grading pass, and let the learner override any criterion. Keep a **self-grade** mode that needs no AI at all.
- **Scheduling:** map the rubric percentage to the existing scheduler bands; store `max_points`, `last_score`, `criteria_missed`, `graded_by`, and `graded_on`; feed missed criteria into weak spots and the study plan.
- **AP-specific presets to research:** DBQ and LEQ rubrics for AP History; calculation/derivation and justification rubrics for AP STEM; document/data analysis; short-answer and long-essay formats; world-language writing; AP Seminar/Research performance tasks. Confirm the current rubric structure for each supported course rather than assuming one generic rubric.
- **Quality target:** agreement with a small, human-scored evaluation set of released sample responses. Do not claim reader-level accuracy from a demo.

**Implemented in 1.97.0 (pilot scope).** Owner decisions on 2026-10-29: pilot courses are AP World History: Modern, AP U.S. History, AP Chemistry, AP Calculus AB, AP Calculus BC and AP Statistics; learners upload their own prompts and rubrics; every item can be self-graded, and AI grading is optional. The plugin ships no AP prompts, rubrics or sample responses.

Shipped: `type: ap_frq` notes with `## Question`, optional `## Stimulus`, `## Rubric` and optional `## Sample Answer`; a **New FRQ note** creator with editable rubric presets for history DBQ/LEQ/SAQ, chemistry long/short, calculus and statistics; a grader that scores criterion by criterion, clamps every score to its maximum, shows `awarded / max`, flags low confidence and any point awarded without a quote, supports an optional second independent pass that reports per-criterion disagreement without averaging it away, lets the learner mark a pasted official or teacher-supplied rubric, and lets the learner override every line; self-grade mode with no network request; optional AI grading through the shared `frqGrading` feature and request limits; and saved attempts under `AP FRQ attempts/` plus `frq_last_*` properties on the prompt note.

Still open: a human-scored agreement study and go/no-go evaluation. 1.104.0 shipped photo-of-handwritten-work reading, and 1.101.0 shipped the rubric category taxonomy (`[thesis]`, `[evidence]`, `[reasoning]`, `[calculation]`, `[units]`, `[notation]`, `[communication]`), shown in the grader and preserved in generated notes. Since 1.99.0, missed criteria drive the prompt's review date, appear in Today and the next exam's study plan, and link from Insights. No claim of reader-level accuracy is made.

#### 5.20.2 AP score calculator

**Implemented in 1.56.0 and 1.58.0:** the Reference tab ships eight 2027 exam profiles (AP Biology, Calculus AB, Calculus BC, Chemistry, English Language, Statistics, U.S. History, World History: Modern), weighted section and part inputs, editable cut scores, an explicit incomplete state, a likely band, and a reverse "what do I need?" calculation. Profiles link to the official AP Central exam page. **Save practice exam** writes an ordinary note under `AP practice exams/` with the date, section table, composite, estimate, band and cut scores; the tab lists saved attempts with an average and the change from the previous attempt. 1.95.0 adds per-question written scores to the note and an FRQ average/change across saved attempts; 1.96.0 adds per-section trends and the correct written-section label; 1.96.1 keeps mixed-course averages isolated to the latest course. 1.97.0 adds the four FRQ-pilot score profiles for World History, Chemistry, Calculus BC and Statistics.

An **unofficial practice estimate**, never a prediction presented as an official College Board score.

- **Inputs:** MCQ correct/raw score, FRQ points by question, section weights, exam form/year, and an optional custom curve. Support partial practice (MCQ only or one FRQ) with a clear "incomplete estimate" state.
- **Outputs:** estimated composite, estimated 1–5, confidence range, section breakdown, and a reverse calculator: "What FRQ score do I need for a 4/5?"
- **Profiles:** an `ap_exam_profile` per course/year containing MCQ count, FRQ count, timing, section weights, calculator rules, and the raw-to-composite formula. Source each profile from the current course and exam description, version it by year, and show the source.
- **Curves:** score cutoffs vary by year, form, and administration. Ship no single "official" curve. Default to a clearly labeled unofficial estimate; allow a teacher or user to enter the curve from a released scoring worksheet; show the formula and source used.
- **Storage:** practice-exam notes/properties with `course`, `exam_year`, `form`, section raw scores, composite, estimated AP score, and `curve_source`. Keep history so the learner can see a trend rather than one number.
- **Validation:** test the arithmetic against public scoring worksheets and known sample composites. Treat every curve as data that needs a citation and a date.

#### 5.20.3 AP resource hub

A **link-and-index** feature, not a content dump.

**Implemented in 1.57.0:** the Reference panel has an **AP resources** tab and command for AP Biology, Calculus AB, English Language and U.S. History. Each course pack links to the AP Central course page and CED, exam format, released FRQs with scoring guidelines and sample responses, the AP Students course/date page, AP Classroom/AP Videos, and the AP exam calendar. It stores links and original descriptions only, never fetches or copies AP material, and states that AP is a trademark with no affiliation. Resource notes with course/unit tags and stale-link checks shipped in 1.59.0, and Today now recommends a saved resource for the next AP exam (1.60.0). Exam-specific attachment shipped in 1.61.0: a resource note stores `exam_uid`, `exam_date` and `exam_title`, and Today can bind the recommended note in one click. In 1.62.0 the calendar exam panel shows the attached resource with an open action, and Today can detach it. Study-block attachment shipped in 1.63.0: the free-time chooser suggests a course resource and stores `study_slot_date`, `study_slot_start` and `study_slot_subject` on the note. In 1.64.0 the calendar's attached-resource row can add a wikilink to the exam's class note under `## AP resources`, without duplicating an existing link. In 1.65.0 the Reference saved-resource list labels exam and study-block bindings and detaches either one on its own. 1.97.0 extends the link index to the four FRQ-pilot courses: World History: Modern, Chemistry, Calculus BC and Statistics.

- **Official AP resources:** AP Central course pages, course and exam descriptions (CED), exam format pages, released free-response questions, scoring guidelines, sample student responses, chief reader reports, score distributions, AP Daily videos, and AP Students exam dates/registration deadlines.
- **AP Classroom:** unit guides, progress checks, and the question bank are account-gated and may have no public API. Link to them; never scrape behind a login or copy question banks into the plugin without permission. **Verify** current terms before building any integration.
- **Third-party study resources:** Fiveable, Khan Academy, teacher sites, AP student communities, and the Quizlet/Anki/Spaced Repetition decks users already have. The existing importers cover decks; the hub should tag and link rather than re-host.
- **User-owned material:** review-book PDFs, teacher handouts, and released practice exams the user already has. Use the existing PDF import and provenance fields; do not bundle copyrighted prompts, rubrics, or videos.
- **Features:** resource notes with `course`, `unit`, `resource_type`, `source_url`, and `checked_on`; attach a resource to an exam or study block; open the official source in one click; show stale-link warnings; provide a per-course "start here" pack.
- **Calendar and Today:** AP exam dates and registration deadlines as exam events; study blocks can point to a resource or an FRQ; the Today screen shows the next AP exam and one recommended resource.

#### 5.20.4 Research questions and guardrails

1. **Course coverage:** Which AP courses first? Prioritize the courses with the clearest public rubrics and the largest user demand; do not promise every AP subject on day one.
2. **Permissions:** What may be stored, quoted, or rendered from AP Central/AP Classroom? Prefer linking, user-supplied files, and original summaries. AP is a trademark; make no affiliation claim.
3. **Rubric fidelity:** How closely can an AI grader reproduce reader scoring on released sample responses? Build a small evaluation set per course, measure agreement, and publish the limits in the UI.
4. **Score curves:** Which public scoring worksheets are usable, and how should the plugin represent year/form differences without implying officialness?
5. **Data and privacy:** Student essays are sensitive. Grading is opt-in, per-feature disclosed, and queued offline like other AI work (§5.17). Student text is untrusted input to the grader.
6. **Scope discipline:** No AP Classroom scraping, no bundled College Board question banks, no claim that an estimated score is official, and no photo grading in the first release.

**Definition of ready:** a reviewed spec listing supported AP courses, the rubric schema, the exam-profile and curve schema, a human-scored evaluation set, the resource-link policy, the copyright/permissions review, UX flows, and acceptance tests. Only then should implementation begin. The FRQ grader research spec and evaluation plan is [docs/ap-frq-grader-spec.md](docs/ap-frq-grader-spec.md).

### 5.21 First-run welcome, guided setup, and optional support  — **S–M**

**Goal (owner):** Every new install opens a welcome screen that explains what the plugin does, shows how to turn modules on and off, teaches the main workflows, and — later — offers an optional feedback survey and a way to donate. It should feel like a helpful start, not an advertisement.

**When it appears**
- The first time the plugin loads after installation and enabling in a vault. It is a modal or a dedicated welcome tab opened after Obsidian finishes loading; it never blocks startup.
- Show it once per device. Store a local `welcomeSeenVersion` and `welcomeDismissed` flag; do not put onboarding state in note frontmatter.
- Do not show the full welcome after every update. After a major release, a small, dismissible **What's new** card is enough.
- Always provide **Skip for now**, **Close** and Escape/click-outside. A user who skips is not asked again unless they open the guide themselves.
- Add a command, **Open welcome guide**, and a link in **Settings → Global → About**, so it can be reopened later.
- If the vault already has questions or cards, keep the welcome but skip the empty-vault wording and point the first step at existing practice.

**Step 1 — Welcome**
- One sentence on the outcome: practice like the exam, review with spaced repetition, and optionally manage cards and a course calendar.
- Three short bullets: **practice questions**, **flashcards and vocab**, **calendar and exams**.
- Primary button **Get started**; secondary **Skip for now**; quiet link to the README/quick-start guide.
- No network request, AI key, or account is needed to open or finish the welcome.

**Step 2 — Choose what you need (and learn the module switches)**
- Show the presets from §4.5: *SAT/AP-style prep*, *University courses*, *Language learning*, *STEM problem sets*, *Just flashcards*, and *Everything off*.
- Under each preset, show exactly which modules it turns on. After choosing, show the actual module toggles — **MCQ Tracker**, **Cards**, **Calendar**, **AI features** — with a one-line description and their current state.
- Let the user change any switch here; save through the existing module settings, not a separate copy.
- Explain in one line that turning a module off hides its views and entry points but **does not delete notes, cards, schedules, or settings**.
- Link to **Settings → Global → Modules** for later changes. This is the main place the welcome teaches “how to toggle different features”.

**Step 3 — How to use the plugin**
Use short step cards, each with a working button:

1. **Get questions in** — import a PDF, PowerPoint, Word or other file, or create a question note. Button: **Import questions**.
2. **Practice** — open the practice view, choose filters, or start a 2/5/10-minute Quick Practice session. Button: **Open practice**.
3. **Review what is due** — Today shows due questions, cards and the next class. Button: **Open Today**.
4. **Add cards (optional)** — create a flashcard, vocabulary item or cloze card. Button: **Create a card**.
5. **Add your schedule (optional)** — import an `.ics` file or calendar link, then open the month/day view. Button: **Open calendar**.
6. **Find settings later** — Settings has Global, MCQ Tracker, Cards and Calendar groups; each group has its own tabs. Button: **Open settings**.

- Mark each step with a check when the user completes it, stored locally as a simple checklist. This is optional progress, not a gate.
- Keep the copy short and link to the relevant README section for detail. The guide must use the same names as the current UI; update it whenever a button or tab is renamed.
- Finish with **Open practice** and **Reopen this guide later**. The welcome is complete when the user closes it, whether or not every step was visited.

**Step 4 — Help and support (future, optional)**
- **Feedback survey:** three to five questions about setup friction, what the user wants next, and whether they would recommend the plugin. Open an external form only when the user clicks **Give feedback**; never auto-submit, never attach vault data, and offer an anonymous path. Link to GitHub Discussions for users who prefer public feedback.
- **Donation:** one clearly optional link (for example GitHub Sponsors or Ko-fi, chosen later). No amount is preselected, no feature is locked, no repeated nag, and no guilt copy. Say plainly that the plugin is MIT and free, and that donations support maintenance.
- Put the support step **after** the how-to, with **Maybe later** and **Don't ask again**. Do not show it before the user has had a chance to use the plugin.
- Ship the welcome and how-to first; the survey and donation links can be added later behind a setting so the first release does not depend on them.
- **No telemetry.** Do not count opens, clicks or completions remotely. If survey responses are collected, explain where they go and who can see them.

**Data and settings**
- `welcomeSeenVersion`, `welcomeDismissed`, and the optional checklist live in the plugin's own local data or device storage, not in notes.
- Survey and donation URLs live in one constants file so they can be changed without touching the UI.
- The welcome follows the theme, uses theme colour variables, works at phone width, supports keyboard navigation, and respects reduced motion.

**Acceptance criteria**
- A fresh install shows the welcome once; closing or skipping it prevents it from reappearing automatically.
- Every module can be turned on or off from the welcome, and the state matches Settings → Global → Modules.
- The how-to buttons open the real import, practice, Today, card, calendar and settings surfaces.
- **Open welcome guide** reopens it from the command palette and settings.
- The survey and donation links are optional, never block setup, never open automatically, and never gate a feature.
- The welcome is usable on desktop and mobile and with the keyboard alone.
- No network request is made until the user clicks an external feedback or donation link.

**Implemented in 1.28.0:** the three-step welcome guide, six module presets, live module switches, working how-to buttons, local-only dismissal and step progress, an **Open welcome guide** command and a Global → About entry point. **Added in 1.41.0:** optional external feedback and donation links, configurable under Global → About; they never open automatically and no telemetry is added. The local-only in-plugin survey shipped in 1.115.0; it builds a Markdown summary on request and sends nothing.

**Implemented in 1.29.0:** timestamp-derived focus sessions, pause/resume, manual offline study entry, per-course totals, a configurable daily goal and local streaks. The existing per-question practice timer is unchanged.

**Implemented in 1.30.0:** an exam-scoped daily plan with readiness evidence, due/new/card counts, weakest skill, one-tap Start 10 min and a most-missed-first Cram 10 min mode. The plan is recalculated from the existing scheduler on every render.

**Risks:** onboarding fatigue, instructions going stale after UI changes, survey or donation pressure, and privacy concerns. Mitigate with a short three-step flow, a single dismissible guide, current screenshots/names, clear skip controls, and local-only onboarding state.

---

### 5.22 October 28 idea backlog (captured, unscheduled) — **S–L depending on item**

**Why this section exists.** On October 28, 2026 the owner supplied a second research dump: a student conversation about skipping known questions and a Quizlet-style study mode, a long list of flashcard and question sources, MIT-licensed plugins worth auditing, reference-tool ideas, and a standalone-mobile cost sketch. This section captures only ideas that are **not already specified elsewhere**. Everything here is **captured, not approved**: assign it to a phase only after the owner ranks it. The AP pilot gate (§5.20) still governs AP-specific work.

**Already covered — do not duplicate**

| Idea | Where it already lives |
|---|---|
| AI tutor, Socratic mode, quick actions, slash commands | §5.18 |
| Flashcards, vocabulary, decks, typed/spoken answers, AI grading, pending grades | §5.7, §5.17 |
| Analytics dashboard, heatmaps, accuracy, retention, streaks | §5.12 |
| Calendar, courses, exams, study blocks, exam-aware caps | §5.8, §4.3 |
| AI question generation, weak-spot targeting, blind verification | §5.3, §5.4 |
| FRQ grading and AP exam tools | §5.5, §5.20 |
| Transcription and PDF/paper ingestion | §5.13, §5.13.1 |
| Formula sheet and basic calculator panel | §5.16.8 |
| Study time, focus timer and daily goals | §5.10 |
| Standalone mobile decision, packaging and monetization | §10c |

#### 5.22.1 Known, Exclude, suspend and bury — **Implemented in 1.14.0; suspend/bury in 1.93.0; per-course snooze in 1.94.0**

**Source:** a direct student request: a button to skip or exclude a question from future use because the learner already knows it, as Quizlet allows. Do this before the larger poll items because it is small, visible and requested.

**Shipped in 1.14.0:** Known and Exclude on practice and card review, a configurable snooze, exact Undo, readable status properties, and a searchable/course-filtered manager with Restore. **Shipped in 1.93.0:** Suspend hides an item until restored, Bury hides it until tomorrow, both appear in practice, card review and the same manager, and Undo restores the exact previous state. None of these actions records an attempt or alters history. **Shipped in 1.94.0:** `COURSE=days` entries override the global Known snooze, with case-insensitive course matching and a safe global fallback.

- **Known (timed snooze)** and **Exclude (permanent)** are two separate actions, not one button with hidden behaviour.
- **Known** hides the item for a configurable number of days (`known_days`, default 14, optionally per course). When the snooze ends the item returns as **due** by default, not as new; make that a setting.
- **Exclude** removes the item from practice, Quick Practice, timed tests, the due queue and generated plans. Provide an **Excluded** list with search, course filter, restore and an undo toast.
- **A skip is not a wrong answer.** Record a distinct `skipped` or `known` event, never `incorrect`. It must not reset the streak or count against accuracy unless the user explicitly enables that.
- **Suspend** (hidden until restored) and **bury** (hidden until tomorrow) shipped in 1.93.0 using Anki semantics: suspend is indefinite, while bury ends at the next day boundary.
- **Readable properties:** `study_status: active|known|excluded|suspended|buried`, `known_until`, `excluded_on`, `excluded_reason`, `suspended_on`, `buried_until`. Keep history append-only and Dataview-friendly.
- **Surfaces:** practice, review, card history, Today and an excluded-items manager. A skip action should be one tap; disable it during timed tests if exam realism is preferred.
- **Resolved decisions:** Known returns as due, does not count as an attempt, Exclude is allowed in timed tests, and per-course snooze defaults are configurable.

**Acceptance criteria:** excluding an item removes it from every queue and restores it from the Excluded list; a Known item disappears for exactly the configured period and returns in the chosen state; a skip never increments incorrect attempts or breaks a streak by default; the action is undoable and writes a readable property; excluded notes stay in the vault.

#### 5.22.2 Quizlet-style MCQ study skin — **Implemented in 1.15.0**

**Source:** the same student request: use MCQ notes in a flashcard format, similar to a Quizlet set, while keeping Bluebook-style practice primary.

**Shipped in 1.15.0:** Both readings are available as an opt-in skin under Settings, MCQ Tracker, Practice: flip cards with Still learning/Known, and choice cards with the selected letter recorded. No new note syntax or parallel queue. Since 1.105.0 the skin also has **Learn** (a missed card returns later in the session), **Test** (no feedback until a scored list at the end) and **Match** (pair prompts with answers; one review per correct pair, wrong taps record nothing).

- **Same notes, two skins.** This is a view over existing MCQ notes, not a second note format or duplicate deck. One note can be practised as an exam question or a flashcard.
- **Confirm the reading first:** **(A) flip card** — stem and stimulus on the front, correct answer and explanation on the back, learner marks known/still learning; **(B) card with choices** — tap a choice, then flip to reveal the answer and explanation.
- **Modes to consider:** flashcards with known/still learning, Learn (adaptive order), Test (scored set), Match (term/definition pairing). Verify Quizlet's current UI before copying vocabulary or layout.
- **Reuse the existing queue, filters, scheduler and analytics.** A session writes the same attempt/history properties as normal practice so one scheduler still owns everything.
- **Off by default**, clearly labelled as an extra study mode, not a replacement for exam-style practice. No new note syntax: pure flashcards remain the Cards module.

**Acceptance criteria:** the same MCQ note can be reviewed in exam mode and Quizlet mode without duplication; answers write normal attempt/history properties and feed the same due queue; the mode is off by default and does not change the existing practice screen; flip-card and choice-card flows are both tested before release.

#### 5.22.3 Import breadth and import quality — **M–L, split by format**

**Implemented in 1.16.0:** the generic CSV/TSV importer with delimiter and header detection, column mapping, saved mapping presets, dry-run preview, skipped-row reporting, source metadata (`import_source`, `import_format`, `imported_on`, `import_batch`, `import_key`) and duplicate-safe re-imports. **Updated in 1.92.0:** every import now returns a per-row outcome (created, updated, copied, skipped, failed) with reasons, CSV and question-set parsers report the exact skipped row and cause, and `.apkg` imports report the number and names of media files that remain in Anki. **Updated in 1.102.0–1.103.0:** Quizlet PDF test banks are read locally from their text layer, from the vault or a device file picker, previewed as cards, and imported through the same duplicate-safe card writer; scanned PDFs are rejected with an OCR hint. The report now covers every attempted card; parsers that skip malformed rows before returning a card expose exact row details for CSV and question sets, and `.apkg` exposes skipped note IDs plus media names.

The existing importers cover Quizlet, Kahoot, Blooket, Gimkit, Anki and Spaced Repetition to varying degrees. Add the following, in this order.

| Source family | Formats to add | Notes |
|---|---|---|
| **Generic CSV / TSV** | Header detection, delimiter/quote detection, column mapping, saved presets, preview | **Highest payoff.** One importer covers Brainscape, Cram, RemNote, Memrise, Sheets/Excel and most Quizlet exports. Do this before app-specific importers. |
| **Other Obsidian plugins** | Spaced Repetition (`Q::A`, multiline `?`, cloze, `#flashcards`), Obsidian_to_Anki custom syntax, Mochi `#card` with `---`, Flashcards (Colucci), Yanki, FlashCard, Syro | **Mochi Markdown import shipped in 1.23.0.** One-click **Migrate from X** with preview. Read documented syntax only; do not copy GPL code. |
| **Other apps** | Mochi, Memrise, Cram, Knowt, Brainscape, RemNote, Notion tables | Mostly via CSV. Confirm Mochi's current format before promising native `.mochi` import. |
| **More Anki variants** | `.apkg` (new and old), Anki text, CrowdAnki JSON, AnkiWeb shared decks | **CrowdAnki JSON shipped in 1.23.0, desktop `.apkg` import in 1.50.0, and two-way AnkiConnect sync in 1.51.0. LearnKit remains; preserve scheduling and media where possible.** |
| **LMS quiz banks** | Moodle XML, GIFT, QTI (Canvas, Blackboard) | Fits university users. **GIFT, Moodle XML and QTI shipped in 1.21.0–1.22.0**; Canvas/Blackboard-specific variants remain. Formats above are from memory; **Verify** current specifications. |
| **Exam / quiz formats** | FlashQuiz `@mc`/`@sata`/`@tf`, VCE via converter, QuizPort JSON, Markdown checkbox quizzes | CBT Exam Simulator and QuizPort are references. **Verify** the VCE converter's license separately. |
| **Export** | Anki text, CSV, Markdown, JSON, Mochi `.mochi`; `.apkg` export is a known gap | Round-trip where practical so users can leave with their cards. |
| **Import quality** | Dry-run preview, report (created, skipped, duplicates, media failures), duplicate detection, source attribution | **Preview/report/update-copy shipped in 1.24.0; per-row outcomes and .apkg media reporting shipped in 1.92.0.** |

**Rules:** prefer files users export themselves; do not scrape Quizlet, Kahoot, Blooket, Gimkit, Canvas or AnkiWeb, and review each service's terms before any unofficial API. Normalize every importer into the existing note format and scheduler; no parallel card database. Dedupe by official ID, normalized text and page/image hash; re-import offers **skip**, **update** or **create copy**. Stage the import, show the report, then commit in one batch; never half-write. Write `import_source`, `import_format`, `imported_on`, `import_batch` and `import_source_url`. Tell users they are responsible for imported content and that no copyrighted question banks are bundled. Keep one small, legally usable fixture per format in CI.

**Acceptance criteria:** a generic CSV with a header imports by mapped columns and reports skipped rows; a same-length, same-prefix file edit is detected before re-import; re-importing the same deck does not duplicate by default; every imported item carries source properties and enters the normal due queue; a failed row or media file is reported without blocking the batch.

#### 5.22.4 Smaller study-flow ideas — **partly implemented in 1.17.0 and 1.18.0**

**Implemented in 1.55.0:** interleaved mixed review across due questions, flashcards and vocabulary, using one recall-and-rate session and the shared scheduler. **Implemented in 1.17.0:** rule-based extraction from headings, definitions, sentences, two-column tables, highlights and cloze marks; the `flashcards: true|false` per-note opt-in with preview; and **Practice this note only**. **Implemented in 1.18.0:** the opt-in daily quiz with its own streak, and optional exam question ranges in timed tests. **Implemented in 1.19.0:** image occlusion cards with one card per mask. **Implemented in 1.20.0:** Private Tutor, Socratic Tutor and Language Partner roles plus `/guide`, `/quiz`, `/confuse`, `/gap`, `/predict`, `/feynman` and `/mock` across both chat backends. **Implemented in 1.21.0:** Moodle GIFT import. **Implemented in 1.22.0:** Moodle XML and QTI quiz-bank import. **Implemented in 1.23.0:** Mochi Markdown and CrowdAnki JSON import. **Implemented in 1.24.0:** import preview, result reporting and skip/update/copy duplicate handling. **Implemented in 1.27.0:** the PDF annotation sidecar (hash-keyed Markdown notes, highlights, text boxes, form notes and page notes) with commands and a PDF context menu; the visual pen/highlighter overlay shipped in 1.52.0 and visual text boxes in 1.53.0. Audio-only commute mode remains queued because TTS is deferred.

- **Rule-based card extraction (no AI).** Build Q/A pairs from headings, "X means…" sentences, colon and bullet definitions, two-column tables, highlights and existing cloze marks. AI can improve or expand the result, but the rule-based path must work with AI off. *(Source: FlashCard plugin.)*
- **Per-note auto-card opt in/out.** A `flashcards: true|false` property so a lecture note is never scraped into cards by surprise. Pair it with a preview before writing.
- **Practice this note only.** Scope a session to one note or one heading, useful after a lecture and for debugging a question. Reuse the existing filter machinery; do not add a second queue.
- **Daily quiz plus streak.** Generate a small daily MCQ set from chosen folders, with a streak separate from study-time streaks. *(Source: VaultQuiz.)* Keep it opt-in and local; no notification spam.
- **Exam question range.** Run questions 1–20 (or any range) from a larger set for Bluebook-style section practice. *(Source: CBT Exam Simulator.)* Add it to timed-test blueprints (§5.6).
- **Tutor role presets.** Private Tutor, Socratic Tutor and Language Partner roles, plus `/guide`, `/quiz`, `/confuse`, `/gap`, `/predict`, `/feynman` and `/mock` commands. This extends §5.18; it is not a second assistant.
- **Image occlusion cards.** One card per mask on a diagram, useful for anatomy, biology and maps. Add it to the card types in §5.7. LearnKit, Osteon, Flashcard Studio and Decks are references; verify their licenses, and note that LearnKit's Anki import currently skips occlusion cards.
- **Audio-only commute mode.** Read due cards, questions and explanations aloud in a hands-free queue, with sentence highlighting and optional caching. TTS is deferred in Phase 2; this is the UX to evaluate when it returns. Provider (API) voices are the realistic route on Android because a plugin cannot rely on a system speech engine there. *(Sources: Voice Aloud, Murmur, Voice Notes, Apple TTS.)*
- **Ask-before-build UI gate.** For an ambiguous UI request, collect a screenshot, sketch or reference before changing the UI; ask and get answers first. This applies especially to the Quizlet-style skin (§5.22.2) and the reference panel (§5.22.5).
- **PDF editor.** Decide between integrating an existing MIT PDF plugin and building a small annotator. The useful scope is pen/highlighter, text boxes, form filling, highlights with notes, and a sidecar `annotations.md` keyed by a file hash. Desktop-first; mobile editing is limited. Pen/highlighter, text boxes and highlights with notes shipped in 1.52.0–1.54.0; form filling and a fuller PDF editor remain. This is desktop-first and must not delay scanning (§5.13.1). *(Candidates: Pdftion, Freedraw PDF, PDF Writer, Handwritten Notes, PDF Editor, PDF Ink, Local PDF Annotator.)*

#### 5.22.5 Reference panel — **M; optional module**

One optional **Reference** module (off by default) for tools students expect beside practice. It must match the exam: hide or restrict tools in closed-book, no-calculator or no-reference sections.

- **Graphing calculator.** Recommended route: **JSXGraph**, dual-licensed LGPL/MIT and usable under the MIT option, including commercially. It covers functions, geometry, vector fields, charts and touch input. Math Plotter, Plot Vectors and Graphs, and Excalidraw Math Plotter are MIT references.
- **Desmos is not the default.** The free personal Desmos API key is non-commercial, and the observed Obsidian Desmos plugin is GPL-3.0. Do not bundle Desmos code or build a paid feature on a personal key. If users want it, follow the **Live Plots** pattern: load it with the user's own key, disclose the restriction, and keep it optional. Revisit only with a Desmos partnership.
- **Periodic table.** The MIT Periodic Table plugin is desktop-only. Build a small mobile-friendly tap-to-open table in the panel. Check the dataset's license before bundling it.
- **Calculators, units and math input.** Unit Converter (MIT), Symbat (MIT, Numbat-based), Valnote Calculator (MIT), LaTeX Math (MIT, SymPy), MathLive (MIT, optional OCR needs a key). Calc Craft is Apache-2.0: permissive, but keep its NOTICE and isolate it if the repo must stay purely MIT.
- **One-screen references.** **Shipped in 1.106.0:** unit circle, trig identities, codon table and Punnett square in the Reference **Sheets** tab, beside the constants and formula sheets and the per-section hiding from §5.16.8. Everything is bundled local data.

**Acceptance criteria:** the panel is off by default and can be hidden per timed-test section; the graphing tool works without a network call and without a Desmos key; the periodic table and references work at phone width; every bundled dataset or library has its license recorded in `NOTICES.md`.

#### 5.22.6 License guardrails and candidate audit

**Decision (owner):** the plugin stays **MIT** so it can be monetized later. MIT allows charging for the software; it also allows anyone to fork and redistribute it, so plan to charge for things the MIT code does not hand out: hosted AI credits, sync/backup, a standalone app, original content packs, or support. This is not legal advice.

| Category | Rule |
|---|---|
| **Allowed to copy or bundle** | MIT, BSD, ISC and 0BSD code. Keep the copyright and license text in `NOTICES.md` and in copied file headers. |
| **Apache-2.0** | Permissive, but keep its license and NOTICE. If the repo must stay purely MIT, isolate Apache code or skip it. |
| **Dual-licensed** | Use the MIT option where offered (for example JSXGraph, LGPL or MIT). |
| **GPL / AGPL / LGPL** | Do not bundle into `main.js`. Reported examples: Obsidian_to_Anki (GPL-3.0), Obsidian Desmos (GPL-3.0), Talking Cards (GPL-3.0), Whetstone engine (AGPL). **Verify** each. |
| **MPL-2.0** | File-level copyleft. Avoid copying files into this codebase; the Cloze plugin is the example to check. |
| **Non-commercial / no-derivatives / proprietary** | Do not copy. Examples: Yiji Study's question bank (CC BY-NC-ND), ExamForge (proprietary), the free personal Desmos key. |
| **No license shown** | Treat as all rights reserved. Do not copy. |
| **"MIT with donation request"** | Read the exact text before reuse; Obsidian Scribe is the example. |

**Also check:** bundled dependencies and data (fonts, icons, element datasets, question banks, zstd decoders, drawing libraries) each have their own license; sample packs must be original; import services require a terms review; `CONTRIBUTING.md` should state that contributions are MIT; CI should fail on a disallowed license (§8.5); still **Verify** ts-fsrs, Chem/RDKit, Ketcher, Latex Suite, PDF++, and every candidate below. Before any paid tier, re-read Obsidian's directory and developer policies on payments, accounts, network use and licensing, and disclose them in the README.

**New candidates worth auditing** (directory/repo licenses as reported on Oct 28, 2026; open each repo before copying)

| Candidate | Why it matters | License note |
|---|---|---|
| **FlashCard** (Ansu Samanta) | Suspend/skip separate from Again, deck screen, review UI, import report, dashboard | MIT per directory; verify repo and zstd decoder provenance |
| **Syro**, **SFC Flashcards**, **Star InfoLearn** | Spaced repetition plus incremental reading; FSRS; four item types on one schedule | MIT per directory; verify |
| **CBT Exam Simulator**, **QuizPort**, **Note Quiz Engine**, **Simple Quiz**, **Omniscient** | Exam ranges and `@mc`/`@sata`/`@tf`; JSON quizzes; Markdown-checkbox quizzes; keyboard sessions | MIT; CQuiz license not shown |
| **AI Study Buddy**, **Deep Notes**, **Feynman Learning** | Tutor role presets, Socratic questions, gap analysis | MIT per directory; verify |
| **LLM Test Gen**, **Flashcard Generator**, **VaultQuiz** | Generation and grading from notes; daily quiz plus streak | MIT per directory; verify |
| **Whisper** (nikdanilov), **Voice Aloud**, **Murmur**, **Voice Notes**, **Apple TTS** | Transcription and read-aloud/commute mode | MIT; platform support differs and Android system speech is limited |
| **Better Task**, **Study Vault**, **Tag Timer**, **Study Tracker** | Exam task spread, course exams, timers, study streaks | MIT per directory; verify |
| **JSXGraph**, **Math Plotter**, **Plot Vectors and Graphs**, **Excalidraw Math Plotter** | Graphing and math figures | JSXGraph MIT option; others MIT |
| **Periodic Table**, **Unit Converter**, **Symbat**, **Valnote Calculator**, **LaTeX Math**, **MathLive** | Reference panel tools | MIT; **Calc Craft** is Apache-2.0 |
| **Pdftion**, **Freedraw PDF**, **PDF Writer**, **Handwritten Notes**, **PDF Editor**, **PDF Ink**, **Local PDF Annotator** | PDF editing and annotation routes | MIT; desktop/mobile support differs |
| **LearnKit**, **Osteon**, **Flashcard Studio**, **Decks** | Image occlusion | MIT or Verify; check each |
| **Mochi Cards Exporter**, **Yanki** | Mochi and Anki interop | Verify |
| **Do not copy:** Obsidian_to_Anki, Cloze, Desmos, Talking Cards, Yiji Study, ExamForge | GPL/MPL/proprietary/non-commercial/ND | See the table above |

#### 5.22.7 Standalone mobile prep checklist

§10c remains the product decision and monetization record. This is cheap preparation so a future app is not a rewrite.

- **Keep the core pure.** Item model, note parsers, scheduler, grading, import parsers and the AI service layer must not import Obsidian APIs or Node `fs`, so a React Native app can reuse them.
- **Treat the note format as a contract.** Markdown plus frontmatter, a documented property schema, and append-only history (§5.19) so phone and desktop merge safely.
- **Budget for a renderer.** The app cannot reuse Obsidian's Markdown or math rendering. Plan for Markdown plus KaTeX in a WebView; the rendering audit in §5.16.1 carries over.
- **Choose storage and sync early.** Try **Study Bundles** first (a zip of Markdown questions/cards/history that users import/export), then a user-chosen synced folder, then your own paid sync backend. Do not assume Obsidian Sync is available.
- **Keys and AI.** BYOK keys go in secure storage; a managed AI tier needs a backend, accounts and store billing rules.
- **Naming.** Do not use "Obsidian" in the app name or logo.
- **Pick a measurable trigger.** For example, repeated requests from users who do not use Obsidian, or a retention/download threshold. Do not start on enthusiasm alone.
- **Costs to re-check:** Apple Developer Program about $99/year; Google Play about $25 one-time; Expo EAS builds iOS from Windows but its free allowance changes; store commission is generally 15% for small developers and 30% above the threshold, with digital goods usually requiring in-app purchase; external payment links are in legal flux. A web/PWA test avoids store fees and review cycles.
- **License fit.** The MIT core can be reused. Everything excluded in §5.22.6 stays excluded, including GPL code and the non-commercial Desmos key. Check every mobile dependency's license in CI.

#### 5.22.8 New open questions

These are in addition to §11.

1. **Known vs exclude:** Is a timed snooze enough, or is permanent exclusion the main request? When a snooze ends, does the item return as due or new? Does it count toward accuracy and streaks?
2. **Quizlet-style MCQs:** Reading A (flip card) or reading B (card with choices)? Get the student's example set or a sketch before building.
3. **PDF editor:** Integrate an existing MIT plugin, build a small annotator, or skip it for now?
4. **Analytics:** Given the student vote, should a minimal all-progress view ship earlier than Phase 6?
5. **Import formats:** Confirm Mochi's current format and the current Moodle/GIFT/QTI specifications. Which format comes first after generic CSV?
6. **Desmos:** Confirm JSXGraph as the only built-in graphing route. The personal Desmos key is non-commercial and conflicts with the MIT-and-chargeable decision.
7. **Reference panel:** Which tools ship first (graphing, periodic table, formula sheet, unit converter), and which sections hide them?
8. **Mobile:** What measurable signal starts the standalone app, and should a PWA/web test come first? Is Study Bundles enough for the first sync story?
9. **Licensing:** Who verifies each candidate's `LICENSE` and `package.json` before any code is copied? Add that owner to the release checklist.

#### 5.22.9 Suggested order (advisory, not approved)

1. **Known and Exclude** — small, direct student request, improves every queue.
2. **Generic CSV/TSV import plus import report and dedupe** — highest reach for the least format-specific work.
3. **Quizlet-style MCQ skin** — reuses existing notes and the existing queue.
4. **Rule-based card extraction, per-note opt-in, practice-this-note-only** — creation and control without AI.
5. **Daily quiz/streak, exam question range, tutor role presets** — small study-flow wins.
6. **Image occlusion and audio-only commute mode** — card depth once TTS/provider support is validated.
7. **Reference panel** — useful but optional; keep it out of timed tests by default.
8. **PDF editor** — integrate first; build only if integration is inadequate.
9. **Import polish** — GIFT, Moodle XML, QTI, Mochi Markdown and CrowdAnki are implemented, with preview/report/update-copy and per-row/.apkg media reporting in 1.92.0. Canvas/Blackboard variants and `.apkg` export remain.
10. **Standalone mobile prep** — keep the core portable now; start the app only when the trigger is met.

### 5.23 Adaptive Practice parity audit — **S–M** (Oct 29, 2026)

Compared with Adaptive Practice 0.7.2 ([README](https://github.com/anupchavan/adaptive-practice), [LICENSE](https://github.com/anupchavan/adaptive-practice/blob/main/LICENSE)). The plugin repository is MIT. Its generation path runs through the separate Whetstone engine, which is AGPL, so no engine code may be copied. This audit is about behavior and UX, not code reuse.

**Verdict:** do not port Adaptive Practice wholesale. MCQ Tracker already has the broader study system and most of the core loop. Adaptive Practice is narrower but more automatic in five places: generate from any note, per-note subtopic memory, logged-skip fluency, adaptive session size, and a daily nudge. Add those in original MIT code, behind the existing optional-AI, preview, write-guard and undo rules.

| Adaptive Practice behavior | MCQ Tracker today | Decision |
|---|---|---|
| Generate from notes and PDFs | PDF/document import, lecture transcripts and weak-spot generation work; there is no **generate from any note** action. | **P1.** Add **Generate practice from this note** for any Markdown note and selected PDF text. Preview count, difficulty, destination and source before writing. |
| Deep read with outline, excerpts and attachments | Current-note and selection context are capped; lecture and document import read their own source. | **P1, same builder.** Send a bounded outline plus excerpts and headings, never the whole vault. Keep the untrusted-data boundary. |
| Lightweight vault skeleton index | Enumeration uses Obsidian's metadata cache; there is no persistent AI index. | **Do not adopt.** Vault enumeration stays for queues and filters. Revisit only if the large-vault test (§8.4) shows a real bottleneck. |
| Daily skill-aware topic queue | Today, due queue, daily quiz, adaptive difficulty and FSRS exist; there is no per-note skill score. | **P3.** Optional per-skill readiness later. Per-question FSRS is already more granular than per-note skill. |
| Fluency from correctness, skips and time | Time and confidence feed FSRS; **Skip (don't log)** deliberately records nothing. | **P2.** Add an optional **Don't know** action that records `result: skipped` and shortens the interval; keep the existing no-log Skip. Show both in Insights. |
| `sourceSubtopics` memory | Skill, domain and unit drive weak spots; generated questions do not remember which subtopics were covered. | **P2.** Record subtopic labels for generated batches and feed them into later prompts. Do not add a database. |
| Session size adapts to recent recall | Quick Practice is fixed at 2/5/10 minutes or 5/10/20 questions; the daily count is fixed. | **P2.** Optional warm-up/stretch sizing from recent accuracy and fluency, with hard caps and a visible override. |
| Daily practice reminder | Today and the daily quiz are available, but there is no reminder or status-bar nudge. | **P3.** Optional local reminder; no OS notification, no network request. |
| Provider breadth | Direct AI has Anthropic, OpenAI, OpenRouter, Gemini, Ollama and custom endpoints. OpenCode adds DeepSeek and Groq. | **P3.** Add Qwen as an OpenAI-compatible preset if its endpoint is confirmed. Keep Claude Code/Codex subscription routes out of the core; document OpenCode or a manual server. |
| Native PDF attachments | PDFs are read locally, figures captured, scans OCR'd through vision. | **Do not adopt.** Native PDF upload adds provider limits and sends more data; local extraction plus OCR is the better privacy path. |
| Dashboard, streak, one-click daily practice | Yes, and broader: Insights, heatmap, calibration, retention, study log, calendar. | **Done.** No parity work. |
| Blind verification | Blind AI check plus local numeric/calculation checks. | **Done.** No parity work. |
| Manual topic picker | Filters exceed Adaptive Practice, but there is no low-skill or PDF-only picker. | **Not separate work.** Add a low-skill filter only if users ask. |

**Priority and acceptance**

1. **P1 — Generate from any note.** This is the largest missing workflow. Acceptance: the preview shows count, difficulty, destination and source; nothing is written until confirmation; every AI-written MCQ runs the blind check; the batch is undoable; a normal note with no `transcript` property works.
2. **P2 — Fluency and session shape.** Acceptance: a logged skip is visible, is not counted as correct, and shortens the next interval; the existing no-log Skip is unchanged; warm-up/stretch stays within configured limits and can be overridden; subtopic labels survive an edit and are not sent when AI is off.
3. **P3 — Reminder and provider polish.** Acceptance: the reminder is off by default, local, once per day, and dismissible; Qwen is only listed after a real request test; no new binaries or subscription CLIs are added.

**Not parity goals:** the Whetstone engine, Elo-style generation calibration, native PDF attachment, and the persistent vault index. The engine is AGPL and would reintroduce process-execution warnings. The other three are implementation choices, not missing study features.

**Positioning line:** Adaptive Practice is generation-first and automatic; MCQ Tracker is bank-first and deeper on exams, cards, calendar, analytics and safety. Do not claim feature parity; claim the specific gaps above and their status.

**Shipped in 1.89.0:** all five P1–P3 parity gaps are closed. Any note can generate practice, generated batches remember their subtopics, a logged Don't know is visible in Insights without counting as wrong, session length adapts within hard caps, and the local reminder is opt-in. No Adaptive Practice or Whetstone code was copied; the implementation is original MIT code.

---

## 6. Property schema (draft)

Names are proposals; keep existing ones unchanged.

**Existing (keep):** `question_id`, `course`, `test`, `section`, `domain`, `skill`, `unit`, `difficulty`, `question_type`, `choices`, `answer`, `target_seconds`, `stimulus_id`, plus tracking fields (`result`, `attempts`, `streak`, `next_review`, `history`, etc.).

**New, by purpose**

| Purpose | Properties |
|---|---|
| Scheduling | `srs` (compact FSRS state), `scheduler: ladder\|fsrs`, `due` (readable copy) |
| FRQ | `max_points`, `last_score`, `rubric_source`, `graded_by`, `graded_on`, `criteria_missed` |
| AI provenance | `ai_generated`, `ai_model`, `generated_on`, `verified`, `verified_by`, `verified_on`, `needs_review` |
| Source | `source_note`, `source_page`, `source_pdf` |
| Courses | `course` (reuse), `semester`, `exam` (link or id) |
| Sync safety | `history` as append-only entries with unique timestamps; derived fields recomputed from it |
| Cards/vocab | `item_type: card\|vocab`, `language`, `part_of_speech`, `audio` |
| Card answer modes | `answer_mode: flip\|type\|speak`, `accepted_variants`, `grading_strictness: strict\|standard\|lenient`, `last_typed_answer`, `last_verdict`, `verdict_override`, `graded_by`, `graded_on`, `grade_status: pending\|graded`, `grade_attempt_id`, `grade_confidence` |
| Math / STEM | `tolerance`, `tolerance_type`, `sig_figs`, `units`, `accepted_answers`, `variables`, `answer_formula`, `variant_seed`, `last_variant`, `calculator: allowed\|none`, `formula_sheet` |
| Item control | `study_status: active\|known\|excluded`, `known_until`, `excluded_on`, `excluded_reason` |
| Import provenance | `import_source`, `import_format`, `imported_on`, `import_batch`, `import_source_url` |
| Note opt-in | `flashcards: true\|false`, `quiz: true\|false` |

**Principle:** if a note can be understood without the plugin, the properties are well-named. Avoid storing large blobs in frontmatter.

---

## 7. Phased roadmap (revised for confirmed decisions)

**Ordering logic.** Foundations and mobile first (they affect everything), then the two features the owner marked important (flashcards and calendar), then the AI layer and generation, then deeper exam and STEM features, then the dashboard and ecosystem. Ship each phase as a minor release through BRAT beta first, then the directory. Because the plugin is already listed, **never break existing users' notes**; every release includes migration tests.

### Phase 0: Foundations and safety

- [x] Module system: every module off by default, lazy-loaded, with first-run presets (§4.5)
- [x] Shared AI service layer: BYOK + OpenCode, capability flags, queue, cost caps (§4.6) — shipped in 1.79.0; the grade-later queue is the offline/retry path
- [x] Move API keys to Obsidian secret storage where supported (§4.4) — shipped in 1.75.0, with a plain-text fallback for older app versions and one-time migration
- [x] Publish the property schema and a data contract (§6) — schema version 1 and the stability rules shipped in 1.76.1, building on the 1.39.0 schema page
- [x] Item-type model (§4.2)
- [x] Append-only `history` with unique attempt ids, duplicate-safe retries, a merge helper and phone/desktop conflict tests (§5.19) — shipped in 1.76.0; the repair command also rebuilds counters and streak, while scheduling is left unchanged
- [x] Test suite, CI, and quality gates for agent-written code (§8.5)
- [~] **Blocked — manual gate** Math/chemistry rendering audit on a test vault (§5.16.1) — renderer audit, golden tests and chemistry fallback shipped in 1.80.0; the visual Obsidian check needs a real window
- [~] **Blocked** Mobile audit on real iOS and Android devices (§5.19) — no real device available here
- [x] Confirm licenses of anything currently bundled (§9) — audited in NOTICES and `docs/license-audit.md`; every future candidate still needs a repo-level check before use
- [~] **Partial** README, screenshots, and sample vault refresh (§10b) — README, docs and the `samples/sample-vault` walkthrough are done; screenshots remain a real-Obsidian manual gate

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
- [x] Card syntax compatibility and importers: Spaced Repetition, Anki, Quizlet, Kahoot, Blooket and Gimkit CSV import/export (§5.15) — desktop `.apkg` import shipped in 1.50.0, two-way AnkiConnect sync in 1.51.0, Quizlet PDF/test-bank import in 1.102.0 and its device file picker in 1.103.0; LearnKit import/export shipped in 1.114.0
- [x] Answer modes: flip, type and speak via OS dictation, with the deterministic cheap-first grading pipeline (§5.17)
- [x] AI fallback for typed answers that the local grader cannot settle, using the shared AI layer and a validated structured verdict (§5.17)
- [x] Durable grade-later queue for offline, slow or over-budget grading, with batch retry, idempotency and a pending-grade badge (§5.17)
- [x] Self-grade fallback when AI grading is off or the queue is discarded, recorded as `graded_by: self` (§5.17)
- [x] Unified due queue model and Today/command list across cards, vocab and MCQs — interleaved mixed-review sessions shipped in 1.55.0
- [x] Pending-grade visibility in Today and the Cards list, with per-card Review actions and a Grade now retry control (§5.17)
- [~] **Deferred** Optional TTS/audio — provider choice, mobile support and an audio-only commute mode still need validation. Exam-aware scheduling caps have landed (§4.3); see §5.22.4.

### Phase 2b: AP exam tools (research next; highly wanted)

These are **research and specification items**, not implementation work. The AP FRQ grader is the owner's requested next idea after card import; the score calculator and resource hub are its natural companions.

- [~] **Partial** **AP FRQ grader** — rubric-based, partial-credit grading with per-criterion feedback, self-grade fallback, score history, second pass, official-rubric marker, rubric categories and a scheduler/study-plan feed shipped in 1.97.0–1.101.0 for six courses (§5.20); photo-of-handwritten-work reading shipped in 1.104.0; human-scored calibration remains a quality gate
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
- [~] **Partial** **Pilot gate passed** — the owner approved six courses and user-supplied prompts on 2026-10-29; 1.97.0 shipped the pilot, 1.98.0 added the second pass and 1.99.0 added the review schedule and study-plan feed. The human-scored fixture set and go/no-go thresholds remain the gate for any accuracy claim.

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
- [~] **Partial** Optional AI summary and key-terms section for course notes, marked with the model and preserved when the summary fails (§5.13) — shipped in 1.44.0; local auto-classification shipped in 1.47.0, and the bundled OCR engine remains (licence review)
- [~] **Partial** Paper scanner: camera or photos → crop, rotate, reorder → one PDF saved in the vault (§5.13.1) — shipped in 1.46.0; automatic classification shipped in 1.47.0, and the bundled OCR engine remains (licence review)
- [~] **Partial** OCR for image-only scans: opt-in BYOK vision path with editable per-page text and a Markdown OCR note. The desktop user-installed OCR command adapter shipped in 1.49.0 and was removed in 1.86.0, so the plugin no longer requires `child_process` or `fs` directly; a bundled OCR engine remains the only gap (licence review)
- [x] Auto-classify a text document as MCQ, FRQ, mixed, cards or notes, then route it through the existing importers (§5.13.1) — shipped in 1.47.0; image-only OCR shipped through the opt-in vision path in 1.49.0
- [x] Provenance links from generated items back to the source PDF page (§5.13.1) — shared with 1.36.0
- [x] First-run welcome screen with presets, module toggles and a short how-to guide (§5.21) — shipped in 1.28.0
- [x] Reopen the welcome from a command and settings, and remember dismissal per device (§5.21) — shipped in 1.28.0
- [x] Optional external feedback and donation links, configurable under Global → About and never gating features (§5.21) — shipped in 1.41.0; the local in-plugin survey form shipped in 1.115.0
- [x] CSV export of a per-note summary and full attempt history for outside analysis (§5.15) — shipped in 1.38.0
- [x] Anki plain-text export with deck, note type and tag columns (§5.15) — shipped in 1.39.0
- [x] Documented property schema and Dataview examples in [docs/property-schema.md](docs/property-schema.md) (§5.15) — shipped in 1.39.0
- [x] Optional AnkiConnect push to a running Anki desktop, with duplicate reporting (§5.15) — shipped in 1.40.0
- [x] Optional `.apkg` import through a local ZIP/SQLite reader, with scheduling metadata (§5.15) — shipped in 1.50.0
- [x] Bidirectional AnkiConnect sync with note-ID mapping, content hashes and conflict handling (§5.15) — shipped in 1.51.0
- [x] Notes ↔ practice links — **Reread this** and source backlinks shipped in 1.36.0; the Insights **Concepts** mastery list shipped in 1.107.0 (§5.14)
- [x] Exam/quiz import breadth — GIFT, Moodle XML, QTI, Mochi Markdown and CrowdAnki shipped in 1.21.0–1.23.0; FlashQuiz `@mc`/`@sata`/`@tf`, QuizPort JSON and Markdown checkbox quizzes shipped in 1.108.0; zipped Canvas/Blackboard QTI archives are read in 1.109.0 and LearnKit blocks/quick cards in 1.114.0 (§5.22.3)
- [~] **Partial** Card and question export — Anki text, CSV, Markdown, JSON and Mochi `.mochi` (1.113.0) shipped; `.apkg` export remains (§5.15)
- [~] **Open (optional)** Pronunciation feedback for language learners
- [x] Handwritten-work photo reading — shipped in 1.104.0 as an opt-in vision transcript; since 1.107.0 one answer can use up to eight photos read in order and appended, recorded as `answer_pages`; grading still runs on text

**Unscheduled backlog.** The October 28 ideas in §5.22 are intentionally not assigned to a phase. Promote them individually after the owner ranks them; §5.22.9 is an advisory order, not a commitment.

---

## 8. Quality, privacy, and security plan

### 8.1 Privacy

- No telemetry. Say so.
- AI features default off with a per-feature disclosure of exactly what is sent (question text, passage, answer, student essay, notes).
- Separate toggles for: tutor, generation, grading, PDF import, transcription.
- Clear statement of which hosts the plugin can contact.
- Keys in secret storage; never log them.

### 8.2 Process execution and downloads

- Prefer direct API calls over spawning local programs.
- If any local binary is supported (e.g., local Whisper), require explicit confirmation, show source/version/checksum, and keep it optional and desktop-only. MCQ Tracker's OpenCode setup flow and Adaptive Practice's checksum-verified helper are the models.

### 8.3 AI correctness

- Verification pass for generated and imported answers.
- Visible provenance badges on every AI-written element.
- User can always edit or override.
- Keep a "report a bad question" action that sets `needs_review`.

### 8.4 Testing

- Unit tests: scheduler, rating mapping, grading, property parsing.
- Golden-file tests for question note parsing (including odd formats).
- Smoke tests for views and commands (you already run these).
- Large-vault performance test (thousands of notes): incremental indexing, as Adaptive Practice describes for its vault scan.
- Mobile test pass for every module marked mobile-capable.

### 8.5 Quality gates for agent-driven development

The owner plans to build with coding agents running for long periods. That removes the time bottleneck, but **shifts the risk to correctness, security, and drift**. Treat the following as mandatory.

**Process**
- **Spec first.** Each module has a short spec with acceptance criteria and test cases **before** an agent writes code.
- **Branch + pull request workflow.** Agents never commit directly to the main branch. Required checks must pass before merge.
- **Human review required** for: scheduler math, grading logic (including AI grading prompts), anything that handles API keys, file writes, network calls, process execution, migrations, and permissions.
- **Small, reviewable changes.** Long-running agents should produce incremental PRs, not one giant rewrite.

**Automated checks on every PR**
- Type-check, lint (including Obsidian plugin lint rules), unit tests, golden-file parser tests, migration tests against **real-format sample vaults** (including existing MCQ Tracker notes).
- Property-based tests for the scheduler and numeric grading.
- Bundle-size and startup-time budgets; lazy-load verification.
- Dependency audit, license scan, and pinned versions (avoid very new releases of dependencies).
- Reproducible build check: the committed `main.js` must match a build from source (MCQ Tracker's tests already include an up-to-date check; keep it).

**Security and trust**
- **Prompt-injection tests:** notes, PDFs, calendar descriptions, and typed answers containing adversarial instructions must not cause writes, leaks, or grade manipulation.
- **No `eval`** or dynamic code execution; parameterized-question formulas use a restricted evaluator (§5.16.4).
- Secrets never logged; keys in secret storage.
- Network host allow-list documented in the README.

**Data safety**
- Automatic backup and a dry-run mode before migrations or bulk edits.
- Never rewrite user notes without a diff or undo.
- Multi-device merge tests (§5.19).

**Release**
- **BRAT beta channel first**, then the directory.
- Changelog for every release; a "what changed in your notes" section whenever properties are touched.
- Rollback plan: keep previous release assets available.

**AI quality evaluation**
- Maintain small evaluation sets: card/answer pairs for the grader (§5.17), math problems with known answers (§5.16), rubric-graded FRQ samples (§5.5). Run them against any model before it is listed as recommended.

---

## 9. Licensing action list

| Item | Action |
|---|---|
| MIT ✅ items (LearnKit, Spaced Repetition, Tasks, Full Calendar original, uni-calendar, PDF++, WordFolio, Dictionary Lexicon, Pomodoro plugins, transcription plugins) | Confirm `LICENSE` file; keep attribution in a `NOTICES.md`; prefer reimplementing small ideas over copying large code |
| **Verify ⚠️** items | Check `LICENSE` before reuse. If no license is present, assume all rights reserved and do not copy |
| Whetstone engine | AGPL per Adaptive Practice's page. Do not incorporate |
| Full Calendar Remastered | GPLv3 per its page. Do not copy into MIT |
| "MIT with donation request" (Obsidian Scribe) | Read the exact text first |
| AI assistant plugins (Copilot, Agent Client, Codex Panel, Gemini Helper, LLM Hub) | All **Verify ⚠️**. Study their *design*, not their code, unless the license allows reuse. Do not copy prompts or UI wholesale |
| Math/chem plugins (Chem, Latex Suite, Function Plot, Calctex, Ketcher) | All **Verify ⚠️**. Prefer detecting and integrating with installed plugins over bundling their code. If you embed an expression evaluator or a symbolic library, record its license too |
| Third-party libraries (ts-fsrs, PDF libs, sql.js, charts) | Record each library's license in `NOTICES.md` |

---

## 10. Positioning

| Competitor / neighbor | Their strength | Your angle |
|---|---|---|
| LearnKit | Broad flashcard and note-review system, MIT, many downloads, study coach, AI generation | Exam-style practice (stimulus-based MCQ/FRQ, timed sections, confidence, mistake taxonomy) **plus** AI-graded typed/spoken flashcards, calendar- and exam-aware scheduling, one due queue for cards and questions, and a study-aware assistant |
| Adaptive Practice | AI-generated, adaptive, verified questions | Works without AI; owns the question bank format; grading and analytics depth |
| Spaced Repetition | Mature, large user base | Interop, not competition |
| Hold Course / uni-calendar / Full Calendar | Schedule and assignment management | Connect schedule to *what you know*, not just *when things are due* |

**Tagline candidates:** "Practice like the exam. Review right before you forget. Know when you're ready."

---

## 10b. Growth plan (starting from ~42 downloads)

Facts: MCQ Tracker was created days before the research date and had 42 downloads and about 8 releases. It is in the community directory and can ship updates. Growth will come from clarity, trust, and being easy to try, not from the feature count alone.

1. **Messaging.** Lead the README and directory description with the student outcome ("Practice like the exam. Review right before you forget."), not a feature list. Show short GIFs: a question session, a card with a typed answer being graded, the Today screen on a phone.
2. **Name and listing.** "MCQ Tracker" undersells an all-in-one study plugin. Check Obsidian's current rules on changing the display name or description while keeping the plugin ID (never change the ID; that would break installs). Update the directory description and categories to match the new scope.
3. **Easy first run.** Welcome screen with the preset chooser (§4.5, §5.21), a **sample vault** with original example questions and cards for SAT/AP-style and university use, and a 60-second quick start.
4. **Original starter content.** Provide sample question packs you or your agents author. Do **not** redistribute copyrighted official exam questions; make clear in docs that users are responsible for content they import.
5. **Honest comparisons.** A short page comparing the plugin with LearnKit, Spaced Repetition, and Adaptive Practice builds trust and helps search traffic.
6. **Communities.** Share in the Obsidian forum and Discord, and in student communities for SAT/AP and university study, with a demo rather than a sales pitch. Ask for feedback and act on it publicly.
7. **Tutorials.** Short videos or posts: "Study for AP Chemistry in Obsidian", "Turn lecture notes into practice questions", "Flashcards you answer by typing".
8. **Release rhythm.** Frequent, small releases with readable changelogs. Show a public roadmap (this plan, trimmed).
9. **Trust signals.** MIT license, no telemetry, documented network hosts, passing tests badge, and clear AI disclosures. Obsidian's scorecard (the page shows "Health: Excellent" for MCQ Tracker) is itself a trust asset; keep it passing as the plugin grows.
10. **Measure without telemetry.** Track directory downloads, GitHub stars/issues, and an optional, voluntary feedback link. Keep the "no telemetry" promise.

---

## 10c. Long-term standalone mobile track and monetization

The blueprint also describes a separate mobile product. This is a **long-term
future track**, not a second Obsidian plugin and not a change to the confirmed
one-plugin packaging decision. The plugin remains the source of truth for the
open-source core and the first mobile experience is Obsidian Mobile's
phone-first Quick Practice module (§5.19).

### Standalone mobile conversion path

- Evaluate a React Native + Expo application for iOS and Android after the
  plugin's core item model, scheduler, sync-safe history, and quick-session
  workflows are stable.
- Reuse MIT-licensed core logic where practical, while building a mobile UI
  designed for flashcards, MCQs, short answers, due queues, and compact
  statistics.
- Use Expo Application Services (EAS) for iOS builds from the Windows
  development environment.
- Treat sync, authentication, offline storage, and app-store compliance as
  separate architecture work; do not assume Obsidian vault access or Obsidian
  Sync is available to a standalone app.
- Gate the track on user demand, a clear data-portability story, and measured
  maintenance capacity. Keep it out of the near-term plugin roadmap until
  those questions are answered.

### Monetization options to evaluate

These are exploratory options, not a commitment to add telemetry, lock the
open-source plugin core, or require a hosted AI service:

1. **Freemium / Pro:** keep core MCQ, flashcard, and standard review features
   free; consider paid advanced analytics, optional cloud backup/sync, or
   custom themes for a future standalone app.
2. **AI usage packs or subscriptions:** offer managed server-side AI capacity
   as an optional paid tier while retaining BYOK for users who supply their
   own provider keys. Display model, cost, and privacy information before
   network-backed work.
3. **Content and expansion packs:** distribute only original, public-domain,
   or appropriately licensed study sets, or provide a creator marketplace
   after moderation, licensing, attribution, payments, and takedown workflows
   are designed.

Any monetization experiment must preserve the MIT license obligations, avoid
trademark confusion with Obsidian, and keep imported or bundled content's
rights clear. Revisit pricing only after validating which features users
actually value.

## 11. Decisions and remaining questions

### Resolved (see §0)
Packaging, audience, calendar and flashcard priority, BYOK + OpenCode, mobile quick sessions, agent-driven development, and the two new ideas (typed/spoken flashcards with AI grading, AI assistant).

### Still open
1. **Name and positioning:** Keep "MCQ Tracker" as the display name, or rename to reflect the full suite (while keeping the plugin ID)?
2. **SAT/AP content:** Will you provide original sample question packs? How should the plugin guide users who import official materials?
3. **Voice input:** Is OS keyboard dictation enough for v1, or is in-plugin recording and transcription a must-have? (Recording support on Obsidian mobile needs verification.)
4. **Agent on mobile:** Is read-only tutor mode on phones enough, with full agent mode desktop-only through OpenCode?
5. **FRQ on mobile:** Voice-dictated FRQs only, or skip FRQs on phones in v1?
6. **Handwritten work:** Resolved — photo-of-handwriting reading shipped in 1.104.0 as an opt-in vision transcript; grading still runs on text.
7. **Monetization:** Will the plugin stay fully free (BYOK means users pay their provider)? Sponsorship links are fine, but decide early.
8. **Compatibility promise:** How long will you keep supporting existing MCQ Tracker note formats? (Recommended: indefinitely, with migrations.)
9. **Beta channel:** Will you maintain a BRAT beta track for risky features such as the agent and scheduler changes?
10. **Standalone mobile trigger:** What download, retention, or sync-demand signal is sufficient to justify a separate React Native + Expo app?
11. **Monetization timing:** Which, if any, of the exploratory models should be tested first, and should experiments be limited to a standalone app rather than the plugin?

---

## 12. Link index

**Your plugins and close relatives**
- MCQ Tracker: https://community.obsidian.md/plugins/mcq-tracker
- Adaptive Practice: https://community.obsidian.md/plugins/adaptive-practice
- Whetstone engine (AGPL): https://github.com/anupchavan/whetstone-engine
- University Schedule and Calendar: https://github.com/Cesemess/obsidian-uni-calendar

**Flashcards / SRS**
- LearnKit: https://community.obsidian.md/plugins/learnkit · https://github.com/ctrlaltwill/learnkit · https://ctrlaltwill.github.io/LearnKit/
- Spaced Repetition: https://github.com/st3v3nmw/obsidian-spaced-repetition
- Obsidian Tutor: https://github.com/st3v3nmw/obsidian-tutor
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
- Retain: https://community.obsidian.md/plugins/retain
- Simple Flashcards: https://community.obsidian.md/plugins/simple-flashcards
- Decks: https://www.obsidianstats.com/plugins/decks
- Flashcards LLM: https://www.obsidianstats.com/plugins/flashcards-llm
- Auto Anki: https://www.obsidianstats.com/plugins/auto-anki
- Yanki: https://www.obsidianstats.com/plugins/yanki
- Simple Quiz: https://www.obsidianstats.com/plugins/simple-quiz
- Cornell Marginalia: https://www.obsidianstats.com/plugins/cornell-marginalia

**Vocabulary / language**
- WordFolio: https://community.obsidian.md/plugins/wordfolio
- Dictionary Lexicon: https://community.obsidian.md/plugins/lexicon-dictionary
- FSRS Vocabulary: https://community.obsidian.md/plugins/fsrs-vocabulary
- Language Made Easy: https://community.obsidian.md/plugins/language-made-easy
- Obsidian Dictionary: https://github.com/phibr0/obsidian-dictionary
- Zhongwen Reader: https://www.obsidianstats.com/plugins/zhongwen-reader

**Calendar / courses / tasks**
- Full Calendar (original): https://github.com/obsidian-community/obsidian-full-calendar
- Full Calendar Remastered (GPLv3 library): https://community.obsidian.md/plugins/full-calendar-remastered
- Calendar Event Sync: https://community.obsidian.md/plugins/calendar-event-sync
- ICS Calendar Viewer: https://community.obsidian.md/plugins/ics-calendar-viewer
- Tasks: https://community.obsidian.md/plugins/obsidian-tasks-plugin · https://github.com/obsidian-tasks-group/obsidian-tasks
- Task Center: https://community.obsidian.md/plugins/task-center
- Hold Course: https://community.obsidian.md/plugins/hold-course · https://github.com/LiveAQuietLife/obsidian-hold-course
- Course Command Center: https://www.obsidianstats.com/plugins/course-command-center
- Subject Manager: https://community.obsidian.md/plugins/subject-manager
- Verso (author page): https://community.obsidian.md/users/liveaquietlife

**Timers / heatmaps**
- Pomodoro Timer: https://community.obsidian.md/plugins/pomodoro-timer
- Timebox: https://community.obsidian.md/plugins/timebox
- Gentle Pomodoro: https://community.obsidian.md/plugins/gentle-pomo
- Pomodoro Logger: https://community.obsidian.md/plugins/obsidian-pomodoro-logger
- Todoist Pomodoro Heatmap: https://community.obsidian.md/plugins/todoist-pomodoro-heatmap
- Scrying Mirror of Productivity: https://www.obsidianstats.com/plugins/scrying-mirror
- Calendar Heatmap: https://github.com/deemsd/calendar-heatmap
- Heatmap Calendar: https://github.com/Richardsl/heatmap-calendar-obsidian
- Contribution Graph: https://community.obsidian.md/plugins/contribution-graph
- Activity Graph: https://community.obsidian.md/plugins/activity-graph

**Ingestion**
- PDF++: https://github.com/RyotaUshio/obsidian-pdf-plus
- Whisper: https://github.com/TfTHacker/whisper-obsidian-plugin
- Audio to Text: https://github.com/aaldrich29/Audio-To-Text
- Local Whisper: https://github.com/cdiak/local-whisper
- AI Transcriber: https://community.obsidian.md/plugins/ai-transcriber
- AI Audio Transcription and Summary: https://community.obsidian.md/plugins/ai-audio-transcription-summary
- Lecture Transcriber: https://community.obsidian.md/plugins/lecture-transcriber
- Obsidian Scribe: https://github.com/caridavidson/obsidian-scribe
- Pick Me: https://www.obsidianstats.com/plugins/pickme

**AI assistants and agents**
- Copilot: https://www.obsidianstats.com/plugins/copilot
- Agent Client: https://www.obsidianstats.com/plugins/agent-client
- Codex Panel: https://www.obsidianstats.com/plugins/codex-panel
- Gemini Helper: https://www.obsidianstats.com/plugins/gemini-helper
- LLM Hub: https://www.obsidianstats.com/plugins/llm-hub

**Math / chemistry / physics**
- Chem (SMILES rendering): https://community.obsidian.md/plugins/chem · https://www.obsidianstats.com/plugins/chem
- Obsidian Stats math plugin list (Latex Suite, Function Plot, Calctex, Math+, and others): https://obsidianstats.com/tags/math
- Forum: SMILES in Obsidian: https://forum.obsidian.md/t/smiles-in-obsidian/35974
- Forum: Obsidian for Chemistry (mhchem usage): https://forum.obsidian.md/t/obsidian-for-chemistry/33491
- Forum: ChemDraw Plugin (mhchem integrated, chemfig not supported): https://forum.obsidian.md/t/chemdraw-plugin/61241


---

## 13. Competitor analysis (snapshot 2026-10-29)

> Supplied by the owner on 2026-10-29. It reports MCQ Tracker at **1.30.0** with **75 downloads**; the plugin is now **1.109.0**. Competitor versions and download counts are snapshot values, not current status. This section is retained as the positioning record; the plugin's own status lives in the audit table above.

**Legend:** ✅ documented in the README or listing · ◐ partial or different approach · ❌ not documented in what I read (may exist undocumented) · — not applicable

### 13.1 At a glance

| Plugin | Downloads | Version (releases) | Age | License |
|---|---|---|---|---|
| **MCQ Tracker** (yours) | 75 (Obsidian Stats), 2 stars, 0 forks, no reviews | 1.30.0 (released ~14 h before the snapshot) | Not checked | MIT |
| Quiz Generator | 20k | 2.1.2 (7) | Created 3 yrs ago, last updated 2 yrs ago | MIT |
| CBT Exam Simulator | 2k | 1.5.3 (10) | Created 9 months ago | MIT |
| Spaceforge | 2k | 1.2.92 (23) | Created last year, updated 10 h before snapshot | MIT |
| Omniscient | 592 | 0.5.2 (5) | ~2 months | MIT |
| Note Quiz Engine | 65 | 0.3.2 (3) | ~4 weeks | MIT |

> **Corrections to an earlier chat reply:** Spaceforge now shows **2k** downloads (not ~1k from a stale search snippet), and Note Quiz Engine shows **65** (not 58).

**License note (not legal advice):** every plugin here is MIT. MIT lets others reuse code if the copyright and license notice stay with it, so ideas and even snippets can be borrowed with attribution. MCQ Tracker already follows this pattern: its README credits MIT-licensed code adapted from University Schedule and Calendar (Cesemess) and uses the MIT-licensed ts-fsrs library.

### 13.2 Plugin profiles

#### MCQ Tracker (yours)
- **Links:** [GitHub](https://github.com/ifriedenson/mcq-tracker) · [Obsidian Stats](https://www.obsidianstats.com/plugins/mcq-tracker) · directory deep link `obsidian://show-plugin?id=mcq-tracker`
- **License:** MIT
- **Core:** one note per question (a `question_id` property); passage/question/choices layout; auto-grading for MCQ and numeric (SPR) questions; timer, confidence buttons, mistake tags; history, streaks and next-review stored in note properties.
- **Scheduling:** 1/3/7/21/60-day ladder by default, optional FSRS; Known/Bury/Suspend/Exclude; exam-aware review (pulls reviews to the day before a matching exam).
- **Practice modes:** timed multi-section tests with resume, Quick Practice, daily quiz, weak-spot and error-log views, adaptive difficulty, study-cards skin, mixed review.
- **Import/AI (optional):** PDF/PPTX/DOCX/etc. → question notes (with figure capture), lecture transcript → practice, OCR, AI tutor, answer verification by a second call, weak-spot generation.
- **Extras:** flashcards/vocab module, Anki/Quizlet/Moodle/QTI/Kahoot/Blooket/Gimkit import-export, AnkiConnect sync, calendar (.ics), assignments + gradebook/GPA, focus timer, reference tools, AP score estimator and FRQ rubric grading, analytics dashboard and `mcq-dashboard` widgets.

#### Quiz Generator
- **Links:** [Directory](https://community.obsidian.md/plugins/quiz-generator) · [GitHub](https://github.com/ECuiDev/obsidian-quiz-generator) · [Obsidian Stats](https://www.obsidianstats.com/plugins/quiz-generator)
- **License:** MIT · **Downloads:** 20k
- **What it does:** AI generates exam-style questions from notes or folders you pick, then you answer them in a quiz UI with real-time feedback.
- **Features:** 7 question types (true/false, multiple choice, select-all, fill-in-the-blank, matching, short answer, long answer); saves questions as callouts or as flashcards compatible with the Spaced Repetition plugin; reopen saved quizzes; 22 generation languages; LaTeX; providers: OpenAI, Google, Anthropic, Perplexity, Mistral, Cohere, Ollama.
- **Status:** last updated about 2 years ago; its own roadmap lists test mode, spaced repetition, PDF/image generation, and difficulty settings as not yet shipped. The directory scorecard shows Health "Fair" and Review "Caution".
- **Has that you don't:** select-all / true-false / fill-in / matching types; 22-language generation; more AI providers (Perplexity, Mistral, Cohere); picks any notes/folders at generation time.
- **You have that it doesn't:** persistent scoring and history, spaced review, timing, analytics, timed tests, PDF import, and nearly everything else.

#### CBT Exam Simulator
- **Links:** [Directory](https://community.obsidian.md/plugins/cbt-exam) · [GitHub](https://github.com/nazdridoy/obsidian-cbt-exam) · [Obsidian Stats](https://www.obsidianstats.com/plugins/cbt-exam)
- **License:** MIT · **Downloads:** 2k
- **What it does:** timed, computer-based-test-style exams from a simple text syntax in one note.
- **Features:** exam runs in its own workspace tab with timer and question navigator; 7 question types (multiple choice, select-all, true/false, fill-in, matching, short and long answer); adaptive study mode (configurable mix of improvable vs. mastered, default 70% improvable); per-quiz history saved in a sidecar markdown file; mark for review; color-coded review mode; results dashboard; retake; Markdown + LaTeX; frontmatter options for time limit, pass score, shuffle, and question ranges; companion converter for VCE exam files.
- **Has that you don't:** select-all / true-false / fill-in / matching types; pass-score threshold; question and option shuffling; compact one-file quiz syntax; VCE converter.
- **You have that it doesn't:** spaced repetition, confidence ratings, mistake tags, PDF import, AI features, flashcards, calendar, deeper analytics, numeric/units grading.

#### Spaceforge
- **Links:** [Directory](https://community.obsidian.md/plugins/spaceforge) · [GitHub](https://github.com/dralkh/spaceforge)
- **License:** MIT (bundles ts-fsrs and fzstd, both MIT) · **Downloads:** 2k
- **What it does:** spaced repetition for whole notes plus an AI study suite. This is the **closest overlapping competitor** and it ships updates constantly.
- **Features:** FSRS and SM-2 scheduling; review bar docked under the note; leech handling and lapse checkpoints; AI-generated MCQs per note; adaptive AI tutor that charts a note into learning objectives and tracks understanding/recall/transfer (recall counts as durable only after two different days); study workspace with Learn, Visualize, Mind map and Summary; optional web lookup with citations; Anki-style deck engine (flip, reversed, MCQ, cloze, typed answer) with `.apkg` import and export, AnkiConnect background sync, and AnkiWeb search; statistics page (heatmap, 30-day forecast, true retention, leeches); Pomodoro timer; calendar events with recurrence and categories; 20+ AI providers including local servers and agent CLIs; optional progress file that travels with the vault; 22 commands.
- **Storage:** review data in the plugin's central data file, keeping note frontmatter clean.
- **Has that you don't:** objective-based AI tutor, mind map/visualize/summary workspace, web lookup, SM-2, leech handling, `.apkg` **export**, AnkiWeb search, review-forecast and true-retention stats, wider provider list, whole-note scheduling.
- **You have that it doesn't:** question-first MCQ practice with passages, timed multi-section tests, per-question timing, confidence calibration, mistake tags, PDF/document → question import with figures, numeric/units/parameterized questions, FRQ rubric grading, gradebook/GPA, AP tools, Quizlet/Kahoot/Moodle formats, exam-aware scheduling, progress stored in each question's own properties.

#### Omniscient
- **Links:** [Directory](https://community.obsidian.md/plugins/omniscient) · [GitHub](https://github.com/fortnitemaster32/Omniscient) · [Obsidian Stats](https://www.obsidianstats.com/plugins/omniscient)
- **License:** MIT · **Downloads:** 592 in about 2 months
- **What it does:** quiz-and-recall sessions based on Cal Newport's method. Questions are `> [!Question]` callouts in one file or a folder; the answer stays hidden until you reveal it and you grade yourself.
- **Features:** self-grade Struggling / Almost / Mastered(n); status written onto the question line; "exam-ready" after N consecutive mastered passes; filters by status, difficulty and section; shuffle; per-question hints; undo; keyboard-driven (Space, 1/2/3, H, N, S, U, Esc); per-file progress summary; sample quiz and usage guide. The author discloses it was built with an AI coding agent. Requires Obsidian 1.13.0+.
- **Has that you don't:** many questions per file, keyboard-first flow, per-question hints, the "mastered passes" exam-ready concept, a one-sentence pitch.
- **You have that it doesn't:** MCQ with auto-grading, timing, confidence, real spaced scheduling, analytics, imports, AI features, nearly everything else.

#### Note Quiz Engine
- **Links:** [Directory](https://community.obsidian.md/plugins/note-quiz-engine) · [GitHub](https://github.com/port22-dev/note-quiz-engine) · [Obsidian Stats](https://www.obsidianstats.com/plugins/note-quiz-engine)
- **License:** MIT · **Downloads:** 65 (about 4 weeks old)
- **What it does:** `note-quiz` code blocks render as interactive multiple-choice or text questions inside the note, with scores saved back as Markdown. README is Japanese-first with an English version linked.
- **Features:** Generate quiz / Start quiz buttons at the top of a note; instant grading, explanations, score/accuracy, retry; multiple accepted answer strings for text questions; saves `quiz_source`, `quiz_created` and a Quiz Results section; AI generation by handing the note to Claudian or by copying a prompt and importing the generated Markdown from the clipboard (it does not call an LLM API itself); generation language: Japanese, English, or same as the note.
- **Has that you don't:** inline quiz blocks rendered inside notes; clipboard import of generated quizzes; Japanese-language audience.
- **You have that it doesn't:** timing, confidence, spaced review, analytics, direct AI integration, PDF import, flashcards, and much more.

### 13.3 Feature matrix

| Feature | MCQ Tracker | Spaceforge | CBT Exam | Quiz Generator | Omniscient | Note Quiz Engine |
|---|---|---|---|---|---|---|
| Multiple-choice practice | ✅ | ✅ | ✅ | ✅ | ❌ (Q&A reveal) | ✅ |
| Automatic grading | ✅ | ✅ | ✅ | ✅ | ❌ (self-grade) | ✅ |
| Numeric answers (tolerance, units, sig figs) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Parameterized questions (random variants) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Select-all / true-false / fill-in / matching | ❌ | ◐ (cloze, typed, MCQ in decks) | ✅ | ✅ | ❌ | ❌ |
| Short / long free response | ◐ (self-grade + FRQ rubric) | ◐ (typed cards) | ✅ | ✅ | ◐ (self-graded) | ✅ (text answers) |
| Spaced repetition | ✅ | ✅ | ❌ | ❌ (on roadmap) | ❌ | ❌ |
| FSRS | ✅ (optional) | ✅ | ❌ | ❌ | ❌ | ❌ |
| SM-2 | ❌ (ladder instead) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Leech / lapse handling | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Timed test / exam mode | ✅ (multi-section) | ❌ | ✅ | ❌ (on roadmap) | ❌ | ❌ |
| Per-question timing | ✅ | ❌ | ◐ (total time) | ❌ | ❌ | ❌ |
| Confidence ratings + calibration | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mistake-type tagging | ✅ | ◐ (AI tutor error categories) | ❌ | ❌ | ❌ | ❌ |
| Adaptive / weak-spot practice | ✅ | ✅ (tutor) | ✅ | ❌ | ◐ (not-mastered filter) | ❌ |
| Analytics dashboard | ✅ | ✅ | ◐ | ❌ | ◐ (per-file summary) | ◐ (score history) |
| Progress stored in the note files | ✅ (properties) | ❌ (central data file) | ◐ (sidecar file) | — | ✅ | ✅ |
| Many questions in one file | ❌ (one note each) | ✅ (deck files) | ✅ | ✅ | ✅ | ✅ |
| Inline quiz rendering inside a note | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Question / option shuffling | ◐ (random pick mode) | ❌ | ✅ | ❌ | ✅ | ❌ |
| AI question generation | ✅ (optional) | ✅ | ❌ | ✅ | ❌ | ✅ (via Claudian / clipboard) |
| Direct LLM API support | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| AI tutor / chat | ✅ (optional) | ✅ (objective-based) | ❌ | ❌ | ❌ | ❌ |
| AI answer verification (second pass) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Web lookup during study | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Documents / PDFs → questions | ✅ | ❌ | ◐ (external VCE converter) | ❌ | ❌ | ❌ |
| Flashcards | ✅ (optional) | ✅ | ❌ | ◐ (saves in SR format) | ❌ | ❌ |
| Anki `.apkg` import | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Anki `.apkg` export | ❌ (text export) | ✅ | ❌ | ❌ | ❌ | ❌ |
| AnkiConnect sync | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Quizlet / Kahoot / Moodle import-export | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Calendar | ✅ (.ics) | ✅ (own events) | ❌ | ❌ | ❌ | ❌ |
| Focus / Pomodoro timer | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Exam-aware scheduling / cram mode | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assignments + gradebook / GPA | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reference tools (calculator, periodic table, AP estimator) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mind map / visualize / summary views | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Multi-language generation | ❌ (not documented) | ◐ (tutor language) | ❌ | ✅ (22) | ❌ | ◐ (ja / en / same) |
| Desktop + mobile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 13.4 What competitors have that MCQ Tracker doesn't (candidate gaps)

Ordered roughly by how often they appear across competitors and how much they matter for exam prep:

1. **More question types:** select-all-that-apply, true/false, fill-in-the-blank and matching (CBT Exam Simulator and Quiz Generator both have all four).
2. **Lighter authoring:** every competitor except Spaceforge's decks lets you write many questions in a single file. MCQ Tracker needs one note per question with properties, which is heavy for hand-written questions. A plain-text quick-add or multi-question-per-file import would lower the barrier.
3. **Shuffling:** question and answer-option shuffle (CBT, Omniscient).
4. **Pass-score threshold** on timed tests (CBT).
5. **`.apkg` export** to Anki (Spaceforge).
6. **Leech handling** for repeatedly failed items (Spaceforge).
7. **Multi-language generation** controls (Quiz Generator, Note Quiz Engine).
8. **Inline quiz blocks** rendered inside a note (Note Quiz Engine).
9. **Objective-based tutor / mind map / web lookup** (Spaceforge). These are large, so probably not worth chasing.

### 13.5 Where MCQ Tracker leads

- Confidence calibration, mistake tagging and per-skill weak-spot analytics. No other plugin here documents any of the three.
- Multi-section timed tests with resume plus per-question timing.
- Document/PDF → question notes with figure capture, answer-key detection and AI-answer labelling.
- Numeric grading with units, tolerance and parameterized variants; FRQ rubric grading.
- Exam-aware scheduling tied to a calendar; gradebook; AP tools.
- Broadest import/export (Quizlet, Kahoot, Blooket, Gimkit, Moodle, QTI, `.apkg`).
- Progress lives in each question's own properties, so it works with Dataview and survives without the plugin.

### 13.6 Positioning notes

- **Closest rival is Spaceforge** (FSRS, Anki, calendar, Pomodoro and AI MCQs overlap). It schedules whole notes and leans on an AI tutor; MCQ Tracker is question-first and exam-format-first (SAT/AP-style passages, timing, confidence). That difference is the clearest thing to say in the listing.
- **Omniscient reached about 590 downloads in two months** with a very simple pitch and one-file authoring. A short, concrete tagline plus a one-minute demo GIF likely matters more than additional features.
- **Quiz Generator is the biggest by downloads (20k) but stale** (last updated about 2 years ago). People searching for "quiz" in the directory find it first; it has no persistence or scheduling, which is the opening.

### 13.7 Other study-quiz plugins spotted (not analyzed in depth)

| Plugin | Link | Note | License |
|---|---|---|---|
| quizblock | [Directory](https://community.obsidian.md/plugins/quizblock) | Interactive multiple-choice blocks in notes; questions shareable as plain `.md` | 0BSD |
| Omni Quiz | [Directory](https://community.obsidian.md/plugins/omni-quiz) | JSON-schema `quiz` code blocks | MIT |
| Easy Quiz | [Directory](https://community.obsidian.md/plugins/easy-quiz) | Markdown-native quiz practice; attempt records written into the note | Not checked |
| CQuiz | [Directory](https://community.obsidian.md/plugins/cquiz) | `cquiz` code block loads questions from a note or folder; checkbox-list question format | Not checked |
| Better Quizbox | [Directory](https://community.obsidian.md/plugins/better-quizbox) | Quiz block plugin | Not checked |
| LearnKit | Listed as a related plugin on the directory pages | "Native study system": flashcards, spaced repetition, tests | Not checked |

### 13.8 Sources

- MCQ Tracker: https://www.obsidianstats.com/plugins/mcq-tracker · https://github.com/ifriedenson/mcq-tracker
- https://community.obsidian.md/plugins/quiz-generator
- https://community.obsidian.md/plugins/cbt-exam
- https://community.obsidian.md/plugins/spaceforge
- https://community.obsidian.md/plugins/omniscient
- https://community.obsidian.md/plugins/note-quiz-engine

Limits of this analysis: "❌" means the feature is not documented in the README or listing I read, not that it is proven absent. I did not install or test any plugin. Download counts for MCQ Tracker come from Obsidian Stats, not the official directory page.

### 13.9 What this changes in the backlog

The analysis added four gaps that were not explicit in §5.22. The first and fourth have shipped; the remaining two stay unscheduled until the owner ranks them:

- [x] **Native select-all, true/false, fill-in and matching practice.** True/false and select-all practice shipped in 1.110.0 with automatic set grading, selectable buttons, attempt history, timed-test support and result marking. Fill-in (`question_type: fill_in`, normalized text with `|` and `accepted_answers` variants) and matching (`question_type: matching`, `Left :: Right` pairs under `## Pairs`, shuffled row pickers, whole-set and per-row grading in practice and timed tests) shipped in 1.112.0. Import already understands `@sata`, `@tf` and QuizPort choice sets (1.108.0).
- [ ] **Lighter multi-question authoring.** A plain-text quick-add (or rendering existing one-file quiz blocks) would reduce the one-note-per-question cost that Omniscient and Note Quiz Engine avoid.
- [ ] **Timed-test option shuffling and a pass-score threshold.** CBT and Omniscient ship both; MCQ Tracker has a random pick mode but no per-test option shuffle or pass mark.
- [x] **Leech handling** for repeatedly failed items, shipped in 1.111.0 as an opt-in threshold with a flag or suspend action, `leech_lapses`/`leech_since` properties and automatic clearing on a correct answer. Distinct from the manual Suspend/Bury controls.

Not planned: objective-based tutor workspace, mind maps and web lookup (Spaceforge's lane; large and outside the question-first positioning). `.apkg` export stays gated on a tested SQLite writer, as recorded in §5.15.

---

## Appendix: Archived brainstorms and superseded drafts

The Gemini brainstorm, the pre-Oct-27 duplicate of this plan and the original product
blueprint were moved verbatim to [docs/archive/plan-brainstorms.md](docs/archive/plan-brainstorms.md). They are historical
input only; this document is authoritative where they differ. The duplicate's §10c and
open questions 10–11 were promoted into §10b and §11 before the move.

## Appendix: Calendar module absorption record (Oct 28, 2026, v1.6.0)

The calendar module (§5.8) is built on absorbed University Schedule and Calendar code (MIT,
Cesemess), pinned at upstream commit `35778e473a1d7ad7827c83c065b0f61dcbefdbc5` (v1.2.0). The
audit gate passed: `LICENSE` confirmed MIT, no dependencies, plain JavaScript, no upstream
tests. Attribution and the exact modifications are recorded in `NOTICES.md`.

Shipped behind the module switch (off by default):

- `.ics` import from a vault file or a public feed URL, including Google `?cid=`/`?src=` links and
  `webcal://`; URL feeds sync on demand, and on startup only when that setting is on.
- Month grid, day timeline, live "class in progress" countdown, Upcoming list, exam countdowns.
- Class details (room, lecturer, category, exam detection), excluded subjects and keywords,
  category colors, first day of week, 12/24-hour and date formats.
- Per-class notes from an editable template (`{subject}`, `{date}`, `{time}`, `{time_start}`,
  `{time_end}`, `{room}`, `{lecturer}`, `{type}`, `{course}`), with the subject-to-folder mapping
  remembered on first use.
- `uni-schedule` / `uni-calendar` embeds with `date: today|tomorrow|YYYY-MM-DD`, plus
  `mcq-schedule`. The `uni-*` names are skipped when University Schedule and Calendar is enabled,
  so both plugins never render the same block (resolves §11 item 19).
- Filtered `.ics` export that respects hidden sources and exclusions.
- English-only labels and an editable text template: no visual template builder and no regional
  guides (the current answer to §11 item 20).

Not done yet: reading events written by other calendar plugins, and testing on real iOS and Android
devices.
