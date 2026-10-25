# MCQ Tracker

Serve practice questions from your own notes, grade your answers, and keep a full study record in each note's properties: time, confidence, mistake type, streak and the next review date. It works on desktop and mobile, and the AI tutor is optional and off by default.

## Features

- **Exam-style practice screen.** The passage sits on the left, and the question, answer choices, confidence buttons and Submit sit on the right. On narrow screens the passage stacks above the question.
- **Automatic grading** for multiple-choice and student-produced-response questions, or self-grading when a note has no answer key.
- **Timer** with pause. It survives closing the app, and on mobile it can pause itself when you switch apps.
- **Review after answering.** See the question and choices again with your pick and the correct answer marked, plus an explanation you can show or hide (the default is a setting).
- **Spaced review.** Correct answers come back after 1, 3, 7, 21, then 60 days (editable). Misses come back tomorrow.
- **Mistake tracking.** After a miss, tag why (careless, content gap, misread, ran out of time, guessed, or your own labels).
- **Flexible filters.** Filter by course, test, section, domain, skill, unit and difficulty. You can pick several values in one field (OR), and add extra filter sets that are combined with OR. Save any combination as a **preset**.
- **Pick modes:** smart weighted mix, due for review, never attempted, missed, flagged, or pure random.
- **Notes box** on the result screen, saved into the note.
- **Optional AI tutor** through your own API key or a local OpenCode agent (see [AI assistant](#ai-assistant-optional-and-off-by-default)).

## Install

**From the community directory:** open Settings, Community plugins, Browse, search for "MCQ Tracker", then Install and Enable.

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
- Properties the plugin writes: `result, date attempted, first_attempted, attempts, correct_count, streak, time_spent_total, last_time_spent, last_answer, last_confidence, last_error_type, flagged, next_review, history`.

Run the command **Add missing tracking properties to all question notes** to add the writable properties to notes that don't have them yet.

## Using it

1. Open the practice view from the ribbon (graduation cap icon) or with the command **Open practice view**.
2. Pick a preset or set filters. Tap several values to allow any of them. Tap **+ Add another set (OR)** to combine groups, for example "Unit 3 or 4 of a history course" OR "SAT, Reading and Writing, Inferences".
3. Choose how to pick questions and press **Start**.
4. Choose an answer, say how sure you are, and **Submit**.
5. On the result screen you can review the question, show or hide the explanation, tag why you missed it, write notes, flag the question, open the note, or ask the AI. Press **Next question** to continue.

### Review scheduling

After a correct answer with confidence 2 or 3, the next review is 1, 3, 7, 21, then 60 days out (editable). A miss resets the streak and returns tomorrow. A correct answer rated "Guessing" doesn't extend the streak and returns in 2 days.

Each `history` entry is stored as `date|result|seconds|answer|confidence|error_type`.

### Commands

- Open practice view
- Next question (from current filters)
- Toggle flag on this question
- Add missing tracking properties to this note
- Add missing tracking properties to all question notes

## AI assistant (optional, and off by default)

The result screen can show an **Ask AI** panel that explains a question, tells you why you missed it, writes a similar question, or quizzes you. Nothing is sent anywhere, and nothing is downloaded or started, until you turn on **Enable AI features** in settings. There are two ways to power it. Both use your own account.

### Option 1: Direct API (all devices, including phones)

The plugin sends a request to the provider you choose: Anthropic, OpenAI, OpenRouter, Google Gemini, a local Ollama server, or any OpenAI-compatible address you enter (for example LM Studio).

### Option 2: OpenCode agent (desktop only)

[OpenCode](https://opencode.ai) is a separate, free, open-source coding agent. The plugin can talk to a copy of it running on your own computer, which also lets the AI help with your notes (for example, drafting question notes). This works like the agent setup in other AI plugins, and you stay in control at each step:

- **Your own copy:** install OpenCode yourself and enter its path under **OpenCode program** (or leave it blank to use the one on your PATH).
- **Download from inside the plugin:** pressing **Download and install** shows a confirmation that names the source, version, size and folder. Only after you confirm does the plugin download the release from `github.com/anomalyco/opencode`, check its SHA-256 checksum (it refuses to install if no checksum is published or it doesn't match), and unpack it into `~/.question-tracker/opencode`, which is outside your vault. The plugin never downloads anything on its own and never updates it by itself.
- **Running it:** when you use the AI chat, the plugin starts `opencode serve` on `127.0.0.1` with a random port and a random password, so only your computer can reach it. It is stopped when Obsidian closes. Its own data (including any provider key you save here) lives in `~/.question-tracker/opencode-data`.
- **Tutor mode (default)** switches off OpenCode's file-editing and shell tools. **Agent mode** leaves them on, so OpenCode can read and edit files in your vault. Keep your vault backed up before using Agent mode. The plugin asks it not to touch tracking properties, but that is an instruction, not a lock.

### What is disclosed and sent

- **Network use:** requests to your chosen AI provider; requests to `api.github.com` and `github.com` only when you press **Download and install**; and local requests to the OpenCode server on your own computer.
- **What a request contains:** the question text, any passage, the answer choices, your answer, the correct answer, the explanation, your notes for that question, and your past mistake types for it. In the general assistant or Agent mode, OpenCode may also read other files in your vault if you ask it to.
- **Files outside your vault:** only the OpenCode install folder and data folder named above, and only if you use Option 2.
- **Programs started:** only `opencode` (and, during a download, your system's `tar` or PowerShell to unpack it), and only on desktop.
- **API key storage:** a key you enter for Direct API is stored as plain text in the plugin's `data.json` inside your vault, so it syncs with your vault. Anyone who can read your vault can read it. Keep `data.json` out of any public repository or shared vault. A key you enter for OpenCode is saved in OpenCode's own `auth.json` outside your vault, with owner-only permissions.

## Settings

Question folder, review intervals, mistake types, confidence labels, whether the explanation starts shown or hidden, timer pause on mobile, the AI settings (backend, provider, OpenCode program and mode), and saved presets (rename or delete them).

## Privacy

- No telemetry, analytics or ads.
- The plugin reads and writes notes inside your vault. The only things it touches outside your vault are the optional OpenCode folders described above.
- The running timer is stored on your device (vault-scoped local storage), not in your notes.
- The only network requests are the optional AI and download requests described above, and only if you enable them.

## Support and issues

Please report bugs and ideas on the GitHub issues page for this repository.

## License

[MIT](LICENSE)
