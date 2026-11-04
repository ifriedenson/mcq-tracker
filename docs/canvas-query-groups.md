# Canvas query groups (absorbed capability)

Source considered: [Overpowered Canvas](https://github.com/kfirgumay2005-hash/Overpowered-Canvas) (MIT, © 2026 kfirg), version 0.17.0.

This is the **sixth clean-room slice**. No source file from that project was copied and
no dependency was added: `src/canvas-query.js` parses a frame label and compares plain
strings over the JSON Canvas 1.0 model `src/canvas-markdown.js` validates, and
`src/canvas-query-view.js` draws the read-only report with Obsidian's own `Modal`. No
`elkjs` (EPL-2.0), `monkey-around`, `perfect-freehand`, `x-opc` format or patched canvas
internal is involved, and no dependency is installed.

## Declaring a query

A **group frame** declares a query in its own `label`. The label starts with `query:`
(case-insensitive, spaces allowed before the colon) and the rest is the query text:

```
query: exam #revision type:text
```

A label that does not start with `query:` is **not a query**, is never an error, and is
left completely alone — the kanban, mind-map and presentation slices still read it as an
ordinary frame. `query:` with nothing after it is a query that names nothing and is
reported as such.

### Supported grammar

| Term | Meaning |
| --- | --- |
| `word` | case-insensitive **substring** of the card's text, its name (first text line, file basename, link label or address), its file path or its address |
| `#tag` | the card's text carries that **whole** tag, so `#exam` never matches `#exams` |
| `type:text`, `type:file`, `type:link`, `type:group` | keep only that node type |

Every term is AND-ed, so `exam type:text` needs both. Two `type:` terms can never both
hold for one node, so a query with two of them matches nothing — that is reported rather
than treated as a mistake. Frames are not candidates unless the query names
`type:group`: a query group never contains itself or another query group, which keeps
resolution from feeding back on itself.

### What is not supported, and why

Anything outside that table is **reported as unsupported and the whole query is left
unresolved** rather than silently half-read: `key:value` operators other than `type:`
(`path:`, `file:`, `line:`, `section:`, `block:`, `tag:`), `-negation`, `+required`,
quoted phrases, `/regular expressions/`, `OR`, parentheses and pipes. Those need the
host's search index (Obsidian's own query engine) or a full expression parser, and this
slice reads only what a bare JSON Canvas file can answer deterministically.

## Resolution rules

- **Order.** Query frames are read in board order (top to bottom, then left to right,
  then id); a group's matches are ordered the same way. Nothing depends on the order of
  the nodes in the file.
- **Determinism.** Matching, ordering and geometry use only the board, so resolving
  twice returns an identical result and shuffling the file changes nothing.
- **Strays.** A card whose centre sits inside a query frame without matching the query is
  reported as a **stray**. It is never absorbed into the group and never moved.

## Named limits

| Limit | Value |
| --- | --- |
| query groups | 24 |
| terms per query | 12 |
| query text | 200 characters |
| matches per query | 120 |
| stray cards listed per group | 12 (all are counted) |
| span a frame may be fitted to | 20,000 px per axis |

Every drop, cut or skip is counted in `stats` and named in the summary. The board-wide
limit of 2,000 cards comes from `parseCanvas` and refuses the whole board instead of
clamping.

## What is absorbed

- **Report.** `Canvas: report the active board's query groups` opens a read-only window
  showing each query frame, its terms, its matches, the strays inside it, the frame
  geometry it would get and any unsupported term, over-limit drop or unfittable query,
  and announces the same summary as a notice. Nothing is written.
- **Fit.** `Canvas: fit the active board's query groups around their matches` rewrites
  **only** each query frame's `x`, `y`, `width` and `height`, fitted with 16 px of padding
  around the bounding box of its matches. No card is moved, resized or removed, no edge
  or label is touched, and unknown fields survive. A group with no matches, an
  unsupported query or matches more than 20,000 px apart is left exactly as it is and
  reported.
- **Idempotent.** Because the fit depends only on the matches, a second run changes
  nothing, writes nothing and says so.
- **Refusals**, each announced with its own message and no partial write: no active
  canvas, malformed JSON, an unknown node type, an oversized board, a board with no query
  group, and a board where no group could be fitted.

## What is not absorbed, and why

The upstream plugin's dynamic groups are driven by its own query layer, which can use the
host's search index, nested boolean expressions and link/backlink conditions; a second
upstream mode rewrites card positions as a live column. Neither is absorbed:

- **Search-index operators and boolean grammar** — they need the host's index and a
  parser, so the subset in the table above is the honest part a board file can answer.
- **Live recomputation while the canvas is open** — it needs the canvas view's own
  internals (an Obsidian-internal surface this plugin does not patch), so the query is
  recomputed when the command runs.
- **Two-way membership** — membership is geometric, so the slice fits the frame around
  its matches instead of moving cards into it; a stray card that overlaps a fitted frame
  is reported, never relocated or deleted.
- **Column behaviour** — re-stacking columns and dragging cards between frames belong to
  the kanban slice and the canvas view, not here.

Also not claimed: saving a query outside a frame label, query history, per-query colours,
or filling a query frame with *vault notes* that have no card on the board.

The presentations slice is in [canvas-presentations.md](canvas-presentations.md), on the
same pure model. The next slice, if approved, is **portals**: a card that stands for a
target card or note on the same board, resolved on the pure model, with the jump offered
rather than written into the canvas internals.
