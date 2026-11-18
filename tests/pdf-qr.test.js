"use strict";
/*
 * QR codes on imported pages. A printed symbol is part of the page furniture, not a figure a
 * question needs: it is never cropped into the vault, and the "scan me" caption and bare link
 * that come with it are left out of the text the importer reads.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");

const PAGE_W = 612;
const PAGE_H = 792;

function blankPage(width, height) {
  return { data: new Uint8ClampedArray(width * height * 4).fill(255), width, height };
}

function fill(page, box, rgb) {
  const { data, width } = page;
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * width + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
}

/** A real-looking symbol: a module grid with the three corner finder patterns. */
function drawQr(page, origin, size, modules) {
  const module = size / modules;
  const cell = (col, row) => ({
    x0: Math.round(origin.x + col * module),
    y0: Math.round(origin.y + row * module),
    x1: Math.round(origin.x + (col + 1) * module),
    y1: Math.round(origin.y + (row + 1) * module),
  });
  const paint = (col, row, rgb) => fill(page, cell(col, row), rgb);
  const BLACK = [0, 0, 0];
  const WHITE = [255, 255, 255];
  fill(page, { x0: origin.x, y0: origin.y, x1: origin.x + size, y1: origin.y + size }, WHITE);
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) paint(col, row, rand() < 0.5 ? BLACK : WHITE);
  }
  for (const [col, row] of [[0, 0], [modules - 7, 0], [0, modules - 7]]) {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const edge = dy === 0 || dy === 6 || dx === 0 || dx === 6;
        const core = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
        paint(col + dx, row + dy, edge || core ? BLACK : WHITE);
      }
    }
  }
  return { x0: origin.x, y0: origin.y, x1: origin.x + size, y1: origin.y + size };
}

/** A photograph: everything lives in mid grey, like a photo or a shaded map. */
function drawPhoto(page, box) {
  let seed = 11;
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const v = 90 + ((seed / 2147483648) * 110) | 0;
      const i = (y * page.width + x) * 4;
      page.data[i] = v;
      page.data[i + 1] = Math.min(255, v + 12);
      page.data[i + 2] = Math.max(0, v - 10);
      page.data[i + 3] = 255;
    }
  }
  return box;
}

// src/pdf.js captures loadPdfJs when the bundle loads, so the provider is swapped through one
// function the tests can replace.
let provider = () => {
  throw new Error("this test never opens a document");
};
obsidian.loadPdfJs = async () => provider();
load();
const pdf = require("../src/pdf");

const NO_TEXT_BOXES = [];

test("a QR code is not captured as a figure", () => {
  const page = blankPage(PAGE_W, PAGE_H);
  const qr = drawQr(page, { x: 380, y: 120 }, 180, 25);
  assert.equal(pdf.qrSignature(page.data, PAGE_W, PAGE_H, qr), true, "the symbol reads as a QR code");
  assert.deepEqual(pdf.detectFigures(page.data, PAGE_W, PAGE_H, NO_TEXT_BOXES, 1), [], "nothing is cropped");
});

test("a photographed diagram on the same page is still captured", () => {
  const page = blankPage(PAGE_W, PAGE_H);
  drawQr(page, { x: 380, y: 120 }, 180, 25);
  const photo = drawPhoto(page, { x0: 80, y0: 400, x1: 330, y1: 560 });
  const figs = pdf.detectFigures(page.data, PAGE_W, PAGE_H, NO_TEXT_BOXES, 1);
  assert.equal(figs.length, 1, "only the picture is a figure");
  assert.ok(figs[0].x0 <= photo.x0 + 8 && figs[0].x1 >= photo.x1 - 8, "the picture keeps its own box");
});

test("a solid logo is a figure, not a symbol", () => {
  const page = blankPage(PAGE_W, PAGE_H);
  const logo = { x0: 300, y0: 200, x1: 420, y1: 320 };
  fill(page, logo, [10, 10, 10]);
  assert.equal(pdf.qrSignature(page.data, PAGE_W, PAGE_H, logo), false, "one tone is not a symbol");
  assert.equal(pdf.detectFigures(page.data, PAGE_W, PAGE_H, NO_TEXT_BOXES, 1).length, 1, "the logo is kept");
});

test("a wide bar-code strip is a figure, not a square symbol", () => {
  const page = blankPage(PAGE_W, PAGE_H);
  const strip = { x0: 120, y0: 500, x1: 400, y1: 560 };
  for (let x = strip.x0; x < strip.x1; x += 8) fill(page, { x0: x, y0: strip.y0, x1: x + 4, y1: strip.y1 }, [0, 0, 0]);
  assert.equal(pdf.qrSignature(page.data, PAGE_W, PAGE_H, strip), false, "a strip is not square");
});

test("a QR symbol with a printed margin is still recognised", () => {
  const page = blankPage(PAGE_W, PAGE_H);
  drawQr(page, { x: 300, y: 200 }, 210, 29);
  const wide = { x0: 290, y0: 190, x1: 520, y1: 420 };
  assert.equal(pdf.qrSignature(page.data, PAGE_W, PAGE_H, wide), true, "a quiet zone does not hide the symbol");
});

test("the scan-me caption and its bare link leave the page text", () => {
  assert.equal(pdf.isQrScaffoldLine("Scan to open on Studocu"), true);
  assert.equal(pdf.isQrScaffoldLine("Scan the QR code to download the app"), true);
  assert.equal(pdf.isQrScaffoldLine("Scan me"), true);
  assert.equal(pdf.isQrScaffoldLine("https://www.studocu.com/en/document/682243944"), true);
  assert.equal(pdf.isQrScaffoldLine("www.example.org/unit-4"), true);
  assert.equal(pdf.isQrScaffoldLine("Question 1: Which of the following best explains the trade?"), false);
  assert.equal(pdf.isQrScaffoldLine("Scanner software reads the codes on page 4."), false);
  assert.equal(pdf.isQrScaffoldLine("A. The arrival of Portuguese and other Europeans"), false);
  assert.equal(pdf.isQrScaffoldLine(""), false);
});

test("page text keeps every question line and drops the QR furniture", () => {
  const lines = [
    { text: "Scan to open on Studocu", y: 40 },
    { text: "https://www.studocu.com/en/document/682243944", y: 60 },
    { text: "1. Which of the following best explains Europe's ability to gain trade?", y: 120 },
    { text: "A. Easing of tensions among European states", y: 144 },
    { text: "Downloaded by Bobby Joe (hummingbirdrhino@gmail.com)", y: 760 },
  ];
  const kept = pdf.withoutQrScaffold(lines).map((line) => line.text);
  assert.deepEqual(kept, [
    "1. Which of the following best explains Europe's ability to gain trade?",
    "A. Easing of tensions among European states",
    "Downloaded by Bobby Joe (hummingbirdrhino@gmail.com)",
  ]);
  const text = pdf.pageText(pdf.withoutQrScaffold(lines), []);
  assert.doesNotMatch(text, /scan to open/i);
  assert.doesNotMatch(text, /studocu\.com/);
  assert.match(text, /Which of the following best explains/);
});

test("readPdfPages hands the importer a page without the QR caption", async () => {
  const items = [
    { str: "Scan to open on Studocu", transform: [1, 0, 0, 12, 72, 720], width: 150, height: 12, hasEOL: true },
    { str: "1. Which of the following best explains Europe's ability to gain trade?", transform: [1, 0, 0, 12, 72, 680], width: 400, height: 12, hasEOL: true },
    { str: "https://www.studocu.com/en/document/682243944", transform: [1, 0, 0, 10, 72, 640], width: 220, height: 10, hasEOL: true },
  ];
  provider = async () => ({
    getDocument() {
      return {
        promise: Promise.resolve({
          numPages: 1,
          async getPage() {
            return {
              async getTextContent() {
                return { items };
              },
              getViewport() {
                return { width: PAGE_W, height: PAGE_H, scale: 1, transform: [1, 0, 0, 1, 0, 0] };
              },
              async render() {
                return { promise: Promise.resolve() };
              },
            };
          },
          async destroy() {},
        }),
      };
    },
  });
  const read = await pdf.readPdfPages(Buffer.from("%PDF-1.4"), "", () => {});
  assert.equal(read.pages.length, 1);
  assert.match(read.pages[0].text, /Which of the following best explains/);
  assert.doesNotMatch(read.pages[0].text, /Scan to open/);
  assert.doesNotMatch(read.pages[0].text, /studocu\.com/);
  assert.equal(read.pages[0].lines.length, 1, "the gap-line copy is cleaned too");
});
