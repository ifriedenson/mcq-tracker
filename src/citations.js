"use strict";
/*
 * Local citation library. A .bib file is parsed in memory; imported entries
 * live in plugin data, and a citation note is created only on request.
 */
const { hashString, str } = require("./util");

const MAX_CITATIONS = 500;
const MAX_TITLE = 300;
const MAX_FIELD = 500;
const CITATION_FOLDER = "Citations";

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function textValue(value, max) {
  return str(value).replace(/\r\n?/g, "\n").replace(/[{}]/g, "").replace(/\s+/g, " ").trim().slice(0, max || MAX_TITLE);
}

function normalizeAuthors(value) {
  const raw = Array.isArray(value) ? value : str(value).split(/\s+and\s+/i);
  const authors = [];
  for (const item of raw) {
    let author = textValue(item, MAX_FIELD);
    if (!author) continue;
    if (author.includes(",")) {
      const [last, ...rest] = author.split(",").map((part) => part.trim());
      const first = rest.join(" ").trim();
      if (first && last) author = first + " " + last;
    }
    if (!authors.some((entry) => entry.toLowerCase() === author.toLowerCase())) authors.push(author);
    if (authors.length >= 40) break;
  }
  return authors;
}

function normalizeCitation(value) {
  const source = objectValue(value);
  const title = textValue(source.title, MAX_TITLE);
  if (!title) return null;
  const key = textValue(source.key || source.id, 160) || "citation-" + hashString(title);
  const year = textValue(source.year, 12);
  return {
    id: key,
    key,
    type: textValue(source.type, 40).toLowerCase() || "misc",
    title,
    authors: normalizeAuthors(source.authors || source.author),
    year: /^\d{4}$/.test(year) ? year : "",
    journal: textValue(source.journal || source.booktitle, MAX_FIELD),
    publisher: textValue(source.publisher, MAX_FIELD),
    volume: textValue(source.volume, 40),
    issue: textValue(source.number || source.issue, 40),
    pages: textValue(source.pages, 80),
    doi: textValue(source.doi, MAX_FIELD),
    url: textValue(source.url, MAX_FIELD),
    importedAt: Math.max(0, Math.round(Number(source.importedAt) || 0)),
  };
}

function normalizeCitationSettings(value) {
  const source = objectValue(value);
  const entries = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.entries) ? source.entries : []) {
    const entry = normalizeCitation(raw);
    if (!entry || seen.has(entry.id.toLowerCase())) continue;
    seen.add(entry.id.toLowerCase());
    entries.push(entry);
    if (entries.length >= MAX_CITATIONS) break;
  }
  return {
    enabled: source.enabled === true,
    folder: textValue(source.folder, 200) || CITATION_FOLDER,
    entries,
  };
}

function fieldValues(body) {
  const fields = {};
  let index = 0;
  while (index < body.length) {
    while (index < body.length && /[\s,]/.test(body[index])) index++;
    if (index >= body.length) break;
    const name = /^([A-Za-z][\w-]*)\s*=\s*/.exec(body.slice(index));
    if (!name) {
      index++;
      continue;
    }
    index += name[0].length;
    let value = "";
    if (body[index] === "{") {
      const start = index;
      let depth = 0;
      for (; index < body.length; index++) {
        if (body[index] === "{") depth++;
        else if (body[index] === "}") {
          depth--;
          if (depth === 0) {
            value = body.slice(start + 1, index);
            index++;
            break;
          }
        }
      }
    } else if (body[index] === '"') {
      index++;
      const start = index;
      let escaped = false;
      for (; index < body.length; index++) {
        const char = body[index];
        if (!escaped && char === '"') break;
        escaped = !escaped && char === "\\";
        if (char !== "\\") escaped = false;
      }
      value = body.slice(start, index);
      index++;
    } else {
      const start = index;
      while (index < body.length && body[index] !== ",") index++;
      value = body.slice(start, index);
    }
    fields[name[1].toLowerCase()] = textValue(value, MAX_FIELD);
    while (index < body.length && body[index] !== ",") index++;
    index++;
  }
  return fields;
}

/** Parse BibTeX in memory. Malformed entries are skipped, never guessed. */
function parseBibTeX(text) {
  const source = str(text).replace(/\r\n?/g, "\n");
  const entries = [];
  let cursor = 0;
  while (cursor < source.length) {
    const at = source.indexOf("@", cursor);
    if (at < 0) break;
    const head = /^@([A-Za-z]+)\s*\{/.exec(source.slice(at));
    if (!head) {
      cursor = at + 1;
      continue;
    }
    const type = head[1].toLowerCase();
    const open = at + head[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let index = open; index < source.length; index++) {
      if (source[index] === "{") depth++;
      else if (source[index] === "}") {
        depth--;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end < 0) break;
    cursor = end + 1;
    if (["comment", "preamble", "string"].includes(type)) continue;
    const body = source.slice(open + 1, end);
    const comma = body.indexOf(",");
    if (comma < 0) continue;
    const key = textValue(body.slice(0, comma), 160);
    const fields = fieldValues(body.slice(comma + 1));
    const entry = normalizeCitation({
      ...fields,
      key,
      type,
      importedAt: Date.now(),
    });
    if (entry) entries.push(entry);
    if (entries.length >= MAX_CITATIONS) break;
  }
  return entries;
}

function citationLabel(entry) {
  const author = entry.authors && entry.authors.length ? entry.authors[0] : "Unknown author";
  const more = entry.authors && entry.authors.length > 1 ? " et al." : "";
  return author + more + " (" + (entry.year || "n.d.") + ")";
}

function citationText(entry) {
  const source = normalizeCitation(entry);
  if (!source) return "";
  const authors = source.authors.length ? source.authors.join(", ") : "Unknown author";
  const year = source.year || "n.d.";
  const parts = [authors + " (" + year + ").", source.title.replace(/[.!?]+$/, "") + "."];
  const publication = [source.journal, source.volume, source.issue, source.pages].filter(Boolean).join(", ");
  if (publication) parts.push(publication.replace(/\.$/, "") + ".");
  if (source.publisher) parts.push(source.publisher.replace(/\.$/, "") + ".");
  if (source.doi) parts.push("https://doi.org/" + source.doi.replace(/^https?:\/\/doi\.org\//i, ""));
  else if (source.url) parts.push(source.url);
  return parts.join(" ");
}

function safeCitationName(entry) {
  const base = (entry.authors && entry.authors[0] ? entry.authors[0] + " " : "") + (entry.year ? entry.year + " " : "") + entry.title;
  const clean = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90)
    .replace(/[. ]+$/g, "");
  return clean || "citation-" + hashString(entry.id);
}

function citationNoteMarkdown(entry) {
  const source = normalizeCitation(entry);
  if (!source) return "";
  const frontmatter = [
    "---",
    "type: citation",
    "citation_key: " + JSON.stringify(source.key),
    "title: " + JSON.stringify(source.title),
    "authors: " + JSON.stringify(source.authors),
    "year: " + JSON.stringify(source.year),
    "journal: " + JSON.stringify(source.journal),
    "doi: " + JSON.stringify(source.doi),
    "url: " + JSON.stringify(source.url),
    "tags: [citation]",
    "---",
    "",
  ];
  const body = ["# " + source.title, "", "## Citation", "", citationText(source), ""];
  const details = [
    ["Key", source.key],
    ["Type", source.type],
    ["Authors", source.authors.join("; ")],
    ["Year", source.year],
    ["Journal", source.journal],
    ["Publisher", source.publisher],
    ["Volume", source.volume],
    ["Issue", source.issue],
    ["Pages", source.pages],
    ["DOI", source.doi],
    ["URL", source.url],
  ].filter(([, value]) => value);
  if (details.length) {
    body.push("## Details", "", "| Field | Value |", "|---|---|");
    for (const [label, value] of details) body.push("| " + label + " | " + value.replace(/\|/g, "\\|") + " |");
    body.push("");
  }
  return frontmatter.concat(body).join("\n");
}

function citationStats(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const years = list.map((entry) => Number(entry.year)).filter((year) => Number.isInteger(year));
  return {
    total: list.length,
    withDoi: list.filter((entry) => !!entry.doi).length,
    withUrl: list.filter((entry) => !!entry.url).length,
    oldest: years.length ? Math.min(...years) : null,
    newest: years.length ? Math.max(...years) : null,
  };
}

module.exports = {
  CITATION_FOLDER,
  MAX_CITATIONS,
  citationLabel,
  citationNoteMarkdown,
  citationStats,
  citationText,
  normalizeAuthors,
  normalizeCitation,
  normalizeCitationSettings,
  parseBibTeX,
  safeCitationName,
};
