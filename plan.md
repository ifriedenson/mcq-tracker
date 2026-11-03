# MCQ Tracker → Ultimate Study Tool: Product & Integration Plan

**Status:** Local scope implemented; §3.9.6 is the single current gate table and §3.9.3 is the historical feature matrix. Unreleased local study work now adds thirty-two independent modules (Cornell, lecture log, goals, Feynman, recall, topic planner, Study Flow, subjects, quiz index, course hub, tasks, annotations, deep notes, retention, vocabulary, quiz maker, SFC-style cards, CBT exam blocks, SAT Math solver, read aloud, lecture-note compiler, course health, audio bookmarks, Feynman AI feedback, PDF annotation index, scheduler fitting, study map, cited vault search, portable card archive, study nudge, course templates, reading library) plus Quizzable-style reusable quizzes and partial credit. The **Reading library** tab (want/reading/finished shelves, page progress, ratings and quotes) is included in that count. Unreleased on `main`: the Qwen provider preset and local `chem`, `biology`/`biosequence` and `circuit` blocks. **1.176.0 is the new release** (Nov 2, 2026): the sidebar **Task list** ships with tags, filtering and a card layout on top of the 1.175.0 graph inequalities, the 1.174.0 parameter sliders, the 1.173.0 regression rows, the 1.172.0 list, the 1.171.0 Reference graph and the 1.170.0 responsive UI pass. **1.169.3 was released** (Nov 1, 2026): restores the optional OpenCode one-click installer removed in 1.169.1, including the accepted `fs`/`child_process` warning. **1.169.2** was the import hotfix that exports the shared `extensionOf` helper, so the question, course-note and document-review import dialogs no longer fail with `extensionOf is not a function`; `main.js` is rebuilt. **1.169.1 was released** (Nov 1, 2026): the directory-warning patch removes the OpenCode auto-installer and direct `fs`/`child_process`, and clears the CSS duplicate-height and `!important` warnings. **1.169.0 was released** (Nov 1, 2026, on top of 1.168.1): the full `code-review.md` close-out, including the combined Insights dashboard, shared course identity, merged exams, readings and attendance, richer grades and FSRS-aware mastery, AI verification and distractor checks, and the data and performance fixes. **1.168.1** added: the post-answer review screen now has the same dedicated phone layout as the question screen — its own review header, Review | Passage tabs, one review scroller and a safe-area action bar, with secondary actions in the More sheet; desktop and tablet review keep the shared split. Version 1.168.0 added the study-tools batch, and 1.166.0 added deterministic FlashCard extraction with explicit Question/Answer labels, `::`/`→`/`=>` separators, reproducible seed ordering and card repeat-review retention; unreleased on `main`: odd/even ICS timetable parity via `X-MCQ-WEEK-PARITY` and a default-off think-first chat timer (15 s, 5–120 s); 1.165.0 added: inline quiz static answer-key mode, inline quiz L1–L4 cognitive-level labels, an inline QuizPort player, a full-width Today widget dashboard, gated inline-quiz notes, a per-view laptop layout pass, Quizlet PDF fixture and device-path proof, Better Quizbox bind/copy mirroring, a Note Quiz Engine clipboard importer, a Simple Flashcards-compatible block, a Direct AI runtime model discovery flow, a Verso-style reading-plan block, a local tag-timer block, an Exam Plugin-compatible XML exam block, and a Quizlet PDF importer repair, a public README/manifest/package description refresh, assignment time estimates with workload totals, a Markdown-table card importer, and read-only Full Calendar note interop; 1.164.0 removes dynamic quizjs execution and the scanner-flagged CSS longhand; 1.163.0 adds the due error-log review sheet; 1.162.0 adds optional semester dates, term-week numbers and reading weeks to the calendar; 1.161.0 adds opt-in shared-option choice questions to inline quizzes; 1.160.0 adds opt-in typed numeric questions with tolerance to inline quizzes; 1.159.0 adds opt-in reorder questions to inline quizzes; 1.158.0 adds opt-in Quizzable-compatible `quizResults` frontmatter export for inline quizzes; 1.157.0 adds an optional exam-ready badge after N consecutive correct answers, defaulting to 2; 1.156.0 adds optional per-question hints with a Show hint control and Quick add Hint support; 1.155.0 adds optional closed-book practice that hides the Open note shortcut until Submit; 1.154.0 adds exam-coverage progress against a course's declared topic count; 1.153.0 adds an answer-free practice-sheet export; 1.152.0 adds an opt-in needs-fixing flag that marks questions missed on five distinct days and offers a non-destructive Mark fixed action; 1.151.0 adds an opt-in daily-quiz streak freeze that preserves a streak across a missed day; 1.150.0 adds an opt-in fade/flip answer reveal for card review, with reduced-motion fallback and no scheduler change; 1.149.0 adds Anki folder exclusions, keeping selected vault folders out of Anki previews and pushes; 1.148.0 adds Spaced Repetition quiz notes generated from the active note, previewed, saved as `#flashcards` multiline `?` syntax and imported through the existing card store; 1.147.0 adds Text2Anki, a one-shot selection-to-Anki shortcut with custom instructions and Deck: directives; 1.146.0 adds Auto Anki, a one-command AI-to-card-to-Anki flow; 1.145.0 adds optional Spaced Everything whole-note SuperMemo 2 review and thought capture; 1.144.0 adds a Simple Note Quiz that marks known/missed questions directly in the active note; 1.143.0 adds Simple Quiz blocks and local quiz charts; 1.142.0 adds guided card/deck creation and optional CouchDB review-state sync; 1.141.0 added source-anchored recalls that store the selected source passage, show it in card review and reopen it in context; 1.140.0 adds Quizzator-style slider/text questions, per-question weights and pass/imprecise/fail scoring to inline quiz blocks; 1.139.0 adds per-note scheduler choice, opt-in file-explorer due/new markers, Flashcard Learning card parity and the review hardening pass; 1.138.0 adds per-deck SM-2/FSRS scheduling with per-deck timing, on top of 1.137.0's Obsidian content authority and exact Anki source links, 1.136.0's AnkiSync+ parity (regex omission, Excalidraw SVG embeds, tag and deck exclusion filters and opt-in stale-link cleanup) and 1.135.0's plain Markdown cards with folder-tree Anki decks and 1.134.0's vault-wide Anki push, video and table conversion, extra tags and source backlinks, 1.133.0's Anki preview, media bridge and folder-deck options, 1.132.0's custom-prompt flashcard generation, 1.131.0's AI quiz generation and 1.130.0's inline `mcq-quiz` blocks and whole-note review, 1.129.0's **Study bundle** export and import, 1.128.0's plain-text **Quick add questions** authoring, 1.127.0's mastered-count trend in Today, Progress and the dashboard embed, 1.126.0's Today scope/window controls, 1.125.0's Quick Practice header, 1.124.0's Today card, 1.123.0's embed practice and per-block window, 1.122.0's embed mastery section, 1.121.0's 7-day window, 1.119.0's remembered mastery scope and 1.118.0's Progress dashboard (goal ring, week-over-week momentum, mastery bands, course progress and next steps), 1.117.0's optional timed-test choice shuffling and pass mark and 1.116.0's Anki `.apkg` export, 1.115.0's local-only in-plugin feedback survey, 1.114.0's LearnKit import/export, 1.113.0's Mochi `.mochi` export, 1.112.0's native fill-in and matching practice, 1.111.1's true/false key fixes and offline leech handling, 1.111.0's opt-in leech handling, 1.110.0's native true/false and select-all practice and 1.109.0's zipped Canvas/Blackboard QTI archives, 1.108.0's FlashQuiz, QuizPort and Markdown-quiz import, 1.107.0's Insights Concepts mastery list and multi-photo FRQ answers, 1.106.0's one-screen reference sheets, 1.105.0's Learn, Test and Match study modes, 1.104.0's opt-in photo-of-handwritten-work reading to the FRQ grader, 1.103.0's device file picker for Quizlet PDF import, 1.102.0's local Quizlet PDF/test-bank import, 1.101.0's full course registry, FRQ math preview and rubric categories, 1.100.0's mixed MCQ/SPR/FRQ timed tests, 1.99.0's score-based FRQ review schedule, 1.98.0's optional second grading pass and official/teacher rubric marker and 1.97.0's six-course AP FRQ pilot. Remaining blocked items: real-device checks beyond the captured 1200/390 Obsidian widths, TTS and pronunciation validation on mobile audio, PDF form filling/full editor, and the bundled OCR engine (licence review). Human-scored FRQ calibration remains a quality gate, not an implementation gate. Mission step 8 is complete: §3.9.1 records 28 MIT-verified related repositories (26 with a plugin manifest) and the ordered step-9 queue. Step 9 is complete: queue rows 1–28 are implemented, including the per-note scheduler, opt-in file-explorer markers, source-anchored recalls, guided card/deck creation, optional CouchDB review-state sync, Simple Quiz blocks, Simple Note Quiz, Text2Anki, Spaced Everything, Auto Anki, Spaced Repetition quiz notes, Anki folder exclusions, the optional card reveal animation and the optional daily-quiz streak freeze. Study Vault's exam-days/topics widget is verified-satisfied. A-Level Study Coach's error-log review sheet ships in 1.163.0; its think-first timer is implemented unreleased (§11 item 17); Class Timetable odd/even parity is §11 item 16, Omniscient keyboard-first shortcuts are §11 item 14, and §5.22.4 item 1 stays open in §11 item 13.
**Prepared:** October 27, 2026
**Revision:** Added decisions confirmed by the owner (§0), math/STEM (§5.16), typed/spoken flashcard answers (§5.17), AI assistant (§5.18), mobile quick sessions (§5.19), AP FRQ grader/score calculator/resource research (§5.20), growth plan (§10b), agent-driven quality gates (§8.5), the October 28 idea backlog (§5.22), and the Adaptive Practice parity audit (§5.23, Oct 29, 2026). and the Oct 30 similar-plugin scan (§3.9). Roadmap re-ordered (§7).
**Base plugin:** [MCQ Tracker](https://community.obsidian.md/plugins/mcq-tracker) (MIT, v1.5.1 at time of research)

> **Owner decisions applied (Nov 1, 2026):** the owner accepted the 17 recommended defaults in §11. The plugin remains free with BYOK and optional donations. No external audio/transcription provider, provider TTS, paid AI scoring/RAG, web lookup, Canvas/Classroom OAuth, `.vce`/SAT curve, bundled OCR/PDF-form engine or code runner is approved; those rows are gated, not claimed. Central schedules stay note-backed, the review dock stays underneath, the plugin stays offline, and the minimal Practice keyboard map is implemented unreleased. The Qwen preset and local chemistry/biology/circuit renderers are implemented unreleased; they use no copied code. Manual visual/device and release gates remain with the owner.

> **How to read the license notes.** License information below comes from each plugin's community page, README, or a stats/index site as seen during research on Oct 27, 2026. Items marked **Verify** were not confirmed. Before copying any code, open the repo's `LICENSE` file and `package.json` yourself. MIT allows reuse if you keep the copyright and license notice. This is not legal advice.

## Handoff snapshot (Oct 30, 2026)

**Start a new chat here.** The repository is the source of truth; this section records the current state so a fresh chat does not need the old conversation.

- **Sidebar task list polish and tags (Nov 2, 2026):** the sidebar **Task list** now reads as a pane-sized board: an open/total badge, a counts line, a card-shaped add form, and task cards with an accent left edge for overdue (red) and due-today (accent) work, course/due/exam-plan pills, a strike-through on completed rows and a delete button. Tasks carry optional **tags**: `studyTasks` rows gain a bounded `tags` array of at most four 24-character, hash-free, case-insensitively unique tags, set when a task is added or through the row **+ tag** inline editor; tags render as chips and a chip doubles as a filter with a Clear action. Existing rows and the Study Workspace Tasks tab keep working because `tags` is optional. Covered by the expanded `tests/task-list.test.js` (sanitising, the four-tag cap, filtering, inline tag editing); full suite **1,395 pass / 0 fail**, `npm run check` clean across **231 modules**, `main.js` rebuilt, `git diff --check` clean. Released in **1.176.0**.- **Sidebar task list (Nov 2, 2026):** `src/task-list-view.js` adds a compact **Task list** in the right sidebar over the existing local `studyTasks` rows, so the Tasks module is reachable without opening the Study Workspace. It shows open/done/overdue counts, adds a task with an optional due date, completes, reopens and deletes rows, labels overdue and due-today work, and links to the Tasks tab. The view is registered as `question-tracker-task-list`, opens from the **Open the task list** command and a `list-checks` ribbon button (only while Tasks is on), repaints with `refreshViews()`, and detaches when Tasks is turned off; phones fall back to a tab. No note write, scheduler change or new setting. Covered by `tests/task-list.test.js` plus the updated view/command list in `tests/plugin.test.js`. Released in **1.172.0**.
- **Connector/reachability close-out (Nov 1, 2026, unreleased):** closed the remaining `code-review.md` reachability gaps. `indexReadingPlans()` scans fenced reading plans at layout-ready so Today and course plans do not depend on opening the block; Today's next-exam card consumes the merged `getExams()` list, including manual exams; the Course Settings name field renames through `renameCalendarCourse()` and preserves old names/codes as aliases; exam plans include only lectures after the previous exam or matching exam topics; and the course overview carries exam readiness/evidence and source paths for every actionable row. `docs/code-review-closeout.md` is the item-by-item G1–G7/GLM ledger, including product and manual gates. Verification: **1,320 pass / 0 fail**; `npm run check` clean across **230 modules**; `main.js` current at 3,220,398 bytes; `git diff --check` clean. Version **1.168.1** unchanged; no commit, tag, release or push.
- **Remaining code-review gaps closed (Nov 1, 2026, unreleased):** re-read `code-review.md` and implemented its four remaining code-fixable findings. Verbatim findings: §2 gap 2 *“No per-lecture state. Attendance is derived only from the absence log; there is no "lecture processed → questions/cards generated" flag, so lecture-compiler/transcript output never links back to the lecture row.”*; §3 *“`fm.history` is unbounded per note (day counters are capped, history is not).*”; §5 gap 8 *“No distractor-quality checks beyond structure”*; §5 gap 8 *“AI limits default to unlimited (`ai-service.js:54-58`).”* Behavior: generated cards and questions now write optional `lecture_id`/`lecture_path`, the lecture log resolves and displays generated counts, and a per-row **Generate practice** action carries the lecture identity; `historyLimit` defaults to **500**, clamps to **100-5000**, keeps the newest rows in attempts, skips and sync merges, and reports `historyPruned`; deterministic distractor checks reject empty/duplicate choices, all/none-of-the-above filler and conspicuous correct-answer length, always dropping those questions even in `mark` mode; fresh AI limits are **100 requests/day** and **20 requests/run**, while an explicit `0` remains unlimited. Evidence: `tests/lecture-links.test.js`, `tests/history.test.js`, `tests/distractor-quality.test.js` and `tests/ai-service.test.js`; full suite **1,315 pass / 0 fail**, `npm run check` clean across **230 modules**, `main.js` rebuilt. Version remains **1.168.1**; no commit, tag, release or push was made.
- **Review audit follow-up (Nov 1, 2026, unreleased):** re-audited all 373 lines of `code-review.md` against the current tree and closed three remaining behavior gaps. GLM §5 “P0 bugs — verification holes” item 3: *“Chat-created questions are never blind-verified.”* `applyByokToolProposals()` now runs `verifyDraftQuestions`, filters `verification.drop`, and passes `verification` into the generated note; `tests/ai-tools.test.js` “chat-created questions get the blind check before they are written” proves one verifier call, one written note and `verification: mismatch` in the note. GLM §2 “Bugs to note”: *“Lecture/subject/reading data lives in `data.json` with hard caps (300 lectures, 300 books, 1,000 progress entries) — overflow silently drops oldest.”* `appendCapped()` now emits a Notice naming the cap and removed count for lectures, goals, books, subjects, absences, grades, topic plans and calendar writes; a full reading-progress map refuses a new key with a Notice. `tests/review-caps.test.js` covers full lecture and book logs, and `tests/reading-plan.test.js` covers the 1,000-plan refusal. GLM §6 gap 7: *“embed windows limited to 0/7/30.”* `masteryWindowDays()` now accepts any finite 1–365 days and `parseDashboardBlock()` accepts 0–365; `tests/analytics-embed.test.js` checks 14/365 accepted and 366 rejected, and `tests/progress.test.js` checks the same boundary. GLM §7 P2 *“Surface the default-off adaptive features (adaptive session sizing, adaptiveFrequency) in onboarding/presets so the adaptivity actually runs.”* The card-oriented University, Language and Just flashcards presets now also set `cards.adaptiveFrequency = true`; `tests/welcome.test.js` asserts those three presets and the applied setting. Verification: **1,308 tests pass / 0 fail**; `npm run check` clean across **229 modules**; `main.js` rebuilt at 3,202,288 bytes; version unchanged **1.168.1**. The owner/product questions listed in the Post-review P2 close-out remain open; no code-fixable review item is left open.
- **Remaining code-fixable review close-out (Nov 1, 2026, unreleased):** re-read `code-review.md` end to end against `601799b` and closed the three remaining code-fixable findings. The literal phrase “retrieval practice” does not appear in the review; the closest finding is §5 **“Capability 4 — How to create more practice (AI generation with verification) ⚠️ priority area”**, whose “Other gaps” item 9 says: *“Context grounding is prompt-stuffing (note text embedded directly, `quiz-generator.js:136`) — fine at ≤12 notes/18k chars, but no retrieval.”* That is now local retrieval rather than a claim: `src/context-retrieval.js` strips frontmatter, splits selected notes into passages, ranks them with a local BM25-style term score, and returns the best bounded set; `collectGeneratorSources` uses it and the Quiz Generator has an optional **Focus topic** field. In a measured two-note case with `maxChars: 500`, the focused query selected **1 ATP passage, 85 chars**, and excluded the photosynthesis note (`tests/context-retrieval.test.js`, `tests/quiz-generator.test.js`). No network request or whole-vault read is added. **Interval-preview replay caching:** §4 “Bugs to note” says *“Interval previews re-run the 500-row history replay ×4 ratings per render when state is missing (`interval-preview.js:33-51`) — minor perf.”* `CardView.previewsForCurrent()` now caches one scheduler replay per card; the measured result is **1 build for 2 calls** and **2 builds after a new card** (`tests/interval-preview.test.js`). **Today repaint:** §6 Capability 5 gap 5 says *“Today rebuilds its DOM every 60s + 1s focus tick; no caching layer”*, and its P2 list says *“stop Today’s full-DOM rebuild per 60s tick.”* `TodayView.refreshLive()` now updates the header count and the existing next-class/exam text, calling `render()` only when the day or the panel shape changes; the measured result is **0 full renders and the same root element after a 60-second tick** (`tests/today.test.js`). Verification: **1,304 tests pass / 0 fail**; `npm run check` clean across **229 modules**; `main.js` rebuilt; no version bump or release. Whole-vault retrieval beyond the shipped selected-note retrieval remains a product decision, not an implementation gap.
- **Post-review P2 close-out (Nov 1, 2026, unreleased):** implemented the code-fixable findings that did not require an owner policy decision. **Exam window:** `examReviewCap` now ramps T-14 → T-7 → T-3 → T-1, skips a checkpoint that is already today, and `applyExamCap` ignores a same-day cap so a review cannot create an immediate second due item; a post-exam attempt clears the `exam_cap*` fields. `tests/exam-schedule.test.js` covers the ramp, skipped checkpoints, no-double-same-day, post-exam release, FSRS and the plugin path. **Timing depth:** `study-stats.js` adds a seconds histogram (10s/30s/60s/2min/5min edges), average/median, slow answers over 1.5× `target_seconds`, fast answers at or under 75%, and a bounded slow-row list; Study Stats renders “Answer time” and the slow-answer summary. `tests/study-stats.test.js` covers direct rows and real card/question history. **FSRS mastery:** a perfect historical accuracy is Mastered only while current FSRS recall is at least 90%; lower recall holds it at Strong. Non-FSRS notes keep their old bands, and the mastery panel states how many questions are memory-aware or held. `tests/progress.test.js` covers fresh and decayed memory. **Snapshots:** the bounded LRU `src/snapshot-cache.js` is keyed by a plugin data version; `studyStatsSnapshot`, `dashboardSnapshot` and `progressSnapshot` reuse derived aggregates, Insights consumes them, and saves, vault metadata changes and `refreshViews` invalidate every entry. `tests/snapshot-cache.test.js` covers reuse, eviction and invalidation. **Generated-question dedup:** `src/quiz-dedup.js` normalizes stems; AI-generated Quick add skips prompts already in the vault or repeated in the same batch and reports `duplicates`, while manual Quick add keeps its old behavior. `tests/quiz-dedup.test.js` covers normalization and the real generation path. Verification: **1,296 tests pass / 0 fail**; `npm run check` clean across **228 modules**; `main.js` rebuilt; no version bump or release. **Still owner-gated or product decisions, not silently decided:** (1) `fm.history` retention — should a note keep all rows, the last 500, or a time window, given history is the durable replay/sync source? (2) syllabus prose parsing — which fields should be extracted and should it write the registry or only preview? (3) AI distractor quality — should a weak distractor drop the question, retry, or warn? (4) AI cost estimate and default limits — which provider price table and default daily/run caps should apply? (5) whole-vault retrieval beyond the shipped selected-note retrieval — should AI grounding search the whole vault, and under what privacy/limits? (6) per-lecture write-back — what should “processed” mean for generated cards/questions, and should every batch link back to lecture rows? (7) sub-day FSRS scheduling — should notes store times or short-term steps, changing the note schema and sync? (8) real-Obsidian desktop/phone/light-dark visual pass. The three remaining code-fixable findings (selected-note retrieval, interval-preview replay caching and the Today 60-second repaint) are closed in the Remaining code-fixable review close-out entry above; whole-vault retrieval remains a product decision.
- **Final code-review audit (Nov 1, 2026, unreleased):** re-read all 373 lines against the current tree and re-ran the focused contracts. Three narrowed items are now closed: `studyPlanDays` (1–365, default 30) is a real setting used by `studyPlans()` and tested with a 90-day horizon; the optional after-class prompt is `lectureLog.afterClassPrompt` (off by default), renders on Today, and is idempotent; Insights Overview now carries the assignment summary; and `generateStudyTasks` fills a blank form from the merged `getExams()` list. **FSRS decision (exact review wording):** “**FSRS parameter optimization from review history** (per-deck if not global) — the last big "adaptive" gap; otherwise optimize `request_retention` per deck as a smaller step and document that weights are fixed.” We took exactly the permitted smaller step: per-deck `request_retention` fitting in `src/fsrs-fit.js`, bounded to 0.85–0.95, with a 20-review minimum and Apply/Reset in Settings → MCQ Tracker → Scheduler. The 21 FSRS weights stay fixed at the shipped defaults everywhere; no decay-weight or multi-weight trainer ships. **No P0/P1 item remains open.** The code-fixable P2 findings are closed in the Post-review P2 close-out above; the remaining items are owner-gated visual checks or product decisions listed there. Historical verification at that audit: **1,282 tests pass / 0 fail**, `npm run check` clean across **226 modules**, `main.js` current. No version bump or release.
- **FSRS per-deck retention fitting (Nov 1, 2026, unreleased):** implemented the review's exact fallback, not a substitute: `src/fsrs-fit.js` groups the review counters cards already keep by deck and fits only `request_retention` inside 0.85–0.95. A deck needs the existing 20-review minimum before a recommendation appears; a target that already matches is reported without an Apply action, and a deck with insufficient data never receives one. Apply and one-click Reset live in Settings → MCQ Tracker → Scheduler, and Reset clears the deck's target so it inherits the global value. The 21 FSRS weights are never passed, stored or trained; every deck uses the shipped defaults. No `w[20]` decay fit ships. Covered by 7 focused tests in `tests/fsrs-fit.test.js`; full suite **1,282 pass / 0 fail**, `npm run check` clean across **226 modules**, `main.js` current. No version bump or release.
- **Review audit close-out (Nov 1, 2026, unreleased):** re-read all of `code-review.md` against `a22a3a7` and closed every safe open item. Item-by-item ledger:
  - **Claude/connector review G1–G7 — all implemented.** G1 `course-identity.js` resolves registry name/code/folder/aliases for subject, course-dashboard, course-health and assignment readers, with raw-string fallback; G2 `exams.js` merges ICS/Full Calendar events, manual exam assignments and Topic-planner dates with type/topics/time/weight, a “not an exam” override and course+date de-duplication, and every reader uses it; G3 `studyPlans()` covers every exam in the configured window (default 30 days) and keeps a no-question plan with `readiness: null`, work items and evidence; G4 calendar/class-note attendance is idempotent and lectures carry `topicList`/`notePath`; G5 reading plans/books carry optional course/due with pages-behind on Today, course overview and plans; G6 the course overview combines exam, topics, lectures, readings, assignments, tasks and grades; G7 false-positive title cases, SAT/AP types, the merged health exam check and the §5.8 single-source registry text are covered. Acceptance tests are the 8 `tests/core-values.test.js` cases plus the existing study-plan and course-health suites.
  - **GLM P0 1–6 — all implemented:** Quiz Generator blind verification; quick-add allowed-root guard and journal; inline-quiz confidence `0` excluded from calibration; `applyAttempt` writes `interval`; `update_section` active-file guard; capped retry/backoff for 408/409/425/429/5xx/network.
  - **GLM P1 1–6:** FRQ knowledge is blended into Insights and course bands; numeric history `score` plus one credit model; readings on Today; dashboard consolidation now includes forward due load, memory-now, card reviews in the heatmap and practice accuracy beside the weighted gradebook (gradebook-only embeds render too); generated cards get rule-based verification, with the existing FRQ second pass and optional second-model setting. **FSRS fitting ships exactly the review's permitted smaller step:** per-deck `request_retention` fitting (0.85–0.95) from each deck's review counters, Apply/Reset in Settings → MCQ Tracker → Scheduler, and the 21 FSRS weights fixed at the shipped defaults. Full 21-weight training is not claimed.
  - **GLM P2:** due-queue daily cap; SM-2 Hard lowers ease; the FSRS same-day clamp is stated in Scheduler settings (`SAME_DAY_NOTE`); lecture rows carry `processed`/`processedOn`/`processedPath`, the compiler returns `lectureIds`, saving a compiled note marks exactly those rows, and the log shows Compiled/Not compiled; registry credits/name/folder/color flow through the shared resolver; reading progress uses a stable title key with legacy-hash fallback; dead `FolderSuggest` and `durability.enabled` are removed; SAT/university/STEM welcome presets enable adaptive session sizing; the band-count versus studyable-practice-pool difference is explained in the mastery panel. **Now shipped in the Remaining code-fixable review close-out and Post-review P2 close-out above:** selected-note retrieval, interval-preview caching, the incremental Today tick, the bounded snapshot cache, timing depth, graduated exam ramp and FSRS-aware mastery. **Still owner-gated:** the real-Obsidian visual pass. **Still product decisions:** per-lecture card/question write-back and the other questions listed above.
  - **Other named review findings:** the Remaining code-fixable review close-out and Post-review P2 close-out above are the current item ledger; they record the exact behavior, tests and owner/product questions. The earlier exact-quote list is historical.
- **Review P1/P2 follow-up (Nov 1, 2026, unreleased):** completed the actionable P1 review items and the safe P2 slice. History rows now carry an optional 0–100 `score` after `attempt_id|variant`; `applyAttempt` writes it and `last_score`, inline quiz answers pass their real score through, and one credit helper feeds stats, weekly/retention/calibration, mastery, concept mastery and the dashboard. Old binary rows and counter-only notes still work, including notes whose history has been trimmed. Saved FRQ attempts now produce `frqKnowledge` from frontmatter (attempts, average, per-course mastery bands, trend), are blended into one `knowledge` accuracy with question credit, and appear in Insights Progress/Overview; FRQ rubric weak spots stay separate. The blind verification path now checks multi-select sets, True/False keys and numeric/SPR answers as well as letters. The merged due queue has a `dailyCap` setting (0 = off) that holds overflow without rescheduling or deleting it, reports the deferred count, and only starts the capped rows. Insights now includes card reviews in the heatmap and a seven-day forward-load tile. P1 #3 (readings in Today) was already delivered by the core-values connector layer. The audit close-out below adds the practice-grade/gradebook-letter pair in Insights and dashboard embeds, memory-now in Insights, rule-based card verification and the remaining safe P2 items, with the full item-by-item ledger. The FSRS per-deck retention fitting entry above supersedes the earlier deferral. Full suite **1,282 pass / 0 fail**; `npm run check` clean across **226 modules** with `main.js` regenerated. No version bump or release.
- **Core-values connector layer (Nov 1, 2026, unreleased):** closed the G1–G7 gaps in the “What you need to learn” review. A new `src/course-identity.js` makes the calendar course registry the identity source, resolves name/code/folder/aliases, keeps old raw strings working and preserves aliases on rename. `src/exams.js` merges ICS/Full Calendar exams, exam-type assignment notes and Topic-planner exam dates, with optional topics/time/weight, “not an exam” overrides, type inference and course+date de-duplication; Add exam creates a normal assignment note, every reader uses the merged list, and the planner can seed its topics from a matching exam. Lectures gain `topicList` and `notePath`, class attendance is idempotent from the calendar event, class-note file menu and commands, and reading plans/books gain optional course/due plus pages-behind status, Today and course-overview rows. Study plans are per exam for the configured window (default 30 days), survive zero questions with `readiness: null`, and carry work items and readiness evidence for lectures, readings, planner passes and assignments. The Course overview modal combines exam, topics, lectures, readings, assignments, tasks and grades. Covered by 8 acceptance tests in `tests/core-values.test.js`; full suite **1,256** at that pass (1,271 after the audit close-out), and `npm run check` clean across **225 modules**. No version bump or release. Manual checks still owned by the owner: add a manual exam with no ICS feed and confirm review dates move before it; log attendance from desktop and phone; open a reading block with `course:` on a phone-width pane.
- **Review P0 hardening (Nov 1, 2026, unreleased):** the Quiz Generator now runs the blind answer check before returning drafts and drops mismatches when the `drop` setting is on. Quick-add writes use the same allowed-folder guard as other AI writes and journal AI-created notes for one-click undo. Inline quiz answers store confidence `0` (unrated) instead of pretending to be Confident, so calibration ignores them. `applyAttempt` now writes the scheduler interval, giving scheduler-fit real buckets; the active note is no longer exempt from `update_section` path guards; and `ai-service.withRetry` retries only 408/409/425/429/5xx/network failures, up to three capped backoff attempts, with each retry checked against and counted by the budget. Covered by the updated quiz-generator, quick-add, quiz-block, scheduler-fit, AI-service and AI-tool tests; full suite **1,256**. The later P1/P2 and audit work below closes FRQ aggregation, numeric partial-credit history, dashboard consolidation, non-MCQ card verification and load balancing; FSRS per-deck retention fitting is implemented in the later entry.
- **Qwen and local STEM diagram blocks (Nov 1, 2026, unreleased):** Direct API now offers **Qwen (DashScope)** as an OpenAI-compatible preset (`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`, default `qwen-plus`), with model discovery and a mocked `/models` + `/chat/completions` contract test. Three local fenced blocks render inside any question note: `chem` (SMILES or a simple reaction equation), `biology`/`biosequence` (DNA/RNA/protein, complement and codon translation) and `circuit` (two-terminal netlist schematic). They are renderers, not simulators, make no network request and copy no third-party code. Covered by 9 focused tests (2 Qwen + 7 STEM); full suite **1,242** and `npm run check` clean across **219 modules**. No version bump or release.

- **Mobile review layout (1.168.1, Nov 1, 2026):** the post-answer review now has a dedicated phone branch selected by `Platform.isMobile` with `Platform.isPhone !== false`, so phones get it while tablets keep the shared review split. It reuses the existing `.qt-review` content inside a Review | Passage tab pair, one `.qt-m-review-scroll`, a safe-area `.qt-m-reviewbar` (Done, Next question) and the existing More sheet (Open question note, Known, Exclude); the header carries Correct/Incorrect, context, time, flag and More. All review CSS is scoped under `.qt-mobile`; desktop and tablets receive zero `.qt-m-*` classes. Covered by 17 focused mobile tests (4 new review cases); full suite **1,228 pass** and `npm run check` is clean with `main.js` rebuilt. Released as 1.168.1.

- **Mobile question layout (1.167.0, Oct 31, 2026):** `PracticeView` now renders a separate phone screen when `Platform.isMobile` is true instead of squeezing the desktop split onto a phone. One slim bar holds the question number, unit/skill, timer with pause, flag and a More button; the stimulus becomes a Passage | Question tab pair so the question gets the full pane; the question body is its own scroller with no nested passage scrollbar; the confidence row and Submit sit in a bottom answer bar that only appears once an answer is selected, with `env(safe-area-inset-bottom)` padding and `100dvh` sizing; Skip, Don't know, Known, Bury, Suspend, Exclude, Open question note and End session moved behind the More bottom sheet, where Skip is shortened. Submit is visibly disabled until an answer and a confidence level are chosen, and the bar auto-hides on scroll. Desktop markup, labels and behaviour are unchanged. Covered by 13 focused tests in `tests/mobile-practice.test.js`. Released as 1.167.0: tag `1.167.0` points at `9ac0b9d`, and the three published assets (`main.js`, `manifest.json`, `styles.css`) match the committed build byte-for-byte.

- **Feynman AI feedback and PDF annotation index (unreleased, Oct 31, 2026):** two more independent modules. **Feynman AI feedback** asks the existing bring-your-own-key AI for a second opinion on a saved explanation, scores clarity/accuracy/simplicity 1–5 with two sentences of feedback and stores it beside — never on top of — the manual score; clearing it keeps the manual score. **PDF annotation index** is a read-only scan of the `.annotations.md` sidecars already in the vault, listing PDF, page, type, color and summary with Open PDF / Open sidecar and reporting damaged blocks instead of hiding them. No new provider, credential, network scope, PDF renderer or note write is added. Covered by 10 focused tests in `tests/study-modules-3.test.js`; full suite 1130 after merging the parallel sixth wave. No version bump or release.

- **Four more MIT-parity study modules (unreleased, Oct 31, 2026):** **Read aloud** speaks a note with the device speech voice, highlights the current sentence and offers Full note, 90-second briefing and Key points styles (Aloud TTS, LearnKit read-aloud, Voice Briefing); **Lecture note compiler** turns the local lecture log into one note with an overview, key concepts, a vocabulary table and per-lecture sections (Lecture Transcriber's non-audio part); **Course health** checks the course dashboard, topic planner and tasks for missing grades, low attendance, overdue tasks and a close exam with passes left (Course Command Center's offline part); **Audio bookmarks** stores timestamp bookmarks and chapters for an audio attachment and builds a copyable Obsidian media link (Advanced Audio Recorder's non-recording part). Each has its own Global → Modules switch and a tab in the Study Workspace. No provider, key, request, recording, Canvas login or note rewrite is added; the implementations are original and the sources are recorded in `NOTICES.md`. Covered by 10 focused tests in `tests/study-modules-2.test.js`; full suite 1105. No version bump or release.

- **Release candidate:** **1.170.0** (Nov 2, 2026): the responsive UI pass, real-Obsidian captures at 1200/390 in light and dark, 1,376 passing tests, clean `npm run check` and rebuilt `main.js`; waiting for the owner’s merge/tag decision. Notes are in `docs/release-notes/1.170.0.md`.
- **Latest release:** **1.172.0** (Nov 2, 2026): adds the sidebar **Task list** on top of the 1.171.0 Reference graph and the 1.170.0 responsive UI pass. 1,385 tests pass, `npm run check` is clean and `main.js` is rebuilt; notes are in `docs/release-notes/1.172.0.md`.
- **Previous release:** **1.169.3** (Nov 1, 2026): restores the optional OpenCode one-click installer removed in 1.169.1, including the accepted `fs`/`child_process` warning; notes are in `docs/release-notes/1.169.3.md`. Rebuilds `main.js` and publishes the three release assets; 1,329 tests pass.
- **Also in 1.168.0:** odd/even timetable parity via `X-MCQ-WEEK-PARITY: odd|even` on an ICS VEVENT, with term-week filtering, moved-override inheritance and export preservation; 3 focused tests. Also the default-off think-first chat timer, with one 15-second countdown per chat session (5–120 configurable), gated in the shared chat panel for Direct API and OpenCode; 6 focused tests. Full suite 1040.
- **Study tools modules (unreleased, Oct 31, 2026):** three independent Global → Modules switches add local workflows that do not belong in Practice, Cards, Calendar or Assignments: **Cornell notes** (a read-only `cornell-note` block with cue/note recall, summary and a note creator), **Lecture log** (per-course date/title/topics list with bulk paste and an upcoming-lecture Today card), and **Study goals** (minute progress, due dates, next-exam shortcut and a Today card). They share one Study Tools view and a responsive 2-column/1-column layout but each can be switched off independently. Covered by 7 focused tests; full suite 1047. No version bump or release.
- **Study workspace and Quizzable parity (unreleased, Oct 31, 2026):** twelve more independent Global → Modules switches, sharing one responsive Study Workspace view: **Feynman Learning** (four-step explanation cycle, local self-score and weak-dimension review), **Recall Scheduler** (heading/fragment queues with local intervals), **Topic planner** (multi-pass topics, exam dates, buffer days and day-level allocation), **Study Flow** (source excerpt, explanation and card-draft inbox with back-to-source review), **Subject Manager** (subjects, folders, absences, lecture/absence counts), **Quiz index** (cross-vault quiz/result counts, levels and types), **Courses** (weighted grade chips with lecture/absence counts), **Tasks** (manual and generated exam tasks with local reminders), **Annotations** (selection Q&A index) and **Deep Notes** (five-prompt Socratic sessions), **Retention** (read-only card due forecast) and **Vocabulary** (local dictionary with bulk import and per-word review). Inline quizzes also gain Quizzable-style `quiz-definition`/`playable-quiz` reuse and opt-in multi-select partial credit with a configurable wrong-pick `Penalty:`. All data is local; no third-party code was copied. Covered by 15 focused tests (13 workflow + 2 Quizzable); full suite 1065. No version bump or release.
- **Full plan sweep (Oct 31, 2026):** 104 checked, 10 partial/blocked, 0 unchecked; §3.9.3 W1 is complete; the owner approved the full W2/W3 parity request on Oct 31. Eighteen local study modules and the Quizzable slice were implemented unreleased at that time; the remaining W2 rows and every W3 external integration were listed as skipped below. The Nov 1 audit supersedes that list with exact §11 gates. The §11 decision queue remains the record for external gates and unresolved contracts. No version bump or release.
- **MIT research gate (Oct 30, 2026):** §3.9.3 consolidates the remaining MIT study-plugin gaps (46 actionable rows), 13 covered/no-gap rows, and 8 adjacent tools. Owner approved the first Wave 1 slices: static answer-key mode and L1–L4 cognitive labels for inline quizzes, implemented unreleased on Oct 30, 2026. The Omni Quiz row is now partial because its cross-vault dashboard ships while first-attempt accuracy, topic and wrong-answer indexes remain. The matrix's Quiz Blocks row incorrectly listed per-option feedback as missing; it already shipped. Its remaining gated-note behavior shipped unreleased on Oct 31, 2026. Owner decisions recorded: research matrix first; ask before an underspecified §11 item; MIT code only with notices; releases at milestones; automated tests with real-device/audio/PDF/OCR checks marked blocked. The QuizPort inline player followed as the next Wave 1 slice (unreleased). At that date, further rows remained behind the owner's wave decision; the Nov 1 audit replaces that with exact §11 gates.
- **Released in 1.165.0 (Oct 31, 2026):** inline quiz `Mode: static` answer-key rendering (correct choices, per-option and overall feedback, no inputs, no attempt or scheduler writes, gated ignored); optional inline quiz `Level: L1`–`L4` cognitive labels, with a block default and per-question override, no scheduler writes and invalid values ignored; optional assignment time estimates (`estimate` frontmatter plus `⏱️` Tasks lines) with today/tomorrow/next-7-days workload in Assignments and Today, and a Markdown-table source in the card importer. Read-only Full Calendar note interop reads single, all-day, multi-day, weekly and rrule event notes from a chosen folder. A gated `mcq-quiz` note now hides its remaining Reading-view content until every supported question is answered, malformed or unsupported gates stay visible, and embedded notes are never hidden. The shared view width is 960 px on laptops and 1040 px above 1000 px, and the Quizlet PDF importer accepts mixed tabbed/plain rows and tab-separated answer keys. Version **1.165.0** was released in `manifest.json`, `package.json` and `versions.json`; the deterministic FlashCard extraction followed in **1.166.0**.
- **QuizPort inline player (Oct 30, 2026):** a `quizport` block plays QuizPort JSON (inline or a `file:` path) with hint-before, explanation-after, single- and multi-select grading, optional `shuffle: true` and a missed-only retry. It is local and read-only: no network request and no attempt, history, streak or scheduler write. Covered by 8 focused tests; full suite 958.
- **Today widget dashboard — released in 1.165.0 (Oct 30, 2026):** Today now fills the whole view pane instead of stopping at 1320px. It keeps the 12-column grid and measures the Today pane itself: container-query breakpoints give four widget columns at 1400px and wider, three at 1050-1399px, two at 700-1049px and one below 700px. Window media rules are now guarded with `@supports not (container-type: inline-size)` and stay only as a fallback for Obsidian versions without container-query support. Panels share row height, cards stretch to fill their panel, and the primary Start row is a card. No max-width or auto-centering rule constrains the view root or the Today pane, and no data, scheduler, attempt or command behavior changed. A mounted-DOM test now asserts the root classes, container context, grid ancestry and simulated 4/3/2/1 columns. Manifest, package and versions are 1.165.0; no tag or GitHub release was created.
- **Public copy refresh (Oct 30, 2026):** the README now leads with the full workspace scope and an **At a glance** section; `manifest.json` and `package.json` descriptions were rewritten to avoid claiming PDF/Office conversion without AI and to avoid calling cloud AI local-first. The refresh landed in commit `9adca4b`; this follow-up tightens optional/default qualifiers and records the audit. No version bump or release. The Obsidian community dashboard remains external and the directory entry is still absent (see the incident note below); this does not claim that the public listing changed.
- **Previous release:** **1.165.0** (the Oct 30–31 feature batch), commit `7fcfb8d`, tagged and published Oct 31, 2026 in [run 41156430290](https://github.com/ifriedenson/mcq-tracker/actions/runs/41156430290); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.165.0). The released `main.js`, `manifest.json` and `styles.css` match the committed build (`main.js` SHA-256 `d6cb7f7db0a3dc1e5404a73fe9b83bd8d2b7626bd54a425c62938791a5faada8`, `manifest.json` `09fec66f1f9e139e5e4db2c90a5431f382333c792984f8a95062f95b519cfe1b`, `styles.css` `15aa1c42a445452c225ecbfed39f360bc164ab3b0f32892c0bf1b896c2f3165e`). The previous release was **1.164.0** (automated-review hardening), commit `4403d55`, [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.164.0).
- **Previous release:** **1.162.0** (term calendar weeks and reproducible lockfile), commit `4b41617`, tagged and published Oct 30, 2026 in [run 41120311757](https://github.com/ifriedenson/mcq-tracker/actions/runs/41120311757); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.162.0). The released `main.js` matches the committed build (SHA-256 `e4ce220508e0f89bd13f729a84b59f152c43876963aa3c42000ccd1ec4571102`); `manifest.json` and `styles.css` also match.
- **Previous release:** **1.161.0** (shared-option quiz questions), commit `54ca44d`, tagged and published Oct 30, 2026 in [run 41116667013](https://github.com/ifriedenson/mcq-tracker/actions/runs/41116667013); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.161.0). The released `main.js` matches the committed build (SHA-256 `d361fe4b4ce2c6c6abb9343bc981fad9a43c8c66f13dc95032aad8ea212babe4`).
- **Previous release:** **1.160.0** (inline numeric questions), commit `3cd9370`, tagged and published Oct 30, 2026 in [run 41115920727](https://github.com/ifriedenson/mcq-tracker/actions/runs/41115920727); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.160.0). The released `main.js` matches the committed build (SHA-256 `c4e09db1a0ad4b314177735051a0c6295ed1504f40f1e5a3bd407b40ff6d5df3`).
- **Previous release:** **1.159.0** (inline reorder questions), commit `64c7be7`, tagged and published Oct 30, 2026 in [run 41115235219](https://github.com/ifriedenson/mcq-tracker/actions/runs/41115235219); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.159.0). The released `main.js` matches the committed build (SHA-256 `458b6f765667cb94095edadc2f6a886be3d8ae926876901fcc745c8f4146babf`).
- **Previous release:** **1.158.0** (inline quiz result export), commit `5c6091a`, tagged and published Oct 30, 2026 in [run 41114287076](https://github.com/ifriedenson/mcq-tracker/actions/runs/41114287076); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.158.0). The released `main.js` matches the committed build (SHA-256 `c5f46571ae928b81137193b8c30d1fb9dfa19427f5dcc2e269c202c53f7a4388`).
- **Previous release:** **1.157.0** (optional exam-ready badge), commit `5c00279`, tagged and published Oct 30, 2026 in [run 41113381118](https://github.com/ifriedenson/mcq-tracker/actions/runs/41113381118); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.157.0). The released `main.js` matches the committed build (SHA-256 `bae56af02db11b65678cf9f356adc688ee4da7384c36ec7bc66912c16dc0c98c`).
- **Previous release:** **1.156.0** (optional per-question hints), commit `0d2fb32`, tagged and published Oct 30, 2026 in [run 41111787496](https://github.com/ifriedenson/mcq-tracker/actions/runs/41111787496); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.156.0). The released `main.js` matches the committed build (SHA-256 `47c70f71f27ebcf90c9dc2670beebc54ef802a43d51e94458fdd76618bd84122`). The previous release was **1.155.0** (closed-book practice), commit `8285695`, [run 41110478009](https://github.com/ifriedenson/mcq-tracker/actions/runs/41110478009).
- **Previous release:** **1.155.0** (optional closed-book practice), commit `8285695`, tagged and published Oct 30, 2026 in [run 41110478009](https://github.com/ifriedenson/mcq-tracker/actions/runs/41110478009); [release](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.155.0). The released `main.js` matches the committed build (SHA-256 `d9c1aa2d6913c9cd7f3cfee9d8f367bccaba694c98014b7cac7a11e467f49438`).
- **Repository:** `ifriedenson/mcq-tracker`, branch `main`. The latest code release is **1.166.0**, commit `669df22`, tagged and published Oct 31, 2026 at [1.166.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.166.0) in [run 41163769097](https://github.com/ifriedenson/mcq-tracker/actions/runs/41163769097); the previous code release was **1.165.0** (the Oct 30–31 feature batch, commit `7fcfb8d`; tagged and published Oct 31, 2026 at [1.165.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.165.0) in [run 41156430290](https://github.com/ifriedenson/mcq-tracker/actions/runs/41156430290)). The previous release was **1.153.0** (answer-free practice sheet, commit `e209379`; [1.153.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.153.0) in [run 41106512617](https://github.com/ifriedenson/mcq-tracker/actions/runs/41106512617)). The prior release was **1.152.0** (needs-fixing flag, commit `e00bfdc`; tagged and published Oct 30, 2026 at [1.152.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.152.0) in [run 41102353080](https://github.com/ifriedenson/mcq-tracker/actions/runs/41102353080)). The prior release was **1.151.0** (daily-quiz streak freeze, commit `77925fa`; tagged and published Oct 30, 2026 at [1.151.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.151.0) in [run 41099301683](https://github.com/ifriedenson/mcq-tracker/actions/runs/41099301683)). The prior release was **1.150.0** (optional card reveal animation, commit `28da9f6`; tagged and published Oct 30, 2026 at [1.150.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.150.0) in [run 41097232057](https://github.com/ifriedenson/mcq-tracker/actions/runs/41097232057)). The prior release was **1.149.0** (Anki folder exclusions, commit `79689fd`; tagged and published Oct 30, 2026 at [1.149.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.149.0) in [run 41095440297](https://github.com/ifriedenson/mcq-tracker/actions/runs/41095440297)). The prior release was **1.148.0** (Spaced Repetition quiz notes, commit `c661ee7`; tagged and published Oct 30, 2026 at [1.148.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.148.0) in [run 41094115096](https://github.com/ifriedenson/mcq-tracker/actions/runs/41094115096)). The prior release was **1.147.0** (Text2Anki, commit `339c5a1`; [1.147.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.147.0) in [run 41092118644](https://github.com/ifriedenson/mcq-tracker/actions/runs/41092118644)). The prior release was **1.146.0** (Auto Anki, commit `35f1df6`; [1.146.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.146.0) in [run 41089689474](https://github.com/ifriedenson/mcq-tracker/actions/runs/41089689474)). The prior release was **1.145.0** (Spaced Everything, commit `95e912d`; [1.145.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.145.0) in [run 41087409754](https://github.com/ifriedenson/mcq-tracker/actions/runs/41087409754)). The prior release was **1.144.0** (Simple Note Quiz, commit `6032271`; [1.144.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.144.0) in [run 41085153063](https://github.com/ifriedenson/mcq-tracker/actions/runs/41085153063)). The prior releases were **1.143.0** (Simple Quiz blocks, commit `14dceda`, [run 41082745304](https://github.com/ifriedenson/mcq-tracker/actions/runs/41082745304)) and **1.142.0** (commit `bada462`, [run 41076430504](https://github.com/ifriedenson/mcq-tracker/actions/runs/41076430504)). The documentation audit is `215f788`, and the earlier handoff snapshot plus `AGENTS.md` were added in `bd848d9`. The 1.118.0 progress dashboard and its implementation handoff (`docs/progress-dashboard-handoff.md`) are on `main` and in the 1.118.0 release. The 1.127.0 release packages the 1.119.0 saved mastery scope, the 1.120.0 all-time / last-30-days window, the 1.121.0 7-day option, the 1.122.0 embed scope/window, the 1.123.0 embed band practice and inline `masteryDays` override, the 1.124.0 Today card, the 1.125.0 Quick Practice band/window label, the 1.126.0 Today controls and the 1.127.0 mastered-count trend in Today, Progress and the embed.
- **Owner direction (Oct 30, 2026):** freeze the verified state, save it in this plan, push it to GitHub, and make the repository ready for a new chat. A later request that day authorized the Progress dashboard and scoped mastery work and asked for all of it to be pushed into the plan/agent documentation; that work shipped as **1.118.0**. The authoring item was ranked later that day and shipped in 1.128.0.
- **What is shipped:** The `quizjs` dynamic-execution path is removed: legacy blocks show a migration notice and never run note code; the CSS scanner’s flagged `text-decoration-thickness` declaration is gone (1.164.0); The error-log review sheet compiles every due question into a printable Markdown sheet, keeps the last recorded mistake beside each prompt, omits the correct key and leaves review state untouched (1.163.0); Semester dates, term-week numbers and reading weeks, with reading-week classes struck through, skipped by next-class actions and omitted from `.ics` export (1.162.0); Exam coverage from a course's optional declared topic count, with mastered-skill coverage in the next-exam plan and no scheduling change (1.154.0); An answer-free practice-sheet export that writes the current filtered questions as printable prompts with no answer key, rationale, private notes or frontmatter, uses numbered filenames instead of overwriting and leaves all review state untouched (1.153.0); An optional needs-fixing flag that marks a question after misses on five distinct days and clears it through Mark fixed without deleting attempts or history (1.152.0); An optional daily-quiz streak freeze that earns up to three freezes, preserves a streak across a missed day and resets when the gap is uncovered (1.151.0); An optional card reveal animation (Instant by default, Fade in or Flip) that decorates the existing card answer once per reveal, falls back to instant under reduced motion or without CSS transition support and never changes scheduling (1.150.0); Anki folder exclusions that keep configured vault folders and their subfolders out of Anki previews and pushes while preserving the existing one-way sync and card store (1.149.0); Spaced Repetition quiz notes that generate from the active note, preview the cards, save a `#flashcards` note in multiline `?` syntax, verify it through the existing importer and import the cards into the normal card store (1.148.0); Text2Anki one-shot selection-to-Anki with custom instructions and Deck: directives (1.147.0); Auto Anki with AI card generation, duplicate-free source batches and exact-path AnkiConnect delivery (1.146.0); Spaced Everything whole-note SM-2 review with Fruitful/Unfruitful/Ignore ratings, due queues, `se-*` frontmatter and template-based thought capture (1.145.0); Simple Note Quiz that turns the active note into a self-marked quiz (1.144.0); guided card/deck creation with a live preview and optional CouchDB review-state sync (1.142.0); source-anchored recalls that store the selected passage and reopen it highlighted in the source note (1.141.0); Quizzator-style slider and free-text inline quiz questions, per-question weights and pass/imprecise/fail bands (1.140.0); per-note scheduler overrides and opt-in file-explorer due/new markers (1.139.0); per-deck SM-2/FSRS scheduling with per-deck timing (1.138.0); the six-course AP FRQ pilot with self/AI grading, rubric categories, review scheduling and multi-photo answers; the course registry; unit-circle/trig/codon/Punnett sheets; Learn/Test/Match study modes; Quizlet PDF import with a device picker; Mochi `.mochi`, LearnKit and Anki `.apkg` export; the in-plugin feedback survey; timed-test answer-choice shuffling and pass marks; the Progress tab with scoped mastery bands (1.118.0); plain-text **Quick add questions** authoring (1.128.0), vault-wide Anki push with video, tables, extra tags and source backlinks (1.134.0), and plain Markdown cards with folder-tree decks (1.135.0), AnkiSync+ parity with regex omission, Excalidraw SVG embeds, exclusion filters and opt-in stale-link cleanup (1.136.0), and Obsidian content authority with exact Anki source links (1.137.0). Earlier releases added the calendar, assignments/GPA, reference tools, PDF annotations, AI tutor, cards module, imports and analytics.
- **Reproducible installs:** `package-lock.json` is committed with lockfile version 3, and `.github/workflows/release.yml` runs `npm ci --ignore-scripts --no-audit --no-fund` before the suite. The project has no runtime dependencies, so the lockfile pins the root package metadata and prevents future dependency drift.
- **Verification now:** `npm test` passes all **1,245 tests** (including 5 focused keyboard tests, 2 focused Qwen tests, 7 focused STEM tests, 17 focused mobile practice tests, 6 focused think-first tests, 8 focused simple-quiz tests, 8 focused practice-sheet tests, 6 focused study-plan tests, 6 focused term-calendar tests, 8 focused QuizPort tests, 12 focused Today tests, 2 focused gated-note tests, 2 focused Quizlet PDF repair tests and 3 focused Full Calendar interop tests), and `npm run check` reports `main.js` is up to date. The README/manifest/package copy audit checks the public claims against the registered code-block processors, optional settings and shipped commands; 1.168.1 was released. The term-calendar work adds optional semester dates, week numbering, reading-week labels/strike-through, next-class skipping, `.ics` omission of reading-week classes, corrupt-value normalization and restart persistence. `main.js` is generated from `src/`; rebuild with `npm run build` after source edits.
- **No blocked implementation partial remains in this environment.** The open gates are:
  - Real Obsidian window: visual/math audit and screenshots.
  - Real iOS/Android hardware: mobile audit.
  - Provider plus mobile audio: TTS and pronunciation validation.
  - Audited MIT PDF library: AcroForm form filling.
  - OCR engine and licence decision: bundled OCR (and the OCR-dependent AI summary/paper-scanner slices).
  - Human-scored fixtures and go/no-go thresholds: AP FRQ calibration and any accuracy claim.
  - Live CouchDB verification: a real server/database, credentials and a two-device conflict test. The client and merge are covered with mocked requests; see the live CouchDB gate in §11 E8.
- **Added after 1.117.0:** 1.118.0 added the Progress dashboard across `src/`, `styles.css`, tests and the release assets; the 1.119.0 work makes its mastery scope persistent, 1.120.0/1.121.0 add all-time, 7-day and 30-day windows that read dated history, and 1.122.0 adds the mastery section to the mcq-dashboard embed, 1.123.0 adds its band Practice buttons and per-block `masteryDays` window, 1.124.0 adds the same card to Today, 1.125.0 names the band/window in Quick Practice, 1.126.0 adds inline scope/window controls to Today, and 1.127.0 adds its mastered-count trend across Today, Progress and the embed (`src/constants.js`, `src/insights-view.js`, `src/today-view.js`, `src/progress.js`, `src/analytics-embed.js`, `src/plugin.js`, `src/quick-practice.js`, `src/practice-view.js`, the progress/view/embed/today tests, `manifest.json`, `versions.json` and `main.js`), all shipped in 1.127.0. The owner ranked **lighter multi-question authoring** on Oct 30, 2026; **Quick add questions** (§5.22.10, `src/quick-add.js`, `src/quick-add-modal.js`, `src/plugin.js`) shipped in **1.128.0** with its tests.
- **Release automation (Nov 1, 2026):** `.github/workflows/release.yml` now publishes from a push to `main` instead of requiring a manual tag push. It reads the version from `manifest.json`, checks out the commit that last changed the manifest, runs the suite, creates the annotated tag at that commit and creates the GitHub release with the curated notes in `docs/release-notes/<version>.md`. The job is idempotent: an existing release is retitled, re-noted, given any missing asset and published if it is still a draft; a complete release exits without creating a duplicate. A concurrency group serializes runs, and ordinary pushes with an already-published version do nothing.
- **Release procedure:** **1.166.0** was tagged from `669df22`; [run 41163769097](https://github.com/ifriedenson/mcq-tracker/actions/runs/41163769097) published exactly three assets and all three matched the committed build (`main.js` SHA-256 `89f9a0cdd664c78f906312c5dc58609092b298e4d0a5e0dd40a295e25ecc92d9`, `manifest.json` `6147f3a3b7058e6722c2f69da9afbcd39834d8df509f39ac51eb2fcd94ed0fbe`, `styles.css` `15aa1c42a445452c225ecbfed39f360bc164ab3b0f32892c0bf1b896c2f3165e`). **1.165.0** was tagged from `7fcfb8d`; [run 41156430290](https://github.com/ifriedenson/mcq-tracker/actions/runs/41156430290) published exactly three assets and all three matched the committed build (`main.js` SHA-256 `d6cb7f7db0a3dc1e5404a73fe9b83bd8d2b7626bd54a425c62938791a5faada8`, `manifest.json` `09fec66f1f9e139e5e4db2c90a5431f382333c792984f8a95062f95b519cfe1b`, `styles.css` `15aa1c42a445452c225ecbfed39f360bc164ab3b0f32892c0bf1b896c2f3165e`). **1.164.0** was tagged from `4403d55`; [run 41124294109](https://github.com/ifriedenson/mcq-tracker/actions/runs/41124294109) published exactly three assets and all three matched the committed build (`main.js` SHA-256 `2664f4ad8b3437e7f0583b8765802038d41922ad6cf1c2e2b38260e2f1ff52a0`, `manifest.json` `75cfd71634c620bc4880c391321e0511576e1cf55218218536b13d10ebe57fc7`, `styles.css` `04aec4a039026f132306c99c24800a492855faacc13c89f1814873fa7d8a81a7`). Its release body describes the removed quizjs executor, the migration notice, the unchanged features, the documented disclosures and the 931-test verification. **1.163.0** was tagged from `23c8fa8`; [run 41122508769](https://github.com/ifriedenson/mcq-tracker/actions/runs/41122508769) published exactly three assets and all three matched the committed build. Its release body describes the due review sheet, the mistake context, the unchanged review state and the 930-test verification. To publish a later release, update this plan first; bump `manifest.json` and `versions.json`; rebuild `main.js`; run `npm test` and `npm run check`; commit and push to `main`; create a tag equal to the manifest version and push it. **1.154.0 was tagged and released on Oct 30, 2026** from commit `6a494e4`; [run 41108811750](https://github.com/ifriedenson/mcq-tracker/actions/runs/41108811750) published `main.js`, `manifest.json` and `styles.css`; the downloaded `main.js` matched the committed build (SHA-256 `e1dc706a`). **1.153.0 was tagged and released on Oct 30, 2026** from commit `e209379`; [run 41106512617](https://github.com/ifriedenson/mcq-tracker/actions/runs/41106512617) published `main.js`, `manifest.json` and `styles.css` with build attestations. Its release note describes the answer-free sheet, the 5 focused tests and the 882-test verification; the downloaded `main.js` matched the committed build (SHA-256 `de9d4337`). **1.152.0 was tagged and released on Oct 30, 2026** from commit `e00bfdc`; [run 41102353080](https://github.com/ifriedenson/mcq-tracker/actions/runs/41102353080) published `main.js`, `manifest.json` and `styles.css` with build attestations. Its release note describes the needs-fixing flag, the non-destructive Mark fixed action, the restart/corrupt-state tests and the 877-test verification. **1.151.0 was tagged and released on Oct 30, 2026** from commit `77925fa`; [run 41099301683](https://github.com/ifriedenson/mcq-tracker/actions/runs/41099301683) published `main.js`, `manifest.json` and `styles.css` with build attestations. Its release note describes the freeze ledger, the row 28 verification and the 869-test verification. **1.150.0 was tagged and released on Oct 30, 2026** from commit `28da9f6`; [run 41097232057](https://github.com/ifriedenson/mcq-tracker/actions/runs/41097232057) published `main.js`, `manifest.json` and `styles.css` with build attestations. Its release note describes the opt-in fade/flip reveal, the one-shot and fallback behaviour and the 863-test verification. **1.149.0 was tagged and released on Oct 30, 2026** from commit `79689fd`; [run 41095440297](https://github.com/ifriedenson/mcq-tracker/actions/runs/41095440297) published `main.js`, `manifest.json` and `styles.css` with build attestations. Its release note describes the folder filter, its boundary-safe matching and the 856-test verification. **1.148.0 was tagged and released on Oct 30, 2026** from commit `c661ee7`; [run 41094115096](https://github.com/ifriedenson/mcq-tracker/actions/runs/41094115096) published `main.js`, `manifest.json` and `styles.css` with build attestations. Its release note describes the new output, the round-trip validation, the tracked-card import and the 854-test verification. **1.147.0 was tagged and released on Oct 30, 2026** from commit `339c5a1`; [run 41092118644](https://github.com/ifriedenson/mcq-tracker/actions/runs/41092118644) published `main.js`, `manifest.json` and `styles.css` with build attestations. Its release note describes Text2Anki, the shared Auto Anki batch and the three assets. **1.146.0 was tagged and released on Oct 30, 2026** from commit `35f1df6`; [run 41089689474](https://github.com/ifriedenson/mcq-tracker/actions/runs/41089689474) published `main.js`, `manifest.json` and `styles.css` with build attestations. Its release note describes Auto Anki, duplicate-free reruns and exact-path Anki delivery. **1.145.0** was tagged from `95e912d` in [run 41087409754](https://github.com/ifriedenson/mcq-tracker/actions/runs/41087409754) with the Spaced Everything notes. **1.144.0** was tagged from `6032271` in [run 41085153063](https://github.com/ifriedenson/mcq-tracker/actions/runs/41085153063) with its Simple Note Quiz notes. Repeat the same steps for the next version. `.github/workflows/release.yml` runs the tests and publishes `main.js`, `manifest.json` and `styles.css` with build attestations.
- **New-chat continuation:** close this chat; open the same GitHub-connected project on branch `main`; confirm HEAD includes the 1.164.0 release commit or later and the working tree is clean; then send: “Read `AGENTS.md`, the Handoff snapshot in `plan.md` and `docs/progress-dashboard-handoff.md`; continue from the verified 1.164.0 state.” Do not start from a sibling chat's uncommitted worktree.
- **Directory listing:** the plugin is still absent from Obsidian’s official community index, so it cannot appear in the in-app browse/search. The 03:20 UTC mirror on Oct 31 (`40a9a297`) still has 9,714 entries and no `mcq-tracker`, so the 1.166.0 release has not restored search visibility yet. The 1.166.0 release itself is valid and is the new reviewable version; whether the directory entry returns still depends on the external dashboard/review. See the incident note below.

### Community directory listing incident (Oct 30, 2026)

- **Symptom:** `Add to Obsidian` from the public listing and searching in Obsidian on Windows 11 do not install the plugin. This is not a local cache delay or a version typo.
- **Release state:** `1.117.0` is GitHub’s latest release, is neither draft nor prerelease, and has uploaded `main.js`, `manifest.json` and `styles.css`. `manifest.json` and `versions.json` agree on `1.117.0` and minimum app `1.8.7`.
- **Directory state:** `mcq-tracker` was present in `obsidianmd/obsidian-releases` `community-plugins.json` at 21:21 UTC on Oct 29 and absent at 22:21 UTC. Commit `cd097f5c6` removed the entry, before the 1.117.0 release at 01:03 UTC on Oct 30. The public page at `community.obsidian.md/plugins/mcq-tracker` still exists and still renders an `Add to Obsidian` link, but the app reads the index file; a removed entry cannot be found in the app.
- **Why:** Obsidian’s current automated review scans every release and removes a version from search within 24 hours if it fails. The exact failure text is only in the developer dashboard; the public page does not expose it. The earlier reported review with two scan issues is consistent with this removal, but do not guess the cause from the public page.
- **Recovery:** sign in at `community.obsidian.md`, connect the GitHub account if needed, claim/open MCQ Tracker in the developer dashboard, read the exact review errors, fix them in the repository, publish the listing, and wait for the scan. A new version is only needed if the dashboard’s errors require code changes; do not bump the version merely to retry.
- **Highest-risk area to inspect:** the optional desktop OpenCode backend downloads a separate binary, verifies its SHA-256, unpacks it into `~/.question-tracker/opencode` outside the vault, and runs it. That is the first place to compare against the dashboard’s current policy findings, alongside vault access and network disclosures. Do not claim 1.117.0 resolves review errors until the dashboard says so.
- **Interim install:** BRAT with `ifriedenson/mcq-tracker`, or copy the three release assets into `.obsidian/plugins/mcq-tracker/` and enable it. The GitHub release is usable even while the directory entry is absent.

---

## Current focus (Oct 30, 2026)

- [x] **Every Study Workspace tab proved by a mount test (Nov 3, 2026, released 1.210.13):** the audit's completeness claim now rests on tests rather than reading. `tests/study-workspace-tabs.test.js` mounts Feynman, Recall, Topic planner, Courses, Annotations, Deep Notes and Quiz index through the view's own dispatch against a fake vault, and for each tab fills the real form, presses the real control, asserts the persisted settings, reads the saved row, opens it, deletes it and checks the documented empty state. Writing them found the audit's third gap: the planner's **Use exam topics** set `this.message` without re-rendering, so a click with no matching exam showed nothing; it now raises the view's existing `Notice` and announces the loaded count, and the refusal still does not rebuild the half-typed form. `docs/study-workspace-audit.md` now names, for all 21 tools, the backing test and the release that introduced it, and no gap is listed as open. `tests/helpers/fake.js` gained the `openLinkText` the real workspace API has. No setting, dependency, provider or note write was added and §5.22.12 stays untouched. Notes are in `docs/release-notes/1.210.13.md`.

- [x] **Course health rows made actionable (Nov 3, 2026, released 1.210.12):** the same workspace audit that found the fit stub found **Course health** rendered rows with no action at all, so a warning such as a missing grade or overdue task could not be followed. Each row now states how many warnings are left and offers **Overview**, which calls the existing `plugin.openCourseOverview` used by the Courses tab. No check, grade or note is changed and no new modal, query or dependency was added. Covered by `tests/study-workspace-health.test.js`; notes are in `docs/release-notes/1.210.12.md`.

- [x] **Per-deck retention fit surfaced in the Retention tab (Nov 3, 2026, released 1.210.11):** the workspace audit found this card was a stub — it rendered a hint and a settings link while `plugin.fsrsRetentionReports()`, `applyFsrsRetention`, `resetFsrsRetention` and `describeFsrsRetentionFit` already existed. The card now lists every deck with its review count, card count, current target and the observation behind the suggestion (or how many reviews it still needs), with **Apply \<value\>** only for an accepted fit and **Reset** only for a custom target. The card now appears as soon as a deck or card exists, without waiting for **Scan cards**, because the fit reads the review counters directly rather than the forecast; with no cards at all it stays hidden, so a first run shows no empty fit card. Covered by a new case in `tests/fsrs-fit.test.js`; notes are in `docs/release-notes/1.210.11.md`. Weights stay fixed and no other deck or scheduler setting changes.

- [x] **Writing-session count and a glossary over both stores (Nov 3, 2026, released 1.210.10):** the last two candidates the §5.24 audit classed as safe. `src/writing-sessions.js` is pure: `countText` returns words, characters, sentences and paragraphs; `readingMinutes` uses 200 words per minute with a one-minute floor; `normalizeWritingSession` bounds the stored slice; `startWritingSession` records the path and baseline and refuses an empty note or a second start; `finishWritingSession` records the added words as one session row capped at 200; `cancelWritingSession` drops only the running session; `sessionReport`/`sessionLine`/`writingSummary` feed the view. `plugin.writingSessionState`, `activeNotePath`, `activeNoteText`, `writingSessionReport`, `startWritingSession`, `finishWritingSession` and `cancelWritingSession` read the active editor or its `cachedRead` file and write only `settings.writingSession`. The Study Flow tab adds a **Writing session (read-only)** disclosure with **Count words**, **Start session**, **Finish session** and **Cancel**. `src/glossary.js`'s `collectGlossary(entries, options, extra)` now merges the saved vocabulary words and notes them as `source: "vocabulary"`; lecture notes already write `| Term | Definition | Lecture |` tables, which the same read-only parser reads, and a note definition wins a duplicate. The Vocabulary tab shows the vocabulary count and `Vocabulary list` instead of a note link for those rows. Covered by `tests/writing-sessions.test.js` and `tests/glossary.test.js`; notes are in `docs/release-notes/1.210.10.md`. No dependency, provider, note write or background index was added.

- [x] **Local task-tag rename and vault glossary (Nov 3, 2026, released 1.210.9):** two §5.24 candidates that the plan already called safe. `src/task-tags.js` is pure: `tagUsage` counts the tags the local tasks use, `planTagRename` renames one tag case-insensitively without mutating its input, merges into a tag the task already had, keeps the four-tag cap and refuses an empty, identical or unused tag with a reason. `plugin.renameStudyTaskTag` writes only `settings.studyTasks`, and the Study Workspace Tasks tab adds a **Rename a task tag** card plus an optional tags field on the add form. `src/glossary.js` is pure and read-only: `glossaryLines` reads `Term: definition` lines and two-column table rows, skipping frontmatter, fenced code, headings, checkboxes, a table's own header and URL-shaped pairs; `collectGlossary` dedupes by term, filters by folder and bounds files, entries and limit; `lookupGlossary` ranks exact, prefix, term and definition matches. `plugin.scanGlossary()` reads with `cachedRead` and writes nothing, and the Vocabulary tab's **Glossary from your notes (read-only)** disclosure searches it and links each row to its note and line. Covered by `tests/task-tags.test.js` and `tests/glossary.test.js`; notes are in `docs/release-notes/1.210.9.md`. No dependency, provider or note write was added.

- [x] **Kairos planner inside the university calendar (Nov 3, 2026, released 1.210.8):** the calendar's day section gains a **Study plan** card when Time blocks is on. `src/calendar-planner.js` is pure — `dayPlan` merges classes and blocks, finds the free slots in an 08:00–22:00 window, flags overlaps and summarises planned/class/free minutes; `slotDraft` and `afterClassDraft` build block drafts. `plugin.calendarPlannerDay`, `planBlockFromCalendarSlot` and `planBlockAfterClass` reuse `addTimeBlock`, so there is no second store. The card lists blocks with **Remove**, free-slot chips and per-class review chips, and links to Time blocks. Calendar events and notes stay read-only. Covered by `tests/calendar-planner.test.js`; notes are in `docs/release-notes/1.210.8.md`. This is the integration the owner asked for in §5.22.12's calendar-compatibility record.

- [x] **Local voice memos (Nov 3, 2026, released 1.210.7):** the **Read aloud** tab gains a **Voice memo** card that records with the device microphone and, on stop, saves the audio and appends one daily-note line. `src/voice-memo.js` is pure: `memoPath`/`memoStamp`/`memoExtension` name the file from the local time and MIME type (`m4a`, `webm`, `ogg`, `wav`, `mp3`), `memoEntry` builds `- HH:MM ![[path]] · duration · label` and `appendMemoEntry` keeps one trailing newline; unsafe folders and unusable dates return `""`. `plugin.saveVoiceMemo` refuses empty audio, never overwrites an existing recording (a numeric suffix is added), writes through `vault.createBinary`, and appends to `<daily-note folder>/YYYY-MM-DD.md`, creating that note only when it is missing. **Memo label**, **Voice memo folder** and **Voice memo daily-note folder** are in the tab and in Settings, Modules, Read aloud; the audio goes nowhere else. No transcription, provider, dependency, relay or second runtime. Covered by `tests/voice-memo.test.js`; notes are in `docs/release-notes/1.210.7.md`. This is the audio-first half of the Quick Voice Note row in §5.25.

- [x] **Read-aloud speech options (Nov 3, 2026, released 1.210.6):** the local **Read aloud** module gains the three content toggles from obsidian-voice. `normalizeReadAloudSettings` adds `codeBlocks` (`skip`|`read`), `skipUrls` and `spellAcronyms`, all defaulting to the previous output. `stripForSpeech(text, options)` keeps fenced code when asked, drops bare `http(s)`/`www` addresses while keeping link labels, and spells `NASA` as `N A S A`; `splitSentences`, `estimateSpeechSeconds` and `buildReadAloudPlan` thread the options through, so the plan text, sentence list and the estimate follow. The Read aloud tab and the Settings, Modules page expose the same three options. Provider voices, MP3 export and a recorder stay out. Covered by `tests/read-aloud.test.js`; notes are in `docs/release-notes/1.210.6.md`.

- [x] **Read-only vault checklist index (Nov 3, 2026, released 1.210.5):** the existing **Tasks** tab gains a **Vault checklist (read-only)** disclosure. `src/vault-task-index.js` is pure: `checkboxLines` matches `-`/`*`/`+` and numbered checkbox lines, skips fenced code, strips an empty label and collects `#tag` values from the line; `collectVaultTasks` caps the scan at 500 notes and 1,000 lines, ignores non-Markdown paths, filters by folder and open-only, and reports open/done/file counts plus a `truncated` flag; `filterVaultTasks` matches text, tag or path. `plugin.scanVaultTasks()` reads with `cachedRead` and never writes, and each row only offers **Open note**. No query language, no task rewrite and no other plugin's syntax. Covered by `tests/vault-task-index.test.js`; notes are in `docs/release-notes/1.210.5.md`. This closes the read-only half of the Tasks row in §5.24.

- [x] **PDF page deep links (Nov 3, 2026, released 1.210.4):** the read-only **PDF annotations** index now builds a `[[file.pdf#page=N]]` wikilink per row. `pdfPageSubpath`/`pdfPageLink` in `src/pdf-annotation-index.js` accept only a `.pdf` path with a positive whole page number (1–100,000), strip `|`, `#`, `[`, `]` and line breaks from the path and return `""` for anything else, so the row shows no link buttons. Each row gains **Copy page link** and **Open at page N**; opening uses the existing `openLinkText`, and copying reports success or a clipboard failure in the view message. Nothing is opened, resolved or written until a button is pressed, the index stays read-only and no PDF renderer, rectangle link or form engine is added. Covered by `tests/study-modules-3.test.js`; notes are in `docs/release-notes/1.210.4.md`. This closes the page-link half of the PDF++ row in §5.24.

- [x] **Citations (Nov 3, 2026, released 1.210.3):** the opt-in **Citations** Study Workspace module imports a `.bib` file already in the vault, keeps the parsed entries in plugin data and writes nothing on import. Entries keep key, type, title, authors, year, journal/booktitle, publisher, volume, issue, pages, DOI and URL; `Last, First` and `A and B` authors normalise to one form, duplicate keys are skipped and counted, and a malformed entry is dropped rather than guessed. The tab filters by author, title, journal or key, copies a plain-text reference with a `https://doi.org/` link when a DOI exists, creates a `type: citation` note with a formatted reference and details table in the configured folder (an existing path is never overwritten) and removes library entries without touching notes. `src/citations.js` is a pure parser/normaliser; the plugin API is `importCitationFile`, `createCitationNote` and `removeCitation`. No reference-manager login, network request, CSL processor, Zotero database or new dependency. Covered by `tests/citations.test.js`; notes are in `docs/release-notes/1.210.3.md`. This closes the Citations row in §5.24.

- [x] **Daily-note bridge (Nov 3, 2026, released 1.210.2):** Time blocks can read an optional `YYYY-MM-DD.md` daily note, preview `HH:MM` and `HH:MM - HH:MM` lines, skip lines already present as blocks and add the rest only after confirmation. The preview reports the path, new lines and duplicates, and **Open daily note** opens the source. The daily note is never written. Covered by `tests/time-blocks.test.js`; release notes are in `docs/release-notes/1.210.2.md`.

- [x] **Kairos-style time blocks with calendar context (Nov 3, 2026, released 1.210.1):** the opt-in Study Workspace **Time blocks** module now implements the Day, Week, Grid, Backlog, Routines, Projects/domains and Timeline views from §5.22.12. It reuses local study tasks, treats routines as offers, derives project minutes from blocks and exports a readable Markdown day note. When Calendar is on, Day and Week show its events read-only and mark blocks that overlap a class; **Show calendar events** hides the context. Calendar entries are never edited, moved or copied, and the planner works with Calendar off. Tests are in `tests/time-blocks.test.js` and `tests/study-workspace.test.js`; see §5.22.12 for the exact acceptance record. Released as **1.210.1**; notes are in `docs/release-notes/1.210.1.md`.

- [x] **1.210.0 Adaptive mastery (Nov 3, 2026):** the existing Adaptive practice option is now mastery-based rather than only difficulty-based. `src/mastery-picker.js` ranks course, unit, skill, topic, test, exam and tag facets from the complete question history, including partial credit, pace, skips and recency; small scoped subgroups borrow a prior from the same facet across the whole vault. It chooses a different question from the weakest facet, prefers a different difficulty and an unattempted or long-unattempted note, and suppresses exact questions for the session and seven days after an attempt. The selector is local and read-only, and the FSRS due-review path is unchanged. Wired through `src/filters.js`, `src/quick-practice.js`, `src/stats.js`, `src/practice-view.js` and `src/constants.js`; covered by `tests/mastery-picker.test.js`. **1,517 tests pass**, `npm run check` clean across **256 files**, `main.js` current across **256 modules**, `git diff --check` clean. Version **1.210.0** is in all version files; notes in `docs/release-notes/1.210.0.md`.

- [x] **1.209.2 release (Nov 3, 2026):** closed the last local progress-dashboard handoff item. The Insights Progress and Today mastery pickers now include calendar registry names before a question note has a `course` value; names, codes and aliases resolve to one subject, and a registry-only scope keeps its picker and empty state. Existing question-course scopes are unchanged without a registry, and the progress snapshot key includes the registry. Also cleared the remaining release-review CSS warnings: the SAT callout uses sibling selectors instead of `:has`, a small `src/sat-callout.js` post-processor mirrors the checked first-line state, and `text-decoration`/`column-gap` declarations use compatible forms. Tests in `tests/progress.test.js`, `tests/views.test.js`, `tests/today.test.js`, `tests/sat-callout.test.js` and `tests/release-hygiene.test.js`; **1,510 tests pass**, `npm run check` clean across **255 files**, `main.js` current across **255 modules**, `git diff --check` clean. Version **1.209.2** is in all version files; notes in `docs/release-notes/1.209.2.md`. The OpenCode installer is unchanged.

- [x] **Responsive workflow UI pass (Nov 1, 2026, unreleased):** added a shared `qt-screen` shell to Cards, Assignments, Insights, Reference, Study Tools, Study Workspace, Study statistics, Review calendar, Local events and Pomodoro, leaving Practice, Calendar and the timed test untouched. Pane-width container queries and `body.is-mobile` rules reflow cards, toolbars, tabs, summaries, tables and calendar cells instead of shrinking them, with 44 px mobile touch targets. Added `tests/ui-layout.test.js` and five UI contract tests; full suite **1,375 pass / 0 fail**, `npm run check` clean across 230 modules, `main.js` rebuilt at 3,260,027 bytes, `git diff --check` clean. UI commit `913a022`; no version bump or release.
- [x] **Study Workspace responsive navigation (Nov 2, 2026, unreleased):** the desktop rail is now visible and the compact section picker is hidden by default; container queries at 760 px hide the rail and show the picker in narrow panes. Updated `tests/study-workspace-layout.test.js` and `tests/mobile-module-layout.test.js` to assert the symmetric contract. Full suite **1,375 pass / 0 fail**; `npm run check` clean across 230 modules; `main.js` rebuilt. Real-Obsidian four-state capture remains blocked by the harness Xvfb `xkbcomp` dependency; no version bump or release.
- [x] **1.170.0 responsive UI release candidate (Nov 2, 2026, feature branch):** finished the non-Practice UI pass for Cards, Assignments, Insights, Reference, Study Tools, Study Workspace, Study statistics, Review calendar, Local events and Pomodoro. The desktop Study Workspace rail remains visible and the compact picker takes over at 760 px; narrow-pane controls now meet 44 px hit areas, search fields are full-height, and the local-events month grid uses colour markers when titles cannot fit. Real Obsidian 1.14.5 captures at 1200/390 in light and dark (60 images, including the 390 mobile day-agenda branches) were inspected for clipping, overflow, truncation, alignment, spacing and touch-target size. New layout assertions cover the 44 px controls and event-marker fallback. Full suite **1,376 pass / 0 fail**; `npm run check` clean across **230 files**; `main.js` rebuilt at **3,260,027 bytes**; `git diff --check` clean. Version **1.170.0** in `manifest.json`, `package.json`, `package-lock.json` and `versions.json`; notes in `docs/release-notes/1.170.0.md`. Not merged or tagged.
- [x] **1.169.3 release (Nov 1, 2026):** restores the optional one-click OpenCode installer removed in 1.169.1 at the owner's direction. `src/opencode-manager.js` and the original settings/plugin wiring are back, so **Download and install** and the automatic first-time prompt download, checksum-verify and unpack OpenCode under `~/.question-tracker/opencode`, then start and stop `opencode serve`. Version **1.169.3** is in `manifest.json`, `package.json`, `package-lock.json` and `versions.json`; notes are in `docs/release-notes/1.169.3.md`. The bundle intentionally contains `require("fs")` and `require("child_process")`; Obsidian may flag direct filesystem and shell access. Verification: **1,329 tests pass / 0 fail**, `npm run check` clean across **230 modules**, `main.js` rebuilt at **3,226,592 bytes**, `git diff --check` clean. The push-to-main release workflow publishes the three assets.
- [x] **1.169.2 import hotfix (Nov 1, 2026):** exported `extensionOf` from `src/documents.js` and added `tests/import-source.test.js`, which reads a real text source through `PdfImportModal.readSource()` and `readDocumentPages()` without a TypeError. Version **1.169.2** is recorded in all version files; notes are in `docs/release-notes/1.169.2.md`. Full suite **1,320 pass / 0 fail**; `npm run check` clean; `main.js` rebuilt. Released through the push-to-main workflow.
- [x] **1.169.1 release (Nov 1, 2026):** cleared the community-directory warnings. Removed the optional OpenCode auto-installer (`src/opencode-manager.js`), so the shipped bundle has no direct `fs` or `child_process`; OpenCode chat and agent mode now use a manually started `opencode serve` server configured by URL, with provider keys configured in OpenCode itself. Removed the duplicate phone `height` declaration (a separate `dvh` upgrade rule keeps the old-WebView fallback) and the Pomodoro `!important` (CSS custom-property duration plus reduced-motion `animation: none`). Version **1.169.1** is recorded in all version files; notes are in `docs/release-notes/1.169.1.md`. Verification: **1,318 tests pass / 0 fail**, `npm run check` clean, `main.js` rebuilt.
- [x] **1.169.0 release (Nov 1, 2026):** packaged and shipped the full `code-review.md` close-out. Version **1.169.0** is recorded in `manifest.json`, `package.json`, `package-lock.json` and `versions.json`; curated notes live in `docs/release-notes/1.169.0.md`; README's Analytics dashboard section now describes the combined At a glance row, course health, FSRS depth, due load and readiness. Full suite **1,325 pass / 0 fail**; `npm run check` clean across **230 files**; `main.js` current; `git diff --check` clean. Pushed to `main`; the release workflow creates the **1.169.0** tag and publishes the three assets. Known gate: the real-Obsidian desktop/phone/light-dark visual pass remains manual.

- [x] **Insights single dashboard (Nov 1, 2026, unreleased):** Insights now opens on **Overview**, and the tab order starts there. A five-card **At a glance** row combines the practice grade (weighted gradebook letters as fallback), course health (`good/total`, watch and at-risk), FSRS depth (memory-now plus retention), due load (seven-day forward total and cards due now) and the next exam's readiness percentage and countdown. A **Courses to watch** section lists only warn/at-risk courses with their concrete check text, assembled through the same `courseDashboard()`/`courseHealthReport()` path as Study Workspace; with no course data it states what to add. The existing grade snapshot, heatmap, calibration, retention, breakdown, course-time and full Next exam sections remain below. Covered by the new default-tab/combined-summary test in `tests/views.test.js`; existing weak-spot tests set their tab explicitly. Full suite **1,325 pass / 0 fail**; `npm run check` clean across **230 files**; `main.js` current at **3,224,157 bytes**; `git diff --check` clean. Shipped in **1.169.0**.

- [x] **Code-review ledger honesty close-out (Nov 1, 2026, unreleased):** rewrote `docs/code-review-closeout.md` to use only two classifications for every concrete finding in `code-review.md`: **Implemented and tested** (with reachable runtime code and a regression test) or **Not code-fixable** (with the exact missing data/schema/device input). Removed the prior `mostly`, `partially`, `deliberate`, `addressed`, generic product/manual gate wording. Added a manual-assignment exam test proving a `type: exam` note with no ICS feed caps at T-3, and a verification-model test proving the configured verifier is used and counted. Full suite **1,322 pass / 0 fail**; `npm run check` clean across **230 modules**; `main.js` current; `git diff --check` clean. No version bump, commit or release; real-Obsidian/device observations remain the only unverified rows.

- [x] **Pomodoro view polish (Nov 1, 2026, unreleased):** removed the duplicate in-pane "Pomodoro" heading and added an accessible phase progress bar. The bar fills continuously while the timer runs, holds its position when paused, uses one theme accent color with no phase colors, and falls back to stepped updates under reduced motion. Covered by 4 focused view tests in `tests/pomodoro-view.test.js` (10 Pomodoro tests total); full suite **1,286 pass / 0 fail**; `npm run check` clean across 226 modules with `main.js` regenerated. No version bump or release.

- [x] **Mobile review layout (1.168.1, Nov 1, 2026):** the post-answer review has a dedicated phone branch with a review header, Review | Passage tabs, one review scroller, a safe-area action bar and the existing More sheet. The shared `.qt-review` content is reused; desktop and tablet review keep the shared split and receive zero `.qt-m-*` classes. Covered by 4 new review tests in `tests/mobile-practice.test.js` (17 focused total), full suite **1,228 pass**, `npm run check` clean. Real-device visual audit remains manual.

- [x] **Owner decisions and minimal Practice keyboard (Nov 1, 2026, unreleased):** all 17 recommended defaults are recorded in §11 and the plugin stays free. The keyboard addition is the minimal map: Space/Enter submits an armed question, reveals a study card or advances a finished result; Esc ends the session. Text fields and focused controls keep native keys; there are no 1/2/3 self-grade or U undo keys. `src/practice-keys.js`, `src/practice-view.js`, 5 focused tests.
- [x] **Qwen preset and local STEM blocks (Nov 1, 2026, unreleased):** Qwen (DashScope) is selectable with the OpenAI-compatible endpoint and `qwen-plus`; `chem`, `biology`/`biosequence` and `circuit` blocks render chemistry, sequences and schematics in question content. Original local code; 9 focused tests. Full suite **1,242**, `npm run check` clean across 219 modules. No version bump or release.

- [x] **Feynman AI feedback and PDF annotation index (Oct 31, 2026):** two independent modules, each with a Global → Modules switch and a Study Workspace tab. **AI feedback** sends a saved four-step explanation to the user's existing AI provider (only after a button press), parses strict JSON clarity/accuracy/simplicity scores and two sentences of feedback, stores them beside the manual score and clears without touching it. **PDF annotations** reads the `.annotations.md` sidecars already in the vault and lists PDF/page/type/color/summary with backlinks, read-only. No provider, credential, PDF renderer or note write is added. Covered by 10 tests in `tests/study-modules-3.test.js`; full suite 1130; `npm run check` clean across 196 files. Unreleased on `main`; no version bump or release.

- [x] **Read aloud, lecture compiler, course health and audio bookmarks (Oct 31, 2026):** four independent modules, each with a Global → Modules switch and a Study Workspace tab. **Read aloud** speaks the active note with `window.speechSynthesis`, builds a deterministic sentence plan, highlights the current sentence, supports Full note / 90-second briefing / Key points and persists style, rate and pitch. **Lecture notes** compiles the lecture log into one Markdown note (overview, key concepts, `Term: definition` table, per-lecture sections), previews it and writes a numbered filename instead of overwriting. **Course health** combines the course dashboard, planner and tasks into Good/Watch/At risk rows with reasons. **Bookmarks** stores timestamps per audio attachment, numbers chapters and copies an Obsidian media link. No provider, key, request, recording, Canvas login or note rewrite is added. Covered by 10 tests in `tests/study-modules-2.test.js`; full suite 1105; `npm run check` clean. Unreleased on `main`; no version bump or release.

- [x] **Odd/even timetable parity (Oct 31, 2026):** an ICS class can declare `X-MCQ-WEEK-PARITY: odd` or `even`. When a semester start is set, `applyTermWeeks()` compares the occurrence's numbered term week and hides non-matching weeks; reading-week classes keep their marker, exams are never hidden, and invalid values are ignored. A moved `RECURRENCE-ID` occurrence inherits the series parity unless it declares its own, and `.ics` export preserves the property. Covered by 3 focused tests (2 parser/override, 1 term filter); full suite 1034. Unreleased on `main`; no version bump or release.

- [x] **Today full-width widget dashboard — released in 1.165.0 (Oct 30, 2026):** Today fills the whole view pane instead of stopping at 1320px. It keeps the 12-column grid and measures the Today pane itself: container-query breakpoints give four widget columns at 1400px and wider, three at 1050-1399px, two at 700-1049px and one below 700px. Window media rules are now guarded with `@supports not (container-type: inline-size)` and stay only as a fallback for Obsidian versions without container-query support. Panels share row height, cards stretch to fill their panel, and the primary Start row is a card. No max-width or auto-centering rule constrains the view root or the Today pane, and no data, scheduler, attempt or command behavior changed. A mounted-DOM test now asserts the root classes, container context, grid ancestry and simulated 4/3/2/1 columns. Manifest, package and versions are 1.165.0; no tag or GitHub release was created. Covered by 12 focused Today tests, including a mounted-DOM layout test that asserts the root classes, container context, grid ancestry and simulated 4/3/2/1 columns; full suite 958. Released in 1.165.0.

- [x] **Gated inline-quiz notes (Oct 31, 2026):** `src/quiz-note-gate.js` hides the reading-view content after a `gated: true` `mcq-quiz` block until every supported question is answered, then restores the hidden siblings. Static mode, malformed or unsupported question types, and embedded notes are left visible so a reader cannot be trapped behind an unanswerable quiz. The gate shows an answered/total progress panel and is covered by 2 focused tests in `tests/quiz-note-gate.test.js`; full suite 958. No scheduler, attempt or note data changed.
- [x] **Laptop layout and Quizlet PDF repair (Oct 31, 2026):** the shared view column is now 960 px instead of 720 px, with a 1040 px laptop/desktop width at 1000 px and wider; Exam and Today keep their full-width overrides. The Quizlet PDF importer now reads a tabbed header followed by plain rows, strips Quizlet print headers, accepts tab-separated answer keys, and treats a repeated two-page handout header as furniture. Device PDF bytes are converted without a Node-only `Buffer`. Covered by 2 focused tests in `tests/cards-import.test.js`; full suite 958. No network request or cloud upload was added.
- [x] **Laptop per-view layout pass (Oct 31, 2026):** the shared column stays at 960 px (1040 px at 1000 px and wider), but a new 701-1100 px container query now fixes the views that were still cramped at 1280x800 with the Obsidian sidebar open. Exam stacks its passage and question panes at 42%/58% with tighter pane padding instead of two squeezed 450 px columns; Insights uses five stat columns at 900-1100 px and three at 701-899 px, with an 84 px meter; Reference puts its ten tabs in a five-column grid and caps the graph at `clamp(220px, 32vh, 320px)`; Cards wraps its five tool buttons; Assignments wraps task actions onto their own row and lets long task titles wrap instead of ellipsizing. The import dialog was already `min(760px, 94vw)`, Today keeps its pane-width 4/3/2/1 grid, and every phone rule below 700 px is unchanged. Covered by 3 contract tests in `tests/laptop-layout.test.js`; no data or scheduler behavior changed.
- [x] **Quizlet PDF fixtures and device-path proof (Oct 31, 2026):** six realistic text fixtures in `tests/fixtures/` cover a single-column flashcard printout, two-column tab rows, a tabbed header with a set title and item numbers, a two-page handout with repeated headers, a numbered test with a multiple-choice answer key, and a mixed tabbed/plain set. They assert exact card counts and term/definition pairs through `parseQuizletPdf`. A single-page printout now drops the set title above `Terms in this set` instead of pairing it with the first term. `tests/quizlet-pdf-device.test.js` drives `parseQuizletPdfCards` through a fake PDF.js with `global.Buffer` removed, proving the browser `Uint8Array` path, and an image-only page returns the OCR/searchable-PDF message. Covered by 6 fixture tests and 2 device tests; no upload or network request was added.
- [x] **Better Quizbox bind/copy mirroring (Oct 31, 2026):** an `mcq-quiz` block can carry a stable `Id:`, and a later block can mirror it with `Bind: <id>` (read-only answer key) or `Copy: <id>` (answerable, keeping the source mode). `Stem: off` shows only the options. The id is resolved in the current note first, then across the vault; missing or nested mirrors render an in-place explanation, and a mirror never inherits `gated:`. No new write path, attempt, history, streak or scheduler state was added. Favourites are not ported because Better Quizbox still marks that panel "in development". Covered by 5 focused tests in `tests/quiz-bind.test.js`; that decision was resolved separately on Oct 31, 2026.
- [x] **Note Quiz Engine clipboard import (Oct 31, 2026):** a new **Import a generated quiz from the clipboard** command reads Note Quiz Engine-style fenced `note-quiz` Markdown, converts choice and text blocks into the existing Quick add grammar, and opens the normal preview. Choice answers accept a 1-based index, a letter or an option's text; text blocks accept one `answer:` or an `answers:` list, and extra accepted strings are written to `accepted_answers`, which the existing SPR grader already reads. Malformed blocks are reported by block number, and empty/unreadable clipboard or non-note-quiz text get explicit Notices. Nothing is written before **Create questions**, and no AI API is called. The Japanese/English prompt switch is already covered by the AI quiz generator's 22-language selector, so no duplicate setting was added. `src/quiz-clipboard.js` is pure; the clipboard read is stubbed in tests. Covered by 7 tests in `tests/note-quiz-clipboard.test.js`; full suite 981.
- [x] **Exam Plugin XML blocks (Oct 31, 2026):** a fenced `exam` block now reads the `<num>`, `<source>`, `<stem>`, `<options>`, `<answer>` and optional `<analysis>` tags used by Exam Plugin. Options accept `A.` with or without a space; keys accept one letter or a comma-separated multi-select set. Study mode (the default) marks correct options and shows a collapsible analysis; Answer mode hides the key until a single choice is clicked or a multi-select set is submitted. `___` becomes an inline blank, stem and analysis render through the existing Markdown pipeline (including images), and malformed XML explains the missing stem, options or key in place. `src/exam-block.js` is pure; the renderer adds no attempt, history, streak or scheduler write. The **Exam block mode** setting is under Review. Covered by 8 tests in `tests/exam-block.test.js`; full suite 989.
- [x] **Simple Flashcards blocks (Oct 31, 2026):** a fenced `simple-flashcards` block now uses Simple Flashcards' RemNote-style scoping: a bullet ending in `:::` opens a block and only its direct child bullets become cards. `::` and `>>` prompt from the left, `<<` prompts from the right, and `<>` adds one card in each direction. `{blue}` and grouped `{1|Paris}` clozes hide one group at a time, while `;;` takes its nested bullets as the answer. Optional `#deck/Name` tags on the header or a card label the deck; plain and deeper-nested bullets stay notes. `src/simple-flashcards.js` is pure and `src/simple-flashcards-view.js` is a local reveal reader with **Show answer**, **Next card**, **Review again** and in-place syntax errors. It records no attempt, history, streak or scheduler state. Covered by 8 tests in `tests/simple-flashcards.test.js`; full suite 997.
- [x] **Direct AI runtime model discovery (Oct 31, 2026):** **Settings → MCQ Tracker → AI → Fetch available models** reads the selected provider's model list (OpenAI-compatible `GET /models`, Anthropic `GET /v1/models?limit=1000`) with the same key, base URL and HTTPS/loopback checks as chat. The reply accepts OpenAI/Anthropic `data` arrays, bare arrays and Ollama `models` arrays; `models/` prefixes are normalized, duplicates are removed, and embedding, speech, moderation, image, rerank, realtime and safety models are filtered out. Up to 200 chat models are saved in settings and shown in a **Fetched models** dropdown beside the free-text model field; a fetched list is cleared when the provider or base URL changes. A refresh sends no prompt and spends no generation request. Missing base URL, missing key, empty list, malformed list, only-non-chat list, HTTP errors and unreachable servers have distinct messages. The LLM Test Gen any-language feature was already covered by the existing 22-language quiz generator. Covered by 9 tests in `tests/model-discovery.test.js`; full suite 1006.
- [x] **Verso-style reading plans (Oct 31, 2026):** a fenced `reading-plan` block declares a title, optional author, page count, start and target dates, reading days and optional off days. It spreads pages across the schedule, shows today's chunk, total progress and schedule, and compares actual pages with the pages planned through yesterday. Catching up clears **Behind** immediately; when behind, the remaining pages are redistributed across the remaining reading days. A passed target becomes **Off pace** and stops scheduling until the target changes; a future start shows **Not started**. A **Log pages** control stores progress locally in settings by the plan's stable id, so it survives a restart without writing the note or touching the MCQ/card scheduler. Missing fields, bad dates, no reading days, an off-day typo, an over-read page count and invalid progress each have a distinct message. Covered by 10 tests in `tests/reading-plan.test.js`; full suite 1016.
  - Skipped in the Verso turn: the §11 owner-decision rows (Omniscient keyboard shortcuts, Quizzable define-once/play-anywhere + partial credit, and Class Timetable parity) remain untouched; no row is blocked on an owner-supplied API key, paid account or other secret.
- [x] **Tag Timer local timers (Oct 31, 2026):** a fenced `tag-timer` block declares one Obsidian tag per stopwatch or countdown (`#study/biology stopwatch`, `#study/chemistry | countdown 25`). It validates missing, invalid, duplicate and ambiguous tags, unknown kinds and bad durations in place. Start, Pause, Stop and Reset use timestamps; a running timer resumes after restart, a stopped stopwatch starts a fresh run, and a countdown expires in the background and records its session exactly once. Progress is stored locally in settings by note path and tag, never in the note. A **Per-tag analytics** section shows today, last seven days, total time and session count for stopped timers. A **Tag Timer: stop all running timers** command stops and records every active timer. No attempt, history, streak, review date or note content is changed. Covered by 10 tests in `tests/tag-timer.test.js`; full suite 1026.
  - Skipped this turn: the §11 owner-decision rows (Omniscient keyboard shortcuts, Quizzable define-once/play-anywhere + partial credit, and Class Timetable parity) remain untouched; no row is blocked on an owner-supplied API key, paid account or other secret.
- [x] **FlashCard deterministic extraction — released in 1.166.0 (Oct 31, 2026):** the existing rule-based note extractor now reads explicit `Question:`/`Answer:` and `Q.`/`A.` pairs, including multi-line sides, plus `Front :: Back`, `Front → Back` and `Front => Back` card lines. Code blocks, task lines, cloze lines and table rows are never separator cards. An optional **Order seed** in the extraction preview orders the same cards reproducibly across runs and sessions; a blank seed keeps source order. The Cards view adds an 8-week **Card retention** panel using repeat reviews only, with an empty state before the second review. No AI call, network request, note rewrite, attempt, history, streak or scheduler write is added. Covered by 5 tests in `tests/flashcard-generate.test.js`; full suite 1031.
  - Skipped this turn: the §11 owner-decision rows (Omniscient keyboard shortcuts, Quizzable define-once/play-anywhere + partial credit, and Class Timetable parity) remain untouched; no row is blocked on an owner-supplied API key, paid account or other secret.

**Inline QuizPort player (Oct 30, 2026):** `quizport` blocks play QuizPort JSON (inline or `file:`) with hint-before, explanation-after, single/multi-select grading, optional shuffle and a missed-only retry. The player is local and read-only: no request, attempt, history, streak or scheduler write. `src/quizport.js` holds the parser and scorer, `src/quizport-view.js` the renderer; covered by 8 focused tests. Full suite 954.

**Unreleased task estimates and Markdown table import (Oct 30, 2026):** `src/assignments.js` reads `⏱️` estimates (`45m`, `1h 30m`, `1.5h`) from Tasks lines and the `estimate` frontmatter, mirrors the value into the task line, and computes today/tomorrow/next-7-days workload for the Assignments view and Today. `src/cards-import.js` adds a `mdtable` source that reads the first Markdown table, maps the same headers as CSV, preserves escaped pipes, turns `<br>` into line breaks and writes ordinary cards with `import_format: mdtable`. Covered by tests; no release was made.

**Legal/compliance hardening (no release, Oct 30, 2026):** the build now embeds the full `LICENSE` text and `NOTICES.md` inside the generated `main.js`, so the MIT notice ships with the single file Obsidian installs; `tests/build.test.js` asserts the permission text and both third-party copyright lines. The README drops the SAT Question Bank example, adds an import-rights warning and a trademark disclaimer, and the manifest calls the tutor bring-your-own-key. `CONTRIBUTING.md` records the MIT inbound terms, AI-assistance disclosure and third-party licence rules. `nodeReq` now loads each Node built-in through literal `require()` calls in an allowlist, so static review can see every module. Recorded: section 11 items 18-21.

**Repo-wide no-dynamic-code guard (no release, Oct 30, 2026):** `scripts/check-no-dynamic-code.js` walks every `.js` file under `src/` on disk (163 files; it throws instead of passing when none are found), masks comments and string literals while keeping template interpolations as code, and rejects `eval(`, `Function(` construction, string-bodied `setTimeout`/`setInterval`, and non-literal `require`/dynamic `import` arguments. `npm run check` runs it before the bundle sync check. `tests/no-dynamic-code.test.js` scans the real tree and a planted temp fixture; the shipped source contained no such construct, so nothing was rewritten and `main.js` is unchanged. A planted `src/__guard_probe__.js` made the check print `src/__guard_probe__.js:1: eval: eval(` and exit 1, then passed again after removal. Full suite 941.

**Anki bridge hardening (no release, Oct 30, 2026):** focused edge tests and fixes for the Anki bridge. `pushCardsToAnki` now separates unlinked creates from linked updates, so a push-only run updates an existing Anki note instead of trying to create a duplicate; the push-only preview lists those updates and missing notes too. Media uploads now detect two different vault files with the same basename, upload only the first, and warn with both paths instead of silently overwriting one. Table cells keep escaped pipes and inline bold/italic/code, inner code/math placeholders are restored inside tables, and escaped pipes normalize the same way on the Markdown and Anki HTML sides of the sync hash. Covered by 4 new tests in `tests/anki-connect.test.js` (26 in that file; full suite 817). No version bump or release: this is hardening and bug fixing, not a new user-facing feature. The real Anki desktop path is documented in [docs/anki-smoke-test.md](docs/anki-smoke-test.md) and remains manually gated; see §11 item 11.

**Study Vault verification (no release, Oct 30, 2026):** the row is verified-satisfied by the existing exam-coverage implementation. `buildStudyPlan()` already returns `daysLeft` and `topics: { declared, mastered, pct }`, and both `src/today-view.js` and `src/insights-view.js` render the pair in one progress card. A focused Insights test now proves the combined display; the existing Today test covers the same pair there. No new setting, note property, scheduler path or release was needed. Full suite 927.

- **1.166.0 directory status:** the 1.166.0 release is the new reviewable version; no 1.166.0 scorecard or dashboard decision has been observed yet. The 03:20 UTC index mirror still does not list the plugin.

**Community-directory scorecard (Oct 31, 2026):** 1.165.0 passed release-attestation, dependency and byte-for-byte build checks. The `fs` and `child_process` warnings were cleared in 1.169.1 by removing the OpenCode auto-installer; **1.169.3 restores that optional installer, so those warnings return by owner decision**. Vault enumeration and clipboard access remain user-triggered. The README now maps each capability and corrects the stale "never reads the clipboard" sentence; the Note Quiz importer reads only when its command is run. The 1.169.3 installer restores the download and start behavior described above.

**Latest completed (1.164.0):** automated-review hardening. `src/simple-quiz.js` no longer uses `new Function`; legacy `quizjs` blocks return a disabled migration notice and `quizjson` remains the only card source. The obsolete JavaScript toggle is removed, existing saved values normalize away, and no note code is executed. The flagged `text-decoration-thickness` declaration was removed; `line-through` remains. Vault enumeration, write-only clipboard access, user-configured network calls and base64 image/auth/media payloads are intentional and documented in the README privacy section. Covered by the focused simple-quiz test including a no-dynamic-code assertion; full suite 931. Shipped as [1.164.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.164.0) from `4403d55` in [run 41124294109](https://github.com/ifriedenson/mcq-tracker/actions/runs/41124294109). The release publishes exactly `main.js`, `manifest.json` and `styles.css`; all three were downloaded and byte-compared with the committed build (`main.js` SHA-256 `2664f4ad8b3437e7f0583b8765802038d41922ad6cf1c2e2b38260e2f1ff52a0`, `manifest.json` `75cfd71634c620bc4880c391321e0511576e1cf55218218536b13d10ebe57fc7`, `styles.css` `04aec4a039026f132306c99c24800a492855faacc13c89f1814873fa7d8a81a7`).

**Previously (1.163.0):** optional **error-log review sheet** (`src/results-export.js`, `src/plugin.js`, `src/insights-view.js`, `tests/practice-sheet.test.js`, `tests/views.test.js`, `main.js`). The command **Export an error-log review sheet** and the new **Export due review sheet** button in Insights → Error log compile every question currently due into a printable Markdown sheet. Each item keeps its prompt, choices or matching prompts, a blank answer line and, when available, the latest recorded miss (`chose A · reason: careless · on 2026-10-20`). The correct key, rationale, private notes and frontmatter are omitted, and no note, attempt, history, streak or next review is changed. Files are numbered instead of overwriting. Covered by 3 focused tests plus the Error-log button test; full suite 930. Shipped as [1.163.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.163.0) from `23c8fa8` in [run 41122508769](https://github.com/ifriedenson/mcq-tracker/actions/runs/41122508769). The release publishes exactly `main.js`, `manifest.json` and `styles.css`; all three were downloaded and byte-compared with the committed build (`main.js` SHA-256 `cf1715ca1f868cb4b9481d0fbd497ee3ffa8ddcf8f0c542e68c9024dc566b989`, `manifest.json` `96c713c612e3a2d2f5a99e97b0e436dfe4a9d54592f1c3353db2de4a988ab4e2`, `styles.css` `3c3515d77fec876f56d2ee90b86d527d6fe17c8f60dbffdacbb3ff065d0591b1`).

**Previously (1.162.0):** optional **term calendar** (`src/calendar-model.js`, `src/calendar-settings.js`, `src/calendar-view.js`, `src/plugin.js`, `styles.css`, `tests/term-calendar.test.js`, `main.js`). Settings, Calendar, Schedules & Sync now has a **Semester start**, **Semester end** and **Reading weeks** field. Week 1 begins on the start date; the month grid shows `W1`, `W2`, … at each row start, and the selected day shows its term week. Classes outside the semester are hidden, while exams remain. Reading-week classes stay visible with a strike-through and label, are skipped by next-class actions, and are omitted from `.ics` export. All term behavior is off until a semester start is set; corrupt dates/ranges normalize safely and the settings survive restart. No attempt, history, streak, Auto Anki, Text2Anki, Spaced Repetition output or next-review path changed. Covered by 6 focused tests; full suite 926. Shipped as [1.162.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.162.0) from `4b41617` in [run 41120311757](https://github.com/ifriedenson/mcq-tracker/actions/runs/41120311757); the released assets match the committed build (released `main.js` SHA-256 `e4ce220508e0f89bd13f729a84b59f152c43876963aa3c42000ccd1ec4571102`). The repository now has a committed npm lockfile and the release workflow installs with `npm ci`. Odd/even week parity was recorded as §11 item 16 and resolved on Oct 31, 2026 with the `X-MCQ-WEEK-PARITY` ICS extension. Study Vault's exam-days/topics widget is verified-satisfied; the next candidate row is A-Level Study Coach's error-log review sheet.

**Previously (1.161.0):** opt-in **shared-option choice questions** (`src/quiz-block.js`, `src/plugin.js`, `src/constants.js`, `src/settings-tab.js`, `tests/shared-choice.test.js`, `main.js`). Options placed before the first `Q:` are shared by choice questions without their own choices; each keeps its own `Answer:` and grades independently. The setting is off by default, own choices override the shared set, corrupt values normalize, and no attempt, history, streak or scheduling path changed. Covered by 5 focused tests; full suite 920. Class Timetable's term dates and reading weeks shipped in 1.162.0; odd/even parity is §11 item 16. Study Vault's exam-days/topics widget is verified-satisfied after 1.162.0; the next candidate row is A-Level Study Coach's error-log review sheet.

**Previously (1.160.0):** opt-in **inline numeric questions** (`src/quiz-block.js`, `src/plugin.js`, `src/constants.js`, `src/settings-tab.js`, `styles.css`, `tests/numeric-quiz.test.js`, `main.js`). With **Inline numeric questions** on, an `mcq-quiz` question may use `Type: numeric`; `Answer:` is a number, `Tolerance:` is an inclusive ± margin, and optional `Min:` / `Max:` bounds the field and validation. Values are graded locally. The setting is off by default; corrupt values normalize to off and survive restart. No attempt, history, streak, Auto Anki, Text2Anki, Spaced Repetition output or next review changed. Covered by 6 focused tests; full suite 915. The next unimplemented competitor row is Quiz Blocks' shared-option-set `choice` type.

**Previously (1.159.0):** opt-in **inline reorder questions** (`src/quiz-block.js`, `src/plugin.js`, `src/constants.js`, `src/settings-tab.js`, `styles.css`, `tests/reorder.test.js`, `main.js`). With **Inline reorder questions** on, an `mcq-quiz` question may use `Type: reorder`; its `A.`–`H.` lines are items, `Answer:` must list each letter once in the correct order, and ▲/▼ buttons arrange rows before **Check order**. Grading is exact sequence only. The setting is off by default; corrupt values normalize to off and survive restart. No attempt, history, streak or scheduling path changed. Covered by 5 focused tests; full suite 909. Quizzable's define-once/play-anywhere naming and partial-credit formula are recorded in §11 item 15.

**Previously (1.158.0):** opt-in **inline quiz result export** (`src/quiz-block.js`, `src/plugin.js`, `src/constants.js`, `src/settings-tab.js`, `tests/quiz-results.test.js`, `main.js`). An `mcq-quiz` block can declare a block-level `id:`. With **Export inline quiz results** on, a fully answered quiz writes `quizResults.<id>` with `score`, `totalPoints`, `percentage` and `passed`, matching Quizzable's documented shape. The setting is off by default, partial quizzes and id-less blocks write nothing, and linked-question attempts, history, streak and next review follow their existing path unchanged. Covered by 5 focused tests; full suite 904. Omniscient keyboard-first shortcuts are recorded as unresolved in §11 item 14.

**Previously (1.157.0):** the optional **Exam-ready badge** (`src/view-helpers.js`, `src/constants.js`, `src/plugin.js`, `src/settings-tab.js`, `src/practice-view.js`, `styles.css`, `tests/exam-ready.test.js`, `main.js`). It maps Omniscient's `Mastered(n)`/exam-ready contract onto MCQ's existing consecutive-correct `streak`: **Mastered passes** defaults to **2**, is clamped to 1–10, and is behind an off-by-default **Exam-ready badge** toggle under Settings → Review. After a result, practice shows **Exam ready · N correct in a row** when the streak reaches the threshold. It writes no new property and leaves attempts, history, next review, Auto Anki, Text2Anki and Spaced Repetition output unchanged. Covered by 5 focused tests; full suite 899. Shipped as [1.157.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.157.0) from `5c00279` in [run 41113381118](https://github.com/ifriedenson/mcq-tracker/actions/runs/41113381118). The next unscheduled gap is Omniscient keyboard-first practice shortcuts. Item 1 stays open in §11 item 13.

**Previously (1.156.0):** per-question **hints** (`src/constants.js`, `src/notes.js`, `src/view-helpers.js`, `src/practice-view.js`, `src/settings-tab.js`, `src/plugin.js`, `src/quick-add.js`, `tests/hints.test.js`, `main.js`). A question can keep a `## Hint` section or a `hint`/`clue` property. With the new off-by-default **Per-question hints** setting, practice shows **Show hint** and reveals the hint only when pressed; closed-book practice suppresses it. Quick add accepts `Hint:` and `Clue:` and writes a normal Hint section. Nothing writes attempts, history, streak or scheduling. Covered by 5 focused hint tests and the Quick add test; full suite 894. **Next remaining plan work is externally gated**, and item 1 stays open in §11 item 13.

**Previously (1.155.0):** §5.22.4 item 4 adds optional **closed-book practice** (`src/constants.js`, `src/plugin.js`, `src/settings-tab.js`, `src/practice-view.js`, `tests/closed-book.test.js`, `main.js`). The off-by-default setting hides the **Open note** shortcut during a question, closing the remaining pre-submit answer leak; explanations and the source row were already built only on the result screen. Submitting still records the same attempt and reveals the source, explanation and AI actions. Corrupt saved values normalize to off and the setting survives restart. Covered by 4 focused tests; the full suite is 888 tests. Shipped as [1.155.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.155.0) from `8285695` in [run 41110478009](https://github.com/ifriedenson/mcq-tracker/actions/runs/41110478009); the published `main.js` matches the committed build (SHA-256 `d9c1aa2d`). **No specified §5.22.4 item remains**; item 1 stays open in §11 item 13.

**Previously (1.154.0):** §5.22.4 item 2 adds **exam coverage** (`src/calendar-model.js`, `src/calendar-settings.js`, `src/study-plan.js`, `src/plugin.js`, `src/today-view.js`, `src/insights-view.js`, `main.js`). The course registry gains an optional **Total topics** count, normalized to 0–500 with 0 meaning no declared count. The study plan groups the exam course's questions by `skill`; a topic is mastered only when every question in that skill has attempts and 100% accuracy. The plan now carries `topics: { declared, discovered, mastered, pct }`, and Today/Insights append `N/M topics mastered (P%)` only when the count is declared. Readiness, due counts, question pools, attempts, history, streak and next review are unchanged. Covered by 3 focused tests in `tests/study-plan.test.js` and `tests/calendar.test.js`; full suite 884 tests. Shipped as [1.154.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.154.0). **Next unscheduled item: §5.22.4 item 4**, closed-book gating.

**Previously (1.153.0):** §5.22.4 item 3 adds an **answer-free practice sheet** (`src/results-export.js`, `src/plugin.js`, `tests/practice-sheet.test.js`, `main.js`). The command **Export an answer-free practice sheet** writes `mcq-practice-sheet-YYYY-MM-DD.md` at the vault root from the current question filter. It includes the stimulus, question, choices, matching prompts with blank right-hand answers, metadata and blank answer lines, while omitting the answer section, key, rationale, source notes and frontmatter. A collision gets a numbered ` 2.md` name instead of overwriting, and no question note or review state is modified. Item 1 (misconception diagnosis) is recorded as open in §11 item 13 because its taxonomy, AI re-check behavior and storage/re-targeting contract are unspecified. Covered by 5 focused tests in `tests/practice-sheet.test.js`; the full suite is 882 tests. Shipped as [1.153.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.153.0) in [run 41106512617](https://github.com/ifriedenson/mcq-tracker/actions/runs/41106512617). **Next unscheduled item: §5.22.4 item 4**, closed-book gating.

**Previously (1.152.0):** §5.22.4 item 7 adds an optional **Needs-fixing flag** (`src/history.js`, `src/notes.js`, `src/plugin.js`, `src/settings-tab.js`, `src/practice-view.js`, `styles.css`, `src/main.js`). After misses on five distinct calendar days, the attempt writes `needs_fixing: true`, `needs_fixing_since` and `needs_fixing_miss_days`. The result screen shows **Needs fixing** with a **Mark fixed** button, and the command palette adds **Mark this question fixed**. Confirming opens the existing confirmation window, clears the flag fields and writes `needs_fixing_fixed_on`; attempts, history, streak, Auto Anki, Text2Anki, Spaced Repetition output and next review are untouched. Misses before the fixed date are not counted again, so a repaired question starts a fresh five-day cycle. The option is off by default and corrupt saved values normalize to off. Covered by 8 focused tests in `tests/needs-fixing.test.js`; the full suite is 877 tests. Shipped as [1.152.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.152.0) in [run 41102353080](https://github.com/ifriedenson/mcq-tracker/actions/runs/41102353080). **Next unscheduled item: §5.22.4 item 1**, misconception diagnosis on a miss.

**Previously (1.151.0):** the step-9 queue is complete. Row 28 was verified-satisfied against `src/note-review.js` and `tests/note-review.test.js`; the upstream Review Notes README is a recent-files list rather than periodic review, so no duplicate view was added. The new feature is an optional **Daily-quiz streak freeze** (`src/daily-quiz.js`, `src/daily-quiz-settings.js`, `src/today-view.js`, `src/constants.js`, `src/main.js`). One freeze is earned every 5 completions by default (configurable 2–50, maximum 3), and an available freeze automatically covers a missed day when the next daily quiz is completed. A gap larger than the available freezes resets the streak; the option is off by default. Covered by 6 focused tests in `tests/daily-quiz-freeze.test.js`; the full suite is 869 tests. Shipped as [1.151.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.151.0) in [run 41099301683](https://github.com/ifriedenson/mcq-tracker/actions/runs/41099301683). **Next unscheduled item: §5.22.4 item 1**, misconception diagnosis on a miss.

**Previously (1.150.0):** step 9 queue row 27 adds an optional **Card reveal animation** (`src/cards.js`, `src/cards-view.js`, `src/cards-settings.js`, `src/constants.js`, `styles.css`, `src/main.js`). Under Settings, Cards, Review, **Instant** is the default; **Fade in** and **Flip** add a short entrance to the answer after **Show answer** or a typed check. The class is applied to the existing `.qt-cards-answer` only on the render that follows a reveal, so a workspace refresh or AI verdict update never replays it. Reduced motion and browsers without CSS transition support fall back to instant, and nothing about attempts, history, streak, next review or the card note format changes. Covered by 7 focused tests in `tests/card-reveal.test.js`; the full suite is 863 tests. Shipped as [1.150.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.150.0) in [run 41097232057](https://github.com/ifriedenson/mcq-tracker/actions/runs/41097232057). **Next in step 9 was row 28**, Review Notes; it was verified-satisfied in 1.151.0 against the existing whole-note queue.

**Previously (1.149.0):** step 9 queue row 26 adds **Anki folder exclusions** (`src/anki-connect.js`, `src/cards-settings.js`, `src/constants.js`, `src/plugin.js`, `src/main.js`). The new **Excluded folders** setting keeps a configured vault folder and all of its subfolders out of Anki previews, pushes and syncs. Matching is case-insensitive and prefix-safe, so `Cards/Archive` excludes `Cards/Archive/Old/Q.md` but not `Cards/Archived/Q.md`. The filter runs through the existing `ankiExclusionReason`/`buildAnkiNotes` path, so it applies to the normal filtered push, vault-wide push, sync preview and AnkiConnect writes without a parallel note type or index. Row 24 was verified as already satisfied by the existing FSRS and AI card-generation paths; row 25 has no documented feature. Covered by 2 focused tests in `tests/anki-folder-exclusions.test.js`; the full suite is 856 tests. Shipped as [1.149.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.149.0) in [run 41095440297](https://github.com/ifriedenson/mcq-tracker/actions/runs/41095440297). **Next in step 9 was row 27**, Obsidiflip's flip/fade presentation.

**Previously (1.148.0):** step 9 queue row 23 adds **Spaced Repetition quiz notes** (`src/spaced-quiz.js`, `src/card-generator.js`, `src/card-generator-modal.js`, `src/plugin.js`, `src/main.js`). The card generator now offers **Save as a Spaced Repetition quiz note**, and the dedicated **Spaced quiz: generate from this note** command opens that mode on the whole active note. The existing AI card draft is previewed first; confirming builds a separate note under the card folder with `#flashcards`, one question, a `?` line and one answer per block. The note is parsed back through the existing Spaced Repetition importer before writing, then its cards are imported with the normal deck, course, source, `import_batch` and `import_key` provenance and the existing ladder/FSRS schedule. Re-running updates the same note and skips tracked cards; a user note at the target path is never overwritten. Source attempts, history, streak and next review are untouched. Covered by 5 focused tests in `tests/spaced-quiz.test.js`; the full suite is 854 tests. Shipped as [1.148.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.148.0) in [run 41094115096](https://github.com/ifriedenson/mcq-tracker/actions/runs/41094115096). **Next in step 9: row 24**, Spaced Repetition AI, which has no distinct missing feature.

**Previously (1.147.0):** step 9 queue row 22 adds **Text2Anki**, a one-shot selection-to-Anki shortcut (`src/text2anki.js`, `src/plugin.js`, `src/cards-settings.js`, `src/constants.js`). **Text2Anki: send the selection to Anki** drafts cards immediately with the configured AI provider, writes ordinary tracked card notes through the shared Auto Anki batch (`import_batch`, `import_key`), and pushes only those paths through AnkiConnect. It requires a selection, supports an optional `Deck: ...` line and a custom instruction under Cards → Text2Anki, and reuses the same batch as Auto Anki so the two commands do not duplicate cards. Covered by 6 focused tests in `tests/text2anki-openai.test.js`; the full suite is 849 tests. Shipped as [1.147.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.147.0) in [run 41092118644](https://github.com/ifriedenson/mcq-tracker/actions/runs/41092118644). **Next in step 9: row 23**, Flashcard Generator.

**Previously (1.146.0):** step 9 queue row 21 adds **Auto Anki** (`src/auto-anki.js`, `src/auto-anki-modal.js`, `src/plugin.js`, `src/cards-settings.js`, `styles.css`). **Auto Anki: send this note or selection** opens a source/count/deck confirmation, drafts cards through the existing AI card generator, writes ordinary tracked card notes through the existing importer, and pushes only those card paths through the existing AnkiConnect bridge. A stable source-text batch on `import_batch`, plus a per-card `import_key`, makes a second run reuse the existing cards and send them again without calling the AI or creating duplicates. Settings under Cards cover the default count and deck. Covered by 6 focused tests in `tests/auto-anki.test.js`; the full suite is 843 tests. Shipped as [1.146.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.146.0) in [run 41089689474](https://github.com/ifriedenson/mcq-tracker/actions/runs/41089689474). **Next in step 9: row 23**, Flashcard Generator.

**Previously (1.145.0):** step 9 queue row 20 adds **Spaced Everything** (`src/spaced-everything.js`, `src/spaced-everything-modal.js`, `src/note-review-modal.js`, `src/plugin.js`, `src/settings-tab.js`, `styles.css`). It is an optional whole-note SuperMemo 2 mode on the existing note-review queue, not a second note database. **Spaced Everything: log review outcome for this note** onboards the open note and records **Fruitful** (score 1), **Unfruitful** (score 5) or **Ignore** (score 3); **Spaced Everything: review due notes** opens the shared note-review modal with due notes; **Spaced Everything: capture thought** creates an onboarded thought note. Scheduling is stored only in `se-interval`, `se-ease` and `se-last-reviewed`; question and card `attempts`, `history`, `streak` and `next_review` are untouched. Capture title/body templates support `{{date}}`, `{{time}}`, `{{unixtime}}` and `{{thought}}`. Malformed schedules are shown as due and repaired on rating. Settings under Review cover enable, default interval/ease, capture folder and templates. Covered by 6 focused tests in `tests/spaced-everything.test.js`; the full suite is 837 tests. Shipped as [1.145.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.145.0) in [run 41087409754](https://github.com/ifriedenson/mcq-tracker/actions/runs/41087409754). **Next in step 9: row 23**, Flashcard Generator.

**Previously (1.144.0):** step 9 queue row 19 adds **Simple Note Quiz**. **Simple note quiz: start on this note** parses lines ending in the configured marker (`?` by default), treats the following lines until a blank line or the next unindented bullet as the answer, and opens a modal with **Known** / **Still learning**. It can review all, unmarked or missed questions, shuffle, clear marks, and saves visible ✅/❌ marks only when accepted. Frontmatter and fenced code are ignored; note-local marks never call `applyAttempt`, so question attempts, history, streak and next review stay untouched. Question marker, separator and shuffle are under Settings → Daily quiz. Covered by 7 focused tests in `tests/simple-note-quiz.test.js`; the full suite is 831 tests. Shipped as [1.144.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.144.0) in [run 41085153063](https://github.com/ifriedenson/mcq-tracker/actions/runs/41085153063). **Next in step 9: row 23**, Flashcard Generator.

**Previously (1.143.0):** step 9 queue row 18 adds Simple Quiz parity. `quiz` blocks render inline flip-card sessions; `quizjson` blocks and JSON card lists load cards, and opt-in `quizjs` blocks build cards with `fc.addCard()`/`fc.commit()`. `quiztoday` and `quizcharts` render local streak, card/quiz counts and a dependency-free 30-day chart without touching the question scheduler. `sources` accepts notes or folders, and the JavaScript setting is off by default with a trusted-code warning. Covered by 7 tests in `tests/simple-quiz.test.js`; the full suite is 824 tests. Shipped as [1.143.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.143.0) in [run 41082745304](https://github.com/ifriedenson/mcq-tracker/actions/runs/41082745304). **Next in step 9: row 19**, Simple Note Quiz.

**Previously (1.142.0):** step 9 queue row 17 adds Lemma-style **guided card/deck creation** and **optional CouchDB review-state sync**. The card dialog now shows a live note preview, and choosing **New deck…** collects the deck name, folder and course and saves that deck with the first card. CouchDB sync is off by default under Settings, Cards, Sync: enter a server URL and database, test the connection and run a manual sync. Each card gets a small per-card document with review properties only; card text stays in the vault. The newest review wins the schedule, both histories are unioned, `review_updated` records the latest review, and a 409 conflict is deferred to the next sync instead of overwriting a note. The password lives in Secret Storage, remote URLs must use HTTPS, and remote-only cards are reported but not created. Covered by 7 focused tests in `tests/couchdb-sync.test.js`; the full suite is 813 tests. Shipped as [1.142.0](https://github.com/ifriedenson/mcq-tracker/releases/tag/1.142.0) in [run 41076430504](https://github.com/ifriedenson/mcq-tracker/actions/runs/41076430504). **Next in step 9: row 18**, Simple Quiz.

**Previously (1.141.0):** step 9 queue row 16 adds **source-anchored recalls** (`src/source-recall.js`, `src/provenance.js`, `src/cards.js`, `src/card-modal.js`, `src/cards-view.js`, `src/plugin.js`, `styles.css`). Select text in a Markdown note and run **Create a source-anchored recall from selection**; the passage is prefilled as the card answer and stored as `source_quote` with a short `source_context` and nearest `source_heading`. After revealing the card, the review shows the passage with the anchor marked, and **Review in context** opens the source note and selects the passage. The recall is an ordinary card, so it reuses the existing card queue, attempts, offline outbox and ladder/SM-2/FSRS scheduling; no parallel note type or scheduler was added. Covered by 7 focused tests in `tests/source-recall.test.js`; the full suite is 806 tests. **Next in step 9: row 17**, Lemma's optional CouchDB sync and guided card/deck creation.

**Previously (1.140.0):** step 9 queue row 15 extends **inline quiz blocks** with Quizzator-style `Type: slider` questions (min/max/step/tolerance), `Type: text` questions (local exact check plus optional AI evaluation), per-question `Weight:` and weighted `pass:` / `imprecise:` bands. Slider and text answers use the existing quiz block, no parallel scheduler or note format; text AI evaluation uses the existing `cardGrading` AI path. Covered by `tests/quiz-block.test.js`; the full suite is 799 tests. **Next in step 9: row 16**, iDoRecall source-anchored recalls.

**Previously (1.139.0):** step 9 rows 3–5 add a **per-note scheduler override** (`scheduler: ladder|sm2|fsrs` on a card) and an off-by-default **file-explorer due/new marker** (`cards.fileExplorerDue`); the same release carries the Flashcard Learning parity work and the review hardening pass.

**Previously (1.138.0):** step 9 queue row 13 adds **per-deck SM-2/FSRS scheduling** (`src/sm2.js`, `src/cards.js`, `src/notes.js`, `src/plugin.js`, `src/cards-settings.js`).

**Previously (1.137.0):** step 9 queue row 12 adds **Obsidian content authority** and exact Anki source links (`src/anki-connect.js`, `src/plugin.js`, `src/cards-settings.js`). The opt-in **Card content authority** setting still defaults to **Two-way (merge)**. Choosing **Obsidian owns content** keeps card text, deck and tags authored in Obsidian, overwrites Anki text edits on the next sync, and still pulls Anki's due/interval/reps/lapses scheduling metadata. **Source backlink in Anki** now links to the exact `source_pdf` or `source_note` with the first `source_page` number or the `source_heading`; that link stays out of the sync comparison. Covered by 2 new tests in `tests/anki-connect.test.js` (22 in that file); the full suite is 765 tests. **Next in step 9: row 14**, Flashcard Learning's multiple reviews in one day, expectation labels and adaptive frequency.

**Previously (1.136.0):** step 9 queue row 11 adds **AnkiSync+ parity** (`src/anki-connect.js`, `src/plugin.js`, `src/cards-settings.js`). **Omit text with a regex** removes matching text from both the Anki front/back and the local sync comparison, so the omitted text does not create a false conflict. **Excluded tags** and **Excluded decks** keep matching cards and a deck's subdecks out of Anki previews and syncs. **Excalidraw support** rewrites `![[Drawing.excalidraw]]` to the `.excalidraw.svg` exported by the Excalidraw plugin, resolves it from the optional export folder, uploads it through AnkiConnect and mirrors the exported image name in the sync hash. **Clear links to deleted Anki notes** is opt-in and resets the local `anki_*` identity, model and scheduling properties plus the deletion index when Anki reports the linked note missing; the card body is untouched and the card can be pushed again. Every addition is off by default. Covered by 3 new tests in `tests/anki-connect.test.js` (20 in that file); the full suite is 763 tests. **Next in step 9: row 12**, Flashcards' Anki-owns-history source-link model.

**Previously (1.135.0):** step 9 queue row 10 adds **plain Markdown cards** for Yanki parity (`src/plain-cards.js`, `src/cards.js`, `src/plugin.js`, `src/cards-settings.js`). The opt-in **Plain Markdown cards** folder setting scans only that folder, keeps notes plain, and reads basic (`front` / `---` / `back`), reversed (`front` / `---` / `---` / `back`) and cloze (`~~hidden~~`) structure through the ordinary `parseCardBody` path. Cards therefore use the same card queue, ladder/FSRS scheduling, offline outbox and Anki bridge as every other card. Notes without a usable structure and existing question or card notes are left out. Folder names become nested Anki deck names with `::`, with a root note using the source folder name. **Cards: rescan plain Markdown folder** and the Rescan button rebuild the index. Every new behavior defaults off and existing card settings are unchanged. Covered by 4 tests in `tests/plain-cards.test.js`; the full suite is 760 tests. **Next in step 9: row 11**, AnkiSync+ omission, Excalidraw, exclusion filters and cleanup.

**Previously (1.134.0):** step 9 queue row 9 adds **vault-wide Anki push** for Awesome Flashcard parity (`src/anki-connect.js`, `src/plugin.js`, `src/cards-settings.js`). The opt-in command **Cards: push the whole vault to Anki (AnkiConnect)** and the **Push whole vault** settings button reuse the existing preview-before-Apply flow while ignoring the deck/course filter; the ordinary filtered push and two-way sync are unchanged. Markdown conversion now handles video embeds (`<video controls>`) and pipe tables, while images, audio, code and LaTeX keep working. Extra vault-wide Anki tags are merged with each note's tags, and an optional source backlink points back to `source_note`, `source_file` or the card note through an `obsidian://open` URI. Sync-hash normalization ignores that backlink and compares tables and video as the same content, so pulls do not create false conflicts. Every addition is off unless enabled. Covered by 17 tests in `tests/anki-connect.test.js`. **Next in step 9: row 10**, Yanki's structure-to-note typing and folder-to-deck tree.

**Previously (1.133.0):** step 9 queue row 8 adds the **Anki sync preview and media bridge** (`src/anki-connect.js`, `src/plugin.js`, `src/cards-settings.js`). `previewAnkiSync` returns a read-only plan of creates, updates, pulls, conflicts, Anki-side missing notes and opt-in local deletions; the sync modal shows that plan before Apply. Markdown, math and code are converted to Anki HTML, referenced images/audio are uploaded with `storeMediaFile`, folder decks are opt-in, and the existing two-way push/pull/conflict merge preserves local history and Notes. The deletion index is opt-in, says when a move can count as a deletion, and is applied only after the previewed sync is confirmed. Covered by 15 tests in `tests/anki-connect.test.js` when it shipped; row 9 raises that file to 17 tests.

**Previously (1.132.0):** step 9 queue row 7 adds **custom-prompt flashcard generation** (`src/card-generator.js`, `src/card-generator-modal.js`). The command **Generate flashcards from this note or selection** uses the editor selection when present, otherwise the open note; it accepts an optional custom instruction and 1–20 cards, and remembers every choice in `settings.cardGenerator`. It supports inline (`::`) and multiline (`---`) separators plus an optional `%%` wrapper that hides an inserted block in reading view. The default output writes tracked card notes through the existing card importer, with deck, source and AI provenance and AI undo; the optional **Insert into this note** output appends only the formatted block and is explicitly untracked. Cards → Review settings expose the default count, layout and hide choice. Covered by `tests/card-generator.test.js`. **Next in step 9: row 8**, Anki Forge preview, merge and media parity.

**Previously (1.131.0):** step 9 queue row 6 adds **AI quiz generation from notes** (`src/quiz-generator.js`, `src/quiz-generator-modal.js`). The command **Generate quiz questions from notes** lets you choose source folders, 1–20 questions, multiple-choice / select-all / true-false, and any of 22 output languages. It reads only notes in those folders, skips existing question and card notes, caps the source at 12 notes / 18,000 characters, previews every draft with its key, and writes only confirmed items through `createQuickAddQuestions`, so they are ordinary question notes on the existing ladder/FSRS path. The parser accepts single letters, answer sets and True/False, and drops malformed or duplicate items. The last choices are saved in `settings.quizGenerator`. Covered by `tests/quiz-generator.test.js`. Rows 3–5 were partly delivered by whole-note review in 1.130.0; their remaining per-note scheduler and file-explorer indicators are recorded as a gate in §11. **Next in step 9: row 7**, custom-prompt flashcard generation.

**Previously (1.130.0):** step 9 queue items 1 and 2 are implemented. **Inline quiz blocks** (`mcq-quiz`, `src/quiz-block.js`) render in any note with optional `gated: true`, per-option `Why A:` feedback and an optional `ID:` that records through the ordinary `recordAttempt` scheduler. **Whole-note review** (`src/note-review.js`, `src/note-review-modal.js`) adds note sets, `note_review_priority`, a status-bar due count and Again/Hard/Good/Easy ratings through the same `applyAttempt` ladder/FSRS path; question and card notes are excluded, and it is off by default. Both are covered by `tests/quiz-block.test.js` and `tests/note-review.test.js`. **Next in step 9: item 3**, AI generation from chosen notes/folders with type, count and language controls plus saved-question review, then item 4 (Anki sync upgrade) and item 5 (per-deck scheduler choice).

**Previously (1.128.0):** **Quick add questions** turns pasted plain text into one ordinary question note per block, with a preview before anything is written. The owner ranked this as the last unchecked item. `Q:` starts a block; `A.`–`H.` lines are choices; `Answer:`/`Key:` takes a letter, a choice's text or a set such as `A, C`; `Stimulus:`, `Course:`, `Skill:`, `Difficulty:`, `Unit:` and `Test:` are optional, and a block with no choices becomes an SPR note. `src/quick-add.js` is the pure parser and note builder, `src/quick-add-modal.js` is the preview, and `plugin.createQuickAddQuestions` writes the notes into the question folder. Nothing is uploaded, no dependency was added, and the notes carry no AI or import properties.

**Latest completed (1.129.0):** **Export a study bundle** writes every question note and card note, unchanged, into one ZIP with a manifest and README. **Import a study bundle** restores the newest bundle: missing notes are created, identical notes are skipped, and a different existing note is reported as a conflict and never overwritten. Cards stay out while the Cards module is off. History, scheduling state and properties survive; images, audio and PDFs stay in the vault; nothing is uploaded.

**Previously (1.127.0):** Today and the Progress tab show a mastery trend under the scope/window controls, and dashboard embeds put a compact ↑/↓/→ badge and tooltip in the mastery heading. The trend compares the number of mastered questions with the immediately preceding period of the same length (the previous 7 or 30 days), and All time compares the last 7 days with the 7 before. A green/red delta shows the change; when the earlier period has no attempts, the full line says there is nothing to compare instead of implying progress, and the embed omits the badge. Nothing is uploaded and no dependency was added.

**Previously (1.126.0):** Added inline scope and window controls plus an Open progress link to Today.

**Previously (1.121.0):** Added the 7-day mastery window alongside All time and Last 30 days.

**Previously (1.120.0):** Added the all-time / last-30-days selector and its saved `masteryDays` setting.

**Previously (1.119.0):** The Progress tab remembers the course chosen with **Show mastery for**, so reopening the dashboard or restarting Obsidian returns to the same mastery scope. The choice is stored in plugin settings as `masteryScope`; if that course is no longer present, the page falls back to All questions. Nothing is uploaded and no dependency was added.

**Previously (1.118.0):** Insights has a **Progress** tab, also opened by the **Open progress dashboard** command. It shows a daily-goal ring with today's minutes, streak and sessions; this week's accuracy, attempts and study time next to last week; a question-mastery bar and legend (not tried, needs work, developing, strong, mastered); the study heatmap with 4, 8 or 12 week ranges; practice accuracy and logged time per course; and a next-step card for the weakest skill, due and new questions, and cards. Mastery can be switched to one course with a picker, and each band's **Practice** button opens a quick session over exactly those questions. The numbers come from `src/progress.js`, a pure local helper with its own tests. Nothing is uploaded and no dependency was added.

**Previously (1.117.0):** Timed tests have two optional exam controls. **Shuffle answer choices** reorders each multiple-choice question's choices for that test; the saved answer letters still match the note, and the review and restored session keep the same displayed order. **Pass score** sets a percentage threshold shown in the result banner as Passed or Not passed, and it counts objective questions only when a test also includes written responses. Both settings are saved with test defaults, blueprints and a mid-test session, and a blank or 0 pass score means no mark. Nothing is uploaded and no dependency was added.

**Previously (1.116.0):** Cards can be exported as an **Anki package (.apkg)**. The plugin writes a real SQLite collection (col, notes, cards, revlog and graves) and wraps it in a stored ZIP, with decks, tags and Basic, Basic (and reversed), Cloze and multiple-choice notes. MCQ choices stay on the front and the key on the back; cloze markers are preserved. The Cards export dialog, Settings and the export command offer it, and the result warns when a card references images or audio that were not bundled. The writer and reader are local, original code; no SQLite engine, Anki code or dependency is added. Python's SQLite engine reports `integrity_check: ok` for a 1,200-note package, and the round-trip is covered by tests.

**Previously (1.115.0):** Settings, About has an optional **feedback survey**: a rating, what the learner uses the plugin for, free-text strengths and improvements, and a quote permission toggle. **Copy feedback** builds a Markdown summary for the clipboard; nothing is sent, saved to the vault or counted, and there is no telemetry. The form is local-only and every field except the rating is optional.

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

**Earlier shipped:** The Reference panel now ships formulas, constants, unit conversion, a local function plotter and the periodic table (1.26.0). The PDF annotation sidecar shipped in 1.27.0, the welcome guide shipped in 1.28.0, the focus timer/study log shipped in 1.29.0, and the exam-scoped study plan/cram mode shipped in 1.30.0. The visual pen/highlighter overlay shipped in 1.52.0, visual text boxes in 1.53.0 and highlight regions in 1.54.0; form filling and a fuller PDF editor are gated by §11 decision 1. The unofficial AP score calculator shipped in 1.56.0, the link-only AP resource hub in 1.57.0 and saved practice-exam history with trends in 1.58.0, AP resource notes with course/unit tags and stale-link checks in 1.59.0, a next-exam resource recommendation on Today in 1.60.0, and exam-specific resource attachments in 1.61.0, the calendar exam panel showing attached resources with a detach action on Today in 1.62.0, study-block resource attachment in 1.63.0, the class-note resource link in 1.64.0, binding management in Reference in 1.65.0, a read-only study context for the AI assistant in 1.66.0, an undo journal for AI-generated practice notes in 1.67.0, undo for AI course-note summaries in 1.68.0, weak-spot practice generation in 1.69.0, and blind answer verification in 1.70.0. The six-course AP FRQ pilot shipped in 1.97.0 and gained an optional second grading pass and an official/teacher rubric marker in 1.98.0; human-scored calibration is gated by §11 E6. A full JSXGraph geometry/vector-field tool is an optional extension, not a parity row. Audio-only commute mode is gated by §11 decision 2 until TTS provider and mobile support are validated.

**Recently completed (1.78.0):** timed tests now capture confidence per answer and report calibration and average time per answered question alongside the section and skill breakdowns. Previous release 1.77.0 added sections, separate timers and saved blueprints; 1.76.1 published the versioned property schema; 1.76.0 added merge-safe history.

**Latest completed (1.96.1):** mixed-course AP histories now compute the written average and per-section trends only from the latest course, so AP Biology attempts no longer leak into an AP U.S. History summary. 1.96.0 added per-section written trends (SAQ, DBQ and LEQ for APUSH; FRQ for Biology and the other profiles), with the correct “Written” label when a course has more than one written section. 1.95.0 added per-question FRQ history; 1.94.0 added per-course Known snooze defaults; 1.93.0 added Suspend and Bury; 1.92.0 added per-row import reporting and `.apkg` media reporting.

**Plan audit (Oct 29, 2026).** This is the evidence-based status pass over the whole document. A checked item is present in the code and covered by a test or a documented manual gate; a partial item has a working slice but a named gap.

| Area | Actual status | Evidence / remaining gap |
|---|---|---|
| Reference panel (formulas, constants, units, calculator, graph, periodic table, sheets) | **Done** | Data audited against the 2025 AP Chemistry sheet and 2020 AP table; tests cover search, conversion, plotting, the element table and the 1.106.0 unit-circle, trig, codon and Punnett sheets. The graph is a multi-expression Desmos-style list: each row is an expression in x, `y = f(x)`, a reusable `f(x) = …` definition, or an implicit relation such as `y^2 = 2x + 1`; explicit rows are sampled and implicit rows are traced with local marching squares. |
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
| Timed-test choices and pass mark (§5.6, §13.9) | **Done in 1.117.0** | Optional per-test choice shuffling keeps saved letters aligned with the note across the review and a restored session. An optional pass percentage is shown as Passed or Not passed on objective questions; both settings persist in defaults and blueprints. |
| Community directory listing | **Blocked — external review** | The 1.117.0 release is valid and latest, but the official index entry was removed at 22:21 UTC on Oct 29, before that release. The public page remains; the app cannot search it. The exact dashboard errors need the owner's signed-in account, then a fix and re-publish. |
| Course registry (§5.8) | **Done in 1.101.0** | Settings, Calendar, Courses stores name, code, folder, color, semester, instructor and credit weight. A match drives class-note folders and calendar colors; credits feed the GPA when Assignments has no explicit course credit. |
| FRQ math preview and rubric categories (§5.16.6, §5.20.1) | **Done in 1.101.0** | The answer box has a local **Math preview** for math and chemistry notation. Rubric rows accept an optional category tag, infer one from the label when omitted, show it in the grader, and preserve it in generated notes and the AI payload. |
| Concept mastery overlay (§5.14) | **Done in 1.107.0** | Insights → Concepts lists one row per source note, weakest first, with practice accuracy and a colour band; **Reread this** and source backlinks ship since 1.36.0. |
| Exam/quiz import breadth (§5.22.3) | **Done in 1.114.0** | GIFT, Moodle XML, QTI, Mochi Markdown, CrowdAnki, FlashQuiz `@mc`/`@sata`/`@tf`, QuizPort JSON, Markdown checkbox quizzes, zipped Canvas/Blackboard QTI archives and LearnKit blocks/quick cards. |
| Card and question export (§5.15) | **Done in 1.116.0** | Anki text, CSV, Markdown, JSON, Mochi `.mochi` (1.113.0), LearnKit (1.114.0) and a real Anki `.apkg` package (1.116.0). The `.apkg` writer is covered by tests and a SQLite `integrity_check` on a 1,200-note package. |
| LearnKit compatibility (§5.15) | **Done in 1.114.0** | Pipe blocks and quick cards import; groups map to decks/tags; ordered questions import as basic cards, hotspot cards are skipped. Export writes the same block format as a Markdown note. |
| Math/chemistry rendering audit | **Blocked — manual gate** | Renderer and golden tests are done; the remaining visual pass needs a real Obsidian window and cannot be completed in this cloud environment. |
| Mobile audit | **Blocked** | No real iOS/Android device is available in this environment. |
| TTS / audio commute | **Gated** | Provider and mobile validation still missing (§11 decision 2). |
| PDF form filling / full editor | **Gated** | Pen, highlighter, text boxes and highlight regions ship; true AcroForm filling needs an audited MIT PDF library (§11 decision 1) and is not safe to approximate. |
| README, screenshots, sample vault, license confirmation | **Partial — screenshots blocked** | README, NOTICES, `docs/license-audit.md` and `samples/sample-vault` exist. Screenshots still need a real Obsidian window. |

**Whole-plan review (Oct 30, 2026, after 1.117.0).** Every checkbox in this document was checked against the code again after the timed-test option shuffle and pass mark shipped. This pass also corrected stale competitor-matrix rows and per-competitor **Has that you don't** lists that still showed shipped question types, pass marks, option shuffling and leech handling as absent. The last unchecked item, lighter multi-question authoring, shipped in 1.128.0. Closed in 1.89.0–1.117.0: the course registry, FRQ rubric categories, Quizlet PDF import with a device picker, the reference sheets, Mochi and LearnKit export, the feedback survey and card/question export. **No implementable partial remains.** The community directory listing is also blocked on the owner's dashboard and automated review. The open `[~]` items are gated on a real Obsidian window (visual pass and screenshots), real iOS/Android hardware (mobile audit), an audited MIT PDF form library, a bundled OCR engine and licence decision, audio capture plus mobile validation (TTS and pronunciation), or human-scored FRQ fixtures; the only named implementation gap is the bundled OCR engine. The concept mastery overlay closed in 1.107.0, fill-in and matching practice closed in 1.112.0, Mochi `.mochi` export closed in 1.113.0, and LearnKit import/export closed in 1.114.0, the in-plugin survey closed in 1.115.0, `.apkg` export closed in 1.116.0 and timed-test choice shuffling and pass marks closed in 1.117.0. Human-scored FRQ calibration remains a quality gate, not an implementation gate. There is now a single status list; the superseded copy is archived.

**Partial review (Oct 29, 2026, 1.104.0).** Every partial marker was re-read after the handwriting work. Closed in this release: photo-of-handwritten-work grading. Still gated with a concrete reason: the real-Obsidian visual/screenshot pass (no Obsidian window here), the mobile audit (no real device), TTS/audio commute (no provider or mobile speech validation), PDF form filling (no audited MIT form-filling library; approximating it would corrupt files), pronunciation feedback (needs audio capture plus mobile validation), and human-scored FRQ calibration (a quality gate, not code). `.apkg` export was open at that time because it needed a tested SQLite writer; it closed in 1.116.0, and reading `.apkg` already works. Also closed in 1.105.0: the Learn, Test and Match study-skin modes. Also closed in 1.106.0: the one-screen reference sheets.

**Dedupe and re-mark (Oct 29, 2026, 1.106.0).** `plan.md` is now one document. The
pre-Oct-27 duplicate, the Gemini brainstorm and Appendix A were moved verbatim to
`docs/archive/plan-brainstorms.md`; the duplicate's §10c and open questions 10–11 were
promoted first, so no unique content was lost. Newly marked partial because a named gap
remains: LearnKit import/export, FRQ human-scored calibration, the bundled OCR engine, the
in-plugin survey form, the concept mastery overlay, exam/quiz import breadth and Mochi and
`.apkg` export. Those last two closed in 1.113.0 and 1.116.0. Items previously marked `[x]` whose own text said something “remains” were
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
- **[Decks](https://github.com/dscherdi/decks)** is **AGPL-3.0** (read from its `LICENSE` on Oct 30, 2026), not MIT as earlier assumed. Reference only: copying its code into this MIT plugin would relicense the whole plugin.
- **[True Recall](https://github.com/pieralukasz/true-recall)** is **PolyForm Strict 1.0.0** (noncommercial, no derivatives) and **[Handwriting](https://github.com/ellimist-afk/handwriting)** is **CC BY-NC-ND 4.0**. Both are source-available, not open source. Read them for ideas; copy nothing.

---

## 3. Source plugin map (where each idea comes from)

Legend: **MIT ✅** = MIT stated on the page or repo seen. **Verify ⚠️** = not confirmed. **Unverified is not permission:** under the §3.10 rule, only MIT, BSD, ISC, 0BSD or (with its `NOTICE` kept) Apache-2.0 code may be integrated. Anything else, and anything unverified, is ideas-only and **must not be integrated**.

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
| **ts-fsrs** (library) | The FSRS implementation LearnKit credits; candidate scheduler dependency | MIT per repo, confirm before adding | [GitHub](https://github.com/open-spaced-repetition/ts-fsrs) |
| **Retain** | Simple `Question::Answer` cards with FSRS; scheduling data kept in plugin data, out of notes | MIT, verified | [community](https://community.obsidian.md/plugins/retain) |
| **Simple Flashcards** | RemNote-style inline syntax, bidirectional and cloze, optional SRS | MIT, verified | [community](https://community.obsidian.md/plugins/simple-flashcards) |
| **Decks** | FSRS flashcards; card formats derived from plain notes | **AGPL-3.0** ⚠️ no reuse (§2.2) | [GitHub](https://github.com/dscherdi/decks) |
| **Flashcards LLM** | AI flashcard generation from notes | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/flashcards-llm) |
| **Auto Anki** | AI card creation for Anki | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/auto-anki) |
| **Yanki** | Sync Markdown flashcards to Anki | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/yanki) |
| **Simple Quiz** | Lightweight quiz creation | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/simple-quiz) |
| **Cornell Marginalia** | Cornell-method notes for students | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/cornell-marginalia) |

### 3.3 Vocabulary and language

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **WordFolio** | Vocabulary as Markdown notes, FSRS state in frontmatter, offline dictionary, send-to-Anki | MIT ✅ | [community](https://community.obsidian.md/plugins/wordfolio) |
| **Dictionary Lexicon** | WordNet lookup, save to vocabulary file, vocab flashcards | MIT ✅ | [community](https://community.obsidian.md/plugins/lexicon-dictionary) |
| **FSRS Vocabulary** | Dictionary-as-note (`fsrs-vocabulary` property), per-word FSRS, image/audio/video question columns, stats code block | MIT, verified | [community](https://community.obsidian.md/plugins/fsrs-vocabulary) |
| **Language Made Easy** | Reading with instant lookup, FSRS flashcards, video shadowing, dictation | **AGPL** ⚠️ do not integrate (§3.10) | [community](https://community.obsidian.md/plugins/language-made-easy) |
| **Obsidian Dictionary** (phibr0) | Multilingual lookup, offline dictionary option, frontmatter `lang` key | **AGPL-3.0** ⚠️ do not integrate (§3.10) | [GitHub](https://github.com/phibr0/obsidian-dictionary) |
| **Zhongwen Reader** | Chinese hover dictionary and vocab building | **AGPL** ⚠️ do not integrate (§3.10) | [Obsidian Stats](https://www.obsidianstats.com/plugins/zhongwen-reader) |

### 3.4 Calendar, courses, assignments, grades

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **Full Calendar** (original) | Events as notes with frontmatter; ICS/CalDAV read-only feeds | MIT ✅ | [GitHub](https://github.com/obsidian-community/obsidian-full-calendar) · [community](https://community.obsidian.md/plugins/obsidian-full-calendar) |
| **Calendar Event Sync** | Link a note to the nearest calendar event via ICS URL | MIT ✅ | [community](https://community.obsidian.md/plugins/calendar-event-sync) |
| **ICS Calendar Viewer** | Read-only local `.ics` viewing, minimal permissions (good privacy model) | MIT ✅ | [community](https://community.obsidian.md/plugins/ics-calendar-viewer) |
| **Tasks** | Task syntax, due/scheduled/recurrence, query blocks; 3.4M downloads | MIT ✅ | [community](https://community.obsidian.md/plugins/obsidian-tasks-plugin) · [GitHub](https://github.com/obsidian-tasks-group/obsidian-tasks) |
| **Task Center** | Built on Tasks syntax: drag tasks between dates, review estimate vs actual | MIT ✅ | [community](https://community.obsidian.md/plugins/task-center) |
| **Hold Course** | Course, lecture, assignment, exam tracking; Today sidebar; global assignments view; grade chips | MIT, verified | [community](https://community.obsidian.md/plugins/hold-course) · [GitHub](https://github.com/LiveAQuietLife/obsidian-hold-course) |
| **Course Command Center** | [GitHub](https://github.com/flippinhutt/CourseCommandCenter) · [Directory](https://community.obsidian.md/plugins/course-command-center) | MIT | **Local parts implemented (unreleased, Oct 31, 2026):** **Course health** checks missing grades, low attendance, overdue course tasks and a close exam, and **Course note templates** create lecture, unit, review, assignment and syllabus notes from editable local templates with course/title/date placeholders. Canvas LMS sync and OAuth remain gated. | Done locally (Canvas gated) |
| **Subject Manager** | Subjects, projects, assignments, exams, grades | MIT, verified | [community](https://community.obsidian.md/plugins/subject-manager) |
| **Verso** (same author as Hold Course) | Reading schedules and pace | MIT, verified | [author page](https://community.obsidian.md/users/liveaquietlife) |

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
| **Heatmap Calendar** | `renderHeatmapCalendar()` for DataviewJS | **Apache-2.0** (keep `NOTICE`) | [GitHub](https://github.com/Richardsl/heatmap-calendar-obsidian) |
| **Contribution Graph** / **Activity Graph** | Heatmaps from Dataview queries | Contribution Graph **Apache-2.0**; Activity Graph ISC-style | [Contribution Graph](https://community.obsidian.md/plugins/contribution-graph) · [Activity Graph](https://community.obsidian.md/plugins/activity-graph) |

### 3.6 Source ingestion: PDFs, transcription, annotation

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **PDF++** | Backlinked PDF highlights and annotations; link to exact PDF locations | MIT ✅ | [GitHub](https://github.com/RyotaUshio/obsidian-pdf-plus) |
| **Whisper** (TfTHacker) | Record and transcribe via Whisper API | MIT ✅ | [GitHub](https://github.com/TfTHacker/whisper-obsidian-plugin) |
| **Audio to Text** | Transcribe linked audio files to new or current notes | MIT ✅ | [GitHub](https://github.com/aaldrich29/Audio-To-Text) |
| **Local Whisper** | Offline transcription via whisper.cpp | MIT ✅ | [GitHub](https://github.com/cdiak/local-whisper) |
| **AI Transcriber** | GPT-4o Transcribe and Whisper for audio/video files | MIT ✅ | [community](https://community.obsidian.md/plugins/ai-transcriber) |
| **AI Audio Transcription and Summary** | Record, chunk, transcribe, summarize (macOS/iOS) | MIT ✅ | [community](https://community.obsidian.md/plugins/ai-audio-transcription-summary) |
| **Lecture Transcriber** | Local Whisper plus study-note generation from several lectures; flagged for process execution | MIT, verified | [community](https://community.obsidian.md/plugins/lecture-transcriber) |
| **Pick Me** | Annotate and ask questions about selections in notes and PDFs; annotations in separate Markdown files | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/pickme) |

### 3.7 Math, chemistry, and physics

Obsidian renders LaTeX natively with MathJax. Forum posts report that the mhchem package (`\ce{...}`) is integrated, while chemfig is not supported. Confirm both in a test vault before relying on them.

| Plugin / tool | What to learn from it | License | Link |
|---|---|---|---|
| **Chem** | Renders SMILES strings in `smiles` code blocks as molecular structures (powered by RDKit); points to a Ketcher editor plugin for drawing structures | MIT, verified | [community](https://community.obsidian.md/plugins/chem) · [Obsidian Stats](https://www.obsidianstats.com/plugins/chem) |
| **Obsidian Ketcher** (named on Chem's page) | In-vault structure editor that produces SMILES | **Apache-2.0** (keep `NOTICE`) | Search "Ketcher" in Obsidian's plugin browser (no direct link confirmed) |
| **Latex Suite** | Fast LaTeX typing via customizable snippets; useful for FRQ answer entry | MIT, verified | Listed on the [Obsidian Stats math tag page](https://obsidianstats.com/tags/math) |
| **Function Plot** | Graph functions inside notes; usable in question stimuli | MIT, verified | Listed on the [Obsidian Stats math tag page](https://obsidianstats.com/tags/math) |
| **Calctex** | Solves LaTeX formulas and shows results inline; a model for computed answers | MIT, verified | Listed on the [Obsidian Stats math tag page](https://obsidianstats.com/tags/math) |
| **Obsidian Math+, Quick LaTeX, Latex Environments, asciimath, matrix** | Assorted math-input helpers | MIT, verified (except `matrix`, not found) | Listed on the [Obsidian Stats math tag page](https://obsidianstats.com/tags/math) |
| **mhchem / MathJax** | Chemical equations via `\ce{}` in standard math blocks | Part of MathJax; verify the license text | See forum threads: [Obsidian for Chemistry](https://forum.obsidian.md/t/obsidian-for-chemistry/33491), [ChemDraw Plugin](https://forum.obsidian.md/t/chemdraw-plugin/61241) |
| **SMILES discussion** | Background on why SMILES is preferred over LaTeX packages for structures | n/a | [forum thread](https://forum.obsidian.md/t/smiles-in-obsidian/35974) |

### 3.8 AI assistants and agents inside Obsidian

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **Copilot** (Logan Yang) | Chat with your vault; runs agents such as OpenCode, Codex, Claude Code per its listing; the model the owner referenced | **AGPL-3.0** ⚠️ do not integrate (§3.10) | [Obsidian Stats](https://www.obsidianstats.com/plugins/copilot) |
| **Agent Client** | Connects agents (Claude Code, Codex, Gemini CLI) via the Agent Client Protocol | **Apache-2.0** (keep `NOTICE`) | [Obsidian Stats](https://www.obsidianstats.com/plugins/agent-client) |
| **Codex Panel** | Codex in a sidebar for the vault | **Apache-2.0** (keep `NOTICE`) | [Obsidian Stats](https://www.obsidianstats.com/plugins/codex-panel) |
| **Gemini Helper** | AI chat, workflow automation, semantic search; desktop and mobile | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/gemini-helper) |
| **LLM Hub** | Chat, workflow automation, semantic search with several providers and CLI backends | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/llm-hub) |
| **LearnKit Companion** | Study-focused assistant built into LearnKit: ask about a note, generate cards and tests, rewrite notes (MIT) | MIT ✅ | [LearnKit](https://github.com/ctrlaltwill/learnkit) |
| **MCQ Tracker's own tutor** | Existing BYOK and OpenCode integration, tutor vs agent mode | MIT ✅ | [community](https://community.obsidian.md/plugins/mcq-tracker) |

### 3.9 Similar-plugin scan, Oct 30, 2026

**Status: research input only. Nothing here is scheduled.** Mission step 8's verified audit and ordered step-9 queue are in §3.9.1. `AGENTS.md` still holds: the only named implementation gap is lighter multi-question authoring, and any new scope waits for the owner to rank it. This pass searched the community directory, Obsidian Stats and GitHub on Oct 30, 2026 for plugins that did not already appear in §3 or §13. Licenses marked **verified** were read from the repository's own `LICENSE` file on that date; the rest came from a README or listing and still need the repo's `LICENSE` opened before any code is reused. Download counts could not be read reliably, so none are quoted.

#### Quiz and exam engines

| Plugin | What to take | License | Link |
|---|---|---|---|
| **Qard** (`qard`) | Exam **Plans**: declare an exam, pick decks/topics, then track *coverage* rather than only due counts, launch a practice test from the plan, and see exams plus revision on a monthly calendar. Also a **Needs fixing** filter (cards failed across five study days get flagged, and "Mark fixed" opens a new window without deleting history) and FSRS self-fitting after about 400 ratings. | MIT, verified | [GitHub](https://github.com/kylianmarceau/qard-obsidian) · [Stats](https://www.obsidianstats.com/plugins/qard) |
| **Quiz maker** (`quiz-maker`) | One question bank driving five modes (Practice, Timed, Exam, Flashcards, Review of missed/bookmarked/due), **study packs** that preset the mix, difficulty and timing, and a wide question-format set including assertion-and-reason, error correction, evidence selection and branching scenarios. | MIT, verified | [GitHub](https://github.com/Abenovv/quiz-maker-obsidian-edition) · [Stats](https://www.obsidianstats.com/plugins/quiz-maker) |
| **Quizzable** (`quizzable`) | **Define once, play anywhere**: a `quiz` block holds the definition and a `playable-quiz` block with `id:` replays it elsewhere. Partial credit for multi-select and matching with a wrong-pick penalty, a reorder type, numeric-with-tolerance, and an optional `quizResults:` frontmatter export so Dataview or Meta Bind can build the dashboard without the plugin owning analytics. **The result export shipped in 1.158.0, the reorder type in 1.159.0, typed numeric questions in 1.160.0, and shared-option questions in 1.161.0.** | MIT, verified | [GitHub](https://github.com/monapdx/Quizzable) |
| **Quiz Blocks** (`quiz-blocks`) | `gated: true` **closed-book mode**, where the surrounding note is hidden until the quiz is finished, which stops answer-peeking. Per-option feedback and the shared-option-set `choice` type already ship here. | MIT, verified | [GitHub](https://github.com/xamgore/obsidian-quiz-blocks) |
| **Better Recall** (`better-recall`) | **Per-deck algorithm choice** (classic SM-2 or FSRS) with per-deck timing parameters, so a user migrates gradually instead of being forced onto one scheduler. | MIT, verified | [GitHub](https://github.com/FlorianWoelki/obsidian-better-recall) |
| **True Recall** (`true-recall`) | Typed answers graded by a **diff-based checker that needs no AI**, alongside AI teacher-style grading; concurrent multi-device reviews merged by replaying the review log through FSRS. Ideas only. | **PolyForm Strict 1.0.0**, no reuse | [GitHub](https://github.com/pieralukasz/true-recall) |
| **Smart Question Tutor** (`smart-quiz-tutor`) | Reads a whole past paper and **preserves the existing answer key**, generating only missing answers; also exports an **answer-free version** for self-testing. | 0BSD, verified | [GitHub](https://github.com/xxinjie21/Smart-Quiz-Tutor) |

#### Student workflow: timetable, courses, exam countdown

| Plugin | What to take | License | Link |
|---|---|---|---|
| **Class Timetable** (`class-timetable`) | Timetable-first rather than calendar-event-first: semester start and end, odd/even weeks, reading weeks, per-day cancellations, classes that run only part of term, and "start a new semester" that stamps `semester:` without moving files. Paste-a-timetable parser, `.ics` **import and export**, PNG export of the week, and *all state in note frontmatter* (`schedule:`, `exam:`, `due:`, `todo:`, `checked:`), so renames and hand-edited YAML cannot break it. **Term dates, week numbers and reading weeks shipped in 1.162.0; odd/even parity is §11 item 16.** | MIT, verified | [GitHub](https://github.com/elliott-json-park/obsidian-class-timetable) |
| **Study Vault** (`study-vault`) | The **"days until exam + % topics mastered"** pair as one progress widget, computed by counting mastered notes against a course's declared topic count. A two-number health check that reads better than a bare percentage bar. **Verified-satisfied after 1.162.0:** the existing exam plan returns `daysLeft` plus `topics`, and Today and Insights render both in one card; the Insights case now has a focused test. | MIT, verified | [GitHub](https://github.com/wesswart77/obsidian-study-vault) |
| **Homework Manager** (`homework-manager`) | Subject-scoped task lists where every task **links to a note**, so the tracker never becomes a second inbox. | **AGPL** ⚠️ do not integrate (§3.10) | [GitHub](https://github.com/kadisonm/obsidian-homework-plugin) |

#### AI study and error diagnosis

| Plugin | What to take | License | Link |
|---|---|---|---|
| **Claude Tutor** (`claude-tutor`) | The miss loop worth copying: wrong answer, then a **named misconception**, a micro-lesson, and a fresh check question on the same concept, logged so later quizzes deliberately re-target it. It also treats **jargon** as its own gap category beside missing and wrong, and flags low-confidence answers separately. | MIT, verified | [GitHub](https://github.com/wanikhawar/claude-tutor) |
| **AI Study Buddy** (`claudian-api`) | Study *modes as prompts over the same material*: `/predict` for likely exam focus points, `/mock` for a full paper, plus `/feynman`, `/quiz` and `/gap`. Generated cards route into subject and topic folders so scheduling and stats segment per subject. | MIT, verified | [GitHub](https://github.com/virbird/LLM_Private_Teacher) |
| **A-Level Study Coach** (`alevel-study-coach`) | **Error log to review sheet**: one click compiles every due item into a printable offline practice sheet with the original mistake prefilled. Also a "think-first" timer that blocks sending to the assistant before a threshold. **Review sheet shipped in 1.163.0; think-first timer implemented unreleased in §11 item 17.** | MIT, verified | [GitHub](https://github.com/virbird/Alevel-study) · [Stats](https://www.obsidianstats.com/plugins/alevel-study-coach) |

#### Audio capture and handwriting

| Plugin | What to take | License | Link |
|---|---|---|---|
| **Transcriber and Summary for Idiots** (`lecture-transcriber`) | **Many lectures to one study note**, scoped by Today / This week / Last two weeks, with an overview, key concepts and a **vocabulary table**; explicitly allowed to explain beyond the transcript but forbidden from inventing deadlines or what is on the exam. Offline Whisper plus a local Ollama model. | MIT, verified | [GitHub](https://github.com/AbyssLotus/obsidian-lecture-transcriber) |
| **Advanced Audio Recorder** (`advanced-audio-recorder`) | **Bookmarks and chapters with copyable `[12:41]` timestamp links** as first-class note objects, so the one useful minute of a lecture is reachable without reading a full transcript. | MIT, verified | [GitHub](https://github.com/akhmialeuski/advanced-audio-recorder) |
| **Aloud TTS** (`aloud-tts`) | **Sentence-level highlight synced to playback**, with cached audio in the vault and OS media controls: the missing piece for a listen-and-answer audio review mode. | MIT, verified (`LICENSE.txt`) | [GitHub](https://github.com/adrianlyjak/obsidian-aloud-tts) |
| **Voice Briefing** (`voice-briefing`) | A fixed **90-second spoken briefing** per note, style-parameterized (Metaphorical, **Feynman**, News Anchor). The Feynman style forces teaching rather than summarizing, which suits a commute review unit. | MIT, verified | [GitHub](https://github.com/reallygood83/voice-note-obsidian) |
| **Handwriting** (`handwriting`) | Ink stored in sidecar JSON under `.handwriting/` and linked by **one frontmatter key**, so the note stays a pure `.md` and disabling the plugin leaves it untouched. Architecture reference only. | **CC BY-NC-ND 4.0**, no derivatives | [Stats](https://www.obsidianstats.com/plugins/handwriting) |
| **Inkflow** (`inkflow`) | **Portable by default**: always emit a plain PNG embed beside the editable source, so the ink survives the plugin being uninstalled. A good model for a "show your work" math capture. | MIT, verified | [Stats](https://www.obsidianstats.com/plugins/inkflow) |
| **Handwriting and Image to LaTeX** (`handwriting-latex`) | Lasso several attempts on a canvas and recognize **each selection independently** into its own LaTeX candidate, with history restoring both the result and the drawing. | MIT, verified | [GitHub](https://github.com/chongcyrus/handwriting-latex) |

#### Ideas that fit the current design, cheapest first

These were captured on October 28; shipped items are marked. The one remaining policy topic is gated by §11 decision 13 / D4, not unscheduled.

1. **Misconception diagnosis on a miss — gated by §11 decision 13 / D4.** The owner decision keeps the existing error log and mistake taxonomy unchanged. No named-misconception taxonomy, re-check timing, provider fallback or storage field is invented.
2. **Exam coverage — shipped in 1.154.0.** The course registry now has an optional **Total topics** count (0 hides the figure). The exam study plan groups course questions by `skill`, counts a topic as mastered only when every question in it is fully mastered, and adds `mastered / declared topics (%)` to Today and Insights. No declared count means the page is unchanged; readiness, due counts, pools, history and scheduling are untouched. Covered by focused tests in `tests/study-plan.test.js` and `tests/calendar.test.js`.
3. **Answer-free export — shipped in 1.153.0.** The command **Export an answer-free practice sheet** writes `mcq-practice-sheet-YYYY-MM-DD.md` from the current question filter with the stimulus, question, choices or matching prompts and blank answer lines, but no answer key, rationale, source notes or frontmatter. It reuses the existing export/read/write path, never changes a question note, and numbers a colliding filename instead of overwriting it. Covered by 5 focused tests in `tests/practice-sheet.test.js`.
4. **Closed-book gating — shipped in 1.155.0.** Settings, MCQ Tracker, Review gains an off-by-default **Closed-book practice** toggle. While a question is open, it removes the **Open note** shortcut that could reveal the answer; the explanation and source row were already post-submit only. Submitting records an ordinary attempt and reveals the full result screen. The toggle normalizes corrupt saved values to off, survives reload, and changes no attempts, history, streak or scheduling. Covered by 4 focused tests in `tests/closed-book.test.js`.
5. **Per-option explanations.** Each wrong choice gets its own line in the review instead of one shared rationale. Fits the existing choice rendering and helps most on select-all questions.
6. **Daily-quiz streak freeze — shipped in 1.151.0.** One freeze is earned every N completions (default 5, maximum 3), and an available freeze is applied automatically to a missed day when the next daily quiz is completed. The streak survives one gap, a gap larger than the available freezes resets it, and the whole option is off by default. Covered by 6 focused tests in `tests/daily-quiz-freeze.test.js`.
7. **Needs-fixing flag — shipped in 1.152.0.** Questions missed on five distinct calendar days are marked `needs_fixing`; the result screen and **Mark this question fixed** command open a confirmation window that clears the flag, records `needs_fixing_fixed_on` and keeps attempts, history and scheduling. The option is off by default. Covered by 8 focused tests in `tests/needs-fixing.test.js`.
8. **Per-question hints — shipped in 1.156.0.** An optional `## Hint` section or `hint`/`clue` property adds a **Show hint** control before answering; Quick add accepts `Hint:` and `Clue:`. The setting is off by default, persists across restarts, suppresses the control in closed-book practice, and never writes attempts, history or scheduling. Covered by 5 focused tests in `tests/hints.test.js` plus the Quick add hint test.
12. **Inline numeric questions — shipped in 1.160.0.** With the off-by-default **Inline numeric questions** setting, an `mcq-quiz` question can use `Type: numeric`. `Answer:` must be a number, `Tolerance:` is an inclusive ± margin, and optional `Min:` / `Max:` bounds both the input and validation. The value is checked locally by the existing quiz-block scorer; no AI or network call is involved. Other quiz types, attempts, history, streak, next review and Spaced Repetition output are unchanged. Covered by 6 focused tests in `tests/numeric-quiz.test.js`; full suite 915.
13. **Shared-option choice questions — shipped in 1.161.0.** With the off-by-default **Shared-option quiz questions** setting, `A.`–`H.` lines placed before the first `Q:` become one option set shared by every choice question that has no own choices. Each question keeps its own `Answer:` and is graded independently. A question with its own choices keeps them. The setting normalizes corrupt values to off and survives restart; attempts, history, streak, next review and Spaced Repetition output are unchanged. Covered by 5 focused tests in `tests/shared-choice.test.js`; full suite 920.
11. **Inline reorder questions — shipped in 1.159.0.** With the off-by-default **Inline reorder questions** setting, an `mcq-quiz` question can use `Type: reorder`. The normal `A.`–`H.` lines are its items, `Answer:` must list every letter once in the correct order, and ▲/▼ buttons move rows before **Check order**. Grading is exact-sequence only (no partial credit). The item order starts in declaration order; that reading is recorded because Quizzable does not pin a starting order. Other quiz types, attempts, history, streak, next review, Auto Anki, Text2Anki and Spaced Repetition output are unchanged. Covered by 5 focused tests in `tests/reorder.test.js`; full suite 909.
10. **Inline quiz result export — shipped in 1.158.0.** An `mcq-quiz` block may declare `id:`. With the off-by-default **Export inline quiz results** setting, a completed quiz writes `quizResults.<id>` with Quizzable's `score`, `totalPoints`, `percentage` and `passed` fields. Partial quizzes, blocks without an id, and the setting-off path write nothing. It never changes attempts, history, streak, Auto Anki, Text2Anki, Spaced Repetition output or next review. Covered by 5 focused tests in `tests/quiz-results.test.js`; full suite 904.
9. **Exam-ready badge — shipped in 1.157.0.** An opt-in badge maps Omniscient's **Mastered passes** concept onto MCQ's existing consecutive-correct `streak`. The threshold defaults to 2 and is clamped to 1–10; after a result, practice shows **Exam ready · N correct in a row** once reached. It is off by default, writes no new property and leaves attempts, history, next review and every export path unchanged. Covered by 5 focused tests in `tests/exam-ready.test.js`; full suite 899.

**Not proposed in the Oct 30 pass:** a subject-timetable parser stays out. Better Recall's per-deck SM-2 scheduler and inline quiz blocks were ranked then as a large surface for a small gain, but the step-8 mission queue in §3.9.1 reopened both for step 9; inline quiz blocks shipped in 1.130.0 and per-deck SM-2/FSRS choice shipped in 1.138.0. The existing ladder-plus-FSRS choice, the study skin and the `.ics` calendar still cover the current need for every deck that keeps the global scheduler.

### 3.9.1 Mission step 8: MIT-verified related plugins (Oct 30, 2026)

**Status: step 9 complete.** Items 1–28 shipped in 1.130.0–1.151.0 and are marked ✅ below. §5.22.4 item 3 (answer-free export) shipped in 1.153.0; item 2 (exam coverage) shipped in 1.154.0; item 1 is open in §11 item 13. Class Timetable's term calendar shipped in 1.162.0; Study Vault's exam-days/topics widget is verified-satisfied; A-Level Study Coach's review sheet shipped in 1.163.0, and its think-first timer is implemented unreleased (§11 item 17).

**Method (reproducible on this date).**
- `gh search repos "<query>" --limit 20-30 --json fullName,description,stargazersCount,license` for: obsidian spaced repetition, obsidian flashcards, obsidian quiz, obsidian anki, obsidian study, obsidian exam, obsidian flashcard review, obsidian srs, obsidian recall, obsidian incremental writing, obsidian image occlusion, obsidian memory, obsidian review queue, obsidian flashcard generator, obsidian quiz maker, obsidian lecture notes study.
- Added related repositories found in `obsidianmd/obsidian-releases` `community-plugins.json` (9,660 entries, fetched with `gh api repos/obsidianmd/obsidian-releases/contents/community-plugins.json -H "Accept: application/vnd.github.raw"`).
- Read the licence of 41 candidate repositories with `gh api repos/<owner>/<repo>/license --jq '.license.spdx_id'`. Twenty-eight were MIT and are listed here. The other thirteen were GPL-3.0, AGPL-3.0, 0BSD, "Other", or had no licence file; they stay ideas-only under §3.10.
- Confirmed a plugin manifest with `gh api repos/<owner>/<repo>/contents/manifest.json` (26 of the 28 have one) and read feature claims from each README with `gh api repos/<owner>/<repo>/readme -H "Accept: application/vnd.github.raw"`.
- Compared each claimed feature with this plugin by reading `README.md`, §13 and `grep` over `src/` for FSRS, image occlusion, typed answers, AnkiConnect, media upload, status bar, note review, quiz blocks, per-deck scheduling, sliders, YAML cards and CouchDB.

**Limits.** Gaps are README/source claims, not runtime tests of the other plugins. "Missing" means no matching implementation was found here; it is not proof the feature cannot be added. Download counts were not used.

**Ordered step-9 queue: highest value first, cheapest to adapt within a band.**

| # | Plugin | Links | Licence | Features it has that MCQ Tracker lacks |
|---|---|---|---|---|
| 1 ✅ | **Quiz Blocks** | [GitHub](https://github.com/xamgore/obsidian-quiz-blocks) · not in the community index | MIT (`LICENSE` API) | `quiz` fenced blocks rendered inside a note (`radio`, `checkbox`, shared-option `choice`, connected `noodle`); `gated: true` hides the surrounding note until Submit; per-option feedback. |
| 2 ✅ | **Spaced Repetition** | [community](https://community.obsidian.md/plugins/obsidian-spaced-repetition) · [GitHub](https://github.com/st3v3nmw/obsidian-spaced-repetition) | MIT | Whole-note review queue (notes as review items, not only cards or questions); postpone/advance commands (`src/data/data-structures/card/questions/question-postponement-list.ts`); deck tree from hierarchical tags or folders. |
| 3 ✅ | **obsidian-srs** | [GitHub](https://github.com/uygarkurt/obsidian-srs) · not in the community index | MIT | Full-note review; selectable Anki, SM-2 or Leitner algorithm; file-explorer due indicators; status-bar queue count. |
| 4 ✅ | **Recall** | [community](https://community.obsidian.md/plugins/obsidian-recall) · [GitHub](https://github.com/martin-jw/obsidian-recall) | MIT | Note-level review queue; status bar shows the next due date or queue size; modular algorithm choice (Anki/SM-2). |
| 5 ✅ | **Simple Note Review** | [community](https://community.obsidian.md/plugins/simple-note-review) · [GitHub](https://github.com/dartungar/obsidian-simple-note-review) | MIT | Note sets defined by tags, folders, frontmatter or a DataviewJS query; high/normal/low/ignore review frequency per note; persistent, resettable queue. |
| 6 ✅ | **Quiz Generator** | [community](https://community.obsidian.md/plugins/quiz-generator) · [GitHub](https://github.com/ECuiDev/obsidian-quiz-generator) | MIT | Generate from any chosen notes and folders; choose question types and count; 22 output languages; review saved questions or author new ones in the quiz UI; LaTeX notes. |
| 7 ✅ | **Flashcards LLM** | [community](https://community.obsidian.md/plugins/flashcards-llm) · [GitHub](https://github.com/crybot/obsidian-flashcards-llm) | MIT | Generate from a selection or the whole note with a custom prompt and quantity; inline versus multiline separators; hide generated cards in preview; per-command settings. |
| 8 ✅ | **Anki Forge** | [community](https://community.obsidian.md/plugins/anki-forge) · [GitHub](https://github.com/keptan/obsidian-anki) | MIT | Preview every create, update and deletion before it reaches Anki; two-way editing and merge; images, audio, Markdown, math and code; folder-based decks and frontmatter. |
| 9 ✅ | **Awesome Flashcard** | [GitHub](https://github.com/awesomedog/obsidian-awesome-flashcard) · not verified in the community index | MIT | One-way vault-wide Anki sync with full Markdown media (image, audio, video, code, LaTeX, table); vault-wide and file-wide decks and tags; backlink to the source note. |
| 10 ✅ | **Yanki** | [community](https://community.obsidian.md/plugins/yanki) · [GitHub](https://github.com/kitschpatrol/yanki-obsidian) | MIT | Pure Markdown to Anki note typing based on note structure; folder tree becomes the deck tree; no Anki-specific markup in the note. |
| 11 ✅ | **AnkiSync+** | [community](https://community.obsidian.md/plugins/anki-sync-plus) · [GitHub](https://github.com/rochag07/anki-sync-plus) | MIT | Regex omission of matching text; Excalidraw embeds in cards; tag/deck exclusion filters; cleanup of `anki-id` after an Anki-side deletion. |
| 12 ✅ | **Flashcards** | [community](https://community.obsidian.md/plugins/flashcards-obsidian) · [GitHub](https://github.com/reuseman/flashcards-obsidian) | MIT | Anki owns review history while Obsidian owns content; each Anki card links back to its exact source note. |
| 13 ✅ | **Better Recall** | [community](https://community.obsidian.md/plugins/better-recall) · [GitHub](https://github.com/FlorianWoelki/obsidian-better-recall) | MIT | Per-deck choice of SM-2 or FSRS with per-deck timing, so a user can migrate gradually. |
| 14 ✅ | **Flashcard Learning** | [community](https://community.obsidian.md/plugins/flashcard-learning) · [GitHub](https://github.com/gaetanmuck/obsidian-flashcard-learning) | MIT | Multiple reviews in one day; expectation descriptions on each side of a card; adaptive frequency based on how often a card is known. |
| 15 ✅ | **Quizzator** | [GitHub](https://github.com/DrEggdwarf/Obsidian-Quizzator) · not in the community index | MIT | Slider questions; per-question weights; AI free-text evaluation with pass/imprecise/fail bands. |
| 16 ✅ | **iDoRecall** | [community](https://community.obsidian.md/plugins/idorecall) · [GitHub](https://github.com/idorecall/idorecall) | MIT | Recalls anchored to selected source text, reviewed in the source context. |
| 17 ✅ | **Lemma** | [GitHub](https://github.com/Fundaments-Work/Lemma) · not in the community index | MIT | Optional CouchDB sync; guided card and deck creation. Its FSRS, image occlusion, typed answers and cloze already exist here. |
| 18 ✅ | **Simple Quiz** | [community](https://community.obsidian.md/plugins/simple-quiz) · [GitHub](https://github.com/ivankalmar/simple-quiz) | MIT | `quiz` block inside a note; daily streak/quiz-count charts; cards loaded from JSON. Legacy `quizjs` blocks are rejected without execution in 1.164.0. |
| 19 ✅ | **Simple Note Quiz** | [community](https://community.obsidian.md/plugins/simple-note-quiz) · [GitHub](https://github.com/beginner137/Obsidian-simple-note-quiz) | MIT | Turn the open note into a quiz by treating lines ending in `?` as questions and following lines as answers; mark known/unknown. |
| 20 ✅ | **Spaced Everything** | [community](https://community.obsidian.md/plugins/spaced-everything) · [GitHub](https://github.com/zachmueller/spaced-everything) | MIT | Whole-note SuperMemo 2 review with fruitful/unfruitful/ignore ratings; template variables and frontmatter state. |
| 21 ✅ | **Auto Anki** | [community](https://community.obsidian.md/plugins/auto-anki) · [GitHub](https://github.com/cadrianxyz/obsidian-auto-anki) | MIT | One command exports the current note or highlighted text to Anki with AI. |
| 22 ✅ | **text2anki-openai** | [community](https://community.obsidian.md/plugins/text2anki-openai) · [GitHub](https://github.com/manibatra/obsidian-text2anki-openai) | MIT | Selection to OpenAI to Anki one-shot card creation. |
| 23 ✅ | **Flashcard Generator** | [community](https://community.obsidian.md/plugins/flashcard-gen) · [GitHub](https://github.com/chloedia/Obsidian_Quiz_Generator) | MIT | Generate a quiz from a note, validate it, then save it in Spaced Repetition syntax. Implemented in 1.148.0 as a previewed card-generator output plus a whole-note command; saves a `#flashcards` note and imports its cards through the normal card store. |
| 24 ✅ | **Spaced Repetition AI** | [community](https://community.obsidian.md/plugins/spaced-repetition-ai) · [GitHub](https://github.com/ai-learning-tools/obsidian-spaced-repetition-ai) | MIT | FSRS and AI card generation, both already present here in `src/fsrs.js`, `src/cards.js` and `generateCardsFromNote`; verified with no code change. |
| 25 ✅ | **Obsidian Flashcard Plugin** | [GitHub](https://github.com/lukeleppan/obsidian-flashcards) | MIT | The README is one line with no documented feature; verified, nothing to adapt. |
| 26 ✅ | **Obsidian AnkiBridge** | [GitHub](https://github.com/JeppeKlitgaard/ObsidianAnkiBridge) | MIT | External docs reviewed in 1.149.0. Added **Excluded folders**. Existing one-way push, tags, decks, media, cloze, source links and deletion cleanup cover the rest; its note-blueprint parser was not added because MCQ Tracker card notes remain the source of truth. |
| 27 ✅ | **Obsidiflip** | [GitHub](https://github.com/jeffchiou/obsidiflip) | MIT; no root `manifest.json` | Added **Card reveal animation** under Settings, Cards, Review: Instant (default), Fade in or Flip. The class is applied once to the existing answer after Show answer or a typed check, so a re-render never replays it; reduced motion and browsers without CSS transitions fall back to instant. Styling only: no note format or scheduler change. |
| 28 ✅ | **Review Notes** | [GitHub](https://github.com/tjandy98/obsidian-review-notes-plugin) | MIT | Verified-satisfied in 1.151.0: periodic whole-note review already exists in `src/note-review.js` (`buildNoteQueue`), `src/note-review-modal.js` and `plugin.getNoteQueue`/`recordNoteReview`, with note sets, priority, due/new filtering, a status-bar count and `tests/note-review.test.js`. The upstream README actually describes a recently created/updated file list, not periodic review; that non-study view was not duplicated. |

**Step-9 progress — complete.** Rows 1–28 shipped in 1.130.0–1.151.0: inline quiz blocks now include choice, slider and text questions, per-question weights and pass/imprecise/fail bands; plus whole-note review, AI generation, Anki parity, content authority, per-deck/per-note scheduling, file-explorer markers and source-anchored recalls, plus guided card/deck creation, optional CouchDB review-state sync, Simple Quiz blocks, Simple Note Quiz, Text2Anki, Spaced Everything, Auto Anki, Spaced Repetition quiz notes, Anki folder exclusions, the opt-in card reveal animation and the optional daily-quiz streak freeze. Row 28 was verified-satisfied against the existing whole-note queue. **A-Level Study Coach's error-log review sheet shipped in 1.163.0; its think-first timer is implemented unreleased (§11 item 17). No fully specified step-9 row remains.** Class Timetable's term calendar shipped in 1.162.0 (odd/even parity is §11 item 16), Study Vault's exam-days/topics widget is verified-satisfied, §5.22.4 item 4 is shipped, and item 1 is open in §11 item 13.

### 3.9.2 Link-dump relevance and licence audit (Oct 30, 2026)

**Status: research only; supersedes the unverified list in §11 item 21.** Every public link in the Oct 30 dump was opened once (HTTP status and page title) or resolved to its repository through `community-plugins.json` (9,701 entries) and the GitHub API. The dump contained 34 community-plugin listings, 21 direct GitHub repository links, one Hugging Face dataset, official and third-party exam-content pages, AI services, and a large amount of unrelated consumer, hardware, media and private material.

**Licence rule.** "MIT" means GitHub reports `license.spdx_id = MIT`; for the 29 plugin listings the repository `LICENSE` was also read, and 28 start with `MIT License` (Ballistics starts with its copyright line but is MIT per the API). Every other result is **NOT MIT**: 0BSD, Apache-2.0, GPL/AGPL, CC-BY-SA, no licence (`NONE`), `NOASSERTION` with a custom or restrictive text, or a closed website or service with no source licence. No licence was inferred from a README badge. No code was copied and no feature was started.

#### Directly relevant to MCQ Tracker

| Link | What it is | Licence | Why relevant |
|---|---|---|---|
| [LearnKit](https://github.com/ctrlaltwill/learnkit) | Obsidian study system: FSRS, flashcards, note review, tests, analytics, TTS | MIT | Closest study-system competitor; its feature gaps are already tracked in §2.1 and §3.9.1. |
| [Adaptive Practice](https://github.com/anupchavan/adaptive-practice) | LLM quizzes from notes and PDFs, skill levels, fluency-aware review | MIT plugin; its Whetstone engine is AGPL, so engine code is not reusable | Direct competitor for adaptive quiz generation and scheduling. |
| [MarginMuse](https://github.com/vic-athens/MarginMuse) | AI vault assistant with MCP, web search and Canvas editing | MIT | AI-assistant surface beyond MCQ's tutor: MCP, web search, Canvas tools. |
| [Jelly](https://github.com/fa3eng/jelly) | Local-first AI chat over notes and PDFs with vault-scoped file tools | MIT | PDF-grounded chat and local extraction that MCQ does not have. |
| [Free AI and Agents](https://github.com/mokelu/free-ai-agents) | Free AI chat plus vault-editing agents in the Obsidian sidebar | MIT | Lowers the bring-your-own-key barrier; agents can create, rewrite, move and tag notes. |
| [Task Hours](https://github.com/mytasklog/task-hours) | Time estimates on Tasks-format lines and an hours-ahead dashboard | MIT | Adjacent to MCQ's time tracking: estimates and workload planning rather than logged study time. |
| [Mathfolio](https://github.com/glaysia/obsidian-mathfolio) | Math worksheet editor and local calculation engine | **NOT MIT** (AGPL-3.0) | Relevant to math practice, but copyleft; ideas only, no code. |
| [Code Runner](https://github.com/chujiu-dev/obsidian-code-runner) | Runs code blocks on desktop and mobile (Pyodide, 18+ languages) | MIT | Relevant to computer-science practice questions that need executable snippets. |
| [Ideaverse Maps](https://github.com/nickmilo/ideaverse-maps) | Interactive vault maps: Emergence, Starfield, Treemap and more | MIT | Vault navigation and review-by-map; not a study scheduler. |
| [Width Wizard](https://github.com/ferhatyurdakul/width-wizard) | Editor line-width control and draggable table-column borders | MIT | Reading and table-authoring quality of life. |
| [Dashboard Gallery](https://github.com/InlitX/Obsidian-Dashboard-Gallery) | Six installable home dashboards built from a note and a CSS snippet | MIT | Dashboard presentation templates; MCQ has one built-in insights view. |
| [obsidian-git](https://github.com/Vinzent03/obsidian-git) | Git version control with auto commit-and-sync, history, diff and conflict views | MIT | Vault backup and version history that MCQ does not provide. |
| [Temperans](https://github.com/Adg0/temperans) | Habit archetypes, annual heat map, API and companion imports | MIT | Adjacent tracking model: avoidance and zero-goal habits, not just study sessions. |
| [Kairos](https://github.com/caasion/kairos) | Time-blocked daily planning inside notes | **NOT MIT** (0BSD) | **Future idea only; not scheduled (§5.22.12).** No Kairos source, styles or copy text may be reused, and 0BSD's Svelte/TypeScript stack is not reusable as-is in this dependency-free plugin. The local **Time blocks** module was ranked and shipped separately in 1.210.1–1.210.2; any further Kairos-derived code, data model or UI is still a future idea gated on the owner ranking it and supplying a spec (§5.22.12). |
| [obsidian-icloud-windows-sync](https://github.com/gursimar/obsidian-icloud-windows-sync) | Syncs and merges a Windows vault with iCloud | **NOT MIT** (no licence) | Vault portability, but no licence means no reuse. |
| [VibeCurb](https://github.com/Yu-369/VibeCurb) | Prompt-skill pipelines with design reads, quality gates and visual diffs | MIT | Relevant to AI output quality, though it is not an Obsidian plugin. |

#### Content, PDF/OCR, providers and host

| Link | What it is | Licence | Why relevant |
|---|---|---|---|
| [MCQ Tracker](https://community.obsidian.md/plugins/mcq-tracker) | This plugin | MIT | Self-reference for the plugin's own listing and feature boundary. |
| [Obsidian](https://obsidian.md/download) | Host application | **NOT MIT** (proprietary) | The platform MCQ runs on; no code reuse. |
| [Knap](https://github.com/obsidianmd/knap) | Template language that turns data into Markdown | MIT | Potential route for importing structured tables into question notes. |
| [Tabula](https://github.com/tabulapdf/tabula-java) | PDF table extraction | MIT | Relevant to question-table extraction, but it is a Java tool, not an embeddable Obsidian dependency. |
| [PyPDF2](https://pypdf2.readthedocs.io/en/3.x/) | Python PDF text extraction | **NOT MIT** (BSD-3-Clause) | Relevant conceptually to PDF import, but Python-only and not usable in this JavaScript plugin. |
| [OnlineOCR](https://www.onlineocr.net/) | Image-to-text OCR service | **NOT MIT** (closed service) | Relevant to scanned-question import; no source licence or offline reuse. |
| [NotebookLM](https://notebooklm.google/) | Source-grounded AI research and study assistant | **NOT MIT** (closed service) | Comparable study workflow; no plugin integration or reusable code. |
| [Groq](https://console.groq.com/keys) | OpenAI-compatible inference provider | **NOT MIT** (service) | A provider option for MCQ's bring-your-own-key AI tutor; service terms, not code. |
| [OpenCode Zen](https://opencode.ai/zen) | Curated model gateway for coding agents | **NOT MIT** (service) | MCQ already integrates OpenCode; this is a provider endpoint, not a feature source. |
| [OER-MCP dataset](https://huggingface.co/datasets/swoopeagle/oer-mcp) | MCP dataset of open educational resources | **NOT MIT** (no licence in the dataset metadata) | Potentially relevant to AI question sourcing, but unlicensed; do not ingest. |
| [PineSAT questions API](https://pinesat.duckdns.org/api/questions) | Live SAT question JSON endpoint tied to OpenSAT | **NOT MIT** (no published terms) | Relevant SAT content, but no licence or terms; do not ingest. |
| [College Board SAT Educator Question Bank](https://satsuiteeducatorquestionbank.collegeboard.org/digital/results) | Official SAT question bank | **NOT MIT** (proprietary content) | Authoritative SAT questions, but the terms restrict copying and redistribution. |
| [AP Central AP Chemistry FRQs](https://apcentral.collegeboard.org/media/pdf/ap25-frq-chemistry.pdf) | Official AP Chemistry free-response questions | **NOT MIT** (copyrighted) | Useful for format study only; content cannot be bundled. |
| [NUM8ERS AP Chemistry FRQs](https://num8ers.com/past-papers/ap-chemistry-frqs/) | Third-party collection of past AP Chemistry FRQs | **NOT MIT** (third-party copies) | Same copyright caution as the official paper. |
| [OpenSAT](https://github.com/Anas099X/OpenSAT) | SAT question database and API | **NOT MIT** (custom restrictions: no forking or derivatives under the name, non-commercial code use) | Question-bank idea only; the licence is not open source. |
| [SAT Math Problem Solver](https://github.com/imbooz1/sat-math-problem-solver) | SAT math solutions and score calculators | MIT | SAT-specific step-by-step solutions and score prediction that MCQ lacks. |
| [SAT Lesson Plan Generator](https://github.com/laurenlliu/sat-lesson-plan-generator) | Generates SAT tutoring lesson plans from score reports | **NOT MIT** (no licence) | Tutoring workflow idea only; no reuse. |
| [SAT Math Lab](https://github.com/echa920/sat-math-lab) | Adaptive SAT math practice, exams and mistake log | **NOT MIT** (no licence) | Direct SAT-practice competitor; no reuse. |
| [SAT-PREP](https://github.com/nakshatra30/SAT-PREP) | AI SAT question-generation pipeline | **NOT MIT** (no licence) | Question-generation idea only; no reuse. |
| [sat-trainer](https://github.com/hummingbirdrhino-png/sat-trainer) | No documented feature; README is the default Vite template | **NOT MIT** (no licence) | Not usable or assessable. |
| [obsidian-releases](https://github.com/obsidianmd/obsidian-releases) | Community plugin index and release metadata | **NOT MIT** (no licence) | Relevant to publishing and the plugin listing, not to a user-facing feature. |
| [Blinko](https://github.com/blinkospace/blinko) | Self-hosted AI note tool | **NOT MIT** (GPL-3.0) | Adjacent AI-notes product, not an Obsidian plugin; ideas only. |

#### Peripheral: science-subject plugins

These are relevant only if MCQ adds science notation or subject-specific rendering; they are not study-workflow features. Licences are recorded so a later step cannot copy an unlicensed source.

| Plugin | Licence | Subject or feature |
|---|---|---|
| [AtomView](https://github.com/dhwan0112/obsidian-atomview) | MIT | 3D atomic structures and MD trajectories |
| [ChemSpec](https://github.com/ruzx/chemspec) | MIT | NMR, FT-IR and analytical spectra |
| [ChemRender](https://github.com/ruzx/chemrender3d) | MIT | 3D molecular structures |
| [ChemSearch](https://github.com/ruzx/ChemSearch) | MIT | Substructure search and inventory |
| [ChemEdit Universal](https://github.com/ruzx/ChemEdit-Universal) | MIT | Draw and edit structures, calculate properties |
| [ChemEdit](https://github.com/ruzx/obsidian-chemedit) | MIT | Display and edit SMILES |
| [Molren](https://github.com/quiachonj/molren) | MIT | SMILES, molfile and reaction rendering |
| [gene-code](https://github.com/neznayer/obsidian-gene-code) | MIT | Gene and variant diagrams |
| [Uncertainty Calc](https://github.com/masoudmim/obsidian-uncertainty-calc) | MIT | Measurement-uncertainty propagation |
| [Sketch Mechanisms](https://github.com/masoudmim/sketch-mechanisms) | MIT | Mechanism animations |
| [Ballistics](https://github.com/jheddings/obsidian-ballistics) | MIT | Ballistics calculations |
| [Science Input Helper](https://github.com/xuxinxi14/science-input-helper) | MIT | Chemical formulas, units, Greek letters and math input |
| [ChemTrails](https://github.com/altarok/chemtrails) | MIT | SMILES to SVG |
| [Reverse Complement](https://github.com/bjornfjohansson/reverse-complement) | **NOT MIT** (0BSD) | DNA reverse complement |
| [TIPA Support](https://github.com/akdemirdeniz/obsidian-tipa) | MIT | Phonetic TIPA notation |
| [Ketcher](https://github.com/yulei-chen/obsidian-ketcher) | **NOT MIT** (Apache-2.0) | Structure and reaction editor |
| [Chemical Structure Renderer](https://github.com/xaya1001/obsidian-Chemical-Structure-Renderer) | MIT | SMILES to PNG or SVG |
| [Periodic Table](https://github.com/r-cramer4/Periodic-Table-Obsidian) | MIT | Periodic table |
| [chem](https://github.com/acylation/obsidian-chem) | MIT | SMILES to chemistry structures |
| [CircuitJS](https://github.com/stevengann/obsidian-circuitjs) | MIT | Circuit simulation |
| [Biosequence](https://github.com/jwreda/obsidian-biosequence) | MIT | Biological sequences |
| [Anatomed](https://github.com/pitfa19/anatomed-obsidian) | **NOT MIT** (CC-BY-SA-4.0) | Interactive 3D anatomy |

#### Checked and not relevant

- **Consumer, hardware, OS and design tools:** `remove.bg` (background removal), `normalbones.com/app` (DICOM library), `shouldiremoveit.com` (Windows bloatware; 403), `pi-hole.net` (network ad blocking), Blackmagic Camera, Raycast, TouchDesigner docs, Google Opinion Rewards, Blip, Affinity, Omarchy and its plugin page, MakerWorld (403), elementary OS, Apple iCloud storage support, the Apple MacBook Air product page, Open Sauce, Spinach, Veg Capital, Grayswan Cygnal, Vanced, Wealth With Rajesh, `rajesh-neupane.github.io`, Higgsfield, B.AI, UnoRouter, TokenRouter, Qoder, WorkBuddy, MongoDB's build-with-AI docs, Nous Research, and the three XDA articles. Public consumer AI chat sites such as `kimi.ai` are closed services too, not integration providers.
- **General note or workspace products:** Notion (closed AI workspace). Blinko is in the table above because it is an AI-notes product, but it is not an Obsidian plugin.
- **Adjacent code with no reusable feature:** `usestrix/strix` (Apache-2.0, AI penetration testing), `freedomofpress/dangerzone` (AGPL-3.0, PDF sanitising desktop app), `garylab/MakeMoneyWithAI` (no licence, AI-income list), and `pseudonymizer-tool` (GPL-3.0, note pseudonymisation; no study feature).
- **Search, media and discussion pages:** the DuckDuckGo result pages, all YouTube videos, the r/ObsidianMD, r/Sat, r/vegan, r/VeganActivism, r/3Dprinting, r/ClaudeAI, r/ChatGPT and r/hacking threads, and the Discord invite. These are discussion or demonstration pages with no repository or licence.
- **Private or non-public URLs (not reproduced):** private Claude, ChatGPT, Gemini, Kimi and Z.ai conversations; iCloud Mail; Instructure course pages; a Scribd upload; a Microsoft SAML sign-in request; a Blip download URL containing an email address; the Obsidian account page; one local `file:///` PDF path; and `chrome://` pages.
- **Not URLs or not public websites:** "SAT", "ideas", "[Folder Name]", and "Obsidian plugin promotions".

#### Implemented from this audit (Oct 30, 2026, unreleased)

- **Task time estimates (Task Hours, MIT).** `src/assignments.js` adds `estimateMinutes`, `estimateFromTask`, `formatEstimate` and `workload`; an assignment stores optional minutes in `estimate` frontmatter and mirrors them as `⏱️ 45m` on its Tasks line. The assignment dialog has an estimate field, and Assignments and Today show today, next-7-days and overdue totals. No code was copied; the implementation is original and dependency-free.
- **Markdown table import (Knap-adjacent).** `src/cards-import.js` adds the `mdtable` source. It reads the first table in a note, reuses the generic CSV header aliases, honours escaped pipes and inline code, converts `<br>` to line breaks, and writes ordinary card notes with `import_format: mdtable` and the usual import key. No Knap code was copied; the parser is original.
- Verification: **942 tests pass**, `npm run check` passes and `main.js` is rebuilt. No version bump and no GitHub release.

### 3.9.3 MIT study-plugin feature-gap matrix (historical, Oct 30, 2026)

**Status: local parity complete.** The Oct 31 W2/W3 labels are historical; every locally implementable row ships and the remaining provider/credential/fixture/security rows cite a §11 decision in §3.9.6. LearnKit FSRS fitting is resolved by the review's request_retention fallback. All 10 W1 rows are implemented (the first slices were inline quiz static answer-key mode and the QuizPort inline player; the rest shipped Oct 30–31, 2026). The local study suite now has thirty-two independent modules: Cornell notes, lecture log, study goals, Feynman Learning, Recall Scheduler, topic planner, Study Flow, Subject Manager, Quiz index, Courses, Tasks, Annotations, Deep Notes, Retention, Vocabulary, Quiz Maker, SFC-style card blocks, CBT exam blocks, the SAT Math solver, Read aloud, the Lecture note compiler, Course health, Audio bookmarks, Feynman AI feedback, the PDF annotation index, Scheduler self-fitting, Study map and Cited vault search, Portable card archive, Study nudge, Course note templates and Reading library. Quizzable-style reusable definitions and partial credit also ship unreleased. Current gates are in §3.9.6; this matrix is historical. Audio, OAuth, OCR, PDF-form and real-device rows are not claimed here.

**Scope.** Included: maintained Obsidian plugins with a root `manifest.json` and a study workflow (questions, recall, cards, courses, reading, audio study, or study AI). Excluded: forks and near-duplicate clones, Claude Code/Codex skills, vault templates, CLI-only tools, generic PKM/layout/Git/habit utilities, non-MIT projects, and the math/PDF rendering tools already listed in §3.10 (they are adjacent tools, not study-workflow gaps). The 28 shipped rows in §3.9.1 remain the implementation record; this table covers residual gaps and repositories not in that table. The matrix is complete for this study scope; it is not a claim that all 9,700 community plugins were read.

**Method.** Fresh `gh search repos` queries for spaced repetition, flashcards, quiz, study, exam, SRS, recall, study planner, course, lecture notes and study timer; the community index; GitHub API licence and `manifest.json` checks; README feature claims; and `rg` probes of this repository for the named feature. Licence means GitHub reported **MIT** on Oct 30, 2026; every row below passed that check. Features are README claims, not runtime tests of the other plugin.

**Rules recorded from the owner.** Research matrix first; ask before implementing an underspecified §11 item; MIT code may be ported with copyright/licence notices; release at milestones, not every batch; implement what can be tested here and mark real-device/audio/PDF/OCR checks blocked.

#### A. Feature matrix — historical

**Historical feature matrix (superseded).** The status column records the Oct 30–31, 2026 snapshot. Current gate/status truth is §3.9.6; W1/W2/W3 labels are historical only. Non-shipped rows cite the relevant §11 decision; LearnKit FSRS fitting is resolved by the review's request_retention fallback and is not a gate.

| Plugin | Links | Licence | Feature it has that MCQ Tracker does not | Historical status / gate |
|---|---|---|---|---|
| **LearnKit** | [GitHub](https://github.com/ctrlaltwill/learnkit) · [Directory](https://community.obsidian.md/plugins/learnkit) | MIT | **Read-aloud ships unreleased (Oct 31, 2026):** the **Read aloud** tab speaks the active note with the device speech voice, highlights the current sentence and supports Full note / 90-second briefing / Key points styles, rate and pitch. **Fitting also ships unreleased (Oct 31, 2026):** the Retention tab fits a desired-retention target from the review counters cards already keep, with a minimum-sample gate, interval buckets and an Apply button. OS media controls and a provider TTS voice remain gated. | Done; provider TTS §11 decision 2 |
| **Qard** | [GitHub](https://github.com/kylianmarceau/qard-obsidian) | MIT | **Implemented (unreleased, Oct 31, 2026):** self-fitting after enough ratings ships with LearnKit's row above — observed recall is bucketed by scheduled interval and a bounded 0.80–0.95 target is suggested; exam coverage and needs-fixing already ship here. | Done |
| **Spaceforge** | [GitHub](https://github.com/dralkh/spaceforge) · [Directory](https://community.obsidian.md/plugins/spaceforge) | MIT | **Implemented locally (unreleased, Nov 1, 2026):** a `study-map` block turns a note or an inline outline into a read-only mind-map tree with key terms and a summary line. The 30-day due forecast and retention statistics already ship in the Retention tab. The Nov 1, 2026 audit in §3.9.7 adds the docked note-review bar, lapse checkpoints, review calendar/workload estimate, Anki-style maturity statistics and local calendar events, all implemented. MDC's AI-vision and legacy-binary import remains gated on a provider and binary fixtures; `.ppsx` text import now ships. The objective tutor remains gated by §11 decision 4 (no approved tutor provider/objective data model); cited web lookup and AnkiWeb are closed offline by §11 decision 5; schedules stay note-backed, so out-of-note central storage is rejected. | Done locally (R1–R4; `.ppsx` in R5); AI vision/provider §11 decision 1/3 |
| **CBT Exam Simulator** | [GitHub](https://github.com/nazdridoy/obsidian-cbt-exam) · [Directory](https://community.obsidian.md/plugins/cbt-exam) | MIT | **Implemented except the VCE converter (unreleased, Oct 31, 2026):** an independent **cbt-exam** block provides a numbered question navigator with answered/flagged/current states, answer flags, a submit score, per-topic breakdown, per-exam sidecar attempt history in plugin data and a missed-first adaptive review pass. The binary `.vce` converter is skipped (no format fixture). | Done; VCE §11 decision 8 |
| **Quizzable** | [GitHub](https://github.com/monapdx/Quizzable) | MIT | **Implemented (unreleased, Oct 31, 2026):** `quiz-definition`/`playable-quiz` reuse and opt-in multi-select partial credit with a configurable wrong-pick penalty. | Done |
| **Quiz Blocks** | [GitHub](https://github.com/xamgore/obsidian-quiz-blocks) | MIT | `gated: true` hides the surrounding note until Submit. Per-option feedback and shared-option choice already ship. **Gated-note behavior shipped unreleased Oct 31, 2026:** the rest of a Reading-view note is hidden until every supported question is answered and restored afterward; static, malformed, unsupported and embedded cases stay visible. | Done |
| **Better Quizbox** | [GitHub](https://github.com/junzi-ana/better-quizbox) · [Directory](https://community.obsidian.md/plugins/better-quizbox) | MIT | Stable block `id` with `bind`/`copy` mirroring now ships (unreleased Oct 31, 2026): `bind` is read-only, `copy` keeps the source mode, ids resolve across the vault and `stem: off` hides the stem. Its static/non-immediate display mode ships as `Mode: static` (unreleased). The favourites panel is still "in development" upstream, so there is no finished feature to port. | Done |
| **Omni Quiz** | [GitHub](https://github.com/pavelpeng7/omni-quiz) · [Directory](https://community.obsidian.md/plugins/omni-quiz) | MIT | **Implemented (unreleased, Oct 31, 2026):** L1–L4 labels, a cross-vault quiz dashboard with question/level/type counts, recorded `quizResults` averages, and an off-by-default per-question attempt log that unlocks first-attempt accuracy, a folder topic index and a wrong-answer index. | Done |
| **Note Quiz Engine** | [GitHub](https://github.com/port22-dev/note-quiz-engine) · [Directory](https://community.obsidian.md/plugins/note-quiz-engine) | MIT | Clipboard import of AI-generated Markdown quizzes now ships (unreleased Oct 31, 2026): fenced `note-quiz` choice/text blocks convert into the existing Quick add preview, with `accepted_answers` for multiple text keys. The Japanese/English generation switch is already covered by the existing AI quiz generator's 22-language selector. | Done |
| **Quiz Maker** | [GitHub](https://github.com/Abenovv/quiz-maker-obsidian-edition) | MIT | **Implemented (unreleased, Oct 31, 2026):** the independent **quiz-maker** block plays named study packs with assertion-and-reason, error-correction, evidence-selection and branching-scenario questions. It is local and records no attempts. | Done |
| **Exam Plugin** | [GitHub](https://github.com/hhtczengjing/obsidian-exam-plugin) · [Directory](https://community.obsidian.md/plugins/obsidian-exam-plugin) | MIT | XML `<exam>` authoring format with answer/analysis cards and study/answer display modes now ships (unreleased Oct 31, 2026): fenced `exam` blocks parse `num`, `source`, `stem`, `options`, `answer` and optional `analysis`, mark the key in Study mode, grade single/multi-select in Answer mode, and render `___` blanks. | Done |
| **QuizPort** | [GitHub](https://github.com/kelleyblackmore/obsidian-quizport) · [Directory](https://community.obsidian.md/plugins/quizport) | MIT | **Implemented (unreleased, Oct 30, 2026):** `quizport` blocks play inline JSON or `file:` quizzes with hint-before, explanation-after, single/multi-select grading, `shuffle: true` and a missed-only retry. Local and read-only: no attempt, history, streak or scheduler writes. | Done |
| **Retain** | [GitHub](https://github.com/sejder/retain) · [Directory](https://community.obsidian.md/plugins/retain) | MIT | **Implemented (unreleased, Oct 31, 2026):** the **Retention** tab scans existing card dates for a read-only 30-day forecast and overdue/new counts, and card review labels each Again/Hard/Good/Easy button with its next interval for ladder, SM-2 and FSRS decks. **Portable archive also ships (unreleased, Oct 31, 2026):** `src/card-archive.js` exports every card note into one versioned JSON file in the vault and restores it with explicit skip/overwrite modes, so cards are not locked inside plugin data. Out-of-note schedules and edited-card history are rejected by the Nov 1 storage decision; the note remains authoritative. | Done (out-of-note migration rejected) |
| **Simple Flashcards** | [GitHub](https://github.com/clancyj11/simple-flashcards) · [Directory](https://community.obsidian.md/plugins/simple-flashcards) | MIT | Block-scoped RemNote `:::` syntax, `>>`/`<<`/`<>` directions and per-block card parsing now ships (unreleased Oct 31, 2026): fenced `simple-flashcards` blocks parse direct child cards, all six delimiters, grouped clozes, multiline answers and optional `#deck/` labels, then reveal one card at a time without scheduling writes. | Done |
| **SFC Flashcards** | [GitHub](https://github.com/mojunbeiming/obsidian-fsrs-flashcards) | MIT | **Implemented (unreleased, Oct 31, 2026):** the independent **sfc-cards** block plays seven typed cards — basic, reversed, cloze, essay, worked solution, wrong-answer sprint and source-marked recall — with local reveals and self-checks. | Done |
| **FSRS Vocabulary** | [GitHub](https://github.com/rokokol/obsidian-fsrs-vocabulary) · [Directory](https://community.obsidian.md/plugins/fsrs-vocabulary) | MIT | **Implemented (unreleased, Oct 31, 2026):** the **Vocabulary** tab adds a searchable dictionary, bulk `term | definition | example | media` import, an optional media column, a local due-date ladder and per-word correctness, streak, lapse and accuracy statistics. | Done |
| **LLM Test Gen** | [GitHub](https://github.com/aldo-g/obsidian-llm-test) | MIT | Any-language generation and runtime model discovery. Any-language generation was already covered by the 22-language quiz generator; runtime model discovery now ships (unreleased Oct 31, 2026): a **Fetch available models** action reads the provider's list, filters non-chat models, persists up to 200 results for the provider/address and offers them in a settings dropdown while keeping free-text model entry. | Done |
| **Cornell Marginalia** | [GitHub](https://github.com/latazadehomero/cornell-marginalia) · [Directory](https://community.obsidian.md/plugins/cornell-marginalia) | MIT | **Margin notes and recall implemented (unreleased, Oct 31, 2026):** a `cornell-note` block accepts optional `Margin:` lines, renders a third margin column, and hides/reveals the margin with the note in recall mode. Explicit `Key term:`, `Term:`, `Concept:`, `Definition:` and `See:` margin notes highlight those terms in the cue and note; automatic NLP tagging is not claimed. | Done |
| **Hold Course** | [GitHub](https://github.com/LiveAQuietLife/obsidian-hold-course) · [Directory](https://community.obsidian.md/plugins/hold-course) | MIT | **Implemented (unreleased, Oct 31, 2026):** the lecture log/bulk add already shipped; the **Courses** tab adds a course dashboard, weighted grade chips, lecture counts and absences. | Done |
| **Course Command Center** | [GitHub](https://github.com/flippinhutt/CourseCommandCenter) · [Directory](https://community.obsidian.md/plugins/course-command-center) | MIT | **Local health checks ship unreleased (Oct 31, 2026):** the **Course health** tab flags missing grades, low attendance, overdue course tasks and an exam inside the configured window with topic passes left, and reports each course as Good, Watch or At risk. Canvas LMS sync and OAuth remain gated on credentials and a provider decision; note-type/template mapping ships through the **Course templates** module. | Done locally (health/templates); Canvas sync §11 decision 6 |
| **Subject Manager** | [GitHub](https://github.com/elouahabi-naoufal/ObsidianSubjectManager) · [Directory](https://community.obsidian.md/plugins/subject-manager) | MIT | **Implemented (unreleased, Oct 31, 2026):** subjects carry local projects with optional due dates and done/reopen state; the tab adds per-subject open/done project counts, next project, attendance from the lecture and absence logs, search across subjects and projects, and a project form. | Done |
| **Verso** | [GitHub](https://github.com/liveaquietlife/obsidian-verso) · [Directory](https://community.obsidian.md/plugins/verso) | MIT | Reading schedules with pace tracking and redistribution when behind now ship (unreleased Oct 31, 2026): a `reading-plan` block parses pages, dates, reading days and off days, spreads the schedule, tracks pages read, redistributes remaining pages after a missed day, clears **Behind** when caught up, and stores progress locally. A passed target becomes **Off pace** with no new schedule. **The library, bookshelf and quote celebration now ship unreleased (Nov 1, 2026):** the **Reading library** tab adds want/reading/finished shelves, page progress, ratings, captured quotes and a finished-today celebration, all local and with no provider call or note write. | Done |
| **Better Task** | [GitHub](https://github.com/st-vin/better-task) · [Directory](https://community.obsidian.md/plugins/better-task) | MIT | **Implemented in-app (unreleased, Oct 31, 2026):** the **Tasks** tab adds manual tasks and generated exam study tasks, and the opt-in **Study nudge** module adds one in-app Notice per day plus a ribbon label naming due questions, cards and tasks, with quiet hours. OS notifications also ship through the opt-in desktop notification path. | Done; OS notifications implemented |
| **Tag Timer** | [GitHub](https://github.com/quantavil/Tag-Timer) · [Directory](https://community.obsidian.md/plugins/tag-timer) | MIT | Inline stopwatch/countdown tags and per-tag analytics now ship (unreleased Oct 31, 2026): a `tag-timer` block declares one Obsidian `#tag` per stopwatch or countdown, persists timestamp-based state locally by note and tag, supports start/pause/stop/reset and background countdown expiry, and groups stopped sessions under **Per-tag analytics** for today, the last seven days and total time. The block does not write notes or the MCQ/card scheduler. | Done |
| **Pick Me** | [GitHub](https://github.com/sxinyuhoo/pickme) · [Directory](https://community.obsidian.md/plugins/pickme) | MIT | **Implemented (unreleased, Oct 31, 2026):** the **Annotations** tab captures the active Markdown selection, question and answer in a local index with source navigation. **PDF annotation indexing ships unreleased (Oct 31, 2026):** the **PDF annotations** tab reads the existing `.annotations.md` sidecars, lists PDF/page/type/color/summary and links back to the PDF or sidecar, read-only. | Done |
| **Whisper** | [GitHub](https://github.com/nikdanilov/whisper-obsidian-plugin) · [Directory](https://community.obsidian.md/plugins/whisper) | MIT | Record/upload audio and transcribe through Whisper-compatible providers. | Not started; §11 decision 2 |
| **Gemini Helper** | [GitHub](https://github.com/takeshy/obsidian-gemini-helper) · [Directory](https://community.obsidian.md/plugins/gemini-helper) | MIT | **Local cited lookup implemented (unreleased, Oct 31, 2026):** a `vault-search` block ranks notes with a local BM25-style index and shows cited snippets. Chat, workflow automation and embedding-based RAG remain gated on a provider decision. | Local lookup shipped; chat/workflow/RAG §11 decision 3 |
| **LLM Hub** | [GitHub](https://github.com/takeshy/obsidian-llm-hub) · [Directory](https://community.obsidian.md/plugins/llm-hub) | MIT | **Local cited lookup implemented (unreleased, Oct 31, 2026):** `vault-search` provides cited local results with no model call, alongside the existing chat providers. Multi-provider chat, workflow automation and CLI backends remain gated. | Local lookup shipped; rest §11 decision 3 |
| **Deep Notes** | [GitHub](https://github.com/aadityaincode/Deep-Notes) · [Directory](https://community.obsidian.md/plugins/deep-notes) | MIT | **Implemented (unreleased, Oct 31, 2026):** the **Deep Notes** tab runs five local Socratic prompts (claim, assumptions, evidence, counterexample, synthesis) with saved answers. No model is called. | Done |
| **Feynman Learning** | [GitHub](https://github.com/jialingxiao/obsidian-feynman-learning) · [Directory](https://community.obsidian.md/plugins/feynman-learning) | MIT | **Implemented locally (unreleased, Oct 31, 2026):** the four-step cycle, manual 3-dimension scoring, a session browser and weak-point drills ship in the Feynman tab. **AI feedback ships unreleased (Oct 31, 2026):** the **AI feedback** tab sends the saved four-step explanation to the user's own configured AI, stores clarity/accuracy/simplicity scores and two sentences beside the manual score, and keeps the manual score when the feedback is cleared. | Done |
| **Lecture Transcriber** | [GitHub](https://github.com/AbyssLotus/obsidian-lecture-transcriber) | MIT | **Note compilation ships unreleased (Oct 31, 2026):** the **Lecture notes** tab turns the local lecture log into one note with an overview, key concepts, a `Term: definition` vocabulary table and one section per lecture, previewed before writing and never overwriting an existing file. Audio recording, local Whisper transcription and AI summaries remain gated. | Compile shipped; audio §11 decision 2 |
| **Advanced Audio Recorder** | [GitHub](https://github.com/akhmialeuski/advanced-audio-recorder) | MIT | **Timestamp bookmarks and chapters ship unreleased (Oct 31, 2026):** the **Bookmarks** tab stores `m:ss`/`h:mm:ss` bookmarks per audio attachment, groups them into numbered chapters and copies an Obsidian media link such as `[[Recordings/lecture.mp3#t=90|Intro]]`. Recording, waveform editing and playback remain gated on audio hardware. | Bookmarks shipped; recording §11 decision 2 |
| **Aloud TTS** | [GitHub](https://github.com/adrianlyjak/obsidian-aloud-tts) | MIT | **Sentence-level highlighting ships unreleased (Oct 31, 2026)** through the **Read aloud** tab, using the device speech voice and a local speaking plan. Cached audio files and OS media controls are not added because they need audio-provider/hardware validation. | Highlight shipped; cached playback §11 decision 2 |
| **Voice Briefing** | [GitHub](https://github.com/reallygood83/voice-note-obsidian) | MIT | **Style presets ship unreleased (Oct 31, 2026):** Read aloud offers a 90-second briefing style plus Key points and Full note, with a spoken-duration estimate and sentence-level highlight. Voice cloning and background audio files remain gated. | Presets shipped; audio file §11 decision 2 |
| **Code Runner** | [GitHub](https://github.com/chujiu-dev/obsidian-code-runner) | MIT | Execute code blocks in notes with Pyodide and 18+ languages. | Not started; §11 decision 12 |
| **SAT Math Problem Solver** | [GitHub](https://github.com/imbooz1/sat-math-problem-solver) | MIT | **Implemented locally (unreleased, Oct 31, 2026):** a `sat-math` block solves linear equations, linear inequalities, quadratics, 2×2 systems, percentages, ratios and two-point line equations with step-by-step working. Score prediction is not estimated because it needs an official curve. | Solver shipped; score prediction §11 decision 8 |
| **Google Classroom Sync** | [GitHub](https://github.com/Nelxson2099/obsidian-google-classroom) · [Directory](https://community.obsidian.md/plugins/google-classroom-sync) | MIT | OAuth course, assignment and announcement sync into Markdown. | Not started; §11 decision 6 |
| **Recall Scheduler** | [GitHub](https://github.com/haibarazz/obsidian-recall-scheduler) · [Directory](https://community.obsidian.md/plugins/recall-scheduler) | MIT | **Implemented (unreleased, Oct 31, 2026):** the Recall tab builds heading and knowledge-fragment queues with due filtering, grading and interval tracking; covered by focused tests. | Done |
| **Lerntracker** | [GitHub](https://github.com/MzaKhn/obsidian-study-plan-plugin) · [Directory](https://community.obsidian.md/plugins/lerntracker) | MIT | **Implemented (unreleased, Oct 31, 2026):** the Topic planner tracks repeated passes, exam dates and buffer days, and shows a day-level allocation with the next study day. | Done |
| **Study Flow** | [GitHub](https://github.com/crown-sports/obsidian-study-flow) · [Directory](https://community.obsidian.md/plugins/study-flow) | MIT | **Implemented (unreleased, Oct 31, 2026):** the Study Flow tab captures source excerpts with an understanding note, card draft and source path, and tracks inbox/review/understood. PDF extraction remains in the existing PDF workflow. | Done |
| **Study Companion** | [GitHub](https://github.com/Zssan12/obsidian-study-companion) · [Directory](https://community.obsidian.md/plugins/study-companion) | MIT | PDF/Markdown chat, directory-based study, offline dictionary and batch courseware explanation. | Not started; §11 decision 3 |
| **FlashCard** | [GitHub](https://github.com/samantaansu2010/flashcard) | MIT | Deterministic note-to-card generation without AI now ships (unreleased Oct 31, 2026): explicit `Question:`/`Answer:` and `Q.`/`A.` pairs, `::`, `→` and `=>` separators, reproducible seed ordering, and an 8-week repeat-review retention panel in Cards. The source note is never rewritten and the scheduler is unchanged. | Done |
| **Quiz Generator** | [GitHub](https://github.com/ECuiDev/obsidian-quiz-generator) · [Directory](https://community.obsidian.md/plugins/quiz-generator) | MIT | **Implemented locally:** the 22-language quiz generator selector ships; a wider provider list needs provider keys and locale validation. | Supported BYOK providers shipped; wider list §11 decision 3 |
| **MarginMuse** | [GitHub](https://github.com/vic-athens/MarginMuse) | MIT | MCP tools, web search and Canvas editing for vault AI. | Not started; §11 decision 3/5 |
| **Jelly** | [GitHub](https://github.com/fa3eng/jelly) | MIT | Local-first PDF-grounded chat and vault-scoped file tools. | Not started; §11 decision 3/5 |
| **Free AI and Agents** | [GitHub](https://github.com/mokelu/free-ai-agents) | MIT | Free AI chat plus vault-editing agents in the sidebar. | Not started; §11 decision 3/5 |

#### B. Covered or no actionable gap

These are MIT-licensed study plugins or built-in features already represented by shipped MCQ Tracker behavior. They stay in the allow-list, but no parity work is proposed.

| Plugin | Links | Licence | Why no separate work |
|---|---|---|---|
| **VaultQuiz** | [GitHub](https://github.com/FilhoRicardo/vaultquiz) · [Directory](https://community.obsidian.md/plugins/vaultquiz) | MIT | Daily quiz, completion streak, freeze, 30-day accuracy, heatmap and optional Markdown log are covered by the daily quiz, streak freeze, Insights and study log. |
| **Adaptive Practice** | [GitHub](https://github.com/anupchavan/adaptive-practice) | MIT | P1–P3 gaps (any-note generation, subtopics, logged don't-know, adaptive sizing, reminder) shipped; its Whetstone engine is AGPL and out of scope. |
| **Task Hours** | [GitHub](https://github.com/mytasklog/task-hours) | MIT | Task estimates and workload totals shipped in the unreleased assignment work. |
| **Star InfoLearn** | [GitHub](https://github.com/starhunt/star-infolearn) | MIT | AI card generation, flashcards, MCQ/cloze/short-answer review and a local dashboard are covered by cards, quiz blocks, AI generation and Insights. |
| **Osteon** | [GitHub](https://github.com/farhadmarzook-commits/osteon) | MIT | FSRS cards, image occlusion, flags, bury/suspend and heatmap are present; no distinct workflow gap found. |
| **Flashcard Studio** | [GitHub](https://github.com/almalkiid/flashcard-studio) · [Directory](https://community.obsidian.md/plugins/flashcard-studio) | MIT | FSRS/SM-2, cloze, MCQ, image occlusion, exams, history and statistics are already represented; its Spaced Repetition file compatibility is not a required migration. |
| **QuizNow** | [GitHub](https://github.com/Luziboo-Code/obsidian-QuizNow) · [Directory](https://community.obsidian.md/plugins/quiznow) | MIT | AI generation, weak spots, four question types and SM-2 exist here; only the four-language UI is distinct. |
| **Study Assist** | [GitHub](https://github.com/ffabbr/obsidian-study-assist) | MIT | PDF highlights, AI card creation, review and annotation export overlap existing PDF annotation, card generation and import. |
| **Obsidian Courses** | [GitHub](https://github.com/bellebasso/obsidian-courses) · [Directory](https://community.obsidian.md/plugins/obsidian-courses) | MIT | Course colors and styled headers are covered by the course registry, class colors and theme support. |
| **Study Dashboard** | [GitHub](https://github.com/kevin-builds/obsidian-study-dashboard) · [Directory](https://community.obsidian.md/plugins/study-dashboard) | MIT | Heatmap, iCal calendar, exam countdown, tasks and review plan are already in Insights, the calendar and Today. |
| **MichaelLing Flashcards** | [GitHub](https://github.com/MichaelLing83/Obsidian-flashcards) | MIT | Folder-configured decks and multiple study modes are covered by plain-Markdown decks and the folder-tree deck option. |
| **Class Timetable** | [GitHub](https://github.com/elliott-json-park/obsidian-class-timetable) | MIT | Term weeks, reading weeks and odd/even ICS parity are implemented; parity uses `X-MCQ-WEEK-PARITY` and remains unreleased. |
| **LearnKit Companion** (inside LearnKit) | [LearnKit](https://github.com/ctrlaltwill/learnkit) · [Stats](https://www.obsidianstats.com/plugins/learnkit) | MIT | Note-grounded Q&A, card/test generation and reviewed note edits are covered by the existing tutor/agent chat, AI generators and agent-edit review. Companion is built into LearnKit, not a separate plugin. |

#### C. Adjacent MIT tools — no study-parity work

| Tool | Link | Why it is not in the study queue |
|---|---|---|
| **SeerAI** | [GitHub](https://github.com/dralkh/seerai) | MIT; Zotero research assistant (RAG, federated scholarly search, systematic review), not an Obsidian study plugin. |
| **Hatch** | [GitHub](https://github.com/dralkh/hatch) | MIT; pixel-art pet generator, not a study tool. |
| **Naqsh** | [GitHub](https://github.com/dralkh/naqsh) | MIT; Arabic calligraphy avatar generator, not a study tool. |
| **Aurora** | [GitHub](https://github.com/dralkh/aurora) | MIT; sleep calculator and reminder app, not an Obsidian study plugin. |
| **Ideaverse Maps** | [GitHub](https://github.com/nickmilo/ideaverse-maps) | Vault navigation/visual maps, not a study workflow. |
| **Width Wizard** | [GitHub](https://github.com/ferhatyurdakul/width-wizard) | Editor width and table-column resizing; presentation utility. |
| **Dashboard Gallery** | [GitHub](https://github.com/InlitX/Obsidian-Dashboard-Gallery) | Dashboard templates, not a scheduler or quiz feature. |
| **obsidian-git** | [GitHub](https://github.com/Vinzent03/obsidian-git) | Vault backup/version history; deployment concern, not study behavior. |
| **Temperans** | [GitHub](https://github.com/Adg0/temperans) | Habit archetypes and annual heat map; adjacent tracking, not exam prep. |
| **VibeCurb** | [GitHub](https://github.com/Yu-369/VibeCurb) | AI prompt-quality tool, not an Obsidian study plugin. |
| **Knap** | [GitHub](https://github.com/obsidianmd/knap) | Template language; the Markdown-table importer already covers the useful path. |
| **Tabula** | [GitHub](https://github.com/tabulapdf/tabula-java) | Java PDF table extractor; cannot be embedded in this dependency-free JavaScript plugin. |

#### D. Historical waves and decision record

**Wave 1 — small, reversible surfaces (historical).** Better Quizbox bind/copy (shipped unreleased Oct 31, 2026) and Quiz Blocks gated note (Better Quizbox's static display mode and Quiz Blocks' per-option feedback are already shipped), Note Quiz clipboard import (shipped unreleased Oct 31, 2026), QuizPort inline player, Exam Plugin XML syntax (shipped unreleased Oct 31, 2026), Simple Flashcards block syntax (shipped unreleased Oct 31, 2026), Verso reading pace (shipped unreleased Oct 31, 2026), Tag Timer inline timers (shipped unreleased Oct 31, 2026), FlashCard deterministic generation (shipped unreleased Oct 31, 2026), LLM Test Gen runtime model discovery (shipped unreleased Oct 31, 2026).

**Wave 2 — medium modules (historical).** LearnKit FSRS-6 parameter fitting (resolved via the review’s request_retention fallback), Qard self-fitting (shipped), CBT navigator/VCE/sidecar history (navigator, history and adaptive review shipped unreleased as `cbt-exam`; VCE converter gated), Omni Quiz first-attempt/wrong-answer/topic indexes (shipped unreleased via the opt-in attempt log), Quiz Maker formats (shipped unreleased as the `quiz-maker` block), SFC card types (shipped unreleased as the `sfc-cards` block), FSRS Vocabulary (dictionary, media columns and per-word statistics shipped unreleased), Cornell Marginalia (margin notes, recall and explicit-term highlighting shipped unreleased), Hold Course lecture log (shipped), Subject Manager (projects, attendance and search shipped unreleased), Better Task goals (manual tasks, in-app reminders and OS notifications shipped), Pick Me annotations (Markdown selection index and PDF annotation index shipped), Deep Notes (five local Socratic prompts shipped), Feynman Learning (four-step cycle, manual scores, browser, weak-point drills and AI feedback shipped), Lecture Transcriber (audio gated), Advanced Audio Recorder (audio gated), SAT Math Problem Solver (local step-by-step solver for linear equations, inequalities, quadratics, 2×2 systems, percentages, ratios and two-point lines shipped; score prediction gated), Recall Scheduler heading/fragment queues (shipped), Lerntracker multi-pass plan (shipped), Study Flow excerpt inbox (shipped), Quiz Generator languages (22 languages shipped; wider providers gated).

**Wave 3 — large or externally gated (historical).** Spaceforge objective tutor (decision 4), cited web lookup/AnkiWeb (decision 5), Course Command Center Canvas sync (decision 6; local health checks ship), Gemini Helper/LLM Hub RAG/workflow (decision 3/5), MarginMuse/Jelly/Free AI Agents MCP/web/PDF chat (decision 3/5), Whisper/Advanced Audio/Lecture Transcriber (decision 2), Aloud/Voice Briefing TTS (decision 2), Code Runner (decision 12), Google Classroom auth (decision 6) and Study Companion (decision 3).

**Historical approval record:** all 10 W1 rows are complete and no wave approval is pending. Quizzable is implemented; Omniscient's minimal keyboard map is implemented unreleased and its full map is rejected; Class Timetable parity is resolved. The remaining rows are gated by the cited §11 decisions, not by another approval wave. No version bump or release is associated with this matrix.

**Implemented from this matrix (unreleased, Oct 31, 2026):** the thirty-two local study modules (Cornell notes, lecture log, study goals, Feynman Learning, Recall Scheduler, topic planner, Study Flow, Subject Manager, Quiz index, Courses, Tasks, Annotations, Deep Notes, Retention, Vocabulary, Quiz Maker, SFC-style card blocks, CBT exam blocks, the SAT Math solver, Read aloud, the Lecture note compiler, Course health, Audio bookmarks, Feynman AI feedback, the PDF annotation index, Scheduler self-fitting, Study map and Cited vault search, Portable card archive, Study nudge, Course note templates and Reading library) and Quizzable define-once/play-anywhere plus opt-in partial credit. Each local module has its own Global → Modules switch; the new workflow view reuses the Study Tools card/tab language and the 700px mobile breakpoint. The Quiz index also gained an off-by-default **Record inline quiz attempts** switch: a completed identified `mcq-quiz` block appends a compact per-question attempt to plugin data (capped at 500), and the index shows first-attempt accuracy, a folder topic index, a wrong-answer index and per-quiz attempt counts without touching the note. Card review now shows a read-only next-interval label for Again/Hard/Good/Easy on ladder, SM-2 and FSRS decks using the same pure scheduler helpers, with no writes. The Vocabulary tab also gained an optional media column and per-word correctness, streak, lapse and accuracy statistics, with media accepted in single adds and bulk import. Subject Manager also gained local projects with due dates and done/reopen controls, per-subject open/done counts, next project, attendance and project search. Cornell notes also gained an optional `Margin:` line and a third margin column that hides and reveals with the note in recall mode; explicit `Key term:`/`Term:`/`Concept:`/`Definition:`/`See:` margin notes highlight those terms in the cue and note. Covered by 55 focused tests across `tests/study-tools.test.js` (7), `tests/study-workspace.test.js` (13), `tests/quiz-block.test.js` (2 Quizzable tests), `tests/quiz-maker.test.js` (3), `tests/sfc-cards.test.js` (4), `tests/cbt-exam.test.js` (4), `tests/quiz-attempts.test.js` (3), `tests/interval-preview.test.js` (3), `tests/vocab-stats.test.js` (4), `tests/subject-projects.test.js` (3) and `tests/cornell-margins.test.js` (3) and `tests/sat-math.test.js` (6); full suite 1095.

**Implemented in this pass (unreleased, Oct 31, 2026):** four more independent local modules, each with a Global → Modules switch and a Study Workspace tab — **Read aloud** (`src/read-aloud.js`; device speech synthesis, sentence-level highlight, three styles, rate/pitch; covers Aloud TTS highlighting, LearnKit read-aloud and Voice Briefing presets), **Lecture note compiler** (`src/lecture-compiler.js`; overview, key concepts, `Term: definition` vocabulary table and per-lecture sections from the lecture log, preview plus non-overwriting save; covers Lecture Transcriber's non-audio part), **Course health** (`src/course-health.js`; missing grades, low attendance, overdue course tasks and a close exam with passes left; covers Course Command Center's offline part) and **Audio bookmarks** (`src/audio-bookmarks.js`; `m:ss`/`h:mm:ss` bookmarks, numbered chapters and copyable media links; covers Advanced Audio Recorder's non-recording part). No provider, key, network request, recording, Canvas login or note rewrite was added, and no third-party source file was copied — only the README feature ideas were adapted. Covered by 10 focused tests in `tests/study-modules-2.test.js`; full suite 1105.

**Historical skipped list (Oct 31, 2026).** Feynman AI feedback, Pick Me PDF annotation indexing, Qard-style desired-retention fitting, the Retain migration and LearnKit FSRS-6 parameter fitting are now shipped or resolved (above; the last uses the review’s `request_retention` fallback with weights fixed). The remaining gates are: CBT `.vce` (proprietary fixture); Lecture Transcriber and Advanced Audio Recorder (decision 2); SAT score prediction (official curve); Quiz Generator wider providers/locales (decision 3); and the remaining external integrations (decisions 2, 3, 5, 6 and 12). No local module is waiting for a wave or a generic “provider” answer.

**Historical owner-question log (Oct 31, 2026).** Resolved rows are removed. Every remaining row cites a §11 gate including LearnKit DSRS fitting, which is resolved by the review’s request_retention fallback; current gates are in §3.9.6.

- LearnKit FSRS-6 parameter fitting — **resolved Nov 1, 2026:** the review’s fallback is per-deck `request_retention` optimization with weights documented as fixed. The shipped fit does exactly that in Scheduler settings; no decay-weight or 21-weight trainer is authorized or claimed.
- CBT `.vce` converter — **gated by §11 decision 8 (proprietary fixture):** may a real `.vce` sample file be supplied, or should the converter be dropped from scope?
- ~~Better Task OS notifications~~ — **resolved Oct 31, 2026:** the owner asked for operating-system permission. `src/os-notifications.js` feature-detects the renderer's Notification API, requests permission only from the explicit **Operating-system notifications** toggle or button, and falls back to the in-app status-bar nudge when the API is missing, the permission is denied or the constructor throws. The body is clamped, nothing is sent over the network, and the once-a-day `freshNudge` guard still applies. Covered by 5 tests in `tests/os-notifications.test.js`; full suite **1148**.
- SAT Math score prediction — **gated by §11 decision 8 (official curve):** which official raw-to-scaled conversion table may be bundled, and for which test dates?
- Quiz Generator wider providers and locales — **gated by §11 decision 3:** which additional providers and locales must be added to the allow-list and validated, and with what test key or fixture?
- Lecture Transcriber audio — **gated by §11 decision 2:** which recording/transcription provider or local Whisper build is approved, and how will microphone and mobile audio be validated?
- Advanced Audio Recorder recording, waveform and playback — **gated by §11 decision 2:** is recording in scope at all, and if so which audio API and storage policy are approved?
- Aloud TTS cached playback and OS media controls — **gated by §11 decision 2:** which TTS voice/provider may be used for cached audio, and is OS media-key integration acceptable?
- Voice Briefing voice cloning and background audio — **gated by §11 decision 2:** is voice cloning acceptable under the privacy policy, or should briefings stay on the device voice?
- Spaceforge objective tutor — **gated by §11 decision 4** (no approved tutor provider or objective data model); the local mind map ships. Cited web lookup and AnkiWeb are **closed offline by §11 decision 5**.
- Course Command Center Canvas LMS sync — **gated by §11 decision 6:** may the plugin hold Canvas OAuth credentials, and which Canvas instance and scopes are approved?
- Whisper / audio transcription — **gated by §11 decision 2:** which transcription endpoint is approved, and may audio leave the device?
- Gemini Helper / LLM Hub chat, workflow automation and semantic search — **gated by §11 decision 3 / decision 5:** which providers and embedding/RAG model are approved, and may the vault be embedded locally or remotely?
- Code Runner execution — **gated by §11 decision 12:** is in-plugin code execution acceptable at all, and if so what sandbox and language allow-list are approved?
- Google Classroom Sync — **gated by §11 decision 6:** may the plugin use a Google OAuth client, and which scopes and client ID owner are approved?
- Study Companion PDF/Markdown chat and directory study — **gated by §11 decision 3:** is directory-wide PDF chat in scope, and which provider handles it?
- MarginMuse / Jelly / Free AI and Agents MCP, web and vault-editing tools — **gated by §11 decision 3 / decision 5:** are vault-editing agents and MCP tools approved, and under what write-confirmation policy?

**Feynman AI feedback and PDF annotation index (unreleased, Oct 31, 2026).** `src/feynman-ai.js` builds a strict rubric prompt from the saved four steps, validates a JSON reply (clamped 1–5 scores plus feedback) and merges it beside the manual score; `src/pdf-annotation-index.js` reads the existing `.annotations.md` sidecars through `parseAnnotationFile` and returns flat rows plus stats and damaged-block issues. Both are separate Global → Modules switches and Study Workspace tabs. Covered by 10 tests in `tests/study-modules-3.test.js`; full suite 1130 after the merge.

**Implemented from this matrix (unreleased, Oct 30, 2026):** `Mode: static` answer-key rendering for `mcq-quiz` blocks, adapted from Better Quizbox's static display concept; optional `Level: L1`–`L4` cognitive labels, adapted from Omni Quiz's cognitive-level concept, with a block default, per-question override, validation, and display in both interactive and static modes. Correct choices are marked, `Why A:` feedback and the `Why:` explanation show, no inputs are created, and no attempt, history, streak, `quizResults` export or scheduling write occurs. `gated:` is ignored in static mode. Per-option feedback was already shipped and is no longer listed as a gap. Focused tests cover the static and level parser/renderer paths. The QuizPort slice adds the inline JSON player (`src/quizport.js`, `src/quizport-view.js`) with 8 focused tests covering parsing, exact-set grading, deterministic shuffle, hints, explanations, file loading and the missed-only retry. The Better Quizbox slice adds stable `Id:` blocks and cross-note `Bind:`/`Copy:` mirrors with `Stem: off`, covered by 5 tests in `tests/quiz-bind.test.js`; the upstream favourites panel is still in development and is not ported. The Note Quiz Engine slice adds a pure `note-quiz` parser and a clipboard command that pre-fills the existing Quick add preview with 7 tests in `tests/note-quiz-clipboard.test.js`. The Exam Plugin slice adds an `exam` block parser and card renderer with study/answer modes, covered by 8 tests in `tests/exam-block.test.js`. The Simple Flashcards slice adds a `simple-flashcards` parser and local reveal reader, covered by 8 tests in `tests/simple-flashcards.test.js`. The Verso slice adds a `reading-plan` parser and scheduler with local progress, covered by 10 tests in `tests/reading-plan.test.js`. The Tag Timer slice adds a `tag-timer` parser, timestamp-based stopwatch/countdown state, local session log and per-tag analytics, covered by 10 tests in `tests/tag-timer.test.js`. The FlashCard slice adds explicit Question/Answer labels and `::`, `→`, `=>` separators to the existing deterministic extractor, an optional reproducible order seed, and an 8-week repeat-review retention panel in Cards, covered by 5 tests in `tests/flashcard-generate.test.js`. The four-module batch above is recorded in the same implementation paragraph set: `tests/study-modules-2.test.js` adds 10 focused tests for read-aloud sentence planning and briefing limits, lecture compilation (concepts, vocabulary, ordering, section toggles, safe titles, non-overwriting save), course health checks and clamping, and audio bookmark parsing, links and chapters; full suite 1105.

### 3.9.4 Sixth MIT parity wave: fitting, study map and cited search (Oct 31, 2026, unreleased)

Three further rows ship as their own Global → Modules switches, alongside the read-aloud, lecture-compiler, course-health and audio-bookmark modules described above. All three are dependency-free and local: no request, model, embedding service or note write.

| Module | Row adapted from | What ships | Switch |
|---|---|---|---|
| **Scheduler fitting** | LearnKit FSRS fitting; Qard self-fitting | Fits `request_retention` per deck from the `attempts`, `correct_count` and `interval` counters cards already keep. Minimum-sample gate (10–500, default 20), observed-recall percentage, five interval buckets, confidence, advice, and Apply/Reset in Settings → MCQ Tracker → Scheduler. The 21 FSRS weights stay fixed at the shipped defaults. | Scheduler fitting |
| **Study map** | Spaceforge mind-map/visualize/summary workspace | A `study-map` block accepts `Source:` (note path), `Title:`, `Depth:` and `Terms:` plus an inline outline. It builds a nested heading/bullet tree, extracts repeated key terms and a summary, and links back to the source note. Read-only. | Study map |
| **Cited vault search** | Gemini Helper and LLM Hub semantic search | A `vault-search` block ranks Markdown notes with a local BM25-style index, honours `Folder:` and `Limit:`, and shows a cited snippet plus an Open note action. No embeddings, model or network. | Vault search |

**Wiring.** New blocks are `study-map` and `vault-search`; the Retention tab gains a Desired-retention fit card when its switch is on. Settings live in `src/scheduler-fit.js`, `src/study-map.js` and `src/vault-search.js`, load through `DEFAULT_SETTINGS`, and `styles.css` adds scoped rules at the existing 700px mobile breakpoint.

**Tests.** `tests/scheduler-fit.test.js` (5), `tests/study-map.test.js` (5) and `tests/vault-search.test.js` (5), plus the updated calendar block-registration list. Full suite **1120 passing**. `npm run check` reports no dynamic code and `main.js` is rebuilt from `src/`.

**Still gated after this wave:** audio recording and transcription (hardware/provider), provider TTS voices, AI tutor scoring and RAG embeddings (provider decision), web lookup and AnkiWeb search (network), Canvas LMS/Google Classroom OAuth, code execution (security), the CBT `.vce` converter (no fixture), SAT score prediction (official curve) and the real-Obsidian visual/mobile audits. Out-of-note card storage is resolved: schedules stay note-backed. **These rows are gated by the recorded §11 decisions:** audio/transcription/TTS (decision 2), tutor/RAG (decision 3), web lookup (decision 5), OAuth (decision 6), code execution (decision 12), `.vce`/SAT curve (decision 8) and the real-window/device checks (E1–E2). No provider question is pending for a local row; the owner asked not to be interrupted, so those rows were skipped and recorded.

### 3.9.5 Eighth MIT parity wave: portable archive and in-app nudge (Oct 31, 2026, unreleased)

Three more rows ship as their own Global → Modules switches. All are local; none deletes a note or requests a permission.

| Module | Row adapted from | What ships | Switch |
|---|---|---|---|
| **Portable card archive** | Retain schedules outside plugin data | `src/card-archive.js` exports every card note's Markdown plus deck/course into one versioned JSON file in the vault (**Cards: export a portable archive**) and restores it with explicit skip or overwrite modes (**Cards: import a portable archive**). Paths are sanitized; other notes are never deleted. | Portable card archive |
| **Study nudge** | Better Task reminders | `src/study-nudge.js` adds one in-app Notice per day and a ribbon label naming due questions, cards and tasks, with a start hour and quiet hours. Off by default. No OS notification permission is requested and no network request is made. | Study nudge |
| **Course note templates** | Course Command Center note-type/template mapping | `src/course-templates.js` maps five note types (lecture, unit, review, assignment, syllabus) to editable templates with `{{course}}`, `{{title}}`, `{{date}}` and `{{type}}` placeholders. **Course notes: create a note from a template** writes a collision-safe note with course frontmatter. No Canvas client or OAuth is involved. | Course note templates |

**Wiring.** New commands `cards-export-archive`, `cards-import-archive`, `study-nudge-show` and `course-note-from-template`; the ribbon label refreshes with the module; settings load through `DEFAULT_SETTINGS`. The PDF annotation index already ships from the parallel wave, so no duplicate PDF module was added.

**Tests.** `tests/card-archive.test.js` (5), `tests/study-nudge.test.js` (4) and `tests/course-templates.test.js` (4). Full suite **1143 passing**; `npm run check` reports no dynamic code across 199 files and `main.js` matches `src/`.

**Owner decisions applied (Nov 1, 2026).** The owner accepted the 17 recommended defaults; the full record is in §11. These rows are now closed as implemented or explicitly gated, not open questions:

- **Audio recording/transcription** — OS keyboard dictation only. Whisper, Lecture Transcriber and Advanced Audio Recorder recording/transcription are gated; no microphone path is claimed.
- **Provider TTS and pronunciation** — not approved. Device speech remains the only voice path; pronunciation feedback is gated on audio capture and mobile validation.
- **Paid AI scoring/RAG** — existing BYOK, user-initiated calls only. No automatic paid scoring, embedding RAG or new model allow-list.
- **Web lookup and AnkiWeb** — offline only; local cited vault search remains.
- **Canvas and Google Classroom** — OAuth skipped; the existing ICS import remains the schedule path.
- **CBT `.vce` and SAT curve** — skipped; no licensed fixture or official curve, so no converter or scaled-score claim.
- **PDF forms and OCR** — no bundled OCR engine or PDF-form library. BYOK vision and annotation-only PDF tools remain.
- **Real Obsidian visual/device checks** — owner manual gates; no pass is claimed in this environment.
- **Central schedules** — stay note-backed; the portable archive is the escape hatch; no migration is performed.
- **Code Runner** — no in-plugin execution, sandbox or language allow-list.
- **Misconception diagnosis** — gated by §11 decision 13 / D4; the existing error log and mistake taxonomy are unchanged.
- **Keyboard-first practice** — minimal Space/Enter plus Esc map implemented unreleased in `src/practice-keys.js` and `src/practice-view.js`; the full 1/2/3/U map is rejected because MCQ auto-grades.
- **Hold Course / uni-calendar** — read-only interop is approved in principle but gated on one sample note from each; ICS remains the supported path.
- **AP FRQ accuracy** — no accuracy claim until human-scored fixtures and go/no-go thresholds exist.
- **AI-generated quiz facts** — keep the preview and label output as needing review; no human spot-check is claimed.
- **Community directory** — remains absent until the owner supplies the dashboard errors; no resubmission.
- **Similarity/licence scan** — required before commercial distribution; not run while the plugin is free.
- **Commercial policy** — free with BYOK and optional donations; no bundled exam content; the import-rights warning stays.
- **STEM renderer cluster** — local chemistry/biology/circuit rendering is implemented unreleased in `src/stem-diagrams.js`; the unlicensed sources remain ideas-only and no code was copied.
- **Qwen preset** — implemented unreleased in `src/api-client.js` with the DashScope OpenAI-compatible endpoint; a live keyed request remains an owner validation step.
- **AnkiConnect and CouchDB live checks** — owner manual gates; no real-server or real-device pass is claimed.

### 3.9.6 Final unimplemented-row audit (Oct 31, 2026, verified at `3f93365`)

**Verified starting state.** Local `HEAD` and `origin/main` were both `3f93365` (`Add local course note templates`) at the start of this pass; `npm test` reported **1143 passing, 0 failing**, `npm run check` reported no dynamic code across **199 files** with `main.js` current, `npm run build` exited 0 and the working tree was clean.

**Class (a) — feasible local work: complete.** The Qwen preset, the minimal Practice keyboard map and the local chemistry/biology/circuit blocks are implemented unreleased. No remaining row can be implemented without a provider, credential, paid API, audio hardware, an external fixture, a bundled third-party engine, a real device/window or a product-policy decision. The thirty-two shipped local modules plus these renderers cover every locally implementable MIT parity row.

**Class (b) — blocked rows, each with its reason and its gate or open question.**

| Blocked row | Why it cannot be implemented here | Gate / open question |
|---|---|---|
| Whisper, Lecture Transcriber and Advanced Audio Recorder recording | Needs a recording/transcription provider or local Whisper build plus microphone and mobile audio validation | §11 decision 2 |
| Aloud TTS, Voice Briefing cached playback and OS media controls | Needs an approved provider voice; the device voice path already ships | §11 decision 2 |
| Pronunciation feedback | Needs audio capture and a speech-scoring service, then mobile validation | §11 decision 2 |
| AI tutor scoring and embedding RAG | Needs an approved paid provider and model allow-list; Feynman AI feedback already ships on the user's existing provider | §11 decision 3 |
| Web lookup, AnkiWeb search and off-device semantic search | Needs an endpoint, citation and rate-limit policy; local cited vault search already ships | §11 decision 5 |
| Canvas LMS sync and Google Classroom OAuth | Needs registered OAuth clients and an owning account | §11 decision 6 |
| CBT `.vce` converter | No public format fixture or specification is available | §11 decision 8 (proprietary data) |
| SAT scaled-score prediction | Needs a licensed official raw-to-scaled curve; the local step-by-step solver already ships | §11 decision 8 (proprietary data) |
| ~~OS notifications~~ | Implemented Oct 31, 2026: opt-in desktop delivery in `src/os-notifications.js`, permission requested only on the explicit toggle or button, in-app nudge unchanged | — |
| PDF form filling, bundled OCR engine, and the OCR-dependent course-note summary and paper-scanner remainder | Needs an audited MIT form library and a permissively licensed OCR engine | §11 decision 1 |
| Real-Obsidian visual/math audit, screenshots and real iOS/Android mobile audit | Needs a real Obsidian window and physical devices | §11 E1–E2 |
| ~~Card schedules fully out of notes plus edited-card history~~ | **Resolved Nov 1, 2026:** schedules stay note-backed; the portable archive is the escape hatch and no migration is performed | — |
| Code Runner in-plugin execution | Needs a security decision and a sandbox/language allow-list | §11 decision 12 |
| Misconception diagnosis on a miss (§11 decision 13 / D4) | The named taxonomy, re-check timing, provider fallback and storage field are unspecified; the owner decision keeps the existing error log and mistake taxonomy unchanged | §11 decision 13 / D4 |
| LearnKit FSRS-6 parameter fitting | Review fallback shipped: per-deck `request_retention` with weights fixed | Resolved Nov 1, 2026; no full 21-weight trainer claimed |
| Quiz Generator wider providers and locales | Needs new provider/model allow-list entries and locale validation; the current BYOK path and 22 languages ship | §11 decision 3 |
| Spaceforge objective tutor | Needs an approved tutor provider and objective data model; the local mind map, review bar and statistics ship | §11 decision 4 |
| Spaceforge cited web lookup and AnkiWeb search | Offline by decision; local cited vault search ships | §11 decision 5 |
| Hold Course / uni-calendar property interop | Needs one sample note per plugin and a read-only-versus-editable scope decision | §11 D5 |
| Live AnkiConnect smoke test and live CouchDB two-device verification | Needs a real Anki desktop, a CouchDB 3.x server and two devices | §11 E7–E8 |
| AP FRQ accuracy claims and human-scored calibration | Needs a human-scored fixture set and go/no-go thresholds | §11 E6 |
| Factual spot-check of AI-generated Spaced Repetition quizzes | Needs an owner review in a real vault; syntax is already validated by round-trip import | §11 E10 |
| Community-directory relisting | Needs the owner's signed-in dashboard error and a resubmission | §11 E11 |
| Similarity/licence scan before distribution | **Gated by §11 O13:** no scan while the plugin is free; a scan must be run and recorded before commercial distribution | §11 O13 |
| Commercial distribution and exam-content import policy | **Resolved by §11 O8:** free, no bundled exam content; keep the import-rights warning | — |
| ~~Omniscient keyboard-first practice shortcuts~~ | **Implemented Nov 1, 2026:** Space/Enter primary action, Esc end; the full 1/2/3/U map is rejected | — |
| ~~Chemistry/biology/circuit rendering cluster~~ | **Implemented Nov 1, 2026:** local `chem`, `biology`/`biosequence` and `circuit` blocks; no third-party code copied | — |
| ~~Qwen provider preset~~ | **Implemented Nov 1, 2026:** DashScope OpenAI-compatible preset with a mocked request contract | — |

**Remaining work is gated or explicitly open.** The 17 recommended defaults are recorded in §11; LearnKit FSRS fitting is resolved by the review's request_retention fallback; no feature row remains open for it. The next change requires a recorded gate or an owner answer, not another local feature guess.

### 3.9.7 Ninth MIT audit: Spaceforge's sibling repositories (Nov 1, 2026)

**Method.** Opened all six `dralkh` repositories and read each root `LICENSE` from `raw.githubusercontent.com` on Nov 1, 2026. All six are MIT; no code was copied. This section records what is new relative to §3.9.3 and §13.2, and classifies each repository instead of adding another module by default.

| Repository | Licence evidence | Kind | Features not in MCQ Tracker | Verdict |
|---|---|---|---|---|
| **Spaceforge** (`dralkh/spaceforge`) | MIT, `LICENSE` read Nov 1, 2026; bundles `ts-fsrs` and `fzstd`, both MIT | Obsidian spaced-repetition and AI study suite | Docked whole-note review bar with per-grade interval previews, keyboard grading, skip/postpone/undo and lapse checkpoints; review-schedule calendar with estimated completion times and add-note/folder-by-link-hierarchy; Anki-style statistics (true retention by maturity, memory-now, interval/ease/stability/difficulty distributions, weekday rhythm, click-through day breakdown, leeches, per-deck summaries); local calendar events with categories and daily/weekly/monthly/yearly recurrence; adaptive objective tutor (explain → recall → apply, per-objective understanding/recall/transfer, two-day durable recall, resume, per-objective conversation, domain awareness, optional cited web lookup, report written back as notes/cards); central data file with a custom path and migration | R1–R4 implemented locally (Nov 1, 2026); the objective tutor is gated by §11 decision 4 and web lookup by §11 decision 5; schedules stay note-backed by decision 10 |
| **MDC** (`dralkh/mdc`) | MIT, `LICENSE` read Nov 1, 2026 | Document → Markdown CLI with an Obsidian plugin | AI vision image-to-text for slide and document images; generated table of contents; attachment/media extraction; batch conversion; minimal-output mode; OpenAI/Gemini/Ollama/Together/OpenRouter parity | Conditional document-import row (R5). `.ppsx` text import now ships alongside `.pptx`, `.pptm`, `.docx`, `.docm`, `.odt` and `.odp`; AI vision and the legacy binary `.ppt`/`.doc` formats remain gated on a provider and binary fixtures. |
| **SeerAI** (`dralkh/seerai`) | MIT, `LICENSE` read Nov 1, 2026 | Zotero research assistant, not an Obsidian plugin | Federated scholarly search across 11 providers; RAG over papers; AI paper-comparison tables; PRISMA-style systematic review; citation export; OCR; cloud storage; MCP/agent tools | Adjacent research workflow, outside the question-first exam scope; record only, no parity work |
| **Hatch** (`dralkh/hatch`) | MIT, `LICENSE` read Nov 1, 2026 | Pixel-art pet generator | None for study | Not relevant; no plan row |
| **Naqsh** (`dralkh/naqsh`) | MIT, `LICENSE` read Nov 1, 2026 | Arabic calligraphy avatar generator | None for study | Not relevant; no plan row |
| **Aurora** (`dralkh/aurora`) | MIT, `LICENSE` read Nov 1, 2026 | Sleep calculator and reminder tray app | Sleep-cycle calculator, bedtime/wake reminders, sleep diary | Not a study tool; no plan row |

**Rows R1–R4 were implemented on Nov 1, 2026 and are UI-reachable.** Each has its own settings module plus a command and ribbon entry point. R5's dependency-free `.ppsx` slice now ships; its AI-vision and legacy binary `.ppt`/`.doc` slices remain gated. The licence section is unchanged.

- **R1 — Docked whole-note review — Implemented.** Move the existing whole-note queue from a modal into an optional bar docked under the note, with Again/Hard/Good/Easy interval previews, 1–4 (ladder/FSRS) or 0–5 (SM-2) keys, skip/postpone/undo and a configurable lapse checkpoint that offers reset, rest for a week, remove from the schedule or carry on. Local; reuses `buildNoteQueue` and the existing schedulers. No new provider. **Where:** `src/note-review-dock.js` (bar, previews, keyboard, snapshot/undo and lapse actions), `src/review-settings.js` (Note review settings module), and `Plugin.recordNoteReview` / `undoNoteReview` / `postponeNoteReview` / `applyNoteLapseAction` in `src/plugin.js`.
- **R2 — Review calendar and workload estimate — Implemented.** Add a read-only calendar of due whole-note and card reviews, a next-7-day workload estimate and an "add this note or folder to review" action; optionally detect a folder's main note by its link graph. Local; reads existing `next_review` data. **Where:** `src/review-calendar.js`, `src/review-calendar-view.js` and the Review calendar settings module; commands `open-review-calendar`, `review-calendar-add-note` and `review-calendar-add-folder`.
- **R3 — Anki-style review statistics — Implemented.** Add true retention by maturity, a memory-now estimate for FSRS cards, interval/ease/stability/difficulty distributions, weekday rhythm, click-through day detail and a leech list to Insights/Retention. Local and read-only. **Where:** `src/study-stats.js` and `src/study-stats-view.js`, with its own Study statistics settings module and `open-study-stats` command/ribbon. It reads existing history and FSRS/SM-2 state; the existing Insights charts are unchanged.
- **R4 — Local calendar events — Implemented.** Add create/edit/delete events with categories, color tabs and daily/weekly/monthly/yearly recurrence, separate from imported `.ics` feeds and Full Calendar notes. Local; never overwrites an imported event. **Where:** `src/local-events.js` (date-only recurrence), `src/local-events-view.js` (CRUD modal and colour tabs), and the Local events settings module; commands `open-local-events` and `new-local-event`. Stored only in plugin data, separate from imported `.ics` feeds and Full Calendar notes.
- **R5 — MDC document-import parity — PARTIAL (Nov 1, 2026).** The dependency-free `.ppsx` text path now ships through the same OOXML slide reader as `.pptx`/`.pptm`; `.ppsx` is recognised by the shared document extension list, course-notes picker, import dialog and slide/page labels. AI vision extraction for slide/document images, an optional generated table of contents, attachment extraction/batch conversion and the legacy binary `.ppt`/`.doc` formats remain gated on an approved AI vision provider and binary fixtures. No source was copied.
- **Gated, not scheduled:** the objective tutor (§11 decision 4) and cited web lookup/AnkiWeb search (§11 decision 5). Central schedule storage is not gated: decision 10 keeps schedules note-backed and rejects a second data path.

**Licence note.** All six repositories are MIT and are added to the §3.10 allow-list. No source file was copied in this audit; the rows above are feature descriptions only.

### 3.9.8 Per-study-tool settings modules (Nov 1, 2026)

**Status: implemented, consolidated and UI-reachable.** The study tools that came from the MIT parity plan no longer share a flat "Global → Modules" list. Each distinct tool has its own Settings module, ordered the way this plan groups them: **Cornell notes**, **Lecture log**, **Study goals**, **Feynman Learning**, **Recall Scheduler**, **Topic planner**, **Study Flow**, **Subject Manager**, **Courses**, **Tasks**, **Annotations**, **Deep Notes**, **Retention**, **Vocabulary**, **Quiz index**, **Quiz Maker blocks**, **SAT math solver**, **CBT exam blocks**, **SFC card blocks**, **Course health**, **Read aloud**, **Lecture notes**, **Audio bookmarks**, **Feynman AI feedback**, **PDF annotations**, **Scheduler fitting**, **Study map**, **Vault search**, **Card archive**, **Study nudge**, **Reading library** and **Course templates**. That is 32 dedicated pages beside Global, MCQ Tracker, Cards, Calendar, Note review, Review calendar, Study statistics, Local events, Pomodoro, Assignments and Reference.

**Global is now an index, not a second set of toggles.** The Global → Modules tab keeps only the core switches (**MCQ Tracker**, **Cards and vocabulary**, **Calendar**, **Assignments** and **Reference**) and the global **AI features** switch. Its **Study tools** section is a compact grid of buttons, one per tool, each showing **On**/**Off** from that tool's own getter and opening its page. No study tool can be enabled from Global any more. `CORE_MODULE_IDS`, `studyToolOverview()` and `renderStudyToolIndex()` in `src/settings-global.js` implement this; `src/settings-tab.js` passes the page-opening callback through to the Global page.

**No persisted setting is lost.** Every existing settings key and normalizer is unchanged, and the Global page only reads getters. A tool that was already disabled stays disabled across the change, keeps its options, and shows **Off** in the index; the focused test seeds `{ cornellNotes: { enabled: false }, recallScheduler: { enabled: false, mode: "fragments", limit: 7 } }`, reloads from saved data, and confirms the other saved state is untouched.

**Page-to-runtime wiring audit.** Each representative page was traced to the code that consumes it. Cornell notes is gated by `cornellNotesEnabled()` in `src/cornell-view.js`; Read aloud's style and rate build the speech plan and its pitch and voice are applied to the utterance; Lecture notes' folder is used by `saveCompiledLectureNote()` and its section flags by `compileLectureNote()`; Quiz index's folder and limit seed the scan and **Record inline quiz attempts** is read by the quiz-block completion path; Study nudge's hour, quiet hours and ribbon flag are read by `nudgeState()`; Course health's thresholds are spread into `courseHealthReport()`; Scheduler fitting's minimum sample gate is passed by `schedulerFitReport()` to `fitRetention()`; Study map's terms/depth, Vault search's limit, PDF annotations' folder/limit, Card archive's folder and Course templates' folder are all read by their existing consumers. One control was genuinely disconnected and is fixed: the Recall Scheduler page wrote `recallScheduler.mode`, but the view hardcoded `"headings"` on construction, so the saved mode was ignored until the user pressed Build queue. `src/study-workspace-view.js` now starts with an empty local mode and falls back to the saved `data.mode`, and a rendering test proves the saved `fragments` mode is the selected option.

**Tests.** `tests/study-tool-settings.test.js` covers every page's presence, enable getter and field round-trip. `tests/settings-consolidation.test.js` renders the Global page, asserts one index button per tool with **On**/**Off** state and a working page link, asserts no study-tool `Setting` remains on Global while the core switches stay, checks persisted disabled state across a reload, and exercises the real consumers for Read aloud, Scheduler fitting, Study nudge, Course health, Lecture notes, Quiz index and the Recall mode fix. The settings-list assertions still derive the study entries from the registry.

**Verification:** **1,221 tests pass**, `npm run check` reports no dynamic code across **216 files** and `main.js` current, and the built bundle is 3,013,638 bytes from 216 modules. No version bump or release was made.

### 3.9.9 Local reading library: Verso bookshelf and quotes (Nov 1, 2026)

**Status: implemented locally and UI-reachable.** The Verso row's remaining local slice — a personal library, shelves and a quote celebration — now ships as the **Reading library** tab and its own Settings → Reading library page. It is an original, dependency-free implementation of the idea recorded from the MIT-licensed Verso plugin, not a copy of its source, and it makes no provider, network, audio or note-write call.

**What it does.** A book has a title, optional author, shelf (`want`, `reading` or `finished`), total pages, current page, rating and dated quotes. The tab shows reading/finished/pages-read/quote counts, a finished-today celebration, an add form, a shelf filter and per-book controls to start, finish, reopen, move back to want, delete, save a page, set a rating and add or remove a quote. Finishing a book marks it complete on the local date and shows a Notice inviting a quote; progress percentages and ratings are clamped and validated. The optional **Hide finished books on the All shelf** setting keeps the main shelf focused; the Finished shelf always shows them.

**Wiring.** `src/reading-library.js` owns the pure model (`createBook`, `normalizeLibrary`, `updateBook`, `removeBook`, `addQuote`, `removeQuote`, `bookProgress`, `librarySummary`, `shelfBooks` and `quoteRows`). `src/constants.js` persists `readingLibrary: { enabled, hideFinished, books }`; `src/plugin.js` loads and normalizes it, exposes `readingLibraryEnabled()` and the add/update/remove/progress/quote mutations, includes it in `studyWorkspaceEnabled()` and registers **Reading library: open the bookshelf**; `src/study-workspace.js` includes it in the workspace normalizer; `src/study-workspace-view.js` renders the tab; and `src/study-tool-settings.js` owns its enable switch, hide-finished option, live status and open action. No study-tool setting is on Global.

**Tests and verification.** `tests/reading-library.test.js` covers model clamping and duplicate rejection, shelf filtering, finish/date/rating transitions, quote add/remove, the finished-today boundary, plugin persistence across a reload, the completion Notice, the settings-page field, the workspace tab and the disabled state. `tests/study-workspace.test.js`, `tests/study-modules-2.test.js` and `tests/study-modules-3.test.js` include the new module in their exhaustive lists. **1,224 tests pass**, `npm run check` is clean across **217 files**, and `main.js` is current at **3,035,545 bytes** from 217 modules. No version bump or release was made.

### 3.9.10 Final row audit after the Nov 1 decision pass

**Result: no locally implementable row is left open.** This audit re-read the status-bearing rows in §3.9.1–§3.9.9, §5, §7 and §11. §3.9.6 is the single current gate table; §3.9.3 is historical. Every checked item is implemented and covered by the suite, and every remaining partial has a named §11 gate or the resolved FSRS fallback. The three local gaps found in this pass were `.ppsx` document import, the STEM-specific default mistake labels, and polynomial expression equivalence. Each now has a focused test: the archive fixture, the defaults check and the numeric-grading equivalence cases.

| Class | Rows | State |
|---|---|---|
| Implemented and verified | Local modules, Markdown blocks, importers, reference tools, schedulers, study plan/cram, focus log, analytics, mobile practice, keyboard map, Qwen preset, STEM renderers and polynomial expression grading | Passing automated tests; no claim is made for real-window or real-device visual checks |
| Implemented unreleased | Qwen, `chem`/`biology`/`biosequence`/`circuit`, the minimal keyboard map, odd/even timetable parity, think-first timer, STEM mistake labels, polynomial expression grading and `.ppsx` text import | Working in the source and bundle; no version bump or release |
| Gated on an owner-owned input | Real Obsidian visual/math/screenshot pass (§11 E1); real iOS/Android hardware (§11 E2); provider TTS/audio/pronunciation (§11 decision 2); bundled OCR/PDF forms (§11 decision 1); proprietary `.vce`/SAT curve data (§11 decision 8); OAuth credentials (§11 decision 6); live AnkiConnect/CouchDB (§11 E7–E8); AP FRQ human calibration (§11 E6); community-directory publishing (§11 E11); AI-generated quiz fact review (§11 E10); MDC AI-vision/binary fixtures (§11 decision 1/3) | Each cites a listed owner input or a recorded §11 decision; no stub is presented as complete |
| Owner policy decisions — exact citations | **Per-objective tutor:** §11 decision 4 (no approved tutor provider or objective data model). **Misconception diagnosis:** §11 decision 13 / D4 (no named taxonomy, re-check contract, provider fallback or storage field). **Commercial similarity scan:** §11 O13 (no scan while free; required before commercial distribution). Product policy is recorded at §11 O1 (name), O4/O5 (mobile), O9 (compatibility), O10 (beta) and O11 (standalone app); O12 (copied-file sign-off) remains an open question with a recommended default, not a recorded acceptance. | Recorded in §11; O12 is open, not a gate; no invented gate. |
| Not started | None | — |

**MIT reference status.** The MIT-licensed related repositories remain listed with links and licence evidence in §3.9.1, §3.9.3, §3.9.7 and §3.10. Their features are adapted into MCQ Tracker's own modules and blocks with focused tests; no third-party source file was copied in this pass, so the attribution obligation is unchanged. The `NOTICES.md` and repository-level licence audit remain the release gate for any future copied code.

### 3.10 Licence allow-list: what may and may not be integrated

**Read this before copying anything.** This section is the source of truth for reuse; the per-row notes in §3.1–§3.9 are commentary on top of it. If an entry here disagrees with a row above, this table wins.

**Status:** a bulk audit on Oct 30, 2026 resolved 72 of the 76 plugin names in this document against `obsidianmd/obsidian-releases` `community-plugins.json`, then read each repository's own `LICENSE` file. Four names could not be found in the directory index and stay blocked (listed at the end).

**§3.9.3 additions:** every repository marked MIT in §3.9.3 was verified through the GitHub API on Oct 30, 2026 and is added to this allow-list. This includes Better Quizbox, Omni Quiz, Exam Plugin, QuizPort, Retain, Simple Flashcards, SFC Flashcards, LLM Test Gen, Cornell Marginalia, Hold Course, Course Command Center, Subject Manager, Verso, Better Task, Tag Timer, Pick Me, Gemini Helper, LLM Hub, Deep Notes, Feynman Learning, and the other rows in that matrix. MIT code may be ported only with its copyright and permission text in `NOTICES.md`; README-only claims still need a source check before copying.

**The rule:**

- **May integrate:** MIT, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD. Keep the copyright line and permission text in `NOTICES.md` and, where practical, in the copied file's header. The README already sets this precedent for the MIT code adapted from University Schedule and Calendar.
- **May integrate with conditions:** Apache-2.0, but carry its `NOTICE` file too and isolate it if the repo must stay purely MIT. For a dual-licensed project, use the MIT option only.
- **Must not integrate, ever:** GPL, AGPL, LGPL, MPL, CC BY-NC, CC BY-NC-ND, PolyForm (any variant), Commons Clause, "all rights reserved", anything proprietary, and anything with no licence file. These may be **read** for ideas. No code, no snippets, no mechanical re-implementations of their algorithms, no vendored bundles. AGPL matters most here: `main.js` is shipped as source, so pasting one AGPL function would put the whole plugin under the AGPL.
- **Unverified is not permission.** A name that is not in this section, or is marked unverified below, is **blocked** until someone opens the licence and records the result.

#### Blocked: confirmed non-permissive. Do not integrate.

| Plugin / component | Licence | Evidence |
|---|---|---|
| **Decks** (`dscherdi/decks`) | AGPL-3.0 | `LICENSE` read |
| **Obsidian Copilot** (`logancyang/obsidian-copilot`) | AGPL-3.0 | `LICENSE` read. Earlier marked "verify". |
| **Obsidian Dictionary** (`phibr0/obsidian-dictionary`) | AGPL-3.0 | `LICENSE` read. Earlier marked "verify". |
| **Language Made Easy** (`pandorareads/language-made-easy-lite`) | AGPL | `LICENSE` read |
| **Zhongwen Reader** (`natipt/obsidian-zhongwen-reader`) | AGPL | `LICENSE` read |
| **Homework Manager** (`kadisonm/obsidian-homework-plugin`) | AGPL | `LICENSE` read. Earlier marked "verify". |
| **True Recall** (`pieralukasz/true-recall`) | PolyForm Strict 1.0.0 | `LICENSE` read. Noncommercial, no derivatives. |
| **Handwriting** (`ellimist-afk/handwriting`) | CC BY-NC-ND 4.0 | Stated in its README. No derivatives. |
| **CQuiz** (`carbon-softlab/CQuiz`) | No licence file | Repository has no `LICENSE`; all rights reserved by default |
| **Mochi Cards Exporter** (`kalibetre/mochi-cards-exporter`) | No licence file | Repository has no `LICENSE`; all rights reserved by default |
| **Whetstone engine** (behind **Adaptive Practice**) | AGPL | Stated on the Adaptive Practice listing. The plugin itself is MIT; the generator it calls is not. |
| **FullCalendar library** (bundled by **Full Calendar Remastered**) | GPLv3 | Stated on that plugin's page. The original **Full Calendar** is MIT and is the safe reference. |
| **Obsidian_to_Anki** | GPL-3.0 | Recorded in §5.22's reuse table |
| **Obsidian Desmos** | GPL-3.0 | Recorded in §5.22's reuse table |
| **Talking Cards** | GPL-3.0 | Recorded in §5.22's reuse table |
| **Cloze** | MPL-2.0 | File-level copyleft; do not copy files |
| **Yiji Study** question bank | CC BY-NC-ND | Non-commercial, no derivatives |
| **ExamForge** | Proprietary | No reuse |
| **Obsidian Scribe** | "MIT with donation request" | Non-standard text; read it in full before any reuse, and prefer an ordinary MIT source |

#### Cleared: MIT, `LICENSE` read from the repository

Core study systems:

| Plugin | Repository | Licence |
|---|---|---|
| MCQ Tracker (this project) | `ifriedenson/mcq-tracker` | MIT |
| Spaceforge | `dralkh/spaceforge` | MIT (`LICENSE` read Nov 1, 2026; bundles ts-fsrs and fzstd, both MIT) |
| MDC (Markdown Document Converter) | `dralkh/mdc` | MIT (`LICENSE` read Nov 1, 2026) |
| SeerAI (Zotero) | `dralkh/seerai` | MIT (`LICENSE` read Nov 1, 2026) |
| Spaced Repetition | `st3v3nmw/obsidian-spaced-repetition` | MIT |
| Obsidian Tutor | `st3v3nmw/obsidian-tutor` | MIT |
| LearnKit | `ctrlaltwill/learnkit` | MIT |
| PDF++ | `RyotaUshio/obsidian-pdf-plus` | MIT |
| Tasks | `obsidian-tasks-group/obsidian-tasks` | MIT |
| Full Calendar (original) | `obsidian-community/obsidian-full-calendar` | MIT |
| VaultQuiz | `FilhoRicardo/vaultquiz` | MIT |
| University Schedule and Calendar | `Cesemess/obsidian-uni-calendar` | MIT |
| Qard | `kylianmarceau/qard-obsidian` | MIT |
| Quiz maker | `Abenovv/quiz-maker-obsidian-edition` | MIT |
| Quizzable | `monapdx/Quizzable` | MIT |
| Quiz Blocks | `xamgore/obsidian-quiz-blocks` | MIT |
| Better Recall | `FlorianWoelki/obsidian-better-recall` | MIT |
| Study Vault | `wesswart77/obsidian-study-vault` | MIT |
| Class Timetable | `elliott-json-park/obsidian-class-timetable` | MIT |
| Claude Tutor | `wanikhawar/claude-tutor` | MIT |

Flashcards and quizzes:

| Plugin | Repository | Licence |
|---|---|---|
| Retain | `sejder/retain` | MIT |
| Simple Flashcards | `clancyj11/simple-flashcards` | MIT |
| Flashcards LLM | `crybot/obsidian-flashcards-llm` | MIT |
| Auto Anki | `cadrianxyz/obsidian-auto-anki` | MIT |
| Yanki | `kitschpatrol/yanki-obsidian` | MIT |
| Simple Quiz | `ivankalmar/simple-quiz` | MIT |
| Cornell Marginalia | `latazadehomero/cornell-marginalia` | MIT |
| Better Quizbox | `junzi-ana/better-quizbox` | MIT |
| Omni Quiz | `pavelpeng7/omni-quiz` | MIT |
| FlashCard | `samantaansu2010/flashcard` | MIT |
| SFC Flashcards | `mojunbeiming/obsidian-fsrs-flashcards` | MIT |
| Star InfoLearn | `starhunt/star-infolearn` | MIT |
| Osteon | `farhadmarzook-commits/osteon` | MIT |
| Flashcard Studio | `almalkiid/flashcard-studio` | MIT |
| LLM Test Gen | `aldo-g/obsidian-llm-test` | MIT |
| Flashcard Generator | `chloedia/Obsidian_Quiz_Generator` | MIT |
| FSRS Vocabulary | `rokokol/obsidian-fsrs-vocabulary` | MIT |

Courses, tasks and workflow:

| Plugin | Repository | Licence |
|---|---|---|
| Hold Course | `liveaquietlife/obsidian-hold-course` | MIT |
| Course Command Center | `flippinhutt/CourseCommandCenter` | MIT |
| Subject Manager | `elouahabi-naoufal/ObsidianSubjectManager` | MIT |
| Verso | `liveaquietlife/obsidian-verso` | MIT |
| Better Task | `st-vin/better-task` | MIT |
| Tag Timer | `quantavil/Tag-Timer` | MIT |

Audio, ingestion and AI:

| Plugin | Repository | Licence |
|---|---|---|
| Lecture Transcriber / Transcriber and Summary for Idiots (same plugin) | `abysslotus/obsidian-lecture-transcriber` | MIT |
| Advanced Audio Recorder | `akhmialeuski/advanced-audio-recorder` | MIT |
| Aloud TTS | `adrianlyjak/obsidian-aloud-tts` | MIT |
| Pick Me | `sxinyuhoo/pickme` | MIT |
| Whisper (nikdanilov) | `nikdanilov/whisper-obsidian-plugin` | MIT |
| Voice Aloud | `aloneatwar/obsidian-voice-aloud` | MIT |
| Murmur | `kaurimark/murmur` | MIT |
| Voice Notes | `jhm531/obsidian-voice-notes` | MIT |
| Apple TTS | `ajsscott/obsidian-apple-tts` | MIT |
| Voice Briefing | `reallygood83/voice-briefing` | MIT |
| Gemini Helper | `takeshy/obsidian-gemini-helper` | MIT |
| LLM Hub | `takeshy/obsidian-llm-hub` | MIT |
| AI Study Buddy | `virbird/LLM_Private_Teacher` | MIT |
| Deep Notes | `aadityaincode/Deep-Notes` | MIT |
| Feynman Learning | `jialingxiao/obsidian-feynman-learning` | MIT |

Math, reference, handwriting and PDF:

| Plugin | Repository | Licence |
|---|---|---|
| Chem | `acylation/obsidian-chem` | MIT |
| Calctex | `developer-mike/obsidian-calctex` | MIT |
| Math+ | `ocapraro/obsidian-math-plus` | MIT |
| Quick LaTeX | `joeyuping/quick_latex_obsidian` | MIT |
| Latex Environments | `raineszm/obsidian-latex-environments` | MIT |
| asciimath | `widcardw/obsidian-asciimath` | MIT |
| Math Plotter | `sharbelmarshi/obsidian-math-plotter` | MIT |
| Plot Vectors and Graphs | `nicoletanyt/obsidian-plugin-graphs` | MIT |
| Excalidraw Math Plotter | `ahmeddawoud3/obsidian-excalidraw-plotter` | MIT |
| Periodic Table | `r-cramer4/Periodic-Table-Obsidian` | MIT |
| Unit Converter | `ruszabarov/obsidian-unit-converter` | MIT |
| Symbat | `iamrecursion/symbat` | MIT |
| Valnote Calculator | `orenaksakal/valnotecom-obsidian-plugin` | MIT |
| LaTeX Math | `zarstensen/obsidian-latex-math` | MIT |
| MathLive | `danzilberdan/obsidian-mathlive` | MIT |
| Function Plot | `leonhma/obsidian-functionplot` | MIT |
| Latex Suite | `artisticat1/obsidian-latex-suite` | MIT |
| Inkflow | `quangnd159/inkflow` | MIT |
| Handwriting and Image to LaTeX | `chongcyrus/handwriting-latex` | MIT |
| A-Level Study Coach | `virbird/Alevel-study` | MIT |
| Pdftion | `arias007/pdftion` | MIT |
| Freedraw PDF | `vividasasana/freedraw-pdf` | MIT |
| PDF Writer | `jkom4/obsidian-pdf-writer` | MIT |
| Handwritten Notes | `fbarrca/obsidian-handwritten-notes` | MIT |
| PDF Editor | `holtsdav/PDF-Editor` | MIT |
| Local PDF Annotator | `alexandert142/Alex-annotator` | MIT |

#### Cleared with conditions

| Plugin / component | Licence | Condition |
|---|---|---|
| **Smart Question Tutor** (`smart-quiz-tutor`) | 0BSD | No attribution required; still record the source in `NOTICES.md` as a courtesy |
| **quizblock** | 0BSD per directory | Repo not read; confirm before copying |
| **Easy Quiz** (`ankinglin/EasyQuiz`) | ISC-style (Dynalist) | Keep the copyright and permission text |
| **Activity Graph** (`rwyattwalker/obsidian-activity-graph`) | ISC-style (Dynalist) | Keep the copyright and permission text |
| **Heatmap Calendar** (`Richardsl`) | Apache-2.0 | Keep `LICENSE` and any `NOTICE`; isolate if the repo must stay purely MIT |
| **Contribution Graph** (`vran-dev/obsidian-contribution-graph`) | Apache-2.0 | Same as above |
| **Ketcher** (`yulei-chen/obsidian-ketcher`) | Apache-2.0 | Same as above |
| **Agent Client** (`rait-09/obsidian-agent-client`) | Apache-2.0 | Same as above |
| **Codex Panel** (`murashit/codex-panel`) | Apache-2.0 | Same as above |
| **Calc Craft** | Apache-2.0 | Same as above |
| **MathJax / mhchem** | Apache-2.0 | Not copied; used through Obsidian's own renderer |
| **JSXGraph** | Dual, MIT option available | Use the MIT option only |
| **Adaptive Practice** (`anupchavan/adaptive-practice`) | MIT plugin | Never copy or call its Whetstone engine, which is AGPL |
| **ts-fsrs** | MIT per repo | §3.2 still lists it as unverified; confirm `LICENSE` before adding as a dependency |

#### Not found: blocked, and the name may be wrong

These names appear in this document but not in the community plugin index, so no licence could be checked. Do not treat them as sources, and correct the name before relying on the idea.

| Name in this plan | Status |
|---|---|
| **Syro** | Not in the index. Possibly a misremembered name; find the real plugin first. |
| **Study Tracker** | Not in the index. Confirm which plugin was meant. |
| **PDF Ink** | Not in the index. The plan's PDF ink work is already original; treat this name as unverified. |
| **matrix** | Not in the index. Listed on the old math tag page; likely a different id. |

#### How to clear a blocked or unknown entry

1. Open the plugin's repository and read its `LICENSE` file itself, not the listing badge.
2. If it is MIT, BSD, ISC, 0BSD or Apache-2.0, add it to the cleared table with the repository path and the date, and copy the notice text into `NOTICES.md`.
3. If it is anything else, add it to the blocked table with the reason and leave the idea in place. Ideas are not restricted; code is.
4. If there is no licence file at all, leave it blocked. All rights reserved is the default.

---

### 3.11 Desmos graphing-calculator parity roadmap (Nov 2, 2026)

Owner direction: inventory everything the Desmos Graphing Calculator does, record where a permissively licensed project could supply the algorithm or interaction pattern, keep the list here, and ship each capability as its own small release so it can be updated in many increments. Release numbers below start at the next free version; the 1.172.0 and 1.176.0 sidebar Task list releases are separate.

**Licence rule for every row.** This plugin stays dependency-free and ships its own code in `main.js`; no source below is bundled as a dependency. The repositories are references for algorithms, syntax and interaction design. Any code actually copied must be MIT, BSD, ISC, 0BSD or Apache-2.0 with its NOTICE, must be recorded in `NOTICES.md`, and must never come from a GPL/AGPL project. **Blocked and never to be copied:** `RaumZeit/MarchingSquares.js` (AGPL-3.0), `Nigecat/obsidian-desmos` (GPL-3.0), Desmos' own code and API (proprietary), JSXGraph except under its MIT option, and `Tom-Alexander/regression-js` until its licence file is verified.

| Release | Desmos capability | Permissive source (licence, URL) | Status |
|---|---|---|---|
| 1.173.0 | Tables and regression: `y ~ m x + b`, `y_1 ~ a x_1 + b`, custom models, fitted parameters and R² | `mljs/levenberg-marquardt` (MIT, https://github.com/mljs/levenberg-marquardt); `simple-statistics` for R² (ISC, https://github.com/simple-statistics/simple-statistics) | **Shipped** |
| 1.174.0 | Sliders and animation: free parameter rows `a = 2`, bounds, step, play/pause, one slider driving many rows | `paulmasson/mathcell` interactive inputs (MIT, https://github.com/paulmasson/mathcell); `stevenpetryk/mafs` movable points (MIT, https://github.com/stevenpetryk/mafs) | **Shipped** |
| 1.175.0 | Inequalities: `y < 2x + 1`, `x^2 + y^2 <= 9`, strict dashed vs non-strict solid boundary, region shading | `stevenpetryk/mafs` `Plot.Inequality` (MIT); `jsxgraph/jsxgraph` inequality regions under its MIT option (https://github.com/jsxgraph/jsxgraph) | **Shipped** |
| 1.177.0 | Domain and range restrictions plus piecewise `{condition: value, ...}` | `jsxgraph/jsxgraph` MIT option; `mauriciopoppe/function-plot` piecewise examples (MIT, https://github.com/mauriciopoppe/function-plot) | **Shipped** |
| 1.178.0 | Polar graphing `r = 1 + cos(theta)`, polar grid, theta domain | `mauriciopoppe/function-plot` polar example (MIT); `jsxgraph` polar board (MIT option) | **Shipped** |
| 1.179.0 | Parametric curves `(cos(t), sin(t))` with t bounds and curve fill | `mafs` `Plot.Parametric` (MIT); `function-plot` parametric example (MIT) | **Shipped** |
| 1.180.0 | Points, point lists, labels and open/closed point styles | `mafs` points and movable points (MIT); `Graphr` point styling (MIT, https://github.com/yerich/Graphr) | **Shipped** |
| 1.181.0 | Full function library: sec/csc/cot, hyperbolic and inverse hyperbolic, mod, sign, round, nthroot, gcd/lcm, nCr/nPr, tau | `mathjs` function definitions (Apache-2.0, https://github.com/josdejong/mathjs); `expr-eval` grammar (MIT, https://github.com/silentmatt/expr-eval) | **Shipped** |
| 1.182.0 | Points of interest (roots, intercepts, extrema, intersections) and cursor trace readout | `Graphr` root/trace tools (MIT); `numeric` bracketing and Newton solvers (MIT, https://github.com/sloisel/numeric) | **Shipped** |
| 1.183.0 | Zoom, pan, zoom-fit, default viewport and lock viewport | `function-plot` re-evaluation on scale change (MIT); `Graphr` mouse zoom/pan (MIT) | **Shipped** |
| 1.184.0 | Graph settings: minor gridlines, axis labels, pi ticks, degrees/radians | `jsxgraph` axis/ticks board (MIT option); `function-plot` axis options (MIT) | **Shipped** |
| 1.185.0 | Row styling: line width, dashed lines, fill opacity and point size | `jsxgraph` styling options (MIT option) | **Shipped** |
| 1.186.0 | Export: graph PNG, table CSV and copy-expression text | Canvas and clipboard APIs already used by the plugin; no third-party code | **Shipped** |
| 1.187.0 | Math keypad and examples gallery in the graph tab | Desmos' documented shortcut set as behaviour reference only; `mathlive` MIT option for input ideas (https://github.com/arnog/mathlive) | **Shipped** |
| 1.188.0 | Statistics: mean/median/stdev/quartile/corr and list entry | `simple-statistics` (ISC) for the formulas | **Shipped** |
| 1.189.0 | Calculus: numeric derivative, definite integral, sum and product | `scijs/integrate-adaptive-simpson` adaptive quadrature (MIT, https://github.com/scijs/integrate-adaptive-simpson); `mathjs` derivative reference (Apache-2.0) | **Shipped** |
| 1.190.0 | Accessibility: per-row text summary for screen readers and a data-table view of the graph | Desmos accessibility guidance as behaviour reference only | **Shipped** |

**Not planned, with the reason recorded:** the 3D calculator, Geometry tool and Matrix calculator are separate products outside this panel; complex mode, audio trace, braille output and Desmos share links need device or service support the plugin does not have; the Desmos API itself is proprietary and was already rejected in §3.10 and §11 decision 6. Marching squares for implicit curves and inequalities is written locally rather than copied from the AGPL implementation.

### 3.12 Desmos gap completion roadmap (Nov 3, 2026)

§3.11 closed the graphing-calculator core and its exclusions are unchanged, but an audit on Nov 3, 2026 found documented graphing-calculator capabilities with no row and no exclusion note. This section records every one of them, in priority order, one release each. The licence rule is unchanged: the plugin bundles no third-party code, so each source below is an algorithm or interaction reference only; anything actually copied must be MIT, BSD, ISC, 0BSD or Apache-2.0, recorded in `NOTICES.md`, and never GPL/AGPL. Desmos itself stays proprietary.

| Priority | Target | Desmos capability | Permissive source availability | Status |
|---|---|---|---|---|
| 1 | 1.191.0 | **Expression folders:** a header row groups the rows below it, with rename, collapse/expand, a live row count and delete that keeps the grouped rows | No MIT source for Desmos-style list folders was found. The grouping model, UI and persistence are written from scratch in `src/graph-folders.js`. Desmos' folder interaction is a behaviour reference only | **Shipped** |
| 2 | 1.192.0 | **Multi-column tables:** more than x and y, per-column expressions, and regressions over named columns | No MIT source: `src/graph-table.js` is written locally. `mafs` (MIT, https://github.com/stevenpetryk/mafs) and `function-plot` (MIT, https://github.com/mauriciopoppe/function-plot) are table/plot interaction references only | **Shipped** |
| 3 | 1.193.0 | **Print/paper output:** a print sheet with the drawn graph, the window, the expression list and the data table | No MIT source: `src/graph-print.js` assembles the escaped paper document and `ReferenceView` paints the existing canvas scene into it. Written locally | **Shipped** |
| 4 | 1.194.0 | **Image insertion and calibration:** place a vault image behind the axes and calibrate it from two reference points | No MIT source identified. `src/graph-image.js` validates the two-point calibration and converts it to graph and pixel rectangles; `ReferenceView` reads the vault image through the resource path and paints it with `CanvasRenderingContext2D.drawImage`. Written locally | **Shipped** |
| 5 | 1.195.0 | **Undo/redo and duplicate row** in the expression list | No MIT source. `src/graph-history.js` holds the bounded session snapshot history and duplicate-row model; `ReferenceView` records list edits and restores real row state. Written locally | **Shipped** |
| 6 | 1.196.0 | **Graph-paper settings:** hide the grid or the axes and set the grid step | No MIT source. `src/graph-paper.js` validates the step and computes fixed grid-line positions; `ReferenceView` reads the flags and step in its existing grid painter. Written locally | **Shipped** |
| 7 | 1.197.0 | **Summation and product notation** in a row, such as `sum(n^2, n, 1, 10)` and its product form | `mathjs` (Apache-2.0, https://github.com/josdejong/mathjs) used as a grammar reference only. `src/graph-summation.js` parses and validates the notation and bounds; the existing local parser binds the compiled term. Written locally | **Shipped** |
| — | Blocked | **Saved graphs on a Desmos account / cloud sync** | No MIT source exists: Desmos' account service and API are proprietary. The plugin is local-only and this needs an external account and service it does not use | **Blocked** |

Every queued row in this table is now shipped; the only remaining row is the blocked Desmos-account row, whose concrete blocker is the proprietary service. As of 1.197.0 there is no unshipped local row in this roadmap. The graph tab's remaining known quality gates (no live Obsidian hand pass, no real screen reader) are recorded in each release note rather than hidden here.

### 3.13 Extended calculator roadmap (Nov 3, 2026)

Owner decisions: include explicit and implicit 3D surfaces; do not build braille output; do not add Desmos share links or the Desmos API; allow a vendored JSXGraph build under its MIT option (withdrawn in 1.209.1 after release review); add geometry transformations in a later release. The 3D, geometry and matrix tools are separate Reference surfaces from the 2D graph. Each release follows the existing rule: a pure module first, one `ReferenceView` adapter, local persistence, focused tests, a rebuilt `main.js`, and an honest release note.

| Release | Capability | Scope | Status |
|---|---|---|---|
| 1.198.0 | Matrix calculator | Matrix A/B up to 6×6, arithmetic, scale, transpose, determinant, inverse, RREF and `A x = b` | **Shipped** |
| 1.199.0 | Complex arithmetic | Complex values, `i`, calculator support and formatting | **Shipped** |
| 1.200.0 | Complex graph mode | Domain coloring and complex points | **Shipped** |
| 1.201.0 | Geometry primitives | Points, segments, lines, circles, polygons and measurements | **Shipped** |
| 1.202.0 | Geometry constructions | Midpoints, intersections, perpendiculars and bisectors | **Shipped** |
| 1.203.0 | Geometry transformations | Translate, rotate, reflect and dilate | **Shipped** |
| 1.204.0 | 3D core | Explicit `z = f(x,y)` surfaces, points, camera and software renderer | **Shipped** |
| 1.205.0 | 3D implicit surfaces | `F(x,y,z) = 0` via bounded marching cubes | **Shipped** |
| 1.206.0 | 3D curves and performance | Parametric curves, LOD, color, export and print | **Shipped in 1.209.0** |
| 1.207.0 | Audio trace | Web Audio sonification of curves and points | **Shipped in 1.209.0** |
| 1.208.0 | Local vector field | Quiver, streamlines and magnitude scaling | **Shipped in 1.209.0** |
| 1.209.0 | JSXGraph adapter | MIT-vendored advanced geometry and vector-field presentation | **Shipped in 1.209.0; withdrawn in 1.209.1** |

**Removed by owner decision:** braille output (including BRF and translation) and all Desmos share-link/API work, including a plugin-owned link format. No network integration is planned for these tools.

**Roadmap close-out:** 1.206–1.209 were completed together and published as **1.209.0**. Separate 1.206–1.208 tags were not created. **1.209.1** withdraws the optional JSXGraph adapter after release review; the 3D curves/LOD/export/print, audio trace and local vector-field canvases remain. There is no vendored JSXGraph runtime or notice in the shipped bundle. **1.209.2** adds the progress-dashboard course-registry scope fallback (Insights Progress, Today and the dashboard embed) and clears the remaining CSS scanner warnings while preserving the SAT passage layout. The source of truth for the shipped behavior is the focused tests and release notes.


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
- **Course registry:** code, name, folder, color, semester, instructor, credit weight, optional aliases and totalTopics. Exam dates are not duplicated here: they are derived from `listExams()` (ICS/Full Calendar events, exam-type assignments and Topic-planner dates), so §4.3 and §5.11 read one merged list.
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
8. **Interop — Full Calendar shipped (unreleased):** read local event notes from a chosen folder, including single, all-day, multi-day, weekly `recurring` and `rrule` events. The source note opens from the event card, the interop is read-only, and foreign events are left out of `.ics` export. Hold Course and uni-calendar note properties are read-only interop candidates gated on one sample note from each; ICS import already covers their schedules.
9. **Mobile:** read-only Today and Upcoming views first; editing second.

**Implemented (unreleased, Oct 30, 2026):** Full Calendar local event notes (`src/calendar-interop.js`) are read from the folder in Settings, Calendar, Notes & Templates, **Full Calendar event folder** (empty means off). Single, all-day, multi-day, weekly `recurring` and `rrule` notes are supported; the card opens the source note instead of creating a class note; foreign events never enter `.ics` export. This is a compatibility reader for Full Calendar's documented frontmatter, not copied code. Covered by 3 focused tests.

**Shipped in 1.101.0:** the course registry stores name, code, folder, color, semester, instructor and credit weight. A code also matches timetable titles such as `CHEM 101 - Lecture`; a registered folder wins for new class notes, its color wins on the calendar, and its credits fill the GPA when Assignments has no explicit credit for that course. Existing subject/folder mappings and class colors still work as fallbacks.

**Core-values connector (unreleased, Nov 1, 2026):** the registry is the shared course identity (`src/course-identity.js`), with name/code/folder/alias lookup, old-string fallback and non-destructive rename aliases. `src/exams.js` merges the three exam sources and every reader (`examCapFor`, `studyPlans`, `course-health`, Today, planner defaults and generated tasks) uses it. **Add exam** writes a normal `type: exam` assignment note with optional topics, start time and weight; the planner offers **Use exam topics**. Attendance is idempotent from a calendar event, the class-note file menu or two commands, and lecture entries link their class note. Old notes and saved settings load unchanged because all new fields are optional and normalizers accept old data. Covered by `tests/core-values.test.js`; full suite 1,256 after the P0 hardening.

**Risks:** time zones and recurring events are a bug magnet. Use a proven iCalendar parser (check its license), test against real exports from Canvas, Google, and Outlook, and handle daylight-saving transitions explicitly.

### 5.9 Assignments, tasks, and grades  — **M**

**Ideas from:** Tasks (syntax), Task Center, Hold Course (assignments, grade chips), Subject Manager.

**Scope**
- **Use Tasks syntax** (`📅`, `⏳`, recurrence) so existing Tasks queries keep working.
- **Assignments** linked to a course with type, due date, weight, status, grade.
- **Grade tracking:** weighted categories, current grade, "what do I need on the final to get X".
- **GPA view:** credit-weighted. Note: several consumer apps highlight weighted-credit support as a pain point, so make credit weighting first-class.
- **Study-linked tasks:** "Review 20 due items" appears as a task in the daily view.
- **Time estimates and workload:** optional minutes on assignments, mirrored as `⏱️` Tasks metadata and summed into today, tomorrow and next-7-days totals.

**Unreleased (Oct 30, 2026):** optional `estimate` minutes and `⏱️` Tasks metadata, with workload totals in Assignments and Today.

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

**Core-values connector (unreleased, Nov 1, 2026):** `studyPlans()` returns one plan per exam in the next 30 days, soonest first, and `studyPlan()` remains the single-plan wrapper. A course with no matching questions keeps its plan with `readiness: null` and work items instead of disappearing. Plans accept lectures, readings, remaining planner passes and assignments due before the exam, expose `workItems[]` and `readinessEvidence[]`, and Today renders the evidence beside readiness. The exam list and review cap come from the merged model in §5.8; the Topic planner can seed topics from the same exam. Covered by `tests/core-values.test.js` and the existing study-plan tests; full suite 1,256 after the P0 hardening.

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
- **Markdown table import** for card decks, using the same column aliases and duplicate controls as CSV.

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

**5.16.2a Local chemistry, biology and circuit blocks (implemented unreleased, Nov 1, 2026).** Obsidian registers three local fenced-code processors, so the diagrams render in stimuli, question bodies, answer choices, explanations and review whenever Markdown is rendered. `chem` accepts `SMILES: CC(=O)O` for a structure, or a simple equation such as `2H2 + O2 -> 2H2O`; it supports coefficients, common formulas, charges, states and the usual reaction arrows, and rejects complexes or condition labels rather than guessing. `biology` (alias `biosequence`) accepts a raw sequence or `type`/`sequence`/`translate`/`complement`/`name` options and renders DNA/RNA strands, complements and standard codon translation; protein sequences are grouped separately. `circuit` draws an explicit two-terminal netlist (`battery V1 ...`, `resistor R1 ...`, `lamp L1 ...`) with common components and ground, but it is a schematic renderer, not a circuit simulator. Feature parity is with the MIT-licensed Chem (https://github.com/acylation/obsidian-chem), Biosequence (https://github.com/jwreda/obsidian-biosequence) and CircuitJS (https://github.com/stevengann/obsidian-circuitjs) plugins; this implementation is original and no source was copied. All three are dependency-free local code and make no network request. Covered by 7 focused tests; the Qwen request contract adds 2 focused tests; full suite **1,242** and `npm run check` clean across **219 modules**.

**5.16.3 Numeric answer grading (extend SPR)**
- **Tolerance:** absolute and relative, per question (`tolerance`, `tolerance_type`).
- **Significant figures:** optionally require or check them.
- **Forms:** fractions, decimals, scientific notation, and percentages accepted as equivalent.
- **Units:** optional unit field with dimension checking and unit conversion (e.g., accept 1 km for 1000 m when allowed).
- **Multiple accepted answers** and **ranges**.
- **Equivalent expressions** (e.g., `x^2 - 1` vs `(x-1)(x+1)`): compare exact single-variable polynomials after expansion; reject division by a variable, unsupported functions and powers outside the documented range.
- Always show the student how their answer was interpreted ("Read as 3.2 × 10⁻³ m/s") so parsing errors are visible.

**Shipped in 1.81.0:** `src/numeric-grading.js` reads fractions, mixed numbers, decimals, scientific notation and percentages; compares against `answer`, `accepted_answers` and `accepted_variants`; applies absolute, relative or percentage `tolerance`; supports inclusive/exclusive ranges (`1..2`, `[1, 2]`, `(1, 2)`); checks `sig_figs` (`at_least` or `exact`); and converts common length, mass, time, volume, energy, force, pressure, power, electricity, amount, speed and temperature units while rejecting incompatible dimensions. Practice and timed-test reviews show the interpretation and reason (for example `Read as 1 km (1000 m)`). Single-variable polynomial equivalence now ships in `src/polynomial.js`: it expands `+`, `-`, `*`, constant division and non-negative integer powers, compares coefficients exactly (within floating-point tolerance) and rejects domain-changing or unsupported expressions rather than guessing. Examples: `x^2 - 1` matches `(x-1)(x+1)`, `(x+1)^2` matches `x^2+2x+1`, while `1/x`, `sin(x)` and a different polynomial stay incorrect. The pure rules are covered by `tests/numeric-grading.test.js`; the visual Obsidian check is not applicable because this is text-only grading.

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

**Shipped in 1.86.0:** OCR is now AI-vision only. The optional desktop OCR command adapter was removed, eliminating the plugin's direct `child_process` and `fs` usage; in 1.169.1 the OpenCode auto-installer was removed too, so the plugin has no direct `child_process` or `fs` usage and connects to a manually started OpenCode server. The plugin still enumerates the vault through Obsidian's API because import, filters, calendar and study views need the index.

**Shipped in 1.87.0:** Agent mode now pauses its file edits for review. Before a request the plugin snapshots the question, card, deck and current notes; after the agent finishes it reverts those writes and shows a per-file diff. Only checked files are written back, closing the review discards everything, files edited during review are reported as conflicts instead of overwritten, and **AI: undo the last agent edits** restores the previous contents. Covered by `tests/agent-edit-review.test.js`.

**Shipped in 1.88.0:** **Verify numeric answers by calculation** no longer writes while it scans. It computes every check first, then shows a review of the affected notes and the exact verification properties that would change. Only checked notes are written; a note edited during the review is skipped instead of overwritten. Covered by `tests/computed-verification.test.js`.




**5.16.9 Subject-aware analytics**
- Track errors by type common to STEM: setup error, algebra/arithmetic slip, unit error, sign error, wrong formula, concept gap. Extend the existing mistake-type labels (users can already add their own).

**Shipped Nov 1, 2026:** the default mistake labels now include `setup error`, `algebra/arithmetic slip`, `unit error`, `sign error` and `wrong formula` beside the existing generic labels and `content gap`. The list remains editable in Settings → MCQ Tracker → Practice; saved lists are not overwritten, and the same labels feed practice, timed-test review and the error-log sheet. Covered by `tests/grading.test.js`.

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
| **More Anki variants** | `.apkg` (new and old), Anki text, CrowdAnki JSON, AnkiWeb shared decks | **CrowdAnki JSON shipped in 1.23.0, desktop `.apkg` import in 1.50.0, two-way AnkiConnect sync in 1.51.0 and `.apkg` export in 1.116.0. LearnKit remains; preserve scheduling and media where possible.** |
| **LMS quiz banks** | Moodle XML, GIFT, QTI (Canvas, Blackboard) | Fits university users. **GIFT, Moodle XML and QTI shipped in 1.21.0–1.22.0**; Canvas/Blackboard-specific variants remain. Formats above are from memory; **Verify** current specifications. |
| **Exam / quiz formats** | FlashQuiz `@mc`/`@sata`/`@tf`, VCE via converter, QuizPort JSON, Markdown checkbox quizzes | CBT Exam Simulator and QuizPort are references. **Verify** the VCE converter's license separately. |
| **Export** | Anki text, Anki `.apkg`, CSV, Markdown, JSON, Mochi `.mochi`, LearnKit | Round-trip where practical so users can leave with their cards. |
| **Import quality** | Dry-run preview, report (created, skipped, duplicates, media failures), duplicate detection, source attribution | **Preview/report/update-copy shipped in 1.24.0; per-row outcomes and .apkg media reporting shipped in 1.92.0.** |

**Rules:** prefer files users export themselves; do not scrape Quizlet, Kahoot, Blooket, Gimkit, Canvas or AnkiWeb, and review each service's terms before any unofficial API. Normalize every importer into the existing note format and scheduler; no parallel card database. Dedupe by official ID, normalized text and page/image hash; re-import offers **skip**, **update** or **create copy**. Stage the import, show the report, then commit in one batch; never half-write. Write `import_source`, `import_format`, `imported_on`, `import_batch` and `import_source_url`. Tell users they are responsible for imported content and that no copyrighted question banks are bundled. Keep one small, legally usable fixture per format in CI.

**Acceptance criteria:** a generic CSV with a header imports by mapped columns and reports skipped rows; a same-length, same-prefix file edit is detected before re-import; re-importing the same deck does not duplicate by default; every imported item carries source properties and enters the normal due queue; a failed row or media file is reported without blocking the batch.

#### 5.22.4 Smaller study-flow ideas — **partly implemented in 1.17.0 and 1.18.0**

**Implemented in 1.55.0:** interleaved mixed review across due questions, flashcards and vocabulary, using one recall-and-rate session and the shared scheduler. **Implemented in 1.17.0:** rule-based extraction from headings, definitions, sentences, two-column tables, highlights and cloze marks; the `flashcards: true|false` per-note opt-in with preview; and **Practice this note only**. **Implemented in 1.18.0:** the opt-in daily quiz with its own streak, and optional exam question ranges in timed tests. **Implemented in 1.19.0:** image occlusion cards with one card per mask. **Implemented in 1.20.0:** Private Tutor, Socratic Tutor and Language Partner roles plus `/guide`, `/quiz`, `/confuse`, `/gap`, `/predict`, `/feynman` and `/mock` across both chat backends. **Implemented in 1.21.0:** Moodle GIFT import. **Implemented in 1.22.0:** Moodle XML and QTI quiz-bank import. **Implemented in 1.23.0:** Mochi Markdown and CrowdAnki JSON import. **Implemented in 1.24.0:** import preview, result reporting and skip/update/copy duplicate handling. **Implemented in 1.27.0:** the PDF annotation sidecar (hash-keyed Markdown notes, highlights, text boxes, form notes and page notes) with commands and a PDF context menu; the visual pen/highlighter overlay shipped in 1.52.0 and visual text boxes in 1.53.0. Audio-only commute mode is gated by §11 decision 2 because provider TTS is not approved.

- **Rule-based card extraction (no AI).** Build Q/A pairs from headings, "X means…" sentences, colon and bullet definitions, two-column tables, highlights and existing cloze marks. AI can improve or expand the result, but the rule-based path must work with AI off. *(Source: FlashCard plugin.)*
- **Per-note auto-card opt in/out.** A `flashcards: true|false` property so a lecture note is never scraped into cards by surprise. Pair it with a preview before writing.
- **Practice this note only.** Scope a session to one note or one heading, useful after a lecture and for debugging a question. Reuse the existing filter machinery; do not add a second queue.
- **Daily quiz plus streak.** Generate a small daily MCQ set from chosen folders, with a streak separate from study-time streaks. *(Source: VaultQuiz.)* Keep it opt-in and local; no notification spam.
- **Exam question range.** Run questions 1–20 (or any range) from a larger set for Bluebook-style section practice. *(Source: CBT Exam Simulator.)* Add it to timed-test blueprints (§5.6).
- **Tutor role presets.** Private Tutor, Socratic Tutor and Language Partner roles, plus `/guide`, `/quiz`, `/confuse`, `/gap`, `/predict`, `/feynman` and `/mock` commands. This extends §5.18; it is not a second assistant.
- **Image occlusion cards.** One card per mask on a diagram, useful for anatomy, biology and maps. Add it to the card types in §5.7. LearnKit, Osteon, Flashcard Studio and Decks are references; verify their licenses, and note that LearnKit's Anki import currently skips occlusion cards.
- **Audio-only commute mode.** Read due cards, questions and explanations aloud in a hands-free queue, with sentence highlighting and optional caching. TTS is gated by §11 decision 2; this is the UX to evaluate if it returns. Provider (API) voices are the realistic route on Android because a plugin cannot rely on a system speech engine there. *(Sources: Voice Aloud, Murmur, Voice Notes, Apple TTS.)*
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
| **GPL / AGPL / LGPL** | Do not bundle into `main.js`, and never copy even a single function from an AGPL plugin: `main.js` ships as source, so one copied function would relicense the whole plugin. Reported examples: Obsidian_to_Anki (GPL-3.0), Obsidian Desmos (GPL-3.0), Talking Cards (GPL-3.0), Whetstone engine (AGPL). **Verify** each. |
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

#### 5.22.8 Questions at capture time (historical)

These October 28 questions are retained for history. Current answers are in §11 and in the shipped features above; none is an open implementation request.

1. **Known vs exclude — shipped.** Known snoozes an item for a course-specific or global period; Exclude keeps it in the vault but removes it from practice queues until restored. Both are note-level study controls, not scheduler writes.
2. **Quizlet-style MCQs — shipped.** The choice study skin reuses existing question notes and the existing queue; no separate card store is added.
3. **PDF editor — gated by §11 decision 1 / E4.** The PDF annotation index ships. A full PDF editor or form filler needs an audited PDF/OCR engine and an owner-supplied fixture, so it is not guessed.
4. **Analytics — shipped.** The Insights view and the opt-in attempt log cover all-progress review without a separate service.
5. **Import formats — shipped.** GIFT, Moodle XML, QTI, Mochi Markdown, CrowdAnki, zipped Canvas/Blackboard QTI and LearnKit import paths are implemented; unsupported variants are reported instead of silently skipped.
6. **Desmos — resolved.** No Desmos key is bundled; the local graphing and reference tools are the supported route.
7. **Reference panel — shipped.** Graphing, periodic-table, formula-sheet and unit-conversion reference surfaces are available and stay out of timed tests by default.
8. **Mobile — owner policy O11.** No standalone app starts until a measurable demand or retention trigger is agreed; a PWA test is the cheaper first step.
9. **Licensing — O12 / O13.** The recommended default is owner sign-off on copied files and `NOTICES.md`, but O12 is not recorded yet. No similarity scan runs while the plugin is free, and a recorded scan is required before commercial distribution.

#### 5.22.9 Historical suggested order (not an open request)

Kept for reference; most entries are shipped and the remaining provider or mobile items are gated in §3.9.6.

1. **Known and Exclude** — small, direct student request, improves every queue.
2. **Generic CSV/TSV import plus import report and dedupe** — highest reach for the least format-specific work.
3. **Quizlet-style MCQ skin** — reuses existing notes and the existing queue.
4. **Rule-based card extraction, per-note opt-in, practice-this-note-only** — creation and control without AI.
5. **Daily quiz/streak, exam question range, tutor role presets** — small study-flow wins.
6. **Image occlusion and audio-only commute mode** — card depth once TTS/provider support is validated.
7. **Reference panel** — useful but optional; keep it out of timed tests by default.
8. **PDF editor** — integrate first; build only if integration is inadequate.
9. **Import polish** — GIFT, Moodle XML, QTI, Mochi Markdown and CrowdAnki are implemented, with preview/report/update-copy and per-row/.apkg media reporting in 1.92.0. Canvas/Blackboard variants remain.
10. **Standalone mobile prep** — keep the core portable now; start the app only when the trigger is met.

#### 5.22.10 Quick add questions (lighter multi-question authoring) — **Shipped in 1.128.0**

**Source:** §13.9. The owner ranked this item on Oct 30, 2026. One note per question is the right storage model but a slow way to enter a set, while Omniscient and Note Quiz Engine let a learner write several questions in one place.

**What shipped:** a **Quick add questions** command opens a paste box. Each block becomes one ordinary question note, and nothing is written until the preview is confirmed.

```text
Q: Which gas do plants take in during photosynthesis?
A. Oxygen
B. Carbon dioxide
Answer: B
Why: Photosynthesis consumes carbon dioxide.
Course: Biology
Skill: photosynthesis
Difficulty: easy
```

- **One grammar, no new note format.** `Q:` starts a block; `A.`–`H.` lines are choices; `Answer:`, `Key:` or `Correct:` takes a letter, a choice's own text or a set such as `A, C`; `Why:`/`Explanation:` is the rationale; `Stimulus:`, `Course:`, `Skill:`, `Difficulty:`, `Unit:` and `Test:` are optional. A block with no choices is written as an SPR note. Wrapped question or explanation lines continue the field above them, and `---` separates blocks.
- **Preview first.** The dialog live-parses the paste and shows how many questions are ready, every block that needs attention with its reason, and a compact list of the items it will write. The Create button is disabled until at least one block is valid.
- **Ordinary notes.** Each write produces the same properties and headings as a hand-written note (`question_id`, `question_type`, `choices`, `answer`, optional course/skill/unit/difficulty/test, `## Stimulus`, `## Question`, `## Answer Choices`, `## Answer`, `## My Notes`). There is no AI property, no import property and no pre-filled tracking state, so the item enters the normal queue, filters, scheduler and analytics.
- **Titles and collisions.** The title comes from the question text (60 characters, unsafe filename characters removed). A repeated title gets ` 2`, ` 3` and so on, and `question_id` matches the file name, exactly like AI-drafted questions.
- **Small surface.** `src/quick-add.js` is a pure parser and note builder; `src/quick-add-modal.js` is the preview dialog; `plugin.createQuickAddQuestions` does the writing. No dependency, no network request and no vault-wide scan. The command is hidden and writing is refused when the MCQ Tracker module is off.

**Acceptance:** a two-block paste writes exactly two notes in the chosen folder with the right type, choices and key; a block with one choice, a key outside the choices or no key is reported and not written while the valid blocks still are; `Answer: B`, `Answer: b`, `Answer: Carbon dioxide` and `Answer: A, C` resolve correctly; an SPR block writes no choices section; a repeated title is numbered instead of overwritten; every written note parses through `parseNote` and carries no AI or import properties.

#### 5.22.11 Study bundle export and import (portable backup) — **Shipped in 1.129.0**

**Source:** §5.22.7 and the mobile-prep checklist. A ZIP of Markdown questions, cards and their history gives users a restore path that does not depend on Obsidian Sync or a proprietary store.

**What shipped:** **Export a study bundle** writes one stored ZIP at the vault root (`mcq-study-bundle-YYYY-MM-DD.zip`, numbered on collision) containing:

- `questions/<original vault path>.md` and `cards/<original vault path>.md`, copied byte-for-byte so `history`, `next_review`, `srs`, review counters, source links and display properties survive.
- `manifest.json` with the schema number, plugin version, export date, counts and the original-path mapping.
- `README.md` explaining what the bundle is and how to restore it.

Unsafe path segments are cleaned, `..` hops are dropped, and repeated names get a numbered suffix. Only notes in the configured question folder are included; cards are included when the Cards module is on. Images, audio and PDFs stay in the vault and are not bundled. Nothing is uploaded, no dependency is added, and the archive uses the existing stored-ZIP writer.

**Acceptance:** a vault with two questions and one card writes a ZIP whose entries are `README.md`, `manifest.json`, both question notes and the card note; note text matches the vault exactly; a bundle excludes questions outside the question folder and cards when the module is off; a collision or `..` path cannot escape its folder; an empty vault writes nothing.

**Import shipped in the same change:** **Import a study bundle** reads the newest `mcq-study-bundle-*.zip` at the vault root, validates `manifest.json` (schema 1, plugin id, complete note list) and never partially writes on a corrupt manifest. Restore policy:

- Missing note → create at its original vault path, or under the configured question/card folder when the original path is unavailable.
- Existing note with identical text → reported as already there; not duplicated.
- Existing note with different text → reported as a conflict; never overwritten.
- Absolute paths, `..` hops and unsafe characters → rejected, never redirected outside the vault.
- Cards → skipped while the Cards module is off.
- Manifest-level failures → the whole import stops before any write.

**Import acceptance:** export→import gives byte-identical notes at the same paths; a different existing note is left untouched and counted as a conflict; identical notes are not duplicated; a corrupt or schema-mismatched manifest writes nothing; a traversal path writes nothing; cards stay out while the module is off; the command is registered and reports imported, identical, conflict, invalid and cards-skipped counts.

#### 5.22.12 Kairos-style time-block planning — released in 1.210.1, calendar-compatible

**Source:** [Kairos](https://github.com/caasion/kairos) (0BSD), a time-blocked daily-planning Obsidian plugin. Its Day/Week timeline, Grid, Backlog, Routines, Projects/domains and Timeline views are the design reference; no Kairos source, styles or copy text was copied, so no notice or dependency is added.

**Status:** implemented Nov 3, 2026 as the opt-in **Time blocks** module in Study Workspace and released in **1.210.1**. It is off by default. The local model lives in `src/time-blocks.js`; plugin CRUD, routines, backlog scheduling and the readable Markdown export are wired through `src/plugin.js`. Settings, the tab, all seven views and responsive styles are included. Existing `studyTasks` are reused in the Backlog, and completing a linked block task completes its study task. Projects and domains are optional lenses; timeline minutes are derived from blocks rather than kept as a second total. Routines only add missing blocks for a date, so applying one twice does not duplicate it.

**Future idea, not scheduled (owner gate):** everything in this area that 1.210.1 and 1.210.2 do not already ship is a future idea and is **not scheduled** — subject colours, event tags, two-way daily-note sync, and any additional view, setting or data model included. **No further code, data model or UI here is approved until the owner ranks the item and supplies a spec.** The Kairos row in the §3 source map carries the same status; this section is the single record for the item, and §3 and §5.22.12 must not drift apart. Cross-references use the section number because the line anchor this item was captured with has moved.

**Calendar compatibility:** when the existing Calendar module is on, Day and Week read `plugin.calendarEvents()` and show classes and events as read-only context. A block that shares an event's time is marked as an overlap; the configuration card reports event count, booked minutes and overlapping blocks. Week columns group the same `dateKey` events under each day. The **Show calendar events** switch (default on) hides this context. Nothing is written, moved or copied into the planner, no calendar note is required, and Time blocks still works with Calendar off. The planner uses its own week-start setting, so changing the calendar's week start does not silently reshape saved plans.

**Calendar integration (Nov 3, 2026, released 1.210.8):** the calendar's day section now renders the Kairos layer itself when Time blocks is on. `src/calendar-planner.js` is pure: `dayPlan` merges the day's read-only classes with the local blocks, computes the free slots inside an 08:00–22:00 planning window (30-minute minimum), flags blocks that sit over a class and returns a summary; `slotDraft` and `afterClassDraft` build block drafts and `planSummaryLine` writes the one-line summary. `plugin.calendarPlannerDay(date, events)`, `planBlockFromCalendarSlot` and `planBlockAfterClass` add blocks through the existing `addTimeBlock`, so nothing new is stored and no second timetable exists. The UI lists planned blocks with **Remove**, free-slot chips that plan a study block titled after the next class, per-class chips that plan a 45-minute review block, and **Open Time blocks**. Calendar events, notes and .ics feeds stay read-only; a block is never written back to the calendar. Covered by `tests/calendar-planner.test.js`; notes are in `docs/release-notes/1.210.8.md`.

**Not included:** two-way daily-note sync and import of Kairos daily-note blocks. The Markdown export is intentionally one-way: `<Day-note folder>/YYYY-MM-DD.md` with a `## Schedule` section. The planner remains the editable source, so a note edit cannot overwrite local blocks.

**Acceptance evidence:** `tests/time-blocks.test.js` covers default-off normalization, time validation, summaries, routines, backlog reuse, project/timeline totals, Markdown export, persistence, read-only calendar context and overlap marking, and every empty state. `tests/study-workspace.test.js` covers the module key and the all-modules-off gate. Verification: **1,524 tests pass / 0 fail**, `npm run check` clean across **257 source files**, `main.js` current across **257 bundled modules**, `git diff --check` clean. Release notes are in `docs/release-notes/1.210.1.md`.

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
| Provider breadth | Direct AI has Anthropic, OpenAI, OpenRouter, Gemini, Qwen (DashScope), Ollama and custom endpoints. OpenCode adds DeepSeek and Groq. | **Done.** Qwen is selectable with the OpenAI-compatible DashScope endpoint and `qwen-plus` default; model discovery and chat use `/models` and `/chat/completions`. Keep Claude Code/Codex subscription routes out of the core; document OpenCode or a manual server. |
| Native PDF attachments | PDFs are read locally, figures captured, scans OCR'd through vision. | **Do not adopt.** Native PDF upload adds provider limits and sends more data; local extraction plus OCR is the better privacy path. |
| Dashboard, streak, one-click daily practice | Yes, and broader: Insights, heatmap, calibration, retention, study log, calendar. | **Done.** No parity work. |
| Blind verification | Blind AI check plus local numeric/calculation checks. | **Done.** No parity work. |
| Manual topic picker | Filters exceed Adaptive Practice, but there is no low-skill or PDF-only picker. | **Not separate work.** Add a low-skill filter only if users ask. |

**Priority and acceptance**

1. **P1 — Generate from any note.** This is the largest missing workflow. Acceptance: the preview shows count, difficulty, destination and source; nothing is written until confirmation; every AI-written MCQ runs the blind check; the batch is undoable; a normal note with no `transcript` property works.
2. **P2 — Fluency and session shape.** Acceptance: a logged skip is visible, is not counted as correct, and shortens the next interval; the existing no-log Skip is unchanged; warm-up/stretch stays within configured limits and can be overridden; subtopic labels survive an edit and are not sent when AI is off.
3. **P3 — Reminder and provider polish.** Acceptance: the reminder is off by default, local, once per day, and dismissible; Qwen is implemented against the OpenAI-compatible DashScope contract and covered by a mocked request test, with a live keyed request left to the owner; no new binaries or subscription CLIs are added.

**Not parity goals:** the Whetstone engine, Elo-style generation calibration, native PDF attachment, and the persistent vault index. The engine is AGPL and would reintroduce process-execution warnings. The other three are implementation choices, not missing study features.

**Positioning line:** Adaptive Practice is generation-first and automatic; MCQ Tracker is bank-first and deeper on exams, cards, calendar, analytics and safety. Do not claim feature parity; claim the specific gaps above and their status.

**Shipped in 1.89.0:** all five P1–P3 parity gaps are closed. Any note can generate practice, generated batches remember their subtopics, a logged Don't know is visible in Insights without counting as wrong, session length adapts within hard caps, and the local reminder is opt-in. No Adaptive Practice or Whetstone code was copied; the implementation is original MIT code.

**Qwen and STEM blocks implemented (Nov 1, 2026, unreleased).** The Qwen preset was added after confirming the DashScope OpenAI-compatible endpoint; `qwen-plus` is the default and the base URL remains editable for regional or dedicated endpoints. The local `chem`, `biology`/`biosequence` and `circuit` blocks close the science-rendering cluster without adding a bundled library or copied source. See §5.16.2a and §11 items 16–17.

---

### 5.24 Academic and researcher plugin scan — captured Nov 3, 2026, unscheduled

**Status:** backlog only. This section records ideas for later ranking; it does not approve any plugin, dependency, code, data model, setting, command or UI. Nothing here overrides the dependency-free, local-first and off-by-default rules in this plan.

**Backlog status after 1.210.10:** the eight local candidates are shipped — Time blocks with calendar context (1.210.1), the one-way daily-note reader and **Open daily note** action (1.210.2), the Citations library (1.210.3), PDF page deep links (1.210.4), the read-only vault checklist index (1.210.5), the local task-tag rename (1.210.9), the local glossary lookup (1.210.9, widened in 1.210.10 to the saved vocabulary list and the lecture-note vocabulary tables) and the read-only writing-session count (1.210.10). Subject colours, event tags, a generic template builder and import-only attachment routing remain unranked candidates; Dataview, iframes, Excalidraw, a second AI runtime, a Zotero database and vault-wide rewrites stay rejected. No dependency was added by any of these releases.

**Sources:** [Study Flow Planner](https://community.obsidian.md/plugins/study-flow-planner) and [Study Agent](https://community.obsidian.md/plugins/study-agent), plus an owner-supplied academic-plugin round-up (17 plugins) and its reader comments, all supplied Nov 3, 2026. The marketplace pages are script-rendered, so the two named plugins were checked against their public forum/GitHub descriptions where available. Study Agent's exact study loop still needs a live inspection before any port is scoped.

#### Directly named community plugins

| Source | Idea worth keeping | Fit in MCQ Tracker | Decision |
|---|---|---|---|
| **Study Flow Planner** | A visual day/week/month timeline from 05:00 to 23:00; subject colours; events linked to notes; automatic detection of daily-note lines such as `09:00 Event title`; per-event tags, notes, colour and done state. | **Time blocks** owns local Day, Week, Grid, Timeline, project lenses and task-in-block state. **1.210.2 shipped the one-way daily-note reader**: a configured `YYYY-MM-DD.md` is previewed, duplicates are skipped and only new lines become blocks. Subject colour rules and event tags outside block tasks remain. | **Partially implemented.** Daily-note import is live; subject colours are the remaining candidate. No Study Flow Planner code or styles copied. |
| **Study Agent** | A bring-your-own-key AI assistant configured with provider, API key, Refresh and model selection inside Obsidian. The public excerpt shows the provider/model setup; the exact study loop is not clear. | Direct AI, OpenCode chat, generation, blind verification, write guards, previews and undo already cover the AI surface. A second AI runtime or agent loop would duplicate settings, budgets and safety checks. | **Do not adopt as a second runtime.** Revisit only as a note-grounded study workflow on the existing AI service, after a live inspection and a separate spec. No provider key or prompt is added by this row. |

#### Academic round-up plugins

These are the 17 plugins in the owner-supplied academic round-up. “Reference only” means the interaction is useful design input but does not justify a new subsystem.

| Plugin | Idea worth keeping | Fit / decision |
|---|---|---|
| **Calendar** | A daily-note calendar for a research log, with each day linking to work done that day. | **Covered in 1.210.2.** Time blocks already previews the selected day's `YYYY-MM-DD.md` and offers **Open daily note**, so no second calendar or daily-note plugin is needed. The Calendar module keeps reading ICS/event notes only. |
| **Callout Manager** | A picker for callout types, icons and colours. | **Reference only.** Callouts already render; a visual callout builder is editor styling, not study workflow. Do not add a dependency. |
| **Citations** | Import a BibTeX library and create citation notes with paper metadata. | **Implemented in 1.210.3** as the opt-in **Citations** module: a local `.bib` parser, a filterable library, plain-text reference copy and an explicit citation-note action. No reference manager, network request or CSL dependency. Notes are in `docs/release-notes/1.210.3.md`. |
| **cMenu** | A floating formatting toolbar. | **Do not adopt.** Existing editor commands and the command palette cover the need; a second toolbar adds clutter and maintenance. |
| **Commander** | Put arbitrary commands on visible buttons in the Obsidian chrome. | **Do not adopt.** The plugin already exposes commands and ribbon entries; per-user chrome customisation belongs to Obsidian. |
| **Custom Attachment Location** | Rename, move and organise pasted attachments by note and folder. | **P3 candidate, import-only.** The importer may route its own attachments, but no vault-wide watcher or automatic move. |
| **Heading Level Indent** | Indent body text under headings for readability. | **Reference only.** A reading CSS preference, not a study data feature. |
| **Hover Editor** | A movable, resizable, editable hover preview. | **Do not adopt.** Obsidian owns page previews; replacing them would be a broad UI fork. |
| **Iconic** | Per-file and per-folder icons or images. | **Reference only.** Cosmetic navigation; no study state. |
| **PDF++** | PDF annotations and deep links to a page or rectangle. | **Page links implemented in 1.210.4.** Every annotation row copies a safe `[[file.pdf#page=N]]` wikilink or opens the PDF at that page. Rectangle/selection links, a PDF renderer and a form engine stay out. |
| **Pretty Properties** | Covers, coloured properties and friendlier property display. | **Reference only.** Cosmetic metadata presentation; the underlying properties stay unchanged. |
| **QuickAdd** | Named capture commands that create a note in the right folder from a template. | **Partially covered.** Calendar class notes and course-note actions use templates. A generic user-defined template builder is not justified yet; revisit only if capture requests keep recurring. |
| **Recent Files** | A recent-note navigator. | **Do not adopt.** Obsidian already has recents and quick switching; no study data is involved. |
| **Style Settings** | Expose theme and plugin CSS variables to the user. | **Reference only.** A theme-integration surface, not a core study feature. |
| **Supercharged Links** | Decorate links by folder, tag or property. | **Do not adopt.** Visual link rules would duplicate Obsidian/theme features and add a styling API. |
| **Tasks** | Aggregate checkbox tasks across the vault, with due dates and query syntax. | **Read-only index implemented in 1.210.5.** The Tasks tab scans Markdown for `- [ ]`/`- [x]` lines with note path and line number, skips fenced code and filters by text, tag or path. No writes, no query language and no task-syntax changes. |
| **ZotLit** | Read a Zotero database directly and create literature notes from it. | **Do not bundle.** It needs a reference-manager database and a second process/integration. A local BibTeX/CSL-JSON import is the safer candidate. |

#### Reader-comment suggestions

These came from the reader comments in the same round-up. Several repeat an earlier row; they are kept here so no idea is lost.

| Suggested plugin or idea | What it could mean locally | Decision |
|---|---|---|
| **Advanced Tables** | Table formatting, navigation and formulas. | Reference only; Markdown tables already render. |
| **cMenu** | Floating formatting bar. | Duplicate of the cMenu row; do not adopt. |
| **Desmos** | Interactive graphing calculator. | Already covered by the local Reference Graph, including regression, sliders, polar, parametric, implicit and 3D modes. |
| **Excalidraw** | Hand-drawn diagrams and embedded drawings. | Do not adopt; a canvas/drawing engine is a separate product. |
| **Extended MathJax** | Extra TeX macros and math rendering. | Reference only; existing Obsidian MathJax rendering is enough. |
| **Homepage** | Open a chosen note on startup. | Do not adopt; startup layout belongs to Obsidian. |
| **HTML Tags Autocomplete** | Autocomplete HTML tags while editing. | Reference only; editor assistance, not study state. |
| **Kanban** | Board view over Markdown cards. | Do not adopt; projects and the planner already provide grouping, and a board is a separate view. |
| **LaTeX Suite** | Snippet expansion and math shortcuts. | Reference only; no snippet engine. |
| **Multi Column Markdown** | Multi-column note layouts. | Reference only; responsive study cards already use CSS columns where useful. |
| **Obsidian Matrix** | Matrix and vector rendering/entry. | Reference only; existing math rendering covers display, and a matrix editor is outside the current graph scope. |
| **Paste URL into Selection** | Turn selected text into a Markdown link. | Reference only; a small editor convenience, not a study module. |
| **Sortable** | Click-to-sort Markdown tables. | Do not adopt; a live table widget would need a renderer and write-back contract. |
| **Table Extended** | Merged cells and extended table syntax. | Do not adopt; non-standard Markdown reduces portability. |
| **Tag Wrangler** | Rename and merge tags across the vault. | **Local task-tag rename implemented in 1.210.9:** the Study Workspace Tasks tab renames one tag across `studyTasks` only, with a usage line, a merge when a task already has the new name and the existing four-tag cap; a vault-wide rewrite is still rejected. |
| **Zoom** | Click or hover to zoom images. | Reference only; Obsidian image preview already exists. |
| **Footnote shortcut / Tidy footnotes** | Insert and renumber footnotes. | Reference only; editor convenience, not study state. |
| **Better Word Count** | Selection and vault word counts. | **Read-only writing-session count implemented in 1.210.10:** the Study Flow tab counts the active note's words, sentences and reading time and the words added after **Start session**, then records one bounded local row per finished session. No note write, no background index and no vault-wide count. |
| **Annotator** | Annotate PDFs and other documents. | Partially covered by the PDF Annotation Index; no new annotation engine. |
| **Dictionary** | Look up a selected word in a dictionary. | **Local glossary implemented in 1.210.9:** `src/glossary.js` reads `Term: definition` lines and two-column tables from the vault's Markdown and ranks a lookup; the Vocabulary tab builds it read-only and links each row to its note and line. No external dictionary, key or request. **1.210.10 widens the same read-only index to the saved vocabulary list and the lecture-note `| Term | Definition | Lecture |` tables**, so one lookup covers note definitions, lecture vocabulary and dictionary words, with a note definition winning any duplicate. |
| **Full Calendar** | A full calendar with event notes. | Already supported read-only for event notes; the planner now consumes the same events. |
| **Quick Add** | Duplicate of QuickAdd. | Already covered by the QuickAdd row. |
| **Stille table of contents** | Generate and maintain a table of contents. | Reference only; headings and links already work. The name is recorded as written and is unverified. |
| **Text Format** | Bulk text formatting commands. | Reference only; editor scope. |
| **Iframes** | Embed web pages inside notes. | Do not adopt; iframes add remote-content and privacy risk. |
| **Dataview** | Query notes with a query language. | Do not adopt the dependency or a dynamic query language. Existing filters and local indexes are deliberate. |
| **Dice Roller** | Pick a random note, line or table row. | The useful idea is local random recall; the Recall Scheduler and practice filters already cover it without a dice dependency. |
| **Highlightr** | A palette for text highlights. | Reference only; cosmetic editor styling. |

#### Rule for any later adoption

Any ranked item must be original code or a clearly licensed port with a notice; no runtime dependency, dynamic code, background service, telemetry or hidden network request. Read-only first, preview before a note write, undo where a write is allowed, and off by default when it adds a new surface. A local parser is preferred to a live integration with another plugin.

**Candidate order if the owner ranks this backlog:** (1) the Study Flow Planner daily-note line reader and subject colours inside Time blocks; (2) a local BibTeX citation-note preview; (3) PDF annotation deep links and a read-only vault task index; (4) an optional Open daily note action. Study Agent stays a reference for workflow design, not a second AI runtime. Everything else in this section is reference-only until a concrete study workflow and acceptance test are written.

### 5.25 Voice plugin scan — captured Nov 3, 2026

**Sources:** [Voice to Text](https://github.com/satosprod/voice-to-text), [Quick Voice Note](https://github.com/spencer1975/quick-voice-note), [obsidian-voice](https://github.com/chrisurf/obsidian-voice) and [Elton AI](https://github.com/swayinfo/elton-ai), all supplied Nov 3, 2026. **Status:** the local parts are ranked and shipped one release each; anything needing a cloud speech provider, a paid transcription service, a relay or a second assistant runtime stays out.

| Plugin | Idea worth keeping | Decision |
|---|---|---|
| **Voice to Text** (SATOSprod) | Push-to-talk dictation with Deepgram Nova 2 or Groq Whisper, a fixed model and language list, hotkey capture, optional WAV saving. | **Do not adopt.** The licence is proprietary, so no code or styles may be copied, and every path needs a cloud speech key plus a recorder the plugin does not own. The reusable idea — a short voice capture that lands in a note — is covered locally by Quick Voice Note's audio memo path below. |
| **Quick Voice Note** (spencer1975) | One-tap long memos, pause/resume, audio kept in the vault, and a timestamped entry appended to today's note; transcription optional through any OpenAI-format endpoint. | **Audio-first half adopted in 1.210.7.** Local capture saves the recording into a configured folder and appends a `- HH:MM ![[…]]` line to the day's note, with a duration and optional note text. Transcription stays out: no paid service, no managed key, and the existing AI settings are not silently reused for audio. |
| **obsidian-voice** (chrisurf) | Audiobook-style TTS with provider voices and MP3 export, plus three content toggles: read or skip code blocks, spell out acronyms, skip website URLs. | **Content toggles adopted in 1.210.6.** Read aloud keeps its local device voice and gains **Code blocks**, **Spell out acronyms** and **Skip website URLs**, all off-by-default in the sense that the previous output is the default. Provider TTS, voice catalogs and MP3 export stay out: they need a speech key and a second audio path. |
| **Elton AI** (swayinfo) | A voice-and-text assistant over the vault, phone app through a relay, Telegram bot, embedding index, templates and scheduled prompts. | **Do not adopt the runtime.** Direct AI, OpenCode chat, generation, verification and write guards already cover the assistant surface; a relay, a bot and an embeddings index would duplicate providers, budgets and safety checks. The useful, safe idea — **voice input lands in a text field for review before it is sent** — is the rule for any future dictation: transcribe into an editable field, never send automatically. |

**Rule for any later voice work:** recording, transcription and speech stay local or use a provider the user configured; audio is written only when the user stops a recording; nothing is transcribed, uploaded or sent to a model without an explicit action; and no second assistant runtime, relay or bot is added. Every release adds no dependency.

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
- [x] Card syntax compatibility and importers: Spaced Repetition, Anki, Quizlet, Kahoot, Blooket and Gimkit CSV import/export (§5.15) — desktop `.apkg` import shipped in 1.50.0, `.apkg` export in 1.116.0, two-way AnkiConnect sync in 1.51.0, Quizlet PDF/test-bank import in 1.102.0 and its device file picker in 1.103.0; LearnKit import/export shipped in 1.114.0
- [x] Answer modes: flip, type and speak via OS dictation, with the deterministic cheap-first grading pipeline (§5.17)
- [x] AI fallback for typed answers that the local grader cannot settle, using the shared AI layer and a validated structured verdict (§5.17)
- [x] Durable grade-later queue for offline, slow or over-budget grading, with batch retry, idempotency and a pending-grade badge (§5.17)
- [x] Self-grade fallback when AI grading is off or the queue is discarded, recorded as `graded_by: self` (§5.17)
- [x] Unified due queue model and Today/command list across cards, vocab and MCQs — interleaved mixed-review sessions shipped in 1.55.0
- [x] Pending-grade visibility in Today and the Cards list, with per-card Review actions and a Grade now retry control (§5.17)
- [~] **Gated** Optional TTS/audio — provider choice, mobile support and an audio-only commute mode still need validation (§11 decision 2). Exam-aware scheduling caps have landed (§4.3); see §5.22.4.

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
- [x] Optional `.apkg` import through a local ZIP/SQLite reader, with scheduling metadata (§5.15) — shipped in 1.50.0; `.apkg` export through a local SQLite writer and stored-ZIP writer in 1.116.0
- [x] Bidirectional AnkiConnect sync with note-ID mapping, content hashes and conflict handling (§5.15) — shipped in 1.51.0
- [x] Notes ↔ practice links — **Reread this** and source backlinks shipped in 1.36.0; the Insights **Concepts** mastery list shipped in 1.107.0 (§5.14)
- [x] Exam/quiz import breadth — GIFT, Moodle XML, QTI, Mochi Markdown and CrowdAnki shipped in 1.21.0–1.23.0; FlashQuiz `@mc`/`@sata`/`@tf`, QuizPort JSON and Markdown checkbox quizzes shipped in 1.108.0; zipped Canvas/Blackboard QTI archives are read in 1.109.0 and LearnKit blocks/quick cards in 1.114.0 (§5.22.3)
- [x] Card and question export — Anki text, Anki `.apkg` (1.116.0), CSV, Markdown, JSON, Mochi `.mochi` (1.113.0) and LearnKit (1.114.0) shipped (§5.15)
- [~] **Open (optional)** Pronunciation feedback for language learners
- [x] Handwritten-work photo reading — shipped in 1.104.0 as an opt-in vision transcript; since 1.107.0 one answer can use up to eight photos read in order and appended, recorded as `answer_pages`; grading still runs on text

**Historical unscheduled list (Oct 28, 2026).** The October 28 ideas are retained for context, not as open work. Shipped items are checked above; §3.9.6 lists every remaining gate, and §5.22.9 is a historical order, not a commitment.

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
- **No `eval`** or dynamic code execution; parameterized-question formulas use a restricted evaluator (§5.16.4). 1.164.0 removed the legacy `quizjs` executor and keeps `quizjson` as the safe card source.
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

### Owner decisions applied (Nov 1, 2026)

The owner accepted the 17 recommended defaults and confirmed the plugin stays free for now. "Gated" means the feature is not implemented because the named external input is absent; it is not a claim that the feature works.

| # | Decision | Outcome | Status |
|---|---|---|---|
| 1 | PDF forms and OCR | Keep BYOK vision OCR and annotation-only PDF tools; no bundled OCR engine or PDF-form library. | Gated |
| 2 | Audio recording, transcription, TTS and pronunciation | OS keyboard dictation and the device speech voice only; no provider recording, transcription or TTS. | Gated |
| 3 | Paid AI scoring, Feynman scoring and RAG | Existing BYOK, user-initiated calls only; no automatic paid calls or new model allow-list. | Resolved |
| 4 | Per-objective tutor | Gated; no objective data model or approved tutor provider. | Gated (this decision) |
| 5 | Web lookup and AnkiWeb | Stay offline; local cited vault search remains. | Resolved |
| 6 | Canvas and Google Classroom | Skip OAuth; ICS remains the schedule path. | Gated |
| 7 | Canvas/Blackboard import variants | Keep the generic QTI importer; report unsupported rows; add no named variant without fixtures. | Resolved |
| 8 | CBT `.vce` and SAT score curve | Skip both; no licensed fixture or official curve. | Gated |
| 9 | MDC R5 document parity | `.ppsx` text import ships; AI vision and legacy binary `.ppt`/`.doc` remain gated on an approved provider/model and binary fixtures. | Partial (local text path implemented) |
| 10 | Central card schedules | Stay note-backed; the portable archive is the escape hatch; no migration or rollback work. | Resolved |
| 11 | Review dock placement | Stay docked underneath the note; no beside-the-note split. | Resolved |
| 12 | Code Runner | No in-plugin code execution, sandbox or language allow-list. | Resolved |
| 13 | Misconception diagnosis | Gated; keep the existing error log and mistake taxonomy unchanged. | Gated (D4) |
| 14 | Keyboard-first practice | Minimal Space/Enter primary action plus Esc end; no 1/2/3 self-grade or U undo. | Implemented unreleased |
| 15 | Hold Course / uni-calendar interop | Read-only mapping is the only approved direction, but it is gated on one sample note from each plugin; ICS remains. | Gated |
| 16 | Qwen provider preset | **Qwen (DashScope)** is selectable with `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` and `qwen-plus`; model discovery and chat use the OpenAI-compatible endpoints. A live keyed request remains an owner validation step. | Implemented unreleased |
| 17 | Chemistry/biology/circuit rendering | Local `chem`, `biology`/`biosequence` and `circuit` blocks render in question content; original local code, no copied source, no simulator. | Implemented unreleased |
| — | Distribution and exam-content policy | Free with BYOK and optional donations; no bundled exam content; keep the import-rights warning. | Resolved |

Manual and release gates (real Obsidian visual/math/screenshots, real iOS/Android, AP FRQ calibration, live AnkiConnect/CouchDB, AI-quiz fact review and community-directory errors) are handled separately by the owner. No pass or accuracy claim is made until the owner reports a result.

### Other product questions (not part of the 17 defaults)
Items 3, 7 and 11 are resolved below; items 1, 2, 4, 5, 8, 9 and 10 remain open product questions and do not block the plugin's implemented code.
1. **Name and positioning:** Keep "MCQ Tracker" as the display name, or rename to reflect the full suite (while keeping the plugin ID)?
2. **SAT/AP content:** Will you provide original sample question packs? How should the plugin guide users who import official materials?
3. **Voice input — resolved Nov 1, 2026:** OS keyboard dictation only; in-plugin recording and transcription are gated on provider and mobile audio validation.
4. **Agent on mobile:** Is read-only tutor mode on phones enough, with full agent mode desktop-only through OpenCode?
5. **FRQ on mobile:** Voice-dictated FRQs only, or skip FRQs on phones in v1?
6. **Handwritten work:** Resolved — photo-of-handwriting reading shipped in 1.104.0 as an opt-in vision transcript; grading still runs on text.
7. **Monetization — resolved Nov 1, 2026:** the plugin stays free with BYOK and optional donations; no paid gate or managed AI tier.
8. **Compatibility promise:** How long will you keep supporting existing MCQ Tracker note formats? (Recommended: indefinitely, with migrations.)
9. **Beta channel:** Will you maintain a BRAT beta track for risky features such as the agent and scheduler changes?
10. **Standalone mobile trigger:** What download, retention, or sync-demand signal is sufficient to justify a separate React Native + Expo app?
11. **Monetization timing — resolved Nov 1, 2026:** no paid experiment; revisit only after a validated standalone or hosted service exists.

---

### Mission open questions (Oct 30, 2026)

The mission asked for every remaining plan item to be implemented. These cannot be completed in the build environment or need an external decision, so they are recorded instead of guessed at:

1. **Real Obsidian visual/screenshot pass and the mobile audit:** no Obsidian window, no iOS/Android hardware.
2. **Bundled OCR engine and PDF form filling:** need an audited permissive OCR engine and an MIT PDF form library; the plan forbids approximating them.
3. **TTS, audio commute mode and pronunciation feedback:** need a provider and mobile audio validation.
4. **AP FRQ accuracy claims:** need human-scored fixtures and go/no-go thresholds.
5. **Community directory relisting:** needs the owner's signed-in dashboard review errors.
6. **Qwen provider preset — resolved Nov 1, 2026:** implemented unreleased with the DashScope OpenAI-compatible endpoint and `qwen-plus`; model discovery and chat are covered by a mocked request test. A live keyed request remains an owner validation step.
7. **MIT plugin audit (mission step 8):** complete on Oct 30, 2026. §3.9.1 lists 28 MIT-verified related repositories with features this plugin lacks, ordered for step 9; 13 further candidates were non-permissive or unlicensed and stay ideas-only under §3.10. Remaining human decision: who signs off `NOTICES.md` attribution and the copied-file review before any code is reused. No code was copied in the audit.
8. **Study bundle import:** resolved in the working tree — export and import ship with the never-overwrite policy in §5.22.11.
9. **Per-note SM-2/Leitner choice and file-explorer due indicators (step-9 rows 3–4):** resolved in 1.139.0. A card may set `scheduler: ladder|sm2|fsrs`; the existing attempt path resolves it before deck/global choice. The opt-in `cards.fileExplorerDue` marker uses Obsidian's internal file-explorer view and silently does nothing when unavailable, so it is best-effort rather than a public-API guarantee.
10. **Live CouchDB verification (step-9 row 17):** the in-repo client, merge policy and manual commands are tested with mocked request URLs, but no real CouchDB server or network is available here. The owner should test against a CouchDB 3.x server, confirm database permissions and HTTPS, and run a two-device conflict/reconnect check. No credentials belong in the repository.
11. **Live AnkiConnect smoke test:** no Anki desktop or AnkiConnect endpoint is available in this build environment. The automated suite covers note building, push/update planning, backlinks, tables, media conflicts and failures with mocked requests. The owner should run [docs/anki-smoke-test.md](docs/anki-smoke-test.md) in a real Obsidian vault and Anki desktop, then record the AnkiConnect, Anki and Obsidian versions. No release should claim the real-UI path is verified until that pass is done.
12. **AI-generated Spaced Repetition quiz accuracy:** the 1.148.0 path validates the note syntactically by parsing it back through the existing importer and shows every card before writing, but factual accuracy still depends on the source note and provider. The owner should spot-check generated quizzes in a real vault; this is the same human review step as the other AI generators, not an unimplemented code path.
13. **Misconception diagnosis on a miss (§5.22.4 item 1):** recorded verbatim: “**Misconception diagnosis on a miss.** The mistake taxonomy already asks *why* a question was missed; a named-misconception field plus an automatic re-check question (Claude Tutor) would turn the error log into a feedback loop. Extends §5.9 and the existing error log, with no new storage.” It needs owner decisions the plan does not specify: the named-misconception list and copy, whether the re-check question is generated immediately or queued, which provider path and AI-off fallback apply, and whether misconception/re-check data is stored on question notes or in the existing history/error log with a durable re-target key. No code was added for item 1 in 1.153.0; item 3 shipped instead.

### Later decision items (Oct 30, 2026)

14. **Omniscient keyboard-first practice shortcuts — resolved Nov 1, 2026:** the minimal map is implemented unreleased in `src/practice-keys.js`: Space/Enter submits an armed question, reveals a study card or advances a finished result; Esc ends the session. Text fields and focused controls keep native keys. The full 1/2/3 self-grade and U undo map is rejected because MCQ auto-grades. Covered by 5 focused tests.
15. **Quizzable define-once/play-anywhere and partial-credit scoring — resolved Oct 31, 2026:** unique `quiz-definition` and `playable-quiz` blocks reuse a definition by `Id:` without changing Simple Quiz’s `quiz` block. Block-level `Partial: true` enables multi-select proportional credit with a configurable `Penalty:` (default 0.5, clamped 0–1); scores round to a whole percentage, exact selections score 100, and bands still use `Pass:`/`Imprecise:`. Covered by 2 focused tests; full suite 1065.
16. **Odd/even week parity for the Class Timetable term calendar — resolved Oct 31, 2026:** parity lives on the ICS VEVENT as `X-MCQ-WEEK-PARITY: odd` or `even`. When a semester start is set, `applyTermWeeks()` compares the occurrence's numbered term week; reading-week classes keep their existing marker, exams are never hidden, and the property is inert without a semester start. A moved `RECURRENCE-ID` occurrence inherits the series parity unless it declares its own, invalid values are ignored, and `.ics` export preserves the property. Covered by 3 focused tests (2 parser/override, 1 term filter); full suite 1034. Unreleased on `main`.
17. **A-Level Study Coach think-first timer — resolved Oct 31, 2026:** recorded verbatim: “a "think-first" timer that blocks sending to the assistant before a threshold.” Contract: `ai.thinkFirst` is off by default and `ai.thinkFirstSeconds` defaults to 15 seconds, clamped to 5–120 seconds. One countdown starts when a chat panel opens or **New chat** is pressed; it is not reset per message. `ChatPanel.send()` checks the gate before reading context, so Send, Ctrl/Cmd+Enter and quick prompts are all covered, and the shared panel applies the same gate to Direct API and OpenCode. There is no in-chat skip; the only bypass is turning the setting off. The countdown is local and is not persisted between chat sessions. The upstream “thinking credit” note and skip/Z-code flow were not added because the recorded plan requirement specifies only the blocking timer. Covered by 6 focused tests; full suite 1040. Unreleased on `main`.
18. **Obsidian directory removal (Oct 30, 2026):** the plan records that the community-directory entry was removed, but the dashboard reason was never captured and cannot be read from this environment. Do not guess at it or resubmit blindly: open the developer dashboard error, fix it, and record the reason here. The related static-review points are the opt-in OpenCode download and runtime (a consent dialog and SHA-256 verification already exist) and the former dynamic `require(name)` wrapper, which now uses literal `require()` calls behind an allowlist.
19. **Authorship and similarity review (Oct 30, 2026):** much of the code was written with AI coding agents under human direction. The license documents carry no authorship or copyrightability caveat: that text was removed from `docs/license-audit.md` and `CONTRIBUTING.md` at the owner's request in `a7cc97d`, and `LICENSE` is plain MIT and was never modified. The remaining gate (O13) is that no similarity or licence scanner has been run against third-party code; the owner decides whether to run one and how to keep human design and review records before commercial distribution. No scan result is claimed.
20. **Commercial distribution and exam-content policy (Oct 30, 2026):** the plugin bundles no College Board content and an import is the user's own action, but a paid product that advertises importing question-bank PDFs and sending them to AI providers could invite a facilitating claim. The import example and README warning were tightened, but whether to charge, and what import policy to advertise if charging, is an owner and business decision, not a code decision.
21. **Unverified link dump (Oct 30, 2026):** a large set of links was supplied without a specific instruction. The Obsidian plugin candidates for a future step-8 licence pass are `ideaverse-maps`, `width-wizard`, `marginmuse`, `jelly`, `adaptive-practice`, `learnkit`, `free-ai-agents`, `task-hours`, `mathfolio`, `atomview`, `chemspec`, `chemrender`, `chem-search`, `chemedit-universal`, `chemedit`, `code-runner`, `anatomed`, `molren`, `gene-code`, `uncertainty-calc`, `sketch-mechanisms`, `ballistics`, `science-input-helper`, `chemtrails`, `pseudonymizer-tool`, `reverse-complement`, `tipa-support`, `ketcher`, `chemical-structure-renderer`, `periodic-table`, `chem`, `obsidian-circuitjs` and `biosequence`, plus the SAT repositories `imbooz1/sat-math-problem-solver`, `laurenlliu/sat-lesson-plan-generator`, `echa920/sat-math-lab`, `nakshatra30/SAT-PREP`, `Anas099X/OpenSAT` and `hummingbirdrhino-png/sat-trainer`. **Audited Oct 30, 2026 in §3.9.2:** 34 community-plugin listings (29 MIT, 5 NOT MIT), 21 direct repository links (7 MIT, 14 NOT MIT), the Knap repository (MIT), the OER-MCP dataset (no licence) and the non-repository links were classified there. At the time of that audit no code was copied; the local STEM renderers were added later (§5.16.2a).
22. **Link-audit unknowns (Oct 30, 2026):** §3.9.2 records the full pass. Three links remain unresolved: `https://pinesat.duckdns.org/api/questions` returns live SAT questions but publishes no licence or terms; the `swoopeagle/oer-mcp` Hugging Face dataset has no licence in its API metadata; `shouldiremoveit.com` and MakerWorld returned HTTP 403. Do not ingest or copy from these. The science-subject plugin cluster now has local `chem`, `biology`/`biosequence` and `circuit` renderers implemented unreleased; unlicensed sources remain ideas-only and no code was copied.

### Decision queue (Oct 31, 2026)

**Clean-install verification (Oct 31, 2026):** `npm ci --ignore-scripts` completed with 0 vulnerabilities, the full suite passed **1095/1095**, `npm run check` reported no dynamic code in **187 files** and `main.js` current, and `package.json` and `manifest.json` both report **1.166.0**. No version bump or release was made.

**Sweep result (Nov 1, 2026).** `plan.md` has **122 checked `[x]` task items, 10 `[~]` partial/blocked items and 0 unchecked `[ ]` task items** (the literal `[ ]` in historical prose is an example, not a task). The 10 partials are the three manual visual/device/screenshot checks, the five OCR/audio/pronunciation rows and the two AP FRQ calibration rows; each is gated in §3.9.6. The 17 recommended defaults are recorded above; the minimal keyboard map, the Qwen preset and the local chemistry/biology/circuit renderers are implemented unreleased. No bundled provider credential, OCR/PDF engine, OAuth, code execution, web lookup, bundled STEM library or paid tier is added. Qwen is a BYOK preset and the STEM renderers are original local code. No new version or release was made.

**The approved local implementation batch is complete.** The local study modules and the Quizzable slice ship unreleased. The remaining provider/credential/fixture/security rows are explicitly gated by the §11 decisions above or by owner manual checks; no wave approval is pending.

#### Implementation approvals

| ID | Item and current unknown | Options and consequences | Recommended default | Exact question |
|---|---|---|---|---|
| **D1** | **§3.9.3 external rows — RESOLVED Nov 1, 2026.** The local sweep is complete; remaining rows are explicitly gated on providers, credentials, fixtures, hardware or product decisions, not on another local row. | No new external integration is approved by this decision. | — | — |
| **D2** | **Omniscient keyboard-first shortcuts — RESOLVED Nov 1, 2026.** The minimal map is implemented unreleased: Space/Enter activates the primary action (submit an armed question, reveal a study card, advance a finished result) and Esc ends the session. Text fields and focused controls keep native keys. The full upstream 1/2/3 self-grade and U undo map is rejected because MCQ auto-grades. | Implemented in `src/practice-keys.js` and `src/practice-view.js`; covered by 5 focused tests. | — | — |
| **D3** | **Quizzable define-once/play-anywhere and partial credit — resolved Oct 31, 2026.** Implemented with unique `quiz-definition`/`playable-quiz` names, no change to Simple Quiz's `quiz` block. Partial credit is opt-in with block-level `Partial: true`; the default wrong-pick penalty is `0.5`, configurable with `Penalty:` (0–1), and scores are rounded to a whole percentage. Exact selections still score 100; partial results carry `partialCredit` and a pass/imprecise/fail band. | Implemented and covered by 2 focused tests. | — | — |
| **D4** | **Misconception diagnosis — GATED Nov 1, 2026.** The existing error log and mistake taxonomy remain unchanged; no named list, re-check timing, provider fallback or storage field is invented. | Gated; no code change. | — | — |
| **D5** | **Hold Course / uni-calendar interop — GATED Nov 1, 2026.** Read-only mapping is the only approved direction, but no sample note has been supplied, so ICS remains the supported path. | Gated on one sample note from each plugin. | — | — |
| **D6** | **Remaining import-format breadth — RESOLVED Nov 1, 2026.** Keep the generic QTI importer; unsupported Canvas/Blackboard rows are reported, not silently skipped. No named variant is added without fixtures. | Current generic importer remains. | — | — |

**Rows behind D1.** The remaining provider, credential, fixture and security rows are listed with exact gates in §3.9.6 and §3.9.10. The old W2/W3 labels are historical and gate nothing; no shipped row (Qard self-fitting, Pick Me PDF indexing, OS notifications, Feynman AI feedback or the Retain migration) appears among them.

#### Product and business decisions

| ID | Item and current unknown | Options and consequences | Recommended default | Exact question |
|---|---|---|---|---|
| **O1** | **Name and positioning:** keep "MCQ Tracker" or rename the display for the full suite while keeping the plugin ID? | **A. Keep the name and ID** — stable links and updates; the description carries the breadth.<br>**B. Rename the display only** — broader positioning; users must relearn the name.<br>**C. Rename the ID** — breaks installs and data paths; not recommended. | **Keep the name and plugin ID; use the description and tagline to explain the suite.** | Should I keep MCQ Tracker and the plugin ID, or rename the display while keeping the ID? |
| **O2** | **SAT/AP sample content:** will the owner provide original packs, or only link and import guidance? | **A. No bundled content, with link-only guidance** — lowest copyright risk.<br>**B. Original owner-authored packs** — useful onboarding; content and licence work.<br>**C. Curated third-party links** — requires terms review and staleness handling. | **A. No bundled content; keep the import-rights warning and link-only AP resources.** | Should the plugin ship no content and link-only guidance, or original sample packs? If packs, who writes and licenses them? |
| **O3** | **Voice input — RESOLVED Nov 1, 2026.** OS keyboard dictation only; no in-plugin recording or transcription. | Option A. | — | — |
| **O4** | **Agent on mobile:** is read-only tutor mode enough on phones, with full agent mode desktop-only? | **A. Tutor-only mobile, agent desktop-only** — preserves the current safety boundary.<br>**B. Full agent mobile** — unverified mobile permissions and file-edit risk.<br>**C. No AI on mobile** — simplest, but loses the tutor. | **A. Tutor-only mobile; keep OpenCode agent mode desktop-only.** | Is read-only tutor mode on phones enough, with full agent mode desktop-only through OpenCode? |
| **O5** | **FRQ on mobile:** voice-dictated FRQs only, or skip FRQs on phones in v1? | **A. Voice-dictated text only** — reuses the existing grader.<br>**B. Skip FRQs on phones** — smallest mobile surface.<br>**C. Full rubric UI on phones** — not yet designed for small screens. | **A. Voice-dictated text only; no mobile-specific rubric redesign.** | Should phones support voice-dictated FRQs only, or skip FRQs in v1? |
| **O6** | **Monetization model — RESOLVED Nov 1, 2026.** Free with BYOK and optional donations; no paid tier, managed AI or paid gate in the plugin. | Option A. | — | — |
| **O7** | **Monetization timing — RESOLVED Nov 1, 2026.** No paid experiment; revisit only after a validated standalone or hosted service exists. | Option A. | — | — |
| **O8** | **Commercial distribution and exam-content policy — RESOLVED Nov 1, 2026.** No charge and no bundled exam content; keep the import-rights warning. | Option A. | — | — |
| **O9** | **Compatibility promise:** how long must existing note formats keep working? | **A. Indefinite with migrations** — strongest trust; ongoing test cost.<br>**B. Fixed support window** — simpler, but can strand users.<br>**C. No promise** — not recommended for a study vault. | **A. Indefinite support with explicit migrations.** | How long will you support existing MCQ Tracker note formats? Is indefinite-with-migrations approved? |
| **O10** | **Beta channel:** maintain a BRAT beta track for risky agent/scheduler changes? | **A. Yes, BRAT beta before stable** — safer rollout; extra release work.<br>**B. Stable only** — simpler; higher regression exposure.<br>**C. Beta only for named risky features** — middle ground. | **A. Maintain a beta track for scheduler, agent and migration changes.** | Will you maintain a BRAT beta track for risky features, and which changes require it? |
| **O11** | **Standalone mobile trigger:** what signal justifies a React Native + Expo app? | **A. Wait for a measurable demand/retention signal** — avoids building on enthusiasm.<br>**B. Try a PWA/web test first** — cheaper validation, but not a store app.<br>**C. Start the app now** — highest cost and maintenance. | **A. Do not start the standalone app until a measurable trigger is agreed; test a PWA first if needed.** | What download, retention or sync-demand signal starts the standalone app, and should a PWA test come first? |
| **O12** | **MIT audit sign-off:** who approves `NOTICES.md` and copied-file review before reuse? | **A. Owner signs every copied file and NOTICES entry** — clear accountability.<br>**B. Delegate to a named reviewer** — needs a recorded name.<br>**C. Copy no third-party code** — safest, but loses parity work. | **A. Owner sign-off before any copied file is merged; no code is copied without it.** | Who signs the NOTICES attribution and copied-file review before any MIT code is reused? |
| **O13** | **Authorship and similarity review — GATED Nov 1, 2026.** No scan is run while the plugin is free; a similarity/licence scan is required before any commercial distribution and the result must be recorded. | Gated until commercial distribution. | — | — |
| **O14** | **Unverified links and licences — RESOLVED Nov 1, 2026.** Audit only named candidates before any code or dataset is used; unresolved links stay ideas-only. | Option A. | — | — |

#### External and verification gates

| ID | Item and current unknown | Options and consequences | Recommended default | Exact question |
|---|---|---|---|---|
| **E1** | **Real Obsidian visual, math/chemistry/STEM and screenshot pass — OWNER MANUAL GATE (Nov 1, 2026).** No visual or screenshot claim is made until the owner supplies results. | Owner handles separately. | — | — |
| **E2** | **Real iOS/Android mobile audit — OWNER MANUAL GATE (Nov 1, 2026).** No hardware or mobile-path claim is made until the owner supplies results. | Owner handles separately. | — | — |
| **E3** | **Bundled OCR engine — RESOLVED Nov 1, 2026.** Keep the opt-in BYOK vision path and state that no bundled OCR engine exists; image-only offline scans remain unsupported. | Option B. | — | — |
| **E4** | **PDF form filling and full editor — RESOLVED Nov 1, 2026.** Keep annotation-only PDF tools; do not approximate AcroForm filling without an audited library. | Option B. | — | — |
| **E5** | **TTS, audio commute and pronunciation — GATED Nov 1, 2026.** Device speech only; provider TTS, commute playback and pronunciation stay gated by this decision until a provider and real-device audio test exist. | Option C. | — | — |
| **E6** | **AP FRQ accuracy — GATED Nov 1, 2026.** Keep the explicit no-accuracy-claim limit until human-scored fixtures and go/no-go thresholds exist. | Option B. | — | — |
| **E7** | **Live CouchDB verification — OWNER MANUAL GATE (Nov 1, 2026).** Keep sync labelled unverified until a CouchDB 3.x two-device conflict and reconnect test is recorded. | Owner handles separately. | — | — |
| **E8** | **Live AnkiConnect smoke test — OWNER MANUAL GATE (Nov 1, 2026).** Keep the real-UI path unverified until the owner runs `docs/anki-smoke-test.md` and records versions. | Owner handles separately. | — | — |
| **E9** | **Qwen provider preset — IMPLEMENTED Nov 1, 2026 (unreleased).** DashScope’s OpenAI-compatible preset is selectable with `qwen-plus`; a live keyed request remains an owner validation step. | Option A. | — | — |
| **E10** | **AI-generated quiz accuracy — GATED Nov 1, 2026.** Keep the preview and label generated quizzes as needing review; no human spot-check is claimed. | Option B. | — | — |
| **E11** | **Community directory relisting — GATED Nov 1, 2026.** Leave the listing absent until the owner supplies the dashboard review errors; do not guess or resubmit blindly. | Option B. | — | — |

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
- **Practice modes:** timed multi-section tests with resume, optional answer-choice shuffling and a pass mark, Quick Practice, daily quiz, weak-spot and error-log views, adaptive difficulty, study-cards skin, mixed review.
- **Import/AI (optional):** PDF/PPTX/DOCX/etc. → question notes (with figure capture), lecture transcript → practice, OCR, AI tutor, answer verification by a second call, weak-spot generation.
- **Extras:** flashcards/vocab module, Anki/Quizlet/Moodle/QTI/Kahoot/Blooket/Gimkit import-export, AnkiConnect sync, calendar (.ics), assignments + gradebook/GPA, focus timer, reference tools, AP score estimator and FRQ rubric grading, analytics dashboard and `mcq-dashboard` widgets.

#### Quiz Generator
- **Links:** [Directory](https://community.obsidian.md/plugins/quiz-generator) · [GitHub](https://github.com/ECuiDev/obsidian-quiz-generator) · [Obsidian Stats](https://www.obsidianstats.com/plugins/quiz-generator)
- **License:** MIT · **Downloads:** 20k
- **What it does:** AI generates exam-style questions from notes or folders you pick, then you answer them in a quiz UI with real-time feedback.
- **Features:** 7 question types (true/false, multiple choice, select-all, fill-in-the-blank, matching, short answer, long answer); saves questions as callouts or as flashcards compatible with the Spaced Repetition plugin; reopen saved quizzes; 22 generation languages; LaTeX; providers: OpenAI, Google, Anthropic, Perplexity, Mistral, Cohere, Ollama.
- **Status:** last updated about 2 years ago; its own roadmap lists test mode, spaced repetition, PDF/image generation, and difficulty settings as not yet shipped. The directory scorecard shows Health "Fair" and Review "Caution".
- **Has that you don't:** 22-language generation; more AI providers (Perplexity, Mistral, Cohere); picks any notes/folders at generation time.
- **You have that it doesn't:** persistent scoring and history, spaced review, timing, analytics, timed tests, PDF import, and nearly everything else.

#### CBT Exam Simulator
- **Links:** [Directory](https://community.obsidian.md/plugins/cbt-exam) · [GitHub](https://github.com/nazdridoy/obsidian-cbt-exam) · [Obsidian Stats](https://www.obsidianstats.com/plugins/cbt-exam)
- **License:** MIT · **Downloads:** 2k
- **What it does:** timed, computer-based-test-style exams from a simple text syntax in one note.
- **Features:** exam runs in its own workspace tab with timer and question navigator; 7 question types (multiple choice, select-all, true/false, fill-in, matching, short and long answer); adaptive study mode (configurable mix of improvable vs. mastered, default 70% improvable); per-quiz history saved in a sidecar markdown file; mark for review; color-coded review mode; results dashboard; retake; Markdown + LaTeX; frontmatter options for time limit, pass score, shuffle, and question ranges; companion converter for VCE exam files.
- **Has that you don't:** compact one-file quiz syntax; VCE converter; a separate per-quiz history file (MCQ Tracker stores per-question attempts in note properties).
- **You have that it doesn't:** spaced repetition, confidence ratings, mistake tags, PDF import, AI features, flashcards, calendar, deeper analytics, numeric/units grading.

#### Spaceforge
- **Links:** [Directory](https://community.obsidian.md/plugins/spaceforge) · [GitHub](https://github.com/dralkh/spaceforge)
- **License:** MIT (bundles ts-fsrs and fzstd, both MIT) · **Downloads:** 2k
- **What it does:** spaced repetition for whole notes plus an AI study suite. This is the **closest overlapping competitor** and it ships updates constantly.
- **Features:** FSRS and SM-2 scheduling; review bar docked under the note; leech handling and lapse checkpoints; AI-generated MCQs per note; adaptive AI tutor that charts a note into learning objectives and tracks understanding/recall/transfer (recall counts as durable only after two different days); study workspace with Learn, Visualize, Mind map and Summary; optional web lookup with citations; Anki-style deck engine (flip, reversed, MCQ, cloze, typed answer) with `.apkg` import and export, AnkiConnect background sync, and AnkiWeb search; statistics page (heatmap, 30-day forecast, true retention, leeches); Pomodoro timer; calendar events with recurrence and categories; 20+ AI providers including local servers and agent CLIs; optional progress file that travels with the vault; 22 commands.
- **Storage:** review data in the plugin's central data file, keeping note frontmatter clean.
- **Has that you don't:** objective-based AI tutor, cited web lookup and AnkiWeb search (all gated), the docked whole-note review bar with lapse checkpoints, a review-schedule calendar with estimated completion, Anki-style maturity/memory-now/interval-distribution statistics, local calendar event creation with recurrence and categories, and a central data file. Mind map/visualize/summary, SM-2 (per-deck cards), whole-note review, the 30-day forecast and leech flags now ship here.
- **You have that it doesn't:** question-first MCQ practice with passages, timed multi-section tests, per-question timing, confidence calibration, mistake tags, PDF/document → question import with figures, numeric/units/parameterized questions, FRQ rubric grading, gradebook/GPA, AP tools, Quizlet/Kahoot/Moodle formats, exam-aware scheduling, progress stored in each question's own properties.

#### Omniscient
- **Links:** [Directory](https://community.obsidian.md/plugins/omniscient) · [GitHub](https://github.com/fortnitemaster32/Omniscient) · [Obsidian Stats](https://www.obsidianstats.com/plugins/omniscient)
- **License:** MIT · **Downloads:** 592 in about 2 months
- **What it does:** quiz-and-recall sessions based on Cal Newport's method. Questions are `> [!Question]` callouts in one file or a folder; the answer stays hidden until you reveal it and you grade yourself.
- **Features:** self-grade Struggling / Almost / Mastered(n); status written onto the question line; "exam-ready" after N consecutive mastered passes; filters by status, difficulty and section; shuffle; per-question hints; undo; keyboard-driven (Space, 1/2/3, H, N, S, U, Esc); per-file progress summary; sample quiz and usage guide. The author discloses it was built with an AI coding agent. Requires Obsidian 1.13.0+.
- **Has that you don't:** many questions per file (Quick add covers lighter authoring), keyboard-first flow (minimal map implemented unreleased; full 1/2/3/U map rejected), and a one-sentence pitch. Per-question hints ship here in 1.156.0 and the mastered-pass exam-ready badge in 1.157.0.
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
| Select-all / true-false / fill-in / matching | ✅ (select-all/true-false 1.110.0; fill-in/matching 1.112.0) | ◐ (cloze, typed, MCQ in decks) | ✅ | ✅ | ❌ | ❌ |
| Short / long free response | ◐ (self-grade + FRQ rubric) | ◐ (typed cards) | ✅ | ✅ | ◐ (self-graded) | ✅ (text answers) |
| Spaced repetition | ✅ | ✅ | ❌ | ❌ (on roadmap) | ❌ | ❌ |
| Whole-note review | ✅ (optional note queues, modal) | ✅ (docked bar) | ❌ | ❌ | ❌ | ❌ |
| FSRS | ✅ (optional) | ✅ | ❌ | ❌ | ❌ | ❌ |
| SM-2 | ✅ (per-deck cards; whole-note review uses the ladder or FSRS) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Leech / lapse handling | ✅ (question leech flag or suspend; note-level lapse checkpoints are proposed) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Timed test / exam mode | ✅ (multi-section) | ❌ | ✅ | ❌ (on roadmap) | ❌ | ❌ |
| Per-question timing | ✅ | ❌ | ◐ (total time) | ❌ | ❌ | ❌ |
| Confidence ratings + calibration | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mistake-type tagging | ✅ | ◐ (AI tutor error categories) | ❌ | ❌ | ❌ | ❌ |
| Adaptive / weak-spot practice | ✅ | ✅ (tutor) | ✅ | ❌ | ◐ (not-mastered filter) | ❌ |
| Analytics dashboard | ✅ | ✅ | ◐ | ❌ | ◐ (per-file summary) | ◐ (score history) |
| Progress stored in the note files | ✅ (properties) | ❌ (central data file) | ◐ (sidecar file) | — | ✅ | ✅ |
| Many questions in one file | ❌ (one note each) | ✅ (deck files) | ✅ | ✅ | ✅ | ✅ |
| Inline quiz rendering inside a note | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Question / option shuffling | ✅ (per-test option shuffle in 1.117.0; random pick mode) | ❌ | ✅ | ❌ | ✅ | ❌ |
| Pass-score threshold on timed tests | ✅ (1.117.0) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Mastered-pass exam-ready badge | ✅ (1.157.0, opt-in; default 2) | ❌ | ❌ | ❌ | ✅ (default 2) | ❌ |
| Inline quiz results in note frontmatter | ✅ (1.158.0, opt-in `quizResults`) | ❌ | ❌ | ❌ | ❌ | ◐ (Quiz Results section) |
| Reorder questions in inline quizzes | ✅ (1.159.0, opt-in; exact order) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Shared-option choice questions | ✅ (1.161.0, opt-in) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Typed numeric with tolerance in inline quizzes | ✅ (1.160.0, opt-in) | ❌ | ❌ | ❌ | ❌ | ❌ |
| AI question generation | ✅ (optional) | ✅ | ❌ | ✅ | ❌ | ✅ (via Claudian / clipboard) |
| Direct LLM API support | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| AI tutor / chat | ✅ (optional) | ✅ (objective-based) | ❌ | ❌ | ❌ | ❌ |
| AI answer verification (second pass) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Web lookup during study | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Documents / PDFs → questions | ✅ | ❌ | ◐ (external VCE converter) | ❌ | ❌ | ❌ |
| Flashcards | ✅ (optional) | ✅ | ❌ | ◐ (saves in SR format) | ❌ | ❌ |
| Anki `.apkg` import | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Anki `.apkg` export | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| AnkiConnect sync | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Quizlet / Kahoot / Moodle import-export | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Calendar | ✅ (.ics; Full Calendar notes read-only) | ✅ (own event CRUD + recurrence) | ❌ | ❌ | ❌ | ❌ |
| Focus / Pomodoro timer | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Exam-aware scheduling / cram mode | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assignments + gradebook / GPA | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reference tools (calculator, periodic table, AP estimator) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mind map / visualize / summary views | ✅ (`study-map` block and local summary, unreleased; no Visualize canvas) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Multi-language generation | ❌ (not documented) | ◐ (tutor language) | ❌ | ✅ (22) | ❌ | ◐ (ja / en / same) |
| Desktop + mobile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Updated Nov 1, 2026:** corrected the stale SM-2, leech/lapse and mind-map rows now that per-deck SM-2 cards, question leech handling and the `study-map` block ship; added whole-note review and noted that Spaceforge's own event CRUD and review-schedule calendar are still gaps. The snapshot date for the rest of the table remains 2026-10-29.

### 13.4 Competitor gaps and where they stand

Ordered roughly by how often they appear across competitors and how much they matter for exam prep. Shipped items stay for the record:

1. **More question types:** select-all-that-apply, true/false, fill-in-the-blank and matching (CBT Exam Simulator and Quiz Generator both have all four). **Shipped in 1.110.0 and 1.112.0.**
2. **Lighter authoring:** every competitor except Spaceforge's decks lets you write many questions in a single file. MCQ Tracker needs one note per question with properties, which is heavy for hand-written questions. A plain-text quick-add or multi-question-per-file import would lower the barrier.
3. **Shuffling:** question and answer-option shuffle (CBT, Omniscient). **Shipped in 1.117.0** as an optional per-test answer-choice shuffle; question order comes from the existing pick modes.
4. **Pass-score threshold** on timed tests (CBT). **Shipped in 1.117.0** as an optional percentage on the test setup screen.
5. **`.apkg` export** to Anki (Spaceforge). **Shipped in 1.116.0.**
6. **Leech handling** for repeatedly failed items (Spaceforge). **Shipped in 1.111.0.**
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

The analysis added four gaps that were not explicit in §5.22. All four have shipped; the owner ranked lighter multi-question authoring on Oct 30, 2026 and it is implemented in the working tree:

- [x] **Native select-all, true/false, fill-in and matching practice.** True/false and select-all practice shipped in 1.110.0 with automatic set grading, selectable buttons, attempt history, timed-test support and result marking. Fill-in (`question_type: fill_in`, normalized text with `|` and `accepted_answers` variants) and matching (`question_type: matching`, `Left :: Right` pairs under `## Pairs`, shuffled row pickers, whole-set and per-row grading in practice and timed tests) shipped in 1.112.0. Import already understands `@sata`, `@tf` and QuizPort choice sets (1.108.0).
- [x] **Lighter multi-question authoring.** Shipped in 1.128.0 as **Quick add questions** (§5.22.10): pasted blocks are previewed and written as one ordinary question note each, with a plain-text fallback for SPR items.
- [x] **Timed-test option shuffling and a pass-score threshold.** Shipped in 1.117.0. The test setup screen has **Shuffle answer choices** and a pass percentage, both saved in defaults and blueprints. A shuffled order is stored with the session, so the review and a reopened test show the same order while saved answer letters still match the note. The pass mark is reported on objective questions.
- [x] **Leech handling** for repeatedly failed items, shipped in 1.111.0 as an opt-in threshold with a flag or suspend action, `leech_lapses`/`leech_since` properties and automatic clearing on a correct answer. Distinct from the manual Suspend/Bury controls.

**Status update (Nov 1, 2026):** the local mind-map/summary slice shipped as the `study-map` block and `vault-search` covers cited local lookup, so mind maps are no longer a gap. The objective-based tutor is gated by §11 decision 4 and cited web lookup by §11 decision 5, so they are gated rather than rejected. The Spaceforge audit also adds four local rows (docked note review, review calendar/workload, Anki-style statistics and local calendar events) in §3.9.7. `.apkg` export shipped in 1.116.0 with a tested SQLite writer, so it is no longer a gap.

### 13.10 dralkh plugin family review (Nov 1, 2026)

Six plugins by the same author were read on Nov 1, 2026; the Spaceforge row still carries provider-gated features and its README has moved on since the Oct 30 comparison. **Every repository is MIT** (verified in each `LICENSE`), so ideas may be adapted; **no code was copied**, and nothing here changes a shipped behaviour.

| Repository | What it is | Relevant to MCQ Tracker? |
|---|---|---|
| [spaceforge](https://github.com/dralkh/spaceforge) | FSRS/SM-2 whole-note review, AI MCQ generation, note tutor, Pomodoro, calendar events, statistics | Yes — the closest rival; nine specific gaps below |
| [mdc](https://github.com/dralkh/mdc) | AI-assisted PPTX/PDF/DOC/DOCX → Markdown converter (CLI plus Obsidian plugin) | Partly — `.ppsx` text import now ships through OOXML; AI vision and legacy binary formats need a provider/LibreOffice or Poppler and stay gated |
| [seerai](https://github.com/dralkh/seerai) | Zotero 10 research assistant: library chat, RAG, OCR, federated scholarly search, PRISMA review | Marginally — provider- and platform-gated; only the evidence-table idea transfers |
| [hatch](https://github.com/dralkh/hatch) | Pixel-art pet generator (sprite atlases, web app, CLI) | No — unrelated to study tracking |
| [naqsh](https://github.com/dralkh/naqsh) | Deterministic Arabic calligraphy avatars from semantic roots | No — decorative, outside the question-first surface |
| [aurora](https://github.com/dralkh/aurora) | KDE/macOS/Windows sleep calculator with bedtime and wake alarms | No — desktop tray app, not an Obsidian plugin |

**Spaceforge features this plan does not record yet.** Rows 1–7 are local (no provider, no network) and could ship behind a Global → Modules switch in the existing Practice, Retention or Calendar surfaces; rows 8–9 are local but are product-scope decisions; row 10 is already the gated `Retain` migration row.

1. **Docked in-place review bar.** The note is reviewed in its own tab with grading controls docked underneath, so nothing covers the note and no panel reopens between items. Grades preview the interval each would schedule; `1`–`4` (FSRS) or `0`–`5` (SM-2) grade, `n` skips, `p` postpones a day, `u` undoes the last rating, `Esc` ends; a **Grade layout** setting picks one row, a stacked palette or auto by pane width; the dock is resizable and can also sit beside the note as a vertical split. Practice and timed tests are currently their own views, so this is the one structural difference worth a decision.
2. **Same-session requeue.** A failed grade keeps the item in today's queue and brings it back after the others, and the run ends only once everything has been passed. MCQ Tracker has bury/suspend and leech handling but not this re-drill loop.
3. **Lapse checkpoint prompt.** At a configurable lapse count (8 by default) the bar asks whether to reset the item's progress, rest it for a week, remove it from the schedule, or carry on. The existing leech flag and suspend action cover the end state, not the interactive checkpoint.
4. **Two-different-days durability rule.** The tutor counts recall as durable only when it was produced on two separate days, and tracks understanding, recall and transfer separately per objective. This is a cheap, honest rule for the confidence-calibration and retention claims.
5. **Retention and collection analytics.** True retention split by maturity (learning steps, young < 21 days, mature 21+), the Again/Hard/Good/Easy button mix with the Again rate split by maturity, interval/ease/FSRS-stability/FSRS-difficulty distributions with medians, a "memory now" retrievability estimate for FSRS material, per-deck summaries and a clickable heatmap day breakdown. The Retention tab has a 30-day forecast and a heatmap but no maturity split, button mix or distribution percentiles.
6. **Permanent per-day counters.** Each review folds into a per-day counter so year-long heatmaps, streaks and all-time retention survive even though the detailed review log is capped (1,000 entries upstream; the inline-quiz attempt log here caps at 500). Worth copying before any long-range chart is promised.
7. **Folder → hub-note linking.** Adding a folder to review links its notes through the folder's main note, falling back to the most-linked note, including outgoing links but not sibling folders. MCQ Tracker has folder topics in the Quiz index but no linking rule.
8. **Pomodoro timer.** Configurable work/short/long durations with session tracking; `src/` has no Pomodoro implementation at all. Overlaps Study Flow, so it needs a "is a timer in scope" answer rather than a code answer.
9. **Calendar event CRUD with recurrence.** Create/edit/delete local events with colour categories, daily/weekly/monthly/yearly recurrence plus an end date, and quick create from a day cell. MCQ Tracker imports and exports ICS and reads Full Calendar notes read-only; it has no local event editor and writes recurrence only through ICS properties.
10. **Central schedule storage with a custom data path** plus automatic migration from legacy locations. **RESOLVED (Nov 1, 2026):** schedules stay note-backed; the portable card archive is the escape hatch. No migration trigger or rollback path is added because no migration is performed.

**Also worth recording.** Spaceforge writes a session report back into the vault as study notes and cards, keeps a per-objective conversation and draft so switching objectives never loses an answer, and offers optional web lookup whose citations are restricted to sources actually retrieved. The last one only becomes buildable once a search endpoint is approved.

**Not adopted from the other five.** Hatch, naqsh and aurora have no study-tracking surface. MDC's `.ppsx` text path now ships; its remaining conversion pipeline depends on LibreOffice and Poppler binaries that a plugin cannot bundle, so the binary/vision slice stays in the gated document-import row. SeerAI's federated scholarly search, PDF OCR and PRISMA workflow are provider- and platform-gated; the only transferable idea is a paper/evidence table (structured extraction across notes), which is equally provider-gated.

**Decisions needed before any of rows 1–9 is implemented:** whether in-place docked review replaces the separate practice surface or is added beside it, whether a Pomodoro belongs in a question tracker, and whether the calendar gains a local event editor with recurrence. Rows 5–7 need no product decision and could ship next.

**Implementation status (Nov 1, 2026):** §3.9.7 R1–R4 cover row 1 (docked review bar), row 3 (lapse checkpoint), row 7 (folder main-note linking) and row 9 (local event CRUD/recurrence). Every previously open local row in this section is now implemented and UI-reachable:

- **Row 2, same-session requeue:** `src/review-session.js` is a pure finite queue consumed by `src/note-review-dock.js`; a missed note moves behind the notes still waiting and returns before the run ends, capped by **Requeue limit** in Settings → Note review. Covered by `tests/review-session.test.js` (ordering, limit, disabled requeue and skip).
- **Row 4, two-different-days durability:** `src/durability.js` writes `recall_days`, `recall_day_count`, `durable_recall`, `durable_on` and `recall_checked` through the existing note/card/question write paths in `src/plugin.js`; a miss clears the run without touching the review history. Settings → Study statistics. Covered by `tests/durability.test.js`.
- **Row 6, permanent per-day counters:** `src/study-counters.js` stores per-day aggregates in `settings.studyCounters`, separate from the capped history, so counts, minutes, streaks and accuracy survive restarts and history trimming. Covered by `tests/study-counters.test.js`, including a save/reload round trip.
- **Row 5, remaining analytics:** `src/study-stats.js` and `src/study-stats-view.js` now add the Again/Hard/Good/Easy button mix with the Again rate, per-deck cards/reviews/retention/average interval, a clickable permanent heatmap with per-day counter detail, and the durable-recall summary beside the existing maturity retention, memory-now, distributions, weekday rhythm, day detail and leeches. Covered by `tests/study-stats.test.js`.
- **Row 8, Pomodoro:** `src/pomodoro.js` (pure work/short/long state machine with auto-start and long-break scheduling), `src/pomodoro-view.js` and `src/pomodoro-settings.js`; an independent **Pomodoro** settings module plus ribbon button, status-bar clock and `open-pomodoro`, `pomodoro-start-pause`, `pomodoro-reset`, `pomodoro-skip` commands. Covered by `tests/pomodoro.test.js`.

Row 10 (central schedule storage) is **RESOLVED (Nov 1, 2026):** the existing in-note `next_review` / `srs` / `sm2` properties remain authoritative, the portable archive is the escape hatch, and no migration or second schedule is created.

Verification for the earlier batch: **1,205 tests pass**.

**Spaceforge parity follow-up (Nov 1, 2026):** the remaining locally-implementable details from rows 1 and 5 and the session-report note from “Also worth recording” now ship:

- Row 1 now has a **Grade layout** setting (one row, a stacked palette or auto by pane width) and a vertically resizable dock (`src/note-review-dock.js`, `src/review-settings.js`, `styles.css`). **RESOLVED (Nov 1, 2026):** the optional beside-the-note split is rejected; the bar stays docked underneath.
- Row 5 now splits the Again rate by maturity and reports interval/ease/stability/difficulty medians (`src/study-stats.js`, `src/study-stats-view.js`).
- **Session report:** `src/session-report.js` writes an opt-in local `review_session_report` note with counts, button mix and item links; Settings → Note review, a **Save session report** button when a docked run ends, and the `save-review-session-report` command. No provider or second review store.
- Per-objective understanding/recall/transfer and the per-objective conversation/draft are **GATED (Nov 1, 2026) by §11 decision 4:** they require an objective data model and an approved tutor provider. Optional web lookup remains offline-only per §11 decision 5.

Final verification: **1,245 tests pass**, `node scripts/build.js` compiles the bundle from **220 modules**, and `npm run check` reports `main.js` current.


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

Full Calendar local event notes are read when a folder is configured (unreleased). Hold Course and
uni-calendar note properties are read-only interop candidates gated on one sample note from each. Testing on real iOS and Android devices remains
blocked.
