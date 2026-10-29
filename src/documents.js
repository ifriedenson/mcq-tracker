"use strict";
/*
 * Reads questions from documents other than PDFs. PowerPoint, Word and OpenDocument
 * files are ZIP archives of XML, so the text is read straight out of the archive
 * (no extra libraries). Plain text, Markdown, CSV, HTML and RTF are read as text.
 *
 * Everything comes back in the same shape as readPdfPages in ./pdf:
 *   { pages: [{ n, text, figs }], total, warnings, figCount, kind }
 */
const { parsePageRange } = require("./pdf");
const { str } = require("./util");

const KINDS = {
  pdf: "PDF",
  pptx: "PowerPoint",
  pptm: "PowerPoint",
  docx: "Word",
  docm: "Word",
  odt: "OpenDocument text",
  odp: "OpenDocument presentation",
  txt: "text",
  md: "Markdown",
  markdown: "Markdown",
  csv: "CSV",
  tsv: "TSV",
  html: "HTML",
  htm: "HTML",
  rtf: "RTF",
};

const DOCUMENT_EXTENSIONS = Object.keys(KINDS);
const SLIDE_KINDS = new Set(["pptx", "pptm", "odp"]);

function extensionOf(name) {
  const m = str(name).match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

/** The lower-case extension when this plugin can read the file, otherwise "". */
function documentKind(name) {
  const ext = extensionOf(name);
  return KINDS[ext] ? ext : "";
}

/** A short human name for the format, for messages: "PowerPoint", "Word", "PDF". */
function documentLabel(name) {
  return KINDS[documentKind(name)] || "document";
}

/** The file name without its folder or extension. */
function documentBaseName(name) {
  return str(name)
    .replace(/^.*\//, "")
    .replace(/\.[a-z0-9]+$/i, "");
}

function utf8(bytes) {
  if (typeof TextDecoder === "function") return new TextDecoder("utf-8").decode(bytes);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("utf8");
}

function codepoint(n) {
  try {
    return String.fromCodePoint(n);
  } catch (e) {
    return "";
  }
}

/** Decodes the XML entities found in Office files. */
function decodeXml(s) {
  return str(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => codepoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => codepoint(Number(d)))
    .replace(/&(lt|gt|amp|quot|apos);/gi, (_m, n) => ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" })[n.toLowerCase()]);
}

/* ------------------------------------------------------------------ ZIP */

/** The central directory of a ZIP archive: name -> { method, size, data }. */
function zipEntries(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  // the end-of-central-directory record, searched from the end (it can be followed by a comment)
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This file isn't a valid Office file: its ZIP directory is missing or damaged.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) {
      throw new Error("This Office file is damaged: its ZIP directory can't be read.");
    }
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = utf8(u8.subarray(p + 46, p + 46 + nameLen));
    if (local + 30 <= u8.length && dv.getUint32(local, true) === 0x04034b50) {
      const localName = dv.getUint16(local + 26, true);
      const localExtra = dv.getUint16(local + 28, true);
      const start = local + 30 + localName + localExtra;
      entries.set(name, { method, size, data: u8.subarray(start, start + compSize) });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data) {
  if (!data || !data.length) return new Uint8Array(0);
  if (typeof DecompressionStream === "function") {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) {
      /* fall back to Node's zlib on desktop */
    }
  }
  try {
    // eslint-disable-next-line global-require
    const zlib = require("zlib");
    return new Uint8Array(zlib.inflateRawSync(data));
  } catch (e) {
    throw new Error("This Office file is compressed in a way this version of Obsidian can't read.");
  }
}

function openZip(buf) {
  const entries = zipEntries(buf);
  return {
    names: () => [...entries.keys()],
    has: (name) => entries.has(name),
    async text(name) {
      const entry = entries.get(name);
      if (!entry) return "";
      return utf8(entry.method === 0 ? entry.data : await inflateRaw(entry.data));
    },
  };
}

/* ------------------------------------------------------- Office XML -> text */

/** All text inside PowerPoint's <a:t> runs, one line per paragraph. */
function slideText(xml) {
  const lines = [];
  for (const para of str(xml).matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi)) {
    let text = "";
    const body = para[1].replace(/<a:br\b[^>]*\/?>/gi, "\n");
    for (const run of body.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi)) text += decodeXml(run[1]);
    text = text.replace(/[ \t]+\n/g, "\n").trim();
    if (text) lines.push(text);
  }
  return lines.join("\n");
}

async function pptxPages(buf) {
  const zip = openZip(buf);
  const slides = zip
    .names()
    .map((name) => {
      const m = name.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      return m ? { order: Number(m[1]), path: name } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
  if (!slides.length) throw new Error("This PowerPoint file has no slides this plugin can read.");
  const pages = [];
  for (const slide of slides) pages.push({ n: pages.length + 1, text: slideText(await zip.text(slide.path)), figs: 0 });
  return pages;
}

/** Word paragraphs, with page breaks kept as \u0001 and tabs/line breaks preserved. */
function docxParagraphs(xml) {
  const out = [];
  for (const para of str(xml).matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi)) {
    let text = "";
    // keep the page break as a text run so the token loop below doesn't drop it
    const body = para[1].replace(/<w:br\b[^>]*w:type="page"[^>]*\/?>/gi, "<w:t>\u0001</w:t>");
    for (const tok of body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?>|<w:noBreakHyphen\b[^>]*\/?>|<w:(?:br|cr)\b[^>]*\/?>/gi)) {
      if (tok[1] !== undefined) text += decodeXml(tok[1]);
      else if (/^<w:tab/i.test(tok[0])) text += "\t";
      else if (/^<w:noBreakHyphen/i.test(tok[0])) text += "-";
      else text += "\n";
    }
    text = text.replace(/[ \t]+\n/g, "\n").trim();
    if (text) out.push(text);
  }
  return out;
}

async function docxPages(buf) {
  const zip = openZip(buf);
  const xml = await zip.text("word/document.xml");
  if (!xml) throw new Error("This Word file has no readable document text.");
  return textToPages(docxParagraphs(xml).join("\n"));
}

/** Paragraphs and headings in OpenDocument text, with tags removed. */
function odfText(xml) {
  const lines = [];
  for (const block of str(xml).matchAll(/<(text:p|text:h)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const raw = block[2]
      .replace(/<text:(?:tab|s)\b[^>]*\/?>/gi, " ")
      .replace(/<text:line-break\b[^>]*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    const text = decodeXml(raw).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
    if (text) lines.push(text);
  }
  return lines.join("\n");
}

async function odfPages(buf, kind) {
  const zip = openZip(buf);
  const xml = await zip.text("content.xml");
  if (!xml) throw new Error("This OpenDocument file has no readable text.");
  if (kind === "odp") {
    const slides = str(xml).split(/<draw:page\b/i).slice(1);
    if (slides.length) return slides.map((slide, i) => ({ n: i + 1, text: odfText(slide), figs: 0 }));
  }
  return textToPages(odfText(xml));
}

/* ------------------------------------------------------------ text files */

function htmlText(html) {
  return decodeXml(
    str(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\b[^>]*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article|blockquote)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** RTF is stripped of its control words; enough for text that came out of a word processor. */
function rtfText(rtf) {
  return str(rtf)
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\'([0-9a-f]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_m, n) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits plain text into pages at form feeds or page-break markers, otherwise into readable chunks. */
function textToPages(text) {
  const t = str(text).replace(/\r\n?/g, "\n");
  if (t.includes("\f") || t.includes("\u0001")) {
    const parts = t.split(/\f|\u0001/).map((p) => p.trim());
    while (parts.length && !parts[parts.length - 1]) parts.pop();
    return parts.map((p, i) => ({ n: i + 1, text: p, figs: 0 }));
  }
  const pages = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) pages.push({ n: pages.length + 1, text: cur.trim(), figs: 0 });
    cur = "";
  };
  for (const para of t.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (cur && cur.length + p.length + 2 > 3500) push();
    cur = cur ? `${cur}\n\n${p}` : p;
    while (cur.length > 6000) {
      const cut = cur.lastIndexOf("\n", 3500);
      const at = cut > 800 ? cut : 3500;
      pages.push({ n: pages.length + 1, text: cur.slice(0, at).trim(), figs: 0 });
      cur = cur.slice(at).trim();
    }
  }
  push();
  return pages;
}

/* --------------------------------------------------------------- reader */

/**
 * Reads the chosen pages (or slides) from a non-PDF document.
 * `spec` is the same page range as the PDF importer ("1-10", "2,4,6-8", blank for all).
 */
async function readDocumentPages(buf, name, spec, progress) {
  const kind = documentKind(name);
  if (!kind) {
    const ext = extensionOf(name);
    throw new Error(`This plugin can't read ${ext ? `.${ext}` : "that kind of"} files. Use a PDF, PowerPoint, Word, OpenDocument, HTML, RTF, Markdown, CSV or text file.`);
  }
  if (kind === "pdf") throw new Error("PDFs are read by readPdfPages, not readDocumentPages.");
  const label = documentLabel(name);
  let pages;
  if (kind === "pptx" || kind === "pptm") pages = await pptxPages(buf);
  else if (kind === "docx" || kind === "docm") pages = await docxPages(buf);
  else if (kind === "odt" || kind === "odp") pages = await odfPages(buf, kind);
  else {
    const text = utf8(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
    if (kind === "html" || kind === "htm") pages = textToPages(htmlText(text));
    else if (kind === "rtf") pages = textToPages(rtfText(text));
    else pages = textToPages(text);
  }
  const total = pages.length;
  if (!total) throw new Error(`This ${label} file has no readable text.`);
  const wanted = parsePageRange(spec, total);
  const picked = wanted.map((n) => pages[n - 1]).filter(Boolean);
  if (progress) progress(`Read ${picked.length} of ${total} ${SLIDE_KINDS.has(kind) ? "slides" : "pages"}.`);
  return { pages: picked, total, warnings: [], figCount: 0, kind };
}

module.exports = {
  KINDS,
  DOCUMENT_EXTENSIONS,
  documentKind,
  documentLabel,
  documentBaseName,
  decodeXml,
  zipEntries,
  inflateRaw,
  slideText,
  pptxPages,
  docxParagraphs,
  docxPages,
  odfText,
  htmlText,
  rtfText,
  textToPages,
  readDocumentPages,
};
