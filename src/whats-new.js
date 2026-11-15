"use strict";
/* Bundled release notes and per-device "already seen" state. No network, no vault notes. */
const { loadWelcomeState } = require("./welcome");

const WHATS_NEW_STORAGE_KEY = "mcqTrackerWhatsNew";

const RELEASES = [
  {
    version: "1.307.4",
    date: "November 15, 2026",
    title: "Polished for Primary, calm in the dark",
    summary:
      "A full pass through the plugin inside Obsidian 1.15.1 running the Primary theme: hub tabs on the design tokens with proper touch targets and arrow-key travel, exam surfaces that wrap instead of overflowing on narrow panes, and dark-theme ink that stays above AA. Nothing else moves.",
    highlights: [
      {
        title: "Hub tabs you can tap",
        body: "The Today, Plan and Study tabs use the shared radius and type tokens, wrap instead of hiding in a scroller, hold a 44pt touch target on phones and coarse pointers, and move with the Left and Right arrow keys.",
      },
      {
        title: "Exam views fit narrow panes",
        body: "The Bluebook header and footer become wrapping rows under 520px, and the tool buttons go icon-only (each keeps its accessible name), so Reference and More stay reachable in a sidebar-width pane.",
      },
      {
        title: "Dark themes stay legible",
        body: "Warm dim themes like Primary dark drop accent and secondary ink below contrast; resting exam controls, hints and counts now borrow the normal ink there, and links resolve through a lightened accent mix.",
      },
      {
        title: "Nothing else changed",
        body: "No setting key, note format, review schedule, recurrence rule or network path changed. The whole plugin was driven live — 242 commands, 20 views, 61 settings pages — with no failures.",
      },
    ],
  },
  {
    version: "1.307.3",
    date: "November 15, 2026",
    title: "Urgent first, typed dates understood",
    summary:
      "The add row can now create a high-priority task in one tap, and quick-add reads the times and spans people actually type. Both build on the code that was already there, so nothing else moves.",
    highlights: [
      {
        title: "★ High before adding",
        body: "The task list's add row has a priority toggle. Press it and the next task is created high priority; leave it alone and tasks stay normal, exactly as before. The star on each row still flips the flag later.",
      },
      {
        title: "High work stays on top",
        body: "High-priority tasks sort above normal ones in the list, and each group keeps its own due-date order, so a list never reshuffles itself. Only high tasks carry the ⏫ marker in the mirror note.",
      },
      {
        title: "Spans and times together",
        body: "\"essay in 16 days\" lands on the right day even across a month boundary, and \"drill at 3pm\" keeps the clock. Leap-day and year-end spans resolve too: 28 February 2028 plus one day is the 29th.",
      },
      {
        title: "Nothing else changed",
        body: "Every date-only form shipped earlier still parses the same, the mirror is still rebuilt from data.json (never appended), and the repeat rules, review schedule and hub fix are untouched.",
      },
    ],
  },
  {
    version: "1.307.2",
    date: "November 15, 2026",
    title: "The whole study loop in one note",
    summary:
      "The mirror note now carries exam-plan tasks and today's due questions, cards and vocabulary beside your study tasks, as linked Tasks-compatible lines. data.json stays the source of truth.",
    highlights: [
      {
        title: "Due work shows up too",
        body: "A new Due today section lists every question, flashcard and vocabulary item the due queue is holding, each as \"- [ ] [[path|title]] 📅 2026-11-15 · Question · Biology\". The link is what gives you backlinks and a place in the graph, and the date makes the line readable by Smart Gantt and other plugins.",
      },
      {
        title: "Exam plans are just tasks",
        body: "Tasks made by the exam planner already lived in the same list, and now they land in the note the moment they are made: completion, deletion and a repeat successor all rewrite it. One note setting, one writer, no second mirror.",
      },
      {
        title: "Never appended, always rebuilt",
        body: "Every refresh regenerates the note from current plugin data, so refreshing ten times leaves exactly one line per item. A reviewed question leaves the due list on its own, and a finished task moves under Done.",
      },
      {
        title: "The note cannot change your data",
        body: "The mirror is a projection: ticking a line or typing in the note changes nothing in data.json, and the next refresh puts the note back. Finished and stale items read the same way the study-task mirror always has.",
      },
    ],
  },
  {
    version: "1.307.1",
    date: "November 15, 2026",
    title: "Review work that comes back on its own",
    summary:
      "A study task can now repeat: daily, every weekday or weekly. Completing it schedules exactly one next instance, with the same due time, in the task list and the mirror note.",
    highlights: [
      {
        title: "Three rules, no grammar to learn",
        body: "The repeat button on each task cycles off, daily, weekdays and weekly. Typing it works too: \"Review Biochem every weekday\" or \"drill weekdays\" sets the rule and leaves a clean title.",
      },
      {
        title: "The next one lands on the right day",
        body: "Daily steps a day, weekdays skip Saturday and Sunday, and weekly keeps the weekday it was set on. Month ends, year ends and leap days are handled: 31 January repeats into 1 February, 28 February 2028 into the 29th, and 29 February into 1 March.",
      },
      {
        title: "The due time comes along",
        body: "A task at 08:15 repeats at 08:15. Its course, tags and high-priority star carry over too, and the next instance shows up in the task list and the due queue immediately.",
      },
      {
        title: "One successor, never two",
        body: "Finishing the same task twice, or finishing, reopening and finishing again, still schedules a single next instance. The mirror note writes it as \"- [ ] Review Biochem 📅 2026-11-23 ⏰ 08:15 🔁 every weekday\".",
      },
    ],
  },
  {
    version: "1.307.0",
    date: "November 15, 2026",
    title: "Tasks learn the clock",
    summary:
      "Quick-add boxes now read times: \"review at 3pm\", \"call 9am\", \"15:30\", \"in 2 hours\", \"tonight\", \"noon\". The task keeps the time, the chip beside it says 3 PM, and the note mirror writes it as a Tasks-compatible ⏰ line.",
    highlights: [
      {
        title: "Type the hour, not just the day",
        body: "\"Review Biochem at 3pm\", \"call at 9am\", \"standup 15:30\", \"drill 3p\" and \"at 9\" all set a due time and leave a clean title. Named hours work too: noon, midnight, tonight, this morning, this evening.",
      },
      {
        title: "It knows what has already gone by",
        body: "At four in the afternoon, \"at 3pm\" means tomorrow at three. Tonight stays tonight, so a late-evening \"quiz tonight\" still lands on today at 8 PM.",
      },
      {
        title: "In two hours means two hours",
        body: "\"in 2 hours\" and \"in 30 minutes\" do real clock math from now, so 11:30pm plus two hours is tomorrow at 1:30 AM rather than a vague \"today\".",
      },
      {
        title: "The hub tabs from 1.306.0 open again",
        body: "That release drew \"the plugin that created this tab has gone away\" instead of the Today, Plan and Study hubs, because Obsidian asked the view for its type before the view was ready. The hubs now answer first and open normally.",
      },
      {
        title: "The time shows up and mirrors",
        body: "The Task list chip reads \"Due today · 3 PM\", the Focus day scratchpad shows it beside the day, and the one-way mirror writes ⏰ 15:00 after 📅, so Tasks, Smart Gantt and Dataview read it. A day or time you pick in the boxes always beats what the title says.",
      },
    ],
  },
  {
    version: "1.306.0",
    date: "November 15, 2026",
    title: "A shorter ribbon: Today, Plan and Study",
    summary:
      "The ribbon dropped from nineteen buttons to twelve. Today, Plan and Study are now single buttons that open their views as tabs, and PDF++'s three toggles share one button with a menu. Every view, command and setting is unchanged.",
    highlights: [
      {
        title: "Three hubs replace nine buttons",
        body: "Today holds Today, Study statistics and Pomodoro. Plan holds Calendar, Focus day, Review calendar and Local events. Study holds the Study Workspace and Study Tools. Each hub is one tabbed pane, and each tab is the real view, keeping its state when you switch.",
      },
      {
        title: "The commands still go where they say",
        body: "Open Focus day, Open study statistics, Open Pomodoro timer and the rest now open their hub on the right tab, so the palette behaves exactly as before while the ribbon stays short.",
      },
      {
        title: "One PDF++ button",
        body: "PDF++'s auto-copy, auto-focus and auto-paste are three entries in one PDF++ menu, with PDF++ settings at the bottom, instead of three ribbon buttons.",
      },
      {
        title: "Nothing is taken away",
        body: "Settings, Global has a new Ribbon layout choice: Grouped (the default every install moves to) or One button per view, which restores the long ribbon exactly.",
      },
    ],
  },
  {
    version: "1.305.0",
    date: "November 15, 2026",
    title: "Tasks grow up: mirror, repeats, priorities",
    summary:
      "Study tasks gain the four capabilities worth borrowing from dedicated task plugins: a one-way Tasks-compatible mirror into a note, daily/weekly repeats that reschedule on completion, high-priority stars that sort first, and fuller natural language (months, every day/week/weekday). The plugin data stays the source of truth throughout.",
    highlights: [
      {
        title: "A note other plugins can read",
        body: "The Tasks command and both task-surface buttons copy open work into a note as Tasks-compatible lines (due, priority, repeat, tags), with completed work under a Done heading. One way only: the note is rewritten, hand edits are overwritten, and the footer says so.",
      },
      {
        title: "Repeats that reschedule themselves",
        body: "Type 'every Monday' or 'daily' and the task repeats; finishing it schedules the next instance from its due date, or from today when it is overdue. The sidebar row cycles off, daily, weekly.",
      },
      {
        title: "Stars sort first",
        body: "High-priority tasks float above due dates in the Task list, the workspace queue and the mirror, with star badges everywhere and a toggle on every sidebar row.",
      },
      {
        title: "Months and every-patterns",
        body: "'in 2 months' and 'in a month' now parse to calendar months, and the due parser keeps the weekday in 'every Tuesday' so the task lands on Tuesday and repeats weekly.",
      },
    ],
  },
  {
    version: "1.304.2",
    date: "November 15, 2026",
    title: "Keep typing: task boxes hold the cursor",
    summary:
      "Adding a task with Enter leaves the cursor in the new-task box on every quick-add surface, so tasks can be entered back to back with no mouse, like Deadline. The Study Workspace block input also learns Enter, and a missing export that crashed the Day plan on blocks with tasks is fixed.",
    highlights: [
      {
        title: "Type, Enter, type again",
        body: "The Task list, Focus day scratchpad and per-block task boxes refocus their fresh input after each add, whether the task came from Enter or the Add button.",
      },
      {
        title: "Enter works inside time blocks",
        body: "The block task box previously needed the Add task button; Enter now adds the task there too, matching the other surfaces.",
      },
      {
        title: "Day plan no longer crashes on tasked blocks",
        body: "Rendering a block with tasks called an unexported time-blocks helper and threw; `statusChar` is now exported, and the new tests render a tasked block through the real Day view.",
      },
      {
        title: "Pinned through the real views",
        body: "Each box is driven end to end in tests: type, press Enter, and the fresh input reports focus — including the Day plan path that exposed the crash.",
      },
    ],
  },
  {
    version: "1.304.1",
    date: "November 15, 2026",
    title: "Deadline parity: the last two pieces",
    summary:
      "A second line-by-line pass over the Deadline plugin closed its last two gaps: Focus day has the same ribbon entry as every module view, and day-open confirmations fade after three seconds while errors stay put.",
    highlights: [
      {
        title: "Focus day joins the ribbon",
        body: "The calendar-days ribbon button opens Focus day beside the Pomodoro, task list and calendar entries, using the same module-ribbon path with the same accessible name.",
      },
      {
        title: "Confirmations fade, errors stay",
        body: "Created and Opened confirmations clear after three seconds like Deadline's, guarded so a newer message is never wiped; a failed open keeps its reason on screen until the next action.",
      },
      {
        title: "The full parity table",
        body: "Everything else in Deadline already lives here: month calendar with navigation and today highlight, day-click daily notes in a new tab, start/pause/reset timer with editable lengths and live info, animated phase-coloured bar, completion chime, quick tasks with empty state, theme-aware styles. Defaults that differ on purpose — 25-minute focus blocks, opt-in autostart, persistent task lists, Schedule-section note templates — are the deeper MCQ Tracker equivalents, not gaps.",
      },
      {
        title: "Timer accuracy matches",
        body: "Both timers measure against the wall clock instead of counting ticks, so a throttled tab cannot drift the countdown; the completion path advances the phase, counts the session and sounds the chime.",
      },
    ],
  },
  {
    version: "1.304.0",
    date: "November 15, 2026",
    title: "Tasks understand days",
    summary:
      "Task input now reads the day you type: today, tomorrow, Tuesday or next month sets the due date and the words leave the title. It works everywhere tasks are added, an explicitly picked date always wins, and the parser is local and date-only.",
    highlights: [
      {
        title: "Type the day, get the due date",
        body: "Write Practice 8 AP World questions today and the task is due today; tomorrow, Tuesday, next week, in 3 days, weekend and on Nov 20 all resolve, including next Tuesday versus this Tuesday and January dates that roll to next year. A leading by, on, for or due leaves with the date, so Read it by Friday keeps a clean title.",
      },
      {
        title: "Everywhere tasks are added",
        body: "The Task list, the Study Workspace task form and the Focus day scratchpad all read the title the same way. The scratchpad chips the result as Due today, Due tomorrow or Overdue, and both full surfaces hint at the trick under their add forms.",
      },
      {
        title: "An explicit date always wins",
        body: "Picking a date in the date field keeps the title exactly as typed — the words are only read when no date was chosen. Ordinary words never parse: may need review and plain titles stay dateless, and only the first date expression in a title is used.",
      },
      {
        title: "Local and date-only by design",
        body: "Surveyed MIT plugins solve this with chrono or a server-shaped engine, which would blow the startup bundle budget this plugin holds. The closed expression set here is dependency-free original code, times of day are never read, and nothing leaves the device.",
      },
    ],
  },
  {
    version: "1.303.0",
    date: "November 15, 2026",
    title: "Focus day: the calendar, the timer and quick tasks in one pane",
    summary:
      "A line-by-line comparison with the Deadline plugin showed its month calendar, Pomodoro timer and task list all live here in deeper forms — except four gaps, now closed: a combined Focus day pane, day-click daily notes, inline timer lengths, and a distinct break bar.",
    highlights: [
      {
        title: "One pane for the day",
        body: "Open Focus day shows a small month calendar, the Pomodoro timer and a quick task list together. The palette command joins the existing view commands; the timer stays live because the shared refresh path repaints it.",
      },
      {
        title: "Any day opens its daily note",
        body: "Clicking a calendar day creates or opens that date's YYYY-MM-DD note — the Time blocks daily-note folder when one is set, else the vault root — from a starter template with a Schedule section the planner can sync, opened in a new tab with a short confirmation.",
      },
      {
        title: "Timer lengths, edited where the timer lives",
        body: "Adjust beside the Pomodoro and Focus day controls edits focus, short and long minutes inline with Save and Cancel, clamped to 1–180 minutes, resetting a paused timer to the new length. Break phases now fill the progress bar green so a glance says which kind of interval is running.",
      },
      {
        title: "Deadline parity, MCQ depth kept",
        body: "Everything else Deadline does already existed here: the month calendar with classes and exams, work/short/long breaks with counts and optional autostart, a persistent tagged task list with due dates, and the completion chime. The new scratch list is deliberately session-only — a complement, not a second task system — and no Deadline code was reused.",
      },
    ],
  },
  {
    version: "1.302.7",
    date: "November 15, 2026",
    title: "Notes land in the vault no matter where OpenCode runs",
    summary:
      "A 100-file overnight run caught the import agent resolving its note folder against its own working directory: with a server started outside the vault, two finished notes landed beside the vault while the file recorded done with zero notes. The prompt now uses absolute vault paths, and a queue parked mid-write names the reason in the log.",
    highlights: [
      {
        title: "Absolute paths in the agent prompt",
        body: "The prompt told the agent that paths were relative to the folder it works in, which is only the vault for a server the plugin started itself. With your own server started anywhere else, note writes landed outside the vault. The prompt now passes absolute vault paths and says to use them exactly as written, so they resolve the same from any working directory.",
      },
      {
        title: "A parked queue names its reason",
        body: "A spent free tier parks the queue mid-write as well as mid-check, but only the checks side recorded why. The write-side park now stores the provider's sentence too, so the morning log reads Paused followed by the reason instead of a bare paused status.",
      },
      {
        title: "Proved on a live 100-file queue",
        body: "One hundred distinct one-page PDFs ran end to end on the current build against an exhausted free tier: the queue parked with its files pending instead of failing them, the journal kept the one attempted file's state, and the log counted every file. The misplaced notes were found outside the vault with matching content, confirming the diagnosis.",
      },
      {
        title: "The notice says what happened",
        body: "Parking still ends with one plain sentence naming the spent tier and the wait, and waiting files stay pending so a resume retries them. Files already imported are kept.",
      },
    ],
  },
  {
    version: "1.302.6",
    date: "November 15, 2026",
    title: "Empty folders from failed imports clean up with one command",
    summary:
      "A run that fails before writing a note can leave its empty folder behind, and undo has nothing to remove when no notes were kept. Clean up empty import folders deletes every empty folder under the import parent, deepest first, and never touches a folder holding a file.",
    highlights: [
      {
        title: "One command for the leftovers",
        body: "The command palette's Clean up empty import folders walks the import folder and removes each empty directory, so a chain of empty folders goes too. A notice says how many folders went and that notes were not touched.",
      },
      {
        title: "A note anywhere inside keeps its folder",
        body: "Each folder is listed again right before removal and only a folder still holding nothing goes: a folder holding any file at all is left alone, whatever the file is. Folders with notes, source copies or anything else stay exactly as they are.",
      },
      {
        title: "Never mid-import",
        body: "The command refuses while an import is working, when a target folder can be briefly empty between the folder write and the first note, and says to run it after the import finishes.",
      },
      {
        title: "The notice says what happened",
        body: "Either way the result is one plain sentence: how many empty folders went, or that there were none, always ending with the promise that notes were not touched.",
      },
    ],
  },
  {
    version: "1.302.5",
    date: "November 15, 2026",
    title: "A spent free tier says so in seconds",
    summary:
      "OpenCode reports a provider failure on its own event stream, not on the message an import polls, so an exhausted free tier used to look like a model that wrote nothing for six minutes, and every file in a batch was restarted and failed. The import now reads that status and reports the provider's words at once, a slow chapter gets longer than six quiet minutes, and an OpenCode you run yourself is never booted behind your back.",
    highlights: [
      {
        title: "The provider's reason is read, not guessed",
        body: "OpenCode leaves an empty, unfinished message behind a failed request and puts the reason on its event stream as a session status: Free usage exceeded, subscribe to Go; a rate limit; or a rejected key. Both paths read it now: an import follows that stream while a file runs and stops the file with those words within seconds, and an answer check that is blocked on a send does the same, instead of waiting out a silence allowance each time.",
      },
      {
        title: "Overnight queues park instead of failing a hundred files",
        body: "A spent free tier lasts until it resets, so the overnight queue now pauses with the reason and keeps its place, exactly as it does for a spent request cap. Waiting files are not marked failed, and the morning log names the pause and the reason the provider gave.",
      },
      {
        title: "A long chapter gets the time it needs",
        body: "The silence allowance still exists for a frozen request, but it now grows with the document: about one extra second per thousand tokens of its own text, capped at twenty minutes. A slow model reading a big chapter is no longer cut off at six minutes.",
      },
      {
        title: "Your own OpenCode stays yours",
        body: "With a server you run yourself, an import only checks that the address answers. It no longer starts the plugin's managed copy, whose cold start could take longer than twenty seconds and fail a file the healthy server would have imported; a dead address is reported in seconds with what to do.",
      },
    ],
  },
  {
    version: "1.302.4",
    date: "November 15, 2026",
    title: "An overnight run reports what it really did",
    summary:
      "Starting a queue with the window's overnight button now creates the same journal as the command, so the morning summary counts the files and notes it wrote, the log is saved, and a run that fails every file says so instead of reporting zeros. A file that fails before writing a note no longer leaves an empty folder and images folder behind.",
    highlights: [
      {
        title: "The queue is journaled from either start button",
        body: "Start overnight on the import window used to mark the run unattended without creating its journal. The closing notice then counted a missing run as 0 files and 0 notes, no Overnight import log.md was written, and pause, resume and undo had nothing to work from. Both start buttons now journal the files they hold before anything is written.",
      },
      {
        title: "A failure is reported, not rounded to zero",
        body: "The summary now says how many notes were written out of how many files, and names the first failure with the provider's own words. A run that imported nothing reads as a stopped run with a reason, not as a successful empty import.",
      },
      {
        title: "No empty folder per failed PDF",
        body: "A file that fails before writing a note removes its copied PDF, extracted text, images folder and the folder it created, while notes that were written are kept and a folder holding a pre-existing note is never touched.",
      },
      {
        title: "Checked on a real overnight run",
        body: "Three PDFs were queued with the window's overnight button against an unreachable OpenCode, and all three failed. Each file's folder was removed, the journal recorded all three errors, the log note was written with Files: 3 (0 done), and the closing notice read 0 notes from 0 of 3 files, 3 failed with the provider reason.",
      },
    ],
  },
  {
    version: "1.302.3",
    date: "November 15, 2026",
    title: "A slow model is no longer mistaken for an empty one",
    summary:
      "A model that is still reading a long prompt used to be reported as a provider that sent no reply, so an import stopped after two minutes. Only a finished message with no content is treated as empty now, while a real refusal is still reported just as quickly.",
    highlights: [
      {
        title: "Still working is not empty",
        body: "OpenCode creates the assistant message before the model starts answering. An unfinished message with no parts is now a model reading a long prompt, not a refused request, so a slow local model or a busy provider is allowed to answer.",
      },
      {
        title: "Refusals stay fast",
        body: "A provider that rejects the request finishes the message empty within seconds, and that is still reported with the provider's own words instead of waiting out a silence allowance.",
      },
      {
        title: "Same guard, one condition",
        body: "Both the blocking send used by answer checks and the import's progress poll now require the message to be finished before calling it empty. The timeouts, restart rules and Stop behavior are unchanged.",
      },
      {
        title: "Checked on a real three-file import",
        body: "Three PDFs imported together with the free OpenCode models wrote six notes, and all six verifications matched. The fix is covered by a test that keeps an unfinished empty message from being failed.",
      },
    ],
  },
  {
    version: "1.302.2",
    date: "November 14, 2026",
    title: "An exhausted free model no longer stops an import",
    summary:
      "A free OpenCode model that hits its usage limit used to end the file. The import now asks the same file of the next free model, up to three times, and the checks follow whichever model actually replied. Dead providers are also reported in seconds instead of minutes.",
    highlights: [
      {
        title: "Another free model, same file",
        body: "A quota, rate-limit or empty reply now sends the same file prompt to the next free model in your provider's list, in a fresh session, up to three switches. Nothing was written yet, so no note can be duplicated.",
      },
      {
        title: "Only free models, only quota errors",
        body: "The next model must be free and come from the same provider. A paid model is never charged to dodge a limit, and a disk or PDF error still ends the file with its own reason instead of rotating models.",
      },
      {
        title: "Checks follow the model that replied",
        body: "Blind answer checks for that file now use the fallback model, and the note records it, so a switched import is verified by the same model that wrote it instead of failing on the exhausted one.",
      },
      {
        title: "Failures arrive in seconds",
        body: "A provider error inside a live request is reported at once, an assistant message with no content fails after 90 seconds, and an empty import reply stops after 2 minutes instead of the old 6-minute wait.",
      },
      {
        title: "Fewer detours per file",
        body: "The import prompt now reads the extracted text, writes the notes immediately and runs one folder check last, so the agent spends its time writing notes rather than exploring the vault.",
      },
    ],
  },
  {
    version: "1.302.1",
    date: "November 14, 2026",
    title: "Multi-PDF imports finish",
    summary:
      "A blind answer check that wandered off — using shell tools, then going silent — held a multi-file import on \"Checking answer...\" for tens of minutes. Checks now run with no tools, the example answers can no longer be echoed, and a silent run is stopped before it is reported so the batch moves on.",
    highlights: [
      {
        title: "Checks use no tools",
        body: "The blind check is a pure question-and-answer task, so the prompt now forbids tool use. A model can no longer list the vault or run shell commands in the middle of a check.",
      },
      {
        title: "Examples nothing can echo",
        body: "The prompt's example answers were literal letters and numbers a lazy model could repeat. They are neutral placeholders now, so an echoed example can never verify a note.",
      },
      {
        title: "Silent runs are stopped",
        body: "When a check goes quiet past its allowance, its server session is aborted before the silence is reported, so a retry never stacks onto a zombie run and the import keeps moving.",
      },
      {
        title: "The batch keeps moving",
        body: "A check that still fails is marked as an error with needs-review instead of holding the batch, and the completion summary keeps its per-file note counts.",
      },
    ],
  },
  {
    version: "1.302.0",
    date: "November 14, 2026",
    title: "Overnight imports",
    summary:
      "Queue a hundred PDFs with Import files overnight: every note is written first, every answer is then blind-checked two at a time, and a reload, a spent AI budget or a rate limit pauses the queue instead of failing it. Disagreements land on the Flagged answers surface.",
    highlights: [
      {
        title: "Write first, verify second",
        body: "The run writes all notes, then checks every answer two at a time and patches only the check frontmatter. Nothing is dropped: a mismatch is kept, flagged and listed with the stored answer, the checker's answer, the models that voted and the date.",
      },
      {
        title: "Pauses instead of failing",
        body: "A reload, a spent daily or per-run AI budget, or a 429 waits with Retry-After and retries. The run parks as paused with its queue intact, shows one notice, and resumes where it stopped with no duplicate notes.",
      },
      {
        title: "Flagged answers",
        body: "Show flagged answers lists every disagreement with Open note, Re-check, Accept stored answer and Drop, plus Re-check all. Accepting marks the stored answer as standing; everything reuses the existing frontmatter fields.",
      },
      {
        title: "One log in the morning",
        body: "Overnight import log.md records a per-file table (notes, matched, flagged, write and check times, median check duration) and the phased progress stays visible in the window: Writing notes, then Checking answers.",
      },
    ],
  },
  {
    version: "1.301.30",
    date: "November 13, 2026",
    title: "A provider error is reported when it happens",
    summary:
      "When OpenCode's provider refuses a file (a rate limit, a rejected key, an overloaded model), the import now says so at once with the provider's own words instead of waiting minutes and calling it a frozen server.",
    highlights: [
      {
        title: "The real reason, immediately",
        body: "OpenCode reports provider failures as an assistant message with an error and no content. The import reads that error and shows it, so a rate limit or a key problem is no longer mistaken for silence.",
      },
      {
        title: "What to do next",
        body: "A rate or usage limit says to wait a few minutes and import the file again; anything else points at the AI settings, backend, model and key. Files already imported are kept either way.",
      },
      {
        title: "No pointless restart",
        body: "A provider error is not a server problem, so OpenCode is not restarted and the batch does not wait six minutes twice before failing.",
      },
      {
        title: "Nothing else changed",
        body: "The silent-server guard, the answer-check recovery, Stop/Undo/Discard and the note format all behave exactly as in 1.301.29.",
      },
    ],
  },
  {
    version: "1.301.29",
    date: "November 13, 2026",
    title: "An import cannot sit on a silent agent forever",
    summary:
      "If the OpenCode agent stops writing notes, the import now says so, restarts OpenCode once and starts that file again instead of waiting indefinitely.",
    highlights: [
      {
        title: "Silence is measured",
        body: "Six minutes with no note written and no tool call started or finished is a stalled file. A slow document is untouched: every note, tool call and finished step resets the clock, so a 100-page PDF can still take as long as it takes.",
      },
      {
        title: "Restart, then start the file again",
        body: "Nothing was written, so the file is started again in a fresh OpenCode session after the server is restarted. No note is duplicated and no work is lost.",
      },
      {
        title: "A plain reason when it cannot recover",
        body: "If the restarted agent stays silent, the file ends with a sentence naming how long it was quiet, what it was last doing, and whether any notes were already written, and the batch moves on.",
      },
      {
        title: "Stop still wins",
        body: "Stop, Undo, Discard and closing the window still cancel immediately, and an agent with notes already written is never silently re-prompted. No note format or setting changed.",
      },
    ],
  },
  {
    version: "1.301.28",
    date: "November 13, 2026",
    title: "A frozen check recovers on every OpenCode setup",
    summary:
      "If you run OpenCode yourself instead of letting the plugin start it, a frozen answer check now asks the question again instead of stopping to look for an OpenCode copy to install.",
    highlights: [
      {
        title: "Your own server is left alone",
        body: "Recovery only stops and restarts the copy this plugin started. A server you run in a terminal is never killed, never re-downloaded and never replaced.",
      },
      {
        title: "Still the same question",
        body: "The identical blind check is sent again with the same model, so the note ends up verified rather than kept unchecked.",
      },
      {
        title: "Honest wording",
        body: "The checking line says this same answer is asked again and no longer promises a restart that a manual server cannot have.",
      },
      {
        title: "Checked against a real frozen server",
        body: "A managed server was frozen on purpose: the six-minute silence guard noticed, the server was restarted on a new port, the identical prompt was sent again, and the answer verified. Nothing about note format or settings changed.",
      },
    ],
  },
  {
    version: "1.301.27",
    date: "November 13, 2026",
    title: "A frozen answer check restarts OpenCode and asks again",
    summary:
      "When a check stops answering, the plugin now restarts OpenCode, says so on the checking line, and asks that same question again, so the note is verified instead of being left unchecked.",
    highlights: [
      {
        title: "Restart, then ask the same question",
        body: "A check that reports nothing new for the allowed time restarts the managed OpenCode server and re-sends the identical question with the same model, so one frozen request no longer costs a note its check.",
      },
      {
        title: "Said on the same line",
        body: "Checking answer 4 of 27 now adds a short note when the server is restarted and again when the answer arrives, so the pause has a reason on screen.",
      },
      {
        title: "Only connection trouble is retried",
        body: "A reply that arrives but makes no sense is not retried: the note keeps its check result and the import moves on, so a bad model answer cannot loop.",
      },
      {
        title: "Stop still wins",
        body: "If you stopped the import or closed the window, nothing is restarted. Direct AI asks once more without any restart. No note format, setting or review date changed.",
      },
    ],
  },
  {
    version: "1.301.26",
    date: "November 13, 2026",
    title: "A waiting answer check shows its age",
    summary:
      "The line that says which answer is being checked now counts seconds, so a check that has stopped moving is obvious in a minute instead of hours. Nothing about how long a check may take has changed.",
    highlights: [
      {
        title: "The wait counts up",
        body: "Checking answer 4 of 27 now reads (2:14) after two minutes and keeps counting, so an import can no longer sit on a frozen sentence unnoticed.",
      },
      {
        title: "Every check path shows it",
        body: "The note-by-note check during an import and the check after a review both count. The clock stops when the answer arrives and the last line stays on screen.",
      },
      {
        title: "No new limit",
        body: "The count is information, not a deadline. A slow model still gets as long as it needs, and the client's own idle guard is what ends a request that truly stopped answering.",
      },
      {
        title: "Stop still works",
        body: "Stop, Undo everything, Finish this file and closing the window end the wait, exactly as before. No note format, setting or review date changed.",
      },
    ],
  },
  {
    version: "1.301.25",
    date: "November 13, 2026",
    title: "The gear goes straight to AI settings",
    summary:
      "The Study agent's Settings gear now opens AI and the assistant directly instead of whichever plugin page was last open. The final three audit rows are closed, with the math and screenshot passes checked in a real window and the mobile layout verified by its focused tests.",
    highlights: [
      {
        title: "Settings no longer depends on your last visit",
        body: "The gear used to open the plugin's default or previously active page, so a fresh install landed on Global instead of the AI controls. It now opens AI and the assistant directly, just like the error card's Open settings action.",
      },
      {
        title: "Math and chemistry checked in the real app",
        body: "Practice, the four choices, review, explanation, a timed test, card front and back, and chat all rendered fractions, a matrix, an integral and simple chemistry formulas in light, dark and a narrow pane. No renderer bug was found.",
      },
      {
        title: "The screenshot row is real",
        body: "The README links 16 real-window PNGs plus 26 full-size frames under docs/images; every referenced file exists, and no mock capture is presented as a screenshot.",
      },
      {
        title: "Mobile audited at code level",
        body: "All 18 focused mobile-layout tests pass and a narrow live render was checked. No physical iOS or Android device was available, so no device result is claimed and the optional owner checklist stays in the docs.",
      },
    ],
  },
  {
    version: "1.301.24",
    date: "November 13, 2026",
    title: "Every settings error shows the fix",
    summary:
      "Provider errors now carry a configuration kind instead of relying on the word settings. Invalid base URLs, unknown models, OpenCode credential/version failures and no-provider replies all get Retry plus Open settings, and 401 copy is no longer doubled.",
    highlights: [
      {
        title: "Errors say what kind of fix they need",
        body: "The API client marks missing values, rejected keys, unknown models and unsafe base URLs with a configuration kind. The chat panel reads that kind first, so a helpful button no longer depends on the exact wording of an error.",
      },
      {
        title: "Model and base-URL dead ends are gone",
        body: "A provider 404 for an unknown model, a 400 that rejects the model or request limits, and an http:// remote base URL now explain what to change and draw Open settings beside Retry.",
      },
      {
        title: "OpenCode failures get the same action",
        body: "OpenCode credentials rejected, a server version mismatch, no connected provider, and the reply that says a provider is connected all point at AI and the assistant with a working settings control.",
      },
      {
        title: "A live 401 no longer repeats itself",
        body: "The live run showed the 401 sentence twice. Friendly provider copy is now left alone when it is already friendly, and the re-run showed one sentence, one Retry and one Open settings, then recovered through Retry.",
      },
    ],
  },
  {
    version: "1.301.23",
    date: "November 13, 2026",
    title: "The error card has the fix",
    summary:
      "The missing-key error in the chat panel now offers Open settings beside Retry, opening the AI page directly. The same action appears on every provider error whose fix is a setting.",
    highlights: [
      {
        title: "Missing key is one click from fixed",
        body: "Add your API key in the plugin settings used to be a dead end with only Retry. Open settings now sits beside Retry and opens the AI and the assistant page.",
      },
      {
        title: "The same control wherever a setting is the fix",
        body: "A missing base URL or model, an OpenCode server with no provider, OpenCode credentials rejected, and a provider that rejects the key or model all show the settings action too.",
      },
      {
        title: "Retry still works",
        body: "The header gear and Retry are unchanged. After the key was restored, Retry sent the same question and the reply rendered with its usual actions.",
      },
      {
        title: "Verified in a live window",
        body: "Driven with a seeded question in headless Obsidian: the missing-key card appeared, Open settings landed on AI backend / Enable AI features, and Retry recovered once the provider answered.",
      },
    ],
  },
  {
    version: "1.301.22",
    date: "November 13, 2026",
    title: "AI failures tell you what to fix",
    summary:
      "The assistant was driven live with an unreachable provider, a rejected key, a cancelled reply, no key and AI turned off. Every failure names the next step, Retry recovers once the provider is back, and the AI-off panel now has a settings button.",
    highlights: [
      {
        title: "The AI-off panel has a way forward",
        body: "It used to name a settings path in a paragraph with no control and call every setup OpenCode. It now says AI is turned off and draws Open settings, which opens the right settings tab.",
      },
      {
        title: "A rejected key is not a network failure",
        body: "HTTP 401 now says the provider rejected the API key or cannot use the model, and keeps the provider's reason. An unreachable server keeps its own connection and base-URL message.",
      },
      {
        title: "Stop ends the wait cleanly",
        body: "While a provider holds the request open, Stop is present; pressing it clears the spinner and says the reply was stopped, with Retry still available. No spinner is left behind.",
      },
      {
        title: "The import preflight explains both outcomes",
        body: "A damaged PDF says why it cannot be read and offers another file or offline paste; a readable one shows its page count and opens the AI connection dialog when AI is off.",
      },
      {
        title: "Recovery was observed, not assumed",
        body: "After the provider was restored, Retry sent the same question and the reply rendered with its usual actions. No note format, setting key, review schedule or network default changed.",
      },
    ],
  },
  {
    version: "1.301.21",
    date: "November 13, 2026",
    title: "Every dialog works with real content",
    summary:
      "The five dialogs that had nothing to show on an empty vault were driven with real PDFs, questions and a due note. Recent files' real cause is fixed, the due queue's Practice button starts a session, and a five-minute session no longer announces five minutes remaining.",
    highlights: [
      {
        title: "Recent files opens for real",
        body: "Its row opener was named open, which is Obsidian's own lifecycle method, so attaching the leaf called it with no path. Renamed, and the live window now draws the list with no error in the log.",
      },
      {
        title: "Practice N due questions practises them",
        body: "New questions were listed as due and then filtered out by the due mode. The due queue now starts exactly the items it shows, from the row button and the bulk button.",
      },
      {
        title: "No five-minute notice at the start",
        body: "A five-minute session begins at the warning threshold, so it used to announce five minutes remaining immediately. Only longer sessions warn now.",
      },
      {
        title: "Empty and failed dialogs explain themselves",
        body: "Find a question and Practice a folder say to add questions first, and a Practice view that cannot open says what to check.",
      },
      {
        title: "Notices were read, not guessed",
        body: "This pass captured rendered notice text in every window, including annotation saved, invalid deep link, import review and damaged-PDF messages. No note format, setting key, review schedule or network default changed.",
      },
    ],
  },
  {
    version: "1.301.20",
    date: "November 13, 2026",
    title: "Recent files opens cleanly",
    summary:
      "Opening Recent files no longer writes a failed-to-open error to the log while it draws the list. Nothing else changed.",
    highlights: [
      {
        title: "No error in the log",
        body: "The view no longer claims a file it does not have, so Obsidian's leaf restore cannot fail on an empty path.",
      },
      {
        title: "The same list",
        body: "Rows, pins, the search filter and the files it opens are unchanged.",
      },
      {
        title: "Why it happened",
        body: "The view claimed a file it never had, so Obsidian's restore step looked up an empty path. It now reports no state at all.",
      },
      {
        title: "Nothing else moved",
        body: "No note format, setting key, review schedule or network default changed.",
      },
    ],
  },
  {
    version: "1.301.19",
    date: "November 13, 2026",
    title: "Three dead ends removed",
    summary:
      "Every command, view and settings page was driven in a real Obsidian window. Adding a note to review, the assignment dialog and a vault file handed to the importer now work.",
    highlights: [
      {
        title: "Add to review works",
        body: "The palette command, the file menu and the review sidebar's plus button now add the open note to whole-note review instead of failing with an error.",
      },
      {
        title: "The assignment dialog opens",
        body: "Points, points earned, weight and time estimate render as number fields instead of stopping the dialog before it draws.",
      },
      {
        title: "Files already in the vault import",
        body: "A PDF that is already in your vault is read by its path, and a file with no readable bytes explains how to pick it again.",
      },
      {
        title: "Nothing else moved",
        body: "No note format, setting key, review schedule or network default changed. The release also records what the live window could not reach.",
      },
    ],
  },
  {
    version: "1.301.18",
    date: "November 13, 2026",
    title: "Stop is answered at once",
    summary:
      "A Stop pressed while the plugin is checking whether OpenCode still answers now ends the check immediately and stays stopped. Nothing else changed.",
    highlights: [
      {
        title: "The Stop press is answered now",
        body: "Pressing Stop during the quick OpenCode check no longer waits for the ten-second ping to give up; the message appears at once.",
      },
      {
        title: "Nothing is announced for a server you stopped",
        body: "The window no longer says it is restarting OpenCode when you have just stopped it, and nothing starts in the background.",
      },
      {
        title: "Checked in a real Obsidian window",
        body: "This release was verified in an actual Obsidian 1.15.1 window: the settings Start/Stop controls, the running status line, a frozen server that recovers, and the import popout.",
      },
      {
        title: "Nothing else moved",
        body: "No note format, setting key, review schedule or network default changed; the only difference is how quickly and how plainly a Stop is answered.",
      },
    ],
  },
  {
    version: "1.301.17",
    date: "November 13, 2026",
    title: "A stopped OpenCode stays stopped, and long checks keep counting",
    summary:
      "The quiet checks that keep OpenCode and the blind answer checks healthy now say what they are doing and can always be stopped. No note format, review schedule or network default changed.",
    highlights: [
      {
        title: "Stop really stops",
        body: "Pressing Stop, or closing Obsidian, while the plugin is checking a silent OpenCode server no longer starts a fresh one behind your back; the check ends and says how to start it again.",
      },
      {
        title: "A second try is announced",
        body: "When OpenCode is running but misses the first quick check, the window says it is asking once more instead of looking frozen for ten seconds.",
      },
      {
        title: "No setup notice on every request",
        body: "The \"Setting up OpenCode...\" notice now appears only when a start, repair or restart is really happening, not on every request through a server that is already running.",
      },
      {
        title: "Long answer checks keep counting",
        body: "The import window names the answer being checked (answer 2 of 5) for AI-written answers too, and stopping or closing it ends the remaining paid checks instead of running them unseen.",
      },
    ],
  },
  {
    version: "1.301.16",
    date: "November 13, 2026",
    title: "Failure messages name what to do next",
    summary:
      "Every local save, import, restore and settings write that fails now says what it was doing and what to check, instead of showing a raw error. Nothing about requests, formats or schedules changed.",
    highlights: [
      {
        title: "The operation and the next step",
        body: "A failed save, import, restore or sync names the operation (the simple-quiz result, the provider key, the schedule, the card review) and says what to check before trying again.",
      },
      {
        title: "No more raw errors",
        body: "Technical details such as permission denials are kept as the reason inside a plain sentence, so the message stays readable and the detail is not lost.",
      },
      {
        title: "Nothing else moved",
        body: "No note format, setting key, review schedule or network behaviour changed; timed-test restores still explain themselves instead of silently resetting.",
      },
      {
        title: "Guarded going forward",
        body: "An automated check now fails if any future message ever shows a raw error again, so this cleanup cannot quietly regress.",
      },
    ],
  },
  {
    version: "1.301.16",
    date: "November 13, 2026",
    title: "Answer checks wait, and OpenCode recovers after sleep",
    summary:
      "Blind answer checks no longer have a time limit, so a slow model can take as long as it needs and the note still gets verified. The managed OpenCode server is also pinged before each use, and a server left half-dead by the computer sleeping is restarted instead of stalling the next file.",
    highlights: [
      {
        title: "No time limit on the checks",
        body: "Each blind answer check runs until the model answers. A reply that arrives late still verifies the note; stopping the import still cancels the wait.",
      },
      {
        title: "A dead server is restarted",
        body: "Before each file, the plugin asks the running OpenCode server if it is still answering. Twice with no answer means it is stopped and started fresh, with that said on screen.",
      },
      {
        title: "The next file no longer waits forever",
        body: "A process handle that survived the computer sleeping can look alive while nothing answers it. The ping catches that, so the second and later files start instead of sticking on Starting OpenCode.",
      },
      {
        title: "Nothing to set up",
        body: "No new setting and no format change. Existing notes, models, settings and review dates are unchanged.",
      },
    ],
  },
  {
    version: "1.301.15",
    date: "November 13, 2026",
    title: "Pick the extra check models from a list",
    summary:
      "The models for the extra answer checks are now chosen from a list of models this device already knows, so a mistyped name cannot quietly cost a vote. A model that is not in the list can still be entered on purpose.",
    highlights: [
      {
        title: "Three pickers, no typing",
        body: "Settings, AI, Session pacing and checks shows Extra check model 1, 2 and 3 as dropdowns. Same as the first check keeps the model chosen for Check AI-written answers.",
      },
      {
        title: "Only names that exist",
        body: "The list is built from the models your provider returned, the models saved for other AI features and the ones already chosen here. A typo cannot get in.",
      },
      {
        title: "Other model, when you mean it",
        body: "Choosing Other model opens one text field for that slot, so a provider whose list was never fetched can still be used deliberately.",
      },
      {
        title: "What you already had keeps working",
        body: "Models saved by the previous version appear in their pickers, and the order and repeat rule for the extra passes are unchanged.",
      },
    ],
  },
  {
    version: "1.301.14",
    date: "November 13, 2026",
    title: "The extra checks can use other AIs",
    summary:
      "The extra checks that settle a disputed answer can each run on a model you list, so three passes are no longer three copies of one AI's opinion. Leave the list empty and the chosen check model still does every pass.",
    highlights: [
      {
        title: "List the models to ask",
        body: "Settings, AI, Session pacing and checks has Models for the extra checks: one model per line, up to three, used in order and repeated when there are more checks than models.",
      },
      {
        title: "The first check stays yours",
        body: "The first pass still uses the model chosen for Check AI-written answers, so listing two models gives opinions from three different AIs across four passes.",
      },
      {
        title: "The note says who voted",
        body: "A consensus-checked note now records every model that voted in verified_by, not just the first one.",
      },
      {
        title: "Nothing to set up",
        body: "Leave the list empty to keep the previous behaviour exactly. Existing notes, settings and review dates are unchanged.",
      },
    ],
  },
  {
    version: "1.301.13",
    date: "November 13, 2026",
    title: "Three more checks by default, or two",
    summary:
      "A disputed answer now goes to three more independent checks by default, so four passes in total vote on it, and Settings offers two more instead. The stored answer needs a majority of those passes; a split keeps the note flagged.",
    highlights: [
      {
        title: "Three extra passes by default",
        body: "The first check, then three more blind passes look over any answer that disagrees, so a single odd reply is very unlikely to decide the outcome.",
      },
      {
        title: "Two or three, your choice",
        body: "Settings, AI, Session pacing and checks lists Off, Two more checks (three passes) and Three more checks (four passes) in one dropdown.",
      },
      {
        title: "A split still flags",
        body: "The stored answer counts as verified only when most passes agree with it. Half of the passes, or a panel that settles on another answer, keeps the note flagged with that answer named.",
      },
      {
        title: "No format changes",
        body: "Existing notes stay valid and need no re-import. Review dates, saved settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.12",
    date: "November 13, 2026",
    title: "A disagreement is checked again before it is believed",
    summary:
      "When the independent answer check disagrees with a note's answer, two more blind checks now vote before the note is flagged. The answer is verified only when at least two of the three agree with it, so one odd reply no longer costs a right answer.",
    highlights: [
      {
        title: "One odd answer is not a verdict",
        body: "The first check still runs once per AI-written multiple-choice answer. If it disagrees, two more independent checks run and the stored answer needs a real majority (two of three) to count as verified.",
      },
      {
        title: "A wrong answer is named",
        body: "If the extra checks settle on one different answer, the warning says how many checks ran and which answer most of them chose, instead of the vague a different answer.",
      },
      {
        title: "You only pay on disagreement",
        body: "Extra requests happen only for answers that disagree, never for a clean match. One switch in Settings turns the panel off if you would rather flag the first disagreement at once.",
      },
      {
        title: "No format changes",
        body: "Existing notes stay valid and need no re-import. Review dates, saved settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.11",
    date: "November 13, 2026",
    title: "The answer check now runs on section-only keys",
    summary:
      "An agent note whose key is written only under Answer used to skip the independent answer check and stay marked unverified. The check now reads that key, so a finished import is verified the same way whichever place the key was written.",
    highlights: [
      {
        title: "Verification was skipped, not failed",
        body: "The check only ran when a note had an answer property to compare against, so a key written under Answer silently skipped it. Now that key is read, checked, and the result saved.",
      },
      {
        title: "Same reader everywhere",
        body: "Practice, the import audit and the answer check all resolve the key through one function, so they cannot disagree about whether a note has an answer.",
      },
      {
        title: "Notes say what was checked",
        body: "The result is saved on the note (verified, verified by, verified on, verification: match), so you can see that an answer was independently confirmed.",
      },
      {
        title: "No format changes",
        body: "Existing notes stay valid; already-imported notes do not need re-importing. Review dates, settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.10",
    date: "November 13, 2026",
    title: "Answers written in the Answer section count",
    summary:
      "An import no longer reports notes as having no answer when the key is written under Answer instead of in the properties, and a free-response question with a model response is no longer called unanswered. The answer is also copied into the note's properties, so grading and checks see it.",
    highlights: [
      {
        title: "The Answer section is enough",
        body: "If a note shows **Correct Answer: C** under Answer but has no answer property, the import now reads it, writes it as the answer, and stops listing the note under No answer.",
      },
      {
        title: "Words and full choices work too",
        body: "Choice C, the full text of a choice, or an answer written as a sentence are recognised instead of being dropped when they are not a plain letter.",
      },
      {
        title: "Free-response notes are not broken notes",
        body: "A question with no answer choices and a written model response (for example the AP World a/b/c prompts) is treated as self-graded instead of being listed as needing a look.",
      },
      {
        title: "No format changes",
        body: "Existing notes stay valid; already-imported notes do not need re-importing. Review dates, settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.9",
    date: "November 13, 2026",
    title: "No time limit, and a one-press OpenCode check",
    summary:
      "A file is never stopped for taking a long time, so a 100-page PDF can finish on its own. When OpenCode stops answering, the import summary offers a Check OpenCode button that says in plain words whether it is running and restarts it.",
    highlights: [
      {
        title: "No time limit at all",
        body: "The 20-minute cap is gone too. A file now runs until the agent finishes it, you press Stop, Undo everything or Discard this file, or OpenCode stops answering.",
      },
      {
        title: "Check OpenCode, in one press",
        body: "A lost-contact failure now shows a Check OpenCode button under the file list. It restarts the plugin's own server and tells you plainly, for example OpenCode is running 1.19.5 and answering normally.",
      },
      {
        title: "Also a command",
        body: "Run Check that OpenCode is running from the command palette at any time, whether or not an import is open.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.8",
    date: "November 12, 2026",
    title: "No more silence cutoff on the agent",
    summary:
      "The OpenCode agent watchdog no longer stops a file for going quiet: a slow model keeps working until it finishes, you stop it, or a 20-minute absolute backstop ends it. Lost contact with the server still fails fast.",
    highlights: [
      {
        title: "Quiet work is never cut off",
        body: "The old 3-minute silence cutoff is gone, so a long illustrated PDF that keeps the model thinking silently can no longer be stopped at 181s. Stop, Undo everything and Discard this file still end a file the moment you ask.",
      },
      {
        title: "The backstops that stay",
        body: "An unreadable server still fails fast with Lost contact, and a 20-minute absolute cap ends a file that never finishes, naming what the agent was last seen doing and the file-edit permission fix.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
      {
        title: "Covered by a test",
        body: "A quiet agent is proven to run past any silence and stop only at the absolute backstop, with the reason intact.",
      },
    ],
  },
  {
    version: "1.301.7",
    date: "November 12, 2026",
    title: "Long imports get proportional patience",
    summary:
      "The OpenCode agent watchdog now scales its silence allowance with the document length instead of cutting every file off at the same 3 minutes, so a long illustrated PDF can think silently for minutes without being stopped.",
    highlights: [
      {
        title: "Patience grows with the page count",
        body: "A short file keeps the 3-minute allowance; a 100-page file gets over 7 minutes of quiet thinking time, capped at 10 minutes. The timeout message still reports how long the agent was quiet and what it was last seen doing.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
      {
        title: "Covered by a new test",
        body: "The page-count scaling, the 10-minute cap and an explicitly configured base are pinned by tests.",
      },
      {
        title: "Pairs with always-allowed edits",
        body: "Together with 1.301.6, the two watchdog stalls are addressed: the agent is allowed to write, and a slow agent on a long file is allowed the time.",
      },
    ],
  },
  {
    version: "1.301.6",
    date: "November 12, 2026",
    title: "The agent can always write the notes",
    summary:
      "The OpenCode server this plugin starts now always allows file edits, so an import can no longer stall waiting for a permission prompt nobody can answer. Reads, bash and every other permission stay exactly as you set them.",
    highlights: [
      {
        title: "Imports never wait on a permission prompt",
        body: "A stored OpenCode edit permission of ask would leave every note write waiting for an approval that the import window cannot show. The server the plugin runs now starts with edits allowed.",
      },
      {
        title: "Your own OpenCode config is left alone",
        body: "Only file edits are changed. Reads, bash and other permission rules keep your values, and a config you supply yourself through OPENCODE_CONFIG_CONTENT is never overwritten.",
      },
      {
        title: "The vault stays reachable",
        body: "Edits are also allowed inside your vault folder when OpenCode treats it as an external directory, so note files can be written wherever the vault lives.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.5",
    date: "November 12, 2026",
    title: "Import failures that explain themselves",
    summary:
      "A batch summary now keeps each file's reason instead of a bare Could not import, empty errors fall back to an actionable message, and the OpenCode agent watchdog tells lost contact apart from an idle agent while naming its last work and the file-permission fix.",
    highlights: [
      {
        title: "The summary keeps the reason",
        body: "Every failed file in the end-of-batch summary now shows its error text, and files with no notes show why they produced nothing, so a failed import can be acted on.",
      },
      {
        title: "An agent stall names its cause",
        body: "Repeatedly unreadable agent status fails fast with Lost contact, while a quiet agent reports how long it was quiet, what it was last seen doing, and the OpenCode file-edit permission to check. Direct AI (you review first) needs no file permission.",
      },
      {
        title: "Covered by new tests",
        body: "The failure-detail summary, the lost-contact fast path and the idle-agent message are pinned by new tests, and the release inventory is regenerated.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged.",
      },
    ],
  },
  {
    version: "1.301.4",
    date: "November 12, 2026",
    title: "Recover locked installs and protected imports",
    summary:
      "Password-protected PDFs can now ask for their password inside the import window, unreadable files carry a clear next step, and a saved OpenCode install folder is repaired instead of failing to start. Closing an import also stops its outstanding AI wait.",
    highlights: [
      {
        title: "Unlock a protected PDF",
        body: "The import window asks for the password, tries it without saving it, and can retry a wrong one. A batch asks once per file; skipping one protected file leaves the rest of the batch running.",
      },
      {
        title: "Readable failures",
        body: "Empty PDFs, zero-byte documents, corrupt Office files and files over 80 MB now explain what to do next before anything is copied into the vault.",
      },
      {
        title: "Repair a saved OpenCode folder",
        body: "If the saved OpenCode path is its install folder, the app finds the executable inside it. A missing executable is repaired from another installed copy or a confirmed reinstall, and a locked old folder no longer blocks the new copy.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings, provider keys and network defaults are unchanged. PDF passwords stay in memory for this import only.",
      },
    ],
  },
  {
    version: "1.301.3",
    date: "November 11, 2026",
    title: "Keep a stalled answer check from freezing an import",
    summary:
      "Imports now show which imported answer is being checked, and a blind answer check that stops responding is cut off after 60 seconds. The note is kept and the rest of the file continues instead of leaving the import on Checking the notes forever.",
    highlights: [
      {
        title: "A stalled check cannot freeze the import",
        body: "Each blind answer check has a 60-second limit. A timeout is recorded as a verification error on that note, so the file finishes and the batch moves to the next PDF.",
      },
      {
        title: "See which answer is being checked",
        body: "The import window and main-window progress now name the note being checked and its position in the file instead of leaving one generic Checking the notes message on screen.",
      },
      {
        title: "The rest of the batch keeps going",
        body: "A timed-out check no longer holds up the current PDF or the files queued after it. The summary still reports the file as imported, and the note keeps its imported answer for you to review.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, saved settings and provider keys are unchanged. A timeout keeps the imported question rather than deleting it.",
      },
    ],
  },
  {
    version: "1.301.2",
    date: "November 11, 2026",
    title: "Stop an import cleanly",
    summary:
      "The running import now offers Undo everything, Finish this file then stop, and Discard this file. Hanging AI or OpenCode requests end promptly, stopped work is cleaned up, and the summary says what was kept, stopped or undone.",
    highlights: [
      {
        title: "Three explicit stop choices",
        body: "Undo everything removes the notes, source copies and pictures this import made. Finish this file then stop saves the current file before stopping. Discard this file keeps finished files and removes only the current one.",
      },
      {
        title: "Hanging requests end promptly",
        body: "Stopping cancels the in-flight AI or OpenCode wait instead of leaving it running. A stalled OpenCode send is aborted, and a hanging Direct AI request leaves nothing behind.",
      },
      {
        title: "Honest stopped summaries",
        body: "Stopped batches report the files that finished, the current file marked Stopped, and any failures. An undone import reports the removed files and keeps the Practice button hidden.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, cards, saved settings and provider keys are unchanged; existing imports and practice sessions keep working.",
      },
    ],
  },
  {
    version: "1.301.1",
    date: "November 10, 2026",
    title: "Batch import from the import window",
    summary:
      "Choose PDFs from the separate import window, add another file while the first is importing, keep the main-window progress after closing it, and practice the exact folder the batch filled.",
    highlights: [
      {
        title: "Pick files in the import window",
        body: "The source chooser opens from the button's own window, so the desktop popout can select several PDFs before the import starts.",
      },
      {
        title: "Add a PDF mid-import",
        body: "Add more files on the running or review screen queues another PDF; a single import becomes a batch and the notice totals move from 1 of 1 to 1 of 2 and 2 of 2.",
      },
      {
        title: "Progress outlives the window",
        body: "Closing the import window leaves the live notice in the main window, and refocusing the main window keeps the session, review and queue running to completion.",
      },
      {
        title: "Practice the imported folder",
        body: "The completion summary reports the true file and note counts, and Practice these questions opens the imported parent folder with the new questions.",
      },
      {
        title: "No format changes",
        body: "Question notes, review dates, cards, saved settings and provider keys are unchanged; existing imports and practice sessions keep working.",
      },
    ],
  },
  {
    version: "1.301.0",
    date: "November 10, 2026",
    title: "Import a batch, practice the result",
    summary:
      "Import several PDFs, PowerPoint or Word files at once, follow the queue from the main window while the import runs in its own desktop window, and start practicing the imported folder when the batch finishes.",
    highlights: [
      {
        title: "Several files, one batch",
        body: "The source picker accepts multiple documents. Each file gets its own review and subfolder, and a file that fails is recorded without stopping the rest of the queue.",
      },
      {
        title: "Progress that stays visible",
        body: "The main window keeps a live notice with the current file, queue position, stage and progress bar. It keeps updating when you click away or close the import window.",
      },
      {
        title: "A real import window",
        body: "On desktop the importer opens in a separate Obsidian window. Closing that window does not cancel the batch; run the import command again to return to the same panel and review.",
      },
      {
        title: "Practice what you imported",
        body: "When the batch finishes, the summary lists every file and offers Practice these questions. The button opens Practice on the imported parent folder, including after a partial failure.",
      },
      {
        title: "A clearer interface",
        body: "A shared design-token layer now drives type, spacing, colour, focus, motion and target sizes across the plugin, with stronger light and dark contrast and a keyboard-friendly statistics heatmap.",
      },
      {
        title: "No format changes",
        body: "Question notes, cards, review dates, saved settings and provider keys are unchanged. Existing imports keep working.",
      },
    ],
  },
  {
    version: "1.300.0",
    date: "November 10, 2026",
    title: "Questions from more places",
    summary:
      "Find or generate quiz questions now starts from your notes, a plain-language brief, pasted text, or up to three PDFs, and file import checks that a document is readable before it asks for AI or writes anything.",
    highlights: [
      {
        title: "Four ways to ask",
        body: "Choose My notes to search your folders, My prompt for original questions from the model's own knowledge, PDFs in my vault, or Text I paste. Prompt mode does not browse the web.",
      },
      {
        title: "A readable file first",
        body: "Import reads the PDF, PowerPoint or Word text locally before AI setup. A scanned file explains the OCR fix and leaves your vault untouched; the offline paste route stays visible.",
      },
      {
        title: "Nothing half-written",
        body: "A cancelled or failed import removes the source copy, captured figures, new notes and folders it created. Closing while the agent is still answering cleans up after it finishes.",
      },
      {
        title: "OpenCode says what is wrong",
        body: "The managed server now starts before the connection test, readiness is bounded, and a server stuck on an old database is repaired once. OpenCode 2.x names its unsupported routes instead of failing mid-chat.",
      },
      {
        title: "A lighter startup",
        body: "The PDF editor, reader and vendored PDF engines load only when a PDF opens, and question and card reads reuse path indexes with scoped invalidation. Two new checks keep both gains from eroding.",
      },
      {
        title: "No format changes",
        body: "Question notes, cards, review dates, settings, saved layouts and network behaviour are unchanged. Existing PDFs, imports and provider keys keep working.",
      },
    ],
  },
  {
    version: "1.299.5",
    date: "November 9, 2026",
    title: "Dialogs announce themselves",
    summary:
      "Every modal and picker now names its dialog window from the title it already shows, so a screen reader announces the surface before the first field.",
    highlights: [
      {
        title: "A name on every window",
        body: "The card editor, imports, exam and quiz builders, PDF editor and readers, summaries, reports and pickers all carry a dialog name.",
      },
      {
        title: "Named from what you see",
        body: "The window points at its visible heading, so its name matches the title on screen. No visible copy moved.",
      },
      {
        title: "Pickers state their purpose",
        body: "PDF, image, folder and question pickers have written names because they have no heading of their own.",
      },
      {
        title: "Enforced by tests",
        body: "The source audit now fails on a modal that bypasses the shared base, a dialog with no heading or purpose name, and an unnamed custom dialog overlay.",
      },
      {
        title: "Nothing else changed",
        body: "No note format, review schedule, setting, data path or network request changed. Every association is additive.",
      },
    ],
  },
  {
    version: "1.299.4",
    date: "November 9, 2026",
    title: "Every field has a name",
    summary:
      "A whole-surface pass names the remaining form fields and icon-only buttons, so a screen reader announces what each control does instead of reading a placeholder.",
    highlights: [
      {
        title: "Named fields everywhere",
        body: "The card editor, deck imports, exam builder, practice answers, PDF editor, reference searches, Quick add, Quick Chat and the Study agent all name their controls.",
      },
      {
        title: "Placeholders are hints again",
        body: "Text like e.g. BIOL 201 or Your answer stays visible as an example, but it is no longer the only thing describing the field.",
      },
      {
        title: "Buttons speak",
        body: "Icon-only and text-less buttons carry a real name, including the practice explanation and AI toggles and the PDF editor history controls.",
      },
      {
        title: "Enforced by tests",
        body: "A static audit reads every input, textarea, select and button in the source and fails the suite when a new one has no accessible name.",
      },
      {
        title: "Nothing else changed",
        body: "No note format, review schedule, setting, data path or network request changed. Every label is additive.",
      },
    ],
  },
  {
    version: "1.299.3",
    date: "November 9, 2026",
    title: "Every control has a name",
    summary:
      "Screen readers now announce what each field is for across the shared Study Workspace forms, the primary modals and the Study agent.",
    highlights: [
      {
        title: "Named fields",
        body: "Shared form helpers pass their visible label to the control, so the Study Workspace and study tools no longer expose unnamed boxes.",
      },
      {
        title: "Filters you can hear",
        body: "The annotation, vocabulary, subject, time-block tag and PDF annotation filters each have their own name instead of relying on a placeholder.",
      },
      {
        title: "Answer boxes are labelled",
        body: "The Feynman and Deep Notes steps, typed card answers, FRQ prompts, card archive and OCR text name themselves to assistive technology.",
      },
      {
        title: "Nothing else changed",
        body: "No note format, review schedule, setting, data path or network request changed. The labels are additive.",
      },
    ],
  },
  {
    version: "1.299.2",
    date: "November 9, 2026",
    title: "A shortcut check you can trust",
    summary:
      "A new Hotkey audit command lists any MCQ Tracker shortcut that overlaps an Obsidian core shortcut, using the keys actually assigned on this device.",
    highlights: [
      {
        title: "One command, a clear list",
        body: "Run Hotkey audit from the command palette. It shows each collision with the MCQ Tracker command and the Obsidian command that shares the same keys.",
      },
      {
        title: "Current assignments only",
        body: "Custom hotkeys replace defaults, and a removed custom shortcut does not leak its old default back in. Other community plugins are left out, so the list stays focused on Obsidian core.",
      },
      {
        title: "Read-only and local",
        body: "The audit never changes a binding and makes no network request. It reads Obsidian's own hotkey tables in the current window.",
      },
      {
        title: "Works on every platform",
        body: "Mod is compared as Ctrl on Windows and Linux and as Cmd on macOS, so the same chord is not reported as a false collision across platforms.",
      },
    ],
  },
  {
    version: "1.299.1",
    date: "November 9, 2026",
    title: "Ctrl/Cmd+P stays yours",
    summary:
      "Pressing Ctrl/Cmd+P now opens Obsidian's command palette only, even on an older install that had also assigned the shortcut to Open cards.",
    highlights: [
      {
        title: "The command palette wins",
        body: "A leftover custom binding on Open cards that used Ctrl/Cmd+P is removed once when the plugin starts. The palette no longer competes with the Cards module.",
      },
      {
        title: "Nothing was taken away",
        body: "Open cards remains in the command palette, and the ribbon button stays whenever Cards is on. Only the duplicate Ctrl/Cmd+P assignment is removed; Shift and Alt variants and every other shortcut are left alone.",
      },
      {
        title: "Cards-off guidance stays",
        body: "If the Cards module is off, choosing Open cards still shows the existing notice and takes you to Settings, where Modules can be turned back on.",
      },
      {
        title: "No data changes",
        body: "Question notes, cards, review history, settings and saved hotkeys other than that one binding are unchanged.",
      },
    ],
  },
  {
    version: "1.299.0",
    date: "November 9, 2026",
    title: "OpenCode at the front door",
    summary:
      "A new desktop setup now starts with OpenCode: install it from the same first-run screen, test it, and continue. Direct API is still one click away for phones and as a fallback.",
    highlights: [
      {
        title: "OpenCode leads the setup",
        body: "The first-run and import connection screen opens on OpenCode on desktop. Install OpenCode is the main button, not a detour through the advanced section.",
      },
      {
        title: "Install, test, then continue",
        body: "Installing no longer silently turns AI on. The screen shows download progress, Test OpenCode starts the agent and checks that it answers with a provider, and Continue unlocks only after that test works.",
      },
      {
        title: "No false readiness",
        body: "Practice, the empty screen and the import helper now require an actual OpenCode install, or a server you configured yourself, before they call AI ready. A missing install points back to the button instead of failing later.",
      },
      {
        title: "Direct API stays one click away",
        body: "The same screen offers a Direct API key for phones, an existing key or a fallback. A saved Direct API setup from before this update keeps using Direct API.",
      },
      {
        title: "Offline still works",
        body: "Paste questions instead stays visible on both paths, and every setup failure names the next click instead of leaving the importer as a dead end.",
      },
    ],
  },
  {
    version: "1.298.0",
    date: "November 9, 2026",
    title: "A cleaner community listing",
    summary:
      "A small follow-up clears the Community Plugins review's blocking manifest issue and its one stylesheet compatibility warning, with no new settings or note changes.",
    highlights: [
      {
        title: "Listing description fixed",
        body: "The plugin description no longer repeats the word Obsidian, which the Community Plugins review rejects as redundant in its directory context.",
      },
      {
        title: "One stylesheet warning cleared",
        body: "The exam flag marker now uses a supported rounded shape instead of clip-path, which the review flags as only partially supported in Obsidian 1.7.4.",
      },
      {
        title: "Nothing else changed",
        body: "Practice, imports, the AI connection wizard, review and every note format are unchanged, so existing questions keep working exactly as before.",
      },
      {
        title: "Update as usual",
        body: "Install the update from Community Plugins or the release page; there is no migration and no new setting to review.",
      },
    ],
  },
  {
    version: "1.297.0",
    date: "November 9, 2026",
    title: "A first import anyone can finish",
    summary:
      "The PDF path now says it needs AI, offers an offline paste route beside it, and walks a first-time user from a recommended provider to a tested model without ever guessing a model name.",
    highlights: [
      {
        title: "The AI step is labelled",
        body: "The empty screen and Practice now say Import files (needs AI). Paste questions instead (works offline) sits beside it and opens Quick add, which needs no key.",
      },
      {
        title: "Three steps to a working connection",
        body: "A recommended provider is preselected, Create a key opens that provider's key page, and Fetch models chooses a sensible model from the provider's own list so the field is never empty.",
      },
      {
        title: "Tested before the import",
        body: "Test connection sends one short request and explains a rejected key, an empty model list or an offline device. Continue stays disabled until the setup actually works.",
      },
      {
        title: "One implementation everywhere",
        body: "The inline wizard and Settings share the same model fetch and connection test, so a setup that works in one place works in the other.",
      },
      {
        title: "Start here names the offline route",
        body: "Where the guide used to say write a note by hand, it now points at Quick add questions from pasted text, which works with AI off.",
      },
    ],
  },
  {
    version: "1.296.0",
    date: "November 9, 2026",
    title: "A simpler start",
    summary:
      "The everyday path is shorter: fewer settings to scan, Import at the top of Practice, and the less-used practice actions out of the way until you need them.",
    highlights: [
      {
        title: "Simple settings",
        body: "New installs start with Practice, review, the Study agent and app settings. Show all settings reveals every specialist page and remembers the choice.",
      },
      {
        title: "Import is at the top",
        body: "Import questions now sits above the practice filters. If AI is not set up, it goes straight to the setup screen instead of hiding the button.",
      },
      {
        title: "Everyday actions stay clear",
        body: "Skip, mark known, bury, suspend and exclude moved under More actions. Confidence and Submit remain the obvious next step.",
      },
      {
        title: "Import details on request",
        body: "Course, unit, skill and other note properties wait behind Add details. Importing into an existing folder now adds questions instead of stopping.",
      },
      {
        title: "Clearer confidence labels",
        body: "The default middle choice is now Probably Right, so Guessing, Probably Right and Confident read as one scale. Custom labels are unchanged.",
      },
    ],
  },
];

function cleanVersion(value) {
  const text = String(value || "")
    .trim()
    .replace(/^v/i, "");
  return /^\d+\.\d+\.\d+$/.test(text) ? text : "";
}

function normalizeWhatsNewState(value) {
  let src = value;
  if (typeof src === "string") {
    try {
      src = JSON.parse(src);
    } catch (e) {
      src = null;
    }
  }
  if (!src || typeof src !== "object") return { seenVersion: "", seenAt: "" };
  return {
    seenVersion: cleanVersion(src.seenVersion),
    seenAt: typeof src.seenAt === "string" ? src.seenAt : "",
  };
}

function releaseFor(version) {
  const wanted = cleanVersion(version);
  if (!wanted) return null;
  return RELEASES.find((release) => release.version === wanted) || null;
}

function latestRelease() {
  return RELEASES[0] || null;
}

function loadWhatsNewState(app) {
  try {
    const raw = app && app.loadLocalStorage ? app.loadLocalStorage(WHATS_NEW_STORAGE_KEY) : null;
    return normalizeWhatsNewState(raw);
  } catch (e) {
    return normalizeWhatsNewState(null);
  }
}

function saveWhatsNewState(app, state) {
  if (!app || !app.saveLocalStorage) return;
  try {
    app.saveLocalStorage(WHATS_NEW_STORAGE_KEY, normalizeWhatsNewState(state));
  } catch (e) {
    // Storage can be unavailable in a restricted workspace; the popup still works for this run.
  }
}

/**
 * An update shows once. A first install does not: the Start here note owns onboarding.
 * Existing installs already carry a welcome version, which acts as the first baseline.
 */
function whatsNewShouldShow(app, version) {
  const current = cleanVersion(version);
  if (!releaseFor(current)) return false;
  const seen = loadWhatsNewState(app).seenVersion || cleanVersion(loadWelcomeState(app).seenVersion);
  return !!seen && seen !== current;
}

function markWhatsNewSeen(app, version) {
  const current = cleanVersion(version);
  if (!current) return loadWhatsNewState(app);
  const state = { seenVersion: current, seenAt: new Date().toISOString() };
  saveWhatsNewState(app, state);
  return state;
}

module.exports = {
  RELEASES,
  WHATS_NEW_STORAGE_KEY,
  cleanVersion,
  latestRelease,
  loadWhatsNewState,
  markWhatsNewSeen,
  normalizeWhatsNewState,
  releaseFor,
  saveWhatsNewState,
  whatsNewShouldShow,
};
