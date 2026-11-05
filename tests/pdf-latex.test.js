"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T, Plugin: QT, obsidian } = load();
const latex = T.pdfLatex;

function fakeApp(files) {
  const map = new Map(Object.entries(files || {}));
  return {
    map,
    vault: {
      getAbstractFileByPath: (path) => (map.has(path) ? { path } : null),
      cachedRead: async (file) => map.get(file.path),
      readBinary: async () => new Uint8Array([1, 2, 3]),
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

test("latex: a PNG becomes bare base64 whichever shape the renderer returns", () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const expected = Buffer.from(bytes).toString("base64");
  assert.equal(latex.pngBase64(bytes), expected);
  assert.equal(latex.pngBase64("data:image/png;base64," + expected), expected);
  assert.equal(latex.pngBase64(expected), expected);
  assert.equal(latex.pngBase64(""), "");
  assert.equal(latex.pngBase64(null), "");
  assert.equal(latex.pngBase64(new Uint8Array(0)), "");
});

test("latex: the note path is safe and the reply is cleaned", () => {
  assert.equal(latex.latexNotePath("Papers/Ch 3.pdf"), "Ch 3 (LaTeX).md");
  assert.equal(latex.latexNotePath("Papers/b[c]:d.pdf"), "bcd (LaTeX).md");
  assert.equal(latex.extractLatexMarkdown("```latex\n$$x^2$$\n```"), "$$x^2$$");
  assert.equal(latex.extractLatexMarkdown("Here is the Markdown:\n\n## Page\n\nText"), "## Page\n\nText");
  assert.equal(latex.extractLatexMarkdown("   "), "");
});

test("latex: one note keeps every converted page and states the source", () => {
  const note = latex.buildLatexNote(
    [
      { n: 1, text: "$$a+b$$" },
      { n: 2, text: "```md\n## Step\n\n$$c$$\n```" },
      { n: 3, text: "  " },
    ],
    { title: "Chapter 3", sourcePath: "Papers/Ch 3.pdf", model: "vision-1", date: "2026-11-05" }
  );
  assert.equal(note.pages, 2, "an empty page is left out");
  assert.match(note.text, /latex: true/);
  assert.match(note.text, /source_pdf: "\[\[Papers\/Ch 3\.pdf\]\]"/);
  assert.match(note.text, /## Page 1/);
  assert.match(note.text, /## Step/);
  assert.ok(!/## Page 3/.test(note.text));
  assert.throws(() => latex.buildLatexNote([], {}), /no LaTeX text/);
});

test("latex: the plugin converts pages and writes a note beside the PDF", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.settings = { mcqEnabled: true, ai: { enabled: true } };
  plugin.app = fakeApp({ "Papers/Ch 3.pdf": "binary" });
  const sent = [];
  plugin.renderLatexPages = async () => ({ pages: [{ n: 1, png: new Uint8Array([1, 2, 3]) }], total: 1 });
  plugin.aiVision = async (system, prompt, images) => {
    sent.push({ system, prompt, images });
    return "```latex\n$$x^2$$\n```";
  };
  plugin.aiModelFor = () => "vision-1";

  const result = await plugin.convertPdfToLatex("Papers/Ch 3.pdf", "1");
  assert.equal(result.path, "Papers/Ch 3 (LaTeX).md");
  assert.equal(result.pages, 1);
  const written = plugin.app.map.get("Papers/Ch 3 (LaTeX).md");
  assert.match(written, /latex: true/);
  assert.match(written, /\$\$x\^2\$\$/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].images[0].data, Buffer.from([1, 2, 3]).toString("base64"));
  assert.equal(sent[0].images[0].mime, "image/png");
  assert.match(sent[0].prompt, /page 1/);

  const again = await plugin.convertPdfToLatex("Papers/Ch 3.pdf", "1");
  assert.equal(again.path, "Papers/Ch 3 (LaTeX) 2.md", "a second run never overwrites");
});

test("latex: a non-PDF and AI turned off are refused without a write", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.settings = { mcqEnabled: true, ai: { enabled: true } };
  plugin.app = fakeApp({ "notes.md": "text" });
  plugin.renderLatexPages = async () => ({ pages: [] });
  await assert.rejects(plugin.convertPdfToLatex("notes.md", "1"), /Open a PDF first/);
  plugin.settings.ai.enabled = false;
  plugin.app.map.set("Ch 1.pdf", "binary");
  await assert.rejects(plugin.convertPdfToLatex("Ch 1.pdf", "1"), /Turn on AI features/);
  assert.equal(plugin.app.map.size, 2, "nothing was written");
});

test("latex: the command asks for a page range and reports the note", () => {
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({});
  plugin.app.workspace.getActiveFile = () => ({ path: "Papers/Ch 3.pdf" });
  plugin.convertPdfToLatex = async () => ({ path: "Papers/Ch 3 (LaTeX).md", pages: 1 });
  obsidian.modals.length = 0;
  obsidian.notices.length = 0;
  plugin.convertActivePdfLatex();
  assert.equal(obsidian.modals.length, 1, "a page-range prompt opened");
  plugin.app.workspace.getActiveFile = () => ({ path: "notes.md" });
  plugin.convertActivePdfLatex();
  assert.equal(obsidian.notices.length, 1);
  assert.match(obsidian.notices[0], /Open a PDF first/);
});
