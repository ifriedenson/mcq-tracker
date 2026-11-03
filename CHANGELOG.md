# Changelog

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
