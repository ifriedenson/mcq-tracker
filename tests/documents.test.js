"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { load } = require("./helpers/load");

const T = load().T;
const D = T.documents;
const read = (buf, name, spec) => D.readDocumentPages(buf, name, spec || "", () => {});

/** A small ZIP writer, so the Office fixtures below are real archives. */
function zip(files, options) {
  const deflate = !!(options && options.deflate);
  const names = Object.keys(files);
  const parts = [];
  const central = [];
  let offset = 0;
  for (const name of names) {
    const nameBuf = Buffer.from(name, "utf8");
    const raw = Buffer.from(files[name], "utf8");
    const data = deflate ? zlib.deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, data);

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(method, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(0, 14);
    c.writeUInt32LE(0, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt16LE(0, 30);
    c.writeUInt16LE(0, 32);
    c.writeUInt16LE(0, 34);
    c.writeUInt16LE(0, 36);
    c.writeUInt32LE(0, 38);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, eocd]);
}

const slide = (lines) =>
  `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${lines
    .map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`)
    .join("")}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

test("documents: file types are recognised from their extension, including upper case", () => {
  assert.equal(D.documentKind("deck.pptx"), "pptx");
  assert.equal(D.documentKind("DECK.PPTX"), "pptx");
  assert.equal(D.documentKind("questions.docx"), "docx");
  assert.equal(D.documentKind("notes.ODT"), "odt");
  assert.equal(D.documentKind("page.html"), "html");
  assert.equal(D.documentKind("questions.txt"), "txt");
  assert.equal(D.documentKind("questions.xlsx"), "");
  assert.equal(D.documentKind("no-extension"), "");
  assert.equal(D.documentBaseName("Questions/Deck.pptx"), "Deck");
  assert.ok(D.DOCUMENT_EXTENSIONS.includes("pptx"));
});

test("documents: PowerPoint slides are read in slide order, with entities decoded", async () => {
  const buf = zip({
    "ppt/slides/slide2.xml": slide(["Question 2: Which is a noble gas?", "- A. Oxygen", "- B. Helium"]),
    "ppt/slides/slide1.xml": slide(["Question 1: What is 2 + 2?", "- A. 3 &amp; 1", "- B. 4"]),
  });
  const out = await read(buf, "deck.pptx");
  assert.equal(out.kind, "pptx");
  assert.equal(out.total, 2);
  assert.match(out.pages[0].text, /Question 1: What is 2 \+ 2\?/);
  assert.match(out.pages[0].text, /A\. 3 & 1/);
  assert.match(out.pages[1].text, /Question 2/);
});

test("documents: a compressed PowerPoint is inflated, and a page range picks slides", async () => {
  const buf = zip(
    {
      "ppt/slides/slide1.xml": slide(["Question 1", "- A. one", "- B. two"]),
      "ppt/slides/slide2.xml": slide(["Question 2", "- A. three", "- B. four"]),
    },
    { deflate: true }
  );
  const out = await read(buf, "deck.pptx", "2");
  assert.equal(out.total, 2);
  assert.equal(out.pages.length, 1);
  assert.equal(out.pages[0].n, 2);
  assert.match(out.pages[0].text, /Question 2/);
});

test("documents: Word paragraphs, tables and page breaks become pages", async () => {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:r><w:t>Question 1</w:t></w:r></w:p>
    <w:p><w:r><w:t>What is 2 + 2?</w:t></w:r></w:p>
    <w:p><w:r><w:t>A &amp; B</w:t></w:r></w:p>
    <w:p><w:r><w:br w:type="page"/></w:r><w:r><w:t>Question 2</w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
  </w:body></w:document>`;
  const out = await read(zip({ "word/document.xml": xml }), "questions.docx");
  assert.equal(out.kind, "docx");
  assert.equal(out.total, 2);
  assert.match(out.pages[0].text, /Question 1/);
  assert.match(out.pages[0].text, /A & B/);
  assert.match(out.pages[1].text, /Question 2/);
  assert.match(out.pages[1].text, /Table cell/);
});

test("documents: OpenDocument presentations use one page per slide", async () => {
  const xml = `<office:document-content><office:body><office:presentation>
    <draw:page><text:p>Slide one</text:p></draw:page>
    <draw:page><text:p>Slide two</text:p><text:p>Second line</text:p></draw:page>
  </office:presentation></office:body></office:document-content>`;
  const out = await read(zip({ "content.xml": xml }), "deck.odp");
  assert.equal(out.kind, "odp");
  assert.equal(out.total, 2);
  assert.equal(out.pages[0].text, "Slide one");
  assert.match(out.pages[1].text, /Slide two\nSecond line/);
});

test("documents: plain text splits at form feeds, and HTML and RTF are made readable", async () => {
  const text = await read(Buffer.from("Question 1\n\nA. one\fQuestion 2\n\nA. two"), "questions.txt");
  assert.equal(text.total, 2);
  assert.match(text.pages[0].text, /Question 1/);
  assert.match(text.pages[1].text, /Question 2/);

  const html = await read(Buffer.from("<h1>Question 1</h1><p>A &amp; B</p><script>bad()</script>"), "questions.html");
  assert.match(html.pages[0].text, /Question 1/);
  assert.match(html.pages[0].text, /A & B/);
  assert.ok(!html.pages[0].text.includes("bad()"));

  const rtf = await read(Buffer.from("{\\rtf1 Question 1\\par A. one\\par}"), "questions.rtf");
  assert.match(rtf.pages[0].text, /Question 1\nA\. one/);
});

test("documents: an unsupported file, a damaged archive and an empty deck each explain the problem", async () => {
  await assert.rejects(() => read(Buffer.from("a,b"), "questions.xlsx"), /can't read \.xlsx/);
  await assert.rejects(() => read(Buffer.from("not a zip"), "deck.pptx"), /valid Office file/);
  await assert.rejects(() => read(zip({ "docProps/core.xml": "<x/>" }), "deck.pptx"), /no slides/);
  await assert.rejects(() => read(Buffer.from("%PDF-1.4"), "questions.pdf"), /readPdfPages/);
});
