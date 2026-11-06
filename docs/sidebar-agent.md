# Sidebar study agent

The **Study agent** is a right-sidebar chat view built into MCQ Tracker. It is
original code in this repository, released under the repository's [MIT
license](../LICENSE). It is not Obsidian Copilot, is not derived from Copilot,
and contains no copied Copilot source. Copilot is AGPL-3.0; none of its code,
prompts or stylesheets were used. See [NOTICES.md](../NOTICES.md).

## Opening it

Use either:

- the **bot** ribbon button (shown while AI is enabled), or
- the command **Study agent: open the sidebar**.

It reuses the right-sidebar leaf on desktop and a tab on phones. Closing the
view does not stop the configured AI provider.

## What it does

- **Chat with the existing provider.** The panel uses the plugin's current
  OpenCode or Direct API settings and API-key store. No second provider setting,
  key store, model list or network client is introduced.
- **Ask about the active note.** The **Ask about this note** action turns on
  current-note context for that request only and asks about the note you are
  editing.
- **Ask against the vault.** Before each chat request the agent runs a local,
  read-only search over Markdown notes. Matching excerpts are added to the
  system context as path-and-line citations, and the transcript is instructed
  to cite vault material as `[[path]]` or `[[path#L12]]`.
- **Opt in to a full-vault index.** Paths-only file context stays off until the
  checkbox is selected.
- **Insert a reply.** Every completed assistant reply has **Insert into active
  note**. It writes only after the button is pressed, inserting at the editor
  cursor (or replacing the selection). If the note is open without an editor,
  the reply is appended to the note instead. Frontmatter is never rewritten.
- **Stop.** OpenCode requests use the existing server abort. Direct API
  requests show **Stop** too: it stops waiting immediately and ignores the late
  reply, though the provider may still finish and bill the request.
- **Queue a follow-up.** While a reply streams, Send becomes **Queue**. A
  visible queue above the composer keeps submission order, **Cancel** removes
  one item, and each remaining item goes through the same model, mention,
  budget and injection path when the reply ends. The queue and its order
  survive a tab switch and a reload; after Stop or a provider error the next
  queued message still sends exactly once, and a refused queued message is
  reported instead of silently retried.
- **Open several conversations.** **New tab** opens another panel with its own
  transcript, model selector, token footer and queue; switching leaves an
  in-flight reply running. Closing a tab writes its conversation back to the
  existing library, and open tabs plus their order are restored from the same
  `settings.ai.studyChat` and `chatSessions` records on reload. **New chat**
  keeps its archive-and-start-clean behaviour, and the library still lists
  saved or closed conversations.
- **Create cards safely.** Agent mode proposals continue through the plugin's
  existing tool-review window. Nothing is written to a note until the learner
  approves it.
- **Run a saved study command.** The **Study commands** menu inserts a saved
  `/name` command; typing the slash form expands it before the common request
  path. `{selection}`, `{note}` and `{path}` are filled only when the chat's
  existing context switches allow that text, and an unknown `/word` is sent
  literally. Commands are capped at 40 entries of 2,000 characters. Settings
  can give each command its own model with one `command-id | model` line.
- **Mention a note or folder.** Type `@` in the composer or press the **@**
  button; the picker inserts `@[[path]]`. The target is resolved at send time
  only while **Include mentioned notes** is on. Up to eight mentions, 6,000
  characters per note and 12,000 in total; truncation is reported and a deleted
  target refuses the send instead of silently dropping context.
- **Choose the model per chat and per command.** The **Chat model** selector
  stores an override on the active conversation; the footer spells out the
  effective model and whether it came from the chat, a slash command or the
  global chat setting. Precedence is chat, then command, then global. A model
  that is no longer in the provider's fetched list is skipped with a visible
  warning, never a failed send.
- **See what will be sent.** The footer under the composer names the current
  note, selection, mentioned notes and folders, slash command and history, names
  the effective model, and estimates tokens against a local 12,000-token budget,
  warning at 80% and refusing an over-budget Send before any request.
- **See the context ring.** A compact ring and `~tokens / 12,000` label under
  the composer read the same `lastBudget` state as the text footer. They appear
  once the chat has a message or draft, update after sends and `/compact`, hide
  on an unused chat or when budget data is unavailable, and drop the label (then
  the whole gauge) at narrow container widths.
- **Save a local diagnostics bundle.** Run **Study agent: save diagnostics
  bundle** from the command palette to write one Markdown report under
  `Study agent diagnostics/`. It contains the plugin/version, platform, redacted
  settings, live chat-budget and model state, observed capability flags and
  recent local errors. Secrets and API keys are replaced before writing; it uses
  the normal Vault path and a Notice, with no network request or telemetry.
- **Include user-authored skills.** Turn on **Include skills** to load
  enabled Markdown notes from the configured **Study agent skills** folder.
  Optional `name`, `description` and `enabled` frontmatter control each note;
  the folder is read only while the switch is on, and the block is capped at
  20 skills, 4,000 characters each and 8,000 characters total. Skill text is
  labelled as user instructions, not vault data, and counts against the same
  12,000-token budget. **Study agent: create a skill note** creates a starter
  note in the folder.
- **Estimate cost locally.** Optional **Local model pricing** in Settings → AI
  takes `model | USD per 1M input | USD per 1M output` lines. The footer uses
  the effective model, token estimate and reply cap to show an estimated USD
  cost. No price list is fetched and an unknown model has no cost line.
- **Compact a long chat.** Type `/compact` to fold older Direct API messages
  into one local summary and keep the newest turns verbatim. It writes through
  the existing conversation storage, updates the token estimate and makes no
  provider call. A short chat reports that there is nothing to compact; on
  OpenCode it explains that the server owns the history and changes nothing.
- **Find, pin and archive conversations.** Search saved and archived chats by
  title or message text; each row also shows its model override; pin a chat to
  keep it first; archive hides it from the default list while keeping it
  searchable and restorable. The active chat's model, every archived model and
  the per-command map live in the existing `settings.ai` storage and survive
  reopening.
- **Quick Ask from the editor.** Select text and choose **Quick Ask** (or the
  command) to open the compact panel. It sends only the selected text or the
  whole active note, whichever is switched on, and can copy, insert, replace or
  ask a follow-up. **Replace** checks that the selection did not change while
  the reply was pending.
- **Quick Chat from anywhere.** Run **Study agent: Quick Chat** from the command
  palette, or assign it a hotkey in Obsidian's hotkey settings. The compact
  prompt sends through the active Study agent panel, so it shares that chat's
  model, `@` mentions, context switches, 12,000-token budget, streaming, Stop
  and error handling. With no conversation open it starts one; invoking it
  again while open returns to the same prompt, so it cannot double-send.
- **Bookmark a message and copy its link.** Use **Bookmark** on any user or
  assistant message, then **Copy link** to copy an
  `obsidian://mcq-tracker-chat` URL. The link restores the conversation and
  focuses the message. Bookmarks are stored on the existing conversation
  record and survive reload, tab switches, rename and archive; a deleted chat
  or message produces a plain message instead of an error.

## Local search and privacy

Local search and the initial panel render require no provider. When AI is off,
the search box and citations still work. Turning on AI sends the selected
prompt, the retrieved excerpts, any opted-in current-note text and the optional
file index to the configured provider; it does not send the rest of the vault.

## Tests

`tests/agent-view.test.js` covers local ranking and citations, context assembly,
automatic retrieval before a question, the active-note action, transcript
wiring, cursor insertion, append fallback, refusal without an active note, and
the ribbon/command entry points. A mounted-view test opens the real `AgentView`,
renders an assistant reply through its Markdown helper and confirms the insert
action. `tests/note-context.test.js` and `tests/think-first.test.js` cover the
shared note context, provider, countdown, stop/cancel and error paths reused by
the panel. `tests/quick-ask.test.js` covers Quick Ask privacy, actions,
replacement safety, command parsing and round-trip, slash expansion and the
editor/user entry points. `tests/chat-budget.test.js` and
`tests/chat-mentions.test.js` cover the estimate, warning and overrun states,
mention parsing, candidate ranking, missing targets and bounded resolution,
`tests/chat-models.test.js` covers override precedence, unavailable-model
fallback, OpenCode shape checking and command-map parsing,
`tests/skills-pricing.test.js` covers skill parsing and disabled/missing
notes, prompt and budget integration, local price parsing/estimation and the
footer’s no-price state.
`tests/diagnostics-gauge.test.js` covers the local bundle, fake-key redaction
and no-network guard, plus gauge tracking and graceful hiding.
`tests/chat-compact.test.js` covers the no-op, over-budget, recent-turn and
impossible-recent cases, and `tests/chat-panel-mentions.test.js` drives the
switch, refusal, footer, picker, model selector, `/compact` and library
controls end to end. `tests/chat-tabs-queue.test.js` covers tab history and
model isolation across a reload, closing a tab back into the library, queue
ordering and exactly-once delivery, cancel, tab-switch and reload persistence,
and delivery after a provider error or Stop.

## Manual gate

A live Obsidian desktop/phone pass with a real provider is still manual. The
automated tests use a fake app and a mocked provider, so they do not prove
provider-specific streaming behavior or the visual layout on a physical device.
