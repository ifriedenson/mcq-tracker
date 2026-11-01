# Changelog

Release notes are kept per version in [docs/release-notes](docs/release-notes).

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
