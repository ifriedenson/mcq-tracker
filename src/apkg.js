"use strict";
/*
 * Anki .apkg import.
 *
 * An .apkg is a ZIP containing an Anki SQLite collection. This reader only
 * reads the ZIP central directory and the `notes`, `cards` and `col` tables; it
 * does not execute SQL, extract archive paths, or write anything to disk. No
 * Anki code is bundled. Older SQLite collections (`collection.anki2` and
 * `collection.anki21`) are supported. The newer zstd-compressed
 * `collection.anki21b` format needs a decompressor and is rejected with a clear
 * message instead of guessing.
 */
const { str } = require("./util");
const { htmlToMarkdown } = require("./cards-import");
const { parseCloze } = require("./cards");

const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_EOCD = 0x06054b50;

function fail(message) {
  throw new Error(message);
}

function u16(buf, offset) {
  return buf.readUInt16LE(offset);
}

function u32(buf, offset) {
  return buf.readUInt32LE(offset);
}

function be16(buf, offset) {
  return buf.readUInt16BE(offset);
}

function be32(buf, offset) {
  return buf.readUInt32BE(offset);
}

function inflateRaw(data) {
  let zlib;
  try {
    zlib = require("zlib");
  } catch (e) {
    fail("Reading ZIP archives (.apkg and zipped QTI) needs desktop Obsidian because it uses the local decompressor. On mobile, export the deck or quiz as text or XML first.");
  }
  if (!zlib || typeof zlib.inflateRawSync !== "function") {
    fail("This Obsidian build cannot open .apkg files. Export the deck from Anki as Notes in Plain Text instead.");
  }
  try {
    return zlib.inflateRawSync(data);
  } catch (e) {
    fail("That .apkg file is damaged: one of its ZIP entries could not be decompressed.");
  }
}

/** Reads the ZIP central directory without extracting anything to disk. */
function readZipEntries(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  if (buf.length < 22) fail("That file is not a valid .apkg archive.");
  let eocd = -1;
  const stop = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= stop; i--) {
    if (u32(buf, i) === ZIP_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail("That file is not a valid .apkg archive: the ZIP directory is missing.");
  const entries = new Map();
  const total = u16(buf, eocd + 10);
  const cdOffset = u32(buf, eocd + 16);
  if (cdOffset === 0xffffffff || total === 0xffff) fail("ZIP64 .apkg files are not supported. Export the deck as Anki text instead.");
  if (cdOffset >= buf.length) fail("That .apkg file is damaged: its ZIP directory is outside the file.");
  let p = cdOffset;
  for (let index = 0; index < total; index++) {
    if (p + 46 > buf.length || u32(buf, p) !== ZIP_CENTRAL) fail("That .apkg file has a damaged ZIP directory.");
    const flags = u16(buf, p + 8);
    const method = u16(buf, p + 10);
    const compressedSize = u32(buf, p + 20);
    const uncompressedSize = u32(buf, p + 24);
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    const localOffset = u32(buf, p + 42);
    const nameEnd = p + 46 + nameLen;
    if (nameEnd > buf.length) fail("That .apkg file has a damaged ZIP entry name.");
    const name = buf.toString("utf8", p + 46, nameEnd);
    if (flags & 0x1) fail(`The .apkg entry ${name} is encrypted and cannot be read.`);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) fail("ZIP64 .apkg files are not supported. Export the deck as Anki text instead.");
    if (localOffset + 30 > buf.length || u32(buf, localOffset) !== ZIP_LOCAL) fail(`The .apkg entry ${name} has a damaged local header.`);
    const localName = u16(buf, localOffset + 26);
    const localExtra = u16(buf, localOffset + 28);
    const dataStart = localOffset + 30 + localName + localExtra;
    if (dataStart + compressedSize > buf.length) fail(`The .apkg entry ${name} is truncated.`);
    let data;
    if (method === 0) {
      data = buf.subarray(dataStart, dataStart + compressedSize);
    } else if (method === 8) {
      data = inflateRaw(buf.subarray(dataStart, dataStart + compressedSize));
    } else {
      fail(`The .apkg entry ${name} uses an unsupported ZIP compression method (${method}).`);
    }
    if (Number(uncompressedSize) !== data.length) fail(`The .apkg entry ${name} has the wrong size after decompression.`);
    entries.set(name.replace(/\\/g, "/"), data);
    p = nameEnd + extraLen + commentLen;
  }
  return entries;
}

function sqliteVarint(buf, offset) {
  let value = 0;
  for (let i = 0; i < 9; i++) {
    const byte = buf[offset + i];
    if (byte === undefined) fail("The Anki collection is truncated.");
    if (i === 8) {
      value = value * 256 + byte;
      return { value, next: offset + 9 };
    }
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return { value, next: offset + i + 1 };
  }
  return { value, next: offset + 9 };
}

function int64(buf, offset) {
  const high = buf.readInt32BE(offset);
  const low = buf.readUInt32BE(offset + 4);
  return high * 4294967296 + low;
}

function decodeValue(buf, serial, offset) {
  if (serial === 0) return null;
  if (serial === 1) return buf.readInt8(offset);
  if (serial === 2) return buf.readInt16BE(offset);
  if (serial === 3) return (buf.readUInt8(offset) << 16) | buf.readUInt16BE(offset + 1);
  if (serial === 4) return buf.readInt32BE(offset);
  if (serial === 5) return buf.readUInt8(offset) * 4294967296 + buf.readUInt32BE(offset + 1);
  if (serial === 6) return int64(buf, offset);
  if (serial === 7) return buf.readDoubleBE(offset);
  if (serial === 8) return 0;
  if (serial === 9) return 1;
  if (serial === 10 || serial === 11) return null;
  const length = serial % 2 === 0 ? (serial - 12) / 2 : (serial - 13) / 2;
  const end = offset + length;
  if (end > buf.length) fail("The Anki collection has a truncated record.");
  return buf.toString("utf8", offset, end);
}

function decodeRecord(payload) {
  const header = sqliteVarint(payload, 0);
  const headerEnd = header.value;
  if (headerEnd < header.next || headerEnd > payload.length) fail("The Anki collection has a damaged record header.");
  const serials = [];
  let p = header.next;
  while (p < headerEnd) {
    const serial = sqliteVarint(payload, p);
    serials.push(serial.value);
    p = serial.next;
  }
  if (p !== headerEnd) fail("The Anki collection has a damaged record header.");
  const values = [];
  p = headerEnd;
  for (const serial of serials) {
    const length = serialLength(serial);
    values.push(decodeValue(payload, serial, p));
    p += length;
    if (p > payload.length) fail("The Anki collection has a truncated record.");
  }
  return values;
}

function serialLength(serial) {
  if (serial >= 12) return serial % 2 === 0 ? (serial - 12) / 2 : (serial - 13) / 2;
  if ([1, 2, 3, 4].includes(serial)) return [0, 1, 2, 3, 4][serial];
  if (serial === 5) return 6;
  if (serial === 6 || serial === 7) return 8;
  return 0;
}

function pageSizeOf(header) {
  const raw = be16(header, 16);
  return raw === 1 ? 65536 : raw;
}

class SqliteReader {
  constructor(buf) {
    this.buf = buf;
    if (buf.length < 100 || buf.toString("ascii", 0, 16) !== "SQLite format 3\u0000") {
      fail("The Anki collection inside this .apkg is not a SQLite database.");
    }
    const rawPage = pageSizeOf(buf);
    if (rawPage < 512 || rawPage > 65536 || (rawPage & (rawPage - 1)) !== 0) fail("The Anki collection has an invalid SQLite page size.");
    this.pageSize = rawPage;
    this.reserved = buf[20] || 0;
    this.usableSize = rawPage - this.reserved;
    if (this.usableSize < 480) fail("The Anki collection has an invalid SQLite page layout.");
    this.pageCount = Math.floor(buf.length / rawPage);
    this.cache = new Map();
  }

  page(pageNumber) {
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > this.pageCount) fail("The Anki collection points to a missing SQLite page.");
    if (this.cache.has(pageNumber)) return this.cache.get(pageNumber);
    const start = (pageNumber - 1) * this.pageSize;
    const end = start + this.pageSize;
    if (end > this.buf.length) fail("The Anki collection is truncated.");
    const view = { number: pageNumber, start, header: pageNumber === 1 ? 100 : 0 };
    this.cache.set(pageNumber, view);
    return view;
  }

  payload(payloadOffset, payloadSize, localSize) {
    const out = Buffer.alloc(payloadSize);
    let copied = Math.min(localSize, payloadSize);
    this.buf.copy(out, 0, payloadOffset, payloadOffset + copied);
    let next = payloadSize > localSize ? be32(this.buf, payloadOffset + localSize) : 0;
    let guard = 0;
    while (next && copied < payloadSize) {
      if (++guard > this.pageCount + 1) fail("The Anki collection has a looping overflow page.");
      const page = this.page(next);
      const available = Math.min(this.usableSize - 4, payloadSize - copied);
      this.buf.copy(out, copied, page.start + 4, page.start + 4 + available);
      copied += available;
      next = be32(this.buf, page.start);
    }
    if (copied !== payloadSize) fail("The Anki collection has a truncated overflow page.");
    return out;
  }

  rows(rootPage) {
    const out = [];
    const seen = new Set();
    this.walk(rootPage, out, seen);
    return out;
  }

  walk(pageNumber, out, seen) {
    if (seen.has(pageNumber)) fail("The Anki collection has a looping SQLite page.");
    seen.add(pageNumber);
    const page = this.page(pageNumber);
    const type = this.buf[page.start + page.header];
    const cells = be16(this.buf, page.start + page.header + 3);
    if (type === 0x0d) {
      const pointer = page.start + page.header + 8;
      for (let i = 0; i < cells; i++) {
        const cellOffset = be16(this.buf, pointer + i * 2);
        const at = page.start + cellOffset;
        const payloadSize = sqliteVarint(this.buf, at);
        const rowId = sqliteVarint(this.buf, payloadSize.next);
        const payloadStart = rowId.next;
        const maxLocal = this.usableSize - 35;
        const minLocal = Math.floor(((this.usableSize - 12) * 32) / 255) - 23;
        const local = payloadSize.value <= maxLocal ? payloadSize.value : minLocal + ((payloadSize.value - minLocal) % (this.usableSize - 4));
        const record = decodeRecord(this.payload(payloadStart, payloadSize.value, local));
        // SQLite stores an INTEGER PRIMARY KEY as the rowid and leaves its
        // column slot null; expose the rowid so `id` behaves like SQLite's.
        if ((record[0] === null || record[0] === undefined) && Number.isSafeInteger(rowId.value)) record[0] = rowId.value;
        out.push(record);
      }
      return;
    }
    if (type === 0x05) {
      const pointer = page.start + page.header + 12;
      for (let i = 0; i < cells; i++) {
        const cellOffset = be16(this.buf, pointer + i * 2);
        const child = be32(this.buf, page.start + cellOffset);
        this.walk(child, out, seen);
      }
      this.walk(be32(this.buf, page.start + page.header + 8), out, seen);
      return;
    }
    fail("The Anki collection uses an unsupported SQLite b-tree page.");
  }
}

function unquoteName(value) {
  const text = str(value).trim();
  if (!text) return "";
  if (text[0] === '"' || text[0] === "`" || text[0] === "[") {
    const close = text[0] === "[" ? "]" : text[0];
    const end = text.indexOf(close, 1);
    return end > 0 ? text.slice(1, end) : text.slice(1);
  }
  const m = text.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
  return m ? m[1] : "";
}

/** Column names from a CREATE TABLE statement; generated Anki schemas are stable but no assumptions are needed. */
function columnsFromSql(sql, table) {
  const text = str(sql);
  const body = text.slice(text.indexOf("(") + 1, text.lastIndexOf(")"));
  const out = [];
  let depth = 0;
  let quote = "";
  let part = "";
  for (const char of body) {
    if (quote) {
      part += char;
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "`" || char === "'" || char === "[") {
      quote = char === "[" ? "]" : char;
      part += char;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      const name = unquoteName(part);
      if (name && !/^(primary|foreign|unique|constraint|check)$/i.test(name)) out.push(name);
      part = "";
    } else {
      part += char;
    }
  }
  const last = unquoteName(part);
  if (last && !/^(primary|foreign|unique|constraint|check)$/i.test(last)) out.push(last);
  return out;
}

function objectRows(table, rows) {
  const columns = columnsFromSql(table.sql, table.name);
  if (!columns.length) return rows;
  return rows.map((row) => {
    const out = {};
    columns.forEach((name, index) => {
      out[name] = row[index];
    });
    return out;
  });
}

function parseCollection(buf) {
  const db = new SqliteReader(buf);
  const master = db.rows(1);
  const tables = new Map();
  for (const row of master) {
    if (str(row[0]).toLowerCase() !== "table") continue;
    const name = str(row[1]);
    const root = Number(row[3]);
    if (!name || !Number.isInteger(root) || root < 1) continue;
    tables.set(name, { name, root, sql: str(row[4]) });
  }
  return { db, tables };
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(str(value));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function oneLine(value) {
  return str(value).replace(/\[sound:[^\]]+\]/gi, "").replace(/<img\b[^>]*>/gi, "").trim();
}

function noteFields(raw) {
  return str(raw).split("\x1f");
}

function noteTags(raw) {
  return str(raw)
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function dueDate(card, collection) {
  if (!card || Number(card.type) !== 2) return "";
  const due = Number(card.due);
  const crt = Number(collection && collection.crt);
  if (!Number.isFinite(due) || due <= 0 || !Number.isFinite(crt) || crt <= 0) return "";
  const date = new Date((crt + due * 86400) * 1000);
  if (isNaN(date.getTime())) return "";
  const iso = date.toISOString().slice(0, 10);
  return iso >= "1970-01-02" && iso <= "2200-12-31" ? iso : "";
}

/**
 * Reads notes and their first card from an .apkg. The result has the same
 * shape as every other card importer, so normal duplicate and update handling
 * applies.
 */
function parseApkg(input, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "Anki package");
  const fallbackDeck = str(opts.deck).trim() || "Imported";
  const entries = readZipEntries(input);
  const sqliteName = ["collection.anki21", "collection.anki2"].find((name) => entries.has(name));
  if (!sqliteName) {
    if (entries.has("collection.anki21b")) {
      fail("This .apkg uses Anki's newer compressed collection format, which this plugin cannot read yet. Open it in Anki and export Notes in Plain Text.");
    }
    fail("That .apkg has no Anki collection inside it. Export the deck again from Anki.");
  }
  const { db, tables } = parseCollection(entries.get(sqliteName));
  const notesTable = tables.get("notes");
  if (!notesTable) fail("That .apkg has no notes table. It may be a media-only package.");
  const cardsTable = tables.get("cards");
  const collectionTable = tables.get("col");
  const noteRows = objectRows(notesTable, db.rows(notesTable.root));
  const cardRows = cardsTable ? objectRows(cardsTable, db.rows(cardsTable.root)) : [];
  const collectionRows = collectionTable ? objectRows(collectionTable, db.rows(collectionTable.root)) : [];
  const collection = collectionRows[0] || {};
  const models = parseJson(collection.models, {});
  const decks = parseJson(collection.decks, {});
  const cardsByNote = new Map();
  for (const card of cardRows) {
    const nid = str(card.nid);
    if (!nid || cardsByNote.has(nid)) continue;
    cardsByNote.set(nid, card);
  }
  const media = parseJson(entries.has("media") ? entries.get("media").toString("utf8") : "", {});
  const mediaNames = Object.keys(media);
  const mediaCount = mediaNames.length;
  const cards = [];
  const errors = [];
  const skippedDetails = [];
  const warnings = mediaCount ? [`${mediaCount} media file${mediaCount === 1 ? "" : "s"} were not imported; images and audio stay in Anki.`] : [];
  let skipped = 0;
  for (const note of noteRows) {
    const fields = noteFields(note.flds);
    const rawFront = str(fields[0]).trim();
    if (!rawFront) {
      skipped++;
      skippedDetails.push({ row: str(note.id) || `note ${skipped}`, reason: "No front field" });
      continue;
    }
    const model = models[str(note.mid)] || {};
    const modelName = str(model.name).trim();
    const card = cardsByNote.get(str(note.id)) || {};
    const deck = str((decks[str(card.did)] || {}).name).trim() || fallbackDeck;
    const cloze = Number(model.type) === 1 || /cloze/i.test(modelName);
    let cardType = "basic";
    let front = htmlToMarkdown(oneLine(rawFront), true);
    let back = "";
    if (cloze) {
      const answers = parseCloze(front).answers;
      if (!answers.length) {
        skipped++;
        skippedDetails.push({ row: str(note.id) || `note ${skipped}`, reason: "No cloze answer" });
        continue;
      }
      cardType = "cloze";
      back = answers.join(" · ");
    } else {
      cardType = Number(card.ord) === 1 || /revers/i.test(modelName) ? "reversed" : "basic";
      back = htmlToMarkdown(oneLine(fields.slice(1).filter((value) => str(value).trim()).join("\n\n")), true);
    }
    if (!front || !back) {
      skipped++;
      skippedDetails.push({ row: str(note.id) || `note ${skipped}`, reason: "Missing front or back" });
      continue;
    }
    const schedule = dueDate(card, collection);
    cards.push({
      kind: "card",
      cardType,
      deck,
      front,
      back,
      tags: noteTags(note.tags),
      importSource: source,
      importFormat: "apkg",
      importKey: `apkg:${str(note.guid).trim() || str(note.id)}`,
      attempts: Math.max(0, Math.round(Number(card.reps) || 0)),
      nextReview: schedule,
      ankiNoteId: str(note.id),
      ankiCardId: str(card.id),
      ankiGuid: str(note.guid),
      ankiDeck: deck,
      ankiModel: modelName,
      ankiDue: Number(card.due) || 0,
      ankiInterval: Math.max(0, Number(card.ivl) || 0),
      ankiReps: Math.max(0, Number(card.reps) || 0),
      ankiLapses: Math.max(0, Number(card.lapses) || 0),
      ankiOrd: Number(card.ord) || 0,
    });
  }
  if (!cards.length && !skipped) errors.push("No notes were found in that .apkg.");
  return { cards, skipped, errors, warnings, source, format: "apkg", skippedDetails, media: { total: mediaCount, imported: 0, names: mediaNames.slice(0, 50) } };
}

module.exports = {
  readZipEntries,
  parseCollection,
  parseApkg,
  columnsFromSql,
  decodeRecord,
  SqliteReader,
};
