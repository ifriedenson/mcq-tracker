# Canvas mind maps: walking and auto-layout (absorbed capability)

Source considered: [Overpowered Canvas](https://github.com/kfirgumay2005-hash/Overpowered-Canvas) (MIT, © 2026 kfirg), version 0.17.0.

This is the **second clean-room slice**. No source file from that project was copied and
no dependency was added: `src/canvas-map.js` works on the same plain JSON Canvas 1.0
board that `src/canvas-markdown.js` already validates. In particular nothing from
`elkjs` (EPL-2.0), `monkey-around`, `perfect-freehand` or the `x-opc` in-canvas format
is used, and no Obsidian Canvas internal is patched.

## What the board resolves to

- **One tree.** Every card gets at most one parent, taken from the first edge that
  reaches it, so a loop is cut instead of followed and a walk can never hang. The walk
  also stops at a repeat and at a branch deeper than 40 cards.
- **One root.** The only root card when the board has exactly one; otherwise the
  top-most root card; and when the board is one closed loop (no root at all) the
  top-most card.
- **Siblings in board order** — top to bottom, then left to right, then by id, so the
  same board always resolves the same way.
- **Unreachable cards**, such as a second page or a loose loop, are kept aside rather
  than dropped.

## What is absorbed

- **Mind-map walking.** From the open board, go to the parent, the first child, the next
  sibling or the previous sibling. The cursor is remembered per board for the session,
  the first press focuses the root card, and an edge of the tree refuses with a message
  naming the card rather than wrapping around.
- **Tree auto-layout.** **Canvas: arrange the active board as a mind map** places the
  tree left to right, leaves in rows and each parent centred on its children, spaced by
  the widest card in each column and pushed apart so no two cards overlap. Unreachable
  cards get their own column to the right. Only `x` and `y` are written: card size,
  colour, group membership, edges and unknown fields survive. A board that is already
  arranged is reported and not rewritten, and running the layout twice gives identical
  coordinates whatever order the cards appear in the file.
- **Commands:** `Canvas: mind map, go to the parent card`, `…the first child card`,
  `…the next sibling card`, `…the previous sibling card` and
  `Canvas: arrange the active board as a mind map`. Malformed, empty and
  more-than-2000-card boards are refused before anything is written.

## Reveal, honestly

Obsidian has no public command for "focus this card on a canvas". The walk therefore
always announces the card by name. If the open canvas view already exposes its own
node map and zoom, that is used (feature-detected, in a `try`, never patched) to select
and zoom to the card; when it is not available the walk still works and the notice
still names the card.

## What is not absorbed, and why

Still not implemented: drawing and ink, the column view, ELK loop and orthogonal
layouts, smart groups, kanban two-way sync, query groups, auto-link, presentations,
portals, minimap, frames, LOD rendering, RTL and localisation, tutorials, and the
`x-opc` in-canvas data format. Those need either the EPL-2.0 layout engine with a
TypeScript build (declined: the plugin stays dependency-free) or the `x-opc` format,
which would mean writing a private data model into the user's boards.

The kanban column slice is in [canvas-kanban.md](canvas-kanban.md), on the same pure
model and with the same no-dependency rule. The next slice, if approved, is auto-link:
one command that links a card to the vault note its text names, refusing to write an
edge to a missing file.
