# Changelog

Release notes are kept per version in [docs/release-notes](docs/release-notes).

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
