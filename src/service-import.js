"use strict";
/*
 * Importers for the note services whose exports are plain files: Evernote's
 * `.enex` XML, Google Keep's Takeout JSON and HTML, Airtable's JSON/CSV, Notion's
 * database CSV and Markdown pages, Bear's Markdown export and Roam's JSON export.
 *
 * Everything here is pure: it turns export text into records
 * `{ title, body, tags, created, service, url }` and writes note Markdown, but it
 * never touches the vault. Every export is untrusted input, so parsing is bounded
 * (500 notes, 200,000 characters a note, 60 tags) and refuses clearly instead of
 * guessing. Binary bundles (`.textbundle`, `.textpack`) are not opened: they carry
 * attachments this importer does not copy, and the refusal says so.
 */
const { str } = require("./util");

const SERVICES = {
  evernote: "Evernote",
  keep: "Google Keep",
  airtable: "Airtable",
  notion: "Notion",
  bear: "Bear",
  roam: "Roam",
  database: "Airtable or Notion CSV",
};

const MAX_NOTES = 500;
const MAX_TITLE = 200;
const MAX_BODY = 200000;
const MAX_TAGS = 60;
const MAX_TAG = 40;
const TITLE_COLUMNS = ["name", "title", "page", "item", "note"];
const TAG_COLUMNS = ["tags", "tag", "labels", "label"];
const DATE_COLUMNS = ["created", "created time", "created at", "creation date", "date"];
const NOT_TITLE_COLUMNS = new Set(["id", "url", "link", "last edited time", "last edited", "edited"]);

/* ------------------------------------------------------------------ helpers */

function decodeEntities(text) {
  return str(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch (e) {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_m, dec) => {
      try {
        return String.fromCodePoint(Number(dec));
      } catch (e) {
        return "";
      }
    })
    .replace(/&(lt|gt|amp|quot|apos|nbsp);/gi, (_m, name) =>
      ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " })[name.toLowerCase()]
    );
}

/** Plain text from exported HTML: block tags become blank lines, nothing else survives. */
function htmlToText(html) {
  return decodeEntities(
    str(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|blockquote|en-note|tr)>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Tags: lower-case, hash-free, punctuation-safe, unique, bounded. */
function normalizeTags(value) {
  const list = Array.isArray(value) ? value : str(value).split(/[,;#\n]+/);
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

function cleanTitle(value, fallback) {
  const text = str(value)
    .replace(/[*_`>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (text || fallback || "Untitled note").slice(0, MAX_TITLE);
}

function titleFromBody(body, fallback) {
  const line = str(body).split("\n").map((entry) => entry.replace(/^[#>\-*\s]+/, "").trim()).find(Boolean);
  return cleanTitle(line, fallback);
}

function clampBody(body) {
  return str(body).replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_BODY);
}

/** `20260201T101500Z` (Evernote) -> `2026-02-01T10:15:00Z`. */
function evernoteDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(str(value).trim());
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}

function isoFrom(value) {
  const text = str(value).trim();
  if (!text) return "";
  const direct = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?Z?)?$/.exec(text);
  if (direct) return direct[2] ? `${direct[1]}T${direct[2].length === 5 ? direct[2] + ":00" : direct[2]}Z` : direct[1];
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Google Keep's microseconds and Roam's milliseconds. */
function isoFromEpoch(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  const ms = number > 1e14 ? Math.round(number / 1000) : number;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function serviceOf(kind) {
  return SERVICES[kind] || "Export";
}

/* ---------------------------------------------------------------- Evernote */

function parseEvernote(text) {
  const source = str(text);
  if (!/<en-export[\s>]/i.test(source) && !/<note[\s>]/i.test(source)) {
    return { records: [], error: "That file is not an Evernote .enex export: it has no <en-export> notes." };
  }
  const records = [];
  let skipped = 0;
  for (const match of source.matchAll(/<note>([\s\S]*?)<\/note>/gi)) {
    const block = match[1];
    const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(block);
    const contentMatch = /<content>([\s\S]*?)<\/content>/i.exec(block);
    const created = evernoteDate((/<created>([\s\S]*?)<\/created>/i.exec(block) || [])[1]);
    const tags = [...block.matchAll(/<tag>([\s\S]*?)<\/tag>/gi)].map((entry) => decodeEntities(entry[1]));
    const url = decodeEntities((/<source-url>([\s\S]*?)<\/source-url>/i.exec(block) || [])[1] || "");
    const rawContent = contentMatch ? contentMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") : "";
    const body = rawContent ? htmlToText(rawContent) : "";
    if (!body && !titleMatch) {
      skipped += 1;
      continue;
    }
    records.push({
      title: cleanTitle(titleMatch ? decodeEntities(titleMatch[1]) : "", titleFromBody(body)),
      body: clampBody(body),
      tags: normalizeTags(tags),
      created,
      service: "Evernote",
      url,
    });
    if (records.length >= MAX_NOTES) break;
  }
  if (!records.length) return { records: [], error: "That Evernote export contains no notes with a title or body." };
  return { records, skipped, total: records.length + skipped };
}

/* ---------------------------------------------------------------- Keep */

function keepBody(note) {
  const parts = [];
  const text = clampBody(note.textContent);
  if (text) parts.push(text);
  const items = Array.isArray(note.listContent) ? note.listContent : [];
  if (items.length) {
    const lines = items
      .map((item) => `- ${item && item.isChecked ? "[x]" : "[ ]"} ${str(item && item.text).trim()}`)
      .filter((line) => line.trim() !== "- [ ]");
    if (lines.length) parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}

function parseKeepJson(text) {
  let data;
  try {
    data = JSON.parse(str(text));
  } catch (e) {
    return { records: [], error: "That Google Keep export is not valid JSON." };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data && data.notes) ? data.notes : null;
  if (!list) return { records: [], error: "That Google Keep JSON is not a list of notes." };
  const records = [];
  let skipped = 0;
  for (const note of list) {
    if (!note || typeof note !== "object") continue;
    if (note.isTrashed) {
      skipped += 1;
      continue;
    }
    const body = keepBody(note);
    const labels = Array.isArray(note.labels) ? note.labels.map((label) => (label && label.name) || label) : note.labels;
    if (!body && !str(note.title).trim()) {
      skipped += 1;
      continue;
    }
    records.push({
      title: cleanTitle(note.title, titleFromBody(body)),
      body: clampBody(body),
      tags: normalizeTags(labels),
      created: isoFromEpoch(note.createdTimestampUsec),
      service: "Google Keep",
      url: "",
    });
    if (records.length >= MAX_NOTES) break;
  }
  if (!records.length) return { records: [], error: "That Google Keep export contains no notes (archived and trashed notes are skipped)." };
  return { records, skipped, total: records.length + skipped };
}

function parseKeepHtml(text) {
  const source = str(text);
  const content = /<div[^>]*class="[^"]*\bcontent\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<ul|<div[^>]*class="[^"]*chips|<\/body|$)/i.exec(source) || /<body[^>]*>([\s\S]*?)<\/body>/i.exec(source);
  const body = content ? htmlToText(content[1]) : "";
  const titleMatch = /<h1[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(source);
  const labelBlock = /<ul[^>]*class="[^"]*\blabels\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/i.exec(source);
  const tags = labelBlock ? [...labelBlock[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((entry) => htmlToText(entry[1])) : [];
  if (!body && !titleMatch) return { records: [], error: "That Google Keep HTML page has no note content." };
  return {
    records: [
      {
        title: cleanTitle(titleMatch ? htmlToText(titleMatch[1]) : "", titleFromBody(body)),
        body: clampBody(body),
        tags: normalizeTags(tags),
        created: "",
        service: "Google Keep",
        url: "",
      },
    ],
    skipped: 0,
    total: 1,
  };
}

/* ---------------------------------------------------------------- CSV */

/** Quoted CSV/TSV: `""` is one quote, commas and newlines may sit inside a field. */
function parseCsv(text, delimiter) {
  const source = str(text).replace(/^\uFEFF/, "");
  const split = delimiter || (source.split("\n")[0] && source.split("\n")[0].includes("\t") ? "\t" : ",");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"' && !field) quoted = true;
    else if (ch === split) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => str(cell).trim()));
}

function recordFromRow(row, columns, service) {
  const lower = columns.map((column) => str(column).trim().toLowerCase());
  const cell = (index) => (index >= 0 ? str(row[index]).trim() : "");
  const pick = (names) => {
    for (const name of names) {
      const index = lower.indexOf(name);
      if (index >= 0 && cell(index)) return cell(index);
    }
    return "";
  };
  const titleIndex = lower.findIndex((name) => TITLE_COLUMNS.includes(name));
  const title = pick(TITLE_COLUMNS) || row.map((value) => str(value).trim()).find(Boolean) || "";
  const tags = normalizeTags(pick(TAG_COLUMNS));
  const created = isoFrom(pick(DATE_COLUMNS));
  const used = new Set([titleIndex, lower.indexOf("tags"), lower.indexOf("tag"), lower.indexOf("labels"), lower.findIndex((name) => DATE_COLUMNS.includes(name))]);
  const sections = [];
  columns.forEach((column, index) => {
    if (used.has(index) || NOT_TITLE_COLUMNS.has(lower[index])) return;
    const value = cell(index);
    if (!value) return;
    sections.push(`## ${str(column).trim()}\n${value}`);
  });
  return {
    title: cleanTitle(title, "Untitled record"),
    body: clampBody(sections.join("\n\n")),
    tags,
    created,
    service,
    url: pick(["url", "link"]),
  };
}

function parseDatabaseCsv(text, service) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { records: [], error: "That CSV export has no data rows: it needs a header row and at least one record." };
  }
  const columns = rows[0];
  const records = [];
  for (const row of rows.slice(1)) {
    if (records.length >= MAX_NOTES) break;
    records.push(recordFromRow(row, columns, service));
  }
  if (!records.length) return { records: [], error: "That CSV export contains no records." };
  return { records, skipped: 0, total: records.length };
}

/* ---------------------------------------------------------------- Airtable */

function parseAirtableJson(text) {
  let data;
  try {
    data = JSON.parse(str(text));
  } catch (e) {
    return { records: [], error: "That Airtable export is not valid JSON." };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data && data.records) ? data.records : null;
  if (!list) return { records: [], error: "That Airtable JSON is not a list of records." };
  const records = [];
  for (const entry of list) {
    if (records.length >= MAX_NOTES) break;
    const fields = entry && typeof entry === "object" ? entry.fields || entry : {};
    const lower = Object.keys(fields).reduce((map, key) => ({ ...map, [key.toLowerCase()]: fields[key] }), {});
    const pick = (names) => {
      for (const name of names) {
        const value = lower[name];
        if (Array.isArray(value) ? value.length : str(value).trim()) return Array.isArray(value) ? value.join(", ") : str(value).trim();
      }
      return "";
    };
    const title = pick(TITLE_COLUMNS) || str(entry && entry.id).trim();
    const tags = normalizeTags(pick(TAG_COLUMNS));
    const created = isoFrom(pick(DATE_COLUMNS) || str(entry && entry.createdTime));
    const sections = Object.keys(fields)
      .filter((key) => !TITLE_COLUMNS.includes(key.toLowerCase()) && !TAG_COLUMNS.includes(key.toLowerCase()) && !DATE_COLUMNS.includes(key.toLowerCase()) && key.toLowerCase() !== "id")
      .map((key) => {
        const value = fields[key];
        const text = Array.isArray(value) ? value.join(", ") : str(value).trim();
        return text ? `## ${key}\n${text}` : "";
      })
      .filter(Boolean);
    records.push({
      title: cleanTitle(title, "Untitled record"),
      body: clampBody(sections.join("\n\n")),
      tags,
      created,
      service: "Airtable",
      url: pick(["url", "link"]),
    });
  }
  if (!records.length) return { records: [], error: "That Airtable export contains no records." };
  return { records, skipped: 0, total: records.length };
}

/* ---------------------------------------------------------------- Notion */

function parseNotionMarkdown(text, filename) {
  const source = str(text).replace(/\r\n?/g, "\n");
  const heading = /^(#{1,3})[ \t]+(.+)$/m.exec(source);
  const title = heading ? heading[2].trim() : str(filename).replace(/\.md$/i, "");
  const lines = source.split("\n");
  const body = heading ? lines.slice(lines.indexOf(heading[0]) + 1).join("\n") : source;
  const tagLine = /^[ \t]*tags?[ \t]*:[ \t]*(.+)$/im.exec(body);
  const tags = tagLine ? normalizeTags(tagLine[1]) : normalizeTags((source.match(/(^|\s)#([A-Za-z0-9/_-]+)/g) || []).map((entry) => entry.trim()));
  const cleaned = clampBody(body.replace(/^[ \t]*tags?[ \t]*:.*$/im, ""));
  return {
    records: [{ title: cleanTitle(title, titleFromBody(cleaned)), body: cleaned, tags, created: "", service: "Notion", url: "" }],
    skipped: 0,
    total: 1,
  };
}

/* ---------------------------------------------------------------- Bear */

function parseBearMarkdown(text, filename) {
  const source = str(text).replace(/\r\n?/g, "\n");
  const heading = /^#[ \t]+(.+)$/m.exec(source);
  if (!heading) return { records: [], error: "That file is not a Bear Markdown export: it has no \"# Title\" line." };
  const firstLine = heading[1];
  const tagPattern = /(^|\s)#([A-Za-z][A-Za-z0-9/_-]*)/g;
  const tags = [];
  for (const match of firstLine.matchAll(tagPattern)) tags.push(match[2]);
  const title = firstLine.replace(tagPattern, "$1").trim();
  const body = (heading ? source.slice(source.indexOf(heading[0]) + heading[0].length) : source)
    .replace(tagPattern, "$1")
    .replace(/[ \t]+$/gm, "");
  return {
    records: [
      {
        title: cleanTitle(title, str(filename).replace(/\.md$/i, "") || "Untitled note"),
        body: clampBody(body),
        tags: normalizeTags(tags),
        created: "",
        service: "Bear",
        url: "",
      },
    ],
    skipped: 0,
    total: 1,
  };
}

/* ---------------------------------------------------------------- Roam */

function roamText(blocks, depth) {
  const lines = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const text = str(block && block.string).trim();
    if (text) lines.push(`${"  ".repeat(depth || 0)}- ${text}`);
    if (block && Array.isArray(block.children) && block.children.length) {
      const inner = roamText(block.children, (depth || 0) + 1);
      if (inner) lines.push(inner);
    }
  }
  return lines.join("\n");
}

function parseRoamJson(text) {
  let data;
  try {
    data = JSON.parse(str(text));
  } catch (e) {
    return { records: [], error: "That Roam export is not valid JSON." };
  }
  const list = Array.isArray(data) ? data : Array.isArray(data && data.pages) ? data.pages : null;
  if (!list) return { records: [], error: "That Roam JSON is not a list of pages." };
  const records = [];
  for (const page of list) {
    if (records.length >= MAX_NOTES) break;
    if (!page || typeof page !== "object") continue;
    const title = cleanTitle(page.title, titleFromBody(roamText(page.children, 0)));
    const body = roamText(page.children, 0);
    const tagTokens = [];
    for (const line of [str(page.title), body]) {
      for (const match of line.matchAll(/#\[\[([^\]\n]+)\]\]|#([A-Za-z][A-Za-z0-9/_-]*)/g)) tagTokens.push(match[1] || match[2]);
    }
    const tags = normalizeTags(tagTokens);
    const created = isoFromEpoch(page["create-time"]);
    if (!title && !body) continue;
    records.push({ title, body: clampBody(body), tags, created, service: "Roam", url: "" });
  }
  if (!records.length) return { records: [], error: "That Roam export contains no pages." };
  return { records, skipped: 0, total: records.length };
}

/* ---------------------------------------------------------------- detection */

/**
 * Which service made this export. `filename` is a hint; content decides, so a file
 * renamed to `.txt` still imports. Returns `{ ok, kind, service, label }` or
 * `{ ok: false, error }` for an unsupported or binary bundle.
 */
function detectServiceExport(text, filename) {
  const name = str(filename);
  const lower = name.toLowerCase();
  const source = str(text).replace(/^\uFEFF/, "").trim();
  if (/\.textbundle$/i.test(lower) || /\.textpack$/i.test(lower)) {
    return {
      ok: false,
      error: "Bear's .textbundle/.textpack bundles are not imported: they hold attachments and binary resources this importer does not copy. Export the notes as Markdown instead.",
    };
  }
  if (/\.enex$/i.test(lower) || /<en-export[\s>]/i.test(source)) return { ok: true, kind: "evernote", service: "Evernote", label: "Evernote" };
  if (/<div[^>]*class="[^"]*\bcontent\b/i.test(source) && /<html[\s>]/i.test(source)) return { ok: true, kind: "keep", service: "Google Keep", label: "Google Keep" };
  if (/^[[{]/.test(source)) {
    try {
      const data = JSON.parse(source);
      const list = Array.isArray(data) ? data : null;
      if (list && list.some((entry) => entry && ("textContent" in entry || "listContent" in entry || "createdTimestampUsec" in entry))) {
        return { ok: true, kind: "keep", service: "Google Keep", label: "Google Keep" };
      }
      if (list && list.some((entry) => entry && ("create-time" in entry || "children" in entry))) {
        return { ok: true, kind: "roam", service: "Roam", label: "Roam" };
      }
      if (data && Array.isArray(data.records)) return { ok: true, kind: "airtable", service: "Airtable", label: "Airtable" };
    } catch (e) {
      return { ok: false, error: "That file starts like JSON but cannot be read as JSON." };
    }
  }
  const sniff = source.replace(/\r\n?/g, "\n");
  if (/\.csv$/i.test(lower) || (/^[^,\n]+,[^\n]*\n/.test(sniff) && sniff.includes("\n") && !/^#/.test(sniff))) {
    return { ok: true, kind: "database", service: "Airtable or Notion CSV", label: "Airtable or Notion CSV" };
  }
  if (/\.md$/i.test(lower) || /^#{1,3}[ \t]+\S/m.test(source)) {
    if (/(^|\s)#[A-Za-z][A-Za-z0-9/_-]*/.test(source) && !/^[ \t]*tags?[ \t]*:/im.test(source)) {
      return { ok: true, kind: "bear", service: "Bear", label: "Bear" };
    }
    return { ok: true, kind: "notion", service: "Notion", label: "Notion" };
  }
  if (/<html[\s>]/i.test(source)) return { ok: false, error: "That HTML page is not a Google Keep Takeout note (no note content container)." };
  return { ok: false, error: "That export is not one of the supported formats (Evernote .enex, Google Keep JSON/HTML, Airtable JSON/CSV, Notion CSV/Markdown, Bear Markdown, Roam JSON)." };
}

/** Parses an export of a known kind. Returns `{ ok, records, total, skipped, error }`. */
function parseServiceExport(text, options) {
  const settings = options && typeof options === "object" ? options : {};
  const kind = str(settings.kind) || detectServiceExport(text, settings.filename).kind;
  const filename = str(settings.filename);
  if (!str(text).trim()) return { ok: false, kind, records: [], total: 0, error: "That export is empty." };
  let parsed;
  if (kind === "evernote") parsed = parseEvernote(text);
  else if (kind === "keep") parsed = /^\s*[[{]/.test(text) ? parseKeepJson(text) : parseKeepHtml(text);
  else if (kind === "airtable") parsed = /^\s*[[{]/.test(text) ? parseAirtableJson(text) : parseDatabaseCsv(text, "Airtable");
  else if (kind === "roam") parsed = parseRoamJson(text);
  else if (kind === "bear") parsed = parseBearMarkdown(text, filename);
  else if (kind === "notion") parsed = /\.csv$/i.test(filename) || !/^#{1,3}[ \t]+\S/m.test(text) ? parseDatabaseCsv(text, "Notion") : parseNotionMarkdown(text, filename);
  else if (kind === "database") parsed = parseDatabaseCsv(text, "Airtable or Notion CSV");
  else parsed = { records: [], error: detectServiceExport(text, filename).error || "That export format is not supported." };
  if (parsed.error) return { ok: false, kind, records: [], total: 0, error: parsed.error };
  if (!parsed.records.length) return { ok: false, kind, records: [], total: 0, error: "That export contains no notes." };
  return { ok: true, kind, service: serviceOf(kind), records: parsed.records, total: parsed.total || parsed.records.length, skipped: parsed.skipped || 0 };
}

/* ---------------------------------------------------------------- notes */

function yamlString(value) {
  return JSON.stringify(str(value));
}

/** The note for one record: frontmatter, a title heading and the exported body. */
function recordMarkdown(record) {
  const entry = record && typeof record === "object" ? record : {};
  const title = cleanTitle(entry.title);
  const tags = normalizeTags(entry.tags);
  const lines = ["---", `title: ${yamlString(title)}`];
  if (str(entry.created).trim()) lines.push(`created: ${yamlString(str(entry.created).trim())}`);
  if (str(entry.url).trim()) lines.push(`source_url: ${yamlString(str(entry.url).trim())}`);
  lines.push(`imported_from: ${yamlString(str(entry.service) || "Export")}`);
  if (tags.length) {
    lines.push("tags:");
    for (const tag of tags) lines.push(`  - ${tag}`);
  }
  lines.push("---", "", `# ${title}`, "");
  const body = clampBody(entry.body);
  if (body) lines.push(body, "");
  return lines.join("\n").replace(/\n{3,}$/, "\n\n");
}

/** A vault-safe file name: no reserved characters, bounded, never empty. */
function noteFileName(title) {
  const base = str(title)
    .replace(/[\\/:*?"<>|#[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || "Untitled note"}.md`;
}

/** `Folder/Title.md`, then `Folder/Title (2).md` … when the name is taken. */
function uniqueNotePath(folder, title, taken) {
  const dir = str(folder).replace(/\/+$/, "");
  const name = noteFileName(title).replace(/\.md$/i, "");
  const used = taken instanceof Set ? taken : new Set(taken || []);
  let path = dir ? `${dir}/${name}.md` : `${name}.md`;
  let n = 2;
  while (used.has(path)) {
    path = dir ? `${dir}/${name} (${n}).md` : `${name} (${n}).md`;
    n += 1;
  }
  return path;
}

module.exports = {
  MAX_BODY,
  MAX_NOTES,
  MAX_TAGS,
  SERVICES,
  detectServiceExport,
  htmlToText,
  isoFrom,
  isoFromEpoch,
  normalizeTags,
  noteFileName,
  parseAirtableJson,
  parseBearMarkdown,
  parseCsv,
  parseDatabaseCsv,
  parseEvernote,
  parseKeepHtml,
  parseKeepJson,
  parseNotionMarkdown,
  parseRoamJson,
  parseServiceExport,
  recordMarkdown,
  uniqueNotePath,
};
