# Canvas auto-link (absorbed capability)

Source considered: [Overpowered Canvas](https://github.com/kfirgumay2005-hash/Overpowered-Canvas) (MIT, © 2026 kfirg), version 0.17.0.

This is the **fourth clean-room slice**. No source file from that project was copied and
no dependency was added: `src/canvas-auto-link.js` matches names with plain JavaScript
string and token comparison, on the same JSON Canvas 1.0 model `src/canvas-markdown.js`
validates. No `elkjs` (EPL-2.0), `monkey-around`, `perfect-freehand` or `x-opc` format is
involved.

## How a name is read

| Node | Title | Also matched by |
| --- | --- | --- |
| text card | its first non-empty line | — |
| file card | the basename without extension (`Biology/ATP.md` → `ATP`) | the path, the path without extension, the basename with extension |
| link card | its `label`, else the first line of its `text`, else its address | the address |
| group frame | none — a frame is a column, not a target | — |

Every comparison is case-insensitive and collapses runs of whitespace, so `Cell
Biology` and `cell   biology` are the same name.

## Two documented ways to match

1. **Wikilinks always match.** `[[Target]]`, `[[Target|alias]]`, `[[folder/Target#heading]]`
   and `![[Target]]` in a node's text are compared with every key of every node. The
   `|alias` and `#heading` parts are dropped, and a target with an extension also tries
   its extension-less form.
2. **Title mentions match a whole phrase.** Another node's title that is at least three
   characters and contains a letter is matched when it appears in the source text as a
   contiguous run of tokens. Matching is on word boundaries, so `ATP` never matches
   inside `ATPase`. Number-only and punctuation-only titles are not mention targets.

## What is refused instead of guessed

- **Ambiguous.** Two or more nodes share the title, so no edge is written and the
  candidates are listed.
- **Self.** A wikilink to the card that carries it gets no edge and is reported. A card
  whose text merely repeats its own title is not a self-link and is ignored.
- **Existing.** An edge `from → to` that is already on the board is never duplicated.
- **Unresolved.** A wikilink to a name that is not on the board is reported; no edge is
  written to a missing card or file.
- **Work limits.** At most 300 distinct mention titles, 4,000 characters of text per
  source, 120,000 characters scanned in total and 400 proposals are used; reaching a
  limit is reported by name rather than hidden.

## What is absorbed

- **Report.** `Canvas: report the active board's proposed links` opens a read-only
  window with each proposal as `source → target (why)`, then the ambiguous, unresolved,
  already-linked and self cases, and announces the same summary as a notice.
- **Apply.** `Canvas: link the active board's matching cards` adds only the proposed
  edges, with deterministic ids `auto-link-1`, `auto-link-2` … that skip ids already in
  use. Node positions, sizes, text, colours, group frames and unknown fields are copied
  through untouched. A board that is already complete is reported and not rewritten, and
  a second apply proposes nothing and leaves the file alone.
- **Deterministic.** Nodes and titles are processed in sorted order and proposals are
  sorted by source id then target id, so the result does not depend on the order of the
  nodes in the file.
- **Refusals** before any write: empty or damaged JSON, an unknown node type, and more
  than 2,000 cards.

## What is not absorbed, and why

Still not implemented: drawing and ink, the column view, ELK loop and orthogonal layouts,
smart groups, query groups, presentations, portals, minimap, frames, LOD rendering, RTL
and localisation, tutorials, and the `x-opc` in-canvas data format. Those either need the
EPL-2.0 layout engine with a TypeScript build (declined: the plugin stays
dependency-free) or the `x-opc` format, which would write a private data model into the
user's boards.

Also not claimed: link arrows styled, labelled or routed by the plugin, and matching a
card to a vault note that has no card on the board. The slice links cards that are on the
board and refuses to invent targets.

The next slice, if approved, is presentations: a full-window walkthrough that steps
through a board's root cards one at a time, without patching canvas internals.
