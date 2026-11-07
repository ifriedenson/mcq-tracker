# Study agent render evidence

These images are not mockups. Each one is the markup `ChatPanel.build()` and
`ChatPanel.draw()` actually produce, serialized into an Obsidian-like sidebar
leaf, loaded with the plugin's real `styles.css` and Obsidian's default theme
variables, and rendered in headless Chrome 131.

## Files

- `{theme}-{width}-{state}.png` — the whole `.qt-agent-panel` at that sidebar
  width, captured with the composer put back in flow so nothing is hidden.
- `{theme}-{width}-{state}-frame.png` — the same page at a 900 px-tall sidebar,
  showing the pinned composer and the real scroll position.
- `metrics.json` — every measured element box, `scrollWidth`/`clientWidth`,
  overflow flags, outside-pane and outside-composer flags, tap-target heights,
  computed colours and composited contrast ratios, per run.

Themes: `light`, `dark`. Widths: `320` (narrow/mobile), `420` (medium),
`560` (wide). States: `empty` (welcome screen), `thread` (two exchanges with
action rows and a mention chip), `busy` (typing row, Stop, queued messages).
The busy state is captured at 420 px only.

## Method

1. Build a real `ChatPanel` against the test harness fake app, with the API
   backend, a long model id, a study command and context switches on.
2. Serialize the resulting element tree with its classes, attributes and text.
3. Wrap it in `.qt-agent-chat > .qt-chat-tab-panel > .qt-agent-panel` inside a
   mock sidebar with Obsidian's default light and dark variable sets.
4. Render at 320/420/560 × 900 in Chrome, measure with
   `getBoundingClientRect`, `scrollWidth`/`clientWidth`, `getComputedStyle` and
   an alpha-composited contrast calculation, then capture the frame and the
   full pane.
5. Fail the run on horizontal overflow, anything outside the pane, a toolbar
   control outside the composer, overlapping header/toolbar children, a tap
   target under 24 px, or non-decorative text under 4.5:1.

Chrome needed workspace-local Ubuntu libraries and fonts because the VM has
no system fonts and no root; the harness was temporary and is not committed.

## Result

The final pass reports **0 issues** in all 14 theme/width/state combinations.
