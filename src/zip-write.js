"use strict";
/*
 * A minimal ZIP writer for formats this plugin creates itself (.mochi).
 *
 * Entries are stored (method 0), not deflated: the payloads are small JSON/EDN
 * text, so compression would only add code and a dependency. The layout follows
 * PKWARE APPNOTE 4.5: local headers, a central directory and one EOCD record.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS date/time, the only timestamp a ZIP header carries. */
function dosDateTime(value) {
  const d = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Writes a ZIP archive with stored entries.
 * `entries` is [{ name, data }] where data is a string or a Uint8Array.
 */
function zipStore(entries) {
  const encoder = new TextEncoder();
  const items = (Array.isArray(entries) ? entries : []).map((entry) => {
    const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data || new Uint8Array(0);
    return { name: encoder.encode(String(entry.name || "")), data, crc: crc32(data) };
  });
  const localSize = items.reduce((sum, item) => sum + 30 + item.name.length + item.data.length, 0);
  const centralSize = items.reduce((sum, item) => sum + 46 + item.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  const stamp = dosDateTime(new Date());
  let offset = 0;
  const offsets = [];
  for (const item of items) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 names
    view.setUint16(offset + 8, 0, true); // stored
    view.setUint16(offset + 10, stamp.time, true);
    view.setUint16(offset + 12, stamp.date, true);
    view.setUint32(offset + 14, item.crc, true);
    view.setUint32(offset + 18, item.data.length, true);
    view.setUint32(offset + 22, item.data.length, true);
    view.setUint16(offset + 26, item.name.length, true);
    view.setUint16(offset + 28, 0, true);
    out.set(item.name, offset + 30);
    out.set(item.data, offset + 30 + item.name.length);
    offset += 30 + item.name.length + item.data.length;
  }
  const centralStart = offset;
  items.forEach((item, index) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, stamp.time, true);
    view.setUint16(offset + 14, stamp.date, true);
    view.setUint32(offset + 16, item.crc, true);
    view.setUint32(offset + 20, item.data.length, true);
    view.setUint32(offset + 24, item.data.length, true);
    view.setUint16(offset + 28, item.name.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, offsets[index], true);
    out.set(item.name, offset + 46);
    offset += 46 + item.name.length;
  });
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, items.length, true);
  view.setUint16(offset + 10, items.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);
  return out;
}

module.exports = { zipStore, crc32 };
