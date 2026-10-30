"use strict";
/*
 * A minimal SQLite writer for the Anki collection inside an .apkg.
 *
 * Anki's collection is an ordinary SQLite database with three small tables
 * (col, notes, cards) plus empty revlog/graves tables. This writes that subset
 * directly: table leaf pages, one interior page when a table spans pages, the
 * sqlite_master page and the 100-byte database header. No SQL is executed and
 * no dependency is added. The result is validated by opening it with SQLite in
 * src/apkg-export tests; the reader in apkg.js can read it back too.
 */
const PAGE = 65536;
const TEXT = new TextEncoder();

function setU16(buf, offset, value) {
  buf[offset] = (value >>> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

function setU32(buf, offset, value) {
  buf[offset] = Math.floor(value / 0x1000000) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** SQLite's big-endian variable-length integer for non-negative values. */
function varint(value) {
  let n = BigInt(Math.max(0, Math.floor(Number(value) || 0)));
  if (n < 0x80n) return new Uint8Array([Number(n)]);
  const groups = [];
  while (n > 0n) {
    groups.unshift(Number(n & 0x7fn));
    n >>= 7n;
  }
  const out = new Uint8Array(groups.length);
  for (let i = 0; i < groups.length; i++) out[i] = i === groups.length - 1 ? groups[i] : 0x80 | groups[i];
  return out;
}

function intBytes(value, length) {
  const out = new Uint8Array(length);
  let n = BigInt(value);
  if (n < 0n) n += 1n << BigInt(length * 8);
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

function encodeValue(value) {
  if (value === null || value === undefined) return { serial: 0, bytes: new Uint8Array(0) };
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      const bytes = new Uint8Array(8);
      new DataView(bytes.buffer).setFloat64(0, value, false);
      return { serial: 7, bytes };
    }
    if (value === 0) return { serial: 8, bytes: new Uint8Array(0) };
    if (value === 1) return { serial: 9, bytes: new Uint8Array(0) };
    if (value >= -128 && value <= 127) return { serial: 1, bytes: intBytes(value, 1) };
    if (value >= -32768 && value <= 32767) return { serial: 2, bytes: intBytes(value, 2) };
    if (value >= -8388608 && value <= 8388607) return { serial: 3, bytes: intBytes(value, 3) };
    if (value >= -2147483648 && value <= 2147483647) return { serial: 4, bytes: intBytes(value, 4) };
    if (value >= -140737488355328 && value <= 140737488355327) return { serial: 5, bytes: intBytes(value, 6) };
    return { serial: 6, bytes: intBytes(value, 8) };
  }
  if (typeof value === "boolean") return encodeValue(value ? 1 : 0);
  const bytes = value instanceof Uint8Array ? value : TEXT.encode(String(value));
  const isBlob = value instanceof Uint8Array;
  return { serial: (isBlob ? 12 : 13) + bytes.length * 2, bytes };
}

function encodeRecord(values) {
  const parts = values.map(encodeValue);
  const serialBytes = parts.map((part) => varint(part.serial));
  const serialLength = serialBytes.reduce((sum, part) => sum + part.length, 0);
  let headerLength = 1 + serialLength;
  for (let i = 0; i < 4; i++) {
    const next = varint(headerLength).length + serialLength;
    if (next === headerLength) break;
    headerLength = next;
  }
  return concat([varint(headerLength), ...serialBytes, ...parts.map((part) => part.bytes)]);
}

function leafCells(rows, rowidAlias) {
  return rows.map((row, index) => {
    const aliased = rowidAlias !== false;
    const rowid = aliased ? row[0] : index + 1;
    // SQLite stores an INTEGER PRIMARY KEY as a NULL placeholder in the record;
    // the real value is the cell's rowid. A table without that alias keeps every
    // column in the record and only uses the rowid for the b-tree key.
    const values = aliased ? [null, ...row.slice(1)] : row;
    const payload = encodeRecord(values);
    return { rowid, cell: concat([varint(payload.length), varint(rowid), payload]), key: rowid };
  });
}

function leafPage(cells, headerOffset) {
  const page = new Uint8Array(PAGE);
  const at = headerOffset || 0;
  page[at] = 0x0d;
  setU16(page, at + 1, 0);
  setU16(page, at + 3, cells.length);
  let content = PAGE;
  const pointers = [];
  for (const cell of cells) {
    content -= cell.cell.length;
    if (content < at + 8 + cells.length * 2) throw new Error("A row is too large for the SQLite page.");
    page.set(cell.cell, content);
    pointers.push(content);
  }
  setU16(page, at + 5, content);
  page[at + 7] = 0;
  for (let i = 0; i < pointers.length; i++) setU16(page, at + 8 + i * 2, pointers[i]);
  return page;
}

function interiorPage(children, keys) {
  const page = new Uint8Array(PAGE);
  page[0] = 0x05;
  setU16(page, 1, 0);
  setU16(page, 3, children.length - 1);
  setU16(page, 7, 0);
  setU32(page, 8, children[children.length - 1].number);
  let content = PAGE;
  const pointers = [];
  for (let i = 0; i < children.length - 1; i++) {
    const cell = concat([new Uint8Array([(children[i].number >>> 24) & 0xff, (children[i].number >>> 16) & 0xff, (children[i].number >>> 8) & 0xff, children[i].number & 0xff]), varint(keys[i])]);
    content -= cell.length;
    page.set(cell, content);
    pointers.push(content);
  }
  setU16(page, 5, content);
  for (let i = 0; i < pointers.length; i++) setU16(page, 12 + i * 2, pointers[i]);
  return page;
}

/** Groups rows into leaf pages, adding one interior root page when needed. */
function tablePages(rows, rowidAlias) {
  const cells = leafCells(rows, rowidAlias);
  const leaves = [];
  let bucket = [];
  let used = 0;
  for (const cell of cells) {
    const count = bucket.length + 1;
    if (bucket.length && 8 + count * 2 + used + cell.cell.length > PAGE) {
      leaves.push({ kind: "leaf", cells: bucket });
      bucket = [];
      used = 0;
    }
    if (8 + 2 + cell.cell.length > PAGE) throw new Error("A row is too large for the SQLite page.");
    bucket.push(cell);
    used += cell.cell.length;
  }
  leaves.push({ kind: "leaf", cells: bucket });
  if (leaves.length === 1) return { pages: leaves, root: leaves[0] };
  const children = leaves.slice();
  const interior = { kind: "interior", children, keys: children.map((leaf) => leaf.cells[leaf.cells.length - 1].key) };
  leaves.push(interior);
  return { pages: leaves, root: interior };
}

function databaseHeader(pageCount) {
  const header = new Uint8Array(100);
  header.set(TEXT.encode("SQLite format 3\u0000"), 0);
  setU16(header, 16, PAGE === 65536 ? 1 : PAGE);
  header[18] = 1;
  header[19] = 1;
  header[20] = 0;
  header[21] = 64;
  header[22] = 32;
  header[23] = 32;
  setU32(header, 24, 1);
  setU32(header, 28, pageCount);
  setU32(header, 32, 0);
  setU32(header, 36, 0);
  setU32(header, 40, 1);
  setU32(header, 44, 4);
  setU32(header, 48, 0);
  setU32(header, 52, 0);
  setU32(header, 56, 1);
  setU32(header, 60, 0);
  setU32(header, 64, 0);
  setU32(header, 68, 0);
  setU32(header, 92, 1);
  setU32(header, 96, 3045001);
  return header;
}

/**
 * Builds a complete SQLite database from `[{ name, sql, rows }]`.
 * Each row is a value array whose first value is its integer primary key.
 */
function buildSqlite(tables) {
  const built = tables.map((table) => ({ ...table, ...tablePages(table.rows, table.rowidAlias) }));
  const pages = [];
  for (const table of built) pages.push(...table.pages);
  pages.forEach((page, index) => {
    page.number = index + 2;
  });
  const masterRows = built.map((table, index) => ["table", table.name, table.name, table.root.number, table.sql]);
  const master = leafPage(leafCells(masterRows, false), 100);
  master.set(databaseHeader(pages.length + 1), 0);
  const body = pages.map((page) => (page.kind === "leaf" ? leafPage(page.cells, 0) : interiorPage(page.children, page.keys)));
  return concat([master, ...body]);
}

module.exports = { buildSqlite, PAGE, varint, encodeRecord };
