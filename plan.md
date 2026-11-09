# MCQ Tracker → Ultimate Study Tool: Product & Integration Plan

**Status: v1.294.0 (Nov 9, 2026).** One MIT, dependency-free Obsidian plugin
(`mcq-tracker`) covering exam practice, cards and vocabulary, courses and
calendars, study planning, document ingestion, reference/STEM tools and an
optional BYOK/OpenCode AI layer.

**0 unchecked rows, 3 partial/gated rows, no locally implementable row left open.**
This is the tracked core roadmap. The Copilot clean-room inventory in §5.18.1 is
a separate reference matrix: it marks shipped, adapted, Next and Boundary
surfaces, so unfinished ideas are not disguised as checked work.

§3.9.6 is the gate table, §3.10 is the licence allow-list, and
[docs/plan-decisions.md](docs/plan-decisions.md) is the owner decision sheet.

**Verified at this commit:** `node --test` → 2,513 tests pass, 0 fail;
`npm run check` clean (no dynamic code across 347 source files, vendor guard,
bundle up to date); `main.js` generated from 350 modules at 6,997,963 bytes.
Re-run both before quoting these numbers.

**Shipped in 1.282.0 (Nov 7, 2026):** Quick Ask, saved study
commands, per-chat and per-command model overrides with visible fallback,
local `/compact`, `@` note/folder mentions, a context/token/model footer, a
searchable, pinned, archived conversation library, concurrent chat tabs, a
cancelable queued-message strip, **Quick Chat**, **message bookmarks with chat links**, **per-message rewind and fork**, **vault skills**, **local chat projects**, **opt-in local memory**, **per-conversation Markdown export**, **local per-send and per-conversation cost estimates**, a **compact context gauge** and a **local diagnostics bundle** ship in the source and bundle. Quick Ask sends only the selection or
whole note explicitly chosen, offers seven study actions, and writes only on
**Insert** or **Replace**. Saved `/commands` expand `{selection}`, `{note}` and
`{path}` only when the chat already allows that context. Tabs keep independent
history, model, footer and queue state in the existing chat storage; queued
follow-ups drain exactly once after the active reply, Stop or error. Quick Chat
opens from the command palette (or a user-assigned hotkey) and submits through
the active panel, so model resolution, mentions, context, budget, streaming and
Stop/error handling are shared rather than duplicated. Every message can be
bookmarked and linked; the link restores its conversation and focuses that
message, and a deleted target is reported plainly. The clean-room Copilot
inventory is §5.18.1; no AGPL code, prompt or stylesheet was used.

**Also in 1.282.0:** the Study agent adds
**plan-then-act** and **general PDF attachments**. A plan is model output from
the existing abortable chat request, parsed defensively in `src/chat-plan.js`;
every step is shown before it runs, **Approve**/**Skip** controls are per step,
and **Run approved** sends one step at a time through the normal chat path, so
any write still goes through the existing review window. A declined write,
failure, Stop or reload stops later steps honestly, and plan state persists with
the conversation in `settings.ai.studyChatPlan`. PDF attachments in
`src/chat-pdf.js` and `src/chat-pdf-modal.js` let the **PDF** button or
**Study agent: attach a PDF** pick up to three vault PDFs and a page range
(default 1-20, at most 40 pages each). Text is read locally through the existing
`readPdfPages`, labelled as untrusted material, cited as
`[[path#page=N]]`, and counted in the same 12,000-token budget; a missing,
image-only or unreadable PDF refuses the send. Paths and page ranges persist
with the chat, and no extracted text is written to `data.json`. No new
dependency, provider, network call or write path is added. Focused tests:
`tests/chat-plan.test.js` and `tests/chat-pdf.test.js`.

**How to read this file.**

| Part | What it holds |
|---|---|
| §A | What is shipped, by area, with the source that implements it |
| §B | The three environment-blocked owner passes (unverified `[~]` rows); four decided rows closed on Nov 6, 2026 |
| §C | What was decided against — do not re-propose without an owner decision |
| §§0–13 | Product spec, confirmed decisions and the licence record |

Release-by-release history is **not** kept here. `docs/release-notes/` has one
file per version, `AGENTS.md` has the current-state summary, and the plan
decision sheet lives in `docs/plan-decisions.md`. Duplicating that log in this
file is what made it unreadable; it now points instead.

## Handoff snapshot (updated Nov 7, 2026 at v1.288.4)

- **1.287.0:** the Study agent exposes a **Chats** drawer control, the saved-conversation library no longer occupies the transcript, errors render as an alert card with **Retry**, and Settings → AI groups the assistant into Copilot-style cards (Study agent, Commands and skills, Session pacing and checks, Context and privacy, Knowledge record, AI backend, Models and request limits). Light and dark evidence is in `docs/render/study-agent-ui/`.

- **1.287.1:** the closed mention picker no longer leaves a 10 px scroll track above the Study agent composer. Its base `display:flex` was overriding `.qt-hidden`; a specific hidden rule now removes the box, and the earlier transcript `overflow-x`/scrollbar suppression is gone. The 420 px empty, streaming and error states are captured in light and dark, and the settings captures are re-confirmed, in `docs/render/study-agent-ui/`.

- **1.288.0:** the Study agent ships Copilot's transcript-first chat surface. The 1.286 identity header is gone; the transcript is first, followed by a **ChatControls** strip (mode/role left; token gauge, **New chat**, **Chats**, **Settings**, **Save chat** and **Expand** right), then the composer. User turns are full-width bordered cards using `--background-modifier-hover`; assistant turns are flat and unboxed with no avatars or speaker names. The composer keeps context chips above a borderless draft, with `@`/PDF/Commands/model controls left and a circular accent **Send**/**Stop** right. Empty, streaming and error states stay in the same panel. Fresh light/dark evidence is in `docs/render/study-agent-ui/`; no Obsidian app runtime is available in this environment, so the final in-app theme check remains open. Notes are in `docs/release-notes/1.288.0.md`.

- **1.288.1:** the Study agent removes the remaining duplicate **Study agent** heading and intro from `AgentView`; the Obsidian leaf title is the only header. The empty suggestion card is centered and capped at `32rem` like Copilot's empty banner, the persona selector stays visible and compact at 420/320 px, rendered bodies carry Obsidian's `markdown-rendered` class, and code lines no longer wrap. Safety copy moves into **How replies work**. Tests: 2,392 pass. Notes: `docs/release-notes/1.288.1.md`.

- **1.288.4:** the 1.288.3 community-plugin review's two CSS findings are closed. The five `text-decoration-line` sites use the `text-decoration` shorthand and the phone full-screen panel keeps one `height: 100dvh`, with `tests/release-hygiene.test.js` enforcing both. The behavior warnings are unchanged: the direct `fs`/`child_process` usage is the optional desktop OpenCode installer, the unmodified PDF++ bundle adds its own `child_process`, Electron IPC and `new Function`, and `main.js` remains 6,787,753 bytes (Obsidian Sync Standard's 5 MB file limit still applies). Tests: 2,409 pass. Notes: `docs/release-notes/1.288.4.md`.

- **1.288.3:** this release packages the current tree after 1.288.2. It exposes the **Web browser** settings page in the module navigation (36 pages), adds accessible names and Enter/Space activation to custom controls, and hardens narrow-width PDF, Settings, Study Stats, cards, assignments and time-block layouts. The 20 current-tree captures (18 chat plus 2 settings) are in `docs/render/study-agent-ui/`; no Obsidian runtime is available, so the owner light/dark check remains open. Tests: 2,409 pass; `main.js` is 6,787,753 bytes. Notes: `docs/release-notes/1.288.3.md`.

- **State:** 0 unchecked core rows; Quick Chat, message bookmarks, per-message rewind and fork, Quick Ask, saved study commands, vault skills, chat projects, opt-in local memory, Markdown conversation export and local cost estimates ship in 1.282.0; the 1.283.0 knowledge record is end-to-end scenario-verified in 1.285.0 and now follows a moved or renamed note; Mother cram and card answer dictation shipped; 3 `[~]` partials — the three owner manual passes (math/chemistry visual, real iOS/Android, README screenshots) are environment-blocked, recorded as partial rows in §7 and tracked with their blockers in §B, and none is claimed as a pass; four former gates decided on Nov 6, 2026 (§B).
- **Newest feature:** 1.288.3 packages the current tree and restores the reachable **Web browser** settings page; 1.288.2 keeps Copilot's transcript-first chat surface: no branded header, a full-width user card per turn, flat assistant rows, a **ChatControls** strip below the transcript and the composer last. Fresh 1.288.2 light/dark evidence is in `docs/render/study-agent-ui/`. 1.288.1 removes the last AgentView heading/intro, centers and bounds the empty state, keeps the persona visible at sidebar widths, adds Obsidian's markdown container and stops code wrapping. The 1.286.1 render pass at 320/420/560 px remains in `docs/render/study-agent/`. 1.286.0 restyles the Study agent as a chat pane: an identity header with the chat model and conversation actions, avatar turns with bubbles, an empty state with starter prompts, and one rounded composer for context, draft and send. 1.285.0 proves the opt-in **knowledge record** (§5.27) survives a source-note move, rename, delete, recreation at a new path and restore: concept ids, `firstSeen`, aliases, attempt evidence and misconception state stay attached, the Insights card and learner digest keep the note linked, and repeated rebuilds do not duplicate it. 1.284.0 verified extraction, attempt updates, misconception opening/fixing, heading rename identity, deleted-source retention, idempotent rebuild, reload, Insights actions and the bounded Study-agent digest. 1.283.0 added it: concept extraction, coverage, misconceptions and the digest, with its UI in Insights → Concepts. 1.282.0 added **plan-then-act**, **general PDF attachments**, a **Quick Practice home-screen URI** and a **sample-vault math/chemistry audit note**, alongside the Nov 6 additions: **Quick Chat**, **message bookmarks with chat links**, **per-message rewind and fork**, **vault skills**, **local chat projects**, **opt-in local memory**, **per-conversation Markdown export**, **local cost estimates** (per send and per conversation), a **compact context ring**, a **local diagnostics bundle**, **Quick Ask**, **saved study commands**, **`@` note/folder mentions**, a **context/token footer** and a **searchable, pinned, archived conversation library** in one release. In 1.281.0, **Mother cram** is the practice-only Cards loop
  in the current deck: flip the card, then choose **Do not know** (send it to the
  back) or **Know** (remove it) until the queue is empty. It writes no attempt,
  grade, history or due date. 1.280.0 added **cram sessions** with exact
  `next_review_at` intervals; 1.279.0 added **dictated card answers** (the
  **Dictate** button fills the editable answer box, then the existing
  deterministic and AI paths grade it); 1.278.0 added **PDF→FRQ import**
  (text-layer split, editable preview, ordinary FRQ notes); 1.277.0 embedded the
  MIT PDF++ 0.40.31 bundle. Policy: `docs/pdf-plus.md`.
- **Non-negotiables:** `main.js` is generated by `node scripts/build.js` and is
  never hand-edited; tests use `node --test`; `npm run check` must pass; no
  dependencies, no dynamic code, no telemetry; every module is off by default;
  notes are the source of truth (schedules stay note-backed); AI is optional and
  only BYOK/OpenCode, with local model presets.
- **What cannot be checked here:** no real Obsidian window, no iOS or Android
  device, no provider key, no Anki desktop or CouchDB server. The three rows that need those are environment-blocked owner passes,
  tracked with their blockers in §B; none is claimed as a pass, and each stays
  a `[~]` partial row in §7 until the owner pastes a result.

## Current focus (Nov 7, 2026)

No tracked core implementation row is open. 1.282.0 adds
**plan-then-act** and **general PDF attachments** to the Study agent. A plan is
model output from the existing chat request; every step is approved or skipped
before **Run approved** sends it through the same send and write-review paths,
and a stop, decline, error or reload is reported instead of being called
complete. **PDF** or **Study agent: attach a PDF** reads up to three vault PDFs
locally, sends a labelled untrusted block with page citations, and refuses a
missing, image-only or unreadable file; no OCR, upload or new dependency is
added. The same release adds
**Quick Chat**, **message bookmarks with chat links**, **Quick Ask** and **saved study commands**: selection or whole-note context,
seven actions, follow-ups, copy/insert/replace, and `/name` prompts with
context that obeys the chat's existing switches. It also adds explicit
`@` note/folder mentions with bounded, switch-respecting injection, a
context/token footer that warns on overrun, and a conversation library with
search, pins, archive and restore persisted in `settings.ai`. **Quick Chat**
opens from a command or hotkey and submits through the active panel, and
**bookmarks** reopen the exact chat and message from an
`obsidian://mcq-tracker-chat` link. The Copilot inventory's Next
rows are explicit follow-ups, not unchecked rows. 1.281.0 adds **Mother cram**, a practice-only
Cards loop with exactly two choices after the flip: **Do not know** sends the
card to the back, **Know** removes it, and the session ends when every card is
known. It writes no attempt, grade, history or due date, and leaves the normal
scheduler and the four-rating **Cram session** unchanged. Card answers can be
typed or dictated: the Cards answer box has a **Dictate** button, the transcript
stays editable before **Check answer**, and the existing deterministic and AI
paths grade it against the stored answer. PDF→FRQ import remains available as the
command **AP: import free-response questions from a PDF**; it is text-layer only
and refuses an image-only PDF rather than running OCR. Three owner passes remain:
the math/chemistry visual checklist, one iOS and one Android device, and four
README screenshots.
TTS/audio, pronunciation, the FRQ accuracy claim and pilot thresholds are
closed decisions; see [docs/plan-decisions.md](docs/plan-decisions.md).

## A. What is shipped

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

## B. Owner manual passes (3) — environment-blocked, unverified `[~]` rows

None of these three can run in this environment: there is no Obsidian window,
no X server/Xvfb, and no iOS or Android device. They are recorded here with
their blockers, are not claimed as passes, and stay `[~]` partial rows in §7
until an owner pastes a result.

The other four rows closed on Nov 6, 2026: TTS/audio stays device-speech-only,
pronunciation is declined, the FRQ grader carries no accuracy claim, and the
pilot has no numeric threshold. PDF→FRQ import shipped in §5.20.5 and is no
longer a gate or an open implementation row.

Full decision record: [docs/plan-decisions.md](docs/plan-decisions.md).

| Row | What already ships | What is missing | Gate |
|---|---|---|---|
| Math/chemistry visual audit (§5.16.1) | Renderer audit, golden tests, chemistry fallback (1.80.0), local STEM blocks, studyable sample-vault audit note | Visual pass in a real Obsidian window (light/dark, narrow pane, timed test, cards, chat) | §11 E1 |
| Real iOS/Android audit (§5.19) | Mobile quick sessions, responsive shell, `obsidian://mcq-tracker-quick` time/count/course links | A physical iOS and Android pass | §11 E2 |
| README screenshots (§10b) | README, docs and the five-question `samples/sample-vault` | Four real-window screenshots; mock images are not acceptable | §11 E1 |

## C. Decided against — do not re-propose without an owner decision

| Idea | Decision |
|---|---|
| Bundled OCR engine / offline image-only scans | Declined, §11 E3. The opt-in BYOK vision path with editable page text is the answer |
| Provider TTS, bundled speech engine, audio-only commute | Not approved, §11 decision 2. Device voices ship |
| Pronunciation scoring | Declined, §11 E5. Language practice keeps typed answers and OS dictation; no audio capture or speech scoring |
| Paid AI scoring and embeddings RAG on the user's behalf | §11 decision 3. Feynman feedback and grading use the user's own configured provider |
| Web lookup, AnkiWeb search, off-device semantic search | §11 decision 5. Local cited vault search ships instead |
| Canvas LMS sync and Google Classroom OAuth | §11 decision 6. ICS is the supported path |
| CBT `.vce` converter and SAT scaled-score prediction | §11 decision 8, proprietary data |
| In-plugin code execution (Code Runner) | §11 decision 12 security gate |
| Full 1/2/3/U keyboard map | Minimal Space/Enter/Esc map ships; the full map is rejected |
| Second AI runtime, relay or bot; Dataview, Excalidraw or a Zotero database; vault-wide rewrites | Recorded in §5.24 and §5.25; no adoption |
| Iframes | Reversed only for the one opt-in Web browser view (sandboxed, http/https only, nothing proxied) |
| Misconception diagnosis with a named taxonomy | §11 decision 13 / D4 keeps the existing error log and mistake taxonomy |
| Bundled exam content | §11 O8. No AP/SAT content is bundled; link-only guidance |
| Human-scored FRQ accuracy claim | Declined, §11 E6. The grader stays an aid; no accuracy claim without a fixture set and thresholds |
| Numeric pilot go/no-go thresholds | No bar; the pilot stays approved and shipped, never validated (§7 Phase 2b) |

## Where the remaining detail lives

- Gate table: §3.9.6. Licence allow-list: §3.10. Owner decisions: §11.
- Product spec per module: §5. Roadmap status: §7 (checkbox rows). Property schema: §6.
- The MIT audit sections (§3.9.1–§3.9.10) are kept for licence evidence and
  decision history; §3.9.6 is the only table of open work.

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
| **Qard** | Typed answers (off by default), linked reverse-card pairs with separate schedules, AI-drafted cards, practice tests from notes or course folders | MIT ✅ (Oct 30 audit; re-check note in §9) | [GitHub](https://github.com/kylianmarceau/qard-obsidian) |
| **FSRS Flashcards** (SFC) | Seven question types including short answer and essay; AI drafts open in an editable draft before anything is written | MIT ✅ | [GitHub](https://github.com/mojunbeiming/obsidian-fsrs-flashcards) |
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
| **Course Command Center** | [GitHub](https://github.com/flippinhutt/CourseCommandCenter) · [Directory](https://community.obsidian.md/plugins/course-command-center) | MIT | **Local parts shipped Oct 31, 2026):** **Course health** checks missing grades, low attendance, overdue course tasks and a close exam, and **Course note templates** create lecture, unit, review, assignment and syllabus notes from editable local templates with course/title/date placeholders. Canvas LMS sync and OAuth remain gated. | Done locally (Canvas gated) |
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
| **Copilot** (Logan Yang) | Chat with your vault; runs agents such as OpenCode, Codex, Claude Code per its listing; the model the owner referenced | **AGPL-3.0** ⚠️ do not integrate (§3.10) | [GitHub](https://github.com/logancyang/obsidian-copilot) · [Obsidian Stats](https://www.obsidianstats.com/plugins/copilot) |
| **Agent Client** | Connects agents (Claude Code, Codex, Gemini CLI) via the Agent Client Protocol | **Apache-2.0** (keep `NOTICE`) | [Obsidian Stats](https://www.obsidianstats.com/plugins/agent-client) |
| **Codex Panel** | Codex in a sidebar for the vault | **Apache-2.0** (keep `NOTICE`) | [Obsidian Stats](https://www.obsidianstats.com/plugins/codex-panel) |
| **Gemini Helper** | AI chat, workflow automation, semantic search; desktop and mobile | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/gemini-helper) |
| **LLM Hub** | Chat, workflow automation, semantic search with several providers and CLI backends | MIT, verified | [Obsidian Stats](https://www.obsidianstats.com/plugins/llm-hub) |
| **LearnKit Companion** | Study-focused assistant built into LearnKit: ask about a note, generate cards and tests, rewrite notes (MIT) | MIT ✅ | [LearnKit](https://github.com/ctrlaltwill/learnkit) |
| **MCQ Tracker's own tutor** | Existing BYOK and OpenCode integration, tutor vs agent mode | MIT ✅ | [community](https://community.obsidian.md/plugins/mcq-tracker) |

#### 3.8.1 MIT AI-assistant gap audit (Nov 6, 2026)

These licences were read from the repository's own `LICENSE` or the GitHub
licence API on Nov 6, 2026. **No code, prompts or styles were copied.** The
table records a real gap and where it stands, so the next slice can be chosen
without re-researching the licence.

| Plugin | Licence | Feature MCQ Tracker did not have | Link | Status after this pass |
|---|---|---|---|---|
| **Smart Composer** | MIT ✅ | `@file` and `@folder` context mentions, web-page and image attachments, one-click vault edits with a diff. | [GitHub](https://github.com/glowingjade/obsidian-smart-composer) | **Adapted.** `@` note/folder mentions and reviewed writes with diffs ship; URL/web-page and image attachments remain outside the local scope. |
| **Smart Second Brain** | MIT ✅ | Hybrid keyword + semantic search, an automatically grouped knowledge graph, and a local-first agent. | [GitHub](https://github.com/s2b-dev/smart-second-brain) | **Next.** Search is lexical and cited; there are no embeddings and no generated topic graph. |
| **Text Generator** | MIT ✅ | Reusable prompt templates with variables, a community template library, and generation inserted into the current note. | [GitHub](https://github.com/nhaouari/obsidian-textgenerator-plugin) | **Adapted.** Saved study commands cover reusable prompts and `{selection}`/`{note}`/`{path}` variables; there is no template marketplace. |
| **Local GPT** | MIT ✅ | Selection context-menu actions, an action palette, community actions, RAG over links/backlinks/PDFs, and image input. | [GitHub](https://github.com/pfrankov/obsidian-local-gpt) | **Adapted.** Quick Ask ships selection actions; there is no shared action library or link/PDF RAG. |
| **Obsidian Ollama** | MIT ✅ | Built-in preprompts (summarize, explain, rewrite, caption), per-prompt model and temperature, and insert-at-cursor. | [GitHub](https://github.com/hinterdupfinger/obsidian-ollama) | **Adapted.** Study commands and Quick Ask cover the prompt/insert workflow; per-command model and temperature are still missing. |
| **BMO Chatbot** | MIT ✅ | Named chatbot profiles with their own knowledge and presets, prompt-select-generate, and chat Markdown rendering. | [GitHub](https://github.com/longy2k/obsidian-bmo-chatbot) | **Adapted.** Tutor roles and the chat renderer cover part; user-defined profiles are not built. |
| **Obsidian AI** (Maximophone) | MIT ✅ | Inline `<ai!>` generation blocks that read `[[links]]` as context, plus token and cost tracking. | [GitHub](https://github.com/Maximophone/obsidian-ai-plugin) | **Next.** Local token and cost tracking ship; inline `<ai!>` generation is not built. |
| **AI Local Assistant** | MIT ✅ | Prompt mode over a selection plus DALL·E image generation and Whisper transcription. | [GitHub](https://github.com/ManOhMan28/obsidian-ai-local-assistant) | **Boundary.** Prompt mode is covered by Quick Ask; image generation and audio capture are outside the study-assistant scope and the plan's audio decisions. |

**What shipped from this audit.** Quick Ask (selection or full-note context,
preview, copy, insert, replace, follow-ups) and saved study commands with slash
expansion. Both reuse the existing provider, request caps, model routing,
untrusted-context labelling and write guards. They are original modules:
`src/quick-ask.js`, `src/quick-ask-modal.js` and `src/study-commands.js`.


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
| **A-Level Study Coach** (`alevel-study-coach`) | **Error log to review sheet**: one click compiles every due item into a printable offline practice sheet with the original mistake prefilled. Also a "think-first" timer that blocks sending to the assistant before a threshold. **Review sheet shipped in 1.163.0; think-first timer shipped in §11 item 17.** | MIT, verified | [GitHub](https://github.com/virbird/Alevel-study) · [Stats](https://www.obsidianstats.com/plugins/alevel-study-coach) |

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

**Status: step 9 complete.** Items 1–28 shipped in 1.130.0–1.151.0 and are marked ✅ below. §5.22.4 item 3 (answer-free export) shipped in 1.153.0; item 2 (exam coverage) shipped in 1.154.0; item 1 is open in §11 item 13. Class Timetable's term calendar shipped in 1.162.0; Study Vault's exam-days/topics widget is verified-satisfied; A-Level Study Coach's review sheet shipped in 1.163.0, and its think-first timer is shipped (§11 item 17).

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

**Step-9 progress — complete.** Rows 1–28 shipped in 1.130.0–1.151.0: inline quiz blocks now include choice, slider and text questions, per-question weights and pass/imprecise/fail bands; plus whole-note review, AI generation, Anki parity, content authority, per-deck/per-note scheduling, file-explorer markers and source-anchored recalls, plus guided card/deck creation, optional CouchDB review-state sync, Simple Quiz blocks, Simple Note Quiz, Text2Anki, Spaced Everything, Auto Anki, Spaced Repetition quiz notes, Anki folder exclusions, the opt-in card reveal animation and the optional daily-quiz streak freeze. Row 28 was verified-satisfied against the existing whole-note queue. **A-Level Study Coach's error-log review sheet shipped in 1.163.0; its think-first timer is shipped (§11 item 17). No fully specified step-9 row remains.** Class Timetable's term calendar shipped in 1.162.0 (odd/even parity is §11 item 16), Study Vault's exam-days/topics widget is verified-satisfied, §5.22.4 item 4 is shipped, and item 1 is open in §11 item 13.

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
| [Kairos](https://github.com/caasion/kairos) | Time-blocked daily planning inside notes | **NOT MIT** (0BSD) | No Kairos source, styles or copy text may be reused, and 0BSD's Svelte/TypeScript stack is not reusable as-is in this dependency-free plugin. The local **Time blocks** module shipped in 1.210.1–1.210.2, gained Kairos's document model in 1.265.0 and its direct-manipulation surface in 1.267.0 (§5.22.12). |
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

#### Implemented from this audit (Oct 30, 2026, shipped)

- **Task time estimates (Task Hours, MIT).** `src/assignments.js` adds `estimateMinutes`, `estimateFromTask`, `formatEstimate` and `workload`; an assignment stores optional minutes in `estimate` frontmatter and mirrors them as `⏱️ 45m` on its Tasks line. The assignment dialog has an estimate field, and Assignments and Today show today, next-7-days and overdue totals. No code was copied; the implementation is original and dependency-free.
- **Markdown table import (Knap-adjacent).** `src/cards-import.js` adds the `mdtable` source. It reads the first table in a note, reuses the generic CSV header aliases, honours escaped pipes and inline code, converts `<br>` to line breaks, and writes ordinary card notes with `import_format: mdtable` and the usual import key. No Knap code was copied; the parser is original.
- Verification: **942 tests pass**, `npm run check` passes and `main.js` is rebuilt. No version bump and no GitHub release.

### 3.9.3 MIT study-plugin feature-gap matrix (historical — superseded)

The Oct 30, 2026 matrix (46 actionable rows, 13 covered/no-gap rows, 8 adjacent
tools) and its W1–W3 waves are **historical**. Every actionable row shipped
between 1.130.0 and 1.151.0; the rows that could not be implemented locally are
in the gate table (§3.9.6), and licence terms are in §3.10. Do not re-open the
matrix for new work: a new candidate needs a §3.10 licence check and a row in
§3.9.6 or §5.24, not another wave.

What the waves produced, all shipped, all dependency-free and all covered by
tests: inline quiz blocks with weights and bands, whole-note review, quiz reuse
with partial credit, the twelve-tab Study Workspace, portable archive, in-app
nudge, per-tool settings pages, and the block modules listed in §A.

### 3.9.4 Sixth MIT parity wave: fitting, study map and cited search — shipped

Self-fitting from observed recall (`src/fsrs-fit.js`), the `study-map` block
(`src/study-map.js`), cited local vault search (`src/vault-search.js`) and the
docked whole-note review bar with statistics shipped with the 1.130.0–1.151.0
range. No source was copied; the licence record is in §3.10. No open row.

### 3.9.5 Eighth MIT parity wave: portable archive and in-app nudge — shipped

Portable card archive (`src/card-archive.js`), the optional study nudge
(`src/study-nudge.js`) and the small study-flow items shipped with the same
range. No open row; remaining gates are in §3.9.6.

### 3.9.6 Gate table: rows that need an owner input

Every row here is blocked by something this environment does not have — a real
Obsidian window or physical device, an approved provider or credential, an
external fixture, proprietary data, or a security/product decision. **No row is
blocked by missing code.** The owner-facing form of these gates, with options
and a recommended default, is [docs/plan-decisions.md](docs/plan-decisions.md).

| Blocked row | Why it cannot be done here | Gate |
|---|---|---|
| Whisper, Lecture Transcriber and Advanced Audio Recorder recording | Needs a recording/transcription provider or local Whisper build plus microphone and mobile validation | §11 decision 2 |
| AI tutor scoring and embedding RAG | Needs an approved paid provider and model allow-list; Feynman feedback ships on the user's own provider | §11 decision 3 |
| Web lookup, AnkiWeb search and off-device semantic search | Needs an endpoint, citation and rate-limit policy; local cited vault search already ships | §11 decision 5 |
| Canvas LMS sync and Google Classroom OAuth | Needs registered OAuth clients and an owning account | §11 decision 6 |
| CBT `.vce` converter | No public format fixture or specification | §11 decision 8 |
| SAT scaled-score prediction | Needs a licensed official raw-to-scaled curve; the local solver already ships | §11 decision 8 |
| Real-Obsidian visual/math audit, screenshots and real iOS/Android audit | Needs a real window and physical devices | §11 E1–E2 |
| Code Runner in-plugin execution | Needs a security decision and a sandbox/language allow-list | §11 decision 12 |
| Misconception diagnosis on a miss | Taxonomy, re-check timing, provider fallback and storage field are unspecified; the decision keeps the error log unchanged | §11 decision 13 / D4 |
| Quiz Generator wider providers and locales | Needs provider/model allow-list entries and locale validation; the BYOK path and 22 languages ship | §11 decision 3 |
| Spaceforge objective tutor | Needs an approved tutor provider and objective model; the mind map, review bar and statistics ship | §11 decision 4 |
| Live AnkiConnect smoke test and live CouchDB two-device verification | Needs a real Anki desktop, CouchDB 3.x and two devices | §11 E7–E8 |
| Factual spot-check of AI-generated Spaced Repetition quizzes | Needs an owner review in a real vault; syntax is validated by round-trip import | §11 E10 |
| MDC AI-vision and legacy binary `.ppt`/`.doc` import | Needs an approved vision provider and binary fixtures; text OOXML import ships | §11 decision 3 |

**Decided Nov 6, 2026.** TTS/audio stays on device voices; pronunciation is declined; the FRQ grader carries no accuracy claim and the pilot has no numeric threshold; D5 stays on ICS; E11 stays absent. O13 ran a local duplication/licence scan with the scope limit written in §11.

**Resolved since the first version of this table.** OS notifications shipped
(`src/os-notifications.js`); PDF form filling shipped in 1.218.0 after §11 E4
reversed that gate; a bundled OCR engine was declined by §11 E3, which also
closed the course-note summary, paper-scanner and image-only OCR rows; card
schedules stay note-backed with the portable archive as the escape hatch
(resolved Nov 1, 2026); the minimal Omniscient keyboard map shipped and the full
map is rejected; the Qwen preset, chemistry/biology/circuit blocks and the
`.ppsx` text import shipped; LearnKit FSRS-6 fitting is resolved by the
per-deck `request_retention` fallback, not a full 21-weight trainer; commercial
distribution and exam-content policy are resolved by §11 O8.

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

**Rows R1–R4 shipped on Nov 1, 2026 and are UI-reachable:** R1 docked
whole-note review (`src/note-review-dock.js`), R2 review calendar and workload
(`src/review-calendar*.js`), R3 Anki-style statistics (`src/study-stats*.js`)
and R4 local recurring events (`src/local-events*.js`), each with its own
settings module and command/ribbon entry. R5 is complete for its dependency-free
slice — `.ppsx`/`.pptx`/`.pptm`/`.docx`/`.docm`/`.odt`/`.odp` text import; its
AI-vision and legacy binary `.ppt`/`.doc` slices stay gated on a provider and
binary fixtures. The objective tutor (§11 decision 4) and cited web lookup
(§11 decision 5) remain gated. No source was copied.

**Licence note.** All six repositories are MIT and are added to the §3.10 allow-list. No source file was copied in this audit; the rows above are feature descriptions only.

### 3.9.8 Per-study-tool settings modules — shipped

Status: implemented, consolidated and UI-reachable. Every study tool has its own
Settings page (32 of them) beside the core pages — Global, MCQ Tracker, Cards,
Calendar, Note review, Review calendar, Study statistics, Local events,
Pomodoro, Assignments and Reference. Global is an index, not a second set of
toggles: it keeps only the core switches (**MCQ Tracker**, **Cards and
vocabulary**, **Calendar**, **Assignments**, **Reference**) plus the global AI
switch, and its Study tools grid shows each tool's **On**/**Off** state with a
link to its page. No persisted setting was lost and no study tool can be enabled
from Global.

Page-to-runtime wiring was audited when this shipped; one disconnected control
was found and fixed (Recall Scheduler wrote `mode` but the view hardcoded
`"headings"`). The audit and round-trip checks live in
`tests/study-tool-settings.test.js` and `tests/settings-consolidation.test.js`
rather than here.

### 3.9.9 Reading library (Verso-style bookshelf) — shipped

The opt-in **Reading library** tab and Settings page: a book has a title,
optional author, shelf (`want`, `reading`, `finished`), total and current page,
rating and dated quotes; the tab shows counts, a finished-today celebration, a
shelf filter and per-book actions. `src/reading-library.js` owns the pure model,
`settings.readingLibrary` persists it, and `src/study-workspace-view.js` renders
it. Covered by `tests/reading-library.test.js`. Original code; no Verso source
was copied and no provider, network or audio path was added.

### 3.9.10 Row status — see §3.9.6

The Nov 1 audit table is superseded by §3.9.6 and by §B at the top of this file.
Its conclusion — no locally implementable row is left open — still holds at
1.282.0.

### 3.10 Licence allow-list: what may and may not be integrated

**Read this before copying anything.** This section is the source of truth for reuse; the per-row notes in §3.1–§3.9 are commentary on top of it. If an entry here disagrees with a row above, this table wins.

**Status:** a bulk audit on Oct 30, 2026 resolved 72 of the 76 plugin names in this document against `obsidianmd/obsidian-releases` `community-plugins.json`, then read each repository's own `LICENSE` file. Four names could not be found in the directory index and stay blocked (listed at the end).

**§3.9.1 additions:** every repository marked MIT in §3.9.1 was verified through the GitHub API on Oct 30, 2026 and is added to this allow-list. This includes Better Quizbox, Omni Quiz, Exam Plugin, QuizPort, Retain, Simple Flashcards, SFC Flashcards, LLM Test Gen, Cornell Marginalia, Hold Course, Course Command Center, Subject Manager, Verso, Better Task, Tag Timer, Pick Me, Gemini Helper, LLM Hub, Deep Notes, Feynman Learning, and the other rows in that matrix. MIT code may be ported only with its copyright and permission text in `NOTICES.md`; README-only claims still need a source check before copying.

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
| Grill | `theadamdanielsson/grill` | MIT |
| Synthesis Learning Companion | `ARENEWX/synthesis-learning-companion` | MIT |
| Vault Coach | `Wanjin5508/vault-coach` | MIT |

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
| Quiz Generator | `ECuiDev/obsidian-quiz-generator` | MIT |
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
| **Smart Question Tutor** (`smart-quiz-tutor`) | 0BSD | The `LICENSE` file reads 0BSD even though its README says ISC; 0BSD needs no attribution, but still record the source in `NOTICES.md` as a courtesy. |
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
8. **Interop — Full Calendar shipped (shipped):** read local event notes from a chosen folder, including single, all-day, multi-day, weekly `recurring` and `rrule` events. The source note opens from the event card, the interop is read-only, and foreign events are left out of `.ics` export. Hold Course and uni-calendar note properties are read-only interop candidates gated on one sample note from each; ICS import already covers their schedules.
9. **Mobile:** read-only Today and Upcoming views first; editing second.

**Shipped Oct 30, 2026:** Full Calendar local event notes (`src/calendar-interop.js`) are read from the folder in Settings, Calendar, Notes & Templates, **Full Calendar event folder** (empty means off). Single, all-day, multi-day, weekly `recurring` and `rrule` notes are supported; the card opens the source note instead of creating a class note; foreign events never enter `.ics` export. This is a compatibility reader for Full Calendar's documented frontmatter, not copied code. Covered by 3 focused tests.

**Shipped in 1.101.0:** the course registry stores name, code, folder, color, semester, instructor and credit weight. A code also matches timetable titles such as `CHEM 101 - Lecture`; a registered folder wins for new class notes, its color wins on the calendar, and its credits fill the GPA when Assignments has no explicit credit for that course. Existing subject/folder mappings and class colors still work as fallbacks.

**Core-values connector (shipped Nov 1, 2026):** the registry is the shared course identity (`src/course-identity.js`), with name/code/folder/alias lookup, old-string fallback and non-destructive rename aliases. `src/exams.js` merges the three exam sources and every reader (`examCapFor`, `studyPlans`, `course-health`, Today, planner defaults and generated tasks) uses it. **Add exam** writes a normal `type: exam` assignment note with optional topics, start time and weight; the planner offers **Use exam topics**. Attendance is idempotent from a calendar event, the class-note file menu or two commands, and lecture entries link their class note. Old notes and saved settings load unchanged because all new fields are optional and normalizers accept old data. Covered by `tests/core-values.test.js`; full suite 1,256 after the P0 hardening.

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

**Shipped:** optional `estimate` minutes and `⏱️` Tasks metadata, with workload totals in Assignments and Today (`src/assignments.js`).

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

**Core-values connector (shipped Nov 1, 2026):** `studyPlans()` returns one plan per exam in the next 30 days, soonest first, and `studyPlan()` remains the single-plan wrapper. A course with no matching questions keeps its plan with `readiness: null` and work items instead of disappearing. Plans accept lectures, readings, remaining planner passes and assignments due before the exam, expose `workItems[]` and `readinessEvidence[]`, and Today renders the evidence beside readiness. The exam list and review cap come from the merged model in §5.8; the Topic planner can seed topics from the same exam. Covered by `tests/core-values.test.js` and the existing study-plan tests; full suite 1,256 after the P0 hardening.

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

**Saved reference — Camera Capture (not scheduled, Nov 7, 2026):** [Camera Capture for Obsidian](https://github.com/becutandavid/obsidian-camera-capture) (MIT per its repository metadata; re-check LICENSE before reuse) is a small Obsidian plugin that adds **Take a picture** to the editor context menu. It captures through the desktop webcam or the phone's system camera, saves a JPEG in the vault using the attachment-folder setting (or its own photo folder), and embeds it at the cursor. It is relevant to the capture step above and to photographing paper FRQ pages in §5.20.5. It is **capture-only**: it does not build a multi-page PDF, crop/rotate/reorder, OCR, classify, or create MCQ/FRQ notes. Keep it as an MIT reference for a later scanner/FRQ-ingest pass; do not copy its code, add it as a dependency, or claim the §5.13.1 pipeline from it without a fresh implementation and licence check. Nothing here is scheduled.

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

**Automated audit shipped in 1.80.0:** every learner-facing surface uses `renderMarkdownInto`/Obsidian's `MarkdownRenderer`; answer choices are rendered as Markdown rather than plain list text. `src/math-rendering.js` adds a conservative render-time `\ce{}` fallback for simple formulas, charges and equations, and leaves complex mhchem syntax untouched. `tests/math-rendering.test.js` is the golden corpus for fractions, matrices, integrals, chemical formulas/equations, choices, explanations, code fences and the practice review path. The sample vault now ships the studyable audit note `samples/sample-vault/Questions/math-audit.md`, so the remaining visual check needs no pasted scratch note. The visual check on a real Obsidian window and test vault is still open and documented in `docs/math-rendering-audit.md`; this environment has no real Obsidian window.

**5.16.2 Chemistry structures**
- Support `smiles` code blocks in stimuli and choices when the Chem plugin is installed. Show a clear message when it is not (and which plugin provides it).
- Longer term, consider a built-in renderer only if integration proves unreliable.
- Allow answer choices that are structures (like FSRS Vocabulary's image/media question columns for the analogous pattern).

**Shipped in 1.91.0:** an original, local SMILES renderer (`src/smiles.js`) draws a documented teaching subset as SVG. `smiles` code blocks work in any Markdown surface because they use Obsidian's code-block processor, and Reference has a Structures tab with examples. Supported syntax: common organic atoms, bracket atoms with charge and hydrogen counts, single/double/triple/aromatic bonds, branches, ring-closure digits, `%nn` labels and disconnected fragments. Unsupported syntax returns a clear error; nothing is copied from Chem, RDKit, Ketcher or another GPL/AGPL project. The remaining visual check is the same real-Obsidian gate as §5.16.1.

**5.16.2a Local chemistry, biology and circuit blocks (shipped, Nov 1, 2026).** Obsidian registers three local fenced-code processors, so the diagrams render in stimuli, question bodies, answer choices, explanations and review whenever Markdown is rendered. `chem` accepts `SMILES: CC(=O)O` for a structure, or a simple equation such as `2H2 + O2 -> 2H2O`; it supports coefficients, common formulas, charges, states and the usual reaction arrows, and rejects complexes or condition labels rather than guessing. `biology` (alias `biosequence`) accepts a raw sequence or `type`/`sequence`/`translate`/`complement`/`name` options and renders DNA/RNA strands, complements and standard codon translation; protein sequences are grouped separately. `circuit` draws an explicit two-terminal netlist (`battery V1 ...`, `resistor R1 ...`, `lamp L1 ...`) with common components and ground, but it is a schematic renderer, not a circuit simulator. Feature parity is with the MIT-licensed Chem (https://github.com/acylation/obsidian-chem), Biosequence (https://github.com/jwreda/obsidian-biosequence) and CircuitJS (https://github.com/stevengann/obsidian-circuitjs) plugins; this implementation is original and no source was copied. All three are dependency-free local code and make no network request. Covered by 7 focused tests; the Qwen request contract adds 2 focused tests; full suite **1,242** and `npm run check` clean across **219 modules**.

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
1. **In-app microphone** using the browser's SpeechRecognition API, with OS keyboard dictation as a fallback. The transcript lands in the editable answer box before grading; unavailable speech disables the control with an explanation. The plugin records no audio and adds no speech provider key. Shipped for card answers in 1.279.0.
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

**Properties (see §6):** `answer_mode`, `accepted_variants`, `grading_strictness`, `last_typed_answer`, `last_verdict`, `verdict_override`, `graded_by`, `graded_on`, `grade_status: graded|self`, `grade_attempt_id`, `grade_confidence`, `grade_feedback`, `grade_model`, `grade_stale`.

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

**Shipped in 1.282.0: Quick Ask and saved study commands.** Quick Ask opens on the selection (or the whole active note), runs the selected action through the existing `chat` feature, and offers copy, insert, replace and follow-ups. Replace writes only if the editor selection is unchanged. Saved study commands (`Name | Prompt`) appear in Settings → AI and as a ChatPanel dropdown; `/id` expands at send time, with `{selection}`, `{note}` and `{path}` available only when the chat already allows that context. The command list is bounded (40 commands, 2,000 characters each), text is escaped and URL schemes are ignored, and no second provider, key store or network path is introduced. Files: `src/quick-ask.js`, `src/quick-ask-modal.js`, `src/study-commands.js`, `tests/quick-ask.test.js`.

**Shipped in 1.282.0: Quick Chat and message bookmarks.** **Study agent: Quick Chat** opens a compact prompt from the command palette or a user-assigned hotkey and submits through the active `ChatPanel`, so it uses the same model resolution, mention/context injection, chat budget and streaming/Stop/error path; it creates no provider client, and repeated invocation reuses the open prompt. Every user and assistant message can be bookmarked; **Copy link** writes an `obsidian://mcq-tracker-chat` link that restores the conversation and focuses the exact message. Bookmarks live on the existing conversation record (`settings.ai.studyChatBookmarks` or `chatSessions[].bookmarks`), survive reload, tab switches, archive and rename, and a deleted chat or message is reported in the UI rather than throwing. Files: `src/quick-chat-modal.js`, `src/chat-bookmarks.js`, `tests/quick-chat-bookmarks.test.js`.

**Surfaces**
- Side-panel chat on desktop; full-screen chat on mobile. ✅ 1.90.0
- Inline Quick Ask on selected text. ✅ Nov 6, 2026
- Slash commands and user-defined prompts. ✅ study commands; built-in `/guide`, `/quiz`, `/confuse`, `/gap`, `/predict`, `/feynman`, `/mock`.
- Floating Quick Chat and chat tabs. ✅ Nov 6, 2026 — see §5.18.1.

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

**Acceptance criteria for Quick Ask and study commands**
- Selection and whole-note context are separate switches; nothing outside the
  explicit choice is read.
- Nothing is written until **Insert** or **Replace** is pressed, and **Replace**
  refuses if the editor selection changed while the reply was pending.
- `/command` expansion is bounded, escaped and applied before the shared request
  path; an unknown slash command is sent literally, not treated as a command.
- Saved commands obey the same provider, cap, model, note-context and write
  guards as the chat.
- The command editor and picker normalise corrupt values to an empty list and
  never render raw HTML.

#### 5.18.1 Copilot feature and UI parity inventory (clean-room)

This is the full inventory requested for `logancyang/obsidian-copilot` 4.0.18.
It was built from Copilot's public README, docs and feature map. **No AGPL code,
prompts or styles were used**; the columns record behaviour and UI ideas only.
The status is about MCQ Tracker's own implementation, not a claim that Copilot's
code was ported.

**Status legend:** ✅ ships a usable equivalent; ◐ adapted or narrower; ○ not
built and locally implementable; ⛔ boundary — needs a service, conflicts with
an owner decision, or is outside this plugin's study identity.

**A. Chat surfaces and entry points**

| Copilot surface | What it does | MCQ status |
|---|---|---|
| Agent Chat sidebar | Long-running chat in the right panel, with tools and a model picker. | ✅ Study agent. |
| Quick Chat | Floating, compact chat from anywhere. | ✅ Nov 6, 2026. **Study agent: Quick Chat** opens a small prompt; Send dispatches through the active `ChatPanel`, so the shipped model resolution, mentions/context, 12,000-token budget, streaming, Stop and error handling all apply. It creates no separate provider client, reuses the open prompt instead of stacking modals, and starts a tab only when none is open. |
| Quick Ask | Inline question about selected text. | ✅ Nov 6, 2026. |
| Full-screen / mobile chat | Phone-friendly chat surface. | ✅ Nov 7, 2026. The Study agent controls strip gains **Expand** at ≤700 px; the same panel becomes a fixed full-screen surface using an Obsidian layer token, with **Exit**/Escape returning to the sidebar. No second view or phone-only component tree. |
| Ribbon and command-palette entry | Open chat or run an action. | ✅ Ribbon bot and `Study agent: open the sidebar`. |
| Slash commands | Built-in and user-defined prompt shortcuts. | ✅ Built-in tutor commands and saved study commands. |
| Projects | Group chats and context by project. | ✅ Nov 6, 2026. Named, local chat projects group saved conversations without bundling files or prompts. Each chat carries a `project` id through the existing session records, the Study agent library gains a per-chat project picker, an All/Unassigned/project filter and a row chip, **Remove project** unassigns its chats instead of deleting them, and **Study agent: create a chat project** opens the existing name prompt. Bounded at 30 projects and 60 characters; a missing or removed project reads as unassigned and nothing is written outside `settings.ai`. |
| Skills | Packaged instructions and resources an agent can load. | ✅ Nov 6, 2026. **Include skills** loads enabled Markdown notes from the configurable **Study agent skills** vault folder, with optional `name`, `description` and `enabled` frontmatter. It is off by default, reads files only when the switch is on, caps 20 skills, 4,000 characters per skill and 8,000 in the prompt block, treats the notes as user instructions rather than vault data, and counts the block in the existing 12,000-token budget. **Study agent: create a skill note** creates and opens a starter note. |
| Custom command editor | Create, edit and share reusable prompts. | ✅ Settings → AI → Study commands; no sharing/import format. |
| Chat tabs | Several conversations open at once. | ✅ Nov 6, 2026. **New tab** mounts another `ChatPanel` with its own transcript, model override, token footer and queued messages; switching leaves an in-flight reply running, closing writes the conversation back to the existing library, and open tab ids/order are restored from `settings.ai.studyChat` plus `chatSessions`. **New chat** still archives and starts clean. |
| Chat history, pins, archive | Browse, pin and archive conversations. | ✅ Nov 6, 2026. Saved conversations, rename, delete, new chat, pin/unpin and archive/restore; archived chats are hidden by default but stay searchable, and every flag persists in `settings.ai`. |
| Chat links and bookmarks | Link to a message or bookmark it. | ✅ Nov 6, 2026. **Bookmark** appears on every user and assistant message; **Copy link** writes an `obsidian://mcq-tracker-chat` URL carrying the chat, role, index and content hash. Opening it restores that conversation and focuses the message. Bookmarks persist on the existing chat record (`settings.ai.studyChatBookmarks` or `chatSessions[].bookmarks`), and a deleted chat, role mismatch or trimmed message falls back to a content-hash search before a plain Notice. No parallel store. |
| Queued messages | Queue a follow-up while a reply streams. | ✅ Nov 6, 2026. Send becomes **Queue** while a reply is streaming; a visible ordered strip supports per-item **Cancel**, drains one message at a time after the reply, and reuses the same model, mention, context and 12,000-token budget checks. The queue is stored with its conversation, survives tab switches and reload, still delivers after Stop or a provider error, and reports a refused queued send instead of swallowing it. |
| `/compact` | Summarise a long conversation to save context. | ✅ Nov 6, 2026. `/compact` folds older Direct API turns into a bounded deterministic local summary, keeps the newest turns verbatim, writes through `settings.ai.studyChat`, and updates the token footer. It makes no provider call; a short chat reports that there is nothing old enough, recent turns that alone exceed the budget are refused, and OpenCode explains that its server owns the history. |
| Plan proposals | Agent proposes a multi-step plan before acting. | ✅ Nov 7, 2026. **Study agent: plan a multi-step task** asks for a goal, sends it through the existing abortable chat request, and parses a numbered plan defensively in `src/chat-plan.js`; prose, empty steps and `NO_PLAN` leave the prior plan and vault untouched. The Study panel shows each step with **Approve**/**Skip** and **Run approved**, and the plan is stored with the conversation. Each approved step runs through the same send path, so any write still goes through the existing proposal window; a declined, failed or aborted step stops the run instead of being reported complete. Covered by `tests/chat-plan.test.js`. |
| Background subagents / multi-agent | Delegated workers and several agents. | ⛔ Requires an external agent runtime and entitlements; no second runtime. |
| Web viewer, YouTube and X tools | Fetch or browse remote content. | ⛔ Owner decision 5: no web lookup or off-device retrieval. |
| Obsidian CLI tool | Drive Obsidian commands from chat. | ⛔ Shell/arbitrary command execution is excluded. |
| Excalidraw integration | Create and edit Excalidraw drawings. | ⛔ Do-not-adopt row; separate canvas product. |
| OpenArtifacts publishing | Publish generated artifacts to a hosted viewer. | ⛔ Hosted service and outbound publishing are out of scope. |
| Self-host mode | Point the plugin at a self-hosted Copilot service. | ⛔ No second runtime, relay or hosted control plane. |
| Diagnostics | Connection/model/tool diagnostics. | ✅ Nov 6, 2026. **Study agent: save diagnostics bundle** writes one local Markdown report with plugin/version, platform, redacted settings, current chat-budget/model state, observed capability flags, recent local errors and the settings snapshot. It uses the existing Vault write path and Notice, makes no network request and is proved by `tests/diagnostics-gauge.test.js`. |

**B. Context and retrieval**

| Copilot context feature | What it does | MCQ status |
|---|---|---|
| Current note | Add the open note explicitly. | ✅ Per-chat switch, 6,000-character cap, frontmatter removed. |
| Selection | Add only the selected text. | ✅ Per-chat switch, 2,000-character cap; Quick Ask uses it directly. |
| `@` note and folder mentions | Address vault content precisely. | ✅ Nov 6, 2026. The `@` picker inserts `@[[path]]` for a note or folder; content is read at send time only while the chat's Mentions switch is on. At most 8 targets, 6,000 characters per note and 12,000 total; a missing target refuses the send and a large note is truncated with a visible warning. |
| Context chips / source list | Show what is attached before sending. | ✅ Mention chips name each draft target, and the context footer lists the current note, selection, mentions, slash command and history with an estimated token count. Citations stay clickable. |
| Local vault search | Retrieve relevant passages with citations. | ✅ Bounded lexical search, `[[path#L12]]` citations. |
| Full-vault index | Opt into paths-only file context. | ✅ Opt-in and off by default. |
| Relevant Notes sidebar | A persistent list of related notes. | ✅ Search results are clickable and cited; not a separate persistent pane. |
| PDF context | Ask about a PDF passage. | ✅ Nov 7, 2026. A selected passage still goes through `src/reading-companion.js` (`passagePrompt`), cited by page/annotation and covered by `tests/reading-companion.test.js`. General attachment now also ships: **PDF** in the Study agent or **Study agent: attach a PDF** picks up to three vault PDFs and a page range (default 1-20, at most 40 pages each), reads the text layer locally through the existing `readPdfPages`, and adds a labelled untrusted block with `[[path#page=N]]` citations to the next request. Missing, image-only or unreadable PDFs refuse the send; chips remove attachments; paths and pages persist with the conversation. No OCR, upload, dependency or new write path; `src/chat-pdf.js`, `src/chat-pdf-modal.js` and `tests/chat-pdf.test.js`. |
| Web-page context | Attach a URL and extract its content. | ⛔ Owner decision 5. |
| Image context | Attach screenshots or figures to a chat. | ⛔ Vision exists only for OCR/handwriting, not general chat attachments. |
| Miyo semantic search | Embedding-based vault retrieval. | ⛔ Nov 7, 2026 audit: embeddings need an embedding model and index, which this dependency-free plugin does not bundle or call. Local lexical retrieval with citations is the shipped path. |
| Memory | Remember facts across chats. | ✅ Nov 6, 2026. An opt-in local store of at most 50 short facts (240 characters each) lives only in `settings.ai.chatMemory`; facts are editable in a modal, redacted before storage or display, and reach a prompt only while **Include memory** is on, with the footer naming the count or the empty state. **Study agent: manage saved memory** opens the editor. This is a saved reference list, not transcript mining or long-term memory. |
| Study profile | Performance, due work and exams as context. | ✅ Three default-off aggregate toggles. |

**C. Conversation management and productivity**

| Copilot feature | What it does | MCQ status |
|---|---|---|
| Save and resume | Persist a transcript and reopen it. | ✅ Save chat and a saved-conversation list; newest 40 messages, 8,000 characters each. |
| Rename and delete | Manage saved conversations. | ✅ |
| New chat | Start clean without losing the old one. | ✅ |
| Search conversations | Find an old thread by text. | ✅ Nov 6, 2026. Searches titles and message text across saved and archived chats. |
| Export/share | Copy or export a conversation. | ✅ Nov 6, 2026. Copy per reply, **Save chat**, and a dedicated per-conversation Markdown export through the Vault adapter: each library row has **Export**, and **Study agent: export a conversation as Markdown** exports the open chat with title, model, project and a heading per turn. It never overwrites an earlier file and redacts key-like text. No hosted share link or upload. |
| Per-chat model | Choose a model for this thread. | ✅ Nov 6, 2026. A **Chat model** selector stores `settings.ai.studyChatModel`; it survives archive, reload and resume, shows the effective model and source in the composer footer, and falls back visibly when the model is no longer available. |
| Per-command model | Run a slash command on a chosen model. | ✅ Nov 6, 2026. Settings → AI → **Per-command model overrides** stores a bounded `settings.ai.commandModels` map; resolution is chat override → command override → global chat model, with unavailable models skipped and named in the footer. |
| Token ring / context gauge | Show how full the context window is. | ✅ Nov 6, 2026. A compact ring and `~tokens / 12,000` label under the composer read the shipped `lastBudget` object, update after sends, refreshes and `/compact`, hide until the chat has a message or draft, and degrade silently when budget data is unavailable. They use the existing Obsidian colour variables and container-width rules. |
| Cost display | Show running session cost. | ✅ Nov 6, 2026. The composer footer adds a conversation estimate derived from the stored transcript and the local **Local model pricing** table: each user turn is priced as a prompt that resends the prior context and each reply as output, so it survives reloads without new state. **Study agent: show this chat's cost estimate** reports the same number and explains the missing-data case. It stays silent without prices, never sends a request and is an estimate, not an invoice. |
| Message actions | Copy, regenerate, retry, stop. | ✅ Copy, regenerate, retry and Stop/Esc. |
| Rewind / fork | Re-run from an earlier question or branch the chat. | ✅ Nov 6, 2026. **Rewind** and **Fork** appear on every user message, and **Study agent: rewind to the last question** / **Study agent: fork from the last question** run the same operation from the palette. Rewind removes the later turns and puts that question back in the composer; fork copies the prefix into a new saved conversation and switches to it, leaving the original intact. Local Direct API transcripts only (OpenCode keeps its history on its server); the first question has nothing before it to keep and is refused. |
| Streaming | Render tokens as they arrive. | ✅ Direct API SSE and OpenCode events. |
| Queued follow-ups | Send while busy. | ✅ Nov 6, 2026. Send becomes **Queue** while a reply streams; a visible ordered strip supports **Cancel**, survives tab switch and reload, and drains one item at a time after the reply, Stop or a provider error. |

**D. Agent, tools and safety**

| Copilot capability | What it does | MCQ status |
|---|---|---|
| Read-only tutor | Answer with context, no writes. | ✅ Tutor mode, BYOK or OpenCode. |
| Vault-editing agent | Create and edit notes. | ✅ OpenCode agent mode; Direct AI uses reviewed proposals. |
| Allow-listed tools | A small, explicit tool set instead of filesystem access. | ✅ Create question, create card, replace one safe body section. |
| Diff review | Show the proposed change before applying. | ✅ Review and apply; no raw filesystem writes in BYOK mode. |
| Undo / revoke | Put back a change. | ◐ Nov 7, 2026 audit: `src/ai-writes.js` journals the paths written by AI generation flows, so those notes can be undone; there is no editor-change journal, so per-message rollback of every edit is not available and is not claimed. |
| Protected tracking fields | Prevent changes to results, history and scheduling. | ✅ Enforced by the write guard, snapshots and restore. |
| Folder allow-list | Constrain where writes may land. | ✅ Existing AI write roots. |
| Permission prompts | Ask before a tool runs. | ✅ Every proposal is reviewed. |
| Prompt-injection labelling | Treat notes and sources as untrusted data. | ✅ Shared note-context sanitiser and untrusted labels. |
| Shell / code execution | Run commands. | ⛔ Excluded by security gate. |
| MCP tools | Connect external tool servers. | ⛔ No MCP client or extra runtime. |
| Plan-then-act | Multi-step plan approval. | ✅ Nov 7, 2026. Approved steps run one at a time through `ChatPanel.send`; the model, mention, budget, streaming, Stop and write-review paths are shared rather than duplicated. A step may be skipped; an abort, declined write, provider error or partial apply stops later steps and is reported, and an interrupted run restores paused with the running step approved for a retry. State persists on the tab/session and in `settings.ai.studyChatPlan`. Covered by `tests/chat-plan.test.js`. |
| Background work | Continue a task after closing chat. | ⛔ No background daemon; Obsidian unload must stop work. |

**E. Models, providers and operations**

| Copilot feature | What it does | MCQ status |
|---|---|---|
| Multiple providers | OpenAI, Anthropic, Google and compatible APIs. | ✅ Anthropic, OpenAI, OpenRouter, Gemini, Qwen and OpenAI-compatible. |
| Local models | Ollama, LM Studio, llama.cpp, Jan. | ✅ Same Direct API path; desktop only for localhost. |
| Per-feature model | Different models for chat, generation, grading, vision. | ✅ Settings → AI → Models and request limits. |
| Fetch model list | Read the provider's available models. | ✅ Filtered to chat models and cached per provider/address. |
| Reply/day/run caps | Bound spending. | ✅ Reply token cap, daily request cap, per-run cap. |
| Cost estimate | Price a request before or after sending. | ✅ Nov 6, 2026. Settings → AI → **Local model pricing** accepts `model | USD per 1M input | USD per 1M output` lines and stores a bounded local map. The Study agent footer uses the effective model and the existing token estimate plus reply cap to show an estimated input/reply cost. It never fetches prices, never changes a request, and stays quiet when the model has no local price. |
| Capability reporting | Say whether a backend supports images, JSON, tools or streaming. | ✅ Per-backend capability report. |
| Test connection | One-word provider check. | ✅ |
| Mobile support | Work on phones where the provider allows it. | ✅ Direct API; localhost and OpenCode are desktop-only. |
| Self-host / relay | Run a separate Copilot service. | ⛔ |
| Diagnostics bundle | Collect logs and environment details. | ✅ Nov 6, 2026. **Study agent: save diagnostics bundle** writes one local Markdown report with plugin/version, platform, redacted settings, chat-budget/model state, capability flags, recent errors and the settings snapshot through the existing Vault path. Implemented in `src/diagnostics.js` and `src/plugin.js`; covered by `tests/diagnostics-gauge.test.js`; no network request. |

**F. UI design ideas and what was adopted**

| Copilot UI idea | MCQ decision |
|---|---|
| Compact right-sidebar chat with the composer pinned to the bottom | ✅ Nov 7, 2026. The pane is transcript-first: the conversation tab strip leads, local **Search vault** is a collapsed one-line disclosure, the message list fills the space, a **ChatControls** strip follows it, and the composer is pinned last. |
| Visible context toggles rather than hidden vault access | ✅ Adopted; current note and selection reset on New chat. |
| Source chips with clickable citations | ✅ 1.286.0. Mention and PDF chips live inside the composer card above the draft; citations remain clickable in replies. |
| Model picker in the composer | ✅ Nov 6, 2026. The Chat model selector sits beside mode and role; the footer names the effective model and source. |
| Assistant identity header | ✅ Nov 7, 2026; completed 1.288.1. Deliberately no branded header: Copilot's chat surface starts with the transcript, so the mode/role selector sits in the controls strip under it. **Settings**, **Chats**, **New chat**, **Save chat** and **Expand** share that strip. The leaf title is the only header; the 1.288.0 AgentView `h4`/intro was removed in 1.288.1. |
| Chat bubbles with speaker avatars | ✅ Nov 7, 2026. Copilot-style rows: user turns are full-width filled cards using `background-secondary` with no border; assistant turns are flat and unboxed with no avatars or speaker names. Reasoning, sources and tool activity rows are flat too. Message actions are compact icon buttons, and a caret marks streaming text. |
| Welcome screen with starter prompts | ✅ 1.286.0. An empty chat shows a greeting and three prompts (Explain this note, Quiz me on it, Plan my next hour) that send through the normal path; they hide once a turn exists. |
| Rendered verification | ✅ Nov 7, 2026. The current tree is captured at 320/420/560 px in light and dark from the real `AgentView` + `ChatPanel` markup and `styles.css`: 18 chat images in `docs/render/study-agent-ui/` (thread at all three widths, empty at all three, busy and error at 420, and the 420 px idle and busy composer with a draft) plus the unchanged settings fixture. `docs/render/study-agent-ui/README.md` maps each Copilot region — tab/context strip, thread and role rows, message metadata, composer, empty and streaming states — to the plugin component and `qt-*`/Obsidian token that renders it. The pane now includes the active conversation tab and collapsed local **Search vault** disclosure. The pass measured zero document/transcript overflow, a centered 268/368/480 px empty card, a 168 px active tab, all five 320 px context chips on one row, a 404×156 px composer with no gap above it at 420 px, the 320 px suggestion text unclipped, and the Send/Stop swap. It also fixed the 320 px persona and model labels, the 320 px table header wrap and the two-line suggestion clamp. **Limit:** no Obsidian app runtime; the final check is opening the rebuilt plugin in Obsidian light and dark. |
| Stop button that keeps partial text | ✅ Adopted; late replies are ignored. |
| Diff card with Apply / Cancel | ✅ Nov 7, 2026. Agent proposals show a compact line diff in an inline transcript card, and the existing review modal still owns Apply/Cancel; nothing is written before review. |
| Status cards for tool calls | ✅ Nov 7, 2026. OpenCode tool parts render as `qt-agent-tool-card` status cards with a tool label, file/command detail and running/done/error state; Direct AI proposals and staged note edits share the `qt-agent-proposal` card. |
| Token ring / context gauge | ✅ Nov 6, 2026. Adopted as a compact ring and numeric label beside the existing budget footer; no new visual language or counter. |
| Queued-message tray | ✅ Nov 6, 2026. Adopted as a visible ordered queue strip above the composer with per-item **Cancel**. |
| Pinned chats, tabs and archive | ✅ Nov 6, 2026. Pins and archive are adopted, and **New tab** keeps several mounted conversations with independent history, model, footer and queue state. |
| Slash-command popover | ✅ A datalist/dropdown inserts saved commands; built-in commands are documented. |
| Command palette with search | ✅ Native Obsidian command palette; no custom palette. |
| Empty state with suggested study actions | ✅ Nov 7, 2026. The empty transcript shows a three-card stack (`qt-agent-suggestion-deck`) seeded by the existing quick actions, rotates the front card every 7 seconds, and exposes dot controls; selecting a card sends through the normal path. |
| Mobile bottom-sheet composer | ✅ Nov 7, 2026. At ≤600 px the composer gains a grip, rounded top corners and safe-area padding while staying sticky at the bottom; it remains the same `qt-agent-composer` with no second input path. |
| Inline Quick Ask popover near the selection | ✅ Nov 6, 2026. |
| Inline diff in the editor | ◐ Nov 7, 2026. Staged edits now show a compact line diff in a `qt-agent-proposal` transcript card and the full diff stays in the review modal with Apply/Cancel; there is still no CodeMirror/editor overlay, so this row remains presentation-adapted. |
| Artifact/canvas panel | ⛔ Separate product. |
| Animated streaming caret | ✅ Nov 7, 2026. Streaming rows append a `qt-agent-caret` with a steps blink and a reduced-motion fallback; the markdown payload is unchanged. |
| Token/cost footer | ✅ A per-conversation footer lists attachments and an estimated `~tokens / 12,000`; it warns from 80% and refuses an over-budget Send. With **Local model pricing** set, it also shows an estimated input/reply cost in USD from the local table. No price list is fetched. |
| Theme-token styling | ✅ Uses Obsidian CSS variables; no Copilot stylesheet. |

**Boundary statement.** Copilot is AGPL-3.0. This inventory is a behavioural
spec, not a port. Features tied to Copilot Plus, Miyo, external CLI agents,
hosted viewers, Excalidraw, MCP, web retrieval or a self-hosted control plane
cannot be delivered by copying code and are marked ⛔ or ○ above. The owner's
"all features" goal is therefore met as an inventory; literal feature parity
would require separate product decisions and, for AGPL code, a different
licence. The `@` mention picker, chat search/pins/archive, context/token footer, chat
tabs/queue, per-command model settings, Quick Chat and message bookmarks shipped
on Nov 6, 2026. Since then Projects, Skills, the diagnostics bundle and the
token/cost display also ship. A Nov 7, 2026 pass re-read every non-✅ row. Plan proposals and
plan-then-act now ship with model-generated plans, per-step approval and the
existing write review; PDF context covers both passage Q&A and general vault
attachments; Miyo still needs an embedding model and index and stays ⛔; the
inline-diff presentation is adapted to the review modal (◐). No row is left
marked ○ as a locally implementable gap.

---

### 5.19 Mobile quick sessions  — **M**

**Goal (owner):** Someone can pull out a phone on the bus or at lunch and do a few problems in under a minute of setup.

**Entry points**
- Ribbon icon and command: **Quick Practice**.
- A **Today** screen: due counts, next class or exam, and a single **Start 5 minutes** button.
- **Shipped:** Obsidian URI `obsidian://mcq-tracker-quick?minutes=5` for a home-screen shortcut; `count=10` selects a question-count session and `course=Biology` scopes the queue. The OS still decides whether it creates the shortcut; the plugin registers the action, validates inputs and opens the same saved Quick Practice session.

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
| Flashcards (flip, type, speak by microphone or OS dictation) | Yes (microphone depends on the WebView's speech support) |
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

**Closed by owner decision:** no human-scored agreement study or go/no-go evaluation is planned; the grader remains an aid. 1.104.0 shipped photo-of-handwritten-work reading, and 1.101.0 shipped the rubric category taxonomy (`[thesis]`, `[evidence]`, `[reasoning]`, `[calculation]`, `[units]`, `[notation]`, `[communication]`), shown in the grader and preserved in generated notes. Since 1.99.0, missed criteria drive the prompt's review date, appear in Today and the next exam's study plan, and link from Insights. No claim of reader-level accuracy is made.

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

**Definition of ready:** a reviewed spec listing supported AP courses, the rubric schema, the exam-profile and curve schema, the resource-link policy, the copyright/permissions review, UX flows, and acceptance tests. The owner declined the human-scored accuracy claim on Nov 6, 2026, so the fixture set is not a prerequisite for the PDF→FRQ import in §5.20.5; the grader must stay labelled an aid. The FRQ grader research spec and evaluation plan is [docs/ap-frq-grader-spec.md](docs/ap-frq-grader-spec.md).

#### 5.20.5 PDF→FRQ import — shipped

**Goal:** a learner supplies a PDF containing free-response prompts and the scoring rubric, reviews what the text layer produced, creates ordinary FRQ notes, types an answer, and the existing AI tutor grades it against that rubric.

- **Entry:** command **AP: import free-response questions from a PDF**. It lists the vault's PDFs (one PDF opens directly, several open the picker) and calls `importFrqPdf(file)`. A PDF can also be passed to that method from another surface. The PDF is only read; nothing is uploaded and no copy is stored.
- **Read:** reuse `readPdfPages` in `src/pdf.js` (pdf.js `getTextContent`) and its per-page `text`/`lines`. This import is text-layer only. A scanned/image-only PDF with no text layer is refused with a Notice; it does not run OCR or a vision call. Use the existing PDF/OCR tools separately if the user wants an image-only document turned into text.
- **Split:** pure `splitFrqItems` in `src/frq-import.js` proposes at most 60 items. Question starts are `Question N`, `Free Response Question N`, `FRQ N`, `N.` and `N)`; rubrics start at `Scoring Guidelines`, `Scoring Rubric`, `Rubric`, `Answer Key`, `Points Possible` or the first recognizable criterion/table row. Each item keeps the prompt text before the rubric (including any stimulus), rubric text, parsed criteria and points, source page/pages, warnings and a `valid` flag. Prompt text is capped at 20,000 characters and rubric text at 12,000. An unrecognized rubric is never replaced with a preset; the item stays visible as invalid.
- **Preview:** `FrqImportPreviewModal` shows the source, warnings and every item with its title, prompt, rubric and page. The learner chooses the course and question type for the batch, edits the title/prompt/rubric text (Markdown bullets or a points table), unticks an item to drop it, or cancels. Drawing the modal writes nothing. On create, every selected item is parsed and passed through `buildFrqNote` before the first write, so one invalid item blocks the whole batch. Name collisions use the existing unique-path helper.
- **Write:** `buildFrqNote`/`createFrqNote` write ordinary AP FRQ notes under `AP FRQs/<course>/` with the existing schema and `rubric_source: user`. No new note type, property or migration; imported rubrics are user-supplied, not official.
- **Grade:** typed or OS-dictated answers go through the existing `gradeFrqWithAi` path, second pass and history. No new AI feature id, provider or model allow-list entry. The grader remains labelled an aid; the import makes no accuracy claim.
- **Tests:** `tests/frq-import.test.js` covers multi-question splitting, table and bullet rubrics, missing rubric, empty text layer, a heading-less document, review-before-write, course selection, discarding an item, invalid-item refusal, the PDF picker/command and grading an imported note. No network.
- **Limits:** text-layer PDFs only (no OCR/vision fallback in this import), no bundled AP content, no accuracy claim, no PDF upload or stored copy, and no new dependency or note schema. The owner supplies the PDF.
- **Capture reference:** the [Camera Capture for Obsidian](https://github.com/becutandavid/obsidian-camera-capture) reference saved in §5.13.1 is a possible way to photograph paper FRQ pages for a later pass; it is image capture and embedding only, and it is not connected to this text-layer importer.

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

### 5.22 October 28 idea backlog — captured Oct 28, 2026; shipped items marked

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

#### 5.22.4 Smaller study-flow ideas — shipped (1.17.0–1.55.0)

**Status: shipped.** Rule-based extraction, per-note opt-in and Practice-this-note-only
(1.17.0); daily quiz and streak (1.18.0); image occlusion (1.19.0); tutor roles
and slash commands (1.20.0); GIFT (1.21.0), Moodle XML/QTI (1.22.0), Mochi and
CrowdAnki (1.23.0), import preview and duplicate handling (1.24.0); interleaved
mixed review (1.55.0); PDF sidecar annotations (1.27.0) with the pen and
highlighter overlay (1.52.0) and text boxes (1.53.0); the PDF page and form
editor (1.218.0). **Closed by owner decision:** provider TTS, audio-only
commute mode and pronunciation feedback are declined (§11 decisions 2 and E5);
device-voice Read aloud remains.

The bullets below are the original idea record; every locally implementable one
has shipped.

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
3. **PDF editor — shipped in 1.218.0 after the owner reversed E4.** Page operations, content editing (typed text, vault images, page numbers, cropping, watermarks, document properties), splitting every N pages, AcroForm filling and authoring (new text fields, checkboxes, dropdowns and radio groups) and annotation flattening use the vendored MIT pdf-lib 1.17.1, with every mutation one undo step in a bounded, byte-level history (`src/pdf-editor-history.js`) that returns the opened file byte-for-byte; every save is a new copy and clears the history. XFA forms and rewording existing page text remain out of scope and are refused rather than approximated.
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

#### 5.22.12 Kairos-style time-block planning — shipped 1.210.1; interaction parity in 1.265.0–1.267.0

**Source:** [Kairos](https://github.com/caasion/kairos) (0BSD), a time-blocked daily-planning Obsidian plugin. Its Day/Week timeline, Grid, Backlog, Routines, Projects/domains and Timeline views are the design reference; no Kairos source, styles or copy text was copied, so no notice or dependency is added.

**Status:** implemented Nov 3, 2026 as the opt-in **Time blocks** module in Study Workspace and released in **1.210.1**. It is off by default. The local model lives in `src/time-blocks.js`; plugin CRUD, routines, backlog scheduling and the readable Markdown export are wired through `src/plugin.js`. Settings, the tab, all seven views and responsive styles are included. Existing `studyTasks` are reused in the Backlog, and completing a linked block task completes its study task. Projects and domains are optional lenses; timeline minutes are derived from blocks rather than kept as a second total. Routines only add missing blocks for a date, so applying one twice does not duplicate it.

**Status (Nov 5, 2026, released 1.265.0):** the owner ranked the remaining Kairos gap, so the former owner gate is closed. 1.265.0 adds Kairos's documented document model and behaviours to the existing module: a `## Schedule` parser and writer with task statuses, associations, notes and the `Unscheduled` block; Backlog.md and Routines.md parsing/writing; weekday, weekend, day-list and monthly routine rules with per-line overrides and routine tasks; regeneration of a day's routines; carry-over of open/half-done tasks with associations materialised on move; imports for Routines.md and Backlog.md; and two-way sync of one day's Schedule section. It remains original dependency-free JavaScript, with no Kairos source, styles or copy. 1.267.0 closes the interaction gap: a pointer Day rail creates, moves and resizes blocks with mouse or touch; task boxes cycle and can be cancelled by right-click or long-press; Week accepts block and task drops; Timeline shows a 14-day intensity strip; projects record lifecycle history and intensity in Markdown files; `time-blocks-tour` opens a guided walkthrough; Routines.md and Backlog.md write back; and `time-blocks-import-kairos` copies Kairos's `data.json` settings. The remaining differences are cosmetic view options (fit-days width, grid row lines/shading, follow-grid and highlight-across-views) and a tour that guides rather than detecting each gesture. The Kairos row in the §3 source map carries the same status; this section is the single record for the item. Cross-references use the section number because the line anchor this item was captured with has moved.

**Calendar compatibility:** when the existing Calendar module is on, Day and Week read `plugin.calendarEvents()` and show classes and events as read-only context. A block that shares an event's time is marked as an overlap; the configuration card reports event count, booked minutes and overlapping blocks. Week columns group the same `dateKey` events under each day. The **Show calendar events** switch (default on) hides this context. Nothing is written, moved or copied into the planner, no calendar note is required, and Time blocks still works with Calendar off. The planner uses its own week-start setting, so changing the calendar's week start does not silently reshape saved plans.

**Calendar integration (Nov 3, 2026, released 1.210.8):** the calendar's day section now renders the Kairos layer itself when Time blocks is on. `src/calendar-planner.js` is pure: `dayPlan` merges the day's read-only classes with the local blocks, computes the free slots inside an 08:00–22:00 planning window (30-minute minimum), flags blocks that sit over a class and returns a summary; `slotDraft` and `afterClassDraft` build block drafts and `planSummaryLine` writes the one-line summary. `plugin.calendarPlannerDay(date, events)`, `planBlockFromCalendarSlot` and `planBlockAfterClass` add blocks through the existing `addTimeBlock`, so nothing new is stored and no second timetable exists. The UI lists planned blocks with **Remove**, free-slot chips that plan a study block titled after the next class, per-class chips that plan a 45-minute review block, and **Open Time blocks**. Calendar events, notes and .ics feeds stay read-only; a block is never written back to the calendar. Covered by `tests/calendar-planner.test.js`; notes are in `docs/release-notes/1.210.8.md`.

**Two-way daily-note sync (1.265.0):** `plugin.syncTimeBlockDailyNote(date)` reads the day's `## Schedule` section, replaces that day's blocks from it (creating missing projects/domains), and writes the section back while leaving every line outside it untouched. `parseScheduleMarkdown`, `timeBlocksFromSchedule`, `scheduleMarkdown` and `replaceScheduleSection` in `src/time-blocks.js` are pure; the plugin method is the only vault read/write. The older one-way `writeTimeBlockDay` export into `<Day-note folder>/YYYY-MM-DD.md` is unchanged.

**Acceptance evidence:** `tests/time-blocks.test.js` covers default-off normalization, time validation, summaries, routines, backlog reuse, project/timeline totals, Markdown export, persistence, read-only calendar context and overlap marking, and every empty state. `tests/study-workspace.test.js` covers the module key and the all-modules-off gate. Verification: **1,524 tests pass / 0 fail**, `npm run check` clean across **257 source files**, `main.js` current across **257 bundled modules**, `git diff --check` clean. Release notes are in `docs/release-notes/1.210.1.md`.

#### 5.22.13 Class Timetable 2.0 UI ideas — captured Nov 8, 2026

**Source:** [Class Timetable](https://github.com/elliott-json-park/obsidian-class-timetable), README's 2.0 feature set; MIT verified from the repository `LICENSE`. **Captured, not approved:** no source, styles, copy or dependency is adopted, and this subsection adds no checklist row, phase assignment or release commitment.

**Already covered — do not rebuild:** the existing calendar has term start/end, week numbers, reading weeks, odd/even parity (resolved in §11 item 16), course identity/registry, `.ics` import and filtered export, per-class note templates, exams/countdowns, Today/Upcoming, attendance and lecture history, and the 1.210.1–1.267.0 Time blocks planner. A second class store or a calendar-event-first rewrite is not warranted.

**Ideas worth considering, cheapest first:**

1. **Week timetable for the existing Calendar** — a real-clock Mon–Sun grid over the same events, with overlapping classes split into columns, a now-line and the existing live current/next-class countdown. Offer it as a dockable sidebar leaf so the week stays visible while a note is open; no new schedule storage. This is the most direct fit to the plugin's timetable-first view and the most visible UI gap.
2. **Class-held dots on the course hub** — one dot per scheduled meeting this term: filled when that day's lecture note exists, a ring when attendance was checked without a note, empty when the class did not meet. Clicking an empty dot creates the note from the existing course template. It turns the existing attendance and lecture log into a semester record without a new property.
3. **Semester rollover** — one command that stamps the current `semester:` on its courses and starts the next term's calendar empty, without moving notes or rewriting the old term. The registry already stores `semester`; this only adds the transition.
4. **Week image export** — render the current week at full size in the active theme and save or copy it, for sharing a timetable without a screenshot. Optional and isolated; it changes no scheduling data.

**Deliberately not revived:** the paste-a-timetable parser remains out (the Oct 30 pass kept subject-timetable parsing out; `.ics` import covers portal exports), and no planner, task or schedule data is duplicated. `Today` and `Upcoming` already exist, so a third "today" view is not proposed; if the §5.8 `uni-schedule`-style embed is built, it should reuse this week view rather than add a second block syntax.

#### 5.22.14 Doable agenda ideas — captured Nov 8, 2026

**Source:** [Doable](https://github.com/elliott-json-park/obsidian-doable) (community listing: [community.obsidian.md/plugins/doable](https://community.obsidian.md/plugins/doable)), README at v1.0.2; MIT verified from `LICENSE`. The README also notes a bundled BSD-3-Clause `rrule`, so any recurrence parity must use the existing local scheduler/date code, not that bundle. **Captured, not approved:** no source, styles, copy or dependency is adopted, and this subsection adds no checklist row, phase or release commitment.

**Already covered or specified — do not rebuild:** Tasks-compatible `📅`/`⏳`/`🛫` syntax and recurrence (§5.9), assignments and study tasks, Today/due queue, the vault task index, Time blocks backlog/statuses, daily notes and the existing task-edit paths. Doable is deliberately a list, not a project manager; boards, Gantt, time tracking and calendar sync are out.

**Ideas worth considering, cheapest first:**

1. **Agenda rail over the existing task index** — a side panel grouping overdue, today, the next days one by one, later, no date and done today, with empty sections skipped and a visible section cap. Priority-coloured completion circles, click-to-open-source, and text/tag/note filtering. It reads and completes tasks through the existing paths; no new schema or store.
2. **Plain-language quick add with a preview** — one input parsing "tomorrow", weekdays, "in 3 days", repeats, `!high` and tags; show the interpreted date/repeat/priority before writing. Then write the existing Tasks-compatible line into an inbox or today's note. Keep the parser local and dependency-free; no AI or network.
3. **Inline task chips** — in Live Preview and Reading, show date/repeat/priority as small chips and reveal the raw Markdown when the cursor enters; click a date chip for a picker, click priority to step. Decoration only, never an early rewrite. The most implementation-heavy idea; optional and behind the existing module switch.
4. **Transient Undo on agenda edits** — after complete, reschedule, repeat or cancel, show a short-lived Undo that restores the exact previous line. Complements the existing safe write path; no history or extra property.

**Not proposed:** a second task format or store, a `doable`-specific syntax, bundled `rrule`, natural-language AI parsing, boards/Gantt/time tracking/calendar sync, or replacing the Tasks-compatible source of truth. If a query block is wanted later, support only the documented everyday subset and list unsupported clauses instead of silently changing results.

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

**Qwen and STEM blocks implemented (Nov 1, 2026, shipped).** The Qwen preset was added after confirming the DashScope OpenAI-compatible endpoint; `qwen-plus` is the default and the base URL remains editable for regional or dedicated endpoints. The local `chem`, `biology`/`biosequence` and `circuit` blocks close the science-rendering cluster without adding a bundled library or copied source. See §5.16.2a and §11 items 16–17.

---

### 5.24 Academic and researcher plugin scan — captured Nov 3, 2026; local parts shipped

**Status:** historical backlog. Every local candidate this section named has shipped (see the table below and the status paragraph after it); what remains is reference-only. It approves no new plugin, dependency, code, data model, setting, command or UI. Nothing here overrides the dependency-free, local-first and off-by-default rules in this plan.

**Backlog status after 1.241.0:** every local candidate this section named is shipped — Time blocks with calendar context (1.210.1), the one-way daily-note reader and **Open daily note** action (1.210.2), the Citations library (1.210.3), PDF page deep links (1.210.4), the read-only vault checklist index (1.210.5), the local task-tag rename (1.210.9), the local glossary lookup (1.210.9, widened in 1.210.10 to the saved vocabulary list and the lecture-note vocabulary tables) the read-only writing-session count (1.210.10), **subject colours** in Time blocks (1.239.0) and **event tags** on time blocks (1.240.0). The Study Flow Planner row is now fully implemented for its local parts. A generic template builder and import-only attachment routing remain unranked candidates; Dataview, Excalidraw, a second AI runtime, a Zotero database and vault-wide rewrites stay rejected. **1.241.0 reverses the iframe rejection for one opt-in view** after the owner asked for a browser: pages load in a sandboxed frame, only http/https addresses open, and nothing is proxied or injected; every other module still avoids iframes. No dependency was added by any of these releases. **1.292.0 reverses the Recent Files row**: its view is a thin local navigator over Obsidian's existing recents, not a second history, and the change is recorded in `docs/installed-plugin-parity.md`.

**Sources:** [Study Flow Planner](https://community.obsidian.md/plugins/study-flow-planner) and [Study Agent](https://community.obsidian.md/plugins/study-agent), plus an owner-supplied academic-plugin round-up (17 plugins) and its reader comments, all supplied Nov 3, 2026. The marketplace pages are script-rendered, so the two named plugins were checked against their public forum/GitHub descriptions where available. Study Agent's exact study loop still needs a live inspection before any port is scoped.

#### Directly named community plugins

| Source | Idea worth keeping | Fit in MCQ Tracker | Decision |
|---|---|---|---|
| **Study Flow Planner** | A visual day/week/month timeline from 05:00 to 23:00; subject colours; events linked to notes; automatic detection of daily-note lines such as `09:00 Event title`; per-event tags, notes, colour and done state. | **Time blocks** owns local Day, Week, Grid, Timeline, project lenses and task-in-block state. **1.210.2 shipped the one-way daily-note reader**: a configured `YYYY-MM-DD.md` is previewed, duplicates are skipped and only new lines become blocks. **1.239.0 adds per-course subject colours** (course → project → type precedence, picker and Clear in the tab) and **1.240.0 adds block tags** (up to six local tags, chips, a Day filter and tags in the day-note export). | **Implemented for the local parts it named.** Daily-note lines, subject colours, tags and task state are live; the Grid and Timeline views keep project colours, and no Study Flow Planner code or styles were copied. |
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
| **PDF++** | PDF annotations and deep links to a page, selection or rectangle. | **Full upstream parity.** The unmodified MIT PDF++ 0.40.31 bundle is embedded in `vendor/pdf-plus.js` and its stylesheet in `vendor/pdf-plus-css.js` and loaded by `src/pdf-plus.js` as a managed child component. All upstream native-viewer features are present — backlink highlights/callouts, colour palette and copy templates, context menus, outline/page-label/embed editing, PDF page composer, internal-link history, external-app sync, Vim mode and PDF++’s settings tab. PDF++ settings are namespaced under `settings.pdfPlus` and its controls are mounted inside MCQ’s PDF++ page; the host captures the vendor settings tab instead of adding a second top-level plugin tab. MCQ’s own PDF reader, sidecars and editor remain. The full upstream source is https://github.com/RyotaUshio/obsidian-pdf-plus. |
| **Pretty Properties** | Covers, coloured properties and friendlier property display. | **Reference only.** Cosmetic metadata presentation; the underlying properties stay unchanged. |
| **QuickAdd** | Named capture commands that create a note in the right folder from a template. | **Partially covered.** Calendar class notes and course-note actions use templates. A generic user-defined template builder is not justified yet; revisit only if capture requests keep recurring. |
| **Recent Files** | A recent-note navigator. | **Reversed in 1.292.0 at the owner's request.** The local view reuses Obsidian's recent order, adds search, pinned paths and file opening, and stores only `settings.recentFiles`. No second history or note copy is kept. |
| **Style Settings** | Expose theme and plugin CSS variables to the user. | **Reference only.** A theme-integration surface, not a core study feature. |
| **Supercharged Links** | Decorate links by folder, tag or property. | **Do not adopt.** Visual link rules would duplicate Obsidian/theme features and add a styling API. |
| **Tasks** | Aggregate checkbox tasks across the vault, with due dates and query syntax. | **Read-only index implemented in 1.210.5.** The Tasks tab scans Markdown for `- [ ]`/`- [x]` lines with note path and line number, skips fenced code and filters by text, tag or path. No writes, no query language and no task-syntax changes. |
| **ZotLit** | Read a Zotero database directly and create literature notes from it. | **Do not bundle.** It needs a reference-manager database and a second process/integration. A local BibTeX/CSL-JSON import is the safer candidate. |

#### Reader-comment suggestions

These came from the reader comments in the same round-up. Several repeat an earlier row; they are kept here so no idea is lost.

| Suggested plugin or idea | What it could mean locally | Decision |
|---|---|---|
| **Advanced Tables** | Table formatting, navigation and formulas. | **Editing/navigation shipped in 1.234.0; row/column insertion, deletion and move shipped in 1.235.0; cell formatting and column alignment shipped in 1.236.0; formulas and CSV export shipped in 1.237.0; stable body-row sorting shipped in 1.238.0; merged cells and tab-separated copy followed in 1.259.0–1.264.0, so upstream 0.23.2's command set is covered.** |
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
| **Iframes** | Embed web pages inside notes. | **Reversed for one view in 1.241.0:** the owner asked for a browser, so the opt-in Web browser embeds http/https pages in a sandboxed frame with `referrerpolicy="no-referrer"`; it proxies nothing, injects nothing and reads nothing cross-origin. Every other module still avoids iframes. |
| **Dataview** | Query notes with a query language. | Do not adopt the dependency or a dynamic query language. Existing filters and local indexes are deliberate. |
| **Dice Roller** | Pick a random note, line or table row. | The useful idea is local random recall; the Recall Scheduler and practice filters already cover it without a dice dependency. |
| **Highlightr** | A palette for text highlights. | Reference only; cosmetic editor styling. |

#### Rule for any later adoption

Any ranked item must be original code or a clearly licensed port with a notice; no runtime dependency, dynamic code, background service, telemetry or hidden network request. Read-only first, preview before a note write, undo where a write is allowed, and off by default when it adds a new surface. A local parser is preferred to a live integration with another plugin.

**Nothing in this section is queued.** All four candidates shipped: daily-note reader 1.210.2, citations library 1.210.3, PDF deep links 1.210.4, read-only vault task index 1.210.5, subject colours 1.239.0 and block tags 1.240.0. Study Agent stays a reference for workflow design, not a second AI runtime; everything else is reference-only until a concrete study workflow and acceptance test exist.

### 5.25 Voice plugin scan — captured Nov 3, 2026

**Sources:** [Voice to Text](https://github.com/satosprod/voice-to-text), [Quick Voice Note](https://github.com/spencer1975/quick-voice-note), [obsidian-voice](https://github.com/chrisurf/obsidian-voice) and [Elton AI](https://github.com/swayinfo/elton-ai), all supplied Nov 3, 2026. **Status:** the local parts are ranked and shipped one release each; anything needing a cloud speech provider, a paid transcription service, a relay or a second assistant runtime stays out.

| Plugin | Idea worth keeping | Decision |
|---|---|---|
| **Voice to Text** (SATOSprod) | Push-to-talk dictation with Deepgram Nova 2 or Groq Whisper, a fixed model and language list, hotkey capture, optional WAV saving. | **Do not adopt.** The licence is proprietary, so no code or styles may be copied, and every path needs a cloud speech key plus a recorder the plugin does not own. The reusable idea — a short voice capture that lands in a note — is covered locally by Quick Voice Note's audio memo path below. |
| **Quick Voice Note** (spencer1975) | One-tap long memos, pause/resume, audio kept in the vault, and a timestamped entry appended to today's note; transcription optional through any OpenAI-format endpoint. | **Audio-first half adopted in 1.210.7.** Local capture saves the recording into a configured folder and appends a `- HH:MM ![[…]]` line to the day's note, with a duration and optional note text. Transcription stays out: no paid service, no managed key, and the existing AI settings are not silently reused for audio. |
| **obsidian-voice** (chrisurf) | Audiobook-style TTS with provider voices and MP3 export, plus three content toggles: read or skip code blocks, spell out acronyms, skip website URLs. | **Content toggles adopted in 1.210.6.** Read aloud keeps its local device voice and gains **Code blocks**, **Spell out acronyms** and **Skip website URLs**, all off-by-default in the sense that the previous output is the default. Provider TTS, voice catalogs and MP3 export stay out: they need a speech key and a second audio path. |
| **Elton AI** (swayinfo) | A voice-and-text assistant over the vault, phone app through a relay, Telegram bot, embedding index, templates and scheduled prompts. | **Do not adopt the runtime.** Direct AI, OpenCode chat, generation, verification and write guards already cover the assistant surface; a relay, a bot and an embeddings index would duplicate providers, budgets and safety checks. The useful, safe idea — **voice input lands in a text field for review before it is sent** — is the rule for any future dictation: transcribe into an editable field, never send automatically. |

**Rule for any later voice work:** recording, transcription and speech stay local, use the browser/OS speech service the user explicitly invokes, or use a provider the user configured; audio is written only when the user stops a recording; nothing is transcribed, uploaded or sent to a model without an explicit action; and no second assistant runtime, relay or bot is added. Every release adds no dependency.

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
| Card answer modes | `answer_mode: flip\|type\|speak\|auto`, `accepted_variants`, `grading_strictness: strict\|standard\|lenient`, `last_typed_answer`, `last_verdict`, `verdict_override`, `graded_by`, `graded_on`, `grade_status: graded\|self`, `grade_attempt_id`, `grade_confidence`, `grade_feedback`, `grade_model`, `grade_stale` |
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
- [x] Confirm licenses of anything currently bundled (§9) — audited in NOTICES and `docs/license-audit.md`; every future candidate still needs a repo-level check before use
- [~] **Math/chemistry visual audit (§5.16.1)** — visual pass in a real Obsidian window (light/dark, narrow pane, timed test, cards, chat); not performed in this environment; blocker and checklist in §B / §11 E1.
- [~] **Real iOS/Android audit (§5.19)** — physical iOS and Android device pass; not performed in this environment; blocker and checklist in §B / §11 E2.
- [~] **README screenshots (§10b)** — four real-window screenshots; mock images are not acceptable; not produced in this environment; blocker in §B / §11 E1.

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

Most rows here are shipped research and specification items; PDF→FRQ import shipped as text-layer preview-then-create. The AP FRQ grader is the owner's requested next idea after card import; the score calculator and resource hub are its natural companions.

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
| **Nov 7, 2026 study-source re-check** | `LICENSE` files read for LearnKit, Qard, Grill, FSRS Flashcards, VaultQuiz, Synthesis Learning Companion, Claude Tutor, Smart Question Tutor, Quiz Generator, True Recall, Vault Coach and Adaptive Practice. MIT: LearnKit, Qard, Grill, FSRS Flashcards, VaultQuiz, Synthesis Learning Companion, Claude Tutor, Quiz Generator, Vault Coach and the Adaptive Practice plugin. **0BSD:** Smart Question Tutor (its README says ISC; the `LICENSE` file wins). **PolyForm Strict 1.0.0:** True Recall, blocked. **AGPL:** the Whetstone engine behind Adaptive Practice, blocked. A Nov 7 search could not re-surface Qard, VaultQuiz or Note Quiz Engine: Qard and VaultQuiz were already cleared by reading their `LICENSE` on Oct 30, so re-open those files before copying; Note Quiz Engine is a Markdown format, not a plugin, and stays unverified. **No code was copied.** |
| **Copy candidates for owner approval (O12)** | If approved, port small pieces only: LearnKit's FSRS-6 wrapper and test-generation/Companion patterns (§5.1, §5.3, §5.18), Qard's typed-answer flow and card model (§5.7, §5.17), Grill's rubric schema and grading prompts (§5.5, §5.17), and VaultQuiz's incremental streak (§5.19). All are TypeScript; strip to CommonJS + JSDoc, keep the copyright header, add the MIT text to `NOTICES.md`, and treat every typed answer as untrusted input. |

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

> The owner-facing gate list, with options and a recommended default per row, is [docs/plan-decisions.md](docs/plan-decisions.md).

### Resolved (see §0)
Packaging, audience, calendar and flashcard priority, BYOK + OpenCode, mobile quick sessions, agent-driven development, and the two new ideas (typed/spoken flashcards with AI grading, AI assistant).

### Owner decisions applied (Nov 1, 2026)

The owner accepted the 17 recommended defaults and confirmed the plugin stays free for now. "Gated" means the feature is not implemented because the named external input is absent; it is not a claim that the feature works.

| # | Decision | Outcome | Status |
|---|---|---|---|
| 1 | PDF forms and OCR | Keep BYOK vision OCR and annotation-only PDF tools; no bundled OCR engine or PDF-form library. | Gated |
| 2 | Audio recording, transcription, TTS and pronunciation | Browser/OS speech recognition for card-answer text (editable transcript, no plugin recording); device speech voice only; no provider recording, transcription key or TTS. | Gated except card dictation |
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
| 14 | Keyboard-first practice | Minimal Space/Enter primary action plus Esc end; no 1/2/3 self-grade or U undo. | Shipped |
| 15 | Hold Course / uni-calendar interop | Read-only mapping is the only approved direction, but it is gated on one sample note from each plugin; ICS remains. | Gated |
| 16 | Qwen provider preset | **Qwen (DashScope)** is selectable with `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` and `qwen-plus`; model discovery and chat use the OpenAI-compatible endpoints. A live keyed request remains an owner validation step. | Shipped |
| 17 | Chemistry/biology/circuit rendering | Local `chem`, `biology`/`biosequence` and `circuit` blocks render in question content; original local code, no copied source, no simulator. | Shipped |
| — | Distribution and exam-content policy | Free with BYOK and optional donations; no bundled exam content; keep the import-rights warning. | Resolved |

Manual and release gates (real Obsidian visual/math/screenshots, real iOS/Android, AP FRQ calibration, live AnkiConnect/CouchDB, AI-quiz fact review and community-directory errors) are handled separately by the owner. No pass or accuracy claim is made until the owner reports a result.

### Other product questions (not part of the 17 defaults)
Items 3, 7 and 11 are resolved below; items 1, 2, 4, 5, 8, 9 and 10 remain open product questions and do not block the plugin's implemented code.
1. **Name and positioning:** Keep "MCQ Tracker" as the display name, or rename to reflect the full suite (while keeping the plugin ID)?
2. **SAT/AP content:** Will you provide original sample question packs? How should the plugin guide users who import official materials?
3. **Voice input — updated Nov 6, 2026:** card answers use the browser SpeechRecognition API when available, with OS keyboard dictation as a fallback; the plugin records nothing. In-plugin audio recording and provider transcription stay gated on provider and mobile audio validation.
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
6. **Qwen provider preset — resolved Nov 1, 2026:** shipped with the DashScope OpenAI-compatible endpoint and `qwen-plus`; model discovery and chat are covered by a mocked request test. A live keyed request remains an owner validation step.
7. **MIT plugin audit (mission step 8):** complete on Oct 30, 2026. §3.9.1 lists 28 MIT-verified related repositories with features this plugin lacks, ordered for step 9; 13 further candidates were non-permissive or unlicensed and stay ideas-only under §3.10. Remaining human decision: who signs off `NOTICES.md` attribution and the copied-file review before any code is reused. No code was copied in the audit.
8. **Study bundle import:** resolved in the working tree — export and import ship with the never-overwrite policy in §5.22.11.
9. **Per-note SM-2/Leitner choice and file-explorer due indicators (step-9 rows 3–4):** resolved in 1.139.0. A card may set `scheduler: ladder|sm2|fsrs`; the existing attempt path resolves it before deck/global choice. The opt-in `cards.fileExplorerDue` marker uses Obsidian's internal file-explorer view and silently does nothing when unavailable, so it is best-effort rather than a public-API guarantee.
10. **Live CouchDB verification (step-9 row 17):** the in-repo client, merge policy and manual commands are tested with mocked request URLs, but no real CouchDB server or network is available here. The owner should test against a CouchDB 3.x server, confirm database permissions and HTTPS, and run a two-device conflict/reconnect check. No credentials belong in the repository.
11. **Live AnkiConnect smoke test:** no Anki desktop or AnkiConnect endpoint is available in this build environment. The automated suite covers note building, push/update planning, backlinks, tables, media conflicts and failures with mocked requests. The owner should run [docs/anki-smoke-test.md](docs/anki-smoke-test.md) in a real Obsidian vault and Anki desktop, then record the AnkiConnect, Anki and Obsidian versions. No release should claim the real-UI path is verified until that pass is done.
12. **AI-generated Spaced Repetition quiz accuracy:** the 1.148.0 path validates the note syntactically by parsing it back through the existing importer and shows every card before writing, but factual accuracy still depends on the source note and provider. The owner should spot-check generated quizzes in a real vault; this is the same human review step as the other AI generators, not an unimplemented code path.
13. **Misconception diagnosis on a miss (§5.22.4 item 1):** recorded verbatim: “**Misconception diagnosis on a miss.** The mistake taxonomy already asks *why* a question was missed; a named-misconception field plus an automatic re-check question (Claude Tutor) would turn the error log into a feedback loop. Extends §5.9 and the existing error log, with no new storage.” It needs owner decisions the plan does not specify: the named-misconception list and copy, whether the re-check question is generated immediately or queued, which provider path and AI-off fallback apply, and whether misconception/re-check data is stored on question notes or in the existing history/error log with a durable re-target key. No code was added for item 1 in 1.153.0; item 3 shipped instead.

### Later decision items (Oct 30, 2026)

14. **Omniscient keyboard-first practice shortcuts — resolved Nov 1, 2026:** the minimal map is shipped in `src/practice-keys.js`: Space/Enter submits an armed question, reveals a study card or advances a finished result; Esc ends the session. Text fields and focused controls keep native keys. The full 1/2/3 self-grade and U undo map is rejected because MCQ auto-grades. Covered by 5 focused tests.
15. **Quizzable define-once/play-anywhere and partial-credit scoring — resolved Oct 31, 2026:** unique `quiz-definition` and `playable-quiz` blocks reuse a definition by `Id:` without changing Simple Quiz’s `quiz` block. Block-level `Partial: true` enables multi-select proportional credit with a configurable `Penalty:` (default 0.5, clamped 0–1); scores round to a whole percentage, exact selections score 100, and bands still use `Pass:`/`Imprecise:`. Covered by 2 focused tests; full suite 1065.
16. **Odd/even week parity for the Class Timetable term calendar — resolved Oct 31, 2026:** parity lives on the ICS VEVENT as `X-MCQ-WEEK-PARITY: odd` or `even`. When a semester start is set, `applyTermWeeks()` compares the occurrence's numbered term week; reading-week classes keep their existing marker, exams are never hidden, and the property is inert without a semester start. A moved `RECURRENCE-ID` occurrence inherits the series parity unless it declares its own, invalid values are ignored, and `.ics` export preserves the property. Covered by 3 focused tests (2 parser/override, 1 term filter); full suite 1034. Implemented in `src/calendar-ics.js` and covered by `tests/calendar.test.js`.
17. **A-Level Study Coach think-first timer — resolved Oct 31, 2026:** recorded verbatim: “a "think-first" timer that blocks sending to the assistant before a threshold.” Contract: `ai.thinkFirst` is off by default and `ai.thinkFirstSeconds` defaults to 15 seconds, clamped to 5–120 seconds. One countdown starts when a chat panel opens or **New chat** is pressed; it is not reset per message. `ChatPanel.send()` checks the gate before reading context, so Send, Ctrl/Cmd+Enter and quick prompts are all covered, and the shared panel applies the same gate to Direct API and OpenCode. There is no in-chat skip; the only bypass is turning the setting off. The countdown is local and is not persisted between chat sessions. The upstream “thinking credit” note and skip/Z-code flow were not added because the recorded plan requirement specifies only the blocking timer. Covered by 6 focused tests; full suite 1040. Implemented in `src/think-first.js` and covered by `tests/think-first.test.js`.
18. **Obsidian directory removal (Oct 30, 2026):** the plan records that the community-directory entry was removed, but the dashboard reason was never captured and cannot be read from this environment. Do not guess at it or resubmit blindly: open the developer dashboard error, fix it, and record the reason here. The related static-review points are the opt-in OpenCode download and runtime (a consent dialog and SHA-256 verification already exist) and the former dynamic `require(name)` wrapper, which now uses literal `require()` calls behind an allowlist.
19. **Authorship and similarity review (Oct 30, 2026):** much of the code was written with AI coding agents under human direction. The license documents carry no authorship or copyrightability caveat: that text was removed from `docs/license-audit.md` and `CONTRIBUTING.md` at the owner's request in `a7cc97d`, and `LICENSE` is plain MIT and was never modified. The remaining gate (O13) is that no similarity or licence scanner has been run against third-party code; the owner decides whether to run one and how to keep human design and review records before commercial distribution. No scan result is claimed.
20. **Commercial distribution and exam-content policy (Oct 30, 2026):** the plugin bundles no College Board content and an import is the user's own action, but a paid product that advertises importing question-bank PDFs and sending them to AI providers could invite a facilitating claim. The import example and README warning were tightened, but whether to charge, and what import policy to advertise if charging, is an owner and business decision, not a code decision.
21. **Unverified link dump (Oct 30, 2026):** a large set of links was supplied without a specific instruction. The Obsidian plugin candidates for a future step-8 licence pass are `ideaverse-maps`, `width-wizard`, `marginmuse`, `jelly`, `adaptive-practice`, `learnkit`, `free-ai-agents`, `task-hours`, `mathfolio`, `atomview`, `chemspec`, `chemrender`, `chem-search`, `chemedit-universal`, `chemedit`, `code-runner`, `anatomed`, `molren`, `gene-code`, `uncertainty-calc`, `sketch-mechanisms`, `ballistics`, `science-input-helper`, `chemtrails`, `pseudonymizer-tool`, `reverse-complement`, `tipa-support`, `ketcher`, `chemical-structure-renderer`, `periodic-table`, `chem`, `obsidian-circuitjs` and `biosequence`, plus the SAT repositories `imbooz1/sat-math-problem-solver`, `laurenlliu/sat-lesson-plan-generator`, `echa920/sat-math-lab`, `nakshatra30/SAT-PREP`, `Anas099X/OpenSAT` and `hummingbirdrhino-png/sat-trainer`. **Audited Oct 30, 2026 in §3.9.2:** 34 community-plugin listings (29 MIT, 5 NOT MIT), 21 direct repository links (7 MIT, 14 NOT MIT), the Knap repository (MIT), the OER-MCP dataset (no licence) and the non-repository links were classified there. At the time of that audit no code was copied; the local STEM renderers were added later (§5.16.2a).
22. **Link-audit unknowns (Oct 30, 2026):** §3.9.2 records the full pass. Three links remain unresolved: `https://pinesat.duckdns.org/api/questions` returns live SAT questions but publishes no licence or terms; the `swoopeagle/oer-mcp` Hugging Face dataset has no licence in its API metadata; `shouldiremoveit.com` and MakerWorld returned HTTP 403. Do not ingest or copy from these. The science-subject plugin cluster now has local `chem`, `biology`/`biosequence` and `circuit` renderers shipped; unlicensed sources remain ideas-only and no code was copied.

### Decision queue (Oct 31, 2026)

**Clean-install verification (Oct 31, 2026):** `npm ci --ignore-scripts` completed with 0 vulnerabilities, the full suite passed **1095/1095**, `npm run check` reported no dynamic code in **187 files** and `main.js` current, and `package.json` and `manifest.json` both report **1.166.0**. No version bump or release was made.

**Sweep result (Nov 1, 2026).** `plan.md` has **122 checked `[x]` task items, 10 `[~]` partial/blocked items and 0 unchecked `[ ]` task items** (the literal `[ ]` in historical prose is an example, not a task). The 10 partials are the three manual visual/device/screenshot checks, the five OCR/audio/pronunciation rows and the two AP FRQ calibration rows; each is gated in §3.9.6. The 17 recommended defaults are recorded above; the minimal keyboard map, the Qwen preset and the local chemistry/biology/circuit renderers are shipped. No bundled provider credential, OCR/PDF engine, OAuth, code execution, web lookup, bundled STEM library or paid tier is added. Qwen is a BYOK preset and the STEM renderers are original local code. No new version or release was made.

**Sweep result (Nov 9, 2026).** `plan.md` has **98 checked `[x]` roadmap rows, 3 `[~]` partial/blocked rows and 0 unchecked `[ ]` rows**. A further ~112 checked rows were release-log bullets at the top of the file; they now live in `docs/release-notes/` and `AGENTS.md` rather than being duplicated here. Four owner-decision rows closed on Nov 6, 2026 (TTS/audio, pronunciation, FRQ accuracy, pilot thresholds); the remaining three are the owner-manual visual, device and screenshot passes in [docs/plan-decisions.md](docs/plan-decisions.md). No implementation row is open: PDF→FRQ import shipped in §5.20.5. A Nov 7, 2026 pass corrected the stale diagnostics entry to ✅, shipped plan proposals/plan-then-act and general PDF attachments, recorded inline diff as ◐ and verified PDF passage Q&A in `src/reading-companion.js`; Miyo remains ⛔ because it needs an embedding model and index, and no ○ row remains.

**The approved local implementation batch is complete.** The local study modules and the Quizzable slice shipped. The remaining provider/credential/fixture/security rows are explicitly gated by the §11 decisions above or by owner manual checks; no wave approval is pending.

#### Implementation approvals

| ID | Item and current unknown | Options and consequences | Recommended default | Exact question |
|---|---|---|---|---|
| **D1** | **§3.9.1/§3.9.3 external rows — RESOLVED Nov 1, 2026.** The local sweep is complete; remaining rows are explicitly gated on providers, credentials, fixtures, hardware or product decisions, not on another local row. | No new external integration is approved by this decision. | — | — |
| **D2** | **Omniscient keyboard-first shortcuts — RESOLVED Nov 1, 2026.** The minimal map is shipped: Space/Enter activates the primary action (submit an armed question, reveal a study card, advance a finished result) and Esc ends the session. Text fields and focused controls keep native keys. The full upstream 1/2/3 self-grade and U undo map is rejected because MCQ auto-grades. | Implemented in `src/practice-keys.js` and `src/practice-view.js`; covered by 5 focused tests. | — | — |
| **D3** | **Quizzable define-once/play-anywhere and partial credit — resolved Oct 31, 2026.** Implemented with unique `quiz-definition`/`playable-quiz` names, no change to Simple Quiz's `quiz` block. Partial credit is opt-in with block-level `Partial: true`; the default wrong-pick penalty is `0.5`, configurable with `Penalty:` (0–1), and scores are rounded to a whole percentage. Exact selections still score 100; partial results carry `partialCredit` and a pass/imprecise/fail band. | Implemented and covered by 2 focused tests. | — | — |
| **D4** | **Misconception diagnosis — GATED Nov 1, 2026.** The existing error log and mistake taxonomy remain unchanged; no named list, re-check timing, provider fallback or storage field is invented. | Gated; no code change. | — | — |
| **D5** | **Hold Course / uni-calendar interop — RESOLVED Nov 6, 2026.** Stay on ICS. The owner supplied no sample note, so no read-only property mapping or guessed parser is added. | Option A. | — | — |
| **D6** | **Remaining import-format breadth — RESOLVED Nov 1, 2026.** Keep the generic QTI importer; unsupported Canvas/Blackboard rows are reported, not silently skipped. No named variant is added without fixtures. | Current generic importer remains. | — | — |

**Rows behind D1.** The remaining provider, credential, fixture and security rows are listed with exact gates in §3.9.6. The old W2/W3 labels are historical and gate nothing; no shipped row (Qard self-fitting, Pick Me PDF indexing, OS notifications, Feynman AI feedback or the Retain migration) appears among them.

#### Product and business decisions

| ID | Item and current unknown | Options and consequences | Recommended default | Exact question |
|---|---|---|---|---|
| **O1** | **Name and positioning — RESOLVED Nov 6, 2026.** Keep "MCQ Tracker" and the plugin ID; the description carries the suite breadth. | Option A. | — | — |
| **O2** | **SAT/AP sample content — RESOLVED Nov 6, 2026.** No bundled AP/SAT content; keep link-only guidance and the import-rights warning. | Option A. | — | — |
| **O3** | **Voice input — updated Nov 6, 2026.** Browser/OS speech recognition fills an editable card-answer box; no plugin recording or provider transcription key. | Option A. | — | — |
| **O4** | **Agent on mobile — RESOLVED Nov 6, 2026.** Tutor-only on phones; the full OpenCode agent stays desktop-only. | Option A. | — | — |
| **O5** | **FRQ on mobile — RESOLVED Nov 6, 2026.** Phones accept typed or dictated answer text; no mobile-specific rubric redesign. | Typed or dictated text. | — | — |
| **O6** | **Monetization model — RESOLVED Nov 1, 2026.** Free with BYOK and optional donations; no paid tier, managed AI or paid gate in the plugin. | Option A. | — | — |
| **O7** | **Monetization timing — RESOLVED Nov 1, 2026.** No paid experiment; revisit only after a validated standalone or hosted service exists. | Option A. | — | — |
| **O8** | **Commercial distribution and exam-content policy — RESOLVED Nov 1, 2026.** No charge and no bundled exam content; keep the import-rights warning. | Option A. | — | — |
| **O9** | **Compatibility promise — RESOLVED Nov 6, 2026.** Existing note formats keep working indefinitely, with explicit migrations when a format must change. | Option A. | — | — |
| **O10** | **Beta channel — RESOLVED Nov 6, 2026.** Stable releases only; no BRAT beta track. | Option B. | — | — |
| **O11** | **Standalone mobile trigger — RESOLVED Nov 6, 2026.** No standalone app until a measured demand/retention signal exists; a PWA test remains the cheaper first step. | Option A. | — | — |
| **O12** | **MIT audit sign-off — RESOLVED Nov 6, 2026.** The agent drafts each NOTICES.md entry and copied-file review; the owner reviews the batch before release. | Agent drafts; owner reviews batches. | — | — |
| **O13** | **Authorship and similarity review — LOCAL SCAN RUN Nov 6, 2026.** `jscpd` (100-token minimum) found 32 internal clones, 426 duplicated lines, 0.62% of 291 files; `license-checker` reports one UNLICENSED package (the project root), while vendored pdf-lib and PDF++ are MIT. No external-code corpus or hosted similarity service was available, so no external-copying result is claimed. The gate stays recorded for commercial distribution. | Local scan run; limit recorded. | — | — |
| **O14** | **Unverified links and licences — RESOLVED Nov 1, 2026.** Audit only named candidates before any code or dataset is used; unresolved links stay ideas-only. | Option A. | — | — |

#### External and verification gates

| ID | Item and current unknown | Options and consequences | Recommended default | Exact question |
|---|---|---|---|---|
| **E1** | **Real Obsidian visual, math/chemistry/STEM and screenshot pass — OWNER MANUAL GATE (Nov 1, 2026).** No visual or screenshot claim is made until the owner supplies results. | Owner handles separately. | — | — |
| **E2** | **Real iOS/Android mobile audit — OWNER MANUAL GATE (Nov 1, 2026).** No hardware or mobile-path claim is made until the owner supplies results. | Owner handles separately. | — | — |
| **E3** | **Bundled OCR engine — RESOLVED Nov 1, 2026.** Keep the opt-in BYOK vision path and state that no bundled OCR engine exists; image-only offline scans remain unsupported. | Option B. | — | — |
| **E4** | **PDF form filling and full editor — REVERSED BY THE OWNER Nov 4, 2026.** The owner asked for a working editor and allowed MIT libraries; 1.218.0 ships page operations, content editing (typed text, vault images, page numbers, cropping, watermarks, document properties), splitting, and AcroForm filling plus authoring and annotation flattening on the vendored pdf-lib 1.17.1, all reversible through a bounded byte-level undo/redo history. XFA forms and rewording existing page text stay out of scope. | Option A (owner direction). | — | — |
| **E5** | **TTS, audio commute and pronunciation — RESOLVED Nov 6, 2026.** Device speech only; provider TTS, commute playback and pronunciation scoring are declined. | Option A. | — | — |
| **E6** | **AP FRQ accuracy — RESOLVED Nov 6, 2026.** No accuracy claim and no numeric pilot threshold; the grader stays labelled an aid. | Option A. | — | — |
| **E7** | **Live CouchDB verification — OWNER MANUAL GATE (Nov 1, 2026).** Keep sync labelled unverified until a CouchDB 3.x two-device conflict and reconnect test is recorded. | Owner handles separately. | — | — |
| **E8** | **Live AnkiConnect smoke test — OWNER MANUAL GATE (Nov 1, 2026).** Keep the real-UI path unverified until the owner runs `docs/anki-smoke-test.md` and records versions. | Owner handles separately. | — | — |
| **E9** | **Qwen provider preset — IMPLEMENTED Nov 1, 2026 (shipped).** DashScope’s OpenAI-compatible preset is selectable with `qwen-plus`; a live keyed request remains an owner validation step. | Option A. | — | — |
| **E10** | **AI-generated quiz accuracy — GATED Nov 1, 2026.** Keep the preview and label generated quizzes as needing review; no human spot-check is claimed. | Option B. | — | — |
| **E11** | **Community directory relisting — RESOLVED Nov 6, 2026.** The listing stays absent until the owner supplies the dashboard review errors; no blind resubmission. | Option B. | — | — |

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
- **Has that you don't:** many questions per file (Quick add covers lighter authoring), keyboard-first flow (minimal map shipped; full 1/2/3/U map rejected), and a one-sentence pitch. Per-question hints ship here in 1.156.0 and the mastered-pass exam-ready badge in 1.157.0.
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
| Mind map / visualize / summary views | ✅ (`study-map` block and local summary, shipped; no Visualize canvas) | ✅ | ❌ | ❌ | ❌ | ❌ |
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

### 5.26 Installed-plugin parity audit — Nov 4, 2026, re-checked at 1.277.0

The owner supplied 23 installed plugins. All pages were checked; three supplied
ids did not resolve (Advanced Tables is `table-editor-obsidian`, Hider
`obsidian-hider`, Markmind `obsidian-markmind`), and Folder Sty1es, pdf-to-md,
Text Block Timer and WordNet Dictionary are in the registry while Tally Counter
by "Custom" is not. The maintained matrix — URL, licence and the test behind
every covered row — is [docs/installed-plugin-parity.md](docs/installed-plugin-parity.md);
release-by-release detail is in `docs/release-notes/`.

**Status at 1.277.0:** all 23 rows are Covered, Boundary, Boundary/Covered,
This plugin or Added. No Partial or Uncovered row remains. The work closed in
1.232.0–1.264.0 (Tally and text-timer blocks, the local WordNet import, and
Advanced Tables to upstream 0.23.2 parity: cell editing and navigation,
structure, formatting, formulas, CSV/TSV, sorting, merged cells and
source-editor keys) and in 1.269.0–1.273.0 (PDF++ deep links, Markmind,
pdf-to-md, Annotator/EPUB and Importer service exports).

**Covered versus boundary.** Covered rows are implemented locally with tests.
Boundary rows keep their written reason: Code Runner stays behind the §11
execution gate; Copilot (AGPL-3.0) and Desmos (GPL-3.0) are not copied; Folder
Sty1es, Hider, Minimal Theme Settings, Notebook Navigator and Recent Files are
UI/theme/navigation surfaces, not study modules. "All features" of those plugins
is therefore not claimed.

**Owner decisions (Nov 4, 2026):** Code Runner deferred behind the execution
gate; full Advanced Tables parity approved and since shipped; none of the
UI/theme/navigation plugins adopted; local alternatives kept for Copilot, Desmos
and Excalidraw; WordNet imported locally in full rather than as a bundled subset.

### 5.27 Grill concept record — Nov 7, 2026, v1.285.0

**Source:** [theadamdanielsson/grill](https://github.com/theadamdanielsson/grill), MIT, pinned at commit
`6dd05d884f8f9d77e684d6c814e160aaa5d2ea83` (8.7.12). Grill's distinctive idea is a persistent
per-concept learning record: concepts extracted from a note, coverage and mastery over time,
a misconception registry, and a compact learner digest the tutor reads at the start of a chat.
MCQ Tracker already had question-level FSRS, note-level mastery, an error log and an Insights
Concepts tab, but the tab grouped practice by source note; it did not name the ideas inside a note
or carry a misconception across notes.

**What shipped (UI is ours):**

- `src/knowledge-record.js` — deterministic concept extraction adapted from Grill's
  `generate-local.ts`: headings, bold terms, definition lines, display formulas and authored
  cards, with generic headings, code, tables and link-only lines skipped. Stable structural
  anchors and label aliases keep a renamed heading's identity and linked evidence; source
  hashes reopen changed content, removed concepts stay as orphans. Coverage uses Grill's
  8-concept target and 80% known band.
- `src/knowledge-store.js` — opt-in local `MCQ Tracker/knowledge-record.json` index. It is
  rebuildable and holds no study data that is not already in notes or question history.
- **Source edits and removals:** a renamed heading keeps its id, records the old label as an
  alias and keeps linked questions attached. Each note entry also carries a stable `noteId`
  (the hash of the path it was first indexed at), a bounded `pathAliases` list and a
  `contentHash`. Moving or renaming the note file moves the same entry — never a new one — and
  the old path becomes an alias, so concept ids, `firstSeen`, attempt evidence and misconception
  state survive. A note deleted and recreated at a new path is matched back by content hash. A
  source note that is genuinely deleted is retained with `missingAt` and surfaced as
  "source missing" instead of being dropped, and restoring it re-links the same entry.
- **Vault events (production paths):** `handleKnowledgeRecordRename`, `handleKnowledgeRecordDelete`
  and `handleKnowledgeRecordCreate` are registered in `startDeferredStartup` on the vault's
  `rename`, `delete`, `create` and `modify` events; a folder move re-keys every entry under the
  folder. `scheduleKnowledgeRecordRefresh` coalesces per-note updates on a 600 ms debounce and
  `flushKnowledgeRecordRefresh` applies them through `refreshKnowledgeRecordSource`, which
  rebuilds one entry and never rescans the vault. `scheduleKnowledgeRecordRebuild` /
  `flushKnowledgeRecordRebuild` cover a bulk restore; `rebuildKnowledgeRecord` is still the
  full-rebuild path behind the command and Insights.
- **Projection, not a second scheduler:** each concept's counters, due date, last miss and error
  tags are rolled up from the questions with the matching `source_note` and `source_heading`.
  `next_review` remains question-level; the record never invents a parallel FSRS state.
- **Insights → Concepts:** a Knowledge record card above the existing concept-mastery list with
  notes/concepts/known/due totals, coverage by note, open/fixed misconceptions, concepts to
  revisit, Rebuild and Copy learner digest. It uses the existing `qt-ins-*` list and meter classes.
- **Study agent:** an opt-in `Knowledge record` study-context toggle adds a bounded (~3,000
  character) digest of concept evidence, open misconceptions and due concepts. It is off by
  default and names only concept labels, counts and short last-miss text.
- **Commands:** Open the knowledge record, Rebuild from notes, Copy learner digest.
- **Recording:** after an attempt on a linked question, only that source note's entry is rebuilt
  and saved on a short debounce; no vault-wide rescan.

**Grill features intentionally not copied:** its theme, home/chat/test-session UI, agentic
Safe/Plan/Auto chat loop, question-generation formats, embedded PDF quizzes, knowledge graph,
Excalidraw tests, TTS, semantic embedding index, MCP servers/web search, Grill Cloud and
`grill-mcp`. MCQ Tracker already has its own chat, test, card, PDF and generation paths; the
external services are boundary-only. Per-concept FSRS is represented as a projection of the
existing question schedule rather than a competing schedule. This is a focused incorporation of
Grill's record idea, not a claim of line-for-line parity with all 29k lines of Grill.

**1.292.0 adds a local note surface:** a `grill` block extracts headings, definition lines
and bold terms, then runs a deterministic self-graded recall session. It uses no Grill code,
AI call, embedding index or external service; the reader can rerun the block for a fresh
session. This is a companion to the concept record, not a copy of Grill's chat/test UI.

**Verified end to end (1.285.0):** `tests/knowledge-record-scenario.test.js` loads a real
source note and linked questions through `QuestionTrackerPlugin`, enables the record and writes
the JSON at `MCQ Tracker/knowledge-record.json`. It drives two correct answers and a miss through
`recordAttempt`, tags the miss and checks coverage/known/due and the open misconception, then a
correct response closes it. A heading rename keeps the id and attempts. The scenario then calls
the real vault handlers, because `startDeferredStartup` registers the record's
`rename`/`delete`/`create` listeners the same way Obsidian does:

- **note move** — the file moves to `Courses/Biology.md` and the vault fires `rename`; one linked
  question is rewritten to the new path and one is left on the old path on purpose. The entry
  moves with its `noteId`, the old path becomes a `pathAliases` entry, concept ids,
  `firstSeen`, attempt counts and the fixed misconception are unchanged, no old-path key exists,
  and the Insights card shows the moved note without `source missing`.
- **practice after the move** — an attempt through the question that still names the old path
  updates the moved entry in place (no stale copy), reopens the misconception and a correct
  answer fixes it again.
- **note rename** — the file is renamed again and the vault fires `rename`; ids, aliases and
  evidence are unchanged, and two full rebuilds produce byte-identical content.
- **delete** — the vault fires `delete`; the entry is retained with `missingAt`, the row reads
  `source missing`, the digest and Study-agent context mark it missing, and a rebuild keeps it.
- **delete then recreate at a new path** — `create` at `Archive/Biology 101.md` relinks the same
  `noteId` and concept ids by content hash, clears `missingAt`, keeps every alias and does not
  double any attempt count.
- **restore** — delete and recreate at the same path relinks again; repeated full rebuilds stay
  idempotent and a fresh plugin instance loads the same record.

The scenario also renders Insights → Concepts, clicks **Rebuild record** and **Copy learner
digest**, checks the ~3,000-character digest bound, and proves the Study-agent context is absent
while the toggle is off. It exposed and fixed two defects: `normalizeRecord` wrote `missingAt`
as an empty string (so a reloaded record differed from the live one) and the incremental path
needed alias and content matching so an attempt naming the old path could not resurrect it.

**Tests:** `tests/knowledge-record.test.js` covers extraction and generic-heading skips, stable
ids/source hashes, reconciliation/orphans, question-history projection, coverage, misconceptions,
digest bounds and malformed saved data; the scenario above drives the integrated path. Full suite:
**2,379 pass, 0 fail**.

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

Full Calendar local event notes are read when a folder is configured (shipped). Hold Course and
uni-calendar note properties are read-only interop candidates gated on one sample note from each. Testing on real iOS and Android devices remains
blocked.
