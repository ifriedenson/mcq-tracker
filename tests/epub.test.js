"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, Plugin: QT } = load();
const epub = T.epub;
const notes = T.epubAnnotations;
const { zipStore } = T.zipWrite;

const CONTAINER = `<?xml version="1.0"?><container version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const OPF = `<?xml version="1.0"?><package version="3.0"><metadata><dc:title>Cell Biology</dc:title></metadata><manifest><item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/><item id="css" href="style.css" media-type="text/css"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`;
const CH1 = `<?xml version="1.0"?><html><head><style>p { color: red }</style></head><body><h1>Membranes</h1><p>Water crosses a membrane by osmosis.</p><p>ATP powers active transport.</p><script>alert("x")</script></body></html>`;
const CH2 = `<?xml version="1.0"?><html><body><h2>Enzymes</h2><p>Enzymes lower activation energy.</p></body></html>`;

/** A real EPUB archive, written with the plugin's own ZIP writer (stored entries). */
function fixture() {
  return zipStore([
    { name: "mimetype", data: "application/epub+zip" },
    { name: "META-INF/container.xml", data: CONTAINER },
    { name: "OEBPS/content.opf", data: OPF },
    { name: "OEBPS/text/ch1.xhtml", data: CH1 },
    { name: "OEBPS/text/ch2.xhtml", data: CH2 },
    { name: "OEBPS/style.css", data: "p { color: red }" },
  ]);
}

function fakeApp(files) {
  const map = new Map(Object.entries(files || {}));
  return {
    map,
    vault: {
      getAbstractFileByPath: (path) => (map.has(path) ? { path } : null),
      cachedRead: async (file) => map.get(file.path),
      readBinary: async (file) => map.get(file.path),
      create: async (path, text) => {
        map.set(path, text);
        return { path };
      },
      modify: async (file, text) => {
        map.set(file.path, text);
        return { path: file.path };
      },
    },
    workspace: { getActiveFile: () => null },
  };
}

test("epub: the container, package and spine are read as ordered chapters", async () => {
  const book = await epub.readEpub(fixture());
  assert.equal(book.ok, true);
  assert.equal(book.title, "Cell Biology");
  assert.equal(book.total, 2);
  assert.deepEqual(book.chapters.map((chapter) => chapter.title), ["Membranes", "Enzymes"]);
  assert.match(book.chapters[0].text, /Water crosses a membrane by osmosis\./);
  assert.match(book.chapters[0].text, /ATP powers active transport\./);
  assert.ok(!/alert|color: red/.test(book.chapters[0].text), "script and style content is dropped");
  assert.match(book.chapters[1].text, /lower activation energy/);
  assert.equal(book.chapters[1].href, "OEBPS/text/ch2.xhtml", "the spine href resolves against the OPF folder");
});

test("epub: a broken or empty book is refused with a readable reason", async () => {
  await assert.rejects(epub.readEpub(new Uint8Array(0)), /empty/);
  await assert.rejects(epub.readEpub(new Uint8Array([1, 2, 3, 4])), /isn't an EPUB|not an EPUB/);
  const noContainer = zipStore([{ name: "mimetype", data: "application/epub+zip" }]);
  await assert.rejects(epub.readEpub(noContainer), /container\.xml/);
  const noSpine = zipStore([
    { name: "META-INF/container.xml", data: CONTAINER },
    { name: "OEBPS/content.opf", data: `<package><metadata></metadata><manifest></manifest><spine></spine></package>` },
  ]);
  await assert.rejects(epub.readEpub(noSpine), /no readable chapters/);
});

test("epub annotations: an annotation round-trips through the sidecar", () => {
  const chapterText = "Water crosses a membrane by osmosis.\n\nATP powers active transport.";
  const first = notes.addAnnotation("", { chapter: 1, quote: "ATP powers active transport.", note: "Exam favourite", color: "green", tags: "#bio, exam" }, {
    chapterText,
    epubPath: "Books/Bio.epub",
    hash: "abc123",
  });
  assert.equal(first.error, undefined);
  assert.equal(first.annotation.id, "ann-1");
  assert.equal(first.annotation.start, chapterText.indexOf("ATP"));
  assert.equal(first.annotation.end, first.annotation.start + "ATP powers active transport.".length);
  assert.deepEqual(first.annotation.tags, ["bio", "exam"]);
  assert.match(first.text, /^---\nepub: "Books\/Bio\.epub"/);

  const reopened = notes.parseSidecar(first.text);
  assert.equal(reopened.damaged.length, 0);
  assert.equal(reopened.epubPath, "Books/Bio.epub");
  assert.equal(reopened.epubHash, "abc123");
  assert.deepEqual(reopened.annotations, [first.annotation], "the annotation survives unchanged");

  const second = notes.addAnnotation(first.text, { chapter: 2, quote: "Enzymes lower activation energy.", color: "purple" }, {
    chapterText: "Enzymes lower activation energy.",
    epubPath: "Books/Bio.epub",
    hash: "abc123",
  });
  assert.equal(second.annotation.id, "ann-2", "ids never collide");
  assert.equal(second.annotations.length, 2);
  assert.deepEqual(notes.annotationsForChapter(second.annotations, 1).map((entry) => entry.id), ["ann-1"]);
  assert.deepEqual(notes.annotationsForChapter(second.annotations, 2).map((entry) => entry.id), ["ann-2"]);
});

test("epub annotations: quotes are anchored, not guessed, and damage is reported", () => {
  const chapterText = "Only this sentence is in the chapter.";
  const missing = notes.addAnnotation("", { chapter: 1, quote: "A sentence that is not there" }, { chapterText });
  assert.match(missing.error, /not in this chapter/);
  assert.equal(missing.annotations.length, 0);
  assert.match(notes.addAnnotation("", { chapter: 1, quote: "  " }, { chapterText }).error, /Select some text/);

  const parsed = notes.parseSidecar("---\nepub: Book.epub\n---\n\n<!-- mcq-epub-annotations -->\n```json\n{ not json\n```\n");
  assert.equal(parsed.annotations.length, 0);
  assert.match(parsed.damaged[0], /not valid JSON/);
  const skipped = notes.parseSidecar(
    '```json\n[{"id":"ann-1","chapter":1,"start":0,"end":4,"quote":"ok"},{"id":"bad","chapter":1,"start":0,"end":1,"quote":"x"}]\n```'
  );
  assert.equal(skipped.annotations.length, 1);
  assert.match(skipped.damaged[0], /Skipped an annotation/);
  assert.equal(notes.parseSidecar("").annotations.length, 0);
});

test("epub annotations: a replacement deletes cleanly and links are usable", () => {
  const chapterText = "Alpha beta gamma.";
  const added = notes.addAnnotation("", { chapter: 1, quote: "beta", note: "first" }, { chapterText, epubPath: "B.epub", hash: "h" });
  const updated = notes.addAnnotation(added.text, { chapter: 1, quote: "beta", note: "second" }, { chapterText, epubPath: "B.epub", hash: "h" });
  assert.equal(updated.annotations.length, 1, "the same range updates instead of duplicating");
  assert.equal(updated.annotation.id, "ann-1");
  assert.equal(updated.annotations[0].note, "second");
  const removed = notes.removeAnnotation(updated.text, "ann-1");
  assert.equal(removed.removed, true);
  assert.equal(notes.parseSidecar(removed.text).annotations.length, 0);
  assert.equal(notes.removeAnnotation(removed.text, "ann-9").removed, false, "a missing id changes nothing");

  assert.equal(notes.epubAnnotationLink("Books/Bio.epub", 2, "ann-3"), "[[Books/Bio.epub#chapter=2&annotation=ann-3]]");
  assert.equal(notes.epubAnnotationLink("Books/Bio.epub", 2), "[[Books/Bio.epub#chapter=2]]");
  assert.equal(notes.epubAnnotationLink("Books/Bio.md", 2, "ann-3"), "", "only EPUB paths link");
  assert.equal(notes.epubAnnotationLink("Books/Bio.epub", 0, "ann-3"), "");
  assert.match(notes.describeAnnotation({ id: "ann-1", chapter: 1, start: 0, end: 4, quote: "beta" }), /chapter 1/);
  assert.equal(notes.describeAnnotation(null), "That is not an EPUB annotation.");
  assert.deepEqual(notes.normalizeTags("a,b,c,d,e,f,g"), ["a", "b", "c", "d", "e", "f"], "at most six tags");
});

test("epub annotations: a highlight is written to the vault and re-read on reopen", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({ "Books/Bio.epub": fixture() });
  plugin.settings = { mcqEnabled: true };

  const book = await plugin.epubBook("Books/Bio.epub");
  assert.equal(book.total, 2, "the plugin reads the book from the vault");

  const added = await plugin.addEpubHighlight("Books/Bio.epub", {
    chapter: 1,
    quote: "ATP powers active transport.",
    note: "Key idea",
    color: "green",
    tags: "bio",
  });
  assert.equal(added.annotation.chapter, 1);
  const sidecar = plugin.app.map.get("Books/Bio.epub.annotations.md");
  assert.ok(sidecar, "the sidecar was created beside the book");
  assert.match(sidecar, /epub: "Books\/Bio\.epub"/);

  const reopened = await plugin.epubAnnotations("Books/Bio.epub");
  assert.equal(reopened.annotations.length, 1, "reopening the book re-reads the annotation");
  assert.equal(reopened.annotations[0].note, "Key idea");
  assert.equal(reopened.annotations[0].quote, "ATP powers active transport.");
  assert.equal(reopened.annotations[0].color, "green");

  const second = await plugin.addEpubHighlight("Books/Bio.epub", { chapter: 2, quote: "Enzymes lower activation energy." });
  assert.equal(second.annotations.length, 2);
  const removed = await plugin.deleteEpubAnnotation("Books/Bio.epub", "ann-1");
  assert.equal(removed, true);
  assert.equal((await plugin.epubAnnotations("Books/Bio.epub")).annotations.length, 1);
  assert.equal(await plugin.deleteEpubAnnotation("Books/Bio.epub", "ann-42"), false, "a missing annotation is not deleted");
});

test("epub annotations: a non-EPUB, a missing book and an unanchored quote are refused", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({ "notes.md": "text" });
  await assert.rejects(plugin.epubBook("notes.md"), /EPUB/);
  await assert.rejects(plugin.epubBook("gone.epub"), /no .*gone\.epub|not in the vault|EPUB/i);
  plugin.app.map.set("Books/Bio.epub", fixture());
  await assert.rejects(
    plugin.addEpubHighlight("Books/Bio.epub", { chapter: 1, quote: "Not a sentence in this book" }),
    /not in this chapter/
  );
  assert.equal(plugin.app.vault.getAbstractFileByPath("Books/Bio.epub.annotations.md"), null, "nothing was written");
});

test("epub: paragraphs carry the annotations that overlap them", async () => {
  const book = await epub.readEpub(fixture());
  const chapter = book.chapters[0];
  const quote = "ATP powers active transport.";
  const added = notes.addAnnotation("", { chapter: 1, quote, color: "green" }, { chapterText: chapter.text, epubPath: "Books/Bio.epub", hash: "h" });
  const rows = epub.annotateParagraphs(chapter.text, notes.annotationsForChapter(added.annotations, 1));
  assert.ok(rows.length >= 2, "the chapter is split into paragraphs");
  const marked = rows.filter((row) => row.ids.length);
  assert.equal(marked.length, 1, "only the paragraph holding the quote is marked");
  assert.equal(marked[0].text, quote);
  assert.ok(marked[0].start <= added.annotation.start && marked[0].end >= added.annotation.end, "the range covers the annotation");
  const untouched = rows.filter((row) => !row.ids.length);
  assert.ok(untouched.every((row) => row.annotations.length === 0), "the other paragraphs stay clean");
  assert.deepEqual(epub.paragraphsOf("one\n\ntwo\n\nthree").map((row) => row.text), ["one", "two", "three"]);
  assert.deepEqual(epub.paragraphsOf(""), []);
});

test("epub reader: the modal marks, annotates and removes through the plugin", async () => {
  const book = await epub.readEpub(fixture());
  const calls = [];
  const plugin = {
    epubBook: async () => book,
    epubAnnotations: async () => ({ annotations: [], damaged: [] }),
    addEpubHighlight: async (path, input) => {
      calls.push({ path, input });
      return { annotation: { id: "ann-1" }, annotations: [] };
    },
    deleteEpubAnnotation: async (path, id) => {
      calls.push({ path, id });
      return true;
    },
  };
  const modal = new T.EpubReaderModal({}, plugin, { path: "Books/Bio.epub" });
  assert.equal(modal.path, "Books/Bio.epub");
  modal.book = book;
  modal.chapter = 2;
  assert.equal(modal.chapterEntry().title, "Enzymes");
  assert.equal(modal.goTo(9), false, "a chapter outside the book is refused");
  assert.equal(modal.goTo(1), true);

  const row = { text: "Water crosses a membrane by osmosis.", start: 0, end: 38 };
  assert.equal(await modal.mark(row), true);
  assert.deepEqual(calls[0], {
    path: "Books/Bio.epub",
    input: { chapter: 1, quote: "Water crosses a membrane by osmosis.", start: 0, end: 38, color: "yellow" },
  });
  assert.equal(await modal.annotate(row, "Exam"), true);
  assert.equal(calls[1].input.note, "Exam");
  assert.equal(await modal.remove("ann-1"), true);
  assert.deepEqual(calls[2], { path: "Books/Bio.epub", id: "ann-1" });
  assert.deepEqual(modal.annotationsFor(1), []);

  const failing = new T.EpubReaderModal({}, { ...plugin, addEpubHighlight: async () => { throw new Error("no anchor"); } }, { path: "B.epub" });
  assert.equal(await failing.mark(row), false, "a failed highlight is reported, not thrown");
});

test("epub: the reader and annotation commands are registered", async () => {
  const { makeApp } = require("./helpers/fake");
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const ids = plugin.commands.map((command) => command.id);
  assert.ok(ids.includes("epub-read"), "EPUB: open the reader is registered");
  assert.ok(ids.includes("epub-annotations"), "EPUB: open this book's annotations is registered");
  for (const name of ["openActiveEpubReader", "openEpubAnnotations", "epubBook", "addEpubHighlight"]) {
    assert.equal(typeof plugin[name], "function", `${name} exists`);
  }
});
