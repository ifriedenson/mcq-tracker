"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, Plugin: QT, obsidian } = load();
const links = T.pdfDeepLink;
const pdfAnnotations = T.pdfAnnotations;
const { PdfInkModal } = T;

test("pdf deep links: a rectangle is written as page fractions and read back exactly", () => {
  const link = links.formatPdfDeepLink("Papers/Ch 3.pdf", 3, {
    annotation: "ann-1",
    rect: { x: 0.1234567, y: 0.2, width: 0.3, height: 0.04 },
  });
  assert.equal(link, "[[Papers/Ch 3.pdf#page=3&annotation=ann-1&rect=0.123457,0.2,0.3,0.04]]");
  const parsed = links.parsePdfDeepLink(link);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.path, "Papers/Ch 3.pdf");
  assert.equal(parsed.page, 3);
  assert.equal(parsed.annotation, "ann-1");
  assert.deepEqual(parsed.rect, { x: 0.123457, y: 0.2, width: 0.3, height: 0.04 });
  assert.deepEqual(parsed.rect, links.normalizeRect(parsed.rect), "a parsed rect is already normalised");
});

test("pdf deep links: a page link without a rectangle stays a page link", () => {
  const link = links.formatPdfDeepLink("notes.pdf", "7");
  assert.equal(link, "[[notes.pdf#page=7]]");
  const parsed = links.parsePdfDeepLink(link);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.page, 7);
  assert.equal(parsed.rect, null);
  assert.equal(parsed.annotation, "");
  assert.match(links.describePdfDeepLink(parsed), /notes\.pdf page 7/);
});

test("pdf deep links: unusable paths, pages, ids and rectangles are refused", () => {
  assert.equal(links.formatPdfDeepLink("", 1), "", "no path");
  assert.equal(links.formatPdfDeepLink("notes.md", 1), "", "not a PDF");
  assert.equal(links.formatPdfDeepLink("notes.pdf", 0), "", "page 0");
  assert.equal(links.formatPdfDeepLink("notes.pdf", 100001), "", "past the last page");
  assert.equal(links.formatPdfDeepLink("notes.pdf", 1, { annotation: "bad id!" }), "", "a bad id");
  assert.equal(links.formatPdfDeepLink("notes.pdf", 1, { rect: { x: 0.9, y: 0.9, width: 0.5, height: 0.5 } }), "[[notes.pdf#page=1]]", "a rectangle off the page is dropped, not guessed");
  assert.equal(links.formatPdfDeepLink("notes.pdf", 1, { rect: { x: 0.1, y: 0.1, width: 0, height: 0.1 } }), "[[notes.pdf#page=1]]", "a zero width leaves a page link");
  assert.equal(links.formatPdfDeepLink("notes.pdf", 1, { rect: { x: "x", y: 0, width: 0.1, height: 0.1 } }), "[[notes.pdf#page=1]]", "a non-number leaves a page link");

  assert.equal(links.parsePdfDeepLink("[[notes.pdf#page=0]]").valid, false);
  assert.equal(links.parsePdfDeepLink("[[notes.md#page=2]]").valid, false);
  assert.equal(links.parsePdfDeepLink("not a link").valid, false);
  assert.equal(links.parsePdfDeepLink("[[notes.pdf#page=2&rect=1,2,3]]").rect, null, "a short rectangle is dropped");
  assert.equal(links.parsePdfDeepLink("[[notes.pdf#page=2&annotation=%20bad]]").annotation, "");
  assert.equal(links.describePdfDeepLink("nope"), "That is not a PDF deep link.");
});

test("pdf deep links: a multi-line selection unions into one rectangle", () => {
  const union = links.unionRect([
    { x: 0.2, y: 0.4, width: 0.2, height: 0.02 },
    { x: 0.1, y: 0.6, width: 0.3, height: 0.02 },
  ]);
  assert.deepEqual(union, { x: 0.1, y: 0.4, width: 0.3, height: 0.22 });
  assert.equal(links.unionRect([]), null);
  assert.equal(links.unionRect(null), null);
  assert.equal(links.unionRect([{ x: 0.1, y: 0.1, width: 0, height: 0.1 }]), null, "an empty area is ignored");
});

test("pdf deep links: an annotation's link carries its selection rectangle", () => {
  const link = pdfAnnotations.annotationLink("papers/ch3.pdf", 4, "ann-9", { x: 0.1, y: 0.2, width: 0.5, height: 0.03 });
  assert.equal(link, "[[papers/ch3.pdf#page=4&annotation=ann-9&rect=0.1,0.2,0.5,0.03]]");
  const plain = pdfAnnotations.annotationLink("papers/ch3.pdf", 4, "ann-9");
  assert.equal(plain, "[[papers/ch3.pdf#page=4&annotation=ann-9]]", "no rectangle when none is given");
});

test("pdf deep links: a deep link opens the reader on its page with the ring", () => {
  const opened = [];
  const plugin = Object.create(QT.prototype);
  plugin.settings = { mcqEnabled: true };
  plugin.app = { vault: { getAbstractFileByPath: (path) => (path === "ch3.pdf" ? { path } : null) } };
  plugin.openPdfInk = (path, options) => opened.push({ path, options });

  const parsed = plugin.openPdfDeepLink("[[ch3.pdf#page=5&annotation=ann-2&rect=0.1,0.2,0.3,0.04]]");
  assert.equal(parsed.page, 5);
  assert.deepEqual(opened[0].options, { page: 5, rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 }, annotation: "ann-2" });

  obsidian.notices.length = 0;
  assert.equal(plugin.openPdfDeepLink("[[missing.pdf#page=2]]"), null, "a PDF outside the vault is refused");
  assert.match(obsidian.notices[0], /no missing\.pdf/);
  assert.equal(plugin.openPdfDeepLink("just words"), null);
  assert.match(obsidian.notices[1], /not a PDF deep link/);
  assert.equal(opened.length, 1, "nothing else opened");
});

test("pdf deep links: the reader keeps the rect so it can ring it after rendering", () => {
  const modal = new PdfInkModal({}, {}, { pdfPath: "ch3.pdf", page: 5, rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 } });
  assert.deepEqual(modal.focusRect, { x: 0.1, y: 0.2, width: 0.3, height: 0.04 });
  assert.equal(modal.page, 5);
  const plain = new PdfInkModal({}, {}, { pdfPath: "ch3.pdf" });
  assert.equal(plain.focusRect, null, "no ring without a rectangle");
  const invalid = new PdfInkModal({}, {}, { pdfPath: "ch3.pdf", rect: { x: 0.9, y: 0.9, width: 1, height: 1 } });
  assert.equal(invalid.focusRect, null, "an off-page rectangle is dropped");
});
