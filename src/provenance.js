"use strict";
/*
 * Local provenance for imported questions and cards.
 *
 * The source is stored as a vault path plus optional page/heading, and also as
 * a normal Obsidian link (`[[file.pdf#page=3]]`). The link is what opens the
 * exact page in Obsidian/PDF++; the path is what tools and a later reader can
 * use without parsing Markdown.
 */
const { str } = require("./util");

const SOURCE_PROPS = [
  "source_pdf",
  "source_document",
  "source_note",
  "source_file",
  "source_page",
  "source_heading",
  "source_link",
  "source_scan_id",
  "scan_date",
  "ocr_source",
  "ocr_confidence",
];

function cleanPath(value) {
  let s = str(value).trim();
  const wiki = s.match(/^\[\[([^\]]+)\]\]$/);
  if (wiki) s = wiki[1].split("|")[0];
  s = s.split("|")[0].split("#")[0].trim();
  return s.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function normalizePage(value) {
  const s = str(value).trim().replace(/^page\s*/i, "");
  if (!s) return "";
  const m = s.match(/^(\d+)(?:\s*[-–—]\s*(\d+))?$/);
  if (m) {
    const a = Number(m[1]);
    if (!m[2]) return a >= 1 ? a : "";
    const b = Number(m[2]);
    return a >= 1 && b >= a ? `${a}-${b}` : a >= 1 ? a : "";
  }
  return s.slice(0, 40);
}

function headingPart(value) {
  return str(value).trim().replace(/^#+\s*/, "").replace(/\|/g, "-");
}

/** The inner target of an Obsidian link. `page` wins over `heading` for PDFs. */
function sourceTarget(path, page, heading) {
  const clean = cleanPath(path);
  if (!clean) return "";
  const p = normalizePage(page);
  const h = headingPart(heading);
  if (p && /\.pdf$/i.test(clean)) return `${clean}#page=${p}`;
  if (h) return `${clean}#${h}`;
  return clean;
}

function sourceLink(path, page, heading) {
  const target = sourceTarget(path, page, heading);
  return target ? `[[${target}]]` : "";
}

function sourceLabel(path) {
  return cleanPath(path).split("/").pop() || "source";
}

function hasSource(fm) {
  if (!fm) return false;
  return SOURCE_PROPS.some((k) => str(fm[k]).trim());
}

/** Normalize any stored provenance, including links and the older plain `source` name. */
function sourceOf(fm) {
  const f = fm || {};
  const explicitLink = str(f.source_link).trim();
  const path = cleanPath(f.source_pdf || f.source_document || f.source_note || f.source_file || f.source_path || "");
  const page = normalizePage(f.source_page || f.pdf_page || f.page);
  const heading = str(f.source_heading || f.source_heading_text || "").trim();
  const quote = str(f.source_quote || f.sourceQuote).trim();
  const context = str(f.source_context || f.sourceContext).trim();
  const link = explicitLink || sourceLink(path, page, heading);
  const label = sourceLabel(path);
  const detail = [label, page ? `page ${page}` : "", heading && !page ? heading : ""].filter(Boolean).join(" · ") || link;
  return {
    path,
    page,
    heading,
    quote,
    context,
    link,
    label,
    detail,
    has: !!(path || link),
    pdf: /\.pdf$/i.test(path),
  };
}

/** Find the copied source file when the note only has the older `source` basename. */
function findSourceFile(files, fm, notePath) {
  const list = Array.isArray(files) ? files : [];
  const f = fm || {};
  const explicit = cleanPath(f.source_pdf || f.source_document || f.source_note || f.source_file);
  if (explicit) {
    const exact = list.find((file) => cleanPath(file.path) === explicit);
    if (exact) return exact;
    const byName = list.find((file) => str(file.basename).toLowerCase() === explicit.toLowerCase());
    if (byName) return byName;
  }
  const name = str(f.source || f.source_name).trim();
  if (!name) return null;
  const clean = name.replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  const folder = str(notePath).includes("/") ? str(notePath).slice(0, str(notePath).lastIndexOf("/")) : "";
  const matches = list.filter((file) => {
    const base = str(file.basename || file.path).replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "").toLowerCase();
    return base === clean;
  });
  if (!matches.length) return null;
  const sameFolder = matches.find((file) => {
    const p = str(file.path);
    const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    return dir === folder;
  });
  return sameFolder || matches[0];
}

module.exports = {
  SOURCE_PROPS,
  cleanPath,
  findSourceFile,
  hasSource,
  headingPart,
  normalizePage,
  sourceLabel,
  sourceLink,
  sourceOf,
  sourceTarget,
};
