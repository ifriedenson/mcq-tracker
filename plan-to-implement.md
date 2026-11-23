# MCQ Tracker — Plan to Implement

> Derived from [plan.md](plan.md) at commit `2ce2979` on November 8, 2026. This is a focused, read-only view, not the source of truth. It contains every open row and every explicitly captured future idea.
>
> **Current state: 0 unchecked roadmap rows, 0 partial/gated rows left open.** The last three owner passes closed on November 13, 2026 and the evidence is in plan.md §B; the 13 rows still blocked by a provider, credential, device or owner decision are in §3.9.6. There is no approved, locally implementable roadmap row left. Two gates moved on November 23, 2026 (`docs/plan-decisions.md`): §11 decision 2 now approves a bundled local Whisper build for planning, and the AnkiConnect smoke test is an owner-run procedure rather than an agent gate. Neither is implemented, the CouchDB half of E7–E8 is still gated, and the other rows keep their gates. Of the captured ideas below, 1.307.24 shipped Class Timetable 1 and 3 and Doable 4, and 1.307.25 shipped the rest of the locally buildable set (Class Timetable 2 and 4, Doable 1-3, both adapted Copilot rows); the deferred track is **not near-term**.

## Status at a glance

| Bucket | Count | Meaning |
|---|---:|---|
| Unchecked approved roadmap rows | 0 | Nothing is waiting in the core roadmap. |
| Partial owner passes | 0 | All three closed Nov 13, 2026; evidence in plan.md §B. |
| Captured idea sets | 2 | Class Timetable and Doable; three ideas shipped in 1.307.24, the rest of the locally buildable set in 1.307.25. |
| Deferred tracks | 1 | Standalone mobile and monetization; explicitly not near-term. |

## Partial roadmap rows

None. All three former `[~]` rows closed on November 13, 2026, and plan.md §B
holds the evidence:

- **Math/chemistry visual audit (§5.16.1)** — checked in a real Obsidian 1.15.1
  window across practice, choices, review, explanation, a timed test, cards and
  chat, in light, dark and a 600 px pane; no renderer bug was found.
- **Real iOS/Android audit (§5.19)** — closed at implementation level with all 18
  focused tests passing and a 600 px live render. No physical-device result is
  claimed; the checklist in `docs/mobile-layout.md` is an optional owner
  follow-up, not a gate.
- **README screenshots (§10b)** — satisfied by the 16 top-level PNGs and 26
  full-size frames already in `docs/images/`, all linked from `README.md` and
  present on disk.

Four further rows closed on November 6, 2026 (TTS/audio, pronunciation, FRQ
accuracy, pilot thresholds), and PDF→FRQ import shipped in §5.20.5. The 13 rows
still blocked by a provider, credential, device or owner decision are in
[§3.9.6](plan.md#396-gate-table-rows-that-need-an-owner-input), not here.

## Open owner passes

None. Every former pass has a recorded result in plan.md §B, or is listed as a
gate in §3.9.6.

## Captured ideas — not approved

Both sections were captured on November 8, 2026. They add no checklist rows or release commitments. The source plan remains authoritative if these are later ranked.

#### 5.22.13 Class Timetable 2.0 UI ideas — captured Nov 8, 2026

**Source:** [Class Timetable](https://github.com/elliott-json-park/obsidian-class-timetable), README's 2.0 feature set; MIT verified from the repository `LICENSE`. **Captured, not approved:** no source, styles, copy or dependency is adopted, and this subsection adds no checklist row, phase assignment or release commitment.

**Already covered — do not rebuild:** the existing calendar has term start/end, week numbers, reading weeks, odd/even parity (resolved in §11 item 16), course identity/registry, `.ics` import and filtered export, per-class note templates, exams/countdowns, Today/Upcoming, attendance and lecture history, and the 1.210.1–1.267.0 Time blocks planner. A second class store or a calendar-event-first rewrite is not warranted.

**Ideas worth considering, cheapest first:**

1. **Week timetable for the existing Calendar** — **shipped in 1.307.24** (`src/calendar-week.js`, the calendar's Week mode, `Calendar: open the week timetable`); a real-clock Mon–Sun grid over the same merged rows, lanes for overlaps, a now-line and an all-day strip, with no new schedule storage.
2. **Class-held dots on the course hub** — **shipped in 1.307.25** (`src/class-dots.js`, `plugin.classDotsData()`, `tests/class-dots.test.js`); one dot per scheduled meeting, note/attendance states, empty-dot note creation, no new property.
3. **Semester rollover** — **shipped in 1.307.24** (`Courses: start the next semester`, `rolloverCourses`, `SemesterRolloverModal`); one command stamps the label on courses that have none and moves the term window, without moving notes or rewriting the old term.
4. **Week image export** — **shipped in 1.307.25** (`src/week-image.js`, `Calendar: export the current week as a PNG image`, `tests/week-image.test.js`); SVG from the shared week layout, canvas raster in the app window.

**Deliberately not revived:** the paste-a-timetable parser remains out (the Oct 30 pass kept subject-timetable parsing out; `.ics` import covers portal exports), and no planner, task or schedule data is duplicated. `Today` and `Upcoming` already exist, so a third "today" view is not proposed; if the §5.8 `uni-schedule`-style embed is built, it should reuse this week view rather than add a second block syntax.

#### 5.22.14 Doable agenda ideas — captured Nov 8, 2026

**Source:** [Doable](https://github.com/elliott-json-park/obsidian-doable) (community listing: [community.obsidian.md/plugins/doable](https://community.obsidian.md/plugins/doable)), README at v1.0.2; MIT verified from `LICENSE`. The README also notes a bundled BSD-3-Clause `rrule`, so any recurrence parity must use the existing local scheduler/date code, not that bundle. **Captured, not approved:** no source, styles, copy or dependency is adopted, and this subsection adds no checklist row, phase or release commitment.

**Already covered or specified — do not rebuild:** Tasks-compatible `📅`/`⏳`/`🛫` syntax and recurrence (§5.9), assignments and study tasks, Today/due queue, the vault task index, Time blocks backlog/statuses, daily notes and the existing task-edit paths. Doable is deliberately a list, not a project manager; boards, Gantt, time tracking and calendar sync are out.

**Ideas worth considering, cheapest first:**

1. **Agenda rail over the existing task index** — **shipped in 1.307.25** (List|Agenda toggle, `studyTasks.agenda`, `doneAt` stamping, `tests/task-agenda.test.js`); overdue/today/per-day/later/no-date/done-today, capped tails, existing paths.
2. **Plain-language quick add with a preview** — **shipped in 1.307.25** (`previewTaskEntry()` in `src/task-dates.js`, live line in the add row, `tests/task-agenda.test.js`); picked dates win over spoken ones.
3. **Inline task chips** — **shipped for Reading in 1.307.25** (`src/task-chips.js` postprocessor, date picker, priority step, `tests/task-chips.test.js`); the vault index stays read-only and Live Preview has no overlay (recorded limit).
4. **Transient Undo on agenda edits** — **shipped for the plugin's own tasks in 1.307.24** (`updateStudyTaskWithUndo`): complete, reopen, star and repeat each leave the shared eight-second Undo. **The mirror-note half ships after 1.307.31** (`parseMirrorTaskLine`/`applyMirrorEdits`, `applyMirrorNoteEdits` plus the vault hook and the **Tasks: apply the mirror note's reschedules and cancellations** command): a changed date reschedules, a tick completes, `- [-]` or a deleted line cancels, due-queue link lines stay read-only. Nothing in this idea remains captured.

**Not proposed:** a second task format or store, a `doable`-specific syntax, bundled `rrule`, natural-language AI parsing, boards/Gantt/time tracking/calendar sync, or replacing the Tasks-compatible source of truth. If a query block is wanted later, support only the documented everyday subset and list unsupported clauses instead of silently changing results.

## Deferred long-term track — not scheduled

Source: [plan.md §10c](plan.md#10c-long-term-standalone-mobile-track-and-monetization). This is explicitly a long-term future track, not a second plugin and not near-term work.

### 10c. Long-term standalone mobile track and monetization

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

## Not in this file

- **Decided against:** [plan.md §C](plan.md#c-decided-against--do-not-re-propose-without-an-owner-decision) is not future work. It is excluded rather than silently moved into the backlog.
- **Completed work:** see [plan-completed.md](plan-completed.md).
- **Research scans and inventories:** the source maps, licence audit, Copilot parity matrix and external-plugin scans stay in [plan.md](plan.md); they are reference material, not approved implementation rows.
