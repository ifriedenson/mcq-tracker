"use strict";
/*
 * Rectangle deep links for PDFs.
 *
 * A page link (`[[file.pdf#page=3]]`) lands the reader at the top of a page. A
 * rectangle deep link adds the selection it came from as fractions of the page,
 * so reopening the link can ring the exact area:
 *
 *   [[file.pdf#page=3&annotation=ann-1&rect=0.12,0.34,0.4,0.08]]
 *
 * Everything here is pure: no Obsidian API, no DOM, no write. The reader decides
 * how to draw a rectangle; this module only validates, builds and parses links.
 */
const { str } = require("./util");

const MAX_PAGE = 100000;
const RECT_PARAM = "rect";

function number(value) {
  const n = typeof value === "number" ? value : Number(str(value));
  return Number.isFinite(n) ? n : null;
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/** A rectangle as page fractions, or null when it is not one. */
function normalizeRect(rect) {
  if (!rect || typeof rect !== "object") return null;
  const x = number(rect.x);
  const y = number(rect.y);
  const width = number(rect.width);
  const height = number(rect.height);
  if (x === null || y === null || width === null || height === null) return null;
  if (!(width > 0) || !(height > 0)) return null;
  if (x < 0 || y < 0 || x + width > 1 + 1e-9 || y + height > 1 + 1e-9) return null;
  return { x: round6(x), y: round6(y), width: round6(width), height: round6(height) };
}

/**
 * The smallest rectangle covering every area, so a multi-line selection gets one
 * ring instead of one link per line. Invalid areas are ignored; none left is null.
 */
function unionRect(areas) {
  const rects = (Array.isArray(areas) ? areas : []).map(normalizeRect).filter(Boolean);
  if (!rects.length) return null;
  let x1 = 1;
  let y1 = 1;
  let x2 = 0;
  let y2 = 0;
  for (const rect of rects) {
    x1 = Math.min(x1, rect.x);
    y1 = Math.min(y1, rect.y);
    x2 = Math.max(x2, rect.x + rect.width);
    y2 = Math.max(y2, rect.y + rect.height);
  }
  return normalizeRect({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
}

/** `[[file.pdf#page=3&annotation=id&rect=x,y,w,h]]`, or "" when unusable. */
function formatPdfDeepLink(pdfPath, page, options) {
  const clean = str(pdfPath).trim().replace(/^\/+/, "");
  const target = Math.round(Number(page));
  if (!clean || !/\.pdf$/i.test(clean)) return "";
  if (!Number.isFinite(target) || target < 1 || target > MAX_PAGE) return "";
  const safePath = clean.replace(/[|#[\]\r\n]/g, "").trim();
  if (!safePath) return "";
  const opts = options && typeof options === "object" ? options : {};
  const parts = [`page=${target}`];
  const anchor = str(opts.annotation).trim();
  if (anchor) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(anchor)) return "";
    parts.push(`annotation=${anchor}`);
  }
  const rect = normalizeRect(opts.rect);
  if (rect) parts.push(`${RECT_PARAM}=${rect.x},${rect.y},${rect.width},${rect.height}`);
  return `[[${safePath}#${parts.join("&")}]]`;
}

const EMPTY = Object.freeze({ path: "", page: 0, annotation: "", rect: null, valid: false });

/** Read a link back into its parts; `valid` is false for anything unusable. */
function parsePdfDeepLink(link) {
  const text = str(link).trim();
  const match = /^\[\[([^\][|#]+)(?:#([^\][|]*))?(?:\|[^\]]*)?\]\]$/.exec(text);
  if (!match) return { ...EMPTY };
  const path = match[1].trim();
  if (!/\.pdf$/i.test(path)) return { ...EMPTY };
  const params = new Map();
  for (const part of str(match[2]).split("&")) {
    const split = part.indexOf("=");
    if (split < 1) continue;
    params.set(part.slice(0, split).trim().toLowerCase(), part.slice(split + 1).trim());
  }
  const page = Math.round(Number(params.get("page")));
  if (!Number.isFinite(page) || page < 1 || page > MAX_PAGE) return { ...EMPTY };
  const anchor = params.get("annotation") || "";
  const annotation = /^[A-Za-z0-9_-]{1,64}$/.test(anchor) ? anchor : "";
  const raw = str(params.get(RECT_PARAM)).split(",");
  const rect =
    raw.length === 4 ? normalizeRect({ x: raw[0], y: raw[1], width: raw[2], height: raw[3] }) : null;
  return { path, page, annotation, rect, valid: true };
}

/** A sentence a reader or sidebar can show for a parsed link. */
function describePdfDeepLink(parsed) {
  const link = parsed && parsed.valid ? parsed : parsePdfDeepLink(parsed);
  if (!link.valid) return "That is not a PDF deep link.";
  const name = link.path.split("/").pop();
  const area = link.rect
    ? `, selection ${Math.round(link.rect.width * 100)}% × ${Math.round(link.rect.height * 100)}% at ${Math.round(link.rect.x * 100)}%, ${Math.round(link.rect.y * 100)}%`
    : "";
  const anchor = link.annotation ? `, annotation ${link.annotation}` : "";
  return `${name} page ${link.page}${anchor}${area}`;
}

module.exports = {
  MAX_PAGE,
  describePdfDeepLink,
  formatPdfDeepLink,
  normalizeRect,
  parsePdfDeepLink,
  unionRect,
};
