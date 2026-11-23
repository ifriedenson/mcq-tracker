# plan.md implementation audit — Nov 22, 2026 (main at `5986ef2` + mirror read-back)

Method: full read of `plan.md` (3,072 lines), checkbox census (`- [ ]` / `- [~]` /
`- [x]`), then verification of every non-checked item against `src/`, `tests/`
and `docs/`. Shipped areas were spot-checked for the implementing modules;
gates and decided-against items were checked by code search for the forbidden
capability.

## Result: no open implementation row

- **Checkbox census:** 112 checked `[x]` roadmap rows, **0 `[~]` partial**,
  **0 `[ ]` unchecked**. The single `- [ ]` string in the file (line 2073) is
  prose inside a comparison-table cell describing the Tasks plugin's syntax,
  not a plan row.
- **`npm run check` clean**, full suite **3172 pass / 0 fail**.

## Not implemented — and why (all by plan design)

### §3.9.6 gate table: 13 rows needing an owner input

Each was searched in `src/`; none is implemented. Local slices ship where the
plan says they do.

| Blocked row | Evidence it is absent |
|---|---|
| Whisper / Lecture Transcriber / Advanced Audio recording | Implemented in 1.307.33 as the opt-in desktop slice in `src/whisper-registry.js`, `src/whisper-wav.js`, `src/whisper-run.js`, `src/whisper-note.js`, `src/whisper-install.js` and `src/whisper-picker.js`; the plan is `docs/whisper-plan.md`. Mobile capture, hosted transcription and pronunciation scoring stay gated |
| AI tutor scoring and embedding RAG | No embedding index/model; tutor presets are prompts (`src/tutor-presets.js`) |
| Web lookup, AnkiWeb search, off-device semantic search | No search-provider client in `src/` (only a link URL in `src/ap-resources.js`); local cited vault search ships |
| Canvas LMS sync and Google Classroom OAuth | No OAuth client, no LMS sync code in `src/` |
| CBT `.vce` converter | Only an explicit exclusion note (`src/study-tool-settings.js:687`) |
| SAT scaled-score prediction | No `scaledScore`/`rawToScaled` in `src/`; local solver ships |
| Code Runner in-plugin execution | `child_process` used only to manage the OpenCode server process (`src/opencode-manager.js`); no user-code execution (`runUserCode`/`codeRunner`: no hits) |
| Misconception diagnosis on a miss (D4) | `topMisconceptions` groups existing error tags for display (`src/knowledge-record.js`); no named-misconception field and no automatic re-check question (`recheck*` hits are all flagged-answer blind-checks) |
| Quiz Generator wider providers and locales | BYOK path only; no additional provider allow-list |
| Spaceforge objective tutor | No tutor provider/objective model; mind map, review bar, statistics ship |
| Live AnkiConnect smoke test / live CouchDB two-device verification | Mocked-request tests only; owner manual gates E7–E8 |
| Factual spot-check of AI Spaced Repetition quizzes | Round-trip syntax validation only; owner review gate E10 |
| MDC AI-vision and legacy binary `.ppt`/`.doc` import | Vision is BYOK-keyed only; XFA/binary paths are explicit refusals (`src/pdf-editor*.js`) |

### Mission/§11 owner gates (no code to write here)

E7 (CouchDB two-device), E8 (AnkiConnect smoke test — `docs/anki-smoke-test.md`
is the owner procedure), E10 (human spot-check), O13 (external similarity
scan). Product questions 1, 2, 4, 5, 8, 9, 10 remain open questions by
decision, not implementation rows.

### §C decided-against — confirmed absent

No bundled `rrule` library (the `rrule` strings in `src/` are the ICS RRULE
property parsed locally for `.ics` import, not the BSD library the plan
declines); no full 1/2/3/U keyboard map (`src/practice-keys.js` is the minimal
map); no paid tier / checkout / Stripe in `src/`; XFA stays refused.

## Shipped — spot-verified this pass

- Mirror read-back (Doable #4 remainder): `parseMirrorTaskLine` /
  `applyMirrorEdits` (`src/task-mirror.js`), `applyMirrorNoteEdits` + hook +
  `apply-mirror-edits` command (`src/plugin.js`), `tests/task-mirror-edits.test.js`.
  `plan-to-implement.md` said this half was "still not written by the plugin" —
  corrected to shipped in this same change.
- Week timetable, class dots, semester rollover, week image, agenda rail,
  quick-add preview, task chips, agent-edit journal, editor diff nav:
  `src/calendar-week.js`, `src/class-dots.js`, `src/week-image.js`,
  `src/task-chips.js`, `src/agent-edit-journal.js`, `src/editor-diff-nav.js`
  all present with citing tests.
- §A areas present: FSRS (`src/fsrs*.js`), `.apkg`/AnkiConnect/CouchDB
  (`src/apkg*.js`, `src/anki-connect.js`, `src/couchdb-sync.js`), quiz
  generation + blind verification (`src/quiz-generator*.js`), canvas six-pack
  (`src/canvas-*.js`), Advanced Tables (`src/table-*.js`), SMILES
  (`src/smiles.js`), docked review (`src/note-review-dock.js`).
- §14 items 2–12: pins present (`tests/followups.test.js`,
  `tests/card-triage.test.js`, `tests/import-health.test.js`,
  `tests/anki-schedule.test.js`, `tests/privacy-audit.test.js`).

## Limits of this audit

Static (code + test + doc) verification only: no live Obsidian window, device,
provider key, Anki desktop, or CouchDB server was available — exactly the gates
above. Behavioural claims rest on the suite (3172 green) and the recorded live
drives in `docs/release-notes/`, not on a new live pass.
