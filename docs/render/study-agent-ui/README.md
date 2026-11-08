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

## Real Obsidian check (1.15.0)

The plugin was copied into a test vault and opened in Obsidian 1.15.0 under
Xvfb on Linux. The 300 px sidebar pane, a 980 px main-pane leaf and the disabled
state were checked in light and dark; the captures are in
`artifacts/obsidian-test/shots/` (`55`–`64`).

- Three seeded suggestions: deck 218 × 116 px, active card 218 × 104 px, detail
  49 px; no horizontal overflow and three dots.
- Long label and detail: the card grows to 147 px and the deck to 161 px
  (`grid-template-rows: minmax(104px, max-content)`); nothing spills outside
  the card border. The detail keeps its intentional three-line clamp.
- Wide 980 px pane: only the active card's content is visible. The back cards
  are decorative, `aria-hidden` peeks; their content is hidden so labels cannot
  paint through the active card in either theme.
- A one- or zero-card deck is not reachable through ordinary configuration
  (the seeded list always has three). Those two states were produced by calling
  the real deck renderer with synthetic one/zero item lists; they are probes,
  not configuration states.
- Disabled AI points to **Settings → Study agent → AI and the assistant**.

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
