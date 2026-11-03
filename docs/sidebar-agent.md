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
- **Create cards safely.** Agent mode proposals continue through the plugin's
  existing tool-review window. Nothing is written to a note until the learner
  approves it.

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
the panel.

## Manual gate

A live Obsidian desktop/phone pass with a real provider is still manual. The
automated tests use a fake app and a mocked provider, so they do not prove
provider-specific streaming behavior or the visual layout on a physical device.
