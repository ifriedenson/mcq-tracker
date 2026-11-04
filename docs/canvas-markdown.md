# Canvas ⇄ Markdown (absorbed capability)

Source considered: [Overpowered Canvas](https://github.com/kfirgumay2005-hash/Overpowered-Canvas) (MIT, © 2026 kfirg), version 0.17.0.

This is a **clean-room** slice. No source file from that project was copied, and no
dependency was added. `src/canvas-markdown.js` only reads and writes JSON Canvas 1.0
with plain JavaScript.

## What is absorbed

- **Canvas → Markdown outline.** Every root card is a page and becomes a heading; its
  branches become nested bullets in board order (top-to-bottom, then left-to-right);
  extra card lines and file embeds are kept. Cycles are broken, never looped.
- **Markdown outline → Canvas.** Headings and bullets become text cards with edges and
  a left-to-right, top-to-bottom layout that keeps sibling order.
- **Commands:** `Canvas: export the active canvas to a Markdown outline` and
  `Canvas: build a board from the active note outline`. Output paths never overwrite an
  existing file.

The second slice — mind-map walking and tree auto-layout — is in
[canvas-mind-map.md](canvas-mind-map.md).

## What is not absorbed, and why

Not yet implemented: drawing and ink, the mind-map column view, ELK loop and orthogonal
layouts, smart groups, kanban two-way sync, query groups, auto-link, presentations,
portals, minimap, frames, LOD rendering, RTL and localisation, tutorials, and the
`x-opc` in-canvas data format. Those need either the EPL-2.0 layout engine and a
TypeScript build (declined: the plugin stays dependency-free) or the `x-opc` format,
which would write a private data model into the user's boards.

The kanban column slice is in [canvas-kanban.md](canvas-kanban.md); the next slice, if
approved, is auto-link on the same pure model.
