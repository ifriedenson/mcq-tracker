# MCQ Tracker — Plan to Implement

> Derived from [plan.md](plan.md) at commit `2ce2979` on November 8, 2026. This is a focused, read-only view, not the source of truth. It contains every open row and every explicitly captured future idea.
>
> **Current state: 0 unchecked roadmap rows, 3 partial/gated owner passes.** There is no approved, locally implementable roadmap row left. The captured ideas below are **not approved** and are not scheduled; the deferred track is **not near-term**.

## Status at a glance

| Bucket | Count | Meaning |
|---|---:|---|
| Unchecked approved roadmap rows | 0 | Nothing is waiting in the core roadmap. |
| Partial owner passes | 3 | Environment-blocked verification only; no code row. |
| Captured idea sets | 2 | Class Timetable and Doable; not approved. |
| Deferred tracks | 1 | Standalone mobile and monetization; explicitly not near-term. |

## Partial roadmap rows

The exact `[~]` rows from the roadmap:

- [~] **Math/chemistry visual audit (§5.16.1)** — visual pass in a real Obsidian window (light/dark, narrow pane, timed test, cards, chat); not performed in this environment; blocker and checklist in §B / §11 E1.
- [~] **Real iOS/Android audit (§5.19)** — physical iOS and Android device pass; not performed in this environment; blocker and checklist in §B / §11 E2.
- [~] **README screenshots (§10b)** — four real-window screenshots; mock images are not acceptable; not produced in this environment; blocker in §B / §11 E1.

## Open owner passes

Source: [plan.md §B](plan.md#b-owner-manual-passes-3--environment-blocked-unverified--rows). Full decision record: [docs/plan-decisions.md](docs/plan-decisions.md).

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

## Captured ideas — not approved

Both sections were captured on November 8, 2026. They add no checklist rows or release commitments. The source plan remains authoritative if these are later ranked.

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
