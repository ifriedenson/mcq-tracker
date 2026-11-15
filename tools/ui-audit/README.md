# Real Obsidian UI audit harness

This is the harness used for the UI quality pass. It does not render a mock
HTML page: it attaches to Obsidian 1.15.0 over the Chrome DevTools Protocol,
uses the real plugin stylesheet and real view markup, and measures the rendered
DOM.

## Prerequisites

- Linux with Xvfb and an Obsidian 1.15.x installation.
- A disposable vault with the built plugin copied to
  `.obsidian/plugins/mcq-tracker/` (`main.js`, `manifest.json`, `styles.css`).
- Obsidian launched with `--remote-debugging-port=9222`.
- `node` 18 or newer. The harness uses the built-in `WebSocket` (Node 22+).

The setup used for this pass:

```sh
Xvfb :102 -screen 0 1920x1200x24 &
DISPLAY=:102 obsidian \
  --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --force-device-scale-factor=1 --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.local/obsidian-profile" \
  "$HOME/.local/mcq-vault"
```

`DISPLAY`, `LD_LIBRARY_PATH` and `FONTCONFIG_PATH` must match the Obsidian
build when it is unpacked outside a system package.

## Run

From the repository root:

```sh
node tools/ui-audit/run.mjs tools/ui-audit/jobs.example.json light
```

Each job may set `width` (default 1280), `height` (default 900), `theme`
(`light`/`dark`), `command` (an Obsidian command id) and `focus: false`.

A job that audits a plugin view should pin it, so the run can never measure a
neighbouring Obsidian surface:

```json
{
  "name": "task-list",
  "command": "mcq-tracker:open-task-list",
  "viewType": "question-tracker-task-list",
  "placement": "main",
  "expectClass": ".qt-task-list",
  "states": [
    { "name": "empty", "script": "(() => { /* arrange */ })()" },
    { "name": "typed", "focus": ".qt-task-list-new", "type": "Read chapter 4", "press": "Enter" }
  ],
  "checks": "(() => ({ rows: document.querySelectorAll('.qt-task-list-row').length }))()"
}
```

- `viewType` measures only `.workspace-leaf-content[data-type=…]` (the tab
  header carries the same attribute, which is what the old selector hit),
  focuses that leaf and fails the run when the measured surface is foreign or
  narrower than 200px.
- `placement: "main"` moves the view into the main tab group so a 1280
  measurement is a full-width pane; without it a sidebar view is 0px here.
- `expectClass` asserts plugin DOM on every state.
- `states` run in order; each writes `<name>-<width>-<theme>[-<state>].{png,json}`.
  `focus`, `type` and `press` drive real input (typed text plus Enter/Space).
- `checks` is an expression whose result is stored beside the metrics.

Jobs can also be an `.mjs` module exporting the array, which keeps those
scripts readable: `node tools/ui-audit/run.mjs tools/ui-audit/jobs-task-list.mjs light`.
Screenshots and measurements are written to
`artifacts/ui-quality/runs/<job>/<job>-<width>-<theme>.{png,json}`.

Use `CDP_TITLE` with `cdp.mjs` to inspect a separate target such as Settings or
Graph view:

```sh
CDP_TITLE=Settings node tools/ui-audit/cdp.mjs shot artifacts/settings.png 675 760
```

## What is measured

- Document and view horizontal overflow.
- Elements whose boxes escape the visible view root.
- Text clipped by `overflow: hidden` without an ellipsis.
- Text below 10 px.
- Controls smaller than 44 px at phone widths (and all controls narrower than
  32 px at any width).
- Contrast of every visible text node against its composited background,
  including `color(srgb …)` and alpha backgrounds.
- Sixteen Tab stops with computed outline, offset, ring and the winning focus
  rules.
- A control's wrapping `label` counts as its hit area, so a small native box in
  a large label is measured as the target a person actually hits.

## Limits

- Settings opens in a separate Obsidian window, so it needs the `Settings`
  target and DOM clicks; the main runner cannot see that window.
- Graph view also opens a separate target.
- The heatmap is a `role="grid"` of `gridcell` data points, not buttons. Its
  12 px cells are a deliberate chart density, not a primary action target.
- The Start here note uses Obsidian’s property editor. Those core controls are
  outside the plugin’s settings/UI contract.
- The evidence in `artifacts/ui-quality/runs` is generated and ignored by Git.
