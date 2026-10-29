"use strict";
/*
 * Rule-based card extraction. This is deliberately small and deterministic:
 * it reads Markdown headings, definition lines, two-column tables and cloze
 * marks, and never calls an AI provider. The caller previews the result before
 * writing anything.
 */
const { hashString, localDate, str } = require("./util");

const FRONT_HEADS = ["question", "front", "prompt", "term", "word"];
const BACK_HEADS = ["answer", "back", "definition", "meaning", "explanation", "solution"];
const FRONT_COLS = ["front", "term", "word", "question", "prompt"];
const BACK_COLS = ["back", "definition", "meaning", "answer", "explanation"];
const SKIP_LABELS = new Set([
  "answer",
  "chapter",
  "date",
  "example",
  "figure",
  "homework",
  "important",
  "lesson",
  "link",
  "note",
  "page",
  "reading",
  "section",
  "source",
  "table",
  "time",
  "tip",
  "unit",
  "url",
  "warning",
]);
const CLOZE_RE = /==([^=\n]+)==|\{\{c?(\d*)::([\s\S]*?)\}\}/g;
const MAX_FRONT = 240;
const MAX_BACK = 1200;
const MAX_CARDS = 200;

function cleanInline(value) {
  return str(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBody(text) {
  return str(text)
    .replace(/\r\n?/g, "\n")
    .replace(/^---\n[\s\S]*?\n---\n?/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "");
}

function heading(text) {
  return cleanInline(text).toLowerCase().replace(/:\s*$/, "").trim();
}

/** A heading section can run into the next topic; its first paragraph is the answer, not the rest of the lecture. */
function firstParagraph(value) {
  const blocks = str(value).split(/\n\s*\n/).map((block) => cleanInline(block)).filter(Boolean);
  return blocks[0] || "";
}

function isSeparator(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(str(cell).trim()));
}

function tableCells(line) {
  const raw = str(line).trim();
  if (!raw.startsWith("|") || !raw.endsWith("|")) return null;
  return raw
    .slice(1, -1)
    .split("|")
    .map((cell) => cleanInline(cell));
}

function columnIndex(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    if (names.includes(heading(headers[i]))) return i;
  }
  return -1;
}

/** true/false when a note explicitly opts in or out of automatic card extraction. */
function flashcardsFlag(fm) {
  const raw = fm ? fm.flashcards : undefined;
  if (raw === undefined || raw === null || raw === "") return null;
  if (raw === false || raw === 0) return false;
  if (raw === true || raw === 1) return true;
  const value = str(raw).trim().toLowerCase();
  if (["false", "no", "off", "0", "never"].includes(value)) return false;
  if (["true", "yes", "on", "1", "auto"].includes(value)) return true;
  return null;
}

/**
 * Extract cards from one Markdown note. Returns { cards, skipped, warnings }.
 * `options.deck` and `options.course` are copied onto every card; the plugin
 * fills in defaults and stamps import metadata when it writes them.
 */
function extractCardsFromMarkdown(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Note");
  const deck = str(opts.deck).trim() || "Imported";
  const course = str(opts.course).trim();
  const tags = Array.isArray(opts.tags) ? opts.tags.map((tag) => str(tag).replace(/^#/, "").trim()).filter(Boolean) : [];
  const body = cleanBody(text);
  const cards = [];
  const warnings = [];
  const seen = new Set();
  let skipped = 0;

  const add = (front, back, cardType, origin) => {
    const f = cleanInline(front).replace(/^[-*+]\s+/, "").trim();
    const b = cleanInline(back).replace(/^[-*+]\s+/, "").trim();
    if (!f || !b) {
      skipped++;
      return;
    }
    if (f.length < 2 || b.length < 2 || f.length > MAX_FRONT || b.length > MAX_BACK) {
      skipped++;
      return;
    }
    const key = `${f.toLowerCase()}\u0000${b.toLowerCase()}\u0000${cardType}`;
    if (seen.has(key) || cards.length >= MAX_CARDS) {
      skipped++;
      return;
    }
    seen.add(key);
    cards.push({
      kind: "card",
      cardType,
      deck,
      course,
      front: f,
      back: b,
      tags,
      importSource: source,
      importFormat: "outline",
      importedOn: opts.importedOn || localDate(),
      importKey: `outline:${hashString(source + "|" + key)}`,
      extractOrigin: origin || "",
    });
  };

  const lines = body.split("\n");
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) {
      current = { level: m[1].length, title: heading(m[2]), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  // 1. Front/back or question/answer headings, including Term/Definition.
  let pendingFront = "";
  for (const section of sections) {
    const bodyText = firstParagraph(section.lines.join("\n"));
    if (!bodyText) continue;
    if (FRONT_HEADS.includes(section.title)) {
      pendingFront = bodyText;
    } else if (BACK_HEADS.includes(section.title) && pendingFront) {
      add(pendingFront, bodyText, "basic", "heading");
      pendingFront = "";
    }
  }

  // 2. Definition lines and "X means Y" sentences.
  const meansRe = /\b([A-Z][A-Za-z0-9'’\- ]{1,60})\s+(?:means|refers to|is defined as)\s+([^.!?\n]{2,300})/g;
  for (const line of lines) {
    if (/^\s*(?:#{1,6}\s|\||>|```|~~~)/.test(line)) continue;
    const bullet = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/);
    const content = cleanInline(bullet ? bullet[1] : line);
    if (!content || /==|\{\{c?\d*::/.test(content)) continue;
    const pair = content.match(/^(.{2,80}?)\s*(?::|—|–|\s+means\s+|\s+refers to\s+|\s+is defined as\s+)\s*(.{2,500})$/i);
    if (pair) {
      const front = cleanInline(pair[1]);
      const back = cleanInline(pair[2]);
      const label = front.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      const words = front.split(/\s+/).filter(Boolean).length;
      if (!SKIP_LABELS.has(label) && words <= 10 && !/https?:|www\./i.test(front)) {
        add(front, back, "basic", "definition");
      }
    }
    for (const match of content.matchAll(meansRe)) add(match[1], match[2], "basic", "sentence");
  }

  // 3. Two-column tables. A header such as Term/Definition is honoured; a
  // plain two-column table is read as front/back from its first row.
  for (let i = 0; i < lines.length; i++) {
    if (!tableCells(lines[i])) continue;
    const rows = [];
    while (i < lines.length) {
      const cells = tableCells(lines[i]);
      if (!cells) break;
      rows.push(cells);
      i++;
    }
    if (rows.length < 2) continue;
    const headers = rows[0];
    const frontCol = columnIndex(headers, FRONT_COLS);
    const backCol = columnIndex(headers, BACK_COLS);
    const knownHeader = frontCol >= 0 && backCol >= 0;
    if (knownHeader) {
      const start = rows[1] && isSeparator(rows[1]) ? 2 : 1;
      for (const row of rows.slice(start)) {
        if (isSeparator(row)) continue;
        add(row[frontCol], row[backCol], "basic", "table");
      }
    } else if (headers.length === 2) {
      for (const row of rows) {
        if (isSeparator(row)) continue;
        add(row[0], row[1], "basic", "table");
      }
    }
  }

  // 4. Existing highlights and cloze marks, one card per marked line.
  for (const line of lines) {
    if (/^\s*(?:#{1,6}\s|\||```|~~~)/.test(line)) continue;
    if (!/==|{{c?\d*::/.test(line)) continue;
    const answers = [];
    const prompt = str(line)
      .replace(CLOZE_RE, (_match, highlighted, _number, marked) => {
        const answer = cleanInline(highlighted || marked);
        if (answer) answers.push(answer);
        return "[…]";
      })
      .trim();
    if (!answers.length) continue;
    const cleaned = cleanInline(prompt);
    if (!cleaned || cleaned === "[…]") continue;
    add(cleaned, answers.join(" · "), "cloze", "cloze");
  }

  if (!cards.length && !warnings.length) warnings.push("No card-like headings, definitions, tables or cloze marks were found.");
  return { cards, skipped, warnings, source };
}

module.exports = {
  FRONT_HEADS,
  BACK_HEADS,
  FRONT_COLS,
  BACK_COLS,
  MAX_CARDS,
  cleanInline,
  cleanBody,
  flashcardsFlag,
  extractCardsFromMarkdown,
};
