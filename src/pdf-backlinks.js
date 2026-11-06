"use strict";
/*
 * PDF++-style backlink highlights.
 *
 * A Markdown wiki link is the annotation:
 *
 *   [[Papers/Exam.pdf#page=3&selection=12,0,13,18&color=green]]
 *
 * The reader scans notes for links to the open PDF and paints the selected
 * area, so annotations stay readable Markdown and can live in any note. This
 * module is pure: it parses links, maps PDF++ text ranges to page rectangles,
 * and returns rows for the reader. The sidecar annotator remains a separate,
 * durable model for ink, quotes, notes and marks.
 */
const {
  formatPdfDeepLink,
  normalizeColor,
  normalizeRect,
  normalizeSelection,
  parsePdfDeepLink,
} = require("./pdf-deep-link");
const { normalizeHighlightArea } = require("./pdf-ink");

const MAX_BACKLINKS = 2000;
const MAX_SELECTION_AREAS = 100;

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanPath(value) {
  return str(value).replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+/g, "/").trim();
}

function basename(path) {
  return cleanPath(path).split("/").pop() || "";
}

function dirname(path) {
  const clean = cleanPath(path);
  return clean.includes("/") ? clean.replace(/\/[^/]*$/, "") : "";
}

/** Resolve a wiki-link target against the note that contains it. */
function resolveLinkPath(linkPath, sourcePath) {
  const link = cleanPath(linkPath);
  if (!link) return "";
  if (link.startsWith("/")) return link.replace(/^\/+/, "");
  const base = dirname(sourcePath);
  if (!base) return link;
  const parts = [];
  for (const part of `${base}/${link}`.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function samePath(a, b) {
  return cleanPath(a).toLowerCase() === cleanPath(b).toLowerCase();
}

/** True when a link points at this PDF, including a bare filename link. */
function matchesPdf(linkPath, pdfPath, sourcePath) {
  const link = cleanPath(linkPath);
  const pdf = cleanPath(pdfPath);
  if (!link || !pdf || !/\.pdf$/i.test(link) || !/\.pdf$/i.test(pdf)) return false;
  if (samePath(link, pdf) || samePath(resolveLinkPath(link, sourcePath), pdf)) return true;
  return !link.includes("/") && basename(link).toLowerCase() === basename(pdf).toLowerCase();
}

/** The exact text range in a PDF++ link, as four non-negative integers. */
function selectionParts(value) {
  const selection = normalizeSelection(value);
  if (!selection) return null;
  const parts = selection.split(",").map(Number);
  return { beginIndex: parts[0], beginOffset: parts[1], endIndex: parts[2], endOffset: parts[3], text: selection };
}

function itemIndex(item, fallback) {
  const index = Number(item && item.i);
  return Number.isInteger(index) && index >= 0 ? index : fallback;
}

function itemText(item) {
  return str(item && (item.s === undefined ? item.text : item.s));
}

function itemGeometry(item) {
  const x = Number(item && item.x);
  const y = Number(item && item.y);
  const width = Number(item && item.w);
  const height = Number(item && item.h);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

/**
 * Maps a PDF++ text range to one highlight rectangle per selected text item.
 * `items` are the normalized items returned by `readPdfPageText`, whose `i` is
 * the original pdf.js content-item index and whose `s` is the item's text.
 */
function selectionAreas(items, selection, options) {
  const parts = selectionParts(selection);
  if (!parts) return [];
  const opts = options && typeof options === "object" ? options : {};
  const color = normalizeColor(opts.color) || "yellow";
  const source = (Array.isArray(items) ? items : []).slice().sort((a, b) => {
    const ay = Number(a && a.y) || 0;
    const by = Number(b && b.y) || 0;
    return ay - by || (Number(a && a.x) || 0) - (Number(b && b.x) || 0) || itemIndex(a, 0) - itemIndex(b, 0);
  });
  const out = [];
  for (let fallback = 0; fallback < source.length; fallback++) {
    const item = source[fallback];
    const index = itemIndex(item, fallback);
    if (index < parts.beginIndex || index > parts.endIndex) continue;
    const text = itemText(item);
    const geometry = itemGeometry(item);
    if (!text || !geometry) continue;
    const length = text.length;
    if (!length) continue;
    let start = 0;
    let end = length;
    if (index === parts.beginIndex) start = parts.beginOffset;
    if (index === parts.endIndex) end = parts.endOffset;
    start = Math.round(clamp(start, 0, length));
    end = Math.round(clamp(end, 0, length));
    if (end <= start) continue;
    const area = normalizeHighlightArea({
      x: geometry.x + geometry.width * (start / length),
      y: geometry.y,
      width: geometry.width * ((end - start) / length),
      height: geometry.height,
      color,
      style: "highlight",
    });
    if (!area) continue;
    out.push({ ...area, style: "backlink" });
    if (out.length >= MAX_SELECTION_AREAS) break;
  }
  return out;
}

/**
 * Turns a dragged rectangle into a PDF++ selection plus the text under it.
 * Partial first/last items are included by character offset, so a link can
 * point at part of a line instead of always expanding to whole text runs.
 */
function selectionFromArea(items, rect) {
  const area = normalizeRect(rect);
  if (!area) return { quote: "", selection: "", areas: [] };
  const source = Array.isArray(items) ? items : [];
  const picked = [];
  for (let fallback = 0; fallback < source.length; fallback++) {
    const item = source[fallback];
    const geometry = itemGeometry(item);
    const text = itemText(item);
    if (!geometry || !text) continue;
    const overlapX = Math.min(geometry.x + geometry.width, area.x + area.width) - Math.max(geometry.x, area.x);
    const overlapY = Math.min(geometry.y + geometry.height, area.y + area.height) - Math.max(geometry.y, area.y);
    const overlap = Math.max(0, overlapX) * Math.max(0, overlapY);
    const inside =
      geometry.x + geometry.width / 2 >= area.x &&
      geometry.x + geometry.width / 2 <= area.x + area.width &&
      geometry.y + geometry.height / 2 >= area.y &&
      geometry.y + geometry.height / 2 <= area.y + area.height;
    if (inside || overlap >= 0.5 * Math.max(geometry.width * geometry.height, 0.000001)) {
      picked.push({ ...geometry, text, index: itemIndex(item, fallback) });
    }
  }
  if (!picked.length) return { quote: "", selection: "", areas: [] };
  picked.sort((a, b) => a.y - b.y || a.x - b.x || a.index - b.index);
  const first = picked[0];
  const last = picked[picked.length - 1];
  const offsetAt = (item, edge, round) => {
    const value = clamp((edge - item.x) / item.width, 0, 1) * item.text.length;
    return clamp(round === "ceil" ? Math.ceil(value) : Math.floor(value), 0, item.text.length);
  };
  const beginOffset = offsetAt(first, area.x, "floor");
  const endOffset = offsetAt(last, area.x + area.width, "ceil");
  const selection = normalizeSelection(`${first.index},${beginOffset},${last.index},${endOffset}`);
  if (!selection) return { quote: "", selection: "", areas: [] };
  const quote = picked
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    quote,
    selection,
    areas: selectionAreas(source, selection),
    beginIndex: first.index,
    beginOffset,
    endIndex: last.index,
    endOffset,
  };
}

/** Highlight areas for one backlink row, using its rectangle or text range. */
function backlinkAreasFor(row, items) {
  if (!row) return [];
  const color = normalizeColor(row.color) || "yellow";
  const rect = normalizeRect(row.rect);
  if (rect) {
    const area = normalizeHighlightArea({ ...rect, color, style: "highlight" });
    return area ? [{ ...area, style: "backlink", backlink: row }] : [];
  }
  return selectionAreas(items, row.selection, { color }).map((area) => ({ ...area, backlink: row }));
}

/**
 * Every PDF++-style link to `pdfPath` in the supplied notes. A note is
 * `{ path, text }`; source, line, colour, page and the link itself are kept so
 * the reader can paint and open the note again.
 */
function collectPdfBacklinks(notes, pdfPath) {
  const pdf = cleanPath(pdfPath);
  if (!pdf || !/\.pdf$/i.test(pdf)) return [];
  const rows = [];
  const seen = new Set();
  for (const note of Array.isArray(notes) ? notes : []) {
    if (!note || !note.path) continue;
    const sourcePath = cleanPath(note.path);
    if (!sourcePath || samePath(sourcePath, pdf) || /\.annotations\.md$/i.test(sourcePath)) continue;
    const text = str(note.text);
    const pattern = /!?\[\[([^\[\]]+)\]\]/g;
    let match;
    while ((match = pattern.exec(text))) {
      const inner = match[1];
      const link = `[[${inner}]]`;
      const parsed = parsePdfDeepLink(link);
      if (!parsed.valid || !matchesPdf(parsed.path, pdf, sourcePath)) continue;
      const line = 1 + (text.slice(0, match.index).match(/\n/g) || []).length;
      const key = `${sourcePath}\u0000${line}\u0000${link}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const display = inner.includes("|") ? inner.slice(inner.indexOf("|") + 1).trim() : "";
      rows.push({
        id: `bl-${rows.length + 1}-${parsed.page}-${line}`,
        sourcePath,
        line,
        page: parsed.page,
        color: normalizeColor(parsed.color) || "yellow",
        rect: parsed.rect,
        selection: parsed.selection,
        link,
        display,
        quote: display,
      });
      if (rows.length >= MAX_BACKLINKS) return rows.sort(byPosition);
    }
  }
  return rows.sort(byPosition);
}

function byPosition(a, b) {
  return a.page - b.page || a.sourcePath.localeCompare(b.sourcePath) || a.line - b.line;
}

/** A PDF++-style link for a selection, used by the reader's copy action. */
function formatSelectionLink(pdfPath, page, options) {
  return formatPdfDeepLink(pdfPath, page, options);
}

/** A short row label for status messages and future sidebar reuse. */
function backlinkSummary(row) {
  if (!row) return "";
  const source = str(row.sourcePath).split("/").pop() || "note";
  return `${source}${row.line ? `:${row.line}` : ""} → page ${row.page}`;
}

module.exports = {
  MAX_BACKLINKS,
  MAX_SELECTION_AREAS,
  backlinkAreasFor,
  backlinkSummary,
  collectPdfBacklinks,
  formatSelectionLink,
  matchesPdf,
  resolveLinkPath,
  selectionAreas,
  selectionFromArea,
  selectionParts,
};
