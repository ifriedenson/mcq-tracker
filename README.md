# MCQ Tracker

MCQ Tracker is the question-first study plugin for Obsidian. Turn notes and PDFs into exam-style practice across seven question formats, review notes and cards with spaced repetition, sit timed tests, and keep every attempt on the note it came from. It is free, local-first, and works on desktop and mobile. No account is required; AI is optional and uses your own provider key.

[Website](https://ifriedenson.github.io/mcq-tracker/) · [Source](https://github.com/ifriedenson/mcq-tracker) · [Give feedback](https://tally.so/r/PRDe1d)

Obsidian is a note-taking app that keeps your notes in a folder called a **vault**. A **community plugin** is an add-on you install inside Obsidian. If you have never used Obsidian, the **MCQ Tracker Start here** note teaches the five things you need; no separate account is required.

## Quick start

1. After you install and enable the plugin (see **Install** below), close the **Community plugins** window. On the first run, the **MCQ Tracker Start here** note opens in the main Obsidian window automatically. If it does not open, open that note in your vault or press `Ctrl/Cmd+P`, type **Open Start here note**, and press Enter.
2. Follow the note's path for you. It has a five-minute Obsidian primer, an AP student path, a shortest route for Obsidian users, and power-user shortcuts. **Try the example question** writes one ordinary note under `Questions/` and opens Practice on that question.
3. Choose an answer, pick how sure you are, and click **Submit**.
4. Read the result. The note keeps your answer, the correct answer, the explanation and the next review date.
5. Open **Today** to see what is due next, or **Open practice** to start another question.

<img src="docs/images/welcome-start.png" alt="Interactive Start here guide with three setup steps and a photosynthesis example question." width="720">
<img src="docs/images/answer-review.png" alt="Practice result showing an incorrect answer, the correct choice and the review controls." width="720">

### Start where you are

The auto-opened **MCQ Tracker Start here** note is the front door. It has four short paths:

- **New to Obsidian:** a five-minute primer on vaults, notes, the sidebar, the command palette, settings and note properties.
- **AP student:** choose the AP setup, add the exam date, import one small unit, practice, and review with **Today**. The AP resources, released FRQs and unofficial score calculator are explained there.
- **Already use Obsidian:** the shortest route from import to practice, plus how question properties work.
- **Power user:** command names, a Quick Practice link, Markdown blocks and optional integrations.

Reopen it any time with **Open Start here note**. The interactive guide is still available as **Open welcome guide**. After an update, a short **What's new** note lists that version's changes once; reopen it with **Show what's new**.

### What needs AI, and what does not

AI is optional and off by default. Almost everything works without it: writing question notes, practice, timed tests, review and **Today**, cards, the calendar, assignments and grades, the reference tools and the AP resources.

**One everyday workflow does need AI: turning a PDF or another document into question notes.** There is no offline converter. **Import questions from a file (PDF, PowerPoint, Word)** requires **AI features** plus a provider key (**Direct AI**) or the **OpenCode agent** on desktop, and sends the file's text to that provider. Without it, write the questions by hand or import ready-made flashcards (Quizlet, Kahoot, Moodle, QTI, GIFT, CSV or Markdown).

AI also powers the Study agent and tutor chat, AI grading of free response, generating questions or cards from a document or photo, and the optional course-note summary.

### Install

Choose the path that matches you.

<details>
<summary><strong>New to Obsidian?</strong> Set up Obsidian and a vault first.</summary>

1. **Download and open Obsidian.** Install it from [obsidian.md/download](https://obsidian.md/download). You should see Obsidian's vault picker.
2. **Create a vault.** Choose a folder for your notes and open it. Obsidian should show an empty file list and a note area.
3. **Try the website install, or skip to step 4.** Open https://community.obsidian.md/plugins/mcq-tracker and click **Add to Obsidian**. If Obsidian opens with the plugin, continue to step 7 to enable it and finish. If nothing opens, continue to 4.
4. **Open Settings → Community plugins.** The gear is at the bottom-left. You should see **Restricted mode** turned on.
5. **Turn off Restricted mode.** Click **Exit Restricted mode** and confirm. You should see **Browse** and **No plugins installed**.
6. **Browse and search.** Click **Browse**, search for `MCQ Tracker`, and open the result. You should see the plugin page with an **Install** button.
7. **Enable the plugin and close Community plugins.** Click **Install** if it is shown, then **Enable**. The plugin appears under your installed plugins. Close the **Community plugins** window (or press Escape) to return to the main Obsidian window. On the first run, the **MCQ Tracker Start here** note opens there automatically; if it does not, open that note in your vault or press `Ctrl/Cmd+P`, type **Open welcome guide**, and press Enter.

<img src="docs/images/install-community-plugin.png" alt="Obsidian Community plugins search showing MCQ Tracker by Isaac Friedenson with the Install button." width="760">

**On a phone?** Install Obsidian from your app store, open the sidebar, then go to **Settings → Community plugins**. Turn off Restricted mode, tap **Browse**, search for `MCQ Tracker`, then Install and Enable. Close **Settings** to return to the main Obsidian window; on the first run, the **MCQ Tracker Start here** note opens there automatically. If it does not, open that note in your vault or open the command palette and choose **Open welcome guide**. The same views and notes work on a phone.

</details>

<details>
<summary><strong>Already use Obsidian?</strong> Go straight to the plugin.</summary>

Open **Settings → Community plugins**, turn off Restricted mode if needed, then choose **Browse → `MCQ Tracker` → Install → Enable**. Close the **Community plugins** window; on the first run, the **MCQ Tracker Start here** note opens in the main Obsidian window automatically. If it does not, open that note in your vault or press `Ctrl/Cmd+P`, type **Open welcome guide**, and press Enter.

**On a phone,** start from the sidebar and use the same **Settings → Community plugins → Browse** path. After enabling, close **Settings**; on the first run, the **MCQ Tracker Start here** note opens in the main Obsidian window automatically. If it does not, open that note in your vault or open the command palette and choose **Open welcome guide**.

**Manual install or offline:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/ifriedenson/mcq-tracker/releases/latest), put them in `<your vault>/.obsidian/plugins/mcq-tracker/`, then enable **MCQ Tracker** under Community plugins. Close the **Community plugins** window; on the first run, the **MCQ Tracker Start here** note opens in the main Obsidian window automatically. If it does not, open that note in your vault or press `Ctrl/Cmd+P`, type **Open welcome guide**, and press Enter.

To update later, use **Check for updates** on the Community plugins page.

</details>

<img src="docs/images/hero-practice.png" alt="MCQ Tracker Practice view showing a multiple-choice question, answer choices, a timer and Submit." width="900">

## Why MCQ Tracker

- **It starts with questions, not a deck to maintain.** Write or import questions, answer them, and let the review schedule follow the result. You can still add whole notes and cards when that is the better unit.
- **It tells you why you missed.** Confidence ratings, mistake tags, per-skill accuracy, weak-spot practice, answer explanations and a review date all stay on the question note.
- **It covers the whole exam week.** Timed multi-section tests, AP-style free response, a gradebook, exam-aware study plans and a calendar sit beside the question bank.
- **Your notes are the database.** Review state lives in each note's properties, so it travels with the vault, survives a plugin reinstall, and remains readable by Dataview or a text editor.
- **The optional parts stay optional.** AI, AnkiConnect, CouchDB sync and the calendar feeds are off or unused until you turn them on. Nothing is sent anywhere by default.

## What you get

| Area | Included |
| --- | --- |
| **Practice** | Multiple choice, student-produced response, fill-in, matching, true/false, select-all and free response (FRQ); hints, confidence, cross-out, flags and per-question timing. |
| **Tests** | Timed multi-section tests, resume, a question navigator, mark for review, option shuffle, a pass mark and Bluebook-style tools. |
| **Review** | Whole-note review in a dock under the note, a review sidebar, a due-date calendar, FSRS, SM-2 and the interval ladder; Again/Hard/Good/Easy previews, keyboard grading, requeue, skip, postpone, undo and lapse checkpoints. |
| **Cards** | Flashcards, cloze, reversed, multiple-choice, typed and image-occlusion cards; decks, vocabulary, cram, `.apkg` import/export and optional AnkiConnect sync. |
| **Study agent** | Optional note-grounded chat with tutor roles, an **Objective coach** role, local cited vault search, PDF context, plan-then-act, write review, memory and saved conversations. |
| **Study tools** | Feynman sessions, recall queues, Cornell notes, study flow, reading library, mind maps, study plans, time blocks, citations and reference sheets. |
| **Calendar** | Classes and exams from `.ics` or Full Calendar notes, local event CRUD with categories and recurrence, assignment deadlines, grades and study planning. |
| **Statistics** | Attempts, accuracy, confidence calibration, weak spots, study activity, true retention by maturity, memory-now, distributions, leeches and per-deck summaries. |
| **Import/export** | PDF, PowerPoint, Word/OpenDocument, HTML, RTF, Markdown, CSV, text, Quizlet, Kahoot, Moodle, QTI, GIFT, `.apkg`, Mochi and ICS. |
| **Focus** | Pomodoro timer with work/short-break/long-break phases, a completion sound, a daily goal and a study log. |

<img src="docs/images/cards-review.png" alt="Cards view with two flashcards ready to review, deck filters and a Start review button." width="440"> <img src="docs/images/insights-overview.png" alt="Insights Overview with attempts, accuracy, due counts, course health and study activity." width="440">

## Practice, tests and feedback

Practice is one note per question by default, which keeps each attempt, explanation and review date attached to the material it belongs to. Quick add can turn a pasted block into several notes at once, and the importers can bring in a whole question bank.

- **Question types:** MCQ, SPR, fill-in, matching, true/false, select-all and FRQ.
- **Feedback:** the correct answer, the explanation, your confidence, an optional reason for a miss, mistake tags and the next review date.
- **Tests:** choose sections, counts, minutes, written responses, option shuffle and a pass mark; pause or resume a saved test.
- **Weak spots:** filter by course, skill, difficulty, folder or a saved preset, or use adaptive practice to weight the questions that need work.
- **Exam tools:** calculator, reference sheet, periodic table, formula sheet, highlighter, cross-out and mark-for-review.

## Review and scheduling

The review schedule is shared by questions, cards and whole notes. Nothing is locked behind a second account or a cloud service.

- **Whole-note review** opens the note in place and docks a grading bar underneath it. Every grade shows the interval it would schedule before you press it. A failed note returns later in the same session; a note that keeps failing stops at a lapse checkpoint and asks whether to reset, rest, remove or carry on.
- **The review sidebar** lists what is due and upcoming, groups by day, shows an estimate and lets you sort, filter, grade, postpone or remove without leaving the note. It can also show the Pomodoro clock.
- **The review calendar** shows the due load by day and the next seven days of work.
- **FSRS and SM-2** are both available for whole notes and cards. The interval ladder remains the default for questions.
- **Durable recall** is opt-in: a correct recall counts as durable only after it happens on two different days.

## Cards, decks and Anki

The optional Cards module adds flashcards without changing the question workflow.

- **Card shapes:** flip, reversed pair, multiple choice, cloze, typed answer and image occlusion.
- **Decks and vocabulary:** deck folders, course tags, a vocabulary tab and an offline WordNet import.
- **Anki files:** import `.apkg`, export `.apkg`, and keep decks in step with a running Anki desktop through the AnkiConnect add-on.
- **AnkiWeb finder:** **Cards: find a deck on AnkiWeb** opens AnkiWeb's shared-deck search in your browser. Download the `.apkg` there and use **Cards: import an Anki deck**. The plugin does not ask for or store an AnkiWeb password.
- **Card review:** cram, a practice-only Mother cram loop, grading accuracy, a grade-later queue and a card archive.

## Study agent and study tools

AI is off by default and only uses the provider you configure. The Study agent is a normal Obsidian chat with local note grounding and a review window around file writes.

- **Tutor roles:** Private tutor, Socratic tutor, Objective coach and Language partner, plus `/guide`, `/quiz`, `/confuse`, `/gap`, `/predict`, `/feynman` and `/mock`.
- **Objective coach:** charts a note into learning objectives and teaches one at a time through explain → recall → apply. It tracks understanding, recall and transfer separately, treats recall as durable only after two different days, and can finish with a report you save as study notes and cards. The session lives in a saved conversation; there is no separate objective rail.
- **Grounded help:** local cited vault search, note attachment, PDF page ranges and opt-in memory. The agent is told to cite a real `[[note]]` or `[[note#L12]]` and to say when the vault does not contain the answer.
- **Study workspace:** twenty-one independent modules and twenty-one local workflows, including Feynman, Recall, Time blocks, Reading library and Quiz index. It also includes study maps, mind maps, Cornell notes, study flow, the subject manager, task lists, citations and read-aloud.
- **Writes stay reviewed:** the agent proposes a file change, you approve it, and the existing diff/undo guard applies it.

## Calendar, assignments and planning

- **Classes and exams:** import an `.ics` schedule, read Full Calendar notes, see the next class, mark attendance and create a class note.
- **Local events:** create, edit and delete events with seven colour-coded categories, custom colours, all-day or timed events, location, description and daily/weekly/monthly/yearly recurrence with an end date. They live in plugin data and are separate from imported feeds.
- **Assignments:** due dates, estimates, task checkboxes, a gradebook and GPA.
- **Planning:** Today, a study plan for the next exam, time blocks, deadlines and a calendar view.

## Import and export

Bring material in as notes, not as a locked database. Import from PDF, `.pptx`/`.ppsx`/`.ppt` (text), `.docx`/`.docm`, `.odt`/`.odp`, HTML, RTF, Markdown, CSV, text, Quizlet, Kahoot, Moodle XML, QTI, GIFT, `.apkg`, CrowdAnki JSON, Mochi Markdown and Anki text. Export a study bundle, a card archive, `.apkg`, ICS, CSV, Markdown or JSON where the format supports it. Every import shows a preview or a report before it writes.

## How it compares with Spaceforge

Spaceforge is a strong spaced-repetition and study suite. This comparison is based on its public README (reference `dralkh/spaceforge` at `1.2.92`) and on this 1.299.4 build. The point is to show the trade-offs, not to claim that one plugin wins every row.

| Capability | MCQ Tracker | Spaceforge | The practical difference |
| --- | --- | --- | --- |
| Whole-note review | Yes: docked bar, review sidebar, due calendar | Yes: docked bar and review sidebar | Both keep the note in view. MCQ Tracker also has question and card lanes that share the same scheduling vocabulary. |
| Spaced repetition | FSRS, SM-2 and a simple ladder | FSRS and SM-2 | MCQ Tracker keeps the ladder for question notes and offers FSRS/SM-2 for whole notes and cards. |
| AI-generated MCQs | Yes, optional, with a blind-verification pass | Yes | Both are BYOK and optional. MCQ Tracker treats generated items as ordinary question notes and can verify the answer key. |
| Adaptive objective tutor | **Partial:** Study agent Objective coach role and local concept record | Yes: dedicated objective rail and per-objective transcripts | MCQ Tracker's coach runs in a saved conversation; it does not have a separate objective dashboard. |
| Web lookup while studying | Local cited vault search only | Optional cited web search | Deliberate: MCQ Tracker does not send study text to a search provider. |
| Anki decks | `.apkg`, AnkiConnect and a separate deck lane | `.apkg`, AnkiConnect and an in-app AnkiWeb browser | MCQ Tracker opens AnkiWeb's search in your browser and imports the downloaded file. |
| AnkiWeb | Finder link; no password stored | Search, inspect and import in the plugin | The download step is outside Obsidian, which keeps the plugin out of AnkiWeb's session. |
| Local calendar events | Yes: categories, recurrence, location, description | Yes, integrated into the main calendar | MCQ Tracker uses a separate **Local events** view; imported classes and exams stay in the Calendar view. |
| Statistics | Heatmap, streaks, retention by maturity, memory-now, distributions, leeches, per-deck | Similar Anki-style dashboard | Both compute locally. MCQ Tracker also has confidence calibration and weak-spot charts. |
| Pomodoro | Work, short break, long break, sound, sidebar and status bar | Yes | Equivalent. |
| Provider breadth | OpenAI, Anthropic, Gemini, OpenRouter, Together, Qwen, Ollama, LM Studio, llama.cpp, Jan, any OpenAI-compatible endpoint, and the OpenCode local agent | 20+ named providers and several agent CLIs | MCQ Tracker's custom endpoint covers the same broad class; OpenCode is the only bundled local agent CLI. |
| Data storage | Review state in each note; settings in `data.json` | One central data file | Deliberate: notes are portable, inspectable and survive a plugin reinstall. There is no custom data-path setting because there is no central review database. |
| Progress carried with the vault | Yes, by design: the progress is in the notes | Optional `progress.json` mirror | A vault sync that excludes `.obsidian` still carries MCQ Tracker review state. Shared settings do not travel that way. |
| Mobile | Yes | Yes | Both use the same Obsidian app. |
| Data export | Study bundle, card archive, `.apkg`, ICS, CSV, Markdown | Central JSON backup and recovery | Different export shapes; both avoid a lock-in. |
| Question-first exam tools | Yes: timed tests, confidence, error tags, numeric/units, FRQ, gradebook, AP tools | No | This is where MCQ Tracker leads. |

**Why the differences exist.** MCQ Tracker deliberately keeps schedules in the notes, keeps web search off the network, and only runs a local agent CLI through OpenCode. Those are product boundaries, not forgotten rows. The full audit, including the Spaceforge rows already closed and the few that remain partial, is in [docs/PARITY_AUDIT.md](docs/PARITY_AUDIT.md).

## Data, privacy and network use

- **Review state** is written to each question, card or note in its YAML properties. The plugin's `data.json` holds settings, presets, local events, chat history and the running timer. There is no central review database.
- **No telemetry.** The plugin has no analytics, crash reporting, ads or self-updater.
- **AI is opt-in.** When you send a chat, generate questions or grade an answer, the selected provider receives the text needed for that request. The active provider and the feature that sends are listed in **Settings → Study agent → AI and the assistant**.
- **AnkiConnect** talks only to the local Anki desktop address you configure. **AnkiWeb** opens in your browser; the plugin does not store an AnkiWeb password.
- **CouchDB sync** is optional and only uses the server you configure. **Calendar feeds** are read only when you add them.
- **No web lookup:** the Study agent uses local vault search and cites the notes it actually read. It does not browse the web.

## Settings

Settings are grouped by category, with a page list beside the selected category. The most useful starting switches are under **Settings → App & documents → Modules and global options → Modules**.

| Setting | What it does | Default |
| --- | --- | --- |
| MCQ Tracker | Turns practice, tests, filters and import on or off. Notes stay. | On |
| Cards and vocabulary | Adds flashcards, vocabulary and card review. | Off |
| Calendar | Adds classes, exams and exam-aware study planning. | Off |
| Assignments | Adds the gradebook and task list. | On |
| AI features | Adds tutor, grading and AI-assisted import. Needs your key. | Off |
| Review intervals (days) | Days before a correct answer returns. Misses return tomorrow. | 1, 3, 7, 21, 60 |
| Explanation after answering | When to show the answer explanation. | Only after a miss |

<img src="docs/images/settings-modules.png" alt="MCQ Tracker settings showing the Modules page with MCQ Tracker and Assignments on, and Cards and Calendar off." width="820">

<details>
<summary>Advanced settings and modules</summary>

The optional Study Workspace adds **twenty-one independent modules** and **twenty-one local workflows**, including Feynman, Recall, Time blocks, Reading library and Quiz index. Its settings are on their own pages.

Other settings pages include **Whole-note review**, **Spaced Everything**, **Daily quiz**, **Simple quiz blocks**, **Simple note quiz**, **Decks**, **AnkiConnect**, **CouchDB sync**, **Auto Anki** and **Text2Anki**. Each has its own page or tab.

</details>

<details>
<summary>Question note format</summary>

Any note with a `question_id` property can be a question. A small question note looks like this:

```markdown
---
question_id: BIO-001
course: Biology
skill: Cells
question_type: mcq
answer: B
---

## Question
Which organelle produces most of the cell's ATP?

## Answer Choices
- A. Nucleus
- B. Mitochondrion
- C. Ribosome

## Answer
> [!answer]- Reveal answer
> **Correct Answer: B**
>
> Mitochondria produce ATP by oxidative phosphorylation.
```

`## Stimulus` is optional. You can also add `difficulty`, `unit` and `test` properties, and use `## My Notes` for your own notes. See the [sample vault](samples/README.md) for working notes.

</details>

<details>
<summary>What the plugin writes</summary>

Question attempts, dates, flags and review dates are written to the question note's properties. The plugin's own `data.json` stores settings, presets, local events and the running timer. Your other notes stay ordinary Markdown.

The optional AI and CouchDB sync features use the network only after you turn them on and configure them. AnkiConnect talks only to a local Anki desktop. The plugin sends no telemetry.

</details>

## Commands

Open the command palette with `Ctrl/Cmd+P` and search **MCQ Tracker**, **Cards**, **Review**, **Study agent** or **Calendar**. The palette has more than 200 commands, including:

- **Practice:** Open practice, Quick Practice, Start a timed test, Practice this note only, Show weak spots.
- **Review:** Open the review sidebar, Next/Previous review note, Review current note, Add current note to review, Open the review calendar, Open study statistics.
- **Cards:** Open cards, New card, Import an Anki deck, Export a deck as an Anki package, Find a deck on AnkiWeb.
- **Study agent:** Open the sidebar, Quick Chat, plan a multi-step task, attach a PDF, export a conversation.
- **Calendar:** Open calendar, New local event, Import an `.ics` schedule, Export the visible schedule.
- **Data:** Export a study bundle, Import a study bundle, Export a card archive.

## Screenshots

These are real captures of the shipped views.

| | |
| --- | --- |
| <a href="docs/images/hero-practice.png"><img src="docs/images/hero-practice.png" alt="Practice view." width="400"></a> | <a href="docs/images/answer-review.png"><img src="docs/images/answer-review.png" alt="Answer review." width="400"></a> |
| <a href="docs/images/cards-review.png"><img src="docs/images/cards-review.png" alt="Cards review." width="400"></a> | <a href="docs/images/insights-overview.png"><img src="docs/images/insights-overview.png" alt="Insights overview." width="400"></a> |

<img src="docs/render/study-agent-ui/obsidian-empty-narrow-light.png" alt="Study agent in a 296 px Obsidian sidebar with a New chat tab, local vault search and a suggested action." width="420">

The Study agent at a 296 px sidebar width. A physical-phone screenshot is not included because no device was available for this pass; the mobile layout is covered by the layout tests, and no mockup is presented as a phone capture.

## Troubleshooting

- **I cannot find MCQ Tracker in Browse.** Check that Restricted mode is off, Obsidian is up to date, and the search is `MCQ Tracker`. If it still does not appear, use the manual install above.
- **Practice says there are no questions.** Each question note needs a `question_id` property, a `## Question` heading and an `answer` property. Check **Question folder** in the plugin's Practice settings and clear any folder filter.
- **Cards are missing.** Cards and vocabulary is off by default. Turn it on under **Settings → App & documents → Modules and global options → Modules**.
- **AI or OpenCode does not work.** AI features are off by default. Turn them on under **Settings → App & documents → Modules and global options → Modules**, then add a provider key under **Settings → Study agent → AI and the assistant**. OpenCode is desktop-only; on mobile, use a Direct API provider key.
- **A result did not save.** Keep Obsidian open, press `Ctrl/Cmd+P`, and run **Retry saving offline practice results**. Check that the vault folder is writable.

## Limitations

- The **Objective coach** is a prompt-driven Study agent role. It does not yet have a separate objective rail, per-objective transcript store or automatic transfer test.
- **AnkiWeb** opens in your browser; the plugin does not embed the site or store a session.
- **Web lookup** is deliberately absent. The agent can search your vault, not the web.
- AI output depends on the provider you choose. Generated questions and grades are aids, not an accuracy guarantee.

## License and links

[MIT](LICENSE). The plugin sends no telemetry. Third-party notices are in [NOTICES.md](NOTICES.md).

- [Landing page](https://ifriedenson.github.io/mcq-tracker/)
- [Source, releases and changelog](https://github.com/ifriedenson/mcq-tracker)
- [Give feedback](https://tally.so/r/PRDe1d)
- [Report a problem](https://github.com/ifriedenson/mcq-tracker/issues)
- [Sample vault](samples/README.md)
- [Spaceforge parity audit](docs/PARITY_AUDIT.md)
