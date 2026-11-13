"use strict";
/* Bundled release notes and per-device "already seen" state. No network, no vault notes. */
const { loadWelcomeState } = require("./welcome");

const WHATS_NEW_STORAGE_KEY = "mcqTrackerWhatsNew";

const RELEASES = [
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
