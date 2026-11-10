# MCQ Tracker UI design system

The plugin has one design-token layer at the top of `styles.css`. Components
consume those tokens rather than inventing local type sizes, radii, shadows,
focus rings or motion timings.

## Foundations

| Group | Tokens | Use |
| --- | --- | --- |
| Type | `--qt-type-2xs` … `--qt-type-5xl` | 10–34 px scale; headings step by 2 px or more |
| Space | `--qt-space-1` … `--qt-space-16` | 4/8 px ramp, 4–64 px |
| Radius | `--qt-radius-xs` … `--qt-radius-pill`, `--qt-radius-circle` | 4/8/12/16/20 px, pill and circle |
| Elevation | `--qt-shadow-1` … `--qt-shadow-3` | restrained, theme-aware shadows |
| Colour | `--qt-text-faint`, `--qt-link`, `--qt-accent-fill`, `--qt-success-text`, … | semantic roles resolved from Obsidian theme variables |
| Focus | `--qt-focus-outline`, `--qt-focus-offset`, `--qt-focus-ring` | one 2 px accent outline and 4 px ring |
| Motion | `--qt-duration-*`, `--qt-ease-*`, `--qt-iteration-*` | one timing vocabulary |

Semantic colours are declared on `body`, not `:root`: Obsidian defines
`--interactive-accent`, `--background-primary` and the text colours on the
theme body. A token such as `--qt-focus-outline` declared on `:root` computes
empty because those variables are not available there.

`prefers-reduced-motion: reduce` collapses the duration tokens to `0ms` and
the loop count to `1`, so components stop animating without `!important`.

Light and dark accent fills are deliberately mixed toward black just enough
for white text to reach 4.5:1. The dark fill is 88% accent; the light fill is
78%. Link and selected-control colours use the same semantic pair.

## Interaction contract

- `.qt-root` and `.qt-ui` scope the shared focus ring and disabled/loading
  states. Dialog containers and the settings root carry `.qt-ui`.
- Native controls keep their accessible names. Icon-only buttons need an
  `aria-label`.
- Pointer targets are at least 44 px at phone widths. Settings navigation and
  form controls are 44 px at every width.
- `summary` controls are 44 px high at phone widths.
- Chip rows wrap at phone widths instead of hiding actions in an unmarked
  horizontal scroller.
- Heatmap cells are `role="gridcell"` data cells inside a `role="grid"`; they
  are keyboard-operable but are not counted as buttons. Their 12 px visual
  size is intentional for a year-at-a-glance chart.
- Core Obsidian property-editor controls inside the Start here note remain
  Obsidian-owned; the plugin styles its own surfaces, not every core form.

## Real Obsidian audit

The evidence was captured in Obsidian 1.15.0 on Linux under Xvfb, not in a
synthetic HTML approximation. The repeatable driver is in
[`tools/ui-audit`](../tools/ui-audit/README.md).

The driver attaches to the live Obsidian renderer over CDP, applies the real
`styles.css`, selects the visible view or modal, measures the rendered DOM,
takes a screenshot, and then walks sixteen keyboard stops while recording the
computed outline and ring.

Last evidenced matrix:

| Width | Theme | Surfaces |
| --- | --- | --- |
| 320 | light | Today, Practice, Cards, Calendar, time blocks, Study Workspace, Study Tools, Reference, Reading library, Review calendar, Study statistics, Assignments, Progress, Local events, Pomodoro, Start here note, Welcome, What’s new |
| 768 | light | The same primary set |
| 1280 | light | The same primary set |
| 1280 | dark | Today, Cards, Calendar, Reference, Study statistics, Progress, Welcome |
| 675 | light | Six settings categories: Practice, Cards & memory, Courses & planning, Notes & tools, Study agent, App & documents |

Measured results after the final fixes:

- No horizontal document or view overflow at 320, 768 or 1280.
- No clipped text, sub-10 px text, or contrast failures on the audited plugin
  surfaces in either theme.
- Focus uses a visible 2 px accent outline and 4 px ring.- 44 px targets on the audited narrow surfaces; Settings navigation and form controls are 44 px. Obsidian’s own inline toggle input remains a compact core control: its visible switch stays 18 px and its setting row carries the label.
- Calendar header controls are 44 px.
- All Settings pages were measured for horizontal overflow and undersized controls; the six category landing pages were also captured.

## Not covered by this rendered matrix

- The PDF and EPUB reader modals themselves were not rendered because the disposable vault had no PDF or EPUB fixture. The Reading library surface was rendered, and the PDF++ integration and PDF page-operation tests are green. The harness can target the reader modal when a fixture exists.
- The embedded PDF++ settings page is vendor-owned. Its root does not overflow horizontally, but it keeps its own dense inline documentation links, 22 px inputs and off-canvas preview toolbar. The plugin does not restyle another plugin’s controls.
- The remaining 15 px inputs on plugin settings pages are Obsidian’s hidden checkbox inputs behind its compact switch; the plugin does not replace the core switch.
- The Graph view is a core Obsidian surface; it was opened as a separate target and captured, not restyled by this plugin.

The vertical overflow reported in the JSON is the view’s own vertical scroll,
not a failure. `artifacts/ui-quality/runs/` is generated evidence and remains
untracked.

## Adding a component

1. Choose an existing type, space, radius, elevation and motion token.
2. Use a semantic colour token, not a raw colour.
3. Add `type="button"` and an accessible name to icon controls.
4. Check 320 px and dark mode before calling the component finished.
5. Add a focused regression to `tests/ui-tokens.test.js` only when the rule is
   part of the design contract, not for every visual tweak.
