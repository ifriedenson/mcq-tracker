"use strict";
/*
 * EPUB annotation sidecar.
 *
 * An EPUB is never written: highlights and notes live in a Markdown sidecar next
 * to the book (`Book.epub.annotations.md`), so the book stays byte-identical and
 * the annotations are readable, linkable and greppable. Each annotation records
 * the chapter number, the character range inside that chapter's extracted text,
 * the quote it was made over, an optional note, a colour and bounded tags.
 */
const { str } = require("./util");

const COLORS = ["yellow", "green", "blue", "red", "purple"];
const MAX_ANNOTATIONS = 2000;
const MAX_QUOTE = 2000;
const MAX_NOTE = 4000;
const MAX_TAGS = 6;
const MAX_TAG = 24;
const MARKER = "<!-- mcq-epub-annotations -->";
const EMPTY = Object.freeze({ epubPath: "", epubHash: "", annotations: [], damaged: [] });

/** A stable, dependency-free hash of the book's bytes, used to spot a replaced file. */
function epubHash(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (const byte of data) {
    h1 = (h1 ^ byte) * 0x01000193 >>> 0;
    h2 = (h2 + byte * (h1 % 31 + 1)) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 16);
}

function sidecarPathFor(path) {
  return str(path).replace(/\.epub$/i, "") + ".epub.annotations.md";
}

/** Page-style tags: lower-case, hash-free, unique, at most six of 24 characters. */
function normalizeTags(value) {
  const list = Array.isArray(value) ? value : str(value).split(/[,;#]+/);
  const out = [];
  for (const raw of list) {
    const tag = str(raw)
      .trim()
      .replace(/^#+/, "")
      .replace(/[^A-Za-z0-9/_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, MAX_TAG);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** One annotation, or null when the chapter, range, quote or id is unusable. */
function normalizeAnnotation(value) {
  const source = value && typeof value === "object" ? value : {};
  const id = /^ann-[0-9]{1,6}$/.test(str(source.id)) ? str(source.id) : "";
  const chapter = number(source.chapter);
  const start = number(source.start);
  const end = number(source.end);
  const quote = str(source.quote).trim().slice(0, MAX_QUOTE);
  if (!id || chapter === null || chapter < 1 || start === null || end === null) return null;
  if (start < 0 || end <= start || !quote) return null;
  return {
    id,
    chapter,
    start,
    end,
    quote,
    note: str(source.note).trim().slice(0, MAX_NOTE),
    color: COLORS.includes(str(source.color).toLowerCase()) ? str(source.color).toLowerCase() : "yellow",
    tags: normalizeTags(source.tags),
  };
}

/** Everything a sidecar carries, tolerating a missing or damaged block. */
function parseSidecar(text) {
  const out = { ...EMPTY, annotations: [], damaged: [] };
  const source = str(text);
  if (!source.trim()) return out;
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (front) {
    const epub = /^epub:\s*(.+)$/m.exec(front[1]);
    const hash = /^epub_hash:\s*(.+)$/m.exec(front[1]);
    if (epub) out.epubPath = str(epub[1]).replace(/^["']|["']$/g, "").trim();
    if (hash) out.epubHash = str(hash[1]).replace(/^["']|["']$/g, "").trim();
  }
  const block = /```json\s*\n([\s\S]*?)```/i.exec(source);
  if (!block) {
    if (source.includes(MARKER)) out.damaged.push("The annotation block is missing its JSON body.");
    return out;
  }
  let list;
  try {
    list = JSON.parse(block[1]);
  } catch (e) {
    out.damaged.push("The annotation block is not valid JSON; no annotation was loaded from it.");
    return out;
  }
  if (!Array.isArray(list)) {
    out.damaged.push("The annotation block is not a list.");
    return out;
  }
  for (const item of list) {
    const normalized = normalizeAnnotation(item);
    if (normalized) out.annotations.push(normalized);
    else out.damaged.push(`Skipped an annotation that is not usable (${str(item && item.id) || "no id"}).`);
  }
  return out;
}

/** One sidecar file, with the annotations readable and re-parseable. */
function serializeSidecar(epubPath, hash, annotations) {
  const list = (Array.isArray(annotations) ? annotations : []).map(normalizeAnnotation).filter(Boolean).slice(0, MAX_ANNOTATIONS);
  const path = str(epubPath).trim();
  const lines = [
    "---",
    `epub: ${JSON.stringify(path)}`,
    `epub_hash: ${JSON.stringify(str(hash))}`,
    `annotations: ${list.length}`,
    "---",
    "",
    "# EPUB annotations",
    "",
    `Book: ${path ? `[[${path}]]` : "(unknown)"}`,
    "",
    MARKER,
    "```json",
    JSON.stringify(list, null, 2),
    "```",
    "",
  ];
  return { text: lines.join("\n"), annotations: list };
}

function nextId(annotations) {
  let max = 0;
  for (const annotation of annotations || []) {
    const match = /^ann-([0-9]+)$/.exec(str(annotation && annotation.id));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `ann-${max + 1}`;
}

/**
 * Adds one annotation. `meta.chapterText` is the chapter's extracted text, used
 * both to locate the quote and to prove the stored offsets still point at it.
 * Returns `{ text, annotation, annotations, error }`; `error` is a sentence and
 * nothing is added when the request is unusable.
 */
function addAnnotation(text, input, meta) {
  const source = input && typeof input === "object" ? input : {};
  const m = meta && typeof meta === "object" ? meta : {};
  const chapterText = str(m.chapterText);
  const quote = str(source.quote).trim().slice(0, MAX_QUOTE);
  if (!quote) return { text: str(text), annotations: [], error: "Select some text to annotate first." };
  if (chapterText && !chapterText.includes(quote)) {
    return { text: str(text), annotations: [], error: "That quote is not in this chapter's text, so it cannot be anchored." };
  }
  const chapter = number(source.chapter);
  if (chapter === null || chapter < 1) return { text: str(text), annotations: [], error: "An annotation needs a chapter." };
  const at = chapterText ? chapterText.indexOf(quote) : -1;
  const start = number(source.start) !== null ? number(source.start) : at >= 0 ? at : 0;
  const end = number(source.end) !== null ? number(source.end) : start + quote.length;
  const parsed = parseSidecar(text);
  const existing = parsed.annotations.find((entry) => entry.chapter === chapter && entry.start === start && entry.end === end);
  const annotation = normalizeAnnotation({
    id: existing ? existing.id : nextId(parsed.annotations),
    chapter,
    start,
    end,
    quote,
    note: source.note,
    color: source.color,
    tags: source.tags,
  });
  if (!annotation) return { text: str(text), annotations: parsed.annotations, error: "That annotation has no usable range." };
  const annotations = existing
    ? parsed.annotations.map((entry) => (entry.id === existing.id ? annotation : entry))
    : parsed.annotations.concat([annotation]).slice(-MAX_ANNOTATIONS);
  const written = serializeSidecar(m.epubPath || parsed.epubPath, m.hash || parsed.epubHash, annotations);
  return { text: written.text, annotation, annotations: written.annotations };
}

function removeAnnotation(text, id) {
  const parsed = parseSidecar(text);
  const target = str(id).trim();
  const annotations = parsed.annotations.filter((entry) => entry.id !== target);
  if (annotations.length === parsed.annotations.length) {
    return { text: str(text), removed: false, annotations: parsed.annotations };
  }
  const written = serializeSidecar(parsed.epubPath, parsed.epubHash, annotations);
  return { text: written.text, removed: true, annotations: written.annotations };
}

/** Rows for one chapter, in reading order. */
function annotationsForChapter(annotations, chapter) {
  const n = number(chapter);
  return (annotations || [])
    .filter((entry) => normalizeAnnotation(entry) && entry.chapter === n)
    .map(normalizeAnnotation)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** `[[Book.epub#chapter=2&annotation=ann-3]]`, or "" when unusable. */
function epubAnnotationLink(epubPath, chapter, id) {
  const path = str(epubPath).trim().replace(/^\/+/, "").replace(/[|#[\]]/g, "");
  const n = number(chapter);
  const anchor = str(id).trim();
  if (!path || !/\.epub$/i.test(path) || n === null || n < 1) return "";
  if (anchor && !/^ann-[0-9]{1,6}$/.test(anchor)) return "";
  return `[[${path}#chapter=${n}${anchor ? `&annotation=${anchor}` : ""}]]`;
}

function describeAnnotation(annotation) {
  const entry = normalizeAnnotation(annotation);
  if (!entry) return "That is not an EPUB annotation.";
  return `chapter ${entry.chapter}, “${entry.quote.length > 60 ? entry.quote.slice(0, 60) + "…" : entry.quote}”${entry.note ? ` — ${entry.note}` : ""}`;
}

module.exports = {
  COLORS,
  MARKER,
  MAX_ANNOTATIONS,
  MAX_NOTE,
  MAX_QUOTE,
  MAX_TAGS,
  addAnnotation,
  annotationsForChapter,
  describeAnnotation,
  epubAnnotationLink,
  epubHash,
  normalizeAnnotation,
  normalizeTags,
  parseSidecar,
  removeAnnotation,
  serializeSidecar,
  sidecarPathFor,
};
