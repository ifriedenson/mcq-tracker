"use strict";
/*
 * Read-only index of the PDF annotation sidecars this plugin already writes.
 * This is the acceptance-policy-free part of Pick Me's annotation index (MIT):
 * it lists what is in the vault and links back to the PDF or its sidecar. It
 * never creates, edits or deletes an annotation and never opens the PDF.
 */
const { str } = require("./util");
const { annotationSummary, parseAnnotationFile, pdfPathFromSidecar } = require("./pdf-annotations");

const MAX_FILES = 1000;
const MAX_ROWS = 2000;
const MAX_PAGE = 100000;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function enabledValue(value) {
  if (value === false) return false;
  if (value && typeof value === "object" && value.enabled === false) return false;
  return true;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function normalizePdfAnnotationIndexSettings(value) {
  const source = asObject(value);
  return {
    enabled: enabledValue(value),
    folder: str(source.folder).trim().replace(/^\/+|\/+$/g, "").slice(0, 400),
    limit: clamp(Number.isFinite(Number(source.limit)) ? Number(source.limit) : 200, 1, 500),
  };
}

function sidecarPath(path) {
  return /\.annotations\.md$/i.test(str(path));
}

function inFolder(path, folder) {
  if (!folder) return true;
  return path === folder || path.startsWith(`${folder}/`);
}

/**
 * Turn sidecar notes into one flat, sorted annotation list. `entries` is
 * `[{ path, text }]`; damaged blocks are reported in `issues` instead of
 * throwing, so one bad file cannot hide the rest of the index.
 */
function collectPdfAnnotations(entries, options) {
  const settings = normalizePdfAnnotationIndexSettings(options);
  const rows = [];
  const issues = [];
  let files = 0;
  let scanned = 0;
  const pdfs = new Set();
  const byType = {};
  const byColor = {};
  for (const entry of Array.isArray(entries) ? entries : []) {
    const path = str(entry && entry.path).trim();
    const text = str(entry && entry.text);
    if (!path || !text || !sidecarPath(path) || !inFolder(path, settings.folder)) continue;
    scanned += 1;
    if (scanned > MAX_FILES) break;
    let parsed;
    try {
      parsed = parseAnnotationFile(text);
    } catch (e) {
      issues.push(`${path}: ${e.message}`);
      continue;
    }
    if (!parsed.annotations.length) continue;
    files += 1;
    const pdfPath = str(parsed.pdfPath).trim() || pdfPathFromSidecar(path);
    pdfs.add(pdfPath);
    for (const annotation of parsed.annotations) {
      if (rows.length >= MAX_ROWS) break;
      rows.push({
        id: annotation.id,
        sidecarPath: path,
        pdfPath,
        page: annotation.page,
        type: annotation.type,
        color: annotation.color,
        quote: annotation.quote,
        note: annotation.note,
        text: annotation.text,
        summary: annotationSummary(annotation),
        createdAt: annotation.createdAt,
      });
      byType[annotation.type] = (byType[annotation.type] || 0) + 1;
      byColor[annotation.color] = (byColor[annotation.color] || 0) + 1;
    }
  }
  rows.sort((a, b) => a.pdfPath.localeCompare(b.pdfPath) || a.page - b.page || str(a.createdAt).localeCompare(str(b.createdAt)));
  const limited = rows.slice(0, settings.limit);
  return {
    rows: limited,
    issues,
    stats: {
      files,
      pdfs: pdfs.size,
      annotations: rows.length,
      shown: limited.length,
      pages: new Set(rows.map((row) => `${row.pdfPath}#${row.page}`)).size,
      byType,
      byColor,
    },
  };
}

/**
 * `file.pdf#page=3` for a PDF page, or "" when the path or page is unusable.
 * Only the link text is built; nothing is opened, resolved or written.
 */
function pdfPageSubpath(path, page) {
  const clean = str(path).trim().replace(/^\/+/, "");
  const number = Math.round(Number(page));
  if (!clean || !/\.pdf$/i.test(clean)) return "";
  if (!Number.isFinite(number) || number < 1 || number > MAX_PAGE) return "";
  const safe = clean.replace(/[|#[\]\r\n]/g, "").trim();
  if (!safe) return "";
  return safe + "#page=" + number;
}

/** The copyable `[[file.pdf#page=3]]` wikilink, or "" for an unusable page. */
function pdfPageLink(path, page) {
  const subpath = pdfPageSubpath(path, page);
  return subpath ? "[[" + subpath + "]]" : "";
}

module.exports = {
  MAX_FILES,
  MAX_PAGE,
  MAX_ROWS,
  collectPdfAnnotations,
  normalizePdfAnnotationIndexSettings,
  pdfPageLink,
  pdfPageSubpath,
};
