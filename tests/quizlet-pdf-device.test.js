"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

let currentPages = [];
function pdfLib() {
  return {
    getDocument() {
      const pages = currentPages;
      return {
        promise: Promise.resolve({
          numPages: pages.length,
          async getPage(n) {
            return {
              async getTextContent() {
                return { items: pages[n - 1] || [] };
              },
              getViewport() {
                return { width: 612, height: 792, scale: 1, transform: [1, 0, 0, 1, 0, 0] };
              },
            };
          },
          async destroy() {},
        }),
      };
    },
  };
}

// src/pdf.js captures loadPdfJs when the bundle loads, so the fake must be in
// place before load() runs.
obsidian.loadPdfJs = async () => pdfLib();
const { Plugin: QT } = load();

function textItems(lines) {
  return lines.map((str, index) => ({
    str,
    hasEOL: true,
    transform: [1, 0, 0, 1, 10, 740 - index * 20],
    width: str.length * 6,
    height: 12,
  }));
}

async function pluginWithPages() {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  return plugin;
}

test("device Quizlet PDF: bytes are read through the browser path without Buffer", async () => {
  const plugin = await pluginWithPages();
  currentPages = [
    textItems(["Quizlet", "Spanish Basics", "Terms in this set (2)", "hola\thello", "adiós\tgoodbye"]),
  ];
  const savedBuffer = global.Buffer;
  global.Buffer = undefined;
  try {
    const result = await plugin.parseQuizletPdfCards("", {
      pdfData: new TextEncoder().encode("%PDF-1.4 device bytes"),
      pdfName: "spanish-set.pdf",
      deck: "Spanish",
    });
    assert.equal(result.errors.length, 0);
    assert.equal(result.cards.length, 2);
    assert.deepEqual(
      result.cards.map((card) => [card.front, card.back]),
      [
        ["hola", "hello"],
        ["adiós", "goodbye"],
      ]
    );
    assert.equal(result.source, "spanish-set.pdf");
    assert.equal(result.totalPages, 1);
  } finally {
    global.Buffer = savedBuffer;
  }
});

test("device Quizlet PDF: an image-only scan explains that OCR is required", async () => {
  const plugin = await pluginWithPages();
  currentPages = [[]];
  const savedBuffer = global.Buffer;
  global.Buffer = undefined;
  try {
    const result = await plugin.parseQuizletPdfCards("", {
      pdfData: new TextEncoder().encode("%PDF-1.4 scanned bytes"),
      pdfName: "scan.pdf",
      deck: "Scanned",
    });
    assert.equal(result.cards.length, 0);
    assert.match(result.errors[0], /OCR/i);
    assert.match(result.errors[0], /scan/i);
    assert.match(result.errors[0], /searchable PDF/i);
  } finally {
    global.Buffer = savedBuffer;
  }
});
