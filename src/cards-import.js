"use strict";
/*
 * Importers for existing decks.
 *
 * - Spaced Repetition: Q::A, Q:::A (reversed), multi-line ? / ??, ==cloze==,
 *   {{c1::cloze}} and #flashcards/deck tags.
 * - Anki: the plain-text/CSV export, including its #separator/#html/#deck
 *   column headers. The separate .apkg reader reads only the collection's
 *   notes/cards tables and never executes SQL or extracts archive paths.
 * - Quizlet: the copied text/CSV export, with tab, comma, dash, newline and
 *   semicolon layouts auto-detected.
 */
const { Modal, Notice } = require("obsidian");
const { hashString, localDate, str } = require("./util");
const { parseCloze } = require("./cards");

const IMPORT_TYPES = ["spaced", "mochi", "crowdanki", "anki", "apkg", "quizlet", "gift", "moodlexml", "qti", "flashquiz", "quizport", "mdquiz", "kahoot", "blooket", "gimkit", "csv"];
const QUESTION_SET_TYPES = ["kahoot", "blooket", "gimkit"];

function stripFrontmatter(text) {
  return str(text).replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n?/, "");
}

function stripCodeFences(text) {
  return str(text).replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
}

function decodeEntities(text) {
  return str(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'");
}

/** A small, predictable HTML-to-Markdown pass for Anki exports. */
function htmlToMarkdown(html, enabled) {
  if (!enabled) return str(html).trim();
  let text = str(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<(b|strong)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(i|em)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text).replace(/\n{3,}/g, "\n\n").trim();
}

function splitDelimited(text, sep) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const s = str(text).replace(/\r\n/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ---- question sets (Kahoot, Blooket, Gimkit) */

function questionSetDelimiter(text) {
  const line = str(text).replace(/^\uFEFF/, "").split(/\r?\n/).find((row) => row.trim()) || "";
  if (line.includes("\t")) return "\t";
  if (line.includes(",")) return ",";
  if (line.includes(";")) return ";";
  return ",";
}

/** Fold a header to a stable key: "Correct answer(s)" and "Correct Answer" both become "correct answer". */
function questionSetHeaderKey(value) {
  return str(value)
    .replace(/^\uFEFF/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/#/g, " number ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:seconds?|secs?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeader(headers, names) {
  for (const name of names) {
    const at = headers.indexOf(name);
    if (at >= 0) return at;
  }
  return -1;
}

function cleanQuestionSetField(value) {
  let s = str(value).replace(/\u00a0/g, " ").trim();
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    s = s.slice(1, -1).replace(/""/g, '"').trim();
  }
  return decodeEntities(s).trim();
}

/** Read a correct-answer cell as 1-based option numbers, or return null when it is answer text. */
function correctIndexes(value, count) {
  const s = str(value).trim();
  if (!s) return null;
  const parts = s
    .replace(/\band\b/gi, ",")
    .split(/\s*[,;/+&]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length || !parts.every((part) => /^\d+$/.test(part))) return null;
  const out = [...new Set(parts.map((part) => Number(part)))].filter((n) => n >= 1 && n <= count);
  return out.length ? out : null;
}

/**
 * Parse a Kahoot, Blooket or Gimkit CSV export. The column names are matched
 * case-insensitively and accept the variants used by each platform's template.
 * A card keeps the original choices and correct indexes in frontmatter, so the
 * set can be exported back to any of the supported formats without guessing.
 */
function parseQuestionSetText(text, options) {
  const opts = options || {};
  const format = str(opts.format).toLowerCase();
  if (!QUESTION_SET_TYPES.includes(format)) throw new Error(`Unsupported question-set format: ${format || "none"}.`);
  const source = str(opts.sourcePath || `${format} export`);
  const deck = str(opts.deck).trim() || "Imported";
  const body = str(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const cards = [];
  const errors = [];
  const skippedDetails = [];
  if (!body) return { cards, skipped: 0, errors, source, format, skippedDetails };

  const rows = splitDelimited(body, questionSetDelimiter(body));
  if (rows.length < 2) return { cards, skipped: 0, errors: ["No question rows were found."], source, format, skippedDetails };
  const headers = rows[0].map(questionSetHeaderKey);
  const questionAt = findHeader(headers, ["question", "question text", "prompt", "term"]);
  if (questionAt < 0) return { cards, skipped: 0, errors: ["No Question column was found."], source, format, skippedDetails };

  const choiceColumns = [];
  for (let n = 1; n <= 8; n++) {
    const at = findHeader(headers, [`answer ${n}`, `option ${n}`, `choice ${n}`]);
    if (at >= 0) choiceColumns.push(at);
  }
  const incorrectColumns = [];
  for (let n = 1; n <= 8; n++) {
    const at = findHeader(headers, [`incorrect answer ${n}`, `wrong answer ${n}`, `incorrect ${n}`]);
    if (at >= 0) incorrectColumns.push(at);
  }
  const correctAt = findHeader(headers, ["correct answer", "correct answers", "correct choice", "correct", "definition"]);
  const timeAt = findHeader(headers, ["time limit", "time"]);
  if (correctAt < 0 && !incorrectColumns.length) {
    return { cards, skipped: 0, errors: ["No correct-answer column was found."], source, format, skippedDetails };
  }

  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.some((cell) => cleanQuestionSetField(cell))) continue;
    const question = cleanQuestionSetField(row[questionAt]);
    if (!question) {
      skipped++;
      skippedDetails.push({ row: r + 1, reason: "No question text" });
      continue;
    }
    const choices = choiceColumns.map((at) => cleanQuestionSetField(row[at])).filter(Boolean);
    const incorrect = incorrectColumns.map((at) => cleanQuestionSetField(row[at])).filter(Boolean);
    const correctRaw = correctAt >= 0 ? cleanQuestionSetField(row[correctAt]) : "";
    let selected = [];

    if (choices.length) {
      const byNumber = correctIndexes(correctRaw, choices.length);
      if (byNumber) {
        selected = byNumber;
      } else if (correctRaw) {
        const parts = correctRaw.split(/\s*\|\s*/).filter(Boolean);
        const matches = parts.map((part) => choices.findIndex((choice) => choice.toLowerCase() === part.toLowerCase()));
        if (matches.length && matches.every((at) => at >= 0)) {
          selected = [...new Set(matches.map((at) => at + 1))];
        } else {
          choices.push(correctRaw);
          selected = [choices.length];
        }
      }
      for (const value of incorrect) if (!choices.includes(value)) choices.push(value);
    } else if (correctRaw) {
      choices.push(correctRaw);
      selected = [1];
      for (const value of incorrect) if (!choices.includes(value)) choices.push(value);
    }

    const answers = selected.map((at) => choices[at - 1]).filter(Boolean);
    if (!answers.length) {
      skipped++;
      skippedDetails.push({ row: r + 1, reason: "No usable correct answer" });
      errors.push(`${source}: row ${r + 1} has no usable correct answer.`);
      continue;
    }
    const time = timeAt >= 0 ? Math.round(Number(cleanQuestionSetField(row[timeAt]))) : 0;
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front: question,
      back: answers.join(" · "),
      notes: choices.length > 1 ? `Choices: ${choices.map((choice, i) => `${String.fromCharCode(65 + i)}. ${choice}`).join("; ")}` : "",
      tags: [],
      questionSet: format,
      choices,
      correctChoices: selected.join(","),
      timeLimit: Number.isFinite(time) && time > 0 ? time : 0,
      importSource: source,
      importKey: `${format}:${hashString(source + "|" + r + "|" + question + "|" + choices.join("\u0001") + "|" + selected.join(","))}`,
    });
  }
  return { cards, skipped, errors, source, format, skippedDetails };
}

/* ---- generic CSV / TSV */

const GENERIC_FIELDS = [
  ["front", ["front", "term", "question", "prompt", "word", "concept", "key"]],
  ["back", ["back", "definition", "answer", "meaning", "translation", "correct answer"]],
  ["deck", ["deck", "set", "topic", "category", "folder"]],
  ["course", ["course", "class", "subject"]],
  ["tags", ["tags", "tag"]],
  ["notes", ["notes", "note", "hint", "extra", "explanation"]],
  ["type", ["type", "card type", "kind"]],
];

const GENERIC_LABELS = {
  front: "Front / term / question",
  back: "Back / definition / answer",
  deck: "Deck",
  course: "Course",
  tags: "Tags",
  notes: "Notes",
  type: "Card type",
};

/** Pick the separator from the first non-empty row. */
function genericDelimiter(text) {
  const line = str(text).replace(/^\uFEFF/, "").split(/\r?\n/).find((row) => row.trim()) || "";
  const candidates = [
    ["\t", (line.match(/\t/g) || []).length],
    [",", (line.match(/,/g) || []).length],
    [";", (line.match(/;/g) || []).length],
    ["|", (line.match(/\|/g) || []).length],
  ].sort((a, b) => b[1] - a[1]);
  return candidates[0][1] ? candidates[0][0] : ",";
}

function genericHeaderKey(headers, hasHeader, delimiter) {
  return hashString([hasHeader ? "header" : "no-header", delimiter || "", ...(headers || []).map((h) => questionSetHeaderKey(h))].join("|"));
}

function genericLooksLikeHeader(row) {
  const keys = (row || []).map(questionSetHeaderKey);
  return GENERIC_FIELDS.some(([, aliases]) => keys.some((key) => aliases.includes(key)));
}

function detectGenericMapping(headers) {
  const keys = (headers || []).map(questionSetHeaderKey);
  const used = new Set();
  const mapping = {};
  for (const [field, aliases] of GENERIC_FIELDS) {
    let at = -1;
    for (let i = 0; i < keys.length; i++) {
      if (!used.has(i) && aliases.includes(keys[i])) {
        at = i;
        break;
      }
    }
    mapping[field] = at;
    if (at >= 0) used.add(at);
  }
  return mapping;
}

function normalizeGenericMapping(mapping, count) {
  const out = {};
  for (const [field] of GENERIC_FIELDS) {
    const raw = mapping ? mapping[field] : undefined;
    const n = raw === undefined || raw === null || raw === "" ? NaN : Number(raw);
    out[field] = Number.isInteger(n) && n >= 0 && n < count ? n : -1;
  }
  return out;
}

function genericCell(value) {
  return cleanQuestionSetField(value);
}

function genericTags(value) {
  return str(value)
    .split(/\s*[,;|]\s*/)
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean);
}

function genericCardType(value, front) {
  const type = str(value).trim().toLowerCase();
  if (/revers|back.?front/.test(type)) return "reversed";
  if (/cloze|fill/.test(type) || /==[^=]+==|\{\{c\d+::/.test(str(front))) return "cloze";
  return "basic";
}

/**
 * Parse a generic CSV/TSV table. Headers are detected from common names, but
 * the caller can pass `mapping` indexes from a saved preset or the mapping UI.
 * The first row is treated as a header when it contains a known column name;
 * otherwise the first two columns are used as front and back.
 */
function parseGenericCsv(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "CSV import");
  const fallbackDeck = str(opts.deck).trim() || "Imported";
  const body = str(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const delimiter = opts.delimiter || genericDelimiter(body);
  const rows = splitDelimited(body, delimiter).filter((row) => row.some((cell) => genericCell(cell)));
  if (!rows.length) {
    return {
      cards: [],
      skipped: 0,
      errors: ["The file is empty."],
      source,
      format: "csv",
      delimiter,
      headers: [],
      hasHeader: false,
      mapping: normalizeGenericMapping(null, 0),
      detected: normalizeGenericMapping(null, 0),
      headerKey: genericHeaderKey([], false, delimiter),
      preview: [],
      skippedDetails: [],
    };
  }

  const width = Math.max(...rows.map((row) => row.length));
  const autoHeader = genericLooksLikeHeader(rows[0]);
  const hasHeader = opts.hasHeader === undefined ? autoHeader : !!opts.hasHeader;
  const headers = hasHeader
    ? rows[0].map((cell, i) => genericCell(cell) || `Column ${i + 1}`).concat(Array.from({ length: Math.max(0, width - rows[0].length) }, (_, i) => `Column ${rows[0].length + i + 1}`))
    : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const detected = hasHeader
    ? detectGenericMapping(headers)
    : normalizeGenericMapping({ front: 0, back: width > 1 ? 1 : -1 }, width);
  const mapping = normalizeGenericMapping(opts.mapping === undefined ? detected : { ...detected, ...opts.mapping }, width);
  const headerKey = genericHeaderKey(headers, hasHeader, delimiter);
  const errors = [];
  const cards = [];
  const preview = [];
  const previewRow = (row, r) => ({
    row: r + (hasHeader ? 2 : 1),
    front: mapping.front >= 0 ? genericCell(row[mapping.front]) : "",
    back: mapping.back >= 0 ? genericCell(row[mapping.back]) : "",
    deck: mapping.deck >= 0 ? genericCell(row[mapping.deck]) : "",
    course: mapping.course >= 0 ? genericCell(row[mapping.course]) : "",
  });
  const sample = dataRows.slice(0, 5).map(previewRow);

  if (mapping.front < 0 || mapping.back < 0) {
    return {
      cards,
      skipped: 0,
      errors: ["Choose a Front column and a Back column before importing."],
      source,
      format: "csv",
      delimiter,
      headers,
      hasHeader,
      mapping,
      detected,
      headerKey,
      preview: sample,
      skippedDetails: [],
    };
  }

  let skipped = 0;
  const skippedDetails = [];
  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const front = genericCell(row[mapping.front]);
    const back = genericCell(row[mapping.back]);
    if (!front || !back) {
      const rowNumber = r + (hasHeader ? 2 : 1);
      skipped++;
      skippedDetails.push({ row: rowNumber, reason: "Needs both a front and a back" });
      errors.push(`${source}: row ${rowNumber} needs both a front and a back.`);
      continue;
    }
    const deck = (mapping.deck >= 0 ? genericCell(row[mapping.deck]) : "") || fallbackDeck;
    const course = mapping.course >= 0 ? genericCell(row[mapping.course]) : "";
    const notes = mapping.notes >= 0 ? genericCell(row[mapping.notes]) : "";
    const tags = mapping.tags >= 0 ? genericTags(row[mapping.tags]) : [];
    const cardType = genericCardType(mapping.type >= 0 ? row[mapping.type] : "", front);
    cards.push({
      kind: "card",
      cardType,
      deck,
      course,
      front,
      back,
      notes,
      tags,
      importSource: source,
      importFormat: "csv",
      importedOn: opts.importedOn || localDate(),
      importKey: `csv:${hashString(source + "|" + headerKey + "|" + front + "|" + back + "|" + deck)}`,
    });
  }
  return { cards, skipped, errors, source, format: "csv", delimiter, headers, hasHeader, mapping, detected, headerKey, preview: sample.length ? sample : dataRows.slice(0, 5).map(previewRow), skippedDetails };
}

function csvCell(value) {
  const s = str(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(cells) {
  return cells.map(csvCell).join(",");
}

function oneLine(value) {
  return str(value).replace(/\r?\n/g, " ").replace(/\t/g, " ").trim();
}

/** Read the card's own choices and correct indexes, falling back to a plain front/back card. */
function exportCardRow(card) {
  const fm = (card && card.fm) || {};
  const body = (card && card.body) || {};
  const raw = [];
  for (let n = 1; n <= 8; n++) {
    const value = str(fm[`choice_${n}`]).trim();
    if (value) raw.push(value);
  }
  if (!raw.length && Array.isArray(fm.choices)) {
    for (const value of fm.choices) if (str(value).trim()) raw.push(str(value).trim());
  }
  if (!raw.length) {
    const answer = str(body.back || fm.back || fm.answer).trim();
    if (answer) raw.push(answer);
  }
  const choices = raw.map(oneLine).filter(Boolean);
  const question = oneLine(body.front || fm.front || fm.question);
  const asked = correctIndexes(fm.correct_choices, choices.length) || (choices.length ? [1] : []);
  const time = Math.round(Number(fm.time_limit));
  return { question, choices, correct: asked, timeLimit: Number.isFinite(time) && time > 0 ? time : 20 };
}

/** Quizlet's text export: one term per line, a tab before the definition. */
function cardsToQuizlet(cards) {
  const rows = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    const row = exportCardRow(card);
    if (!row.question || !row.choices.length) continue;
    rows.push(`${oneLine(row.question)}\t${oneLine(row.choices[row.correct[0] - 1] || row.choices[0])}`);
  }
  return rows.length ? rows.join("\n") + "\n" : "";
}

/**
 * Anki plain text. The header names the notetype, deck and tag columns, so
 * File → Import rebuilds decks and tags instead of dumping every note into
 * one deck. Cloze cards keep their {{c1::…}} markers. Media stays in the
 * vault; the text export cannot carry images or audio.
 */
function cardsToAnki(cards) {
  const rows = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    const fm = (card && card.fm) || {};
    const body = (card && card.body) || {};
    const deck = oneLine(fm.deck) || "Imported";
    const tagSource = Array.isArray(fm.tags) ? fm.tags : str(fm.tags).split(/[,;]+|\s+/);
    const tags = tagSource
      .map((tag) => oneLine(tag).replace(/\s+/g, "_"))
      .filter(Boolean)
      .join(" ");
    const cloze = /cloze/i.test(str(fm.card_type)) || /cloze/i.test(str(body.cardType));
    const answers = str(body.back)
      .split(" · ")
      .map((answer) => oneLine(answer))
      .filter(Boolean);
    if (cloze && answers.length && str(body.front).includes("[…]")) {
      let next = 0;
      const field = oneLine(body.front).replace(/\[…\]/g, () => `{{c1::${answers[next++] || "…"}}}`);
      rows.push(["Cloze", deck, field, "", tags]);
      continue;
    }
    const row = exportCardRow(card);
    if (!row.question || !row.choices.length) continue;
    rows.push(["Basic", deck, row.question, oneLine(row.choices[row.correct[0] - 1] || row.choices[0]), tags]);
  }
  if (!rows.length) return "";
  const header = ["#separator:tab", "#html:false", "#notetype column:1", "#deck column:2", "#tags column:5"];
  return header.concat(rows.map((row) => row.join("\t"))).join("\n") + "\n";
}

/** CSV in the layout each platform's spreadsheet importer expects. */
function cardsToQuestionSet(format, cards) {
  const kind = str(format).toLowerCase();
  if (!QUESTION_SET_TYPES.includes(kind)) throw new Error(`Unsupported question-set format: ${format || "none"}.`);
  const rows = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    const row = exportCardRow(card);
    if (!row.question || !row.choices.length) continue;
    if (kind === "gimkit") {
      const correct = row.correct.map((at) => row.choices[at - 1]).filter(Boolean);
      const wrong = row.choices.filter((_, i) => !row.correct.includes(i + 1));
      rows.push(csvLine([row.question, correct.join(" / "), wrong[0] || "", wrong[1] || "", wrong[2] || ""]));
      continue;
    }
    const shown = row.choices.slice(0, 4);
    let selected = row.correct.filter((at) => at <= 4);
    if (!selected.length && row.correct.length) {
      shown[3] = row.choices[row.correct[0] - 1] || shown[3] || "";
      selected = [4];
    }
    const limit = kind === "kahoot" ? Math.min(240, Math.max(5, row.timeLimit)) : Math.min(300, Math.max(5, row.timeLimit));
    rows.push(csvLine([row.question, ...shown, ...Array(Math.max(0, 4 - shown.length)).fill(""), String(limit), selected.join(",")]));
  }
  if (!rows.length) return "";
  const header =
    kind === "kahoot"
      ? ["Question", "Answer 1", "Answer 2", "Answer 3", "Answer 4", "Time limit (seconds)", "Correct answer(s)"]
      : kind === "blooket"
        ? ["Question", "Answer 1", "Answer 2", "Answer 3", "Answer 4", "Time Limit (sec)", "Correct Answer(s)"]
        : ["Question", "Correct Answer", "Incorrect Answer 1", "Incorrect Answer 2", "Incorrect Answer 3"];
  return [csvLine(header), ...rows].join("\n") + "\n";
}

function questionSetExportHint(format) {
  const name = format === "kahoot" ? "Kahoot" : format === "blooket" ? "Blooket" : "Gimkit";
  if (format === "kahoot") {
    return "Kahoot: upload the CSV in the Kahoot creator; if it asks for .xlsx, open the CSV in Excel or Sheets and save it as .xlsx first. Kahoot accepts 4 answers and a 5–240 second limit.";
  }
  if (format === "blooket") return "Blooket: use CSV Import in the Set Creator, then upload this file. Blooket accepts 4 answers and a 5–300 second limit.";
  return `${name}: use Import from Spreadsheet in the kit editor and upload this CSV. Gimkit's multiple-choice template has one correct answer and three incorrect answers.`;
}

function separatorFor(value) {
  const v = str(value).trim().toLowerCase();
  if (v === "tab" || v === "\\t") return "\t";
  if (v === "comma") return ",";
  if (v === "semicolon") return ";";
  if (v === "pipe") return "|";
  return v || "\t";
}

function parseAnkiText(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Anki export");
  const defaultDeck = str(opts.deck).trim() || "Imported";
  const lines = str(text).replace(/\r\n/g, "\n").split("\n");
  const meta = { separator: separatorFor(opts.separator || "\t"), html: false, notetype: 0, deck: 0, tags: 0, guid: 0 };
  let start = 0;
  for (; start < lines.length; start++) {
    const line = lines[start];
    if (!line.startsWith("#")) break;
    const m = line.match(/^#([^:]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const value = m[2].trim();
    if (key === "separator") meta.separator = separatorFor(value);
    else if (key === "html") meta.html = /^true$/i.test(value);
    else if (key === "notetype column") meta.notetype = Math.max(0, parseInt(value, 10) || 0);
    else if (key === "deck column") meta.deck = Math.max(0, parseInt(value, 10) || 0);
    else if (key === "tags column") meta.tags = Math.max(0, parseInt(value, 10) || 0);
    else if (key === "guid column") meta.guid = Math.max(0, parseInt(value, 10) || 0);
  }
  const body = lines.slice(start).join("\n");
  const rows = splitDelimited(body, meta.separator);
  const cards = [];
  const skip = new Set([meta.notetype, meta.deck, meta.tags, meta.guid].filter(Boolean));
  for (const row of rows) {
    if (!row.length || !row.some((x) => str(x).trim())) continue;
    const fields = row.filter((_, i) => !skip.has(i + 1));
    if (!fields.length) continue;
    const deck = (meta.deck && str(row[meta.deck - 1]).trim()) || defaultDeck;
    const notetype = (meta.notetype && str(row[meta.notetype - 1]).trim()) || "";
    const tags = meta.tags ? str(row[meta.tags - 1]).trim().split(/\s+/).filter(Boolean) : [];
    let front = htmlToMarkdown(fields[0], meta.html);
    let back = htmlToMarkdown(fields[1] || "", meta.html);
    if (!front && !back) continue;
    let cardType = "basic";
    const type = notetype.toLowerCase();
    if (/cloze/.test(type)) {
      cardType = "cloze";
      back = parseCloze(front).answers.join(" · ");
    } else if (/revers/.test(type)) {
      cardType = "reversed";
    }
    if (!front) front = fields[1] || "";
    if (!front.trim() && !back.trim()) continue;
    cards.push({
      kind: "card",
      cardType,
      deck,
      front,
      back,
      tags,
      importSource: source,
      importKey: `anki:${hashString(source + "|" + row.join("\u0001") + "|" + cards.length)}`,
    });
  }
  return { cards, skipped: 0, source };
}

/* ---- Moodle GIFT */

function giftUnescape(value) {
  let out = "";
  const text = str(value);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && i + 1 < text.length) {
      out += text[i + 1];
      i++;
    } else {
      out += text[i];
    }
  }
  return out;
}

function giftUnescapedAt(text, index, char) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) slashes++;
  return slashes % 2 === 0;
}

function giftBraceBlock(text) {
  const open = [...text].findIndex((char, i) => char === "{" && giftUnescapedAt(text, i, "{"));
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (!giftUnescapedAt(text, i, text[i])) continue;
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return { question: text.slice(0, open), block: text.slice(open + 1, i), end: i };
    }
  }
  return null;
}

/** Correct answers only; wrong choices are useful in Moodle but not as a card back. */
function giftAnswers(block) {
  let text = str(block).split("####")[0].trim();
  if (!text) return [];
  if (/^(true|false|t|f)$/i.test(text)) return [{ correct: true, text: text.toUpperCase() }];
  if (text.startsWith("#")) {
    const numeric = /^#\s*([^:}]+)/.exec(text);
    return numeric ? [{ correct: true, text: giftUnescape(numeric[1]).trim() }] : [];
  }
  // Matching pairs (`=left -> right`) are not cards yet; skip them rather than guess.
  if (text.includes("->")) return [];

  const answers = [];
  let current = "";
  let correct = false;
  let marked = false;
  const push = () => {
    const value = htmlToMarkdown(giftUnescape(current), true).trim();
    if (marked && correct && value) answers.push({ correct, text: value });
    current = "";
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\\" && i + 1 < text.length) {
      current += char + text[i + 1];
      i++;
      continue;
    }
    if (char === "=" || char === "~") {
      push();
      correct = char === "=";
      marked = true;
      continue;
    }
    current += char;
  }
  push();
  return answers;
}

/**
 * Moodle GIFT: one question per blank-line-separated block, with an optional
 * `::name::` prefix and answers in braces. Supports multiple choice, true/false,
 * short answer and numeric answers. Matching questions are skipped explicitly.
 */
function parseGiftText(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Moodle GIFT file");
  const deck = str(opts.deck).trim() || "Imported";
  const body = str(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const cards = [];
  let skipped = 0;
  const blocks = body.split(/\n\s*\n+/);
  for (let index = 0; index < blocks.length; index++) {
    let block = blocks[index].replace(/^\s*\/\/.*$/gm, "").trim();
    if (!block) continue;
    let name = "";
    if (block.startsWith("::")) {
      const end = block.indexOf("::", 2);
      if (end > 0) {
        name = giftUnescape(block.slice(2, end)).trim();
        block = block.slice(end + 2).trim();
      }
    }
    const parsed = giftBraceBlock(block);
    if (!parsed) {
      skipped++;
      continue;
    }
    const front = htmlToMarkdown(giftUnescape(parsed.question), true).trim() || name;
    const answers = giftAnswers(parsed.block);
    if (!front || !answers.length) {
      skipped++;
      continue;
    }
    const back = answers.map((answer) => answer.text).join(" · ");
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front,
      back,
      tags: [],
      importSource: source,
      importKey: `gift:${hashString(source + "|" + index + "|" + front + "|" + back)}`,
    });
  }
  return { cards, skipped, errors: [], source };
}

/* ---- Moodle XML and QTI ---- */

function xmlAttr(attrs, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(str(attrs));
  if (!match) return "";
  return match[1] !== undefined ? match[1] : match[2];
}

function xmlSlice(value, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(str(value));
  return match ? match[1] : "";
}

function xmlClean(value) {
  const text = str(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return htmlToMarkdown(text, true);
}

function xmlTagText(value, tag) {
  const inner = xmlSlice(value, tag);
  return inner ? xmlClean(inner) : "";
}

/** Moodle XML: one <question> becomes one card, with correct <answer> blocks on the back. */
function parseMoodleXml(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Moodle XML quiz");
  const deck = str(opts.deck).trim() || "Imported";
  const body = str(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const cards = [];
  let skipped = 0;
  let index = 0;
  const questionRe = /<question\b([^>]*)>([\s\S]*?)<\/question>/gi;
  let question;
  while ((question = questionRe.exec(body))) {
    const type = xmlAttr(question[1], "type").toLowerCase();
    index++;
    if (["category", "description", "essay", "matching", "cloze"].includes(type)) {
      skipped++;
      continue;
    }
    const name = xmlTagText(question[2], "name");
    const front = xmlTagText(question[2], "questiontext") || name;
    const correct = [];
    const answerRe = /<answer\b([^>]*)>([\s\S]*?)<\/answer>/gi;
    let answer;
    while ((answer = answerRe.exec(question[2]))) {
      const answerText = xmlTagText(answer[2], "text") || xmlClean(answer[2]);
      if (!answerText) continue;
      const hasFraction = /\bfraction\s*=/.test(answer[1]);
      const fraction = Number(xmlAttr(answer[1], "fraction"));
      const isCorrect = hasFraction ? fraction > 0 : ["shortanswer", "numerical", "truefalse"].includes(type);
      if (isCorrect) correct.push(answerText);
    }
    if (!front || !correct.length) {
      skipped++;
      continue;
    }
    const back = [...new Set(correct)].join(" · ");
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front,
      back,
      tags: [],
      importSource: source,
      importKey: `moodle:${hashString(source + "|" + index + "|" + front + "|" + back)}`,
    });
  }
  return { cards, skipped, errors: [], source, format: "moodlexml" };
}

function qtiPrompt(block, fallback) {
  const prompt = xmlTagText(block, "qti-prompt") || xmlTagText(block, "prompt");
  if (prompt) return prompt;
  const beforeChoices = block.split(/<(?:response_lid|response_label|qti-simple-choice)\b/i)[0] || block;
  const materials = [...beforeChoices.matchAll(/<mattext\b[^>]*>([\s\S]*?)<\/mattext>/gi)];
  return materials.length ? xmlClean(materials[0][1]) : fallback;
}

function qtiChoices(block) {
  const choices = [];
  const add = (attrs, inner) => {
    const id = xmlAttr(attrs, "ident") || xmlAttr(attrs, "identifier");
    const text = xmlTagText(inner, "mattext") || xmlClean(inner);
    if (id && text) choices.push({ id, text });
  };
  let match;
  const labelRe = /<response_label\b([^>]*)>([\s\S]*?)<\/response_label>/gi;
  while ((match = labelRe.exec(block))) add(match[1], match[2]);
  const choiceRe = /<qti-simple-choice\b([^>]*)>([\s\S]*?)<\/qti-simple-choice>/gi;
  while ((match = choiceRe.exec(block))) add(match[1], match[2]);
  return choices;
}

function qtiCorrectIds(block) {
  const ids = [];
  let match;
  const equalRe = /<varequal\b[^>]*>([\s\S]*?)<\/varequal>/gi;
  while ((match = equalRe.exec(block))) ids.push(xmlClean(match[1]));
  const responseRe = /<qti-correct-response\b[^>]*>([\s\S]*?)<\/qti-correct-response>/gi;
  while ((match = responseRe.exec(block))) {
    const valueRe = /<qti-value\b[^>]*>([\s\S]*?)<\/qti-value>/gi;
    let value;
    while ((value = valueRe.exec(match[1]))) ids.push(xmlClean(value[1]));
  }
  return ids;
}

/** QTI 1.2 and QTI 2.1: match response identifiers to their visible choice text. */
function parseQtiXml(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "QTI quiz");
  const deck = str(opts.deck).trim() || "Imported";
  const body = str(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const cards = [];
  let skipped = 0;
  let index = 0;
  const itemRe = /<(item|assessmentItem|qti-assessment-item)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let item;
  while ((item = itemRe.exec(body))) {
    index++;
    const title = xmlAttr(item[2], "title") || xmlAttr(item[2], "identifier");
    const front = qtiPrompt(item[3], title);
    const choices = qtiChoices(item[3]);
    const correct = qtiCorrectIds(item[3])
      .map((id) => (choices.find((choice) => choice.id === id) || {}).text || id)
      .filter(Boolean);
    if (!front || !correct.length) {
      skipped++;
      continue;
    }
    const back = [...new Set(correct)].join(" · ");
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front,
      back,
      tags: [],
      importSource: source,
      importKey: `qti:${hashString(source + "|" + index + "|" + front + "|" + back)}`,
    });
  }
  return { cards, skipped, errors: [], source, format: "qti" };
}

function parseLmsXml(text, options) {
  const opts = options || {};
  const format = str(opts.format).toLowerCase();
  if (format === "qti") return parseQtiXml(text, opts);
  if (format === "moodlexml" || format === "moodle") return parseMoodleXml(text, opts);
  return /<questestinterop|<qti-assessment-item|<assessmentItem/i.test(str(text)) ? parseQtiXml(text, opts) : parseMoodleXml(text, opts);
}

/* ---- Mochi and CrowdAnki */

/** Mochi Markdown export: one file per card, with sides separated by --- or ***. */
function parseMochiMarkdown(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Mochi Markdown");
  const deck = str(opts.deck).trim() || "Imported";
  const body = stripFrontmatter(text).replace(/\r\n?/g, "\n");
  const parts = [];
  let current = [];
  for (const line of body.split("\n")) {
    if (/^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) {
      if (current.some((part) => part.trim())) parts.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.some((part) => part.trim())) parts.push(current.join("\n"));
  const sides = parts
    .map((part) => part.replace(/(^|\s)#card(?:\/[^\s#]+)?/gi, "$1").trim())
    .filter(Boolean);
  if (sides.length < 2) return { cards: [], skipped: 1, errors: [], source, format: "mochi" };
  const front = sides[0];
  const back = sides.slice(1).join("\n\n");
  return {
    cards: [
      {
        kind: "card",
        cardType: "basic",
        deck,
        front,
        back,
        tags: [],
        importSource: source,
        importKey: `mochi:${hashString(source + "|" + front + "|" + back)}`,
      },
    ],
    skipped: 0,
    errors: [],
    source,
    format: "mochi",
  };
}

function crowdAnkiFields(note) {
  const fields = note && note.fields;
  if (Array.isArray(fields)) return fields.map((field) => str(field));
  if (fields && typeof fields === "object") return Object.values(fields).map((field) => str(field));
  return [];
}

function crowdAnkiTags(note) {
  const tags = note && note.tags;
  if (Array.isArray(tags)) return tags.map((tag) => str(tag).trim()).filter(Boolean);
  return str(tags).split(/\s+/).map((tag) => tag.trim()).filter(Boolean);
}

/**
 * CrowdAnki JSON: decks nest through `children`, notes carry HTML fields and an
 * Anki model name. The first two fields become the card; extra fields are kept
 * on the back so a basic/cloze deck does not lose content silently.
 */
function parseCrowdAnkiJson(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "CrowdAnki JSON");
  const fallbackDeck = str(opts.deck).trim() || "Imported";
  let data;
  try {
    data = JSON.parse(str(text));
  } catch (e) {
    return { cards: [], skipped: 0, errors: ["That file is not valid CrowdAnki JSON."], source, format: "crowdanki" };
  }
  const cards = [];
  const errors = [];
  let skipped = 0;

  const walk = (node, path) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child, path);
      return;
    }
    if (typeof node !== "object") return;
    const name = str(node.name).trim();
    const next = name ? [...path, name] : path;
    const notes = Array.isArray(node.notes) ? node.notes : [];
    for (const note of notes) {
      const fields = crowdAnkiFields(note);
      if (!fields.length || !fields[0]) {
        skipped++;
        continue;
      }
      const model = str((note && (note.modelName || note.model)) || "").toLowerCase();
      let front = htmlToMarkdown(fields[0], true);
      let back = htmlToMarkdown(fields.slice(1).filter(Boolean).join("\n\n"), true);
      let cardType = "basic";
      if (/cloze/.test(model)) {
        const answers = parseCloze(front).answers;
        if (answers.length) {
          cardType = "cloze";
          back = answers.join(" · ");
        }
      } else if (/revers/.test(model)) {
        cardType = "reversed";
      }
      if (!front || !back) {
        skipped++;
        continue;
      }
      const deck = next.length ? next.join("::") : fallbackDeck;
      const guid = str(note && (note.guid || note.noteId)).trim();
      cards.push({
        kind: "card",
        cardType,
        deck,
        front,
        back,
        tags: crowdAnkiTags(note),
        importSource: source,
        importKey: `crowdanki:${guid || hashString(source + "|" + cards.length + "|" + front + "|" + back)}`,
      });
    }
    for (const child of Array.isArray(node.children) ? node.children : []) walk(child, next);
  };

  walk(data, []);
  return { cards, skipped, errors, source, format: "crowdanki" };
}

/* ---- FlashQuiz, QuizPort and Markdown checkbox quizzes */

const FLASHQUIZ_TYPES = { mc: "single", sata: "multiple", tf: "truefalse" };

/** One FlashQuiz option: `- [x] text`, `+ text` (correct) or `- text` (wrong). */
function flashQuizOption(line) {
  const boxed = /^\s*[-*+]\s*\[([ xX])\]\s*(.+?)\s*$/.exec(line);
  if (boxed) return { text: boxed[2].trim(), correct: boxed[1].toLowerCase() === "x" };
  const plus = /^\s*\+\s+(.+?)\s*$/.exec(line);
  if (plus) return { text: plus[1].trim(), correct: true };
  const minus = /^\s*-\s+(.+?)\s*$/.exec(line);
  if (minus) return { text: minus[1].trim(), correct: false };
  return null;
}

/**
 * FlashQuiz text: a prompt, then a type tag (`@mc`, `@sata`, `@tf`) and its
 * options. Options may be checked boxes or `+`/`-` lines, and an `Answer:`
 * line is accepted when the export does not mark a choice. `@sata` allows
 * more than one correct option; `@mc` and `@tf` take one.
 */
function parseFlashQuizText(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "FlashQuiz text");
  const deck = str(opts.deck).trim() || "Imported";
  const body = str(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = [];
  let prompt = [];
  let block = null;
  const finish = () => {
    if (block) blocks.push(block);
    block = null;
  };
  for (const line of body.split("\n")) {
    const tag = /^\s*@(mc|sata|tf)\b/i.exec(line);
    if (tag) {
      finish();
      block = { type: tag[1].toLowerCase(), prompt: prompt.join("\n").trim(), options: [], answer: "" };
      prompt = [];
      continue;
    }
    if (block) {
      const option = flashQuizOption(line);
      if (option) {
        block.options.push(option);
        continue;
      }
      const answer = /^\s*(?:answer|correct)\s*:\s*(.+?)\s*$/i.exec(line);
      if (answer) {
        block.answer = answer[1].trim();
        continue;
      }
      if (!line.trim()) continue;
      finish();
      prompt.push(line);
      continue;
    }
    prompt.push(line);
  }
  finish();

  const cards = [];
  let skipped = 0;
  for (let index = 0; index < blocks.length; index++) {
    const item = blocks[index];
    const front = str(item.prompt).trim();
    if (!front) {
      skipped++;
      continue;
    }
    let choices = item.options.slice();
    if (item.type === "tf" && !choices.length) {
      choices = [
        { text: "True", correct: false },
        { text: "False", correct: false },
      ];
    }
    let correct = choices.filter((choice) => choice.correct).map((choice) => choice.text);
    if (!correct.length && item.answer) {
      const answer = item.answer.trim();
      const byText = choices.find((choice) => choice.text.toLowerCase() === answer.toLowerCase());
      if (byText) correct = [byText.text];
      else if (/^[A-Ha-h]$/.test(answer)) {
        const at = answer.toUpperCase().charCodeAt(0) - 65;
        if (choices[at]) correct = [choices[at].text];
      } else if (item.type === "tf" && /^(true|t|yes)$/i.test(answer)) correct = ["True"];
      else if (item.type === "tf" && /^(false|f|no)$/i.test(answer)) correct = ["False"];
      else if (!choices.length) correct = [answer];
    }
    if (!correct.length) {
      skipped++;
      continue;
    }
    const back = [...new Set(correct)].join(" · ");
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front,
      back,
      tags: [],
      importSource: source,
      importKey: `flashquiz:${hashString(source + "|" + index + "|" + front + "|" + back)}`,
    });
  }
  return { cards, skipped, errors: [], source, format: "flashquiz" };
}

function quizPortText(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") return str(value.text || value.label || value.answer || value.option).trim();
  return "";
}

function quizPortOptions(item) {
  const raw = item.answers || item.options || item.choices || item.responses;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => ({ text: quizPortText(value), correct: !!(value && typeof value === "object" && value.correct === true) }))
    .filter((option) => option.text);
}

function quizPortCorrect(value, choices) {
  if (value === undefined || value === null || value === "") return [];
  const wanted = Array.isArray(value) ? value : [value];
  const out = [];
  for (const raw of wanted) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      const n = Math.round(raw);
      const at = n >= 0 && n < choices.length ? n : n >= 1 && n <= choices.length ? n - 1 : -1;
      if (at >= 0) out.push(choices[at].text);
    } else if (typeof raw === "string") {
      const text = raw.trim();
      if (!text) continue;
      const byText = choices.find((choice) => choice.text.toLowerCase() === text.toLowerCase());
      if (byText) out.push(byText.text);
      else if (/^[A-Ha-h]$/.test(text)) {
        const at = text.toUpperCase().charCodeAt(0) - 65;
        if (choices[at]) out.push(choices[at].text);
      } else if (/^\d+$/.test(text)) {
        const n = Number(text);
        const at = n >= 0 && n < choices.length ? n : n >= 1 && n <= choices.length ? n - 1 : -1;
        if (at >= 0) out.push(choices[at].text);
      } else if (!choices.length) out.push(text);
    }
  }
  return [...new Set(out)];
}

/**
 * QuizPort JSON: a question array, or an object with a `questions` array.
 * Choices may be strings or `{ text, correct }` objects. `correct`,
 * `correctAnswer`, `answer` and `key` accept an index, a letter, choice text
 * or an array of those; a plain string with no choices becomes a short-answer
 * card.
 */
function parseQuizPortJson(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "QuizPort JSON");
  let data;
  try {
    data = JSON.parse(str(text));
  } catch (e) {
    return { cards: [], skipped: 0, errors: ["That file is not valid QuizPort JSON."], source, format: "quizport" };
  }
  const list = Array.isArray(data)
    ? data
    : ["questions", "quiz", "items"].reduce((found, key) => (found.length ? found : Array.isArray(data && data[key]) ? data[key] : []), []);
  const deck = str(opts.deck).trim() || str(data && (data.deck || data.title)).trim() || "Imported";
  const cards = [];
  let skipped = 0;
  if (!list.length) return { cards, skipped: 1, errors: ["No questions array was found in that JSON file."], source, format: "quizport" };
  list.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      skipped++;
      return;
    }
    const front = str(item.question || item.prompt || item.text || item.q || item.title).trim();
    if (!front) {
      skipped++;
      return;
    }
    const choices = quizPortOptions(item);
    const marked = choices.filter((choice) => choice.correct).map((choice) => choice.text);
    const referenced = quizPortCorrect(
      item.correct !== undefined ? item.correct : item.correctAnswer !== undefined ? item.correctAnswer : item.correct_answer !== undefined ? item.correct_answer : item.answer !== undefined ? item.answer : item.key,
      choices
    );
    const back = [...new Set([...marked, ...referenced])].join(" · ");
    if (!back) {
      skipped++;
      return;
    }
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front,
      back,
      tags: [],
      importSource: source,
      importKey: `quizport:${hashString(source + "|" + index + "|" + front + "|" + back)}`,
    });
  });
  return { cards, skipped, errors: [], source, format: "quizport" };
}

/**
 * Markdown checkbox quiz: each `##` or `###` heading is a question, and the
 * `- [ ]` / `- [x]` lines under it are the choices. More than one checked box
 * is allowed. An `Answer:` line is accepted when no box is checked.
 */
function parseMarkdownQuiz(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Markdown quiz");
  const deck = str(opts.deck).trim() || "Imported";
  const body = stripFrontmatter(str(text)).replace(/\r\n?/g, "\n");
  const blocks = [];
  let current = null;
  const finish = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const line of body.split("\n")) {
    const heading = /^#{2,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      finish();
      current = { question: heading[1].trim(), options: [], answer: "" };
      continue;
    }
    if (!current) continue;
    if (/^\s*-{3,}\s*$/.test(line)) {
      finish();
      continue;
    }
    const boxed = /^\s*[-*+]\s*\[([ xX])\]\s*(.+?)\s*$/.exec(line);
    if (boxed) {
      current.options.push({ text: boxed[2].trim(), correct: boxed[1].toLowerCase() === "x" });
      continue;
    }
    const answer = /^\s*(?:answer|correct)\s*:\s*(.+?)\s*$/i.exec(line);
    if (answer) current.answer = answer[1].trim();
  }
  finish();

  const cards = [];
  let skipped = 0;
  for (let index = 0; index < blocks.length; index++) {
    const item = blocks[index];
    const front = item.question.trim();
    if (!front || !item.options.length) {
      skipped++;
      continue;
    }
    let correct = item.options.filter((option) => option.correct).map((option) => option.text);
    if (!correct.length && item.answer) {
      const found = item.options.find((option) => option.text.toLowerCase() === item.answer.toLowerCase());
      if (found) correct = [found.text];
      else if (/^[A-Ha-h]$/.test(item.answer)) {
        const at = item.answer.toUpperCase().charCodeAt(0) - 65;
        if (item.options[at]) correct = [item.options[at].text];
      }
    }
    if (!correct.length) {
      skipped++;
      continue;
    }
    const back = [...new Set(correct)].join(" · ");
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front,
      back,
      tags: [],
      importSource: source,
      importKey: `mdquiz:${hashString(source + "|" + index + "|" + front + "|" + back)}`,
    });
  }
  return { cards, skipped, errors: [], source, format: "mdquiz" };
}

/* ---- Quizlet */

function cleanQuizletField(value) {
  let s = str(value).replace(/\u00a0/g, " ").trim();
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    s = s.slice(1, -1).replace(/""/g, '"').trim();
  }
  return decodeEntities(s).trim();
}

/** The first Quizlet separator present in a record. Tab is the export default. */
function quizletDelimiter(text) {
  const line = str(text);
  if (line.includes("\t")) return "tab";
  if (line.includes(",")) return "comma";
  if (/\s+[-\u2013\u2014]\s+/.test(line)) return "dash";
  return "";
}

function splitQuizletRecord(text, kind) {
  const line = str(text).trim();
  if (!line || !kind) return null;
  if (kind === "tab") {
    const at = line.indexOf("\t");
    return at > 0 ? [line.slice(0, at), line.slice(at + 1)] : null;
  }
  if (kind === "comma") {
    const at = line.indexOf(",");
    return at > 0 ? [line.slice(0, at), line.slice(at + 1)] : null;
  }
  const m = line.match(/^(.*?)\s+[-\u2013\u2014]\s+([\s\S]*)$/);
  return m ? [m[1], m[2]] : null;
}

/** Quizlet can separate cards with semicolons; each part still needs one term/definition delimiter. */
function quizletSemicolonRecords(body) {
  if (!str(body).includes(";")) return [];
  const parts = [];
  for (const row of splitDelimited(body, ";")) {
    for (const field of row) {
      const text = str(field).trim();
      if (text) parts.push(text);
    }
  }
  if (parts.length < 2) return [];
  const kind = quizletDelimiter(parts[0]);
  if (!kind || !parts.every((part) => quizletDelimiter(part) === kind)) return [];
  return parts.map((part) => splitQuizletRecord(part, kind)).filter(Boolean);
}

/**
 * Parse Quizlet's copied text export. The exporter defaults to a tab between
 * term and definition and a newline between cards, but comma, dash and
 * semicolon layouts are accepted too. Quizlet has no deck field, so `deck` is
 * the fallback chosen in the import dialog.
 */
function parseQuizletText(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Quizlet export");
  const deck = str(opts.deck).trim() || "Imported";
  const body = str(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const cards = [];
  const add = (term, definition) => {
    const front = cleanQuizletField(term);
    const back = cleanQuizletField(definition);
    if (!front || !back) return;
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front,
      back,
      tags: [],
      importSource: source,
      importKey: `quizlet:${hashString(source + "|" + cards.length + "|" + front + "|" + back)}`,
    });
  };
  if (!body) return { cards, skipped: 0, source };
  const records = quizletSemicolonRecords(body);
  if (records.length) {
    for (const [term, definition] of records) add(term, definition);
    return { cards, skipped: 0, source };
  }
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { cards, skipped: 0, source };

  if (lines.every((line) => line.includes("\t"))) {
    for (const line of lines) {
      const pair = splitQuizletRecord(line, "tab");
      if (pair) add(pair[0], pair[1]);
    }
    return { cards, skipped: 0, source };
  }

  const quoted = lines.some((line) => /^"/.test(line) || /\","/.test(line));
  if (quoted) {
    const rows = splitDelimited(body, ",").filter((row) => row.some((cell) => str(cell).trim()));
    if (rows.length && rows.every((row) => row.length >= 2)) {
      for (const row of rows) add(row[0], row.slice(1).join(","));
      return { cards, skipped: 0, source };
    }
  }

  if (lines.every((line) => line.includes(","))) {
    for (const line of lines) {
      const pair = splitQuizletRecord(line, "comma");
      if (pair) add(pair[0], pair[1]);
    }
    return { cards, skipped: 0, source };
  }

  if (lines.every((line) => quizletDelimiter(line) === "dash")) {
    for (const line of lines) {
      const pair = splitQuizletRecord(line, "dash");
      if (pair) add(pair[0], pair[1]);
    }
    return { cards, skipped: 0, source };
  }

  const blocks = body
    .split(/\n\s*\n+/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((block) => block.length);
  if (blocks.length && blocks.every((block) => block.length >= 2)) {
    for (const block of blocks) add(block[0], block.slice(1).join("\n"));
    return { cards, skipped: 0, source };
  }

  if (lines.length === 2) add(lines[0], lines[1]);
  else if (lines.length >= 4 && lines.length % 2 === 0) {
    for (let i = 0; i < lines.length; i += 2) add(lines[i], lines[i + 1]);
  }
  return { cards, skipped: 0, source };
}

/* ---- Quizlet PDF / test-bank printouts */

const PDF_PRINT_NOISE = [
  /^quizlet(?:\.com)?$/i,
  /^https?:\/\/(?:www\.)?quizlet\.com/i,
  /^\d{1,3}$/,
  /^\d{1,3}\s*\/\s*\d{1,3}$/,
  /^page\s+\d+(?:\s*(?:of|\/)\s*\d+)?$/i,
  /^(?:name|date|class|period|score|teacher)\s*:/i,
  /^terms?\s+in\s+this\s+set(?:\s*\(\d+\))?$/i,
  /^quizlet\s+(?:test|flashcards?|study set)$/i,
  /^(?:print|printed)\s+(?:on|by)\b/i,
];

function pdfCleanTextLine(value) {
  return str(value)
    .replace(/\u00a0/g, " ")
    .replace(/\t+/g, "\t")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function pdfLineIsNoise(value) {
  const text = str(value).trim();
  if (!text) return true;
  return PDF_PRINT_NOISE.some((re) => re.test(text));
}

/** Page lines with their vertical positions. The PDF reader also supplies gap-aware lines. */
function pdfRawPageLines(page) {
  const p = page || {};
  if (Array.isArray(p.lines) && p.lines.length) {
    return p.lines.map((line) => ({
      text: pdfCleanTextLine(line && line.text !== undefined ? line.text : line),
      y: Number.isFinite(Number(line && line.y)) ? Number(line.y) : null,
    }));
  }
  return str(p.text)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((text) => ({ text: pdfCleanTextLine(text), y: null }));
}

/** Inserts blank lines where the printed page leaves a larger-than-normal vertical gap. */
function pdfPageLines(page) {
  const raw = pdfRawPageLines(page);
  const ys = raw.map((line) => line.y).filter((y) => Number.isFinite(y));
  if (ys.length < 2) return raw;
  const gaps = [];
  for (let i = 1; i < raw.length; i++) {
    const before = raw[i - 1].y;
    const after = raw[i].y;
    if (Number.isFinite(before) && Number.isFinite(after) && before > after) gaps.push(before - after);
  }
  gaps.sort((a, b) => a - b);
  const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;
  const threshold = Math.max(16, median * 1.8);
  const out = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const before = raw[i - 1].y;
    const after = raw[i].y;
    if (Number.isFinite(before) && Number.isFinite(after) && before - after > threshold) out.push({ text: "", y: null });
    out.push(raw[i]);
  }
  return out;
}

/** Combines pages, drops Quizlet page furniture and repeated print headers, and keeps blank separators. */
function pdfCardLines(pages) {
  const pageLines = (Array.isArray(pages) ? pages : [{ text: pages }]).map(pdfPageLines);
  const counts = new Map();
  for (const lines of pageLines) {
    const seen = new Set();
    for (const line of lines) {
      if (!line.text || pdfLineIsNoise(line.text) || seen.has(line.text)) continue;
      seen.add(line.text);
      counts.set(line.text, (counts.get(line.text) || 0) + 1);
    }
  }
  const repeated = (text) => {
    if (pageLines.length < 3) return false;
    const count = counts.get(text) || 0;
    if (count < Math.max(2, Math.ceil(pageLines.length * 0.5))) return false;
    return text.length <= 80 && !text.includes("\t") && !/\?$/.test(text);
  };
  const out = [];
  pageLines.forEach((lines, index) => {
    if (index) out.push({ text: "", page: index + 1, y: null });
    for (const line of lines) {
      if (!line.text) {
        out.push({ text: "", page: index + 1, y: null });
        continue;
      }
      if (pdfLineIsNoise(line.text) || repeated(line.text)) continue;
      out.push({ text: line.text, page: index + 1, y: line.y });
    }
  });
  return out;
}

/** Reads the printed answer key into question number -> letter/text. */
function pdfAnswerKey(lines) {
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^answer\s*key$/i.test(lines[i].text)) {
      start = i;
      break;
    }
  }
  if (start < 0) return { start: lines.length, answers: new Map() };
  const answers = new Map();
  for (let i = start + 1; i < lines.length; i++) {
    const text = lines[i].text;
    if (!text) continue;
    const chunks = text.split(/\s{2,}|;\s*|\s+(?=\d{1,3}\s*[.)\-–—:]\s*[A-Ha-h]\b)/);
    for (const chunk of chunks) {
      const piece = chunk.trim();
      if (!piece) continue;
      const letter = piece.match(/^(\d{1,3})\s*[.)\-–—:]?\s*([A-Ha-h])(?:\s*[.)\-–—:]?\s*(.*))?$/);
      if (letter) {
        const n = Number(letter[1]);
        if (n && !answers.has(n)) answers.set(n, { letter: letter[2].toUpperCase(), text: str(letter[3]).trim() });
        continue;
      }
      const plain = piece.match(/^(\d{1,3})\s*[.)\-–—:]\s+(.+)$/);
      if (plain) {
        const n = Number(plain[1]);
        if (n && !answers.has(n)) answers.set(n, { letter: "", text: plain[2].trim() });
      }
    }
  }
  return answers.size ? { start, answers } : { start: lines.length, answers: new Map() };
}

function pdfChoiceLine(value) {
  const text = str(value).trim();
  const marked = text.match(/^([A-Ha-h])\s*[.)\]:\-]\s*(.+)$/);
  if (marked) return { letter: marked[1].toUpperCase(), text: marked[2].trim() };
  const spaced = text.match(/^([A-Ha-h])\t+(.+)$/) || text.match(/^([A-Ha-h])\s{2,}(.+)$/);
  return spaced ? { letter: spaced[1].toUpperCase(), text: spaced[2].trim() } : null;
}

/** Handles a line such as "A. one   B. two   C. three   D. four". */
function pdfInlineChoices(value) {
  const text = str(value);
  const marks = [...text.matchAll(/(?:^|\s)([A-Ha-h])\s*[.)\]:\-]\s+/g)];
  if (marks.length < 2 || marks[0].index !== 0) return [];
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    const from = mark.index + mark[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const choice = text.slice(from, to).trim();
    if (choice) out.push({ letter: mark[1].toUpperCase(), text: choice });
  }
  return out;
}

function pdfNormalizeAnswer(value) {
  return str(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function pdfChoiceIndex(choices, value) {
  const raw = str(value).trim();
  if (!raw || !choices.length) return -1;
  const marked = raw.match(/^([A-Ha-h])(?:\s*[.)\]:\-]\s*(.*))?$/);
  if (marked) {
    const at = choices.findIndex((choice) => choice.letter === marked[1].toUpperCase());
    if (at >= 0) return at;
    if (!str(marked[2]).trim()) return -1;
  }
  const wanted = pdfNormalizeAnswer(raw);
  if (!wanted) return -1;
  const exact = choices.findIndex((choice) => pdfNormalizeAnswer(choice.text) === wanted);
  if (exact >= 0) return exact;
  return choices.findIndex((choice) => {
    const text = pdfNormalizeAnswer(choice.text);
    return text && (wanted.startsWith(text) || text.startsWith(wanted));
  });
}

/** One numbered question and the lines under it, resolved against the answer key. */
function parsePdfQuestion(number, first, lines, answers) {
  let stem = str(first).trim();
  const choices = [];
  let hint = "";
  for (let i = 0; i < lines.length; i++) {
    const text = pdfCleanTextLine(lines[i] && lines[i].text !== undefined ? lines[i].text : lines[i]);
    if (!text) continue;
    const answer = text.match(/^(?:correct\s+)?ans(?:wer)?\s*[:：\-]\s*(.+)$/i);
    if (answer) {
      hint = answer[1].trim();
      continue;
    }
    if (/^[✓✔√]/.test(text)) {
      hint = text.replace(/^[✓✔√]\s*/, "").trim();
      continue;
    }
    const inline = pdfInlineChoices(text);
    if (inline.length >= 2 && !choices.length) {
      choices.push(...inline);
      continue;
    }
    const choice = pdfChoiceLine(text);
    if (choice) {
      choices.push(choice);
      continue;
    }
    if (/^[A-H]$/i.test(text) && choices.length && i + 1 < lines.length) {
      const next = pdfCleanTextLine(lines[i + 1] && lines[i + 1].text !== undefined ? lines[i + 1].text : lines[i + 1]);
      if (next) {
        choices.push({ letter: text.toUpperCase(), text: next });
        i++;
        continue;
      }
    }
    if (!choices.length) stem += ` ${text}`;
    else choices[choices.length - 1].text += ` ${text}`;
  }

  const key = answers.get(number);
  let correct = -1;
  if (key) {
    correct = pdfChoiceIndex(choices, key.letter || key.text);
    if (correct < 0 && !choices.length && key.text) hint = key.text;
  }
  if (correct < 0 && hint) correct = pdfChoiceIndex(choices, hint);

  if (choices.length >= 2) {
    if (correct < 0) {
      return { skipped: 1, warning: `Question ${number}: choices were found but no answer key entry.` };
    }
    return {
      card: {
        front: stem,
        back: choices[correct].text,
        choices: choices.map((choice) => choice.text),
        correctChoices: String(correct + 1),
        questionSet: "quizlet",
      },
    };
  }
  if (correct < 0 && hint && !choices.length) return { card: { front: stem, back: hint } };
  if (!choices.length && lines.length === 1 && /\?$/.test(stem)) {
    const answer = pdfCleanTextLine(lines[0] && lines[0].text !== undefined ? lines[0].text : lines[0]);
    if (answer && !/\?$/.test(answer)) return { card: { front: stem, back: answer } };
  }
  return { skipped: 0 };
}

/** Parses a printed test with numbered questions, choices and an answer key. */
function parsePdfQuestions(lines, answers) {
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text;
    if (!text) continue;
    const match = text.match(/^(?:q(?:uestion)?\s*)?(\d{1,3})\s*[.)]\s+(.+)$/i);
    if (!match) continue;
    const number = Number(match[1]);
    if (number >= 1 && number <= 999) starts.push({ i, number, first: match[2].trim(), page: lines[i].page });
  }
  if (!starts.length) return { cards: [], skipped: 0, warnings: [], found: 0, choiceCount: 0 };
  let choiceCount = 0;
  for (const line of lines) {
    if (!line.text) continue;
    if (pdfChoiceLine(line.text) || pdfInlineChoices(line.text).length >= 2) choiceCount++;
  }
  const cards = [];
  const warnings = [];
  let skipped = 0;
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].i : lines.length;
    const chunk = lines.slice(start.i + 1, end);
    const parsed = parsePdfQuestion(start.number, start.first, chunk, answers);
    if (parsed.warning) warnings.push(parsed.warning);
    skipped += parsed.skipped || 0;
    if (parsed.card) cards.push({ ...parsed.card, sourcePage: start.page ? String(start.page) : "" });
  }
  return { cards, skipped, warnings, found: starts.length, choiceCount };
}

/** Parses a flashcard printout: two-column rows, dashed pairs, or one card per block. */
function parsePdfTerms(lines, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Quizlet PDF");
  const deck = str(opts.deck).trim() || "Imported";
  const cards = [];
  const errors = [];
  const seen = new Set();
  const add = (frontValue, backValue, page, extra) => {
    const front = cleanQuizletField(frontValue);
    const back = cleanQuizletField(backValue);
    if (!front || !back) return false;
    const identity = `${front.toLowerCase()}\u0000${back.toLowerCase()}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    const data = extra || {};
    cards.push({
      kind: "card",
      cardType: "basic",
      deck,
      front,
      back,
      tags: [],
      importSource: source,
      importFormat: "quizlet-pdf",
      importedOn: opts.importedOn || localDate(),
      importKey: `quizlet-pdf:${hashString(source + "|" + cards.length + "|" + front + "|" + back + "|" + str(data.correctChoices))}`,
      ...(page ? { sourcePage: String(page) } : {}),
      ...data,
    });
    return true;
  };

  const nonEmpty = lines.filter((line) => line.text);
  if (!nonEmpty.length) return { cards, skipped: 0, errors };

  const tabbed = nonEmpty.filter((line) => line.text.includes("\t"));
  if (tabbed.length) {
    for (const line of tabbed) {
      const at = line.text.indexOf("\t");
      add(line.text.slice(0, at), line.text.slice(at + 1).replace(/\t/g, " "), line.page);
    }
    if (cards.length) return { cards, skipped: 0, errors };
  }

  const dashed = nonEmpty.filter((line) => /\s+[-–—]\s+/.test(line.text));
  if (dashed.length >= 2 && dashed.length === nonEmpty.length) {
    for (const line of dashed) {
      const match = line.text.match(/^(.*?)\s+[-–—]\s+([\s\S]*)$/);
      if (match) add(match[1], match[2], line.page);
    }
    if (cards.length) return { cards, skipped: 0, errors };
  }

  const blocks = [];
  let block = [];
  for (const line of lines) {
    if (!line.text) {
      if (block.length) blocks.push(block);
      block = [];
      continue;
    }
    block.push(line);
  }
  if (block.length) blocks.push(block);

  for (const group of blocks) {
    const text = group.map((line) => line.text);
    if (text.length === 2) add(text[0], text[1], group[0].page);
    else if (text.length > 2 && text[0].endsWith("?")) add(text[0], text.slice(1).join(" "), group[0].page);
  }
  if (cards.length) return { cards, skipped: 0, errors };

  const plain = nonEmpty.map((line) => line.text);
  if (plain.length >= 2 && plain.length % 2 === 0) {
    for (let i = 0; i < plain.length; i += 2) {
      const front = plain[i].replace(/^\s*\d{1,3}[.)]\s+/, "").trim();
      add(front || plain[i], plain[i + 1], nonEmpty[i].page);
    }
  }
  return { cards, skipped: 0, errors };
}

/**
 * Parse a PDF of a Quizlet set or test bank. The text must already have been
 * extracted by readPdfPages; scanned PDFs need OCR before this can work.
 */
function parseQuizletPdf(pages, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Quizlet PDF");
  const list = Array.isArray(pages) ? pages : [{ n: 1, text: str(pages) }];
  const chars = list.reduce((total, page) => {
    const text = str(page && page.text).trim();
    if (text) return total + text.length;
    const lines = page && Array.isArray(page.lines) ? page.lines.map((line) => str(line && line.text !== undefined ? line.text : line)).join(" ").trim() : "";
    return total + lines.length;
  }, 0);
  const warnings = [];
  const errors = [];
  if (!chars) {
    return {
      cards: [],
      skipped: 0,
      errors: ["This PDF has almost no readable text. It is probably a scan; run OCR first, then import the searchable PDF."],
      warnings,
      source,
      format: "quizlet-pdf",
      questions: 0,
      totalPages: list.length,
    };
  }

  const lines = pdfCardLines(list);
  const key = pdfAnswerKey(lines);
  const body = lines.slice(0, key.start);
  const questions = parsePdfQuestions(body, key.answers);
  const cards = questions.cards.slice();
  let skipped = questions.skipped;
  if (questions.warnings.length) warnings.push(...questions.warnings);

  if (!cards.length && !questions.choiceCount) {
    const terms = parsePdfTerms(body, { ...opts, sourcePath: source });
    cards.push(...terms.cards);
    skipped += terms.skipped;
    errors.push(...terms.errors);
  }

  if (!cards.length && questions.choiceCount) {
    errors.push(
      `Found ${questions.found} numbered question${questions.found === 1 ? "" : "s"} with choices, but no readable answer key. Print the Test view with the answer key included, or import the text export.`
    );
  }
  if (!cards.length && !questions.choiceCount) {
    errors.push(
      "No term/definition pairs or answered questions were found. In Quizlet choose Print, then use the Flashcard or Test view with the answer key included, or import the text export instead."
    );
  }
  return {
    cards,
    skipped,
    errors,
    warnings,
    source,
    format: "quizlet-pdf",
    questions: questions.found,
    totalPages: list.length,
  };
}

function cleanCardLine(line) {
  return str(line)
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
    .trim();
}

function blockTags(block) {
  return [...block.matchAll(/(^|\s)#([\w/-]+)/g)]
    .map((m) => m[2])
    .filter((t) => !/^flashcards(?:\/|$)/i.test(t));
}

/**
 * Parse one Spaced Repetition Markdown note. A tag supplies the deck and also
 * opts the file into cloze paragraphs, so ordinary notes in the same folder are
 * not turned into cards by accident.
 */
function parseSpacedRepetition(text, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Spaced Repetition note");
  const body = stripCodeFences(stripFrontmatter(text));
  const tagged = /#flashcards(?:\/|\b)/i.test(body);
  let deck = str(opts.deck).trim() || "Imported";
  const cards = [];
  const blocks = body.split(/\n\s*\n+/);
  for (let b = 0; b < blocks.length; b++) {
    const raw = blocks[b].split("\n");
    const lines = [];
    for (const original of raw) {
      // Spaced Repetition appends <!--SR:...--> scheduling comments inline.
      const line = original.replace(/<!--\s*SR:[\s\S]*?-->/gi, "").replace(/<!--[\s\S]*?-->/g, "").trimEnd();
      if (!line.trim()) continue;
      const tag = line.match(/#flashcards(?:\/([^\s#]+))?/i);
      if (tag) {
        if (tag[1]) deck = tag[1].replace(/\\\//g, "/").trim();
        const left = line.replace(/#flashcards(?:\/[^\s#]+)?/gi, "").trim();
        if (left) lines.push(left);
        continue;
      }
      if (line.trim()) lines.push(line);
    }
    if (!lines.length) continue;
    const tags = blockTags(lines.join("\n"));
    const add = (front, back, cardType) => {
      const f = str(front).trim();
      const a = str(back).trim();
      if (!f || !a) return;
      cards.push({
        kind: "card",
        cardType,
        deck,
        front: f,
        back: a,
        tags,
        importSource: source,
        importKey: `sr:${hashString(source + "|" + b + "|" + f + "|" + cardType)}`,
      });
    };

    const sepIndex = lines.findIndex((l) => /^\s*\?\?\s*$/.test(l) || /^\s*\?\s*$/.test(l));
    if (sepIndex > 0 && sepIndex < lines.length - 1) {
      add(lines.slice(0, sepIndex).join("\n"), lines.slice(sepIndex + 1).join("\n"), /^\s*\?\?/.test(lines[sepIndex]) ? "reversed" : "basic");
      continue;
    }

    let inline = 0;
    for (const line of lines) {
      const textLine = cleanCardLine(line);
      if (!textLine) continue;
      const m = textLine.match(/^(.*?)(:::|::)(.*)$/);
      if (m) {
        add(m[1], m[3], m[2] === ":::" ? "reversed" : "basic");
        inline++;
      }
    }
    if (inline) continue;

    if (tagged) {
      const joined = lines.join("\n");
      const parsed = parseCloze(joined);
      if (parsed.answers.length) add(joined, parsed.answers.join(" · "), "cloze");
    }
  }
  return { cards, skipped: 0, source };
}

/** A plain-text Anki export may contain the deck column, so tell the user when it does not. */
function ankiExportHint() {
  return "Anki: File → Export → Notes in Plain Text, include the deck column if you want decks kept.";
}

/** How to load the file this plugin writes back into Anki. */
function ankiFileHint() {
  return "Anki: File → Import, choose this .txt and keep the detected fields. Deck, Basic/Cloze note type and tags are in the header. Images and audio stay in the vault and are not bundled.";
}

/** Pick the right help line for whichever export format the dialog shows. */
function cardsExportHint(format) {
  if (format === "quizlet") return quizletExportHint();
  if (format === "anki") return ankiFileHint();
  return questionSetExportHint(format);
}

/** Quizlet has no deck or file metadata, so point at its exact copy settings. */
function quizletExportHint() {
  return "Quizlet: open the set → Export, use Tab between term and definition and New line between cards, then save the copied text as a .txt or .csv file in this vault.";
}

function giftExportHint() {
  return "Moodle GIFT: save the course's GIFT text as a .txt or .gift file in this vault. Each question needs an answer block in braces, for example ::Capital::What is the capital of France?{=Paris ~Lyon ~Marseille}.";
}

class CardImportModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.type = this.options.type || "spaced";
    this.csvParsed = null;
    this.csvMapping = null;
    this.preview = null;
    this.reviewedUpdates = false;
    this.devicePdf = null;
  }

  onOpen() {
    const { contentEl } = this;
    const p = this.plugin;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Import existing decks" });

    const typeWrap = contentEl.createDiv({ cls: "qt-field" });
    typeWrap.createEl("label", { text: "Source" });
    const type = typeWrap.createEl("select", { cls: "dropdown" });
    type.createEl("option", { text: "Spaced Repetition notes in this vault", value: "spaced" });
    type.createEl("option", { text: "Mochi Markdown folder", value: "mochi" });
    type.createEl("option", { text: "CrowdAnki JSON export", value: "crowdanki" });
    type.createEl("option", { text: "Anki plain-text export", value: "anki" });
    type.createEl("option", { text: "Anki package (.apkg)", value: "apkg" });
    type.createEl("option", { text: "Quizlet text export or PDF test bank", value: "quizlet" });
    type.createEl("option", { text: "Moodle GIFT (.txt or .gift)", value: "gift" });
    type.createEl("option", { text: "Moodle XML quiz bank (.xml)", value: "moodlexml" });
    type.createEl("option", { text: "QTI quiz bank (.xml)", value: "qti" });
    type.createEl("option", { text: "FlashQuiz text (@mc / @sata / @tf)", value: "flashquiz" });
    type.createEl("option", { text: "QuizPort JSON (.json)", value: "quizport" });
    type.createEl("option", { text: "Markdown checkbox quiz (.md)", value: "mdquiz" });
    type.createEl("option", { text: "Generic CSV / TSV (choose columns)", value: "csv" });
    type.createEl("option", { text: "Kahoot spreadsheet (CSV)", value: "kahoot" });
    type.createEl("option", { text: "Blooket spreadsheet (CSV)", value: "blooket" });
    type.createEl("option", { text: "Gimkit spreadsheet (CSV)", value: "gimkit" });
    type.value = this.type;

    const sourceWrap = contentEl.createDiv({ cls: "qt-field" });
    const sourceLabel = sourceWrap.createEl("label", { text: "Folder" });
    const source = sourceWrap.createEl("select", { cls: "dropdown" });

    const deviceWrap = contentEl.createDiv({ cls: "qt-field qt-device-pdf" });
    deviceWrap.createEl("label", { text: "Or choose a PDF from this device" });
    const deviceRow = deviceWrap.createDiv({ cls: "qt-row" });
    const chooseDevice = deviceRow.createEl("button", { text: "Choose PDF from device...", cls: "qt-grow" });
    const clearDevice = deviceRow.createEl("button", { text: "Use a vault file", cls: "qt-grow" });
    const deviceNote = deviceWrap.createDiv({ cls: "qt-hint" });
    const deviceInput = createEl("input", { type: "file", attr: { accept: ".pdf,application/pdf" } });
    deviceInput.hidden = true;
    deviceWrap.appendChild(deviceInput);
    const updateDevice = () => {
      const on = this.type === "quizlet";
      deviceWrap.toggleClass("qt-hidden", !on);
      sourceWrap.toggleClass("qt-hidden", on && !!this.devicePdf);
      clearDevice.disabled = !this.devicePdf;
      deviceNote.setText(
        this.devicePdf
          ? `Using ${this.devicePdf.name}. It is read on this device and is not copied into the vault.`
          : "Choose a PDF printed from Quizlet. It is read locally, not uploaded, and not added to the vault. Scanned PDFs need OCR first."
      );
    };
    chooseDevice.addEventListener("click", () => deviceInput.click());
    clearDevice.addEventListener("click", () => {
      this.devicePdf = null;
      this.preview = null;
      deviceInput.value = "";
      updateDevice();
      renderDiffPreview(null);
      if (this.type === "quizlet") renderCardPreview(null);
    });
    deviceInput.addEventListener("change", () => {
      this.devicePdf = deviceInput.files && deviceInput.files[0] ? deviceInput.files[0] : null;
      this.preview = null;
      updateDevice();
      renderDiffPreview(null);
      if (this.type === "quizlet") renderCardPreview(null);
      deviceInput.value = "";
    });
    updateDevice();
    const refreshOptions = () => {
      source.empty();
      const files = p.app.vault.getAllLoadedFiles ? p.app.vault.getAllLoadedFiles() : p.app.vault.getMarkdownFiles();
      if (this.type === "spaced" || this.type === "mochi") {
        const folders = ["", ...new Set((files || []).map((f) => f.parent && f.parent.path).filter((x) => x && x !== "/"))];
        folders.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        for (const folder of folders) source.createEl("option", { text: folder || "Whole vault", value: folder });
      } else {
        const pattern = this.type === "quizlet" ? /\.(txt|tsv|csv|pdf)$/i : /\.(txt|tsv|csv|gift|xml|json|apkg|md)$/i;
        const candidates = (files || []).filter((f) => pattern.test(f.path || ""));
        const missing = this.type === "quizlet" ? "No .txt, .csv or .pdf files found" : "No .txt, .tsv, .csv, .gift, .xml, .json, .apkg or .md files found";
        if (!candidates.length) source.createEl("option", { text: missing, value: "" });
        for (const f of candidates) source.createEl("option", { text: f.path, value: f.path });
      }
      const sourceLabels = { spaced: "Folder to scan", mochi: "Mochi Markdown folder", crowdanki: "CrowdAnki JSON file", quizlet: "Quizlet text export or PDF", anki: "Anki text export", apkg: "Anki package", gift: "Moodle GIFT file", moodlexml: "Moodle XML file", qti: "QTI XML file", flashquiz: "FlashQuiz text file", quizport: "QuizPort JSON file", mdquiz: "Markdown quiz note", csv: "CSV or TSV file", kahoot: "Kahoot CSV", blooket: "Blooket CSV", gimkit: "Gimkit CSV" };
      sourceLabel.setText(sourceLabels[this.type] || "Import file");
    };
    refreshOptions();
    source.addEventListener("change", () => {
      this.csvParsed = null;
      this.csvMapping = null;
      this.preview = null;
      this.devicePdf = null;
      deviceInput.value = "";
      updateDevice();
      if (this.type === "csv") {
        csvGrid.empty();
        csvPreview.empty();
      }
      if (this.type === "quizlet") renderCardPreview(null);
    });
    type.addEventListener("change", () => {
      this.type = type.value;
      this.csvParsed = null;
      this.csvMapping = null;
      this.devicePdf = null;
      deviceInput.value = "";
      refreshOptions();
      updateDevice();
      help.setText(helpText());
      toggleCsvControls();
      renderCardPreview(null);
    });

    const deckWrap = contentEl.createDiv({ cls: "qt-field" });
    deckWrap.createEl("label", { text: "Fallback deck (source deck wins when present)" });
    const deck = deckWrap.createEl("input", { type: "text", attr: { placeholder: p.settings.cards.defaultDeck || "Imported" } });
    if (this.options.deck) deck.value = this.options.deck;
    const courseWrap = contentEl.createDiv({ cls: "qt-field" });
    courseWrap.createEl("label", { text: "Course tag (optional)" });
    const course = courseWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. BIOL 201" } });
    if (this.options.course) course.value = this.options.course;

    const duplicateWrap = contentEl.createDiv({ cls: "qt-field" });
    duplicateWrap.createEl("label", { text: "If an import key already exists" });
    const duplicateMode = duplicateWrap.createEl("select", { cls: "dropdown" });
    duplicateMode.createEl("option", { text: "Skip duplicates", value: "skip" });
    duplicateMode.createEl("option", { text: "Update the existing card", value: "update" });
    duplicateMode.createEl("option", { text: "Create a copy", value: "copy" });
    duplicateMode.value = "skip";
    const diffBox = contentEl.createDiv({ cls: "qt-write-preview qt-hidden" });

    const csvSection = contentEl.createDiv({ cls: "qt-csv-section" });
    const csvGrid = csvSection.createDiv({ cls: "qt-csv-mapping" });
    const csvHeaderWrap = csvSection.createDiv({ cls: "qt-field" });
    const csvHeader = csvHeaderWrap.createEl("input", { type: "checkbox" });
    csvHeader.checked = true;
    csvHeaderWrap.createEl("label", { text: "First row is a header" });
    const csvPreview = csvSection.createDiv({ cls: "qt-csv-preview" });
    const saveMappingWrap = contentEl.createDiv({ cls: "qt-csv-save" });
    const saveMapping = saveMappingWrap.createEl("input", { type: "checkbox" });
    saveMapping.checked = true;
    saveMappingWrap.createEl("label", { text: "Remember this mapping for the same column headers" });

    const renderCsvMapping = (parsed) => {
      csvGrid.empty();
      for (const [field] of GENERIC_FIELDS) {
        const line = csvGrid.createDiv({ cls: "qt-csv-map-row" });
        line.createEl("label", { text: GENERIC_LABELS[field] });
        const select = line.createEl("select", { cls: "dropdown" });
        select.createEl("option", { text: "Not imported", value: "-1" });
        parsed.headers.forEach((header, i) => select.createEl("option", { text: `${i + 1}. ${header}`, value: String(i) }));
        const current = this.csvMapping && this.csvMapping[field] !== undefined && this.csvMapping[field] !== null ? Number(this.csvMapping[field]) : -1;
        select.value = String(current >= 0 ? current : -1);
        select.addEventListener("change", async () => {
          this.csvMapping = { ...(this.csvMapping || parsed.mapping), [field]: Number(select.value) };
          await readCsv({ keepMapping: true, renderMapping: false, quiet: true });
        });
      }
    };

    const renderCsvPreview = (parsed) => {
      csvPreview.empty();
      if (!parsed) return;
      const missing = parsed.mapping.front < 0 || parsed.mapping.back < 0;
      csvPreview.createEl("p", {
        text: missing
          ? "Choose the Front and Back columns."
          : `${parsed.cards.length} card${parsed.cards.length === 1 ? "" : "s"} ready${parsed.skipped ? `, ${parsed.skipped} row${parsed.skipped === 1 ? "" : "s"} skipped` : ""}.`,
      });
      if (parsed.errors.length) csvPreview.createEl("p", { text: parsed.errors[0] });
      if (parsed.preview && parsed.preview.length) {
        const list = csvPreview.createEl("ul");
        for (const row of parsed.preview) {
          list.createEl("li", { text: `Row ${row.row}: ${row.front || "—"} → ${row.back || "—"}${row.deck ? ` · ${row.deck}` : ""}` });
        }
      }
    };

    const toggleCsvControls = () => {
      const on = this.type === "csv";
      csvSection.style.display = on ? "" : "none";
      saveMappingWrap.style.display = on ? "" : "none";
    };

    const readCsv = async (options) => {
      const o = options || {};
      const path = source.value;
      if (!path) {
        note.setText("Choose a .csv, .tsv or .txt file first.");
        return null;
      }
      try {
        const parsed = await p.previewCardsCsv(path, {
          deck: deck.value,
          course: course.value,
          mapping: o.keepMapping ? this.csvMapping : undefined,
          hasHeader: o.autoHeader ? undefined : csvHeader.checked,
        });
        this.csvParsed = parsed;
        this.preview = parsed;
        this.reviewedUpdates = false;
        if (!o.keepMapping || !this.csvMapping) {
          this.csvMapping = { ...parsed.mapping };
          csvHeader.checked = parsed.hasHeader;
        }
        if (o.renderMapping !== false) renderCsvMapping(parsed);
        renderCsvPreview(parsed);
        renderDiffPreview(parsed);
        toggleCsvControls();
        if (!o.quiet) {
          note.setText(parsed.cards.length ? `Previewing ${parsed.cards.length} card${parsed.cards.length === 1 ? "" : "s"}.` : parsed.errors[0] || "No cards found.");
        }
        return parsed;
      } catch (e) {
        note.setText(str(e && e.message) || "Could not read that file.");
        return null;
      }
    };
    csvHeader.addEventListener("change", () => {
      this.csvParsed = null;
      readCsv({ keepMapping: true, quiet: true });
    });
    toggleCsvControls();

    const help = contentEl.createEl("p", { cls: "setting-item-description" });
    const helpText = () => {
      if (this.type === "quizlet") {
        return quizletExportHint() + " A PDF printed from Quizlet is also read from its text layer: choose Print, use the Flashcard or Test view with the answer key included, then pick the PDF from the vault or use Choose PDF from device. Scanned PDFs must be OCR'd first.";
      }
      if (this.type === "mochi") return "Mochi: export the deck as Markdown, unzip it into a vault folder, then choose that folder. Each card file uses --- or *** between its sides; the folder name supplies the deck unless you enter a fallback deck.";
      if (this.type === "crowdanki") return "CrowdAnki: export the deck as CrowdAnki JSON and save the .json file in the vault. Nested deck names, note fields, Anki tags and cloze models are read; review history is not exported by CrowdAnki.";
      if (this.type === "gift") return giftExportHint();
      if (this.type === "moodlexml") return "Moodle XML: export the course question bank as Moodle XML, then save the .xml file in this vault. Multiple choice, true/false, short answer and numerical questions are read; matching, essay, description and cloze questions are skipped.";
      if (this.type === "qti") return "QTI: export the quiz bank as QTI XML, then save the .xml file in this vault. QTI 1.2 and QTI 2.1 multiple-choice items are read, including response labels and correct-response identifiers.";
      if (this.type === "flashquiz") return "FlashQuiz: save the quiz text as a .txt or .md file in this vault. A prompt is followed by @mc, @sata or @tf and its options; mark correct choices with [x] or +, or add an Answer: line.";
      if (this.type === "quizport") return "QuizPort: save the quiz .json in this vault. A question array, or an object with a questions array, is read; choices may be strings or { text, correct } objects, and correct accepts an index, a letter or the choice text.";
      if (this.type === "mdquiz") return "Markdown quiz: each ## or ### heading is a question and the - [ ] / - [x] lines under it are the choices. More than one box may be checked; an Answer: line works when no box is checked.";
      if (this.type === "csv") return "Read a CSV or TSV with a header row. Front/term/question and Back/definition/answer columns are detected automatically; check or change the mapping, then import. Mappings are remembered for the same header layout.";
      if (this.type === "anki") return ankiExportHint() + " To bring in a whole package with its notes and basic scheduling metadata, choose Anki package (.apkg) instead.";
      if (this.type === "apkg") return "Anki: File → Export → Anki Deck Package (.apkg), save it in this vault, then choose it here. Notes, decks, tags, cloze cards and basic review dates are read; images and audio are not imported. Newer zstd-compressed packages are rejected with a text-export hint.";
      if (QUESTION_SET_TYPES.includes(this.type)) {
        return "Save the platform's spreadsheet as CSV first. Question, answer choices, correct answer and time limit are read automatically; the set's choices stay in the card so it can be exported back.";
      }
      return "Pick a folder of Markdown notes. Files without a #flashcards tag only contribute explicit :: cards.";
    };
    help.setText(helpText());
    const cardPreview = contentEl.createDiv({ cls: "qt-import-preview qt-hidden" });
    const note = contentEl.createDiv({ cls: "qt-hint" });
    const resultBox = contentEl.createDiv({ cls: "qt-import-result qt-hidden" });
    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const preview = row.createEl("button", { text: "Preview", cls: "qt-grow" });
    const go = row.createEl("button", { text: "Import cards", cls: "mod-cta qt-grow" });
    const showImportResult = (result) => {
      resultBox.empty();
      resultBox.toggleClass("qt-hidden", false);
      resultBox.createEl("h4", { text: "Import report" });
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const failures = rows.filter((item) => item.status === "failed");
      const skipped = rows.filter((item) => item.status === "skipped");
      const summary = [`${result.created || 0} created`, `${result.updated || 0} updated`, `${result.copied || 0} copied`, `${result.skipped || 0} skipped`];
      if (failures.length) summary.push(`${failures.length} failed`);
      if (result.media && result.media.total) summary.push(`${result.media.total} media not imported`);
      resultBox.createDiv({ cls: "qt-hint", text: summary.join(" · ") });
      if (rows.length) {
        const list = resultBox.createEl("ul", { cls: "qt-import-rows" });
        for (const item of rows.slice(0, 25)) {
          const rowEl = list.createEl("li");
          const where = item.row !== undefined ? `Row ${item.row}` : item.path || item.source || "Item";
          rowEl.createSpan({ cls: "qt-import-status", text: `${item.status || "item"} · ${where}` });
          if (item.reason) rowEl.createSpan({ text: ` — ${item.reason}` });
        }
        if (rows.length > 25) resultBox.createDiv({ cls: "qt-hint", text: `…and ${rows.length - 25} more rows.` });
      }
      if (skipped.length && !rows.length) resultBox.createDiv({ cls: "qt-hint", text: `${skipped.length} rows were skipped.` });
      if (result.media && result.media.total) {
        const names = Array.isArray(result.media.names) ? result.media.names : [];
        resultBox.createDiv({ cls: "qt-warning", text: `${result.media.total} media file${result.media.total === 1 ? "" : "s"} stayed in Anki${names.length ? `: ${names.slice(0, 8).join(", ")}${names.length > 8 ? `, +${names.length - 8} more` : ""}` : ""}.` });
      }
      for (const warning of Array.isArray(result.warnings) ? result.warnings : []) resultBox.createDiv({ cls: "qt-warning", text: warning });
      for (const error of Array.isArray(result.errors) ? result.errors.slice(0, 10) : []) resultBox.createDiv({ cls: "qt-error", text: error });
      if (Array.isArray(result.errors) && result.errors.length > 10) resultBox.createDiv({ cls: "qt-hint", text: `…and ${result.errors.length - 10} more errors.` });
      const done = resultBox.createEl("button", { text: "Done", cls: "mod-cta" });
      done.addEventListener("click", () => this.close());
    };
    const renderDiffPreview = (parsed) => {
      diffBox.empty();
      const details = parsed && Array.isArray(parsed.duplicateDetails) ? parsed.duplicateDetails : [];
      const updating = duplicateMode.value === "update";
      if (!updating || !details.length) {
        diffBox.toggleClass("qt-hidden", true);
        this.reviewedUpdates = false;
        go.disabled = false;
        return;
      }
      diffBox.toggleClass("qt-hidden", false);
      diffBox.createEl("h4", { text: `Review ${details.length} existing card${details.length === 1 ? "" : "s"}` });
      diffBox.createDiv({
        cls: "qt-hint",
        text: "Only the card body, deck and course can change. Review history, attempts and scheduling are protected.",
      });
      const list = diffBox.createEl("ul", { cls: "qt-write-preview-list" });
      for (const diff of details.slice(0, 8)) {
        const item = list.createEl("li");
        item.createDiv({ cls: "qt-write-preview-path", text: diff.path || "Existing card" });
        if (!diff.fields.length) item.createDiv({ cls: "qt-hint", text: "No visible field changes." });
        for (const field of diff.fields) {
          item.createDiv({ cls: "qt-write-preview-field", text: `${field.label}: ${field.before || "—"} → ${field.after || "—"}` });
        }
      }
      if (details.length > 8) diffBox.createDiv({ cls: "qt-hint", text: `…and ${details.length - 8} more.` });
      const confirmWrap = diffBox.createDiv({ cls: "qt-write-preview-confirm" });
      const reviewed = confirmWrap.createEl("input", { type: "checkbox" });
      reviewed.checked = !!this.reviewedUpdates;
      confirmWrap.createEl("label", { text: "I reviewed these updates" });
      reviewed.addEventListener("change", () => {
        this.reviewedUpdates = reviewed.checked;
        go.disabled = !reviewed.checked;
      });
      go.disabled = !this.reviewedUpdates;
    };
    duplicateMode.addEventListener("change", () => {
      this.reviewedUpdates = false;
      renderDiffPreview(this.preview);
    });
    const isQuizletPdf = () => this.type === "quizlet" && (!!this.devicePdf || /\.pdf$/i.test(String(source.value || "")));
    const readDevicePdf = () => {
      if (!this.devicePdf) return Promise.resolve(null);
      if (typeof this.devicePdf.arrayBuffer === "function") return this.devicePdf.arrayBuffer();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("That PDF could not be read."));
        reader.readAsArrayBuffer(this.devicePdf);
      });
    };
    const renderCardPreview = (parsed) => {
      cardPreview.empty();
      if (!isQuizletPdf() || !parsed || !Array.isArray(parsed.cards) || !parsed.cards.length) {
        cardPreview.toggleClass("qt-hidden", true);
        return;
      }
      cardPreview.toggleClass("qt-hidden", false);
      cardPreview.createEl("h4", { text: `PDF preview: ${parsed.cards.length} flashcard${parsed.cards.length === 1 ? "" : "s"}` });
      const list = cardPreview.createEl("ul", { cls: "qt-import-rows" });
      for (const card of parsed.cards.slice(0, 8)) {
        const item = list.createEl("li");
        item.createDiv({ text: card.front });
        item.createDiv({ cls: "qt-hint", text: `→ ${card.back}${card.sourcePage ? ` · page ${card.sourcePage}` : ""}` });
      }
      if (parsed.cards.length > 8) cardPreview.createDiv({ cls: "qt-hint", text: `…and ${parsed.cards.length - 8} more.` });
      for (const warning of Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 3) : []) cardPreview.createDiv({ cls: "qt-warning", text: warning });
    };
    cancel.addEventListener("click", () => this.close());
    preview.addEventListener("click", async () => {
      const path = this.devicePdf ? this.devicePdf.name : source.value;
      if (this.type === "csv") {
        await readCsv({ keepMapping: !!this.csvMapping, autoHeader: !this.csvMapping });
        return;
      }
      if (!path) {
        note.setText("Choose a file or folder first.");
        return;
      }
      preview.disabled = true;
      note.setText("Reading preview…");
      try {
        const options = { deck: deck.value, course: course.value };
        if (this.devicePdf) {
          options.pdfData = await readDevicePdf();
          options.pdfName = this.devicePdf.name;
        }
        const parsed = await p.previewCardsImport(this.type, path, options);
        this.preview = parsed;
        this.reviewedUpdates = false;
        renderDiffPreview(parsed);
        renderCardPreview(parsed);
        const duplicateText = parsed.duplicates ? ` · ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? "" : "s"}` : "";
        const errorText = parsed.errors && parsed.errors.length ? ` · ${parsed.errors.length} issue${parsed.errors.length === 1 ? "" : "s"}` : "";
        const message = `${parsed.total} card${parsed.total === 1 ? "" : "s"} ready${duplicateText}${errorText}. Choose a duplicate mode, then import.`;
        note.setText(parsed.errors && parsed.errors.length ? `${message} ${parsed.errors[0]}` : message);
      } catch (e) {
        note.setText(str(e && e.message) || "Could not preview that import.");
      } finally {
        preview.disabled = false;
      }
    });
    go.addEventListener("click", async () => {
      const path = this.devicePdf ? this.devicePdf.name : source.value;
      if (this.type !== "spaced" && !path) {
        new Notice(`Choose a ${this.type === "quizlet" ? "Quizlet text or PDF" : this.type === "anki" ? "Anki" : this.type === "apkg" ? "Anki package" : this.type === "gift" ? "Moodle GIFT" : this.type === "moodlexml" ? "Moodle XML" : this.type === "qti" ? "QTI" : this.type === "mochi" ? "Mochi folder" : this.type === "crowdanki" ? "CrowdAnki JSON" : this.type} file first.`);
        return;
      }
      if (this.type === "csv") {
        const parsed = await readCsv({ keepMapping: !!this.csvMapping, autoHeader: !this.csvMapping, quiet: true });
        if (!parsed) return;
        if (parsed.mapping.front < 0 || parsed.mapping.back < 0) {
          note.setText("Choose a Front column and a Back column before importing.");
          return;
        }
      }
      if (duplicateMode.value === "update") {
        if (!this.preview) {
          note.setText("Press Preview to review the card updates before importing.");
          return;
        }
        const updates = Array.isArray(this.preview.duplicateDetails) ? this.preview.duplicateDetails : [];
        if (updates.length && !this.reviewedUpdates) {
          note.setText("Review the card changes above and tick the box before importing.");
          return;
        }
      }
      go.disabled = true;
      note.setText("Reading and importing…");
      try {
        const options = { deck: deck.value, course: course.value, duplicateMode: duplicateMode.value };
        if (this.devicePdf) {
          options.pdfData = await readDevicePdf();
          options.pdfName = this.devicePdf.name;
        }
        const result =
          this.type === "spaced"
            ? await p.importCardsFromFolder(path, options)
            : this.type === "mochi"
              ? await p.importCardsFromMochi(path, options)
              : this.type === "crowdanki"
                ? await p.importCardsFromCrowdAnki(path, options)
                : this.type === "quizlet"
                  ? await p.importCardsFromQuizlet(path, options)
                  : this.type === "apkg"
                    ? await p.importCardsFromApkg(path, options)
                    : this.type === "csv"
                      ? await p.importCardsFromCsv(path, { ...options, mapping: this.csvMapping, hasHeader: csvHeader.checked, saveMapping: saveMapping.checked })
                      : QUESTION_SET_TYPES.includes(this.type)
                        ? await p.importCardsFromQuestionSet(path, this.type, options)
                        : this.type === "flashquiz"
                          ? await p.importCardsFromFlashQuiz(path, options)
                          : this.type === "quizport"
                            ? await p.importCardsFromQuizPort(path, options)
                            : this.type === "mdquiz"
                              ? await p.importCardsFromMarkdownQuiz(path, options)
                              : this.type === "gift"
                          ? await p.importCardsFromGift(path, options)
                          : this.type === "moodlexml" || this.type === "qti"
                            ? await p.importCardsFromLmsXml(path, this.type, options)
                            : await p.importCardsFromAnki(path, options);
        const bits = [`Imported ${result.created} card${result.created === 1 ? "" : "s"}`];
        if (result.updated) bits.push(`${result.updated} updated`);
        if (result.copied) bits.push(`${result.copied} copied`);
        if (result.skipped) bits.push(`${result.skipped} skipped`);
        if (result.errors && result.errors.length) bits.push(`${result.errors.length} failed`);
        if (result.warnings && result.warnings.length) bits.push(`${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`);
        note.setText(bits.join(" · "));
        new Notice(bits.join(" · "), 6000);
        showImportResult(result);
        if (this.onDone) this.onDone(result);
        if (!result.created) go.disabled = false;
      } catch (e) {
        go.disabled = false;
        note.setText(str(e && e.message) || "Import failed.");
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** Export the current Cards filter to Quizlet or one of the question-set CSVs. */
class CardExportModal extends Modal {
  constructor(app, plugin, options, onDone) {
    super(app);
    this.plugin = plugin;
    this.options = options || {};
    this.onDone = onDone || (() => {});
    this.format = this.options.format || "quizlet";
  }

  onOpen() {
    const { contentEl } = this;
    const p = this.plugin;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Export cards" });

    const count = p.filteredCards({ deck: this.options.deck, course: this.options.course }).length;
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `${count} card${count === 1 ? "" : "s"} in the current deck and course filter. Exports are written to the vault as a file you can upload to the platform.`,
    });

    const wrap = contentEl.createDiv({ cls: "qt-field" });
    wrap.createEl("label", { text: "Format" });
    const format = wrap.createEl("select", { cls: "dropdown" });
    format.createEl("option", { text: "Quizlet text", value: "quizlet" });
    format.createEl("option", { text: "Anki text", value: "anki" });
    format.createEl("option", { text: "Kahoot CSV", value: "kahoot" });
    format.createEl("option", { text: "Blooket CSV", value: "blooket" });
    format.createEl("option", { text: "Gimkit CSV", value: "gimkit" });
    format.value = this.format;

    const help = contentEl.createEl("p", { cls: "setting-item-description" });
    const setHelp = () => help.setText(cardsExportHint(this.format));
    format.addEventListener("change", () => {
      this.format = format.value;
      setHelp();
    });
    setHelp();

    const note = contentEl.createDiv({ cls: "qt-hint" });
    const resultBox = contentEl.createDiv({ cls: "qt-import-result qt-hidden" });
    const row = contentEl.createDiv({ cls: "qt-row" });
    const cancel = row.createEl("button", { text: "Cancel", cls: "qt-grow" });
    const go = row.createEl("button", { text: "Export file", cls: "mod-cta qt-grow" });
    cancel.addEventListener("click", () => this.close());
    go.addEventListener("click", async () => {
      go.disabled = true;
      note.setText("Writing the export…");
      try {
        const result = await p.exportCards(this.format, { deck: this.options.deck, course: this.options.course });
        note.setText(`Exported ${result.count} card${result.count === 1 ? "" : "s"} to ${result.path}.`);
        new Notice(`Exported ${result.count} card${result.count === 1 ? "" : "s"} to ${result.path}.`, 7000);
        if (result.warnings && result.warnings.length) {
          note.setText(`${note.textContent || result.path} · ${result.warnings[0]}`);
        }
        go.disabled = false;
        if (this.onDone) this.onDone(result);
      } catch (e) {
        go.disabled = false;
        note.setText(str(e && e.message) || "Export failed.");
      }
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = {
  IMPORT_TYPES,
  QUESTION_SET_TYPES,
  GENERIC_FIELDS,
  GENERIC_LABELS,
  genericDelimiter,
  detectGenericMapping,
  normalizeGenericMapping,
  parseGenericCsv,
  CardImportModal,
  stripFrontmatter,
  stripCodeFences,
  htmlToMarkdown,
  splitDelimited,
  parseAnkiText,
  parseGiftText,
  parseMoodleXml,
  parseQtiXml,
  parseLmsXml,
  parseFlashQuizText,
  parseQuizPortJson,
  parseMarkdownQuiz,
  parseMochiMarkdown,
  parseCrowdAnkiJson,
  parseQuizletText,
  parseQuizletPdf,
  parseQuestionSetText,
  parseSpacedRepetition,
  cardsToQuizlet,
  cardsToAnki,
  cardsToQuestionSet,
  ankiExportHint,
  ankiFileHint,
  cardsExportHint,
  quizletExportHint,
  giftExportHint,
  questionSetExportHint,
  CardImportModal,
  CardExportModal,
};
