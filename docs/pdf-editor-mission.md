# PDF editor mission — complete (Nov 4, 2026)

This is the record of the PDF editor work that opened when the owner reversed the §11 E4
gate on Nov 4, 2026 (1.218.0, vendored MIT pdf-lib 1.17.1) and of the three releases that
closed it: **1.242.0** links, **1.243.0** bookmarks and **1.244.0** form field
maintenance.

Everything below lives in `src/pdf-editor.js`, which has no Obsidian API, so all of it runs
under `node --test` on real PDF bytes. `src/pdf-editor-modal.js` only renders and
dispatches. No network request, provider, account or new dependency was added at any point.

## Capabilities

| Area | What ships | Released |
| --- | --- | --- |
| Open | empty, oversized, encrypted, damaged and over-2000-page refusals; page list with size and rotation | 1.218.0 |
| Pages | rotate 90/180/270, move, delete (never the last page), duplicate, blank insert, add pages from another vault PDF, extract, split every N pages, merge | 1.218.0–1.231.0 |
| Content | typed text, vault PNG/JPEG, page numbers, crop, watermark, rectangle/ellipse/rule shapes, A4/Letter/Legal/custom page size | 1.218.0–1.219.0 |
| Forms | fill text, checkbox, radio, dropdown and option lists; flatten; author a new field; **rename a field**; **delete a field and its widgets** | 1.218.0, **1.244.0** |
| Navigation | **link annotations**: an `http(s)` address or a jump to another page, written over a chosen area and read back exactly on rotated pages, then retargeted in place, given a new rectangle in place, moved to another page as the same annotation, **restyled in place** (border width, dash and `/H` highlight), or removed by number; a link whose action is a launch, a remote go-to or a named destination reads its file or destination and converts to an address or jump in place; any `/BS` border style — solid, dashed, beveled, inset or underline — and a chosen custom dash are read and edited in place; a custom dash phase is read, set and cleared in place; a launch link's file, a named link's destination and a remote go-to's file and destination are retargeted in place under their own action kind | **1.242.0**, **1.245.0**, **1.247.0**, **1.248.0**, **1.249.0**, **1.250.0**, **1.251.0**, **1.252.0**, **1.253.0**, **1.254.0**, **1.255.0** |
| Navigation | **bookmarks**: the document outline read as title/page/level rows and rewritten as a real outline tree, edited as indented `Title | page` lines, with an optional zoom and position written as a `/XYZ` destination | **1.243.0**, **1.246.0** |
| Reading | continuous reader, text selection, marks, ink, text boxes, notes, in-reader annotation sidebar, ask-AI-about-a-passage | 1.215.0–1.226.0 |
| Safety | every mutation is one undo step in a bounded byte-level history that returns the opened file byte-for-byte; Save always writes a new copy; the source PDF and its `.annotations.md` sidecar are never modified | 1.218.0 |

## Verification

- `tests/pdf-editor.test.js` — 90 tests on real bytes: page operations, form fill and
  authoring, flattening, shapes, resizing, links (URL, page jump, rotated page, indirect
  destination, retargeting, rectangle rewriting, moving to another page, border and highlight
  styling, beveled/inset/underline styles, custom dash patterns and phases, launch, named and
  remote targets with their in-place retargets, removal, every refusal), bookmarks (nested
  write/read, replacing, clearing, the raw tree, the text format, zoom and position views, every
  refusal), and field rename/delete with value and widget preservation.
- `tests/pdf-editor-record.test.js` — 5 tests that hold this record to the code: every capability
  it names is exported, every limit it states equals the engine's constant, the empty and damaged
  refusals behave, both editor files stay free of network calls, dynamic code and `innerHTML`, and
  every release it lists has its notes.
- `tests/pdf-editor-window.test.js` drives the real window against the built `main.js` in a
  mocked vault: rotate, move, fill, burn, save, the second-save path, the command, the reader
  hand-over, and the **Add link**, **Move link**, **Move to page**, **Style link** (border style, dash pattern and dash phase included) and **Change link** (with the **Change to** launch file, named destination and remote file and destination) rows.
- `tests/pdf-editor-history.test.js` covers the undo/redo history and its byte budget. The
  history keeps the opened file plus the last 20 steps within a 96 MB budget.
- At 1.244.0: full suite **1,887 pass**, `npm run check` clean across **297 source files**,
  `main.js` current across **298 modules**, `git diff --check` clean.
- At 1.247.0: full suite **1894 pass**, `main.js` current across **298 modules** at
  **4,939,537 bytes**.
- At 1.248.0: full suite **1897 pass**, `main.js` current across **298 modules** at
  **4,943,104 bytes**.
- At 1.249.0: full suite **1901 pass**, `main.js` current across **298 modules** at
  **4,947,473 bytes**.
- At 1.250.0: full suite **1905 pass**, `main.js` current across **298 modules** at
  **4,955,070 bytes**.
- At 1.251.0: full suite **1909 pass**, `main.js` current across **298 modules** at
  **4,960,953 bytes**.
- At 1.252.0: full suite **1915 pass**, `main.js` current across **298 modules** at
  **4,964,716 bytes**.
- At 1.253.0: full suite **1919 pass**, `main.js` current across **298 modules** at
  **4,967,616 bytes**.
- At 1.254.0: full suite **1923 pass**, `main.js` current across **298 modules** at
  **4,972,820 bytes**.
- At 1.255.0: full suite **1927 pass**, `main.js` current across **298 modules** at
  **4,976,540 bytes**.
- At 1.256.0: full suite **1932 pass** (record 5), `main.js` unchanged at
  **4,976,540 bytes** across **298 modules**.
- Release notes: `docs/release-notes/1.242.0.md` through `1.256.0.md`, with the earlier
  1.218.0–1.231.0 notes beside them.

## Review (Nov 4, 2026)

The record, this plan, `AGENTS.md` and the 1.242.0–1.255.0 notes were compared
against `src/pdf-editor.js`, `src/pdf-editor-modal.js`, `src/pdf-editor-history.js`
and the tests. **Every capability the record claims is in the code**; no feature
was missing and none was added. The one defect found was in this record: the
link-test bullet had been garbled by successive edits (“launch” twice, broken
lines), and it is rewritten above.

Security review of the editor found **no high-confidence vulnerability**: the
editor files make no network request, hold no credential, use no `eval` or
`new Function`, never set `innerHTML`/`insertAdjacentHTML`, and render only
through Obsidian's `createEl`/`setText`. The only write path is
`editedPathFor` + `vault.createBinary`, which strips leading slashes and every
`\ / : * ? " < > |` from the base name, keeps the original folder and never
overwrites an existing path. Parsing untrusted PDFs in-process with pdf-lib is
the residual risk, shared with the reader, and is recorded here rather than
claimed away. `tests/pdf-editor-record.test.js` now fails the suite if the
record or this purity claim drifts from the code.

## Remaining gates — refused, never approximated

- **XFA forms.** The engine cannot read or write them, so an XFA file is refused with a
  message rather than half-edited.
- **Encrypted PDFs.** `loadEditorDocument` reports the password requirement and refuses;
  removing the password is the user's step.
- **Rewording existing page text.** Text is only added, never reflowed, because rewriting a
  content stream would mean owning layout and font metrics.
- **Link targets are written, not verified.** A launch path, a remote path and a remote destination
  are written exactly as given (1.254.0, 1.255.0) — `/GoToR` carries its path in a file
  specification and its destination as `[page /Fit]` or a name in `/D` — and the other file is never
  opened, so the editor cannot check that the path exists, that the page is in it or that the name
  is defined there. An action this editor does not model (`/JavaScript`, `/SubmitForm`, `/Named` …)
  is preserved and refused for retargeting.
- **A dash phase is this editor's own encoding.** PDF's annotation border (`/BS /D`, `/Border`)
  carries lengths only, so a phase is written as `[phase [lengths]]` in both (1.253.0): one number
  from 0 to 1000 that needs a custom dash and its 1–8 lengths, and a file whose `/D` is flat keeps
  reading and writing exactly as 1.252.0 did. A `/BS` style outside solid, dashed, beveled, inset
  and underline is read as `other` and kept as it was until a style is chosen.
- **Hierarchical `parent.child` field names**, which are renamed by their own segment only.
  Bookmark destinations beyond a whole page shipped in 1.246.0 as a zoom and a position; any other
  destination kind is read as a whole page rather than guessed at.
- **Mobile editing** stays limited by Obsidian's own file handling; the editor is
  desktop-first.
