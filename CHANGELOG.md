## 1.307.7 - 2026-11-15

- **Delete is now undoable, and the date field has one focus ring.** The task list's remaining interaction paths were driven on the plugin's own leaf (19 states per theme, plugin DOM asserted at 1271px, Primary light and dark) and two defects surfaced. Deleting a row was final — `removeStudyTask` discarded the task with no confirm and no way back — so it now returns the removed task, `plugin.restoreStudyTask` puts it back with every field (`src/plugin.js`), and the row's × leaves an 8-second notice with an Undo that restores it and disables itself (`src/task-list-view.js`). The native date input focused its inner segments with no ring of their own, so `.qt-task-list-date:focus-within` now draws one ring around the whole field and the inner segments are explicitly ringless. `styles.css` also gives `.qt-notice-undo` hover, pressed, `focus-visible` and coarse-pointer sizing. The audit's `checks` now record persisted tasks, the focused control and the notice's contrast, so star on/off, repeat off→daily→weekdays→weekly→off, tag save, delete, undo and date focus are each proven by state, not by eye. Tests: **2,987 pass, 0 fail**; `npm run check` clean. No setting key, note format, review schedule or network default changed.

## 1.307.6 - 2026-11-15

- **The task list lines up.** Driving the plugin's own task list (view type `question-tracker-task-list`, in the main area, confirmed as plugin DOM) at 1280 in Primary light and dark found two layout defects and two accessibility misses. `.qt-task-list-star` and `.qt-task-list-repeat` had no styles at all, so the row's 3-column grid pushed them and the delete button into implicit rows as full-width bars; they now live in one `.qt-task-list-actions` column at 32px each. The Add button, as a 4th child of a 3-column grid, stretched under the date field and now spans the form. The 16px checkbox gets a 32px label hit area, completed rows no longer dim to 62% opacity (title 4.21:1 -> passes, strikethrough carries the state), and Primary dark's badge/count/tip/empty/pills move off 4.06:1 while the overdue pill's red is mixed with the normal ink (1.72:1 -> passes). The audit harness now pins a job's view type, refuses to report a foreign or hidden surface, supports named states with real typing/keys, and measures a control's label as its hit area. Eight states per theme — empty, keyboard add, long text, checked, filtered, filter cleared, keyboard complete, mixed — report 0 horizontal overflow, 0 sub-AA text and 0 sub-32px controls. `node --test` passes 2,986; `npm run check` clean. Styles, view markup and audit tooling only: no setting key, note format, review schedule or network default changed.

## 1.307.5 - 2026-11-15

- **Dim dark themes keep every secondary label above AA.** Follow-up to 1.307.4 from the same live Primary pass: quick-practice field labels (`.qt-label`), inline meta lines (`.qt-meta`), empty states (`.qt-empty`) and the paused-timer notice (`.qt-paused`) measured 4.06:1 in Primary dark. In dark they now borrow `--text-normal`, so the audited hubs and practice surfaces report zero contrast failures in Primary light and dark at 1280 and 390. Styles only; no setting key, note format, command, review schedule or network default changed. `node --test` passes 2,985; `npm run check` clean.

## 1.307.4 - 2026-11-15

- **A full Primary-theme pass: hubs, narrow exam views, dark ink.** Driven live in Obsidian 1.15.1 under Primary (242 commands, 20 views, 61 settings pages, practice end to end) with zero failures: the hub tab bar moves onto the design tokens with wrapping tabs, 44pt touch targets and arrow-key travel; `--qt-danger-soft`/`--qt-success-soft` gain Apple red/green rgb fallbacks; the Bluebook header/footer wrap under 520px with icon-only tools (aria-labels kept); and dim-muted dark themes borrow normal ink for resting exam controls, hints, counts and links. `node --test` passes 2,985; `npm run check` clean. No setting key, note format, review schedule, recurrence rule or network default changed.

## 1.307.3 - 2026-11-15

- **The add row can create a high-priority task.** The task list's add row gained a `★ High` toggle (`aria-pressed`, default off) whose state is passed to `addStudyTask({ priority: "high" })`; a task added without it keeps the existing normal default. The per-row star still flips the flag afterwards. The priority field itself, its normalization (`priorityValue`, anything but `high` is normal), the high-first comparator (`compareStudyTasks`) and the mirror's `⏫` marker all shipped in 1.305 — this release closes the missing add-time control rather than adding a second mechanism, and a test now pins the sort order inside each group so normal tasks keep their due order.
- **Quick-add times and spans were already parsed; the edges are now pinned and proven.** "at 3pm"/"3:30pm"/"noon"/"in 2 hours" (1.307.0) and "in N days/weeks" (1.304.0) resolve through the same dependency-free rules; new tests fix the boundaries the parser is sensitive to: `in 3 days` from 2026-11-30 → 2026-12-03, `in 2 days` from 2026-12-30 → 2027-01-01, `in 1 day` from 2028-02-28 → 2028-02-29 and from 2028-02-29 → 2028-03-01, `in 1 week` from 2028-02-22 → 2028-02-29, plus `review in 3 days at 3pm` → due 2026-12-02 at 15:00. Date-only forms, time forms and precedence (`parseTaskTime` still lets a span win over a clock word) are unchanged.
- Driven in a real Obsidian 1.15.1 vault through the app's own task list: the add-row toggle pressed → `Review Biochem` created with `priority: "high"` (data.json), rendered first with ★ while three normal tasks followed in due order (`drill` due today 15:00, `essay` due 2026-12-01, `Read chapter` undated); `drill at 3pm` and `essay in 16 days` (from 2026-11-15) parsed to `2026-11-15 15:00` and `2026-12-01`. The mirror note read from disk held one line per item with a single `⏫` on the high task, was byte-identical after a second refresh, and data.json was unchanged by the write.
- `tests/task-priority-quickadd.test.js` adds 6 tests. `node --test` passes 2,980; `npm run check` clean; inventory unchanged (no new exports). No existing setting key, shipped note format, review schedule, recurrence rule or the 1.307.0 hub fix changed.

## 1.307.2 - 2026-11-15

- **The mirror note covers the whole study loop.** `syncStudyTasksToNote()` still writes study tasks (exam-plan tasks were always plain `studyTasks`, so they were already projected once a refresh happened) and now adds a `## Due today` section built from `mirrorDueItems()` → `getDueQueue({ limit: 0 })`: every due question, flashcard and vocabulary item as `- [ ] [[Questions/Enzymes.md|Enzymes]] 📅 2026-11-10 · Question · Biology`. Lines carry a `📅` date (the item's own `next_review`, or today for a never-reviewed item) and the queue's meta, and no `⏰`/`⏫`/`🔁` marker unless the item actually carries one. The footer now reads `N open · M done · K due`.
- **One writer, regenerated.** `mirrorMarkdown(tasks, today, { dueItems })` rewrites the note from current data every time, so repeated refreshes produce byte-identical notes with one line per item; without `dueItems` the output is unchanged from 1.305/1.307 (pinned). The note setting (`studyTasks.mirrorNote`), command and mirror button are unchanged — no new setting key.
- **Refresh on every relevant change.** `addStudyTask`, `updateStudyTask` (completion, edit, repeat successor), `removeStudyTask`, `generateStudyTasks` (exam plan) and a recorded review (`recordAttempt`, which also schedules one settle pass so the metadata cache has caught up) all rewrite the note when a mirror note is configured; `refreshTaskMirror()` stays a no-op otherwise and never creates a note unasked.
- **Projection only.** The writer never touches `settings.studyTasks`; a hand edit or a ticked line is overwritten by the next refresh and never read back. Data.json stays the source of truth.
- Driven in a real Obsidian 1.15.1 vault through the plugin's own handlers: exam-plan tasks (`Study Enzymes (pass 1) 📅 2026-11-16 · Biology`), a task with time/priority/repeat (`Review Biochem 📅 2026-11-20 ⏰ 08:15 ⏫ 🔁 every weekday`), due questions and cards with links and dates, three refreshes byte-identical with 0 duplicate lines, a hand-ticked line restored, a recorded review dropping its item (17 → 16 due), and completion moving the task under `## Done` with the successor at 2026-11-23. The file was read back from disk each time.
- `tests/task-mirror-loop.test.js` adds 6 tests (line shape, no invented markers, section/footer, exam-plan + due queue in the note, idempotent refresh with untouched data, one-way hand edits, completion and review refresh). `node --test` now passes 2,974 tests; `npm run check` clean. No existing setting key, shipped note format, review schedule, recurrence rule or the 1.307.0 hub fix changed.

## 1.307.1 - 2026-11-15

- **Narrow recurrence for study tasks.** A task's repeat rule is now one of `daily`, `weekday` or `weekly` (`repeatValue`), settable from the task list's repeat button (off → daily → weekdays → weekly → off) or by title ("every weekday", "weekdays", "every Monday", "daily"). Completing a task through `plugin.updateStudyTask` — the same handler the checkbox uses — creates exactly one successor with the advanced due date, the preserved `HH:MM` time, and its course, tags and priority; it is written to data.json, appears in the task list and due queue, and the configured mirror note is refreshed with a Tasks-compatible `🔁 every weekday` line. `hasFollowUp` refuses to queue a duplicate, so finishing twice (or reopening and finishing again) yields one successor. Advancement starts from the task's own due date and always lands after today: weekly keeps its weekday when overdue, weekdays skip weekends, and month-end, leap-day (2028-02-28 → 02-29 → 03-01) and year-end rolls were driven through the real completion path in Obsidian 1.15.1, with the rows read back from `data.json` and the note.
- `tests/task-recurrence.test.js` adds 12 behavioral tests (plugin add → complete → read back, saved-data reload, double completion, mirror, UI cycle, overdue rules); `tests/study-tasks-plus.test.js`'s overdue-weekly pin moves from "restart from today" to "keep the weekday, stay in the future".
- `node --test` passes 2,968 tests; `npm run check` clean. No setting key, note format, review schedule or the 1.307.0 hub fix changed.

## 1.307.0 - 2026-11-15

- **Fixed: 1.306.0's hub tabs said "the plugin that created this tab has gone away".** Obsidian's `View` constructor calls `getViewType()` inside `super()`, before our constructor body assigned `this.spec`, so the base class threw `TypeError: Cannot read properties of undefined (reading 'type')` inside the registered creator and Obsidian drew its placeholder leaf. `src/hub-view.js` now exports `hubViewClass(spec)`: a class per hub whose `getViewType()`/`getDisplayText()`/`getIcon()` answer from the closure, and the base `QtHubView` no longer dereferences `this.spec` unguarded. Verified in a real Obsidian 1.15.1 window (Xvfb + CDP, built bundle in a vault): the Plan hub opens with the real Focus day view inside, Today and Study open on their first tabs.
- **Tasks learn the clock.** `src/task-dates.js` gains a time parser beside the date one, still dependency-free: `3pm`, `3:30 pm`, `15:00`, `at 9`, `3p`/`3a`, the named hours (`noon` 12:00, `midnight` 00:00, `tonight` 20:00, `morning` 09:00, `evening` 18:00) and `in N hours|minutes`, which is real clock math and rolls the date past midnight. New `extractTaskWhen()` returns `{ title, due, time }`; a clock time with no day means today, or tomorrow when that hour has already gone by ("tonight" is the one anchored word). `{ takeDate: false }` / `{ takeTime: false }` let a caller keep a half it already has, which is how the pickers still win and a title like "Today task" keeps its words.
- Tasks carry `time` (`HH:MM`, normalized in `normalizeStudyTask`, validated in focus-day scratch tasks). The Task list chip reads **Due today · 3 PM**, the Focus day scratchpad shows it, and the one-way mirror writes Tasks-compatible `⏰ 15:00` after `📅` and sorts same-day work by clock. `extractTaskDue`, the note format and every existing setting are unchanged.
- `node --test` passes 2,956 tests (new `tests/task-times.test.js`, plus `tests/hub-views.test.js`'s constructor-time contract); `npm run check` clean. No note format, existing setting key, review schedule or network default changed.

## 1.306.0 - 2026-11-15

- **A shorter ribbon: Today, Plan and Study.** Nine ribbon buttons became three hub buttons. New `src/hub-view.js` (a tabbed leaf that mounts the real view classes untouched) and `src/hubs.js` (the tab lists, filtered by the same module getters the ribbon uses). **Today** = Today, Study statistics, Pomodoro; **Plan** = Calendar, Focus day, Review calendar, Local events; **Study** = Study Workspace, Study Tools. Commands route to the right tab (`activateHubTab`), and every old command keeps its name. PDF++'s three toggles are captured from the vendor `addRibbonIcon` and shown as one **PDF++ toggles** button with a menu (plus PDF++ settings). A hub with every section off closes; an empty hub says which settings turn it on. New **Ribbon layout** setting: grouped (default, migrated for everyone) or one button per view. Ribbon: 19 → 12 buttons.
- `node --test` passes 2,942 tests; `npm run check` clean. No note format, review schedule or network default changed.

## 1.305.0 - 2026-11-15

- **Tasks grow up: mirror, repeats, priorities.** Four task-plugin capabilities, study-shaped. (1) A one-way mirror copies study tasks into a note as Tasks-compatible lines (`- [ ] Title 📅 due ⏫ 🔁 every week #tag`) via the **Tasks: mirror study tasks to a note** command, buttons in the Task list and workspace queue, and a Mirror note setting (default `Study tasks.md`); done work follows under `## Done`, the footer names the one-way rule, plugin data stays canonical. (2) Repeats: `every day`, `daily`, `every week`, `weekly` and `every <weekday>` in a title set daily/weekly; completing one spawns the next from its due date (or today when overdue); sidebar rows cycle off/daily/weekly. (3) Priorities: high-priority stars sort above due dates in every surface and the mirror (⏫), toggled from the sidebar row. (4) Fuller dates: `in N months` parses to calendar months, and `every Tuesday` keeps Tuesday for the due parser. Deliberately not built: two-way sync, full scheduling grammar, queries, outside integrations, board views.
- `node --test` passes 2,935 tests; `npm run check` clean. No note format, existing setting key, review schedule or network default changed.

## 1.304.2 - 2026-11-15

- **Keep typing: task boxes hold the cursor.** Every quick-add task box (Task list, Focus day scratchpad, Study Workspace per-block input) now keeps the cursor in its fresh input after an add, so Enter types tasks back to back with no mouse, like Deadline. The block input also accepts Enter (previously Add-button only). The work exposed a real crash: rendering a block with tasks called `timeBlocks.statusChar`, which was never exported — it now is.
- `node --test` passes 2,922 tests; `npm run check` clean. No note format, existing setting key, review schedule or network default changed.

## 1.304.1 - 2026-11-15

- **Deadline parity: the last two pieces.** A second line-by-line pass over `saydullayev017/deadline` against this codebase found two remaining gaps and closed them: Focus day now registers the same `calendar-days` ribbon entry as every module view (`refreshRibbon()`), and day-open confirmations fade after three seconds while errors stay on screen (token-guarded, so a newer message is never wiped). Everything else already had an equivalent here — timer wall-clock accuracy, new-tab daily notes, inline durations, phase-coloured progress, chime, session tasks, theme-aware styles — with deliberate differences (25-minute default blocks, opt-in autostart, persistent task lists, Schedule-section templates) kept as the deeper equivalents.
- `node --test` passes 2,919 tests; `npm run check` clean. No note format, existing setting key, review schedule or network default changed.

## 1.304.0 - 2026-11-15

- **Tasks understand days.** Task input reads a natural-language due date: `today`, `tomorrow`, `Tuesday`/`next Tuesday`, `weekend`, `next week`/`next month`, `in 3 days`, `on Nov 20` and ISO dates set the due date and their words (plus a leading `by`/`on`/`for`/`due`) leave the title. `plugin.addStudyTask()` parses the title only when no explicit date was picked, so a picked date keeps the title verbatim; the Task list, the Study Workspace form and the Focus day scratchpad (which chips `Due today`/`Due tomorrow`/`Overdue`) share the one `src/task-dates.js` parser, and both full surfaces hint at the trick. MIT plugins with the same idea (`nldates-obsidian`, `nldates-revived`, Task Center, Smart Gantt, Integrated Tasks) were surveyed and none copied: they lean on chrono or an engine that would break the startup bundle budget, so the closed date-only set here is dependency-free original code. Times of day are never read.
- `node --test` passes 2,917 tests; `npm run check` clean. No note format, existing setting key, review schedule or network default changed.

## 1.303.0 - 2026-11-15

- **Focus day: the calendar, the timer and quick tasks in one pane.** A full read of the Deadline plugin (`saydullayev017/deadline`: month calendar, Pomodoro timer, session task list) against this codebase showed every surface already exists here in deeper form — CalendarView with classes/ICS/exams, the work/short/long Pomodoro state machine with counts, autostart settings and chime, and the persistent tagged Task list — except four gaps, now closed with original code (no Deadline code reused): the `Open Focus day` command and `FocusDayView` combining a mini month calendar, the live Pomodoro card and a session scratch task list; a day click creates or opens that date's `YYYY-MM-DD.md` (`plugin.openDailyNote()`: Time blocks folder when set, else vault root, starter template with a Schedule section, new tab, transient confirmation); inline `Adjust` duration editing in both timer views (`plugin.setPomodoroDurations()`, clamped 1–180, paused timers reset to the new length); and a green break fill on both progress bars. The scratch list is deliberately session-only and never writes to a note.
- `node --test` passes 2,907 tests; `npm run check` clean. No note format, existing setting key, review schedule or network default changed.

## 1.302.7 - 2026-11-15

- **Notes land in the vault no matter where OpenCode runs.** A live 100-file overnight queue caught the import agent resolving its note folder against its own working directory: with a user-run server started outside the vault, two finished notes landed beside the vault while the file recorded done with zero notes. `runAgent()` now passes absolute vault paths (`absoluteVaultPath()` in `src/importer.js`, from `plugin.vaultPath()`) and the prompt says to use the paths exactly as written instead of claiming they are relative — absolute paths resolve the same from any working directory, and the vault-side reads, baseline and cleanup keep using vault-relative paths. The same run confirmed the misplaced notes' session: completed tool writes, a closing summary naming both notes, and nothing on disk in the target folder.
- **A queue parked mid-write names its reason.** A spent free tier parks the queue on the write side as well as the checks side, but only the checks side stored why, so the morning log read a bare `status: paused`. `pauseUnattendedForCap()` now stores the provider's sentence as the run's pause reason, and the log prints it under the header. The same session caught the journal round-trip dropping the reason (`normalizeOvernightRun()` whitelisted it out), so the reason is now part of the stored run and survives a reload.
- `node --test` passes 2,895 tests; `npm run check` clean. No note format, setting key, review schedule or network default changed.

## 1.302.6 - 2026-11-15

- **Empty folders from failed imports clean up with one command.** A run that fails before writing a note can leave its empty folder behind — nothing was written, so undo has nothing to remove — and repeated failures leave one empty directory per file. The command palette's **Clean up empty import folders** walks the import parent (the saved import folder, else the question folder, else `Questions`) and removes every empty folder, deepest first: each folder is listed again right before removal and only a folder still holding nothing goes, so a note anywhere inside keeps its whole chain, and folders holding leftover source copies are left alone too. (Real Obsidian refuses a non-recursive folder remove even when empty, so the re-check plus remove is what makes this work where the old fire-and-forget pattern silently left folders behind.) It refuses while an import is working, when a target folder can be briefly empty between the folder write and the first note. A notice reports how many folders went and that notes were not touched. `node --test` passes 2,892 tests; `npm run check` clean. No note format, setting key, review schedule or network default changed.

## 1.302.5 - 2026-11-15

- **A spent free tier says so in seconds, instead of failing every file after six minutes.** When OpenCode's provider refuses a request it leaves an empty, unfinished assistant message with no error, so the import could only wait out its silence allowance, restart the server and hit the same wall — a 100-PDF run failed file after file with "nothing was written for 6 minutes". The reason is on OpenCode's event stream as a `session.status` retry (`Free usage exceeded, subscribe to Go`, a rate limit, a rejected key) or a `session.error`; `OpenCodeClient.watchEvents()` now follows that stream with Node's `http` (a renderer `fetch` to the local server is refused) for the file in progress and `waitForAgent()` stops the file at once with the provider's own words. A `busy` status also refreshes the quiet-time clock, because the server saying it is working is not a stalled agent.
- **Answer checks stop on the provider's words too.** The blocking `OpenCodeClient.send()` used for checking answers now reads the same stream: a `retry` status or a `session.error` ends the check at once with the provider's sentence and aborts the dead request, and a `busy` status refreshes its quiet-time clock. A live run showed ten checks waiting out their allowances after the free tier ran out at 15:44:40.
- **An overnight queue parks on a spent free tier.** `isCapMessage()` treats `Free usage exceeded` like a spent request cap, so the queue pauses with its files pending and the morning log records the pause and the reason instead of marking every remaining file failed. A transient 429 is still retried, not parked.
- **A long chapter is no longer cut off at six quiet minutes.** `PdfImportModal.agentAllowanceMs()` adds about one second per thousand tokens of the file's own text to the six-minute base, capped at twenty minutes, so a slow model reading a big document is not declared stalled while a genuinely frozen request still ends at the cap.
- **An OpenCode server you run yourself is never booted behind your back.** `ensureOpenCode()` probes the configured address (4 s) when `ai.managed` is off and fails fast with the address and the fix, instead of starting the plugin's managed copy on a random port; a cold managed start slower than twenty seconds used to fail a file the healthy manual server would have imported.
- `node --test` passes 2,884 tests; `npm run check` clean. No note format, setting key, review schedule or network default changed.

## 1.302.4 - 2026-11-15

- **An overnight run reports what it really did.** The import window's **Start overnight** button marked the run unattended without creating its journal, so the closing notice counted a missing run as "0 files, 0 notes", no `Overnight import log.md` was written, and pause, resume and undo had nothing to work from. Both start buttons now journal the queued files before anything is written. The summary counts the notes it wrote out of the files it queued and names the first failure with the provider's own words. A file that fails before writing a single note removes its copied PDF, extracted text, images folder and the folder it created, while written notes are kept and a folder holding a pre-existing note is never touched. Verified live: three PDFs queued with the window's overnight button against an unreachable OpenCode failed on all three, every folder was removed, the journal kept all three errors, the log read "Files: 3 (0 done) · Notes: 0", and the notice read "0 notes from 0 of 3 files, 3 failed — <provider reason>". `node --test` passes 2,879 tests; `npm run check` clean; `main.js` is 7,392,029 bytes. No note format, setting key, review schedule or network default changed.

## 1.302.3 - 2026-11-15

- **A slow model is no longer mistaken for an empty one.** OpenCode creates the assistant message before the model answers, and both the blocking send used by blind checks and the import's progress poll treated any message with no parts as "sent no reply at all". A model still reading a long prompt therefore died after 90 seconds (checks) or 2 minutes (imports) even though it was working. Both now require the message to be finished before calling it empty, so an unfinished message falls back to the normal silence allowance while a provider that really refuses the request still completes the message empty within seconds and is reported at once. Verified live: three PDFs imported together on the free OpenCode models wrote six notes, all six `verified: true` with `verification: match`; a local CPU model that previously failed at 2 minutes kept working past that point. `node --test` passes 2,878 tests; `npm run check` clean. No note format, setting key, review schedule or network default changed.

## 1.302.2 - 2026-11-14

- **A spent free model no longer stops an import.** A quota, rate-limit or empty reply now sends the same file prompt to the next free model from the same provider in a fresh session, up to three switches, and the file's blind checks use whichever model replied. Paid models are never rotated to, a disk or PDF error never rotates, and a file that already has notes is never started again. Provider errors inside a live request are reported at once, an empty assistant reply fails after 90 seconds and an empty import reply after 2 minutes, and the import prompt now reads the extracted text, writes notes immediately and runs one folder check last. Verified on three PDFs: 6 notes, 4:32 / 3:45 / 4:28 per file, all checks matching; the fallback itself is covered by tests because every free model on the test machine was out of quota. `node --test` passes 2,877 tests; `npm run check` clean across 365 source files; `main.js` is 7,384,813 bytes. No note format, setting key, review schedule or network default changed.

## 1.291.1 - 2026-11-08

- **PDF++ Customize links scroll to their control.** The embedded vendor settings tab grew to its full content height inside MCQ Tracker's page, so its own `scrollToSetting` had no scroll range; the embedded copy now scrolls the addressed setting into Obsidian's actual settings pane. The page, no-separate-tab behavior, standalone-PDF++ guard and Study agent suggestion deck are unchanged. No schema, provider or dependency changed.

## 1.291.0 - 2026-11-08

- **PDF++ is one integrated settings surface.** The embedded host captures PDF++'s vendor settings tab instead of registering it as a second top-level plugin tab. **App & documents → PDF++** mounts the controls, and PDF++'s **Customize...** links and `obsidian://pdf-plus` protocol links open that page and scroll the visible copy. PDF++ was already bundled in `main.js`; installing MCQ Tracker does not download a separate plugin. The standalone-PDF++ conflict guard remains. `node --test` passes 2,431 tests; `main.js` is 6,847,319 bytes. No schema, provider or dependency changed.

## 1.288.4 - 2026-11-07

- **Community-review CSS cleanup.** The five `text-decoration-line` longhands are replaced by the scanner-supported `text-decoration` shorthand, and the phone full-screen panel drops the duplicate `100vh` fallback in favor of `100dvh`. The release-hygiene test now enforces both rules. The behavior findings are unchanged: the direct `fs`/`child_process` usage is the optional desktop OpenCode installer; the unmodified PDF++ vendor bundle adds its own `child_process` plus Electron IPC and `new Function`; and `main.js` remains 6,787,753 bytes. No feature, provider, note schema or dependency changed.

## 1.288.3 - 2026-11-07

- **Accessible study surfaces and release integrity.** The Web browser settings page is exposed in Settings → Global, Modules, so the opt-in browser can be enabled. Custom controls across views and modals now carry accessible names and respond to Enter and Space, narrow-width PDF, Settings, Study Stats, cards and time-block layouts wrap or scroll instead of clipping, and the current 20-image evidence set is committed. The plan is reconciled to 36 per-tool settings pages, 2,409 tests and 98 checked / 3 partial / 0 unchecked roadmap rows; the three partials are the unperformed owner manual passes. No provider, note schema or dependency changed.

## 1.288.2 - 2026-11-07

- **Study agent narrow-pane polish.** At 320 px the tutor role and per-chat model controls keep compact labels, the first table column stays on one line, all five context chips fit on one row, and the empty-state suggestion shows its full description. Full role and model names remain available in option titles and Settings. The patch also ships 16 current-tree captures at 320/420/560 px in light and dark (thread, empty, busy and error) plus the unchanged settings pair; the evidence README records the measured zero horizontal overflow, centered empty card and Send/Stop swap. No behaviour, provider, note schema or dependency changed.

## 1.241.0 - 2026-11-04

- **Web browser (opt-in).** A new view opens pages inside Obsidian in a sandboxed frame, with tabs (including a private tab that records no history), an address bar that accepts a URL or searches DuckDuckGo, Google, Bing or Wikipedia, per-tab back, forward, reload and home, bookmarks, a session history panel and 50–250% zoom. Only `http` and `https` addresses open; `javascript:`, `data:`, `file:` and every other scheme are refused before a frame exists. It adds no engine, extension, download manager, proxy, account or injected script, and a page that refuses framing falls back to **Open in browser**.

## 1.240.0 - 2026-11-04

- **Time-block tags (optional, off by default)**: a time block keeps up to six local tags, entered in the new **Tags (optional)** field and shown as chips on its card. A **Filter by tag** field in the Day view narrows that day's blocks and names the active tag when nothing matches, and **Write day note** now writes the tags after the title. Tags are lowercase, limited to letters, digits, `/`, `_` and `-`, deduplicated and never created in the vault. No note is written by tagging, and no dependency or network request was added.

## 1.239.0 - 2026-11-04

- **Time-block subject colours (optional, off by default)**: a **Subject colours** disclosure lists every course a block names with its block count and planned minutes, a colour picker and **Clear**. A course colour tints that course's blocks in Day and Week; a block without one keeps its project colour, and a block with neither keeps its type colour. Only `#rrggbb` values are stored, keyed case-insensitively and capped at 40 courses. Colours live in `settings.timeBlocks.subjectColors`, write no note, and add no dependency, provider or network request.

## 1.238.0 - 2026-11-04

- **Advanced Tables body-row sorting (optional, off by default)**: focus a cell in the column to sort and press **↑** or **↓**. The header stays in row 0; only body rows move. Numeric-looking cells compare numerically, other cells as text case-insensitively, blank cells stay last in both directions, and equal values keep their source order. A table with no body rows, an all-blank selected column, a missing column or an invalid direction is refused with a message and no write. Sorting shares the existing `updateTableBlock` live-editor/`vault.modify` queue, preserves padding, alignment and CRLF, and leaves TBLFM comments attached; formulas are not recalculated. Merged cells remain rejected.

## 1.237.0 - 2026-11-04

- **Advanced Tables formulas and CSV export (optional, off by default)**: a pure local evaluator handles `TBLFM` comments immediately after a table, including absolute, first/last/body and relative `@`/`$` references, ranges, `sum`/`mean`/`count`/`min`/`max`, arithmetic, comparisons, `if`, `round`, `abs`, `sqrt`, constants, chained formulas and `;%.2f`/`;%d` formatting. **Σ** commits the active cell and rewrites the table through the normal editor/vault queue; malformed or out-of-range formulas, relative destinations, unsupported formats and date/time formats are refused before writing. **CSV** copies the header and body to the clipboard with RFC-style quoting, escaped-pipe restoration and spreadsheet-formula protection, without changing the note. `;dt`/`;hm`, sorting and merged cells remain deferred.

## 1.236.0 - 2026-11-04

- **Advanced Tables cell formatting and column alignment (optional, off by default)**: the rendered-table toolbar now toggles **Bold**, *Italic*, `Inline code` and ~~Strikethrough~~ on the selected cell's Markdown source, and sets the selected column to left, center, right or default alignment. Toggling the same format twice restores the original text. Formatting an empty cell or a cell with unmatched markers, selecting a missing column or passing an invalid alignment is refused with a message instead of changing the note. Every action first commits an in-progress cell edit and then uses the same live-editor/`vault.modify` queue as cell edits and row/column structure, preserving padded columns, the delimiter row, escaped pipes and CRLF. Sorting, formulas, merged cells and CSV export remain deferred.

## 1.235.0 - 2026-11-04

- **Advanced Tables row and column controls (optional, off by default)**: a compact toolbar below each rendered table adds **+ Row**, **− Row**, **↑ Row**, **↓ Row**, **+ Col**, **− Col**, **← Col** and **→ Col**. It commits the active cell first, then inserts, deletes or moves the selected row or column through the same live-editor/`vault.modify` path as a cell edit. The header row cannot be deleted or moved, the last column cannot be deleted, and edge moves are refused with a message rather than wrapping. Every change rewrites the whole block with padded columns, preserved alignment, escaped pipes and the note's original line endings. Formatting commands, sorting, formulas, merged cells and CSV export remain deferred.

## 1.234.0 - 2026-11-04

- **Advanced Tables editing and navigation (optional, off by default)**: rendered Markdown table cells can be edited in place in reading view, with Tab/Shift+Tab, Enter/Shift+Enter and Alt+Arrow moving between cells without wrapping or inserting a stray newline. Every commit maps the rendered table back to its source block and rewrites the whole block with padded columns, preserved alignment and escaped pipes, so the note stays valid after a cell contains `|` or after columns grow. The module reuses Obsidian's Markdown renderer and the plugin's existing editor/note-write path; it adds no second editor, provider, dependency or network request. Sorting, formulas, CSV export, row/column insertion and merged cells remain deferred.

## 1.233.0 - 2026-11-04

- **Offline full WordNet**: the Vocabulary tab can import all four standard WordNet 3.x data files from the user's own copy, then search every noun, verb, adjective and adverb sense with glosses, synonyms and selected semantic relations. The parser and index are local and bounded; the data is stored in a vault folder, the index stays in memory, and a partial set or existing target is refused instead of overwritten. No lexical data is bundled or downloaded, and no dependency, provider, account or network request was added. The release also records the owner decisions: Code Runner stays deferred, full table-editor parity starts with editing/navigation after WordNet, UI/theme/navigation plugins stay out, and Copilot/Desmos/Excalidraw keep their local alternatives.

## 1.232.0 - 2026-11-04

- **Tally and text-timer blocks**: the installed-plugin review adds two local study blocks. A `tally` block shows side-by-side Correct/Incorrect counters with adjustable step sizes, accuracy, CPS and elapsed session time; state is keyed by note and optional id, survives a reload and never records a graded attempt. A `text-timer` block shows a plain-text passage with a start/pause/reset count-up clock and local state. Both write only their own settings slice. The accompanying audit records all 23 installed plugins, corrects the Advanced Tables, Hider and Markmind community ids, and documents the licensing, Code Runner security and UI/theme boundaries. No dependency, provider or network request was added.

## 1.231.0 - 2026-11-04

- **Live form fields when adding pages**: adding pages from another fillable PDF now clones each incoming field into the target AcroForm with a deterministic unique name, reparents the copied widget and preserves its value and appearance, so the added page stays fillable and independent of the source. Existing target fields are untouched, source bytes are unchanged, repeated merges resolve name collisions, and non-widget annotations survive. A button, signature, XFA or otherwise unsupported source field refuses the whole merge with `reason: "form"` and a message naming Add-pages. Extraction and splitting keep their separate flatten-on-copy behavior. Covered by real-byte engine tests and a real-window Add-pages test.

## 1.230.0 - 2026-11-04

- **Live duplicate-page**: duplicating a page from a fillable PDF now clones every widget's terminal field, registers it in the AcroForm with a unique `_2`, `_3` … name, reparents the copied widget, and keeps the value and appearance, so the duplicate is genuinely fillable and independent of the source. Repeated duplicates and existing top-level names resolve deterministically, non-widget annotations survive the page copy, and the source form stays untouched. A button, signature, XFA or otherwise unsupported field refuses the whole duplicate with `reason: "form"` and a message naming Duplicate-page; extraction, split and merge keep their separate flatten-on-copy behavior, and Move keeps its live-page semantics. Covered by real-byte engine tests and a real-window duplicate/reorder test.

## 1.229.0 - 2026-11-04

- **Duplicate-page and reorder form safety**: duplicating a page from a fillable PDF now copies it from a flattened
  serialised form copy, so values stay visible and the duplicate carries no orphan widget while the original form
  stays live. Moving a page now reports its live-form contract (`flattened: false`, `liveForm`), keeps the widget and
  value with the page, and names that behavior in the editor status. Unsupported forms refuse duplication with a clear
  form-specific message. Covered by new engine, refusal and real-window tests.

## 1.228.0 - 2026-11-04

- **Merging preserves form values**: adding pages from a fillable PDF now flattens a serialised copy before copying its
  pages, so the values stay visible and no orphan widgets enter the target. The target document keeps its own live form,
  the result reports `flattened`, and extract, split and merge share one preparation path. Covered by a new real-byte
  engine test plus the existing reader merge test.

## 1.227.0 - 2026-11-04

- **Extraction preserves form values**: extracting selected pages from a fillable PDF now flattens a serialised copy first,
  so filled values stay visible instead of the form being dropped. The document being edited keeps its live form, the
  result reports `flattened`, and `splitPdf` shares the same preparation path. An unsupported form refuses extraction with
  a clear message. Covered by a new real-byte engine test plus the reader page-operation suite.

## 1.226.0 - 2026-11-04

- **Continuous PDF reading**: the reader now builds every page into one vertical scroll stack instead of loading one page at a time.
  Scrolling updates the page field and page count, **Previous / Next / Page** jump the target page into view, and per-page text,
  highlights, ink, text boxes, notes, annotation rows and read-only form-field boxes stay on their own page. Saving flushes
  every dirty page in one sidecar write, and the existing undo/redo and editor page operations are unchanged. Covered by
  focused real-PDF/overlay tests plus the sidebar save round trip. Reader-level page-operation coverage also reopens the
  scroll view after reorder, delete/insert, rotate, extract, merge and undo/redo, asserting wrappers, labels, form overlays
  and annotation layers directly.

## 1.225.0 - 2026-11-04

- **PDF editor audit and fixes**: the full capability set is exercised on real PDF bytes, saved and reopened. Two proven
  gaps are fixed: **Select text** now offers **Copy selected text** for the complete selection, and moving a page now
  refreshes each form field's page label. The burn test now covers highlight, underline, strike-through and box marks,
  and a new reorder test proves a moved page receives its annotation while neighbouring page content stays unchanged.
  README documents the page-at-a-time reader and the copy path; release notes record the pass/limitation checklist.

## 1.224.0 - 2026-11-04

- **PDF passage tutor**: the reader's annotation sidebar gains **Ask AI** on every quote or note, and the toolbar
  gains **Ask AI about this page**. `src/reading-companion.js` shapes a cited, untrusted-labelled question from the
  quote, note, page, type and tags, or rebuilds the page text layer in reading order. The question goes through the
  existing Study agent chat, so streaming, Stop/Esc, the conversation library, Save chat and Insert into active note
  work unchanged. AI off, an empty annotation, a page with no text layer and a busy agent all refuse without sending.
  Covered by `tests/reading-companion.test.js` and the sidebar, plugin and reader tests. No dependency, provider,
  account or network request was added.

## 1.223.0 - 2026-11-04

- **Offline local tutor**: Direct API gains first-class **Ollama**, **LM Studio**, **llama.cpp server** and **Jan** presets,
  all loopback-only and keyless, beside the existing "Other OpenAI-compatible" option. The plugin still bundles no model or
  runtime and adds no dependency, account or network request; once the model is on disk, replies are generated locally.
  Choosing a local provider shows its address, commands and warnings in Settings, and **Fetch models** and **Test** work as
  for any provider. `src/local-models.js` holds the Gemma 4 setup text and offline notes, covered by
  `tests/local-models.test.js`. README documents the Gemma 4 sizes and memory, Ollama's 4096-token default context,
  `OLLAMA_NO_CLOUD`, the desktop-only localhost limitation and Gemma licensing.

## 1.222.0 - 2026-11-04

- **Streaming replies**: the Study agent renders assistant text as it arrives for both backends. `src/chat-stream.js`
  reads SSE across chunk boundaries and abort, and `ApiClient.streamChat` sends `stream: true` over `fetch` while
  `OpenCodeClient.stream` consumes the server's `/event` stream beside the blocking send. A provider that answers with
  ordinary JSON is delivered as one complete delta through the same callback, and a runtime without `fetch` keeps the
  old `requestUrl` path, so no reply is lost and no error is shown when streaming is unavailable.
- **Cancel keeps the partial reply**: **Stop** or **Esc** mid-stream commits the text received so far once, ignores the
  late reply, and leaves the Direct API history consistent, so **Regenerate** and **Retry** replace the partial answer
  instead of duplicating the question. Citations, Copy, Save chat and Insert into active note are unchanged.
- **Conversation library**: `settings.ai.studyChat` gains an id, title and timestamp, and archived conversations live in
  `settings.ai.chatSessions` through `src/chat-sessions.js` (newest first, one record per id, 20-conversation cap). The
  panel lists conversations with title and time; opening one resumes its exact history, and rename, delete and New chat
  keep one copy per conversation. Reopening the view restores the same conversation, and Save chat never overwrites an
  existing note. No dependency, provider, key or network request was added, and no Obsidian Copilot source is used.

# Changelog

## 1.221.0 - 2026-11-04

- **Answers cite a passage, not a line**: the study agent's local retrieval is now passage-level. `src/agent-retrieval.js`
  splits notes at headings, blank lines and six-line/700-character caps, ignores stopwords, ranks term coverage before
  repetition and then phrase, heading and path matches, allows two passages per note and scans at most 400 notes and
  200,000 characters each. The chat receives the quoted passage with `[[path#L12]] (lines 12-17)` instead of one line.
- **Chat controls**: **Copy** on every reply, **Regenerate** on the last answer, **Retry** after a failure, Enter to send
  and Shift+Enter for a new line, and **Save chat** writes the transcript to `Study agent chats/` without overwriting.
- **Continuity**: the Direct API transcript is kept in `settings.ai.studyChat` (newest 40 messages, 8,000 characters
  each) and restored when the Study agent reopens; New chat clears it. No dependency, provider or network request was
  added, and no Obsidian Copilot source is used.
## 1.220.0 - 2026-11-04

- **Page management is complete**: every page card keeps rotate, move up and down, duplicate and delete, and the
  page bar adds **Insert at** with **Insert blank page**, so a blank page can go between any two pages. Each
  action is one undo step and nothing is written until a copy is saved.
- **Refusals made explicit**: `rotatePage` rejects any angle that is not a multiple of 90 degrees, `movePage`
  rejects a destination outside the file instead of clamping it, and `addBlankPage` rejects a position outside
  0 to the page count. Deleting the last page and any page that is not in the file stay refused.
- **Per-page state follows the document**: the page map, extraction selection, thumbnails and form-field page
  labels are rebuilt after a reorder, delete, duplicate, insert or merge, so no stored index points at a
  neighbouring page.

## 1.219.0 — 2026-11-04

- **Shapes in the PDF editor**: `addShape` draws a rectangle, an ellipse or a
  horizontal rule at one of the nine text anchors in PDF points, with a colour,
  a border width and an optional 18% fill. Shapes under 4 by 4 points, over
  2,000 points a side, larger than the page, on a missing page or on a rotated
  page are refused. New **Shape / Position / Width pt / Height pt / Colour /
  Fill / Shape page** row and **Add shape** in **Add content**.
- **Page size**: `resizePages` scales pages to A4, Letter, Legal or a custom
  width and height and sets the page and crop boxes to the target, skipping a
  page already that size. Rotated pages and PDFs with live form fields are
  refused, because a widget would no longer line up with the content. New
  **Paper** select and **Resize pages** button.

## 1.218.4 — 2026-11-04

- **Splitting a form PDF keeps the values**: `splitPdf` flattens a serialised
  copy through `flattenForm` and splits that, so parts keep what the form showed
  instead of opening with no fields. The edited document keeps its live form.

## 1.218.3 — 2026-11-04

- **Flattened copies drop their widget annotations**: `flattenForm` now removes
  the form's widget references from each page's `/Annots`, so a flattened copy no
  longer carries annotations pointing at deleted fields.

## 1.218.2 — 2026-11-04

- **New fields respect the visible page**: `addFormField` measures a new field
  against `page.getCropBox()` (origin included) and rejects a stored widget that
  leaves no room for its border, instead of placing fields outside an offset or
  cropped page.

## 1.218.1 — 2026-11-04

- **Long explicit field names cannot duplicate**: an explicit `name` is shortened
  to 60 characters before the duplicate check, so a long name can no longer
  create a second field under an existing name.

## 1.218.0 — 2026-11-04

- **Undo and redo for every edit**: page operations, form values, drawing the
  annotations in, added text, images, page numbers and crops are each one
  reversible step, through buttons that name the action and Ctrl/Cmd+Z /
  Shift+Ctrl/Cmd+Z. Undo restores the document from the bytes each step saved,
  so undoing everything returns the file exactly as it was opened; Save clears
  the history. The stack is bounded and nothing is written before Save.
- **New form fields**: author a text field, checkbox, dropdown or radio group on a
  chosen page with its own default text, starting state or choices. Names come from
  the label with a numeric suffix on collision, saving writes the appearance
  streams, the form stays fillable and existing values are untouched. One undo
  step; unusable boxes, empty choice lists and explicit duplicate names are
  refused.
- **Watermarks, document properties and split**: one fitted, angled watermark
  line with its own opacity and colour, editable title/author/subject/keywords,
  and **Split every N pages** into separate files beside the original. The
  watermark and the properties are undoable; splitting is an export.
- **A real PDF editor**: **PDF: open the editor (pages and forms)**, or
  **Edit pages and forms** in the reader, rotates, reorders, duplicates and
  deletes pages, adds blank pages, merges pages from another PDF, and extracts
  selected pages into their own file.
- **Content editing**: an **Add content** section types text onto one page or
  every page (size, colour, font, nine positions), places a PNG or JPEG from the
  vault, stamps `{n}`/`{total}` page numbers and crops the margins; the page
  previews re-render after each edit.
- **Form filling**: text fields, checkboxes, radio groups, dropdowns and option
  lists are editable, with an optional **flatten** so the values cannot be
  changed afterwards.
- **Your annotations travel with the copy**: highlights, ink, text boxes and
  quotes can be burned into the page content, correctly placed on rotated pages
  and still on the right page after pages are deleted or moved.
- **Nothing is overwritten**: every save writes `name (edited).pdf` beside the
  original, so the source PDF and its annotation sidecar stay untouched.
- Built on **pdf-lib 1.17.1** (MIT), vendored in `vendor/pdf-lib.js`. XFA forms
  and rewording text already on a page are refused rather than approximated.

## 1.216.0 — 2026-11-03

- **An annotation sidebar in the PDF reader**: every annotation in the open PDF
  is listed with its type, page, note and tag chips, searchable and
  type-filterable with the same rules as the index tab. A toolbar toggle and the
  **A** shortcut collapse it.
- **Click a row to jump** to its page and ring the exact mark; the selected row
  is visibly distinct.
- **Edit notes and tags, or delete, from the sidebar**: each change is written to
  the `.annotations.md` sidecar and redrawn at once, and a delete never moves the
  page.
- **Tags at creation time**: the mark and quote prompts now have a tag field, and
  the PDF annotations tab carries tags so its chips and the digest reflect
  sidebar edits.

## 1.215.0 — 2026-11-03

- **A fuller PDF annotator**: highlight, underline, strike-through and box marks
  alongside pen, highlighter, text boxes and the eraser.
- **Select text** turns a drag into a quote annotation with the exact words and
  one mark per selected line; annotations can carry tags and exact links.
- **Search and filter** the PDF annotation index by text, type and tag, and
  **export** a Markdown digest (never overwriting an earlier one).
- The reader now reopens the last page of each PDF.

## 1.214.1 — 2026-11-03

- Fixed **Study agent replies failing to render** in the live Obsidian view.
  `ChatPanel` renders assistant Markdown through the owning view's `md` helper;
  the sidebar `AgentView` did not define one, so the first reply would throw a
  `TypeError`. It now uses the plugin's existing Markdown renderer.
- Added a mounted-view regression test that opens the real `AgentView`, draws
  an assistant reply and confirms the insert action is rendered.

## 1.214.0 — 2026-11-03

- Finished the right-sidebar **Study agent** gaps: a bot ribbon entry, an
  **Ask about this note** action, automatic local vault retrieval before each
  question, and **Insert into active note** for every completed reply.
- Direct API requests now have a working **Stop** that stops waiting and ignores
  the late reply. Insertion goes at the editor cursor, appends when no editor is
  open, refuses a missing/non-Markdown note, and never rewrites frontmatter.
- Documented the agent's original MIT licensing and independence from Obsidian
  Copilot in `docs/sidebar-agent.md` and `NOTICES.md`.

## 1.213.0 — 2026-11-03

- Added a **Study agent** in the right sidebar. Chat with the configured AI
  provider, search the vault locally with path-and-line citations, and create
  cards through the existing review window. Full-vault context is opt-in and
  local search works without an AI provider.

## 1.212.0 — 2026-11-03

- Added **Cards: extract cards from a PDF or Markdown file**. Text is read
  locally first; Q/A pairs, definition lines, tables, separators and cloze marks
  become cards. Scanned PDFs still use the existing OCR flow.
- Every card is previewed before writing. Optional AI fallback runs only when
  local extraction finds nothing, and is off by default.

## 1.211.1 — 2026-11-03

- Fixed **Anki package (.apkg)** import dropping all but the first card of a
  note. Reversed notes now keep both directions, and notes with multiple card
  siblings keep each card with its own import key and Anki metadata.
- Single-card notes keep their previous `apkg:...` import key, so duplicate
  detection and updates are unchanged.

## 1.211.0 — 2026-11-03

- Added **Distraction-free practice mode** for phones and tablets, on by
  default. It hides Obsidian's top view header and bottom navigation bar while
  a question or result is active, keeps them hidden through answers, next
  questions, Passage/Question tabs and timer pause/resume, and restores them on
  exit, close, active-leaf change, plugin unload/reload or turning the setting
  off. Desktop is unchanged.
- Adaptive mastery now prefers a replacement that shares at least two
  properties with the recent question in the weak area, with a same-area
  fallback. A missed exact question stays out until its weak area reaches 75%
  effective accuracy with at least five attempts; a least-recently-attempted
  fallback prevents an empty session.
- The adaptive selector remains local and read-only, and the FSRS due-review
  path is unchanged.

## 1.210.13 — 2026-11-03

- **Every Study Workspace tab is covered by a test that mounts it through the
  view's dispatch**: Feynman, Recall, Topic planner, Courses, Annotations, Deep
  Notes and Quiz index join the tabs that already had workspace-level tests.
- **Use exam topics** in the Topic planner used to fail silently when no exam
  matched; it now says so in a notice, without clearing the typed plan.

## 1.210.12 — 2026-11-03

- **Course health** rows are no longer dead ends. Each course keeps its checks
  and now says how many warnings are left and offers **Overview**, which opens
  the existing course overview modal for that course. The tab stays read-only:
  no check, grade or note is changed.

## 1.210.11 — 2026-11-03

- The Retention tab's **Per-deck retention fit** card now shows the fit it
  describes instead of only linking to Settings: every deck with its review
  count, current target, the observation behind the suggestion, and Apply or
  Reset where those actions are valid. A deck without enough reviews says how
  many it has. The card no longer waits for a card scan, because it reads the
  review counters directly.

## 1.210.10 — 2026-11-03

- **Writing session (read-only)** in the Study Flow tab. Count words reports
  the active note's words, sentences and reading time and, after Start
  session, the words added since then. A finished session is stored as a
  local time-and-count row; the note is only read.
- **The glossary now covers both stores.** Build glossary keeps reading
  `Term: definition` lines and two-column tables, and also folds in the saved
  vocabulary list and the lecture-note `| Term | Definition | Lecture |`
  tables, so one lookup reaches note definitions, lecture vocabulary and
  dictionary words. A note entry wins over a duplicate vocabulary entry.

## 1.210.9 — 2026-11-03

- **Rename a task tag** in the Study Workspace Tasks tab. One tag is renamed
  across the local study tasks only, with a usage line and a merge when a task
  already carries the new name. Notes, frontmatter and other plugins' tags are
  never read or changed.
- **Glossary from your notes (read-only)** in the Vocabulary tab. Build glossary
  reads `Term: definition` lines and two-column tables in the vault's Markdown,
  then looks a term up with exact, prefix and inside-the-definition ranking.
  Each row links back to its note and line. Nothing is written or uploaded.
- The Tasks tab's add form now takes optional tags, so a task can be tagged
  in the workspace instead of only in the sidebar list.

## 1.210.8 — 2026-11-03

- The university **Calendar** now carries the Kairos plan itself. Its day
  section gains a **Study plan** card listing the planned blocks with
  **Remove**, the free slots inside an 08:00–22:00 window, and one chip per
  class to plan a 45-minute review block right after it.
- Clicking a free slot creates a study block through the existing Time blocks
  store, titled after the next class. Blocks that sit over a class are marked,
  and the summary reads planned, in-class and free time.
- Classes, notes and .ics feeds stay read-only: nothing is written back to the
  calendar, and the card only appears while Time blocks is on.

## 1.210.7 — 2026-11-03

- **Read aloud** gains a **Voice memo** card: **Record voice memo** captures
  the device microphone, and **Stop and save** writes the audio into the memo
  folder (default `Recordings`) and, when a daily-note folder is set, appends
  one line such as
  `- 14:32 ![[Recordings/Voice 2026-11-03 14-32-10.webm]] · 1 min 5 s · lecture recap`
  to that day's note. The note is created only when it is missing.
- An optional **Memo label** becomes part of that line. Nothing is transcribed,
  uploaded or sent to a model, and no provider or dependency is involved.

## 1.210.6 — 2026-11-03

- **Read aloud** gains three speech options: **Code blocks** (skip or read),
  **Spell out acronyms** (NASA as N A S A) and **Skip website URLs** (link
  labels are kept). The defaults reproduce the previous output.
- The same three options appear in Settings, Modules, Read aloud. Reading stays
  on the device voice: no provider, key, MP3 export or upload is involved.

## 1.210.5 — 2026-11-03

- The **Tasks** tab gains a **Vault checklist (read-only)** section. **Scan
  vault** lists `- [ ]` and `- [x]` lines from the Markdown notes with their
  note path and line number, and filters by text, tag or path.
- Fenced code blocks are skipped, non-Markdown files are ignored, and the scan
  is capped at 500 notes and 1,000 lines. Nothing is written: no note is
  edited, reopened or rewritten and no other plugin's task syntax is changed.

## 1.210.4 — 2026-11-03

- Each row in the read-only **PDF annotations** index now offers **Copy page
  link**, which copies an Obsidian wikilink such as
  `[[Papers/biology.pdf#page=12]]`, and **Open at page 12**, which opens the
  PDF at that page.
- Links are built only for a `.pdf` path with a positive whole page number;
  wikilink-breaking characters are removed from the path. Nothing is opened,
  resolved or written until you press a button.

## 1.210.3 — 2026-11-03

- Adds the opt-in **Citations** Study Workspace module: import a `.bib` file
  already in the vault, keep the parsed entries locally, filter by author,
  title, journal or key, and copy a plain-text reference with a DOI link.
- **Create note** writes a `type: citation` note with the formatted reference
  and a details table into the configured folder; an existing file is never
  overwritten. **Remove** only forgets a library entry.
- No reference-manager login, network request, CSL processor or Zotero
  database. Importing changes no note.

## 1.210.2 — 2026-11-03

- Time blocks can preview an optional daily note from a configured
  `YYYY-MM-DD.md` folder. Lines such as `09:00 Cell biology` or
  `09:00 - 10:30 Problem set` become local blocks only after confirmation.
- Existing blocks are matched and skipped, duplicates are reported, and the
  daily note itself is never written. **Open daily note** opens the source.
- This is the one-way part of the Study Flow Planner idea; subject colours and
  event tags remain backlog items.

## 1.210.1 — 2026-11-03

- Adds the opt-in **Time blocks** Study Workspace module: local Day, Week,
  Grid, Backlog, Routines, Projects/domains and Timeline planning, with tasks
  inside blocks and an optional readable Markdown day-note export.
- Reuses existing study tasks in the Backlog, treats routines as reusable
  offers and derives project/timeline minutes from the blocks themselves.
- When Calendar is on, Day and Week show its classes and events as read-only
  context and mark a block that overlaps one. Nothing is written, moved or
  copied; **Show calendar events** turns the context off.

## 1.210.0 — 2026-11-03

- Adaptive practice is now **Adaptive mastery**. It ranks course, unit, skill,
  topic, test, exam and tag facets from the whole question history, including
  accuracy, partial credit, pace, skips and recency, and targets the weakest
  facet in the selected question subgroup.
- The next item shares the weak facet but is a different question, preferring a
  different difficulty and an unattempted or long-unattempted note. Exact
  questions are suppressed for the session and for seven days after an attempt.
- Small subgroups borrow a prior from the same facet across the whole vault, so
  one attempt does not define a weakness. The selector is local and read-only;
  the FSRS due-review path is unchanged.

## 1.209.2 — 2026-11-03

- The Insights Progress and Today mastery pickers now offer names from the
  calendar course registry before a question note has a `course` value. Names,
  codes and aliases resolve to one subject; selecting a registry subject with no
  notes shows an empty result and keeps the picker available.
- Existing question-course scopes are unchanged when no registry is set. The
  progress snapshot cache includes the registry, so adding or renaming a course
  refreshes the dashboard.
- Cleared the remaining release-review CSS warnings: the SAT callout now uses
  sibling selectors instead of `:has`, its marked state is mirrored by a small
  post-processor, and `text-decoration`/`column-gap` declarations use compatible
  forms.
- The optional OpenCode desktop installer is unchanged.

## 1.209.1 — 2026-11-03

- Removed the optional JSXGraph presentation adapter and its vendored 1.14.2
  runtime after release review. Geometry and Vector field keep their local
  canvases; 3D curves, audio trace and vector fields are unchanged.
- The removed adapter was the new third-party runtime since the accepted 1.205
  release and added a dynamic-code surface plus a false-positive ZIP/self-update
  signal. No note or settings migration is required.

## 1.209.0 — 2026-11-03

- Completes the four remaining extended-calculator roadmap items in one release:
  **3D curves and detail levels**, **audio trace**, the local **Vector field** tab,
  and the MIT-licensed **JSXGraph** presentation adapter for geometry and fields.
- The 3D tab accepts `(x(t), y(t), z(t))` curves with t bounds, colour, Draft /
  Balanced / High detail, PNG export, print sheets and a bounded Web Audio
  sonification of curves and points. Curves and the selected detail persist.
- The new **Vector field** tab evaluates `P(x, y)` and `Q(x, y)` locally, scales
  arrows by magnitude or normalizes them, draws RK4 streamlines and persists its
  window and display settings. Geometry and vector fields can open an interactive
  JSXGraph board from the vendored 1.14.2 MIT build.
- No network request, dynamic `eval`, WebGL or map service was added. Tests cover
  curve sampling and bounds, LOD, print output, audio scheduling, field sampling,
  streamlines, persistence and both JSXGraph scene adapters.

## 1.205.0 — 2026-11-03

- The Reference **3D** tab now has Explicit and Implicit modes. Implicit mode
  accepts an equation `F(x, y, z) = 0`, such as `x^2 + y^2 + z^2 = 9`, and
  renders its zero set through the same bounded CPU ray-marcher, camera, box
  and point overlays as explicit `z = f(x, y)` surfaces.
- The selected mode and expression are saved in `settings.reference.threeD`;
  older 1.204 settings load in explicit mode unchanged. Switching modes keeps
  a valid expression and falls back to a matching example when the current text
  cannot be parsed in the new mode, so the canvas is never left blank.
- Malformed implicit input, multiple equals signs and broken expressions report
  a clear inline error and preserve the last valid surface. No WebGL, mesh
  library, network request, new dependency or `eval` was added.

## 1.204.0 — 2026-11-03

- The Reference panel has a local **3D** tab. Enter an explicit surface
  `z = f(x, y)`, set a finite bounding box, and orbit or zoom a camera around a
  software-rendered image. Points entered as `x, y, z` are projected and
  labelled over the surface.
- The renderer is a bounded CPU ray-marcher: low-resolution by design, capped
  at 80,000 pixels and 160 ray steps, with no WebGL, mesh library, network
  request or `eval`. Expressions, bounds, camera and points are saved locally;
  older settings load the default bowl.
- Invalid expressions, bounds and points are reported without replacing the
  last valid view.

Release notes are kept per version in [docs/release-notes](docs/release-notes).

## 1.203.0 — 2026-11-03

- Geometry transformations: translate, rotate about the origin, reflect across
  the x or y axis, and dilate about the origin. Transforms are dependent
  objects, so they follow their source and are removed with it.
- Invalid parameters and missing sources report a readable error.

## 1.202.0 — 2026-11-03

- Geometry constructions: midpoints, line/circle intersections, parallel and
  perpendicular lines, perpendicular bisectors, angle bisectors and circles
  through three points. Constructions resolve from their sources, and removing
  a source removes its dependants.
- Invalid or degenerate constructions report a readable error instead of
  breaking the tab.

## 1.201.0 — 2026-11-03

- The Reference panel has a **Geometry** tab. Add points by coordinate, then
  create segments, lines, rays, circles and polygons from point ids. Every
  object lists its measurements and can be removed; stale dependants are
  removed with their points. The drawing is saved locally.
- `src/geometry.js` holds the pure model and canvas painter; no dependency or
  network request was added.

## 1.200.0 — 2026-11-03

- The Reference Graph has an opt-in **complex** mode. The first visible
  expression is evaluated in `z` and drawn as domain coloring: hue is argument,
  lightness is magnitude, and invalid samples stay transparent. The raster is
  painted through the existing scene, so grid, PNG export and print follow.
- Complex graph input reuses the restricted `src/complex.js` parser; the mode is
  saved locally and defaults off.

## 1.199.0 — 2026-11-03

- The Reference Calculator has an opt-in **complex** mode. It accepts `i`,
  complex literals, implicit multiplication, powers, roots, logarithms,
  trigonometry and the complex helpers `abs`, `arg`, `conj`, `re` and `im`, and
  formats results as `a + bi`. Invalid or non-finite results are reported.
- Complex arithmetic and its restricted parser live in `src/complex.js`; the
  setting is saved locally and defaults off.

## 1.198.0 — 2026-11-03

- The Reference panel has a local **Matrix** tab: enter matrices A and B,
  resize them up to 6×6, and add, subtract, multiply, scale or transpose them.
  It also computes determinants, inverses, reduced row-echelon form and the
  solution of `A x = b` using the first column of B.
- Matrix operations are pure functions in `src/matrix.js`; the tab validates
  dimensions, blank cells and non-finite values, announces failures in a polite
  live region, and saves both matrices in the Reference settings.

## 1.197.0 — 2026-11-03

- Graph expressions accept summation and product notation:
  `sum(n^2, n, 1, 10)` and `prod(k, k, 1, 5)`, including sums that depend on the
  plot variable such as `sum(x^k, k, 1, 3)`. They evaluate numerically and draw
  through the existing canvas scene, so the screen, PNG export and print sheet
  all follow.
- Bounds must be whole numbers with start at most end and at most 10,000 steps;
  the loop variable must be a single unused reserved-free name, must appear in
  the expression, and must not appear in the bounds. Rejections are announced in
  the polite live region with a human-readable message, and a rejected expression
  is not persisted.

## 1.196.0 — 2026-11-03

- Graph paper controls: **grid** and **axes** checkboxes hide either layer, and
  an optional **grid step** sets a fixed spacing for gridlines and tick labels.
  Empty means automatic spacing; a non-numeric, non-positive, too small or too
  large step is refused with an announced message and the last valid value is
  kept.
- The paper settings are saved under `settings.reference.graph.paper` and restored
  with the graph. Settings saved before this release get the default paper — grid
  and axes shown, automatic step — and paint exactly as before. Every control is
  labelled and keyboard-operable, and changes are announced in the polite live
  region.

## 1.195.0 — 2026-11-03

- The graph expression list supports **Undo** and **Redo** for adding, editing,
  deleting and duplicating rows, plus a per-row **Duplicate** action that inserts
  a copy directly below. Undo restores the real row list, not just the text
  field, and a new edit clears the redo stack.
- History is bounded to 50 steps and lives only for the session, so memory cannot
  grow without limit and saved settings are unchanged. Every action is a labelled
  button with a correct disabled state, also reachable with Ctrl/Cmd+Z,
  Shift+Ctrl/Cmd+Z and Ctrl/Cmd+Y, and each change is announced in the polite live
  region.

## 1.194.0 — 2026-11-03

- The graph tab can place a vault image behind the axes. Enter the image path,
  insert it, and calibrate two image points by giving each point its position in
  the image (0–1 across and down) and the graph coordinates it should sit on; an
  opacity slider keeps the grid and curves legible. The image is painted first,
  beneath the grid, axes and curves, so the same scene carries it into the PNG
  export and the print sheet.
- The two-point placement, refusals and summary live in the pure
  `src/graph-image.js` module. Every new control is labelled, calibration changes
  are announced in the polite live region, and the image is saved with the graph
  settings, so older settings still load unchanged.

## 1.193.0 — 2026-11-03

- The graph tab can print. **Print graph** opens a paper-ready sheet with the
  drawn graph, the window, every expression and the data table; **Save print
  sheet** writes the same HTML sheet into `Exports` when a print window is not
  available.
- The sheet reuses the existing canvas scene renderer and carries its own
  black-on-white paper stylesheet with print rules, so nothing is drawn twice.
  The accessible summary announces what the sheet contains, and every control is
  labelled.

## 1.192.0 — 2026-11-03

- The graph data table has named columns: add, rename or remove up to eight
  columns, and give a column an expression such as `2 * time` so its cells are
  computed from the other columns. Regression rows can use any named column
  pair, chosen with the regression x and y selectors.
- The screen-reader summary announces the column count, names, computed columns
  and the selected regression pair, and CSV export writes every named column.

## 1.191.0 — 2026-11-03

- The graph expression list has collapsible folders. A folder header groups the
  rows below it, with a rename field, a collapse toggle, a live row count and a
  remove button that keeps the grouped rows. Collapsed rows are skipped by the
  drawing, trace, points of interest and data table, and the screen-reader
  summary reports each folder and its state.
- `plan.md` §3.12 records the remaining Desmos graphing-calculator gaps with
  per-row licence availability and target versions.

## 1.190.0 — 2026-11-02

- The graph has a screen-reader summary of the window and each row, and an
  optional data-table view listing every row's expression, kind and what is
  drawn, with a caption and scoped column and row headers.
- The table refuses an empty graph with a Notice instead of rendering an empty
  table. This completes the Desmos parity roadmap in plan.md.

## 1.189.0 — 2026-11-02

- The graph tab has a calculus panel for the entered expression: a numeric
  derivative at a point, a definite integral between two bounds, and whole-number
  sums and products over a range.
- Reversed bounds give the negative integral; an empty range sums to 0 and
  multiplies to 1; non-finite values, bad bounds, bad steps or tolerances and an
  unparsable expression are reported with a Notice instead of throwing.

## 1.188.0 — 2026-11-02

- The graph tab has a statistics panel: enter a list of numbers and get the
  count, sum, mean, median, sample standard deviation, quartiles and min/max;
  optional x and y lists add Pearson's correlation.
- Lists accept commas, semicolons and whitespace. Empty lists and non-numeric
  or non-finite entries are reported in place instead of throwing.

## 1.187.0 — 2026-11-02

- The graph tab has a math keypad that inserts x, y, powers, roots, pi, theta,
  trig and logarithms, parentheses, absolute value and comparison operators at
  the caret of the focused expression.
- An examples gallery loads parabola, sine and cosine, polar rose, parametric
  circle, inequality region, point list and piecewise graphs. It replaces an
  empty list and appends to rows already typed, and the result is saved.

## 1.186.0 — 2026-11-02

- The graph block exports its canvas as a PNG, its data table as CSV, and any
  expression as text, from labelled buttons that sit with the existing controls.
- Exports read the drawn state: the PNG re-paints the current window, row styles
  and display options at the device pixel ratio, and the CSV uses the table's own
  values with commas, quotes and line breaks escaped.
- Empty lists and platforms without a canvas, vault write or clipboard are
  refused with a message instead of throwing.

## 1.185.0 — 2026-11-02

- Each graph row has its own style: line width, an optional dashed stroke, fill
  opacity on filled rows, and point size on point rows.
- Style controls appear only on rows where they apply, carry accessible names,
  and are saved with the row list, window, lock and display options.
- Unstyled rows keep the previous rendering exactly; styles change only the
  canvas, never the samples, points of interest or the trace.

## 1.184.0 — 2026-11-02

- Optional minor gridlines between the labelled major lines, and x/y axis
  labels drawn in a gutter so they never overlap the tick text.
- Pi ticks label the x axis at multiples of π/2 (`π/2`, `π`, `3π/2`, `2π`), and
  an angle mode renders the same positions in degrees (`90°`, `180°`).
- Every display option is off by default and persisted with the viewport, so
  existing graphs render exactly as before until a control is switched on.

## 1.183.0 — 2026-11-02

- The graph canvas pans and zooms: drag to pan, scroll or pinch to zoom about
  the cursor, and use the `+`/`−` buttons, arrow keys and `+`/`-` keys when the
  canvas is focused.
- The window is one viewport object that every row kind, the sampler and the
  cursor trace read, so points of interest and the trace stay correct after
  panning or zooming.
- **Lock view** pins the window and persists it with the graph settings;
  **Reset view** auto-fits the drawn data in one action. Zoom is bounded.

## 1.182.0 — 2026-11-02

- Graph rows mark their points of interest: roots, the y-intercept, local
  extrema and the crossings between two rows, each refined by bisection or a
  ternary search and labelled on the canvas.
- Hovering the canvas reads out the x and y of the nearest curve, interpolated
  between samples, and a gap under the cursor reports no value.
- A **points of interest** control turns the rings off, and restrictions keep
  hidden roots out of the list.

## 1.181.0 — 2026-11-02

- The graph function library gains `sec`, `csc`, `cot`, the hyperbolic family
  (`sinh`, `cosh`, `tanh`, `csch`, `sech`, `coth`), the inverse-hyperbolic family
  (`asinh`, `acosh`, `atanh`, `acsch`, `asech`, `acoth`), `sign` and `round`.
- Two-value functions `mod`, `nthroot`, `gcd`, `lcm`, `nCr` and `nPr` evaluate
  with domain checks, and `tau` joins `pi` and `e` as a constant.
- Poles in `sec`, `csc`, `cot` and `atanh` sample as gaps instead of Infinity
  strokes, and malformed calls report inline instead of drawing nothing.

## 1.180.0 — 2026-11-02

- Points `(1, 2)`, `(-3, 0.5)` and slider points `(a, b)` draw markers instead
  of a polyline; a pair that uses `t` or `theta` stays a parametric curve and a
  single parenthesised expression stays explicit.
- `open` and `closed` select a hollow or filled marker, and a quoted label such
  as `(1, 2) "A"` replaces the coordinate label; labels flip inward at the right
  edge and drop below the top edge so they stay on-canvas.
- Point lists `[(1, 2), (3, 4)]` draw one marker per pair, restrictions filter
  individual points, and sliders and definitions are read in the coordinates.

## 1.179.0 — 2026-11-02

- Parametric rows `(cos(t), sin(t))` plot x and y against a shared parameter
  `t` (or `theta`), sweeping 0..2π by default and reading sliders and f/g/h
  definitions in both coordinates.
- A two-sided bound such as `{0 < t < 2pi}` sets the sweep exactly; any other
  `{…}` condition filters it, and non-real coordinates leave a gap instead of
  drawing a chord.
- `fill` after the pair shades a closed curve at 16% opacity and is rejected
  with an inline message for open or discontinuous curves.

## 1.178.0 — 2026-11-02

- Polar rows (`r = 1 + cos(theta)`, `r = 2 sin(3 theta)`, `r = 3`) sweep theta
  from 0 to 2π inclusive, so closed curves meet exactly and open ones do not
  chord across the window. Both `theta` and `θ` are accepted.
- A **polar grid** checkbox overlays rings and 30° spokes on the existing
  cartesian grid, alongside every shipped row type.
- Sliders work inside radius expressions, `{theta > 0}` / `{r > 0}` restrictions
  limit the sweep, and unsupported names report an inline error.

## 1.177.0 — 2026-11-02

- Domain and range restrictions (`y = x^2 {0 < x < 3}`, `{0 < y < 1}`) draw only
  inside their condition on expressions, implicit equations and inequalities.
- Piecewise rows (`y = {x < 0: -x, x >= 0: x}`) evaluate cases in order with an
  optional default branch; chained comparisons and `and`/`or` are supported.
- Restrictions compose with parameter sliders and reject being placed on a
  definition, slider or regression with a clear inline message.

## 1.176.0 — 2026-11-02

- Sidebar **Task list** restyle: an open/total badge, a counts line, a card-shaped
  add form and task cards with a red edge for overdue work, an accent edge for
  work due today, strike-through on completed rows and detail pills.
- Tasks can carry **tags**: set up to four when adding a task or from a row's
  **+ tag** field, shown as chips; a chip filters the list and **Clear** resets it.
- **1,395 tests pass**, `npm run check` is clean and `main.js` is rebuilt.

## 1.175.0 — 2026-11-02

- Inequality rows (`y < 2x + 1`, `x^2 + y^2 <= 9`, `≤`, `≥`) shade the
  satisfying region in the Reference Graph tab.
- Strict comparisons draw a dashed boundary and inclusive ones a solid boundary;
  regions follow the window and parameter sliders, and an empty region reports
  inline without stopping other rows.

## 1.174.0 — 2026-11-02

- Parameter rows such as `a = 2` render a slider with adjustable bounds and
  step, a live readout and Play/Pause animation.
- Later expressions, definitions and regressions share the same parameter value,
  so one slider can drive several rows. Reserved names and non-numeric values
  are rejected with clear messages.

## 1.173.0 — 2026-11-02

- The Reference Graph tab gains a Desmos-style x/y data table and `~` regression
  rows: `y ~ m x + b`, `y ~ a e^(b x)` and `y_1 ~ a x_1 + b`.
- Free names are fitted locally with a Levenberg-Marquardt least-squares solver;
  coefficients and R² appear under the row and the data points are plotted.
- Bad data cells and impossible fits report inline without stopping other rows.
  No dependency, no `eval` and no network request.
- plan.md §3.11 now records the Desmos parity roadmap, its permissively licensed
  reference sources and one release number per capability.

## 1.172.0 — 2026-11-02

- New sidebar **Task list** over the local Tasks data: open/overdue/due-today
  counts, add with an optional due date, complete, reopen and delete rows, and a
  shortcut to the Study Workspace Tasks tab.
- Opens from the **Open the task list** command and the `list-checks` ribbon
  button while Tasks is on, reuses the right sidebar leaf, falls back to a tab on
  phones, and detaches when Tasks is turned off.
- **1,385 tests pass**, `npm run check` is clean and `main.js` is rebuilt.

## 1.171.0 — 2026-11-02

- The Reference Graph tab is a Desmos-style expression list: several rows, each
  one an expression in `x`, `y = f(x)`, a reusable `f(x) = x^2` definition, or an
  implicit relation such as `y^2 = 2x + 1` or `x^2 + y^2 = 9`.
- Rows have their own colour and hide toggle, the window has separate `x` and `y`
  ranges, and a bad row reports inline without stopping the others.
- Explicit rows are sampled and implicit curves are traced locally with marching
  squares; the restricted parser still has no `eval`, network request or Desmos
  key. **1,380 tests pass**, `npm run check` is clean and `main.js` is rebuilt.

## 1.170.0 — 2026-11-02

- Responsive UI pass for Cards, Assignments, Insights, Reference, Study Tools,
  Study Workspace, Study statistics, Review calendar, Local events and
  Pomodoro at desktop and narrow pane widths.
- Study Workspace keeps the section rail on desktop and uses the compact section
  picker in narrow panes; all 19 sections remain reachable.
- Narrow fields, selects and actions meet a 44 px hit-area target, and local-event
  month cells use colour markers when full titles cannot fit.
- Real Obsidian 1.14.5 captures at 1200/390 in light and dark were inspected;
  **1,376 tests pass**, `npm run check` is clean and `main.js` is rebuilt.

## 1.169.3 — 2026-11-01

- Restored the optional one-click OpenCode installer removed in 1.169.1:
  **Download and install**, automatic first-time setup, SHA-256 verification,
  unpacking under `~/.question-tracker/opencode`, and managed `opencode serve`.
- The plugin again uses desktop `fs` and `child_process`. Obsidian's automated
  review may warn about direct filesystem and shell access; this is the accepted
  cost of one-click setup. Manual OpenCode and Direct API remain available.
- 1,329 tests pass; `npm run check` clean; `main.js` rebuilt.

## 1.169.2 — 2026-11-01

- Fixed the import dialog's `extensionOf is not a function` crash by
  exporting the document extension helper used by every import screen.
- Added a regression test that reads a real text source through the import
  modal and the shared document reader.
- 1,320 tests pass; `npm run check` clean; `main.js` rebuilt.

## 1.169.1 — 2026-11-01

- Removed the OpenCode auto-installer, so the shipped bundle no longer uses
  Node's `fs` or `child_process`. OpenCode remains available through a
  manually started local server.
- Removed the duplicate phone `height` declaration and the Pomodoro
  `!important`, preserving the `dvh` fallback and reduced-motion behavior.
- 1,318 tests pass; `npm run check` clean; `main.js` rebuilt.

## 1.169.0 — 2026-11-01

- Insights opens on a combined Overview with grades, course health, FSRS
  depth, due load and exam readiness in one At a glance row.
- Shared course identity, merged exams, per-exam plans, readings on Today,
  attendance from class notes and a single course overview.
- Partial credit, FRQ knowledge, calibration counts, timing depth, graduated
  exam caps, due-queue caps, per-deck retention fitting and FSRS-aware mastery.
- Blind verification, distractor checks, duplicate suppression, finite AI
  limits and local selected-note retrieval.
- History cap, overflow notices, snapshot caching and a lighter Today tick.
- 1,325 tests pass; `npm run check` clean across 230 files; `main.js` rebuilt.

## 1.168.1 — 2026-11-01

- The post-answer review now has a dedicated phone layout: review header,
  Review | Passage tabs, one review scroller and a safe-area action bar.
- Open question note, Known and Exclude moved to the More sheet; Done and
  Next question stay in the bottom action bar.
- Desktop and tablet review keep the existing shared split and receive no
  `.qt-m-*` classes.
- `main.js` rebuilt; 17 focused mobile tests and 1,228 tests total pass.

## 1.168.0 — 2026-11-01

- Added the local study-tools workspace: whole-note review, durable recall,
  statistics, review calendar, local events and Pomodoro.
