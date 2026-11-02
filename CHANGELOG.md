# Changelog

Release notes are kept per version in [docs/release-notes](docs/release-notes).

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
