# Plugin research handoff — MCQ Tracker

**Written:** Oct 30, 2026 · **Branch:** `freebuff/d470ab4dba71d41ce774c69f` · **Version:** 1.117.0

This file is a portable snapshot of the third-party plugin research done for this repo: which
Obsidian plugins are legally safe to learn from, what they do, and which of their features MCQ
Tracker still lacks. It exists so a new agent can pick the work up without repeating a source-by-source
licence audit.

**Authority:** `plan.md` is the product source of truth and `AGENTS.md` holds the working rules.
Part A below is a verbatim copy of `plan.md` section 3 as of the date above. If the two ever
disagree, trust `plan.md` §3.10 — that table is the one that gets updated.

---

## Part A — The plugin map (verbatim from `plan.md` §3)

### 3. Source plugin map (where each idea comes from)

Legend: **MIT ✅** = MIT stated on the page or repo seen. **Verify ⚠️** = not confirmed. **Unverified is not permission:** under the §3.10 rule, only MIT, BSD, ISC, 0BSD or (with its `NOTICE` kept) Apache-2.0 code may be integrated. Anything else, and anything unverified, is ideas-only and **must not be integrated**.

#### 3.1 Your own and closest relatives

| Plugin | Role in plan | License | Link |
|---|---|---|---|
| **MCQ Tracker** | Core of the product | MIT ✅ | [community](https://community.obsidian.md/plugins/mcq-tracker) |
| **Adaptive Practice** | Ideas: adaptive difficulty, fluency-aware scheduling, blind verification, subtopic memory, generation prompts | MIT ✅ (engine AGPL) | [community](https://community.obsidian.md/plugins/adaptive-practice) |
| **University Schedule and Calendar** (uni-calendar) | Class schedule, `.ics` import, per-class note creation, subject→folder mapping, exam category | MIT ✅ | [GitHub](https://github.com/Cesemess/obsidian-uni-calendar) |

#### 3.2 Flashcards, spaced repetition, FSRS

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

#### 3.3 Vocabulary and language

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **WordFolio** | Vocabulary as Markdown notes, FSRS state in frontmatter, offline dictionary, send-to-Anki | MIT ✅ | [community](https://community.obsidian.md/plugins/wordfolio) |
| **Dictionary Lexicon** | WordNet lookup, save to vocabulary file, vocab flashcards | MIT ✅ | [community](https://community.obsidian.md/plugins/lexicon-dictionary) |
| **FSRS Vocabulary** | Dictionary-as-note (`fsrs-vocabulary` property), per-word FSRS, image/audio/video question columns, stats code block | MIT, verified | [community](https://community.obsidian.md/plugins/fsrs-vocabulary) |
| **Language Made Easy** | Reading with instant lookup, FSRS flashcards, video shadowing, dictation | **AGPL** ⚠️ do not integrate (§3.10) | [community](https://community.obsidian.md/plugins/language-made-easy) |
| **Obsidian Dictionary** (phibr0) | Multilingual lookup, offline dictionary option, frontmatter `lang` key | **AGPL-3.0** ⚠️ do not integrate (§3.10) | [GitHub](https://github.com/phibr0/obsidian-dictionary) |
| **Zhongwen Reader** | Chinese hover dictionary and vocab building | **AGPL** ⚠️ do not integrate (§3.10) | [Obsidian Stats](https://www.obsidianstats.com/plugins/zhongwen-reader) |

#### 3.4 Calendar, courses, assignments, grades

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **Full Calendar** (original) | Events as notes with frontmatter; ICS/CalDAV read-only feeds | MIT ✅ | [GitHub](https://github.com/obsidian-community/obsidian-full-calendar) · [community](https://community.obsidian.md/plugins/obsidian-full-calendar) |
| **Calendar Event Sync** | Link a note to the nearest calendar event via ICS URL | MIT ✅ | [community](https://community.obsidian.md/plugins/calendar-event-sync) |
| **ICS Calendar Viewer** | Read-only local `.ics` viewing, minimal permissions (good privacy model) | MIT ✅ | [community](https://community.obsidian.md/plugins/ics-calendar-viewer) |
| **Tasks** | Task syntax, due/scheduled/recurrence, query blocks; 3.4M downloads | MIT ✅ | [community](https://community.obsidian.md/plugins/obsidian-tasks-plugin) · [GitHub](https://github.com/obsidian-tasks-group/obsidian-tasks) |
| **Task Center** | Built on Tasks syntax: drag tasks between dates, review estimate vs actual | MIT ✅ | [community](https://community.obsidian.md/plugins/task-center) |
| **Hold Course** | Course, lecture, assignment, exam tracking; Today sidebar; global assignments view; grade chips | MIT, verified | [community](https://community.obsidian.md/plugins/hold-course) · [GitHub](https://github.com/LiveAQuietLife/obsidian-hold-course) |
| **Course Command Center** | Per-course folders, artifact types, template mapping, course health checks, Canvas LMS tracking | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/course-command-center) |
| **Subject Manager** | Subjects, projects, assignments, exams, grades | MIT, verified | [community](https://community.obsidian.md/plugins/subject-manager) |
| **Verso** (same author as Hold Course) | Reading schedules and pace | MIT, verified | [author page](https://community.obsidian.md/users/liveaquietlife) |

#### 3.5 Focus timers and study-time analytics

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

#### 3.6 Source ingestion: PDFs, transcription, annotation

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

#### 3.7 Math, chemistry, and physics

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

#### 3.8 AI assistants and agents inside Obsidian

| Plugin | What to learn from it | License | Link |
|---|---|---|---|
| **Copilot** (Logan Yang) | Chat with your vault; runs agents such as OpenCode, Codex, Claude Code per its listing; the model the owner referenced | **AGPL-3.0** ⚠️ do not integrate (§3.10) | [Obsidian Stats](https://www.obsidianstats.com/plugins/copilot) |
| **Agent Client** | Connects agents (Claude Code, Codex, Gemini CLI) via the Agent Client Protocol | **Apache-2.0** (keep `NOTICE`) | [Obsidian Stats](https://www.obsidianstats.com/plugins/agent-client) |
| **Codex Panel** | Codex in a sidebar for the vault | **Apache-2.0** (keep `NOTICE`) | [Obsidian Stats](https://www.obsidianstats.com/plugins/codex-panel) |
| **Gemini Helper** | AI chat, workflow automation, semantic search; desktop and mobile | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/gemini-helper) |
| **LLM Hub** | Chat, workflow automation, semantic search with several providers and CLI backends | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/llm-hub) |
| **LearnKit Companion** | Study-focused assistant: ask about a note, generate cards and tests, rewrite notes (MIT) | MIT ✅ | [LearnKit](https://github.com/ctrlaltwill/learnkit) |
| **MCQ Tracker's own tutor** | Existing BYOK and OpenCode integration, tutor vs agent mode | MIT ✅ | [community](https://community.obsidian.md/plugins/mcq-tracker) |

#### 3.9 Similar-plugin scan, Oct 30, 2026

**Status: research input only. Nothing here is scheduled.** `AGENTS.md` still holds: the only named implementation gap is lighter multi-question authoring, and any new scope waits for the owner to rank it. This pass searched the community directory, Obsidian Stats and GitHub on Oct 30, 2026 for plugins that did not already appear in §3 or §13. Licenses marked **verified** were read from the repository's own `LICENSE` file on that date; the rest came from a README or listing and still need the repo's `LICENSE` opened before any code is reused. Download counts could not be read reliably, so none are quoted.

##### Quiz and exam engines

| Plugin | What to take | License | Link |
|---|---|---|---|
| **Qard** (`qard`) | Exam **Plans**: declare an exam, pick decks/topics, then track *coverage* rather than only due counts, launch a practice test from the plan, and see exams plus revision on a monthly calendar. Also a **Needs fixing** filter (cards failed across five study days get flagged, and "Mark fixed" opens a new window without deleting history) and FSRS self-fitting after about 400 ratings. | MIT, verified | [GitHub](https://github.com/kylianmarceau/qard-obsidian) · [Stats](https://www.obsidianstats.com/plugins/qard) |
| **Quiz maker** (`quiz-maker`) | One question bank driving five modes (Practice, Timed, Exam, Flashcards, Review of missed/bookmarked/due), **study packs** that preset the mix, difficulty and timing, and a wide question-format set including assertion-and-reason, error correction, evidence selection and branching scenarios. | MIT, verified | [GitHub](https://github.com/Abenovv/quiz-maker-obsidian-edition) · [Stats](https://www.obsidianstats.com/plugins/quiz-maker) |
| **Quizzable** (`quizzable`) | **Define once, play anywhere**: a `quiz` block holds the definition and a `playable-quiz` block with `id:` replays it elsewhere. Partial credit for multi-select and matching with a wrong-pick penalty, a reorder type, numeric-with-tolerance, and an optional `quizResults:` frontmatter export so Dataview or Meta Bind can build the dashboard without the plugin owning analytics. | MIT, verified | [GitHub](https://github.com/monapdx/Quizzable) |
| **Quiz Blocks** (`quiz-blocks`) | `gated: true` **closed-book mode**, where the surrounding note is hidden until the quiz is finished, which stops answer-peeking. Also **per-option feedback** (each wrong choice gets its own explanation) and a shared-option-set `choice` type. | MIT, verified | [GitHub](https://github.com/xamgore/obsidian-quiz-blocks) |
| **Better Recall** (`better-recall`) | **Per-deck algorithm choice** (classic SM-2 or FSRS) with per-deck timing parameters, so a user migrates gradually instead of being forced onto one scheduler. | MIT, verified | [GitHub](https://github.com/FlorianWoelki/obsidian-better-recall) |
| **True Recall** (`true-recall`) | Typed answers graded by a **diff-based checker that needs no AI**, alongside AI teacher-style grading; concurrent multi-device reviews merged by replaying the review log through FSRS. Ideas only. | **PolyForm Strict 1.0.0**, no reuse | [GitHub](https://github.com/pieralukasz/true-recall) |
| **Smart Question Tutor** (`smart-quiz-tutor`) | Reads a whole past paper and **preserves the existing answer key**, generating only missing answers; also exports an **answer-free version** for self-testing. | 0BSD, verified | [GitHub](https://github.com/xxinjie21/Smart-Quiz-Tutor) |

##### Student workflow: timetable, courses, exam countdown

| Plugin | What to take | License | Link |
|---|---|---|---|
| **Class Timetable** (`class-timetable`) | Timetable-first rather than calendar-event-first: semester start and end, odd/even weeks, reading weeks, per-day cancellations, classes that run only part of term, and "start a new semester" that stamps `semester:` without moving files. Paste-a-timetable parser, `.ics` **import and export**, PNG export of the week, and *all state in note frontmatter* (`schedule:`, `exam:`, `due:`, `todo:`, `checked:`), so renames and hand-edited YAML cannot break it. | MIT, verified | [GitHub](https://github.com/elliott-json-park/obsidian-class-timetable) |
| **Study Vault** (`study-vault`) | The **"days until exam + % topics mastered"** pair as one progress widget, computed by counting mastered notes against a course's declared topic count. A two-number health check that reads better than a bare percentage bar. | MIT, verified | [GitHub](https://github.com/wesswart77/obsidian-study-vault) |
| **Homework Manager** (`homework-manager`) | Subject-scoped task lists where every task **links to a note**, so the tracker never becomes a second inbox. | **AGPL** ⚠️ do not integrate (§3.10) | [GitHub](https://github.com/kadisonm/obsidian-homework-plugin) |

##### AI study and error diagnosis

| Plugin | What to take | License | Link |
|---|---|---|---|
| **Claude Tutor** (`claude-tutor`) | The miss loop worth copying: wrong answer, then a **named misconception**, a micro-lesson, and a fresh check question on the same concept, logged so later quizzes deliberately re-target it. It also treats **jargon** as its own gap category beside missing and wrong, and flags low-confidence answers separately. | MIT, verified | [GitHub](https://github.com/wanikhawar/claude-tutor) |
| **AI Study Buddy** (`claudian-api`) | Study *modes as prompts over the same material*: `/predict` for likely exam focus points, `/mock` for a full paper, plus `/feynman`, `/quiz` and `/gap`. Generated cards route into subject and topic folders so scheduling and stats segment per subject. | MIT, verified | [GitHub](https://github.com/virbird/LLM_Private_Teacher) |
| **A-Level Study Coach** (`alevel-study-coach`) | **Error log to review sheet**: one click compiles every due item into a printable offline practice sheet with the original mistake prefilled. Also a "think-first" timer that blocks sending to the assistant before a threshold. | MIT, verified | [Stats](https://www.obsidianstats.com/plugins/alevel-study-coach) |

##### Audio capture and handwriting

| Plugin | What to take | License | Link |
|---|---|---|---|
| **Transcriber and Summary for Idiots** (`lecture-transcriber`) | **Many lectures to one study note**, scoped by Today / This week / Last two weeks, with an overview, key concepts and a **vocabulary table**; explicitly allowed to explain beyond the transcript but forbidden from inventing deadlines or what is on the exam. Offline Whisper plus a local Ollama model. | MIT, verified | [GitHub](https://github.com/AbyssLotus/obsidian-lecture-transcriber) |
| **Advanced Audio Recorder** (`advanced-audio-recorder`) | **Bookmarks and chapters with copyable `[12:41]` timestamp links** as first-class note objects, so the one useful minute of a lecture is reachable without reading a full transcript. | MIT, verified | [GitHub](https://github.com/akhmialeuski/advanced-audio-recorder) |
| **Aloud TTS** (`aloud-tts`) | **Sentence-level highlight synced to playback**, with cached audio in the vault and OS media controls: the missing piece for a listen-and-answer audio review mode. | MIT, verified (`LICENSE.txt`) | [GitHub](https://github.com/adrianlyjak/obsidian-aloud-tts) |
| **Voice Briefing** (`voice-briefing`) | A fixed **90-second spoken briefing** per note, style-parameterized (Metaphorical, **Feynman**, News Anchor). The Feynman style forces teaching rather than summarizing, which suits a commute review unit. | MIT, verified | [GitHub](https://github.com/reallygood83/voice-note-obsidian) |
| **Handwriting** (`handwriting`) | Ink stored in sidecar JSON under `.handwriting/` and linked by **one frontmatter key**, so the note stays a pure `.md` and disabling the plugin leaves it untouched. Architecture reference only. | **CC BY-NC-ND 4.0**, no derivatives | [Stats](https://www.obsidianstats.com/plugins/handwriting) |
| **Inkflow** (`inkflow`) | **Portable by default**: always emit a plain PNG embed beside the editable source, so the ink survives the plugin being uninstalled. A good model for a "show your work" math capture. | MIT, verified | [Stats](https://www.obsidianstats.com/plugins/inkflow) |
| **Handwriting and Image to LaTeX** (`handwriting-latex`) | Lasso several attempts on a canvas and recognize **each selection independently** into its own LaTeX candidate, with history restoring both the result and the drawing. | MIT, verified | [GitHub](https://github.com/chongcyrus/handwriting-latex) |

##### Ideas that fit the current design, cheapest first

These reuse existing surfaces instead of adding a module. They stay **unscheduled** until the owner ranks them.

1. **Misconception diagnosis on a miss.** The mistake taxonomy already asks *why* a question was missed; a named-misconception field plus an automatic re-check question (Claude Tutor) would turn the error log into a feedback loop. Extends §5.9 and the existing error log, with no new storage.
2. **Exam coverage, not just due counts.** The course registry already stores exam dates and the study plan already computes readiness; a "% topics mastered" figure against a declared topic count (Study Vault, Qard Plans) answers the "am I actually covering the syllabus" question that due counts cannot.
3. **Answer-free export.** Emit a question set with the key stripped, for printing or a closed-book self-test. Reuses the existing export path and is the closest fit to the one open authoring gap.
4. **Closed-book gating.** Hide the explanation and the source snippet until Submit, the way Quiz Blocks' `gated` note works. A setting on the review screen, not a new view.
5. **Per-option explanations.** Each wrong choice gets its own line in the review instead of one shared rationale. Fits the existing choice rendering and helps most on select-all questions.
6. **Daily-quiz streak freeze.** One freeze earned per N completions and spent automatically on a missed active day, so a single missed day does not erase a long streak. Extends the daily quiz that §5.22 already sourced from VaultQuiz.
7. **Needs-fixing flag.** After repeated misses across distinct days, mark the question for repair with a **Mark fixed** action that opens a new window but keeps history. Distinct from the 1.111.0 leech suspend, which removes the item from the queue.

**Not proposed:** a second scheduling engine (Better Recall's per-deck SM-2), inline quiz blocks and a subject-timetable parser are each a large surface for a small gain here. The existing ladder-plus-FSRS choice, the study skin and the `.ics` calendar already cover the need.

#### 3.10 Licence allow-list: what may and may not be integrated

**Read this before copying anything.** This section is the source of truth for reuse; the per-row notes in §3.1–§3.9 are commentary on top of it. If an entry here disagrees with a row above, this table wins.

**Status:** a bulk audit on Oct 30, 2026 resolved 72 of the 76 plugin names in this document against `obsidianmd/obsidian-releases` `community-plugins.json`, then read each repository's own `LICENSE` file. Four names could not be found in the directory index and stay blocked (listed at the end).

**The rule:**

- **May integrate:** MIT, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD. Keep the copyright line and permission text in `NOTICES.md` and, where practical, in the copied file's header. The README already sets this precedent for the MIT code adapted from University Schedule and Calendar.
- **May integrate with conditions:** Apache-2.0, but carry its `NOTICE` file too and isolate it if the repo must stay purely MIT. For a dual-licensed project, use the MIT option only.
- **Must not integrate, ever:** GPL, AGPL, LGPL, MPL, CC BY-NC, CC BY-NC-ND, PolyForm (any variant), Commons Clause, "all rights reserved", anything proprietary, and anything with no licence file. These may be **read** for ideas. No code, no snippets, no mechanical re-implementations of their algorithms, no vendored bundles. AGPL matters most here: `main.js` is shipped as source, so pasting one AGPL function would put the whole plugin under the AGPL.
- **Unverified is not permission.** A name that is not in this section, or is marked unverified below, is **blocked** until someone opens the licence and records the result.

##### Blocked: confirmed non-permissive. Do not integrate.

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

##### Cleared: MIT, `LICENSE` read from the repository

Core study systems:

| Plugin | Repository | Licence |
|---|---|---|
| MCQ Tracker (this project) | `ifriedenson/mcq-tracker` | MIT |
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

##### Cleared with conditions

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

##### Not found: blocked, and the name may be wrong

These names appear in this document but not in the community plugin index, so no licence could be checked. Do not treat them as sources, and correct the name before relying on the idea.

| Name in this plan | Status |
|---|---|
| **Syro** | Not in the index. Possibly a misremembered name; find the real plugin first. |
| **Study Tracker** | Not in the index. Confirm which plugin was meant. |
| **PDF Ink** | Not in the index. The plan's PDF ink work is already original; treat this name as unverified. |
| **matrix** | Not in the index. Listed on the old math tag page; likely a different id. |

##### How to clear a blocked or unknown entry

1. Open the plugin's repository and read its `LICENSE` file itself, not the listing badge.
2. If it is MIT, BSD, ISC, 0BSD or Apache-2.0, add it to the cleared table with the repository path and the date, and copy the notice text into `NOTICES.md`.
3. If it is anything else, add it to the blocked table with the reason and leave the idea in place. Ideas are not restricted; code is.
4. If there is no licence file at all, leave it blocked. All rights reserved is the default.

---

---

## Part B — What this file adds

### B1. Licence policy, in one paragraph

MIT, BSD-2-Clause, BSD-3-Clause, ISC and 0BSD code is integrable. Apache-2.0 is integrable if its
`NOTICE` file is carried over. GPL, AGPL, LGPL, MPL, CC BY-NC, CC BY-NC-ND, PolyForm (any variant)
and anything with no licence file are **ideas only**: you may read them to understand an approach and
write your own implementation, but never copy code, never call their code, and never vendor their
engine. Two traps in this repo's history: **Adaptive Practice** is MIT but its scheduling engine
(Whetstone) is AGPL, so parity means reimplementing, not importing; and **Full Calendar Remastered**
wraps FullCalendar, which is GPLv3 — the wrapper's licence does not launder the library's.
"Unverified" is not permission: if you cannot find a `LICENSE` file, treat it as blocked.

### B2. How the audit was done (so you can redo or extend it)

1. Resolve every plugin name to a repository through the canonical index, not by guessing URLs:
   `https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json`
   (9,660 entries at the time of the audit). Match on the plugin `name` field, normalised
   (lowercase, punctuation and spacing collapsed).
2. For each resolved repo, fetch the raw licence file, trying in order:
   `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `license`, `LICENCE`, `COPYING`, `LICENSE-MIT`.
3. Classify by reading the text: MIT permission grant, Apache-2.0 header, AGPL/GPL version markers,
   MPL-2.0 exhibit, CC BY-NC(-ND) wording, PolyForm licence name, Dynalist ISC-style text, or nothing.
4. Outcome: 76 names, **72 resolved**. Of those, 61 MIT, 2 ISC-style (Easy Quiz, Activity Graph),
   6 Apache-2.0 (Heatmap Calendar, Contribution Graph, Ketcher, Agent Client, Codex Panel, Calc Craft),
   3 AGPL, 2 with no licence file (CQuiz, Mochi Cards Exporter), and 4 that are not in the index at all.

**Known weaknesses of the method.** Name matching is exact-normalised, so a plan row that used a
descriptive name may have resolved to a different plugin than intended — "Flashcard Generator" resolved
to `chloedia/Obsidian_Quiz_Generator`, and "LLM Test Gen" to `aldo-g/obsidian-llm-test`. Spot-check
those before relying on them. Classification sniffs the licence *file*, so it will not catch a repo
whose `package.json` declares something different. And a fork can carry a licence the upstream never
had — check which repo you are actually reading.

### B3. What the plugin already ships — do not rebuild these

Verified by reading `src/`, not the README:

- **Typed and spoken card answers with AI grading.** `answerMode: flip | type | speak`
  (`card-grading.js`, `cards-view.js`), per-deck and per-card overrides, and
  `gradingStrictness: strict | standard | lenient`. The local grader already does keyword-coverage
  partial matching, with an AI fallback layered on top. The "typed/spoken answer card" item that older
  planning notes list as future work is effectively shipped.
- **Mark for review.** Flag/bookmark control in both practice and timed-test views.
- **Calendar `.ics` export** (`calendar-export` command, `schedule-export.ics`) and a `semester`
  field on registered courses.
- Image occlusion, leech handling, pass marks, option shuffle, confidence calibration, weak-spot
  drilling, error log, saved filter presets, saved practice-exam history with composite estimates.

If a source plugin below appears to offer one of these, it is not a gap — the difference will be in
presentation, not capability.

### B4. Genuine gaps, with evidence

Each row was checked by searching `src/` for the concept; "absent" means no implementation was found,
not merely that the README omits it.

| Gap | Permissive source | Evidence | Size |
|---|---|---|---|
| Exam **coverage %** — topics mastered against a declared topic count | Qard; Study Vault | `study-plan.js` scores readiness from accuracy and seen-ratio; nothing counts syllabus topics | S |
| **Per-question hint** revealed before answering | Omniscient | Only UI help text (`qt-hint`); no hint field or reveal control. Cloze hints exist inside `{{c1::a::hint}}` only | S |
| **Closed-book gating** — the note's text is masked until the quiz is done | Quiz Blocks (`gated`) | Nothing; explanations can be hidden after answering, the source passage cannot | S–M |
| **Per-option explanations** — each wrong choice gets its own reason | Quiz Blocks | One shared explanation per question | S–M |
| **Partial credit for multi-select** with a wrong-pick penalty | Quizzable | Select-all is graded as an exact set | S |
| **Inline quiz blocks** rendered inside a note | quizblock; Omni Quiz; Note Quiz Engine | Only `mcq-dashboard` embed blocks; quizzes open in a view | L |
| **Named misconception loop** — wrong answer, name the misconception, micro-lesson, re-ask | Claude Tutor | `tutor-presets.js` has a misconception *prompt*; nothing is recorded or re-targeted | M |
| **Streak freeze** on the daily quiz | VaultQuiz | Streak and best streak only; no freeze or grace | S |
| **Timetable grid** with odd/even weeks, reading weeks, cancellations, paste-a-timetable | Class Timetable | Calendar plus `.ics` in/out and a semester label; no weekly grid, no week-parity logic | L |
| **Compiled review sheet** — one click turns due items into a printable sheet | A-Level Study Coach | Error log with per-group practice buttons | M |
| **Answer-free export** — question set with the key stripped | Smart Question Tutor | Exports always carry the key | S |
| **Per-deck scheduler choice** (SM-2 vs FSRS) | Better Recall | One algorithm choice, applied globally | S |

**Ranking if the owner asks.** The cheap three — coverage %, per-question hints, closed-book gating —
each extend a surface that already exists (course registry, question note, review screen). Per-option
explanations is next and fits naturally, since select-all already grades per choice. The timetable grid
and inline quiz blocks are large relative to their value, which is why §3.9 lists them as not proposed.
Misconception logging is the one worth more than its cost suggests: the mistake taxonomy already records
*why* a miss happened, so naming the misconception extends existing state rather than adding a subsystem.

### B5. Deliberate non-goals

Spaceforge-style web lookup and a mind-map workspace; OCR-dependent handwriting-to-LaTeX; any TTS or
spoken briefing (awaiting provider and mobile validation, not a licensing question); fillable PDF form
fields (no audited permissive library); human-scored FRQ calibration. Do not "helpfully" schedule these.

### B6. Handoff checklist for the next agent

1. Read `AGENTS.md`, then `plan.md` — especially the Handoff snapshot and Current focus sections.
2. Check §3.10 before copying anything. Blocked means read-and-reimplement, never import.
3. No new dependencies. The plugin is deliberately dependency-free plain JavaScript; `main.js` is
   generated by `node scripts/build.js` and must never be hand-edited.
4. Do not schedule new feature scope. The only unchecked plan item, lighter multi-question authoring,
   needs the owner to rank it first. Everything in Part A is research input, not a backlog.
5. Update `plan.md` before implementation work, keep tests with the change, run `npm test` and
   `npm run check` before committing, and commit `main.js` alongside source.

---

*Research only. Nothing in this file is scheduled, approved, or promised; §3.9 and §3.10 of `plan.md`
remain the operative statement of what may be integrated.*
