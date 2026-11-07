# Study agent UI evidence (1.287.1)

- `chat-{light,dark}.png` — the provider-error state at 420 px.
- `chat-empty-{light,dark}.png` — the first-run empty state.
- `chat-busy-{light,dark}.png` — a streaming reply with **Stop** showing.
- `settings-{light,dark}.png` — the grouped Settings → AI cards at 760 px.
  Obsidian's `Setting` renderer is not available outside the app, so these are
  a structural fixture using the same `.qt-agent-settings` /
  `.qt-agent-settings-card` classes and row markup the tab generates, loaded
  with the real `styles.css` and Obsidian theme variables. Re-confirmed after
  the 1.287.1 fix; unchanged.
- The 1.286.1 320/420/560 px render matrix remains in
  `docs/render/study-agent/` (28 images, 0 measured issues).

The six chat images are serialized from the real `ChatPanel` markup
(`build()` + `draw()`), wrapped in `.qt-agent-chat`, with the plugin's real
`styles.css` and Obsidian's default variables. Captured in the Cloud browser at
2× DPR, cropped to the 420×760 fixture and resized to 1×. The temporary server
and generator are removed after capture.

1.287.1 fixes the track those captures exposed: the closed mention picker had a
base `display:flex` that won over `.qt-hidden`, so an empty 10 px box with its
own scrollbar stayed above the composer. The transcript itself had no horizontal
overflow (`scrollWidth === clientWidth` at 420 px); the earlier
`overflow-x:hidden` / `scrollbar-width:none` suppression was removed rather
than kept as a cover.
