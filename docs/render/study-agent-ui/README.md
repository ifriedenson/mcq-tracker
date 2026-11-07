# Study agent UI evidence (1.288.0 capture set; current UI 1.288.1)

> 1.288.1 removed the remaining AgentView heading/intro, centered the empty card, kept the persona visible at 420/320 px and added Obsidian's `markdown-rendered` container. This 1.288.0 image set is retained; those corrections are covered by `tests/chat-panel-copilot.test.js` and `tests/ui-layout.test.js`. No new screenshots were captured because the browser and Obsidian runtime were unavailable.

Clean-room Copilot orientation: the transcript is first, a **ChatControls** strip
follows it, and the composer is last. The captures are the actual
`ChatPanel.build()` / `draw()` element tree, not mockups, loaded with the
plugin's real `styles.css` and Obsidian's default light/dark variables.

## Files

- `chat-{light,dark}.png` — the 420 px thread: a full-width bordered user card,
  flat assistant rows, a reasoning disclosure, a Markdown table and a clickable
  vault citation.
- `chat-empty-{light,dark}.png` — the 420 px first-run empty state with its
  suggested-action card.
- `chat-busy-{light,dark}.png` — the 420 px streaming state; **Stop** replaces
  **Send** and the partial reply stays visible.
- `chat-error-{light,dark}.png` — the 420 px provider-error card; the composer
  remains usable.
- `chat-560-{light,dark}.png` — the 560 px thread; mode and role fit on one line
  and the **Sources (1)** disclosure is visible.
- `chat-empty-320-{light,dark}.png` — the 320 px narrow empty state; the
  bottom-sheet composer fits without horizontal overflow.
- `settings-{light,dark}.png` — the grouped Settings → AI cards at 760 px. This
  pair is a structural fixture using the same `.qt-agent-settings` markup and
  real stylesheet, because Obsidian's `Setting` renderer is unavailable outside
  the app. It is unchanged from the 1.287.1 capture.

## Method

1. Build a real `ChatPanel` against the test harness fake app, with the API
   backend, a study command, context switches, a reasoning part and a vault
   citation.
2. Serialize the resulting classes, attributes and text into an Obsidian-like
   sidebar leaf.
3. Wrap the panel in the same `.qt-agent-chat` container used by `AgentView`,
   load the real `styles.css`, and set Obsidian's default light/dark variables.
4. Render in the Cloud browser at 2× DPR, capture the twelve chat frames in a
   contact sheet, crop each to 420×760, 560×760 or 320×640, and resize to 1×.
5. Measure in-page with `getBoundingClientRect`, `scrollWidth`/`clientWidth` and
   `getComputedStyle`.

Measured across the twelve frames: document `scrollWidth` equals the viewport
width; the transcript and composer have no horizontal overflow; the composer
sits 8 px above the panel bottom; message actions are 24 px; idle shows only
**Send**, busy shows only **Stop**; and there are no `qt-agent-avatar` or
`qt-agent-name` nodes. The 560 px frame exposes the citation disclosure and the
table renders as a table rather than raw pipes.

## Limit

There is no Obsidian app runtime in this environment. These images prove the
real `ChatPanel` markup and real stylesheet against Obsidian's theme variables
in a browser; they do not substitute for the final check in an installed
Obsidian light and dark theme. The settings pair is the documented structural
fixture above. The generator and local server live under `artifacts/` only for
this capture and are not part of the plugin.
