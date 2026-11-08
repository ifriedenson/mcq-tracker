"use strict";
/*
 * Durable PDF annotations without a PDF renderer.
 *
 * Each PDF gets a Markdown sidecar beside it (`name.annotations.md`). The
 * machine-readable block is fenced so the rest of the note stays readable and
 * hand-editable. The PDF's content hash is stored with the annotations, so a
 * replaced or re-downloaded file can be detected instead of silently attaching
 * old notes to a different document.
 */

const { str } = require("./util");
const { normalizeHighlightAreas, normalizeInkStrokes, normalizeTextBoxes } = require("./pdf-ink");

const ANNOTATION_BLOCK = "mcq-pdf-annotations";
const ANNOTATION_TYPES = ["highlight", "underline", "strike", "box", "quote", "note", "text", "form", "pen"];
const ANNOTATION_COLORS = ["yellow", "green", "blue", "red", "purple", "gray"];
const MARK_TYPES = ["highlight", "underline", "strike", "box", "quote"];
const MAX_TAGS = 6;
const MAX_TAG_LENGTH = 24;

/** A 64-bit-ish content id: two independent FNV-1a passes over the bytes. */
function hashBytes(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let a = 2166136261;
  let b = 2166136261 ^ 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    a ^= data[i];
    a = Math.imul(a, 16777619);
    b ^= data[i] + ((i & 255) << 8);
    b = Math.imul(b, 16777619) ^ (b >>> 13);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

function sidecarPathFor(pdfPath) {
  const clean = str(pdfPath).replace(/\\/g, "/").replace(/^\/+/, "");
  return /\.pdf$/i.test(clean) ? clean.replace(/\.pdf$/i, ".annotations.md") : `${clean}.annotations.md`;
}

function pdfPathFromSidecar(sidecarPath) {
  return str(sidecarPath).replace(/\.annotations\.md$/i, ".pdf");
}

/** Bounded, hash-free, case-insensitively unique tags, the same shape study tasks use. */
function normalizeTags(value) {
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const tag = str(raw).replace(/^#+/, "").replace(/\s+/g, "-").slice(0, MAX_TAG_LENGTH);
    if (!tag) continue;
    if (out.some((existing) => existing.toLowerCase() === tag.toLowerCase())) continue;
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function newAnnotationId() {
  return `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeAnnotation(input) {
  const src = input && typeof input === "object" ? input : {};
  const page = Math.max(1, Math.round(Number(src.page) || 1));
  const type = ANNOTATION_TYPES.includes(src.type) ? src.type : "note";
  const color = ANNOTATION_COLORS.includes(src.color) ? src.color : "yellow";
  const quote = str(src.quote).trim();
  const note = str(src.note).trim();
  const text = str(src.text).trim();
  const strokes = type === "pen" ? normalizeInkStrokes(src.strokes) : [];
  const boxes = type === "text" ? normalizeTextBoxes(src.boxes) : [];
  const areas = MARK_TYPES.includes(type) ? normalizeHighlightAreas(src.areas) : [];
  const tags = normalizeTags(src.tags);
  if (!quote && !note && !text && !strokes.length && !boxes.length && !areas.length) throw new Error("Add a quote, note or text, or draw some ink, for the annotation.");
  const out = {
    id: str(src.id).trim() || newAnnotationId(),
    page,
    type,
    color,
    quote,
    note,
    text,
    tags,
    createdAt: str(src.createdAt).trim() || new Date().toISOString(),
    updatedAt: str(src.updatedAt).trim() || "",
  };
  if (type === "pen") out.strokes = strokes;
  if (type === "text" && boxes.length) out.boxes = boxes;
  if (areas.length) out.areas = type !== "quote" && MARK_TYPES.includes(type) ? areas.map((area) => ({ ...area, style: type })) : areas;
  return out;
}

function sortAnnotations(list) {
  return list.slice().sort((a, b) => a.page - b.page || str(a.createdAt).localeCompare(str(b.createdAt)));
}

function parseAnnotationFile(text) {
  const source = str(text);
  const match = source.match(new RegExp("```" + ANNOTATION_BLOCK + "\\s*\\n([\\s\\S]*?)\\n```", "m"));
  if (!match) return { pdfPath: "", pdfHash: "", annotations: [] };
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch (e) {
    throw new Error(`The annotation block is damaged: ${e.message}`);
  }
  const annotations = Array.isArray(data.annotations)
    ? data.annotations.map((item) => normalizeAnnotation(item))
    : [];
  return { pdfPath: str(data.pdf_path), pdfHash: str(data.pdf_hash), annotations: sortAnnotations(annotations) };
}

function annotationSummary(annotation) {
  const bits = [];
  if (annotation.quote) bits.push(`"${annotation.quote.replace(/\s+/g, " ").slice(0, 160)}"`);
  if (annotation.text) bits.push(annotation.text.replace(/\s+/g, " ").slice(0, 160));
  if (annotation.note) bits.push(annotation.note.replace(/\s+/g, " ").slice(0, 200));
  if (Array.isArray(annotation.strokes) && annotation.strokes.length) {
    bits.push(`${annotation.strokes.length} ink stroke${annotation.strokes.length === 1 ? "" : "s"}`);
  }
  if (Array.isArray(annotation.boxes) && annotation.boxes.length) {
    bits.push(`${annotation.boxes.length} text box${annotation.boxes.length === 1 ? "" : "es"}`);
  }
  if (Array.isArray(annotation.areas) && annotation.areas.length) {
    const noun = { highlight: "highlighted area", quote: "selected line", underline: "underlined area", strike: "strike-through area", box: "boxed area" }[annotation.type] || "marked area";
    bits.push(`${annotation.areas.length} ${noun}${annotation.areas.length === 1 ? "" : "s"}`);
  }
  if (Array.isArray(annotation.tags) && annotation.tags.length) {
    bits.push(annotation.tags.map((tag) => `#${tag}`).join(" "));
  }
  return bits.join(" - ") || "(no text)";
}

function serializeAnnotationFile(pdfPath, pdfHash, annotations) {
  const list = sortAnnotations((annotations || []).map(normalizeAnnotation));
  const json = JSON.stringify({ version: 1, pdf_path: str(pdfPath), pdf_hash: str(pdfHash), annotations: list }, null, 2);
  const lines = [
    "---",
    "pdf_annotations: true",
    `pdf_path: ${JSON.stringify(str(pdfPath))}`,
    `pdf_hash: ${JSON.stringify(str(pdfHash))}`,
    "---",
    "",
    `# PDF annotations — ${str(pdfPath).replace(/^.*\//, "")}`,
    "",
    `Source: [[${str(pdfPath)}]]`,
    "",
    "This note is the annotation sidecar for the PDF. The block below is machine-readable; the summary above it is for reading.",
    "",
    "## Summary",
    "",
  ];
  if (!list.length) lines.push("_No annotations yet._", "");
  for (const annotation of list) {
    lines.push(`- **Page ${annotation.page}** (${annotation.type}, ${annotation.color}): ${annotationSummary(annotation)}`);
  }
  lines.push("", "## Data", "", "```" + ANNOTATION_BLOCK, json, "```", "");
  return lines.join("\n");
}

function upsertAnnotation(text, annotation, meta) {
  const parsed = parseAnnotationFile(text);
  const next = normalizeAnnotation(annotation);
  const list = parsed.annotations.filter((item) => item.id !== next.id);
  list.push(next);
  const pdfPath = str(meta && meta.pdfPath) || parsed.pdfPath;
  const pdfHash = str(meta && meta.pdfHash) || parsed.pdfHash;
  return { text: serializeAnnotationFile(pdfPath, pdfHash, list), annotations: sortAnnotations(list), pdfPath, pdfHash };
}

function removeAnnotation(text, id, meta) {
  const parsed = parseAnnotationFile(text);
  const annotations = parsed.annotations.filter((item) => item.id !== id);
  const pdfPath = str(meta && meta.pdfPath) || parsed.pdfPath;
  const pdfHash = str(meta && meta.pdfHash) || parsed.pdfHash;
  return { text: serializeAnnotationFile(pdfPath, pdfHash, annotations), annotations, pdfPath, pdfHash };
}

const { formatPdfDeepLink, unionRect } = require("./pdf-deep-link");

/**
 * `[[file.pdf#page=3&annotation=ann-1&rect=…]]`, or "" when the path, page or id
 * is unusable. A rectangle, when one is given, is the selection the annotation
 * was made over, so reopening the link can ring that exact area.
 */
function annotationLink(pdfPath, page, id, rect) {
  return formatPdfDeepLink(pdfPath, page, { annotation: id, rect: rect || null });
}

/**
 * Filters index rows by free text (quote, note, text, PDF path, tags), type,
 * colour, tag and page. Every option is optional; a page of 0 or less is ignored.
 */
function filterAnnotations(rows, options) {
  const opts = options && typeof options === "object" ? options : {};
  const query = str(opts.query).trim().toLowerCase();
  const type = str(opts.type).trim().toLowerCase();
  const color = str(opts.color).trim().toLowerCase();
  const tag = str(opts.tag).trim().replace(/^#+/, "").toLowerCase();
  const page = Math.round(Number(opts.page) || 0);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row) return false;
    if (type && str(row.type).toLowerCase() !== type) return false;
    if (color && str(row.color).toLowerCase() !== color) return false;
    if (page > 0 && Math.round(Number(row.page) || 0) !== page) return false;
    if (tag && !(Array.isArray(row.tags) ? row.tags : []).some((value) => str(value).toLowerCase() === tag)) return false;
    if (!query) return true;
    const haystack = [row.quote, row.note, row.text, row.pdfPath, row.summary, ...(Array.isArray(row.tags) ? row.tags : [])]
      .map((value) => str(value).toLowerCase())
      .join(" ");
    return haystack.includes(query);
  });
}

function annotationCounts(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const byType = {};
  const byColor = {};
  const byTag = {};
  const pages = new Set();
  const pdfs = new Set();
  for (const row of list) {
    if (!row) continue;
    byType[row.type] = (byType[row.type] || 0) + 1;
    byColor[row.color] = (byColor[row.color] || 0) + 1;
    for (const tag of Array.isArray(row.tags) ? row.tags : []) byTag[tag] = (byTag[tag] || 0) + 1;
    pages.add(`${row.pdfPath || ""}#${row.page}`);
    if (row.pdfPath) pdfs.add(row.pdfPath);
  }
  return { total: list.length, byType, byColor, byTag, pages: pages.size, pdfs: pdfs.size };
}

/**
 * A portable Markdown digest of annotation rows, grouped by PDF and page. It
 * carries the quote, the note, the tags and a link back to the exact
 * annotation, and never includes the PDF bytes.
 */
function annotationsMarkdown(rows, options) {
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
  if (!list.length) return "";
  const opts = options && typeof options === "object" ? options : {};
  const title = str(opts.title).trim() || "PDF annotations";
  const lines = [`# ${title}`, ""];
  let currentPdf = "";
  let currentPage = 0;
  for (const row of list.slice().sort((a, b) => str(a.pdfPath).localeCompare(str(b.pdfPath)) || a.page - b.page || str(a.createdAt).localeCompare(str(b.createdAt)))) {
    if (row.pdfPath !== currentPdf) {
      currentPdf = row.pdfPath;
      currentPage = 0;
      lines.push(`## ${currentPdf || "Unlinked PDF"}`, "");
    }
    if (row.page !== currentPage) {
      currentPage = row.page;
      lines.push(`### Page ${currentPage}`, "");
    }
    const quote = str(row.quote).replace(/\s+/g, " ").trim();
    const note = str(row.note).trim();
    const summary = str(row.summary).replace(/\s+/g, " ").trim();
    lines.push(`- **${row.type}** (${row.color})${quote ? `: “${quote}”` : summary ? `: ${summary}` : ""}`);
    if (note) lines.push(`  - Note: ${note.replace(/\n+/g, " ")}`);
    if (Array.isArray(row.tags) && row.tags.length) lines.push(`  - Tags: ${row.tags.map((tag) => `#${tag}`).join(" ")}`);
    const link = annotationLink(row.pdfPath, row.page, row.id, unionRect(row.areas));
    if (link) lines.push(`  - Link: ${link}`);
  }
  lines.push("");
  return lines.join("\n");
}

function annotationsForPage(annotations, page) {
  const n = Math.round(Number(page) || 0);
  return (annotations || []).filter((item) => item.page === n);
}

module.exports = {
  ANNOTATION_BLOCK,
  ANNOTATION_COLORS,
  ANNOTATION_TYPES,
  MARK_TYPES,
  MAX_TAGS,
  annotationCounts,
  annotationLink,
  annotationsMarkdown,
  filterAnnotations,
  normalizeTags,
  annotationSummary,
  annotationsForPage,
  hashBytes,
  newAnnotationId,
  normalizeAnnotation,
  parseAnnotationFile,
  pdfPathFromSidecar,
  removeAnnotation,
  serializeAnnotationFile,
  sidecarPathFor,
  sortAnnotations,
  upsertAnnotation,
};
