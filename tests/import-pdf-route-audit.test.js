"use strict";
/*
 * End-to-end Quizlet PDF import audit. PDF.js is mocked with the same page/item
 * shape Obsidian provides; extraction and writing are the real plugin paths.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");
const { makeApp } = require("./helpers/fake");

let pages = [];
obsidian.loadPdfJs = async () => ({
  getDocument() {
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
});

const { Plugin: QT } = load();

function line(text, index) {
  return {
    str: text,
    hasEOL: true,
    transform: [1, 0, 0, 1, 10, 740 - index * 20],
    width: text.length * 6,
    height: 12,
  };
}

test("route: Quizlet PDF extracts and writes cards through the real importer", async () => {
  pages = [
    [
      line("Quizlet", 0),
      line("Spanish Basics", 1),
      line("Terms in this set (2)", 2),
      line("hola\thello", 3),
      line("adiós\tgoodbye", 4),
    ],
  ];
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.cards.enabled = true;
  const bytes = new TextEncoder().encode("%PDF-1.4 audit bytes");
  const preview = await plugin.previewCardsImport("quizlet", "spanish-set.pdf", {
    pdfData: bytes,
    pdfName: "spanish-set.pdf",
    deck: "Spanish",
  });
  assert.equal(preview.errors.length, 0);
  assert.equal(preview.total, 2);
  assert.equal(app.created?.length || 0, 0);
  const result = await plugin.importCardsFromQuizlet("spanish-set.pdf", {
    pdfData: bytes,
    pdfName: "spanish-set.pdf",
    deck: "Spanish",
    course: "SPAN 101",
  });
  assert.equal(result.created, 2);
  assert.equal(app.created.length, 2);
  assert.match(app.created[0].text, /## Front\n\nhola/);
  assert.match(app.created[0].text, /## Back\n\nhello/);
  assert.match(app.created[0].text, /import_format: "quizlet-pdf"/);
  assert.match(app.created[0].text, /source_page: "1"/);
  assert.match(app.created[0].text, /course: "SPAN 101"/);
});
