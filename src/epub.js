"use strict";
/*
 * A dependency-free EPUB reader.
 *
 * An EPUB is a ZIP with a fixed entry (`META-INF/container.xml`) naming an OPF
 * package; the OPF lists the manifest and the spine order. This module opens the
 * container, reads the spine's XHTML chapters in order and returns plain text
 * (paragraphs separated by blank lines) so the reader and the annotation sidecar
 * can work with stable character offsets. No HTML is ever handed to the DOM, no
 * script or style content is kept, and nothing is fetched over the network.
 */
const { decodeXml, inflateRaw, zipEntries } = require("./documents");
const { str } = require("./util");

const MAX_CHAPTERS = 300;
const MAX_CHAPTER_TEXT = 200000;
const READABLE = /(xhtml|html|htm|xml)$/i;

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input && input.buffer instanceof ArrayBuffer) return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || 0);
  return new Uint8Array(0);
}

function utf8(bytes) {
  if (typeof TextDecoder === "function") return new TextDecoder("utf-8").decode(bytes);
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

/** Resolves `href` against the folder that holds the OPF file. */
function joinPath(folder, href) {
  const clean = str(href).trim().replace(/\\/g, "/").split("#")[0];
  if (!clean) return "";
  const parts = (clean.startsWith("/") ? clean.slice(1) : folder + clean).split("/");
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function folderOf(path) {
  const text = str(path);
  const cut = text.lastIndexOf("/");
  return cut < 0 ? "" : text.slice(0, cut + 1);
}

async function readEntry(zip, name) {
  const entry = zip.get(name);
  if (!entry) return "";
  const bytes = entry.method === 0 ? entry.data : await inflateRaw(entry.data);
  return utf8(toBytes(bytes));
}

/** Attributes of one tag, lower-cased, with entities decoded. */
function attributes(tag) {
  const out = {};
  for (const match of str(tag).matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)"/g)) {
    out[match[1].toLowerCase()] = decodeXml(match[2]);
  }
  for (const match of str(tag).matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*'([^']*)'/g)) {
    if (!(match[1].toLowerCase() in out)) out[match[1].toLowerCase()] = decodeXml(match[2]);
  }
  return out;
}

/** Readable text from one XHTML document; scripts, styles and tags are dropped. */
function xhtmlText(html) {
  const source = str(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article|figcaption)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");
  return decodeXml(source)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The first heading in a chapter, or "" when it has none. */
function chapterHeading(html) {
  const match = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(str(html));
  if (!match) return "";
  return decodeXml(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Opens an EPUB from its bytes. Returns
 * `{ ok, title, chapters: [{ n, title, href, text }], total, truncated }`.
 * Throws a readable Error when the container, package or spine is unusable.
 */
async function readEpub(input) {
  const bytes = toBytes(input);
  if (!bytes.length) throw new Error("That EPUB is empty.");
  let zip;
  try {
    zip = zipEntries(bytes);
  } catch (e) {
    throw new Error("That file isn't an EPUB: its ZIP container can't be read.");
  }
  const container = await readEntry(zip, "META-INF/container.xml");
  if (!container) throw new Error("That EPUB has no META-INF/container.xml, so its package cannot be found.");
  const rootfile = /<rootfile\b[^>]*>/i.exec(container);
  const opfPath = rootfile ? attributes(rootfile[0])["full-path"] : "";
  if (!opfPath) throw new Error("That EPUB's container does not name a package document.");
  const opf = await readEntry(zip, str(opfPath).replace(/^\/+/, ""));
  if (!opf) throw new Error(`That EPUB is missing its package document (${opfPath}).`);

  const titleMatch = /<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opf);
  const title = titleMatch ? decodeXml(titleMatch[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 300) : "";

  const manifest = new Map();
  for (const match of opf.matchAll(/<item\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (!attrs.id || !attrs.href) continue;
    manifest.set(attrs.id, { href: attrs.href, type: str(attrs["media-type"]).toLowerCase() });
  }
  const folder = folderOf(opfPath);
  const spine = [...opf.matchAll(/<itemref\b[^>]*>/gi)].map((match) => attributes(match[0]).idref).filter(Boolean);
  const order = spine.length ? spine : [...manifest.keys()];
  const chapters = [];
  let truncated = false;
  for (const idref of order) {
    const item = manifest.get(idref);
    if (!item) continue;
    const href = joinPath(folder, item.href);
    if (!READABLE.test(href) || !/xhtml|html/.test(item.type || "xhtml")) continue;
    const html = await readEntry(zip, href);
    if (!html) continue;
    let text = xhtmlText(html);
    if (!text) continue;
    if (text.length > MAX_CHAPTER_TEXT) {
      text = text.slice(0, MAX_CHAPTER_TEXT);
      truncated = true;
    }
    if (chapters.length >= MAX_CHAPTERS) {
      truncated = true;
      break;
    }
    chapters.push({
      n: chapters.length + 1,
      title: chapterHeading(html) || `Chapter ${chapters.length + 1}`,
      href,
      text,
    });
  }
  if (!chapters.length) throw new Error("That EPUB has no readable chapters.");
  return { ok: true, title: title || "EPUB", chapters, total: chapters.length, truncated };
}

/**
 * Paragraphs of one chapter with their exact character range, so a highlight can
 * be drawn on the paragraph it belongs to without re-searching the text.
 */
function paragraphsOf(text) {
  const source = str(text);
  const out = [];
  let start = 0;
  while (start < source.length) {
    let end = source.indexOf("\n\n", start);
    if (end < 0) end = source.length;
    const raw = source.slice(start, end);
    const lead = raw.length - raw.replace(/^\s+/, "").length;
    const body = raw.trim();
    if (body) out.push({ text: body, start: start + lead, end: start + lead + body.length });
    start = end + 2;
  }
  return out;
}

/** Paragraphs with the annotations that overlap each one, for rendering. */
function annotateParagraphs(text, annotations) {
  const list = Array.isArray(annotations) ? annotations : [];
  return paragraphsOf(text).map((paragraph) => {
    const hits = list.filter((entry) => entry && entry.start < paragraph.end && entry.end > paragraph.start);
    return {
      ...paragraph,
      annotations: hits,
      ids: hits.map((entry) => entry.id),
      notes: hits.map((entry) => entry.note).filter(Boolean),
    };
  });
}

/** `Book.epub` -> `Book (EPUB).md`-style safe base for messages and notes. */
function epubBaseName(path) {
  return (
    str(path)
      .split("/")
      .pop()
      .replace(/\.epub$/i, "")
      .replace(/[\\/:*?"<>|#[\]]/g, "")
      .trim() || "EPUB"
  );
}

module.exports = {
  MAX_CHAPTERS,
  MAX_CHAPTER_TEXT,
  annotateParagraphs,
  epubBaseName,
  joinPath,
  paragraphsOf,
  readEpub,
  xhtmlText,
};
