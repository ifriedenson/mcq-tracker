# Canvas presentations (absorbed capability)

Source considered: [Overpowered Canvas](https://github.com/kfirgumay2005-hash/Overpowered-Canvas) (MIT, © 2026 kfirg), version 0.17.0.

This is the **fifth clean-room slice**. No source file from that project was copied and
no dependency was added: `src/canvas-presentations.js` derives a deck with plain geometry
and adjacency over the JSON Canvas 1.0 model that `src/canvas-markdown.js` validates, and
`src/canvas-presentations-view.js` draws it with Obsidian's own `Modal`. No `elkjs`
(EPL-2.0), `monkey-around`, `perfect-freehand`, `x-opc` format or patched canvas internal
is involved, and presenting never writes the board.

## How a board becomes a deck

Steps are derived one of three documented ways, in this order.

1. **Group frames are the slides.** One slide per frame, ordered by left edge, then top
   edge, then id, so the same board always presents in the same order. The frame's
   `label` is the slide title, falling back to `Slide 1`, `Slide 2` … A card is on that
   slide when the frame contains its centre, in board order. A card outside every frame
   is not on a slide and is reported.
2. **A board without frames** presents one **root card** per slide — a card no edge
   points at — in board order (top to bottom, then left to right, then id). The slide
   holds the root first and then the cards it links to *directly*, so one board of
   branches reads top-down. A card two or more hops from every root is not on a slide and
   is reported, never guessed onto one.
3. **A board that is one closed loop** has no root, so every card becomes its own slide
   in board order; the deck still presents instead of failing.

## What a slide contains

| Part | Rule |
| --- | --- |
| title | the frame `label`, else the card's own name (first text line, file basename, link label or address), clipped to 80 characters |
| members | the cards on the slide, in board order, at most 24; the count beyond that is shown instead of hiding the overflow |
| body | the leading card's whole text, or a file card's path or a link card's address, capped at 1,200 characters with an ellipsis |
| links out | edges that leave the slide for a card elsewhere in the deck, deduplicated, sorted by label, at most 12 |

Fixed limits: **60 slides**, **24 cards per slide**, **12 links per slide**, **1,200
characters of body**, **80 characters of title**. Reaching one is reported by name.

Nothing here reads vault contents, resolves wikilinks inside card text, follows channels
of edges deeper than one hop, or writes anything. Cards that are frames are never slide
members, only slide containers.

## What is absorbed

- **Walkthrough.** `Canvas: present the active board` opens a full-window, read-only deck
  with **Previous**, **Next** and **Exit** (plus arrow keys and Escape when Obsidian gives
  the window a key scope). Navigation clamps: the first Previous and the last Next keep
  the current slide, and the buttons are disabled at the ends. Each step is announced as
  `Slide 2 of 5: Title`, the way the mind-map walk announces a card.
- **Plan report.** `Canvas: report the active board's presentation plan` lists every step
  with its number, title, kind (`frame`, `root` or `card`), member cards, body and links
  out, then the cards that are not on a slide and any limit that was hit, so the
  derivation is inspectable without rendering it.
- **Deterministic and pure.** Everything is sorted with the tie-breaks above and nothing
  is random, so reordering the nodes in the file changes nothing, deriving twice returns
  an identical plan, and the board object is read but never mutated.
- **Refusals** before any window opens: empty or damaged JSON, an unknown node type, and
  more than 2,000 cards. No refusal opens half a deck.

## What is not absorbed, and why

Still not implemented: drawing and ink, the column view, ELK loop and orthogonal layouts,
smart groups, query groups, portals, minimap, frames beyond slide containers, LOD
rendering, RTL and localisation, tutorials, and the `x-opc` in-canvas data format. The
layout engine needs the EPL-2.0 dependency with a TypeScript build (declined: the plugin
stays dependency-free) and `x-opc` would write a private data model into the user's
boards.

Also not claimed: presenter notes, slide transitions, a timer, PDF or image export of the
deck, and zooming the canvas to each slide. Those need either a second rendering pipeline
or the canvas view's own internals, so this slice draws its own read-only window from the
validated model instead.

The query-groups slice is in [canvas-query-groups.md](canvas-query-groups.md),
on the same pure model. The next slice, if approved, is portals: a card that stands for
a target card or note on the same board, resolved on the pure model and offered rather
than written into the canvas internals.
