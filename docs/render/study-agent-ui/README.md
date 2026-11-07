# Study agent UI evidence (1.287.0)

- `chat-{light,dark}.png` — the error state at 420 px, captured from the real
  `ChatPanel` markup (`build()` + `draw()`) serialized from the test DOM,
  wrapped in `.qt-agent-chat`, with the plugin's real `styles.css` and
  Obsidian's default light/dark variables.
- `settings-{light,dark}.png` — the grouped Settings → AI cards at 760 px.
  Obsidian's `Setting` renderer is not available outside the app, so these are
  a structural fixture using the same `.qt-agent-settings` /
  `.qt-agent-settings-card` classes and row markup the tab now generates,
  loaded with the real `styles.css` and theme variables.
- The empty and busy states from 1.286.1 remain in
  `docs/render/study-agent/` (28 images, 0 measured issues).

Captured in the Cloud browser at 2× DPR, cropped to the fixture and resized to
1×. The temporary server and generator were removed after capture.
