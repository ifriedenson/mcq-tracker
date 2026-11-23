"use strict";
/* Bundled release notes and per-device "already seen" state. No network, no vault notes. */
const { loadWelcomeState } = require("./welcome");

const WHATS_NEW_STORAGE_KEY = "mcqTrackerWhatsNew";

const RELEASES = [
  {
    version: "1.307.32",
    date: "November 23, 2026",
    title: "Weekday tasks keep today",
    summary:
      "A weekday-repeating task finished on a Monday now lands on that Monday instead of skipping to Tuesday, and the recurrence tests no longer depend on the day they run.",
    highlights: [
      {
        title: "Monday keeps its instance",
        body: "A Friday or weekend due date finished on Monday now schedules that Monday; only a rule whose natural next day is already past rolls forward, strictly past today.",
      },
      {
        title: "Daily and weekly unchanged",
        body: "Both still land strictly after today, and a long-overdue weekday task still moves to tomorrow rather than onto a day that already passed.",
      },
      {
        title: "Tests that hold every day",
        body: "The three weekday cases that hardcoded Nov 20-23 now anchor on the next Friday, and a new test pins the today-lands rule with explicit dates.",
      },
      {
        title: "Nothing else moved",
        body: "The capability inventory now cites the security test it was missing; no setting key, note format, command, review schedule or network default changed.",
      },
    ],
  },
  {
    version: "1.307.31",
    date: "November 20, 2026",
    title: "Task list fits a 300px sidebar",
    summary:
      "The task list now lays itself out for a narrow sidebar pane instead of a wide window, and the suite passes on Windows checkouts without weakening a single assertion.",
    highlights: [
      {
        title: "A pane-sized layout",
        body: "Container queries track the sidebar itself: the header wraps into rows, Add sits beside the title, and row actions drop to their own right-aligned row under 340px.",
      },
      {
        title: "Nothing clipped at 300px",
        body: "Tags move inline into the row meta, the hint is shortened and clamped to two lines, and the dark overdue row keeps a single red edge like the light theme.",
      },
      {
        title: "Green on Windows too",
        body: "Carriage returns, line-ending splits, the vendor hash and the POSIX-only spawn and symlink probes are fixed or skipped where Windows cannot run them.",
      },
      {
        title: "Nothing else moved",
        body: "No setting key, note format, command, review schedule or network default changed in this patch.",
      },
    ],
  },
  {
    version: "1.307.30",
    date: "November 19, 2026",
    title: "PDF++ naming fully removed",
    summary:
      "A plan-to-code review found the last PDF++ traces in names and checklists after the 1.307.29 bundle removal. They now point at the plugin's own PDF deep links.",
    highlights: [
      {
        title: "No more PDF++ names",
        body: "Source comments, the drive checklist and the plan's reference tables name the plugin's own PDF deep links instead of the removed upstream brand.",
      },
      {
        title: "Plan matches the code",
        body: "The review found 101 checked and 0 partial or unchecked rows; the reference rows now record the 1.307.29 removal with a pointer to docs/pdf-plus.md.",
      },
      {
        title: "Still under the Sync cap",
        body: "main.js rebuilds from 380 modules at about 4.3 MB, inside the 5 MB per-file limit and the startup budget.",
      },
      {
        title: "Nothing else moved",
        body: "No setting key, note format, command, review schedule or network default changed in this patch.",
      },
    ],
  },
  {
    version: "1.307.29",
    date: "November 19, 2026",
    title: "Under the Sync cap: PDF++ removed, bundle minified",
    summary:
      "The embedded PDF++ subsystem is removed and the bundle ships minified, taking main.js from 7.7 MB to about 4.3 MB, under Obsidian Sync's 5 MB per-file limit.",
    highlights: [
      {
        title: "PDF++ removed",
        body: "The upstream bundle, stylesheet, host and settings page are gone; the plugin's own reader, annotations, sidecars, deep links and page editor stay.",
      },
      {
        title: "main.js is 4.3 MB",
        body: "The bundle drops from 7.7 MB to about 4.3 MB, so vaults that sync with Obsidian Sync Standard take the plugin whole again.",
      },
      {
        title: "Minified and renamed",
        body: "The build strips comments and whitespace and shortens every module-scoped local, with class names kept because the suite asserts them.",
      },
      {
        title: "Startup budget holds",
        body: "356 of 380 modules load eagerly inside the 360-module and 5.6 MB budget, and the PDF engines still load only when a PDF opens.",
      },
    ],
  },
  {
    version: "1.307.28",
    date: "November 19, 2026",
    title: "Settings backups and a check on every AI write",
    summary:
      "Two palette commands back up data.json beside itself and restore it, and one table-driven test pins the blind-check verdict on every AI question-write path.",
    highlights: [
      {
        title: "Back up and restore settings",
        body: "Back up plugin settings now writes a timestamped copy beside data.json and keeps the newest ten; restoring backs up the current settings first and refuses a corrupt file.",
      },
      {
        title: "Every AI write proves its check",
        body: "The import finalizer, Quick add, transcript questions and Quick-add creation each stamp the blind-check verdict for a match, mismatch, error and review, while hand-written notes stay clean.",
      },
      {
        title: "Lighter startup",
        body: "The service-export importers load only when an import runs, freeing one eager module and about 20 KB of the startup budget.",
      },
      {
        title: "Cards stay out of the check",
        body: "A card has no letter key to check against, so card writes carry no blind-check verdict; the matrix test pins that documented exception too.",
      },
    ],
  },
  {
    version: "1.307.27",
    date: "November 19, 2026",
    title: "Generated questions keep their answer check",
    summary:
      "The Quiz Generator ran the blind answer check and then threw the verdict away, so a question the checker answered differently was written as a clean note. It now stamps the result the way an import does and the dialog says what the check found.",
    highlights: [
      {
        title: "The verdict is in the note",
        body: "A generated question now carries verification, verified, verified_by, verified_on, verified_answer and needs_review, plus the same warning banner import writes, so a disagreement is visible where the question lives instead of vanishing at write time.",
      },
      {
        title: "The dialog says what happened",
        body: "Before writing, the preview reports how many independent answer checks ran, how many drafts disagreed and are marked for review, and how many were dropped. The creation notice repeats the count.",
      },
      {
        title: "Hand-written questions are untouched",
        body: "Only a draft that arrived with a check carries these properties. A block you paste into Quick add yourself writes exactly the note it wrote before.",
      },
      {
        title: "An unfinished check never reads as passed",
        body: "A draft the checker could not answer records verification: unchecked instead of verified, the same way import treats a note with no letter key, so nothing is claimed that was not checked.",
      },
    ],
  },
  {
    version: "1.307.26",
    date: "November 19, 2026",
    title: "Live-drive fixes for chips, dots, and agent undo",
    summary:
      "Every 1.307.25 surface was driven in a real Obsidian 1.15.1 window and the run fixed three defects the headless suite could not see: the chip Clear button, chip-to-line mapping, and the agent-undo result shape. The week export rasterized first try.",
    highlights: [
      {
        title: "Clear really clears the due date",
        body: "The date picker's Clear button closed the modal but left the token in place. An empty pick now removes the date token and collapses the leftover space, so the line reads clean and the notice says the date was cleared.",
      },
      {
        title: "Chips keep their line",
        body: "Reading-view chips drifted when prose sat between task lists because every list strode from the section start. Each list now re-anchors on its own section line first, so a chip click always edits the line it sits on.",
      },
      {
        title: "Dots match every course name",
        body: "A course with a double space in its name showed no class dots because the hub lookup skipped the whitespace folding the dot index uses. The lookup folds whitespace the same way, and the empty-dot click created the note live.",
      },
      {
        title: "Undo answers one shape",
        body: "The agent-undo result carried a skipped count on one path and not the other. Both paths now return restored, skipped, and paths together, and the live history modal restored the note through its own Undo button.",
      },
    ],
  },
  {
    version: "1.307.25",
    date: "November 19, 2026",
    title: "Class dots, week export, agenda, chips, and per-message agent undo",
    summary:
      "The finish-scope pass ships everything the plan still listed as partial or unimplemented that could be built locally: class-held dots on the course hub, a week PNG export, an agenda rail with a quick-add preview and inline task chips, per-message agent-edit undo, and in-editor diff navigation.",
    highlights: [
      {
        title: "Class-held dots on the course hub",
        body: "Each course card shows one dot per scheduled meeting this term: filled when the lecture note exists, a ring when attendance was checked without a note, empty otherwise. Clicking an empty dot creates the note from the course template.",
      },
      {
        title: "The week exports as a PNG image",
        body: "Calendar: export the current week as a PNG image saves week-timetable-<date>.png beside the .ics export, drawn from the same rows the week grid shows. Rendering needs the app window; scheduling data is untouched.",
      },
      {
        title: "An agenda rail and a preview before adding",
        body: "The task list gains a List|Agenda toggle grouping open work by day with capped tails, a done-today section fed by a new completion stamp, and a live line under the add box showing the date and repeat the title will get.",
      },
      {
        title: "Task chips and agent changes in place",
        body: "Reading view shows schedule tokens as chips with a date picker and priority stepping, every applied agent review gets its own Undo that survives reloads, and proposal cards show each change in its note with hunk-by-hunk stepping.",
      },
    ],
  },
  {
    version: "1.307.24",
    date: "November 19, 2026",
    title: "A week timetable, semester rollover, and Undo on every task edit",
    summary:
      "An audit of the plan found three ideas that had been captured but never built and were small enough to finish properly. The calendar now has a real week grid, starting the next term is one command, and completing or changing a task can be undone.",
    highlights: [
      {
        title: "A real week timetable",
        body: "The calendar gains a Week mode beside Month, Day and Upcoming: one column per weekday and one row per hour, with classes, planned blocks, local events, review work and dated tasks placed at their own time and a now-line in today's column.",
      },
      {
        title: "Overlaps get their own column",
        body: "Two things at the same time are split into lanes instead of hiding each other, the axis widens only for a block outside 07:00-22:00, rows with no time wait in an all-day strip, and every day header and block opens that day.",
      },
      {
        title: "Start the next semester in one command",
        body: "Courses: start the next semester stamps the semester label on the courses that never had one, moves the term window to the new dates and reports how many it filled. Notes, lecture history and imported events are left exactly where they are.",
      },
      {
        title: "Undo on every task edit",
        body: "Completing, reopening, starring and changing a task's repeat now each leave the same eight-second Undo a delete does. Undoing a completion also removes the successor its repeat just scheduled, and a later edit is never overwritten.",
      },
    ],
  },
  {
    version: "1.307.23",
    date: "November 19, 2026",
    title: "Updates no longer report a disable failure",
    summary:
      "Updating the plugin showed a \"failed to disable\" notice because the unload path could throw after the window helpers were already gone. Unloading is now bulletproof: every teardown step is guarded and the whole path can never throw.",
    highlights: [
      {
        title: "Disabling can no longer fail",
        body: "The plugin's unload routine is wrapped so it never throws: a missing window, a throwing server stop, or a failing embedded-PDF teardown is swallowed instead of reaching Obsidian as a disable failure during updates.",
      },
      {
        title: "Timers no longer assume a window exists",
        body: "The plain-card refresh timer, the Insights view timer, and the OpenCode command runner used the window's timer directly; each now falls back to the global timer when no window is present, so teardown after the window is gone stays quiet.",
      },
      {
        title: "Pinned by regression tests",
        body: "A new test unloads the plugin with no window present and a throwing server stop, and another schedules a plain-card refresh the same way; both prove the update path stays silent instead of reporting a failure.",
      },
      {
        title: "No behaviour changes otherwise",
        body: "No setting key, note format, review schedule, or network default changed. The full suite passes and the release-record, duplicate-guard, dynamic-code, vendor, startup-budget, build, and plan-status checks are all clean.",
      },
    ],
  },
  {
    version: "1.307.22",
    date: "November 19, 2026",
    title: "The release checks itself",
    summary:
      "Three of this project's releases had drifted out of step: a version with notes and no release, a bundle that could be published without the check that it matches the source, and tests that passed here and failed a time zone away. The pipeline now verifies what it publishes and the records are checked against each other.",
    highlights: [
      {
        title: "A release can no longer ship an unverified bundle",
        body: "The release job now runs the same check as CI on the exact commit it publishes, so a stale main.js can no longer be released while the build check goes red. The published assets are read back after the release is created, not assumed.",
      },
      {
        title: "Releases are checked against each other",
        body: "One check now ties the version in manifest.json, package.json and versions.json to the notes file and the git tag. It exists because 1.307.20 had notes and a release commit but was merged as 1.307.21, so no tag or release was ever made for it and nothing complained.",
      },
      {
        title: "Tests run in the far east and far west",
        body: "The suite reads the clock, so CI now runs it in three time zones. The first run found three tests that hardcoded a date: a template fixture, an export file name and a recurrence check. All three now use the local day the plugin itself uses.",
      },
      {
        title: "Downloads can be checked, and problems have a private door",
        body: "Every release now carries a SHA256SUMS file for its main.js, manifest.json and styles.css, and SECURITY.md says how to report a malicious PDF, a path outside the vault or a leaked key privately instead of in a public issue.",
      },
    ],
  },
  {
    version: "1.307.21",
    date: "November 18, 2026",
    title: "A free local model's notes arrive whole",
    summary:
      "Document import can run on a model that never leaves your computer. Driving it against a real 7B model on a CPU returned all three questions with the right answers, and the plugin still threw part of that answer away. The four defects it exposed are fixed, and the recipe that was actually run is in the README.",
    highlights: [
      {
        title: "A broken separator no longer loses the notes",
        body: "The model writes \"=====\" and \"NOTE=====\" on two lines. The importer accepts that shape, so a complete answer is read as the notes it is instead of as an empty document.",
      },
      {
        title: "A repeated question is not a passage",
        body: "For the two questions with no passage, the model filled the Stimulus section with the stem and its choices. That section is recognised, removed, and never given a passage id or passed on to the next batch as a real passage. A genuine passage, even one that opens with the stem's words, is kept.",
      },
      {
        title: "A slow local model is not a dead one",
        body: "A local server gets 15 minutes for one request instead of the 120 seconds meant for a cloud API, and the import window now reads the provider from the right place, so its own 3-minute limit no longer applies to a local server.",
      },
      {
        title: "A recipe that was actually run",
        body: "Ollama, qwen2.5:7b, 4.7 GB, no API key, CPU only: the pull command, the settings and the measured speed are in the README. No note format, setting key, review schedule or network default changed.",
      },
    ],
  },
  {
    version: "1.307.20",
    date: "November 18, 2026",
    title: "PDF junk stops reaching your questions",
    summary:
      "An imported PDF carries a QR code, a download stamp, a running header, a page number and a cover block a host site prints on page 1. All of it used to be handed to the model as exam text, so a stamp could become a source line and a \"Page 7 of 21\" an answer choice. Three passes now clean the page before anything reads it.",
    highlights: [
      {
        title: "A printed symbol is not a figure",
        body: "A QR code is recognised from its own pixels, and its \"scan to open\" caption and bare link are dropped, so no code is cropped into the vault and no URL reaches a question. Photos, logos and bar-code strips are kept.",
      },
      {
        title: "Page furniture is named by repetition",
        body: "A line printed in the same top or bottom margin on most pages is furniture, and is dropped only in that margin, so the same words in the body of a page stay. A printed page number is dropped only on its own page.",
      },
      {
        title: "The cover block on page 1 goes",
        body: "Only the first page's leading lines are examined, and only a line printed twice, an address or an identifier is removed, so a title, an instruction, a class heading and the first question survive.",
      },
      {
        title: "Nothing else changed",
        body: "No note format, setting key, review schedule or network default changed.",
      },
    ],
  },
  {
    version: "1.307.19",
    date: "November 18, 2026",
    title: "Every PDF import path, proven",
    summary:
      "Every way a PDF reaches the tracker was driven in a real vault — main import, free response, Quizlet cards, document cards, overnight batches, quiz generation, OCR and LaTeX — and each path wrote its notes without an error.",
    highlights: [
      {
        title: "Nine paths, one vault",
        body: "Each import route ran on the shipped bundle in Obsidian 1.15.1 against a real vault, not a harness mock.",
      },
      {
        title: "Notes read back from disk",
        body: "Main imports stay verified against their key and keep the PDF, and cards keep their format and source frontmatter.",
      },
      {
        title: "Refusals leave the vault clean",
        body: "A damaged PDF, a scanned document and an import with AI off each stop with plain words and write nothing.",
      },
      {
        title: "The quiz path is covered",
        body: "The e2e stand-in now answers PDF-sourced quiz prompts with valid JSON, so generate-quiz-from-PDF is proven too.",
      },
    ],
  },
  {
    version: "1.307.18",
    date: "November 18, 2026",
    title: "PDF imports read in order",
    summary:
      "Two text-layer ordering defects scrambled PDF imports: rows arrived bottom-to-top and wide column gaps never became tabs. Imports now read top-to-bottom, Question N: documents route to MCQ, and the card extractor is always dismissible.",
    highlights: [
      {
        title: "Tables and exams keep their order",
        body: "Term/definition columns and numbered questions now import in document order, with the answer key staying aligned to its questions.",
      },
      {
        title: "Question N: counts as questions",
        body: "Documents written as Question 1: through Question N: are recognised as numbered questions and route to MCQ instead of being misclassified.",
      },
      {
        title: "Cancel is always there",
        body: "The document-card extractor shows its Cancel control from the start, so a mistaken scan can be dismissed before any preview appears.",
      },
      {
        title: "Narrow and touch layouts harden",
        body: "The home shortcut rows wrap on small panes, and touch targets cover the agent send, task-list controls, calendar header and suggestion dots.",
      },
    ],
  },
  {
    version: "1.307.17",
    date: "November 18, 2026",
    title: "An import that says how long is left",
    summary:
      "A long import showed activity but no sense of time. The import window now estimates time left from measured progress and the review screen counts the questions that will become notes.",
    highlights: [
      {
        title: "Know the wait",
        body: "After each batch the AI-reading line adds an estimate from the finished batches.",
      },
      {
        title: "Watch the notes land",
        body: "Note creation reads “Created 3 of 12... about 40 seconds left”, from that run's pace.",
      },
      {
        title: "See what will be added",
        body: "The review screen shows “Add 4 of 9 questions.” and follows every tick and Select all/none.",
      },
      {
        title: "Quiet when it cannot know",
        body: "No estimate appears before the first batch or note finishes, or at the end.",
      },
    ],
  },
  {
    version: "1.307.16",
    date: "November 16, 2026",
    title: "A calendar that fits the sidebar",
    summary:
      "The sidebar calendar was still using the desktop header, so at 300px the month name vanished, the settings gear hung past the card and the view scrolled sideways. It now measures its own width and stacks the header to fit.",
    highlights: [
      {
        title: "The month name stays",
        body: "The calendar now responds to its own width, so the month title keeps a line of its own in the narrow sidebar instead of being squeezed out by the header controls.",
      },
      {
        title: "Every control stays in the card",
        body: "In a sidebar under 360px the six header controls share a full-width row at 44px height, putting the settings gear back inside the card instead of 24px past it.",
      },
      {
        title: "No sideways scroll",
        body: "The 300px calendar measures 288px of content and 288px of scroll width; the month grid keeps seven 32px cells and the layer chips wrap cleanly to two rows.",
      },
      {
        title: "Wide and phone views are untouched",
        body: "The new rule only applies below 360px of calendar width. The full-width calendar and the existing 390px phone layout keep their current spacing and targets.",
      },
    ],
  },
  {
    version: "1.307.15",
    date: "November 16, 2026",
    title: "The sidebar, for all three",
    summary:
      "The task list and Study agent already lived in the right sidebar, but the calendar still opened a main tab. Agent, tasks and the calendar now share one right-sidebar path, so all three stay beside the note you are reading.",
    highlights: [
      {
        title: "The calendar docks on the right",
        body: "Open calendar, Open Plan and the Focus day, Review calendar and Local events commands now open the merged calendar in the right sidebar instead of a main tab.",
      },
      {
        title: "One rule for all three",
        body: "The task list, Study agent and calendar use the same routing: an existing right-sidebar leaf is reused, otherwise the sidebar gets a new view. Phones keep a normal tab.",
      },
      {
        title: "No duplicate calendars",
        body: "Opening the calendar again focuses the one already in the sidebar rather than adding another copy, and a calendar left in an old main tab does not pull you away from the note.",
      },
      {
        title: "Phones keep a normal tab",
        body: "A phone has no usable right split, so all three views fall back to an ordinary tab there. Nothing about the desktop sidebar changes what a phone can reach.",
      },
    ],
  },
  {
    version: "1.307.14",
    date: "November 16, 2026",
    title: "One calendar",
    summary:
      "The Plan hub had four calendars for one question: classes in Calendar, the day in Focus day, the queue in Review calendar and local events in their own tab. They are now one calendar — classes, planned blocks, local events, review due and dated tasks on the same days — with five layer chips to hide whatever you do not need.",
    highlights: [
      {
        title: "Every plan on one grid",
        body: "Month cells, the day section and Upcoming now draw classes and exams, planned study blocks, local events, review-due questions and cards, and study tasks with due dates. Month cells add a coloured dot for each extra layer.",
      },
      {
        title: "An “Also today” card",
        body: "Under the selected day and in Upcoming, local events, review workload and dated tasks are listed with their time and course, so a plan, a deadline and a class read as one afternoon.",
      },
      {
        title: "Layers you can switch",
        body: "Classes, Planned, Events, Review and Tasks chips sit above the calendar, press on and off, and are remembered per vault in the calendar settings. A module that is off hides its layer automatically.",
      },
      {
        title: "The four tabs are one",
        body: "Focus day, Review calendar and Local events left the Plan tab bar. Their commands still open the merged calendar with the matching layer switched on, and Focus day opens the day view.",
      },
    ],
  },
  {
    version: "1.307.13",
    date: "November 16, 2026",
    title: "One pane, one row",
    summary:
      "Re-checking the screenshots found the Plan, Study and Today hubs stacked above three empty-looking rows that left the hub about 150px tall, the calendar's settings gear pushed past the card edge at 390px, and muted labels measuring 4.06–4.21:1. The hubs are single panes again, every muted label clears AA in both themes, and the narrow calendar header keeps six controls on one row.",
    highlights: [
      {
        title: "A hub is one pane",
        body: "Each hub tab used to create its own workspace-leaf wrapper inside the hub, so Plan drew four 149px rows and its own content was squeezed into what was left. The wrappers are gone; the hub fills its leaf and its tab bar is the only row.",
      },
      {
        title: "The calendar header fits 390px",
        body: "Six header controls used to push the settings gear past the card edge. They now share one row at a narrow width, with tighter padding and a target that still clears 32px.",
      },
      {
        title: "Muted ink clears AA",
        body: "Calendar weekday labels, mode tabs and Today's small print measured 4.06:1 dark and 4.21:1 light. One computed muted token now feeds every plugin surface, and each hub measures zero contrast failures in both themes.",
      },
      {
        title: "Evidence that measures the right surface",
        body: "The audit now collapses a stacked layout first, measures the active leaf and names each hub's view type. The regenerated runs report 0 clipped controls and the full hub height instead of an empty neighbouring pane.",
      },
    ],
  },
  {
    version: "1.307.12",
    date: "November 16, 2026",
    title: "Pixels, not assertions",
    summary:
      "The live Primary pass over 1.307.11 caught three things only a screenshot shows: a stored title longer than the limit ended mid-word with no mark, the library's search field stopped at 220px leaving dead space while its chip sat taller, and the This chat / Filter pair split unevenly — then collapsed to 85px each in a 378px pane. The drawer now reads as one aligned column at any width.",
    highlights: [
      {
        title: "A cut title says it was cut",
        body: "Conversation titles are stored up to 80 characters. A longer one used to end in the middle of a word (\u201c…explained step by\u201d); it now ends with an ellipsis, and the row's own ellipsis still handles a pane too narrow for the full 80.",
      },
      {
        title: "The search row fills its width",
        body: "Search conversations now grows to the drawer's edge, and Show archived shares its 32px height instead of standing 8px taller beside it.",
      },
      {
        title: "Two fields, one column",
        body: "This chat and Filter split the row evenly at full width and each keeps its label when the pane wraps them at 378px, instead of squeezing to 85px or dropping a label beside the wrong select.",
      },
      {
        title: "The same notice, still measured",
        body: "All four Undo notices stay on the shared notice: 4.84:1 text in Primary light and 5.63:1 in dark, Undo at 58\u00d732 in both, and removing a chat project still posts exactly one notice.",
      },
    ],
  },
  {
    version: "1.307.11",
    date: "November 16, 2026",
    title: "The drawer above the conversation",
    summary:
      "Screenshotting 1.307.10 in Primary light and dark showed what the state assertions could not: the chat drawer opened underneath the sticky composer, its row actions stretched into full-width bars, a long conversation title ran past its row, and the What's New dialog cut off its last card with no scroll. The visuals now match the shared control language, with contrast measured in both themes.",
    highlights: [
      {
        title: "The library clears the composer",
        body: "While the drawer is open the composer drops back into the flow and the chat surface scrolls, so no conversation sits behind it. Row actions are compact chips on the right and the title truncates with an ellipsis instead of overflowing into the timestamp.",
      },
      {
        title: "Measured, not eyeballed",
        body: "Archived rows lost their 0.7 opacity (3.89:1) for normal ink, Delete moved from 4.49:1 to 4.88:1 in light and stays 4.59:1 in dark, the drawer hint reads 5.53:1, and the notice is 4.84:1 light and 5.63:1 dark with its Undo unchanged at 58\u00d732.",
      },
      {
        title: "One notice per removal",
        body: "Removing a chat project used to raise its own \u201cRemoved the project\u201d notice on top of the shared Undo notice. The shared one is now the only one, so there is always exactly one Undo for the click.",
      },
      {
        title: "What's New can be finished",
        body: "A release with four highlights is taller than the window; the dialog now scrolls to its last card and its buttons instead of clipping them, and the project row keeps Remove project compact in a narrow pane.",
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
