"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");

const { T } = load();
const scanner = T.paperScanner;

/** A tiny structurally valid JPEG header with a 32x16 SOF0 frame. */
function sampleJpeg() {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

test("paper scanner: reads JPEG dimensions from the start-of-frame marker", () => {
  assert.deepEqual(scanner.jpegSize(sampleJpeg()), { width: 32, height: 16 });
  assert.throws(() => scanner.jpegSize(new Uint8Array([1, 2, 3])), /not a JPEG/);
});

test("paper scanner: builds one PDF page per photo with a valid xref and trailer", () => {
  const jpeg = sampleJpeg();
  const pdf = scanner.buildPdfFromJpegs([
    { bytes: jpeg, width: 32, height: 16 },
    { bytes: jpeg, width: 32, height: 16 },
  ]);
  const text = Buffer.from(pdf).toString("latin1");
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/Kids \[3 0 R 6 0 R\] \/Count 2/);
  assert.match(text, /\/Filter \/DCTDecode/);
  assert.match(text, /\/MediaBox \[0 0 32 16\]/);
  assert.match(text, /%%EOF\n$/);
  const start = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(start, start + 4), "xref");
  assert.match(text.slice(start), /^xref\n0 9\n0000000000 65535 f \n/);
});

test("paper scanner: crop and rotation are normalized before drawing", () => {
  assert.equal(scanner.normalizeRotation(450), 90);
  assert.equal(scanner.normalizeRotation(-90), 270);
  assert.deepEqual(scanner.normalizeCrop({ x: -1, y: 2, w: 3, h: 0 }), { x: 0, y: 0.99, w: 1, h: 0.01 });
});

test("paper scanner: crop is measured before rotation and the output is size-capped", () => {
  const portrait = scanner.scanGeometry(100, 50, { x: 0.2, y: 0.1, w: 0.5, h: 0.8 }, 90, 2400);
  assert.equal(portrait.sourceX, 20);
  assert.equal(portrait.sourceY, 5);
  assert.equal(portrait.sourceWidth, 50);
  assert.equal(portrait.sourceHeight, 40);
  assert.equal(portrait.width, 40);
  assert.equal(portrait.height, 50);
  const small = scanner.scanGeometry(100, 50, scanner.FULL_CROP, 0, 10);
  assert.equal(small.width, 10);
  assert.equal(small.height, 5);
  assert.equal(small.scale, 0.1);
});

test("paper scanner: refuses an empty scan and chooses a non-colliding vault path", () => {
  assert.throws(() => scanner.buildPdfFromJpegs([]), /at least one photo/);
  const taken = new Set(["Paper scans/Scan 2026-10-29.pdf", "Paper scans/Scan 2026-10-29 2.pdf"]);
  const vault = { getAbstractFileByPath: (path) => (taken.has(path) ? {} : null) };
  assert.equal(scanner.uniquePath(vault, "Paper scans", "Scan 2026-10-29", "pdf"), "Paper scans/Scan 2026-10-29 3.pdf");
});
