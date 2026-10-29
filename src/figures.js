"use strict";
/*
 * Imported PDF figures are written as text markers:
 *
 *   [FIGURE page 3: ![[Bank/images/fig.png]] (the whole page: ![[Bank/images/page-3.png]])]
 *
 * The marker is useful to the importer, but it is not what Obsidian should show.
 * This module turns it into the cropped image embed, with the whole page only as
 * a fallback. It never fetches or copies an image; it only rewrites the link.
 */
const { str } = require("./util");

const FIGURE_MARKER_RE =
  /\[FIGURE\s+page\s+\d+\s*:\s*(!\[\[[^\]]+\]\])(?:\s*\(the whole page:\s*(!\[\[[^\]]+\]\])\s*\))?\s*\]/gi;

/** Replace PDF figure markers with the embed the note should display. */
function normalizeFigureMarkers(markdown) {
  return str(markdown).replace(FIGURE_MARKER_RE, (_match, cropped, wholePage) => cropped || wholePage || "");
}

/** Every embedded image path in a Markdown string, in order, with duplicates removed. */
function figureEmbeds(markdown) {
  const text = normalizeFigureMarkers(markdown);
  const out = [];
  const seen = new Set();
  for (const match of text.matchAll(/!\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    const path = str(match[1]).trim();
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out;
}

module.exports = {
  FIGURE_MARKER_RE,
  figureEmbeds,
  normalizeFigureMarkers,
};
