"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, Plugin: QT } = load();
const pdf = T.pdfAnnotations;
const sidebars = T.pdfAnnotatorSidebar;
const { makeApp, makeDom } = require("./helpers/fake");

const ROWS = [
  { id: "ann-2", page: 4, type: "underline", color: "blue", note: "second", quote: "", tags: ["exam"], areas: [{ x: 0.2, y: 0.5, width: 0.3, height: 0.01 }] },
  { id: "ann-1", page: 2, type: "quote", color: "yellow", note: "remember ATP", quote: "ATP is energy", tags: ["bio", "key-idea"], areas: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.02 }] },
  { id: "ann-3", page: 2, type: "highlight", color: "green", note: "", quote: "", tags: [], areas: [] },
];

/** Fires a recorded DOM handler of `ev` on the first matching recorded element. */
function fire(dom, match, ev, event) {
  const hit = dom.all.find((entry) => entry.meta && match(entry.meta) && entry.handlers.some((handler) => handler.ev === ev));
  assert.ok(hit, `no ${ev} target`);
  for (const handler of hit.handlers.filter((entry) => entry.ev === ev)) handler.fn(event || {});
  return hit;
}

test("pdf sidebar: rows carry type, page, note, tags and selection", () => {
  const rows = sidebars.sidebarRows(ROWS, {});
  assert.deepEqual(rows.map((row) => row.id), ["ann-1", "ann-3", "ann-2"], "rows read in page order");
  assert.equal(rows[0].label, "quote · page 2");
  assert.equal(rows[0].note, "remember ATP");
  assert.equal(rows[0].tagText, "#bio #key-idea", "tag chips are hash-prefixed");
  assert.equal(rows[0].selected, false);

  const selected = sidebars.sidebarRows(ROWS, { selectedId: "ann-2" });
  assert.equal(selected.find((row) => row.id === "ann-2").selected, true);
  assert.equal(selected.find((row) => row.id === "ann-1").selected, false);

  assert.deepEqual(sidebars.sidebarRows(ROWS, { query: "atp" }).map((row) => row.id), ["ann-1"], "search matches quotes");
  assert.deepEqual(sidebars.sidebarRows(ROWS, { query: "key-idea" }).map((row) => row.id), ["ann-1"], "search matches tags");
  assert.deepEqual(sidebars.sidebarRows(ROWS, { type: "underline" }).map((row) => row.id), ["ann-2"]);
  assert.equal(sidebars.sidebarRows(ROWS, { query: "nothing here" }).length, 0);
  assert.equal(sidebars.sidebarRows(null, {}).length, 0, "missing rows are safe");
});

test("pdf sidebar: tag input follows the bounded, hash-free rules", () => {
  assert.deepEqual(sidebars.tagInput("#Exam, exam, green tag"), ["Exam", "green-tag"], "tags stay hash-free and unique");
  assert.deepEqual(sidebars.tagInput("#exam #bio"), ["exam", "bio"], "a hash starts a new tag");
  assert.deepEqual(sidebars.tagInput(""), []);
  const many = sidebars.tagInput("a,b,c,d,e,f,g,h");
  assert.equal(many.length, 6, "at most six tags");
  assert.equal(sidebars.tagInput("x".repeat(40))[0].length, 24, "tags are capped at 24 characters");
  assert.equal(sidebars.tagInput("##double")[0], "double");
});

test("pdf sidebar: selection bounds union every area and stay on the page", () => {
  const bounds = sidebars.selectionBounds([
    { x: 0.2, y: 0.4, width: 0.2, height: 0.02 },
    { x: 0.1, y: 0.6, width: 0.3, height: 0.02 },
  ]);
  assert.ok(bounds.x <= 0.1 && bounds.y <= 0.4);
  assert.ok(bounds.x + bounds.width >= 0.4);
  assert.ok(bounds.y + bounds.height >= 0.62);
  assert.equal(sidebars.selectionBounds([]), null);
  const clamped = sidebars.selectionBounds([{ x: 0.9, y: 0.95, width: 0.5, height: 0.5 }]);
  assert.ok(clamped.x + clamped.width <= 1.0001 && clamped.y + clamped.height <= 1.0001, "bounds are clamped to the page");
  assert.equal(sidebars.rowPage({ page: "3" }), 3);
  assert.equal(sidebars.rowPage(null), 1);
  assert.equal(sidebars.nextSelectedId(ROWS, "ann-2"), "ann-1");
  assert.equal(sidebars.nextSelectedId([ROWS[0]], "ann-2"), "");
});

test("pdf sidebar: the renderer lists rows, filters and routes every action", async () => {
  const dom = makeDom();
  const calls = [];
  const handlers = {
    onSelect: (id) => calls.push(["select", id]),
    onQuery: (value) => calls.push(["query", value]),
    onType: (value) => calls.push(["type", value]),
    onToggle: (open) => calls.push(["toggle", open]),
    onEditNote: (id) => calls.push(["edit-note", id]),
    onEditTags: (id) => calls.push(["edit-tags", id]),
    onDelete: (id) => calls.push(["delete", id]),
  };
  sidebars.renderSidebar(dom.root, { rows: sidebars.sidebarRows(ROWS, {}), total: 3, types: ["highlight", "quote", "underline"] }, handlers);

  for (const text of ["quote · page 2", "remember ATP", "#bio", "#key-idea", "underline · page 4", "3 of 3"]) {
    assert.ok(dom.texts().includes(text), `the sidebar shows ${text}`);
  }
  await dom.click("quote · page 2");
  assert.deepEqual(calls.pop(), ["select", "ann-1"], "clicking a row jumps to it");
  await dom.click("Edit note");
  assert.deepEqual(calls.pop(), ["edit-note", "ann-1"]);
  await dom.click("Edit tags");
  assert.deepEqual(calls.pop(), ["edit-tags", "ann-1"]);
  await dom.click("Delete");
  assert.deepEqual(calls.pop(), ["delete", "ann-1"]);
  await dom.click("Hide sidebar");
  assert.deepEqual(calls.pop(), ["toggle", false]);

  fire(dom, (meta) => meta.tag === "input" && meta.type === "search", "input", { target: {} });
  assert.equal(calls.pop()[0], "query", "the search box reports typing");
  fire(dom, (meta) => meta.tag === "select", "change");
  assert.equal(calls.pop()[0], "type", "the type filter reports changes");

  const empty = makeDom();
  sidebars.renderSidebar(empty.root, { rows: [], total: 0, types: [] }, handlers);
  assert.ok(empty.texts().includes("No annotations yet. Mark the page or select text to start."));
  const filtered = makeDom();
  sidebars.renderSidebar(filtered.root, { rows: [], total: 4, types: ["quote"] }, handlers);
  assert.ok(filtered.texts().includes("No annotation matches that filter."));
});

test("pdf sidebar: inline note and tag editors show the saved values and report edits", async () => {
  const dom = makeDom();
  let savedNote = null;
  let savedTags = null;
  const rows = sidebars.sidebarRows(ROWS, {});
  sidebars.renderSidebar(dom.root, { rows, total: 3, types: ["quote"], editingNoteId: "ann-1" }, { onSaveNote: (id, text) => { savedNote = [id, text]; }, onCancelEdit: () => {} });
  const textarea = dom.all.find((entry) => entry.meta && entry.meta.tag === "textarea");
  assert.equal(textarea.value, "remember ATP", "the editor starts from the saved note");
  textarea.value = "edited in the reader";
  await dom.click("Save note");
  assert.deepEqual(savedNote, ["ann-1", "edited in the reader"]);

  const tagDom = makeDom();
  sidebars.renderSidebar(tagDom.root, { rows, total: 3, types: ["quote"], editingTagsId: "ann-1" }, { onSaveTags: (id, text) => { savedTags = [id, text]; }, onCancelEdit: () => {} });
  const input = tagDom.all.find((entry) => entry.meta && entry.meta.tag === "input" && entry.meta.type === "text");
  assert.equal(input.value, "#bio #key-idea", "the tag editor starts from the saved tags");
  input.value = "#revised";
  await tagDom.click("Save tags");
  assert.deepEqual(savedTags, ["ann-1", "#revised"]);
});

test("pdf plugin: tag edits persist, are normalized and keep one row per annotation", async () => {
  const sidecar = pdf.serializeAnnotationFile("Papers/Exam.pdf", "hash", [
    { page: 2, type: "quote", color: "yellow", quote: "ATP is energy", note: "old note", tags: ["exam"], areas: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.02 }] },
    { page: 3, type: "underline", color: "blue", areas: [{ x: 0.1, y: 0.3, width: 0.2, height: 0.004 }] },
  ]);
  const app = makeApp([
    { path: "Papers/Exam.pdf", noFm: true, text: "" },
    { path: "Papers/Exam.annotations.md", noFm: true, text: sidecar },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const before = plugin.pdfAnnotationRevision || 0;
  const id = (await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows.find((row) => row.type === "quote").id;

  const updated = await plugin.updatePdfAnnotationTags("Papers/Exam.pdf", id, ["#Exam", "exam", "green tag", "x".repeat(30)]);
  assert.deepEqual(updated.tags, ["Exam", "green-tag", "x".repeat(24)], "hash-free, deduped and bounded");
  assert.equal(updated.note, "old note", "a tags-only edit keeps the note");
  assert.ok(plugin.pdfAnnotationRevision > before, "the index knows something changed");

  const rows = (await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows;
  assert.equal(rows.length, 2, "editing tags never duplicates rows");
  assert.deepEqual(rows.find((row) => row.id === id).tags, ["Exam", "green-tag", "x".repeat(24)]);
  const file = app.files.find((entry) => entry.path === "Papers/Exam.annotations.md");
  assert.match(file.text, /#green-tag/, "the sidecar holds the new tag");
  assert.equal(await plugin.updatePdfAnnotationTags("Papers/Exam.pdf", "missing", ["a"]), null);
  assert.equal(await plugin.updatePdfAnnotationTags("Papers/NoSuch.pdf", id, ["a"]), null);

  const index = await plugin.getPdfAnnotationIndex();
  assert.ok(index.rows.some((row) => row.id === id && row.tags.includes("green-tag")), "the index tab reads the same sidecar");

  const digestPath = await plugin.exportPdfAnnotations("Papers/Exam.pdf");
  const digest = app.files.find((entry) => entry.path === digestPath);
  assert.match(digest.text, /#green-tag/, "the digest shows the edited tag");
  assert.match(digest.text, /old note/);

  const noteUpdated = await plugin.updatePdfAnnotationNote("Papers/Exam.pdf", id, "note from the sidebar");
  assert.equal(noteUpdated.note, "note from the sidebar");
  assert.deepEqual(noteUpdated.tags, ["Exam", "green-tag", "x".repeat(24)], "a note edit keeps the tags");
  const digestPath2 = await plugin.exportPdfAnnotations("Papers/Exam.pdf");
  const digest2 = app.files.find((entry) => entry.path === digestPath2);
  assert.match(digest2.text, /note from the sidebar/);
});

test("pdf reader: sidebar picks a row, jumps pages, edits and deletes without drift", async () => {
  const sidecar = pdf.serializeAnnotationFile("Papers/Exam.pdf", "hash", [
    { page: 2, type: "quote", color: "yellow", quote: "ATP is energy", note: "old note", tags: ["exam"], areas: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.02 }] },
    { page: 3, type: "underline", color: "blue", areas: [{ x: 0.1, y: 0.3, width: 0.2, height: 0.004 }] },
  ]);
  const app = makeApp([
    { path: "Papers/Exam.pdf", noFm: true, text: "" },
    { path: "Papers/Exam.annotations.md", noFm: true, text: sidecar },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const modal = new T.pdfInkModal.PdfInkModal(app, plugin, { pdfPath: "Papers/Exam.pdf", page: 2 });
  modal.app = app;
  const dom = makeDom();
  modal.sidebarEl = dom.root;
  modal.statusEl = dom.root;
  modal.annotationRows = (await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows;
  modal.renderSidebarPanel();

  assert.ok(dom.texts().includes("quote · page 2"));
  assert.ok(dom.texts().includes("underline · page 3"));
  assert.ok(dom.texts().includes("old note"));
  assert.ok(dom.texts().includes("#exam"));

  const jumps = [];
  modal.goToPage = async (page) => { jumps.push(page); };
  const underline = modal.annotationRows.find((row) => row.type === "underline");
  await modal.selectAnnotation(underline.id);
  assert.deepEqual(jumps, [3], "another page is loaded for the chosen row");
  assert.equal(modal.selectedId, underline.id);
  const quote = modal.annotationRows.find((row) => row.type === "quote");
  await modal.selectAnnotation(quote.id);
  assert.deepEqual(jumps, [3], "the current page is not reloaded");

  modal.sidebarQuery = "underline";
  const filtered = makeDom();
  modal.sidebarEl = filtered.root;
  modal.renderSidebarPanel();
  assert.equal(filtered.texts().includes("quote · page 2"), false, "the sidebar search filters rows");
  assert.ok(filtered.texts().includes("underline · page 3"));
  modal.sidebarQuery = "";
  modal.sidebarEl = dom.root;
  modal.renderSidebarPanel();

  await modal.saveSidebarNote(quote.id, "edited inline");
  assert.equal((await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows.find((row) => row.id === quote.id).note, "edited inline");
  assert.ok(dom.texts().includes("edited inline"), "the row redraws from the sidecar");

  await modal.saveSidebarTags(quote.id, "#revised, second tag");
  assert.deepEqual((await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows.find((row) => row.id === quote.id).tags, ["revised", "second-tag"]);
  assert.ok(dom.texts().includes("#second-tag"));

  const page = modal.page;
  jumps.length = 0;
  await modal.deleteSidebarAnnotation(underline.id);
  assert.equal(modal.page, page, "deleting never changes the page");
  assert.deepEqual(jumps, [], "deleting never reloads the page");
  assert.equal((await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows.length, 1);
  const afterDelete = makeDom();
  modal.sidebarEl = afterDelete.root;
  modal.renderSidebarPanel();
  assert.equal(afterDelete.texts().includes("underline · page 3"), false, "the deleted row disappears");
  assert.equal(modal.selectedId, quote.id, "deleting another row keeps the current selection");

  await modal.selectAnnotation(quote.id);
  jumps.length = 0;
  await modal.deleteSidebarAnnotation(quote.id);
  assert.equal(modal.selectedId, "", "deleting the selected row clears the selection");
  assert.equal(modal.page, page, "the page still never moves");
  assert.deepEqual(jumps, [], "deleting the selected row never reloads a page");
  assert.equal((await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows.length, 0);
  modal.sidebarEl = dom.root;
  modal.renderSidebarPanel();

  modal.toggleSidebar(false);
  assert.equal(modal.sidebarOpen, false);
  assert.equal(modal.sidebarEl.hasClass("is-collapsed"), true);
  assert.equal(app.loadLocalStorage("mcq-pdf-sidebar-open"), false, "the closed sidebar is remembered");
  modal.toggleSidebar(true);
  assert.equal(modal.sidebarOpen, true);

  const plain = { key: "a", target: { tagName: "DIV" }, preventDefault() {} };
  assert.equal(modal.handleKey(plain), true);
  assert.equal(modal.sidebarOpen, false);
  assert.equal(modal.handleKey({ key: "a", target: { tagName: "TEXTAREA" } }), false, "typing an A in a field is not a shortcut");
  assert.equal(modal.handleKey({ key: "a", ctrlKey: true, target: { tagName: "DIV" } }), false);
});

test("pdf reader: the mark prompt sets tags at creation time", async () => {
  const sidecar = pdf.serializeAnnotationFile("Papers/Exam.pdf", "hash", []);
  const app = makeApp([
    { path: "Papers/Exam.pdf", noFm: true, text: "" },
    { path: "Papers/Exam.annotations.md", noFm: true, text: sidecar },
  ]);
  const plugin = new QT(app);
  await plugin.onload();
  const dom = makeDom();
  let done = null;
  const prompt = new T.pdfInkModal.TextBoxPromptModal(app, { title: "Highlight note", text: "", tags: ["exam"] }, (text, tags) => { done = [text, tags]; });
  prompt.modalEl = dom.root;
  prompt.contentEl = dom.root;
  prompt.close = () => {};
  prompt.onOpen();
  assert.equal(prompt.tagEl.value, "#exam", "the prompt starts from the layer's tags");
  const textarea = dom.all.find((entry) => entry.meta && entry.meta.tag === "textarea");
  textarea.value = "created with tags";
  prompt.tagEl.value = "created, #at-create";
  prompt.commit();
  assert.deepEqual(done, ["created with tags", "created, #at-create"]);

  const modal = new T.pdfInkModal.PdfInkModal(app, plugin, { pdfPath: "Papers/Exam.pdf", page: 2 });
  modal.app = app;
  modal.sidebarEl = makeDom().root;
  const statusDom = makeDom();
  modal.statusEl = statusDom.root;
  const saved = await modal.saveQuote({ quote: "ATP is energy", areas: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.02 }], note: "first", color: "yellow", tags: sidebars.tagInput("at-create, exam") });
  assert.equal(saved, true, statusDom.texts().join(" | "));
  const row = (await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows[0];
  assert.deepEqual(row.tags, ["at-create", "exam"], "tags set while creating are on the annotation");
  const rows = sidebars.sidebarRows((await plugin.pdfAnnotationRows("Papers/Exam.pdf")).rows, {});
  assert.equal(rows[0].tagText, "#at-create #exam", "the new row shows the creation tags");
  const digestPath = await plugin.exportPdfAnnotations("Papers/Exam.pdf");
  const digest = app.files.find((entry) => entry.path === digestPath);
  assert.match(digest.text, /#at-create/, "the digest shows creation-time tags");
});
