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
| Navigation | **link annotations**: an `http(s)` address or a jump to another page, written over a chosen area and read back exactly on rotated pages, then retargeted in place, given a new rectangle in place, **moved to another page as the same annotation** or removed by number | **1.242.0**, **1.245.0**, **1.247.0**, **1.248.0**, **1.249.0** |
| Navigation | **bookmarks**: the document outline read as title/page/level rows and rewritten as a real outline tree, edited as indented `Title | page` lines, with an optional zoom and position written as a `/XYZ` destination | **1.243.0**, **1.246.0** |
| Reading | continuous reader, text selection, marks, ink, text boxes, notes, in-reader annotation sidebar, ask-AI-about-a-passage | 1.215.0–1.226.0 |
| Safety | every mutation is one undo step in a bounded byte-level history that returns the opened file byte-for-byte; Save always writes a new copy; the source PDF and its `.annotations.md` sidecar are never modified | 1.218.0 |

## Verification

- `tests/pdf-editor.test.js` — 70 tests on real bytes: page operations, form fill and
  authoring, flattening, shapes, resizing, links (URL, page jump, rotated page, indirect
  destination, retargeting, rectangle rewriting, moving to another page, removal, every refusal), bookmarks (nested
  write/read, replacing, clearing, the raw tree, the text format, zoom and position views, every
  refusal), and field rename/delete with value and widget preservation.
- `tests/pdf-editor-window.test.js` drives the real window against the built `main.js` in a
  mocked vault: rotate, move, fill, burn, save, the second-save path, the command, the reader
  hand-over, and the **Add link**, **Move link** and **Move to page** rows.
- `tests/pdf-editor-history.test.js` covers the undo/redo history and its byte budget.
- At 1.244.0: full suite **1,887 pass**, `npm run check` clean across **297 source files**,
  `main.js` current across **298 modules**, `git diff --check` clean.
- At 1.247.0: full suite **1894 pass**, `main.js` current across **298 modules** at
  **4,939,537 bytes**.
- At 1.248.0: full suite **1897 pass**, `main.js` current across **298 modules** at
  **4,943,104 bytes**.
- At 1.249.0: full suite **1901 pass**, `main.js` current across **298 modules** at
  **4,947,473 bytes**.
- Release notes: `docs/release-notes/1.242.0.md` through `1.249.0.md`, with the earlier
  1.218.0–1.231.0 notes beside them.

## Remaining gates — refused, never approximated

- **XFA forms.** The engine cannot read or write them, so an XFA file is refused with a
  message rather than half-edited.
- **Encrypted PDFs.** `loadEditorDocument` reports the password requirement and refuses;
  removing the password is the user's step.
- **Rewording existing page text.** Text is only added, never reflowed, because rewriting a
  content stream would mean owning layout and font metrics.
- **Link styling and other link kinds.** A link's `/Border`, `/H` highlight mode and `/BS` border
  style are preserved but never edited, and a link whose action is neither an `http(s)` URI nor an
  in-file page jump (a launch, a remote go-to, a named destination) has no readable target here, so
  it can be moved and removed but not retargeted.
- **Hierarchical `parent.child` field names**, which are renamed by their own segment only.
  Bookmark destinations beyond a whole page shipped in 1.246.0 as a zoom and a position; any other
  destination kind is read as a whole page rather than guessed at.
- **Mobile editing** stays limited by Obsidian's own file handling; the editor is
  desktop-first.
