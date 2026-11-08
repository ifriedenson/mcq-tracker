# Study agent UI evidence (rendered from the current worktree)

Captured Nov 7, 2026. Every chat image here is rendered from the serialized
element tree of the real `AgentView` and its mounted `ChatPanel` with the current
`styles.css`; they are not mockups. The full-pane frames include the
conversation tab strip and the collapsed **Search vault** disclosure. The empty,
busy and error states use the real panel state classes (`.qt-hidden`, the inline
error card, the streaming caret).

There are **18 chat images**: 16 full-pane frames at 900 px tall (thread at
320/420/560, empty at 320/420/560, busy and error at 420) plus two dedicated
420 × 230 composer crops. The unchanged settings pair is separate.

## See the deck in Obsidian

1. Copy exactly three files into `<your vault>/.obsidian/plugins/mcq-tracker/`:
   `main.js`, `manifest.json` and `styles.css`. The folder name must match the
   manifest id, `mcq-tracker`, and `manifest.json` must keep that name.
2. In Obsidian open Settings, Community plugins, and enable **MCQ Tracker**
   (turn off Restricted mode first if it is on). If an older copy is already
   enabled, reload it (or restart Obsidian) so the new `styles.css` is read.
3. Open the study agent with the command palette, **Study agent: open the
   sidebar** (id `open-study-agent`), or the **Open Study agent** ribbon icon
   that appears while AI is enabled. Leave the composer empty to see the
   suggestion deck; typing a question replaces it with the transcript.

## Target

The clean-room target is Copilot's transcript-first right-sidebar chat and the
plugin's own decisions in `plan.md` §5.18.1: no second branded header, the
conversation tab strip first, a full-width **filled, borderless** user card per
turn, flat assistant rows with no avatar or speaker name, a one-line local
**Search vault** disclosure, a **ChatControls** strip below the transcript and
the composer pinned last. Colours, radii and type come only from Obsidian CSS
variables and the existing `qt-*` conventions; no Copilot stylesheet is used.

## Captures

- `chat-{light,dark}.png` — the 420 px thread: active conversation tab,
  collapsed **Search vault**, filled user card, flat reasoning row, assistant
  Markdown with a table, code block, clickable vault citation, flat
  **Sources (1)** row and message actions.
- `chat-composer-{light,dark}.png` — 420 × 230 composer crop from a second real
  panel state with the draft **Compare ATP and ADP in one sentence.** It shows
  the **ChatControls** strip, the mode/role and settings affordances, the five
  context chips, the borderless input, the options row and the circular
  **Send** action. The idle state shows Send; the busy state shows Stop.
- `chat-320-{light,dark}.png` — the same thread at 320 px: the five context
  chips stay on one row, the table header is intact, and there is no horizontal
  overflow. The thread scrolls vertically at this width.
- `chat-560-{light,dark}.png` — the thread at 560 px: full table, citation and
  Sources row with room; mode and role stay on one line.
- `chat-empty-{light,dark}.png`, `chat-empty-320-{light,dark}.png`,
  `chat-empty-560-{light,dark}.png` — first-run state at 420/320/560 px:
  tab/search header, centered card, suggestion deck and dots.
- `chat-busy-{light,dark}.png` — 420 px streaming/loading: partial answer,
  streaming caret, **Stop** only, queue hint, same tab/search header.
- `chat-error-{light,dark}.png` — 420 px provider error: inline alert with
  **Retry**, composer still usable.
- `settings-{light,dark}.png` — the 760 × 1080 Settings → AI card group. This
  pair is the unchanged 1.287.1 structural fixture (same `.qt-agent-settings`
  markup and real stylesheet), because Obsidian's `Setting` renderer is
  unavailable outside the app.

## Copilot ↔ plugin mapping

| Copilot region | Plugin component | Token / state | Resolution |
|---|---|---|---|
| Conversation tab strip with **+** | `.qt-chat-tabs`, `.qt-chat-tab.is-active`, `.qt-chat-tab-new` | `--interactive-accent`, `--radius-m`; active tab is 168 px; close buttons reveal on hover/active/focus and are pointer-inert while hidden | Direct analogue; the active tab and **+** are first in the pane. |
| Header/context affordances and settings | `.qt-agent-controls`, `.qt-agent-mode`, `.qt-agent-role`, `.qt-agent-iconbtn`, `.qt-agent-history` | `--background-secondary`, `--background-modifier-border`, `--interactive-accent`; gear is the **Settings** action, `☰` is **Chats**, `+` is **New chat**, `↓` is **Save chat**, `⤢` is **Expand** | Plan.md places **ChatControls** below the transcript rather than in a branded top header. The model affordance lives in the composer, as in Copilot. |
| Scrollable message thread | `.qt-agent-thread` | Vertical scroll; zero horizontal overflow at 320/420/560 | Direct analogue; the thread is the first content region after the tab strip/search disclosure. |
| User bubble / role treatment | `.qt-agent-turn.is-user`, `.qt-agent-message.is-user`, `.qt-msg.is-user` | `--background-secondary`, `--radius-l`, no border; compact `.qt-agent-message-actions` on the card | Direct analogue; no avatar or speaker name. |
| Assistant row | `.qt-agent-turn.is-assistant`, `.qt-agent-message.is-assistant`, `.markdown-rendered` | Flat, no border or background; `--text-normal`; compact actions | Direct analogue; Markdown tables, code, citations and streaming content use the existing reader styles. |
| Reasoning / tool / source metadata | `.qt-agent-reasoning`, `.qt-agent-tool-card`, `.qt-agent-sources` | `--text-muted`, `--background-modifier-border`, hover-only backgrounds; tool states use `is-running`/`is-done`/`is-error` | The reference's visible duration/tool metadata maps to the reasoning summary, status-card and Sources rows. The local transcript record has no per-message wall-clock timestamp, so no clock time is fabricated. |
| Composer card | `.qt-agent-composer`, `.qt-agent-input`, `.qt-chat-context`, `.qt-agent-toolbar`, `.qt-agent-send-btn` | `--background-secondary`, `--radius-l` (18 px top corners at ≤600 px), `--interactive-accent`; 30 px circular Send/Stop | Direct analogue: context chips above a borderless draft, model selector and action row below, circular Send at the right. At ≤600 px plan.md keeps the mobile bottom-sheet shape. |
| Empty state | `.qt-agent-empty`, `.qt-agent-empty-mark`, `.qt-agent-suggestion-deck`, `.qt-agent-suggestion-card` | `--background-secondary`, `--radius-l`, `--text-accent`; centered 268/368/480 px card | Copilot-style welcome hierarchy, seeded by the plugin's existing study actions. |
| Loading state | `.qt-agent-caret`, `.qt-agent-thinking`, `.qt-agent-stop-btn` | `--interactive-accent` caret; Send swaps to Stop; reduced-motion fallback | Direct analogue; the partial answer and queue hint stay above the pinned composer. |

**Plan resolutions.** Copilot's visible top model/settings area is split in this
plugin: the tab strip stays first, **ChatControls** sits below the transcript,
and the model selector is in the composer. This follows `plan.md` §5.18.1 rather
than adding a second branded header. The composer's bottom-sheet shape at 420 px
is also the plan's mobile decision; the wide layout remains a rounded card.

## Measured in the captured pages

- Document and transcript `scrollWidth - clientWidth` is 0 at 320, 420 and
  560 px. The 320 px thread has a vertical scrollbar (`724` px content in a
  `570` px viewport); the 420 and 560 px threads fit vertically.
- Empty card: 268 px at 320, 368 px at 420 and 480 px at 560; page margins are
  26/26, 26/26 and 40/40 px including the 10 px leaf inset. It is capped at
  `max-width: 32rem`.
- The 320 px suggestion detail is not clipped (`clientHeight` and
  `scrollHeight` are both 49 px); the 420/560 px detail is 32 px.
- The active tab is 168 px wide at the fixture title; it fits beside its close
  control and the **+** new-tab control at 320 px.
- The five context chips share one row at every width; at 320 px the last chip
  ends inside the composer edge.
- **Search vault** and **Local only** are visible in every state; the disclosure
  starts closed and is not part of the settings fixture.
- Idle: **Send** is `display: flex`, **Stop** is `display: none`. Busy: **Send**
  is `display: none`, **Stop** is `display: flex`.
- The composer is the panel's last child and flush to its bottom (0 px gap).
  At 420 px it is 404 × 156 px and vertically fills to the 890 px pane bottom;
  the harness leaf leaves 10 px below the panel. That strip in the images is the
  leaf inset, not a plugin gap.
- The composer crop uses the same 2× capture rule: 420 × 230 px at 1×, with
  ChatControls at the top and the full composer below.
- No `qt-agent-avatar` or `qt-agent-name` nodes exist; the leaf title is the only
  branded header.

## Suggestion deck captures (Nov 8, 2026)

Twelve full-pane captures render the real `ChatPanel` suggestion deck from the
serialized element tree of the current worktree. They use the same frame as the
app (`AgentView`): `.qt-agent-chat > .qt-chat-tab-panels > .qt-chat-tab-panel >
.qt-agent-panel`. That chain matters: `.qt-agent-chat` is the
`container-type: inline-size` context for the panel's narrow-width rules, so a
page without it never applies the 470/420/340 px rules.

- `suggestions-empty-{320,560}-{light,dark}.png` — first run with the seeded deck.
- `suggestions-short-{320,560}-{light,dark}.png` — a short draft in the composer.
- `suggestions-long-{320,560}-{light,dark}.png` — a long suggestion title/detail
  and a long draft.

Measured from those pages (`suggestions-metrics.json`, 12 panes, viewport
560 × 900 per pane at 2× DPR):

| Check | 320 px | 560 px |
|---|---|---|
| Empty-state copy | 242 × 52 px, `scrollHeight` = `clientHeight` | 312 × 52 px, same |
| Empty card | 268 × 244 px | 508 × 244 px |
| Seeded deck / active card | 242 × 116 / 242 × 104 px | 482 × 116 / 482 × 104 px |
| Long deck / active card | 242 × 149 / 242 × 137 px | 482 × 116 / 482 × 104 px |
| Long title | 53 px (3 lines, unclamped) | 35 px (2 lines) |
| Long detail | 49 px, the intentional three-line clamp | 32 px (2 lines) |
| Mode / role chip | 60 / 82 px, full labels | 60 / 82 px |
| Token gauge label | hidden by `@container (max-width: 470px)` | shown |
| Back-card labels | `visibility: hidden` on all four | same |

No pane reports `scrollHeight > clientHeight` on the empty copy, the empty card,
the deck or the active card; the dots sit below the deck in every capture; and no
control row overlaps the composer. The empty card is centred in the taller thread
and the long card grows the deck instead of clipping its title.

Reproduce it with the local harness (gitignored, not part of the bundle):
`node artifacts/render-suggestions/build-pages.js` writes
`suggestions-all.html`; serve the repo on port 3000 and capture that page at 2×
DPR, then crop each 900 px pane.

## Real Obsidian check (1.15.0, Nov 8 2026)

The build (`main.js`, `manifest.json`, `styles.css`; plugin 1.291.2, whose
`main.js` and `styles.css` are unchanged in 1.291.3) was copied into a throwaway vault and opened in Obsidian 1.15.0 under Xvfb
(2400 × 1600 screen, 2× device scale, 1200 × 800 CSS window). AI was enabled,
**Study agent: open the sidebar** was run, a new chat was started and the
suggestion rotation was stopped so the seeded deck stayed on screen.

Five real-pane captures (cropped from the 2× screenshots) sit next to this
file:

- `obsidian-empty-narrow-light.png` — 296 × 555 px sidebar, empty state.
- `obsidian-long-narrow-light.png` — 296 × 600 px sidebar, long suggestion and
  long draft.
- `obsidian-long-narrow-dark.png` — the same state in the dark theme.
- `obsidian-empty-wide-light.png` — 512 × 522 px main-area leaf, empty state.
- `obsidian-long-wide-light.png` — 512 × 522 px main-area leaf, long state.

Obsidian clamps its right sidebar near 300 px, so the narrow capture is that
pane's 296 px content width rather than a forced 320 px; the normal-width
capture is a real main-area leaf, not a widened sidebar.

Measured from the live DOM at those panes:

| Check | 296 px sidebar | 512 px leaf |
|---|---|---|
| Empty copy | 238 × 70 px, `scrollHeight` = `clientHeight` | 397 × 52 px, same |
| Empty card | 264 px wide, unclipped | 454 px wide, unclipped |
| Seeded deck / active card | 238 × 116 / 238 × 104 px | 454 × 116 / 454 × 104 px |
| Long deck / active card | 238 × 162 / 238 × 150 px | 454 × 116 / 454 × 104 px |
| Long title | 214 × 65 px, 4 lines, unclamped | 430 × 33 px, 2 lines |
| Long detail | 49 px, intentional three-line clamp | 32 px, two lines |
| Mode / role chips | 44 / 68 px, **Tutor** / **Private** fully visible | same |
| Dots | below the deck | below the deck |
| Controls vs composer | 404–434 vs 466+, no overlap | 409–439 vs 471+, no overlap |
| Back-card labels | `visibility: hidden` on all four | same |

All six checks hold in the real app at both widths and in both themes, so no
stylesheet or markup change was required: `styles.css` and the built `main.js`
are byte-identical to the reviewed build. At 296 px the deck grows from 116 to
162 px for the long suggestion instead of clipping it, and the title keeps all
four lines.

The test rig (Xvfb launcher, unpacked Obsidian 1.15.0, throwaway vault and CDP
drivers) lives under gitignored `artifacts/obsidian-test/`. To reproduce: start
Xvfb at 2400 × 1600, launch Obsidian with
`--no-sandbox --disable-gpu --force-device-scale-factor=2
--remote-debugging-port=9222`, copy the three bundle files into
`<vault>/.obsidian/plugins/mcq-tracker/`, enable the plugin, then run
`run/capture-real2.py` and `run/capture-wide.py` with `PYTHONPATH=pylibs` and
`DISPLAY` set (the drivers crop the pane out of each 2× screenshot).

## Method

1. Run `node artifacts/render-study-agent/build-pages.js` after the current
   stylesheet is in place. It builds the real `AgentView` and mounted
   `ChatPanel` against the test fake, serializes the current element tree, and
   writes 18 static Obsidian-like pages. The `composer` state additionally sets
   the real textarea value to the draft above.
2. Run `node artifacts/render-study-agent/make-contact.js` to build the 16
   full-pane light/dark contact sheets. The composer pages are captured
   separately.
3. Serve `artifacts/render-study-agent/` on port 3001, open the contact sheets in
   the Cloud browser at 2× DPR, and capture full pages (`3520 × 7400`).
4. Run `python3 artifacts/render-study-agent/crop-finals.py` to crop the 16
   full-pane finals. Capture `composer-{light,dark}-full.png` at 2× and run
   `python3 artifacts/render-study-agent/crop-composer.py` for the two
   `420 × 230` composer crops.
5. The harness adds only the leaf chrome, Markdown reader defaults and
   hover-visible message actions. The plugin stylesheet and real component
   classes are inlined unchanged.

The harness is a local capture tool under `artifacts/`; it is not part of the
plugin bundle.

## Limit

The 18 fixture images are harness approximations of the leaf header, surrounding
chrome and light/dark variables, not screenshots of an installed theme; the
settings pair is a structural fixture and was not re-rendered. The real in-app
sidebar, wide-pane and disabled states are recorded above. The fixtures still
prove the real `AgentView` tab strip and search disclosure, the real `ChatPanel`
markup and the stylesheet at the reviewed widths.
