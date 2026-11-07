# Study agent UI evidence (current 1.288.2 tree)

Captured Nov 7, 2026. Every chat image here is rendered from the serialized
element tree of the real `ChatPanel.build()`/`draw()` with the current
`styles.css`; they are not mockups and they are not the 1.288.0 set. The empty,
busy and error states use the real panel state classes (`.qt-hidden`, the inline
error card, the streaming caret).

## Target

The clean-room target is Copilot's transcript-first right-sidebar chat and the
plugin's own decisions in `plan.md` §5.18.1: no second branded header, a
full-width bordered user card per turn, flat assistant rows with no avatar or
speaker name, the transcript first, a **ChatControls** strip below it and the
composer pinned last. Colours, radii and type come only from Obsidian CSS
variables and the existing `qt-*` conventions; no Copilot stylesheet is used.

## Files

- `chat-{light,dark}.png` — the 420 px thread: user card, reasoning disclosure,
  assistant Markdown with a table, code block, clickable vault citation,
  **Sources (1)** and message actions.
- `chat-320-{light,dark}.png` — the same thread at 320 px: five context chips on
  one row, table header intact, no horizontal overflow.
- `chat-560-{light,dark}.png` — the thread at 560 px: full table, citation and
  Sources row with room; mode and role stay on one line.
- `chat-empty-{light,dark}.png`, `chat-empty-320-{light,dark}.png`,
  `chat-empty-560-{light,dark}.png` — first-run state at 420/320/560 px:
  centered card, suggestion deck and dots.
- `chat-busy-{light,dark}.png` — 420 px streaming: partial answer, caret,
  **Stop** only, queue hint.
- `chat-error-{light,dark}.png` — 420 px provider error: inline alert with
  **Retry**, composer still usable.
- `settings-{light,dark}.png` — the 760 px Settings → AI card group. This pair is
  the unchanged 1.287.1 structural fixture (same `.qt-agent-settings` markup and
  real stylesheet), because Obsidian's `Setting` renderer is unavailable
  outside the app.

All chat frames are exactly 320/420/560 × 900 px. The 900 px includes a 35 px
Obsidian-like leaf header (**Study agent**, `⋯`); the settings pair is
760 × 1080.

## What the first current-tree render exposed, and what changed

| Finding | Before | After |
|---|---|---|
| 320 px persona | the role select clipped its selected label behind the arrow (`Private tutc`) | `.qt-agent-role` caps at 84 px inside the 340 px container; selected labels are short (`Private`, `Socratic`, `Language`) while option titles and Settings keep the full names. |
| Model label | a long per-chat model id competed with the command controls | the default option reads **Chat default**; the full model is in the option and select title. |
| 320 px table | the first header cell broke into `For/m` | the first table column is nowrap; `Form` stays a word. |
| 320 px context chips | five chips wrapped or clipped the composer edge | at ≤340 px they use a 2 px gap, 5 px horizontal padding and 11 px type; all five sit on one row with 20 px slack. |
| 320 px empty suggestion | the detail was clamped at two lines and ended `with one worke…` | the clamp is three lines; the final capture shows the full sentence and measures `clientHeight = scrollHeight = 49 px` (three 16.2 px lines), so nothing is hidden. |
| Busy capture | the harness re-applied `qt-hidden` while serializing and the sheet showed **Send** | the harness was fixed; the current sheet shows only **Stop**, matching the real busy state. No plugin markup changed for this. |
| 1.288.1 header, empty and Markdown | the previous evidence predated the 1.288.1 changes | the current captures show the leaf title as the only header, the centered 32rem card, `markdown-rendered` bodies and unwrapped code. |

No other visual defect survived inspection: at every width the user and
assistant turns are clearly distinct, the table and code block render as such,
the citation is readable, the empty card is centered, and the composer stays
sticky with the Send/Stop affordance.

## Measured in the captured pages

- Document and transcript `scrollWidth - clientWidth` is 0 at 320, 420 and
  560 px.
- Empty card: 268 px at 320 (16/16 px margins), 368 px at 420 (16/16 px margins)
  and 480 px at 560 (30/30 px margins); it is capped at `max-width: 32rem`.
- The 320 px suggestion detail is not clipped (`clientHeight` and
  `scrollHeight` are both 49 px at a 16.2 px line-height).
- The five context chips share one row at 320 px; the last chip ends 20 px
  inside the composer edge.
- Idle: **Send** is `display: flex`, **Stop** is `display: none`. Busy: **Send**
  is `display: none`, **Stop** is `display: flex`.
- The composer is the panel's last child and is flush to its bottom (0 px gap).
  The harness leaf leaves 10 px below the panel; that strip in the images is the
  leaf inset, not a plugin gap.
- No `qt-agent-avatar` or `qt-agent-name` nodes exist; the leaf title is the only
  header.

## Method

1. Run `npm run build`, then build a real `ChatPanel` against
   `tests/helpers/fake.js` with the API backend, a study command, context
   switches, a reasoning part, a citation, and the thread/empty/busy/error
   states.
2. Serialize the resulting classes, attributes and text into a static
   Obsidian-like leaf; inline the current `styles.css` and Obsidian's default
   light/dark variables. The harness adds only leaf chrome, Markdown reader
   defaults and hover-visible message actions.
3. Regenerate 16 pages, one per width/theme/state, at 900 px tall.
4. Open the light and dark contact sheets in the Cloud browser at 2× DPR and
   capture full pages (3520 × 7400).
5. Crop each frame at the verified column/row geometry and resize to the final
   1× 320/420/560 × 900 images.

The harness and capture scripts are temporary and live under
`artifacts/render-study-agent/`; they are not part of the plugin.

## Limit

There is still no Obsidian app runtime in this environment, so the leaf header,
the surrounding chrome and the light/dark variable values are harness
approximations, not a screenshot of an installed theme. The settings pair is a
structural fixture and was not re-rendered. These images prove the real
`ChatPanel` markup and stylesheet at the three widths; the final in-app light and
dark check remains the owner pass.
