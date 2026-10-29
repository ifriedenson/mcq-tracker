# MCQ Tracker

Serve practice questions from your own notes, grade your answers, and keep a full study record in each note's properties: time, confidence, mistake type, streak and the next review date. It works on desktop and mobile, and the AI tutor is optional and off by default.

## Features

- **Exam-style practice screen.** The passage sits on the left, and the question, answer choices, confidence buttons and Submit sit on the right. On narrow screens the passage stacks above the question.
- **Automatic grading** for multiple-choice and student-produced-response questions, or self-grading when a note has no answer key.
- **Timer** with pause. It survives closing the app, and on mobile it can pause itself when you switch apps.
- **Review after answering.** See the question and choices again with your pick and the correct answer marked, plus an explanation you can show or hide (the default is a setting).
- **Spaced review.** Correct answers come back after 1, 3, 7, 21, then 60 days (editable). Misses come back tomorrow.
- **Known and Exclude.** Hide a question or card you already know for a configurable snooze, or exclude it from every queue without deleting the note. Both actions are undoable, and **Manage known and excluded items** lists, searches, filters and restores them.
- **Exam-aware review.** When the calendar is on and an upcoming exam matches a question's or card's course, the next review is brought forward to the day before the exam. It never extends an interval, and items without a matching course or exam are unchanged.
- **Optional FSRS scheduling.** Turn on a memory-model scheduler in settings. It estimates difficulty and stability per question, aims for your chosen recall probability, and replays existing history once so you do not start from zero. The simple 1/3/7/21/60-day ladder remains the default and switching back is lossless.
- **Offline-tolerant results.** If a note cannot be written for a moment (a sync lock, a removable drive, or a mobile storage hiccup), the attempt is kept in a local outbox. The result screen still works, error tags stay attached, and the queue is retried on startup, when the device comes back online, and with **Retry saving offline practice results**.
- **Mistake tracking.** After a miss, tag why (careless, content gap, misread, ran out of time, guessed, or your own labels).
- **Flexible filters.** Filter by folder (including all its sub folders), course, test, section, domain, skill, unit and difficulty, for example folder + skill + difficulty together. You can pick several values in one field (OR), and add extra filter sets that are combined with OR. Save any combination as a **preset**.
- **Counts and folder search.** Every filter button shows how many notes it holds. The Folder filter switches to a type-ahead search box when you have many folders (or whenever you choose), and the choice is a setting.
- **Weak spots.** Accuracy and average time by skill, domain, difficulty and folder, a bar chart of your accuracy by week, an up or down note on each row when your last two weeks differ from before, and a **Practice my weakest skill** button plus a Practice button on every row.
- **Error log.** Questions you missed, grouped by the reason you gave, with a button to practice each group.
- **Analytics dashboard.** Insights → Overview collects attempts and accuracy, confidence calibration, a review-retention trend, a practice-derived grade snapshot, skill/domain/difficulty breakdowns, a 12-week study heatmap, study time by course, your weakest skills with one-tap practice, cards due, and the next exam plan. All of it is calculated locally.
- **Dashboard widgets in notes.** Put a `mcq-dashboard` block in any note to embed one metric or the whole dashboard, optionally scoped to a course.
- **Timed test.** Pick a number of questions and minutes, optionally restrict the bank to a question range such as 1–20, answer with a countdown and no explanations, then see your score, a by-skill breakdown, and a full review. If you close Obsidian mid-test, it picks the test back up when you reopen it (and marks it if the time ran out meanwhile).
- **Practice from your files.** Right-click any folder that holds questions and choose **Practice this folder**, or use the commands. Find any question by its official ID.
- **Pick modes:** smart weighted mix, adaptive difficulty, due for review, never attempted, missed, flagged, or pure random. Adaptive difficulty favors questions near the learner's current level based on past accuracy and streaks.
- **Quick Practice:** start a 2, 5, or 10 minute session, or a 5, 10, or 20 question session, using your current filters. It saves the queue so you can resume after closing Obsidian.
- **Daily quiz (optional, off by default).** Get a small set of questions once a day from the folders you choose, with a separate completion streak and best streak. It uses the same queue and scheduler, stays on your device, and sends no notifications. Start it from Settings, MCQ Tracker, Daily quiz, Today, or the command palette.
- **Study cards (optional, off by default).** Review the same MCQ notes as flip cards or choice cards, using your current filters and the same scheduler. No duplicate notes or second deck.
- **Today:** a phone-sized start screen with due and new counts, the next class or exam, and one **Start 5 minutes** button that opens Quick Practice.
- **Notes box** on the result screen, saved into the note.
- **PDF annotations.** Add a highlighted quote, text box, form note or page note to any PDF in the vault. Each PDF gets a readable Markdown sidecar beside it, keyed by a content hash so a replaced file is noticed; the visual pen/highlighter overlay is still future work.
- **Import questions from a file:** an AI agent (or your own AI key) turns a PDF, PowerPoint deck, Word file, OpenDocument, HTML, RTF, Markdown, CSV or text file into properly formatted question notes in a new folder, and labels any answer it had to write itself with the model and date (see [Import questions from your files](#import-questions-from-your-files)).
- **Optional AI tutor** through your own API key, or a local OpenCode agent (desktop) (see [AI assistant](#ai-assistant-optional-and-off-by-default)).
- **Cards and vocabulary (optional module, off by default).** Create flashcards, reversed cards, cloze cards, image occlusion cards and vocabulary notes as ordinary Markdown notes. Organize them into decks, inherit a course tag from a deck or folder, and review them with Again/Hard/Good/Easy using the same ladder or FSRS schedule as your questions (see [Cards and vocabulary](#cards-and-vocabulary-optional-module-off-by-default)).
- **Study plan and cram mode.** When the calendar has an upcoming exam, Today builds a plan for matching courses: days left, readiness, due/new counts, card backlog and the weakest skill. **Start 10 min** practices the plan; **Cram 10 min** puts most-missed questions first and skips long-interval reviews unless an item was missed.
- **Focus timer and study log.** Start a 15, 25 or 45 minute session tied to a course, pause and resume it, and log the result. Manual study entry covers offline work. Today shows today's minutes against a configurable daily goal, the current streak, the last seven days and your top courses.
- **First-run welcome guide.** A short three-step guide on first install: what the plugin does, a preset chooser that sets the real module switches, and buttons for import, practice, Today, cards, calendar and settings. It is shown once per device, never blocks startup, stores progress locally and can be reopened from the command palette or Settings, Global, About.
- **Modules you can switch off.** Settings, Global has an on/off switch for each module (MCQ Tracker, Cards, Calendar and AI features) plus the plugin-wide options, so the parts you don't use stay out of the way.
- **Reference (optional module, off by default).** A local formula sheet, constants list and unit converter in one view. It works offline, adds no data to your vault, and can be hidden automatically while a timed test is running. See [Reference](#reference-optional-module-off-by-default).
- **Calendar (optional module, off by default).** Import an `.ics` schedule from a file or a public feed, see classes and exams in a month grid, day timeline, live countdown and upcoming-exam countdowns, and create a note for a class in one click. Free periods can start a short Quick Practice session (see [Calendar](#calendar-optional-module-off-by-default)).

## Quick start

1. Install the plugin and enable it (see below).
2. Open the practice view from the ribbon (graduation cap icon). With no questions in your vault yet, it offers **Import files**.
3. Press **Import files**. The first time, you'll choose how to connect an AI model (your own API key, or OpenCode on desktop), then pick a file and a new folder name. See [Import questions from your files](#import-questions-from-your-files).
4. When the import finishes, press **Practice all** to start. Already have question notes? Add a `question_id` property to each (see [What counts as a question](#what-counts-as-a-question)) and the practice view finds them.

## Study plan and cram mode

The **Study plan** card appears in Today when the calendar is on and an upcoming exam matches question or card courses. It shows the exam countdown, readiness score, due and new questions, cards due, practice coverage, accuracy and weakest skill. **Start 10 min** opens Quick Practice with the exam-scoped pool; **Cram 10 min** orders the most-missed and due items first and omits long-interval reviews that have not been missed.

The plan is recalculated every time Today renders, so a missed day does not leave a stale checklist. It uses the existing scheduler and queue; there is no second review system.

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

`metric` can be `overview`, `stats`, `heatmap`, `calibration`, `retention`, `weak`, `grades`, `courses` or `exam`. `field: domain` or `field: difficulty` changes the breakdown used by the `weak` and overview widgets. `weeks` is clamped to 1–26. `course` filters questions, cards and study sessions by the course property, and `title` overrides the heading. The block has a **Refresh** button and is read-only except for the **Practice** buttons on weak skills.

## Focus timer and study log

Open **Today** and use the **Focus** card to start a 15, 25 or 45 minute session. The timer is derived from timestamps, so pausing, closing Obsidian or switching devices does not lose the elapsed time; the running state is stored locally per device. Finishing writes a study session into the plugin's study log, and **Log study time** adds offline study manually with a date, minutes, course and note.

Set the daily goal under **Settings, Global, General**. Study totals and streaks are local, and practice time already recorded on individual questions remains separate.

## Welcome guide

On a fresh install, **MCQ Tracker** opens a welcome guide after the workspace is ready. Choose a preset such as **SAT / AP-style prep**, **University courses**, **Language learning**, **STEM problem sets**, **Just flashcards** or **Everything off**; the result is written to the ordinary module switches, so Settings, Global, Modules shows the same state. A module that is off keeps its notes, cards, schedules and settings.

The how-to section has working buttons for importing questions, opening practice, opening Today, creating a card, opening the calendar and opening settings. It also records optional step checks on this device only. Reopen it any time with **Open welcome guide**, or from **Settings, Global, About**. The feedback survey and donation links are intentionally not part of this release; no network request is made by the welcome.

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
- `question_type` can be `mcq`, `spr` (student-produced response), or anything else for self-grading. Free text such as "Multiple choice (4 choices)" is understood too.
- Properties the plugin reads: `course, test, section, domain, skill, unit, difficulty, question_type, choices, answer, target_seconds, stimulus_id`.
- Properties the plugin writes: `result, date attempted, first_attempted, attempts, correct_count, streak, time_spent_total, last_time_spent, last_answer, last_confidence, last_error_type, flagged, next_review, last_attempt_id, srs, scheduler, history`, plus the Known/Exclude fields `study_status, known_days, known_until, excluded_on, excluded_reason` when you use those actions. `srs` and `scheduler` are populated when FSRS schedules a review (`srs` may be empty if you add tracking properties to notes first).

Run the command **Add missing tracking properties to all question notes** to add the writable properties to notes that don't have them yet.

## Using it

1. Open the practice view from the ribbon (graduation cap icon) or with the command **Open practice view**.
2. Pick a preset or set filters. The **Folder** filter lists every folder that holds questions; picking a folder also includes its sub folders. Tap several values to allow any of them. Tap **+ Add another set (OR)** to combine groups, for example "Unit 3 or 4 of a history course" OR "SAT, Reading and Writing, Inferences".
3. Choose how to pick questions and press **Start**. Or press **Timed test** or **Weak spots & errors** on the same screen.

   To study one note only, right-click a question in the file explorer and choose **Practice this note only** (or run the command with that note open). A banner on the practice screen names the note; **Practice all notes** clears the limit.
4. Choose an answer, say how sure you are, and **Submit**.
5. On the result screen you can review the question, show or hide the explanation, tag why you missed it, write notes, flag the question, open the note, or ask the AI. Press **Next question** to continue. **Known** and **Exclude** are beside the answer controls and stay available after you answer.

### Review scheduling

After a correct answer with confidence 2 or 3, the next review is 1, 3, 7, 21, then 60 days out (editable). A miss resets the streak and returns tomorrow. A correct answer rated "Guessing" doesn't extend the streak and returns in 2 days.

To use **FSRS** instead, open **Settings → MCQ Tracker → Review → Scheduler** and choose **FSRS (memory model)**. FSRS stores a compact state in the note's `srs` property; `history` stays the source of truth. The first time a question is reviewed, its existing history is replayed to seed that state. Existing `next_review` dates are not changed until that review. You can choose 85%, 90%, or 95% desired retention. Switching back to the ladder keeps the FSRS state and resumes the old streak-based schedule.

When an upcoming calendar exam matches the note's `course`, the scheduled `next_review` is capped to the day before the exam (or today when the exam is today). The cap is applied after the ladder or FSRS and never lengthens an interval. The applied date, exam name and exam date are recorded in `exam_cap`, `exam_cap_name` and `exam_cap_exam_date`; items with no course or no matching exam are left alone. The result screen explains when a cap moved the date.

Each `history` entry is stored as `date|result|seconds|answer|confidence|error_type`.

### Known and excluded items

Every practice and card review screen has **Known** and **Exclude** buttons beside the answer controls. They hide an item without deleting its note or changing its review history:

- **Known** hides the item for **Known snooze (days)** (14 by default; Settings → MCQ Tracker → Review). It returns to the due queue on that date. The note keeps `study_status: known`, `known_days` and `known_until`.
- **Exclude** removes the item from practice, Quick Practice, timed tests, card reviews and the merged due queue until you restore it. The note keeps `study_status: excluded`, `excluded_on` and `excluded_reason`.
- The confirmation notice has an **Undo** button. You can also open **Manage known and excluded items** from the notice, Settings → MCQ Tracker → Review, Today, or the command palette to search the list, filter by course, open a note, or restore it.
- Hiding an item never records a wrong answer, changes its streak or changes its schedule. Excluded notes stay in the vault, are included in exports, and are still found by search and Dataview.

### Study cards (optional)

**Settings → MCQ Tracker → Practice → Study cards skin** adds a Quizlet-style way to review the same question notes. It is **off by default**; turning it on adds a **Study cards** button to the practice home screen and the command **Open study cards**.

- **Flip cards** show the passage and question first. **Show answer** reveals the answer and explanation; **Still learning** records a miss and **Known** records a correct recall, so the next review is scheduled exactly as in normal practice.
- **Choice cards** show the answer choices. Pick one, press **Show answer**, and the correct choice and your choice are marked. The selected letter is written to the same `history` and attempt properties as ordinary practice.
- A session uses the current filters, pick mode, hidden-item rules and scheduler, and is capped at 20 cards. A question with no choices or no answer key automatically falls back to a flip card.
- The skin never creates or changes a second note, deck or scheduler. Turning it off restores the practice home screen unchanged.

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
- Retry saving offline practice results
- Open cards
- Create a flashcard or vocabulary card
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
- Rename old source_question_id properties to official_question_id (one-time clean-up for notes imported before the rename)

## Reference (optional module, off by default)

Turn it on under **Settings, Global, Modules**, then open **Reference** from the ribbon or the command palette. The view has three tabs:

- **Formulas** — searchable formulas for math, physics, chemistry and biology, with a subject filter.
- **Unit converter** — length, mass, volume, temperature, time, speed, energy, pressure, angle and digital data.
- **Graph** — plot `y = f(x)` with a restricted local expression parser. It supports `x`, `pi`, `e`, the usual trig and log functions, and `+ - * / ^`. It does not use `eval`, a calculator service or a Desmos key.
- **Periodic table** — all 118 elements in a tap-to-open grid, with atomic number, approximate mass, category, period and group.
- **Constants** — common physical and chemical constants with units.

The graph parser only accepts the listed names and operators; an unknown name or a pasted script is rejected rather than evaluated. The periodic table data is a factual compilation written for this plugin, not a third-party dataset. The panel is local: it does not read notes, call a model or make a network request. **Hide while a timed test is running** is on by default, so it stays out of a closed-book section; turn it off under Settings, Reference if your test allows a reference sheet. Formulas are study aids, not official exam material; check the sheet supplied with your course and exam year.

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

The class-detail parsing, the `.ics` parser and the calendar presentation are adapted from [University Schedule and Calendar](https://github.com/Cesemess/obsidian-uni-calendar) (MIT, Cesemess). The month card, timeline and event cards keep that plugin's markup and stylesheet rules so the two calendars look the same; see [NOTICES.md](NOTICES.md) for the pinned version and the list of changes. Labels are English-only for now, and the note template is plain text rather than a visual builder.

## Cards and vocabulary (optional module, off by default)

Turn on **Cards** under Settings, Global, Modules. Cards are first-class notes, not a separate database: each one has its own `history`, `next_review` and—if you use FSRS—`srs` state, so the same scheduler handles questions and cards. The module is off by default and touches nothing until you create or review a card.

- **Create a card** from the Cards view, the command palette, or Today. Choose a flashcard, reversed card, cloze card, or vocabulary item, and pick a deck. A deck can have a folder and a course; cards in that folder inherit the course. New cards go under **New card folder** (default `Cards`) in a subfolder named after the deck, unless the deck specifies its own folder.
- **Extract cards from a note.** Right-click a lecture or source note and choose **Extract cards from this note** (or run the command with it open). The preview reads question/answer headings, `Term: definition` and `Term — definition` lines, “X means Y” sentences, two-column Term/Definition tables, `==highlights==` and `{{c1::cloze}}` marks without an AI key. Nothing is written until you review the pairs. The note gets `flashcards: true` after a successful extraction; set `flashcards: false` to stop extraction for that note.
- **Image occlusion cards.** Use **Image occlusion** in the Cards view, or the command **Cards: create image occlusion cards**, to make one card per mask on a diagram already in your vault. Enter each mask as `x, y, width, height, label`; coordinates are percentages of the image, so they resize with it. Each mask becomes its own note with `card_type: image-occlusion`, `image`, `mask_x`, `mask_y`, `mask_w`, `mask_h` and `mask_label`. The review screen covers the mask and lifts it when you reveal; these cards always use flip review.
- **Review** by revealing the answer and rating **Again**, **Hard**, **Good**, or **Easy** (keys 1–4; Space or Enter flips when using Flip mode). The rating maps directly to the simple ladder or FSRS. Reviews use the same offline outbox as question attempts, so a temporary vault or sync lock does not lose a rating.
- **Type or speak an answer.** Set **Answer mode** under Settings, Cards, Review to **Type** or **Speak**. Type grades the answer locally against the stored answer, ignores case, accents, articles and punctuation at standard strictness, accepts small typos, numbers and `accepted_variants`, and shows the missing key words. **Speak** uses the same text box with your device's dictation or microphone key; no audio leaves the device. The suggested rating is Good/Hard/Again, and choosing another rating records an override. A card's `answer_mode` or `grading_strictness` property, or its deck's setting, overrides the global default.
- **Optional AI second opinion.** **AI fallback for typed answers** under Settings, Cards, Review sends only an inconclusive answer to your configured provider, with the card front, the stored answer, your answer and the strictness. A valid reply is mapped to Good/Hard/Again and keeps `graded_by: ai`, the confidence and the feedback in the note. If the request fails, the attempt waits in a device-local queue instead of being counted wrong; pending grades appear in **Today** and at the top of the **Cards** list, with a **Review** action beside each card and a **Grade now** button; the **Cards: grade pending typed answers** command retries them too. The plugin also retries when Obsidian starts. Rating the card yourself records `graded_by: self` and removes it from the queue. The learner's answer is treated as untrusted data, and the grader has no tools or access to other notes.
- **Decks** are managed under Settings, Cards, Decks: set a default deck, a folder, a course, an answer mode and grading strictness for each deck, add or remove decks, and see per-deck due/new counts. Cards with a `deck` property are grouped even if the deck has no settings entry; use **Save deck** to give it a folder or course.
- **One due queue.** Today and the command **Open today's due queue** show one list across due questions, flashcards and vocabulary. Each row opens the note or starts the right review; the existing practice and Cards buttons remain available for a full session. The list is merged, but the question and card review screens are not interleaved yet.
- **Import existing decks.** Use **Import** in the Cards view, **Import cards** under Settings, Cards, Decks, or the command **Cards: import existing decks**. Twelve sources are supported:
  - **Spaced Repetition notes in this vault.** Pick a folder; the importer reads `Q::A`, reversed `Q:::A`, multiline `?` and `??`, `==cloze==` / `{{c1::cloze}}`, and `#flashcards/deck` tags. Files without a flashcard tag only contribute explicit `::` cards, so ordinary notes are left alone.
  - **Mochi Markdown folder.** In Mochi, export the deck as Markdown, unzip it into a vault folder, then choose that folder. Each card file uses `---` or `***` between its sides, and the folder name becomes the deck unless you enter a fallback deck. Mochi's native `.mochi` ZIP and CSV exports are not read directly.
  - **Anki plain-text/CSV export.** In Anki, use **File → Export → Notes in Plain Text** and include the deck column. Headers such as `#separator`, `#html`, `#notetype column`, `#deck column` and `#tags column` are understood; basic HTML is converted to Markdown. Binary `.apkg` files are not opened, so export the notes to text first.
  - **Quizlet text export.** Open the set in Quizlet, choose **Export**, keep **Tab** between term and definition and **New line** between cards, then save the copied text as a `.txt` or `.csv` file in the vault. Comma, tab and ` - ` separators plus semicolon or newline rows are auto-detected; quoted CSV and two-line exports work too. Quizlet does not include a deck name, so choose a fallback deck in the dialog.
  - **Moodle GIFT.** Save the course's GIFT text as a `.txt` or `.gift` file in the vault. Each question uses the usual `::Name::Question{=Correct ~Wrong}` form; multiple choice, true/false, short answer and numeric answers are read. Each question becomes one basic card with the correct answer on the back, and matching questions are skipped explicitly rather than guessed.
  - **Moodle XML quiz bank.** Export the question bank as Moodle XML and save the `.xml` file in the vault. Multiple choice, true/false, short answer and numerical questions are read; matching, essay, description and cloze questions are skipped.
  - **QTI quiz bank.** Export the bank as QTI XML. QTI 1.2 response labels and QTI 2.1 simple-choice items are read, with the correct choice mapped to the card back.
  - **CrowdAnki JSON.** Export the deck as CrowdAnki JSON and save the `.json` file in the vault. Nested deck names, note fields, Anki tags and cloze models are read; CrowdAnki does not include review history.
  - **Generic CSV / TSV.** Choose any `.csv`, `.tsv` or `.txt` table. The delimiter is detected, common headers such as `Term`, `Definition`, `Deck`, `Course`, `Tags` and `Notes` are mapped automatically, and a preview shows the first rows before anything is written. Map or ignore any column yourself; the mapping is remembered for the same headers. Headerless files use the first two columns, and a row without both a front and a back is reported and skipped.
  - **Kahoot spreadsheet.** Save the Kahoot template as CSV, then import it. The `Question`, `Answer 1–4`, `Time limit` and `Correct answer(s)` columns are read; the correct answer can be a number (`2`) or several numbers (`1,3`).
  - **Blooket spreadsheet.** Save Blooket's CSV Import template as a file, then import it. `Question`, `Answer 1–4`, `Time Limit` and `Correct Answer(s)` are read, with numeric or answer-text correct answers.
  - **Gimkit spreadsheet.** Save Gimkit's CSV template as a file, then import it. `Question`, `Correct Answer` and `Incorrect Answer 1–3` are read; Gimkit's two-column term/definition template also works.

  Use **Preview** to see how many cards are ready and how many already exist before writing anything. The duplicate control then decides what happens: **Skip duplicates**, **Update the existing card** (body and deck/course are refreshed, while attempts, history, study status and your `## Notes` survive), or **Create a copy** with a distinct import key. The result reports created, updated, copied, skipped and failed counts.

  Imports write normal card notes and record `import_source`, `import_format`, `imported_on`, `import_batch` and `import_key`. A question-set card also keeps `question_set`, `choice_1…choice_4`, `correct_choices` and `time_limit` in its properties, so its choices are not lost. Choose a fallback deck and optional course in the import dialog; for a question-set file the file name is the default deck. PDFs and `.xlsx` files are not read directly, so save the spreadsheet as CSV first.
- **Export existing decks.** Use **Export** in the Cards view, **Export cards** under Settings, Cards, Decks, or the command **Cards: export to Quizlet, Kahoot, Blooket or Gimkit**. Quizlet is written as tab-separated text; the other formats are written as CSV in that platform's import layout. Kahoot may ask for `.xlsx`; open the CSV in Excel or Sheets and save it as `.xlsx` before uploading. Blooket's Set Creator and Gimkit's kit editor accept the CSV directly. Export files go under `Cards/exports` (or your configured card folder).
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
  ---

  ## Front
  hablar

  ## Back
  to speak
  ```

  Vocabulary notes use `item_type: vocab`, `language`, optional `part_of_speech`, and `## Term`, `## Definition`, `## Example` sections. Cloze cards use `==highlighted text==` or `{{c1::highlighted text}}` in `## Front`. Typed reviews add `last_typed_answer`, `last_verdict`, `verdict_override`, `graded_by` and `graded_on` beside the normal tracking properties.

Cards share the scheduler selected under **Settings → MCQ Tracker → Review**. Switching between the simple ladder and FSRS stays lossless, and a card's first FSRS review is seeded from its existing history.

## PDF annotations

Right-click a PDF in the file explorer, or run **PDF: add an annotation**, to save a highlight quote, text box, form note or page note. The plugin writes `name.annotations.md` beside the PDF and opens it with **PDF: open annotations**. The sidecar has a readable summary plus a fenced machine-readable block, and it stores the PDF's content hash so a replaced download can be detected. This is an annotation store, not a canvas editor; pen/highlighter drawing remains future work.

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
- **Tutor mode (default)** switches off OpenCode's file-editing and shell tools. **Agent mode** leaves them on, so OpenCode can read and edit files in your vault. Keep your vault backed up before using Agent mode. The plugin asks it not to touch tracking properties, but that is an instruction, not a lock.

### Tutor roles and commands

Choose **Private tutor**, **Socratic tutor**, or **Language partner** under **Settings → MCQ Tracker → AI → Tutor role**, or from the role menu in a chat. The same role is used by the review panel and the general assistant, with either AI backend.

Type a command at the start of a message to steer the next reply: `/guide`, `/quiz`, `/confuse`, `/gap`, `/predict`, `/feynman`, or `/mock`. The **Tutor commands** menu inserts one for you. They are prompts to the same assistant, not a separate feature: `/feynman`, for example, asks you to teach the idea back before the assistant points out the gaps.

### What is disclosed and sent

- **Network use:** requests to your chosen AI provider; requests to `api.github.com` and `github.com` only to set up OpenCode, which happens the first time you choose the OpenCode backend (the plugin shows what it will download, from where, and where it will go, and asks you to confirm first; if you say no it won't ask again) or when you press **Download and install**; and local requests to the OpenCode server on your own computer.
- **Document import:** the text of the pages or slides you choose is sent to your AI provider (Direct AI), or to your local OpenCode agent, which sends it to the provider you set up in OpenCode. Nothing is sent until you press **Start import**. The agent can create files in the new folder only if you allow it in OpenCode, and the plugin writes a temporary text copy of the file into that folder that it deletes when done. The file you choose is copied into that folder, and cut-out PDF pictures are saved in an `images` folder inside it.
- **What a chat request contains:** the question text, any passage, the answer choices, your answer, the correct answer, the explanation, your notes for that question, and your past mistake types for it. In the general assistant or Agent mode, OpenCode may also read other files in your vault if you ask it to.
- **Typed card answers:** when the local card grader is unsure and **AI fallback for typed answers** is on, only the card front, the stored reference answer, your typed answer and the strictness are sent. If that request fails, the answer stays in a device-local queue until AI grading succeeds or you self-grade it. Turning AI features off stops all grading requests.
- **Files outside your vault:** only the OpenCode install folder and data folder named above, and only if you use Option 2.
- **Programs started:** only `opencode` (and, during a download, your system's `tar` or PowerShell to unpack it), and only on desktop.
- **API key storage:** a key you enter for Direct API is stored as plain text in the plugin's `data.json` inside your vault, so it syncs with your vault. Anyone who can read your vault can read it. Keep `data.json` out of any public repository or shared vault. A key you enter for OpenCode is saved in OpenCode's own `auth.json` outside your vault, with owner-only permissions.

## Settings

Settings are grouped by module, then by tab. **Global** has Modules and General; **MCQ Tracker** has Practice, Review, Daily quiz, AI and About; **Cards** has Decks, Review and About; **Calendar** has About, Schedules & Sync, Notes & Templates, Exclusions, Appearance & Colors, and Language & Region.

- **Global → Modules** is one switch per module: **MCQ Tracker** (on by default), **Cards and vocabulary** (off by default), **Calendar** (off by default) and **AI features** (off by default). Turning a module off keeps its settings and your notes. It closes that module's open tabs and hides its ribbon button; using one of its commands anyway shows a notice that points back here.
- **Global → General** holds the plugin-wide options: whether the plugin shows its ribbon icons, and whether the practice view opens when Obsidian starts.
- **MCQ Tracker** covers the question folder, folder-filter style, review intervals or FSRS scheduling, desired retention, the Known snooze length and manager, the optional study-cards skin, the daily quiz count and folders, mistake types, confidence labels, explanation default, mobile timer pause, AI backend and provider details, and saved presets.
- **Cards** covers the default deck, the new-card folder, deck folders and course tags, cards per review session, answer mode, grading strictness, the optional AI fallback for typed answers, and whether to review due-and-new or all cards.
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

[MIT](LICENSE). The calendar module contains code adapted from University Schedule and Calendar (MIT, Cesemess), and the optional FSRS scheduler uses ts-fsrs 5.4.1 (MIT, Open Spaced Repetition); see [NOTICES.md](NOTICES.md).
