# Practice view — reference notes from the exam app screenshots

A written record of the screenshots the owner sent on 8 November 2026, so the
layout work can continue in a later chat without re-sending them. The images
themselves are not stored in this repo; only these notes are.

Read this beside `src/practice-view.js` (the `qt-exam` block and the screens
added after `endPracticeSession()`) and the `Bluebook-style` sections of
`styles.css`.

## Clean room

The layout and behaviour here are reproduced from scratch. No code, artwork,
font file or wording is copied from the exam app. The owner removed the
practice-test banner from the plugin on 8 November 2026, so the strip below is
reference only and is no longer rendered. Colour names are descriptive; the plugin uses
theme variables so it follows the user's own accent, light or dark.

## A. Question screen, desktop

- **Header, about 64 px**: tinted strip. Left — section title at about 16 px
  semibold (`Section 1: Reading and Writing`, `Section 2: Math`) with a
  smaller muted `Directions` link beneath. Centre — the timer (`0:00`) at
  about 20 px semibold with a rounded **Hide** pill (about 64 x 22) under it.
  Right — labelled tool buttons, icon above an 11 px label: *Highlights &
  Notes*, *Calculator*, *Reference* (`X^2`), *More* (`...`). A 3 px dashed rule
  runs inside the bottom edge of the header, over the section band.
- **Section band** (reference only; the plugin no longer draws it): dark accent strip about 32 px tall with an uppercase,
  letterspaced caption centred and short dashes at both ends, followed by a
  light gap and a rounded bottom edge.
- **Body**: two columns split evenly by a 1 px vertical rule at the centre,
  with a small rounded drag handle on the rule, vertically centred. The
  passage sits in a centred measure about 780 px wide, serif, about 15 px,
  1.5 line-height. The question column is capped near 560 px and centred in
  its pane (its left edge lands around 640 of a 1600 px window).
- **Question header row**, about 32 px: accent-filled square badge (26 px)
  with a white number; a bookmark glyph and `Mark for Review` at 14 px; a 1 px
  rule filling the rest of the row; a 24 px outlined square with a highlighter
  glyph at the right end.
- **Answers**: full-width rows 44-48 px tall, 8 px radius, 1 px border, with a
  24 px lettered circle, the label at 15 px, 8-10 px between rows. Outside the
  box, 12 px to its right, a 22 px circular cross-out control: a letter with a
  small arrow pointing into it.
  - **Selected**: 2 px accent border, accent-filled letter circle with a white
    letter, text unchanged.
  - **Crossed out**: 1 px grey border, grey struck text, letter circle with a
    diagonal slash, and the outside control replaced by a small orange-outlined
    **Undo** pill (about 44 x 20).
- **Footer**, 48-56 px, tinted like the header behind a 1 px rule. Centre: a
  bordered `Question 1 of 8` pill (about 150 x 28). Right: pill-shaped
  **Next** (accent fill, white 14 px, about 72 x 30), with an accent-tinted
  **Back** about 100 px to its left once past the first question.
- **Narrow window** (about 780 px capture): the split is proportional rather
  than capped - the question column shrinks to roughly 180 px and the passage
  takes the rest. Text wraps hard; answers stay full width of that pane.

## B. Question menu, from the footer pill

- Card about 400 px wide, 8 px radius, 1 px border, soft shadow, centred above
  the pill with a tail pointing down at it; 16 px padding.
- Title at 15 px semibold on the left, a 20 px close mark on the right.
- Legend at 12 px muted: pin glyph *Current*, dashed square *Unanswered*, small
  red flag *For Review*, above a 1 px rule.
- Grid of numbers, 32 px squares, 4 px radius, 8 px gaps, centred. Answered:
  accent fill, white number, no border. Unanswered: 1 px dashed grey. For
  review: a small red flag on the top-right corner, outside the box. Current: a
  pin glyph centred about 14 px above the number.
- Footer: a **Go to Review Page** pill, 1 px accent border and accent text,
  12 px, about 150 x 28, centred.

## C. Check Your Work, end of section

- Header identical to A.
- Centred white body: title at 26 px regular; two muted 14 px lines explaining
  that on test day the next module waits for the clock, and that here the
  forward button moves on when ready.
- Card about 760 x 140, 8 px radius, 1 px border, white, 16 px padding. Header
  row: the section name at 15 px semibold on the left; legend on the right
  (dashed square *Unanswered*, red flag *For Review*); a 1 px rule beneath.
- Number grid: 34 px squares, 8 px gaps. Dashed grey = unanswered, accent fill
  = answered, red flag at the top-right = for review, thin outline = current.
- Footer: **Back** (accent tint) and the forward pill (accent fill) at the far
  right, about 40 px apart, nothing centred.

## D. Module hand-off

Empty white screen with no header or footer. Centred stack: a heading in the
accent colour at about 24 px; three 15 px lines - work saved, moving on
automatically, and a bold warning not to refresh or quit; then a small
dotted-ring spinner about 26 px below.

## E. Tools

- **Calculator**, docked left at about 700 px: white window with a title bar
  carrying `Graphing` / `Scientific` tabs, a drag grip in the centre and a
  close mark. Toolbar `+ undo redo gear collapse` on the left and a pen, plus
  and minus down the right edge of the graph. Scientific shows a two-row
  expression list, a bottom bar with a keyboard toggle, and a keypad
  (`x y a^2 a^b`, digits 7-9 and divide, brackets and comparison signs,
  `|a|` and inequalities, digits 1-3 and minus, `ABC`, backspace, root, pi,
  `0 . = +`, `functions`, arrows, backspace and a wide return key), with a
  `RAD | DEG` segmented control above.
- **Calculator settings** popover: `A | A` text size, *Reverse contrast*,
  *Braille Mode*, *Grid / Axis Numbers / Minor Gridlines* with three swatch
  buttons, *Arrows*, axis range fields with *Label* and *Step* hints, *More
  Options* with Linear/Logarithmic per axis and *Lock Viewport*, *Complex
  Mode*, and `Radians | Degrees`.
- **Reference sheet**, docked right at about 520 px: dark title bar with the
  title on the left, expand and close on the right; two-up formula cards
  (triangle and parallelogram areas, circle and triangle areas, cube and
  cylinder, sphere and cone, prism and pyramid volumes, special right
  triangles) and three note lines at the end.
- **More menu**: a white card about 240 x 300 under *More* - Help, Shortcuts,
  Assistive Technology, Line Reader, Unscheduled Break, Exit the Exam - 15 px
  rows with 20 px leading icons.
- **Highlight toolbar**, floating above a selection: a rounded white capsule
  about 280 x 44 with three circular swatches (yellow active and ringed, light
  blue, pink), a divider, an underlined `U` with a colour chevron, an eraser,
  and a bordered square with a copy mark.

## F. States seen

Answered and crossed out on the same question; mark-for-review applied (the
row behind the label tints, the bookmark fills and a red flag badge overlaps the
number badge); calculator open over the left column; reference docked right;
question menu open; a highlight painted in the passage.

## What the plugin implements today

| Piece | State |
| --- | --- |
| Header, section title, Directions, centred timer + Hide | done |
| Section band, question badge row, rule and highlight square | done |
| Outlined answers, selected state, outside cross-out + Undo | done |
| Footer pill, Back, confidence and Submit | done |
| Question menu popover with legend, pin, flag and review link | done |
| Check Your Work review page | done |
| Module hand-off with auto-advance | done |
| More menu | done, with the plugin's own items |
| Reference sheet, highlights, line reader, timer hide | done |
| Calculator | local arithmetic only - no graphing tab or keypad layout |
| Highlight toolbar | our three colours, no underline-colour menu |

## Not yet reproduced

- Grid-in answer entry (no lettered choices).
- Multi-select answers ("select two" style questions).
- The proportional column split with a drag handle.
- The calculator's graphing tab, keypad and settings popover.
- Blue and pink highlight colours, and the underline-colour menu.
- Assistive Technology and Unscheduled Break screens.
- The app's typeface; the plugin keeps Obsidian's UI and reading fonts.

## Log of what arrived

- 8 Nov 2026, batch 1 (10 images): reading and writing question with passage,
  More menu, floating highlight toolbar, crossed-out answers with Undo, narrower
  passage layout, math question with calculator open, scatterplot questions
  with a figure toolbar, More menu again, Reference sheet docked right,
  calculator settings, calculator keypad.
- 8 Nov 2026, batch 2 (7 images): graph question 1 of 7 with figure toolbar,
  calculator over the left column, Reference docked right, calculator settings
  over the graph, calculator blank with keypad, eliminations with Undo.
- 8 Nov 2026, batch 3 (8 images): Check Your Work at full width, question menu
  over question 8, question menu over question 6 with three eliminated answers,
  highlight toolbar over a selection, More menu, mark-for-review row, math
  section question 1 of 7, calculator keypad over the graph.
- 8 Nov 2026, batch 4 (6 images): reading and writing at a narrow split, the
  same question with one answer crossed out, the cross-out tooltip, the
  highlight toolbar enlarged, the More menu, a two-text question with the
  marked-for-review row tinted.
- 8 Nov 2026, batch 5 (7 images): question menu over a table question,
  highlight toolbar over a selected phrase, question menu over question 8
  again, Check Your Work, module hand-off, math question with calculator open,
  graphing calculator.
- 8 Nov 2026, batch 6 (6 images): scatterplot with an eliminated answer and
  Undo, math question 4 of 7 with the calculator keypad, calculator settings,
  calculator over the graph, More menu, an answered-and-crossed-out question.
- 8 Nov 2026, batch 7 (2 images): math question 4 of 7 with the keypad and an
  open panel, and a math question 6 of 7 with the Calculator tool active.

## Batch 5 — the remaining chrome

These were the last items from the screenshot set that had no implementation. They now exist:

| Screenshot detail | Where it lives |
| --- | --- |
| Draggable seam between passage and question | `.qt-split-handle`; ratio kept on the view, arrow keys nudge, double-click resets |
| Marked question tints its whole number row and grows a small red flag | `.qt-qhead.is-flagged`, `.qt-qhead.is-flagged .qt-qnum::after` |
| Grid-in entry looks like a boxed answer field | `.qt-exam .qt-spr` |
| Calculator: Graphing / Scientific / Basic tabs | `renderCalculatorPanel`; `calculator.plotPath` plots through the restricted evaluator |
| More menu: Help, Shortcuts, Assistive technology, Line reader, Unscheduled break, Exit the exam | `renderMoreMenu`; panels in `renderShortcutsPanel`, `renderAssistivePanel`, `renderBreakPanel` |
| An unscheduled break stops the clock | `renderBreakPanel` pauses the session and resumes it on the way back |

Still deliberately absent: the official app's exact wording, icons, fonts and colours, and any
College Board artwork. Everything here is drawn with theme variables.
