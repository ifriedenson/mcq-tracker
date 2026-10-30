# MCQ Tracker

Serve practice questions from your own notes, grade your answers, and keep a full study record in each note's properties: time, confidence, mistake type, streak and the next review date. It works on desktop and mobile, and the AI tutor is optional and off by default.

## Features

- **Exam-style practice screen.** The passage sits on the left, and the question, answer choices, confidence buttons and Submit sit on the right. On narrow screens the passage stacks above the question.
- **Automatic grading** for multiple-choice and student-produced-response questions, or self-grading when a note has no answer key.
- **Timer** with pause. It survives closing the app, and on mobile it can pause itself when you switch apps.
- **Review after answering.** See the question and choices again with your pick and the correct answer marked, plus an explanation you can show or hide (the default is a setting).
- **Spaced review.** Correct answers come back after 1, 3, 7, 21, then 60 days (editable). Misses come back tomorrow.
- **Known, Bury, Suspend and Exclude.** Hide a question or card for a configurable snooze, until tomorrow, until you restore it, or from every queue without deleting the note. Every action is undoable, and **Manage hidden study items** lists, searches, filters and restores them.
- **Exam-aware review.** When the calendar is on and an upcoming exam matches a question's or card's course, the next review is brought forward to the day before the exam. It never extends an interval, and items without a matching course or exam are unchanged.
- **Optional CouchDB review-state sync.** Turn it on under Settings, Cards, Sync and run a manual sync to keep due dates, attempts and review history aligned across devices. Only review properties are sent; card text stays in the vault. When two devices disagree, the newest review decides the schedule while both histories are kept. Off by default.
- **Optional FSRS scheduling.** Turn on a memory-model scheduler in settings. It estimates difficulty and stability per question, aims for your chosen recall probability, and replays existing history once so you do not start from zero. The simple 1/3/7/21/60-day ladder remains the default and switching back is lossless.
- **Per-deck scheduler choice and timing (optional).** Under Settings, Cards, Decks, a deck can keep the global scheduler or choose the simple ladder, the clean-room SM-2 scheduler, or FSRS. That deck can also set its own ladder intervals, FSRS retention, or SM-2 starting ease, first Easy interval, Hard multiplier and Easy bonus. Decks without an override behave exactly as before, and switching a deck preserves the other scheduler's saved state in the note, so migration is gradual.
- **Offline-tolerant results.** If a note cannot be written for a moment (a sync lock, a removable drive, or a mobile storage hiccup), the attempt is kept in a local outbox. The result screen still works, error tags stay attached, and the queue is retried on startup, when the device comes back online, and with **Retry saving offline practice results**.
- **Mistake tracking.** After a miss, tag why (careless, content gap, misread, ran out of time, guessed, or your own labels).
- **Flexible filters.** Filter by folder (including all its sub folders), course, test, section, domain, skill, unit and difficulty, for example folder + skill + difficulty together. You can pick several values in one field (OR), and add extra filter sets that are combined with OR. Save any combination as a **preset**.
- **Counts and folder search.** Every filter button shows how many notes it holds. The Folder filter switches to a type-ahead search box when you have many folders (or whenever you choose), and the choice is a setting.
- **Weak spots.** Accuracy and average time by skill, domain, difficulty and folder, a bar chart of your accuracy by week, an up or down note on each row when your last two weeks differ from before, and a **Practice my weakest skill** button plus a Practice button on every row.
- **Error log.** Questions you missed, grouped by the reason you gave, with a button to practice each group.
- **Analytics dashboard.** Insights → Overview collects attempts and accuracy, logged skips and their per-skill rate, confidence calibration, a review-retention trend, a practice-derived grade snapshot, skill/domain/difficulty breakdowns, a 12-week study heatmap, study time by course, your weakest skills with one-tap practice, cards due, and the next exam plan. All of it is calculated locally.
- **Dashboard widgets in notes.** Put a `mcq-dashboard` block in any note to embed one metric or the whole dashboard, optionally scoped to a course.
- **Timed test.** Build a test from one or more timed sections, optionally save the recipe as a blueprint, restrict the bank to a range such as 1–20, choose how many FRQ prompts to include alongside multiple-choice and short-answer items, shuffle each multiple-choice question's answer choices, and set an optional pass mark. FRQ responses count toward each section's items, are written in the test, and are graded afterward through the existing FRQ grader with the answer prefilled. Answer with a countdown and no explanations, mark how sure you were, then see your objective score, a confidence-calibration summary, average time per answered item, a by-section and by-skill breakdown, and a full review. Each section has its own timer, and the number bar only shows the current section. A shuffled order survives a reopened test, and the pass mark is reported against objective questions. If you close Obsidian mid-test, it picks the test back up when you reopen it (and marks it if the time ran out meanwhile).
- **Practice from your files.** Right-click any folder that holds questions and choose **Practice this folder**, or use the commands. Find any question by its official ID.
- **Pick modes:** smart weighted mix, adaptive difficulty, due for review, never attempted, missed, flagged, or pure random. Adaptive difficulty favors questions near the learner's current level based on past accuracy and streaks.
- **Quick Practice:** start a 2, 5, or 10 minute session, or a 5, 10, or 20 question session, using your current filters. It saves the queue so you can resume after closing Obsidian. An optional adaptive length warms up or stretches the session from recent accuracy, pace and logged skips, always shows its recommendation, lets you override it, and stays inside configured hard caps.
- **Exam coverage.** Add a **Total topics** count to a course in Settings, Calendar, Courses. The next-exam study plan counts a topic as mastered only when every question in that `skill` is fully mastered, and Today/Insights show `mastered / declared topics (%)`. A count of 0 hides it, and readiness, due counts and scheduling are unchanged.
- **Daily quiz (optional, off by default).** Get a small set of questions once a day from the folders you choose, with a separate completion streak and best streak. It uses the same queue and scheduler, stays on your device, and sends no notifications. When adaptive length is on, its count uses the same recent-recall signal. Start it from Settings, MCQ Tracker, Daily quiz, Today, or the command palette. An optional **Streak freeze** earns one freeze every five completions (configurable, maximum three) and automatically covers a missed day when you finish the next quiz, so one gap does not erase the streak.
- **Study cards (optional, off by default).** Review the same MCQ notes as flip cards or choice cards, or switch the session to Learn, Test or Match, using your current filters and the same scheduler. No duplicate notes or second deck.
- **Today:** a phone-sized start screen with due and new counts, the next class or exam, and one **Start 5 minutes** button that opens Quick Practice. When both modules have due work, **Start mixed review** runs one interleaved session.
- **CSV results export.** Export a summary row per question or card plus a row per stored attempt, with course, skill, difficulty, accuracy, timing, review dates, error type and history. The files are plain CSVs written to the vault root for outside analysis.
- **Answer-free practice sheet.** Export the current question filter as a printable Markdown sheet with the stimulus, question, choices or matching prompts and blank answer lines. The answer key, rationale, source notes and frontmatter are deliberately omitted, and question state is never changed. The file is written to the vault root as `mcq-practice-sheet-YYYY-MM-DD.md`.
- **Source links.** Imported questions keep the source document path and, for PDFs, the page. Extracted cards keep the lecture or source note. A miss shows a **Reread this** button that opens the exact source page; cards show a **Reread source** button after the answer. A card can also anchor a recall to selected source text; after revealing it, **Review in context** opens the source with that passage selected.
- **Lecture and transcript to practice.** A note from Whisper, Audio to Text, Local Whisper, Lecture Transcriber or a similar tool is recognized by its transcript properties, headings, filename or timestamped lines. **Generate practice from this lecture** drafts flashcards or multiple-choice questions, shows a preview, and writes only what you approve. Without AI it can extract cards from headings, definitions, tables and cloze marks already in the note.
- **Notes box** on the result screen, saved into the note.
- **PDF annotations.** Add a highlighted quote, text box, form note or page note to any PDF in the vault. Each PDF gets a readable Markdown sidecar beside it, keyed by a content hash so a replaced file is noticed; the visual pen/highlighter, highlight-region and text-box overlay saves page-normalized edits in the same sidecar.
- **Import questions from a file:** an AI agent (or your own AI key) turns a PDF, PowerPoint deck, Word file, OpenDocument, HTML, RTF, Markdown, CSV or text file into properly formatted question notes in a new folder, and labels any answer it had to write itself with the model and date (see [Import questions from your files](#import-questions-from-your-files)).
- **OCR a scanned PDF (optional).** The command **OCR a scanned PDF** renders the pages locally, asks for explicit consent, and sends only the chosen page images to your Direct AI provider. The returned text is editable page by page and is saved as a normal Markdown OCR note with the source PDF, model and date. It is off by default, does not use OpenCode, and can misread faint text and handwriting, so review the text before studying.
- **Document review and routing.** The command **Review a document for import** reads a PDF, slide deck, Word file or text document locally, shows whether it looks like multiple choice, free response, flashcards or course notes, lists the evidence and lets you override the result. It then opens the existing question importer or course-notes importer with the same file selected. Image-only scans stop with an OCR message rather than guessing. No text is uploaded by the review step.
- **Paper scanner (photos to PDF).** The command **Paper scanner: photos to PDF** opens a dialog where you can choose photos or take them with the rear camera, rotate each page, drag a crop rectangle, reorder or remove pages, and save one PDF in the vault (`Paper scans` by default). Image conversion, cropping and PDF assembly run locally with no upload. OCR and automatic item classification are not part of this phase; import the resulting PDF with the course-notes or question importer when it has a text layer.
- **Import course notes:** the command **Import course notes from a lecture or chapter** turns a PDF, slide deck, Word document or text file into one readable Markdown study note, with headings for each page or slide and links back to the source. Text extraction and source links run locally, and the source file is kept in a `sources` folder; PDF figures can be copied beside the note. An optional AI summary and key-terms section uses your configured provider and is off by default; handwritten marks are not interpreted.
- **Optional AI tutor** through your own API key, or a local OpenCode agent (desktop) (see [AI assistant](#ai-assistant-optional-and-off-by-default)). Direct AI agent mode is allow-listed: it can propose a new question, a new card or one safe body-section edit, and nothing is written until you review and apply it.
- **Cards and vocabulary (optional module, off by default).** Create flashcards, reversed cards, cloze cards, image occlusion cards and vocabulary notes as ordinary Markdown notes. Import Quizlet text exports or PDF test banks from the vault or directly from your device, organize cards into decks, inherit a course tag from a deck or folder, and review them with Again/Hard/Good/Easy using the same ladder or FSRS schedule as your questions. Export any filtered deck as Quizlet text, Anki text, an Anki `.apkg` package, a Mochi `.mochi` file, a LearnKit note or a quiz CSV (see [Cards and vocabulary](#cards-and-vocabulary-optional-module-off-by-default)).
- **Study plan and cram mode.** When the calendar has an upcoming exam, Today builds a plan for matching courses: days left, readiness, due/new counts, card backlog and the weakest skill. **Start 10 min** practices the plan; **Cram 10 min** puts most-missed questions first and skips long-interval reviews unless an item was missed.
- **Optional local reminder.** Off by default, a quiet Today card and status-bar nudge appear once a day after the hour you choose. Dismiss it until tomorrow; it never sends an OS notification or a network request.
- **Focus timer and study log.** Start a 15, 25 or 45 minute session tied to a course, pause and resume it, and log the result. Manual study entry covers offline work. Today shows today's minutes against a configurable daily goal, the current streak, the last seven days and your top courses.
- **First-run welcome guide.** A short three-step guide on first install: what the plugin does, a preset chooser that sets the real module switches, and buttons for import, practice, Today, cards, calendar and settings. It is shown once per device, never blocks startup, stores progress locally and can be reopened from the command palette or Settings, Global, About.
- **Modules you can switch off.** Settings, Global has an on/off switch for each module (MCQ Tracker, Cards, Calendar and AI features) plus the plugin-wide options, so the parts you don't use stay out of the way.
- **Reference (optional module, off by default).** A local formula sheet, constants list, one-screen reference sheets (unit circle, trig identities, codon table and Punnett square), unit converter, Basic/Scientific calculator, unofficial AP score estimator with saved practice-exam history, and link-only AP resource hub with saved resource notes in one view. It works offline, adds no data to your vault, and can be hidden automatically while a timed test is running. See [Reference](#reference-optional-module-off-by-default).
- **Calendar (optional module, off by default).** Import an `.ics` schedule from a file or a public feed, see classes and exams in a month grid, day timeline, live countdown and upcoming-exam countdowns, and create a note for a class in one click. Free periods can start a short Quick Practice session (see [Calendar](#calendar-optional-module-off-by-default)).
- **Assignments and grades.** Keep assignments as ordinary notes with a course, type, due date, status and score. The gradebook shows weighted category grades, the score you need on the final, a credit-weighted GPA and the next tasks; Today adds a **Review N due items** task beside the nearest deadlines (see [Assignments, tasks and grades](#assignments-tasks-and-grades)).

## Quick start

1. Install the plugin and enable it (see below).
2. Open the practice view from the ribbon (graduation cap icon). With no questions in your vault yet, it offers **Import files**.
3. Press **Import files**. The first time, you'll choose how to connect an AI model (your own API key, or OpenCode on desktop), then pick a file and a new folder name. See [Import questions from your files](#import-questions-from-your-files).
4. When the import finishes, press **Practice all** to start. Already have question notes? Add a `question_id` property to each (see [What counts as a question](#what-counts-as-a-question)) and the practice view finds them.

## Study plan and cram mode

The **Study plan** card appears in Today when the calendar is on and an upcoming exam matches question or card courses. It shows the exam countdown, readiness score, due and new questions, cards due, practice coverage, accuracy and weakest skill. **Start 10 min** opens Quick Practice with the exam-scoped pool; **Cram 10 min** orders the most-missed and due items first and omits long-interval reviews that have not been missed.

The plan is recalculated every time Today renders, so a missed day does not leave a stale checklist. It uses the existing scheduler and queue; there is no second review system.

The **Today** view also shows **Question mastery** for the Progress tab's saved scope and All time / 7-day / 30-day window. Its scope picker and window chips can change that saved choice without opening Insights, and **Open progress** goes to the full dashboard. Each non-empty band has a **Practice** button that starts exactly those questions, and Quick Practice names the band and window in its header. A trend line compares the mastered count with the previous period of the same length (or the previous 7 days for All time), and says when there are no earlier attempts to compare. The Progress tab shows the same line, and dashboard embeds put a compact ↑/↓/→ badge in the mastery heading.

## Analytics dashboard

Open **Insights** and choose **Overview** (or run the **Open analytics dashboard** command). The dashboard combines:

- attempts, questions tried and accuracy, with average time per question;
- a 12-week heatmap where a day grows with focus-session minutes and question attempts;
- accuracy at each confidence level, so guessing and confident answers are compared directly;
- a review-retention trend built from repeat attempts, excluding each question's first try;
- today's study minutes, the current streak, and total logged study time by course;
- the five weakest skills, each with a **Practice** button;
- cards due and new, plus the next exam plan and its readiness evidence when the calendar module is on.

The heatmap and totals come from note properties and your local study log. No analytics service, chart library or network request is involved.

### Dashboard widgets

Put a `mcq-dashboard` block in any note:

````markdown
```mcq-dashboard
metric: heatmap
weeks: 8
course: Biology
title: Biology activity
```
````

`metric` can be `overview`, `stats`, `mastery`, `heatmap`, `calibration`, `retention`, `weak`, `grades`, `courses` or `exam`. `mastery` shows the Progress tab's selected All time / 7-day / 30-day window, and a `course` value in the block overrides the saved mastery scope. Add `masteryDays: 0`, `7` or `30` to choose a different window for that block; invalid values fall back to the saved window. Every non-empty band has a **Practice** button that starts exactly that band's questions. `field: domain` or `field: difficulty` changes the breakdown used by the `weak` and overview widgets. `weeks` is clamped to 1–26. `course` filters questions, cards and study sessions by the course property, and `title` overrides the heading. The block has a **Refresh** button and is read-only except for the **Practice** buttons on weak skills and mastery bands.

## Focus timer and study log

Open **Today** and use the **Focus** card to start a 15, 25 or 45 minute session. The timer is derived from timestamps, so pausing, closing Obsidian or switching devices does not lose the elapsed time; the running state is stored locally per device. Finishing writes a study session into the plugin's study log, and **Log study time** adds offline study manually with a date, minutes, course and note.

Set the daily goal under **Settings, Global, General**. Study totals and streaks are local, and practice time already recorded on individual questions remains separate.

## Welcome guide

On a fresh install, **MCQ Tracker** opens a welcome guide after the workspace is ready. Choose a preset such as **SAT / AP-style prep**, **University courses**, **Language learning**, **STEM problem sets**, **Just flashcards** or **Everything off**; the result is written to the ordinary module switches, so Settings, Global, Modules shows the same state. A module that is off keeps its notes, cards, schedules and settings.

The how-to section has working buttons for importing questions, opening practice, opening Today, creating a card, opening the calendar and opening settings. It also records optional step checks on this device only. Reopen it any time with **Open welcome guide**, or from **Settings, Global, About**. Optional feedback and donation links can be configured under **Settings, Global, About**; the feedback link defaults to GitHub issues, the donation link is hidden until you add a funding page, and nothing opens or is submitted unless you click. Settings, About also has an optional survey that copies a Markdown summary to the clipboard; it sends nothing. No network request is made by the welcome screen itself.

## Sample vault

If you want to try the plugin before writing notes, open [samples/README.md](samples/README.md) and copy `samples/sample-vault/` into Obsidian. It contains four original questions and one flashcard, uses the normal property format, and includes no question-bank content.

## Install

**With BRAT:** install the BRAT plugin, choose Add beta plugin, and enter `ifriedenson/mcq-tracker`. BRAT installs the latest release and keeps it updated.

**From the community directory** (once the plugin is listed): open Settings, Community plugins, Browse, search for "MCQ Tracker", then Install and Enable.

**Manually:** download `main.js`, `manifest.json` and `styles.css` from the latest release and copy them into `<your vault>/.obsidian/plugins/mcq-tracker/`. Then enable the plugin under Settings, Community plugins.

## What counts as a question

Any note with a `question_id` property (you can limit this to one folder in settings). A note looks like this:

```markdown
---
question_id: SAT-RW-0001
test: SAT
section: Reading and Writing
domain: Craft and Structure
skill: Cross-Text Connections
difficulty: medium
question_type: mcq
answer: B
target_seconds: 90
---

## Stimulus
> The passage or source text goes here.

## Question
Which choice best describes the relationship between the two texts?

## Answer Choices
- A. First choice
- B. Second choice
- C. Third choice
- D. Fourth choice

## Answer
> [!answer]- Reveal answer
> **Correct Answer: B**
>
> The explanation goes here.

## My Notes
```

- `## Stimulus` is optional. If a note has none but has a `stimulus_id`, the plugin borrows the passage from another note with the same `stimulus_id`.
- The answer key is read from the `answer` property, or from a line like `Correct Answer: B` in the `## Answer` section.
- `question_type` can be `mcq`, `spr` (student-produced response), `true_false`, `select_all`, `fill_in`, `matching`, or anything else for self-grading. Aliases such as `tf`, `sata` and `select-all-that-apply` are understood, and so is free text such as "Multiple choice (4 choices)".
- Properties the plugin reads: `course, test, section, domain, skill, unit, difficulty, question_type, choices, answer, tolerance, tolerance_type, sig_figs, sig_figs_mode, units, answer_unit, accepted_answers, accepted_variants, variables, answer_formula, variant_seed, target_seconds, stimulus_id`.
- Properties the plugin writes: `result, date attempted, first_attempted, attempts, correct_count, streak, time_spent_total, last_time_spent, last_answer, last_confidence, last_error_type, flagged, needs_fixing, needs_fixing_since, needs_fixing_miss_days, needs_fixing_fixed_on, next_review, last_attempt_id, srs, sm2, scheduler, history`, plus the Known/Exclude fields `study_status, known_days, known_until, excluded_on, excluded_reason` when you use those actions, and `variant_seed` and `last_variant` after a parameterized attempt. `srs` and `scheduler` are populated when FSRS schedules a review, and `sm2` and `scheduler` when a deck uses SM-2 (`srs` may be empty if you add tracking properties to notes first). The needs-fixing fields appear only when that opt-in feature marks a question for repair; Mark fixed removes the flag and records the repair date.

### Numeric answers (SPR)

Set `question_type: spr` and the plugin grades numbers instead of comparing text. These forms are equivalent: `3/4`, `0.75`, `7.5e-1`, `7.5 × 10⁻¹` and `75%`. Each result explains how the answer was read, such as `Read as 7.5 × 10⁻¹ m/s`.

```yaml
question_type: spr
answer: 1000 m
tolerance: 0.05
tolerance_type: relative
sig_figs: 2
units: m
accepted_answers:
  - 1 km
```

- `tolerance` is off by default. `tolerance_type` is `absolute` (default), `relative` (a fraction of the expected value) or `percent`.
- `sig_figs` checks the written answer's significant figures. `sig_figs_mode` is `at_least` (default) or `exact`; fractions are treated as exact and skip the check.
- `units` (or `answer_unit`) enables dimension checking and conversion for common length, mass, time, volume, energy, force, pressure, power, electricity, amount, speed and temperature units. A length is never accepted for a mass, and a unitless answer is read in the expected unit. The existing `unit` property still means the course unit, not a physical unit.
- `answer` may list alternatives with `|`, and also accepts ranges: `1..2`, `[1, 2]` (inclusive) or `(1, 2)` (exclusive). `accepted_answers` adds more alternatives as a list or a `|`-separated string.
- The grader reads numbers only; it does not evaluate expressions such as `sqrt(2)` or `2^3`. Word answers still fall back to an exact text comparison.

### True/false and select-all answers

Set `question_type: true_false` or `select_all`. Practice shows True/False buttons, or lets you toggle several choices, grades the whole selection and writes it to the normal attempt history.

```yaml
question_type: true_false
answer: False
```

```yaml
question_type: select_all
answer: A, C
```

- The key may be a letter mapped through the choices (`B` with `- A. True` / `- B. False`), a word (`true`, `False`, `T`) or a list (`A, C`, `A/C`, `A and C`, `AC`).
- In the `## Answer` section, `Correct Answers: A, C` and `Correct Answer: False` are read too.
- Select-all compares exact sets: every keyed choice must be picked, and an extra pick is wrong. The result view marks the key, your picks and the missed choices.
- A true/false note with no `## Answer Choices` still works; the two buttons are shown for you.
- Unknown keys fall back to self-grading rather than guessing.

### Fill-in and matching answers

Set `question_type: fill_in` for a typed word or phrase. Text grading ignores case, extra spaces, surrounding punctuation and a leading article, so `Mitochondria`, `mitochondria.` and `the mitochondria` all match the key `mitochondria`. Alternatives use `|` or `accepted_answers`, the same as numeric answers.

```yaml
question_type: fill_in
answer: mitochondria
accepted_answers:
  - powerhouse of the cell
```

A matching note lists its pairs under `## Pairs`, one per line as `Left :: Right` (`=>` and `->` also work). Practice and timed tests shuffle the right column, ask for one choice per row, require every row, and mark each row after submitting.

```markdown
---
question_id: match-1
question_type: matching
---

## Question
Match each process to its description.

## Pairs
- Photosynthesis :: Converts light energy into chemical energy
- Cellular respiration :: Releases energy from glucose
- Diffusion :: Moves particles down a concentration gradient
```

- A matching note needs at least two pairs and its usual `question_id`, so it appears in practice and tests.
- A pick is stored as the row's answer position, not the text, so an attempt keeps grading the same after a restart.

### Parameterized questions

A question note can draw new numbers for every attempt and compute the answer from them. Put placeholders in the question or stimulus, define the variables, and give an answer formula:

```yaml
question_type: spr
variables:
  a: 2..9
  b: 1..5 by 0.5
  c: [1, 2, 3]
answer_formula: (a + b) * c
units: m
tolerance: 0.01
```

```markdown
## Question
A rectangle has side lengths {{a}} m and {{b}} m. What is its perimeter?
```

- Ranges are inclusive (`2..9`) and can use `by` for a step (`1..5 by 0.5`). Lists use `[1, 2, 3]` or `1,2,3`; a plain number is fixed. Variables can also be written compactly as `a=2..9; b=1..5`.
- `answer_formula` supports `+ - * / % ^`, parentheses, `pi`, `e`, and `abs`, `sqrt`, `round`, `min`, `max`, `pow`, `mod`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `ln`, `log`, `exp`, `floor`, `ceil`, `trunc` and `sign`. It is evaluated by a restricted parser, never `eval`.
- Each attempt gets a seeded variant. The review shows the values (`Variant: a = 3, b = 2.5, c = 1`), and the attempt stores them in the optional eighth `history` field plus `last_variant` and `variant_seed`. A saved timed test keeps the seed, so reopening it shows the same variant.
- If a formula or range is invalid, the question shows a variant error and is self-graded instead of being graded against a stale answer.

Run the command **Add missing tracking properties to all question notes** to add the writable properties to notes that don't have them yet.

## Using it

1. Open the practice view from the ribbon (graduation cap icon) or with the command **Open practice view**.
2. Pick a preset or set filters. The **Folder** filter lists every folder that holds questions; picking a folder also includes its sub folders. Tap several values to allow any of them. Tap **+ Add another set (OR)** to combine groups, for example "Unit 3 or 4 of a history course" OR "SAT, Reading and Writing, Inferences".
3. Choose how to pick questions and press **Start**. Or press **Timed test** or **Weak spots & errors** on the same screen.

   To study one note only, right-click a question in the file explorer and choose **Practice this note only** (or run the command with that note open). A banner on the practice screen names the note; **Practice all notes** clears the limit.
4. Choose an answer, say how sure you are, and **Submit**.
5. On the result screen you can review the question, show or hide the explanation, tag why you missed it, write notes, flag the question, open the note, or ask the AI. Press **Next question** to continue. **Known** and **Exclude** are beside the answer controls and stay available after you answer.

### Quick add questions

**Quick add questions from pasted text** turns a paste into ordinary question notes, one per block, so a set does not have to be typed one file at a time. Nothing is written until the preview is confirmed.

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

`Q:` starts a block. `A.` to `H.` lines are answer choices, `Answer:` or `Key:` takes a letter, a choice's own text or a set such as `A, C`, and `Why:` or `Explanation:` is the rationale. `Stimulus:`, `Course:`, `Skill:`, `Difficulty:`, `Unit:` and `Test:` are optional; wrapped lines continue the field above them and `---` separates blocks. A block with no choices becomes a numeric or short-answer (SPR) note. The dialog lists every block that needs attention, writes only the valid ones into the folder you choose, and numbers repeated titles instead of overwriting. The notes are normal question notes: no AI or import properties and no pre-filled tracking state.

### Review scheduling

**Leech handling (optional).** Set a leech threshold under Settings, Practice. When a question misses that many times in a row, the attempt marks it `leech: true` and the result view explains the mark; a correct answer clears it. The action can also suspend it so it leaves practice until you restore it under Hidden study items. The default threshold is 0, which leaves the feature off.

**Needs-fixing flag (optional).** Settings, Practice can mark a question after it is missed on five different days. The result screen then shows **Needs fixing** with a **Mark fixed** button; **Mark this question fixed** is also in the command palette. Confirming records `needs_fixing_fixed_on` and clears the flag, but keeps every attempt, the history list and the next review date. Misses before that repair date do not count again, so a repaired question starts a fresh five-day cycle. The option is off by default.

After a correct answer with confidence 2 or 3, the next review is 1, 3, 7, 21, then 60 days out (editable). A miss resets the streak and returns tomorrow. A correct answer rated "Guessing" doesn't extend the streak and returns in 2 days.

To use **FSRS** instead, open **Settings → MCQ Tracker → Review → Scheduler** and choose **FSRS (memory model)**. FSRS stores a compact state in the note's `srs` property; `history` stays the source of truth. The first time a question is reviewed, its existing history is replayed to seed that state. Existing `next_review` dates are not changed until that review. You can choose 85%, 90%, or 95% desired retention. Switching back to the ladder keeps the FSRS state and resumes the old streak-based schedule.

**Per-deck scheduling (optional).** Settings, Cards, Decks adds a scheduler choice and timing controls to every deck. A deck can choose **Simple ladder**, **SM-2** or **FSRS**, or leave **Use global scheduler** selected. Ladder decks can set their own interval list; FSRS decks can set 85%, 90% or 95% retention; SM-2 decks can set starting ease, first Easy interval, Hard multiplier and Easy bonus. SM-2 stores compact state in the note's `sm2` property and replays existing history once when a deck switches, so progress is not reset. Turning a deck back to the global scheduler keeps both `srs` and `sm2` state for later. Questions, whole-note reviews and decks without an override keep the global choice.

When an upcoming calendar exam matches the note's `course`, the scheduled `next_review` is capped to the day before the exam (or today when the exam is today). The cap is applied after the ladder or FSRS and never lengthens an interval. The applied date, exam name and exam date are recorded in `exam_cap`, `exam_cap_name` and `exam_cap_exam_date`; items with no course or no matching exam are left alone. The result screen explains when a cap moved the date.

Each `history` entry is stored as `date|result|seconds|answer|confidence|error_type`.

### Per-question hints (optional)

Turn on **Settings → MCQ Tracker → Review → Per-question hints** to show a **Show hint** button before answering. A hint comes from a `## Hint` section or a `hint` frontmatter property, and it stays hidden until you press the button. Quick add questions also accepts `Hint:` or `Clue:`. The option is off by default, so existing notes look the same. Hints never change attempts, history, streak or scheduling, and closed-book practice keeps them hidden.

### Exam-ready badge (optional)

Turn on **Settings → MCQ Tracker → Review → Exam-ready badge** to mark a question after **2 correct answers in a row** (Omniscient's default). Change the pass count with **Mastered passes** (1–10). The badge appears on the result screen and reads the existing question `streak`; it does not write a new property or change attempts, history, next review, Auto Anki, Text2Anki or Spaced Repetition output. It is off by default, so existing practice screens look the same.

### Inline quiz result export (optional)

Give an `mcq-quiz` block an `id:` line and turn on **Settings → MCQ Tracker → Review → Export inline quiz results**. After every question is answered, the containing note gains a Quizzable-compatible frontmatter object:

```yaml
quizResults:
  planets:
    score: 1
    totalPoints: 1
    percentage: 100
    passed: true
```

The export is off by default and is the only inline-quiz write to the note. It never changes attempts, history, streak or scheduling; blocks without an `id:` are untouched.

### Inline reorder questions (optional)

Turn on **Settings → MCQ Tracker → Review → Inline reorder questions** to use `Type: reorder` in an `mcq-quiz` block. Items use the normal `A.`, `B.`, `C.` lines, and `Answer:` lists every letter once in the correct order. Practice shows ▲/▼ controls and checks the exact sequence. The option is off by default; other quiz blocks are unchanged and no attempt, history, streak or scheduling data is altered.

### Closed-book practice (optional)

Turn on **Settings → MCQ Tracker → Review → Closed-book practice** to hide the **Open note** shortcut during a question. The question, choices and timer stay visible; the source row, answer note and explanation unlock only after you submit. The option is off by default, and it changes no attempts, history, streak, next review or scheduling. The toggle is a saved setting, so it stays on across practice sessions and plugin restarts; turn it off to restore the Open note shortcut.

### Hidden study items

Every practice and card review screen has **Known**, **Bury**, **Suspend** and **Exclude** actions. They hide an item without deleting its note or changing its review history:

- **Known** hides the item for **Known snooze (days)** (14 by default; Settings → MCQ Tracker → Review). A per-course override such as `BIO 101=7, CHEM 201=21` takes precedence for matching `course` values, and the Known button shows the number that will apply. It returns to the due queue on that date. The note keeps `study_status: known`, `known_days` and `known_until`.
- **Bury** hides the item for the rest of today and returns it tomorrow. The note keeps `study_status: buried` and `buried_until`.
- **Suspend** hides the item indefinitely until you restore it. The note keeps `study_status: suspended` and `suspended_on`.
- **Exclude** removes the item from practice, Quick Practice, timed tests, card reviews and the merged due queue until you restore it. The note keeps `study_status: excluded`, `excluded_on` and `excluded_reason`.
- The confirmation notice has an **Undo** button. You can also open **Manage hidden study items** from the notice, Settings → MCQ Tracker → Review, Today, or the command palette to search the list, filter by course, open a note, or restore it.
- Hiding an item never records a wrong answer, changes its streak or changes its schedule. Excluded notes stay in the vault, are included in exports, and are still found by search and Dataview.

### Study cards (optional)

**Settings → MCQ Tracker → Practice → Study cards skin** adds a Quizlet-style way to review the same question notes. It is **off by default**; turning it on adds a **Study cards** button to the practice home screen and the command **Open study cards**. **Study cards mode** then picks how each session runs: **Flashcards**, **Learn**, **Test** or **Match**.

- **Flip cards** show the passage and question first. **Show answer** reveals the answer and explanation; **Still learning** records a miss and **Known** records a correct recall, so the next review is scheduled exactly as in normal practice.
- **Choice cards** show the answer choices. Pick one, press **Show answer**, and the correct choice and your choice are marked. The selected letter is written to the same `history` and attempt properties as ordinary practice.
- **Learn** keeps the flip or choice card, and a card you miss comes back once later in the same session, so the second look happens before you finish.
- **Test** hides the answer and the score until the end. Choose an answer and press **Submit answer**; the closing screen lists every card with your answer, the key and a percentage. Reviews still go through the normal scheduler, and nothing is revealed mid-test.
- **Match** opens a two-column board of up to six prompts and their answers. Pick a question, then its answer: a correct pair disappears and records one normal review, while a wrong tap only raises the try count and records nothing.
- A session uses the current filters, pick mode, hidden-item rules and scheduler, and is capped at 20 cards. A question with no choices or no answer key automatically falls back to a flip card.
- The skin never creates or changes a second note, deck or scheduler. Turning it off restores the practice home screen unchanged.

### Inline quiz blocks

Add a fenced `mcq-quiz` block to any note. It works without a question note and stays local:

```mcq-quiz
gated: true
Q: Which gas do plants take in?
A. Oxygen
B. Carbon dioxide
Why A: Oxygen is released, not taken in.
Why B: Photosynthesis consumes carbon dioxide.
Answer: B
Why: The light reactions use CO2.
```

`gated: true` shows one question at a time and reveals the next only after an answer. Every choice is marked, and its own `Why A:` / `Why B:` feedback appears after answering; the overall `Why:` appears too. Add `ID: Q-123` to a question to record the attempt on that question note, so it uses the same history, streak and ladder/FSRS schedule as normal practice. Add `pass: 80` and `imprecise: 60` at the top for weighted pass/imprecise/fail scoring.

For a numeric estimate, add a slider question; for a short written answer, add a text question:

```mcq-quiz
Q: In what year was JavaScript created?
Type: slider
Min: 1980
Max: 2010
Step: 1
Tolerance: 2
Answer: 1995
Weight: 2

Q: What is the capital of France?
Type: text
Answer: Paris
Context: The city, not the country.
Weight: 1
```

Sliders accept any value within `Tolerance` of `Answer`. Text questions check an exact answer locally and, when AI features are on, offer **Evaluate with AI**; the model returns a 0–100 score and explanation through the existing card-grading AI path. `Weight` applies to the weighted block summary, which reports **pass**, **imprecise** or **fail** without changing the note format or scheduler.

### Simple quiz blocks

A `quiz` block renders a small flip-card quiz inside any note. Cards can be defined directly, loaded from a `quizjson` block, or generated by an opt-in `quizjs` block:

```quiz
{
  "sources": ["Quiz cards.md"],
  "limit": 10,
  "hideTitle": true
}
```

```quizjson
[
  {
    "question": { "left": ["Capital of France?"], "right": ["Paris"] },
    "notReversible": true
  }
]
```

Each card is a front/back pair. `defaultSide: "right"` starts on the right side, and a card without `notReversible: true` also appears reversed on alternate cards. `sources` accepts note paths or folders; without `sources` the block reads `quizjson` and `quizjs` blocks in the current note. `limit`, `hideTitle` and `shuffle` are optional.

Add `quiztoday` for a local streak and today's card/quiz counts, and `quizcharts` for a dependency-free 30-day bar chart. Both accept `{ "minify": true }`; `quiztoday` also accepts `"hideCounters": true`. These counters are separate from the daily quiz and the question scheduler.

For generated cards, enable **Allow JavaScript card blocks** under Settings → MCQ Tracker → Daily quiz and use a `quizjs` block. The code receives `fc`, calls `fc.addCard({...})` for each card and must end with `fc.commit()`. JavaScript is off by default and is **trusted note code**, not a sandbox; only enable it for notes you trust.

### Simple note quiz

Run **Simple note quiz: start on this note** on an ordinary Markdown note. A non-empty line ending in `?` is a question; the lines below it are its answer until a blank line, or until the next unindented bullet when **Answer separator** is set to **Next unindented bullet**:

```markdown
What is the capital of France?
Paris, on the Seine.

What is 7 × 8?
56
```

Choose **Known** or **Still learning** after revealing each answer. At the end, **Save marks** appends a visible `✅` or `❌` to the question line. Run the quiz again to review only unmarked or missed questions, or use **Clear marks** in the setup. The question marker, separator and shuffle behavior are under Settings → MCQ Tracker → Daily quiz.

This is a note-local self-test. It never changes a question's attempts, history, streak or next review, and it does not create question notes. Fenced code blocks and YAML frontmatter are ignored when parsing.

### Whole-note review

Turn it on under Settings → MCQ Tracker → Review. One set per line: `Name | folders | tags | priority`. Folders include subfolders, and blank folders or tags mean any note. With no sets, only notes with `note_review: true` are reviewed. The command **Review notes (whole-note queue)** shows one note at a time with Again/Hard/Good/Easy; ratings go through the same ladder or FSRS scheduler and write the usual `history`, `attempts` and `next_review` properties. A status-bar count shows notes due. Question and card notes are excluded, and `note_review_priority: high|normal|low` changes queue order only.

### Spaced Everything

Spaced Everything is an optional SuperMemo 2 queue for whole notes. Enable it under Settings → MCQ Tracker → Review, then run **Spaced Everything: log review outcome for this note** on the open note. The first rating onboards the note and writes `se-interval`, `se-ease` and `se-last-reviewed`; later ratings update only those properties. **Fruitful** brings the note back soon, **Ignore** keeps the normal pace, and **Unfruitful** spaces it further out. Run **Spaced Everything: review due notes** for a due queue. Question and card tracking (`attempts`, `history`, `streak` and `next_review`) is never changed.

**Capture thought** creates a new onboarded note. Its title and body templates support `{{date}}`, `{{time}}`, `{{unixtime}}` and `{{thought}}`; if the body template omits `{{thought}}`, the thought is appended rather than lost. Notes with malformed schedule properties are still shown as due and are repaired when rated.

### AI quiz generation from notes

Run **Generate quiz questions from notes** from the command palette. Choose source folders (blank means the whole vault), 1–20 questions, one or more of multiple-choice, select-all and true/false, and any of 22 output languages. Only notes in those folders are read; existing question and card notes are skipped, and the source is capped at 12 notes / 18,000 characters. Every draft is shown with its key before anything is written. Confirming creates ordinary question notes through Quick add, so generated questions use the same history, streak and ladder/FSRS schedule. This needs **Enable AI features** and a configured provider; nothing is sent until you press **Generate draft**. Malformed or duplicate model items are dropped, and the last choices are remembered.

### AI flashcard generation from the open note

Run **Generate flashcards from this note or selection**. If text is selected, the generator uses it; otherwise it reads the open note. Add an optional instruction and choose 1–20 cards. **Create tracked card notes** is the default: cards go through the normal importer, get a deck, source note and AI provenance, and use the same history and scheduler; **AI: undo the last generated notes** removes them. **Insert into this note** appends a block instead, using an inline `front :: back` or multiline `front` / `---` / `back` layout you can change, plus an optional `%%` wrapper that hides the block in reading view. Inserted blocks are not scheduled; undo the insertion with Ctrl/Cmd+Z. The last choices are remembered in settings, and Cards → Review exposes the default count, layout and hidden-block choice.

### Spaced Repetition quiz notes

Choose **Spaced Repetition quiz note** under **Output**, or run **Spaced quiz: generate from this note** for a whole-note shortcut. The same AI card draft is previewed first. Confirming saves a separate note named after the source under the card folder, for example `Cards/Cell Spaced Quiz.md`, with a `#flashcards` tag and one card per block:

```markdown
What is the membrane like?
?
Selectively permeable.
```

The saved note is parsed back with the existing Spaced Repetition importer before anything is written, then its cards are imported through the normal card store. They therefore get the usual deck, source, `import_batch` and `import_key` provenance, review history and ladder/FSRS schedule. Re-running updates the same generated note and skips cards that are already tracked; an ordinary note at the target path is never overwritten. The source note's attempts, history, streak and next review are untouched.

### Auto Anki

Run **Auto Anki: send this note or selection** on an open Markdown note. When text is selected it uses that passage; otherwise it uses the whole note. The confirmation window shows the source, card count and deck; **Generate and send** drafts cards with the configured AI provider, writes them as ordinary tracked card notes and pushes only those cards through AnkiConnect.

Re-running on unchanged source text reuses the cards already generated for that source and sends them again without creating duplicates. The generated cards carry `import_format: auto-anki`, a stable import key and the source batch, so the existing card queue, history and scheduler still own them. AnkiConnect must be enabled under Settings → Cards → Sync. The default count and deck are under Settings → Cards → Decks, Auto Anki.

### Text2Anki

**Text2Anki: send the selection to Anki** is the one-shot shortcut for a passage you have selected. It drafts cards immediately with the configured AI provider, writes ordinary tracked card notes through the same importer and batch keys as Auto Anki, and pushes only those cards to Anki without opening a confirmation window. Re-running on the same selection reuses the existing cards and never duplicates them.

Add a line such as `Deck: Computer Science::Python` to the note or the selection to choose the Anki deck for that run; otherwise the Text2Anki deck setting is used. **Settings → Cards → Decks → Text2Anki** holds the count, deck and optional extra instruction. AI features, Cards and AnkiConnect must all be enabled. The selected text is treated as untrusted study material, not as instructions.

### Commands

- Open practice view
- Next question (from current filters)
- Toggle flag on this question
- Add missing tracking properties to this note
- Add missing tracking properties to all question notes
- Practice a folder...
- Practice the folder of this note
- Practice this note only
- Start a timed test
- Quick Practice
- Daily quiz
- Open study cards
- Open Today
- Review notes (whole-note queue)
- Generate quiz questions from notes
- Retry saving offline practice results
- Open cards
- Open assignments and grades
- Assignments: add an assignment
- Create a flashcard or vocabulary card
- Create a source-anchored recall from selection
- Cards: test CouchDB connection
- Cards: sync review state with CouchDB
- Generate flashcards from this note or selection
- Spaced quiz: generate from this note
- Cards: create image occlusion cards
- Cards: extract cards from this note
- Cards: tag cards with their folder's course
- Cards: grade pending typed answers
- Cards: import existing decks
- Open calendar
- Calendar: add an .ics schedule
- Calendar: create or open the note for the next class
- Calendar: export the visible schedule to .ics
- Show weak spots
- Show error log
- Find a question by ID
- Import questions from a file
- Quick add questions from pasted text
- Export an answer-free practice sheet
- Export a study bundle (backup of questions and cards)
- Import a study bundle (restore questions and cards)
- Rename old source_question_id properties to official_question_id (one-time clean-up for notes imported before the rename)

### Study bundles

**Export a study bundle** writes every question note and card note into one ZIP at the vault root (`mcq-study-bundle-YYYY-MM-DD.zip`), with a `manifest.json` and a README. Notes are copied unchanged, so properties, history and scheduling survive. Images, audio and PDFs are not bundled.

**Import a study bundle** restores the newest bundle at the vault root. Missing notes are created; an identical note is reported and not duplicated; a note that differs from the bundle is never overwritten and is reported as a conflict. Absolute paths, `..` hops and unsafe characters are rejected. Cards are skipped while the Cards module is off. Both commands work locally; nothing is uploaded.

### Practice sheets

**Export an answer-free practice sheet** writes `mcq-practice-sheet-YYYY-MM-DD.md` at the vault root from the questions that match the current filters. Each entry keeps the stimulus, question, answer choices (or the left side of a matching prompt), course/skill/difficulty metadata and a blank answer line. The answer section, correct key, rationale, private notes and frontmatter are left out, so the result is safe to print or use for a closed-book self-test. Exporting changes no question note, attempt, history, streak or review date. Running it again gets a numbered name such as `mcq-practice-sheet-2026-10-30 2.md` instead of overwriting the earlier sheet.

## AP score calculator

Open **Reference → AP score**, or run **Open AP score calculator**. Choose from eight 2027 profiles (AP Biology, Calculus AB, Calculus BC, Chemistry, English Language and Composition, Statistics, U.S. History, and World History: Modern), enter the points for each section, and get an unofficial weighted estimate. The 2027 section weights and point totals come from the official AP Central exam pages linked in the tab. Cut scores are editable practice defaults, not an official College Board curve, and the tab says so. If any section is blank, the result stays **Incomplete estimate** rather than treating missing work as zero.

The **What do I need for a 4/5?** control holds the other sections fixed and shows the percentage and points required on each section, or that the target is not reachable with the entered scores. Nothing leaves the device.

When the estimate is complete, **Save practice exam** writes an ordinary Markdown note under **AP practice exams/** with the date, course, exam year, composite, estimated score, likely band, section table and the cut scores used. The note also keeps every written-response score and adds a per-question table. The tab then lists saved attempts newest first, with an average, the change from the previous attempt, and a written-score average plus per-section trends. AP U.S. History shows SAQ, DBQ and LEQ separately; single-written-section courses show FRQ. The note is yours: rename it, edit the notes section, or delete it without affecting the calculator.

## AP free-response practice

Run **AP: open free-response practice and grader**, or create a note first with **AP: create a free-response note**. The pilot supports six courses: AP World History: Modern, AP U.S. History, AP Chemistry, AP Calculus AB, AP Calculus BC and AP Statistics. You supply the prompt and rubric; the plugin ships no AP questions, rubrics or sample responses.

A practice note is ordinary Markdown:

```md
---
type: ap_frq
ap_course: ap-world-history
max_points: 6
---

## Question
Your prompt here.

## Stimulus
Optional shared passage, data or documents.

## Rubric
- [1] Thesis: states a defensible claim.
- [2] Evidence: uses the documents and outside evidence.
- [2] Sourcing: explains point of view, purpose, situation or audience.
- [1] Complexity: explains a nuance or limitation.

## Sample Answer
Optional model answer.
```

The rubric accepts `- [points] Label: description`, `- points: Label — description`, `- Label (points)`, or a Markdown table with a points column. Add an optional category such as `[thesis]`, `[evidence]`, `[reasoning]`, `[calculation]`, `[units]`, `[notation]` or `[communication]` after the points; without a tag the grader infers one from the label. The category appears beside each criterion and in the saved attempt. **New FRQ note** starts from an editable preset for the selected course and question type: DBQ, LEQ or SAQ for history; long or short response for chemistry; free response for calculus; free response for statistics. Those presets are original starting points written for this project, not official College Board rubrics. Edit them to match the rubric you were given.

**Self-grade** needs no AI and no network: enter the points for each criterion, and the total is clamped to each maximum. The answer box has a collapsible **Math preview** that renders `$...$`, `$$...$$` and `\ce{...}` locally as you type. **AI grade** sends the prompt, your rubric, the optional sample answer and your typed answer to your configured provider, then returns a draft score per criterion with a quote and a short explanation. The draft flags low-confidence criteria and any point awarded without a quote; every line stays editable, and saving records whether the result was self-graded, AI-graded or AI-edited. **Second pass** runs an independent AI pass and flags every criterion the two passes score differently; resolve those scores yourself instead of averaging them. The note creator can also mark a pasted rubric as **official or teacher-supplied**, which stores `rubric_source: official`. Insights → Weak spots lists the rubric criteria marked short across your saved attempts, and each row opens the prompt where it was missed. Saving an attempt also schedules the prompt: below 60% returns tomorrow, 60–79% in three days, 80–89% in a week and 90%+ in two weeks, while any missed rubric criterion caps the wait at three days. Due prompts appear in **Today** and in the next exam's study plan with a **Practice FRQ** button. You can also put FRQ prompts into a timed test; their responses are graded afterward with the same grader. If the answer is on paper, press **Read photos of handwritten work...** and choose up to eight images (PNG, JPEG, WebP, GIF or HEIC, under 8 MB each). The pages are read in the order chosen and each transcript is appended to the answer box, so a multi-page solution stays in order; a later failure keeps the pages already read. Only the chosen images are sent, only when you press the button, to the `handwriting` feature on Direct AI, and the photos are not stored in the vault. OpenCode cannot receive images. Attempt notes record `answer_source: photo` and `answer_pages`.

Each saved attempt becomes its own note under **AP FRQ attempts/** with the course, prompt link, score, percentage, practice band, missed criteria and the graded answer. The prompt note also gets `frq_last_score`, `frq_last_max`, `frq_last_percent`, `frq_criteria_missed`, `frq_graded_by`, `frq_graded_on`, `frq_attempts`, `frq_review_interval` and `frq_next_review`, so history and Dataview queries work without a database. Scores are practice feedback against your rubric, not a College Board score. The grader has no human-scored accuracy evaluation yet; treat AI drafts as a second opinion and check the rubric yourself.

## AP resources

Open **Reference → AP resources**, run **Open AP resources**, or use the button in **Settings → Reference → Tools**. The index covers the same eight courses as the score calculator. Pick a course to get its official starting points: the AP Central course page and course/exam description, the exam format and section weights, released free-response questions with scoring guidelines and sample responses, the AP Students page with dates and registration, AP Classroom/AP Videos, and the AP exam calendar.

This is a **link index, not a content dump**. The plugin stores only titles, short original descriptions and URLs. It never signs in to AP Classroom, scrapes account-gated material, or copies prompts, rubrics, videos or question banks into your vault. Links were checked on 2026-10-29; if one moves, report it rather than pasting the page in. AP is a College Board trademark and this plugin is not affiliated with or endorsed by the College Board.

**Save as note** writes a small note under **AP resources/<course>/** with the course, optional unit, resource type, official URL and checked-on date, plus tags such as `ap`, `ap-biology` and `unit-3`. The saved-resource list warns when a link was checked more than 180 days ago; **Mark checked** refreshes the date after you verify the official page. The note is ordinary Markdown, so Dataview, search and backlinks work on it. It contains no AP material.

When Today's **Next exam** is an AP course, it shows one saved resource for that course. Fresh links come first, practice material is preferred, and a stale link is labelled rather than hidden. **Open resource** goes straight to the note; if none is saved yet, save one from Reference → AP resources.

**Attach to exam** binds that note to the exact calendar exam by writing `exam_uid`, `exam_date` and `exam_title`. An explicitly attached note wins over a generic course match on later visits, and the row changes to **Attached resource**. The calendar's **Upcoming exams** panel then shows **Attached: <note>** under that exam with an **Open** action. **Detach from exam** on Today removes the binding; you can also edit or delete the three properties by hand. Free-time study blocks use the same notes: the chooser suggests a saved resource for the next class, and **Attach to this block** stores `study_slot_date`, `study_slot_start` and `study_slot_subject` on the note. Detaching clears only those three properties, leaving the exam binding and the link untouched. When an exam has an attached resource, its calendar row also offers **Add to note**: it creates the exam's class note if needed and adds a `## AP resources` section with a wikilink, once. The Reference saved-resource list shows **Attached to exam** and **Study block** labels, with **Detach exam** and **Detach block** actions that remove one binding without disturbing the other.

## Reference (optional module, off by default)

Turn it on under **Settings, Global, Modules**, then open **Reference** from the ribbon or the command palette. The view has ten tabs:

- **Formulas** — searchable formulas for math, physics, chemistry and biology, with a subject filter.
- **Structures** — paste a SMILES string to draw a molecular structure locally, with example molecules. A `smiles` code block in any note renders the same SVG. No structure service, network request or third-party dataset is used.
- **Unit converter** — length, mass, volume, temperature, time, speed, energy, pressure, angle and digital data.
- **Calculator** — a local Basic or Scientific keypad for arithmetic, powers, roots, logs and trigonometry. It uses the restricted evaluator, never `eval`, and is hidden during a timed test unless you allow it under Settings, Reference, Tools.
- **Graph** — plot `y = f(x)` with a restricted local expression parser. It supports `x`, `pi`, `e`, the usual trig and log functions, and `+ - * / ^`. It does not use `eval`, a calculator service or a Desmos key.
- **Periodic table** — all 118 elements in a tap-to-open grid, with atomic number, the AP Chemistry 2020 mass where the table lists one, category, period and group.
- **Constants** — common physical and chemical constants with units.
- **Sheets** — one-screen references: a unit-circle table of 16 common angles, grouped trig identities, the standard RNA codon table with search (DNA spelling accepted), and a one-gene Punnett square with genotype counts.
- **AP score** — an unofficial weighted score estimate for eight AP courses, with editable practice cutoffs and reverse planning. The separate free-response grader opens from the command palette.
- **AP resources** — official AP Central, AP Students and AP Classroom links for each supported course, with saved notes and a next-exam recommendation on Today.

The local SMILES renderer supports common organic atoms, bracket atoms with charge and hydrogen counts, single/double/triple/aromatic bonds, branches, ring labels and disconnected fragments; unsupported syntax reports an error instead of guessing. The graph parser only accepts the listed names and operators; an unknown name or a pasted script is rejected rather than evaluated. Periodic-table masses and blanks match the College Board AP Chemistry Periodic Table of the Elements (2020); chemistry equations and constants match the AP Chemistry Equations and Constants (2025). The panel is local: it does not read notes, call a model or make a network request. **Hide while a timed test is running** is on by default, so it stays out of a closed-book section; turn it off under Settings, Reference if your test allows a reference sheet. The calculator has its own **Hide calculator during timed tests** switch, so a no-calculator section stays honest even when the rest of the panel is allowed. Formulas are study aids, not official exam material; check the sheet supplied with your course and exam year.

## Calendar (optional module, off by default)

Turn on **Calendar** under Settings, Global, Modules (or **Enable the calendar module** under Settings, Calendar), to add a class and exam calendar. Everything is parsed on your device from `.ics` files; nothing is fetched until you add a feed.

- **Add a schedule.** Use **Calendar: add an .ics schedule**, or **Add a schedule** in an empty calendar view. Pick an `.ics` file from your vault, or paste a public calendar address. Google Calendar share links (`?cid=...`), embed links (`?src=...`) and `webcal://` addresses are converted to the calendar's `.ics` address automatically. For a private Google Calendar use Settings, Integrate calendar, **Secret address in iCal format**. Canvas, Outlook and most university systems export `.ics` too.
- **What you see.** The original University Schedule and Calendar layout: a month card with a color dot per class, then the selected day's timeline underneath. Clicking a day keeps the month grid on screen and updates that timeline; **Day** opens the standalone day view. A live countdown marks the class in progress, **Upcoming exams** shows the next five exams with a countdown, and **Upcoming** lists the next two weeks. Classes are colored by type (lecture, exercises, lab, seminar, project, language, exam), and every color is a setting.
- **Breaks between classes.** Optional markers show the free periods between consecutive classes on the day timeline. Choose a pill, dashed line, timeline card or plain text, pick a coffee/food/pause icon, and set a minimum and maximum gap length. Off by default; turn it on under Settings, Calendar, Display → **Breaks between classes**, or use the coffee button in the calendar header.
- **Study from free time.** Click the **2h free** badge or any break marker to start a Quick Practice session in that period. Choose 5, 10 or 20 minutes that fit, then use your current filters, questions due for review, or questions for the next class. A configurable buffer (5 minutes by default) stays free before the next class: Settings, Calendar → **Study from free time**.
- **One click to a note.** Each class card has a **Note exists** or **Missing note** badge, and clicking the card opens or creates the note. It creates the note from the template (subject, course, date, time, room, lecturer, type, tags, calendar UID and date) in the subject's folder, or opens the note that already exists. The calendar UID and date keep the link after you rename or move the note, so it does not create a duplicate. The subject-to-folder mapping is remembered the first time and is editable in settings.
- **Embed a day.** Put this in any note:

  ````markdown
  ```uni-schedule
  date: today
  ```
  ````

  `date:` accepts `today`, `tomorrow`, or `YYYY-MM-DD`. `uni-calendar` works the same way, and `mcq-schedule` is always available. If University Schedule and Calendar is enabled, the `uni-*` names stay with that plugin, so the same block is never rendered twice.
- **Hide what you don't attend.** Excluded subjects and keywords are settings. Hidden schedules, excluded subjects and keyword matches also stay out of exports.
- **Export.** **Calendar: export the visible schedule to .ics** writes `schedule-export.ics` in the vault root.

A **course registry** in Settings, Calendar, Courses stores each course's name, code, folder, color, semester, instructor and credit weight. A matching class title opens new notes in the registered folder, uses the course color, and its credits fill the credit-weighted GPA when Assignments does not set a credit for that course. Existing subject/folder mappings and class colors still work as fallbacks.

The class-detail parsing, the `.ics` parser and the calendar presentation are adapted from [University Schedule and Calendar](https://github.com/Cesemess/obsidian-uni-calendar) (MIT, Cesemess). The month card, timeline and event cards keep that plugin's markup and stylesheet rules so the two calendars look the same; see [NOTICES.md](NOTICES.md) for the pinned version and the list of changes. Labels are English-only for now, and the note template is plain text rather than a visual builder.

## Assignments, tasks and grades

**Settings, Global, Modules → Assignments** adds the gradebook, task list, ribbon button and commands. The module is on in the default setup and can be switched off without deleting notes or settings. Its own page under **Settings, Assignments** has the target grade, final weight, category weights and course credits.

An assignment is a normal Markdown note. Create one from **Assignments: add an assignment**, or write the same properties yourself:

```markdown
---
assignment: true
assignment_id: a-essay-1
title: Unit 4 essay
course: Biology 201
type: essay
due: 2026-11-14
weight: 1
status: todo
points: 100
score: 87
---

# Unit 4 essay

- [ ] Unit 4 essay 📅 2026-11-14

## Notes
```

- `type` is one of `homework`, `quiz`, `test`, `exam`, `project` or `other`. It selects the weighted category.
- `weight` orders assignments **inside** a category. Category weights (homework, quizzes, tests, exams, projects) are set on the Grading tab and are the percentages of the course grade. A course uses the categories that already have graded work, so an early-semester grade is not pulled down by categories that have not started.
- `points` and `score` grade an assignment. A missing assignment counts as zero; submitted but ungraded work is left out until it has a score.
- `due` is mirrored in the Tasks line as `📅`, so Tasks, Dataview and similar plugins can query the same note. `⏳` is accepted when reading an existing task. Checking the box marks the assignment submitted; **Mark done** in the gradebook does the same.
- The **Courses** tab stores credits, a target grade and a final weight per course. A blank target or final weight uses the defaults on the Grading tab. The GPA is credit-weighted (`Σ grade points × credits / Σ credits`), with the unweighted GPA beside it. The **what do I need on the final** estimate assumes your current grade carries through the rest of the non-final work.
- **Today** shows one **Tasks** card when there is due practice or an assignment deadline. The review task starts Quick Practice with the due questions; each assignment opens its note. No gradebook service, chart library or network request is involved, and none of this adds third-party code.

## Cards and vocabulary (optional module, off by default)

Turn on **Cards** under Settings, Global, Modules. Cards are first-class notes, not a separate database: each one has its own `history`, `next_review` and—if you use FSRS or SM-2—`srs` or `sm2` state, so the same scheduler handles questions and cards. The module is off by default and touches nothing until you create or review a card.

- **Create a card** from the Cards view, the command palette, or Today. Choose a flashcard, reversed card, cloze card, or vocabulary item, and pick a deck; a live preview shows the note that will be created. Choosing **New deck…** lets you set the deck name, folder and course in the same dialog, and those settings are saved with the first card. A deck can have a folder and a course; cards in that folder inherit the course. New cards go under **New card folder** (default `Cards`) in a subfolder named after the deck, unless the deck specifies its own folder.
- **Sync review state with CouchDB (optional).** Under Settings, Cards, Sync, enter a CouchDB server URL and database, then use **Test connection** and **Sync now** (also the commands **Cards: test CouchDB connection** and **Cards: sync review state with CouchDB**). The database is created if it is missing. Each card gets a small per-card document containing only review properties (`attempts`, `correct_count`, `streak`, `next_review`, scheduler state and `history`), never the card text. The newest review wins the schedule and both histories are unioned, so a device that reviewed last sets the due date without dropping earlier attempts. The password is stored in Obsidian Secret Storage; remote servers must use HTTPS, while plain HTTP is allowed only for localhost. Cards that exist only in CouchDB are counted but not created locally because their note text is not stored remotely. Nothing runs in the background.
- **Plain Markdown cards.** Turn on **Plain Markdown cards** under Settings, Cards, Decks and choose one folder. Notes in that folder become cards without Anki markup: split the front and back with `---`, use two `---` lines for a reversed pair, or wrap text in `~~tildes~~` for a cloze. Subfolders become nested Anki decks with `::`; a note directly in the source folder uses that folder's name. Notes without a usable structure, question notes and existing card notes are skipped. The notes stay plain Markdown and get normal tracking properties only when reviewed; use **Cards: rescan plain Markdown folder** or **Rescan** after adding notes. Off by default.
- **Extract cards from a note.** Right-click a lecture or source note and choose **Extract cards from this note** (or run the command with it open). The preview reads question/answer headings, `Term: definition` and `Term — definition` lines, “X means Y” sentences, two-column Term/Definition tables, `==highlights==` and `{{c1::cloze}}` marks without an AI key. Nothing is written until you review the pairs. The note gets `flashcards: true` after a successful extraction; set `flashcards: false` to stop extraction for that note.
- **Source-anchored recalls.** Select the passage that explains why an answer is true, then run **Create a source-anchored recall from selection**. The passage is prefilled as the card's answer and stored as `source_quote` with a short `source_context` and the nearest heading. After revealing the card, the review shows that passage with the anchor highlighted; **Review in context** opens the source note and selects the passage. The recall is still an ordinary card note, so it uses the same deck, course, history, offline outbox and ladder/SM-2/FSRS scheduler. Everything stays in the vault and no network request is made.
- **Image occlusion cards.** Use **Image occlusion** in the Cards view, or the command **Cards: create image occlusion cards**, to make one card per mask on a diagram already in your vault. Enter each mask as `x, y, width, height, label`; coordinates are percentages of the image, so they resize with it. Each mask becomes its own note with `card_type: image-occlusion`, `image`, `mask_x`, `mask_y`, `mask_w`, `mask_h` and `mask_label`. The review screen covers the mask and lifts it when you reveal; these cards always use flip review.
- **Review** by revealing the answer and rating **Again**, **Hard**, **Good**, or **Easy** (keys 1–4; Space or Enter flips when using Flip mode). The rating maps directly to the simple ladder or FSRS. Reviews use the same offline outbox as question attempts, so a temporary vault or sync lock does not lose a rating.
- **Optional card reveal animation.** Under Settings, Cards, Review, choose **Instant** (default), **Fade in** or **Flip** for the answer's entrance. It applies only to the Cards review, plays once per reveal rather than on every re-render, and is skipped automatically when your system asks for reduced motion or the app cannot animate CSS transitions. It changes nothing about reviews or scheduling.
- **Type or speak an answer.** Set **Answer mode** under Settings, Cards, Review to **Type** or **Speak**. Type grades the answer locally against the stored answer, ignores case, accents, articles and punctuation at standard strictness, accepts small typos, numbers and `accepted_variants`, and shows the missing key words. **Speak** uses the same text box with your device's dictation or microphone key; no audio leaves the device. The suggested rating is Good/Hard/Again, and choosing another rating records an override. A card's `answer_mode` or `grading_strictness` property, or its deck's setting, overrides the global default.
- **Optional AI second opinion.** **AI fallback for typed answers** under Settings, Cards, Review sends only an inconclusive answer to your configured provider, with the card front, the stored answer, your answer and the strictness. A valid reply is mapped to Good/Hard/Again and keeps `graded_by: ai`, the confidence and the feedback in the note. If the request fails, the attempt waits in a device-local queue instead of being counted wrong; pending grades appear in **Today** and at the top of the **Cards** list, with a **Review** action beside each card and a **Grade now** button; the **Cards: grade pending typed answers** command retries them too. The plugin also retries when Obsidian starts. Rating the card yourself records `graded_by: self` and removes it from the queue. The learner's answer is treated as untrusted data, and the grader has no tools or access to other notes.
- **Decks** are managed under Settings, Cards, Decks: set a default deck, a folder, a course, an answer mode, grading strictness, a scheduler override and its timing for each deck, add or remove decks, and see per-deck due/new counts. Cards with a `deck` property are grouped even if the deck has no settings entry; use **Save deck** to give it a folder or course.
- **One due queue.** Today and the command **Open today's due queue** show one list across due questions, flashcards and vocabulary. Each row opens the note or starts the right review; the existing practice and Cards buttons remain available for a full session.
- **Mixed review.** **Start mixed review** from Today, the due queue or the command palette weaves due questions, flashcards and vocabulary into one session. Recall each item, reveal the answer, then rate it Again, Hard, Good or Easy. Ratings write through the same scheduler and offline outbox as the dedicated practice and Cards screens. The dedicated screens still handle typed answers, diagrams and detailed per-question feedback.
- **Import existing decks.** Use **Import** in the Cards view, **Import cards** under Settings, Cards, Decks, or the command **Cards: import existing decks**. Thirteen sources are supported:
  - **Spaced Repetition notes in this vault.** Pick a folder; the importer reads `Q::A`, reversed `Q:::A`, multiline `?` and `??`, `==cloze==` / `{{c1::cloze}}`, and `#flashcards/deck` tags. Files without a flashcard tag only contribute explicit `::` cards, so ordinary notes are left alone.
  - **Mochi Markdown folder.** In Mochi, export the deck as Markdown, unzip it into a vault folder, then choose that folder. Each card file uses `---` or `***` between its sides, and the folder name becomes the deck unless you enter a fallback deck. Mochi's native `.mochi` ZIP and CSV exports are not read directly.
  - **Anki plain-text/CSV export.** In Anki, use **File → Export → Notes in Plain Text** and include the deck column. Headers such as `#separator`, `#html`, `#notetype column`, `#deck column` and `#tags column` are understood; basic HTML is converted to Markdown.
  - **Anki package (.apkg).** In Anki, use **File → Export → Anki Deck Package (.apkg)** and save the file in the vault. The plugin reads the package locally: notes, decks, tags, basic/reversed/cloze cards and Anki's basic scheduling metadata. Images, audio and review history are not imported. This works on desktop; older SQLite packages and `collection.anki21` are supported, while newer zstd-compressed packages show a text-export hint. No Anki code, SQLite engine or ZIP library is bundled.
  - **Quizlet text export or PDF test bank.** Open the set in Quizlet, choose **Export**, keep **Tab** between term and definition and **New line** between cards, then save the copied text as a `.txt` or `.csv` file in the vault. Comma, tab and ` - ` separators plus semicolon or newline rows are auto-detected; quoted CSV and two-line exports work too. A PDF printed from Quizlet is also read from its text layer: choose **Print**, use the Flashcard view or the Test view with the answer key included, then choose **Quizlet text export or PDF test bank**. Use **Choose PDF from device...** to pick a file anywhere on your computer without adding it to the vault; the file is read locally, not uploaded, and no copy is written into the vault. Printed term/definition rows and numbered questions with choices are recognised. The preview shows the first extracted cards; **Import cards** writes them as ordinary flashcards. Scanned PDFs need OCR first. Quizlet does not include a deck name, so choose a fallback deck in the dialog; when you leave it blank, the PDF file name becomes the deck.
  - **Moodle GIFT.** Save the course's GIFT text as a `.txt` or `.gift` file in the vault. Each question uses the usual `::Name::Question{=Correct ~Wrong}` form; multiple choice, true/false, short answer and numeric answers are read. Each question becomes one basic card with the correct answer on the back, and matching questions are skipped explicitly rather than guessed.
  - **Moodle XML quiz bank.** Export the question bank as Moodle XML and save the `.xml` file in the vault. Multiple choice, true/false, short answer and numerical questions are read; matching, essay, description and cloze questions are skipped.
  - **QTI quiz bank.** Export the bank as QTI XML. QTI 1.2 response labels and QTI 2.1 simple-choice items are read, with the correct choice mapped to the card back.
  - **CrowdAnki JSON.** Export the deck as CrowdAnki JSON and save the `.json` file in the vault. Nested deck names, note fields, Anki tags and cloze models are read; CrowdAnki does not include review history.
  - **Generic CSV / TSV.** Choose any `.csv`, `.tsv` or `.txt` table. The delimiter is detected, common headers such as `Term`, `Definition`, `Deck`, `Course`, `Tags` and `Notes` are mapped automatically, and a preview shows the first rows before anything is written. Map or ignore any column yourself; the mapping is remembered for the same headers. Headerless files use the first two columns, and a row without both a front and a back is reported and skipped.
  - **Kahoot spreadsheet.** Save the Kahoot template as CSV, then import it. The `Question`, `Answer 1–4`, `Time limit` and `Correct answer(s)` columns are read; the correct answer can be a number (`2`) or several numbers (`1,3`).
  - **Blooket spreadsheet.** Save Blooket's CSV Import template as a file, then import it. `Question`, `Answer 1–4`, `Time Limit` and `Correct Answer(s)` are read, with numeric or answer-text correct answers.
  - **Gimkit spreadsheet.** Save Gimkit's CSV template as a file, then import it. `Question`, `Correct Answer` and `Incorrect Answer 1–3` are read; Gimkit's two-column term/definition template also works.

  Use **Preview** to see how many cards are ready and how many already exist before writing anything. The duplicate control then decides what happens: **Skip duplicates**, **Update the existing card** (body and deck/course are refreshed, while attempts, history, study status and your `## Notes` survive), or **Create a copy** with a distinct import key. After the import, an **Import report** shows the created, updated, copied, skipped and failed counts and lists each attempted card with its source row or file and the reason it was skipped or failed. CSV and question-set imports also identify the exact malformed row; `.apkg` imports list how many images or audio files stayed in Anki instead of dropping them silently.

  Imports write normal card notes and record `import_source`, `import_format`, `imported_on`, `import_batch` and `import_key`. A question-set or Quizlet PDF card also keeps `question_set`, `choice_1…choice_4` and `correct_choices` when the printed test has choices. Choose a fallback deck and optional course in the import dialog; for a question-set or Quizlet PDF file the file name is the default deck. Quizlet PDFs are read locally from their text layer, whether they come from the vault or the device picker; other PDFs and `.xlsx` files are not read by the deck importer, so save a spreadsheet as CSV first.
- **Export existing decks.** Use **Export** in the Cards view, **Export cards** under Settings, Cards, Decks, or the command **Cards: export to Quizlet, Anki package, Anki text, Mochi, LearnKit, Kahoot, Blooket or Gimkit**. Quizlet is written as tab-separated text. Anki is written as plain text with a header that carries the deck, note type and tags, so **File → Import** in Anki rebuilds the decks; cloze cards keep their `{{c1::…}}` markers, while images and audio are not bundled. Anki package (`.apkg`) is a real SQLite collection in a ZIP: decks, tags, Basic, Basic (and reversed), Cloze and multiple-choice notes are written, with choices on the front and the correct key on the back. Use **File → Import** in Anki; the package is text-only, so images and audio stay in the vault and the export warns when a card references them. Mochi is written as a `.mochi` archive: a ZIP with `data.edn` in Mochi's version-2 format, grouped by deck, with each card's front and back separated by `---`. In Mochi choose **Import → .mochi file**; images and audio are not bundled and the result warns when a card references them. LearnKit is written as a Markdown note of `T`/`Q`/`A`/`CQ`/`MCQ`/`G` blocks; open it in a vault with LearnKit installed and run **Sync all flashcards from the vault**, which adds its own anchors. The quiz formats are written as CSV in that platform's import layout. Kahoot may ask for `.xlsx`; open the CSV in Excel or Sheets and save it as `.xlsx` before uploading. Blooket's Set Creator and Gimkit's kit editor accept the CSV directly. Export files go under `Cards/exports` (or your configured card folder). The [property schema](docs/property-schema.md) documents every field and includes Dataview query examples for building your own views.
- **LearnKit notes.** Choose **LearnKit note or folder** in the import dialog. Pipe blocks (`T`, `Q`, `A`, `CQ`, `MCQ`, `O`, `RQ`, `OQ`, `G`) and single-line quick cards (`question::answer`, `question:::answer`, `cloze::...`) are read. LearnKit anchors are ignored, ordered questions become basic cards with the order on the back, and hotspot cards are skipped with a reason.
- **Sync with Anki (optional).** Install the **AnkiConnect** add-on in Anki desktop, then turn on **Enable AnkiConnect sync** under Settings, Cards, Decks. **Cards: sync with Anki (AnkiConnect)** first shows a read-only preview of creates, updates, pulls, conflicts, Anki-side missing notes and any opt-in local deletions; nothing is written until you press Apply. Choose **Report and keep local**, **Use the local card**, or **Use Anki's version** under **Conflicting edits**. Markdown, math, code, pipe tables and video embeds are converted to Anki HTML; referenced images, audio and video are uploaded through AnkiConnect. **Folder-based decks** is an optional setting that uses the first card subfolder when a note has no deck property, while frontmatter still wins. **Extra Anki tags** adds comma-separated tags to every note. **Card content authority** is **Two-way (merge)** by default; **Obsidian owns content** keeps card text, deck and tags authored in Obsidian, restores them over Anki text edits, and still pulls Anki's review scheduling. **Source backlink in Anki** appends a link to the exact source note, PDF page or heading (or the card note when no source is set) and is off by default. **Delete Anki notes for deleted local cards** is off by default and warns that moving a note can count as a deletion. Attempts, history and FSRS state remain local. The address defaults to `http://127.0.0.1:8765`; nothing is sent until you enable it. **Push only** remains available when you do not want to pull. **Push whole vault**, also available as **Cards: push the whole vault to Anki (AnkiConnect)**, ignores the current deck and course filter, previews every create before Apply, and uses the same one-way bridge without pulling Anki edits. **Omit text with a regex** removes matching text from both the Anki fields and the local sync comparison, so hidden markers do not create a false conflict. **Excluded tags**, **Excluded decks** and **Excluded folders** keep matching cards, a deck's subdecks, or every note in a vault folder and its subfolders, out of previews and syncs. **Excalidraw support** points `.excalidraw` embeds at the `.excalidraw.svg` files exported by the Excalidraw plugin; turn on that plugin's automatic SVG export and set the export folder when it is not beside the drawing. **Clear links to deleted Anki notes** is off by default; when enabled, a linked note that Anki no longer has loses its local `anki_*` identity and scheduling metadata after you apply the preview, so the card can be pushed again without changing its Markdown body. The [AnkiConnect real-UI smoke test](docs/anki-smoke-test.md) lists the manual checks for vault-wide push, backlinks, tables and media conflicts.
- **Portable note format.** Each note stays readable and editable without the plugin:

  ```markdown
  ---
  card_id: c-abc123
  item_type: card        # card | vocab
  deck: Spanish verbs
  course: SPAN 101
  card_type: basic       # basic | reversed | cloze | image-occlusion
  answer_mode: type      # optional: flip | type | speak
  grading_strictness: standard  # optional: strict | standard | lenient
  accepted_variants:
    - to speak
  source_note: Notes/lecture.md  # optional source anchor
  source_heading: Cell
  source_quote: selectively permeable
  source_context: The membrane is selectively permeable.
  ---

  ## Front
  hablar

  ## Back
  to speak
  ```

  Vocabulary notes use `item_type: vocab`, `language`, optional `part_of_speech`, and `## Term`, `## Definition`, `## Example` sections. Cloze cards use `==highlighted text==` or `{{c1::highlighted text}}` in `## Front`. Typed reviews add `last_typed_answer`, `last_verdict`, `verdict_override`, `graded_by` and `graded_on` beside the normal tracking properties.

Cards share the scheduler selected under **Settings → MCQ Tracker → Review** unless their deck overrides it under **Settings → MCQ Tracker → Cards → Decks**. A deck can use the simple ladder, clean-room SM-2 or FSRS with its own timing. Switching between schedulers stays lossless, and a card's first FSRS or SM-2 review is seeded from its existing history.

## PDF annotations

Right-click a PDF in the file explorer, or run **PDF: add an annotation**, to save a highlight quote, text box, form note or page note. Use **PDF: draw with pen or highlighter**, **Draw on PDF**, or **Draw on this PDF** to open the visual overlay: choose a page, pen, highlighter, text box or highlight, pick a colour and thickness, then draw, drag a highlight region, or place notes and save. Each highlight region can carry a note; drag a small box on an existing highlight to edit its note. Click an existing text box with the Text box tool to edit it, or use the eraser to remove text boxes and highlights. The plugin writes `name.annotations.md` beside the PDF and opens it with **PDF: open annotations**. The sidecar has a readable summary plus a fenced machine-readable block. Pen points, highlight rectangles and text-box positions are normalized to the page, so they stay in place when the page is rendered at another size. The sidecar also stores the PDF's content hash so a replaced download can be detected.

## Import questions from your files

Point the plugin at a file of practice questions and it creates one note per question, in the right format and with the passage included, in a new folder you name. It reads PDFs, PowerPoint decks (`.pptx`, `.pptm`), Word documents (`.docx`, `.docm`), OpenDocument text and presentations (`.odt`, `.odp`), HTML, RTF, Markdown, CSV and plain text. Run the command **Import questions from a file**, or press **Import questions from a file** on the practice home screen. This needs **Enable AI features** turned on.

1. Choose a file from your device or your vault.
2. Name the new folder. It's created for you, and it must not already contain files.
3. Choose who writes the notes (see below), optionally add properties for every note (test, course, section, domain, unit, difficulty), and optionally limit the pages or slides.
4. Press **Start import**.

**Two ways to do it**

- **OpenCode agent (desktop).** The agent reads the file and writes the note files itself, straight into the folder, the way you'd ask an AI agent to do it in a chat. Choose OpenCode as the AI backend in settings first. If the agent has to wait for permission to create files, allow file edits for your vault in OpenCode's permissions.
- **Direct AI (any device).** The plugin sends the file's text to your provider a few pages or slides at a time. The AI replies with finished notes, you review the list, untick anything you don't want, and the plugin creates the files.

**Properties from the document.** The import reads the labels the file prints for each question and saves them as note properties: the question's own ID (as `official_question_id`, kept separate from the plugin's own `question_id`, for example the `Question ID: 37e5c794` on SAT Question Bank pages), plus test, section, domain, skill and difficulty. In an SAT-style table, "Assessment" becomes `test` and the table's "Test" column becomes `section`. Difficulty is saved in lower case (easy, medium, hard). Any other labelled value (for example a score band) is kept as an extra property. Anything you type in the import window's property boxes is used for every note instead of what the file says, so leave a box blank to take it from the file. Properties the file doesn't show are left out, never guessed.

**Duplicates and a check of the result.** If a new note has the same official question ID as a note you already have, the review method skips it, and the agent method lists the repeats so you can move them to the trash in one click. When an import finishes, the plugin lists notes that need a look: no answer, no answer choices, or a missing figure. You can save that list as a note in the new folder.

**Passages that span pages.** One passage can have several questions, and those questions can be on the next page or several pages later. The agent reads the whole file, so it matches each question to its passage. With Direct AI, each batch also receives the passages from the batches before it, so questions at the top of a page still get the right passage. Either way, the full passage is copied into every note that uses it, and those notes share one `stimulus_id`.

**Pictures, charts and screenshots.** With **Capture figures and pictures** on (the default), the plugin draws each page, finds charts, diagrams, photos and screenshots, cuts them out as PNG files, and saves them in an `images` folder inside your new folder. Each one is marked in the PDF text at the spot where it appears, so the AI puts it where it belongs: in the passage, in the question, or inside an answer choice that is a picture. Pictures that no note ends up using are deleted. Turn on **Also save a picture of every page** as a backup for figures that don't cut out cleanly.

The marker is converted back into a normal image embed when the note is shown, so figures appear in practice, timed tests, results and card reviews and scale to the pane instead of overflowing it.

**Everything in one place.** The new folder holds the notes, a copy of the original file, and (for PDFs) the images folder.

**Answers the file doesn't give.** If the file shows the answer (including an answer key anywhere in it), that answer is used. If it doesn't, the AI works out the answer and writes an explanation, and the plugin:

- puts a notice at the top of that note saying the answer or explanation is AI-generated, with the **model name and the date**,
- records `answer_source`, `explanation_source`, `ai_model` and `ai_generated` in the note's properties, so you can find them later.

AI answers can be wrong. Check them, especially before relying on them to study.

**Limits**

- Scanned PDFs (pictures of pages) aren't supported because there's no text to read. Run them through text recognition (OCR) first.
- PowerPoint, Word and other non-PDF files are imported as text. Pictures and charts are only captured from PDFs; the text of a slide or paragraph is still imported.
- Figure detection looks for anything on the page that isn't text. It can miss a very faint figure, or cut a figure a little wide or narrow. Tables drawn with lines may come out as pictures. Questions that need a figure the plugin couldn't find say "[Figure not captured]" in the passage.
- The AI can make copying mistakes, so spot-check a few notes against the original file.
- Existing files are never overwritten, and a folder with files in it is refused.
- Try a few pages first (use the page range) to check quality and cost before you run a whole book. Direct AI makes one request per few pages, and the agent uses as many as it needs, so check your provider's pricing.

## AI assistant (optional, and off by default)

The result screen can show an **Ask AI** panel that explains a question, tells you why you missed it, writes a similar question, or quizzes you. Nothing is sent anywhere, and nothing is downloaded or started, until you turn on **Enable AI features** in settings. There are two ways to power it. Both use your own account.

### Option 1: Direct API (all devices, including phones)

The plugin sends a request to the provider you choose: Anthropic, OpenAI, OpenRouter, Google Gemini, a local Ollama server, or any OpenAI-compatible address you enter (for example LM Studio).

### Option 2: OpenCode agent (desktop only)

[OpenCode](https://opencode.ai) is a separate, free, open-source coding agent. The plugin can talk to a copy of it running on your own computer, which also lets the AI help with your notes (for example, drafting question notes). This works like the agent setup in other AI plugins, and you stay in control at each step:

- **Your own copy:** install OpenCode yourself and enter its path under **OpenCode program** (or leave it blank to use the one on your PATH).
- **Download from inside the plugin:** pressing **Download and install** (or the automatic first-time setup) shows a confirmation that names the source, version, size and folder. Only after you confirm does the plugin download the release from `github.com/anomalyco/opencode`, check its SHA-256 checksum (it refuses to install if no checksum is published or it doesn't match), and unpack it into `~/.question-tracker/opencode`, which is outside your vault. The first time you turn on the OpenCode backend, the plugin starts this setup for you automatically (unless it finds an OpenCode you already have), and you still see the confirmation before anything is downloaded. It never updates OpenCode by itself.
- **If the download is slow or stuck:** every step has a time limit now, and **Check again** in settings re-runs the status check. You can skip the plugin's download completely: get the zip from the OpenCode releases page in your browser, unzip it, and enter the path to `opencode.exe` under **OpenCode program**. Antivirus software often scans a large new program the first time it runs, which can add a minute or more.
- **Running it:** when you use the AI chat, the plugin starts `opencode serve` on `127.0.0.1` with a random port and a random password, so only your computer can reach it. It is stopped when Obsidian closes. Its own data (including any provider key you save here) lives in `~/.question-tracker/opencode-data`.
- **Tutor mode (default)** switches off OpenCode's file-editing and shell tools. **Agent mode** leaves editing on but keeps shell commands off unless you explicitly enable **Allow shell commands in Agent mode**; the Markdown edit review does not cover shell commands or files outside the reviewed notes. Keep your vault backed up before using Agent mode. The plugin also snapshots every question and card note before an Agent-mode message and puts back any review state the agent changes, so an over-eager edit cannot rewrite attempts or scheduling.

### Models, limits and capabilities

All AI features share one request path, so you configure the provider once. Under **Settings → MCQ Tracker → AI → Models and request limits** you can:

- **Pick a model per feature.** Chat, generation and import, answer checking, typed-card grading and vision OCR can each name their own model. Leave a field empty to use the backend-wide model. A saved per-feature model is also the name recorded in notes when that feature writes one.
- **Cap one reply.** **Reply token cap** is a hard ceiling for a single reply, including features that ask for more. The default is 4,000.
- **Cap a day or a run.** **Daily request cap** stops requests after that many in one local day; **0** means no cap. **Per-run request cap** limits one burst of work and resets after ten idle minutes, so a long import cannot run away. Both counters and the rough token estimate are kept on this device, not in your vault.
- **See what the backend can do.** Direct AI reports page images, JSON replies, live progress and file tools. OpenCode reports the same, except that it cannot receive page images through this plugin. A feature that needs a missing capability explains the problem instead of sending a request that will fail.
- **Read what each feature sends.** The same settings page lists the content for chat, generation and import, answer checking, typed-card grading and vision OCR in one place.

A refused capability or an exhausted cap spends nothing. Requests that reach the provider count even if the provider then fails, which keeps a retry loop from silently bypassing the cap. Keys stay in Secret Storage where Obsidian provides it, and are never written to logs.

### Tutor roles and commands

Choose **Private tutor**, **Socratic tutor**, or **Language partner** under **Settings → MCQ Tracker → AI → Tutor role**, or from the role menu in a chat. The same role is used by the review panel and the general assistant, with either AI backend.

Type a command at the start of a message to steer the next reply: `/guide`, `/quiz`, `/confuse`, `/gap`, `/predict`, `/feynman`, or `/mock`. The **Tutor commands** menu inserts one for you. They are prompts to the same assistant, not a separate feature: `/feynman`, for example, asks you to teach the idea back before the assistant points out the gaps.

### Study context (read-only)

Three default-off toggles under **Settings → MCQ Tracker → AI → Study context** let the assistant see aggregate study state: **Practice statistics** (question and attempt counts, accuracy, the weakest skill with at least three attempts), **Due work** (due and unseen questions, due and new cards), and **Next exam** (the next calendar exam, its date and countdown). Only the selected lines are added to the chat request, and no note text, question text, answers or personal notes are included. Nothing is built or sent while AI features are off, and the toggles stay off until you turn them on.

### Undoing an AI-generated write

**Generate practice from this lecture** still shows a preview and writes only when you press **Create these**. The files it creates are also recorded in a device-local undo journal. Run **AI: undo the last generated practice notes** to remove the notes created by the most recent confirmed AI generation. The journal stores paths, not note contents, is capped at 20 records, and is never synced. Heading-based card extraction without AI is not recorded. AI course-note summaries use the same command: the summary is wrapped in markers when the note is created, and undo removes only that summary block plus its `ai_summary`/`ai_model` properties, keeping the extracted page text. Older course notes without those markers are not changed.

### Generating practice from a weak spot

Run **AI: generate practice from a weak spot** to open a preview-first generator. Pick one of your weakest practised skills, choose multiple-choice questions or flashcards, and review every draft item before pressing **Create these**. Only the skill name, optional course, format and count are sent; question text, answers and notes are not included. Confirmed items go to the normal question folder or deck and can be removed with **AI: undo the last generated notes**. Every generated multiple-choice answer is also checked by a second call that does not see the key; the preview says how many were checked and dropped.

### Current note and selection in the assistant

The general assistant has two switches above its quick actions: **Include current note** and **Include selection**. Both are off by default and reset on **New chat**. While off, the assistant never reads a note for context. While on, it receives the active note's body with frontmatter removed (capped at 6,000 characters) and, separately, the current editor selection (capped at 2,000 characters). The note and selection are labelled as untrusted data, and the prompt tells the model not to follow instructions found inside them or change tracking properties. Turning a switch off stops that text from being sent on the next message.

### Review history and syncing

Every review appends one row to a note's `history` property: timestamp, result, seconds, answer, confidence, error tag and a unique attempt id. A retry with an id that is already present is ignored, so replaying an offline queue cannot count the same attempt twice. New rows use a second-level timestamp.

If a phone and a desktop edit the same note, run **Repair review counters from history** after Obsidian Sync finishes. It recomputes attempts, correct count, total time, streak and the latest-attempt fields from the rows. The next review date is not changed. Rows written by older versions have no attempt id and still work; only new rows carry one.

### Reviewing card updates before import

When an import would update an existing card, choose **Update the existing card** and press **Preview**. The dialog lists each affected note and the fields that will change: front, back, deck or course. Tick **I reviewed these updates** before importing. Review history, attempts, scheduling and notes are not changed by the update.

### AI write protections

AI-generated notes are written only inside your configured question folder, card folder or deck folders. The plugin checks the destination in code before creating a note; a path outside those folders is refused. When an import updates an existing card, the plugin also checks the review state before writing: `attempts`, `correct_count`, `streak`, `history`, `next_review`, `srs`, study status and the other tracking properties cannot change. The body and the card's deck/course can change, but the learner's review history is a lock, not a prompt request.

Agent mode adds a second layer: before each request the plugin snapshots the protected properties of every question and card note, and after the reply it restores any property the agent changed. The chat shows a notice naming how many notes were repaired.

Agent edits themselves are also staged. Before the request, the plugin snapshots the notes in your question, card and deck folders plus the current note. When the agent finishes, those writes are paused and removed from the note files, and a review window shows a line-by-line diff. Tick the files you want and press **Apply selected**; closing the window discards the agent's changes. If a note changed while you were reviewing, the plugin skips it instead of overwriting your edit. **AI: undo the last agent edits** restores the previous contents of the files you applied. This review is on by default under **Settings → MCQ Tracker → AI**. The protected-property restore still runs, so review history and scheduling remain a separate lock.

Lecture transcripts and imported PDFs are labelled as untrusted data in the generation prompts. Instructions found inside a document are not treated as commands.

### Checking AI-written answers

When the AI writes a multiple-choice answer, the plugin can make a second independent call that sees the question and choices but never the stored key or explanation. A disagreement is marked `needs_review: true`, gets a visible warning banner in the note and in practice, and records `verified: false`, `verified_by` and `verified_on`. Choose **Flag mismatches for review** (the default) or **Drop mismatched items** under **Settings → MCQ Tracker → AI**. The same check runs on AI-written PDF-import answers and on questions generated from a weak spot or a lecture. You can also run **AI: verify the answer for this note** at any time. Answers with no letter key, such as free-response items, are recorded as unchecked rather than silently treated as verified.

Numeric answers can also be checked locally without a model. Add a `calculation` property with a literal arithmetic expression (for example `calculation: 6 * 7` for `answer: 42`), or use a parameterized `answer_formula`. Import finalization runs the check automatically, and **Verify this answer by calculation** or **Verify numeric answers by calculation** can run it on demand. The bulk command computes every check first and shows the affected notes and property changes; nothing is written until you confirm the selected notes, and a note edited during the review is skipped rather than overwritten. A disagreement sets `needs_review: true`, writes `verification: mismatch`, `verified_by: calculation`, `verification_method: computed` and a visible warning; a match records `verified: true` and removes an older warning. The evaluator is restricted and never uses `eval`.

### What is disclosed and sent

- **Network use:** requests to your chosen AI provider; requests to `api.github.com` and `github.com` only to set up OpenCode, which happens the first time you choose the OpenCode backend (the plugin shows what it will download, from where, and where it will go, and asks you to confirm first; if you say no it won't ask again) or when you press **Download and install**; and local requests to the OpenCode server on your own computer.
- **Document import:** the text of the pages or slides you choose is sent to your AI provider (Direct AI), or to your local OpenCode agent, which sends it to the provider you set up in OpenCode. Nothing is sent until you press **Start import**. The agent can create files in the new folder only if you allow it in OpenCode, and the plugin writes a temporary text copy of the file into that folder that it deletes when done. The file you choose is copied into that folder, and cut-out PDF pictures are saved in an `images` folder inside it.
- **What a chat request contains:** the question text, any passage, the answer choices, your answer, the correct answer, the explanation, your notes for that question, and your past mistake types for it. If you enabled any **Study context** toggles, it also contains those aggregate lines; no note text is added by them. In the general assistant, note text and selected text are added only while **Include current note** or **Include selection** is on for that chat. In the general assistant or Agent mode, OpenCode may also read other files in your vault if you ask it to.
- **Typed card answers:** when the local card grader is unsure and **AI fallback for typed answers** is on, only the card front, the stored reference answer, your typed answer and the strictness are sent. If that request fails, the answer stays in a device-local queue until AI grading succeeds or you self-grade it. Turning AI features off stops all grading requests.
- **Files outside your vault:** only the OpenCode install folder and data folder named above, and only if you use Option 2.
- **Programs started:** only `opencode` (and, during a download, your system's `tar` or PowerShell to unpack it), and only on desktop.
- **API key storage:** when Obsidian provides Secret Storage (1.11.4 and later), a Direct API key is saved there instead of `data.json`. Existing plain-text keys are moved into Secret Storage the next time the plugin loads, and the plain-text copy is removed. Secret Storage may be per device, so choose or create the secret on each device you use. On older Obsidian versions the key falls back to plain text in the plugin's `data.json` inside your vault; anyone who can read the vault can read it, so keep that file out of public repositories and shared vaults. A key you enter for OpenCode is saved in OpenCode's own `auth.json` outside your vault, with owner-only permissions.

## Math and chemistry

Fractions, exponents, matrices, integrals and other MathJax notation render in the question, stimulus, answer choices, explanation and review screen, in timed tests, cards and the AI chat. Answer choices go through the same Markdown renderer as the stem, not a plain-text label.

Simple `\ce{...}` chemistry is made readable even without an mhchem setup: formulas such as `\ce{Ca(OH)2}`, charges such as `\ce{SO4^2-}`, and equations such as `\ce{2H2 + O2 -> 2H2O}` are converted at display time. More complex mhchem syntax, including labels, brackets and `\text{}`, is left exactly as written for an mhchem or Extended MathJax setup. Notes are never changed. The audit and the visual checklist are in [docs/math-rendering-audit.md](docs/math-rendering-audit.md).

## Settings

Settings are grouped by module, then by tab. **Global** has Modules and General; **MCQ Tracker** has Practice, Review, Daily quiz, AI and About; **Cards** has Decks, Review and About; **Calendar** has About, Schedules & Sync, Notes & Templates, Exclusions, Appearance & Colors, and Language & Region.

- **Global → Modules** is one switch per module: **MCQ Tracker** (on by default), **Cards and vocabulary** (off by default), **Calendar** (off by default) and **AI features** (off by default). Turning a module off keeps its settings and your notes. It closes that module's open tabs and hides its ribbon button; using one of its commands anyway shows a notice that points back here.
- **Global → General** holds the plugin-wide options: whether the plugin shows its ribbon icons, and whether the practice view opens when Obsidian starts.
- **MCQ Tracker** covers the question folder, folder-filter style, review intervals or FSRS scheduling, desired retention, the global and per-course Known snooze lengths and manager, the optional study-cards skin, the daily quiz count and folders, mistake types, confidence labels, explanation default, mobile timer pause, AI backend and provider details, per-feature models, daily and per-run request caps, and saved presets.
- **Cards** covers the default deck, the new-card folder, deck folders and course tags, a per-card scheduler override, off-by-default due/new markers in the file explorer, cards per review session, answer mode, grading strictness, the optional AI fallback for typed answers, flashcard-generator defaults (count, layout and hidden inserted blocks), opt-in plain Markdown cards and their folder, Anki preview/media sync with regex omission, tag/deck exclusions, Excalidraw SVG support, opt-in stale-link cleanup, Obsidian content authority and exact source links, folder-based decks, opt-in deletion of linked Anki notes, and whether to review due-and-new or all cards.
- The calendar's **Appearance & Colors** tab includes a maximum width setting (`0` fills the pane), class colors, break markers, and the study-slot buffer.

## Privacy

- No telemetry, analytics or ads.
- To find your questions, the plugin lists the notes in your vault and checks each one's properties through Obsidian's metadata cache. It reads and writes only notes that have a `question_id`, and only inside your vault.
- The plugin reads and writes notes inside your vault. The only things it touches outside your vault are the optional OpenCode folders described above.
- The running timer is stored on your device (vault-scoped local storage), not in your notes.
- The only network requests are the optional AI and download requests described above, and only if you enable them.
- If you add a calendar feed URL, the plugin requests that URL (and only that URL) to download the `.ics`. Local `.ics` files are read from your vault. Calendar content is never sent anywhere.

## Development

The plugin is written as small modules in `src/` and bundled into the single `main.js` that Obsidian loads, by a script with no dependencies.

```
npm run build   # write main.js from src/
npm test        # run the tests (they include a check that main.js is up to date)
```


Edit files in `src/`, run `npm run build`, and commit both. The tests run on plain Node with a stand-in for the `obsidian` module (see `tests/helpers`), and cover filters, folders, statistics, the error log, the import rules and checks, grading and scheduling, calendar parsing, recurrence, filtering, note templates and export, and smoke tests that run the plugin's views and commands. GitHub Actions runs them on every push and before each release.

## Support and issues

Please report bugs and ideas on the GitHub issues page for this repository.

## License

[MIT](LICENSE). The calendar module contains code adapted from University Schedule and Calendar (MIT, Cesemess), and the optional FSRS scheduler uses ts-fsrs 5.4.1 (MIT, Open Spaced Repetition). The optional SM-2 scheduler is an original clean-room implementation; no third-party scheduler code is bundled for it. See [NOTICES.md](NOTICES.md).
