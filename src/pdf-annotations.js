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

const { normalizeInkStrokes, normalizeTextBoxes } = require("./pdf-ink");

const ANNOTATION_BLOCK = "mcq-pdf-annotations";
const ANNOTATION_TYPES = ["highlight", "note", "text", "form", "pen"];
const ANNOTATION_COLORS = ["yellow", "green", "blue", "red", "purple", "gray"];

function str(value) {
  return value === undefined || value === null ? "" : String(value);
}

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
  if (!quote && !note && !text && !strokes.length && !boxes.length) throw new Error("Add a quote, note or text, or draw some ink, for the annotation.");
  const out = {
    id: str(src.id).trim() || newAnnotationId(),
    page,
    type,
    color,
    quote,
    note,
    text,
    createdAt: str(src.createdAt).trim() || new Date().toISOString(),
  };
  if (type === "pen") out.strokes = strokes;
  if (type === "text" && boxes.length) out.boxes = boxes;
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

function annotationsForPage(annotations, page) {
  const n = Math.round(Number(page) || 0);
  return (annotations || []).filter((item) => item.page === n);
}

module.exports = {
  ANNOTATION_BLOCK,
  ANNOTATION_COLORS,
  ANNOTATION_TYPES,
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
