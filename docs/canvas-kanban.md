# Canvas kanban columns (absorbed capability)

Source considered: [Overpowered Canvas](https://github.com/kfirgumay2005-hash/Overpowered-Canvas) (MIT, © 2026 kfirg), version 0.17.0.

This is the **third clean-room slice**. No source file from that project was copied and
no dependency was added: `src/canvas-kanban.js` reads columns out of the board's own
geometry, on the same JSON Canvas 1.0 model that `src/canvas-markdown.js` validates. No
`elkjs` (EPL-2.0), `monkey-around`, `perfect-freehand` or `x-opc` format is involved, and
no Obsidian Canvas internal is touched.

## How a board becomes columns

- **Group frames are the columns** when the board has any, ordered by left edge, then
  top edge, then id, so the same board always reads the same way. A frame's `label` is
  the column title, falling back to `Column 1`, `Column 2` …
- **A board without frames** is read as its vertical stacks: cards are sorted by left
  edge, and a card whose left edge is within 80 px of the column's own left edge joins
  that column. Columns are ordered by that left edge and titled `Column 1`, `Column 2` …
- **Assignment is geometric.** A card belongs to the frame that contains its centre.
  Order inside a column is vertical — top to bottom, then left to right, then id.
- **Cards outside every frame are unassigned**, reported with their names, never
  guessed at and never silently dropped.
- **Nothing here follows edges**, so a loop, a card linked to itself or an edge pointing
  at a missing node cannot change the columns. Unknown node fields are ignored on read
  and preserved on write.

## What is absorbed

- **Column report.** `Canvas: report the active board's kanban columns` opens a
  read-only window listing every column with its cards in order, then the unassigned
  cards, and announces the same summary as a notice.
- **Re-stack.** `Canvas: re-stack the active board's kanban columns` puts every column
  at the same top, `80 px` apart, each as wide as its widest card (at least 300 px), with
  cards stacked in their in-column order `24 px` apart. A group frame is moved and sized
  to fit its column with 16 px of padding. Unassigned cards are parked in one stack to
  the right, clear of every frame. Card sizes, edges and unknown fields are untouched;
  the board is announced, and an already stacked board is reported and not rewritten.
- **Deterministic and idempotent.** Fixed spacing, fixed tie-breaks, and a second run
  produces `changed: false` with identical coordinates. Reordering the nodes in the file
  does not change the result.
- **Refusals** before any write: empty or damaged JSON, an unknown node type, a
  frame-only board (nothing to arrange), and more than 2,000 cards.

## What is not absorbed, and why

Still not implemented: drawing and ink, the column view, ELK loop and orthogonal layouts,
smart groups, query groups, auto-link, presentations, portals, minimap, frames, LOD
rendering, RTL and localisation, tutorials, and the `x-opc` in-canvas data format. The
layout engine needs the EPL-2.0 dependency and a TypeScript build (declined: the plugin
stays dependency-free), and `x-opc` would mean writing a private data model into the
user's boards.

Also not claimed: dragging a card from one column to another inside the canvas. That
needs the canvas view's own drag handling (an Obsidian-internal surface), so the current
slice reads and re-stacks columns instead.

The auto-link slice is in [canvas-auto-link.md](canvas-auto-link.md), on the same pure
model. The next slice, if approved, is presentations: a full-window walkthrough that
steps through a board's root cards without patching canvas internals.
